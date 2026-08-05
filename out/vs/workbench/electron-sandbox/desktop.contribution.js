import { Registry } from "../../platform/registry/common/platform.js";
import { localize, localize2 } from "../../nls.js";
import { MenuRegistry, MenuId, registerAction2 } from "../../platform/actions/common/actions.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope } from "../../platform/configuration/common/configurationRegistry.js";
import { KeyMod, KeyCode } from "../../base/common/keyCodes.js";
import { isLinux, isMacintosh, isWindows } from "../../base/common/platform.js";
import { ConfigureRuntimeArgumentsAction, ToggleDevToolsAction, ReloadWindowWithExtensionsDisabledAction, OpenUserDataFolderAction, ShowGPUInfoAction } from "./actions/developerActions.js";
import { ZoomResetAction, ZoomOutAction, ZoomInAction, CloseWindowAction, SwitchWindowAction, QuickSwitchWindowAction, NewWindowTabHandler, ShowPreviousWindowTabHandler, ShowNextWindowTabHandler, MoveWindowTabToNewWindowHandler, MergeWindowTabsHandlerHandler, ToggleWindowTabsBarHandler } from "./actions/windowActions.js";
import { ContextKeyExpr } from "../../platform/contextkey/common/contextkey.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../platform/keybinding/common/keybindingsRegistry.js";
import { CommandsRegistry } from "../../platform/commands/common/commands.js";
import { IsMacContext } from "../../platform/contextkey/common/contextkeys.js";
import { INativeHostService } from "../../platform/native/common/native.js";
import { Extensions as JSONExtensions } from "../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { InstallShellScriptAction, UninstallShellScriptAction } from "./actions/installActions.js";
import { EditorsVisibleContext, SingleEditorGroupsContext } from "../common/contextkeys.js";
import { TELEMETRY_SETTING_ID } from "../../platform/telemetry/common/telemetry.js";
import { IConfigurationService } from "../../platform/configuration/common/configuration.js";
import { ShutdownReason } from "../services/lifecycle/common/lifecycle.js";
import { NativeWindow } from "./window.js";
import { ModifierKeyEmitter } from "../../base/browser/dom.js";
import { applicationConfigurationNodeBase, securityConfigurationNodeBase } from "../common/configuration.js";
import { MAX_ZOOM_LEVEL, MIN_ZOOM_LEVEL } from "../../platform/window/electron-sandbox/window.js";
import { DefaultAccountManagementContribution } from "../services/accounts/common/defaultAccount.js";
import { registerWorkbenchContribution2, WorkbenchPhase } from "../common/contributions.js";
(function registerActions() {
  registerAction2(ZoomInAction);
  registerAction2(ZoomOutAction);
  registerAction2(ZoomResetAction);
  registerAction2(SwitchWindowAction);
  registerAction2(QuickSwitchWindowAction);
  registerAction2(CloseWindowAction);
  if (isMacintosh) {
    KeybindingsRegistry.registerKeybindingRule({
      id: CloseWindowAction.ID,
      weight: KeybindingWeight.WorkbenchContrib,
      when: ContextKeyExpr.and(EditorsVisibleContext.toNegated(), SingleEditorGroupsContext),
      primary: KeyMod.CtrlCmd | KeyCode.KeyW
    });
  }
  if (isMacintosh) {
    registerAction2(InstallShellScriptAction);
    registerAction2(UninstallShellScriptAction);
  }
  KeybindingsRegistry.registerCommandAndKeybindingRule({
    id: "workbench.action.quit",
    weight: KeybindingWeight.WorkbenchContrib,
    async handler(accessor) {
      const nativeHostService = accessor.get(INativeHostService);
      const configurationService = accessor.get(IConfigurationService);
      const confirmBeforeClose = configurationService.getValue("window.confirmBeforeClose");
      if (confirmBeforeClose === "always" || confirmBeforeClose === "keyboardOnly" && ModifierKeyEmitter.getInstance().isModifierPressed) {
        const confirmed = await NativeWindow.confirmOnShutdown(accessor, ShutdownReason.QUIT);
        if (!confirmed) {
          return;
        }
      }
      nativeHostService.quit();
    },
    when: void 0,
    mac: { primary: KeyMod.CtrlCmd | KeyCode.KeyQ },
    linux: { primary: KeyMod.CtrlCmd | KeyCode.KeyQ }
  });
  if (isMacintosh) {
    for (const command of [
      { handler: NewWindowTabHandler, id: "workbench.action.newWindowTab", title: localize2("newTab", "New Window Tab") },
      { handler: ShowPreviousWindowTabHandler, id: "workbench.action.showPreviousWindowTab", title: localize2("showPreviousTab", "Show Previous Window Tab") },
      { handler: ShowNextWindowTabHandler, id: "workbench.action.showNextWindowTab", title: localize2("showNextWindowTab", "Show Next Window Tab") },
      { handler: MoveWindowTabToNewWindowHandler, id: "workbench.action.moveWindowTabToNewWindow", title: localize2("moveWindowTabToNewWindow", "Move Window Tab to New Window") },
      { handler: MergeWindowTabsHandlerHandler, id: "workbench.action.mergeAllWindowTabs", title: localize2("mergeAllWindowTabs", "Merge All Windows") },
      { handler: ToggleWindowTabsBarHandler, id: "workbench.action.toggleWindowTabsBar", title: localize2("toggleWindowTabsBar", "Toggle Window Tabs Bar") }
    ]) {
      CommandsRegistry.registerCommand(command.id, command.handler);
      MenuRegistry.appendMenuItem(MenuId.CommandPalette, {
        command,
        when: ContextKeyExpr.equals("config.window.nativeTabs", true)
      });
    }
  }
  registerAction2(ReloadWindowWithExtensionsDisabledAction);
  registerAction2(ConfigureRuntimeArgumentsAction);
  registerAction2(ToggleDevToolsAction);
  registerAction2(OpenUserDataFolderAction);
  registerAction2(ShowGPUInfoAction);
})();
(function registerMenu() {
  MenuRegistry.appendMenuItem(MenuId.MenubarFileMenu, {
    group: "z_Exit",
    command: {
      id: "workbench.action.quit",
      title: localize({ key: "miExit", comment: ["&& denotes a mnemonic"] }, "E&&xit")
    },
    order: 1,
    when: IsMacContext.toNegated()
  });
})();
(function registerConfiguration() {
  const registry = Registry.as(ConfigurationExtensions.Configuration);
  registry.registerConfiguration({
    ...applicationConfigurationNodeBase,
    "properties": {
      "application.shellEnvironmentResolutionTimeout": {
        "type": "number",
        "default": 10,
        "minimum": 1,
        "maximum": 120,
        "included": !isWindows,
        "scope": ConfigurationScope.APPLICATION,
        "markdownDescription": localize("application.shellEnvironmentResolutionTimeout", "Controls the timeout in seconds before giving up resolving the shell environment when the application is not already launched from a terminal. See our [documentation](https://go.microsoft.com/fwlink/?linkid=2149667) for more information.")
      }
    }
  });
  registry.registerConfiguration({
    "id": "window",
    "order": 8,
    "title": localize("windowConfigurationTitle", "Window"),
    "type": "object",
    "properties": {
      "window.confirmSaveUntitledWorkspace": {
        "type": "boolean",
        "default": true,
        "description": localize("confirmSaveUntitledWorkspace", "Controls whether a confirmation dialog shows asking to save or discard an opened untitled workspace in the window when switching to another workspace. Disabling the confirmation dialog will always discard the untitled workspace.")
      },
      "window.openWithoutArgumentsInNewWindow": {
        "type": "string",
        "enum": ["on", "off"],
        "enumDescriptions": [
          localize("window.openWithoutArgumentsInNewWindow.on", "Open a new empty window."),
          localize("window.openWithoutArgumentsInNewWindow.off", "Focus the last active running instance.")
        ],
        "default": isMacintosh ? "off" : "on",
        "scope": ConfigurationScope.APPLICATION,
        "markdownDescription": localize("openWithoutArgumentsInNewWindow", "Controls whether a new empty window should open when starting a second instance without arguments or if the last running instance should get focus.\nNote that there can still be cases where this setting is ignored (e.g. when using the `--new-window` or `--reuse-window` command line option).")
      },
      "window.restoreWindows": {
        "type": "string",
        "enum": ["preserve", "all", "folders", "one", "none"],
        "enumDescriptions": [
          localize("window.reopenFolders.preserve", "Always reopen all windows. If a folder or workspace is opened (e.g. from the command line) it opens as a new window unless it was opened before. If files are opened they will open in one of the restored windows together with editors that were previously opened."),
          localize("window.reopenFolders.all", "Reopen all windows unless a folder, workspace or file is opened (e.g. from the command line). If a file is opened, it will replace any of the editors that were previously opened in a window."),
          localize("window.reopenFolders.folders", "Reopen all windows that had folders or workspaces opened unless a folder, workspace or file is opened (e.g. from the command line). If a file is opened, it will replace any of the editors that were previously opened in a window."),
          localize("window.reopenFolders.one", "Reopen the last active window unless a folder, workspace or file is opened (e.g. from the command line). If a file is opened, it will replace any of the editors that were previously opened in a window."),
          localize("window.reopenFolders.none", "Never reopen a window. Unless a folder or workspace is opened (e.g. from the command line), an empty window will appear.")
        ],
        "default": "all",
        "scope": ConfigurationScope.APPLICATION,
        "description": localize("restoreWindows", "Controls how windows and editors within are being restored when opening.")
      },
      "window.restoreFullscreen": {
        "type": "boolean",
        "default": false,
        "scope": ConfigurationScope.APPLICATION,
        "description": localize("restoreFullscreen", "Controls whether a window should restore to full screen mode if it was exited in full screen mode.")
      },
      "window.zoomLevel": {
        "type": "number",
        "default": 0,
        "minimum": MIN_ZOOM_LEVEL,
        "maximum": MAX_ZOOM_LEVEL,
        "markdownDescription": localize({ comment: ["{0} will be a setting name rendered as a link"], key: "zoomLevel" }, "Adjust the default zoom level for all windows. Each increment above `0` (e.g. `1`) or below (e.g. `-1`) represents zooming `20%` larger or smaller. You can also enter decimals to adjust the zoom level with a finer granularity. See {0} for configuring if the 'Zoom In' and 'Zoom Out' commands apply the zoom level to all windows or only the active window.", "`#window.zoomPerWindow#`"),
        ignoreSync: true,
        tags: ["accessibility"]
      },
      "window.zoomPerWindow": {
        "type": "boolean",
        "default": true,
        "markdownDescription": localize({ comment: ["{0} will be a setting name rendered as a link"], key: "zoomPerWindow" }, "Controls if the 'Zoom In' and 'Zoom Out' commands apply the zoom level to all windows or only the active window. See {0} for configuring a default zoom level for all windows.", "`#window.zoomLevel#`"),
        tags: ["accessibility"]
      },
      "window.newWindowDimensions": {
        "type": "string",
        "enum": ["default", "inherit", "offset", "maximized", "fullscreen"],
        "enumDescriptions": [
          localize("window.newWindowDimensions.default", "Open new windows in the center of the screen."),
          localize("window.newWindowDimensions.inherit", "Open new windows with same dimension as last active one."),
          localize("window.newWindowDimensions.offset", "Open new windows with same dimension as last active one with an offset position."),
          localize("window.newWindowDimensions.maximized", "Open new windows maximized."),
          localize("window.newWindowDimensions.fullscreen", "Open new windows in full screen mode.")
        ],
        "default": "default",
        "scope": ConfigurationScope.APPLICATION,
        "description": localize("newWindowDimensions", "Controls the dimensions of opening a new window when at least one window is already opened. Note that this setting does not have an impact on the first window that is opened. The first window will always restore the size and location as you left it before closing.")
      },
      "window.closeWhenEmpty": {
        "type": "boolean",
        "default": false,
        "description": localize("closeWhenEmpty", "Controls whether closing the last editor should also close the window. This setting only applies for windows that do not show folders.")
      },
      "window.doubleClickIconToClose": {
        "type": "boolean",
        "default": false,
        "scope": ConfigurationScope.APPLICATION,
        "markdownDescription": localize("window.doubleClickIconToClose", "If enabled, this setting will close the window when the application icon in the title bar is double-clicked. The window will not be able to be dragged by the icon. This setting is effective only if {0} is set to `custom`.", "`#window.titleBarStyle#`")
      },
      "window.titleBarStyle": {
        "type": "string",
        "enum": ["native", "custom"],
        "default": "custom",
        "scope": ConfigurationScope.APPLICATION,
        "description": localize("titleBarStyle", "Adjust the appearance of the window title bar to be native by the OS or custom. On Linux and Windows, this setting also affects the application and context menu appearances. Changes require a full restart to apply.")
      },
      "window.controlsStyle": {
        "type": "string",
        "enum": ["native", "custom", "hidden"],
        "default": "native",
        "included": !isMacintosh,
        "scope": ConfigurationScope.APPLICATION,
        "description": localize("controlsStyle", "Adjust the appearance of the window controls to be native by the OS, custom drawn or hidden. Changes require a full restart to apply.")
      },
      "window.customTitleBarVisibility": {
        "type": "string",
        "enum": ["auto", "windowed", "never"],
        "markdownEnumDescriptions": [
          localize(`window.customTitleBarVisibility.auto`, "Automatically changes custom title bar visibility."),
          localize(`window.customTitleBarVisibility.windowed`, "Hide custom titlebar in full screen. When not in full screen, automatically change custom title bar visibility."),
          localize(`window.customTitleBarVisibility.never`, "Hide custom titlebar when {0} is set to `native`.", "`#window.titleBarStyle#`")
        ],
        "default": "auto",
        "scope": ConfigurationScope.APPLICATION,
        "markdownDescription": localize("window.customTitleBarVisibility", "Adjust when the custom title bar should be shown. The custom title bar can be hidden when in full screen mode with `windowed`. The custom title bar can only be hidden in non full screen mode with `never` when {0} is set to `native`.", "`#window.titleBarStyle#`")
      },
      "window.dialogStyle": {
        "type": "string",
        "enum": ["native", "custom"],
        "default": "native",
        "scope": ConfigurationScope.APPLICATION,
        "description": localize("dialogStyle", "Adjust the appearance of dialog windows.")
      },
      "window.nativeTabs": {
        "type": "boolean",
        "default": false,
        "scope": ConfigurationScope.APPLICATION,
        "description": localize("window.nativeTabs", "Enables macOS Sierra window tabs. Note that changes require a full restart to apply and that native tabs will disable a custom title bar style if configured."),
        "included": isMacintosh
      },
      "window.nativeFullScreen": {
        "type": "boolean",
        "default": true,
        "description": localize("window.nativeFullScreen", "Controls if native full-screen should be used on macOS. Disable this option to prevent macOS from creating a new space when going full-screen."),
        "scope": ConfigurationScope.APPLICATION,
        "included": isMacintosh
      },
      "window.clickThroughInactive": {
        "type": "boolean",
        "default": true,
        "scope": ConfigurationScope.APPLICATION,
        "description": localize("window.clickThroughInactive", "If enabled, clicking on an inactive window will both activate the window and trigger the element under the mouse if it is clickable. If disabled, clicking anywhere on an inactive window will activate it only and a second click is required on the element."),
        "included": isMacintosh
      }
    }
  });
  registry.registerConfiguration({
    "id": "telemetry",
    "order": 110,
    title: localize("telemetryConfigurationTitle", "Telemetry"),
    "type": "object",
    "properties": {
      "telemetry.enableCrashReporter": {
        "type": "boolean",
        "description": localize("telemetry.enableCrashReporting", "Enable crash reports to be collected. This helps us improve stability. \nThis option requires restart to take effect."),
        "default": true,
        "tags": ["usesOnlineServices", "telemetry"],
        "markdownDeprecationMessage": localize("enableCrashReporterDeprecated", "If this setting is false, no telemetry will be sent regardless of the new setting's value. Deprecated due to being combined into the {0} setting.", `\`#${TELEMETRY_SETTING_ID}#\``)
      }
    }
  });
  registry.registerConfiguration({
    "id": "keyboard",
    "order": 15,
    "type": "object",
    "title": localize("keyboardConfigurationTitle", "Keyboard"),
    "properties": {
      "keyboard.touchbar.enabled": {
        "type": "boolean",
        "default": true,
        "description": localize("touchbar.enabled", "Enables the macOS touchbar buttons on the keyboard if available."),
        "included": isMacintosh
      },
      "keyboard.touchbar.ignored": {
        "type": "array",
        "items": {
          "type": "string"
        },
        "default": [],
        "markdownDescription": localize("touchbar.ignored", "A set of identifiers for entries in the touchbar that should not show up (for example `workbench.action.navigateBack`)."),
        "included": isMacintosh
      }
    }
  });
  registry.registerConfiguration({
    ...securityConfigurationNodeBase,
    "properties": {
      "security.promptForLocalFileProtocolHandling": {
        "type": "boolean",
        "default": true,
        "markdownDescription": localize("security.promptForLocalFileProtocolHandling", "If enabled, a dialog will ask for confirmation whenever a local file or workspace is about to open through a protocol handler."),
        "scope": ConfigurationScope.APPLICATION
      },
      "security.promptForRemoteFileProtocolHandling": {
        "type": "boolean",
        "default": true,
        "markdownDescription": localize("security.promptForRemoteFileProtocolHandling", "If enabled, a dialog will ask for confirmation whenever a remote file or workspace is about to open through a protocol handler."),
        "scope": ConfigurationScope.APPLICATION
      }
    }
  });
})();
(function registerJSONSchemas() {
  const argvDefinitionFileSchemaId = "vscode://schemas/argv";
  const jsonRegistry = Registry.as(JSONExtensions.JSONContribution);
  const schema = {
    id: argvDefinitionFileSchemaId,
    allowComments: true,
    allowTrailingCommas: true,
    description: "VSCode static command line definition file",
    type: "object",
    additionalProperties: false,
    properties: {
      locale: {
        type: "string",
        description: localize("argv.locale", "The display Language to use. Picking a different language requires the associated language pack to be installed.")
      },
      "disable-lcd-text": {
        type: "boolean",
        description: localize("argv.disableLcdText", "Disables LCD font antialiasing.")
      },
      "proxy-bypass-list": {
        type: "string",
        description: localize("argv.proxyBypassList", 'Bypass any specified proxy for the given semi-colon-separated list of hosts. Example value "<local>;*.microsoft.com;*foo.com;1.2.3.4:5678", will use the proxy server for all hosts except for local addresses (localhost, 127.0.0.1 etc.), microsoft.com subdomains, hosts that contain the suffix foo.com and anything at 1.2.3.4:5678')
      },
      "disable-hardware-acceleration": {
        type: "boolean",
        description: localize("argv.disableHardwareAcceleration", "Disables hardware acceleration. ONLY change this option if you encounter graphic issues.")
      },
      "force-color-profile": {
        type: "string",
        markdownDescription: localize("argv.forceColorProfile", "Allows to override the color profile to use. If you experience colors appear badly, try to set this to `srgb` and restart.")
      },
      "enable-crash-reporter": {
        type: "boolean",
        markdownDescription: localize("argv.enableCrashReporter", "Allows to disable crash reporting, should restart the app if the value is changed.")
      },
      "crash-reporter-id": {
        type: "string",
        markdownDescription: localize("argv.crashReporterId", "Unique id used for correlating crash reports sent from this app instance.")
      },
      "enable-proposed-api": {
        type: "array",
        description: localize("argv.enebleProposedApi", "Enable proposed APIs for a list of extension ids (such as `vscode.git`). Proposed APIs are unstable and subject to breaking without warning at any time. This should only be set for extension development and testing purposes."),
        items: {
          type: "string"
        }
      },
      "log-level": {
        type: ["string", "array"],
        description: localize("argv.logLevel", "Log level to use. Default is 'info'. Allowed values are 'error', 'warn', 'info', 'debug', 'trace', 'off'.")
      },
      "disable-chromium-sandbox": {
        type: "boolean",
        description: localize("argv.disableChromiumSandbox", "Disables the Chromium sandbox. This is useful when running VS Code as elevated on Linux and running under Applocker on Windows.")
      },
      "use-inmemory-secretstorage": {
        type: "boolean",
        description: localize("argv.useInMemorySecretStorage", "Ensures that an in-memory store will be used for secret storage instead of using the OS's credential store. This is often used when running VS Code extension tests or when you're experiencing difficulties with the credential store.")
      }
    }
  };
  if (isLinux) {
    schema.properties["force-renderer-accessibility"] = {
      type: "boolean",
      description: localize("argv.force-renderer-accessibility", "Forces the renderer to be accessible. ONLY change this if you are using a screen reader on Linux. On other platforms the renderer will automatically be accessible. This flag is automatically set if you have editor.accessibilitySupport: on.")
    };
    schema.properties["password-store"] = {
      type: "string",
      description: localize("argv.passwordStore", "Configures the backend used to store secrets on Linux. This argument is ignored on Windows & macOS.")
    };
  }
  jsonRegistry.registerSchema(argvDefinitionFileSchemaId, schema);
})();
(function registerWorkbenchContributions() {
  registerWorkbenchContribution2("workbench.contributions.defaultAccountManagement", DefaultAccountManagementContribution, WorkbenchPhase.AfterRestored);
})();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvZWxlY3Ryb24tc2FuZGJveC9kZXNrdG9wLmNvbnRyaWJ1dGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgTWVudVJlZ2lzdHJ5LCBNZW51SWQsIHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25SZWdpc3RyeSwgRXh0ZW5zaW9ucyBhcyBDb25maWd1cmF0aW9uRXh0ZW5zaW9ucywgQ29uZmlndXJhdGlvblNjb3BlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IEtleU1vZCwgS2V5Q29kZSB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IGlzTGludXgsIGlzTWFjaW50b3NoLCBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmVSdW50aW1lQXJndW1lbnRzQWN0aW9uLCBUb2dnbGVEZXZUb29sc0FjdGlvbiwgUmVsb2FkV2luZG93V2l0aEV4dGVuc2lvbnNEaXNhYmxlZEFjdGlvbiwgT3BlblVzZXJEYXRhRm9sZGVyQWN0aW9uLCBTaG93R1BVSW5mb0FjdGlvbiB9IGZyb20gJy4vYWN0aW9ucy9kZXZlbG9wZXJBY3Rpb25zLmpzJztcbmltcG9ydCB7IFpvb21SZXNldEFjdGlvbiwgWm9vbU91dEFjdGlvbiwgWm9vbUluQWN0aW9uLCBDbG9zZVdpbmRvd0FjdGlvbiwgU3dpdGNoV2luZG93QWN0aW9uLCBRdWlja1N3aXRjaFdpbmRvd0FjdGlvbiwgTmV3V2luZG93VGFiSGFuZGxlciwgU2hvd1ByZXZpb3VzV2luZG93VGFiSGFuZGxlciwgU2hvd05leHRXaW5kb3dUYWJIYW5kbGVyLCBNb3ZlV2luZG93VGFiVG9OZXdXaW5kb3dIYW5kbGVyLCBNZXJnZVdpbmRvd1RhYnNIYW5kbGVySGFuZGxlciwgVG9nZ2xlV2luZG93VGFic0JhckhhbmRsZXIgfSBmcm9tICcuL2FjdGlvbnMvd2luZG93QWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ3NSZWdpc3RyeSwgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNSZWdpc3RyeSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJc01hY0NvbnRleHQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBJTmF0aXZlSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9uYXRpdmUvY29tbW9uL25hdGl2ZS5qcyc7XG5pbXBvcnQgeyBJSlNPTkNvbnRyaWJ1dGlvblJlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIEpTT05FeHRlbnNpb25zIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vanNvbnNjaGVtYXMvY29tbW9uL2pzb25Db250cmlidXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJSlNPTlNjaGVtYSB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuaW1wb3J0IHsgSW5zdGFsbFNoZWxsU2NyaXB0QWN0aW9uLCBVbmluc3RhbGxTaGVsbFNjcmlwdEFjdGlvbiB9IGZyb20gJy4vYWN0aW9ucy9pbnN0YWxsQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JzVmlzaWJsZUNvbnRleHQsIFNpbmdsZUVkaXRvckdyb3Vwc0NvbnRleHQgfSBmcm9tICcuLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgVEVMRU1FVFJZX1NFVFRJTkdfSUQgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IFNodXRkb3duUmVhc29uIH0gZnJvbSAnLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgTmF0aXZlV2luZG93IH0gZnJvbSAnLi93aW5kb3cuanMnO1xuaW1wb3J0IHsgTW9kaWZpZXJLZXlFbWl0dGVyIH0gZnJvbSAnLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBhcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb25Ob2RlQmFzZSwgc2VjdXJpdHlDb25maWd1cmF0aW9uTm9kZUJhc2UgfSBmcm9tICcuLi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBNQVhfWk9PTV9MRVZFTCwgTUlOX1pPT01fTEVWRUwgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS93aW5kb3cvZWxlY3Ryb24tc2FuZGJveC93aW5kb3cuanMnO1xuaW1wb3J0IHsgRGVmYXVsdEFjY291bnRNYW5hZ2VtZW50Q29udHJpYnV0aW9uIH0gZnJvbSAnLi4vc2VydmljZXMvYWNjb3VudHMvY29tbW9uL2RlZmF1bHRBY2NvdW50LmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMiwgV29ya2JlbmNoUGhhc2UgfSBmcm9tICcuLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5cbi8vIEFjdGlvbnNcbihmdW5jdGlvbiByZWdpc3RlckFjdGlvbnMoKTogdm9pZCB7XG5cblx0Ly8gQWN0aW9uczogWm9vbVxuXHRyZWdpc3RlckFjdGlvbjIoWm9vbUluQWN0aW9uKTtcblx0cmVnaXN0ZXJBY3Rpb24yKFpvb21PdXRBY3Rpb24pO1xuXHRyZWdpc3RlckFjdGlvbjIoWm9vbVJlc2V0QWN0aW9uKTtcblxuXHQvLyBBY3Rpb25zOiBXaW5kb3dcblx0cmVnaXN0ZXJBY3Rpb24yKFN3aXRjaFdpbmRvd0FjdGlvbik7XG5cdHJlZ2lzdGVyQWN0aW9uMihRdWlja1N3aXRjaFdpbmRvd0FjdGlvbik7XG5cdHJlZ2lzdGVyQWN0aW9uMihDbG9zZVdpbmRvd0FjdGlvbik7XG5cblx0aWYgKGlzTWFjaW50b3NoKSB7XG5cdFx0Ly8gbWFjT1M6IGJlaGF2ZSBsaWtlIG90aGVyIG5hdGl2ZSBhcHBzIHRoYXQgaGF2ZSBkb2N1bWVudHNcblx0XHQvLyBidXQgY2FuIHJ1biB3aXRob3V0IGEgZG9jdW1lbnQgb3BlbmVkIGFuZCBhbGxvdyB0byBjbG9zZVxuXHRcdC8vIHRoZSB3aW5kb3cgd2hlbiB0aGUgbGFzdCBkb2N1bWVudCBpcyBjbG9zZWRcblx0XHQvLyAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEyNjA0Milcblx0XHRLZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyS2V5YmluZGluZ1J1bGUoe1xuXHRcdFx0aWQ6IENsb3NlV2luZG93QWN0aW9uLklELFxuXHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoRWRpdG9yc1Zpc2libGVDb250ZXh0LnRvTmVnYXRlZCgpLCBTaW5nbGVFZGl0b3JHcm91cHNDb250ZXh0KSxcblx0XHRcdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlXXG5cdFx0fSk7XG5cdH1cblxuXHQvLyBBY3Rpb25zOiBJbnN0YWxsIFNoZWxsIFNjcmlwdCAobWFjT1Mgb25seSlcblx0aWYgKGlzTWFjaW50b3NoKSB7XG5cdFx0cmVnaXN0ZXJBY3Rpb24yKEluc3RhbGxTaGVsbFNjcmlwdEFjdGlvbik7XG5cdFx0cmVnaXN0ZXJBY3Rpb24yKFVuaW5zdGFsbFNoZWxsU2NyaXB0QWN0aW9uKTtcblx0fVxuXG5cdC8vIFF1aXRcblx0S2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmRBbmRLZXliaW5kaW5nUnVsZSh7XG5cdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnF1aXQnLFxuXHRcdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliLFxuXHRcdGFzeW5jIGhhbmRsZXIoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRcdGNvbnN0IG5hdGl2ZUhvc3RTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElOYXRpdmVIb3N0U2VydmljZSk7XG5cdFx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXG5cdFx0XHRjb25zdCBjb25maXJtQmVmb3JlQ2xvc2UgPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTwnYWx3YXlzJyB8ICduZXZlcicgfCAna2V5Ym9hcmRPbmx5Jz4oJ3dpbmRvdy5jb25maXJtQmVmb3JlQ2xvc2UnKTtcblx0XHRcdGlmIChjb25maXJtQmVmb3JlQ2xvc2UgPT09ICdhbHdheXMnIHx8IChjb25maXJtQmVmb3JlQ2xvc2UgPT09ICdrZXlib2FyZE9ubHknICYmIE1vZGlmaWVyS2V5RW1pdHRlci5nZXRJbnN0YW5jZSgpLmlzTW9kaWZpZXJQcmVzc2VkKSkge1xuXHRcdFx0XHRjb25zdCBjb25maXJtZWQgPSBhd2FpdCBOYXRpdmVXaW5kb3cuY29uZmlybU9uU2h1dGRvd24oYWNjZXNzb3IsIFNodXRkb3duUmVhc29uLlFVSVQpO1xuXHRcdFx0XHRpZiAoIWNvbmZpcm1lZCkge1xuXHRcdFx0XHRcdHJldHVybjsgLy8gcXVpdCBwcmV2ZW50ZWQgYnkgdXNlclxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdG5hdGl2ZUhvc3RTZXJ2aWNlLnF1aXQoKTtcblx0XHR9LFxuXHRcdHdoZW46IHVuZGVmaW5lZCxcblx0XHRtYWM6IHsgcHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleVEgfSxcblx0XHRsaW51eDogeyBwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5USB9XG5cdH0pO1xuXG5cdC8vIEFjdGlvbnM6IG1hY09TIE5hdGl2ZSBUYWJzXG5cdGlmIChpc01hY2ludG9zaCkge1xuXHRcdGZvciAoY29uc3QgY29tbWFuZCBvZiBbXG5cdFx0XHR7IGhhbmRsZXI6IE5ld1dpbmRvd1RhYkhhbmRsZXIsIGlkOiAnd29ya2JlbmNoLmFjdGlvbi5uZXdXaW5kb3dUYWInLCB0aXRsZTogbG9jYWxpemUyKCduZXdUYWInLCAnTmV3IFdpbmRvdyBUYWInKSB9LFxuXHRcdFx0eyBoYW5kbGVyOiBTaG93UHJldmlvdXNXaW5kb3dUYWJIYW5kbGVyLCBpZDogJ3dvcmtiZW5jaC5hY3Rpb24uc2hvd1ByZXZpb3VzV2luZG93VGFiJywgdGl0bGU6IGxvY2FsaXplMignc2hvd1ByZXZpb3VzVGFiJywgJ1Nob3cgUHJldmlvdXMgV2luZG93IFRhYicpIH0sXG5cdFx0XHR7IGhhbmRsZXI6IFNob3dOZXh0V2luZG93VGFiSGFuZGxlciwgaWQ6ICd3b3JrYmVuY2guYWN0aW9uLnNob3dOZXh0V2luZG93VGFiJywgdGl0bGU6IGxvY2FsaXplMignc2hvd05leHRXaW5kb3dUYWInLCAnU2hvdyBOZXh0IFdpbmRvdyBUYWInKSB9LFxuXHRcdFx0eyBoYW5kbGVyOiBNb3ZlV2luZG93VGFiVG9OZXdXaW5kb3dIYW5kbGVyLCBpZDogJ3dvcmtiZW5jaC5hY3Rpb24ubW92ZVdpbmRvd1RhYlRvTmV3V2luZG93JywgdGl0bGU6IGxvY2FsaXplMignbW92ZVdpbmRvd1RhYlRvTmV3V2luZG93JywgJ01vdmUgV2luZG93IFRhYiB0byBOZXcgV2luZG93JykgfSxcblx0XHRcdHsgaGFuZGxlcjogTWVyZ2VXaW5kb3dUYWJzSGFuZGxlckhhbmRsZXIsIGlkOiAnd29ya2JlbmNoLmFjdGlvbi5tZXJnZUFsbFdpbmRvd1RhYnMnLCB0aXRsZTogbG9jYWxpemUyKCdtZXJnZUFsbFdpbmRvd1RhYnMnLCAnTWVyZ2UgQWxsIFdpbmRvd3MnKSB9LFxuXHRcdFx0eyBoYW5kbGVyOiBUb2dnbGVXaW5kb3dUYWJzQmFySGFuZGxlciwgaWQ6ICd3b3JrYmVuY2guYWN0aW9uLnRvZ2dsZVdpbmRvd1RhYnNCYXInLCB0aXRsZTogbG9jYWxpemUyKCd0b2dnbGVXaW5kb3dUYWJzQmFyJywgJ1RvZ2dsZSBXaW5kb3cgVGFicyBCYXInKSB9XG5cdFx0XSkge1xuXHRcdFx0Q29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoY29tbWFuZC5pZCwgY29tbWFuZC5oYW5kbGVyKTtcblxuXHRcdFx0TWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5Db21tYW5kUGFsZXR0ZSwge1xuXHRcdFx0XHRjb21tYW5kLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2NvbmZpZy53aW5kb3cubmF0aXZlVGFicycsIHRydWUpXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHQvLyBBY3Rpb25zOiBEZXZlbG9wZXJcblx0cmVnaXN0ZXJBY3Rpb24yKFJlbG9hZFdpbmRvd1dpdGhFeHRlbnNpb25zRGlzYWJsZWRBY3Rpb24pO1xuXHRyZWdpc3RlckFjdGlvbjIoQ29uZmlndXJlUnVudGltZUFyZ3VtZW50c0FjdGlvbik7XG5cdHJlZ2lzdGVyQWN0aW9uMihUb2dnbGVEZXZUb29sc0FjdGlvbik7XG5cdHJlZ2lzdGVyQWN0aW9uMihPcGVuVXNlckRhdGFGb2xkZXJBY3Rpb24pO1xuXHRyZWdpc3RlckFjdGlvbjIoU2hvd0dQVUluZm9BY3Rpb24pO1xufSkoKTtcblxuLy8gTWVudVxuKGZ1bmN0aW9uIHJlZ2lzdGVyTWVudSgpOiB2b2lkIHtcblxuXHQvLyBRdWl0XG5cdE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuTWVudWJhckZpbGVNZW51LCB7XG5cdFx0Z3JvdXA6ICd6X0V4aXQnLFxuXHRcdGNvbW1hbmQ6IHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5xdWl0Jyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pRXhpdCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJFJiZ4aXRcIilcblx0XHR9LFxuXHRcdG9yZGVyOiAxLFxuXHRcdHdoZW46IElzTWFjQ29udGV4dC50b05lZ2F0ZWQoKVxuXHR9KTtcbn0pKCk7XG5cbi8vIENvbmZpZ3VyYXRpb25cbihmdW5jdGlvbiByZWdpc3RlckNvbmZpZ3VyYXRpb24oKTogdm9pZCB7XG5cdGNvbnN0IHJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbik7XG5cblx0Ly8gQXBwbGljYXRpb25cblx0cmVnaXN0cnkucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0XHQuLi5hcHBsaWNhdGlvbkNvbmZpZ3VyYXRpb25Ob2RlQmFzZSxcblx0XHQncHJvcGVydGllcyc6IHtcblx0XHRcdCdhcHBsaWNhdGlvbi5zaGVsbEVudmlyb25tZW50UmVzb2x1dGlvblRpbWVvdXQnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ251bWJlcicsXG5cdFx0XHRcdCdkZWZhdWx0JzogMTAsXG5cdFx0XHRcdCdtaW5pbXVtJzogMSxcblx0XHRcdFx0J21heGltdW0nOiAxMjAsXG5cdFx0XHRcdCdpbmNsdWRlZCc6ICFpc1dpbmRvd3MsXG5cdFx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5BUFBMSUNBVElPTixcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnYXBwbGljYXRpb24uc2hlbGxFbnZpcm9ubWVudFJlc29sdXRpb25UaW1lb3V0JywgXCJDb250cm9scyB0aGUgdGltZW91dCBpbiBzZWNvbmRzIGJlZm9yZSBnaXZpbmcgdXAgcmVzb2x2aW5nIHRoZSBzaGVsbCBlbnZpcm9ubWVudCB3aGVuIHRoZSBhcHBsaWNhdGlvbiBpcyBub3QgYWxyZWFkeSBsYXVuY2hlZCBmcm9tIGEgdGVybWluYWwuIFNlZSBvdXIgW2RvY3VtZW50YXRpb25dKGh0dHBzOi8vZ28ubWljcm9zb2Z0LmNvbS9md2xpbmsvP2xpbmtpZD0yMTQ5NjY3KSBmb3IgbW9yZSBpbmZvcm1hdGlvbi5cIilcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdC8vIFdpbmRvd1xuXHRyZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRcdCdpZCc6ICd3aW5kb3cnLFxuXHRcdCdvcmRlcic6IDgsXG5cdFx0J3RpdGxlJzogbG9jYWxpemUoJ3dpbmRvd0NvbmZpZ3VyYXRpb25UaXRsZScsIFwiV2luZG93XCIpLFxuXHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHQnd2luZG93LmNvbmZpcm1TYXZlVW50aXRsZWRXb3Jrc3BhY2UnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHQnZGVmYXVsdCc6IHRydWUsXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCdjb25maXJtU2F2ZVVudGl0bGVkV29ya3NwYWNlJywgXCJDb250cm9scyB3aGV0aGVyIGEgY29uZmlybWF0aW9uIGRpYWxvZyBzaG93cyBhc2tpbmcgdG8gc2F2ZSBvciBkaXNjYXJkIGFuIG9wZW5lZCB1bnRpdGxlZCB3b3Jrc3BhY2UgaW4gdGhlIHdpbmRvdyB3aGVuIHN3aXRjaGluZyB0byBhbm90aGVyIHdvcmtzcGFjZS4gRGlzYWJsaW5nIHRoZSBjb25maXJtYXRpb24gZGlhbG9nIHdpbGwgYWx3YXlzIGRpc2NhcmQgdGhlIHVudGl0bGVkIHdvcmtzcGFjZS5cIiksXG5cdFx0XHR9LFxuXHRcdFx0J3dpbmRvdy5vcGVuV2l0aG91dEFyZ3VtZW50c0luTmV3V2luZG93Jzoge1xuXHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHQnZW51bSc6IFsnb24nLCAnb2ZmJ10sXG5cdFx0XHRcdCdlbnVtRGVzY3JpcHRpb25zJzogW1xuXHRcdFx0XHRcdGxvY2FsaXplKCd3aW5kb3cub3BlbldpdGhvdXRBcmd1bWVudHNJbk5ld1dpbmRvdy5vbicsIFwiT3BlbiBhIG5ldyBlbXB0eSB3aW5kb3cuXCIpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCd3aW5kb3cub3BlbldpdGhvdXRBcmd1bWVudHNJbk5ld1dpbmRvdy5vZmYnLCBcIkZvY3VzIHRoZSBsYXN0IGFjdGl2ZSBydW5uaW5nIGluc3RhbmNlLlwiKVxuXHRcdFx0XHRdLFxuXHRcdFx0XHQnZGVmYXVsdCc6IGlzTWFjaW50b3NoID8gJ29mZicgOiAnb24nLFxuXHRcdFx0XHQnc2NvcGUnOiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT04sXG5cdFx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbG9jYWxpemUoJ29wZW5XaXRob3V0QXJndW1lbnRzSW5OZXdXaW5kb3cnLCBcIkNvbnRyb2xzIHdoZXRoZXIgYSBuZXcgZW1wdHkgd2luZG93IHNob3VsZCBvcGVuIHdoZW4gc3RhcnRpbmcgYSBzZWNvbmQgaW5zdGFuY2Ugd2l0aG91dCBhcmd1bWVudHMgb3IgaWYgdGhlIGxhc3QgcnVubmluZyBpbnN0YW5jZSBzaG91bGQgZ2V0IGZvY3VzLlxcbk5vdGUgdGhhdCB0aGVyZSBjYW4gc3RpbGwgYmUgY2FzZXMgd2hlcmUgdGhpcyBzZXR0aW5nIGlzIGlnbm9yZWQgKGUuZy4gd2hlbiB1c2luZyB0aGUgYC0tbmV3LXdpbmRvd2Agb3IgYC0tcmV1c2Utd2luZG93YCBjb21tYW5kIGxpbmUgb3B0aW9uKS5cIilcblx0XHRcdH0sXG5cdFx0XHQnd2luZG93LnJlc3RvcmVXaW5kb3dzJzoge1xuXHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHQnZW51bSc6IFsncHJlc2VydmUnLCAnYWxsJywgJ2ZvbGRlcnMnLCAnb25lJywgJ25vbmUnXSxcblx0XHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dpbmRvdy5yZW9wZW5Gb2xkZXJzLnByZXNlcnZlJywgXCJBbHdheXMgcmVvcGVuIGFsbCB3aW5kb3dzLiBJZiBhIGZvbGRlciBvciB3b3Jrc3BhY2UgaXMgb3BlbmVkIChlLmcuIGZyb20gdGhlIGNvbW1hbmQgbGluZSkgaXQgb3BlbnMgYXMgYSBuZXcgd2luZG93IHVubGVzcyBpdCB3YXMgb3BlbmVkIGJlZm9yZS4gSWYgZmlsZXMgYXJlIG9wZW5lZCB0aGV5IHdpbGwgb3BlbiBpbiBvbmUgb2YgdGhlIHJlc3RvcmVkIHdpbmRvd3MgdG9nZXRoZXIgd2l0aCBlZGl0b3JzIHRoYXQgd2VyZSBwcmV2aW91c2x5IG9wZW5lZC5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dpbmRvdy5yZW9wZW5Gb2xkZXJzLmFsbCcsIFwiUmVvcGVuIGFsbCB3aW5kb3dzIHVubGVzcyBhIGZvbGRlciwgd29ya3NwYWNlIG9yIGZpbGUgaXMgb3BlbmVkIChlLmcuIGZyb20gdGhlIGNvbW1hbmQgbGluZSkuIElmIGEgZmlsZSBpcyBvcGVuZWQsIGl0IHdpbGwgcmVwbGFjZSBhbnkgb2YgdGhlIGVkaXRvcnMgdGhhdCB3ZXJlIHByZXZpb3VzbHkgb3BlbmVkIGluIGEgd2luZG93LlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd2luZG93LnJlb3BlbkZvbGRlcnMuZm9sZGVycycsIFwiUmVvcGVuIGFsbCB3aW5kb3dzIHRoYXQgaGFkIGZvbGRlcnMgb3Igd29ya3NwYWNlcyBvcGVuZWQgdW5sZXNzIGEgZm9sZGVyLCB3b3Jrc3BhY2Ugb3IgZmlsZSBpcyBvcGVuZWQgKGUuZy4gZnJvbSB0aGUgY29tbWFuZCBsaW5lKS4gSWYgYSBmaWxlIGlzIG9wZW5lZCwgaXQgd2lsbCByZXBsYWNlIGFueSBvZiB0aGUgZWRpdG9ycyB0aGF0IHdlcmUgcHJldmlvdXNseSBvcGVuZWQgaW4gYSB3aW5kb3cuXCIpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCd3aW5kb3cucmVvcGVuRm9sZGVycy5vbmUnLCBcIlJlb3BlbiB0aGUgbGFzdCBhY3RpdmUgd2luZG93IHVubGVzcyBhIGZvbGRlciwgd29ya3NwYWNlIG9yIGZpbGUgaXMgb3BlbmVkIChlLmcuIGZyb20gdGhlIGNvbW1hbmQgbGluZSkuIElmIGEgZmlsZSBpcyBvcGVuZWQsIGl0IHdpbGwgcmVwbGFjZSBhbnkgb2YgdGhlIGVkaXRvcnMgdGhhdCB3ZXJlIHByZXZpb3VzbHkgb3BlbmVkIGluIGEgd2luZG93LlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd2luZG93LnJlb3BlbkZvbGRlcnMubm9uZScsIFwiTmV2ZXIgcmVvcGVuIGEgd2luZG93LiBVbmxlc3MgYSBmb2xkZXIgb3Igd29ya3NwYWNlIGlzIG9wZW5lZCAoZS5nLiBmcm9tIHRoZSBjb21tYW5kIGxpbmUpLCBhbiBlbXB0eSB3aW5kb3cgd2lsbCBhcHBlYXIuXCIpXG5cdFx0XHRcdF0sXG5cdFx0XHRcdCdkZWZhdWx0JzogJ2FsbCcsXG5cdFx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5BUFBMSUNBVElPTixcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ3Jlc3RvcmVXaW5kb3dzJywgXCJDb250cm9scyBob3cgd2luZG93cyBhbmQgZWRpdG9ycyB3aXRoaW4gYXJlIGJlaW5nIHJlc3RvcmVkIHdoZW4gb3BlbmluZy5cIilcblx0XHRcdH0sXG5cdFx0XHQnd2luZG93LnJlc3RvcmVGdWxsc2NyZWVuJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2RlZmF1bHQnOiBmYWxzZSxcblx0XHRcdFx0J3Njb3BlJzogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgncmVzdG9yZUZ1bGxzY3JlZW4nLCBcIkNvbnRyb2xzIHdoZXRoZXIgYSB3aW5kb3cgc2hvdWxkIHJlc3RvcmUgdG8gZnVsbCBzY3JlZW4gbW9kZSBpZiBpdCB3YXMgZXhpdGVkIGluIGZ1bGwgc2NyZWVuIG1vZGUuXCIpXG5cdFx0XHR9LFxuXHRcdFx0J3dpbmRvdy56b29tTGV2ZWwnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ251bWJlcicsXG5cdFx0XHRcdCdkZWZhdWx0JzogMCxcblx0XHRcdFx0J21pbmltdW0nOiBNSU5fWk9PTV9MRVZFTCxcblx0XHRcdFx0J21heGltdW0nOiBNQVhfWk9PTV9MRVZFTCxcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSh7IGNvbW1lbnQ6IFsnezB9IHdpbGwgYmUgYSBzZXR0aW5nIG5hbWUgcmVuZGVyZWQgYXMgYSBsaW5rJ10sIGtleTogJ3pvb21MZXZlbCcgfSwgXCJBZGp1c3QgdGhlIGRlZmF1bHQgem9vbSBsZXZlbCBmb3IgYWxsIHdpbmRvd3MuIEVhY2ggaW5jcmVtZW50IGFib3ZlIGAwYCAoZS5nLiBgMWApIG9yIGJlbG93IChlLmcuIGAtMWApIHJlcHJlc2VudHMgem9vbWluZyBgMjAlYCBsYXJnZXIgb3Igc21hbGxlci4gWW91IGNhbiBhbHNvIGVudGVyIGRlY2ltYWxzIHRvIGFkanVzdCB0aGUgem9vbSBsZXZlbCB3aXRoIGEgZmluZXIgZ3JhbnVsYXJpdHkuIFNlZSB7MH0gZm9yIGNvbmZpZ3VyaW5nIGlmIHRoZSAnWm9vbSBJbicgYW5kICdab29tIE91dCcgY29tbWFuZHMgYXBwbHkgdGhlIHpvb20gbGV2ZWwgdG8gYWxsIHdpbmRvd3Mgb3Igb25seSB0aGUgYWN0aXZlIHdpbmRvdy5cIiwgJ2Ajd2luZG93Lnpvb21QZXJXaW5kb3cjYCcpLFxuXHRcdFx0XHRpZ25vcmVTeW5jOiB0cnVlLFxuXHRcdFx0XHR0YWdzOiBbJ2FjY2Vzc2liaWxpdHknXVxuXHRcdFx0fSxcblx0XHRcdCd3aW5kb3cuem9vbVBlcldpbmRvdyc6IHtcblx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdCdkZWZhdWx0JzogdHJ1ZSxcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSh7IGNvbW1lbnQ6IFsnezB9IHdpbGwgYmUgYSBzZXR0aW5nIG5hbWUgcmVuZGVyZWQgYXMgYSBsaW5rJ10sIGtleTogJ3pvb21QZXJXaW5kb3cnIH0sIFwiQ29udHJvbHMgaWYgdGhlICdab29tIEluJyBhbmQgJ1pvb20gT3V0JyBjb21tYW5kcyBhcHBseSB0aGUgem9vbSBsZXZlbCB0byBhbGwgd2luZG93cyBvciBvbmx5IHRoZSBhY3RpdmUgd2luZG93LiBTZWUgezB9IGZvciBjb25maWd1cmluZyBhIGRlZmF1bHQgem9vbSBsZXZlbCBmb3IgYWxsIHdpbmRvd3MuXCIsICdgI3dpbmRvdy56b29tTGV2ZWwjYCcpLFxuXHRcdFx0XHR0YWdzOiBbJ2FjY2Vzc2liaWxpdHknXVxuXHRcdFx0fSxcblx0XHRcdCd3aW5kb3cubmV3V2luZG93RGltZW5zaW9ucyc6IHtcblx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0J2VudW0nOiBbJ2RlZmF1bHQnLCAnaW5oZXJpdCcsICdvZmZzZXQnLCAnbWF4aW1pemVkJywgJ2Z1bGxzY3JlZW4nXSxcblx0XHRcdFx0J2VudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dpbmRvdy5uZXdXaW5kb3dEaW1lbnNpb25zLmRlZmF1bHQnLCBcIk9wZW4gbmV3IHdpbmRvd3MgaW4gdGhlIGNlbnRlciBvZiB0aGUgc2NyZWVuLlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd2luZG93Lm5ld1dpbmRvd0RpbWVuc2lvbnMuaW5oZXJpdCcsIFwiT3BlbiBuZXcgd2luZG93cyB3aXRoIHNhbWUgZGltZW5zaW9uIGFzIGxhc3QgYWN0aXZlIG9uZS5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dpbmRvdy5uZXdXaW5kb3dEaW1lbnNpb25zLm9mZnNldCcsIFwiT3BlbiBuZXcgd2luZG93cyB3aXRoIHNhbWUgZGltZW5zaW9uIGFzIGxhc3QgYWN0aXZlIG9uZSB3aXRoIGFuIG9mZnNldCBwb3NpdGlvbi5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dpbmRvdy5uZXdXaW5kb3dEaW1lbnNpb25zLm1heGltaXplZCcsIFwiT3BlbiBuZXcgd2luZG93cyBtYXhpbWl6ZWQuXCIpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCd3aW5kb3cubmV3V2luZG93RGltZW5zaW9ucy5mdWxsc2NyZWVuJywgXCJPcGVuIG5ldyB3aW5kb3dzIGluIGZ1bGwgc2NyZWVuIG1vZGUuXCIpXG5cdFx0XHRcdF0sXG5cdFx0XHRcdCdkZWZhdWx0JzogJ2RlZmF1bHQnLFxuXHRcdFx0XHQnc2NvcGUnOiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT04sXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCduZXdXaW5kb3dEaW1lbnNpb25zJywgXCJDb250cm9scyB0aGUgZGltZW5zaW9ucyBvZiBvcGVuaW5nIGEgbmV3IHdpbmRvdyB3aGVuIGF0IGxlYXN0IG9uZSB3aW5kb3cgaXMgYWxyZWFkeSBvcGVuZWQuIE5vdGUgdGhhdCB0aGlzIHNldHRpbmcgZG9lcyBub3QgaGF2ZSBhbiBpbXBhY3Qgb24gdGhlIGZpcnN0IHdpbmRvdyB0aGF0IGlzIG9wZW5lZC4gVGhlIGZpcnN0IHdpbmRvdyB3aWxsIGFsd2F5cyByZXN0b3JlIHRoZSBzaXplIGFuZCBsb2NhdGlvbiBhcyB5b3UgbGVmdCBpdCBiZWZvcmUgY2xvc2luZy5cIilcblx0XHRcdH0sXG5cdFx0XHQnd2luZG93LmNsb3NlV2hlbkVtcHR5Jzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2RlZmF1bHQnOiBmYWxzZSxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2Nsb3NlV2hlbkVtcHR5JywgXCJDb250cm9scyB3aGV0aGVyIGNsb3NpbmcgdGhlIGxhc3QgZWRpdG9yIHNob3VsZCBhbHNvIGNsb3NlIHRoZSB3aW5kb3cuIFRoaXMgc2V0dGluZyBvbmx5IGFwcGxpZXMgZm9yIHdpbmRvd3MgdGhhdCBkbyBub3Qgc2hvdyBmb2xkZXJzLlwiKVxuXHRcdFx0fSxcblx0XHRcdCd3aW5kb3cuZG91YmxlQ2xpY2tJY29uVG9DbG9zZSc6IHtcblx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdCdkZWZhdWx0JzogZmFsc2UsXG5cdFx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5BUFBMSUNBVElPTixcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnd2luZG93LmRvdWJsZUNsaWNrSWNvblRvQ2xvc2UnLCBcIklmIGVuYWJsZWQsIHRoaXMgc2V0dGluZyB3aWxsIGNsb3NlIHRoZSB3aW5kb3cgd2hlbiB0aGUgYXBwbGljYXRpb24gaWNvbiBpbiB0aGUgdGl0bGUgYmFyIGlzIGRvdWJsZS1jbGlja2VkLiBUaGUgd2luZG93IHdpbGwgbm90IGJlIGFibGUgdG8gYmUgZHJhZ2dlZCBieSB0aGUgaWNvbi4gVGhpcyBzZXR0aW5nIGlzIGVmZmVjdGl2ZSBvbmx5IGlmIHswfSBpcyBzZXQgdG8gYGN1c3RvbWAuXCIsICdgI3dpbmRvdy50aXRsZUJhclN0eWxlI2AnKVxuXHRcdFx0fSxcblx0XHRcdCd3aW5kb3cudGl0bGVCYXJTdHlsZSc6IHtcblx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0J2VudW0nOiBbJ25hdGl2ZScsICdjdXN0b20nXSxcblx0XHRcdFx0J2RlZmF1bHQnOiAnY3VzdG9tJyxcblx0XHRcdFx0J3Njb3BlJzogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgndGl0bGVCYXJTdHlsZScsIFwiQWRqdXN0IHRoZSBhcHBlYXJhbmNlIG9mIHRoZSB3aW5kb3cgdGl0bGUgYmFyIHRvIGJlIG5hdGl2ZSBieSB0aGUgT1Mgb3IgY3VzdG9tLiBPbiBMaW51eCBhbmQgV2luZG93cywgdGhpcyBzZXR0aW5nIGFsc28gYWZmZWN0cyB0aGUgYXBwbGljYXRpb24gYW5kIGNvbnRleHQgbWVudSBhcHBlYXJhbmNlcy4gQ2hhbmdlcyByZXF1aXJlIGEgZnVsbCByZXN0YXJ0IHRvIGFwcGx5LlwiKSxcblx0XHRcdH0sXG5cdFx0XHQnd2luZG93LmNvbnRyb2xzU3R5bGUnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdCdlbnVtJzogWyduYXRpdmUnLCAnY3VzdG9tJywgJ2hpZGRlbiddLFxuXHRcdFx0XHQnZGVmYXVsdCc6ICduYXRpdmUnLFxuXHRcdFx0XHQnaW5jbHVkZWQnOiAhaXNNYWNpbnRvc2gsXG5cdFx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5BUFBMSUNBVElPTixcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2NvbnRyb2xzU3R5bGUnLCBcIkFkanVzdCB0aGUgYXBwZWFyYW5jZSBvZiB0aGUgd2luZG93IGNvbnRyb2xzIHRvIGJlIG5hdGl2ZSBieSB0aGUgT1MsIGN1c3RvbSBkcmF3biBvciBoaWRkZW4uIENoYW5nZXMgcmVxdWlyZSBhIGZ1bGwgcmVzdGFydCB0byBhcHBseS5cIiksXG5cdFx0XHR9LFxuXHRcdFx0J3dpbmRvdy5jdXN0b21UaXRsZUJhclZpc2liaWxpdHknOiB7XG5cdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdCdlbnVtJzogWydhdXRvJywgJ3dpbmRvd2VkJywgJ25ldmVyJ10sXG5cdFx0XHRcdCdtYXJrZG93bkVudW1EZXNjcmlwdGlvbnMnOiBbXG5cdFx0XHRcdFx0bG9jYWxpemUoYHdpbmRvdy5jdXN0b21UaXRsZUJhclZpc2liaWxpdHkuYXV0b2AsIFwiQXV0b21hdGljYWxseSBjaGFuZ2VzIGN1c3RvbSB0aXRsZSBiYXIgdmlzaWJpbGl0eS5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoYHdpbmRvdy5jdXN0b21UaXRsZUJhclZpc2liaWxpdHkud2luZG93ZWRgLCBcIkhpZGUgY3VzdG9tIHRpdGxlYmFyIGluIGZ1bGwgc2NyZWVuLiBXaGVuIG5vdCBpbiBmdWxsIHNjcmVlbiwgYXV0b21hdGljYWxseSBjaGFuZ2UgY3VzdG9tIHRpdGxlIGJhciB2aXNpYmlsaXR5LlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZShgd2luZG93LmN1c3RvbVRpdGxlQmFyVmlzaWJpbGl0eS5uZXZlcmAsIFwiSGlkZSBjdXN0b20gdGl0bGViYXIgd2hlbiB7MH0gaXMgc2V0IHRvIGBuYXRpdmVgLlwiLCAnYCN3aW5kb3cudGl0bGVCYXJTdHlsZSNgJyksXG5cdFx0XHRcdF0sXG5cdFx0XHRcdCdkZWZhdWx0JzogJ2F1dG8nLFxuXHRcdFx0XHQnc2NvcGUnOiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT04sXG5cdFx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbG9jYWxpemUoJ3dpbmRvdy5jdXN0b21UaXRsZUJhclZpc2liaWxpdHknLCBcIkFkanVzdCB3aGVuIHRoZSBjdXN0b20gdGl0bGUgYmFyIHNob3VsZCBiZSBzaG93bi4gVGhlIGN1c3RvbSB0aXRsZSBiYXIgY2FuIGJlIGhpZGRlbiB3aGVuIGluIGZ1bGwgc2NyZWVuIG1vZGUgd2l0aCBgd2luZG93ZWRgLiBUaGUgY3VzdG9tIHRpdGxlIGJhciBjYW4gb25seSBiZSBoaWRkZW4gaW4gbm9uIGZ1bGwgc2NyZWVuIG1vZGUgd2l0aCBgbmV2ZXJgIHdoZW4gezB9IGlzIHNldCB0byBgbmF0aXZlYC5cIiwgJ2Ajd2luZG93LnRpdGxlQmFyU3R5bGUjYCcpLFxuXHRcdFx0fSxcblx0XHRcdCd3aW5kb3cuZGlhbG9nU3R5bGUnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ3N0cmluZycsXG5cdFx0XHRcdCdlbnVtJzogWyduYXRpdmUnLCAnY3VzdG9tJ10sXG5cdFx0XHRcdCdkZWZhdWx0JzogJ25hdGl2ZScsXG5cdFx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5BUFBMSUNBVElPTixcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ2RpYWxvZ1N0eWxlJywgXCJBZGp1c3QgdGhlIGFwcGVhcmFuY2Ugb2YgZGlhbG9nIHdpbmRvd3MuXCIpXG5cdFx0XHR9LFxuXHRcdFx0J3dpbmRvdy5uYXRpdmVUYWJzJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2RlZmF1bHQnOiBmYWxzZSxcblx0XHRcdFx0J3Njb3BlJzogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnd2luZG93Lm5hdGl2ZVRhYnMnLCBcIkVuYWJsZXMgbWFjT1MgU2llcnJhIHdpbmRvdyB0YWJzLiBOb3RlIHRoYXQgY2hhbmdlcyByZXF1aXJlIGEgZnVsbCByZXN0YXJ0IHRvIGFwcGx5IGFuZCB0aGF0IG5hdGl2ZSB0YWJzIHdpbGwgZGlzYWJsZSBhIGN1c3RvbSB0aXRsZSBiYXIgc3R5bGUgaWYgY29uZmlndXJlZC5cIiksXG5cdFx0XHRcdCdpbmNsdWRlZCc6IGlzTWFjaW50b3NoLFxuXHRcdFx0fSxcblx0XHRcdCd3aW5kb3cubmF0aXZlRnVsbFNjcmVlbic6IHtcblx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdCdkZWZhdWx0JzogdHJ1ZSxcblx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ3dpbmRvdy5uYXRpdmVGdWxsU2NyZWVuJywgXCJDb250cm9scyBpZiBuYXRpdmUgZnVsbC1zY3JlZW4gc2hvdWxkIGJlIHVzZWQgb24gbWFjT1MuIERpc2FibGUgdGhpcyBvcHRpb24gdG8gcHJldmVudCBtYWNPUyBmcm9tIGNyZWF0aW5nIGEgbmV3IHNwYWNlIHdoZW4gZ29pbmcgZnVsbC1zY3JlZW4uXCIpLFxuXHRcdFx0XHQnc2NvcGUnOiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT04sXG5cdFx0XHRcdCdpbmNsdWRlZCc6IGlzTWFjaW50b3NoXG5cdFx0XHR9LFxuXHRcdFx0J3dpbmRvdy5jbGlja1Rocm91Z2hJbmFjdGl2ZSc6IHtcblx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdCdkZWZhdWx0JzogdHJ1ZSxcblx0XHRcdFx0J3Njb3BlJzogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnd2luZG93LmNsaWNrVGhyb3VnaEluYWN0aXZlJywgXCJJZiBlbmFibGVkLCBjbGlja2luZyBvbiBhbiBpbmFjdGl2ZSB3aW5kb3cgd2lsbCBib3RoIGFjdGl2YXRlIHRoZSB3aW5kb3cgYW5kIHRyaWdnZXIgdGhlIGVsZW1lbnQgdW5kZXIgdGhlIG1vdXNlIGlmIGl0IGlzIGNsaWNrYWJsZS4gSWYgZGlzYWJsZWQsIGNsaWNraW5nIGFueXdoZXJlIG9uIGFuIGluYWN0aXZlIHdpbmRvdyB3aWxsIGFjdGl2YXRlIGl0IG9ubHkgYW5kIGEgc2Vjb25kIGNsaWNrIGlzIHJlcXVpcmVkIG9uIHRoZSBlbGVtZW50LlwiKSxcblx0XHRcdFx0J2luY2x1ZGVkJzogaXNNYWNpbnRvc2hcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdC8vIFRlbGVtZXRyeVxuXHRyZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRcdCdpZCc6ICd0ZWxlbWV0cnknLFxuXHRcdCdvcmRlcic6IDExMCxcblx0XHR0aXRsZTogbG9jYWxpemUoJ3RlbGVtZXRyeUNvbmZpZ3VyYXRpb25UaXRsZScsIFwiVGVsZW1ldHJ5XCIpLFxuXHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHQndGVsZW1ldHJ5LmVuYWJsZUNyYXNoUmVwb3J0ZXInOiB7XG5cdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgndGVsZW1ldHJ5LmVuYWJsZUNyYXNoUmVwb3J0aW5nJywgXCJFbmFibGUgY3Jhc2ggcmVwb3J0cyB0byBiZSBjb2xsZWN0ZWQuIFRoaXMgaGVscHMgdXMgaW1wcm92ZSBzdGFiaWxpdHkuIFxcblRoaXMgb3B0aW9uIHJlcXVpcmVzIHJlc3RhcnQgdG8gdGFrZSBlZmZlY3QuXCIpLFxuXHRcdFx0XHQnZGVmYXVsdCc6IHRydWUsXG5cdFx0XHRcdCd0YWdzJzogWyd1c2VzT25saW5lU2VydmljZXMnLCAndGVsZW1ldHJ5J10sXG5cdFx0XHRcdCdtYXJrZG93bkRlcHJlY2F0aW9uTWVzc2FnZSc6IGxvY2FsaXplKCdlbmFibGVDcmFzaFJlcG9ydGVyRGVwcmVjYXRlZCcsIFwiSWYgdGhpcyBzZXR0aW5nIGlzIGZhbHNlLCBubyB0ZWxlbWV0cnkgd2lsbCBiZSBzZW50IHJlZ2FyZGxlc3Mgb2YgdGhlIG5ldyBzZXR0aW5nJ3MgdmFsdWUuIERlcHJlY2F0ZWQgZHVlIHRvIGJlaW5nIGNvbWJpbmVkIGludG8gdGhlIHswfSBzZXR0aW5nLlwiLCBgXFxgIyR7VEVMRU1FVFJZX1NFVFRJTkdfSUR9I1xcYGApLFxuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0Ly8gS2V5YmluZGluZ1xuXHRyZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRcdCdpZCc6ICdrZXlib2FyZCcsXG5cdFx0J29yZGVyJzogMTUsXG5cdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHQndGl0bGUnOiBsb2NhbGl6ZSgna2V5Ym9hcmRDb25maWd1cmF0aW9uVGl0bGUnLCBcIktleWJvYXJkXCIpLFxuXHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0J2tleWJvYXJkLnRvdWNoYmFyLmVuYWJsZWQnOiB7XG5cdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHQnZGVmYXVsdCc6IHRydWUsXG5cdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCd0b3VjaGJhci5lbmFibGVkJywgXCJFbmFibGVzIHRoZSBtYWNPUyB0b3VjaGJhciBidXR0b25zIG9uIHRoZSBrZXlib2FyZCBpZiBhdmFpbGFibGUuXCIpLFxuXHRcdFx0XHQnaW5jbHVkZWQnOiBpc01hY2ludG9zaFxuXHRcdFx0fSxcblx0XHRcdCdrZXlib2FyZC50b3VjaGJhci5pZ25vcmVkJzoge1xuXHRcdFx0XHQndHlwZSc6ICdhcnJheScsXG5cdFx0XHRcdCdpdGVtcyc6IHtcblx0XHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCdkZWZhdWx0JzogW10sXG5cdFx0XHRcdCdtYXJrZG93bkRlc2NyaXB0aW9uJzogbG9jYWxpemUoJ3RvdWNoYmFyLmlnbm9yZWQnLCAnQSBzZXQgb2YgaWRlbnRpZmllcnMgZm9yIGVudHJpZXMgaW4gdGhlIHRvdWNoYmFyIHRoYXQgc2hvdWxkIG5vdCBzaG93IHVwIChmb3IgZXhhbXBsZSBgd29ya2JlbmNoLmFjdGlvbi5uYXZpZ2F0ZUJhY2tgKS4nKSxcblx0XHRcdFx0J2luY2x1ZGVkJzogaXNNYWNpbnRvc2hcblx0XHRcdH1cblx0XHR9XG5cdH0pO1xuXG5cdC8vIFNlY3VyaXR5XG5cdHJlZ2lzdHJ5LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdFx0Li4uc2VjdXJpdHlDb25maWd1cmF0aW9uTm9kZUJhc2UsXG5cdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHQnc2VjdXJpdHkucHJvbXB0Rm9yTG9jYWxGaWxlUHJvdG9jb2xIYW5kbGluZyc6IHtcblx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdCdkZWZhdWx0JzogdHJ1ZSxcblx0XHRcdFx0J21hcmtkb3duRGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnc2VjdXJpdHkucHJvbXB0Rm9yTG9jYWxGaWxlUHJvdG9jb2xIYW5kbGluZycsICdJZiBlbmFibGVkLCBhIGRpYWxvZyB3aWxsIGFzayBmb3IgY29uZmlybWF0aW9uIHdoZW5ldmVyIGEgbG9jYWwgZmlsZSBvciB3b3Jrc3BhY2UgaXMgYWJvdXQgdG8gb3BlbiB0aHJvdWdoIGEgcHJvdG9jb2wgaGFuZGxlci4nKSxcblx0XHRcdFx0J3Njb3BlJzogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OXG5cdFx0XHR9LFxuXHRcdFx0J3NlY3VyaXR5LnByb21wdEZvclJlbW90ZUZpbGVQcm90b2NvbEhhbmRsaW5nJzoge1xuXHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0J2RlZmF1bHQnOiB0cnVlLFxuXHRcdFx0XHQnbWFya2Rvd25EZXNjcmlwdGlvbic6IGxvY2FsaXplKCdzZWN1cml0eS5wcm9tcHRGb3JSZW1vdGVGaWxlUHJvdG9jb2xIYW5kbGluZycsICdJZiBlbmFibGVkLCBhIGRpYWxvZyB3aWxsIGFzayBmb3IgY29uZmlybWF0aW9uIHdoZW5ldmVyIGEgcmVtb3RlIGZpbGUgb3Igd29ya3NwYWNlIGlzIGFib3V0IHRvIG9wZW4gdGhyb3VnaCBhIHByb3RvY29sIGhhbmRsZXIuJyksXG5cdFx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5BUFBMSUNBVElPTlxuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG59KSgpO1xuXG4vLyBKU09OIFNjaGVtYXNcbihmdW5jdGlvbiByZWdpc3RlckpTT05TY2hlbWFzKCk6IHZvaWQge1xuXHRjb25zdCBhcmd2RGVmaW5pdGlvbkZpbGVTY2hlbWFJZCA9ICd2c2NvZGU6Ly9zY2hlbWFzL2FyZ3YnO1xuXHRjb25zdCBqc29uUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJSlNPTkNvbnRyaWJ1dGlvblJlZ2lzdHJ5PihKU09ORXh0ZW5zaW9ucy5KU09OQ29udHJpYnV0aW9uKTtcblx0Y29uc3Qgc2NoZW1hOiBJSlNPTlNjaGVtYSA9IHtcblx0XHRpZDogYXJndkRlZmluaXRpb25GaWxlU2NoZW1hSWQsXG5cdFx0YWxsb3dDb21tZW50czogdHJ1ZSxcblx0XHRhbGxvd1RyYWlsaW5nQ29tbWFzOiB0cnVlLFxuXHRcdGRlc2NyaXB0aW9uOiAnVlNDb2RlIHN0YXRpYyBjb21tYW5kIGxpbmUgZGVmaW5pdGlvbiBmaWxlJyxcblx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0cHJvcGVydGllczoge1xuXHRcdFx0bG9jYWxlOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2FyZ3YubG9jYWxlJywgJ1RoZSBkaXNwbGF5IExhbmd1YWdlIHRvIHVzZS4gUGlja2luZyBhIGRpZmZlcmVudCBsYW5ndWFnZSByZXF1aXJlcyB0aGUgYXNzb2NpYXRlZCBsYW5ndWFnZSBwYWNrIHRvIGJlIGluc3RhbGxlZC4nKVxuXHRcdFx0fSxcblx0XHRcdCdkaXNhYmxlLWxjZC10ZXh0Jzoge1xuXHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnYXJndi5kaXNhYmxlTGNkVGV4dCcsICdEaXNhYmxlcyBMQ0QgZm9udCBhbnRpYWxpYXNpbmcuJylcblx0XHRcdH0sXG5cdFx0XHQncHJveHktYnlwYXNzLWxpc3QnOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2FyZ3YucHJveHlCeXBhc3NMaXN0JywgJ0J5cGFzcyBhbnkgc3BlY2lmaWVkIHByb3h5IGZvciB0aGUgZ2l2ZW4gc2VtaS1jb2xvbi1zZXBhcmF0ZWQgbGlzdCBvZiBob3N0cy4gRXhhbXBsZSB2YWx1ZSBcIjxsb2NhbD47Ki5taWNyb3NvZnQuY29tOypmb28uY29tOzEuMi4zLjQ6NTY3OFwiLCB3aWxsIHVzZSB0aGUgcHJveHkgc2VydmVyIGZvciBhbGwgaG9zdHMgZXhjZXB0IGZvciBsb2NhbCBhZGRyZXNzZXMgKGxvY2FsaG9zdCwgMTI3LjAuMC4xIGV0Yy4pLCBtaWNyb3NvZnQuY29tIHN1YmRvbWFpbnMsIGhvc3RzIHRoYXQgY29udGFpbiB0aGUgc3VmZml4IGZvby5jb20gYW5kIGFueXRoaW5nIGF0IDEuMi4zLjQ6NTY3OCcpXG5cdFx0XHR9LFxuXHRcdFx0J2Rpc2FibGUtaGFyZHdhcmUtYWNjZWxlcmF0aW9uJzoge1xuXHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnYXJndi5kaXNhYmxlSGFyZHdhcmVBY2NlbGVyYXRpb24nLCAnRGlzYWJsZXMgaGFyZHdhcmUgYWNjZWxlcmF0aW9uLiBPTkxZIGNoYW5nZSB0aGlzIG9wdGlvbiBpZiB5b3UgZW5jb3VudGVyIGdyYXBoaWMgaXNzdWVzLicpXG5cdFx0XHR9LFxuXHRcdFx0J2ZvcmNlLWNvbG9yLXByb2ZpbGUnOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnYXJndi5mb3JjZUNvbG9yUHJvZmlsZScsICdBbGxvd3MgdG8gb3ZlcnJpZGUgdGhlIGNvbG9yIHByb2ZpbGUgdG8gdXNlLiBJZiB5b3UgZXhwZXJpZW5jZSBjb2xvcnMgYXBwZWFyIGJhZGx5LCB0cnkgdG8gc2V0IHRoaXMgdG8gYHNyZ2JgIGFuZCByZXN0YXJ0LicpXG5cdFx0XHR9LFxuXHRcdFx0J2VuYWJsZS1jcmFzaC1yZXBvcnRlcic6IHtcblx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnYXJndi5lbmFibGVDcmFzaFJlcG9ydGVyJywgJ0FsbG93cyB0byBkaXNhYmxlIGNyYXNoIHJlcG9ydGluZywgc2hvdWxkIHJlc3RhcnQgdGhlIGFwcCBpZiB0aGUgdmFsdWUgaXMgY2hhbmdlZC4nKVxuXHRcdFx0fSxcblx0XHRcdCdjcmFzaC1yZXBvcnRlci1pZCc6IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdhcmd2LmNyYXNoUmVwb3J0ZXJJZCcsICdVbmlxdWUgaWQgdXNlZCBmb3IgY29ycmVsYXRpbmcgY3Jhc2ggcmVwb3J0cyBzZW50IGZyb20gdGhpcyBhcHAgaW5zdGFuY2UuJylcblx0XHRcdH0sXG5cdFx0XHQnZW5hYmxlLXByb3Bvc2VkLWFwaSc6IHtcblx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdhcmd2LmVuZWJsZVByb3Bvc2VkQXBpJywgXCJFbmFibGUgcHJvcG9zZWQgQVBJcyBmb3IgYSBsaXN0IG9mIGV4dGVuc2lvbiBpZHMgKHN1Y2ggYXMgXFxgdnNjb2RlLmdpdFxcYCkuIFByb3Bvc2VkIEFQSXMgYXJlIHVuc3RhYmxlIGFuZCBzdWJqZWN0IHRvIGJyZWFraW5nIHdpdGhvdXQgd2FybmluZyBhdCBhbnkgdGltZS4gVGhpcyBzaG91bGQgb25seSBiZSBzZXQgZm9yIGV4dGVuc2lvbiBkZXZlbG9wbWVudCBhbmQgdGVzdGluZyBwdXJwb3Nlcy5cIiksXG5cdFx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdCdsb2ctbGV2ZWwnOiB7XG5cdFx0XHRcdHR5cGU6IFsnc3RyaW5nJywgJ2FycmF5J10sXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnYXJndi5sb2dMZXZlbCcsIFwiTG9nIGxldmVsIHRvIHVzZS4gRGVmYXVsdCBpcyAnaW5mbycuIEFsbG93ZWQgdmFsdWVzIGFyZSAnZXJyb3InLCAnd2FybicsICdpbmZvJywgJ2RlYnVnJywgJ3RyYWNlJywgJ29mZicuXCIpXG5cdFx0XHR9LFxuXHRcdFx0J2Rpc2FibGUtY2hyb21pdW0tc2FuZGJveCc6IHtcblx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2FyZ3YuZGlzYWJsZUNocm9taXVtU2FuZGJveCcsIFwiRGlzYWJsZXMgdGhlIENocm9taXVtIHNhbmRib3guIFRoaXMgaXMgdXNlZnVsIHdoZW4gcnVubmluZyBWUyBDb2RlIGFzIGVsZXZhdGVkIG9uIExpbnV4IGFuZCBydW5uaW5nIHVuZGVyIEFwcGxvY2tlciBvbiBXaW5kb3dzLlwiKVxuXHRcdFx0fSxcblx0XHRcdCd1c2UtaW5tZW1vcnktc2VjcmV0c3RvcmFnZSc6IHtcblx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2FyZ3YudXNlSW5NZW1vcnlTZWNyZXRTdG9yYWdlJywgXCJFbnN1cmVzIHRoYXQgYW4gaW4tbWVtb3J5IHN0b3JlIHdpbGwgYmUgdXNlZCBmb3Igc2VjcmV0IHN0b3JhZ2UgaW5zdGVhZCBvZiB1c2luZyB0aGUgT1MncyBjcmVkZW50aWFsIHN0b3JlLiBUaGlzIGlzIG9mdGVuIHVzZWQgd2hlbiBydW5uaW5nIFZTIENvZGUgZXh0ZW5zaW9uIHRlc3RzIG9yIHdoZW4geW91J3JlIGV4cGVyaWVuY2luZyBkaWZmaWN1bHRpZXMgd2l0aCB0aGUgY3JlZGVudGlhbCBzdG9yZS5cIilcblx0XHRcdH1cblx0XHR9XG5cdH07XG5cdGlmIChpc0xpbnV4KSB7XG5cdFx0c2NoZW1hLnByb3BlcnRpZXMhWydmb3JjZS1yZW5kZXJlci1hY2Nlc3NpYmlsaXR5J10gPSB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2FyZ3YuZm9yY2UtcmVuZGVyZXItYWNjZXNzaWJpbGl0eScsICdGb3JjZXMgdGhlIHJlbmRlcmVyIHRvIGJlIGFjY2Vzc2libGUuIE9OTFkgY2hhbmdlIHRoaXMgaWYgeW91IGFyZSB1c2luZyBhIHNjcmVlbiByZWFkZXIgb24gTGludXguIE9uIG90aGVyIHBsYXRmb3JtcyB0aGUgcmVuZGVyZXIgd2lsbCBhdXRvbWF0aWNhbGx5IGJlIGFjY2Vzc2libGUuIFRoaXMgZmxhZyBpcyBhdXRvbWF0aWNhbGx5IHNldCBpZiB5b3UgaGF2ZSBlZGl0b3IuYWNjZXNzaWJpbGl0eVN1cHBvcnQ6IG9uLicpLFxuXHRcdH07XG5cdFx0c2NoZW1hLnByb3BlcnRpZXMhWydwYXNzd29yZC1zdG9yZSddID0ge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2FyZ3YucGFzc3dvcmRTdG9yZScsIFwiQ29uZmlndXJlcyB0aGUgYmFja2VuZCB1c2VkIHRvIHN0b3JlIHNlY3JldHMgb24gTGludXguIFRoaXMgYXJndW1lbnQgaXMgaWdub3JlZCBvbiBXaW5kb3dzICYgbWFjT1MuXCIpXG5cdFx0fTtcblx0fVxuXG5cdGpzb25SZWdpc3RyeS5yZWdpc3RlclNjaGVtYShhcmd2RGVmaW5pdGlvbkZpbGVTY2hlbWFJZCwgc2NoZW1hKTtcbn0pKCk7XG5cbihmdW5jdGlvbiByZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbnMoKTogdm9pZCB7XG5cdHJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMignd29ya2JlbmNoLmNvbnRyaWJ1dGlvbnMuZGVmYXVsdEFjY291bnRNYW5hZ2VtZW50JywgRGVmYXVsdEFjY291bnRNYW5hZ2VtZW50Q29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZS5BZnRlclJlc3RvcmVkKTtcbn0pKCk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFVBQVUsaUJBQWlCO0FBQ3BDLFNBQVMsY0FBYyxRQUFRLHVCQUF1QjtBQUN0RCxTQUFpQyxjQUFjLHlCQUF5QiwwQkFBMEI7QUFDbEcsU0FBUyxRQUFRLGVBQWU7QUFDaEMsU0FBUyxTQUFTLGFBQWEsaUJBQWlCO0FBQ2hELFNBQVMsaUNBQWlDLHNCQUFzQiwwQ0FBMEMsMEJBQTBCLHlCQUF5QjtBQUM3SixTQUFTLGlCQUFpQixlQUFlLGNBQWMsbUJBQW1CLG9CQUFvQix5QkFBeUIscUJBQXFCLDhCQUE4QiwwQkFBMEIsaUNBQWlDLCtCQUErQixrQ0FBa0M7QUFDdFMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxxQkFBcUIsd0JBQXdCO0FBQ3RELFNBQVMsd0JBQXdCO0FBRWpDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQW9DLGNBQWMsc0JBQXNCO0FBRXhFLFNBQVMsMEJBQTBCLGtDQUFrQztBQUNyRSxTQUFTLHVCQUF1QixpQ0FBaUM7QUFDakUsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxrQ0FBa0MscUNBQXFDO0FBQ2hGLFNBQVMsZ0JBQWdCLHNCQUFzQjtBQUMvQyxTQUFTLDRDQUE0QztBQUNyRCxTQUFTLGdDQUFnQyxzQkFBc0I7QUFBQSxDQUc5RCxTQUFTLGtCQUF3QjtBQUdqQyxrQkFBZ0IsWUFBWTtBQUM1QixrQkFBZ0IsYUFBYTtBQUM3QixrQkFBZ0IsZUFBZTtBQUcvQixrQkFBZ0Isa0JBQWtCO0FBQ2xDLGtCQUFnQix1QkFBdUI7QUFDdkMsa0JBQWdCLGlCQUFpQjtBQUVqQyxNQUFJLGFBQWE7QUFLaEIsd0JBQW9CLHVCQUF1QjtBQUFBLE1BQzFD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
