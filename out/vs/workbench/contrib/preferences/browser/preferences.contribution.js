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
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { isBoolean, isObject, isString } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import "./media/preferences.css";
import { EditorContributionInstantiation, registerEditorContribution } from "../../../../editor/browser/editorExtensions.js";
import { Context as SuggestContext } from "../../../../editor/contrib/suggest/browser/suggest.js";
import * as nls from "../../../../nls.js";
import { Action2, MenuId, MenuRegistry, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { InputFocusedContext, IsMacNativeContext } from "../../../../platform/contextkey/common/contextkeys.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { PICK_WORKSPACE_FOLDER_COMMAND_ID } from "../../../browser/actions/workspaceCommands.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { EditorExtensions } from "../../../common/editor.js";
import { ResourceContextKey, RemoteNameContext, WorkbenchStateContext } from "../../../common/contextkeys.js";
import { ExplorerFolderContext, ExplorerRootContext } from "../../files/common/files.js";
import { KeybindingsEditor } from "./keybindingsEditor.js";
import { ConfigureLanguageBasedSettingsAction } from "./preferencesActions.js";
import { SettingsEditorContribution } from "./preferencesEditor.js";
import { preferencesOpenSettingsIcon } from "./preferencesIcons.js";
import { SettingsEditor2, SettingsFocusContext } from "./settingsEditor2.js";
import { CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDINGS_SEARCH_FOCUS, CONTEXT_KEYBINDING_FOCUS, CONTEXT_SETTINGS_EDITOR, CONTEXT_SETTINGS_JSON_EDITOR, CONTEXT_SETTINGS_ROW_FOCUS, CONTEXT_SETTINGS_SEARCH_FOCUS, CONTEXT_TOC_ROW_FOCUS, CONTEXT_WHEN_FOCUS, KEYBINDINGS_EDITOR_COMMAND_ACCEPT_WHEN, KEYBINDINGS_EDITOR_COMMAND_ADD, KEYBINDINGS_EDITOR_COMMAND_CLEAR_SEARCH_HISTORY, KEYBINDINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS, KEYBINDINGS_EDITOR_COMMAND_COPY, KEYBINDINGS_EDITOR_COMMAND_COPY_COMMAND, KEYBINDINGS_EDITOR_COMMAND_COPY_COMMAND_TITLE, KEYBINDINGS_EDITOR_COMMAND_DEFINE, KEYBINDINGS_EDITOR_COMMAND_DEFINE_WHEN, KEYBINDINGS_EDITOR_COMMAND_FOCUS_KEYBINDINGS, KEYBINDINGS_EDITOR_COMMAND_RECORD_SEARCH_KEYS, KEYBINDINGS_EDITOR_COMMAND_REJECT_WHEN, KEYBINDINGS_EDITOR_COMMAND_REMOVE, KEYBINDINGS_EDITOR_COMMAND_RESET, KEYBINDINGS_EDITOR_COMMAND_SEARCH, KEYBINDINGS_EDITOR_COMMAND_SHOW_SIMILAR, KEYBINDINGS_EDITOR_COMMAND_SORTBY_PRECEDENCE, KEYBINDINGS_EDITOR_SHOW_DEFAULT_KEYBINDINGS, KEYBINDINGS_EDITOR_SHOW_EXTENSION_KEYBINDINGS, KEYBINDINGS_EDITOR_SHOW_USER_KEYBINDINGS, REQUIRE_TRUSTED_WORKSPACE_SETTING_TAG, SETTINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS, SETTINGS_EDITOR_COMMAND_SHOW_CONTEXT_MENU } from "../common/preferences.js";
import { PreferencesContribution } from "../common/preferencesContribution.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { KeybindingsEditorInput } from "../../../services/preferences/browser/keybindingsEditorInput.js";
import { DEFINE_KEYBINDING_EDITOR_CONTRIB_ID, IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { SettingsEditor2Input } from "../../../services/preferences/common/preferencesEditorInput.js";
import { IUserDataProfileService, CURRENT_PROFILE_CONTEXT } from "../../../services/userDataProfile/common/userDataProfile.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { isCodeEditor } from "../../../../editor/browser/editorBrowser.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { resolveCommandsContext } from "../../../browser/parts/editor/editorCommandsContext.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { IListService } from "../../../../platform/list/browser/listService.js";
const SETTINGS_EDITOR_COMMAND_SEARCH = "settings.action.search";
const SETTINGS_EDITOR_COMMAND_FOCUS_FILE = "settings.action.focusSettingsFile";
const SETTINGS_EDITOR_COMMAND_FOCUS_SETTINGS_FROM_SEARCH = "settings.action.focusSettingsFromSearch";
const SETTINGS_EDITOR_COMMAND_FOCUS_SETTINGS_LIST = "settings.action.focusSettingsList";
const SETTINGS_EDITOR_COMMAND_FOCUS_TOC = "settings.action.focusTOC";
const SETTINGS_EDITOR_COMMAND_FOCUS_CONTROL = "settings.action.focusSettingControl";
const SETTINGS_EDITOR_COMMAND_FOCUS_UP = "settings.action.focusLevelUp";
const SETTINGS_EDITOR_COMMAND_SWITCH_TO_JSON = "settings.switchToJSON";
const SETTINGS_EDITOR_COMMAND_FILTER_ONLINE = "settings.filterByOnline";
const SETTINGS_EDITOR_COMMAND_FILTER_UNTRUSTED = "settings.filterUntrusted";
const SETTINGS_COMMAND_OPEN_SETTINGS = "workbench.action.openSettings";
const SETTINGS_COMMAND_FILTER_TELEMETRY = "settings.filterByTelemetry";
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    SettingsEditor2,
    SettingsEditor2.ID,
    nls.localize("settingsEditor2", "Settings Editor 2")
  ),
  [
    new SyncDescriptor(SettingsEditor2Input)
  ]
);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    KeybindingsEditor,
    KeybindingsEditor.ID,
    nls.localize("keybindingsEditor", "Keybindings Editor")
  ),
  [
    new SyncDescriptor(KeybindingsEditorInput)
  ]
);
class KeybindingsEditorInputSerializer {
  canSerialize(editorInput) {
    return true;
  }
  serialize(editorInput) {
    return "";
  }
  deserialize(instantiationService) {
    return instantiationService.createInstance(KeybindingsEditorInput);
  }
}
class SettingsEditor2InputSerializer {
  canSerialize(editorInput) {
    return true;
  }
  serialize(input) {
    return "";
  }
  deserialize(instantiationService) {
    return instantiationService.createInstance(SettingsEditor2Input);
  }
}
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(KeybindingsEditorInput.ID, KeybindingsEditorInputSerializer);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(SettingsEditor2Input.ID, SettingsEditor2InputSerializer);
const OPEN_USER_SETTINGS_UI_TITLE = nls.localize2("openSettings2", "Open Settings (UI)");
const OPEN_USER_SETTINGS_JSON_TITLE = nls.localize2("openUserSettingsJson", "Open User Settings (JSON)");
const OPEN_APPLICATION_SETTINGS_JSON_TITLE = nls.localize2("openApplicationSettingsJson", "Open Application Settings (JSON)");
const category = Categories.Preferences;
function sanitizeBoolean(arg) {
  return isBoolean(arg) ? arg : void 0;
}
function sanitizeString(arg) {
  return isString(arg) ? arg : void 0;
}
function sanitizeOpenSettingsArgs(args) {
  if (!isObject(args)) {
    args = {};
  }
  let sanitizedObject = {
    focusSearch: sanitizeBoolean(args?.focusSearch),
    openToSide: sanitizeBoolean(args?.openToSide),
    query: sanitizeString(args?.query)
  };
  if (isString(args?.revealSetting?.key)) {
    sanitizedObject = {
      ...sanitizedObject,
      revealSetting: {
        key: args.revealSetting.key,
        edit: sanitizeBoolean(args.revealSetting?.edit)
      }
    };
  }
  return sanitizedObject;
}
let PreferencesActionsContribution = class extends Disposable {
  constructor(environmentService, userDataProfileService, preferencesService, workspaceContextService, labelService, extensionService, userDataProfilesService) {
    super();
    this.environmentService = environmentService;
    this.userDataProfileService = userDataProfileService;
    this.preferencesService = preferencesService;
    this.workspaceContextService = workspaceContextService;
    this.labelService = labelService;
    this.extensionService = extensionService;
    this.userDataProfilesService = userDataProfilesService;
    this.registerSettingsActions();
    this.registerKeybindingsActions();
    this.updatePreferencesEditorMenuItem();
    this._register(workspaceContextService.onDidChangeWorkbenchState(() => this.updatePreferencesEditorMenuItem()));
    this._register(workspaceContextService.onDidChangeWorkspaceFolders(() => this.updatePreferencesEditorMenuItemForWorkspaceFolders()));
  }
  registerSettingsActions() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: SETTINGS_COMMAND_OPEN_SETTINGS,
          title: {
            ...nls.localize2("settings", "Settings"),
            mnemonicTitle: nls.localize({ key: "miOpenSettings", comment: ["&& denotes a mnemonic"] }, "&&Settings")
          },
          keybinding: {
            weight: KeybindingWeight.WorkbenchContrib,
            when: null,
            primary: KeyMod.CtrlCmd | KeyCode.Comma
          },
          menu: [{
            id: MenuId.GlobalActivity,
            group: "2_configuration",
            order: 2
          }, {
            id: MenuId.MenubarPreferencesMenu,
            group: "2_configuration",
            order: 2
          }]
        });
      }
      run(accessor, args) {
        const opts = typeof args === "string" ? { query: args } : sanitizeOpenSettingsArgs(args);
        return accessor.get(IPreferencesService).openSettings(opts);
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.openSettings2",
          title: nls.localize2("openSettings2", "Open Settings (UI)"),
          category,
          f1: true
        });
      }
      run(accessor, args) {
        args = sanitizeOpenSettingsArgs(args);
        return accessor.get(IPreferencesService).openSettings({ jsonEditor: false, ...args });
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.openSettingsJson",
          title: OPEN_USER_SETTINGS_JSON_TITLE,
          metadata: {
            description: nls.localize2("workbench.action.openSettingsJson.description", "Opens the JSON file containing the current user profile settings")
          },
          category,
          f1: true
        });
      }
      run(accessor, args) {
        args = sanitizeOpenSettingsArgs(args);
        return accessor.get(IPreferencesService).openSettings({ jsonEditor: true, ...args });
      }
    }));
    const that = this;
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.openApplicationSettingsJson",
          title: OPEN_APPLICATION_SETTINGS_JSON_TITLE,
          category,
          menu: {
            id: MenuId.CommandPalette,
            when: ContextKeyExpr.notEquals(CURRENT_PROFILE_CONTEXT.key, that.userDataProfilesService.defaultProfile.id)
          }
        });
      }
      run(accessor, args) {
        args = sanitizeOpenSettingsArgs(args);
        return accessor.get(IPreferencesService).openApplicationSettings({ jsonEditor: true, ...args });
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.openGlobalSettings",
          title: nls.localize2("openGlobalSettings", "Open User Settings"),
          category,
          f1: true
        });
      }
      run(accessor, args) {
        args = sanitizeOpenSettingsArgs(args);
        return accessor.get(IPreferencesService).openUserSettings(args);
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.openRawDefaultSettings",
          title: nls.localize2("openRawDefaultSettings", "Open Default Settings (JSON)"),
          category,
          f1: true
        });
      }
      run(accessor) {
        return accessor.get(IPreferencesService).openRawDefaultSettings();
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: ConfigureLanguageBasedSettingsAction.ID,
          title: ConfigureLanguageBasedSettingsAction.LABEL,
          category,
          f1: true
        });
      }
      run(accessor) {
        return accessor.get(IInstantiationService).createInstance(ConfigureLanguageBasedSettingsAction, ConfigureLanguageBasedSettingsAction.ID, ConfigureLanguageBasedSettingsAction.LABEL.value).run();
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.openWorkspaceSettings",
          title: nls.localize2("openWorkspaceSettings", "Open Workspace Settings"),
          category,
          menu: {
            id: MenuId.CommandPalette,
            when: WorkbenchStateContext.notEqualsTo("empty")
          }
        });
      }
      run(accessor, args) {
        args = typeof args === "string" ? { query: args } : sanitizeOpenSettingsArgs(args);
        return accessor.get(IPreferencesService).openWorkspaceSettings(args);
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.openAccessibilitySettings",
          title: nls.localize2("openAccessibilitySettings", "Open Accessibility Settings"),
          category,
          menu: {
            id: MenuId.CommandPalette,
            when: WorkbenchStateContext.notEqualsTo("empty")
          }
        });
      }
      async run(accessor) {
        await accessor.get(IPreferencesService).openSettings({ jsonEditor: false, query: "@tag:accessibility" });
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.openWorkspaceSettingsFile",
          title: nls.localize2("openWorkspaceSettingsFile", "Open Workspace Settings (JSON)"),
          category,
          menu: {
            id: MenuId.CommandPalette,
            when: WorkbenchStateContext.notEqualsTo("empty")
          }
        });
      }
      run(accessor, args) {
        args = sanitizeOpenSettingsArgs(args);
        return accessor.get(IPreferencesService).openWorkspaceSettings({ jsonEditor: true, ...args });
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.openFolderSettings",
          title: nls.localize2("openFolderSettings", "Open Folder Settings"),
          category,
          menu: {
            id: MenuId.CommandPalette,
            when: WorkbenchStateContext.isEqualTo("workspace")
          }
        });
      }
      async run(accessor, args) {
        const commandService = accessor.get(ICommandService);
        const preferencesService = accessor.get(IPreferencesService);
        const workspaceFolder = await commandService.executeCommand(PICK_WORKSPACE_FOLDER_COMMAND_ID);
        if (workspaceFolder) {
          args = sanitizeOpenSettingsArgs(args);
          await preferencesService.openFolderSettings({ folderUri: workspaceFolder.uri, ...args });
        }
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.openFolderSettingsFile",
          title: nls.localize2("openFolderSettingsFile", "Open Folder Settings (JSON)"),
          category,
          menu: {
            id: MenuId.CommandPalette,
            when: WorkbenchStateContext.isEqualTo("workspace")
          }
        });
      }
      async run(accessor, args) {
        const commandService = accessor.get(ICommandService);
        const preferencesService = accessor.get(IPreferencesService);
        const workspaceFolder = await commandService.executeCommand(PICK_WORKSPACE_FOLDER_COMMAND_ID);
        if (workspaceFolder) {
          args = sanitizeOpenSettingsArgs(args);
          await preferencesService.openFolderSettings({ folderUri: workspaceFolder.uri, jsonEditor: true, ...args });
        }
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "_workbench.action.openFolderSettings",
          title: nls.localize("openFolderSettings", "Open Folder Settings"),
          category,
          menu: {
            id: MenuId.ExplorerContext,
            group: "2_workspace",
            order: 20,
            when: ContextKeyExpr.and(ExplorerRootContext, ExplorerFolderContext)
          }
        });
      }
      async run(accessor, resource) {
        if (URI.isUri(resource)) {
          await accessor.get(IPreferencesService).openFolderSettings({ folderUri: resource });
        } else {
          const commandService = accessor.get(ICommandService);
          const preferencesService = accessor.get(IPreferencesService);
          const workspaceFolder = await commandService.executeCommand(PICK_WORKSPACE_FOLDER_COMMAND_ID);
          if (workspaceFolder) {
            await preferencesService.openFolderSettings({ folderUri: workspaceFolder.uri });
          }
        }
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: SETTINGS_EDITOR_COMMAND_FILTER_ONLINE,
          title: nls.localize({ key: "miOpenOnlineSettings", comment: ["&& denotes a mnemonic"] }, "&&Online Services Settings"),
          menu: {
            id: MenuId.MenubarPreferencesMenu,
            group: "3_settings",
            order: 1
          }
        });
      }
      run(accessor) {
        const editorPane = accessor.get(IEditorService).activeEditorPane;
        if (editorPane instanceof SettingsEditor2) {
          editorPane.focusSearch(`@tag:usesOnlineServices`);
        } else {
          accessor.get(IPreferencesService).openSettings({ jsonEditor: false, query: "@tag:usesOnlineServices" });
        }
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: SETTINGS_EDITOR_COMMAND_FILTER_UNTRUSTED,
          title: nls.localize2("filterUntrusted", "Show untrusted workspace settings")
        });
      }
      run(accessor) {
        accessor.get(IPreferencesService).openWorkspaceSettings({ jsonEditor: false, query: `@tag:${REQUIRE_TRUSTED_WORKSPACE_SETTING_TAG}` });
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: SETTINGS_COMMAND_FILTER_TELEMETRY,
          title: nls.localize({ key: "miOpenTelemetrySettings", comment: ["&& denotes a mnemonic"] }, "&&Telemetry Settings")
        });
      }
      run(accessor) {
        const editorPane = accessor.get(IEditorService).activeEditorPane;
        if (editorPane instanceof SettingsEditor2) {
          editorPane.focusSearch(`@tag:telemetry`);
        } else {
          accessor.get(IPreferencesService).openSettings({ jsonEditor: false, query: "@tag:telemetry" });
        }
      }
    }));
    this.registerSettingsEditorActions();
    this.extensionService.whenInstalledExtensionsRegistered().then(() => {
      const remoteAuthority = this.environmentService.remoteAuthority;
      const hostLabel = this.labelService.getHostLabel(Schemas.vscodeRemote, remoteAuthority) || remoteAuthority;
      this._register(registerAction2(class extends Action2 {
        constructor() {
          super({
            id: "workbench.action.openRemoteSettings",
            title: nls.localize2("openRemoteSettings", "Open Remote Settings ({0})", hostLabel),
            category,
            menu: {
              id: MenuId.CommandPalette,
              when: RemoteNameContext.notEqualsTo("")
            }
          });
        }
        run(accessor, args) {
          args = sanitizeOpenSettingsArgs(args);
          return accessor.get(IPreferencesService).openRemoteSettings(args);
        }
      }));
      this._register(registerAction2(class extends Action2 {
        constructor() {
          super({
            id: "workbench.action.openRemoteSettingsFile",
            title: nls.localize2("openRemoteSettingsJSON", "Open Remote Settings (JSON) ({0})", hostLabel),
            category,
            menu: {
              id: MenuId.CommandPalette,
              when: RemoteNameContext.notEqualsTo("")
            }
          });
        }
        run(accessor, args) {
          args = sanitizeOpenSettingsArgs(args);
          return accessor.get(IPreferencesService).openRemoteSettings({ jsonEditor: true, ...args });
        }
      }));
    });
  }
  registerSettingsEditorActions() {
    function getPreferencesEditor(accessor) {
      const activeEditorPane = accessor.get(IEditorService).activeEditorPane;
      if (activeEditorPane instanceof SettingsEditor2) {
        return activeEditorPane;
      }
      return null;
    }
    function settingsEditorFocusSearch(accessor) {
      const preferencesEditor = getPreferencesEditor(accessor);
      preferencesEditor?.focusSearch();
    }
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: SETTINGS_EDITOR_COMMAND_SEARCH,
          precondition: CONTEXT_SETTINGS_EDITOR,
          keybinding: {
            primary: KeyMod.CtrlCmd | KeyCode.KeyF,
            weight: KeybindingWeight.EditorContrib,
            when: null
          },
          category,
          f1: true,
          title: nls.localize2("settings.focusSearch", "Focus Settings Search")
        });
      }
      run(accessor) {
        settingsEditorFocusSearch(accessor);
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: SETTINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS,
          precondition: CONTEXT_SETTINGS_EDITOR,
          keybinding: {
            primary: KeyCode.Escape,
            weight: KeybindingWeight.EditorContrib,
            when: CONTEXT_SETTINGS_SEARCH_FOCUS
          },
          category,
          f1: true,
          title: nls.localize2("settings.clearResults", "Clear Settings Search Results")
        });
      }
      run(accessor) {
        const preferencesEditor = getPreferencesEditor(accessor);
        preferencesEditor?.clearSearchResults();
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: SETTINGS_EDITOR_COMMAND_FOCUS_FILE,
          precondition: ContextKeyExpr.and(CONTEXT_SETTINGS_SEARCH_FOCUS, SuggestContext.Visible.toNegated()),
          keybinding: {
            primary: KeyCode.DownArrow,
            weight: KeybindingWeight.EditorContrib,
            when: null
          },
          title: nls.localize("settings.focusFile", "Focus settings file")
        });
      }
      run(accessor, args) {
        const preferencesEditor = getPreferencesEditor(accessor);
        preferencesEditor?.focusSettings();
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: SETTINGS_EDITOR_COMMAND_FOCUS_SETTINGS_FROM_SEARCH,
          precondition: ContextKeyExpr.and(CONTEXT_SETTINGS_SEARCH_FOCUS, SuggestContext.Visible.toNegated()),
          keybinding: {
            primary: KeyCode.DownArrow,
            weight: KeybindingWeight.WorkbenchContrib,
            when: null
          },
          title: nls.localize("settings.focusFile", "Focus settings file")
        });
      }
      run(accessor, args) {
        const preferencesEditor = getPreferencesEditor(accessor);
        preferencesEditor?.focusSettings();
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: SETTINGS_EDITOR_COMMAND_FOCUS_SETTINGS_LIST,
          precondition: ContextKeyExpr.and(CONTEXT_SETTINGS_EDITOR, CONTEXT_TOC_ROW_FOCUS),
          keybinding: {
            primary: KeyCode.Enter,
            weight: KeybindingWeight.WorkbenchContrib,
            when: null
          },
          title: nls.localize("settings.focusSettingsList", "Focus settings list")
        });
      }
      run(accessor) {
        const preferencesEditor = getPreferencesEditor(accessor);
        if (preferencesEditor instanceof SettingsEditor2) {
          preferencesEditor.focusSettings();
        }
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: SETTINGS_EDITOR_COMMAND_FOCUS_TOC,
          precondition: CONTEXT_SETTINGS_EDITOR,
          f1: true,
          keybinding: [
            {
              primary: KeyCode.LeftArrow,
              weight: KeybindingWeight.WorkbenchContrib,
              when: CONTEXT_SETTINGS_ROW_FOCUS
            }
          ],
          category,
          title: nls.localize2("settings.focusSettingsTOC", "Focus Settings Table of Contents")
        });
      }
      run(accessor) {
        const preferencesEditor = getPreferencesEditor(accessor);
        if (!(preferencesEditor instanceof SettingsEditor2)) {
          return;
        }
        preferencesEditor.focusTOC();
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: SETTINGS_EDITOR_COMMAND_FOCUS_CONTROL,
          precondition: ContextKeyExpr.and(CONTEXT_SETTINGS_EDITOR, CONTEXT_SETTINGS_ROW_FOCUS),
          keybinding: {
            primary: KeyCode.Enter,
            weight: KeybindingWeight.WorkbenchContrib
          },
          title: nls.localize("settings.focusSettingControl", "Focus Setting Control")
        });
      }
      run(accessor) {
        const preferencesEditor = getPreferencesEditor(accessor);
        if (!(preferencesEditor instanceof SettingsEditor2)) {
          return;
        }
        const activeElement = preferencesEditor.getContainer()?.ownerDocument.activeElement;
        if (activeElement?.classList.contains("monaco-list")) {
          preferencesEditor.focusSettings(true);
        }
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: SETTINGS_EDITOR_COMMAND_SHOW_CONTEXT_MENU,
          precondition: CONTEXT_SETTINGS_EDITOR,
          keybinding: {
            primary: KeyMod.Shift | KeyCode.F9,
            weight: KeybindingWeight.WorkbenchContrib,
            when: null
          },
          f1: true,
          category,
          title: nls.localize2("settings.showContextMenu", "Show Setting Context Menu")
        });
      }
      run(accessor) {
        const preferencesEditor = getPreferencesEditor(accessor);
        if (preferencesEditor instanceof SettingsEditor2) {
          preferencesEditor.showContextMenu();
        }
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: SETTINGS_EDITOR_COMMAND_FOCUS_UP,
          precondition: ContextKeyExpr.and(CONTEXT_SETTINGS_EDITOR, CONTEXT_SETTINGS_SEARCH_FOCUS.toNegated(), CONTEXT_SETTINGS_JSON_EDITOR.toNegated()),
          keybinding: {
            primary: KeyCode.Escape,
            weight: KeybindingWeight.WorkbenchContrib,
            when: null
          },
          f1: true,
          category,
          title: nls.localize2("settings.focusLevelUp", "Move Focus Up One Level")
        });
      }
      run(accessor) {
        const preferencesEditor = getPreferencesEditor(accessor);
        if (!(preferencesEditor instanceof SettingsEditor2)) {
          return;
        }
        if (preferencesEditor.currentFocusContext === SettingsFocusContext.SettingControl) {
          preferencesEditor.focusSettings();
        } else if (preferencesEditor.currentFocusContext === SettingsFocusContext.SettingTree) {
          preferencesEditor.focusTOC();
        } else if (preferencesEditor.currentFocusContext === SettingsFocusContext.TableOfContents) {
          preferencesEditor.focusSearch();
        }
      }
    }));
  }
  registerKeybindingsActions() {
    const that = this;
    const category2 = nls.localize2("preferences", "Preferences");
    const id = "workbench.action.openGlobalKeybindings";
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id,
          title: nls.localize2("openGlobalKeybindings", "Open Keyboard Shortcuts"),
          shortTitle: nls.localize("keyboardShortcuts", "Keyboard Shortcuts"),
          category: category2,
          icon: preferencesOpenSettingsIcon,
          keybinding: {
            when: null,
            weight: KeybindingWeight.WorkbenchContrib,
            primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyS)
          },
          menu: [
            { id: MenuId.CommandPalette },
            {
              id: MenuId.EditorTitle,
              when: ResourceContextKey.Resource.isEqualTo(that.userDataProfileService.currentProfile.keybindingsResource.toString()),
              group: "navigation",
              order: 1
            },
            {
              id: MenuId.GlobalActivity,
              group: "2_configuration",
              order: 4
            }
          ]
        });
      }
      run(accessor, ...args) {
        const query = typeof args[0] === "string" ? args[0] : void 0;
        const groupId = getEditorGroupFromArguments(accessor, args)?.id;
        return accessor.get(IPreferencesService).openGlobalKeybindingSettings(false, { query, groupId });
      }
    }));
    this._register(MenuRegistry.appendMenuItem(MenuId.MenubarPreferencesMenu, {
      command: {
        id,
        title: nls.localize("keyboardShortcuts", "Keyboard Shortcuts")
      },
      group: "2_configuration",
      order: 4
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.openDefaultKeybindingsFile",
          title: nls.localize2("openDefaultKeybindingsFile", "Open Default Keyboard Shortcuts (JSON)"),
          category: category2,
          menu: { id: MenuId.CommandPalette }
        });
      }
      run(accessor) {
        return accessor.get(IPreferencesService).openDefaultKeybindingsFile();
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.openGlobalKeybindingsFile",
          title: nls.localize2("openGlobalKeybindingsFile", "Open Keyboard Shortcuts (JSON)"),
          category: category2,
          icon: preferencesOpenSettingsIcon,
          menu: [
            { id: MenuId.CommandPalette },
            {
              id: MenuId.EditorTitle,
              when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR),
              group: "navigation"
            }
          ]
        });
      }
      run(accessor, ...args) {
        const groupId = getEditorGroupFromArguments(accessor, args)?.id;
        return accessor.get(IPreferencesService).openGlobalKeybindingSettings(true, { groupId });
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: KEYBINDINGS_EDITOR_SHOW_DEFAULT_KEYBINDINGS,
          title: nls.localize2("showDefaultKeybindings", "Show System Keybindings"),
          menu: [
            {
              id: MenuId.EditorTitle,
              when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR),
              group: "1_keyboard_preferences_actions"
            }
          ]
        });
      }
      run(accessor, ...args) {
        const group = getEditorGroupFromArguments(accessor, args);
        const editorPane = group?.activeEditorPane;
        if (editorPane instanceof KeybindingsEditor) {
          editorPane.search("@source:system");
        }
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: KEYBINDINGS_EDITOR_SHOW_EXTENSION_KEYBINDINGS,
          title: nls.localize2("showExtensionKeybindings", "Show Extension Keybindings"),
          menu: [
            {
              id: MenuId.EditorTitle,
              when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR),
              group: "1_keyboard_preferences_actions"
            }
          ]
        });
      }
      run(accessor, ...args) {
        const group = getEditorGroupFromArguments(accessor, args);
        const editorPane = group?.activeEditorPane;
        if (editorPane instanceof KeybindingsEditor) {
          editorPane.search("@source:extension");
        }
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: KEYBINDINGS_EDITOR_SHOW_USER_KEYBINDINGS,
          title: nls.localize2("showUserKeybindings", "Show User Keybindings"),
          menu: [
            {
              id: MenuId.EditorTitle,
              when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR),
              group: "1_keyboard_preferences_actions"
            }
          ]
        });
      }
      run(accessor, ...args) {
        const group = getEditorGroupFromArguments(accessor, args);
        const editorPane = group?.activeEditorPane;
        if (editorPane instanceof KeybindingsEditor) {
          editorPane.search("@source:user");
        }
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: KEYBINDINGS_EDITOR_COMMAND_CLEAR_SEARCH_RESULTS,
          title: nls.localize("clear", "Clear Search Results"),
          keybinding: {
            weight: KeybindingWeight.WorkbenchContrib,
            when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDINGS_SEARCH_FOCUS),
            primary: KeyCode.Escape
          }
        });
      }
      run(accessor) {
        const editorPane = accessor.get(IEditorService).activeEditorPane;
        if (editorPane instanceof KeybindingsEditor) {
          editorPane.clearSearchResults();
        }
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: KEYBINDINGS_EDITOR_COMMAND_CLEAR_SEARCH_HISTORY,
          title: nls.localize("clearHistory", "Clear Keyboard Shortcuts Search History"),
          category: category2,
          menu: [
            {
              id: MenuId.CommandPalette,
              when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR)
            }
          ]
        });
      }
      run(accessor) {
        const editorPane = accessor.get(IEditorService).activeEditorPane;
        if (editorPane instanceof KeybindingsEditor) {
          editorPane.clearKeyboardShortcutSearchHistory();
        }
      }
    }));
    this.registerKeybindingEditorActions();
  }
  registerKeybindingEditorActions() {
    const that = this;
    KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: KEYBINDINGS_EDITOR_COMMAND_DEFINE,
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDING_FOCUS, CONTEXT_WHEN_FOCUS.toNegated()),
      primary: KeyCode.Enter,
      handler: (accessor, args) => {
        const editorPane = accessor.get(IEditorService).activeEditorPane;
        if (editorPane instanceof KeybindingsEditor) {
          editorPane.defineKeybinding(editorPane.activeKeybindingEntry, false);
        }
      }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: KEYBINDINGS_EDITOR_COMMAND_ADD,
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDING_FOCUS),
      primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyA),
      handler: (accessor, args) => {
        const editorPane = accessor.get(IEditorService).activeEditorPane;
        if (editorPane instanceof KeybindingsEditor) {
          editorPane.defineKeybinding(editorPane.activeKeybindingEntry, true);
        }
      }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: KEYBINDINGS_EDITOR_COMMAND_DEFINE_WHEN,
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDING_FOCUS),
      primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyE),
      handler: (accessor, args) => {
        const editorPane = accessor.get(IEditorService).activeEditorPane;
        if (editorPane instanceof KeybindingsEditor && editorPane.activeKeybindingEntry.keybindingItem.keybinding) {
          editorPane.defineWhenExpression(editorPane.activeKeybindingEntry);
        }
      }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: KEYBINDINGS_EDITOR_COMMAND_REMOVE,
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDING_FOCUS, InputFocusedContext.toNegated()),
      primary: KeyCode.Delete,
      mac: {
        primary: KeyMod.CtrlCmd | KeyCode.Backspace
      },
      handler: (accessor, args) => {
        const editorPane = accessor.get(IEditorService).activeEditorPane;
        if (editorPane instanceof KeybindingsEditor) {
          editorPane.removeKeybinding(editorPane.activeKeybindingEntry);
        }
      }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: KEYBINDINGS_EDITOR_COMMAND_RESET,
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDING_FOCUS),
      primary: 0,
      handler: (accessor, args) => {
        const editorPane = accessor.get(IEditorService).activeEditorPane;
        if (editorPane instanceof KeybindingsEditor) {
          editorPane.resetKeybinding(editorPane.activeKeybindingEntry);
        }
      }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: KEYBINDINGS_EDITOR_COMMAND_SEARCH,
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR),
      primary: KeyMod.CtrlCmd | KeyCode.KeyF,
      handler: (accessor, args) => {
        const editorPane = accessor.get(IEditorService).activeEditorPane;
        if (editorPane instanceof KeybindingsEditor) {
          editorPane.focusSearch();
        }
      }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: KEYBINDINGS_EDITOR_COMMAND_RECORD_SEARCH_KEYS,
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDINGS_SEARCH_FOCUS),
      primary: KeyMod.Alt | KeyCode.KeyK,
      mac: { primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyK },
      handler: (accessor, args) => {
        const editorPane = accessor.get(IEditorService).activeEditorPane;
        if (editorPane instanceof KeybindingsEditor) {
          editorPane.recordSearchKeys();
        }
      }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: KEYBINDINGS_EDITOR_COMMAND_SORTBY_PRECEDENCE,
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR),
      primary: KeyMod.Alt | KeyCode.KeyP,
      mac: { primary: KeyMod.CtrlCmd | KeyMod.Alt | KeyCode.KeyP },
      handler: (accessor, args) => {
        const editorPane = accessor.get(IEditorService).activeEditorPane;
        if (editorPane instanceof KeybindingsEditor) {
          editorPane.toggleSortByPrecedence();
        }
      }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: KEYBINDINGS_EDITOR_COMMAND_SHOW_SIMILAR,
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDING_FOCUS),
      primary: 0,
      handler: (accessor, args) => {
        const editorPane = accessor.get(IEditorService).activeEditorPane;
        if (editorPane instanceof KeybindingsEditor) {
          editorPane.showSimilarKeybindings(editorPane.activeKeybindingEntry);
        }
      }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: KEYBINDINGS_EDITOR_COMMAND_COPY,
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDING_FOCUS, CONTEXT_WHEN_FOCUS.negate()),
      primary: KeyMod.CtrlCmd | KeyCode.KeyC,
      handler: async (accessor, args) => {
        const editorPane = accessor.get(IEditorService).activeEditorPane;
        if (editorPane instanceof KeybindingsEditor) {
          await editorPane.copyKeybinding(editorPane.activeKeybindingEntry);
        }
      }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: KEYBINDINGS_EDITOR_COMMAND_COPY_COMMAND,
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDING_FOCUS),
      primary: 0,
      handler: async (accessor, args) => {
        const editorPane = accessor.get(IEditorService).activeEditorPane;
        if (editorPane instanceof KeybindingsEditor) {
          await editorPane.copyKeybindingCommand(editorPane.activeKeybindingEntry);
        }
      }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: KEYBINDINGS_EDITOR_COMMAND_COPY_COMMAND_TITLE,
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDING_FOCUS),
      primary: 0,
      handler: async (accessor, args) => {
        const editorPane = accessor.get(IEditorService).activeEditorPane;
        if (editorPane instanceof KeybindingsEditor) {
          await editorPane.copyKeybindingCommandTitle(editorPane.activeKeybindingEntry);
        }
      }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: KEYBINDINGS_EDITOR_COMMAND_FOCUS_KEYBINDINGS,
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_KEYBINDINGS_SEARCH_FOCUS),
      primary: KeyMod.CtrlCmd | KeyCode.DownArrow,
      handler: (accessor, args) => {
        const editorPane = accessor.get(IEditorService).activeEditorPane;
        if (editorPane instanceof KeybindingsEditor) {
          editorPane.focusKeybindings();
        }
      }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: KEYBINDINGS_EDITOR_COMMAND_REJECT_WHEN,
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_WHEN_FOCUS, SuggestContext.Visible.toNegated()),
      primary: KeyCode.Escape,
      handler: async (accessor, args) => {
        const editorPane = accessor.get(IEditorService).activeEditorPane;
        if (editorPane instanceof KeybindingsEditor) {
          editorPane.rejectWhenExpression(editorPane.activeKeybindingEntry);
        }
      }
    });
    KeybindingsRegistry.registerCommandAndKeybindingRule({
      id: KEYBINDINGS_EDITOR_COMMAND_ACCEPT_WHEN,
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_WHEN_FOCUS, SuggestContext.Visible.toNegated()),
      primary: KeyCode.Enter,
      handler: async (accessor, args) => {
        const editorPane = accessor.get(IEditorService).activeEditorPane;
        if (editorPane instanceof KeybindingsEditor) {
          editorPane.acceptWhenExpression(editorPane.activeKeybindingEntry);
        }
      }
    });
    const profileScopedActionDisposables = this._register(new DisposableStore());
    const registerProfileScopedActions = () => {
      profileScopedActionDisposables.clear();
      profileScopedActionDisposables.add(registerAction2(class DefineKeybindingAction extends Action2 {
        constructor() {
          const when = ResourceContextKey.Resource.isEqualTo(that.userDataProfileService.currentProfile.keybindingsResource.toString());
          super({
            id: "editor.action.defineKeybinding",
            title: nls.localize2("defineKeybinding.start", "Define Keybinding"),
            f1: true,
            precondition: when,
            keybinding: {
              weight: KeybindingWeight.WorkbenchContrib,
              when,
              primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyK)
            },
            menu: {
              id: MenuId.EditorContent,
              when
            }
          });
        }
        async run(accessor) {
          const codeEditor = accessor.get(IEditorService).activeTextEditorControl;
          if (isCodeEditor(codeEditor)) {
            codeEditor.getContribution(DEFINE_KEYBINDING_EDITOR_CONTRIB_ID)?.showDefineKeybindingWidget();
          }
        }
      }));
    };
    registerProfileScopedActions();
    this._register(this.userDataProfileService.onDidChangeCurrentProfile(() => registerProfileScopedActions()));
  }
  updatePreferencesEditorMenuItem() {
    const commandId = "_workbench.openWorkspaceSettingsEditor";
    if (this.workspaceContextService.getWorkbenchState() === WorkbenchState.WORKSPACE && !CommandsRegistry.getCommand(commandId)) {
      CommandsRegistry.registerCommand(commandId, () => this.preferencesService.openWorkspaceSettings({ jsonEditor: false }));
      MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
        command: {
          id: commandId,
          title: OPEN_USER_SETTINGS_UI_TITLE,
          icon: preferencesOpenSettingsIcon
        },
        when: ContextKeyExpr.and(ResourceContextKey.Resource.isEqualTo(this.preferencesService.workspaceSettingsResource.toString()), WorkbenchStateContext.isEqualTo("workspace"), ContextKeyExpr.not("isInDiffEditor")),
        group: "navigation",
        order: 1
      });
    }
    this.updatePreferencesEditorMenuItemForWorkspaceFolders();
  }
  updatePreferencesEditorMenuItemForWorkspaceFolders() {
    for (const folder of this.workspaceContextService.getWorkspace().folders) {
      const commandId = `_workbench.openFolderSettings.${folder.uri.toString()}`;
      if (!CommandsRegistry.getCommand(commandId)) {
        CommandsRegistry.registerCommand(commandId, (accessor, ...args) => {
          const groupId = getEditorGroupFromArguments(accessor, args)?.id;
          if (this.workspaceContextService.getWorkbenchState() === WorkbenchState.FOLDER) {
            return this.preferencesService.openWorkspaceSettings({ jsonEditor: false, groupId });
          } else {
            return this.preferencesService.openFolderSettings({ folderUri: folder.uri, jsonEditor: false, groupId });
          }
        });
        MenuRegistry.appendMenuItem(MenuId.EditorTitle, {
          command: {
            id: commandId,
            title: OPEN_USER_SETTINGS_UI_TITLE,
            icon: preferencesOpenSettingsIcon
          },
          when: ContextKeyExpr.and(ResourceContextKey.Resource.isEqualTo(this.preferencesService.getFolderSettingsResource(folder.uri).toString()), ContextKeyExpr.not("isInDiffEditor")),
          group: "navigation",
          order: 1
        });
      }
    }
  }
};
PreferencesActionsContribution.ID = "workbench.contrib.preferencesActions";
PreferencesActionsContribution = __decorateClass([
  __decorateParam(0, IWorkbenchEnvironmentService),
  __decorateParam(1, IUserDataProfileService),
  __decorateParam(2, IPreferencesService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, ILabelService),
  __decorateParam(5, IExtensionService),
  __decorateParam(6, IUserDataProfilesService)
], PreferencesActionsContribution);
let SettingsEditorTitleContribution = class extends Disposable {
  constructor(userDataProfileService, userDataProfilesService) {
    super();
    this.userDataProfileService = userDataProfileService;
    this.userDataProfilesService = userDataProfilesService;
    this.registerSettingsEditorTitleActions();
  }
  registerSettingsEditorTitleActions() {
    const registerOpenUserSettingsEditorFromJsonActionDisposables = this._register(new MutableDisposable());
    const registerOpenUserSettingsEditorFromJsonAction = () => {
      const openUserSettingsEditorWhen = ContextKeyExpr.and(
        CONTEXT_SETTINGS_EDITOR.toNegated(),
        ContextKeyExpr.or(
          ResourceContextKey.Resource.isEqualTo(this.userDataProfileService.currentProfile.settingsResource.toString()),
          ResourceContextKey.Resource.isEqualTo(this.userDataProfilesService.defaultProfile.settingsResource.toString())
        ),
        ContextKeyExpr.not("isInDiffEditor")
      );
      registerOpenUserSettingsEditorFromJsonActionDisposables.value = registerAction2(class extends Action2 {
        constructor() {
          super({
            id: "_workbench.openUserSettingsEditor",
            title: OPEN_USER_SETTINGS_UI_TITLE,
            icon: preferencesOpenSettingsIcon,
            menu: [{
              id: MenuId.EditorTitle,
              when: openUserSettingsEditorWhen,
              group: "navigation",
              order: 1
            }]
          });
        }
        run(accessor, ...args) {
          const sanitizedArgs = sanitizeOpenSettingsArgs(args[0]);
          const groupId = getEditorGroupFromArguments(accessor, args)?.id;
          return accessor.get(IPreferencesService).openUserSettings({ jsonEditor: false, ...sanitizedArgs, groupId });
        }
      });
    };
    registerOpenUserSettingsEditorFromJsonAction();
    this._register(this.userDataProfileService.onDidChangeCurrentProfile(() => {
      registerOpenUserSettingsEditorFromJsonAction();
    }));
    const openSettingsJsonWhen = ContextKeyExpr.and(CONTEXT_SETTINGS_JSON_EDITOR.toNegated(), CONTEXT_SETTINGS_EDITOR);
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: SETTINGS_EDITOR_COMMAND_SWITCH_TO_JSON,
          title: nls.localize2("openSettingsJson", "Open Settings (JSON)"),
          icon: preferencesOpenSettingsIcon,
          menu: [{
            id: MenuId.EditorTitle,
            when: openSettingsJsonWhen,
            group: "navigation",
            order: 1
          }]
        });
      }
      run(accessor, ...args) {
        const group = getEditorGroupFromArguments(accessor, args);
        const editorPane = group?.activeEditorPane;
        if (editorPane instanceof SettingsEditor2) {
          return editorPane.switchToSettingsFile();
        }
        return null;
      }
    }));
  }
};
SettingsEditorTitleContribution.ID = "workbench.contrib.settingsEditorTitleBarActions";
SettingsEditorTitleContribution = __decorateClass([
  __decorateParam(0, IUserDataProfileService),
  __decorateParam(1, IUserDataProfilesService)
], SettingsEditorTitleContribution);
function getEditorGroupFromArguments(accessor, args) {
  const context = resolveCommandsContext(args, accessor.get(IEditorService), accessor.get(IEditorGroupsService), accessor.get(IListService));
  return context.groupedEditors[0]?.group;
}
registerWorkbenchContribution2(PreferencesActionsContribution.ID, PreferencesActionsContribution, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(PreferencesContribution.ID, PreferencesContribution, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(SettingsEditorTitleContribution.ID, SettingsEditorTitleContribution, WorkbenchPhase.AfterRestored);
registerEditorContribution(SettingsEditorContribution.ID, SettingsEditorContribution, EditorContributionInstantiation.AfterFirstRender);
MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
  title: nls.localize({ key: "miPreferences", comment: ["&& denotes a mnemonic"] }, "&&Preferences"),
  submenu: MenuId.MenubarPreferencesMenu,
  group: "5_autosave",
  order: 2,
  when: IsMacNativeContext.toNegated()
  // on macOS native the preferences menu is separate under the application menu
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wcmVmZXJlbmNlcy9icm93c2VyL3ByZWZlcmVuY2VzLmNvbnRyaWJ1dGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEtleUNob3JkLCBLZXlDb2RlLCBLZXlNb2QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGlzQm9vbGVhbiwgaXNPYmplY3QsIGlzU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCAnLi9tZWRpYS9wcmVmZXJlbmNlcy5jc3MnO1xuaW1wb3J0IHsgRWRpdG9yQ29udHJpYnV0aW9uSW5zdGFudGlhdGlvbiwgcmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IENvbnRleHQgYXMgU3VnZ2VzdENvbnRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvc3VnZ2VzdC5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEFjdGlvbjIsIE1lbnVJZCwgTWVudVJlZ2lzdHJ5LCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IENvbW1hbmRzUmVnaXN0cnksIElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSW5wdXRGb2N1c2VkQ29udGV4dCwgSXNNYWNOYXRpdmVDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgU3luY0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEtleWJpbmRpbmdzUmVnaXN0cnksIEtleWJpbmRpbmdXZWlnaHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBJV29ya3NwYWNlRm9sZGVyLCBXb3JrYmVuY2hTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IFBJQ0tfV09SS1NQQUNFX0ZPTERFUl9DT01NQU5EX0lEIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9hY3Rpb25zL3dvcmtzcGFjZUNvbW1hbmRzLmpzJztcbmltcG9ydCB7IEVkaXRvclBhbmVEZXNjcmlwdG9yLCBJRWRpdG9yUGFuZVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiwgV29ya2JlbmNoUGhhc2UsIHJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IEVkaXRvckV4dGVuc2lvbnMsIElFZGl0b3JGYWN0b3J5UmVnaXN0cnksIElFZGl0b3JTZXJpYWxpemVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VDb250ZXh0S2V5LCBSZW1vdGVOYW1lQ29udGV4dCwgV29ya2JlbmNoU3RhdGVDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRleHRrZXlzLmpzJztcbmltcG9ydCB7IEV4cGxvcmVyRm9sZGVyQ29udGV4dCwgRXhwbG9yZXJSb290Q29udGV4dCB9IGZyb20gJy4uLy4uL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nc0VkaXRvciB9IGZyb20gJy4va2V5YmluZGluZ3NFZGl0b3IuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJlTGFuZ3VhZ2VCYXNlZFNldHRpbmdzQWN0aW9uIH0gZnJvbSAnLi9wcmVmZXJlbmNlc0FjdGlvbnMuanMnO1xuaW1wb3J0IHsgU2V0dGluZ3NFZGl0b3JDb250cmlidXRpb24gfSBmcm9tICcuL3ByZWZlcmVuY2VzRWRpdG9yLmpzJztcbmltcG9ydCB7IHByZWZlcmVuY2VzT3BlblNldHRpbmdzSWNvbiB9IGZyb20gJy4vcHJlZmVyZW5jZXNJY29ucy5qcyc7XG5pbXBvcnQgeyBTZXR0aW5nc0VkaXRvcjIsIFNldHRpbmdzRm9jdXNDb250ZXh0IH0gZnJvbSAnLi9zZXR0aW5nc0VkaXRvcjIuanMnO1xuaW1wb3J0IHsgQ09OVEVYVF9LRVlCSU5ESU5HU19FRElUT1IsIENPTlRFWFRfS0VZQklORElOR1NfU0VBUkNIX0ZPQ1VTLCBDT05URVhUX0tFWUJJTkRJTkdfRk9DVVMsIENPTlRFWFRfU0VUVElOR1NfRURJVE9SLCBDT05URVhUX1NFVFRJTkdTX0pTT05fRURJVE9SLCBDT05URVhUX1NFVFRJTkdTX1JPV19GT0NVUywgQ09OVEVYVF9TRVRUSU5HU19TRUFSQ0hfRk9DVVMsIENPTlRFWFRfVE9DX1JPV19GT0NVUywgQ09OVEVYVF9XSEVOX0ZPQ1VTLCBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9BQ0NFUFRfV0hFTiwgS0VZQklORElOR1NfRURJVE9SX0NPTU1BTkRfQURELCBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9DTEVBUl9TRUFSQ0hfSElTVE9SWSwgS0VZQklORElOR1NfRURJVE9SX0NPTU1BTkRfQ0xFQVJfU0VBUkNIX1JFU1VMVFMsIEtFWUJJTkRJTkdTX0VESVRPUl9DT01NQU5EX0NPUFksIEtFWUJJTkRJTkdTX0VESVRPUl9DT01NQU5EX0NPUFlfQ09NTUFORCwgS0VZQklORElOR1NfRURJVE9SX0NPTU1BTkRfQ09QWV9DT01NQU5EX1RJVExFLCBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9ERUZJTkUsIEtFWUJJTkRJTkdTX0VESVRPUl9DT01NQU5EX0RFRklORV9XSEVOLCBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9GT0NVU19LRVlCSU5ESU5HUywgS0VZQklORElOR1NfRURJVE9SX0NPTU1BTkRfUkVDT1JEX1NFQVJDSF9LRVlTLCBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9SRUpFQ1RfV0hFTiwgS0VZQklORElOR1NfRURJVE9SX0NPTU1BTkRfUkVNT1ZFLCBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9SRVNFVCwgS0VZQklORElOR1NfRURJVE9SX0NPTU1BTkRfU0VBUkNILCBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9TSE9XX1NJTUlMQVIsIEtFWUJJTkRJTkdTX0VESVRPUl9DT01NQU5EX1NPUlRCWV9QUkVDRURFTkNFLCBLRVlCSU5ESU5HU19FRElUT1JfU0hPV19ERUZBVUxUX0tFWUJJTkRJTkdTLCBLRVlCSU5ESU5HU19FRElUT1JfU0hPV19FWFRFTlNJT05fS0VZQklORElOR1MsIEtFWUJJTkRJTkdTX0VESVRPUl9TSE9XX1VTRVJfS0VZQklORElOR1MsIFJFUVVJUkVfVFJVU1RFRF9XT1JLU1BBQ0VfU0VUVElOR19UQUcsIFNFVFRJTkdTX0VESVRPUl9DT01NQU5EX0NMRUFSX1NFQVJDSF9SRVNVTFRTLCBTRVRUSU5HU19FRElUT1JfQ09NTUFORF9TSE9XX0NPTlRFWFRfTUVOVSB9IGZyb20gJy4uL2NvbW1vbi9wcmVmZXJlbmNlcy5qcyc7XG5pbXBvcnQgeyBQcmVmZXJlbmNlc0NvbnRyaWJ1dGlvbiB9IGZyb20gJy4uL2NvbW1vbi9wcmVmZXJlbmNlc0NvbnRyaWJ1dGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ3NFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ByZWZlcmVuY2VzL2Jyb3dzZXIva2V5YmluZGluZ3NFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBERUZJTkVfS0VZQklORElOR19FRElUT1JfQ09OVFJJQl9JRCwgSURlZmluZUtleWJpbmRpbmdFZGl0b3JDb250cmlidXRpb24sIElQcmVmZXJlbmNlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXMuanMnO1xuaW1wb3J0IHsgU2V0dGluZ3NFZGl0b3IySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXNFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlU2VydmljZSwgQ1VSUkVOVF9QUk9GSUxFX0NPTlRFWFQgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBpc0NvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IENhdGVnb3JpZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbkNvbW1vbkNhdGVnb3JpZXMuanMnO1xuaW1wb3J0IHsgcmVzb2x2ZUNvbW1hbmRzQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvckNvbW1hbmRzQ29udGV4dC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXAsIElFZGl0b3JHcm91cHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMaXN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5cbmNvbnN0IFNFVFRJTkdTX0VESVRPUl9DT01NQU5EX1NFQVJDSCA9ICdzZXR0aW5ncy5hY3Rpb24uc2VhcmNoJztcblxuY29uc3QgU0VUVElOR1NfRURJVE9SX0NPTU1BTkRfRk9DVVNfRklMRSA9ICdzZXR0aW5ncy5hY3Rpb24uZm9jdXNTZXR0aW5nc0ZpbGUnO1xuY29uc3QgU0VUVElOR1NfRURJVE9SX0NPTU1BTkRfRk9DVVNfU0VUVElOR1NfRlJPTV9TRUFSQ0ggPSAnc2V0dGluZ3MuYWN0aW9uLmZvY3VzU2V0dGluZ3NGcm9tU2VhcmNoJztcbmNvbnN0IFNFVFRJTkdTX0VESVRPUl9DT01NQU5EX0ZPQ1VTX1NFVFRJTkdTX0xJU1QgPSAnc2V0dGluZ3MuYWN0aW9uLmZvY3VzU2V0dGluZ3NMaXN0JztcbmNvbnN0IFNFVFRJTkdTX0VESVRPUl9DT01NQU5EX0ZPQ1VTX1RPQyA9ICdzZXR0aW5ncy5hY3Rpb24uZm9jdXNUT0MnO1xuY29uc3QgU0VUVElOR1NfRURJVE9SX0NPTU1BTkRfRk9DVVNfQ09OVFJPTCA9ICdzZXR0aW5ncy5hY3Rpb24uZm9jdXNTZXR0aW5nQ29udHJvbCc7XG5jb25zdCBTRVRUSU5HU19FRElUT1JfQ09NTUFORF9GT0NVU19VUCA9ICdzZXR0aW5ncy5hY3Rpb24uZm9jdXNMZXZlbFVwJztcblxuY29uc3QgU0VUVElOR1NfRURJVE9SX0NPTU1BTkRfU1dJVENIX1RPX0pTT04gPSAnc2V0dGluZ3Muc3dpdGNoVG9KU09OJztcbmNvbnN0IFNFVFRJTkdTX0VESVRPUl9DT01NQU5EX0ZJTFRFUl9PTkxJTkUgPSAnc2V0dGluZ3MuZmlsdGVyQnlPbmxpbmUnO1xuY29uc3QgU0VUVElOR1NfRURJVE9SX0NPTU1BTkRfRklMVEVSX1VOVFJVU1RFRCA9ICdzZXR0aW5ncy5maWx0ZXJVbnRydXN0ZWQnO1xuXG5jb25zdCBTRVRUSU5HU19DT01NQU5EX09QRU5fU0VUVElOR1MgPSAnd29ya2JlbmNoLmFjdGlvbi5vcGVuU2V0dGluZ3MnO1xuY29uc3QgU0VUVElOR1NfQ09NTUFORF9GSUxURVJfVEVMRU1FVFJZID0gJ3NldHRpbmdzLmZpbHRlckJ5VGVsZW1ldHJ5JztcblxuUmVnaXN0cnkuYXM8SUVkaXRvclBhbmVSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JQYW5lKS5yZWdpc3RlckVkaXRvclBhbmUoXG5cdEVkaXRvclBhbmVEZXNjcmlwdG9yLmNyZWF0ZShcblx0XHRTZXR0aW5nc0VkaXRvcjIsXG5cdFx0U2V0dGluZ3NFZGl0b3IyLklELFxuXHRcdG5scy5sb2NhbGl6ZSgnc2V0dGluZ3NFZGl0b3IyJywgXCJTZXR0aW5ncyBFZGl0b3IgMlwiKVxuXHQpLFxuXHRbXG5cdFx0bmV3IFN5bmNEZXNjcmlwdG9yKFNldHRpbmdzRWRpdG9yMklucHV0KVxuXHRdXG4pO1xuXG5SZWdpc3RyeS5hczxJRWRpdG9yUGFuZVJlZ2lzdHJ5PihFZGl0b3JFeHRlbnNpb25zLkVkaXRvclBhbmUpLnJlZ2lzdGVyRWRpdG9yUGFuZShcblx0RWRpdG9yUGFuZURlc2NyaXB0b3IuY3JlYXRlKFxuXHRcdEtleWJpbmRpbmdzRWRpdG9yLFxuXHRcdEtleWJpbmRpbmdzRWRpdG9yLklELFxuXHRcdG5scy5sb2NhbGl6ZSgna2V5YmluZGluZ3NFZGl0b3InLCBcIktleWJpbmRpbmdzIEVkaXRvclwiKVxuXHQpLFxuXHRbXG5cdFx0bmV3IFN5bmNEZXNjcmlwdG9yKEtleWJpbmRpbmdzRWRpdG9ySW5wdXQpXG5cdF1cbik7XG5cbmNsYXNzIEtleWJpbmRpbmdzRWRpdG9ySW5wdXRTZXJpYWxpemVyIGltcGxlbWVudHMgSUVkaXRvclNlcmlhbGl6ZXIge1xuXG5cdGNhblNlcmlhbGl6ZShlZGl0b3JJbnB1dDogRWRpdG9ySW5wdXQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHNlcmlhbGl6ZShlZGl0b3JJbnB1dDogRWRpdG9ySW5wdXQpOiBzdHJpbmcge1xuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdGRlc2VyaWFsaXplKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpOiBFZGl0b3JJbnB1dCB7XG5cdFx0cmV0dXJuIGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEtleWJpbmRpbmdzRWRpdG9ySW5wdXQpO1xuXHR9XG59XG5cbmNsYXNzIFNldHRpbmdzRWRpdG9yMklucHV0U2VyaWFsaXplciBpbXBsZW1lbnRzIElFZGl0b3JTZXJpYWxpemVyIHtcblxuXHRjYW5TZXJpYWxpemUoZWRpdG9ySW5wdXQ6IEVkaXRvcklucHV0KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRzZXJpYWxpemUoaW5wdXQ6IFNldHRpbmdzRWRpdG9yMklucHV0KTogc3RyaW5nIHtcblx0XHRyZXR1cm4gJyc7XG5cdH1cblxuXHRkZXNlcmlhbGl6ZShpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlKTogU2V0dGluZ3NFZGl0b3IySW5wdXQge1xuXHRcdHJldHVybiBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZXR0aW5nc0VkaXRvcjJJbnB1dCk7XG5cdH1cbn1cblxuUmVnaXN0cnkuYXM8SUVkaXRvckZhY3RvcnlSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JGYWN0b3J5KS5yZWdpc3RlckVkaXRvclNlcmlhbGl6ZXIoS2V5YmluZGluZ3NFZGl0b3JJbnB1dC5JRCwgS2V5YmluZGluZ3NFZGl0b3JJbnB1dFNlcmlhbGl6ZXIpO1xuUmVnaXN0cnkuYXM8SUVkaXRvckZhY3RvcnlSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JGYWN0b3J5KS5yZWdpc3RlckVkaXRvclNlcmlhbGl6ZXIoU2V0dGluZ3NFZGl0b3IySW5wdXQuSUQsIFNldHRpbmdzRWRpdG9yMklucHV0U2VyaWFsaXplcik7XG5cbmNvbnN0IE9QRU5fVVNFUl9TRVRUSU5HU19VSV9USVRMRSA9IG5scy5sb2NhbGl6ZTIoJ29wZW5TZXR0aW5nczInLCBcIk9wZW4gU2V0dGluZ3MgKFVJKVwiKTtcbmNvbnN0IE9QRU5fVVNFUl9TRVRUSU5HU19KU09OX1RJVExFID0gbmxzLmxvY2FsaXplMignb3BlblVzZXJTZXR0aW5nc0pzb24nLCBcIk9wZW4gVXNlciBTZXR0aW5ncyAoSlNPTilcIik7XG5jb25zdCBPUEVOX0FQUExJQ0FUSU9OX1NFVFRJTkdTX0pTT05fVElUTEUgPSBubHMubG9jYWxpemUyKCdvcGVuQXBwbGljYXRpb25TZXR0aW5nc0pzb24nLCBcIk9wZW4gQXBwbGljYXRpb24gU2V0dGluZ3MgKEpTT04pXCIpO1xuY29uc3QgY2F0ZWdvcnkgPSBDYXRlZ29yaWVzLlByZWZlcmVuY2VzO1xuXG5pbnRlcmZhY2UgSU9wZW5TZXR0aW5nc0FjdGlvbk9wdGlvbnMge1xuXHRvcGVuVG9TaWRlPzogYm9vbGVhbjtcblx0cXVlcnk/OiBzdHJpbmc7XG5cdHJldmVhbFNldHRpbmc/OiB7XG5cdFx0a2V5OiBzdHJpbmc7XG5cdFx0ZWRpdD86IGJvb2xlYW47XG5cdH07XG5cdGZvY3VzU2VhcmNoPzogYm9vbGVhbjtcbn1cblxuZnVuY3Rpb24gc2FuaXRpemVCb29sZWFuKGFyZzogYW55KTogYm9vbGVhbiB8IHVuZGVmaW5lZCB7XG5cdHJldHVybiBpc0Jvb2xlYW4oYXJnKSA/IGFyZyA6IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gc2FuaXRpemVTdHJpbmcoYXJnOiBhbnkpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRyZXR1cm4gaXNTdHJpbmcoYXJnKSA/IGFyZyA6IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gc2FuaXRpemVPcGVuU2V0dGluZ3NBcmdzKGFyZ3M6IGFueSk6IElPcGVuU2V0dGluZ3NBY3Rpb25PcHRpb25zIHtcblx0aWYgKCFpc09iamVjdChhcmdzKSkge1xuXHRcdGFyZ3MgPSB7fTtcblx0fVxuXG5cdGxldCBzYW5pdGl6ZWRPYmplY3Q6IElPcGVuU2V0dGluZ3NBY3Rpb25PcHRpb25zID0ge1xuXHRcdGZvY3VzU2VhcmNoOiBzYW5pdGl6ZUJvb2xlYW4oYXJncz8uZm9jdXNTZWFyY2gpLFxuXHRcdG9wZW5Ub1NpZGU6IHNhbml0aXplQm9vbGVhbihhcmdzPy5vcGVuVG9TaWRlKSxcblx0XHRxdWVyeTogc2FuaXRpemVTdHJpbmcoYXJncz8ucXVlcnkpXG5cdH07XG5cblx0aWYgKGlzU3RyaW5nKGFyZ3M/LnJldmVhbFNldHRpbmc/LmtleSkpIHtcblx0XHRzYW5pdGl6ZWRPYmplY3QgPSB7XG5cdFx0XHQuLi5zYW5pdGl6ZWRPYmplY3QsXG5cdFx0XHRyZXZlYWxTZXR0aW5nOiB7XG5cdFx0XHRcdGtleTogYXJncy5yZXZlYWxTZXR0aW5nLmtleSxcblx0XHRcdFx0ZWRpdDogc2FuaXRpemVCb29sZWFuKGFyZ3MucmV2ZWFsU2V0dGluZz8uZWRpdClcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0cmV0dXJuIHNhbml0aXplZE9iamVjdDtcbn1cblxuY2xhc3MgUHJlZmVyZW5jZXNBY3Rpb25zQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guY29udHJpYi5wcmVmZXJlbmNlc0FjdGlvbnMnO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZVNlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlLFxuXHRcdEBJUHJlZmVyZW5jZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJlZmVyZW5jZXNTZXJ2aWNlOiBJUHJlZmVyZW5jZXNTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVzU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5yZWdpc3RlclNldHRpbmdzQWN0aW9ucygpO1xuXHRcdHRoaXMucmVnaXN0ZXJLZXliaW5kaW5nc0FjdGlvbnMoKTtcblxuXHRcdHRoaXMudXBkYXRlUHJlZmVyZW5jZXNFZGl0b3JNZW51SXRlbSgpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLm9uRGlkQ2hhbmdlV29ya2JlbmNoU3RhdGUoKCkgPT4gdGhpcy51cGRhdGVQcmVmZXJlbmNlc0VkaXRvck1lbnVJdGVtKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih3b3Jrc3BhY2VDb250ZXh0U2VydmljZS5vbkRpZENoYW5nZVdvcmtzcGFjZUZvbGRlcnMoKCkgPT4gdGhpcy51cGRhdGVQcmVmZXJlbmNlc0VkaXRvck1lbnVJdGVtRm9yV29ya3NwYWNlRm9sZGVycygpKSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyU2V0dGluZ3NBY3Rpb25zKCkge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogU0VUVElOR1NfQ09NTUFORF9PUEVOX1NFVFRJTkdTLFxuXHRcdFx0XHRcdHRpdGxlOiB7XG5cdFx0XHRcdFx0XHQuLi5ubHMubG9jYWxpemUyKCdzZXR0aW5ncycsIFwiU2V0dGluZ3NcIiksXG5cdFx0XHRcdFx0XHRtbmVtb25pY1RpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaU9wZW5TZXR0aW5ncycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlNldHRpbmdzXCIpLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdFx0XHR3aGVuOiBudWxsLFxuXHRcdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLkNvbW1hLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0bWVudTogW3tcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuR2xvYmFsQWN0aXZpdHksXG5cdFx0XHRcdFx0XHRncm91cDogJzJfY29uZmlndXJhdGlvbicsXG5cdFx0XHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuTWVudWJhclByZWZlcmVuY2VzTWVudSxcblx0XHRcdFx0XHRcdGdyb3VwOiAnMl9jb25maWd1cmF0aW9uJyxcblx0XHRcdFx0XHRcdG9yZGVyOiAyXG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBhcmdzOiBzdHJpbmcgfCBJT3BlblNldHRpbmdzQWN0aW9uT3B0aW9ucykge1xuXHRcdFx0XHQvLyBhcmdzIHRha2VzIGEgc3RyaW5nIGZvciBiYWNrY29tcGF0XG5cdFx0XHRcdGNvbnN0IG9wdHMgPSB0eXBlb2YgYXJncyA9PT0gJ3N0cmluZycgPyB7IHF1ZXJ5OiBhcmdzIH0gOiBzYW5pdGl6ZU9wZW5TZXR0aW5nc0FyZ3MoYXJncyk7XG5cdFx0XHRcdHJldHVybiBhY2Nlc3Nvci5nZXQoSVByZWZlcmVuY2VzU2VydmljZSkub3BlblNldHRpbmdzKG9wdHMpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm9wZW5TZXR0aW5nczInLFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdvcGVuU2V0dGluZ3MyJywgXCJPcGVuIFNldHRpbmdzIChVSSlcIiksXG5cdFx0XHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBhcmdzOiBJT3BlblNldHRpbmdzQWN0aW9uT3B0aW9ucykge1xuXHRcdFx0XHRhcmdzID0gc2FuaXRpemVPcGVuU2V0dGluZ3NBcmdzKGFyZ3MpO1xuXHRcdFx0XHRyZXR1cm4gYWNjZXNzb3IuZ2V0KElQcmVmZXJlbmNlc1NlcnZpY2UpLm9wZW5TZXR0aW5ncyh7IGpzb25FZGl0b3I6IGZhbHNlLCAuLi5hcmdzIH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ub3BlblNldHRpbmdzSnNvbicsXG5cdFx0XHRcdFx0dGl0bGU6IE9QRU5fVVNFUl9TRVRUSU5HU19KU09OX1RJVExFLFxuXHRcdFx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplMignd29ya2JlbmNoLmFjdGlvbi5vcGVuU2V0dGluZ3NKc29uLmRlc2NyaXB0aW9uJywgXCJPcGVucyB0aGUgSlNPTiBmaWxlIGNvbnRhaW5pbmcgdGhlIGN1cnJlbnQgdXNlciBwcm9maWxlIHNldHRpbmdzXCIpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRjYXRlZ29yeSxcblx0XHRcdFx0XHRmMTogdHJ1ZSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGFyZ3M6IElPcGVuU2V0dGluZ3NBY3Rpb25PcHRpb25zKSB7XG5cdFx0XHRcdGFyZ3MgPSBzYW5pdGl6ZU9wZW5TZXR0aW5nc0FyZ3MoYXJncyk7XG5cdFx0XHRcdHJldHVybiBhY2Nlc3Nvci5nZXQoSVByZWZlcmVuY2VzU2VydmljZSkub3BlblNldHRpbmdzKHsganNvbkVkaXRvcjogdHJ1ZSwgLi4uYXJncyB9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm9wZW5BcHBsaWNhdGlvblNldHRpbmdzSnNvbicsXG5cdFx0XHRcdFx0dGl0bGU6IE9QRU5fQVBQTElDQVRJT05fU0VUVElOR1NfSlNPTl9USVRMRSxcblx0XHRcdFx0XHRjYXRlZ29yeSxcblx0XHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIubm90RXF1YWxzKENVUlJFTlRfUFJPRklMRV9DT05URVhULmtleSwgdGhhdC51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5pZClcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBhcmdzOiBJT3BlblNldHRpbmdzQWN0aW9uT3B0aW9ucykge1xuXHRcdFx0XHRhcmdzID0gc2FuaXRpemVPcGVuU2V0dGluZ3NBcmdzKGFyZ3MpO1xuXHRcdFx0XHRyZXR1cm4gYWNjZXNzb3IuZ2V0KElQcmVmZXJlbmNlc1NlcnZpY2UpLm9wZW5BcHBsaWNhdGlvblNldHRpbmdzKHsganNvbkVkaXRvcjogdHJ1ZSwgLi4uYXJncyB9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBPcGVucyB0aGUgVXNlciB0YWIgb2YgdGhlIFNldHRpbmdzIGVkaXRvclxuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ub3Blbkdsb2JhbFNldHRpbmdzJyxcblx0XHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignb3Blbkdsb2JhbFNldHRpbmdzJywgXCJPcGVuIFVzZXIgU2V0dGluZ3NcIiksXG5cdFx0XHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBhcmdzOiBJT3BlblNldHRpbmdzQWN0aW9uT3B0aW9ucykge1xuXHRcdFx0XHRhcmdzID0gc2FuaXRpemVPcGVuU2V0dGluZ3NBcmdzKGFyZ3MpO1xuXHRcdFx0XHRyZXR1cm4gYWNjZXNzb3IuZ2V0KElQcmVmZXJlbmNlc1NlcnZpY2UpLm9wZW5Vc2VyU2V0dGluZ3MoYXJncyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ub3BlblJhd0RlZmF1bHRTZXR0aW5ncycsXG5cdFx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ29wZW5SYXdEZWZhdWx0U2V0dGluZ3MnLCBcIk9wZW4gRGVmYXVsdCBTZXR0aW5ncyAoSlNPTilcIiksXG5cdFx0XHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0XHRcdHJldHVybiBhY2Nlc3Nvci5nZXQoSVByZWZlcmVuY2VzU2VydmljZSkub3BlblJhd0RlZmF1bHRTZXR0aW5ncygpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogQ29uZmlndXJlTGFuZ3VhZ2VCYXNlZFNldHRpbmdzQWN0aW9uLklELFxuXHRcdFx0XHRcdHRpdGxlOiBDb25maWd1cmVMYW5ndWFnZUJhc2VkU2V0dGluZ3NBY3Rpb24uTEFCRUwsXG5cdFx0XHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0XHRcdHJldHVybiBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKS5jcmVhdGVJbnN0YW5jZShDb25maWd1cmVMYW5ndWFnZUJhc2VkU2V0dGluZ3NBY3Rpb24sIENvbmZpZ3VyZUxhbmd1YWdlQmFzZWRTZXR0aW5nc0FjdGlvbi5JRCwgQ29uZmlndXJlTGFuZ3VhZ2VCYXNlZFNldHRpbmdzQWN0aW9uLkxBQkVMLnZhbHVlKS5ydW4oKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5vcGVuV29ya3NwYWNlU2V0dGluZ3MnLFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdvcGVuV29ya3NwYWNlU2V0dGluZ3MnLCBcIk9wZW4gV29ya3NwYWNlIFNldHRpbmdzXCIpLFxuXHRcdFx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdFx0XHR3aGVuOiBXb3JrYmVuY2hTdGF0ZUNvbnRleHQubm90RXF1YWxzVG8oJ2VtcHR5Jylcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBhcmdzPzogc3RyaW5nIHwgSU9wZW5TZXR0aW5nc0FjdGlvbk9wdGlvbnMpIHtcblx0XHRcdFx0Ly8gTWF0Y2ggdGhlIGJlaGF2aW91ciBvZiB3b3JrYmVuY2guYWN0aW9uLm9wZW5TZXR0aW5nc1xuXHRcdFx0XHRhcmdzID0gdHlwZW9mIGFyZ3MgPT09ICdzdHJpbmcnID8geyBxdWVyeTogYXJncyB9IDogc2FuaXRpemVPcGVuU2V0dGluZ3NBcmdzKGFyZ3MpO1xuXHRcdFx0XHRyZXR1cm4gYWNjZXNzb3IuZ2V0KElQcmVmZXJlbmNlc1NlcnZpY2UpLm9wZW5Xb3Jrc3BhY2VTZXR0aW5ncyhhcmdzKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm9wZW5BY2Nlc3NpYmlsaXR5U2V0dGluZ3MnLFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdvcGVuQWNjZXNzaWJpbGl0eVNldHRpbmdzJywgXCJPcGVuIEFjY2Vzc2liaWxpdHkgU2V0dGluZ3NcIiksXG5cdFx0XHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRcdFx0bWVudToge1xuXHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0XHRcdHdoZW46IFdvcmtiZW5jaFN0YXRlQ29udGV4dC5ub3RFcXVhbHNUbygnZW1wdHknKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRcdFx0YXdhaXQgYWNjZXNzb3IuZ2V0KElQcmVmZXJlbmNlc1NlcnZpY2UpLm9wZW5TZXR0aW5ncyh7IGpzb25FZGl0b3I6IGZhbHNlLCBxdWVyeTogJ0B0YWc6YWNjZXNzaWJpbGl0eScgfSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ub3BlbldvcmtzcGFjZVNldHRpbmdzRmlsZScsXG5cdFx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ29wZW5Xb3Jrc3BhY2VTZXR0aW5nc0ZpbGUnLCBcIk9wZW4gV29ya3NwYWNlIFNldHRpbmdzIChKU09OKVwiKSxcblx0XHRcdFx0XHRjYXRlZ29yeSxcblx0XHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHRcdFx0d2hlbjogV29ya2JlbmNoU3RhdGVDb250ZXh0Lm5vdEVxdWFsc1RvKCdlbXB0eScpXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJncz86IElPcGVuU2V0dGluZ3NBY3Rpb25PcHRpb25zKSB7XG5cdFx0XHRcdGFyZ3MgPSBzYW5pdGl6ZU9wZW5TZXR0aW5nc0FyZ3MoYXJncyk7XG5cdFx0XHRcdHJldHVybiBhY2Nlc3Nvci5nZXQoSVByZWZlcmVuY2VzU2VydmljZSkub3BlbldvcmtzcGFjZVNldHRpbmdzKHsganNvbkVkaXRvcjogdHJ1ZSwgLi4uYXJncyB9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5vcGVuRm9sZGVyU2V0dGluZ3MnLFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdvcGVuRm9sZGVyU2V0dGluZ3MnLCBcIk9wZW4gRm9sZGVyIFNldHRpbmdzXCIpLFxuXHRcdFx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdFx0XHR3aGVuOiBXb3JrYmVuY2hTdGF0ZUNvbnRleHQuaXNFcXVhbFRvKCd3b3Jrc3BhY2UnKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGFyZ3M/OiBJT3BlblNldHRpbmdzQWN0aW9uT3B0aW9ucykge1xuXHRcdFx0XHRjb25zdCBjb21tYW5kU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBwcmVmZXJlbmNlc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVByZWZlcmVuY2VzU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlciA9IGF3YWl0IGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kPElXb3Jrc3BhY2VGb2xkZXI+KFBJQ0tfV09SS1NQQUNFX0ZPTERFUl9DT01NQU5EX0lEKTtcblx0XHRcdFx0aWYgKHdvcmtzcGFjZUZvbGRlcikge1xuXHRcdFx0XHRcdGFyZ3MgPSBzYW5pdGl6ZU9wZW5TZXR0aW5nc0FyZ3MoYXJncyk7XG5cdFx0XHRcdFx0YXdhaXQgcHJlZmVyZW5jZXNTZXJ2aWNlLm9wZW5Gb2xkZXJTZXR0aW5ncyh7IGZvbGRlclVyaTogd29ya3NwYWNlRm9sZGVyLnVyaSwgLi4uYXJncyB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm9wZW5Gb2xkZXJTZXR0aW5nc0ZpbGUnLFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdvcGVuRm9sZGVyU2V0dGluZ3NGaWxlJywgXCJPcGVuIEZvbGRlciBTZXR0aW5ncyAoSlNPTilcIiksXG5cdFx0XHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRcdFx0bWVudToge1xuXHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0XHRcdHdoZW46IFdvcmtiZW5jaFN0YXRlQ29udGV4dC5pc0VxdWFsVG8oJ3dvcmtzcGFjZScpXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJncz86IElPcGVuU2V0dGluZ3NBY3Rpb25PcHRpb25zKSB7XG5cdFx0XHRcdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IHByZWZlcmVuY2VzU2VydmljZSA9IGFjY2Vzc29yLmdldChJUHJlZmVyZW5jZXNTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3Qgd29ya3NwYWNlRm9sZGVyID0gYXdhaXQgY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQ8SVdvcmtzcGFjZUZvbGRlcj4oUElDS19XT1JLU1BBQ0VfRk9MREVSX0NPTU1BTkRfSUQpO1xuXHRcdFx0XHRpZiAod29ya3NwYWNlRm9sZGVyKSB7XG5cdFx0XHRcdFx0YXJncyA9IHNhbml0aXplT3BlblNldHRpbmdzQXJncyhhcmdzKTtcblx0XHRcdFx0XHRhd2FpdCBwcmVmZXJlbmNlc1NlcnZpY2Uub3BlbkZvbGRlclNldHRpbmdzKHsgZm9sZGVyVXJpOiB3b3Jrc3BhY2VGb2xkZXIudXJpLCBqc29uRWRpdG9yOiB0cnVlLCAuLi5hcmdzIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogJ193b3JrYmVuY2guYWN0aW9uLm9wZW5Gb2xkZXJTZXR0aW5ncycsXG5cdFx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnb3BlbkZvbGRlclNldHRpbmdzJywgXCJPcGVuIEZvbGRlciBTZXR0aW5nc1wiKSxcblx0XHRcdFx0XHRjYXRlZ29yeSxcblx0XHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLkV4cGxvcmVyQ29udGV4dCxcblx0XHRcdFx0XHRcdGdyb3VwOiAnMl93b3Jrc3BhY2UnLFxuXHRcdFx0XHRcdFx0b3JkZXI6IDIwLFxuXHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKEV4cGxvcmVyUm9vdENvbnRleHQsIEV4cGxvcmVyRm9sZGVyQ29udGV4dClcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCByZXNvdXJjZT86IFVSSSkge1xuXHRcdFx0XHRpZiAoVVJJLmlzVXJpKHJlc291cmNlKSkge1xuXHRcdFx0XHRcdGF3YWl0IGFjY2Vzc29yLmdldChJUHJlZmVyZW5jZXNTZXJ2aWNlKS5vcGVuRm9sZGVyU2V0dGluZ3MoeyBmb2xkZXJVcmk6IHJlc291cmNlIH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cdFx0XHRcdFx0Y29uc3QgcHJlZmVyZW5jZXNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElQcmVmZXJlbmNlc1NlcnZpY2UpO1xuXHRcdFx0XHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlciA9IGF3YWl0IGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kPElXb3Jrc3BhY2VGb2xkZXI+KFBJQ0tfV09SS1NQQUNFX0ZPTERFUl9DT01NQU5EX0lEKTtcblx0XHRcdFx0XHRpZiAod29ya3NwYWNlRm9sZGVyKSB7XG5cdFx0XHRcdFx0XHRhd2FpdCBwcmVmZXJlbmNlc1NlcnZpY2Uub3BlbkZvbGRlclNldHRpbmdzKHsgZm9sZGVyVXJpOiB3b3Jrc3BhY2VGb2xkZXIudXJpIH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6IFNFVFRJTkdTX0VESVRPUl9DT01NQU5EX0ZJTFRFUl9PTkxJTkUsXG5cdFx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pT3Blbk9ubGluZVNldHRpbmdzJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmT25saW5lIFNlcnZpY2VzIFNldHRpbmdzXCIpLFxuXHRcdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuTWVudWJhclByZWZlcmVuY2VzTWVudSxcblx0XHRcdFx0XHRcdGdyb3VwOiAnM19zZXR0aW5ncycsXG5cdFx0XHRcdFx0XHRvcmRlcjogMSxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0XHRcdGNvbnN0IGVkaXRvclBhbmUgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0XHRcdGlmIChlZGl0b3JQYW5lIGluc3RhbmNlb2YgU2V0dGluZ3NFZGl0b3IyKSB7XG5cdFx0XHRcdFx0ZWRpdG9yUGFuZS5mb2N1c1NlYXJjaChgQHRhZzp1c2VzT25saW5lU2VydmljZXNgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhY2Nlc3Nvci5nZXQoSVByZWZlcmVuY2VzU2VydmljZSkub3BlblNldHRpbmdzKHsganNvbkVkaXRvcjogZmFsc2UsIHF1ZXJ5OiAnQHRhZzp1c2VzT25saW5lU2VydmljZXMnIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBTRVRUSU5HU19FRElUT1JfQ09NTUFORF9GSUxURVJfVU5UUlVTVEVELFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdmaWx0ZXJVbnRydXN0ZWQnLCBcIlNob3cgdW50cnVzdGVkIHdvcmtzcGFjZSBzZXR0aW5nc1wiKSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRcdFx0YWNjZXNzb3IuZ2V0KElQcmVmZXJlbmNlc1NlcnZpY2UpLm9wZW5Xb3Jrc3BhY2VTZXR0aW5ncyh7IGpzb25FZGl0b3I6IGZhbHNlLCBxdWVyeTogYEB0YWc6JHtSRVFVSVJFX1RSVVNURURfV09SS1NQQUNFX1NFVFRJTkdfVEFHfWAgfSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBTRVRUSU5HU19DT01NQU5EX0ZJTFRFUl9URUxFTUVUUlksXG5cdFx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSh7IGtleTogJ21pT3BlblRlbGVtZXRyeVNldHRpbmdzJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmVGVsZW1ldHJ5IFNldHRpbmdzXCIpXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0XHRcdGNvbnN0IGVkaXRvclBhbmUgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0XHRcdGlmIChlZGl0b3JQYW5lIGluc3RhbmNlb2YgU2V0dGluZ3NFZGl0b3IyKSB7XG5cdFx0XHRcdFx0ZWRpdG9yUGFuZS5mb2N1c1NlYXJjaChgQHRhZzp0ZWxlbWV0cnlgKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRhY2Nlc3Nvci5nZXQoSVByZWZlcmVuY2VzU2VydmljZSkub3BlblNldHRpbmdzKHsganNvbkVkaXRvcjogZmFsc2UsIHF1ZXJ5OiAnQHRhZzp0ZWxlbWV0cnknIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5yZWdpc3RlclNldHRpbmdzRWRpdG9yQWN0aW9ucygpO1xuXG5cdFx0dGhpcy5leHRlbnNpb25TZXJ2aWNlLndoZW5JbnN0YWxsZWRFeHRlbnNpb25zUmVnaXN0ZXJlZCgpXG5cdFx0XHQudGhlbigoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlbW90ZUF1dGhvcml0eSA9IHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eTtcblx0XHRcdFx0Y29uc3QgaG9zdExhYmVsID0gdGhpcy5sYWJlbFNlcnZpY2UuZ2V0SG9zdExhYmVsKFNjaGVtYXMudnNjb2RlUmVtb3RlLCByZW1vdGVBdXRob3JpdHkpIHx8IHJlbW90ZUF1dGhvcml0eTtcblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5vcGVuUmVtb3RlU2V0dGluZ3MnLFxuXHRcdFx0XHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignb3BlblJlbW90ZVNldHRpbmdzJywgXCJPcGVuIFJlbW90ZSBTZXR0aW5ncyAoezB9KVwiLCBob3N0TGFiZWwpLFxuXHRcdFx0XHRcdFx0XHRjYXRlZ29yeSxcblx0XHRcdFx0XHRcdFx0bWVudToge1xuXHRcdFx0XHRcdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdFx0XHRcdFx0d2hlbjogUmVtb3RlTmFtZUNvbnRleHQubm90RXF1YWxzVG8oJycpXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGFyZ3M/OiBJT3BlblNldHRpbmdzQWN0aW9uT3B0aW9ucykge1xuXHRcdFx0XHRcdFx0YXJncyA9IHNhbml0aXplT3BlblNldHRpbmdzQXJncyhhcmdzKTtcblx0XHRcdFx0XHRcdHJldHVybiBhY2Nlc3Nvci5nZXQoSVByZWZlcmVuY2VzU2VydmljZSkub3BlblJlbW90ZVNldHRpbmdzKGFyZ3MpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXHRcdFx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm9wZW5SZW1vdGVTZXR0aW5nc0ZpbGUnLFxuXHRcdFx0XHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignb3BlblJlbW90ZVNldHRpbmdzSlNPTicsIFwiT3BlbiBSZW1vdGUgU2V0dGluZ3MgKEpTT04pICh7MH0pXCIsIGhvc3RMYWJlbCksXG5cdFx0XHRcdFx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0XHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0XHRcdFx0XHR3aGVuOiBSZW1vdGVOYW1lQ29udGV4dC5ub3RFcXVhbHNUbygnJylcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJncz86IElPcGVuU2V0dGluZ3NBY3Rpb25PcHRpb25zKSB7XG5cdFx0XHRcdFx0XHRhcmdzID0gc2FuaXRpemVPcGVuU2V0dGluZ3NBcmdzKGFyZ3MpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIGFjY2Vzc29yLmdldChJUHJlZmVyZW5jZXNTZXJ2aWNlKS5vcGVuUmVtb3RlU2V0dGluZ3MoeyBqc29uRWRpdG9yOiB0cnVlLCAuLi5hcmdzIH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXHRcdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyU2V0dGluZ3NFZGl0b3JBY3Rpb25zKCkge1xuXHRcdGZ1bmN0aW9uIGdldFByZWZlcmVuY2VzRWRpdG9yKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogU2V0dGluZ3NFZGl0b3IyIHwgbnVsbCB7XG5cdFx0XHRjb25zdCBhY3RpdmVFZGl0b3JQYW5lID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKS5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdFx0aWYgKGFjdGl2ZUVkaXRvclBhbmUgaW5zdGFuY2VvZiBTZXR0aW5nc0VkaXRvcjIpIHtcblx0XHRcdFx0cmV0dXJuIGFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBzZXR0aW5nc0VkaXRvckZvY3VzU2VhcmNoKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0XHRjb25zdCBwcmVmZXJlbmNlc0VkaXRvciA9IGdldFByZWZlcmVuY2VzRWRpdG9yKGFjY2Vzc29yKTtcblx0XHRcdHByZWZlcmVuY2VzRWRpdG9yPy5mb2N1c1NlYXJjaCgpO1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogU0VUVElOR1NfRURJVE9SX0NPTU1BTkRfU0VBUkNILFxuXHRcdFx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9TRVRUSU5HU19FRElUT1IsXG5cdFx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUYsXG5cdFx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYixcblx0XHRcdFx0XHRcdHdoZW46IG51bGxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdzZXR0aW5ncy5mb2N1c1NlYXJjaCcsIFwiRm9jdXMgU2V0dGluZ3MgU2VhcmNoXCIpXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHsgc2V0dGluZ3NFZGl0b3JGb2N1c1NlYXJjaChhY2Nlc3Nvcik7IH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6IFNFVFRJTkdTX0VESVRPUl9DT01NQU5EX0NMRUFSX1NFQVJDSF9SRVNVTFRTLFxuXHRcdFx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9TRVRUSU5HU19FRElUT1IsXG5cdFx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5Fc2NhcGUsXG5cdFx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuRWRpdG9yQ29udHJpYixcblx0XHRcdFx0XHRcdHdoZW46IENPTlRFWFRfU0VUVElOR1NfU0VBUkNIX0ZPQ1VTXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRjYXRlZ29yeSxcblx0XHRcdFx0XHRmMTogdHJ1ZSxcblx0XHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignc2V0dGluZ3MuY2xlYXJSZXN1bHRzJywgXCJDbGVhciBTZXR0aW5ncyBTZWFyY2ggUmVzdWx0c1wiKVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0XHRcdGNvbnN0IHByZWZlcmVuY2VzRWRpdG9yID0gZ2V0UHJlZmVyZW5jZXNFZGl0b3IoYWNjZXNzb3IpO1xuXHRcdFx0XHRwcmVmZXJlbmNlc0VkaXRvcj8uY2xlYXJTZWFyY2hSZXN1bHRzKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBTRVRUSU5HU19FRElUT1JfQ09NTUFORF9GT0NVU19GSUxFLFxuXHRcdFx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfU0VUVElOR1NfU0VBUkNIX0ZPQ1VTLCBTdWdnZXN0Q29udGV4dC5WaXNpYmxlLnRvTmVnYXRlZCgpKSxcblx0XHRcdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkRvd25BcnJvdyxcblx0XHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5FZGl0b3JDb250cmliLFxuXHRcdFx0XHRcdFx0d2hlbjogbnVsbFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnc2V0dGluZ3MuZm9jdXNGaWxlJywgXCJGb2N1cyBzZXR0aW5ncyBmaWxlXCIpXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGFyZ3M6IGFueSk6IHZvaWQge1xuXHRcdFx0XHRjb25zdCBwcmVmZXJlbmNlc0VkaXRvciA9IGdldFByZWZlcmVuY2VzRWRpdG9yKGFjY2Vzc29yKTtcblx0XHRcdFx0cHJlZmVyZW5jZXNFZGl0b3I/LmZvY3VzU2V0dGluZ3MoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6IFNFVFRJTkdTX0VESVRPUl9DT01NQU5EX0ZPQ1VTX1NFVFRJTkdTX0ZST01fU0VBUkNILFxuXHRcdFx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfU0VUVElOR1NfU0VBUkNIX0ZPQ1VTLCBTdWdnZXN0Q29udGV4dC5WaXNpYmxlLnRvTmVnYXRlZCgpKSxcblx0XHRcdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkRvd25BcnJvdyxcblx0XHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRcdFx0d2hlbjogbnVsbFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnc2V0dGluZ3MuZm9jdXNGaWxlJywgXCJGb2N1cyBzZXR0aW5ncyBmaWxlXCIpXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGFyZ3M6IGFueSk6IHZvaWQge1xuXHRcdFx0XHRjb25zdCBwcmVmZXJlbmNlc0VkaXRvciA9IGdldFByZWZlcmVuY2VzRWRpdG9yKGFjY2Vzc29yKTtcblx0XHRcdFx0cHJlZmVyZW5jZXNFZGl0b3I/LmZvY3VzU2V0dGluZ3MoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6IFNFVFRJTkdTX0VESVRPUl9DT01NQU5EX0ZPQ1VTX1NFVFRJTkdTX0xJU1QsXG5cdFx0XHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9TRVRUSU5HU19FRElUT1IsIENPTlRFWFRfVE9DX1JPV19GT0NVUyksXG5cdFx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdFx0cHJpbWFyeTogS2V5Q29kZS5FbnRlcixcblx0XHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRcdFx0d2hlbjogbnVsbFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnc2V0dGluZ3MuZm9jdXNTZXR0aW5nc0xpc3QnLCBcIkZvY3VzIHNldHRpbmdzIGxpc3RcIilcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdFx0XHRjb25zdCBwcmVmZXJlbmNlc0VkaXRvciA9IGdldFByZWZlcmVuY2VzRWRpdG9yKGFjY2Vzc29yKTtcblx0XHRcdFx0aWYgKHByZWZlcmVuY2VzRWRpdG9yIGluc3RhbmNlb2YgU2V0dGluZ3NFZGl0b3IyKSB7XG5cdFx0XHRcdFx0cHJlZmVyZW5jZXNFZGl0b3IuZm9jdXNTZXR0aW5ncygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBTRVRUSU5HU19FRElUT1JfQ09NTUFORF9GT0NVU19UT0MsXG5cdFx0XHRcdFx0cHJlY29uZGl0aW9uOiBDT05URVhUX1NFVFRJTkdTX0VESVRPUixcblx0XHRcdFx0XHRmMTogdHJ1ZSxcblx0XHRcdFx0XHRrZXliaW5kaW5nOiBbXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuTGVmdEFycm93LFxuXHRcdFx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0XHRcdFx0d2hlbjogQ09OVEVYVF9TRVRUSU5HU19ST1dfRk9DVVNcblx0XHRcdFx0XHRcdH1dLFxuXHRcdFx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdzZXR0aW5ncy5mb2N1c1NldHRpbmdzVE9DJywgXCJGb2N1cyBTZXR0aW5ncyBUYWJsZSBvZiBDb250ZW50c1wiKVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0XHRcdGNvbnN0IHByZWZlcmVuY2VzRWRpdG9yID0gZ2V0UHJlZmVyZW5jZXNFZGl0b3IoYWNjZXNzb3IpO1xuXHRcdFx0XHRpZiAoIShwcmVmZXJlbmNlc0VkaXRvciBpbnN0YW5jZW9mIFNldHRpbmdzRWRpdG9yMikpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRwcmVmZXJlbmNlc0VkaXRvci5mb2N1c1RPQygpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogU0VUVElOR1NfRURJVE9SX0NPTU1BTkRfRk9DVVNfQ09OVFJPTCxcblx0XHRcdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX1NFVFRJTkdTX0VESVRPUiwgQ09OVEVYVF9TRVRUSU5HU19ST1dfRk9DVVMpLFxuXHRcdFx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRW50ZXIsXG5cdFx0XHRcdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ3NldHRpbmdzLmZvY3VzU2V0dGluZ0NvbnRyb2wnLCBcIkZvY3VzIFNldHRpbmcgQ29udHJvbFwiKVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0XHRcdGNvbnN0IHByZWZlcmVuY2VzRWRpdG9yID0gZ2V0UHJlZmVyZW5jZXNFZGl0b3IoYWNjZXNzb3IpO1xuXHRcdFx0XHRpZiAoIShwcmVmZXJlbmNlc0VkaXRvciBpbnN0YW5jZW9mIFNldHRpbmdzRWRpdG9yMikpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBhY3RpdmVFbGVtZW50ID0gcHJlZmVyZW5jZXNFZGl0b3IuZ2V0Q29udGFpbmVyKCk/Lm93bmVyRG9jdW1lbnQuYWN0aXZlRWxlbWVudDtcblx0XHRcdFx0aWYgKGFjdGl2ZUVsZW1lbnQ/LmNsYXNzTGlzdC5jb250YWlucygnbW9uYWNvLWxpc3QnKSkge1xuXHRcdFx0XHRcdHByZWZlcmVuY2VzRWRpdG9yLmZvY3VzU2V0dGluZ3ModHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6IFNFVFRJTkdTX0VESVRPUl9DT01NQU5EX1NIT1dfQ09OVEVYVF9NRU5VLFxuXHRcdFx0XHRcdHByZWNvbmRpdGlvbjogQ09OVEVYVF9TRVRUSU5HU19FRElUT1IsXG5cdFx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdFx0cHJpbWFyeTogS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5GOSxcblx0XHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRcdFx0d2hlbjogbnVsbFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ3NldHRpbmdzLnNob3dDb250ZXh0TWVudScsIFwiU2hvdyBTZXR0aW5nIENvbnRleHQgTWVudVwiKVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogdm9pZCB7XG5cdFx0XHRcdGNvbnN0IHByZWZlcmVuY2VzRWRpdG9yID0gZ2V0UHJlZmVyZW5jZXNFZGl0b3IoYWNjZXNzb3IpO1xuXHRcdFx0XHRpZiAocHJlZmVyZW5jZXNFZGl0b3IgaW5zdGFuY2VvZiBTZXR0aW5nc0VkaXRvcjIpIHtcblx0XHRcdFx0XHRwcmVmZXJlbmNlc0VkaXRvci5zaG93Q29udGV4dE1lbnUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogU0VUVElOR1NfRURJVE9SX0NPTU1BTkRfRk9DVVNfVVAsXG5cdFx0XHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9TRVRUSU5HU19FRElUT1IsIENPTlRFWFRfU0VUVElOR1NfU0VBUkNIX0ZPQ1VTLnRvTmVnYXRlZCgpLCBDT05URVhUX1NFVFRJTkdTX0pTT05fRURJVE9SLnRvTmVnYXRlZCgpKSxcblx0XHRcdFx0XHRrZXliaW5kaW5nOiB7XG5cdFx0XHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkVzY2FwZSxcblx0XHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRcdFx0d2hlbjogbnVsbFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdFx0Y2F0ZWdvcnksXG5cdFx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ3NldHRpbmdzLmZvY3VzTGV2ZWxVcCcsIFwiTW92ZSBGb2N1cyBVcCBPbmUgTGV2ZWxcIilcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IHZvaWQge1xuXHRcdFx0XHRjb25zdCBwcmVmZXJlbmNlc0VkaXRvciA9IGdldFByZWZlcmVuY2VzRWRpdG9yKGFjY2Vzc29yKTtcblx0XHRcdFx0aWYgKCEocHJlZmVyZW5jZXNFZGl0b3IgaW5zdGFuY2VvZiBTZXR0aW5nc0VkaXRvcjIpKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHByZWZlcmVuY2VzRWRpdG9yLmN1cnJlbnRGb2N1c0NvbnRleHQgPT09IFNldHRpbmdzRm9jdXNDb250ZXh0LlNldHRpbmdDb250cm9sKSB7XG5cdFx0XHRcdFx0cHJlZmVyZW5jZXNFZGl0b3IuZm9jdXNTZXR0aW5ncygpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHByZWZlcmVuY2VzRWRpdG9yLmN1cnJlbnRGb2N1c0NvbnRleHQgPT09IFNldHRpbmdzRm9jdXNDb250ZXh0LlNldHRpbmdUcmVlKSB7XG5cdFx0XHRcdFx0cHJlZmVyZW5jZXNFZGl0b3IuZm9jdXNUT0MoKTtcblx0XHRcdFx0fSBlbHNlIGlmIChwcmVmZXJlbmNlc0VkaXRvci5jdXJyZW50Rm9jdXNDb250ZXh0ID09PSBTZXR0aW5nc0ZvY3VzQ29udGV4dC5UYWJsZU9mQ29udGVudHMpIHtcblx0XHRcdFx0XHRwcmVmZXJlbmNlc0VkaXRvci5mb2N1c1NlYXJjaCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlcktleWJpbmRpbmdzQWN0aW9ucygpIHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRjb25zdCBjYXRlZ29yeSA9IG5scy5sb2NhbGl6ZTIoJ3ByZWZlcmVuY2VzJywgXCJQcmVmZXJlbmNlc1wiKTtcblx0XHRjb25zdCBpZCA9ICd3b3JrYmVuY2guYWN0aW9uLm9wZW5HbG9iYWxLZXliaW5kaW5ncyc7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkLFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdvcGVuR2xvYmFsS2V5YmluZGluZ3MnLCBcIk9wZW4gS2V5Ym9hcmQgU2hvcnRjdXRzXCIpLFxuXHRcdFx0XHRcdHNob3J0VGl0bGU6IG5scy5sb2NhbGl6ZSgna2V5Ym9hcmRTaG9ydGN1dHMnLCBcIktleWJvYXJkIFNob3J0Y3V0c1wiKSxcblx0XHRcdFx0XHRjYXRlZ29yeSxcblx0XHRcdFx0XHRpY29uOiBwcmVmZXJlbmNlc09wZW5TZXR0aW5nc0ljb24sXG5cdFx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdFx0d2hlbjogbnVsbCxcblx0XHRcdFx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0XHRcdFx0cHJpbWFyeTogS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlTKVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0bWVudTogW1xuXHRcdFx0XHRcdFx0eyBpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlIH0sXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdGlkOiBNZW51SWQuRWRpdG9yVGl0bGUsXG5cdFx0XHRcdFx0XHRcdHdoZW46IFJlc291cmNlQ29udGV4dEtleS5SZXNvdXJjZS5pc0VxdWFsVG8odGhhdC51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLmtleWJpbmRpbmdzUmVzb3VyY2UudG9TdHJpbmcoKSksXG5cdFx0XHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0XHRcdG9yZGVyOiAxLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5HbG9iYWxBY3Rpdml0eSxcblx0XHRcdFx0XHRcdFx0Z3JvdXA6ICcyX2NvbmZpZ3VyYXRpb24nLFxuXHRcdFx0XHRcdFx0XHRvcmRlcjogNFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IHVua25vd25bXSkge1xuXHRcdFx0XHRjb25zdCBxdWVyeSA9IHR5cGVvZiBhcmdzWzBdID09PSAnc3RyaW5nJyA/IGFyZ3NbMF0gOiB1bmRlZmluZWQ7XG5cdFx0XHRcdGNvbnN0IGdyb3VwSWQgPSBnZXRFZGl0b3JHcm91cEZyb21Bcmd1bWVudHMoYWNjZXNzb3IsIGFyZ3MpPy5pZDtcblx0XHRcdFx0cmV0dXJuIGFjY2Vzc29yLmdldChJUHJlZmVyZW5jZXNTZXJ2aWNlKS5vcGVuR2xvYmFsS2V5YmluZGluZ1NldHRpbmdzKGZhbHNlLCB7IHF1ZXJ5LCBncm91cElkIH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJQcmVmZXJlbmNlc01lbnUsIHtcblx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0aWQsXG5cdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ2tleWJvYXJkU2hvcnRjdXRzJywgXCJLZXlib2FyZCBTaG9ydGN1dHNcIiksXG5cdFx0XHR9LFxuXHRcdFx0Z3JvdXA6ICcyX2NvbmZpZ3VyYXRpb24nLFxuXHRcdFx0b3JkZXI6IDRcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5vcGVuRGVmYXVsdEtleWJpbmRpbmdzRmlsZScsXG5cdFx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ29wZW5EZWZhdWx0S2V5YmluZGluZ3NGaWxlJywgXCJPcGVuIERlZmF1bHQgS2V5Ym9hcmQgU2hvcnRjdXRzIChKU09OKVwiKSxcblx0XHRcdFx0XHRjYXRlZ29yeSxcblx0XHRcdFx0XHRtZW51OiB7IGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUgfVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdFx0XHRyZXR1cm4gYWNjZXNzb3IuZ2V0KElQcmVmZXJlbmNlc1NlcnZpY2UpLm9wZW5EZWZhdWx0S2V5YmluZGluZ3NGaWxlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ub3Blbkdsb2JhbEtleWJpbmRpbmdzRmlsZScsXG5cdFx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ29wZW5HbG9iYWxLZXliaW5kaW5nc0ZpbGUnLCBcIk9wZW4gS2V5Ym9hcmQgU2hvcnRjdXRzIChKU09OKVwiKSxcblx0XHRcdFx0XHRjYXRlZ29yeSxcblx0XHRcdFx0XHRpY29uOiBwcmVmZXJlbmNlc09wZW5TZXR0aW5nc0ljb24sXG5cdFx0XHRcdFx0bWVudTogW1xuXHRcdFx0XHRcdFx0eyBpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlIH0sXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdGlkOiBNZW51SWQuRWRpdG9yVGl0bGUsXG5cdFx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0tFWUJJTkRJTkdTX0VESVRPUiksXG5cdFx0XHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogdW5rbm93bltdKSB7XG5cdFx0XHRcdGNvbnN0IGdyb3VwSWQgPSBnZXRFZGl0b3JHcm91cEZyb21Bcmd1bWVudHMoYWNjZXNzb3IsIGFyZ3MpPy5pZDtcblx0XHRcdFx0cmV0dXJuIGFjY2Vzc29yLmdldChJUHJlZmVyZW5jZXNTZXJ2aWNlKS5vcGVuR2xvYmFsS2V5YmluZGluZ1NldHRpbmdzKHRydWUsIHsgZ3JvdXBJZCB9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBLRVlCSU5ESU5HU19FRElUT1JfU0hPV19ERUZBVUxUX0tFWUJJTkRJTkdTLFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdzaG93RGVmYXVsdEtleWJpbmRpbmdzJywgXCJTaG93IFN5c3RlbSBLZXliaW5kaW5nc1wiKSxcblx0XHRcdFx0XHRtZW51OiBbXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdGlkOiBNZW51SWQuRWRpdG9yVGl0bGUsXG5cdFx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0tFWUJJTkRJTkdTX0VESVRPUiksXG5cdFx0XHRcdFx0XHRcdGdyb3VwOiAnMV9rZXlib2FyZF9wcmVmZXJlbmNlc19hY3Rpb25zJ1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IHVua25vd25bXSkge1xuXHRcdFx0XHRjb25zdCBncm91cCA9IGdldEVkaXRvckdyb3VwRnJvbUFyZ3VtZW50cyhhY2Nlc3NvciwgYXJncyk7XG5cdFx0XHRcdGNvbnN0IGVkaXRvclBhbmUgPSBncm91cD8uYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRcdFx0aWYgKGVkaXRvclBhbmUgaW5zdGFuY2VvZiBLZXliaW5kaW5nc0VkaXRvcikge1xuXHRcdFx0XHRcdGVkaXRvclBhbmUuc2VhcmNoKCdAc291cmNlOnN5c3RlbScpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogS0VZQklORElOR1NfRURJVE9SX1NIT1dfRVhURU5TSU9OX0tFWUJJTkRJTkdTLFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdzaG93RXh0ZW5zaW9uS2V5YmluZGluZ3MnLCBcIlNob3cgRXh0ZW5zaW9uIEtleWJpbmRpbmdzXCIpLFxuXHRcdFx0XHRcdG1lbnU6IFtcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5FZGl0b3JUaXRsZSxcblx0XHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfS0VZQklORElOR1NfRURJVE9SKSxcblx0XHRcdFx0XHRcdFx0Z3JvdXA6ICcxX2tleWJvYXJkX3ByZWZlcmVuY2VzX2FjdGlvbnMnXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogdW5rbm93bltdKSB7XG5cdFx0XHRcdGNvbnN0IGdyb3VwID0gZ2V0RWRpdG9yR3JvdXBGcm9tQXJndW1lbnRzKGFjY2Vzc29yLCBhcmdzKTtcblx0XHRcdFx0Y29uc3QgZWRpdG9yUGFuZSA9IGdyb3VwPy5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdFx0XHRpZiAoZWRpdG9yUGFuZSBpbnN0YW5jZW9mIEtleWJpbmRpbmdzRWRpdG9yKSB7XG5cdFx0XHRcdFx0ZWRpdG9yUGFuZS5zZWFyY2goJ0Bzb3VyY2U6ZXh0ZW5zaW9uJyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBLRVlCSU5ESU5HU19FRElUT1JfU0hPV19VU0VSX0tFWUJJTkRJTkdTLFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdzaG93VXNlcktleWJpbmRpbmdzJywgXCJTaG93IFVzZXIgS2V5YmluZGluZ3NcIiksXG5cdFx0XHRcdFx0bWVudTogW1xuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRpZDogTWVudUlkLkVkaXRvclRpdGxlLFxuXHRcdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9LRVlCSU5ESU5HU19FRElUT1IpLFxuXHRcdFx0XHRcdFx0XHRncm91cDogJzFfa2V5Ym9hcmRfcHJlZmVyZW5jZXNfYWN0aW9ucydcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRdXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiB1bmtub3duW10pIHtcblx0XHRcdFx0Y29uc3QgZ3JvdXAgPSBnZXRFZGl0b3JHcm91cEZyb21Bcmd1bWVudHMoYWNjZXNzb3IsIGFyZ3MpO1xuXHRcdFx0XHRjb25zdCBlZGl0b3JQYW5lID0gZ3JvdXA/LmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0XHRcdGlmIChlZGl0b3JQYW5lIGluc3RhbmNlb2YgS2V5YmluZGluZ3NFZGl0b3IpIHtcblx0XHRcdFx0XHRlZGl0b3JQYW5lLnNlYXJjaCgnQHNvdXJjZTp1c2VyJyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9DTEVBUl9TRUFSQ0hfUkVTVUxUUyxcblx0XHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdjbGVhcicsIFwiQ2xlYXIgU2VhcmNoIFJlc3VsdHNcIiksXG5cdFx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9LRVlCSU5ESU5HU19FRElUT1IsIENPTlRFWFRfS0VZQklORElOR1NfU0VBUkNIX0ZPQ1VTKSxcblx0XHRcdFx0XHRcdHByaW1hcnk6IEtleUNvZGUuRXNjYXBlLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRcdFx0Y29uc3QgZWRpdG9yUGFuZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSkuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRcdFx0aWYgKGVkaXRvclBhbmUgaW5zdGFuY2VvZiBLZXliaW5kaW5nc0VkaXRvcikge1xuXHRcdFx0XHRcdGVkaXRvclBhbmUuY2xlYXJTZWFyY2hSZXN1bHRzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6IEtFWUJJTkRJTkdTX0VESVRPUl9DT01NQU5EX0NMRUFSX1NFQVJDSF9ISVNUT1JZLFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ2NsZWFySGlzdG9yeScsIFwiQ2xlYXIgS2V5Ym9hcmQgU2hvcnRjdXRzIFNlYXJjaCBIaXN0b3J5XCIpLFxuXHRcdFx0XHRcdGNhdGVnb3J5LFxuXHRcdFx0XHRcdG1lbnU6IFtcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfS0VZQklORElOR1NfRURJVE9SKSxcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRdXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0XHRcdGNvbnN0IGVkaXRvclBhbmUgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0XHRcdGlmIChlZGl0b3JQYW5lIGluc3RhbmNlb2YgS2V5YmluZGluZ3NFZGl0b3IpIHtcblx0XHRcdFx0XHRlZGl0b3JQYW5lLmNsZWFyS2V5Ym9hcmRTaG9ydGN1dFNlYXJjaEhpc3RvcnkoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJLZXliaW5kaW5nRWRpdG9yQWN0aW9ucygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlcktleWJpbmRpbmdFZGl0b3JBY3Rpb25zKCk6IHZvaWQge1xuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXG5cdFx0S2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdFx0XHRpZDogS0VZQklORElOR1NfRURJVE9SX0NPTU1BTkRfREVGSU5FLFxuXHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9LRVlCSU5ESU5HU19FRElUT1IsIENPTlRFWFRfS0VZQklORElOR19GT0NVUywgQ09OVEVYVF9XSEVOX0ZPQ1VTLnRvTmVnYXRlZCgpKSxcblx0XHRcdHByaW1hcnk6IEtleUNvZGUuRW50ZXIsXG5cdFx0XHRoYW5kbGVyOiAoYWNjZXNzb3IsIGFyZ3M6IGFueSkgPT4ge1xuXHRcdFx0XHRjb25zdCBlZGl0b3JQYW5lID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKS5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdFx0XHRpZiAoZWRpdG9yUGFuZSBpbnN0YW5jZW9mIEtleWJpbmRpbmdzRWRpdG9yKSB7XG5cdFx0XHRcdFx0ZWRpdG9yUGFuZS5kZWZpbmVLZXliaW5kaW5nKGVkaXRvclBhbmUuYWN0aXZlS2V5YmluZGluZ0VudHJ5ISwgZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRLZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0XHRcdGlkOiBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9BREQsXG5cdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0tFWUJJTkRJTkdTX0VESVRPUiwgQ09OVEVYVF9LRVlCSU5ESU5HX0ZPQ1VTKSxcblx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5QSksXG5cdFx0XHRoYW5kbGVyOiAoYWNjZXNzb3IsIGFyZ3M6IGFueSkgPT4ge1xuXHRcdFx0XHRjb25zdCBlZGl0b3JQYW5lID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKS5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdFx0XHRpZiAoZWRpdG9yUGFuZSBpbnN0YW5jZW9mIEtleWJpbmRpbmdzRWRpdG9yKSB7XG5cdFx0XHRcdFx0ZWRpdG9yUGFuZS5kZWZpbmVLZXliaW5kaW5nKGVkaXRvclBhbmUuYWN0aXZlS2V5YmluZGluZ0VudHJ5ISwgdHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdEtleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRcdFx0aWQ6IEtFWUJJTkRJTkdTX0VESVRPUl9DT01NQU5EX0RFRklORV9XSEVOLFxuXHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9LRVlCSU5ESU5HU19FRElUT1IsIENPTlRFWFRfS0VZQklORElOR19GT0NVUyksXG5cdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUUpLFxuXHRcdFx0aGFuZGxlcjogKGFjY2Vzc29yLCBhcmdzOiBhbnkpID0+IHtcblx0XHRcdFx0Y29uc3QgZWRpdG9yUGFuZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSkuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRcdFx0aWYgKGVkaXRvclBhbmUgaW5zdGFuY2VvZiBLZXliaW5kaW5nc0VkaXRvciAmJiBlZGl0b3JQYW5lLmFjdGl2ZUtleWJpbmRpbmdFbnRyeSEua2V5YmluZGluZ0l0ZW0ua2V5YmluZGluZykge1xuXHRcdFx0XHRcdGVkaXRvclBhbmUuZGVmaW5lV2hlbkV4cHJlc3Npb24oZWRpdG9yUGFuZS5hY3RpdmVLZXliaW5kaW5nRW50cnkhKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0S2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdFx0XHRpZDogS0VZQklORElOR1NfRURJVE9SX0NPTU1BTkRfUkVNT1ZFLFxuXHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9LRVlCSU5ESU5HU19FRElUT1IsIENPTlRFWFRfS0VZQklORElOR19GT0NVUywgSW5wdXRGb2N1c2VkQ29udGV4dC50b05lZ2F0ZWQoKSksXG5cdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkRlbGV0ZSxcblx0XHRcdG1hYzoge1xuXHRcdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuQmFja3NwYWNlXG5cdFx0XHR9LFxuXHRcdFx0aGFuZGxlcjogKGFjY2Vzc29yLCBhcmdzOiBhbnkpID0+IHtcblx0XHRcdFx0Y29uc3QgZWRpdG9yUGFuZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSkuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRcdFx0aWYgKGVkaXRvclBhbmUgaW5zdGFuY2VvZiBLZXliaW5kaW5nc0VkaXRvcikge1xuXHRcdFx0XHRcdGVkaXRvclBhbmUucmVtb3ZlS2V5YmluZGluZyhlZGl0b3JQYW5lLmFjdGl2ZUtleWJpbmRpbmdFbnRyeSEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRLZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0XHRcdGlkOiBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9SRVNFVCxcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfS0VZQklORElOR1NfRURJVE9SLCBDT05URVhUX0tFWUJJTkRJTkdfRk9DVVMpLFxuXHRcdFx0cHJpbWFyeTogMCxcblx0XHRcdGhhbmRsZXI6IChhY2Nlc3NvciwgYXJnczogYW55KSA9PiB7XG5cdFx0XHRcdGNvbnN0IGVkaXRvclBhbmUgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0XHRcdGlmIChlZGl0b3JQYW5lIGluc3RhbmNlb2YgS2V5YmluZGluZ3NFZGl0b3IpIHtcblx0XHRcdFx0XHRlZGl0b3JQYW5lLnJlc2V0S2V5YmluZGluZyhlZGl0b3JQYW5lLmFjdGl2ZUtleWJpbmRpbmdFbnRyeSEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRLZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0XHRcdGlkOiBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9TRUFSQ0gsXG5cdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0tFWUJJTkRJTkdTX0VESVRPUiksXG5cdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5Rixcblx0XHRcdGhhbmRsZXI6IChhY2Nlc3NvciwgYXJnczogYW55KSA9PiB7XG5cdFx0XHRcdGNvbnN0IGVkaXRvclBhbmUgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0XHRcdGlmIChlZGl0b3JQYW5lIGluc3RhbmNlb2YgS2V5YmluZGluZ3NFZGl0b3IpIHtcblx0XHRcdFx0XHRlZGl0b3JQYW5lLmZvY3VzU2VhcmNoKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdEtleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRcdFx0aWQ6IEtFWUJJTkRJTkdTX0VESVRPUl9DT01NQU5EX1JFQ09SRF9TRUFSQ0hfS0VZUyxcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfS0VZQklORElOR1NfRURJVE9SLCBDT05URVhUX0tFWUJJTkRJTkdTX1NFQVJDSF9GT0NVUyksXG5cdFx0XHRwcmltYXJ5OiBLZXlNb2QuQWx0IHwgS2V5Q29kZS5LZXlLLFxuXHRcdFx0bWFjOiB7IHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLkFsdCB8IEtleUNvZGUuS2V5SyB9LFxuXHRcdFx0aGFuZGxlcjogKGFjY2Vzc29yLCBhcmdzOiBhbnkpID0+IHtcblx0XHRcdFx0Y29uc3QgZWRpdG9yUGFuZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSkuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRcdFx0aWYgKGVkaXRvclBhbmUgaW5zdGFuY2VvZiBLZXliaW5kaW5nc0VkaXRvcikge1xuXHRcdFx0XHRcdGVkaXRvclBhbmUucmVjb3JkU2VhcmNoS2V5cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRLZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0XHRcdGlkOiBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9TT1JUQllfUFJFQ0VERU5DRSxcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfS0VZQklORElOR1NfRURJVE9SKSxcblx0XHRcdHByaW1hcnk6IEtleU1vZC5BbHQgfCBLZXlDb2RlLktleVAsXG5cdFx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuQWx0IHwgS2V5Q29kZS5LZXlQIH0sXG5cdFx0XHRoYW5kbGVyOiAoYWNjZXNzb3IsIGFyZ3M6IGFueSkgPT4ge1xuXHRcdFx0XHRjb25zdCBlZGl0b3JQYW5lID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKS5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdFx0XHRpZiAoZWRpdG9yUGFuZSBpbnN0YW5jZW9mIEtleWJpbmRpbmdzRWRpdG9yKSB7XG5cdFx0XHRcdFx0ZWRpdG9yUGFuZS50b2dnbGVTb3J0QnlQcmVjZWRlbmNlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdEtleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRcdFx0aWQ6IEtFWUJJTkRJTkdTX0VESVRPUl9DT01NQU5EX1NIT1dfU0lNSUxBUixcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfS0VZQklORElOR1NfRURJVE9SLCBDT05URVhUX0tFWUJJTkRJTkdfRk9DVVMpLFxuXHRcdFx0cHJpbWFyeTogMCxcblx0XHRcdGhhbmRsZXI6IChhY2Nlc3NvciwgYXJnczogYW55KSA9PiB7XG5cdFx0XHRcdGNvbnN0IGVkaXRvclBhbmUgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0XHRcdGlmIChlZGl0b3JQYW5lIGluc3RhbmNlb2YgS2V5YmluZGluZ3NFZGl0b3IpIHtcblx0XHRcdFx0XHRlZGl0b3JQYW5lLnNob3dTaW1pbGFyS2V5YmluZGluZ3MoZWRpdG9yUGFuZS5hY3RpdmVLZXliaW5kaW5nRW50cnkhKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0S2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdFx0XHRpZDogS0VZQklORElOR1NfRURJVE9SX0NPTU1BTkRfQ09QWSxcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfS0VZQklORElOR1NfRURJVE9SLCBDT05URVhUX0tFWUJJTkRJTkdfRk9DVVMsIENPTlRFWFRfV0hFTl9GT0NVUy5uZWdhdGUoKSksXG5cdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5Qyxcblx0XHRcdGhhbmRsZXI6IGFzeW5jIChhY2Nlc3NvciwgYXJnczogYW55KSA9PiB7XG5cdFx0XHRcdGNvbnN0IGVkaXRvclBhbmUgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0XHRcdGlmIChlZGl0b3JQYW5lIGluc3RhbmNlb2YgS2V5YmluZGluZ3NFZGl0b3IpIHtcblx0XHRcdFx0XHRhd2FpdCBlZGl0b3JQYW5lLmNvcHlLZXliaW5kaW5nKGVkaXRvclBhbmUuYWN0aXZlS2V5YmluZGluZ0VudHJ5ISk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdEtleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kQW5kS2V5YmluZGluZ1J1bGUoe1xuXHRcdFx0aWQ6IEtFWUJJTkRJTkdTX0VESVRPUl9DT01NQU5EX0NPUFlfQ09NTUFORCxcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfS0VZQklORElOR1NfRURJVE9SLCBDT05URVhUX0tFWUJJTkRJTkdfRk9DVVMpLFxuXHRcdFx0cHJpbWFyeTogMCxcblx0XHRcdGhhbmRsZXI6IGFzeW5jIChhY2Nlc3NvciwgYXJnczogYW55KSA9PiB7XG5cdFx0XHRcdGNvbnN0IGVkaXRvclBhbmUgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0XHRcdGlmIChlZGl0b3JQYW5lIGluc3RhbmNlb2YgS2V5YmluZGluZ3NFZGl0b3IpIHtcblx0XHRcdFx0XHRhd2FpdCBlZGl0b3JQYW5lLmNvcHlLZXliaW5kaW5nQ29tbWFuZChlZGl0b3JQYW5lLmFjdGl2ZUtleWJpbmRpbmdFbnRyeSEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRLZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0XHRcdGlkOiBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9DT1BZX0NPTU1BTkRfVElUTEUsXG5cdFx0XHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYixcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0tFWUJJTkRJTkdTX0VESVRPUiwgQ09OVEVYVF9LRVlCSU5ESU5HX0ZPQ1VTKSxcblx0XHRcdHByaW1hcnk6IDAsXG5cdFx0XHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3IsIGFyZ3M6IGFueSkgPT4ge1xuXHRcdFx0XHRjb25zdCBlZGl0b3JQYW5lID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKS5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdFx0XHRpZiAoZWRpdG9yUGFuZSBpbnN0YW5jZW9mIEtleWJpbmRpbmdzRWRpdG9yKSB7XG5cdFx0XHRcdFx0YXdhaXQgZWRpdG9yUGFuZS5jb3B5S2V5YmluZGluZ0NvbW1hbmRUaXRsZShlZGl0b3JQYW5lLmFjdGl2ZUtleWJpbmRpbmdFbnRyeSEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRLZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0XHRcdGlkOiBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9GT0NVU19LRVlCSU5ESU5HUyxcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfS0VZQklORElOR1NfRURJVE9SLCBDT05URVhUX0tFWUJJTkRJTkdTX1NFQVJDSF9GT0NVUyksXG5cdFx0XHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRG93bkFycm93LFxuXHRcdFx0aGFuZGxlcjogKGFjY2Vzc29yLCBhcmdzOiBhbnkpID0+IHtcblx0XHRcdFx0Y29uc3QgZWRpdG9yUGFuZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSkuYWN0aXZlRWRpdG9yUGFuZTtcblx0XHRcdFx0aWYgKGVkaXRvclBhbmUgaW5zdGFuY2VvZiBLZXliaW5kaW5nc0VkaXRvcikge1xuXHRcdFx0XHRcdGVkaXRvclBhbmUuZm9jdXNLZXliaW5kaW5ncygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRLZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0XHRcdGlkOiBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9SRUpFQ1RfV0hFTixcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfS0VZQklORElOR1NfRURJVE9SLCBDT05URVhUX1dIRU5fRk9DVVMsIFN1Z2dlc3RDb250ZXh0LlZpc2libGUudG9OZWdhdGVkKCkpLFxuXHRcdFx0cHJpbWFyeTogS2V5Q29kZS5Fc2NhcGUsXG5cdFx0XHRoYW5kbGVyOiBhc3luYyAoYWNjZXNzb3IsIGFyZ3M6IGFueSkgPT4ge1xuXHRcdFx0XHRjb25zdCBlZGl0b3JQYW5lID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKS5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdFx0XHRpZiAoZWRpdG9yUGFuZSBpbnN0YW5jZW9mIEtleWJpbmRpbmdzRWRpdG9yKSB7XG5cdFx0XHRcdFx0ZWRpdG9yUGFuZS5yZWplY3RXaGVuRXhwcmVzc2lvbihlZGl0b3JQYW5lLmFjdGl2ZUtleWJpbmRpbmdFbnRyeSEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRLZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZEFuZEtleWJpbmRpbmdSdWxlKHtcblx0XHRcdGlkOiBLRVlCSU5ESU5HU19FRElUT1JfQ09NTUFORF9BQ0NFUFRfV0hFTixcblx0XHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfS0VZQklORElOR1NfRURJVE9SLCBDT05URVhUX1dIRU5fRk9DVVMsIFN1Z2dlc3RDb250ZXh0LlZpc2libGUudG9OZWdhdGVkKCkpLFxuXHRcdFx0cHJpbWFyeTogS2V5Q29kZS5FbnRlcixcblx0XHRcdGhhbmRsZXI6IGFzeW5jIChhY2Nlc3NvciwgYXJnczogYW55KSA9PiB7XG5cdFx0XHRcdGNvbnN0IGVkaXRvclBhbmUgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0XHRcdGlmIChlZGl0b3JQYW5lIGluc3RhbmNlb2YgS2V5YmluZGluZ3NFZGl0b3IpIHtcblx0XHRcdFx0XHRlZGl0b3JQYW5lLmFjY2VwdFdoZW5FeHByZXNzaW9uKGVkaXRvclBhbmUuYWN0aXZlS2V5YmluZGluZ0VudHJ5ISk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IHByb2ZpbGVTY29wZWRBY3Rpb25EaXNwb3NhYmxlcyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdFx0Y29uc3QgcmVnaXN0ZXJQcm9maWxlU2NvcGVkQWN0aW9ucyA9ICgpID0+IHtcblx0XHRcdHByb2ZpbGVTY29wZWRBY3Rpb25EaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdFx0cHJvZmlsZVNjb3BlZEFjdGlvbkRpc3Bvc2FibGVzLmFkZChyZWdpc3RlckFjdGlvbjIoY2xhc3MgRGVmaW5lS2V5YmluZGluZ0FjdGlvbiBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0XHRjb25zdCB3aGVuID0gUmVzb3VyY2VDb250ZXh0S2V5LlJlc291cmNlLmlzRXF1YWxUbyh0aGF0LnVzZXJEYXRhUHJvZmlsZVNlcnZpY2UuY3VycmVudFByb2ZpbGUua2V5YmluZGluZ3NSZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uZGVmaW5lS2V5YmluZGluZycsXG5cdFx0XHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignZGVmaW5lS2V5YmluZGluZy5zdGFydCcsIFwiRGVmaW5lIEtleWJpbmRpbmdcIiksXG5cdFx0XHRcdFx0XHRmMTogdHJ1ZSxcblx0XHRcdFx0XHRcdHByZWNvbmRpdGlvbjogd2hlbixcblx0XHRcdFx0XHRcdGtleWJpbmRpbmc6IHtcblx0XHRcdFx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdFx0XHRcdHdoZW4sXG5cdFx0XHRcdFx0XHRcdHByaW1hcnk6IEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5Sylcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRtZW51OiB7XG5cdFx0XHRcdFx0XHRcdGlkOiBNZW51SWQuRWRpdG9yQ29udGVudCxcblx0XHRcdFx0XHRcdFx0d2hlbixcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRcdGNvbnN0IGNvZGVFZGl0b3IgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLmFjdGl2ZVRleHRFZGl0b3JDb250cm9sO1xuXHRcdFx0XHRcdGlmIChpc0NvZGVFZGl0b3IoY29kZUVkaXRvcikpIHtcblx0XHRcdFx0XHRcdGNvZGVFZGl0b3IuZ2V0Q29udHJpYnV0aW9uPElEZWZpbmVLZXliaW5kaW5nRWRpdG9yQ29udHJpYnV0aW9uPihERUZJTkVfS0VZQklORElOR19FRElUT1JfQ09OVFJJQl9JRCk/LnNob3dEZWZpbmVLZXliaW5kaW5nV2lkZ2V0KCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fTtcblxuXHRcdHJlZ2lzdGVyUHJvZmlsZVNjb3BlZEFjdGlvbnMoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnVzZXJEYXRhUHJvZmlsZVNlcnZpY2Uub25EaWRDaGFuZ2VDdXJyZW50UHJvZmlsZSgoKSA9PiByZWdpc3RlclByb2ZpbGVTY29wZWRBY3Rpb25zKCkpKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlUHJlZmVyZW5jZXNFZGl0b3JNZW51SXRlbSgpIHtcblx0XHRjb25zdCBjb21tYW5kSWQgPSAnX3dvcmtiZW5jaC5vcGVuV29ya3NwYWNlU2V0dGluZ3NFZGl0b3InO1xuXHRcdGlmICh0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLldPUktTUEFDRSAmJiAhQ29tbWFuZHNSZWdpc3RyeS5nZXRDb21tYW5kKGNvbW1hbmRJZCkpIHtcblx0XHRcdENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKGNvbW1hbmRJZCwgKCkgPT4gdGhpcy5wcmVmZXJlbmNlc1NlcnZpY2Uub3BlbldvcmtzcGFjZVNldHRpbmdzKHsganNvbkVkaXRvcjogZmFsc2UgfSkpO1xuXHRcdFx0TWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5FZGl0b3JUaXRsZSwge1xuXHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0aWQ6IGNvbW1hbmRJZCxcblx0XHRcdFx0XHR0aXRsZTogT1BFTl9VU0VSX1NFVFRJTkdTX1VJX1RJVExFLFxuXHRcdFx0XHRcdGljb246IHByZWZlcmVuY2VzT3BlblNldHRpbmdzSWNvblxuXHRcdFx0XHR9LFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoUmVzb3VyY2VDb250ZXh0S2V5LlJlc291cmNlLmlzRXF1YWxUbyh0aGlzLnByZWZlcmVuY2VzU2VydmljZS53b3Jrc3BhY2VTZXR0aW5nc1Jlc291cmNlIS50b1N0cmluZygpKSwgV29ya2JlbmNoU3RhdGVDb250ZXh0LmlzRXF1YWxUbygnd29ya3NwYWNlJyksIENvbnRleHRLZXlFeHByLm5vdCgnaXNJbkRpZmZFZGl0b3InKSksXG5cdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdG9yZGVyOiAxXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0dGhpcy51cGRhdGVQcmVmZXJlbmNlc0VkaXRvck1lbnVJdGVtRm9yV29ya3NwYWNlRm9sZGVycygpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVQcmVmZXJlbmNlc0VkaXRvck1lbnVJdGVtRm9yV29ya3NwYWNlRm9sZGVycygpIHtcblx0XHRmb3IgKGNvbnN0IGZvbGRlciBvZiB0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnMpIHtcblx0XHRcdGNvbnN0IGNvbW1hbmRJZCA9IGBfd29ya2JlbmNoLm9wZW5Gb2xkZXJTZXR0aW5ncy4ke2ZvbGRlci51cmkudG9TdHJpbmcoKX1gO1xuXHRcdFx0aWYgKCFDb21tYW5kc1JlZ2lzdHJ5LmdldENvbW1hbmQoY29tbWFuZElkKSkge1xuXHRcdFx0XHRDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZChjb21tYW5kSWQsIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pID0+IHtcblx0XHRcdFx0XHRjb25zdCBncm91cElkID0gZ2V0RWRpdG9yR3JvdXBGcm9tQXJndW1lbnRzKGFjY2Vzc29yLCBhcmdzKT8uaWQ7XG5cdFx0XHRcdFx0aWYgKHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuRk9MREVSKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5wcmVmZXJlbmNlc1NlcnZpY2Uub3BlbldvcmtzcGFjZVNldHRpbmdzKHsganNvbkVkaXRvcjogZmFsc2UsIGdyb3VwSWQgfSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiB0aGlzLnByZWZlcmVuY2VzU2VydmljZS5vcGVuRm9sZGVyU2V0dGluZ3MoeyBmb2xkZXJVcmk6IGZvbGRlci51cmksIGpzb25FZGl0b3I6IGZhbHNlLCBncm91cElkIH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuRWRpdG9yVGl0bGUsIHtcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRpZDogY29tbWFuZElkLFxuXHRcdFx0XHRcdFx0dGl0bGU6IE9QRU5fVVNFUl9TRVRUSU5HU19VSV9USVRMRSxcblx0XHRcdFx0XHRcdGljb246IHByZWZlcmVuY2VzT3BlblNldHRpbmdzSWNvblxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFJlc291cmNlQ29udGV4dEtleS5SZXNvdXJjZS5pc0VxdWFsVG8odGhpcy5wcmVmZXJlbmNlc1NlcnZpY2UuZ2V0Rm9sZGVyU2V0dGluZ3NSZXNvdXJjZShmb2xkZXIudXJpKSEudG9TdHJpbmcoKSksIENvbnRleHRLZXlFeHByLm5vdCgnaXNJbkRpZmZFZGl0b3InKSksXG5cdFx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgU2V0dGluZ3NFZGl0b3JUaXRsZUNvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIuc2V0dGluZ3NFZGl0b3JUaXRsZUJhckFjdGlvbnMnO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVXNlckRhdGFQcm9maWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZVNlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVzU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMucmVnaXN0ZXJTZXR0aW5nc0VkaXRvclRpdGxlQWN0aW9ucygpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlclNldHRpbmdzRWRpdG9yVGl0bGVBY3Rpb25zKCkge1xuXHRcdGNvbnN0IHJlZ2lzdGVyT3BlblVzZXJTZXR0aW5nc0VkaXRvckZyb21Kc29uQWN0aW9uRGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdFx0Y29uc3QgcmVnaXN0ZXJPcGVuVXNlclNldHRpbmdzRWRpdG9yRnJvbUpzb25BY3Rpb24gPSAoKSA9PiB7XG5cdFx0XHRjb25zdCBvcGVuVXNlclNldHRpbmdzRWRpdG9yV2hlbiA9IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0Q09OVEVYVF9TRVRUSU5HU19FRElUT1IudG9OZWdhdGVkKCksXG5cdFx0XHRcdENvbnRleHRLZXlFeHByLm9yKFxuXHRcdFx0XHRcdFJlc291cmNlQ29udGV4dEtleS5SZXNvdXJjZS5pc0VxdWFsVG8odGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLnNldHRpbmdzUmVzb3VyY2UudG9TdHJpbmcoKSksXG5cdFx0XHRcdFx0UmVzb3VyY2VDb250ZXh0S2V5LlJlc291cmNlLmlzRXF1YWxUbyh0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLnNldHRpbmdzUmVzb3VyY2UudG9TdHJpbmcoKSkpLFxuXHRcdFx0XHRDb250ZXh0S2V5RXhwci5ub3QoJ2lzSW5EaWZmRWRpdG9yJykpO1xuXHRcdFx0cmVnaXN0ZXJPcGVuVXNlclNldHRpbmdzRWRpdG9yRnJvbUpzb25BY3Rpb25EaXNwb3NhYmxlcy52YWx1ZSA9IHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0XHRpZDogJ193b3JrYmVuY2gub3BlblVzZXJTZXR0aW5nc0VkaXRvcicsXG5cdFx0XHRcdFx0XHR0aXRsZTogT1BFTl9VU0VSX1NFVFRJTkdTX1VJX1RJVExFLFxuXHRcdFx0XHRcdFx0aWNvbjogcHJlZmVyZW5jZXNPcGVuU2V0dGluZ3NJY29uLFxuXHRcdFx0XHRcdFx0bWVudTogW3tcblx0XHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5FZGl0b3JUaXRsZSxcblx0XHRcdFx0XHRcdFx0d2hlbjogb3BlblVzZXJTZXR0aW5nc0VkaXRvcldoZW4sXG5cdFx0XHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0XHRcdG9yZGVyOiAxXG5cdFx0XHRcdFx0XHR9XVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogdW5rbm93bltdKSB7XG5cdFx0XHRcdFx0Y29uc3Qgc2FuaXRpemVkQXJncyA9IHNhbml0aXplT3BlblNldHRpbmdzQXJncyhhcmdzWzBdKTtcblx0XHRcdFx0XHRjb25zdCBncm91cElkID0gZ2V0RWRpdG9yR3JvdXBGcm9tQXJndW1lbnRzKGFjY2Vzc29yLCBhcmdzKT8uaWQ7XG5cdFx0XHRcdFx0cmV0dXJuIGFjY2Vzc29yLmdldChJUHJlZmVyZW5jZXNTZXJ2aWNlKS5vcGVuVXNlclNldHRpbmdzKHsganNvbkVkaXRvcjogZmFsc2UsIC4uLnNhbml0aXplZEFyZ3MsIGdyb3VwSWQgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH07XG5cblx0XHRyZWdpc3Rlck9wZW5Vc2VyU2V0dGluZ3NFZGl0b3JGcm9tSnNvbkFjdGlvbigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMudXNlckRhdGFQcm9maWxlU2VydmljZS5vbkRpZENoYW5nZUN1cnJlbnRQcm9maWxlKCgpID0+IHtcblx0XHRcdC8vIEZvcmNlIHRoZSBhY3Rpb24gdG8gY2hlY2sgdGhlIGNvbnRleHQgYWdhaW4uXG5cdFx0XHRyZWdpc3Rlck9wZW5Vc2VyU2V0dGluZ3NFZGl0b3JGcm9tSnNvbkFjdGlvbigpO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IG9wZW5TZXR0aW5nc0pzb25XaGVuID0gQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfU0VUVElOR1NfSlNPTl9FRElUT1IudG9OZWdhdGVkKCksIENPTlRFWFRfU0VUVElOR1NfRURJVE9SKTtcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6IFNFVFRJTkdTX0VESVRPUl9DT01NQU5EX1NXSVRDSF9UT19KU09OLFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdvcGVuU2V0dGluZ3NKc29uJywgXCJPcGVuIFNldHRpbmdzIChKU09OKVwiKSxcblx0XHRcdFx0XHRpY29uOiBwcmVmZXJlbmNlc09wZW5TZXR0aW5nc0ljb24sXG5cdFx0XHRcdFx0bWVudTogW3tcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuRWRpdG9yVGl0bGUsXG5cdFx0XHRcdFx0XHR3aGVuOiBvcGVuU2V0dGluZ3NKc29uV2hlbixcblx0XHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCAuLi5hcmdzOiB1bmtub3duW10pIHtcblx0XHRcdFx0Y29uc3QgZ3JvdXAgPSBnZXRFZGl0b3JHcm91cEZyb21Bcmd1bWVudHMoYWNjZXNzb3IsIGFyZ3MpO1xuXHRcdFx0XHRjb25zdCBlZGl0b3JQYW5lID0gZ3JvdXA/LmFjdGl2ZUVkaXRvclBhbmU7XG5cdFx0XHRcdGlmIChlZGl0b3JQYW5lIGluc3RhbmNlb2YgU2V0dGluZ3NFZGl0b3IyKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGVkaXRvclBhbmUuc3dpdGNoVG9TZXR0aW5nc0ZpbGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gZ2V0RWRpdG9yR3JvdXBGcm9tQXJndW1lbnRzKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBhcmdzOiB1bmtub3duW10pOiBJRWRpdG9yR3JvdXAgfCB1bmRlZmluZWQge1xuXHRjb25zdCBjb250ZXh0ID0gcmVzb2x2ZUNvbW1hbmRzQ29udGV4dChhcmdzLCBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUVkaXRvckdyb3Vwc1NlcnZpY2UpLCBhY2Nlc3Nvci5nZXQoSUxpc3RTZXJ2aWNlKSk7XG5cdHJldHVybiBjb250ZXh0Lmdyb3VwZWRFZGl0b3JzWzBdPy5ncm91cDtcbn1cblxucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKFByZWZlcmVuY2VzQWN0aW9uc0NvbnRyaWJ1dGlvbi5JRCwgUHJlZmVyZW5jZXNBY3Rpb25zQ29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZS5CbG9ja1N0YXJ0dXApO1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKFByZWZlcmVuY2VzQ29udHJpYnV0aW9uLklELCBQcmVmZXJlbmNlc0NvbnRyaWJ1dGlvbiwgV29ya2JlbmNoUGhhc2UuQmxvY2tTdGFydHVwKTtcbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihTZXR0aW5nc0VkaXRvclRpdGxlQ29udHJpYnV0aW9uLklELCBTZXR0aW5nc0VkaXRvclRpdGxlQ29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZS5BZnRlclJlc3RvcmVkKTtcblxucmVnaXN0ZXJFZGl0b3JDb250cmlidXRpb24oU2V0dGluZ3NFZGl0b3JDb250cmlidXRpb24uSUQsIFNldHRpbmdzRWRpdG9yQ29udHJpYnV0aW9uLCBFZGl0b3JDb250cmlidXRpb25JbnN0YW50aWF0aW9uLkFmdGVyRmlyc3RSZW5kZXIpO1xuXG4vLyBQcmVmZXJlbmNlcyBtZW51XG5cbk1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhckZpbGVNZW51LCB7XG5cdHRpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaVByZWZlcmVuY2VzJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmUHJlZmVyZW5jZXNcIiksXG5cdHN1Ym1lbnU6IE1lbnVJZC5NZW51YmFyUHJlZmVyZW5jZXNNZW51LFxuXHRncm91cDogJzVfYXV0b3NhdmUnLFxuXHRvcmRlcjogMixcblx0d2hlbjogSXNNYWNOYXRpdmVDb250ZXh0LnRvTmVnYXRlZCgpIC8vIG9uIG1hY09TIG5hdGl2ZSB0aGUgcHJlZmVyZW5jZXMgbWVudSBpcyBzZXBhcmF0ZSB1bmRlciB0aGUgYXBwbGljYXRpb24gbWVudVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsVUFBVSxTQUFTLGNBQWM7QUFDMUMsU0FBUyxZQUFZLGlCQUFpQix5QkFBeUI7QUFDL0QsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsV0FBVyxVQUFVLGdCQUFnQjtBQUM5QyxTQUFTLFdBQVc7QUFDcEIsT0FBTztBQUNQLFNBQVMsaUNBQWlDLGtDQUFrQztBQUM1RSxTQUFTLFdBQVcsc0JBQXNCO0FBQzFDLFlBQVksU0FBUztBQUNyQixTQUFTLFNBQVMsUUFBUSxjQUFjLHVCQUF1QjtBQUMvRCxTQUFTLGtCQUFrQix1QkFBdUI7QUFDbEQsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxxQkFBcUIsMEJBQTBCO0FBQ3hELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsNkJBQStDO0FBQ3hELFNBQVMscUJBQXFCLHdCQUF3QjtBQUN0RCxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDBCQUE0QyxzQkFBc0I7QUFDM0UsU0FBUyx3Q0FBd0M7QUFDakQsU0FBUyw0QkFBaUQ7QUFDMUQsU0FBaUMsZ0JBQWdCLHNDQUFzQztBQUN2RixTQUFTLHdC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
