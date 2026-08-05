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
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Schemas } from "../../../../base/common/network.js";
import * as nls from "../../../../nls.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { ConfigurationTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { settingKeyToDisplayFormat } from "../../preferences/browser/settingsTreeModels.js";
let SimpleSettingRenderer = class {
  // setting ID to feature value
  constructor(_configurationService, _contextMenuService, _preferencesService, _telemetryService, _clipboardService) {
    this._configurationService = _configurationService;
    this._contextMenuService = _contextMenuService;
    this._preferencesService = _preferencesService;
    this._telemetryService = _telemetryService;
    this._clipboardService = _clipboardService;
    this._updatedSettings = /* @__PURE__ */ new Map();
    // setting ID to user's original setting value
    this._encounteredSettings = /* @__PURE__ */ new Map();
    // setting ID to setting
    this._featuredSettings = /* @__PURE__ */ new Map();
    this.codeSettingAnchorRegex = new RegExp(`^<a (href)=".*code.*://settings/([^\\s"]+)"(?:\\s*codesetting="([^"]+)")?>`);
    this.codeSettingSimpleRegex = new RegExp(`^setting\\(([^\\s:)]+)(?::([^)]+))?\\)$`);
  }
  get featuredSettingStates() {
    const result = /* @__PURE__ */ new Map();
    for (const [settingId, value] of this._featuredSettings) {
      result.set(settingId, this._configurationService.getValue(settingId) === value);
    }
    return result;
  }
  replaceAnchor(raw) {
    const match = this.codeSettingAnchorRegex.exec(raw);
    if (match && match.length === 4) {
      const settingId = match[2];
      const rendered = this.render(settingId, match[3]);
      if (rendered) {
        return raw.replace(this.codeSettingAnchorRegex, rendered);
      }
    }
    return void 0;
  }
  replaceSimple(raw) {
    const match = this.codeSettingSimpleRegex.exec(raw);
    if (match && match.length === 3) {
      const settingId = match[1];
      const rendered = this.render(settingId, match[2]);
      if (rendered) {
        return raw.replace(this.codeSettingSimpleRegex, rendered);
      }
    }
    return void 0;
  }
  getHtmlRenderer() {
    return ({ raw }) => {
      const replacedAnchor = this.replaceAnchor(raw);
      if (replacedAnchor) {
        raw = replacedAnchor;
      }
      return raw;
    };
  }
  getCodeSpanRenderer() {
    return ({ text }) => {
      const replacedSimple = this.replaceSimple(text);
      if (replacedSimple) {
        return replacedSimple;
      }
      return `<code>${text}</code>`;
    };
  }
  settingToUriString(settingId, value) {
    return `${Schemas.codeSetting}://${settingId}${value ? `/${value}` : ""}`;
  }
  getSetting(settingId) {
    if (this._encounteredSettings.has(settingId)) {
      return this._encounteredSettings.get(settingId);
    }
    return this._preferencesService.getSetting(settingId);
  }
  parseValue(settingId, value) {
    if (value === "undefined" || value === "") {
      return void 0;
    }
    const setting = this.getSetting(settingId);
    if (!setting) {
      return value;
    }
    switch (setting.type) {
      case "boolean":
        return value === "true";
      case "number":
        return parseInt(value, 10);
      case "string":
      default:
        return value;
    }
  }
  render(settingId, newValue) {
    const setting = this.getSetting(settingId);
    if (!setting) {
      return `<code>${settingId}</code>`;
    }
    return this.renderSetting(setting, newValue);
  }
  viewInSettingsMessage(settingId, alreadyDisplayed) {
    if (alreadyDisplayed) {
      return nls.localize("viewInSettings", "View in Settings");
    } else {
      const displayName = settingKeyToDisplayFormat(settingId);
      return nls.localize("viewInSettingsDetailed", 'View "{0}: {1}" in Settings', displayName.category, displayName.label);
    }
  }
  restorePreviousSettingMessage(settingId) {
    const displayName = settingKeyToDisplayFormat(settingId);
    return nls.localize("restorePreviousValue", 'Restore value of "{0}: {1}"', displayName.category, displayName.label);
  }
  isAlreadySet(setting, value) {
    const currentValue = this._configurationService.getValue(setting.key);
    return currentValue === value || currentValue === void 0 && setting.value === value;
  }
  booleanSettingMessage(setting, booleanValue) {
    const displayName = settingKeyToDisplayFormat(setting.key);
    if (this.isAlreadySet(setting, booleanValue)) {
      if (booleanValue) {
        return nls.localize("alreadysetBoolTrue", '"{0}: {1}" is already enabled', displayName.category, displayName.label);
      } else {
        return nls.localize("alreadysetBoolFalse", '"{0}: {1}" is already disabled', displayName.category, displayName.label);
      }
    }
    if (booleanValue) {
      return nls.localize("trueMessage", 'Enable "{0}: {1}"', displayName.category, displayName.label);
    } else {
      return nls.localize("falseMessage", 'Disable "{0}: {1}"', displayName.category, displayName.label);
    }
  }
  stringSettingMessage(setting, stringValue) {
    const displayName = settingKeyToDisplayFormat(setting.key);
    if (this.isAlreadySet(setting, stringValue)) {
      return nls.localize("alreadysetString", '"{0}: {1}" is already set to "{2}"', displayName.category, displayName.label, stringValue);
    }
    return nls.localize("stringValue", 'Set "{0}: {1}" to "{2}"', displayName.category, displayName.label, stringValue);
  }
  numberSettingMessage(setting, numberValue) {
    const displayName = settingKeyToDisplayFormat(setting.key);
    if (this.isAlreadySet(setting, numberValue)) {
      return nls.localize("alreadysetNum", '"{0}: {1}" is already set to {2}', displayName.category, displayName.label, numberValue);
    }
    return nls.localize("numberValue", 'Set "{0}: {1}" to {2}', displayName.category, displayName.label, numberValue);
  }
  renderSetting(setting, newValue) {
    const href = this.settingToUriString(setting.key, newValue);
    const title = nls.localize("changeSettingTitle", "View or change setting");
    return `<code tabindex="0"><a href="${href}" class="codesetting" title="${title}" aria-role="button"><svg width="14" height="14" viewBox="0 0 15 15" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M9.1 4.4L8.6 2H7.4l-.5 2.4-.7.3-2-1.3-.9.8 1.3 2-.2.7-2.4.5v1.2l2.4.5.3.8-1.3 2 .8.8 2-1.3.8.3.4 2.3h1.2l.5-2.4.8-.3 2 1.3.8-.8-1.3-2 .3-.8 2.3-.4V7.4l-2.4-.5-.3-.8 1.3-2-.8-.8-2 1.3-.7-.2zM9.4 1l.5 2.4L12 2.1l2 2-1.4 2.1 2.4.4v2.8l-2.4.5L14 12l-2 2-2.1-1.4-.5 2.4H6.6l-.5-2.4L4 13.9l-2-2 1.4-2.1L1 9.4V6.6l2.4-.5L2.1 4l2-2 2.1 1.4.4-2.4h2.8zm.6 7c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zM8 9c.6 0 1-.4 1-1s-.4-1-1-1-1 .4-1 1 .4 1 1 1z"/></svg>
			<span class="separator"></span>
			<span class="setting-name">${setting.key}</span>
		</a></code>`;
  }
  getSettingMessage(setting, newValue) {
    if (setting.type === "boolean") {
      return this.booleanSettingMessage(setting, newValue);
    } else if (setting.type === "string") {
      return this.stringSettingMessage(setting, newValue);
    } else if (setting.type === "number") {
      return this.numberSettingMessage(setting, newValue);
    }
    return void 0;
  }
  async restoreSetting(settingId) {
    const userOriginalSettingValue = this._updatedSettings.get(settingId);
    this._updatedSettings.delete(settingId);
    return this._configurationService.updateValue(settingId, userOriginalSettingValue, ConfigurationTarget.USER);
  }
  async setSetting(settingId, currentSettingValue, newSettingValue) {
    this._updatedSettings.set(settingId, currentSettingValue);
    return this._configurationService.updateValue(settingId, newSettingValue, ConfigurationTarget.USER);
  }
  getActions(uri) {
    if (uri.scheme !== Schemas.codeSetting) {
      return;
    }
    const actions = [];
    const settingId = uri.authority;
    const newSettingValue = this.parseValue(uri.authority, uri.path.substring(1));
    const currentSettingValue = this._configurationService.inspect(settingId).userValue;
    if (newSettingValue !== void 0 && newSettingValue === currentSettingValue && this._updatedSettings.has(settingId)) {
      const restoreMessage = this.restorePreviousSettingMessage(settingId);
      actions.push({
        class: void 0,
        id: "restoreSetting",
        enabled: true,
        tooltip: restoreMessage,
        label: restoreMessage,
        run: () => {
          return this.restoreSetting(settingId);
        }
      });
    } else if (newSettingValue !== void 0) {
      const setting = this.getSetting(settingId);
      const trySettingMessage = setting ? this.getSettingMessage(setting, newSettingValue) : void 0;
      if (setting && trySettingMessage) {
        actions.push({
          class: void 0,
          id: "trySetting",
          enabled: !this.isAlreadySet(setting, newSettingValue),
          tooltip: trySettingMessage,
          label: trySettingMessage,
          run: () => {
            this.setSetting(settingId, currentSettingValue, newSettingValue);
          }
        });
      }
    }
    const viewInSettingsMessage = this.viewInSettingsMessage(settingId, actions.length > 0);
    actions.push({
      class: void 0,
      enabled: true,
      id: "viewInSettings",
      tooltip: viewInSettingsMessage,
      label: viewInSettingsMessage,
      run: () => {
        return this._preferencesService.openApplicationSettings({ query: `@id:${settingId}` });
      }
    });
    actions.push({
      class: void 0,
      enabled: true,
      id: "copySettingId",
      tooltip: nls.localize("copySettingId", "Copy Setting ID"),
      label: nls.localize("copySettingId", "Copy Setting ID"),
      run: () => {
        this._clipboardService.writeText(settingId);
      }
    });
    return actions;
  }
  showContextMenu(uri, x, y) {
    const actions = this.getActions(uri);
    if (!actions) {
      return;
    }
    this._contextMenuService.showContextMenu({
      getAnchor: () => ({ x, y }),
      getActions: () => actions,
      getActionViewItem: (action) => {
        return new ActionViewItem(action, action, { label: true });
      }
    });
  }
  async updateSetting(uri, x, y) {
    if (uri.scheme === Schemas.codeSetting) {
      this._telemetryService.publicLog2("releaseNotesSettingAction", {
        settingId: uri.authority
      });
      return this.showContextMenu(uri, x, y);
    }
  }
};
SimpleSettingRenderer = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, IPreferencesService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IClipboardService)
], SimpleSettingRenderer);
export {
  SimpleSettingRenderer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tYXJrZG93bi9icm93c2VyL21hcmtkb3duU2V0dGluZ1JlbmRlcmVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQWN0aW9uVmlld0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYWN0aW9uYmFyL2FjdGlvblZpZXdJdGVtcy5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgdHlwZSB7IFRva2VucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcmtlZC9tYXJrZWQuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNsaXBib2FyZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jbGlwYm9hcmQvY29tbW9uL2NsaXBib2FyZFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblRhcmdldCwgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElQcmVmZXJlbmNlc1NlcnZpY2UsIElTZXR0aW5nIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzLmpzJztcbmltcG9ydCB7IHNldHRpbmdLZXlUb0Rpc3BsYXlGb3JtYXQgfSBmcm9tICcuLi8uLi9wcmVmZXJlbmNlcy9icm93c2VyL3NldHRpbmdzVHJlZU1vZGVscy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBTaW1wbGVTZXR0aW5nUmVuZGVyZXIge1xuXHRwcml2YXRlIHJlYWRvbmx5IGNvZGVTZXR0aW5nQW5jaG9yUmVnZXg6IFJlZ0V4cDtcblx0cHJpdmF0ZSByZWFkb25seSBjb2RlU2V0dGluZ1NpbXBsZVJlZ2V4OiBSZWdFeHA7XG5cblx0cHJpdmF0ZSBfdXBkYXRlZFNldHRpbmdzID0gbmV3IE1hcDxzdHJpbmcsIGFueT4oKTsgLy8gc2V0dGluZyBJRCB0byB1c2VyJ3Mgb3JpZ2luYWwgc2V0dGluZyB2YWx1ZVxuXHRwcml2YXRlIF9lbmNvdW50ZXJlZFNldHRpbmdzID0gbmV3IE1hcDxzdHJpbmcsIElTZXR0aW5nPigpOyAvLyBzZXR0aW5nIElEIHRvIHNldHRpbmdcblx0cHJpdmF0ZSBfZmVhdHVyZWRTZXR0aW5ncyA9IG5ldyBNYXA8c3RyaW5nLCBhbnk+KCk7IC8vIHNldHRpbmcgSUQgdG8gZmVhdHVyZSB2YWx1ZVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRNZW51U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElQcmVmZXJlbmNlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfcHJlZmVyZW5jZXNTZXJ2aWNlOiBJUHJlZmVyZW5jZXNTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUNsaXBib2FyZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY2xpcGJvYXJkU2VydmljZTogSUNsaXBib2FyZFNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuY29kZVNldHRpbmdBbmNob3JSZWdleCA9IG5ldyBSZWdFeHAoYF48YSAoaHJlZik9XCIuKmNvZGUuKjovL3NldHRpbmdzLyhbXlxcXFxzXCJdKylcIig/OlxcXFxzKmNvZGVzZXR0aW5nPVwiKFteXCJdKylcIik/PmApO1xuXHRcdHRoaXMuY29kZVNldHRpbmdTaW1wbGVSZWdleCA9IG5ldyBSZWdFeHAoYF5zZXR0aW5nXFxcXCgoW15cXFxcczopXSspKD86OihbXildKykpP1xcXFwpJGApO1xuXHR9XG5cblx0Z2V0IGZlYXR1cmVkU2V0dGluZ1N0YXRlcygpOiBNYXA8c3RyaW5nLCBib29sZWFuPiB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IE1hcDxzdHJpbmcsIGJvb2xlYW4+KCk7XG5cdFx0Zm9yIChjb25zdCBbc2V0dGluZ0lkLCB2YWx1ZV0gb2YgdGhpcy5fZmVhdHVyZWRTZXR0aW5ncykge1xuXHRcdFx0cmVzdWx0LnNldChzZXR0aW5nSWQsIHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKHNldHRpbmdJZCkgPT09IHZhbHVlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgcmVwbGFjZUFuY2hvcihyYXc6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgbWF0Y2ggPSB0aGlzLmNvZGVTZXR0aW5nQW5jaG9yUmVnZXguZXhlYyhyYXcpO1xuXHRcdGlmIChtYXRjaCAmJiBtYXRjaC5sZW5ndGggPT09IDQpIHtcblx0XHRcdGNvbnN0IHNldHRpbmdJZCA9IG1hdGNoWzJdO1xuXHRcdFx0Y29uc3QgcmVuZGVyZWQgPSB0aGlzLnJlbmRlcihzZXR0aW5nSWQsIG1hdGNoWzNdKTtcblx0XHRcdGlmIChyZW5kZXJlZCkge1xuXHRcdFx0XHRyZXR1cm4gcmF3LnJlcGxhY2UodGhpcy5jb2RlU2V0dGluZ0FuY2hvclJlZ2V4LCByZW5kZXJlZCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIHJlcGxhY2VTaW1wbGUocmF3OiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IG1hdGNoID0gdGhpcy5jb2RlU2V0dGluZ1NpbXBsZVJlZ2V4LmV4ZWMocmF3KTtcblx0XHRpZiAobWF0Y2ggJiYgbWF0Y2gubGVuZ3RoID09PSAzKSB7XG5cdFx0XHRjb25zdCBzZXR0aW5nSWQgPSBtYXRjaFsxXTtcblx0XHRcdGNvbnN0IHJlbmRlcmVkID0gdGhpcy5yZW5kZXIoc2V0dGluZ0lkLCBtYXRjaFsyXSk7XG5cdFx0XHRpZiAocmVuZGVyZWQpIHtcblx0XHRcdFx0cmV0dXJuIHJhdy5yZXBsYWNlKHRoaXMuY29kZVNldHRpbmdTaW1wbGVSZWdleCwgcmVuZGVyZWQpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0Z2V0SHRtbFJlbmRlcmVyKCk6ICh0b2tlbjogVG9rZW5zLkhUTUwgfCBUb2tlbnMuVGFnKSA9PiBzdHJpbmcge1xuXHRcdHJldHVybiAoeyByYXcgfTogVG9rZW5zLkhUTUwgfCBUb2tlbnMuVGFnKTogc3RyaW5nID0+IHtcblx0XHRcdGNvbnN0IHJlcGxhY2VkQW5jaG9yID0gdGhpcy5yZXBsYWNlQW5jaG9yKHJhdyk7XG5cdFx0XHRpZiAocmVwbGFjZWRBbmNob3IpIHtcblx0XHRcdFx0cmF3ID0gcmVwbGFjZWRBbmNob3I7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmF3O1xuXHRcdH07XG5cdH1cblxuXHRnZXRDb2RlU3BhblJlbmRlcmVyKCk6ICh0b2tlbjogVG9rZW5zLkNvZGVzcGFuKSA9PiBzdHJpbmcge1xuXHRcdHJldHVybiAoeyB0ZXh0IH06IFRva2Vucy5Db2Rlc3Bhbik6IHN0cmluZyA9PiB7XG5cdFx0XHRjb25zdCByZXBsYWNlZFNpbXBsZSA9IHRoaXMucmVwbGFjZVNpbXBsZSh0ZXh0KTtcblx0XHRcdGlmIChyZXBsYWNlZFNpbXBsZSkge1xuXHRcdFx0XHRyZXR1cm4gcmVwbGFjZWRTaW1wbGU7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYDxjb2RlPiR7dGV4dH08L2NvZGU+YDtcblx0XHR9O1xuXHR9XG5cblx0c2V0dGluZ1RvVXJpU3RyaW5nKHNldHRpbmdJZDogc3RyaW5nLCB2YWx1ZT86IGFueSk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGAke1NjaGVtYXMuY29kZVNldHRpbmd9Oi8vJHtzZXR0aW5nSWR9JHt2YWx1ZSA/IGAvJHt2YWx1ZX1gIDogJyd9YDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0U2V0dGluZyhzZXR0aW5nSWQ6IHN0cmluZyk6IElTZXR0aW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodGhpcy5fZW5jb3VudGVyZWRTZXR0aW5ncy5oYXMoc2V0dGluZ0lkKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2VuY291bnRlcmVkU2V0dGluZ3MuZ2V0KHNldHRpbmdJZCk7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9wcmVmZXJlbmNlc1NlcnZpY2UuZ2V0U2V0dGluZyhzZXR0aW5nSWQpO1xuXHR9XG5cblx0cGFyc2VWYWx1ZShzZXR0aW5nSWQ6IHN0cmluZywgdmFsdWU6IHN0cmluZykge1xuXHRcdGlmICh2YWx1ZSA9PT0gJ3VuZGVmaW5lZCcgfHwgdmFsdWUgPT09ICcnKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBzZXR0aW5nID0gdGhpcy5nZXRTZXR0aW5nKHNldHRpbmdJZCk7XG5cdFx0aWYgKCFzZXR0aW5nKSB7XG5cdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0fVxuXG5cdFx0c3dpdGNoIChzZXR0aW5nLnR5cGUpIHtcblx0XHRcdGNhc2UgJ2Jvb2xlYW4nOlxuXHRcdFx0XHRyZXR1cm4gdmFsdWUgPT09ICd0cnVlJztcblx0XHRcdGNhc2UgJ251bWJlcic6XG5cdFx0XHRcdHJldHVybiBwYXJzZUludCh2YWx1ZSwgMTApO1xuXHRcdFx0Y2FzZSAnc3RyaW5nJzpcblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlcihzZXR0aW5nSWQ6IHN0cmluZywgbmV3VmFsdWU6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3Qgc2V0dGluZyA9IHRoaXMuZ2V0U2V0dGluZyhzZXR0aW5nSWQpO1xuXHRcdGlmICghc2V0dGluZykge1xuXHRcdFx0cmV0dXJuIGA8Y29kZT4ke3NldHRpbmdJZH08L2NvZGU+YDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5yZW5kZXJTZXR0aW5nKHNldHRpbmcsIG5ld1ZhbHVlKTtcblx0fVxuXG5cdHByaXZhdGUgdmlld0luU2V0dGluZ3NNZXNzYWdlKHNldHRpbmdJZDogc3RyaW5nLCBhbHJlYWR5RGlzcGxheWVkOiBib29sZWFuKSB7XG5cdFx0aWYgKGFscmVhZHlEaXNwbGF5ZWQpIHtcblx0XHRcdHJldHVybiBubHMubG9jYWxpemUoJ3ZpZXdJblNldHRpbmdzJywgXCJWaWV3IGluIFNldHRpbmdzXCIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb25zdCBkaXNwbGF5TmFtZSA9IHNldHRpbmdLZXlUb0Rpc3BsYXlGb3JtYXQoc2V0dGluZ0lkKTtcblx0XHRcdHJldHVybiBubHMubG9jYWxpemUoJ3ZpZXdJblNldHRpbmdzRGV0YWlsZWQnLCBcIlZpZXcgXFxcInswfTogezF9XFxcIiBpbiBTZXR0aW5nc1wiLCBkaXNwbGF5TmFtZS5jYXRlZ29yeSwgZGlzcGxheU5hbWUubGFiZWwpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgcmVzdG9yZVByZXZpb3VzU2V0dGluZ01lc3NhZ2Uoc2V0dGluZ0lkOiBzdHJpbmcpOiBzdHJpbmcge1xuXHRcdGNvbnN0IGRpc3BsYXlOYW1lID0gc2V0dGluZ0tleVRvRGlzcGxheUZvcm1hdChzZXR0aW5nSWQpO1xuXHRcdHJldHVybiBubHMubG9jYWxpemUoJ3Jlc3RvcmVQcmV2aW91c1ZhbHVlJywgXCJSZXN0b3JlIHZhbHVlIG9mIFxcXCJ7MH06IHsxfVxcXCJcIiwgZGlzcGxheU5hbWUuY2F0ZWdvcnksIGRpc3BsYXlOYW1lLmxhYmVsKTtcblx0fVxuXG5cdHByaXZhdGUgaXNBbHJlYWR5U2V0KHNldHRpbmc6IElTZXR0aW5nLCB2YWx1ZTogc3RyaW5nIHwgbnVtYmVyIHwgYm9vbGVhbik6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGN1cnJlbnRWYWx1ZSA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPGJvb2xlYW4+KHNldHRpbmcua2V5KTtcblx0XHRyZXR1cm4gKGN1cnJlbnRWYWx1ZSA9PT0gdmFsdWUgfHwgKGN1cnJlbnRWYWx1ZSA9PT0gdW5kZWZpbmVkICYmIHNldHRpbmcudmFsdWUgPT09IHZhbHVlKSk7XG5cdH1cblxuXHRwcml2YXRlIGJvb2xlYW5TZXR0aW5nTWVzc2FnZShzZXR0aW5nOiBJU2V0dGluZywgYm9vbGVhblZhbHVlOiBib29sZWFuKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBkaXNwbGF5TmFtZSA9IHNldHRpbmdLZXlUb0Rpc3BsYXlGb3JtYXQoc2V0dGluZy5rZXkpO1xuXHRcdGlmICh0aGlzLmlzQWxyZWFkeVNldChzZXR0aW5nLCBib29sZWFuVmFsdWUpKSB7XG5cdFx0XHRpZiAoYm9vbGVhblZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiBubHMubG9jYWxpemUoJ2FscmVhZHlzZXRCb29sVHJ1ZScsIFwiXFxcInswfTogezF9XFxcIiBpcyBhbHJlYWR5IGVuYWJsZWRcIiwgZGlzcGxheU5hbWUuY2F0ZWdvcnksIGRpc3BsYXlOYW1lLmxhYmVsKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiBubHMubG9jYWxpemUoJ2FscmVhZHlzZXRCb29sRmFsc2UnLCBcIlxcXCJ7MH06IHsxfVxcXCIgaXMgYWxyZWFkeSBkaXNhYmxlZFwiLCBkaXNwbGF5TmFtZS5jYXRlZ29yeSwgZGlzcGxheU5hbWUubGFiZWwpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChib29sZWFuVmFsdWUpIHtcblx0XHRcdHJldHVybiBubHMubG9jYWxpemUoJ3RydWVNZXNzYWdlJywgXCJFbmFibGUgXFxcInswfTogezF9XFxcIlwiLCBkaXNwbGF5TmFtZS5jYXRlZ29yeSwgZGlzcGxheU5hbWUubGFiZWwpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdmYWxzZU1lc3NhZ2UnLCBcIkRpc2FibGUgXFxcInswfTogezF9XFxcIlwiLCBkaXNwbGF5TmFtZS5jYXRlZ29yeSwgZGlzcGxheU5hbWUubGFiZWwpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc3RyaW5nU2V0dGluZ01lc3NhZ2Uoc2V0dGluZzogSVNldHRpbmcsIHN0cmluZ1ZhbHVlOiBzdHJpbmcpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGRpc3BsYXlOYW1lID0gc2V0dGluZ0tleVRvRGlzcGxheUZvcm1hdChzZXR0aW5nLmtleSk7XG5cdFx0aWYgKHRoaXMuaXNBbHJlYWR5U2V0KHNldHRpbmcsIHN0cmluZ1ZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIG5scy5sb2NhbGl6ZSgnYWxyZWFkeXNldFN0cmluZycsIFwiXFxcInswfTogezF9XFxcIiBpcyBhbHJlYWR5IHNldCB0byBcXFwiezJ9XFxcIlwiLCBkaXNwbGF5TmFtZS5jYXRlZ29yeSwgZGlzcGxheU5hbWUubGFiZWwsIHN0cmluZ1ZhbHVlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbmxzLmxvY2FsaXplKCdzdHJpbmdWYWx1ZScsIFwiU2V0IFxcXCJ7MH06IHsxfVxcXCIgdG8gXFxcInsyfVxcXCJcIiwgZGlzcGxheU5hbWUuY2F0ZWdvcnksIGRpc3BsYXlOYW1lLmxhYmVsLCBzdHJpbmdWYWx1ZSk7XG5cdH1cblxuXHRwcml2YXRlIG51bWJlclNldHRpbmdNZXNzYWdlKHNldHRpbmc6IElTZXR0aW5nLCBudW1iZXJWYWx1ZTogbnVtYmVyKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBkaXNwbGF5TmFtZSA9IHNldHRpbmdLZXlUb0Rpc3BsYXlGb3JtYXQoc2V0dGluZy5rZXkpO1xuXHRcdGlmICh0aGlzLmlzQWxyZWFkeVNldChzZXR0aW5nLCBudW1iZXJWYWx1ZSkpIHtcblx0XHRcdHJldHVybiBubHMubG9jYWxpemUoJ2FscmVhZHlzZXROdW0nLCBcIlxcXCJ7MH06IHsxfVxcXCIgaXMgYWxyZWFkeSBzZXQgdG8gezJ9XCIsIGRpc3BsYXlOYW1lLmNhdGVnb3J5LCBkaXNwbGF5TmFtZS5sYWJlbCwgbnVtYmVyVmFsdWUpO1xuXHRcdH1cblxuXHRcdHJldHVybiBubHMubG9jYWxpemUoJ251bWJlclZhbHVlJywgXCJTZXQgXFxcInswfTogezF9XFxcIiB0byB7Mn1cIiwgZGlzcGxheU5hbWUuY2F0ZWdvcnksIGRpc3BsYXlOYW1lLmxhYmVsLCBudW1iZXJWYWx1ZSk7XG5cblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyU2V0dGluZyhzZXR0aW5nOiBJU2V0dGluZywgbmV3VmFsdWU6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgaHJlZiA9IHRoaXMuc2V0dGluZ1RvVXJpU3RyaW5nKHNldHRpbmcua2V5LCBuZXdWYWx1ZSk7XG5cdFx0Y29uc3QgdGl0bGUgPSBubHMubG9jYWxpemUoJ2NoYW5nZVNldHRpbmdUaXRsZScsIFwiVmlldyBvciBjaGFuZ2Ugc2V0dGluZ1wiKTtcblx0XHRyZXR1cm4gYDxjb2RlIHRhYmluZGV4PVwiMFwiPjxhIGhyZWY9XCIke2hyZWZ9XCIgY2xhc3M9XCJjb2Rlc2V0dGluZ1wiIHRpdGxlPVwiJHt0aXRsZX1cIiBhcmlhLXJvbGU9XCJidXR0b25cIj48c3ZnIHdpZHRoPVwiMTRcIiBoZWlnaHQ9XCIxNFwiIHZpZXdCb3g9XCIwIDAgMTUgMTVcIiB4bWxucz1cImh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnXCIgZmlsbD1cImN1cnJlbnRDb2xvclwiPjxwYXRoIGQ9XCJNOS4xIDQuNEw4LjYgMkg3LjRsLS41IDIuNC0uNy4zLTItMS4zLS45LjggMS4zIDItLjIuNy0yLjQuNXYxLjJsMi40LjUuMy44LTEuMyAyIC44LjggMi0xLjMuOC4zLjQgMi4zaDEuMmwuNS0yLjQuOC0uMyAyIDEuMy44LS44LTEuMy0yIC4zLS44IDIuMy0uNFY3LjRsLTIuNC0uNS0uMy0uOCAxLjMtMi0uOC0uOC0yIDEuMy0uNy0uMnpNOS40IDFsLjUgMi40TDEyIDIuMWwyIDItMS40IDIuMSAyLjQuNHYyLjhsLTIuNC41TDE0IDEybC0yIDItMi4xLTEuNC0uNSAyLjRINi42bC0uNS0yLjRMNCAxMy45bC0yLTIgMS40LTIuMUwxIDkuNFY2LjZsMi40LS41TDIuMSA0bDItMiAyLjEgMS40LjQtMi40aDIuOHptLjYgN2MwIDEuMS0uOSAyLTIgMnMtMi0uOS0yLTIgLjktMiAyLTIgMiAuOSAyIDJ6TTggOWMuNiAwIDEtLjQgMS0xcy0uNC0xLTEtMS0xIC40LTEgMSAuNCAxIDEgMXpcIi8+PC9zdmc+XG5cdFx0XHQ8c3BhbiBjbGFzcz1cInNlcGFyYXRvclwiPjwvc3Bhbj5cblx0XHRcdDxzcGFuIGNsYXNzPVwic2V0dGluZy1uYW1lXCI+JHtzZXR0aW5nLmtleX08L3NwYW4+XG5cdFx0PC9hPjwvY29kZT5gO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRTZXR0aW5nTWVzc2FnZShzZXR0aW5nOiBJU2V0dGluZywgbmV3VmFsdWU6IGJvb2xlYW4gfCBzdHJpbmcgfCBudW1iZXIpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdGlmIChzZXR0aW5nLnR5cGUgPT09ICdib29sZWFuJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuYm9vbGVhblNldHRpbmdNZXNzYWdlKHNldHRpbmcsIG5ld1ZhbHVlIGFzIGJvb2xlYW4pO1xuXHRcdH0gZWxzZSBpZiAoc2V0dGluZy50eXBlID09PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuc3RyaW5nU2V0dGluZ01lc3NhZ2Uoc2V0dGluZywgbmV3VmFsdWUgYXMgc3RyaW5nKTtcblx0XHR9IGVsc2UgaWYgKHNldHRpbmcudHlwZSA9PT0gJ251bWJlcicpIHtcblx0XHRcdHJldHVybiB0aGlzLm51bWJlclNldHRpbmdNZXNzYWdlKHNldHRpbmcsIG5ld1ZhbHVlIGFzIG51bWJlcik7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRhc3luYyByZXN0b3JlU2V0dGluZyhzZXR0aW5nSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHVzZXJPcmlnaW5hbFNldHRpbmdWYWx1ZSA9IHRoaXMuX3VwZGF0ZWRTZXR0aW5ncy5nZXQoc2V0dGluZ0lkKTtcblx0XHR0aGlzLl91cGRhdGVkU2V0dGluZ3MuZGVsZXRlKHNldHRpbmdJZCk7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKHNldHRpbmdJZCwgdXNlck9yaWdpbmFsU2V0dGluZ1ZhbHVlLCBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVIpO1xuXHR9XG5cblx0YXN5bmMgc2V0U2V0dGluZyhzZXR0aW5nSWQ6IHN0cmluZywgY3VycmVudFNldHRpbmdWYWx1ZTogYW55LCBuZXdTZXR0aW5nVmFsdWU6IGFueSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3VwZGF0ZWRTZXR0aW5ncy5zZXQoc2V0dGluZ0lkLCBjdXJyZW50U2V0dGluZ1ZhbHVlKTtcblx0XHRyZXR1cm4gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoc2V0dGluZ0lkLCBuZXdTZXR0aW5nVmFsdWUsIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUik7XG5cdH1cblxuXHRnZXRBY3Rpb25zKHVyaTogVVJJKSB7XG5cdFx0aWYgKHVyaS5zY2hlbWUgIT09IFNjaGVtYXMuY29kZVNldHRpbmcpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBhY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblxuXHRcdGNvbnN0IHNldHRpbmdJZCA9IHVyaS5hdXRob3JpdHk7XG5cdFx0Y29uc3QgbmV3U2V0dGluZ1ZhbHVlID0gdGhpcy5wYXJzZVZhbHVlKHVyaS5hdXRob3JpdHksIHVyaS5wYXRoLnN1YnN0cmluZygxKSk7XG5cdFx0Y29uc3QgY3VycmVudFNldHRpbmdWYWx1ZSA9IHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmluc3BlY3Qoc2V0dGluZ0lkKS51c2VyVmFsdWU7XG5cblx0XHRpZiAoKG5ld1NldHRpbmdWYWx1ZSAhPT0gdW5kZWZpbmVkKSAmJiBuZXdTZXR0aW5nVmFsdWUgPT09IGN1cnJlbnRTZXR0aW5nVmFsdWUgJiYgdGhpcy5fdXBkYXRlZFNldHRpbmdzLmhhcyhzZXR0aW5nSWQpKSB7XG5cdFx0XHRjb25zdCByZXN0b3JlTWVzc2FnZSA9IHRoaXMucmVzdG9yZVByZXZpb3VzU2V0dGluZ01lc3NhZ2Uoc2V0dGluZ0lkKTtcblx0XHRcdGFjdGlvbnMucHVzaCh7XG5cdFx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRcdGlkOiAncmVzdG9yZVNldHRpbmcnLFxuXHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHR0b29sdGlwOiByZXN0b3JlTWVzc2FnZSxcblx0XHRcdFx0bGFiZWw6IHJlc3RvcmVNZXNzYWdlLFxuXHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5yZXN0b3JlU2V0dGluZyhzZXR0aW5nSWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9IGVsc2UgaWYgKG5ld1NldHRpbmdWYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb25zdCBzZXR0aW5nID0gdGhpcy5nZXRTZXR0aW5nKHNldHRpbmdJZCk7XG5cdFx0XHRjb25zdCB0cnlTZXR0aW5nTWVzc2FnZSA9IHNldHRpbmcgPyB0aGlzLmdldFNldHRpbmdNZXNzYWdlKHNldHRpbmcsIG5ld1NldHRpbmdWYWx1ZSkgOiB1bmRlZmluZWQ7XG5cblx0XHRcdGlmIChzZXR0aW5nICYmIHRyeVNldHRpbmdNZXNzYWdlKSB7XG5cdFx0XHRcdGFjdGlvbnMucHVzaCh7XG5cdFx0XHRcdFx0Y2xhc3M6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRpZDogJ3RyeVNldHRpbmcnLFxuXHRcdFx0XHRcdGVuYWJsZWQ6ICF0aGlzLmlzQWxyZWFkeVNldChzZXR0aW5nLCBuZXdTZXR0aW5nVmFsdWUpLFxuXHRcdFx0XHRcdHRvb2x0aXA6IHRyeVNldHRpbmdNZXNzYWdlLFxuXHRcdFx0XHRcdGxhYmVsOiB0cnlTZXR0aW5nTWVzc2FnZSxcblx0XHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMuc2V0U2V0dGluZyhzZXR0aW5nSWQsIGN1cnJlbnRTZXR0aW5nVmFsdWUsIG5ld1NldHRpbmdWYWx1ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCB2aWV3SW5TZXR0aW5nc01lc3NhZ2UgPSB0aGlzLnZpZXdJblNldHRpbmdzTWVzc2FnZShzZXR0aW5nSWQsIGFjdGlvbnMubGVuZ3RoID4gMCk7XG5cdFx0YWN0aW9ucy5wdXNoKHtcblx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0aWQ6ICd2aWV3SW5TZXR0aW5ncycsXG5cdFx0XHR0b29sdGlwOiB2aWV3SW5TZXR0aW5nc01lc3NhZ2UsXG5cdFx0XHRsYWJlbDogdmlld0luU2V0dGluZ3NNZXNzYWdlLFxuXHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9wcmVmZXJlbmNlc1NlcnZpY2Uub3BlbkFwcGxpY2F0aW9uU2V0dGluZ3MoeyBxdWVyeTogYEBpZDoke3NldHRpbmdJZH1gIH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0YWN0aW9ucy5wdXNoKHtcblx0XHRcdGNsYXNzOiB1bmRlZmluZWQsXG5cdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0aWQ6ICdjb3B5U2V0dGluZ0lkJyxcblx0XHRcdHRvb2x0aXA6IG5scy5sb2NhbGl6ZSgnY29weVNldHRpbmdJZCcsIFwiQ29weSBTZXR0aW5nIElEXCIpLFxuXHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgnY29weVNldHRpbmdJZCcsIFwiQ29weSBTZXR0aW5nIElEXCIpLFxuXHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX2NsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KHNldHRpbmdJZCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gYWN0aW9ucztcblx0fVxuXG5cdHByaXZhdGUgc2hvd0NvbnRleHRNZW51KHVyaTogVVJJLCB4OiBudW1iZXIsIHk6IG51bWJlcikge1xuXHRcdGNvbnN0IGFjdGlvbnMgPSB0aGlzLmdldEFjdGlvbnModXJpKTtcblx0XHRpZiAoIWFjdGlvbnMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdGdldEFuY2hvcjogKCkgPT4gKHsgeCwgeSB9KSxcblx0XHRcdGdldEFjdGlvbnM6ICgpID0+IGFjdGlvbnMsXG5cdFx0XHRnZXRBY3Rpb25WaWV3SXRlbTogKGFjdGlvbikgPT4ge1xuXHRcdFx0XHRyZXR1cm4gbmV3IEFjdGlvblZpZXdJdGVtKGFjdGlvbiwgYWN0aW9uLCB7IGxhYmVsOiB0cnVlIH0pO1xuXHRcdFx0fSxcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jIHVwZGF0ZVNldHRpbmcodXJpOiBVUkksIHg6IG51bWJlciwgeTogbnVtYmVyKSB7XG5cdFx0aWYgKHVyaS5zY2hlbWUgPT09IFNjaGVtYXMuY29kZVNldHRpbmcpIHtcblx0XHRcdHR5cGUgUmVsZWFzZU5vdGVzU2V0dGluZ1VzZWRDbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdFx0b3duZXI6ICdhbGV4cjAwJztcblx0XHRcdFx0Y29tbWVudDogJ1VzZWQgdG8gdW5kZXJzdGFuZCBpZiB0aGUgYWN0aW9uIHRvIHVwZGF0ZSBzZXR0aW5ncyBmcm9tIHRoZSByZWxlYXNlIG5vdGVzIGlzIHVzZWQuJztcblx0XHRcdFx0c2V0dGluZ0lkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGlkIG9mIHRoZSBzZXR0aW5nIHRoYXQgd2FzIGNsaWNrZWQgb24gaW4gdGhlIHJlbGVhc2Ugbm90ZXMnIH07XG5cdFx0XHR9O1xuXHRcdFx0dHlwZSBSZWxlYXNlTm90ZXNTZXR0aW5nVXNlZCA9IHtcblx0XHRcdFx0c2V0dGluZ0lkOiBzdHJpbmc7XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fdGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFJlbGVhc2VOb3Rlc1NldHRpbmdVc2VkLCBSZWxlYXNlTm90ZXNTZXR0aW5nVXNlZENsYXNzaWZpY2F0aW9uPigncmVsZWFzZU5vdGVzU2V0dGluZ0FjdGlvbicsIHtcblx0XHRcdFx0c2V0dGluZ0lkOiB1cmkuYXV0aG9yaXR5XG5cdFx0XHR9KTtcblx0XHRcdHJldHVybiB0aGlzLnNob3dDb250ZXh0TWVudSh1cmksIHgsIHkpO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHNCQUFzQjtBQUcvQixTQUFTLGVBQWU7QUFFeEIsWUFBWSxTQUFTO0FBQ3JCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMscUJBQXFCLDZCQUE2QjtBQUMzRCxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDJCQUFxQztBQUM5QyxTQUFTLGlDQUFpQztBQUVuQyxJQUFNLHdCQUFOLE1BQTRCO0FBQUE7QUFBQSxFQVFsQyxZQUN5Qyx1QkFDRixxQkFDQSxxQkFDRixtQkFDQSxtQkFDbkM7QUFMdUM7QUFDRjtBQUNBO0FBQ0Y7QUFDQTtBQVRyQyxTQUFRLG1CQUFtQixvQkFBSSxJQUFpQjtBQUNoRDtBQUFBLFNBQVEsdUJBQXVCLG9CQUFJLElBQXNCO0FBQ3pEO0FBQUEsU0FBUSxvQkFBb0Isb0JBQUksSUFBaUI7QUFTaEQsU0FBSyx5QkFBeUIsSUFBSSxPQUFPLDRFQUE0RTtBQUNySCxTQUFLLHlCQUF5QixJQUFJLE9BQU8seUNBQXlDO0FBQUEsRUFDbkY7QUFBQSxFQUVBLElBQUksd0JBQThDO0FBQ2pELFVBQU0sU0FBUyxvQkFBSSxJQUFxQjtBQUN4QyxlQUFXLENBQUMsV0FBVyxLQUFLLEtBQUssS0FBSyxtQkFBbUI7QUFDeEQsYUFBTyxJQUFJLFdBQVcsS0FBSyxzQkFBc0IsU0FBUyxTQUFTLE1BQU0sS0FBSztBQUFBLElBQy9FO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLGNBQWMsS0FBaUM7QUFDdEQsVUFBTSxRQUFRLEtBQUssdUJBQXVCLEtBQUssR0FBRztBQUNsRCxRQUFJLFNBQVMsTUFBTSxXQUFX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
