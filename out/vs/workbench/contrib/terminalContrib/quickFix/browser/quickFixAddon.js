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
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import * as dom from "../../../../../base/browser/dom.js";
import { asArray } from "../../../../../base/common/arrays.js";
import { localize } from "../../../../../nls.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IOpenerService } from "../../../../../platform/opener/common/opener.js";
import { DecorationSelector, updateLayout } from "../../../terminal/browser/xterm/decorationStyles.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { AccessibilitySignal, IAccessibilitySignalService } from "../../../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { IActionWidgetService } from "../../../../../platform/actionWidget/browser/actionWidget.js";
import { getLinesForCommand } from "../../../../../platform/terminal/common/capabilities/commandDetectionCapability.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { Schemas } from "../../../../../base/common/network.js";
import { ITerminalQuickFixService, TerminalQuickFixType } from "./quickFix.js";
import { ActionListItemKind } from "../../../../../platform/actionWidget/browser/actionList.js";
import { CodeActionKind } from "../../../../../editor/contrib/codeAction/common/types.js";
import { Codicon } from "../../../../../base/common/codicons.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { ICommandService } from "../../../../../platform/commands/common/commands.js";
var QuickFixDecorationSelector = /* @__PURE__ */ ((QuickFixDecorationSelector2) => {
  QuickFixDecorationSelector2["QuickFix"] = "quick-fix";
  return QuickFixDecorationSelector2;
})(QuickFixDecorationSelector || {});
const quickFixClasses = [
  "quick-fix" /* QuickFix */,
  DecorationSelector.Codicon,
  DecorationSelector.CommandDecoration,
  DecorationSelector.XtermDecoration
];
let TerminalQuickFixAddon = class extends Disposable {
  constructor(_aliases, _capabilities, _accessibilitySignalService, _actionWidgetService, _commandService, _configurationService, _extensionService, _labelService, _openerService, _telemetryService, _quickFixService) {
    super();
    this._aliases = _aliases;
    this._capabilities = _capabilities;
    this._accessibilitySignalService = _accessibilitySignalService;
    this._actionWidgetService = _actionWidgetService;
    this._commandService = _commandService;
    this._configurationService = _configurationService;
    this._extensionService = _extensionService;
    this._labelService = _labelService;
    this._openerService = _openerService;
    this._telemetryService = _telemetryService;
    this._quickFixService = _quickFixService;
    this._commandListeners = /* @__PURE__ */ new Map();
    this._decoration = this._register(new MutableDisposable());
    this._decorationDisposables = this._register(new MutableDisposable());
    this._registeredSelectors = /* @__PURE__ */ new Set();
    this._didRun = false;
    this._onDidRequestRerunCommand = new Emitter();
    this.onDidRequestRerunCommand = this._onDidRequestRerunCommand.event;
    this._onDidUpdateQuickFixes = new Emitter();
    this.onDidUpdateQuickFixes = this._onDidUpdateQuickFixes.event;
    const commandDetectionCapability = this._capabilities.get(TerminalCapability.CommandDetection);
    if (commandDetectionCapability) {
      this._registerCommandHandlers();
    } else {
      this._register(this._capabilities.onDidAddCapabilityType((c) => {
        if (c === TerminalCapability.CommandDetection) {
          this._registerCommandHandlers();
        }
      }));
    }
    this._register(this._quickFixService.onDidRegisterProvider((result) => this.registerCommandFinishedListener(convertToQuickFixOptions(result))));
    this._quickFixService.extensionQuickFixes.then((quickFixSelectors) => {
      for (const selector of quickFixSelectors) {
        this.registerCommandSelector(selector);
      }
    });
    this._register(this._quickFixService.onDidRegisterCommandSelector((selector) => this.registerCommandSelector(selector)));
    this._register(this._quickFixService.onDidUnregisterProvider((id) => this._commandListeners.delete(id)));
  }
  activate(terminal) {
    this._terminal = terminal;
  }
  showMenu() {
    if (!this._currentRenderContext) {
      return;
    }
    const actions = this._currentRenderContext.quickFixes.map((f) => new TerminalQuickFixItem(f, f.type, f.source, f.label, f.kind));
    const actionSet = {
      allActions: actions,
      hasAutoFix: false,
      hasAIFix: false,
      allAIFixes: false,
      validActions: actions,
      dispose: () => {
      }
    };
    const delegate = {
      onSelect: async (fix) => {
        fix.action?.run();
        this._actionWidgetService.hide();
      },
      onHide: () => {
        this._terminal?.focus();
      }
    };
    this._actionWidgetService.show("quickFixWidget", false, toActionWidgetItems(actionSet.validActions, true), delegate, this._currentRenderContext.anchor, this._currentRenderContext.parentElement);
  }
  registerCommandSelector(selector) {
    if (this._registeredSelectors.has(selector.id)) {
      return;
    }
    const matcherKey = selector.commandLineMatcher.toString();
    const currentOptions = this._commandListeners.get(matcherKey) || [];
    currentOptions.push({
      id: selector.id,
      type: "unresolved",
      commandLineMatcher: selector.commandLineMatcher,
      outputMatcher: selector.outputMatcher,
      commandExitResult: selector.commandExitResult,
      kind: selector.kind
    });
    this._registeredSelectors.add(selector.id);
    this._commandListeners.set(matcherKey, currentOptions);
  }
  registerCommandFinishedListener(options) {
    const matcherKey = options.commandLineMatcher.toString();
    let currentOptions = this._commandListeners.get(matcherKey) || [];
    currentOptions = currentOptions.filter((o) => o.id !== options.id);
    currentOptions.push(options);
    this._commandListeners.set(matcherKey, currentOptions);
  }
  _registerCommandHandlers() {
    const terminal = this._terminal;
    const commandDetection = this._capabilities.get(TerminalCapability.CommandDetection);
    if (!terminal || !commandDetection) {
      return;
    }
    this._register(commandDetection.onCommandFinished(async (command) => await this._resolveQuickFixes(command, this._aliases)));
  }
  /**
   * Resolves quick fixes, if any, based on the
   * @param command & its output
   */
  async _resolveQuickFixes(command, aliases) {
    const terminal = this._terminal;
    if (!terminal || command.wasReplayed) {
      return;
    }
    if (command.command !== "" && this._lastQuickFixId) {
      this._disposeQuickFix(command, this._lastQuickFixId);
    }
    const resolver = async (selector, lines) => {
      if (lines === void 0) {
        return void 0;
      }
      const id = selector.id;
      await this._extensionService.activateByEvent(`onTerminalQuickFixRequest:${id}`);
      return this._quickFixService.providers.get(id)?.provideTerminalQuickFixes(command, lines, {
        type: "resolved",
        commandLineMatcher: selector.commandLineMatcher,
        outputMatcher: selector.outputMatcher,
        commandExitResult: selector.commandExitResult,
        kind: selector.kind,
        id: selector.id
      }, new CancellationTokenSource().token);
    };
    const result = await getQuickFixesForCommand(aliases, terminal, command, this._commandListeners, this._commandService, this._openerService, this._labelService, this._onDidRequestRerunCommand, resolver);
    if (!result) {
      return;
    }
    this._quickFixes = result;
    this._lastQuickFixId = this._quickFixes[0].id;
    this._registerQuickFixDecoration();
    this._onDidUpdateQuickFixes.fire({ command, actions: this._quickFixes });
    this._quickFixes = void 0;
  }
  _disposeQuickFix(command, id) {
    this._telemetryService?.publicLog2("terminal/quick-fix", {
      quickFixId: id,
      ranQuickFix: this._didRun
    });
    this._decoration.clear();
    this._decorationDisposables.clear();
    this._onDidUpdateQuickFixes.fire({ command, actions: this._quickFixes });
    this._quickFixes = void 0;
    this._lastQuickFixId = void 0;
    this._didRun = false;
  }
  /**
   * Registers a decoration with the quick fixes
   */
  _registerQuickFixDecoration() {
    if (!this._terminal) {
      return;
    }
    this._decoration.clear();
    this._decorationDisposables.clear();
    const quickFixes = this._quickFixes;
    if (!quickFixes || quickFixes.length === 0) {
      return;
    }
    const marker = this._terminal.registerMarker();
    if (!marker) {
      return;
    }
    const decoration = this._decoration.value = this._terminal.registerDecoration({ marker, width: 2, layer: "top" });
    if (!decoration) {
      return;
    }
    const store = this._decorationDisposables.value = new DisposableStore();
    store.add(decoration.onRender((e) => {
      const rect = e.getBoundingClientRect();
      const anchor = {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      };
      if (e.classList.contains("quick-fix" /* QuickFix */)) {
        if (this._currentRenderContext) {
          this._currentRenderContext.anchor = anchor;
        }
        return;
      }
      e.classList.add(...quickFixClasses);
      const isExplainOnly = quickFixes.every((e2) => e2.kind === "explain");
      if (isExplainOnly) {
        e.classList.add("explainOnly");
      }
      e.classList.add(...ThemeIcon.asClassNameArray(isExplainOnly ? Codicon.sparkle : Codicon.lightBulb));
      updateLayout(this._configurationService, e);
      this._accessibilitySignalService.playSignal(AccessibilitySignal.terminalQuickFix);
      const parentElement = e.closest(".xterm")?.parentElement;
      if (!parentElement) {
        return;
      }
      this._currentRenderContext = { quickFixes, anchor, parentElement };
      this._register(dom.addDisposableListener(e, dom.EventType.CLICK, () => this.showMenu()));
    }));
    store.add(decoration.onDispose(() => this._currentRenderContext = void 0));
  }
};
TerminalQuickFixAddon = __decorateClass([
  __decorateParam(2, IAccessibilitySignalService),
  __decorateParam(3, IActionWidgetService),
  __decorateParam(4, ICommandService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IExtensionService),
  __decorateParam(7, ILabelService),
  __decorateParam(8, IOpenerService),
  __decorateParam(9, ITelemetryService),
  __decorateParam(10, ITerminalQuickFixService)
], TerminalQuickFixAddon);
async function getQuickFixesForCommand(aliases, terminal, terminalCommand, quickFixOptions, commandService, openerService, labelService, onDidRequestRerunCommand, getResolvedFixes) {
  const commandQuickFixSet = /* @__PURE__ */ new Set();
  const openQuickFixSet = /* @__PURE__ */ new Set();
  const fixes = [];
  const newCommand = terminalCommand.command;
  for (const options of quickFixOptions.values()) {
    for (const option of options) {
      if (option.commandExitResult === "success" && terminalCommand.exitCode !== 0 || option.commandExitResult === "error" && terminalCommand.exitCode === 0) {
        continue;
      }
      let quickFixes;
      if (option.type === "resolved") {
        quickFixes = await option.getQuickFixes(terminalCommand, getLinesForCommand(terminal.buffer.active, terminalCommand, terminal.cols, option.outputMatcher), option, new CancellationTokenSource().token);
      } else if (option.type === "unresolved") {
        if (!getResolvedFixes) {
          throw new Error("No resolved fix provider");
        }
        quickFixes = await getResolvedFixes(option, option.outputMatcher ? getLinesForCommand(terminal.buffer.active, terminalCommand, terminal.cols, option.outputMatcher) : void 0);
      } else if (option.type === "internal") {
        const commandLineMatch = newCommand.match(option.commandLineMatcher);
        if (!commandLineMatch) {
          continue;
        }
        const outputMatcher = option.outputMatcher;
        let outputMatch;
        if (outputMatcher) {
          outputMatch = terminalCommand.getOutputMatch(outputMatcher);
        }
        if (!outputMatch) {
          continue;
        }
        const matchResult = { commandLineMatch, outputMatch, commandLine: terminalCommand.command };
        quickFixes = option.getQuickFixes(matchResult);
      }
      if (quickFixes) {
        for (const quickFix of asArray(quickFixes)) {
          let action;
          if ("type" in quickFix) {
            switch (quickFix.type) {
              case TerminalQuickFixType.TerminalCommand: {
                const fix = quickFix;
                if (commandQuickFixSet.has(fix.terminalCommand)) {
                  continue;
                }
                commandQuickFixSet.add(fix.terminalCommand);
                const label = localize("quickFix.command", "Run: {0}", fix.terminalCommand);
                action = {
                  type: TerminalQuickFixType.TerminalCommand,
                  kind: option.kind,
                  class: void 0,
                  source: quickFix.source,
                  id: quickFix.id,
                  label,
                  enabled: true,
                  run: () => {
                    onDidRequestRerunCommand?.fire({
                      command: fix.terminalCommand,
                      shouldExecute: fix.shouldExecute ?? true
                    });
                  },
                  tooltip: label,
                  command: fix.terminalCommand,
                  shouldExecute: fix.shouldExecute
                };
                break;
              }
              case TerminalQuickFixType.Opener: {
                const fix = quickFix;
                if (!fix.uri) {
                  return;
                }
                if (openQuickFixSet.has(fix.uri.toString())) {
                  continue;
                }
                openQuickFixSet.add(fix.uri.toString());
                const isUrl = fix.uri.scheme === Schemas.http || fix.uri.scheme === Schemas.https;
                const uriLabel = isUrl ? encodeURI(fix.uri.toString(true)) : labelService.getUriLabel(fix.uri);
                const label = localize("quickFix.opener", "Open: {0}", uriLabel);
                action = {
                  source: quickFix.source,
                  id: quickFix.id,
                  label,
                  type: TerminalQuickFixType.Opener,
                  kind: option.kind,
                  class: void 0,
                  enabled: true,
                  run: () => openerService.open(fix.uri),
                  tooltip: label,
                  uri: fix.uri
                };
                break;
              }
              case TerminalQuickFixType.Port: {
                const fix = quickFix;
                action = {
                  source: "builtin",
                  type: fix.type,
                  kind: option.kind,
                  id: fix.id,
                  label: fix.label,
                  class: fix.class,
                  enabled: fix.enabled,
                  run: () => {
                    fix.run();
                  },
                  tooltip: fix.tooltip
                };
                break;
              }
              case TerminalQuickFixType.VscodeCommand: {
                const fix = quickFix;
                action = {
                  source: quickFix.source,
                  type: fix.type,
                  kind: option.kind,
                  id: fix.id,
                  label: fix.title,
                  class: void 0,
                  enabled: true,
                  run: () => commandService.executeCommand(fix.id),
                  tooltip: fix.title
                };
                break;
              }
            }
            if (action) {
              fixes.push(action);
            }
          }
        }
      }
    }
  }
  return fixes.length > 0 ? fixes : void 0;
}
function convertToQuickFixOptions(selectorProvider) {
  return {
    id: selectorProvider.selector.id,
    type: "resolved",
    commandLineMatcher: selectorProvider.selector.commandLineMatcher,
    outputMatcher: selectorProvider.selector.outputMatcher,
    commandExitResult: selectorProvider.selector.commandExitResult,
    kind: selectorProvider.selector.kind,
    getQuickFixes: selectorProvider.provider.provideTerminalQuickFixes
  };
}
class TerminalQuickFixItem {
  constructor(action, type, source, title, kind = "fix") {
    this.action = action;
    this.type = type;
    this.source = source;
    this.title = title;
    this.kind = kind;
    this.disabled = false;
  }
}
function toActionWidgetItems(inputQuickFixes, showHeaders) {
  const menuItems = [];
  menuItems.push({
    kind: ActionListItemKind.Header,
    group: {
      kind: CodeActionKind.QuickFix,
      title: localize("codeAction.widget.id.quickfix", "Quick Fix")
    }
  });
  for (const quickFix of showHeaders ? inputQuickFixes : inputQuickFixes.filter((i) => !!i.action)) {
    if (!quickFix.disabled && quickFix.action) {
      menuItems.push({
        kind: ActionListItemKind.Action,
        item: quickFix,
        group: {
          kind: CodeActionKind.QuickFix,
          icon: getQuickFixIcon(quickFix),
          title: quickFix.action.label
        },
        disabled: false,
        label: quickFix.title
      });
    }
  }
  return menuItems;
}
function getQuickFixIcon(quickFix) {
  if (quickFix.kind === "explain") {
    return Codicon.sparkle;
  }
  switch (quickFix.type) {
    case TerminalQuickFixType.Opener:
      if ("uri" in quickFix.action && quickFix.action.uri) {
        const isUrl = quickFix.action.uri.scheme === Schemas.http || quickFix.action.uri.scheme === Schemas.https;
        return isUrl ? Codicon.linkExternal : Codicon.goToFile;
      }
    case TerminalQuickFixType.TerminalCommand:
      return Codicon.run;
    case TerminalQuickFixType.Port:
      return Codicon.debugDisconnect;
    case TerminalQuickFixType.VscodeCommand:
      return Codicon.lightbulb;
  }
}
export {
  TerminalQuickFixAddon,
  getQuickFixesForCommand
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvcXVpY2tGaXgvYnJvd3Nlci9xdWlja0ZpeEFkZG9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHR5cGUgeyBJVGVybWluYWxBZGRvbiB9IGZyb20gJ0B4dGVybS9oZWFkbGVzcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgTXV0YWJsZURpc3Bvc2FibGUsIHR5cGUgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlLCBJVGVybWluYWxDb21tYW5kLCBUZXJtaW5hbENhcGFiaWxpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL2NhcGFiaWxpdGllcy5qcyc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBhc0FycmF5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBEZWNvcmF0aW9uU2VsZWN0b3IsIHVwZGF0ZUxheW91dCB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2Jyb3dzZXIveHRlcm0vZGVjb3JhdGlvblN0eWxlcy5qcyc7XG5pbXBvcnQgdHlwZSB7IElEZWNvcmF0aW9uLCBUZXJtaW5hbCB9IGZyb20gJ0B4dGVybS94dGVybSc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBBY2Nlc3NpYmlsaXR5U2lnbmFsLCBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5U2lnbmFsL2Jyb3dzZXIvYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUFjdGlvbldpZGdldFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25XaWRnZXQvYnJvd3Nlci9hY3Rpb25XaWRnZXQuanMnO1xuaW1wb3J0IHsgQWN0aW9uU2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uV2lkZ2V0L2NvbW1vbi9hY3Rpb25XaWRnZXQuanMnO1xuaW1wb3J0IHsgZ2V0TGluZXNGb3JDb21tYW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy9jb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBJQW5jaG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2NvbnRleHR2aWV3L2NvbnRleHR2aWV3LmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbFF1aWNrRml4SW50ZXJuYWxPcHRpb25zLCBJVGVybWluYWxRdWlja0ZpeFJlc29sdmVkRXh0ZW5zaW9uT3B0aW9ucywgSVRlcm1pbmFsUXVpY2tGaXgsIElUZXJtaW5hbFF1aWNrRml4VGVybWluYWxDb21tYW5kQWN0aW9uLCBJVGVybWluYWxRdWlja0ZpeE9wZW5lckFjdGlvbiwgSVRlcm1pbmFsUXVpY2tGaXhPcHRpb25zLCBJVGVybWluYWxRdWlja0ZpeFByb3ZpZGVyU2VsZWN0b3IsIElUZXJtaW5hbFF1aWNrRml4U2VydmljZSwgSVRlcm1pbmFsUXVpY2tGaXhVbnJlc29sdmVkRXh0ZW5zaW9uT3B0aW9ucywgVGVybWluYWxRdWlja0ZpeFR5cGUsIElUZXJtaW5hbFF1aWNrRml4Q29tbWFuZEFjdGlvbiB9IGZyb20gJy4vcXVpY2tGaXguanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsQ29tbWFuZFNlbGVjdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IEFjdGlvbkxpc3RJdGVtS2luZCwgSUFjdGlvbkxpc3RJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uV2lkZ2V0L2Jyb3dzZXIvYWN0aW9uTGlzdC5qcyc7XG5pbXBvcnQgeyBDb2RlQWN0aW9uS2luZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2NvZGVBY3Rpb24vY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcblxuY29uc3QgZW51bSBRdWlja0ZpeERlY29yYXRpb25TZWxlY3RvciB7XG5cdFF1aWNrRml4ID0gJ3F1aWNrLWZpeCdcbn1cblxuY29uc3QgcXVpY2tGaXhDbGFzc2VzID0gW1xuXHRRdWlja0ZpeERlY29yYXRpb25TZWxlY3Rvci5RdWlja0ZpeCxcblx0RGVjb3JhdGlvblNlbGVjdG9yLkNvZGljb24sXG5cdERlY29yYXRpb25TZWxlY3Rvci5Db21tYW5kRGVjb3JhdGlvbixcblx0RGVjb3JhdGlvblNlbGVjdG9yLlh0ZXJtRGVjb3JhdGlvblxuXTtcblxuZXhwb3J0IGludGVyZmFjZSBJVGVybWluYWxRdWlja0ZpeEFkZG9uIHtcblx0cmVhZG9ubHkgb25EaWRSZXF1ZXN0UmVydW5Db21tYW5kOiBFdmVudDx7IGNvbW1hbmQ6IHN0cmluZzsgc2hvdWxkRXhlY3V0ZT86IGJvb2xlYW4gfT47XG5cdHJlYWRvbmx5IG9uRGlkVXBkYXRlUXVpY2tGaXhlczogRXZlbnQ8eyBjb21tYW5kOiBJVGVybWluYWxDb21tYW5kOyBhY3Rpb25zOiBJVGVybWluYWxBY3Rpb25bXSB8IHVuZGVmaW5lZCB9Pjtcblx0c2hvd01lbnUoKTogdm9pZDtcblx0LyoqXG5cdCAqIFJlZ2lzdGVycyBhIGxpc3RlbmVyIG9uIG9uQ29tbWFuZEZpbmlzaGVkIHNjb3BlZCB0byBhIHBhcnRpY3VsYXIgY29tbWFuZCBvciByZWd1bGFyXG5cdCAqIGV4cHJlc3Npb24gYW5kIHByb3ZpZGVzIGEgY2FsbGJhY2sgdG8gYmUgZXhlY3V0ZWQgZm9yIGNvbW1hbmRzIHRoYXQgbWF0Y2guXG5cdCAqL1xuXHRyZWdpc3RlckNvbW1hbmRGaW5pc2hlZExpc3RlbmVyKG9wdGlvbnM6IElUZXJtaW5hbFF1aWNrRml4T3B0aW9ucyk6IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBUZXJtaW5hbFF1aWNrRml4QWRkb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVRlcm1pbmFsQWRkb24sIElUZXJtaW5hbFF1aWNrRml4QWRkb24ge1xuXG5cdHByaXZhdGUgX3Rlcm1pbmFsOiBUZXJtaW5hbCB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF9jb21tYW5kTGlzdGVuZXJzOiBNYXA8c3RyaW5nLCAoSVRlcm1pbmFsUXVpY2tGaXhPcHRpb25zIHwgSVRlcm1pbmFsUXVpY2tGaXhSZXNvbHZlZEV4dGVuc2lvbk9wdGlvbnMgfCBJVGVybWluYWxRdWlja0ZpeFVucmVzb2x2ZWRFeHRlbnNpb25PcHRpb25zKVtdPiA9IG5ldyBNYXAoKTtcblxuXHRwcml2YXRlIF9xdWlja0ZpeGVzOiBJVGVybWluYWxBY3Rpb25bXSB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kZWNvcmF0aW9uOiBNdXRhYmxlRGlzcG9zYWJsZTxJRGVjb3JhdGlvbj4gPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2RlY29yYXRpb25EaXNwb3NhYmxlczogTXV0YWJsZURpc3Bvc2FibGU8SURpc3Bvc2FibGU+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXG5cdHByaXZhdGUgX2N1cnJlbnRSZW5kZXJDb250ZXh0OiB7IHF1aWNrRml4ZXM6IElUZXJtaW5hbEFjdGlvbltdOyBhbmNob3I6IElBbmNob3I7IHBhcmVudEVsZW1lbnQ6IEhUTUxFbGVtZW50IH0gfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfbGFzdFF1aWNrRml4SWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9yZWdpc3RlcmVkU2VsZWN0b3JzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblxuXHRwcml2YXRlIF9kaWRSdW46IGJvb2xlYW4gPSBmYWxzZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFJlcXVlc3RSZXJ1bkNvbW1hbmQgPSBuZXcgRW1pdHRlcjx7IGNvbW1hbmQ6IHN0cmluZzsgc2hvdWxkRXhlY3V0ZT86IGJvb2xlYW4gfT4oKTtcblx0cmVhZG9ubHkgb25EaWRSZXF1ZXN0UmVydW5Db21tYW5kID0gdGhpcy5fb25EaWRSZXF1ZXN0UmVydW5Db21tYW5kLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFVwZGF0ZVF1aWNrRml4ZXMgPSBuZXcgRW1pdHRlcjx7IGNvbW1hbmQ6IElUZXJtaW5hbENvbW1hbmQ7IGFjdGlvbnM6IElUZXJtaW5hbEFjdGlvbltdIHwgdW5kZWZpbmVkIH0+KCk7XG5cdHJlYWRvbmx5IG9uRGlkVXBkYXRlUXVpY2tGaXhlcyA9IHRoaXMuX29uRGlkVXBkYXRlUXVpY2tGaXhlcy5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9hbGlhc2VzOiBzdHJpbmdbXVtdIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2NhcGFiaWxpdGllczogSVRlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlLFxuXHRcdEBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2U6IElBY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZSxcblx0XHRASUFjdGlvbldpZGdldFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfYWN0aW9uV2lkZ2V0U2VydmljZTogSUFjdGlvbldpZGdldFNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9vcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbFF1aWNrRml4U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9xdWlja0ZpeFNlcnZpY2U6IElUZXJtaW5hbFF1aWNrRml4U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHRjb25zdCBjb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSA9IHRoaXMuX2NhcGFiaWxpdGllcy5nZXQoVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pO1xuXHRcdGlmIChjb21tYW5kRGV0ZWN0aW9uQ2FwYWJpbGl0eSkge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXJDb21tYW5kSGFuZGxlcnMoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY2FwYWJpbGl0aWVzLm9uRGlkQWRkQ2FwYWJpbGl0eVR5cGUoYyA9PiB7XG5cdFx0XHRcdGlmIChjID09PSBUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbikge1xuXHRcdFx0XHRcdHRoaXMuX3JlZ2lzdGVyQ29tbWFuZEhhbmRsZXJzKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fcXVpY2tGaXhTZXJ2aWNlLm9uRGlkUmVnaXN0ZXJQcm92aWRlcihyZXN1bHQgPT4gdGhpcy5yZWdpc3RlckNvbW1hbmRGaW5pc2hlZExpc3RlbmVyKGNvbnZlcnRUb1F1aWNrRml4T3B0aW9ucyhyZXN1bHQpKSkpO1xuXHRcdHRoaXMuX3F1aWNrRml4U2VydmljZS5leHRlbnNpb25RdWlja0ZpeGVzLnRoZW4ocXVpY2tGaXhTZWxlY3RvcnMgPT4ge1xuXHRcdFx0Zm9yIChjb25zdCBzZWxlY3RvciBvZiBxdWlja0ZpeFNlbGVjdG9ycykge1xuXHRcdFx0XHR0aGlzLnJlZ2lzdGVyQ29tbWFuZFNlbGVjdG9yKHNlbGVjdG9yKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9xdWlja0ZpeFNlcnZpY2Uub25EaWRSZWdpc3RlckNvbW1hbmRTZWxlY3RvcihzZWxlY3RvciA9PiB0aGlzLnJlZ2lzdGVyQ29tbWFuZFNlbGVjdG9yKHNlbGVjdG9yKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3F1aWNrRml4U2VydmljZS5vbkRpZFVucmVnaXN0ZXJQcm92aWRlcihpZCA9PiB0aGlzLl9jb21tYW5kTGlzdGVuZXJzLmRlbGV0ZShpZCkpKTtcblx0fVxuXG5cdGFjdGl2YXRlKHRlcm1pbmFsOiBUZXJtaW5hbCk6IHZvaWQge1xuXHRcdHRoaXMuX3Rlcm1pbmFsID0gdGVybWluYWw7XG5cdH1cblxuXHRzaG93TWVudSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2N1cnJlbnRSZW5kZXJDb250ZXh0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWN0aW9ucyA9IHRoaXMuX2N1cnJlbnRSZW5kZXJDb250ZXh0LnF1aWNrRml4ZXMubWFwKGYgPT4gbmV3IFRlcm1pbmFsUXVpY2tGaXhJdGVtKGYsIGYudHlwZSwgZi5zb3VyY2UsIGYubGFiZWwsIGYua2luZCkpO1xuXHRcdGNvbnN0IGFjdGlvblNldCA9IHtcblx0XHRcdGFsbEFjdGlvbnM6IGFjdGlvbnMsXG5cdFx0XHRoYXNBdXRvRml4OiBmYWxzZSxcblx0XHRcdGhhc0FJRml4OiBmYWxzZSxcblx0XHRcdGFsbEFJRml4ZXM6IGZhbHNlLFxuXHRcdFx0dmFsaWRBY3Rpb25zOiBhY3Rpb25zLFxuXHRcdFx0ZGlzcG9zZTogKCkgPT4geyB9XG5cdFx0fSBzYXRpc2ZpZXMgQWN0aW9uU2V0PFRlcm1pbmFsUXVpY2tGaXhJdGVtPjtcblx0XHRjb25zdCBkZWxlZ2F0ZSA9IHtcblx0XHRcdG9uU2VsZWN0OiBhc3luYyAoZml4OiBUZXJtaW5hbFF1aWNrRml4SXRlbSkgPT4ge1xuXHRcdFx0XHRmaXguYWN0aW9uPy5ydW4oKTtcblx0XHRcdFx0dGhpcy5fYWN0aW9uV2lkZ2V0U2VydmljZS5oaWRlKCk7XG5cdFx0XHR9LFxuXHRcdFx0b25IaWRlOiAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3Rlcm1pbmFsPy5mb2N1cygpO1xuXHRcdFx0fSxcblx0XHR9O1xuXHRcdHRoaXMuX2FjdGlvbldpZGdldFNlcnZpY2Uuc2hvdygncXVpY2tGaXhXaWRnZXQnLCBmYWxzZSwgdG9BY3Rpb25XaWRnZXRJdGVtcyhhY3Rpb25TZXQudmFsaWRBY3Rpb25zLCB0cnVlKSwgZGVsZWdhdGUsIHRoaXMuX2N1cnJlbnRSZW5kZXJDb250ZXh0LmFuY2hvciwgdGhpcy5fY3VycmVudFJlbmRlckNvbnRleHQucGFyZW50RWxlbWVudCk7XG5cdH1cblxuXHRyZWdpc3RlckNvbW1hbmRTZWxlY3RvcihzZWxlY3RvcjogSVRlcm1pbmFsQ29tbWFuZFNlbGVjdG9yKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuX3JlZ2lzdGVyZWRTZWxlY3RvcnMuaGFzKHNlbGVjdG9yLmlkKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBtYXRjaGVyS2V5ID0gc2VsZWN0b3IuY29tbWFuZExpbmVNYXRjaGVyLnRvU3RyaW5nKCk7XG5cdFx0Y29uc3QgY3VycmVudE9wdGlvbnMgPSB0aGlzLl9jb21tYW5kTGlzdGVuZXJzLmdldChtYXRjaGVyS2V5KSB8fCBbXTtcblx0XHRjdXJyZW50T3B0aW9ucy5wdXNoKHtcblx0XHRcdGlkOiBzZWxlY3Rvci5pZCxcblx0XHRcdHR5cGU6ICd1bnJlc29sdmVkJyxcblx0XHRcdGNvbW1hbmRMaW5lTWF0Y2hlcjogc2VsZWN0b3IuY29tbWFuZExpbmVNYXRjaGVyLFxuXHRcdFx0b3V0cHV0TWF0Y2hlcjogc2VsZWN0b3Iub3V0cHV0TWF0Y2hlcixcblx0XHRcdGNvbW1hbmRFeGl0UmVzdWx0OiBzZWxlY3Rvci5jb21tYW5kRXhpdFJlc3VsdCxcblx0XHRcdGtpbmQ6IHNlbGVjdG9yLmtpbmRcblx0XHR9KTtcblx0XHR0aGlzLl9yZWdpc3RlcmVkU2VsZWN0b3JzLmFkZChzZWxlY3Rvci5pZCk7XG5cdFx0dGhpcy5fY29tbWFuZExpc3RlbmVycy5zZXQobWF0Y2hlcktleSwgY3VycmVudE9wdGlvbnMpO1xuXHR9XG5cblx0cmVnaXN0ZXJDb21tYW5kRmluaXNoZWRMaXN0ZW5lcihvcHRpb25zOiBJVGVybWluYWxRdWlja0ZpeE9wdGlvbnMgfCBJVGVybWluYWxRdWlja0ZpeFJlc29sdmVkRXh0ZW5zaW9uT3B0aW9ucyk6IHZvaWQge1xuXHRcdGNvbnN0IG1hdGNoZXJLZXkgPSBvcHRpb25zLmNvbW1hbmRMaW5lTWF0Y2hlci50b1N0cmluZygpO1xuXHRcdGxldCBjdXJyZW50T3B0aW9ucyA9IHRoaXMuX2NvbW1hbmRMaXN0ZW5lcnMuZ2V0KG1hdGNoZXJLZXkpIHx8IFtdO1xuXHRcdC8vIHJlbW92ZXMgdGhlIHVucmVzb2x2ZWQgb3B0aW9uc1xuXHRcdGN1cnJlbnRPcHRpb25zID0gY3VycmVudE9wdGlvbnMuZmlsdGVyKG8gPT4gby5pZCAhPT0gb3B0aW9ucy5pZCk7XG5cdFx0Y3VycmVudE9wdGlvbnMucHVzaChvcHRpb25zKTtcblx0XHR0aGlzLl9jb21tYW5kTGlzdGVuZXJzLnNldChtYXRjaGVyS2V5LCBjdXJyZW50T3B0aW9ucyk7XG5cdH1cblxuXHRwcml2YXRlIF9yZWdpc3RlckNvbW1hbmRIYW5kbGVycygpOiB2b2lkIHtcblx0XHRjb25zdCB0ZXJtaW5hbCA9IHRoaXMuX3Rlcm1pbmFsO1xuXHRcdGNvbnN0IGNvbW1hbmREZXRlY3Rpb24gPSB0aGlzLl9jYXBhYmlsaXRpZXMuZ2V0KFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uKTtcblx0XHRpZiAoIXRlcm1pbmFsIHx8ICFjb21tYW5kRGV0ZWN0aW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvbW1hbmREZXRlY3Rpb24ub25Db21tYW5kRmluaXNoZWQoYXN5bmMgY29tbWFuZCA9PiBhd2FpdCB0aGlzLl9yZXNvbHZlUXVpY2tGaXhlcyhjb21tYW5kLCB0aGlzLl9hbGlhc2VzKSkpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlc29sdmVzIHF1aWNrIGZpeGVzLCBpZiBhbnksIGJhc2VkIG9uIHRoZVxuXHQgKiBAcGFyYW0gY29tbWFuZCAmIGl0cyBvdXRwdXRcblx0ICovXG5cdHByaXZhdGUgYXN5bmMgX3Jlc29sdmVRdWlja0ZpeGVzKGNvbW1hbmQ6IElUZXJtaW5hbENvbW1hbmQsIGFsaWFzZXM/OiBzdHJpbmdbXVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdGVybWluYWwgPSB0aGlzLl90ZXJtaW5hbDtcblx0XHRpZiAoIXRlcm1pbmFsIHx8IGNvbW1hbmQud2FzUmVwbGF5ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKGNvbW1hbmQuY29tbWFuZCAhPT0gJycgJiYgdGhpcy5fbGFzdFF1aWNrRml4SWQpIHtcblx0XHRcdHRoaXMuX2Rpc3Bvc2VRdWlja0ZpeChjb21tYW5kLCB0aGlzLl9sYXN0UXVpY2tGaXhJZCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzb2x2ZXIgPSBhc3luYyAoc2VsZWN0b3I6IElUZXJtaW5hbFF1aWNrRml4T3B0aW9ucywgbGluZXM/OiBzdHJpbmdbXSkgPT4ge1xuXHRcdFx0aWYgKGxpbmVzID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGlkID0gc2VsZWN0b3IuaWQ7XG5cdFx0XHRhd2FpdCB0aGlzLl9leHRlbnNpb25TZXJ2aWNlLmFjdGl2YXRlQnlFdmVudChgb25UZXJtaW5hbFF1aWNrRml4UmVxdWVzdDoke2lkfWApO1xuXHRcdFx0cmV0dXJuIHRoaXMuX3F1aWNrRml4U2VydmljZS5wcm92aWRlcnMuZ2V0KGlkKT8ucHJvdmlkZVRlcm1pbmFsUXVpY2tGaXhlcyhjb21tYW5kLCBsaW5lcywge1xuXHRcdFx0XHR0eXBlOiAncmVzb2x2ZWQnLFxuXHRcdFx0XHRjb21tYW5kTGluZU1hdGNoZXI6IHNlbGVjdG9yLmNvbW1hbmRMaW5lTWF0Y2hlcixcblx0XHRcdFx0b3V0cHV0TWF0Y2hlcjogc2VsZWN0b3Iub3V0cHV0TWF0Y2hlcixcblx0XHRcdFx0Y29tbWFuZEV4aXRSZXN1bHQ6IHNlbGVjdG9yLmNvbW1hbmRFeGl0UmVzdWx0LFxuXHRcdFx0XHRraW5kOiBzZWxlY3Rvci5raW5kLFxuXHRcdFx0XHRpZDogc2VsZWN0b3IuaWRcblx0XHRcdH0sIG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpLnRva2VuKTtcblx0XHR9O1xuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IGdldFF1aWNrRml4ZXNGb3JDb21tYW5kKGFsaWFzZXMsIHRlcm1pbmFsLCBjb21tYW5kLCB0aGlzLl9jb21tYW5kTGlzdGVuZXJzLCB0aGlzLl9jb21tYW5kU2VydmljZSwgdGhpcy5fb3BlbmVyU2VydmljZSwgdGhpcy5fbGFiZWxTZXJ2aWNlLCB0aGlzLl9vbkRpZFJlcXVlc3RSZXJ1bkNvbW1hbmQsIHJlc29sdmVyKTtcblx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX3F1aWNrRml4ZXMgPSByZXN1bHQ7XG5cdFx0dGhpcy5fbGFzdFF1aWNrRml4SWQgPSB0aGlzLl9xdWlja0ZpeGVzWzBdLmlkO1xuXHRcdHRoaXMuX3JlZ2lzdGVyUXVpY2tGaXhEZWNvcmF0aW9uKCk7XG5cdFx0dGhpcy5fb25EaWRVcGRhdGVRdWlja0ZpeGVzLmZpcmUoeyBjb21tYW5kLCBhY3Rpb25zOiB0aGlzLl9xdWlja0ZpeGVzIH0pO1xuXHRcdHRoaXMuX3F1aWNrRml4ZXMgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIF9kaXNwb3NlUXVpY2tGaXgoY29tbWFuZDogSVRlcm1pbmFsQ29tbWFuZCwgaWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdHR5cGUgUXVpY2tGaXhSZXN1bHRUZWxlbWV0cnlFdmVudCA9IHtcblx0XHRcdHF1aWNrRml4SWQ6IHN0cmluZztcblx0XHRcdHJhblF1aWNrRml4OiBib29sZWFuO1xuXHRcdH07XG5cdFx0dHlwZSBRdWlja0ZpeENsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0b3duZXI6ICdtZWdhbnJvZ2dlJztcblx0XHRcdHF1aWNrRml4SWQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgcXVpY2sgZml4IElEJyB9O1xuXHRcdFx0cmFuUXVpY2tGaXg6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdXaGV0aGVyIHRoZSBxdWljayBmaXggd2FzIHJ1bicgfTtcblx0XHRcdGNvbW1lbnQ6ICdUZXJtaW5hbCBxdWljayBmaXhlcyc7XG5cdFx0fTtcblx0XHR0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlPy5wdWJsaWNMb2cyPFF1aWNrRml4UmVzdWx0VGVsZW1ldHJ5RXZlbnQsIFF1aWNrRml4Q2xhc3NpZmljYXRpb24+KCd0ZXJtaW5hbC9xdWljay1maXgnLCB7XG5cdFx0XHRxdWlja0ZpeElkOiBpZCxcblx0XHRcdHJhblF1aWNrRml4OiB0aGlzLl9kaWRSdW5cblx0XHR9KTtcblx0XHR0aGlzLl9kZWNvcmF0aW9uLmNsZWFyKCk7XG5cdFx0dGhpcy5fZGVjb3JhdGlvbkRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5fb25EaWRVcGRhdGVRdWlja0ZpeGVzLmZpcmUoeyBjb21tYW5kLCBhY3Rpb25zOiB0aGlzLl9xdWlja0ZpeGVzIH0pO1xuXHRcdHRoaXMuX3F1aWNrRml4ZXMgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fbGFzdFF1aWNrRml4SWQgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fZGlkUnVuID0gZmFsc2U7XG5cdH1cblxuXHQvKipcblx0ICogUmVnaXN0ZXJzIGEgZGVjb3JhdGlvbiB3aXRoIHRoZSBxdWljayBmaXhlc1xuXHQgKi9cblx0cHJpdmF0ZSBfcmVnaXN0ZXJRdWlja0ZpeERlY29yYXRpb24oKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLl90ZXJtaW5hbCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMuX2RlY29yYXRpb24uY2xlYXIoKTtcblx0XHR0aGlzLl9kZWNvcmF0aW9uRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRjb25zdCBxdWlja0ZpeGVzID0gdGhpcy5fcXVpY2tGaXhlcztcblx0XHRpZiAoIXF1aWNrRml4ZXMgfHwgcXVpY2tGaXhlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgbWFya2VyID0gdGhpcy5fdGVybWluYWwucmVnaXN0ZXJNYXJrZXIoKTtcblx0XHRpZiAoIW1hcmtlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBkZWNvcmF0aW9uID0gdGhpcy5fZGVjb3JhdGlvbi52YWx1ZSA9IHRoaXMuX3Rlcm1pbmFsLnJlZ2lzdGVyRGVjb3JhdGlvbih7IG1hcmtlciwgd2lkdGg6IDIsIGxheWVyOiAndG9wJyB9KTtcblx0XHRpZiAoIWRlY29yYXRpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3Qgc3RvcmUgPSB0aGlzLl9kZWNvcmF0aW9uRGlzcG9zYWJsZXMudmFsdWUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0c3RvcmUuYWRkKGRlY29yYXRpb24ub25SZW5kZXIoZSA9PiB7XG5cdFx0XHRjb25zdCByZWN0ID0gZS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRcdGNvbnN0IGFuY2hvciA9IHtcblx0XHRcdFx0eDogcmVjdC54LFxuXHRcdFx0XHR5OiByZWN0LnksXG5cdFx0XHRcdHdpZHRoOiByZWN0LndpZHRoLFxuXHRcdFx0XHRoZWlnaHQ6IHJlY3QuaGVpZ2h0XG5cdFx0XHR9O1xuXG5cdFx0XHRpZiAoZS5jbGFzc0xpc3QuY29udGFpbnMoUXVpY2tGaXhEZWNvcmF0aW9uU2VsZWN0b3IuUXVpY2tGaXgpKSB7XG5cdFx0XHRcdGlmICh0aGlzLl9jdXJyZW50UmVuZGVyQ29udGV4dCkge1xuXHRcdFx0XHRcdHRoaXMuX2N1cnJlbnRSZW5kZXJDb250ZXh0LmFuY2hvciA9IGFuY2hvcjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0ZS5jbGFzc0xpc3QuYWRkKC4uLnF1aWNrRml4Q2xhc3Nlcyk7XG5cdFx0XHRjb25zdCBpc0V4cGxhaW5Pbmx5ID0gcXVpY2tGaXhlcy5ldmVyeShlID0+IGUua2luZCA9PT0gJ2V4cGxhaW4nKTtcblx0XHRcdGlmIChpc0V4cGxhaW5Pbmx5KSB7XG5cdFx0XHRcdGUuY2xhc3NMaXN0LmFkZCgnZXhwbGFpbk9ubHknKTtcblx0XHRcdH1cblx0XHRcdGUuY2xhc3NMaXN0LmFkZCguLi5UaGVtZUljb24uYXNDbGFzc05hbWVBcnJheShpc0V4cGxhaW5Pbmx5ID8gQ29kaWNvbi5zcGFya2xlIDogQ29kaWNvbi5saWdodEJ1bGIpKTtcblxuXHRcdFx0dXBkYXRlTGF5b3V0KHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLCBlKTtcblx0XHRcdHRoaXMuX2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLnBsYXlTaWduYWwoQWNjZXNzaWJpbGl0eVNpZ25hbC50ZXJtaW5hbFF1aWNrRml4KTtcblxuXHRcdFx0Y29uc3QgcGFyZW50RWxlbWVudCA9IGUuY2xvc2VzdCgnLnh0ZXJtJyk/LnBhcmVudEVsZW1lbnQ7XG5cdFx0XHRpZiAoIXBhcmVudEVsZW1lbnQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9jdXJyZW50UmVuZGVyQ29udGV4dCA9IHsgcXVpY2tGaXhlcywgYW5jaG9yLCBwYXJlbnRFbGVtZW50IH07XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGUsIGRvbS5FdmVudFR5cGUuQ0xJQ0ssICgpID0+IHRoaXMuc2hvd01lbnUoKSkpO1xuXHRcdH0pKTtcblx0XHRzdG9yZS5hZGQoZGVjb3JhdGlvbi5vbkRpc3Bvc2UoKCkgPT4gdGhpcy5fY3VycmVudFJlbmRlckNvbnRleHQgPSB1bmRlZmluZWQpKTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUZXJtaW5hbEFjdGlvbiBleHRlbmRzIElBY3Rpb24ge1xuXHR0eXBlOiBUZXJtaW5hbFF1aWNrRml4VHlwZTtcblx0a2luZD86ICdmaXgnIHwgJ2V4cGxhaW4nO1xuXHRzb3VyY2U6IHN0cmluZztcblx0dXJpPzogVVJJO1xuXHRjb21tYW5kPzogc3RyaW5nO1xuXHRzaG91bGRFeGVjdXRlPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldFF1aWNrRml4ZXNGb3JDb21tYW5kKFxuXHRhbGlhc2VzOiBzdHJpbmdbXVtdIHwgdW5kZWZpbmVkLFxuXHR0ZXJtaW5hbDogVGVybWluYWwsXG5cdHRlcm1pbmFsQ29tbWFuZDogSVRlcm1pbmFsQ29tbWFuZCxcblx0cXVpY2tGaXhPcHRpb25zOiBNYXA8c3RyaW5nLCBJVGVybWluYWxRdWlja0ZpeE9wdGlvbnNbXT4sXG5cdGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdG9uRGlkUmVxdWVzdFJlcnVuQ29tbWFuZD86IEVtaXR0ZXI8eyBjb21tYW5kOiBzdHJpbmc7IHNob3VsZEV4ZWN1dGU/OiBib29sZWFuIH0+LFxuXHRnZXRSZXNvbHZlZEZpeGVzPzogKHNlbGVjdG9yOiBJVGVybWluYWxRdWlja0ZpeE9wdGlvbnMsIGxpbmVzPzogc3RyaW5nW10pID0+IFByb21pc2U8SVRlcm1pbmFsUXVpY2tGaXggfCBJVGVybWluYWxRdWlja0ZpeFtdIHwgdW5kZWZpbmVkPlxuKTogUHJvbWlzZTxJVGVybWluYWxBY3Rpb25bXSB8IHVuZGVmaW5lZD4ge1xuXHQvLyBQcmV2ZW50IGR1cGxpY2F0ZXMgYnkgdHJhY2tpbmcgYWRkZWQgZW50cmllc1xuXHRjb25zdCBjb21tYW5kUXVpY2tGaXhTZXQ6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpO1xuXHRjb25zdCBvcGVuUXVpY2tGaXhTZXQ6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpO1xuXG5cdGNvbnN0IGZpeGVzOiBJVGVybWluYWxBY3Rpb25bXSA9IFtdO1xuXHRjb25zdCBuZXdDb21tYW5kID0gdGVybWluYWxDb21tYW5kLmNvbW1hbmQ7XG5cdGZvciAoY29uc3Qgb3B0aW9ucyBvZiBxdWlja0ZpeE9wdGlvbnMudmFsdWVzKCkpIHtcblx0XHRmb3IgKGNvbnN0IG9wdGlvbiBvZiBvcHRpb25zKSB7XG5cdFx0XHRpZiAoKG9wdGlvbi5jb21tYW5kRXhpdFJlc3VsdCA9PT0gJ3N1Y2Nlc3MnICYmIHRlcm1pbmFsQ29tbWFuZC5leGl0Q29kZSAhPT0gMCkgfHwgKG9wdGlvbi5jb21tYW5kRXhpdFJlc3VsdCA9PT0gJ2Vycm9yJyAmJiB0ZXJtaW5hbENvbW1hbmQuZXhpdENvZGUgPT09IDApKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0bGV0IHF1aWNrRml4ZXM7XG5cdFx0XHRpZiAob3B0aW9uLnR5cGUgPT09ICdyZXNvbHZlZCcpIHtcblx0XHRcdFx0cXVpY2tGaXhlcyA9IGF3YWl0IChvcHRpb24gYXMgSVRlcm1pbmFsUXVpY2tGaXhSZXNvbHZlZEV4dGVuc2lvbk9wdGlvbnMpLmdldFF1aWNrRml4ZXModGVybWluYWxDb21tYW5kLCBnZXRMaW5lc0ZvckNvbW1hbmQodGVybWluYWwuYnVmZmVyLmFjdGl2ZSwgdGVybWluYWxDb21tYW5kLCB0ZXJtaW5hbC5jb2xzLCBvcHRpb24ub3V0cHV0TWF0Y2hlciksIG9wdGlvbiwgbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCkudG9rZW4pO1xuXHRcdFx0fSBlbHNlIGlmIChvcHRpb24udHlwZSA9PT0gJ3VucmVzb2x2ZWQnKSB7XG5cdFx0XHRcdGlmICghZ2V0UmVzb2x2ZWRGaXhlcykge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignTm8gcmVzb2x2ZWQgZml4IHByb3ZpZGVyJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cXVpY2tGaXhlcyA9IGF3YWl0IGdldFJlc29sdmVkRml4ZXMob3B0aW9uLCBvcHRpb24ub3V0cHV0TWF0Y2hlciA/IGdldExpbmVzRm9yQ29tbWFuZCh0ZXJtaW5hbC5idWZmZXIuYWN0aXZlLCB0ZXJtaW5hbENvbW1hbmQsIHRlcm1pbmFsLmNvbHMsIG9wdGlvbi5vdXRwdXRNYXRjaGVyKSA6IHVuZGVmaW5lZCk7XG5cdFx0XHR9IGVsc2UgaWYgKG9wdGlvbi50eXBlID09PSAnaW50ZXJuYWwnKSB7XG5cdFx0XHRcdGNvbnN0IGNvbW1hbmRMaW5lTWF0Y2ggPSBuZXdDb21tYW5kLm1hdGNoKG9wdGlvbi5jb21tYW5kTGluZU1hdGNoZXIpO1xuXHRcdFx0XHRpZiAoIWNvbW1hbmRMaW5lTWF0Y2gpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBvdXRwdXRNYXRjaGVyID0gb3B0aW9uLm91dHB1dE1hdGNoZXI7XG5cdFx0XHRcdGxldCBvdXRwdXRNYXRjaDtcblx0XHRcdFx0aWYgKG91dHB1dE1hdGNoZXIpIHtcblx0XHRcdFx0XHRvdXRwdXRNYXRjaCA9IHRlcm1pbmFsQ29tbWFuZC5nZXRPdXRwdXRNYXRjaChvdXRwdXRNYXRjaGVyKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIW91dHB1dE1hdGNoKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgbWF0Y2hSZXN1bHQgPSB7IGNvbW1hbmRMaW5lTWF0Y2gsIG91dHB1dE1hdGNoLCBjb21tYW5kTGluZTogdGVybWluYWxDb21tYW5kLmNvbW1hbmQgfTtcblx0XHRcdFx0cXVpY2tGaXhlcyA9IChvcHRpb24gYXMgSVRlcm1pbmFsUXVpY2tGaXhJbnRlcm5hbE9wdGlvbnMpLmdldFF1aWNrRml4ZXMobWF0Y2hSZXN1bHQpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAocXVpY2tGaXhlcykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHF1aWNrRml4IG9mIGFzQXJyYXkocXVpY2tGaXhlcykpIHtcblx0XHRcdFx0XHRsZXQgYWN0aW9uOiBJVGVybWluYWxBY3Rpb24gfCB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0aWYgKCd0eXBlJyBpbiBxdWlja0ZpeCkge1xuXHRcdFx0XHRcdFx0c3dpdGNoIChxdWlja0ZpeC50eXBlKSB7XG5cdFx0XHRcdFx0XHRcdGNhc2UgVGVybWluYWxRdWlja0ZpeFR5cGUuVGVybWluYWxDb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgZml4ID0gcXVpY2tGaXggYXMgSVRlcm1pbmFsUXVpY2tGaXhUZXJtaW5hbENvbW1hbmRBY3Rpb247XG5cdFx0XHRcdFx0XHRcdFx0aWYgKGNvbW1hbmRRdWlja0ZpeFNldC5oYXMoZml4LnRlcm1pbmFsQ29tbWFuZCkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHRjb21tYW5kUXVpY2tGaXhTZXQuYWRkKGZpeC50ZXJtaW5hbENvbW1hbmQpO1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGxhYmVsID0gbG9jYWxpemUoJ3F1aWNrRml4LmNvbW1hbmQnLCAnUnVuOiB7MH0nLCBmaXgudGVybWluYWxDb21tYW5kKTtcblx0XHRcdFx0XHRcdFx0XHRhY3Rpb24gPSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiBUZXJtaW5hbFF1aWNrRml4VHlwZS5UZXJtaW5hbENvbW1hbmQsXG5cdFx0XHRcdFx0XHRcdFx0XHRraW5kOiBvcHRpb24ua2luZCxcblx0XHRcdFx0XHRcdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdFx0XHRzb3VyY2U6IHF1aWNrRml4LnNvdXJjZSxcblx0XHRcdFx0XHRcdFx0XHRcdGlkOiBxdWlja0ZpeC5pZCxcblx0XHRcdFx0XHRcdFx0XHRcdGxhYmVsLFxuXHRcdFx0XHRcdFx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRvbkRpZFJlcXVlc3RSZXJ1bkNvbW1hbmQ/LmZpcmUoe1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbW1hbmQ6IGZpeC50ZXJtaW5hbENvbW1hbmQsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0c2hvdWxkRXhlY3V0ZTogZml4LnNob3VsZEV4ZWN1dGUgPz8gdHJ1ZVxuXHRcdFx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XHR0b29sdGlwOiBsYWJlbCxcblx0XHRcdFx0XHRcdFx0XHRcdGNvbW1hbmQ6IGZpeC50ZXJtaW5hbENvbW1hbmQsXG5cdFx0XHRcdFx0XHRcdFx0XHRzaG91bGRFeGVjdXRlOiBmaXguc2hvdWxkRXhlY3V0ZVxuXHRcdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0Y2FzZSBUZXJtaW5hbFF1aWNrRml4VHlwZS5PcGVuZXI6IHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBmaXggPSBxdWlja0ZpeCBhcyBJVGVybWluYWxRdWlja0ZpeE9wZW5lckFjdGlvbjtcblx0XHRcdFx0XHRcdFx0XHRpZiAoIWZpeC51cmkpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0aWYgKG9wZW5RdWlja0ZpeFNldC5oYXMoZml4LnVyaS50b1N0cmluZygpKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdG9wZW5RdWlja0ZpeFNldC5hZGQoZml4LnVyaS50b1N0cmluZygpKTtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBpc1VybCA9IChmaXgudXJpLnNjaGVtZSA9PT0gU2NoZW1hcy5odHRwIHx8IGZpeC51cmkuc2NoZW1lID09PSBTY2hlbWFzLmh0dHBzKTtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCB1cmlMYWJlbCA9IGlzVXJsID8gZW5jb2RlVVJJKGZpeC51cmkudG9TdHJpbmcodHJ1ZSkpIDogbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGZpeC51cmkpO1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGxhYmVsID0gbG9jYWxpemUoJ3F1aWNrRml4Lm9wZW5lcicsICdPcGVuOiB7MH0nLCB1cmlMYWJlbCk7XG5cdFx0XHRcdFx0XHRcdFx0YWN0aW9uID0ge1xuXHRcdFx0XHRcdFx0XHRcdFx0c291cmNlOiBxdWlja0ZpeC5zb3VyY2UsXG5cdFx0XHRcdFx0XHRcdFx0XHRpZDogcXVpY2tGaXguaWQsXG5cdFx0XHRcdFx0XHRcdFx0XHRsYWJlbCxcblx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6IFRlcm1pbmFsUXVpY2tGaXhUeXBlLk9wZW5lcixcblx0XHRcdFx0XHRcdFx0XHRcdGtpbmQ6IG9wdGlvbi5raW5kLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y2xhc3M6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHRcdFx0XHRcdFx0XHRydW46ICgpID0+IG9wZW5lclNlcnZpY2Uub3BlbihmaXgudXJpKSxcblx0XHRcdFx0XHRcdFx0XHRcdHRvb2x0aXA6IGxhYmVsLFxuXHRcdFx0XHRcdFx0XHRcdFx0dXJpOiBmaXgudXJpXG5cdFx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRjYXNlIFRlcm1pbmFsUXVpY2tGaXhUeXBlLlBvcnQ6IHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBmaXggPSBxdWlja0ZpeCBhcyBJVGVybWluYWxBY3Rpb247XG5cdFx0XHRcdFx0XHRcdFx0YWN0aW9uID0ge1xuXHRcdFx0XHRcdFx0XHRcdFx0c291cmNlOiAnYnVpbHRpbicsXG5cdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiBmaXgudHlwZSxcblx0XHRcdFx0XHRcdFx0XHRcdGtpbmQ6IG9wdGlvbi5raW5kLFxuXHRcdFx0XHRcdFx0XHRcdFx0aWQ6IGZpeC5pZCxcblx0XHRcdFx0XHRcdFx0XHRcdGxhYmVsOiBmaXgubGFiZWwsXG5cdFx0XHRcdFx0XHRcdFx0XHRjbGFzczogZml4LmNsYXNzLFxuXHRcdFx0XHRcdFx0XHRcdFx0ZW5hYmxlZDogZml4LmVuYWJsZWQsXG5cdFx0XHRcdFx0XHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0Zml4LnJ1bigpO1xuXHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdHRvb2x0aXA6IGZpeC50b29sdGlwXG5cdFx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRjYXNlIFRlcm1pbmFsUXVpY2tGaXhUeXBlLlZzY29kZUNvbW1hbmQ6IHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBmaXggPSBxdWlja0ZpeCBhcyBJVGVybWluYWxRdWlja0ZpeENvbW1hbmRBY3Rpb247XG5cdFx0XHRcdFx0XHRcdFx0YWN0aW9uID0ge1xuXHRcdFx0XHRcdFx0XHRcdFx0c291cmNlOiBxdWlja0ZpeC5zb3VyY2UsXG5cdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiBmaXgudHlwZSxcblx0XHRcdFx0XHRcdFx0XHRcdGtpbmQ6IG9wdGlvbi5raW5kLFxuXHRcdFx0XHRcdFx0XHRcdFx0aWQ6IGZpeC5pZCxcblx0XHRcdFx0XHRcdFx0XHRcdGxhYmVsOiBmaXgudGl0bGUsXG5cdFx0XHRcdFx0XHRcdFx0XHRjbGFzczogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoZml4LmlkKSxcblx0XHRcdFx0XHRcdFx0XHRcdHRvb2x0aXA6IGZpeC50aXRsZVxuXHRcdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmIChhY3Rpb24pIHtcblx0XHRcdFx0XHRcdFx0Zml4ZXMucHVzaChhY3Rpb24pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRyZXR1cm4gZml4ZXMubGVuZ3RoID4gMCA/IGZpeGVzIDogdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBjb252ZXJ0VG9RdWlja0ZpeE9wdGlvbnMoc2VsZWN0b3JQcm92aWRlcjogSVRlcm1pbmFsUXVpY2tGaXhQcm92aWRlclNlbGVjdG9yKTogSVRlcm1pbmFsUXVpY2tGaXhSZXNvbHZlZEV4dGVuc2lvbk9wdGlvbnMge1xuXHRyZXR1cm4ge1xuXHRcdGlkOiBzZWxlY3RvclByb3ZpZGVyLnNlbGVjdG9yLmlkLFxuXHRcdHR5cGU6ICdyZXNvbHZlZCcsXG5cdFx0Y29tbWFuZExpbmVNYXRjaGVyOiBzZWxlY3RvclByb3ZpZGVyLnNlbGVjdG9yLmNvbW1hbmRMaW5lTWF0Y2hlcixcblx0XHRvdXRwdXRNYXRjaGVyOiBzZWxlY3RvclByb3ZpZGVyLnNlbGVjdG9yLm91dHB1dE1hdGNoZXIsXG5cdFx0Y29tbWFuZEV4aXRSZXN1bHQ6IHNlbGVjdG9yUHJvdmlkZXIuc2VsZWN0b3IuY29tbWFuZEV4aXRSZXN1bHQsXG5cdFx0a2luZDogc2VsZWN0b3JQcm92aWRlci5zZWxlY3Rvci5raW5kLFxuXHRcdGdldFF1aWNrRml4ZXM6IHNlbGVjdG9yUHJvdmlkZXIucHJvdmlkZXIucHJvdmlkZVRlcm1pbmFsUXVpY2tGaXhlc1xuXHR9O1xufVxuXG5jbGFzcyBUZXJtaW5hbFF1aWNrRml4SXRlbSB7XG5cdHJlYWRvbmx5IGRpc2FibGVkID0gZmFsc2U7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IGFjdGlvbjogSVRlcm1pbmFsQWN0aW9uLFxuXHRcdHJlYWRvbmx5IHR5cGU6IFRlcm1pbmFsUXVpY2tGaXhUeXBlLFxuXHRcdHJlYWRvbmx5IHNvdXJjZTogc3RyaW5nLFxuXHRcdHJlYWRvbmx5IHRpdGxlOiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0cmVhZG9ubHkga2luZDogJ2ZpeCcgfCAnZXhwbGFpbicgPSAnZml4J1xuXHQpIHtcblx0fVxufVxuXG5mdW5jdGlvbiB0b0FjdGlvbldpZGdldEl0ZW1zKGlucHV0UXVpY2tGaXhlczogcmVhZG9ubHkgVGVybWluYWxRdWlja0ZpeEl0ZW1bXSwgc2hvd0hlYWRlcnM6IGJvb2xlYW4pOiBJQWN0aW9uTGlzdEl0ZW08VGVybWluYWxRdWlja0ZpeEl0ZW0+W10ge1xuXHRjb25zdCBtZW51SXRlbXM6IElBY3Rpb25MaXN0SXRlbTxUZXJtaW5hbFF1aWNrRml4SXRlbT5bXSA9IFtdO1xuXHRtZW51SXRlbXMucHVzaCh7XG5cdFx0a2luZDogQWN0aW9uTGlzdEl0ZW1LaW5kLkhlYWRlcixcblx0XHRncm91cDoge1xuXHRcdFx0a2luZDogQ29kZUFjdGlvbktpbmQuUXVpY2tGaXgsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ2NvZGVBY3Rpb24ud2lkZ2V0LmlkLnF1aWNrZml4JywgJ1F1aWNrIEZpeCcpXG5cdFx0fVxuXHR9KTtcblx0Zm9yIChjb25zdCBxdWlja0ZpeCBvZiBzaG93SGVhZGVycyA/IGlucHV0UXVpY2tGaXhlcyA6IGlucHV0UXVpY2tGaXhlcy5maWx0ZXIoaSA9PiAhIWkuYWN0aW9uKSkge1xuXHRcdGlmICghcXVpY2tGaXguZGlzYWJsZWQgJiYgcXVpY2tGaXguYWN0aW9uKSB7XG5cdFx0XHRtZW51SXRlbXMucHVzaCh7XG5cdFx0XHRcdGtpbmQ6IEFjdGlvbkxpc3RJdGVtS2luZC5BY3Rpb24sXG5cdFx0XHRcdGl0ZW06IHF1aWNrRml4LFxuXHRcdFx0XHRncm91cDoge1xuXHRcdFx0XHRcdGtpbmQ6IENvZGVBY3Rpb25LaW5kLlF1aWNrRml4LFxuXHRcdFx0XHRcdGljb246IGdldFF1aWNrRml4SWNvbihxdWlja0ZpeCksXG5cdFx0XHRcdFx0dGl0bGU6IHF1aWNrRml4LmFjdGlvbi5sYWJlbFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRkaXNhYmxlZDogZmFsc2UsXG5cdFx0XHRcdGxhYmVsOiBxdWlja0ZpeC50aXRsZVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBtZW51SXRlbXM7XG59XG5cbmZ1bmN0aW9uIGdldFF1aWNrRml4SWNvbihxdWlja0ZpeDogVGVybWluYWxRdWlja0ZpeEl0ZW0pOiBUaGVtZUljb24ge1xuXHRpZiAocXVpY2tGaXgua2luZCA9PT0gJ2V4cGxhaW4nKSB7XG5cdFx0cmV0dXJuIENvZGljb24uc3BhcmtsZTtcblx0fVxuXHRzd2l0Y2ggKHF1aWNrRml4LnR5cGUpIHtcblx0XHRjYXNlIFRlcm1pbmFsUXVpY2tGaXhUeXBlLk9wZW5lcjpcblx0XHRcdGlmICgndXJpJyBpbiBxdWlja0ZpeC5hY3Rpb24gJiYgcXVpY2tGaXguYWN0aW9uLnVyaSkge1xuXHRcdFx0XHRjb25zdCBpc1VybCA9IChxdWlja0ZpeC5hY3Rpb24udXJpLnNjaGVtZSA9PT0gU2NoZW1hcy5odHRwIHx8IHF1aWNrRml4LmFjdGlvbi51cmkuc2NoZW1lID09PSBTY2hlbWFzLmh0dHBzKTtcblx0XHRcdFx0cmV0dXJuIGlzVXJsID8gQ29kaWNvbi5saW5rRXh0ZXJuYWwgOiBDb2RpY29uLmdvVG9GaWxlO1xuXHRcdFx0fVxuXHRcdGNhc2UgVGVybWluYWxRdWlja0ZpeFR5cGUuVGVybWluYWxDb21tYW5kOlxuXHRcdFx0cmV0dXJuIENvZGljb24ucnVuO1xuXHRcdGNhc2UgVGVybWluYWxRdWlja0ZpeFR5cGUuUG9ydDpcblx0XHRcdHJldHVybiBDb2RpY29uLmRlYnVnRGlzY29ubmVjdDtcblx0XHRjYXNlIFRlcm1pbmFsUXVpY2tGaXhUeXBlLlZzY29kZUNvbW1hbmQ6XG5cdFx0XHRyZXR1cm4gQ29kaWNvbi5saWdodGJ1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
