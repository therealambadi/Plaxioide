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
import { AbstractGotoLineQuickAccessProvider } from "../../../contrib/quickAccess/browser/gotoLineQuickAccess.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions } from "../../../../platform/quickinput/common/quickAccess.js";
import { ICodeEditorService } from "../../../browser/services/codeEditorService.js";
import { GoToLineNLS } from "../../../common/standaloneStrings.js";
import { Event } from "../../../../base/common/event.js";
import { EditorAction, registerEditorAction } from "../../../browser/editorExtensions.js";
import { EditorContextKeys } from "../../../common/editorContextKeys.js";
import { KeyMod, KeyCode } from "../../../../base/common/keyCodes.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
let StandaloneGotoLineQuickAccessProvider = class extends AbstractGotoLineQuickAccessProvider {
  constructor(editorService) {
    super();
    this.editorService = editorService;
    this.onDidActiveTextEditorControlChange = Event.None;
  }
  get activeTextEditorControl() {
    return this.editorService.getFocusedCodeEditor() ?? void 0;
  }
};
StandaloneGotoLineQuickAccessProvider = __decorateClass([
  __decorateParam(0, ICodeEditorService)
], StandaloneGotoLineQuickAccessProvider);
const _GotoLineAction = class _GotoLineAction extends EditorAction {
  constructor() {
    super({
      id: _GotoLineAction.ID,
      label: GoToLineNLS.gotoLineActionLabel,
      alias: "Go to Line/Column...",
      precondition: void 0,
      kbOpts: {
        kbExpr: EditorContextKeys.focus,
        primary: KeyMod.CtrlCmd | KeyCode.KeyG,
        mac: { primary: KeyMod.WinCtrl | KeyCode.KeyG },
        weight: KeybindingWeight.EditorContrib
      }
    });
  }
  run(accessor) {
    accessor.get(IQuickInputService).quickAccess.show(StandaloneGotoLineQuickAccessProvider.PREFIX);
  }
};
_GotoLineAction.ID = "editor.action.gotoLine";
let GotoLineAction = _GotoLineAction;
registerEditorAction(GotoLineAction);
Registry.as(Extensions.Quickaccess).registerQuickAccessProvider({
  ctor: StandaloneGotoLineQuickAccessProvider,
  prefix: StandaloneGotoLineQuickAccessProvider.PREFIX,
  helpEntries: [{ description: GoToLineNLS.gotoLineActionLabel, commandId: GotoLineAction.ID }]
});
export {
  GotoLineAction,
  StandaloneGotoLineQuickAccessProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3Ivc3RhbmRhbG9uZS9icm93c2VyL3F1aWNrQWNjZXNzL3N0YW5kYWxvbmVHb3RvTGluZVF1aWNrQWNjZXNzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQWJzdHJhY3RHb3RvTGluZVF1aWNrQWNjZXNzUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi9jb250cmliL3F1aWNrQWNjZXNzL2Jyb3dzZXIvZ290b0xpbmVRdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJUXVpY2tBY2Nlc3NSZWdpc3RyeSwgRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrQWNjZXNzLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgR29Ub0xpbmVOTFMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vc3RhbmRhbG9uZVN0cmluZ3MuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JBY3Rpb24sIHJlZ2lzdGVyRWRpdG9yQWN0aW9uLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEVkaXRvckNvbnRleHRLZXlzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IEtleU1vZCwgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuXG5leHBvcnQgY2xhc3MgU3RhbmRhbG9uZUdvdG9MaW5lUXVpY2tBY2Nlc3NQcm92aWRlciBleHRlbmRzIEFic3RyYWN0R290b0xpbmVRdWlja0FjY2Vzc1Byb3ZpZGVyIHtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgb25EaWRBY3RpdmVUZXh0RWRpdG9yQ29udHJvbENoYW5nZSA9IEV2ZW50Lk5vbmU7XG5cblx0Y29uc3RydWN0b3IoQElDb2RlRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0IGFjdGl2ZVRleHRFZGl0b3JDb250cm9sKCkge1xuXHRcdHJldHVybiB0aGlzLmVkaXRvclNlcnZpY2UuZ2V0Rm9jdXNlZENvZGVFZGl0b3IoKSA/PyB1bmRlZmluZWQ7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEdvdG9MaW5lQWN0aW9uIGV4dGVuZHMgRWRpdG9yQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZWRpdG9yLmFjdGlvbi5nb3RvTGluZSc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEdvdG9MaW5lQWN0aW9uLklELFxuXHRcdFx0bGFiZWw6IEdvVG9MaW5lTkxTLmdvdG9MaW5lQWN0aW9uTGFiZWwsXG5cdFx0XHRhbGlhczogJ0dvIHRvIExpbmUvQ29sdW1uLi4uJyxcblx0XHRcdHByZWNvbmRpdGlvbjogdW5kZWZpbmVkLFxuXHRcdFx0a2JPcHRzOiB7XG5cdFx0XHRcdGtiRXhwcjogRWRpdG9yQ29udGV4dEtleXMuZm9jdXMsXG5cdFx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlHLFxuXHRcdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLldpbkN0cmwgfCBLZXlDb2RlLktleUcgfSxcblx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LkVkaXRvckNvbnRyaWJcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpLnF1aWNrQWNjZXNzLnNob3coU3RhbmRhbG9uZUdvdG9MaW5lUXVpY2tBY2Nlc3NQcm92aWRlci5QUkVGSVgpO1xuXHR9XG59XG5cbnJlZ2lzdGVyRWRpdG9yQWN0aW9uKEdvdG9MaW5lQWN0aW9uKTtcblxuUmVnaXN0cnkuYXM8SVF1aWNrQWNjZXNzUmVnaXN0cnk+KEV4dGVuc2lvbnMuUXVpY2thY2Nlc3MpLnJlZ2lzdGVyUXVpY2tBY2Nlc3NQcm92aWRlcih7XG5cdGN0b3I6IFN0YW5kYWxvbmVHb3RvTGluZVF1aWNrQWNjZXNzUHJvdmlkZXIsXG5cdHByZWZpeDogU3RhbmRhbG9uZUdvdG9MaW5lUXVpY2tBY2Nlc3NQcm92aWRlci5QUkVGSVgsXG5cdGhlbHBFbnRyaWVzOiBbeyBkZXNjcmlwdGlvbjogR29Ub0xpbmVOTFMuZ290b0xpbmVBY3Rpb25MYWJlbCwgY29tbWFuZElkOiBHb3RvTGluZUFjdGlvbi5JRCB9XVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsMkNBQTJDO0FBQ3BELFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQStCLGtCQUFrQjtBQUNqRCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGFBQWE7QUFDdEIsU0FBUyxjQUFjLDRCQUE4QztBQUNyRSxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLFFBQVEsZUFBZTtBQUNoQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDBCQUEwQjtBQUU1QixJQUFNLHdDQUFOLGNBQW9ELG9DQUFvQztBQUFBLEVBSTlGLFlBQWlELGVBQW1DO0FBQ25GLFVBQU07QUFEMEM7QUFGakQsU0FBbUIscUNBQXFDLE1BQU07QUFBQSxFQUk5RDtBQUFBLEVBRUEsSUFBYywwQkFBMEI7QUFDdkMsV0FBTyxLQUFLLGNBQWMscUJBQXFCLEtBQUs7QUFBQSxFQUNyRDtBQUNEO0FBWGEsd0NBQU47QUFBQSxFQUlPO0FBQUEsR0FKRDtBQWFOLE1BQU0sa0JBQU4sTUFBTSx3QkFBdUIsYUFBYTtBQUFBLEVBSWhELGNBQWM7QUFDYixVQUFNO0FBQUEsTUFDTCxJQUFJLGdCQUFlO0FBQUEsTUFDbkIsT0FBTyxZQUFZO0FBQUEsTUFDbkIsT0FBTztBQUFBLE1BQ1AsY0FBYztBQUFBLE1BQ2QsUUFBUTtBQUFBLFFBQ1AsUUFBUSxrQkFBa0I7QUFBQSxRQUMxQixTQUFTLE9BQU8sVUFBVSxRQUFRO0FBQUEsUUFDbEMsS0FBSyxFQUFFLFNBQVMsT0FBTyxVQUFVLFFBQVEsS0FBSztBQUFBLFFBQzlDLFFBQVEsaUJBQWlCO0FBQUEsTUFDMUI7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFQSxJQUFJLFVBQWtDO0FBQ3JDLGFBQVMsSUFBSSxrQkFBa0IsRUFBRSxZQUFZLEtBQUssc0NBQXNDLE1BQU07QUFBQSxFQUMvRjtBQUNEO0FBdEJhLGdCQUVJLEtBQUs7QUFGZixJQUFNLGlCQUFOO0FBd0JQLHFCQUFxQixjQUFjO0FBRW5DLFNBQVMsR0FBeUIsV0FBVyxXQUFXLEVBQUUsNEJBQTRCO0FBQUEsRUFDckYsTUFBTTtBQUFBLEVBQ04sUUFBUSxzQ0FBc0M7QUFBQSxFQUM5QyxhQUFhLENBQUMsRUFBRSxhQUFhLFlBQVkscUJBQXFCLFdBQVcsZUFBZSxHQUFHLENBQUM7QUFDN0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
