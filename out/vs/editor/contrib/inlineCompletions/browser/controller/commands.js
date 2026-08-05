import { KeyCode, KeyMod } from "../../../../../base/common/keyCodes.js";
import { asyncTransaction, transaction } from "../../../../../base/common/observable.js";
import { splitLines } from "../../../../../base/common/strings.js";
import * as nls from "../../../../../nls.js";
import { Action2, MenuId } from "../../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { INotificationService, Severity } from "../../../../../platform/notification/common/notification.js";
import { EditorAction, EditorCommand } from "../../../../browser/editorExtensions.js";
import { EditorContextKeys } from "../../../../common/editorContextKeys.js";
import { Context as SuggestContext } from "../../../suggest/browser/suggest.js";
import { hideInlineCompletionId, inlineSuggestCommitId, jumpToNextInlineEditId, showNextInlineSuggestionActionId, showPreviousInlineSuggestionActionId, toggleShowCollapsedId } from "./commandIds.js";
import { InlineCompletionContextKeys } from "./inlineCompletionContextKeys.js";
import { InlineCompletionsController } from "./inlineCompletionsController.js";
const _ShowNextInlineSuggestionAction = class _ShowNextInlineSuggestionAction extends EditorAction {
  constructor() {
    super({
      id: _ShowNextInlineSuggestionAction.ID,
      label: nls.localize2("action.inlineSuggest.showNext", "Show Next Inline Suggestion"),
      precondition: ContextKeyExpr.and(EditorContextKeys.writable, InlineCompletionContextKeys.inlineSuggestionVisible),
      kbOpts: {
        weight: 100,
        primary: KeyMod.Alt | KeyCode.BracketRight
      }
    });
  }
  async run(accessor, editor) {
    const controller = InlineCompletionsController.get(editor);
    controller?.model.get()?.next();
  }
};
_ShowNextInlineSuggestionAction.ID = showNextInlineSuggestionActionId;
let ShowNextInlineSuggestionAction = _ShowNextInlineSuggestionAction;
const _ShowPreviousInlineSuggestionAction = class _ShowPreviousInlineSuggestionAction extends EditorAction {
  constructor() {
    super({
      id: _ShowPreviousInlineSuggestionAction.ID,
      label: nls.localize2("action.inlineSuggest.showPrevious", "Show Previous Inline Suggestion"),
      precondition: ContextKeyExpr.and(EditorContextKeys.writable, InlineCompletionContextKeys.inlineSuggestionVisible),
      kbOpts: {
        weight: 100,
        primary: KeyMod.Alt | KeyCode.BracketLeft
      }
    });
  }
  async run(accessor, editor) {
    const controller = InlineCompletionsController.get(editor);
    controller?.model.get()?.previous();
  }
};
_ShowPreviousInlineSuggestionAction.ID = showPreviousInlineSuggestionActionId;
let ShowPreviousInlineSuggestionAction = _ShowPreviousInlineSuggestionAction;
class TriggerInlineSuggestionAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.inlineSuggest.trigger",
      label: nls.localize2("action.inlineSuggest.trigger", "Trigger Inline Suggestion"),
      precondition: EditorContextKeys.writable
    });
  }
  async run(accessor, editor) {
    const controller = InlineCompletionsController.get(editor);
    await asyncTransaction(async (tx) => {
      await controller?.model.get()?.triggerExplicitly(tx);
      controller?.playAccessibilitySignal(tx);
    });
  }
}
class ExplicitTriggerInlineEditAction extends EditorAction {
  constructor() {
    super({
      id: "editor.action.inlineSuggest.triggerInlineEditExplicit",
      label: nls.localize2("action.inlineSuggest.trigger.explicitInlineEdit", "Trigger Next Edit Suggestion"),
      precondition: EditorContextKeys.writable
    });
  }
  async run(accessor, editor) {
    const notificationService = accessor.get(INotificationService);
    const controller = InlineCompletionsController.get(editor);
    await controller?.model.get()?.triggerExplicitly(void 0, true);
    if (!controller?.model.get()?.inlineEditAvailable.get()) {
      notificationService.notify({
        severity: Severity.Info,
        message: nls.localize("noInlineEditAvailable", "No inline edit is available.")
      });
    }
  }
}
class TriggerInlineEditAction extends EditorCommand {
  constructor() {
    super({
      id: "editor.action.inlineSuggest.triggerInlineEdit",
      precondition: EditorContextKeys.writable
    });
  }
  async runEditorCommand(accessor, editor, args) {
    const controller = InlineCompletionsController.get(editor);
    await controller?.model.get()?.trigger(void 0, { onlyFetchInlineEdits: true });
  }
}
class AcceptNextWordOfInlineCompletion extends EditorAction {
  constructor() {
    super({
      id: "editor.action.inlineSuggest.acceptNextWord",
      label: nls.localize2("action.inlineSuggest.acceptNextWord", "Accept Next Word Of Inline Suggestion"),
      precondition: ContextKeyExpr.and(EditorContextKeys.writable, InlineCompletionContextKeys.inlineSuggestionVisible),
      kbOpts: {
        weight: KeybindingWeight.EditorContrib + 1,
        primary: KeyMod.CtrlCmd | KeyCode.RightArrow,
        kbExpr: ContextKeyExpr.and(EditorContextKeys.writable, InlineCompletionContextKeys.inlineSuggestionVisible)
      },
      menuOpts: [{
        menuId: MenuId.InlineSuggestionToolbar,
        title: nls.localize("acceptWord", "Accept Word"),
        group: "primary",
        order: 2
      }]
    });
  }
  async run(accessor, editor) {
    const controller = InlineCompletionsController.get(editor);
    await controller?.model.get()?.acceptNextWord(controller.editor);
  }
}
class AcceptNextLineOfInlineCompletion extends EditorAction {
  constructor() {
    super({
      id: "editor.action.inlineSuggest.acceptNextLine",
      label: nls.localize2("action.inlineSuggest.acceptNextLine", "Accept Next Line Of Inline Suggestion"),
      precondition: ContextKeyExpr.and(EditorContextKeys.writable, InlineCompletionContextKeys.inlineSuggestionVisible),
      kbOpts: {
        weight: KeybindingWeight.EditorContrib + 1
      },
      menuOpts: [{
        menuId: MenuId.InlineSuggestionToolbar,
        title: nls.localize("acceptLine", "Accept Line"),
        group: "secondary",
        order: 2
      }]
    });
  }
  async run(accessor, editor) {
    const controller = InlineCompletionsController.get(editor);
    await controller?.model.get()?.acceptNextLine(controller.editor);
  }
}
class AcceptInlineCompletion extends EditorAction {
  constructor() {
    super({
      id: inlineSuggestCommitId,
      label: nls.localize2("action.inlineSuggest.accept", "Accept Inline Suggestion"),
      precondition: ContextKeyExpr.or(InlineCompletionContextKeys.inlineSuggestionVisible, InlineCompletionContextKeys.inlineEditVisible),
      menuOpts: [{
        menuId: MenuId.InlineSuggestionToolbar,
        title: nls.localize("accept", "Accept"),
        group: "primary",
        order: 2
      }, {
        menuId: MenuId.InlineEditsActions,
        title: nls.localize("accept", "Accept"),
        group: "primary",
        order: 2
      }],
      kbOpts: [
        {
          primary: KeyCode.Tab,
          weight: 200,
          kbExpr: ContextKeyExpr.or(
            ContextKeyExpr.and(
              InlineCompletionContextKeys.inlineSuggestionVisible,
              EditorContextKeys.tabMovesFocus.toNegated(),
              SuggestContext.Visible.toNegated(),
              EditorContextKeys.hoverFocused.toNegated(),
              InlineCompletionContextKeys.inlineSuggestionHasIndentationLessThanTabSize
            ),
            ContextKeyExpr.and(
              InlineCompletionContextKeys.inlineEditVisible,
              EditorContextKeys.tabMovesFocus.toNegated(),
              SuggestContext.Visible.toNegated(),
              EditorContextKeys.hoverFocused.toNegated(),
              InlineCompletionContextKeys.tabShouldAcceptInlineEdit
            )
          )
        }
      ]
    });
  }
  async run(accessor, editor) {
    const controller = InlineCompletionsController.getInFocusedEditorOrParent(accessor);
    if (controller) {
      controller.model.get()?.accept(controller.editor);
      controller.editor.focus();
    }
  }
}
KeybindingsRegistry.registerKeybindingRule({
  id: inlineSuggestCommitId,
  weight: 202,
  // greater than jump
  primary: KeyCode.Tab,
  when: ContextKeyExpr.and(InlineCompletionContextKeys.inInlineEditsPreviewEditor)
});
class JumpToNextInlineEdit extends EditorAction {
  constructor() {
    super({
      id: jumpToNextInlineEditId,
      label: nls.localize2("action.inlineSuggest.jump", "Jump to next inline edit"),
      precondition: InlineCompletionContextKeys.inlineEditVisible,
      menuOpts: [{
        menuId: MenuId.InlineEditsActions,
        title: nls.localize("jump", "Jump"),
        group: "primary",
        order: 1,
        when: InlineCompletionContextKeys.cursorAtInlineEdit.toNegated()
      }],
      kbOpts: {
        primary: KeyCode.Tab,
        weight: 201,
        kbExpr: ContextKeyExpr.and(
          InlineCompletionContextKeys.inlineEditVisible,
          EditorContextKeys.tabMovesFocus.toNegated(),
          SuggestContext.Visible.toNegated(),
          EditorContextKeys.hoverFocused.toNegated(),
          InlineCompletionContextKeys.tabShouldJumpToInlineEdit
        )
      }
    });
  }
  async run(accessor, editor) {
    const controller = InlineCompletionsController.get(editor);
    if (controller) {
      controller.jump();
    }
  }
}
class AcceptNextInlineEditPart extends EditorAction {
  constructor() {
    super({
      id: "editor.action.inlineSuggest.acceptNextInlineEditPart",
      label: nls.localize2("action.inlineSuggest.acceptNextInlineEditPart", "Accept Next Inline Edit Part"),
      precondition: ContextKeyExpr.and(EditorContextKeys.writable, InlineCompletionContextKeys.inlineEditVisible),
      kbOpts: {
        weight: KeybindingWeight.EditorContrib + 1,
        kbExpr: ContextKeyExpr.and(EditorContextKeys.writable, InlineCompletionContextKeys.inlineEditVisible)
      }
    });
  }
  async run(accessor, editor) {
    const controller = InlineCompletionsController.get(editor);
    await controller?.model.get()?.acceptNextInlineEditPart(controller.editor);
  }
}
const _HideInlineCompletion = class _HideInlineCompletion extends EditorAction {
  constructor() {
    super({
      id: _HideInlineCompletion.ID,
      label: nls.localize2("action.inlineSuggest.hide", "Hide Inline Suggestion"),
      precondition: ContextKeyExpr.or(InlineCompletionContextKeys.inlineSuggestionVisible, InlineCompletionContextKeys.inlineEditVisible),
      kbOpts: {
        weight: KeybindingWeight.EditorContrib + 90,
        // same as hiding the suggest widget
        primary: KeyCode.Escape
      },
      menuOpts: [{
        menuId: MenuId.InlineEditsActions,
        title: nls.localize("reject", "Reject"),
        group: "primary",
        order: 3
      }]
    });
  }
  async run(accessor, editor) {
    const controller = InlineCompletionsController.getInFocusedEditorOrParent(accessor);
    transaction((tx) => {
      controller?.model.get()?.stop("explicitCancel", tx);
    });
    controller?.editor.focus();
  }
};
_HideInlineCompletion.ID = hideInlineCompletionId;
let HideInlineCompletion = _HideInlineCompletion;
const _ToggleInlineCompletionShowCollapsed = class _ToggleInlineCompletionShowCollapsed extends EditorAction {
  constructor() {
    super({
      id: _ToggleInlineCompletionShowCollapsed.ID,
      label: nls.localize2("action.inlineSuggest.toggleShowCollapsed", "Toggle Inline Suggestions Show Collapsed"),
      precondition: ContextKeyExpr.true()
    });
  }
  async run(accessor, editor) {
    const configurationService = accessor.get(IConfigurationService);
    const showCollapsed = configurationService.getValue("editor.inlineSuggest.edits.showCollapsed");
    configurationService.updateValue("editor.inlineSuggest.edits.showCollapsed", !showCollapsed);
  }
};
_ToggleInlineCompletionShowCollapsed.ID = toggleShowCollapsedId;
let ToggleInlineCompletionShowCollapsed = _ToggleInlineCompletionShowCollapsed;
KeybindingsRegistry.registerKeybindingRule({
  id: HideInlineCompletion.ID,
  weight: -1,
  // very weak
  primary: KeyCode.Escape,
  secondary: [KeyMod.Shift | KeyCode.Escape],
  when: ContextKeyExpr.and(InlineCompletionContextKeys.inInlineEditsPreviewEditor)
});
const _ToggleAlwaysShowInlineSuggestionToolbar = class _ToggleAlwaysShowInlineSuggestionToolbar extends Action2 {
  constructor() {
    super({
      id: _ToggleAlwaysShowInlineSuggestionToolbar.ID,
      title: nls.localize("action.inlineSuggest.alwaysShowToolbar", "Always Show Toolbar"),
      f1: false,
      precondition: void 0,
      menu: [{
        id: MenuId.InlineSuggestionToolbar,
        group: "secondary",
        order: 10
      }],
      toggled: ContextKeyExpr.equals("config.editor.inlineSuggest.showToolbar", "always")
    });
  }
  async run(accessor) {
    const configService = accessor.get(IConfigurationService);
    const currentValue = configService.getValue("editor.inlineSuggest.showToolbar");
    const newValue = currentValue === "always" ? "onHover" : "always";
    configService.updateValue("editor.inlineSuggest.showToolbar", newValue);
  }
};
_ToggleAlwaysShowInlineSuggestionToolbar.ID = "editor.action.inlineSuggest.toggleAlwaysShowToolbar";
let ToggleAlwaysShowInlineSuggestionToolbar = _ToggleAlwaysShowInlineSuggestionToolbar;
class DevExtractReproSample extends EditorAction {
  constructor() {
    super({
      id: "editor.action.inlineSuggest.dev.extractRepro",
      label: nls.localize("action.inlineSuggest.dev.extractRepro", "Developer: Extract Inline Suggest State"),
      alias: "Developer: Inline Suggest Extract Repro",
      precondition: InlineCompletionContextKeys.inlineEditVisible
    });
  }
  async run(accessor, editor) {
    const clipboardService = accessor.get(IClipboardService);
    const controller = InlineCompletionsController.get(editor);
    const m = controller?.model.get();
    if (!m) {
      return;
    }
    const repro = m.extractReproSample();
    const inlineCompletionLines = splitLines(JSON.stringify({ inlineCompletion: repro.inlineCompletion }, null, 4));
    const json = inlineCompletionLines.map((l) => "// " + l).join("\n");
    const reproStr = `${repro.documentValue}

// <json>
${json}
// </json>
`;
    await clipboardService.writeText(reproStr);
    return { reproCase: reproStr };
  }
}
export {
  AcceptInlineCompletion,
  AcceptNextInlineEditPart,
  AcceptNextLineOfInlineCompletion,
  AcceptNextWordOfInlineCompletion,
  DevExtractReproSample,
  ExplicitTriggerInlineEditAction,
  HideInlineCompletion,
  JumpToNextInlineEdit,
  ShowNextInlineSuggestionAction,
  ShowPreviousInlineSuggestionAction,
  ToggleAlwaysShowInlineSuggestionToolbar,
  ToggleInlineCompletionShowCollapsed,
  TriggerInlineEditAction,
  TriggerInlineSuggestionAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL2NvbnRyb2xsZXIvY29tbWFuZHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBhc3luY1RyYW5zYWN0aW9uLCB0cmFuc2FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgc3BsaXRMaW5lcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL2NvbW1vbi9jbGlwYm9hcmRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdzUmVnaXN0cnksIEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlLCBTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEVkaXRvckFjdGlvbiwgRWRpdG9yQ29tbWFuZCwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JDb250ZXh0S2V5cyB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3JDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0IGFzIFN1Z2dlc3RDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vc3VnZ2VzdC9icm93c2VyL3N1Z2dlc3QuanMnO1xuaW1wb3J0IHsgaGlkZUlubGluZUNvbXBsZXRpb25JZCwgaW5saW5lU3VnZ2VzdENvbW1pdElkLCBqdW1wVG9OZXh0SW5saW5lRWRpdElkLCBzaG93TmV4dElubGluZVN1Z2dlc3Rpb25BY3Rpb25JZCwgc2hvd1ByZXZpb3VzSW5saW5lU3VnZ2VzdGlvbkFjdGlvbklkLCB0b2dnbGVTaG93Q29sbGFwc2VkSWQgfSBmcm9tICcuL2NvbW1hbmRJZHMuanMnO1xuaW1wb3J0IHsgSW5saW5lQ29tcGxldGlvbkNvbnRleHRLZXlzIH0gZnJvbSAnLi9pbmxpbmVDb21wbGV0aW9uQ29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgSW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyIH0gZnJvbSAnLi9pbmxpbmVDb21wbGV0aW9uc0NvbnRyb2xsZXIuanMnO1xuXG5leHBvcnQgY2xhc3MgU2hvd05leHRJbmxpbmVTdWdnZXN0aW9uQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblx0cHVibGljIHN0YXRpYyBJRCA9IHNob3dOZXh0SW5saW5lU3VnZ2VzdGlvbkFjdGlvbklkO1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogU2hvd05leHRJbmxpbmVTdWdnZXN0aW9uQWN0aW9uLklELFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2FjdGlvbi5pbmxpbmVTdWdnZXN0LnNob3dOZXh0JywgXCJTaG93IE5leHQgSW5saW5lIFN1Z2dlc3Rpb25cIiksXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZSwgSW5saW5lQ29tcGxldGlvbkNvbnRleHRLZXlzLmlubGluZVN1Z2dlc3Rpb25WaXNpYmxlKSxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHR3ZWlnaHQ6IDEwMCxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleUNvZGUuQnJhY2tldFJpZ2h0LFxuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IgfCB1bmRlZmluZWQsIGVkaXRvcjogSUNvZGVFZGl0b3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb250cm9sbGVyID0gSW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXHRcdGNvbnRyb2xsZXI/Lm1vZGVsLmdldCgpPy5uZXh0KCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNob3dQcmV2aW91c0lubGluZVN1Z2dlc3Rpb25BY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXHRwdWJsaWMgc3RhdGljIElEID0gc2hvd1ByZXZpb3VzSW5saW5lU3VnZ2VzdGlvbkFjdGlvbklkO1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogU2hvd1ByZXZpb3VzSW5saW5lU3VnZ2VzdGlvbkFjdGlvbi5JRCxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdhY3Rpb24uaW5saW5lU3VnZ2VzdC5zaG93UHJldmlvdXMnLCBcIlNob3cgUHJldmlvdXMgSW5saW5lIFN1Z2dlc3Rpb25cIiksXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZSwgSW5saW5lQ29tcGxldGlvbkNvbnRleHRLZXlzLmlubGluZVN1Z2dlc3Rpb25WaXNpYmxlKSxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHR3ZWlnaHQ6IDEwMCxcblx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleUNvZGUuQnJhY2tldExlZnQsXG5cdFx0XHR9LFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciB8IHVuZGVmaW5lZCwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBJbmxpbmVDb21wbGV0aW9uc0NvbnRyb2xsZXIuZ2V0KGVkaXRvcik7XG5cdFx0Y29udHJvbGxlcj8ubW9kZWwuZ2V0KCk/LnByZXZpb3VzKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRyaWdnZXJJbmxpbmVTdWdnZXN0aW9uQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLmlubGluZVN1Z2dlc3QudHJpZ2dlcicsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignYWN0aW9uLmlubGluZVN1Z2dlc3QudHJpZ2dlcicsIFwiVHJpZ2dlciBJbmxpbmUgU3VnZ2VzdGlvblwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMud3JpdGFibGVcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IgfCB1bmRlZmluZWQsIGVkaXRvcjogSUNvZGVFZGl0b3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb250cm9sbGVyID0gSW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXHRcdGF3YWl0IGFzeW5jVHJhbnNhY3Rpb24oYXN5bmMgdHggPT4ge1xuXHRcdFx0LyoqIEBkZXNjcmlwdGlvbiB0cmlnZ2VyRXhwbGljaXRseSBmcm9tIGNvbW1hbmQgKi9cblx0XHRcdGF3YWl0IGNvbnRyb2xsZXI/Lm1vZGVsLmdldCgpPy50cmlnZ2VyRXhwbGljaXRseSh0eCk7XG5cdFx0XHRjb250cm9sbGVyPy5wbGF5QWNjZXNzaWJpbGl0eVNpZ25hbCh0eCk7XG5cdFx0fSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4cGxpY2l0VHJpZ2dlcklubGluZUVkaXRBY3Rpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uaW5saW5lU3VnZ2VzdC50cmlnZ2VySW5saW5lRWRpdEV4cGxpY2l0Jyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdhY3Rpb24uaW5saW5lU3VnZ2VzdC50cmlnZ2VyLmV4cGxpY2l0SW5saW5lRWRpdCcsIFwiVHJpZ2dlciBOZXh0IEVkaXQgU3VnZ2VzdGlvblwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMud3JpdGFibGUsXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yIHwgdW5kZWZpbmVkLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgbm90aWZpY2F0aW9uU2VydmljZSA9IGFjY2Vzc29yIS5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBJbmxpbmVDb21wbGV0aW9uc0NvbnRyb2xsZXIuZ2V0KGVkaXRvcik7XG5cblx0XHRhd2FpdCBjb250cm9sbGVyPy5tb2RlbC5nZXQoKT8udHJpZ2dlckV4cGxpY2l0bHkodW5kZWZpbmVkLCB0cnVlKTtcblx0XHRpZiAoIWNvbnRyb2xsZXI/Lm1vZGVsLmdldCgpPy5pbmxpbmVFZGl0QXZhaWxhYmxlLmdldCgpKSB7XG5cdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLm5vdGlmeSh7XG5cdFx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5JbmZvLFxuXHRcdFx0XHRtZXNzYWdlOiBubHMubG9jYWxpemUoJ25vSW5saW5lRWRpdEF2YWlsYWJsZScsIFwiTm8gaW5saW5lIGVkaXQgaXMgYXZhaWxhYmxlLlwiKVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUcmlnZ2VySW5saW5lRWRpdEFjdGlvbiBleHRlbmRzIEVkaXRvckNvbW1hbmQge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uaW5saW5lU3VnZ2VzdC50cmlnZ2VySW5saW5lRWRpdCcsXG5cdFx0XHRwcmVjb25kaXRpb246IEVkaXRvckNvbnRleHRLZXlzLndyaXRhYmxlLFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGFzeW5jIHJ1bkVkaXRvckNvbW1hbmQoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IgfCBudWxsLCBlZGl0b3I6IElDb2RlRWRpdG9yLCBhcmdzOiB7IHRyaWdnZXJLaW5kPzogJ2F1dG9tYXRpYycgfCAnZXhwbGljaXQnIH0pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb250cm9sbGVyID0gSW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXHRcdGF3YWl0IGNvbnRyb2xsZXI/Lm1vZGVsLmdldCgpPy50cmlnZ2VyKHVuZGVmaW5lZCwgeyBvbmx5RmV0Y2hJbmxpbmVFZGl0czogdHJ1ZSB9KTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQWNjZXB0TmV4dFdvcmRPZklubGluZUNvbXBsZXRpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uaW5saW5lU3VnZ2VzdC5hY2NlcHROZXh0V29yZCcsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignYWN0aW9uLmlubGluZVN1Z2dlc3QuYWNjZXB0TmV4dFdvcmQnLCBcIkFjY2VwdCBOZXh0IFdvcmQgT2YgSW5saW5lIFN1Z2dlc3Rpb25cIiksXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZSwgSW5saW5lQ29tcGxldGlvbkNvbnRleHRLZXlzLmlubGluZVN1Z2dlc3Rpb25WaXNpYmxlKSxcblx0XHRcdGtiT3B0czoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYiArIDEsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5SaWdodEFycm93LFxuXHRcdFx0XHRrYkV4cHI6IENvbnRleHRLZXlFeHByLmFuZChFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZSwgSW5saW5lQ29tcGxldGlvbkNvbnRleHRLZXlzLmlubGluZVN1Z2dlc3Rpb25WaXNpYmxlKSxcblx0XHRcdH0sXG5cdFx0XHRtZW51T3B0czogW3tcblx0XHRcdFx0bWVudUlkOiBNZW51SWQuSW5saW5lU3VnZ2VzdGlvblRvb2xiYXIsXG5cdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ2FjY2VwdFdvcmQnLCAnQWNjZXB0IFdvcmQnKSxcblx0XHRcdFx0Z3JvdXA6ICdwcmltYXJ5Jyxcblx0XHRcdFx0b3JkZXI6IDIsXG5cdFx0XHR9XSxcblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IgfCB1bmRlZmluZWQsIGVkaXRvcjogSUNvZGVFZGl0b3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb250cm9sbGVyID0gSW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXHRcdGF3YWl0IGNvbnRyb2xsZXI/Lm1vZGVsLmdldCgpPy5hY2NlcHROZXh0V29yZChjb250cm9sbGVyLmVkaXRvcik7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEFjY2VwdE5leHRMaW5lT2ZJbmxpbmVDb21wbGV0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuYWN0aW9uLmlubGluZVN1Z2dlc3QuYWNjZXB0TmV4dExpbmUnLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZTIoJ2FjdGlvbi5pbmxpbmVTdWdnZXN0LmFjY2VwdE5leHRMaW5lJywgXCJBY2NlcHQgTmV4dCBMaW5lIE9mIElubGluZSBTdWdnZXN0aW9uXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoRWRpdG9yQ29udGV4dEtleXMud3JpdGFibGUsIElubGluZUNvbXBsZXRpb25Db250ZXh0S2V5cy5pbmxpbmVTdWdnZXN0aW9uVmlzaWJsZSksXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIgKyAxLFxuXHRcdFx0fSxcblx0XHRcdG1lbnVPcHRzOiBbe1xuXHRcdFx0XHRtZW51SWQ6IE1lbnVJZC5JbmxpbmVTdWdnZXN0aW9uVG9vbGJhcixcblx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnYWNjZXB0TGluZScsICdBY2NlcHQgTGluZScpLFxuXHRcdFx0XHRncm91cDogJ3NlY29uZGFyeScsXG5cdFx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0fV0sXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yIHwgdW5kZWZpbmVkLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29udHJvbGxlciA9IElubGluZUNvbXBsZXRpb25zQ29udHJvbGxlci5nZXQoZWRpdG9yKTtcblx0XHRhd2FpdCBjb250cm9sbGVyPy5tb2RlbC5nZXQoKT8uYWNjZXB0TmV4dExpbmUoY29udHJvbGxlci5lZGl0b3IpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBBY2NlcHRJbmxpbmVDb21wbGV0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IGlubGluZVN1Z2dlc3RDb21taXRJZCxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdhY3Rpb24uaW5saW5lU3VnZ2VzdC5hY2NlcHQnLCBcIkFjY2VwdCBJbmxpbmUgU3VnZ2VzdGlvblwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIub3IoSW5saW5lQ29tcGxldGlvbkNvbnRleHRLZXlzLmlubGluZVN1Z2dlc3Rpb25WaXNpYmxlLCBJbmxpbmVDb21wbGV0aW9uQ29udGV4dEtleXMuaW5saW5lRWRpdFZpc2libGUpLFxuXHRcdFx0bWVudU9wdHM6IFt7XG5cdFx0XHRcdG1lbnVJZDogTWVudUlkLklubGluZVN1Z2dlc3Rpb25Ub29sYmFyLFxuXHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdhY2NlcHQnLCBcIkFjY2VwdFwiKSxcblx0XHRcdFx0Z3JvdXA6ICdwcmltYXJ5Jyxcblx0XHRcdFx0b3JkZXI6IDIsXG5cdFx0XHR9LCB7XG5cdFx0XHRcdG1lbnVJZDogTWVudUlkLklubGluZUVkaXRzQWN0aW9ucyxcblx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnYWNjZXB0JywgXCJBY2NlcHRcIiksXG5cdFx0XHRcdGdyb3VwOiAncHJpbWFyeScsXG5cdFx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0fV0sXG5cdFx0XHRrYk9wdHM6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuVGFiLFxuXHRcdFx0XHRcdHdlaWdodDogMjAwLFxuXHRcdFx0XHRcdGtiRXhwcjogQ29udGV4dEtleUV4cHIub3IoXG5cdFx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdFx0XHRcdElubGluZUNvbXBsZXRpb25Db250ZXh0S2V5cy5pbmxpbmVTdWdnZXN0aW9uVmlzaWJsZSxcblx0XHRcdFx0XHRcdFx0RWRpdG9yQ29udGV4dEtleXMudGFiTW92ZXNGb2N1cy50b05lZ2F0ZWQoKSxcblx0XHRcdFx0XHRcdFx0U3VnZ2VzdENvbnRleHQuVmlzaWJsZS50b05lZ2F0ZWQoKSxcblx0XHRcdFx0XHRcdFx0RWRpdG9yQ29udGV4dEtleXMuaG92ZXJGb2N1c2VkLnRvTmVnYXRlZCgpLFxuXG5cdFx0XHRcdFx0XHRcdElubGluZUNvbXBsZXRpb25Db250ZXh0S2V5cy5pbmxpbmVTdWdnZXN0aW9uSGFzSW5kZW50YXRpb25MZXNzVGhhblRhYlNpemUsXG5cdFx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdFx0XHRJbmxpbmVDb21wbGV0aW9uQ29udGV4dEtleXMuaW5saW5lRWRpdFZpc2libGUsXG5cdFx0XHRcdFx0XHRcdEVkaXRvckNvbnRleHRLZXlzLnRhYk1vdmVzRm9jdXMudG9OZWdhdGVkKCksXG5cdFx0XHRcdFx0XHRcdFN1Z2dlc3RDb250ZXh0LlZpc2libGUudG9OZWdhdGVkKCksXG5cdFx0XHRcdFx0XHRcdEVkaXRvckNvbnRleHRLZXlzLmhvdmVyRm9jdXNlZC50b05lZ2F0ZWQoKSxcblxuXHRcdFx0XHRcdFx0XHRJbmxpbmVDb21wbGV0aW9uQ29udGV4dEtleXMudGFiU2hvdWxkQWNjZXB0SW5saW5lRWRpdCxcblx0XHRcdFx0XHRcdClcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHR9XG5cdFx0XHRdLFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBJbmxpbmVDb21wbGV0aW9uc0NvbnRyb2xsZXIuZ2V0SW5Gb2N1c2VkRWRpdG9yT3JQYXJlbnQoYWNjZXNzb3IpO1xuXHRcdGlmIChjb250cm9sbGVyKSB7XG5cdFx0XHRjb250cm9sbGVyLm1vZGVsLmdldCgpPy5hY2NlcHQoY29udHJvbGxlci5lZGl0b3IpO1xuXHRcdFx0Y29udHJvbGxlci5lZGl0b3IuZm9jdXMoKTtcblx0XHR9XG5cdH1cbn1cbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiBpbmxpbmVTdWdnZXN0Q29tbWl0SWQsXG5cdHdlaWdodDogMjAyLCAvLyBncmVhdGVyIHRoYW4ganVtcFxuXHRwcmltYXJ5OiBLZXlDb2RlLlRhYixcblx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKElubGluZUNvbXBsZXRpb25Db250ZXh0S2V5cy5pbklubGluZUVkaXRzUHJldmlld0VkaXRvcilcbn0pO1xuXG5leHBvcnQgY2xhc3MgSnVtcFRvTmV4dElubGluZUVkaXQgZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDoganVtcFRvTmV4dElubGluZUVkaXRJZCxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdhY3Rpb24uaW5saW5lU3VnZ2VzdC5qdW1wJywgXCJKdW1wIHRvIG5leHQgaW5saW5lIGVkaXRcIiksXG5cdFx0XHRwcmVjb25kaXRpb246IElubGluZUNvbXBsZXRpb25Db250ZXh0S2V5cy5pbmxpbmVFZGl0VmlzaWJsZSxcblx0XHRcdG1lbnVPcHRzOiBbe1xuXHRcdFx0XHRtZW51SWQ6IE1lbnVJZC5JbmxpbmVFZGl0c0FjdGlvbnMsXG5cdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ2p1bXAnLCBcIkp1bXBcIiksXG5cdFx0XHRcdGdyb3VwOiAncHJpbWFyeScsXG5cdFx0XHRcdG9yZGVyOiAxLFxuXHRcdFx0XHR3aGVuOiBJbmxpbmVDb21wbGV0aW9uQ29udGV4dEtleXMuY3Vyc29yQXRJbmxpbmVFZGl0LnRvTmVnYXRlZCgpLFxuXHRcdFx0fV0sXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5UYWIsXG5cdFx0XHRcdHdlaWdodDogMjAxLFxuXHRcdFx0XHRrYkV4cHI6IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRJbmxpbmVDb21wbGV0aW9uQ29udGV4dEtleXMuaW5saW5lRWRpdFZpc2libGUsXG5cdFx0XHRcdFx0RWRpdG9yQ29udGV4dEtleXMudGFiTW92ZXNGb2N1cy50b05lZ2F0ZWQoKSxcblx0XHRcdFx0XHRTdWdnZXN0Q29udGV4dC5WaXNpYmxlLnRvTmVnYXRlZCgpLFxuXHRcdFx0XHRcdEVkaXRvckNvbnRleHRLZXlzLmhvdmVyRm9jdXNlZC50b05lZ2F0ZWQoKSxcblx0XHRcdFx0XHRJbmxpbmVDb21wbGV0aW9uQ29udGV4dEtleXMudGFiU2hvdWxkSnVtcFRvSW5saW5lRWRpdCxcblx0XHRcdFx0KSxcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IgfCB1bmRlZmluZWQsIGVkaXRvcjogSUNvZGVFZGl0b3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb250cm9sbGVyID0gSW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXHRcdGlmIChjb250cm9sbGVyKSB7XG5cdFx0XHRjb250cm9sbGVyLmp1bXAoKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEFjY2VwdE5leHRJbmxpbmVFZGl0UGFydCBleHRlbmRzIEVkaXRvckFjdGlvbiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnZWRpdG9yLmFjdGlvbi5pbmxpbmVTdWdnZXN0LmFjY2VwdE5leHRJbmxpbmVFZGl0UGFydCcsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignYWN0aW9uLmlubGluZVN1Z2dlc3QuYWNjZXB0TmV4dElubGluZUVkaXRQYXJ0JywgXCJBY2NlcHQgTmV4dCBJbmxpbmUgRWRpdCBQYXJ0XCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoRWRpdG9yQ29udGV4dEtleXMud3JpdGFibGUsIElubGluZUNvbXBsZXRpb25Db250ZXh0S2V5cy5pbmxpbmVFZGl0VmlzaWJsZSksXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWIgKyAxLFxuXHRcdFx0XHRrYkV4cHI6IENvbnRleHRLZXlFeHByLmFuZChFZGl0b3JDb250ZXh0S2V5cy53cml0YWJsZSwgSW5saW5lQ29tcGxldGlvbkNvbnRleHRLZXlzLmlubGluZUVkaXRWaXNpYmxlKSxcblx0XHRcdH0sXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yIHwgdW5kZWZpbmVkLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29udHJvbGxlciA9IElubGluZUNvbXBsZXRpb25zQ29udHJvbGxlci5nZXQoZWRpdG9yKTtcblx0XHRhd2FpdCBjb250cm9sbGVyPy5tb2RlbC5nZXQoKT8uYWNjZXB0TmV4dElubGluZUVkaXRQYXJ0KGNvbnRyb2xsZXIuZWRpdG9yKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgSGlkZUlubGluZUNvbXBsZXRpb24gZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXHRwdWJsaWMgc3RhdGljIElEID0gaGlkZUlubGluZUNvbXBsZXRpb25JZDtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogSGlkZUlubGluZUNvbXBsZXRpb24uSUQsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignYWN0aW9uLmlubGluZVN1Z2dlc3QuaGlkZScsIFwiSGlkZSBJbmxpbmUgU3VnZ2VzdGlvblwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIub3IoSW5saW5lQ29tcGxldGlvbkNvbnRleHRLZXlzLmlubGluZVN1Z2dlc3Rpb25WaXNpYmxlLCBJbmxpbmVDb21wbGV0aW9uQ29udGV4dEtleXMuaW5saW5lRWRpdFZpc2libGUpLFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliICsgOTAsIC8vIHNhbWUgYXMgaGlkaW5nIHRoZSBzdWdnZXN0IHdpZGdldFxuXHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkVzY2FwZSxcblx0XHRcdH0sXG5cdFx0XHRtZW51T3B0czogW3tcblx0XHRcdFx0bWVudUlkOiBNZW51SWQuSW5saW5lRWRpdHNBY3Rpb25zLFxuXHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdyZWplY3QnLCBcIlJlamVjdFwiKSxcblx0XHRcdFx0Z3JvdXA6ICdwcmltYXJ5Jyxcblx0XHRcdFx0b3JkZXI6IDMsXG5cdFx0XHR9XVxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGNvbnRyb2xsZXIgPSBJbmxpbmVDb21wbGV0aW9uc0NvbnRyb2xsZXIuZ2V0SW5Gb2N1c2VkRWRpdG9yT3JQYXJlbnQoYWNjZXNzb3IpO1xuXHRcdHRyYW5zYWN0aW9uKHR4ID0+IHtcblx0XHRcdGNvbnRyb2xsZXI/Lm1vZGVsLmdldCgpPy5zdG9wKCdleHBsaWNpdENhbmNlbCcsIHR4KTtcblx0XHR9KTtcblx0XHRjb250cm9sbGVyPy5lZGl0b3IuZm9jdXMoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVG9nZ2xlSW5saW5lQ29tcGxldGlvblNob3dDb2xsYXBzZWQgZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXHRwdWJsaWMgc3RhdGljIElEID0gdG9nZ2xlU2hvd0NvbGxhcHNlZElkO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUb2dnbGVJbmxpbmVDb21wbGV0aW9uU2hvd0NvbGxhcHNlZC5JRCxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUyKCdhY3Rpb24uaW5saW5lU3VnZ2VzdC50b2dnbGVTaG93Q29sbGFwc2VkJywgXCJUb2dnbGUgSW5saW5lIFN1Z2dlc3Rpb25zIFNob3cgQ29sbGFwc2VkXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci50cnVlKCksXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBzaG93Q29sbGFwc2VkID0gY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ2VkaXRvci5pbmxpbmVTdWdnZXN0LmVkaXRzLnNob3dDb2xsYXBzZWQnKTtcblx0XHRjb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZSgnZWRpdG9yLmlubGluZVN1Z2dlc3QuZWRpdHMuc2hvd0NvbGxhcHNlZCcsICFzaG93Q29sbGFwc2VkKTtcblx0fVxufVxuXG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogSGlkZUlubGluZUNvbXBsZXRpb24uSUQsXG5cdHdlaWdodDogLTEsIC8vIHZlcnkgd2Vha1xuXHRwcmltYXJ5OiBLZXlDb2RlLkVzY2FwZSxcblx0c2Vjb25kYXJ5OiBbS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5Fc2NhcGVdLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoSW5saW5lQ29tcGxldGlvbkNvbnRleHRLZXlzLmluSW5saW5lRWRpdHNQcmV2aWV3RWRpdG9yKVxufSk7XG5cbmV4cG9ydCBjbGFzcyBUb2dnbGVBbHdheXNTaG93SW5saW5lU3VnZ2VzdGlvblRvb2xiYXIgZXh0ZW5kcyBBY3Rpb24yIHtcblx0cHVibGljIHN0YXRpYyBJRCA9ICdlZGl0b3IuYWN0aW9uLmlubGluZVN1Z2dlc3QudG9nZ2xlQWx3YXlzU2hvd1Rvb2xiYXInO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBUb2dnbGVBbHdheXNTaG93SW5saW5lU3VnZ2VzdGlvblRvb2xiYXIuSUQsXG5cdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdhY3Rpb24uaW5saW5lU3VnZ2VzdC5hbHdheXNTaG93VG9vbGJhcicsIFwiQWx3YXlzIFNob3cgVG9vbGJhclwiKSxcblx0XHRcdGYxOiBmYWxzZSxcblx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5JbmxpbmVTdWdnZXN0aW9uVG9vbGJhcixcblx0XHRcdFx0Z3JvdXA6ICdzZWNvbmRhcnknLFxuXHRcdFx0XHRvcmRlcjogMTAsXG5cdFx0XHR9XSxcblx0XHRcdHRvZ2dsZWQ6IENvbnRleHRLZXlFeHByLmVxdWFscygnY29uZmlnLmVkaXRvci5pbmxpbmVTdWdnZXN0LnNob3dUb29sYmFyJywgJ2Fsd2F5cycpXG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgY29uZmlnU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IGN1cnJlbnRWYWx1ZSA9IGNvbmZpZ1NlcnZpY2UuZ2V0VmFsdWU8J2Fsd2F5cycgfCAnb25Ib3Zlcic+KCdlZGl0b3IuaW5saW5lU3VnZ2VzdC5zaG93VG9vbGJhcicpO1xuXHRcdGNvbnN0IG5ld1ZhbHVlID0gY3VycmVudFZhbHVlID09PSAnYWx3YXlzJyA/ICdvbkhvdmVyJyA6ICdhbHdheXMnO1xuXHRcdGNvbmZpZ1NlcnZpY2UudXBkYXRlVmFsdWUoJ2VkaXRvci5pbmxpbmVTdWdnZXN0LnNob3dUb29sYmFyJywgbmV3VmFsdWUpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBEZXZFeHRyYWN0UmVwcm9TYW1wbGUgZXh0ZW5kcyBFZGl0b3JBY3Rpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uaW5saW5lU3VnZ2VzdC5kZXYuZXh0cmFjdFJlcHJvJyxcblx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ2FjdGlvbi5pbmxpbmVTdWdnZXN0LmRldi5leHRyYWN0UmVwcm8nLCBcIkRldmVsb3BlcjogRXh0cmFjdCBJbmxpbmUgU3VnZ2VzdCBTdGF0ZVwiKSxcblx0XHRcdGFsaWFzOiAnRGV2ZWxvcGVyOiBJbmxpbmUgU3VnZ2VzdCBFeHRyYWN0IFJlcHJvJyxcblx0XHRcdHByZWNvbmRpdGlvbjogSW5saW5lQ29tcGxldGlvbkNvbnRleHRLZXlzLmlubGluZUVkaXRWaXNpYmxlLFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZWRpdG9yOiBJQ29kZUVkaXRvcik6IFByb21pc2U8YW55PiB7XG5cdFx0Y29uc3QgY2xpcGJvYXJkU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2xpcGJvYXJkU2VydmljZSk7XG5cblx0XHRjb25zdCBjb250cm9sbGVyID0gSW5saW5lQ29tcGxldGlvbnNDb250cm9sbGVyLmdldChlZGl0b3IpO1xuXHRcdGNvbnN0IG0gPSBjb250cm9sbGVyPy5tb2RlbC5nZXQoKTtcblx0XHRpZiAoIW0pIHsgcmV0dXJuOyB9XG5cdFx0Y29uc3QgcmVwcm8gPSBtLmV4dHJhY3RSZXByb1NhbXBsZSgpO1xuXG5cdFx0Y29uc3QgaW5saW5lQ29tcGxldGlvbkxpbmVzID0gc3BsaXRMaW5lcyhKU09OLnN0cmluZ2lmeSh7IGlubGluZUNvbXBsZXRpb246IHJlcHJvLmlubGluZUNvbXBsZXRpb24gfSwgbnVsbCwgNCkpO1xuXG5cdFx0Y29uc3QganNvbiA9IGlubGluZUNvbXBsZXRpb25MaW5lcy5tYXAobCA9PiAnLy8gJyArIGwpLmpvaW4oJ1xcbicpO1xuXG5cdFx0Y29uc3QgcmVwcm9TdHIgPSBgJHtyZXByby5kb2N1bWVudFZhbHVlfVxcblxcbi8vIDxqc29uPlxcbiR7anNvbn1cXG4vLyA8L2pzb24+XFxuYDtcblxuXHRcdGF3YWl0IGNsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KHJlcHJvU3RyKTtcblxuXHRcdHJldHVybiB7IHJlcHJvQ2FzZTogcmVwcm9TdHIgfTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxTQUFTLGNB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
