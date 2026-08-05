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
import "./share.css";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { localize, localize2 } from "../../../../nls.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../common/editor.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { Severity } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { WorkspaceFolderCountContext } from "../../../common/contextkeys.js";
import { Extensions } from "../../../common/contributions.js";
import { ShareProviderCountContext, ShareService } from "./shareService.js";
import { IShareService } from "../common/share.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { workbenchConfigurationNodeBase } from "../../../common/configuration.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
const targetMenus = [
  MenuId.EditorContextShare,
  MenuId.SCMResourceContextShare,
  MenuId.OpenEditorsContextShare,
  MenuId.EditorTitleContextShare,
  MenuId.MenubarShare,
  // MenuId.EditorLineNumberContext, // todo@joyceerhl add share
  MenuId.ExplorerContextShare
];
let ShareWorkbenchContribution = class extends Disposable {
  constructor(shareService, configurationService) {
    super();
    this.shareService = shareService;
    this.configurationService = configurationService;
    if (this.configurationService.getValue(ShareWorkbenchContribution.SHARE_ENABLED_SETTING)) {
      this.registerActions();
    }
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ShareWorkbenchContribution.SHARE_ENABLED_SETTING)) {
        const settingValue = this.configurationService.getValue(ShareWorkbenchContribution.SHARE_ENABLED_SETTING);
        if (settingValue === true && this._disposables === void 0) {
          this.registerActions();
        } else if (settingValue === false && this._disposables !== void 0) {
          this._disposables?.clear();
          this._disposables = void 0;
        }
      }
    }));
  }
  dispose() {
    super.dispose();
    this._disposables?.dispose();
  }
  registerActions() {
    var _a;
    if (!this._disposables) {
      this._disposables = new DisposableStore();
    }
    this._disposables.add(
      registerAction2((_a = class extends Action2 {
        constructor() {
          super({
            id: _a.ID,
            title: _a.LABEL,
            f1: true,
            icon: Codicon.linkExternal,
            precondition: ContextKeyExpr.and(ShareProviderCountContext.notEqualsTo(0), WorkspaceFolderCountContext.notEqualsTo(0)),
            keybinding: {
              weight: KeybindingWeight.WorkbenchContrib,
              primary: KeyMod.Alt | KeyMod.CtrlCmd | KeyCode.KeyS
            },
            menu: [
              { id: MenuId.CommandCenter, order: 1e3 }
            ]
          });
        }
        async run(accessor, ...args) {
          const shareService = accessor.get(IShareService);
          const activeEditor = accessor.get(IEditorService)?.activeEditor;
          const resourceUri = (activeEditor && EditorResourceAccessor.getOriginalUri(activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY })) ?? accessor.get(IWorkspaceContextService).getWorkspace().folders[0].uri;
          const clipboardService = accessor.get(IClipboardService);
          const dialogService = accessor.get(IDialogService);
          const urlService = accessor.get(IOpenerService);
          const progressService = accessor.get(IProgressService);
          const selection = accessor.get(ICodeEditorService).getActiveCodeEditor()?.getSelection() ?? void 0;
          const result = await progressService.withProgress({
            location: ProgressLocation.Window,
            detail: localize("generating link", "Generating link...")
          }, async () => shareService.provideShare({ resourceUri, selection }, CancellationToken.None));
          if (result) {
            const uriText = result.toString();
            const isResultText = typeof result === "string";
            await clipboardService.writeText(uriText);
            dialogService.prompt(
              {
                type: Severity.Info,
                message: isResultText ? localize("shareTextSuccess", "Copied text to clipboard!") : localize("shareSuccess", "Copied link to clipboard!"),
                custom: {
                  icon: Codicon.check,
                  markdownDetails: [{
                    markdown: new MarkdownString(`<div aria-label='${uriText}'>${uriText}</div>`, { supportHtml: true }),
                    classes: [isResultText ? "share-dialog-input-text" : "share-dialog-input-link"]
                  }]
                },
                cancelButton: localize("close", "Close"),
                buttons: isResultText ? [] : [{ label: localize("open link", "Open Link"), run: () => {
                  urlService.open(result, { openExternal: true });
                } }]
              }
            );
          }
        }
      }, _a.ID = "workbench.action.share", _a.LABEL = localize2("share", "Share..."), _a))
    );
    const actions = this.shareService.getShareActions();
    for (const menuId of targetMenus) {
      for (const action of actions) {
        this._disposables.add(MenuRegistry.appendMenuItem(menuId, action));
      }
    }
  }
};
ShareWorkbenchContribution.SHARE_ENABLED_SETTING = "workbench.experimental.share.enabled";
ShareWorkbenchContribution = __decorateClass([
  __decorateParam(0, IShareService),
  __decorateParam(1, IConfigurationService)
], ShareWorkbenchContribution);
registerSingleton(IShareService, ShareService, InstantiationType.Delayed);
const workbenchContributionsRegistry = Registry.as(Extensions.Workbench);
workbenchContributionsRegistry.registerWorkbenchContribution(ShareWorkbenchContribution, LifecyclePhase.Eventually);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  ...workbenchConfigurationNodeBase,
  properties: {
    "workbench.experimental.share.enabled": {
      type: "boolean",
      default: false,
      tags: ["experimental"],
      markdownDescription: localize("experimental.share.enabled", "Controls whether to render the Share action next to the command center when {0} is {1}.", "`#window.commandCenter#`", "`true`"),
      restricted: false
    }
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zaGFyZS9icm93c2VyL3NoYXJlLmNvbnRyaWJ1dGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9zaGFyZS5jc3MnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCBNZW51SWQsIE1lbnVSZWdpc3RyeSwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ2xpcGJvYXJkU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NsaXBib2FyZC9jb21tb24vY2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLCBTaWRlQnlTaWRlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nV2VpZ2h0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ3NSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgV29ya3NwYWNlRm9sZGVyQ291bnRDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMsIElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBTaGFyZVByb3ZpZGVyQ291bnRDb250ZXh0LCBTaGFyZVNlcnZpY2UgfSBmcm9tICcuL3NoYXJlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJU2hhcmVTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3NoYXJlLmpzJztcbmltcG9ydCB7IExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzU2VydmljZSwgUHJvZ3Jlc3NMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIENvbmZpZ3VyYXRpb25FeHRlbnNpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IHdvcmtiZW5jaENvbmZpZ3VyYXRpb25Ob2RlQmFzZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5cbmNvbnN0IHRhcmdldE1lbnVzID0gW1xuXHRNZW51SWQuRWRpdG9yQ29udGV4dFNoYXJlLFxuXHRNZW51SWQuU0NNUmVzb3VyY2VDb250ZXh0U2hhcmUsXG5cdE1lbnVJZC5PcGVuRWRpdG9yc0NvbnRleHRTaGFyZSxcblx0TWVudUlkLkVkaXRvclRpdGxlQ29udGV4dFNoYXJlLFxuXHRNZW51SWQuTWVudWJhclNoYXJlLFxuXHQvLyBNZW51SWQuRWRpdG9yTGluZU51bWJlckNvbnRleHQsIC8vIHRvZG9Aam95Y2VlcmhsIGFkZCBzaGFyZVxuXHRNZW51SWQuRXhwbG9yZXJDb250ZXh0U2hhcmVcbl07XG5cbmNsYXNzIFNoYXJlV29ya2JlbmNoQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgc3RhdGljIFNIQVJFX0VOQUJMRURfU0VUVElORyA9ICd3b3JrYmVuY2guZXhwZXJpbWVudGFsLnNoYXJlLmVuYWJsZWQnO1xuXG5cdHByaXZhdGUgX2Rpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElTaGFyZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzaGFyZVNlcnZpY2U6IElTaGFyZVNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGlmICh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KFNoYXJlV29ya2JlbmNoQ29udHJpYnV0aW9uLlNIQVJFX0VOQUJMRURfU0VUVElORykpIHtcblx0XHRcdHRoaXMucmVnaXN0ZXJBY3Rpb25zKCk7XG5cdFx0fVxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oU2hhcmVXb3JrYmVuY2hDb250cmlidXRpb24uU0hBUkVfRU5BQkxFRF9TRVRUSU5HKSkge1xuXHRcdFx0XHRjb25zdCBzZXR0aW5nVmFsdWUgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KFNoYXJlV29ya2JlbmNoQ29udHJpYnV0aW9uLlNIQVJFX0VOQUJMRURfU0VUVElORyk7XG5cdFx0XHRcdGlmIChzZXR0aW5nVmFsdWUgPT09IHRydWUgJiYgdGhpcy5fZGlzcG9zYWJsZXMgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHRoaXMucmVnaXN0ZXJBY3Rpb25zKCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoc2V0dGluZ1ZhbHVlID09PSBmYWxzZSAmJiB0aGlzLl9kaXNwb3NhYmxlcyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0dGhpcy5fZGlzcG9zYWJsZXM/LmNsZWFyKCk7XG5cdFx0XHRcdFx0dGhpcy5fZGlzcG9zYWJsZXMgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcz8uZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckFjdGlvbnMoKSB7XG5cdFx0aWYgKCF0aGlzLl9kaXNwb3NhYmxlcykge1xuXHRcdFx0dGhpcy5fZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuYWRkKFxuXHRcdFx0cmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFNoYXJlQWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRcdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guYWN0aW9uLnNoYXJlJztcblx0XHRcdFx0c3RhdGljIHJlYWRvbmx5IExBQkVMID0gbG9jYWxpemUyKCdzaGFyZScsICdTaGFyZS4uLicpO1xuXG5cdFx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRcdGlkOiBTaGFyZUFjdGlvbi5JRCxcblx0XHRcdFx0XHRcdHRpdGxlOiBTaGFyZUFjdGlvbi5MQUJFTCxcblx0XHRcdFx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0XHRcdFx0aWNvbjogQ29kaWNvbi5saW5rRXh0ZXJuYWwsXG5cdFx0XHRcdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChTaGFyZVByb3ZpZGVyQ291bnRDb250ZXh0Lm5vdEVxdWFsc1RvKDApLCBXb3Jrc3BhY2VGb2xkZXJDb3VudENvbnRleHQubm90RXF1YWxzVG8oMCkpLFxuXHRcdFx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkFsdCB8IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlTLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdG1lbnU6IFtcblx0XHRcdFx0XHRcdFx0eyBpZDogTWVudUlkLkNvbW1hbmRDZW50ZXIsIG9yZGVyOiAxMDAwIH1cblx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdG92ZXJyaWRlIGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0XHRjb25zdCBzaGFyZVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVNoYXJlU2VydmljZSk7XG5cdFx0XHRcdFx0Y29uc3QgYWN0aXZlRWRpdG9yID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKT8uYWN0aXZlRWRpdG9yO1xuXHRcdFx0XHRcdGNvbnN0IHJlc291cmNlVXJpID0gKGFjdGl2ZUVkaXRvciAmJiBFZGl0b3JSZXNvdXJjZUFjY2Vzc29yLmdldE9yaWdpbmFsVXJpKGFjdGl2ZUVkaXRvciwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5QUklNQVJZIH0pKVxuXHRcdFx0XHRcdFx0Pz8gYWNjZXNzb3IuZ2V0KElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSkuZ2V0V29ya3NwYWNlKCkuZm9sZGVyc1swXS51cmk7XG5cdFx0XHRcdFx0Y29uc3QgY2xpcGJvYXJkU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ2xpcGJvYXJkU2VydmljZSk7XG5cdFx0XHRcdFx0Y29uc3QgZGlhbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJRGlhbG9nU2VydmljZSk7XG5cdFx0XHRcdFx0Y29uc3QgdXJsU2VydmljZSA9IGFjY2Vzc29yLmdldChJT3BlbmVyU2VydmljZSk7XG5cdFx0XHRcdFx0Y29uc3QgcHJvZ3Jlc3NTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElQcm9ncmVzc1NlcnZpY2UpO1xuXHRcdFx0XHRcdGNvbnN0IHNlbGVjdGlvbiA9IGFjY2Vzc29yLmdldChJQ29kZUVkaXRvclNlcnZpY2UpLmdldEFjdGl2ZUNvZGVFZGl0b3IoKT8uZ2V0U2VsZWN0aW9uKCkgPz8gdW5kZWZpbmVkO1xuXG5cdFx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgcHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyh7XG5cdFx0XHRcdFx0XHRsb2NhdGlvbjogUHJvZ3Jlc3NMb2NhdGlvbi5XaW5kb3csXG5cdFx0XHRcdFx0XHRkZXRhaWw6IGxvY2FsaXplKCdnZW5lcmF0aW5nIGxpbmsnLCAnR2VuZXJhdGluZyBsaW5rLi4uJylcblx0XHRcdFx0XHR9LCBhc3luYyAoKSA9PiBzaGFyZVNlcnZpY2UucHJvdmlkZVNoYXJlKHsgcmVzb3VyY2VVcmksIHNlbGVjdGlvbiB9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSk7XG5cblx0XHRcdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdFx0XHRjb25zdCB1cmlUZXh0ID0gcmVzdWx0LnRvU3RyaW5nKCk7XG5cdFx0XHRcdFx0XHRjb25zdCBpc1Jlc3VsdFRleHQgPSB0eXBlb2YgcmVzdWx0ID09PSAnc3RyaW5nJztcblx0XHRcdFx0XHRcdGF3YWl0IGNsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KHVyaVRleHQpO1xuXG5cdFx0XHRcdFx0XHRkaWFsb2dTZXJ2aWNlLnByb21wdChcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6IFNldmVyaXR5LkluZm8sXG5cdFx0XHRcdFx0XHRcdFx0bWVzc2FnZTogaXNSZXN1bHRUZXh0ID8gbG9jYWxpemUoJ3NoYXJlVGV4dFN1Y2Nlc3MnLCAnQ29waWVkIHRleHQgdG8gY2xpcGJvYXJkIScpIDogbG9jYWxpemUoJ3NoYXJlU3VjY2VzcycsICdDb3BpZWQgbGluayB0byBjbGlwYm9hcmQhJyksXG5cdFx0XHRcdFx0XHRcdFx0Y3VzdG9tOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRpY29uOiBDb2RpY29uLmNoZWNrLFxuXHRcdFx0XHRcdFx0XHRcdFx0bWFya2Rvd25EZXRhaWxzOiBbe1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRtYXJrZG93bjogbmV3IE1hcmtkb3duU3RyaW5nKGA8ZGl2IGFyaWEtbGFiZWw9JyR7dXJpVGV4dH0nPiR7dXJpVGV4dH08L2Rpdj5gLCB7IHN1cHBvcnRIdG1sOiB0cnVlIH0pLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRjbGFzc2VzOiBbaXNSZXN1bHRUZXh0ID8gJ3NoYXJlLWRpYWxvZy1pbnB1dC10ZXh0JyA6ICdzaGFyZS1kaWFsb2ctaW5wdXQtbGluayddXG5cdFx0XHRcdFx0XHRcdFx0XHR9XVxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0Y2FuY2VsQnV0dG9uOiBsb2NhbGl6ZSgnY2xvc2UnLCAnQ2xvc2UnKSxcblx0XHRcdFx0XHRcdFx0XHRidXR0b25zOiBpc1Jlc3VsdFRleHQgPyBbXSA6IFt7IGxhYmVsOiBsb2NhbGl6ZSgnb3BlbiBsaW5rJywgJ09wZW4gTGluaycpLCBydW46ICgpID0+IHsgdXJsU2VydmljZS5vcGVuKHJlc3VsdCwgeyBvcGVuRXh0ZXJuYWw6IHRydWUgfSk7IH0gfV1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0KTtcblxuXHRcdGNvbnN0IGFjdGlvbnMgPSB0aGlzLnNoYXJlU2VydmljZS5nZXRTaGFyZUFjdGlvbnMoKTtcblx0XHRmb3IgKGNvbnN0IG1lbnVJZCBvZiB0YXJnZXRNZW51cykge1xuXHRcdFx0Zm9yIChjb25zdCBhY3Rpb24gb2YgYWN0aW9ucykge1xuXHRcdFx0XHQvLyB0b2RvQGpveWNlZXJobCBhdm9pZCBkdXBsaWNhdGVzXG5cdFx0XHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmFkZChNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0obWVudUlkLCBhY3Rpb24pKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxucmVnaXN0ZXJTaW5nbGV0b24oSVNoYXJlU2VydmljZSwgU2hhcmVTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbmNvbnN0IHdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnk+KEV4dGVuc2lvbnMuV29ya2JlbmNoKTtcbndvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihTaGFyZVdvcmtiZW5jaENvbnRyaWJ1dGlvbiwgTGlmZWN5Y2xlUGhhc2UuRXZlbnR1YWxseSk7XG5cblJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pLnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdC4uLndvcmtiZW5jaENvbmZpZ3VyYXRpb25Ob2RlQmFzZSxcblx0cHJvcGVydGllczoge1xuXHRcdCd3b3JrYmVuY2guZXhwZXJpbWVudGFsLnNoYXJlLmVuYWJsZWQnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBmYWxzZSxcblx0XHRcdHRhZ3M6IFsnZXhwZXJpbWVudGFsJ10sXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZXhwZXJpbWVudGFsLnNoYXJlLmVuYWJsZWQnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdG8gcmVuZGVyIHRoZSBTaGFyZSBhY3Rpb24gbmV4dCB0byB0aGUgY29tbWFuZCBjZW50ZXIgd2hlbiB7MH0gaXMgezF9LlwiLCAnYCN3aW5kb3cuY29tbWFuZENlbnRlciNgJywgJ2B0cnVlYCcpLFxuXHRcdFx0cmVzdHJpY3RlZDogZmFsc2UsXG5cdFx0fVxuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTztBQUNQLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZUFBZTtBQUN4QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFNBQVMsY0FBYztBQUNoQyxTQUFTLFVB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
