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
import { toErrorMessage } from "../../../base/common/errorMessage.js";
import { isCancellationError } from "../../../base/common/errors.js";
import { matchesContiguousSubString, matchesPrefix, matchesWords, or } from "../../../base/common/filters.js";
import { createSingleCallFunction } from "../../../base/common/functional.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { LRUCache } from "../../../base/common/map.js";
import { TfIdfCalculator, normalizeTfIdfScores } from "../../../base/common/tfIdf.js";
import { localize } from "../../../nls.js";
import { ICommandService } from "../../commands/common/commands.js";
import { IConfigurationService } from "../../configuration/common/configuration.js";
import { IDialogService } from "../../dialogs/common/dialogs.js";
import { IInstantiationService } from "../../instantiation/common/instantiation.js";
import { IKeybindingService } from "../../keybinding/common/keybinding.js";
import { ILogService } from "../../log/common/log.js";
import { PickerQuickAccessProvider } from "./pickerQuickAccess.js";
import { IStorageService, StorageScope, StorageTarget, WillSaveStateReason } from "../../storage/common/storage.js";
import { ITelemetryService } from "../../telemetry/common/telemetry.js";
let AbstractCommandsQuickAccessProvider = class extends PickerQuickAccessProvider {
  constructor(options, instantiationService, keybindingService, commandService, telemetryService, dialogService) {
    super(AbstractCommandsQuickAccessProvider.PREFIX, options);
    this.instantiationService = instantiationService;
    this.keybindingService = keybindingService;
    this.commandService = commandService;
    this.telemetryService = telemetryService;
    this.dialogService = dialogService;
    this.commandsHistory = this._register(this.instantiationService.createInstance(CommandsHistory));
    this.options = options;
  }
  async _getPicks(filter, _disposables, token, runOptions) {
    const allCommandPicks = await this.getCommandPicks(token);
    if (token.isCancellationRequested) {
      return [];
    }
    const runTfidf = createSingleCallFunction(() => {
      const tfidf = new TfIdfCalculator();
      tfidf.updateDocuments(allCommandPicks.map((commandPick) => ({
        key: commandPick.commandId,
        textChunks: [this.getTfIdfChunk(commandPick)]
      })));
      const result = tfidf.calculateScores(filter, token);
      return normalizeTfIdfScores(result).filter((score) => score.score > AbstractCommandsQuickAccessProvider.TFIDF_THRESHOLD).slice(0, AbstractCommandsQuickAccessProvider.TFIDF_MAX_RESULTS);
    });
    const filteredCommandPicks = [];
    for (const commandPick of allCommandPicks) {
      const labelHighlights = AbstractCommandsQuickAccessProvider.WORD_FILTER(filter, commandPick.label) ?? void 0;
      const aliasHighlights = commandPick.commandAlias ? AbstractCommandsQuickAccessProvider.WORD_FILTER(filter, commandPick.commandAlias) ?? void 0 : void 0;
      if (labelHighlights || aliasHighlights) {
        commandPick.highlights = {
          label: labelHighlights,
          detail: this.options.showAlias ? aliasHighlights : void 0
        };
        filteredCommandPicks.push(commandPick);
      } else if (filter === commandPick.commandId) {
        filteredCommandPicks.push(commandPick);
      } else if (filter.length >= 3) {
        const tfidf = runTfidf();
        if (token.isCancellationRequested) {
          return [];
        }
        const tfidfScore = tfidf.find((score) => score.key === commandPick.commandId);
        if (tfidfScore) {
          commandPick.tfIdfScore = tfidfScore.score;
          filteredCommandPicks.push(commandPick);
        }
      }
    }
    const mapLabelToCommand = /* @__PURE__ */ new Map();
    for (const commandPick of filteredCommandPicks) {
      const existingCommandForLabel = mapLabelToCommand.get(commandPick.label);
      if (existingCommandForLabel) {
        commandPick.description = commandPick.commandId;
        existingCommandForLabel.description = existingCommandForLabel.commandId;
      } else {
        mapLabelToCommand.set(commandPick.label, commandPick);
      }
    }
    filteredCommandPicks.sort((commandPickA, commandPickB) => {
      if (commandPickA.tfIdfScore && commandPickB.tfIdfScore) {
        if (commandPickA.tfIdfScore === commandPickB.tfIdfScore) {
          return commandPickA.label.localeCompare(commandPickB.label);
        }
        return commandPickB.tfIdfScore - commandPickA.tfIdfScore;
      } else if (commandPickA.tfIdfScore) {
        return 1;
      } else if (commandPickB.tfIdfScore) {
        return -1;
      }
      const commandACounter = this.commandsHistory.peek(commandPickA.commandId);
      const commandBCounter = this.commandsHistory.peek(commandPickB.commandId);
      if (commandACounter && commandBCounter) {
        return commandACounter > commandBCounter ? -1 : 1;
      }
      if (commandACounter) {
        return -1;
      }
      if (commandBCounter) {
        return 1;
      }
      if (this.options.suggestedCommandIds) {
        const commandASuggestion = this.options.suggestedCommandIds.has(commandPickA.commandId);
        const commandBSuggestion = this.options.suggestedCommandIds.has(commandPickB.commandId);
        if (commandASuggestion && commandBSuggestion) {
          return 0;
        }
        if (commandASuggestion) {
          return -1;
        }
        if (commandBSuggestion) {
          return 1;
        }
      }
      return commandPickA.label.localeCompare(commandPickB.label);
    });
    const commandPicks = [];
    let addOtherSeparator = false;
    let addSuggestedSeparator = true;
    let addCommonlyUsedSeparator = !!this.options.suggestedCommandIds;
    for (let i = 0; i < filteredCommandPicks.length; i++) {
      const commandPick = filteredCommandPicks[i];
      if (i === 0 && this.commandsHistory.peek(commandPick.commandId)) {
        commandPicks.push({ type: "separator", label: localize("recentlyUsed", "recently used") });
        addOtherSeparator = true;
      }
      if (addSuggestedSeparator && commandPick.tfIdfScore !== void 0) {
        commandPicks.push({ type: "separator", label: localize("suggested", "similar commands") });
        addSuggestedSeparator = false;
      }
      if (addCommonlyUsedSeparator && commandPick.tfIdfScore === void 0 && !this.commandsHistory.peek(commandPick.commandId) && this.options.suggestedCommandIds?.has(commandPick.commandId)) {
        commandPicks.push({ type: "separator", label: localize("commonlyUsed", "commonly used") });
        addOtherSeparator = true;
        addCommonlyUsedSeparator = false;
      }
      if (addOtherSeparator && commandPick.tfIdfScore === void 0 && !this.commandsHistory.peek(commandPick.commandId) && !this.options.suggestedCommandIds?.has(commandPick.commandId)) {
        commandPicks.push({ type: "separator", label: localize("morecCommands", "other commands") });
        addOtherSeparator = false;
      }
      commandPicks.push(this.toCommandPick(commandPick, runOptions));
    }
    if (!this.hasAdditionalCommandPicks(filter, token)) {
      return commandPicks;
    }
    return {
      picks: commandPicks,
      additionalPicks: (async () => {
        const additionalCommandPicks = await this.getAdditionalCommandPicks(allCommandPicks, filteredCommandPicks, filter, token);
        if (token.isCancellationRequested) {
          return [];
        }
        const commandPicks2 = additionalCommandPicks.map((commandPick) => this.toCommandPick(commandPick, runOptions));
        if (addSuggestedSeparator && commandPicks2[0]?.type !== "separator") {
          commandPicks2.unshift({ type: "separator", label: localize("suggested", "similar commands") });
        }
        return commandPicks2;
      })()
    };
  }
  toCommandPick(commandPick, runOptions) {
    if (commandPick.type === "separator") {
      return commandPick;
    }
    const keybinding = this.keybindingService.lookupKeybinding(commandPick.commandId);
    const ariaLabel = keybinding ? localize("commandPickAriaLabelWithKeybinding", "{0}, {1}", commandPick.label, keybinding.getAriaLabel()) : commandPick.label;
    return {
      ...commandPick,
      ariaLabel,
      detail: this.options.showAlias && commandPick.commandAlias !== commandPick.label ? commandPick.commandAlias : void 0,
      keybinding,
      accept: async () => {
        this.commandsHistory.push(commandPick.commandId);
        this.telemetryService.publicLog2("workbenchActionExecuted", {
          id: commandPick.commandId,
          from: runOptions?.from ?? "quick open"
        });
        try {
          commandPick.args?.length ? await this.commandService.executeCommand(commandPick.commandId, ...commandPick.args) : await this.commandService.executeCommand(commandPick.commandId);
        } catch (error) {
          if (!isCancellationError(error)) {
            this.dialogService.error(localize("canNotRun", "Command '{0}' resulted in an error", commandPick.label), toErrorMessage(error));
          }
        }
      }
    };
  }
  // TF-IDF string to be indexed
  getTfIdfChunk({ label, commandAlias, commandDescription }) {
    let chunk = label;
    if (commandAlias && commandAlias !== label) {
      chunk += ` - ${commandAlias}`;
    }
    if (commandDescription && commandDescription.value !== label) {
      chunk += ` - ${commandDescription.value === commandDescription.original ? commandDescription.value : `${commandDescription.value} (${commandDescription.original})`}`;
    }
    return chunk;
  }
};
AbstractCommandsQuickAccessProvider.PREFIX = ">";
AbstractCommandsQuickAccessProvider.TFIDF_THRESHOLD = 0.5;
AbstractCommandsQuickAccessProvider.TFIDF_MAX_RESULTS = 5;
AbstractCommandsQuickAccessProvider.WORD_FILTER = or(matchesPrefix, matchesWords, matchesContiguousSubString);
AbstractCommandsQuickAccessProvider = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IKeybindingService),
  __decorateParam(3, ICommandService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IDialogService)
], AbstractCommandsQuickAccessProvider);
let CommandsHistory = class extends Disposable {
  constructor(storageService, configurationService, logService) {
    super();
    this.storageService = storageService;
    this.configurationService = configurationService;
    this.logService = logService;
    this.configuredCommandsHistoryLength = 0;
    this.updateConfiguration();
    this.load();
    this.registerListeners();
  }
  registerListeners() {
    this._register(this.configurationService.onDidChangeConfiguration((e) => this.updateConfiguration(e)));
    this._register(this.storageService.onWillSaveState((e) => {
      if (e.reason === WillSaveStateReason.SHUTDOWN) {
        this.saveState();
      }
    }));
  }
  updateConfiguration(e) {
    if (e && !e.affectsConfiguration("workbench.commandPalette.history")) {
      return;
    }
    this.configuredCommandsHistoryLength = CommandsHistory.getConfiguredCommandHistoryLength(this.configurationService);
    if (CommandsHistory.cache && CommandsHistory.cache.limit !== this.configuredCommandsHistoryLength) {
      CommandsHistory.cache.limit = this.configuredCommandsHistoryLength;
      CommandsHistory.hasChanges = true;
    }
  }
  load() {
    const raw = this.storageService.get(CommandsHistory.PREF_KEY_CACHE, StorageScope.PROFILE);
    let serializedCache;
    if (raw) {
      try {
        serializedCache = JSON.parse(raw);
      } catch (error) {
        this.logService.error(`[CommandsHistory] invalid data: ${error}`);
      }
    }
    const cache = CommandsHistory.cache = new LRUCache(this.configuredCommandsHistoryLength, 1);
    if (serializedCache) {
      let entries;
      if (serializedCache.usesLRU) {
        entries = serializedCache.entries;
      } else {
        entries = serializedCache.entries.sort((a, b) => a.value - b.value);
      }
      entries.forEach((entry) => cache.set(entry.key, entry.value));
    }
    CommandsHistory.counter = this.storageService.getNumber(CommandsHistory.PREF_KEY_COUNTER, StorageScope.PROFILE, CommandsHistory.counter);
  }
  push(commandId) {
    if (!CommandsHistory.cache) {
      return;
    }
    CommandsHistory.cache.set(commandId, CommandsHistory.counter++);
    CommandsHistory.hasChanges = true;
  }
  peek(commandId) {
    return CommandsHistory.cache?.peek(commandId);
  }
  saveState() {
    if (!CommandsHistory.cache) {
      return;
    }
    if (!CommandsHistory.hasChanges) {
      return;
    }
    const serializedCache = { usesLRU: true, entries: [] };
    CommandsHistory.cache.forEach((value, key) => serializedCache.entries.push({ key, value }));
    this.storageService.store(CommandsHistory.PREF_KEY_CACHE, JSON.stringify(serializedCache), StorageScope.PROFILE, StorageTarget.USER);
    this.storageService.store(CommandsHistory.PREF_KEY_COUNTER, CommandsHistory.counter, StorageScope.PROFILE, StorageTarget.USER);
    CommandsHistory.hasChanges = false;
  }
  static getConfiguredCommandHistoryLength(configurationService) {
    const config = configurationService.getValue();
    const configuredCommandHistoryLength = config.workbench?.commandPalette?.history;
    if (typeof configuredCommandHistoryLength === "number") {
      return configuredCommandHistoryLength;
    }
    return CommandsHistory.DEFAULT_COMMANDS_HISTORY_LENGTH;
  }
  static clearHistory(configurationService, storageService) {
    const commandHistoryLength = CommandsHistory.getConfiguredCommandHistoryLength(configurationService);
    CommandsHistory.cache = new LRUCache(commandHistoryLength);
    CommandsHistory.counter = 1;
    CommandsHistory.hasChanges = true;
  }
};
CommandsHistory.DEFAULT_COMMANDS_HISTORY_LENGTH = 50;
CommandsHistory.PREF_KEY_CACHE = "commandPalette.mru.cache";
CommandsHistory.PREF_KEY_COUNTER = "commandPalette.mru.counter";
CommandsHistory.counter = 1;
CommandsHistory.hasChanges = false;
CommandsHistory = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ILogService)
], CommandsHistory);
export {
  AbstractCommandsQuickAccessProvider,
  CommandsHistory
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9xdWlja2lucHV0L2Jyb3dzZXIvY29tbWFuZHNRdWlja0FjY2Vzcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkQ2xhc3NpZmljYXRpb24sIFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IHRvRXJyb3JNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JNZXNzYWdlLmpzJztcbmltcG9ydCB7IGlzQ2FuY2VsbGF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgbWF0Y2hlc0NvbnRpZ3VvdXNTdWJTdHJpbmcsIG1hdGNoZXNQcmVmaXgsIG1hdGNoZXNXb3Jkcywgb3IgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9maWx0ZXJzLmpzJztcbmltcG9ydCB7IGNyZWF0ZVNpbmdsZUNhbGxGdW5jdGlvbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Z1bmN0aW9uYWwuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBMUlVDYWNoZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBUZklkZkNhbGN1bGF0b3IsIG5vcm1hbGl6ZVRmSWRmU2NvcmVzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdGZJZGYuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUxvY2FsaXplZFN0cmluZyB9IGZyb20gJy4uLy4uL2FjdGlvbi9jb21tb24vYWN0aW9uLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50LCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBGYXN0QW5kU2xvd1BpY2tzLCBJUGlja2VyUXVpY2tBY2Nlc3NJdGVtLCBJUGlja2VyUXVpY2tBY2Nlc3NQcm92aWRlck9wdGlvbnMsIFBpY2tlclF1aWNrQWNjZXNzUHJvdmlkZXIsIFBpY2tzIH0gZnJvbSAnLi9waWNrZXJRdWlja0FjY2Vzcy5qcyc7XG5pbXBvcnQgeyBJUXVpY2tBY2Nlc3NQcm92aWRlclJ1bk9wdGlvbnMgfSBmcm9tICcuLi9jb21tb24vcXVpY2tBY2Nlc3MuanMnO1xuaW1wb3J0IHsgSVF1aWNrUGlja1NlcGFyYXRvciB9IGZyb20gJy4uL2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0LCBXaWxsU2F2ZVN0YXRlUmVhc29uIH0gZnJvbSAnLi4vLi4vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJQ29tbWFuZFF1aWNrUGljayBleHRlbmRzIElQaWNrZXJRdWlja0FjY2Vzc0l0ZW0ge1xuXHRyZWFkb25seSBjb21tYW5kSWQ6IHN0cmluZztcblx0cmVhZG9ubHkgY29tbWFuZFdoZW4/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGNvbW1hbmRBbGlhcz86IHN0cmluZztcblx0cmVhZG9ubHkgY29tbWFuZERlc2NyaXB0aW9uPzogSUxvY2FsaXplZFN0cmluZztcblx0dGZJZGZTY29yZT86IG51bWJlcjtcblx0cmVhZG9ubHkgYXJncz86IGFueVtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDb21tYW5kc1F1aWNrQWNjZXNzT3B0aW9ucyBleHRlbmRzIElQaWNrZXJRdWlja0FjY2Vzc1Byb3ZpZGVyT3B0aW9uczxJQ29tbWFuZFF1aWNrUGljaz4ge1xuXHRyZWFkb25seSBzaG93QWxpYXM6IGJvb2xlYW47XG5cdHN1Z2dlc3RlZENvbW1hbmRJZHM/OiBTZXQ8c3RyaW5nPjtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0Q29tbWFuZHNRdWlja0FjY2Vzc1Byb3ZpZGVyIGV4dGVuZHMgUGlja2VyUXVpY2tBY2Nlc3NQcm92aWRlcjxJQ29tbWFuZFF1aWNrUGljaz4gaW1wbGVtZW50cyBJRGlzcG9zYWJsZSB7XG5cblx0c3RhdGljIFBSRUZJWCA9ICc+JztcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBURklERl9USFJFU0hPTEQgPSAwLjU7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFRGSURGX01BWF9SRVNVTFRTID0gNTtcblxuXHRwcml2YXRlIHN0YXRpYyBXT1JEX0ZJTFRFUiA9IG9yKG1hdGNoZXNQcmVmaXgsIG1hdGNoZXNXb3JkcywgbWF0Y2hlc0NvbnRpZ3VvdXNTdWJTdHJpbmcpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZHNIaXN0b3J5ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb21tYW5kc0hpc3RvcnkpKTtcblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVhZG9ubHkgb3B0aW9uczogSUNvbW1hbmRzUXVpY2tBY2Nlc3NPcHRpb25zO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG9wdGlvbnM6IElDb21tYW5kc1F1aWNrQWNjZXNzT3B0aW9ucyxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUtleWJpbmRpbmdTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKEFic3RyYWN0Q29tbWFuZHNRdWlja0FjY2Vzc1Byb3ZpZGVyLlBSRUZJWCwgb3B0aW9ucyk7XG5cblx0XHR0aGlzLm9wdGlvbnMgPSBvcHRpb25zO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIF9nZXRQaWNrcyhmaWx0ZXI6IHN0cmluZywgX2Rpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbiwgcnVuT3B0aW9ucz86IElRdWlja0FjY2Vzc1Byb3ZpZGVyUnVuT3B0aW9ucyk6IFByb21pc2U8UGlja3M8SUNvbW1hbmRRdWlja1BpY2s+IHwgRmFzdEFuZFNsb3dQaWNrczxJQ29tbWFuZFF1aWNrUGljaz4+IHtcblxuXHRcdC8vIEFzayBzdWJjbGFzcyBmb3IgYWxsIGNvbW1hbmQgcGlja3Ncblx0XHRjb25zdCBhbGxDb21tYW5kUGlja3MgPSBhd2FpdCB0aGlzLmdldENvbW1hbmRQaWNrcyh0b2tlbik7XG5cblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRjb25zdCBydW5UZmlkZiA9IGNyZWF0ZVNpbmdsZUNhbGxGdW5jdGlvbigoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZmlkZiA9IG5ldyBUZklkZkNhbGN1bGF0b3IoKTtcblx0XHRcdHRmaWRmLnVwZGF0ZURvY3VtZW50cyhhbGxDb21tYW5kUGlja3MubWFwKGNvbW1hbmRQaWNrID0+ICh7XG5cdFx0XHRcdGtleTogY29tbWFuZFBpY2suY29tbWFuZElkLFxuXHRcdFx0XHR0ZXh0Q2h1bmtzOiBbdGhpcy5nZXRUZklkZkNodW5rKGNvbW1hbmRQaWNrKV1cblx0XHRcdH0pKSk7XG5cdFx0XHRjb25zdCByZXN1bHQgPSB0ZmlkZi5jYWxjdWxhdGVTY29yZXMoZmlsdGVyLCB0b2tlbik7XG5cblx0XHRcdHJldHVybiBub3JtYWxpemVUZklkZlNjb3JlcyhyZXN1bHQpXG5cdFx0XHRcdC5maWx0ZXIoc2NvcmUgPT4gc2NvcmUuc2NvcmUgPiBBYnN0cmFjdENvbW1hbmRzUXVpY2tBY2Nlc3NQcm92aWRlci5URklERl9USFJFU0hPTEQpXG5cdFx0XHRcdC5zbGljZSgwLCBBYnN0cmFjdENvbW1hbmRzUXVpY2tBY2Nlc3NQcm92aWRlci5URklERl9NQVhfUkVTVUxUUyk7XG5cdFx0fSk7XG5cblx0XHQvLyBGaWx0ZXJcblx0XHRjb25zdCBmaWx0ZXJlZENvbW1hbmRQaWNrczogSUNvbW1hbmRRdWlja1BpY2tbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgY29tbWFuZFBpY2sgb2YgYWxsQ29tbWFuZFBpY2tzKSB7XG5cdFx0XHRjb25zdCBsYWJlbEhpZ2hsaWdodHMgPSBBYnN0cmFjdENvbW1hbmRzUXVpY2tBY2Nlc3NQcm92aWRlci5XT1JEX0ZJTFRFUihmaWx0ZXIsIGNvbW1hbmRQaWNrLmxhYmVsKSA/PyB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCBhbGlhc0hpZ2hsaWdodHMgPSBjb21tYW5kUGljay5jb21tYW5kQWxpYXMgPyBBYnN0cmFjdENvbW1hbmRzUXVpY2tBY2Nlc3NQcm92aWRlci5XT1JEX0ZJTFRFUihmaWx0ZXIsIGNvbW1hbmRQaWNrLmNvbW1hbmRBbGlhcykgPz8gdW5kZWZpbmVkIDogdW5kZWZpbmVkO1xuXG5cdFx0XHQvLyBBZGQgaWYgbWF0Y2hpbmcgaW4gbGFiZWwgb3IgYWxpYXNcblx0XHRcdGlmIChsYWJlbEhpZ2hsaWdodHMgfHwgYWxpYXNIaWdobGlnaHRzKSB7XG5cdFx0XHRcdGNvbW1hbmRQaWNrLmhpZ2hsaWdodHMgPSB7XG5cdFx0XHRcdFx0bGFiZWw6IGxhYmVsSGlnaGxpZ2h0cyxcblx0XHRcdFx0XHRkZXRhaWw6IHRoaXMub3B0aW9ucy5zaG93QWxpYXMgPyBhbGlhc0hpZ2hsaWdodHMgOiB1bmRlZmluZWRcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRmaWx0ZXJlZENvbW1hbmRQaWNrcy5wdXNoKGNvbW1hbmRQaWNrKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQWxzbyBhZGQgaWYgd2UgaGF2ZSBhIDEwMCUgY29tbWFuZCBJRCBtYXRjaFxuXHRcdFx0ZWxzZSBpZiAoZmlsdGVyID09PSBjb21tYW5kUGljay5jb21tYW5kSWQpIHtcblx0XHRcdFx0ZmlsdGVyZWRDb21tYW5kUGlja3MucHVzaChjb21tYW5kUGljayk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEhhbmRsZSB0Zi1pZGYgc2NvcmluZyBmb3IgdGhlIHJlc3QgaWYgdGhlcmUncyBhIGZpbHRlclxuXHRcdFx0ZWxzZSBpZiAoZmlsdGVyLmxlbmd0aCA+PSAzKSB7XG5cdFx0XHRcdGNvbnN0IHRmaWRmID0gcnVuVGZpZGYoKTtcblx0XHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gQWRkIGlmIHdlIGhhdmUgYSB0Zi1pZGYgc2NvcmVcblx0XHRcdFx0Y29uc3QgdGZpZGZTY29yZSA9IHRmaWRmLmZpbmQoc2NvcmUgPT4gc2NvcmUua2V5ID09PSBjb21tYW5kUGljay5jb21tYW5kSWQpO1xuXHRcdFx0XHRpZiAodGZpZGZTY29yZSkge1xuXHRcdFx0XHRcdGNvbW1hbmRQaWNrLnRmSWRmU2NvcmUgPSB0ZmlkZlNjb3JlLnNjb3JlO1xuXHRcdFx0XHRcdGZpbHRlcmVkQ29tbWFuZFBpY2tzLnB1c2goY29tbWFuZFBpY2spO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gQWRkIGRlc2NyaXB0aW9uIHRvIGNvbW1hbmRzIHRoYXQgaGF2ZSBkdXBsaWNhdGUgbGFiZWxzXG5cdFx0Y29uc3QgbWFwTGFiZWxUb0NvbW1hbmQgPSBuZXcgTWFwPHN0cmluZywgSUNvbW1hbmRRdWlja1BpY2s+KCk7XG5cdFx0Zm9yIChjb25zdCBjb21tYW5kUGljayBvZiBmaWx0ZXJlZENvbW1hbmRQaWNrcykge1xuXHRcdFx0Y29uc3QgZXhpc3RpbmdDb21tYW5kRm9yTGFiZWwgPSBtYXBMYWJlbFRvQ29tbWFuZC5nZXQoY29tbWFuZFBpY2subGFiZWwpO1xuXHRcdFx0aWYgKGV4aXN0aW5nQ29tbWFuZEZvckxhYmVsKSB7XG5cdFx0XHRcdGNvbW1hbmRQaWNrLmRlc2NyaXB0aW9uID0gY29tbWFuZFBpY2suY29tbWFuZElkO1xuXHRcdFx0XHRleGlzdGluZ0NvbW1hbmRGb3JMYWJlbC5kZXNjcmlwdGlvbiA9IGV4aXN0aW5nQ29tbWFuZEZvckxhYmVsLmNvbW1hbmRJZDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG1hcExhYmVsVG9Db21tYW5kLnNldChjb21tYW5kUGljay5sYWJlbCwgY29tbWFuZFBpY2spO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIFNvcnQgYnkgTVJVIG9yZGVyIGFuZCBmYWxsYmFjayB0byBuYW1lIG90aGVyd2lzZVxuXHRcdGZpbHRlcmVkQ29tbWFuZFBpY2tzLnNvcnQoKGNvbW1hbmRQaWNrQSwgY29tbWFuZFBpY2tCKSA9PiB7XG5cdFx0XHQvLyBJZiBhIHJlc3VsdCBjYW1lIGZyb20gdGYtaWRmLCB3ZSB3YW50IHRvIHB1dCB0aGF0IHRvd2FyZHMgdGhlIGJvdHRvbVxuXHRcdFx0aWYgKGNvbW1hbmRQaWNrQS50ZklkZlNjb3JlICYmIGNvbW1hbmRQaWNrQi50ZklkZlNjb3JlKSB7XG5cdFx0XHRcdGlmIChjb21tYW5kUGlja0EudGZJZGZTY29yZSA9PT0gY29tbWFuZFBpY2tCLnRmSWRmU2NvcmUpIHtcblx0XHRcdFx0XHRyZXR1cm4gY29tbWFuZFBpY2tBLmxhYmVsLmxvY2FsZUNvbXBhcmUoY29tbWFuZFBpY2tCLmxhYmVsKTsgLy8gcHJlZmVyIGxleGljb2dyYXBoaWNhbGx5IHNtYWxsZXIgY29tbWFuZFxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBjb21tYW5kUGlja0IudGZJZGZTY29yZSAtIGNvbW1hbmRQaWNrQS50ZklkZlNjb3JlOyAvLyBwcmVmZXIgaGlnaGVyIHRmLWlkZiBzY29yZVxuXHRcdFx0fSBlbHNlIGlmIChjb21tYW5kUGlja0EudGZJZGZTY29yZSkge1xuXHRcdFx0XHRyZXR1cm4gMTsgLy8gZmlyc3QgY29tbWFuZCBoYXMgYSBzY29yZSBidXQgb3RoZXIgZG9lc24ndCBzbyBvdGhlciB3aW5zXG5cdFx0XHR9IGVsc2UgaWYgKGNvbW1hbmRQaWNrQi50ZklkZlNjb3JlKSB7XG5cdFx0XHRcdHJldHVybiAtMTsgLy8gb3RoZXIgY29tbWFuZCBoYXMgYSBzY29yZSBidXQgZmlyc3QgZG9lc24ndCBzbyBmaXJzdCB3aW5zXG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGNvbW1hbmRBQ291bnRlciA9IHRoaXMuY29tbWFuZHNIaXN0b3J5LnBlZWsoY29tbWFuZFBpY2tBLmNvbW1hbmRJZCk7XG5cdFx0XHRjb25zdCBjb21tYW5kQkNvdW50ZXIgPSB0aGlzLmNvbW1hbmRzSGlzdG9yeS5wZWVrKGNvbW1hbmRQaWNrQi5jb21tYW5kSWQpO1xuXG5cdFx0XHRpZiAoY29tbWFuZEFDb3VudGVyICYmIGNvbW1hbmRCQ291bnRlcikge1xuXHRcdFx0XHRyZXR1cm4gY29tbWFuZEFDb3VudGVyID4gY29tbWFuZEJDb3VudGVyID8gLTEgOiAxOyAvLyB1c2UgbW9yZSByZWNlbnRseSB1c2VkIGNvbW1hbmQgYmVmb3JlIG9sZGVyXG5cdFx0XHR9XG5cblx0XHRcdGlmIChjb21tYW5kQUNvdW50ZXIpIHtcblx0XHRcdFx0cmV0dXJuIC0xOyAvLyBmaXJzdCBjb21tYW5kIHdhcyB1c2VkLCBzbyBpdCB3aW5zIG92ZXIgdGhlIG5vbiB1c2VkIG9uZVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY29tbWFuZEJDb3VudGVyKSB7XG5cdFx0XHRcdHJldHVybiAxOyAvLyBvdGhlciBjb21tYW5kIHdhcyB1c2VkIHNvIGl0IHdpbnMgb3ZlciB0aGUgY29tbWFuZFxuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5vcHRpb25zLnN1Z2dlc3RlZENvbW1hbmRJZHMpIHtcblx0XHRcdFx0Y29uc3QgY29tbWFuZEFTdWdnZXN0aW9uID0gdGhpcy5vcHRpb25zLnN1Z2dlc3RlZENvbW1hbmRJZHMuaGFzKGNvbW1hbmRQaWNrQS5jb21tYW5kSWQpO1xuXHRcdFx0XHRjb25zdCBjb21tYW5kQlN1Z2dlc3Rpb24gPSB0aGlzLm9wdGlvbnMuc3VnZ2VzdGVkQ29tbWFuZElkcy5oYXMoY29tbWFuZFBpY2tCLmNvbW1hbmRJZCk7XG5cdFx0XHRcdGlmIChjb21tYW5kQVN1Z2dlc3Rpb24gJiYgY29tbWFuZEJTdWdnZXN0aW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuIDA7IC8vIGhvbm9yIHRoZSBvcmRlciBvZiB0aGUgYXJyYXlcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChjb21tYW5kQVN1Z2dlc3Rpb24pIHtcblx0XHRcdFx0XHRyZXR1cm4gLTE7IC8vIGZpcnN0IGNvbW1hbmQgd2FzIHN1Z2dlc3RlZCwgc28gaXQgd2lucyBvdmVyIHRoZSBub24gc3VnZ2VzdGVkIG9uZVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGNvbW1hbmRCU3VnZ2VzdGlvbikge1xuXHRcdFx0XHRcdHJldHVybiAxOyAvLyBvdGhlciBjb21tYW5kIHdhcyBzdWdnZXN0ZWQgc28gaXQgd2lucyBvdmVyIHRoZSBjb21tYW5kXG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gYm90aCBjb21tYW5kcyB3ZXJlIG5ldmVyIHVzZWQsIHNvIHdlIHNvcnQgYnkgbmFtZVxuXHRcdFx0cmV0dXJuIGNvbW1hbmRQaWNrQS5sYWJlbC5sb2NhbGVDb21wYXJlKGNvbW1hbmRQaWNrQi5sYWJlbCk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBjb21tYW5kUGlja3M6IEFycmF5PElDb21tYW5kUXVpY2tQaWNrIHwgSVF1aWNrUGlja1NlcGFyYXRvcj4gPSBbXTtcblxuXHRcdGxldCBhZGRPdGhlclNlcGFyYXRvciA9IGZhbHNlO1xuXHRcdGxldCBhZGRTdWdnZXN0ZWRTZXBhcmF0b3IgPSB0cnVlO1xuXHRcdGxldCBhZGRDb21tb25seVVzZWRTZXBhcmF0b3IgPSAhIXRoaXMub3B0aW9ucy5zdWdnZXN0ZWRDb21tYW5kSWRzO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZmlsdGVyZWRDb21tYW5kUGlja3MubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IGNvbW1hbmRQaWNrID0gZmlsdGVyZWRDb21tYW5kUGlja3NbaV07XG5cblx0XHRcdC8vIFNlcGFyYXRvcjogcmVjZW50bHkgdXNlZFxuXHRcdFx0aWYgKGkgPT09IDAgJiYgdGhpcy5jb21tYW5kc0hpc3RvcnkucGVlayhjb21tYW5kUGljay5jb21tYW5kSWQpKSB7XG5cdFx0XHRcdGNvbW1hbmRQaWNrcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiBsb2NhbGl6ZSgncmVjZW50bHlVc2VkJywgXCJyZWNlbnRseSB1c2VkXCIpIH0pO1xuXHRcdFx0XHRhZGRPdGhlclNlcGFyYXRvciA9IHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChhZGRTdWdnZXN0ZWRTZXBhcmF0b3IgJiYgY29tbWFuZFBpY2sudGZJZGZTY29yZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdGNvbW1hbmRQaWNrcy5wdXNoKHsgdHlwZTogJ3NlcGFyYXRvcicsIGxhYmVsOiBsb2NhbGl6ZSgnc3VnZ2VzdGVkJywgXCJzaW1pbGFyIGNvbW1hbmRzXCIpIH0pO1xuXHRcdFx0XHRhZGRTdWdnZXN0ZWRTZXBhcmF0b3IgPSBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2VwYXJhdG9yOiBjb21tb25seSB1c2VkXG5cdFx0XHRpZiAoYWRkQ29tbW9ubHlVc2VkU2VwYXJhdG9yICYmIGNvbW1hbmRQaWNrLnRmSWRmU2NvcmUgPT09IHVuZGVmaW5lZCAmJiAhdGhpcy5jb21tYW5kc0hpc3RvcnkucGVlayhjb21tYW5kUGljay5jb21tYW5kSWQpICYmIHRoaXMub3B0aW9ucy5zdWdnZXN0ZWRDb21tYW5kSWRzPy5oYXMoY29tbWFuZFBpY2suY29tbWFuZElkKSkge1xuXHRcdFx0XHRjb21tYW5kUGlja3MucHVzaCh7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogbG9jYWxpemUoJ2NvbW1vbmx5VXNlZCcsIFwiY29tbW9ubHkgdXNlZFwiKSB9KTtcblx0XHRcdFx0YWRkT3RoZXJTZXBhcmF0b3IgPSB0cnVlO1xuXHRcdFx0XHRhZGRDb21tb25seVVzZWRTZXBhcmF0b3IgPSBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2VwYXJhdG9yOiBvdGhlciBjb21tYW5kc1xuXHRcdFx0aWYgKGFkZE90aGVyU2VwYXJhdG9yICYmIGNvbW1hbmRQaWNrLnRmSWRmU2NvcmUgPT09IHVuZGVmaW5lZCAmJiAhdGhpcy5jb21tYW5kc0hpc3RvcnkucGVlayhjb21tYW5kUGljay5jb21tYW5kSWQpICYmICF0aGlzLm9wdGlvbnMuc3VnZ2VzdGVkQ29tbWFuZElkcz8uaGFzKGNvbW1hbmRQaWNrLmNvbW1hbmRJZCkpIHtcblx0XHRcdFx0Y29tbWFuZFBpY2tzLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IGxvY2FsaXplKCdtb3JlY0NvbW1hbmRzJywgXCJvdGhlciBjb21tYW5kc1wiKSB9KTtcblx0XHRcdFx0YWRkT3RoZXJTZXBhcmF0b3IgPSBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gQ29tbWFuZFxuXHRcdFx0Y29tbWFuZFBpY2tzLnB1c2godGhpcy50b0NvbW1hbmRQaWNrKGNvbW1hbmRQaWNrLCBydW5PcHRpb25zKSk7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLmhhc0FkZGl0aW9uYWxDb21tYW5kUGlja3MoZmlsdGVyLCB0b2tlbikpIHtcblx0XHRcdHJldHVybiBjb21tYW5kUGlja3M7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHBpY2tzOiBjb21tYW5kUGlja3MsXG5cdFx0XHRhZGRpdGlvbmFsUGlja3M6IChhc3luYyAoKTogUHJvbWlzZTxQaWNrczxJQ29tbWFuZFF1aWNrUGljaz4+ID0+IHtcblx0XHRcdFx0Y29uc3QgYWRkaXRpb25hbENvbW1hbmRQaWNrcyA9IGF3YWl0IHRoaXMuZ2V0QWRkaXRpb25hbENvbW1hbmRQaWNrcyhhbGxDb21tYW5kUGlja3MsIGZpbHRlcmVkQ29tbWFuZFBpY2tzLCBmaWx0ZXIsIHRva2VuKTtcblx0XHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgY29tbWFuZFBpY2tzOiBBcnJheTxJQ29tbWFuZFF1aWNrUGljayB8IElRdWlja1BpY2tTZXBhcmF0b3I+ID0gYWRkaXRpb25hbENvbW1hbmRQaWNrcy5tYXAoY29tbWFuZFBpY2sgPT4gdGhpcy50b0NvbW1hbmRQaWNrKGNvbW1hbmRQaWNrLCBydW5PcHRpb25zKSk7XG5cdFx0XHRcdC8vIEJhc2ljYWxseSwgaWYgd2UgaGF2ZW4ndCBhbHJlYWR5IGFkZGVkIGEgc2VwYXJhdG9yLCB3ZSBhZGQgb25lIGJlZm9yZSB0aGUgYWRkaXRpb25hbCBwaWNrcyBzbyBsb25nXG5cdFx0XHRcdC8vIGFzIG9uZSBoYXNuJ3QgYmVlbiBhZGRlZCB0byB0aGUgc3RhcnQgb2YgdGhlIGFycmF5LlxuXHRcdFx0XHRpZiAoYWRkU3VnZ2VzdGVkU2VwYXJhdG9yICYmIGNvbW1hbmRQaWNrc1swXT8udHlwZSAhPT0gJ3NlcGFyYXRvcicpIHtcblx0XHRcdFx0XHRjb21tYW5kUGlja3MudW5zaGlmdCh7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogbG9jYWxpemUoJ3N1Z2dlc3RlZCcsIFwic2ltaWxhciBjb21tYW5kc1wiKSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gY29tbWFuZFBpY2tzO1xuXHRcdFx0fSkoKVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHRvQ29tbWFuZFBpY2soY29tbWFuZFBpY2s6IElDb21tYW5kUXVpY2tQaWNrIHwgSVF1aWNrUGlja1NlcGFyYXRvciwgcnVuT3B0aW9ucz86IElRdWlja0FjY2Vzc1Byb3ZpZGVyUnVuT3B0aW9ucyk6IElDb21tYW5kUXVpY2tQaWNrIHwgSVF1aWNrUGlja1NlcGFyYXRvciB7XG5cdFx0aWYgKGNvbW1hbmRQaWNrLnR5cGUgPT09ICdzZXBhcmF0b3InKSB7XG5cdFx0XHRyZXR1cm4gY29tbWFuZFBpY2s7XG5cdFx0fVxuXG5cdFx0Y29uc3Qga2V5YmluZGluZyA9IHRoaXMua2V5YmluZGluZ1NlcnZpY2UubG9va3VwS2V5YmluZGluZyhjb21tYW5kUGljay5jb21tYW5kSWQpO1xuXHRcdGNvbnN0IGFyaWFMYWJlbCA9IGtleWJpbmRpbmcgP1xuXHRcdFx0bG9jYWxpemUoJ2NvbW1hbmRQaWNrQXJpYUxhYmVsV2l0aEtleWJpbmRpbmcnLCBcInswfSwgezF9XCIsIGNvbW1hbmRQaWNrLmxhYmVsLCBrZXliaW5kaW5nLmdldEFyaWFMYWJlbCgpKSA6XG5cdFx0XHRjb21tYW5kUGljay5sYWJlbDtcblxuXHRcdHJldHVybiB7XG5cdFx0XHQuLi5jb21tYW5kUGljayxcblx0XHRcdGFyaWFMYWJlbCxcblx0XHRcdGRldGFpbDogdGhpcy5vcHRpb25zLnNob3dBbGlhcyAmJiBjb21tYW5kUGljay5jb21tYW5kQWxpYXMgIT09IGNvbW1hbmRQaWNrLmxhYmVsID8gY29tbWFuZFBpY2suY29tbWFuZEFsaWFzIDogdW5kZWZpbmVkLFxuXHRcdFx0a2V5YmluZGluZyxcblx0XHRcdGFjY2VwdDogYXN5bmMgKCkgPT4ge1xuXG5cdFx0XHRcdC8vIEFkZCB0byBoaXN0b3J5XG5cdFx0XHRcdHRoaXMuY29tbWFuZHNIaXN0b3J5LnB1c2goY29tbWFuZFBpY2suY29tbWFuZElkKTtcblxuXHRcdFx0XHQvLyBUZWxlbWVudHJ5XG5cdFx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkRXZlbnQsIFdvcmtiZW5jaEFjdGlvbkV4ZWN1dGVkQ2xhc3NpZmljYXRpb24+KCd3b3JrYmVuY2hBY3Rpb25FeGVjdXRlZCcsIHtcblx0XHRcdFx0XHRpZDogY29tbWFuZFBpY2suY29tbWFuZElkLFxuXHRcdFx0XHRcdGZyb206IHJ1bk9wdGlvbnM/LmZyb20gPz8gJ3F1aWNrIG9wZW4nXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdC8vIFJ1blxuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNvbW1hbmRQaWNrLmFyZ3M/Lmxlbmd0aFxuXHRcdFx0XHRcdFx0PyBhd2FpdCB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGNvbW1hbmRQaWNrLmNvbW1hbmRJZCwgLi4uY29tbWFuZFBpY2suYXJncylcblx0XHRcdFx0XHRcdDogYXdhaXQgdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChjb21tYW5kUGljay5jb21tYW5kSWQpO1xuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdGlmICghaXNDYW5jZWxsYXRpb25FcnJvcihlcnJvcikpIHtcblx0XHRcdFx0XHRcdHRoaXMuZGlhbG9nU2VydmljZS5lcnJvcihsb2NhbGl6ZSgnY2FuTm90UnVuJywgXCJDb21tYW5kICd7MH0nIHJlc3VsdGVkIGluIGFuIGVycm9yXCIsIGNvbW1hbmRQaWNrLmxhYmVsKSwgdG9FcnJvck1lc3NhZ2UoZXJyb3IpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0Ly8gVEYtSURGIHN0cmluZyB0byBiZSBpbmRleGVkXG5cdHByaXZhdGUgZ2V0VGZJZGZDaHVuayh7IGxhYmVsLCBjb21tYW5kQWxpYXMsIGNvbW1hbmREZXNjcmlwdGlvbiB9OiBJQ29tbWFuZFF1aWNrUGljaykge1xuXHRcdGxldCBjaHVuayA9IGxhYmVsO1xuXHRcdGlmIChjb21tYW5kQWxpYXMgJiYgY29tbWFuZEFsaWFzICE9PSBsYWJlbCkge1xuXHRcdFx0Y2h1bmsgKz0gYCAtICR7Y29tbWFuZEFsaWFzfWA7XG5cdFx0fVxuXHRcdGlmIChjb21tYW5kRGVzY3JpcHRpb24gJiYgY29tbWFuZERlc2NyaXB0aW9uLnZhbHVlICE9PSBsYWJlbCkge1xuXHRcdFx0Ly8gSWYgdGhlIG9yaWdpbmFsIGlzIHRoZSBzYW1lIGFzIHRoZSB2YWx1ZSwgZG9uJ3QgYWRkIGl0XG5cdFx0XHRjaHVuayArPSBgIC0gJHtjb21tYW5kRGVzY3JpcHRpb24udmFsdWUgPT09IGNvbW1hbmREZXNjcmlwdGlvbi5vcmlnaW5hbCA/IGNvbW1hbmREZXNjcmlwdGlvbi52YWx1ZSA6IGAke2NvbW1hbmREZXNjcmlwdGlvbi52YWx1ZX0gKCR7Y29tbWFuZERlc2NyaXB0aW9uLm9yaWdpbmFsfSlgfWA7XG5cdFx0fVxuXHRcdHJldHVybiBjaHVuaztcblx0fVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBnZXRDb21tYW5kUGlja3ModG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxBcnJheTxJQ29tbWFuZFF1aWNrUGljaz4+O1xuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBoYXNBZGRpdGlvbmFsQ29tbWFuZFBpY2tzKGZpbHRlcjogc3RyaW5nLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBib29sZWFuO1xuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgZ2V0QWRkaXRpb25hbENvbW1hbmRQaWNrcyhhbGxQaWNrczogSUNvbW1hbmRRdWlja1BpY2tbXSwgcGlja3NTb0ZhcjogSUNvbW1hbmRRdWlja1BpY2tbXSwgZmlsdGVyOiBzdHJpbmcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8QXJyYXk8SUNvbW1hbmRRdWlja1BpY2sgfCBJUXVpY2tQaWNrU2VwYXJhdG9yPj47XG59XG5cbmludGVyZmFjZSBJU2VyaWFsaXplZENvbW1hbmRIaXN0b3J5IHtcblx0cmVhZG9ubHkgdXNlc0xSVT86IGJvb2xlYW47XG5cdHJlYWRvbmx5IGVudHJpZXM6IHsga2V5OiBzdHJpbmc7IHZhbHVlOiBudW1iZXIgfVtdO1xufVxuXG5pbnRlcmZhY2UgSUNvbW1hbmRzUXVpY2tBY2Nlc3NDb25maWd1cmF0aW9uIHtcblx0cmVhZG9ubHkgd29ya2JlbmNoOiB7XG5cdFx0cmVhZG9ubHkgY29tbWFuZFBhbGV0dGU6IHtcblx0XHRcdHJlYWRvbmx5IGhpc3Rvcnk6IG51bWJlcjtcblx0XHRcdHJlYWRvbmx5IHByZXNlcnZlSW5wdXQ6IGJvb2xlYW47XG5cdFx0fTtcblx0fTtcbn1cblxuZXhwb3J0IGNsYXNzIENvbW1hbmRzSGlzdG9yeSBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHN0YXRpYyByZWFkb25seSBERUZBVUxUX0NPTU1BTkRTX0hJU1RPUllfTEVOR1RIID0gNTA7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgUFJFRl9LRVlfQ0FDSEUgPSAnY29tbWFuZFBhbGV0dGUubXJ1LmNhY2hlJztcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgUFJFRl9LRVlfQ09VTlRFUiA9ICdjb21tYW5kUGFsZXR0ZS5tcnUuY291bnRlcic7XG5cblx0cHJpdmF0ZSBzdGF0aWMgY2FjaGU6IExSVUNhY2hlPHN0cmluZywgbnVtYmVyPiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBzdGF0aWMgY291bnRlciA9IDE7XG5cdHByaXZhdGUgc3RhdGljIGhhc0NoYW5nZXMgPSBmYWxzZTtcblxuXHRwcml2YXRlIGNvbmZpZ3VyZWRDb21tYW5kc0hpc3RvcnlMZW5ndGggPSAwO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnVwZGF0ZUNvbmZpZ3VyYXRpb24oKTtcblx0XHR0aGlzLmxvYWQoKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB0aGlzLnVwZGF0ZUNvbmZpZ3VyYXRpb24oZSkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnN0b3JhZ2VTZXJ2aWNlLm9uV2lsbFNhdmVTdGF0ZShlID0+IHtcblx0XHRcdGlmIChlLnJlYXNvbiA9PT0gV2lsbFNhdmVTdGF0ZVJlYXNvbi5TSFVURE9XTikge1xuXHRcdFx0XHQvLyBDb21tYW5kcyBoaXN0b3J5IGlzIHZlcnkgZHluYW1pYyBhbmQgc28gd2UgbGltaXQgaW1wYWN0XG5cdFx0XHRcdC8vIG9uIHN0b3JhZ2UgdG8gb25seSBzYXZlIG9uIHNodXRkb3duLiBUaGlzIGhlbHBzIHJlZHVjZVxuXHRcdFx0XHQvLyB0aGUgb3ZlcmhlYWQgb2Ygc3luY2luZyB0aGlzIGRhdGEgYWNyb3NzIG1hY2hpbmVzLlxuXHRcdFx0XHR0aGlzLnNhdmVTdGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlQ29uZmlndXJhdGlvbihlPzogSUNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudCk6IHZvaWQge1xuXHRcdGlmIChlICYmICFlLmFmZmVjdHNDb25maWd1cmF0aW9uKCd3b3JrYmVuY2guY29tbWFuZFBhbGV0dGUuaGlzdG9yeScpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5jb25maWd1cmVkQ29tbWFuZHNIaXN0b3J5TGVuZ3RoID0gQ29tbWFuZHNIaXN0b3J5LmdldENvbmZpZ3VyZWRDb21tYW5kSGlzdG9yeUxlbmd0aCh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblxuXHRcdGlmIChDb21tYW5kc0hpc3RvcnkuY2FjaGUgJiYgQ29tbWFuZHNIaXN0b3J5LmNhY2hlLmxpbWl0ICE9PSB0aGlzLmNvbmZpZ3VyZWRDb21tYW5kc0hpc3RvcnlMZW5ndGgpIHtcblx0XHRcdENvbW1hbmRzSGlzdG9yeS5jYWNoZS5saW1pdCA9IHRoaXMuY29uZmlndXJlZENvbW1hbmRzSGlzdG9yeUxlbmd0aDtcblx0XHRcdENvbW1hbmRzSGlzdG9yeS5oYXNDaGFuZ2VzID0gdHJ1ZTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGxvYWQoKTogdm9pZCB7XG5cdFx0Y29uc3QgcmF3ID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQoQ29tbWFuZHNIaXN0b3J5LlBSRUZfS0VZX0NBQ0hFLCBTdG9yYWdlU2NvcGUuUFJPRklMRSk7XG5cdFx0bGV0IHNlcmlhbGl6ZWRDYWNoZTogSVNlcmlhbGl6ZWRDb21tYW5kSGlzdG9yeSB8IHVuZGVmaW5lZDtcblx0XHRpZiAocmF3KSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRzZXJpYWxpemVkQ2FjaGUgPSBKU09OLnBhcnNlKHJhdyk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYFtDb21tYW5kc0hpc3RvcnldIGludmFsaWQgZGF0YTogJHtlcnJvcn1gKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBjYWNoZSA9IENvbW1hbmRzSGlzdG9yeS5jYWNoZSA9IG5ldyBMUlVDYWNoZTxzdHJpbmcsIG51bWJlcj4odGhpcy5jb25maWd1cmVkQ29tbWFuZHNIaXN0b3J5TGVuZ3RoLCAxKTtcblx0XHRpZiAoc2VyaWFsaXplZENhY2hlKSB7XG5cdFx0XHRsZXQgZW50cmllczogeyBrZXk6IHN0cmluZzsgdmFsdWU6IG51bWJlciB9W107XG5cdFx0XHRpZiAoc2VyaWFsaXplZENhY2hlLnVzZXNMUlUpIHtcblx0XHRcdFx0ZW50cmllcyA9IHNlcmlhbGl6ZWRDYWNoZS5lbnRyaWVzO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZW50cmllcyA9IHNlcmlhbGl6ZWRDYWNoZS5lbnRyaWVzLnNvcnQoKGEsIGIpID0+IGEudmFsdWUgLSBiLnZhbHVlKTtcblx0XHRcdH1cblx0XHRcdGVudHJpZXMuZm9yRWFjaChlbnRyeSA9PiBjYWNoZS5zZXQoZW50cnkua2V5LCBlbnRyeS52YWx1ZSkpO1xuXHRcdH1cblxuXHRcdENvbW1hbmRzSGlzdG9yeS5jb3VudGVyID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXROdW1iZXIoQ29tbWFuZHNIaXN0b3J5LlBSRUZfS0VZX0NPVU5URVIsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBDb21tYW5kc0hpc3RvcnkuY291bnRlcik7XG5cdH1cblxuXHRwdXNoKGNvbW1hbmRJZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKCFDb21tYW5kc0hpc3RvcnkuY2FjaGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRDb21tYW5kc0hpc3RvcnkuY2FjaGUuc2V0KGNvbW1hbmRJZCwgQ29tbWFuZHNIaXN0b3J5LmNvdW50ZXIrKyk7IC8vIHNldCBjb3VudGVyIHRvIGNvbW1hbmRcblx0XHRDb21tYW5kc0hpc3RvcnkuaGFzQ2hhbmdlcyA9IHRydWU7XG5cdH1cblxuXHRwZWVrKGNvbW1hbmRJZDogc3RyaW5nKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gQ29tbWFuZHNIaXN0b3J5LmNhY2hlPy5wZWVrKGNvbW1hbmRJZCk7XG5cdH1cblxuXHRwcml2YXRlIHNhdmVTdGF0ZSgpOiB2b2lkIHtcblx0XHRpZiAoIUNvbW1hbmRzSGlzdG9yeS5jYWNoZSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghQ29tbWFuZHNIaXN0b3J5Lmhhc0NoYW5nZXMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzZXJpYWxpemVkQ2FjaGU6IElTZXJpYWxpemVkQ29tbWFuZEhpc3RvcnkgPSB7IHVzZXNMUlU6IHRydWUsIGVudHJpZXM6IFtdIH07XG5cdFx0Q29tbWFuZHNIaXN0b3J5LmNhY2hlLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHNlcmlhbGl6ZWRDYWNoZS5lbnRyaWVzLnB1c2goeyBrZXksIHZhbHVlIH0pKTtcblxuXHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoQ29tbWFuZHNIaXN0b3J5LlBSRUZfS0VZX0NBQ0hFLCBKU09OLnN0cmluZ2lmeShzZXJpYWxpemVkQ2FjaGUpLCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKENvbW1hbmRzSGlzdG9yeS5QUkVGX0tFWV9DT1VOVEVSLCBDb21tYW5kc0hpc3RvcnkuY291bnRlciwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cdFx0Q29tbWFuZHNIaXN0b3J5Lmhhc0NoYW5nZXMgPSBmYWxzZTtcblx0fVxuXG5cdHN0YXRpYyBnZXRDb25maWd1cmVkQ29tbWFuZEhpc3RvcnlMZW5ndGgoY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSk6IG51bWJlciB7XG5cdFx0Y29uc3QgY29uZmlnID0gPElDb21tYW5kc1F1aWNrQWNjZXNzQ29uZmlndXJhdGlvbj5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgpO1xuXG5cdFx0Y29uc3QgY29uZmlndXJlZENvbW1hbmRIaXN0b3J5TGVuZ3RoID0gY29uZmlnLndvcmtiZW5jaD8uY29tbWFuZFBhbGV0dGU/Lmhpc3Rvcnk7XG5cdFx0aWYgKHR5cGVvZiBjb25maWd1cmVkQ29tbWFuZEhpc3RvcnlMZW5ndGggPT09ICdudW1iZXInKSB7XG5cdFx0XHRyZXR1cm4gY29uZmlndXJlZENvbW1hbmRIaXN0b3J5TGVuZ3RoO1xuXHRcdH1cblxuXHRcdHJldHVybiBDb21tYW5kc0hpc3RvcnkuREVGQVVMVF9DT01NQU5EU19ISVNUT1JZX0xFTkdUSDtcblx0fVxuXG5cdHN0YXRpYyBjbGVhckhpc3RvcnkoY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSwgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbW1hbmRIaXN0b3J5TGVuZ3RoID0gQ29tbWFuZHNIaXN0b3J5LmdldENvbmZpZ3VyZWRDb21tYW5kSGlzdG9yeUxlbmd0aChjb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0Q29tbWFuZHNIaXN0b3J5LmNhY2hlID0gbmV3IExSVUNhY2hlPHN0cmluZywgbnVtYmVyPihjb21tYW5kSGlzdG9yeUxlbmd0aCk7XG5cdFx0Q29tbWFuZHNIaXN0b3J5LmNvdW50ZXIgPSAxO1xuXG5cdFx0Q29tbWFuZHNIaXN0b3J5Lmhhc0NoYW5nZXMgPSB0cnVlO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU9BLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsNEJBQTRCLGVBQWUsY0FBYyxVQUFVO0FBQzVFLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsa0JBQWdEO0FBQ3pELFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsaUJBQWlCLDRCQUE0QjtBQUN0RCxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFvQyw2QkFBNkI7QUFDakUsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBc0YsaUNBQXdDO0FBRzlILFNBQVMsaUJBQWlCLGNBQWMsZUFBZSwyQkFBMkI7QUFDbEYsU0FBUyx5QkFBeUI7QUFnQjNCLElBQWUsc0NBQWYsY0FBMkQsMEJBQW9FO0FBQUEsRUFhckksWUFDQyxTQUN3QyxzQkFDRCxtQkFDTCxnQkFD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
