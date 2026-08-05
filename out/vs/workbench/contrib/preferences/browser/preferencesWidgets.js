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
import { ActionBar, ActionsOrientation } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { BaseActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { Widget } from "../../../../base/browser/ui/widget.js";
import { Action } from "../../../../base/common/actions.js";
import { Emitter } from "../../../../base/common/event.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { MouseTargetType } from "../../../../editor/browser/editorBrowser.js";
import { TrackedRangeStickiness } from "../../../../editor/common/model.js";
import { localize } from "../../../../nls.js";
import { ContextScopedHistoryInputBox } from "../../../../platform/history/browser/contextScopedHistoryWidget.js";
import { showHistoryKeybindingHint } from "../../../../platform/history/browser/historyWidgetKeybindingHint.js";
import { ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IContextMenuService, IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { asCssVariable, badgeBackground, badgeForeground, contrastBorder } from "../../../../platform/theme/common/colorRegistry.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { isWorkspaceFolder, IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { settingsEditIcon, settingsScopeDropDownIcon } from "./preferencesIcons.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { IHoverService } from "../../../../platform/hover/browser/hover.js";
let FolderSettingsActionViewItem = class extends BaseActionViewItem {
  constructor(action, contextService, contextMenuService, hoverService) {
    super(null, action);
    this.contextService = contextService;
    this.contextMenuService = contextMenuService;
    this.hoverService = hoverService;
    this._folderSettingCounts = /* @__PURE__ */ new Map();
    const workspace = this.contextService.getWorkspace();
    this._folder = workspace.folders.length === 1 ? workspace.folders[0] : null;
    this._register(this.contextService.onDidChangeWorkspaceFolders(() => this.onWorkspaceFoldersChanged()));
  }
  get folder() {
    return this._folder;
  }
  set folder(folder) {
    this._folder = folder;
    this.update();
  }
  setCount(settingsTarget, count) {
    const workspaceFolder = this.contextService.getWorkspaceFolder(settingsTarget);
    if (!workspaceFolder) {
      throw new Error("unknown folder");
    }
    const folder = workspaceFolder.uri;
    this._folderSettingCounts.set(folder.toString(), count);
    this.update();
  }
  render(container) {
    this.element = container;
    this.container = container;
    this.labelElement = DOM.$(".action-title");
    this.detailsElement = DOM.$(".action-details");
    this.dropDownElement = DOM.$(".dropdown-icon.hide" + ThemeIcon.asCSSSelector(settingsScopeDropDownIcon));
    this.anchorElement = DOM.$("a.action-label.folder-settings", {
      role: "button",
      "aria-haspopup": "true",
      "tabindex": "0"
    }, this.labelElement, this.detailsElement, this.dropDownElement);
    this.anchorElementHover = this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate("mouse"), this.anchorElement, ""));
    this._register(DOM.addDisposableListener(this.anchorElement, DOM.EventType.MOUSE_DOWN, (e) => DOM.EventHelper.stop(e)));
    this._register(DOM.addDisposableListener(this.anchorElement, DOM.EventType.CLICK, (e) => this.onClick(e)));
    this._register(DOM.addDisposableListener(this.container, DOM.EventType.KEY_UP, (e) => this.onKeyUp(e)));
    DOM.append(this.container, this.anchorElement);
    this.update();
  }
  onKeyUp(event) {
    const keyboardEvent = new StandardKeyboardEvent(event);
    switch (keyboardEvent.keyCode) {
      case KeyCode.Enter:
      case KeyCode.Space:
        this.onClick(event);
        return;
    }
  }
  onClick(event) {
    DOM.EventHelper.stop(event, true);
    if (!this.folder || this._action.checked) {
      this.showMenu();
    } else {
      this._action.run(this._folder);
    }
  }
  updateEnabled() {
    this.update();
  }
  updateChecked() {
    this.update();
  }
  onWorkspaceFoldersChanged() {
    const oldFolder = this._folder;
    const workspace = this.contextService.getWorkspace();
    if (oldFolder) {
      this._folder = workspace.folders.filter((folder) => isEqual(folder.uri, oldFolder.uri))[0] || workspace.folders[0];
    }
    this._folder = this._folder ? this._folder : workspace.folders.length === 1 ? workspace.folders[0] : null;
    this.update();
    if (this._action.checked) {
      this._action.run(this._folder);
    }
  }
  update() {
    let total = 0;
    this._folderSettingCounts.forEach((n) => total += n);
    const workspace = this.contextService.getWorkspace();
    if (this._folder) {
      this.labelElement.textContent = this._folder.name;
      this.anchorElementHover.update(this._folder.name);
      const detailsText = this.labelWithCount(this._action.label, total);
      this.detailsElement.textContent = detailsText;
      this.dropDownElement.classList.toggle("hide", workspace.folders.length === 1 || !this._action.checked);
    } else {
      const labelText = this.labelWithCount(this._action.label, total);
      this.labelElement.textContent = labelText;
      this.detailsElement.textContent = "";
      this.anchorElementHover.update(this._action.label);
      this.dropDownElement.classList.remove("hide");
    }
    this.anchorElement.classList.toggle("checked", this._action.checked);
    this.container.classList.toggle("disabled", !this._action.enabled);
  }
  showMenu() {
    this.contextMenuService.showContextMenu({
      getAnchor: () => this.container,
      getActions: () => this.getDropdownMenuActions(),
      getActionViewItem: () => void 0,
      onHide: () => {
        this.anchorElement.blur();
      }
    });
  }
  getDropdownMenuActions() {
    const actions = [];
    const workspaceFolders = this.contextService.getWorkspace().folders;
    if (this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE && workspaceFolders.length > 0) {
      actions.push(...workspaceFolders.map((folder, index) => {
        const folderCount = this._folderSettingCounts.get(folder.uri.toString());
        return {
          id: "folderSettingsTarget" + index,
          label: this.labelWithCount(folder.name, folderCount),
          tooltip: this.labelWithCount(folder.name, folderCount),
          checked: !!this.folder && isEqual(this.folder.uri, folder.uri),
          enabled: true,
          class: void 0,
          run: () => this._action.run(folder)
        };
      }));
    }
    return actions;
  }
  labelWithCount(label, count) {
    if (count) {
      label += ` (${count})`;
    }
    return label;
  }
};
FolderSettingsActionViewItem = __decorateClass([
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IHoverService)
], FolderSettingsActionViewItem);
let SettingsTargetsWidget = class extends Widget {
  constructor(parent, options, contextService, instantiationService, environmentService, labelService, languageService) {
    super();
    this.contextService = contextService;
    this.instantiationService = instantiationService;
    this.environmentService = environmentService;
    this.labelService = labelService;
    this.languageService = languageService;
    this._settingsTarget = null;
    this._onDidTargetChange = this._register(new Emitter());
    this.onDidTargetChange = this._onDidTargetChange.event;
    this.options = options ?? {};
    this.create(parent);
    this._register(this.contextService.onDidChangeWorkbenchState(() => this.onWorkbenchStateChanged()));
    this._register(this.contextService.onDidChangeWorkspaceFolders(() => this.update()));
  }
  resetLabels() {
    const remoteAuthority = this.environmentService.remoteAuthority;
    const hostLabel = remoteAuthority && this.labelService.getHostLabel(Schemas.vscodeRemote, remoteAuthority);
    this.userLocalSettings.label = localize("userSettings", "User");
    this.userRemoteSettings.label = localize("userSettingsRemote", "Remote") + (hostLabel ? ` [${hostLabel}]` : "");
    this.workspaceSettings.label = localize("workspaceSettings", "Workspace");
    this.folderSettingsAction.label = localize("folderSettings", "Folder");
  }
  create(parent) {
    const settingsTabsWidget = DOM.append(parent, DOM.$(".settings-tabs-widget"));
    this.settingsSwitcherBar = this._register(new ActionBar(settingsTabsWidget, {
      orientation: ActionsOrientation.HORIZONTAL,
      focusOnlyEnabledItems: true,
      ariaLabel: localize("settingsSwitcherBarAriaLabel", "Settings Switcher"),
      ariaRole: "tablist",
      actionViewItemProvider: (action, options) => action.id === "folderSettings" ? this.folderSettings : void 0
    }));
    this.userLocalSettings = new Action("userSettings", "", ".settings-tab", true, () => this.updateTarget(ConfigurationTarget.USER_LOCAL));
    this.userLocalSettings.tooltip = localize("userSettings", "User");
    this.userRemoteSettings = new Action("userSettingsRemote", "", ".settings-tab", true, () => this.updateTarget(ConfigurationTarget.USER_REMOTE));
    const remoteAuthority = this.environmentService.remoteAuthority;
    const hostLabel = remoteAuthority && this.labelService.getHostLabel(Schemas.vscodeRemote, remoteAuthority);
    this.userRemoteSettings.tooltip = localize("userSettingsRemote", "Remote") + (hostLabel ? ` [${hostLabel}]` : "");
    this.workspaceSettings = new Action("workspaceSettings", "", ".settings-tab", false, () => this.updateTarget(ConfigurationTarget.WORKSPACE));
    this.folderSettingsAction = new Action("folderSettings", "", ".settings-tab", false, async (folder) => {
      this.updateTarget(isWorkspaceFolder(folder) ? folder.uri : ConfigurationTarget.USER_LOCAL);
    });
    this.folderSettings = this.instantiationService.createInstance(FolderSettingsActionViewItem, this.folderSettingsAction);
    this.resetLabels();
    this.update();
    this.settingsSwitcherBar.push([this.userLocalSettings, this.userRemoteSettings, this.workspaceSettings, this.folderSettingsAction]);
  }
  get settingsTarget() {
    return this._settingsTarget;
  }
  set settingsTarget(settingsTarget) {
    this._settingsTarget = settingsTarget;
    this.userLocalSettings.checked = ConfigurationTarget.USER_LOCAL === this.settingsTarget;
    this.userRemoteSettings.checked = ConfigurationTarget.USER_REMOTE === this.settingsTarget;
    this.workspaceSettings.checked = ConfigurationTarget.WORKSPACE === this.settingsTarget;
    if (this.settingsTarget instanceof URI) {
      this.folderSettings.action.checked = true;
      this.folderSettings.folder = this.contextService.getWorkspaceFolder(this.settingsTarget);
    } else {
      this.folderSettings.action.checked = false;
    }
  }
  setResultCount(settingsTarget, count) {
    if (settingsTarget === ConfigurationTarget.WORKSPACE) {
      let label = localize("workspaceSettings", "Workspace");
      if (count) {
        label += ` (${count})`;
      }
      this.workspaceSettings.label = label;
    } else if (settingsTarget === ConfigurationTarget.USER_LOCAL) {
      let label = localize("userSettings", "User");
      if (count) {
        label += ` (${count})`;
      }
      this.userLocalSettings.label = label;
    } else if (settingsTarget instanceof URI) {
      this.folderSettings.setCount(settingsTarget, count);
    }
  }
  updateLanguageFilterIndicators(filter) {
    this.resetLabels();
    if (filter) {
      const languageToUse = this.languageService.getLanguageName(filter);
      if (languageToUse) {
        const languageSuffix = ` [${languageToUse}]`;
        this.userLocalSettings.label += languageSuffix;
        this.userRemoteSettings.label += languageSuffix;
        this.workspaceSettings.label += languageSuffix;
        this.folderSettingsAction.label += languageSuffix;
      }
    }
  }
  onWorkbenchStateChanged() {
    this.folderSettings.folder = null;
    this.update();
    if (this.settingsTarget === ConfigurationTarget.WORKSPACE && this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE) {
      this.updateTarget(ConfigurationTarget.USER_LOCAL);
    }
  }
  updateTarget(settingsTarget) {
    const isSameTarget = this.settingsTarget === settingsTarget || settingsTarget instanceof URI && this.settingsTarget instanceof URI && isEqual(this.settingsTarget, settingsTarget);
    if (!isSameTarget) {
      this.settingsTarget = settingsTarget;
      this._onDidTargetChange.fire(this.settingsTarget);
    }
    return Promise.resolve(void 0);
  }
  async update() {
    this.settingsSwitcherBar.domNode.classList.toggle("empty-workbench", this.contextService.getWorkbenchState() === WorkbenchState.EMPTY);
    this.userRemoteSettings.enabled = !!(this.options.enableRemoteSettings && this.environmentService.remoteAuthority);
    this.workspaceSettings.enabled = this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY;
    this.folderSettings.action.enabled = this.contextService.getWorkbenchState() === WorkbenchState.WORKSPACE && this.contextService.getWorkspace().folders.length > 0;
    this.workspaceSettings.tooltip = localize("workspaceSettings", "Workspace");
  }
};
SettingsTargetsWidget = __decorateClass([
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IWorkbenchEnvironmentService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, ILanguageService)
], SettingsTargetsWidget);
let SearchWidget = class extends Widget {
  constructor(parent, options, contextViewService, instantiationService, contextKeyService, keybindingService) {
    super();
    this.options = options;
    this.contextViewService = contextViewService;
    this.instantiationService = instantiationService;
    this.contextKeyService = contextKeyService;
    this.keybindingService = keybindingService;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._onFocus = this._register(new Emitter());
    this.onFocus = this._onFocus.event;
    this.create(parent);
  }
  create(parent) {
    this.domNode = DOM.append(parent, DOM.$("div.settings-header-widget"));
    this.createSearchContainer(DOM.append(this.domNode, DOM.$("div.settings-search-container")));
    this.controlsDiv = DOM.append(this.domNode, DOM.$("div.settings-search-controls"));
    if (this.options.showResultCount) {
      this.countElement = DOM.append(this.controlsDiv, DOM.$(".settings-count-widget"));
      this.countElement.style.backgroundColor = asCssVariable(badgeBackground);
      this.countElement.style.color = asCssVariable(badgeForeground);
      this.countElement.style.border = `1px solid ${asCssVariable(contrastBorder)}`;
    }
    this.inputBox.inputElement.setAttribute("aria-live", this.options.ariaLive || "off");
    if (this.options.ariaLabelledBy) {
      this.inputBox.inputElement.setAttribute("aria-labelledBy", this.options.ariaLabelledBy);
    }
    const focusTracker = this._register(DOM.trackFocus(this.inputBox.inputElement));
    this._register(focusTracker.onDidFocus(() => this._onFocus.fire()));
    const focusKey = this.options.focusKey;
    if (focusKey) {
      this._register(focusTracker.onDidFocus(() => focusKey.set(true)));
      this._register(focusTracker.onDidBlur(() => focusKey.set(false)));
    }
  }
  createSearchContainer(searchContainer) {
    this.searchContainer = searchContainer;
    const searchInput = DOM.append(this.searchContainer, DOM.$("div.settings-search-input"));
    this.inputBox = this._register(this.createInputBox(searchInput));
    this._register(this.inputBox.onDidChange((value) => this._onDidChange.fire(value)));
  }
  createInputBox(parent) {
    const showHistoryHint = () => showHistoryKeybindingHint(this.keybindingService);
    return new ContextScopedHistoryInputBox(parent, this.contextViewService, { ...this.options, showHistoryHint }, this.contextKeyService);
  }
  showMessage(message) {
    if (this.countElement && message !== this.countElement.textContent) {
      this.countElement.textContent = message;
      this.inputBox.inputElement.setAttribute("aria-label", message);
      this.inputBox.inputElement.style.paddingRight = this.getControlsWidth() + "px";
    }
  }
  layout(dimension) {
    if (dimension.width < 400) {
      this.countElement?.classList.add("hide");
      this.inputBox.inputElement.style.paddingRight = "0px";
    } else {
      this.countElement?.classList.remove("hide");
      this.inputBox.inputElement.style.paddingRight = this.getControlsWidth() + "px";
    }
  }
  getControlsWidth() {
    const countWidth = this.countElement ? DOM.getTotalWidth(this.countElement) : 0;
    return countWidth + 20;
  }
  focus() {
    this.inputBox.focus();
    if (this.getValue()) {
      this.inputBox.select();
    }
  }
  hasFocus() {
    return this.inputBox.hasFocus();
  }
  clear() {
    this.inputBox.value = "";
  }
  getValue() {
    return this.inputBox.value;
  }
  setValue(value) {
    return this.inputBox.value = value;
  }
  dispose() {
    this.options.focusKey?.set(false);
    super.dispose();
  }
};
SearchWidget = __decorateClass([
  __decorateParam(2, IContextViewService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IContextKeyService),
  __decorateParam(5, IKeybindingService)
], SearchWidget);
class EditPreferenceWidget extends Disposable {
  constructor(editor) {
    super();
    this.editor = editor;
    this._line = -1;
    this._preferences = [];
    this._onClick = this._register(new Emitter());
    this.onClick = this._onClick.event;
    this._editPreferenceDecoration = this.editor.createDecorationsCollection();
    this._register(this.editor.onMouseDown((e) => {
      if (e.target.type !== MouseTargetType.GUTTER_GLYPH_MARGIN || e.target.detail.isAfterLines || !this.isVisible()) {
        return;
      }
      this._onClick.fire(e);
    }));
  }
  get preferences() {
    return this._preferences;
  }
  getLine() {
    return this._line;
  }
  show(line, hoverMessage, preferences) {
    this._preferences = preferences;
    const newDecoration = [];
    this._line = line;
    newDecoration.push({
      options: {
        description: "edit-preference-widget-decoration",
        glyphMarginClassName: ThemeIcon.asClassName(settingsEditIcon),
        glyphMarginHoverMessage: new MarkdownString().appendText(hoverMessage),
        stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
      },
      range: {
        startLineNumber: line,
        startColumn: 1,
        endLineNumber: line,
        endColumn: 1
      }
    });
    this._editPreferenceDecoration.set(newDecoration);
  }
  hide() {
    this._editPreferenceDecoration.clear();
  }
  isVisible() {
    return this._editPreferenceDecoration.length > 0;
  }
  dispose() {
    this.hide();
    super.dispose();
  }
}
export {
  EditPreferenceWidget,
  FolderSettingsActionViewItem,
  SearchWidget,
  SettingsTargetsWidget
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wcmVmZXJlbmNlcy9icm93c2VyL3ByZWZlcmVuY2VzV2lkZ2V0cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIERPTSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IEFjdGlvbkJhciwgQWN0aW9uc09yaWVudGF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgQmFzZUFjdGlvblZpZXdJdGVtLCBJQWN0aW9uVmlld0l0ZW1PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25WaWV3SXRlbXMuanMnO1xuaW1wb3J0IHsgSGlzdG9yeUlucHV0Qm94LCBJSGlzdG9yeUlucHV0T3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9pbnB1dGJveC9pbnB1dEJveC5qcyc7XG5pbXBvcnQgeyBXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvd2lkZ2V0LmpzJztcbmltcG9ydCB7IEFjdGlvbiwgSUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IEtleUNvZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXlDb2Rlcy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yLCBJRWRpdG9yTW91c2VFdmVudCwgTW91c2VUYXJnZXRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBJTW9kZWxEZWx0YURlY29yYXRpb24sIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENvbnRleHRTY29wZWRIaXN0b3J5SW5wdXRCb3ggfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9oaXN0b3J5L2Jyb3dzZXIvY29udGV4dFNjb3BlZEhpc3RvcnlXaWRnZXQuanMnO1xuaW1wb3J0IHsgc2hvd0hpc3RvcnlLZXliaW5kaW5nSGludCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hpc3RvcnkvYnJvd3Nlci9oaXN0b3J5V2lkZ2V0S2V5YmluZGluZ0hpbnQuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSwgSUNvbnRleHRWaWV3U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgYXNDc3NWYXJpYWJsZSwgYmFkZ2VCYWNrZ3JvdW5kLCBiYWRnZUZvcmVncm91bmQsIGNvbnRyYXN0Qm9yZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IGlzV29ya3NwYWNlRm9sZGVyLCBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIElXb3Jrc3BhY2VGb2xkZXIsIFdvcmtiZW5jaFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgc2V0dGluZ3NFZGl0SWNvbiwgc2V0dGluZ3NTY29wZURyb3BEb3duSWNvbiB9IGZyb20gJy4vcHJlZmVyZW5jZXNJY29ucy5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJEZWxlZ2F0ZUZhY3RvcnkuanMnO1xuaW1wb3J0IHR5cGUgeyBJTWFuYWdlZEhvdmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyLmpzJztcbmltcG9ydCB7IElIb3ZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ob3Zlci9icm93c2VyL2hvdmVyLmpzJztcbmltcG9ydCB7IElFZGl0b3JEZWNvcmF0aW9uc0NvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5cbmV4cG9ydCBjbGFzcyBGb2xkZXJTZXR0aW5nc0FjdGlvblZpZXdJdGVtIGV4dGVuZHMgQmFzZUFjdGlvblZpZXdJdGVtIHtcblxuXHRwcml2YXRlIF9mb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIgfCBudWxsO1xuXHRwcml2YXRlIF9mb2xkZXJTZXR0aW5nQ291bnRzID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblxuXHRwcml2YXRlIGNvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIGFuY2hvckVsZW1lbnQhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBhbmNob3JFbGVtZW50SG92ZXIhOiBJTWFuYWdlZEhvdmVyO1xuXHRwcml2YXRlIGxhYmVsRWxlbWVudCE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIGRldGFpbHNFbGVtZW50ITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgZHJvcERvd25FbGVtZW50ITogSFRNTEVsZW1lbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0YWN0aW9uOiBJQWN0aW9uLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJSG92ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG92ZXJTZXJ2aWNlOiBJSG92ZXJTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihudWxsLCBhY3Rpb24pO1xuXHRcdGNvbnN0IHdvcmtzcGFjZSA9IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCk7XG5cdFx0dGhpcy5fZm9sZGVyID0gd29ya3NwYWNlLmZvbGRlcnMubGVuZ3RoID09PSAxID8gd29ya3NwYWNlLmZvbGRlcnNbMF0gOiBudWxsO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29udGV4dFNlcnZpY2Uub25EaWRDaGFuZ2VXb3Jrc3BhY2VGb2xkZXJzKCgpID0+IHRoaXMub25Xb3Jrc3BhY2VGb2xkZXJzQ2hhbmdlZCgpKSk7XG5cdH1cblxuXHRnZXQgZm9sZGVyKCk6IElXb3Jrc3BhY2VGb2xkZXIgfCBudWxsIHtcblx0XHRyZXR1cm4gdGhpcy5fZm9sZGVyO1xuXHR9XG5cblx0c2V0IGZvbGRlcihmb2xkZXI6IElXb3Jrc3BhY2VGb2xkZXIgfCBudWxsKSB7XG5cdFx0dGhpcy5fZm9sZGVyID0gZm9sZGVyO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHRzZXRDb3VudChzZXR0aW5nc1RhcmdldDogVVJJLCBjb3VudDogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3Qgd29ya3NwYWNlRm9sZGVyID0gdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2VGb2xkZXIoc2V0dGluZ3NUYXJnZXQpO1xuXHRcdGlmICghd29ya3NwYWNlRm9sZGVyKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ3Vua25vd24gZm9sZGVyJyk7XG5cdFx0fVxuXHRcdGNvbnN0IGZvbGRlciA9IHdvcmtzcGFjZUZvbGRlci51cmk7XG5cdFx0dGhpcy5fZm9sZGVyU2V0dGluZ0NvdW50cy5zZXQoZm9sZGVyLnRvU3RyaW5nKCksIGNvdW50KTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVuZGVyKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHR0aGlzLmVsZW1lbnQgPSBjb250YWluZXI7XG5cblx0XHR0aGlzLmNvbnRhaW5lciA9IGNvbnRhaW5lcjtcblx0XHR0aGlzLmxhYmVsRWxlbWVudCA9IERPTS4kKCcuYWN0aW9uLXRpdGxlJyk7XG5cdFx0dGhpcy5kZXRhaWxzRWxlbWVudCA9IERPTS4kKCcuYWN0aW9uLWRldGFpbHMnKTtcblx0XHR0aGlzLmRyb3BEb3duRWxlbWVudCA9IERPTS4kKCcuZHJvcGRvd24taWNvbi5oaWRlJyArIFRoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKHNldHRpbmdzU2NvcGVEcm9wRG93bkljb24pKTtcblx0XHR0aGlzLmFuY2hvckVsZW1lbnQgPSBET00uJCgnYS5hY3Rpb24tbGFiZWwuZm9sZGVyLXNldHRpbmdzJywge1xuXHRcdFx0cm9sZTogJ2J1dHRvbicsXG5cdFx0XHQnYXJpYS1oYXNwb3B1cCc6ICd0cnVlJyxcblx0XHRcdCd0YWJpbmRleCc6ICcwJ1xuXHRcdH0sIHRoaXMubGFiZWxFbGVtZW50LCB0aGlzLmRldGFpbHNFbGVtZW50LCB0aGlzLmRyb3BEb3duRWxlbWVudCk7XG5cdFx0dGhpcy5hbmNob3JFbGVtZW50SG92ZXIgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmhvdmVyU2VydmljZS5zZXR1cE1hbmFnZWRIb3ZlcihnZXREZWZhdWx0SG92ZXJEZWxlZ2F0ZSgnbW91c2UnKSwgdGhpcy5hbmNob3JFbGVtZW50LCAnJykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKERPTS5hZGREaXNwb3NhYmxlTGlzdGVuZXIodGhpcy5hbmNob3JFbGVtZW50LCBET00uRXZlbnRUeXBlLk1PVVNFX0RPV04sIGUgPT4gRE9NLkV2ZW50SGVscGVyLnN0b3AoZSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuYW5jaG9yRWxlbWVudCwgRE9NLkV2ZW50VHlwZS5DTElDSywgZSA9PiB0aGlzLm9uQ2xpY2soZSkpKTtcblx0XHR0aGlzLl9yZWdpc3RlcihET00uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRoaXMuY29udGFpbmVyLCBET00uRXZlbnRUeXBlLktFWV9VUCwgZSA9PiB0aGlzLm9uS2V5VXAoZSkpKTtcblxuXHRcdERPTS5hcHBlbmQodGhpcy5jb250YWluZXIsIHRoaXMuYW5jaG9yRWxlbWVudCk7XG5cblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbktleVVwKGV2ZW50OiBLZXlib2FyZEV2ZW50KTogdm9pZCB7XG5cdFx0Y29uc3Qga2V5Ym9hcmRFdmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZXZlbnQpO1xuXHRcdHN3aXRjaCAoa2V5Ym9hcmRFdmVudC5rZXlDb2RlKSB7XG5cdFx0XHRjYXNlIEtleUNvZGUuRW50ZXI6XG5cdFx0XHRjYXNlIEtleUNvZGUuU3BhY2U6XG5cdFx0XHRcdHRoaXMub25DbGljayhldmVudCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBvbkNsaWNrKGV2ZW50OiBET00uRXZlbnRMaWtlKTogdm9pZCB7XG5cdFx0RE9NLkV2ZW50SGVscGVyLnN0b3AoZXZlbnQsIHRydWUpO1xuXHRcdGlmICghdGhpcy5mb2xkZXIgfHwgdGhpcy5fYWN0aW9uLmNoZWNrZWQpIHtcblx0XHRcdHRoaXMuc2hvd01lbnUoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fYWN0aW9uLnJ1bih0aGlzLl9mb2xkZXIpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSB1cGRhdGVFbmFibGVkKCk6IHZvaWQge1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgdXBkYXRlQ2hlY2tlZCgpOiB2b2lkIHtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBvbldvcmtzcGFjZUZvbGRlcnNDaGFuZ2VkKCk6IHZvaWQge1xuXHRcdGNvbnN0IG9sZEZvbGRlciA9IHRoaXMuX2ZvbGRlcjtcblx0XHRjb25zdCB3b3Jrc3BhY2UgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpO1xuXHRcdGlmIChvbGRGb2xkZXIpIHtcblx0XHRcdHRoaXMuX2ZvbGRlciA9IHdvcmtzcGFjZS5mb2xkZXJzLmZpbHRlcihmb2xkZXIgPT4gaXNFcXVhbChmb2xkZXIudXJpLCBvbGRGb2xkZXIudXJpKSlbMF0gfHwgd29ya3NwYWNlLmZvbGRlcnNbMF07XG5cdFx0fVxuXHRcdHRoaXMuX2ZvbGRlciA9IHRoaXMuX2ZvbGRlciA/IHRoaXMuX2ZvbGRlciA6IHdvcmtzcGFjZS5mb2xkZXJzLmxlbmd0aCA9PT0gMSA/IHdvcmtzcGFjZS5mb2xkZXJzWzBdIDogbnVsbDtcblxuXHRcdHRoaXMudXBkYXRlKCk7XG5cblx0XHRpZiAodGhpcy5fYWN0aW9uLmNoZWNrZWQpIHtcblx0XHRcdHRoaXMuX2FjdGlvbi5ydW4odGhpcy5fZm9sZGVyKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZSgpOiB2b2lkIHtcblx0XHRsZXQgdG90YWwgPSAwO1xuXHRcdHRoaXMuX2ZvbGRlclNldHRpbmdDb3VudHMuZm9yRWFjaChuID0+IHRvdGFsICs9IG4pO1xuXG5cdFx0Y29uc3Qgd29ya3NwYWNlID0gdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKTtcblx0XHRpZiAodGhpcy5fZm9sZGVyKSB7XG5cdFx0XHR0aGlzLmxhYmVsRWxlbWVudC50ZXh0Q29udGVudCA9IHRoaXMuX2ZvbGRlci5uYW1lO1xuXHRcdFx0dGhpcy5hbmNob3JFbGVtZW50SG92ZXIudXBkYXRlKHRoaXMuX2ZvbGRlci5uYW1lKTtcblx0XHRcdGNvbnN0IGRldGFpbHNUZXh0ID0gdGhpcy5sYWJlbFdpdGhDb3VudCh0aGlzLl9hY3Rpb24ubGFiZWwsIHRvdGFsKTtcblx0XHRcdHRoaXMuZGV0YWlsc0VsZW1lbnQudGV4dENvbnRlbnQgPSBkZXRhaWxzVGV4dDtcblx0XHRcdHRoaXMuZHJvcERvd25FbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ2hpZGUnLCB3b3Jrc3BhY2UuZm9sZGVycy5sZW5ndGggPT09IDEgfHwgIXRoaXMuX2FjdGlvbi5jaGVja2VkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgbGFiZWxUZXh0ID0gdGhpcy5sYWJlbFdpdGhDb3VudCh0aGlzLl9hY3Rpb24ubGFiZWwsIHRvdGFsKTtcblx0XHRcdHRoaXMubGFiZWxFbGVtZW50LnRleHRDb250ZW50ID0gbGFiZWxUZXh0O1xuXHRcdFx0dGhpcy5kZXRhaWxzRWxlbWVudC50ZXh0Q29udGVudCA9ICcnO1xuXHRcdFx0dGhpcy5hbmNob3JFbGVtZW50SG92ZXIudXBkYXRlKHRoaXMuX2FjdGlvbi5sYWJlbCk7XG5cdFx0XHR0aGlzLmRyb3BEb3duRWxlbWVudC5jbGFzc0xpc3QucmVtb3ZlKCdoaWRlJyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5hbmNob3JFbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ2NoZWNrZWQnLCB0aGlzLl9hY3Rpb24uY2hlY2tlZCk7XG5cdFx0dGhpcy5jb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnZGlzYWJsZWQnLCAhdGhpcy5fYWN0aW9uLmVuYWJsZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBzaG93TWVudSgpOiB2b2lkIHtcblx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiB0aGlzLmNvbnRhaW5lcixcblx0XHRcdGdldEFjdGlvbnM6ICgpID0+IHRoaXMuZ2V0RHJvcGRvd25NZW51QWN0aW9ucygpLFxuXHRcdFx0Z2V0QWN0aW9uVmlld0l0ZW06ICgpID0+IHVuZGVmaW5lZCxcblx0XHRcdG9uSGlkZTogKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmFuY2hvckVsZW1lbnQuYmx1cigpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXREcm9wZG93bk1lbnVBY3Rpb25zKCk6IElBY3Rpb25bXSB7XG5cdFx0Y29uc3QgYWN0aW9uczogSUFjdGlvbltdID0gW107XG5cdFx0Y29uc3Qgd29ya3NwYWNlRm9sZGVycyA9IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycztcblx0XHRpZiAodGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpID09PSBXb3JrYmVuY2hTdGF0ZS5XT1JLU1BBQ0UgJiYgd29ya3NwYWNlRm9sZGVycy5sZW5ndGggPiAwKSB7XG5cdFx0XHRhY3Rpb25zLnB1c2goLi4ud29ya3NwYWNlRm9sZGVycy5tYXAoKGZvbGRlciwgaW5kZXgpID0+IHtcblx0XHRcdFx0Y29uc3QgZm9sZGVyQ291bnQgPSB0aGlzLl9mb2xkZXJTZXR0aW5nQ291bnRzLmdldChmb2xkZXIudXJpLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGlkOiAnZm9sZGVyU2V0dGluZ3NUYXJnZXQnICsgaW5kZXgsXG5cdFx0XHRcdFx0bGFiZWw6IHRoaXMubGFiZWxXaXRoQ291bnQoZm9sZGVyLm5hbWUsIGZvbGRlckNvdW50KSxcblx0XHRcdFx0XHR0b29sdGlwOiB0aGlzLmxhYmVsV2l0aENvdW50KGZvbGRlci5uYW1lLCBmb2xkZXJDb3VudCksXG5cdFx0XHRcdFx0Y2hlY2tlZDogISF0aGlzLmZvbGRlciAmJiBpc0VxdWFsKHRoaXMuZm9sZGVyLnVyaSwgZm9sZGVyLnVyaSksXG5cdFx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0XHRjbGFzczogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5fYWN0aW9uLnJ1bihmb2xkZXIpXG5cdFx0XHRcdH07XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHRcdHJldHVybiBhY3Rpb25zO1xuXHR9XG5cblx0cHJpdmF0ZSBsYWJlbFdpdGhDb3VudChsYWJlbDogc3RyaW5nLCBjb3VudDogbnVtYmVyIHwgdW5kZWZpbmVkKTogc3RyaW5nIHtcblx0XHQvLyBBcHBlbmQgdGhlIGNvdW50IGlmIGl0J3MgPjAgYW5kIG5vdCB1bmRlZmluZWRcblx0XHRpZiAoY291bnQpIHtcblx0XHRcdGxhYmVsICs9IGAgKCR7Y291bnR9KWA7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGxhYmVsO1xuXHR9XG59XG5cbmV4cG9ydCB0eXBlIFNldHRpbmdzVGFyZ2V0ID0gQ29uZmlndXJhdGlvblRhcmdldC5BUFBMSUNBVElPTiB8IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTCB8IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9SRU1PVEUgfCBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRSB8IFVSSTtcblxuZXhwb3J0IGludGVyZmFjZSBJU2V0dGluZ3NUYXJnZXRzV2lkZ2V0T3B0aW9ucyB7XG5cdGVuYWJsZVJlbW90ZVNldHRpbmdzPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIFNldHRpbmdzVGFyZ2V0c1dpZGdldCBleHRlbmRzIFdpZGdldCB7XG5cblx0cHJpdmF0ZSBzZXR0aW5nc1N3aXRjaGVyQmFyITogQWN0aW9uQmFyO1xuXHRwcml2YXRlIHVzZXJMb2NhbFNldHRpbmdzITogQWN0aW9uO1xuXHRwcml2YXRlIHVzZXJSZW1vdGVTZXR0aW5ncyE6IEFjdGlvbjtcblx0cHJpdmF0ZSB3b3Jrc3BhY2VTZXR0aW5ncyE6IEFjdGlvbjtcblx0cHJpdmF0ZSBmb2xkZXJTZXR0aW5nc0FjdGlvbiE6IEFjdGlvbjtcblx0cHJpdmF0ZSBmb2xkZXJTZXR0aW5ncyE6IEZvbGRlclNldHRpbmdzQWN0aW9uVmlld0l0ZW07XG5cdHByaXZhdGUgb3B0aW9uczogSVNldHRpbmdzVGFyZ2V0c1dpZGdldE9wdGlvbnM7XG5cblx0cHJpdmF0ZSBfc2V0dGluZ3NUYXJnZXQ6IFNldHRpbmdzVGFyZ2V0IHwgbnVsbCA9IG51bGw7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRUYXJnZXRDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxTZXR0aW5nc1RhcmdldD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkVGFyZ2V0Q2hhbmdlOiBFdmVudDxTZXR0aW5nc1RhcmdldD4gPSB0aGlzLl9vbkRpZFRhcmdldENoYW5nZS5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwYXJlbnQ6IEhUTUxFbGVtZW50LFxuXHRcdG9wdGlvbnM6IElTZXR0aW5nc1RhcmdldHNXaWRnZXRPcHRpb25zIHwgdW5kZWZpbmVkLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5vcHRpb25zID0gb3B0aW9ucyA/PyB7fTtcblx0XHR0aGlzLmNyZWF0ZShwYXJlbnQpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuY29udGV4dFNlcnZpY2Uub25EaWRDaGFuZ2VXb3JrYmVuY2hTdGF0ZSgoKSA9PiB0aGlzLm9uV29ya2JlbmNoU3RhdGVDaGFuZ2VkKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbnRleHRTZXJ2aWNlLm9uRGlkQ2hhbmdlV29ya3NwYWNlRm9sZGVycygoKSA9PiB0aGlzLnVwZGF0ZSgpKSk7XG5cdH1cblxuXHRwcml2YXRlIHJlc2V0TGFiZWxzKCkge1xuXHRcdGNvbnN0IHJlbW90ZUF1dGhvcml0eSA9IHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eTtcblx0XHRjb25zdCBob3N0TGFiZWwgPSByZW1vdGVBdXRob3JpdHkgJiYgdGhpcy5sYWJlbFNlcnZpY2UuZ2V0SG9zdExhYmVsKFNjaGVtYXMudnNjb2RlUmVtb3RlLCByZW1vdGVBdXRob3JpdHkpO1xuXHRcdHRoaXMudXNlckxvY2FsU2V0dGluZ3MubGFiZWwgPSBsb2NhbGl6ZSgndXNlclNldHRpbmdzJywgXCJVc2VyXCIpO1xuXHRcdHRoaXMudXNlclJlbW90ZVNldHRpbmdzLmxhYmVsID0gbG9jYWxpemUoJ3VzZXJTZXR0aW5nc1JlbW90ZScsIFwiUmVtb3RlXCIpICsgKGhvc3RMYWJlbCA/IGAgWyR7aG9zdExhYmVsfV1gIDogJycpO1xuXHRcdHRoaXMud29ya3NwYWNlU2V0dGluZ3MubGFiZWwgPSBsb2NhbGl6ZSgnd29ya3NwYWNlU2V0dGluZ3MnLCBcIldvcmtzcGFjZVwiKTtcblx0XHR0aGlzLmZvbGRlclNldHRpbmdzQWN0aW9uLmxhYmVsID0gbG9jYWxpemUoJ2ZvbGRlclNldHRpbmdzJywgXCJGb2xkZXJcIik7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZShwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0Y29uc3Qgc2V0dGluZ3NUYWJzV2lkZ2V0ID0gRE9NLmFwcGVuZChwYXJlbnQsIERPTS4kKCcuc2V0dGluZ3MtdGFicy13aWRnZXQnKSk7XG5cdFx0dGhpcy5zZXR0aW5nc1N3aXRjaGVyQmFyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEFjdGlvbkJhcihzZXR0aW5nc1RhYnNXaWRnZXQsIHtcblx0XHRcdG9yaWVudGF0aW9uOiBBY3Rpb25zT3JpZW50YXRpb24uSE9SSVpPTlRBTCxcblx0XHRcdGZvY3VzT25seUVuYWJsZWRJdGVtczogdHJ1ZSxcblx0XHRcdGFyaWFMYWJlbDogbG9jYWxpemUoJ3NldHRpbmdzU3dpdGNoZXJCYXJBcmlhTGFiZWwnLCBcIlNldHRpbmdzIFN3aXRjaGVyXCIpLFxuXHRcdFx0YXJpYVJvbGU6ICd0YWJsaXN0Jyxcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb246IElBY3Rpb24sIG9wdGlvbnM6IElBY3Rpb25WaWV3SXRlbU9wdGlvbnMpID0+IGFjdGlvbi5pZCA9PT0gJ2ZvbGRlclNldHRpbmdzJyA/IHRoaXMuZm9sZGVyU2V0dGluZ3MgOiB1bmRlZmluZWRcblx0XHR9KSk7XG5cblx0XHR0aGlzLnVzZXJMb2NhbFNldHRpbmdzID0gbmV3IEFjdGlvbigndXNlclNldHRpbmdzJywgJycsICcuc2V0dGluZ3MtdGFiJywgdHJ1ZSwgKCkgPT4gdGhpcy51cGRhdGVUYXJnZXQoQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMKSk7XG5cdFx0dGhpcy51c2VyTG9jYWxTZXR0aW5ncy50b29sdGlwID0gbG9jYWxpemUoJ3VzZXJTZXR0aW5ncycsIFwiVXNlclwiKTtcblxuXHRcdHRoaXMudXNlclJlbW90ZVNldHRpbmdzID0gbmV3IEFjdGlvbigndXNlclNldHRpbmdzUmVtb3RlJywgJycsICcuc2V0dGluZ3MtdGFiJywgdHJ1ZSwgKCkgPT4gdGhpcy51cGRhdGVUYXJnZXQoQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX1JFTU9URSkpO1xuXHRcdGNvbnN0IHJlbW90ZUF1dGhvcml0eSA9IHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eTtcblx0XHRjb25zdCBob3N0TGFiZWwgPSByZW1vdGVBdXRob3JpdHkgJiYgdGhpcy5sYWJlbFNlcnZpY2UuZ2V0SG9zdExhYmVsKFNjaGVtYXMudnNjb2RlUmVtb3RlLCByZW1vdGVBdXRob3JpdHkpO1xuXHRcdHRoaXMudXNlclJlbW90ZVNldHRpbmdzLnRvb2x0aXAgPSBsb2NhbGl6ZSgndXNlclNldHRpbmdzUmVtb3RlJywgXCJSZW1vdGVcIikgKyAoaG9zdExhYmVsID8gYCBbJHtob3N0TGFiZWx9XWAgOiAnJyk7XG5cblx0XHR0aGlzLndvcmtzcGFjZVNldHRpbmdzID0gbmV3IEFjdGlvbignd29ya3NwYWNlU2V0dGluZ3MnLCAnJywgJy5zZXR0aW5ncy10YWInLCBmYWxzZSwgKCkgPT4gdGhpcy51cGRhdGVUYXJnZXQoQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0UpKTtcblxuXHRcdHRoaXMuZm9sZGVyU2V0dGluZ3NBY3Rpb24gPSBuZXcgQWN0aW9uKCdmb2xkZXJTZXR0aW5ncycsICcnLCAnLnNldHRpbmdzLXRhYicsIGZhbHNlLCBhc3luYyBmb2xkZXIgPT4ge1xuXHRcdFx0dGhpcy51cGRhdGVUYXJnZXQoaXNXb3Jrc3BhY2VGb2xkZXIoZm9sZGVyKSA/IGZvbGRlci51cmkgOiBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUwpO1xuXHRcdH0pO1xuXHRcdHRoaXMuZm9sZGVyU2V0dGluZ3MgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEZvbGRlclNldHRpbmdzQWN0aW9uVmlld0l0ZW0sIHRoaXMuZm9sZGVyU2V0dGluZ3NBY3Rpb24pO1xuXG5cdFx0dGhpcy5yZXNldExhYmVscygpO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cblx0XHR0aGlzLnNldHRpbmdzU3dpdGNoZXJCYXIucHVzaChbdGhpcy51c2VyTG9jYWxTZXR0aW5ncywgdGhpcy51c2VyUmVtb3RlU2V0dGluZ3MsIHRoaXMud29ya3NwYWNlU2V0dGluZ3MsIHRoaXMuZm9sZGVyU2V0dGluZ3NBY3Rpb25dKTtcblx0fVxuXG5cdGdldCBzZXR0aW5nc1RhcmdldCgpOiBTZXR0aW5nc1RhcmdldCB8IG51bGwge1xuXHRcdHJldHVybiB0aGlzLl9zZXR0aW5nc1RhcmdldDtcblx0fVxuXG5cdHNldCBzZXR0aW5nc1RhcmdldChzZXR0aW5nc1RhcmdldDogU2V0dGluZ3NUYXJnZXQgfCBudWxsKSB7XG5cdFx0dGhpcy5fc2V0dGluZ3NUYXJnZXQgPSBzZXR0aW5nc1RhcmdldDtcblx0XHR0aGlzLnVzZXJMb2NhbFNldHRpbmdzLmNoZWNrZWQgPSBDb25maWd1cmF0aW9uVGFyZ2V0LlVTRVJfTE9DQUwgPT09IHRoaXMuc2V0dGluZ3NUYXJnZXQ7XG5cdFx0dGhpcy51c2VyUmVtb3RlU2V0dGluZ3MuY2hlY2tlZCA9IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9SRU1PVEUgPT09IHRoaXMuc2V0dGluZ3NUYXJnZXQ7XG5cdFx0dGhpcy53b3Jrc3BhY2VTZXR0aW5ncy5jaGVja2VkID0gQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0UgPT09IHRoaXMuc2V0dGluZ3NUYXJnZXQ7XG5cdFx0aWYgKHRoaXMuc2V0dGluZ3NUYXJnZXQgaW5zdGFuY2VvZiBVUkkpIHtcblx0XHRcdHRoaXMuZm9sZGVyU2V0dGluZ3MuYWN0aW9uLmNoZWNrZWQgPSB0cnVlO1xuXHRcdFx0dGhpcy5mb2xkZXJTZXR0aW5ncy5mb2xkZXIgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZUZvbGRlcih0aGlzLnNldHRpbmdzVGFyZ2V0IGFzIFVSSSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZm9sZGVyU2V0dGluZ3MuYWN0aW9uLmNoZWNrZWQgPSBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRzZXRSZXN1bHRDb3VudChzZXR0aW5nc1RhcmdldDogU2V0dGluZ3NUYXJnZXQsIGNvdW50OiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAoc2V0dGluZ3NUYXJnZXQgPT09IENvbmZpZ3VyYXRpb25UYXJnZXQuV09SS1NQQUNFKSB7XG5cdFx0XHRsZXQgbGFiZWwgPSBsb2NhbGl6ZSgnd29ya3NwYWNlU2V0dGluZ3MnLCBcIldvcmtzcGFjZVwiKTtcblx0XHRcdGlmIChjb3VudCkge1xuXHRcdFx0XHRsYWJlbCArPSBgICgke2NvdW50fSlgO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLndvcmtzcGFjZVNldHRpbmdzLmxhYmVsID0gbGFiZWw7XG5cdFx0fSBlbHNlIGlmIChzZXR0aW5nc1RhcmdldCA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMKSB7XG5cdFx0XHRsZXQgbGFiZWwgPSBsb2NhbGl6ZSgndXNlclNldHRpbmdzJywgXCJVc2VyXCIpO1xuXHRcdFx0aWYgKGNvdW50KSB7XG5cdFx0XHRcdGxhYmVsICs9IGAgKCR7Y291bnR9KWA7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMudXNlckxvY2FsU2V0dGluZ3MubGFiZWwgPSBsYWJlbDtcblx0XHR9IGVsc2UgaWYgKHNldHRpbmdzVGFyZ2V0IGluc3RhbmNlb2YgVVJJKSB7XG5cdFx0XHR0aGlzLmZvbGRlclNldHRpbmdzLnNldENvdW50KHNldHRpbmdzVGFyZ2V0LCBjb3VudCk7XG5cdFx0fVxuXHR9XG5cblx0dXBkYXRlTGFuZ3VhZ2VGaWx0ZXJJbmRpY2F0b3JzKGZpbHRlcjogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5yZXNldExhYmVscygpO1xuXHRcdGlmIChmaWx0ZXIpIHtcblx0XHRcdGNvbnN0IGxhbmd1YWdlVG9Vc2UgPSB0aGlzLmxhbmd1YWdlU2VydmljZS5nZXRMYW5ndWFnZU5hbWUoZmlsdGVyKTtcblx0XHRcdGlmIChsYW5ndWFnZVRvVXNlKSB7XG5cdFx0XHRcdGNvbnN0IGxhbmd1YWdlU3VmZml4ID0gYCBbJHtsYW5ndWFnZVRvVXNlfV1gO1xuXHRcdFx0XHR0aGlzLnVzZXJMb2NhbFNldHRpbmdzLmxhYmVsICs9IGxhbmd1YWdlU3VmZml4O1xuXHRcdFx0XHR0aGlzLnVzZXJSZW1vdGVTZXR0aW5ncy5sYWJlbCArPSBsYW5ndWFnZVN1ZmZpeDtcblx0XHRcdFx0dGhpcy53b3Jrc3BhY2VTZXR0aW5ncy5sYWJlbCArPSBsYW5ndWFnZVN1ZmZpeDtcblx0XHRcdFx0dGhpcy5mb2xkZXJTZXR0aW5nc0FjdGlvbi5sYWJlbCArPSBsYW5ndWFnZVN1ZmZpeDtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIG9uV29ya2JlbmNoU3RhdGVDaGFuZ2VkKCk6IHZvaWQge1xuXHRcdHRoaXMuZm9sZGVyU2V0dGluZ3MuZm9sZGVyID0gbnVsbDtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHRcdGlmICh0aGlzLnNldHRpbmdzVGFyZ2V0ID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRSAmJiB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLldPUktTUEFDRSkge1xuXHRcdFx0dGhpcy51cGRhdGVUYXJnZXQoQ29uZmlndXJhdGlvblRhcmdldC5VU0VSX0xPQ0FMKTtcblx0XHR9XG5cdH1cblxuXHR1cGRhdGVUYXJnZXQoc2V0dGluZ3NUYXJnZXQ6IFNldHRpbmdzVGFyZ2V0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaXNTYW1lVGFyZ2V0ID0gdGhpcy5zZXR0aW5nc1RhcmdldCA9PT0gc2V0dGluZ3NUYXJnZXQgfHxcblx0XHRcdHNldHRpbmdzVGFyZ2V0IGluc3RhbmNlb2YgVVJJICYmXG5cdFx0XHR0aGlzLnNldHRpbmdzVGFyZ2V0IGluc3RhbmNlb2YgVVJJICYmXG5cdFx0XHRpc0VxdWFsKHRoaXMuc2V0dGluZ3NUYXJnZXQsIHNldHRpbmdzVGFyZ2V0KTtcblxuXHRcdGlmICghaXNTYW1lVGFyZ2V0KSB7XG5cdFx0XHR0aGlzLnNldHRpbmdzVGFyZ2V0ID0gc2V0dGluZ3NUYXJnZXQ7XG5cdFx0XHR0aGlzLl9vbkRpZFRhcmdldENoYW5nZS5maXJlKHRoaXMuc2V0dGluZ3NUYXJnZXQpO1xuXHRcdH1cblxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdXBkYXRlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuc2V0dGluZ3NTd2l0Y2hlckJhci5kb21Ob2RlLmNsYXNzTGlzdC50b2dnbGUoJ2VtcHR5LXdvcmtiZW5jaCcsIHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuRU1QVFkpO1xuXHRcdHRoaXMudXNlclJlbW90ZVNldHRpbmdzLmVuYWJsZWQgPSAhISh0aGlzLm9wdGlvbnMuZW5hYmxlUmVtb3RlU2V0dGluZ3MgJiYgdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5KTtcblx0XHR0aGlzLndvcmtzcGFjZVNldHRpbmdzLmVuYWJsZWQgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgIT09IFdvcmtiZW5jaFN0YXRlLkVNUFRZO1xuXHRcdHRoaXMuZm9sZGVyU2V0dGluZ3MuYWN0aW9uLmVuYWJsZWQgPSB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLldPUktTUEFDRSAmJiB0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnMubGVuZ3RoID4gMDtcblxuXHRcdHRoaXMud29ya3NwYWNlU2V0dGluZ3MudG9vbHRpcCA9IGxvY2FsaXplKCd3b3Jrc3BhY2VTZXR0aW5ncycsIFwiV29ya3NwYWNlXCIpO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU2VhcmNoT3B0aW9ucyBleHRlbmRzIElIaXN0b3J5SW5wdXRPcHRpb25zIHtcblx0Zm9jdXNLZXk/OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0c2hvd1Jlc3VsdENvdW50PzogYm9vbGVhbjtcblx0YXJpYUxpdmU/OiBzdHJpbmc7XG5cdGFyaWFMYWJlbGxlZEJ5Pzogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgU2VhcmNoV2lkZ2V0IGV4dGVuZHMgV2lkZ2V0IHtcblxuXHRkb21Ob2RlITogSFRNTEVsZW1lbnQ7XG5cblx0cHJpdmF0ZSBjb3VudEVsZW1lbnQhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSBzZWFyY2hDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0aW5wdXRCb3ghOiBIaXN0b3J5SW5wdXRCb3g7XG5cdHByaXZhdGUgY29udHJvbHNEaXYhOiBIVE1MRWxlbWVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZTogRW1pdHRlcjxzdHJpbmc+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8c3RyaW5nPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PHN0cmluZz4gPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkZvY3VzOiBFbWl0dGVyPHZvaWQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRm9jdXM6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25Gb2N1cy5ldmVudDtcblxuXHRjb25zdHJ1Y3RvcihwYXJlbnQ6IEhUTUxFbGVtZW50LCBwcm90ZWN0ZWQgb3B0aW9uczogU2VhcmNoT3B0aW9ucyxcblx0XHRASUNvbnRleHRWaWV3U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRWaWV3U2VydmljZTogSUNvbnRleHRWaWV3U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByb3RlY3RlZCBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJvdGVjdGVkIHJlYWRvbmx5IGtleWJpbmRpbmdTZXJ2aWNlOiBJS2V5YmluZGluZ1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmNyZWF0ZShwYXJlbnQpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGUocGFyZW50OiBIVE1MRWxlbWVudCkge1xuXHRcdHRoaXMuZG9tTm9kZSA9IERPTS5hcHBlbmQocGFyZW50LCBET00uJCgnZGl2LnNldHRpbmdzLWhlYWRlci13aWRnZXQnKSk7XG5cdFx0dGhpcy5jcmVhdGVTZWFyY2hDb250YWluZXIoRE9NLmFwcGVuZCh0aGlzLmRvbU5vZGUsIERPTS4kKCdkaXYuc2V0dGluZ3Mtc2VhcmNoLWNvbnRhaW5lcicpKSk7XG5cdFx0dGhpcy5jb250cm9sc0RpdiA9IERPTS5hcHBlbmQodGhpcy5kb21Ob2RlLCBET00uJCgnZGl2LnNldHRpbmdzLXNlYXJjaC1jb250cm9scycpKTtcblxuXHRcdGlmICh0aGlzLm9wdGlvbnMuc2hvd1Jlc3VsdENvdW50KSB7XG5cdFx0XHR0aGlzLmNvdW50RWxlbWVudCA9IERPTS5hcHBlbmQodGhpcy5jb250cm9sc0RpdiwgRE9NLiQoJy5zZXR0aW5ncy1jb3VudC13aWRnZXQnKSk7XG5cblx0XHRcdHRoaXMuY291bnRFbGVtZW50LnN0eWxlLmJhY2tncm91bmRDb2xvciA9IGFzQ3NzVmFyaWFibGUoYmFkZ2VCYWNrZ3JvdW5kKTtcblx0XHRcdHRoaXMuY291bnRFbGVtZW50LnN0eWxlLmNvbG9yID0gYXNDc3NWYXJpYWJsZShiYWRnZUZvcmVncm91bmQpO1xuXHRcdFx0dGhpcy5jb3VudEVsZW1lbnQuc3R5bGUuYm9yZGVyID0gYDFweCBzb2xpZCAke2FzQ3NzVmFyaWFibGUoY29udHJhc3RCb3JkZXIpfWA7XG5cdFx0fVxuXG5cdFx0dGhpcy5pbnB1dEJveC5pbnB1dEVsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLWxpdmUnLCB0aGlzLm9wdGlvbnMuYXJpYUxpdmUgfHwgJ29mZicpO1xuXHRcdGlmICh0aGlzLm9wdGlvbnMuYXJpYUxhYmVsbGVkQnkpIHtcblx0XHRcdHRoaXMuaW5wdXRCb3guaW5wdXRFbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbGxlZEJ5JywgdGhpcy5vcHRpb25zLmFyaWFMYWJlbGxlZEJ5KTtcblx0XHR9XG5cdFx0Y29uc3QgZm9jdXNUcmFja2VyID0gdGhpcy5fcmVnaXN0ZXIoRE9NLnRyYWNrRm9jdXModGhpcy5pbnB1dEJveC5pbnB1dEVsZW1lbnQpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihmb2N1c1RyYWNrZXIub25EaWRGb2N1cygoKSA9PiB0aGlzLl9vbkZvY3VzLmZpcmUoKSkpO1xuXG5cdFx0Y29uc3QgZm9jdXNLZXkgPSB0aGlzLm9wdGlvbnMuZm9jdXNLZXk7XG5cdFx0aWYgKGZvY3VzS2V5KSB7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcihmb2N1c1RyYWNrZXIub25EaWRGb2N1cygoKSA9PiBmb2N1c0tleS5zZXQodHJ1ZSkpKTtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKGZvY3VzVHJhY2tlci5vbkRpZEJsdXIoKCkgPT4gZm9jdXNLZXkuc2V0KGZhbHNlKSkpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlU2VhcmNoQ29udGFpbmVyKHNlYXJjaENvbnRhaW5lcjogSFRNTEVsZW1lbnQpIHtcblx0XHR0aGlzLnNlYXJjaENvbnRhaW5lciA9IHNlYXJjaENvbnRhaW5lcjtcblx0XHRjb25zdCBzZWFyY2hJbnB1dCA9IERPTS5hcHBlbmQodGhpcy5zZWFyY2hDb250YWluZXIsIERPTS4kKCdkaXYuc2V0dGluZ3Mtc2VhcmNoLWlucHV0JykpO1xuXHRcdHRoaXMuaW5wdXRCb3ggPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmNyZWF0ZUlucHV0Qm94KHNlYXJjaElucHV0KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5pbnB1dEJveC5vbkRpZENoYW5nZSh2YWx1ZSA9PiB0aGlzLl9vbkRpZENoYW5nZS5maXJlKHZhbHVlKSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNyZWF0ZUlucHV0Qm94KHBhcmVudDogSFRNTEVsZW1lbnQpOiBIaXN0b3J5SW5wdXRCb3gge1xuXHRcdGNvbnN0IHNob3dIaXN0b3J5SGludCA9ICgpID0+IHNob3dIaXN0b3J5S2V5YmluZGluZ0hpbnQodGhpcy5rZXliaW5kaW5nU2VydmljZSk7XG5cdFx0cmV0dXJuIG5ldyBDb250ZXh0U2NvcGVkSGlzdG9yeUlucHV0Qm94KHBhcmVudCwgdGhpcy5jb250ZXh0Vmlld1NlcnZpY2UsIHsgLi4udGhpcy5vcHRpb25zLCBzaG93SGlzdG9yeUhpbnQgfSwgdGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdH1cblxuXHRzaG93TWVzc2FnZShtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHQvLyBBdm9pZCBzZXR0aW5nIHRoZSBhcmlhLWxhYmVsIHVubmVjZXNzYXJpbHksIHRoZSBzY3JlZW5yZWFkZXIgd2lsbCByZWFkIHRoZSBjb3VudCBldmVyeSB0aW1lIGl0J3Mgc2V0LCBzaW5jZSBpdCdzIGFyaWEtbGl2ZTphc3NlcnRpdmUuICM1MDk2OFxuXHRcdGlmICh0aGlzLmNvdW50RWxlbWVudCAmJiBtZXNzYWdlICE9PSB0aGlzLmNvdW50RWxlbWVudC50ZXh0Q29udGVudCkge1xuXHRcdFx0dGhpcy5jb3VudEVsZW1lbnQudGV4dENvbnRlbnQgPSBtZXNzYWdlO1xuXHRcdFx0dGhpcy5pbnB1dEJveC5pbnB1dEVsZW1lbnQuc2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJywgbWVzc2FnZSk7XG5cdFx0XHR0aGlzLmlucHV0Qm94LmlucHV0RWxlbWVudC5zdHlsZS5wYWRkaW5nUmlnaHQgPSB0aGlzLmdldENvbnRyb2xzV2lkdGgoKSArICdweCc7XG5cdFx0fVxuXHR9XG5cblx0bGF5b3V0KGRpbWVuc2lvbjogRE9NLkRpbWVuc2lvbikge1xuXHRcdGlmIChkaW1lbnNpb24ud2lkdGggPCA0MDApIHtcblx0XHRcdHRoaXMuY291bnRFbGVtZW50Py5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG5cblx0XHRcdHRoaXMuaW5wdXRCb3guaW5wdXRFbGVtZW50LnN0eWxlLnBhZGRpbmdSaWdodCA9ICcwcHgnO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmNvdW50RWxlbWVudD8uY2xhc3NMaXN0LnJlbW92ZSgnaGlkZScpO1xuXG5cdFx0XHR0aGlzLmlucHV0Qm94LmlucHV0RWxlbWVudC5zdHlsZS5wYWRkaW5nUmlnaHQgPSB0aGlzLmdldENvbnRyb2xzV2lkdGgoKSArICdweCc7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRDb250cm9sc1dpZHRoKCk6IG51bWJlciB7XG5cdFx0Y29uc3QgY291bnRXaWR0aCA9IHRoaXMuY291bnRFbGVtZW50ID8gRE9NLmdldFRvdGFsV2lkdGgodGhpcy5jb3VudEVsZW1lbnQpIDogMDtcblx0XHRyZXR1cm4gY291bnRXaWR0aCArIDIwO1xuXHR9XG5cblx0Zm9jdXMoKSB7XG5cdFx0dGhpcy5pbnB1dEJveC5mb2N1cygpO1xuXHRcdGlmICh0aGlzLmdldFZhbHVlKCkpIHtcblx0XHRcdHRoaXMuaW5wdXRCb3guc2VsZWN0KCk7XG5cdFx0fVxuXHR9XG5cblx0aGFzRm9jdXMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuaW5wdXRCb3guaGFzRm9jdXMoKTtcblx0fVxuXG5cdGNsZWFyKCkge1xuXHRcdHRoaXMuaW5wdXRCb3gudmFsdWUgPSAnJztcblx0fVxuXG5cdGdldFZhbHVlKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuaW5wdXRCb3gudmFsdWU7XG5cdH1cblxuXHRzZXRWYWx1ZSh2YWx1ZTogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5pbnB1dEJveC52YWx1ZSA9IHZhbHVlO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLm9wdGlvbnMuZm9jdXNLZXk/LnNldChmYWxzZSk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFZGl0UHJlZmVyZW5jZVdpZGdldDxUPiBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgX2xpbmU6IG51bWJlciA9IC0xO1xuXHRwcml2YXRlIF9wcmVmZXJlbmNlczogVFtdID0gW107XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZWRpdFByZWZlcmVuY2VEZWNvcmF0aW9uOiBJRWRpdG9yRGVjb3JhdGlvbnNDb2xsZWN0aW9uO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uQ2xpY2sgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJRWRpdG9yTW91c2VFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uQ2xpY2s6IEV2ZW50PElFZGl0b3JNb3VzZUV2ZW50PiA9IHRoaXMuX29uQ2xpY2suZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBlZGl0b3I6IElDb2RlRWRpdG9yKSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9lZGl0UHJlZmVyZW5jZURlY29yYXRpb24gPSB0aGlzLmVkaXRvci5jcmVhdGVEZWNvcmF0aW9uc0NvbGxlY3Rpb24oKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmVkaXRvci5vbk1vdXNlRG93bigoZTogSUVkaXRvck1vdXNlRXZlbnQpID0+IHtcblx0XHRcdGlmIChlLnRhcmdldC50eXBlICE9PSBNb3VzZVRhcmdldFR5cGUuR1VUVEVSX0dMWVBIX01BUkdJTiB8fCBlLnRhcmdldC5kZXRhaWwuaXNBZnRlckxpbmVzIHx8ICF0aGlzLmlzVmlzaWJsZSgpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHRoaXMuX29uQ2xpY2suZmlyZShlKTtcblx0XHR9KSk7XG5cdH1cblxuXHRnZXQgcHJlZmVyZW5jZXMoKTogVFtdIHtcblx0XHRyZXR1cm4gdGhpcy5fcHJlZmVyZW5jZXM7XG5cdH1cblxuXHRnZXRMaW5lKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2xpbmU7XG5cdH1cblxuXHRzaG93KGxpbmU6IG51bWJlciwgaG92ZXJNZXNzYWdlOiBzdHJpbmcsIHByZWZlcmVuY2VzOiBUW10pOiB2b2lkIHtcblx0XHR0aGlzLl9wcmVmZXJlbmNlcyA9IHByZWZlcmVuY2VzO1xuXHRcdGNvbnN0IG5ld0RlY29yYXRpb246IElNb2RlbERlbHRhRGVjb3JhdGlvbltdID0gW107XG5cdFx0dGhpcy5fbGluZSA9IGxpbmU7XG5cdFx0bmV3RGVjb3JhdGlvbi5wdXNoKHtcblx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246ICdlZGl0LXByZWZlcmVuY2Utd2lkZ2V0LWRlY29yYXRpb24nLFxuXHRcdFx0XHRnbHlwaE1hcmdpbkNsYXNzTmFtZTogVGhlbWVJY29uLmFzQ2xhc3NOYW1lKHNldHRpbmdzRWRpdEljb24pLFxuXHRcdFx0XHRnbHlwaE1hcmdpbkhvdmVyTWVzc2FnZTogbmV3IE1hcmtkb3duU3RyaW5nKCkuYXBwZW5kVGV4dChob3Zlck1lc3NhZ2UpLFxuXHRcdFx0XHRzdGlja2luZXNzOiBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcyxcblx0XHRcdH0sXG5cdFx0XHRyYW5nZToge1xuXHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IGxpbmUsXG5cdFx0XHRcdHN0YXJ0Q29sdW1uOiAxLFxuXHRcdFx0XHRlbmRMaW5lTnVtYmVyOiBsaW5lLFxuXHRcdFx0XHRlbmRDb2x1bW46IDFcblx0XHRcdH1cblx0XHR9KTtcblx0XHR0aGlzLl9lZGl0UHJlZmVyZW5jZURlY29yYXRpb24uc2V0KG5ld0RlY29yYXRpb24pO1xuXHR9XG5cblx0aGlkZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9lZGl0UHJlZmVyZW5jZURlY29yYXRpb24uY2xlYXIoKTtcblx0fVxuXG5cdGlzVmlzaWJsZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fZWRpdFByZWZlcmVuY2VEZWNvcmF0aW9uLmxlbmd0aCA+IDA7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuaGlkZSgpO1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxXQUFXLDBCQUEwQjtBQUM5QyxTQUFTLDBCQUFrRDtBQUUzRCxTQUFTLGNBQWM7QUFDdkIsU0FBUyxjQUF1QjtBQUNoQyxTQUFTLGVBQXNCO0FBQy9CLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZUFBZTtBQUN4QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsV0FBVztBQUNwQixTQUF5Qyx1QkFBdUI7QUFDaEUsU0FBZ0MsOEJBQThCO0FBQzlELFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsb0NBQW9DO0FBQzdDLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQXNCLDBCQUEwQjtBQUNoRCxTQUFTLHFCQUFxQiwyQkFBMkI7QUFDekQsU0FBUyw2QkFB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QW5CVTtBQXVITixNQUFNLDZCQUFnQyxXQUFXO0FBQUEsRUFVdkQsWUFBb0IsUUFBcUI7QUFDeEMsVUFBTTtBQURhO0FBUnBCLFNBQVEsUUFBZ0I7QUFDeEIsU0FBUSxlQUFvQixDQUFDO0FBSTdCLFNBQWlCLFdBQVcsS0FBSyxVQUFVLElBQUksUUFBMkIsQ0FBQztBQUMzRSxTQUFTLFVBQW9DLEtBQUssU0FBUztBQUkxRCxTQUFLLDRCQUE0QixLQUFLLE9BQU8sNEJBQTRCO0FBQ3pFLFNBQUssVUFBVSxLQUFLLE9BQU8sWUFBWSxDQUFDLE1BQXlCO0FBQ2hFLFVBQUksRUFBRSxPQUFPLFNBQVMsZ0JBQWdCLHVCQUF1QixFQUFFLE9BQU8sT0FBTyxnQkFBZ0IsQ0FBQyxLQUFLLFVBQVUsR0FBRztBQUMvRztBQUFBLE1BQ0Q7QUFDQSxXQUFLLFNBQVMsS0FBSyxDQUFDO0FBQUEsSUFDckIsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRUEsSUFBSSxjQUFtQjtBQUN0QixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxVQUFrQjtBQUNqQixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxLQUFLLE1BQWMsY0FBc0IsYUFBd0I7QUFDaEUsU0FBSyxlQUFlO0FBQ3BCLFVBQU0sZ0JBQXlDLENBQUM7QUFDaEQsU0FBSyxRQUFRO0FBQ2Isa0JBQWMsS0FBSztBQUFBLE1BQ2xCLFNBQVM7QUFBQSxRQUNSLGFBQWE7QUFBQSxRQUNiLHNCQUFzQixVQUFVLFlBQVksZ0JBQWdCO0FBQUEsUUFDNUQseUJBQXlCLElBQUksZUFBZSxFQUFFLFdBQVcsWUFBWTtBQUFBLFFBQ3JFLFlBQVksdUJBQXVCO0FBQUEsTUFDcEM7QUFBQSxNQUNBLE9BQU87QUFBQSxRQUNOLGlCQUFpQjtBQUFBLFFBQ2pCLGFBQWE7QUFBQSxRQUNiLGVBQWU7QUFBQSxRQUNmLFdBQVc7QUFBQSxNQUNaO0FBQUEsSUFDRCxDQUFDO0FBQ0QsU0FBSywwQkFBMEIsSUFBSSxhQUFhO0FBQUEsRUFDakQ7QUFBQSxFQUVBLE9BQWE7QUFDWixTQUFLLDBCQUEwQixNQUFNO0FBQUEsRUFDdEM7QUFBQSxFQUVBLFlBQXFCO0FBQ3BCLFdBQU8sS0FBSywwQkFBMEIsU0FBUztBQUFBLEVBQ2hEO0FBQUEsRUFFUyxVQUFnQjtBQUN4QixTQUFLLEtBQUs7QUFDVixVQUFNLFFBQVE7QUFBQSxFQUNmO0FBQ0Q7IiwKICAibmFtZXMiOiBbXQp9Cg==
