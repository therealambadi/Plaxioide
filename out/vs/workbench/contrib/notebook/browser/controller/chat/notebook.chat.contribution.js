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
import { CancellationToken } from "../../../../../../base/common/cancellation.js";
import { codiconsLibrary } from "../../../../../../base/common/codiconsLibrary.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { Range } from "../../../../../../editor/common/core/range.js";
import { CompletionItemKind } from "../../../../../../editor/common/languages.js";
import { ILanguageFeaturesService } from "../../../../../../editor/common/services/languageFeatures.js";
import { localize } from "../../../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../../../platform/actions/common/actions.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../../../platform/contextkey/common/contextkey.js";
import { IQuickInputService } from "../../../../../../platform/quickinput/common/quickInput.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../../../common/contributions.js";
import { IEditorService } from "../../../../../services/editor/common/editorService.js";
import { IChatWidgetService } from "../../../../chat/browser/chat.js";
import { ChatInputPart } from "../../../../chat/browser/chatInputPart.js";
import { ChatDynamicVariableModel } from "../../../../chat/browser/contrib/chatDynamicVariables.js";
import { computeCompletionRanges } from "../../../../chat/browser/contrib/chatInputCompletions.js";
import { IChatAgentService } from "../../../../chat/common/chatAgents.js";
import { ChatAgentLocation } from "../../../../chat/common/constants.js";
import { ChatContextKeys } from "../../../../chat/common/chatContextKeys.js";
import { chatVariableLeader } from "../../../../chat/common/chatParserTypes.js";
import { NOTEBOOK_CELL_HAS_OUTPUTS, NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT, NOTEBOOK_CELL_OUTPUT_MIMETYPE } from "../../../common/notebookContextKeys.js";
import { INotebookKernelService } from "../../../common/notebookKernelService.js";
import { getNotebookEditorFromEditorPane } from "../../notebookBrowser.js";
import * as icons from "../../notebookIcons.js";
import { getOutputViewModelFromId } from "../cellOutputActions.js";
import { NOTEBOOK_ACTIONS_CATEGORY } from "../coreActions.js";
import { CellUri } from "../../../common/notebookCommon.js";
import "./cellChatActions.js";
import { CTX_NOTEBOOK_CHAT_HAS_AGENT } from "./notebookChatContext.js";
const NotebookKernelVariableKey = "kernelVariable";
const NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST = [
  "text/plain",
  "text/html",
  "application/vnd.code.notebook.error",
  "application/vnd.code.notebook.stdout",
  "application/x.notebook.stdout",
  "application/x.notebook.stream",
  "application/vnd.code.notebook.stderr",
  "application/x.notebook.stderr",
  "image/png",
  "image/jpeg",
  "image/svg"
];
let NotebookChatContribution = class extends Disposable {
  constructor(contextKeyService, chatAgentService, editorService, chatWidgetService, notebookKernelService, languageFeaturesService) {
    super();
    this.editorService = editorService;
    this.chatWidgetService = chatWidgetService;
    this.notebookKernelService = notebookKernelService;
    this.languageFeaturesService = languageFeaturesService;
    this._ctxHasProvider = CTX_NOTEBOOK_CHAT_HAS_AGENT.bindTo(contextKeyService);
    const updateNotebookAgentStatus = () => {
      const hasNotebookAgent = Boolean(chatAgentService.getDefaultAgent(ChatAgentLocation.Notebook));
      this._ctxHasProvider.set(hasNotebookAgent);
    };
    updateNotebookAgentStatus();
    this._register(chatAgentService.onDidChangeAgents(updateNotebookAgentStatus));
    this._register(this.languageFeaturesService.completionProvider.register({ scheme: ChatInputPart.INPUT_SCHEME, hasAccessToAllModels: true }, {
      _debugDisplayName: "chatKernelDynamicCompletions",
      triggerCharacters: [chatVariableLeader],
      provideCompletionItems: async (model, position, _context, token) => {
        const widget = this.chatWidgetService.getWidgetByInputUri(model.uri);
        if (!widget || !widget.supportsFileReferences) {
          return null;
        }
        if (widget.location !== ChatAgentLocation.Notebook) {
          return null;
        }
        const variableNameDef = new RegExp(`${chatVariableLeader}\\w*`, "g");
        const range = computeCompletionRanges(model, position, variableNameDef, true);
        if (!range) {
          return null;
        }
        const result = { suggestions: [] };
        const afterRange = new Range(position.lineNumber, range.replace.startColumn, position.lineNumber, range.replace.startColumn + `${chatVariableLeader}${NotebookKernelVariableKey}:`.length);
        result.suggestions.push({
          label: `${chatVariableLeader}${NotebookKernelVariableKey}`,
          insertText: `${chatVariableLeader}${NotebookKernelVariableKey}:`,
          detail: localize("pickKernelVariableLabel", "Pick a variable from the kernel"),
          range,
          kind: CompletionItemKind.Text,
          command: { id: SelectAndInsertKernelVariableAction.ID, title: SelectAndInsertKernelVariableAction.ID, arguments: [{ widget, range: afterRange }] },
          sortText: "z"
        });
        await this.addKernelVariableCompletion(widget, result, range, token);
        return result;
      }
    }));
    NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT.bindTo(contextKeyService).set(NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST);
  }
  async addKernelVariableCompletion(widget, result, info, token) {
    let pattern;
    if (info.varWord?.word && info.varWord.word.startsWith(chatVariableLeader)) {
      pattern = info.varWord.word.toLowerCase().slice(1);
    }
    const notebook = getNotebookEditorFromEditorPane(this.editorService.activeEditorPane)?.getViewModel()?.notebookDocument;
    if (!notebook) {
      return;
    }
    const selectedKernel = this.notebookKernelService.getMatchingKernel(notebook).selected;
    const hasVariableProvider = selectedKernel?.hasVariableProvider;
    if (!hasVariableProvider) {
      return;
    }
    const variables = await selectedKernel.provideVariables(notebook.uri, void 0, "named", 0, CancellationToken.None);
    for await (const variable of variables) {
      if (pattern && !variable.name.toLowerCase().includes(pattern)) {
        continue;
      }
      result.suggestions.push({
        label: { label: variable.name, description: variable.type },
        insertText: `${chatVariableLeader}${NotebookKernelVariableKey}:${variable.name} `,
        filterText: `${chatVariableLeader}${variable.name}`,
        range: info,
        kind: CompletionItemKind.Variable,
        sortText: "z",
        command: { id: SelectAndInsertKernelVariableAction.ID, title: SelectAndInsertKernelVariableAction.ID, arguments: [{ widget, range: info.insert, variable: variable.name }] },
        detail: variable.type,
        documentation: variable.value
      });
    }
  }
};
NotebookChatContribution.ID = "workbench.contrib.notebookChatContribution";
NotebookChatContribution = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IChatAgentService),
  __decorateParam(2, IEditorService),
  __decorateParam(3, IChatWidgetService),
  __decorateParam(4, INotebookKernelService),
  __decorateParam(5, ILanguageFeaturesService)
], NotebookChatContribution);
const _SelectAndInsertKernelVariableAction = class _SelectAndInsertKernelVariableAction extends Action2 {
  constructor() {
    super({
      id: _SelectAndInsertKernelVariableAction.ID,
      title: ""
      // not displayed
    });
  }
  async run(accessor, ...args) {
    const editorService = accessor.get(IEditorService);
    const notebookKernelService = accessor.get(INotebookKernelService);
    const quickInputService = accessor.get(IQuickInputService);
    const notebook = getNotebookEditorFromEditorPane(editorService.activeEditorPane)?.getViewModel()?.notebookDocument;
    if (!notebook) {
      return;
    }
    const context = args[0];
    if (!context || !("widget" in context) || !("range" in context)) {
      return;
    }
    const widget = context.widget;
    const range = context.range;
    const variable = context.variable;
    if (variable !== void 0) {
      this.addVariableReference(widget, variable, range, false);
      return;
    }
    const selectedKernel = notebookKernelService.getMatchingKernel(notebook).selected;
    const hasVariableProvider = selectedKernel?.hasVariableProvider;
    if (!hasVariableProvider) {
      return;
    }
    const variables = await selectedKernel.provideVariables(notebook.uri, void 0, "named", 0, CancellationToken.None);
    const quickPickItems = [];
    for await (const variable2 of variables) {
      quickPickItems.push({
        label: variable2.name,
        description: variable2.value,
        detail: variable2.type
      });
    }
    const pickedVariable = await quickInputService.pick(quickPickItems, { placeHolder: "Select a kernel variable" });
    if (!pickedVariable) {
      return;
    }
    this.addVariableReference(widget, pickedVariable.label, range, true);
  }
  addVariableReference(widget, variableName, range, updateText) {
    if (range) {
      const text = `#kernelVariable:${variableName}`;
      if (updateText) {
        const editor = widget.inputEditor;
        const success = editor.executeEdits("chatInsertFile", [{ range, text: text + " " }]);
        if (!success) {
          return;
        }
      }
      widget.getContrib(ChatDynamicVariableModel.ID)?.addReference({
        id: "vscode.notebook.variable",
        range: { startLineNumber: range.startLineNumber, startColumn: range.startColumn, endLineNumber: range.endLineNumber, endColumn: range.startColumn + text.length },
        data: variableName,
        fullName: variableName,
        icon: codiconsLibrary.variable
      });
    } else {
      widget.attachmentModel.addContext({
        id: "vscode.notebook.variable",
        name: variableName,
        value: variableName,
        icon: codiconsLibrary.variable
      });
    }
  }
};
_SelectAndInsertKernelVariableAction.ID = "notebook.chat.selectAndInsertKernelVariable";
let SelectAndInsertKernelVariableAction = _SelectAndInsertKernelVariableAction;
registerAction2(class CopyCellOutputAction extends Action2 {
  constructor() {
    super({
      id: "notebook.cellOutput.addToChat",
      title: localize("notebookActions.addOutputToChat", "Add Cell Output to Chat"),
      menu: {
        id: MenuId.NotebookOutputToolbar,
        when: ContextKeyExpr.and(NOTEBOOK_CELL_HAS_OUTPUTS, ContextKeyExpr.in(NOTEBOOK_CELL_OUTPUT_MIMETYPE.key, NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT.key)),
        order: 10
      },
      category: NOTEBOOK_ACTIONS_CATEGORY,
      icon: icons.copyIcon,
      precondition: ChatContextKeys.enabled
    });
  }
  getNoteboookEditor(editorService, outputContext) {
    if (outputContext && "notebookEditor" in outputContext) {
      return outputContext.notebookEditor;
    }
    return getNotebookEditorFromEditorPane(editorService.activeEditorPane);
  }
  async run(accessor, outputContext) {
    const notebookEditor = this.getNoteboookEditor(accessor.get(IEditorService), outputContext);
    if (!notebookEditor) {
      return;
    }
    let outputViewModel;
    if (outputContext && "outputId" in outputContext && typeof outputContext.outputId === "string") {
      outputViewModel = getOutputViewModelFromId(outputContext.outputId, notebookEditor);
    } else if (outputContext && "outputViewModel" in outputContext) {
      outputViewModel = outputContext.outputViewModel;
    }
    if (!outputViewModel) {
      const activeCell = notebookEditor.getActiveCell();
      if (!activeCell) {
        return;
      }
      if (activeCell.focusedOutputId !== void 0) {
        outputViewModel = activeCell.outputsViewModels.find((output) => {
          return output.model.outputId === activeCell.focusedOutputId;
        });
      } else {
        outputViewModel = activeCell.outputsViewModels.find((output) => output.pickedMimeType?.isTrusted);
      }
    }
    if (!outputViewModel) {
      return;
    }
    const mimeType = outputViewModel.pickedMimeType?.mimeType;
    const chatWidgetService = accessor.get(IChatWidgetService);
    let widget = chatWidgetService.lastFocusedWidget;
    if (!widget) {
      const widgets = chatWidgetService.getWidgetsByLocations(ChatAgentLocation.Panel);
      if (widgets.length === 0) {
        return;
      }
      widget = widgets[0];
    }
    if (mimeType && NOTEBOOK_CELL_OUTPUT_MIME_TYPE_LIST_FOR_CHAT_CONST.includes(mimeType)) {
      const cellFromViewModelHandle = outputViewModel.cellViewModel.handle;
      const cell = notebookEditor.getCellByHandle(cellFromViewModelHandle);
      if (!cell) {
        return;
      }
      const cellUri = cell.uri;
      const outputId = outputViewModel?.model.outputId;
      let outputIndex = 0;
      if (outputId !== void 0) {
        outputIndex = cell.outputsViewModels.findIndex((output) => {
          return output.model.outputId === outputId;
        });
      }
      let notebookUri = notebookEditor.textModel?.uri;
      if (!notebookUri) {
        const parsedCellUri = CellUri.parse(cellUri);
        notebookUri = parsedCellUri?.notebook;
        if (!notebookUri) {
          return;
        }
      }
      const outputCellUri = CellUri.generateCellOutputUriWithIndex(notebookUri, cellUri, outputIndex);
      const l = {
        value: outputCellUri,
        id: outputCellUri.toString(),
        name: outputCellUri.toString(),
        isFile: true
      };
      widget.attachmentModel.addContext(l);
    }
  }
});
registerAction2(SelectAndInsertKernelVariableAction);
registerWorkbenchContribution2(NotebookChatContribution.ID, NotebookChatContribution, WorkbenchPhase.BlockRestore);
export {
  SelectAndInsertKernelVariableAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL2NvbnRyb2xsZXIvY2hhdC9ub3RlYm9vay5jaGF0LmNvbnRyaWJ1dGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IGNvZGljb25zTGlicmFyeSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zTGlicmFyeS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElXb3JkQXRQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS93b3JkSGVscGVyLmpzJztcbmltcG9ydCB7IENvbXBsZXRpb25Db250ZXh0LCBDb21wbGV0aW9uSXRlbUtpbmQsIENvbXBsZXRpb25MaXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIE1lbnVJZCwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrSXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiwgcmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yLCBXb3JrYmVuY2hQaGFzZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDaGF0V2lkZ2V0LCBJQ2hhdFdpZGdldFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jaGF0L2Jyb3dzZXIvY2hhdC5qcyc7XG5pbXBvcnQgeyBDaGF0SW5wdXRQYXJ0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY2hhdC9icm93c2VyL2NoYXRJbnB1dFBhcnQuanMnO1xuaW1wb3J0IHsgQ2hhdER5bmFtaWNWYXJpYWJsZU1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vY2hhdC9icm93c2VyL2NvbnRyaWIvY2hhdER5bmFtaWNWYXJpYWJsZXMuanMnO1xuaW1wb3J0IHsgY29tcHV0ZUNvbXBsZXRpb25SYW5nZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9jaGF0L2Jyb3dzZXIvY29udHJpYi9jaGF0SW5wdXRDb21wbGV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ2hhdEFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NoYXQvY29tbW9uL2NoYXRBZ2VudHMuanMnO1xuaW1wb3J0IHsgQ2hhdEFnZW50TG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jaGF0L2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQ2hhdENvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vLi4vLi4vY2hhdC9jb21tb24vY2hhdENvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElCYXNlQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vY2hhdC9jb21tb24vY2hhdE1vZGVsLmpzJztcbmltcG9ydCB7IGNoYXRWYXJpYWJsZUxlYWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2NoYXQvY29tbW9uL2NoYXRQYXJzZXJUeXBlcy5qcyc7XG5pbXBvcnQgeyBOT1RFQk9PS19DRUxMX0hBU19PVVRQVVRTLCBOT1RFQk9PS19DRUxMX09VVFBVVF9NSU1FX1RZUEVfTElTVF9GT1JfQ0hBVCwgTk9URUJPT0tfQ0VMTF9PVVRQVVRfTUlNRVRZUEUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbm90ZWJvb2tDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tLZXJuZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rS2VybmVsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBnZXROb3RlYm9va0VkaXRvckZyb21FZGl0b3JQYW5lLCBJQ2VsbE91dHB1dFZpZXdNb2RlbCwgSU5vdGVib29rRWRpdG9yLCBJQ2VsbFZpZXdNb2RlbCB9IGZyb20gJy4uLy4uL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgKiBhcyBpY29ucyBmcm9tICcuLi8uLi9ub3RlYm9va0ljb25zLmpzJztcbmltcG9ydCB7IGdldE91dHB1dFZpZXdNb2RlbEZyb21JZCB9IGZyb20gJy4uL2NlbGxPdXRwdXRBY3Rpb25zLmpzJztcbmltcG9ydCB7IElOb3RlYm9va091dHB1dEFjdGlvbkNvbnRleHQsIE5PVEVCT09LX0FDVElPTlNfQ0FURUdPUlkgfSBmcm9tICcuLi9jb3JlQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDZWxsVXJpIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCAnLi9jZWxsQ2hhdEFjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ1RYX05PVEVCT09LX0NIQVRfSEFTX0FHRU5UIH0gZnJvbSAnLi9ub3RlYm9va0NoYXRDb250ZXh0LmpzJztcblxuY29uc3QgTm90ZWJvb2tLZXJuZWxWYXJpYWJsZUtleSA9ICdrZXJuZWxWYXJpYWJsZSc7XG5jb25zdCBOT1RFQk9PS19DRUxMX09VVFBVVF9NSU1FX1RZUEVfTElTVF9GT1JfQ0hBVF9DT05TVCA9IFsndGV4dC9wbGFpbicsICd0ZXh0L2h0bWwnLFxuXHQnYXBwbGljYXRpb24vdm5kLmNvZGUubm90ZWJvb2suZXJyb3InLFxuXHQnYXBwbGljYXRpb24vdm5kLmNvZGUubm90ZWJvb2suc3Rkb3V0Jyxcblx0J2FwcGxpY2F0aW9uL3gubm90ZWJvb2suc3Rkb3V0Jyxcblx0J2FwcGxpY2F0aW9uL3gubm90ZWJvb2suc3RyZWFtJyxcblx0J2FwcGxpY2F0aW9uL3ZuZC5jb2RlLm5vdGVib29rLnN0ZGVycicsXG5cdCdhcHBsaWNhdGlvbi94Lm5vdGVib29rLnN0ZGVycicsXG5cdCdpbWFnZS9wbmcnLFxuXHQnaW1hZ2UvanBlZycsXG5cdCdpbWFnZS9zdmcnLFxuXTtcblxuY2xhc3MgTm90ZWJvb2tDaGF0Q29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIubm90ZWJvb2tDaGF0Q29udHJpYnV0aW9uJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jdHhIYXNQcm92aWRlcjogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJQ2hhdEFnZW50U2VydmljZSBjaGF0QWdlbnRTZXJ2aWNlOiBJQ2hhdEFnZW50U2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASUNoYXRXaWRnZXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdFdpZGdldFNlcnZpY2U6IElDaGF0V2lkZ2V0U2VydmljZSxcblx0XHRASU5vdGVib29rS2VybmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGVib29rS2VybmVsU2VydmljZTogSU5vdGVib29rS2VybmVsU2VydmljZSxcblx0XHRASUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX2N0eEhhc1Byb3ZpZGVyID0gQ1RYX05PVEVCT09LX0NIQVRfSEFTX0FHRU5ULmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHRjb25zdCB1cGRhdGVOb3RlYm9va0FnZW50U3RhdHVzID0gKCkgPT4ge1xuXHRcdFx0Y29uc3QgaGFzTm90ZWJvb2tBZ2VudCA9IEJvb2xlYW4oY2hhdEFnZW50U2VydmljZS5nZXREZWZhdWx0QWdlbnQoQ2hhdEFnZW50TG9jYXRpb24uTm90ZWJvb2spKTtcblx0XHRcdHRoaXMuX2N0eEhhc1Byb3ZpZGVyLnNldChoYXNOb3RlYm9va0FnZW50KTtcblx0XHR9O1xuXG5cdFx0dXBkYXRlTm90ZWJvb2tBZ2VudFN0YXR1cygpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGNoYXRBZ2VudFNlcnZpY2Uub25EaWRDaGFuZ2VBZ2VudHModXBkYXRlTm90ZWJvb2tBZ2VudFN0YXR1cykpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb21wbGV0aW9uUHJvdmlkZXIucmVnaXN0ZXIoeyBzY2hlbWU6IENoYXRJbnB1dFBhcnQuSU5QVVRfU0NIRU1FLCBoYXNBY2Nlc3NUb0FsbE1vZGVsczogdHJ1ZSB9LCB7XG5cdFx0XHRfZGVidWdEaXNwbGF5TmFtZTogJ2NoYXRLZXJuZWxEeW5hbWljQ29tcGxldGlvbnMnLFxuXHRcdFx0dHJpZ2dlckNoYXJhY3RlcnM6IFtjaGF0VmFyaWFibGVMZWFkZXJdLFxuXHRcdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtczogYXN5bmMgKG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogUG9zaXRpb24sIF9jb250ZXh0OiBDb21wbGV0aW9uQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHdpZGdldCA9IHRoaXMuY2hhdFdpZGdldFNlcnZpY2UuZ2V0V2lkZ2V0QnlJbnB1dFVyaShtb2RlbC51cmkpO1xuXHRcdFx0XHRpZiAoIXdpZGdldCB8fCAhd2lkZ2V0LnN1cHBvcnRzRmlsZVJlZmVyZW5jZXMpIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICh3aWRnZXQubG9jYXRpb24gIT09IENoYXRBZ2VudExvY2F0aW9uLk5vdGVib29rKSB7XG5cdFx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCB2YXJpYWJsZU5hbWVEZWYgPSBuZXcgUmVnRXhwKGAke2NoYXRWYXJpYWJsZUxlYWRlcn1cXFxcdypgLCAnZycpO1xuXHRcdFx0XHRjb25zdCByYW5nZSA9IGNvbXB1dGVDb21wbGV0aW9uUmFuZ2VzKG1vZGVsLCBwb3NpdGlvbiwgdmFyaWFibGVOYW1lRGVmLCB0cnVlKTtcblx0XHRcdFx0aWYgKCFyYW5nZSkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgcmVzdWx0OiBDb21wbGV0aW9uTGlzdCA9IHsgc3VnZ2VzdGlvbnM6IFtdIH07XG5cblx0XHRcdFx0Y29uc3QgYWZ0ZXJSYW5nZSA9IG5ldyBSYW5nZShwb3NpdGlvbi5saW5lTnVtYmVyLCByYW5nZS5yZXBsYWNlLnN0YXJ0Q29sdW1uLCBwb3NpdGlvbi5saW5lTnVtYmVyLCByYW5nZS5yZXBsYWNlLnN0YXJ0Q29sdW1uICsgYCR7Y2hhdFZhcmlhYmxlTGVhZGVyfSR7Tm90ZWJvb2tLZXJuZWxWYXJpYWJsZUtleX06YC5sZW5ndGgpO1xuXHRcdFx0XHRyZXN1bHQuc3VnZ2VzdGlvbnMucHVzaCh7XG5cdFx0XHRcdFx0bGFiZWw6IGAke2NoYXRWYXJpYWJsZUxlYWRlcn0ke05vdGVib29rS2VybmVsVmFyaWFibGVLZXl9YCxcblx0XHRcdFx0XHRpbnNlcnRUZXh0OiBgJHtjaGF0VmFyaWFibGVMZWFkZXJ9JHtOb3RlYm9va0tlcm5lbFZhcmlhYmxlS2V5fTpgLFxuXHRcdFx0XHRcdGRldGFpbDogbG9jYWxpemUoJ3BpY2tLZXJuZWxWYXJpYWJsZUxhYmVsJywgXCJQaWNrIGEgdmFyaWFibGUgZnJvbSB0aGUga2VybmVsXCIpLFxuXHRcdFx0XHRcdHJhbmdlLFxuXHRcdFx0XHRcdGtpbmQ6IENvbXBsZXRpb25JdGVtS2luZC5UZXh0LFxuXHRcdFx0XHRcdGNvbW1hbmQ6IHsgaWQ6IFNlbGVjdEFuZEluc2VydEtlcm5lbFZhcmlhYmxlQWN0aW9uLklELCB0aXRsZTogU2VsZWN0QW5kSW5zZXJ0S2VybmVsVmFyaWFibGVBY3Rpb24uSUQsIGFyZ3VtZW50czogW3sgd2lkZ2V0LCByYW5nZTogYWZ0ZXJSYW5nZSB9XSB9LFxuXHRcdFx0XHRcdHNvcnRUZXh0OiAneidcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0YXdhaXQgdGhpcy5hZGRLZXJuZWxWYXJpYWJsZUNvbXBsZXRpb24od2lkZ2V0LCByZXN1bHQsIHJhbmdlLCB0b2tlbik7XG5cblx0XHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBvdXRwdXQgY29udGV4dFxuXHRcdE5PVEVCT09LX0NFTExfT1VUUFVUX01JTUVfVFlQRV9MSVNUX0ZPUl9DSEFULmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSkuc2V0KE5PVEVCT09LX0NFTExfT1VUUFVUX01JTUVfVFlQRV9MSVNUX0ZPUl9DSEFUX0NPTlNUKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgYWRkS2VybmVsVmFyaWFibGVDb21wbGV0aW9uKHdpZGdldDogSUNoYXRXaWRnZXQsIHJlc3VsdDogQ29tcGxldGlvbkxpc3QsIGluZm86IHsgaW5zZXJ0OiBSYW5nZTsgcmVwbGFjZTogUmFuZ2U7IHZhcldvcmQ6IElXb3JkQXRQb3NpdGlvbiB8IG51bGwgfSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSB7XG5cdFx0bGV0IHBhdHRlcm46IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRpZiAoaW5mby52YXJXb3JkPy53b3JkICYmIGluZm8udmFyV29yZC53b3JkLnN0YXJ0c1dpdGgoY2hhdFZhcmlhYmxlTGVhZGVyKSkge1xuXHRcdFx0cGF0dGVybiA9IGluZm8udmFyV29yZC53b3JkLnRvTG93ZXJDYXNlKCkuc2xpY2UoMSk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgbm90ZWJvb2sgPSBnZXROb3RlYm9va0VkaXRvckZyb21FZGl0b3JQYW5lKHRoaXMuZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lKT8uZ2V0Vmlld01vZGVsKCk/Lm5vdGVib29rRG9jdW1lbnQ7XG5cblx0XHRpZiAoIW5vdGVib29rKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2VsZWN0ZWRLZXJuZWwgPSB0aGlzLm5vdGVib29rS2VybmVsU2VydmljZS5nZXRNYXRjaGluZ0tlcm5lbChub3RlYm9vaykuc2VsZWN0ZWQ7XG5cdFx0Y29uc3QgaGFzVmFyaWFibGVQcm92aWRlciA9IHNlbGVjdGVkS2VybmVsPy5oYXNWYXJpYWJsZVByb3ZpZGVyO1xuXG5cdFx0aWYgKCFoYXNWYXJpYWJsZVByb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdmFyaWFibGVzID0gYXdhaXQgc2VsZWN0ZWRLZXJuZWwucHJvdmlkZVZhcmlhYmxlcyhub3RlYm9vay51cmksIHVuZGVmaW5lZCwgJ25hbWVkJywgMCwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0XHRmb3IgYXdhaXQgKGNvbnN0IHZhcmlhYmxlIG9mIHZhcmlhYmxlcykge1xuXHRcdFx0aWYgKHBhdHRlcm4gJiYgIXZhcmlhYmxlLm5hbWUudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhwYXR0ZXJuKSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0cmVzdWx0LnN1Z2dlc3Rpb25zLnB1c2goe1xuXHRcdFx0XHRsYWJlbDogeyBsYWJlbDogdmFyaWFibGUubmFtZSwgZGVzY3JpcHRpb246IHZhcmlhYmxlLnR5cGUgfSxcblx0XHRcdFx0aW5zZXJ0VGV4dDogYCR7Y2hhdFZhcmlhYmxlTGVhZGVyfSR7Tm90ZWJvb2tLZXJuZWxWYXJpYWJsZUtleX06JHt2YXJpYWJsZS5uYW1lfSBgLFxuXHRcdFx0XHRmaWx0ZXJUZXh0OiBgJHtjaGF0VmFyaWFibGVMZWFkZXJ9JHt2YXJpYWJsZS5uYW1lfWAsXG5cdFx0XHRcdHJhbmdlOiBpbmZvLFxuXHRcdFx0XHRraW5kOiBDb21wbGV0aW9uSXRlbUtpbmQuVmFyaWFibGUsXG5cdFx0XHRcdHNvcnRUZXh0OiAneicsXG5cdFx0XHRcdGNvbW1hbmQ6IHsgaWQ6IFNlbGVjdEFuZEluc2VydEtlcm5lbFZhcmlhYmxlQWN0aW9uLklELCB0aXRsZTogU2VsZWN0QW5kSW5zZXJ0S2VybmVsVmFyaWFibGVBY3Rpb24uSUQsIGFyZ3VtZW50czogW3sgd2lkZ2V0LCByYW5nZTogaW5mby5pbnNlcnQsIHZhcmlhYmxlOiB2YXJpYWJsZS5uYW1lIH1dIH0sXG5cdFx0XHRcdGRldGFpbDogdmFyaWFibGUudHlwZSxcblx0XHRcdFx0ZG9jdW1lbnRhdGlvbjogdmFyaWFibGUudmFsdWUsXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNlbGVjdEFuZEluc2VydEtlcm5lbFZhcmlhYmxlQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBTZWxlY3RBbmRJbnNlcnRLZXJuZWxWYXJpYWJsZUFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiAnJyAvLyBub3QgZGlzcGxheWVkXG5cdFx0fSk7XG5cdH1cblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnbm90ZWJvb2suY2hhdC5zZWxlY3RBbmRJbnNlcnRLZXJuZWxWYXJpYWJsZSc7XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IG5vdGVib29rS2VybmVsU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90ZWJvb2tLZXJuZWxTZXJ2aWNlKTtcblx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXG5cdFx0Y29uc3Qgbm90ZWJvb2sgPSBnZXROb3RlYm9va0VkaXRvckZyb21FZGl0b3JQYW5lKGVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZSk/LmdldFZpZXdNb2RlbCgpPy5ub3RlYm9va0RvY3VtZW50O1xuXG5cdFx0aWYgKCFub3RlYm9vaykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRleHQgPSBhcmdzWzBdO1xuXHRcdGlmICghY29udGV4dCB8fCAhKCd3aWRnZXQnIGluIGNvbnRleHQpIHx8ICEoJ3JhbmdlJyBpbiBjb250ZXh0KSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHdpZGdldCA9IDxJQ2hhdFdpZGdldD5jb250ZXh0LndpZGdldDtcblx0XHRjb25zdCByYW5nZSA9IDxSYW5nZSB8IHVuZGVmaW5lZD5jb250ZXh0LnJhbmdlO1xuXHRcdGNvbnN0IHZhcmlhYmxlID0gPHN0cmluZyB8IHVuZGVmaW5lZD5jb250ZXh0LnZhcmlhYmxlO1xuXG5cdFx0aWYgKHZhcmlhYmxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHRoaXMuYWRkVmFyaWFibGVSZWZlcmVuY2Uod2lkZ2V0LCB2YXJpYWJsZSwgcmFuZ2UsIGZhbHNlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzZWxlY3RlZEtlcm5lbCA9IG5vdGVib29rS2VybmVsU2VydmljZS5nZXRNYXRjaGluZ0tlcm5lbChub3RlYm9vaykuc2VsZWN0ZWQ7XG5cdFx0Y29uc3QgaGFzVmFyaWFibGVQcm92aWRlciA9IHNlbGVjdGVkS2VybmVsPy5oYXNWYXJpYWJsZVByb3ZpZGVyO1xuXG5cdFx0aWYgKCFoYXNWYXJpYWJsZVByb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdmFyaWFibGVzID0gYXdhaXQgc2VsZWN0ZWRLZXJuZWwucHJvdmlkZVZhcmlhYmxlcyhub3RlYm9vay51cmksIHVuZGVmaW5lZCwgJ25hbWVkJywgMCwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0XHRjb25zdCBxdWlja1BpY2tJdGVtczogSVF1aWNrUGlja0l0ZW1bXSA9IFtdO1xuXHRcdGZvciBhd2FpdCAoY29uc3QgdmFyaWFibGUgb2YgdmFyaWFibGVzKSB7XG5cdFx0XHRxdWlja1BpY2tJdGVtcy5wdXNoKHtcblx0XHRcdFx0bGFiZWw6IHZhcmlhYmxlLm5hbWUsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiB2YXJpYWJsZS52YWx1ZSxcblx0XHRcdFx0ZGV0YWlsOiB2YXJpYWJsZS50eXBlLFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGlja2VkVmFyaWFibGUgPSBhd2FpdCBxdWlja0lucHV0U2VydmljZS5waWNrKHF1aWNrUGlja0l0ZW1zLCB7IHBsYWNlSG9sZGVyOiAnU2VsZWN0IGEga2VybmVsIHZhcmlhYmxlJyB9KTtcblx0XHRpZiAoIXBpY2tlZFZhcmlhYmxlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5hZGRWYXJpYWJsZVJlZmVyZW5jZSh3aWRnZXQsIHBpY2tlZFZhcmlhYmxlLmxhYmVsLCByYW5nZSwgdHJ1ZSk7XG5cdH1cblxuXHRwcml2YXRlIGFkZFZhcmlhYmxlUmVmZXJlbmNlKHdpZGdldDogSUNoYXRXaWRnZXQsIHZhcmlhYmxlTmFtZTogc3RyaW5nLCByYW5nZT86IFJhbmdlLCB1cGRhdGVUZXh0PzogYm9vbGVhbikge1xuXHRcdGlmIChyYW5nZSkge1xuXHRcdFx0Y29uc3QgdGV4dCA9IGAja2VybmVsVmFyaWFibGU6JHt2YXJpYWJsZU5hbWV9YDtcblxuXHRcdFx0aWYgKHVwZGF0ZVRleHQpIHtcblx0XHRcdFx0Y29uc3QgZWRpdG9yID0gd2lkZ2V0LmlucHV0RWRpdG9yO1xuXHRcdFx0XHRjb25zdCBzdWNjZXNzID0gZWRpdG9yLmV4ZWN1dGVFZGl0cygnY2hhdEluc2VydEZpbGUnLCBbeyByYW5nZSwgdGV4dDogdGV4dCArICcgJyB9XSk7XG5cdFx0XHRcdGlmICghc3VjY2Vzcykge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR3aWRnZXQuZ2V0Q29udHJpYjxDaGF0RHluYW1pY1ZhcmlhYmxlTW9kZWw+KENoYXREeW5hbWljVmFyaWFibGVNb2RlbC5JRCk/LmFkZFJlZmVyZW5jZSh7XG5cdFx0XHRcdGlkOiAndnNjb2RlLm5vdGVib29rLnZhcmlhYmxlJyxcblx0XHRcdFx0cmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiByYW5nZS5zdGFydExpbmVOdW1iZXIsIHN0YXJ0Q29sdW1uOiByYW5nZS5zdGFydENvbHVtbiwgZW5kTGluZU51bWJlcjogcmFuZ2UuZW5kTGluZU51bWJlciwgZW5kQ29sdW1uOiByYW5nZS5zdGFydENvbHVtbiArIHRleHQubGVuZ3RoIH0sXG5cdFx0XHRcdGRhdGE6IHZhcmlhYmxlTmFtZSxcblx0XHRcdFx0ZnVsbE5hbWU6IHZhcmlhYmxlTmFtZSxcblx0XHRcdFx0aWNvbjogY29kaWNvbnNMaWJyYXJ5LnZhcmlhYmxlLFxuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHdpZGdldC5hdHRhY2htZW50TW9kZWwuYWRkQ29udGV4dCh7XG5cdFx0XHRcdGlkOiAndnNjb2RlLm5vdGVib29rLnZhcmlhYmxlJyxcblx0XHRcdFx0bmFtZTogdmFyaWFibGVOYW1lLFxuXHRcdFx0XHR2YWx1ZTogdmFyaWFibGVOYW1lLFxuXHRcdFx0XHRpY29uOiBjb2RpY29uc0xpYnJhcnkudmFyaWFibGUsXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cbn1cblxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgQ29weUNlbGxPdXRwdXRBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdub3RlYm9vay5jZWxsT3V0cHV0LmFkZFRvQ2hhdCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ25vdGVib29rQWN0aW9ucy5hZGRPdXRwdXRUb0NoYXQnLCBcIkFkZCBDZWxsIE91dHB1dCB0byBDaGF0XCIpLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLk5vdGVib29rT3V0cHV0VG9vbGJhcixcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKE5PVEVCT09LX0NFTExfSEFTX09VVFBVVFMsIENvbnRleHRLZXlFeHByLmluKE5PVEVCT09LX0NFTExfT1VUUFVUX01JTUVUWVBFLmtleSwgTk9URUJPT0tfQ0VMTF9PVVRQVVRfTUlNRV9UWVBFX0xJU1RfRk9SX0NIQVQua2V5KSksXG5cdFx0XHRcdG9yZGVyOiAxMFxuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiBOT1RFQk9PS19BQ1RJT05TX0NBVEVHT1JZLFxuXHRcdFx0aWNvbjogaWNvbnMuY29weUljb24sXG5cdFx0XHRwcmVjb25kaXRpb246IENoYXRDb250ZXh0S2V5cy5lbmFibGVkXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGdldE5vdGVib29va0VkaXRvcihlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSwgb3V0cHV0Q29udGV4dDogSU5vdGVib29rT3V0cHV0QWN0aW9uQ29udGV4dCB8IHsgb3V0cHV0Vmlld01vZGVsOiBJQ2VsbE91dHB1dFZpZXdNb2RlbCB9IHwgdW5kZWZpbmVkKTogSU5vdGVib29rRWRpdG9yIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAob3V0cHV0Q29udGV4dCAmJiAnbm90ZWJvb2tFZGl0b3InIGluIG91dHB1dENvbnRleHQpIHtcblx0XHRcdHJldHVybiBvdXRwdXRDb250ZXh0Lm5vdGVib29rRWRpdG9yO1xuXHRcdH1cblx0XHRyZXR1cm4gZ2V0Tm90ZWJvb2tFZGl0b3JGcm9tRWRpdG9yUGFuZShlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmUpO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBvdXRwdXRDb250ZXh0OiBJTm90ZWJvb2tPdXRwdXRBY3Rpb25Db250ZXh0IHwgeyBvdXRwdXRWaWV3TW9kZWw6IElDZWxsT3V0cHV0Vmlld01vZGVsIH0gfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBub3RlYm9va0VkaXRvciA9IHRoaXMuZ2V0Tm90ZWJvb29rRWRpdG9yKGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSksIG91dHB1dENvbnRleHQpO1xuXG5cdFx0aWYgKCFub3RlYm9va0VkaXRvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBvdXRwdXRWaWV3TW9kZWw6IElDZWxsT3V0cHV0Vmlld01vZGVsIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChvdXRwdXRDb250ZXh0ICYmICdvdXRwdXRJZCcgaW4gb3V0cHV0Q29udGV4dCAmJiB0eXBlb2Ygb3V0cHV0Q29udGV4dC5vdXRwdXRJZCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdG91dHB1dFZpZXdNb2RlbCA9IGdldE91dHB1dFZpZXdNb2RlbEZyb21JZChvdXRwdXRDb250ZXh0Lm91dHB1dElkLCBub3RlYm9va0VkaXRvcik7XG5cdFx0fSBlbHNlIGlmIChvdXRwdXRDb250ZXh0ICYmICdvdXRwdXRWaWV3TW9kZWwnIGluIG91dHB1dENvbnRleHQpIHtcblx0XHRcdG91dHB1dFZpZXdNb2RlbCA9IG91dHB1dENvbnRleHQub3V0cHV0Vmlld01vZGVsO1xuXHRcdH1cblxuXHRcdGlmICghb3V0cHV0Vmlld01vZGVsKSB7XG5cdFx0XHQvLyBub3QgYWJsZSB0byBmaW5kIHRoZSBvdXRwdXQgZnJvbSB0aGUgcHJvdmlkZWQgY29udGV4dCwgdXNlIHRoZSBhY3RpdmUgY2VsbFxuXHRcdFx0Y29uc3QgYWN0aXZlQ2VsbCA9IG5vdGVib29rRWRpdG9yLmdldEFjdGl2ZUNlbGwoKTtcblx0XHRcdGlmICghYWN0aXZlQ2VsbCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmIChhY3RpdmVDZWxsLmZvY3VzZWRPdXRwdXRJZCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdG91dHB1dFZpZXdNb2RlbCA9IGFjdGl2ZUNlbGwub3V0cHV0c1ZpZXdNb2RlbHMuZmluZChvdXRwdXQgPT4ge1xuXHRcdFx0XHRcdHJldHVybiBvdXRwdXQubW9kZWwub3V0cHV0SWQgPT09IGFjdGl2ZUNlbGwuZm9jdXNlZE91dHB1dElkO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG91dHB1dFZpZXdNb2RlbCA9IGFjdGl2ZUNlbGwub3V0cHV0c1ZpZXdNb2RlbHMuZmluZChvdXRwdXQgPT4gb3V0cHV0LnBpY2tlZE1pbWVUeXBlPy5pc1RydXN0ZWQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghb3V0cHV0Vmlld01vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWltZVR5cGUgPSBvdXRwdXRWaWV3TW9kZWwucGlja2VkTWltZVR5cGU/Lm1pbWVUeXBlO1xuXG5cdFx0Y29uc3QgY2hhdFdpZGdldFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRXaWRnZXRTZXJ2aWNlKTtcblx0XHRsZXQgd2lkZ2V0ID0gY2hhdFdpZGdldFNlcnZpY2UubGFzdEZvY3VzZWRXaWRnZXQ7XG5cdFx0aWYgKCF3aWRnZXQpIHtcblx0XHRcdGNvbnN0IHdpZGdldHMgPSBjaGF0V2lkZ2V0U2VydmljZS5nZXRXaWRnZXRzQnlMb2NhdGlvbnMoQ2hhdEFnZW50TG9jYXRpb24uUGFuZWwpO1xuXHRcdFx0aWYgKHdpZGdldHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHdpZGdldCA9IHdpZGdldHNbMF07XG5cdFx0fVxuXHRcdGlmIChtaW1lVHlwZSAmJiBOT1RFQk9PS19DRUxMX09VVFBVVF9NSU1FX1RZUEVfTElTVF9GT1JfQ0hBVF9DT05TVC5pbmNsdWRlcyhtaW1lVHlwZSkpIHtcblxuXHRcdFx0Ly8gZ2V0IHRoZSBjZWxsIGluZGV4XG5cdFx0XHRjb25zdCBjZWxsRnJvbVZpZXdNb2RlbEhhbmRsZSA9IG91dHB1dFZpZXdNb2RlbC5jZWxsVmlld01vZGVsLmhhbmRsZTtcblx0XHRcdGNvbnN0IGNlbGw6IElDZWxsVmlld01vZGVsIHwgdW5kZWZpbmVkID0gbm90ZWJvb2tFZGl0b3IuZ2V0Q2VsbEJ5SGFuZGxlKGNlbGxGcm9tVmlld01vZGVsSGFuZGxlKTtcblx0XHRcdGlmICghY2VsbCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHQvLyB1cmkgb2YgdGhlIGNlbGxcblx0XHRcdGNvbnN0IGNlbGxVcmkgPSBjZWxsLnVyaTtcblxuXHRcdFx0Ly8gZ2V0IHRoZSBvdXRwdXQgaW5kZXhcblx0XHRcdGNvbnN0IG91dHB1dElkID0gb3V0cHV0Vmlld01vZGVsPy5tb2RlbC5vdXRwdXRJZDtcblx0XHRcdGxldCBvdXRwdXRJbmRleDogbnVtYmVyID0gMDtcblx0XHRcdGlmIChvdXRwdXRJZCAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdC8vIGZpbmQgdGhlIG91dHB1dCBpbmRleFxuXG5cdFx0XHRcdG91dHB1dEluZGV4ID0gY2VsbC5vdXRwdXRzVmlld01vZGVscy5maW5kSW5kZXgob3V0cHV0ID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gb3V0cHV0Lm1vZGVsLm91dHB1dElkID09PSBvdXRwdXRJZDtcblx0XHRcdFx0fSk7XG5cblxuXHRcdFx0fVxuXHRcdFx0Ly8gZ2V0IFVSSSBvZiBub3RlYm9va1xuXHRcdFx0bGV0IG5vdGVib29rVXJpID0gbm90ZWJvb2tFZGl0b3IudGV4dE1vZGVsPy51cmk7XG5cdFx0XHRpZiAoIW5vdGVib29rVXJpKSB7XG5cdFx0XHRcdC8vIGlmIHRoZSBub3RlYm9vayBpcyBub3QgZm91bmQsIHRyeSB0byBwYXJzZSB0aGUgY2VsbCB1cmlcblx0XHRcdFx0Y29uc3QgcGFyc2VkQ2VsbFVyaSA9IENlbGxVcmkucGFyc2UoY2VsbFVyaSk7XG5cdFx0XHRcdG5vdGVib29rVXJpID0gcGFyc2VkQ2VsbFVyaT8ubm90ZWJvb2s7XG5cdFx0XHRcdGlmICghbm90ZWJvb2tVcmkpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdC8vIGNvbnN0cnVjdCB0aGUgVVJJIHVzaW5nIHRoZSBjZWxsIHVyaSBhbmQgb3V0cHV0IGluZGV4XG5cdFx0XHRjb25zdCBvdXRwdXRDZWxsVXJpID0gQ2VsbFVyaS5nZW5lcmF0ZUNlbGxPdXRwdXRVcmlXaXRoSW5kZXgobm90ZWJvb2tVcmksIGNlbGxVcmksIG91dHB1dEluZGV4KTtcblxuXG5cblx0XHRcdGNvbnN0IGw6IElCYXNlQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5ID0ge1xuXHRcdFx0XHR2YWx1ZTogb3V0cHV0Q2VsbFVyaSxcblx0XHRcdFx0aWQ6IG91dHB1dENlbGxVcmkudG9TdHJpbmcoKSxcblx0XHRcdFx0bmFtZTogb3V0cHV0Q2VsbFVyaS50b1N0cmluZygpLFxuXHRcdFx0XHRpc0ZpbGU6IHRydWUsXG5cdFx0XHR9O1xuXHRcdFx0d2lkZ2V0LmF0dGFjaG1lbnRNb2RlbC5hZGRDb250ZXh0KGwpO1xuXHRcdH1cblx0fVxuXG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKFNlbGVjdEFuZEluc2VydEtlcm5lbFZhcmlhYmxlQWN0aW9uKTtcbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihOb3RlYm9va0NoYXRDb250cmlidXRpb24uSUQsIE5vdGVib29rQ2hhdENvbnRyaWJ1dGlvbiwgV29ya2JlbmNoUGhhc2UuQmxvY2tSZXN0b3JlKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxrQkFBa0I7QUFFM0IsU0FBUyxhQUFhO0FBRXRCLFNBQTRCLDBCQUEwQztBQUV0RSxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFNBQVMsUUFBUSx1QkFBdUI7QUFDakQsU0FBUyxnQkFBNkIsMEJBQTBCO0FBRWhFLFNBQVMsMEJBQTBDO0FBQ25ELFNBQWlDLGdDQUFnQyxzQkFBc0I7QUFDdkYsU0FBUyxzQkFBc0I7QUFDL0IsU0FBc0IsMEJBQTBCO0FBQ2hELFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsdUJBQXVCO0FBRWhDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsMkJBQTJCLDhDQUE4QyxxQ0FBcUM7QUFDdkgsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyx1Q0FBOEY7QUFDdkcsWUFBWSxXQUFXO0FBQ3ZCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQXVDLGlDQUFpQztBQUN4RSxTQUFTLGVBQWU7QUFDeEIsT0FBTztBQUNQLFNBQVMsbUNBQW1DO0FBRTVDLE1BQU0sNEJBQTRCO0FBQ2xDLE1BQU0scURBQXFEO0FBQUEsRUFBQztBQUFBLEVBQWM7QUFBQSxFQUN6RTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQ0Q7QUFFQSxJQUFNLDJCQUFOLGNBQXVDLFdBQTZDO0FBQUEsRUFLbkYsWUFDcUIsbUJBQ0Qsa0JBQ2MsZUFDSSxtQkFDSSx1QkFDRSx5QkFDMUM7QUFD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
