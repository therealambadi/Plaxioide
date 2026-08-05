import { localize, localize2 } from "../../../../../nls.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../../platform/actions/common/actions.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { CHAT_CATEGORY } from "../actions/chatActions.js";
import { ctxHasEditorModification, ctxHasRequestInProgress, ctxReviewModeEnabled } from "./chatEditingEditorContextKeys.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { EditorContextKeys } from "../../../../../editor/common/editorContextKeys.js";
import { ACTIVE_GROUP, IEditorService } from "../../../../services/editor/common/editorService.js";
import { CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME, IChatEditingService, WorkingSetEntryState } from "../../common/chatEditingService.js";
import { resolveCommandsContext } from "../../../../browser/parts/editor/editorCommandsContext.js";
import { IListService } from "../../../../../platform/list/browser/listService.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { MultiDiffEditorInput } from "../../../multiDiffEditor/browser/multiDiffEditorInput.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { ActiveEditorContext } from "../../../../common/contextkeys.js";
import { EditorResourceAccessor, SideBySideEditor, TEXT_DIFF_EDITOR_ID } from "../../../../common/editor.js";
import { ChatContextKeys } from "../../common/chatContextKeys.js";
class ChatEditingEditorAction extends Action2 {
  constructor(desc) {
    super({
      category: CHAT_CATEGORY,
      ...desc
    });
  }
  async run(accessor, ...args) {
    const instaService = accessor.get(IInstantiationService);
    const chatEditingService = accessor.get(IChatEditingService);
    const editorService = accessor.get(IEditorService);
    const uri = EditorResourceAccessor.getOriginalUri(editorService.activeEditorPane?.input, { supportSideBySide: SideBySideEditor.PRIMARY });
    if (!uri || !editorService.activeEditorPane) {
      return;
    }
    const session = chatEditingService.editingSessionsObs.get().find((candidate) => candidate.getEntry(uri));
    if (!session) {
      return;
    }
    const entry = session.getEntry(uri);
    const ctrl = entry.getEditorIntegration(editorService.activeEditorPane);
    return instaService.invokeFunction(this.runChatEditingCommand.bind(this), session, entry, ctrl, ...args);
  }
}
class NavigateAction extends ChatEditingEditorAction {
  constructor(next) {
    super({
      id: next ? "chatEditor.action.navigateNext" : "chatEditor.action.navigatePrevious",
      title: next ? localize2("next", "Go to Next Chat Edit") : localize2("prev", "Go to Previous Chat Edit"),
      icon: next ? Codicon.arrowDown : Codicon.arrowUp,
      precondition: ContextKeyExpr.and(ChatContextKeys.enabled, ctxHasRequestInProgress.negate()),
      keybinding: {
        primary: next ? KeyMod.Alt | KeyCode.F5 : KeyMod.Alt | KeyMod.Shift | KeyCode.F5,
        weight: KeybindingWeight.WorkbenchContrib,
        when: ContextKeyExpr.and(
          ctxHasEditorModification,
          EditorContextKeys.focus
        )
      },
      f1: true,
      menu: {
        id: MenuId.ChatEditingEditorContent,
        group: "navigate",
        order: !next ? 2 : 3,
        when: ContextKeyExpr.and(ctxReviewModeEnabled, ctxHasRequestInProgress.negate())
      }
    });
    this.next = next;
  }
  async runChatEditingCommand(accessor, session, entry, ctrl) {
    const instaService = accessor.get(IInstantiationService);
    const done = this.next ? ctrl.next(false) : ctrl.previous(false);
    if (done) {
      return;
    }
    const didOpenNext = await instaService.invokeFunction(openNextOrPreviousChange, session, entry, this.next);
    if (didOpenNext) {
      return;
    }
    this.next ? ctrl.next(true) : ctrl.previous(true);
  }
}
async function openNextOrPreviousChange(accessor, session, entry, next) {
  const editorService = accessor.get(IEditorService);
  const entries = session.entries.get();
  let idx = entries.indexOf(entry);
  let newEntry;
  while (true) {
    idx = (idx + (next ? 1 : -1) + entries.length) % entries.length;
    newEntry = entries[idx];
    if (newEntry.state.get() === WorkingSetEntryState.Modified) {
      break;
    } else if (newEntry === entry) {
      return false;
    }
  }
  const pane = await editorService.openEditor({
    resource: newEntry.modifiedURI,
    options: {
      revealIfOpened: false,
      revealIfVisible: false
    }
  }, ACTIVE_GROUP);
  if (!pane) {
    return false;
  }
  if (session.entries.get().includes(newEntry)) {
    newEntry.getEditorIntegration(pane).reveal(next);
  }
  return true;
}
class AcceptDiscardAction extends ChatEditingEditorAction {
  constructor(id, accept) {
    super({
      id,
      title: accept ? localize2("accept", "Keep Chat Edits") : localize2("discard", "Undo Chat Edits"),
      shortTitle: accept ? localize2("accept2", "Keep") : localize2("discard2", "Undo"),
      tooltip: accept ? localize2("accept3", "Keep Chat Edits in this File") : localize2("discard3", "Undo Chat Edits in this File"),
      precondition: ContextKeyExpr.and(ctxHasEditorModification, ctxHasRequestInProgress.negate()),
      icon: accept ? Codicon.check : Codicon.discard,
      f1: true,
      keybinding: {
        when: EditorContextKeys.focus,
        weight: KeybindingWeight.WorkbenchContrib,
        primary: accept ? KeyMod.CtrlCmd | KeyCode.Enter : KeyMod.CtrlCmd | KeyCode.Backspace
      },
      menu: {
        id: MenuId.ChatEditingEditorContent,
        group: "a_resolve",
        order: accept ? 0 : 1,
        when: ContextKeyExpr.and(!accept ? ctxReviewModeEnabled : void 0, ctxHasRequestInProgress.negate())
      }
    });
    this.accept = accept;
  }
  async runChatEditingCommand(accessor, session, entry, _integration) {
    const instaService = accessor.get(IInstantiationService);
    if (this.accept) {
      session.accept(entry.modifiedURI);
    } else {
      session.reject(entry.modifiedURI);
    }
    await instaService.invokeFunction(openNextOrPreviousChange, session, entry, true);
  }
}
const _AcceptAction = class _AcceptAction extends AcceptDiscardAction {
  constructor() {
    super(_AcceptAction.ID, true);
  }
};
_AcceptAction.ID = "chatEditor.action.accept";
let AcceptAction = _AcceptAction;
const _RejectAction = class _RejectAction extends AcceptDiscardAction {
  constructor() {
    super(_RejectAction.ID, false);
  }
};
_RejectAction.ID = "chatEditor.action.reject";
let RejectAction = _RejectAction;
class AcceptRejectHunkAction extends ChatEditingEditorAction {
  constructor(_accept) {
    super(
      {
        id: _accept ? "chatEditor.action.acceptHunk" : "chatEditor.action.undoHunk",
        title: _accept ? localize2("acceptHunk", "Keep this Change") : localize2("undo", "Undo this Change"),
        precondition: ContextKeyExpr.and(ctxHasEditorModification, ctxHasRequestInProgress.negate()),
        icon: _accept ? Codicon.check : Codicon.discard,
        f1: true,
        keybinding: {
          when: EditorContextKeys.focus,
          weight: KeybindingWeight.WorkbenchContrib,
          primary: _accept ? KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Enter : KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Backspace
        },
        menu: {
          id: MenuId.ChatEditingEditorHunk,
          order: 1
        }
      }
    );
    this._accept = _accept;
  }
  runChatEditingCommand(_accessor, _session, _entry, ctrl, ...args) {
    if (this._accept) {
      ctrl.acceptNearestChange(args[0]);
    } else {
      ctrl.rejectNearestChange(args[0]);
    }
  }
}
class ToggleDiffAction extends ChatEditingEditorAction {
  constructor() {
    super({
      id: "chatEditor.action.toggleDiff",
      title: localize2("diff", "Toggle Diff Editor"),
      category: CHAT_CATEGORY,
      toggled: {
        condition: ContextKeyExpr.or(EditorContextKeys.inDiffEditor, ActiveEditorContext.isEqualTo(TEXT_DIFF_EDITOR_ID)),
        icon: Codicon.goToFile
      },
      precondition: ContextKeyExpr.and(ctxHasEditorModification, ctxHasRequestInProgress.negate()),
      icon: Codicon.diffSingle,
      keybinding: {
        when: EditorContextKeys.focus,
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyMod.Alt | KeyMod.Shift | KeyCode.F7
      },
      menu: [{
        id: MenuId.ChatEditingEditorHunk,
        order: 10
      }, {
        id: MenuId.ChatEditingEditorContent,
        group: "a_resolve",
        order: 2,
        when: ContextKeyExpr.and(ctxReviewModeEnabled, ctxHasRequestInProgress.negate())
      }]
    });
  }
  runChatEditingCommand(_accessor, _session, _entry, integration, ...args) {
    integration.toggleDiff(args[0]);
  }
}
class ToggleAccessibleDiffViewAction extends ChatEditingEditorAction {
  constructor() {
    super({
      id: "chatEditor.action.showAccessibleDiffView",
      title: localize2("accessibleDiff", "Show Accessible Diff View"),
      f1: true,
      precondition: ContextKeyExpr.and(ctxHasEditorModification, ctxHasRequestInProgress.negate()),
      keybinding: {
        when: EditorContextKeys.focus,
        weight: KeybindingWeight.WorkbenchContrib,
        primary: KeyCode.F7
      }
    });
  }
  runChatEditingCommand(_accessor, _session, _entry, integration) {
    integration.enableAccessibleDiffView();
  }
}
class ReviewChangesAction extends ChatEditingEditorAction {
  constructor() {
    super({
      id: "chatEditor.action.reviewChanges",
      title: localize2("review", "Review"),
      precondition: ContextKeyExpr.and(ctxHasEditorModification, ctxHasRequestInProgress.negate()),
      menu: [{
        id: MenuId.ChatEditingEditorContent,
        group: "a_resolve",
        order: 3,
        when: ContextKeyExpr.and(ctxReviewModeEnabled.negate(), ctxHasRequestInProgress.negate())
      }]
    });
  }
  runChatEditingCommand(_accessor, _session, entry, _integration, ..._args) {
    entry.enableReviewModeUntilSettled();
  }
}
class MultiDiffAcceptDiscardAction extends Action2 {
  constructor(accept) {
    super({
      id: accept ? "chatEditing.multidiff.acceptAllFiles" : "chatEditing.multidiff.discardAllFiles",
      title: accept ? localize("accept4", "Keep All Edits") : localize("discard4", "Undo All Edits"),
      icon: accept ? Codicon.check : Codicon.discard,
      menu: {
        when: ContextKeyExpr.equals("resourceScheme", CHAT_EDITING_MULTI_DIFF_SOURCE_RESOLVER_SCHEME),
        id: MenuId.EditorTitle,
        order: accept ? 0 : 1,
        group: "navigation"
      }
    });
    this.accept = accept;
  }
  async run(accessor, ...args) {
    const chatEditingService = accessor.get(IChatEditingService);
    const editorService = accessor.get(IEditorService);
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const listService = accessor.get(IListService);
    const resolvedContext = resolveCommandsContext(args, editorService, editorGroupsService, listService);
    const groupContext = resolvedContext.groupedEditors[0];
    if (!groupContext) {
      return;
    }
    const editor = groupContext.editors[0];
    if (!(editor instanceof MultiDiffEditorInput) || !editor.resource) {
      return;
    }
    const session = chatEditingService.getEditingSession(editor.resource.authority);
    if (this.accept) {
      await session?.accept();
    } else {
      await session?.reject();
    }
  }
}
function registerChatEditorActions() {
  registerAction2(class NextAction extends NavigateAction {
    constructor() {
      super(true);
    }
  });
  registerAction2(class PrevAction extends NavigateAction {
    constructor() {
      super(false);
    }
  });
  registerAction2(ReviewChangesAction);
  registerAction2(AcceptAction);
  registerAction2(RejectAction);
  registerAction2(class AcceptHunkAction extends AcceptRejectHunkAction {
    constructor() {
      super(true);
    }
  });
  registerAction2(class AcceptHunkAction extends AcceptRejectHunkAction {
    constructor() {
      super(false);
    }
  });
  registerAction2(ToggleDiffAction);
  registerAction2(ToggleAccessibleDiffViewAction);
  registerAction2(class extends MultiDiffAcceptDiscardAction {
    constructor() {
      super(true);
    }
  });
  registerAction2(class extends MultiDiffAcceptDiscardAction {
    constructor() {
      super(false);
    }
  });
  MenuRegistry.appendMenuItem(MenuId.ChatEditingEditorContent, {
    command: {
      id: navigationBearingFakeActionId,
      title: localize("label", "Navigation Status"),
      precondition: ContextKeyExpr.false()
    },
    group: "navigate",
    order: -1,
    when: ContextKeyExpr.and(ctxReviewModeEnabled, ctxHasRequestInProgress.negate())
  });
}
const navigationBearingFakeActionId = "chatEditor.navigation.bearings";
export {
  AcceptAction,
  RejectAction,
  ReviewChangesAction,
  navigationBearingFakeActionId,
  registerChatEditorActions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdEVkaXRpbmcvY2hhdEVkaXRpbmdFZGl0b3JBY3Rpb25zLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIElBY3Rpb24yT3B0aW9ucywgTWVudUlkLCBNZW51UmVnaXN0cnksIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgQ0hBVF9DQVRFR09SWSB9IGZyb20gJy4uL2FjdGlvbnMvY2hhdEFjdGlvbnMuanMnO1xuaW1wb3J0IHsgY3R4SGFzRWRpdG9yTW9kaWZpY2F0aW9uLCBjdHhIYXNSZXF1ZXN0SW5Qcm9ncmVzcywgY3R4UmV2aWV3TW9kZUVuYWJsZWQgfSBmcm9tICcuL2NoYXRFZGl0aW5nRWRpdG9yQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IEVkaXRvckNvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBBQ1RJVkVfR1JPVVAsIElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENIQVRfRURJVElOR19NVUxUSV9ESUZGX1NPVVJDRV9SRVNPTFZFUl9TQ0hFTUUsIElDaGF0RWRpdGluZ1NlcnZpY2UsIElDaGF0RWRpdGluZ1Nlc3Npb24sIElNb2RpZmllZEZpbGVFbnRyeSwgSU1vZGlmaWVkRmlsZUVudHJ5RWRpdG9ySW50ZWdyYXRpb24sIFdvcmtpbmdTZXRFbnRyeVN0YXRlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRFZGl0aW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyByZXNvbHZlQ29tbWFuZHNDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yQ29tbWFuZHNDb250ZXh0LmpzJztcbmltcG9ydCB7IElMaXN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBNdWx0aURpZmZFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL211bHRpRGlmZkVkaXRvci9icm93c2VyL211bHRpRGlmZkVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgQWN0aXZlRWRpdG9yQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLCBTaWRlQnlTaWRlRWRpdG9yLCBURVhUX0RJRkZfRURJVE9SX0lEIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBDaGF0Q29udGV4dEtleXMgfSBmcm9tICcuLi8uLi9jb21tb24vY2hhdENvbnRleHRLZXlzLmpzJztcblxuXG5hYnN0cmFjdCBjbGFzcyBDaGF0RWRpdGluZ0VkaXRvckFjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKGRlc2M6IFJlYWRvbmx5PElBY3Rpb24yT3B0aW9ucz4pIHtcblx0XHRzdXBlcih7XG5cdFx0XHRjYXRlZ29yeTogQ0hBVF9DQVRFR09SWSxcblx0XHRcdC4uLmRlc2Ncblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pIHtcblxuXHRcdGNvbnN0IGluc3RhU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IGNoYXRFZGl0aW5nU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2hhdEVkaXRpbmdTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHVyaSA9IEVkaXRvclJlc291cmNlQWNjZXNzb3IuZ2V0T3JpZ2luYWxVcmkoZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lPy5pbnB1dCwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5QUklNQVJZIH0pO1xuXG5cdFx0aWYgKCF1cmkgfHwgIWVkaXRvclNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlc3Npb24gPSBjaGF0RWRpdGluZ1NlcnZpY2UuZWRpdGluZ1Nlc3Npb25zT2JzLmdldCgpXG5cdFx0XHQuZmluZChjYW5kaWRhdGUgPT4gY2FuZGlkYXRlLmdldEVudHJ5KHVyaSkpO1xuXG5cdFx0aWYgKCFzZXNzaW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZW50cnkgPSBzZXNzaW9uLmdldEVudHJ5KHVyaSkhO1xuXHRcdGNvbnN0IGN0cmwgPSBlbnRyeS5nZXRFZGl0b3JJbnRlZ3JhdGlvbihlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmUpO1xuXG5cdFx0cmV0dXJuIGluc3RhU2VydmljZS5pbnZva2VGdW5jdGlvbih0aGlzLnJ1bkNoYXRFZGl0aW5nQ29tbWFuZC5iaW5kKHRoaXMpLCBzZXNzaW9uLCBlbnRyeSwgY3RybCwgLi4uYXJncyk7XG5cdH1cblxuXHRhYnN0cmFjdCBydW5DaGF0RWRpdGluZ0NvbW1hbmQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHNlc3Npb246IElDaGF0RWRpdGluZ1Nlc3Npb24sIGVudHJ5OiBJTW9kaWZpZWRGaWxlRW50cnksIGludGVncmF0aW9uOiBJTW9kaWZpZWRGaWxlRW50cnlFZGl0b3JJbnRlZ3JhdGlvbiwgLi4uYXJnczogYW55W10pOiBQcm9taXNlPHZvaWQ+IHwgdm9pZDtcbn1cblxuYWJzdHJhY3QgY2xhc3MgTmF2aWdhdGVBY3Rpb24gZXh0ZW5kcyBDaGF0RWRpdGluZ0VkaXRvckFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IocmVhZG9ubHkgbmV4dDogYm9vbGVhbikge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBuZXh0XG5cdFx0XHRcdD8gJ2NoYXRFZGl0b3IuYWN0aW9uLm5hdmlnYXRlTmV4dCdcblx0XHRcdFx0OiAnY2hhdEVkaXRvci5hY3Rpb24ubmF2aWdhdGVQcmV2aW91cycsXG5cdFx0XHR0aXRsZTogbmV4dFxuXHRcdFx0XHQ/IGxvY2FsaXplMignbmV4dCcsICdHbyB0byBOZXh0IENoYXQgRWRpdCcpXG5cdFx0XHRcdDogbG9jYWxpemUyKCdwcmV2JywgJ0dvIHRvIFByZXZpb3VzIENoYXQgRWRpdCcpLFxuXHRcdFx0aWNvbjogbmV4dCA/IENvZGljb24uYXJyb3dEb3duIDogQ29kaWNvbi5hcnJvd1VwLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQ2hhdENvbnRleHRLZXlzLmVuYWJsZWQsIGN0eEhhc1JlcXVlc3RJblByb2dyZXNzLm5lZ2F0ZSgpKSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0cHJpbWFyeTogbmV4dFxuXHRcdFx0XHRcdD8gS2V5TW9kLkFsdCB8IEtleUNvZGUuRjVcblx0XHRcdFx0XHQ6IEtleU1vZC5BbHQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkY1LFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdGN0eEhhc0VkaXRvck1vZGlmaWNhdGlvbixcblx0XHRcdFx0XHRFZGl0b3JDb250ZXh0S2V5cy5mb2N1c1xuXHRcdFx0XHQpLFxuXHRcdFx0fSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkNoYXRFZGl0aW5nRWRpdG9yQ29udGVudCxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0ZScsXG5cdFx0XHRcdG9yZGVyOiAhbmV4dCA/IDIgOiAzLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoY3R4UmV2aWV3TW9kZUVuYWJsZWQsIGN0eEhhc1JlcXVlc3RJblByb2dyZXNzLm5lZ2F0ZSgpKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuQ2hhdEVkaXRpbmdDb21tYW5kKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBzZXNzaW9uOiBJQ2hhdEVkaXRpbmdTZXNzaW9uLCBlbnRyeTogSU1vZGlmaWVkRmlsZUVudHJ5LCBjdHJsOiBJTW9kaWZpZWRGaWxlRW50cnlFZGl0b3JJbnRlZ3JhdGlvbik6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0Y29uc3QgaW5zdGFTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSk7XG5cblx0XHRjb25zdCBkb25lID0gdGhpcy5uZXh0XG5cdFx0XHQ/IGN0cmwubmV4dChmYWxzZSlcblx0XHRcdDogY3RybC5wcmV2aW91cyhmYWxzZSk7XG5cblx0XHRpZiAoZG9uZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRpZE9wZW5OZXh0ID0gYXdhaXQgaW5zdGFTZXJ2aWNlLmludm9rZUZ1bmN0aW9uKG9wZW5OZXh0T3JQcmV2aW91c0NoYW5nZSwgc2Vzc2lvbiwgZW50cnksIHRoaXMubmV4dCk7XG5cdFx0aWYgKGRpZE9wZW5OZXh0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly9FTFNFOiB3cmFwIGluc2lkZSB0aGUgc2FtZSBmaWxlXG5cdFx0dGhpcy5uZXh0XG5cdFx0XHQ/IGN0cmwubmV4dCh0cnVlKVxuXHRcdFx0OiBjdHJsLnByZXZpb3VzKHRydWUpO1xuXHR9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIG9wZW5OZXh0T3JQcmV2aW91c0NoYW5nZShhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvciwgc2Vzc2lvbjogSUNoYXRFZGl0aW5nU2Vzc2lvbiwgZW50cnk6IElNb2RpZmllZEZpbGVFbnRyeSwgbmV4dDogYm9vbGVhbikge1xuXG5cdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXG5cdGNvbnN0IGVudHJpZXMgPSBzZXNzaW9uLmVudHJpZXMuZ2V0KCk7XG5cdGxldCBpZHggPSBlbnRyaWVzLmluZGV4T2YoZW50cnkpO1xuXG5cdGxldCBuZXdFbnRyeTogSU1vZGlmaWVkRmlsZUVudHJ5O1xuXHR3aGlsZSAodHJ1ZSkge1xuXHRcdGlkeCA9IChpZHggKyAobmV4dCA/IDEgOiAtMSkgKyBlbnRyaWVzLmxlbmd0aCkgJSBlbnRyaWVzLmxlbmd0aDtcblx0XHRuZXdFbnRyeSA9IGVudHJpZXNbaWR4XTtcblx0XHRpZiAobmV3RW50cnkuc3RhdGUuZ2V0KCkgPT09IFdvcmtpbmdTZXRFbnRyeVN0YXRlLk1vZGlmaWVkKSB7XG5cdFx0XHRicmVhaztcblx0XHR9IGVsc2UgaWYgKG5ld0VudHJ5ID09PSBlbnRyeSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IHBhbmUgPSBhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdHJlc291cmNlOiBuZXdFbnRyeS5tb2RpZmllZFVSSSxcblx0XHRvcHRpb25zOiB7XG5cdFx0XHRyZXZlYWxJZk9wZW5lZDogZmFsc2UsXG5cdFx0XHRyZXZlYWxJZlZpc2libGU6IGZhbHNlLFxuXHRcdH1cblx0fSwgQUNUSVZFX0dST1VQKTtcblxuXHRpZiAoIXBhbmUpIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRpZiAoc2Vzc2lvbi5lbnRyaWVzLmdldCgpLmluY2x1ZGVzKG5ld0VudHJ5KSkge1xuXHRcdC8vIG1ha2Ugc3VyZSBuZXdFbnRyeSBpcyBzdGlsbCB2YWxpZCFcblx0XHRuZXdFbnRyeS5nZXRFZGl0b3JJbnRlZ3JhdGlvbihwYW5lKS5yZXZlYWwobmV4dCk7XG5cdH1cblxuXHRyZXR1cm4gdHJ1ZTtcbn1cblxuYWJzdHJhY3QgY2xhc3MgQWNjZXB0RGlzY2FyZEFjdGlvbiBleHRlbmRzIENoYXRFZGl0aW5nRWRpdG9yQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcihpZDogc3RyaW5nLCByZWFkb25seSBhY2NlcHQ6IGJvb2xlYW4pIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZCxcblx0XHRcdHRpdGxlOiBhY2NlcHRcblx0XHRcdFx0PyBsb2NhbGl6ZTIoJ2FjY2VwdCcsICdLZWVwIENoYXQgRWRpdHMnKVxuXHRcdFx0XHQ6IGxvY2FsaXplMignZGlzY2FyZCcsICdVbmRvIENoYXQgRWRpdHMnKSxcblx0XHRcdHNob3J0VGl0bGU6IGFjY2VwdFxuXHRcdFx0XHQ/IGxvY2FsaXplMignYWNjZXB0MicsICdLZWVwJylcblx0XHRcdFx0OiBsb2NhbGl6ZTIoJ2Rpc2NhcmQyJywgJ1VuZG8nKSxcblx0XHRcdHRvb2x0aXA6IGFjY2VwdFxuXHRcdFx0XHQ/IGxvY2FsaXplMignYWNjZXB0MycsICdLZWVwIENoYXQgRWRpdHMgaW4gdGhpcyBGaWxlJylcblx0XHRcdFx0OiBsb2NhbGl6ZTIoJ2Rpc2NhcmQzJywgJ1VuZG8gQ2hhdCBFZGl0cyBpbiB0aGlzIEZpbGUnKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKGN0eEhhc0VkaXRvck1vZGlmaWNhdGlvbiwgY3R4SGFzUmVxdWVzdEluUHJvZ3Jlc3MubmVnYXRlKCkpLFxuXHRcdFx0aWNvbjogYWNjZXB0XG5cdFx0XHRcdD8gQ29kaWNvbi5jaGVja1xuXHRcdFx0XHQ6IENvZGljb24uZGlzY2FyZCxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3aGVuOiBFZGl0b3JDb250ZXh0S2V5cy5mb2N1cyxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdHByaW1hcnk6IGFjY2VwdFxuXHRcdFx0XHRcdD8gS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkVudGVyXG5cdFx0XHRcdFx0OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuQmFja3NwYWNlXG5cdFx0XHR9LFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkNoYXRFZGl0aW5nRWRpdG9yQ29udGVudCxcblx0XHRcdFx0Z3JvdXA6ICdhX3Jlc29sdmUnLFxuXHRcdFx0XHRvcmRlcjogYWNjZXB0ID8gMCA6IDEsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZCghYWNjZXB0ID8gY3R4UmV2aWV3TW9kZUVuYWJsZWQgOiB1bmRlZmluZWQsIGN0eEhhc1JlcXVlc3RJblByb2dyZXNzLm5lZ2F0ZSgpKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuQ2hhdEVkaXRpbmdDb21tYW5kKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBzZXNzaW9uOiBJQ2hhdEVkaXRpbmdTZXNzaW9uLCBlbnRyeTogSU1vZGlmaWVkRmlsZUVudHJ5LCBfaW50ZWdyYXRpb246IElNb2RpZmllZEZpbGVFbnRyeUVkaXRvckludGVncmF0aW9uKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHRjb25zdCBpbnN0YVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblxuXHRcdGlmICh0aGlzLmFjY2VwdCkge1xuXHRcdFx0c2Vzc2lvbi5hY2NlcHQoZW50cnkubW9kaWZpZWRVUkkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzZXNzaW9uLnJlamVjdChlbnRyeS5tb2RpZmllZFVSSSk7XG5cdFx0fVxuXG5cdFx0YXdhaXQgaW5zdGFTZXJ2aWNlLmludm9rZUZ1bmN0aW9uKG9wZW5OZXh0T3JQcmV2aW91c0NoYW5nZSwgc2Vzc2lvbiwgZW50cnksIHRydWUpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBBY2NlcHRBY3Rpb24gZXh0ZW5kcyBBY2NlcHREaXNjYXJkQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnY2hhdEVkaXRvci5hY3Rpb24uYWNjZXB0JztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcihBY2NlcHRBY3Rpb24uSUQsIHRydWUpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBSZWplY3RBY3Rpb24gZXh0ZW5kcyBBY2NlcHREaXNjYXJkQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnY2hhdEVkaXRvci5hY3Rpb24ucmVqZWN0JztcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcihSZWplY3RBY3Rpb24uSUQsIGZhbHNlKTtcblx0fVxufVxuXG5hYnN0cmFjdCBjbGFzcyBBY2NlcHRSZWplY3RIdW5rQWN0aW9uIGV4dGVuZHMgQ2hhdEVkaXRpbmdFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgX2FjY2VwdDogYm9vbGVhbikge1xuXHRcdHN1cGVyKFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogX2FjY2VwdCA/ICdjaGF0RWRpdG9yLmFjdGlvbi5hY2NlcHRIdW5rJyA6ICdjaGF0RWRpdG9yLmFjdGlvbi51bmRvSHVuaycsXG5cdFx0XHRcdHRpdGxlOiBfYWNjZXB0ID8gbG9jYWxpemUyKCdhY2NlcHRIdW5rJywgJ0tlZXAgdGhpcyBDaGFuZ2UnKSA6IGxvY2FsaXplMigndW5kbycsICdVbmRvIHRoaXMgQ2hhbmdlJyksXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKGN0eEhhc0VkaXRvck1vZGlmaWNhdGlvbiwgY3R4SGFzUmVxdWVzdEluUHJvZ3Jlc3MubmVnYXRlKCkpLFxuXHRcdFx0XHRpY29uOiBfYWNjZXB0ID8gQ29kaWNvbi5jaGVjayA6IENvZGljb24uZGlzY2FyZCxcblx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0XHR3aGVuOiBFZGl0b3JDb250ZXh0S2V5cy5mb2N1cyxcblx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0XHRwcmltYXJ5OiBfYWNjZXB0XG5cdFx0XHRcdFx0XHQ/IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5FbnRlclxuXHRcdFx0XHRcdFx0OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuQmFja3NwYWNlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRpZDogTWVudUlkLkNoYXRFZGl0aW5nRWRpdG9ySHVuayxcblx0XHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bkNoYXRFZGl0aW5nQ29tbWFuZChfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIF9zZXNzaW9uOiBJQ2hhdEVkaXRpbmdTZXNzaW9uLCBfZW50cnk6IElNb2RpZmllZEZpbGVFbnRyeSwgY3RybDogSU1vZGlmaWVkRmlsZUVudHJ5RWRpdG9ySW50ZWdyYXRpb24sIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTx2b2lkPiB8IHZvaWQge1xuXHRcdGlmICh0aGlzLl9hY2NlcHQpIHtcblx0XHRcdGN0cmwuYWNjZXB0TmVhcmVzdENoYW5nZShhcmdzWzBdKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y3RybC5yZWplY3ROZWFyZXN0Q2hhbmdlKGFyZ3NbMF0pO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBUb2dnbGVEaWZmQWN0aW9uIGV4dGVuZHMgQ2hhdEVkaXRpbmdFZGl0b3JBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2NoYXRFZGl0b3IuYWN0aW9uLnRvZ2dsZURpZmYnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignZGlmZicsICdUb2dnbGUgRGlmZiBFZGl0b3InKSxcblx0XHRcdGNhdGVnb3J5OiBDSEFUX0NBVEVHT1JZLFxuXHRcdFx0dG9nZ2xlZDoge1xuXHRcdFx0XHRjb25kaXRpb246IENvbnRleHRLZXlFeHByLm9yKEVkaXRvckNvbnRleHRLZXlzLmluRGlmZkVkaXRvciwgQWN0aXZlRWRpdG9yQ29udGV4dC5pc0VxdWFsVG8oVEVYVF9ESUZGX0VESVRPUl9JRCkpISxcblx0XHRcdFx0aWNvbjogQ29kaWNvbi5nb1RvRmlsZSxcblx0XHRcdH0sXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChjdHhIYXNFZGl0b3JNb2RpZmljYXRpb24sIGN0eEhhc1JlcXVlc3RJblByb2dyZXNzLm5lZ2F0ZSgpKSxcblx0XHRcdGljb246IENvZGljb24uZGlmZlNpbmdsZSxcblx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0d2hlbjogRWRpdG9yQ29udGV4dEtleXMuZm9jdXMsXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5GNyxcblx0XHRcdH0sXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkNoYXRFZGl0aW5nRWRpdG9ySHVuayxcblx0XHRcdFx0b3JkZXI6IDEwXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ2hhdEVkaXRpbmdFZGl0b3JDb250ZW50LFxuXHRcdFx0XHRncm91cDogJ2FfcmVzb2x2ZScsXG5cdFx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoY3R4UmV2aWV3TW9kZUVuYWJsZWQsIGN0eEhhc1JlcXVlc3RJblByb2dyZXNzLm5lZ2F0ZSgpKVxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bkNoYXRFZGl0aW5nQ29tbWFuZChfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIF9zZXNzaW9uOiBJQ2hhdEVkaXRpbmdTZXNzaW9uLCBfZW50cnk6IElNb2RpZmllZEZpbGVFbnRyeSwgaW50ZWdyYXRpb246IElNb2RpZmllZEZpbGVFbnRyeUVkaXRvckludGVncmF0aW9uLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8dm9pZD4gfCB2b2lkIHtcblx0XHRpbnRlZ3JhdGlvbi50b2dnbGVEaWZmKGFyZ3NbMF0pO1xuXHR9XG59XG5cbmNsYXNzIFRvZ2dsZUFjY2Vzc2libGVEaWZmVmlld0FjdGlvbiBleHRlbmRzIENoYXRFZGl0aW5nRWRpdG9yQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdjaGF0RWRpdG9yLmFjdGlvbi5zaG93QWNjZXNzaWJsZURpZmZWaWV3Jyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2FjY2Vzc2libGVEaWZmJywgJ1Nob3cgQWNjZXNzaWJsZSBEaWZmIFZpZXcnKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoY3R4SGFzRWRpdG9yTW9kaWZpY2F0aW9uLCBjdHhIYXNSZXF1ZXN0SW5Qcm9ncmVzcy5uZWdhdGUoKSksXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHdoZW46IEVkaXRvckNvbnRleHRLZXlzLmZvY3VzLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5GNyxcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bkNoYXRFZGl0aW5nQ29tbWFuZChfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIF9zZXNzaW9uOiBJQ2hhdEVkaXRpbmdTZXNzaW9uLCBfZW50cnk6IElNb2RpZmllZEZpbGVFbnRyeSwgaW50ZWdyYXRpb246IElNb2RpZmllZEZpbGVFbnRyeUVkaXRvckludGVncmF0aW9uKTogUHJvbWlzZTx2b2lkPiB8IHZvaWQge1xuXHRcdGludGVncmF0aW9uLmVuYWJsZUFjY2Vzc2libGVEaWZmVmlldygpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBSZXZpZXdDaGFuZ2VzQWN0aW9uIGV4dGVuZHMgQ2hhdEVkaXRpbmdFZGl0b3JBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnY2hhdEVkaXRvci5hY3Rpb24ucmV2aWV3Q2hhbmdlcycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdyZXZpZXcnLCBcIlJldmlld1wiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKGN0eEhhc0VkaXRvck1vZGlmaWNhdGlvbiwgY3R4SGFzUmVxdWVzdEluUHJvZ3Jlc3MubmVnYXRlKCkpLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5DaGF0RWRpdGluZ0VkaXRvckNvbnRlbnQsXG5cdFx0XHRcdGdyb3VwOiAnYV9yZXNvbHZlJyxcblx0XHRcdFx0b3JkZXI6IDMsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChjdHhSZXZpZXdNb2RlRW5hYmxlZC5uZWdhdGUoKSwgY3R4SGFzUmVxdWVzdEluUHJvZ3Jlc3MubmVnYXRlKCkpLFxuXHRcdFx0fV1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bkNoYXRFZGl0aW5nQ29tbWFuZChfYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIF9zZXNzaW9uOiBJQ2hhdEVkaXRpbmdTZXNzaW9uLCBlbnRyeTogSU1vZGlmaWVkRmlsZUVudHJ5LCBfaW50ZWdyYXRpb246IElNb2RpZmllZEZpbGVFbnRyeUVkaXRvckludGVncmF0aW9uLCAuLi5fYXJnczogYW55W10pOiB2b2lkIHtcblx0XHRlbnRyeS5lbmFibGVSZXZpZXdNb2RlVW50aWxTZXR0bGVkKCk7XG5cdH1cbn1cblxuXG4vLyAtLS0gbXVsdGkgZmlsZSBkaWZmXG5cbmFic3RyYWN0IGNsYXNzIE11bHRpRGlmZkFjY2VwdERpc2NhcmRBY3Rpb24gZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcihyZWFkb25seSBhY2NlcHQ6IGJvb2xlYW4pIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogYWNjZXB0ID8gJ2NoYXRFZGl0aW5nLm11bHRpZGlmZi5hY2NlcHRBbGxGaWxlcycgOiAnY2hhdEVkaXRpbmcubXVsdGlkaWZmLmRpc2NhcmRBbGxGaWxlcycsXG5cdFx0XHR0aXRsZTogYWNjZXB0ID8gbG9jYWxpemUoJ2FjY2VwdDQnLCAnS2VlcCBBbGwgRWRpdHMnKSA6IGxvY2FsaXplKCdkaXNjYXJkNCcsICdVbmRvIEFsbCBFZGl0cycpLFxuXHRcdFx0aWNvbjogYWNjZXB0ID8gQ29kaWNvbi5jaGVjayA6IENvZGljb24uZGlzY2FyZCxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCdyZXNvdXJjZVNjaGVtZScsIENIQVRfRURJVElOR19NVUxUSV9ESUZGX1NPVVJDRV9SRVNPTFZFUl9TQ0hFTUUpLFxuXHRcdFx0XHRpZDogTWVudUlkLkVkaXRvclRpdGxlLFxuXHRcdFx0XHRvcmRlcjogYWNjZXB0ID8gMCA6IDEsXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHR9LFxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiB1bmtub3duW10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjaGF0RWRpdGluZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNoYXRFZGl0aW5nU2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBzU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yR3JvdXBzU2VydmljZSk7XG5cdFx0Y29uc3QgbGlzdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IHJlc29sdmVkQ29udGV4dCA9IHJlc29sdmVDb21tYW5kc0NvbnRleHQoYXJncywgZWRpdG9yU2VydmljZSwgZWRpdG9yR3JvdXBzU2VydmljZSwgbGlzdFNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgZ3JvdXBDb250ZXh0ID0gcmVzb2x2ZWRDb250ZXh0Lmdyb3VwZWRFZGl0b3JzWzBdO1xuXHRcdGlmICghZ3JvdXBDb250ZXh0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWRpdG9yID0gZ3JvdXBDb250ZXh0LmVkaXRvcnNbMF07XG5cdFx0aWYgKCEoZWRpdG9yIGluc3RhbmNlb2YgTXVsdGlEaWZmRWRpdG9ySW5wdXQpIHx8ICFlZGl0b3IucmVzb3VyY2UpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzZXNzaW9uID0gY2hhdEVkaXRpbmdTZXJ2aWNlLmdldEVkaXRpbmdTZXNzaW9uKGVkaXRvci5yZXNvdXJjZS5hdXRob3JpdHkpO1xuXHRcdGlmICh0aGlzLmFjY2VwdCkge1xuXHRcdFx0YXdhaXQgc2Vzc2lvbj8uYWNjZXB0KCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGF3YWl0IHNlc3Npb24/LnJlamVjdCgpO1xuXHRcdH1cblx0fVxufVxuXG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckNoYXRFZGl0b3JBY3Rpb25zKCkge1xuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgTmV4dEFjdGlvbiBleHRlbmRzIE5hdmlnYXRlQWN0aW9uIHsgY29uc3RydWN0b3IoKSB7IHN1cGVyKHRydWUpOyB9IH0pO1xuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgUHJldkFjdGlvbiBleHRlbmRzIE5hdmlnYXRlQWN0aW9uIHsgY29uc3RydWN0b3IoKSB7IHN1cGVyKGZhbHNlKTsgfSB9KTtcblx0cmVnaXN0ZXJBY3Rpb24yKFJldmlld0NoYW5nZXNBY3Rpb24pO1xuXHRyZWdpc3RlckFjdGlvbjIoQWNjZXB0QWN0aW9uKTtcblx0cmVnaXN0ZXJBY3Rpb24yKFJlamVjdEFjdGlvbik7XG5cdHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBBY2NlcHRIdW5rQWN0aW9uIGV4dGVuZHMgQWNjZXB0UmVqZWN0SHVua0FjdGlvbiB7IGNvbnN0cnVjdG9yKCkgeyBzdXBlcih0cnVlKTsgfSB9KTtcblx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIEFjY2VwdEh1bmtBY3Rpb24gZXh0ZW5kcyBBY2NlcHRSZWplY3RIdW5rQWN0aW9uIHsgY29uc3RydWN0b3IoKSB7IHN1cGVyKGZhbHNlKTsgfSB9KTtcblx0cmVnaXN0ZXJBY3Rpb24yKFRvZ2dsZURpZmZBY3Rpb24pO1xuXHRyZWdpc3RlckFjdGlvbjIoVG9nZ2xlQWNjZXNzaWJsZURpZmZWaWV3QWN0aW9uKTtcblxuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBNdWx0aURpZmZBY2NlcHREaXNjYXJkQWN0aW9uIHsgY29uc3RydWN0b3IoKSB7IHN1cGVyKHRydWUpOyB9IH0pO1xuXHRyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBNdWx0aURpZmZBY2NlcHREaXNjYXJkQWN0aW9uIHsgY29uc3RydWN0b3IoKSB7IHN1cGVyKGZhbHNlKTsgfSB9KTtcblxuXHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLkNoYXRFZGl0aW5nRWRpdG9yQ29udGVudCwge1xuXHRcdGNvbW1hbmQ6IHtcblx0XHRcdGlkOiBuYXZpZ2F0aW9uQmVhcmluZ0Zha2VBY3Rpb25JZCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnbGFiZWwnLCBcIk5hdmlnYXRpb24gU3RhdHVzXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5mYWxzZSgpLFxuXHRcdH0sXG5cdFx0Z3JvdXA6ICduYXZpZ2F0ZScsXG5cdFx0b3JkZXI6IC0xLFxuXHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChjdHhSZXZpZXdNb2RlRW5hYmxlZCwgY3R4SGFzUmVxdWVzdEluUHJvZ3Jlc3MubmVnYXRlKCkpLFxuXHR9KTtcbn1cblxuZXhwb3J0IGNvbnN0IG5hdmlnYXRpb25CZWFyaW5nRmFrZUFjdGlvbklkID0gJ2NoYXRFZGl0b3IubmF2aWdhdGlvbi5iZWFyaW5ncyc7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFJQSxTQUFTLFVBQVUsaUJBQWlCO0FBRXBDLFNBQVMsZUFBZTtBQUN4QixTQUFTLFNBQTBCLFFBQVEsY0FBYyx1QkFBdUI7QUFDaEYsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxTQUFTLGNBQWM7QUFDaEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUywwQkFBMEIseUJBQXlCLDRCQUE0QjtBQUN4RixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGNBQWMsc0JBQXNCO0FBQzdDLFNBQVMsZ0RBQWdELHFCQUFtRyw0QkFBNEI7QUFDeEwsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyx3QkFBd0Isa0JBQWtCLDJCQUEyQjtBQUM5RSxTQUFTLHVCQUF1QjtBQUdoQyxNQUFlLGdDQUFnQyxRQUFRO0FBQUEsRUFFdEQsWUFBWSxNQUFpQztBQUM1QyxVQUFNO0FBQUEsTUFDTCxVQUFVO0FBQUEsTUFDVixHQUFHO0FBQUEsSUFDSixDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRUEsTUFBZSxJQUFJLGFBQStCLE1BQWE7QUFFOUQsVUFBTSxlQUFlLFNBQVMsSUFBSSxxQkFBcUI7QUFDdkQsVUFBTSxxQkFBcUIsU0FBUyxJQUFJLG1CQUFtQjtBQUMzRCxVQUFNLGdC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
