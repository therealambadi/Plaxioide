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
import "./media/chatStatus.css";
import { safeIntl } from "../../../../base/common/date.js";
import { Disposable, DisposableStore, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { language } from "../../../../base/common/platform.js";
import { localize } from "../../../../nls.js";
import { IStatusbarService, ShowTooltipCommand, StatusbarAlignment } from "../../../services/statusbar/browser/statusbar.js";
import { $, addDisposableListener, append, clearNode, EventHelper, EventType } from "../../../../base/browser/dom.js";
import { ChatEntitlement, ChatSentiment, IChatEntitlementService } from "../common/chatEntitlementService.js";
import { defaultButtonStyles, defaultCheckboxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { Checkbox } from "../../../../base/browser/ui/toggle/toggle.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { contrastBorder, inputValidationErrorBorder, inputValidationInfoBorder, inputValidationWarningBorder, registerColor, transparent } from "../../../../platform/theme/common/colorRegistry.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
import { Color } from "../../../../base/common/color.js";
import { Gesture, EventType as TouchEventType } from "../../../../base/browser/touch.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import product from "../../../../platform/product/common/product.js";
import { isObject } from "../../../../base/common/types.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Button } from "../../../../base/browser/ui/button/button.js";
import { renderLabelWithIcons } from "../../../../base/browser/ui/iconLabel/iconLabels.js";
import { parseLinkedText } from "../../../../base/common/linkedText.js";
import { Link } from "../../../../platform/opener/browser/link.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IChatStatusItemService } from "./chatStatusItemService.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { EditorResourceAccessor, SideBySideEditor } from "../../../common/editor.js";
import { getCodeEditor } from "../../../../editor/browser/editorBrowser.js";
const gaugeBackground = registerColor("gauge.background", {
  dark: inputValidationInfoBorder,
  light: inputValidationInfoBorder,
  hcDark: contrastBorder,
  hcLight: contrastBorder
}, localize("gaugeBackground", "Gauge background color."));
registerColor("gauge.foreground", {
  dark: transparent(gaugeBackground, 0.3),
  light: transparent(gaugeBackground, 0.3),
  hcDark: Color.white,
  hcLight: Color.white
}, localize("gaugeForeground", "Gauge foreground color."));
registerColor("gauge.border", {
  dark: null,
  light: null,
  hcDark: contrastBorder,
  hcLight: contrastBorder
}, localize("gaugeBorder", "Gauge border color."));
const gaugeWarningBackground = registerColor("gauge.warningBackground", {
  dark: inputValidationWarningBorder,
  light: inputValidationWarningBorder,
  hcDark: contrastBorder,
  hcLight: contrastBorder
}, localize("gaugeWarningBackground", "Gauge warning background color."));
registerColor("gauge.warningForeground", {
  dark: transparent(gaugeWarningBackground, 0.3),
  light: transparent(gaugeWarningBackground, 0.3),
  hcDark: Color.white,
  hcLight: Color.white
}, localize("gaugeWarningForeground", "Gauge warning foreground color."));
const gaugeErrorBackground = registerColor("gauge.errorBackground", {
  dark: inputValidationErrorBorder,
  light: inputValidationErrorBorder,
  hcDark: contrastBorder,
  hcLight: contrastBorder
}, localize("gaugeErrorBackground", "Gauge error background color."));
registerColor("gauge.errorForeground", {
  dark: transparent(gaugeErrorBackground, 0.3),
  light: transparent(gaugeErrorBackground, 0.3),
  hcDark: Color.white,
  hcLight: Color.white
}, localize("gaugeErrorForeground", "Gauge error foreground color."));
const defaultChat = {
  extensionId: product.defaultChatAgent?.extensionId ?? "",
  completionsEnablementSetting: product.defaultChatAgent?.completionsEnablementSetting ?? "",
  nextEditSuggestionsSetting: product.defaultChatAgent?.nextEditSuggestionsSetting ?? ""
};
let ChatStatusBarEntry = class extends Disposable {
  constructor(chatEntitlementService, instantiationService, statusbarService, editorService, configurationService) {
    super();
    this.chatEntitlementService = chatEntitlementService;
    this.instantiationService = instantiationService;
    this.statusbarService = statusbarService;
    this.editorService = editorService;
    this.configurationService = configurationService;
    this.entry = void 0;
    this.dashboard = new Lazy(() => this.instantiationService.createInstance(ChatStatusDashboard));
    this.activeCodeEditorListener = this._register(new MutableDisposable());
    this.create();
    this.registerListeners();
  }
  async create() {
    const hidden = this.chatEntitlementService.sentiment === ChatSentiment.Disabled;
    if (!hidden) {
      this.entry ||= this.statusbarService.addEntry(this.getEntryProps(), "chat.statusBarEntry", StatusbarAlignment.RIGHT, { location: { id: "status.editor.mode", priority: 100.1 }, alignment: StatusbarAlignment.RIGHT });
      const completionsStatusId = `${defaultChat.extensionId}.status`;
      this.statusbarService.updateEntryVisibility(completionsStatusId, false);
      this.statusbarService.overrideEntry(completionsStatusId, { name: localize("codeCompletionsStatus", "Copilot Code Completions"), text: localize("codeCompletionsStatusText", "$(copilot) Completions") });
    } else {
      this.entry?.dispose();
      this.entry = void 0;
    }
  }
  registerListeners() {
    this._register(this.chatEntitlementService.onDidChangeQuotaExceeded(() => this.entry?.update(this.getEntryProps())));
    this._register(this.chatEntitlementService.onDidChangeSentiment(() => this.entry?.update(this.getEntryProps())));
    this._register(this.chatEntitlementService.onDidChangeEntitlement(() => this.entry?.update(this.getEntryProps())));
    this._register(this.editorService.onDidActiveEditorChange(() => this.onDidActiveEditorChange()));
    this._register(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(defaultChat.completionsEnablementSetting)) {
        this.entry?.update(this.getEntryProps());
      }
    }));
  }
  onDidActiveEditorChange() {
    this.entry?.update(this.getEntryProps());
    this.activeCodeEditorListener.clear();
    const activeCodeEditor = getCodeEditor(this.editorService.activeTextEditorControl);
    if (activeCodeEditor) {
      this.activeCodeEditorListener.value = activeCodeEditor.onDidChangeModelLanguage(() => {
        this.entry?.update(this.getEntryProps());
      });
    }
  }
  getEntryProps() {
    let text = "$(copilot)";
    let ariaLabel = localize("chatStatus", "Copilot Status");
    let kind;
    if (!isNewUser(this.chatEntitlementService)) {
      const { chatQuotaExceeded, completionsQuotaExceeded } = this.chatEntitlementService.quotas;
      if (this.chatEntitlementService.entitlement === ChatEntitlement.Unknown) {
        const signedOutWarning = localize("notSignedIntoCopilot", "Signed out");
        text = `$(copilot-not-connected) ${signedOutWarning}`;
        ariaLabel = signedOutWarning;
        kind = "prominent";
      } else if (chatQuotaExceeded || completionsQuotaExceeded) {
        let quotaWarning;
        if (chatQuotaExceeded && !completionsQuotaExceeded) {
          quotaWarning = localize("chatQuotaExceededStatus", "Chat limit reached");
        } else if (completionsQuotaExceeded && !chatQuotaExceeded) {
          quotaWarning = localize("completionsQuotaExceededStatus", "Completions limit reached");
        } else {
          quotaWarning = localize("chatAndCompletionsQuotaExceededStatus", "Limit reached");
        }
        text = `$(copilot-warning) ${quotaWarning}`;
        ariaLabel = quotaWarning;
        kind = "prominent";
      } else if (this.editorService.activeTextEditorLanguageId && !isCompletionsEnabled(this.configurationService, this.editorService.activeTextEditorLanguageId)) {
        text = `$(copilot-not-connected)`;
        ariaLabel = localize("completionsDisabledStatus", "Code Completions Disabled");
      }
    }
    return {
      name: localize("chatStatus", "Copilot Status"),
      text,
      ariaLabel,
      command: ShowTooltipCommand,
      showInAllWindows: true,
      kind,
      tooltip: { element: (token) => this.dashboard.value.show(token) }
    };
  }
  dispose() {
    super.dispose();
    this.entry?.dispose();
    this.entry = void 0;
  }
};
ChatStatusBarEntry.ID = "workbench.contrib.chatStatusBarEntry";
ChatStatusBarEntry = __decorateClass([
  __decorateParam(0, IChatEntitlementService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IStatusbarService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IConfigurationService)
], ChatStatusBarEntry);
function isNewUser(chatEntitlementService) {
  return chatEntitlementService.sentiment !== ChatSentiment.Installed || // copilot not installed
  chatEntitlementService.entitlement === ChatEntitlement.Available;
}
function canUseCopilot(chatEntitlementService) {
  const newUser = isNewUser(chatEntitlementService);
  const signedOut = chatEntitlementService.entitlement === ChatEntitlement.Unknown;
  const allQuotaReached = chatEntitlementService.quotas.chatQuotaExceeded && chatEntitlementService.quotas.completionsQuotaExceeded;
  return !newUser && !signedOut && !allQuotaReached;
}
function isCompletionsEnabled(configurationService, modeId = "*") {
  const result = configurationService.getValue(defaultChat.completionsEnablementSetting);
  if (!isObject(result)) {
    return false;
  }
  if (typeof result[modeId] !== "undefined") {
    return Boolean(result[modeId]);
  }
  return Boolean(result["*"]);
}
let ChatStatusDashboard = class extends Disposable {
  constructor(chatEntitlementService, chatStatusItemService, commandService, configurationService, editorService, hoverService, languageService, openerService, telemetryService, textResourceConfigurationService) {
    super();
    this.chatEntitlementService = chatEntitlementService;
    this.chatStatusItemService = chatStatusItemService;
    this.commandService = commandService;
    this.configurationService = configurationService;
    this.editorService = editorService;
    this.hoverService = hoverService;
    this.languageService = languageService;
    this.openerService = openerService;
    this.telemetryService = telemetryService;
    this.textResourceConfigurationService = textResourceConfigurationService;
    this.element = $("div.chat-status-bar-entry-tooltip");
    this.dateFormatter = new Lazy(() => safeIntl.DateTimeFormat(language, { year: "numeric", month: "long", day: "numeric" }));
    this.entryDisposables = this._register(new MutableDisposable());
  }
  show(token) {
    clearNode(this.element);
    const disposables = this.entryDisposables.value = new DisposableStore();
    disposables.add(token.onCancellationRequested(() => disposables.dispose()));
    let needsSeparator = false;
    const addSeparator = (label) => {
      if (needsSeparator) {
        this.element.appendChild($("hr"));
        needsSeparator = false;
      }
      if (label) {
        this.element.appendChild($("div.header", void 0, label));
      }
      needsSeparator = true;
    };
    if (this.chatEntitlementService.entitlement === ChatEntitlement.Limited) {
      const { chatTotal, chatRemaining, completionsTotal, completionsRemaining, quotaResetDate, chatQuotaExceeded, completionsQuotaExceeded } = this.chatEntitlementService.quotas;
      addSeparator(localize("usageTitle", "Copilot Free Plan Usage"));
      const chatQuotaIndicator = this.createQuotaIndicator(this.element, chatTotal, chatRemaining, localize("chatsLabel", "Chat messages"));
      const completionsQuotaIndicator = this.createQuotaIndicator(this.element, completionsTotal, completionsRemaining, localize("completionsLabel", "Code completions"));
      this.element.appendChild($("div.description", void 0, localize("limitQuota", "Limits will reset on {0}.", this.dateFormatter.value.format(quotaResetDate))));
      if (chatQuotaExceeded || completionsQuotaExceeded) {
        const upgradePlanButton = disposables.add(new Button(this.element, {
          ...defaultButtonStyles,
          secondary: canUseCopilot(this.chatEntitlementService)
          /* use secondary color when copilot can still be used */
        }));
        upgradePlanButton.label = localize("upgradeToCopilotPro", "Upgrade to Copilot Pro");
        disposables.add(upgradePlanButton.onDidClick(() => this.runCommandAndClose("workbench.action.chat.upgradePlan")));
      }
      (async () => {
        await this.chatEntitlementService.update(token);
        if (token.isCancellationRequested) {
          return;
        }
        const { chatTotal: chatTotal2, chatRemaining: chatRemaining2, completionsTotal: completionsTotal2, completionsRemaining: completionsRemaining2 } = this.chatEntitlementService.quotas;
        chatQuotaIndicator(chatTotal2, chatRemaining2);
        completionsQuotaIndicator(completionsTotal2, completionsRemaining2);
      })();
    }
    {
      for (const item of this.chatStatusItemService.getEntries()) {
        addSeparator(void 0);
        const chatItemDisposables = disposables.add(new MutableDisposable());
        let rendered = this.renderContributedChatStatusItem(item);
        chatItemDisposables.value = rendered.disposables;
        this.element.appendChild(rendered.element);
        disposables.add(this.chatStatusItemService.onDidChange((e) => {
          if (e.entry.id === item.id) {
            const oldEl = rendered.element;
            rendered = this.renderContributedChatStatusItem(e.entry);
            chatItemDisposables.value = rendered.disposables;
            oldEl.replaceWith(rendered.element);
          }
        }));
      }
    }
    {
      addSeparator(localize("settingsTitle", "Settings"));
      this.createSettings(this.element, disposables);
    }
    {
      const newUser = isNewUser(this.chatEntitlementService);
      const signedOut = this.chatEntitlementService.entitlement === ChatEntitlement.Unknown;
      if (newUser || signedOut) {
        addSeparator(void 0);
        this.element.appendChild($("div.description", void 0, newUser ? localize("activateDescription", "Set up Copilot to use AI features.") : localize("signInDescription", "Sign in to use Copilot AI features.")));
        const button = disposables.add(new Button(this.element, { ...defaultButtonStyles }));
        button.label = newUser ? localize("activateCopilotButton", "Set up Copilot") : localize("signInToUseCopilotButton", "Sign in to use Copilot");
        disposables.add(button.onDidClick(() => this.runCommandAndClose(newUser ? "workbench.action.chat.triggerSetup" : () => this.chatEntitlementService.requests?.value.signIn())));
      }
    }
    return this.element;
  }
  renderContributedChatStatusItem(item) {
    const disposables = new DisposableStore();
    const entryEl = $("div.contribution");
    entryEl.appendChild($("div.header", void 0, item.label));
    const bodyEl = entryEl.appendChild($("div.body"));
    const descriptionEl = bodyEl.appendChild($("span.description"));
    this.renderTextPlus(descriptionEl, item.description, disposables);
    if (item.detail) {
      const itemElement = bodyEl.appendChild($("div.detail-item"));
      this.renderTextPlus(itemElement, item.detail, disposables);
    }
    return { element: entryEl, disposables };
  }
  renderTextPlus(target, text, store) {
    for (const node of parseLinkedText(text).nodes) {
      if (typeof node === "string") {
        const parts = renderLabelWithIcons(node);
        target.append(...parts);
      } else {
        store.add(new Link(target, node, void 0, this.hoverService, this.openerService));
      }
    }
  }
  runCommandAndClose(commandOrFn) {
    if (typeof commandOrFn === "function") {
      commandOrFn();
    } else {
      this.telemetryService.publicLog2("workbenchActionExecuted", { id: commandOrFn, from: "chat-status" });
      this.commandService.executeCommand(commandOrFn);
    }
    this.hoverService.hideHover(true);
  }
  createQuotaIndicator(container, total, remaining, label) {
    const quotaText = $("span");
    const quotaBit = $("div.quota-bit");
    const quotaIndicator = container.appendChild($(
      "div.quota-indicator",
      void 0,
      $(
        "div.quota-label",
        void 0,
        $("span", void 0, label),
        quotaText
      ),
      $(
        "div.quota-bar",
        void 0,
        quotaBit
      )
    ));
    const update = (total2, remaining2) => {
      quotaIndicator.classList.remove("error");
      quotaIndicator.classList.remove("warning");
      if (typeof total2 === "number" && typeof remaining2 === "number") {
        let usedPercentage = Math.round((total2 - remaining2) / total2 * 100);
        if (total2 !== remaining2 && usedPercentage === 0) {
          usedPercentage = 1;
        }
        quotaText.textContent = localize("quotaDisplay", "{0}%", usedPercentage);
        quotaBit.style.width = `${usedPercentage}%`;
        if (usedPercentage >= 90) {
          quotaIndicator.classList.add("error");
        } else if (usedPercentage >= 75) {
          quotaIndicator.classList.add("warning");
        }
      }
    };
    update(total, remaining);
    return update;
  }
  createSettings(container, disposables) {
    const modeId = this.editorService.activeTextEditorLanguageId;
    const settings = container.appendChild($("div.settings"));
    {
      const globalSetting = append(settings, $("div.setting"));
      this.createCodeCompletionsSetting(globalSetting, localize("settings.codeCompletions", "Code Completions (all files)"), "*", disposables);
      if (modeId) {
        const languageSetting = append(settings, $("div.setting"));
        this.createCodeCompletionsSetting(languageSetting, localize("settings.codeCompletionsLanguage", "Code Completions ({0})", this.languageService.getLanguageName(modeId) ?? modeId), modeId, disposables);
      }
    }
    {
      const setting = append(settings, $("div.setting"));
      this.createNextEditSuggestionsSetting(setting, localize("settings.nextEditSuggestions", "Next Edit Suggestions"), modeId, this.getCompletionsSettingAccessor(modeId), disposables);
    }
    return settings;
  }
  createSetting(container, settingId, label, accessor, disposables) {
    const checkbox = disposables.add(new Checkbox(label, Boolean(accessor.readSetting()), defaultCheckboxStyles));
    container.appendChild(checkbox.domNode);
    const settingLabel = append(container, $("span.setting-label", void 0, label));
    disposables.add(Gesture.addTarget(settingLabel));
    [EventType.CLICK, TouchEventType.Tap].forEach((eventType) => {
      disposables.add(addDisposableListener(settingLabel, eventType, (e) => {
        if (checkbox?.enabled) {
          EventHelper.stop(e, true);
          checkbox.checked = !checkbox.checked;
          accessor.writeSetting(checkbox.checked);
          checkbox.focus();
        }
      }));
    });
    disposables.add(checkbox.onChange(() => {
      accessor.writeSetting(checkbox.checked);
    }));
    disposables.add(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(settingId)) {
        checkbox.checked = Boolean(accessor.readSetting());
      }
    }));
    if (!canUseCopilot(this.chatEntitlementService)) {
      container.classList.add("disabled");
      checkbox.disable();
    }
    return checkbox;
  }
  createCodeCompletionsSetting(container, label, modeId, disposables) {
    this.createSetting(container, defaultChat.completionsEnablementSetting, label, this.getCompletionsSettingAccessor(modeId), disposables);
  }
  getCompletionsSettingAccessor(modeId = "*") {
    const settingId = defaultChat.completionsEnablementSetting;
    return {
      readSetting: () => isCompletionsEnabled(this.configurationService, modeId),
      writeSetting: (value) => {
        let result = this.configurationService.getValue(settingId);
        if (!isObject(result)) {
          result = /* @__PURE__ */ Object.create(null);
        }
        return this.configurationService.updateValue(settingId, { ...result, [modeId]: value });
      }
    };
  }
  createNextEditSuggestionsSetting(container, label, modeId, completionsSettingAccessor, disposables) {
    const nesSettingId = defaultChat.nextEditSuggestionsSetting;
    const completionsSettingId = defaultChat.completionsEnablementSetting;
    const resource = EditorResourceAccessor.getOriginalUri(this.editorService.activeEditor, { supportSideBySide: SideBySideEditor.PRIMARY });
    const checkbox = this.createSetting(container, nesSettingId, label, {
      readSetting: () => this.textResourceConfigurationService.getValue(resource, nesSettingId),
      writeSetting: (value) => this.textResourceConfigurationService.updateValue(resource, nesSettingId, value)
    }, disposables);
    if (!completionsSettingAccessor.readSetting()) {
      container.classList.add("disabled");
      checkbox.disable();
    }
    disposables.add(this.configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(completionsSettingId)) {
        if (completionsSettingAccessor.readSetting() && canUseCopilot(this.chatEntitlementService)) {
          checkbox.enable();
          container.classList.remove("disabled");
        } else {
          checkbox.disable();
          container.classList.add("disabled");
        }
      }
    }));
  }
};
ChatStatusDashboard = __decorateClass([
  __decorateParam(0, IChatEntitlementService),
  __decorateParam(1, IChatStatusItemService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, IConfigurationService),
  __decorateParam(4, IEditorService),
  __decorateParam(5, IHoverService),
  __decorateParam(6, ILanguageService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, ITelemetryService),
  __decorateParam(9, ITextResourceConfigurationService)
], ChatStatusDashboard);
export {
  ChatStatusBarEntry
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvY2hhdFN0YXR1cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9tZWRpYS9jaGF0U3RhdHVzLmNzcyc7XG5pbXBvcnQgeyBzYWZlSW50bCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RhdGUuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBNdXRhYmxlRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBsYW5ndWFnZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJU3RhdHVzYmFyRW50cnksIElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yLCBJU3RhdHVzYmFyU2VydmljZSwgU2hvd1Rvb2x0aXBDb21tYW5kLCBTdGF0dXNiYXJBbGlnbm1lbnQsIFN0YXR1c2JhckVudHJ5S2luZCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3N0YXR1c2Jhci9icm93c2VyL3N0YXR1c2Jhci5qcyc7XG5pbXBvcnQgeyAkLCBhZGREaXNwb3NhYmxlTGlzdGVuZXIsIGFwcGVuZCwgY2xlYXJOb2RlLCBFdmVudEhlbHBlciwgRXZlbnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBDaGF0RW50aXRsZW1lbnQsIENoYXRFbnRpdGxlbWVudFNlcnZpY2UsIENoYXRTZW50aW1lbnQsIElDaGF0RW50aXRsZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRFbnRpdGxlbWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgZGVmYXVsdEJ1dHRvblN0eWxlcywgZGVmYXVsdENoZWNrYm94U3R5bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvYnJvd3Nlci9kZWZhdWx0U3R5bGVzLmpzJztcbmltcG9ydCB7IENoZWNrYm94IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RvZ2dsZS90b2dnbGUuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgTGF6eSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xhenkuanMnO1xuaW1wb3J0IHsgY29udHJhc3RCb3JkZXIsIGlucHV0VmFsaWRhdGlvbkVycm9yQm9yZGVyLCBpbnB1dFZhbGlkYXRpb25JbmZvQm9yZGVyLCBpbnB1dFZhbGlkYXRpb25XYXJuaW5nQm9yZGVyLCByZWdpc3RlckNvbG9yLCB0cmFuc3BhcmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IENvbG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29sb3IuanMnO1xuaW1wb3J0IHsgR2VzdHVyZSwgRXZlbnRUeXBlIGFzIFRvdWNoRXZlbnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3RvdWNoLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCBwcm9kdWN0IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3QuanMnO1xuaW1wb3J0IHsgaXNPYmplY3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBCdXR0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYnV0dG9uL2J1dHRvbi5qcyc7XG5pbXBvcnQgeyByZW5kZXJMYWJlbFdpdGhJY29ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9pY29uTGFiZWwvaWNvbkxhYmVscy5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50LCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBwYXJzZUxpbmtlZFRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saW5rZWRUZXh0LmpzJztcbmltcG9ydCB7IExpbmsgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvYnJvd3Nlci9saW5rLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBJQ2hhdFN0YXR1c0l0ZW1TZXJ2aWNlLCBDaGF0U3RhdHVzRW50cnkgfSBmcm9tICcuL2NoYXRTdGF0dXNJdGVtU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3RleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgRWRpdG9yUmVzb3VyY2VBY2Nlc3NvciwgU2lkZUJ5U2lkZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgZ2V0Q29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuXG5jb25zdCBnYXVnZUJhY2tncm91bmQgPSByZWdpc3RlckNvbG9yKCdnYXVnZS5iYWNrZ3JvdW5kJywge1xuXHRkYXJrOiBpbnB1dFZhbGlkYXRpb25JbmZvQm9yZGVyLFxuXHRsaWdodDogaW5wdXRWYWxpZGF0aW9uSW5mb0JvcmRlcixcblx0aGNEYXJrOiBjb250cmFzdEJvcmRlcixcblx0aGNMaWdodDogY29udHJhc3RCb3JkZXJcbn0sIGxvY2FsaXplKCdnYXVnZUJhY2tncm91bmQnLCBcIkdhdWdlIGJhY2tncm91bmQgY29sb3IuXCIpKTtcblxucmVnaXN0ZXJDb2xvcignZ2F1Z2UuZm9yZWdyb3VuZCcsIHtcblx0ZGFyazogdHJhbnNwYXJlbnQoZ2F1Z2VCYWNrZ3JvdW5kLCAwLjMpLFxuXHRsaWdodDogdHJhbnNwYXJlbnQoZ2F1Z2VCYWNrZ3JvdW5kLCAwLjMpLFxuXHRoY0Rhcms6IENvbG9yLndoaXRlLFxuXHRoY0xpZ2h0OiBDb2xvci53aGl0ZVxufSwgbG9jYWxpemUoJ2dhdWdlRm9yZWdyb3VuZCcsIFwiR2F1Z2UgZm9yZWdyb3VuZCBjb2xvci5cIikpO1xuXG5yZWdpc3RlckNvbG9yKCdnYXVnZS5ib3JkZXInLCB7XG5cdGRhcms6IG51bGwsXG5cdGxpZ2h0OiBudWxsLFxuXHRoY0Rhcms6IGNvbnRyYXN0Qm9yZGVyLFxuXHRoY0xpZ2h0OiBjb250cmFzdEJvcmRlclxufSwgbG9jYWxpemUoJ2dhdWdlQm9yZGVyJywgXCJHYXVnZSBib3JkZXIgY29sb3IuXCIpKTtcblxuY29uc3QgZ2F1Z2VXYXJuaW5nQmFja2dyb3VuZCA9IHJlZ2lzdGVyQ29sb3IoJ2dhdWdlLndhcm5pbmdCYWNrZ3JvdW5kJywge1xuXHRkYXJrOiBpbnB1dFZhbGlkYXRpb25XYXJuaW5nQm9yZGVyLFxuXHRsaWdodDogaW5wdXRWYWxpZGF0aW9uV2FybmluZ0JvcmRlcixcblx0aGNEYXJrOiBjb250cmFzdEJvcmRlcixcblx0aGNMaWdodDogY29udHJhc3RCb3JkZXJcbn0sIGxvY2FsaXplKCdnYXVnZVdhcm5pbmdCYWNrZ3JvdW5kJywgXCJHYXVnZSB3YXJuaW5nIGJhY2tncm91bmQgY29sb3IuXCIpKTtcblxucmVnaXN0ZXJDb2xvcignZ2F1Z2Uud2FybmluZ0ZvcmVncm91bmQnLCB7XG5cdGRhcms6IHRyYW5zcGFyZW50KGdhdWdlV2FybmluZ0JhY2tncm91bmQsIDAuMyksXG5cdGxpZ2h0OiB0cmFuc3BhcmVudChnYXVnZVdhcm5pbmdCYWNrZ3JvdW5kLCAwLjMpLFxuXHRoY0Rhcms6IENvbG9yLndoaXRlLFxuXHRoY0xpZ2h0OiBDb2xvci53aGl0ZVxufSwgbG9jYWxpemUoJ2dhdWdlV2FybmluZ0ZvcmVncm91bmQnLCBcIkdhdWdlIHdhcm5pbmcgZm9yZWdyb3VuZCBjb2xvci5cIikpO1xuXG5jb25zdCBnYXVnZUVycm9yQmFja2dyb3VuZCA9IHJlZ2lzdGVyQ29sb3IoJ2dhdWdlLmVycm9yQmFja2dyb3VuZCcsIHtcblx0ZGFyazogaW5wdXRWYWxpZGF0aW9uRXJyb3JCb3JkZXIsXG5cdGxpZ2h0OiBpbnB1dFZhbGlkYXRpb25FcnJvckJvcmRlcixcblx0aGNEYXJrOiBjb250cmFzdEJvcmRlcixcblx0aGNMaWdodDogY29udHJhc3RCb3JkZXJcbn0sIGxvY2FsaXplKCdnYXVnZUVycm9yQmFja2dyb3VuZCcsIFwiR2F1Z2UgZXJyb3IgYmFja2dyb3VuZCBjb2xvci5cIikpO1xuXG5yZWdpc3RlckNvbG9yKCdnYXVnZS5lcnJvckZvcmVncm91bmQnLCB7XG5cdGRhcms6IHRyYW5zcGFyZW50KGdhdWdlRXJyb3JCYWNrZ3JvdW5kLCAwLjMpLFxuXHRsaWdodDogdHJhbnNwYXJlbnQoZ2F1Z2VFcnJvckJhY2tncm91bmQsIDAuMyksXG5cdGhjRGFyazogQ29sb3Iud2hpdGUsXG5cdGhjTGlnaHQ6IENvbG9yLndoaXRlXG59LCBsb2NhbGl6ZSgnZ2F1Z2VFcnJvckZvcmVncm91bmQnLCBcIkdhdWdlIGVycm9yIGZvcmVncm91bmQgY29sb3IuXCIpKTtcblxuLy8jZW5kcmVnaW9uXG5cbmNvbnN0IGRlZmF1bHRDaGF0ID0ge1xuXHRleHRlbnNpb25JZDogcHJvZHVjdC5kZWZhdWx0Q2hhdEFnZW50Py5leHRlbnNpb25JZCA/PyAnJyxcblx0Y29tcGxldGlvbnNFbmFibGVtZW50U2V0dGluZzogcHJvZHVjdC5kZWZhdWx0Q2hhdEFnZW50Py5jb21wbGV0aW9uc0VuYWJsZW1lbnRTZXR0aW5nID8/ICcnLFxuXHRuZXh0RWRpdFN1Z2dlc3Rpb25zU2V0dGluZzogcHJvZHVjdC5kZWZhdWx0Q2hhdEFnZW50Py5uZXh0RWRpdFN1Z2dlc3Rpb25zU2V0dGluZyA/PyAnJ1xufTtcblxuZXhwb3J0IGNsYXNzIENoYXRTdGF0dXNCYXJFbnRyeSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIuY2hhdFN0YXR1c0JhckVudHJ5JztcblxuXHRwcml2YXRlIGVudHJ5OiBJU3RhdHVzYmFyRW50cnlBY2Nlc3NvciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIGRhc2hib2FyZCA9IG5ldyBMYXp5PENoYXRTdGF0dXNEYXNoYm9hcmQ+KCgpID0+IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdFN0YXR1c0Rhc2hib2FyZCkpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgYWN0aXZlQ29kZUVkaXRvckxpc3RlbmVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ2hhdEVudGl0bGVtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNoYXRFbnRpdGxlbWVudFNlcnZpY2U6IENoYXRFbnRpdGxlbWVudFNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElTdGF0dXNiYXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RhdHVzYmFyU2VydmljZTogSVN0YXR1c2JhclNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmNyZWF0ZSgpO1xuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgY3JlYXRlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGhpZGRlbiA9IHRoaXMuY2hhdEVudGl0bGVtZW50U2VydmljZS5zZW50aW1lbnQgPT09IENoYXRTZW50aW1lbnQuRGlzYWJsZWQ7XG5cblx0XHRpZiAoIWhpZGRlbikge1xuXHRcdFx0dGhpcy5lbnRyeSB8fD0gdGhpcy5zdGF0dXNiYXJTZXJ2aWNlLmFkZEVudHJ5KHRoaXMuZ2V0RW50cnlQcm9wcygpLCAnY2hhdC5zdGF0dXNCYXJFbnRyeScsIFN0YXR1c2JhckFsaWdubWVudC5SSUdIVCwgeyBsb2NhdGlvbjogeyBpZDogJ3N0YXR1cy5lZGl0b3IubW9kZScsIHByaW9yaXR5OiAxMDAuMSB9LCBhbGlnbm1lbnQ6IFN0YXR1c2JhckFsaWdubWVudC5SSUdIVCB9KTtcblxuXHRcdFx0Ly8gVE9ET0BicGFzZXJvOiByZW1vdmUgdGhpcyBldmVudHVhbGx5XG5cdFx0XHRjb25zdCBjb21wbGV0aW9uc1N0YXR1c0lkID0gYCR7ZGVmYXVsdENoYXQuZXh0ZW5zaW9uSWR9LnN0YXR1c2A7XG5cdFx0XHR0aGlzLnN0YXR1c2JhclNlcnZpY2UudXBkYXRlRW50cnlWaXNpYmlsaXR5KGNvbXBsZXRpb25zU3RhdHVzSWQsIGZhbHNlKTtcblx0XHRcdHRoaXMuc3RhdHVzYmFyU2VydmljZS5vdmVycmlkZUVudHJ5KGNvbXBsZXRpb25zU3RhdHVzSWQsIHsgbmFtZTogbG9jYWxpemUoJ2NvZGVDb21wbGV0aW9uc1N0YXR1cycsIFwiQ29waWxvdCBDb2RlIENvbXBsZXRpb25zXCIpLCB0ZXh0OiBsb2NhbGl6ZSgnY29kZUNvbXBsZXRpb25zU3RhdHVzVGV4dCcsIFwiJChjb3BpbG90KSBDb21wbGV0aW9uc1wiKSB9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5lbnRyeT8uZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5lbnRyeSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTGlzdGVuZXJzKCk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY2hhdEVudGl0bGVtZW50U2VydmljZS5vbkRpZENoYW5nZVF1b3RhRXhjZWVkZWQoKCkgPT4gdGhpcy5lbnRyeT8udXBkYXRlKHRoaXMuZ2V0RW50cnlQcm9wcygpKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY2hhdEVudGl0bGVtZW50U2VydmljZS5vbkRpZENoYW5nZVNlbnRpbWVudCgoKSA9PiB0aGlzLmVudHJ5Py51cGRhdGUodGhpcy5nZXRFbnRyeVByb3BzKCkpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jaGF0RW50aXRsZW1lbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlRW50aXRsZW1lbnQoKCkgPT4gdGhpcy5lbnRyeT8udXBkYXRlKHRoaXMuZ2V0RW50cnlQcm9wcygpKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5lZGl0b3JTZXJ2aWNlLm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlKCgpID0+IHRoaXMub25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UoKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihkZWZhdWx0Q2hhdC5jb21wbGV0aW9uc0VuYWJsZW1lbnRTZXR0aW5nKSkge1xuXHRcdFx0XHR0aGlzLmVudHJ5Py51cGRhdGUodGhpcy5nZXRFbnRyeVByb3BzKCkpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgb25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UoKTogdm9pZCB7XG5cdFx0dGhpcy5lbnRyeT8udXBkYXRlKHRoaXMuZ2V0RW50cnlQcm9wcygpKTtcblxuXHRcdHRoaXMuYWN0aXZlQ29kZUVkaXRvckxpc3RlbmVyLmNsZWFyKCk7XG5cblx0XHQvLyBMaXN0ZW4gdG8gbGFuZ3VhZ2UgY2hhbmdlcyBpbiB0aGUgYWN0aXZlIGNvZGUgZWRpdG9yXG5cdFx0Y29uc3QgYWN0aXZlQ29kZUVkaXRvciA9IGdldENvZGVFZGl0b3IodGhpcy5lZGl0b3JTZXJ2aWNlLmFjdGl2ZVRleHRFZGl0b3JDb250cm9sKTtcblx0XHRpZiAoYWN0aXZlQ29kZUVkaXRvcikge1xuXHRcdFx0dGhpcy5hY3RpdmVDb2RlRWRpdG9yTGlzdGVuZXIudmFsdWUgPSBhY3RpdmVDb2RlRWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxMYW5ndWFnZSgoKSA9PiB7XG5cdFx0XHRcdHRoaXMuZW50cnk/LnVwZGF0ZSh0aGlzLmdldEVudHJ5UHJvcHMoKSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldEVudHJ5UHJvcHMoKTogSVN0YXR1c2JhckVudHJ5IHtcblx0XHRsZXQgdGV4dCA9ICckKGNvcGlsb3QpJztcblx0XHRsZXQgYXJpYUxhYmVsID0gbG9jYWxpemUoJ2NoYXRTdGF0dXMnLCBcIkNvcGlsb3QgU3RhdHVzXCIpO1xuXHRcdGxldCBraW5kOiBTdGF0dXNiYXJFbnRyeUtpbmQgfCB1bmRlZmluZWQ7XG5cblx0XHRpZiAoIWlzTmV3VXNlcih0aGlzLmNoYXRFbnRpdGxlbWVudFNlcnZpY2UpKSB7XG5cdFx0XHRjb25zdCB7IGNoYXRRdW90YUV4Y2VlZGVkLCBjb21wbGV0aW9uc1F1b3RhRXhjZWVkZWQgfSA9IHRoaXMuY2hhdEVudGl0bGVtZW50U2VydmljZS5xdW90YXM7XG5cblx0XHRcdC8vIFNpZ25lZCBvdXRcblx0XHRcdGlmICh0aGlzLmNoYXRFbnRpdGxlbWVudFNlcnZpY2UuZW50aXRsZW1lbnQgPT09IENoYXRFbnRpdGxlbWVudC5Vbmtub3duKSB7XG5cdFx0XHRcdGNvbnN0IHNpZ25lZE91dFdhcm5pbmcgPSBsb2NhbGl6ZSgnbm90U2lnbmVkSW50b0NvcGlsb3QnLCBcIlNpZ25lZCBvdXRcIik7XG5cblx0XHRcdFx0dGV4dCA9IGAkKGNvcGlsb3Qtbm90LWNvbm5lY3RlZCkgJHtzaWduZWRPdXRXYXJuaW5nfWA7XG5cdFx0XHRcdGFyaWFMYWJlbCA9IHNpZ25lZE91dFdhcm5pbmc7XG5cdFx0XHRcdGtpbmQgPSAncHJvbWluZW50Jztcblx0XHRcdH1cblxuXHRcdFx0Ly8gUXVvdGEgRXhjZWVkZWRcblx0XHRcdGVsc2UgaWYgKGNoYXRRdW90YUV4Y2VlZGVkIHx8IGNvbXBsZXRpb25zUXVvdGFFeGNlZWRlZCkge1xuXHRcdFx0XHRsZXQgcXVvdGFXYXJuaW5nOiBzdHJpbmc7XG5cdFx0XHRcdGlmIChjaGF0UXVvdGFFeGNlZWRlZCAmJiAhY29tcGxldGlvbnNRdW90YUV4Y2VlZGVkKSB7XG5cdFx0XHRcdFx0cXVvdGFXYXJuaW5nID0gbG9jYWxpemUoJ2NoYXRRdW90YUV4Y2VlZGVkU3RhdHVzJywgXCJDaGF0IGxpbWl0IHJlYWNoZWRcIik7XG5cdFx0XHRcdH0gZWxzZSBpZiAoY29tcGxldGlvbnNRdW90YUV4Y2VlZGVkICYmICFjaGF0UXVvdGFFeGNlZWRlZCkge1xuXHRcdFx0XHRcdHF1b3RhV2FybmluZyA9IGxvY2FsaXplKCdjb21wbGV0aW9uc1F1b3RhRXhjZWVkZWRTdGF0dXMnLCBcIkNvbXBsZXRpb25zIGxpbWl0IHJlYWNoZWRcIik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cXVvdGFXYXJuaW5nID0gbG9jYWxpemUoJ2NoYXRBbmRDb21wbGV0aW9uc1F1b3RhRXhjZWVkZWRTdGF0dXMnLCBcIkxpbWl0IHJlYWNoZWRcIik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0ZXh0ID0gYCQoY29waWxvdC13YXJuaW5nKSAke3F1b3RhV2FybmluZ31gO1xuXHRcdFx0XHRhcmlhTGFiZWwgPSBxdW90YVdhcm5pbmc7XG5cdFx0XHRcdGtpbmQgPSAncHJvbWluZW50Jztcblx0XHRcdH1cblxuXHRcdFx0Ly8gQ29tcGxldGlvbnMgRGlzYWJsZWRcblx0XHRcdGVsc2UgaWYgKHRoaXMuZWRpdG9yU2VydmljZS5hY3RpdmVUZXh0RWRpdG9yTGFuZ3VhZ2VJZCAmJiAhaXNDb21wbGV0aW9uc0VuYWJsZWQodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSwgdGhpcy5lZGl0b3JTZXJ2aWNlLmFjdGl2ZVRleHRFZGl0b3JMYW5ndWFnZUlkKSkge1xuXHRcdFx0XHR0ZXh0ID0gYCQoY29waWxvdC1ub3QtY29ubmVjdGVkKWA7XG5cdFx0XHRcdGFyaWFMYWJlbCA9IGxvY2FsaXplKCdjb21wbGV0aW9uc0Rpc2FibGVkU3RhdHVzJywgXCJDb2RlIENvbXBsZXRpb25zIERpc2FibGVkXCIpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRuYW1lOiBsb2NhbGl6ZSgnY2hhdFN0YXR1cycsIFwiQ29waWxvdCBTdGF0dXNcIiksXG5cdFx0XHR0ZXh0LFxuXHRcdFx0YXJpYUxhYmVsLFxuXHRcdFx0Y29tbWFuZDogU2hvd1Rvb2x0aXBDb21tYW5kLFxuXHRcdFx0c2hvd0luQWxsV2luZG93czogdHJ1ZSxcblx0XHRcdGtpbmQsXG5cdFx0XHR0b29sdGlwOiB7IGVsZW1lbnQ6IHRva2VuID0+IHRoaXMuZGFzaGJvYXJkLnZhbHVlLnNob3codG9rZW4pIH1cblx0XHR9O1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cblx0XHR0aGlzLmVudHJ5Py5kaXNwb3NlKCk7XG5cdFx0dGhpcy5lbnRyeSA9IHVuZGVmaW5lZDtcblx0fVxufVxuXG5mdW5jdGlvbiBpc05ld1VzZXIoY2hhdEVudGl0bGVtZW50U2VydmljZTogSUNoYXRFbnRpdGxlbWVudFNlcnZpY2UpOiBib29sZWFuIHtcblx0cmV0dXJuIGNoYXRFbnRpdGxlbWVudFNlcnZpY2Uuc2VudGltZW50ICE9PSBDaGF0U2VudGltZW50Lkluc3RhbGxlZCB8fFx0Ly8gY29waWxvdCBub3QgaW5zdGFsbGVkXG5cdFx0Y2hhdEVudGl0bGVtZW50U2VydmljZS5lbnRpdGxlbWVudCA9PT0gQ2hhdEVudGl0bGVtZW50LkF2YWlsYWJsZTtcdC8vIG5vdCB5ZXQgc2lnbmVkIHVwIHRvIGNvcGlsb3Rcbn1cblxuZnVuY3Rpb24gY2FuVXNlQ29waWxvdChjaGF0RW50aXRsZW1lbnRTZXJ2aWNlOiBJQ2hhdEVudGl0bGVtZW50U2VydmljZSk6IGJvb2xlYW4ge1xuXHRjb25zdCBuZXdVc2VyID0gaXNOZXdVc2VyKGNoYXRFbnRpdGxlbWVudFNlcnZpY2UpO1xuXHRjb25zdCBzaWduZWRPdXQgPSBjaGF0RW50aXRsZW1lbnRTZXJ2aWNlLmVudGl0bGVtZW50ID09PSBDaGF0RW50aXRsZW1lbnQuVW5rbm93bjtcblx0Y29uc3QgYWxsUXVvdGFSZWFjaGVkID0gY2hhdEVudGl0bGVtZW50U2VydmljZS5xdW90YXMuY2hhdFF1b3RhRXhjZWVkZWQgJiYgY2hhdEVudGl0bGVtZW50U2VydmljZS5xdW90YXMuY29tcGxldGlvbnNRdW90YUV4Y2VlZGVkO1xuXG5cdHJldHVybiAhbmV3VXNlciAmJiAhc2lnbmVkT3V0ICYmICFhbGxRdW90YVJlYWNoZWQ7XG59XG5cbmZ1bmN0aW9uIGlzQ29tcGxldGlvbnNFbmFibGVkKGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsIG1vZGVJZDogc3RyaW5nID0gJyonKTogYm9vbGVhbiB7XG5cdGNvbnN0IHJlc3VsdCA9IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPFJlY29yZDxzdHJpbmcsIGJvb2xlYW4+PihkZWZhdWx0Q2hhdC5jb21wbGV0aW9uc0VuYWJsZW1lbnRTZXR0aW5nKTtcblx0aWYgKCFpc09iamVjdChyZXN1bHQpKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0aWYgKHR5cGVvZiByZXN1bHRbbW9kZUlkXSAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRyZXR1cm4gQm9vbGVhbihyZXN1bHRbbW9kZUlkXSk7IC8vIGdvIHdpdGggc2V0dGluZyBpZiBleHBsaWNpdGx5IGRlZmluZWRcblx0fVxuXG5cdHJldHVybiBCb29sZWFuKHJlc3VsdFsnKiddKTsgLy8gZmFsbGJhY2sgdG8gZ2xvYmFsIHNldHRpbmcgb3RoZXJ3aXNlXG59XG5cbmludGVyZmFjZSBJU2V0dGluZ3NBY2Nlc3NvciB7XG5cdHJlYWRTZXR0aW5nOiAoKSA9PiBib29sZWFuO1xuXHR3cml0ZVNldHRpbmc6ICh2YWx1ZTogYm9vbGVhbikgPT4gUHJvbWlzZTx2b2lkPjtcbn1cblxuY2xhc3MgQ2hhdFN0YXR1c0Rhc2hib2FyZCBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZWxlbWVudCA9ICQoJ2Rpdi5jaGF0LXN0YXR1cy1iYXItZW50cnktdG9vbHRpcCcpO1xuXG5cdHByaXZhdGUgZGF0ZUZvcm1hdHRlciA9IG5ldyBMYXp5KCgpID0+IHNhZmVJbnRsLkRhdGVUaW1lRm9ybWF0KGxhbmd1YWdlLCB7IHllYXI6ICdudW1lcmljJywgbW9udGg6ICdsb25nJywgZGF5OiAnbnVtZXJpYycgfSkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IGVudHJ5RGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgTXV0YWJsZURpc3Bvc2FibGUoKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDaGF0RW50aXRsZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdEVudGl0bGVtZW50U2VydmljZTogQ2hhdEVudGl0bGVtZW50U2VydmljZSxcblx0XHRASUNoYXRTdGF0dXNJdGVtU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNoYXRTdGF0dXNJdGVtU2VydmljZTogSUNoYXRTdGF0dXNJdGVtU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2U6IElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHNob3codG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogSFRNTEVsZW1lbnQge1xuXHRcdGNsZWFyTm9kZSh0aGlzLmVsZW1lbnQpO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSB0aGlzLmVudHJ5RGlzcG9zYWJsZXMudmFsdWUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IGRpc3Bvc2FibGVzLmRpc3Bvc2UoKSkpO1xuXG5cdFx0bGV0IG5lZWRzU2VwYXJhdG9yID0gZmFsc2U7XG5cdFx0Y29uc3QgYWRkU2VwYXJhdG9yID0gKGxhYmVsOiBzdHJpbmcgfCB1bmRlZmluZWQpID0+IHtcblx0XHRcdGlmIChuZWVkc1NlcGFyYXRvcikge1xuXHRcdFx0XHR0aGlzLmVsZW1lbnQuYXBwZW5kQ2hpbGQoJCgnaHInKSk7XG5cdFx0XHRcdG5lZWRzU2VwYXJhdG9yID0gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChsYWJlbCkge1xuXHRcdFx0XHR0aGlzLmVsZW1lbnQuYXBwZW5kQ2hpbGQoJCgnZGl2LmhlYWRlcicsIHVuZGVmaW5lZCwgbGFiZWwpKTtcblx0XHRcdH1cblxuXHRcdFx0bmVlZHNTZXBhcmF0b3IgPSB0cnVlO1xuXHRcdH07XG5cblx0XHQvLyBRdW90YSBJbmRpY2F0b3Jcblx0XHRpZiAodGhpcy5jaGF0RW50aXRsZW1lbnRTZXJ2aWNlLmVudGl0bGVtZW50ID09PSBDaGF0RW50aXRsZW1lbnQuTGltaXRlZCkge1xuXHRcdFx0Y29uc3QgeyBjaGF0VG90YWwsIGNoYXRSZW1haW5pbmcsIGNvbXBsZXRpb25zVG90YWwsIGNvbXBsZXRpb25zUmVtYWluaW5nLCBxdW90YVJlc2V0RGF0ZSwgY2hhdFF1b3RhRXhjZWVkZWQsIGNvbXBsZXRpb25zUXVvdGFFeGNlZWRlZCB9ID0gdGhpcy5jaGF0RW50aXRsZW1lbnRTZXJ2aWNlLnF1b3RhcztcblxuXHRcdFx0YWRkU2VwYXJhdG9yKGxvY2FsaXplKCd1c2FnZVRpdGxlJywgXCJDb3BpbG90IEZyZWUgUGxhbiBVc2FnZVwiKSk7XG5cblx0XHRcdGNvbnN0IGNoYXRRdW90YUluZGljYXRvciA9IHRoaXMuY3JlYXRlUXVvdGFJbmRpY2F0b3IodGhpcy5lbGVtZW50LCBjaGF0VG90YWwsIGNoYXRSZW1haW5pbmcsIGxvY2FsaXplKCdjaGF0c0xhYmVsJywgXCJDaGF0IG1lc3NhZ2VzXCIpKTtcblx0XHRcdGNvbnN0IGNvbXBsZXRpb25zUXVvdGFJbmRpY2F0b3IgPSB0aGlzLmNyZWF0ZVF1b3RhSW5kaWNhdG9yKHRoaXMuZWxlbWVudCwgY29tcGxldGlvbnNUb3RhbCwgY29tcGxldGlvbnNSZW1haW5pbmcsIGxvY2FsaXplKCdjb21wbGV0aW9uc0xhYmVsJywgXCJDb2RlIGNvbXBsZXRpb25zXCIpKTtcblxuXHRcdFx0dGhpcy5lbGVtZW50LmFwcGVuZENoaWxkKCQoJ2Rpdi5kZXNjcmlwdGlvbicsIHVuZGVmaW5lZCwgbG9jYWxpemUoJ2xpbWl0UXVvdGEnLCBcIkxpbWl0cyB3aWxsIHJlc2V0IG9uIHswfS5cIiwgdGhpcy5kYXRlRm9ybWF0dGVyLnZhbHVlLmZvcm1hdChxdW90YVJlc2V0RGF0ZSkpKSk7XG5cblx0XHRcdGlmIChjaGF0UXVvdGFFeGNlZWRlZCB8fCBjb21wbGV0aW9uc1F1b3RhRXhjZWVkZWQpIHtcblx0XHRcdFx0Y29uc3QgdXBncmFkZVBsYW5CdXR0b24gPSBkaXNwb3NhYmxlcy5hZGQobmV3IEJ1dHRvbih0aGlzLmVsZW1lbnQsIHsgLi4uZGVmYXVsdEJ1dHRvblN0eWxlcywgc2Vjb25kYXJ5OiBjYW5Vc2VDb3BpbG90KHRoaXMuY2hhdEVudGl0bGVtZW50U2VydmljZSkgLyogdXNlIHNlY29uZGFyeSBjb2xvciB3aGVuIGNvcGlsb3QgY2FuIHN0aWxsIGJlIHVzZWQgKi8gfSkpO1xuXHRcdFx0XHR1cGdyYWRlUGxhbkJ1dHRvbi5sYWJlbCA9IGxvY2FsaXplKCd1cGdyYWRlVG9Db3BpbG90UHJvJywgXCJVcGdyYWRlIHRvIENvcGlsb3QgUHJvXCIpO1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQodXBncmFkZVBsYW5CdXR0b24ub25EaWRDbGljaygoKSA9PiB0aGlzLnJ1bkNvbW1hbmRBbmRDbG9zZSgnd29ya2JlbmNoLmFjdGlvbi5jaGF0LnVwZ3JhZGVQbGFuJykpKTtcblx0XHRcdH1cblxuXHRcdFx0KGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5jaGF0RW50aXRsZW1lbnRTZXJ2aWNlLnVwZGF0ZSh0b2tlbik7XG5cdFx0XHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHsgY2hhdFRvdGFsLCBjaGF0UmVtYWluaW5nLCBjb21wbGV0aW9uc1RvdGFsLCBjb21wbGV0aW9uc1JlbWFpbmluZyB9ID0gdGhpcy5jaGF0RW50aXRsZW1lbnRTZXJ2aWNlLnF1b3RhcztcblxuXHRcdFx0XHRjaGF0UXVvdGFJbmRpY2F0b3IoY2hhdFRvdGFsLCBjaGF0UmVtYWluaW5nKTtcblx0XHRcdFx0Y29tcGxldGlvbnNRdW90YUluZGljYXRvcihjb21wbGV0aW9uc1RvdGFsLCBjb21wbGV0aW9uc1JlbWFpbmluZyk7XG5cdFx0XHR9KSgpO1xuXHRcdH1cblxuXHRcdC8vIENvbnRyaWJ1dGlvbnNcblx0XHR7XG5cdFx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgdGhpcy5jaGF0U3RhdHVzSXRlbVNlcnZpY2UuZ2V0RW50cmllcygpKSB7XG5cdFx0XHRcdGFkZFNlcGFyYXRvcih1bmRlZmluZWQpO1xuXHRcdFx0XHRjb25zdCBjaGF0SXRlbURpc3Bvc2FibGVzID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblxuXHRcdFx0XHRsZXQgcmVuZGVyZWQgPSB0aGlzLnJlbmRlckNvbnRyaWJ1dGVkQ2hhdFN0YXR1c0l0ZW0oaXRlbSk7XG5cdFx0XHRcdGNoYXRJdGVtRGlzcG9zYWJsZXMudmFsdWUgPSByZW5kZXJlZC5kaXNwb3NhYmxlcztcblx0XHRcdFx0dGhpcy5lbGVtZW50LmFwcGVuZENoaWxkKHJlbmRlcmVkLmVsZW1lbnQpO1xuXG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZCh0aGlzLmNoYXRTdGF0dXNJdGVtU2VydmljZS5vbkRpZENoYW5nZShlID0+IHtcblx0XHRcdFx0XHRpZiAoZS5lbnRyeS5pZCA9PT0gaXRlbS5pZCkge1xuXHRcdFx0XHRcdFx0Y29uc3Qgb2xkRWwgPSByZW5kZXJlZC5lbGVtZW50O1xuXG5cdFx0XHRcdFx0XHRyZW5kZXJlZCA9IHRoaXMucmVuZGVyQ29udHJpYnV0ZWRDaGF0U3RhdHVzSXRlbShlLmVudHJ5KTtcblx0XHRcdFx0XHRcdGNoYXRJdGVtRGlzcG9zYWJsZXMudmFsdWUgPSByZW5kZXJlZC5kaXNwb3NhYmxlcztcblxuXHRcdFx0XHRcdFx0b2xkRWwucmVwbGFjZVdpdGgocmVuZGVyZWQuZWxlbWVudCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gU2V0dGluZ3Ncblx0XHR7XG5cdFx0XHRhZGRTZXBhcmF0b3IobG9jYWxpemUoJ3NldHRpbmdzVGl0bGUnLCBcIlNldHRpbmdzXCIpKTtcblxuXHRcdFx0dGhpcy5jcmVhdGVTZXR0aW5ncyh0aGlzLmVsZW1lbnQsIGRpc3Bvc2FibGVzKTtcblx0XHR9XG5cblx0XHQvLyBOZXcgdG8gQ29waWxvdCAvIFNpZ25lZCBvdXRcblx0XHR7XG5cdFx0XHRjb25zdCBuZXdVc2VyID0gaXNOZXdVc2VyKHRoaXMuY2hhdEVudGl0bGVtZW50U2VydmljZSk7XG5cdFx0XHRjb25zdCBzaWduZWRPdXQgPSB0aGlzLmNoYXRFbnRpdGxlbWVudFNlcnZpY2UuZW50aXRsZW1lbnQgPT09IENoYXRFbnRpdGxlbWVudC5Vbmtub3duO1xuXHRcdFx0aWYgKG5ld1VzZXIgfHwgc2lnbmVkT3V0KSB7XG5cdFx0XHRcdGFkZFNlcGFyYXRvcih1bmRlZmluZWQpO1xuXG5cdFx0XHRcdHRoaXMuZWxlbWVudC5hcHBlbmRDaGlsZCgkKCdkaXYuZGVzY3JpcHRpb24nLCB1bmRlZmluZWQsIG5ld1VzZXIgPyBsb2NhbGl6ZSgnYWN0aXZhdGVEZXNjcmlwdGlvbicsIFwiU2V0IHVwIENvcGlsb3QgdG8gdXNlIEFJIGZlYXR1cmVzLlwiKSA6IGxvY2FsaXplKCdzaWduSW5EZXNjcmlwdGlvbicsIFwiU2lnbiBpbiB0byB1c2UgQ29waWxvdCBBSSBmZWF0dXJlcy5cIikpKTtcblxuXHRcdFx0XHRjb25zdCBidXR0b24gPSBkaXNwb3NhYmxlcy5hZGQobmV3IEJ1dHRvbih0aGlzLmVsZW1lbnQsIHsgLi4uZGVmYXVsdEJ1dHRvblN0eWxlcyB9KSk7XG5cdFx0XHRcdGJ1dHRvbi5sYWJlbCA9IG5ld1VzZXIgPyBsb2NhbGl6ZSgnYWN0aXZhdGVDb3BpbG90QnV0dG9uJywgXCJTZXQgdXAgQ29waWxvdFwiKSA6IGxvY2FsaXplKCdzaWduSW5Ub1VzZUNvcGlsb3RCdXR0b24nLCBcIlNpZ24gaW4gdG8gdXNlIENvcGlsb3RcIik7XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChidXR0b24ub25EaWRDbGljaygoKSA9PiB0aGlzLnJ1bkNvbW1hbmRBbmRDbG9zZShuZXdVc2VyID8gJ3dvcmtiZW5jaC5hY3Rpb24uY2hhdC50cmlnZ2VyU2V0dXAnIDogKCkgPT4gdGhpcy5jaGF0RW50aXRsZW1lbnRTZXJ2aWNlLnJlcXVlc3RzPy52YWx1ZS5zaWduSW4oKSkpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5lbGVtZW50O1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJDb250cmlidXRlZENoYXRTdGF0dXNJdGVtKGl0ZW06IENoYXRTdGF0dXNFbnRyeSk6IHsgZWxlbWVudDogSFRNTEVsZW1lbnQ7IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUgfSB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCBlbnRyeUVsID0gJCgnZGl2LmNvbnRyaWJ1dGlvbicpO1xuXG5cdFx0ZW50cnlFbC5hcHBlbmRDaGlsZCgkKCdkaXYuaGVhZGVyJywgdW5kZWZpbmVkLCBpdGVtLmxhYmVsKSk7XG5cblx0XHRjb25zdCBib2R5RWwgPSBlbnRyeUVsLmFwcGVuZENoaWxkKCQoJ2Rpdi5ib2R5JykpO1xuXG5cdFx0Y29uc3QgZGVzY3JpcHRpb25FbCA9IGJvZHlFbC5hcHBlbmRDaGlsZCgkKCdzcGFuLmRlc2NyaXB0aW9uJykpO1xuXHRcdHRoaXMucmVuZGVyVGV4dFBsdXMoZGVzY3JpcHRpb25FbCwgaXRlbS5kZXNjcmlwdGlvbiwgZGlzcG9zYWJsZXMpO1xuXG5cdFx0aWYgKGl0ZW0uZGV0YWlsKSB7XG5cdFx0XHRjb25zdCBpdGVtRWxlbWVudCA9IGJvZHlFbC5hcHBlbmRDaGlsZCgkKCdkaXYuZGV0YWlsLWl0ZW0nKSk7XG5cdFx0XHR0aGlzLnJlbmRlclRleHRQbHVzKGl0ZW1FbGVtZW50LCBpdGVtLmRldGFpbCwgZGlzcG9zYWJsZXMpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7IGVsZW1lbnQ6IGVudHJ5RWwsIGRpc3Bvc2FibGVzIH07XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlclRleHRQbHVzKHRhcmdldDogSFRNTEVsZW1lbnQsIHRleHQ6IHN0cmluZywgc3RvcmU6IERpc3Bvc2FibGVTdG9yZSk6IHZvaWQge1xuXHRcdGZvciAoY29uc3Qgbm9kZSBvZiBwYXJzZUxpbmtlZFRleHQodGV4dCkubm9kZXMpIHtcblx0XHRcdGlmICh0eXBlb2Ygbm9kZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0Y29uc3QgcGFydHMgPSByZW5kZXJMYWJlbFdpdGhJY29ucyhub2RlKTtcblx0XHRcdFx0dGFyZ2V0LmFwcGVuZCguLi5wYXJ0cyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRzdG9yZS5hZGQobmV3IExpbmsodGFyZ2V0LCBub2RlLCB1bmRlZmluZWQsIHRoaXMuaG92ZXJTZXJ2aWNlLCB0aGlzLm9wZW5lclNlcnZpY2UpKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJ1bkNvbW1hbmRBbmRDbG9zZShjb21tYW5kT3JGbjogc3RyaW5nIHwgRnVuY3Rpb24pOiB2b2lkIHtcblx0XHRpZiAodHlwZW9mIGNvbW1hbmRPckZuID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRjb21tYW5kT3JGbigpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZEV2ZW50LCBXb3JrYmVuY2hBY3Rpb25FeGVjdXRlZENsYXNzaWZpY2F0aW9uPignd29ya2JlbmNoQWN0aW9uRXhlY3V0ZWQnLCB7IGlkOiBjb21tYW5kT3JGbiwgZnJvbTogJ2NoYXQtc3RhdHVzJyB9KTtcblx0XHRcdHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoY29tbWFuZE9yRm4pO1xuXHRcdH1cblxuXHRcdHRoaXMuaG92ZXJTZXJ2aWNlLmhpZGVIb3Zlcih0cnVlKTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlUXVvdGFJbmRpY2F0b3IoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgdG90YWw6IG51bWJlciB8IHVuZGVmaW5lZCwgcmVtYWluaW5nOiBudW1iZXIgfCB1bmRlZmluZWQsIGxhYmVsOiBzdHJpbmcpOiAodG90YWw6IG51bWJlciB8IHVuZGVmaW5lZCwgcmVtYWluaW5nOiBudW1iZXIgfCB1bmRlZmluZWQpID0+IHZvaWQge1xuXHRcdGNvbnN0IHF1b3RhVGV4dCA9ICQoJ3NwYW4nKTtcblx0XHRjb25zdCBxdW90YUJpdCA9ICQoJ2Rpdi5xdW90YS1iaXQnKTtcblxuXHRcdGNvbnN0IHF1b3RhSW5kaWNhdG9yID0gY29udGFpbmVyLmFwcGVuZENoaWxkKCQoJ2Rpdi5xdW90YS1pbmRpY2F0b3InLCB1bmRlZmluZWQsXG5cdFx0XHQkKCdkaXYucXVvdGEtbGFiZWwnLCB1bmRlZmluZWQsXG5cdFx0XHRcdCQoJ3NwYW4nLCB1bmRlZmluZWQsIGxhYmVsKSxcblx0XHRcdFx0cXVvdGFUZXh0XG5cdFx0XHQpLFxuXHRcdFx0JCgnZGl2LnF1b3RhLWJhcicsIHVuZGVmaW5lZCxcblx0XHRcdFx0cXVvdGFCaXRcblx0XHRcdClcblx0XHQpKTtcblxuXHRcdGNvbnN0IHVwZGF0ZSA9ICh0b3RhbDogbnVtYmVyIHwgdW5kZWZpbmVkLCByZW1haW5pbmc6IG51bWJlciB8IHVuZGVmaW5lZCkgPT4ge1xuXHRcdFx0cXVvdGFJbmRpY2F0b3IuY2xhc3NMaXN0LnJlbW92ZSgnZXJyb3InKTtcblx0XHRcdHF1b3RhSW5kaWNhdG9yLmNsYXNzTGlzdC5yZW1vdmUoJ3dhcm5pbmcnKTtcblxuXHRcdFx0aWYgKHR5cGVvZiB0b3RhbCA9PT0gJ251bWJlcicgJiYgdHlwZW9mIHJlbWFpbmluZyA9PT0gJ251bWJlcicpIHtcblx0XHRcdFx0bGV0IHVzZWRQZXJjZW50YWdlID0gTWF0aC5yb3VuZCgoKHRvdGFsIC0gcmVtYWluaW5nKSAvIHRvdGFsKSAqIDEwMCk7XG5cdFx0XHRcdGlmICh0b3RhbCAhPT0gcmVtYWluaW5nICYmIHVzZWRQZXJjZW50YWdlID09PSAwKSB7XG5cdFx0XHRcdFx0dXNlZFBlcmNlbnRhZ2UgPSAxOyAvLyBpbmRpY2F0ZSBtaW5pbWFsIHVzYWdlIGFzIDElXG5cdFx0XHRcdH1cblxuXHRcdFx0XHRxdW90YVRleHQudGV4dENvbnRlbnQgPSBsb2NhbGl6ZSgncXVvdGFEaXNwbGF5JywgXCJ7MH0lXCIsIHVzZWRQZXJjZW50YWdlKTtcblx0XHRcdFx0cXVvdGFCaXQuc3R5bGUud2lkdGggPSBgJHt1c2VkUGVyY2VudGFnZX0lYDtcblxuXHRcdFx0XHRpZiAodXNlZFBlcmNlbnRhZ2UgPj0gOTApIHtcblx0XHRcdFx0XHRxdW90YUluZGljYXRvci5jbGFzc0xpc3QuYWRkKCdlcnJvcicpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHVzZWRQZXJjZW50YWdlID49IDc1KSB7XG5cdFx0XHRcdFx0cXVvdGFJbmRpY2F0b3IuY2xhc3NMaXN0LmFkZCgnd2FybmluZycpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHVwZGF0ZSh0b3RhbCwgcmVtYWluaW5nKTtcblxuXHRcdHJldHVybiB1cGRhdGU7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVNldHRpbmdzKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpOiBIVE1MRWxlbWVudCB7XG5cdFx0Y29uc3QgbW9kZUlkID0gdGhpcy5lZGl0b3JTZXJ2aWNlLmFjdGl2ZVRleHRFZGl0b3JMYW5ndWFnZUlkO1xuXHRcdGNvbnN0IHNldHRpbmdzID0gY29udGFpbmVyLmFwcGVuZENoaWxkKCQoJ2Rpdi5zZXR0aW5ncycpKTtcblxuXHRcdC8vIC0tLSBDb2RlIENvbXBsZXRpb25zXG5cdFx0e1xuXHRcdFx0Y29uc3QgZ2xvYmFsU2V0dGluZyA9IGFwcGVuZChzZXR0aW5ncywgJCgnZGl2LnNldHRpbmcnKSk7XG5cdFx0XHR0aGlzLmNyZWF0ZUNvZGVDb21wbGV0aW9uc1NldHRpbmcoZ2xvYmFsU2V0dGluZywgbG9jYWxpemUoJ3NldHRpbmdzLmNvZGVDb21wbGV0aW9ucycsIFwiQ29kZSBDb21wbGV0aW9ucyAoYWxsIGZpbGVzKVwiKSwgJyonLCBkaXNwb3NhYmxlcyk7XG5cblx0XHRcdGlmIChtb2RlSWQpIHtcblx0XHRcdFx0Y29uc3QgbGFuZ3VhZ2VTZXR0aW5nID0gYXBwZW5kKHNldHRpbmdzLCAkKCdkaXYuc2V0dGluZycpKTtcblx0XHRcdFx0dGhpcy5jcmVhdGVDb2RlQ29tcGxldGlvbnNTZXR0aW5nKGxhbmd1YWdlU2V0dGluZywgbG9jYWxpemUoJ3NldHRpbmdzLmNvZGVDb21wbGV0aW9uc0xhbmd1YWdlJywgXCJDb2RlIENvbXBsZXRpb25zICh7MH0pXCIsIHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmdldExhbmd1YWdlTmFtZShtb2RlSWQpID8/IG1vZGVJZCksIG1vZGVJZCwgZGlzcG9zYWJsZXMpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIC0tLSBOZXh0IEVkaXQgU3VnZ2VzdGlvbnNcblx0XHR7XG5cdFx0XHRjb25zdCBzZXR0aW5nID0gYXBwZW5kKHNldHRpbmdzLCAkKCdkaXYuc2V0dGluZycpKTtcblx0XHRcdHRoaXMuY3JlYXRlTmV4dEVkaXRTdWdnZXN0aW9uc1NldHRpbmcoc2V0dGluZywgbG9jYWxpemUoJ3NldHRpbmdzLm5leHRFZGl0U3VnZ2VzdGlvbnMnLCBcIk5leHQgRWRpdCBTdWdnZXN0aW9uc1wiKSwgbW9kZUlkLCB0aGlzLmdldENvbXBsZXRpb25zU2V0dGluZ0FjY2Vzc29yKG1vZGVJZCksIGRpc3Bvc2FibGVzKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gc2V0dGluZ3M7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVNldHRpbmcoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgc2V0dGluZ0lkOiBzdHJpbmcsIGxhYmVsOiBzdHJpbmcsIGFjY2Vzc29yOiBJU2V0dGluZ3NBY2Nlc3NvciwgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSk6IENoZWNrYm94IHtcblx0XHRjb25zdCBjaGVja2JveCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQ2hlY2tib3gobGFiZWwsIEJvb2xlYW4oYWNjZXNzb3IucmVhZFNldHRpbmcoKSksIGRlZmF1bHRDaGVja2JveFN0eWxlcykpO1xuXHRcdGNvbnRhaW5lci5hcHBlbmRDaGlsZChjaGVja2JveC5kb21Ob2RlKTtcblxuXHRcdGNvbnN0IHNldHRpbmdMYWJlbCA9IGFwcGVuZChjb250YWluZXIsICQoJ3NwYW4uc2V0dGluZy1sYWJlbCcsIHVuZGVmaW5lZCwgbGFiZWwpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoR2VzdHVyZS5hZGRUYXJnZXQoc2V0dGluZ0xhYmVsKSk7XG5cdFx0W0V2ZW50VHlwZS5DTElDSywgVG91Y2hFdmVudFR5cGUuVGFwXS5mb3JFYWNoKGV2ZW50VHlwZSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHNldHRpbmdMYWJlbCwgZXZlbnRUeXBlLCBlID0+IHtcblx0XHRcdFx0aWYgKGNoZWNrYm94Py5lbmFibGVkKSB7XG5cdFx0XHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlKTtcblxuXHRcdFx0XHRcdGNoZWNrYm94LmNoZWNrZWQgPSAhY2hlY2tib3guY2hlY2tlZDtcblx0XHRcdFx0XHRhY2Nlc3Nvci53cml0ZVNldHRpbmcoY2hlY2tib3guY2hlY2tlZCk7XG5cdFx0XHRcdFx0Y2hlY2tib3guZm9jdXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH0pO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGNoZWNrYm94Lm9uQ2hhbmdlKCgpID0+IHtcblx0XHRcdGFjY2Vzc29yLndyaXRlU2V0dGluZyhjaGVja2JveC5jaGVja2VkKTtcblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihzZXR0aW5nSWQpKSB7XG5cdFx0XHRcdGNoZWNrYm94LmNoZWNrZWQgPSBCb29sZWFuKGFjY2Vzc29yLnJlYWRTZXR0aW5nKCkpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGlmICghY2FuVXNlQ29waWxvdCh0aGlzLmNoYXRFbnRpdGxlbWVudFNlcnZpY2UpKSB7XG5cdFx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnZGlzYWJsZWQnKTtcblx0XHRcdGNoZWNrYm94LmRpc2FibGUoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gY2hlY2tib3g7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUNvZGVDb21wbGV0aW9uc1NldHRpbmcoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgbGFiZWw6IHN0cmluZywgbW9kZUlkOiBzdHJpbmcgfCB1bmRlZmluZWQsIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUpOiB2b2lkIHtcblx0XHR0aGlzLmNyZWF0ZVNldHRpbmcoY29udGFpbmVyLCBkZWZhdWx0Q2hhdC5jb21wbGV0aW9uc0VuYWJsZW1lbnRTZXR0aW5nLCBsYWJlbCwgdGhpcy5nZXRDb21wbGV0aW9uc1NldHRpbmdBY2Nlc3Nvcihtb2RlSWQpLCBkaXNwb3NhYmxlcyk7XG5cdH1cblxuXHRwcml2YXRlIGdldENvbXBsZXRpb25zU2V0dGluZ0FjY2Vzc29yKG1vZGVJZCA9ICcqJyk6IElTZXR0aW5nc0FjY2Vzc29yIHtcblx0XHRjb25zdCBzZXR0aW5nSWQgPSBkZWZhdWx0Q2hhdC5jb21wbGV0aW9uc0VuYWJsZW1lbnRTZXR0aW5nO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlYWRTZXR0aW5nOiAoKSA9PiBpc0NvbXBsZXRpb25zRW5hYmxlZCh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBtb2RlSWQpLFxuXHRcdFx0d3JpdGVTZXR0aW5nOiAodmFsdWU6IGJvb2xlYW4pID0+IHtcblx0XHRcdFx0bGV0IHJlc3VsdCA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8UmVjb3JkPHN0cmluZywgYm9vbGVhbj4+KHNldHRpbmdJZCk7XG5cdFx0XHRcdGlmICghaXNPYmplY3QocmVzdWx0KSkge1xuXHRcdFx0XHRcdHJlc3VsdCA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShzZXR0aW5nSWQsIHsgLi4ucmVzdWx0LCBbbW9kZUlkXTogdmFsdWUgfSk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlTmV4dEVkaXRTdWdnZXN0aW9uc1NldHRpbmcoY29udGFpbmVyOiBIVE1MRWxlbWVudCwgbGFiZWw6IHN0cmluZywgbW9kZUlkOiBzdHJpbmcgfCB1bmRlZmluZWQsIGNvbXBsZXRpb25zU2V0dGluZ0FjY2Vzc29yOiBJU2V0dGluZ3NBY2Nlc3NvciwgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSk6IHZvaWQge1xuXHRcdGNvbnN0IG5lc1NldHRpbmdJZCA9IGRlZmF1bHRDaGF0Lm5leHRFZGl0U3VnZ2VzdGlvbnNTZXR0aW5nO1xuXHRcdGNvbnN0IGNvbXBsZXRpb25zU2V0dGluZ0lkID0gZGVmYXVsdENoYXQuY29tcGxldGlvbnNFbmFibGVtZW50U2V0dGluZztcblx0XHRjb25zdCByZXNvdXJjZSA9IEVkaXRvclJlc291cmNlQWNjZXNzb3IuZ2V0T3JpZ2luYWxVcmkodGhpcy5lZGl0b3JTZXJ2aWNlLmFjdGl2ZUVkaXRvciwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5QUklNQVJZIH0pO1xuXG5cdFx0Y29uc3QgY2hlY2tib3ggPSB0aGlzLmNyZWF0ZVNldHRpbmcoY29udGFpbmVyLCBuZXNTZXR0aW5nSWQsIGxhYmVsLCB7XG5cdFx0XHRyZWFkU2V0dGluZzogKCkgPT4gdGhpcy50ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihyZXNvdXJjZSwgbmVzU2V0dGluZ0lkKSxcblx0XHRcdHdyaXRlU2V0dGluZzogKHZhbHVlOiBib29sZWFuKSA9PiB0aGlzLnRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKHJlc291cmNlLCBuZXNTZXR0aW5nSWQsIHZhbHVlKVxuXHRcdH0sIGRpc3Bvc2FibGVzKTtcblxuXHRcdC8vIGVuYWJsZW1lbnQgb2YgTkVTIGRlcGVuZHMgb24gY29tcGxldGlvbnMgc2V0dGluZ1xuXHRcdC8vIHNvIHdlIGhhdmUgdG8gdXBkYXRlIG91ciBjaGVja2JveCBzdGF0ZSBhY2NvcmRpbmdseVxuXG5cdFx0aWYgKCFjb21wbGV0aW9uc1NldHRpbmdBY2Nlc3Nvci5yZWFkU2V0dGluZygpKSB7XG5cdFx0XHRjb250YWluZXIuY2xhc3NMaXN0LmFkZCgnZGlzYWJsZWQnKTtcblx0XHRcdGNoZWNrYm94LmRpc2FibGUoKTtcblx0XHR9XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihjb21wbGV0aW9uc1NldHRpbmdJZCkpIHtcblx0XHRcdFx0aWYgKGNvbXBsZXRpb25zU2V0dGluZ0FjY2Vzc29yLnJlYWRTZXR0aW5nKCkgJiYgY2FuVXNlQ29waWxvdCh0aGlzLmNoYXRFbnRpdGxlbWVudFNlcnZpY2UpKSB7XG5cdFx0XHRcdFx0Y2hlY2tib3guZW5hYmxlKCk7XG5cdFx0XHRcdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5yZW1vdmUoJ2Rpc2FibGVkJyk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y2hlY2tib3guZGlzYWJsZSgpO1xuXHRcdFx0XHRcdGNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdkaXNhYmxlZCcpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLE9BQU87QUFDUCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFlBQVksaUJBQWlCLHlCQUF5QjtBQUMvRCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGdCQUFnQjtBQUV6QixTQUFtRCxtQkFBbUIsb0JBQW9CLDBCQUE4QztBQUN4SSxTQUFTLEdBQUcsdUJBQXVCLFFBQVEsV0FBVyxhQUFhLGlCQUFpQjtBQUNwRixTQUFTLGlCQUF5QyxlQUFlLCtCQUErQjtBQUVoRyxTQUFTLHFCQUFxQiw2QkFBNkI7QUFDM0QsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsZ0JBQWdCLDRCQUE0QiwyQkFBMkIsOEJBQThCLGVBQWUsbUJBQW1CO0FBQ2hKLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsYUFBYTtBQUN0QixTQUFTLFNBQVMsYUFBYSxzQkFBc0I7QUFDckQsU0FBUyxzQkFBc0I7QUFDL0IsT0FBTyxhQUFhO0FBQ3BCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsNkJBQTZCO0FB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T0FBSztBQUN2RSxVQUFJLEVBQUUscUJBQXFCLG9CQUFvQixHQUFHO0FBQ2pELFlBQUksMkJBQTJCLFlBQVksS0FBSyxjQUFjLEtBQUssc0JBQXNCLEdBQUc7QUFDM0YsbUJBQVMsT0FBTztBQUNoQixvQkFBVSxVQUFVLE9BQU8sVUFBVTtBQUFBLFFBQ3RDLE9BQU87QUFDTixtQkFBUyxRQUFRO0FBQ2pCLG9CQUFVLFVBQVUsSUFBSSxVQUFVO0FBQUEsUUFDbkM7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFBQSxFQUNIO0FBQ0Q7QUF4VE0sc0JBQU47QUFBQSxFQVFHO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FqQkc7IiwKICAibmFtZXMiOiBbImNoYXRUb3RhbCIsICJjaGF0UmVtYWluaW5nIiwgImNvbXBsZXRpb25zVG90YWwiLCAiY29tcGxldGlvbnNSZW1haW5pbmciLCAidG90YWwiLCAicmVtYWluaW5nIl0KfQo=
