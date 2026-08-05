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
import * as DOM from "../../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { HoverPosition } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { SimpleIconLabel } from "../../../../base/browser/ui/iconLabel/simpleIconLabel.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { localize } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { IUserDataSyncEnablementService } from "../../../../platform/userDataSync/common/userDataSync.js";
import { EXPERIMENTAL_INDICATOR_DESCRIPTION, POLICY_SETTING_TAG, PREVIEW_INDICATOR_DESCRIPTION } from "../common/preferences.js";
import { IWorkbenchConfigurationService } from "../../../services/configuration/common/configuration.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
const $ = DOM.$;
let cachedSyncIgnoredSettingsSet = /* @__PURE__ */ new Set();
let cachedSyncIgnoredSettings = [];
let SettingsTreeIndicatorsLabel = class {
  constructor(container, configurationService, hoverService, userDataSyncEnablementService, languageService, commandService) {
    this.configurationService = configurationService;
    this.hoverService = hoverService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this.languageService = languageService;
    this.commandService = commandService;
    /** Indicators that each have their own square container at the top-right of the setting */
    this.isolatedIndicators = [];
    this.keybindingListeners = new DisposableStore();
    this.focusedIndex = 0;
    this.defaultHoverOptions = {
      trapFocus: true,
      position: {
        hoverPosition: HoverPosition.BELOW
      },
      appearance: {
        showPointer: true,
        compact: false
      }
    };
    this.indicatorsContainerElement = DOM.append(container, $(".setting-indicators-container"));
    this.indicatorsContainerElement.style.display = "inline";
    this.previewIndicator = this.createPreviewIndicator();
    this.isolatedIndicators = [this.previewIndicator];
    this.workspaceTrustIndicator = this.createWorkspaceTrustIndicator();
    this.scopeOverridesIndicator = this.createScopeOverridesIndicator();
    this.syncIgnoredIndicator = this.createSyncIgnoredIndicator();
    this.defaultOverrideIndicator = this.createDefaultOverrideIndicator();
    this.parenthesizedIndicators = [this.workspaceTrustIndicator, this.scopeOverridesIndicator, this.syncIgnoredIndicator, this.defaultOverrideIndicator];
  }
  addHoverDisposables(disposables, element, showHover) {
    disposables.clear();
    const scheduler = disposables.add(new RunOnceScheduler(() => {
      const hover = showHover(false);
      if (hover) {
        disposables.add(hover);
      }
    }, this.configurationService.getValue("workbench.hover.delay")));
    disposables.add(DOM.addDisposableListener(element, DOM.EventType.MOUSE_OVER, () => {
      if (!scheduler.isScheduled()) {
        scheduler.schedule();
      }
    }));
    disposables.add(DOM.addDisposableListener(element, DOM.EventType.MOUSE_LEAVE, () => {
      scheduler.cancel();
    }));
    disposables.add(DOM.addDisposableListener(element, DOM.EventType.KEY_DOWN, (e) => {
      const evt = new StandardKeyboardEvent(e);
      if (evt.equals(KeyCode.Space) || evt.equals(KeyCode.Enter)) {
        const hover = showHover(true);
        if (hover) {
          disposables.add(hover);
        }
        e.preventDefault();
      }
    }));
  }
  createWorkspaceTrustIndicator() {
    const disposables = new DisposableStore();
    const workspaceTrustElement = $("span.setting-indicator.setting-item-workspace-trust");
    const workspaceTrustLabel = disposables.add(new SimpleIconLabel(workspaceTrustElement));
    workspaceTrustLabel.text = "$(shield) " + localize("workspaceUntrustedLabel", "Requires workspace trust");
    const content = localize("trustLabel", "The setting value can only be applied in a trusted workspace.");
    const showHover = (focus) => {
      return this.hoverService.showInstantHover({
        ...this.defaultHoverOptions,
        content,
        target: workspaceTrustElement,
        actions: [{
          label: localize("manageWorkspaceTrust", "Manage Workspace Trust"),
          commandId: "workbench.trust.manage",
          run: (target) => {
            this.commandService.executeCommand("workbench.trust.manage");
          }
        }]
      }, focus);
    };
    this.addHoverDisposables(disposables, workspaceTrustElement, showHover);
    return {
      element: workspaceTrustElement,
      label: workspaceTrustLabel,
      disposables
    };
  }
  createScopeOverridesIndicator() {
    const disposables = new DisposableStore();
    const otherOverridesElement = $("span.setting-item-overrides");
    const otherOverridesLabel = disposables.add(new SimpleIconLabel(otherOverridesElement));
    return {
      element: otherOverridesElement,
      label: otherOverridesLabel,
      disposables
    };
  }
  createSyncIgnoredIndicator() {
    const disposables = new DisposableStore();
    const syncIgnoredElement = $("span.setting-indicator.setting-item-ignored");
    const syncIgnoredLabel = disposables.add(new SimpleIconLabel(syncIgnoredElement));
    syncIgnoredLabel.text = localize("extensionSyncIgnoredLabel", "Not synced");
    const syncIgnoredHoverContent = localize("syncIgnoredTitle", "This setting is ignored during sync");
    const showHover = (focus) => {
      return this.hoverService.showInstantHover({
        ...this.defaultHoverOptions,
        content: syncIgnoredHoverContent,
        target: syncIgnoredElement
      }, focus);
    };
    this.addHoverDisposables(disposables, syncIgnoredElement, showHover);
    return {
      element: syncIgnoredElement,
      label: syncIgnoredLabel,
      disposables
    };
  }
  createDefaultOverrideIndicator() {
    const disposables = new DisposableStore();
    const defaultOverrideIndicator = $("span.setting-indicator.setting-item-default-overridden");
    const defaultOverrideLabel = disposables.add(new SimpleIconLabel(defaultOverrideIndicator));
    defaultOverrideLabel.text = localize("defaultOverriddenLabel", "Default value changed");
    return {
      element: defaultOverrideIndicator,
      label: defaultOverrideLabel,
      disposables
    };
  }
  createPreviewIndicator() {
    const disposables = new DisposableStore();
    const previewIndicator = $("span.setting-indicator.setting-item-preview");
    const previewLabel = disposables.add(new SimpleIconLabel(previewIndicator));
    return {
      element: previewIndicator,
      label: previewLabel,
      disposables
    };
  }
  render() {
    this.indicatorsContainerElement.innerText = "";
    this.indicatorsContainerElement.style.display = "none";
    const isolatedIndicatorsToShow = this.isolatedIndicators.filter((indicator) => {
      return indicator.element.style.display !== "none";
    });
    if (isolatedIndicatorsToShow.length) {
      this.indicatorsContainerElement.style.display = "inline";
      for (let i = 0; i < isolatedIndicatorsToShow.length; i++) {
        DOM.append(this.indicatorsContainerElement, isolatedIndicatorsToShow[i].element);
      }
    }
    const parenthesizedIndicatorsToShow = this.parenthesizedIndicators.filter((indicator) => {
      return indicator.element.style.display !== "none";
    });
    if (parenthesizedIndicatorsToShow.length) {
      this.indicatorsContainerElement.style.display = "inline";
      DOM.append(this.indicatorsContainerElement, $("span", void 0, "("));
      for (let i = 0; i < parenthesizedIndicatorsToShow.length - 1; i++) {
        DOM.append(this.indicatorsContainerElement, parenthesizedIndicatorsToShow[i].element);
        DOM.append(this.indicatorsContainerElement, $("span.comma", void 0, " \u2022 "));
      }
      DOM.append(this.indicatorsContainerElement, parenthesizedIndicatorsToShow[parenthesizedIndicatorsToShow.length - 1].element);
      DOM.append(this.indicatorsContainerElement, $("span", void 0, ")"));
    }
    this.resetIndicatorNavigationKeyBindings([...isolatedIndicatorsToShow, ...parenthesizedIndicatorsToShow]);
  }
  resetIndicatorNavigationKeyBindings(indicators) {
    this.keybindingListeners.clear();
    this.indicatorsContainerElement.role = indicators.length >= 1 ? "toolbar" : "button";
    if (!indicators.length) {
      return;
    }
    const firstElement = indicators[0].focusElement ?? indicators[0].element;
    firstElement.tabIndex = 0;
    this.keybindingListeners.add(DOM.addDisposableListener(this.indicatorsContainerElement, "keydown", (e) => {
      const ev = new StandardKeyboardEvent(e);
      let handled = true;
      if (ev.equals(KeyCode.Home)) {
        this.focusIndicatorAt(indicators, 0);
      } else if (ev.equals(KeyCode.End)) {
        this.focusIndicatorAt(indicators, indicators.length - 1);
      } else if (ev.equals(KeyCode.RightArrow)) {
        const indexToFocus = (this.focusedIndex + 1) % indicators.length;
        this.focusIndicatorAt(indicators, indexToFocus);
      } else if (ev.equals(KeyCode.LeftArrow)) {
        const indexToFocus = this.focusedIndex ? this.focusedIndex - 1 : indicators.length - 1;
        this.focusIndicatorAt(indicators, indexToFocus);
      } else {
        handled = false;
      }
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    }));
  }
  focusIndicatorAt(indicators, index) {
    if (index === this.focusedIndex) {
      return;
    }
    const indicator = indicators[index];
    const elementToFocus = indicator.focusElement ?? indicator.element;
    elementToFocus.tabIndex = 0;
    elementToFocus.focus();
    const currentlyFocusedIndicator = indicators[this.focusedIndex];
    const previousFocusedElement = currentlyFocusedIndicator.focusElement ?? currentlyFocusedIndicator.element;
    previousFocusedElement.tabIndex = -1;
    this.focusedIndex = index;
  }
  updateWorkspaceTrust(element) {
    this.workspaceTrustIndicator.element.style.display = element.isUntrusted ? "inline" : "none";
    this.render();
  }
  updateSyncIgnored(element, ignoredSettings) {
    this.syncIgnoredIndicator.element.style.display = this.userDataSyncEnablementService.isEnabled() && ignoredSettings.includes(element.setting.key) ? "inline" : "none";
    this.render();
    if (cachedSyncIgnoredSettings !== ignoredSettings) {
      cachedSyncIgnoredSettings = ignoredSettings;
      cachedSyncIgnoredSettingsSet = new Set(cachedSyncIgnoredSettings);
    }
  }
  updatePreviewIndicator(element) {
    const isPreviewSetting = element.tags?.has("preview");
    const isExperimentalSetting = element.tags?.has("experimental");
    this.previewIndicator.element.style.display = isPreviewSetting || isExperimentalSetting ? "inline" : "none";
    this.previewIndicator.label.text = isPreviewSetting ? localize("previewLabel", "Preview") : localize("experimentalLabel", "Experimental");
    const content = isPreviewSetting ? PREVIEW_INDICATOR_DESCRIPTION : EXPERIMENTAL_INDICATOR_DESCRIPTION;
    const showHover = (focus) => {
      return this.hoverService.showInstantHover({
        ...this.defaultHoverOptions,
        content,
        target: this.previewIndicator.element
      }, focus);
    };
    this.addHoverDisposables(this.previewIndicator.disposables, this.previewIndicator.element, showHover);
    this.render();
  }
  getInlineScopeDisplayText(completeScope) {
    const [scope, language] = completeScope.split(":");
    const localizedScope = scope === "user" ? localize("user", "User") : scope === "workspace" ? localize("workspace", "Workspace") : localize("remote", "Remote");
    if (language) {
      return `${this.languageService.getLanguageName(language)} > ${localizedScope}`;
    }
    return localizedScope;
  }
  dispose() {
    this.keybindingListeners.dispose();
    for (const indicator of this.isolatedIndicators) {
      indicator.disposables.dispose();
    }
    for (const indicator of this.parenthesizedIndicators) {
      indicator.disposables.dispose();
    }
  }
  updateScopeOverrides(element, onDidClickOverrideElement, onApplyFilter) {
    this.scopeOverridesIndicator.disposables.clear();
    this.scopeOverridesIndicator.element.innerText = "";
    this.scopeOverridesIndicator.element.style.display = "none";
    this.scopeOverridesIndicator.focusElement = this.scopeOverridesIndicator.element;
    if (element.hasPolicyValue) {
      this.scopeOverridesIndicator.element.style.display = "inline";
      this.scopeOverridesIndicator.element.classList.add("setting-indicator");
      this.scopeOverridesIndicator.label.text = "$(briefcase) " + localize("policyLabelText", "Managed by organization");
      const content = localize("policyDescription", "This setting is managed by your organization and its actual value cannot be changed.");
      const showHover = (focus) => {
        return this.hoverService.showInstantHover({
          ...this.defaultHoverOptions,
          content,
          actions: [{
            label: localize("policyFilterLink", "View policy settings"),
            commandId: "_settings.action.viewPolicySettings",
            run: (_) => {
              onApplyFilter.fire(`@${POLICY_SETTING_TAG}`);
            }
          }],
          target: this.scopeOverridesIndicator.element
        }, focus);
      };
      this.addHoverDisposables(this.scopeOverridesIndicator.disposables, this.scopeOverridesIndicator.element, showHover);
    } else if (element.settingsTarget === ConfigurationTarget.USER_LOCAL && this.configurationService.isSettingAppliedForAllProfiles(element.setting.key)) {
      this.scopeOverridesIndicator.element.style.display = "inline";
      this.scopeOverridesIndicator.element.classList.add("setting-indicator");
      this.scopeOverridesIndicator.label.text = localize("applicationSetting", "Applies to all profiles");
      const content = localize("applicationSettingDescription", "The setting is not specific to the current profile, and will retain its value when switching profiles.");
      const showHover = (focus) => {
        return this.hoverService.showInstantHover({
          ...this.defaultHoverOptions,
          content,
          target: this.scopeOverridesIndicator.element
        }, focus);
      };
      this.addHoverDisposables(this.scopeOverridesIndicator.disposables, this.scopeOverridesIndicator.element, showHover);
    } else if (element.overriddenScopeList.length || element.overriddenDefaultsLanguageList.length) {
      if (element.overriddenScopeList.length === 1 && !element.overriddenDefaultsLanguageList.length) {
        this.scopeOverridesIndicator.element.style.display = "inline";
        this.scopeOverridesIndicator.element.classList.remove("setting-indicator");
        const prefaceText = element.isConfigured ? localize("alsoConfiguredIn", "Also modified in") : localize("configuredIn", "Modified in");
        this.scopeOverridesIndicator.label.text = `${prefaceText} `;
        const overriddenScope = element.overriddenScopeList[0];
        const view = DOM.append(this.scopeOverridesIndicator.element, $("a.modified-scope", void 0, this.getInlineScopeDisplayText(overriddenScope)));
        view.tabIndex = -1;
        this.scopeOverridesIndicator.focusElement = view;
        const onClickOrKeydown = (e) => {
          const [scope, language] = overriddenScope.split(":");
          onDidClickOverrideElement.fire({
            settingKey: element.setting.key,
            scope,
            language
          });
          e.preventDefault();
          e.stopPropagation();
        };
        this.scopeOverridesIndicator.disposables.add(DOM.addDisposableListener(view, DOM.EventType.CLICK, (e) => {
          onClickOrKeydown(e);
        }));
        this.scopeOverridesIndicator.disposables.add(DOM.addDisposableListener(view, DOM.EventType.KEY_DOWN, (e) => {
          const ev = new StandardKeyboardEvent(e);
          if (ev.equals(KeyCode.Space) || ev.equals(KeyCode.Enter)) {
            onClickOrKeydown(e);
          }
        }));
      } else {
        this.scopeOverridesIndicator.element.style.display = "inline";
        this.scopeOverridesIndicator.element.classList.add("setting-indicator");
        const scopeOverridesLabelText = element.isConfigured ? localize("alsoConfiguredElsewhere", "Also modified elsewhere") : localize("configuredElsewhere", "Modified elsewhere");
        this.scopeOverridesIndicator.label.text = scopeOverridesLabelText;
        let contentMarkdownString = "";
        if (element.overriddenScopeList.length) {
          const prefaceText = element.isConfigured ? localize("alsoModifiedInScopes", "The setting has also been modified in the following scopes:") : localize("modifiedInScopes", "The setting has been modified in the following scopes:");
          contentMarkdownString = prefaceText;
          for (const scope of element.overriddenScopeList) {
            const scopeDisplayText = this.getInlineScopeDisplayText(scope);
            contentMarkdownString += `
- [${scopeDisplayText}](${encodeURIComponent(scope)} "${getAccessibleScopeDisplayText(scope, this.languageService)}")`;
          }
        }
        if (element.overriddenDefaultsLanguageList.length) {
          if (contentMarkdownString) {
            contentMarkdownString += `

`;
          }
          const prefaceText = localize("hasDefaultOverridesForLanguages", "The following languages have default overrides:");
          contentMarkdownString += prefaceText;
          for (const language of element.overriddenDefaultsLanguageList) {
            const scopeDisplayText = this.languageService.getLanguageName(language);
            contentMarkdownString += `
- [${scopeDisplayText}](${encodeURIComponent(`default:${language}`)} "${scopeDisplayText}")`;
          }
        }
        const content = {
          value: contentMarkdownString,
          isTrusted: false,
          supportHtml: false
        };
        this.scopeOverridesIndicator.disposables.add(this.hoverService.setupDelayedHover(this.scopeOverridesIndicator.element, () => ({
          ...this.defaultHoverOptions,
          content,
          linkHandler: (url) => {
            const [scope, language] = decodeURIComponent(url).split(":");
            onDidClickOverrideElement.fire({
              settingKey: element.setting.key,
              scope,
              language
            });
          }
        }), { setupKeyboardEvents: true }));
      }
    }
    this.render();
  }
  updateDefaultOverrideIndicator(element) {
    this.defaultOverrideIndicator.element.style.display = "none";
    let sourceToDisplay = getDefaultValueSourceToDisplay(element);
    if (sourceToDisplay !== void 0) {
      this.defaultOverrideIndicator.element.style.display = "inline";
      this.defaultOverrideIndicator.disposables.clear();
      if (Array.isArray(sourceToDisplay) && sourceToDisplay.length === 1) {
        sourceToDisplay = sourceToDisplay[0];
      }
      let defaultOverrideHoverContent;
      if (!Array.isArray(sourceToDisplay)) {
        defaultOverrideHoverContent = localize("defaultOverriddenDetails", "Default setting value overridden by `{0}`", sourceToDisplay);
      } else {
        sourceToDisplay = sourceToDisplay.map((source) => `\`${source}\``);
        defaultOverrideHoverContent = localize("multipledefaultOverriddenDetails", "A default values has been set by {0}", sourceToDisplay.slice(0, -1).join(", ") + " & " + sourceToDisplay.slice(-1));
      }
      const showHover = (focus) => {
        return this.hoverService.showInstantHover({
          content: new MarkdownString().appendMarkdown(defaultOverrideHoverContent),
          target: this.defaultOverrideIndicator.element,
          position: {
            hoverPosition: HoverPosition.BELOW
          },
          appearance: {
            showPointer: true,
            compact: false
          }
        }, focus);
      };
      this.addHoverDisposables(this.defaultOverrideIndicator.disposables, this.defaultOverrideIndicator.element, showHover);
    }
    this.render();
  }
};
SettingsTreeIndicatorsLabel = __decorateClass([
  __decorateParam(1, IWorkbenchConfigurationService),
  __decorateParam(2, IHoverService),
  __decorateParam(3, IUserDataSyncEnablementService),
  __decorateParam(4, ILanguageService),
  __decorateParam(5, ICommandService)
], SettingsTreeIndicatorsLabel);
function getDefaultValueSourceToDisplay(element) {
  let sourceToDisplay;
  const defaultValueSource = element.defaultValueSource;
  if (defaultValueSource) {
    if (defaultValueSource instanceof Map) {
      sourceToDisplay = [];
      for (const [, value] of defaultValueSource) {
        const newValue = typeof value !== "string" ? value.displayName ?? value.id : value;
        if (!sourceToDisplay.includes(newValue)) {
          sourceToDisplay.push(newValue);
        }
      }
    } else if (typeof defaultValueSource === "string") {
      sourceToDisplay = defaultValueSource;
    } else {
      sourceToDisplay = defaultValueSource.displayName ?? defaultValueSource.id;
    }
  }
  return sourceToDisplay;
}
function getAccessibleScopeDisplayText(completeScope, languageService) {
  const [scope, language] = completeScope.split(":");
  const localizedScope = scope === "user" ? localize("user", "User") : scope === "workspace" ? localize("workspace", "Workspace") : localize("remote", "Remote");
  if (language) {
    return localize("modifiedInScopeForLanguage", "The {0} scope for {1}", localizedScope, languageService.getLanguageName(language));
  }
  return localizedScope;
}
function getAccessibleScopeDisplayMidSentenceText(completeScope, languageService) {
  const [scope, language] = completeScope.split(":");
  const localizedScope = scope === "user" ? localize("user", "User") : scope === "workspace" ? localize("workspace", "Workspace") : localize("remote", "Remote");
  if (language) {
    return localize("modifiedInScopeForLanguageMidSentence", "the {0} scope for {1}", localizedScope.toLowerCase(), languageService.getLanguageName(language));
  }
  return localizedScope;
}
function getIndicatorsLabelAriaLabel(element, configurationService, userDataProfilesService, languageService) {
  const ariaLabelSections = [];
  if (element.tags?.has("preview")) {
    ariaLabelSections.push(localize("previewLabel", "Preview"));
  } else if (element.tags?.has("experimental")) {
    ariaLabelSections.push(localize("experimentalLabel", "Experimental"));
  }
  if (element.isUntrusted) {
    ariaLabelSections.push(localize("workspaceUntrustedAriaLabel", "Workspace untrusted; setting value not applied"));
  }
  if (element.hasPolicyValue) {
    ariaLabelSections.push(localize("policyDescriptionAccessible", "Managed by organization policy; setting value not applied"));
  } else if (element.settingsTarget === ConfigurationTarget.USER_LOCAL && configurationService.isSettingAppliedForAllProfiles(element.setting.key)) {
    ariaLabelSections.push(localize("applicationSettingDescriptionAccessible", "Setting value retained when switching profiles"));
  } else {
    const otherOverridesStart = element.isConfigured ? localize("alsoConfiguredIn", "Also modified in") : localize("configuredIn", "Modified in");
    const otherOverridesList = element.overriddenScopeList.map((scope) => getAccessibleScopeDisplayMidSentenceText(scope, languageService)).join(", ");
    if (element.overriddenScopeList.length) {
      ariaLabelSections.push(`${otherOverridesStart} ${otherOverridesList}`);
    }
  }
  if (cachedSyncIgnoredSettingsSet.has(element.setting.key)) {
    ariaLabelSections.push(localize("syncIgnoredAriaLabel", "Setting ignored during sync"));
  }
  let sourceToDisplay = getDefaultValueSourceToDisplay(element);
  if (sourceToDisplay !== void 0) {
    if (Array.isArray(sourceToDisplay) && sourceToDisplay.length === 1) {
      sourceToDisplay = sourceToDisplay[0];
    }
    let overriddenDetailsText;
    if (!Array.isArray(sourceToDisplay)) {
      overriddenDetailsText = localize("defaultOverriddenDetailsAriaLabel", "{0} overrides the default value", sourceToDisplay);
    } else {
      overriddenDetailsText = localize("multipleDefaultOverriddenDetailsAriaLabel", "{0} override the default value", sourceToDisplay.slice(0, -1).join(", ") + " & " + sourceToDisplay.slice(-1));
    }
    ariaLabelSections.push(overriddenDetailsText);
  }
  const otherLanguageOverridesList = element.overriddenDefaultsLanguageList.map((language) => languageService.getLanguageName(language)).join(", ");
  if (element.overriddenDefaultsLanguageList.length) {
    const otherLanguageOverridesText = localize("defaultOverriddenLanguagesList", "Language-specific default values exist for {0}", otherLanguageOverridesList);
    ariaLabelSections.push(otherLanguageOverridesText);
  }
  const ariaLabel = ariaLabelSections.join(". ");
  return ariaLabel;
}
export {
  SettingsTreeIndicatorsLabel,
  getIndicatorsLabelAriaLabel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wcmVmZXJlbmNlcy9icm93c2VyL3NldHRpbmdzRWRpdG9yU2V0dGluZ0luZGljYXRvcnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBET00gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIva2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBIb3ZlclBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyV2lkZ2V0LmpzJztcbmltcG9ydCB7IFNpbXBsZUljb25MYWJlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9pY29uTGFiZWwvc2ltcGxlSWNvbkxhYmVsLmpzJztcbmltcG9ydCB7IFJ1bk9uY2VTY2hlZHVsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSU1hcmtkb3duU3RyaW5nLCBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFTeW5jL2NvbW1vbi91c2VyRGF0YVN5bmMuanMnO1xuaW1wb3J0IHsgU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQgfSBmcm9tICcuL3NldHRpbmdzVHJlZU1vZGVscy5qcyc7XG5pbXBvcnQgeyBFWFBFUklNRU5UQUxfSU5ESUNBVE9SX0RFU0NSSVBUSU9OLCBQT0xJQ1lfU0VUVElOR19UQUcsIFBSRVZJRVdfSU5ESUNBVE9SX0RFU0NSSVBUSU9OIH0gZnJvbSAnLi4vY29tbW9uL3ByZWZlcmVuY2VzLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHR5cGUgeyBJSG92ZXJPcHRpb25zLCBJSG92ZXJXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXIuanMnO1xuXG5jb25zdCAkID0gRE9NLiQ7XG5cbnR5cGUgU2NvcGVTdHJpbmcgPSAnd29ya3NwYWNlJyB8ICd1c2VyJyB8ICdyZW1vdGUnIHwgJ2RlZmF1bHQnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElTZXR0aW5nT3ZlcnJpZGVDbGlja0V2ZW50IHtcblx0c2NvcGU6IFNjb3BlU3RyaW5nO1xuXHRsYW5ndWFnZTogc3RyaW5nO1xuXHRzZXR0aW5nS2V5OiBzdHJpbmc7XG59XG5cbmludGVyZmFjZSBTZXR0aW5nSW5kaWNhdG9yIHtcblx0ZWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdC8qKlxuXHQgKiBUaGUgZWxlbWVudCB0byBmb2N1cyBvbiB3aGVuIG5hdmlnYXRpbmcgd2l0aCBrZXlib2FyZC5cblx0ICogV2hlbiB1bmRlZmluZWQsIHVzZSB7QGxpbmsgZWxlbWVudH0gaW5zdGVhZC5cblx0ICovXG5cdGZvY3VzRWxlbWVudD86IEhUTUxFbGVtZW50O1xuXHRsYWJlbDogU2ltcGxlSWNvbkxhYmVsO1xuXHRkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xufVxuXG4vKipcbiAqIENvbnRhaW5zIGEgc2V0IG9mIHRoZSBzeW5jLWlnbm9yZWQgc2V0dGluZ3NcbiAqIHRvIGtlZXAgdGhlIHN5bmMgaWdub3JlZCBpbmRpY2F0b3IgYW5kIHRoZSBnZXRJbmRpY2F0b3JzTGFiZWxBcmlhTGFiZWwoKSBmdW5jdGlvbiBpbiBzeW5jLlxuICogU2V0dGluZ3NUcmVlSW5kaWNhdG9yc0xhYmVsI3VwZGF0ZVN5bmNJZ25vcmVkIHByb3ZpZGVzIHRoZSBzb3VyY2Ugb2YgdHJ1dGguXG4gKi9cbmxldCBjYWNoZWRTeW5jSWdub3JlZFNldHRpbmdzU2V0OiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG4vKipcbiAqIENvbnRhaW5zIGEgY29weSBvZiB0aGUgc3luYy1pZ25vcmVkIHNldHRpbmdzIHRvIGRldGVybWluZSB3aGVuIHRvIHVwZGF0ZVxuICogY2FjaGVkU3luY0lnbm9yZWRTZXR0aW5nc1NldC5cbiAqL1xubGV0IGNhY2hlZFN5bmNJZ25vcmVkU2V0dGluZ3M6IHN0cmluZ1tdID0gW107XG5cbi8qKlxuICogUmVuZGVycyB0aGUgaW5kaWNhdG9ycyBuZXh0IHRvIGEgc2V0dGluZywgc3VjaCBhcyBcIkFsc28gTW9kaWZpZWQgSW5cIi5cbiAqL1xuZXhwb3J0IGNsYXNzIFNldHRpbmdzVHJlZUluZGljYXRvcnNMYWJlbCBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBpbmRpY2F0b3JzQ29udGFpbmVyRWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBwcmV2aWV3SW5kaWNhdG9yOiBTZXR0aW5nSW5kaWNhdG9yO1xuXHRwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZVRydXN0SW5kaWNhdG9yOiBTZXR0aW5nSW5kaWNhdG9yO1xuXHRwcml2YXRlIHJlYWRvbmx5IHNjb3BlT3ZlcnJpZGVzSW5kaWNhdG9yOiBTZXR0aW5nSW5kaWNhdG9yO1xuXHRwcml2YXRlIHJlYWRvbmx5IHN5bmNJZ25vcmVkSW5kaWNhdG9yOiBTZXR0aW5nSW5kaWNhdG9yO1xuXHRwcml2YXRlIHJlYWRvbmx5IGRlZmF1bHRPdmVycmlkZUluZGljYXRvcjogU2V0dGluZ0luZGljYXRvcjtcblxuXHQvKiogSW5kaWNhdG9ycyB0aGF0IGVhY2ggaGF2ZSB0aGVpciBvd24gc3F1YXJlIGNvbnRhaW5lciBhdCB0aGUgdG9wLXJpZ2h0IG9mIHRoZSBzZXR0aW5nICovXG5cdHByaXZhdGUgcmVhZG9ubHkgaXNvbGF0ZWRJbmRpY2F0b3JzOiBTZXR0aW5nSW5kaWNhdG9yW10gPSBbXTtcblx0LyoqIEluZGljYXRvcnMgdGhhdCBlbmQgdXAgd3JhcHBlZCBpbiBhIHBhcmVudGhlc2lzIGF0IHRoZSB0b3AtcmlnaHQgb2YgdGhlIHNldHRpbmcgKi9cblx0cHJpdmF0ZSByZWFkb25seSBwYXJlbnRoZXNpemVkSW5kaWNhdG9yczogU2V0dGluZ0luZGljYXRvcltdO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkga2V5YmluZGluZ0xpc3RlbmVyczogRGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIGZvY3VzZWRJbmRleCA9IDA7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Y29udGFpbmVyOiBIVE1MRWxlbWVudCxcblx0XHRASVdvcmtiZW5jaENvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElXb3JrYmVuY2hDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUhvdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGhvdmVyU2VydmljZTogSUhvdmVyU2VydmljZSxcblx0XHRASVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2U6IElVc2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSkge1xuXHRcdHRoaXMuaW5kaWNhdG9yc0NvbnRhaW5lckVsZW1lbnQgPSBET00uYXBwZW5kKGNvbnRhaW5lciwgJCgnLnNldHRpbmctaW5kaWNhdG9ycy1jb250YWluZXInKSk7XG5cdFx0dGhpcy5pbmRpY2F0b3JzQ29udGFpbmVyRWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG5cblx0XHR0aGlzLnByZXZpZXdJbmRpY2F0b3IgPSB0aGlzLmNyZWF0ZVByZXZpZXdJbmRpY2F0b3IoKTtcblx0XHR0aGlzLmlzb2xhdGVkSW5kaWNhdG9ycyA9IFt0aGlzLnByZXZpZXdJbmRpY2F0b3JdO1xuXG5cdFx0dGhpcy53b3Jrc3BhY2VUcnVzdEluZGljYXRvciA9IHRoaXMuY3JlYXRlV29ya3NwYWNlVHJ1c3RJbmRpY2F0b3IoKTtcblx0XHR0aGlzLnNjb3BlT3ZlcnJpZGVzSW5kaWNhdG9yID0gdGhpcy5jcmVhdGVTY29wZU92ZXJyaWRlc0luZGljYXRvcigpO1xuXHRcdHRoaXMuc3luY0lnbm9yZWRJbmRpY2F0b3IgPSB0aGlzLmNyZWF0ZVN5bmNJZ25vcmVkSW5kaWNhdG9yKCk7XG5cdFx0dGhpcy5kZWZhdWx0T3ZlcnJpZGVJbmRpY2F0b3IgPSB0aGlzLmNyZWF0ZURlZmF1bHRPdmVycmlkZUluZGljYXRvcigpO1xuXHRcdHRoaXMucGFyZW50aGVzaXplZEluZGljYXRvcnMgPSBbdGhpcy53b3Jrc3BhY2VUcnVzdEluZGljYXRvciwgdGhpcy5zY29wZU92ZXJyaWRlc0luZGljYXRvciwgdGhpcy5zeW5jSWdub3JlZEluZGljYXRvciwgdGhpcy5kZWZhdWx0T3ZlcnJpZGVJbmRpY2F0b3JdO1xuXHR9XG5cblx0cHJpdmF0ZSBkZWZhdWx0SG92ZXJPcHRpb25zOiBQYXJ0aWFsPElIb3Zlck9wdGlvbnM+ID0ge1xuXHRcdHRyYXBGb2N1czogdHJ1ZSxcblx0XHRwb3NpdGlvbjoge1xuXHRcdFx0aG92ZXJQb3NpdGlvbjogSG92ZXJQb3NpdGlvbi5CRUxPVyxcblx0XHR9LFxuXHRcdGFwcGVhcmFuY2U6IHtcblx0XHRcdHNob3dQb2ludGVyOiB0cnVlLFxuXHRcdFx0Y29tcGFjdDogZmFsc2UsXG5cdFx0fVxuXHR9O1xuXG5cdHByaXZhdGUgYWRkSG92ZXJEaXNwb3NhYmxlcyhkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlLCBlbGVtZW50OiBIVE1MRWxlbWVudCwgc2hvd0hvdmVyOiAoZm9jdXM6IGJvb2xlYW4pID0+IElIb3ZlcldpZGdldCB8IHVuZGVmaW5lZCkge1xuXHRcdGRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0Y29uc3Qgc2NoZWR1bGVyOiBSdW5PbmNlU2NoZWR1bGVyID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHtcblx0XHRcdGNvbnN0IGhvdmVyID0gc2hvd0hvdmVyKGZhbHNlKTtcblx0XHRcdGlmIChob3Zlcikge1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQoaG92ZXIpO1xuXHRcdFx0fVxuXHRcdH0sIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8bnVtYmVyPignd29ya2JlbmNoLmhvdmVyLmRlbGF5JykpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoRE9NLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihlbGVtZW50LCBET00uRXZlbnRUeXBlLk1PVVNFX09WRVIsICgpID0+IHtcblx0XHRcdGlmICghc2NoZWR1bGVyLmlzU2NoZWR1bGVkKCkpIHtcblx0XHRcdFx0c2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGVsZW1lbnQsIERPTS5FdmVudFR5cGUuTU9VU0VfTEVBVkUsICgpID0+IHtcblx0XHRcdHNjaGVkdWxlci5jYW5jZWwoKTtcblx0XHR9KSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIoZWxlbWVudCwgRE9NLkV2ZW50VHlwZS5LRVlfRE9XTiwgKGUpID0+IHtcblx0XHRcdGNvbnN0IGV2dCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cdFx0XHRpZiAoZXZ0LmVxdWFscyhLZXlDb2RlLlNwYWNlKSB8fCBldnQuZXF1YWxzKEtleUNvZGUuRW50ZXIpKSB7XG5cdFx0XHRcdGNvbnN0IGhvdmVyID0gc2hvd0hvdmVyKHRydWUpO1xuXHRcdFx0XHRpZiAoaG92ZXIpIHtcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQoaG92ZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVdvcmtzcGFjZVRydXN0SW5kaWNhdG9yKCk6IFNldHRpbmdJbmRpY2F0b3Ige1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IHdvcmtzcGFjZVRydXN0RWxlbWVudCA9ICQoJ3NwYW4uc2V0dGluZy1pbmRpY2F0b3Iuc2V0dGluZy1pdGVtLXdvcmtzcGFjZS10cnVzdCcpO1xuXHRcdGNvbnN0IHdvcmtzcGFjZVRydXN0TGFiZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFNpbXBsZUljb25MYWJlbCh3b3Jrc3BhY2VUcnVzdEVsZW1lbnQpKTtcblx0XHR3b3Jrc3BhY2VUcnVzdExhYmVsLnRleHQgPSAnJChzaGllbGQpICcgKyBsb2NhbGl6ZSgnd29ya3NwYWNlVW50cnVzdGVkTGFiZWwnLCBcIlJlcXVpcmVzIHdvcmtzcGFjZSB0cnVzdFwiKTtcblxuXHRcdGNvbnN0IGNvbnRlbnQgPSBsb2NhbGl6ZSgndHJ1c3RMYWJlbCcsIFwiVGhlIHNldHRpbmcgdmFsdWUgY2FuIG9ubHkgYmUgYXBwbGllZCBpbiBhIHRydXN0ZWQgd29ya3NwYWNlLlwiKTtcblx0XHRjb25zdCBzaG93SG92ZXIgPSAoZm9jdXM6IGJvb2xlYW4pID0+IHtcblx0XHRcdHJldHVybiB0aGlzLmhvdmVyU2VydmljZS5zaG93SW5zdGFudEhvdmVyKHtcblx0XHRcdFx0Li4udGhpcy5kZWZhdWx0SG92ZXJPcHRpb25zLFxuXHRcdFx0XHRjb250ZW50LFxuXHRcdFx0XHR0YXJnZXQ6IHdvcmtzcGFjZVRydXN0RWxlbWVudCxcblx0XHRcdFx0YWN0aW9uczogW3tcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ21hbmFnZVdvcmtzcGFjZVRydXN0JywgXCJNYW5hZ2UgV29ya3NwYWNlIFRydXN0XCIpLFxuXHRcdFx0XHRcdGNvbW1hbmRJZDogJ3dvcmtiZW5jaC50cnVzdC5tYW5hZ2UnLFxuXHRcdFx0XHRcdHJ1bjogKHRhcmdldDogSFRNTEVsZW1lbnQpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoJ3dvcmtiZW5jaC50cnVzdC5tYW5hZ2UnKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1dLFxuXHRcdFx0fSwgZm9jdXMpO1xuXHRcdH07XG5cdFx0dGhpcy5hZGRIb3ZlckRpc3Bvc2FibGVzKGRpc3Bvc2FibGVzLCB3b3Jrc3BhY2VUcnVzdEVsZW1lbnQsIHNob3dIb3Zlcik7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGVsZW1lbnQ6IHdvcmtzcGFjZVRydXN0RWxlbWVudCxcblx0XHRcdGxhYmVsOiB3b3Jrc3BhY2VUcnVzdExhYmVsLFxuXHRcdFx0ZGlzcG9zYWJsZXNcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVTY29wZU92ZXJyaWRlc0luZGljYXRvcigpOiBTZXR0aW5nSW5kaWNhdG9yIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHQvLyBEb24ndCBhZGQgLnNldHRpbmctaW5kaWNhdG9yIGNsYXNzIGhlcmUsIGJlY2F1c2UgaXQgZ2V0cyBjb25kaXRpb25hbGx5IGFkZGVkIGxhdGVyLlxuXHRcdGNvbnN0IG90aGVyT3ZlcnJpZGVzRWxlbWVudCA9ICQoJ3NwYW4uc2V0dGluZy1pdGVtLW92ZXJyaWRlcycpO1xuXHRcdGNvbnN0IG90aGVyT3ZlcnJpZGVzTGFiZWwgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFNpbXBsZUljb25MYWJlbChvdGhlck92ZXJyaWRlc0VsZW1lbnQpKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZWxlbWVudDogb3RoZXJPdmVycmlkZXNFbGVtZW50LFxuXHRcdFx0bGFiZWw6IG90aGVyT3ZlcnJpZGVzTGFiZWwsXG5cdFx0XHRkaXNwb3NhYmxlc1xuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVN5bmNJZ25vcmVkSW5kaWNhdG9yKCk6IFNldHRpbmdJbmRpY2F0b3Ige1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IHN5bmNJZ25vcmVkRWxlbWVudCA9ICQoJ3NwYW4uc2V0dGluZy1pbmRpY2F0b3Iuc2V0dGluZy1pdGVtLWlnbm9yZWQnKTtcblx0XHRjb25zdCBzeW5jSWdub3JlZExhYmVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBTaW1wbGVJY29uTGFiZWwoc3luY0lnbm9yZWRFbGVtZW50KSk7XG5cdFx0c3luY0lnbm9yZWRMYWJlbC50ZXh0ID0gbG9jYWxpemUoJ2V4dGVuc2lvblN5bmNJZ25vcmVkTGFiZWwnLCAnTm90IHN5bmNlZCcpO1xuXG5cdFx0Y29uc3Qgc3luY0lnbm9yZWRIb3ZlckNvbnRlbnQgPSBsb2NhbGl6ZSgnc3luY0lnbm9yZWRUaXRsZScsIFwiVGhpcyBzZXR0aW5nIGlzIGlnbm9yZWQgZHVyaW5nIHN5bmNcIik7XG5cdFx0Y29uc3Qgc2hvd0hvdmVyID0gKGZvY3VzOiBib29sZWFuKSA9PiB7XG5cdFx0XHRyZXR1cm4gdGhpcy5ob3ZlclNlcnZpY2Uuc2hvd0luc3RhbnRIb3Zlcih7XG5cdFx0XHRcdC4uLnRoaXMuZGVmYXVsdEhvdmVyT3B0aW9ucyxcblx0XHRcdFx0Y29udGVudDogc3luY0lnbm9yZWRIb3ZlckNvbnRlbnQsXG5cdFx0XHRcdHRhcmdldDogc3luY0lnbm9yZWRFbGVtZW50XG5cdFx0XHR9LCBmb2N1cyk7XG5cdFx0fTtcblx0XHR0aGlzLmFkZEhvdmVyRGlzcG9zYWJsZXMoZGlzcG9zYWJsZXMsIHN5bmNJZ25vcmVkRWxlbWVudCwgc2hvd0hvdmVyKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRlbGVtZW50OiBzeW5jSWdub3JlZEVsZW1lbnQsXG5cdFx0XHRsYWJlbDogc3luY0lnbm9yZWRMYWJlbCxcblx0XHRcdGRpc3Bvc2FibGVzXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlRGVmYXVsdE92ZXJyaWRlSW5kaWNhdG9yKCk6IFNldHRpbmdJbmRpY2F0b3Ige1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGRlZmF1bHRPdmVycmlkZUluZGljYXRvciA9ICQoJ3NwYW4uc2V0dGluZy1pbmRpY2F0b3Iuc2V0dGluZy1pdGVtLWRlZmF1bHQtb3ZlcnJpZGRlbicpO1xuXHRcdGNvbnN0IGRlZmF1bHRPdmVycmlkZUxhYmVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBTaW1wbGVJY29uTGFiZWwoZGVmYXVsdE92ZXJyaWRlSW5kaWNhdG9yKSk7XG5cdFx0ZGVmYXVsdE92ZXJyaWRlTGFiZWwudGV4dCA9IGxvY2FsaXplKCdkZWZhdWx0T3ZlcnJpZGRlbkxhYmVsJywgXCJEZWZhdWx0IHZhbHVlIGNoYW5nZWRcIik7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZWxlbWVudDogZGVmYXVsdE92ZXJyaWRlSW5kaWNhdG9yLFxuXHRcdFx0bGFiZWw6IGRlZmF1bHRPdmVycmlkZUxhYmVsLFxuXHRcdFx0ZGlzcG9zYWJsZXNcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVQcmV2aWV3SW5kaWNhdG9yKCk6IFNldHRpbmdJbmRpY2F0b3Ige1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IHByZXZpZXdJbmRpY2F0b3IgPSAkKCdzcGFuLnNldHRpbmctaW5kaWNhdG9yLnNldHRpbmctaXRlbS1wcmV2aWV3Jyk7XG5cdFx0Y29uc3QgcHJldmlld0xhYmVsID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBTaW1wbGVJY29uTGFiZWwocHJldmlld0luZGljYXRvcikpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGVsZW1lbnQ6IHByZXZpZXdJbmRpY2F0b3IsXG5cdFx0XHRsYWJlbDogcHJldmlld0xhYmVsLFxuXHRcdFx0ZGlzcG9zYWJsZXNcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXIoKSB7XG5cdFx0dGhpcy5pbmRpY2F0b3JzQ29udGFpbmVyRWxlbWVudC5pbm5lclRleHQgPSAnJztcblx0XHR0aGlzLmluZGljYXRvcnNDb250YWluZXJFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnbm9uZSc7XG5cblx0XHRjb25zdCBpc29sYXRlZEluZGljYXRvcnNUb1Nob3cgPSB0aGlzLmlzb2xhdGVkSW5kaWNhdG9ycy5maWx0ZXIoaW5kaWNhdG9yID0+IHtcblx0XHRcdHJldHVybiBpbmRpY2F0b3IuZWxlbWVudC5zdHlsZS5kaXNwbGF5ICE9PSAnbm9uZSc7XG5cdFx0fSk7XG5cdFx0aWYgKGlzb2xhdGVkSW5kaWNhdG9yc1RvU2hvdy5sZW5ndGgpIHtcblx0XHRcdHRoaXMuaW5kaWNhdG9yc0NvbnRhaW5lckVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUnO1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBpc29sYXRlZEluZGljYXRvcnNUb1Nob3cubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0RE9NLmFwcGVuZCh0aGlzLmluZGljYXRvcnNDb250YWluZXJFbGVtZW50LCBpc29sYXRlZEluZGljYXRvcnNUb1Nob3dbaV0uZWxlbWVudCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGFyZW50aGVzaXplZEluZGljYXRvcnNUb1Nob3cgPSB0aGlzLnBhcmVudGhlc2l6ZWRJbmRpY2F0b3JzLmZpbHRlcihpbmRpY2F0b3IgPT4ge1xuXHRcdFx0cmV0dXJuIGluZGljYXRvci5lbGVtZW50LnN0eWxlLmRpc3BsYXkgIT09ICdub25lJztcblx0XHR9KTtcblx0XHRpZiAocGFyZW50aGVzaXplZEluZGljYXRvcnNUb1Nob3cubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLmluZGljYXRvcnNDb250YWluZXJFbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcblx0XHRcdERPTS5hcHBlbmQodGhpcy5pbmRpY2F0b3JzQ29udGFpbmVyRWxlbWVudCwgJCgnc3BhbicsIHVuZGVmaW5lZCwgJygnKSk7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHBhcmVudGhlc2l6ZWRJbmRpY2F0b3JzVG9TaG93Lmxlbmd0aCAtIDE7IGkrKykge1xuXHRcdFx0XHRET00uYXBwZW5kKHRoaXMuaW5kaWNhdG9yc0NvbnRhaW5lckVsZW1lbnQsIHBhcmVudGhlc2l6ZWRJbmRpY2F0b3JzVG9TaG93W2ldLmVsZW1lbnQpO1xuXHRcdFx0XHRET00uYXBwZW5kKHRoaXMuaW5kaWNhdG9yc0NvbnRhaW5lckVsZW1lbnQsICQoJ3NwYW4uY29tbWEnLCB1bmRlZmluZWQsICcgXHUyMDIyICcpKTtcblx0XHRcdH1cblx0XHRcdERPTS5hcHBlbmQodGhpcy5pbmRpY2F0b3JzQ29udGFpbmVyRWxlbWVudCwgcGFyZW50aGVzaXplZEluZGljYXRvcnNUb1Nob3dbcGFyZW50aGVzaXplZEluZGljYXRvcnNUb1Nob3cubGVuZ3RoIC0gMV0uZWxlbWVudCk7XG5cdFx0XHRET00uYXBwZW5kKHRoaXMuaW5kaWNhdG9yc0NvbnRhaW5lckVsZW1lbnQsICQoJ3NwYW4nLCB1bmRlZmluZWQsICcpJykpO1xuXHRcdH1cblx0XHR0aGlzLnJlc2V0SW5kaWNhdG9yTmF2aWdhdGlvbktleUJpbmRpbmdzKFsuLi5pc29sYXRlZEluZGljYXRvcnNUb1Nob3csIC4uLnBhcmVudGhlc2l6ZWRJbmRpY2F0b3JzVG9TaG93XSk7XG5cdH1cblxuXHRwcml2YXRlIHJlc2V0SW5kaWNhdG9yTmF2aWdhdGlvbktleUJpbmRpbmdzKGluZGljYXRvcnM6IFNldHRpbmdJbmRpY2F0b3JbXSkge1xuXHRcdHRoaXMua2V5YmluZGluZ0xpc3RlbmVycy5jbGVhcigpO1xuXHRcdHRoaXMuaW5kaWNhdG9yc0NvbnRhaW5lckVsZW1lbnQucm9sZSA9IGluZGljYXRvcnMubGVuZ3RoID49IDEgPyAndG9vbGJhcicgOiAnYnV0dG9uJztcblx0XHRpZiAoIWluZGljYXRvcnMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGZpcnN0RWxlbWVudCA9IGluZGljYXRvcnNbMF0uZm9jdXNFbGVtZW50ID8/IGluZGljYXRvcnNbMF0uZWxlbWVudDtcblx0XHRmaXJzdEVsZW1lbnQudGFiSW5kZXggPSAwO1xuXHRcdHRoaXMua2V5YmluZGluZ0xpc3RlbmVycy5hZGQoRE9NLmFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLmluZGljYXRvcnNDb250YWluZXJFbGVtZW50LCAna2V5ZG93bicsIChlKSA9PiB7XG5cdFx0XHRjb25zdCBldiA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cdFx0XHRsZXQgaGFuZGxlZCA9IHRydWU7XG5cdFx0XHRpZiAoZXYuZXF1YWxzKEtleUNvZGUuSG9tZSkpIHtcblx0XHRcdFx0dGhpcy5mb2N1c0luZGljYXRvckF0KGluZGljYXRvcnMsIDApO1xuXHRcdFx0fSBlbHNlIGlmIChldi5lcXVhbHMoS2V5Q29kZS5FbmQpKSB7XG5cdFx0XHRcdHRoaXMuZm9jdXNJbmRpY2F0b3JBdChpbmRpY2F0b3JzLCBpbmRpY2F0b3JzLmxlbmd0aCAtIDEpO1xuXHRcdFx0fSBlbHNlIGlmIChldi5lcXVhbHMoS2V5Q29kZS5SaWdodEFycm93KSkge1xuXHRcdFx0XHRjb25zdCBpbmRleFRvRm9jdXMgPSAodGhpcy5mb2N1c2VkSW5kZXggKyAxKSAlIGluZGljYXRvcnMubGVuZ3RoO1xuXHRcdFx0XHR0aGlzLmZvY3VzSW5kaWNhdG9yQXQoaW5kaWNhdG9ycywgaW5kZXhUb0ZvY3VzKTtcblx0XHRcdH0gZWxzZSBpZiAoZXYuZXF1YWxzKEtleUNvZGUuTGVmdEFycm93KSkge1xuXHRcdFx0XHRjb25zdCBpbmRleFRvRm9jdXMgPSB0aGlzLmZvY3VzZWRJbmRleCA/IHRoaXMuZm9jdXNlZEluZGV4IC0gMSA6IGluZGljYXRvcnMubGVuZ3RoIC0gMTtcblx0XHRcdFx0dGhpcy5mb2N1c0luZGljYXRvckF0KGluZGljYXRvcnMsIGluZGV4VG9Gb2N1cyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRoYW5kbGVkID0gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChoYW5kbGVkKSB7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGZvY3VzSW5kaWNhdG9yQXQoaW5kaWNhdG9yczogU2V0dGluZ0luZGljYXRvcltdLCBpbmRleDogbnVtYmVyKSB7XG5cdFx0aWYgKGluZGV4ID09PSB0aGlzLmZvY3VzZWRJbmRleCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBpbmRpY2F0b3IgPSBpbmRpY2F0b3JzW2luZGV4XTtcblx0XHRjb25zdCBlbGVtZW50VG9Gb2N1cyA9IGluZGljYXRvci5mb2N1c0VsZW1lbnQgPz8gaW5kaWNhdG9yLmVsZW1lbnQ7XG5cdFx0ZWxlbWVudFRvRm9jdXMudGFiSW5kZXggPSAwO1xuXHRcdGVsZW1lbnRUb0ZvY3VzLmZvY3VzKCk7XG5cblx0XHRjb25zdCBjdXJyZW50bHlGb2N1c2VkSW5kaWNhdG9yID0gaW5kaWNhdG9yc1t0aGlzLmZvY3VzZWRJbmRleF07XG5cdFx0Y29uc3QgcHJldmlvdXNGb2N1c2VkRWxlbWVudCA9IGN1cnJlbnRseUZvY3VzZWRJbmRpY2F0b3IuZm9jdXNFbGVtZW50ID8/IGN1cnJlbnRseUZvY3VzZWRJbmRpY2F0b3IuZWxlbWVudDtcblx0XHRwcmV2aW91c0ZvY3VzZWRFbGVtZW50LnRhYkluZGV4ID0gLTE7XG5cblx0XHR0aGlzLmZvY3VzZWRJbmRleCA9IGluZGV4O1xuXHR9XG5cblx0dXBkYXRlV29ya3NwYWNlVHJ1c3QoZWxlbWVudDogU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQpIHtcblx0XHR0aGlzLndvcmtzcGFjZVRydXN0SW5kaWNhdG9yLmVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IGVsZW1lbnQuaXNVbnRydXN0ZWQgPyAnaW5saW5lJyA6ICdub25lJztcblx0XHR0aGlzLnJlbmRlcigpO1xuXHR9XG5cblx0dXBkYXRlU3luY0lnbm9yZWQoZWxlbWVudDogU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQsIGlnbm9yZWRTZXR0aW5nczogc3RyaW5nW10pIHtcblx0XHR0aGlzLnN5bmNJZ25vcmVkSW5kaWNhdG9yLmVsZW1lbnQuc3R5bGUuZGlzcGxheSA9IHRoaXMudXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UuaXNFbmFibGVkKClcblx0XHRcdCYmIGlnbm9yZWRTZXR0aW5ncy5pbmNsdWRlcyhlbGVtZW50LnNldHRpbmcua2V5KSA/ICdpbmxpbmUnIDogJ25vbmUnO1xuXHRcdHRoaXMucmVuZGVyKCk7XG5cdFx0aWYgKGNhY2hlZFN5bmNJZ25vcmVkU2V0dGluZ3MgIT09IGlnbm9yZWRTZXR0aW5ncykge1xuXHRcdFx0Y2FjaGVkU3luY0lnbm9yZWRTZXR0aW5ncyA9IGlnbm9yZWRTZXR0aW5ncztcblx0XHRcdGNhY2hlZFN5bmNJZ25vcmVkU2V0dGluZ3NTZXQgPSBuZXcgU2V0PHN0cmluZz4oY2FjaGVkU3luY0lnbm9yZWRTZXR0aW5ncyk7XG5cdFx0fVxuXHR9XG5cblx0dXBkYXRlUHJldmlld0luZGljYXRvcihlbGVtZW50OiBTZXR0aW5nc1RyZWVTZXR0aW5nRWxlbWVudCkge1xuXHRcdGNvbnN0IGlzUHJldmlld1NldHRpbmcgPSBlbGVtZW50LnRhZ3M/LmhhcygncHJldmlldycpO1xuXHRcdGNvbnN0IGlzRXhwZXJpbWVudGFsU2V0dGluZyA9IGVsZW1lbnQudGFncz8uaGFzKCdleHBlcmltZW50YWwnKTtcblx0XHR0aGlzLnByZXZpZXdJbmRpY2F0b3IuZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gKGlzUHJldmlld1NldHRpbmcgfHwgaXNFeHBlcmltZW50YWxTZXR0aW5nKSA/ICdpbmxpbmUnIDogJ25vbmUnO1xuXHRcdHRoaXMucHJldmlld0luZGljYXRvci5sYWJlbC50ZXh0ID0gaXNQcmV2aWV3U2V0dGluZyA/XG5cdFx0XHRsb2NhbGl6ZSgncHJldmlld0xhYmVsJywgXCJQcmV2aWV3XCIpIDpcblx0XHRcdGxvY2FsaXplKCdleHBlcmltZW50YWxMYWJlbCcsIFwiRXhwZXJpbWVudGFsXCIpO1xuXG5cdFx0Y29uc3QgY29udGVudCA9IGlzUHJldmlld1NldHRpbmcgPyBQUkVWSUVXX0lORElDQVRPUl9ERVNDUklQVElPTiA6IEVYUEVSSU1FTlRBTF9JTkRJQ0FUT1JfREVTQ1JJUFRJT047XG5cdFx0Y29uc3Qgc2hvd0hvdmVyID0gKGZvY3VzOiBib29sZWFuKSA9PiB7XG5cdFx0XHRyZXR1cm4gdGhpcy5ob3ZlclNlcnZpY2Uuc2hvd0luc3RhbnRIb3Zlcih7XG5cdFx0XHRcdC4uLnRoaXMuZGVmYXVsdEhvdmVyT3B0aW9ucyxcblx0XHRcdFx0Y29udGVudCxcblx0XHRcdFx0dGFyZ2V0OiB0aGlzLnByZXZpZXdJbmRpY2F0b3IuZWxlbWVudFxuXHRcdFx0fSwgZm9jdXMpO1xuXHRcdH07XG5cdFx0dGhpcy5hZGRIb3ZlckRpc3Bvc2FibGVzKHRoaXMucHJldmlld0luZGljYXRvci5kaXNwb3NhYmxlcywgdGhpcy5wcmV2aWV3SW5kaWNhdG9yLmVsZW1lbnQsIHNob3dIb3Zlcik7XG5cblx0XHR0aGlzLnJlbmRlcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRJbmxpbmVTY29wZURpc3BsYXlUZXh0KGNvbXBsZXRlU2NvcGU6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3QgW3Njb3BlLCBsYW5ndWFnZV0gPSBjb21wbGV0ZVNjb3BlLnNwbGl0KCc6Jyk7XG5cdFx0Y29uc3QgbG9jYWxpemVkU2NvcGUgPSBzY29wZSA9PT0gJ3VzZXInID9cblx0XHRcdGxvY2FsaXplKCd1c2VyJywgXCJVc2VyXCIpIDogc2NvcGUgPT09ICd3b3Jrc3BhY2UnID9cblx0XHRcdFx0bG9jYWxpemUoJ3dvcmtzcGFjZScsIFwiV29ya3NwYWNlXCIpIDogbG9jYWxpemUoJ3JlbW90ZScsIFwiUmVtb3RlXCIpO1xuXHRcdGlmIChsYW5ndWFnZSkge1xuXHRcdFx0cmV0dXJuIGAke3RoaXMubGFuZ3VhZ2VTZXJ2aWNlLmdldExhbmd1YWdlTmFtZShsYW5ndWFnZSl9ID4gJHtsb2NhbGl6ZWRTY29wZX1gO1xuXHRcdH1cblx0XHRyZXR1cm4gbG9jYWxpemVkU2NvcGU7XG5cdH1cblxuXHRkaXNwb3NlKCkge1xuXHRcdHRoaXMua2V5YmluZGluZ0xpc3RlbmVycy5kaXNwb3NlKCk7XG5cdFx0Zm9yIChjb25zdCBpbmRpY2F0b3Igb2YgdGhpcy5pc29sYXRlZEluZGljYXRvcnMpIHtcblx0XHRcdGluZGljYXRvci5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0fVxuXHRcdGZvciAoY29uc3QgaW5kaWNhdG9yIG9mIHRoaXMucGFyZW50aGVzaXplZEluZGljYXRvcnMpIHtcblx0XHRcdGluZGljYXRvci5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9XG5cblx0dXBkYXRlU2NvcGVPdmVycmlkZXMoZWxlbWVudDogU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQsIG9uRGlkQ2xpY2tPdmVycmlkZUVsZW1lbnQ6IEVtaXR0ZXI8SVNldHRpbmdPdmVycmlkZUNsaWNrRXZlbnQ+LCBvbkFwcGx5RmlsdGVyOiBFbWl0dGVyPHN0cmluZz4pIHtcblx0XHR0aGlzLnNjb3BlT3ZlcnJpZGVzSW5kaWNhdG9yLmRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0dGhpcy5zY29wZU92ZXJyaWRlc0luZGljYXRvci5lbGVtZW50LmlubmVyVGV4dCA9ICcnO1xuXHRcdHRoaXMuc2NvcGVPdmVycmlkZXNJbmRpY2F0b3IuZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdHRoaXMuc2NvcGVPdmVycmlkZXNJbmRpY2F0b3IuZm9jdXNFbGVtZW50ID0gdGhpcy5zY29wZU92ZXJyaWRlc0luZGljYXRvci5lbGVtZW50O1xuXHRcdGlmIChlbGVtZW50Lmhhc1BvbGljeVZhbHVlKSB7XG5cdFx0XHQvLyBJZiB0aGUgc2V0dGluZyBmYWxscyB1bmRlciBhIHBvbGljeSwgdGhlbiBubyBtYXR0ZXIgd2hhdCB0aGUgdXNlciBzZXRzLCB0aGUgcG9saWN5IHZhbHVlIHRha2VzIGVmZmVjdC5cblx0XHRcdHRoaXMuc2NvcGVPdmVycmlkZXNJbmRpY2F0b3IuZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ2lubGluZSc7XG5cdFx0XHR0aGlzLnNjb3BlT3ZlcnJpZGVzSW5kaWNhdG9yLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnc2V0dGluZy1pbmRpY2F0b3InKTtcblxuXHRcdFx0dGhpcy5zY29wZU92ZXJyaWRlc0luZGljYXRvci5sYWJlbC50ZXh0ID0gJyQoYnJpZWZjYXNlKSAnICsgbG9jYWxpemUoJ3BvbGljeUxhYmVsVGV4dCcsIFwiTWFuYWdlZCBieSBvcmdhbml6YXRpb25cIik7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gbG9jYWxpemUoJ3BvbGljeURlc2NyaXB0aW9uJywgXCJUaGlzIHNldHRpbmcgaXMgbWFuYWdlZCBieSB5b3VyIG9yZ2FuaXphdGlvbiBhbmQgaXRzIGFjdHVhbCB2YWx1ZSBjYW5ub3QgYmUgY2hhbmdlZC5cIik7XG5cdFx0XHRjb25zdCBzaG93SG92ZXIgPSAoZm9jdXM6IGJvb2xlYW4pID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuaG92ZXJTZXJ2aWNlLnNob3dJbnN0YW50SG92ZXIoe1xuXHRcdFx0XHRcdC4uLnRoaXMuZGVmYXVsdEhvdmVyT3B0aW9ucyxcblx0XHRcdFx0XHRjb250ZW50LFxuXHRcdFx0XHRcdGFjdGlvbnM6IFt7XG5cdFx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ3BvbGljeUZpbHRlckxpbmsnLCBcIlZpZXcgcG9saWN5IHNldHRpbmdzXCIpLFxuXHRcdFx0XHRcdFx0Y29tbWFuZElkOiAnX3NldHRpbmdzLmFjdGlvbi52aWV3UG9saWN5U2V0dGluZ3MnLFxuXHRcdFx0XHRcdFx0cnVuOiAoXykgPT4ge1xuXHRcdFx0XHRcdFx0XHRvbkFwcGx5RmlsdGVyLmZpcmUoYEAke1BPTElDWV9TRVRUSU5HX1RBR31gKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XSxcblx0XHRcdFx0XHR0YXJnZXQ6IHRoaXMuc2NvcGVPdmVycmlkZXNJbmRpY2F0b3IuZWxlbWVudFxuXHRcdFx0XHR9LCBmb2N1cyk7XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5hZGRIb3ZlckRpc3Bvc2FibGVzKHRoaXMuc2NvcGVPdmVycmlkZXNJbmRpY2F0b3IuZGlzcG9zYWJsZXMsIHRoaXMuc2NvcGVPdmVycmlkZXNJbmRpY2F0b3IuZWxlbWVudCwgc2hvd0hvdmVyKTtcblx0XHR9IGVsc2UgaWYgKGVsZW1lbnQuc2V0dGluZ3NUYXJnZXQgPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTCAmJiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmlzU2V0dGluZ0FwcGxpZWRGb3JBbGxQcm9maWxlcyhlbGVtZW50LnNldHRpbmcua2V5KSkge1xuXHRcdFx0dGhpcy5zY29wZU92ZXJyaWRlc0luZGljYXRvci5lbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcblx0XHRcdHRoaXMuc2NvcGVPdmVycmlkZXNJbmRpY2F0b3IuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdzZXR0aW5nLWluZGljYXRvcicpO1xuXG5cdFx0XHR0aGlzLnNjb3BlT3ZlcnJpZGVzSW5kaWNhdG9yLmxhYmVsLnRleHQgPSBsb2NhbGl6ZSgnYXBwbGljYXRpb25TZXR0aW5nJywgXCJBcHBsaWVzIHRvIGFsbCBwcm9maWxlc1wiKTtcblxuXHRcdFx0Y29uc3QgY29udGVudCA9IGxvY2FsaXplKCdhcHBsaWNhdGlvblNldHRpbmdEZXNjcmlwdGlvbicsIFwiVGhlIHNldHRpbmcgaXMgbm90IHNwZWNpZmljIHRvIHRoZSBjdXJyZW50IHByb2ZpbGUsIGFuZCB3aWxsIHJldGFpbiBpdHMgdmFsdWUgd2hlbiBzd2l0Y2hpbmcgcHJvZmlsZXMuXCIpO1xuXHRcdFx0Y29uc3Qgc2hvd0hvdmVyID0gKGZvY3VzOiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmhvdmVyU2VydmljZS5zaG93SW5zdGFudEhvdmVyKHtcblx0XHRcdFx0XHQuLi50aGlzLmRlZmF1bHRIb3Zlck9wdGlvbnMsXG5cdFx0XHRcdFx0Y29udGVudCxcblx0XHRcdFx0XHR0YXJnZXQ6IHRoaXMuc2NvcGVPdmVycmlkZXNJbmRpY2F0b3IuZWxlbWVudFxuXHRcdFx0XHR9LCBmb2N1cyk7XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5hZGRIb3ZlckRpc3Bvc2FibGVzKHRoaXMuc2NvcGVPdmVycmlkZXNJbmRpY2F0b3IuZGlzcG9zYWJsZXMsIHRoaXMuc2NvcGVPdmVycmlkZXNJbmRpY2F0b3IuZWxlbWVudCwgc2hvd0hvdmVyKTtcblx0XHR9IGVsc2UgaWYgKGVsZW1lbnQub3ZlcnJpZGRlblNjb3BlTGlzdC5sZW5ndGggfHwgZWxlbWVudC5vdmVycmlkZGVuRGVmYXVsdHNMYW5ndWFnZUxpc3QubGVuZ3RoKSB7XG5cdFx0XHRpZiAoZWxlbWVudC5vdmVycmlkZGVuU2NvcGVMaXN0Lmxlbmd0aCA9PT0gMSAmJiAhZWxlbWVudC5vdmVycmlkZGVuRGVmYXVsdHNMYW5ndWFnZUxpc3QubGVuZ3RoKSB7XG5cdFx0XHRcdC8vIFdlIGNhbiBpbmxpbmUgdGhlIG92ZXJyaWRlIGFuZCBzaG93IGFsbCB0aGUgdGV4dCBpbiB0aGUgbGFiZWxcblx0XHRcdFx0Ly8gc28gdGhhdCB1c2VycyBkb24ndCBoYXZlIHRvIHdhaXQgZm9yIHRoZSBob3ZlciB0byBsb2FkXG5cdFx0XHRcdC8vIGp1c3QgdG8gY2xpY2sgaW50byB0aGUgb25lIG92ZXJyaWRlIHRoZXJlIGlzLlxuXHRcdFx0XHR0aGlzLnNjb3BlT3ZlcnJpZGVzSW5kaWNhdG9yLmVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUnO1xuXHRcdFx0XHR0aGlzLnNjb3BlT3ZlcnJpZGVzSW5kaWNhdG9yLmVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnc2V0dGluZy1pbmRpY2F0b3InKTtcblxuXHRcdFx0XHRjb25zdCBwcmVmYWNlVGV4dCA9IGVsZW1lbnQuaXNDb25maWd1cmVkID9cblx0XHRcdFx0XHRsb2NhbGl6ZSgnYWxzb0NvbmZpZ3VyZWRJbicsIFwiQWxzbyBtb2RpZmllZCBpblwiKSA6XG5cdFx0XHRcdFx0bG9jYWxpemUoJ2NvbmZpZ3VyZWRJbicsIFwiTW9kaWZpZWQgaW5cIik7XG5cdFx0XHRcdHRoaXMuc2NvcGVPdmVycmlkZXNJbmRpY2F0b3IubGFiZWwudGV4dCA9IGAke3ByZWZhY2VUZXh0fSBgO1xuXG5cdFx0XHRcdGNvbnN0IG92ZXJyaWRkZW5TY29wZSA9IGVsZW1lbnQub3ZlcnJpZGRlblNjb3BlTGlzdFswXTtcblx0XHRcdFx0Y29uc3QgdmlldyA9IERPTS5hcHBlbmQodGhpcy5zY29wZU92ZXJyaWRlc0luZGljYXRvci5lbGVtZW50LCAkKCdhLm1vZGlmaWVkLXNjb3BlJywgdW5kZWZpbmVkLCB0aGlzLmdldElubGluZVNjb3BlRGlzcGxheVRleHQob3ZlcnJpZGRlblNjb3BlKSkpO1xuXHRcdFx0XHR2aWV3LnRhYkluZGV4ID0gLTE7XG5cdFx0XHRcdHRoaXMuc2NvcGVPdmVycmlkZXNJbmRpY2F0b3IuZm9jdXNFbGVtZW50ID0gdmlldztcblx0XHRcdFx0Y29uc3Qgb25DbGlja09yS2V5ZG93biA9IChlOiBVSUV2ZW50KSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgW3Njb3BlLCBsYW5ndWFnZV0gPSBvdmVycmlkZGVuU2NvcGUuc3BsaXQoJzonKTtcblx0XHRcdFx0XHRvbkRpZENsaWNrT3ZlcnJpZGVFbGVtZW50LmZpcmUoe1xuXHRcdFx0XHRcdFx0c2V0dGluZ0tleTogZWxlbWVudC5zZXR0aW5nLmtleSxcblx0XHRcdFx0XHRcdHNjb3BlOiBzY29wZSBhcyBTY29wZVN0cmluZyxcblx0XHRcdFx0XHRcdGxhbmd1YWdlXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0ZS5wcmV2ZW50RGVmYXVsdCgpO1xuXHRcdFx0XHRcdGUuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdH07XG5cdFx0XHRcdHRoaXMuc2NvcGVPdmVycmlkZXNJbmRpY2F0b3IuZGlzcG9zYWJsZXMuYWRkKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodmlldywgRE9NLkV2ZW50VHlwZS5DTElDSywgKGUpID0+IHtcblx0XHRcdFx0XHRvbkNsaWNrT3JLZXlkb3duKGUpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHRcdHRoaXMuc2NvcGVPdmVycmlkZXNJbmRpY2F0b3IuZGlzcG9zYWJsZXMuYWRkKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodmlldywgRE9NLkV2ZW50VHlwZS5LRVlfRE9XTiwgKGUpID0+IHtcblx0XHRcdFx0XHRjb25zdCBldiA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cdFx0XHRcdFx0aWYgKGV2LmVxdWFscyhLZXlDb2RlLlNwYWNlKSB8fCBldi5lcXVhbHMoS2V5Q29kZS5FbnRlcikpIHtcblx0XHRcdFx0XHRcdG9uQ2xpY2tPcktleWRvd24oZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnNjb3BlT3ZlcnJpZGVzSW5kaWNhdG9yLmVsZW1lbnQuc3R5bGUuZGlzcGxheSA9ICdpbmxpbmUnO1xuXHRcdFx0XHR0aGlzLnNjb3BlT3ZlcnJpZGVzSW5kaWNhdG9yLmVsZW1lbnQuY2xhc3NMaXN0LmFkZCgnc2V0dGluZy1pbmRpY2F0b3InKTtcblx0XHRcdFx0Y29uc3Qgc2NvcGVPdmVycmlkZXNMYWJlbFRleHQgPSBlbGVtZW50LmlzQ29uZmlndXJlZCA/XG5cdFx0XHRcdFx0bG9jYWxpemUoJ2Fsc29Db25maWd1cmVkRWxzZXdoZXJlJywgXCJBbHNvIG1vZGlmaWVkIGVsc2V3aGVyZVwiKSA6XG5cdFx0XHRcdFx0bG9jYWxpemUoJ2NvbmZpZ3VyZWRFbHNld2hlcmUnLCBcIk1vZGlmaWVkIGVsc2V3aGVyZVwiKTtcblx0XHRcdFx0dGhpcy5zY29wZU92ZXJyaWRlc0luZGljYXRvci5sYWJlbC50ZXh0ID0gc2NvcGVPdmVycmlkZXNMYWJlbFRleHQ7XG5cblx0XHRcdFx0bGV0IGNvbnRlbnRNYXJrZG93blN0cmluZyA9ICcnO1xuXHRcdFx0XHRpZiAoZWxlbWVudC5vdmVycmlkZGVuU2NvcGVMaXN0Lmxlbmd0aCkge1xuXHRcdFx0XHRcdGNvbnN0IHByZWZhY2VUZXh0ID0gZWxlbWVudC5pc0NvbmZpZ3VyZWQgP1xuXHRcdFx0XHRcdFx0bG9jYWxpemUoJ2Fsc29Nb2RpZmllZEluU2NvcGVzJywgXCJUaGUgc2V0dGluZyBoYXMgYWxzbyBiZWVuIG1vZGlmaWVkIGluIHRoZSBmb2xsb3dpbmcgc2NvcGVzOlwiKSA6XG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnbW9kaWZpZWRJblNjb3BlcycsIFwiVGhlIHNldHRpbmcgaGFzIGJlZW4gbW9kaWZpZWQgaW4gdGhlIGZvbGxvd2luZyBzY29wZXM6XCIpO1xuXHRcdFx0XHRcdGNvbnRlbnRNYXJrZG93blN0cmluZyA9IHByZWZhY2VUZXh0O1xuXHRcdFx0XHRcdGZvciAoY29uc3Qgc2NvcGUgb2YgZWxlbWVudC5vdmVycmlkZGVuU2NvcGVMaXN0KSB7XG5cdFx0XHRcdFx0XHRjb25zdCBzY29wZURpc3BsYXlUZXh0ID0gdGhpcy5nZXRJbmxpbmVTY29wZURpc3BsYXlUZXh0KHNjb3BlKTtcblx0XHRcdFx0XHRcdGNvbnRlbnRNYXJrZG93blN0cmluZyArPSBgXFxuLSBbJHtzY29wZURpc3BsYXlUZXh0fV0oJHtlbmNvZGVVUklDb21wb25lbnQoc2NvcGUpfSBcIiR7Z2V0QWNjZXNzaWJsZVNjb3BlRGlzcGxheVRleHQoc2NvcGUsIHRoaXMubGFuZ3VhZ2VTZXJ2aWNlKX1cIilgO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZWxlbWVudC5vdmVycmlkZGVuRGVmYXVsdHNMYW5ndWFnZUxpc3QubGVuZ3RoKSB7XG5cdFx0XHRcdFx0aWYgKGNvbnRlbnRNYXJrZG93blN0cmluZykge1xuXHRcdFx0XHRcdFx0Y29udGVudE1hcmtkb3duU3RyaW5nICs9IGBcXG5cXG5gO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCBwcmVmYWNlVGV4dCA9IGxvY2FsaXplKCdoYXNEZWZhdWx0T3ZlcnJpZGVzRm9yTGFuZ3VhZ2VzJywgXCJUaGUgZm9sbG93aW5nIGxhbmd1YWdlcyBoYXZlIGRlZmF1bHQgb3ZlcnJpZGVzOlwiKTtcblx0XHRcdFx0XHRjb250ZW50TWFya2Rvd25TdHJpbmcgKz0gcHJlZmFjZVRleHQ7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCBsYW5ndWFnZSBvZiBlbGVtZW50Lm92ZXJyaWRkZW5EZWZhdWx0c0xhbmd1YWdlTGlzdCkge1xuXHRcdFx0XHRcdFx0Y29uc3Qgc2NvcGVEaXNwbGF5VGV4dCA9IHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmdldExhbmd1YWdlTmFtZShsYW5ndWFnZSk7XG5cdFx0XHRcdFx0XHRjb250ZW50TWFya2Rvd25TdHJpbmcgKz0gYFxcbi0gWyR7c2NvcGVEaXNwbGF5VGV4dH1dKCR7ZW5jb2RlVVJJQ29tcG9uZW50KGBkZWZhdWx0OiR7bGFuZ3VhZ2V9YCl9IFwiJHtzY29wZURpc3BsYXlUZXh0fVwiKWA7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGNvbnRlbnQ6IElNYXJrZG93blN0cmluZyA9IHtcblx0XHRcdFx0XHR2YWx1ZTogY29udGVudE1hcmtkb3duU3RyaW5nLFxuXHRcdFx0XHRcdGlzVHJ1c3RlZDogZmFsc2UsXG5cdFx0XHRcdFx0c3VwcG9ydEh0bWw6IGZhbHNlXG5cdFx0XHRcdH07XG5cdFx0XHRcdHRoaXMuc2NvcGVPdmVycmlkZXNJbmRpY2F0b3IuZGlzcG9zYWJsZXMuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwRGVsYXllZEhvdmVyKHRoaXMuc2NvcGVPdmVycmlkZXNJbmRpY2F0b3IuZWxlbWVudCwgKCkgPT4gKHtcblx0XHRcdFx0XHQuLi50aGlzLmRlZmF1bHRIb3Zlck9wdGlvbnMsXG5cdFx0XHRcdFx0Y29udGVudCxcblx0XHRcdFx0XHRsaW5rSGFuZGxlcjogKHVybDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBbc2NvcGUsIGxhbmd1YWdlXSA9IGRlY29kZVVSSUNvbXBvbmVudCh1cmwpLnNwbGl0KCc6Jyk7XG5cdFx0XHRcdFx0XHRvbkRpZENsaWNrT3ZlcnJpZGVFbGVtZW50LmZpcmUoe1xuXHRcdFx0XHRcdFx0XHRzZXR0aW5nS2V5OiBlbGVtZW50LnNldHRpbmcua2V5LFxuXHRcdFx0XHRcdFx0XHRzY29wZTogc2NvcGUgYXMgU2NvcGVTdHJpbmcsXG5cdFx0XHRcdFx0XHRcdGxhbmd1YWdlXG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pLCB7IHNldHVwS2V5Ym9hcmRFdmVudHM6IHRydWUgfSkpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLnJlbmRlcigpO1xuXHR9XG5cblx0dXBkYXRlRGVmYXVsdE92ZXJyaWRlSW5kaWNhdG9yKGVsZW1lbnQ6IFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50KSB7XG5cdFx0dGhpcy5kZWZhdWx0T3ZlcnJpZGVJbmRpY2F0b3IuZWxlbWVudC5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHRcdGxldCBzb3VyY2VUb0Rpc3BsYXkgPSBnZXREZWZhdWx0VmFsdWVTb3VyY2VUb0Rpc3BsYXkoZWxlbWVudCk7XG5cdFx0aWYgKHNvdXJjZVRvRGlzcGxheSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLmRlZmF1bHRPdmVycmlkZUluZGljYXRvci5lbGVtZW50LnN0eWxlLmRpc3BsYXkgPSAnaW5saW5lJztcblx0XHRcdHRoaXMuZGVmYXVsdE92ZXJyaWRlSW5kaWNhdG9yLmRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHRcdC8vIFNob3cgc291cmNlIG9mIGRlZmF1bHQgdmFsdWUgd2hlbiBob3ZlcmVkXG5cdFx0XHRpZiAoQXJyYXkuaXNBcnJheShzb3VyY2VUb0Rpc3BsYXkpICYmIHNvdXJjZVRvRGlzcGxheS5sZW5ndGggPT09IDEpIHtcblx0XHRcdFx0c291cmNlVG9EaXNwbGF5ID0gc291cmNlVG9EaXNwbGF5WzBdO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgZGVmYXVsdE92ZXJyaWRlSG92ZXJDb250ZW50O1xuXHRcdFx0aWYgKCFBcnJheS5pc0FycmF5KHNvdXJjZVRvRGlzcGxheSkpIHtcblx0XHRcdFx0ZGVmYXVsdE92ZXJyaWRlSG92ZXJDb250ZW50ID0gbG9jYWxpemUoJ2RlZmF1bHRPdmVycmlkZGVuRGV0YWlscycsIFwiRGVmYXVsdCBzZXR0aW5nIHZhbHVlIG92ZXJyaWRkZW4gYnkgYHswfWBcIiwgc291cmNlVG9EaXNwbGF5KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHNvdXJjZVRvRGlzcGxheSA9IHNvdXJjZVRvRGlzcGxheS5tYXAoc291cmNlID0+IGBcXGAke3NvdXJjZX1cXGBgKTtcblx0XHRcdFx0ZGVmYXVsdE92ZXJyaWRlSG92ZXJDb250ZW50ID0gbG9jYWxpemUoJ211bHRpcGxlZGVmYXVsdE92ZXJyaWRkZW5EZXRhaWxzJywgXCJBIGRlZmF1bHQgdmFsdWVzIGhhcyBiZWVuIHNldCBieSB7MH1cIiwgc291cmNlVG9EaXNwbGF5LnNsaWNlKDAsIC0xKS5qb2luKCcsICcpICsgJyAmICcgKyBzb3VyY2VUb0Rpc3BsYXkuc2xpY2UoLTEpKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc2hvd0hvdmVyID0gKGZvY3VzOiBib29sZWFuKSA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmhvdmVyU2VydmljZS5zaG93SW5zdGFudEhvdmVyKHtcblx0XHRcdFx0XHRjb250ZW50OiBuZXcgTWFya2Rvd25TdHJpbmcoKS5hcHBlbmRNYXJrZG93bihkZWZhdWx0T3ZlcnJpZGVIb3ZlckNvbnRlbnQpLFxuXHRcdFx0XHRcdHRhcmdldDogdGhpcy5kZWZhdWx0T3ZlcnJpZGVJbmRpY2F0b3IuZWxlbWVudCxcblx0XHRcdFx0XHRwb3NpdGlvbjoge1xuXHRcdFx0XHRcdFx0aG92ZXJQb3NpdGlvbjogSG92ZXJQb3NpdGlvbi5CRUxPVyxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGFwcGVhcmFuY2U6IHtcblx0XHRcdFx0XHRcdHNob3dQb2ludGVyOiB0cnVlLFxuXHRcdFx0XHRcdFx0Y29tcGFjdDogZmFsc2Vcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sIGZvY3VzKTtcblx0XHRcdH07XG5cdFx0XHR0aGlzLmFkZEhvdmVyRGlzcG9zYWJsZXModGhpcy5kZWZhdWx0T3ZlcnJpZGVJbmRpY2F0b3IuZGlzcG9zYWJsZXMsIHRoaXMuZGVmYXVsdE92ZXJyaWRlSW5kaWNhdG9yLmVsZW1lbnQsIHNob3dIb3Zlcik7XG5cdFx0fVxuXHRcdHRoaXMucmVuZGVyKCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gZ2V0RGVmYXVsdFZhbHVlU291cmNlVG9EaXNwbGF5KGVsZW1lbnQ6IFNldHRpbmdzVHJlZVNldHRpbmdFbGVtZW50KTogc3RyaW5nIHwgdW5kZWZpbmVkIHwgc3RyaW5nW10ge1xuXHRsZXQgc291cmNlVG9EaXNwbGF5OiBzdHJpbmcgfCB1bmRlZmluZWQgfCBzdHJpbmdbXTtcblx0Y29uc3QgZGVmYXVsdFZhbHVlU291cmNlID0gZWxlbWVudC5kZWZhdWx0VmFsdWVTb3VyY2U7XG5cdGlmIChkZWZhdWx0VmFsdWVTb3VyY2UpIHtcblx0XHRpZiAoZGVmYXVsdFZhbHVlU291cmNlIGluc3RhbmNlb2YgTWFwKSB7XG5cdFx0XHRzb3VyY2VUb0Rpc3BsYXkgPSBbXTtcblx0XHRcdGZvciAoY29uc3QgWywgdmFsdWVdIG9mIGRlZmF1bHRWYWx1ZVNvdXJjZSkge1xuXHRcdFx0XHRjb25zdCBuZXdWYWx1ZSA9IHR5cGVvZiB2YWx1ZSAhPT0gJ3N0cmluZycgPyB2YWx1ZS5kaXNwbGF5TmFtZSA/PyB2YWx1ZS5pZCA6IHZhbHVlO1xuXHRcdFx0XHRpZiAoIXNvdXJjZVRvRGlzcGxheS5pbmNsdWRlcyhuZXdWYWx1ZSkpIHtcblx0XHRcdFx0XHRzb3VyY2VUb0Rpc3BsYXkucHVzaChuZXdWYWx1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKHR5cGVvZiBkZWZhdWx0VmFsdWVTb3VyY2UgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRzb3VyY2VUb0Rpc3BsYXkgPSBkZWZhdWx0VmFsdWVTb3VyY2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHNvdXJjZVRvRGlzcGxheSA9IGRlZmF1bHRWYWx1ZVNvdXJjZS5kaXNwbGF5TmFtZSA/PyBkZWZhdWx0VmFsdWVTb3VyY2UuaWQ7XG5cdFx0fVxuXHR9XG5cdHJldHVybiBzb3VyY2VUb0Rpc3BsYXk7XG59XG5cbmZ1bmN0aW9uIGdldEFjY2Vzc2libGVTY29wZURpc3BsYXlUZXh0KGNvbXBsZXRlU2NvcGU6IHN0cmluZywgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlKTogc3RyaW5nIHtcblx0Y29uc3QgW3Njb3BlLCBsYW5ndWFnZV0gPSBjb21wbGV0ZVNjb3BlLnNwbGl0KCc6Jyk7XG5cdGNvbnN0IGxvY2FsaXplZFNjb3BlID0gc2NvcGUgPT09ICd1c2VyJyA/XG5cdFx0bG9jYWxpemUoJ3VzZXInLCBcIlVzZXJcIikgOiBzY29wZSA9PT0gJ3dvcmtzcGFjZScgP1xuXHRcdFx0bG9jYWxpemUoJ3dvcmtzcGFjZScsIFwiV29ya3NwYWNlXCIpIDogbG9jYWxpemUoJ3JlbW90ZScsIFwiUmVtb3RlXCIpO1xuXHRpZiAobGFuZ3VhZ2UpIHtcblx0XHRyZXR1cm4gbG9jYWxpemUoJ21vZGlmaWVkSW5TY29wZUZvckxhbmd1YWdlJywgXCJUaGUgezB9IHNjb3BlIGZvciB7MX1cIiwgbG9jYWxpemVkU2NvcGUsIGxhbmd1YWdlU2VydmljZS5nZXRMYW5ndWFnZU5hbWUobGFuZ3VhZ2UpKTtcblx0fVxuXHRyZXR1cm4gbG9jYWxpemVkU2NvcGU7XG59XG5cbmZ1bmN0aW9uIGdldEFjY2Vzc2libGVTY29wZURpc3BsYXlNaWRTZW50ZW5jZVRleHQoY29tcGxldGVTY29wZTogc3RyaW5nLCBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UpOiBzdHJpbmcge1xuXHRjb25zdCBbc2NvcGUsIGxhbmd1YWdlXSA9IGNvbXBsZXRlU2NvcGUuc3BsaXQoJzonKTtcblx0Y29uc3QgbG9jYWxpemVkU2NvcGUgPSBzY29wZSA9PT0gJ3VzZXInID9cblx0XHRsb2NhbGl6ZSgndXNlcicsIFwiVXNlclwiKSA6IHNjb3BlID09PSAnd29ya3NwYWNlJyA/XG5cdFx0XHRsb2NhbGl6ZSgnd29ya3NwYWNlJywgXCJXb3Jrc3BhY2VcIikgOiBsb2NhbGl6ZSgncmVtb3RlJywgXCJSZW1vdGVcIik7XG5cdGlmIChsYW5ndWFnZSkge1xuXHRcdHJldHVybiBsb2NhbGl6ZSgnbW9kaWZpZWRJblNjb3BlRm9yTGFuZ3VhZ2VNaWRTZW50ZW5jZScsIFwidGhlIHswfSBzY29wZSBmb3IgezF9XCIsIGxvY2FsaXplZFNjb3BlLnRvTG93ZXJDYXNlKCksIGxhbmd1YWdlU2VydmljZS5nZXRMYW5ndWFnZU5hbWUobGFuZ3VhZ2UpKTtcblx0fVxuXHRyZXR1cm4gbG9jYWxpemVkU2NvcGU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRJbmRpY2F0b3JzTGFiZWxBcmlhTGFiZWwoZWxlbWVudDogU2V0dGluZ3NUcmVlU2V0dGluZ0VsZW1lbnQsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJV29ya2JlbmNoQ29uZmlndXJhdGlvblNlcnZpY2UsIHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsIGxhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSk6IHN0cmluZyB7XG5cdGNvbnN0IGFyaWFMYWJlbFNlY3Rpb25zOiBzdHJpbmdbXSA9IFtdO1xuXG5cdC8vIEFkZCBwcmV2aWV3IG9yIGV4cGVyaW1lbnRhbCBpbmRpY2F0b3IgdGV4dFxuXHRpZiAoZWxlbWVudC50YWdzPy5oYXMoJ3ByZXZpZXcnKSkge1xuXHRcdGFyaWFMYWJlbFNlY3Rpb25zLnB1c2gobG9jYWxpemUoJ3ByZXZpZXdMYWJlbCcsIFwiUHJldmlld1wiKSk7XG5cdH0gZWxzZSBpZiAoZWxlbWVudC50YWdzPy5oYXMoJ2V4cGVyaW1lbnRhbCcpKSB7XG5cdFx0YXJpYUxhYmVsU2VjdGlvbnMucHVzaChsb2NhbGl6ZSgnZXhwZXJpbWVudGFsTGFiZWwnLCBcIkV4cGVyaW1lbnRhbFwiKSk7XG5cdH1cblxuXHQvLyBBZGQgd29ya3NwYWNlIHRydXN0IHRleHRcblx0aWYgKGVsZW1lbnQuaXNVbnRydXN0ZWQpIHtcblx0XHRhcmlhTGFiZWxTZWN0aW9ucy5wdXNoKGxvY2FsaXplKCd3b3Jrc3BhY2VVbnRydXN0ZWRBcmlhTGFiZWwnLCBcIldvcmtzcGFjZSB1bnRydXN0ZWQ7IHNldHRpbmcgdmFsdWUgbm90IGFwcGxpZWRcIikpO1xuXHR9XG5cblx0aWYgKGVsZW1lbnQuaGFzUG9saWN5VmFsdWUpIHtcblx0XHRhcmlhTGFiZWxTZWN0aW9ucy5wdXNoKGxvY2FsaXplKCdwb2xpY3lEZXNjcmlwdGlvbkFjY2Vzc2libGUnLCBcIk1hbmFnZWQgYnkgb3JnYW5pemF0aW9uIHBvbGljeTsgc2V0dGluZyB2YWx1ZSBub3QgYXBwbGllZFwiKSk7XG5cdH0gZWxzZSBpZiAoZWxlbWVudC5zZXR0aW5nc1RhcmdldCA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMICYmIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmlzU2V0dGluZ0FwcGxpZWRGb3JBbGxQcm9maWxlcyhlbGVtZW50LnNldHRpbmcua2V5KSkge1xuXHRcdGFyaWFMYWJlbFNlY3Rpb25zLnB1c2gobG9jYWxpemUoJ2FwcGxpY2F0aW9uU2V0dGluZ0Rlc2NyaXB0aW9uQWNjZXNzaWJsZScsIFwiU2V0dGluZyB2YWx1ZSByZXRhaW5lZCB3aGVuIHN3aXRjaGluZyBwcm9maWxlc1wiKSk7XG5cdH0gZWxzZSB7XG5cdFx0Ly8gQWRkIG90aGVyIG92ZXJyaWRlcyB0ZXh0XG5cdFx0Y29uc3Qgb3RoZXJPdmVycmlkZXNTdGFydCA9IGVsZW1lbnQuaXNDb25maWd1cmVkID9cblx0XHRcdGxvY2FsaXplKCdhbHNvQ29uZmlndXJlZEluJywgXCJBbHNvIG1vZGlmaWVkIGluXCIpIDpcblx0XHRcdGxvY2FsaXplKCdjb25maWd1cmVkSW4nLCBcIk1vZGlmaWVkIGluXCIpO1xuXHRcdGNvbnN0IG90aGVyT3ZlcnJpZGVzTGlzdCA9IGVsZW1lbnQub3ZlcnJpZGRlblNjb3BlTGlzdFxuXHRcdFx0Lm1hcChzY29wZSA9PiBnZXRBY2Nlc3NpYmxlU2NvcGVEaXNwbGF5TWlkU2VudGVuY2VUZXh0KHNjb3BlLCBsYW5ndWFnZVNlcnZpY2UpKS5qb2luKCcsICcpO1xuXHRcdGlmIChlbGVtZW50Lm92ZXJyaWRkZW5TY29wZUxpc3QubGVuZ3RoKSB7XG5cdFx0XHRhcmlhTGFiZWxTZWN0aW9ucy5wdXNoKGAke290aGVyT3ZlcnJpZGVzU3RhcnR9ICR7b3RoZXJPdmVycmlkZXNMaXN0fWApO1xuXHRcdH1cblx0fVxuXG5cdC8vIEFkZCBzeW5jIGlnbm9yZWQgdGV4dFxuXHRpZiAoY2FjaGVkU3luY0lnbm9yZWRTZXR0aW5nc1NldC5oYXMoZWxlbWVudC5zZXR0aW5nLmtleSkpIHtcblx0XHRhcmlhTGFiZWxTZWN0aW9ucy5wdXNoKGxvY2FsaXplKCdzeW5jSWdub3JlZEFyaWFMYWJlbCcsIFwiU2V0dGluZyBpZ25vcmVkIGR1cmluZyBzeW5jXCIpKTtcblx0fVxuXG5cdC8vIEFkZCBkZWZhdWx0IG92ZXJyaWRlIGluZGljYXRvciB0ZXh0XG5cdGxldCBzb3VyY2VUb0Rpc3BsYXkgPSBnZXREZWZhdWx0VmFsdWVTb3VyY2VUb0Rpc3BsYXkoZWxlbWVudCk7XG5cdGlmIChzb3VyY2VUb0Rpc3BsYXkgIT09IHVuZGVmaW5lZCkge1xuXHRcdGlmIChBcnJheS5pc0FycmF5KHNvdXJjZVRvRGlzcGxheSkgJiYgc291cmNlVG9EaXNwbGF5Lmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0c291cmNlVG9EaXNwbGF5ID0gc291cmNlVG9EaXNwbGF5WzBdO1xuXHRcdH1cblxuXHRcdGxldCBvdmVycmlkZGVuRGV0YWlsc1RleHQ7XG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KHNvdXJjZVRvRGlzcGxheSkpIHtcblx0XHRcdG92ZXJyaWRkZW5EZXRhaWxzVGV4dCA9IGxvY2FsaXplKCdkZWZhdWx0T3ZlcnJpZGRlbkRldGFpbHNBcmlhTGFiZWwnLCBcInswfSBvdmVycmlkZXMgdGhlIGRlZmF1bHQgdmFsdWVcIiwgc291cmNlVG9EaXNwbGF5KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0b3ZlcnJpZGRlbkRldGFpbHNUZXh0ID0gbG9jYWxpemUoJ211bHRpcGxlRGVmYXVsdE92ZXJyaWRkZW5EZXRhaWxzQXJpYUxhYmVsJywgXCJ7MH0gb3ZlcnJpZGUgdGhlIGRlZmF1bHQgdmFsdWVcIiwgc291cmNlVG9EaXNwbGF5LnNsaWNlKDAsIC0xKS5qb2luKCcsICcpICsgJyAmICcgKyBzb3VyY2VUb0Rpc3BsYXkuc2xpY2UoLTEpKTtcblx0XHR9XG5cdFx0YXJpYUxhYmVsU2VjdGlvbnMucHVzaChvdmVycmlkZGVuRGV0YWlsc1RleHQpO1xuXHR9XG5cblx0Ly8gQWRkIHRleHQgYWJvdXQgZGVmYXVsdCB2YWx1ZXMgYmVpbmcgb3ZlcnJpZGRlbiBpbiBvdGhlciBsYW5ndWFnZXNcblx0Y29uc3Qgb3RoZXJMYW5ndWFnZU92ZXJyaWRlc0xpc3QgPSBlbGVtZW50Lm92ZXJyaWRkZW5EZWZhdWx0c0xhbmd1YWdlTGlzdFxuXHRcdC5tYXAobGFuZ3VhZ2UgPT4gbGFuZ3VhZ2VTZXJ2aWNlLmdldExhbmd1YWdlTmFtZShsYW5ndWFnZSkpLmpvaW4oJywgJyk7XG5cdGlmIChlbGVtZW50Lm92ZXJyaWRkZW5EZWZhdWx0c0xhbmd1YWdlTGlzdC5sZW5ndGgpIHtcblx0XHRjb25zdCBvdGhlckxhbmd1YWdlT3ZlcnJpZGVzVGV4dCA9IGxvY2FsaXplKCdkZWZhdWx0T3ZlcnJpZGRlbkxhbmd1YWdlc0xpc3QnLCBcIkxhbmd1YWdlLXNwZWNpZmljIGRlZmF1bHQgdmFsdWVzIGV4aXN0IGZvciB7MH1cIiwgb3RoZXJMYW5ndWFnZU92ZXJyaWRlc0xpc3QpO1xuXHRcdGFyaWFMYWJlbFNlY3Rpb25zLnB1c2gob3RoZXJMYW5ndWFnZU92ZXJyaWRlc1RleHQpO1xuXHR9XG5cblx0Y29uc3QgYXJpYUxhYmVsID0gYXJpYUxhYmVsU2VjdGlvbnMuam9pbignLiAnKTtcblx0cmV0dXJuIGFyaWFMYWJlbDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsWUFBWSxTQUFTO0FBQ3JCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsd0JBQXdCO0FBRWpDLFNBQTBCLHNCQUFzQjtBQUNoRCxTQUFTLGVBQWU7QUFDeEIsU0FBc0IsdUJBQXVCO0FBQzdDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMkJBQTJCO0FBRXBDLFNBQVMsc0NBQXNDO0FBRS9DLFNBQVMsb0NBQW9DLG9CQUFvQixxQ0FBcUM7QUFDdEcsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUyxxQkFBcUI7QUFHOUIsTUFBTSxJQUFJLElBQUk7QUEwQmQsSUFBSSwrQkFBNEMsb0JBQUksSUFBWTtBQU1oRSxJQUFJLDRCQUFzQyxDQUFDO0FBS3BDLElBQU0sOEJBQU4sTUFBeUQ7QUFBQSxFQWlCL0QsWUFDQyxXQUNpRCxzQkFDakIsY0FDaUIs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
