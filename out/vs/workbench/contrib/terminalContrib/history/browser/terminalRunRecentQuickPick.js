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
import { Toggle } from "../../../../../base/browser/ui/toggle/toggle.js";
import { isMacintosh, OperatingSystem } from "../../../../../base/common/platform.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { localize } from "../../../../../nls.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { collapseTildePath } from "../../../../../platform/terminal/common/terminalEnvironment.js";
import { asCssVariable, inputActiveOptionBackground, inputActiveOptionBorder, inputActiveOptionForeground } from "../../../../../platform/theme/common/colorRegistry.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { commandHistoryFuzzySearchIcon, commandHistoryOpenFileIcon, commandHistoryOutputIcon, commandHistoryRemoveIcon } from "../../../terminal/browser/terminalIcons.js";
import { TerminalStorageKeys } from "../../../terminal/common/terminalStorageKeys.js";
import { terminalStrings } from "../../../terminal/common/terminalStrings.js";
import { URI } from "../../../../../base/common/uri.js";
import { fromNow } from "../../../../../base/common/date.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { showWithPinnedItems } from "../../../../../platform/quickinput/browser/quickPickPin.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { AccessibleViewProviderId, IAccessibleViewService } from "../../../../../platform/accessibility/browser/accessibleView.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { getCommandHistory, getDirectoryHistory, getShellFileHistory } from "../common/history.js";
async function showRunRecentQuickPick(accessor, instance, terminalInRunCommandPicker, type, filterMode, value) {
  if (!instance.xterm) {
    return;
  }
  const accessibleViewService = accessor.get(IAccessibleViewService);
  const editorService = accessor.get(IEditorService);
  const instantiationService = accessor.get(IInstantiationService);
  const quickInputService = accessor.get(IQuickInputService);
  const storageService = accessor.get(IStorageService);
  const runRecentStorageKey = `${TerminalStorageKeys.PinnedRecentCommandsPrefix}.${instance.shellType}`;
  let placeholder;
  let items = [];
  const commandMap = /* @__PURE__ */ new Set();
  const removeFromCommandHistoryButton = {
    iconClass: ThemeIcon.asClassName(commandHistoryRemoveIcon),
    tooltip: localize("removeCommand", "Remove from Command History")
  };
  const commandOutputButton = {
    iconClass: ThemeIcon.asClassName(commandHistoryOutputIcon),
    tooltip: localize("viewCommandOutput", "View Command Output"),
    alwaysVisible: false
  };
  const openResourceButtons = [];
  if (type === "command") {
    let formatLabel2 = function(label) {
      return label.replace(/\r?\n/g, "\u23CE").replace(/\s\s\s+/g, "\u22EF");
    };
    var formatLabel = formatLabel2;
    placeholder = isMacintosh ? localize("selectRecentCommandMac", "Select a command to run (hold Option-key to edit the command)") : localize("selectRecentCommand", "Select a command to run (hold Alt-key to edit the command)");
    const cmdDetection = instance.capabilities.get(TerminalCapability.CommandDetection);
    const commands = cmdDetection?.commands;
    const executingCommand = cmdDetection?.executingCommand;
    if (executingCommand) {
      commandMap.add(executingCommand);
    }
    if (commands && commands.length > 0) {
      for (const entry of commands) {
        const label = entry.command.trim();
        if (label.length === 0 || commandMap.has(label)) {
          continue;
        }
        let description = collapseTildePath(entry.cwd, instance.userHome, instance.os === OperatingSystem.Windows ? "\\" : "/");
        if (entry.exitCode) {
          if (entry.exitCode === -1) {
            description += " failed";
          } else {
            description += ` exitCode: ${entry.exitCode}`;
          }
        }
        description = description.trim();
        const buttons = [commandOutputButton];
        const lastItem = items.length > 0 ? items[items.length - 1] : void 0;
        if (lastItem?.type !== "separator" && lastItem?.label === label) {
          lastItem.id = entry.timestamp.toString();
          lastItem.description = description;
          continue;
        }
        items.push({
          label: formatLabel2(label),
          rawLabel: label,
          description,
          id: entry.timestamp.toString(),
          command: entry,
          buttons: entry.hasOutput() ? buttons : void 0
        });
        commandMap.add(label);
      }
      items = items.reverse();
    }
    if (executingCommand) {
      items.unshift({
        label: formatLabel2(executingCommand),
        rawLabel: executingCommand,
        description: cmdDetection.cwd
      });
    }
    if (items.length > 0) {
      items.unshift({
        type: "separator",
        buttons: [],
        // HACK: Force full sized separators as there's no flag currently
        label: terminalStrings.currentSessionCategory
      });
    }
    const history = instantiationService.invokeFunction(getCommandHistory);
    const previousSessionItems = [];
    for (const [label, info] of history.entries) {
      if (!commandMap.has(label) && info.shellType === instance.shellType) {
        previousSessionItems.unshift({
          label: formatLabel2(label),
          rawLabel: label,
          buttons: [removeFromCommandHistoryButton]
        });
        commandMap.add(label);
      }
    }
    if (previousSessionItems.length > 0) {
      items.push(
        {
          type: "separator",
          buttons: [],
          // HACK: Force full sized separators as there's no flag currently
          label: terminalStrings.previousSessionCategory
        },
        ...previousSessionItems
      );
    }
    const shellFileHistory = await instantiationService.invokeFunction(getShellFileHistory, instance.shellType);
    if (shellFileHistory !== void 0) {
      const dedupedShellFileItems = [];
      for (const label of shellFileHistory.commands) {
        if (!commandMap.has(label)) {
          dedupedShellFileItems.unshift({
            label: formatLabel2(label),
            rawLabel: label
          });
        }
      }
      if (dedupedShellFileItems.length > 0) {
        const button = {
          iconClass: ThemeIcon.asClassName(commandHistoryOpenFileIcon),
          tooltip: localize("openShellHistoryFile", "Open File"),
          alwaysVisible: false,
          resource: shellFileHistory.sourceResource
        };
        openResourceButtons.push(button);
        items.push(
          {
            type: "separator",
            buttons: [button],
            label: localize("shellFileHistoryCategory", "{0} history", instance.shellType),
            description: shellFileHistory.sourceLabel
          },
          ...dedupedShellFileItems
        );
      }
    }
  } else {
    placeholder = isMacintosh ? localize("selectRecentDirectoryMac", "Select a directory to go to (hold Option-key to edit the command)") : localize("selectRecentDirectory", "Select a directory to go to (hold Alt-key to edit the command)");
    const cwds = instance.capabilities.get(TerminalCapability.CwdDetection)?.cwds || [];
    if (cwds && cwds.length > 0) {
      for (const label of cwds) {
        items.push({ label, rawLabel: label });
      }
      items = items.reverse();
      items.unshift({ type: "separator", label: terminalStrings.currentSessionCategory });
    }
    const history = instantiationService.invokeFunction(getDirectoryHistory);
    const previousSessionItems = [];
    for (const [label, info] of history.entries) {
      if ((info === null || info.remoteAuthority === instance.remoteAuthority) && !cwds.includes(label)) {
        previousSessionItems.unshift({
          label,
          rawLabel: label,
          buttons: [removeFromCommandHistoryButton]
        });
      }
    }
    if (previousSessionItems.length > 0) {
      items.push(
        { type: "separator", label: terminalStrings.previousSessionCategory },
        ...previousSessionItems
      );
    }
  }
  if (items.length === 0) {
    return;
  }
  const disposables = new DisposableStore();
  const fuzzySearchToggle = disposables.add(new Toggle({
    title: "Fuzzy search",
    icon: commandHistoryFuzzySearchIcon,
    isChecked: filterMode === "fuzzy",
    inputActiveOptionBorder: asCssVariable(inputActiveOptionBorder),
    inputActiveOptionForeground: asCssVariable(inputActiveOptionForeground),
    inputActiveOptionBackground: asCssVariable(inputActiveOptionBackground)
  }));
  disposables.add(fuzzySearchToggle.onChange(() => {
    instantiationService.invokeFunction(showRunRecentQuickPick, instance, terminalInRunCommandPicker, type, fuzzySearchToggle.checked ? "fuzzy" : "contiguous", quickPick.value);
  }));
  const outputProvider = disposables.add(instantiationService.createInstance(TerminalOutputProvider));
  const quickPick = disposables.add(quickInputService.createQuickPick({ useSeparators: true }));
  const originalItems = items;
  quickPick.items = [...originalItems];
  quickPick.sortByLabel = false;
  quickPick.placeholder = placeholder;
  quickPick.matchOnLabelMode = filterMode || "contiguous";
  quickPick.toggles = [fuzzySearchToggle];
  disposables.add(quickPick.onDidTriggerItemButton(async (e) => {
    if (e.button === removeFromCommandHistoryButton) {
      if (type === "command") {
        instantiationService.invokeFunction(getCommandHistory)?.remove(e.item.label);
      } else {
        instantiationService.invokeFunction(getDirectoryHistory)?.remove(e.item.label);
      }
    } else if (e.button === commandOutputButton) {
      const selectedCommand = e.item.command;
      const output = selectedCommand?.getOutput();
      if (output && selectedCommand?.command) {
        const textContent = await outputProvider.provideTextContent(URI.from(
          {
            scheme: TerminalOutputProvider.scheme,
            path: `${selectedCommand.command}... ${fromNow(selectedCommand.timestamp, true)}`,
            fragment: output,
            query: `terminal-output-${selectedCommand.timestamp}-${instance.instanceId}`
          }
        ));
        if (textContent) {
          await editorService.openEditor({
            resource: textContent.uri
          });
        }
      }
    }
    await instantiationService.invokeFunction(showRunRecentQuickPick, instance, terminalInRunCommandPicker, type, filterMode, value);
  }));
  disposables.add(quickPick.onDidTriggerSeparatorButton(async (e) => {
    const resource = openResourceButtons.find((openResourceButton) => e.button === openResourceButton)?.resource;
    if (resource) {
      await editorService.openEditor({
        resource
      });
    }
  }));
  disposables.add(quickPick.onDidChangeValue(async (value2) => {
    if (!value2) {
      await instantiationService.invokeFunction(showRunRecentQuickPick, instance, terminalInRunCommandPicker, type, filterMode, value2);
    }
  }));
  let terminalScrollStateSaved = false;
  function restoreScrollState() {
    terminalScrollStateSaved = false;
    instance.xterm?.markTracker.restoreScrollState();
    instance.xterm?.markTracker.clear();
  }
  disposables.add(quickPick.onDidChangeActive(async () => {
    const xterm = instance.xterm;
    if (!xterm) {
      return;
    }
    const [item] = quickPick.activeItems;
    if (!item) {
      return;
    }
    if ("command" in item && item.command && item.command.marker) {
      if (!terminalScrollStateSaved) {
        xterm.markTracker.saveScrollState();
        terminalScrollStateSaved = true;
      }
      const promptRowCount = item.command.getPromptRowCount();
      const commandRowCount = item.command.getCommandRowCount();
      xterm.markTracker.revealRange({
        start: {
          x: 1,
          y: item.command.marker.line - (promptRowCount - 1) + 1
        },
        end: {
          x: instance.cols,
          y: item.command.marker.line + (commandRowCount - 1) + 1
        }
      });
    } else {
      restoreScrollState();
    }
  }));
  disposables.add(quickPick.onDidAccept(async () => {
    const result = quickPick.activeItems[0];
    let text;
    if (type === "cwd") {
      text = `cd ${await instance.preparePathForShell(result.rawLabel)}`;
    } else {
      text = result.rawLabel;
    }
    quickPick.hide();
    terminalScrollStateSaved = false;
    instance.xterm?.markTracker.clear();
    instance.scrollToBottom();
    instance.runCommand(text, !quickPick.keyMods.alt);
    if (quickPick.keyMods.alt) {
      instance.focus();
    }
  }));
  disposables.add(quickPick.onDidHide(() => restoreScrollState()));
  if (value) {
    quickPick.value = value;
  }
  return new Promise((r) => {
    terminalInRunCommandPicker.set(true);
    disposables.add(showWithPinnedItems(storageService, runRecentStorageKey, quickPick, true));
    disposables.add(quickPick.onDidHide(() => {
      terminalInRunCommandPicker.set(false);
      accessibleViewService.showLastProvider(AccessibleViewProviderId.Terminal);
      r();
      disposables.dispose();
    }));
  });
}
let TerminalOutputProvider = class extends Disposable {
  constructor(textModelResolverService, _modelService) {
    super();
    this._modelService = _modelService;
    this._register(textModelResolverService.registerTextModelContentProvider(TerminalOutputProvider.scheme, this));
  }
  async provideTextContent(resource) {
    const existing = this._modelService.getModel(resource);
    if (existing && !existing.isDisposed()) {
      return existing;
    }
    return this._modelService.createModel(resource.fragment, null, resource, false);
  }
};
TerminalOutputProvider.scheme = "TERMINAL_OUTPUT";
TerminalOutputProvider = __decorateClass([
  __decorateParam(0, ITextModelService),
  __decorateParam(1, IModelService)
], TerminalOutputProvider);
export {
  showRunRecentQuickPick
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvaGlzdG9yeS9icm93c2VyL3Rlcm1pbmFsUnVuUmVjZW50UXVpY2tQaWNrLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgVG9nZ2xlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RvZ2dsZS90b2dnbGUuanMnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2gsIE9wZXJhdGluZ1N5c3RlbSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIsIElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dEJ1dHRvbiwgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrSXRlbSwgSVF1aWNrUGlja1NlcGFyYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsQ29tbWFuZCwgVGVybWluYWxDYXBhYmlsaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy9jYXBhYmlsaXRpZXMuanMnO1xuaW1wb3J0IHsgY29sbGFwc2VUaWxkZVBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWxFbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBhc0Nzc1ZhcmlhYmxlLCBpbnB1dEFjdGl2ZU9wdGlvbkJhY2tncm91bmQsIGlucHV0QWN0aXZlT3B0aW9uQm9yZGVyLCBpbnB1dEFjdGl2ZU9wdGlvbkZvcmVncm91bmQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsSW5zdGFuY2UgfSBmcm9tICcuLi8uLi8uLi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IGNvbW1hbmRIaXN0b3J5RnV6enlTZWFyY2hJY29uLCBjb21tYW5kSGlzdG9yeU9wZW5GaWxlSWNvbiwgY29tbWFuZEhpc3RvcnlPdXRwdXRJY29uLCBjb21tYW5kSGlzdG9yeVJlbW92ZUljb24gfSBmcm9tICcuLi8uLi8uLi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsSWNvbnMuanMnO1xuaW1wb3J0IHsgVGVybWluYWxTdG9yYWdlS2V5cyB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbFN0b3JhZ2VLZXlzLmpzJztcbmltcG9ydCB7IHRlcm1pbmFsU3RyaW5ncyB9IGZyb20gJy4uLy4uLy4uL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbFN0cmluZ3MuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGZyb21Ob3cgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9kYXRlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHNob3dXaXRoUGlubmVkSXRlbXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2Jyb3dzZXIvcXVpY2tQaWNrUGluLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IEFjY2Vzc2libGVWaWV3UHJvdmlkZXJJZCwgSUFjY2Vzc2libGVWaWV3U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvYnJvd3Nlci9hY2Nlc3NpYmxlVmlldy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZ2V0Q29tbWFuZEhpc3RvcnksIGdldERpcmVjdG9yeUhpc3RvcnksIGdldFNoZWxsRmlsZUhpc3RvcnkgfSBmcm9tICcuLi9jb21tb24vaGlzdG9yeS5qcyc7XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBzaG93UnVuUmVjZW50UXVpY2tQaWNrKFxuXHRhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcixcblx0aW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlLFxuXHR0ZXJtaW5hbEluUnVuQ29tbWFuZFBpY2tlcjogSUNvbnRleHRLZXk8Ym9vbGVhbj4sXG5cdHR5cGU6ICdjb21tYW5kJyB8ICdjd2QnLFxuXHRmaWx0ZXJNb2RlPzogJ2Z1enp5JyB8ICdjb250aWd1b3VzJyxcblx0dmFsdWU/OiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+IHtcblx0aWYgKCFpbnN0YW5jZS54dGVybSkge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGNvbnN0IGFjY2Vzc2libGVWaWV3U2VydmljZSA9IGFjY2Vzc29yLmdldChJQWNjZXNzaWJsZVZpZXdTZXJ2aWNlKTtcblx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdGNvbnN0IHF1aWNrSW5wdXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElRdWlja0lucHV0U2VydmljZSk7XG5cdGNvbnN0IHN0b3JhZ2VTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElTdG9yYWdlU2VydmljZSk7XG5cblx0Y29uc3QgcnVuUmVjZW50U3RvcmFnZUtleSA9IGAke1Rlcm1pbmFsU3RvcmFnZUtleXMuUGlubmVkUmVjZW50Q29tbWFuZHNQcmVmaXh9LiR7aW5zdGFuY2Uuc2hlbGxUeXBlfWA7XG5cdGxldCBwbGFjZWhvbGRlcjogc3RyaW5nO1xuXHR0eXBlIEl0ZW0gPSBJUXVpY2tQaWNrSXRlbSAmIHsgY29tbWFuZD86IElUZXJtaW5hbENvbW1hbmQ7IHJhd0xhYmVsOiBzdHJpbmcgfTtcblx0bGV0IGl0ZW1zOiAoSXRlbSB8IElRdWlja1BpY2tJdGVtICYgeyByYXdMYWJlbDogc3RyaW5nIH0gfCBJUXVpY2tQaWNrU2VwYXJhdG9yKVtdID0gW107XG5cdGNvbnN0IGNvbW1hbmRNYXA6IFNldDxzdHJpbmc+ID0gbmV3IFNldCgpO1xuXG5cdGNvbnN0IHJlbW92ZUZyb21Db21tYW5kSGlzdG9yeUJ1dHRvbjogSVF1aWNrSW5wdXRCdXR0b24gPSB7XG5cdFx0aWNvbkNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoY29tbWFuZEhpc3RvcnlSZW1vdmVJY29uKSxcblx0XHR0b29sdGlwOiBsb2NhbGl6ZSgncmVtb3ZlQ29tbWFuZCcsIFwiUmVtb3ZlIGZyb20gQ29tbWFuZCBIaXN0b3J5XCIpXG5cdH07XG5cblx0Y29uc3QgY29tbWFuZE91dHB1dEJ1dHRvbjogSVF1aWNrSW5wdXRCdXR0b24gPSB7XG5cdFx0aWNvbkNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoY29tbWFuZEhpc3RvcnlPdXRwdXRJY29uKSxcblx0XHR0b29sdGlwOiBsb2NhbGl6ZSgndmlld0NvbW1hbmRPdXRwdXQnLCBcIlZpZXcgQ29tbWFuZCBPdXRwdXRcIiksXG5cdFx0YWx3YXlzVmlzaWJsZTogZmFsc2Vcblx0fTtcblxuXHRjb25zdCBvcGVuUmVzb3VyY2VCdXR0b25zOiAoSVF1aWNrSW5wdXRCdXR0b24gJiB7IHJlc291cmNlOiBVUkkgfSlbXSA9IFtdO1xuXG5cdGlmICh0eXBlID09PSAnY29tbWFuZCcpIHtcblx0XHRwbGFjZWhvbGRlciA9IGlzTWFjaW50b3NoID8gbG9jYWxpemUoJ3NlbGVjdFJlY2VudENvbW1hbmRNYWMnLCAnU2VsZWN0IGEgY29tbWFuZCB0byBydW4gKGhvbGQgT3B0aW9uLWtleSB0byBlZGl0IHRoZSBjb21tYW5kKScpIDogbG9jYWxpemUoJ3NlbGVjdFJlY2VudENvbW1hbmQnLCAnU2VsZWN0IGEgY29tbWFuZCB0byBydW4gKGhvbGQgQWx0LWtleSB0byBlZGl0IHRoZSBjb21tYW5kKScpO1xuXHRcdGNvbnN0IGNtZERldGVjdGlvbiA9IGluc3RhbmNlLmNhcGFiaWxpdGllcy5nZXQoVGVybWluYWxDYXBhYmlsaXR5LkNvbW1hbmREZXRlY3Rpb24pO1xuXHRcdGNvbnN0IGNvbW1hbmRzID0gY21kRGV0ZWN0aW9uPy5jb21tYW5kcztcblx0XHQvLyBDdXJyZW50IHNlc3Npb24gaGlzdG9yeVxuXHRcdGNvbnN0IGV4ZWN1dGluZ0NvbW1hbmQgPSBjbWREZXRlY3Rpb24/LmV4ZWN1dGluZ0NvbW1hbmQ7XG5cdFx0aWYgKGV4ZWN1dGluZ0NvbW1hbmQpIHtcblx0XHRcdGNvbW1hbmRNYXAuYWRkKGV4ZWN1dGluZ0NvbW1hbmQpO1xuXHRcdH1cblx0XHRmdW5jdGlvbiBmb3JtYXRMYWJlbChsYWJlbDogc3RyaW5nKSB7XG5cdFx0XHRyZXR1cm4gbGFiZWxcblx0XHRcdFx0Ly8gUmVwbGFjZSBuZXcgbGluZXMgd2l0aCBcImVudGVyXCIgc3ltYm9sXG5cdFx0XHRcdC5yZXBsYWNlKC9cXHI/XFxuL2csICdcXHUyM0NFJylcblx0XHRcdFx0Ly8gUmVwbGFjZSAzIG9yIG1vcmUgc3BhY2VzIHdpdGggbWlkbGluZSBob3Jpem9udGFsIGVsbGlwc2lzIHdoaWNoIGxvb2tzIHNpbWlsYXJcblx0XHRcdFx0Ly8gdG8gd2hpdGVzcGFjZSBpbiB0aGUgZWRpdG9yXG5cdFx0XHRcdC5yZXBsYWNlKC9cXHNcXHNcXHMrL2csICdcXHUyMkVGJyk7XG5cdFx0fVxuXHRcdGlmIChjb21tYW5kcyAmJiBjb21tYW5kcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGVudHJ5IG9mIGNvbW1hbmRzKSB7XG5cdFx0XHRcdC8vIFRyaW0gb2ZmIGFueSB3aGl0ZXNwYWNlIGFuZC9vciBsaW5lIGVuZGluZ3MsIHJlcGxhY2UgbmV3IGxpbmVzIHdpdGggdGhlXG5cdFx0XHRcdC8vIERvd253YXJkcyBBcnJvdyB3aXRoIENvcm5lciBMZWZ0d2FyZHMgc3ltYm9sXG5cdFx0XHRcdGNvbnN0IGxhYmVsID0gZW50cnkuY29tbWFuZC50cmltKCk7XG5cdFx0XHRcdGlmIChsYWJlbC5sZW5ndGggPT09IDAgfHwgY29tbWFuZE1hcC5oYXMobGFiZWwpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0bGV0IGRlc2NyaXB0aW9uID0gY29sbGFwc2VUaWxkZVBhdGgoZW50cnkuY3dkLCBpbnN0YW5jZS51c2VySG9tZSwgaW5zdGFuY2Uub3MgPT09IE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzID8gJ1xcXFwnIDogJy8nKTtcblx0XHRcdFx0aWYgKGVudHJ5LmV4aXRDb2RlKSB7XG5cdFx0XHRcdFx0Ly8gU2luY2UgeW91IGNhbm5vdCBnZXQgdGhlIGxhc3QgY29tbWFuZCdzIGV4aXQgY29kZSBvbiBwd3NoLCBqdXN0IHdoZXRoZXIgaXQgZmFpbGVkXG5cdFx0XHRcdFx0Ly8gb3Igbm90LCAtMSBpcyB0cmVhdGVkIHNwZWNpYWxseSBhcyBzaW1wbHkgZmFpbGVkXG5cdFx0XHRcdFx0aWYgKGVudHJ5LmV4aXRDb2RlID09PSAtMSkge1xuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb24gKz0gJyBmYWlsZWQnO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbiArPSBgIGV4aXRDb2RlOiAke2VudHJ5LmV4aXRDb2RlfWA7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGRlc2NyaXB0aW9uID0gZGVzY3JpcHRpb24udHJpbSgpO1xuXHRcdFx0XHRjb25zdCBidXR0b25zOiBJUXVpY2tJbnB1dEJ1dHRvbltdID0gW2NvbW1hbmRPdXRwdXRCdXR0b25dO1xuXHRcdFx0XHQvLyBNZXJnZSBjb25zZWN1dGl2ZSBjb21tYW5kc1xuXHRcdFx0XHRjb25zdCBsYXN0SXRlbSA9IGl0ZW1zLmxlbmd0aCA+IDAgPyBpdGVtc1tpdGVtcy5sZW5ndGggLSAxXSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0aWYgKGxhc3RJdGVtPy50eXBlICE9PSAnc2VwYXJhdG9yJyAmJiBsYXN0SXRlbT8ubGFiZWwgPT09IGxhYmVsKSB7XG5cdFx0XHRcdFx0bGFzdEl0ZW0uaWQgPSBlbnRyeS50aW1lc3RhbXAudG9TdHJpbmcoKTtcblx0XHRcdFx0XHRsYXN0SXRlbS5kZXNjcmlwdGlvbiA9IGRlc2NyaXB0aW9uO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGl0ZW1zLnB1c2goe1xuXHRcdFx0XHRcdGxhYmVsOiBmb3JtYXRMYWJlbChsYWJlbCksXG5cdFx0XHRcdFx0cmF3TGFiZWw6IGxhYmVsLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uLFxuXHRcdFx0XHRcdGlkOiBlbnRyeS50aW1lc3RhbXAudG9TdHJpbmcoKSxcblx0XHRcdFx0XHRjb21tYW5kOiBlbnRyeSxcblx0XHRcdFx0XHRidXR0b25zOiBlbnRyeS5oYXNPdXRwdXQoKSA/IGJ1dHRvbnMgOiB1bmRlZmluZWRcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGNvbW1hbmRNYXAuYWRkKGxhYmVsKTtcblx0XHRcdH1cblx0XHRcdGl0ZW1zID0gaXRlbXMucmV2ZXJzZSgpO1xuXHRcdH1cblx0XHRpZiAoZXhlY3V0aW5nQ29tbWFuZCkge1xuXHRcdFx0aXRlbXMudW5zaGlmdCh7XG5cdFx0XHRcdGxhYmVsOiBmb3JtYXRMYWJlbChleGVjdXRpbmdDb21tYW5kKSxcblx0XHRcdFx0cmF3TGFiZWw6IGV4ZWN1dGluZ0NvbW1hbmQsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBjbWREZXRlY3Rpb24uY3dkXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0aWYgKGl0ZW1zLmxlbmd0aCA+IDApIHtcblx0XHRcdGl0ZW1zLnVuc2hpZnQoe1xuXHRcdFx0XHR0eXBlOiAnc2VwYXJhdG9yJyxcblx0XHRcdFx0YnV0dG9uczogW10sIC8vIEhBQ0s6IEZvcmNlIGZ1bGwgc2l6ZWQgc2VwYXJhdG9ycyBhcyB0aGVyZSdzIG5vIGZsYWcgY3VycmVudGx5XG5cdFx0XHRcdGxhYmVsOiB0ZXJtaW5hbFN0cmluZ3MuY3VycmVudFNlc3Npb25DYXRlZ29yeVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0Ly8gR2F0aGVyIHByZXZpb3VzIHNlc3Npb24gaGlzdG9yeVxuXHRcdGNvbnN0IGhpc3RvcnkgPSBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihnZXRDb21tYW5kSGlzdG9yeSk7XG5cdFx0Y29uc3QgcHJldmlvdXNTZXNzaW9uSXRlbXM6IChJUXVpY2tQaWNrSXRlbSAmIHsgcmF3TGFiZWw6IHN0cmluZyB9KVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBbbGFiZWwsIGluZm9dIG9mIGhpc3RvcnkuZW50cmllcykge1xuXHRcdFx0Ly8gT25seSBhZGQgcHJldmlvdXMgc2Vzc2lvbiBpdGVtIGlmIGl0J3Mgbm90IGluIHRoaXMgc2Vzc2lvblxuXHRcdFx0aWYgKCFjb21tYW5kTWFwLmhhcyhsYWJlbCkgJiYgaW5mby5zaGVsbFR5cGUgPT09IGluc3RhbmNlLnNoZWxsVHlwZSkge1xuXHRcdFx0XHRwcmV2aW91c1Nlc3Npb25JdGVtcy51bnNoaWZ0KHtcblx0XHRcdFx0XHRsYWJlbDogZm9ybWF0TGFiZWwobGFiZWwpLFxuXHRcdFx0XHRcdHJhd0xhYmVsOiBsYWJlbCxcblx0XHRcdFx0XHRidXR0b25zOiBbcmVtb3ZlRnJvbUNvbW1hbmRIaXN0b3J5QnV0dG9uXVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0Y29tbWFuZE1hcC5hZGQobGFiZWwpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChwcmV2aW91c1Nlc3Npb25JdGVtcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRpdGVtcy5wdXNoKFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dHlwZTogJ3NlcGFyYXRvcicsXG5cdFx0XHRcdFx0YnV0dG9uczogW10sIC8vIEhBQ0s6IEZvcmNlIGZ1bGwgc2l6ZWQgc2VwYXJhdG9ycyBhcyB0aGVyZSdzIG5vIGZsYWcgY3VycmVudGx5XG5cdFx0XHRcdFx0bGFiZWw6IHRlcm1pbmFsU3RyaW5ncy5wcmV2aW91c1Nlc3Npb25DYXRlZ29yeVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQuLi5wcmV2aW91c1Nlc3Npb25JdGVtcyxcblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0Ly8gR2F0aGVyIHNoZWxsIGZpbGUgaGlzdG9yeVxuXHRcdGNvbnN0IHNoZWxsRmlsZUhpc3RvcnkgPSBhd2FpdCBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihnZXRTaGVsbEZpbGVIaXN0b3J5LCBpbnN0YW5jZS5zaGVsbFR5cGUpO1xuXHRcdGlmIChzaGVsbEZpbGVIaXN0b3J5ICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGNvbnN0IGRlZHVwZWRTaGVsbEZpbGVJdGVtczogKElRdWlja1BpY2tJdGVtICYgeyByYXdMYWJlbDogc3RyaW5nIH0pW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgbGFiZWwgb2Ygc2hlbGxGaWxlSGlzdG9yeS5jb21tYW5kcykge1xuXHRcdFx0XHRpZiAoIWNvbW1hbmRNYXAuaGFzKGxhYmVsKSkge1xuXHRcdFx0XHRcdGRlZHVwZWRTaGVsbEZpbGVJdGVtcy51bnNoaWZ0KHtcblx0XHRcdFx0XHRcdGxhYmVsOiBmb3JtYXRMYWJlbChsYWJlbCksXG5cdFx0XHRcdFx0XHRyYXdMYWJlbDogbGFiZWxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKGRlZHVwZWRTaGVsbEZpbGVJdGVtcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGNvbnN0IGJ1dHRvbjogSVF1aWNrSW5wdXRCdXR0b24gJiB7IHJlc291cmNlOiBVUkkgfSA9IHtcblx0XHRcdFx0XHRpY29uQ2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShjb21tYW5kSGlzdG9yeU9wZW5GaWxlSWNvbiksXG5cdFx0XHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ29wZW5TaGVsbEhpc3RvcnlGaWxlJywgXCJPcGVuIEZpbGVcIiksXG5cdFx0XHRcdFx0YWx3YXlzVmlzaWJsZTogZmFsc2UsXG5cdFx0XHRcdFx0cmVzb3VyY2U6IHNoZWxsRmlsZUhpc3Rvcnkuc291cmNlUmVzb3VyY2Vcblx0XHRcdFx0fTtcblx0XHRcdFx0b3BlblJlc291cmNlQnV0dG9ucy5wdXNoKGJ1dHRvbik7XG5cdFx0XHRcdGl0ZW1zLnB1c2goXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0dHlwZTogJ3NlcGFyYXRvcicsXG5cdFx0XHRcdFx0XHRidXR0b25zOiBbYnV0dG9uXSxcblx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnc2hlbGxGaWxlSGlzdG9yeUNhdGVnb3J5JywgJ3swfSBoaXN0b3J5JywgaW5zdGFuY2Uuc2hlbGxUeXBlKSxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBzaGVsbEZpbGVIaXN0b3J5LnNvdXJjZUxhYmVsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHQuLi5kZWR1cGVkU2hlbGxGaWxlSXRlbXMsXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9IGVsc2Uge1xuXHRcdHBsYWNlaG9sZGVyID0gaXNNYWNpbnRvc2hcblx0XHRcdD8gbG9jYWxpemUoJ3NlbGVjdFJlY2VudERpcmVjdG9yeU1hYycsICdTZWxlY3QgYSBkaXJlY3RvcnkgdG8gZ28gdG8gKGhvbGQgT3B0aW9uLWtleSB0byBlZGl0IHRoZSBjb21tYW5kKScpXG5cdFx0XHQ6IGxvY2FsaXplKCdzZWxlY3RSZWNlbnREaXJlY3RvcnknLCAnU2VsZWN0IGEgZGlyZWN0b3J5IHRvIGdvIHRvIChob2xkIEFsdC1rZXkgdG8gZWRpdCB0aGUgY29tbWFuZCknKTtcblx0XHRjb25zdCBjd2RzID0gaW5zdGFuY2UuY2FwYWJpbGl0aWVzLmdldChUZXJtaW5hbENhcGFiaWxpdHkuQ3dkRGV0ZWN0aW9uKT8uY3dkcyB8fCBbXTtcblx0XHRpZiAoY3dkcyAmJiBjd2RzLmxlbmd0aCA+IDApIHtcblx0XHRcdGZvciAoY29uc3QgbGFiZWwgb2YgY3dkcykge1xuXHRcdFx0XHRpdGVtcy5wdXNoKHsgbGFiZWwsIHJhd0xhYmVsOiBsYWJlbCB9KTtcblx0XHRcdH1cblx0XHRcdGl0ZW1zID0gaXRlbXMucmV2ZXJzZSgpO1xuXHRcdFx0aXRlbXMudW5zaGlmdCh7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogdGVybWluYWxTdHJpbmdzLmN1cnJlbnRTZXNzaW9uQ2F0ZWdvcnkgfSk7XG5cdFx0fVxuXG5cdFx0Ly8gR2F0aGVyIHByZXZpb3VzIHNlc3Npb24gaGlzdG9yeVxuXHRcdGNvbnN0IGhpc3RvcnkgPSBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihnZXREaXJlY3RvcnlIaXN0b3J5KTtcblx0XHRjb25zdCBwcmV2aW91c1Nlc3Npb25JdGVtczogKElRdWlja1BpY2tJdGVtICYgeyByYXdMYWJlbDogc3RyaW5nIH0pW10gPSBbXTtcblx0XHQvLyBPbmx5IGFkZCBwcmV2aW91cyBzZXNzaW9uIGl0ZW0gaWYgaXQncyBub3QgaW4gdGhpcyBzZXNzaW9uIGFuZCBpdCBtYXRjaGVzIHRoZSByZW1vdGUgYXV0aG9yaXR5XG5cdFx0Zm9yIChjb25zdCBbbGFiZWwsIGluZm9dIG9mIGhpc3RvcnkuZW50cmllcykge1xuXHRcdFx0aWYgKChpbmZvID09PSBudWxsIHx8IGluZm8ucmVtb3RlQXV0aG9yaXR5ID09PSBpbnN0YW5jZS5yZW1vdGVBdXRob3JpdHkpICYmICFjd2RzLmluY2x1ZGVzKGxhYmVsKSkge1xuXHRcdFx0XHRwcmV2aW91c1Nlc3Npb25JdGVtcy51bnNoaWZ0KHtcblx0XHRcdFx0XHRsYWJlbCxcblx0XHRcdFx0XHRyYXdMYWJlbDogbGFiZWwsXG5cdFx0XHRcdFx0YnV0dG9uczogW3JlbW92ZUZyb21Db21tYW5kSGlzdG9yeUJ1dHRvbl1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChwcmV2aW91c1Nlc3Npb25JdGVtcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRpdGVtcy5wdXNoKFxuXHRcdFx0XHR7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogdGVybWluYWxTdHJpbmdzLnByZXZpb3VzU2Vzc2lvbkNhdGVnb3J5IH0sXG5cdFx0XHRcdC4uLnByZXZpb3VzU2Vzc2lvbkl0ZW1zLFxuXHRcdFx0KTtcblx0XHR9XG5cdH1cblx0aWYgKGl0ZW1zLmxlbmd0aCA9PT0gMCkge1xuXHRcdHJldHVybjtcblx0fVxuXHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0Y29uc3QgZnV6enlTZWFyY2hUb2dnbGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFRvZ2dsZSh7XG5cdFx0dGl0bGU6ICdGdXp6eSBzZWFyY2gnLFxuXHRcdGljb246IGNvbW1hbmRIaXN0b3J5RnV6enlTZWFyY2hJY29uLFxuXHRcdGlzQ2hlY2tlZDogZmlsdGVyTW9kZSA9PT0gJ2Z1enp5Jyxcblx0XHRpbnB1dEFjdGl2ZU9wdGlvbkJvcmRlcjogYXNDc3NWYXJpYWJsZShpbnB1dEFjdGl2ZU9wdGlvbkJvcmRlciksXG5cdFx0aW5wdXRBY3RpdmVPcHRpb25Gb3JlZ3JvdW5kOiBhc0Nzc1ZhcmlhYmxlKGlucHV0QWN0aXZlT3B0aW9uRm9yZWdyb3VuZCksXG5cdFx0aW5wdXRBY3RpdmVPcHRpb25CYWNrZ3JvdW5kOiBhc0Nzc1ZhcmlhYmxlKGlucHV0QWN0aXZlT3B0aW9uQmFja2dyb3VuZClcblx0fSkpO1xuXHRkaXNwb3NhYmxlcy5hZGQoZnV6enlTZWFyY2hUb2dnbGUub25DaGFuZ2UoKCkgPT4ge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKHNob3dSdW5SZWNlbnRRdWlja1BpY2ssIGluc3RhbmNlLCB0ZXJtaW5hbEluUnVuQ29tbWFuZFBpY2tlciwgdHlwZSwgZnV6enlTZWFyY2hUb2dnbGUuY2hlY2tlZCA/ICdmdXp6eScgOiAnY29udGlndW91cycsIHF1aWNrUGljay52YWx1ZSk7XG5cdH0pKTtcblx0Y29uc3Qgb3V0cHV0UHJvdmlkZXIgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxPdXRwdXRQcm92aWRlcikpO1xuXHRjb25zdCBxdWlja1BpY2sgPSBkaXNwb3NhYmxlcy5hZGQocXVpY2tJbnB1dFNlcnZpY2UuY3JlYXRlUXVpY2tQaWNrPEl0ZW0gfCBJUXVpY2tQaWNrSXRlbSAmIHsgcmF3TGFiZWw6IHN0cmluZyB9Pih7IHVzZVNlcGFyYXRvcnM6IHRydWUgfSkpO1xuXHRjb25zdCBvcmlnaW5hbEl0ZW1zID0gaXRlbXM7XG5cdHF1aWNrUGljay5pdGVtcyA9IFsuLi5vcmlnaW5hbEl0ZW1zXTtcblx0cXVpY2tQaWNrLnNvcnRCeUxhYmVsID0gZmFsc2U7XG5cdHF1aWNrUGljay5wbGFjZWhvbGRlciA9IHBsYWNlaG9sZGVyO1xuXHRxdWlja1BpY2subWF0Y2hPbkxhYmVsTW9kZSA9IGZpbHRlck1vZGUgfHwgJ2NvbnRpZ3VvdXMnO1xuXHRxdWlja1BpY2sudG9nZ2xlcyA9IFtmdXp6eVNlYXJjaFRvZ2dsZV07XG5cdGRpc3Bvc2FibGVzLmFkZChxdWlja1BpY2sub25EaWRUcmlnZ2VySXRlbUJ1dHRvbihhc3luYyBlID0+IHtcblx0XHRpZiAoZS5idXR0b24gPT09IHJlbW92ZUZyb21Db21tYW5kSGlzdG9yeUJ1dHRvbikge1xuXHRcdFx0aWYgKHR5cGUgPT09ICdjb21tYW5kJykge1xuXHRcdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihnZXRDb21tYW5kSGlzdG9yeSk/LnJlbW92ZShlLml0ZW0ubGFiZWwpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oZ2V0RGlyZWN0b3J5SGlzdG9yeSk/LnJlbW92ZShlLml0ZW0ubGFiZWwpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSBpZiAoZS5idXR0b24gPT09IGNvbW1hbmRPdXRwdXRCdXR0b24pIHtcblx0XHRcdGNvbnN0IHNlbGVjdGVkQ29tbWFuZCA9IChlLml0ZW0gYXMgSXRlbSkuY29tbWFuZDtcblx0XHRcdGNvbnN0IG91dHB1dCA9IHNlbGVjdGVkQ29tbWFuZD8uZ2V0T3V0cHV0KCk7XG5cdFx0XHRpZiAob3V0cHV0ICYmIHNlbGVjdGVkQ29tbWFuZD8uY29tbWFuZCkge1xuXHRcdFx0XHRjb25zdCB0ZXh0Q29udGVudCA9IGF3YWl0IG91dHB1dFByb3ZpZGVyLnByb3ZpZGVUZXh0Q29udGVudChVUkkuZnJvbShcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzY2hlbWU6IFRlcm1pbmFsT3V0cHV0UHJvdmlkZXIuc2NoZW1lLFxuXHRcdFx0XHRcdFx0cGF0aDogYCR7c2VsZWN0ZWRDb21tYW5kLmNvbW1hbmR9Li4uICR7ZnJvbU5vdyhzZWxlY3RlZENvbW1hbmQudGltZXN0YW1wLCB0cnVlKX1gLFxuXHRcdFx0XHRcdFx0ZnJhZ21lbnQ6IG91dHB1dCxcblx0XHRcdFx0XHRcdHF1ZXJ5OiBgdGVybWluYWwtb3V0cHV0LSR7c2VsZWN0ZWRDb21tYW5kLnRpbWVzdGFtcH0tJHtpbnN0YW5jZS5pbnN0YW5jZUlkfWBcblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdGlmICh0ZXh0Q29udGVudCkge1xuXHRcdFx0XHRcdGF3YWl0IGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRcdFx0XHRyZXNvdXJjZTogdGV4dENvbnRlbnQudXJpXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0YXdhaXQgaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oc2hvd1J1blJlY2VudFF1aWNrUGljaywgaW5zdGFuY2UsIHRlcm1pbmFsSW5SdW5Db21tYW5kUGlja2VyLCB0eXBlLCBmaWx0ZXJNb2RlLCB2YWx1ZSk7XG5cdH0pKTtcblx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrUGljay5vbkRpZFRyaWdnZXJTZXBhcmF0b3JCdXR0b24oYXN5bmMgZSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBvcGVuUmVzb3VyY2VCdXR0b25zLmZpbmQob3BlblJlc291cmNlQnV0dG9uID0+IGUuYnV0dG9uID09PSBvcGVuUmVzb3VyY2VCdXR0b24pPy5yZXNvdXJjZTtcblx0XHRpZiAocmVzb3VyY2UpIHtcblx0XHRcdGF3YWl0IGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRcdHJlc291cmNlXG5cdFx0XHR9KTtcblx0XHR9XG5cdH0pKTtcblx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrUGljay5vbkRpZENoYW5nZVZhbHVlKGFzeW5jIHZhbHVlID0+IHtcblx0XHRpZiAoIXZhbHVlKSB7XG5cdFx0XHRhd2FpdCBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihzaG93UnVuUmVjZW50UXVpY2tQaWNrLCBpbnN0YW5jZSwgdGVybWluYWxJblJ1bkNvbW1hbmRQaWNrZXIsIHR5cGUsIGZpbHRlck1vZGUsIHZhbHVlKTtcblx0XHR9XG5cdH0pKTtcblx0bGV0IHRlcm1pbmFsU2Nyb2xsU3RhdGVTYXZlZCA9IGZhbHNlO1xuXHRmdW5jdGlvbiByZXN0b3JlU2Nyb2xsU3RhdGUoKSB7XG5cdFx0dGVybWluYWxTY3JvbGxTdGF0ZVNhdmVkID0gZmFsc2U7XG5cdFx0aW5zdGFuY2UueHRlcm0/Lm1hcmtUcmFja2VyLnJlc3RvcmVTY3JvbGxTdGF0ZSgpO1xuXHRcdGluc3RhbmNlLnh0ZXJtPy5tYXJrVHJhY2tlci5jbGVhcigpO1xuXHR9XG5cdGRpc3Bvc2FibGVzLmFkZChxdWlja1BpY2sub25EaWRDaGFuZ2VBY3RpdmUoYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHh0ZXJtID0gaW5zdGFuY2UueHRlcm07XG5cdFx0aWYgKCF4dGVybSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBbaXRlbV0gPSBxdWlja1BpY2suYWN0aXZlSXRlbXM7XG5cdFx0aWYgKCFpdGVtKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICgnY29tbWFuZCcgaW4gaXRlbSAmJiBpdGVtLmNvbW1hbmQgJiYgaXRlbS5jb21tYW5kLm1hcmtlcikge1xuXHRcdFx0aWYgKCF0ZXJtaW5hbFNjcm9sbFN0YXRlU2F2ZWQpIHtcblx0XHRcdFx0eHRlcm0ubWFya1RyYWNrZXIuc2F2ZVNjcm9sbFN0YXRlKCk7XG5cdFx0XHRcdHRlcm1pbmFsU2Nyb2xsU3RhdGVTYXZlZCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBwcm9tcHRSb3dDb3VudCA9IGl0ZW0uY29tbWFuZC5nZXRQcm9tcHRSb3dDb3VudCgpO1xuXHRcdFx0Y29uc3QgY29tbWFuZFJvd0NvdW50ID0gaXRlbS5jb21tYW5kLmdldENvbW1hbmRSb3dDb3VudCgpO1xuXHRcdFx0eHRlcm0ubWFya1RyYWNrZXIucmV2ZWFsUmFuZ2Uoe1xuXHRcdFx0XHRzdGFydDoge1xuXHRcdFx0XHRcdHg6IDEsXG5cdFx0XHRcdFx0eTogaXRlbS5jb21tYW5kLm1hcmtlci5saW5lIC0gKHByb21wdFJvd0NvdW50IC0gMSkgKyAxXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGVuZDoge1xuXHRcdFx0XHRcdHg6IGluc3RhbmNlLmNvbHMsXG5cdFx0XHRcdFx0eTogaXRlbS5jb21tYW5kLm1hcmtlci5saW5lICsgKGNvbW1hbmRSb3dDb3VudCAtIDEpICsgMVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzdG9yZVNjcm9sbFN0YXRlKCk7XG5cdFx0fVxuXHR9KSk7XG5cdGRpc3Bvc2FibGVzLmFkZChxdWlja1BpY2sub25EaWRBY2NlcHQoYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc3VsdCA9IHF1aWNrUGljay5hY3RpdmVJdGVtc1swXTtcblx0XHRsZXQgdGV4dDogc3RyaW5nO1xuXHRcdGlmICh0eXBlID09PSAnY3dkJykge1xuXHRcdFx0dGV4dCA9IGBjZCAke2F3YWl0IGluc3RhbmNlLnByZXBhcmVQYXRoRm9yU2hlbGwocmVzdWx0LnJhd0xhYmVsKX1gO1xuXHRcdH0gZWxzZSB7IC8vIGNvbW1hbmRcblx0XHRcdHRleHQgPSByZXN1bHQucmF3TGFiZWw7XG5cdFx0fVxuXHRcdHF1aWNrUGljay5oaWRlKCk7XG5cdFx0dGVybWluYWxTY3JvbGxTdGF0ZVNhdmVkID0gZmFsc2U7XG5cdFx0aW5zdGFuY2UueHRlcm0/Lm1hcmtUcmFja2VyLmNsZWFyKCk7XG5cdFx0aW5zdGFuY2Uuc2Nyb2xsVG9Cb3R0b20oKTtcblx0XHRpbnN0YW5jZS5ydW5Db21tYW5kKHRleHQsICFxdWlja1BpY2sua2V5TW9kcy5hbHQpO1xuXHRcdGlmIChxdWlja1BpY2sua2V5TW9kcy5hbHQpIHtcblx0XHRcdGluc3RhbmNlLmZvY3VzKCk7XG5cdFx0fVxuXHR9KSk7XG5cdGRpc3Bvc2FibGVzLmFkZChxdWlja1BpY2sub25EaWRIaWRlKCgpID0+IHJlc3RvcmVTY3JvbGxTdGF0ZSgpKSk7XG5cdGlmICh2YWx1ZSkge1xuXHRcdHF1aWNrUGljay52YWx1ZSA9IHZhbHVlO1xuXHR9XG5cdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPihyID0+IHtcblx0XHR0ZXJtaW5hbEluUnVuQ29tbWFuZFBpY2tlci5zZXQodHJ1ZSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHNob3dXaXRoUGlubmVkSXRlbXMoc3RvcmFnZVNlcnZpY2UsIHJ1blJlY2VudFN0b3JhZ2VLZXksIHF1aWNrUGljaywgdHJ1ZSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja1BpY2sub25EaWRIaWRlKCgpID0+IHtcblx0XHRcdHRlcm1pbmFsSW5SdW5Db21tYW5kUGlja2VyLnNldChmYWxzZSk7XG5cdFx0XHRhY2Nlc3NpYmxlVmlld1NlcnZpY2Uuc2hvd0xhc3RQcm92aWRlcihBY2Nlc3NpYmxlVmlld1Byb3ZpZGVySWQuVGVybWluYWwpO1xuXHRcdFx0cigpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdH0pKTtcblx0fSk7XG59XG5cbmNsYXNzIFRlcm1pbmFsT3V0cHV0UHJvdmlkZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVRleHRNb2RlbENvbnRlbnRQcm92aWRlciB7XG5cdHN0YXRpYyBzY2hlbWUgPSAnVEVSTUlOQUxfT1VUUFVUJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgdGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9tb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlLnJlZ2lzdGVyVGV4dE1vZGVsQ29udGVudFByb3ZpZGVyKFRlcm1pbmFsT3V0cHV0UHJvdmlkZXIuc2NoZW1lLCB0aGlzKSk7XG5cdH1cblxuXHRhc3luYyBwcm92aWRlVGV4dENvbnRlbnQocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8SVRleHRNb2RlbCB8IG51bGw+IHtcblx0XHRjb25zdCBleGlzdGluZyA9IHRoaXMuX21vZGVsU2VydmljZS5nZXRNb2RlbChyZXNvdXJjZSk7XG5cdFx0aWYgKGV4aXN0aW5nICYmICFleGlzdGluZy5pc0Rpc3Bvc2VkKCkpIHtcblx0XHRcdHJldHVybiBleGlzdGluZztcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fbW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsKHJlc291cmNlLmZyYWdtZW50LCBudWxsLCByZXNvdXJjZSwgZmFsc2UpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsY0FBYztBQUN2QixTQUFTLGFBQWEsdUJBQXVCO0FBRTdDLFNBQVMs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
