import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { Schemas } from "../../../../../base/common/network.js";
import { isElectron } from "../../../../../base/common/platform.js";
import { basename, dirname } from "../../../../../base/common/resources.js";
import { compare } from "../../../../../base/common/strings.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { URI } from "../../../../../base/common/uri.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { AbstractGotoSymbolQuickAccessProvider } from "../../../../../editor/contrib/quickAccess/browser/gotoSymbolQuickAccess.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { IFileService } from "../../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { ActiveEditorContext, TextCompareEditorActiveContext } from "../../../../common/contextkeys.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../../common/editor.js";
import { DiffEditorInput } from "../../../../common/editor/diffEditorInput.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IExtensionService, isProposedApiEnabled } from "../../../../services/extensions/common/extensions.js";
import { IHostService } from "../../../../services/host/browser/host.js";
import { VIEW_ID as SEARCH_VIEW_ID } from "../../../../services/search/common/search.js";
import { UntitledTextEditorInput } from "../../../../services/untitled/common/untitledTextEditorInput.js";
import { IViewsService } from "../../../../services/views/common/viewsService.js";
import { FileEditorInput } from "../../../files/browser/editors/fileEditorInput.js";
import { TEXT_FILE_EDITOR_ID } from "../../../files/common/files.js";
import { NotebookEditorInput } from "../../../notebook/common/notebookEditorInput.js";
import { AnythingQuickAccessProvider } from "../../../search/browser/anythingQuickAccess.js";
import { isSearchTreeFileMatch, isSearchTreeMatch } from "../../../search/browser/searchTreeModel/searchTreeCommon.js";
import { SymbolsQuickAccessProvider } from "../../../search/browser/symbolsQuickAccess.js";
import { SearchContext } from "../../../search/common/constants.js";
import { IChatAgentService } from "../../common/chatAgents.js";
import { ChatContextKeyExprs, ChatContextKeys } from "../../common/chatContextKeys.js";
import { IChatEditingService } from "../../common/chatEditingService.js";
import { IDiagnosticVariableEntryFilterData } from "../../common/chatModel.js";
import { ChatRequestAgentPart } from "../../common/chatParserTypes.js";
import { IChatVariablesService } from "../../common/chatVariables.js";
import { ChatAgentLocation } from "../../common/constants.js";
import { ILanguageModelToolsService } from "../../common/languageModelToolsService.js";
import { IChatWidgetService, IQuickChatService, showChatView, showEditsView } from "../chat.js";
import { imageToHash, isImage } from "../chatPasteProviders.js";
import { isQuickChat } from "../chatWidget.js";
import { createFolderQuickPick, createMarkersQuickPick } from "../contrib/chatDynamicVariables.js";
import { convertBufferToScreenshotVariable, ScreenshotVariableId } from "../contrib/screenshot.js";
import { resizeImage } from "../imageUtils.js";
import { COMMAND_ID as USE_PROMPT_COMMAND_ID } from "../promptSyntax/contributions/usePromptCommand.js";
import { CHAT_CATEGORY } from "./chatActions.js";
import { ATTACH_PROMPT_ACTION_ID, AttachPromptAction } from "./chatAttachPromptAction/chatAttachPromptAction.js";
function registerChatContextActions() {
  registerAction2(AttachContextAction);
  registerAction2(AttachFileToChatAction);
  registerAction2(AttachFolderToChatAction);
  registerAction2(AttachSelectionToChatAction);
  registerAction2(AttachFileToEditingSessionAction);
  registerAction2(AttachFolderToEditingSessionAction);
  registerAction2(AttachSelectionToEditingSessionAction);
  registerAction2(AttachSearchResultAction);
}
function isIGotoSymbolQuickPickItem(obj) {
  return typeof obj === "object" && typeof obj.symbolName === "string" && !!obj.uri && !!obj.range;
}
function isISymbolQuickPickItem(obj) {
  return typeof obj === "object" && typeof obj.symbol === "object" && !!obj.symbol;
}
function isIFolderSearchResultQuickPickItem(obj) {
  return typeof obj === "object" && obj.kind === "folder-search-result";
}
function isIDiagnosticsQuickPickItemWithFilter(obj) {
  return typeof obj === "object" && obj.kind === "diagnostic-filter";
}
function isIQuickPickItemWithResource(obj) {
  return typeof obj === "object" && typeof obj.resource === "object" && URI.isUri(obj.resource);
}
function isIOpenEditorsQuickPickItem(obj) {
  return typeof obj === "object" && obj.id === "open-editors";
}
function isISearchResultsQuickPickItem(obj) {
  return typeof obj === "object" && obj.kind === "search-results";
}
function isScreenshotQuickPickItem(obj) {
  return typeof obj === "object" && obj.kind === "screenshot";
}
function isRelatedFileQuickPickItem(obj) {
  return typeof obj === "object" && obj.kind === "related-files";
}
function isPromptInstructionsQuickPickItem(obj) {
  if (!obj || typeof obj !== "object") {
    return false;
  }
  return "kind" in obj && obj.kind === "reusable-prompt";
}
const REUSABLE_PROMPT_PICK_ID = "reusable-prompt";
class AttachResourceAction extends Action2 {
  getResources(accessor, ...args) {
    const editorService = accessor.get(IEditorService);
    const contexts = Array.isArray(args[1]) ? args[1] : [args[0]];
    const files = [];
    for (const context of contexts) {
      let uri;
      if (URI.isUri(context)) {
        uri = context;
      } else if (isSearchTreeFileMatch(context)) {
        uri = context.resource;
      } else if (isSearchTreeMatch(context)) {
        uri = context.parent().resource;
      } else if (!context && editorService.activeTextEditorControl) {
        uri = EditorResourceAccessor.getCanonicalUri(editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
      }
      if (uri && [Schemas.file, Schemas.vscodeRemote, Schemas.untitled].includes(uri.scheme)) {
        files.push(uri);
      }
    }
    return files;
  }
}
const _AttachFileToChatAction = class _AttachFileToChatAction extends AttachResourceAction {
  constructor() {
    super({
      id: _AttachFileToChatAction.ID,
      title: localize2("workbench.action.chat.attachFile.label", "Add File to Chat"),
      category: CHAT_CATEGORY,
      f1: false,
      menu: [{
        id: MenuId.SearchContext,
        group: "z_chat",
        order: 1,
        when: ContextKeyExpr.and(ChatContextKeys.enabled, ContextKeyExpr.or(ActiveEditorContext.isEqualTo(TEXT_FILE_EDITOR_ID), TextCompareEditorActiveContext), SearchContext.SearchResultHeaderFocused.negate())
      }]
    });
  }
  async run(accessor, ...args) {
    const variablesService = accessor.get(IChatVariablesService);
    const files = this.getResources(accessor, ...args);
    if (files.length) {
      (await showChatView(accessor.get(IViewsService)))?.focusInput();
      for (const file of files) {
        variablesService.attachContext("file", file, ChatAgentLocation.Panel);
      }
    }
  }
};
_AttachFileToChatAction.ID = "workbench.action.chat.attachFile";
let AttachFileToChatAction = _AttachFileToChatAction;
const _AttachFolderToChatAction = class _AttachFolderToChatAction extends AttachResourceAction {
  constructor() {
    super({
      id: _AttachFolderToChatAction.ID,
      title: localize2("workbench.action.chat.attachFolder.label", "Add Folder to Chat"),
      category: CHAT_CATEGORY,
      f1: false
    });
  }
  async run(accessor, ...args) {
    const variablesService = accessor.get(IChatVariablesService);
    const folders = this.getResources(accessor, ...args);
    if (folders.length) {
      (await showChatView(accessor.get(IViewsService)))?.focusInput();
      for (const folder of folders) {
        variablesService.attachContext("folder", folder, ChatAgentLocation.Panel);
      }
    }
  }
};
_AttachFolderToChatAction.ID = "workbench.action.chat.attachFolder";
let AttachFolderToChatAction = _AttachFolderToChatAction;
const _AttachSelectionToChatAction = class _AttachSelectionToChatAction extends Action2 {
  constructor() {
    super({
      id: _AttachSelectionToChatAction.ID,
      title: localize2("workbench.action.chat.attachSelection.label", "Add Selection to Chat"),
      category: CHAT_CATEGORY,
      f1: false
    });
  }
  async run(accessor, ...args) {
    const variablesService = accessor.get(IChatVariablesService);
    const editorService = accessor.get(IEditorService);
    const [_, matches] = args;
    if (matches && matches.length > 0) {
      const uris = /* @__PURE__ */ new Map();
      for (const match of matches) {
        if (isSearchTreeFileMatch(match)) {
          uris.set(match.resource, void 0);
        } else {
          const context = { uri: match._parent.resource, range: match._range };
          const range = uris.get(context.uri);
          if (!range || range.startLineNumber !== context.range.startLineNumber && range.endLineNumber !== context.range.endLineNumber) {
            uris.set(context.uri, context.range);
            variablesService.attachContext("file", context, ChatAgentLocation.Panel);
          }
        }
      }
      for (const uri of uris) {
        const [resource, range] = uri;
        if (!range) {
          variablesService.attachContext("file", { uri: resource }, ChatAgentLocation.Panel);
        }
      }
    } else {
      const activeEditor = editorService.activeTextEditorControl;
      const activeUri = EditorResourceAccessor.getCanonicalUri(editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
      if (editorService.activeTextEditorControl && activeUri && [Schemas.file, Schemas.vscodeRemote, Schemas.untitled].includes(activeUri.scheme)) {
        const selection = activeEditor?.getSelection();
        if (selection) {
          (await showChatView(accessor.get(IViewsService)))?.focusInput();
          const range = selection.isEmpty() ? new Range(selection.startLineNumber, 1, selection.startLineNumber + 1, 1) : selection;
          variablesService.attachContext("file", { uri: activeUri, range }, ChatAgentLocation.Panel);
        }
      }
    }
  }
};
_AttachSelectionToChatAction.ID = "workbench.action.chat.attachSelection";
let AttachSelectionToChatAction = _AttachSelectionToChatAction;
const _AttachFileToEditingSessionAction = class _AttachFileToEditingSessionAction extends AttachResourceAction {
  constructor() {
    super({
      id: _AttachFileToEditingSessionAction.ID,
      title: localize2("workbench.action.edits.attachFile.label", "Add File to {0}", "Copilot Edits"),
      category: CHAT_CATEGORY,
      f1: false,
      menu: [{
        id: MenuId.SearchContext,
        group: "z_chat",
        order: 2,
        when: ContextKeyExpr.and(
          ChatContextKeys.enabled,
          ContextKeyExpr.or(ActiveEditorContext.isEqualTo(TEXT_FILE_EDITOR_ID), TextCompareEditorActiveContext),
          ChatContextKeyExprs.unifiedChatEnabled.negate(),
          SearchContext.SearchResultHeaderFocused.negate()
        )
      }]
    });
  }
  async run(accessor, ...args) {
    const variablesService = accessor.get(IChatVariablesService);
    const files = this.getResources(accessor, ...args);
    if (files.length) {
      (await showEditsView(accessor.get(IViewsService)))?.focusInput();
      for (const file of files) {
        variablesService.attachContext("file", file, ChatAgentLocation.EditingSession);
      }
    }
  }
};
_AttachFileToEditingSessionAction.ID = "workbench.action.edits.attachFile";
let AttachFileToEditingSessionAction = _AttachFileToEditingSessionAction;
const _AttachSearchResultAction = class _AttachSearchResultAction extends Action2 {
  constructor() {
    super({
      id: _AttachSearchResultAction.ID,
      title: localize2("chat.insertSearchResults", "Add Search Results to Chat"),
      category: CHAT_CATEGORY,
      f1: false,
      menu: [{
        id: MenuId.SearchContext,
        group: "z_chat",
        order: 3,
        when: ContextKeyExpr.and(
          ChatContextKeys.enabled,
          SearchContext.SearchResultHeaderFocused
        )
      }]
    });
  }
  async run(accessor, ...args) {
    const logService = accessor.get(ILogService);
    const widget = await showChatView(accessor.get(IViewsService));
    if (!widget) {
      logService.trace("InsertSearchResultAction: no chat view available");
      return;
    }
    const editor = widget.inputEditor;
    const originalRange = editor.getSelection() ?? editor.getModel()?.getFullModelRange().collapseToEnd();
    if (!originalRange) {
      logService.trace("InsertSearchResultAction: no selection");
      return;
    }
    let insertText = `#${_AttachSearchResultAction.Name}`;
    const varRange = new Range(originalRange.startLineNumber, originalRange.startColumn, originalRange.endLineNumber, originalRange.startColumn + insertText.length);
    const model = editor.getModel();
    if (model && model.getValueInRange(new Range(originalRange.startLineNumber, originalRange.startColumn - 1, originalRange.startLineNumber, originalRange.startColumn)) !== " ") {
      insertText = " " + insertText;
    }
    const success = editor.executeEdits("chatInsertSearch", [{ range: varRange, text: insertText + " " }]);
    if (!success) {
      logService.trace(`InsertSearchResultAction: failed to insert "${insertText}"`);
      return;
    }
  }
};
_AttachSearchResultAction.Name = "searchResults";
_AttachSearchResultAction.ID = "workbench.action.chat.insertSearchResults";
let AttachSearchResultAction = _AttachSearchResultAction;
const _AttachFolderToEditingSessionAction = class _AttachFolderToEditingSessionAction extends AttachResourceAction {
  constructor() {
    super({
      id: _AttachFolderToEditingSessionAction.ID,
      title: localize2("workbench.action.edits.attachFolder.label", "Add Folder to {0}", "Copilot Edits"),
      category: CHAT_CATEGORY,
      f1: false,
      precondition: ContextKeyExpr.and(
        ChatContextKeys.enabled,
        ChatContextKeyExprs.unifiedChatEnabled.negate()
      )
    });
  }
  async run(accessor, ...args) {
    const variablesService = accessor.get(IChatVariablesService);
    const folders = this.getResources(accessor, ...args);
    if (folders.length) {
      (await showEditsView(accessor.get(IViewsService)))?.focusInput();
      for (const folder of folders) {
        variablesService.attachContext("folder", folder, ChatAgentLocation.EditingSession);
      }
    }
  }
};
_AttachFolderToEditingSessionAction.ID = "workbench.action.edits.attachFolder";
let AttachFolderToEditingSessionAction = _AttachFolderToEditingSessionAction;
const _AttachSelectionToEditingSessionAction = class _AttachSelectionToEditingSessionAction extends Action2 {
  constructor() {
    super({
      id: _AttachSelectionToEditingSessionAction.ID,
      title: localize2("workbench.action.edits.attachSelection.label", "Add Selection to {0}", "Copilot Edits"),
      category: CHAT_CATEGORY,
      f1: false,
      precondition: ContextKeyExpr.and(
        ChatContextKeys.enabled,
        ContextKeyExpr.or(ActiveEditorContext.isEqualTo(TEXT_FILE_EDITOR_ID), TextCompareEditorActiveContext),
        ChatContextKeyExprs.unifiedChatEnabled.negate()
      )
    });
  }
  async run(accessor, ...args) {
    const variablesService = accessor.get(IChatVariablesService);
    const editorService = accessor.get(IEditorService);
    const activeEditor = editorService.activeTextEditorControl;
    const activeUri = EditorResourceAccessor.getCanonicalUri(editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    if (editorService.activeTextEditorControl && activeUri && [Schemas.file, Schemas.vscodeRemote, Schemas.untitled].includes(activeUri.scheme)) {
      const selection = activeEditor?.getSelection();
      if (selection) {
        (await showEditsView(accessor.get(IViewsService)))?.focusInput();
        const range = selection.isEmpty() ? new Range(selection.startLineNumber, 1, selection.startLineNumber + 1, 1) : selection;
        variablesService.attachContext("file", { uri: activeUri, range }, ChatAgentLocation.EditingSession);
      }
    }
  }
};
_AttachSelectionToEditingSessionAction.ID = "workbench.action.edits.attachSelection";
let AttachSelectionToEditingSessionAction = _AttachSelectionToEditingSessionAction;
const _AttachContextAction = class _AttachContextAction extends Action2 {
  constructor(desc = {
    id: _AttachContextAction.ID,
    title: localize2("workbench.action.chat.attachContext.label.2", "Add Context"),
    icon: Codicon.attach,
    category: CHAT_CATEGORY,
    keybinding: {
      when: ContextKeyExpr.and(
        ChatContextKeys.location.notEqualsTo(ChatAgentLocation.EditingSession),
        ChatContextKeys.inChatInput,
        ChatContextKeyExprs.inNonUnifiedPanel
      ),
      primary: KeyMod.CtrlCmd | KeyCode.Slash,
      weight: KeybindingWeight.EditorContrib
    },
    menu: [
      {
        when: ChatContextKeyExprs.inNonUnifiedPanel,
        id: MenuId.ChatInputAttachmentToolbar,
        group: "navigation",
        order: 2
      }
    ]
  }) {
    super(desc);
  }
  _getFileContextId(item) {
    if ("resource" in item) {
      return item.resource.toString();
    }
    return item.uri.toString() + (item.range.startLineNumber !== item.range.endLineNumber ? `:${item.range.startLineNumber}-${item.range.endLineNumber}` : `:${item.range.startLineNumber}`);
  }
  async _attachContext(widget, quickInputService, commandService, clipboardService, editorService, labelService, viewsService, chatEditingService, hostService, fileService, textModelService, isInBackground, ...picks) {
    const toAttach = [];
    for (const pick of picks) {
      if (isISymbolQuickPickItem(pick) && pick.symbol) {
        toAttach.push({
          kind: "symbol",
          id: this._getFileContextId(pick.symbol.location),
          value: pick.symbol.location,
          symbolKind: pick.symbol.kind,
          fullName: pick.label,
          name: pick.symbol.name
        });
      } else if (isIFolderSearchResultQuickPickItem(pick)) {
        const folder = pick.resource;
        toAttach.push({
          id: pick.id,
          value: folder,
          name: basename(folder),
          isFile: false,
          isDirectory: true
        });
      } else if (isIDiagnosticsQuickPickItemWithFilter(pick)) {
        toAttach.push({
          id: pick.id,
          name: pick.label,
          value: pick.filter,
          kind: "diagnostic",
          icon: pick.icon,
          ...pick.filter
        });
      } else if (isIQuickPickItemWithResource(pick) && pick.resource) {
        if (/\.(png|jpg|jpeg|bmp|gif|tiff)$/i.test(pick.resource.path)) {
          if (URI.isUri(pick.resource)) {
            const readFile = await fileService.readFile(pick.resource);
            const resizedImage = await resizeImage(readFile.value.buffer);
            toAttach.push({
              id: pick.resource.toString(),
              name: pick.label,
              fullName: pick.label,
              value: resizedImage,
              isImage: true
            });
          }
        } else {
          let isOmitted = false;
          try {
            const createdModel = await textModelService.createModelReference(pick.resource);
            createdModel.dispose();
          } catch {
            isOmitted = true;
          }
          toAttach.push({
            id: this._getFileContextId({ resource: pick.resource }),
            value: pick.resource,
            name: pick.label,
            isFile: true,
            isOmitted
          });
        }
      } else if (isIGotoSymbolQuickPickItem(pick) && pick.uri && pick.range) {
        toAttach.push({
          range: void 0,
          id: this._getFileContextId({ uri: pick.uri, range: pick.range.decoration }),
          value: { uri: pick.uri, range: pick.range.decoration },
          fullName: pick.label,
          name: pick.symbolName
        });
      } else if (isIOpenEditorsQuickPickItem(pick)) {
        for (const editor of editorService.editors.filter((e) => e instanceof FileEditorInput || e instanceof DiffEditorInput || e instanceof UntitledTextEditorInput || e instanceof NotebookEditorInput)) {
          const uri = editor instanceof DiffEditorInput ? editor.modified.resource : editor.resource;
          if (uri) {
            toAttach.push({
              id: this._getFileContextId({ resource: uri }),
              value: uri,
              name: labelService.getUriBasenameLabel(uri),
              isFile: true
            });
          }
        }
      } else if (isISearchResultsQuickPickItem(pick)) {
        const searchView = viewsService.getViewWithId(SEARCH_VIEW_ID);
        for (const result of searchView.model.searchResult.matches()) {
          toAttach.push({
            id: this._getFileContextId({ resource: result.resource }),
            value: result.resource,
            name: labelService.getUriBasenameLabel(result.resource),
            isFile: true
          });
        }
      } else if (isRelatedFileQuickPickItem(pick)) {
        const chatSessionId = widget.viewModel?.sessionId;
        if (!chatSessionId || !chatEditingService) {
          continue;
        }
        const relatedFiles = await chatEditingService.getRelatedFiles(chatSessionId, widget.getInput(), widget.attachmentModel.fileAttachments, CancellationToken.None);
        if (!relatedFiles) {
          continue;
        }
        const attachments = widget.attachmentModel.getAttachmentIDs();
        const itemsPromise = chatEditingService.getRelatedFiles(chatSessionId, widget.getInput(), widget.attachmentModel.fileAttachments, CancellationToken.None).then((files) => (files ?? []).reduce((acc, cur) => {
          acc.push({ type: "separator", label: cur.group });
          for (const file of cur.files) {
            acc.push({
              type: "item",
              label: labelService.getUriBasenameLabel(file.uri),
              description: labelService.getUriLabel(dirname(file.uri), { relative: true }),
              value: file.uri,
              disabled: attachments.has(this._getFileContextId({ resource: file.uri })),
              picked: true
            });
          }
          return acc;
        }, []));
        const selectedFiles = await quickInputService.pick(itemsPromise, { placeHolder: localize("relatedFiles", "Add related files to your working set"), canPickMany: true });
        for (const file of selectedFiles ?? []) {
          toAttach.push({
            id: this._getFileContextId({ resource: file.value }),
            value: file.value,
            name: file.label,
            isFile: true,
            isOmitted: false
          });
        }
      } else if (isScreenshotQuickPickItem(pick)) {
        const blob = await hostService.getScreenshot();
        if (blob) {
          toAttach.push(convertBufferToScreenshotVariable(blob));
        }
      } else if (isPromptInstructionsQuickPickItem(pick)) {
        const options = { widget };
        await commandService.executeCommand(ATTACH_PROMPT_ACTION_ID, options);
      } else {
        const attachmentPick = pick;
        if (attachmentPick.kind === "command") {
          const selection = await commandService.executeCommand(attachmentPick.command.id, ...attachmentPick.command.arguments ?? []);
          if (!selection) {
            continue;
          }
          toAttach.push({
            ...attachmentPick,
            value: attachmentPick.value,
            name: `${typeof attachmentPick.value === "string" && attachmentPick.value.startsWith("#") ? attachmentPick.value.slice(1) : ""}${selection}`,
            // Apply the original icon with the new name
            fullName: selection
          });
        } else if (attachmentPick.kind === "tool") {
          toAttach.push({
            id: attachmentPick.id,
            name: attachmentPick.label,
            fullName: attachmentPick.label,
            value: void 0,
            icon: attachmentPick.icon,
            isTool: true
          });
        } else if (attachmentPick.kind === "image") {
          const fileBuffer = await clipboardService.readImage();
          toAttach.push({
            id: await imageToHash(fileBuffer),
            name: localize("pastedImage", "Pasted Image"),
            fullName: localize("pastedImage", "Pasted Image"),
            value: fileBuffer,
            isImage: true
          });
        }
      }
    }
    widget.attachmentModel.addContext(...toAttach);
    if (!isInBackground) {
      widget.focusInput();
    }
  }
  async run(accessor, ...args) {
    const quickInputService = accessor.get(IQuickInputService);
    const chatAgentService = accessor.get(IChatAgentService);
    const commandService = accessor.get(ICommandService);
    const widgetService = accessor.get(IChatWidgetService);
    const languageModelToolsService = accessor.get(ILanguageModelToolsService);
    const quickChatService = accessor.get(IQuickChatService);
    const clipboardService = accessor.get(IClipboardService);
    const editorService = accessor.get(IEditorService);
    const labelService = accessor.get(ILabelService);
    const contextKeyService = accessor.get(IContextKeyService);
    const viewsService = accessor.get(IViewsService);
    const hostService = accessor.get(IHostService);
    const extensionService = accessor.get(IExtensionService);
    const fileService = accessor.get(IFileService);
    const textModelService = accessor.get(ITextModelService);
    const instantiationService = accessor.get(IInstantiationService);
    const keybindingService = accessor.get(IKeybindingService);
    const context = args[0];
    const widget = context?.widget ?? widgetService.lastFocusedWidget;
    if (!widget) {
      return;
    }
    const chatEditingService = widget.location === ChatAgentLocation.EditingSession || widget.isUnifiedPanelWidget ? accessor.get(IChatEditingService) : void 0;
    const quickPickItems = [];
    if (extensionService.extensions.some((ext) => isProposedApiEnabled(ext, "chatReferenceBinaryData"))) {
      const imageData = await clipboardService.readImage();
      if (isImage(imageData)) {
        quickPickItems.push({
          kind: "image",
          id: await imageToHash(imageData),
          label: localize("imageFromClipboard", "Image from Clipboard"),
          iconClass: ThemeIcon.asClassName(Codicon.fileMedia)
        });
      }
      quickPickItems.push({
        kind: "screenshot",
        id: ScreenshotVariableId,
        icon: ThemeIcon.fromId(Codicon.deviceCamera.id),
        iconClass: ThemeIcon.asClassName(Codicon.deviceCamera),
        label: isElectron ? localize("chatContext.attachScreenshot.labelElectron.Window", "Screenshot Window") : localize("chatContext.attachScreenshot.labelWeb", "Screenshot")
      });
    }
    if (widget.viewModel?.sessionId) {
      const agentPart = widget.parsedInput.parts.find((part) => part instanceof ChatRequestAgentPart);
      if (agentPart) {
        const completions = await chatAgentService.getAgentCompletionItems(agentPart.agent.id, "", CancellationToken.None);
        for (const variable of completions) {
          if (variable.fullName && variable.command) {
            quickPickItems.push({
              kind: "command",
              label: variable.fullName,
              id: variable.id,
              command: variable.command,
              icon: variable.icon,
              iconClass: variable.icon ? ThemeIcon.asClassName(variable.icon) : void 0,
              value: variable.value,
              name: variable.name
            });
          } else {
          }
        }
      }
    }
    for (const tool of languageModelToolsService.getTools()) {
      if (tool.canBeReferencedInPrompt) {
        const item = {
          kind: "tool",
          label: tool.displayName ?? "",
          id: tool.id,
          icon: ThemeIcon.isThemeIcon(tool.icon) ? tool.icon : void 0
          // TODO need to support icon path?
        };
        if (ThemeIcon.isThemeIcon(tool.icon)) {
          item.iconClass = ThemeIcon.asClassName(tool.icon);
        } else if (tool.icon) {
          item.iconPath = tool.icon;
        }
        quickPickItems.push(item);
      }
    }
    quickPickItems.push({
      kind: "quickaccess",
      label: localize("chatContext.symbol", "Symbol..."),
      iconClass: ThemeIcon.asClassName(Codicon.symbolField),
      prefix: SymbolsQuickAccessProvider.PREFIX,
      id: "symbol"
    });
    quickPickItems.push({
      kind: "folder",
      label: localize("chatContext.folder", "Folder..."),
      iconClass: ThemeIcon.asClassName(Codicon.folder),
      id: "folder"
    });
    quickPickItems.push({
      kind: "diagnostic",
      label: localize("chatContext.diagnstic", "Problem..."),
      iconClass: ThemeIcon.asClassName(Codicon.error),
      id: "diagnostic"
    });
    if (widget.location === ChatAgentLocation.Notebook) {
      quickPickItems.push({
        kind: "command",
        id: "chatContext.notebook.kernelVariable",
        icon: ThemeIcon.fromId(Codicon.serverEnvironment.id),
        iconClass: ThemeIcon.asClassName(Codicon.serverEnvironment),
        value: "kernelVariable",
        label: localize("chatContext.notebook.kernelVariable", "Kernel Variable..."),
        command: {
          id: "notebook.chat.selectAndInsertKernelVariable",
          title: localize("chatContext.notebook.selectkernelVariable", "Select and Insert Kernel Variable"),
          arguments: [{ widget, range: void 0 }]
        }
      });
    }
    if (context?.showFilesOnly) {
      if (chatEditingService?.hasRelatedFilesProviders() && (widget.getInput() || widget.attachmentModel.fileAttachments.length > 0)) {
        quickPickItems.unshift({
          kind: "related-files",
          id: "related-files",
          label: localize("chatContext.relatedFiles", "Related Files"),
          iconClass: ThemeIcon.asClassName(Codicon.sparkle)
        });
      }
      if (editorService.editors.filter((e) => e instanceof FileEditorInput || e instanceof DiffEditorInput || e instanceof UntitledTextEditorInput).length > 0) {
        quickPickItems.unshift({
          kind: "open-editors",
          id: "open-editors",
          label: localize("chatContext.editors", "Open Editors"),
          iconClass: ThemeIcon.asClassName(Codicon.files)
        });
      }
      if (SearchContext.HasSearchResults.getValue(contextKeyService)) {
        quickPickItems.unshift({
          kind: "search-results",
          id: "search-results",
          label: localize("chatContext.searchResults", "Search Results"),
          iconClass: ThemeIcon.asClassName(Codicon.search)
        });
      }
    }
    if (widget.attachmentModel.promptInstructions.featureEnabled) {
      const keybinding = keybindingService.lookupKeybinding(USE_PROMPT_COMMAND_ID, contextKeyService);
      quickPickItems.push({
        id: REUSABLE_PROMPT_PICK_ID,
        kind: REUSABLE_PROMPT_PICK_ID,
        label: localize("chatContext.attach.prompt.label", "Prompt..."),
        iconClass: ThemeIcon.asClassName(Codicon.bookmark),
        keybinding
      });
    }
    function extractTextFromIconLabel(label) {
      if (!label) {
        return "";
      }
      const match = label.match(/\$\([^\)]+\)\s*(.+)/);
      return match ? match[1] : label;
    }
    this._show(quickInputService, commandService, widget, quickChatService, quickPickItems.sort(function(a, b) {
      if (a.kind === "open-editors") {
        return -1;
      }
      if (b.kind === "open-editors") {
        return 1;
      }
      const first = extractTextFromIconLabel(a.label).toUpperCase();
      const second = extractTextFromIconLabel(b.label).toUpperCase();
      return compare(first, second);
    }), clipboardService, editorService, labelService, viewsService, chatEditingService, hostService, fileService, textModelService, instantiationService, "", context?.placeholder);
  }
  async _showDiagnosticsPick(instantiationService, onBackgroundAccept) {
    const convert = (item) => ({
      kind: "diagnostic-filter",
      id: IDiagnosticVariableEntryFilterData.id(item),
      label: IDiagnosticVariableEntryFilterData.label(item),
      icon: IDiagnosticVariableEntryFilterData.icon,
      filter: item
    });
    const filter = await instantiationService.invokeFunction((accessor) => createMarkersQuickPick(accessor, "problem", (items) => onBackgroundAccept(items.map(convert))));
    return filter && convert(filter);
  }
  _show(quickInputService, commandService, widget, quickChatService, quickPickItems, clipboardService, editorService, labelService, viewsService, chatEditingService, hostService, fileService, textModelService, instantiationService, query = "", placeholder) {
    const attach = (isBackgroundAccept, ...items) => {
      this._attachContext(widget, quickInputService, commandService, clipboardService, editorService, labelService, viewsService, chatEditingService, hostService, fileService, textModelService, isBackgroundAccept, ...items);
    };
    const providerOptions = {
      handleAccept: async (inputItem, isBackgroundAccept) => {
        let item = inputItem;
        if ("kind" in item && item.kind === "folder") {
          item = await this._showFolders(instantiationService);
        } else if ("kind" in item && item.kind === "diagnostic") {
          item = await this._showDiagnosticsPick(instantiationService, (i) => attach(true, ...i));
        }
        if (!item) {
          this._show(quickInputService, commandService, widget, quickChatService, quickPickItems, clipboardService, editorService, labelService, viewsService, chatEditingService, hostService, fileService, textModelService, instantiationService, "", placeholder);
          return;
        }
        if ("prefix" in item) {
          this._show(quickInputService, commandService, widget, quickChatService, quickPickItems, clipboardService, editorService, labelService, viewsService, chatEditingService, hostService, fileService, textModelService, instantiationService, item.prefix, placeholder);
        } else {
          if (!clipboardService) {
            return;
          }
          attach(isBackgroundAccept, item);
          if (isQuickChat(widget)) {
            quickChatService.open();
          }
        }
      },
      additionPicks: quickPickItems,
      filter: (item) => {
        const attachedContext = widget.attachmentModel.getAttachmentIDs();
        if (isIOpenEditorsQuickPickItem(item)) {
          for (const editor of editorService.editors.filter((e) => e instanceof FileEditorInput || e instanceof DiffEditorInput || e instanceof UntitledTextEditorInput)) {
            if (editor.resource && !attachedContext.has(this._getFileContextId({ resource: editor.resource }))) {
              return true;
            }
          }
          return false;
        }
        if ("kind" in item && item.kind === "image") {
          return !attachedContext.has(item.id);
        }
        if ("symbol" in item && item.symbol) {
          return !attachedContext.has(this._getFileContextId(item.symbol.location));
        }
        if (item && typeof item === "object" && "resource" in item && URI.isUri(item.resource)) {
          return [Schemas.file, Schemas.vscodeRemote, Schemas.untitled].includes(item.resource.scheme) && !attachedContext.has(this._getFileContextId({ resource: item.resource }));
        }
        if (item && typeof item === "object" && "uri" in item && item.uri && item.range) {
          return !attachedContext.has(this._getFileContextId({ uri: item.uri, range: item.range.decoration }));
        }
        if (!("command" in item) && item.id) {
          return !attachedContext.has(item.id);
        }
        return true;
      }
    };
    quickInputService.quickAccess.show(query, {
      enabledProviderPrefixes: [
        AnythingQuickAccessProvider.PREFIX,
        SymbolsQuickAccessProvider.PREFIX,
        AbstractGotoSymbolQuickAccessProvider.PREFIX
      ],
      placeholder: placeholder ?? localize("chatContext.attach.placeholder", "Search attachments"),
      providerOptions
    });
  }
  async _showFolders(instantiationService) {
    const folder = await instantiationService.invokeFunction((accessor) => createFolderQuickPick(accessor));
    if (!folder) {
      return void 0;
    }
    return {
      kind: "folder-search-result",
      id: folder.toString(),
      label: basename(folder),
      resource: folder
    };
  }
};
_AttachContextAction.ID = "workbench.action.chat.attachContext";
let AttachContextAction = _AttachContextAction;
registerAction2(class AttachFilesAction extends AttachContextAction {
  constructor() {
    super({
      id: "workbench.action.chat.editing.attachContext",
      title: localize2("workbench.action.chat.editing.attachContext.label", "Add Context to Copilot Edits"),
      shortTitle: localize2("workbench.action.chat.editing.attachContext.shortLabel", "Add Context..."),
      f1: false,
      category: CHAT_CATEGORY,
      menu: {
        when: ChatContextKeyExprs.inEditsOrUnified,
        id: MenuId.ChatInputAttachmentToolbar,
        group: "navigation",
        order: 3
      },
      icon: Codicon.attach,
      precondition: ChatContextKeyExprs.inEditsOrUnified,
      keybinding: {
        when: ContextKeyExpr.and(ChatContextKeys.inChatInput, ChatContextKeyExprs.inEditsOrUnified),
        primary: KeyMod.CtrlCmd | KeyCode.Slash,
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  async run(accessor, ...args) {
    const context = args[0];
    const attachFilesContext = { ...context, showFilesOnly: true };
    return super.run(accessor, attachFilesContext);
  }
});
registerAction2(AttachPromptAction);
export {
  AttachContextAction,
  AttachSearchResultAction,
  registerChatContextActions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvYWN0aW9ucy9jaGF0Q29udGV4dEFjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgUmVzb2x2ZWRLZXliaW5kaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5YmluZGluZ3MuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgaXNFbGVjdHJvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lLCBkaXJuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGNvbXBhcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBXaXRoVXJpVmFsdWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVJhbmdlLCBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBDb21tYW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdEdvdG9TeW1ib2xRdWlja0FjY2Vzc1Byb3ZpZGVyLCBJR290b1N5bWJvbFF1aWNrUGlja0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9xdWlja0FjY2Vzcy9icm93c2VyL2dvdG9TeW1ib2xRdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIElBY3Rpb24yT3B0aW9ucywgTWVudUlkLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL2NvbW1vbi9jbGlwYm9hcmRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBBbnl0aGluZ1F1aWNrQWNjZXNzUHJvdmlkZXJSdW5PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tBY2Nlc3MuanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrSXRlbSwgSVF1aWNrUGlja0l0ZW1XaXRoUmVzb3VyY2UsIElRdWlja1BpY2tTZXBhcmF0b3IsIFF1aWNrUGlja0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IEFjdGl2ZUVkaXRvckNvbnRleHQsIFRleHRDb21wYXJlRWRpdG9yQWN0aXZlQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLCBTaWRlQnlTaWRlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yL2RpZmZFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSwgaXNQcm9wb3NlZEFwaUVuYWJsZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElIb3N0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2hvc3QvYnJvd3Nlci9ob3N0LmpzJztcbmltcG9ydCB7IFZJRVdfSUQgYXMgU0VBUkNIX1ZJRVdfSUQgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9zZWFyY2gvY29tbW9uL3NlYXJjaC5qcyc7XG5pbXBvcnQgeyBVbnRpdGxlZFRleHRFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3VudGl0bGVkL2NvbW1vbi91bnRpdGxlZFRleHRFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBGaWxlRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9maWxlcy9icm93c2VyL2VkaXRvcnMvZmlsZUVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IFRFWFRfRklMRV9FRElUT1JfSUQgfSBmcm9tICcuLi8uLi8uLi9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0VkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IEFueXRoaW5nUXVpY2tBY2Nlc3NQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uL3NlYXJjaC9icm93c2VyL2FueXRoaW5nUXVpY2tBY2Nlc3MuanMnO1xuaW1wb3J0IHsgaXNTZWFyY2hUcmVlRmlsZU1hdGNoLCBpc1NlYXJjaFRyZWVNYXRjaCB9IGZyb20gJy4uLy4uLy4uL3NlYXJjaC9icm93c2VyL3NlYXJjaFRyZWVNb2RlbC9zZWFyY2hUcmVlQ29tbW9uLmpzJztcbmltcG9ydCB7IFNlYXJjaFZpZXcgfSBmcm9tICcuLi8uLi8uLi9zZWFyY2gvYnJvd3Nlci9zZWFyY2hWaWV3LmpzJztcbmltcG9ydCB7IElTeW1ib2xRdWlja1BpY2tJdGVtLCBTeW1ib2xzUXVpY2tBY2Nlc3NQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uL3NlYXJjaC9icm93c2VyL3N5bWJvbHNRdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBTZWFyY2hDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vc2VhcmNoL2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgSUNoYXRBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdEFnZW50cy5qcyc7XG5pbXBvcnQgeyBDaGF0Q29udGV4dEtleUV4cHJzLCBDaGF0Q29udGV4dEtleXMgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdENvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElDaGF0RWRpdGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdEVkaXRpbmdTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnksIElEaWFnbm9zdGljVmFyaWFibGVFbnRyeUZpbHRlckRhdGEgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdE1vZGVsLmpzJztcbmltcG9ydCB7IENoYXRSZXF1ZXN0QWdlbnRQYXJ0IH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRQYXJzZXJUeXBlcy5qcyc7XG5pbXBvcnQgeyBJQ2hhdFZhcmlhYmxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdFZhcmlhYmxlcy5qcyc7XG5pbXBvcnQgeyBDaGF0QWdlbnRMb2NhdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vbGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ2hhdFdpZGdldCwgSUNoYXRXaWRnZXRTZXJ2aWNlLCBJUXVpY2tDaGF0U2VydmljZSwgc2hvd0NoYXRWaWV3LCBzaG93RWRpdHNWaWV3IH0gZnJvbSAnLi4vY2hhdC5qcyc7XG5pbXBvcnQgeyBpbWFnZVRvSGFzaCwgaXNJbWFnZSB9IGZyb20gJy4uL2NoYXRQYXN0ZVByb3ZpZGVycy5qcyc7XG5pbXBvcnQgeyBpc1F1aWNrQ2hhdCB9IGZyb20gJy4uL2NoYXRXaWRnZXQuanMnO1xuaW1wb3J0IHsgY3JlYXRlRm9sZGVyUXVpY2tQaWNrLCBjcmVhdGVNYXJrZXJzUXVpY2tQaWNrIH0gZnJvbSAnLi4vY29udHJpYi9jaGF0RHluYW1pY1ZhcmlhYmxlcy5qcyc7XG5pbXBvcnQgeyBjb252ZXJ0QnVmZmVyVG9TY3JlZW5zaG90VmFyaWFibGUsIFNjcmVlbnNob3RWYXJpYWJsZUlkIH0gZnJvbSAnLi4vY29udHJpYi9zY3JlZW5zaG90LmpzJztcbmltcG9ydCB7IHJlc2l6ZUltYWdlIH0gZnJvbSAnLi4vaW1hZ2VVdGlscy5qcyc7XG5pbXBvcnQgeyBDT01NQU5EX0lEIGFzIFVTRV9QUk9NUFRfQ09NTUFORF9JRCB9IGZyb20gJy4uL3Byb21wdFN5bnRheC9jb250cmlidXRpb25zL3VzZVByb21wdENvbW1hbmQuanMnO1xuaW1wb3J0IHsgQ0hBVF9DQVRFR09SWSB9IGZyb20gJy4vY2hhdEFjdGlvbnMuanMnO1xuaW1wb3J0IHsgQVRUQUNIX1BST01QVF9BQ1RJT05fSUQsIEF0dGFjaFByb21wdEFjdGlvbiwgSUNoYXRBdHRhY2hQcm9tcHRBY3Rpb25PcHRpb25zIH0gZnJvbSAnLi9jaGF0QXR0YWNoUHJvbXB0QWN0aW9uL2NoYXRBdHRhY2hQcm9tcHRBY3Rpb24uanMnO1xuXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJDaGF0Q29udGV4dEFjdGlvbnMoKSB7XG5cdHJlZ2lzdGVyQWN0aW9uMihBdHRhY2hDb250ZXh0QWN0aW9uKTtcblx0cmVnaXN0ZXJBY3Rpb24yKEF0dGFjaEZpbGVUb0NoYXRBY3Rpb24pO1xuXHRyZWdpc3RlckFjdGlvbjIoQXR0YWNoRm9sZGVyVG9DaGF0QWN0aW9uKTtcblx0cmVnaXN0ZXJBY3Rpb24yKEF0dGFjaFNlbGVjdGlvblRvQ2hhdEFjdGlvbik7XG5cdHJlZ2lzdGVyQWN0aW9uMihBdHRhY2hGaWxlVG9FZGl0aW5nU2Vzc2lvbkFjdGlvbik7XG5cdHJlZ2lzdGVyQWN0aW9uMihBdHRhY2hGb2xkZXJUb0VkaXRpbmdTZXNzaW9uQWN0aW9uKTtcblx0cmVnaXN0ZXJBY3Rpb24yKEF0dGFjaFNlbGVjdGlvblRvRWRpdGluZ1Nlc3Npb25BY3Rpb24pO1xuXHRyZWdpc3RlckFjdGlvbjIoQXR0YWNoU2VhcmNoUmVzdWx0QWN0aW9uKTtcbn1cblxuLyoqXG4gKiBXZSBmaWxsIHRoZSBxdWlja3BpY2sgd2l0aCB0aGVzZSB0eXBlcywgYW5kIGVuYWJsZSBzb21lIHF1aWNrIGFjY2VzcyBwcm92aWRlcnNcbiAqL1xudHlwZSBJQXR0YWNobWVudFF1aWNrUGlja0l0ZW0gPSBJQ29tbWFuZFZhcmlhYmxlUXVpY2tQaWNrSXRlbSB8IElRdWlja0FjY2Vzc1F1aWNrUGlja0l0ZW0gfCBJVG9vbFF1aWNrUGlja0l0ZW0gfFxuXHRJSW1hZ2VRdWlja1BpY2tJdGVtIHwgSU9wZW5FZGl0b3JzUXVpY2tQaWNrSXRlbSB8IElTZWFyY2hSZXN1bHRzUXVpY2tQaWNrSXRlbSB8XG5cdElTY3JlZW5TaG90UXVpY2tQaWNrSXRlbSB8IElSZWxhdGVkRmlsZXNRdWlja1BpY2tJdGVtIHwgSVJldXNhYmxlUHJvbXB0UXVpY2tQaWNrSXRlbSB8IElGb2xkZXJRdWlja1BpY2tJdGVtIHwgSURpYWdub3N0aWNzUXVpY2tQaWNrSXRlbTtcblxuLyoqXG4gKiBUaGVzZSBhcmUgdGhlIHR5cGVzIHRoYXQgd2UgY2FuIGdldCBvdXQgb2YgdGhlIHF1aWNrIHBpY2tcbiAqL1xudHlwZSBJQ2hhdENvbnRleHRRdWlja1BpY2tJdGVtID0gSUF0dGFjaG1lbnRRdWlja1BpY2tJdGVtIHwgSUdvdG9TeW1ib2xRdWlja1BpY2tJdGVtIHwgSVN5bWJvbFF1aWNrUGlja0l0ZW0gfCBJUXVpY2tQaWNrSXRlbVdpdGhSZXNvdXJjZTtcblxuZnVuY3Rpb24gaXNJR290b1N5bWJvbFF1aWNrUGlja0l0ZW0ob2JqOiB1bmtub3duKTogb2JqIGlzIElHb3RvU3ltYm9sUXVpY2tQaWNrSXRlbSB7XG5cdHJldHVybiAoXG5cdFx0dHlwZW9mIG9iaiA9PT0gJ29iamVjdCdcblx0XHQmJiB0eXBlb2YgKG9iaiBhcyBJR290b1N5bWJvbFF1aWNrUGlja0l0ZW0pLnN5bWJvbE5hbWUgPT09ICdzdHJpbmcnXG5cdFx0JiYgISEob2JqIGFzIElHb3RvU3ltYm9sUXVpY2tQaWNrSXRlbSkudXJpXG5cdFx0JiYgISEob2JqIGFzIElHb3RvU3ltYm9sUXVpY2tQaWNrSXRlbSkucmFuZ2UpO1xufVxuXG5mdW5jdGlvbiBpc0lTeW1ib2xRdWlja1BpY2tJdGVtKG9iajogdW5rbm93bik6IG9iaiBpcyBJU3ltYm9sUXVpY2tQaWNrSXRlbSB7XG5cdHJldHVybiAoXG5cdFx0dHlwZW9mIG9iaiA9PT0gJ29iamVjdCdcblx0XHQmJiB0eXBlb2YgKG9iaiBhcyBJU3ltYm9sUXVpY2tQaWNrSXRlbSkuc3ltYm9sID09PSAnb2JqZWN0J1xuXHRcdCYmICEhKG9iaiBhcyBJU3ltYm9sUXVpY2tQaWNrSXRlbSkuc3ltYm9sKTtcbn1cblxuZnVuY3Rpb24gaXNJRm9sZGVyU2VhcmNoUmVzdWx0UXVpY2tQaWNrSXRlbShvYmo6IHVua25vd24pOiBvYmogaXMgSUZvbGRlclJlc3VsdFF1aWNrUGlja0l0ZW0ge1xuXHRyZXR1cm4gKFxuXHRcdHR5cGVvZiBvYmogPT09ICdvYmplY3QnXG5cdFx0JiYgKG9iaiBhcyBJRm9sZGVyUmVzdWx0UXVpY2tQaWNrSXRlbSkua2luZCA9PT0gJ2ZvbGRlci1zZWFyY2gtcmVzdWx0Jyk7XG59XG5cbmZ1bmN0aW9uIGlzSURpYWdub3N0aWNzUXVpY2tQaWNrSXRlbVdpdGhGaWx0ZXIob2JqOiB1bmtub3duKTogb2JqIGlzIElEaWFnbm9zdGljc1F1aWNrUGlja0l0ZW1XaXRoRmlsdGVyIHtcblx0cmV0dXJuIChcblx0XHR0eXBlb2Ygb2JqID09PSAnb2JqZWN0J1xuXHRcdCYmIChvYmogYXMgSURpYWdub3N0aWNzUXVpY2tQaWNrSXRlbVdpdGhGaWx0ZXIpLmtpbmQgPT09ICdkaWFnbm9zdGljLWZpbHRlcicpO1xufVxuXG5mdW5jdGlvbiBpc0lRdWlja1BpY2tJdGVtV2l0aFJlc291cmNlKG9iajogdW5rbm93bik6IG9iaiBpcyBJUXVpY2tQaWNrSXRlbVdpdGhSZXNvdXJjZSB7XG5cdHJldHVybiAoXG5cdFx0dHlwZW9mIG9iaiA9PT0gJ29iamVjdCdcblx0XHQmJiB0eXBlb2YgKG9iaiBhcyBJUXVpY2tQaWNrSXRlbVdpdGhSZXNvdXJjZSkucmVzb3VyY2UgPT09ICdvYmplY3QnXG5cdFx0JiYgVVJJLmlzVXJpKChvYmogYXMgSVF1aWNrUGlja0l0ZW1XaXRoUmVzb3VyY2UpLnJlc291cmNlKSk7XG59XG5cbmZ1bmN0aW9uIGlzSU9wZW5FZGl0b3JzUXVpY2tQaWNrSXRlbShvYmo6IHVua25vd24pOiBvYmogaXMgSU9wZW5FZGl0b3JzUXVpY2tQaWNrSXRlbSB7XG5cdHJldHVybiAoXG5cdFx0dHlwZW9mIG9iaiA9PT0gJ29iamVjdCdcblx0XHQmJiAob2JqIGFzIElPcGVuRWRpdG9yc1F1aWNrUGlja0l0ZW0pLmlkID09PSAnb3Blbi1lZGl0b3JzJyk7XG59XG5cbmZ1bmN0aW9uIGlzSVNlYXJjaFJlc3VsdHNRdWlja1BpY2tJdGVtKG9iajogdW5rbm93bik6IG9iaiBpcyBJU2VhcmNoUmVzdWx0c1F1aWNrUGlja0l0ZW0ge1xuXHRyZXR1cm4gKFxuXHRcdHR5cGVvZiBvYmogPT09ICdvYmplY3QnXG5cdFx0JiYgKG9iaiBhcyBJU2VhcmNoUmVzdWx0c1F1aWNrUGlja0l0ZW0pLmtpbmQgPT09ICdzZWFyY2gtcmVzdWx0cycpO1xufVxuXG5mdW5jdGlvbiBpc1NjcmVlbnNob3RRdWlja1BpY2tJdGVtKG9iajogdW5rbm93bik6IG9iaiBpcyBJU2NyZWVuU2hvdFF1aWNrUGlja0l0ZW0ge1xuXHRyZXR1cm4gKFxuXHRcdHR5cGVvZiBvYmogPT09ICdvYmplY3QnXG5cdFx0JiYgKG9iaiBhcyBJU2NyZWVuU2hvdFF1aWNrUGlja0l0ZW0pLmtpbmQgPT09ICdzY3JlZW5zaG90Jyk7XG59XG5cbmZ1bmN0aW9uIGlzUmVsYXRlZEZpbGVRdWlja1BpY2tJdGVtKG9iajogdW5rbm93bik6IG9iaiBpcyBJUmVsYXRlZEZpbGVzUXVpY2tQaWNrSXRlbSB7XG5cdHJldHVybiAoXG5cdFx0dHlwZW9mIG9iaiA9PT0gJ29iamVjdCdcblx0XHQmJiAob2JqIGFzIElSZWxhdGVkRmlsZXNRdWlja1BpY2tJdGVtKS5raW5kID09PSAncmVsYXRlZC1maWxlcydcblx0KTtcbn1cblxuLyoqXG4gKiBDaGVja3MgaXMgYSBwcm92aWRlZCBvYmplY3QgaXMgYSBwcm9tcHQgaW5zdHJ1Y3Rpb25zIHF1aWNrIHBpY2sgaXRlbS5cbiAqL1xuZnVuY3Rpb24gaXNQcm9tcHRJbnN0cnVjdGlvbnNRdWlja1BpY2tJdGVtKG9iajogdW5rbm93bik6IG9iaiBpcyBJUmV1c2FibGVQcm9tcHRRdWlja1BpY2tJdGVtIHtcblx0aWYgKCFvYmogfHwgdHlwZW9mIG9iaiAhPT0gJ29iamVjdCcpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRyZXR1cm4gKCdraW5kJyBpbiBvYmogJiYgb2JqLmtpbmQgPT09ICdyZXVzYWJsZS1wcm9tcHQnKTtcbn1cblxuaW50ZXJmYWNlIElSZWxhdGVkRmlsZXNRdWlja1BpY2tJdGVtIGV4dGVuZHMgSVF1aWNrUGlja0l0ZW0ge1xuXHRraW5kOiAncmVsYXRlZC1maWxlcyc7XG5cdGlkOiBzdHJpbmc7XG5cdGxhYmVsOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBJRm9sZGVyUXVpY2tQaWNrSXRlbSBleHRlbmRzIElRdWlja1BpY2tJdGVtIHtcblx0a2luZDogJ2ZvbGRlcic7XG5cdGlkOiBzdHJpbmc7XG5cdGxhYmVsOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBJRm9sZGVyUmVzdWx0UXVpY2tQaWNrSXRlbSBleHRlbmRzIElRdWlja1BpY2tJdGVtIHtcblx0a2luZDogJ2ZvbGRlci1zZWFyY2gtcmVzdWx0Jztcblx0aWQ6IHN0cmluZztcblx0cmVzb3VyY2U6IFVSSTtcbn1cblxuaW50ZXJmYWNlIElJbWFnZVF1aWNrUGlja0l0ZW0gZXh0ZW5kcyBJUXVpY2tQaWNrSXRlbSB7XG5cdGtpbmQ6ICdpbWFnZSc7XG5cdGlkOiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBJQ29tbWFuZFZhcmlhYmxlUXVpY2tQaWNrSXRlbSBleHRlbmRzIElRdWlja1BpY2tJdGVtIHtcblx0a2luZDogJ2NvbW1hbmQnO1xuXHRpZDogc3RyaW5nO1xuXHRjb21tYW5kOiBDb21tYW5kO1xuXHRuYW1lPzogc3RyaW5nO1xuXHR2YWx1ZTogdW5rbm93bjtcblxuXHRpY29uPzogVGhlbWVJY29uO1xufVxuXG5pbnRlcmZhY2UgSVRvb2xRdWlja1BpY2tJdGVtIGV4dGVuZHMgSVF1aWNrUGlja0l0ZW0ge1xuXHRraW5kOiAndG9vbCc7XG5cdGlkOiBzdHJpbmc7XG5cdG5hbWU/OiBzdHJpbmc7XG5cdGljb24/OiBUaGVtZUljb247XG59XG5cbmludGVyZmFjZSBJUXVpY2tBY2Nlc3NRdWlja1BpY2tJdGVtIGV4dGVuZHMgSVF1aWNrUGlja0l0ZW0ge1xuXHRraW5kOiAncXVpY2thY2Nlc3MnO1xuXHRpZDogc3RyaW5nO1xuXHRwcmVmaXg6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIElPcGVuRWRpdG9yc1F1aWNrUGlja0l0ZW0gZXh0ZW5kcyBJUXVpY2tQaWNrSXRlbSB7XG5cdGtpbmQ6ICdvcGVuLWVkaXRvcnMnO1xuXHRpZDogJ29wZW4tZWRpdG9ycyc7XG5cdGljb24/OiBUaGVtZUljb247XG59XG5cbmludGVyZmFjZSBJU2VhcmNoUmVzdWx0c1F1aWNrUGlja0l0ZW0gZXh0ZW5kcyBJUXVpY2tQaWNrSXRlbSB7XG5cdGtpbmQ6ICdzZWFyY2gtcmVzdWx0cyc7XG5cdGlkOiBzdHJpbmc7XG5cdGljb24/OiBUaGVtZUljb247XG59XG5cbmludGVyZmFjZSBJU2NyZWVuU2hvdFF1aWNrUGlja0l0ZW0gZXh0ZW5kcyBJUXVpY2tQaWNrSXRlbSB7XG5cdGtpbmQ6ICdzY3JlZW5zaG90Jztcblx0aWQ6IHN0cmluZztcblx0aWNvbj86IFRoZW1lSWNvbjtcbn1cblxuaW50ZXJmYWNlIElEaWFnbm9zdGljc1F1aWNrUGlja0l0ZW0gZXh0ZW5kcyBJUXVpY2tQaWNrSXRlbSB7XG5cdGtpbmQ6ICdkaWFnbm9zdGljJztcblx0aWQ6IHN0cmluZztcblx0aWNvbj86IFRoZW1lSWNvbjtcbn1cblxuaW50ZXJmYWNlIElEaWFnbm9zdGljc1F1aWNrUGlja0l0ZW1XaXRoRmlsdGVyIGV4dGVuZHMgSVF1aWNrUGlja0l0ZW0ge1xuXHRraW5kOiAnZGlhZ25vc3RpYy1maWx0ZXInO1xuXHRpZDogc3RyaW5nO1xuXHRmaWx0ZXI6IElEaWFnbm9zdGljVmFyaWFibGVFbnRyeUZpbHRlckRhdGE7XG5cdGljb24/OiBUaGVtZUljb247XG59XG5cbi8qKlxuICogUXVpY2sgcGljayBpdGVtIGZvciByZXVzYWJsZSBwcm9tcHQgYXR0YWNobWVudC5cbiAqL1xuY29uc3QgUkVVU0FCTEVfUFJPTVBUX1BJQ0tfSUQgPSAncmV1c2FibGUtcHJvbXB0JztcbmludGVyZmFjZSBJUmV1c2FibGVQcm9tcHRRdWlja1BpY2tJdGVtIGV4dGVuZHMgSVF1aWNrUGlja0l0ZW0ge1xuXHQvKipcblx0ICogVGhlIElEIG9mIHRoZSBxdWljayBwaWNrIGl0ZW0uXG5cdCAqL1xuXHRpZDogdHlwZW9mIFJFVVNBQkxFX1BST01QVF9QSUNLX0lEO1xuXG5cdC8qKlxuXHQgKiBVbmlxdWUga2luZCBpZGVudGlmaWVyIG9mIHRoZSByZXVzYWJsZSBwcm9tcHQgYXR0YWNobWVudC5cblx0ICovXG5cdGtpbmQ6IHR5cGVvZiBSRVVTQUJMRV9QUk9NUFRfUElDS19JRDtcblxuXHQvKipcblx0ICogS2V5YmluZGluZyBvZiB0aGUgY29tbWFuZC5cblx0ICovXG5cdGtleWJpbmRpbmc/OiBSZXNvbHZlZEtleWJpbmRpbmc7XG59XG5cbmFic3RyYWN0IGNsYXNzIEF0dGFjaFJlc291cmNlQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGdldFJlc291cmNlcyhhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pOiBVUklbXSB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cblx0XHRjb25zdCBjb250ZXh0cyA9IEFycmF5LmlzQXJyYXkoYXJnc1sxXSkgPyBhcmdzWzFdIDogW2FyZ3NbMF1dO1xuXHRcdGNvbnN0IGZpbGVzID0gW107XG5cdFx0Zm9yIChjb25zdCBjb250ZXh0IG9mIGNvbnRleHRzKSB7XG5cdFx0XHRsZXQgdXJpO1xuXHRcdFx0aWYgKFVSSS5pc1VyaShjb250ZXh0KSkge1xuXHRcdFx0XHR1cmkgPSBjb250ZXh0O1xuXHRcdFx0fSBlbHNlIGlmIChpc1NlYXJjaFRyZWVGaWxlTWF0Y2goY29udGV4dCkpIHtcblx0XHRcdFx0dXJpID0gY29udGV4dC5yZXNvdXJjZTtcblx0XHRcdH0gZWxzZSBpZiAoaXNTZWFyY2hUcmVlTWF0Y2goY29udGV4dCkpIHtcblx0XHRcdFx0dXJpID0gY29udGV4dC5wYXJlbnQoKS5yZXNvdXJjZTtcblx0XHRcdH0gZWxzZSBpZiAoIWNvbnRleHQgJiYgZWRpdG9yU2VydmljZS5hY3RpdmVUZXh0RWRpdG9yQ29udHJvbCkge1xuXHRcdFx0XHR1cmkgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldENhbm9uaWNhbFVyaShlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvciwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5QUklNQVJZIH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodXJpICYmIFtTY2hlbWFzLmZpbGUsIFNjaGVtYXMudnNjb2RlUmVtb3RlLCBTY2hlbWFzLnVudGl0bGVkXS5pbmNsdWRlcyh1cmkuc2NoZW1lKSkge1xuXHRcdFx0XHRmaWxlcy5wdXNoKHVyaSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGZpbGVzO1xuXHR9XG59XG5cbmNsYXNzIEF0dGFjaEZpbGVUb0NoYXRBY3Rpb24gZXh0ZW5kcyBBdHRhY2hSZXNvdXJjZUFjdGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5hdHRhY2hGaWxlJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQXR0YWNoRmlsZVRvQ2hhdEFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5hdHRhY2hGaWxlLmxhYmVsJywgXCJBZGQgRmlsZSB0byBDaGF0XCIpLFxuXHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLlNlYXJjaENvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAnel9jaGF0Jyxcblx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDaGF0Q29udGV4dEtleXMuZW5hYmxlZCwgQ29udGV4dEtleUV4cHIub3IoQWN0aXZlRWRpdG9yQ29udGV4dC5pc0VxdWFsVG8oVEVYVF9GSUxFX0VESVRPUl9JRCksIFRleHRDb21wYXJlRWRpdG9yQWN0aXZlQ29udGV4dCksIFNlYXJjaENvbnRleHQuU2VhcmNoUmVzdWx0SGVhZGVyRm9jdXNlZC5uZWdhdGUoKSksXG5cdFx0XHR9XVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHZhcmlhYmxlc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRWYXJpYWJsZXNTZXJ2aWNlKTtcblx0XHRjb25zdCBmaWxlcyA9IHRoaXMuZ2V0UmVzb3VyY2VzKGFjY2Vzc29yLCAuLi5hcmdzKTtcblxuXHRcdGlmIChmaWxlcy5sZW5ndGgpIHtcblx0XHRcdChhd2FpdCBzaG93Q2hhdFZpZXcoYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpKSk/LmZvY3VzSW5wdXQoKTtcblx0XHRcdGZvciAoY29uc3QgZmlsZSBvZiBmaWxlcykge1xuXHRcdFx0XHR2YXJpYWJsZXNTZXJ2aWNlLmF0dGFjaENvbnRleHQoJ2ZpbGUnLCBmaWxlLCBDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIEF0dGFjaEZvbGRlclRvQ2hhdEFjdGlvbiBleHRlbmRzIEF0dGFjaFJlc291cmNlQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5jaGF0LmF0dGFjaEZvbGRlcic7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEF0dGFjaEZvbGRlclRvQ2hhdEFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5hdHRhY2hGb2xkZXIubGFiZWwnLCBcIkFkZCBGb2xkZXIgdG8gQ2hhdFwiKSxcblx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHZhcmlhYmxlc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRWYXJpYWJsZXNTZXJ2aWNlKTtcblx0XHRjb25zdCBmb2xkZXJzID0gdGhpcy5nZXRSZXNvdXJjZXMoYWNjZXNzb3IsIC4uLmFyZ3MpO1xuXG5cdFx0aWYgKGZvbGRlcnMubGVuZ3RoKSB7XG5cdFx0XHQoYXdhaXQgc2hvd0NoYXRWaWV3KGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKSkpPy5mb2N1c0lucHV0KCk7XG5cdFx0XHRmb3IgKGNvbnN0IGZvbGRlciBvZiBmb2xkZXJzKSB7XG5cdFx0XHRcdHZhcmlhYmxlc1NlcnZpY2UuYXR0YWNoQ29udGV4dCgnZm9sZGVyJywgZm9sZGVyLCBDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIEF0dGFjaFNlbGVjdGlvblRvQ2hhdEFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuYXR0YWNoU2VsZWN0aW9uJztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQXR0YWNoU2VsZWN0aW9uVG9DaGF0QWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi5jaGF0LmF0dGFjaFNlbGVjdGlvbi5sYWJlbCcsIFwiQWRkIFNlbGVjdGlvbiB0byBDaGF0XCIpLFxuXHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRmMTogZmFsc2UsXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdmFyaWFibGVzU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFZhcmlhYmxlc1NlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IFtfLCBtYXRjaGVzXSA9IGFyZ3M7XG5cdFx0Ly8gSWYgd2UgaGF2ZSBzZWFyY2ggbWF0Y2hlcywgaXQgbWVhbnMgdGhpcyBpcyBjb21pbmcgZnJvbSB0aGUgc2VhcmNoIHdpZGdldFxuXHRcdGlmIChtYXRjaGVzICYmIG1hdGNoZXMubGVuZ3RoID4gMCkge1xuXHRcdFx0Y29uc3QgdXJpcyA9IG5ldyBNYXA8VVJJLCBSYW5nZSB8IHVuZGVmaW5lZD4oKTtcblx0XHRcdGZvciAoY29uc3QgbWF0Y2ggb2YgbWF0Y2hlcykge1xuXHRcdFx0XHRpZiAoaXNTZWFyY2hUcmVlRmlsZU1hdGNoKG1hdGNoKSkge1xuXHRcdFx0XHRcdHVyaXMuc2V0KG1hdGNoLnJlc291cmNlLCB1bmRlZmluZWQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGNvbnRleHQgPSB7IHVyaTogbWF0Y2guX3BhcmVudC5yZXNvdXJjZSwgcmFuZ2U6IG1hdGNoLl9yYW5nZSB9O1xuXHRcdFx0XHRcdGNvbnN0IHJhbmdlID0gdXJpcy5nZXQoY29udGV4dC51cmkpO1xuXHRcdFx0XHRcdGlmICghcmFuZ2UgfHxcblx0XHRcdFx0XHRcdHJhbmdlLnN0YXJ0TGluZU51bWJlciAhPT0gY29udGV4dC5yYW5nZS5zdGFydExpbmVOdW1iZXIgJiYgcmFuZ2UuZW5kTGluZU51bWJlciAhPT0gY29udGV4dC5yYW5nZS5lbmRMaW5lTnVtYmVyKSB7XG5cdFx0XHRcdFx0XHR1cmlzLnNldChjb250ZXh0LnVyaSwgY29udGV4dC5yYW5nZSk7XG5cdFx0XHRcdFx0XHR2YXJpYWJsZXNTZXJ2aWNlLmF0dGFjaENvbnRleHQoJ2ZpbGUnLCBjb250ZXh0LCBDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHQvLyBBZGQgdGhlIHJvb3QgZmlsZXMgZm9yIGFsbCBvZiB0aGUgb25lcyB0aGF0IGRpZG4ndCBoYXZlIGEgbWF0Y2hcblx0XHRcdGZvciAoY29uc3QgdXJpIG9mIHVyaXMpIHtcblx0XHRcdFx0Y29uc3QgW3Jlc291cmNlLCByYW5nZV0gPSB1cmk7XG5cdFx0XHRcdGlmICghcmFuZ2UpIHtcblx0XHRcdFx0XHR2YXJpYWJsZXNTZXJ2aWNlLmF0dGFjaENvbnRleHQoJ2ZpbGUnLCB7IHVyaTogcmVzb3VyY2UgfSwgQ2hhdEFnZW50TG9jYXRpb24uUGFuZWwpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGFjdGl2ZUVkaXRvciA9IGVkaXRvclNlcnZpY2UuYWN0aXZlVGV4dEVkaXRvckNvbnRyb2w7XG5cdFx0XHRjb25zdCBhY3RpdmVVcmkgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldENhbm9uaWNhbFVyaShlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvciwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5QUklNQVJZIH0pO1xuXHRcdFx0aWYgKGVkaXRvclNlcnZpY2UuYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wgJiYgYWN0aXZlVXJpICYmIFtTY2hlbWFzLmZpbGUsIFNjaGVtYXMudnNjb2RlUmVtb3RlLCBTY2hlbWFzLnVudGl0bGVkXS5pbmNsdWRlcyhhY3RpdmVVcmkuc2NoZW1lKSkge1xuXHRcdFx0XHRjb25zdCBzZWxlY3Rpb24gPSBhY3RpdmVFZGl0b3I/LmdldFNlbGVjdGlvbigpO1xuXHRcdFx0XHRpZiAoc2VsZWN0aW9uKSB7XG5cdFx0XHRcdFx0KGF3YWl0IHNob3dDaGF0VmlldyhhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSkpKT8uZm9jdXNJbnB1dCgpO1xuXHRcdFx0XHRcdGNvbnN0IHJhbmdlID0gc2VsZWN0aW9uLmlzRW1wdHkoKSA/IG5ldyBSYW5nZShzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyLCAxLCBzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyICsgMSwgMSkgOiBzZWxlY3Rpb247XG5cdFx0XHRcdFx0dmFyaWFibGVzU2VydmljZS5hdHRhY2hDb250ZXh0KCdmaWxlJywgeyB1cmk6IGFjdGl2ZVVyaSwgcmFuZ2UgfSwgQ2hhdEFnZW50TG9jYXRpb24uUGFuZWwpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIEF0dGFjaEZpbGVUb0VkaXRpbmdTZXNzaW9uQWN0aW9uIGV4dGVuZHMgQXR0YWNoUmVzb3VyY2VBY3Rpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmVkaXRzLmF0dGFjaEZpbGUnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBBdHRhY2hGaWxlVG9FZGl0aW5nU2Vzc2lvbkFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5hY3Rpb24uZWRpdHMuYXR0YWNoRmlsZS5sYWJlbCcsIFwiQWRkIEZpbGUgdG8gezB9XCIsICdDb3BpbG90IEVkaXRzJyksXG5cdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuU2VhcmNoQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6ICd6X2NoYXQnLFxuXHRcdFx0XHRvcmRlcjogMixcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5lbmFibGVkLFxuXHRcdFx0XHRcdENvbnRleHRLZXlFeHByLm9yKEFjdGl2ZUVkaXRvckNvbnRleHQuaXNFcXVhbFRvKFRFWFRfRklMRV9FRElUT1JfSUQpLCBUZXh0Q29tcGFyZUVkaXRvckFjdGl2ZUNvbnRleHQpLFxuXHRcdFx0XHRcdENoYXRDb250ZXh0S2V5RXhwcnMudW5pZmllZENoYXRFbmFibGVkLm5lZ2F0ZSgpLFxuXHRcdFx0XHRcdFNlYXJjaENvbnRleHQuU2VhcmNoUmVzdWx0SGVhZGVyRm9jdXNlZC5uZWdhdGUoKSksXG5cdFx0XHR9XVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHZhcmlhYmxlc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRWYXJpYWJsZXNTZXJ2aWNlKTtcblx0XHRjb25zdCBmaWxlcyA9IHRoaXMuZ2V0UmVzb3VyY2VzKGFjY2Vzc29yLCAuLi5hcmdzKTtcblxuXHRcdGlmIChmaWxlcy5sZW5ndGgpIHtcblx0XHRcdChhd2FpdCBzaG93RWRpdHNWaWV3KGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKSkpPy5mb2N1c0lucHV0KCk7XG5cdFx0XHRmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcblx0XHRcdFx0dmFyaWFibGVzU2VydmljZS5hdHRhY2hDb250ZXh0KCdmaWxlJywgZmlsZSwgQ2hhdEFnZW50TG9jYXRpb24uRWRpdGluZ1Nlc3Npb24pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQXR0YWNoU2VhcmNoUmVzdWx0QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdHN0YXRpYyByZWFkb25seSBOYW1lID0gJ3NlYXJjaFJlc3VsdHMnO1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5jaGF0Lmluc2VydFNlYXJjaFJlc3VsdHMnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBBdHRhY2hTZWFyY2hSZXN1bHRBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdjaGF0Lmluc2VydFNlYXJjaFJlc3VsdHMnLCAnQWRkIFNlYXJjaCBSZXN1bHRzIHRvIENoYXQnKSxcblx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5TZWFyY2hDb250ZXh0LFxuXHRcdFx0XHRncm91cDogJ3pfY2hhdCcsXG5cdFx0XHRcdG9yZGVyOiAzLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLmVuYWJsZWQsXG5cdFx0XHRcdFx0U2VhcmNoQ29udGV4dC5TZWFyY2hSZXN1bHRIZWFkZXJGb2N1c2VkKSxcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSkge1xuXHRcdGNvbnN0IGxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxvZ1NlcnZpY2UpO1xuXHRcdGNvbnN0IHdpZGdldCA9IChhd2FpdCBzaG93Q2hhdFZpZXcoYWNjZXNzb3IuZ2V0KElWaWV3c1NlcnZpY2UpKSk7XG5cblx0XHRpZiAoIXdpZGdldCkge1xuXHRcdFx0bG9nU2VydmljZS50cmFjZSgnSW5zZXJ0U2VhcmNoUmVzdWx0QWN0aW9uOiBubyBjaGF0IHZpZXcgYXZhaWxhYmxlJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWRpdG9yID0gd2lkZ2V0LmlucHV0RWRpdG9yO1xuXHRcdGNvbnN0IG9yaWdpbmFsUmFuZ2UgPSBlZGl0b3IuZ2V0U2VsZWN0aW9uKCkgPz8gZWRpdG9yLmdldE1vZGVsKCk/LmdldEZ1bGxNb2RlbFJhbmdlKCkuY29sbGFwc2VUb0VuZCgpO1xuXG5cdFx0aWYgKCFvcmlnaW5hbFJhbmdlKSB7XG5cdFx0XHRsb2dTZXJ2aWNlLnRyYWNlKCdJbnNlcnRTZWFyY2hSZXN1bHRBY3Rpb246IG5vIHNlbGVjdGlvbicpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBpbnNlcnRUZXh0ID0gYCMke0F0dGFjaFNlYXJjaFJlc3VsdEFjdGlvbi5OYW1lfWA7XG5cdFx0Y29uc3QgdmFyUmFuZ2UgPSBuZXcgUmFuZ2Uob3JpZ2luYWxSYW5nZS5zdGFydExpbmVOdW1iZXIsIG9yaWdpbmFsUmFuZ2Uuc3RhcnRDb2x1bW4sIG9yaWdpbmFsUmFuZ2UuZW5kTGluZU51bWJlciwgb3JpZ2luYWxSYW5nZS5zdGFydENvbHVtbiArIGluc2VydFRleHQubGVuZ3RoKTtcblx0XHQvLyBjaGVjayBjaGFyYWN0ZXIgYmVmb3JlIHRoZSBzdGFydCBvZiB0aGUgcmFuZ2UuIElmIGl0J3Mgbm90IGEgc3BhY2UsIGFkZCBhIHNwYWNlXG5cdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRpZiAobW9kZWwgJiYgbW9kZWwuZ2V0VmFsdWVJblJhbmdlKG5ldyBSYW5nZShvcmlnaW5hbFJhbmdlLnN0YXJ0TGluZU51bWJlciwgb3JpZ2luYWxSYW5nZS5zdGFydENvbHVtbiAtIDEsIG9yaWdpbmFsUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBvcmlnaW5hbFJhbmdlLnN0YXJ0Q29sdW1uKSkgIT09ICcgJykge1xuXHRcdFx0aW5zZXJ0VGV4dCA9ICcgJyArIGluc2VydFRleHQ7XG5cdFx0fVxuXHRcdGNvbnN0IHN1Y2Nlc3MgPSBlZGl0b3IuZXhlY3V0ZUVkaXRzKCdjaGF0SW5zZXJ0U2VhcmNoJywgW3sgcmFuZ2U6IHZhclJhbmdlLCB0ZXh0OiBpbnNlcnRUZXh0ICsgJyAnIH1dKTtcblx0XHRpZiAoIXN1Y2Nlc3MpIHtcblx0XHRcdGxvZ1NlcnZpY2UudHJhY2UoYEluc2VydFNlYXJjaFJlc3VsdEFjdGlvbjogZmFpbGVkIHRvIGluc2VydCBcIiR7aW5zZXJ0VGV4dH1cImApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBBdHRhY2hGb2xkZXJUb0VkaXRpbmdTZXNzaW9uQWN0aW9uIGV4dGVuZHMgQXR0YWNoUmVzb3VyY2VBY3Rpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLmVkaXRzLmF0dGFjaEZvbGRlcic7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEF0dGFjaEZvbGRlclRvRWRpdGluZ1Nlc3Npb25BY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLmVkaXRzLmF0dGFjaEZvbGRlci5sYWJlbCcsIFwiQWRkIEZvbGRlciB0byB7MH1cIiwgJ0NvcGlsb3QgRWRpdHMnKSxcblx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdENoYXRDb250ZXh0S2V5cy5lbmFibGVkLFxuXHRcdFx0XHRDaGF0Q29udGV4dEtleUV4cHJzLnVuaWZpZWRDaGF0RW5hYmxlZC5uZWdhdGUoKSksXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdmFyaWFibGVzU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFZhcmlhYmxlc1NlcnZpY2UpO1xuXHRcdGNvbnN0IGZvbGRlcnMgPSB0aGlzLmdldFJlc291cmNlcyhhY2Nlc3NvciwgLi4uYXJncyk7XG5cblx0XHRpZiAoZm9sZGVycy5sZW5ndGgpIHtcblx0XHRcdChhd2FpdCBzaG93RWRpdHNWaWV3KGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKSkpPy5mb2N1c0lucHV0KCk7XG5cdFx0XHRmb3IgKGNvbnN0IGZvbGRlciBvZiBmb2xkZXJzKSB7XG5cdFx0XHRcdHZhcmlhYmxlc1NlcnZpY2UuYXR0YWNoQ29udGV4dCgnZm9sZGVyJywgZm9sZGVyLCBDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIEF0dGFjaFNlbGVjdGlvblRvRWRpdGluZ1Nlc3Npb25BY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5lZGl0cy5hdHRhY2hTZWxlY3Rpb24nO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBBdHRhY2hTZWxlY3Rpb25Ub0VkaXRpbmdTZXNzaW9uQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi5lZGl0cy5hdHRhY2hTZWxlY3Rpb24ubGFiZWwnLCBcIkFkZCBTZWxlY3Rpb24gdG8gezB9XCIsICdDb3BpbG90IEVkaXRzJyksXG5cdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRDaGF0Q29udGV4dEtleXMuZW5hYmxlZCxcblx0XHRcdFx0Q29udGV4dEtleUV4cHIub3IoQWN0aXZlRWRpdG9yQ29udGV4dC5pc0VxdWFsVG8oVEVYVF9GSUxFX0VESVRPUl9JRCksIFRleHRDb21wYXJlRWRpdG9yQWN0aXZlQ29udGV4dCksXG5cdFx0XHRcdENoYXRDb250ZXh0S2V5RXhwcnMudW5pZmllZENoYXRFbmFibGVkLm5lZ2F0ZSgpXG5cdFx0XHQpXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdmFyaWFibGVzU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdFZhcmlhYmxlc1NlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgYWN0aXZlRWRpdG9yID0gZWRpdG9yU2VydmljZS5hY3RpdmVUZXh0RWRpdG9yQ29udHJvbDtcblx0XHRjb25zdCBhY3RpdmVVcmkgPSBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldENhbm9uaWNhbFVyaShlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvciwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5QUklNQVJZIH0pO1xuXHRcdGlmIChlZGl0b3JTZXJ2aWNlLmFjdGl2ZVRleHRFZGl0b3JDb250cm9sICYmIGFjdGl2ZVVyaSAmJiBbU2NoZW1hcy5maWxlLCBTY2hlbWFzLnZzY29kZVJlbW90ZSwgU2NoZW1hcy51bnRpdGxlZF0uaW5jbHVkZXMoYWN0aXZlVXJpLnNjaGVtZSkpIHtcblx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IGFjdGl2ZUVkaXRvcj8uZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHRpZiAoc2VsZWN0aW9uKSB7XG5cdFx0XHRcdChhd2FpdCBzaG93RWRpdHNWaWV3KGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKSkpPy5mb2N1c0lucHV0KCk7XG5cdFx0XHRcdGNvbnN0IHJhbmdlID0gc2VsZWN0aW9uLmlzRW1wdHkoKSA/IG5ldyBSYW5nZShzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyLCAxLCBzZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyICsgMSwgMSkgOiBzZWxlY3Rpb247XG5cdFx0XHRcdHZhcmlhYmxlc1NlcnZpY2UuYXR0YWNoQ29udGV4dCgnZmlsZScsIHsgdXJpOiBhY3RpdmVVcmksIHJhbmdlIH0sIENoYXRBZ2VudExvY2F0aW9uLkVkaXRpbmdTZXNzaW9uKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEF0dGFjaENvbnRleHRBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5jaGF0LmF0dGFjaENvbnRleHQnO1xuXG5cdGNvbnN0cnVjdG9yKGRlc2M6IFJlYWRvbmx5PElBY3Rpb24yT3B0aW9ucz4gPSB7XG5cdFx0aWQ6IEF0dGFjaENvbnRleHRBY3Rpb24uSUQsXG5cdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi5jaGF0LmF0dGFjaENvbnRleHQubGFiZWwuMicsIFwiQWRkIENvbnRleHRcIiksXG5cdFx0aWNvbjogQ29kaWNvbi5hdHRhY2gsXG5cdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0a2V5YmluZGluZzoge1xuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRDaGF0Q29udGV4dEtleXMubG9jYXRpb24ubm90RXF1YWxzVG8oQ2hhdEFnZW50TG9jYXRpb24uRWRpdGluZ1Nlc3Npb24pLFxuXHRcdFx0XHRDaGF0Q29udGV4dEtleXMuaW5DaGF0SW5wdXQsXG5cdFx0XHRcdENoYXRDb250ZXh0S2V5RXhwcnMuaW5Ob25VbmlmaWVkUGFuZWwpLFxuXHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlNsYXNoLFxuXHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHR9LFxuXHRcdG1lbnU6IFtcblx0XHRcdHtcblx0XHRcdFx0d2hlbjogQ2hhdENvbnRleHRLZXlFeHBycy5pbk5vblVuaWZpZWRQYW5lbCxcblx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0SW5wdXRBdHRhY2htZW50VG9vbGJhcixcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IDJcblx0XHRcdH1cblx0XHRdXG5cdH0pIHtcblx0XHRzdXBlcihkZXNjKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldEZpbGVDb250ZXh0SWQoaXRlbTogeyByZXNvdXJjZTogVVJJIH0gfCB7IHVyaTogVVJJOyByYW5nZTogSVJhbmdlIH0pIHtcblx0XHRpZiAoJ3Jlc291cmNlJyBpbiBpdGVtKSB7XG5cdFx0XHRyZXR1cm4gaXRlbS5yZXNvdXJjZS50b1N0cmluZygpO1xuXHRcdH1cblxuXHRcdHJldHVybiBpdGVtLnVyaS50b1N0cmluZygpICsgKGl0ZW0ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICE9PSBpdGVtLnJhbmdlLmVuZExpbmVOdW1iZXIgP1xuXHRcdFx0YDoke2l0ZW0ucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyfS0ke2l0ZW0ucmFuZ2UuZW5kTGluZU51bWJlcn1gIDpcblx0XHRcdGA6JHtpdGVtLnJhbmdlLnN0YXJ0TGluZU51bWJlcn1gKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2F0dGFjaENvbnRleHQod2lkZ2V0OiBJQ2hhdFdpZGdldCwgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSwgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSwgY2xpcGJvYXJkU2VydmljZTogSUNsaXBib2FyZFNlcnZpY2UsIGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLCBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsIHZpZXdzU2VydmljZTogSVZpZXdzU2VydmljZSwgY2hhdEVkaXRpbmdTZXJ2aWNlOiBJQ2hhdEVkaXRpbmdTZXJ2aWNlIHwgdW5kZWZpbmVkLCBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLCBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLCB0ZXh0TW9kZWxTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSwgaXNJbkJhY2tncm91bmQ/OiBib29sZWFuLCAuLi5waWNrczogSUNoYXRDb250ZXh0UXVpY2tQaWNrSXRlbVtdKSB7XG5cdFx0Y29uc3QgdG9BdHRhY2g6IElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnlbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgcGljayBvZiBwaWNrcykge1xuXHRcdFx0aWYgKGlzSVN5bWJvbFF1aWNrUGlja0l0ZW0ocGljaykgJiYgcGljay5zeW1ib2wpIHtcblx0XHRcdFx0Ly8gV29ya3NwYWNlIHN5bWJvbFxuXHRcdFx0XHR0b0F0dGFjaC5wdXNoKHtcblx0XHRcdFx0XHRraW5kOiAnc3ltYm9sJyxcblx0XHRcdFx0XHRpZDogdGhpcy5fZ2V0RmlsZUNvbnRleHRJZChwaWNrLnN5bWJvbC5sb2NhdGlvbiksXG5cdFx0XHRcdFx0dmFsdWU6IHBpY2suc3ltYm9sLmxvY2F0aW9uLFxuXHRcdFx0XHRcdHN5bWJvbEtpbmQ6IHBpY2suc3ltYm9sLmtpbmQsXG5cdFx0XHRcdFx0ZnVsbE5hbWU6IHBpY2subGFiZWwsXG5cdFx0XHRcdFx0bmFtZTogcGljay5zeW1ib2wubmFtZSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2UgaWYgKGlzSUZvbGRlclNlYXJjaFJlc3VsdFF1aWNrUGlja0l0ZW0ocGljaykpIHtcblx0XHRcdFx0Y29uc3QgZm9sZGVyID0gcGljay5yZXNvdXJjZTtcblx0XHRcdFx0dG9BdHRhY2gucHVzaCh7XG5cdFx0XHRcdFx0aWQ6IHBpY2suaWQsXG5cdFx0XHRcdFx0dmFsdWU6IGZvbGRlcixcblx0XHRcdFx0XHRuYW1lOiBiYXNlbmFtZShmb2xkZXIpLFxuXHRcdFx0XHRcdGlzRmlsZTogZmFsc2UsXG5cdFx0XHRcdFx0aXNEaXJlY3Rvcnk6IHRydWUsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIGlmIChpc0lEaWFnbm9zdGljc1F1aWNrUGlja0l0ZW1XaXRoRmlsdGVyKHBpY2spKSB7XG5cdFx0XHRcdHRvQXR0YWNoLnB1c2goe1xuXHRcdFx0XHRcdGlkOiBwaWNrLmlkLFxuXHRcdFx0XHRcdG5hbWU6IHBpY2subGFiZWwsXG5cdFx0XHRcdFx0dmFsdWU6IHBpY2suZmlsdGVyLFxuXHRcdFx0XHRcdGtpbmQ6ICdkaWFnbm9zdGljJyxcblx0XHRcdFx0XHRpY29uOiBwaWNrLmljb24sXG5cdFx0XHRcdFx0Li4ucGljay5maWx0ZXIsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIGlmIChpc0lRdWlja1BpY2tJdGVtV2l0aFJlc291cmNlKHBpY2spICYmIHBpY2sucmVzb3VyY2UpIHtcblx0XHRcdFx0aWYgKC9cXC4ocG5nfGpwZ3xqcGVnfGJtcHxnaWZ8dGlmZikkL2kudGVzdChwaWNrLnJlc291cmNlLnBhdGgpKSB7XG5cdFx0XHRcdFx0Ly8gY2hlY2tzIGlmIHRoZSBmaWxlIGlzIGFuIGltYWdlXG5cdFx0XHRcdFx0aWYgKFVSSS5pc1VyaShwaWNrLnJlc291cmNlKSkge1xuXHRcdFx0XHRcdFx0Ly8gcmVhZCB0aGUgaW1hZ2UgYW5kIGF0dGFjaCBhIG5ldyBmaWxlIGNvbnRleHQuXG5cdFx0XHRcdFx0XHRjb25zdCByZWFkRmlsZSA9IGF3YWl0IGZpbGVTZXJ2aWNlLnJlYWRGaWxlKHBpY2sucmVzb3VyY2UpO1xuXHRcdFx0XHRcdFx0Y29uc3QgcmVzaXplZEltYWdlID0gYXdhaXQgcmVzaXplSW1hZ2UocmVhZEZpbGUudmFsdWUuYnVmZmVyKTtcblx0XHRcdFx0XHRcdHRvQXR0YWNoLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRpZDogcGljay5yZXNvdXJjZS50b1N0cmluZygpLFxuXHRcdFx0XHRcdFx0XHRuYW1lOiBwaWNrLmxhYmVsLFxuXHRcdFx0XHRcdFx0XHRmdWxsTmFtZTogcGljay5sYWJlbCxcblx0XHRcdFx0XHRcdFx0dmFsdWU6IHJlc2l6ZWRJbWFnZSxcblx0XHRcdFx0XHRcdFx0aXNJbWFnZTogdHJ1ZVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGxldCBpc09taXR0ZWQgPSBmYWxzZTtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0Y29uc3QgY3JlYXRlZE1vZGVsID0gYXdhaXQgdGV4dE1vZGVsU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShwaWNrLnJlc291cmNlKTtcblx0XHRcdFx0XHRcdGNyZWF0ZWRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdFx0XHRpc09taXR0ZWQgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRvQXR0YWNoLnB1c2goe1xuXHRcdFx0XHRcdFx0aWQ6IHRoaXMuX2dldEZpbGVDb250ZXh0SWQoeyByZXNvdXJjZTogcGljay5yZXNvdXJjZSB9KSxcblx0XHRcdFx0XHRcdHZhbHVlOiBwaWNrLnJlc291cmNlLFxuXHRcdFx0XHRcdFx0bmFtZTogcGljay5sYWJlbCxcblx0XHRcdFx0XHRcdGlzRmlsZTogdHJ1ZSxcblx0XHRcdFx0XHRcdGlzT21pdHRlZFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKGlzSUdvdG9TeW1ib2xRdWlja1BpY2tJdGVtKHBpY2spICYmIHBpY2sudXJpICYmIHBpY2sucmFuZ2UpIHtcblx0XHRcdFx0dG9BdHRhY2gucHVzaCh7XG5cdFx0XHRcdFx0cmFuZ2U6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRpZDogdGhpcy5fZ2V0RmlsZUNvbnRleHRJZCh7IHVyaTogcGljay51cmksIHJhbmdlOiBwaWNrLnJhbmdlLmRlY29yYXRpb24gfSksXG5cdFx0XHRcdFx0dmFsdWU6IHsgdXJpOiBwaWNrLnVyaSwgcmFuZ2U6IHBpY2sucmFuZ2UuZGVjb3JhdGlvbiB9LFxuXHRcdFx0XHRcdGZ1bGxOYW1lOiBwaWNrLmxhYmVsLFxuXHRcdFx0XHRcdG5hbWU6IHBpY2suc3ltYm9sTmFtZSEsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBlbHNlIGlmIChpc0lPcGVuRWRpdG9yc1F1aWNrUGlja0l0ZW0ocGljaykpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBlZGl0b3Igb2YgZWRpdG9yU2VydmljZS5lZGl0b3JzLmZpbHRlcihlID0+IGUgaW5zdGFuY2VvZiBGaWxlRWRpdG9ySW5wdXQgfHwgZSBpbnN0YW5jZW9mIERpZmZFZGl0b3JJbnB1dCB8fCBlIGluc3RhbmNlb2YgVW50aXRsZWRUZXh0RWRpdG9ySW5wdXQgfHwgZSBpbnN0YW5jZW9mIE5vdGVib29rRWRpdG9ySW5wdXQpKSB7XG5cdFx0XHRcdFx0Y29uc3QgdXJpID0gZWRpdG9yIGluc3RhbmNlb2YgRGlmZkVkaXRvcklucHV0ID8gZWRpdG9yLm1vZGlmaWVkLnJlc291cmNlIDogZWRpdG9yLnJlc291cmNlO1xuXHRcdFx0XHRcdGlmICh1cmkpIHtcblx0XHRcdFx0XHRcdHRvQXR0YWNoLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRpZDogdGhpcy5fZ2V0RmlsZUNvbnRleHRJZCh7IHJlc291cmNlOiB1cmkgfSksXG5cdFx0XHRcdFx0XHRcdHZhbHVlOiB1cmksXG5cdFx0XHRcdFx0XHRcdG5hbWU6IGxhYmVsU2VydmljZS5nZXRVcmlCYXNlbmFtZUxhYmVsKHVyaSksXG5cdFx0XHRcdFx0XHRcdGlzRmlsZTogdHJ1ZSxcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChpc0lTZWFyY2hSZXN1bHRzUXVpY2tQaWNrSXRlbShwaWNrKSkge1xuXHRcdFx0XHRjb25zdCBzZWFyY2hWaWV3ID0gdmlld3NTZXJ2aWNlLmdldFZpZXdXaXRoSWQoU0VBUkNIX1ZJRVdfSUQpIGFzIFNlYXJjaFZpZXc7XG5cdFx0XHRcdGZvciAoY29uc3QgcmVzdWx0IG9mIHNlYXJjaFZpZXcubW9kZWwuc2VhcmNoUmVzdWx0Lm1hdGNoZXMoKSkge1xuXHRcdFx0XHRcdHRvQXR0YWNoLnB1c2goe1xuXHRcdFx0XHRcdFx0aWQ6IHRoaXMuX2dldEZpbGVDb250ZXh0SWQoeyByZXNvdXJjZTogcmVzdWx0LnJlc291cmNlIH0pLFxuXHRcdFx0XHRcdFx0dmFsdWU6IHJlc3VsdC5yZXNvdXJjZSxcblx0XHRcdFx0XHRcdG5hbWU6IGxhYmVsU2VydmljZS5nZXRVcmlCYXNlbmFtZUxhYmVsKHJlc3VsdC5yZXNvdXJjZSksXG5cdFx0XHRcdFx0XHRpc0ZpbGU6IHRydWUsXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoaXNSZWxhdGVkRmlsZVF1aWNrUGlja0l0ZW0ocGljaykpIHtcblx0XHRcdFx0Ly8gR2V0IGFsbCBwcm92aWRlciByZXN1bHRzIGFuZCBzaG93IHRoZW0gaW4gYSBzZWNvbmQgdGllciBwaWNrZXJcblx0XHRcdFx0Y29uc3QgY2hhdFNlc3Npb25JZCA9IHdpZGdldC52aWV3TW9kZWw/LnNlc3Npb25JZDtcblx0XHRcdFx0aWYgKCFjaGF0U2Vzc2lvbklkIHx8ICFjaGF0RWRpdGluZ1NlcnZpY2UpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCByZWxhdGVkRmlsZXMgPSBhd2FpdCBjaGF0RWRpdGluZ1NlcnZpY2UuZ2V0UmVsYXRlZEZpbGVzKGNoYXRTZXNzaW9uSWQsIHdpZGdldC5nZXRJbnB1dCgpLCB3aWRnZXQuYXR0YWNobWVudE1vZGVsLmZpbGVBdHRhY2htZW50cywgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRcdGlmICghcmVsYXRlZEZpbGVzKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgYXR0YWNobWVudHMgPSB3aWRnZXQuYXR0YWNobWVudE1vZGVsLmdldEF0dGFjaG1lbnRJRHMoKTtcblx0XHRcdFx0Y29uc3QgaXRlbXNQcm9taXNlID0gY2hhdEVkaXRpbmdTZXJ2aWNlLmdldFJlbGF0ZWRGaWxlcyhjaGF0U2Vzc2lvbklkLCB3aWRnZXQuZ2V0SW5wdXQoKSwgd2lkZ2V0LmF0dGFjaG1lbnRNb2RlbC5maWxlQXR0YWNobWVudHMsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpXG5cdFx0XHRcdFx0LnRoZW4oKGZpbGVzKSA9PiAoZmlsZXMgPz8gW10pLnJlZHVjZTwoV2l0aFVyaVZhbHVlPElRdWlja1BpY2tJdGVtPiB8IElRdWlja1BpY2tTZXBhcmF0b3IpW10+KChhY2MsIGN1cikgPT4ge1xuXHRcdFx0XHRcdFx0YWNjLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IGN1ci5ncm91cCB9KTtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgZmlsZSBvZiBjdXIuZmlsZXMpIHtcblx0XHRcdFx0XHRcdFx0YWNjLnB1c2goe1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdpdGVtJyxcblx0XHRcdFx0XHRcdFx0XHRsYWJlbDogbGFiZWxTZXJ2aWNlLmdldFVyaUJhc2VuYW1lTGFiZWwoZmlsZS51cmkpLFxuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwoZGlybmFtZShmaWxlLnVyaSksIHsgcmVsYXRpdmU6IHRydWUgfSksXG5cdFx0XHRcdFx0XHRcdFx0dmFsdWU6IGZpbGUudXJpLFxuXHRcdFx0XHRcdFx0XHRcdGRpc2FibGVkOiBhdHRhY2htZW50cy5oYXModGhpcy5fZ2V0RmlsZUNvbnRleHRJZCh7IHJlc291cmNlOiBmaWxlLnVyaSB9KSksXG5cdFx0XHRcdFx0XHRcdFx0cGlja2VkOiB0cnVlXG5cdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIGFjYztcblx0XHRcdFx0XHR9LCBbXSkpO1xuXHRcdFx0XHRjb25zdCBzZWxlY3RlZEZpbGVzID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucGljayhpdGVtc1Byb21pc2UsIHsgcGxhY2VIb2xkZXI6IGxvY2FsaXplKCdyZWxhdGVkRmlsZXMnLCAnQWRkIHJlbGF0ZWQgZmlsZXMgdG8geW91ciB3b3JraW5nIHNldCcpLCBjYW5QaWNrTWFueTogdHJ1ZSB9KTtcblx0XHRcdFx0Zm9yIChjb25zdCBmaWxlIG9mIHNlbGVjdGVkRmlsZXMgPz8gW10pIHtcblx0XHRcdFx0XHR0b0F0dGFjaC5wdXNoKHtcblx0XHRcdFx0XHRcdGlkOiB0aGlzLl9nZXRGaWxlQ29udGV4dElkKHsgcmVzb3VyY2U6IGZpbGUudmFsdWUgfSksXG5cdFx0XHRcdFx0XHR2YWx1ZTogZmlsZS52YWx1ZSxcblx0XHRcdFx0XHRcdG5hbWU6IGZpbGUubGFiZWwsXG5cdFx0XHRcdFx0XHRpc0ZpbGU6IHRydWUsXG5cdFx0XHRcdFx0XHRpc09taXR0ZWQ6IGZhbHNlXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoaXNTY3JlZW5zaG90UXVpY2tQaWNrSXRlbShwaWNrKSkge1xuXHRcdFx0XHRjb25zdCBibG9iID0gYXdhaXQgaG9zdFNlcnZpY2UuZ2V0U2NyZWVuc2hvdCgpO1xuXHRcdFx0XHRpZiAoYmxvYikge1xuXHRcdFx0XHRcdHRvQXR0YWNoLnB1c2goY29udmVydEJ1ZmZlclRvU2NyZWVuc2hvdFZhcmlhYmxlKGJsb2IpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChpc1Byb21wdEluc3RydWN0aW9uc1F1aWNrUGlja0l0ZW0ocGljaykpIHtcblx0XHRcdFx0Y29uc3Qgb3B0aW9uczogSUNoYXRBdHRhY2hQcm9tcHRBY3Rpb25PcHRpb25zID0geyB3aWRnZXQgfTtcblx0XHRcdFx0YXdhaXQgY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoQVRUQUNIX1BST01QVF9BQ1RJT05fSUQsIG9wdGlvbnMpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gQW55dGhpbmcgZWxzZSBpcyBhbiBhdHRhY2htZW50XG5cdFx0XHRcdGNvbnN0IGF0dGFjaG1lbnRQaWNrID0gcGljayBhcyBJQXR0YWNobWVudFF1aWNrUGlja0l0ZW07XG5cdFx0XHRcdGlmIChhdHRhY2htZW50UGljay5raW5kID09PSAnY29tbWFuZCcpIHtcblx0XHRcdFx0XHQvLyBEeW5hbWljIHZhcmlhYmxlIHdpdGggYSBmb2xsb3d1cCBjb21tYW5kXG5cdFx0XHRcdFx0Y29uc3Qgc2VsZWN0aW9uID0gYXdhaXQgY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoYXR0YWNobWVudFBpY2suY29tbWFuZC5pZCwgLi4uKGF0dGFjaG1lbnRQaWNrLmNvbW1hbmQuYXJndW1lbnRzID8/IFtdKSk7XG5cdFx0XHRcdFx0aWYgKCFzZWxlY3Rpb24pIHtcblx0XHRcdFx0XHRcdC8vIFVzZXIgbWFkZSBubyBzZWxlY3Rpb24sIHNraXAgdGhpcyB2YXJpYWJsZVxuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRvQXR0YWNoLnB1c2goe1xuXHRcdFx0XHRcdFx0Li4uYXR0YWNobWVudFBpY2ssXG5cdFx0XHRcdFx0XHR2YWx1ZTogYXR0YWNobWVudFBpY2sudmFsdWUsXG5cdFx0XHRcdFx0XHRuYW1lOiBgJHt0eXBlb2YgYXR0YWNobWVudFBpY2sudmFsdWUgPT09ICdzdHJpbmcnICYmIGF0dGFjaG1lbnRQaWNrLnZhbHVlLnN0YXJ0c1dpdGgoJyMnKSA/IGF0dGFjaG1lbnRQaWNrLnZhbHVlLnNsaWNlKDEpIDogJyd9JHtzZWxlY3Rpb259YCxcblx0XHRcdFx0XHRcdC8vIEFwcGx5IHRoZSBvcmlnaW5hbCBpY29uIHdpdGggdGhlIG5ldyBuYW1lXG5cdFx0XHRcdFx0XHRmdWxsTmFtZTogc2VsZWN0aW9uXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoYXR0YWNobWVudFBpY2sua2luZCA9PT0gJ3Rvb2wnKSB7XG5cdFx0XHRcdFx0dG9BdHRhY2gucHVzaCh7XG5cdFx0XHRcdFx0XHRpZDogYXR0YWNobWVudFBpY2suaWQsXG5cdFx0XHRcdFx0XHRuYW1lOiBhdHRhY2htZW50UGljay5sYWJlbCxcblx0XHRcdFx0XHRcdGZ1bGxOYW1lOiBhdHRhY2htZW50UGljay5sYWJlbCxcblx0XHRcdFx0XHRcdHZhbHVlOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRpY29uOiBhdHRhY2htZW50UGljay5pY29uLFxuXHRcdFx0XHRcdFx0aXNUb29sOiB0cnVlXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoYXR0YWNobWVudFBpY2sua2luZCA9PT0gJ2ltYWdlJykge1xuXHRcdFx0XHRcdGNvbnN0IGZpbGVCdWZmZXIgPSBhd2FpdCBjbGlwYm9hcmRTZXJ2aWNlLnJlYWRJbWFnZSgpO1xuXHRcdFx0XHRcdHRvQXR0YWNoLnB1c2goe1xuXHRcdFx0XHRcdFx0aWQ6IGF3YWl0IGltYWdlVG9IYXNoKGZpbGVCdWZmZXIpLFxuXHRcdFx0XHRcdFx0bmFtZTogbG9jYWxpemUoJ3Bhc3RlZEltYWdlJywgJ1Bhc3RlZCBJbWFnZScpLFxuXHRcdFx0XHRcdFx0ZnVsbE5hbWU6IGxvY2FsaXplKCdwYXN0ZWRJbWFnZScsICdQYXN0ZWQgSW1hZ2UnKSxcblx0XHRcdFx0XHRcdHZhbHVlOiBmaWxlQnVmZmVyLFxuXHRcdFx0XHRcdFx0aXNJbWFnZTogdHJ1ZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0d2lkZ2V0LmF0dGFjaG1lbnRNb2RlbC5hZGRDb250ZXh0KC4uLnRvQXR0YWNoKTtcblx0XHRpZiAoIWlzSW5CYWNrZ3JvdW5kKSB7XG5cdFx0XHQvLyBTZXQgZm9jdXMgYmFjayBpbnRvIHRoZSBpbnB1dCBvbmNlIHRoZSB1c2VyIGlzIGRvbmUgYXR0YWNoaW5nIGl0ZW1zXG5cdFx0XHQvLyBzbyB0aGF0IHRoZSB1c2VyIGNhbiBzdGFydCB0eXBpbmcgdGhlaXIgbWVzc2FnZVxuXHRcdFx0d2lkZ2V0LmZvY3VzSW5wdXQoKTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRjb25zdCBjaGF0QWdlbnRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0QWdlbnRTZXJ2aWNlKTtcblx0XHRjb25zdCBjb21tYW5kU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpO1xuXHRcdGNvbnN0IHdpZGdldFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRXaWRnZXRTZXJ2aWNlKTtcblx0XHRjb25zdCBsYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlKTtcblx0XHRjb25zdCBxdWlja0NoYXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0NoYXRTZXJ2aWNlKTtcblx0XHRjb25zdCBjbGlwYm9hcmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDbGlwYm9hcmRTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBsYWJlbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxhYmVsU2VydmljZSk7XG5cdFx0Y29uc3QgY29udGV4dEtleVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRjb25zdCB2aWV3c1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSk7XG5cdFx0Y29uc3QgaG9zdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUhvc3RTZXJ2aWNlKTtcblx0XHRjb25zdCBleHRlbnNpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFeHRlbnNpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBmaWxlU2VydmljZSA9IGFjY2Vzc29yLmdldChJRmlsZVNlcnZpY2UpO1xuXHRcdGNvbnN0IHRleHRNb2RlbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVRleHRNb2RlbFNlcnZpY2UpO1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0Y29uc3Qga2V5YmluZGluZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUtleWJpbmRpbmdTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGNvbnRleHQ6IHsgd2lkZ2V0PzogSUNoYXRXaWRnZXQ7IHNob3dGaWxlc09ubHk/OiBib29sZWFuOyBwbGFjZWhvbGRlcj86IHN0cmluZyB9IHwgdW5kZWZpbmVkID0gYXJnc1swXTtcblx0XHRjb25zdCB3aWRnZXQgPSBjb250ZXh0Py53aWRnZXQgPz8gd2lkZ2V0U2VydmljZS5sYXN0Rm9jdXNlZFdpZGdldDtcblx0XHRpZiAoIXdpZGdldCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBjaGF0RWRpdGluZ1NlcnZpY2UgPSB3aWRnZXQubG9jYXRpb24gPT09IENoYXRBZ2VudExvY2F0aW9uLkVkaXRpbmdTZXNzaW9uIHx8IHdpZGdldC5pc1VuaWZpZWRQYW5lbFdpZGdldCA/IGFjY2Vzc29yLmdldChJQ2hhdEVkaXRpbmdTZXJ2aWNlKSA6IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IHF1aWNrUGlja0l0ZW1zOiBJQXR0YWNobWVudFF1aWNrUGlja0l0ZW1bXSA9IFtdO1xuXHRcdGlmIChleHRlbnNpb25TZXJ2aWNlLmV4dGVuc2lvbnMuc29tZShleHQgPT4gaXNQcm9wb3NlZEFwaUVuYWJsZWQoZXh0LCAnY2hhdFJlZmVyZW5jZUJpbmFyeURhdGEnKSkpIHtcblx0XHRcdGNvbnN0IGltYWdlRGF0YSA9IGF3YWl0IGNsaXBib2FyZFNlcnZpY2UucmVhZEltYWdlKCk7XG5cdFx0XHRpZiAoaXNJbWFnZShpbWFnZURhdGEpKSB7XG5cdFx0XHRcdHF1aWNrUGlja0l0ZW1zLnB1c2goe1xuXHRcdFx0XHRcdGtpbmQ6ICdpbWFnZScsXG5cdFx0XHRcdFx0aWQ6IGF3YWl0IGltYWdlVG9IYXNoKGltYWdlRGF0YSksXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdpbWFnZUZyb21DbGlwYm9hcmQnLCAnSW1hZ2UgZnJvbSBDbGlwYm9hcmQnKSxcblx0XHRcdFx0XHRpY29uQ2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLmZpbGVNZWRpYSksXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRxdWlja1BpY2tJdGVtcy5wdXNoKHtcblx0XHRcdFx0a2luZDogJ3NjcmVlbnNob3QnLFxuXHRcdFx0XHRpZDogU2NyZWVuc2hvdFZhcmlhYmxlSWQsXG5cdFx0XHRcdGljb246IFRoZW1lSWNvbi5mcm9tSWQoQ29kaWNvbi5kZXZpY2VDYW1lcmEuaWQpLFxuXHRcdFx0XHRpY29uQ2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLmRldmljZUNhbWVyYSksXG5cdFx0XHRcdGxhYmVsOiAoaXNFbGVjdHJvblxuXHRcdFx0XHRcdD8gbG9jYWxpemUoJ2NoYXRDb250ZXh0LmF0dGFjaFNjcmVlbnNob3QubGFiZWxFbGVjdHJvbi5XaW5kb3cnLCAnU2NyZWVuc2hvdCBXaW5kb3cnKVxuXHRcdFx0XHRcdDogbG9jYWxpemUoJ2NoYXRDb250ZXh0LmF0dGFjaFNjcmVlbnNob3QubGFiZWxXZWInLCAnU2NyZWVuc2hvdCcpKSxcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmICh3aWRnZXQudmlld01vZGVsPy5zZXNzaW9uSWQpIHtcblx0XHRcdGNvbnN0IGFnZW50UGFydCA9IHdpZGdldC5wYXJzZWRJbnB1dC5wYXJ0cy5maW5kKChwYXJ0KTogcGFydCBpcyBDaGF0UmVxdWVzdEFnZW50UGFydCA9PiBwYXJ0IGluc3RhbmNlb2YgQ2hhdFJlcXVlc3RBZ2VudFBhcnQpO1xuXHRcdFx0aWYgKGFnZW50UGFydCkge1xuXHRcdFx0XHRjb25zdCBjb21wbGV0aW9ucyA9IGF3YWl0IGNoYXRBZ2VudFNlcnZpY2UuZ2V0QWdlbnRDb21wbGV0aW9uSXRlbXMoYWdlbnRQYXJ0LmFnZW50LmlkLCAnJywgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRcdGZvciAoY29uc3QgdmFyaWFibGUgb2YgY29tcGxldGlvbnMpIHtcblx0XHRcdFx0XHRpZiAodmFyaWFibGUuZnVsbE5hbWUgJiYgdmFyaWFibGUuY29tbWFuZCkge1xuXHRcdFx0XHRcdFx0cXVpY2tQaWNrSXRlbXMucHVzaCh7XG5cdFx0XHRcdFx0XHRcdGtpbmQ6ICdjb21tYW5kJyxcblx0XHRcdFx0XHRcdFx0bGFiZWw6IHZhcmlhYmxlLmZ1bGxOYW1lLFxuXHRcdFx0XHRcdFx0XHRpZDogdmFyaWFibGUuaWQsXG5cdFx0XHRcdFx0XHRcdGNvbW1hbmQ6IHZhcmlhYmxlLmNvbW1hbmQsXG5cdFx0XHRcdFx0XHRcdGljb246IHZhcmlhYmxlLmljb24sXG5cdFx0XHRcdFx0XHRcdGljb25DbGFzczogdmFyaWFibGUuaWNvbiA/IFRoZW1lSWNvbi5hc0NsYXNzTmFtZSh2YXJpYWJsZS5pY29uKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0dmFsdWU6IHZhcmlhYmxlLnZhbHVlLFxuXHRcdFx0XHRcdFx0XHRuYW1lOiB2YXJpYWJsZS5uYW1lXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0Ly8gQ3VycmVudGx5IHRoZXJlJ3Mgbm90aGluZyB0aGF0IGZhbGxzIGludG8gdGhpcyBjYXRlZ29yeVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgdG9vbCBvZiBsYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlLmdldFRvb2xzKCkpIHtcblx0XHRcdGlmICh0b29sLmNhbkJlUmVmZXJlbmNlZEluUHJvbXB0KSB7XG5cdFx0XHRcdGNvbnN0IGl0ZW06IElUb29sUXVpY2tQaWNrSXRlbSA9IHtcblx0XHRcdFx0XHRraW5kOiAndG9vbCcsXG5cdFx0XHRcdFx0bGFiZWw6IHRvb2wuZGlzcGxheU5hbWUgPz8gJycsXG5cdFx0XHRcdFx0aWQ6IHRvb2wuaWQsXG5cdFx0XHRcdFx0aWNvbjogVGhlbWVJY29uLmlzVGhlbWVJY29uKHRvb2wuaWNvbikgPyB0b29sLmljb24gOiB1bmRlZmluZWQgLy8gVE9ETyBuZWVkIHRvIHN1cHBvcnQgaWNvbiBwYXRoP1xuXHRcdFx0XHR9O1xuXHRcdFx0XHRpZiAoVGhlbWVJY29uLmlzVGhlbWVJY29uKHRvb2wuaWNvbikpIHtcblx0XHRcdFx0XHRpdGVtLmljb25DbGFzcyA9IFRoZW1lSWNvbi5hc0NsYXNzTmFtZSh0b29sLmljb24pO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHRvb2wuaWNvbikge1xuXHRcdFx0XHRcdGl0ZW0uaWNvblBhdGggPSB0b29sLmljb247XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRxdWlja1BpY2tJdGVtcy5wdXNoKGl0ZW0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHF1aWNrUGlja0l0ZW1zLnB1c2goe1xuXHRcdFx0a2luZDogJ3F1aWNrYWNjZXNzJyxcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnY2hhdENvbnRleHQuc3ltYm9sJywgJ1N5bWJvbC4uLicpLFxuXHRcdFx0aWNvbkNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5zeW1ib2xGaWVsZCksXG5cdFx0XHRwcmVmaXg6IFN5bWJvbHNRdWlja0FjY2Vzc1Byb3ZpZGVyLlBSRUZJWCxcblx0XHRcdGlkOiAnc3ltYm9sJ1xuXHRcdH0pO1xuXG5cdFx0cXVpY2tQaWNrSXRlbXMucHVzaCh7XG5cdFx0XHRraW5kOiAnZm9sZGVyJyxcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnY2hhdENvbnRleHQuZm9sZGVyJywgJ0ZvbGRlci4uLicpLFxuXHRcdFx0aWNvbkNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5mb2xkZXIpLFxuXHRcdFx0aWQ6ICdmb2xkZXInLFxuXHRcdH0pO1xuXG5cdFx0cXVpY2tQaWNrSXRlbXMucHVzaCh7XG5cdFx0XHRraW5kOiAnZGlhZ25vc3RpYycsXG5cdFx0XHRsYWJlbDogbG9jYWxpemUoJ2NoYXRDb250ZXh0LmRpYWduc3RpYycsICdQcm9ibGVtLi4uJyksXG5cdFx0XHRpY29uQ2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLmVycm9yKSxcblx0XHRcdGlkOiAnZGlhZ25vc3RpYydcblx0XHR9KTtcblxuXHRcdGlmICh3aWRnZXQubG9jYXRpb24gPT09IENoYXRBZ2VudExvY2F0aW9uLk5vdGVib29rKSB7XG5cdFx0XHRxdWlja1BpY2tJdGVtcy5wdXNoKHtcblx0XHRcdFx0a2luZDogJ2NvbW1hbmQnLFxuXHRcdFx0XHRpZDogJ2NoYXRDb250ZXh0Lm5vdGVib29rLmtlcm5lbFZhcmlhYmxlJyxcblx0XHRcdFx0aWNvbjogVGhlbWVJY29uLmZyb21JZChDb2RpY29uLnNlcnZlckVudmlyb25tZW50LmlkKSxcblx0XHRcdFx0aWNvbkNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5zZXJ2ZXJFbnZpcm9ubWVudCksXG5cdFx0XHRcdHZhbHVlOiAna2VybmVsVmFyaWFibGUnLFxuXHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2NoYXRDb250ZXh0Lm5vdGVib29rLmtlcm5lbFZhcmlhYmxlJywgJ0tlcm5lbCBWYXJpYWJsZS4uLicpLFxuXHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0aWQ6ICdub3RlYm9vay5jaGF0LnNlbGVjdEFuZEluc2VydEtlcm5lbFZhcmlhYmxlJyxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2NoYXRDb250ZXh0Lm5vdGVib29rLnNlbGVjdGtlcm5lbFZhcmlhYmxlJywgJ1NlbGVjdCBhbmQgSW5zZXJ0IEtlcm5lbCBWYXJpYWJsZScpLFxuXHRcdFx0XHRcdGFyZ3VtZW50czogW3sgd2lkZ2V0LCByYW5nZTogdW5kZWZpbmVkIH1dXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGlmIChjb250ZXh0Py5zaG93RmlsZXNPbmx5KSB7XG5cdFx0XHRpZiAoY2hhdEVkaXRpbmdTZXJ2aWNlPy5oYXNSZWxhdGVkRmlsZXNQcm92aWRlcnMoKSAmJiAod2lkZ2V0LmdldElucHV0KCkgfHwgd2lkZ2V0LmF0dGFjaG1lbnRNb2RlbC5maWxlQXR0YWNobWVudHMubGVuZ3RoID4gMCkpIHtcblx0XHRcdFx0cXVpY2tQaWNrSXRlbXMudW5zaGlmdCh7XG5cdFx0XHRcdFx0a2luZDogJ3JlbGF0ZWQtZmlsZXMnLFxuXHRcdFx0XHRcdGlkOiAncmVsYXRlZC1maWxlcycsXG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdjaGF0Q29udGV4dC5yZWxhdGVkRmlsZXMnLCAnUmVsYXRlZCBGaWxlcycpLFxuXHRcdFx0XHRcdGljb25DbGFzczogVGhlbWVJY29uLmFzQ2xhc3NOYW1lKENvZGljb24uc3BhcmtsZSksXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGVkaXRvclNlcnZpY2UuZWRpdG9ycy5maWx0ZXIoZSA9PiBlIGluc3RhbmNlb2YgRmlsZUVkaXRvcklucHV0IHx8IGUgaW5zdGFuY2VvZiBEaWZmRWRpdG9ySW5wdXQgfHwgZSBpbnN0YW5jZW9mIFVudGl0bGVkVGV4dEVkaXRvcklucHV0KS5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdHF1aWNrUGlja0l0ZW1zLnVuc2hpZnQoe1xuXHRcdFx0XHRcdGtpbmQ6ICdvcGVuLWVkaXRvcnMnLFxuXHRcdFx0XHRcdGlkOiAnb3Blbi1lZGl0b3JzJyxcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2NoYXRDb250ZXh0LmVkaXRvcnMnLCAnT3BlbiBFZGl0b3JzJyksXG5cdFx0XHRcdFx0aWNvbkNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5maWxlcyksXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0aWYgKFNlYXJjaENvbnRleHQuSGFzU2VhcmNoUmVzdWx0cy5nZXRWYWx1ZShjb250ZXh0S2V5U2VydmljZSkpIHtcblx0XHRcdFx0cXVpY2tQaWNrSXRlbXMudW5zaGlmdCh7XG5cdFx0XHRcdFx0a2luZDogJ3NlYXJjaC1yZXN1bHRzJyxcblx0XHRcdFx0XHRpZDogJ3NlYXJjaC1yZXN1bHRzJyxcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2NoYXRDb250ZXh0LnNlYXJjaFJlc3VsdHMnLCAnU2VhcmNoIFJlc3VsdHMnKSxcblx0XHRcdFx0XHRpY29uQ2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShDb2RpY29uLnNlYXJjaCksXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIGlmIHRoZSBgcmV1c2FibGUgcHJvbXB0c2AgZmVhdHVyZSBpcyBlbmFibGVkLCBhZGRcblx0XHQvLyB0aGUgYXBwcm9wcmlhdGUgYXR0YWNobWVudCB0eXBlIHRvIHRoZSBsaXN0XG5cdFx0aWYgKHdpZGdldC5hdHRhY2htZW50TW9kZWwucHJvbXB0SW5zdHJ1Y3Rpb25zLmZlYXR1cmVFbmFibGVkKSB7XG5cdFx0XHRjb25zdCBrZXliaW5kaW5nID0ga2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhVU0VfUFJPTVBUX0NPTU1BTkRfSUQsIGNvbnRleHRLZXlTZXJ2aWNlKTtcblxuXHRcdFx0cXVpY2tQaWNrSXRlbXMucHVzaCh7XG5cdFx0XHRcdGlkOiBSRVVTQUJMRV9QUk9NUFRfUElDS19JRCxcblx0XHRcdFx0a2luZDogUkVVU0FCTEVfUFJPTVBUX1BJQ0tfSUQsXG5cdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnY2hhdENvbnRleHQuYXR0YWNoLnByb21wdC5sYWJlbCcsICdQcm9tcHQuLi4nKSxcblx0XHRcdFx0aWNvbkNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi5ib29rbWFyayksXG5cdFx0XHRcdGtleWJpbmRpbmcsXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBleHRyYWN0VGV4dEZyb21JY29uTGFiZWwobGFiZWw6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHN0cmluZyB7XG5cdFx0XHRpZiAoIWxhYmVsKSB7XG5cdFx0XHRcdHJldHVybiAnJztcblx0XHRcdH1cblx0XHRcdGNvbnN0IG1hdGNoID0gbGFiZWwubWF0Y2goL1xcJFxcKFteXFwpXStcXClcXHMqKC4rKS8pO1xuXHRcdFx0cmV0dXJuIG1hdGNoID8gbWF0Y2hbMV0gOiBsYWJlbDtcblx0XHR9XG5cblx0XHR0aGlzLl9zaG93KHF1aWNrSW5wdXRTZXJ2aWNlLCBjb21tYW5kU2VydmljZSwgd2lkZ2V0LCBxdWlja0NoYXRTZXJ2aWNlLCBxdWlja1BpY2tJdGVtcy5zb3J0KGZ1bmN0aW9uIChhLCBiKSB7XG5cblx0XHRcdGlmIChhLmtpbmQgPT09ICdvcGVuLWVkaXRvcnMnKSB7IHJldHVybiAtMTsgfVxuXHRcdFx0aWYgKGIua2luZCA9PT0gJ29wZW4tZWRpdG9ycycpIHsgcmV0dXJuIDE7IH1cblxuXHRcdFx0Y29uc3QgZmlyc3QgPSBleHRyYWN0VGV4dEZyb21JY29uTGFiZWwoYS5sYWJlbCkudG9VcHBlckNhc2UoKTtcblx0XHRcdGNvbnN0IHNlY29uZCA9IGV4dHJhY3RUZXh0RnJvbUljb25MYWJlbChiLmxhYmVsKS50b1VwcGVyQ2FzZSgpO1xuXG5cdFx0XHRyZXR1cm4gY29tcGFyZShmaXJzdCwgc2Vjb25kKTtcblx0XHR9KSwgY2xpcGJvYXJkU2VydmljZSwgZWRpdG9yU2VydmljZSwgbGFiZWxTZXJ2aWNlLCB2aWV3c1NlcnZpY2UsIGNoYXRFZGl0aW5nU2VydmljZSwgaG9zdFNlcnZpY2UsIGZpbGVTZXJ2aWNlLCB0ZXh0TW9kZWxTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgJycsIGNvbnRleHQ/LnBsYWNlaG9sZGVyKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3Nob3dEaWFnbm9zdGljc1BpY2soaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSwgb25CYWNrZ3JvdW5kQWNjZXB0OiAoaXRlbTogSUNoYXRDb250ZXh0UXVpY2tQaWNrSXRlbVtdKSA9PiB2b2lkKTogUHJvbWlzZTxJRGlhZ25vc3RpY3NRdWlja1BpY2tJdGVtV2l0aEZpbHRlciB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGNvbnZlcnQgPSAoaXRlbTogSURpYWdub3N0aWNWYXJpYWJsZUVudHJ5RmlsdGVyRGF0YSk6IElEaWFnbm9zdGljc1F1aWNrUGlja0l0ZW1XaXRoRmlsdGVyID0+ICh7XG5cdFx0XHRraW5kOiAnZGlhZ25vc3RpYy1maWx0ZXInLFxuXHRcdFx0aWQ6IElEaWFnbm9zdGljVmFyaWFibGVFbnRyeUZpbHRlckRhdGEuaWQoaXRlbSksXG5cdFx0XHRsYWJlbDogSURpYWdub3N0aWNWYXJpYWJsZUVudHJ5RmlsdGVyRGF0YS5sYWJlbChpdGVtKSxcblx0XHRcdGljb246IElEaWFnbm9zdGljVmFyaWFibGVFbnRyeUZpbHRlckRhdGEuaWNvbixcblx0XHRcdGZpbHRlcjogaXRlbSxcblx0XHR9KTtcblxuXHRcdGNvbnN0IGZpbHRlciA9IGF3YWl0IGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+XG5cdFx0XHRjcmVhdGVNYXJrZXJzUXVpY2tQaWNrKGFjY2Vzc29yLCAncHJvYmxlbScsIGl0ZW1zID0+IG9uQmFja2dyb3VuZEFjY2VwdChpdGVtcy5tYXAoY29udmVydCkpKSk7XG5cdFx0cmV0dXJuIGZpbHRlciAmJiBjb252ZXJ0KGZpbHRlcik7XG5cdH1cblxuXHRwcml2YXRlIF9zaG93KHF1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsIGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsIHdpZGdldDogSUNoYXRXaWRnZXQsIHF1aWNrQ2hhdFNlcnZpY2U6IElRdWlja0NoYXRTZXJ2aWNlLCBxdWlja1BpY2tJdGVtczogKElDaGF0Q29udGV4dFF1aWNrUGlja0l0ZW0gfCBRdWlja1BpY2tJdGVtKVtdIHwgdW5kZWZpbmVkLCBjbGlwYm9hcmRTZXJ2aWNlOiBJQ2xpcGJvYXJkU2VydmljZSwgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsIGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSwgdmlld3NTZXJ2aWNlOiBJVmlld3NTZXJ2aWNlLCBjaGF0RWRpdGluZ1NlcnZpY2U6IElDaGF0RWRpdGluZ1NlcnZpY2UgfCB1bmRlZmluZWQsIGhvc3RTZXJ2aWNlOiBJSG9zdFNlcnZpY2UsIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsIHRleHRNb2RlbFNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBxdWVyeTogc3RyaW5nID0gJycsIHBsYWNlaG9sZGVyPzogc3RyaW5nKSB7XG5cdFx0Y29uc3QgYXR0YWNoID0gKGlzQmFja2dyb3VuZEFjY2VwdDogYm9vbGVhbiwgLi4uaXRlbXM6IElDaGF0Q29udGV4dFF1aWNrUGlja0l0ZW1bXSkgPT4ge1xuXHRcdFx0dGhpcy5fYXR0YWNoQ29udGV4dCh3aWRnZXQsIHF1aWNrSW5wdXRTZXJ2aWNlLCBjb21tYW5kU2VydmljZSwgY2xpcGJvYXJkU2VydmljZSwgZWRpdG9yU2VydmljZSwgbGFiZWxTZXJ2aWNlLCB2aWV3c1NlcnZpY2UsIGNoYXRFZGl0aW5nU2VydmljZSwgaG9zdFNlcnZpY2UsIGZpbGVTZXJ2aWNlLCB0ZXh0TW9kZWxTZXJ2aWNlLCBpc0JhY2tncm91bmRBY2NlcHQsIC4uLml0ZW1zKTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgcHJvdmlkZXJPcHRpb25zOiBBbnl0aGluZ1F1aWNrQWNjZXNzUHJvdmlkZXJSdW5PcHRpb25zID0ge1xuXHRcdFx0aGFuZGxlQWNjZXB0OiBhc3luYyAoaW5wdXRJdGVtOiBJQ2hhdENvbnRleHRRdWlja1BpY2tJdGVtLCBpc0JhY2tncm91bmRBY2NlcHQ6IGJvb2xlYW4pID0+IHtcblx0XHRcdFx0bGV0IGl0ZW06IElDaGF0Q29udGV4dFF1aWNrUGlja0l0ZW0gfCB1bmRlZmluZWQgPSBpbnB1dEl0ZW07XG5cdFx0XHRcdGlmICgna2luZCcgaW4gaXRlbSAmJiBpdGVtLmtpbmQgPT09ICdmb2xkZXInKSB7XG5cdFx0XHRcdFx0aXRlbSA9IGF3YWl0IHRoaXMuX3Nob3dGb2xkZXJzKGluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRcdFx0fSBlbHNlIGlmICgna2luZCcgaW4gaXRlbSAmJiBpdGVtLmtpbmQgPT09ICdkaWFnbm9zdGljJykge1xuXHRcdFx0XHRcdGl0ZW0gPSBhd2FpdCB0aGlzLl9zaG93RGlhZ25vc3RpY3NQaWNrKGluc3RhbnRpYXRpb25TZXJ2aWNlLCBpID0+IGF0dGFjaCh0cnVlLCAuLi5pKSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoIWl0ZW0pIHtcblx0XHRcdFx0XHR0aGlzLl9zaG93KHF1aWNrSW5wdXRTZXJ2aWNlLCBjb21tYW5kU2VydmljZSwgd2lkZ2V0LCBxdWlja0NoYXRTZXJ2aWNlLCBxdWlja1BpY2tJdGVtcywgY2xpcGJvYXJkU2VydmljZSwgZWRpdG9yU2VydmljZSwgbGFiZWxTZXJ2aWNlLCB2aWV3c1NlcnZpY2UsIGNoYXRFZGl0aW5nU2VydmljZSwgaG9zdFNlcnZpY2UsIGZpbGVTZXJ2aWNlLCB0ZXh0TW9kZWxTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgJycsIHBsYWNlaG9sZGVyKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoJ3ByZWZpeCcgaW4gaXRlbSkge1xuXHRcdFx0XHRcdHRoaXMuX3Nob3cocXVpY2tJbnB1dFNlcnZpY2UsIGNvbW1hbmRTZXJ2aWNlLCB3aWRnZXQsIHF1aWNrQ2hhdFNlcnZpY2UsIHF1aWNrUGlja0l0ZW1zLCBjbGlwYm9hcmRTZXJ2aWNlLCBlZGl0b3JTZXJ2aWNlLCBsYWJlbFNlcnZpY2UsIHZpZXdzU2VydmljZSwgY2hhdEVkaXRpbmdTZXJ2aWNlLCBob3N0U2VydmljZSwgZmlsZVNlcnZpY2UsIHRleHRNb2RlbFNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBpdGVtLnByZWZpeCwgcGxhY2Vob2xkZXIpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmICghY2xpcGJvYXJkU2VydmljZSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRhdHRhY2goaXNCYWNrZ3JvdW5kQWNjZXB0LCBpdGVtKTtcblx0XHRcdFx0XHRpZiAoaXNRdWlja0NoYXQod2lkZ2V0KSkge1xuXHRcdFx0XHRcdFx0cXVpY2tDaGF0U2VydmljZS5vcGVuKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YWRkaXRpb25QaWNrczogcXVpY2tQaWNrSXRlbXMsXG5cdFx0XHRmaWx0ZXI6IChpdGVtOiBJQ2hhdENvbnRleHRRdWlja1BpY2tJdGVtIHwgSVF1aWNrUGlja1NlcGFyYXRvcikgPT4ge1xuXHRcdFx0XHQvLyBBdm9pZCBhdHRhY2hpbmcgdGhlIHNhbWUgY29udGV4dCB0d2ljZVxuXHRcdFx0XHRjb25zdCBhdHRhY2hlZENvbnRleHQgPSB3aWRnZXQuYXR0YWNobWVudE1vZGVsLmdldEF0dGFjaG1lbnRJRHMoKTtcblxuXHRcdFx0XHRpZiAoaXNJT3BlbkVkaXRvcnNRdWlja1BpY2tJdGVtKGl0ZW0pKSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBlZGl0b3Igb2YgZWRpdG9yU2VydmljZS5lZGl0b3JzLmZpbHRlcihlID0+IGUgaW5zdGFuY2VvZiBGaWxlRWRpdG9ySW5wdXQgfHwgZSBpbnN0YW5jZW9mIERpZmZFZGl0b3JJbnB1dCB8fCBlIGluc3RhbmNlb2YgVW50aXRsZWRUZXh0RWRpdG9ySW5wdXQpKSB7XG5cdFx0XHRcdFx0XHQvLyBUaGVyZSBpcyBhbiBvcGVuIGVkaXRvciB0aGF0IGhhc24ndCB5ZXQgYmVlbiBhdHRhY2hlZCB0byB0aGUgY2hhdFxuXHRcdFx0XHRcdFx0aWYgKGVkaXRvci5yZXNvdXJjZSAmJiAhYXR0YWNoZWRDb250ZXh0Lmhhcyh0aGlzLl9nZXRGaWxlQ29udGV4dElkKHsgcmVzb3VyY2U6IGVkaXRvci5yZXNvdXJjZSB9KSkpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICgna2luZCcgaW4gaXRlbSAmJiBpdGVtLmtpbmQgPT09ICdpbWFnZScpIHtcblx0XHRcdFx0XHRyZXR1cm4gIWF0dGFjaGVkQ29udGV4dC5oYXMoaXRlbS5pZCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoJ3N5bWJvbCcgaW4gaXRlbSAmJiBpdGVtLnN5bWJvbCkge1xuXHRcdFx0XHRcdHJldHVybiAhYXR0YWNoZWRDb250ZXh0Lmhhcyh0aGlzLl9nZXRGaWxlQ29udGV4dElkKGl0ZW0uc3ltYm9sLmxvY2F0aW9uKSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoaXRlbSAmJiB0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcgJiYgJ3Jlc291cmNlJyBpbiBpdGVtICYmIFVSSS5pc1VyaShpdGVtLnJlc291cmNlKSkge1xuXHRcdFx0XHRcdHJldHVybiBbU2NoZW1hcy5maWxlLCBTY2hlbWFzLnZzY29kZVJlbW90ZSwgU2NoZW1hcy51bnRpdGxlZF0uaW5jbHVkZXMoaXRlbS5yZXNvdXJjZS5zY2hlbWUpXG5cdFx0XHRcdFx0XHQmJiAhYXR0YWNoZWRDb250ZXh0Lmhhcyh0aGlzLl9nZXRGaWxlQ29udGV4dElkKHsgcmVzb3VyY2U6IGl0ZW0ucmVzb3VyY2UgfSkpOyAvLyBIYWNrIGJlY2F1c2UgVHlwZXNjcmlwdCBkb2Vzbid0IG5hcnJvdyB0aGlzIHR5cGUgY29ycmVjdGx5XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoaXRlbSAmJiB0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcgJiYgJ3VyaScgaW4gaXRlbSAmJiBpdGVtLnVyaSAmJiBpdGVtLnJhbmdlKSB7XG5cdFx0XHRcdFx0cmV0dXJuICFhdHRhY2hlZENvbnRleHQuaGFzKHRoaXMuX2dldEZpbGVDb250ZXh0SWQoeyB1cmk6IGl0ZW0udXJpLCByYW5nZTogaXRlbS5yYW5nZS5kZWNvcmF0aW9uIH0pKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmICghKCdjb21tYW5kJyBpbiBpdGVtKSAmJiBpdGVtLmlkKSB7XG5cdFx0XHRcdFx0cmV0dXJuICFhdHRhY2hlZENvbnRleHQuaGFzKGl0ZW0uaWQpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gRG9uJ3QgZmlsdGVyIG91dCBkeW5hbWljIHZhcmlhYmxlcyB3aGljaCBzaG93IHNlY29uZGFyeSBkYXRhICh0ZW1wb3JhcnkpXG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0cXVpY2tJbnB1dFNlcnZpY2UucXVpY2tBY2Nlc3Muc2hvdyhxdWVyeSwge1xuXHRcdFx0ZW5hYmxlZFByb3ZpZGVyUHJlZml4ZXM6IFtcblx0XHRcdFx0QW55dGhpbmdRdWlja0FjY2Vzc1Byb3ZpZGVyLlBSRUZJWCxcblx0XHRcdFx0U3ltYm9sc1F1aWNrQWNjZXNzUHJvdmlkZXIuUFJFRklYLFxuXHRcdFx0XHRBYnN0cmFjdEdvdG9TeW1ib2xRdWlja0FjY2Vzc1Byb3ZpZGVyLlBSRUZJWFxuXHRcdFx0XSxcblx0XHRcdHBsYWNlaG9sZGVyOiBwbGFjZWhvbGRlciA/PyBsb2NhbGl6ZSgnY2hhdENvbnRleHQuYXR0YWNoLnBsYWNlaG9sZGVyJywgJ1NlYXJjaCBhdHRhY2htZW50cycpLFxuXHRcdFx0cHJvdmlkZXJPcHRpb25zLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfc2hvd0ZvbGRlcnMoaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSk6IFByb21pc2U8SUZvbGRlclJlc3VsdFF1aWNrUGlja0l0ZW0gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBmb2xkZXIgPSBhd2FpdCBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBjcmVhdGVGb2xkZXJRdWlja1BpY2soYWNjZXNzb3IpKTtcblx0XHRpZiAoIWZvbGRlcikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0a2luZDogJ2ZvbGRlci1zZWFyY2gtcmVzdWx0Jyxcblx0XHRcdGlkOiBmb2xkZXIudG9TdHJpbmcoKSxcblx0XHRcdGxhYmVsOiBiYXNlbmFtZShmb2xkZXIpLFxuXHRcdFx0cmVzb3VyY2U6IGZvbGRlcixcblx0XHR9O1xuXHR9XG59XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBBdHRhY2hGaWxlc0FjdGlvbiBleHRlbmRzIEF0dGFjaENvbnRleHRBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC5lZGl0aW5nLmF0dGFjaENvbnRleHQnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi5jaGF0LmVkaXRpbmcuYXR0YWNoQ29udGV4dC5sYWJlbCcsIFwiQWRkIENvbnRleHQgdG8gQ29waWxvdCBFZGl0c1wiKSxcblx0XHRcdHNob3J0VGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi5jaGF0LmVkaXRpbmcuYXR0YWNoQ29udGV4dC5zaG9ydExhYmVsJywgXCJBZGQgQ29udGV4dC4uLlwiKSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHR3aGVuOiBDaGF0Q29udGV4dEtleUV4cHJzLmluRWRpdHNPclVuaWZpZWQsXG5cdFx0XHRcdGlkOiBNZW51SWQuQ2hhdElucHV0QXR0YWNobWVudFRvb2xiYXIsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiAzXG5cdFx0XHR9LFxuXHRcdFx0aWNvbjogQ29kaWNvbi5hdHRhY2gsXG5cdFx0XHRwcmVjb25kaXRpb246IENoYXRDb250ZXh0S2V5RXhwcnMuaW5FZGl0c09yVW5pZmllZCxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENoYXRDb250ZXh0S2V5cy5pbkNoYXRJbnB1dCwgQ2hhdENvbnRleHRLZXlFeHBycy5pbkVkaXRzT3JVbmlmaWVkKSxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLlNsYXNoLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYlxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbnRleHQgPSBhcmdzWzBdO1xuXHRcdGNvbnN0IGF0dGFjaEZpbGVzQ29udGV4dCA9IHsgLi4uY29udGV4dCwgc2hvd0ZpbGVzT25seTogdHJ1ZSB9O1xuXHRcdHJldHVybiBzdXBlci5ydW4oYWNjZXNzb3IsIGF0dGFjaEZpbGVzQ29udGV4dCk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoQXR0YWNoUHJvbXB0QWN0aW9uKTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZUFBZTtBQUV4QixTQUFTLFNBQVMsY0FBYztBQUNoQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxVQUFVLGVBQWU7QUFDbEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsaUJBQWlCO0FBRTFCLFNBQVMsV0FBVztBQUVwQixTQUFpQixhQUFhO0FBRTlCLFNBQVMseUJBQXlC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
