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
import * as dom from "../../../../../base/browser/dom.js";
import { Separator } from "../../../../../base/common/actions.js";
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableMap, DisposableStore, dispose, toDisposable } from "../../../../../base/common/lifecycle.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize } from "../../../../../nls.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IContextMenuService } from "../../../../../platform/contextview/browser/contextView.js";
import { INotificationService, Severity } from "../../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { CommandInvalidationReason, TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { terminalDecorationError, terminalDecorationIncomplete, terminalDecorationMark, terminalDecorationSuccess } from "../terminalIcons.js";
import { DecorationSelector, getTerminalDecorationHoverContent, updateLayout } from "./decorationStyles.js";
import { TERMINAL_COMMAND_DECORATION_DEFAULT_BACKGROUND_COLOR, TERMINAL_COMMAND_DECORATION_ERROR_BACKGROUND_COLOR, TERMINAL_COMMAND_DECORATION_SUCCESS_BACKGROUND_COLOR } from "../../common/terminalColorRegistry.js";
import { ILifecycleService } from "../../../../services/lifecycle/common/lifecycle.js";
import { IHoverService } from "../../../../../platform/hover/browser/hover.js";
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
let DecorationAddon = class extends Disposable {
  constructor(_capabilities, _clipboardService, _contextMenuService, _configurationService, _themeService, _openerService, _quickInputService, lifecycleService, _commandService, _accessibilitySignalService, _notificationService, _hoverService) {
    super();
    this._capabilities = _capabilities;
    this._clipboardService = _clipboardService;
    this._contextMenuService = _contextMenuService;
    this._configurationService = _configurationService;
    this._themeService = _themeService;
    this._openerService = _openerService;
    this._quickInputService = _quickInputService;
    this._commandService = _commandService;
    this._accessibilitySignalService = _accessibilitySignalService;
    this._notificationService = _notificationService;
    this._hoverService = _hoverService;
    this._capabilityDisposables = this._register(new DisposableMap());
    this._decorations = /* @__PURE__ */ new Map();
    this._registeredMenuItems = /* @__PURE__ */ new Map();
    this._onDidRequestRunCommand = this._register(new Emitter());
    this.onDidRequestRunCommand = this._onDidRequestRunCommand.event;
    this._onDidRequestCopyAsHtml = this._register(new Emitter());
    this.onDidRequestCopyAsHtml = this._onDidRequestCopyAsHtml.event;
    this._register(toDisposable(() => this._dispose()));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(TerminalSettingId.FontSize) || e.affectsConfiguration(TerminalSettingId.LineHeight)) {
        this.refreshLayouts();
      } else if (e.affectsConfiguration("workbench.colorCustomizations")) {
        this._refreshStyles(true);
      } else if (e.affectsConfiguration(TerminalSettingId.ShellIntegrationDecorationsEnabled)) {
        this._removeCapabilityDisposables(TerminalCapability.CommandDetection);
        this._updateDecorationVisibility();
      }
    }));
    this._register(this._themeService.onDidColorThemeChange(() => this._refreshStyles(true)));
    this._updateDecorationVisibility();
    this._register(this._capabilities.onDidAddCapabilityType((c) => this._createCapabilityDisposables(c)));
    this._register(this._capabilities.onDidRemoveCapabilityType((c) => this._removeCapabilityDisposables(c)));
    this._register(lifecycleService.onWillShutdown(() => this._disposeAllDecorations()));
  }
  _createCapabilityDisposables(c) {
    const store = new DisposableStore();
    const capability = this._capabilities.get(c);
    if (!capability || this._capabilityDisposables.has(c)) {
      return;
    }
    switch (capability.type) {
      case TerminalCapability.BufferMarkDetection:
        store.add(capability.onMarkAdded((mark) => this.registerMarkDecoration(mark)));
        break;
      case TerminalCapability.CommandDetection: {
        const disposables = this._getCommandDetectionListeners(capability);
        for (const d of disposables) {
          store.add(d);
        }
        break;
      }
    }
    this._capabilityDisposables.set(c, store);
  }
  _removeCapabilityDisposables(c) {
    this._capabilityDisposables.deleteAndDispose(c);
  }
  registerMarkDecoration(mark) {
    if (!this._terminal || !this._showGutterDecorations && !this._showOverviewRulerDecorations) {
      return void 0;
    }
    if (mark.hidden) {
      return void 0;
    }
    return this.registerCommandDecoration(void 0, void 0, mark);
  }
  _updateDecorationVisibility() {
    const showDecorations = this._configurationService.getValue(TerminalSettingId.ShellIntegrationDecorationsEnabled);
    this._showGutterDecorations = showDecorations === "both" || showDecorations === "gutter";
    this._showOverviewRulerDecorations = showDecorations === "both" || showDecorations === "overviewRuler";
    this._disposeAllDecorations();
    if (this._showGutterDecorations || this._showOverviewRulerDecorations) {
      this._attachToCommandCapability();
      this._updateGutterDecorationVisibility();
    }
    const currentCommand = this._capabilities.get(TerminalCapability.CommandDetection)?.executingCommandObject;
    if (currentCommand) {
      this.registerCommandDecoration(currentCommand, true);
    }
  }
  _disposeAllDecorations() {
    this._placeholderDecoration?.dispose();
    for (const value of this._decorations.values()) {
      value.decoration.dispose();
      dispose(value.disposables);
    }
  }
  _updateGutterDecorationVisibility() {
    const commandDecorationElements = this._terminal?.element?.querySelectorAll(DecorationSelector.CommandDecoration);
    if (commandDecorationElements) {
      for (const commandDecorationElement of commandDecorationElements) {
        this._updateCommandDecorationVisibility(commandDecorationElement);
      }
    }
  }
  _updateCommandDecorationVisibility(commandDecorationElement) {
    if (this._showGutterDecorations) {
      commandDecorationElement.classList.remove(DecorationSelector.Hide);
    } else {
      commandDecorationElement.classList.add(DecorationSelector.Hide);
    }
  }
  refreshLayouts() {
    updateLayout(this._configurationService, this._placeholderDecoration?.element);
    for (const decoration of this._decorations) {
      updateLayout(this._configurationService, decoration[1].decoration.element);
    }
  }
  _refreshStyles(refreshOverviewRulerColors) {
    if (refreshOverviewRulerColors) {
      for (const decoration of this._decorations.values()) {
        const color = this._getDecorationCssColor(decoration)?.toString() ?? "";
        if (decoration.decoration.options?.overviewRulerOptions) {
          decoration.decoration.options.overviewRulerOptions.color = color;
        } else if (decoration.decoration.options) {
          decoration.decoration.options.overviewRulerOptions = { color };
        }
      }
    }
    this._updateClasses(this._placeholderDecoration?.element);
    for (const decoration of this._decorations.values()) {
      this._updateClasses(decoration.decoration.element, decoration.exitCode, decoration.markProperties);
    }
  }
  _dispose() {
    for (const disposable of this._capabilityDisposables.values()) {
      dispose(disposable);
    }
    this.clearDecorations();
  }
  _clearPlaceholder() {
    this._placeholderDecoration?.dispose();
    this._placeholderDecoration = void 0;
  }
  clearDecorations() {
    this._placeholderDecoration?.marker.dispose();
    this._clearPlaceholder();
    this._disposeAllDecorations();
    this._decorations.clear();
  }
  _attachToCommandCapability() {
    if (this._capabilities.has(TerminalCapability.CommandDetection)) {
      const capability = this._capabilities.get(TerminalCapability.CommandDetection);
      const disposables = this._getCommandDetectionListeners(capability);
      const store = new DisposableStore();
      for (const d of disposables) {
        store.add(d);
      }
      this._capabilityDisposables.set(TerminalCapability.CommandDetection, store);
    }
  }
  _getCommandDetectionListeners(capability) {
    this._removeCapabilityDisposables(TerminalCapability.CommandDetection);
    const commandDetectionListeners = [];
    if (capability.executingCommandObject?.marker) {
      this.registerCommandDecoration(capability.executingCommandObject, true);
    }
    commandDetectionListeners.push(capability.onCommandStarted((command) => this.registerCommandDecoration(command, true)));
    for (const command of capability.commands) {
      this.registerCommandDecoration(command);
    }
    commandDetectionListeners.push(capability.onCommandFinished((command) => {
      this.registerCommandDecoration(command);
      if (command.exitCode) {
        this._accessibilitySignalService.playSignal(AccessibilitySignal.terminalCommandFailed);
      } else {
        this._accessibilitySignalService.playSignal(AccessibilitySignal.terminalCommandSucceeded);
      }
    }));
    commandDetectionListeners.push(capability.onCommandInvalidated((commands) => {
      for (const command of commands) {
        const id = command.marker?.id;
        if (id) {
          const match = this._decorations.get(id);
          if (match) {
            match.decoration.dispose();
            dispose(match.disposables);
          }
        }
      }
    }));
    commandDetectionListeners.push(capability.onCurrentCommandInvalidated((request) => {
      if (request.reason === CommandInvalidationReason.NoProblemsReported) {
        const lastDecoration = Array.from(this._decorations.entries())[this._decorations.size - 1];
        lastDecoration?.[1].decoration.dispose();
      } else if (request.reason === CommandInvalidationReason.Windows) {
        this._clearPlaceholder();
      }
    }));
    return commandDetectionListeners;
  }
  activate(terminal) {
    this._terminal = terminal;
    this._attachToCommandCapability();
  }
  registerCommandDecoration(command, beforeCommandExecution, markProperties) {
    if (!this._terminal || beforeCommandExecution && !command || !this._showGutterDecorations && !this._showOverviewRulerDecorations) {
      return void 0;
    }
    const marker = command?.marker || markProperties?.marker;
    if (!marker) {
      throw new Error(`cannot add a decoration for a command ${JSON.stringify(command)} with no marker`);
    }
    this._clearPlaceholder();
    const color = this._getDecorationCssColor(command)?.toString() ?? "";
    const decoration = this._terminal.registerDecoration({
      marker,
      overviewRulerOptions: this._showOverviewRulerDecorations ? beforeCommandExecution ? { color, position: "left" } : { color, position: command?.exitCode ? "right" : "left" } : void 0
    });
    if (!decoration) {
      return void 0;
    }
    if (beforeCommandExecution) {
      this._placeholderDecoration = decoration;
    }
    decoration.onRender((element) => {
      if (element.classList.contains(DecorationSelector.OverviewRuler)) {
        return;
      }
      if (!this._decorations.get(decoration.marker.id)) {
        decoration.onDispose(() => this._decorations.delete(decoration.marker.id));
        this._decorations.set(
          decoration.marker.id,
          {
            decoration,
            disposables: this._createDisposables(element, command, markProperties),
            exitCode: command?.exitCode,
            markProperties: command?.markProperties
          }
        );
      }
      if (!element.classList.contains(DecorationSelector.Codicon) || command?.marker?.line === 0) {
        updateLayout(this._configurationService, element);
        this._updateClasses(element, command?.exitCode, command?.markProperties || markProperties);
      }
    });
    return decoration;
  }
  registerMenuItems(command, items) {
    const existingItems = this._registeredMenuItems.get(command);
    if (existingItems) {
      existingItems.push(...items);
    } else {
      this._registeredMenuItems.set(command, [...items]);
    }
    return toDisposable(() => {
      const commandItems = this._registeredMenuItems.get(command);
      if (commandItems) {
        for (const item of items.values()) {
          const index = commandItems.indexOf(item);
          if (index !== -1) {
            commandItems.splice(index, 1);
          }
        }
      }
    });
  }
  _createDisposables(element, command, markProperties) {
    if (command?.exitCode === void 0 && !command?.markProperties) {
      return [];
    } else if (command?.markProperties || markProperties) {
      return [this._createHover(element, command || markProperties, markProperties?.hoverMessage)];
    }
    return [...this._createContextMenu(element, command), this._createHover(element, command)];
  }
  _createHover(element, command, hoverMessage) {
    return this._hoverService.setupDelayedHover(element, () => ({
      content: new MarkdownString(getTerminalDecorationHoverContent(command, hoverMessage))
    }));
  }
  _updateClasses(element, exitCode, markProperties) {
    if (!element) {
      return;
    }
    for (const classes of element.classList) {
      element.classList.remove(classes);
    }
    element.classList.add(DecorationSelector.CommandDecoration, DecorationSelector.Codicon, DecorationSelector.XtermDecoration);
    if (markProperties) {
      element.classList.add(DecorationSelector.DefaultColor, ...ThemeIcon.asClassNameArray(terminalDecorationMark));
      if (!markProperties.hoverMessage) {
        element.classList.add(DecorationSelector.Default);
      }
    } else {
      this._updateCommandDecorationVisibility(element);
      if (exitCode === void 0) {
        element.classList.add(DecorationSelector.DefaultColor, DecorationSelector.Default);
        element.classList.add(...ThemeIcon.asClassNameArray(terminalDecorationIncomplete));
      } else if (exitCode) {
        element.classList.add(DecorationSelector.ErrorColor);
        element.classList.add(...ThemeIcon.asClassNameArray(terminalDecorationError));
      } else {
        element.classList.add(...ThemeIcon.asClassNameArray(terminalDecorationSuccess));
      }
    }
  }
  _createContextMenu(element, command) {
    return [
      dom.addDisposableListener(element, dom.EventType.MOUSE_DOWN, async (e) => {
        e.stopImmediatePropagation();
      }),
      dom.addDisposableListener(element, dom.EventType.CLICK, async (e) => {
        e.stopImmediatePropagation();
        const actions = await this._getCommandActions(command);
        this._contextMenuService.showContextMenu({ getAnchor: () => element, getActions: () => actions });
      }),
      dom.addDisposableListener(element, dom.EventType.CONTEXT_MENU, async (e) => {
        e.stopImmediatePropagation();
        const actions = this._getContextMenuActions();
        this._contextMenuService.showContextMenu({ getAnchor: () => element, getActions: () => actions });
      })
    ];
  }
  _getContextMenuActions() {
    const label = localize("workbench.action.terminal.toggleVisibility", "Toggle Visibility");
    return [
      {
        class: void 0,
        tooltip: label,
        id: "terminal.toggleVisibility",
        label,
        enabled: true,
        run: async () => {
          this._showToggleVisibilityQuickPick();
        }
      }
    ];
  }
  async _getCommandActions(command) {
    const actions = [];
    const registeredMenuItems = this._registeredMenuItems.get(command);
    if (registeredMenuItems?.length) {
      actions.push(...registeredMenuItems, new Separator());
    }
    if (command.command !== "") {
      const labelRun = localize("terminal.rerunCommand", "Rerun Command");
      actions.push({
        class: void 0,
        tooltip: labelRun,
        id: "terminal.rerunCommand",
        label: labelRun,
        enabled: true,
        run: async () => {
          if (command.command === "") {
            return;
          }
          if (!command.isTrusted) {
            const shouldRun = await new Promise((r) => {
              this._notificationService.prompt(Severity.Info, localize("rerun", "Do you want to run the command: {0}", command.command), [{
                label: localize("yes", "Yes"),
                run: () => r(true)
              }, {
                label: localize("no", "No"),
                run: () => r(false)
              }]);
            });
            if (!shouldRun) {
              return;
            }
          }
          this._onDidRequestRunCommand.fire({ command });
        }
      });
      actions.push(new Separator());
      const labelCopy = localize("terminal.copyCommand", "Copy Command");
      actions.push({
        class: void 0,
        tooltip: labelCopy,
        id: "terminal.copyCommand",
        label: labelCopy,
        enabled: true,
        run: () => this._clipboardService.writeText(command.command)
      });
    }
    if (command.hasOutput()) {
      const labelCopyCommandAndOutput = localize("terminal.copyCommandAndOutput", "Copy Command and Output");
      actions.push({
        class: void 0,
        tooltip: labelCopyCommandAndOutput,
        id: "terminal.copyCommandAndOutput",
        label: labelCopyCommandAndOutput,
        enabled: true,
        run: () => {
          const output = command.getOutput();
          if (typeof output === "string") {
            this._clipboardService.writeText(`${command.command !== "" ? command.command + "\n" : ""}${output}`);
          }
        }
      });
      const labelText = localize("terminal.copyOutput", "Copy Output");
      actions.push({
        class: void 0,
        tooltip: labelText,
        id: "terminal.copyOutput",
        label: labelText,
        enabled: true,
        run: () => {
          const text = command.getOutput();
          if (typeof text === "string") {
            this._clipboardService.writeText(text);
          }
        }
      });
      const labelHtml = localize("terminal.copyOutputAsHtml", "Copy Output as HTML");
      actions.push({
        class: void 0,
        tooltip: labelHtml,
        id: "terminal.copyOutputAsHtml",
        label: labelHtml,
        enabled: true,
        run: () => this._onDidRequestCopyAsHtml.fire({ command })
      });
    }
    if (actions.length > 0) {
      actions.push(new Separator());
    }
    const labelRunRecent = localize("workbench.action.terminal.runRecentCommand", "Run Recent Command");
    actions.push({
      class: void 0,
      tooltip: labelRunRecent,
      id: "workbench.action.terminal.runRecentCommand",
      label: labelRunRecent,
      enabled: true,
      run: () => this._commandService.executeCommand("workbench.action.terminal.runRecentCommand")
    });
    const labelGoToRecent = localize("workbench.action.terminal.goToRecentDirectory", "Go To Recent Directory");
    actions.push({
      class: void 0,
      tooltip: labelRunRecent,
      id: "workbench.action.terminal.goToRecentDirectory",
      label: labelGoToRecent,
      enabled: true,
      run: () => this._commandService.executeCommand("workbench.action.terminal.goToRecentDirectory")
    });
    actions.push(new Separator());
    const labelAbout = localize("terminal.learnShellIntegration", "Learn About Shell Integration");
    actions.push({
      class: void 0,
      tooltip: labelAbout,
      id: "terminal.learnShellIntegration",
      label: labelAbout,
      enabled: true,
      run: () => this._openerService.open("https://code.visualstudio.com/docs/terminal/shell-integration")
    });
    return actions;
  }
  _showToggleVisibilityQuickPick() {
    const quickPick = this._register(this._quickInputService.createQuickPick());
    quickPick.hideInput = true;
    quickPick.hideCheckAll = true;
    quickPick.canSelectMany = true;
    quickPick.title = localize("toggleVisibility", "Toggle visibility");
    const configValue = this._configurationService.getValue(TerminalSettingId.ShellIntegrationDecorationsEnabled);
    const gutterIcon = {
      label: localize("gutter", "Gutter command decorations"),
      picked: configValue !== "never" && configValue !== "overviewRuler"
    };
    const overviewRulerIcon = {
      label: localize("overviewRuler", "Overview ruler command decorations"),
      picked: configValue !== "never" && configValue !== "gutter"
    };
    quickPick.items = [gutterIcon, overviewRulerIcon];
    const selectedItems = [];
    if (configValue !== "never") {
      if (configValue !== "gutter") {
        selectedItems.push(gutterIcon);
      }
      if (configValue !== "overviewRuler") {
        selectedItems.push(overviewRulerIcon);
      }
    }
    quickPick.selectedItems = selectedItems;
    this._register(quickPick.onDidChangeSelection(async (e) => {
      let newValue = "never";
      if (e.includes(gutterIcon)) {
        if (e.includes(overviewRulerIcon)) {
          newValue = "both";
        } else {
          newValue = "gutter";
        }
      } else if (e.includes(overviewRulerIcon)) {
        newValue = "overviewRuler";
      }
      await this._configurationService.updateValue(TerminalSettingId.ShellIntegrationDecorationsEnabled, newValue);
    }));
    quickPick.ok = false;
    quickPick.show();
  }
  _getDecorationCssColor(decorationOrCommand) {
    let colorId;
    if (decorationOrCommand?.exitCode === void 0) {
      colorId = TERMINAL_COMMAND_DECORATION_DEFAULT_BACKGROUND_COLOR;
    } else {
      colorId = decorationOrCommand.exitCode ? TERMINAL_COMMAND_DECORATION_ERROR_BACKGROUND_COLOR : TERMINAL_COMMAND_DECORATION_SUCCESS_BACKGROUND_COLOR;
    }
    return this._themeService.getColorTheme().getColor(colorId)?.toString();
  }
};
DecorationAddon = __decorateClass([
  __decorateParam(1, IClipboardService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IThemeService),
  __decorateParam(5, IOpenerService),
  __decorateParam(6, IQuickInputService),
  __decorateParam(7, ILifecycleService),
  __decorateParam(8, ICommandService),
  __decorateParam(9, IAccessibilitySignalService),
  __decorateParam(10, INotificationService),
  __decorateParam(11, IHoverService)
], DecorationAddon);
export {
  DecorationAddon
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3h0ZXJtL2RlY29yYXRpb25BZGRvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB0eXBlIHsgSURlY29yYXRpb24sIElUZXJtaW5hbEFkZG9uLCBUZXJtaW5hbCB9IGZyb20gJ0B4dGVybS94dGVybSc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uLCBTZXBhcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlTWFwLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCBkaXNwb3NlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlTaWduYWwsIElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHlTaWduYWwvYnJvd3Nlci9hY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ2xpcGJvYXJkU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NsaXBib2FyZC9jb21tb24vY2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrUGlja0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IENvbW1hbmRJbnZhbGlkYXRpb25SZWFzb24sIElDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSwgSU1hcmtQcm9wZXJ0aWVzLCBJVGVybWluYWxDYXBhYmlsaXR5U3RvcmUsIElUZXJtaW5hbENvbW1hbmQsIFRlcm1pbmFsQ2FwYWJpbGl0eSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9jYXBhYmlsaXRpZXMvY2FwYWJpbGl0aWVzLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsU2V0dGluZ0lkLCB0eXBlIElEZWNvcmF0aW9uQWRkb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgdGVybWluYWxEZWNvcmF0aW9uRXJyb3IsIHRlcm1pbmFsRGVjb3JhdGlvbkluY29tcGxldGUsIHRlcm1pbmFsRGVjb3JhdGlvbk1hcmssIHRlcm1pbmFsRGVjb3JhdGlvblN1Y2Nlc3MgfSBmcm9tICcuLi90ZXJtaW5hbEljb25zLmpzJztcbmltcG9ydCB7IERlY29yYXRpb25TZWxlY3RvciwgZ2V0VGVybWluYWxEZWNvcmF0aW9uSG92ZXJDb250ZW50LCB1cGRhdGVMYXlvdXQgfSBmcm9tICcuL2RlY29yYXRpb25TdHlsZXMuanMnO1xuaW1wb3J0IHsgVEVSTUlOQUxfQ09NTUFORF9ERUNPUkFUSU9OX0RFRkFVTFRfQkFDS0dST1VORF9DT0xPUiwgVEVSTUlOQUxfQ09NTUFORF9ERUNPUkFUSU9OX0VSUk9SX0JBQ0tHUk9VTkRfQ09MT1IsIFRFUk1JTkFMX0NPTU1BTkRfREVDT1JBVElPTl9TVUNDRVNTX0JBQ0tHUk9VTkRfQ09MT1IgfSBmcm9tICcuLi8uLi9jb21tb24vdGVybWluYWxDb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElMaWZlY3ljbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5cbmludGVyZmFjZSBJRGlzcG9zYWJsZURlY29yYXRpb24geyBkZWNvcmF0aW9uOiBJRGVjb3JhdGlvbjsgZGlzcG9zYWJsZXM6IElEaXNwb3NhYmxlW107IGV4aXRDb2RlPzogbnVtYmVyOyBtYXJrUHJvcGVydGllcz86IElNYXJrUHJvcGVydGllcyB9XG5cbmV4cG9ydCBjbGFzcyBEZWNvcmF0aW9uQWRkb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVRlcm1pbmFsQWRkb24sIElEZWNvcmF0aW9uQWRkb24ge1xuXHRwcm90ZWN0ZWQgX3Rlcm1pbmFsOiBUZXJtaW5hbCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfY2FwYWJpbGl0eURpc3Bvc2FibGVzOiBEaXNwb3NhYmxlTWFwPFRlcm1pbmFsQ2FwYWJpbGl0eT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZU1hcCgpKTtcblx0cHJpdmF0ZSBfZGVjb3JhdGlvbnM6IE1hcDxudW1iZXIsIElEaXNwb3NhYmxlRGVjb3JhdGlvbj4gPSBuZXcgTWFwKCk7XG5cdHByaXZhdGUgX3BsYWNlaG9sZGVyRGVjb3JhdGlvbjogSURlY29yYXRpb24gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3Nob3dHdXR0ZXJEZWNvcmF0aW9ucz86IGJvb2xlYW47XG5cdHByaXZhdGUgX3Nob3dPdmVydmlld1J1bGVyRGVjb3JhdGlvbnM/OiBib29sZWFuO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9yZWdpc3RlcmVkTWVudUl0ZW1zOiBNYXA8SVRlcm1pbmFsQ29tbWFuZCwgSUFjdGlvbltdPiA9IG5ldyBNYXAoKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFJlcXVlc3RSdW5Db21tYW5kID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyBjb21tYW5kOiBJVGVybWluYWxDb21tYW5kOyBub05ld0xpbmU/OiBib29sZWFuIH0+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlcXVlc3RSdW5Db21tYW5kID0gdGhpcy5fb25EaWRSZXF1ZXN0UnVuQ29tbWFuZC5ldmVudDtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZXF1ZXN0Q29weUFzSHRtbCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHsgY29tbWFuZDogSVRlcm1pbmFsQ29tbWFuZCB9PigpKTtcblx0cmVhZG9ubHkgb25EaWRSZXF1ZXN0Q29weUFzSHRtbCA9IHRoaXMuX29uRGlkUmVxdWVzdENvcHlBc0h0bWwuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY2FwYWJpbGl0aWVzOiBJVGVybWluYWxDYXBhYmlsaXR5U3RvcmUsXG5cdFx0QElDbGlwYm9hcmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NsaXBib2FyZFNlcnZpY2U6IElDbGlwYm9hcmRTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbnRleHRNZW51U2VydmljZTogSUNvbnRleHRNZW51U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElUaGVtZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGhlbWVTZXJ2aWNlOiBJVGhlbWVTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9vcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3F1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVTZXJ2aWNlIGxpZmVjeWNsZVNlcnZpY2U6IElMaWZlY3ljbGVTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlOiBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2hvdmVyU2VydmljZTogSUhvdmVyU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLl9kaXNwb3NlKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihUZXJtaW5hbFNldHRpbmdJZC5Gb250U2l6ZSkgfHwgZS5hZmZlY3RzQ29uZmlndXJhdGlvbihUZXJtaW5hbFNldHRpbmdJZC5MaW5lSGVpZ2h0KSkge1xuXHRcdFx0XHR0aGlzLnJlZnJlc2hMYXlvdXRzKCk7XG5cdFx0XHR9IGVsc2UgaWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3dvcmtiZW5jaC5jb2xvckN1c3RvbWl6YXRpb25zJykpIHtcblx0XHRcdFx0dGhpcy5fcmVmcmVzaFN0eWxlcyh0cnVlKTtcblx0XHRcdH0gZWxzZSBpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihUZXJtaW5hbFNldHRpbmdJZC5TaGVsbEludGVncmF0aW9uRGVjb3JhdGlvbnNFbmFibGVkKSkge1xuXHRcdFx0XHR0aGlzLl9yZW1vdmVDYXBhYmlsaXR5RGlzcG9zYWJsZXMoVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pO1xuXHRcdFx0XHR0aGlzLl91cGRhdGVEZWNvcmF0aW9uVmlzaWJpbGl0eSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90aGVtZVNlcnZpY2Uub25EaWRDb2xvclRoZW1lQ2hhbmdlKCgpID0+IHRoaXMuX3JlZnJlc2hTdHlsZXModHJ1ZSkpKTtcblx0XHR0aGlzLl91cGRhdGVEZWNvcmF0aW9uVmlzaWJpbGl0eSgpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NhcGFiaWxpdGllcy5vbkRpZEFkZENhcGFiaWxpdHlUeXBlKGMgPT4gdGhpcy5fY3JlYXRlQ2FwYWJpbGl0eURpc3Bvc2FibGVzKGMpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY2FwYWJpbGl0aWVzLm9uRGlkUmVtb3ZlQ2FwYWJpbGl0eVR5cGUoYyA9PiB0aGlzLl9yZW1vdmVDYXBhYmlsaXR5RGlzcG9zYWJsZXMoYykpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihsaWZlY3ljbGVTZXJ2aWNlLm9uV2lsbFNodXRkb3duKCgpID0+IHRoaXMuX2Rpc3Bvc2VBbGxEZWNvcmF0aW9ucygpKSk7XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVDYXBhYmlsaXR5RGlzcG9zYWJsZXMoYzogVGVybWluYWxDYXBhYmlsaXR5KTogdm9pZCB7XG5cdFx0Y29uc3Qgc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgY2FwYWJpbGl0eSA9IHRoaXMuX2NhcGFiaWxpdGllcy5nZXQoYyk7XG5cdFx0aWYgKCFjYXBhYmlsaXR5IHx8IHRoaXMuX2NhcGFiaWxpdHlEaXNwb3NhYmxlcy5oYXMoYykpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0c3dpdGNoIChjYXBhYmlsaXR5LnR5cGUpIHtcblx0XHRcdGNhc2UgVGVybWluYWxDYXBhYmlsaXR5LkJ1ZmZlck1hcmtEZXRlY3Rpb246XG5cdFx0XHRcdHN0b3JlLmFkZChjYXBhYmlsaXR5Lm9uTWFya0FkZGVkKG1hcmsgPT4gdGhpcy5yZWdpc3Rlck1hcmtEZWNvcmF0aW9uKG1hcmspKSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbjoge1xuXHRcdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IHRoaXMuX2dldENvbW1hbmREZXRlY3Rpb25MaXN0ZW5lcnMoY2FwYWJpbGl0eSk7XG5cdFx0XHRcdGZvciAoY29uc3QgZCBvZiBkaXNwb3NhYmxlcykge1xuXHRcdFx0XHRcdHN0b3JlLmFkZChkKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fY2FwYWJpbGl0eURpc3Bvc2FibGVzLnNldChjLCBzdG9yZSk7XG5cdH1cblxuXHRwcml2YXRlIF9yZW1vdmVDYXBhYmlsaXR5RGlzcG9zYWJsZXMoYzogVGVybWluYWxDYXBhYmlsaXR5KTogdm9pZCB7XG5cdFx0dGhpcy5fY2FwYWJpbGl0eURpc3Bvc2FibGVzLmRlbGV0ZUFuZERpc3Bvc2UoYyk7XG5cdH1cblxuXHRyZWdpc3Rlck1hcmtEZWNvcmF0aW9uKG1hcms6IElNYXJrUHJvcGVydGllcyk6IElEZWNvcmF0aW9uIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMuX3Rlcm1pbmFsIHx8ICghdGhpcy5fc2hvd0d1dHRlckRlY29yYXRpb25zICYmICF0aGlzLl9zaG93T3ZlcnZpZXdSdWxlckRlY29yYXRpb25zKSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKG1hcmsuaGlkZGVuKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5yZWdpc3RlckNvbW1hbmREZWNvcmF0aW9uKHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBtYXJrKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZURlY29yYXRpb25WaXNpYmlsaXR5KCk6IHZvaWQge1xuXHRcdGNvbnN0IHNob3dEZWNvcmF0aW9ucyA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKFRlcm1pbmFsU2V0dGluZ0lkLlNoZWxsSW50ZWdyYXRpb25EZWNvcmF0aW9uc0VuYWJsZWQpO1xuXHRcdHRoaXMuX3Nob3dHdXR0ZXJEZWNvcmF0aW9ucyA9IChzaG93RGVjb3JhdGlvbnMgPT09ICdib3RoJyB8fCBzaG93RGVjb3JhdGlvbnMgPT09ICdndXR0ZXInKTtcblx0XHR0aGlzLl9zaG93T3ZlcnZpZXdSdWxlckRlY29yYXRpb25zID0gKHNob3dEZWNvcmF0aW9ucyA9PT0gJ2JvdGgnIHx8IHNob3dEZWNvcmF0aW9ucyA9PT0gJ292ZXJ2aWV3UnVsZXInKTtcblx0XHR0aGlzLl9kaXNwb3NlQWxsRGVjb3JhdGlvbnMoKTtcblx0XHRpZiAodGhpcy5fc2hvd0d1dHRlckRlY29yYXRpb25zIHx8IHRoaXMuX3Nob3dPdmVydmlld1J1bGVyRGVjb3JhdGlvbnMpIHtcblx0XHRcdHRoaXMuX2F0dGFjaFRvQ29tbWFuZENhcGFiaWxpdHkoKTtcblx0XHRcdHRoaXMuX3VwZGF0ZUd1dHRlckRlY29yYXRpb25WaXNpYmlsaXR5KCk7XG5cdFx0fVxuXHRcdGNvbnN0IGN1cnJlbnRDb21tYW5kID0gdGhpcy5fY2FwYWJpbGl0aWVzLmdldChUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbik/LmV4ZWN1dGluZ0NvbW1hbmRPYmplY3Q7XG5cdFx0aWYgKGN1cnJlbnRDb21tYW5kKSB7XG5cdFx0XHR0aGlzLnJlZ2lzdGVyQ29tbWFuZERlY29yYXRpb24oY3VycmVudENvbW1hbmQsIHRydWUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2Rpc3Bvc2VBbGxEZWNvcmF0aW9ucygpOiB2b2lkIHtcblx0XHR0aGlzLl9wbGFjZWhvbGRlckRlY29yYXRpb24/LmRpc3Bvc2UoKTtcblx0XHRmb3IgKGNvbnN0IHZhbHVlIG9mIHRoaXMuX2RlY29yYXRpb25zLnZhbHVlcygpKSB7XG5cdFx0XHR2YWx1ZS5kZWNvcmF0aW9uLmRpc3Bvc2UoKTtcblx0XHRcdGRpc3Bvc2UodmFsdWUuZGlzcG9zYWJsZXMpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUd1dHRlckRlY29yYXRpb25WaXNpYmlsaXR5KCk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbW1hbmREZWNvcmF0aW9uRWxlbWVudHMgPSB0aGlzLl90ZXJtaW5hbD8uZWxlbWVudD8ucXVlcnlTZWxlY3RvckFsbChEZWNvcmF0aW9uU2VsZWN0b3IuQ29tbWFuZERlY29yYXRpb24pO1xuXHRcdGlmIChjb21tYW5kRGVjb3JhdGlvbkVsZW1lbnRzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGNvbW1hbmREZWNvcmF0aW9uRWxlbWVudCBvZiBjb21tYW5kRGVjb3JhdGlvbkVsZW1lbnRzKSB7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZUNvbW1hbmREZWNvcmF0aW9uVmlzaWJpbGl0eShjb21tYW5kRGVjb3JhdGlvbkVsZW1lbnQpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUNvbW1hbmREZWNvcmF0aW9uVmlzaWJpbGl0eShjb21tYW5kRGVjb3JhdGlvbkVsZW1lbnQ6IEVsZW1lbnQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fc2hvd0d1dHRlckRlY29yYXRpb25zKSB7XG5cdFx0XHRjb21tYW5kRGVjb3JhdGlvbkVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZShEZWNvcmF0aW9uU2VsZWN0b3IuSGlkZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbW1hbmREZWNvcmF0aW9uRWxlbWVudC5jbGFzc0xpc3QuYWRkKERlY29yYXRpb25TZWxlY3Rvci5IaWRlKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgcmVmcmVzaExheW91dHMoKTogdm9pZCB7XG5cdFx0dXBkYXRlTGF5b3V0KHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLCB0aGlzLl9wbGFjZWhvbGRlckRlY29yYXRpb24/LmVsZW1lbnQpO1xuXHRcdGZvciAoY29uc3QgZGVjb3JhdGlvbiBvZiB0aGlzLl9kZWNvcmF0aW9ucykge1xuXHRcdFx0dXBkYXRlTGF5b3V0KHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLCBkZWNvcmF0aW9uWzFdLmRlY29yYXRpb24uZWxlbWVudCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVmcmVzaFN0eWxlcyhyZWZyZXNoT3ZlcnZpZXdSdWxlckNvbG9ycz86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAocmVmcmVzaE92ZXJ2aWV3UnVsZXJDb2xvcnMpIHtcblx0XHRcdGZvciAoY29uc3QgZGVjb3JhdGlvbiBvZiB0aGlzLl9kZWNvcmF0aW9ucy52YWx1ZXMoKSkge1xuXHRcdFx0XHRjb25zdCBjb2xvciA9IHRoaXMuX2dldERlY29yYXRpb25Dc3NDb2xvcihkZWNvcmF0aW9uKT8udG9TdHJpbmcoKSA/PyAnJztcblx0XHRcdFx0aWYgKGRlY29yYXRpb24uZGVjb3JhdGlvbi5vcHRpb25zPy5vdmVydmlld1J1bGVyT3B0aW9ucykge1xuXHRcdFx0XHRcdGRlY29yYXRpb24uZGVjb3JhdGlvbi5vcHRpb25zLm92ZXJ2aWV3UnVsZXJPcHRpb25zLmNvbG9yID0gY29sb3I7XG5cdFx0XHRcdH0gZWxzZSBpZiAoZGVjb3JhdGlvbi5kZWNvcmF0aW9uLm9wdGlvbnMpIHtcblx0XHRcdFx0XHRkZWNvcmF0aW9uLmRlY29yYXRpb24ub3B0aW9ucy5vdmVydmlld1J1bGVyT3B0aW9ucyA9IHsgY29sb3IgfTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl91cGRhdGVDbGFzc2VzKHRoaXMuX3BsYWNlaG9sZGVyRGVjb3JhdGlvbj8uZWxlbWVudCk7XG5cdFx0Zm9yIChjb25zdCBkZWNvcmF0aW9uIG9mIHRoaXMuX2RlY29yYXRpb25zLnZhbHVlcygpKSB7XG5cdFx0XHR0aGlzLl91cGRhdGVDbGFzc2VzKGRlY29yYXRpb24uZGVjb3JhdGlvbi5lbGVtZW50LCBkZWNvcmF0aW9uLmV4aXRDb2RlLCBkZWNvcmF0aW9uLm1hcmtQcm9wZXJ0aWVzKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9kaXNwb3NlKCk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgZGlzcG9zYWJsZSBvZiB0aGlzLl9jYXBhYmlsaXR5RGlzcG9zYWJsZXMudmFsdWVzKCkpIHtcblx0XHRcdGRpc3Bvc2UoZGlzcG9zYWJsZSk7XG5cdFx0fVxuXHRcdHRoaXMuY2xlYXJEZWNvcmF0aW9ucygpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY2xlYXJQbGFjZWhvbGRlcigpOiB2b2lkIHtcblx0XHR0aGlzLl9wbGFjZWhvbGRlckRlY29yYXRpb24/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9wbGFjZWhvbGRlckRlY29yYXRpb24gPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRwdWJsaWMgY2xlYXJEZWNvcmF0aW9ucygpOiB2b2lkIHtcblx0XHR0aGlzLl9wbGFjZWhvbGRlckRlY29yYXRpb24/Lm1hcmtlci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fY2xlYXJQbGFjZWhvbGRlcigpO1xuXHRcdHRoaXMuX2Rpc3Bvc2VBbGxEZWNvcmF0aW9ucygpO1xuXHRcdHRoaXMuX2RlY29yYXRpb25zLmNsZWFyKCk7XG5cdH1cblxuXHRwcml2YXRlIF9hdHRhY2hUb0NvbW1hbmRDYXBhYmlsaXR5KCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9jYXBhYmlsaXRpZXMuaGFzKFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uKSkge1xuXHRcdFx0Y29uc3QgY2FwYWJpbGl0eSA9IHRoaXMuX2NhcGFiaWxpdGllcy5nZXQoVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pITtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gdGhpcy5fZ2V0Q29tbWFuZERldGVjdGlvbkxpc3RlbmVycyhjYXBhYmlsaXR5KTtcblx0XHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0Zm9yIChjb25zdCBkIG9mIGRpc3Bvc2FibGVzKSB7XG5cdFx0XHRcdHN0b3JlLmFkZChkKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2NhcGFiaWxpdHlEaXNwb3NhYmxlcy5zZXQoVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24sIHN0b3JlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9nZXRDb21tYW5kRGV0ZWN0aW9uTGlzdGVuZXJzKGNhcGFiaWxpdHk6IElDb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSk6IElEaXNwb3NhYmxlW10ge1xuXHRcdHRoaXMuX3JlbW92ZUNhcGFiaWxpdHlEaXNwb3NhYmxlcyhUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbik7XG5cblx0XHRjb25zdCBjb21tYW5kRGV0ZWN0aW9uTGlzdGVuZXJzID0gW107XG5cdFx0Ly8gQ29tbWFuZCBzdGFydGVkXG5cdFx0aWYgKGNhcGFiaWxpdHkuZXhlY3V0aW5nQ29tbWFuZE9iamVjdD8ubWFya2VyKSB7XG5cdFx0XHR0aGlzLnJlZ2lzdGVyQ29tbWFuZERlY29yYXRpb24oY2FwYWJpbGl0eS5leGVjdXRpbmdDb21tYW5kT2JqZWN0LCB0cnVlKTtcblx0XHR9XG5cdFx0Y29tbWFuZERldGVjdGlvbkxpc3RlbmVycy5wdXNoKGNhcGFiaWxpdHkub25Db21tYW5kU3RhcnRlZChjb21tYW5kID0+IHRoaXMucmVnaXN0ZXJDb21tYW5kRGVjb3JhdGlvbihjb21tYW5kLCB0cnVlKSkpO1xuXHRcdC8vIENvbW1hbmQgZmluaXNoZWRcblx0XHRmb3IgKGNvbnN0IGNvbW1hbmQgb2YgY2FwYWJpbGl0eS5jb21tYW5kcykge1xuXHRcdFx0dGhpcy5yZWdpc3RlckNvbW1hbmREZWNvcmF0aW9uKGNvbW1hbmQpO1xuXHRcdH1cblx0XHRjb21tYW5kRGV0ZWN0aW9uTGlzdGVuZXJzLnB1c2goY2FwYWJpbGl0eS5vbkNvbW1hbmRGaW5pc2hlZChjb21tYW5kID0+IHtcblx0XHRcdHRoaXMucmVnaXN0ZXJDb21tYW5kRGVjb3JhdGlvbihjb21tYW5kKTtcblx0XHRcdGlmIChjb21tYW5kLmV4aXRDb2RlKSB7XG5cdFx0XHRcdHRoaXMuX2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLnBsYXlTaWduYWwoQWNjZXNzaWJpbGl0eVNpZ25hbC50ZXJtaW5hbENvbW1hbmRGYWlsZWQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UucGxheVNpZ25hbChBY2Nlc3NpYmlsaXR5U2lnbmFsLnRlcm1pbmFsQ29tbWFuZFN1Y2NlZWRlZCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdC8vIENvbW1hbmQgaW52YWxpZGF0ZWRcblx0XHRjb21tYW5kRGV0ZWN0aW9uTGlzdGVuZXJzLnB1c2goY2FwYWJpbGl0eS5vbkNvbW1hbmRJbnZhbGlkYXRlZChjb21tYW5kcyA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGNvbW1hbmQgb2YgY29tbWFuZHMpIHtcblx0XHRcdFx0Y29uc3QgaWQgPSBjb21tYW5kLm1hcmtlcj8uaWQ7XG5cdFx0XHRcdGlmIChpZCkge1xuXHRcdFx0XHRcdGNvbnN0IG1hdGNoID0gdGhpcy5fZGVjb3JhdGlvbnMuZ2V0KGlkKTtcblx0XHRcdFx0XHRpZiAobWF0Y2gpIHtcblx0XHRcdFx0XHRcdG1hdGNoLmRlY29yYXRpb24uZGlzcG9zZSgpO1xuXHRcdFx0XHRcdFx0ZGlzcG9zZShtYXRjaC5kaXNwb3NhYmxlcyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdC8vIEN1cnJlbnQgY29tbWFuZCBpbnZhbGlkYXRlZFxuXHRcdGNvbW1hbmREZXRlY3Rpb25MaXN0ZW5lcnMucHVzaChjYXBhYmlsaXR5Lm9uQ3VycmVudENvbW1hbmRJbnZhbGlkYXRlZCgocmVxdWVzdCkgPT4ge1xuXHRcdFx0aWYgKHJlcXVlc3QucmVhc29uID09PSBDb21tYW5kSW52YWxpZGF0aW9uUmVhc29uLk5vUHJvYmxlbXNSZXBvcnRlZCkge1xuXHRcdFx0XHRjb25zdCBsYXN0RGVjb3JhdGlvbiA9IEFycmF5LmZyb20odGhpcy5fZGVjb3JhdGlvbnMuZW50cmllcygpKVt0aGlzLl9kZWNvcmF0aW9ucy5zaXplIC0gMV07XG5cdFx0XHRcdGxhc3REZWNvcmF0aW9uPy5bMV0uZGVjb3JhdGlvbi5kaXNwb3NlKCk7XG5cdFx0XHR9IGVsc2UgaWYgKHJlcXVlc3QucmVhc29uID09PSBDb21tYW5kSW52YWxpZGF0aW9uUmVhc29uLldpbmRvd3MpIHtcblx0XHRcdFx0dGhpcy5fY2xlYXJQbGFjZWhvbGRlcigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRyZXR1cm4gY29tbWFuZERldGVjdGlvbkxpc3RlbmVycztcblx0fVxuXG5cdGFjdGl2YXRlKHRlcm1pbmFsOiBUZXJtaW5hbCk6IHZvaWQge1xuXHRcdHRoaXMuX3Rlcm1pbmFsID0gdGVybWluYWw7XG5cdFx0dGhpcy5fYXR0YWNoVG9Db21tYW5kQ2FwYWJpbGl0eSgpO1xuXHR9XG5cblx0cmVnaXN0ZXJDb21tYW5kRGVjb3JhdGlvbihjb21tYW5kPzogSVRlcm1pbmFsQ29tbWFuZCwgYmVmb3JlQ29tbWFuZEV4ZWN1dGlvbj86IGJvb2xlYW4sIG1hcmtQcm9wZXJ0aWVzPzogSU1hcmtQcm9wZXJ0aWVzKTogSURlY29yYXRpb24gfCB1bmRlZmluZWQge1xuXHRcdGlmICghdGhpcy5fdGVybWluYWwgfHwgKGJlZm9yZUNvbW1hbmRFeGVjdXRpb24gJiYgIWNvbW1hbmQpIHx8ICghdGhpcy5fc2hvd0d1dHRlckRlY29yYXRpb25zICYmICF0aGlzLl9zaG93T3ZlcnZpZXdSdWxlckRlY29yYXRpb25zKSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgbWFya2VyID0gY29tbWFuZD8ubWFya2VyIHx8IG1hcmtQcm9wZXJ0aWVzPy5tYXJrZXI7XG5cdFx0aWYgKCFtYXJrZXIpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgY2Fubm90IGFkZCBhIGRlY29yYXRpb24gZm9yIGEgY29tbWFuZCAke0pTT04uc3RyaW5naWZ5KGNvbW1hbmQpfSB3aXRoIG5vIG1hcmtlcmApO1xuXHRcdH1cblx0XHR0aGlzLl9jbGVhclBsYWNlaG9sZGVyKCk7XG5cdFx0Y29uc3QgY29sb3IgPSB0aGlzLl9nZXREZWNvcmF0aW9uQ3NzQ29sb3IoY29tbWFuZCk/LnRvU3RyaW5nKCkgPz8gJyc7XG5cdFx0Y29uc3QgZGVjb3JhdGlvbiA9IHRoaXMuX3Rlcm1pbmFsLnJlZ2lzdGVyRGVjb3JhdGlvbih7XG5cdFx0XHRtYXJrZXIsXG5cdFx0XHRvdmVydmlld1J1bGVyT3B0aW9uczogdGhpcy5fc2hvd092ZXJ2aWV3UnVsZXJEZWNvcmF0aW9ucyA/IChiZWZvcmVDb21tYW5kRXhlY3V0aW9uXG5cdFx0XHRcdD8geyBjb2xvciwgcG9zaXRpb246ICdsZWZ0JyB9XG5cdFx0XHRcdDogeyBjb2xvciwgcG9zaXRpb246IGNvbW1hbmQ/LmV4aXRDb2RlID8gJ3JpZ2h0JyA6ICdsZWZ0JyB9KSA6IHVuZGVmaW5lZFxuXHRcdH0pO1xuXHRcdGlmICghZGVjb3JhdGlvbikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKGJlZm9yZUNvbW1hbmRFeGVjdXRpb24pIHtcblx0XHRcdHRoaXMuX3BsYWNlaG9sZGVyRGVjb3JhdGlvbiA9IGRlY29yYXRpb247XG5cdFx0fVxuXHRcdGRlY29yYXRpb24ub25SZW5kZXIoZWxlbWVudCA9PiB7XG5cdFx0XHRpZiAoZWxlbWVudC5jbGFzc0xpc3QuY29udGFpbnMoRGVjb3JhdGlvblNlbGVjdG9yLk92ZXJ2aWV3UnVsZXIpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmICghdGhpcy5fZGVjb3JhdGlvbnMuZ2V0KGRlY29yYXRpb24ubWFya2VyLmlkKSkge1xuXHRcdFx0XHRkZWNvcmF0aW9uLm9uRGlzcG9zZSgoKSA9PiB0aGlzLl9kZWNvcmF0aW9ucy5kZWxldGUoZGVjb3JhdGlvbi5tYXJrZXIuaWQpKTtcblx0XHRcdFx0dGhpcy5fZGVjb3JhdGlvbnMuc2V0KGRlY29yYXRpb24ubWFya2VyLmlkLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGRlY29yYXRpb24sXG5cdFx0XHRcdFx0XHRkaXNwb3NhYmxlczogdGhpcy5fY3JlYXRlRGlzcG9zYWJsZXMoZWxlbWVudCwgY29tbWFuZCwgbWFya1Byb3BlcnRpZXMpLFxuXHRcdFx0XHRcdFx0ZXhpdENvZGU6IGNvbW1hbmQ/LmV4aXRDb2RlLFxuXHRcdFx0XHRcdFx0bWFya1Byb3BlcnRpZXM6IGNvbW1hbmQ/Lm1hcmtQcm9wZXJ0aWVzXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoIWVsZW1lbnQuY2xhc3NMaXN0LmNvbnRhaW5zKERlY29yYXRpb25TZWxlY3Rvci5Db2RpY29uKSB8fCBjb21tYW5kPy5tYXJrZXI/LmxpbmUgPT09IDApIHtcblx0XHRcdFx0Ly8gZmlyc3QgcmVuZGVyIG9yIGJ1ZmZlciB3YXMgY2xlYXJlZFxuXHRcdFx0XHR1cGRhdGVMYXlvdXQodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UsIGVsZW1lbnQpO1xuXHRcdFx0XHR0aGlzLl91cGRhdGVDbGFzc2VzKGVsZW1lbnQsIGNvbW1hbmQ/LmV4aXRDb2RlLCBjb21tYW5kPy5tYXJrUHJvcGVydGllcyB8fCBtYXJrUHJvcGVydGllcyk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0cmV0dXJuIGRlY29yYXRpb247XG5cdH1cblxuXHRyZWdpc3Rlck1lbnVJdGVtcyhjb21tYW5kOiBJVGVybWluYWxDb21tYW5kLCBpdGVtczogSUFjdGlvbltdKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGV4aXN0aW5nSXRlbXMgPSB0aGlzLl9yZWdpc3RlcmVkTWVudUl0ZW1zLmdldChjb21tYW5kKTtcblx0XHRpZiAoZXhpc3RpbmdJdGVtcykge1xuXHRcdFx0ZXhpc3RpbmdJdGVtcy5wdXNoKC4uLml0ZW1zKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXJlZE1lbnVJdGVtcy5zZXQoY29tbWFuZCwgWy4uLml0ZW1zXSk7XG5cdFx0fVxuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0Y29uc3QgY29tbWFuZEl0ZW1zID0gdGhpcy5fcmVnaXN0ZXJlZE1lbnVJdGVtcy5nZXQoY29tbWFuZCk7XG5cdFx0XHRpZiAoY29tbWFuZEl0ZW1zKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcy52YWx1ZXMoKSkge1xuXHRcdFx0XHRcdGNvbnN0IGluZGV4ID0gY29tbWFuZEl0ZW1zLmluZGV4T2YoaXRlbSk7XG5cdFx0XHRcdFx0aWYgKGluZGV4ICE9PSAtMSkge1xuXHRcdFx0XHRcdFx0Y29tbWFuZEl0ZW1zLnNwbGljZShpbmRleCwgMSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9jcmVhdGVEaXNwb3NhYmxlcyhlbGVtZW50OiBIVE1MRWxlbWVudCwgY29tbWFuZD86IElUZXJtaW5hbENvbW1hbmQsIG1hcmtQcm9wZXJ0aWVzPzogSU1hcmtQcm9wZXJ0aWVzKTogSURpc3Bvc2FibGVbXSB7XG5cdFx0aWYgKGNvbW1hbmQ/LmV4aXRDb2RlID09PSB1bmRlZmluZWQgJiYgIWNvbW1hbmQ/Lm1hcmtQcm9wZXJ0aWVzKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fSBlbHNlIGlmIChjb21tYW5kPy5tYXJrUHJvcGVydGllcyB8fCBtYXJrUHJvcGVydGllcykge1xuXHRcdFx0cmV0dXJuIFt0aGlzLl9jcmVhdGVIb3ZlcihlbGVtZW50LCBjb21tYW5kIHx8IG1hcmtQcm9wZXJ0aWVzLCBtYXJrUHJvcGVydGllcz8uaG92ZXJNZXNzYWdlKV07XG5cdFx0fVxuXHRcdHJldHVybiBbLi4udGhpcy5fY3JlYXRlQ29udGV4dE1lbnUoZWxlbWVudCwgY29tbWFuZCksIHRoaXMuX2NyZWF0ZUhvdmVyKGVsZW1lbnQsIGNvbW1hbmQpXTtcblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZUhvdmVyKGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBjb21tYW5kOiBJVGVybWluYWxDb21tYW5kIHwgdW5kZWZpbmVkLCBob3Zlck1lc3NhZ2U/OiBzdHJpbmcpIHtcblx0XHRyZXR1cm4gdGhpcy5faG92ZXJTZXJ2aWNlLnNldHVwRGVsYXllZEhvdmVyKGVsZW1lbnQsICgpID0+ICh7XG5cdFx0XHRjb250ZW50OiBuZXcgTWFya2Rvd25TdHJpbmcoZ2V0VGVybWluYWxEZWNvcmF0aW9uSG92ZXJDb250ZW50KGNvbW1hbmQsIGhvdmVyTWVzc2FnZSkpXG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlQ2xhc3NlcyhlbGVtZW50PzogSFRNTEVsZW1lbnQsIGV4aXRDb2RlPzogbnVtYmVyLCBtYXJrUHJvcGVydGllcz86IElNYXJrUHJvcGVydGllcyk6IHZvaWQge1xuXHRcdGlmICghZWxlbWVudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRmb3IgKGNvbnN0IGNsYXNzZXMgb2YgZWxlbWVudC5jbGFzc0xpc3QpIHtcblx0XHRcdGVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZShjbGFzc2VzKTtcblx0XHR9XG5cdFx0ZWxlbWVudC5jbGFzc0xpc3QuYWRkKERlY29yYXRpb25TZWxlY3Rvci5Db21tYW5kRGVjb3JhdGlvbiwgRGVjb3JhdGlvblNlbGVjdG9yLkNvZGljb24sIERlY29yYXRpb25TZWxlY3Rvci5YdGVybURlY29yYXRpb24pO1xuXG5cdFx0aWYgKG1hcmtQcm9wZXJ0aWVzKSB7XG5cdFx0XHRlbGVtZW50LmNsYXNzTGlzdC5hZGQoRGVjb3JhdGlvblNlbGVjdG9yLkRlZmF1bHRDb2xvciwgLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkodGVybWluYWxEZWNvcmF0aW9uTWFyaykpO1xuXHRcdFx0aWYgKCFtYXJrUHJvcGVydGllcy5ob3Zlck1lc3NhZ2UpIHtcblx0XHRcdFx0Ly9kaXNhYmxlIHRoZSBtb3VzZSBwb2ludGVyXG5cdFx0XHRcdGVsZW1lbnQuY2xhc3NMaXN0LmFkZChEZWNvcmF0aW9uU2VsZWN0b3IuRGVmYXVsdCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIGNvbW1hbmQgZGVjb3JhdGlvblxuXHRcdFx0dGhpcy5fdXBkYXRlQ29tbWFuZERlY29yYXRpb25WaXNpYmlsaXR5KGVsZW1lbnQpO1xuXHRcdFx0aWYgKGV4aXRDb2RlID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0ZWxlbWVudC5jbGFzc0xpc3QuYWRkKERlY29yYXRpb25TZWxlY3Rvci5EZWZhdWx0Q29sb3IsIERlY29yYXRpb25TZWxlY3Rvci5EZWZhdWx0KTtcblx0XHRcdFx0ZWxlbWVudC5jbGFzc0xpc3QuYWRkKC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KHRlcm1pbmFsRGVjb3JhdGlvbkluY29tcGxldGUpKTtcblx0XHRcdH0gZWxzZSBpZiAoZXhpdENvZGUpIHtcblx0XHRcdFx0ZWxlbWVudC5jbGFzc0xpc3QuYWRkKERlY29yYXRpb25TZWxlY3Rvci5FcnJvckNvbG9yKTtcblx0XHRcdFx0ZWxlbWVudC5jbGFzc0xpc3QuYWRkKC4uLlRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KHRlcm1pbmFsRGVjb3JhdGlvbkVycm9yKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRlbGVtZW50LmNsYXNzTGlzdC5hZGQoLi4uVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkodGVybWluYWxEZWNvcmF0aW9uU3VjY2VzcykpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZUNvbnRleHRNZW51KGVsZW1lbnQ6IEhUTUxFbGVtZW50LCBjb21tYW5kOiBJVGVybWluYWxDb21tYW5kKTogSURpc3Bvc2FibGVbXSB7XG5cdFx0Ly8gV2hlbiB0aGUgeHRlcm0gRGVjb3JhdGlvbiBnZXRzIGRpc3Bvc2VkIG9mLCBpdHMgZWxlbWVudCBnZXRzIHJlbW92ZWQgZnJvbSB0aGUgZG9tXG5cdFx0Ly8gYWxvbmcgd2l0aCBpdHMgbGlzdGVuZXJzXG5cdFx0cmV0dXJuIFtcblx0XHRcdGRvbS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoZWxlbWVudCwgZG9tLkV2ZW50VHlwZS5NT1VTRV9ET1dOLCBhc3luYyAoZSkgPT4ge1xuXHRcdFx0XHRlLnN0b3BJbW1lZGlhdGVQcm9wYWdhdGlvbigpO1xuXHRcdFx0fSksXG5cdFx0XHRkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGVsZW1lbnQsIGRvbS5FdmVudFR5cGUuQ0xJQ0ssIGFzeW5jIChlKSA9PiB7XG5cdFx0XHRcdGUuc3RvcEltbWVkaWF0ZVByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdGNvbnN0IGFjdGlvbnMgPSBhd2FpdCB0aGlzLl9nZXRDb21tYW5kQWN0aW9ucyhjb21tYW5kKTtcblx0XHRcdFx0dGhpcy5fY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7IGdldEFuY2hvcjogKCkgPT4gZWxlbWVudCwgZ2V0QWN0aW9uczogKCkgPT4gYWN0aW9ucyB9KTtcblx0XHRcdH0pLFxuXHRcdFx0ZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihlbGVtZW50LCBkb20uRXZlbnRUeXBlLkNPTlRFWFRfTUVOVSwgYXN5bmMgKGUpID0+IHtcblx0XHRcdFx0ZS5zdG9wSW1tZWRpYXRlUHJvcGFnYXRpb24oKTtcblx0XHRcdFx0Y29uc3QgYWN0aW9ucyA9IHRoaXMuX2dldENvbnRleHRNZW51QWN0aW9ucygpO1xuXHRcdFx0XHR0aGlzLl9jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHsgZ2V0QW5jaG9yOiAoKSA9PiBlbGVtZW50LCBnZXRBY3Rpb25zOiAoKSA9PiBhY3Rpb25zIH0pO1xuXHRcdFx0fSksXG5cdFx0XTtcblx0fVxuXHRwcml2YXRlIF9nZXRDb250ZXh0TWVudUFjdGlvbnMoKTogSUFjdGlvbltdIHtcblx0XHRjb25zdCBsYWJlbCA9IGxvY2FsaXplKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnRvZ2dsZVZpc2liaWxpdHknLCBcIlRvZ2dsZSBWaXNpYmlsaXR5XCIpO1xuXHRcdHJldHVybiBbXG5cdFx0XHR7XG5cdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsIHRvb2x0aXA6IGxhYmVsLCBpZDogJ3Rlcm1pbmFsLnRvZ2dsZVZpc2liaWxpdHknLCBsYWJlbCwgZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0cnVuOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fc2hvd1RvZ2dsZVZpc2liaWxpdHlRdWlja1BpY2soKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdF07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9nZXRDb21tYW5kQWN0aW9ucyhjb21tYW5kOiBJVGVybWluYWxDb21tYW5kKTogUHJvbWlzZTxJQWN0aW9uW10+IHtcblx0XHRjb25zdCBhY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblx0XHRjb25zdCByZWdpc3RlcmVkTWVudUl0ZW1zID0gdGhpcy5fcmVnaXN0ZXJlZE1lbnVJdGVtcy5nZXQoY29tbWFuZCk7XG5cdFx0aWYgKHJlZ2lzdGVyZWRNZW51SXRlbXM/Lmxlbmd0aCkge1xuXHRcdFx0YWN0aW9ucy5wdXNoKC4uLnJlZ2lzdGVyZWRNZW51SXRlbXMsIG5ldyBTZXBhcmF0b3IoKSk7XG5cdFx0fVxuXHRcdGlmIChjb21tYW5kLmNvbW1hbmQgIT09ICcnKSB7XG5cdFx0XHRjb25zdCBsYWJlbFJ1biA9IGxvY2FsaXplKFwidGVybWluYWwucmVydW5Db21tYW5kXCIsICdSZXJ1biBDb21tYW5kJyk7XG5cdFx0XHRhY3Rpb25zLnB1c2goe1xuXHRcdFx0XHRjbGFzczogdW5kZWZpbmVkLCB0b29sdGlwOiBsYWJlbFJ1biwgaWQ6ICd0ZXJtaW5hbC5yZXJ1bkNvbW1hbmQnLCBsYWJlbDogbGFiZWxSdW4sIGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdHJ1bjogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGlmIChjb21tYW5kLmNvbW1hbmQgPT09ICcnKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICghY29tbWFuZC5pc1RydXN0ZWQpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHNob3VsZFJ1biA9IGF3YWl0IG5ldyBQcm9taXNlPGJvb2xlYW4+KHIgPT4ge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLnByb21wdChTZXZlcml0eS5JbmZvLCBsb2NhbGl6ZSgncmVydW4nLCAnRG8geW91IHdhbnQgdG8gcnVuIHRoZSBjb21tYW5kOiB7MH0nLCBjb21tYW5kLmNvbW1hbmQpLCBbe1xuXHRcdFx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgneWVzJywgJ1llcycpLFxuXHRcdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gcih0cnVlKVxuXHRcdFx0XHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdubycsICdObycpLFxuXHRcdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gcihmYWxzZSlcblx0XHRcdFx0XHRcdFx0fV0pO1xuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0XHRpZiAoIXNob3VsZFJ1bikge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHRoaXMuX29uRGlkUmVxdWVzdFJ1bkNvbW1hbmQuZmlyZSh7IGNvbW1hbmQgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0Ly8gVGhlIHNlY29uZCBzZWN0aW9uIGlzIHRoZSBjbGlwYm9hcmQgc2VjdGlvblxuXHRcdFx0YWN0aW9ucy5wdXNoKG5ldyBTZXBhcmF0b3IoKSk7XG5cdFx0XHRjb25zdCBsYWJlbENvcHkgPSBsb2NhbGl6ZShcInRlcm1pbmFsLmNvcHlDb21tYW5kXCIsICdDb3B5IENvbW1hbmQnKTtcblx0XHRcdGFjdGlvbnMucHVzaCh7XG5cdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsIHRvb2x0aXA6IGxhYmVsQ29weSwgaWQ6ICd0ZXJtaW5hbC5jb3B5Q29tbWFuZCcsIGxhYmVsOiBsYWJlbENvcHksIGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5fY2xpcGJvYXJkU2VydmljZS53cml0ZVRleHQoY29tbWFuZC5jb21tYW5kKVxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdGlmIChjb21tYW5kLmhhc091dHB1dCgpKSB7XG5cdFx0XHRjb25zdCBsYWJlbENvcHlDb21tYW5kQW5kT3V0cHV0ID0gbG9jYWxpemUoXCJ0ZXJtaW5hbC5jb3B5Q29tbWFuZEFuZE91dHB1dFwiLCAnQ29weSBDb21tYW5kIGFuZCBPdXRwdXQnKTtcblx0XHRcdGFjdGlvbnMucHVzaCh7XG5cdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsIHRvb2x0aXA6IGxhYmVsQ29weUNvbW1hbmRBbmRPdXRwdXQsIGlkOiAndGVybWluYWwuY29weUNvbW1hbmRBbmRPdXRwdXQnLCBsYWJlbDogbGFiZWxDb3B5Q29tbWFuZEFuZE91dHB1dCwgZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3Qgb3V0cHV0ID0gY29tbWFuZC5nZXRPdXRwdXQoKTtcblx0XHRcdFx0XHRpZiAodHlwZW9mIG91dHB1dCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRcdHRoaXMuX2NsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KGAke2NvbW1hbmQuY29tbWFuZCAhPT0gJycgPyBjb21tYW5kLmNvbW1hbmQgKyAnXFxuJyA6ICcnfSR7b3V0cHV0fWApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCBsYWJlbFRleHQgPSBsb2NhbGl6ZShcInRlcm1pbmFsLmNvcHlPdXRwdXRcIiwgJ0NvcHkgT3V0cHV0Jyk7XG5cdFx0XHRhY3Rpb25zLnB1c2goe1xuXHRcdFx0XHRjbGFzczogdW5kZWZpbmVkLCB0b29sdGlwOiBsYWJlbFRleHQsIGlkOiAndGVybWluYWwuY29weU91dHB1dCcsIGxhYmVsOiBsYWJlbFRleHQsIGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHRleHQgPSBjb21tYW5kLmdldE91dHB1dCgpO1xuXHRcdFx0XHRcdGlmICh0eXBlb2YgdGV4dCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRcdHRoaXMuX2NsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KHRleHQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCBsYWJlbEh0bWwgPSBsb2NhbGl6ZShcInRlcm1pbmFsLmNvcHlPdXRwdXRBc0h0bWxcIiwgJ0NvcHkgT3V0cHV0IGFzIEhUTUwnKTtcblx0XHRcdGFjdGlvbnMucHVzaCh7XG5cdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsIHRvb2x0aXA6IGxhYmVsSHRtbCwgaWQ6ICd0ZXJtaW5hbC5jb3B5T3V0cHV0QXNIdG1sJywgbGFiZWw6IGxhYmVsSHRtbCwgZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLl9vbkRpZFJlcXVlc3RDb3B5QXNIdG1sLmZpcmUoeyBjb21tYW5kIH0pXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0aWYgKGFjdGlvbnMubGVuZ3RoID4gMCkge1xuXHRcdFx0YWN0aW9ucy5wdXNoKG5ldyBTZXBhcmF0b3IoKSk7XG5cdFx0fVxuXHRcdGNvbnN0IGxhYmVsUnVuUmVjZW50ID0gbG9jYWxpemUoJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwucnVuUmVjZW50Q29tbWFuZCcsIFwiUnVuIFJlY2VudCBDb21tYW5kXCIpO1xuXHRcdGFjdGlvbnMucHVzaCh7XG5cdFx0XHRjbGFzczogdW5kZWZpbmVkLCB0b29sdGlwOiBsYWJlbFJ1blJlY2VudCwgaWQ6ICd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnJ1blJlY2VudENvbW1hbmQnLCBsYWJlbDogbGFiZWxSdW5SZWNlbnQsIGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRydW46ICgpID0+IHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLnJ1blJlY2VudENvbW1hbmQnKVxuXHRcdH0pO1xuXHRcdGNvbnN0IGxhYmVsR29Ub1JlY2VudCA9IGxvY2FsaXplKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmdvVG9SZWNlbnREaXJlY3RvcnknLCBcIkdvIFRvIFJlY2VudCBEaXJlY3RvcnlcIik7XG5cdFx0YWN0aW9ucy5wdXNoKHtcblx0XHRcdGNsYXNzOiB1bmRlZmluZWQsIHRvb2x0aXA6IGxhYmVsUnVuUmVjZW50LCBpZDogJ3dvcmtiZW5jaC5hY3Rpb24udGVybWluYWwuZ29Ub1JlY2VudERpcmVjdG9yeScsIGxhYmVsOiBsYWJlbEdvVG9SZWNlbnQsIGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRydW46ICgpID0+IHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCd3b3JrYmVuY2guYWN0aW9uLnRlcm1pbmFsLmdvVG9SZWNlbnREaXJlY3RvcnknKVxuXHRcdH0pO1xuXG5cdFx0YWN0aW9ucy5wdXNoKG5ldyBTZXBhcmF0b3IoKSk7XG5cblx0XHRjb25zdCBsYWJlbEFib3V0ID0gbG9jYWxpemUoXCJ0ZXJtaW5hbC5sZWFyblNoZWxsSW50ZWdyYXRpb25cIiwgJ0xlYXJuIEFib3V0IFNoZWxsIEludGVncmF0aW9uJyk7XG5cdFx0YWN0aW9ucy5wdXNoKHtcblx0XHRcdGNsYXNzOiB1bmRlZmluZWQsIHRvb2x0aXA6IGxhYmVsQWJvdXQsIGlkOiAndGVybWluYWwubGVhcm5TaGVsbEludGVncmF0aW9uJywgbGFiZWw6IGxhYmVsQWJvdXQsIGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRydW46ICgpID0+IHRoaXMuX29wZW5lclNlcnZpY2Uub3BlbignaHR0cHM6Ly9jb2RlLnZpc3VhbHN0dWRpby5jb20vZG9jcy90ZXJtaW5hbC9zaGVsbC1pbnRlZ3JhdGlvbicpXG5cdFx0fSk7XG5cdFx0cmV0dXJuIGFjdGlvbnM7XG5cdH1cblxuXHRwcml2YXRlIF9zaG93VG9nZ2xlVmlzaWJpbGl0eVF1aWNrUGljaygpIHtcblx0XHRjb25zdCBxdWlja1BpY2sgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLl9xdWlja0lucHV0U2VydmljZS5jcmVhdGVRdWlja1BpY2soKSk7XG5cdFx0cXVpY2tQaWNrLmhpZGVJbnB1dCA9IHRydWU7XG5cdFx0cXVpY2tQaWNrLmhpZGVDaGVja0FsbCA9IHRydWU7XG5cdFx0cXVpY2tQaWNrLmNhblNlbGVjdE1hbnkgPSB0cnVlO1xuXHRcdHF1aWNrUGljay50aXRsZSA9IGxvY2FsaXplKCd0b2dnbGVWaXNpYmlsaXR5JywgJ1RvZ2dsZSB2aXNpYmlsaXR5Jyk7XG5cdFx0Y29uc3QgY29uZmlnVmFsdWUgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShUZXJtaW5hbFNldHRpbmdJZC5TaGVsbEludGVncmF0aW9uRGVjb3JhdGlvbnNFbmFibGVkKTtcblx0XHRjb25zdCBndXR0ZXJJY29uOiBJUXVpY2tQaWNrSXRlbSA9IHtcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnZ3V0dGVyJywgJ0d1dHRlciBjb21tYW5kIGRlY29yYXRpb25zJyksXG5cdFx0XHRwaWNrZWQ6IGNvbmZpZ1ZhbHVlICE9PSAnbmV2ZXInICYmIGNvbmZpZ1ZhbHVlICE9PSAnb3ZlcnZpZXdSdWxlcidcblx0XHR9O1xuXHRcdGNvbnN0IG92ZXJ2aWV3UnVsZXJJY29uOiBJUXVpY2tQaWNrSXRlbSA9IHtcblx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnb3ZlcnZpZXdSdWxlcicsICdPdmVydmlldyBydWxlciBjb21tYW5kIGRlY29yYXRpb25zJyksXG5cdFx0XHRwaWNrZWQ6IGNvbmZpZ1ZhbHVlICE9PSAnbmV2ZXInICYmIGNvbmZpZ1ZhbHVlICE9PSAnZ3V0dGVyJ1xuXHRcdH07XG5cdFx0cXVpY2tQaWNrLml0ZW1zID0gW2d1dHRlckljb24sIG92ZXJ2aWV3UnVsZXJJY29uXTtcblx0XHRjb25zdCBzZWxlY3RlZEl0ZW1zOiBJUXVpY2tQaWNrSXRlbVtdID0gW107XG5cdFx0aWYgKGNvbmZpZ1ZhbHVlICE9PSAnbmV2ZXInKSB7XG5cdFx0XHRpZiAoY29uZmlnVmFsdWUgIT09ICdndXR0ZXInKSB7XG5cdFx0XHRcdHNlbGVjdGVkSXRlbXMucHVzaChndXR0ZXJJY29uKTtcblx0XHRcdH1cblx0XHRcdGlmIChjb25maWdWYWx1ZSAhPT0gJ292ZXJ2aWV3UnVsZXInKSB7XG5cdFx0XHRcdHNlbGVjdGVkSXRlbXMucHVzaChvdmVydmlld1J1bGVySWNvbik7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHF1aWNrUGljay5zZWxlY3RlZEl0ZW1zID0gc2VsZWN0ZWRJdGVtcztcblx0XHR0aGlzLl9yZWdpc3RlcihxdWlja1BpY2sub25EaWRDaGFuZ2VTZWxlY3Rpb24oYXN5bmMgZSA9PiB7XG5cdFx0XHRsZXQgbmV3VmFsdWU6ICdib3RoJyB8ICdndXR0ZXInIHwgJ292ZXJ2aWV3UnVsZXInIHwgJ25ldmVyJyA9ICduZXZlcic7XG5cdFx0XHRpZiAoZS5pbmNsdWRlcyhndXR0ZXJJY29uKSkge1xuXHRcdFx0XHRpZiAoZS5pbmNsdWRlcyhvdmVydmlld1J1bGVySWNvbikpIHtcblx0XHRcdFx0XHRuZXdWYWx1ZSA9ICdib3RoJztcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRuZXdWYWx1ZSA9ICdndXR0ZXInO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKGUuaW5jbHVkZXMob3ZlcnZpZXdSdWxlckljb24pKSB7XG5cdFx0XHRcdG5ld1ZhbHVlID0gJ292ZXJ2aWV3UnVsZXInO1xuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoVGVybWluYWxTZXR0aW5nSWQuU2hlbGxJbnRlZ3JhdGlvbkRlY29yYXRpb25zRW5hYmxlZCwgbmV3VmFsdWUpO1xuXHRcdH0pKTtcblx0XHRxdWlja1BpY2sub2sgPSBmYWxzZTtcblx0XHRxdWlja1BpY2suc2hvdygpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0RGVjb3JhdGlvbkNzc0NvbG9yKGRlY29yYXRpb25PckNvbW1hbmQ/OiBJRGlzcG9zYWJsZURlY29yYXRpb24gfCBJVGVybWluYWxDb21tYW5kKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRsZXQgY29sb3JJZDogc3RyaW5nO1xuXHRcdGlmIChkZWNvcmF0aW9uT3JDb21tYW5kPy5leGl0Q29kZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb2xvcklkID0gVEVSTUlOQUxfQ09NTUFORF9ERUNPUkFUSU9OX0RFRkFVTFRfQkFDS0dST1VORF9DT0xPUjtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29sb3JJZCA9IGRlY29yYXRpb25PckNvbW1hbmQuZXhpdENvZGUgPyBURVJNSU5BTF9DT01NQU5EX0RFQ09SQVRJT05fRVJST1JfQkFDS0dST1VORF9DT0xPUiA6IFRFUk1JTkFMX0NPTU1BTkRfREVDT1JBVElPTl9TVUNDRVNTX0JBQ0tHUk9VTkRfQ09MT1I7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl90aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpLmdldENvbG9yKGNvbG9ySWQpPy50b1N0cmluZygpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU1BLFlBQVksU0FBUztBQUNyQixTQUFrQixpQkFBaUI7QUFDbkMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsWUFBWSxlQUFlLGlCQUE4QixTQUFTLG9CQUFvQjtBQUMvRixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGdCQUFn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
