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
import { Emitter, Event } from "../../../../../base/common/event.js";
import { combinedDisposable, Disposable, MutableDisposable } from "../../../../../base/common/lifecycle.js";
import { sep } from "../../../../../base/common/path.js";
import { commonPrefixLength } from "../../../../../base/common/strings.js";
import { editorSuggestWidgetSelectedBackground } from "../../../../../editor/contrib/suggest/browser/suggestWidget.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { TerminalCapability } from "../../../../../platform/terminal/common/capabilities/capabilities.js";
import { getListStyles } from "../../../../../platform/theme/browser/defaultStyles.js";
import { activeContrastBorder } from "../../../../../platform/theme/common/colorRegistry.js";
import { TerminalStorageKeys } from "../../../terminal/common/terminalStorageKeys.js";
import { terminalSuggestConfigSection, TerminalSuggestSettingId } from "../common/terminalSuggestConfiguration.js";
import { LineContext } from "../../../../services/suggest/browser/simpleCompletionModel.js";
import { SimpleSuggestWidget } from "../../../../services/suggest/browser/simpleSuggestWidget.js";
import { ITerminalCompletionService } from "./terminalCompletionService.js";
import { TerminalSettingId } from "../../../../../platform/terminal/common/terminal.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import { MenuId } from "../../../../../platform/actions/common/actions.js";
import { ITerminalConfigurationService } from "../../../terminal/browser/terminal.js";
import { GOLDEN_LINE_HEIGHT_RATIO, MINIMUM_LINE_HEIGHT } from "../../../../../editor/common/config/fontInfo.js";
import { TerminalCompletionModel } from "./terminalCompletionModel.js";
import { TerminalCompletionItem, TerminalCompletionItemKind } from "./terminalCompletionItem.js";
import { IntervalTimer, TimeoutTimer } from "../../../../../base/common/async.js";
import { localize } from "../../../../../nls.js";
import { TerminalSuggestTelemetry } from "./terminalSuggestTelemetry.js";
import { terminalSymbolAliasIcon, terminalSymbolArgumentIcon, terminalSymbolEnumMember, terminalSymbolFileIcon, terminalSymbolFlagIcon, terminalSymbolInlineSuggestionIcon, terminalSymbolMethodIcon, terminalSymbolOptionIcon, terminalSymbolFolderIcon } from "./terminalSymbolIcons.js";
let SuggestAddon = class extends Disposable {
  constructor(shellType, _capabilities, _terminalSuggestWidgetVisibleContextKey, _terminalCompletionService, _configurationService, _instantiationService, _extensionService, _terminalConfigurationService) {
    super();
    this._capabilities = _capabilities;
    this._terminalSuggestWidgetVisibleContextKey = _terminalSuggestWidgetVisibleContextKey;
    this._terminalCompletionService = _terminalCompletionService;
    this._configurationService = _configurationService;
    this._instantiationService = _instantiationService;
    this._extensionService = _extensionService;
    this._terminalConfigurationService = _terminalConfigurationService;
    this._promptInputModelSubscriptions = this._register(new MutableDisposable());
    this._enableWidget = true;
    this._pathSeparator = sep;
    this._isFilteringDirectories = false;
    this._cursorIndexDelta = 0;
    this._requestedCompletionsIndex = 0;
    this._lastUserDataTimestamp = 0;
    this.isPasting = false;
    this._onBell = this._register(new Emitter());
    this.onBell = this._onBell.event;
    this._onAcceptedCompletion = this._register(new Emitter());
    this.onAcceptedCompletion = this._onAcceptedCompletion.event;
    this._onDidReceiveCompletions = this._register(new Emitter());
    this.onDidReceiveCompletions = this._onDidReceiveCompletions.event;
    this._onDidFontConfigurationChange = this._register(new Emitter());
    this.onDidFontConfigurationChange = this._onDidFontConfigurationChange.event;
    this._kindToIconMap = /* @__PURE__ */ new Map([
      [TerminalCompletionItemKind.File, terminalSymbolFileIcon],
      [TerminalCompletionItemKind.Folder, terminalSymbolFolderIcon],
      [TerminalCompletionItemKind.Method, terminalSymbolMethodIcon],
      [TerminalCompletionItemKind.Alias, terminalSymbolAliasIcon],
      [TerminalCompletionItemKind.Argument, terminalSymbolArgumentIcon],
      [TerminalCompletionItemKind.Option, terminalSymbolOptionIcon],
      [TerminalCompletionItemKind.OptionValue, terminalSymbolEnumMember],
      [TerminalCompletionItemKind.Flag, terminalSymbolFlagIcon],
      [TerminalCompletionItemKind.InlineSuggestion, terminalSymbolInlineSuggestionIcon],
      [TerminalCompletionItemKind.InlineSuggestionAlwaysOnTop, terminalSymbolInlineSuggestionIcon]
    ]);
    this._kindToKindLabelMap = /* @__PURE__ */ new Map([
      [TerminalCompletionItemKind.File, localize("file", "File")],
      [TerminalCompletionItemKind.Folder, localize("folder", "Folder")],
      [TerminalCompletionItemKind.Method, localize("method", "Method")],
      [TerminalCompletionItemKind.Alias, localize("alias", "Alias")],
      [TerminalCompletionItemKind.Argument, localize("argument", "Argument")],
      [TerminalCompletionItemKind.Option, localize("option", "Option")],
      [TerminalCompletionItemKind.OptionValue, localize("optionValue", "Option Value")],
      [TerminalCompletionItemKind.Flag, localize("flag", "Flag")],
      [TerminalCompletionItemKind.InlineSuggestion, localize("inlineSuggestion", "Inline Suggestion")],
      [TerminalCompletionItemKind.InlineSuggestionAlwaysOnTop, localize("inlineSuggestionAlwaysOnTop", "Inline Suggestion")]
    ]);
    this._inlineCompletion = {
      label: "",
      // Right arrow is used to accept the completion. This is a common keybinding in pwsh, zsh
      // and fish.
      inputData: "\x1B[C",
      replacementIndex: 0,
      replacementLength: 0,
      provider: "core",
      detail: "Inline suggestion",
      kind: TerminalCompletionItemKind.InlineSuggestion,
      kindLabel: "Inline suggestion",
      icon: this._kindToIconMap.get(TerminalCompletionItemKind.InlineSuggestion)
    };
    this._inlineCompletionItem = new TerminalCompletionItem(this._inlineCompletion);
    this._shouldSyncWhenReady = false;
    this.shellType = shellType;
    if (this.shellType) {
      this._shellTypeInit = Promise.resolve();
    } else {
      const intervalTimer = this._register(new IntervalTimer());
      const timeoutTimer = this._register(new TimeoutTimer());
      this._shellTypeInit = new Promise((r) => {
        intervalTimer.cancelAndSet(() => {
          if (this.shellType) {
            r();
          }
        }, 50);
        timeoutTimer.cancelAndSet(r, 5e3);
      }).then(() => {
        this._store.delete(intervalTimer);
        this._store.delete(timeoutTimer);
      });
    }
    this._register(Event.runAndSubscribe(Event.any(
      this._capabilities.onDidAddCapabilityType,
      this._capabilities.onDidRemoveCapabilityType
    ), () => {
      const commandDetection = this._capabilities.get(TerminalCapability.CommandDetection);
      if (commandDetection) {
        if (this._promptInputModel !== commandDetection.promptInputModel) {
          this._promptInputModel = commandDetection.promptInputModel;
          this._suggestTelemetry = this._register(this._instantiationService.createInstance(TerminalSuggestTelemetry, commandDetection, this._promptInputModel));
          this._promptInputModelSubscriptions.value = combinedDisposable(
            this._promptInputModel.onDidChangeInput((e) => this._sync(e)),
            this._promptInputModel.onDidFinishInput(() => {
              this.hideSuggestWidget(true);
            })
          );
          if (this._shouldSyncWhenReady) {
            this._sync(this._promptInputModel);
            this._shouldSyncWhenReady = false;
          }
        }
      } else {
        this._promptInputModel = void 0;
      }
    }));
    this._register(this._terminalConfigurationService.onConfigChanged(() => this._cachedFontInfo = void 0));
    this._register(Event.runAndSubscribe(this._configurationService.onDidChangeConfiguration, (e) => {
      if (!e || e.affectsConfiguration(TerminalSuggestSettingId.InlineSuggestion)) {
        const value = this._configurationService.getValue(terminalSuggestConfigSection).inlineSuggestion;
        this._inlineCompletionItem.isInvalid = value === "off";
        switch (value) {
          case "alwaysOnTopExceptExactMatch": {
            this._inlineCompletion.kind = TerminalCompletionItemKind.InlineSuggestion;
            break;
          }
          case "alwaysOnTop":
          default: {
            this._inlineCompletion.kind = TerminalCompletionItemKind.InlineSuggestionAlwaysOnTop;
            break;
          }
        }
        this._model?.forceRefilterAll();
      }
    }));
  }
  activate(xterm) {
    this._terminal = xterm;
    this._register(xterm.onKey(async (e) => {
      this._lastUserData = e.key;
      this._lastUserDataTimestamp = Date.now();
    }));
    this._register(xterm.onScroll(() => this.hideSuggestWidget(true)));
  }
  async _handleCompletionProviders(terminal, token, explicitlyInvoked) {
    if (!terminal?.element || !this._enableWidget || !this._promptInputModel) {
      return;
    }
    if (!dom.isAncestorOfActiveElement(terminal.element)) {
      return;
    }
    await this._shellTypeInit;
    if (!this.shellType) {
      return;
    }
    let doNotRequestExtensionCompletions = false;
    if (this._lastUserDataTimestamp < SuggestAddon.lastAcceptedCompletionTimestamp) {
      doNotRequestExtensionCompletions = true;
    }
    if (!doNotRequestExtensionCompletions) {
      await this._extensionService.activateByEvent("onTerminalCompletionsRequested");
    }
    this._currentPromptInputState = {
      value: this._promptInputModel.value,
      prefix: this._promptInputModel.prefix,
      suffix: this._promptInputModel.suffix,
      cursorIndex: this._promptInputModel.cursorIndex,
      ghostTextIndex: this._promptInputModel.ghostTextIndex
    };
    this._requestedCompletionsIndex = this._currentPromptInputState.cursorIndex;
    const quickSuggestionsConfig = this._configurationService.getValue(terminalSuggestConfigSection).quickSuggestions;
    const allowFallbackCompletions = explicitlyInvoked || quickSuggestionsConfig.unknown === "on";
    const providedCompletions = await this._terminalCompletionService.provideCompletions(this._currentPromptInputState.prefix, this._currentPromptInputState.cursorIndex, allowFallbackCompletions, this.shellType, this._capabilities, token, doNotRequestExtensionCompletions);
    if (token.isCancellationRequested) {
      return;
    }
    this._onDidReceiveCompletions.fire();
    this._cursorIndexDelta = this._promptInputModel.cursorIndex - this._requestedCompletionsIndex;
    this._leadingLineContent = this._promptInputModel.prefix.substring(0, this._requestedCompletionsIndex + this._cursorIndexDelta);
    const completions = providedCompletions?.flat() || [];
    if (!explicitlyInvoked && !completions.length) {
      this.hideSuggestWidget(true);
      return;
    }
    const firstChar = this._leadingLineContent.length === 0 ? "" : this._leadingLineContent[0];
    if (this._leadingLineContent.includes(" ") || firstChar === "[") {
      this._leadingLineContent = this._promptInputModel.prefix;
    }
    let normalizedLeadingLineContent = this._leadingLineContent;
    this._isFilteringDirectories = completions.some((e) => e.kind === TerminalCompletionItemKind.Folder);
    if (this._isFilteringDirectories) {
      const firstDir = completions.find((e) => e.kind === TerminalCompletionItemKind.Folder);
      const textLabel = typeof firstDir?.label === "string" ? firstDir.label : firstDir?.label.label;
      this._pathSeparator = textLabel?.match(/(?<sep>[\\\/])/)?.groups?.sep ?? sep;
      normalizedLeadingLineContent = normalizePathSeparator(normalizedLeadingLineContent, this._pathSeparator);
    }
    this._refreshInlineCompletion(completions);
    for (const completion of completions) {
      if (!completion.icon && completion.kind !== void 0) {
        completion.icon = this._kindToIconMap.get(completion.kind);
        completion.kindLabel = this._kindToKindLabelMap.get(completion.kind);
      }
    }
    const lineContext = new LineContext(normalizedLeadingLineContent, this._cursorIndexDelta);
    const model = new TerminalCompletionModel(
      [
        ...completions.filter((c) => !!c.label).map((c) => new TerminalCompletionItem(c)),
        this._inlineCompletionItem
      ],
      lineContext
    );
    if (token.isCancellationRequested) {
      return;
    }
    this._showCompletions(model, explicitlyInvoked);
  }
  setContainerWithOverflow(container) {
    this._container = container;
  }
  setScreen(screen) {
    this._screen = screen;
  }
  toggleExplainMode() {
    this._suggestWidget?.toggleExplainMode();
  }
  toggleSuggestionFocus() {
    this._suggestWidget?.toggleDetailsFocus();
  }
  toggleSuggestionDetails() {
    this._suggestWidget?.toggleDetails();
  }
  resetWidgetSize() {
    this._suggestWidget?.resetWidgetSize();
  }
  async requestCompletions(explicitlyInvoked) {
    if (!this._promptInputModel) {
      this._shouldSyncWhenReady = true;
      return;
    }
    if (this.isPasting) {
      return;
    }
    if (this._cancellationTokenSource) {
      this._cancellationTokenSource.cancel();
      this._cancellationTokenSource.dispose();
    }
    this._cancellationTokenSource = new CancellationTokenSource();
    const token = this._cancellationTokenSource.token;
    await this._handleCompletionProviders(this._terminal, token, explicitlyInvoked);
  }
  _addPropertiesToInlineCompletionItem(completions) {
    const inlineCompletionLabel = (typeof this._inlineCompletionItem.completion.label === "string" ? this._inlineCompletionItem.completion.label : this._inlineCompletionItem.completion.label.label).trim();
    const inlineCompletionMatchIndex = completions.findIndex((c) => typeof c.label === "string" ? c.label === inlineCompletionLabel : c.label.label === inlineCompletionLabel);
    if (inlineCompletionMatchIndex !== -1) {
      const richCompletionMatchingInline = completions.splice(inlineCompletionMatchIndex, 1)[0];
      this._inlineCompletionItem.completion.label = richCompletionMatchingInline.label;
      this._inlineCompletionItem.completion.detail = richCompletionMatchingInline.detail;
      this._inlineCompletionItem.completion.documentation = richCompletionMatchingInline.documentation;
    } else if (this._inlineCompletionItem.completion) {
      this._inlineCompletionItem.completion.detail = void 0;
      this._inlineCompletionItem.completion.documentation = void 0;
    }
  }
  _requestTriggerCharQuickSuggestCompletions() {
    if (!this._wasLastInputVerticalArrowKey()) {
      if (!this._wasLastInputIncludedEscape() || this._terminalSuggestWidgetVisibleContextKey.get()) {
        this.requestCompletions();
        return true;
      }
    }
    return false;
  }
  _wasLastInputRightArrowKey() {
    return !!this._lastUserData?.match(/^\x1b[\[O]?C$/);
  }
  _wasLastInputVerticalArrowKey() {
    return !!this._lastUserData?.match(/^\x1b[\[O]?[A-B]$/);
  }
  /**
   * Whether the last input included the escape character. Typically this will mean it was more
   * than just a simple character, such as arrow keys, home, end, etc.
   */
  _wasLastInputIncludedEscape() {
    return !!this._lastUserData?.includes("\x1B");
  }
  _wasLastInputArrowKey() {
    return !!this._lastUserData?.match(/^\x1b[\[O]?[A-D]$/);
  }
  _sync(promptInputState) {
    const config = this._configurationService.getValue(terminalSuggestConfigSection);
    {
      let sent = false;
      if (!this._mostRecentPromptInputState || promptInputState.cursorIndex > this._mostRecentPromptInputState.cursorIndex) {
        if (!this._terminalSuggestWidgetVisibleContextKey.get()) {
          const commandLineHasSpace = promptInputState.prefix.trim().match(/\s/);
          if (!commandLineHasSpace && config.quickSuggestions.commands !== "off" || commandLineHasSpace && config.quickSuggestions.arguments !== "off") {
            if (promptInputState.prefix.match(/[^\s]$/)) {
              sent = this._requestTriggerCharQuickSuggestCompletions();
            }
          }
        }
        if (config.suggestOnTriggerCharacters && !sent) {
          const prefix = promptInputState.prefix;
          if (
            // Only trigger on `-` if it's after a space. This is required to not clear
            // completions when typing the `-` in `git cherry-pick`
            prefix?.match(/\s[\-]$/) || // Only trigger on `\` and `/` if it's a directory. Not doing so causes problems
            // with git branches in particular
            this._isFilteringDirectories && prefix?.match(/[\\\/]$/)
          ) {
            sent = this._requestTriggerCharQuickSuggestCompletions();
          }
          if (!sent) {
            for (const provider of this._terminalCompletionService.providers) {
              if (!provider.triggerCharacters) {
                continue;
              }
              for (const char of provider.triggerCharacters) {
                if (prefix?.endsWith(char)) {
                  sent = this._requestTriggerCharQuickSuggestCompletions();
                  break;
                }
              }
            }
          }
        }
      }
      if (this._mostRecentPromptInputState && promptInputState.cursorIndex < this._mostRecentPromptInputState.cursorIndex && promptInputState.cursorIndex > 0) {
        if (this._terminalSuggestWidgetVisibleContextKey.get()) {
          if (config.suggestOnTriggerCharacters && !sent && this._mostRecentPromptInputState.cursorIndex > 0) {
            const char = this._mostRecentPromptInputState.value[this._mostRecentPromptInputState.cursorIndex - 1];
            if (
              // Only trigger on `\` and `/` if it's a directory. Not doing so causes problems
              // with git branches in particular
              this._isFilteringDirectories && char.match(/[\\\/]$/)
            ) {
              sent = this._requestTriggerCharQuickSuggestCompletions();
            }
          }
        }
      }
    }
    if (this._wasLastInputRightArrowKey() && this._mostRecentPromptInputState?.ghostTextIndex !== -1 && promptInputState.ghostTextIndex === -1 && this._mostRecentPromptInputState?.value === promptInputState.value) {
      this.hideSuggestWidget(false);
    }
    this._mostRecentPromptInputState = promptInputState;
    if (!this._promptInputModel || !this._terminal || !this._suggestWidget || this._leadingLineContent === void 0) {
      return;
    }
    const previousPromptInputState = this._currentPromptInputState;
    this._currentPromptInputState = promptInputState;
    if (this._currentPromptInputState.cursorIndex > 1 && this._currentPromptInputState.value.at(this._currentPromptInputState.cursorIndex - 1) === " ") {
      if (!this._wasLastInputArrowKey()) {
        this.hideSuggestWidget(false);
        return;
      }
    }
    if (this._currentPromptInputState && this._currentPromptInputState.cursorIndex < this._leadingLineContent.length) {
      if (this._currentPromptInputState.cursorIndex <= 0 || previousPromptInputState?.value[this._currentPromptInputState.cursorIndex]?.match(/[\\\/\s]/)) {
        this.hideSuggestWidget(false);
        return;
      }
    }
    if (this._terminalSuggestWidgetVisibleContextKey.get()) {
      this._cursorIndexDelta = this._currentPromptInputState.cursorIndex - this._requestedCompletionsIndex;
      let normalizedLeadingLineContent = this._currentPromptInputState.value.substring(0, this._requestedCompletionsIndex + this._cursorIndexDelta);
      if (this._isFilteringDirectories) {
        normalizedLeadingLineContent = normalizePathSeparator(normalizedLeadingLineContent, this._pathSeparator);
      }
      const lineContext = new LineContext(normalizedLeadingLineContent, this._cursorIndexDelta);
      this._suggestWidget.setLineContext(lineContext);
    }
    this._refreshInlineCompletion(this._model?.items.map((i) => i.completion) || []);
    if (!this._suggestWidget.hasCompletions()) {
      this.hideSuggestWidget(false);
      return;
    }
    const dimensions = this._getTerminalDimensions();
    if (!dimensions.width || !dimensions.height) {
      return;
    }
    const xtermBox = this._screen.getBoundingClientRect();
    this._suggestWidget.showSuggestions(0, false, true, {
      left: xtermBox.left + this._terminal.buffer.active.cursorX * dimensions.width,
      top: xtermBox.top + this._terminal.buffer.active.cursorY * dimensions.height,
      height: dimensions.height
    });
  }
  _refreshInlineCompletion(completions) {
    const oldIsInvalid = this._inlineCompletionItem.isInvalid;
    if (!this._currentPromptInputState || this._currentPromptInputState.ghostTextIndex === -1) {
      this._inlineCompletionItem.isInvalid = true;
    } else {
      this._inlineCompletionItem.isInvalid = false;
      const spaceIndex = this._currentPromptInputState.value.lastIndexOf(" ", this._currentPromptInputState.ghostTextIndex - 1);
      const replacementIndex = spaceIndex === -1 ? 0 : spaceIndex + 1;
      const suggestion = this._currentPromptInputState.value.substring(replacementIndex);
      this._inlineCompletion.label = suggestion;
      this._inlineCompletion.replacementIndex = replacementIndex;
      this._inlineCompletion.replacementLength = this._currentPromptInputState.cursorIndex - replacementIndex - this._cursorIndexDelta;
      this._addPropertiesToInlineCompletionItem(completions);
      const x = new TerminalCompletionItem(this._inlineCompletion);
      this._inlineCompletionItem.idx = x.idx;
      this._inlineCompletionItem.score = x.score;
      this._inlineCompletionItem.labelLow = x.labelLow;
      this._inlineCompletionItem.textLabel = x.textLabel;
      this._inlineCompletionItem.fileExtLow = x.fileExtLow;
      this._inlineCompletionItem.labelLowExcludeFileExt = x.labelLowExcludeFileExt;
      this._inlineCompletionItem.labelLowNormalizedPath = x.labelLowNormalizedPath;
      this._inlineCompletionItem.underscorePenalty = x.underscorePenalty;
      this._inlineCompletionItem.word = x.word;
      this._model?.forceRefilterAll();
    }
    if (this._inlineCompletionItem.isInvalid !== oldIsInvalid) {
      this._model?.forceRefilterAll();
    }
  }
  _getTerminalDimensions() {
    const cssCellDims = this._terminal._core._renderService.dimensions.css.cell;
    return {
      width: cssCellDims.width,
      height: cssCellDims.height
    };
  }
  _getFontInfo() {
    if (this._cachedFontInfo) {
      return this._cachedFontInfo;
    }
    const core = this._terminal._core;
    const font = this._terminalConfigurationService.getFont(dom.getActiveWindow(), core);
    let lineHeight = font.lineHeight;
    const fontSize = font.fontSize;
    const fontFamily = font.fontFamily;
    const letterSpacing = font.letterSpacing;
    const fontWeight = this._configurationService.getValue("editor.fontWeight");
    if (lineHeight <= 1) {
      lineHeight = GOLDEN_LINE_HEIGHT_RATIO * fontSize;
    } else if (lineHeight < MINIMUM_LINE_HEIGHT) {
      lineHeight = lineHeight * fontSize;
    }
    lineHeight = Math.round(lineHeight);
    if (lineHeight < MINIMUM_LINE_HEIGHT) {
      lineHeight = MINIMUM_LINE_HEIGHT;
    }
    const fontInfo = {
      fontSize,
      lineHeight,
      fontWeight: fontWeight.toString(),
      letterSpacing,
      fontFamily
    };
    this._cachedFontInfo = fontInfo;
    return fontInfo;
  }
  _getAdvancedExplainModeDetails() {
    return `promptInputModel: ${this._promptInputModel?.getCombinedString()}`;
  }
  _showCompletions(model, explicitlyInvoked) {
    if (!this._terminal?.element) {
      return;
    }
    const suggestWidget = this._ensureSuggestWidget(this._terminal);
    suggestWidget.setCompletionModel(model);
    this._register(suggestWidget.onDidFocus(() => this._terminal?.focus()));
    if (!this._promptInputModel || !explicitlyInvoked && model.items.length === 0) {
      return;
    }
    this._model = model;
    const dimensions = this._getTerminalDimensions();
    if (!dimensions.width || !dimensions.height) {
      return;
    }
    const xtermBox = this._screen.getBoundingClientRect();
    suggestWidget.showSuggestions(0, false, !explicitlyInvoked, {
      left: xtermBox.left + this._terminal.buffer.active.cursorX * dimensions.width,
      top: xtermBox.top + this._terminal.buffer.active.cursorY * dimensions.height,
      height: dimensions.height
    });
  }
  _ensureSuggestWidget(terminal) {
    if (!this._suggestWidget) {
      this._suggestWidget = this._register(this._instantiationService.createInstance(
        SimpleSuggestWidget,
        this._container,
        this._instantiationService.createInstance(PersistedWidgetSize),
        {
          statusBarMenuId: MenuId.MenubarTerminalSuggestStatusMenu,
          showStatusBarSettingId: TerminalSuggestSettingId.ShowStatusBar
        },
        this._getFontInfo.bind(this),
        this._onDidFontConfigurationChange.event.bind(this),
        this._getAdvancedExplainModeDetails.bind(this)
      ));
      this._suggestWidget.list.style(getListStyles({
        listInactiveFocusBackground: editorSuggestWidgetSelectedBackground,
        listInactiveFocusOutline: activeContrastBorder
      }));
      this._register(this._suggestWidget.onDidSelect(async (e) => this.acceptSelectedSuggestion(e)));
      this._register(this._suggestWidget.onDidHide(() => this._terminalSuggestWidgetVisibleContextKey.reset()));
      this._register(this._suggestWidget.onDidShow(() => this._terminalSuggestWidgetVisibleContextKey.set(true)));
      this._register(this._configurationService.onDidChangeConfiguration(
        (e) => {
          if (e.affectsConfiguration(TerminalSettingId.FontFamily) || e.affectsConfiguration(TerminalSettingId.FontSize) || e.affectsConfiguration(TerminalSettingId.LineHeight) || e.affectsConfiguration(TerminalSettingId.FontFamily) || e.affectsConfiguration("editor.fontSize") || e.affectsConfiguration("editor.fontFamily")) {
            this._onDidFontConfigurationChange.fire();
          }
        }
      ));
      const element = this._terminal?.element?.querySelector(".xterm-helper-textarea");
      if (element) {
        this._register(dom.addDisposableListener(dom.getActiveDocument(), "click", (event) => {
          const target = event.target;
          if (this._terminal?.element?.contains(target)) {
            this._suggestWidget?.hide();
          }
        }));
      }
      this._register(this._suggestWidget.onDidBlurDetails((e) => {
        const elt = e.relatedTarget;
        if (this._terminal?.element?.contains(elt)) {
          return;
        }
        this._suggestWidget?.hide();
      }));
      this._terminalSuggestWidgetVisibleContextKey.set(false);
    }
    return this._suggestWidget;
  }
  selectPreviousSuggestion() {
    this._suggestWidget?.selectPrevious();
  }
  selectPreviousPageSuggestion() {
    this._suggestWidget?.selectPreviousPage();
  }
  selectNextSuggestion() {
    this._suggestWidget?.selectNext();
  }
  selectNextPageSuggestion() {
    this._suggestWidget?.selectNextPage();
  }
  acceptSelectedSuggestion(suggestion, respectRunOnEnter) {
    if (!suggestion) {
      suggestion = this._suggestWidget?.getFocusedItem();
    }
    const initialPromptInputState = this._mostRecentPromptInputState;
    if (!suggestion || !initialPromptInputState || this._leadingLineContent === void 0 || !this._model) {
      this._suggestTelemetry?.acceptCompletion(void 0, this._mostRecentPromptInputState?.value);
      return;
    }
    SuggestAddon.lastAcceptedCompletionTimestamp = Date.now();
    this._suggestWidget?.hide();
    const currentPromptInputState = this._currentPromptInputState ?? initialPromptInputState;
    const replacementText = currentPromptInputState.value.substring(suggestion.item.completion.replacementIndex, currentPromptInputState.cursorIndex);
    let rightSideReplacementText = "";
    if (
      // The line didn't end with ghost text
      (currentPromptInputState.ghostTextIndex === -1 || currentPromptInputState.ghostTextIndex > currentPromptInputState.cursorIndex) && // There is more than one charatcer
      currentPromptInputState.value.length > currentPromptInputState.cursorIndex + 1 && // THe next character is not a space
      currentPromptInputState.value.at(currentPromptInputState.cursorIndex) !== " "
    ) {
      const spaceIndex = currentPromptInputState.value.substring(currentPromptInputState.cursorIndex, currentPromptInputState.ghostTextIndex === -1 ? void 0 : currentPromptInputState.ghostTextIndex).indexOf(" ");
      rightSideReplacementText = currentPromptInputState.value.substring(currentPromptInputState.cursorIndex, spaceIndex === -1 ? void 0 : currentPromptInputState.cursorIndex + spaceIndex);
    }
    const completion = suggestion.item.completion;
    let resultSequence = completion.inputData;
    if (resultSequence === void 0) {
      let completionText = typeof completion.label === "string" ? completion.label : completion.label.label;
      if ((completion.kind === TerminalCompletionItemKind.Folder || completion.isFileOverride) && completionText.includes(" ")) {
        completionText = completionText.replaceAll(" ", "\\ ");
      }
      let runOnEnter = false;
      if (respectRunOnEnter) {
        const runOnEnterConfig = this._configurationService.getValue(terminalSuggestConfigSection).runOnEnter;
        switch (runOnEnterConfig) {
          case "always": {
            runOnEnter = true;
            break;
          }
          case "exactMatch": {
            runOnEnter = replacementText.toLowerCase() === completionText.toLowerCase();
            break;
          }
          case "exactMatchIgnoreExtension": {
            runOnEnter = replacementText.toLowerCase() === completionText.toLowerCase();
            if (completion.isFileOverride) {
              runOnEnter ||= replacementText.toLowerCase() === completionText.toLowerCase().replace(/\.[^\.]+$/, "");
            }
            break;
          }
        }
      }
      const commonPrefixLen = commonPrefixLength(replacementText, completionText);
      const commonPrefix = replacementText.substring(replacementText.length - 1 - commonPrefixLen, replacementText.length - 1);
      const completionSuffix = completionText.substring(commonPrefixLen);
      if (currentPromptInputState.suffix.length > 0 && currentPromptInputState.prefix.endsWith(commonPrefix) && currentPromptInputState.suffix.startsWith(completionSuffix)) {
        resultSequence = "\x1BOC".repeat(completionText.length - commonPrefixLen);
      } else {
        resultSequence = [
          // Backspace (left) to remove all additional input
          "\x7F".repeat(replacementText.length - commonPrefixLen),
          // Delete (right) to remove any additional text in the same word
          "\x1B[3~".repeat(rightSideReplacementText.length),
          // Write the completion
          completionSuffix,
          // Run on enter if needed
          runOnEnter ? "\r" : ""
        ].join("");
      }
    }
    if (completion.kind === TerminalCompletionItemKind.Folder) {
      SuggestAddon.lastAcceptedCompletionTimestamp = 0;
    }
    this._onAcceptedCompletion.fire(resultSequence);
    this._suggestTelemetry?.acceptCompletion(completion, this._mostRecentPromptInputState?.value);
    this.hideSuggestWidget(true);
  }
  hideSuggestWidget(cancelAnyRequest) {
    if (cancelAnyRequest) {
      this._cancellationTokenSource?.cancel();
      this._cancellationTokenSource = void 0;
    }
    this._currentPromptInputState = void 0;
    this._leadingLineContent = void 0;
    this._suggestWidget?.hide();
  }
};
SuggestAddon.lastAcceptedCompletionTimestamp = 0;
SuggestAddon = __decorateClass([
  __decorateParam(3, ITerminalCompletionService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, IExtensionService),
  __decorateParam(7, ITerminalConfigurationService)
], SuggestAddon);
let PersistedWidgetSize = class {
  constructor(_storageService) {
    this._storageService = _storageService;
    this._key = TerminalStorageKeys.TerminalSuggestSize;
  }
  restore() {
    const raw = this._storageService.get(this._key, StorageScope.PROFILE) ?? "";
    try {
      const obj = JSON.parse(raw);
      if (dom.Dimension.is(obj)) {
        return dom.Dimension.lift(obj);
      }
    } catch {
    }
    return void 0;
  }
  store(size) {
    this._storageService.store(this._key, JSON.stringify(size), StorageScope.PROFILE, StorageTarget.MACHINE);
  }
  reset() {
    this._storageService.remove(this._key, StorageScope.PROFILE);
  }
};
PersistedWidgetSize = __decorateClass([
  __decorateParam(0, IStorageService)
], PersistedWidgetSize);
function normalizePathSeparator(path, sep2) {
  if (sep2 === "/") {
    return path.replaceAll("\\", "/");
  }
  return path.replaceAll("/", "\\");
}
export {
  SuggestAddon,
  normalizePathSeparator
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvc3VnZ2VzdC9icm93c2VyL3Rlcm1pbmFsU3VnZ2VzdEFkZG9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHR5cGUgeyBJVGVybWluYWxBZGRvbiwgVGVybWluYWwgfSBmcm9tICdAeHRlcm0veHRlcm0nO1xuaW1wb3J0ICogYXMgZG9tIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBjb21iaW5lZERpc3Bvc2FibGUsIERpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IHNlcCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgY29tbW9uUHJlZml4TGVuZ3RoIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBlZGl0b3JTdWdnZXN0V2lkZ2V0U2VsZWN0ZWRCYWNrZ3JvdW5kIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvc3VnZ2VzdC9icm93c2VyL3N1Z2dlc3RXaWRnZXQuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgVGVybWluYWxDYXBhYmlsaXR5LCB0eXBlIElUZXJtaW5hbENhcGFiaWxpdHlTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9jYXBhYmlsaXRpZXMvY2FwYWJpbGl0aWVzLmpzJztcbmltcG9ydCB0eXBlIHsgSVByb21wdElucHV0TW9kZWwsIElQcm9tcHRJbnB1dE1vZGVsU3RhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vY2FwYWJpbGl0aWVzL2NvbW1hbmREZXRlY3Rpb24vcHJvbXB0SW5wdXRNb2RlbC5qcyc7XG5pbXBvcnQgeyBnZXRMaXN0U3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvYnJvd3Nlci9kZWZhdWx0U3R5bGVzLmpzJztcbmltcG9ydCB7IGFjdGl2ZUNvbnRyYXN0Qm9yZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHR5cGUgeyBJWHRlcm1Db3JlIH0gZnJvbSAnLi4vLi4vLi4vdGVybWluYWwvYnJvd3Nlci94dGVybS1wcml2YXRlLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsU3RvcmFnZUtleXMgfSBmcm9tICcuLi8uLi8uLi90ZXJtaW5hbC9jb21tb24vdGVybWluYWxTdG9yYWdlS2V5cy5qcyc7XG5pbXBvcnQgeyB0ZXJtaW5hbFN1Z2dlc3RDb25maWdTZWN0aW9uLCBUZXJtaW5hbFN1Z2dlc3RTZXR0aW5nSWQsIHR5cGUgSVRlcm1pbmFsU3VnZ2VzdENvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi9jb21tb24vdGVybWluYWxTdWdnZXN0Q29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBMaW5lQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3N1Z2dlc3QvYnJvd3Nlci9zaW1wbGVDb21wbGV0aW9uTW9kZWwuanMnO1xuaW1wb3J0IHsgSVNpbXBsZVNlbGVjdGVkU3VnZ2VzdGlvbiwgU2ltcGxlU3VnZ2VzdFdpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3N1Z2dlc3QvYnJvd3Nlci9zaW1wbGVTdWdnZXN0V2lkZ2V0LmpzJztcbmltcG9ydCB7IElUZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlIH0gZnJvbSAnLi90ZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsU2V0dGluZ0lkLCBUZXJtaW5hbFNoZWxsVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBNZW51SWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElTaW1wbGVTdWdnZXN0V2lkZ2V0Rm9udEluZm8gfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9zdWdnZXN0L2Jyb3dzZXIvc2ltcGxlU3VnZ2VzdFdpZGdldFJlbmRlcmVyLmpzJztcbmltcG9ydCB7IElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBHT0xERU5fTElORV9IRUlHSFRfUkFUSU8sIE1JTklNVU1fTElORV9IRUlHSFQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9mb250SW5mby5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbENvbXBsZXRpb25Nb2RlbCB9IGZyb20gJy4vdGVybWluYWxDb21wbGV0aW9uTW9kZWwuanMnO1xuaW1wb3J0IHsgVGVybWluYWxDb21wbGV0aW9uSXRlbSwgVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQsIHR5cGUgSVRlcm1pbmFsQ29tcGxldGlvbiB9IGZyb20gJy4vdGVybWluYWxDb21wbGV0aW9uSXRlbS5qcyc7XG5pbXBvcnQgeyBJbnRlcnZhbFRpbWVyLCBUaW1lb3V0VGltZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbFN1Z2dlc3RUZWxlbWV0cnkgfSBmcm9tICcuL3Rlcm1pbmFsU3VnZ2VzdFRlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyB0ZXJtaW5hbFN5bWJvbEFsaWFzSWNvbiwgdGVybWluYWxTeW1ib2xBcmd1bWVudEljb24sIHRlcm1pbmFsU3ltYm9sRW51bU1lbWJlciwgdGVybWluYWxTeW1ib2xGaWxlSWNvbiwgdGVybWluYWxTeW1ib2xGbGFnSWNvbiwgdGVybWluYWxTeW1ib2xJbmxpbmVTdWdnZXN0aW9uSWNvbiwgdGVybWluYWxTeW1ib2xNZXRob2RJY29uLCB0ZXJtaW5hbFN5bWJvbE9wdGlvbkljb24sIHRlcm1pbmFsU3ltYm9sRm9sZGVySWNvbiB9IGZyb20gJy4vdGVybWluYWxTeW1ib2xJY29ucy5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVN1Z2dlc3RDb250cm9sbGVyIHtcblx0aXNQYXN0aW5nOiBib29sZWFuO1xuXHRzZWxlY3RQcmV2aW91c1N1Z2dlc3Rpb24oKTogdm9pZDtcblx0c2VsZWN0UHJldmlvdXNQYWdlU3VnZ2VzdGlvbigpOiB2b2lkO1xuXHRzZWxlY3ROZXh0U3VnZ2VzdGlvbigpOiB2b2lkO1xuXHRzZWxlY3ROZXh0UGFnZVN1Z2dlc3Rpb24oKTogdm9pZDtcblx0YWNjZXB0U2VsZWN0ZWRTdWdnZXN0aW9uKHN1Z2dlc3Rpb24/OiBQaWNrPElTaW1wbGVTZWxlY3RlZFN1Z2dlc3Rpb248VGVybWluYWxDb21wbGV0aW9uSXRlbT4sICdpdGVtJyB8ICdtb2RlbCc+KTogdm9pZDtcblx0aGlkZVN1Z2dlc3RXaWRnZXQoY2FuY2VsQW55UmVxdWVzdHM6IGJvb2xlYW4sIHdhc0Nsb3NlZEJ5VXNlcj86IGJvb2xlYW4pOiB2b2lkO1xufVxuZXhwb3J0IGNsYXNzIFN1Z2dlc3RBZGRvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVGVybWluYWxBZGRvbiwgSVN1Z2dlc3RDb250cm9sbGVyIHtcblx0cHJpdmF0ZSBfdGVybWluYWw/OiBUZXJtaW5hbDtcblxuXHRwcml2YXRlIF9wcm9tcHRJbnB1dE1vZGVsPzogSVByb21wdElucHV0TW9kZWw7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb21wdElucHV0TW9kZWxTdWJzY3JpcHRpb25zID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXG5cdHByaXZhdGUgX21vc3RSZWNlbnRQcm9tcHRJbnB1dFN0YXRlPzogSVByb21wdElucHV0TW9kZWxTdGF0ZTtcblx0cHJpdmF0ZSBfY3VycmVudFByb21wdElucHV0U3RhdGU/OiBJUHJvbXB0SW5wdXRNb2RlbFN0YXRlO1xuXHRwcml2YXRlIF9tb2RlbD86IFRlcm1pbmFsQ29tcGxldGlvbk1vZGVsO1xuXG5cdHByaXZhdGUgX2NvbnRhaW5lcj86IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIF9zY3JlZW4/OiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBfc3VnZ2VzdFdpZGdldD86IFNpbXBsZVN1Z2dlc3RXaWRnZXQ8VGVybWluYWxDb21wbGV0aW9uTW9kZWwsIFRlcm1pbmFsQ29tcGxldGlvbkl0ZW0+O1xuXHRwcml2YXRlIF9jYWNoZWRGb250SW5mbzogSVNpbXBsZVN1Z2dlc3RXaWRnZXRGb250SW5mbyB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfZW5hYmxlV2lkZ2V0OiBib29sZWFuID0gdHJ1ZTtcblx0cHJpdmF0ZSBfcGF0aFNlcGFyYXRvcjogc3RyaW5nID0gc2VwO1xuXHRwcml2YXRlIF9pc0ZpbHRlcmluZ0RpcmVjdG9yaWVzOiBib29sZWFuID0gZmFsc2U7XG5cblx0Ly8gVE9ETzogUmVtb3ZlIHRoZXNlIGluIGZhdm9yIG9mIHByb21wdCBpbnB1dCBzdGF0ZVxuXHRwcml2YXRlIF9sZWFkaW5nTGluZUNvbnRlbnQ/OiBzdHJpbmc7XG5cdHByaXZhdGUgX2N1cnNvckluZGV4RGVsdGE6IG51bWJlciA9IDA7XG5cdHByaXZhdGUgX3JlcXVlc3RlZENvbXBsZXRpb25zSW5kZXg6IG51bWJlciA9IDA7XG5cblx0cHJpdmF0ZSBfbGFzdFVzZXJEYXRhPzogc3RyaW5nO1xuXHRzdGF0aWMgbGFzdEFjY2VwdGVkQ29tcGxldGlvblRpbWVzdGFtcDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBfbGFzdFVzZXJEYXRhVGltZXN0YW1wOiBudW1iZXIgPSAwO1xuXG5cdHByaXZhdGUgX2NhbmNlbGxhdGlvblRva2VuU291cmNlOiBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB8IHVuZGVmaW5lZDtcblxuXHRpc1Bhc3Rpbmc6IGJvb2xlYW4gPSBmYWxzZTtcblx0c2hlbGxUeXBlOiBUZXJtaW5hbFNoZWxsVHlwZSB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSByZWFkb25seSBfc2hlbGxUeXBlSW5pdDogUHJvbWlzZTx2b2lkPjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkJlbGwgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25CZWxsID0gdGhpcy5fb25CZWxsLmV2ZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkFjY2VwdGVkQ29tcGxldGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHN0cmluZz4oKSk7XG5cdHJlYWRvbmx5IG9uQWNjZXB0ZWRDb21wbGV0aW9uID0gdGhpcy5fb25BY2NlcHRlZENvbXBsZXRpb24uZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUmVjZWl2ZUNvbXBsZXRpb25zID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkUmVjZWl2ZUNvbXBsZXRpb25zID0gdGhpcy5fb25EaWRSZWNlaXZlQ29tcGxldGlvbnMuZXZlbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRm9udENvbmZpZ3VyYXRpb25DaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRGb250Q29uZmlndXJhdGlvbkNoYW5nZSA9IHRoaXMuX29uRGlkRm9udENvbmZpZ3VyYXRpb25DaGFuZ2UuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfa2luZFRvSWNvbk1hcCA9IG5ldyBNYXA8bnVtYmVyLCBUaGVtZUljb24+KFtcblx0XHRbVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuRmlsZSwgdGVybWluYWxTeW1ib2xGaWxlSWNvbl0sXG5cdFx0W1Rlcm1pbmFsQ29tcGxldGlvbkl0ZW1LaW5kLkZvbGRlciwgdGVybWluYWxTeW1ib2xGb2xkZXJJY29uXSxcblx0XHRbVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuTWV0aG9kLCB0ZXJtaW5hbFN5bWJvbE1ldGhvZEljb25dLFxuXHRcdFtUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5BbGlhcywgdGVybWluYWxTeW1ib2xBbGlhc0ljb25dLFxuXHRcdFtUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5Bcmd1bWVudCwgdGVybWluYWxTeW1ib2xBcmd1bWVudEljb25dLFxuXHRcdFtUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5PcHRpb24sIHRlcm1pbmFsU3ltYm9sT3B0aW9uSWNvbl0sXG5cdFx0W1Rlcm1pbmFsQ29tcGxldGlvbkl0ZW1LaW5kLk9wdGlvblZhbHVlLCB0ZXJtaW5hbFN5bWJvbEVudW1NZW1iZXJdLFxuXHRcdFtUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5GbGFnLCB0ZXJtaW5hbFN5bWJvbEZsYWdJY29uXSxcblx0XHRbVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuSW5saW5lU3VnZ2VzdGlvbiwgdGVybWluYWxTeW1ib2xJbmxpbmVTdWdnZXN0aW9uSWNvbl0sXG5cdFx0W1Rlcm1pbmFsQ29tcGxldGlvbkl0ZW1LaW5kLklubGluZVN1Z2dlc3Rpb25BbHdheXNPblRvcCwgdGVybWluYWxTeW1ib2xJbmxpbmVTdWdnZXN0aW9uSWNvbl0sXG5cdF0pO1xuXG5cdHByaXZhdGUgX2tpbmRUb0tpbmRMYWJlbE1hcCA9IG5ldyBNYXA8bnVtYmVyLCBzdHJpbmc+KFtcblx0XHRbVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuRmlsZSwgbG9jYWxpemUoJ2ZpbGUnLCAnRmlsZScpXSxcblx0XHRbVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuRm9sZGVyLCBsb2NhbGl6ZSgnZm9sZGVyJywgJ0ZvbGRlcicpXSxcblx0XHRbVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuTWV0aG9kLCBsb2NhbGl6ZSgnbWV0aG9kJywgJ01ldGhvZCcpXSxcblx0XHRbVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuQWxpYXMsIGxvY2FsaXplKCdhbGlhcycsICdBbGlhcycpXSxcblx0XHRbVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuQXJndW1lbnQsIGxvY2FsaXplKCdhcmd1bWVudCcsICdBcmd1bWVudCcpXSxcblx0XHRbVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuT3B0aW9uLCBsb2NhbGl6ZSgnb3B0aW9uJywgJ09wdGlvbicpXSxcblx0XHRbVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuT3B0aW9uVmFsdWUsIGxvY2FsaXplKCdvcHRpb25WYWx1ZScsICdPcHRpb24gVmFsdWUnKV0sXG5cdFx0W1Rlcm1pbmFsQ29tcGxldGlvbkl0ZW1LaW5kLkZsYWcsIGxvY2FsaXplKCdmbGFnJywgJ0ZsYWcnKV0sXG5cdFx0W1Rlcm1pbmFsQ29tcGxldGlvbkl0ZW1LaW5kLklubGluZVN1Z2dlc3Rpb24sIGxvY2FsaXplKCdpbmxpbmVTdWdnZXN0aW9uJywgJ0lubGluZSBTdWdnZXN0aW9uJyldLFxuXHRcdFtUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5JbmxpbmVTdWdnZXN0aW9uQWx3YXlzT25Ub3AsIGxvY2FsaXplKCdpbmxpbmVTdWdnZXN0aW9uQWx3YXlzT25Ub3AnLCAnSW5saW5lIFN1Z2dlc3Rpb24nKV0sXG5cdF0pO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2lubGluZUNvbXBsZXRpb246IElUZXJtaW5hbENvbXBsZXRpb24gPSB7XG5cdFx0bGFiZWw6ICcnLFxuXHRcdC8vIFJpZ2h0IGFycm93IGlzIHVzZWQgdG8gYWNjZXB0IHRoZSBjb21wbGV0aW9uLiBUaGlzIGlzIGEgY29tbW9uIGtleWJpbmRpbmcgaW4gcHdzaCwgenNoXG5cdFx0Ly8gYW5kIGZpc2guXG5cdFx0aW5wdXREYXRhOiAnXFx4MWJbQycsXG5cdFx0cmVwbGFjZW1lbnRJbmRleDogMCxcblx0XHRyZXBsYWNlbWVudExlbmd0aDogMCxcblx0XHRwcm92aWRlcjogJ2NvcmUnLFxuXHRcdGRldGFpbDogJ0lubGluZSBzdWdnZXN0aW9uJyxcblx0XHRraW5kOiBUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5JbmxpbmVTdWdnZXN0aW9uLFxuXHRcdGtpbmRMYWJlbDogJ0lubGluZSBzdWdnZXN0aW9uJyxcblx0XHRpY29uOiB0aGlzLl9raW5kVG9JY29uTWFwLmdldChUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5JbmxpbmVTdWdnZXN0aW9uKSxcblx0fTtcblx0cHJpdmF0ZSByZWFkb25seSBfaW5saW5lQ29tcGxldGlvbkl0ZW0gPSBuZXcgVGVybWluYWxDb21wbGV0aW9uSXRlbSh0aGlzLl9pbmxpbmVDb21wbGV0aW9uKTtcblxuXHRwcml2YXRlIF9zaG91bGRTeW5jV2hlblJlYWR5OiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgX3N1Z2dlc3RUZWxlbWV0cnk6IFRlcm1pbmFsU3VnZ2VzdFRlbGVtZXRyeSB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRzaGVsbFR5cGU6IFRlcm1pbmFsU2hlbGxUeXBlIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2NhcGFiaWxpdGllczogSVRlcm1pbmFsQ2FwYWJpbGl0eVN0b3JlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsU3VnZ2VzdFdpZGdldFZpc2libGVDb250ZXh0S2V5OiBJQ29udGV4dEtleTxib29sZWFuPixcblx0XHRASVRlcm1pbmFsQ29tcGxldGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxDb21wbGV0aW9uU2VydmljZTogSVRlcm1pbmFsQ29tcGxldGlvblNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2U6IElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Ly8gSW5pdGlhbGl6ZSBzaGVsbCB0eXBlLCBpbmNsdWRpbmcgYSBwcm9taXNlIHRoYXQgY29tcGxldGlvbnMgY2FuIGF3YWl0IGZvciB0aGF0IHJlc29sdmVzOlxuXHRcdC8vIC0gaW1tZWRpYXRlbHkgaWYgc2hlbGwgdHlwZVxuXHRcdC8vIC0gYWZ0ZXIgYSBzaG9ydCBkZWxheSBpZiBzaGVsbCB0eXBlIGdldHMgc2V0XG5cdFx0Ly8gLSBhZnRlciBhIGxvbmcgZGVsYXkgaWYgaXQgZG9lc24ndCBnZXQgc2V0XG5cdFx0dGhpcy5zaGVsbFR5cGUgPSBzaGVsbFR5cGU7XG5cdFx0aWYgKHRoaXMuc2hlbGxUeXBlKSB7XG5cdFx0XHR0aGlzLl9zaGVsbFR5cGVJbml0ID0gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGludGVydmFsVGltZXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgSW50ZXJ2YWxUaW1lcigpKTtcblx0XHRcdGNvbnN0IHRpbWVvdXRUaW1lciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBUaW1lb3V0VGltZXIoKSk7XG5cdFx0XHR0aGlzLl9zaGVsbFR5cGVJbml0ID0gbmV3IFByb21pc2U8dm9pZD4ociA9PiB7XG5cdFx0XHRcdGludGVydmFsVGltZXIuY2FuY2VsQW5kU2V0KCgpID0+IHtcblx0XHRcdFx0XHRpZiAodGhpcy5zaGVsbFR5cGUpIHtcblx0XHRcdFx0XHRcdHIoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sIDUwKTtcblx0XHRcdFx0dGltZW91dFRpbWVyLmNhbmNlbEFuZFNldChyLCA1MDAwKTtcblx0XHRcdH0pLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9zdG9yZS5kZWxldGUoaW50ZXJ2YWxUaW1lcik7XG5cdFx0XHRcdHRoaXMuX3N0b3JlLmRlbGV0ZSh0aW1lb3V0VGltZXIpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQucnVuQW5kU3Vic2NyaWJlKEV2ZW50LmFueShcblx0XHRcdHRoaXMuX2NhcGFiaWxpdGllcy5vbkRpZEFkZENhcGFiaWxpdHlUeXBlLFxuXHRcdFx0dGhpcy5fY2FwYWJpbGl0aWVzLm9uRGlkUmVtb3ZlQ2FwYWJpbGl0eVR5cGVcblx0XHQpLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBjb21tYW5kRGV0ZWN0aW9uID0gdGhpcy5fY2FwYWJpbGl0aWVzLmdldChUZXJtaW5hbENhcGFiaWxpdHkuQ29tbWFuZERldGVjdGlvbik7XG5cdFx0XHRpZiAoY29tbWFuZERldGVjdGlvbikge1xuXHRcdFx0XHRpZiAodGhpcy5fcHJvbXB0SW5wdXRNb2RlbCAhPT0gY29tbWFuZERldGVjdGlvbi5wcm9tcHRJbnB1dE1vZGVsKSB7XG5cdFx0XHRcdFx0dGhpcy5fcHJvbXB0SW5wdXRNb2RlbCA9IGNvbW1hbmREZXRlY3Rpb24ucHJvbXB0SW5wdXRNb2RlbDtcblx0XHRcdFx0XHR0aGlzLl9zdWdnZXN0VGVsZW1ldHJ5ID0gdGhpcy5fcmVnaXN0ZXIodGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVybWluYWxTdWdnZXN0VGVsZW1ldHJ5LCBjb21tYW5kRGV0ZWN0aW9uLCB0aGlzLl9wcm9tcHRJbnB1dE1vZGVsKSk7XG5cdFx0XHRcdFx0dGhpcy5fcHJvbXB0SW5wdXRNb2RlbFN1YnNjcmlwdGlvbnMudmFsdWUgPSBjb21iaW5lZERpc3Bvc2FibGUoXG5cdFx0XHRcdFx0XHR0aGlzLl9wcm9tcHRJbnB1dE1vZGVsLm9uRGlkQ2hhbmdlSW5wdXQoZSA9PiB0aGlzLl9zeW5jKGUpKSxcblx0XHRcdFx0XHRcdHRoaXMuX3Byb21wdElucHV0TW9kZWwub25EaWRGaW5pc2hJbnB1dCgoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuaGlkZVN1Z2dlc3RXaWRnZXQodHJ1ZSk7XG5cdFx0XHRcdFx0XHR9KSxcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdGlmICh0aGlzLl9zaG91bGRTeW5jV2hlblJlYWR5KSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9zeW5jKHRoaXMuX3Byb21wdElucHV0TW9kZWwpO1xuXHRcdFx0XHRcdFx0dGhpcy5fc2hvdWxkU3luY1doZW5SZWFkeSA9IGZhbHNlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fcHJvbXB0SW5wdXRNb2RlbCA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5vbkNvbmZpZ0NoYW5nZWQoKCkgPT4gdGhpcy5fY2FjaGVkRm9udEluZm8gPSB1bmRlZmluZWQpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmUodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLCBlID0+IHtcblx0XHRcdGlmICghZSB8fCBlLmFmZmVjdHNDb25maWd1cmF0aW9uKFRlcm1pbmFsU3VnZ2VzdFNldHRpbmdJZC5JbmxpbmVTdWdnZXN0aW9uKSkge1xuXHRcdFx0XHRjb25zdCB2YWx1ZSA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElUZXJtaW5hbFN1Z2dlc3RDb25maWd1cmF0aW9uPih0ZXJtaW5hbFN1Z2dlc3RDb25maWdTZWN0aW9uKS5pbmxpbmVTdWdnZXN0aW9uO1xuXHRcdFx0XHR0aGlzLl9pbmxpbmVDb21wbGV0aW9uSXRlbS5pc0ludmFsaWQgPSB2YWx1ZSA9PT0gJ29mZic7XG5cdFx0XHRcdHN3aXRjaCAodmFsdWUpIHtcblx0XHRcdFx0XHRjYXNlICdhbHdheXNPblRvcEV4Y2VwdEV4YWN0TWF0Y2gnOiB7XG5cdFx0XHRcdFx0XHR0aGlzLl9pbmxpbmVDb21wbGV0aW9uLmtpbmQgPSBUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5JbmxpbmVTdWdnZXN0aW9uO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNhc2UgJ2Fsd2F5c09uVG9wJzpcblx0XHRcdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdFx0XHR0aGlzLl9pbmxpbmVDb21wbGV0aW9uLmtpbmQgPSBUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5JbmxpbmVTdWdnZXN0aW9uQWx3YXlzT25Ub3A7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fbW9kZWw/LmZvcmNlUmVmaWx0ZXJBbGwoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRhY3RpdmF0ZSh4dGVybTogVGVybWluYWwpOiB2b2lkIHtcblx0XHR0aGlzLl90ZXJtaW5hbCA9IHh0ZXJtO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHh0ZXJtLm9uS2V5KGFzeW5jIGUgPT4ge1xuXHRcdFx0dGhpcy5fbGFzdFVzZXJEYXRhID0gZS5rZXk7XG5cdFx0XHR0aGlzLl9sYXN0VXNlckRhdGFUaW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih4dGVybS5vblNjcm9sbCgoKSA9PiB0aGlzLmhpZGVTdWdnZXN0V2lkZ2V0KHRydWUpKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9oYW5kbGVDb21wbGV0aW9uUHJvdmlkZXJzKHRlcm1pbmFsOiBUZXJtaW5hbCB8IHVuZGVmaW5lZCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuLCBleHBsaWNpdGx5SW52b2tlZD86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBOb3RoaW5nIHRvIGhhbmRsZSBpZiB0aGUgdGVybWluYWwgaXMgbm90IGF0dGFjaGVkXG5cdFx0aWYgKCF0ZXJtaW5hbD8uZWxlbWVudCB8fCAhdGhpcy5fZW5hYmxlV2lkZ2V0IHx8ICF0aGlzLl9wcm9tcHRJbnB1dE1vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gT25seSBzaG93IHRoZSBzdWdnZXN0IHdpZGdldCBpZiB0aGUgdGVybWluYWwgaXMgZm9jdXNlZFxuXHRcdGlmICghZG9tLmlzQW5jZXN0b3JPZkFjdGl2ZUVsZW1lbnQodGVybWluYWwuZWxlbWVudCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBSZXF1aXJlIGEgc2hlbGwgdHlwZSBmb3IgY29tcGxldGlvbnMuIFRoaXMgd2lsbCB3YWl0IGEgc2hvcnQgcGVyaW9kIGFmdGVyIGxhdW5jaGluZyB0b1xuXHRcdC8vIHdhaXQgZm9yIHRoZSBzaGVsbCB0eXBlIHRvIGluaXRpYWxpemUuIFRoaXMgcHJldmVudHMgdXNlciByZXF1ZXN0cyBzb21ldGltZXMgZ2V0dGluZyBsb3N0XG5cdFx0Ly8gaWYgcmVxdWVzdGVkIHNob3J0bHkgYWZ0ZXIgdGhlIHRlcm1pbmFsIGlzIGNyZWF0ZWQuXG5cdFx0YXdhaXQgdGhpcy5fc2hlbGxUeXBlSW5pdDtcblx0XHRpZiAoIXRoaXMuc2hlbGxUeXBlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0bGV0IGRvTm90UmVxdWVzdEV4dGVuc2lvbkNvbXBsZXRpb25zID0gZmFsc2U7XG5cdFx0Ly8gRW5zdXJlIHRoYXQgYSBrZXkgaGFzIGJlZW4gcHJlc3NlZCBzaW5jZSB0aGUgbGFzdCBhY2NlcHRlZCBjb21wbGV0aW9uIGluIG9yZGVyIHRvIHByZXZlbnRcblx0XHQvLyBjb21wbGV0aW9ucyBiZWluZyByZXF1ZXN0ZWQgYWdhaW4gcmlnaHQgYWZ0ZXIgYWNjZXB0aW5nIGEgY29tcGxldGlvblxuXHRcdGlmICh0aGlzLl9sYXN0VXNlckRhdGFUaW1lc3RhbXAgPCBTdWdnZXN0QWRkb24ubGFzdEFjY2VwdGVkQ29tcGxldGlvblRpbWVzdGFtcCkge1xuXHRcdFx0ZG9Ob3RSZXF1ZXN0RXh0ZW5zaW9uQ29tcGxldGlvbnMgPSB0cnVlO1xuXHRcdH1cblxuXHRcdGlmICghZG9Ob3RSZXF1ZXN0RXh0ZW5zaW9uQ29tcGxldGlvbnMpIHtcblx0XHRcdGF3YWl0IHRoaXMuX2V4dGVuc2lvblNlcnZpY2UuYWN0aXZhdGVCeUV2ZW50KCdvblRlcm1pbmFsQ29tcGxldGlvbnNSZXF1ZXN0ZWQnKTtcblx0XHR9XG5cdFx0dGhpcy5fY3VycmVudFByb21wdElucHV0U3RhdGUgPSB7XG5cdFx0XHR2YWx1ZTogdGhpcy5fcHJvbXB0SW5wdXRNb2RlbC52YWx1ZSxcblx0XHRcdHByZWZpeDogdGhpcy5fcHJvbXB0SW5wdXRNb2RlbC5wcmVmaXgsXG5cdFx0XHRzdWZmaXg6IHRoaXMuX3Byb21wdElucHV0TW9kZWwuc3VmZml4LFxuXHRcdFx0Y3Vyc29ySW5kZXg6IHRoaXMuX3Byb21wdElucHV0TW9kZWwuY3Vyc29ySW5kZXgsXG5cdFx0XHRnaG9zdFRleHRJbmRleDogdGhpcy5fcHJvbXB0SW5wdXRNb2RlbC5naG9zdFRleHRJbmRleFxuXHRcdH07XG5cdFx0dGhpcy5fcmVxdWVzdGVkQ29tcGxldGlvbnNJbmRleCA9IHRoaXMuX2N1cnJlbnRQcm9tcHRJbnB1dFN0YXRlLmN1cnNvckluZGV4O1xuXG5cdFx0Y29uc3QgcXVpY2tTdWdnZXN0aW9uc0NvbmZpZyA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElUZXJtaW5hbFN1Z2dlc3RDb25maWd1cmF0aW9uPih0ZXJtaW5hbFN1Z2dlc3RDb25maWdTZWN0aW9uKS5xdWlja1N1Z2dlc3Rpb25zO1xuXHRcdGNvbnN0IGFsbG93RmFsbGJhY2tDb21wbGV0aW9ucyA9IGV4cGxpY2l0bHlJbnZva2VkIHx8IHF1aWNrU3VnZ2VzdGlvbnNDb25maWcudW5rbm93biA9PT0gJ29uJztcblx0XHRjb25zdCBwcm92aWRlZENvbXBsZXRpb25zID0gYXdhaXQgdGhpcy5fdGVybWluYWxDb21wbGV0aW9uU2VydmljZS5wcm92aWRlQ29tcGxldGlvbnModGhpcy5fY3VycmVudFByb21wdElucHV0U3RhdGUucHJlZml4LCB0aGlzLl9jdXJyZW50UHJvbXB0SW5wdXRTdGF0ZS5jdXJzb3JJbmRleCwgYWxsb3dGYWxsYmFja0NvbXBsZXRpb25zLCB0aGlzLnNoZWxsVHlwZSwgdGhpcy5fY2FwYWJpbGl0aWVzLCB0b2tlbiwgZG9Ob3RSZXF1ZXN0RXh0ZW5zaW9uQ29tcGxldGlvbnMpO1xuXG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX29uRGlkUmVjZWl2ZUNvbXBsZXRpb25zLmZpcmUoKTtcblxuXHRcdHRoaXMuX2N1cnNvckluZGV4RGVsdGEgPSB0aGlzLl9wcm9tcHRJbnB1dE1vZGVsLmN1cnNvckluZGV4IC0gdGhpcy5fcmVxdWVzdGVkQ29tcGxldGlvbnNJbmRleDtcblx0XHR0aGlzLl9sZWFkaW5nTGluZUNvbnRlbnQgPSB0aGlzLl9wcm9tcHRJbnB1dE1vZGVsLnByZWZpeC5zdWJzdHJpbmcoMCwgdGhpcy5fcmVxdWVzdGVkQ29tcGxldGlvbnNJbmRleCArIHRoaXMuX2N1cnNvckluZGV4RGVsdGEpO1xuXG5cdFx0Y29uc3QgY29tcGxldGlvbnMgPSBwcm92aWRlZENvbXBsZXRpb25zPy5mbGF0KCkgfHwgW107XG5cdFx0aWYgKCFleHBsaWNpdGx5SW52b2tlZCAmJiAhY29tcGxldGlvbnMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLmhpZGVTdWdnZXN0V2lkZ2V0KHRydWUpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZpcnN0Q2hhciA9IHRoaXMuX2xlYWRpbmdMaW5lQ29udGVudC5sZW5ndGggPT09IDAgPyAnJyA6IHRoaXMuX2xlYWRpbmdMaW5lQ29udGVudFswXTtcblx0XHQvLyBUaGlzIGlzIGEgVGFiRXhwYW5zaW9uMiByZXN1bHRcblx0XHRpZiAodGhpcy5fbGVhZGluZ0xpbmVDb250ZW50LmluY2x1ZGVzKCcgJykgfHwgZmlyc3RDaGFyID09PSAnWycpIHtcblx0XHRcdHRoaXMuX2xlYWRpbmdMaW5lQ29udGVudCA9IHRoaXMuX3Byb21wdElucHV0TW9kZWwucHJlZml4O1xuXHRcdH1cblxuXHRcdGxldCBub3JtYWxpemVkTGVhZGluZ0xpbmVDb250ZW50ID0gdGhpcy5fbGVhZGluZ0xpbmVDb250ZW50O1xuXG5cdFx0Ly8gSWYgdGhlcmUgaXMgYSBzaW5nbGUgZGlyZWN0b3J5IGluIHRoZSBjb21wbGV0aW9uczpcblx0XHQvLyAtIGBcXGAgYW5kIGAvYCBhcmUgbm9ybWFsaXplZCBzdWNoIHRoYXQgZWl0aGVyIGNhbiBiZSB1c2VkXG5cdFx0Ly8gLSBVc2luZyBgXFxgIG9yIGAvYCB3aWxsIHJlcXVlc3QgbmV3IGNvbXBsZXRpb25zLiBJdCdzIGltcG9ydGFudCB0aGF0IHRoaXMgb25seSBvY2N1cnNcblx0XHQvLyAgIHdoZW4gYSBkaXJlY3RvcnkgaXMgcHJlc2VudCwgaWYgbm90IGNvbXBsZXRpb25zIGxpa2UgZ2l0IGJyYW5jaGVzIGNvdWxkIGJlIHJlcXVlc3RlZFxuXHRcdC8vICAgd2hpY2ggbGVhZHMgdG8gZmxpY2tlcmluZ1xuXHRcdHRoaXMuX2lzRmlsdGVyaW5nRGlyZWN0b3JpZXMgPSBjb21wbGV0aW9ucy5zb21lKGUgPT4gZS5raW5kID09PSBUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5Gb2xkZXIpO1xuXHRcdGlmICh0aGlzLl9pc0ZpbHRlcmluZ0RpcmVjdG9yaWVzKSB7XG5cdFx0XHRjb25zdCBmaXJzdERpciA9IGNvbXBsZXRpb25zLmZpbmQoZSA9PiBlLmtpbmQgPT09IFRlcm1pbmFsQ29tcGxldGlvbkl0ZW1LaW5kLkZvbGRlcik7XG5cdFx0XHRjb25zdCB0ZXh0TGFiZWwgPSB0eXBlb2YgZmlyc3REaXI/LmxhYmVsID09PSAnc3RyaW5nJyA/IGZpcnN0RGlyLmxhYmVsIDogZmlyc3REaXI/LmxhYmVsLmxhYmVsO1xuXHRcdFx0dGhpcy5fcGF0aFNlcGFyYXRvciA9IHRleHRMYWJlbD8ubWF0Y2goLyg/PHNlcD5bXFxcXFxcL10pLyk/Lmdyb3Vwcz8uc2VwID8/IHNlcDtcblx0XHRcdG5vcm1hbGl6ZWRMZWFkaW5nTGluZUNvbnRlbnQgPSBub3JtYWxpemVQYXRoU2VwYXJhdG9yKG5vcm1hbGl6ZWRMZWFkaW5nTGluZUNvbnRlbnQsIHRoaXMuX3BhdGhTZXBhcmF0b3IpO1xuXHRcdH1cblxuXHRcdC8vIEFkZCBhbnkgXCJnaG9zdCB0ZXh0XCIgc3VnZ2VzdGlvbiBzdWdnZXN0ZWQgYnkgdGhlIHNoZWxsLiBUaGlzIGFsaWducyB3aXRoIGJlaGF2aW9yIG9mIHRoZVxuXHRcdC8vIGVkaXRvciBhbmQgaG93IGl0IGludGVyYWN0cyB3aXRoIGlubGluZSBjb21wbGV0aW9ucy4gVGhpcyBvYmplY3QgaXMgdHJhY2tlZCBhbmQgcmV1c2VkIGFzXG5cdFx0Ly8gaXQgbWF5IGNoYW5nZSBvbiBpbnB1dC5cblx0XHR0aGlzLl9yZWZyZXNoSW5saW5lQ29tcGxldGlvbihjb21wbGV0aW9ucyk7XG5cblx0XHQvLyBBZGQgYW55IG1pc3NpbmcgaWNvbnMgYmFzZWQgb24gdGhlIGNvbXBsZXRpb24gaXRlbSBraW5kXG5cdFx0Zm9yIChjb25zdCBjb21wbGV0aW9uIG9mIGNvbXBsZXRpb25zKSB7XG5cdFx0XHRpZiAoIWNvbXBsZXRpb24uaWNvbiAmJiBjb21wbGV0aW9uLmtpbmQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRjb21wbGV0aW9uLmljb24gPSB0aGlzLl9raW5kVG9JY29uTWFwLmdldChjb21wbGV0aW9uLmtpbmQpO1xuXHRcdFx0XHRjb21wbGV0aW9uLmtpbmRMYWJlbCA9IHRoaXMuX2tpbmRUb0tpbmRMYWJlbE1hcC5nZXQoY29tcGxldGlvbi5raW5kKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBsaW5lQ29udGV4dCA9IG5ldyBMaW5lQ29udGV4dChub3JtYWxpemVkTGVhZGluZ0xpbmVDb250ZW50LCB0aGlzLl9jdXJzb3JJbmRleERlbHRhKTtcblx0XHRjb25zdCBtb2RlbCA9IG5ldyBUZXJtaW5hbENvbXBsZXRpb25Nb2RlbChcblx0XHRcdFtcblx0XHRcdFx0Li4uY29tcGxldGlvbnMuZmlsdGVyKGMgPT4gISFjLmxhYmVsKS5tYXAoYyA9PiBuZXcgVGVybWluYWxDb21wbGV0aW9uSXRlbShjKSksXG5cdFx0XHRcdHRoaXMuX2lubGluZUNvbXBsZXRpb25JdGVtLFxuXHRcdFx0XSxcblx0XHRcdGxpbmVDb250ZXh0XG5cdFx0KTtcblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5fc2hvd0NvbXBsZXRpb25zKG1vZGVsLCBleHBsaWNpdGx5SW52b2tlZCk7XG5cdH1cblxuXHRzZXRDb250YWluZXJXaXRoT3ZlcmZsb3coY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMuX2NvbnRhaW5lciA9IGNvbnRhaW5lcjtcblx0fVxuXG5cdHNldFNjcmVlbihzY3JlZW46IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5fc2NyZWVuID0gc2NyZWVuO1xuXHR9XG5cblx0dG9nZ2xlRXhwbGFpbk1vZGUoKTogdm9pZCB7XG5cdFx0dGhpcy5fc3VnZ2VzdFdpZGdldD8udG9nZ2xlRXhwbGFpbk1vZGUoKTtcblx0fVxuXG5cdHRvZ2dsZVN1Z2dlc3Rpb25Gb2N1cygpOiB2b2lkIHtcblx0XHR0aGlzLl9zdWdnZXN0V2lkZ2V0Py50b2dnbGVEZXRhaWxzRm9jdXMoKTtcblx0fVxuXG5cdHRvZ2dsZVN1Z2dlc3Rpb25EZXRhaWxzKCk6IHZvaWQge1xuXHRcdHRoaXMuX3N1Z2dlc3RXaWRnZXQ/LnRvZ2dsZURldGFpbHMoKTtcblx0fVxuXG5cdHJlc2V0V2lkZ2V0U2l6ZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9zdWdnZXN0V2lkZ2V0Py5yZXNldFdpZGdldFNpemUoKTtcblx0fVxuXG5cdGFzeW5jIHJlcXVlc3RDb21wbGV0aW9ucyhleHBsaWNpdGx5SW52b2tlZD86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMuX3Byb21wdElucHV0TW9kZWwpIHtcblx0XHRcdHRoaXMuX3Nob3VsZFN5bmNXaGVuUmVhZHkgPSB0cnVlO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmlzUGFzdGluZykge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fY2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UpIHtcblx0XHRcdHRoaXMuX2NhbmNlbGxhdGlvblRva2VuU291cmNlLmNhbmNlbCgpO1xuXHRcdFx0dGhpcy5fY2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UuZGlzcG9zZSgpO1xuXHRcdH1cblx0XHR0aGlzLl9jYW5jZWxsYXRpb25Ub2tlblNvdXJjZSA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdGNvbnN0IHRva2VuID0gdGhpcy5fY2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UudG9rZW47XG5cdFx0YXdhaXQgdGhpcy5faGFuZGxlQ29tcGxldGlvblByb3ZpZGVycyh0aGlzLl90ZXJtaW5hbCwgdG9rZW4sIGV4cGxpY2l0bHlJbnZva2VkKTtcblx0fVxuXG5cdHByaXZhdGUgX2FkZFByb3BlcnRpZXNUb0lubGluZUNvbXBsZXRpb25JdGVtKGNvbXBsZXRpb25zOiBJVGVybWluYWxDb21wbGV0aW9uW10pOiB2b2lkIHtcblx0XHRjb25zdCBpbmxpbmVDb21wbGV0aW9uTGFiZWwgPSAodHlwZW9mIHRoaXMuX2lubGluZUNvbXBsZXRpb25JdGVtLmNvbXBsZXRpb24ubGFiZWwgPT09ICdzdHJpbmcnID8gdGhpcy5faW5saW5lQ29tcGxldGlvbkl0ZW0uY29tcGxldGlvbi5sYWJlbCA6IHRoaXMuX2lubGluZUNvbXBsZXRpb25JdGVtLmNvbXBsZXRpb24ubGFiZWwubGFiZWwpLnRyaW0oKTtcblx0XHRjb25zdCBpbmxpbmVDb21wbGV0aW9uTWF0Y2hJbmRleCA9IGNvbXBsZXRpb25zLmZpbmRJbmRleChjID0+IHR5cGVvZiBjLmxhYmVsID09PSAnc3RyaW5nJyA/IGMubGFiZWwgPT09IGlubGluZUNvbXBsZXRpb25MYWJlbCA6IGMubGFiZWwubGFiZWwgPT09IGlubGluZUNvbXBsZXRpb25MYWJlbCk7XG5cdFx0aWYgKGlubGluZUNvbXBsZXRpb25NYXRjaEluZGV4ICE9PSAtMSkge1xuXHRcdFx0Ly8gUmVtb3ZlIHRoZSBleGlzdGluZyBpbmxpbmUgY29tcGxldGlvbiBpdGVtIGZyb20gdGhlIGNvbXBsZXRpb25zIGxpc3Rcblx0XHRcdGNvbnN0IHJpY2hDb21wbGV0aW9uTWF0Y2hpbmdJbmxpbmUgPSBjb21wbGV0aW9ucy5zcGxpY2UoaW5saW5lQ29tcGxldGlvbk1hdGNoSW5kZXgsIDEpWzBdO1xuXHRcdFx0Ly8gQXBwbHkgaXRzIHByb3BlcnRpZXMgdG8gdGhlIGlubGluZSBjb21wbGV0aW9uIGl0ZW1cblx0XHRcdHRoaXMuX2lubGluZUNvbXBsZXRpb25JdGVtLmNvbXBsZXRpb24ubGFiZWwgPSByaWNoQ29tcGxldGlvbk1hdGNoaW5nSW5saW5lLmxhYmVsO1xuXHRcdFx0dGhpcy5faW5saW5lQ29tcGxldGlvbkl0ZW0uY29tcGxldGlvbi5kZXRhaWwgPSByaWNoQ29tcGxldGlvbk1hdGNoaW5nSW5saW5lLmRldGFpbDtcblx0XHRcdHRoaXMuX2lubGluZUNvbXBsZXRpb25JdGVtLmNvbXBsZXRpb24uZG9jdW1lbnRhdGlvbiA9IHJpY2hDb21wbGV0aW9uTWF0Y2hpbmdJbmxpbmUuZG9jdW1lbnRhdGlvbjtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX2lubGluZUNvbXBsZXRpb25JdGVtLmNvbXBsZXRpb24pIHtcblx0XHRcdHRoaXMuX2lubGluZUNvbXBsZXRpb25JdGVtLmNvbXBsZXRpb24uZGV0YWlsID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5faW5saW5lQ29tcGxldGlvbkl0ZW0uY29tcGxldGlvbi5kb2N1bWVudGF0aW9uID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3JlcXVlc3RUcmlnZ2VyQ2hhclF1aWNrU3VnZ2VzdENvbXBsZXRpb25zKCk6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5fd2FzTGFzdElucHV0VmVydGljYWxBcnJvd0tleSgpKSB7XG5cdFx0XHQvLyBPbmx5IHJlcXVlc3Qgb24gdHJpZ2dlciBjaGFyYWN0ZXIgd2hlbiBpdCdzIGEgcmVndWxhciBpbnB1dCwgb3Igb24gYW4gYXJyb3cgaWYgdGhlIHdpZGdldFxuXHRcdFx0Ly8gaXMgYWxyZWFkeSB2aXNpYmxlXG5cdFx0XHRpZiAoIXRoaXMuX3dhc0xhc3RJbnB1dEluY2x1ZGVkRXNjYXBlKCkgfHwgdGhpcy5fdGVybWluYWxTdWdnZXN0V2lkZ2V0VmlzaWJsZUNvbnRleHRLZXkuZ2V0KCkpIHtcblx0XHRcdFx0dGhpcy5yZXF1ZXN0Q29tcGxldGlvbnMoKTtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgX3dhc0xhc3RJbnB1dFJpZ2h0QXJyb3dLZXkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5fbGFzdFVzZXJEYXRhPy5tYXRjaCgvXlxceDFiW1xcW09dP0MkLyk7XG5cdH1cblxuXHRwcml2YXRlIF93YXNMYXN0SW5wdXRWZXJ0aWNhbEFycm93S2V5KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuX2xhc3RVc2VyRGF0YT8ubWF0Y2goL15cXHgxYltcXFtPXT9bQS1CXSQvKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBXaGV0aGVyIHRoZSBsYXN0IGlucHV0IGluY2x1ZGVkIHRoZSBlc2NhcGUgY2hhcmFjdGVyLiBUeXBpY2FsbHkgdGhpcyB3aWxsIG1lYW4gaXQgd2FzIG1vcmVcblx0ICogdGhhbiBqdXN0IGEgc2ltcGxlIGNoYXJhY3Rlciwgc3VjaCBhcyBhcnJvdyBrZXlzLCBob21lLCBlbmQsIGV0Yy5cblx0ICovXG5cdHByaXZhdGUgX3dhc0xhc3RJbnB1dEluY2x1ZGVkRXNjYXBlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuX2xhc3RVc2VyRGF0YT8uaW5jbHVkZXMoJ1xceDFiJyk7XG5cdH1cblxuXHRwcml2YXRlIF93YXNMYXN0SW5wdXRBcnJvd0tleSgpOiBib29sZWFuIHtcblx0XHQvLyBOZXZlciByZXF1ZXN0IGNvbXBsZXRpb25zIGlmIHRoZSBsYXN0IGtleSBzZXF1ZW5jZSB3YXMgdXAgb3IgZG93biBhcyB0aGUgdXNlciB3YXMgbGlrZWx5XG5cdFx0Ly8gbmF2aWdhdGluZyBoaXN0b3J5XG5cdFx0cmV0dXJuICEhdGhpcy5fbGFzdFVzZXJEYXRhPy5tYXRjaCgvXlxceDFiW1xcW09dP1tBLURdJC8pO1xuXHR9XG5cblx0cHJpdmF0ZSBfc3luYyhwcm9tcHRJbnB1dFN0YXRlOiBJUHJvbXB0SW5wdXRNb2RlbFN0YXRlKTogdm9pZCB7XG5cdFx0Y29uc3QgY29uZmlnID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8SVRlcm1pbmFsU3VnZ2VzdENvbmZpZ3VyYXRpb24+KHRlcm1pbmFsU3VnZ2VzdENvbmZpZ1NlY3Rpb24pO1xuXHRcdHtcblx0XHRcdGxldCBzZW50ID0gZmFsc2U7XG5cblx0XHRcdC8vIElmIHRoZSBjdXJzb3IgbW92ZWQgdG8gdGhlIHJpZ2h0XG5cdFx0XHRpZiAoIXRoaXMuX21vc3RSZWNlbnRQcm9tcHRJbnB1dFN0YXRlIHx8IHByb21wdElucHV0U3RhdGUuY3Vyc29ySW5kZXggPiB0aGlzLl9tb3N0UmVjZW50UHJvbXB0SW5wdXRTdGF0ZS5jdXJzb3JJbmRleCkge1xuXHRcdFx0XHQvLyBRdWljayBzdWdnZXN0aW9ucyAtIFRyaWdnZXIgd2hlbmV2ZXIgYSBuZXcgbm9uLXdoaXRlc3BhY2UgY2hhcmFjdGVyIGlzIHVzZWRcblx0XHRcdFx0aWYgKCF0aGlzLl90ZXJtaW5hbFN1Z2dlc3RXaWRnZXRWaXNpYmxlQ29udGV4dEtleS5nZXQoKSkge1xuXHRcdFx0XHRcdGNvbnN0IGNvbW1hbmRMaW5lSGFzU3BhY2UgPSBwcm9tcHRJbnB1dFN0YXRlLnByZWZpeC50cmltKCkubWF0Y2goL1xccy8pO1xuXHRcdFx0XHRcdGlmIChcblx0XHRcdFx0XHRcdCghY29tbWFuZExpbmVIYXNTcGFjZSAmJiBjb25maWcucXVpY2tTdWdnZXN0aW9ucy5jb21tYW5kcyAhPT0gJ29mZicpIHx8XG5cdFx0XHRcdFx0XHQoY29tbWFuZExpbmVIYXNTcGFjZSAmJiBjb25maWcucXVpY2tTdWdnZXN0aW9ucy5hcmd1bWVudHMgIT09ICdvZmYnKVxuXHRcdFx0XHRcdCkge1xuXHRcdFx0XHRcdFx0aWYgKHByb21wdElucHV0U3RhdGUucHJlZml4Lm1hdGNoKC9bXlxcc10kLykpIHtcblx0XHRcdFx0XHRcdFx0c2VudCA9IHRoaXMuX3JlcXVlc3RUcmlnZ2VyQ2hhclF1aWNrU3VnZ2VzdENvbXBsZXRpb25zKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gVHJpZ2dlciBjaGFyYWN0ZXJzIC0gdGhpcyBoYXBwZW5zIGV2ZW4gaWYgdGhlIHdpZGdldCBpcyBzaG93aW5nXG5cdFx0XHRcdGlmIChjb25maWcuc3VnZ2VzdE9uVHJpZ2dlckNoYXJhY3RlcnMgJiYgIXNlbnQpIHtcblx0XHRcdFx0XHRjb25zdCBwcmVmaXggPSBwcm9tcHRJbnB1dFN0YXRlLnByZWZpeDtcblx0XHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0XHQvLyBPbmx5IHRyaWdnZXIgb24gYC1gIGlmIGl0J3MgYWZ0ZXIgYSBzcGFjZS4gVGhpcyBpcyByZXF1aXJlZCB0byBub3QgY2xlYXJcblx0XHRcdFx0XHRcdC8vIGNvbXBsZXRpb25zIHdoZW4gdHlwaW5nIHRoZSBgLWAgaW4gYGdpdCBjaGVycnktcGlja2Bcblx0XHRcdFx0XHRcdHByZWZpeD8ubWF0Y2goL1xcc1tcXC1dJC8pIHx8XG5cdFx0XHRcdFx0XHQvLyBPbmx5IHRyaWdnZXIgb24gYFxcYCBhbmQgYC9gIGlmIGl0J3MgYSBkaXJlY3RvcnkuIE5vdCBkb2luZyBzbyBjYXVzZXMgcHJvYmxlbXNcblx0XHRcdFx0XHRcdC8vIHdpdGggZ2l0IGJyYW5jaGVzIGluIHBhcnRpY3VsYXJcblx0XHRcdFx0XHRcdHRoaXMuX2lzRmlsdGVyaW5nRGlyZWN0b3JpZXMgJiYgcHJlZml4Py5tYXRjaCgvW1xcXFxcXC9dJC8pXG5cdFx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0XHRzZW50ID0gdGhpcy5fcmVxdWVzdFRyaWdnZXJDaGFyUXVpY2tTdWdnZXN0Q29tcGxldGlvbnMoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCFzZW50KSB7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IHByb3ZpZGVyIG9mIHRoaXMuX3Rlcm1pbmFsQ29tcGxldGlvblNlcnZpY2UucHJvdmlkZXJzKSB7XG5cdFx0XHRcdFx0XHRcdGlmICghcHJvdmlkZXIudHJpZ2dlckNoYXJhY3RlcnMpIHtcblx0XHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRmb3IgKGNvbnN0IGNoYXIgb2YgcHJvdmlkZXIudHJpZ2dlckNoYXJhY3RlcnMpIHtcblx0XHRcdFx0XHRcdFx0XHRpZiAocHJlZml4Py5lbmRzV2l0aChjaGFyKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0c2VudCA9IHRoaXMuX3JlcXVlc3RUcmlnZ2VyQ2hhclF1aWNrU3VnZ2VzdENvbXBsZXRpb25zKCk7XG5cdFx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gSWYgdGhlIGN1cnNvciBtb3ZlZCB0byB0aGUgbGVmdFxuXHRcdFx0aWYgKHRoaXMuX21vc3RSZWNlbnRQcm9tcHRJbnB1dFN0YXRlICYmIHByb21wdElucHV0U3RhdGUuY3Vyc29ySW5kZXggPCB0aGlzLl9tb3N0UmVjZW50UHJvbXB0SW5wdXRTdGF0ZS5jdXJzb3JJbmRleCAmJiBwcm9tcHRJbnB1dFN0YXRlLmN1cnNvckluZGV4ID4gMCkge1xuXHRcdFx0XHQvLyBXZSBvbmx5IHdhbnQgdG8gcmVmcmVzaCB2aWEgdHJpZ2dlciBjaGFyYWN0ZXJzIGluIHRoaXMgY2FzZSBpZiB0aGUgd2lkZ2V0IGlzXG5cdFx0XHRcdC8vIGFscmVhZHkgdmlzaWJsZVxuXHRcdFx0XHRpZiAodGhpcy5fdGVybWluYWxTdWdnZXN0V2lkZ2V0VmlzaWJsZUNvbnRleHRLZXkuZ2V0KCkpIHtcblx0XHRcdFx0XHQvLyBCYWNrc3BhY2Ugb3IgbGVmdCBwYXN0IGEgdHJpZ2dlciBjaGFyYWN0ZXJcblx0XHRcdFx0XHRpZiAoY29uZmlnLnN1Z2dlc3RPblRyaWdnZXJDaGFyYWN0ZXJzICYmICFzZW50ICYmIHRoaXMuX21vc3RSZWNlbnRQcm9tcHRJbnB1dFN0YXRlLmN1cnNvckluZGV4ID4gMCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgY2hhciA9IHRoaXMuX21vc3RSZWNlbnRQcm9tcHRJbnB1dFN0YXRlLnZhbHVlW3RoaXMuX21vc3RSZWNlbnRQcm9tcHRJbnB1dFN0YXRlLmN1cnNvckluZGV4IC0gMV07XG5cdFx0XHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0XHRcdC8vIE9ubHkgdHJpZ2dlciBvbiBgXFxgIGFuZCBgL2AgaWYgaXQncyBhIGRpcmVjdG9yeS4gTm90IGRvaW5nIHNvIGNhdXNlcyBwcm9ibGVtc1xuXHRcdFx0XHRcdFx0XHQvLyB3aXRoIGdpdCBicmFuY2hlcyBpbiBwYXJ0aWN1bGFyXG5cdFx0XHRcdFx0XHRcdHRoaXMuX2lzRmlsdGVyaW5nRGlyZWN0b3JpZXMgJiYgY2hhci5tYXRjaCgvW1xcXFxcXC9dJC8pXG5cdFx0XHRcdFx0XHQpIHtcblx0XHRcdFx0XHRcdFx0c2VudCA9IHRoaXMuX3JlcXVlc3RUcmlnZ2VyQ2hhclF1aWNrU3VnZ2VzdENvbXBsZXRpb25zKCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSGlkZSB0aGUgd2lkZ2V0IGlmIGdob3N0IHRleHQgd2FzIGp1c3QgY29tcGxldGVkIHZpYSByaWdodCBhcnJvd1xuXHRcdGlmIChcblx0XHRcdHRoaXMuX3dhc0xhc3RJbnB1dFJpZ2h0QXJyb3dLZXkoKSAmJlxuXHRcdFx0dGhpcy5fbW9zdFJlY2VudFByb21wdElucHV0U3RhdGU/Lmdob3N0VGV4dEluZGV4ICE9PSAtMSAmJlxuXHRcdFx0cHJvbXB0SW5wdXRTdGF0ZS5naG9zdFRleHRJbmRleCA9PT0gLTEgJiZcblx0XHRcdHRoaXMuX21vc3RSZWNlbnRQcm9tcHRJbnB1dFN0YXRlPy52YWx1ZSA9PT0gcHJvbXB0SW5wdXRTdGF0ZS52YWx1ZVxuXHRcdCkge1xuXHRcdFx0dGhpcy5oaWRlU3VnZ2VzdFdpZGdldChmYWxzZSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fbW9zdFJlY2VudFByb21wdElucHV0U3RhdGUgPSBwcm9tcHRJbnB1dFN0YXRlO1xuXHRcdGlmICghdGhpcy5fcHJvbXB0SW5wdXRNb2RlbCB8fCAhdGhpcy5fdGVybWluYWwgfHwgIXRoaXMuX3N1Z2dlc3RXaWRnZXQgfHwgdGhpcy5fbGVhZGluZ0xpbmVDb250ZW50ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBwcmV2aW91c1Byb21wdElucHV0U3RhdGUgPSB0aGlzLl9jdXJyZW50UHJvbXB0SW5wdXRTdGF0ZTtcblx0XHR0aGlzLl9jdXJyZW50UHJvbXB0SW5wdXRTdGF0ZSA9IHByb21wdElucHV0U3RhdGU7XG5cblx0XHQvLyBIaWRlIHRoZSB3aWRnZXQgaWYgdGhlIGxhdGVzdCBjaGFyYWN0ZXIgd2FzIGEgc3BhY2Vcblx0XHRpZiAodGhpcy5fY3VycmVudFByb21wdElucHV0U3RhdGUuY3Vyc29ySW5kZXggPiAxICYmIHRoaXMuX2N1cnJlbnRQcm9tcHRJbnB1dFN0YXRlLnZhbHVlLmF0KHRoaXMuX2N1cnJlbnRQcm9tcHRJbnB1dFN0YXRlLmN1cnNvckluZGV4IC0gMSkgPT09ICcgJykge1xuXHRcdFx0aWYgKCF0aGlzLl93YXNMYXN0SW5wdXRBcnJvd0tleSgpKSB7XG5cdFx0XHRcdHRoaXMuaGlkZVN1Z2dlc3RXaWRnZXQoZmFsc2UpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gSGlkZSB0aGUgd2lkZ2V0IGlmIHRoZSBjdXJzb3IgbW92ZXMgdG8gdGhlIGxlZnQgYW5kIGludmFsaWRhdGVzIHRoZSBjb21wbGV0aW9ucy5cblx0XHQvLyBPcmlnaW5hbGx5IHRoaXMgd2FzIHRvIHRoZSBsZWZ0IG9mIHRoZSBpbml0aWFsIHBvc2l0aW9uIHRoYXQgdGhlIGNvbXBsZXRpb25zIHdlcmVcblx0XHQvLyByZXF1ZXN0ZWQsIGJ1dCBzaW5jZSBleHRlbnNpb25zIGFyZSBleHBlY3RlZCB0byBhbGxvdyB0aGUgY2xpZW50LXNpZGUgdG8gZmlsdGVyLCB0aGV5IGFyZVxuXHRcdC8vIG9ubHkgaW52YWxpZGF0ZWQgd2hlbiB3aGl0ZXNwYWNlIGlzIGVuY291bnRlcmVkLlxuXHRcdGlmICh0aGlzLl9jdXJyZW50UHJvbXB0SW5wdXRTdGF0ZSAmJiB0aGlzLl9jdXJyZW50UHJvbXB0SW5wdXRTdGF0ZS5jdXJzb3JJbmRleCA8IHRoaXMuX2xlYWRpbmdMaW5lQ29udGVudC5sZW5ndGgpIHtcblx0XHRcdGlmICh0aGlzLl9jdXJyZW50UHJvbXB0SW5wdXRTdGF0ZS5jdXJzb3JJbmRleCA8PSAwIHx8IHByZXZpb3VzUHJvbXB0SW5wdXRTdGF0ZT8udmFsdWVbdGhpcy5fY3VycmVudFByb21wdElucHV0U3RhdGUuY3Vyc29ySW5kZXhdPy5tYXRjaCgvW1xcXFxcXC9cXHNdLykpIHtcblx0XHRcdFx0dGhpcy5oaWRlU3VnZ2VzdFdpZGdldChmYWxzZSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAodGhpcy5fdGVybWluYWxTdWdnZXN0V2lkZ2V0VmlzaWJsZUNvbnRleHRLZXkuZ2V0KCkpIHtcblx0XHRcdHRoaXMuX2N1cnNvckluZGV4RGVsdGEgPSB0aGlzLl9jdXJyZW50UHJvbXB0SW5wdXRTdGF0ZS5jdXJzb3JJbmRleCAtICh0aGlzLl9yZXF1ZXN0ZWRDb21wbGV0aW9uc0luZGV4KTtcblx0XHRcdGxldCBub3JtYWxpemVkTGVhZGluZ0xpbmVDb250ZW50ID0gdGhpcy5fY3VycmVudFByb21wdElucHV0U3RhdGUudmFsdWUuc3Vic3RyaW5nKDAsIHRoaXMuX3JlcXVlc3RlZENvbXBsZXRpb25zSW5kZXggKyB0aGlzLl9jdXJzb3JJbmRleERlbHRhKTtcblx0XHRcdGlmICh0aGlzLl9pc0ZpbHRlcmluZ0RpcmVjdG9yaWVzKSB7XG5cdFx0XHRcdG5vcm1hbGl6ZWRMZWFkaW5nTGluZUNvbnRlbnQgPSBub3JtYWxpemVQYXRoU2VwYXJhdG9yKG5vcm1hbGl6ZWRMZWFkaW5nTGluZUNvbnRlbnQsIHRoaXMuX3BhdGhTZXBhcmF0b3IpO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgbGluZUNvbnRleHQgPSBuZXcgTGluZUNvbnRleHQobm9ybWFsaXplZExlYWRpbmdMaW5lQ29udGVudCwgdGhpcy5fY3Vyc29ySW5kZXhEZWx0YSk7XG5cdFx0XHR0aGlzLl9zdWdnZXN0V2lkZ2V0LnNldExpbmVDb250ZXh0KGxpbmVDb250ZXh0KTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWZyZXNoSW5saW5lQ29tcGxldGlvbih0aGlzLl9tb2RlbD8uaXRlbXMubWFwKGkgPT4gaS5jb21wbGV0aW9uKSB8fCBbXSk7XG5cblx0XHQvLyBIaWRlIGFuZCBjbGVhciBtb2RlbCBpZiB0aGVyZSBhcmUgbm8gbW9yZSBpdGVtc1xuXHRcdGlmICghdGhpcy5fc3VnZ2VzdFdpZGdldC5oYXNDb21wbGV0aW9ucygpKSB7XG5cdFx0XHR0aGlzLmhpZGVTdWdnZXN0V2lkZ2V0KGZhbHNlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBkaW1lbnNpb25zID0gdGhpcy5fZ2V0VGVybWluYWxEaW1lbnNpb25zKCk7XG5cdFx0aWYgKCFkaW1lbnNpb25zLndpZHRoIHx8ICFkaW1lbnNpb25zLmhlaWdodCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCB4dGVybUJveCA9IHRoaXMuX3NjcmVlbiEuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG5cdFx0dGhpcy5fc3VnZ2VzdFdpZGdldC5zaG93U3VnZ2VzdGlvbnMoMCwgZmFsc2UsIHRydWUsIHtcblx0XHRcdGxlZnQ6IHh0ZXJtQm94LmxlZnQgKyB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmN1cnNvclggKiBkaW1lbnNpb25zLndpZHRoLFxuXHRcdFx0dG9wOiB4dGVybUJveC50b3AgKyB0aGlzLl90ZXJtaW5hbC5idWZmZXIuYWN0aXZlLmN1cnNvclkgKiBkaW1lbnNpb25zLmhlaWdodCxcblx0XHRcdGhlaWdodDogZGltZW5zaW9ucy5oZWlnaHRcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX3JlZnJlc2hJbmxpbmVDb21wbGV0aW9uKGNvbXBsZXRpb25zOiBJVGVybWluYWxDb21wbGV0aW9uW10pOiB2b2lkIHtcblx0XHRjb25zdCBvbGRJc0ludmFsaWQgPSB0aGlzLl9pbmxpbmVDb21wbGV0aW9uSXRlbS5pc0ludmFsaWQ7XG5cdFx0aWYgKCF0aGlzLl9jdXJyZW50UHJvbXB0SW5wdXRTdGF0ZSB8fCB0aGlzLl9jdXJyZW50UHJvbXB0SW5wdXRTdGF0ZS5naG9zdFRleHRJbmRleCA9PT0gLTEpIHtcblx0XHRcdHRoaXMuX2lubGluZUNvbXBsZXRpb25JdGVtLmlzSW52YWxpZCA9IHRydWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2lubGluZUNvbXBsZXRpb25JdGVtLmlzSW52YWxpZCA9IGZhbHNlO1xuXHRcdFx0Ly8gVXBkYXRlIHByb3BlcnRpZXNcblx0XHRcdGNvbnN0IHNwYWNlSW5kZXggPSB0aGlzLl9jdXJyZW50UHJvbXB0SW5wdXRTdGF0ZS52YWx1ZS5sYXN0SW5kZXhPZignICcsIHRoaXMuX2N1cnJlbnRQcm9tcHRJbnB1dFN0YXRlLmdob3N0VGV4dEluZGV4IC0gMSk7XG5cdFx0XHRjb25zdCByZXBsYWNlbWVudEluZGV4ID0gc3BhY2VJbmRleCA9PT0gLTEgPyAwIDogc3BhY2VJbmRleCArIDE7XG5cdFx0XHRjb25zdCBzdWdnZXN0aW9uID0gdGhpcy5fY3VycmVudFByb21wdElucHV0U3RhdGUudmFsdWUuc3Vic3RyaW5nKHJlcGxhY2VtZW50SW5kZXgpO1xuXHRcdFx0dGhpcy5faW5saW5lQ29tcGxldGlvbi5sYWJlbCA9IHN1Z2dlc3Rpb247XG5cdFx0XHR0aGlzLl9pbmxpbmVDb21wbGV0aW9uLnJlcGxhY2VtZW50SW5kZXggPSByZXBsYWNlbWVudEluZGV4O1xuXHRcdFx0Ly8gTm90ZSB0aGF0IHRoZSBjdXJzb3IgaW5kZXggZGVsdGEgbXVzdCBiZSB0YWtlbiBpbnRvIGFjY291bnQgaGVyZSwgb3RoZXJ3aXNlIGZpbHRlcmluZ1xuXHRcdFx0Ly8gd29udCB3b3JrIGNvcnJlY3RseS5cblx0XHRcdHRoaXMuX2lubGluZUNvbXBsZXRpb24ucmVwbGFjZW1lbnRMZW5ndGggPSB0aGlzLl9jdXJyZW50UHJvbXB0SW5wdXRTdGF0ZS5jdXJzb3JJbmRleCAtIHJlcGxhY2VtZW50SW5kZXggLSB0aGlzLl9jdXJzb3JJbmRleERlbHRhO1xuXHRcdFx0Ly8gUmVzZXQgdGhlIGNvbXBsZXRpb24gaXRlbSBhcyB0aGUgb2JqZWN0IHJlZmVyZW5jZSBtdXN0IHJlbWFpbiB0aGUgc2FtZSBidXQgaXRzXG5cdFx0XHQvLyBjb250ZW50cyB3aWxsIGRpZmZlciBhY3Jvc3Mgc3luY3MuIFRoaXMgaXMgZG9uZSBzbyB3ZSBkb24ndCBuZWVkIHRvIHJlYXNzaWduIHRoZVxuXHRcdFx0Ly8gbW9kZWwgYW5kIHRoZSBzbG93ZG93bi9mbGlja2VyaW5nIHRoYXQgY291bGQgcG90ZW50aWFsbHkgY2F1c2UuXG5cdFx0XHR0aGlzLl9hZGRQcm9wZXJ0aWVzVG9JbmxpbmVDb21wbGV0aW9uSXRlbShjb21wbGV0aW9ucyk7XG5cblx0XHRcdGNvbnN0IHggPSBuZXcgVGVybWluYWxDb21wbGV0aW9uSXRlbSh0aGlzLl9pbmxpbmVDb21wbGV0aW9uKTtcblx0XHRcdHRoaXMuX2lubGluZUNvbXBsZXRpb25JdGVtLmlkeCA9IHguaWR4O1xuXHRcdFx0dGhpcy5faW5saW5lQ29tcGxldGlvbkl0ZW0uc2NvcmUgPSB4LnNjb3JlO1xuXHRcdFx0dGhpcy5faW5saW5lQ29tcGxldGlvbkl0ZW0ubGFiZWxMb3cgPSB4LmxhYmVsTG93O1xuXHRcdFx0dGhpcy5faW5saW5lQ29tcGxldGlvbkl0ZW0udGV4dExhYmVsID0geC50ZXh0TGFiZWw7XG5cdFx0XHR0aGlzLl9pbmxpbmVDb21wbGV0aW9uSXRlbS5maWxlRXh0TG93ID0geC5maWxlRXh0TG93O1xuXHRcdFx0dGhpcy5faW5saW5lQ29tcGxldGlvbkl0ZW0ubGFiZWxMb3dFeGNsdWRlRmlsZUV4dCA9IHgubGFiZWxMb3dFeGNsdWRlRmlsZUV4dDtcblx0XHRcdHRoaXMuX2lubGluZUNvbXBsZXRpb25JdGVtLmxhYmVsTG93Tm9ybWFsaXplZFBhdGggPSB4LmxhYmVsTG93Tm9ybWFsaXplZFBhdGg7XG5cdFx0XHR0aGlzLl9pbmxpbmVDb21wbGV0aW9uSXRlbS51bmRlcnNjb3JlUGVuYWx0eSA9IHgudW5kZXJzY29yZVBlbmFsdHk7XG5cdFx0XHR0aGlzLl9pbmxpbmVDb21wbGV0aW9uSXRlbS53b3JkID0geC53b3JkO1xuXHRcdFx0dGhpcy5fbW9kZWw/LmZvcmNlUmVmaWx0ZXJBbGwoKTtcblx0XHR9XG5cblx0XHQvLyBGb3JjZSBhIGZpbHRlciBhbGwgaW4gb3JkZXIgdG8gcmUtZXZhbHVhdGUgdGhlIGlubGluZSBjb21wbGV0aW9uXG5cdFx0aWYgKHRoaXMuX2lubGluZUNvbXBsZXRpb25JdGVtLmlzSW52YWxpZCAhPT0gb2xkSXNJbnZhbGlkKSB7XG5cdFx0XHR0aGlzLl9tb2RlbD8uZm9yY2VSZWZpbHRlckFsbCgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2dldFRlcm1pbmFsRGltZW5zaW9ucygpOiB7IHdpZHRoOiBudW1iZXI7IGhlaWdodDogbnVtYmVyIH0ge1xuXHRcdGNvbnN0IGNzc0NlbGxEaW1zID0gKHRoaXMuX3Rlcm1pbmFsIGFzIGFueSBhcyB7IF9jb3JlOiBJWHRlcm1Db3JlIH0pLl9jb3JlLl9yZW5kZXJTZXJ2aWNlLmRpbWVuc2lvbnMuY3NzLmNlbGw7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHdpZHRoOiBjc3NDZWxsRGltcy53aWR0aCxcblx0XHRcdGhlaWdodDogY3NzQ2VsbERpbXMuaGVpZ2h0LFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIF9nZXRGb250SW5mbygpOiBJU2ltcGxlU3VnZ2VzdFdpZGdldEZvbnRJbmZvIHtcblx0XHRpZiAodGhpcy5fY2FjaGVkRm9udEluZm8pIHtcblx0XHRcdHJldHVybiB0aGlzLl9jYWNoZWRGb250SW5mbztcblx0XHR9XG5cblx0XHRjb25zdCBjb3JlID0gKHRoaXMuX3Rlcm1pbmFsIGFzIGFueSkuX2NvcmUgYXMgSVh0ZXJtQ29yZTtcblx0XHRjb25zdCBmb250ID0gdGhpcy5fdGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZS5nZXRGb250KGRvbS5nZXRBY3RpdmVXaW5kb3coKSwgY29yZSk7XG5cdFx0bGV0IGxpbmVIZWlnaHQ6IG51bWJlciA9IGZvbnQubGluZUhlaWdodDtcblx0XHRjb25zdCBmb250U2l6ZTogbnVtYmVyID0gZm9udC5mb250U2l6ZTtcblx0XHRjb25zdCBmb250RmFtaWx5OiBzdHJpbmcgPSBmb250LmZvbnRGYW1pbHk7XG5cdFx0Y29uc3QgbGV0dGVyU3BhY2luZzogbnVtYmVyID0gZm9udC5sZXR0ZXJTcGFjaW5nO1xuXHRcdGNvbnN0IGZvbnRXZWlnaHQ6IHN0cmluZyA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdlZGl0b3IuZm9udFdlaWdodCcpO1xuXG5cdFx0aWYgKGxpbmVIZWlnaHQgPD0gMSkge1xuXHRcdFx0bGluZUhlaWdodCA9IEdPTERFTl9MSU5FX0hFSUdIVF9SQVRJTyAqIGZvbnRTaXplO1xuXHRcdH0gZWxzZSBpZiAobGluZUhlaWdodCA8IE1JTklNVU1fTElORV9IRUlHSFQpIHtcblx0XHRcdC8vIFZhbHVlcyB0b28gc21hbGwgdG8gYmUgbGluZSBoZWlnaHRzIGluIHBpeGVscyBhcmUgaW4gZW1zLlxuXHRcdFx0bGluZUhlaWdodCA9IGxpbmVIZWlnaHQgKiBmb250U2l6ZTtcblx0XHR9XG5cblx0XHQvLyBFbmZvcmNlIGludGVnZXIsIG1pbmltdW0gY29uc3RyYWludHNcblx0XHRsaW5lSGVpZ2h0ID0gTWF0aC5yb3VuZChsaW5lSGVpZ2h0KTtcblx0XHRpZiAobGluZUhlaWdodCA8IE1JTklNVU1fTElORV9IRUlHSFQpIHtcblx0XHRcdGxpbmVIZWlnaHQgPSBNSU5JTVVNX0xJTkVfSEVJR0hUO1xuXHRcdH1cblxuXHRcdGNvbnN0IGZvbnRJbmZvID0ge1xuXHRcdFx0Zm9udFNpemUsXG5cdFx0XHRsaW5lSGVpZ2h0LFxuXHRcdFx0Zm9udFdlaWdodDogZm9udFdlaWdodC50b1N0cmluZygpLFxuXHRcdFx0bGV0dGVyU3BhY2luZyxcblx0XHRcdGZvbnRGYW1pbHlcblx0XHR9O1xuXG5cdFx0dGhpcy5fY2FjaGVkRm9udEluZm8gPSBmb250SW5mbztcblxuXHRcdHJldHVybiBmb250SW5mbztcblx0fVxuXG5cdHByaXZhdGUgX2dldEFkdmFuY2VkRXhwbGFpbk1vZGVEZXRhaWxzKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIGBwcm9tcHRJbnB1dE1vZGVsOiAke3RoaXMuX3Byb21wdElucHV0TW9kZWw/LmdldENvbWJpbmVkU3RyaW5nKCl9YDtcblx0fVxuXG5cdHByaXZhdGUgX3Nob3dDb21wbGV0aW9ucyhtb2RlbDogVGVybWluYWxDb21wbGV0aW9uTW9kZWwsIGV4cGxpY2l0bHlJbnZva2VkPzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICghdGhpcy5fdGVybWluYWw/LmVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3Qgc3VnZ2VzdFdpZGdldCA9IHRoaXMuX2Vuc3VyZVN1Z2dlc3RXaWRnZXQodGhpcy5fdGVybWluYWwpO1xuXHRcdHN1Z2dlc3RXaWRnZXQuc2V0Q29tcGxldGlvbk1vZGVsKG1vZGVsKTtcblx0XHR0aGlzLl9yZWdpc3RlcihzdWdnZXN0V2lkZ2V0Lm9uRGlkRm9jdXMoKCkgPT4gdGhpcy5fdGVybWluYWw/LmZvY3VzKCkpKTtcblx0XHRpZiAoIXRoaXMuX3Byb21wdElucHV0TW9kZWwgfHwgIWV4cGxpY2l0bHlJbnZva2VkICYmIG1vZGVsLml0ZW1zLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl9tb2RlbCA9IG1vZGVsO1xuXHRcdGNvbnN0IGRpbWVuc2lvbnMgPSB0aGlzLl9nZXRUZXJtaW5hbERpbWVuc2lvbnMoKTtcblx0XHRpZiAoIWRpbWVuc2lvbnMud2lkdGggfHwgIWRpbWVuc2lvbnMuaGVpZ2h0KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHh0ZXJtQm94ID0gdGhpcy5fc2NyZWVuIS5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcblx0XHRzdWdnZXN0V2lkZ2V0LnNob3dTdWdnZXN0aW9ucygwLCBmYWxzZSwgIWV4cGxpY2l0bHlJbnZva2VkLCB7XG5cdFx0XHRsZWZ0OiB4dGVybUJveC5sZWZ0ICsgdGhpcy5fdGVybWluYWwuYnVmZmVyLmFjdGl2ZS5jdXJzb3JYICogZGltZW5zaW9ucy53aWR0aCxcblx0XHRcdHRvcDogeHRlcm1Cb3gudG9wICsgdGhpcy5fdGVybWluYWwuYnVmZmVyLmFjdGl2ZS5jdXJzb3JZICogZGltZW5zaW9ucy5oZWlnaHQsXG5cdFx0XHRoZWlnaHQ6IGRpbWVuc2lvbnMuaGVpZ2h0XG5cdFx0fSk7XG5cdH1cblxuXG5cdHByaXZhdGUgX2Vuc3VyZVN1Z2dlc3RXaWRnZXQodGVybWluYWw6IFRlcm1pbmFsKTogU2ltcGxlU3VnZ2VzdFdpZGdldDxUZXJtaW5hbENvbXBsZXRpb25Nb2RlbCwgVGVybWluYWxDb21wbGV0aW9uSXRlbT4ge1xuXHRcdGlmICghdGhpcy5fc3VnZ2VzdFdpZGdldCkge1xuXHRcdFx0dGhpcy5fc3VnZ2VzdFdpZGdldCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRTaW1wbGVTdWdnZXN0V2lkZ2V0LFxuXHRcdFx0XHR0aGlzLl9jb250YWluZXIhLFxuXHRcdFx0XHR0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShQZXJzaXN0ZWRXaWRnZXRTaXplKSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHN0YXR1c0Jhck1lbnVJZDogTWVudUlkLk1lbnViYXJUZXJtaW5hbFN1Z2dlc3RTdGF0dXNNZW51LFxuXHRcdFx0XHRcdHNob3dTdGF0dXNCYXJTZXR0aW5nSWQ6IFRlcm1pbmFsU3VnZ2VzdFNldHRpbmdJZC5TaG93U3RhdHVzQmFyXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHRoaXMuX2dldEZvbnRJbmZvLmJpbmQodGhpcyksXG5cdFx0XHRcdHRoaXMuX29uRGlkRm9udENvbmZpZ3VyYXRpb25DaGFuZ2UuZXZlbnQuYmluZCh0aGlzKSxcblx0XHRcdFx0dGhpcy5fZ2V0QWR2YW5jZWRFeHBsYWluTW9kZURldGFpbHMuYmluZCh0aGlzKVxuXHRcdFx0KSkgYXMgYW55IGFzIFNpbXBsZVN1Z2dlc3RXaWRnZXQ8VGVybWluYWxDb21wbGV0aW9uTW9kZWwsIFRlcm1pbmFsQ29tcGxldGlvbkl0ZW0+O1xuXHRcdFx0dGhpcy5fc3VnZ2VzdFdpZGdldC5saXN0LnN0eWxlKGdldExpc3RTdHlsZXMoe1xuXHRcdFx0XHRsaXN0SW5hY3RpdmVGb2N1c0JhY2tncm91bmQ6IGVkaXRvclN1Z2dlc3RXaWRnZXRTZWxlY3RlZEJhY2tncm91bmQsXG5cdFx0XHRcdGxpc3RJbmFjdGl2ZUZvY3VzT3V0bGluZTogYWN0aXZlQ29udHJhc3RCb3JkZXJcblx0XHRcdH0pKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3N1Z2dlc3RXaWRnZXQub25EaWRTZWxlY3QoYXN5bmMgZSA9PiB0aGlzLmFjY2VwdFNlbGVjdGVkU3VnZ2VzdGlvbihlKSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fc3VnZ2VzdFdpZGdldC5vbkRpZEhpZGUoKCkgPT4gdGhpcy5fdGVybWluYWxTdWdnZXN0V2lkZ2V0VmlzaWJsZUNvbnRleHRLZXkucmVzZXQoKSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fc3VnZ2VzdFdpZGdldC5vbkRpZFNob3coKCkgPT4gdGhpcy5fdGVybWluYWxTdWdnZXN0V2lkZ2V0VmlzaWJsZUNvbnRleHRLZXkuc2V0KHRydWUpKSk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKFRlcm1pbmFsU2V0dGluZ0lkLkZvbnRGYW1pbHkpIHx8IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGVybWluYWxTZXR0aW5nSWQuRm9udFNpemUpIHx8IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oVGVybWluYWxTZXR0aW5nSWQuTGluZUhlaWdodCkgfHwgZS5hZmZlY3RzQ29uZmlndXJhdGlvbihUZXJtaW5hbFNldHRpbmdJZC5Gb250RmFtaWx5KSB8fCBlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdlZGl0b3IuZm9udFNpemUnKSB8fCBlLmFmZmVjdHNDb25maWd1cmF0aW9uKCdlZGl0b3IuZm9udEZhbWlseScpKSB7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRGb250Q29uZmlndXJhdGlvbkNoYW5nZS5maXJlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdCkpO1xuXHRcdFx0Y29uc3QgZWxlbWVudCA9IHRoaXMuX3Rlcm1pbmFsPy5lbGVtZW50Py5xdWVyeVNlbGVjdG9yKCcueHRlcm0taGVscGVyLXRleHRhcmVhJyk7XG5cdFx0XHRpZiAoZWxlbWVudCkge1xuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcihkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGRvbS5nZXRBY3RpdmVEb2N1bWVudCgpLCAnY2xpY2snLCAoZXZlbnQpID0+IHtcblx0XHRcdFx0XHRjb25zdCB0YXJnZXQgPSBldmVudC50YXJnZXQgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0XHRcdFx0aWYgKHRoaXMuX3Rlcm1pbmFsPy5lbGVtZW50Py5jb250YWlucyh0YXJnZXQpKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9zdWdnZXN0V2lkZ2V0Py5oaWRlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3N1Z2dlc3RXaWRnZXQub25EaWRCbHVyRGV0YWlscygoZSkgPT4ge1xuXHRcdFx0XHRjb25zdCBlbHQgPSBlLnJlbGF0ZWRUYXJnZXQgYXMgSFRNTEVsZW1lbnQ7XG5cdFx0XHRcdGlmICh0aGlzLl90ZXJtaW5hbD8uZWxlbWVudD8uY29udGFpbnMoZWx0KSkge1xuXHRcdFx0XHRcdC8vIERvIG5vdGhpbmcsIGp1c3QgdGhlIHRlcm1pbmFsIGdldHRpbmcgZm9jdXNlZFxuXHRcdFx0XHRcdC8vIElmIHRoZXJlIHdhcyBhIG1vdXNlIGNsaWNrLCB0aGUgc3VnZ2VzdCB3aWRnZXQgd2lsbCBiZVxuXHRcdFx0XHRcdC8vIGhpZGRlbiBhYm92ZVxuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9zdWdnZXN0V2lkZ2V0Py5oaWRlKCk7XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLl90ZXJtaW5hbFN1Z2dlc3RXaWRnZXRWaXNpYmxlQ29udGV4dEtleS5zZXQoZmFsc2UpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fc3VnZ2VzdFdpZGdldDtcblx0fVxuXG5cdHNlbGVjdFByZXZpb3VzU3VnZ2VzdGlvbigpOiB2b2lkIHtcblx0XHR0aGlzLl9zdWdnZXN0V2lkZ2V0Py5zZWxlY3RQcmV2aW91cygpO1xuXHR9XG5cblx0c2VsZWN0UHJldmlvdXNQYWdlU3VnZ2VzdGlvbigpOiB2b2lkIHtcblx0XHR0aGlzLl9zdWdnZXN0V2lkZ2V0Py5zZWxlY3RQcmV2aW91c1BhZ2UoKTtcblx0fVxuXG5cdHNlbGVjdE5leHRTdWdnZXN0aW9uKCk6IHZvaWQge1xuXHRcdHRoaXMuX3N1Z2dlc3RXaWRnZXQ/LnNlbGVjdE5leHQoKTtcblx0fVxuXG5cdHNlbGVjdE5leHRQYWdlU3VnZ2VzdGlvbigpOiB2b2lkIHtcblx0XHR0aGlzLl9zdWdnZXN0V2lkZ2V0Py5zZWxlY3ROZXh0UGFnZSgpO1xuXHR9XG5cblx0YWNjZXB0U2VsZWN0ZWRTdWdnZXN0aW9uKHN1Z2dlc3Rpb24/OiBQaWNrPElTaW1wbGVTZWxlY3RlZFN1Z2dlc3Rpb248VGVybWluYWxDb21wbGV0aW9uSXRlbT4sICdpdGVtJyB8ICdtb2RlbCc+LCByZXNwZWN0UnVuT25FbnRlcj86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAoIXN1Z2dlc3Rpb24pIHtcblx0XHRcdHN1Z2dlc3Rpb24gPSB0aGlzLl9zdWdnZXN0V2lkZ2V0Py5nZXRGb2N1c2VkSXRlbSgpO1xuXHRcdH1cblx0XHRjb25zdCBpbml0aWFsUHJvbXB0SW5wdXRTdGF0ZSA9IHRoaXMuX21vc3RSZWNlbnRQcm9tcHRJbnB1dFN0YXRlO1xuXHRcdGlmICghc3VnZ2VzdGlvbiB8fCAhaW5pdGlhbFByb21wdElucHV0U3RhdGUgfHwgdGhpcy5fbGVhZGluZ0xpbmVDb250ZW50ID09PSB1bmRlZmluZWQgfHwgIXRoaXMuX21vZGVsKSB7XG5cdFx0XHR0aGlzLl9zdWdnZXN0VGVsZW1ldHJ5Py5hY2NlcHRDb21wbGV0aW9uKHVuZGVmaW5lZCwgdGhpcy5fbW9zdFJlY2VudFByb21wdElucHV0U3RhdGU/LnZhbHVlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0U3VnZ2VzdEFkZG9uLmxhc3RBY2NlcHRlZENvbXBsZXRpb25UaW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuXHRcdHRoaXMuX3N1Z2dlc3RXaWRnZXQ/LmhpZGUoKTtcblxuXHRcdGNvbnN0IGN1cnJlbnRQcm9tcHRJbnB1dFN0YXRlID0gdGhpcy5fY3VycmVudFByb21wdElucHV0U3RhdGUgPz8gaW5pdGlhbFByb21wdElucHV0U3RhdGU7XG5cblx0XHQvLyBUaGUgcmVwbGFjZW1lbnQgdGV4dCBpcyBhbnkgdGV4dCBhZnRlciB0aGUgcmVwbGFjZW1lbnQgaW5kZXggZm9yIHRoZSBjb21wbGV0aW9ucywgdGhpc1xuXHRcdC8vIGluY2x1ZGVzIGFueSB0ZXh0IHRoYXQgd2FzIHRoZXJlIGJlZm9yZSB0aGUgY29tcGxldGlvbnMgd2VyZSByZXF1ZXN0ZWQgYW5kIGFueSB0ZXh0IGFkZGVkXG5cdFx0Ly8gc2luY2UgdG8gcmVmaW5lIHRoZSBjb21wbGV0aW9uLlxuXHRcdGNvbnN0IHJlcGxhY2VtZW50VGV4dCA9IGN1cnJlbnRQcm9tcHRJbnB1dFN0YXRlLnZhbHVlLnN1YnN0cmluZyhzdWdnZXN0aW9uLml0ZW0uY29tcGxldGlvbi5yZXBsYWNlbWVudEluZGV4LCBjdXJyZW50UHJvbXB0SW5wdXRTdGF0ZS5jdXJzb3JJbmRleCk7XG5cblx0XHQvLyBSaWdodCBzaWRlIG9mIHJlcGxhY2VtZW50IHRleHQgaW4gdGhlIHNhbWUgd29yZFxuXHRcdGxldCByaWdodFNpZGVSZXBsYWNlbWVudFRleHQgPSAnJztcblx0XHRpZiAoXG5cdFx0XHQvLyBUaGUgbGluZSBkaWRuJ3QgZW5kIHdpdGggZ2hvc3QgdGV4dFxuXHRcdFx0KGN1cnJlbnRQcm9tcHRJbnB1dFN0YXRlLmdob3N0VGV4dEluZGV4ID09PSAtMSB8fCBjdXJyZW50UHJvbXB0SW5wdXRTdGF0ZS5naG9zdFRleHRJbmRleCA+IGN1cnJlbnRQcm9tcHRJbnB1dFN0YXRlLmN1cnNvckluZGV4KSAmJlxuXHRcdFx0Ly8gVGhlcmUgaXMgbW9yZSB0aGFuIG9uZSBjaGFyYXRjZXJcblx0XHRcdGN1cnJlbnRQcm9tcHRJbnB1dFN0YXRlLnZhbHVlLmxlbmd0aCA+IGN1cnJlbnRQcm9tcHRJbnB1dFN0YXRlLmN1cnNvckluZGV4ICsgMSAmJlxuXHRcdFx0Ly8gVEhlIG5leHQgY2hhcmFjdGVyIGlzIG5vdCBhIHNwYWNlXG5cdFx0XHRjdXJyZW50UHJvbXB0SW5wdXRTdGF0ZS52YWx1ZS5hdChjdXJyZW50UHJvbXB0SW5wdXRTdGF0ZS5jdXJzb3JJbmRleCkgIT09ICcgJ1xuXHRcdCkge1xuXHRcdFx0Y29uc3Qgc3BhY2VJbmRleCA9IGN1cnJlbnRQcm9tcHRJbnB1dFN0YXRlLnZhbHVlLnN1YnN0cmluZyhjdXJyZW50UHJvbXB0SW5wdXRTdGF0ZS5jdXJzb3JJbmRleCwgY3VycmVudFByb21wdElucHV0U3RhdGUuZ2hvc3RUZXh0SW5kZXggPT09IC0xID8gdW5kZWZpbmVkIDogY3VycmVudFByb21wdElucHV0U3RhdGUuZ2hvc3RUZXh0SW5kZXgpLmluZGV4T2YoJyAnKTtcblx0XHRcdHJpZ2h0U2lkZVJlcGxhY2VtZW50VGV4dCA9IGN1cnJlbnRQcm9tcHRJbnB1dFN0YXRlLnZhbHVlLnN1YnN0cmluZyhjdXJyZW50UHJvbXB0SW5wdXRTdGF0ZS5jdXJzb3JJbmRleCwgc3BhY2VJbmRleCA9PT0gLTEgPyB1bmRlZmluZWQgOiBjdXJyZW50UHJvbXB0SW5wdXRTdGF0ZS5jdXJzb3JJbmRleCArIHNwYWNlSW5kZXgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbXBsZXRpb24gPSBzdWdnZXN0aW9uLml0ZW0uY29tcGxldGlvbjtcblx0XHRsZXQgcmVzdWx0U2VxdWVuY2UgPSBjb21wbGV0aW9uLmlucHV0RGF0YTtcblxuXHRcdC8vIFVzZSBmb3IgYW1lbmQgdGhlIGxhYmVsIGlmIGlucHV0RGF0YSBpcyBub3QgZGVmaW5lZFxuXHRcdGlmIChyZXN1bHRTZXF1ZW5jZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRsZXQgY29tcGxldGlvblRleHQgPSB0eXBlb2YgY29tcGxldGlvbi5sYWJlbCA9PT0gJ3N0cmluZycgPyBjb21wbGV0aW9uLmxhYmVsIDogY29tcGxldGlvbi5sYWJlbC5sYWJlbDtcblx0XHRcdGlmICgoY29tcGxldGlvbi5raW5kID09PSBUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5Gb2xkZXIgfHwgY29tcGxldGlvbi5pc0ZpbGVPdmVycmlkZSkgJiYgY29tcGxldGlvblRleHQuaW5jbHVkZXMoJyAnKSkge1xuXHRcdFx0XHQvLyBFc2NhcGUgc3BhY2VzIGluIGZpbGVzIG9yIGZvbGRlcnMgc28gdGhleSdyZSB2YWxpZCBwYXRoc1xuXHRcdFx0XHRjb21wbGV0aW9uVGV4dCA9IGNvbXBsZXRpb25UZXh0LnJlcGxhY2VBbGwoJyAnLCAnXFxcXCAnKTtcblx0XHRcdH1cblx0XHRcdGxldCBydW5PbkVudGVyID0gZmFsc2U7XG5cdFx0XHRpZiAocmVzcGVjdFJ1bk9uRW50ZXIpIHtcblx0XHRcdFx0Y29uc3QgcnVuT25FbnRlckNvbmZpZyA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPElUZXJtaW5hbFN1Z2dlc3RDb25maWd1cmF0aW9uPih0ZXJtaW5hbFN1Z2dlc3RDb25maWdTZWN0aW9uKS5ydW5PbkVudGVyO1xuXHRcdFx0XHRzd2l0Y2ggKHJ1bk9uRW50ZXJDb25maWcpIHtcblx0XHRcdFx0XHRjYXNlICdhbHdheXMnOiB7XG5cdFx0XHRcdFx0XHRydW5PbkVudGVyID0gdHJ1ZTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjYXNlICdleGFjdE1hdGNoJzoge1xuXHRcdFx0XHRcdFx0cnVuT25FbnRlciA9IHJlcGxhY2VtZW50VGV4dC50b0xvd2VyQ2FzZSgpID09PSBjb21wbGV0aW9uVGV4dC50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNhc2UgJ2V4YWN0TWF0Y2hJZ25vcmVFeHRlbnNpb24nOiB7XG5cdFx0XHRcdFx0XHRydW5PbkVudGVyID0gcmVwbGFjZW1lbnRUZXh0LnRvTG93ZXJDYXNlKCkgPT09IGNvbXBsZXRpb25UZXh0LnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRcdFx0XHRpZiAoY29tcGxldGlvbi5pc0ZpbGVPdmVycmlkZSkge1xuXHRcdFx0XHRcdFx0XHRydW5PbkVudGVyIHx8PSByZXBsYWNlbWVudFRleHQudG9Mb3dlckNhc2UoKSA9PT0gY29tcGxldGlvblRleHQudG9Mb3dlckNhc2UoKS5yZXBsYWNlKC9cXC5bXlxcLl0rJC8sICcnKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBjb21tb25QcmVmaXhMZW4gPSBjb21tb25QcmVmaXhMZW5ndGgocmVwbGFjZW1lbnRUZXh0LCBjb21wbGV0aW9uVGV4dCk7XG5cdFx0XHRjb25zdCBjb21tb25QcmVmaXggPSByZXBsYWNlbWVudFRleHQuc3Vic3RyaW5nKHJlcGxhY2VtZW50VGV4dC5sZW5ndGggLSAxIC0gY29tbW9uUHJlZml4TGVuLCByZXBsYWNlbWVudFRleHQubGVuZ3RoIC0gMSk7XG5cdFx0XHRjb25zdCBjb21wbGV0aW9uU3VmZml4ID0gY29tcGxldGlvblRleHQuc3Vic3RyaW5nKGNvbW1vblByZWZpeExlbik7XG5cdFx0XHRpZiAoY3VycmVudFByb21wdElucHV0U3RhdGUuc3VmZml4Lmxlbmd0aCA+IDAgJiYgY3VycmVudFByb21wdElucHV0U3RhdGUucHJlZml4LmVuZHNXaXRoKGNvbW1vblByZWZpeCkgJiYgY3VycmVudFByb21wdElucHV0U3RhdGUuc3VmZml4LnN0YXJ0c1dpdGgoY29tcGxldGlvblN1ZmZpeCkpIHtcblx0XHRcdFx0Ly8gTW92ZSByaWdodCB0byB0aGUgZW5kIG9mIHRoZSBjb21wbGV0aW9uXG5cdFx0XHRcdHJlc3VsdFNlcXVlbmNlID0gJ1xceDFiT0MnLnJlcGVhdChjb21wbGV0aW9uVGV4dC5sZW5ndGggLSBjb21tb25QcmVmaXhMZW4pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0U2VxdWVuY2UgPSBbXG5cdFx0XHRcdFx0Ly8gQmFja3NwYWNlIChsZWZ0KSB0byByZW1vdmUgYWxsIGFkZGl0aW9uYWwgaW5wdXRcblx0XHRcdFx0XHQnXFx4N0YnLnJlcGVhdChyZXBsYWNlbWVudFRleHQubGVuZ3RoIC0gY29tbW9uUHJlZml4TGVuKSxcblx0XHRcdFx0XHQvLyBEZWxldGUgKHJpZ2h0KSB0byByZW1vdmUgYW55IGFkZGl0aW9uYWwgdGV4dCBpbiB0aGUgc2FtZSB3b3JkXG5cdFx0XHRcdFx0J1xceDFiWzN+Jy5yZXBlYXQocmlnaHRTaWRlUmVwbGFjZW1lbnRUZXh0Lmxlbmd0aCksXG5cdFx0XHRcdFx0Ly8gV3JpdGUgdGhlIGNvbXBsZXRpb25cblx0XHRcdFx0XHRjb21wbGV0aW9uU3VmZml4LFxuXHRcdFx0XHRcdC8vIFJ1biBvbiBlbnRlciBpZiBuZWVkZWRcblx0XHRcdFx0XHRydW5PbkVudGVyID8gJ1xccicgOiAnJ1xuXHRcdFx0XHRdLmpvaW4oJycpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEZvciBmb2xkZXJzLCBhbGxvdyB0aGUgbmV4dCBjb21wbGV0aW9uIHJlcXVlc3QgdG8gZ2V0IGNvbXBsZXRpb25zIGZvciB0aGF0IGZvbGRlclxuXHRcdGlmIChjb21wbGV0aW9uLmtpbmQgPT09IFRlcm1pbmFsQ29tcGxldGlvbkl0ZW1LaW5kLkZvbGRlcikge1xuXHRcdFx0U3VnZ2VzdEFkZG9uLmxhc3RBY2NlcHRlZENvbXBsZXRpb25UaW1lc3RhbXAgPSAwO1xuXHRcdH1cblxuXHRcdC8vIFNlbmQgdGhlIGNvbXBsZXRpb25cblx0XHR0aGlzLl9vbkFjY2VwdGVkQ29tcGxldGlvbi5maXJlKHJlc3VsdFNlcXVlbmNlKTtcblx0XHR0aGlzLl9zdWdnZXN0VGVsZW1ldHJ5Py5hY2NlcHRDb21wbGV0aW9uKGNvbXBsZXRpb24sIHRoaXMuX21vc3RSZWNlbnRQcm9tcHRJbnB1dFN0YXRlPy52YWx1ZSk7XG5cdFx0dGhpcy5oaWRlU3VnZ2VzdFdpZGdldCh0cnVlKTtcblx0fVxuXG5cdGhpZGVTdWdnZXN0V2lkZ2V0KGNhbmNlbEFueVJlcXVlc3Q6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAoY2FuY2VsQW55UmVxdWVzdCkge1xuXHRcdFx0dGhpcy5fY2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2U/LmNhbmNlbCgpO1xuXHRcdFx0dGhpcy5fY2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHRoaXMuX2N1cnJlbnRQcm9tcHRJbnB1dFN0YXRlID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX2xlYWRpbmdMaW5lQ29udGVudCA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9zdWdnZXN0V2lkZ2V0Py5oaWRlKCk7XG5cdH1cbn1cblxuY2xhc3MgUGVyc2lzdGVkV2lkZ2V0U2l6ZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfa2V5ID0gVGVybWluYWxTdG9yYWdlS2V5cy5UZXJtaW5hbFN1Z2dlc3RTaXplO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZVxuXHQpIHtcblx0fVxuXG5cdHJlc3RvcmUoKTogZG9tLkRpbWVuc2lvbiB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcmF3ID0gdGhpcy5fc3RvcmFnZVNlcnZpY2UuZ2V0KHRoaXMuX2tleSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUpID8/ICcnO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBvYmogPSBKU09OLnBhcnNlKHJhdyk7XG5cdFx0XHRpZiAoZG9tLkRpbWVuc2lvbi5pcyhvYmopKSB7XG5cdFx0XHRcdHJldHVybiBkb20uRGltZW5zaW9uLmxpZnQob2JqKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIHtcblx0XHRcdC8vIGlnbm9yZVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0c3RvcmUoc2l6ZTogZG9tLkRpbWVuc2lvbikge1xuXHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnN0b3JlKHRoaXMuX2tleSwgSlNPTi5zdHJpbmdpZnkoc2l6ZSksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHR9XG5cblx0cmVzZXQoKTogdm9pZCB7XG5cdFx0dGhpcy5fc3RvcmFnZVNlcnZpY2UucmVtb3ZlKHRoaXMuX2tleSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUpO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVQYXRoU2VwYXJhdG9yKHBhdGg6IHN0cmluZywgc2VwOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRpZiAoc2VwID09PSAnLycpIHtcblx0XHRyZXR1cm4gcGF0aC5yZXBsYWNlQWxsKCdcXFxcJywgJy8nKTtcblx0fVxuXHRyZXR1cm4gcGF0aC5yZXBsYWNlQWxsKCcvJywgJ1xcXFwnKTtcbn1cblxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFNQSxZQUFZLFNBQVM7QUFDckIsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxvQkFBb0IsWUFBWSx5QkFBeUI7QUFDbEUsU0FB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
