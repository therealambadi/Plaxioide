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
import * as nls from "../../../../nls.js";
import { KeyMod, KeyChord, KeyCode } from "../../../../base/common/keyCodes.js";
import { ModesRegistry } from "../../../../editor/common/languages/modesRegistry.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { MenuId, registerAction2, Action2, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { OutputService } from "./outputServices.js";
import { OUTPUT_MODE_ID, OUTPUT_MIME, OUTPUT_VIEW_ID, IOutputService, CONTEXT_IN_OUTPUT, LOG_MODE_ID, LOG_MIME, CONTEXT_OUTPUT_SCROLL_LOCK, ACTIVE_OUTPUT_CHANNEL_CONTEXT, CONTEXT_ACTIVE_OUTPUT_LEVEL_SETTABLE, Extensions, CONTEXT_ACTIVE_OUTPUT_LEVEL, CONTEXT_ACTIVE_OUTPUT_LEVEL_IS_DEFAULT, SHOW_INFO_FILTER_CONTEXT, SHOW_TRACE_FILTER_CONTEXT, SHOW_DEBUG_FILTER_CONTEXT, SHOW_ERROR_FILTER_CONTEXT, SHOW_WARNING_FILTER_CONTEXT, OUTPUT_FILTER_FOCUS_CONTEXT, CONTEXT_ACTIVE_LOG_FILE_OUTPUT, isSingleSourceOutputChannelDescriptor } from "../../../services/output/common/output.js";
import { OutputViewPane } from "./outputView.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { ViewContainerLocation, Extensions as ViewContainerExtensions } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { ViewPaneContainer } from "../../../browser/parts/views/viewPaneContainer.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { AUX_WINDOW_GROUP, IEditorService } from "../../../services/editor/common/editorService.js";
import { ContextKeyExpr } from "../../../../platform/contextkey/common/contextkey.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Disposable, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { ILoggerService, LogLevel, LogLevelToLocalizedString, LogLevelToString } from "../../../../platform/log/common/log.js";
import { IDefaultLogLevelsService } from "../../logs/common/defaultLogLevels.js";
import { KeybindingsRegistry, KeybindingWeight } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
import { EditorContextKeys } from "../../../../editor/common/editorContextKeys.js";
import { CONTEXT_ACCESSIBILITY_MODE_ENABLED } from "../../../../platform/accessibility/common/accessibility.js";
import { IsWindowsContext } from "../../../../platform/contextkey/common/contextkeys.js";
import { FocusedViewContext } from "../../../common/contextkeys.js";
import { localize, localize2 } from "../../../../nls.js";
import { viewFilterSubmenu } from "../../../browser/parts/views/viewFilter.js";
import { ViewAction } from "../../../browser/parts/views/viewPane.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { basename } from "../../../../base/common/resources.js";
const IMPORTED_LOG_ID_PREFIX = "importedLog.";
registerSingleton(IOutputService, OutputService, InstantiationType.Delayed);
ModesRegistry.registerLanguage({
  id: OUTPUT_MODE_ID,
  extensions: [],
  mimetypes: [OUTPUT_MIME]
});
ModesRegistry.registerLanguage({
  id: LOG_MODE_ID,
  extensions: [],
  mimetypes: [LOG_MIME]
});
const outputViewIcon = registerIcon("output-view-icon", Codicon.output, nls.localize("outputViewIcon", "View icon of the output view."));
const VIEW_CONTAINER = Registry.as(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
  id: OUTPUT_VIEW_ID,
  title: nls.localize2("output", "Output"),
  icon: outputViewIcon,
  order: 1,
  ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [OUTPUT_VIEW_ID, { mergeViewWithContainerWhenSingleView: true }]),
  storageId: OUTPUT_VIEW_ID,
  hideIfEmpty: true
}, ViewContainerLocation.Panel, { doNotRegisterOpenCommand: true });
Registry.as(ViewContainerExtensions.ViewsRegistry).registerViews([{
  id: OUTPUT_VIEW_ID,
  name: nls.localize2("output", "Output"),
  containerIcon: outputViewIcon,
  canMoveView: true,
  canToggleVisibility: true,
  ctorDescriptor: new SyncDescriptor(OutputViewPane),
  openCommandActionDescriptor: {
    id: "workbench.action.output.toggleOutput",
    mnemonicTitle: nls.localize({ key: "miToggleOutput", comment: ["&& denotes a mnemonic"] }, "&&Output"),
    keybindings: {
      primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyU,
      linux: {
        primary: KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyH)
        // On Ubuntu Ctrl+Shift+U is taken by some global OS command
      }
    },
    order: 1
  }
}], VIEW_CONTAINER);
let OutputContribution = class extends Disposable {
  constructor(outputService, editorService) {
    super();
    this.outputService = outputService;
    this.editorService = editorService;
    this.registerActions();
  }
  registerActions() {
    this.registerSwitchOutputAction();
    this.registerAddCompoundLogAction();
    this.registerRemoveLogAction();
    this.registerShowOutputChannelsAction();
    this.registerClearOutputAction();
    this.registerToggleAutoScrollAction();
    this.registerOpenActiveOutputFileAction();
    this.registerOpenActiveOutputFileInAuxWindowAction();
    this.registerSaveActiveOutputAsAction();
    this.registerShowLogsAction();
    this.registerOpenLogFileAction();
    this.registerConfigureActiveOutputLogLevelAction();
    this.registerLogLevelFilterActions();
    this.registerClearFilterActions();
    this.registerExportLogsAction();
    this.registerImportLogAction();
  }
  registerSwitchOutputAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.output.action.switchBetweenOutputs`,
          title: nls.localize("switchBetweenOutputs.label", "Switch Output")
        });
      }
      async run(accessor, channelId) {
        if (channelId) {
          accessor.get(IOutputService).showChannel(channelId, true);
        }
      }
    }));
    const switchOutputMenu = new MenuId("workbench.output.menu.switchOutput");
    this._register(MenuRegistry.appendMenuItem(MenuId.ViewTitle, {
      submenu: switchOutputMenu,
      title: nls.localize("switchToOutput.label", "Switch Output"),
      group: "navigation",
      when: ContextKeyExpr.equals("view", OUTPUT_VIEW_ID),
      order: 1,
      isSelection: true
    }));
    const registeredChannels = /* @__PURE__ */ new Map();
    this._register(toDisposable(() => dispose(registeredChannels.values())));
    const registerOutputChannels = (channels) => {
      for (const channel of channels) {
        const title = channel.label;
        const group = channel.user ? "2_user_outputchannels" : channel.extensionId ? "0_ext_outputchannels" : "1_core_outputchannels";
        registeredChannels.set(channel.id, registerAction2(class extends Action2 {
          constructor() {
            super({
              id: `workbench.action.output.show.${channel.id}`,
              title,
              toggled: ACTIVE_OUTPUT_CHANNEL_CONTEXT.isEqualTo(channel.id),
              menu: {
                id: switchOutputMenu,
                group
              }
            });
          }
          async run(accessor) {
            return accessor.get(IOutputService).showChannel(channel.id, true);
          }
        }));
      }
    };
    registerOutputChannels(this.outputService.getChannelDescriptors());
    const outputChannelRegistry = Registry.as(Extensions.OutputChannels);
    this._register(outputChannelRegistry.onDidRegisterChannel((e) => {
      const channel = this.outputService.getChannelDescriptor(e);
      if (channel) {
        registerOutputChannels([channel]);
      }
    }));
    this._register(outputChannelRegistry.onDidRemoveChannel((e) => {
      registeredChannels.get(e.id)?.dispose();
      registeredChannels.delete(e.id);
    }));
  }
  registerAddCompoundLogAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.output.addCompoundLog",
          title: nls.localize2("addCompoundLog", "Add Compound Log..."),
          category: nls.localize2("output", "Output"),
          f1: true,
          menu: [{
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.equals("view", OUTPUT_VIEW_ID),
            group: "2_add"
          }]
        });
      }
      async run(accessor) {
        const outputService = accessor.get(IOutputService);
        const quickInputService = accessor.get(IQuickInputService);
        const extensionLogs = [], logs = [];
        for (const channel of outputService.getChannelDescriptors()) {
          if (channel.log && !channel.user) {
            if (channel.extensionId) {
              extensionLogs.push(channel);
            } else {
              logs.push(channel);
            }
          }
        }
        const entries = [];
        for (const log of logs.sort((a, b) => a.label.localeCompare(b.label))) {
          entries.push(log);
        }
        if (extensionLogs.length && logs.length) {
          entries.push({ type: "separator", label: nls.localize("extensionLogs", "Extension Logs") });
        }
        for (const log of extensionLogs.sort((a, b) => a.label.localeCompare(b.label))) {
          entries.push(log);
        }
        const result = await quickInputService.pick(entries, { placeHolder: nls.localize("selectlog", "Select Log"), canPickMany: true });
        if (result?.length) {
          outputService.showChannel(outputService.registerCompoundLogChannel(result));
        }
      }
    }));
  }
  registerRemoveLogAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.output.remove",
          title: nls.localize2("removeLog", "Remove Output..."),
          category: nls.localize2("output", "Output"),
          f1: true
        });
      }
      async run(accessor) {
        const outputService = accessor.get(IOutputService);
        const quickInputService = accessor.get(IQuickInputService);
        const notificationService = accessor.get(INotificationService);
        const entries = outputService.getChannelDescriptors().filter((channel) => channel.user);
        if (entries.length === 0) {
          notificationService.info(nls.localize("nocustumoutput", "No custom outputs to remove."));
          return;
        }
        const result = await quickInputService.pick(entries, { placeHolder: nls.localize("selectlog", "Select Log"), canPickMany: true });
        if (!result?.length) {
          return;
        }
        const outputChannelRegistry = Registry.as(Extensions.OutputChannels);
        for (const channel of result) {
          outputChannelRegistry.removeChannel(channel.id);
        }
      }
    }));
  }
  registerShowOutputChannelsAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.showOutputChannels",
          title: nls.localize2("showOutputChannels", "Show Output Channels..."),
          category: nls.localize2("output", "Output"),
          f1: true
        });
      }
      async run(accessor) {
        const outputService = accessor.get(IOutputService);
        const quickInputService = accessor.get(IQuickInputService);
        const extensionChannels = [], coreChannels = [];
        for (const channel of outputService.getChannelDescriptors()) {
          if (channel.extensionId) {
            extensionChannels.push(channel);
          } else {
            coreChannels.push(channel);
          }
        }
        const entries = [];
        for (const { id, label } of extensionChannels) {
          entries.push({ id, label });
        }
        if (extensionChannels.length && coreChannels.length) {
          entries.push({ type: "separator" });
        }
        for (const { id, label } of coreChannels) {
          entries.push({ id, label });
        }
        const entry = await quickInputService.pick(entries, { placeHolder: nls.localize("selectOutput", "Select Output Channel") });
        if (entry) {
          return outputService.showChannel(entry.id);
        }
      }
    }));
  }
  registerClearOutputAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.output.action.clearOutput`,
          title: nls.localize2("clearOutput.label", "Clear Output"),
          category: Categories.View,
          menu: [{
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.equals("view", OUTPUT_VIEW_ID),
            group: "navigation",
            order: 2
          }, {
            id: MenuId.CommandPalette
          }, {
            id: MenuId.EditorContext,
            when: CONTEXT_IN_OUTPUT
          }],
          icon: Codicon.clearAll
        });
      }
      async run(accessor) {
        const outputService = accessor.get(IOutputService);
        const accessibilitySignalService = accessor.get(IAccessibilitySignalService);
        const activeChannel = outputService.getActiveChannel();
        if (activeChannel) {
          activeChannel.clear();
          accessibilitySignalService.playSignal(AccessibilitySignal.clear);
        }
      }
    }));
  }
  registerToggleAutoScrollAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.output.action.toggleAutoScroll`,
          title: nls.localize2("toggleAutoScroll", "Toggle Auto Scrolling"),
          tooltip: nls.localize("outputScrollOff", "Turn Auto Scrolling Off"),
          menu: {
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.and(ContextKeyExpr.equals("view", OUTPUT_VIEW_ID)),
            group: "navigation",
            order: 3
          },
          icon: Codicon.lock,
          toggled: {
            condition: CONTEXT_OUTPUT_SCROLL_LOCK,
            icon: Codicon.unlock,
            tooltip: nls.localize("outputScrollOn", "Turn Auto Scrolling On")
          }
        });
      }
      async run(accessor) {
        const outputView = accessor.get(IViewsService).getActiveViewWithId(OUTPUT_VIEW_ID);
        outputView.scrollLock = !outputView.scrollLock;
      }
    }));
  }
  registerOpenActiveOutputFileAction() {
    const that = this;
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.action.openActiveLogOutputFile`,
          title: nls.localize2("openActiveOutputFile", "Open Output in Editor"),
          menu: [{
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.equals("view", OUTPUT_VIEW_ID),
            group: "navigation",
            order: 4,
            isHiddenByDefault: true
          }],
          icon: Codicon.goToFile
        });
      }
      async run() {
        that.openActiveOutput();
      }
    }));
  }
  registerOpenActiveOutputFileInAuxWindowAction() {
    const that = this;
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.action.openActiveLogOutputFileInNewWindow`,
          title: nls.localize2("openActiveOutputFileInNewWindow", "Open Output in New Window"),
          menu: [{
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.equals("view", OUTPUT_VIEW_ID),
            group: "navigation",
            order: 5,
            isHiddenByDefault: true
          }],
          icon: Codicon.emptyWindow
        });
      }
      async run() {
        that.openActiveOutput(AUX_WINDOW_GROUP);
      }
    }));
  }
  registerSaveActiveOutputAsAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.action.saveActiveLogOutputAs`,
          title: nls.localize2("saveActiveOutputAs", "Save Output As..."),
          menu: [{
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.equals("view", OUTPUT_VIEW_ID),
            group: "1_export",
            order: 1
          }]
        });
      }
      async run(accessor) {
        const outputService = accessor.get(IOutputService);
        const channel = outputService.getActiveChannel();
        if (channel) {
          const descriptor = outputService.getChannelDescriptors().find((c) => c.id === channel.id);
          if (descriptor) {
            await outputService.saveOutputAs(descriptor);
          }
        }
      }
    }));
  }
  async openActiveOutput(group) {
    const channel = this.outputService.getActiveChannel();
    if (channel) {
      await this.editorService.openEditor({
        resource: channel.uri,
        options: {
          pinned: true
        }
      }, group);
    }
  }
  registerConfigureActiveOutputLogLevelAction() {
    const logLevelMenu = new MenuId("workbench.output.menu.logLevel");
    this._register(MenuRegistry.appendMenuItem(MenuId.ViewTitle, {
      submenu: logLevelMenu,
      title: nls.localize("logLevel.label", "Set Log Level..."),
      group: "navigation",
      when: ContextKeyExpr.and(ContextKeyExpr.equals("view", OUTPUT_VIEW_ID), CONTEXT_ACTIVE_OUTPUT_LEVEL_SETTABLE),
      icon: Codicon.gear,
      order: 6
    }));
    let order = 0;
    const registerLogLevel = (logLevel) => {
      this._register(registerAction2(class extends Action2 {
        constructor() {
          super({
            id: `workbench.action.output.activeOutputLogLevel.${logLevel}`,
            title: LogLevelToLocalizedString(logLevel).value,
            toggled: CONTEXT_ACTIVE_OUTPUT_LEVEL.isEqualTo(LogLevelToString(logLevel)),
            menu: {
              id: logLevelMenu,
              order: order++,
              group: "0_level"
            }
          });
        }
        async run(accessor) {
          const outputService = accessor.get(IOutputService);
          const channel = outputService.getActiveChannel();
          if (channel) {
            const channelDescriptor = outputService.getChannelDescriptor(channel.id);
            if (channelDescriptor) {
              outputService.setLogLevel(channelDescriptor, logLevel);
            }
          }
        }
      }));
    };
    registerLogLevel(LogLevel.Trace);
    registerLogLevel(LogLevel.Debug);
    registerLogLevel(LogLevel.Info);
    registerLogLevel(LogLevel.Warning);
    registerLogLevel(LogLevel.Error);
    registerLogLevel(LogLevel.Off);
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.action.output.activeOutputLogLevelDefault`,
          title: nls.localize("logLevelDefault.label", "Set As Default"),
          menu: {
            id: logLevelMenu,
            order,
            group: "1_default"
          },
          precondition: CONTEXT_ACTIVE_OUTPUT_LEVEL_IS_DEFAULT.negate()
        });
      }
      async run(accessor) {
        const outputService = accessor.get(IOutputService);
        const loggerService = accessor.get(ILoggerService);
        const defaultLogLevelsService = accessor.get(IDefaultLogLevelsService);
        const channel = outputService.getActiveChannel();
        if (channel) {
          const channelDescriptor = outputService.getChannelDescriptor(channel.id);
          if (channelDescriptor && isSingleSourceOutputChannelDescriptor(channelDescriptor)) {
            const logLevel = loggerService.getLogLevel(channelDescriptor.source.resource);
            return await defaultLogLevelsService.setDefaultLogLevel(logLevel, channelDescriptor.extensionId);
          }
        }
      }
    }));
  }
  registerShowLogsAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.showLogs",
          title: nls.localize2("showLogs", "Show Logs..."),
          category: Categories.Developer,
          menu: {
            id: MenuId.CommandPalette
          }
        });
      }
      async run(accessor) {
        const outputService = accessor.get(IOutputService);
        const quickInputService = accessor.get(IQuickInputService);
        const extensionLogs = [], logs = [];
        for (const channel of outputService.getChannelDescriptors()) {
          if (channel.log) {
            if (channel.extensionId) {
              extensionLogs.push(channel);
            } else {
              logs.push(channel);
            }
          }
        }
        const entries = [];
        for (const { id, label } of logs) {
          entries.push({ id, label });
        }
        if (extensionLogs.length && logs.length) {
          entries.push({ type: "separator", label: nls.localize("extensionLogs", "Extension Logs") });
        }
        for (const { id, label } of extensionLogs) {
          entries.push({ id, label });
        }
        const entry = await quickInputService.pick(entries, { placeHolder: nls.localize("selectlog", "Select Log") });
        if (entry) {
          return outputService.showChannel(entry.id);
        }
      }
    }));
  }
  registerOpenLogFileAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.action.openLogFile",
          title: nls.localize2("openLogFile", "Open Log..."),
          category: Categories.Developer,
          menu: {
            id: MenuId.CommandPalette
          },
          metadata: {
            description: "workbench.action.openLogFile",
            args: [{
              name: "logFile",
              schema: {
                markdownDescription: nls.localize("logFile", 'The id of the log file to open, for example `"window"`. Currently the best way to get this is to get the ID by checking the `workbench.action.output.show.<id>` commands'),
                type: "string"
              }
            }]
          }
        });
      }
      async run(accessor, args) {
        const outputService = accessor.get(IOutputService);
        const quickInputService = accessor.get(IQuickInputService);
        const editorService = accessor.get(IEditorService);
        let entry;
        const argName = args && typeof args === "string" ? args : void 0;
        const extensionChannels = [];
        const coreChannels = [];
        for (const c of outputService.getChannelDescriptors()) {
          if (c.log) {
            const e = { id: c.id, label: c.label };
            if (c.extensionId) {
              extensionChannels.push(e);
            } else {
              coreChannels.push(e);
            }
            if (e.id === argName) {
              entry = e;
            }
          }
        }
        if (!entry) {
          const entries = [...extensionChannels.sort((a, b) => a.label.localeCompare(b.label))];
          if (entries.length && coreChannels.length) {
            entries.push({ type: "separator" });
            entries.push(...coreChannels.sort((a, b) => a.label.localeCompare(b.label)));
          }
          entry = await quickInputService.pick(entries, { placeHolder: nls.localize("selectlogFile", "Select Log File") });
        }
        if (entry?.id) {
          const channel = outputService.getChannel(entry.id);
          if (channel) {
            await editorService.openEditor({
              resource: channel.uri,
              options: {
                pinned: true
              }
            });
          }
        }
      }
    }));
  }
  registerLogLevelFilterActions() {
    let order = 0;
    const registerLogLevel = (logLevel, toggled) => {
      this._register(registerAction2(class extends ViewAction {
        constructor() {
          super({
            id: `workbench.actions.${OUTPUT_VIEW_ID}.toggle.${LogLevelToString(logLevel)}`,
            title: LogLevelToLocalizedString(logLevel).value,
            metadata: {
              description: localize2("toggleTraceDescription", "Show or hide {0} messages in the output", LogLevelToString(logLevel))
            },
            toggled,
            menu: {
              id: viewFilterSubmenu,
              group: "2_log_filter",
              when: ContextKeyExpr.and(ContextKeyExpr.equals("view", OUTPUT_VIEW_ID), CONTEXT_ACTIVE_LOG_FILE_OUTPUT),
              order: order++
            },
            viewId: OUTPUT_VIEW_ID
          });
        }
        async runInView(serviceAccessor, view) {
          this.toggleLogLevelFilter(serviceAccessor.get(IOutputService), logLevel);
        }
        toggleLogLevelFilter(outputService, logLevel2) {
          switch (logLevel2) {
            case LogLevel.Trace:
              outputService.filters.trace = !outputService.filters.trace;
              break;
            case LogLevel.Debug:
              outputService.filters.debug = !outputService.filters.debug;
              break;
            case LogLevel.Info:
              outputService.filters.info = !outputService.filters.info;
              break;
            case LogLevel.Warning:
              outputService.filters.warning = !outputService.filters.warning;
              break;
            case LogLevel.Error:
              outputService.filters.error = !outputService.filters.error;
              break;
          }
        }
      }));
    };
    registerLogLevel(LogLevel.Trace, SHOW_TRACE_FILTER_CONTEXT);
    registerLogLevel(LogLevel.Debug, SHOW_DEBUG_FILTER_CONTEXT);
    registerLogLevel(LogLevel.Info, SHOW_INFO_FILTER_CONTEXT);
    registerLogLevel(LogLevel.Warning, SHOW_WARNING_FILTER_CONTEXT);
    registerLogLevel(LogLevel.Error, SHOW_ERROR_FILTER_CONTEXT);
  }
  registerClearFilterActions() {
    this._register(registerAction2(class extends ViewAction {
      constructor() {
        super({
          id: `workbench.actions.${OUTPUT_VIEW_ID}.clearFilterText`,
          title: localize("clearFiltersText", "Clear filters text"),
          keybinding: {
            when: OUTPUT_FILTER_FOCUS_CONTEXT,
            weight: KeybindingWeight.WorkbenchContrib,
            primary: KeyCode.Escape
          },
          viewId: OUTPUT_VIEW_ID
        });
      }
      async runInView(serviceAccessor, outputView) {
        outputView.clearFilterText();
      }
    }));
  }
  registerExportLogsAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.action.exportLogs`,
          title: nls.localize2("exportLogs", "Export Logs..."),
          f1: true,
          category: Categories.Developer,
          menu: [{
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.equals("view", OUTPUT_VIEW_ID),
            group: "1_export",
            order: 2
          }]
        });
      }
      async run(accessor) {
        const outputService = accessor.get(IOutputService);
        const quickInputService = accessor.get(IQuickInputService);
        const extensionLogs = [], logs = [], userLogs = [];
        for (const channel of outputService.getChannelDescriptors()) {
          if (channel.log) {
            if (channel.extensionId) {
              extensionLogs.push(channel);
            } else if (channel.user) {
              userLogs.push(channel);
            } else {
              logs.push(channel);
            }
          }
        }
        const entries = [];
        for (const log of logs.sort((a, b) => a.label.localeCompare(b.label))) {
          entries.push(log);
        }
        if (extensionLogs.length && logs.length) {
          entries.push({ type: "separator", label: nls.localize("extensionLogs", "Extension Logs") });
        }
        for (const log of extensionLogs.sort((a, b) => a.label.localeCompare(b.label))) {
          entries.push(log);
        }
        if (userLogs.length && (extensionLogs.length || logs.length)) {
          entries.push({ type: "separator", label: nls.localize("userLogs", "User Logs") });
        }
        for (const log of userLogs.sort((a, b) => a.label.localeCompare(b.label))) {
          entries.push(log);
        }
        const result = await quickInputService.pick(entries, { placeHolder: nls.localize("selectlog", "Select Log"), canPickMany: true });
        if (result?.length) {
          await outputService.saveOutputAs(...result);
        }
      }
    }));
  }
  registerImportLogAction() {
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: `workbench.action.importLog`,
          title: nls.localize2("importLog", "Import Log..."),
          f1: true,
          category: Categories.Developer,
          menu: [{
            id: MenuId.ViewTitle,
            when: ContextKeyExpr.equals("view", OUTPUT_VIEW_ID),
            group: "2_add",
            order: 2
          }]
        });
      }
      async run(accessor) {
        const outputService = accessor.get(IOutputService);
        const fileDialogService = accessor.get(IFileDialogService);
        const result = await fileDialogService.showOpenDialog({
          title: nls.localize("importLogFile", "Import Log File"),
          canSelectFiles: true,
          canSelectFolders: false,
          canSelectMany: true,
          filters: [{
            name: nls.localize("logFiles", "Log Files"),
            extensions: ["log"]
          }]
        });
        if (result?.length) {
          const channelName = basename(result[0]);
          const channelId = `${IMPORTED_LOG_ID_PREFIX}${Date.now()}`;
          Registry.as(Extensions.OutputChannels).registerChannel({
            id: channelId,
            label: channelName,
            log: true,
            user: true,
            source: result.length === 1 ? { resource: result[0] } : result.map((resource) => ({ resource, name: basename(resource).split(".")[0] }))
          });
          outputService.showChannel(channelId);
        }
      }
    }));
  }
};
OutputContribution = __decorateClass([
  __decorateParam(0, IOutputService),
  __decorateParam(1, IEditorService)
], OutputContribution);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(OutputContribution, LifecyclePhase.Restored);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  id: "output",
  order: 30,
  title: nls.localize("output", "Output"),
  type: "object",
  properties: {
    "output.smartScroll.enabled": {
      type: "boolean",
      description: nls.localize("output.smartScroll.enabled", "Enable/disable the ability of smart scrolling in the output view. Smart scrolling allows you to lock scrolling automatically when you click in the output view and unlocks when you click in the last line."),
      default: true,
      scope: ConfigurationScope.WINDOW,
      tags: ["output"]
    }
  }
});
KeybindingsRegistry.registerKeybindingRule({
  id: "cursorWordAccessibilityLeft",
  when: ContextKeyExpr.and(EditorContextKeys.textInputFocus, CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext, ContextKeyExpr.equals(FocusedViewContext.key, OUTPUT_VIEW_ID)),
  primary: KeyMod.CtrlCmd | KeyCode.LeftArrow,
  weight: KeybindingWeight.WorkbenchContrib
});
KeybindingsRegistry.registerKeybindingRule({
  id: "cursorWordAccessibilityLeftSelect",
  when: ContextKeyExpr.and(EditorContextKeys.textInputFocus, CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext, ContextKeyExpr.equals(FocusedViewContext.key, OUTPUT_VIEW_ID)),
  primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.LeftArrow,
  weight: KeybindingWeight.WorkbenchContrib
});
KeybindingsRegistry.registerKeybindingRule({
  id: "cursorWordAccessibilityRight",
  when: ContextKeyExpr.and(EditorContextKeys.textInputFocus, CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext, ContextKeyExpr.equals(FocusedViewContext.key, OUTPUT_VIEW_ID)),
  primary: KeyMod.CtrlCmd | KeyCode.RightArrow,
  weight: KeybindingWeight.WorkbenchContrib
});
KeybindingsRegistry.registerKeybindingRule({
  id: "cursorWordAccessibilityRightSelect",
  when: ContextKeyExpr.and(EditorContextKeys.textInputFocus, CONTEXT_ACCESSIBILITY_MODE_ENABLED, IsWindowsContext, ContextKeyExpr.equals(FocusedViewContext.key, OUTPUT_VIEW_ID)),
  primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.RightArrow,
  weight: KeybindingWeight.WorkbenchContrib
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9vdXRwdXQvYnJvd3Nlci9vdXRwdXQuY29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBLZXlNb2QsIEtleUNob3JkLCBLZXlDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgTW9kZXNSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL21vZGVzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgTWVudUlkLCByZWdpc3RlckFjdGlvbjIsIEFjdGlvbjIsIE1lbnVSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBPdXRwdXRTZXJ2aWNlIH0gZnJvbSAnLi9vdXRwdXRTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBPVVRQVVRfTU9ERV9JRCwgT1VUUFVUX01JTUUsIE9VVFBVVF9WSUVXX0lELCBJT3V0cHV0U2VydmljZSwgQ09OVEVYVF9JTl9PVVRQVVQsIExPR19NT0RFX0lELCBMT0dfTUlNRSwgQ09OVEVYVF9PVVRQVVRfU0NST0xMX0xPQ0ssIElPdXRwdXRDaGFubmVsRGVzY3JpcHRvciwgQUNUSVZFX09VVFBVVF9DSEFOTkVMX0NPTlRFWFQsIENPTlRFWFRfQUNUSVZFX09VVFBVVF9MRVZFTF9TRVRUQUJMRSwgSU91dHB1dENoYW5uZWxSZWdpc3RyeSwgRXh0ZW5zaW9ucywgQ09OVEVYVF9BQ1RJVkVfT1VUUFVUX0xFVkVMLCBDT05URVhUX0FDVElWRV9PVVRQVVRfTEVWRUxfSVNfREVGQVVMVCwgU0hPV19JTkZPX0ZJTFRFUl9DT05URVhULCBTSE9XX1RSQUNFX0ZJTFRFUl9DT05URVhULCBTSE9XX0RFQlVHX0ZJTFRFUl9DT05URVhULCBTSE9XX0VSUk9SX0ZJTFRFUl9DT05URVhULCBTSE9XX1dBUk5JTkdfRklMVEVSX0NPTlRFWFQsIE9VVFBVVF9GSUxURVJfRk9DVVNfQ09OVEVYVCwgQ09OVEVYVF9BQ1RJVkVfTE9HX0ZJTEVfT1VUUFVULCBpc1NpbmdsZVNvdXJjZU91dHB1dENoYW5uZWxEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvb3V0cHV0L2NvbW1vbi9vdXRwdXQuanMnO1xuaW1wb3J0IHsgT3V0cHV0Vmlld1BhbmUgfSBmcm9tICcuL291dHB1dFZpZXcuanMnO1xuaW1wb3J0IHsgU3luY0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIFdvcmtiZW5jaEV4dGVuc2lvbnMsIElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBMaWZlY3ljbGVQaGFzZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IFZpZXdDb250YWluZXIsIElWaWV3Q29udGFpbmVyc1JlZ2lzdHJ5LCBWaWV3Q29udGFpbmVyTG9jYXRpb24sIEV4dGVuc2lvbnMgYXMgVmlld0NvbnRhaW5lckV4dGVuc2lvbnMsIElWaWV3c1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdzLmpzJztcbmltcG9ydCB7IElWaWV3c1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy92aWV3cy9jb21tb24vdmlld3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFZpZXdQYW5lQ29udGFpbmVyIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3UGFuZUNvbnRhaW5lci5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLCBDb25maWd1cmF0aW9uU2NvcGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVF1aWNrUGlja0l0ZW0sIElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrUGlja1NlcGFyYXRvciwgUXVpY2tQaWNrSW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IEFVWF9XSU5ET1dfR1JPVVAsIEFVWF9XSU5ET1dfR1JPVVBfVFlQRSwgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIsIENvbnRleHRLZXlFeHByZXNzaW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2ljb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBDYXRlZ29yaWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb25Db21tb25DYXRlZ29yaWVzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIGRpc3Bvc2UsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgQWNjZXNzaWJpbGl0eVNpZ25hbCwgSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eVNpZ25hbC9icm93c2VyL2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dnZXJTZXJ2aWNlLCBMb2dMZXZlbCwgTG9nTGV2ZWxUb0xvY2FsaXplZFN0cmluZywgTG9nTGV2ZWxUb1N0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElEZWZhdWx0TG9nTGV2ZWxzU2VydmljZSB9IGZyb20gJy4uLy4uL2xvZ3MvY29tbW9uL2RlZmF1bHRMb2dMZXZlbHMuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ3NSZWdpc3RyeSwgS2V5YmluZGluZ1dlaWdodCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IENPTlRFWFRfQUNDRVNTSUJJTElUWV9NT0RFX0VOQUJMRUQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5LmpzJztcbmltcG9ydCB7IElzV2luZG93c0NvbnRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5cy5qcyc7XG5pbXBvcnQgeyBGb2N1c2VkVmlld0NvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyB2aWV3RmlsdGVyU3VibWVudSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvdmlld3Mvdmlld0ZpbHRlci5qcyc7XG5pbXBvcnQgeyBWaWV3QWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy92aWV3cy92aWV3UGFuZS5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElGaWxlRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuXG5jb25zdCBJTVBPUlRFRF9MT0dfSURfUFJFRklYID0gJ2ltcG9ydGVkTG9nLic7XG5cbi8vIFJlZ2lzdGVyIFNlcnZpY2VcbnJlZ2lzdGVyU2luZ2xldG9uKElPdXRwdXRTZXJ2aWNlLCBPdXRwdXRTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcblxuLy8gUmVnaXN0ZXIgT3V0cHV0IE1vZGVcbk1vZGVzUmVnaXN0cnkucmVnaXN0ZXJMYW5ndWFnZSh7XG5cdGlkOiBPVVRQVVRfTU9ERV9JRCxcblx0ZXh0ZW5zaW9uczogW10sXG5cdG1pbWV0eXBlczogW09VVFBVVF9NSU1FXVxufSk7XG5cbi8vIFJlZ2lzdGVyIExvZyBPdXRwdXQgTW9kZVxuTW9kZXNSZWdpc3RyeS5yZWdpc3Rlckxhbmd1YWdlKHtcblx0aWQ6IExPR19NT0RFX0lELFxuXHRleHRlbnNpb25zOiBbXSxcblx0bWltZXR5cGVzOiBbTE9HX01JTUVdXG59KTtcblxuLy8gcmVnaXN0ZXIgb3V0cHV0IGNvbnRhaW5lclxuY29uc3Qgb3V0cHV0Vmlld0ljb24gPSByZWdpc3Rlckljb24oJ291dHB1dC12aWV3LWljb24nLCBDb2RpY29uLm91dHB1dCwgbmxzLmxvY2FsaXplKCdvdXRwdXRWaWV3SWNvbicsICdWaWV3IGljb24gb2YgdGhlIG91dHB1dCB2aWV3LicpKTtcbmNvbnN0IFZJRVdfQ09OVEFJTkVSOiBWaWV3Q29udGFpbmVyID0gUmVnaXN0cnkuYXM8SVZpZXdDb250YWluZXJzUmVnaXN0cnk+KFZpZXdDb250YWluZXJFeHRlbnNpb25zLlZpZXdDb250YWluZXJzUmVnaXN0cnkpLnJlZ2lzdGVyVmlld0NvbnRhaW5lcih7XG5cdGlkOiBPVVRQVVRfVklFV19JRCxcblx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ291dHB1dCcsIFwiT3V0cHV0XCIpLFxuXHRpY29uOiBvdXRwdXRWaWV3SWNvbixcblx0b3JkZXI6IDEsXG5cdGN0b3JEZXNjcmlwdG9yOiBuZXcgU3luY0Rlc2NyaXB0b3IoVmlld1BhbmVDb250YWluZXIsIFtPVVRQVVRfVklFV19JRCwgeyBtZXJnZVZpZXdXaXRoQ29udGFpbmVyV2hlblNpbmdsZVZpZXc6IHRydWUgfV0pLFxuXHRzdG9yYWdlSWQ6IE9VVFBVVF9WSUVXX0lELFxuXHRoaWRlSWZFbXB0eTogdHJ1ZSxcbn0sIFZpZXdDb250YWluZXJMb2NhdGlvbi5QYW5lbCwgeyBkb05vdFJlZ2lzdGVyT3BlbkNvbW1hbmQ6IHRydWUgfSk7XG5cblJlZ2lzdHJ5LmFzPElWaWV3c1JlZ2lzdHJ5PihWaWV3Q29udGFpbmVyRXh0ZW5zaW9ucy5WaWV3c1JlZ2lzdHJ5KS5yZWdpc3RlclZpZXdzKFt7XG5cdGlkOiBPVVRQVVRfVklFV19JRCxcblx0bmFtZTogbmxzLmxvY2FsaXplMignb3V0cHV0JywgXCJPdXRwdXRcIiksXG5cdGNvbnRhaW5lckljb246IG91dHB1dFZpZXdJY29uLFxuXHRjYW5Nb3ZlVmlldzogdHJ1ZSxcblx0Y2FuVG9nZ2xlVmlzaWJpbGl0eTogdHJ1ZSxcblx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihPdXRwdXRWaWV3UGFuZSksXG5cdG9wZW5Db21tYW5kQWN0aW9uRGVzY3JpcHRvcjoge1xuXHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5vdXRwdXQudG9nZ2xlT3V0cHV0Jyxcblx0XHRtbmVtb25pY1RpdGxlOiBubHMubG9jYWxpemUoeyBrZXk6ICdtaVRvZ2dsZU91dHB1dCcsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJk91dHB1dFwiKSxcblx0XHRrZXliaW5kaW5nczoge1xuXHRcdFx0cHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleVUsXG5cdFx0XHRsaW51eDoge1xuXHRcdFx0XHRwcmltYXJ5OiBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUgpICAvLyBPbiBVYnVudHUgQ3RybCtTaGlmdCtVIGlzIHRha2VuIGJ5IHNvbWUgZ2xvYmFsIE9TIGNvbW1hbmRcblx0XHRcdH1cblx0XHR9LFxuXHRcdG9yZGVyOiAxLFxuXHR9XG59XSwgVklFV19DT05UQUlORVIpO1xuXG5jbGFzcyBPdXRwdXRDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJT3V0cHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG91dHB1dFNlcnZpY2U6IElPdXRwdXRTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMucmVnaXN0ZXJBY3Rpb25zKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyQWN0aW9ucygpOiB2b2lkIHtcblx0XHR0aGlzLnJlZ2lzdGVyU3dpdGNoT3V0cHV0QWN0aW9uKCk7XG5cdFx0dGhpcy5yZWdpc3RlckFkZENvbXBvdW5kTG9nQWN0aW9uKCk7XG5cdFx0dGhpcy5yZWdpc3RlclJlbW92ZUxvZ0FjdGlvbigpO1xuXHRcdHRoaXMucmVnaXN0ZXJTaG93T3V0cHV0Q2hhbm5lbHNBY3Rpb24oKTtcblx0XHR0aGlzLnJlZ2lzdGVyQ2xlYXJPdXRwdXRBY3Rpb24oKTtcblx0XHR0aGlzLnJlZ2lzdGVyVG9nZ2xlQXV0b1Njcm9sbEFjdGlvbigpO1xuXHRcdHRoaXMucmVnaXN0ZXJPcGVuQWN0aXZlT3V0cHV0RmlsZUFjdGlvbigpO1xuXHRcdHRoaXMucmVnaXN0ZXJPcGVuQWN0aXZlT3V0cHV0RmlsZUluQXV4V2luZG93QWN0aW9uKCk7XG5cdFx0dGhpcy5yZWdpc3RlclNhdmVBY3RpdmVPdXRwdXRBc0FjdGlvbigpO1xuXHRcdHRoaXMucmVnaXN0ZXJTaG93TG9nc0FjdGlvbigpO1xuXHRcdHRoaXMucmVnaXN0ZXJPcGVuTG9nRmlsZUFjdGlvbigpO1xuXHRcdHRoaXMucmVnaXN0ZXJDb25maWd1cmVBY3RpdmVPdXRwdXRMb2dMZXZlbEFjdGlvbigpO1xuXHRcdHRoaXMucmVnaXN0ZXJMb2dMZXZlbEZpbHRlckFjdGlvbnMoKTtcblx0XHR0aGlzLnJlZ2lzdGVyQ2xlYXJGaWx0ZXJBY3Rpb25zKCk7XG5cdFx0dGhpcy5yZWdpc3RlckV4cG9ydExvZ3NBY3Rpb24oKTtcblx0XHR0aGlzLnJlZ2lzdGVySW1wb3J0TG9nQWN0aW9uKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyU3dpdGNoT3V0cHV0QWN0aW9uKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogYHdvcmtiZW5jaC5vdXRwdXQuYWN0aW9uLnN3aXRjaEJldHdlZW5PdXRwdXRzYCxcblx0XHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdzd2l0Y2hCZXR3ZWVuT3V0cHV0cy5sYWJlbCcsIFwiU3dpdGNoIE91dHB1dFwiKSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGNoYW5uZWxJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdGlmIChjaGFubmVsSWQpIHtcblx0XHRcdFx0XHRhY2Nlc3Nvci5nZXQoSU91dHB1dFNlcnZpY2UpLnNob3dDaGFubmVsKGNoYW5uZWxJZCwgdHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0Y29uc3Qgc3dpdGNoT3V0cHV0TWVudSA9IG5ldyBNZW51SWQoJ3dvcmtiZW5jaC5vdXRwdXQubWVudS5zd2l0Y2hPdXRwdXQnKTtcblx0XHR0aGlzLl9yZWdpc3RlcihNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLlZpZXdUaXRsZSwge1xuXHRcdFx0c3VibWVudTogc3dpdGNoT3V0cHV0TWVudSxcblx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ3N3aXRjaFRvT3V0cHV0LmxhYmVsJywgXCJTd2l0Y2ggT3V0cHV0XCIpLFxuXHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIE9VVFBVVF9WSUVXX0lEKSxcblx0XHRcdG9yZGVyOiAxLFxuXHRcdFx0aXNTZWxlY3Rpb246IHRydWVcblx0XHR9KSk7XG5cdFx0Y29uc3QgcmVnaXN0ZXJlZENoYW5uZWxzID0gbmV3IE1hcDxzdHJpbmcsIElEaXNwb3NhYmxlPigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiBkaXNwb3NlKHJlZ2lzdGVyZWRDaGFubmVscy52YWx1ZXMoKSkpKTtcblx0XHRjb25zdCByZWdpc3Rlck91dHB1dENoYW5uZWxzID0gKGNoYW5uZWxzOiBJT3V0cHV0Q2hhbm5lbERlc2NyaXB0b3JbXSkgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBjaGFubmVsIG9mIGNoYW5uZWxzKSB7XG5cdFx0XHRcdGNvbnN0IHRpdGxlID0gY2hhbm5lbC5sYWJlbDtcblx0XHRcdFx0Y29uc3QgZ3JvdXAgPSBjaGFubmVsLnVzZXIgPyAnMl91c2VyX291dHB1dGNoYW5uZWxzJyA6IGNoYW5uZWwuZXh0ZW5zaW9uSWQgPyAnMF9leHRfb3V0cHV0Y2hhbm5lbHMnIDogJzFfY29yZV9vdXRwdXRjaGFubmVscyc7XG5cdFx0XHRcdHJlZ2lzdGVyZWRDaGFubmVscy5zZXQoY2hhbm5lbC5pZCwgcmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0XHRcdGlkOiBgd29ya2JlbmNoLmFjdGlvbi5vdXRwdXQuc2hvdy4ke2NoYW5uZWwuaWR9YCxcblx0XHRcdFx0XHRcdFx0dGl0bGUsXG5cdFx0XHRcdFx0XHRcdHRvZ2dsZWQ6IEFDVElWRV9PVVRQVVRfQ0hBTk5FTF9DT05URVhULmlzRXF1YWxUbyhjaGFubmVsLmlkKSxcblx0XHRcdFx0XHRcdFx0bWVudToge1xuXHRcdFx0XHRcdFx0XHRcdGlkOiBzd2l0Y2hPdXRwdXRNZW51LFxuXHRcdFx0XHRcdFx0XHRcdGdyb3VwLFxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gYWNjZXNzb3IuZ2V0KElPdXRwdXRTZXJ2aWNlKS5zaG93Q2hhbm5lbChjaGFubmVsLmlkLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJlZ2lzdGVyT3V0cHV0Q2hhbm5lbHModGhpcy5vdXRwdXRTZXJ2aWNlLmdldENoYW5uZWxEZXNjcmlwdG9ycygpKTtcblx0XHRjb25zdCBvdXRwdXRDaGFubmVsUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJT3V0cHV0Q2hhbm5lbFJlZ2lzdHJ5PihFeHRlbnNpb25zLk91dHB1dENoYW5uZWxzKTtcblx0XHR0aGlzLl9yZWdpc3RlcihvdXRwdXRDaGFubmVsUmVnaXN0cnkub25EaWRSZWdpc3RlckNoYW5uZWwoZSA9PiB7XG5cdFx0XHRjb25zdCBjaGFubmVsID0gdGhpcy5vdXRwdXRTZXJ2aWNlLmdldENoYW5uZWxEZXNjcmlwdG9yKGUpO1xuXHRcdFx0aWYgKGNoYW5uZWwpIHtcblx0XHRcdFx0cmVnaXN0ZXJPdXRwdXRDaGFubmVscyhbY2hhbm5lbF0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3RlcihvdXRwdXRDaGFubmVsUmVnaXN0cnkub25EaWRSZW1vdmVDaGFubmVsKGUgPT4ge1xuXHRcdFx0cmVnaXN0ZXJlZENoYW5uZWxzLmdldChlLmlkKT8uZGlzcG9zZSgpO1xuXHRcdFx0cmVnaXN0ZXJlZENoYW5uZWxzLmRlbGV0ZShlLmlkKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyQWRkQ29tcG91bmRMb2dBY3Rpb24oKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5vdXRwdXQuYWRkQ29tcG91bmRMb2cnLFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdhZGRDb21wb3VuZExvZycsIFwiQWRkIENvbXBvdW5kIExvZy4uLlwiKSxcblx0XHRcdFx0XHRjYXRlZ29yeTogbmxzLmxvY2FsaXplMignb3V0cHV0JywgXCJPdXRwdXRcIiksXG5cdFx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdFx0bWVudTogW3tcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgT1VUUFVUX1ZJRVdfSUQpLFxuXHRcdFx0XHRcdFx0Z3JvdXA6ICcyX2FkZCcsXG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdGNvbnN0IG91dHB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU91dHB1dFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbkxvZ3M6IElPdXRwdXRDaGFubmVsRGVzY3JpcHRvcltdID0gW10sIGxvZ3M6IElPdXRwdXRDaGFubmVsRGVzY3JpcHRvcltdID0gW107XG5cdFx0XHRcdGZvciAoY29uc3QgY2hhbm5lbCBvZiBvdXRwdXRTZXJ2aWNlLmdldENoYW5uZWxEZXNjcmlwdG9ycygpKSB7XG5cdFx0XHRcdFx0aWYgKGNoYW5uZWwubG9nICYmICFjaGFubmVsLnVzZXIpIHtcblx0XHRcdFx0XHRcdGlmIChjaGFubmVsLmV4dGVuc2lvbklkKSB7XG5cdFx0XHRcdFx0XHRcdGV4dGVuc2lvbkxvZ3MucHVzaChjaGFubmVsKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGxvZ3MucHVzaChjaGFubmVsKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgZW50cmllczogQXJyYXk8SU91dHB1dENoYW5uZWxEZXNjcmlwdG9yIHwgSVF1aWNrUGlja1NlcGFyYXRvcj4gPSBbXTtcblx0XHRcdFx0Zm9yIChjb25zdCBsb2cgb2YgbG9ncy5zb3J0KChhLCBiKSA9PiBhLmxhYmVsLmxvY2FsZUNvbXBhcmUoYi5sYWJlbCkpKSB7XG5cdFx0XHRcdFx0ZW50cmllcy5wdXNoKGxvZyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGV4dGVuc2lvbkxvZ3MubGVuZ3RoICYmIGxvZ3MubGVuZ3RoKSB7XG5cdFx0XHRcdFx0ZW50cmllcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiBubHMubG9jYWxpemUoJ2V4dGVuc2lvbkxvZ3MnLCBcIkV4dGVuc2lvbiBMb2dzXCIpIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAoY29uc3QgbG9nIG9mIGV4dGVuc2lvbkxvZ3Muc29ydCgoYSwgYikgPT4gYS5sYWJlbC5sb2NhbGVDb21wYXJlKGIubGFiZWwpKSkge1xuXHRcdFx0XHRcdGVudHJpZXMucHVzaChsb2cpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHF1aWNrSW5wdXRTZXJ2aWNlLnBpY2soZW50cmllcywgeyBwbGFjZUhvbGRlcjogbmxzLmxvY2FsaXplKCdzZWxlY3Rsb2cnLCBcIlNlbGVjdCBMb2dcIiksIGNhblBpY2tNYW55OiB0cnVlIH0pO1xuXHRcdFx0XHRpZiAocmVzdWx0Py5sZW5ndGgpIHtcblx0XHRcdFx0XHRvdXRwdXRTZXJ2aWNlLnNob3dDaGFubmVsKG91dHB1dFNlcnZpY2UucmVnaXN0ZXJDb21wb3VuZExvZ0NoYW5uZWwocmVzdWx0KSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyUmVtb3ZlTG9nQWN0aW9uKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ub3V0cHV0LnJlbW92ZScsXG5cdFx0XHRcdFx0dGl0bGU6IG5scy5sb2NhbGl6ZTIoJ3JlbW92ZUxvZycsIFwiUmVtb3ZlIE91dHB1dC4uLlwiKSxcblx0XHRcdFx0XHRjYXRlZ29yeTogbmxzLmxvY2FsaXplMignb3V0cHV0JywgXCJPdXRwdXRcIiksXG5cdFx0XHRcdFx0ZjE6IHRydWVcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0Y29uc3Qgb3V0cHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJT3V0cHV0U2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IG5vdGlmaWNhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGlmaWNhdGlvblNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBlbnRyaWVzOiBBcnJheTxJT3V0cHV0Q2hhbm5lbERlc2NyaXB0b3I+ID0gb3V0cHV0U2VydmljZS5nZXRDaGFubmVsRGVzY3JpcHRvcnMoKS5maWx0ZXIoY2hhbm5lbCA9PiBjaGFubmVsLnVzZXIpO1xuXHRcdFx0XHRpZiAoZW50cmllcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLmluZm8obmxzLmxvY2FsaXplKCdub2N1c3R1bW91dHB1dCcsIFwiTm8gY3VzdG9tIG91dHB1dHMgdG8gcmVtb3ZlLlwiKSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHF1aWNrSW5wdXRTZXJ2aWNlLnBpY2soZW50cmllcywgeyBwbGFjZUhvbGRlcjogbmxzLmxvY2FsaXplKCdzZWxlY3Rsb2cnLCBcIlNlbGVjdCBMb2dcIiksIGNhblBpY2tNYW55OiB0cnVlIH0pO1xuXHRcdFx0XHRpZiAoIXJlc3VsdD8ubGVuZ3RoKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IG91dHB1dENoYW5uZWxSZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElPdXRwdXRDaGFubmVsUmVnaXN0cnk+KEV4dGVuc2lvbnMuT3V0cHV0Q2hhbm5lbHMpO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGNoYW5uZWwgb2YgcmVzdWx0KSB7XG5cdFx0XHRcdFx0b3V0cHV0Q2hhbm5lbFJlZ2lzdHJ5LnJlbW92ZUNoYW5uZWwoY2hhbm5lbC5pZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyU2hvd091dHB1dENoYW5uZWxzQWN0aW9uKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uc2hvd091dHB1dENoYW5uZWxzJyxcblx0XHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignc2hvd091dHB1dENoYW5uZWxzJywgXCJTaG93IE91dHB1dCBDaGFubmVscy4uLlwiKSxcblx0XHRcdFx0XHRjYXRlZ29yeTogbmxzLmxvY2FsaXplMignb3V0cHV0JywgXCJPdXRwdXRcIiksXG5cdFx0XHRcdFx0ZjE6IHRydWVcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0Y29uc3Qgb3V0cHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJT3V0cHV0U2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbkNoYW5uZWxzID0gW10sIGNvcmVDaGFubmVscyA9IFtdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGNoYW5uZWwgb2Ygb3V0cHV0U2VydmljZS5nZXRDaGFubmVsRGVzY3JpcHRvcnMoKSkge1xuXHRcdFx0XHRcdGlmIChjaGFubmVsLmV4dGVuc2lvbklkKSB7XG5cdFx0XHRcdFx0XHRleHRlbnNpb25DaGFubmVscy5wdXNoKGNoYW5uZWwpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRjb3JlQ2hhbm5lbHMucHVzaChjaGFubmVsKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgZW50cmllczogKHsgaWQ6IHN0cmluZzsgbGFiZWw6IHN0cmluZyB9IHwgSVF1aWNrUGlja1NlcGFyYXRvcilbXSA9IFtdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHsgaWQsIGxhYmVsIH0gb2YgZXh0ZW5zaW9uQ2hhbm5lbHMpIHtcblx0XHRcdFx0XHRlbnRyaWVzLnB1c2goeyBpZCwgbGFiZWwgfSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGV4dGVuc2lvbkNoYW5uZWxzLmxlbmd0aCAmJiBjb3JlQ2hhbm5lbHMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0ZW50cmllcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicgfSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9yIChjb25zdCB7IGlkLCBsYWJlbCB9IG9mIGNvcmVDaGFubmVscykge1xuXHRcdFx0XHRcdGVudHJpZXMucHVzaCh7IGlkLCBsYWJlbCB9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBlbnRyeSA9IGF3YWl0IHF1aWNrSW5wdXRTZXJ2aWNlLnBpY2soZW50cmllcywgeyBwbGFjZUhvbGRlcjogbmxzLmxvY2FsaXplKCdzZWxlY3RPdXRwdXQnLCBcIlNlbGVjdCBPdXRwdXQgQ2hhbm5lbFwiKSB9KTtcblx0XHRcdFx0aWYgKGVudHJ5KSB7XG5cdFx0XHRcdFx0cmV0dXJuIG91dHB1dFNlcnZpY2Uuc2hvd0NoYW5uZWwoZW50cnkuaWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckNsZWFyT3V0cHV0QWN0aW9uKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogYHdvcmtiZW5jaC5vdXRwdXQuYWN0aW9uLmNsZWFyT3V0cHV0YCxcblx0XHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignY2xlYXJPdXRwdXQubGFiZWwnLCBcIkNsZWFyIE91dHB1dFwiKSxcblx0XHRcdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5WaWV3LFxuXHRcdFx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIE9VVFBVVF9WSUVXX0lEKSxcblx0XHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGVcblx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLkVkaXRvckNvbnRleHQsXG5cdFx0XHRcdFx0XHR3aGVuOiBDT05URVhUX0lOX09VVFBVVFxuXHRcdFx0XHRcdH1dLFxuXHRcdFx0XHRcdGljb246IENvZGljb24uY2xlYXJBbGxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0Y29uc3Qgb3V0cHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJT3V0cHV0U2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGFjdGl2ZUNoYW5uZWwgPSBvdXRwdXRTZXJ2aWNlLmdldEFjdGl2ZUNoYW5uZWwoKTtcblx0XHRcdFx0aWYgKGFjdGl2ZUNoYW5uZWwpIHtcblx0XHRcdFx0XHRhY3RpdmVDaGFubmVsLmNsZWFyKCk7XG5cdFx0XHRcdFx0YWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UucGxheVNpZ25hbChBY2Nlc3NpYmlsaXR5U2lnbmFsLmNsZWFyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJUb2dnbGVBdXRvU2Nyb2xsQWN0aW9uKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogYHdvcmtiZW5jaC5vdXRwdXQuYWN0aW9uLnRvZ2dsZUF1dG9TY3JvbGxgLFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCd0b2dnbGVBdXRvU2Nyb2xsJywgXCJUb2dnbGUgQXV0byBTY3JvbGxpbmdcIiksXG5cdFx0XHRcdFx0dG9vbHRpcDogbmxzLmxvY2FsaXplKCdvdXRwdXRTY3JvbGxPZmYnLCBcIlR1cm4gQXV0byBTY3JvbGxpbmcgT2ZmXCIpLFxuXHRcdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIE9VVFBVVF9WSUVXX0lEKSksXG5cdFx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdFx0b3JkZXI6IDMsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRpY29uOiBDb2RpY29uLmxvY2ssXG5cdFx0XHRcdFx0dG9nZ2xlZDoge1xuXHRcdFx0XHRcdFx0Y29uZGl0aW9uOiBDT05URVhUX09VVFBVVF9TQ1JPTExfTE9DSyxcblx0XHRcdFx0XHRcdGljb246IENvZGljb24udW5sb2NrLFxuXHRcdFx0XHRcdFx0dG9vbHRpcDogbmxzLmxvY2FsaXplKCdvdXRwdXRTY3JvbGxPbicsIFwiVHVybiBBdXRvIFNjcm9sbGluZyBPblwiKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0Y29uc3Qgb3V0cHV0VmlldyA9IGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKS5nZXRBY3RpdmVWaWV3V2l0aElkPE91dHB1dFZpZXdQYW5lPihPVVRQVVRfVklFV19JRCkhO1xuXHRcdFx0XHRvdXRwdXRWaWV3LnNjcm9sbExvY2sgPSAhb3V0cHV0Vmlldy5zY3JvbGxMb2NrO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJPcGVuQWN0aXZlT3V0cHV0RmlsZUFjdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6IGB3b3JrYmVuY2guYWN0aW9uLm9wZW5BY3RpdmVMb2dPdXRwdXRGaWxlYCxcblx0XHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignb3BlbkFjdGl2ZU91dHB1dEZpbGUnLCBcIk9wZW4gT3V0cHV0IGluIEVkaXRvclwiKSxcblx0XHRcdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCBPVVRQVVRfVklFV19JRCksXG5cdFx0XHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRcdFx0b3JkZXI6IDQsXG5cdFx0XHRcdFx0XHRpc0hpZGRlbkJ5RGVmYXVsdDogdHJ1ZVxuXHRcdFx0XHRcdH1dLFxuXHRcdFx0XHRcdGljb246IENvZGljb24uZ29Ub0ZpbGUsXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0YXN5bmMgcnVuKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHR0aGF0Lm9wZW5BY3RpdmVPdXRwdXQoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyT3BlbkFjdGl2ZU91dHB1dEZpbGVJbkF1eFdpbmRvd0FjdGlvbigpOiB2b2lkIHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6IGB3b3JrYmVuY2guYWN0aW9uLm9wZW5BY3RpdmVMb2dPdXRwdXRGaWxlSW5OZXdXaW5kb3dgLFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdvcGVuQWN0aXZlT3V0cHV0RmlsZUluTmV3V2luZG93JywgXCJPcGVuIE91dHB1dCBpbiBOZXcgV2luZG93XCIpLFxuXHRcdFx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIE9VVFBVVF9WSUVXX0lEKSxcblx0XHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0XHRvcmRlcjogNSxcblx0XHRcdFx0XHRcdGlzSGlkZGVuQnlEZWZhdWx0OiB0cnVlXG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdFx0aWNvbjogQ29kaWNvbi5lbXB0eVdpbmRvdyxcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRhc3luYyBydW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdHRoYXQub3BlbkFjdGl2ZU91dHB1dChBVVhfV0lORE9XX0dST1VQKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyU2F2ZUFjdGl2ZU91dHB1dEFzQWN0aW9uKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogYHdvcmtiZW5jaC5hY3Rpb24uc2F2ZUFjdGl2ZUxvZ091dHB1dEFzYCxcblx0XHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignc2F2ZUFjdGl2ZU91dHB1dEFzJywgXCJTYXZlIE91dHB1dCBBcy4uLlwiKSxcblx0XHRcdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCBPVVRQVVRfVklFV19JRCksXG5cdFx0XHRcdFx0XHRncm91cDogJzFfZXhwb3J0Jyxcblx0XHRcdFx0XHRcdG9yZGVyOiAxXG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdGNvbnN0IG91dHB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU91dHB1dFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBjaGFubmVsID0gb3V0cHV0U2VydmljZS5nZXRBY3RpdmVDaGFubmVsKCk7XG5cdFx0XHRcdGlmIChjaGFubmVsKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGVzY3JpcHRvciA9IG91dHB1dFNlcnZpY2UuZ2V0Q2hhbm5lbERlc2NyaXB0b3JzKCkuZmluZChjID0+IGMuaWQgPT09IGNoYW5uZWwuaWQpO1xuXHRcdFx0XHRcdGlmIChkZXNjcmlwdG9yKSB7XG5cdFx0XHRcdFx0XHRhd2FpdCBvdXRwdXRTZXJ2aWNlLnNhdmVPdXRwdXRBcyhkZXNjcmlwdG9yKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9wZW5BY3RpdmVPdXRwdXQoZ3JvdXA/OiBBVVhfV0lORE9XX0dST1VQX1RZUEUpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjaGFubmVsID0gdGhpcy5vdXRwdXRTZXJ2aWNlLmdldEFjdGl2ZUNoYW5uZWwoKTtcblx0XHRpZiAoY2hhbm5lbCkge1xuXHRcdFx0YXdhaXQgdGhpcy5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0XHRyZXNvdXJjZTogY2hhbm5lbC51cmksXG5cdFx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0XHRwaW5uZWQ6IHRydWUsXG5cdFx0XHRcdH0sXG5cdFx0XHR9LCBncm91cCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckNvbmZpZ3VyZUFjdGl2ZU91dHB1dExvZ0xldmVsQWN0aW9uKCk6IHZvaWQge1xuXHRcdGNvbnN0IGxvZ0xldmVsTWVudSA9IG5ldyBNZW51SWQoJ3dvcmtiZW5jaC5vdXRwdXQubWVudS5sb2dMZXZlbCcpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuVmlld1RpdGxlLCB7XG5cdFx0XHRzdWJtZW51OiBsb2dMZXZlbE1lbnUsXG5cdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCdsb2dMZXZlbC5sYWJlbCcsIFwiU2V0IExvZyBMZXZlbC4uLlwiKSxcblx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgT1VUUFVUX1ZJRVdfSUQpLCBDT05URVhUX0FDVElWRV9PVVRQVVRfTEVWRUxfU0VUVEFCTEUpLFxuXHRcdFx0aWNvbjogQ29kaWNvbi5nZWFyLFxuXHRcdFx0b3JkZXI6IDZcblx0XHR9KSk7XG5cblx0XHRsZXQgb3JkZXIgPSAwO1xuXHRcdGNvbnN0IHJlZ2lzdGVyTG9nTGV2ZWwgPSAobG9nTGV2ZWw6IExvZ0xldmVsKSA9PiB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdFx0aWQ6IGB3b3JrYmVuY2guYWN0aW9uLm91dHB1dC5hY3RpdmVPdXRwdXRMb2dMZXZlbC4ke2xvZ0xldmVsfWAsXG5cdFx0XHRcdFx0XHR0aXRsZTogTG9nTGV2ZWxUb0xvY2FsaXplZFN0cmluZyhsb2dMZXZlbCkudmFsdWUsXG5cdFx0XHRcdFx0XHR0b2dnbGVkOiBDT05URVhUX0FDVElWRV9PVVRQVVRfTEVWRUwuaXNFcXVhbFRvKExvZ0xldmVsVG9TdHJpbmcobG9nTGV2ZWwpKSxcblx0XHRcdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRcdFx0aWQ6IGxvZ0xldmVsTWVudSxcblx0XHRcdFx0XHRcdFx0b3JkZXI6IG9yZGVyKyssXG5cdFx0XHRcdFx0XHRcdGdyb3VwOiAnMF9sZXZlbCdcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0XHRjb25zdCBvdXRwdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElPdXRwdXRTZXJ2aWNlKTtcblx0XHRcdFx0XHRjb25zdCBjaGFubmVsID0gb3V0cHV0U2VydmljZS5nZXRBY3RpdmVDaGFubmVsKCk7XG5cdFx0XHRcdFx0aWYgKGNoYW5uZWwpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGNoYW5uZWxEZXNjcmlwdG9yID0gb3V0cHV0U2VydmljZS5nZXRDaGFubmVsRGVzY3JpcHRvcihjaGFubmVsLmlkKTtcblx0XHRcdFx0XHRcdGlmIChjaGFubmVsRGVzY3JpcHRvcikge1xuXHRcdFx0XHRcdFx0XHRvdXRwdXRTZXJ2aWNlLnNldExvZ0xldmVsKGNoYW5uZWxEZXNjcmlwdG9yLCBsb2dMZXZlbCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fTtcblxuXHRcdHJlZ2lzdGVyTG9nTGV2ZWwoTG9nTGV2ZWwuVHJhY2UpO1xuXHRcdHJlZ2lzdGVyTG9nTGV2ZWwoTG9nTGV2ZWwuRGVidWcpO1xuXHRcdHJlZ2lzdGVyTG9nTGV2ZWwoTG9nTGV2ZWwuSW5mbyk7XG5cdFx0cmVnaXN0ZXJMb2dMZXZlbChMb2dMZXZlbC5XYXJuaW5nKTtcblx0XHRyZWdpc3RlckxvZ0xldmVsKExvZ0xldmVsLkVycm9yKTtcblx0XHRyZWdpc3RlckxvZ0xldmVsKExvZ0xldmVsLk9mZik7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6IGB3b3JrYmVuY2guYWN0aW9uLm91dHB1dC5hY3RpdmVPdXRwdXRMb2dMZXZlbERlZmF1bHRgLFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ2xvZ0xldmVsRGVmYXVsdC5sYWJlbCcsIFwiU2V0IEFzIERlZmF1bHRcIiksXG5cdFx0XHRcdFx0bWVudToge1xuXHRcdFx0XHRcdFx0aWQ6IGxvZ0xldmVsTWVudSxcblx0XHRcdFx0XHRcdG9yZGVyLFxuXHRcdFx0XHRcdFx0Z3JvdXA6ICcxX2RlZmF1bHQnXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRwcmVjb25kaXRpb246IENPTlRFWFRfQUNUSVZFX09VVFBVVF9MRVZFTF9JU19ERUZBVUxULm5lZ2F0ZSgpXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdGNvbnN0IG91dHB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU91dHB1dFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBsb2dnZXJTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMb2dnZXJTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgZGVmYXVsdExvZ0xldmVsc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSURlZmF1bHRMb2dMZXZlbHNTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgY2hhbm5lbCA9IG91dHB1dFNlcnZpY2UuZ2V0QWN0aXZlQ2hhbm5lbCgpO1xuXHRcdFx0XHRpZiAoY2hhbm5lbCkge1xuXHRcdFx0XHRcdGNvbnN0IGNoYW5uZWxEZXNjcmlwdG9yID0gb3V0cHV0U2VydmljZS5nZXRDaGFubmVsRGVzY3JpcHRvcihjaGFubmVsLmlkKTtcblx0XHRcdFx0XHRpZiAoY2hhbm5lbERlc2NyaXB0b3IgJiYgaXNTaW5nbGVTb3VyY2VPdXRwdXRDaGFubmVsRGVzY3JpcHRvcihjaGFubmVsRGVzY3JpcHRvcikpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGxvZ0xldmVsID0gbG9nZ2VyU2VydmljZS5nZXRMb2dMZXZlbChjaGFubmVsRGVzY3JpcHRvci5zb3VyY2UucmVzb3VyY2UpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIGF3YWl0IGRlZmF1bHRMb2dMZXZlbHNTZXJ2aWNlLnNldERlZmF1bHRMb2dMZXZlbChsb2dMZXZlbCwgY2hhbm5lbERlc2NyaXB0b3IuZXh0ZW5zaW9uSWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJTaG93TG9nc0FjdGlvbigpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnNob3dMb2dzJyxcblx0XHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignc2hvd0xvZ3MnLCBcIlNob3cgTG9ncy4uLlwiKSxcblx0XHRcdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5EZXZlbG9wZXIsXG5cdFx0XHRcdFx0bWVudToge1xuXHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRjb25zdCBvdXRwdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElPdXRwdXRTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uTG9ncyA9IFtdLCBsb2dzID0gW107XG5cdFx0XHRcdGZvciAoY29uc3QgY2hhbm5lbCBvZiBvdXRwdXRTZXJ2aWNlLmdldENoYW5uZWxEZXNjcmlwdG9ycygpKSB7XG5cdFx0XHRcdFx0aWYgKGNoYW5uZWwubG9nKSB7XG5cdFx0XHRcdFx0XHRpZiAoY2hhbm5lbC5leHRlbnNpb25JZCkge1xuXHRcdFx0XHRcdFx0XHRleHRlbnNpb25Mb2dzLnB1c2goY2hhbm5lbCk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRsb2dzLnB1c2goY2hhbm5lbCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGVudHJpZXM6ICh7IGlkOiBzdHJpbmc7IGxhYmVsOiBzdHJpbmcgfSB8IElRdWlja1BpY2tTZXBhcmF0b3IpW10gPSBbXTtcblx0XHRcdFx0Zm9yIChjb25zdCB7IGlkLCBsYWJlbCB9IG9mIGxvZ3MpIHtcblx0XHRcdFx0XHRlbnRyaWVzLnB1c2goeyBpZCwgbGFiZWwgfSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGV4dGVuc2lvbkxvZ3MubGVuZ3RoICYmIGxvZ3MubGVuZ3RoKSB7XG5cdFx0XHRcdFx0ZW50cmllcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiBubHMubG9jYWxpemUoJ2V4dGVuc2lvbkxvZ3MnLCBcIkV4dGVuc2lvbiBMb2dzXCIpIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAoY29uc3QgeyBpZCwgbGFiZWwgfSBvZiBleHRlbnNpb25Mb2dzKSB7XG5cdFx0XHRcdFx0ZW50cmllcy5wdXNoKHsgaWQsIGxhYmVsIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGVudHJ5ID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucGljayhlbnRyaWVzLCB7IHBsYWNlSG9sZGVyOiBubHMubG9jYWxpemUoJ3NlbGVjdGxvZycsIFwiU2VsZWN0IExvZ1wiKSB9KTtcblx0XHRcdFx0aWYgKGVudHJ5KSB7XG5cdFx0XHRcdFx0cmV0dXJuIG91dHB1dFNlcnZpY2Uuc2hvd0NoYW5uZWwoZW50cnkuaWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlck9wZW5Mb2dGaWxlQWN0aW9uKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24ub3BlbkxvZ0ZpbGUnLFxuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUyKCdvcGVuTG9nRmlsZScsIFwiT3BlbiBMb2cuLi5cIiksXG5cdFx0XHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuRGV2ZWxvcGVyLFxuXHRcdFx0XHRcdG1lbnU6IHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246ICd3b3JrYmVuY2guYWN0aW9uLm9wZW5Mb2dGaWxlJyxcblx0XHRcdFx0XHRcdGFyZ3M6IFt7XG5cdFx0XHRcdFx0XHRcdG5hbWU6ICdsb2dGaWxlJyxcblx0XHRcdFx0XHRcdFx0c2NoZW1hOiB7XG5cdFx0XHRcdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdsb2dGaWxlJywgXCJUaGUgaWQgb2YgdGhlIGxvZyBmaWxlIHRvIG9wZW4sIGZvciBleGFtcGxlIGBcXFwid2luZG93XFxcImAuIEN1cnJlbnRseSB0aGUgYmVzdCB3YXkgdG8gZ2V0IHRoaXMgaXMgdG8gZ2V0IHRoZSBJRCBieSBjaGVja2luZyB0aGUgYHdvcmtiZW5jaC5hY3Rpb24ub3V0cHV0LnNob3cuPGlkPmAgY29tbWFuZHNcIiksXG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgYXJncz86IHVua25vd24pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0Y29uc3Qgb3V0cHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJT3V0cHV0U2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUVkaXRvclNlcnZpY2UpO1xuXHRcdFx0XHRsZXQgZW50cnk6IElRdWlja1BpY2tJdGVtIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRjb25zdCBhcmdOYW1lID0gYXJncyAmJiB0eXBlb2YgYXJncyA9PT0gJ3N0cmluZycgPyBhcmdzIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25DaGFubmVsczogSVF1aWNrUGlja0l0ZW1bXSA9IFtdO1xuXHRcdFx0XHRjb25zdCBjb3JlQ2hhbm5lbHM6IElRdWlja1BpY2tJdGVtW10gPSBbXTtcblx0XHRcdFx0Zm9yIChjb25zdCBjIG9mIG91dHB1dFNlcnZpY2UuZ2V0Q2hhbm5lbERlc2NyaXB0b3JzKCkpIHtcblx0XHRcdFx0XHRpZiAoYy5sb2cpIHtcblx0XHRcdFx0XHRcdGNvbnN0IGUgPSB7IGlkOiBjLmlkLCBsYWJlbDogYy5sYWJlbCB9O1xuXHRcdFx0XHRcdFx0aWYgKGMuZXh0ZW5zaW9uSWQpIHtcblx0XHRcdFx0XHRcdFx0ZXh0ZW5zaW9uQ2hhbm5lbHMucHVzaChlKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGNvcmVDaGFubmVscy5wdXNoKGUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKGUuaWQgPT09IGFyZ05hbWUpIHtcblx0XHRcdFx0XHRcdFx0ZW50cnkgPSBlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIWVudHJ5KSB7XG5cdFx0XHRcdFx0Y29uc3QgZW50cmllczogUXVpY2tQaWNrSW5wdXRbXSA9IFsuLi5leHRlbnNpb25DaGFubmVscy5zb3J0KChhLCBiKSA9PiBhLmxhYmVsLmxvY2FsZUNvbXBhcmUoYi5sYWJlbCkpXTtcblx0XHRcdFx0XHRpZiAoZW50cmllcy5sZW5ndGggJiYgY29yZUNoYW5uZWxzLmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0ZW50cmllcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicgfSk7XG5cdFx0XHRcdFx0XHRlbnRyaWVzLnB1c2goLi4uY29yZUNoYW5uZWxzLnNvcnQoKGEsIGIpID0+IGEubGFiZWwubG9jYWxlQ29tcGFyZShiLmxhYmVsKSkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRlbnRyeSA9IDxJUXVpY2tQaWNrSXRlbSB8IHVuZGVmaW5lZD5hd2FpdCBxdWlja0lucHV0U2VydmljZS5waWNrKGVudHJpZXMsIHsgcGxhY2VIb2xkZXI6IG5scy5sb2NhbGl6ZSgnc2VsZWN0bG9nRmlsZScsIFwiU2VsZWN0IExvZyBGaWxlXCIpIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChlbnRyeT8uaWQpIHtcblx0XHRcdFx0XHRjb25zdCBjaGFubmVsID0gb3V0cHV0U2VydmljZS5nZXRDaGFubmVsKGVudHJ5LmlkKTtcblx0XHRcdFx0XHRpZiAoY2hhbm5lbCkge1xuXHRcdFx0XHRcdFx0YXdhaXQgZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRcdFx0XHRcdFx0cmVzb3VyY2U6IGNoYW5uZWwudXJpLFxuXHRcdFx0XHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRcdFx0cGlubmVkOiB0cnVlLFxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTG9nTGV2ZWxGaWx0ZXJBY3Rpb25zKCk6IHZvaWQge1xuXHRcdGxldCBvcmRlciA9IDA7XG5cdFx0Y29uc3QgcmVnaXN0ZXJMb2dMZXZlbCA9IChsb2dMZXZlbDogTG9nTGV2ZWwsIHRvZ2dsZWQ6IENvbnRleHRLZXlFeHByZXNzaW9uKSA9PiB7XG5cdFx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBWaWV3QWN0aW9uPE91dHB1dFZpZXdQYW5lPiB7XG5cdFx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRcdGlkOiBgd29ya2JlbmNoLmFjdGlvbnMuJHtPVVRQVVRfVklFV19JRH0udG9nZ2xlLiR7TG9nTGV2ZWxUb1N0cmluZyhsb2dMZXZlbCl9YCxcblx0XHRcdFx0XHRcdHRpdGxlOiBMb2dMZXZlbFRvTG9jYWxpemVkU3RyaW5nKGxvZ0xldmVsKS52YWx1ZSxcblx0XHRcdFx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZTIoJ3RvZ2dsZVRyYWNlRGVzY3JpcHRpb24nLCBcIlNob3cgb3IgaGlkZSB7MH0gbWVzc2FnZXMgaW4gdGhlIG91dHB1dFwiLCBMb2dMZXZlbFRvU3RyaW5nKGxvZ0xldmVsKSlcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR0b2dnbGVkLFxuXHRcdFx0XHRcdFx0bWVudToge1xuXHRcdFx0XHRcdFx0XHRpZDogdmlld0ZpbHRlclN1Ym1lbnUsXG5cdFx0XHRcdFx0XHRcdGdyb3VwOiAnMl9sb2dfZmlsdGVyJyxcblx0XHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIE9VVFBVVF9WSUVXX0lEKSwgQ09OVEVYVF9BQ1RJVkVfTE9HX0ZJTEVfT1VUUFVUKSxcblx0XHRcdFx0XHRcdFx0b3JkZXI6IG9yZGVyKytcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR2aWV3SWQ6IE9VVFBVVF9WSUVXX0lEXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YXN5bmMgcnVuSW5WaWV3KHNlcnZpY2VBY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgdmlldzogT3V0cHV0Vmlld1BhbmUpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0XHR0aGlzLnRvZ2dsZUxvZ0xldmVsRmlsdGVyKHNlcnZpY2VBY2Nlc3Nvci5nZXQoSU91dHB1dFNlcnZpY2UpLCBsb2dMZXZlbCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cHJpdmF0ZSB0b2dnbGVMb2dMZXZlbEZpbHRlcihvdXRwdXRTZXJ2aWNlOiBJT3V0cHV0U2VydmljZSwgbG9nTGV2ZWw6IExvZ0xldmVsKTogdm9pZCB7XG5cdFx0XHRcdFx0c3dpdGNoIChsb2dMZXZlbCkge1xuXHRcdFx0XHRcdFx0Y2FzZSBMb2dMZXZlbC5UcmFjZTpcblx0XHRcdFx0XHRcdFx0b3V0cHV0U2VydmljZS5maWx0ZXJzLnRyYWNlID0gIW91dHB1dFNlcnZpY2UuZmlsdGVycy50cmFjZTtcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRjYXNlIExvZ0xldmVsLkRlYnVnOlxuXHRcdFx0XHRcdFx0XHRvdXRwdXRTZXJ2aWNlLmZpbHRlcnMuZGVidWcgPSAhb3V0cHV0U2VydmljZS5maWx0ZXJzLmRlYnVnO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdGNhc2UgTG9nTGV2ZWwuSW5mbzpcblx0XHRcdFx0XHRcdFx0b3V0cHV0U2VydmljZS5maWx0ZXJzLmluZm8gPSAhb3V0cHV0U2VydmljZS5maWx0ZXJzLmluZm87XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0Y2FzZSBMb2dMZXZlbC5XYXJuaW5nOlxuXHRcdFx0XHRcdFx0XHRvdXRwdXRTZXJ2aWNlLmZpbHRlcnMud2FybmluZyA9ICFvdXRwdXRTZXJ2aWNlLmZpbHRlcnMud2FybmluZztcblx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRjYXNlIExvZ0xldmVsLkVycm9yOlxuXHRcdFx0XHRcdFx0XHRvdXRwdXRTZXJ2aWNlLmZpbHRlcnMuZXJyb3IgPSAhb3V0cHV0U2VydmljZS5maWx0ZXJzLmVycm9yO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9O1xuXG5cdFx0cmVnaXN0ZXJMb2dMZXZlbChMb2dMZXZlbC5UcmFjZSwgU0hPV19UUkFDRV9GSUxURVJfQ09OVEVYVCk7XG5cdFx0cmVnaXN0ZXJMb2dMZXZlbChMb2dMZXZlbC5EZWJ1ZywgU0hPV19ERUJVR19GSUxURVJfQ09OVEVYVCk7XG5cdFx0cmVnaXN0ZXJMb2dMZXZlbChMb2dMZXZlbC5JbmZvLCBTSE9XX0lORk9fRklMVEVSX0NPTlRFWFQpO1xuXHRcdHJlZ2lzdGVyTG9nTGV2ZWwoTG9nTGV2ZWwuV2FybmluZywgU0hPV19XQVJOSU5HX0ZJTFRFUl9DT05URVhUKTtcblx0XHRyZWdpc3RlckxvZ0xldmVsKExvZ0xldmVsLkVycm9yLCBTSE9XX0VSUk9SX0ZJTFRFUl9DT05URVhUKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJDbGVhckZpbHRlckFjdGlvbnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgVmlld0FjdGlvbjxPdXRwdXRWaWV3UGFuZT4ge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogYHdvcmtiZW5jaC5hY3Rpb25zLiR7T1VUUFVUX1ZJRVdfSUR9LmNsZWFyRmlsdGVyVGV4dGAsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdjbGVhckZpbHRlcnNUZXh0JywgXCJDbGVhciBmaWx0ZXJzIHRleHRcIiksXG5cdFx0XHRcdFx0a2V5YmluZGluZzoge1xuXHRcdFx0XHRcdFx0d2hlbjogT1VUUFVUX0ZJTFRFUl9GT0NVU19DT05URVhULFxuXHRcdFx0XHRcdFx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWIsXG5cdFx0XHRcdFx0XHRwcmltYXJ5OiBLZXlDb2RlLkVzY2FwZVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0dmlld0lkOiBPVVRQVVRfVklFV19JRFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGFzeW5jIHJ1bkluVmlldyhzZXJ2aWNlQWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIG91dHB1dFZpZXc6IE91dHB1dFZpZXdQYW5lKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdG91dHB1dFZpZXcuY2xlYXJGaWx0ZXJUZXh0KCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckV4cG9ydExvZ3NBY3Rpb24oKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBgd29ya2JlbmNoLmFjdGlvbi5leHBvcnRMb2dzYCxcblx0XHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignZXhwb3J0TG9ncycsIFwiRXhwb3J0IExvZ3MuLi5cIiksXG5cdFx0XHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuRGV2ZWxvcGVyLFxuXHRcdFx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscygndmlldycsIE9VVFBVVF9WSUVXX0lEKSxcblx0XHRcdFx0XHRcdGdyb3VwOiAnMV9leHBvcnQnLFxuXHRcdFx0XHRcdFx0b3JkZXI6IDIsXG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdGNvbnN0IG91dHB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU91dHB1dFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25Mb2dzOiBJT3V0cHV0Q2hhbm5lbERlc2NyaXB0b3JbXSA9IFtdLCBsb2dzOiBJT3V0cHV0Q2hhbm5lbERlc2NyaXB0b3JbXSA9IFtdLCB1c2VyTG9nczogSU91dHB1dENoYW5uZWxEZXNjcmlwdG9yW10gPSBbXTtcblx0XHRcdFx0Zm9yIChjb25zdCBjaGFubmVsIG9mIG91dHB1dFNlcnZpY2UuZ2V0Q2hhbm5lbERlc2NyaXB0b3JzKCkpIHtcblx0XHRcdFx0XHRpZiAoY2hhbm5lbC5sb2cpIHtcblx0XHRcdFx0XHRcdGlmIChjaGFubmVsLmV4dGVuc2lvbklkKSB7XG5cdFx0XHRcdFx0XHRcdGV4dGVuc2lvbkxvZ3MucHVzaChjaGFubmVsKTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoY2hhbm5lbC51c2VyKSB7XG5cdFx0XHRcdFx0XHRcdHVzZXJMb2dzLnB1c2goY2hhbm5lbCk7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHRsb2dzLnB1c2goY2hhbm5lbCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGVudHJpZXM6IEFycmF5PElPdXRwdXRDaGFubmVsRGVzY3JpcHRvciB8IElRdWlja1BpY2tTZXBhcmF0b3I+ID0gW107XG5cdFx0XHRcdGZvciAoY29uc3QgbG9nIG9mIGxvZ3Muc29ydCgoYSwgYikgPT4gYS5sYWJlbC5sb2NhbGVDb21wYXJlKGIubGFiZWwpKSkge1xuXHRcdFx0XHRcdGVudHJpZXMucHVzaChsb2cpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChleHRlbnNpb25Mb2dzLmxlbmd0aCAmJiBsb2dzLmxlbmd0aCkge1xuXHRcdFx0XHRcdGVudHJpZXMucHVzaCh7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogbmxzLmxvY2FsaXplKCdleHRlbnNpb25Mb2dzJywgXCJFeHRlbnNpb24gTG9nc1wiKSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRmb3IgKGNvbnN0IGxvZyBvZiBleHRlbnNpb25Mb2dzLnNvcnQoKGEsIGIpID0+IGEubGFiZWwubG9jYWxlQ29tcGFyZShiLmxhYmVsKSkpIHtcblx0XHRcdFx0XHRlbnRyaWVzLnB1c2gobG9nKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodXNlckxvZ3MubGVuZ3RoICYmIChleHRlbnNpb25Mb2dzLmxlbmd0aCB8fCBsb2dzLmxlbmd0aCkpIHtcblx0XHRcdFx0XHRlbnRyaWVzLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IG5scy5sb2NhbGl6ZSgndXNlckxvZ3MnLCBcIlVzZXIgTG9nc1wiKSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRmb3IgKGNvbnN0IGxvZyBvZiB1c2VyTG9ncy5zb3J0KChhLCBiKSA9PiBhLmxhYmVsLmxvY2FsZUNvbXBhcmUoYi5sYWJlbCkpKSB7XG5cdFx0XHRcdFx0ZW50cmllcy5wdXNoKGxvZyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgcXVpY2tJbnB1dFNlcnZpY2UucGljayhlbnRyaWVzLCB7IHBsYWNlSG9sZGVyOiBubHMubG9jYWxpemUoJ3NlbGVjdGxvZycsIFwiU2VsZWN0IExvZ1wiKSwgY2FuUGlja01hbnk6IHRydWUgfSk7XG5cdFx0XHRcdGlmIChyZXN1bHQ/Lmxlbmd0aCkge1xuXHRcdFx0XHRcdGF3YWl0IG91dHB1dFNlcnZpY2Uuc2F2ZU91dHB1dEFzKC4uLnJlc3VsdCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVySW1wb3J0TG9nQWN0aW9uKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogYHdvcmtiZW5jaC5hY3Rpb24uaW1wb3J0TG9nYCxcblx0XHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignaW1wb3J0TG9nJywgXCJJbXBvcnQgTG9nLi4uXCIpLFxuXHRcdFx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkRldmVsb3Blcixcblx0XHRcdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3VGl0bGUsXG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCBPVVRQVVRfVklFV19JRCksXG5cdFx0XHRcdFx0XHRncm91cDogJzJfYWRkJyxcblx0XHRcdFx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0XHRcdH1dLFxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRjb25zdCBvdXRwdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElPdXRwdXRTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgZmlsZURpYWxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUZpbGVEaWFsb2dTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgZmlsZURpYWxvZ1NlcnZpY2Uuc2hvd09wZW5EaWFsb2coe1xuXHRcdFx0XHRcdHRpdGxlOiBubHMubG9jYWxpemUoJ2ltcG9ydExvZ0ZpbGUnLCBcIkltcG9ydCBMb2cgRmlsZVwiKSxcblx0XHRcdFx0XHRjYW5TZWxlY3RGaWxlczogdHJ1ZSxcblx0XHRcdFx0XHRjYW5TZWxlY3RGb2xkZXJzOiBmYWxzZSxcblx0XHRcdFx0XHRjYW5TZWxlY3RNYW55OiB0cnVlLFxuXHRcdFx0XHRcdGZpbHRlcnM6IFt7XG5cdFx0XHRcdFx0XHRuYW1lOiBubHMubG9jYWxpemUoJ2xvZ0ZpbGVzJywgXCJMb2cgRmlsZXNcIiksXG5cdFx0XHRcdFx0XHRleHRlbnNpb25zOiBbJ2xvZyddXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0aWYgKHJlc3VsdD8ubGVuZ3RoKSB7XG5cdFx0XHRcdFx0Y29uc3QgY2hhbm5lbE5hbWUgPSBiYXNlbmFtZShyZXN1bHRbMF0pO1xuXHRcdFx0XHRcdGNvbnN0IGNoYW5uZWxJZCA9IGAke0lNUE9SVEVEX0xPR19JRF9QUkVGSVh9JHtEYXRlLm5vdygpfWA7XG5cdFx0XHRcdFx0Ly8gUmVnaXN0ZXIgYW5kIHNob3cgdGhlIGNoYW5uZWxcblx0XHRcdFx0XHRSZWdpc3RyeS5hczxJT3V0cHV0Q2hhbm5lbFJlZ2lzdHJ5PihFeHRlbnNpb25zLk91dHB1dENoYW5uZWxzKS5yZWdpc3RlckNoYW5uZWwoe1xuXHRcdFx0XHRcdFx0aWQ6IGNoYW5uZWxJZCxcblx0XHRcdFx0XHRcdGxhYmVsOiBjaGFubmVsTmFtZSxcblx0XHRcdFx0XHRcdGxvZzogdHJ1ZSxcblx0XHRcdFx0XHRcdHVzZXI6IHRydWUsXG5cdFx0XHRcdFx0XHRzb3VyY2U6IHJlc3VsdC5sZW5ndGggPT09IDFcblx0XHRcdFx0XHRcdFx0PyB7IHJlc291cmNlOiByZXN1bHRbMF0gfVxuXHRcdFx0XHRcdFx0XHQ6IHJlc3VsdC5tYXAocmVzb3VyY2UgPT4gKHsgcmVzb3VyY2UsIG5hbWU6IGJhc2VuYW1lKHJlc291cmNlKS5zcGxpdCgnLicpWzBdIH0pKVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdG91dHB1dFNlcnZpY2Uuc2hvd0NoYW5uZWwoY2hhbm5lbElkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxufVxuXG5SZWdpc3RyeS5hczxJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5PihXb3JrYmVuY2hFeHRlbnNpb25zLldvcmtiZW5jaCkucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24oT3V0cHV0Q29udHJpYnV0aW9uLCBMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCk7XG5cblJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pLnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdGlkOiAnb3V0cHV0Jyxcblx0b3JkZXI6IDMwLFxuXHR0aXRsZTogbmxzLmxvY2FsaXplKCdvdXRwdXQnLCBcIk91dHB1dFwiKSxcblx0dHlwZTogJ29iamVjdCcsXG5cdHByb3BlcnRpZXM6IHtcblx0XHQnb3V0cHV0LnNtYXJ0U2Nyb2xsLmVuYWJsZWQnOiB7XG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdvdXRwdXQuc21hcnRTY3JvbGwuZW5hYmxlZCcsIFwiRW5hYmxlL2Rpc2FibGUgdGhlIGFiaWxpdHkgb2Ygc21hcnQgc2Nyb2xsaW5nIGluIHRoZSBvdXRwdXQgdmlldy4gU21hcnQgc2Nyb2xsaW5nIGFsbG93cyB5b3UgdG8gbG9jayBzY3JvbGxpbmcgYXV0b21hdGljYWxseSB3aGVuIHlvdSBjbGljayBpbiB0aGUgb3V0cHV0IHZpZXcgYW5kIHVubG9ja3Mgd2hlbiB5b3UgY2xpY2sgaW4gdGhlIGxhc3QgbGluZS5cIiksXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5XSU5ET1csXG5cdFx0XHR0YWdzOiBbJ291dHB1dCddXG5cdFx0fVxuXHR9XG59KTtcblxuS2V5YmluZGluZ3NSZWdpc3RyeS5yZWdpc3RlcktleWJpbmRpbmdSdWxlKHtcblx0aWQ6ICdjdXJzb3JXb3JkQWNjZXNzaWJpbGl0eUxlZnQnLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsIENPTlRFWFRfQUNDRVNTSUJJTElUWV9NT0RFX0VOQUJMRUQsIElzV2luZG93c0NvbnRleHQsIENvbnRleHRLZXlFeHByLmVxdWFscyhGb2N1c2VkVmlld0NvbnRleHQua2V5LCBPVVRQVVRfVklFV19JRCkpLFxuXHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuTGVmdEFycm93LFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYlxufSk7XG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogJ2N1cnNvcldvcmRBY2Nlc3NpYmlsaXR5TGVmdFNlbGVjdCcsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChFZGl0b3JDb250ZXh0S2V5cy50ZXh0SW5wdXRGb2N1cywgQ09OVEVYVF9BQ0NFU1NJQklMSVRZX01PREVfRU5BQkxFRCwgSXNXaW5kb3dzQ29udGV4dCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKEZvY3VzZWRWaWV3Q29udGV4dC5rZXksIE9VVFBVVF9WSUVXX0lEKSksXG5cdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5MZWZ0QXJyb3csXG5cdHdlaWdodDogS2V5YmluZGluZ1dlaWdodC5Xb3JrYmVuY2hDb250cmliXG59KTtcbktleWJpbmRpbmdzUmVnaXN0cnkucmVnaXN0ZXJLZXliaW5kaW5nUnVsZSh7XG5cdGlkOiAnY3Vyc29yV29yZEFjY2Vzc2liaWxpdHlSaWdodCcsXG5cdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChFZGl0b3JDb250ZXh0S2V5cy50ZXh0SW5wdXRGb2N1cywgQ09OVEVYVF9BQ0NFU1NJQklMSVRZX01PREVfRU5BQkxFRCwgSXNXaW5kb3dzQ29udGV4dCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKEZvY3VzZWRWaWV3Q29udGV4dC5rZXksIE9VVFBVVF9WSUVXX0lEKSksXG5cdHByaW1hcnk6IEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5SaWdodEFycm93LFxuXHR3ZWlnaHQ6IEtleWJpbmRpbmdXZWlnaHQuV29ya2JlbmNoQ29udHJpYlxufSk7XG5LZXliaW5kaW5nc1JlZ2lzdHJ5LnJlZ2lzdGVyS2V5YmluZGluZ1J1bGUoe1xuXHRpZDogJ2N1cnNvcldvcmRBY2Nlc3NpYmlsaXR5UmlnaHRTZWxlY3QnLFxuXHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoRWRpdG9yQ29udGV4dEtleXMudGV4dElucHV0Rm9jdXMsIENPTlRFWFRfQUNDRVNTSUJJTElUWV9NT0RFX0VOQUJMRUQsIElzV2luZG93c0NvbnRleHQsIENvbnRleHRLZXlFeHByLmVxdWFscyhGb2N1c2VkVmlld0NvbnRleHQua2V5LCBPVVRQVVRfVklFV19JRCkpLFxuXHRwcmltYXJ5OiBLZXlNb2QuQ3RybENtZCB8IEtleU1vZC5TaGlmdCB8IEtleUNvZGUuUmlnaHRBcnJvdyxcblx0d2VpZ2h0OiBLZXliaW5kaW5nV2VpZ2h0LldvcmtiZW5jaENvbnRyaWJcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyxRQUFRLFVBQVUsZUFBZTtBQUMxQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFFBQVEsaUJBQWlCLFNBQVMsb0JBQW9CO0FBQy9ELFNBQVMsbUJBQW1CLHlCQUF5QjtBQUNy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
