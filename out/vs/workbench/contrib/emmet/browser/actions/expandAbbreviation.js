import * as nls from "../../../../../nls.js";
import { EmmetEditorAction } from "../emmetActions.js";
import { registerEditorAction } from "../../../../../editor/browser/editorExtensions.js";
import { EditorContextKeys } from "../../../../../editor/common/editorContextKeys.js";
import { KeyCode } from "../../../../../base/common/keyCodes.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { KeybindingWeight } from "../../../../../platform/keybinding/common/keybindingsRegistry.js";
import { MenuId } from "../../../../../platform/actions/common/actions.js";
class ExpandAbbreviationAction extends EmmetEditorAction {
  constructor() {
    super({
      id: "editor.emmet.action.expandAbbreviation",
      label: nls.localize2("expandAbbreviationAction", "Emmet: Expand Abbreviation"),
      precondition: EditorContextKeys.writable,
      actionName: "expand_abbreviation",
      kbOpts: {
        primary: KeyCode.Tab,
        kbExpr: ContextKeyExpr.and(
          EditorContextKeys.editorTextFocus,
          EditorContextKeys.tabDoesNotMoveFocus,
          ContextKeyExpr.has("config.emmet.triggerExpansionOnTab")
        ),
        weight: KeybindingWeight.EditorContrib
      },
      menuOpts: {
        menuId: MenuId.MenubarEditMenu,
        group: "5_insert",
        title: nls.localize({ key: "miEmmetExpandAbbreviation", comment: ["&& denotes a mnemonic"] }, "Emmet: E&&xpand Abbreviation"),
        order: 3
      }
    });
  }
}
registerEditorAction(ExpandAbbreviationAction);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9lbW1ldC9icm93c2VyL2FjdGlvbnMvZXhwYW5kQWJicmV2aWF0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgRW1tZXRFZGl0b3JBY3Rpb24gfSBmcm9tICcuLi9lbW1ldEFjdGlvbnMuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJFZGl0b3JBY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEVkaXRvckNvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IE1lbnVJZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuXG5jbGFzcyBFeHBhbmRBYmJyZXZpYXRpb25BY3Rpb24gZXh0ZW5kcyBFbW1ldEVkaXRvckFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdlZGl0b3IuZW1tZXQuYWN0aW9uLmV4cGFuZEFiYnJldmlhdGlvbicsXG5cdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplMignZXhwYW5kQWJicmV2aWF0aW9uQWN0aW9uJywgXCJFbW1ldDogRXhwYW5kIEFiYnJldmlhdGlvblwiKSxcblx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMud3JpdGFibGUsXG5cdFx0XHRhY3Rpb25OYW1lOiAnZXhwYW5kX2FiYnJldmlhdGlvbicsXG5cdFx0XHRrYk9wdHM6IHtcblx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5UYWIsXG5cdFx0XHRcdGtiRXhwcjogQ29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRcdEVkaXRvckNvbnRleHRLZXlzLmVkaXRvclRleHRGb2N1cyxcblx0XHRcdFx0XHRFZGl0b3JDb250ZXh0S2V5cy50YWJEb2VzTm90TW92ZUZvY3VzLFxuXHRcdFx0XHRcdENvbnRleHRLZXlFeHByLmhhcygnY29uZmlnLmVtbWV0LnRyaWdnZXJFeHBhbnNpb25PblRhYicpXG5cdFx0XHRcdCksXG5cdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliXG5cdFx0XHR9LFxuXHRcdFx0bWVudU9wdHM6IHtcblx0XHRcdFx0bWVudUlkOiBNZW51SWQuTWVudWJhckVkaXRNZW51LFxuXHRcdFx0XHRncm91cDogJzVfaW5zZXJ0Jyxcblx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pRW1tZXRFeHBhbmRBYmJyZXZpYXRpb24nLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiRW1tZXQ6IEUmJnhwYW5kIEFiYnJldmlhdGlvblwiKSxcblx0XHRcdFx0b3JkZXI6IDNcblx0XHRcdH1cblx0XHR9KTtcblxuXHR9XG59XG5cbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKEV4cGFuZEFiYnJldmlhdGlvbkFjdGlvbik7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFJQSxZQUFZLFNBQVM7QUFDckIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsY0FBYztBQUV2QixNQUFNLGlDQUFpQyxrQkFBa0I7QUFBQSxFQUV4RCxjQUFjO0FBQ2IsVUFBTTtBQUFBLE1BQ0wsSUFBSTtBQUFBLE1BQ0osT0FBTyxJQUFJLFVBQVUsNEJBQTRCLDRCQUE0QjtBQUFBLE1BQzdFLGNBQWMsa0JBQWtCO0FBQUEsTUFDaEMsWUFBWTtBQUFBLE1BQ1osUUFBUTtBQUFBLFFBQ1AsU0FBUyxRQUFRO0FBQUEsUUFDakIsUUFBUSxlQUFlO0FBQUEsVUFDdEIsa0JBQWtCO0FBQUEsVUFDbEIsa0JBQWtCO0FBQUEsVUFDbEIsZUFBZSxJQUFJLG9DQUFvQztBQUFBLFFBQ3hEO0FBQUEsUUFDQSxRQUFRLGlCQUFpQjtBQUFBLE1BQzFCO0FBQUEsTUFDQSxVQUFVO0FBQUEsUUFDVCxRQUFRLE9BQU87QUFBQSxRQUNmLE9BQU87QUFBQSxRQUNQLE9BQU8sSUFBSSxTQUFTLEVBQUUsS0FBSyw2QkFBNkIsU0FBUyxDQUFDLHVCQUF1QixFQUFFLEdBQUcsOEJBQThCO0FBQUEsUUFDNUgsT0FBTztBQUFBLE1BQ1I7QUFBQSxJQUNELENBQUM7QUFBQSxFQUVGO0FBQ0Q7QUFFQSxxQkFBcUIsd0JBQXdCOyIsCiAgIm5hbWVzIjogW10KfQo=
