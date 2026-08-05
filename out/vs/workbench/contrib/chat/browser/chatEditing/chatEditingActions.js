var _a, _b;
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { basename } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { isCodeEditor } from "../../../../../editor/browser/editorBrowser.js";
import { Position } from "../../../../../editor/common/core/position.js";
import { EditorContextKeys } from "../../../../../editor/common/editorContextKeys.js";
import { isLocation } from "../../../../../editor/common/languages.js";
import { ILanguageFeaturesService } from "../../../../../editor/common/services/languageFeatures.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { localize, localize2 } from "../../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { EditorActivation } from "../../../../../platform/editor/common/editor.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IListService } from "../../../../../platform/list/browser/listService.js";
import { GroupsOrder, IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { isChatViewTitleActionContext } from "../../common/chatActions.js";
import { ChatContextKeys } from "../../common/chatContextKeys.js";
import { applyingChatEditsFailedContextKey, CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME, chatEditingResourceContextKey, chatEditingWidgetFileStateContextKey, decidedChatEditingResourceContextKey, hasAppliedChatEditsContextKey, hasUndecidedChatEditingResourceContextKey, IChatEditingService, WorkingSetEntryRemovalReason, WorkingSetEntryState } from "../../common/chatEditingService.js";
import { IChatService } from "../../common/chatService.js";
import { isRequestVM, isResponseVM } from "../../common/chatViewModel.js";
import { ChatAgentLocation, ChatMode } from "../../common/constants.js";
import { CHAT_CATEGORY } from "../actions/chatActions.js";
import { IChatWidgetService } from "../chat.js";
class EditingSessionAction extends Action2 {
  constructor(opts) {
    super({
      category: CHAT_CATEGORY,
      ...opts
    });
  }
  run(accessor, ...args) {
    const context = getEditingSessionContext(accessor, args);
    if (!context || !context.editingSession) {
      return;
    }
    return this.runEditingSessionAction(accessor, context.editingSession, context.chatWidget, ...args);
  }
}
function getEditingSessionContext(accessor, args) {
  const arg0 = args.at(0);
  const context = isChatViewTitleActionContext(arg0) ? arg0 : void 0;
  const chatService = accessor.get(IChatService);
  const chatWidgetService = accessor.get(IChatWidgetService);
  const chatEditingService = accessor.get(IChatEditingService);
  let chatWidget = context ? chatWidgetService.getWidgetBySessionId(context.sessionId) : void 0;
  if (!chatWidget) {
    if (chatService.unifiedViewEnabled) {
      chatWidget = chatWidgetService.lastFocusedWidget ?? chatWidgetService.getWidgetsByLocations(ChatAgentLocation.Panel).find((w) => w.isUnifiedPanelWidget);
    } else {
      chatWidget = chatWidgetService.getWidgetsByLocations(ChatAgentLocation.EditingSession).at(0);
    }
  }
  if (!chatWidget?.viewModel) {
    return;
  }
  const chatSessionId = chatWidget.viewModel.model.sessionId;
  const editingSession = chatEditingService.getEditingSession(chatSessionId);
  if (!editingSession) {
    return;
  }
  return { editingSession, chatWidget };
}
class WorkingSetAction extends EditingSessionAction {
  runEditingSessionAction(accessor, editingSession, chatWidget, ...args) {
    const uris = [];
    if (URI.isUri(args[0])) {
      uris.push(args[0]);
    } else if (chatWidget) {
      uris.push(...chatWidget.input.selectedElements);
    }
    if (!uris.length) {
      return;
    }
    return this.runWorkingSetAction(accessor, editingSession, chatWidget, ...uris);
  }
}
registerAction2(class RemoveFileFromWorkingSet extends WorkingSetAction {
  constructor() {
    super({
      id: "chatEditing.removeFileFromWorkingSet",
      title: localize2("removeFileFromWorkingSet", "Remove File"),
      icon: Codicon.close,
      precondition: ChatContextKeys.requestInProgress.negate(),
      menu: [{
        id: MenuId.ChatEditingWidgetModifiedFilesToolbar,
        // when: ContextKeyExpr.or(ContextKeyExpr.equals(chatEditingWidgetFileStateContextKey.key, WorkingSetEntryState.Attached), ContextKeyExpr.equals(chatEditingWidgetFileStateContextKey.key, WorkingSetEntryState.Suggested), ContextKeyExpr.equals(chatEditingWidgetFileStateContextKey.key, WorkingSetEntryState.Transient)),
        order: 5,
        group: "navigation"
      }]
    });
  }
  async runWorkingSetAction(accessor, currentEditingSession, chatWidget, ...uris) {
    const dialogService = accessor.get(IDialogService);
    const pendingEntries = currentEditingSession.entries.get().filter((entry) => uris.includes(entry.modifiedURI) && entry.state.get() === WorkingSetEntryState.Modified);
    if (pendingEntries.length > 0) {
      const file = pendingEntries.length > 1 ? localize("chat.editing.removeFile.confirmationmanyFiles", "{0} files", pendingEntries.length) : basename(pendingEntries[0].modifiedURI);
      const confirmation = await dialogService.confirm({
        title: localize("chat.editing.removeFile.confirmation.title", "Remove {0} from working set?", file),
        message: localize("chat.editing.removeFile.confirmation.message", "This will remove {0} from your working set and undo the edits made to it. Do you want to proceed?", file),
        primaryButton: localize("chat.editing.removeFile.confirmation.primaryButton", "Yes"),
        type: "info"
      });
      if (!confirmation.confirmed) {
        return;
      }
    }
    await currentEditingSession.reject(...uris);
    currentEditingSession.remove(WorkingSetEntryRemovalReason.User, ...uris);
    for (const uri of uris) {
      chatWidget.attachmentModel.delete(uri.toString());
    }
    if (chatWidget.attachmentModel.fileAttachments.length === 0) {
      chatWidget.input.relatedFiles?.clear();
    }
  }
});
registerAction2(class OpenFileInDiffAction extends WorkingSetAction {
  constructor() {
    super({
      id: "chatEditing.openFileInDiff",
      title: localize2("open.fileInDiff", "Open Changes in Diff Editor"),
      icon: Codicon.diffSingle,
      menu: [{
        id: MenuId.ChatEditingWidgetModifiedFilesToolbar,
        when: ContextKeyExpr.equals(chatEditingWidgetFileStateContextKey.key, WorkingSetEntryState.Modified),
        order: 2,
        group: "navigation"
      }]
    });
  }
  async runWorkingSetAction(accessor, currentEditingSession, _chatWidget, ...uris) {
    const editorService = accessor.get(IEditorService);
    for (const uri of uris) {
      const editedFile = currentEditingSession.getEntry(uri);
      if (editedFile?.state.get() === WorkingSetEntryState.Modified) {
        await editorService.openEditor({
          original: { resource: URI.from(editedFile.originalURI, true) },
          modified: { resource: URI.from(editedFile.modifiedURI, true) }
        });
      } else {
        await editorService.openEditor({ resource: uri });
      }
    }
  }
});
registerAction2(class AcceptAction extends WorkingSetAction {
  constructor() {
    super({
      id: "chatEditing.acceptFile",
      title: localize2("accept.file", "Keep"),
      icon: Codicon.check,
      precondition: ChatContextKeys.requestInProgress.negate(),
      menu: [{
        when: ContextKeyExpr.and(ContextKeyExpr.equals("resourceScheme", CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME), ContextKeyExpr.notIn(chatEditingResourceContextKey.key, decidedChatEditingResourceContextKey.key)),
        id: MenuId.MultiDiffEditorFileToolbar,
        order: 0,
        group: "navigation"
      }, {
        id: MenuId.ChatEditingWidgetModifiedFilesToolbar,
        when: ContextKeyExpr.equals(chatEditingWidgetFileStateContextKey.key, WorkingSetEntryState.Modified),
        order: 0,
        group: "navigation"
      }]
    });
  }
  async runWorkingSetAction(accessor, currentEditingSession, chatWidget, ...uris) {
    await currentEditingSession.accept(...uris);
  }
});
registerAction2(class DiscardAction extends WorkingSetAction {
  constructor() {
    super({
      id: "chatEditing.discardFile",
      title: localize2("discard.file", "Undo"),
      icon: Codicon.discard,
      precondition: ChatContextKeys.requestInProgress.negate(),
      menu: [{
        when: ContextKeyExpr.and(ContextKeyExpr.equals("resourceScheme", CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME), ContextKeyExpr.notIn(chatEditingResourceContextKey.key, decidedChatEditingResourceContextKey.key)),
        id: MenuId.MultiDiffEditorFileToolbar,
        order: 2,
        group: "navigation"
      }, {
        id: MenuId.ChatEditingWidgetModifiedFilesToolbar,
        when: ContextKeyExpr.equals(chatEditingWidgetFileStateContextKey.key, WorkingSetEntryState.Modified),
        order: 1,
        group: "navigation"
      }]
    });
  }
  async runWorkingSetAction(accessor, currentEditingSession, chatWidget, ...uris) {
    await currentEditingSession.reject(...uris);
  }
});
class ChatEditingAcceptAllAction extends EditingSessionAction {
  constructor() {
    super({
      id: "chatEditing.acceptAllFiles",
      title: localize("accept", "Keep"),
      icon: Codicon.check,
      tooltip: localize("acceptAllEdits", "Keep All Edits"),
      precondition: ContextKeyExpr.and(ChatContextKeys.requestInProgress.negate(), hasUndecidedChatEditingResourceContextKey),
      keybinding: {
        primary: KeyMod.CtrlCmd | KeyCode.Enter,
        when: ContextKeyExpr.and(ChatContextKeys.requestInProgress.negate(), hasUndecidedChatEditingResourceContextKey, ChatContextKeys.inChatInput),
        weight: KeybindingWeight.WorkbenchContrib
      },
      menu: [
        {
          id: MenuId.ChatEditingWidgetToolbar,
          group: "navigation",
          order: 0,
          when: ContextKeyExpr.and(applyingChatEditsFailedContextKey.negate(), ContextKeyExpr.and(hasUndecidedChatEditingResourceContextKey))
        }
      ]
    });
  }
  async runEditingSessionAction(accessor, editingSession, chatWidget, ...args) {
    await editingSession.accept();
  }
}
registerAction2(ChatEditingAcceptAllAction);
class ChatEditingDiscardAllAction extends EditingSessionAction {
  constructor() {
    super({
      id: "chatEditing.discardAllFiles",
      title: localize("discard", "Undo"),
      icon: Codicon.discard,
      tooltip: localize("discardAllEdits", "Undo All Edits"),
      precondition: ContextKeyExpr.and(ChatContextKeys.requestInProgress.negate(), hasUndecidedChatEditingResourceContextKey),
      menu: [
        {
          id: MenuId.ChatEditingWidgetToolbar,
          group: "navigation",
          order: 1,
          when: ContextKeyExpr.and(applyingChatEditsFailedContextKey.negate(), hasUndecidedChatEditingResourceContextKey)
        }
      ],
      keybinding: {
        when: ContextKeyExpr.and(ChatContextKeys.requestInProgress.negate(), hasUndecidedChatEditingResourceContextKey, ChatContextKeys.inChatInput, ChatContextKeys.inputHasText.negate()),
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.CtrlCmd | KeyCode.Backspace
      }
    });
  }
  async runEditingSessionAction(accessor, editingSession, chatWidget, ...args) {
    await discardAllEditsWithConfirmation(accessor, editingSession);
  }
}
registerAction2(ChatEditingDiscardAllAction);
async function discardAllEditsWithConfirmation(accessor, currentEditingSession) {
  const dialogService = accessor.get(IDialogService);
  const entries = currentEditingSession.entries.get();
  if (entries.length > 0) {
    const confirmation = await dialogService.confirm({
      title: localize("chat.editing.discardAll.confirmation.title", "Undo all edits?"),
      message: entries.length === 1 ? localize("chat.editing.discardAll.confirmation.oneFile", "This will undo changes made by {0} in {1}. Do you want to proceed?", "Copilot Edits", basename(entries[0].modifiedURI)) : localize("chat.editing.discardAll.confirmation.manyFiles", "This will undo changes made by {0} in {1} files. Do you want to proceed?", "Copilot Edits", entries.length),
      primaryButton: localize("chat.editing.discardAll.confirmation.primaryButton", "Yes"),
      type: "info"
    });
    if (!confirmation.confirmed) {
      return false;
    }
  }
  await currentEditingSession.reject();
  return true;
}
const _ChatEditingRemoveAllFilesAction = class _ChatEditingRemoveAllFilesAction extends EditingSessionAction {
  constructor() {
    super({
      id: _ChatEditingRemoveAllFilesAction.ID,
      title: localize("clearWorkingSet", "Clear Working Set"),
      icon: Codicon.clearAll,
      tooltip: localize("clearWorkingSet", "Clear Working Set"),
      precondition: ContextKeyExpr.and(ChatContextKeys.requestInProgress.negate()),
      menu: [
        {
          id: MenuId.ChatEditingWidgetToolbar,
          group: "navigation",
          order: 5,
          when: hasAppliedChatEditsContextKey.negate()
        }
      ]
    });
  }
  async runEditingSessionAction(accessor, editingSession, chatWidget, ...args) {
    const uris = [...editingSession.entries.get()].map((e) => e.modifiedURI);
    editingSession.remove(WorkingSetEntryRemovalReason.User, ...uris);
    const fileAttachments = chatWidget.attachmentModel ? chatWidget.attachmentModel.fileAttachments : [];
    const attachmentIdsToRemove = fileAttachments.map((attachment) => attachment.toString());
    chatWidget.attachmentModel.delete(...attachmentIdsToRemove);
  }
};
_ChatEditingRemoveAllFilesAction.ID = "chatEditing.clearWorkingSet";
let ChatEditingRemoveAllFilesAction = _ChatEditingRemoveAllFilesAction;
registerAction2(ChatEditingRemoveAllFilesAction);
const _ChatEditingShowChangesAction = class _ChatEditingShowChangesAction extends EditingSessionAction {
  constructor() {
    super({
      id: _ChatEditingShowChangesAction.ID,
      title: _ChatEditingShowChangesAction.LABEL,
      tooltip: _ChatEditingShowChangesAction.LABEL,
      f1: false,
      icon: Codicon.diffMultiple,
      precondition: hasUndecidedChatEditingResourceContextKey,
      menu: [
        {
          id: MenuId.ChatEditingWidgetToolbar,
          group: "navigation",
          order: 4,
          when: ContextKeyExpr.and(applyingChatEditsFailedContextKey.negate(), ContextKeyExpr.and(hasAppliedChatEditsContextKey, hasUndecidedChatEditingResourceContextKey))
        }
      ]
    });
  }
  async runEditingSessionAction(accessor, editingSession, chatWidget, ...args) {
    await editingSession.show();
  }
};
_ChatEditingShowChangesAction.ID = "chatEditing.viewChanges";
_ChatEditingShowChangesAction.LABEL = localize("chatEditing.viewChanges", "View All Edits");
let ChatEditingShowChangesAction = _ChatEditingShowChangesAction;
registerAction2(ChatEditingShowChangesAction);
registerAction2(class AddFilesToWorkingSetAction extends EditingSessionAction {
  constructor() {
    super({
      id: "workbench.action.chat.addSelectedFilesToWorkingSet",
      title: localize2("workbench.action.chat.addSelectedFilesToWorkingSet.label", "Add Selected Files to Working Set"),
      icon: Codicon.attach,
      precondition: ChatContextKeys.location.isEqualTo(ChatAgentLocation.EditingSession),
      f1: true
    });
  }
  async runEditingSessionAction(accessor, editingSession, chatWidget, ...args) {
    const listService = accessor.get(IListService);
    const editorGroupService = accessor.get(IEditorGroupsService);
    const uris = [];
    for (const group of editorGroupService.getGroups(GroupsOrder.MOST_RECENTLY_ACTIVE)) {
      for (const selection of group.selectedEditors) {
        if (selection.resource) {
          uris.push(selection.resource);
        }
      }
    }
    if (uris.length === 0) {
      const selection = listService.lastFocusedList?.getSelection();
      if (selection?.length) {
        for (const file of selection) {
          if (!!file && typeof file === "object" && "resource" in file && URI.isUri(file.resource)) {
            uris.push(file.resource);
          }
        }
      }
    }
    for (const file of uris) {
      await chatWidget.attachmentModel.addFile(file);
    }
  }
});
registerAction2(class RemoveAction extends Action2 {
  constructor() {
    super({
      id: "workbench.action.chat.undoEdits",
      title: localize2("chat.undoEdits.label", "Undo Requests"),
      f1: false,
      category: CHAT_CATEGORY,
      icon: Codicon.x,
      keybinding: {
        primary: KeyCode.Delete,
        mac: {
          primary: KeyMod.CtrlCmd | KeyCode.Backspace
        },
        when: ContextKeyExpr.and(ChatContextKeys.inChatSession, EditorContextKeys.textInputFocus.negate()),
        weight: KeybindingWeight.WorkbenchContrib
      },
      menu: [
        {
          id: MenuId.ChatMessageTitle,
          group: "navigation",
          order: 2,
          when: ChatContextKeys.isRequest
        }
      ]
    });
  }
  async run(accessor, ...args) {
    let item = args[0];
    if (!isResponseVM(item) && !isRequestVM(item)) {
      const chatWidgetService = accessor.get(IChatWidgetService);
      const widget = chatWidgetService.lastFocusedWidget;
      item = widget?.getFocus();
    }
    if (!item) {
      return;
    }
    const configurationService = accessor.get(IConfigurationService);
    const dialogService = accessor.get(IDialogService);
    const chatService = accessor.get(IChatService);
    const chatModel = chatService.getSession(item.sessionId);
    if (!chatModel) {
      return;
    }
    const session = chatModel.editingSession;
    if (!session) {
      return;
    }
    const requestId = isRequestVM(item) ? item.id : isResponseVM(item) ? item.requestId : void 0;
    if (requestId) {
      const chatRequests = chatModel.getRequests();
      const itemIndex = chatRequests.findIndex((request) => request.id === requestId);
      const editsToUndo = chatRequests.length - itemIndex;
      const requestsToRemove = chatRequests.slice(itemIndex);
      const requestIdsToRemove = new Set(requestsToRemove.map((request) => request.id));
      const entriesModifiedInRequestsToRemove = session.entries.get().filter((entry) => requestIdsToRemove.has(entry.lastModifyingRequestId)) ?? [];
      const shouldPrompt = entriesModifiedInRequestsToRemove.length > 0 && configurationService.getValue("chat.editing.confirmEditRequestRemoval") === true;
      let message;
      if (editsToUndo === 1) {
        if (entriesModifiedInRequestsToRemove.length === 1) {
          message = localize("chat.removeLast.confirmation.message2", "This will remove your last request and undo the edits made to {0}. Do you want to proceed?", basename(entriesModifiedInRequestsToRemove[0].modifiedURI));
        } else {
          message = localize("chat.removeLast.confirmation.multipleEdits.message", "This will remove your last request and undo edits made to {0} files in your working set. Do you want to proceed?", entriesModifiedInRequestsToRemove.length);
        }
      } else {
        if (entriesModifiedInRequestsToRemove.length === 1) {
          message = localize("chat.remove.confirmation.message2", "This will remove all subsequent requests and undo edits made to {0}. Do you want to proceed?", basename(entriesModifiedInRequestsToRemove[0].modifiedURI));
        } else {
          message = localize("chat.remove.confirmation.multipleEdits.message", "This will remove all subsequent requests and undo edits made to {0} files in your working set. Do you want to proceed?", entriesModifiedInRequestsToRemove.length);
        }
      }
      const confirmation = shouldPrompt ? await dialogService.confirm({
        title: editsToUndo === 1 ? localize("chat.removeLast.confirmation.title", "Do you want to undo your last edit?") : localize("chat.remove.confirmation.title", "Do you want to undo {0} edits?", editsToUndo),
        message,
        primaryButton: localize("chat.remove.confirmation.primaryButton", "Yes"),
        checkbox: { label: localize("chat.remove.confirmation.checkbox", "Don't ask again"), checked: false },
        type: "info"
      }) : { confirmed: true };
      if (!confirmation.confirmed) {
        return;
      }
      if (confirmation.checkboxChecked) {
        await configurationService.updateValue("chat.editing.confirmEditRequestRemoval", false);
      }
      const snapshotRequestId = chatRequests[itemIndex].id;
      await session.restoreSnapshot(snapshotRequestId, void 0);
    }
  }
});
registerAction2((_a = class extends Action2 {
  constructor() {
    super({
      id: _a.id,
      title: localize("chat.openFileUpdatedBySnapshot.label", "Open File"),
      menu: [{
        id: MenuId.ChatEditingCodeBlockContext,
        group: "navigation",
        order: 0
      }]
    });
  }
  async run(accessor, ...args) {
    const context = args[0];
    if (!context?.sessionId) {
      return;
    }
    const editorService = accessor.get(IEditorService);
    await editorService.openEditor({ resource: context.uri });
  }
}, _a.id = "chat.openFileUpdatedBySnapshot", _a));
registerAction2((_b = class extends Action2 {
  constructor() {
    super({
      id: _b.id,
      title: localize("chat.openSnapshot.label", "Open File Snapshot"),
      menu: [{
        id: MenuId.ChatEditingCodeBlockContext,
        group: "navigation",
        order: 1
      }]
    });
  }
  async run(accessor, ...args) {
    const context = args[0];
    if (!context?.sessionId) {
      return;
    }
    const chatService = accessor.get(IChatService);
    const chatEditingService = accessor.get(IChatEditingService);
    const editorService = accessor.get(IEditorService);
    const chatModel = chatService.getSession(context.sessionId);
    if (!chatModel) {
      return;
    }
    const snapshot = chatEditingService.getEditingSession(chatModel.sessionId)?.getSnapshotUri(context.requestId, context.uri, context.stopId);
    if (snapshot) {
      const editor = await editorService.openEditor({ resource: snapshot, label: localize("chatEditing.snapshot", "{0} (Snapshot)", basename(context.uri)), options: { transient: true, activation: EditorActivation.ACTIVATE } });
      if (isCodeEditor(editor)) {
        editor.updateOptions({ readOnly: true });
      }
    }
  }
}, _b.id = "chat.openFileSnapshot", _b));
registerAction2(class ResolveSymbolsContextAction extends EditingSessionAction {
  constructor() {
    super({
      id: "workbench.action.edits.addFilesFromReferences",
      title: localize2("addFilesFromReferences", "Add Files From References"),
      f1: false,
      category: CHAT_CATEGORY,
      menu: {
        id: MenuId.ChatInputSymbolAttachmentContext,
        group: "navigation",
        order: 1,
        when: ContextKeyExpr.and(ChatContextKeys.chatMode.isEqualTo(ChatMode.Ask), EditorContextKeys.hasReferenceProvider)
      }
    });
  }
  async runEditingSessionAction(accessor, editingSession, chatWidget, ...args) {
    if (args.length === 0 || !isLocation(args[0])) {
      return;
    }
    const textModelService = accessor.get(ITextModelService);
    const languageFeaturesService = accessor.get(ILanguageFeaturesService);
    const symbol = args[0];
    const modelReference = await textModelService.createModelReference(symbol.uri);
    const textModel = modelReference.object.textEditorModel;
    if (!textModel) {
      return;
    }
    const position = new Position(symbol.range.startLineNumber, symbol.range.startColumn);
    const [references, definitions, implementations] = await Promise.all([
      this.getReferences(position, textModel, languageFeaturesService),
      this.getDefinitions(position, textModel, languageFeaturesService),
      this.getImplementations(position, textModel, languageFeaturesService)
    ]);
    const attachments = [];
    for (const reference of [...definitions, ...implementations, ...references]) {
      attachments.push(chatWidget.attachmentModel.asVariableEntry(reference.uri));
    }
    chatWidget.attachmentModel.addContext(...attachments);
  }
  async getReferences(position, textModel, languageFeaturesService) {
    const referenceProviders = languageFeaturesService.referenceProvider.all(textModel);
    const references = await Promise.all(referenceProviders.map(async (referenceProvider) => {
      return await referenceProvider.provideReferences(textModel, position, { includeDeclaration: true }, CancellationToken.None) ?? [];
    }));
    return references.flat();
  }
  async getDefinitions(position, textModel, languageFeaturesService) {
    const definitionProviders = languageFeaturesService.definitionProvider.all(textModel);
    const definitions = await Promise.all(definitionProviders.map(async (definitionProvider) => {
      return await definitionProvider.provideDefinition(textModel, position, CancellationToken.None) ?? [];
    }));
    return definitions.flat();
  }
  async getImplementations(position, textModel, languageFeaturesService) {
    const implementationProviders = languageFeaturesService.implementationProvider.all(textModel);
    const implementations = await Promise.all(implementationProviders.map(async (implementationProvider) => {
      return await implementationProvider.provideImplementation(textModel, position, CancellationToken.None) ?? [];
    }));
    return implementations.flat();
  }
});
export {
  ChatEditingAcceptAllAction,
  ChatEditingDiscardAllAction,
  ChatEditingRemoveAllFilesAction,
  ChatEditingShowChangesAction,
  EditingSessionAction,
  discardAllEditsWithConfirmation,
  getEditingSessionContext
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRpbmcvY2hhdEVkaXRpbmdBY3Rpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBpc0NvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IEVkaXRvckNvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBpc0xvY2F0aW9uLCBMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvcmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgSUFjdGlvbjJPcHRpb25zLCBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IEVkaXRvckFjdGl2YXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJTGlzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9saXN0L2Jyb3dzZXIvbGlzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgR3JvdXBzT3JkZXIsIElFZGl0b3JHcm91cHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGlzQ2hhdFZpZXdUaXRsZUFjdGlvbkNvbnRleHQgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdEFjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ2hhdENvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBhcHBseWluZ0NoYXRFZGl0c0ZhaWxlZENvbnRleHRLZXksIENIQVRfRURJVElOR19NVUxUSV9ESUZGX1NPVVJDRV9SRVNPTFZFUl9TQ0hFTUUsIGNoYXRFZGl0aW5nUmVzb3VyY2VDb250ZXh0S2V5LCBjaGF0RWRpdGluZ1dpZGdldEZpbGVTdGF0ZUNvbnRleHRLZXksIGRlY2lkZWRDaGF0RWRpdGluZ1Jlc291cmNlQ29udGV4dEtleSwgaGFzQXBwbGllZENoYXRFZGl0c0NvbnRleHRLZXksIGhhc1VuZGVjaWRlZENoYXRFZGl0aW5nUmVzb3VyY2VDb250ZXh0S2V5LCBJQ2hhdEVkaXRpbmdTZXJ2aWNlLCBJQ2hhdEVkaXRpbmdTZXNzaW9uLCBXb3JraW5nU2V0RW50cnlSZW1vdmFsUmVhc29uLCBXb3JraW5nU2V0RW50cnlTdGF0ZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0RWRpdGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGlzUmVxdWVzdFZNLCBpc1Jlc3BvbnNlVk0gfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdFZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBDaGF0QWdlbnRMb2NhdGlvbiwgQ2hhdE1vZGUgfSBmcm9tICcuLi8uLi9jb21tb24vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IENIQVRfQ0FURUdPUlkgfSBmcm9tICcuLi9hY3Rpb25zL2NoYXRBY3Rpb25zLmpzJztcbmltcG9ydCB7IENoYXRUcmVlSXRlbSwgSUNoYXRXaWRnZXQsIElDaGF0V2lkZ2V0U2VydmljZSB9IGZyb20gJy4uL2NoYXQuanMnO1xuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRWRpdGluZ1Nlc3Npb25BY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcihvcHRzOiBSZWFkb25seTxJQWN0aW9uMk9wdGlvbnM+KSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHQuLi5vcHRzXG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKSB7XG5cdFx0Y29uc3QgY29udGV4dCA9IGdldEVkaXRpbmdTZXNzaW9uQ29udGV4dChhY2Nlc3NvciwgYXJncyk7XG5cdFx0aWYgKCFjb250ZXh0IHx8ICFjb250ZXh0LmVkaXRpbmdTZXNzaW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMucnVuRWRpdGluZ1Nlc3Npb25BY3Rpb24oYWNjZXNzb3IsIGNvbnRleHQuZWRpdGluZ1Nlc3Npb24sIGNvbnRleHQuY2hhdFdpZGdldCwgLi4uYXJncyk7XG5cdH1cblxuXHRhYnN0cmFjdCBydW5FZGl0aW5nU2Vzc2lvbkFjdGlvbihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdGluZ1Nlc3Npb246IElDaGF0RWRpdGluZ1Nlc3Npb24sIGNoYXRXaWRnZXQ6IElDaGF0V2lkZ2V0LCAuLi5hcmdzOiBhbnlbXSk6IGFueTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEVkaXRpbmdTZXNzaW9uQ29udGV4dChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJnczogYW55W10pOiB7IGVkaXRpbmdTZXNzaW9uPzogSUNoYXRFZGl0aW5nU2Vzc2lvbjsgY2hhdFdpZGdldDogSUNoYXRXaWRnZXQgfSB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IGFyZzAgPSBhcmdzLmF0KDApO1xuXHRjb25zdCBjb250ZXh0ID0gaXNDaGF0Vmlld1RpdGxlQWN0aW9uQ29udGV4dChhcmcwKSA/IGFyZzAgOiB1bmRlZmluZWQ7XG5cblx0Y29uc3QgY2hhdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRTZXJ2aWNlKTtcblx0Y29uc3QgY2hhdFdpZGdldFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRXaWRnZXRTZXJ2aWNlKTtcblx0Y29uc3QgY2hhdEVkaXRpbmdTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0RWRpdGluZ1NlcnZpY2UpO1xuXHRsZXQgY2hhdFdpZGdldCA9IGNvbnRleHQgPyBjaGF0V2lkZ2V0U2VydmljZS5nZXRXaWRnZXRCeVNlc3Npb25JZChjb250ZXh0LnNlc3Npb25JZCkgOiB1bmRlZmluZWQ7XG5cdGlmICghY2hhdFdpZGdldCkge1xuXHRcdGlmIChjaGF0U2VydmljZS51bmlmaWVkVmlld0VuYWJsZWQpIHtcblx0XHRcdC8vIFRPRE8gdWdseVxuXHRcdFx0Y2hhdFdpZGdldCA9IGNoYXRXaWRnZXRTZXJ2aWNlLmxhc3RGb2N1c2VkV2lkZ2V0ID8/IGNoYXRXaWRnZXRTZXJ2aWNlLmdldFdpZGdldHNCeUxvY2F0aW9ucyhDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCkuZmluZCh3ID0+IHcuaXNVbmlmaWVkUGFuZWxXaWRnZXQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjaGF0V2lkZ2V0ID0gY2hhdFdpZGdldFNlcnZpY2UuZ2V0V2lkZ2V0c0J5TG9jYXRpb25zKENoYXRBZ2VudExvY2F0aW9uLkVkaXRpbmdTZXNzaW9uKS5hdCgwKTtcblx0XHR9XG5cdH1cblxuXHRpZiAoIWNoYXRXaWRnZXQ/LnZpZXdNb2RlbCkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IGNoYXRTZXNzaW9uSWQgPSBjaGF0V2lkZ2V0LnZpZXdNb2RlbC5tb2RlbC5zZXNzaW9uSWQ7XG5cdGNvbnN0IGVkaXRpbmdTZXNzaW9uID0gY2hhdEVkaXRpbmdTZXJ2aWNlLmdldEVkaXRpbmdTZXNzaW9uKGNoYXRTZXNzaW9uSWQpO1xuXG5cdGlmICghZWRpdGluZ1Nlc3Npb24pIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRyZXR1cm4geyBlZGl0aW5nU2Vzc2lvbiwgY2hhdFdpZGdldCB9O1xufVxuXG5cbmFic3RyYWN0IGNsYXNzIFdvcmtpbmdTZXRBY3Rpb24gZXh0ZW5kcyBFZGl0aW5nU2Vzc2lvbkFjdGlvbiB7XG5cblx0cnVuRWRpdGluZ1Nlc3Npb25BY3Rpb24oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGVkaXRpbmdTZXNzaW9uOiBJQ2hhdEVkaXRpbmdTZXNzaW9uLCBjaGF0V2lkZ2V0OiBJQ2hhdFdpZGdldCwgLi4uYXJnczogYW55W10pIHtcblxuXHRcdGNvbnN0IHVyaXM6IFVSSVtdID0gW107XG5cdFx0aWYgKFVSSS5pc1VyaShhcmdzWzBdKSkge1xuXHRcdFx0dXJpcy5wdXNoKGFyZ3NbMF0pO1xuXHRcdH0gZWxzZSBpZiAoY2hhdFdpZGdldCkge1xuXHRcdFx0dXJpcy5wdXNoKC4uLmNoYXRXaWRnZXQuaW5wdXQuc2VsZWN0ZWRFbGVtZW50cyk7XG5cdFx0fVxuXHRcdGlmICghdXJpcy5sZW5ndGgpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5ydW5Xb3JraW5nU2V0QWN0aW9uKGFjY2Vzc29yLCBlZGl0aW5nU2Vzc2lvbiwgY2hhdFdpZGdldCwgLi4udXJpcyk7XG5cdH1cblxuXHRhYnN0cmFjdCBydW5Xb3JraW5nU2V0QWN0aW9uKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0aW5nU2Vzc2lvbjogSUNoYXRFZGl0aW5nU2Vzc2lvbiwgY2hhdFdpZGdldDogSUNoYXRXaWRnZXQgfCB1bmRlZmluZWQsIC4uLnVyaXM6IFVSSVtdKTogYW55O1xufVxuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgUmVtb3ZlRmlsZUZyb21Xb3JraW5nU2V0IGV4dGVuZHMgV29ya2luZ1NldEFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnY2hhdEVkaXRpbmcucmVtb3ZlRmlsZUZyb21Xb3JraW5nU2V0Jyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3JlbW92ZUZpbGVGcm9tV29ya2luZ1NldCcsICdSZW1vdmUgRmlsZScpLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5jbG9zZSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ2hhdENvbnRleHRLZXlzLnJlcXVlc3RJblByb2dyZXNzLm5lZ2F0ZSgpLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0RWRpdGluZ1dpZGdldE1vZGlmaWVkRmlsZXNUb29sYmFyLFxuXHRcdFx0XHQvLyB3aGVuOiBDb250ZXh0S2V5RXhwci5vcihDb250ZXh0S2V5RXhwci5lcXVhbHMoY2hhdEVkaXRpbmdXaWRnZXRGaWxlU3RhdGVDb250ZXh0S2V5LmtleSwgV29ya2luZ1NldEVudHJ5U3RhdGUuQXR0YWNoZWQpLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoY2hhdEVkaXRpbmdXaWRnZXRGaWxlU3RhdGVDb250ZXh0S2V5LmtleSwgV29ya2luZ1NldEVudHJ5U3RhdGUuU3VnZ2VzdGVkKSwgQ29udGV4dEtleUV4cHIuZXF1YWxzKGNoYXRFZGl0aW5nV2lkZ2V0RmlsZVN0YXRlQ29udGV4dEtleS5rZXksIFdvcmtpbmdTZXRFbnRyeVN0YXRlLlRyYW5zaWVudCkpLFxuXHRcdFx0XHRvcmRlcjogNSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJ1xuXHRcdFx0fV0sXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5Xb3JraW5nU2V0QWN0aW9uKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjdXJyZW50RWRpdGluZ1Nlc3Npb246IElDaGF0RWRpdGluZ1Nlc3Npb24sIGNoYXRXaWRnZXQ6IElDaGF0V2lkZ2V0LCAuLi51cmlzOiBVUklbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGRpYWxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURpYWxvZ1NlcnZpY2UpO1xuXG5cdFx0Y29uc3QgcGVuZGluZ0VudHJpZXMgPSBjdXJyZW50RWRpdGluZ1Nlc3Npb24uZW50cmllcy5nZXQoKS5maWx0ZXIoKGVudHJ5KSA9PiB1cmlzLmluY2x1ZGVzKGVudHJ5Lm1vZGlmaWVkVVJJKSAmJiBlbnRyeS5zdGF0ZS5nZXQoKSA9PT0gV29ya2luZ1NldEVudHJ5U3RhdGUuTW9kaWZpZWQpO1xuXHRcdGlmIChwZW5kaW5nRW50cmllcy5sZW5ndGggPiAwKSB7XG5cdFx0XHQvLyBBc2sgZm9yIGNvbmZpcm1hdGlvbiBpZiB0aGVyZSBhcmUgYW55IHBlbmRpbmcgZWRpdHNcblx0XHRcdGNvbnN0IGZpbGUgPSBwZW5kaW5nRW50cmllcy5sZW5ndGggPiAxXG5cdFx0XHRcdD8gbG9jYWxpemUoJ2NoYXQuZWRpdGluZy5yZW1vdmVGaWxlLmNvbmZpcm1hdGlvbm1hbnlGaWxlcycsIFwiezB9IGZpbGVzXCIsIHBlbmRpbmdFbnRyaWVzLmxlbmd0aClcblx0XHRcdFx0OiBiYXNlbmFtZShwZW5kaW5nRW50cmllc1swXS5tb2RpZmllZFVSSSk7XG5cdFx0XHRjb25zdCBjb25maXJtYXRpb24gPSBhd2FpdCBkaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ2NoYXQuZWRpdGluZy5yZW1vdmVGaWxlLmNvbmZpcm1hdGlvbi50aXRsZScsIFwiUmVtb3ZlIHswfSBmcm9tIHdvcmtpbmcgc2V0P1wiLCBmaWxlKSxcblx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2NoYXQuZWRpdGluZy5yZW1vdmVGaWxlLmNvbmZpcm1hdGlvbi5tZXNzYWdlJywgXCJUaGlzIHdpbGwgcmVtb3ZlIHswfSBmcm9tIHlvdXIgd29ya2luZyBzZXQgYW5kIHVuZG8gdGhlIGVkaXRzIG1hZGUgdG8gaXQuIERvIHlvdSB3YW50IHRvIHByb2NlZWQ/XCIsIGZpbGUpLFxuXHRcdFx0XHRwcmltYXJ5QnV0dG9uOiBsb2NhbGl6ZSgnY2hhdC5lZGl0aW5nLnJlbW92ZUZpbGUuY29uZmlybWF0aW9uLnByaW1hcnlCdXR0b24nLCBcIlllc1wiKSxcblx0XHRcdFx0dHlwZTogJ2luZm8nXG5cdFx0XHR9KTtcblx0XHRcdGlmICghY29uZmlybWF0aW9uLmNvbmZpcm1lZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gUmVtb3ZlIGZyb20gd29ya2luZyBzZXRcblx0XHRhd2FpdCBjdXJyZW50RWRpdGluZ1Nlc3Npb24ucmVqZWN0KC4uLnVyaXMpO1xuXHRcdGN1cnJlbnRFZGl0aW5nU2Vzc2lvbi5yZW1vdmUoV29ya2luZ1NldEVudHJ5UmVtb3ZhbFJlYXNvbi5Vc2VyLCAuLi51cmlzKTtcblxuXHRcdC8vIFJlbW92ZSBmcm9tIGNoYXQgaW5wdXQgcGFydFxuXHRcdGZvciAoY29uc3QgdXJpIG9mIHVyaXMpIHtcblx0XHRcdGNoYXRXaWRnZXQuYXR0YWNobWVudE1vZGVsLmRlbGV0ZSh1cmkudG9TdHJpbmcoKSk7XG5cdFx0fVxuXG5cdFx0Ly8gQ2xlYXIgYWxsIHJlbGF0ZWQgZmlsZSBzdWdnZXN0aW9uc1xuXHRcdGlmIChjaGF0V2lkZ2V0LmF0dGFjaG1lbnRNb2RlbC5maWxlQXR0YWNobWVudHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRjaGF0V2lkZ2V0LmlucHV0LnJlbGF0ZWRGaWxlcz8uY2xlYXIoKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgT3BlbkZpbGVJbkRpZmZBY3Rpb24gZXh0ZW5kcyBXb3JraW5nU2V0QWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdjaGF0RWRpdGluZy5vcGVuRmlsZUluRGlmZicsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdvcGVuLmZpbGVJbkRpZmYnLCAnT3BlbiBDaGFuZ2VzIGluIERpZmYgRWRpdG9yJyksXG5cdFx0XHRpY29uOiBDb2RpY29uLmRpZmZTaW5nbGUsXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkNoYXRFZGl0aW5nV2lkZ2V0TW9kaWZpZWRGaWxlc1Rvb2xiYXIsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscyhjaGF0RWRpdGluZ1dpZGdldEZpbGVTdGF0ZUNvbnRleHRLZXkua2V5LCBXb3JraW5nU2V0RW50cnlTdGF0ZS5Nb2RpZmllZCksXG5cdFx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nXG5cdFx0XHR9XSxcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHJ1bldvcmtpbmdTZXRBY3Rpb24oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGN1cnJlbnRFZGl0aW5nU2Vzc2lvbjogSUNoYXRFZGl0aW5nU2Vzc2lvbiwgX2NoYXRXaWRnZXQ6IElDaGF0V2lkZ2V0LCAuLi51cmlzOiBVUklbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGZvciAoY29uc3QgdXJpIG9mIHVyaXMpIHtcblx0XHRcdGNvbnN0IGVkaXRlZEZpbGUgPSBjdXJyZW50RWRpdGluZ1Nlc3Npb24uZ2V0RW50cnkodXJpKTtcblx0XHRcdGlmIChlZGl0ZWRGaWxlPy5zdGF0ZS5nZXQoKSA9PT0gV29ya2luZ1NldEVudHJ5U3RhdGUuTW9kaWZpZWQpIHtcblx0XHRcdFx0YXdhaXQgZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRcdFx0XHRvcmlnaW5hbDogeyByZXNvdXJjZTogVVJJLmZyb20oZWRpdGVkRmlsZS5vcmlnaW5hbFVSSSwgdHJ1ZSkgfSxcblx0XHRcdFx0XHRtb2RpZmllZDogeyByZXNvdXJjZTogVVJJLmZyb20oZWRpdGVkRmlsZS5tb2RpZmllZFVSSSwgdHJ1ZSkgfSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoeyByZXNvdXJjZTogdXJpIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBBY2NlcHRBY3Rpb24gZXh0ZW5kcyBXb3JraW5nU2V0QWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdjaGF0RWRpdGluZy5hY2NlcHRGaWxlJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2FjY2VwdC5maWxlJywgJ0tlZXAnKSxcblx0XHRcdGljb246IENvZGljb24uY2hlY2ssXG5cdFx0XHRwcmVjb25kaXRpb246IENoYXRDb250ZXh0S2V5cy5yZXF1ZXN0SW5Qcm9ncmVzcy5uZWdhdGUoKSxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3Jlc291cmNlU2NoZW1lJywgQ0hBVF9FRElUSU5HX01VTFRJX0RJRkZfU09VUkNFX1JFU09MVkVSX1NDSEVNRSksIENvbnRleHRLZXlFeHByLm5vdEluKGNoYXRFZGl0aW5nUmVzb3VyY2VDb250ZXh0S2V5LmtleSwgZGVjaWRlZENoYXRFZGl0aW5nUmVzb3VyY2VDb250ZXh0S2V5LmtleSkpLFxuXHRcdFx0XHRpZDogTWVudUlkLk11bHRpRGlmZkVkaXRvckZpbGVUb29sYmFyLFxuXHRcdFx0XHRvcmRlcjogMCxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdH0sIHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0RWRpdGluZ1dpZGdldE1vZGlmaWVkRmlsZXNUb29sYmFyLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoY2hhdEVkaXRpbmdXaWRnZXRGaWxlU3RhdGVDb250ZXh0S2V5LmtleSwgV29ya2luZ1NldEVudHJ5U3RhdGUuTW9kaWZpZWQpLFxuXHRcdFx0XHRvcmRlcjogMCxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJ1xuXHRcdFx0fV0sXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5Xb3JraW5nU2V0QWN0aW9uKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjdXJyZW50RWRpdGluZ1Nlc3Npb246IElDaGF0RWRpdGluZ1Nlc3Npb24sIGNoYXRXaWRnZXQ6IElDaGF0V2lkZ2V0LCAuLi51cmlzOiBVUklbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IGN1cnJlbnRFZGl0aW5nU2Vzc2lvbi5hY2NlcHQoLi4udXJpcyk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgRGlzY2FyZEFjdGlvbiBleHRlbmRzIFdvcmtpbmdTZXRBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2NoYXRFZGl0aW5nLmRpc2NhcmRGaWxlJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2Rpc2NhcmQuZmlsZScsICdVbmRvJyksXG5cdFx0XHRpY29uOiBDb2RpY29uLmRpc2NhcmQsXG5cdFx0XHRwcmVjb25kaXRpb246IENoYXRDb250ZXh0S2V5cy5yZXF1ZXN0SW5Qcm9ncmVzcy5uZWdhdGUoKSxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3Jlc291cmNlU2NoZW1lJywgQ0hBVF9FRElUSU5HX01VTFRJX0RJRkZfU09VUkNFX1JFU09MVkVSX1NDSEVNRSksIENvbnRleHRLZXlFeHByLm5vdEluKGNoYXRFZGl0aW5nUmVzb3VyY2VDb250ZXh0S2V5LmtleSwgZGVjaWRlZENoYXRFZGl0aW5nUmVzb3VyY2VDb250ZXh0S2V5LmtleSkpLFxuXHRcdFx0XHRpZDogTWVudUlkLk11bHRpRGlmZkVkaXRvckZpbGVUb29sYmFyLFxuXHRcdFx0XHRvcmRlcjogMixcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdH0sIHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0RWRpdGluZ1dpZGdldE1vZGlmaWVkRmlsZXNUb29sYmFyLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoY2hhdEVkaXRpbmdXaWRnZXRGaWxlU3RhdGVDb250ZXh0S2V5LmtleSwgV29ya2luZ1NldEVudHJ5U3RhdGUuTW9kaWZpZWQpLFxuXHRcdFx0XHRvcmRlcjogMSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJ1xuXHRcdFx0fV0sXG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5Xb3JraW5nU2V0QWN0aW9uKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBjdXJyZW50RWRpdGluZ1Nlc3Npb246IElDaGF0RWRpdGluZ1Nlc3Npb24sIGNoYXRXaWRnZXQ6IElDaGF0V2lkZ2V0LCAuLi51cmlzOiBVUklbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IGN1cnJlbnRFZGl0aW5nU2Vzc2lvbi5yZWplY3QoLi4udXJpcyk7XG5cdH1cbn0pO1xuXG5leHBvcnQgY2xhc3MgQ2hhdEVkaXRpbmdBY2NlcHRBbGxBY3Rpb24gZXh0ZW5kcyBFZGl0aW5nU2Vzc2lvbkFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdjaGF0RWRpdGluZy5hY2NlcHRBbGxGaWxlcycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ2FjY2VwdCcsICdLZWVwJyksXG5cdFx0XHRpY29uOiBDb2RpY29uLmNoZWNrLFxuXHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ2FjY2VwdEFsbEVkaXRzJywgJ0tlZXAgQWxsIEVkaXRzJyksXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChDaGF0Q29udGV4dEtleXMucmVxdWVzdEluUHJvZ3Jlc3MubmVnYXRlKCksIGhhc1VuZGVjaWRlZENoYXRFZGl0aW5nUmVzb3VyY2VDb250ZXh0S2V5KSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkVudGVyLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ2hhdENvbnRleHRLZXlzLnJlcXVlc3RJblByb2dyZXNzLm5lZ2F0ZSgpLCBoYXNVbmRlY2lkZWRDaGF0RWRpdGluZ1Jlc291cmNlQ29udGV4dEtleSwgQ2hhdENvbnRleHRLZXlzLmluQ2hhdElucHV0KSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHR9LFxuXHRcdFx0bWVudTogW1xuXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkNoYXRFZGl0aW5nV2lkZ2V0VG9vbGJhcixcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdG9yZGVyOiAwLFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChhcHBseWluZ0NoYXRFZGl0c0ZhaWxlZENvbnRleHRLZXkubmVnYXRlKCksIENvbnRleHRLZXlFeHByLmFuZChoYXNVbmRlY2lkZWRDaGF0RWRpdGluZ1Jlc291cmNlQ29udGV4dEtleSkpXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bkVkaXRpbmdTZXNzaW9uQWN0aW9uKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0aW5nU2Vzc2lvbjogSUNoYXRFZGl0aW5nU2Vzc2lvbiwgY2hhdFdpZGdldDogSUNoYXRXaWRnZXQsIC4uLmFyZ3M6IGFueVtdKSB7XG5cdFx0YXdhaXQgZWRpdGluZ1Nlc3Npb24uYWNjZXB0KCk7XG5cdH1cbn1cbnJlZ2lzdGVyQWN0aW9uMihDaGF0RWRpdGluZ0FjY2VwdEFsbEFjdGlvbik7XG5cbmV4cG9ydCBjbGFzcyBDaGF0RWRpdGluZ0Rpc2NhcmRBbGxBY3Rpb24gZXh0ZW5kcyBFZGl0aW5nU2Vzc2lvbkFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdjaGF0RWRpdGluZy5kaXNjYXJkQWxsRmlsZXMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdkaXNjYXJkJywgJ1VuZG8nKSxcblx0XHRcdGljb246IENvZGljb24uZGlzY2FyZCxcblx0XHRcdHRvb2x0aXA6IGxvY2FsaXplKCdkaXNjYXJkQWxsRWRpdHMnLCAnVW5kbyBBbGwgRWRpdHMnKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKENoYXRDb250ZXh0S2V5cy5yZXF1ZXN0SW5Qcm9ncmVzcy5uZWdhdGUoKSwgaGFzVW5kZWNpZGVkQ2hhdEVkaXRpbmdSZXNvdXJjZUNvbnRleHRLZXkpLFxuXHRcdFx0bWVudTogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0RWRpdGluZ1dpZGdldFRvb2xiYXIsXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHRvcmRlcjogMSxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoYXBwbHlpbmdDaGF0RWRpdHNGYWlsZWRDb250ZXh0S2V5Lm5lZ2F0ZSgpLCBoYXNVbmRlY2lkZWRDaGF0RWRpdGluZ1Jlc291cmNlQ29udGV4dEtleSlcblx0XHRcdFx0fVxuXHRcdFx0XSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENoYXRDb250ZXh0S2V5cy5yZXF1ZXN0SW5Qcm9ncmVzcy5uZWdhdGUoKSwgaGFzVW5kZWNpZGVkQ2hhdEVkaXRpbmdSZXNvdXJjZUNvbnRleHRLZXksIENoYXRDb250ZXh0S2V5cy5pbkNoYXRJbnB1dCwgQ2hhdENvbnRleHRLZXlzLmlucHV0SGFzVGV4dC5uZWdhdGUoKSksXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuQmFja3NwYWNlLFxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bkVkaXRpbmdTZXNzaW9uQWN0aW9uKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0aW5nU2Vzc2lvbjogSUNoYXRFZGl0aW5nU2Vzc2lvbiwgY2hhdFdpZGdldDogSUNoYXRXaWRnZXQsIC4uLmFyZ3M6IGFueVtdKSB7XG5cdFx0YXdhaXQgZGlzY2FyZEFsbEVkaXRzV2l0aENvbmZpcm1hdGlvbihhY2Nlc3NvciwgZWRpdGluZ1Nlc3Npb24pO1xuXHR9XG59XG5yZWdpc3RlckFjdGlvbjIoQ2hhdEVkaXRpbmdEaXNjYXJkQWxsQWN0aW9uKTtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRpc2NhcmRBbGxFZGl0c1dpdGhDb25maXJtYXRpb24oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGN1cnJlbnRFZGl0aW5nU2Vzc2lvbjogSUNoYXRFZGl0aW5nU2Vzc2lvbik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXG5cdGNvbnN0IGRpYWxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURpYWxvZ1NlcnZpY2UpO1xuXG5cdC8vIEFzayBmb3IgY29uZmlybWF0aW9uIGlmIHRoZXJlIGFyZSBhbnkgZWRpdHNcblx0Y29uc3QgZW50cmllcyA9IGN1cnJlbnRFZGl0aW5nU2Vzc2lvbi5lbnRyaWVzLmdldCgpO1xuXHRpZiAoZW50cmllcy5sZW5ndGggPiAwKSB7XG5cdFx0Y29uc3QgY29uZmlybWF0aW9uID0gYXdhaXQgZGlhbG9nU2VydmljZS5jb25maXJtKHtcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnY2hhdC5lZGl0aW5nLmRpc2NhcmRBbGwuY29uZmlybWF0aW9uLnRpdGxlJywgXCJVbmRvIGFsbCBlZGl0cz9cIiksXG5cdFx0XHRtZXNzYWdlOiBlbnRyaWVzLmxlbmd0aCA9PT0gMVxuXHRcdFx0XHQ/IGxvY2FsaXplKCdjaGF0LmVkaXRpbmcuZGlzY2FyZEFsbC5jb25maXJtYXRpb24ub25lRmlsZScsIFwiVGhpcyB3aWxsIHVuZG8gY2hhbmdlcyBtYWRlIGJ5IHswfSBpbiB7MX0uIERvIHlvdSB3YW50IHRvIHByb2NlZWQ/XCIsICdDb3BpbG90IEVkaXRzJywgYmFzZW5hbWUoZW50cmllc1swXS5tb2RpZmllZFVSSSkpXG5cdFx0XHRcdDogbG9jYWxpemUoJ2NoYXQuZWRpdGluZy5kaXNjYXJkQWxsLmNvbmZpcm1hdGlvbi5tYW55RmlsZXMnLCBcIlRoaXMgd2lsbCB1bmRvIGNoYW5nZXMgbWFkZSBieSB7MH0gaW4gezF9IGZpbGVzLiBEbyB5b3Ugd2FudCB0byBwcm9jZWVkP1wiLCAnQ29waWxvdCBFZGl0cycsIGVudHJpZXMubGVuZ3RoKSxcblx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKCdjaGF0LmVkaXRpbmcuZGlzY2FyZEFsbC5jb25maXJtYXRpb24ucHJpbWFyeUJ1dHRvbicsIFwiWWVzXCIpLFxuXHRcdFx0dHlwZTogJ2luZm8nXG5cdFx0fSk7XG5cdFx0aWYgKCFjb25maXJtYXRpb24uY29uZmlybWVkKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblx0YXdhaXQgY3VycmVudEVkaXRpbmdTZXNzaW9uLnJlamVjdCgpO1xuXHRyZXR1cm4gdHJ1ZTtcbn1cblxuZXhwb3J0IGNsYXNzIENoYXRFZGl0aW5nUmVtb3ZlQWxsRmlsZXNBY3Rpb24gZXh0ZW5kcyBFZGl0aW5nU2Vzc2lvbkFjdGlvbiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICdjaGF0RWRpdGluZy5jbGVhcldvcmtpbmdTZXQnO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBDaGF0RWRpdGluZ1JlbW92ZUFsbEZpbGVzQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdjbGVhcldvcmtpbmdTZXQnLCAnQ2xlYXIgV29ya2luZyBTZXQnKSxcblx0XHRcdGljb246IENvZGljb24uY2xlYXJBbGwsXG5cdFx0XHR0b29sdGlwOiBsb2NhbGl6ZSgnY2xlYXJXb3JraW5nU2V0JywgJ0NsZWFyIFdvcmtpbmcgU2V0JyksXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChDaGF0Q29udGV4dEtleXMucmVxdWVzdEluUHJvZ3Jlc3MubmVnYXRlKCkpLFxuXHRcdFx0bWVudTogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0RWRpdGluZ1dpZGdldFRvb2xiYXIsXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHRvcmRlcjogNSxcblx0XHRcdFx0XHR3aGVuOiBoYXNBcHBsaWVkQ2hhdEVkaXRzQ29udGV4dEtleS5uZWdhdGUoKVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0fSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW5FZGl0aW5nU2Vzc2lvbkFjdGlvbihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdGluZ1Nlc3Npb246IElDaGF0RWRpdGluZ1Nlc3Npb24sIGNoYXRXaWRnZXQ6IElDaGF0V2lkZ2V0LCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIFJlbW92ZSBhbGwgZmlsZXMgZnJvbSB3b3JraW5nIHNldFxuXHRcdGNvbnN0IHVyaXMgPSBbLi4uZWRpdGluZ1Nlc3Npb24uZW50cmllcy5nZXQoKV0ubWFwKChlKSA9PiBlLm1vZGlmaWVkVVJJKTtcblx0XHRlZGl0aW5nU2Vzc2lvbi5yZW1vdmUoV29ya2luZ1NldEVudHJ5UmVtb3ZhbFJlYXNvbi5Vc2VyLCAuLi51cmlzKTtcblxuXHRcdC8vIFJlbW92ZSBhbGwgZmlsZSBhdHRhY2htZW50c1xuXHRcdGNvbnN0IGZpbGVBdHRhY2htZW50cyA9IGNoYXRXaWRnZXQuYXR0YWNobWVudE1vZGVsID8gY2hhdFdpZGdldC5hdHRhY2htZW50TW9kZWwuZmlsZUF0dGFjaG1lbnRzIDogW107XG5cdFx0Y29uc3QgYXR0YWNobWVudElkc1RvUmVtb3ZlID0gZmlsZUF0dGFjaG1lbnRzLm1hcChhdHRhY2htZW50ID0+IGF0dGFjaG1lbnQudG9TdHJpbmcoKSk7XG5cdFx0Y2hhdFdpZGdldC5hdHRhY2htZW50TW9kZWwuZGVsZXRlKC4uLmF0dGFjaG1lbnRJZHNUb1JlbW92ZSk7XG5cdH1cbn1cbnJlZ2lzdGVyQWN0aW9uMihDaGF0RWRpdGluZ1JlbW92ZUFsbEZpbGVzQWN0aW9uKTtcblxuZXhwb3J0IGNsYXNzIENoYXRFZGl0aW5nU2hvd0NoYW5nZXNBY3Rpb24gZXh0ZW5kcyBFZGl0aW5nU2Vzc2lvbkFjdGlvbiB7XG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICdjaGF0RWRpdGluZy52aWV3Q2hhbmdlcyc7XG5cdHN0YXRpYyByZWFkb25seSBMQUJFTCA9IGxvY2FsaXplKCdjaGF0RWRpdGluZy52aWV3Q2hhbmdlcycsICdWaWV3IEFsbCBFZGl0cycpO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBDaGF0RWRpdGluZ1Nob3dDaGFuZ2VzQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IENoYXRFZGl0aW5nU2hvd0NoYW5nZXNBY3Rpb24uTEFCRUwsXG5cdFx0XHR0b29sdGlwOiBDaGF0RWRpdGluZ1Nob3dDaGFuZ2VzQWN0aW9uLkxBQkVMLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5kaWZmTXVsdGlwbGUsXG5cdFx0XHRwcmVjb25kaXRpb246IGhhc1VuZGVjaWRlZENoYXRFZGl0aW5nUmVzb3VyY2VDb250ZXh0S2V5LFxuXHRcdFx0bWVudTogW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0RWRpdGluZ1dpZGdldFRvb2xiYXIsXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHRvcmRlcjogNCxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoYXBwbHlpbmdDaGF0RWRpdHNGYWlsZWRDb250ZXh0S2V5Lm5lZ2F0ZSgpLCBDb250ZXh0S2V5RXhwci5hbmQoaGFzQXBwbGllZENoYXRFZGl0c0NvbnRleHRLZXksIGhhc1VuZGVjaWRlZENoYXRFZGl0aW5nUmVzb3VyY2VDb250ZXh0S2V5KSlcblx0XHRcdFx0fVxuXHRcdFx0XSxcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bkVkaXRpbmdTZXNzaW9uQWN0aW9uKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0aW5nU2Vzc2lvbjogSUNoYXRFZGl0aW5nU2Vzc2lvbiwgY2hhdFdpZGdldDogSUNoYXRXaWRnZXQsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgZWRpdGluZ1Nlc3Npb24uc2hvdygpO1xuXHR9XG59XG5yZWdpc3RlckFjdGlvbjIoQ2hhdEVkaXRpbmdTaG93Q2hhbmdlc0FjdGlvbik7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBBZGRGaWxlc1RvV29ya2luZ1NldEFjdGlvbiBleHRlbmRzIEVkaXRpbmdTZXNzaW9uQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLmNoYXQuYWRkU2VsZWN0ZWRGaWxlc1RvV29ya2luZ1NldCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guYWN0aW9uLmNoYXQuYWRkU2VsZWN0ZWRGaWxlc1RvV29ya2luZ1NldC5sYWJlbCcsIFwiQWRkIFNlbGVjdGVkIEZpbGVzIHRvIFdvcmtpbmcgU2V0XCIpLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5hdHRhY2gsXG5cdFx0XHRwcmVjb25kaXRpb246IENoYXRDb250ZXh0S2V5cy5sb2NhdGlvbi5pc0VxdWFsVG8oQ2hhdEFnZW50TG9jYXRpb24uRWRpdGluZ1Nlc3Npb24pLFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bkVkaXRpbmdTZXNzaW9uQWN0aW9uKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0aW5nU2Vzc2lvbjogSUNoYXRFZGl0aW5nU2Vzc2lvbiwgY2hhdFdpZGdldDogSUNoYXRXaWRnZXQsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgbGlzdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JHcm91cFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpO1xuXG5cdFx0Y29uc3QgdXJpczogVVJJW10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgZWRpdG9yR3JvdXBTZXJ2aWNlLmdldEdyb3VwcyhHcm91cHNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSkpIHtcblx0XHRcdGZvciAoY29uc3Qgc2VsZWN0aW9uIG9mIGdyb3VwLnNlbGVjdGVkRWRpdG9ycykge1xuXHRcdFx0XHRpZiAoc2VsZWN0aW9uLnJlc291cmNlKSB7XG5cdFx0XHRcdFx0dXJpcy5wdXNoKHNlbGVjdGlvbi5yZXNvdXJjZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodXJpcy5sZW5ndGggPT09IDApIHtcblx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IGxpc3RTZXJ2aWNlLmxhc3RGb2N1c2VkTGlzdD8uZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHRpZiAoc2VsZWN0aW9uPy5sZW5ndGgpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBmaWxlIG9mIHNlbGVjdGlvbikge1xuXHRcdFx0XHRcdGlmICghIWZpbGUgJiYgdHlwZW9mIGZpbGUgPT09ICdvYmplY3QnICYmICdyZXNvdXJjZScgaW4gZmlsZSAmJiBVUkkuaXNVcmkoZmlsZS5yZXNvdXJjZSkpIHtcblx0XHRcdFx0XHRcdHVyaXMucHVzaChmaWxlLnJlc291cmNlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IGZpbGUgb2YgdXJpcykge1xuXHRcdFx0YXdhaXQgY2hhdFdpZGdldC5hdHRhY2htZW50TW9kZWwuYWRkRmlsZShmaWxlKTtcblx0XHR9XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgUmVtb3ZlQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5jaGF0LnVuZG9FZGl0cycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdjaGF0LnVuZG9FZGl0cy5sYWJlbCcsIFwiVW5kbyBSZXF1ZXN0c1wiKSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0aWNvbjogQ29kaWNvbi54LFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkRlbGV0ZSxcblx0XHRcdFx0bWFjOiB7XG5cdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkJhY2tzcGFjZSxcblx0XHRcdFx0fSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENoYXRDb250ZXh0S2V5cy5pbkNoYXRTZXNzaW9uLCBFZGl0b3JDb250ZXh0S2V5cy50ZXh0SW5wdXRGb2N1cy5uZWdhdGUoKSksXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0fSxcblx0XHRcdG1lbnU6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuQ2hhdE1lc3NhZ2VUaXRsZSxcblx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0XHRcdHdoZW46IENoYXRDb250ZXh0S2V5cy5pc1JlcXVlc3Rcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSkge1xuXHRcdGxldCBpdGVtOiBDaGF0VHJlZUl0ZW0gfCB1bmRlZmluZWQgPSBhcmdzWzBdO1xuXHRcdGlmICghaXNSZXNwb25zZVZNKGl0ZW0pICYmICFpc1JlcXVlc3RWTShpdGVtKSkge1xuXHRcdFx0Y29uc3QgY2hhdFdpZGdldFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRXaWRnZXRTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHdpZGdldCA9IGNoYXRXaWRnZXRTZXJ2aWNlLmxhc3RGb2N1c2VkV2lkZ2V0O1xuXHRcdFx0aXRlbSA9IHdpZGdldD8uZ2V0Rm9jdXMoKTtcblx0XHR9XG5cblx0XHRpZiAoIWl0ZW0pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IGRpYWxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURpYWxvZ1NlcnZpY2UpO1xuXHRcdGNvbnN0IGNoYXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDaGF0U2VydmljZSk7XG5cdFx0Y29uc3QgY2hhdE1vZGVsID0gY2hhdFNlcnZpY2UuZ2V0U2Vzc2lvbihpdGVtLnNlc3Npb25JZCk7XG5cdFx0aWYgKCFjaGF0TW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzZXNzaW9uID0gY2hhdE1vZGVsLmVkaXRpbmdTZXNzaW9uO1xuXHRcdGlmICghc2Vzc2lvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlcXVlc3RJZCA9IGlzUmVxdWVzdFZNKGl0ZW0pID8gaXRlbS5pZCA6XG5cdFx0XHRpc1Jlc3BvbnNlVk0oaXRlbSkgPyBpdGVtLnJlcXVlc3RJZCA6IHVuZGVmaW5lZDtcblxuXHRcdGlmIChyZXF1ZXN0SWQpIHtcblx0XHRcdGNvbnN0IGNoYXRSZXF1ZXN0cyA9IGNoYXRNb2RlbC5nZXRSZXF1ZXN0cygpO1xuXHRcdFx0Y29uc3QgaXRlbUluZGV4ID0gY2hhdFJlcXVlc3RzLmZpbmRJbmRleChyZXF1ZXN0ID0+IHJlcXVlc3QuaWQgPT09IHJlcXVlc3RJZCk7XG5cdFx0XHRjb25zdCBlZGl0c1RvVW5kbyA9IGNoYXRSZXF1ZXN0cy5sZW5ndGggLSBpdGVtSW5kZXg7XG5cblx0XHRcdGNvbnN0IHJlcXVlc3RzVG9SZW1vdmUgPSBjaGF0UmVxdWVzdHMuc2xpY2UoaXRlbUluZGV4KTtcblx0XHRcdGNvbnN0IHJlcXVlc3RJZHNUb1JlbW92ZSA9IG5ldyBTZXQocmVxdWVzdHNUb1JlbW92ZS5tYXAocmVxdWVzdCA9PiByZXF1ZXN0LmlkKSk7XG5cdFx0XHRjb25zdCBlbnRyaWVzTW9kaWZpZWRJblJlcXVlc3RzVG9SZW1vdmUgPSBzZXNzaW9uLmVudHJpZXMuZ2V0KCkuZmlsdGVyKChlbnRyeSkgPT4gcmVxdWVzdElkc1RvUmVtb3ZlLmhhcyhlbnRyeS5sYXN0TW9kaWZ5aW5nUmVxdWVzdElkKSkgPz8gW107XG5cdFx0XHRjb25zdCBzaG91bGRQcm9tcHQgPSBlbnRyaWVzTW9kaWZpZWRJblJlcXVlc3RzVG9SZW1vdmUubGVuZ3RoID4gMCAmJiBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnY2hhdC5lZGl0aW5nLmNvbmZpcm1FZGl0UmVxdWVzdFJlbW92YWwnKSA9PT0gdHJ1ZTtcblxuXHRcdFx0bGV0IG1lc3NhZ2U6IHN0cmluZztcblx0XHRcdGlmIChlZGl0c1RvVW5kbyA9PT0gMSkge1xuXHRcdFx0XHRpZiAoZW50cmllc01vZGlmaWVkSW5SZXF1ZXN0c1RvUmVtb3ZlLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHRcdG1lc3NhZ2UgPSBsb2NhbGl6ZSgnY2hhdC5yZW1vdmVMYXN0LmNvbmZpcm1hdGlvbi5tZXNzYWdlMicsIFwiVGhpcyB3aWxsIHJlbW92ZSB5b3VyIGxhc3QgcmVxdWVzdCBhbmQgdW5kbyB0aGUgZWRpdHMgbWFkZSB0byB7MH0uIERvIHlvdSB3YW50IHRvIHByb2NlZWQ/XCIsIGJhc2VuYW1lKGVudHJpZXNNb2RpZmllZEluUmVxdWVzdHNUb1JlbW92ZVswXS5tb2RpZmllZFVSSSkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG1lc3NhZ2UgPSBsb2NhbGl6ZSgnY2hhdC5yZW1vdmVMYXN0LmNvbmZpcm1hdGlvbi5tdWx0aXBsZUVkaXRzLm1lc3NhZ2UnLCBcIlRoaXMgd2lsbCByZW1vdmUgeW91ciBsYXN0IHJlcXVlc3QgYW5kIHVuZG8gZWRpdHMgbWFkZSB0byB7MH0gZmlsZXMgaW4geW91ciB3b3JraW5nIHNldC4gRG8geW91IHdhbnQgdG8gcHJvY2VlZD9cIiwgZW50cmllc01vZGlmaWVkSW5SZXF1ZXN0c1RvUmVtb3ZlLmxlbmd0aCk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmIChlbnRyaWVzTW9kaWZpZWRJblJlcXVlc3RzVG9SZW1vdmUubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRcdFx0bWVzc2FnZSA9IGxvY2FsaXplKCdjaGF0LnJlbW92ZS5jb25maXJtYXRpb24ubWVzc2FnZTInLCBcIlRoaXMgd2lsbCByZW1vdmUgYWxsIHN1YnNlcXVlbnQgcmVxdWVzdHMgYW5kIHVuZG8gZWRpdHMgbWFkZSB0byB7MH0uIERvIHlvdSB3YW50IHRvIHByb2NlZWQ/XCIsIGJhc2VuYW1lKGVudHJpZXNNb2RpZmllZEluUmVxdWVzdHNUb1JlbW92ZVswXS5tb2RpZmllZFVSSSkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdG1lc3NhZ2UgPSBsb2NhbGl6ZSgnY2hhdC5yZW1vdmUuY29uZmlybWF0aW9uLm11bHRpcGxlRWRpdHMubWVzc2FnZScsIFwiVGhpcyB3aWxsIHJlbW92ZSBhbGwgc3Vic2VxdWVudCByZXF1ZXN0cyBhbmQgdW5kbyBlZGl0cyBtYWRlIHRvIHswfSBmaWxlcyBpbiB5b3VyIHdvcmtpbmcgc2V0LiBEbyB5b3Ugd2FudCB0byBwcm9jZWVkP1wiLCBlbnRyaWVzTW9kaWZpZWRJblJlcXVlc3RzVG9SZW1vdmUubGVuZ3RoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjb25maXJtYXRpb24gPSBzaG91bGRQcm9tcHRcblx0XHRcdFx0PyBhd2FpdCBkaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0XHRcdHRpdGxlOiBlZGl0c1RvVW5kbyA9PT0gMVxuXHRcdFx0XHRcdFx0PyBsb2NhbGl6ZSgnY2hhdC5yZW1vdmVMYXN0LmNvbmZpcm1hdGlvbi50aXRsZScsIFwiRG8geW91IHdhbnQgdG8gdW5kbyB5b3VyIGxhc3QgZWRpdD9cIilcblx0XHRcdFx0XHRcdDogbG9jYWxpemUoJ2NoYXQucmVtb3ZlLmNvbmZpcm1hdGlvbi50aXRsZScsIFwiRG8geW91IHdhbnQgdG8gdW5kbyB7MH0gZWRpdHM/XCIsIGVkaXRzVG9VbmRvKSxcblx0XHRcdFx0XHRtZXNzYWdlOiBtZXNzYWdlLFxuXHRcdFx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKCdjaGF0LnJlbW92ZS5jb25maXJtYXRpb24ucHJpbWFyeUJ1dHRvbicsIFwiWWVzXCIpLFxuXHRcdFx0XHRcdGNoZWNrYm94OiB7IGxhYmVsOiBsb2NhbGl6ZSgnY2hhdC5yZW1vdmUuY29uZmlybWF0aW9uLmNoZWNrYm94JywgXCJEb24ndCBhc2sgYWdhaW5cIiksIGNoZWNrZWQ6IGZhbHNlIH0sXG5cdFx0XHRcdFx0dHlwZTogJ2luZm8nXG5cdFx0XHRcdH0pXG5cdFx0XHRcdDogeyBjb25maXJtZWQ6IHRydWUgfTtcblxuXHRcdFx0aWYgKCFjb25maXJtYXRpb24uY29uZmlybWVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGNvbmZpcm1hdGlvbi5jaGVja2JveENoZWNrZWQpIHtcblx0XHRcdFx0YXdhaXQgY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoJ2NoYXQuZWRpdGluZy5jb25maXJtRWRpdFJlcXVlc3RSZW1vdmFsJywgZmFsc2UpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBSZXN0b3JlIHRoZSBzbmFwc2hvdCB0byB3aGF0IGl0IHdhcyBiZWZvcmUgdGhlIHJlcXVlc3QocykgdGhhdCB3ZSBkZWxldGVkXG5cdFx0XHRjb25zdCBzbmFwc2hvdFJlcXVlc3RJZCA9IGNoYXRSZXF1ZXN0c1tpdGVtSW5kZXhdLmlkO1xuXHRcdFx0YXdhaXQgc2Vzc2lvbi5yZXN0b3JlU25hcHNob3Qoc25hcHNob3RSZXF1ZXN0SWQsIHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIE9wZW5Xb3JraW5nU2V0SGlzdG9yeUFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdHN0YXRpYyByZWFkb25seSBpZCA9ICdjaGF0Lm9wZW5GaWxlVXBkYXRlZEJ5U25hcHNob3QnO1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogT3BlbldvcmtpbmdTZXRIaXN0b3J5QWN0aW9uLmlkLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdjaGF0Lm9wZW5GaWxlVXBkYXRlZEJ5U25hcHNob3QubGFiZWwnLCBcIk9wZW4gRmlsZVwiKSxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ2hhdEVkaXRpbmdDb2RlQmxvY2tDb250ZXh0LFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRvcmRlcjogMCxcblx0XHRcdH0sXVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbnRleHQ6IHsgc2Vzc2lvbklkOiBzdHJpbmc7IHJlcXVlc3RJZDogc3RyaW5nOyB1cmk6IFVSSTsgc3RvcElkOiBzdHJpbmcgfCB1bmRlZmluZWQgfSB8IHVuZGVmaW5lZCA9IGFyZ3NbMF07XG5cdFx0aWYgKCFjb250ZXh0Py5zZXNzaW9uSWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoeyByZXNvdXJjZTogY29udGV4dC51cmkgfSk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgT3BlbldvcmtpbmdTZXRIaXN0b3J5QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IGlkID0gJ2NoYXQub3BlbkZpbGVTbmFwc2hvdCc7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBPcGVuV29ya2luZ1NldEhpc3RvcnlBY3Rpb24uaWQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ2NoYXQub3BlblNuYXBzaG90LmxhYmVsJywgXCJPcGVuIEZpbGUgU25hcHNob3RcIiksXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkNoYXRFZGl0aW5nQ29kZUJsb2NrQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHR9LF1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb250ZXh0OiB7IHNlc3Npb25JZDogc3RyaW5nOyByZXF1ZXN0SWQ6IHN0cmluZzsgdXJpOiBVUkk7IHN0b3BJZDogc3RyaW5nIHwgdW5kZWZpbmVkIH0gfCB1bmRlZmluZWQgPSBhcmdzWzBdO1xuXHRcdGlmICghY29udGV4dD8uc2Vzc2lvbklkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2hhdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRTZXJ2aWNlKTtcblx0XHRjb25zdCBjaGF0RWRpdGluZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRFZGl0aW5nU2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cblx0XHRjb25zdCBjaGF0TW9kZWwgPSBjaGF0U2VydmljZS5nZXRTZXNzaW9uKGNvbnRleHQuc2Vzc2lvbklkKTtcblx0XHRpZiAoIWNoYXRNb2RlbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNuYXBzaG90ID0gY2hhdEVkaXRpbmdTZXJ2aWNlLmdldEVkaXRpbmdTZXNzaW9uKGNoYXRNb2RlbC5zZXNzaW9uSWQpPy5nZXRTbmFwc2hvdFVyaShjb250ZXh0LnJlcXVlc3RJZCwgY29udGV4dC51cmksIGNvbnRleHQuc3RvcElkKTtcblx0XHRpZiAoc25hcHNob3QpIHtcblx0XHRcdGNvbnN0IGVkaXRvciA9IGF3YWl0IGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7IHJlc291cmNlOiBzbmFwc2hvdCwgbGFiZWw6IGxvY2FsaXplKCdjaGF0RWRpdGluZy5zbmFwc2hvdCcsICd7MH0gKFNuYXBzaG90KScsIGJhc2VuYW1lKGNvbnRleHQudXJpKSksIG9wdGlvbnM6IHsgdHJhbnNpZW50OiB0cnVlLCBhY3RpdmF0aW9uOiBFZGl0b3JBY3RpdmF0aW9uLkFDVElWQVRFIH0gfSk7XG5cdFx0XHRpZiAoaXNDb2RlRWRpdG9yKGVkaXRvcikpIHtcblx0XHRcdFx0ZWRpdG9yLnVwZGF0ZU9wdGlvbnMoeyByZWFkT25seTogdHJ1ZSB9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgUmVzb2x2ZVN5bWJvbHNDb250ZXh0QWN0aW9uIGV4dGVuZHMgRWRpdGluZ1Nlc3Npb25BY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uZWRpdHMuYWRkRmlsZXNGcm9tUmVmZXJlbmNlcycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdhZGRGaWxlc0Zyb21SZWZlcmVuY2VzJywgXCJBZGQgRmlsZXMgRnJvbSBSZWZlcmVuY2VzXCIpLFxuXHRcdFx0ZjE6IGZhbHNlLFxuXHRcdFx0Y2F0ZWdvcnk6IENIQVRfQ0FURUdPUlksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ2hhdElucHV0U3ltYm9sQXR0YWNobWVudENvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiAxLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ2hhdENvbnRleHRLZXlzLmNoYXRNb2RlLmlzRXF1YWxUbyhDaGF0TW9kZS5Bc2spLCBFZGl0b3JDb250ZXh0S2V5cy5oYXNSZWZlcmVuY2VQcm92aWRlcilcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bkVkaXRpbmdTZXNzaW9uQWN0aW9uKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0aW5nU2Vzc2lvbjogSUNoYXRFZGl0aW5nU2Vzc2lvbiwgY2hhdFdpZGdldDogSUNoYXRXaWRnZXQsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKGFyZ3MubGVuZ3RoID09PSAwIHx8ICFpc0xvY2F0aW9uKGFyZ3NbMF0pKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGV4dE1vZGVsU2VydmljZSA9IGFjY2Vzc29yLmdldChJVGV4dE1vZGVsU2VydmljZSk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTtcblx0XHRjb25zdCBzeW1ib2wgPSBhcmdzWzBdIGFzIExvY2F0aW9uO1xuXG5cdFx0Y29uc3QgbW9kZWxSZWZlcmVuY2UgPSBhd2FpdCB0ZXh0TW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKHN5bWJvbC51cmkpO1xuXHRcdGNvbnN0IHRleHRNb2RlbCA9IG1vZGVsUmVmZXJlbmNlLm9iamVjdC50ZXh0RWRpdG9yTW9kZWw7XG5cdFx0aWYgKCF0ZXh0TW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwb3NpdGlvbiA9IG5ldyBQb3NpdGlvbihzeW1ib2wucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBzeW1ib2wucmFuZ2Uuc3RhcnRDb2x1bW4pO1xuXG5cdFx0Y29uc3QgW3JlZmVyZW5jZXMsIGRlZmluaXRpb25zLCBpbXBsZW1lbnRhdGlvbnNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0dGhpcy5nZXRSZWZlcmVuY2VzKHBvc2l0aW9uLCB0ZXh0TW9kZWwsIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKSxcblx0XHRcdHRoaXMuZ2V0RGVmaW5pdGlvbnMocG9zaXRpb24sIHRleHRNb2RlbCwgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpLFxuXHRcdFx0dGhpcy5nZXRJbXBsZW1lbnRhdGlvbnMocG9zaXRpb24sIHRleHRNb2RlbCwgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpXG5cdFx0XSk7XG5cblx0XHQvLyBTb3J0IHRoZSByZWZlcmVuY2VzLCBkZWZpbml0aW9ucyBhbmQgaW1wbGVtZW50YXRpb25zIGJ5XG5cdFx0Ly8gaG93IGltcG9ydGFudCBpdCBpcyB0aGF0IHRoZXkgbWFrZSBpdCBpbnRvIHRoZSB3b3JraW5nIHNldCBhcyBpdCBoYXMgbGltaXRlZCBzaXplXG5cdFx0Y29uc3QgYXR0YWNobWVudHMgPSBbXTtcblx0XHRmb3IgKGNvbnN0IHJlZmVyZW5jZSBvZiBbLi4uZGVmaW5pdGlvbnMsIC4uLmltcGxlbWVudGF0aW9ucywgLi4ucmVmZXJlbmNlc10pIHtcblx0XHRcdGF0dGFjaG1lbnRzLnB1c2goY2hhdFdpZGdldC5hdHRhY2htZW50TW9kZWwuYXNWYXJpYWJsZUVudHJ5KHJlZmVyZW5jZS51cmkpKTtcblx0XHR9XG5cblx0XHRjaGF0V2lkZ2V0LmF0dGFjaG1lbnRNb2RlbC5hZGRDb250ZXh0KC4uLmF0dGFjaG1lbnRzKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0UmVmZXJlbmNlcyhwb3NpdGlvbjogUG9zaXRpb24sIHRleHRNb2RlbDogSVRleHRNb2RlbCwgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSk6IFByb21pc2U8TG9jYXRpb25bXT4ge1xuXHRcdGNvbnN0IHJlZmVyZW5jZVByb3ZpZGVycyA9IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLnJlZmVyZW5jZVByb3ZpZGVyLmFsbCh0ZXh0TW9kZWwpO1xuXG5cdFx0Y29uc3QgcmVmZXJlbmNlcyA9IGF3YWl0IFByb21pc2UuYWxsKHJlZmVyZW5jZVByb3ZpZGVycy5tYXAoYXN5bmMgKHJlZmVyZW5jZVByb3ZpZGVyKSA9PiB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgcmVmZXJlbmNlUHJvdmlkZXIucHJvdmlkZVJlZmVyZW5jZXModGV4dE1vZGVsLCBwb3NpdGlvbiwgeyBpbmNsdWRlRGVjbGFyYXRpb246IHRydWUgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkgPz8gW107XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIHJlZmVyZW5jZXMuZmxhdCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXREZWZpbml0aW9ucyhwb3NpdGlvbjogUG9zaXRpb24sIHRleHRNb2RlbDogSVRleHRNb2RlbCwgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSk6IFByb21pc2U8TG9jYXRpb25bXT4ge1xuXHRcdGNvbnN0IGRlZmluaXRpb25Qcm92aWRlcnMgPSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kZWZpbml0aW9uUHJvdmlkZXIuYWxsKHRleHRNb2RlbCk7XG5cblx0XHRjb25zdCBkZWZpbml0aW9ucyA9IGF3YWl0IFByb21pc2UuYWxsKGRlZmluaXRpb25Qcm92aWRlcnMubWFwKGFzeW5jIChkZWZpbml0aW9uUHJvdmlkZXIpID0+IHtcblx0XHRcdHJldHVybiBhd2FpdCBkZWZpbml0aW9uUHJvdmlkZXIucHJvdmlkZURlZmluaXRpb24odGV4dE1vZGVsLCBwb3NpdGlvbiwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkgPz8gW107XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIGRlZmluaXRpb25zLmZsYXQoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0SW1wbGVtZW50YXRpb25zKHBvc2l0aW9uOiBQb3NpdGlvbiwgdGV4dE1vZGVsOiBJVGV4dE1vZGVsLCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTogUHJvbWlzZTxMb2NhdGlvbltdPiB7XG5cdFx0Y29uc3QgaW1wbGVtZW50YXRpb25Qcm92aWRlcnMgPSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5pbXBsZW1lbnRhdGlvblByb3ZpZGVyLmFsbCh0ZXh0TW9kZWwpO1xuXG5cdFx0Y29uc3QgaW1wbGVtZW50YXRpb25zID0gYXdhaXQgUHJvbWlzZS5hbGwoaW1wbGVtZW50YXRpb25Qcm92aWRlcnMubWFwKGFzeW5jIChpbXBsZW1lbnRhdGlvblByb3ZpZGVyKSA9PiB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgaW1wbGVtZW50YXRpb25Qcm92aWRlci5wcm92aWRlSW1wbGVtZW50YXRpb24odGV4dE1vZGVsLCBwb3NpdGlvbiwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkgPz8gW107XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIGltcGxlbWVudGF0aW9ucy5mbGF0KCk7XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBQUE7QUFLQSxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxTQUFTLGNBQWM7QUFDaEMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsa0JBQTRCO0FBRXJDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsVUFBVSxpQkFBaUI7QUFDcEMsU0FBUyxTQUEwQixRQUFRLHVCQUF1QjtBQUNsRSxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGFBQWEsNEJBQTRCO0FBQ2xELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsb0NBQW9DO0FBQzdDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsbUNBQW1DLGdEQUFnRCwrQkFBK0Isc0NBQXNDLHNDQUFzQywrQkFBK0IsMkNBQTJDLHFCQUEwQyw4QkFBOEIsNEJBQTRCO0FBQ3JYLFNBQVMsb0JBQW9CO0FB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
