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
import { localize, localize2 } from "../../../../nls.js";
import { GettingStartedInputSerializer, GettingStartedPage, inWelcomeContext } from "./gettingStarted.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { EditorExtensions } from "../../../common/editor.js";
import { MenuId, registerAction2, Action2 } from "../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IEditorService, SIDE_GROUP } from "../../../services/editor/common/editorService.js";
import { KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { IWalkthroughsService } from "./gettingStartedService.js";
import { GettingStartedInput } from "./gettingStartedInput.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { ConfigurationScope, Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { workbenchConfigurationNodeBase } from "../../../common/configuration.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { isLinux, isMacintosh, isWindows, OperatingSystem as OS } from "../../../../base/common/platform.js";
import { IExtensionManagementServerService } from "../../../services/extensionManagement/common/extensionManagement.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { StartupPageEditorResolverContribution, StartupPageRunnerContribution } from "./startupPage.js";
import { ExtensionsInput } from "../../extensions/common/extensionsInput.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { AccessibleViewRegistry } from "../../../../platform/accessibility/browser/accessibleViewRegistry.js";
import { GettingStartedAccessibleView } from "./gettingStartedAccessibleView.js";
import * as icons from "./gettingStartedIcons.js";
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "workbench.action.openWalkthrough",
      title: localize2("miWelcome", "Welcome"),
      category: Categories.Help,
      f1: true,
      menu: {
        id: MenuId.MenubarHelpMenu,
        group: "1_welcome",
        order: 1
      },
      metadata: {
        description: localize2("minWelcomeDescription", "Opens a Walkthrough to help you get started in VS Code.")
      }
    });
  }
  run(accessor, walkthroughID, optionsOrToSide) {
    const editorGroupsService = accessor.get(IEditorGroupsService);
    const instantiationService = accessor.get(IInstantiationService);
    const editorService = accessor.get(IEditorService);
    const commandService = accessor.get(ICommandService);
    const toSide = typeof optionsOrToSide === "object" ? optionsOrToSide.toSide : optionsOrToSide;
    const inactive = typeof optionsOrToSide === "object" ? optionsOrToSide.inactive : false;
    if (walkthroughID) {
      const selectedCategory = typeof walkthroughID === "string" ? walkthroughID : walkthroughID.category;
      let selectedStep;
      if (typeof walkthroughID === "object" && "category" in walkthroughID && "step" in walkthroughID) {
        selectedStep = `${walkthroughID.category}#${walkthroughID.step}`;
      } else {
        selectedStep = void 0;
      }
      if (!selectedCategory && !selectedStep) {
        editorService.openEditor({
          resource: GettingStartedInput.RESOURCE,
          options: { preserveFocus: toSide ?? false, inactive }
        }, toSide ? SIDE_GROUP : void 0);
        return;
      }
      for (const group of editorGroupsService.groups) {
        if (group.activeEditor instanceof GettingStartedInput) {
          const activeEditor2 = group.activeEditor;
          activeEditor2.showWelcome = false;
          group.activeEditorPane.makeCategoryVisibleWhenAvailable(selectedCategory, selectedStep);
          return;
        }
      }
      const result = editorService.findEditors({ typeId: GettingStartedInput.ID, editorId: void 0, resource: GettingStartedInput.RESOURCE });
      for (const { editor, groupId } of result) {
        if (editor instanceof GettingStartedInput) {
          const group = editorGroupsService.getGroup(groupId);
          if (!editor.selectedCategory && group) {
            editor.selectedCategory = selectedCategory;
            editor.selectedStep = selectedStep;
            editor.showWelcome = false;
            group.openEditor(editor, { revealIfOpened: true, inactive });
            return;
          }
        }
      }
      const activeEditor = editorService.activeEditor;
      if (selectedStep && activeEditor instanceof GettingStartedInput && activeEditor.selectedCategory === selectedCategory) {
        activeEditor.showWelcome = false;
        commandService.executeCommand("walkthroughs.selectStep", selectedStep);
        return;
      }
      if (activeEditor instanceof ExtensionsInput) {
        const activeGroup = editorGroupsService.activeGroup;
        activeGroup.replaceEditors([{
          editor: activeEditor,
          replacement: instantiationService.createInstance(GettingStartedInput, { selectedCategory, selectedStep, showWelcome: false })
        }]);
      } else {
        const options = { selectedCategory, selectedStep, showWelcome: false, preserveFocus: toSide ?? false, inactive };
        editorService.openEditor({
          resource: GettingStartedInput.RESOURCE,
          options
        }, toSide ? SIDE_GROUP : void 0).then((editor) => {
          editor?.makeCategoryVisibleWhenAvailable(selectedCategory, selectedStep);
        });
      }
    } else {
      editorService.openEditor({
        resource: GettingStartedInput.RESOURCE,
        options: { preserveFocus: toSide ?? false, inactive }
      }, toSide ? SIDE_GROUP : void 0);
    }
  }
});
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(GettingStartedInput.ID, GettingStartedInputSerializer);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    GettingStartedPage,
    GettingStartedPage.ID,
    localize("welcome", "Welcome")
  ),
  [
    new SyncDescriptor(GettingStartedInput)
  ]
);
const category = localize2("welcome", "Welcome");
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "welcome.goBack",
      title: localize2("welcome.goBack", "Go Back"),
      category,
      keybinding: {
        weight: KeybindingWeight.EditorContrib,
        primary: KeyCode.Escape,
        when: inWelcomeContext
      },
      precondition: ContextKeyExpr.equals("activeEditor", "gettingStartedPage"),
      f1: true
    });
  }
  run(accessor) {
    const editorService = accessor.get(IEditorService);
    const editorPane = editorService.activeEditorPane;
    if (editorPane instanceof GettingStartedPage) {
      editorPane.escape();
    }
  }
});
CommandsRegistry.registerCommand({
  id: "walkthroughs.selectStep",
  handler: (accessor, stepID) => {
    const editorService = accessor.get(IEditorService);
    const editorPane = editorService.activeEditorPane;
    if (editorPane instanceof GettingStartedPage) {
      editorPane.selectStepLoose(stepID);
    } else {
      console.error("Cannot run walkthroughs.selectStep outside of walkthrough context");
    }
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "welcome.markStepComplete",
      title: localize("welcome.markStepComplete", "Mark Step Complete"),
      category
    });
  }
  run(accessor, arg) {
    if (!arg) {
      return;
    }
    const gettingStartedService = accessor.get(IWalkthroughsService);
    gettingStartedService.progressStep(arg);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "welcome.markStepIncomplete",
      title: localize("welcome.markStepInomplete", "Mark Step Incomplete"),
      category
    });
  }
  run(accessor, arg) {
    if (!arg) {
      return;
    }
    const gettingStartedService = accessor.get(IWalkthroughsService);
    gettingStartedService.deprogressStep(arg);
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "welcome.showAllWalkthroughs",
      title: localize2("welcome.showAllWalkthroughs", "Open Walkthrough..."),
      category,
      f1: true
    });
  }
  async getQuickPickItems(contextService, gettingStartedService) {
    const categories = await gettingStartedService.getWalkthroughs();
    return categories.filter((c) => contextService.contextMatchesRules(c.when)).map((x) => ({
      id: x.id,
      label: x.title,
      detail: x.description,
      description: x.source
    }));
  }
  async run(accessor) {
    const commandService = accessor.get(ICommandService);
    const contextService = accessor.get(IContextKeyService);
    const quickInputService = accessor.get(IQuickInputService);
    const gettingStartedService = accessor.get(IWalkthroughsService);
    const extensionService = accessor.get(IExtensionService);
    const disposables = new DisposableStore();
    const quickPick = disposables.add(quickInputService.createQuickPick());
    quickPick.canSelectMany = false;
    quickPick.matchOnDescription = true;
    quickPick.matchOnDetail = true;
    quickPick.placeholder = localize("pickWalkthroughs", "Select a walkthrough to open");
    quickPick.items = await this.getQuickPickItems(contextService, gettingStartedService);
    quickPick.busy = true;
    disposables.add(quickPick.onDidAccept(() => {
      const selection = quickPick.selectedItems[0];
      if (selection) {
        commandService.executeCommand("workbench.action.openWalkthrough", selection.id);
      }
      quickPick.hide();
    }));
    disposables.add(quickPick.onDidHide(() => disposables.dispose()));
    await extensionService.whenInstalledExtensionsRegistered();
    gettingStartedService.onDidAddWalkthrough(async () => {
      quickPick.items = await this.getQuickPickItems(contextService, gettingStartedService);
    });
    quickPick.show();
    quickPick.busy = false;
  }
});
const WorkspacePlatform = new RawContextKey("workspacePlatform", void 0, localize("workspacePlatform", "The platform of the current workspace, which in remote or serverless contexts may be different from the platform of the UI"));
let WorkspacePlatformContribution = class {
  constructor(extensionManagementServerService, remoteAgentService, contextService) {
    this.extensionManagementServerService = extensionManagementServerService;
    this.remoteAgentService = remoteAgentService;
    this.contextService = contextService;
    this.remoteAgentService.getEnvironment().then((env) => {
      const remoteOS = env?.os;
      const remotePlatform = remoteOS === OS.Macintosh ? "mac" : remoteOS === OS.Windows ? "windows" : remoteOS === OS.Linux ? "linux" : void 0;
      if (remotePlatform) {
        WorkspacePlatform.bindTo(this.contextService).set(remotePlatform);
      } else if (this.extensionManagementServerService.localExtensionManagementServer) {
        if (isMacintosh) {
          WorkspacePlatform.bindTo(this.contextService).set("mac");
        } else if (isLinux) {
          WorkspacePlatform.bindTo(this.contextService).set("linux");
        } else if (isWindows) {
          WorkspacePlatform.bindTo(this.contextService).set("windows");
        }
      } else if (this.extensionManagementServerService.webExtensionManagementServer) {
        WorkspacePlatform.bindTo(this.contextService).set("webworker");
      } else {
        console.error("Error: Unable to detect workspace platform");
      }
    });
  }
};
WorkspacePlatformContribution.ID = "workbench.contrib.workspacePlatform";
WorkspacePlatformContribution = __decorateClass([
  __decorateParam(0, IExtensionManagementServerService),
  __decorateParam(1, IRemoteAgentService),
  __decorateParam(2, IContextKeyService)
], WorkspacePlatformContribution);
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
  ...workbenchConfigurationNodeBase,
  properties: {
    "workbench.welcomePage.walkthroughs.openOnInstall": {
      scope: ConfigurationScope.MACHINE,
      type: "boolean",
      default: true,
      description: localize("workbench.welcomePage.walkthroughs.openOnInstall", "When enabled, an extension's walkthrough will open upon install of the extension.")
    },
    "workbench.startupEditor": {
      "scope": ConfigurationScope.RESOURCE,
      "type": "string",
      "enum": ["none", "welcomePage", "readme", "newUntitledFile", "welcomePageInEmptyWorkbench", "terminal"],
      "enumDescriptions": [
        localize({ comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "workbench.startupEditor.none" }, "Start without an editor."),
        localize({ comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "workbench.startupEditor.welcomePage" }, "Open the Welcome page, with content to aid in getting started with VS Code and extensions."),
        localize({ comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "workbench.startupEditor.readme" }, "Open the README when opening a folder that contains one, fallback to 'welcomePage' otherwise. Note: This is only observed as a global configuration, it will be ignored if set in a workspace or folder configuration."),
        localize({ comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "workbench.startupEditor.newUntitledFile" }, "Open a new untitled text file (only applies when opening an empty window)."),
        localize({ comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "workbench.startupEditor.welcomePageInEmptyWorkbench" }, "Open the Welcome page when opening an empty workbench."),
        localize({ comment: ["This is the description for a setting. Values surrounded by single quotes are not to be translated."], key: "workbench.startupEditor.terminal" }, "Open a new terminal in the editor area.")
      ],
      "default": "welcomePage",
      "description": localize("workbench.startupEditor", "Controls which editor is shown at startup, if none are restored from the previous session.")
    },
    "workbench.welcomePage.preferReducedMotion": {
      scope: ConfigurationScope.APPLICATION,
      type: "boolean",
      default: false,
      deprecationMessage: localize("deprecationMessage", "Deprecated, use the global `workbench.reduceMotion`."),
      description: localize("workbench.welcomePage.preferReducedMotion", "When enabled, reduce motion in welcome page.")
    }
  }
});
registerWorkbenchContribution2(WorkspacePlatformContribution.ID, WorkspacePlatformContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(StartupPageEditorResolverContribution.ID, StartupPageEditorResolverContribution, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(StartupPageRunnerContribution.ID, StartupPageRunnerContribution, WorkbenchPhase.AfterRestored);
AccessibleViewRegistry.register(new GettingStartedAccessibleView());
export {
  WorkspacePlatform,
  icons
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi93ZWxjb21lR2V0dGluZ1N0YXJ0ZWQvYnJvd3Nlci9nZXR0aW5nU3RhcnRlZC5jb250cmlidXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEdldHRpbmdTdGFydGVkSW5wdXRTZXJpYWxpemVyLCBHZXR0aW5nU3RhcnRlZFBhZ2UsIGluV2VsY29tZUNvbnRleHQgfSBmcm9tICcuL2dldHRpbmdTdGFydGVkLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IEVkaXRvckV4dGVuc2lvbnMsIElFZGl0b3JGYWN0b3J5UmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IE1lbnVJZCwgcmVnaXN0ZXJBY3Rpb24yLCBBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IENvbnRleHRLZXlFeHByLCBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlLCBTSURFX0dST1VQIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JQYW5lRGVzY3JpcHRvciwgSUVkaXRvclBhbmVSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgSVdhbGt0aHJvdWdoc1NlcnZpY2UgfSBmcm9tICcuL2dldHRpbmdTdGFydGVkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBHZXR0aW5nU3RhcnRlZEVkaXRvck9wdGlvbnMsIEdldHRpbmdTdGFydGVkSW5wdXQgfSBmcm9tICcuL2dldHRpbmdTdGFydGVkSW5wdXQuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yLCBXb3JrYmVuY2hQaGFzZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25TY29wZSwgRXh0ZW5zaW9ucyBhcyBDb25maWd1cmF0aW9uRXh0ZW5zaW9ucywgSUNvbmZpZ3VyYXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyB3b3JrYmVuY2hDb25maWd1cmF0aW9uTm9kZUJhc2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5LCBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrSXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3JlbW90ZS9jb21tb24vcmVtb3RlQWdlbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGlzTGludXgsIGlzTWFjaW50b3NoLCBpc1dpbmRvd3MsIE9wZXJhdGluZ1N5c3RlbSBhcyBPUyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFN0YXJ0dXBQYWdlRWRpdG9yUmVzb2x2ZXJDb250cmlidXRpb24sIFN0YXJ0dXBQYWdlUnVubmVyQ29udHJpYnV0aW9uIH0gZnJvbSAnLi9zdGFydHVwUGFnZS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zSW5wdXQgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zSW5wdXQuanMnO1xuaW1wb3J0IHsgQ2F0ZWdvcmllcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uQ29tbW9uQ2F0ZWdvcmllcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJsZVZpZXdSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvYnJvd3Nlci9hY2Nlc3NpYmxlVmlld1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEdldHRpbmdTdGFydGVkQWNjZXNzaWJsZVZpZXcgfSBmcm9tICcuL2dldHRpbmdTdGFydGVkQWNjZXNzaWJsZVZpZXcuanMnO1xuXG5leHBvcnQgKiBhcyBpY29ucyBmcm9tICcuL2dldHRpbmdTdGFydGVkSWNvbnMuanMnO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm9wZW5XYWxrdGhyb3VnaCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdtaVdlbGNvbWUnLCAnV2VsY29tZScpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuSGVscCxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLk1lbnViYXJIZWxwTWVudSxcblx0XHRcdFx0Z3JvdXA6ICcxX3dlbGNvbWUnLFxuXHRcdFx0XHRvcmRlcjogMSxcblx0XHRcdH0sXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUyKCdtaW5XZWxjb21lRGVzY3JpcHRpb24nLCAnT3BlbnMgYSBXYWxrdGhyb3VnaCB0byBoZWxwIHlvdSBnZXQgc3RhcnRlZCBpbiBWUyBDb2RlLicpXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwdWJsaWMgcnVuKFxuXHRcdGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLFxuXHRcdHdhbGt0aHJvdWdoSUQ6IHN0cmluZyB8IHsgY2F0ZWdvcnk6IHN0cmluZzsgc3RlcDogc3RyaW5nIH0gfCB1bmRlZmluZWQsXG5cdFx0b3B0aW9uc09yVG9TaWRlOiB7IHRvU2lkZT86IGJvb2xlYW47IGluYWN0aXZlPzogYm9vbGVhbiB9IHwgYm9vbGVhbiB8IHVuZGVmaW5lZFxuXHQpIHtcblx0XHRjb25zdCBlZGl0b3JHcm91cHNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cblx0XHRjb25zdCB0b1NpZGUgPSB0eXBlb2Ygb3B0aW9uc09yVG9TaWRlID09PSAnb2JqZWN0JyA/IG9wdGlvbnNPclRvU2lkZS50b1NpZGUgOiBvcHRpb25zT3JUb1NpZGU7XG5cdFx0Y29uc3QgaW5hY3RpdmUgPSB0eXBlb2Ygb3B0aW9uc09yVG9TaWRlID09PSAnb2JqZWN0JyA/IG9wdGlvbnNPclRvU2lkZS5pbmFjdGl2ZSA6IGZhbHNlO1xuXG5cdFx0aWYgKHdhbGt0aHJvdWdoSUQpIHtcblx0XHRcdGNvbnN0IHNlbGVjdGVkQ2F0ZWdvcnkgPSB0eXBlb2Ygd2Fsa3Rocm91Z2hJRCA9PT0gJ3N0cmluZycgPyB3YWxrdGhyb3VnaElEIDogd2Fsa3Rocm91Z2hJRC5jYXRlZ29yeTtcblx0XHRcdGxldCBzZWxlY3RlZFN0ZXA6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRcdGlmICh0eXBlb2Ygd2Fsa3Rocm91Z2hJRCA9PT0gJ29iamVjdCcgJiYgJ2NhdGVnb3J5JyBpbiB3YWxrdGhyb3VnaElEICYmICdzdGVwJyBpbiB3YWxrdGhyb3VnaElEKSB7XG5cdFx0XHRcdHNlbGVjdGVkU3RlcCA9IGAke3dhbGt0aHJvdWdoSUQuY2F0ZWdvcnl9IyR7d2Fsa3Rocm91Z2hJRC5zdGVwfWA7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzZWxlY3RlZFN0ZXAgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFdlJ3JlIHRyeWluZyB0byBvcGVuIHRoZSB3ZWxjb21lIHBhZ2UgZnJvbSB0aGUgSGVscCBtZW51XG5cdFx0XHRpZiAoIXNlbGVjdGVkQ2F0ZWdvcnkgJiYgIXNlbGVjdGVkU3RlcCkge1xuXHRcdFx0XHRlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0XHRcdHJlc291cmNlOiBHZXR0aW5nU3RhcnRlZElucHV0LlJFU09VUkNFLFxuXHRcdFx0XHRcdG9wdGlvbnM6IHsgcHJlc2VydmVGb2N1czogdG9TaWRlID8/IGZhbHNlLCBpbmFjdGl2ZSB9XG5cdFx0XHRcdH0sIHRvU2lkZSA/IFNJREVfR1JPVVAgOiB1bmRlZmluZWQpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdC8vIFRyeSBmaXJzdCB0byBzZWxlY3QgdGhlIHdhbGt0aHJvdWdoIG9uIGFuIGFjdGl2ZSB3ZWxjb21lIHBhZ2Ugd2l0aCBubyBzZWxlY3RlZCB3YWxrdGhyb3VnaFxuXHRcdFx0Zm9yIChjb25zdCBncm91cCBvZiBlZGl0b3JHcm91cHNTZXJ2aWNlLmdyb3Vwcykge1xuXHRcdFx0XHRpZiAoZ3JvdXAuYWN0aXZlRWRpdG9yIGluc3RhbmNlb2YgR2V0dGluZ1N0YXJ0ZWRJbnB1dCkge1xuXHRcdFx0XHRcdGNvbnN0IGFjdGl2ZUVkaXRvciA9IGdyb3VwLmFjdGl2ZUVkaXRvciBhcyBHZXR0aW5nU3RhcnRlZElucHV0O1xuXHRcdFx0XHRcdGFjdGl2ZUVkaXRvci5zaG93V2VsY29tZSA9IGZhbHNlO1xuXHRcdFx0XHRcdChncm91cC5hY3RpdmVFZGl0b3JQYW5lIGFzIEdldHRpbmdTdGFydGVkUGFnZSkubWFrZUNhdGVnb3J5VmlzaWJsZVdoZW5BdmFpbGFibGUoc2VsZWN0ZWRDYXRlZ29yeSwgc2VsZWN0ZWRTdGVwKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gT3RoZXJ3aXNlLCB0cnkgdG8gZmluZCBhIHdlbGNvbWUgaW5wdXQgc29tZXdoZXJlIHdpdGggbm8gc2VsZWN0ZWQgd2Fsa3Rocm91Z2gsIGFuZCBvcGVuIGl0IHRvIHRoaXMgb25lLlxuXHRcdFx0Y29uc3QgcmVzdWx0ID0gZWRpdG9yU2VydmljZS5maW5kRWRpdG9ycyh7IHR5cGVJZDogR2V0dGluZ1N0YXJ0ZWRJbnB1dC5JRCwgZWRpdG9ySWQ6IHVuZGVmaW5lZCwgcmVzb3VyY2U6IEdldHRpbmdTdGFydGVkSW5wdXQuUkVTT1VSQ0UgfSk7XG5cdFx0XHRmb3IgKGNvbnN0IHsgZWRpdG9yLCBncm91cElkIH0gb2YgcmVzdWx0KSB7XG5cdFx0XHRcdGlmIChlZGl0b3IgaW5zdGFuY2VvZiBHZXR0aW5nU3RhcnRlZElucHV0KSB7XG5cdFx0XHRcdFx0Y29uc3QgZ3JvdXAgPSBlZGl0b3JHcm91cHNTZXJ2aWNlLmdldEdyb3VwKGdyb3VwSWQpO1xuXHRcdFx0XHRcdGlmICghZWRpdG9yLnNlbGVjdGVkQ2F0ZWdvcnkgJiYgZ3JvdXApIHtcblx0XHRcdFx0XHRcdGVkaXRvci5zZWxlY3RlZENhdGVnb3J5ID0gc2VsZWN0ZWRDYXRlZ29yeTtcblx0XHRcdFx0XHRcdGVkaXRvci5zZWxlY3RlZFN0ZXAgPSBzZWxlY3RlZFN0ZXA7XG5cdFx0XHRcdFx0XHRlZGl0b3Iuc2hvd1dlbGNvbWUgPSBmYWxzZTtcblx0XHRcdFx0XHRcdGdyb3VwLm9wZW5FZGl0b3IoZWRpdG9yLCB7IHJldmVhbElmT3BlbmVkOiB0cnVlLCBpbmFjdGl2ZSB9KTtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgYWN0aXZlRWRpdG9yID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3I7XG5cdFx0XHQvLyBJZiB0aGUgd2Fsa3Rocm91Z2ggaXMgYWxyZWFkeSBvcGVuIGp1c3QgcmV2ZWFsIHRoZSBzdGVwXG5cdFx0XHRpZiAoc2VsZWN0ZWRTdGVwICYmIGFjdGl2ZUVkaXRvciBpbnN0YW5jZW9mIEdldHRpbmdTdGFydGVkSW5wdXQgJiYgYWN0aXZlRWRpdG9yLnNlbGVjdGVkQ2F0ZWdvcnkgPT09IHNlbGVjdGVkQ2F0ZWdvcnkpIHtcblx0XHRcdFx0YWN0aXZlRWRpdG9yLnNob3dXZWxjb21lID0gZmFsc2U7XG5cdFx0XHRcdGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCd3YWxrdGhyb3VnaHMuc2VsZWN0U3RlcCcsIHNlbGVjdGVkU3RlcCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gSWYgaXQncyB0aGUgZXh0ZW5zaW9uIGluc3RhbGwgcGFnZSB0aGVuIGxldHMgcmVwbGFjZSBpdCB3aXRoIHRoZSBnZXR0aW5nIHN0YXJ0ZWQgcGFnZVxuXHRcdFx0aWYgKGFjdGl2ZUVkaXRvciBpbnN0YW5jZW9mIEV4dGVuc2lvbnNJbnB1dCkge1xuXHRcdFx0XHRjb25zdCBhY3RpdmVHcm91cCA9IGVkaXRvckdyb3Vwc1NlcnZpY2UuYWN0aXZlR3JvdXA7XG5cdFx0XHRcdGFjdGl2ZUdyb3VwLnJlcGxhY2VFZGl0b3JzKFt7XG5cdFx0XHRcdFx0ZWRpdG9yOiBhY3RpdmVFZGl0b3IsXG5cdFx0XHRcdFx0cmVwbGFjZW1lbnQ6IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEdldHRpbmdTdGFydGVkSW5wdXQsIHsgc2VsZWN0ZWRDYXRlZ29yeTogc2VsZWN0ZWRDYXRlZ29yeSwgc2VsZWN0ZWRTdGVwOiBzZWxlY3RlZFN0ZXAsIHNob3dXZWxjb21lOiBmYWxzZSB9KVxuXHRcdFx0XHR9XSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBlbHNlIG9wZW4gcmVzcGVjdGluZyB0b1NpZGVcblx0XHRcdFx0Y29uc3Qgb3B0aW9uczogR2V0dGluZ1N0YXJ0ZWRFZGl0b3JPcHRpb25zID0geyBzZWxlY3RlZENhdGVnb3J5OiBzZWxlY3RlZENhdGVnb3J5LCBzZWxlY3RlZFN0ZXA6IHNlbGVjdGVkU3RlcCwgc2hvd1dlbGNvbWU6IGZhbHNlLCBwcmVzZXJ2ZUZvY3VzOiB0b1NpZGUgPz8gZmFsc2UsIGluYWN0aXZlIH07XG5cdFx0XHRcdGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRcdFx0cmVzb3VyY2U6IEdldHRpbmdTdGFydGVkSW5wdXQuUkVTT1VSQ0UsXG5cdFx0XHRcdFx0b3B0aW9uc1xuXHRcdFx0XHR9LCB0b1NpZGUgPyBTSURFX0dST1VQIDogdW5kZWZpbmVkKS50aGVuKChlZGl0b3IpID0+IHtcblx0XHRcdFx0XHQoZWRpdG9yIGFzIEdldHRpbmdTdGFydGVkUGFnZSk/Lm1ha2VDYXRlZ29yeVZpc2libGVXaGVuQXZhaWxhYmxlKHNlbGVjdGVkQ2F0ZWdvcnksIHNlbGVjdGVkU3RlcCk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRcdHJlc291cmNlOiBHZXR0aW5nU3RhcnRlZElucHV0LlJFU09VUkNFLFxuXHRcdFx0XHRvcHRpb25zOiB7IHByZXNlcnZlRm9jdXM6IHRvU2lkZSA/PyBmYWxzZSwgaW5hY3RpdmUgfVxuXHRcdFx0fSwgdG9TaWRlID8gU0lERV9HUk9VUCA6IHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG59KTtcblxuUmVnaXN0cnkuYXM8SUVkaXRvckZhY3RvcnlSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JGYWN0b3J5KS5yZWdpc3RlckVkaXRvclNlcmlhbGl6ZXIoR2V0dGluZ1N0YXJ0ZWRJbnB1dC5JRCwgR2V0dGluZ1N0YXJ0ZWRJbnB1dFNlcmlhbGl6ZXIpO1xuUmVnaXN0cnkuYXM8SUVkaXRvclBhbmVSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JQYW5lKS5yZWdpc3RlckVkaXRvclBhbmUoXG5cdEVkaXRvclBhbmVEZXNjcmlwdG9yLmNyZWF0ZShcblx0XHRHZXR0aW5nU3RhcnRlZFBhZ2UsXG5cdFx0R2V0dGluZ1N0YXJ0ZWRQYWdlLklELFxuXHRcdGxvY2FsaXplKCd3ZWxjb21lJywgXCJXZWxjb21lXCIpXG5cdCksXG5cdFtcblx0XHRuZXcgU3luY0Rlc2NyaXB0b3IoR2V0dGluZ1N0YXJ0ZWRJbnB1dClcblx0XVxuKTtcblxuY29uc3QgY2F0ZWdvcnkgPSBsb2NhbGl6ZTIoJ3dlbGNvbWUnLCBcIldlbGNvbWVcIik7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dlbGNvbWUuZ29CYWNrJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dlbGNvbWUuZ29CYWNrJywgJ0dvIEJhY2snKSxcblx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYixcblx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5Fc2NhcGUsXG5cdFx0XHRcdHdoZW46IGluV2VsY29tZUNvbnRleHRcblx0XHRcdH0sXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmVxdWFscygnYWN0aXZlRWRpdG9yJywgJ2dldHRpbmdTdGFydGVkUGFnZScpLFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvclBhbmUgPSBlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0aWYgKGVkaXRvclBhbmUgaW5zdGFuY2VvZiBHZXR0aW5nU3RhcnRlZFBhZ2UpIHtcblx0XHRcdGVkaXRvclBhbmUuZXNjYXBlKCk7XG5cdFx0fVxuXHR9XG59KTtcblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoe1xuXHRpZDogJ3dhbGt0aHJvdWdocy5zZWxlY3RTdGVwJyxcblx0aGFuZGxlcjogKGFjY2Vzc29yLCBzdGVwSUQ6IHN0cmluZykgPT4ge1xuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdGNvbnN0IGVkaXRvclBhbmUgPSBlZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0aWYgKGVkaXRvclBhbmUgaW5zdGFuY2VvZiBHZXR0aW5nU3RhcnRlZFBhZ2UpIHtcblx0XHRcdGVkaXRvclBhbmUuc2VsZWN0U3RlcExvb3NlKHN0ZXBJRCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ0Nhbm5vdCBydW4gd2Fsa3Rocm91Z2hzLnNlbGVjdFN0ZXAgb3V0c2lkZSBvZiB3YWxrdGhyb3VnaCBjb250ZXh0Jyk7XG5cdFx0fVxuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd2VsY29tZS5tYXJrU3RlcENvbXBsZXRlJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnd2VsY29tZS5tYXJrU3RlcENvbXBsZXRlJywgXCJNYXJrIFN0ZXAgQ29tcGxldGVcIiksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJnOiBzdHJpbmcpIHtcblx0XHRpZiAoIWFyZykgeyByZXR1cm47IH1cblx0XHRjb25zdCBnZXR0aW5nU3RhcnRlZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdhbGt0aHJvdWdoc1NlcnZpY2UpO1xuXHRcdGdldHRpbmdTdGFydGVkU2VydmljZS5wcm9ncmVzc1N0ZXAoYXJnKTtcblx0fVxufSk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3dlbGNvbWUubWFya1N0ZXBJbmNvbXBsZXRlJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnd2VsY29tZS5tYXJrU3RlcElub21wbGV0ZScsIFwiTWFyayBTdGVwIEluY29tcGxldGVcIiksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJnOiBzdHJpbmcpIHtcblx0XHRpZiAoIWFyZykgeyByZXR1cm47IH1cblx0XHRjb25zdCBnZXR0aW5nU3RhcnRlZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdhbGt0aHJvdWdoc1NlcnZpY2UpO1xuXHRcdGdldHRpbmdTdGFydGVkU2VydmljZS5kZXByb2dyZXNzU3RlcChhcmcpO1xuXHR9XG59KTtcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAnd2VsY29tZS5zaG93QWxsV2Fsa3Rocm91Z2hzJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dlbGNvbWUuc2hvd0FsbFdhbGt0aHJvdWdocycsICdPcGVuIFdhbGt0aHJvdWdoLi4uJyksXG5cdFx0XHRjYXRlZ29yeSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRRdWlja1BpY2tJdGVtcyhcblx0XHRjb250ZXh0U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdGdldHRpbmdTdGFydGVkU2VydmljZTogSVdhbGt0aHJvdWdoc1NlcnZpY2Vcblx0KTogUHJvbWlzZTxJUXVpY2tQaWNrSXRlbVtdPiB7XG5cdFx0Y29uc3QgY2F0ZWdvcmllcyA9IGF3YWl0IGdldHRpbmdTdGFydGVkU2VydmljZS5nZXRXYWxrdGhyb3VnaHMoKTtcblx0XHRyZXR1cm4gY2F0ZWdvcmllc1xuXHRcdFx0LmZpbHRlcihjID0+IGNvbnRleHRTZXJ2aWNlLmNvbnRleHRNYXRjaGVzUnVsZXMoYy53aGVuKSlcblx0XHRcdC5tYXAoeCA9PiAoe1xuXHRcdFx0XHRpZDogeC5pZCxcblx0XHRcdFx0bGFiZWw6IHgudGl0bGUsXG5cdFx0XHRcdGRldGFpbDogeC5kZXNjcmlwdGlvbixcblx0XHRcdFx0ZGVzY3JpcHRpb246IHguc291cmNlLFxuXHRcdFx0fSkpO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0Y29uc3QgY29tbWFuZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbW1hbmRTZXJ2aWNlKTtcblx0XHRjb25zdCBjb250ZXh0U2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdFx0Y29uc3QgZ2V0dGluZ1N0YXJ0ZWRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXYWxrdGhyb3VnaHNTZXJ2aWNlKTtcblx0XHRjb25zdCBleHRlbnNpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFeHRlbnNpb25TZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IHF1aWNrUGljayA9IGRpc3Bvc2FibGVzLmFkZChxdWlja0lucHV0U2VydmljZS5jcmVhdGVRdWlja1BpY2soKSk7XG5cdFx0cXVpY2tQaWNrLmNhblNlbGVjdE1hbnkgPSBmYWxzZTtcblx0XHRxdWlja1BpY2subWF0Y2hPbkRlc2NyaXB0aW9uID0gdHJ1ZTtcblx0XHRxdWlja1BpY2subWF0Y2hPbkRldGFpbCA9IHRydWU7XG5cdFx0cXVpY2tQaWNrLnBsYWNlaG9sZGVyID0gbG9jYWxpemUoJ3BpY2tXYWxrdGhyb3VnaHMnLCAnU2VsZWN0IGEgd2Fsa3Rocm91Z2ggdG8gb3BlbicpO1xuXHRcdHF1aWNrUGljay5pdGVtcyA9IGF3YWl0IHRoaXMuZ2V0UXVpY2tQaWNrSXRlbXMoY29udGV4dFNlcnZpY2UsIGdldHRpbmdTdGFydGVkU2VydmljZSk7XG5cdFx0cXVpY2tQaWNrLmJ1c3kgPSB0cnVlO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja1BpY2sub25EaWRBY2NlcHQoKCkgPT4ge1xuXHRcdFx0Y29uc3Qgc2VsZWN0aW9uID0gcXVpY2tQaWNrLnNlbGVjdGVkSXRlbXNbMF07XG5cdFx0XHRpZiAoc2VsZWN0aW9uKSB7XG5cdFx0XHRcdGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCd3b3JrYmVuY2guYWN0aW9uLm9wZW5XYWxrdGhyb3VnaCcsIHNlbGVjdGlvbi5pZCk7XG5cdFx0XHR9XG5cdFx0XHRxdWlja1BpY2suaGlkZSgpO1xuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQocXVpY2tQaWNrLm9uRGlkSGlkZSgoKSA9PiBkaXNwb3NhYmxlcy5kaXNwb3NlKCkpKTtcblx0XHRhd2FpdCBleHRlbnNpb25TZXJ2aWNlLndoZW5JbnN0YWxsZWRFeHRlbnNpb25zUmVnaXN0ZXJlZCgpO1xuXHRcdGdldHRpbmdTdGFydGVkU2VydmljZS5vbkRpZEFkZFdhbGt0aHJvdWdoKGFzeW5jICgpID0+IHtcblx0XHRcdHF1aWNrUGljay5pdGVtcyA9IGF3YWl0IHRoaXMuZ2V0UXVpY2tQaWNrSXRlbXMoY29udGV4dFNlcnZpY2UsIGdldHRpbmdTdGFydGVkU2VydmljZSk7XG5cdFx0fSk7XG5cdFx0cXVpY2tQaWNrLnNob3coKTtcblx0XHRxdWlja1BpY2suYnVzeSA9IGZhbHNlO1xuXHR9XG59KTtcblxuZXhwb3J0IGNvbnN0IFdvcmtzcGFjZVBsYXRmb3JtID0gbmV3IFJhd0NvbnRleHRLZXk8J21hYycgfCAnbGludXgnIHwgJ3dpbmRvd3MnIHwgJ3dlYndvcmtlcicgfCB1bmRlZmluZWQ+KCd3b3Jrc3BhY2VQbGF0Zm9ybScsIHVuZGVmaW5lZCwgbG9jYWxpemUoJ3dvcmtzcGFjZVBsYXRmb3JtJywgXCJUaGUgcGxhdGZvcm0gb2YgdGhlIGN1cnJlbnQgd29ya3NwYWNlLCB3aGljaCBpbiByZW1vdGUgb3Igc2VydmVybGVzcyBjb250ZXh0cyBtYXkgYmUgZGlmZmVyZW50IGZyb20gdGhlIHBsYXRmb3JtIG9mIHRoZSBVSVwiKSk7XG5jbGFzcyBXb3Jrc3BhY2VQbGF0Zm9ybUNvbnRyaWJ1dGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLndvcmtzcGFjZVBsYXRmb3JtJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2U6IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZSxcblx0XHRASVJlbW90ZUFnZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHJlbW90ZUFnZW50U2VydmljZTogSVJlbW90ZUFnZW50U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dFNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5yZW1vdGVBZ2VudFNlcnZpY2UuZ2V0RW52aXJvbm1lbnQoKS50aGVuKGVudiA9PiB7XG5cdFx0XHRjb25zdCByZW1vdGVPUyA9IGVudj8ub3M7XG5cblx0XHRcdGNvbnN0IHJlbW90ZVBsYXRmb3JtID0gcmVtb3RlT1MgPT09IE9TLk1hY2ludG9zaCA/ICdtYWMnXG5cdFx0XHRcdDogcmVtb3RlT1MgPT09IE9TLldpbmRvd3MgPyAnd2luZG93cydcblx0XHRcdFx0XHQ6IHJlbW90ZU9TID09PSBPUy5MaW51eCA/ICdsaW51eCdcblx0XHRcdFx0XHRcdDogdW5kZWZpbmVkO1xuXG5cdFx0XHRpZiAocmVtb3RlUGxhdGZvcm0pIHtcblx0XHRcdFx0V29ya3NwYWNlUGxhdGZvcm0uYmluZFRvKHRoaXMuY29udGV4dFNlcnZpY2UpLnNldChyZW1vdGVQbGF0Zm9ybSk7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UubG9jYWxFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyKSB7XG5cdFx0XHRcdGlmIChpc01hY2ludG9zaCkge1xuXHRcdFx0XHRcdFdvcmtzcGFjZVBsYXRmb3JtLmJpbmRUbyh0aGlzLmNvbnRleHRTZXJ2aWNlKS5zZXQoJ21hYycpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGlzTGludXgpIHtcblx0XHRcdFx0XHRXb3Jrc3BhY2VQbGF0Zm9ybS5iaW5kVG8odGhpcy5jb250ZXh0U2VydmljZSkuc2V0KCdsaW51eCcpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGlzV2luZG93cykge1xuXHRcdFx0XHRcdFdvcmtzcGFjZVBsYXRmb3JtLmJpbmRUbyh0aGlzLmNvbnRleHRTZXJ2aWNlKS5zZXQoJ3dpbmRvd3MnKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmICh0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLndlYkV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpIHtcblx0XHRcdFx0V29ya3NwYWNlUGxhdGZvcm0uYmluZFRvKHRoaXMuY29udGV4dFNlcnZpY2UpLnNldCgnd2Vid29ya2VyJyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zb2xlLmVycm9yKCdFcnJvcjogVW5hYmxlIHRvIGRldGVjdCB3b3Jrc3BhY2UgcGxhdGZvcm0nKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxufVxuXG5jb25zdCBjb25maWd1cmF0aW9uUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihDb25maWd1cmF0aW9uRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKTtcbmNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHQuLi53b3JrYmVuY2hDb25maWd1cmF0aW9uTm9kZUJhc2UsXG5cdHByb3BlcnRpZXM6IHtcblx0XHQnd29ya2JlbmNoLndlbGNvbWVQYWdlLndhbGt0aHJvdWdocy5vcGVuT25JbnN0YWxsJzoge1xuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5NQUNISU5FLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnd29ya2JlbmNoLndlbGNvbWVQYWdlLndhbGt0aHJvdWdocy5vcGVuT25JbnN0YWxsJywgXCJXaGVuIGVuYWJsZWQsIGFuIGV4dGVuc2lvbidzIHdhbGt0aHJvdWdoIHdpbGwgb3BlbiB1cG9uIGluc3RhbGwgb2YgdGhlIGV4dGVuc2lvbi5cIilcblx0XHR9LFxuXHRcdCd3b3JrYmVuY2guc3RhcnR1cEVkaXRvcic6IHtcblx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5SRVNPVVJDRSxcblx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHQnZW51bSc6IFsnbm9uZScsICd3ZWxjb21lUGFnZScsICdyZWFkbWUnLCAnbmV3VW50aXRsZWRGaWxlJywgJ3dlbGNvbWVQYWdlSW5FbXB0eVdvcmtiZW5jaCcsICd0ZXJtaW5hbCddLFxuXHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdGxvY2FsaXplKHsgY29tbWVudDogWydUaGlzIGlzIHRoZSBkZXNjcmlwdGlvbiBmb3IgYSBzZXR0aW5nLiBWYWx1ZXMgc3Vycm91bmRlZCBieSBzaW5nbGUgcXVvdGVzIGFyZSBub3QgdG8gYmUgdHJhbnNsYXRlZC4nXSwga2V5OiAnd29ya2JlbmNoLnN0YXJ0dXBFZGl0b3Iubm9uZScgfSwgXCJTdGFydCB3aXRob3V0IGFuIGVkaXRvci5cIiksXG5cdFx0XHRcdGxvY2FsaXplKHsgY29tbWVudDogWydUaGlzIGlzIHRoZSBkZXNjcmlwdGlvbiBmb3IgYSBzZXR0aW5nLiBWYWx1ZXMgc3Vycm91bmRlZCBieSBzaW5nbGUgcXVvdGVzIGFyZSBub3QgdG8gYmUgdHJhbnNsYXRlZC4nXSwga2V5OiAnd29ya2JlbmNoLnN0YXJ0dXBFZGl0b3Iud2VsY29tZVBhZ2UnIH0sIFwiT3BlbiB0aGUgV2VsY29tZSBwYWdlLCB3aXRoIGNvbnRlbnQgdG8gYWlkIGluIGdldHRpbmcgc3RhcnRlZCB3aXRoIFZTIENvZGUgYW5kIGV4dGVuc2lvbnMuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSh7IGNvbW1lbnQ6IFsnVGhpcyBpcyB0aGUgZGVzY3JpcHRpb24gZm9yIGEgc2V0dGluZy4gVmFsdWVzIHN1cnJvdW5kZWQgYnkgc2luZ2xlIHF1b3RlcyBhcmUgbm90IHRvIGJlIHRyYW5zbGF0ZWQuJ10sIGtleTogJ3dvcmtiZW5jaC5zdGFydHVwRWRpdG9yLnJlYWRtZScgfSwgXCJPcGVuIHRoZSBSRUFETUUgd2hlbiBvcGVuaW5nIGEgZm9sZGVyIHRoYXQgY29udGFpbnMgb25lLCBmYWxsYmFjayB0byAnd2VsY29tZVBhZ2UnIG90aGVyd2lzZS4gTm90ZTogVGhpcyBpcyBvbmx5IG9ic2VydmVkIGFzIGEgZ2xvYmFsIGNvbmZpZ3VyYXRpb24sIGl0IHdpbGwgYmUgaWdub3JlZCBpZiBzZXQgaW4gYSB3b3Jrc3BhY2Ugb3IgZm9sZGVyIGNvbmZpZ3VyYXRpb24uXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSh7IGNvbW1lbnQ6IFsnVGhpcyBpcyB0aGUgZGVzY3JpcHRpb24gZm9yIGEgc2V0dGluZy4gVmFsdWVzIHN1cnJvdW5kZWQgYnkgc2luZ2xlIHF1b3RlcyBhcmUgbm90IHRvIGJlIHRyYW5zbGF0ZWQuJ10sIGtleTogJ3dvcmtiZW5jaC5zdGFydHVwRWRpdG9yLm5ld1VudGl0bGVkRmlsZScgfSwgXCJPcGVuIGEgbmV3IHVudGl0bGVkIHRleHQgZmlsZSAob25seSBhcHBsaWVzIHdoZW4gb3BlbmluZyBhbiBlbXB0eSB3aW5kb3cpLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoeyBjb21tZW50OiBbJ1RoaXMgaXMgdGhlIGRlc2NyaXB0aW9uIGZvciBhIHNldHRpbmcuIFZhbHVlcyBzdXJyb3VuZGVkIGJ5IHNpbmdsZSBxdW90ZXMgYXJlIG5vdCB0byBiZSB0cmFuc2xhdGVkLiddLCBrZXk6ICd3b3JrYmVuY2guc3RhcnR1cEVkaXRvci53ZWxjb21lUGFnZUluRW1wdHlXb3JrYmVuY2gnIH0sIFwiT3BlbiB0aGUgV2VsY29tZSBwYWdlIHdoZW4gb3BlbmluZyBhbiBlbXB0eSB3b3JrYmVuY2guXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSh7IGNvbW1lbnQ6IFsnVGhpcyBpcyB0aGUgZGVzY3JpcHRpb24gZm9yIGEgc2V0dGluZy4gVmFsdWVzIHN1cnJvdW5kZWQgYnkgc2luZ2xlIHF1b3RlcyBhcmUgbm90IHRvIGJlIHRyYW5zbGF0ZWQuJ10sIGtleTogJ3dvcmtiZW5jaC5zdGFydHVwRWRpdG9yLnRlcm1pbmFsJyB9LCBcIk9wZW4gYSBuZXcgdGVybWluYWwgaW4gdGhlIGVkaXRvciBhcmVhLlwiKSxcblx0XHRcdF0sXG5cdFx0XHQnZGVmYXVsdCc6ICd3ZWxjb21lUGFnZScsXG5cdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnd29ya2JlbmNoLnN0YXJ0dXBFZGl0b3InLCBcIkNvbnRyb2xzIHdoaWNoIGVkaXRvciBpcyBzaG93biBhdCBzdGFydHVwLCBpZiBub25lIGFyZSByZXN0b3JlZCBmcm9tIHRoZSBwcmV2aW91cyBzZXNzaW9uLlwiKVxuXHRcdH0sXG5cdFx0J3dvcmtiZW5jaC53ZWxjb21lUGFnZS5wcmVmZXJSZWR1Y2VkTW90aW9uJzoge1xuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5BUFBMSUNBVElPTixcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlLFxuXHRcdFx0ZGVwcmVjYXRpb25NZXNzYWdlOiBsb2NhbGl6ZSgnZGVwcmVjYXRpb25NZXNzYWdlJywgXCJEZXByZWNhdGVkLCB1c2UgdGhlIGdsb2JhbCBgd29ya2JlbmNoLnJlZHVjZU1vdGlvbmAuXCIpLFxuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3b3JrYmVuY2gud2VsY29tZVBhZ2UucHJlZmVyUmVkdWNlZE1vdGlvbicsIFwiV2hlbiBlbmFibGVkLCByZWR1Y2UgbW90aW9uIGluIHdlbGNvbWUgcGFnZS5cIilcblx0XHR9XG5cdH1cbn0pO1xuXG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoV29ya3NwYWNlUGxhdGZvcm1Db250cmlidXRpb24uSUQsIFdvcmtzcGFjZVBsYXRmb3JtQ29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZS5BZnRlclJlc3RvcmVkKTtcbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihTdGFydHVwUGFnZUVkaXRvclJlc29sdmVyQ29udHJpYnV0aW9uLklELCBTdGFydHVwUGFnZUVkaXRvclJlc29sdmVyQ29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZS5CbG9ja1Jlc3RvcmUpO1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKFN0YXJ0dXBQYWdlUnVubmVyQ29udHJpYnV0aW9uLklELCBTdGFydHVwUGFnZVJ1bm5lckNvbnRyaWJ1dGlvbiwgV29ya2JlbmNoUGhhc2UuQWZ0ZXJSZXN0b3JlZCk7XG5cbkFjY2Vzc2libGVWaWV3UmVnaXN0cnkucmVnaXN0ZXIobmV3IEdldHRpbmdTdGFydGVkQWNjZXNzaWJsZVZpZXcoKSk7XG5cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFTLCtCQUErQixvQkFBb0Isd0JBQXdCO0FBQ3BGLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsd0JBQWdEO0FBQ3pELFNBQVMsUUFBUSxpQkFBaUIsZUFBZTtBQUNqRCxTQUFTLDZCQUErQztBQUN4RCxTQUFTLGdCQUFnQixvQkFBb0IscUJBQXFCO0FBQ2xFLFNBQVMsZ0JBQWdCLGtCQUFrQjtBQUMzQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyw0QkFBaUQ7QUFDMUQsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyw0QkFBNEI7QUFDckMsU0FBc0MsMkJBQTJCO0FBQ2pFLFNBQVMsZ0NBQWdDLHNCQUFzQjtBQUMvRCxTQUFTLG9CQUFvQixjQUFjLCtCQUF1RDtBQUNsRyxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLGtCQUFrQix1QkFBdUI7QUFDbEQsU0FBUywwQkFBMEM7QUFDbkQsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxTQUFTLGFBQWEsV0FBVyxtQkFBbUIsVUFBVTtBQUN2RSxTQUFTLHlDQUF5QztBQUNsRCxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHVDQUF1QyxxQ0FBcUM7QUFDckYsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxvQ0FBb0M7QUFFN0MsWUFBWSxXQUFXO0FBRXZCLGdCQUFnQixj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
