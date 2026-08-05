import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import "./media/review.css";
import { isCodeEditor, isDiffEditor } from "../../../../editor/browser/editorBrowser.js";
import { EditorContributionInstantiation, registerEditorContribution } from "../../../../editor/browser/editorExtensions.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import * as nls from "../../../../nls.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ICommentService } from "./commentService.js";
import { ctxCommentEditorFocused, SimpleCommentEditor } from "./simpleCommentEditor.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { CommentController, ID } from "./commentsController.js";
import { Range } from "../../../../editor/common/core/range.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { CommentContextKeys } from "../common/commentContextKeys.js";
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from "../../../../platform/accessibility/common/accessibility.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { accessibilityHelpIsShown, accessibleViewCurrentProviderId } from "../../accessibility/browser/accessibilityConfiguration.js";
import { CommentCommandId } from "../common/commentCommandIds.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { CommentsInputContentProvider } from "./commentsInputContentProvider.js";
import { AccessibleViewProviderId } from "../../../../platform/accessibility/browser/accessibleView.js";
import { CommentWidgetFocus } from "./commentThreadZoneWidget.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
registerEditorContribution(ID, CommentController, EditorContributionInstantiation.AfterFirstRender);
registerWorkbenchContribution2(CommentsInputContentProvider.ID, CommentsInputContentProvider, WorkbenchPhase.BlockRestore);
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: CommentCommandId.NextThread,
  handler: async (accessor, args) => {
    const activeEditor = getActiveEditor(accessor);
    if (!activeEditor) {
      return Promise.resolve();
    }
    const controller = CommentController.get(activeEditor);
    if (!controller) {
      return Promise.resolve();
    }
    controller.nextCommentThread(true);
  },
  weight: KeybindingWeight.EditorContrib,
  primary: KeyMod.Alt | KeyCode.F9
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: CommentCommandId.PreviousThread,
  handler: async (accessor, args) => {
    const activeEditor = getActiveEditor(accessor);
    if (!activeEditor) {
      return Promise.resolve();
    }
    const controller = CommentController.get(activeEditor);
    if (!controller) {
      return Promise.resolve();
    }
    controller.previousCommentThread(true);
  },
  weight: KeybindingWeight.EditorContrib,
  primary: KeyMod.Shift | KeyMod.Alt | KeyCode.F9
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: CommentCommandId.NextCommentedRange,
      title: {
        value: nls.localize("comments.NextCommentedRange", "Go to Next Commented Range"),
        original: "Go to Next Commented Range"
      },
      category: {
        value: nls.localize("commentsCategory", "Comments"),
        original: "Comments"
      },
      menu: [{
        id: MenuId.CommandPalette,
        when: CommentContextKeys.activeEditorHasCommentingRange
      }],
      keybinding: {
        primary: KeyMod.Alt | KeyCode.F10,
        weight: KeybindingWeight.EditorContrib,
        when: CommentContextKeys.activeEditorHasCommentingRange
      }
    });
  }
  run(accessor, ...args) {
    const activeEditor = getActiveEditor(accessor);
    if (!activeEditor) {
      return;
    }
    const controller = CommentController.get(activeEditor);
    if (!controller) {
      return;
    }
    controller.nextCommentThread(false);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: CommentCommandId.PreviousCommentedRange,
      title: {
        value: nls.localize("comments.previousCommentedRange", "Go to Previous Commented Range"),
        original: "Go to Previous Commented Range"
      },
      category: {
        value: nls.localize("commentsCategory", "Comments"),
        original: "Comments"
      },
      menu: [{
        id: MenuId.CommandPalette,
        when: CommentContextKeys.activeEditorHasCommentingRange
      }],
      keybinding: {
        primary: KeyMod.Shift | KeyMod.Alt | KeyCode.F10,
        weight: KeybindingWeight.EditorContrib,
        when: CommentContextKeys.activeEditorHasCommentingRange
      }
    });
  }
  run(accessor, ...args) {
    const activeEditor = getActiveEditor(accessor);
    if (!activeEditor) {
      return;
    }
    const controller = CommentController.get(activeEditor);
    if (!controller) {
      return;
    }
    controller.previousCommentThread(false);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: CommentCommandId.NextRange,
      title: {
        value: nls.localize("comments.nextCommentingRange", "Go to Next Commenting Range"),
        original: "Go to Next Commenting Range"
      },
      category: {
        value: nls.localize("commentsCategory", "Comments"),
        original: "Comments"
      },
      menu: [{
        id: MenuId.CommandPalette,
        when: CommentContextKeys.activeEditorHasCommentingRange
      }],
      keybinding: {
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.DownArrow),
        weight: KeybindingWeight.EditorContrib,
        when: ContextKeyExpr.and(CONTEXT_ACCESSIBILITY_MODE_ENABLED, ContextKeyExpr.or(EditorContextKeys.focus, CommentContextKeys.commentFocused, ContextKeyExpr.and(accessibilityHelpIsShown, accessibleViewCurrentProviderId.isEqualTo(AccessibleViewProviderId.Comments))))
      }
    });
  }
  run(accessor, args) {
    const activeEditor = getActiveEditor(accessor);
    if (!activeEditor) {
      return;
    }
    const controller = CommentController.get(activeEditor);
    if (!controller) {
      return;
    }
    controller.nextCommentingRange();
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: CommentCommandId.PreviousRange,
      title: {
        value: nls.localize("comments.previousCommentingRange", "Go to Previous Commenting Range"),
        original: "Go to Previous Commenting Range"
      },
      category: {
        value: nls.localize("commentsCategory", "Comments"),
        original: "Comments"
      },
      menu: [{
        id: MenuId.CommandPalette,
        when: CommentContextKeys.activeEditorHasCommentingRange
      }],
      keybinding: {
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.UpArrow),
        weight: KeybindingWeight.EditorContrib,
        when: ContextKeyExpr.and(CONTEXT_ACCESSIBILITY_MODE_ENABLED, ContextKeyExpr.or(EditorContextKeys.focus, CommentContextKeys.commentFocused, ContextKeyExpr.and(accessibilityHelpIsShown, accessibleViewCurrentProviderId.isEqualTo(AccessibleViewProviderId.Comments))))
      }
    });
  }
  async run(accessor, ...args) {
    const activeEditor = getActiveEditor(accessor);
    if (!activeEditor) {
      return;
    }
    const controller = CommentController.get(activeEditor);
    if (!controller) {
      return;
    }
    controller.previousCommentingRange();
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: CommentCommandId.ToggleCommenting,
      title: {
        value: nls.localize("comments.toggleCommenting", "Toggle Editor Commenting"),
        original: "Toggle Editor Commenting"
      },
      category: {
        value: nls.localize("commentsCategory", "Comments"),
        original: "Comments"
      },
      menu: [{
        id: MenuId.CommandPalette,
        when: CommentContextKeys.WorkspaceHasCommenting
      }]
    });
  }
  run(accessor, ...args) {
    const commentService = accessor.get(ICommentService);
    const enable = commentService.isCommentingEnabled;
    commentService.enableCommenting(!enable);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: CommentCommandId.Add,
      title: {
        value: nls.localize("comments.addCommand", "Add Comment on Current Selection"),
        original: "Add Comment on Current Selection"
      },
      category: {
        value: nls.localize("commentsCategory", "Comments"),
        original: "Comments"
      },
      menu: [{
        id: MenuId.CommandPalette,
        when: CommentContextKeys.activeCursorHasCommentingRange
      }],
      keybinding: {
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyC),
        weight: KeybindingWeight.EditorContrib,
        when: CommentContextKeys.activeCursorHasCommentingRange
      }
    });
  }
  async run(accessor, args) {
    const activeEditor = getActiveEditor(accessor);
    if (!activeEditor) {
      return;
    }
    const controller = CommentController.get(activeEditor);
    if (!controller) {
      return;
    }
    const position = args?.range ? new Range(args.range.startLineNumber, args.range.startLineNumber, args.range.endLineNumber, args.range.endColumn) : args?.fileComment ? void 0 : activeEditor.getSelection();
    await controller.addOrToggleCommentAtLine(position, void 0);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: CommentCommandId.FocusCommentOnCurrentLine,
      title: {
        value: nls.localize("comments.focusCommentOnCurrentLine", "Focus Comment on Current Line"),
        original: "Focus Comment on Current Line"
      },
      category: {
        value: nls.localize("commentsCategory", "Comments"),
        original: "Comments"
      },
      f1: true,
      precondition: CommentContextKeys.activeCursorHasComment
    });
  }
  async run(accessor, ...args) {
    const activeEditor = getActiveEditor(accessor);
    if (!activeEditor) {
      return;
    }
    const controller = CommentController.get(activeEditor);
    if (!controller) {
      return;
    }
    const position = activeEditor.getSelection();
    const notificationService = accessor.get(INotificationService);
    let error = false;
    try {
      const commentAtLine = controller.getCommentsAtLine(position);
      if (commentAtLine.length === 0) {
        error = true;
      } else {
        await controller.revealCommentThread(commentAtLine[0].commentThread.threadId, void 0, false, CommentWidgetFocus.Widget);
      }
    } catch (e) {
      error = true;
    }
    if (error) {
      notificationService.error(nls.localize("comments.focusCommand.error", "The cursor must be on a line with a comment to focus the comment"));
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: CommentCommandId.CollapseAll,
      title: {
        value: nls.localize("comments.collapseAll", "Collapse All Comments"),
        original: "Collapse All Comments"
      },
      category: {
        value: nls.localize("commentsCategory", "Comments"),
        original: "Comments"
      },
      menu: [{
        id: MenuId.CommandPalette,
        when: CommentContextKeys.WorkspaceHasCommenting
      }]
    });
  }
  run(accessor, ...args) {
    getActiveController(accessor)?.collapseAll();
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: CommentCommandId.ExpandAll,
      title: {
        value: nls.localize("comments.expandAll", "Expand All Comments"),
        original: "Expand All Comments"
      },
      category: {
        value: nls.localize("commentsCategory", "Comments"),
        original: "Comments"
      },
      menu: [{
        id: MenuId.CommandPalette,
        when: CommentContextKeys.WorkspaceHasCommenting
      }]
    });
  }
  run(accessor, ...args) {
    getActiveController(accessor)?.expandAll();
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: CommentCommandId.ExpandUnresolved,
      title: {
        value: nls.localize("comments.expandUnresolved", "Expand Unresolved Comments"),
        original: "Expand Unresolved Comments"
      },
      category: {
        value: nls.localize("commentsCategory", "Comments"),
        original: "Comments"
      },
      menu: [{
        id: MenuId.CommandPalette,
        when: CommentContextKeys.WorkspaceHasCommenting
      }]
    });
  }
  run(accessor, ...args) {
    getActiveController(accessor)?.expandUnresolved();
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: CommentCommandId.Submit,
  weight: KeybindingWeight.EditorContrib,
  primary: KeyMod.CtrlCmd | KeyCode.Enter,
  when: ctxCommentEditorFocused,
  handler: (accessor, args) => {
    const activeCodeEditor = accessor.get(ICodeEditorService).getFocusedCodeEditor();
    if (activeCodeEditor instanceof SimpleCommentEditor) {
      activeCodeEditor.getParentThread().submitComment();
    }
  }
});
KeybindingsRegistry.registerCommandAndKeybindingRule({
  id: CommentCommandId.Hide,
  weight: KeybindingWeight.EditorContrib,
  primary: KeyCode.Escape,
  secondary: [KeyMod.Shift | KeyCode.Escape],
  when: ContextKeyExpr.or(ctxCommentEditorFocused, CommentContextKeys.commentFocused),
  handler: async (accessor, args) => {
    const activeCodeEditor = accessor.get(ICodeEditorService).getFocusedCodeEditor();
    const keybindingService = accessor.get(IKeybindingService);
    await keybindingService.enableKeybindingHoldMode(CommentCommandId.Hide);
    if (activeCodeEditor instanceof SimpleCommentEditor) {
      activeCodeEditor.getParentThread().collapse();
    } else if (activeCodeEditor) {
      const controller = CommentController.get(activeCodeEditor);
      if (!controller) {
        return;
      }
      const notificationService = accessor.get(INotificationService);
      const commentService = accessor.get(ICommentService);
      let error = false;
      try {
        const activeComment = commentService.lastActiveCommentcontroller?.activeComment;
        if (!activeComment) {
          error = true;
        } else {
          controller.collapseAndFocusRange(activeComment.thread.threadId);
        }
      } catch (e) {
        error = true;
      }
      if (error) {
        notificationService.error(nls.localize("comments.focusCommand.error", "The cursor must be on a line with a comment to focus the comment"));
      }
    }
  }
});
function getActiveEditor(accessor) {
  let activeTextEditorControl = accessor.get(IEditorService).activeTextEditorControl;
  if (isDiffEditor(activeTextEditorControl)) {
    if (activeTextEditorControl.getOriginalEditor().hasTextFocus()) {
      activeTextEditorControl = activeTextEditorControl.getOriginalEditor();
    } else {
      activeTextEditorControl = activeTextEditorControl.getModifiedEditor();
    }
  }
  if (!isCodeEditor(activeTextEditorControl) || !activeTextEditorControl.hasModel()) {
    return null;
  }
  return activeTextEditorControl;
}
function getActiveController(accessor) {
  const activeEditor = getActiveEditor(accessor);
  if (!activeEditor) {
    return void 0;
  }
  const controller = CommentController.get(activeEditor);
  if (!controller) {
    return void 0;
  }
  return controller;
}
export {
  getActiveEditor
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb21tZW50cy9icm93c2VyL2NvbW1lbnRzRWRpdG9yQ29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgS2V5Q2hvcmQsIEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCAnLi9tZWRpYS9yZXZpZXcuY3NzJztcbmltcG9ydCB7IElBY3RpdmVDb2RlRWRpdG9yLCBpc0NvZGVFZGl0b3IsIGlzRGlmZkVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbiwgcmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3NlcnZpY2VzL2NvZGVFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ3NSZWdpc3RyeSwgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUNvbW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi9jb21tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBjdHhDb21tZW50RWRpdG9yRm9jdXNlZCwgU2ltcGxlQ29tbWVudEVkaXRvciB9IGZyb20gJy4vc2ltcGxlQ29tbWVudEVkaXRvci5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IENvbW1lbnRDb250cm9sbGVyLCBJRCB9IGZyb20gJy4vY29tbWVudHNDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IElSYW5nZSwgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb21tZW50Q29udGV4dEtleXMgfSBmcm9tICcuLi9jb21tb24vY29tbWVudENvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IENPTlRFWFRfQUNDRVNTSUJJTElUWV9NT0RFX0VOQUJMRUQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5LmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBhY2Nlc3NpYmlsaXR5SGVscElzU2hvd24sIGFjY2Vzc2libGVWaWV3Q3VycmVudFByb3ZpZGVySWQgfSBmcm9tICcuLi8uLi9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJpbGl0eUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQ29tbWVudENvbW1hbmRJZCB9IGZyb20gJy4uL2NvbW1vbi9jb21tZW50Q29tbWFuZElkcy5qcyc7XG5pbXBvcnQgeyByZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIsIFdvcmtiZW5jaFBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgQ29tbWVudHNJbnB1dENvbnRlbnRQcm92aWRlciB9IGZyb20gJy4vY29tbWVudHNJbnB1dENvbnRlbnRQcm92aWRlci5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmxlVmlld1Byb3ZpZGVySWQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJsZVZpZXcuanMnO1xuaW1wb3J0IHsgQ29tbWVudFdpZGdldEZvY3VzIH0gZnJvbSAnLi9jb21tZW50VGhyZWFkWm9uZVdpZGdldC5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcblxucmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24oSUQsIENvbW1lbnRDb250cm9sbGVyLCBFZGl0b3JDb250cmlidXRpb25JbnN0YW50aWF0aW9uLkFmdGVyRmlyc3RSZW5kZXIpO1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKENvbW1lbnRzSW5wdXRDb250ZW50UHJvdmlkZXIuSUQsIENvbW1lbnRzSW5wdXRDb250ZW50UHJvdmlkZXIsIFdvcmtiZW5jaFBoYXNlLkJsb2NrUmVzdG9yZSk7XG5cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogQ29tbWVudENvbW1hbmRJZC5OZXh0VGhyZWFkLFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3IsIGFyZ3M/OiB7IHJhbmdlOiBJUmFuZ2U7IGZpbGVDb21tZW50OiBib29sZWFuIH0pID0+IHtcblx0XHRjb25zdCBhY3RpdmVFZGl0b3IgPSBnZXRBY3RpdmVFZGl0b3IoYWNjZXNzb3IpO1xuXHRcdGlmICghYWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udHJvbGxlciA9IENvbW1lbnRDb250cm9sbGVyLmdldChhY3RpdmVFZGl0b3IpO1xuXHRcdGlmICghY29udHJvbGxlcikge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdH1cblx0XHRjb250cm9sbGVyLm5leHRDb21tZW50VGhyZWFkKHRydWUpO1xuXHR9LFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYixcblx0cHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleUNvZGUuRjksXG59KTtcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiBDb21tZW50Q29tbWFuZElkLlByZXZpb3VzVGhyZWFkLFxuXHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3IsIGFyZ3M/OiB7IHJhbmdlOiBJUmFuZ2U7IGZpbGVDb21tZW50OiBib29sZWFuIH0pID0+IHtcblx0XHRjb25zdCBhY3RpdmVFZGl0b3IgPSBnZXRBY3RpdmVFZGl0b3IoYWNjZXNzb3IpO1xuXHRcdGlmICghYWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udHJvbGxlciA9IENvbW1lbnRDb250cm9sbGVyLmdldChhY3RpdmVFZGl0b3IpO1xuXHRcdGlmICghY29udHJvbGxlcikge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdH1cblx0XHRjb250cm9sbGVyLnByZXZpb3VzQ29tbWVudFRocmVhZCh0cnVlKTtcblx0fSxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIsXG5cdHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLkY5XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBDb21tZW50Q29tbWFuZElkLk5leHRDb21tZW50ZWRSYW5nZSxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdHZhbHVlOiBubHMubG9jYWxpemUoJ2NvbW1lbnRzLk5leHRDb21tZW50ZWRSYW5nZScsIFwiR28gdG8gTmV4dCBDb21tZW50ZWQgUmFuZ2VcIiksXG5cdFx0XHRcdG9yaWdpbmFsOiAnR28gdG8gTmV4dCBDb21tZW50ZWQgUmFuZ2UnXG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnk6IHtcblx0XHRcdFx0dmFsdWU6IG5scy5sb2NhbGl6ZSgnY29tbWVudHNDYXRlZ29yeScsIFwiQ29tbWVudHNcIiksXG5cdFx0XHRcdG9yaWdpbmFsOiAnQ29tbWVudHMnXG5cdFx0XHR9LFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogQ29tbWVudENvbnRleHRLZXlzLmFjdGl2ZUVkaXRvckhhc0NvbW1lbnRpbmdSYW5nZVxuXHRcdFx0fV0sXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5BbHQgfCBLZXlDb2RlLkYxMCxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIsXG5cdFx0XHRcdHdoZW46IENvbW1lbnRDb250ZXh0S2V5cy5hY3RpdmVFZGl0b3JIYXNDb21tZW50aW5nUmFuZ2Vcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXHRvdmVycmlkZSBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0Y29uc3QgYWN0aXZlRWRpdG9yID0gZ2V0QWN0aXZlRWRpdG9yKGFjY2Vzc29yKTtcblx0XHRpZiAoIWFjdGl2ZUVkaXRvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBDb21tZW50Q29udHJvbGxlci5nZXQoYWN0aXZlRWRpdG9yKTtcblx0XHRpZiAoIWNvbnRyb2xsZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29udHJvbGxlci5uZXh0Q29tbWVudFRocmVhZChmYWxzZSk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbW1lbnRDb21tYW5kSWQuUHJldmlvdXNDb21tZW50ZWRSYW5nZSxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdHZhbHVlOiBubHMubG9jYWxpemUoJ2NvbW1lbnRzLnByZXZpb3VzQ29tbWVudGVkUmFuZ2UnLCBcIkdvIHRvIFByZXZpb3VzIENvbW1lbnRlZCBSYW5nZVwiKSxcblx0XHRcdFx0b3JpZ2luYWw6ICdHbyB0byBQcmV2aW91cyBDb21tZW50ZWQgUmFuZ2UnXG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnk6IHtcblx0XHRcdFx0dmFsdWU6IG5scy5sb2NhbGl6ZSgnY29tbWVudHNDYXRlZ29yeScsIFwiQ29tbWVudHNcIiksXG5cdFx0XHRcdG9yaWdpbmFsOiAnQ29tbWVudHMnXG5cdFx0XHR9LFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogQ29tbWVudENvbnRleHRLZXlzLmFjdGl2ZUVkaXRvckhhc0NvbW1lbnRpbmdSYW5nZVxuXHRcdFx0fV0sXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5TaGlmdCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLkYxMCxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIsXG5cdFx0XHRcdHdoZW46IENvbW1lbnRDb250ZXh0S2V5cy5hY3RpdmVFZGl0b3JIYXNDb21tZW50aW5nUmFuZ2Vcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXHRvdmVycmlkZSBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKTogdm9pZCB7XG5cdFx0Y29uc3QgYWN0aXZlRWRpdG9yID0gZ2V0QWN0aXZlRWRpdG9yKGFjY2Vzc29yKTtcblx0XHRpZiAoIWFjdGl2ZUVkaXRvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBDb21tZW50Q29udHJvbGxlci5nZXQoYWN0aXZlRWRpdG9yKTtcblx0XHRpZiAoIWNvbnRyb2xsZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29udHJvbGxlci5wcmV2aW91c0NvbW1lbnRUaHJlYWQoZmFsc2UpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBDb21tZW50Q29tbWFuZElkLk5leHRSYW5nZSxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdHZhbHVlOiBubHMubG9jYWxpemUoJ2NvbW1lbnRzLm5leHRDb21tZW50aW5nUmFuZ2UnLCBcIkdvIHRvIE5leHQgQ29tbWVudGluZyBSYW5nZVwiKSxcblx0XHRcdFx0b3JpZ2luYWw6ICdHbyB0byBOZXh0IENvbW1lbnRpbmcgUmFuZ2UnXG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnk6IHtcblx0XHRcdFx0dmFsdWU6IG5scy5sb2NhbGl6ZSgnY29tbWVudHNDYXRlZ29yeScsIFwiQ29tbWVudHNcIiksXG5cdFx0XHRcdG9yaWdpbmFsOiAnQ29tbWVudHMnXG5cdFx0XHR9LFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogQ29tbWVudENvbnRleHRLZXlzLmFjdGl2ZUVkaXRvckhhc0NvbW1lbnRpbmdSYW5nZVxuXHRcdFx0fV0sXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLkRvd25BcnJvdyksXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9BQ0NFU1NJQklMSVRZX01PREVfRU5BQkxFRCwgQ29udGV4dEtleUV4cHIub3IoRWRpdG9yQ29udGV4dEtleXMuZm9jdXMsIENvbW1lbnRDb250ZXh0S2V5cy5jb21tZW50Rm9jdXNlZCwgQ29udGV4dEtleUV4cHIuYW5kKGFjY2Vzc2liaWxpdHlIZWxwSXNTaG93biwgYWNjZXNzaWJsZVZpZXdDdXJyZW50UHJvdmlkZXJJZC5pc0VxdWFsVG8oQWNjZXNzaWJsZVZpZXdQcm92aWRlcklkLkNvbW1lbnRzKSkpKVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBhcmdzPzogeyByYW5nZTogSVJhbmdlOyBmaWxlQ29tbWVudDogYm9vbGVhbiB9KTogdm9pZCB7XG5cdFx0Y29uc3QgYWN0aXZlRWRpdG9yID0gZ2V0QWN0aXZlRWRpdG9yKGFjY2Vzc29yKTtcblx0XHRpZiAoIWFjdGl2ZUVkaXRvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBDb21tZW50Q29udHJvbGxlci5nZXQoYWN0aXZlRWRpdG9yKTtcblx0XHRpZiAoIWNvbnRyb2xsZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29udHJvbGxlci5uZXh0Q29tbWVudGluZ1JhbmdlKCk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbW1lbnRDb21tYW5kSWQuUHJldmlvdXNSYW5nZSxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdHZhbHVlOiBubHMubG9jYWxpemUoJ2NvbW1lbnRzLnByZXZpb3VzQ29tbWVudGluZ1JhbmdlJywgXCJHbyB0byBQcmV2aW91cyBDb21tZW50aW5nIFJhbmdlXCIpLFxuXHRcdFx0XHRvcmlnaW5hbDogJ0dvIHRvIFByZXZpb3VzIENvbW1lbnRpbmcgUmFuZ2UnXG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnk6IHtcblx0XHRcdFx0dmFsdWU6IG5scy5sb2NhbGl6ZSgnY29tbWVudHNDYXRlZ29yeScsIFwiQ29tbWVudHNcIiksXG5cdFx0XHRcdG9yaWdpbmFsOiAnQ29tbWVudHMnXG5cdFx0XHR9LFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogQ29tbWVudENvbnRleHRLZXlzLmFjdGl2ZUVkaXRvckhhc0NvbW1lbnRpbmdSYW5nZVxuXHRcdFx0fV0sXG5cdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5BbHQgfCBLZXlDb2RlLlVwQXJyb3cpLFxuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYixcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfQUNDRVNTSUJJTElUWV9NT0RFX0VOQUJMRUQsIENvbnRleHRLZXlFeHByLm9yKEVkaXRvckNvbnRleHRLZXlzLmZvY3VzLCBDb21tZW50Q29udGV4dEtleXMuY29tbWVudEZvY3VzZWQsIENvbnRleHRLZXlFeHByLmFuZChhY2Nlc3NpYmlsaXR5SGVscElzU2hvd24sIGFjY2Vzc2libGVWaWV3Q3VycmVudFByb3ZpZGVySWQuaXNFcXVhbFRvKEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZC5Db21tZW50cykpKSlcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBhY3RpdmVFZGl0b3IgPSBnZXRBY3RpdmVFZGl0b3IoYWNjZXNzb3IpO1xuXHRcdGlmICghYWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29udHJvbGxlciA9IENvbW1lbnRDb250cm9sbGVyLmdldChhY3RpdmVFZGl0b3IpO1xuXHRcdGlmICghY29udHJvbGxlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb250cm9sbGVyLnByZXZpb3VzQ29tbWVudGluZ1JhbmdlKCk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbW1lbnRDb21tYW5kSWQuVG9nZ2xlQ29tbWVudGluZyxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdHZhbHVlOiBubHMubG9jYWxpemUoJ2NvbW1lbnRzLnRvZ2dsZUNvbW1lbnRpbmcnLCBcIlRvZ2dsZSBFZGl0b3IgQ29tbWVudGluZ1wiKSxcblx0XHRcdFx0b3JpZ2luYWw6ICdUb2dnbGUgRWRpdG9yIENvbW1lbnRpbmcnXG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnk6IHtcblx0XHRcdFx0dmFsdWU6IG5scy5sb2NhbGl6ZSgnY29tbWVudHNDYXRlZ29yeScsIFwiQ29tbWVudHNcIiksXG5cdFx0XHRcdG9yaWdpbmFsOiAnQ29tbWVudHMnXG5cdFx0XHR9LFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogQ29tbWVudENvbnRleHRLZXlzLldvcmtzcGFjZUhhc0NvbW1lbnRpbmdcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cblx0b3ZlcnJpZGUgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbW1lbnRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tZW50U2VydmljZSk7XG5cdFx0Y29uc3QgZW5hYmxlID0gY29tbWVudFNlcnZpY2UuaXNDb21tZW50aW5nRW5hYmxlZDtcblx0XHRjb21tZW50U2VydmljZS5lbmFibGVDb21tZW50aW5nKCFlbmFibGUpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBDb21tZW50Q29tbWFuZElkLkFkZCxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdHZhbHVlOiBubHMubG9jYWxpemUoJ2NvbW1lbnRzLmFkZENvbW1hbmQnLCBcIkFkZCBDb21tZW50IG9uIEN1cnJlbnQgU2VsZWN0aW9uXCIpLFxuXHRcdFx0XHRvcmlnaW5hbDogJ0FkZCBDb21tZW50IG9uIEN1cnJlbnQgU2VsZWN0aW9uJ1xuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiB7XG5cdFx0XHRcdHZhbHVlOiBubHMubG9jYWxpemUoJ2NvbW1lbnRzQ2F0ZWdvcnknLCBcIkNvbW1lbnRzXCIpLFxuXHRcdFx0XHRvcmlnaW5hbDogJ0NvbW1lbnRzJ1xuXHRcdFx0fSxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IENvbW1lbnRDb250ZXh0S2V5cy5hY3RpdmVDdXJzb3JIYXNDb21tZW50aW5nUmFuZ2Vcblx0XHRcdH1dLFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5LZXlDKSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIsXG5cdFx0XHRcdHdoZW46IENvbW1lbnRDb250ZXh0S2V5cy5hY3RpdmVDdXJzb3JIYXNDb21tZW50aW5nUmFuZ2Vcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJncz86IHsgcmFuZ2U6IElSYW5nZTsgZmlsZUNvbW1lbnQ6IGJvb2xlYW4gfSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGFjdGl2ZUVkaXRvciA9IGdldEFjdGl2ZUVkaXRvcihhY2Nlc3Nvcik7XG5cdFx0aWYgKCFhY3RpdmVFZGl0b3IpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjb250cm9sbGVyID0gQ29tbWVudENvbnRyb2xsZXIuZ2V0KGFjdGl2ZUVkaXRvcik7XG5cdFx0aWYgKCFjb250cm9sbGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcG9zaXRpb24gPSBhcmdzPy5yYW5nZSA/IG5ldyBSYW5nZShhcmdzLnJhbmdlLnN0YXJ0TGluZU51bWJlciwgYXJncy5yYW5nZS5zdGFydExpbmVOdW1iZXIsIGFyZ3MucmFuZ2UuZW5kTGluZU51bWJlciwgYXJncy5yYW5nZS5lbmRDb2x1bW4pXG5cdFx0XHQ6IChhcmdzPy5maWxlQ29tbWVudCA/IHVuZGVmaW5lZCA6IGFjdGl2ZUVkaXRvci5nZXRTZWxlY3Rpb24oKSk7XG5cdFx0YXdhaXQgY29udHJvbGxlci5hZGRPclRvZ2dsZUNvbW1lbnRBdExpbmUocG9zaXRpb24sIHVuZGVmaW5lZCk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbW1lbnRDb21tYW5kSWQuRm9jdXNDb21tZW50T25DdXJyZW50TGluZSxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdHZhbHVlOiBubHMubG9jYWxpemUoJ2NvbW1lbnRzLmZvY3VzQ29tbWVudE9uQ3VycmVudExpbmUnLCBcIkZvY3VzIENvbW1lbnQgb24gQ3VycmVudCBMaW5lXCIpLFxuXHRcdFx0XHRvcmlnaW5hbDogJ0ZvY3VzIENvbW1lbnQgb24gQ3VycmVudCBMaW5lJ1xuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiB7XG5cdFx0XHRcdHZhbHVlOiBubHMubG9jYWxpemUoJ2NvbW1lbnRzQ2F0ZWdvcnknLCBcIkNvbW1lbnRzXCIpLFxuXHRcdFx0XHRvcmlnaW5hbDogJ0NvbW1lbnRzJ1xuXHRcdFx0fSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb21tZW50Q29udGV4dEtleXMuYWN0aXZlQ3Vyc29ySGFzQ29tbWVudCxcblx0XHR9KTtcblx0fVxuXHRvdmVycmlkZSBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgYWN0aXZlRWRpdG9yID0gZ2V0QWN0aXZlRWRpdG9yKGFjY2Vzc29yKTtcblx0XHRpZiAoIWFjdGl2ZUVkaXRvcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBDb21tZW50Q29udHJvbGxlci5nZXQoYWN0aXZlRWRpdG9yKTtcblx0XHRpZiAoIWNvbnRyb2xsZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgcG9zaXRpb24gPSBhY3RpdmVFZGl0b3IuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0Y29uc3Qgbm90aWZpY2F0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90aWZpY2F0aW9uU2VydmljZSk7XG5cdFx0bGV0IGVycm9yID0gZmFsc2U7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGNvbW1lbnRBdExpbmUgPSBjb250cm9sbGVyLmdldENvbW1lbnRzQXRMaW5lKHBvc2l0aW9uKTtcblx0XHRcdGlmIChjb21tZW50QXRMaW5lLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRlcnJvciA9IHRydWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhd2FpdCBjb250cm9sbGVyLnJldmVhbENvbW1lbnRUaHJlYWQoY29tbWVudEF0TGluZVswXS5jb21tZW50VGhyZWFkLnRocmVhZElkLCB1bmRlZmluZWQsIGZhbHNlLCBDb21tZW50V2lkZ2V0Rm9jdXMuV2lkZ2V0KTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRlcnJvciA9IHRydWU7XG5cdFx0fVxuXHRcdGlmIChlcnJvcikge1xuXHRcdFx0bm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihubHMubG9jYWxpemUoJ2NvbW1lbnRzLmZvY3VzQ29tbWFuZC5lcnJvcicsIFwiVGhlIGN1cnNvciBtdXN0IGJlIG9uIGEgbGluZSB3aXRoIGEgY29tbWVudCB0byBmb2N1cyB0aGUgY29tbWVudFwiKSk7XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBDb21tZW50Q29tbWFuZElkLkNvbGxhcHNlQWxsLFxuXHRcdFx0dGl0bGU6IHtcblx0XHRcdFx0dmFsdWU6IG5scy5sb2NhbGl6ZSgnY29tbWVudHMuY29sbGFwc2VBbGwnLCBcIkNvbGxhcHNlIEFsbCBDb21tZW50c1wiKSxcblx0XHRcdFx0b3JpZ2luYWw6ICdDb2xsYXBzZSBBbGwgQ29tbWVudHMnXG5cdFx0XHR9LFxuXHRcdFx0Y2F0ZWdvcnk6IHtcblx0XHRcdFx0dmFsdWU6IG5scy5sb2NhbGl6ZSgnY29tbWVudHNDYXRlZ29yeScsIFwiQ29tbWVudHNcIiksXG5cdFx0XHRcdG9yaWdpbmFsOiAnQ29tbWVudHMnXG5cdFx0XHR9LFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogQ29tbWVudENvbnRleHRLZXlzLldvcmtzcGFjZUhhc0NvbW1lbnRpbmdcblx0XHRcdH1dXG5cdFx0fSk7XG5cdH1cblx0b3ZlcnJpZGUgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiBhbnlbXSk6IHZvaWQge1xuXHRcdGdldEFjdGl2ZUNvbnRyb2xsZXIoYWNjZXNzb3IpPy5jb2xsYXBzZUFsbCgpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBDb21tZW50Q29tbWFuZElkLkV4cGFuZEFsbCxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdHZhbHVlOiBubHMubG9jYWxpemUoJ2NvbW1lbnRzLmV4cGFuZEFsbCcsIFwiRXhwYW5kIEFsbCBDb21tZW50c1wiKSxcblx0XHRcdFx0b3JpZ2luYWw6ICdFeHBhbmQgQWxsIENvbW1lbnRzJ1xuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiB7XG5cdFx0XHRcdHZhbHVlOiBubHMubG9jYWxpemUoJ2NvbW1lbnRzQ2F0ZWdvcnknLCBcIkNvbW1lbnRzXCIpLFxuXHRcdFx0XHRvcmlnaW5hbDogJ0NvbW1lbnRzJ1xuXHRcdFx0fSxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IENvbW1lbnRDb250ZXh0S2V5cy5Xb3Jrc3BhY2VIYXNDb21tZW50aW5nXG5cdFx0XHR9XVxuXHRcdH0pO1xuXHR9XG5cdG92ZXJyaWRlIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pOiB2b2lkIHtcblx0XHRnZXRBY3RpdmVDb250cm9sbGVyKGFjY2Vzc29yKT8uZXhwYW5kQWxsKCk7XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IENvbW1lbnRDb21tYW5kSWQuRXhwYW5kVW5yZXNvbHZlZCxcblx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdHZhbHVlOiBubHMubG9jYWxpemUoJ2NvbW1lbnRzLmV4cGFuZFVucmVzb2x2ZWQnLCBcIkV4cGFuZCBVbnJlc29sdmVkIENvbW1lbnRzXCIpLFxuXHRcdFx0XHRvcmlnaW5hbDogJ0V4cGFuZCBVbnJlc29sdmVkIENvbW1lbnRzJ1xuXHRcdFx0fSxcblx0XHRcdGNhdGVnb3J5OiB7XG5cdFx0XHRcdHZhbHVlOiBubHMubG9jYWxpemUoJ2NvbW1lbnRzQ2F0ZWdvcnknLCBcIkNvbW1lbnRzXCIpLFxuXHRcdFx0XHRvcmlnaW5hbDogJ0NvbW1lbnRzJ1xuXHRcdFx0fSxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IENvbW1lbnRDb250ZXh0S2V5cy5Xb3Jrc3BhY2VIYXNDb21tZW50aW5nXG5cdFx0XHR9XVxuXHRcdH0pO1xuXHR9XG5cdG92ZXJyaWRlIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pOiB2b2lkIHtcblx0XHRnZXRBY3RpdmVDb250cm9sbGVyKGFjY2Vzc29yKT8uZXhwYW5kVW5yZXNvbHZlZCgpO1xuXHR9XG59KTtcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiBDb21tZW50Q29tbWFuZElkLlN1Ym1pdCxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIsXG5cdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5FbnRlcixcblx0d2hlbjogY3R4Q29tbWVudEVkaXRvckZvY3VzZWQsXG5cdGhhbmRsZXI6IChhY2Nlc3NvciwgYXJncykgPT4ge1xuXHRcdGNvbnN0IGFjdGl2ZUNvZGVFZGl0b3IgPSBhY2Nlc3Nvci5nZXQoSUNvZGVFZGl0b3JTZXJ2aWNlKS5nZXRGb2N1c2VkQ29kZUVkaXRvcigpO1xuXHRcdGlmIChhY3RpdmVDb2RlRWRpdG9yIGluc3RhbmNlb2YgU2ltcGxlQ29tbWVudEVkaXRvcikge1xuXHRcdFx0YWN0aXZlQ29kZUVkaXRvci5nZXRQYXJlbnRUaHJlYWQoKS5zdWJtaXRDb21tZW50KCk7XG5cdFx0fVxuXHR9XG59KTtcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiBDb21tZW50Q29tbWFuZElkLkhpZGUsXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliLFxuXHRwcmltYXJ5OiBLZXlDb2RlLkVzY2FwZSxcblx0c2Vjb25kYXJ5OiBbS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5Fc2NhcGVdLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5vcihjdHhDb21tZW50RWRpdG9yRm9jdXNlZCwgQ29tbWVudENvbnRleHRLZXlzLmNvbW1lbnRGb2N1c2VkKSxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yLCBhcmdzKSA9PiB7XG5cdFx0Y29uc3QgYWN0aXZlQ29kZUVkaXRvciA9IGFjY2Vzc29yLmdldChJQ29kZUVkaXRvclNlcnZpY2UpLmdldEZvY3VzZWRDb2RlRWRpdG9yKCk7XG5cdFx0Y29uc3Qga2V5YmluZGluZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUtleWJpbmRpbmdTZXJ2aWNlKTtcblx0XHQvLyBVbmZvcnR1bmF0ZSwgYnV0IGNvbGxhcHNpbmcgdGhlIGNvbW1lbnQgdGhyZWFkIG1pZ2h0IGNhdXNlIGEgZGlhbG9nIHRvIHNob3dcblx0XHQvLyBJZiB3ZSBkb24ndCB3YWl0IGZvciB0aGUga2V5IHVwIGhlcmUsIHRoZW4gdGhlIGRpYWxvZyB3aWxsIGNvbnN1bWUgaXQgYW5kIGltbWVkaWF0ZWx5IGNsb3NlXG5cdFx0YXdhaXQga2V5YmluZGluZ1NlcnZpY2UuZW5hYmxlS2V5YmluZGluZ0hvbGRNb2RlKENvbW1lbnRDb21tYW5kSWQuSGlkZSk7XG5cdFx0aWYgKGFjdGl2ZUNvZGVFZGl0b3IgaW5zdGFuY2VvZiBTaW1wbGVDb21tZW50RWRpdG9yKSB7XG5cdFx0XHRhY3RpdmVDb2RlRWRpdG9yLmdldFBhcmVudFRocmVhZCgpLmNvbGxhcHNlKCk7XG5cdFx0fSBlbHNlIGlmIChhY3RpdmVDb2RlRWRpdG9yKSB7XG5cdFx0XHRjb25zdCBjb250cm9sbGVyID0gQ29tbWVudENvbnRyb2xsZXIuZ2V0KGFjdGl2ZUNvZGVFZGl0b3IpO1xuXHRcdFx0aWYgKCFjb250cm9sbGVyKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgY29tbWVudFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1lbnRTZXJ2aWNlKTtcblx0XHRcdGxldCBlcnJvciA9IGZhbHNlO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgYWN0aXZlQ29tbWVudCA9IGNvbW1lbnRTZXJ2aWNlLmxhc3RBY3RpdmVDb21tZW50Y29udHJvbGxlcj8uYWN0aXZlQ29tbWVudDtcblx0XHRcdFx0aWYgKCFhY3RpdmVDb21tZW50KSB7XG5cdFx0XHRcdFx0ZXJyb3IgPSB0cnVlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnRyb2xsZXIuY29sbGFwc2VBbmRGb2N1c1JhbmdlKGFjdGl2ZUNvbW1lbnQudGhyZWFkLnRocmVhZElkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRlcnJvciA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZXJyb3IpIHtcblx0XHRcdFx0bm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihubHMubG9jYWxpemUoJ2NvbW1lbnRzLmZvY3VzQ29tbWFuZC5lcnJvcicsIFwiVGhlIGN1cnNvciBtdXN0IGJlIG9uIGEgbGluZSB3aXRoIGEgY29tbWVudCB0byBmb2N1cyB0aGUgY29tbWVudFwiKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59KTtcblxuZXhwb3J0IGZ1bmN0aW9uIGdldEFjdGl2ZUVkaXRvcihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IElBY3RpdmVDb2RlRWRpdG9yIHwgbnVsbCB7XG5cdGxldCBhY3RpdmVUZXh0RWRpdG9yQ29udHJvbCA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSkuYWN0aXZlVGV4dEVkaXRvckNvbnRyb2w7XG5cblx0aWYgKGlzRGlmZkVkaXRvcihhY3RpdmVUZXh0RWRpdG9yQ29udHJvbCkpIHtcblx0XHRpZiAoYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wuZ2V0T3JpZ2luYWxFZGl0b3IoKS5oYXNUZXh0Rm9jdXMoKSkge1xuXHRcdFx0YWN0aXZlVGV4dEVkaXRvckNvbnRyb2wgPSBhY3RpdmVUZXh0RWRpdG9yQ29udHJvbC5nZXRPcmlnaW5hbEVkaXRvcigpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhY3RpdmVUZXh0RWRpdG9yQ29udHJvbCA9IGFjdGl2ZVRleHRFZGl0b3JDb250cm9sLmdldE1vZGlmaWVkRWRpdG9yKCk7XG5cdFx0fVxuXHR9XG5cblx0aWYgKCFpc0NvZGVFZGl0b3IoYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wpIHx8ICFhY3RpdmVUZXh0RWRpdG9yQ29udHJvbC5oYXNNb2RlbCgpKSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRyZXR1cm4gYWN0aXZlVGV4dEVkaXRvckNvbnRyb2w7XG59XG5cbmZ1bmN0aW9uIGdldEFjdGl2ZUNvbnRyb2xsZXIoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBDb21tZW50Q29udHJvbGxlciB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IGFjdGl2ZUVkaXRvciA9IGdldEFjdGl2ZUVkaXRvcihhY2Nlc3Nvcik7XG5cdGlmICghYWN0aXZlRWRpdG9yKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGNvbnN0IGNvbnRyb2xsZXIgPSBDb21tZW50Q29udHJvbGxlci5nZXQoYWN0aXZlRWRpdG9yKTtcblx0aWYgKCFjb250cm9sbGVyKSB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXHRyZXR1cm4gY29udHJvbGxlcjtcbn1cblxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxVQUFVLFNBQVMsY0FBYztBQUMxQyxPQUFPO0FBQ1AsU0FBNEIsY0FBYyxvQkFBb0I7QUFDOUQsU0FBUyxpQ0FBaUMsa0NBQWtDO0FBQzVFLFNBQVMsMEJBQTBCO0FBQ25D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
