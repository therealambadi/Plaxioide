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
import "./media/userDataProfilesEditor.css";
import { $, addDisposableListener, append, clearNode, Dimension, EventHelper, EventType, trackFocus } from "../../../../base/browser/dom.js";
import { Action, Separator, SubmenuAction, toAction } from "../../../../base/common/actions.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { localize } from "../../../../nls.js";
import { IContextMenuService, IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { IUserDataProfilesService, ProfileResourceType } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { EditorInput } from "../../../common/editor/editorInput.js";
import { defaultUserDataProfileIcon, IUserDataProfileManagementService, IUserDataProfileService, PROFILE_FILTER } from "../../../services/userDataProfile/common/userDataProfile.js";
import { Orientation, Sizing, SplitView } from "../../../../base/browser/ui/splitview/splitview.js";
import { Button, ButtonBar, ButtonWithDropdown } from "../../../../base/browser/ui/button/button.js";
import { defaultButtonStyles, defaultCheckboxStyles, defaultInputBoxStyles, defaultSelectBoxStyles, getInputBoxStyle, getListStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { editorBackground, foreground, registerColor } from "../../../../platform/theme/common/colorRegistry.js";
import { PANEL_BORDER } from "../../../common/theme.js";
import { WorkbenchAsyncDataTree, WorkbenchList, WorkbenchTable } from "../../../../platform/list/browser/listService.js";
import { CachedListVirtualDelegate } from "../../../../base/browser/ui/list/list.js";
import { Disposable, DisposableStore, MutableDisposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { InputBox, MessageType } from "../../../../base/browser/ui/inputbox/inputBox.js";
import { Checkbox } from "../../../../base/browser/ui/toggle/toggle.js";
import { DEFAULT_ICON, ICONS } from "../../../services/userDataProfile/common/userDataProfileIcons.js";
import { WorkbenchIconSelectBox } from "../../../services/userDataProfile/browser/iconSelectBox.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { KeyCode } from "../../../../base/common/keyCodes.js";
import { IHoverService, WorkbenchHoverDelegate } from "../../../../platform/hover/browser/hover.js";
import { HoverPosition } from "../../../../base/browser/ui/hover/hoverWidget.js";
import { SelectBox } from "../../../../base/browser/ui/selectBox/selectBox.js";
import { URI } from "../../../../base/common/uri.js";
import { IEditorProgressService } from "../../../../platform/progress/common/progress.js";
import { isString, isUndefined } from "../../../../base/common/types.js";
import { basename } from "../../../../base/common/resources.js";
import { RenderIndentGuides } from "../../../../base/browser/ui/tree/abstractTree.js";
import { DEFAULT_LABELS_CONTAINER, ResourceLabels } from "../../../browser/labels.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { AbstractUserDataProfileElement, isProfileResourceChildElement, isProfileResourceTypeElement, NewProfileElement, UserDataProfileElement, UserDataProfilesEditorModel } from "./userDataProfilesEditorModel.js";
import { WorkbenchToolBar } from "../../../../platform/actions/browser/toolbar.js";
import { createInstantHoverDelegate, getDefaultHoverDelegate } from "../../../../base/browser/ui/hover/hoverDelegateFactory.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Radio } from "../../../../base/browser/ui/radio/radio.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { settingsTextInputBorder } from "../../preferences/common/settingsEditorColorRegistry.js";
import { renderMarkdown } from "../../../../base/browser/markdownRenderer.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { Schemas } from "../../../../base/common/network.js";
import { posix, win32 } from "../../../../base/common/path.js";
import { hasDriveLetter } from "../../../../base/common/extpath.js";
import { normalizeDriveLetter } from "../../../../base/common/labels.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { DropdownMenuActionViewItem } from "../../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
const editIcon = registerIcon("profiles-editor-edit-folder", Codicon.edit, localize("editIcon", "Icon for the edit folder icon in the profiles editor."));
const removeIcon = registerIcon("profiles-editor-remove-folder", Codicon.close, localize("removeIcon", "Icon for the remove folder icon in the profiles editor."));
const profilesSashBorder = registerColor("profiles.sashBorder", PANEL_BORDER, localize("profilesSashBorder", "The color of the Profiles editor splitview sash border."));
const listStyles = getListStyles({
  listActiveSelectionBackground: editorBackground,
  listActiveSelectionForeground: foreground,
  listFocusAndSelectionBackground: editorBackground,
  listFocusAndSelectionForeground: foreground,
  listFocusBackground: editorBackground,
  listFocusForeground: foreground,
  listHoverForeground: foreground,
  listHoverBackground: editorBackground,
  listHoverOutline: editorBackground,
  listFocusOutline: editorBackground,
  listInactiveSelectionBackground: editorBackground,
  listInactiveSelectionForeground: foreground,
  listInactiveFocusBackground: editorBackground,
  listInactiveFocusOutline: editorBackground,
  treeIndentGuidesStroke: void 0,
  treeInactiveIndentGuidesStroke: void 0,
  tableOddRowsBackgroundColor: editorBackground
});
let UserDataProfilesEditor = class extends EditorPane {
  constructor(group, telemetryService, themeService, storageService, quickInputService, fileDialogService, contextMenuService, instantiationService) {
    super(UserDataProfilesEditor.ID, group, telemetryService, themeService, storageService);
    this.quickInputService = quickInputService;
    this.fileDialogService = fileDialogService;
    this.contextMenuService = contextMenuService;
    this.instantiationService = instantiationService;
    this.templates = [];
  }
  layout(dimension, position) {
    if (this.container && this.splitView) {
      const height = dimension.height - 20;
      this.splitView.layout(this.container?.clientWidth, height);
      this.splitView.el.style.height = `${height}px`;
    }
  }
  createEditor(parent) {
    this.container = append(parent, $(".profiles-editor"));
    const sidebarView = append(this.container, $(".sidebar-view"));
    const sidebarContainer = append(sidebarView, $(".sidebar-container"));
    const contentsView = append(this.container, $(".contents-view"));
    const contentsContainer = append(contentsView, $(".contents-container"));
    this.profileWidget = this._register(this.instantiationService.createInstance(ProfileWidget, contentsContainer));
    this.splitView = new SplitView(this.container, {
      orientation: Orientation.HORIZONTAL,
      proportionalLayout: true
    });
    this.renderSidebar(sidebarContainer);
    this.splitView.addView({
      onDidChange: Event.None,
      element: sidebarView,
      minimumSize: 200,
      maximumSize: 350,
      layout: (width, _, height) => {
        sidebarView.style.width = `${width}px`;
        if (height && this.profilesList) {
          const listHeight = height - 40 - 15;
          this.profilesList.getHTMLElement().style.height = `${listHeight}px`;
          this.profilesList.layout(listHeight, width);
        }
      }
    }, 300, void 0, true);
    this.splitView.addView({
      onDidChange: Event.None,
      element: contentsView,
      minimumSize: 550,
      maximumSize: Number.POSITIVE_INFINITY,
      layout: (width, _, height) => {
        contentsView.style.width = `${width}px`;
        if (height) {
          this.profileWidget?.layout(new Dimension(width, height));
        }
      }
    }, Sizing.Distribute, void 0, true);
    this.registerListeners();
    this.updateStyles();
  }
  updateStyles() {
    const borderColor = this.theme.getColor(profilesSashBorder);
    this.splitView?.style({ separatorBorder: borderColor });
  }
  renderSidebar(parent) {
    this.renderNewProfileButton(append(parent, $(".new-profile-button")));
    const renderer = this.instantiationService.createInstance(ProfileElementRenderer);
    const delegate = new ProfileElementDelegate();
    this.profilesList = this._register(this.instantiationService.createInstance(
      WorkbenchList,
      "ProfilesList",
      append(parent, $(".profiles-list")),
      delegate,
      [renderer],
      {
        multipleSelectionSupport: false,
        setRowLineHeight: false,
        horizontalScrolling: false,
        accessibilityProvider: {
          getAriaLabel(profileElement) {
            return profileElement?.name ?? "";
          },
          getWidgetAriaLabel() {
            return localize("profiles", "Profiles");
          }
        },
        openOnSingleClick: true,
        identityProvider: {
          getId(e) {
            if (e instanceof UserDataProfileElement) {
              return e.profile.id;
            }
            return e.name;
          }
        },
        alwaysConsumeMouseWheel: false
      }
    ));
  }
  renderNewProfileButton(parent) {
    const button = this._register(new ButtonWithDropdown(parent, {
      actions: {
        getActions: () => {
          const actions = [];
          if (this.templates.length) {
            actions.push(new SubmenuAction("from.template", localize("from template", "From Template"), this.getCreateFromTemplateActions()));
            actions.push(new Separator());
          }
          actions.push(toAction({
            id: "importProfile",
            label: localize("importProfile", "Import Profile..."),
            run: () => this.importProfile()
          }));
          return actions;
        }
      },
      addPrimaryActionToDropdown: false,
      contextMenuProvider: this.contextMenuService,
      supportIcons: true,
      ...defaultButtonStyles
    }));
    button.label = localize("newProfile", "New Profile");
    this._register(button.onDidClick((e) => this.createNewProfile()));
  }
  getCreateFromTemplateActions() {
    return this.templates.map((template) => toAction({
      id: `template:${template.url}`,
      label: template.name,
      run: () => this.createNewProfile(URI.parse(template.url))
    }));
  }
  registerListeners() {
    if (this.profilesList) {
      this._register(this.profilesList.onDidChangeSelection((e) => {
        const [element] = e.elements;
        if (element instanceof AbstractUserDataProfileElement) {
          this.profileWidget?.render(element);
        }
      }));
      this._register(this.profilesList.onContextMenu((e) => {
        const actions = [];
        if (!e.element) {
          actions.push(...this.getTreeContextMenuActions());
        }
        if (e.element instanceof AbstractUserDataProfileElement) {
          actions.push(...e.element.actions[1]);
        }
        if (actions.length) {
          this.contextMenuService.showContextMenu({
            getAnchor: () => e.anchor,
            getActions: () => actions,
            getActionsContext: () => e.element
          });
        }
      }));
      this._register(this.profilesList.onMouseDblClick((e) => {
        if (!e.element) {
          this.createNewProfile();
        }
      }));
    }
  }
  getTreeContextMenuActions() {
    const actions = [];
    actions.push(toAction({
      id: "newProfile",
      label: localize("newProfile", "New Profile"),
      run: () => this.createNewProfile()
    }));
    const templateActions = this.getCreateFromTemplateActions();
    if (templateActions.length) {
      actions.push(new SubmenuAction("from.template", localize("new from template", "New Profile From Template"), templateActions));
    }
    actions.push(new Separator());
    actions.push(toAction({
      id: "importProfile",
      label: localize("importProfile", "Import Profile..."),
      run: () => this.importProfile()
    }));
    return actions;
  }
  async importProfile() {
    const disposables = new DisposableStore();
    const quickPick = disposables.add(this.quickInputService.createQuickPick());
    const updateQuickPickItems = (value) => {
      const quickPickItems = [];
      if (value) {
        quickPickItems.push({ label: quickPick.value, description: localize("import from url", "Import from URL") });
      }
      quickPickItems.push({ label: localize("import from file", "Select File...") });
      quickPick.items = quickPickItems;
    };
    quickPick.title = localize("import profile quick pick title", "Import from Profile Template...");
    quickPick.placeholder = localize("import profile placeholder", "Provide Profile Template URL");
    quickPick.ignoreFocusOut = true;
    disposables.add(quickPick.onDidChangeValue(updateQuickPickItems));
    updateQuickPickItems();
    quickPick.matchOnLabel = false;
    quickPick.matchOnDescription = false;
    disposables.add(quickPick.onDidAccept(async () => {
      quickPick.hide();
      const selectedItem = quickPick.selectedItems[0];
      if (!selectedItem) {
        return;
      }
      const url = selectedItem.label === quickPick.value ? URI.parse(quickPick.value) : await this.getProfileUriFromFileSystem();
      if (url) {
        this.createNewProfile(url);
      }
    }));
    disposables.add(quickPick.onDidHide(() => disposables.dispose()));
    quickPick.show();
  }
  async createNewProfile(copyFrom) {
    await this.model?.createNewProfile(copyFrom);
  }
  selectProfile(profile) {
    const index = this.model?.profiles.findIndex((p) => p instanceof UserDataProfileElement && p.profile.id === profile.id);
    if (index !== void 0 && index >= 0) {
      this.profilesList?.setSelection([index]);
    }
  }
  async getProfileUriFromFileSystem() {
    const profileLocation = await this.fileDialogService.showOpenDialog({
      canSelectFolders: false,
      canSelectFiles: true,
      canSelectMany: false,
      filters: PROFILE_FILTER,
      title: localize("import profile dialog", "Select Profile Template File")
    });
    if (!profileLocation) {
      return null;
    }
    return profileLocation[0];
  }
  async setInput(input, options, context, token) {
    await super.setInput(input, options, context, token);
    this.model = await input.resolve();
    this.model.getTemplates().then((templates) => {
      this.templates = templates;
      if (this.profileWidget) {
        this.profileWidget.templates = templates;
      }
    });
    this.updateProfilesList();
    this._register(this.model.onDidChange((element) => this.updateProfilesList(element)));
  }
  focus() {
    super.focus();
    this.profilesList?.domFocus();
  }
  updateProfilesList(elementToSelect) {
    if (!this.model) {
      return;
    }
    const currentSelectionIndex = this.profilesList?.getSelection()?.[0];
    const currentSelection = currentSelectionIndex !== void 0 ? this.profilesList?.element(currentSelectionIndex) : void 0;
    this.profilesList?.splice(0, this.profilesList.length, this.model.profiles);
    if (elementToSelect) {
      this.profilesList?.setSelection([this.model.profiles.indexOf(elementToSelect)]);
    } else if (currentSelection) {
      if (!this.model.profiles.includes(currentSelection)) {
        const elementToSelect2 = this.model.profiles.find((profile) => profile.name === currentSelection.name) ?? this.model.profiles[0];
        if (elementToSelect2) {
          this.profilesList?.setSelection([this.model.profiles.indexOf(elementToSelect2)]);
        }
      }
    } else {
      const elementToSelect2 = this.model.profiles.find((profile) => profile.active) ?? this.model.profiles[0];
      if (elementToSelect2) {
        this.profilesList?.setSelection([this.model.profiles.indexOf(elementToSelect2)]);
      }
    }
  }
};
UserDataProfilesEditor.ID = "workbench.editor.userDataProfiles";
UserDataProfilesEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IQuickInputService),
  __decorateParam(5, IFileDialogService),
  __decorateParam(6, IContextMenuService),
  __decorateParam(7, IInstantiationService)
], UserDataProfilesEditor);
class ProfileElementDelegate {
  getHeight(element) {
    return 22;
  }
  getTemplateId() {
    return "profileListElement";
  }
}
let ProfileElementRenderer = class {
  constructor(instantiationService) {
    this.instantiationService = instantiationService;
    this.templateId = "profileListElement";
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const elementDisposables = new DisposableStore();
    container.classList.add("profile-list-item");
    const icon = append(container, $(".profile-list-item-icon"));
    const label = append(container, $(".profile-list-item-label"));
    const dirty = append(container, $(`span${ThemeIcon.asCSSSelector(Codicon.circleFilled)}`));
    const description = append(container, $(".profile-list-item-description"));
    append(description, $(`span${ThemeIcon.asCSSSelector(Codicon.check)}`), $("span", void 0, localize("activeProfile", "Active")));
    const actionsContainer = append(container, $(".profile-tree-item-actions-container"));
    const actionBar = disposables.add(this.instantiationService.createInstance(
      WorkbenchToolBar,
      actionsContainer,
      {
        hoverDelegate: disposables.add(createInstantHoverDelegate()),
        highlightToggledItems: true
      }
    ));
    return { label, icon, dirty, description, actionBar, disposables, elementDisposables };
  }
  renderElement(element, index, templateData, height) {
    templateData.elementDisposables.clear();
    templateData.label.textContent = element.name;
    templateData.label.classList.toggle("new-profile", element instanceof NewProfileElement);
    templateData.icon.className = ThemeIcon.asClassName(element.icon ? ThemeIcon.fromId(element.icon) : DEFAULT_ICON);
    templateData.dirty.classList.toggle("hide", !(element instanceof NewProfileElement));
    templateData.description.classList.toggle("hide", !element.active);
    templateData.elementDisposables.add(element.onDidChange((e) => {
      if (e.name) {
        templateData.label.textContent = element.name;
      }
      if (e.icon) {
        if (element.icon) {
          templateData.icon.className = ThemeIcon.asClassName(ThemeIcon.fromId(element.icon));
        } else {
          templateData.icon.className = "hide";
        }
      }
      if (e.active) {
        templateData.description.classList.toggle("hide", !element.active);
      }
    }));
    const setActions = () => templateData.actionBar.setActions(element.actions[0].filter((a) => a.enabled), element.actions[1].filter((a) => a.enabled));
    setActions();
    const events = [];
    for (const action of element.actions.flat()) {
      if (action instanceof Action) {
        events.push(action.onDidChange);
      }
    }
    templateData.elementDisposables.add(Event.any(...events)((e) => {
      if (e.enabled !== void 0) {
        setActions();
      }
    }));
  }
  disposeElement(element, index, templateData, height) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
    templateData.elementDisposables.dispose();
  }
};
ProfileElementRenderer = __decorateClass([
  __decorateParam(0, IInstantiationService)
], ProfileElementRenderer);
let ProfileWidget = class extends Disposable {
  constructor(parent, editorProgressService, instantiationService) {
    super();
    this.editorProgressService = editorProgressService;
    this.instantiationService = instantiationService;
    this._profileElement = this._register(new MutableDisposable());
    this.layoutParticipants = [];
    const header = append(parent, $(".profile-header"));
    const title = append(header, $(".profile-title-container"));
    this.profileTitle = append(title, $(""));
    const body = append(parent, $(".profile-body"));
    const delegate = new ProfileTreeDelegate();
    const contentsRenderer = this._register(this.instantiationService.createInstance(ContentsProfileRenderer));
    const associationsRenderer = this._register(this.instantiationService.createInstance(ProfileWorkspacesRenderer));
    this.layoutParticipants.push(associationsRenderer);
    this.copyFromProfileRenderer = this._register(this.instantiationService.createInstance(CopyFromProfileRenderer));
    this.profileTreeContainer = append(body, $(".profile-tree"));
    this.profileTree = this._register(this.instantiationService.createInstance(
      WorkbenchAsyncDataTree,
      "ProfileEditor-Tree",
      this.profileTreeContainer,
      delegate,
      [
        this._register(this.instantiationService.createInstance(ProfileNameRenderer)),
        this._register(this.instantiationService.createInstance(ProfileIconRenderer)),
        this._register(this.instantiationService.createInstance(UseForCurrentWindowPropertyRenderer)),
        this._register(this.instantiationService.createInstance(UseAsDefaultProfileRenderer)),
        this.copyFromProfileRenderer,
        contentsRenderer,
        associationsRenderer
      ],
      this.instantiationService.createInstance(ProfileTreeDataSource),
      {
        multipleSelectionSupport: false,
        horizontalScrolling: false,
        accessibilityProvider: {
          getAriaLabel(element) {
            return element?.element ?? "";
          },
          getWidgetAriaLabel() {
            return "";
          }
        },
        identityProvider: {
          getId(element) {
            return element.element;
          }
        },
        expandOnlyOnTwistieClick: true,
        renderIndentGuides: RenderIndentGuides.None,
        enableStickyScroll: false,
        openOnSingleClick: false,
        setRowLineHeight: false,
        supportDynamicHeights: true,
        alwaysConsumeMouseWheel: false
      }
    ));
    this.profileTree.style(listStyles);
    this._register(contentsRenderer.onDidChangeContentHeight((e) => this.profileTree.updateElementHeight(e, void 0)));
    this._register(associationsRenderer.onDidChangeContentHeight((e) => this.profileTree.updateElementHeight(e, void 0)));
    this._register(contentsRenderer.onDidChangeSelection((e) => {
      if (e.selected) {
        this.profileTree.setFocus([]);
        this.profileTree.setSelection([]);
      }
    }));
    this._register(this.profileTree.onDidChangeContentHeight((e) => {
      if (this.dimension) {
        this.layout(this.dimension);
      }
    }));
    this._register(this.profileTree.onDidChangeSelection((e) => {
      if (e.elements.length) {
        contentsRenderer.clearSelection();
      }
    }));
    this.buttonContainer = append(body, $(".profile-row-container.profile-button-container"));
  }
  set templates(templates) {
    this.copyFromProfileRenderer.setTemplates(templates);
    this.profileTree.rerender();
  }
  layout(dimension) {
    this.dimension = dimension;
    const treeContentHeight = this.profileTree.contentHeight;
    const height = Math.min(treeContentHeight, dimension.height - (this._profileElement.value?.element instanceof NewProfileElement ? 116 : 54));
    this.profileTreeContainer.style.height = `${height}px`;
    this.profileTree.layout(height, dimension.width);
    for (const participant of this.layoutParticipants) {
      participant.layout();
    }
  }
  render(profileElement) {
    if (this._profileElement.value?.element === profileElement) {
      return;
    }
    if (this._profileElement.value?.element instanceof UserDataProfileElement) {
      this._profileElement.value.element.reset();
    }
    this.profileTree.setInput(profileElement);
    const disposables = new DisposableStore();
    this._profileElement.value = { element: profileElement, dispose: () => disposables.dispose() };
    this.profileTitle.textContent = profileElement.name;
    disposables.add(profileElement.onDidChange((e) => {
      if (e.name) {
        this.profileTitle.textContent = profileElement.name;
      }
    }));
    const [primaryTitleButtons, secondatyTitleButtons] = profileElement.titleButtons;
    if (primaryTitleButtons?.length || secondatyTitleButtons?.length) {
      this.buttonContainer.classList.remove("hide");
      if (secondatyTitleButtons?.length) {
        for (const action of secondatyTitleButtons) {
          const button = disposables.add(new Button(this.buttonContainer, {
            ...defaultButtonStyles,
            secondary: true
          }));
          button.label = action.label;
          button.enabled = action.enabled;
          disposables.add(button.onDidClick(() => this.editorProgressService.showWhile(action.run())));
          disposables.add(action.onDidChange((e) => {
            if (!isUndefined(e.enabled)) {
              button.enabled = action.enabled;
            }
            if (!isUndefined(e.label)) {
              button.label = action.label;
            }
          }));
        }
      }
      if (primaryTitleButtons?.length) {
        for (const action of primaryTitleButtons) {
          const button = disposables.add(new Button(this.buttonContainer, {
            ...defaultButtonStyles
          }));
          button.label = action.label;
          button.enabled = action.enabled;
          disposables.add(button.onDidClick(() => this.editorProgressService.showWhile(action.run())));
          disposables.add(action.onDidChange((e) => {
            if (!isUndefined(e.enabled)) {
              button.enabled = action.enabled;
            }
            if (!isUndefined(e.label)) {
              button.label = action.label;
            }
          }));
          disposables.add(profileElement.onDidChange((e) => {
            if (e.message) {
              button.setTitle(profileElement.message ?? action.label);
              button.element.classList.toggle("error", !!profileElement.message);
            }
          }));
        }
      }
    } else {
      this.buttonContainer.classList.add("hide");
    }
    if (profileElement instanceof NewProfileElement) {
      this.profileTree.focusFirst();
    }
    if (this.dimension) {
      this.layout(this.dimension);
    }
  }
};
ProfileWidget = __decorateClass([
  __decorateParam(1, IEditorProgressService),
  __decorateParam(2, IInstantiationService)
], ProfileWidget);
class ProfileTreeDelegate extends CachedListVirtualDelegate {
  getTemplateId({ element }) {
    return element;
  }
  hasDynamicHeight({ element }) {
    return element === "contents" || element === "workspaces";
  }
  estimateHeight({ element, root }) {
    switch (element) {
      case "name":
        return 72;
      case "icon":
        return 68;
      case "copyFrom":
        return 90;
      case "useForCurrent":
      case "useAsDefault":
        return 68;
      case "contents":
        return 258;
      case "workspaces":
        return (root.workspaces ? root.workspaces.length * 24 + 30 : 0) + 112;
    }
  }
}
class ProfileTreeDataSource {
  hasChildren(element) {
    return element instanceof AbstractUserDataProfileElement;
  }
  async getChildren(element) {
    if (element instanceof AbstractUserDataProfileElement) {
      const children = [];
      if (element instanceof NewProfileElement) {
        children.push({ element: "name", root: element });
        children.push({ element: "icon", root: element });
        children.push({ element: "copyFrom", root: element });
        children.push({ element: "contents", root: element });
      } else if (element instanceof UserDataProfileElement) {
        if (!element.profile.isDefault) {
          children.push({ element: "name", root: element });
          children.push({ element: "icon", root: element });
        }
        children.push({ element: "useAsDefault", root: element });
        children.push({ element: "contents", root: element });
        children.push({ element: "workspaces", root: element });
      }
      return children;
    }
    return [];
  }
}
class ProfileContentTreeElementDelegate {
  getTemplateId(element) {
    if (!element.element.resourceType) {
      return ProfileResourceChildTreeItemRenderer.TEMPLATE_ID;
    }
    if (element.root instanceof NewProfileElement) {
      return NewProfileResourceTreeRenderer.TEMPLATE_ID;
    }
    return ExistingProfileResourceTreeRenderer.TEMPLATE_ID;
  }
  getHeight(element) {
    return 24;
  }
}
let ProfileResourceTreeDataSource = class {
  constructor(editorProgressService) {
    this.editorProgressService = editorProgressService;
  }
  hasChildren(element) {
    if (element instanceof AbstractUserDataProfileElement) {
      return true;
    }
    if (element.element.resourceType) {
      if (element.element.resourceType !== ProfileResourceType.Extensions && element.element.resourceType !== ProfileResourceType.Snippets) {
        return false;
      }
      if (element.root instanceof NewProfileElement) {
        const resourceType = element.element.resourceType;
        if (element.root.getFlag(resourceType)) {
          return true;
        }
        if (!element.root.hasResource(resourceType)) {
          return false;
        }
        if (element.root.copyFrom === void 0) {
          return false;
        }
        if (!element.root.getCopyFlag(resourceType)) {
          return false;
        }
      }
      return true;
    }
    return false;
  }
  async getChildren(element) {
    if (element instanceof AbstractUserDataProfileElement) {
      const children = await element.getChildren();
      return children.map((e) => ({ element: e, root: element }));
    }
    if (element.element.resourceType) {
      const progressRunner = this.editorProgressService.show(true, 500);
      try {
        const extensions = await element.root.getChildren(element.element.resourceType);
        return extensions.map((e) => ({ element: e, root: element.root }));
      } finally {
        progressRunner.done();
      }
    }
    return [];
  }
};
ProfileResourceTreeDataSource = __decorateClass([
  __decorateParam(0, IEditorProgressService)
], ProfileResourceTreeDataSource);
class AbstractProfileResourceTreeRenderer extends Disposable {
  getResourceTypeTitle(resourceType) {
    switch (resourceType) {
      case ProfileResourceType.Settings:
        return localize("settings", "Settings");
      case ProfileResourceType.Keybindings:
        return localize("keybindings", "Keyboard Shortcuts");
      case ProfileResourceType.Snippets:
        return localize("snippets", "Snippets");
      case ProfileResourceType.Tasks:
        return localize("tasks", "Tasks");
      case ProfileResourceType.Extensions:
        return localize("extensions", "Extensions");
    }
    return "";
  }
  disposeElement(element, index, templateData, height) {
    templateData.elementDisposables.clear();
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
}
class ProfilePropertyRenderer extends AbstractProfileResourceTreeRenderer {
  renderElement({ element }, index, templateData, height) {
    templateData.elementDisposables.clear();
    templateData.element = element;
  }
}
let ProfileNameRenderer = class extends ProfilePropertyRenderer {
  constructor(userDataProfilesService, contextViewService) {
    super();
    this.userDataProfilesService = userDataProfilesService;
    this.contextViewService = contextViewService;
    this.templateId = "name";
  }
  renderTemplate(parent) {
    const disposables = new DisposableStore();
    const elementDisposables = disposables.add(new DisposableStore());
    let profileElement;
    const nameContainer = append(parent, $(".profile-row-container"));
    append(nameContainer, $(".profile-label-element", void 0, localize("name", "Name")));
    const nameInput = disposables.add(new InputBox(
      nameContainer,
      this.contextViewService,
      {
        inputBoxStyles: getInputBoxStyle({
          inputBorder: settingsTextInputBorder
        }),
        ariaLabel: localize("profileName", "Profile Name"),
        placeholder: localize("profileName", "Profile Name"),
        validationOptions: {
          validation: (value) => {
            if (!value) {
              return {
                content: localize("name required", "Profile name is required and must be a non-empty value."),
                type: MessageType.WARNING
              };
            }
            if (profileElement?.root.disabled) {
              return null;
            }
            if (!profileElement?.root.shouldValidateName()) {
              return null;
            }
            const initialName = profileElement?.root.getInitialName();
            value = value.trim();
            if (initialName !== value && this.userDataProfilesService.profiles.some((p) => !p.isTransient && p.name === value)) {
              return {
                content: localize("profileExists", "Profile with name {0} already exists.", value),
                type: MessageType.WARNING
              };
            }
            return null;
          }
        }
      }
    ));
    nameInput.onDidChange((value) => {
      if (profileElement && value) {
        profileElement.root.name = value;
      }
    });
    const focusTracker = disposables.add(trackFocus(nameInput.inputElement));
    disposables.add(focusTracker.onDidBlur(() => {
      if (profileElement && !nameInput.value) {
        nameInput.value = profileElement.root.name;
      }
    }));
    const renderName = (profileElement2) => {
      nameInput.value = profileElement2.root.name;
      nameInput.validate();
      const isDefaultProfile = profileElement2.root instanceof UserDataProfileElement && profileElement2.root.profile.isDefault;
      if (profileElement2.root.disabled || isDefaultProfile) {
        nameInput.disable();
      } else {
        nameInput.enable();
      }
      if (isDefaultProfile) {
        nameInput.setTooltip(localize("defaultProfileName", "Name cannot be changed for the default profile"));
      } else {
        nameInput.setTooltip(localize("profileName", "Profile Name"));
      }
    };
    return {
      set element(element) {
        profileElement = element;
        renderName(profileElement);
        elementDisposables.add(profileElement.root.onDidChange((e) => {
          if (e.name || e.disabled) {
            renderName(element);
          }
          if (e.profile) {
            nameInput.validate();
          }
        }));
      },
      disposables,
      elementDisposables
    };
  }
};
ProfileNameRenderer = __decorateClass([
  __decorateParam(0, IUserDataProfilesService),
  __decorateParam(1, IContextViewService)
], ProfileNameRenderer);
let ProfileIconRenderer = class extends ProfilePropertyRenderer {
  constructor(instantiationService, hoverService) {
    super();
    this.instantiationService = instantiationService;
    this.hoverService = hoverService;
    this.templateId = "icon";
    this.hoverDelegate = getDefaultHoverDelegate("element");
  }
  renderTemplate(parent) {
    const disposables = new DisposableStore();
    const elementDisposables = disposables.add(new DisposableStore());
    let profileElement;
    const iconContainer = append(parent, $(".profile-row-container"));
    append(iconContainer, $(".profile-label-element", void 0, localize("icon-label", "Icon")));
    const iconValueContainer = append(iconContainer, $(".profile-icon-container"));
    const iconElement = append(iconValueContainer, $(`${ThemeIcon.asCSSSelector(DEFAULT_ICON)}`, { "tabindex": "0", "role": "button", "aria-label": localize("icon", "Profile Icon") }));
    const iconHover = disposables.add(this.hoverService.setupManagedHover(this.hoverDelegate, iconElement, ""));
    const iconSelectBox = disposables.add(this.instantiationService.createInstance(WorkbenchIconSelectBox, { icons: ICONS, inputBoxStyles: defaultInputBoxStyles }));
    let hoverWidget;
    const showIconSelectBox = () => {
      if (profileElement?.root instanceof UserDataProfileElement && profileElement.root.profile.isDefault) {
        return;
      }
      if (profileElement?.root.disabled) {
        return;
      }
      if (profileElement?.root instanceof UserDataProfileElement && profileElement.root.profile.isDefault) {
        return;
      }
      iconSelectBox.clearInput();
      hoverWidget = this.hoverService.showInstantHover({
        content: iconSelectBox.domNode,
        target: iconElement,
        position: {
          hoverPosition: HoverPosition.BELOW
        },
        persistence: {
          sticky: true
        },
        appearance: {
          showPointer: true
        }
      }, true);
      if (hoverWidget) {
        iconSelectBox.layout(new Dimension(486, 292));
        iconSelectBox.focus();
      }
    };
    disposables.add(addDisposableListener(iconElement, EventType.CLICK, (e) => {
      EventHelper.stop(e, true);
      showIconSelectBox();
    }));
    disposables.add(addDisposableListener(iconElement, EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.Enter) || event.equals(KeyCode.Space)) {
        EventHelper.stop(event, true);
        showIconSelectBox();
      }
    }));
    disposables.add(addDisposableListener(iconSelectBox.domNode, EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.Escape)) {
        EventHelper.stop(event, true);
        hoverWidget?.dispose();
        iconElement.focus();
      }
    }));
    disposables.add(iconSelectBox.onDidSelect((selectedIcon) => {
      hoverWidget?.dispose();
      iconElement.focus();
      if (profileElement) {
        profileElement.root.icon = selectedIcon.id;
      }
    }));
    append(iconValueContainer, $(".profile-description-element", void 0, localize("icon-description", "Profile icon to be shown in the activity bar")));
    const renderIcon = (profileElement2) => {
      if (profileElement2?.root instanceof UserDataProfileElement && profileElement2.root.profile.isDefault) {
        iconValueContainer.classList.add("disabled");
        iconHover.update(localize("defaultProfileIcon", "Icon cannot be changed for the default profile"));
      } else {
        iconHover.update(localize("changeIcon", "Click to change icon"));
        iconValueContainer.classList.remove("disabled");
      }
      if (profileElement2.root.icon) {
        iconElement.className = ThemeIcon.asClassName(ThemeIcon.fromId(profileElement2.root.icon));
      } else {
        iconElement.className = ThemeIcon.asClassName(ThemeIcon.fromId(DEFAULT_ICON.id));
      }
    };
    return {
      set element(element) {
        profileElement = element;
        renderIcon(profileElement);
        elementDisposables.add(profileElement.root.onDidChange((e) => {
          if (e.icon) {
            renderIcon(element);
          }
        }));
      },
      disposables,
      elementDisposables
    };
  }
};
ProfileIconRenderer = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IHoverService)
], ProfileIconRenderer);
let UseForCurrentWindowPropertyRenderer = class extends ProfilePropertyRenderer {
  constructor(userDataProfileService) {
    super();
    this.userDataProfileService = userDataProfileService;
    this.templateId = "useForCurrent";
  }
  renderTemplate(parent) {
    const disposables = new DisposableStore();
    const elementDisposables = disposables.add(new DisposableStore());
    let profileElement;
    const useForCurrentWindowContainer = append(parent, $(".profile-row-container"));
    append(useForCurrentWindowContainer, $(".profile-label-element", void 0, localize("use for curren window", "Use for Current Window")));
    const useForCurrentWindowValueContainer = append(useForCurrentWindowContainer, $(".profile-use-for-current-container"));
    const useForCurrentWindowTitle = localize("enable for current window", "Use this profile for the current window");
    const useForCurrentWindowCheckbox = disposables.add(new Checkbox(useForCurrentWindowTitle, false, defaultCheckboxStyles));
    append(useForCurrentWindowValueContainer, useForCurrentWindowCheckbox.domNode);
    const useForCurrentWindowLabel = append(useForCurrentWindowValueContainer, $(".profile-description-element", void 0, useForCurrentWindowTitle));
    disposables.add(useForCurrentWindowCheckbox.onChange(() => {
      if (profileElement?.root instanceof UserDataProfileElement) {
        profileElement.root.toggleCurrentWindowProfile();
      }
    }));
    disposables.add(addDisposableListener(useForCurrentWindowLabel, EventType.CLICK, () => {
      if (profileElement?.root instanceof UserDataProfileElement) {
        profileElement.root.toggleCurrentWindowProfile();
      }
    }));
    const renderUseCurrentProfile = (profileElement2) => {
      useForCurrentWindowCheckbox.checked = profileElement2.root instanceof UserDataProfileElement && this.userDataProfileService.currentProfile.id === profileElement2.root.profile.id;
      if (useForCurrentWindowCheckbox.checked && this.userDataProfileService.currentProfile.isDefault) {
        useForCurrentWindowCheckbox.disable();
      } else {
        useForCurrentWindowCheckbox.enable();
      }
    };
    const that = this;
    return {
      set element(element) {
        profileElement = element;
        renderUseCurrentProfile(profileElement);
        elementDisposables.add(that.userDataProfileService.onDidChangeCurrentProfile((e) => {
          renderUseCurrentProfile(element);
        }));
      },
      disposables,
      elementDisposables
    };
  }
};
UseForCurrentWindowPropertyRenderer = __decorateClass([
  __decorateParam(0, IUserDataProfileService)
], UseForCurrentWindowPropertyRenderer);
class UseAsDefaultProfileRenderer extends ProfilePropertyRenderer {
  constructor() {
    super(...arguments);
    this.templateId = "useAsDefault";
  }
  renderTemplate(parent) {
    const disposables = new DisposableStore();
    const elementDisposables = disposables.add(new DisposableStore());
    let profileElement;
    const useAsDefaultProfileContainer = append(parent, $(".profile-row-container"));
    append(useAsDefaultProfileContainer, $(".profile-label-element", void 0, localize("use for new windows", "Use for New Windows")));
    const useAsDefaultProfileValueContainer = append(useAsDefaultProfileContainer, $(".profile-use-as-default-container"));
    const useAsDefaultProfileTitle = localize("enable for new windows", "Use this profile as the default for new windows");
    const useAsDefaultProfileCheckbox = disposables.add(new Checkbox(useAsDefaultProfileTitle, false, defaultCheckboxStyles));
    append(useAsDefaultProfileValueContainer, useAsDefaultProfileCheckbox.domNode);
    const useAsDefaultProfileLabel = append(useAsDefaultProfileValueContainer, $(".profile-description-element", void 0, useAsDefaultProfileTitle));
    disposables.add(useAsDefaultProfileCheckbox.onChange(() => {
      if (profileElement?.root instanceof UserDataProfileElement) {
        profileElement.root.toggleNewWindowProfile();
      }
    }));
    disposables.add(addDisposableListener(useAsDefaultProfileLabel, EventType.CLICK, () => {
      if (profileElement?.root instanceof UserDataProfileElement) {
        profileElement.root.toggleNewWindowProfile();
      }
    }));
    const renderUseAsDefault = (profileElement2) => {
      useAsDefaultProfileCheckbox.checked = profileElement2.root instanceof UserDataProfileElement && profileElement2.root.isNewWindowProfile;
    };
    return {
      set element(element) {
        profileElement = element;
        renderUseAsDefault(profileElement);
        elementDisposables.add(profileElement.root.onDidChange((e) => {
          if (e.newWindowProfile) {
            renderUseAsDefault(element);
          }
        }));
      },
      disposables,
      elementDisposables
    };
  }
}
let CopyFromProfileRenderer = class extends ProfilePropertyRenderer {
  constructor(userDataProfilesService, instantiationService, uriIdentityService, contextViewService) {
    super();
    this.userDataProfilesService = userDataProfilesService;
    this.instantiationService = instantiationService;
    this.uriIdentityService = uriIdentityService;
    this.contextViewService = contextViewService;
    this.templateId = "copyFrom";
    this.templates = [];
  }
  renderTemplate(parent) {
    const disposables = new DisposableStore();
    const elementDisposables = disposables.add(new DisposableStore());
    let profileElement;
    const copyFromContainer = append(parent, $(".profile-row-container.profile-copy-from-container"));
    append(copyFromContainer, $(".profile-label-element", void 0, localize("create from", "Copy from")));
    append(copyFromContainer, $(".profile-description-element", void 0, localize("copy from description", "Select the profile source from which you want to copy contents")));
    const copyFromSelectBox = disposables.add(this.instantiationService.createInstance(
      SelectBox,
      [],
      0,
      this.contextViewService,
      defaultSelectBoxStyles,
      {
        useCustomDrawn: true,
        ariaLabel: localize("copy profile from", "Copy profile from")
      }
    ));
    copyFromSelectBox.render(append(copyFromContainer, $(".profile-select-container")));
    const render = (profileElement2, copyFromOptions) => {
      copyFromSelectBox.setOptions(copyFromOptions);
      const id = profileElement2.copyFrom instanceof URI ? profileElement2.copyFrom.toString() : profileElement2.copyFrom?.id;
      const index = id ? copyFromOptions.findIndex((option) => option.id === id) : 0;
      copyFromSelectBox.select(index);
    };
    const that = this;
    return {
      set element(element) {
        profileElement = element;
        if (profileElement.root instanceof NewProfileElement) {
          const newProfileElement = profileElement.root;
          let copyFromOptions = that.getCopyFromOptions(newProfileElement);
          render(newProfileElement, copyFromOptions);
          copyFromSelectBox.setEnabled(!newProfileElement.previewProfile && !newProfileElement.disabled);
          elementDisposables.add(profileElement.root.onDidChange((e) => {
            if (e.copyFrom || e.copyFromInfo) {
              copyFromOptions = that.getCopyFromOptions(newProfileElement);
              render(newProfileElement, copyFromOptions);
            }
            if (e.preview || e.disabled) {
              copyFromSelectBox.setEnabled(!newProfileElement.previewProfile && !newProfileElement.disabled);
            }
          }));
          elementDisposables.add(copyFromSelectBox.onDidSelect((option) => {
            newProfileElement.copyFrom = copyFromOptions[option.index].source;
          }));
        }
      },
      disposables,
      elementDisposables
    };
  }
  setTemplates(templates) {
    this.templates = templates;
  }
  getCopyFromOptions(profileElement) {
    const separator = { text: "\u2500\u2500\u2500\u2500\u2500\u2500", isDisabled: true };
    const copyFromOptions = [];
    copyFromOptions.push({ text: localize("empty profile", "None") });
    for (const [copyFromTemplate, name] of profileElement.copyFromTemplates) {
      if (!this.templates.some((template) => this.uriIdentityService.extUri.isEqual(URI.parse(template.url), copyFromTemplate))) {
        copyFromOptions.push({ text: `${name} (${basename(copyFromTemplate)})`, id: copyFromTemplate.toString(), source: copyFromTemplate });
      }
    }
    if (this.templates.length) {
      copyFromOptions.push({ ...separator, decoratorRight: localize("from templates", "Profile Templates") });
      for (const template of this.templates) {
        copyFromOptions.push({ text: template.name, id: template.url, source: URI.parse(template.url) });
      }
    }
    copyFromOptions.push({ ...separator, decoratorRight: localize("from existing profiles", "Existing Profiles") });
    for (const profile of this.userDataProfilesService.profiles) {
      if (!profile.isTransient) {
        copyFromOptions.push({ text: profile.name, id: profile.id, source: profile });
      }
    }
    return copyFromOptions;
  }
};
CopyFromProfileRenderer = __decorateClass([
  __decorateParam(0, IUserDataProfilesService),
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IUriIdentityService),
  __decorateParam(3, IContextViewService)
], CopyFromProfileRenderer);
let ContentsProfileRenderer = class extends ProfilePropertyRenderer {
  constructor(userDataProfilesService, contextMenuService, instantiationService) {
    super();
    this.userDataProfilesService = userDataProfilesService;
    this.contextMenuService = contextMenuService;
    this.instantiationService = instantiationService;
    this.templateId = "contents";
    this._onDidChangeContentHeight = this._register(new Emitter());
    this.onDidChangeContentHeight = this._onDidChangeContentHeight.event;
    this._onDidChangeSelection = this._register(new Emitter());
    this.onDidChangeSelection = this._onDidChangeSelection.event;
  }
  renderTemplate(parent) {
    const disposables = new DisposableStore();
    const elementDisposables = disposables.add(new DisposableStore());
    let profileElement;
    const configureRowContainer = append(parent, $(".profile-row-container"));
    append(configureRowContainer, $(".profile-label-element", void 0, localize("contents", "Contents")));
    const contentsDescriptionElement = append(configureRowContainer, $(".profile-description-element"));
    const contentsTreeHeader = append(configureRowContainer, $(".profile-content-tree-header"));
    const optionsLabel = $(".options-header", void 0, $("span", void 0, localize("options", "Source")));
    append(
      contentsTreeHeader,
      $(""),
      $("", void 0, localize("contents", "Contents")),
      optionsLabel,
      $("")
    );
    const delegate = new ProfileContentTreeElementDelegate();
    const profilesContentTree = this.profilesContentTree = disposables.add(this.instantiationService.createInstance(
      WorkbenchAsyncDataTree,
      "ProfileEditor-ContentsTree",
      append(configureRowContainer, $(".profile-content-tree.file-icon-themable-tree.show-file-icons")),
      delegate,
      [
        this.instantiationService.createInstance(ExistingProfileResourceTreeRenderer),
        this.instantiationService.createInstance(NewProfileResourceTreeRenderer),
        this.instantiationService.createInstance(ProfileResourceChildTreeItemRenderer)
      ],
      this.instantiationService.createInstance(ProfileResourceTreeDataSource),
      {
        multipleSelectionSupport: false,
        horizontalScrolling: false,
        accessibilityProvider: {
          getAriaLabel(element) {
            if ((element?.element).resourceType) {
              return (element?.element).resourceType;
            }
            if ((element?.element).label) {
              return (element?.element).label;
            }
            return "";
          },
          getWidgetAriaLabel() {
            return "";
          }
        },
        identityProvider: {
          getId(element) {
            if (element?.element.handle) {
              return element.element.handle;
            }
            return "";
          }
        },
        expandOnlyOnTwistieClick: true,
        renderIndentGuides: RenderIndentGuides.None,
        enableStickyScroll: false,
        openOnSingleClick: false,
        alwaysConsumeMouseWheel: false
      }
    ));
    this.profilesContentTree.style(listStyles);
    disposables.add(toDisposable(() => this.profilesContentTree = void 0));
    disposables.add(this.profilesContentTree.onDidChangeContentHeight((height) => {
      this.profilesContentTree?.layout(height);
      if (profileElement) {
        this._onDidChangeContentHeight.fire(profileElement);
      }
    }));
    disposables.add(this.profilesContentTree.onDidChangeSelection((e) => {
      if (profileElement) {
        this._onDidChangeSelection.fire({ element: profileElement, selected: !!e.elements.length });
      }
    }));
    disposables.add(this.profilesContentTree.onDidOpen(async (e) => {
      if (!e.browserEvent) {
        return;
      }
      if (e.element?.element.openAction) {
        await e.element.element.openAction.run();
      }
    }));
    disposables.add(this.profilesContentTree.onContextMenu(async (e) => {
      if (!e.element?.element.actions?.contextMenu?.length) {
        return;
      }
      this.contextMenuService.showContextMenu({
        getAnchor: () => e.anchor,
        getActions: () => e.element?.element?.actions?.contextMenu ?? [],
        getActionsContext: () => e.element
      });
    }));
    const updateDescription = (element) => {
      clearNode(contentsDescriptionElement);
      const markdown = new MarkdownString();
      if (element.root instanceof UserDataProfileElement && element.root.profile.isDefault) {
        markdown.appendMarkdown(localize("default profile contents description", "Browse contents of this profile\n"));
      } else {
        markdown.appendMarkdown(localize("contents source description", "Configure source of contents for this profile\n"));
        if (element.root instanceof NewProfileElement) {
          const copyFromName = element.root.getCopyFromName();
          const optionName = copyFromName === this.userDataProfilesService.defaultProfile.name ? localize("copy from default", "{0} (Copy)", copyFromName) : copyFromName;
          if (optionName) {
            markdown.appendMarkdown(localize("copy info", "- *{0}:* Copy contents from the {1} profile\n", optionName, copyFromName));
          }
          markdown.appendMarkdown(localize("default info", "- *Default:* Use contents from the Default profile\n")).appendMarkdown(localize("none info", "- *None:* Create empty contents\n"));
        }
      }
      append(contentsDescriptionElement, elementDisposables.add(renderMarkdown(markdown)).element);
    };
    const that = this;
    return {
      set element(element) {
        profileElement = element;
        updateDescription(element);
        if (element.root instanceof NewProfileElement) {
          contentsTreeHeader.classList.remove("default-profile");
        } else if (element.root instanceof UserDataProfileElement) {
          contentsTreeHeader.classList.toggle("default-profile", element.root.profile.isDefault);
        }
        profilesContentTree.setInput(profileElement.root);
        elementDisposables.add(profileElement.root.onDidChange((e) => {
          if (e.copyFrom || e.copyFlags || e.flags || e.extensions || e.snippets || e.preview) {
            profilesContentTree.updateChildren(element.root);
          }
          if (e.copyFromInfo) {
            updateDescription(element);
            that._onDidChangeContentHeight.fire(element);
          }
        }));
      },
      disposables,
      elementDisposables: new DisposableStore()
    };
  }
  clearSelection() {
    if (this.profilesContentTree) {
      this.profilesContentTree.setSelection([]);
      this.profilesContentTree.setFocus([]);
    }
  }
};
ContentsProfileRenderer = __decorateClass([
  __decorateParam(0, IUserDataProfilesService),
  __decorateParam(1, IContextMenuService),
  __decorateParam(2, IInstantiationService)
], ContentsProfileRenderer);
let ProfileWorkspacesRenderer = class extends ProfilePropertyRenderer {
  constructor(labelService, uriIdentityService, fileDialogService, instantiationService) {
    super();
    this.labelService = labelService;
    this.uriIdentityService = uriIdentityService;
    this.fileDialogService = fileDialogService;
    this.instantiationService = instantiationService;
    this.templateId = "workspaces";
    this._onDidChangeContentHeight = this._register(new Emitter());
    this.onDidChangeContentHeight = this._onDidChangeContentHeight.event;
    this._onDidChangeSelection = this._register(new Emitter());
    this.onDidChangeSelection = this._onDidChangeSelection.event;
  }
  renderTemplate(parent) {
    const disposables = new DisposableStore();
    const elementDisposables = disposables.add(new DisposableStore());
    let profileElement;
    const profileWorkspacesRowContainer = append(parent, $(".profile-row-container"));
    append(profileWorkspacesRowContainer, $(".profile-label-element", void 0, localize("folders_workspaces", "Folders & Workspaces")));
    const profileWorkspacesDescriptionElement = append(profileWorkspacesRowContainer, $(".profile-description-element"));
    const workspacesTableContainer = append(profileWorkspacesRowContainer, $(".profile-associations-table"));
    const table = this.workspacesTable = disposables.add(this.instantiationService.createInstance(
      WorkbenchTable,
      "ProfileEditor-AssociationsTable",
      workspacesTableContainer,
      new class {
        constructor() {
          this.headerRowHeight = 30;
        }
        getHeight() {
          return 24;
        }
      }(),
      [
        {
          label: "",
          tooltip: "",
          weight: 1,
          minimumWidth: 30,
          maximumWidth: 30,
          templateId: WorkspaceUriEmptyColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        },
        {
          label: localize("hostColumnLabel", "Host"),
          tooltip: "",
          weight: 2,
          templateId: WorkspaceUriHostColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        },
        {
          label: localize("pathColumnLabel", "Path"),
          tooltip: "",
          weight: 7,
          templateId: WorkspaceUriPathColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        },
        {
          label: "",
          tooltip: "",
          weight: 1,
          minimumWidth: 84,
          maximumWidth: 84,
          templateId: WorkspaceUriActionsColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        }
      ],
      [
        new WorkspaceUriEmptyColumnRenderer(),
        this.instantiationService.createInstance(WorkspaceUriHostColumnRenderer),
        this.instantiationService.createInstance(WorkspaceUriPathColumnRenderer),
        this.instantiationService.createInstance(WorkspaceUriActionsColumnRenderer)
      ],
      {
        horizontalScrolling: false,
        alwaysConsumeMouseWheel: false,
        openOnSingleClick: false,
        multipleSelectionSupport: false,
        accessibilityProvider: {
          getAriaLabel: (item) => {
            const hostLabel = getHostLabel(this.labelService, item.workspace);
            if (hostLabel === void 0 || hostLabel.length === 0) {
              return localize("trustedFolderAriaLabel", "{0}, trusted", this.labelService.getUriLabel(item.workspace));
            }
            return localize("trustedFolderWithHostAriaLabel", "{0} on {1}, trusted", this.labelService.getUriLabel(item.workspace), hostLabel);
          },
          getWidgetAriaLabel: () => localize("trustedFoldersAndWorkspaces", "Trusted Folders & Workspaces")
        },
        identityProvider: {
          getId(element) {
            return element.workspace.toString();
          }
        }
      }
    ));
    this.workspacesTable.style(listStyles);
    disposables.add(toDisposable(() => this.workspacesTable = void 0));
    disposables.add(this.workspacesTable.onDidChangeSelection((e) => {
      if (profileElement) {
        this._onDidChangeSelection.fire({ element: profileElement, selected: !!e.elements.length });
      }
    }));
    const addButtonBarElement = append(profileWorkspacesRowContainer, $(".profile-workspaces-button-container"));
    const buttonBar = disposables.add(new ButtonBar(addButtonBarElement));
    const addButton = this._register(buttonBar.addButton({ title: localize("addButton", "Add Folder"), ...defaultButtonStyles }));
    addButton.label = localize("addButton", "Add Folder");
    disposables.add(addButton.onDidClick(async () => {
      const uris = await this.fileDialogService.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: true,
        openLabel: localize("addFolder", "Add Folder"),
        title: localize("addFolderTitle", "Select Folders To Add")
      });
      if (uris) {
        if (profileElement?.root instanceof UserDataProfileElement) {
          profileElement.root.updateWorkspaces(uris, []);
        }
      }
    }));
    disposables.add(table.onDidOpen((item) => {
      if (item?.element) {
        item.element.profileElement.openWorkspace(item.element.workspace);
      }
    }));
    const updateTable = () => {
      if (profileElement?.root instanceof UserDataProfileElement && profileElement.root.workspaces?.length) {
        profileWorkspacesDescriptionElement.textContent = localize("folders_workspaces_description", "Following folders and workspaces are using this profile");
        workspacesTableContainer.classList.remove("hide");
        table.splice(
          0,
          table.length,
          profileElement.root.workspaces.map((workspace) => ({ workspace, profileElement: profileElement.root })).sort((a, b) => this.uriIdentityService.extUri.compare(a.workspace, b.workspace))
        );
        this.layout();
      } else {
        profileWorkspacesDescriptionElement.textContent = localize("no_folder_description", "No folders or workspaces are using this profile");
        workspacesTableContainer.classList.add("hide");
      }
    };
    const that = this;
    return {
      set element(element) {
        profileElement = element;
        if (element.root instanceof UserDataProfileElement) {
          updateTable();
        }
        elementDisposables.add(profileElement.root.onDidChange((e) => {
          if (profileElement && e.workspaces) {
            updateTable();
            that._onDidChangeContentHeight.fire(profileElement);
          }
        }));
      },
      disposables,
      elementDisposables: new DisposableStore()
    };
  }
  layout() {
    if (this.workspacesTable) {
      this.workspacesTable.layout(this.workspacesTable.length * 24 + 30, void 0);
    }
  }
  clearSelection() {
    if (this.workspacesTable) {
      this.workspacesTable.setSelection([]);
      this.workspacesTable.setFocus([]);
    }
  }
};
ProfileWorkspacesRenderer = __decorateClass([
  __decorateParam(0, ILabelService),
  __decorateParam(1, IUriIdentityService),
  __decorateParam(2, IFileDialogService),
  __decorateParam(3, IInstantiationService)
], ProfileWorkspacesRenderer);
let ExistingProfileResourceTreeRenderer = class extends AbstractProfileResourceTreeRenderer {
  constructor(instantiationService) {
    super();
    this.instantiationService = instantiationService;
    this.templateId = ExistingProfileResourceTreeRenderer.TEMPLATE_ID;
  }
  renderTemplate(parent) {
    const disposables = new DisposableStore();
    const container = append(parent, $(".profile-tree-item-container.existing-profile-resource-type-container"));
    const label = append(container, $(".profile-resource-type-label"));
    const radio = disposables.add(new Radio({ items: [] }));
    append(append(container, $(".profile-resource-options-container")), radio.domNode);
    const actionsContainer = append(container, $(".profile-resource-actions-container"));
    const actionBar = disposables.add(this.instantiationService.createInstance(
      WorkbenchToolBar,
      actionsContainer,
      {
        hoverDelegate: disposables.add(createInstantHoverDelegate()),
        highlightToggledItems: true
      }
    ));
    return { label, radio, actionBar, disposables, elementDisposables: disposables.add(new DisposableStore()) };
  }
  renderElement({ element: profileResourceTreeElement }, index, templateData, height) {
    templateData.elementDisposables.clear();
    const { element, root } = profileResourceTreeElement;
    if (!(root instanceof UserDataProfileElement)) {
      throw new Error("ExistingProfileResourceTreeRenderer can only render existing profile element");
    }
    if (isString(element) || !isProfileResourceTypeElement(element)) {
      throw new Error("Invalid profile resource element");
    }
    const updateRadioItems = () => {
      templateData.radio.setItems([
        {
          text: localize("default", "Default"),
          tooltip: localize("default description", "Use {0} from the Default profile", resourceTypeTitle),
          isActive: root.getFlag(element.resourceType)
        },
        {
          text: root.name,
          tooltip: localize("current description", "Use {0} from the {1} profile", resourceTypeTitle, root.name),
          isActive: !root.getFlag(element.resourceType)
        }
      ]);
    };
    const resourceTypeTitle = this.getResourceTypeTitle(element.resourceType);
    templateData.label.textContent = resourceTypeTitle;
    if (root instanceof UserDataProfileElement && root.profile.isDefault) {
      templateData.radio.domNode.classList.add("hide");
    } else {
      templateData.radio.domNode.classList.remove("hide");
      updateRadioItems();
      templateData.elementDisposables.add(root.onDidChange((e) => {
        if (e.name) {
          updateRadioItems();
        }
      }));
      templateData.elementDisposables.add(templateData.radio.onDidSelect((index2) => root.setFlag(element.resourceType, index2 === 0)));
    }
    const actions = [];
    if (element.openAction) {
      actions.push(element.openAction);
    }
    if (element.actions?.primary) {
      actions.push(...element.actions.primary);
    }
    templateData.actionBar.setActions(actions);
  }
};
ExistingProfileResourceTreeRenderer.TEMPLATE_ID = "ExistingProfileResourceTemplate";
ExistingProfileResourceTreeRenderer = __decorateClass([
  __decorateParam(0, IInstantiationService)
], ExistingProfileResourceTreeRenderer);
let NewProfileResourceTreeRenderer = class extends AbstractProfileResourceTreeRenderer {
  constructor(userDataProfilesService, instantiationService) {
    super();
    this.userDataProfilesService = userDataProfilesService;
    this.instantiationService = instantiationService;
    this.templateId = NewProfileResourceTreeRenderer.TEMPLATE_ID;
  }
  renderTemplate(parent) {
    const disposables = new DisposableStore();
    const container = append(parent, $(".profile-tree-item-container.new-profile-resource-type-container"));
    const labelContainer = append(container, $(".profile-resource-type-label-container"));
    const label = append(labelContainer, $("span.profile-resource-type-label"));
    const radio = disposables.add(new Radio({ items: [] }));
    append(append(container, $(".profile-resource-options-container")), radio.domNode);
    const actionsContainer = append(container, $(".profile-resource-actions-container"));
    const actionBar = disposables.add(this.instantiationService.createInstance(
      WorkbenchToolBar,
      actionsContainer,
      {
        hoverDelegate: disposables.add(createInstantHoverDelegate()),
        highlightToggledItems: true
      }
    ));
    return { label, radio, actionBar, disposables, elementDisposables: disposables.add(new DisposableStore()) };
  }
  renderElement({ element: profileResourceTreeElement }, index, templateData, height) {
    templateData.elementDisposables.clear();
    const { element, root } = profileResourceTreeElement;
    if (!(root instanceof NewProfileElement)) {
      throw new Error("NewProfileResourceTreeRenderer can only render new profile element");
    }
    if (isString(element) || !isProfileResourceTypeElement(element)) {
      throw new Error("Invalid profile resource element");
    }
    const resourceTypeTitle = this.getResourceTypeTitle(element.resourceType);
    templateData.label.textContent = resourceTypeTitle;
    const renderRadioItems = () => {
      const options = [
        {
          text: localize("default", "Default"),
          tooltip: localize("default description", "Use {0} from the Default profile", resourceTypeTitle)
        },
        {
          text: localize("none", "None"),
          tooltip: localize("none description", "Create empty {0}", resourceTypeTitle)
        }
      ];
      const copyFromName = root.getCopyFromName();
      const name = copyFromName === this.userDataProfilesService.defaultProfile.name ? localize("copy from default", "{0} (Copy)", copyFromName) : copyFromName;
      if (root.copyFrom && name) {
        templateData.radio.setItems([
          {
            text: name,
            tooltip: name ? localize("copy from profile description", "Copy {0} from the {1} profile", resourceTypeTitle, name) : localize("copy description", "Copy")
          },
          ...options
        ]);
        templateData.radio.setActiveItem(root.getCopyFlag(element.resourceType) ? 0 : root.getFlag(element.resourceType) ? 1 : 2);
      } else {
        templateData.radio.setItems(options);
        templateData.radio.setActiveItem(root.getFlag(element.resourceType) ? 0 : 1);
      }
    };
    if (root.copyFrom) {
      templateData.elementDisposables.add(templateData.radio.onDidSelect((index2) => {
        root.setFlag(element.resourceType, index2 === 1);
        root.setCopyFlag(element.resourceType, index2 === 0);
      }));
    } else {
      templateData.elementDisposables.add(templateData.radio.onDidSelect((index2) => {
        root.setFlag(element.resourceType, index2 === 0);
      }));
    }
    renderRadioItems();
    templateData.radio.setEnabled(!root.disabled && !root.previewProfile);
    templateData.elementDisposables.add(root.onDidChange((e) => {
      if (e.disabled || e.preview) {
        templateData.radio.setEnabled(!root.disabled && !root.previewProfile);
      }
      if (e.copyFrom || e.copyFromInfo) {
        renderRadioItems();
      }
    }));
    const actions = [];
    if (element.openAction) {
      actions.push(element.openAction);
    }
    if (element.actions?.primary) {
      actions.push(...element.actions.primary);
    }
    templateData.actionBar.setActions(actions);
  }
};
NewProfileResourceTreeRenderer.TEMPLATE_ID = "NewProfileResourceTemplate";
NewProfileResourceTreeRenderer = __decorateClass([
  __decorateParam(0, IUserDataProfilesService),
  __decorateParam(1, IInstantiationService)
], NewProfileResourceTreeRenderer);
let ProfileResourceChildTreeItemRenderer = class extends AbstractProfileResourceTreeRenderer {
  constructor(instantiationService) {
    super();
    this.instantiationService = instantiationService;
    this.templateId = ProfileResourceChildTreeItemRenderer.TEMPLATE_ID;
    this.labels = instantiationService.createInstance(ResourceLabels, DEFAULT_LABELS_CONTAINER);
    this.hoverDelegate = this._register(instantiationService.createInstance(WorkbenchHoverDelegate, "mouse", void 0, {}));
  }
  renderTemplate(parent) {
    const disposables = new DisposableStore();
    const container = append(parent, $(".profile-tree-item-container.profile-resource-child-container"));
    const checkbox = disposables.add(new Checkbox("", false, defaultCheckboxStyles));
    append(container, checkbox.domNode);
    const resourceLabel = disposables.add(this.labels.create(container, { hoverDelegate: this.hoverDelegate }));
    const actionsContainer = append(container, $(".profile-resource-actions-container"));
    const actionBar = disposables.add(this.instantiationService.createInstance(
      WorkbenchToolBar,
      actionsContainer,
      {
        hoverDelegate: disposables.add(createInstantHoverDelegate()),
        highlightToggledItems: true
      }
    ));
    return { checkbox, resourceLabel, actionBar, disposables, elementDisposables: disposables.add(new DisposableStore()) };
  }
  renderElement({ element: profileResourceTreeElement }, index, templateData, height) {
    templateData.elementDisposables.clear();
    const { element } = profileResourceTreeElement;
    if (isString(element) || !isProfileResourceChildElement(element)) {
      throw new Error("Invalid profile resource element");
    }
    if (element.checkbox) {
      templateData.checkbox.domNode.setAttribute("tabindex", "0");
      templateData.checkbox.domNode.classList.remove("hide");
      templateData.checkbox.checked = element.checkbox.isChecked;
      templateData.checkbox.domNode.ariaLabel = element.checkbox.accessibilityInformation?.label ?? "";
      if (element.checkbox.accessibilityInformation?.role) {
        templateData.checkbox.domNode.role = element.checkbox.accessibilityInformation.role;
      }
    } else {
      templateData.checkbox.domNode.removeAttribute("tabindex");
      templateData.checkbox.domNode.classList.add("hide");
    }
    templateData.resourceLabel.setResource(
      {
        name: element.resource ? basename(element.resource) : element.label,
        description: element.description,
        resource: element.resource
      },
      {
        forceLabel: true,
        icon: element.icon,
        hideIcon: !element.resource && !element.icon
      }
    );
    const actions = [];
    if (element.openAction) {
      actions.push(element.openAction);
    }
    if (element.actions?.primary) {
      actions.push(...element.actions.primary);
    }
    templateData.actionBar.setActions(actions);
  }
};
ProfileResourceChildTreeItemRenderer.TEMPLATE_ID = "ProfileResourceChildTreeItemTemplate";
ProfileResourceChildTreeItemRenderer = __decorateClass([
  __decorateParam(0, IInstantiationService)
], ProfileResourceChildTreeItemRenderer);
const _WorkspaceUriEmptyColumnRenderer = class _WorkspaceUriEmptyColumnRenderer {
  constructor() {
    this.templateId = _WorkspaceUriEmptyColumnRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    return {};
  }
  renderElement(item, index, templateData, height) {
  }
  disposeTemplate() {
  }
};
_WorkspaceUriEmptyColumnRenderer.TEMPLATE_ID = "empty";
let WorkspaceUriEmptyColumnRenderer = _WorkspaceUriEmptyColumnRenderer;
let WorkspaceUriHostColumnRenderer = class {
  constructor(uriIdentityService, labelService) {
    this.uriIdentityService = uriIdentityService;
    this.labelService = labelService;
    this.templateId = WorkspaceUriHostColumnRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const renderDisposables = disposables.add(new DisposableStore());
    const element = container.appendChild($(".host"));
    const hostContainer = element.appendChild($("div.host-label"));
    const buttonBarContainer = element.appendChild($("div.button-bar"));
    return {
      element,
      hostContainer,
      buttonBarContainer,
      disposables,
      renderDisposables
    };
  }
  renderElement(item, index, templateData, height) {
    templateData.renderDisposables.clear();
    templateData.renderDisposables.add({ dispose: () => {
      clearNode(templateData.buttonBarContainer);
    } });
    templateData.hostContainer.innerText = getHostLabel(this.labelService, item.workspace);
    templateData.element.classList.toggle("current-workspace", this.uriIdentityService.extUri.isEqual(item.workspace, item.profileElement.getCurrentWorkspace()));
    templateData.hostContainer.style.display = "";
    templateData.buttonBarContainer.style.display = "none";
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
};
WorkspaceUriHostColumnRenderer.TEMPLATE_ID = "host";
WorkspaceUriHostColumnRenderer = __decorateClass([
  __decorateParam(0, IUriIdentityService),
  __decorateParam(1, ILabelService)
], WorkspaceUriHostColumnRenderer);
let WorkspaceUriPathColumnRenderer = class {
  constructor(uriIdentityService, hoverService) {
    this.uriIdentityService = uriIdentityService;
    this.hoverService = hoverService;
    this.templateId = WorkspaceUriPathColumnRenderer.TEMPLATE_ID;
    this.hoverDelegate = getDefaultHoverDelegate("mouse");
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const element = container.appendChild($(".path"));
    const pathLabel = element.appendChild($("div.path-label"));
    const pathHover = disposables.add(this.hoverService.setupManagedHover(this.hoverDelegate, pathLabel, ""));
    const renderDisposables = disposables.add(new DisposableStore());
    return {
      element,
      pathLabel,
      pathHover,
      disposables,
      renderDisposables
    };
  }
  renderElement(item, index, templateData, height) {
    templateData.renderDisposables.clear();
    const stringValue = this.formatPath(item.workspace);
    templateData.pathLabel.innerText = stringValue;
    templateData.element.classList.toggle("current-workspace", this.uriIdentityService.extUri.isEqual(item.workspace, item.profileElement.getCurrentWorkspace()));
    templateData.pathHover.update(stringValue);
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
    templateData.renderDisposables.dispose();
  }
  formatPath(uri) {
    if (uri.scheme === Schemas.file) {
      return normalizeDriveLetter(uri.fsPath);
    }
    if (uri.path.startsWith(posix.sep)) {
      const pathWithoutLeadingSeparator = uri.path.substring(1);
      const isWindowsPath = hasDriveLetter(pathWithoutLeadingSeparator, true);
      if (isWindowsPath) {
        return normalizeDriveLetter(win32.normalize(pathWithoutLeadingSeparator), true);
      }
    }
    return uri.path;
  }
};
WorkspaceUriPathColumnRenderer.TEMPLATE_ID = "path";
WorkspaceUriPathColumnRenderer = __decorateClass([
  __decorateParam(0, IUriIdentityService),
  __decorateParam(1, IHoverService)
], WorkspaceUriPathColumnRenderer);
let ChangeProfileAction = class extends Action {
  constructor(item, userDataProfilesService) {
    super("changeProfile", "", ThemeIcon.asClassName(editIcon));
    this.item = item;
    this.userDataProfilesService = userDataProfilesService;
    this.tooltip = localize("change profile", "Change Profile");
  }
  getSwitchProfileActions() {
    return this.userDataProfilesService.profiles.filter((profile) => !profile.isTransient).sort((a, b) => a.isDefault ? -1 : b.isDefault ? 1 : a.name.localeCompare(b.name)).map((profile) => ({
      id: `switchProfileTo${profile.id}`,
      label: profile.name,
      class: void 0,
      enabled: true,
      checked: profile.id === this.item.profileElement.profile.id,
      tooltip: "",
      run: () => {
        if (profile.id === this.item.profileElement.profile.id) {
          return;
        }
        this.userDataProfilesService.updateProfile(profile, { workspaces: [...profile.workspaces ?? [], this.item.workspace] });
      }
    }));
  }
};
ChangeProfileAction = __decorateClass([
  __decorateParam(1, IUserDataProfilesService)
], ChangeProfileAction);
let WorkspaceUriActionsColumnRenderer = class {
  constructor(userDataProfilesService, userDataProfileManagementService, contextMenuService, uriIdentityService) {
    this.userDataProfilesService = userDataProfilesService;
    this.userDataProfileManagementService = userDataProfileManagementService;
    this.contextMenuService = contextMenuService;
    this.uriIdentityService = uriIdentityService;
    this.templateId = WorkspaceUriActionsColumnRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const disposables = new DisposableStore();
    const element = container.appendChild($(".profile-workspaces-actions-container"));
    const hoverDelegate = disposables.add(createInstantHoverDelegate());
    const actionBar = disposables.add(new ActionBar(element, {
      hoverDelegate,
      actionViewItemProvider: (action) => {
        if (action instanceof ChangeProfileAction) {
          return new DropdownMenuActionViewItem(action, { getActions: () => action.getSwitchProfileActions() }, this.contextMenuService, {
            classNames: action.class,
            hoverDelegate
          });
        }
        return void 0;
      }
    }));
    return { actionBar, disposables };
  }
  renderElement(item, index, templateData, height) {
    templateData.actionBar.clear();
    const actions = [];
    actions.push(this.createOpenAction(item));
    actions.push(new ChangeProfileAction(item, this.userDataProfilesService));
    actions.push(this.createDeleteAction(item));
    templateData.actionBar.push(actions, { icon: true });
  }
  createOpenAction(item) {
    return {
      label: "",
      class: ThemeIcon.asClassName(Codicon.window),
      enabled: !this.uriIdentityService.extUri.isEqual(item.workspace, item.profileElement.getCurrentWorkspace()),
      id: "openWorkspace",
      tooltip: localize("open", "Open in New Window"),
      run: () => item.profileElement.openWorkspace(item.workspace)
    };
  }
  createDeleteAction(item) {
    return {
      label: "",
      class: ThemeIcon.asClassName(removeIcon),
      enabled: this.userDataProfileManagementService.getDefaultProfileToUse().id !== item.profileElement.profile.id,
      id: "deleteTrustedUri",
      tooltip: localize("deleteTrustedUri", "Delete Path"),
      run: () => item.profileElement.updateWorkspaces([], [item.workspace])
    };
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
};
WorkspaceUriActionsColumnRenderer.TEMPLATE_ID = "actions";
WorkspaceUriActionsColumnRenderer = __decorateClass([
  __decorateParam(0, IUserDataProfilesService),
  __decorateParam(1, IUserDataProfileManagementService),
  __decorateParam(2, IContextMenuService),
  __decorateParam(3, IUriIdentityService)
], WorkspaceUriActionsColumnRenderer);
function getHostLabel(labelService, workspaceUri) {
  return workspaceUri.authority ? labelService.getHostLabel(workspaceUri.scheme, workspaceUri.authority) : localize("localAuthority", "Local");
}
let UserDataProfilesEditorInput = class extends EditorInput {
  constructor(instantiationService) {
    super();
    this.instantiationService = instantiationService;
    this.resource = void 0;
    this._dirty = false;
    this.model = UserDataProfilesEditorModel.getInstance(this.instantiationService);
    this._register(this.model.onDidChange((e) => this.dirty = this.model.profiles.some((profile) => profile instanceof NewProfileElement)));
  }
  get dirty() {
    return this._dirty;
  }
  set dirty(dirty) {
    if (this._dirty !== dirty) {
      this._dirty = dirty;
      this._onDidChangeDirty.fire();
    }
  }
  get typeId() {
    return UserDataProfilesEditorInput.ID;
  }
  getName() {
    return localize("userDataProfiles", "Profiles");
  }
  getIcon() {
    return defaultUserDataProfileIcon;
  }
  async resolve() {
    await this.model.resolve();
    return this.model;
  }
  isDirty() {
    return this.dirty;
  }
  async save() {
    await this.model.saveNewProfile();
    return this;
  }
  async revert() {
    this.model.revert();
  }
  matches(otherInput) {
    return otherInput instanceof UserDataProfilesEditorInput;
  }
  dispose() {
    for (const profile of this.model.profiles) {
      if (profile instanceof UserDataProfileElement) {
        profile.reset();
      }
    }
    super.dispose();
  }
};
UserDataProfilesEditorInput.ID = "workbench.input.userDataProfiles";
UserDataProfilesEditorInput = __decorateClass([
  __decorateParam(0, IInstantiationService)
], UserDataProfilesEditorInput);
class UserDataProfilesEditorInputSerializer {
  canSerialize(editorInput) {
    return true;
  }
  serialize(editorInput) {
    return "";
  }
  deserialize(instantiationService) {
    return instantiationService.createInstance(UserDataProfilesEditorInput);
  }
}
export {
  UserDataProfilesEditor,
  UserDataProfilesEditorInput,
  UserDataProfilesEditorInputSerializer,
  profilesSashBorder
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi91c2VyRGF0YVByb2ZpbGUvYnJvd3Nlci91c2VyRGF0YVByb2ZpbGVzRWRpdG9yLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuL21lZGlhL3VzZXJEYXRhUHJvZmlsZXNFZGl0b3IuY3NzJztcbmltcG9ydCB7ICQsIGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgYXBwZW5kLCBjbGVhck5vZGUsIERpbWVuc2lvbiwgRXZlbnRIZWxwZXIsIEV2ZW50VHlwZSwgSURvbVBvc2l0aW9uLCB0cmFja0ZvY3VzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBBY3Rpb24sIElBY3Rpb24sIElBY3Rpb25DaGFuZ2VFdmVudCwgU2VwYXJhdG9yLCBTdWJtZW51QWN0aW9uLCB0b0FjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSwgSUNvbnRleHRWaWV3U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZSwgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLCBQcm9maWxlUmVzb3VyY2VUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgRWRpdG9yUGFuZSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvclBhbmUuanMnO1xuaW1wb3J0IHsgSUVkaXRvck9wZW5Db250ZXh0LCBJRWRpdG9yU2VyaWFsaXplciwgSVVudHlwZWRFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVzRWRpdG9yIH0gZnJvbSAnLi4vY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXAgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgZGVmYXVsdFVzZXJEYXRhUHJvZmlsZUljb24sIElQcm9maWxlVGVtcGxhdGVJbmZvLCBJVXNlckRhdGFQcm9maWxlTWFuYWdlbWVudFNlcnZpY2UsIElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlLCBQUk9GSUxFX0ZJTFRFUiB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcbmltcG9ydCB7IE9yaWVudGF0aW9uLCBTaXppbmcsIFNwbGl0VmlldyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zcGxpdHZpZXcvc3BsaXR2aWV3LmpzJztcbmltcG9ydCB7IEJ1dHRvbiwgQnV0dG9uQmFyLCBCdXR0b25XaXRoRHJvcGRvd24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvYnV0dG9uL2J1dHRvbi5qcyc7XG5pbXBvcnQgeyBkZWZhdWx0QnV0dG9uU3R5bGVzLCBkZWZhdWx0Q2hlY2tib3hTdHlsZXMsIGRlZmF1bHRJbnB1dEJveFN0eWxlcywgZGVmYXVsdFNlbGVjdEJveFN0eWxlcywgZ2V0SW5wdXRCb3hTdHlsZSwgZ2V0TGlzdFN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2Jyb3dzZXIvZGVmYXVsdFN0eWxlcy5qcyc7XG5pbXBvcnQgeyBlZGl0b3JCYWNrZ3JvdW5kLCBmb3JlZ3JvdW5kLCByZWdpc3RlckNvbG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2NvbG9yUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgUEFORUxfQk9SREVSIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IFdvcmtiZW5jaEFzeW5jRGF0YVRyZWUsIFdvcmtiZW5jaExpc3QsIFdvcmtiZW5jaFRhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENhY2hlZExpc3RWaXJ0dWFsRGVsZWdhdGUsIElMaXN0UmVuZGVyZXIsIElMaXN0VmlydHVhbERlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2xpc3QvbGlzdC5qcyc7XG5pbXBvcnQgeyBJQXN5bmNEYXRhU291cmNlLCBJVHJlZU5vZGUsIElUcmVlUmVuZGVyZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdHJlZS90cmVlLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgTXV0YWJsZURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJbnB1dEJveCwgTWVzc2FnZVR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaW5wdXRib3gvaW5wdXRCb3guanMnO1xuaW1wb3J0IHsgQ2hlY2tib3ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdG9nZ2xlL3RvZ2dsZS5qcyc7XG5pbXBvcnQgeyBERUZBVUxUX0lDT04sIElDT05TIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGVJY29ucy5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hJY29uU2VsZWN0Qm94IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdXNlckRhdGFQcm9maWxlL2Jyb3dzZXIvaWNvblNlbGVjdEJveC5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIva2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBLZXlDb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSwgV29ya2JlbmNoSG92ZXJEZWxlZ2F0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSG92ZXJQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ob3Zlci9ob3ZlcldpZGdldC5qcyc7XG5pbXBvcnQgeyBJSG92ZXJXaWRnZXQsIElNYW5hZ2VkSG92ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgSVNlbGVjdE9wdGlvbkl0ZW0sIFNlbGVjdEJveCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9zZWxlY3RCb3gvc2VsZWN0Qm94LmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IGlzU3RyaW5nLCBpc1VuZGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFJlbmRlckluZGVudEd1aWRlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS90cmVlL2Fic3RyYWN0VHJlZS5qcyc7XG5pbXBvcnQgeyBERUZBVUxUX0xBQkVMU19DT05UQUlORVIsIElSZXNvdXJjZUxhYmVsLCBSZXNvdXJjZUxhYmVscyB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvbGFiZWxzLmpzJztcbmltcG9ydCB7IElIb3ZlckRlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2hvdmVyL2hvdmVyRGVsZWdhdGUuanMnO1xuaW1wb3J0IHsgSUZpbGVEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UsIElRdWlja1BpY2tJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQsIGlzUHJvZmlsZVJlc291cmNlQ2hpbGRFbGVtZW50LCBpc1Byb2ZpbGVSZXNvdXJjZVR5cGVFbGVtZW50LCBJUHJvZmlsZUNoaWxkRWxlbWVudCwgSVByb2ZpbGVSZXNvdXJjZVR5cGVDaGlsZEVsZW1lbnQsIElQcm9maWxlUmVzb3VyY2VUeXBlRWxlbWVudCwgTmV3UHJvZmlsZUVsZW1lbnQsIFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQsIFVzZXJEYXRhUHJvZmlsZXNFZGl0b3JNb2RlbCB9IGZyb20gJy4vdXNlckRhdGFQcm9maWxlc0VkaXRvck1vZGVsLmpzJztcbmltcG9ydCB7IFdvcmtiZW5jaFRvb2xCYXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvdG9vbGJhci5qcyc7XG5pbXBvcnQgeyBjcmVhdGVJbnN0YW50SG92ZXJEZWxlZ2F0ZSwgZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaG92ZXIvaG92ZXJEZWxlZ2F0ZUZhY3RvcnkuanMnO1xuaW1wb3J0IHsgQ29kaWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvZGljb25zLmpzJztcbmltcG9ydCB7IFJhZGlvIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3JhZGlvL3JhZGlvLmpzJztcbmltcG9ydCB7IE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgc2V0dGluZ3NUZXh0SW5wdXRCb3JkZXIgfSBmcm9tICcuLi8uLi9wcmVmZXJlbmNlcy9jb21tb24vc2V0dGluZ3NFZGl0b3JDb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IHJlbmRlck1hcmtkb3duIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL21hcmtkb3duUmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBJVGFibGVSZW5kZXJlciwgSVRhYmxlVmlydHVhbERlbGVnYXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL3RhYmxlL3RhYmxlLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgcG9zaXgsIHdpbjMyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBoYXNEcml2ZUxldHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V4dHBhdGguanMnO1xuaW1wb3J0IHsgbm9ybWFsaXplRHJpdmVMZXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9sYWJlbHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uQmFyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25iYXIuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL2ljb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBEcm9wZG93bk1lbnVBY3Rpb25WaWV3SXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9kcm9wZG93bi9kcm9wZG93bkFjdGlvblZpZXdJdGVtLmpzJztcblxuY29uc3QgZWRpdEljb24gPSByZWdpc3Rlckljb24oJ3Byb2ZpbGVzLWVkaXRvci1lZGl0LWZvbGRlcicsIENvZGljb24uZWRpdCwgbG9jYWxpemUoJ2VkaXRJY29uJywgJ0ljb24gZm9yIHRoZSBlZGl0IGZvbGRlciBpY29uIGluIHRoZSBwcm9maWxlcyBlZGl0b3IuJykpO1xuY29uc3QgcmVtb3ZlSWNvbiA9IHJlZ2lzdGVySWNvbigncHJvZmlsZXMtZWRpdG9yLXJlbW92ZS1mb2xkZXInLCBDb2RpY29uLmNsb3NlLCBsb2NhbGl6ZSgncmVtb3ZlSWNvbicsICdJY29uIGZvciB0aGUgcmVtb3ZlIGZvbGRlciBpY29uIGluIHRoZSBwcm9maWxlcyBlZGl0b3IuJykpO1xuXG5leHBvcnQgY29uc3QgcHJvZmlsZXNTYXNoQm9yZGVyID0gcmVnaXN0ZXJDb2xvcigncHJvZmlsZXMuc2FzaEJvcmRlcicsIFBBTkVMX0JPUkRFUiwgbG9jYWxpemUoJ3Byb2ZpbGVzU2FzaEJvcmRlcicsIFwiVGhlIGNvbG9yIG9mIHRoZSBQcm9maWxlcyBlZGl0b3Igc3BsaXR2aWV3IHNhc2ggYm9yZGVyLlwiKSk7XG5cbmNvbnN0IGxpc3RTdHlsZXMgPSBnZXRMaXN0U3R5bGVzKHtcblx0bGlzdEFjdGl2ZVNlbGVjdGlvbkJhY2tncm91bmQ6IGVkaXRvckJhY2tncm91bmQsXG5cdGxpc3RBY3RpdmVTZWxlY3Rpb25Gb3JlZ3JvdW5kOiBmb3JlZ3JvdW5kLFxuXHRsaXN0Rm9jdXNBbmRTZWxlY3Rpb25CYWNrZ3JvdW5kOiBlZGl0b3JCYWNrZ3JvdW5kLFxuXHRsaXN0Rm9jdXNBbmRTZWxlY3Rpb25Gb3JlZ3JvdW5kOiBmb3JlZ3JvdW5kLFxuXHRsaXN0Rm9jdXNCYWNrZ3JvdW5kOiBlZGl0b3JCYWNrZ3JvdW5kLFxuXHRsaXN0Rm9jdXNGb3JlZ3JvdW5kOiBmb3JlZ3JvdW5kLFxuXHRsaXN0SG92ZXJGb3JlZ3JvdW5kOiBmb3JlZ3JvdW5kLFxuXHRsaXN0SG92ZXJCYWNrZ3JvdW5kOiBlZGl0b3JCYWNrZ3JvdW5kLFxuXHRsaXN0SG92ZXJPdXRsaW5lOiBlZGl0b3JCYWNrZ3JvdW5kLFxuXHRsaXN0Rm9jdXNPdXRsaW5lOiBlZGl0b3JCYWNrZ3JvdW5kLFxuXHRsaXN0SW5hY3RpdmVTZWxlY3Rpb25CYWNrZ3JvdW5kOiBlZGl0b3JCYWNrZ3JvdW5kLFxuXHRsaXN0SW5hY3RpdmVTZWxlY3Rpb25Gb3JlZ3JvdW5kOiBmb3JlZ3JvdW5kLFxuXHRsaXN0SW5hY3RpdmVGb2N1c0JhY2tncm91bmQ6IGVkaXRvckJhY2tncm91bmQsXG5cdGxpc3RJbmFjdGl2ZUZvY3VzT3V0bGluZTogZWRpdG9yQmFja2dyb3VuZCxcblx0dHJlZUluZGVudEd1aWRlc1N0cm9rZTogdW5kZWZpbmVkLFxuXHR0cmVlSW5hY3RpdmVJbmRlbnRHdWlkZXNTdHJva2U6IHVuZGVmaW5lZCxcblx0dGFibGVPZGRSb3dzQmFja2dyb3VuZENvbG9yOiBlZGl0b3JCYWNrZ3JvdW5kLFxufSk7XG5cbmV4cG9ydCBjbGFzcyBVc2VyRGF0YVByb2ZpbGVzRWRpdG9yIGV4dGVuZHMgRWRpdG9yUGFuZSBpbXBsZW1lbnRzIElVc2VyRGF0YVByb2ZpbGVzRWRpdG9yIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQ6IHN0cmluZyA9ICd3b3JrYmVuY2guZWRpdG9yLnVzZXJEYXRhUHJvZmlsZXMnO1xuXG5cdHByaXZhdGUgY29udGFpbmVyOiBIVE1MRWxlbWVudCB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBzcGxpdFZpZXc6IFNwbGl0VmlldzxudW1iZXI+IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHByb2ZpbGVzTGlzdDogV29ya2JlbmNoTGlzdDxBYnN0cmFjdFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQ+IHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHByb2ZpbGVXaWRnZXQ6IFByb2ZpbGVXaWRnZXQgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBtb2RlbDogVXNlckRhdGFQcm9maWxlc0VkaXRvck1vZGVsIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIHRlbXBsYXRlczogcmVhZG9ubHkgSVByb2ZpbGVUZW1wbGF0ZUluZm9bXSA9IFtdO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGdyb3VwOiBJRWRpdG9yR3JvdXAsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHF1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0QElGaWxlRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVEaWFsb2dTZXJ2aWNlOiBJRmlsZURpYWxvZ1NlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKFVzZXJEYXRhUHJvZmlsZXNFZGl0b3IuSUQsIGdyb3VwLCB0ZWxlbWV0cnlTZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlKTtcblx0fVxuXG5cdGxheW91dChkaW1lbnNpb246IERpbWVuc2lvbiwgcG9zaXRpb24/OiBJRG9tUG9zaXRpb24gfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5jb250YWluZXIgJiYgdGhpcy5zcGxpdFZpZXcpIHtcblx0XHRcdGNvbnN0IGhlaWdodCA9IGRpbWVuc2lvbi5oZWlnaHQgLSAyMDtcblx0XHRcdHRoaXMuc3BsaXRWaWV3LmxheW91dCh0aGlzLmNvbnRhaW5lcj8uY2xpZW50V2lkdGgsIGhlaWdodCk7XG5cdFx0XHR0aGlzLnNwbGl0Vmlldy5lbC5zdHlsZS5oZWlnaHQgPSBgJHtoZWlnaHR9cHhgO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBjcmVhdGVFZGl0b3IocGFyZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMuY29udGFpbmVyID0gYXBwZW5kKHBhcmVudCwgJCgnLnByb2ZpbGVzLWVkaXRvcicpKTtcblxuXHRcdGNvbnN0IHNpZGViYXJWaWV3ID0gYXBwZW5kKHRoaXMuY29udGFpbmVyLCAkKCcuc2lkZWJhci12aWV3JykpO1xuXHRcdGNvbnN0IHNpZGViYXJDb250YWluZXIgPSBhcHBlbmQoc2lkZWJhclZpZXcsICQoJy5zaWRlYmFyLWNvbnRhaW5lcicpKTtcblxuXHRcdGNvbnN0IGNvbnRlbnRzVmlldyA9IGFwcGVuZCh0aGlzLmNvbnRhaW5lciwgJCgnLmNvbnRlbnRzLXZpZXcnKSk7XG5cdFx0Y29uc3QgY29udGVudHNDb250YWluZXIgPSBhcHBlbmQoY29udGVudHNWaWV3LCAkKCcuY29udGVudHMtY29udGFpbmVyJykpO1xuXHRcdHRoaXMucHJvZmlsZVdpZGdldCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUHJvZmlsZVdpZGdldCwgY29udGVudHNDb250YWluZXIpKTtcblxuXHRcdHRoaXMuc3BsaXRWaWV3ID0gbmV3IFNwbGl0Vmlldyh0aGlzLmNvbnRhaW5lciwge1xuXHRcdFx0b3JpZW50YXRpb246IE9yaWVudGF0aW9uLkhPUklaT05UQUwsXG5cdFx0XHRwcm9wb3J0aW9uYWxMYXlvdXQ6IHRydWVcblx0XHR9KTtcblxuXHRcdHRoaXMucmVuZGVyU2lkZWJhcihzaWRlYmFyQ29udGFpbmVyKTtcblx0XHR0aGlzLnNwbGl0Vmlldy5hZGRWaWV3KHtcblx0XHRcdG9uRGlkQ2hhbmdlOiBFdmVudC5Ob25lLFxuXHRcdFx0ZWxlbWVudDogc2lkZWJhclZpZXcsXG5cdFx0XHRtaW5pbXVtU2l6ZTogMjAwLFxuXHRcdFx0bWF4aW11bVNpemU6IDM1MCxcblx0XHRcdGxheW91dDogKHdpZHRoLCBfLCBoZWlnaHQpID0+IHtcblx0XHRcdFx0c2lkZWJhclZpZXcuc3R5bGUud2lkdGggPSBgJHt3aWR0aH1weGA7XG5cdFx0XHRcdGlmIChoZWlnaHQgJiYgdGhpcy5wcm9maWxlc0xpc3QpIHtcblx0XHRcdFx0XHRjb25zdCBsaXN0SGVpZ2h0ID0gaGVpZ2h0IC0gNDAgLyogbmV3IHByb2ZpbGUgYnV0dG9uICovIC0gMTUgLyogbWFyZ2luVG9wICovO1xuXHRcdFx0XHRcdHRoaXMucHJvZmlsZXNMaXN0LmdldEhUTUxFbGVtZW50KCkuc3R5bGUuaGVpZ2h0ID0gYCR7bGlzdEhlaWdodH1weGA7XG5cdFx0XHRcdFx0dGhpcy5wcm9maWxlc0xpc3QubGF5b3V0KGxpc3RIZWlnaHQsIHdpZHRoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0sIDMwMCwgdW5kZWZpbmVkLCB0cnVlKTtcblx0XHR0aGlzLnNwbGl0Vmlldy5hZGRWaWV3KHtcblx0XHRcdG9uRGlkQ2hhbmdlOiBFdmVudC5Ob25lLFxuXHRcdFx0ZWxlbWVudDogY29udGVudHNWaWV3LFxuXHRcdFx0bWluaW11bVNpemU6IDU1MCxcblx0XHRcdG1heGltdW1TaXplOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksXG5cdFx0XHRsYXlvdXQ6ICh3aWR0aCwgXywgaGVpZ2h0KSA9PiB7XG5cdFx0XHRcdGNvbnRlbnRzVmlldy5zdHlsZS53aWR0aCA9IGAke3dpZHRofXB4YDtcblx0XHRcdFx0aWYgKGhlaWdodCkge1xuXHRcdFx0XHRcdHRoaXMucHJvZmlsZVdpZGdldD8ubGF5b3V0KG5ldyBEaW1lbnNpb24od2lkdGgsIGhlaWdodCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSwgU2l6aW5nLkRpc3RyaWJ1dGUsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdFx0dGhpcy51cGRhdGVTdHlsZXMoKTtcblx0fVxuXG5cdG92ZXJyaWRlIHVwZGF0ZVN0eWxlcygpOiB2b2lkIHtcblx0XHRjb25zdCBib3JkZXJDb2xvciA9IHRoaXMudGhlbWUuZ2V0Q29sb3IocHJvZmlsZXNTYXNoQm9yZGVyKSE7XG5cdFx0dGhpcy5zcGxpdFZpZXc/LnN0eWxlKHsgc2VwYXJhdG9yQm9yZGVyOiBib3JkZXJDb2xvciB9KTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyU2lkZWJhcihwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0Ly8gcmVuZGVyIE5ldyBQcm9maWxlIEJ1dHRvblxuXHRcdHRoaXMucmVuZGVyTmV3UHJvZmlsZUJ1dHRvbihhcHBlbmQocGFyZW50LCAkKCcubmV3LXByb2ZpbGUtYnV0dG9uJykpKTtcblxuXHRcdC8vIHJlbmRlciBwcm9maWxlcyBsaXN0XG5cdFx0Y29uc3QgcmVuZGVyZXIgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFByb2ZpbGVFbGVtZW50UmVuZGVyZXIpO1xuXHRcdGNvbnN0IGRlbGVnYXRlID0gbmV3IFByb2ZpbGVFbGVtZW50RGVsZWdhdGUoKTtcblx0XHR0aGlzLnByb2ZpbGVzTGlzdCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya2JlbmNoTGlzdDxBYnN0cmFjdFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQ+LCAnUHJvZmlsZXNMaXN0Jyxcblx0XHRcdGFwcGVuZChwYXJlbnQsICQoJy5wcm9maWxlcy1saXN0JykpLFxuXHRcdFx0ZGVsZWdhdGUsXG5cdFx0XHRbcmVuZGVyZXJdLFxuXHRcdFx0e1xuXHRcdFx0XHRtdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQ6IGZhbHNlLFxuXHRcdFx0XHRzZXRSb3dMaW5lSGVpZ2h0OiBmYWxzZSxcblx0XHRcdFx0aG9yaXpvbnRhbFNjcm9sbGluZzogZmFsc2UsXG5cdFx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjoge1xuXHRcdFx0XHRcdGdldEFyaWFMYWJlbChwcm9maWxlRWxlbWVudDogQWJzdHJhY3RVc2VyRGF0YVByb2ZpbGVFbGVtZW50IHwgbnVsbCk6IHN0cmluZyB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcHJvZmlsZUVsZW1lbnQ/Lm5hbWUgPz8gJyc7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRnZXRXaWRnZXRBcmlhTGFiZWwoKTogc3RyaW5nIHtcblx0XHRcdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgncHJvZmlsZXMnLCBcIlByb2ZpbGVzXCIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0b3Blbk9uU2luZ2xlQ2xpY2s6IHRydWUsXG5cdFx0XHRcdGlkZW50aXR5UHJvdmlkZXI6IHtcblx0XHRcdFx0XHRnZXRJZChlKSB7XG5cdFx0XHRcdFx0XHRpZiAoZSBpbnN0YW5jZW9mIFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIGUucHJvZmlsZS5pZDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiBlLm5hbWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRhbHdheXNDb25zdW1lTW91c2VXaGVlbDogZmFsc2UsXG5cdFx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlck5ld1Byb2ZpbGVCdXR0b24ocGFyZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdGNvbnN0IGJ1dHRvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBCdXR0b25XaXRoRHJvcGRvd24ocGFyZW50LCB7XG5cdFx0XHRhY3Rpb25zOiB7XG5cdFx0XHRcdGdldEFjdGlvbnM6ICgpID0+IHtcblx0XHRcdFx0XHRjb25zdCBhY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblx0XHRcdFx0XHRpZiAodGhpcy50ZW1wbGF0ZXMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHRhY3Rpb25zLnB1c2gobmV3IFN1Ym1lbnVBY3Rpb24oJ2Zyb20udGVtcGxhdGUnLCBsb2NhbGl6ZSgnZnJvbSB0ZW1wbGF0ZScsIFwiRnJvbSBUZW1wbGF0ZVwiKSwgdGhpcy5nZXRDcmVhdGVGcm9tVGVtcGxhdGVBY3Rpb25zKCkpKTtcblx0XHRcdFx0XHRcdGFjdGlvbnMucHVzaChuZXcgU2VwYXJhdG9yKCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRhY3Rpb25zLnB1c2godG9BY3Rpb24oe1xuXHRcdFx0XHRcdFx0aWQ6ICdpbXBvcnRQcm9maWxlJyxcblx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnaW1wb3J0UHJvZmlsZScsIFwiSW1wb3J0IFByb2ZpbGUuLi5cIiksXG5cdFx0XHRcdFx0XHRydW46ICgpID0+IHRoaXMuaW1wb3J0UHJvZmlsZSgpXG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHRcdHJldHVybiBhY3Rpb25zO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0YWRkUHJpbWFyeUFjdGlvblRvRHJvcGRvd246IGZhbHNlLFxuXHRcdFx0Y29udGV4dE1lbnVQcm92aWRlcjogdGhpcy5jb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0XHRzdXBwb3J0SWNvbnM6IHRydWUsXG5cdFx0XHQuLi5kZWZhdWx0QnV0dG9uU3R5bGVzXG5cdFx0fSkpO1xuXHRcdGJ1dHRvbi5sYWJlbCA9IGxvY2FsaXplKCduZXdQcm9maWxlJywgXCJOZXcgUHJvZmlsZVwiKTtcblx0XHR0aGlzLl9yZWdpc3RlcihidXR0b24ub25EaWRDbGljayhlID0+IHRoaXMuY3JlYXRlTmV3UHJvZmlsZSgpKSk7XG5cdH1cblxuXHRwcml2YXRlIGdldENyZWF0ZUZyb21UZW1wbGF0ZUFjdGlvbnMoKTogSUFjdGlvbltdIHtcblx0XHRyZXR1cm4gdGhpcy50ZW1wbGF0ZXMubWFwKHRlbXBsYXRlID0+XG5cdFx0XHR0b0FjdGlvbih7XG5cdFx0XHRcdGlkOiBgdGVtcGxhdGU6JHt0ZW1wbGF0ZS51cmx9YCxcblx0XHRcdFx0bGFiZWw6IHRlbXBsYXRlLm5hbWUsXG5cdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5jcmVhdGVOZXdQcm9maWxlKFVSSS5wYXJzZSh0ZW1wbGF0ZS51cmwpKVxuXHRcdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5wcm9maWxlc0xpc3QpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMucHJvZmlsZXNMaXN0Lm9uRGlkQ2hhbmdlU2VsZWN0aW9uKGUgPT4ge1xuXHRcdFx0XHRjb25zdCBbZWxlbWVudF0gPSBlLmVsZW1lbnRzO1xuXHRcdFx0XHRpZiAoZWxlbWVudCBpbnN0YW5jZW9mIEFic3RyYWN0VXNlckRhdGFQcm9maWxlRWxlbWVudCkge1xuXHRcdFx0XHRcdHRoaXMucHJvZmlsZVdpZGdldD8ucmVuZGVyKGVsZW1lbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnByb2ZpbGVzTGlzdC5vbkNvbnRleHRNZW51KGUgPT4ge1xuXHRcdFx0XHRjb25zdCBhY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblx0XHRcdFx0aWYgKCFlLmVsZW1lbnQpIHtcblx0XHRcdFx0XHRhY3Rpb25zLnB1c2goLi4udGhpcy5nZXRUcmVlQ29udGV4dE1lbnVBY3Rpb25zKCkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChlLmVsZW1lbnQgaW5zdGFuY2VvZiBBYnN0cmFjdFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQpIHtcblx0XHRcdFx0XHRhY3Rpb25zLnB1c2goLi4uZS5lbGVtZW50LmFjdGlvbnNbMV0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChhY3Rpb25zLmxlbmd0aCkge1xuXHRcdFx0XHRcdHRoaXMuY29udGV4dE1lbnVTZXJ2aWNlLnNob3dDb250ZXh0TWVudSh7XG5cdFx0XHRcdFx0XHRnZXRBbmNob3I6ICgpID0+IGUuYW5jaG9yLFxuXHRcdFx0XHRcdFx0Z2V0QWN0aW9uczogKCkgPT4gYWN0aW9ucyxcblx0XHRcdFx0XHRcdGdldEFjdGlvbnNDb250ZXh0OiAoKSA9PiBlLmVsZW1lbnRcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5wcm9maWxlc0xpc3Qub25Nb3VzZURibENsaWNrKGUgPT4ge1xuXHRcdFx0XHRpZiAoIWUuZWxlbWVudCkge1xuXHRcdFx0XHRcdHRoaXMuY3JlYXRlTmV3UHJvZmlsZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRUcmVlQ29udGV4dE1lbnVBY3Rpb25zKCk6IElBY3Rpb25bXSB7XG5cdFx0Y29uc3QgYWN0aW9uczogSUFjdGlvbltdID0gW107XG5cdFx0YWN0aW9ucy5wdXNoKHRvQWN0aW9uKHtcblx0XHRcdGlkOiAnbmV3UHJvZmlsZScsXG5cdFx0XHRsYWJlbDogbG9jYWxpemUoJ25ld1Byb2ZpbGUnLCBcIk5ldyBQcm9maWxlXCIpLFxuXHRcdFx0cnVuOiAoKSA9PiB0aGlzLmNyZWF0ZU5ld1Byb2ZpbGUoKVxuXHRcdH0pKTtcblx0XHRjb25zdCB0ZW1wbGF0ZUFjdGlvbnMgPSB0aGlzLmdldENyZWF0ZUZyb21UZW1wbGF0ZUFjdGlvbnMoKTtcblx0XHRpZiAodGVtcGxhdGVBY3Rpb25zLmxlbmd0aCkge1xuXHRcdFx0YWN0aW9ucy5wdXNoKG5ldyBTdWJtZW51QWN0aW9uKCdmcm9tLnRlbXBsYXRlJywgbG9jYWxpemUoJ25ldyBmcm9tIHRlbXBsYXRlJywgXCJOZXcgUHJvZmlsZSBGcm9tIFRlbXBsYXRlXCIpLCB0ZW1wbGF0ZUFjdGlvbnMpKTtcblx0XHR9XG5cdFx0YWN0aW9ucy5wdXNoKG5ldyBTZXBhcmF0b3IoKSk7XG5cdFx0YWN0aW9ucy5wdXNoKHRvQWN0aW9uKHtcblx0XHRcdGlkOiAnaW1wb3J0UHJvZmlsZScsXG5cdFx0XHRsYWJlbDogbG9jYWxpemUoJ2ltcG9ydFByb2ZpbGUnLCBcIkltcG9ydCBQcm9maWxlLi4uXCIpLFxuXHRcdFx0cnVuOiAoKSA9PiB0aGlzLmltcG9ydFByb2ZpbGUoKVxuXHRcdH0pKTtcblx0XHRyZXR1cm4gYWN0aW9ucztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaW1wb3J0UHJvZmlsZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBxdWlja1BpY2sgPSBkaXNwb3NhYmxlcy5hZGQodGhpcy5xdWlja0lucHV0U2VydmljZS5jcmVhdGVRdWlja1BpY2soKSk7XG5cblx0XHRjb25zdCB1cGRhdGVRdWlja1BpY2tJdGVtcyA9ICh2YWx1ZT86IHN0cmluZykgPT4ge1xuXHRcdFx0Y29uc3QgcXVpY2tQaWNrSXRlbXM6IElRdWlja1BpY2tJdGVtW10gPSBbXTtcblx0XHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0XHRxdWlja1BpY2tJdGVtcy5wdXNoKHsgbGFiZWw6IHF1aWNrUGljay52YWx1ZSwgZGVzY3JpcHRpb246IGxvY2FsaXplKCdpbXBvcnQgZnJvbSB1cmwnLCBcIkltcG9ydCBmcm9tIFVSTFwiKSB9KTtcblx0XHRcdH1cblx0XHRcdHF1aWNrUGlja0l0ZW1zLnB1c2goeyBsYWJlbDogbG9jYWxpemUoJ2ltcG9ydCBmcm9tIGZpbGUnLCBcIlNlbGVjdCBGaWxlLi4uXCIpIH0pO1xuXHRcdFx0cXVpY2tQaWNrLml0ZW1zID0gcXVpY2tQaWNrSXRlbXM7XG5cdFx0fTtcblxuXHRcdHF1aWNrUGljay50aXRsZSA9IGxvY2FsaXplKCdpbXBvcnQgcHJvZmlsZSBxdWljayBwaWNrIHRpdGxlJywgXCJJbXBvcnQgZnJvbSBQcm9maWxlIFRlbXBsYXRlLi4uXCIpO1xuXHRcdHF1aWNrUGljay5wbGFjZWhvbGRlciA9IGxvY2FsaXplKCdpbXBvcnQgcHJvZmlsZSBwbGFjZWhvbGRlcicsIFwiUHJvdmlkZSBQcm9maWxlIFRlbXBsYXRlIFVSTFwiKTtcblx0XHRxdWlja1BpY2suaWdub3JlRm9jdXNPdXQgPSB0cnVlO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja1BpY2sub25EaWRDaGFuZ2VWYWx1ZSh1cGRhdGVRdWlja1BpY2tJdGVtcykpO1xuXHRcdHVwZGF0ZVF1aWNrUGlja0l0ZW1zKCk7XG5cdFx0cXVpY2tQaWNrLm1hdGNoT25MYWJlbCA9IGZhbHNlO1xuXHRcdHF1aWNrUGljay5tYXRjaE9uRGVzY3JpcHRpb24gPSBmYWxzZTtcblx0XHRkaXNwb3NhYmxlcy5hZGQocXVpY2tQaWNrLm9uRGlkQWNjZXB0KGFzeW5jICgpID0+IHtcblx0XHRcdHF1aWNrUGljay5oaWRlKCk7XG5cdFx0XHRjb25zdCBzZWxlY3RlZEl0ZW0gPSBxdWlja1BpY2suc2VsZWN0ZWRJdGVtc1swXTtcblx0XHRcdGlmICghc2VsZWN0ZWRJdGVtKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHVybCA9IHNlbGVjdGVkSXRlbS5sYWJlbCA9PT0gcXVpY2tQaWNrLnZhbHVlID8gVVJJLnBhcnNlKHF1aWNrUGljay52YWx1ZSkgOiBhd2FpdCB0aGlzLmdldFByb2ZpbGVVcmlGcm9tRmlsZVN5c3RlbSgpO1xuXHRcdFx0aWYgKHVybCkge1xuXHRcdFx0XHR0aGlzLmNyZWF0ZU5ld1Byb2ZpbGUodXJsKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrUGljay5vbkRpZEhpZGUoKCkgPT4gZGlzcG9zYWJsZXMuZGlzcG9zZSgpKSk7XG5cdFx0cXVpY2tQaWNrLnNob3coKTtcblx0fVxuXG5cdGFzeW5jIGNyZWF0ZU5ld1Byb2ZpbGUoY29weUZyb20/OiBVUkkgfCBJVXNlckRhdGFQcm9maWxlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5tb2RlbD8uY3JlYXRlTmV3UHJvZmlsZShjb3B5RnJvbSk7XG5cdH1cblxuXHRzZWxlY3RQcm9maWxlKHByb2ZpbGU6IElVc2VyRGF0YVByb2ZpbGUpOiB2b2lkIHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMubW9kZWw/LnByb2ZpbGVzLmZpbmRJbmRleChwID0+IHAgaW5zdGFuY2VvZiBVc2VyRGF0YVByb2ZpbGVFbGVtZW50ICYmIHAucHJvZmlsZS5pZCA9PT0gcHJvZmlsZS5pZCk7XG5cdFx0aWYgKGluZGV4ICE9PSB1bmRlZmluZWQgJiYgaW5kZXggPj0gMCkge1xuXHRcdFx0dGhpcy5wcm9maWxlc0xpc3Q/LnNldFNlbGVjdGlvbihbaW5kZXhdKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldFByb2ZpbGVVcmlGcm9tRmlsZVN5c3RlbSgpOiBQcm9taXNlPFVSSSB8IG51bGw+IHtcblx0XHRjb25zdCBwcm9maWxlTG9jYXRpb24gPSBhd2FpdCB0aGlzLmZpbGVEaWFsb2dTZXJ2aWNlLnNob3dPcGVuRGlhbG9nKHtcblx0XHRcdGNhblNlbGVjdEZvbGRlcnM6IGZhbHNlLFxuXHRcdFx0Y2FuU2VsZWN0RmlsZXM6IHRydWUsXG5cdFx0XHRjYW5TZWxlY3RNYW55OiBmYWxzZSxcblx0XHRcdGZpbHRlcnM6IFBST0ZJTEVfRklMVEVSLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdpbXBvcnQgcHJvZmlsZSBkaWFsb2cnLCBcIlNlbGVjdCBQcm9maWxlIFRlbXBsYXRlIEZpbGVcIiksXG5cdFx0fSk7XG5cdFx0aWYgKCFwcm9maWxlTG9jYXRpb24pIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRyZXR1cm4gcHJvZmlsZUxvY2F0aW9uWzBdO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgc2V0SW5wdXQoaW5wdXQ6IFVzZXJEYXRhUHJvZmlsZXNFZGl0b3JJbnB1dCwgb3B0aW9uczogSUVkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQsIGNvbnRleHQ6IElFZGl0b3JPcGVuQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgc3VwZXIuc2V0SW5wdXQoaW5wdXQsIG9wdGlvbnMsIGNvbnRleHQsIHRva2VuKTtcblx0XHR0aGlzLm1vZGVsID0gYXdhaXQgaW5wdXQucmVzb2x2ZSgpO1xuXHRcdHRoaXMubW9kZWwuZ2V0VGVtcGxhdGVzKCkudGhlbih0ZW1wbGF0ZXMgPT4ge1xuXHRcdFx0dGhpcy50ZW1wbGF0ZXMgPSB0ZW1wbGF0ZXM7XG5cdFx0XHRpZiAodGhpcy5wcm9maWxlV2lkZ2V0KSB7XG5cdFx0XHRcdHRoaXMucHJvZmlsZVdpZGdldC50ZW1wbGF0ZXMgPSB0ZW1wbGF0ZXM7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dGhpcy51cGRhdGVQcm9maWxlc0xpc3QoKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLm1vZGVsLm9uRGlkQ2hhbmdlKGVsZW1lbnQgPT5cblx0XHRcdHRoaXMudXBkYXRlUHJvZmlsZXNMaXN0KGVsZW1lbnQpKSk7XG5cdH1cblxuXHRvdmVycmlkZSBmb2N1cygpOiB2b2lkIHtcblx0XHRzdXBlci5mb2N1cygpO1xuXHRcdHRoaXMucHJvZmlsZXNMaXN0Py5kb21Gb2N1cygpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVQcm9maWxlc0xpc3QoZWxlbWVudFRvU2VsZWN0PzogQWJzdHJhY3RVc2VyRGF0YVByb2ZpbGVFbGVtZW50KTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLm1vZGVsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGN1cnJlbnRTZWxlY3Rpb25JbmRleCA9IHRoaXMucHJvZmlsZXNMaXN0Py5nZXRTZWxlY3Rpb24oKT8uWzBdO1xuXHRcdGNvbnN0IGN1cnJlbnRTZWxlY3Rpb24gPSBjdXJyZW50U2VsZWN0aW9uSW5kZXggIT09IHVuZGVmaW5lZCA/IHRoaXMucHJvZmlsZXNMaXN0Py5lbGVtZW50KGN1cnJlbnRTZWxlY3Rpb25JbmRleCkgOiB1bmRlZmluZWQ7XG5cdFx0dGhpcy5wcm9maWxlc0xpc3Q/LnNwbGljZSgwLCB0aGlzLnByb2ZpbGVzTGlzdC5sZW5ndGgsIHRoaXMubW9kZWwucHJvZmlsZXMpO1xuXG5cdFx0aWYgKGVsZW1lbnRUb1NlbGVjdCkge1xuXHRcdFx0dGhpcy5wcm9maWxlc0xpc3Q/LnNldFNlbGVjdGlvbihbdGhpcy5tb2RlbC5wcm9maWxlcy5pbmRleE9mKGVsZW1lbnRUb1NlbGVjdCldKTtcblx0XHR9IGVsc2UgaWYgKGN1cnJlbnRTZWxlY3Rpb24pIHtcblx0XHRcdGlmICghdGhpcy5tb2RlbC5wcm9maWxlcy5pbmNsdWRlcyhjdXJyZW50U2VsZWN0aW9uKSkge1xuXHRcdFx0XHRjb25zdCBlbGVtZW50VG9TZWxlY3QgPSB0aGlzLm1vZGVsLnByb2ZpbGVzLmZpbmQocHJvZmlsZSA9PiBwcm9maWxlLm5hbWUgPT09IGN1cnJlbnRTZWxlY3Rpb24ubmFtZSkgPz8gdGhpcy5tb2RlbC5wcm9maWxlc1swXTtcblx0XHRcdFx0aWYgKGVsZW1lbnRUb1NlbGVjdCkge1xuXHRcdFx0XHRcdHRoaXMucHJvZmlsZXNMaXN0Py5zZXRTZWxlY3Rpb24oW3RoaXMubW9kZWwucHJvZmlsZXMuaW5kZXhPZihlbGVtZW50VG9TZWxlY3QpXSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgZWxlbWVudFRvU2VsZWN0ID0gdGhpcy5tb2RlbC5wcm9maWxlcy5maW5kKHByb2ZpbGUgPT4gcHJvZmlsZS5hY3RpdmUpID8/IHRoaXMubW9kZWwucHJvZmlsZXNbMF07XG5cdFx0XHRpZiAoZWxlbWVudFRvU2VsZWN0KSB7XG5cdFx0XHRcdHRoaXMucHJvZmlsZXNMaXN0Py5zZXRTZWxlY3Rpb24oW3RoaXMubW9kZWwucHJvZmlsZXMuaW5kZXhPZihlbGVtZW50VG9TZWxlY3QpXSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cbn1cblxuaW50ZXJmYWNlIElQcm9maWxlRWxlbWVudFRlbXBsYXRlRGF0YSB7XG5cdHJlYWRvbmx5IGljb246IEhUTUxFbGVtZW50O1xuXHRyZWFkb25seSBsYWJlbDogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IGRpcnR5OiBIVE1MRWxlbWVudDtcblx0cmVhZG9ubHkgZGVzY3JpcHRpb246IEhUTUxFbGVtZW50O1xuXHRyZWFkb25seSBhY3Rpb25CYXI6IFdvcmtiZW5jaFRvb2xCYXI7XG5cdHJlYWRvbmx5IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdHJlYWRvbmx5IGVsZW1lbnREaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xufVxuXG5jbGFzcyBQcm9maWxlRWxlbWVudERlbGVnYXRlIGltcGxlbWVudHMgSUxpc3RWaXJ0dWFsRGVsZWdhdGU8QWJzdHJhY3RVc2VyRGF0YVByb2ZpbGVFbGVtZW50PiB7XG5cdGdldEhlaWdodChlbGVtZW50OiBBYnN0cmFjdFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQpIHtcblx0XHRyZXR1cm4gMjI7XG5cdH1cblx0Z2V0VGVtcGxhdGVJZCgpIHsgcmV0dXJuICdwcm9maWxlTGlzdEVsZW1lbnQnOyB9XG59XG5cbmNsYXNzIFByb2ZpbGVFbGVtZW50UmVuZGVyZXIgaW1wbGVtZW50cyBJTGlzdFJlbmRlcmVyPEFic3RyYWN0VXNlckRhdGFQcm9maWxlRWxlbWVudCwgSVByb2ZpbGVFbGVtZW50VGVtcGxhdGVEYXRhPiB7XG5cblx0cmVhZG9ubHkgdGVtcGxhdGVJZCA9ICdwcm9maWxlTGlzdEVsZW1lbnQnO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJUHJvZmlsZUVsZW1lbnRUZW1wbGF0ZURhdGEge1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgZWxlbWVudERpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0Y29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ3Byb2ZpbGUtbGlzdC1pdGVtJyk7XG5cdFx0Y29uc3QgaWNvbiA9IGFwcGVuZChjb250YWluZXIsICQoJy5wcm9maWxlLWxpc3QtaXRlbS1pY29uJykpO1xuXHRcdGNvbnN0IGxhYmVsID0gYXBwZW5kKGNvbnRhaW5lciwgJCgnLnByb2ZpbGUtbGlzdC1pdGVtLWxhYmVsJykpO1xuXHRcdGNvbnN0IGRpcnR5ID0gYXBwZW5kKGNvbnRhaW5lciwgJChgc3BhbiR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoQ29kaWNvbi5jaXJjbGVGaWxsZWQpfWApKTtcblx0XHRjb25zdCBkZXNjcmlwdGlvbiA9IGFwcGVuZChjb250YWluZXIsICQoJy5wcm9maWxlLWxpc3QtaXRlbS1kZXNjcmlwdGlvbicpKTtcblx0XHRhcHBlbmQoZGVzY3JpcHRpb24sICQoYHNwYW4ke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKENvZGljb24uY2hlY2spfWApLCAkKCdzcGFuJywgdW5kZWZpbmVkLCBsb2NhbGl6ZSgnYWN0aXZlUHJvZmlsZScsIFwiQWN0aXZlXCIpKSk7XG5cblx0XHRjb25zdCBhY3Rpb25zQ29udGFpbmVyID0gYXBwZW5kKGNvbnRhaW5lciwgJCgnLnByb2ZpbGUtdHJlZS1pdGVtLWFjdGlvbnMtY29udGFpbmVyJykpO1xuXHRcdGNvbnN0IGFjdGlvbkJhciA9IGRpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdvcmtiZW5jaFRvb2xCYXIsXG5cdFx0XHRhY3Rpb25zQ29udGFpbmVyLFxuXHRcdFx0e1xuXHRcdFx0XHRob3ZlckRlbGVnYXRlOiBkaXNwb3NhYmxlcy5hZGQoY3JlYXRlSW5zdGFudEhvdmVyRGVsZWdhdGUoKSksXG5cdFx0XHRcdGhpZ2hsaWdodFRvZ2dsZWRJdGVtczogdHJ1ZVxuXHRcdFx0fVxuXHRcdCkpO1xuXG5cdFx0cmV0dXJuIHsgbGFiZWwsIGljb24sIGRpcnR5LCBkZXNjcmlwdGlvbiwgYWN0aW9uQmFyLCBkaXNwb3NhYmxlcywgZWxlbWVudERpc3Bvc2FibGVzIH07XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGVsZW1lbnQ6IEFic3RyYWN0VXNlckRhdGFQcm9maWxlRWxlbWVudCwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJUHJvZmlsZUVsZW1lbnRUZW1wbGF0ZURhdGEsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdHRlbXBsYXRlRGF0YS5sYWJlbC50ZXh0Q29udGVudCA9IGVsZW1lbnQubmFtZTtcblx0XHR0ZW1wbGF0ZURhdGEubGFiZWwuY2xhc3NMaXN0LnRvZ2dsZSgnbmV3LXByb2ZpbGUnLCBlbGVtZW50IGluc3RhbmNlb2YgTmV3UHJvZmlsZUVsZW1lbnQpO1xuXHRcdHRlbXBsYXRlRGF0YS5pY29uLmNsYXNzTmFtZSA9IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShlbGVtZW50Lmljb24gPyBUaGVtZUljb24uZnJvbUlkKGVsZW1lbnQuaWNvbikgOiBERUZBVUxUX0lDT04pO1xuXHRcdHRlbXBsYXRlRGF0YS5kaXJ0eS5jbGFzc0xpc3QudG9nZ2xlKCdoaWRlJywgIShlbGVtZW50IGluc3RhbmNlb2YgTmV3UHJvZmlsZUVsZW1lbnQpKTtcblx0XHR0ZW1wbGF0ZURhdGEuZGVzY3JpcHRpb24uY2xhc3NMaXN0LnRvZ2dsZSgnaGlkZScsICFlbGVtZW50LmFjdGl2ZSk7XG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQoZWxlbWVudC5vbkRpZENoYW5nZShlID0+IHtcblx0XHRcdGlmIChlLm5hbWUpIHtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLmxhYmVsLnRleHRDb250ZW50ID0gZWxlbWVudC5uYW1lO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGUuaWNvbikge1xuXHRcdFx0XHRpZiAoZWxlbWVudC5pY29uKSB7XG5cdFx0XHRcdFx0dGVtcGxhdGVEYXRhLmljb24uY2xhc3NOYW1lID0gVGhlbWVJY29uLmFzQ2xhc3NOYW1lKFRoZW1lSWNvbi5mcm9tSWQoZWxlbWVudC5pY29uKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGVtcGxhdGVEYXRhLmljb24uY2xhc3NOYW1lID0gJ2hpZGUnO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRpZiAoZS5hY3RpdmUpIHtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLmRlc2NyaXB0aW9uLmNsYXNzTGlzdC50b2dnbGUoJ2hpZGUnLCAhZWxlbWVudC5hY3RpdmUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRjb25zdCBzZXRBY3Rpb25zID0gKCkgPT4gdGVtcGxhdGVEYXRhLmFjdGlvbkJhci5zZXRBY3Rpb25zKGVsZW1lbnQuYWN0aW9uc1swXS5maWx0ZXIoYSA9PiBhLmVuYWJsZWQpLCBlbGVtZW50LmFjdGlvbnNbMV0uZmlsdGVyKGEgPT4gYS5lbmFibGVkKSk7XG5cdFx0c2V0QWN0aW9ucygpO1xuXHRcdGNvbnN0IGV2ZW50czogRXZlbnQ8SUFjdGlvbkNoYW5nZUV2ZW50PltdID0gW107XG5cdFx0Zm9yIChjb25zdCBhY3Rpb24gb2YgZWxlbWVudC5hY3Rpb25zLmZsYXQoKSkge1xuXHRcdFx0aWYgKGFjdGlvbiBpbnN0YW5jZW9mIEFjdGlvbikge1xuXHRcdFx0XHRldmVudHMucHVzaChhY3Rpb24ub25EaWRDaGFuZ2UpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudERpc3Bvc2FibGVzLmFkZChFdmVudC5hbnkoLi4uZXZlbnRzKShlID0+IHtcblx0XHRcdGlmIChlLmVuYWJsZWQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRzZXRBY3Rpb25zKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdH1cblxuXHRkaXNwb3NlRWxlbWVudChlbGVtZW50OiBBYnN0cmFjdFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQsIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSVByb2ZpbGVFbGVtZW50VGVtcGxhdGVEYXRhLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElQcm9maWxlRWxlbWVudFRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cbn1cblxuY2xhc3MgUHJvZmlsZVdpZGdldCBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgcHJvZmlsZVRpdGxlOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSByZWFkb25seSBwcm9maWxlVHJlZUNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgcmVhZG9ubHkgYnV0dG9uQ29udGFpbmVyOiBIVE1MRWxlbWVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHByb2ZpbGVUcmVlOiBXb3JrYmVuY2hBc3luY0RhdGFUcmVlPEFic3RyYWN0VXNlckRhdGFQcm9maWxlRWxlbWVudCwgUHJvZmlsZVRyZWVFbGVtZW50Pjtcblx0cHJpdmF0ZSByZWFkb25seSBjb3B5RnJvbVByb2ZpbGVSZW5kZXJlcjogQ29weUZyb21Qcm9maWxlUmVuZGVyZXI7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb2ZpbGVFbGVtZW50ID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlPHsgZWxlbWVudDogQWJzdHJhY3RVc2VyRGF0YVByb2ZpbGVFbGVtZW50IH0gJiBJRGlzcG9zYWJsZT4oKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBsYXlvdXRQYXJ0aWNpcGFudHM6IHsgbGF5b3V0OiAoKSA9PiB2b2lkIH1bXSA9IFtdO1xuXG5cdHB1YmxpYyBzZXQgdGVtcGxhdGVzKHRlbXBsYXRlczogcmVhZG9ubHkgSVByb2ZpbGVUZW1wbGF0ZUluZm9bXSkge1xuXHRcdHRoaXMuY29weUZyb21Qcm9maWxlUmVuZGVyZXIuc2V0VGVtcGxhdGVzKHRlbXBsYXRlcyk7XG5cdFx0dGhpcy5wcm9maWxlVHJlZS5yZXJlbmRlcigpO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cGFyZW50OiBIVE1MRWxlbWVudCxcblx0XHRASUVkaXRvclByb2dyZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVkaXRvclByb2dyZXNzU2VydmljZTogSUVkaXRvclByb2dyZXNzU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGNvbnN0IGhlYWRlciA9IGFwcGVuZChwYXJlbnQsICQoJy5wcm9maWxlLWhlYWRlcicpKTtcblx0XHRjb25zdCB0aXRsZSA9IGFwcGVuZChoZWFkZXIsICQoJy5wcm9maWxlLXRpdGxlLWNvbnRhaW5lcicpKTtcblx0XHR0aGlzLnByb2ZpbGVUaXRsZSA9IGFwcGVuZCh0aXRsZSwgJCgnJykpO1xuXG5cdFx0Y29uc3QgYm9keSA9IGFwcGVuZChwYXJlbnQsICQoJy5wcm9maWxlLWJvZHknKSk7XG5cblx0XHRjb25zdCBkZWxlZ2F0ZSA9IG5ldyBQcm9maWxlVHJlZURlbGVnYXRlKCk7XG5cdFx0Y29uc3QgY29udGVudHNSZW5kZXJlciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29udGVudHNQcm9maWxlUmVuZGVyZXIpKTtcblx0XHRjb25zdCBhc3NvY2lhdGlvbnNSZW5kZXJlciA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUHJvZmlsZVdvcmtzcGFjZXNSZW5kZXJlcikpO1xuXHRcdHRoaXMubGF5b3V0UGFydGljaXBhbnRzLnB1c2goYXNzb2NpYXRpb25zUmVuZGVyZXIpO1xuXHRcdHRoaXMuY29weUZyb21Qcm9maWxlUmVuZGVyZXIgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENvcHlGcm9tUHJvZmlsZVJlbmRlcmVyKSk7XG5cdFx0dGhpcy5wcm9maWxlVHJlZUNvbnRhaW5lciA9IGFwcGVuZChib2R5LCAkKCcucHJvZmlsZS10cmVlJykpO1xuXHRcdHRoaXMucHJvZmlsZVRyZWUgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdvcmtiZW5jaEFzeW5jRGF0YVRyZWU8QWJzdHJhY3RVc2VyRGF0YVByb2ZpbGVFbGVtZW50LCBQcm9maWxlVHJlZUVsZW1lbnQ+LFxuXHRcdFx0J1Byb2ZpbGVFZGl0b3ItVHJlZScsXG5cdFx0XHR0aGlzLnByb2ZpbGVUcmVlQ29udGFpbmVyLFxuXHRcdFx0ZGVsZWdhdGUsXG5cdFx0XHRbXG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUHJvZmlsZU5hbWVSZW5kZXJlcikpLFxuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFByb2ZpbGVJY29uUmVuZGVyZXIpKSxcblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShVc2VGb3JDdXJyZW50V2luZG93UHJvcGVydHlSZW5kZXJlcikpLFxuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFVzZUFzRGVmYXVsdFByb2ZpbGVSZW5kZXJlcikpLFxuXHRcdFx0XHR0aGlzLmNvcHlGcm9tUHJvZmlsZVJlbmRlcmVyLFxuXHRcdFx0XHRjb250ZW50c1JlbmRlcmVyLFxuXHRcdFx0XHRhc3NvY2lhdGlvbnNSZW5kZXJlcixcblx0XHRcdF0sXG5cdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFByb2ZpbGVUcmVlRGF0YVNvdXJjZSksXG5cdFx0XHR7XG5cdFx0XHRcdG11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydDogZmFsc2UsXG5cdFx0XHRcdGhvcml6b250YWxTY3JvbGxpbmc6IGZhbHNlLFxuXHRcdFx0XHRhY2Nlc3NpYmlsaXR5UHJvdmlkZXI6IHtcblx0XHRcdFx0XHRnZXRBcmlhTGFiZWwoZWxlbWVudDogUHJvZmlsZVRyZWVFbGVtZW50IHwgbnVsbCk6IHN0cmluZyB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZWxlbWVudD8uZWxlbWVudCA/PyAnJztcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGdldFdpZGdldEFyaWFMYWJlbCgpOiBzdHJpbmcge1xuXHRcdFx0XHRcdFx0cmV0dXJuICcnO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGlkZW50aXR5UHJvdmlkZXI6IHtcblx0XHRcdFx0XHRnZXRJZChlbGVtZW50KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZWxlbWVudC5lbGVtZW50O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0ZXhwYW5kT25seU9uVHdpc3RpZUNsaWNrOiB0cnVlLFxuXHRcdFx0XHRyZW5kZXJJbmRlbnRHdWlkZXM6IFJlbmRlckluZGVudEd1aWRlcy5Ob25lLFxuXHRcdFx0XHRlbmFibGVTdGlja3lTY3JvbGw6IGZhbHNlLFxuXHRcdFx0XHRvcGVuT25TaW5nbGVDbGljazogZmFsc2UsXG5cdFx0XHRcdHNldFJvd0xpbmVIZWlnaHQ6IGZhbHNlLFxuXHRcdFx0XHRzdXBwb3J0RHluYW1pY0hlaWdodHM6IHRydWUsXG5cdFx0XHRcdGFsd2F5c0NvbnN1bWVNb3VzZVdoZWVsOiBmYWxzZSxcblx0XHRcdH0pKTtcblxuXHRcdHRoaXMucHJvZmlsZVRyZWUuc3R5bGUobGlzdFN0eWxlcyk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcihjb250ZW50c1JlbmRlcmVyLm9uRGlkQ2hhbmdlQ29udGVudEhlaWdodCgoZSkgPT4gdGhpcy5wcm9maWxlVHJlZS51cGRhdGVFbGVtZW50SGVpZ2h0KGUsIHVuZGVmaW5lZCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihhc3NvY2lhdGlvbnNSZW5kZXJlci5vbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQoKGUpID0+IHRoaXMucHJvZmlsZVRyZWUudXBkYXRlRWxlbWVudEhlaWdodChlLCB1bmRlZmluZWQpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29udGVudHNSZW5kZXJlci5vbkRpZENoYW5nZVNlbGVjdGlvbigoZSkgPT4ge1xuXHRcdFx0aWYgKGUuc2VsZWN0ZWQpIHtcblx0XHRcdFx0dGhpcy5wcm9maWxlVHJlZS5zZXRGb2N1cyhbXSk7XG5cdFx0XHRcdHRoaXMucHJvZmlsZVRyZWUuc2V0U2VsZWN0aW9uKFtdKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnByb2ZpbGVUcmVlLm9uRGlkQ2hhbmdlQ29udGVudEhlaWdodCgoZSkgPT4ge1xuXHRcdFx0aWYgKHRoaXMuZGltZW5zaW9uKSB7XG5cdFx0XHRcdHRoaXMubGF5b3V0KHRoaXMuZGltZW5zaW9uKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnByb2ZpbGVUcmVlLm9uRGlkQ2hhbmdlU2VsZWN0aW9uKChlKSA9PiB7XG5cdFx0XHRpZiAoZS5lbGVtZW50cy5sZW5ndGgpIHtcblx0XHRcdFx0Y29udGVudHNSZW5kZXJlci5jbGVhclNlbGVjdGlvbigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuYnV0dG9uQ29udGFpbmVyID0gYXBwZW5kKGJvZHksICQoJy5wcm9maWxlLXJvdy1jb250YWluZXIucHJvZmlsZS1idXR0b24tY29udGFpbmVyJykpO1xuXHR9XG5cblx0cHJpdmF0ZSBkaW1lbnNpb246IERpbWVuc2lvbiB8IHVuZGVmaW5lZDtcblx0bGF5b3V0KGRpbWVuc2lvbjogRGltZW5zaW9uKTogdm9pZCB7XG5cdFx0dGhpcy5kaW1lbnNpb24gPSBkaW1lbnNpb247XG5cdFx0Y29uc3QgdHJlZUNvbnRlbnRIZWlnaHQgPSB0aGlzLnByb2ZpbGVUcmVlLmNvbnRlbnRIZWlnaHQ7XG5cdFx0Y29uc3QgaGVpZ2h0ID0gTWF0aC5taW4odHJlZUNvbnRlbnRIZWlnaHQsIGRpbWVuc2lvbi5oZWlnaHQgLSAodGhpcy5fcHJvZmlsZUVsZW1lbnQudmFsdWU/LmVsZW1lbnQgaW5zdGFuY2VvZiBOZXdQcm9maWxlRWxlbWVudCA/IDExNiA6IDU0KSk7XG5cdFx0dGhpcy5wcm9maWxlVHJlZUNvbnRhaW5lci5zdHlsZS5oZWlnaHQgPSBgJHtoZWlnaHR9cHhgO1xuXHRcdHRoaXMucHJvZmlsZVRyZWUubGF5b3V0KGhlaWdodCwgZGltZW5zaW9uLndpZHRoKTtcblx0XHRmb3IgKGNvbnN0IHBhcnRpY2lwYW50IG9mIHRoaXMubGF5b3V0UGFydGljaXBhbnRzKSB7XG5cdFx0XHRwYXJ0aWNpcGFudC5sYXlvdXQoKTtcblx0XHR9XG5cdH1cblxuXHRyZW5kZXIocHJvZmlsZUVsZW1lbnQ6IEFic3RyYWN0VXNlckRhdGFQcm9maWxlRWxlbWVudCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9wcm9maWxlRWxlbWVudC52YWx1ZT8uZWxlbWVudCA9PT0gcHJvZmlsZUVsZW1lbnQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fcHJvZmlsZUVsZW1lbnQudmFsdWU/LmVsZW1lbnQgaW5zdGFuY2VvZiBVc2VyRGF0YVByb2ZpbGVFbGVtZW50KSB7XG5cdFx0XHR0aGlzLl9wcm9maWxlRWxlbWVudC52YWx1ZS5lbGVtZW50LnJlc2V0KCk7XG5cdFx0fVxuXHRcdHRoaXMucHJvZmlsZVRyZWUuc2V0SW5wdXQocHJvZmlsZUVsZW1lbnQpO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0dGhpcy5fcHJvZmlsZUVsZW1lbnQudmFsdWUgPSB7IGVsZW1lbnQ6IHByb2ZpbGVFbGVtZW50LCBkaXNwb3NlOiAoKSA9PiBkaXNwb3NhYmxlcy5kaXNwb3NlKCkgfTtcblxuXHRcdHRoaXMucHJvZmlsZVRpdGxlLnRleHRDb250ZW50ID0gcHJvZmlsZUVsZW1lbnQubmFtZTtcblx0XHRkaXNwb3NhYmxlcy5hZGQocHJvZmlsZUVsZW1lbnQub25EaWRDaGFuZ2UoZSA9PiB7XG5cdFx0XHRpZiAoZS5uYW1lKSB7XG5cdFx0XHRcdHRoaXMucHJvZmlsZVRpdGxlLnRleHRDb250ZW50ID0gcHJvZmlsZUVsZW1lbnQubmFtZTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRjb25zdCBbcHJpbWFyeVRpdGxlQnV0dG9ucywgc2Vjb25kYXR5VGl0bGVCdXR0b25zXSA9IHByb2ZpbGVFbGVtZW50LnRpdGxlQnV0dG9ucztcblx0XHRpZiAocHJpbWFyeVRpdGxlQnV0dG9ucz8ubGVuZ3RoIHx8IHNlY29uZGF0eVRpdGxlQnV0dG9ucz8ubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLmJ1dHRvbkNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdoaWRlJyk7XG5cblx0XHRcdGlmIChzZWNvbmRhdHlUaXRsZUJ1dHRvbnM/Lmxlbmd0aCkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGFjdGlvbiBvZiBzZWNvbmRhdHlUaXRsZUJ1dHRvbnMpIHtcblx0XHRcdFx0XHRjb25zdCBidXR0b24gPSBkaXNwb3NhYmxlcy5hZGQobmV3IEJ1dHRvbih0aGlzLmJ1dHRvbkNvbnRhaW5lciwge1xuXHRcdFx0XHRcdFx0Li4uZGVmYXVsdEJ1dHRvblN0eWxlcyxcblx0XHRcdFx0XHRcdHNlY29uZGFyeTogdHJ1ZVxuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0XHRidXR0b24ubGFiZWwgPSBhY3Rpb24ubGFiZWw7XG5cdFx0XHRcdFx0YnV0dG9uLmVuYWJsZWQgPSBhY3Rpb24uZW5hYmxlZDtcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQoYnV0dG9uLm9uRGlkQ2xpY2soKCkgPT4gdGhpcy5lZGl0b3JQcm9ncmVzc1NlcnZpY2Uuc2hvd1doaWxlKGFjdGlvbi5ydW4oKSkpKTtcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQoYWN0aW9uLm9uRGlkQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoIWlzVW5kZWZpbmVkKGUuZW5hYmxlZCkpIHtcblx0XHRcdFx0XHRcdFx0YnV0dG9uLmVuYWJsZWQgPSBhY3Rpb24uZW5hYmxlZDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICghaXNVbmRlZmluZWQoZS5sYWJlbCkpIHtcblx0XHRcdFx0XHRcdFx0YnV0dG9uLmxhYmVsID0gYWN0aW9uLmxhYmVsO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAocHJpbWFyeVRpdGxlQnV0dG9ucz8ubGVuZ3RoKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgYWN0aW9uIG9mIHByaW1hcnlUaXRsZUJ1dHRvbnMpIHtcblx0XHRcdFx0XHRjb25zdCBidXR0b24gPSBkaXNwb3NhYmxlcy5hZGQobmV3IEJ1dHRvbih0aGlzLmJ1dHRvbkNvbnRhaW5lciwge1xuXHRcdFx0XHRcdFx0Li4uZGVmYXVsdEJ1dHRvblN0eWxlc1xuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0XHRidXR0b24ubGFiZWwgPSBhY3Rpb24ubGFiZWw7XG5cdFx0XHRcdFx0YnV0dG9uLmVuYWJsZWQgPSBhY3Rpb24uZW5hYmxlZDtcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQoYnV0dG9uLm9uRGlkQ2xpY2soKCkgPT4gdGhpcy5lZGl0b3JQcm9ncmVzc1NlcnZpY2Uuc2hvd1doaWxlKGFjdGlvbi5ydW4oKSkpKTtcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQoYWN0aW9uLm9uRGlkQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoIWlzVW5kZWZpbmVkKGUuZW5hYmxlZCkpIHtcblx0XHRcdFx0XHRcdFx0YnV0dG9uLmVuYWJsZWQgPSBhY3Rpb24uZW5hYmxlZDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICghaXNVbmRlZmluZWQoZS5sYWJlbCkpIHtcblx0XHRcdFx0XHRcdFx0YnV0dG9uLmxhYmVsID0gYWN0aW9uLmxhYmVsO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQocHJvZmlsZUVsZW1lbnQub25EaWRDaGFuZ2UoZSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoZS5tZXNzYWdlKSB7XG5cdFx0XHRcdFx0XHRcdGJ1dHRvbi5zZXRUaXRsZShwcm9maWxlRWxlbWVudC5tZXNzYWdlID8/IGFjdGlvbi5sYWJlbCk7XG5cdFx0XHRcdFx0XHRcdGJ1dHRvbi5lbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ2Vycm9yJywgISFwcm9maWxlRWxlbWVudC5tZXNzYWdlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmJ1dHRvbkNvbnRhaW5lci5jbGFzc0xpc3QuYWRkKCdoaWRlJyk7XG5cdFx0fVxuXG5cdFx0aWYgKHByb2ZpbGVFbGVtZW50IGluc3RhbmNlb2YgTmV3UHJvZmlsZUVsZW1lbnQpIHtcblx0XHRcdHRoaXMucHJvZmlsZVRyZWUuZm9jdXNGaXJzdCgpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmRpbWVuc2lvbikge1xuXHRcdFx0dGhpcy5sYXlvdXQodGhpcy5kaW1lbnNpb24pO1xuXHRcdH1cblx0fVxuXG59XG5cbnR5cGUgUHJvZmlsZVByb3BlcnR5ID0gJ25hbWUnIHwgJ2ljb24nIHwgJ2NvcHlGcm9tJyB8ICd1c2VGb3JDdXJyZW50JyB8ICd1c2VBc0RlZmF1bHQnIHwgJ2NvbnRlbnRzJyB8ICd3b3Jrc3BhY2VzJztcblxuaW50ZXJmYWNlIFByb2ZpbGVUcmVlRWxlbWVudCB7XG5cdGVsZW1lbnQ6IFByb2ZpbGVQcm9wZXJ0eTtcblx0cm9vdDogQWJzdHJhY3RVc2VyRGF0YVByb2ZpbGVFbGVtZW50O1xufVxuXG5jbGFzcyBQcm9maWxlVHJlZURlbGVnYXRlIGV4dGVuZHMgQ2FjaGVkTGlzdFZpcnR1YWxEZWxlZ2F0ZTxQcm9maWxlVHJlZUVsZW1lbnQ+IHtcblxuXHRnZXRUZW1wbGF0ZUlkKHsgZWxlbWVudCB9OiBQcm9maWxlVHJlZUVsZW1lbnQpIHtcblx0XHRyZXR1cm4gZWxlbWVudDtcblx0fVxuXG5cdGhhc0R5bmFtaWNIZWlnaHQoeyBlbGVtZW50IH06IFByb2ZpbGVUcmVlRWxlbWVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBlbGVtZW50ID09PSAnY29udGVudHMnIHx8IGVsZW1lbnQgPT09ICd3b3Jrc3BhY2VzJztcblx0fVxuXG5cdHByb3RlY3RlZCBlc3RpbWF0ZUhlaWdodCh7IGVsZW1lbnQsIHJvb3QgfTogUHJvZmlsZVRyZWVFbGVtZW50KTogbnVtYmVyIHtcblx0XHRzd2l0Y2ggKGVsZW1lbnQpIHtcblx0XHRcdGNhc2UgJ25hbWUnOlxuXHRcdFx0XHRyZXR1cm4gNzI7XG5cdFx0XHRjYXNlICdpY29uJzpcblx0XHRcdFx0cmV0dXJuIDY4O1xuXHRcdFx0Y2FzZSAnY29weUZyb20nOlxuXHRcdFx0XHRyZXR1cm4gOTA7XG5cdFx0XHRjYXNlICd1c2VGb3JDdXJyZW50Jzpcblx0XHRcdGNhc2UgJ3VzZUFzRGVmYXVsdCc6XG5cdFx0XHRcdHJldHVybiA2ODtcblx0XHRcdGNhc2UgJ2NvbnRlbnRzJzpcblx0XHRcdFx0cmV0dXJuIDI1ODtcblx0XHRcdGNhc2UgJ3dvcmtzcGFjZXMnOlxuXHRcdFx0XHRyZXR1cm4gKHJvb3Qud29ya3NwYWNlcyA/IChyb290LndvcmtzcGFjZXMubGVuZ3RoICogMjQpICsgMzAgOiAwKSArIDExMjtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgUHJvZmlsZVRyZWVEYXRhU291cmNlIGltcGxlbWVudHMgSUFzeW5jRGF0YVNvdXJjZTxBYnN0cmFjdFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQsIFByb2ZpbGVUcmVlRWxlbWVudD4ge1xuXG5cdGhhc0NoaWxkcmVuKGVsZW1lbnQ6IEFic3RyYWN0VXNlckRhdGFQcm9maWxlRWxlbWVudCB8IFByb2ZpbGVUcmVlRWxlbWVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBlbGVtZW50IGluc3RhbmNlb2YgQWJzdHJhY3RVc2VyRGF0YVByb2ZpbGVFbGVtZW50O1xuXHR9XG5cblx0YXN5bmMgZ2V0Q2hpbGRyZW4oZWxlbWVudDogQWJzdHJhY3RVc2VyRGF0YVByb2ZpbGVFbGVtZW50IHwgUHJvZmlsZVRyZWVFbGVtZW50KTogUHJvbWlzZTxQcm9maWxlVHJlZUVsZW1lbnRbXT4ge1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgQWJzdHJhY3RVc2VyRGF0YVByb2ZpbGVFbGVtZW50KSB7XG5cdFx0XHRjb25zdCBjaGlsZHJlbjogUHJvZmlsZVRyZWVFbGVtZW50W10gPSBbXTtcblx0XHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgTmV3UHJvZmlsZUVsZW1lbnQpIHtcblx0XHRcdFx0Y2hpbGRyZW4ucHVzaCh7IGVsZW1lbnQ6ICduYW1lJywgcm9vdDogZWxlbWVudCB9KTtcblx0XHRcdFx0Y2hpbGRyZW4ucHVzaCh7IGVsZW1lbnQ6ICdpY29uJywgcm9vdDogZWxlbWVudCB9KTtcblx0XHRcdFx0Y2hpbGRyZW4ucHVzaCh7IGVsZW1lbnQ6ICdjb3B5RnJvbScsIHJvb3Q6IGVsZW1lbnQgfSk7XG5cdFx0XHRcdGNoaWxkcmVuLnB1c2goeyBlbGVtZW50OiAnY29udGVudHMnLCByb290OiBlbGVtZW50IH0pO1xuXHRcdFx0fSBlbHNlIGlmIChlbGVtZW50IGluc3RhbmNlb2YgVXNlckRhdGFQcm9maWxlRWxlbWVudCkge1xuXHRcdFx0XHRpZiAoIWVsZW1lbnQucHJvZmlsZS5pc0RlZmF1bHQpIHtcblx0XHRcdFx0XHRjaGlsZHJlbi5wdXNoKHsgZWxlbWVudDogJ25hbWUnLCByb290OiBlbGVtZW50IH0pO1xuXHRcdFx0XHRcdGNoaWxkcmVuLnB1c2goeyBlbGVtZW50OiAnaWNvbicsIHJvb3Q6IGVsZW1lbnQgfSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y2hpbGRyZW4ucHVzaCh7IGVsZW1lbnQ6ICd1c2VBc0RlZmF1bHQnLCByb290OiBlbGVtZW50IH0pO1xuXHRcdFx0XHRjaGlsZHJlbi5wdXNoKHsgZWxlbWVudDogJ2NvbnRlbnRzJywgcm9vdDogZWxlbWVudCB9KTtcblx0XHRcdFx0Y2hpbGRyZW4ucHVzaCh7IGVsZW1lbnQ6ICd3b3Jrc3BhY2VzJywgcm9vdDogZWxlbWVudCB9KTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBjaGlsZHJlbjtcblx0XHR9XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG59XG5cbmludGVyZmFjZSBQcm9maWxlQ29udGVudFRyZWVFbGVtZW50IHtcblx0ZWxlbWVudDogSVByb2ZpbGVDaGlsZEVsZW1lbnQ7XG5cdHJvb3Q6IEFic3RyYWN0VXNlckRhdGFQcm9maWxlRWxlbWVudDtcbn1cblxuY2xhc3MgUHJvZmlsZUNvbnRlbnRUcmVlRWxlbWVudERlbGVnYXRlIGltcGxlbWVudHMgSUxpc3RWaXJ0dWFsRGVsZWdhdGU8UHJvZmlsZUNvbnRlbnRUcmVlRWxlbWVudD4ge1xuXG5cdGdldFRlbXBsYXRlSWQoZWxlbWVudDogUHJvZmlsZUNvbnRlbnRUcmVlRWxlbWVudCkge1xuXHRcdGlmICghKDxJUHJvZmlsZVJlc291cmNlVHlwZUVsZW1lbnQ+ZWxlbWVudC5lbGVtZW50KS5yZXNvdXJjZVR5cGUpIHtcblx0XHRcdHJldHVybiBQcm9maWxlUmVzb3VyY2VDaGlsZFRyZWVJdGVtUmVuZGVyZXIuVEVNUExBVEVfSUQ7XG5cdFx0fVxuXHRcdGlmIChlbGVtZW50LnJvb3QgaW5zdGFuY2VvZiBOZXdQcm9maWxlRWxlbWVudCkge1xuXHRcdFx0cmV0dXJuIE5ld1Byb2ZpbGVSZXNvdXJjZVRyZWVSZW5kZXJlci5URU1QTEFURV9JRDtcblx0XHR9XG5cdFx0cmV0dXJuIEV4aXN0aW5nUHJvZmlsZVJlc291cmNlVHJlZVJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXHR9XG5cblx0Z2V0SGVpZ2h0KGVsZW1lbnQ6IFByb2ZpbGVDb250ZW50VHJlZUVsZW1lbnQpOiBudW1iZXIge1xuXHRcdHJldHVybiAyNDtcblx0fVxufVxuXG5jbGFzcyBQcm9maWxlUmVzb3VyY2VUcmVlRGF0YVNvdXJjZSBpbXBsZW1lbnRzIElBc3luY0RhdGFTb3VyY2U8QWJzdHJhY3RVc2VyRGF0YVByb2ZpbGVFbGVtZW50LCBQcm9maWxlQ29udGVudFRyZWVFbGVtZW50PiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFZGl0b3JQcm9ncmVzc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JQcm9ncmVzc1NlcnZpY2U6IElFZGl0b3JQcm9ncmVzc1NlcnZpY2UsXG5cdCkgeyB9XG5cblx0aGFzQ2hpbGRyZW4oZWxlbWVudDogQWJzdHJhY3RVc2VyRGF0YVByb2ZpbGVFbGVtZW50IHwgUHJvZmlsZUNvbnRlbnRUcmVlRWxlbWVudCk6IGJvb2xlYW4ge1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgQWJzdHJhY3RVc2VyRGF0YVByb2ZpbGVFbGVtZW50KSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cdFx0aWYgKCg8SVByb2ZpbGVSZXNvdXJjZVR5cGVFbGVtZW50PmVsZW1lbnQuZWxlbWVudCkucmVzb3VyY2VUeXBlKSB7XG5cdFx0XHRpZiAoKDxJUHJvZmlsZVJlc291cmNlVHlwZUVsZW1lbnQ+ZWxlbWVudC5lbGVtZW50KS5yZXNvdXJjZVR5cGUgIT09IFByb2ZpbGVSZXNvdXJjZVR5cGUuRXh0ZW5zaW9ucyAmJiAoPElQcm9maWxlUmVzb3VyY2VUeXBlRWxlbWVudD5lbGVtZW50LmVsZW1lbnQpLnJlc291cmNlVHlwZSAhPT0gUHJvZmlsZVJlc291cmNlVHlwZS5TbmlwcGV0cykge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZWxlbWVudC5yb290IGluc3RhbmNlb2YgTmV3UHJvZmlsZUVsZW1lbnQpIHtcblx0XHRcdFx0Y29uc3QgcmVzb3VyY2VUeXBlID0gKDxJUHJvZmlsZVJlc291cmNlVHlwZUVsZW1lbnQ+ZWxlbWVudC5lbGVtZW50KS5yZXNvdXJjZVR5cGU7XG5cdFx0XHRcdGlmIChlbGVtZW50LnJvb3QuZ2V0RmxhZyhyZXNvdXJjZVR5cGUpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFlbGVtZW50LnJvb3QuaGFzUmVzb3VyY2UocmVzb3VyY2VUeXBlKSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZWxlbWVudC5yb290LmNvcHlGcm9tID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFlbGVtZW50LnJvb3QuZ2V0Q29weUZsYWcocmVzb3VyY2VUeXBlKSkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGFzeW5jIGdldENoaWxkcmVuKGVsZW1lbnQ6IEFic3RyYWN0VXNlckRhdGFQcm9maWxlRWxlbWVudCB8IFByb2ZpbGVDb250ZW50VHJlZUVsZW1lbnQpOiBQcm9taXNlPFByb2ZpbGVDb250ZW50VHJlZUVsZW1lbnRbXT4ge1xuXHRcdGlmIChlbGVtZW50IGluc3RhbmNlb2YgQWJzdHJhY3RVc2VyRGF0YVByb2ZpbGVFbGVtZW50KSB7XG5cdFx0XHRjb25zdCBjaGlsZHJlbiA9IGF3YWl0IGVsZW1lbnQuZ2V0Q2hpbGRyZW4oKTtcblx0XHRcdHJldHVybiBjaGlsZHJlbi5tYXAoZSA9PiAoeyBlbGVtZW50OiBlLCByb290OiBlbGVtZW50IH0pKTtcblx0XHR9XG5cdFx0aWYgKCg8SVByb2ZpbGVSZXNvdXJjZVR5cGVFbGVtZW50PmVsZW1lbnQuZWxlbWVudCkucmVzb3VyY2VUeXBlKSB7XG5cdFx0XHRjb25zdCBwcm9ncmVzc1J1bm5lciA9IHRoaXMuZWRpdG9yUHJvZ3Jlc3NTZXJ2aWNlLnNob3codHJ1ZSwgNTAwKTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbnMgPSBhd2FpdCBlbGVtZW50LnJvb3QuZ2V0Q2hpbGRyZW4oKDxJUHJvZmlsZVJlc291cmNlVHlwZUVsZW1lbnQ+ZWxlbWVudC5lbGVtZW50KS5yZXNvdXJjZVR5cGUpO1xuXHRcdFx0XHRyZXR1cm4gZXh0ZW5zaW9ucy5tYXAoZSA9PiAoeyBlbGVtZW50OiBlLCByb290OiBlbGVtZW50LnJvb3QgfSkpO1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0cHJvZ3Jlc3NSdW5uZXIuZG9uZSgpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gW107XG5cdH1cbn1cblxuaW50ZXJmYWNlIElQcm9maWxlUmVuZGVyZXJUZW1wbGF0ZSB7XG5cdHJlYWRvbmx5IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdHJlYWRvbmx5IGVsZW1lbnREaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xufVxuXG5pbnRlcmZhY2UgSUV4aXN0aW5nUHJvZmlsZVJlc291cmNlVGVtcGxhdGVEYXRhIGV4dGVuZHMgSVByb2ZpbGVSZW5kZXJlclRlbXBsYXRlIHtcblx0cmVhZG9ubHkgbGFiZWw6IEhUTUxFbGVtZW50O1xuXHRyZWFkb25seSByYWRpbzogUmFkaW87XG5cdHJlYWRvbmx5IGFjdGlvbkJhcjogV29ya2JlbmNoVG9vbEJhcjtcbn1cblxuaW50ZXJmYWNlIElOZXdQcm9maWxlUmVzb3VyY2VUZW1wbGF0ZURhdGEgZXh0ZW5kcyBJUHJvZmlsZVJlbmRlcmVyVGVtcGxhdGUge1xuXHRyZWFkb25seSBsYWJlbDogSFRNTEVsZW1lbnQ7XG5cdHJlYWRvbmx5IHJhZGlvOiBSYWRpbztcblx0cmVhZG9ubHkgYWN0aW9uQmFyOiBXb3JrYmVuY2hUb29sQmFyO1xufVxuXG5pbnRlcmZhY2UgSVByb2ZpbGVSZXNvdXJjZUNoaWxkVHJlZUl0ZW1UZW1wbGF0ZURhdGEgZXh0ZW5kcyBJUHJvZmlsZVJlbmRlcmVyVGVtcGxhdGUge1xuXHRyZWFkb25seSBhY3Rpb25CYXI6IFdvcmtiZW5jaFRvb2xCYXI7XG5cdHJlYWRvbmx5IGNoZWNrYm94OiBDaGVja2JveDtcblx0cmVhZG9ubHkgcmVzb3VyY2VMYWJlbDogSVJlc291cmNlTGFiZWw7XG59XG5cbmludGVyZmFjZSBJUHJvZmlsZVByb3BlcnR5UmVuZGVyZXJUZW1wbGF0ZSBleHRlbmRzIElQcm9maWxlUmVuZGVyZXJUZW1wbGF0ZSB7XG5cdGVsZW1lbnQ6IFByb2ZpbGVUcmVlRWxlbWVudDtcbn1cblxuY2xhc3MgQWJzdHJhY3RQcm9maWxlUmVzb3VyY2VUcmVlUmVuZGVyZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcm90ZWN0ZWQgZ2V0UmVzb3VyY2VUeXBlVGl0bGUocmVzb3VyY2VUeXBlOiBQcm9maWxlUmVzb3VyY2VUeXBlKTogc3RyaW5nIHtcblx0XHRzd2l0Y2ggKHJlc291cmNlVHlwZSkge1xuXHRcdFx0Y2FzZSBQcm9maWxlUmVzb3VyY2VUeXBlLlNldHRpbmdzOlxuXHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3NldHRpbmdzJywgXCJTZXR0aW5nc1wiKTtcblx0XHRcdGNhc2UgUHJvZmlsZVJlc291cmNlVHlwZS5LZXliaW5kaW5nczpcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdrZXliaW5kaW5ncycsIFwiS2V5Ym9hcmQgU2hvcnRjdXRzXCIpO1xuXHRcdFx0Y2FzZSBQcm9maWxlUmVzb3VyY2VUeXBlLlNuaXBwZXRzOlxuXHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3NuaXBwZXRzJywgXCJTbmlwcGV0c1wiKTtcblx0XHRcdGNhc2UgUHJvZmlsZVJlc291cmNlVHlwZS5UYXNrczpcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCd0YXNrcycsIFwiVGFza3NcIik7XG5cdFx0XHRjYXNlIFByb2ZpbGVSZXNvdXJjZVR5cGUuRXh0ZW5zaW9uczpcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdleHRlbnNpb25zJywgXCJFeHRlbnNpb25zXCIpO1xuXHRcdH1cblx0XHRyZXR1cm4gJyc7XG5cdH1cblxuXHRkaXNwb3NlRWxlbWVudChlbGVtZW50OiBJVHJlZU5vZGU8UHJvZmlsZUNvbnRlbnRUcmVlRWxlbWVudCB8IFByb2ZpbGVUcmVlRWxlbWVudCwgdm9pZD4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSVByb2ZpbGVSZW5kZXJlclRlbXBsYXRlLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElQcm9maWxlUmVuZGVyZXJUZW1wbGF0ZSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cbn1cblxuYWJzdHJhY3QgY2xhc3MgUHJvZmlsZVByb3BlcnR5UmVuZGVyZXIgZXh0ZW5kcyBBYnN0cmFjdFByb2ZpbGVSZXNvdXJjZVRyZWVSZW5kZXJlciBpbXBsZW1lbnRzIElUcmVlUmVuZGVyZXI8UHJvZmlsZVRyZWVFbGVtZW50LCB2b2lkLCBJUHJvZmlsZVByb3BlcnR5UmVuZGVyZXJUZW1wbGF0ZT4ge1xuXG5cdGFic3RyYWN0IHRlbXBsYXRlSWQ6IFByb2ZpbGVQcm9wZXJ0eTtcblx0YWJzdHJhY3QgcmVuZGVyVGVtcGxhdGUocGFyZW50OiBIVE1MRWxlbWVudCk6IElQcm9maWxlUHJvcGVydHlSZW5kZXJlclRlbXBsYXRlO1xuXG5cdHJlbmRlckVsZW1lbnQoeyBlbGVtZW50IH06IElUcmVlTm9kZTxQcm9maWxlVHJlZUVsZW1lbnQsIHZvaWQ+LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElQcm9maWxlUHJvcGVydHlSZW5kZXJlclRlbXBsYXRlLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudCA9IGVsZW1lbnQ7XG5cdH1cblxufVxuXG5jbGFzcyBQcm9maWxlTmFtZVJlbmRlcmVyIGV4dGVuZHMgUHJvZmlsZVByb3BlcnR5UmVuZGVyZXIge1xuXG5cdHJlYWRvbmx5IHRlbXBsYXRlSWQ6IFByb2ZpbGVQcm9wZXJ0eSA9ICduYW1lJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlc1NlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSxcblx0XHRASUNvbnRleHRWaWV3U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRWaWV3U2VydmljZTogSUNvbnRleHRWaWV3U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHJlbmRlclRlbXBsYXRlKHBhcmVudDogSFRNTEVsZW1lbnQpOiBJUHJvZmlsZVByb3BlcnR5UmVuZGVyZXJUZW1wbGF0ZSB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgZWxlbWVudERpc3Bvc2FibGVzID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdFx0bGV0IHByb2ZpbGVFbGVtZW50OiBQcm9maWxlVHJlZUVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBuYW1lQ29udGFpbmVyID0gYXBwZW5kKHBhcmVudCwgJCgnLnByb2ZpbGUtcm93LWNvbnRhaW5lcicpKTtcblx0XHRhcHBlbmQobmFtZUNvbnRhaW5lciwgJCgnLnByb2ZpbGUtbGFiZWwtZWxlbWVudCcsIHVuZGVmaW5lZCwgbG9jYWxpemUoJ25hbWUnLCBcIk5hbWVcIikpKTtcblx0XHRjb25zdCBuYW1lSW5wdXQgPSBkaXNwb3NhYmxlcy5hZGQobmV3IElucHV0Qm94KFxuXHRcdFx0bmFtZUNvbnRhaW5lcixcblx0XHRcdHRoaXMuY29udGV4dFZpZXdTZXJ2aWNlLFxuXHRcdFx0e1xuXHRcdFx0XHRpbnB1dEJveFN0eWxlczogZ2V0SW5wdXRCb3hTdHlsZSh7XG5cdFx0XHRcdFx0aW5wdXRCb3JkZXI6IHNldHRpbmdzVGV4dElucHV0Qm9yZGVyXG5cdFx0XHRcdH0pLFxuXHRcdFx0XHRhcmlhTGFiZWw6IGxvY2FsaXplKCdwcm9maWxlTmFtZScsIFwiUHJvZmlsZSBOYW1lXCIpLFxuXHRcdFx0XHRwbGFjZWhvbGRlcjogbG9jYWxpemUoJ3Byb2ZpbGVOYW1lJywgXCJQcm9maWxlIE5hbWVcIiksXG5cdFx0XHRcdHZhbGlkYXRpb25PcHRpb25zOiB7XG5cdFx0XHRcdFx0dmFsaWRhdGlvbjogKHZhbHVlKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoIXZhbHVlKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdFx0Y29udGVudDogbG9jYWxpemUoJ25hbWUgcmVxdWlyZWQnLCBcIlByb2ZpbGUgbmFtZSBpcyByZXF1aXJlZCBhbmQgbXVzdCBiZSBhIG5vbi1lbXB0eSB2YWx1ZS5cIiksXG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogTWVzc2FnZVR5cGUuV0FSTklOR1xuXHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKHByb2ZpbGVFbGVtZW50Py5yb290LmRpc2FibGVkKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKCFwcm9maWxlRWxlbWVudD8ucm9vdC5zaG91bGRWYWxpZGF0ZU5hbWUoKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNvbnN0IGluaXRpYWxOYW1lID0gcHJvZmlsZUVsZW1lbnQ/LnJvb3QuZ2V0SW5pdGlhbE5hbWUoKTtcblx0XHRcdFx0XHRcdHZhbHVlID0gdmFsdWUudHJpbSgpO1xuXHRcdFx0XHRcdFx0aWYgKGluaXRpYWxOYW1lICE9PSB2YWx1ZSAmJiB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLnByb2ZpbGVzLnNvbWUocCA9PiAhcC5pc1RyYW5zaWVudCAmJiBwLm5hbWUgPT09IHZhbHVlKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnRlbnQ6IGxvY2FsaXplKCdwcm9maWxlRXhpc3RzJywgXCJQcm9maWxlIHdpdGggbmFtZSB7MH0gYWxyZWFkeSBleGlzdHMuXCIsIHZhbHVlKSxcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiBNZXNzYWdlVHlwZS5XQVJOSU5HXG5cdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHQpKTtcblx0XHRuYW1lSW5wdXQub25EaWRDaGFuZ2UodmFsdWUgPT4ge1xuXHRcdFx0aWYgKHByb2ZpbGVFbGVtZW50ICYmIHZhbHVlKSB7XG5cdFx0XHRcdHByb2ZpbGVFbGVtZW50LnJvb3QubmFtZSA9IHZhbHVlO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdGNvbnN0IGZvY3VzVHJhY2tlciA9IGRpc3Bvc2FibGVzLmFkZCh0cmFja0ZvY3VzKG5hbWVJbnB1dC5pbnB1dEVsZW1lbnQpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoZm9jdXNUcmFja2VyLm9uRGlkQmx1cigoKSA9PiB7XG5cdFx0XHRpZiAocHJvZmlsZUVsZW1lbnQgJiYgIW5hbWVJbnB1dC52YWx1ZSkge1xuXHRcdFx0XHRuYW1lSW5wdXQudmFsdWUgPSBwcm9maWxlRWxlbWVudC5yb290Lm5hbWU7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgcmVuZGVyTmFtZSA9IChwcm9maWxlRWxlbWVudDogUHJvZmlsZVRyZWVFbGVtZW50KSA9PiB7XG5cdFx0XHRuYW1lSW5wdXQudmFsdWUgPSBwcm9maWxlRWxlbWVudC5yb290Lm5hbWU7XG5cdFx0XHRuYW1lSW5wdXQudmFsaWRhdGUoKTtcblx0XHRcdGNvbnN0IGlzRGVmYXVsdFByb2ZpbGUgPSBwcm9maWxlRWxlbWVudC5yb290IGluc3RhbmNlb2YgVXNlckRhdGFQcm9maWxlRWxlbWVudCAmJiBwcm9maWxlRWxlbWVudC5yb290LnByb2ZpbGUuaXNEZWZhdWx0O1xuXHRcdFx0aWYgKHByb2ZpbGVFbGVtZW50LnJvb3QuZGlzYWJsZWQgfHwgaXNEZWZhdWx0UHJvZmlsZSkge1xuXHRcdFx0XHRuYW1lSW5wdXQuZGlzYWJsZSgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bmFtZUlucHV0LmVuYWJsZSgpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGlzRGVmYXVsdFByb2ZpbGUpIHtcblx0XHRcdFx0bmFtZUlucHV0LnNldFRvb2x0aXAobG9jYWxpemUoJ2RlZmF1bHRQcm9maWxlTmFtZScsIFwiTmFtZSBjYW5ub3QgYmUgY2hhbmdlZCBmb3IgdGhlIGRlZmF1bHQgcHJvZmlsZVwiKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRuYW1lSW5wdXQuc2V0VG9vbHRpcChsb2NhbGl6ZSgncHJvZmlsZU5hbWUnLCBcIlByb2ZpbGUgTmFtZVwiKSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRzZXQgZWxlbWVudChlbGVtZW50OiBQcm9maWxlVHJlZUVsZW1lbnQpIHtcblx0XHRcdFx0cHJvZmlsZUVsZW1lbnQgPSBlbGVtZW50O1xuXHRcdFx0XHRyZW5kZXJOYW1lKHByb2ZpbGVFbGVtZW50KTtcblx0XHRcdFx0ZWxlbWVudERpc3Bvc2FibGVzLmFkZChwcm9maWxlRWxlbWVudC5yb290Lm9uRGlkQ2hhbmdlKGUgPT4ge1xuXHRcdFx0XHRcdGlmIChlLm5hbWUgfHwgZS5kaXNhYmxlZCkge1xuXHRcdFx0XHRcdFx0cmVuZGVyTmFtZShlbGVtZW50KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGUucHJvZmlsZSkge1xuXHRcdFx0XHRcdFx0bmFtZUlucHV0LnZhbGlkYXRlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KSk7XG5cdFx0XHR9LFxuXHRcdFx0ZGlzcG9zYWJsZXMsXG5cdFx0XHRlbGVtZW50RGlzcG9zYWJsZXNcblx0XHR9O1xuXHR9XG5cbn1cblxuY2xhc3MgUHJvZmlsZUljb25SZW5kZXJlciBleHRlbmRzIFByb2ZpbGVQcm9wZXJ0eVJlbmRlcmVyIHtcblxuXHRyZWFkb25seSB0ZW1wbGF0ZUlkOiBQcm9maWxlUHJvcGVydHkgPSAnaWNvbic7XG5cdHByaXZhdGUgcmVhZG9ubHkgaG92ZXJEZWxlZ2F0ZTogSUhvdmVyRGVsZWdhdGU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5ob3ZlckRlbGVnYXRlID0gZ2V0RGVmYXVsdEhvdmVyRGVsZWdhdGUoJ2VsZW1lbnQnKTtcblx0fVxuXG5cdHJlbmRlclRlbXBsYXRlKHBhcmVudDogSFRNTEVsZW1lbnQpOiBJUHJvZmlsZVByb3BlcnR5UmVuZGVyZXJUZW1wbGF0ZSB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgZWxlbWVudERpc3Bvc2FibGVzID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cdFx0bGV0IHByb2ZpbGVFbGVtZW50OiBQcm9maWxlVHJlZUVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBpY29uQ29udGFpbmVyID0gYXBwZW5kKHBhcmVudCwgJCgnLnByb2ZpbGUtcm93LWNvbnRhaW5lcicpKTtcblx0XHRhcHBlbmQoaWNvbkNvbnRhaW5lciwgJCgnLnByb2ZpbGUtbGFiZWwtZWxlbWVudCcsIHVuZGVmaW5lZCwgbG9jYWxpemUoJ2ljb24tbGFiZWwnLCBcIkljb25cIikpKTtcblx0XHRjb25zdCBpY29uVmFsdWVDb250YWluZXIgPSBhcHBlbmQoaWNvbkNvbnRhaW5lciwgJCgnLnByb2ZpbGUtaWNvbi1jb250YWluZXInKSk7XG5cdFx0Y29uc3QgaWNvbkVsZW1lbnQgPSBhcHBlbmQoaWNvblZhbHVlQ29udGFpbmVyLCAkKGAke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKERFRkFVTFRfSUNPTil9YCwgeyAndGFiaW5kZXgnOiAnMCcsICdyb2xlJzogJ2J1dHRvbicsICdhcmlhLWxhYmVsJzogbG9jYWxpemUoJ2ljb24nLCBcIlByb2ZpbGUgSWNvblwiKSB9KSk7XG5cdFx0Y29uc3QgaWNvbkhvdmVyID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKHRoaXMuaG92ZXJEZWxlZ2F0ZSwgaWNvbkVsZW1lbnQsICcnKSk7XG5cblx0XHRjb25zdCBpY29uU2VsZWN0Qm94ID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya2JlbmNoSWNvblNlbGVjdEJveCwgeyBpY29uczogSUNPTlMsIGlucHV0Qm94U3R5bGVzOiBkZWZhdWx0SW5wdXRCb3hTdHlsZXMgfSkpO1xuXHRcdGxldCBob3ZlcldpZGdldDogSUhvdmVyV2lkZ2V0IHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHNob3dJY29uU2VsZWN0Qm94ID0gKCkgPT4ge1xuXHRcdFx0aWYgKHByb2ZpbGVFbGVtZW50Py5yb290IGluc3RhbmNlb2YgVXNlckRhdGFQcm9maWxlRWxlbWVudCAmJiBwcm9maWxlRWxlbWVudC5yb290LnByb2ZpbGUuaXNEZWZhdWx0KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChwcm9maWxlRWxlbWVudD8ucm9vdC5kaXNhYmxlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAocHJvZmlsZUVsZW1lbnQ/LnJvb3QgaW5zdGFuY2VvZiBVc2VyRGF0YVByb2ZpbGVFbGVtZW50ICYmIHByb2ZpbGVFbGVtZW50LnJvb3QucHJvZmlsZS5pc0RlZmF1bHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWNvblNlbGVjdEJveC5jbGVhcklucHV0KCk7XG5cdFx0XHRob3ZlcldpZGdldCA9IHRoaXMuaG92ZXJTZXJ2aWNlLnNob3dJbnN0YW50SG92ZXIoe1xuXHRcdFx0XHRjb250ZW50OiBpY29uU2VsZWN0Qm94LmRvbU5vZGUsXG5cdFx0XHRcdHRhcmdldDogaWNvbkVsZW1lbnQsXG5cdFx0XHRcdHBvc2l0aW9uOiB7XG5cdFx0XHRcdFx0aG92ZXJQb3NpdGlvbjogSG92ZXJQb3NpdGlvbi5CRUxPVyxcblx0XHRcdFx0fSxcblx0XHRcdFx0cGVyc2lzdGVuY2U6IHtcblx0XHRcdFx0XHRzdGlja3k6IHRydWUsXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGFwcGVhcmFuY2U6IHtcblx0XHRcdFx0XHRzaG93UG9pbnRlcjogdHJ1ZSxcblx0XHRcdFx0fSxcblx0XHRcdH0sIHRydWUpO1xuXG5cdFx0XHRpZiAoaG92ZXJXaWRnZXQpIHtcblx0XHRcdFx0aWNvblNlbGVjdEJveC5sYXlvdXQobmV3IERpbWVuc2lvbig0ODYsIDI5MikpO1xuXHRcdFx0XHRpY29uU2VsZWN0Qm94LmZvY3VzKCk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGljb25FbGVtZW50LCBFdmVudFR5cGUuQ0xJQ0ssIChlOiBNb3VzZUV2ZW50KSA9PiB7XG5cdFx0XHRFdmVudEhlbHBlci5zdG9wKGUsIHRydWUpO1xuXHRcdFx0c2hvd0ljb25TZWxlY3RCb3goKTtcblx0XHR9KSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcihpY29uRWxlbWVudCwgRXZlbnRUeXBlLktFWV9ET1dOLCBlID0+IHtcblx0XHRcdGNvbnN0IGV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblx0XHRcdGlmIChldmVudC5lcXVhbHMoS2V5Q29kZS5FbnRlcikgfHwgZXZlbnQuZXF1YWxzKEtleUNvZGUuU3BhY2UpKSB7XG5cdFx0XHRcdEV2ZW50SGVscGVyLnN0b3AoZXZlbnQsIHRydWUpO1xuXHRcdFx0XHRzaG93SWNvblNlbGVjdEJveCgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGljb25TZWxlY3RCb3guZG9tTm9kZSwgRXZlbnRUeXBlLktFWV9ET1dOLCBlID0+IHtcblx0XHRcdGNvbnN0IGV2ZW50ID0gbmV3IFN0YW5kYXJkS2V5Ym9hcmRFdmVudChlKTtcblx0XHRcdGlmIChldmVudC5lcXVhbHMoS2V5Q29kZS5Fc2NhcGUpKSB7XG5cdFx0XHRcdEV2ZW50SGVscGVyLnN0b3AoZXZlbnQsIHRydWUpO1xuXHRcdFx0XHRob3ZlcldpZGdldD8uZGlzcG9zZSgpO1xuXHRcdFx0XHRpY29uRWxlbWVudC5mb2N1cygpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoaWNvblNlbGVjdEJveC5vbkRpZFNlbGVjdChzZWxlY3RlZEljb24gPT4ge1xuXHRcdFx0aG92ZXJXaWRnZXQ/LmRpc3Bvc2UoKTtcblx0XHRcdGljb25FbGVtZW50LmZvY3VzKCk7XG5cdFx0XHRpZiAocHJvZmlsZUVsZW1lbnQpIHtcblx0XHRcdFx0cHJvZmlsZUVsZW1lbnQucm9vdC5pY29uID0gc2VsZWN0ZWRJY29uLmlkO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGFwcGVuZChpY29uVmFsdWVDb250YWluZXIsICQoJy5wcm9maWxlLWRlc2NyaXB0aW9uLWVsZW1lbnQnLCB1bmRlZmluZWQsIGxvY2FsaXplKCdpY29uLWRlc2NyaXB0aW9uJywgXCJQcm9maWxlIGljb24gdG8gYmUgc2hvd24gaW4gdGhlIGFjdGl2aXR5IGJhclwiKSkpO1xuXG5cdFx0Y29uc3QgcmVuZGVySWNvbiA9IChwcm9maWxlRWxlbWVudDogUHJvZmlsZVRyZWVFbGVtZW50KSA9PiB7XG5cdFx0XHRpZiAocHJvZmlsZUVsZW1lbnQ/LnJvb3QgaW5zdGFuY2VvZiBVc2VyRGF0YVByb2ZpbGVFbGVtZW50ICYmIHByb2ZpbGVFbGVtZW50LnJvb3QucHJvZmlsZS5pc0RlZmF1bHQpIHtcblx0XHRcdFx0aWNvblZhbHVlQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2Rpc2FibGVkJyk7XG5cdFx0XHRcdGljb25Ib3Zlci51cGRhdGUobG9jYWxpemUoJ2RlZmF1bHRQcm9maWxlSWNvbicsIFwiSWNvbiBjYW5ub3QgYmUgY2hhbmdlZCBmb3IgdGhlIGRlZmF1bHQgcHJvZmlsZVwiKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpY29uSG92ZXIudXBkYXRlKGxvY2FsaXplKCdjaGFuZ2VJY29uJywgXCJDbGljayB0byBjaGFuZ2UgaWNvblwiKSk7XG5cdFx0XHRcdGljb25WYWx1ZUNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdkaXNhYmxlZCcpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHByb2ZpbGVFbGVtZW50LnJvb3QuaWNvbikge1xuXHRcdFx0XHRpY29uRWxlbWVudC5jbGFzc05hbWUgPSBUaGVtZUljb24uYXNDbGFzc05hbWUoVGhlbWVJY29uLmZyb21JZChwcm9maWxlRWxlbWVudC5yb290Lmljb24pKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGljb25FbGVtZW50LmNsYXNzTmFtZSA9IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShUaGVtZUljb24uZnJvbUlkKERFRkFVTFRfSUNPTi5pZCkpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0c2V0IGVsZW1lbnQoZWxlbWVudDogUHJvZmlsZVRyZWVFbGVtZW50KSB7XG5cdFx0XHRcdHByb2ZpbGVFbGVtZW50ID0gZWxlbWVudDtcblx0XHRcdFx0cmVuZGVySWNvbihwcm9maWxlRWxlbWVudCk7XG5cdFx0XHRcdGVsZW1lbnREaXNwb3NhYmxlcy5hZGQocHJvZmlsZUVsZW1lbnQucm9vdC5vbkRpZENoYW5nZShlID0+IHtcblx0XHRcdFx0XHRpZiAoZS5pY29uKSB7XG5cdFx0XHRcdFx0XHRyZW5kZXJJY29uKGVsZW1lbnQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXHRcdFx0fSxcblx0XHRcdGRpc3Bvc2FibGVzLFxuXHRcdFx0ZWxlbWVudERpc3Bvc2FibGVzXG5cdFx0fTtcblx0fVxufVxuXG5jbGFzcyBVc2VGb3JDdXJyZW50V2luZG93UHJvcGVydHlSZW5kZXJlciBleHRlbmRzIFByb2ZpbGVQcm9wZXJ0eVJlbmRlcmVyIHtcblxuXHRyZWFkb25seSB0ZW1wbGF0ZUlkOiBQcm9maWxlUHJvcGVydHkgPSAndXNlRm9yQ3VycmVudCc7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXNlckRhdGFQcm9maWxlU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShwYXJlbnQ6IEhUTUxFbGVtZW50KTogSVByb2ZpbGVQcm9wZXJ0eVJlbmRlcmVyVGVtcGxhdGUge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGVsZW1lbnREaXNwb3NhYmxlcyA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRcdGxldCBwcm9maWxlRWxlbWVudDogUHJvZmlsZVRyZWVFbGVtZW50IHwgdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgdXNlRm9yQ3VycmVudFdpbmRvd0NvbnRhaW5lciA9IGFwcGVuZChwYXJlbnQsICQoJy5wcm9maWxlLXJvdy1jb250YWluZXInKSk7XG5cdFx0YXBwZW5kKHVzZUZvckN1cnJlbnRXaW5kb3dDb250YWluZXIsICQoJy5wcm9maWxlLWxhYmVsLWVsZW1lbnQnLCB1bmRlZmluZWQsIGxvY2FsaXplKCd1c2UgZm9yIGN1cnJlbiB3aW5kb3cnLCBcIlVzZSBmb3IgQ3VycmVudCBXaW5kb3dcIikpKTtcblx0XHRjb25zdCB1c2VGb3JDdXJyZW50V2luZG93VmFsdWVDb250YWluZXIgPSBhcHBlbmQodXNlRm9yQ3VycmVudFdpbmRvd0NvbnRhaW5lciwgJCgnLnByb2ZpbGUtdXNlLWZvci1jdXJyZW50LWNvbnRhaW5lcicpKTtcblx0XHRjb25zdCB1c2VGb3JDdXJyZW50V2luZG93VGl0bGUgPSBsb2NhbGl6ZSgnZW5hYmxlIGZvciBjdXJyZW50IHdpbmRvdycsIFwiVXNlIHRoaXMgcHJvZmlsZSBmb3IgdGhlIGN1cnJlbnQgd2luZG93XCIpO1xuXHRcdGNvbnN0IHVzZUZvckN1cnJlbnRXaW5kb3dDaGVja2JveCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQ2hlY2tib3godXNlRm9yQ3VycmVudFdpbmRvd1RpdGxlLCBmYWxzZSwgZGVmYXVsdENoZWNrYm94U3R5bGVzKSk7XG5cdFx0YXBwZW5kKHVzZUZvckN1cnJlbnRXaW5kb3dWYWx1ZUNvbnRhaW5lciwgdXNlRm9yQ3VycmVudFdpbmRvd0NoZWNrYm94LmRvbU5vZGUpO1xuXHRcdGNvbnN0IHVzZUZvckN1cnJlbnRXaW5kb3dMYWJlbCA9IGFwcGVuZCh1c2VGb3JDdXJyZW50V2luZG93VmFsdWVDb250YWluZXIsICQoJy5wcm9maWxlLWRlc2NyaXB0aW9uLWVsZW1lbnQnLCB1bmRlZmluZWQsIHVzZUZvckN1cnJlbnRXaW5kb3dUaXRsZSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh1c2VGb3JDdXJyZW50V2luZG93Q2hlY2tib3gub25DaGFuZ2UoKCkgPT4ge1xuXHRcdFx0aWYgKHByb2ZpbGVFbGVtZW50Py5yb290IGluc3RhbmNlb2YgVXNlckRhdGFQcm9maWxlRWxlbWVudCkge1xuXHRcdFx0XHRwcm9maWxlRWxlbWVudC5yb290LnRvZ2dsZUN1cnJlbnRXaW5kb3dQcm9maWxlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChhZGREaXNwb3NhYmxlTGlzdGVuZXIodXNlRm9yQ3VycmVudFdpbmRvd0xhYmVsLCBFdmVudFR5cGUuQ0xJQ0ssICgpID0+IHtcblx0XHRcdGlmIChwcm9maWxlRWxlbWVudD8ucm9vdCBpbnN0YW5jZW9mIFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQpIHtcblx0XHRcdFx0cHJvZmlsZUVsZW1lbnQucm9vdC50b2dnbGVDdXJyZW50V2luZG93UHJvZmlsZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHJlbmRlclVzZUN1cnJlbnRQcm9maWxlID0gKHByb2ZpbGVFbGVtZW50OiBQcm9maWxlVHJlZUVsZW1lbnQpID0+IHtcblx0XHRcdHVzZUZvckN1cnJlbnRXaW5kb3dDaGVja2JveC5jaGVja2VkID0gcHJvZmlsZUVsZW1lbnQucm9vdCBpbnN0YW5jZW9mIFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQgJiYgdGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLmlkID09PSBwcm9maWxlRWxlbWVudC5yb290LnByb2ZpbGUuaWQ7XG5cdFx0XHRpZiAodXNlRm9yQ3VycmVudFdpbmRvd0NoZWNrYm94LmNoZWNrZWQgJiYgdGhpcy51c2VyRGF0YVByb2ZpbGVTZXJ2aWNlLmN1cnJlbnRQcm9maWxlLmlzRGVmYXVsdCkge1xuXHRcdFx0XHR1c2VGb3JDdXJyZW50V2luZG93Q2hlY2tib3guZGlzYWJsZSgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dXNlRm9yQ3VycmVudFdpbmRvd0NoZWNrYm94LmVuYWJsZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRyZXR1cm4ge1xuXHRcdFx0c2V0IGVsZW1lbnQoZWxlbWVudDogUHJvZmlsZVRyZWVFbGVtZW50KSB7XG5cdFx0XHRcdHByb2ZpbGVFbGVtZW50ID0gZWxlbWVudDtcblx0XHRcdFx0cmVuZGVyVXNlQ3VycmVudFByb2ZpbGUocHJvZmlsZUVsZW1lbnQpO1xuXHRcdFx0XHRlbGVtZW50RGlzcG9zYWJsZXMuYWRkKHRoYXQudXNlckRhdGFQcm9maWxlU2VydmljZS5vbkRpZENoYW5nZUN1cnJlbnRQcm9maWxlKGUgPT4ge1xuXHRcdFx0XHRcdHJlbmRlclVzZUN1cnJlbnRQcm9maWxlKGVsZW1lbnQpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHR9LFxuXHRcdFx0ZGlzcG9zYWJsZXMsXG5cdFx0XHRlbGVtZW50RGlzcG9zYWJsZXNcblx0XHR9O1xuXHR9XG59XG5cbmNsYXNzIFVzZUFzRGVmYXVsdFByb2ZpbGVSZW5kZXJlciBleHRlbmRzIFByb2ZpbGVQcm9wZXJ0eVJlbmRlcmVyIHtcblxuXHRyZWFkb25seSB0ZW1wbGF0ZUlkOiBQcm9maWxlUHJvcGVydHkgPSAndXNlQXNEZWZhdWx0JztcblxuXHRyZW5kZXJUZW1wbGF0ZShwYXJlbnQ6IEhUTUxFbGVtZW50KTogSVByb2ZpbGVQcm9wZXJ0eVJlbmRlcmVyVGVtcGxhdGUge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGVsZW1lbnREaXNwb3NhYmxlcyA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRcdGxldCBwcm9maWxlRWxlbWVudDogUHJvZmlsZVRyZWVFbGVtZW50IHwgdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgdXNlQXNEZWZhdWx0UHJvZmlsZUNvbnRhaW5lciA9IGFwcGVuZChwYXJlbnQsICQoJy5wcm9maWxlLXJvdy1jb250YWluZXInKSk7XG5cdFx0YXBwZW5kKHVzZUFzRGVmYXVsdFByb2ZpbGVDb250YWluZXIsICQoJy5wcm9maWxlLWxhYmVsLWVsZW1lbnQnLCB1bmRlZmluZWQsIGxvY2FsaXplKCd1c2UgZm9yIG5ldyB3aW5kb3dzJywgXCJVc2UgZm9yIE5ldyBXaW5kb3dzXCIpKSk7XG5cdFx0Y29uc3QgdXNlQXNEZWZhdWx0UHJvZmlsZVZhbHVlQ29udGFpbmVyID0gYXBwZW5kKHVzZUFzRGVmYXVsdFByb2ZpbGVDb250YWluZXIsICQoJy5wcm9maWxlLXVzZS1hcy1kZWZhdWx0LWNvbnRhaW5lcicpKTtcblx0XHRjb25zdCB1c2VBc0RlZmF1bHRQcm9maWxlVGl0bGUgPSBsb2NhbGl6ZSgnZW5hYmxlIGZvciBuZXcgd2luZG93cycsIFwiVXNlIHRoaXMgcHJvZmlsZSBhcyB0aGUgZGVmYXVsdCBmb3IgbmV3IHdpbmRvd3NcIik7XG5cdFx0Y29uc3QgdXNlQXNEZWZhdWx0UHJvZmlsZUNoZWNrYm94ID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBDaGVja2JveCh1c2VBc0RlZmF1bHRQcm9maWxlVGl0bGUsIGZhbHNlLCBkZWZhdWx0Q2hlY2tib3hTdHlsZXMpKTtcblx0XHRhcHBlbmQodXNlQXNEZWZhdWx0UHJvZmlsZVZhbHVlQ29udGFpbmVyLCB1c2VBc0RlZmF1bHRQcm9maWxlQ2hlY2tib3guZG9tTm9kZSk7XG5cdFx0Y29uc3QgdXNlQXNEZWZhdWx0UHJvZmlsZUxhYmVsID0gYXBwZW5kKHVzZUFzRGVmYXVsdFByb2ZpbGVWYWx1ZUNvbnRhaW5lciwgJCgnLnByb2ZpbGUtZGVzY3JpcHRpb24tZWxlbWVudCcsIHVuZGVmaW5lZCwgdXNlQXNEZWZhdWx0UHJvZmlsZVRpdGxlKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHVzZUFzRGVmYXVsdFByb2ZpbGVDaGVja2JveC5vbkNoYW5nZSgoKSA9PiB7XG5cdFx0XHRpZiAocHJvZmlsZUVsZW1lbnQ/LnJvb3QgaW5zdGFuY2VvZiBVc2VyRGF0YVByb2ZpbGVFbGVtZW50KSB7XG5cdFx0XHRcdHByb2ZpbGVFbGVtZW50LnJvb3QudG9nZ2xlTmV3V2luZG93UHJvZmlsZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHVzZUFzRGVmYXVsdFByb2ZpbGVMYWJlbCwgRXZlbnRUeXBlLkNMSUNLLCAoKSA9PiB7XG5cdFx0XHRpZiAocHJvZmlsZUVsZW1lbnQ/LnJvb3QgaW5zdGFuY2VvZiBVc2VyRGF0YVByb2ZpbGVFbGVtZW50KSB7XG5cdFx0XHRcdHByb2ZpbGVFbGVtZW50LnJvb3QudG9nZ2xlTmV3V2luZG93UHJvZmlsZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHJlbmRlclVzZUFzRGVmYXVsdCA9IChwcm9maWxlRWxlbWVudDogUHJvZmlsZVRyZWVFbGVtZW50KSA9PiB7XG5cdFx0XHR1c2VBc0RlZmF1bHRQcm9maWxlQ2hlY2tib3guY2hlY2tlZCA9IHByb2ZpbGVFbGVtZW50LnJvb3QgaW5zdGFuY2VvZiBVc2VyRGF0YVByb2ZpbGVFbGVtZW50ICYmIHByb2ZpbGVFbGVtZW50LnJvb3QuaXNOZXdXaW5kb3dQcm9maWxlO1xuXHRcdH07XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0c2V0IGVsZW1lbnQoZWxlbWVudDogUHJvZmlsZVRyZWVFbGVtZW50KSB7XG5cdFx0XHRcdHByb2ZpbGVFbGVtZW50ID0gZWxlbWVudDtcblx0XHRcdFx0cmVuZGVyVXNlQXNEZWZhdWx0KHByb2ZpbGVFbGVtZW50KTtcblx0XHRcdFx0ZWxlbWVudERpc3Bvc2FibGVzLmFkZChwcm9maWxlRWxlbWVudC5yb290Lm9uRGlkQ2hhbmdlKGUgPT4ge1xuXHRcdFx0XHRcdGlmIChlLm5ld1dpbmRvd1Byb2ZpbGUpIHtcblx0XHRcdFx0XHRcdHJlbmRlclVzZUFzRGVmYXVsdChlbGVtZW50KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NhYmxlcyxcblx0XHRcdGVsZW1lbnREaXNwb3NhYmxlc1xuXHRcdH07XG5cdH1cbn1cblxuY2xhc3MgQ29weUZyb21Qcm9maWxlUmVuZGVyZXIgZXh0ZW5kcyBQcm9maWxlUHJvcGVydHlSZW5kZXJlciB7XG5cblx0cmVhZG9ubHkgdGVtcGxhdGVJZDogUHJvZmlsZVByb3BlcnR5ID0gJ2NvcHlGcm9tJztcblxuXHRwcml2YXRlIHRlbXBsYXRlczogcmVhZG9ubHkgSVByb2ZpbGVUZW1wbGF0ZUluZm9bXSA9IFtdO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVzU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dFZpZXdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dFZpZXdTZXJ2aWNlOiBJQ29udGV4dFZpZXdTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUocGFyZW50OiBIVE1MRWxlbWVudCk6IElQcm9maWxlUHJvcGVydHlSZW5kZXJlclRlbXBsYXRlIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBlbGVtZW50RGlzcG9zYWJsZXMgPSBkaXNwb3NhYmxlcy5hZGQobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0XHRsZXQgcHJvZmlsZUVsZW1lbnQ6IFByb2ZpbGVUcmVlRWxlbWVudCB8IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IGNvcHlGcm9tQ29udGFpbmVyID0gYXBwZW5kKHBhcmVudCwgJCgnLnByb2ZpbGUtcm93LWNvbnRhaW5lci5wcm9maWxlLWNvcHktZnJvbS1jb250YWluZXInKSk7XG5cdFx0YXBwZW5kKGNvcHlGcm9tQ29udGFpbmVyLCAkKCcucHJvZmlsZS1sYWJlbC1lbGVtZW50JywgdW5kZWZpbmVkLCBsb2NhbGl6ZSgnY3JlYXRlIGZyb20nLCBcIkNvcHkgZnJvbVwiKSkpO1xuXHRcdGFwcGVuZChjb3B5RnJvbUNvbnRhaW5lciwgJCgnLnByb2ZpbGUtZGVzY3JpcHRpb24tZWxlbWVudCcsIHVuZGVmaW5lZCwgbG9jYWxpemUoJ2NvcHkgZnJvbSBkZXNjcmlwdGlvbicsIFwiU2VsZWN0IHRoZSBwcm9maWxlIHNvdXJjZSBmcm9tIHdoaWNoIHlvdSB3YW50IHRvIGNvcHkgY29udGVudHNcIikpKTtcblx0XHRjb25zdCBjb3B5RnJvbVNlbGVjdEJveCA9IGRpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNlbGVjdEJveCxcblx0XHRcdFtdLFxuXHRcdFx0MCxcblx0XHRcdHRoaXMuY29udGV4dFZpZXdTZXJ2aWNlLFxuXHRcdFx0ZGVmYXVsdFNlbGVjdEJveFN0eWxlcyxcblx0XHRcdHtcblx0XHRcdFx0dXNlQ3VzdG9tRHJhd246IHRydWUsXG5cdFx0XHRcdGFyaWFMYWJlbDogbG9jYWxpemUoJ2NvcHkgcHJvZmlsZSBmcm9tJywgXCJDb3B5IHByb2ZpbGUgZnJvbVwiKSxcblx0XHRcdH1cblx0XHQpKTtcblx0XHRjb3B5RnJvbVNlbGVjdEJveC5yZW5kZXIoYXBwZW5kKGNvcHlGcm9tQ29udGFpbmVyLCAkKCcucHJvZmlsZS1zZWxlY3QtY29udGFpbmVyJykpKTtcblxuXHRcdGNvbnN0IHJlbmRlciA9IChwcm9maWxlRWxlbWVudDogTmV3UHJvZmlsZUVsZW1lbnQsIGNvcHlGcm9tT3B0aW9uczogKElTZWxlY3RPcHRpb25JdGVtICYgeyBpZD86IHN0cmluZzsgc291cmNlPzogSVVzZXJEYXRhUHJvZmlsZSB8IFVSSSB9KVtdKSA9PiB7XG5cdFx0XHRjb3B5RnJvbVNlbGVjdEJveC5zZXRPcHRpb25zKGNvcHlGcm9tT3B0aW9ucyk7XG5cdFx0XHRjb25zdCBpZCA9IHByb2ZpbGVFbGVtZW50LmNvcHlGcm9tIGluc3RhbmNlb2YgVVJJID8gcHJvZmlsZUVsZW1lbnQuY29weUZyb20udG9TdHJpbmcoKSA6IHByb2ZpbGVFbGVtZW50LmNvcHlGcm9tPy5pZDtcblx0XHRcdGNvbnN0IGluZGV4ID0gaWRcblx0XHRcdFx0PyBjb3B5RnJvbU9wdGlvbnMuZmluZEluZGV4KG9wdGlvbiA9PiBvcHRpb24uaWQgPT09IGlkKVxuXHRcdFx0XHQ6IDA7XG5cdFx0XHRjb3B5RnJvbVNlbGVjdEJveC5zZWxlY3QoaW5kZXgpO1xuXHRcdH07XG5cblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRyZXR1cm4ge1xuXHRcdFx0c2V0IGVsZW1lbnQoZWxlbWVudDogUHJvZmlsZVRyZWVFbGVtZW50KSB7XG5cdFx0XHRcdHByb2ZpbGVFbGVtZW50ID0gZWxlbWVudDtcblx0XHRcdFx0aWYgKHByb2ZpbGVFbGVtZW50LnJvb3QgaW5zdGFuY2VvZiBOZXdQcm9maWxlRWxlbWVudCkge1xuXHRcdFx0XHRcdGNvbnN0IG5ld1Byb2ZpbGVFbGVtZW50ID0gcHJvZmlsZUVsZW1lbnQucm9vdDtcblx0XHRcdFx0XHRsZXQgY29weUZyb21PcHRpb25zID0gdGhhdC5nZXRDb3B5RnJvbU9wdGlvbnMobmV3UHJvZmlsZUVsZW1lbnQpO1xuXHRcdFx0XHRcdHJlbmRlcihuZXdQcm9maWxlRWxlbWVudCwgY29weUZyb21PcHRpb25zKTtcblx0XHRcdFx0XHRjb3B5RnJvbVNlbGVjdEJveC5zZXRFbmFibGVkKCFuZXdQcm9maWxlRWxlbWVudC5wcmV2aWV3UHJvZmlsZSAmJiAhbmV3UHJvZmlsZUVsZW1lbnQuZGlzYWJsZWQpO1xuXHRcdFx0XHRcdGVsZW1lbnREaXNwb3NhYmxlcy5hZGQocHJvZmlsZUVsZW1lbnQucm9vdC5vbkRpZENoYW5nZShlID0+IHtcblx0XHRcdFx0XHRcdGlmIChlLmNvcHlGcm9tIHx8IGUuY29weUZyb21JbmZvKSB7XG5cdFx0XHRcdFx0XHRcdGNvcHlGcm9tT3B0aW9ucyA9IHRoYXQuZ2V0Q29weUZyb21PcHRpb25zKG5ld1Byb2ZpbGVFbGVtZW50KTtcblx0XHRcdFx0XHRcdFx0cmVuZGVyKG5ld1Byb2ZpbGVFbGVtZW50LCBjb3B5RnJvbU9wdGlvbnMpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKGUucHJldmlldyB8fCBlLmRpc2FibGVkKSB7XG5cdFx0XHRcdFx0XHRcdGNvcHlGcm9tU2VsZWN0Qm94LnNldEVuYWJsZWQoIW5ld1Byb2ZpbGVFbGVtZW50LnByZXZpZXdQcm9maWxlICYmICFuZXdQcm9maWxlRWxlbWVudC5kaXNhYmxlZCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSkpO1xuXHRcdFx0XHRcdGVsZW1lbnREaXNwb3NhYmxlcy5hZGQoY29weUZyb21TZWxlY3RCb3gub25EaWRTZWxlY3Qob3B0aW9uID0+IHtcblx0XHRcdFx0XHRcdG5ld1Byb2ZpbGVFbGVtZW50LmNvcHlGcm9tID0gY29weUZyb21PcHRpb25zW29wdGlvbi5pbmRleF0uc291cmNlO1xuXHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGRpc3Bvc2FibGVzLFxuXHRcdFx0ZWxlbWVudERpc3Bvc2FibGVzXG5cdFx0fTtcblx0fVxuXG5cdHNldFRlbXBsYXRlcyh0ZW1wbGF0ZXM6IHJlYWRvbmx5IElQcm9maWxlVGVtcGxhdGVJbmZvW10pOiB2b2lkIHtcblx0XHR0aGlzLnRlbXBsYXRlcyA9IHRlbXBsYXRlcztcblx0fVxuXG5cdHByaXZhdGUgZ2V0Q29weUZyb21PcHRpb25zKHByb2ZpbGVFbGVtZW50OiBOZXdQcm9maWxlRWxlbWVudCk6IChJU2VsZWN0T3B0aW9uSXRlbSAmIHsgaWQ/OiBzdHJpbmc7IHNvdXJjZT86IElVc2VyRGF0YVByb2ZpbGUgfCBVUkkgfSlbXSB7XG5cdFx0Y29uc3Qgc2VwYXJhdG9yID0geyB0ZXh0OiAnXFx1MjUwMFxcdTI1MDBcXHUyNTAwXFx1MjUwMFxcdTI1MDBcXHUyNTAwJywgaXNEaXNhYmxlZDogdHJ1ZSB9O1xuXHRcdGNvbnN0IGNvcHlGcm9tT3B0aW9uczogKElTZWxlY3RPcHRpb25JdGVtICYgeyBpZD86IHN0cmluZzsgc291cmNlPzogSVVzZXJEYXRhUHJvZmlsZSB8IFVSSSB9KVtdID0gW107XG5cblx0XHRjb3B5RnJvbU9wdGlvbnMucHVzaCh7IHRleHQ6IGxvY2FsaXplKCdlbXB0eSBwcm9maWxlJywgXCJOb25lXCIpIH0pO1xuXHRcdGZvciAoY29uc3QgW2NvcHlGcm9tVGVtcGxhdGUsIG5hbWVdIG9mIHByb2ZpbGVFbGVtZW50LmNvcHlGcm9tVGVtcGxhdGVzKSB7XG5cdFx0XHRpZiAoIXRoaXMudGVtcGxhdGVzLnNvbWUodGVtcGxhdGUgPT4gdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoVVJJLnBhcnNlKHRlbXBsYXRlLnVybCksIGNvcHlGcm9tVGVtcGxhdGUpKSkge1xuXHRcdFx0XHRjb3B5RnJvbU9wdGlvbnMucHVzaCh7IHRleHQ6IGAke25hbWV9ICgke2Jhc2VuYW1lKGNvcHlGcm9tVGVtcGxhdGUpfSlgLCBpZDogY29weUZyb21UZW1wbGF0ZS50b1N0cmluZygpLCBzb3VyY2U6IGNvcHlGcm9tVGVtcGxhdGUgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMudGVtcGxhdGVzLmxlbmd0aCkge1xuXHRcdFx0Y29weUZyb21PcHRpb25zLnB1c2goeyAuLi5zZXBhcmF0b3IsIGRlY29yYXRvclJpZ2h0OiBsb2NhbGl6ZSgnZnJvbSB0ZW1wbGF0ZXMnLCBcIlByb2ZpbGUgVGVtcGxhdGVzXCIpIH0pO1xuXHRcdFx0Zm9yIChjb25zdCB0ZW1wbGF0ZSBvZiB0aGlzLnRlbXBsYXRlcykge1xuXHRcdFx0XHRjb3B5RnJvbU9wdGlvbnMucHVzaCh7IHRleHQ6IHRlbXBsYXRlLm5hbWUsIGlkOiB0ZW1wbGF0ZS51cmwsIHNvdXJjZTogVVJJLnBhcnNlKHRlbXBsYXRlLnVybCkgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGNvcHlGcm9tT3B0aW9ucy5wdXNoKHsgLi4uc2VwYXJhdG9yLCBkZWNvcmF0b3JSaWdodDogbG9jYWxpemUoJ2Zyb20gZXhpc3RpbmcgcHJvZmlsZXMnLCBcIkV4aXN0aW5nIFByb2ZpbGVzXCIpIH0pO1xuXHRcdGZvciAoY29uc3QgcHJvZmlsZSBvZiB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLnByb2ZpbGVzKSB7XG5cdFx0XHRpZiAoIXByb2ZpbGUuaXNUcmFuc2llbnQpIHtcblx0XHRcdFx0Y29weUZyb21PcHRpb25zLnB1c2goeyB0ZXh0OiBwcm9maWxlLm5hbWUsIGlkOiBwcm9maWxlLmlkLCBzb3VyY2U6IHByb2ZpbGUgfSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBjb3B5RnJvbU9wdGlvbnM7XG5cdH1cbn1cblxuY2xhc3MgQ29udGVudHNQcm9maWxlUmVuZGVyZXIgZXh0ZW5kcyBQcm9maWxlUHJvcGVydHlSZW5kZXJlciB7XG5cblx0cmVhZG9ubHkgdGVtcGxhdGVJZDogUHJvZmlsZVByb3BlcnR5ID0gJ2NvbnRlbnRzJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxQcm9maWxlVHJlZUVsZW1lbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQgPSB0aGlzLl9vbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VTZWxlY3Rpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGVsZW1lbnQ6IFByb2ZpbGVUcmVlRWxlbWVudDsgc2VsZWN0ZWQ6IGJvb2xlYW4gfT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlU2VsZWN0aW9uID0gdGhpcy5fb25EaWRDaGFuZ2VTZWxlY3Rpb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSBwcm9maWxlc0NvbnRlbnRUcmVlOiBXb3JrYmVuY2hBc3luY0RhdGFUcmVlPEFic3RyYWN0VXNlckRhdGFQcm9maWxlRWxlbWVudCwgUHJvZmlsZUNvbnRlbnRUcmVlRWxlbWVudD4gfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdFx0QElDb250ZXh0TWVudVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0TWVudVNlcnZpY2U6IElDb250ZXh0TWVudVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShwYXJlbnQ6IEhUTUxFbGVtZW50KTogSVByb2ZpbGVQcm9wZXJ0eVJlbmRlcmVyVGVtcGxhdGUge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGVsZW1lbnREaXNwb3NhYmxlcyA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRcdGxldCBwcm9maWxlRWxlbWVudDogUHJvZmlsZVRyZWVFbGVtZW50IHwgdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgY29uZmlndXJlUm93Q29udGFpbmVyID0gYXBwZW5kKHBhcmVudCwgJCgnLnByb2ZpbGUtcm93LWNvbnRhaW5lcicpKTtcblx0XHRhcHBlbmQoY29uZmlndXJlUm93Q29udGFpbmVyLCAkKCcucHJvZmlsZS1sYWJlbC1lbGVtZW50JywgdW5kZWZpbmVkLCBsb2NhbGl6ZSgnY29udGVudHMnLCBcIkNvbnRlbnRzXCIpKSk7XG5cdFx0Y29uc3QgY29udGVudHNEZXNjcmlwdGlvbkVsZW1lbnQgPSBhcHBlbmQoY29uZmlndXJlUm93Q29udGFpbmVyLCAkKCcucHJvZmlsZS1kZXNjcmlwdGlvbi1lbGVtZW50JykpO1xuXHRcdGNvbnN0IGNvbnRlbnRzVHJlZUhlYWRlciA9IGFwcGVuZChjb25maWd1cmVSb3dDb250YWluZXIsICQoJy5wcm9maWxlLWNvbnRlbnQtdHJlZS1oZWFkZXInKSk7XG5cdFx0Y29uc3Qgb3B0aW9uc0xhYmVsID0gJCgnLm9wdGlvbnMtaGVhZGVyJywgdW5kZWZpbmVkLCAkKCdzcGFuJywgdW5kZWZpbmVkLCBsb2NhbGl6ZSgnb3B0aW9ucycsIFwiU291cmNlXCIpKSk7XG5cdFx0YXBwZW5kKGNvbnRlbnRzVHJlZUhlYWRlcixcblx0XHRcdCQoJycpLFxuXHRcdFx0JCgnJywgdW5kZWZpbmVkLCBsb2NhbGl6ZSgnY29udGVudHMnLCBcIkNvbnRlbnRzXCIpKSxcblx0XHRcdG9wdGlvbnNMYWJlbCxcblx0XHRcdCQoJycpLFxuXHRcdCk7XG5cblx0XHRjb25zdCBkZWxlZ2F0ZSA9IG5ldyBQcm9maWxlQ29udGVudFRyZWVFbGVtZW50RGVsZWdhdGUoKTtcblx0XHRjb25zdCBwcm9maWxlc0NvbnRlbnRUcmVlID0gdGhpcy5wcm9maWxlc0NvbnRlbnRUcmVlID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya2JlbmNoQXN5bmNEYXRhVHJlZTxBYnN0cmFjdFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQsIFByb2ZpbGVDb250ZW50VHJlZUVsZW1lbnQ+LFxuXHRcdFx0J1Byb2ZpbGVFZGl0b3ItQ29udGVudHNUcmVlJyxcblx0XHRcdGFwcGVuZChjb25maWd1cmVSb3dDb250YWluZXIsICQoJy5wcm9maWxlLWNvbnRlbnQtdHJlZS5maWxlLWljb24tdGhlbWFibGUtdHJlZS5zaG93LWZpbGUtaWNvbnMnKSksXG5cdFx0XHRkZWxlZ2F0ZSxcblx0XHRcdFtcblx0XHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFeGlzdGluZ1Byb2ZpbGVSZXNvdXJjZVRyZWVSZW5kZXJlciksXG5cdFx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTmV3UHJvZmlsZVJlc291cmNlVHJlZVJlbmRlcmVyKSxcblx0XHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShQcm9maWxlUmVzb3VyY2VDaGlsZFRyZWVJdGVtUmVuZGVyZXIpLFxuXHRcdFx0XSxcblx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUHJvZmlsZVJlc291cmNlVHJlZURhdGFTb3VyY2UpLFxuXHRcdFx0e1xuXHRcdFx0XHRtdWx0aXBsZVNlbGVjdGlvblN1cHBvcnQ6IGZhbHNlLFxuXHRcdFx0XHRob3Jpem9udGFsU2Nyb2xsaW5nOiBmYWxzZSxcblx0XHRcdFx0YWNjZXNzaWJpbGl0eVByb3ZpZGVyOiB7XG5cdFx0XHRcdFx0Z2V0QXJpYUxhYmVsKGVsZW1lbnQ6IFByb2ZpbGVDb250ZW50VHJlZUVsZW1lbnQgfCBudWxsKTogc3RyaW5nIHtcblx0XHRcdFx0XHRcdGlmICgoPElQcm9maWxlUmVzb3VyY2VUeXBlRWxlbWVudD5lbGVtZW50Py5lbGVtZW50KS5yZXNvdXJjZVR5cGUpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuICg8SVByb2ZpbGVSZXNvdXJjZVR5cGVFbGVtZW50PmVsZW1lbnQ/LmVsZW1lbnQpLnJlc291cmNlVHlwZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGlmICgoPElQcm9maWxlUmVzb3VyY2VUeXBlQ2hpbGRFbGVtZW50PmVsZW1lbnQ/LmVsZW1lbnQpLmxhYmVsKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiAoPElQcm9maWxlUmVzb3VyY2VUeXBlQ2hpbGRFbGVtZW50PmVsZW1lbnQ/LmVsZW1lbnQpLmxhYmVsO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuICcnO1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Z2V0V2lkZ2V0QXJpYUxhYmVsKCk6IHN0cmluZyB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gJyc7XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSxcblx0XHRcdFx0aWRlbnRpdHlQcm92aWRlcjoge1xuXHRcdFx0XHRcdGdldElkKGVsZW1lbnQpIHtcblx0XHRcdFx0XHRcdGlmIChlbGVtZW50Py5lbGVtZW50LmhhbmRsZSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZWxlbWVudC5lbGVtZW50LmhhbmRsZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiAnJztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGV4cGFuZE9ubHlPblR3aXN0aWVDbGljazogdHJ1ZSxcblx0XHRcdFx0cmVuZGVySW5kZW50R3VpZGVzOiBSZW5kZXJJbmRlbnRHdWlkZXMuTm9uZSxcblx0XHRcdFx0ZW5hYmxlU3RpY2t5U2Nyb2xsOiBmYWxzZSxcblx0XHRcdFx0b3Blbk9uU2luZ2xlQ2xpY2s6IGZhbHNlLFxuXHRcdFx0XHRhbHdheXNDb25zdW1lTW91c2VXaGVlbDogZmFsc2UsXG5cdFx0XHR9KSk7XG5cblx0XHR0aGlzLnByb2ZpbGVzQ29udGVudFRyZWUuc3R5bGUobGlzdFN0eWxlcyk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMucHJvZmlsZXNDb250ZW50VHJlZSA9IHVuZGVmaW5lZCkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRoaXMucHJvZmlsZXNDb250ZW50VHJlZS5vbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQoaGVpZ2h0ID0+IHtcblx0XHRcdHRoaXMucHJvZmlsZXNDb250ZW50VHJlZT8ubGF5b3V0KGhlaWdodCk7XG5cdFx0XHRpZiAocHJvZmlsZUVsZW1lbnQpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50SGVpZ2h0LmZpcmUocHJvZmlsZUVsZW1lbnQpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZCh0aGlzLnByb2ZpbGVzQ29udGVudFRyZWUub25EaWRDaGFuZ2VTZWxlY3Rpb24oKGUgPT4ge1xuXHRcdFx0aWYgKHByb2ZpbGVFbGVtZW50KSB7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlU2VsZWN0aW9uLmZpcmUoeyBlbGVtZW50OiBwcm9maWxlRWxlbWVudCwgc2VsZWN0ZWQ6ICEhZS5lbGVtZW50cy5sZW5ndGggfSk7XG5cdFx0XHR9XG5cdFx0fSkpKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZCh0aGlzLnByb2ZpbGVzQ29udGVudFRyZWUub25EaWRPcGVuKGFzeW5jIChlKSA9PiB7XG5cdFx0XHRpZiAoIWUuYnJvd3NlckV2ZW50KSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChlLmVsZW1lbnQ/LmVsZW1lbnQub3BlbkFjdGlvbikge1xuXHRcdFx0XHRhd2FpdCBlLmVsZW1lbnQuZWxlbWVudC5vcGVuQWN0aW9uLnJ1bigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZCh0aGlzLnByb2ZpbGVzQ29udGVudFRyZWUub25Db250ZXh0TWVudShhc3luYyAoZSkgPT4ge1xuXHRcdFx0aWYgKCFlLmVsZW1lbnQ/LmVsZW1lbnQuYWN0aW9ucz8uY29udGV4dE1lbnU/Lmxlbmd0aCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmNvbnRleHRNZW51U2VydmljZS5zaG93Q29udGV4dE1lbnUoe1xuXHRcdFx0XHRnZXRBbmNob3I6ICgpID0+IGUuYW5jaG9yLFxuXHRcdFx0XHRnZXRBY3Rpb25zOiAoKSA9PiBlLmVsZW1lbnQ/LmVsZW1lbnQ/LmFjdGlvbnM/LmNvbnRleHRNZW51ID8/IFtdLFxuXHRcdFx0XHRnZXRBY3Rpb25zQ29udGV4dDogKCkgPT4gZS5lbGVtZW50XG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCB1cGRhdGVEZXNjcmlwdGlvbiA9IChlbGVtZW50OiBQcm9maWxlVHJlZUVsZW1lbnQpID0+IHtcblx0XHRcdGNsZWFyTm9kZShjb250ZW50c0Rlc2NyaXB0aW9uRWxlbWVudCk7XG5cblx0XHRcdGNvbnN0IG1hcmtkb3duID0gbmV3IE1hcmtkb3duU3RyaW5nKCk7XG5cdFx0XHRpZiAoZWxlbWVudC5yb290IGluc3RhbmNlb2YgVXNlckRhdGFQcm9maWxlRWxlbWVudCAmJiBlbGVtZW50LnJvb3QucHJvZmlsZS5pc0RlZmF1bHQpIHtcblx0XHRcdFx0bWFya2Rvd24uYXBwZW5kTWFya2Rvd24obG9jYWxpemUoJ2RlZmF1bHQgcHJvZmlsZSBjb250ZW50cyBkZXNjcmlwdGlvbicsIFwiQnJvd3NlIGNvbnRlbnRzIG9mIHRoaXMgcHJvZmlsZVxcblwiKSk7XG5cdFx0XHR9XG5cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHRtYXJrZG93bi5hcHBlbmRNYXJrZG93bihsb2NhbGl6ZSgnY29udGVudHMgc291cmNlIGRlc2NyaXB0aW9uJywgXCJDb25maWd1cmUgc291cmNlIG9mIGNvbnRlbnRzIGZvciB0aGlzIHByb2ZpbGVcXG5cIikpO1xuXHRcdFx0XHRpZiAoZWxlbWVudC5yb290IGluc3RhbmNlb2YgTmV3UHJvZmlsZUVsZW1lbnQpIHtcblx0XHRcdFx0XHRjb25zdCBjb3B5RnJvbU5hbWUgPSBlbGVtZW50LnJvb3QuZ2V0Q29weUZyb21OYW1lKCk7XG5cdFx0XHRcdFx0Y29uc3Qgb3B0aW9uTmFtZSA9IGNvcHlGcm9tTmFtZSA9PT0gdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5uYW1lXG5cdFx0XHRcdFx0XHQ/IGxvY2FsaXplKCdjb3B5IGZyb20gZGVmYXVsdCcsIFwiezB9IChDb3B5KVwiLCBjb3B5RnJvbU5hbWUpXG5cdFx0XHRcdFx0XHQ6IGNvcHlGcm9tTmFtZTtcblx0XHRcdFx0XHRpZiAob3B0aW9uTmFtZSkge1xuXHRcdFx0XHRcdFx0bWFya2Rvd25cblx0XHRcdFx0XHRcdFx0LmFwcGVuZE1hcmtkb3duKGxvY2FsaXplKCdjb3B5IGluZm8nLCBcIi0gKnswfToqIENvcHkgY29udGVudHMgZnJvbSB0aGUgezF9IHByb2ZpbGVcXG5cIiwgb3B0aW9uTmFtZSwgY29weUZyb21OYW1lKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdG1hcmtkb3duXG5cdFx0XHRcdFx0XHQuYXBwZW5kTWFya2Rvd24obG9jYWxpemUoJ2RlZmF1bHQgaW5mbycsIFwiLSAqRGVmYXVsdDoqIFVzZSBjb250ZW50cyBmcm9tIHRoZSBEZWZhdWx0IHByb2ZpbGVcXG5cIikpXG5cdFx0XHRcdFx0XHQuYXBwZW5kTWFya2Rvd24obG9jYWxpemUoJ25vbmUgaW5mbycsIFwiLSAqTm9uZToqIENyZWF0ZSBlbXB0eSBjb250ZW50c1xcblwiKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0YXBwZW5kKGNvbnRlbnRzRGVzY3JpcHRpb25FbGVtZW50LCBlbGVtZW50RGlzcG9zYWJsZXMuYWRkKHJlbmRlck1hcmtkb3duKG1hcmtkb3duKSkuZWxlbWVudCk7XG5cdFx0fTtcblxuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdHJldHVybiB7XG5cdFx0XHRzZXQgZWxlbWVudChlbGVtZW50OiBQcm9maWxlVHJlZUVsZW1lbnQpIHtcblx0XHRcdFx0cHJvZmlsZUVsZW1lbnQgPSBlbGVtZW50O1xuXHRcdFx0XHR1cGRhdGVEZXNjcmlwdGlvbihlbGVtZW50KTtcblx0XHRcdFx0aWYgKGVsZW1lbnQucm9vdCBpbnN0YW5jZW9mIE5ld1Byb2ZpbGVFbGVtZW50KSB7XG5cdFx0XHRcdFx0Y29udGVudHNUcmVlSGVhZGVyLmNsYXNzTGlzdC5yZW1vdmUoJ2RlZmF1bHQtcHJvZmlsZScpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGVsZW1lbnQucm9vdCBpbnN0YW5jZW9mIFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQpIHtcblx0XHRcdFx0XHRjb250ZW50c1RyZWVIZWFkZXIuY2xhc3NMaXN0LnRvZ2dsZSgnZGVmYXVsdC1wcm9maWxlJywgZWxlbWVudC5yb290LnByb2ZpbGUuaXNEZWZhdWx0KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRwcm9maWxlc0NvbnRlbnRUcmVlLnNldElucHV0KHByb2ZpbGVFbGVtZW50LnJvb3QpO1xuXHRcdFx0XHRlbGVtZW50RGlzcG9zYWJsZXMuYWRkKHByb2ZpbGVFbGVtZW50LnJvb3Qub25EaWRDaGFuZ2UoZSA9PiB7XG5cdFx0XHRcdFx0aWYgKGUuY29weUZyb20gfHwgZS5jb3B5RmxhZ3MgfHwgZS5mbGFncyB8fCBlLmV4dGVuc2lvbnMgfHwgZS5zbmlwcGV0cyB8fCBlLnByZXZpZXcpIHtcblx0XHRcdFx0XHRcdHByb2ZpbGVzQ29udGVudFRyZWUudXBkYXRlQ2hpbGRyZW4oZWxlbWVudC5yb290KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKGUuY29weUZyb21JbmZvKSB7XG5cdFx0XHRcdFx0XHR1cGRhdGVEZXNjcmlwdGlvbihlbGVtZW50KTtcblx0XHRcdFx0XHRcdHRoYXQuX29uRGlkQ2hhbmdlQ29udGVudEhlaWdodC5maXJlKGVsZW1lbnQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXHRcdFx0fSxcblx0XHRcdGRpc3Bvc2FibGVzLFxuXHRcdFx0ZWxlbWVudERpc3Bvc2FibGVzOiBuZXcgRGlzcG9zYWJsZVN0b3JlKClcblx0XHR9O1xuXHR9XG5cblx0Y2xlYXJTZWxlY3Rpb24oKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMucHJvZmlsZXNDb250ZW50VHJlZSkge1xuXHRcdFx0dGhpcy5wcm9maWxlc0NvbnRlbnRUcmVlLnNldFNlbGVjdGlvbihbXSk7XG5cdFx0XHR0aGlzLnByb2ZpbGVzQ29udGVudFRyZWUuc2V0Rm9jdXMoW10pO1xuXHRcdH1cblx0fVxufVxuXG5pbnRlcmZhY2UgV29ya3NwYWNlVGFibGVFbGVtZW50IHtcblx0cmVhZG9ubHkgd29ya3NwYWNlOiBVUkk7XG5cdHJlYWRvbmx5IHByb2ZpbGVFbGVtZW50OiBVc2VyRGF0YVByb2ZpbGVFbGVtZW50O1xufVxuXG5jbGFzcyBQcm9maWxlV29ya3NwYWNlc1JlbmRlcmVyIGV4dGVuZHMgUHJvZmlsZVByb3BlcnR5UmVuZGVyZXIge1xuXG5cdHJlYWRvbmx5IHRlbXBsYXRlSWQ6IFByb2ZpbGVQcm9wZXJ0eSA9ICd3b3Jrc3BhY2VzJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxQcm9maWxlVHJlZUVsZW1lbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQgPSB0aGlzLl9vbkRpZENoYW5nZUNvbnRlbnRIZWlnaHQuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VTZWxlY3Rpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IGVsZW1lbnQ6IFByb2ZpbGVUcmVlRWxlbWVudDsgc2VsZWN0ZWQ6IGJvb2xlYW4gfT4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlU2VsZWN0aW9uID0gdGhpcy5fb25EaWRDaGFuZ2VTZWxlY3Rpb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSB3b3Jrc3BhY2VzVGFibGU6IFdvcmtiZW5jaFRhYmxlPFdvcmtzcGFjZVRhYmxlRWxlbWVudD4gfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElGaWxlRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVEaWFsb2dTZXJ2aWNlOiBJRmlsZURpYWxvZ1NlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShwYXJlbnQ6IEhUTUxFbGVtZW50KTogSVByb2ZpbGVQcm9wZXJ0eVJlbmRlcmVyVGVtcGxhdGUge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGVsZW1lbnREaXNwb3NhYmxlcyA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRcdGxldCBwcm9maWxlRWxlbWVudDogUHJvZmlsZVRyZWVFbGVtZW50IHwgdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgcHJvZmlsZVdvcmtzcGFjZXNSb3dDb250YWluZXIgPSBhcHBlbmQocGFyZW50LCAkKCcucHJvZmlsZS1yb3ctY29udGFpbmVyJykpO1xuXHRcdGFwcGVuZChwcm9maWxlV29ya3NwYWNlc1Jvd0NvbnRhaW5lciwgJCgnLnByb2ZpbGUtbGFiZWwtZWxlbWVudCcsIHVuZGVmaW5lZCwgbG9jYWxpemUoJ2ZvbGRlcnNfd29ya3NwYWNlcycsIFwiRm9sZGVycyAmIFdvcmtzcGFjZXNcIikpKTtcblx0XHRjb25zdCBwcm9maWxlV29ya3NwYWNlc0Rlc2NyaXB0aW9uRWxlbWVudCA9IGFwcGVuZChwcm9maWxlV29ya3NwYWNlc1Jvd0NvbnRhaW5lciwgJCgnLnByb2ZpbGUtZGVzY3JpcHRpb24tZWxlbWVudCcpKTtcblxuXHRcdGNvbnN0IHdvcmtzcGFjZXNUYWJsZUNvbnRhaW5lciA9IGFwcGVuZChwcm9maWxlV29ya3NwYWNlc1Jvd0NvbnRhaW5lciwgJCgnLnByb2ZpbGUtYXNzb2NpYXRpb25zLXRhYmxlJykpO1xuXHRcdGNvbnN0IHRhYmxlID0gdGhpcy53b3Jrc3BhY2VzVGFibGUgPSBkaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShXb3JrYmVuY2hUYWJsZTxXb3Jrc3BhY2VUYWJsZUVsZW1lbnQ+LFxuXHRcdFx0J1Byb2ZpbGVFZGl0b3ItQXNzb2NpYXRpb25zVGFibGUnLFxuXHRcdFx0d29ya3NwYWNlc1RhYmxlQ29udGFpbmVyLFxuXHRcdFx0bmV3IGNsYXNzIGltcGxlbWVudHMgSVRhYmxlVmlydHVhbERlbGVnYXRlPFVSST4ge1xuXHRcdFx0XHRyZWFkb25seSBoZWFkZXJSb3dIZWlnaHQgPSAzMDtcblx0XHRcdFx0Z2V0SGVpZ2h0KCkgeyByZXR1cm4gMjQ7IH1cblx0XHRcdH0sXG5cdFx0XHRbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRsYWJlbDogJycsXG5cdFx0XHRcdFx0dG9vbHRpcDogJycsXG5cdFx0XHRcdFx0d2VpZ2h0OiAxLFxuXHRcdFx0XHRcdG1pbmltdW1XaWR0aDogMzAsXG5cdFx0XHRcdFx0bWF4aW11bVdpZHRoOiAzMCxcblx0XHRcdFx0XHR0ZW1wbGF0ZUlkOiBXb3Jrc3BhY2VVcmlFbXB0eUNvbHVtblJlbmRlcmVyLlRFTVBMQVRFX0lELFxuXHRcdFx0XHRcdHByb2plY3Qocm93OiBXb3Jrc3BhY2VUYWJsZUVsZW1lbnQpOiBXb3Jrc3BhY2VUYWJsZUVsZW1lbnQgeyByZXR1cm4gcm93OyB9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdob3N0Q29sdW1uTGFiZWwnLCBcIkhvc3RcIiksXG5cdFx0XHRcdFx0dG9vbHRpcDogJycsXG5cdFx0XHRcdFx0d2VpZ2h0OiAyLFxuXHRcdFx0XHRcdHRlbXBsYXRlSWQ6IFdvcmtzcGFjZVVyaUhvc3RDb2x1bW5SZW5kZXJlci5URU1QTEFURV9JRCxcblx0XHRcdFx0XHRwcm9qZWN0KHJvdzogV29ya3NwYWNlVGFibGVFbGVtZW50KTogV29ya3NwYWNlVGFibGVFbGVtZW50IHsgcmV0dXJuIHJvdzsgfSxcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgncGF0aENvbHVtbkxhYmVsJywgXCJQYXRoXCIpLFxuXHRcdFx0XHRcdHRvb2x0aXA6ICcnLFxuXHRcdFx0XHRcdHdlaWdodDogNyxcblx0XHRcdFx0XHR0ZW1wbGF0ZUlkOiBXb3Jrc3BhY2VVcmlQYXRoQ29sdW1uUmVuZGVyZXIuVEVNUExBVEVfSUQsXG5cdFx0XHRcdFx0cHJvamVjdChyb3c6IFdvcmtzcGFjZVRhYmxlRWxlbWVudCk6IFdvcmtzcGFjZVRhYmxlRWxlbWVudCB7IHJldHVybiByb3c7IH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiAnJyxcblx0XHRcdFx0XHR0b29sdGlwOiAnJyxcblx0XHRcdFx0XHR3ZWlnaHQ6IDEsXG5cdFx0XHRcdFx0bWluaW11bVdpZHRoOiA4NCxcblx0XHRcdFx0XHRtYXhpbXVtV2lkdGg6IDg0LFxuXHRcdFx0XHRcdHRlbXBsYXRlSWQ6IFdvcmtzcGFjZVVyaUFjdGlvbnNDb2x1bW5SZW5kZXJlci5URU1QTEFURV9JRCxcblx0XHRcdFx0XHRwcm9qZWN0KHJvdzogV29ya3NwYWNlVGFibGVFbGVtZW50KTogV29ya3NwYWNlVGFibGVFbGVtZW50IHsgcmV0dXJuIHJvdzsgfVxuXHRcdFx0XHR9LFxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFdvcmtzcGFjZVVyaUVtcHR5Q29sdW1uUmVuZGVyZXIoKSxcblx0XHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShXb3Jrc3BhY2VVcmlIb3N0Q29sdW1uUmVuZGVyZXIpLFxuXHRcdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdvcmtzcGFjZVVyaVBhdGhDb2x1bW5SZW5kZXJlciksXG5cdFx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya3NwYWNlVXJpQWN0aW9uc0NvbHVtblJlbmRlcmVyKSxcblx0XHRcdF0sXG5cdFx0XHR7XG5cdFx0XHRcdGhvcml6b250YWxTY3JvbGxpbmc6IGZhbHNlLFxuXHRcdFx0XHRhbHdheXNDb25zdW1lTW91c2VXaGVlbDogZmFsc2UsXG5cdFx0XHRcdG9wZW5PblNpbmdsZUNsaWNrOiBmYWxzZSxcblx0XHRcdFx0bXVsdGlwbGVTZWxlY3Rpb25TdXBwb3J0OiBmYWxzZSxcblx0XHRcdFx0YWNjZXNzaWJpbGl0eVByb3ZpZGVyOiB7XG5cdFx0XHRcdFx0Z2V0QXJpYUxhYmVsOiAoaXRlbTogV29ya3NwYWNlVGFibGVFbGVtZW50KSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBob3N0TGFiZWwgPSBnZXRIb3N0TGFiZWwodGhpcy5sYWJlbFNlcnZpY2UsIGl0ZW0ud29ya3NwYWNlKTtcblx0XHRcdFx0XHRcdGlmIChob3N0TGFiZWwgPT09IHVuZGVmaW5lZCB8fCBob3N0TGFiZWwubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgndHJ1c3RlZEZvbGRlckFyaWFMYWJlbCcsIFwiezB9LCB0cnVzdGVkXCIsIHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGl0ZW0ud29ya3NwYWNlKSk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgndHJ1c3RlZEZvbGRlcldpdGhIb3N0QXJpYUxhYmVsJywgXCJ7MH0gb24gezF9LCB0cnVzdGVkXCIsIHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGl0ZW0ud29ya3NwYWNlKSwgaG9zdExhYmVsKTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGdldFdpZGdldEFyaWFMYWJlbDogKCkgPT4gbG9jYWxpemUoJ3RydXN0ZWRGb2xkZXJzQW5kV29ya3NwYWNlcycsIFwiVHJ1c3RlZCBGb2xkZXJzICYgV29ya3NwYWNlc1wiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRpZGVudGl0eVByb3ZpZGVyOiB7XG5cdFx0XHRcdFx0Z2V0SWQoZWxlbWVudDogV29ya3NwYWNlVGFibGVFbGVtZW50KSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZWxlbWVudC53b3Jrc3BhY2UudG9TdHJpbmcoKTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0dGhpcy53b3Jrc3BhY2VzVGFibGUuc3R5bGUobGlzdFN0eWxlcyk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLndvcmtzcGFjZXNUYWJsZSA9IHVuZGVmaW5lZCkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0aGlzLndvcmtzcGFjZXNUYWJsZS5vbkRpZENoYW5nZVNlbGVjdGlvbigoZSA9PiB7XG5cdFx0XHRpZiAocHJvZmlsZUVsZW1lbnQpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTZWxlY3Rpb24uZmlyZSh7IGVsZW1lbnQ6IHByb2ZpbGVFbGVtZW50LCBzZWxlY3RlZDogISFlLmVsZW1lbnRzLmxlbmd0aCB9KTtcblx0XHRcdH1cblx0XHR9KSkpO1xuXG5cdFx0Y29uc3QgYWRkQnV0dG9uQmFyRWxlbWVudCA9IGFwcGVuZChwcm9maWxlV29ya3NwYWNlc1Jvd0NvbnRhaW5lciwgJCgnLnByb2ZpbGUtd29ya3NwYWNlcy1idXR0b24tY29udGFpbmVyJykpO1xuXHRcdGNvbnN0IGJ1dHRvbkJhciA9IGRpc3Bvc2FibGVzLmFkZChuZXcgQnV0dG9uQmFyKGFkZEJ1dHRvbkJhckVsZW1lbnQpKTtcblx0XHRjb25zdCBhZGRCdXR0b24gPSB0aGlzLl9yZWdpc3RlcihidXR0b25CYXIuYWRkQnV0dG9uKHsgdGl0bGU6IGxvY2FsaXplKCdhZGRCdXR0b24nLCBcIkFkZCBGb2xkZXJcIiksIC4uLmRlZmF1bHRCdXR0b25TdHlsZXMgfSkpO1xuXHRcdGFkZEJ1dHRvbi5sYWJlbCA9IGxvY2FsaXplKCdhZGRCdXR0b24nLCBcIkFkZCBGb2xkZXJcIik7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoYWRkQnV0dG9uLm9uRGlkQ2xpY2soYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdXJpcyA9IGF3YWl0IHRoaXMuZmlsZURpYWxvZ1NlcnZpY2Uuc2hvd09wZW5EaWFsb2coe1xuXHRcdFx0XHRjYW5TZWxlY3RGaWxlczogZmFsc2UsXG5cdFx0XHRcdGNhblNlbGVjdEZvbGRlcnM6IHRydWUsXG5cdFx0XHRcdGNhblNlbGVjdE1hbnk6IHRydWUsXG5cdFx0XHRcdG9wZW5MYWJlbDogbG9jYWxpemUoJ2FkZEZvbGRlcicsIFwiQWRkIEZvbGRlclwiKSxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdhZGRGb2xkZXJUaXRsZScsIFwiU2VsZWN0IEZvbGRlcnMgVG8gQWRkXCIpXG5cdFx0XHR9KTtcblx0XHRcdGlmICh1cmlzKSB7XG5cdFx0XHRcdGlmIChwcm9maWxlRWxlbWVudD8ucm9vdCBpbnN0YW5jZW9mIFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQpIHtcblx0XHRcdFx0XHRwcm9maWxlRWxlbWVudC5yb290LnVwZGF0ZVdvcmtzcGFjZXModXJpcywgW10pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRhYmxlLm9uRGlkT3BlbihpdGVtID0+IHtcblx0XHRcdGlmIChpdGVtPy5lbGVtZW50KSB7XG5cdFx0XHRcdGl0ZW0uZWxlbWVudC5wcm9maWxlRWxlbWVudC5vcGVuV29ya3NwYWNlKGl0ZW0uZWxlbWVudC53b3Jrc3BhY2UpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHVwZGF0ZVRhYmxlID0gKCkgPT4ge1xuXHRcdFx0aWYgKHByb2ZpbGVFbGVtZW50Py5yb290IGluc3RhbmNlb2YgVXNlckRhdGFQcm9maWxlRWxlbWVudCAmJiBwcm9maWxlRWxlbWVudC5yb290LndvcmtzcGFjZXM/Lmxlbmd0aCkge1xuXHRcdFx0XHRwcm9maWxlV29ya3NwYWNlc0Rlc2NyaXB0aW9uRWxlbWVudC50ZXh0Q29udGVudCA9IGxvY2FsaXplKCdmb2xkZXJzX3dvcmtzcGFjZXNfZGVzY3JpcHRpb24nLCBcIkZvbGxvd2luZyBmb2xkZXJzIGFuZCB3b3Jrc3BhY2VzIGFyZSB1c2luZyB0aGlzIHByb2ZpbGVcIik7XG5cdFx0XHRcdHdvcmtzcGFjZXNUYWJsZUNvbnRhaW5lci5jbGFzc0xpc3QucmVtb3ZlKCdoaWRlJyk7XG5cdFx0XHRcdHRhYmxlLnNwbGljZSgwLCB0YWJsZS5sZW5ndGgsIHByb2ZpbGVFbGVtZW50LnJvb3Qud29ya3NwYWNlc1xuXHRcdFx0XHRcdC5tYXAod29ya3NwYWNlID0+ICh7IHdvcmtzcGFjZSwgcHJvZmlsZUVsZW1lbnQ6IDxVc2VyRGF0YVByb2ZpbGVFbGVtZW50PnByb2ZpbGVFbGVtZW50IS5yb290IH0pKVxuXHRcdFx0XHRcdC5zb3J0KChhLCBiKSA9PiB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuY29tcGFyZShhLndvcmtzcGFjZSwgYi53b3Jrc3BhY2UpKVxuXHRcdFx0XHQpO1xuXHRcdFx0XHR0aGlzLmxheW91dCgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cHJvZmlsZVdvcmtzcGFjZXNEZXNjcmlwdGlvbkVsZW1lbnQudGV4dENvbnRlbnQgPSBsb2NhbGl6ZSgnbm9fZm9sZGVyX2Rlc2NyaXB0aW9uJywgXCJObyBmb2xkZXJzIG9yIHdvcmtzcGFjZXMgYXJlIHVzaW5nIHRoaXMgcHJvZmlsZVwiKTtcblx0XHRcdFx0d29ya3NwYWNlc1RhYmxlQ29udGFpbmVyLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHNldCBlbGVtZW50KGVsZW1lbnQ6IFByb2ZpbGVUcmVlRWxlbWVudCkge1xuXHRcdFx0XHRwcm9maWxlRWxlbWVudCA9IGVsZW1lbnQ7XG5cdFx0XHRcdGlmIChlbGVtZW50LnJvb3QgaW5zdGFuY2VvZiBVc2VyRGF0YVByb2ZpbGVFbGVtZW50KSB7XG5cdFx0XHRcdFx0dXBkYXRlVGFibGUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbGVtZW50RGlzcG9zYWJsZXMuYWRkKHByb2ZpbGVFbGVtZW50LnJvb3Qub25EaWRDaGFuZ2UoZSA9PiB7XG5cdFx0XHRcdFx0aWYgKHByb2ZpbGVFbGVtZW50ICYmIGUud29ya3NwYWNlcykge1xuXHRcdFx0XHRcdFx0dXBkYXRlVGFibGUoKTtcblx0XHRcdFx0XHRcdHRoYXQuX29uRGlkQ2hhbmdlQ29udGVudEhlaWdodC5maXJlKHByb2ZpbGVFbGVtZW50KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pKTtcblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NhYmxlcyxcblx0XHRcdGVsZW1lbnREaXNwb3NhYmxlczogbmV3IERpc3Bvc2FibGVTdG9yZSgpXG5cdFx0fTtcblx0fVxuXG5cdGxheW91dCgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy53b3Jrc3BhY2VzVGFibGUpIHtcblx0XHRcdHRoaXMud29ya3NwYWNlc1RhYmxlLmxheW91dCgodGhpcy53b3Jrc3BhY2VzVGFibGUubGVuZ3RoICogMjQpICsgMzAsIHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9XG5cblx0Y2xlYXJTZWxlY3Rpb24oKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMud29ya3NwYWNlc1RhYmxlKSB7XG5cdFx0XHR0aGlzLndvcmtzcGFjZXNUYWJsZS5zZXRTZWxlY3Rpb24oW10pO1xuXHRcdFx0dGhpcy53b3Jrc3BhY2VzVGFibGUuc2V0Rm9jdXMoW10pO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBFeGlzdGluZ1Byb2ZpbGVSZXNvdXJjZVRyZWVSZW5kZXJlciBleHRlbmRzIEFic3RyYWN0UHJvZmlsZVJlc291cmNlVHJlZVJlbmRlcmVyIGltcGxlbWVudHMgSVRyZWVSZW5kZXJlcjxQcm9maWxlQ29udGVudFRyZWVFbGVtZW50LCB2b2lkLCBJRXhpc3RpbmdQcm9maWxlUmVzb3VyY2VUZW1wbGF0ZURhdGE+IHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgVEVNUExBVEVfSUQgPSAnRXhpc3RpbmdQcm9maWxlUmVzb3VyY2VUZW1wbGF0ZSc7XG5cblx0cmVhZG9ubHkgdGVtcGxhdGVJZCA9IEV4aXN0aW5nUHJvZmlsZVJlc291cmNlVHJlZVJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUocGFyZW50OiBIVE1MRWxlbWVudCk6IElFeGlzdGluZ1Byb2ZpbGVSZXNvdXJjZVRlbXBsYXRlRGF0YSB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gYXBwZW5kKHBhcmVudCwgJCgnLnByb2ZpbGUtdHJlZS1pdGVtLWNvbnRhaW5lci5leGlzdGluZy1wcm9maWxlLXJlc291cmNlLXR5cGUtY29udGFpbmVyJykpO1xuXHRcdGNvbnN0IGxhYmVsID0gYXBwZW5kKGNvbnRhaW5lciwgJCgnLnByb2ZpbGUtcmVzb3VyY2UtdHlwZS1sYWJlbCcpKTtcblxuXHRcdGNvbnN0IHJhZGlvID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBSYWRpbyh7IGl0ZW1zOiBbXSB9KSk7XG5cdFx0YXBwZW5kKGFwcGVuZChjb250YWluZXIsICQoJy5wcm9maWxlLXJlc291cmNlLW9wdGlvbnMtY29udGFpbmVyJykpLCByYWRpby5kb21Ob2RlKTtcblxuXHRcdGNvbnN0IGFjdGlvbnNDb250YWluZXIgPSBhcHBlbmQoY29udGFpbmVyLCAkKCcucHJvZmlsZS1yZXNvdXJjZS1hY3Rpb25zLWNvbnRhaW5lcicpKTtcblx0XHRjb25zdCBhY3Rpb25CYXIgPSBkaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShXb3JrYmVuY2hUb29sQmFyLFxuXHRcdFx0YWN0aW9uc0NvbnRhaW5lcixcblx0XHRcdHtcblx0XHRcdFx0aG92ZXJEZWxlZ2F0ZTogZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZUluc3RhbnRIb3ZlckRlbGVnYXRlKCkpLFxuXHRcdFx0XHRoaWdobGlnaHRUb2dnbGVkSXRlbXM6IHRydWVcblx0XHRcdH1cblx0XHQpKTtcblxuXHRcdHJldHVybiB7IGxhYmVsLCByYWRpbywgYWN0aW9uQmFyLCBkaXNwb3NhYmxlcywgZWxlbWVudERpc3Bvc2FibGVzOiBkaXNwb3NhYmxlcy5hZGQobmV3IERpc3Bvc2FibGVTdG9yZSgpKSB9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudCh7IGVsZW1lbnQ6IHByb2ZpbGVSZXNvdXJjZVRyZWVFbGVtZW50IH06IElUcmVlTm9kZTxQcm9maWxlQ29udGVudFRyZWVFbGVtZW50LCB2b2lkPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJRXhpc3RpbmdQcm9maWxlUmVzb3VyY2VUZW1wbGF0ZURhdGEsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdGNvbnN0IHsgZWxlbWVudCwgcm9vdCB9ID0gcHJvZmlsZVJlc291cmNlVHJlZUVsZW1lbnQ7XG5cdFx0aWYgKCEocm9vdCBpbnN0YW5jZW9mIFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0V4aXN0aW5nUHJvZmlsZVJlc291cmNlVHJlZVJlbmRlcmVyIGNhbiBvbmx5IHJlbmRlciBleGlzdGluZyBwcm9maWxlIGVsZW1lbnQnKTtcblx0XHR9XG5cdFx0aWYgKGlzU3RyaW5nKGVsZW1lbnQpIHx8ICFpc1Byb2ZpbGVSZXNvdXJjZVR5cGVFbGVtZW50KGVsZW1lbnQpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcHJvZmlsZSByZXNvdXJjZSBlbGVtZW50Jyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgdXBkYXRlUmFkaW9JdGVtcyA9ICgpID0+IHtcblx0XHRcdHRlbXBsYXRlRGF0YS5yYWRpby5zZXRJdGVtcyhbe1xuXHRcdFx0XHR0ZXh0OiBsb2NhbGl6ZSgnZGVmYXVsdCcsIFwiRGVmYXVsdFwiKSxcblx0XHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ2RlZmF1bHQgZGVzY3JpcHRpb24nLCBcIlVzZSB7MH0gZnJvbSB0aGUgRGVmYXVsdCBwcm9maWxlXCIsIHJlc291cmNlVHlwZVRpdGxlKSxcblx0XHRcdFx0aXNBY3RpdmU6IHJvb3QuZ2V0RmxhZyhlbGVtZW50LnJlc291cmNlVHlwZSlcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdHRleHQ6IHJvb3QubmFtZSxcblx0XHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ2N1cnJlbnQgZGVzY3JpcHRpb24nLCBcIlVzZSB7MH0gZnJvbSB0aGUgezF9IHByb2ZpbGVcIiwgcmVzb3VyY2VUeXBlVGl0bGUsIHJvb3QubmFtZSksXG5cdFx0XHRcdGlzQWN0aXZlOiAhcm9vdC5nZXRGbGFnKGVsZW1lbnQucmVzb3VyY2VUeXBlKVxuXHRcdFx0fV0pO1xuXHRcdH07XG5cblx0XHRjb25zdCByZXNvdXJjZVR5cGVUaXRsZSA9IHRoaXMuZ2V0UmVzb3VyY2VUeXBlVGl0bGUoZWxlbWVudC5yZXNvdXJjZVR5cGUpO1xuXHRcdHRlbXBsYXRlRGF0YS5sYWJlbC50ZXh0Q29udGVudCA9IHJlc291cmNlVHlwZVRpdGxlO1xuXG5cdFx0aWYgKHJvb3QgaW5zdGFuY2VvZiBVc2VyRGF0YVByb2ZpbGVFbGVtZW50ICYmIHJvb3QucHJvZmlsZS5pc0RlZmF1bHQpIHtcblx0XHRcdHRlbXBsYXRlRGF0YS5yYWRpby5kb21Ob2RlLmNsYXNzTGlzdC5hZGQoJ2hpZGUnKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGVtcGxhdGVEYXRhLnJhZGlvLmRvbU5vZGUuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZScpO1xuXHRcdFx0dXBkYXRlUmFkaW9JdGVtcygpO1xuXHRcdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQocm9vdC5vbkRpZENoYW5nZShlID0+IHtcblx0XHRcdFx0aWYgKGUubmFtZSkge1xuXHRcdFx0XHRcdHVwZGF0ZVJhZGlvSXRlbXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQodGVtcGxhdGVEYXRhLnJhZGlvLm9uRGlkU2VsZWN0KChpbmRleCkgPT4gcm9vdC5zZXRGbGFnKGVsZW1lbnQucmVzb3VyY2VUeXBlLCBpbmRleCA9PT0gMCkpKTtcblx0XHR9XG5cblx0XHRjb25zdCBhY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblx0XHRpZiAoZWxlbWVudC5vcGVuQWN0aW9uKSB7XG5cdFx0XHRhY3Rpb25zLnB1c2goZWxlbWVudC5vcGVuQWN0aW9uKTtcblx0XHR9XG5cdFx0aWYgKGVsZW1lbnQuYWN0aW9ucz8ucHJpbWFyeSkge1xuXHRcdFx0YWN0aW9ucy5wdXNoKC4uLmVsZW1lbnQuYWN0aW9ucy5wcmltYXJ5KTtcblx0XHR9XG5cdFx0dGVtcGxhdGVEYXRhLmFjdGlvbkJhci5zZXRBY3Rpb25zKGFjdGlvbnMpO1xuXHR9XG5cbn1cblxuY2xhc3MgTmV3UHJvZmlsZVJlc291cmNlVHJlZVJlbmRlcmVyIGV4dGVuZHMgQWJzdHJhY3RQcm9maWxlUmVzb3VyY2VUcmVlUmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPFByb2ZpbGVDb250ZW50VHJlZUVsZW1lbnQsIHZvaWQsIElOZXdQcm9maWxlUmVzb3VyY2VUZW1wbGF0ZURhdGE+IHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgVEVNUExBVEVfSUQgPSAnTmV3UHJvZmlsZVJlc291cmNlVGVtcGxhdGUnO1xuXG5cdHJlYWRvbmx5IHRlbXBsYXRlSWQgPSBOZXdQcm9maWxlUmVzb3VyY2VUcmVlUmVuZGVyZXIuVEVNUExBVEVfSUQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShwYXJlbnQ6IEhUTUxFbGVtZW50KTogSU5ld1Byb2ZpbGVSZXNvdXJjZVRlbXBsYXRlRGF0YSB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgY29udGFpbmVyID0gYXBwZW5kKHBhcmVudCwgJCgnLnByb2ZpbGUtdHJlZS1pdGVtLWNvbnRhaW5lci5uZXctcHJvZmlsZS1yZXNvdXJjZS10eXBlLWNvbnRhaW5lcicpKTtcblx0XHRjb25zdCBsYWJlbENvbnRhaW5lciA9IGFwcGVuZChjb250YWluZXIsICQoJy5wcm9maWxlLXJlc291cmNlLXR5cGUtbGFiZWwtY29udGFpbmVyJykpO1xuXHRcdGNvbnN0IGxhYmVsID0gYXBwZW5kKGxhYmVsQ29udGFpbmVyLCAkKCdzcGFuLnByb2ZpbGUtcmVzb3VyY2UtdHlwZS1sYWJlbCcpKTtcblxuXHRcdGNvbnN0IHJhZGlvID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBSYWRpbyh7IGl0ZW1zOiBbXSB9KSk7XG5cdFx0YXBwZW5kKGFwcGVuZChjb250YWluZXIsICQoJy5wcm9maWxlLXJlc291cmNlLW9wdGlvbnMtY29udGFpbmVyJykpLCByYWRpby5kb21Ob2RlKTtcblxuXHRcdGNvbnN0IGFjdGlvbnNDb250YWluZXIgPSBhcHBlbmQoY29udGFpbmVyLCAkKCcucHJvZmlsZS1yZXNvdXJjZS1hY3Rpb25zLWNvbnRhaW5lcicpKTtcblx0XHRjb25zdCBhY3Rpb25CYXIgPSBkaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShXb3JrYmVuY2hUb29sQmFyLFxuXHRcdFx0YWN0aW9uc0NvbnRhaW5lcixcblx0XHRcdHtcblx0XHRcdFx0aG92ZXJEZWxlZ2F0ZTogZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZUluc3RhbnRIb3ZlckRlbGVnYXRlKCkpLFxuXHRcdFx0XHRoaWdobGlnaHRUb2dnbGVkSXRlbXM6IHRydWVcblx0XHRcdH1cblx0XHQpKTtcblxuXHRcdHJldHVybiB7IGxhYmVsLCByYWRpbywgYWN0aW9uQmFyLCBkaXNwb3NhYmxlcywgZWxlbWVudERpc3Bvc2FibGVzOiBkaXNwb3NhYmxlcy5hZGQobmV3IERpc3Bvc2FibGVTdG9yZSgpKSB9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudCh7IGVsZW1lbnQ6IHByb2ZpbGVSZXNvdXJjZVRyZWVFbGVtZW50IH06IElUcmVlTm9kZTxQcm9maWxlQ29udGVudFRyZWVFbGVtZW50LCB2b2lkPiwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJTmV3UHJvZmlsZVJlc291cmNlVGVtcGxhdGVEYXRhLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRjb25zdCB7IGVsZW1lbnQsIHJvb3QgfSA9IHByb2ZpbGVSZXNvdXJjZVRyZWVFbGVtZW50O1xuXHRcdGlmICghKHJvb3QgaW5zdGFuY2VvZiBOZXdQcm9maWxlRWxlbWVudCkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTmV3UHJvZmlsZVJlc291cmNlVHJlZVJlbmRlcmVyIGNhbiBvbmx5IHJlbmRlciBuZXcgcHJvZmlsZSBlbGVtZW50Jyk7XG5cdFx0fVxuXHRcdGlmIChpc1N0cmluZyhlbGVtZW50KSB8fCAhaXNQcm9maWxlUmVzb3VyY2VUeXBlRWxlbWVudChlbGVtZW50KSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIHByb2ZpbGUgcmVzb3VyY2UgZWxlbWVudCcpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc291cmNlVHlwZVRpdGxlID0gdGhpcy5nZXRSZXNvdXJjZVR5cGVUaXRsZShlbGVtZW50LnJlc291cmNlVHlwZSk7XG5cdFx0dGVtcGxhdGVEYXRhLmxhYmVsLnRleHRDb250ZW50ID0gcmVzb3VyY2VUeXBlVGl0bGU7XG5cblx0XHRjb25zdCByZW5kZXJSYWRpb0l0ZW1zID0gKCkgPT4ge1xuXHRcdFx0Y29uc3Qgb3B0aW9ucyA9IFt7XG5cdFx0XHRcdHRleHQ6IGxvY2FsaXplKCdkZWZhdWx0JywgXCJEZWZhdWx0XCIpLFxuXHRcdFx0XHR0b29sdGlwOiBsb2NhbGl6ZSgnZGVmYXVsdCBkZXNjcmlwdGlvbicsIFwiVXNlIHswfSBmcm9tIHRoZSBEZWZhdWx0IHByb2ZpbGVcIiwgcmVzb3VyY2VUeXBlVGl0bGUpLFxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0dGV4dDogbG9jYWxpemUoJ25vbmUnLCBcIk5vbmVcIiksXG5cdFx0XHRcdHRvb2x0aXA6IGxvY2FsaXplKCdub25lIGRlc2NyaXB0aW9uJywgXCJDcmVhdGUgZW1wdHkgezB9XCIsIHJlc291cmNlVHlwZVRpdGxlKVxuXHRcdFx0fV07XG5cdFx0XHRjb25zdCBjb3B5RnJvbU5hbWUgPSByb290LmdldENvcHlGcm9tTmFtZSgpO1xuXHRcdFx0Y29uc3QgbmFtZSA9IGNvcHlGcm9tTmFtZSA9PT0gdGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5uYW1lXG5cdFx0XHRcdD8gbG9jYWxpemUoJ2NvcHkgZnJvbSBkZWZhdWx0JywgXCJ7MH0gKENvcHkpXCIsIGNvcHlGcm9tTmFtZSlcblx0XHRcdFx0OiBjb3B5RnJvbU5hbWU7XG5cdFx0XHRpZiAocm9vdC5jb3B5RnJvbSAmJiBuYW1lKSB7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS5yYWRpby5zZXRJdGVtcyhbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0dGV4dDogbmFtZSxcblx0XHRcdFx0XHRcdHRvb2x0aXA6IG5hbWUgPyBsb2NhbGl6ZSgnY29weSBmcm9tIHByb2ZpbGUgZGVzY3JpcHRpb24nLCBcIkNvcHkgezB9IGZyb20gdGhlIHsxfSBwcm9maWxlXCIsIHJlc291cmNlVHlwZVRpdGxlLCBuYW1lKSA6IGxvY2FsaXplKCdjb3B5IGRlc2NyaXB0aW9uJywgXCJDb3B5XCIpLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Li4ub3B0aW9uc1xuXHRcdFx0XHRdKTtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLnJhZGlvLnNldEFjdGl2ZUl0ZW0ocm9vdC5nZXRDb3B5RmxhZyhlbGVtZW50LnJlc291cmNlVHlwZSkgPyAwIDogcm9vdC5nZXRGbGFnKGVsZW1lbnQucmVzb3VyY2VUeXBlKSA/IDEgOiAyKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS5yYWRpby5zZXRJdGVtcyhvcHRpb25zKTtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLnJhZGlvLnNldEFjdGl2ZUl0ZW0ocm9vdC5nZXRGbGFnKGVsZW1lbnQucmVzb3VyY2VUeXBlKSA/IDAgOiAxKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0aWYgKHJvb3QuY29weUZyb20pIHtcblx0XHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKHRlbXBsYXRlRGF0YS5yYWRpby5vbkRpZFNlbGVjdChpbmRleCA9PiB7XG5cdFx0XHRcdHJvb3Quc2V0RmxhZyhlbGVtZW50LnJlc291cmNlVHlwZSwgaW5kZXggPT09IDEpO1xuXHRcdFx0XHRyb290LnNldENvcHlGbGFnKGVsZW1lbnQucmVzb3VyY2VUeXBlLCBpbmRleCA9PT0gMCk7XG5cdFx0XHR9KSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50RGlzcG9zYWJsZXMuYWRkKHRlbXBsYXRlRGF0YS5yYWRpby5vbkRpZFNlbGVjdChpbmRleCA9PiB7XG5cdFx0XHRcdHJvb3Quc2V0RmxhZyhlbGVtZW50LnJlc291cmNlVHlwZSwgaW5kZXggPT09IDApO1xuXHRcdFx0fSkpO1xuXHRcdH1cblxuXHRcdHJlbmRlclJhZGlvSXRlbXMoKTtcblx0XHR0ZW1wbGF0ZURhdGEucmFkaW8uc2V0RW5hYmxlZCghcm9vdC5kaXNhYmxlZCAmJiAhcm9vdC5wcmV2aWV3UHJvZmlsZSk7XG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5hZGQocm9vdC5vbkRpZENoYW5nZShlID0+IHtcblx0XHRcdGlmIChlLmRpc2FibGVkIHx8IGUucHJldmlldykge1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEucmFkaW8uc2V0RW5hYmxlZCghcm9vdC5kaXNhYmxlZCAmJiAhcm9vdC5wcmV2aWV3UHJvZmlsZSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoZS5jb3B5RnJvbSB8fCBlLmNvcHlGcm9tSW5mbykge1xuXHRcdFx0XHRyZW5kZXJSYWRpb0l0ZW1zKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGNvbnN0IGFjdGlvbnM6IElBY3Rpb25bXSA9IFtdO1xuXHRcdGlmIChlbGVtZW50Lm9wZW5BY3Rpb24pIHtcblx0XHRcdGFjdGlvbnMucHVzaChlbGVtZW50Lm9wZW5BY3Rpb24pO1xuXHRcdH1cblx0XHRpZiAoZWxlbWVudC5hY3Rpb25zPy5wcmltYXJ5KSB7XG5cdFx0XHRhY3Rpb25zLnB1c2goLi4uZWxlbWVudC5hY3Rpb25zLnByaW1hcnkpO1xuXHRcdH1cblx0XHR0ZW1wbGF0ZURhdGEuYWN0aW9uQmFyLnNldEFjdGlvbnMoYWN0aW9ucyk7XG5cdH1cbn1cblxuY2xhc3MgUHJvZmlsZVJlc291cmNlQ2hpbGRUcmVlSXRlbVJlbmRlcmVyIGV4dGVuZHMgQWJzdHJhY3RQcm9maWxlUmVzb3VyY2VUcmVlUmVuZGVyZXIgaW1wbGVtZW50cyBJVHJlZVJlbmRlcmVyPFByb2ZpbGVDb250ZW50VHJlZUVsZW1lbnQsIHZvaWQsIElQcm9maWxlUmVzb3VyY2VDaGlsZFRyZWVJdGVtVGVtcGxhdGVEYXRhPiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IFRFTVBMQVRFX0lEID0gJ1Byb2ZpbGVSZXNvdXJjZUNoaWxkVHJlZUl0ZW1UZW1wbGF0ZSc7XG5cblx0cmVhZG9ubHkgdGVtcGxhdGVJZCA9IFByb2ZpbGVSZXNvdXJjZUNoaWxkVHJlZUl0ZW1SZW5kZXJlci5URU1QTEFURV9JRDtcblx0cHJpdmF0ZSByZWFkb25seSBsYWJlbHM6IFJlc291cmNlTGFiZWxzO1xuXHRwcml2YXRlIHJlYWRvbmx5IGhvdmVyRGVsZWdhdGU6IElIb3ZlckRlbGVnYXRlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMubGFiZWxzID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUmVzb3VyY2VMYWJlbHMsIERFRkFVTFRfTEFCRUxTX0NPTlRBSU5FUik7XG5cdFx0dGhpcy5ob3ZlckRlbGVnYXRlID0gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya2JlbmNoSG92ZXJEZWxlZ2F0ZSwgJ21vdXNlJywgdW5kZWZpbmVkLCB7fSkpO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUocGFyZW50OiBIVE1MRWxlbWVudCk6IElQcm9maWxlUmVzb3VyY2VDaGlsZFRyZWVJdGVtVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBjb250YWluZXIgPSBhcHBlbmQocGFyZW50LCAkKCcucHJvZmlsZS10cmVlLWl0ZW0tY29udGFpbmVyLnByb2ZpbGUtcmVzb3VyY2UtY2hpbGQtY29udGFpbmVyJykpO1xuXHRcdGNvbnN0IGNoZWNrYm94ID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBDaGVja2JveCgnJywgZmFsc2UsIGRlZmF1bHRDaGVja2JveFN0eWxlcykpO1xuXHRcdGFwcGVuZChjb250YWluZXIsIGNoZWNrYm94LmRvbU5vZGUpO1xuXHRcdGNvbnN0IHJlc291cmNlTGFiZWwgPSBkaXNwb3NhYmxlcy5hZGQodGhpcy5sYWJlbHMuY3JlYXRlKGNvbnRhaW5lciwgeyBob3ZlckRlbGVnYXRlOiB0aGlzLmhvdmVyRGVsZWdhdGUgfSkpO1xuXG5cdFx0Y29uc3QgYWN0aW9uc0NvbnRhaW5lciA9IGFwcGVuZChjb250YWluZXIsICQoJy5wcm9maWxlLXJlc291cmNlLWFjdGlvbnMtY29udGFpbmVyJykpO1xuXHRcdGNvbnN0IGFjdGlvbkJhciA9IGRpc3Bvc2FibGVzLmFkZCh0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdvcmtiZW5jaFRvb2xCYXIsXG5cdFx0XHRhY3Rpb25zQ29udGFpbmVyLFxuXHRcdFx0e1xuXHRcdFx0XHRob3ZlckRlbGVnYXRlOiBkaXNwb3NhYmxlcy5hZGQoY3JlYXRlSW5zdGFudEhvdmVyRGVsZWdhdGUoKSksXG5cdFx0XHRcdGhpZ2hsaWdodFRvZ2dsZWRJdGVtczogdHJ1ZVxuXHRcdFx0fVxuXHRcdCkpO1xuXG5cdFx0cmV0dXJuIHsgY2hlY2tib3gsIHJlc291cmNlTGFiZWwsIGFjdGlvbkJhciwgZGlzcG9zYWJsZXMsIGVsZW1lbnREaXNwb3NhYmxlczogZGlzcG9zYWJsZXMuYWRkKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSkgfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoeyBlbGVtZW50OiBwcm9maWxlUmVzb3VyY2VUcmVlRWxlbWVudCB9OiBJVHJlZU5vZGU8UHJvZmlsZUNvbnRlbnRUcmVlRWxlbWVudCwgdm9pZD4sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSVByb2ZpbGVSZXNvdXJjZUNoaWxkVHJlZUl0ZW1UZW1wbGF0ZURhdGEsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnREaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdGNvbnN0IHsgZWxlbWVudCB9ID0gcHJvZmlsZVJlc291cmNlVHJlZUVsZW1lbnQ7XG5cblx0XHRpZiAoaXNTdHJpbmcoZWxlbWVudCkgfHwgIWlzUHJvZmlsZVJlc291cmNlQ2hpbGRFbGVtZW50KGVsZW1lbnQpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0ludmFsaWQgcHJvZmlsZSByZXNvdXJjZSBlbGVtZW50Jyk7XG5cdFx0fVxuXG5cdFx0aWYgKGVsZW1lbnQuY2hlY2tib3gpIHtcblx0XHRcdHRlbXBsYXRlRGF0YS5jaGVja2JveC5kb21Ob2RlLnNldEF0dHJpYnV0ZSgndGFiaW5kZXgnLCAnMCcpO1xuXHRcdFx0dGVtcGxhdGVEYXRhLmNoZWNrYm94LmRvbU5vZGUuY2xhc3NMaXN0LnJlbW92ZSgnaGlkZScpO1xuXHRcdFx0dGVtcGxhdGVEYXRhLmNoZWNrYm94LmNoZWNrZWQgPSBlbGVtZW50LmNoZWNrYm94LmlzQ2hlY2tlZDtcblx0XHRcdHRlbXBsYXRlRGF0YS5jaGVja2JveC5kb21Ob2RlLmFyaWFMYWJlbCA9IGVsZW1lbnQuY2hlY2tib3guYWNjZXNzaWJpbGl0eUluZm9ybWF0aW9uPy5sYWJlbCA/PyAnJztcblx0XHRcdGlmIChlbGVtZW50LmNoZWNrYm94LmFjY2Vzc2liaWxpdHlJbmZvcm1hdGlvbj8ucm9sZSkge1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEuY2hlY2tib3guZG9tTm9kZS5yb2xlID0gZWxlbWVudC5jaGVja2JveC5hY2Nlc3NpYmlsaXR5SW5mb3JtYXRpb24ucm9sZTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGVtcGxhdGVEYXRhLmNoZWNrYm94LmRvbU5vZGUucmVtb3ZlQXR0cmlidXRlKCd0YWJpbmRleCcpO1xuXHRcdFx0dGVtcGxhdGVEYXRhLmNoZWNrYm94LmRvbU5vZGUuY2xhc3NMaXN0LmFkZCgnaGlkZScpO1xuXHRcdH1cblxuXHRcdHRlbXBsYXRlRGF0YS5yZXNvdXJjZUxhYmVsLnNldFJlc291cmNlKFxuXHRcdFx0e1xuXHRcdFx0XHRuYW1lOiBlbGVtZW50LnJlc291cmNlID8gYmFzZW5hbWUoZWxlbWVudC5yZXNvdXJjZSkgOiBlbGVtZW50LmxhYmVsLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogZWxlbWVudC5kZXNjcmlwdGlvbixcblx0XHRcdFx0cmVzb3VyY2U6IGVsZW1lbnQucmVzb3VyY2Vcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGZvcmNlTGFiZWw6IHRydWUsXG5cdFx0XHRcdGljb246IGVsZW1lbnQuaWNvbixcblx0XHRcdFx0aGlkZUljb246ICFlbGVtZW50LnJlc291cmNlICYmICFlbGVtZW50Lmljb24sXG5cdFx0XHR9KTtcblx0XHRjb25zdCBhY3Rpb25zOiBJQWN0aW9uW10gPSBbXTtcblx0XHRpZiAoZWxlbWVudC5vcGVuQWN0aW9uKSB7XG5cdFx0XHRhY3Rpb25zLnB1c2goZWxlbWVudC5vcGVuQWN0aW9uKTtcblx0XHR9XG5cdFx0aWYgKGVsZW1lbnQuYWN0aW9ucz8ucHJpbWFyeSkge1xuXHRcdFx0YWN0aW9ucy5wdXNoKC4uLmVsZW1lbnQuYWN0aW9ucy5wcmltYXJ5KTtcblx0XHR9XG5cdFx0dGVtcGxhdGVEYXRhLmFjdGlvbkJhci5zZXRBY3Rpb25zKGFjdGlvbnMpO1xuXHR9XG5cbn1cblxuY2xhc3MgV29ya3NwYWNlVXJpRW1wdHlDb2x1bW5SZW5kZXJlciBpbXBsZW1lbnRzIElUYWJsZVJlbmRlcmVyPFdvcmtzcGFjZVRhYmxlRWxlbWVudCwge30+IHtcblx0c3RhdGljIHJlYWRvbmx5IFRFTVBMQVRFX0lEID0gJ2VtcHR5JztcblxuXHRyZWFkb25seSB0ZW1wbGF0ZUlkOiBzdHJpbmcgPSBXb3Jrc3BhY2VVcmlFbXB0eUNvbHVtblJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiB7fSB7XG5cdFx0cmV0dXJuIHt9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChpdGVtOiBXb3Jrc3BhY2VUYWJsZUVsZW1lbnQsIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YToge30sIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUoKTogdm9pZCB7XG5cdH1cblxufVxuXG5pbnRlcmZhY2UgSVdvcmtzcGFjZVVyaUhvc3RDb2x1bW5UZW1wbGF0ZURhdGEge1xuXHRlbGVtZW50OiBIVE1MRWxlbWVudDtcblx0aG9zdENvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdGJ1dHRvbkJhckNvbnRhaW5lcjogSFRNTEVsZW1lbnQ7XG5cdGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdHJlbmRlckRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG59XG5cbmNsYXNzIFdvcmtzcGFjZVVyaUhvc3RDb2x1bW5SZW5kZXJlciBpbXBsZW1lbnRzIElUYWJsZVJlbmRlcmVyPFdvcmtzcGFjZVRhYmxlRWxlbWVudCwgSVdvcmtzcGFjZVVyaUhvc3RDb2x1bW5UZW1wbGF0ZURhdGE+IHtcblx0c3RhdGljIHJlYWRvbmx5IFRFTVBMQVRFX0lEID0gJ2hvc3QnO1xuXG5cdHJlYWRvbmx5IHRlbXBsYXRlSWQ6IHN0cmluZyA9IFdvcmtzcGFjZVVyaUhvc3RDb2x1bW5SZW5kZXJlci5URU1QTEFURV9JRDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0KSB7IH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSVdvcmtzcGFjZVVyaUhvc3RDb2x1bW5UZW1wbGF0ZURhdGEge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IHJlbmRlckRpc3Bvc2FibGVzID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0XHRjb25zdCBlbGVtZW50ID0gY29udGFpbmVyLmFwcGVuZENoaWxkKCQoJy5ob3N0JykpO1xuXHRcdGNvbnN0IGhvc3RDb250YWluZXIgPSBlbGVtZW50LmFwcGVuZENoaWxkKCQoJ2Rpdi5ob3N0LWxhYmVsJykpO1xuXHRcdGNvbnN0IGJ1dHRvbkJhckNvbnRhaW5lciA9IGVsZW1lbnQuYXBwZW5kQ2hpbGQoJCgnZGl2LmJ1dHRvbi1iYXInKSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZWxlbWVudCxcblx0XHRcdGhvc3RDb250YWluZXIsXG5cdFx0XHRidXR0b25CYXJDb250YWluZXIsXG5cdFx0XHRkaXNwb3NhYmxlcyxcblx0XHRcdHJlbmRlckRpc3Bvc2FibGVzXG5cdFx0fTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoaXRlbTogV29ya3NwYWNlVGFibGVFbGVtZW50LCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElXb3Jrc3BhY2VVcmlIb3N0Q29sdW1uVGVtcGxhdGVEYXRhLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5yZW5kZXJEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdHRlbXBsYXRlRGF0YS5yZW5kZXJEaXNwb3NhYmxlcy5hZGQoeyBkaXNwb3NlOiAoKSA9PiB7IGNsZWFyTm9kZSh0ZW1wbGF0ZURhdGEuYnV0dG9uQmFyQ29udGFpbmVyKTsgfSB9KTtcblxuXHRcdHRlbXBsYXRlRGF0YS5ob3N0Q29udGFpbmVyLmlubmVyVGV4dCA9IGdldEhvc3RMYWJlbCh0aGlzLmxhYmVsU2VydmljZSwgaXRlbS53b3Jrc3BhY2UpO1xuXHRcdHRlbXBsYXRlRGF0YS5lbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ2N1cnJlbnQtd29ya3NwYWNlJywgdGhpcy51cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoaXRlbS53b3Jrc3BhY2UsIGl0ZW0ucHJvZmlsZUVsZW1lbnQuZ2V0Q3VycmVudFdvcmtzcGFjZSgpKSk7XG5cblx0XHR0ZW1wbGF0ZURhdGEuaG9zdENvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJyc7XG5cdFx0dGVtcGxhdGVEYXRhLmJ1dHRvbkJhckNvbnRhaW5lci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSVdvcmtzcGFjZVVyaUhvc3RDb2x1bW5UZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG5cbn1cblxuaW50ZXJmYWNlIElXb3Jrc3BhY2VVcmlQYXRoQ29sdW1uVGVtcGxhdGVEYXRhIHtcblx0ZWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdHBhdGhMYWJlbDogSFRNTEVsZW1lbnQ7XG5cdHBhdGhIb3ZlcjogSU1hbmFnZWRIb3Zlcjtcblx0cmVuZGVyRGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0ZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcbn1cblxuY2xhc3MgV29ya3NwYWNlVXJpUGF0aENvbHVtblJlbmRlcmVyIGltcGxlbWVudHMgSVRhYmxlUmVuZGVyZXI8V29ya3NwYWNlVGFibGVFbGVtZW50LCBJV29ya3NwYWNlVXJpUGF0aENvbHVtblRlbXBsYXRlRGF0YT4ge1xuXHRzdGF0aWMgcmVhZG9ubHkgVEVNUExBVEVfSUQgPSAncGF0aCc7XG5cblx0cmVhZG9ubHkgdGVtcGxhdGVJZDogc3RyaW5nID0gV29ya3NwYWNlVXJpUGF0aENvbHVtblJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgaG92ZXJEZWxlZ2F0ZTogSUhvdmVyRGVsZWdhdGU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElIb3ZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3ZlclNlcnZpY2U6IElIb3ZlclNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuaG92ZXJEZWxlZ2F0ZSA9IGdldERlZmF1bHRIb3ZlckRlbGVnYXRlKCdtb3VzZScpO1xuXHR9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElXb3Jrc3BhY2VVcmlQYXRoQ29sdW1uVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBlbGVtZW50ID0gY29udGFpbmVyLmFwcGVuZENoaWxkKCQoJy5wYXRoJykpO1xuXHRcdGNvbnN0IHBhdGhMYWJlbCA9IGVsZW1lbnQuYXBwZW5kQ2hpbGQoJCgnZGl2LnBhdGgtbGFiZWwnKSk7XG5cdFx0Y29uc3QgcGF0aEhvdmVyID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMuaG92ZXJTZXJ2aWNlLnNldHVwTWFuYWdlZEhvdmVyKHRoaXMuaG92ZXJEZWxlZ2F0ZSwgcGF0aExhYmVsLCAnJykpO1xuXHRcdGNvbnN0IHJlbmRlckRpc3Bvc2FibGVzID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBEaXNwb3NhYmxlU3RvcmUoKSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZWxlbWVudCxcblx0XHRcdHBhdGhMYWJlbCxcblx0XHRcdHBhdGhIb3Zlcixcblx0XHRcdGRpc3Bvc2FibGVzLFxuXHRcdFx0cmVuZGVyRGlzcG9zYWJsZXNcblx0XHR9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChpdGVtOiBXb3Jrc3BhY2VUYWJsZUVsZW1lbnQsIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSVdvcmtzcGFjZVVyaVBhdGhDb2x1bW5UZW1wbGF0ZURhdGEsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLnJlbmRlckRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdFx0Y29uc3Qgc3RyaW5nVmFsdWUgPSB0aGlzLmZvcm1hdFBhdGgoaXRlbS53b3Jrc3BhY2UpO1xuXHRcdHRlbXBsYXRlRGF0YS5wYXRoTGFiZWwuaW5uZXJUZXh0ID0gc3RyaW5nVmFsdWU7XG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnY3VycmVudC13b3Jrc3BhY2UnLCB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaXNFcXVhbChpdGVtLndvcmtzcGFjZSwgaXRlbS5wcm9maWxlRWxlbWVudC5nZXRDdXJyZW50V29ya3NwYWNlKCkpKTtcblx0XHR0ZW1wbGF0ZURhdGEucGF0aEhvdmVyLnVwZGF0ZShzdHJpbmdWYWx1ZSk7XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJV29ya3NwYWNlVXJpUGF0aENvbHVtblRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGVtcGxhdGVEYXRhLnJlbmRlckRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHByaXZhdGUgZm9ybWF0UGF0aCh1cmk6IFVSSSk6IHN0cmluZyB7XG5cdFx0aWYgKHVyaS5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0cmV0dXJuIG5vcm1hbGl6ZURyaXZlTGV0dGVyKHVyaS5mc1BhdGgpO1xuXHRcdH1cblxuXHRcdC8vIElmIHRoZSBwYXRoIGlzIG5vdCBhIGZpbGUgdXJpLCBidXQgcG9pbnRzIHRvIGEgd2luZG93cyByZW1vdGUsIHdlIHNob3VsZCBjcmVhdGUgd2luZG93cyBmcyBwYXRoXG5cdFx0Ly8gZS5nLiAvYzovdXNlci9kaXJlY3RvcnkgPT4gQzpcXHVzZXJcXGRpcmVjdG9yeVxuXHRcdGlmICh1cmkucGF0aC5zdGFydHNXaXRoKHBvc2l4LnNlcCkpIHtcblx0XHRcdGNvbnN0IHBhdGhXaXRob3V0TGVhZGluZ1NlcGFyYXRvciA9IHVyaS5wYXRoLnN1YnN0cmluZygxKTtcblx0XHRcdGNvbnN0IGlzV2luZG93c1BhdGggPSBoYXNEcml2ZUxldHRlcihwYXRoV2l0aG91dExlYWRpbmdTZXBhcmF0b3IsIHRydWUpO1xuXHRcdFx0aWYgKGlzV2luZG93c1BhdGgpIHtcblx0XHRcdFx0cmV0dXJuIG5vcm1hbGl6ZURyaXZlTGV0dGVyKHdpbjMyLm5vcm1hbGl6ZShwYXRoV2l0aG91dExlYWRpbmdTZXBhcmF0b3IpLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdXJpLnBhdGg7XG5cdH1cblxufVxuXG5pbnRlcmZhY2UgSUFjdGlvbnNDb2x1bW5UZW1wbGF0ZURhdGEge1xuXHRyZWFkb25seSBhY3Rpb25CYXI6IEFjdGlvbkJhcjtcblx0cmVhZG9ubHkgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcbn1cblxuY2xhc3MgQ2hhbmdlUHJvZmlsZUFjdGlvbiBleHRlbmRzIEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBpdGVtOiBXb3Jrc3BhY2VUYWJsZUVsZW1lbnQsXG5cdFx0QElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCdjaGFuZ2VQcm9maWxlJywgJycsIFRoZW1lSWNvbi5hc0NsYXNzTmFtZShlZGl0SWNvbikpO1xuXHRcdHRoaXMudG9vbHRpcCA9IGxvY2FsaXplKCdjaGFuZ2UgcHJvZmlsZScsIFwiQ2hhbmdlIFByb2ZpbGVcIik7XG5cdH1cblxuXHRnZXRTd2l0Y2hQcm9maWxlQWN0aW9ucygpOiBJQWN0aW9uW10ge1xuXHRcdHJldHVybiB0aGlzLnVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLnByb2ZpbGVzXG5cdFx0XHQuZmlsdGVyKHByb2ZpbGUgPT4gIXByb2ZpbGUuaXNUcmFuc2llbnQpXG5cdFx0XHQuc29ydCgoYSwgYikgPT4gYS5pc0RlZmF1bHQgPyAtMSA6IGIuaXNEZWZhdWx0ID8gMSA6IGEubmFtZS5sb2NhbGVDb21wYXJlKGIubmFtZSkpXG5cdFx0XHQubWFwPElBY3Rpb24+KHByb2ZpbGUgPT4gKHtcblx0XHRcdFx0aWQ6IGBzd2l0Y2hQcm9maWxlVG8ke3Byb2ZpbGUuaWR9YCxcblx0XHRcdFx0bGFiZWw6IHByb2ZpbGUubmFtZSxcblx0XHRcdFx0Y2xhc3M6IHVuZGVmaW5lZCxcblx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0Y2hlY2tlZDogcHJvZmlsZS5pZCA9PT0gdGhpcy5pdGVtLnByb2ZpbGVFbGVtZW50LnByb2ZpbGUuaWQsXG5cdFx0XHRcdHRvb2x0aXA6ICcnLFxuXHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHRpZiAocHJvZmlsZS5pZCA9PT0gdGhpcy5pdGVtLnByb2ZpbGVFbGVtZW50LnByb2ZpbGUuaWQpIHtcblx0XHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dGhpcy51c2VyRGF0YVByb2ZpbGVzU2VydmljZS51cGRhdGVQcm9maWxlKHByb2ZpbGUsIHsgd29ya3NwYWNlczogWy4uLihwcm9maWxlLndvcmtzcGFjZXMgPz8gW10pLCB0aGlzLml0ZW0ud29ya3NwYWNlXSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHR9XG59XG5cbmNsYXNzIFdvcmtzcGFjZVVyaUFjdGlvbnNDb2x1bW5SZW5kZXJlciBpbXBsZW1lbnRzIElUYWJsZVJlbmRlcmVyPFdvcmtzcGFjZVRhYmxlRWxlbWVudCwgSUFjdGlvbnNDb2x1bW5UZW1wbGF0ZURhdGE+IHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgVEVNUExBVEVfSUQgPSAnYWN0aW9ucyc7XG5cblx0cmVhZG9ubHkgdGVtcGxhdGVJZDogc3RyaW5nID0gV29ya3NwYWNlVXJpQWN0aW9uc0NvbHVtblJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVzU2VydmljZTogSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlTWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVByb2ZpbGVNYW5hZ2VtZW50U2VydmljZTogSVVzZXJEYXRhUHJvZmlsZU1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdXJpSWRlbnRpdHlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHQpIHtcblx0fVxuXG5cdHJlbmRlclRlbXBsYXRlKGNvbnRhaW5lcjogSFRNTEVsZW1lbnQpOiBJQWN0aW9uc0NvbHVtblRlbXBsYXRlRGF0YSB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgZWxlbWVudCA9IGNvbnRhaW5lci5hcHBlbmRDaGlsZCgkKCcucHJvZmlsZS13b3Jrc3BhY2VzLWFjdGlvbnMtY29udGFpbmVyJykpO1xuXHRcdGNvbnN0IGhvdmVyRGVsZWdhdGUgPSBkaXNwb3NhYmxlcy5hZGQoY3JlYXRlSW5zdGFudEhvdmVyRGVsZWdhdGUoKSk7XG5cdFx0Y29uc3QgYWN0aW9uQmFyID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBBY3Rpb25CYXIoZWxlbWVudCwge1xuXHRcdFx0aG92ZXJEZWxlZ2F0ZSxcblx0XHRcdGFjdGlvblZpZXdJdGVtUHJvdmlkZXI6IChhY3Rpb24pID0+IHtcblx0XHRcdFx0aWYgKGFjdGlvbiBpbnN0YW5jZW9mIENoYW5nZVByb2ZpbGVBY3Rpb24pIHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IERyb3Bkb3duTWVudUFjdGlvblZpZXdJdGVtKGFjdGlvbiwgeyBnZXRBY3Rpb25zOiAoKSA9PiBhY3Rpb24uZ2V0U3dpdGNoUHJvZmlsZUFjdGlvbnMoKSB9LCB0aGlzLmNvbnRleHRNZW51U2VydmljZSwge1xuXHRcdFx0XHRcdFx0Y2xhc3NOYW1lczogYWN0aW9uLmNsYXNzLFxuXHRcdFx0XHRcdFx0aG92ZXJEZWxlZ2F0ZSxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRyZXR1cm4geyBhY3Rpb25CYXIsIGRpc3Bvc2FibGVzIH07XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGl0ZW06IFdvcmtzcGFjZVRhYmxlRWxlbWVudCwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJQWN0aW9uc0NvbHVtblRlbXBsYXRlRGF0YSwgaGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuYWN0aW9uQmFyLmNsZWFyKCk7XG5cdFx0Y29uc3QgYWN0aW9uczogSUFjdGlvbltdID0gW107XG5cdFx0YWN0aW9ucy5wdXNoKHRoaXMuY3JlYXRlT3BlbkFjdGlvbihpdGVtKSk7XG5cdFx0YWN0aW9ucy5wdXNoKG5ldyBDaGFuZ2VQcm9maWxlQWN0aW9uKGl0ZW0sIHRoaXMudXNlckRhdGFQcm9maWxlc1NlcnZpY2UpKTtcblx0XHRhY3Rpb25zLnB1c2godGhpcy5jcmVhdGVEZWxldGVBY3Rpb24oaXRlbSkpO1xuXHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25CYXIucHVzaChhY3Rpb25zLCB7IGljb246IHRydWUgfSk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZU9wZW5BY3Rpb24oaXRlbTogV29ya3NwYWNlVGFibGVFbGVtZW50KTogSUFjdGlvbiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGxhYmVsOiAnJyxcblx0XHRcdGNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoQ29kaWNvbi53aW5kb3cpLFxuXHRcdFx0ZW5hYmxlZDogIXRoaXMudXJpSWRlbnRpdHlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsKGl0ZW0ud29ya3NwYWNlLCBpdGVtLnByb2ZpbGVFbGVtZW50LmdldEN1cnJlbnRXb3Jrc3BhY2UoKSksXG5cdFx0XHRpZDogJ29wZW5Xb3Jrc3BhY2UnLFxuXHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ29wZW4nLCBcIk9wZW4gaW4gTmV3IFdpbmRvd1wiKSxcblx0XHRcdHJ1bjogKCkgPT4gaXRlbS5wcm9maWxlRWxlbWVudC5vcGVuV29ya3NwYWNlKGl0ZW0ud29ya3NwYWNlKVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZURlbGV0ZUFjdGlvbihpdGVtOiBXb3Jrc3BhY2VUYWJsZUVsZW1lbnQpOiBJQWN0aW9uIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bGFiZWw6ICcnLFxuXHRcdFx0Y2xhc3M6IFRoZW1lSWNvbi5hc0NsYXNzTmFtZShyZW1vdmVJY29uKSxcblx0XHRcdGVuYWJsZWQ6IHRoaXMudXNlckRhdGFQcm9maWxlTWFuYWdlbWVudFNlcnZpY2UuZ2V0RGVmYXVsdFByb2ZpbGVUb1VzZSgpLmlkICE9PSBpdGVtLnByb2ZpbGVFbGVtZW50LnByb2ZpbGUuaWQsXG5cdFx0XHRpZDogJ2RlbGV0ZVRydXN0ZWRVcmknLFxuXHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ2RlbGV0ZVRydXN0ZWRVcmknLCBcIkRlbGV0ZSBQYXRoXCIpLFxuXHRcdFx0cnVuOiAoKSA9PiBpdGVtLnByb2ZpbGVFbGVtZW50LnVwZGF0ZVdvcmtzcGFjZXMoW10sIFtpdGVtLndvcmtzcGFjZV0pXG5cdFx0fTtcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElBY3Rpb25zQ29sdW1uVGVtcGxhdGVEYXRhKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLmRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxuXG59XG5cbmZ1bmN0aW9uIGdldEhvc3RMYWJlbChsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsIHdvcmtzcGFjZVVyaTogVVJJKTogc3RyaW5nIHtcblx0cmV0dXJuIHdvcmtzcGFjZVVyaS5hdXRob3JpdHkgPyBsYWJlbFNlcnZpY2UuZ2V0SG9zdExhYmVsKHdvcmtzcGFjZVVyaS5zY2hlbWUsIHdvcmtzcGFjZVVyaS5hdXRob3JpdHkpIDogbG9jYWxpemUoJ2xvY2FsQXV0aG9yaXR5JywgXCJMb2NhbFwiKTtcbn1cblxuZXhwb3J0IGNsYXNzIFVzZXJEYXRhUHJvZmlsZXNFZGl0b3JJbnB1dCBleHRlbmRzIEVkaXRvcklucHV0IHtcblx0c3RhdGljIHJlYWRvbmx5IElEOiBzdHJpbmcgPSAnd29ya2JlbmNoLmlucHV0LnVzZXJEYXRhUHJvZmlsZXMnO1xuXHRyZWFkb25seSByZXNvdXJjZSA9IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IG1vZGVsOiBVc2VyRGF0YVByb2ZpbGVzRWRpdG9yTW9kZWw7XG5cblx0cHJpdmF0ZSBfZGlydHk6IGJvb2xlYW4gPSBmYWxzZTtcblx0Z2V0IGRpcnR5KCk6IGJvb2xlYW4geyByZXR1cm4gdGhpcy5fZGlydHk7IH1cblx0c2V0IGRpcnR5KGRpcnR5OiBib29sZWFuKSB7XG5cdFx0aWYgKHRoaXMuX2RpcnR5ICE9PSBkaXJ0eSkge1xuXHRcdFx0dGhpcy5fZGlydHkgPSBkaXJ0eTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRGlydHkuZmlyZSgpO1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMubW9kZWwgPSBVc2VyRGF0YVByb2ZpbGVzRWRpdG9yTW9kZWwuZ2V0SW5zdGFuY2UodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5tb2RlbC5vbkRpZENoYW5nZShlID0+IHRoaXMuZGlydHkgPSB0aGlzLm1vZGVsLnByb2ZpbGVzLnNvbWUocHJvZmlsZSA9PiBwcm9maWxlIGluc3RhbmNlb2YgTmV3UHJvZmlsZUVsZW1lbnQpKSk7XG5cdH1cblxuXHRvdmVycmlkZSBnZXQgdHlwZUlkKCk6IHN0cmluZyB7IHJldHVybiBVc2VyRGF0YVByb2ZpbGVzRWRpdG9ySW5wdXQuSUQ7IH1cblx0b3ZlcnJpZGUgZ2V0TmFtZSgpOiBzdHJpbmcgeyByZXR1cm4gbG9jYWxpemUoJ3VzZXJEYXRhUHJvZmlsZXMnLCBcIlByb2ZpbGVzXCIpOyB9XG5cdG92ZXJyaWRlIGdldEljb24oKTogVGhlbWVJY29uIHwgdW5kZWZpbmVkIHsgcmV0dXJuIGRlZmF1bHRVc2VyRGF0YVByb2ZpbGVJY29uOyB9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcmVzb2x2ZSgpOiBQcm9taXNlPFVzZXJEYXRhUHJvZmlsZXNFZGl0b3JNb2RlbD4ge1xuXHRcdGF3YWl0IHRoaXMubW9kZWwucmVzb2x2ZSgpO1xuXHRcdHJldHVybiB0aGlzLm1vZGVsO1xuXHR9XG5cblx0b3ZlcnJpZGUgaXNEaXJ0eSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5kaXJ0eTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHNhdmUoKTogUHJvbWlzZTxFZGl0b3JJbnB1dD4ge1xuXHRcdGF3YWl0IHRoaXMubW9kZWwuc2F2ZU5ld1Byb2ZpbGUoKTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJldmVydCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLm1vZGVsLnJldmVydCgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgbWF0Y2hlcyhvdGhlcklucHV0OiBFZGl0b3JJbnB1dCB8IElVbnR5cGVkRWRpdG9ySW5wdXQpOiBib29sZWFuIHsgcmV0dXJuIG90aGVySW5wdXQgaW5zdGFuY2VvZiBVc2VyRGF0YVByb2ZpbGVzRWRpdG9ySW5wdXQ7IH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGZvciAoY29uc3QgcHJvZmlsZSBvZiB0aGlzLm1vZGVsLnByb2ZpbGVzKSB7XG5cdFx0XHRpZiAocHJvZmlsZSBpbnN0YW5jZW9mIFVzZXJEYXRhUHJvZmlsZUVsZW1lbnQpIHtcblx0XHRcdFx0cHJvZmlsZS5yZXNldCgpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFVzZXJEYXRhUHJvZmlsZXNFZGl0b3JJbnB1dFNlcmlhbGl6ZXIgaW1wbGVtZW50cyBJRWRpdG9yU2VyaWFsaXplciB7XG5cdGNhblNlcmlhbGl6ZShlZGl0b3JJbnB1dDogRWRpdG9ySW5wdXQpOiBib29sZWFuIHsgcmV0dXJuIHRydWU7IH1cblx0c2VyaWFsaXplKGVkaXRvcklucHV0OiBFZGl0b3JJbnB1dCk6IHN0cmluZyB7IHJldHVybiAnJzsgfVxuXHRkZXNlcmlhbGl6ZShpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlKTogRWRpdG9ySW5wdXQgeyByZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVXNlckRhdGFQcm9maWxlc0VkaXRvcklucHV0KTsgfVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsU0FBUyxHQUFHLHVCQUF1QixRQUFRLFdBQVcsV0FBVyxhQUFhLFdBQXlCLGtCQUFrQjtBQUN6SCxTQUFTLFFBQXFDLFdBQVcsZUFBZSxnQkFBZ0I7QUFDeEYsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxxQkFBcUIsMkJBQTJCO0FBQ3pELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMscUJBQXFCO0FBQzlCLFNBQTJCLDBCQUEwQiwyQkFBMkI7QUFDaEYsU0FBUyxrQkFBa0I7QUFFM0IsU0FBUyxtQkFBbUI7QUFHNUIsU0FBUyw0QkFBa0QsbUNBQW1DLHlCQUF5QixzQkFBc0I7QUFDN0ksU0FBUyxhQUFhLFFBQVEsaUJBQWlCO0FBQy9DLFNBQVMsUUFBUSxXQUFXLDBCQUEwQjtBQUN0RCxTQUFTLHFCQUFxQix1QkFBdUIsdUJBQXVCLHdCQUF3QixrQkFBa0IscUJBQXFCO0FBQzNJLFNBQVMsa0JBQWtCLFlBQVkscUJBQXFCO0FBQzVELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsd0JBQXdCLGVBQWUsc0JBQXNCO0FBQ3RFLFNBQVMsaUNBQXNFO0FBSS9FLFNBQVMsWUFBWSxpQkFBOEIsbUJBQW1CLG9CQUFvQjtBQUMxRixTQUFTLFVBQVUsbUJBQW1CO0FBQ3RDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsY0FBYyxhQUFhO0FBQ3BDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZUFBZTtBQUN4QixTQUFTLGVBQWUsOEJBQThCO0FBQ3RELFNBQVMscUJBQXFCO0FBRTlCLFNBQTRCLGlCQUFpQjtBQUM3QyxTQUFTLFdBQVc7QUFDcEIsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxVQUFVLG1CQUFtQjtBQUN0QyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDBCQUEwQyxzQkFBc0I7QUFFekUsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywwQkFBMEM7QUFDbkQsU0FBUyxnQ0FBZ0MsK0JBQStCLDhCQUFtSCxtQkFBbUIsd0JBQXdCLG1DQUFtQztBQUN6USxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDRCQUE0QiwrQkFBK0I7QUFDcEUsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsYUFBYTtBQUN0QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLCtCQUErQjtBQUN4QyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDJCQUEyQjtBQUVwQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGVBQWU7QUFDeEIsU0FBUyxPQUFPLGFBQWE7QUFDN0IsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxrQ0FBa0M7QUFFM0MsTUFBTSxXQUFXLGFBQWEsK0JBQStCLFFBQVEsTUFBTSxTQUFTLFlBQVksdURBQXVELENBQUM7QUFDeEosTUFBTSxhQUFhLGFBQWEsaUNBQWlDLFFBQVEsT0FBTyxTQUFTLGNBQWMseURBQXlELENBQUM7QUFFMUosTUFBTSxxQkFBcUIsY0FBYyx1QkFBdUIsY0FBYyxTQUFTLHNCQUFzQix5REFBeUQsQ0FBQztBQUU5SyxNQUFNLGFBQWEsY0FBYztBQUFBLEVBQ2hDLCtCQUErQjtBQUFBLEVBQy9CLCtCQUErQjtBQUFBLEVBQy9CLGlDQUFpQztBQUFBLEVBQ2pDLGlDQUFpQztBQUFBLEVBQ2pDLHFCQUFxQjtBQUFBLEVBQ3JCLHFCQUFxQjtBQUFBLEVBQ3JCLHFCQUFxQjtBQUFBLEVBQ3JCLHFCQUFxQjtBQUFBLEVBQ3JCLGtCQUFrQjtBQUFBLEVBQ2xCLGtCQUFrQjtBQUFBLEVBQ2xCLGlDQUFpQztBQUFBLEVBQ2pDLGlDQUFpQztBQUFBLEVBQ2pDLDZCQUE2QjtBQUFBLEVBQzdCLDBCQUEwQjtBQUFBLEVBQzFCLHdCQUF3QjtBQUFBLEVBQ3hCLGdDQUFnQztBQUFBLEVBQ2hDLDZCQUE2QjtBQUM5QixDQUFDO0FBRU0sSUFBTSx5QkFBTixjQUFxQyxXQUE4QztBQUFBLEVBWXpGLFlBQ0MsT0FDbUIsa0JBQ0osY0FDRSxnQkFDb0IsbUJBQ0EsbUJBQ0Msb0JBQ0Usc0JBQ3ZDO0FBQ0QsVUFBTSx1QkFBdUIsSUFBSSxPQUFPLGtCQUFrQixjQUFjLGNBQWM7QUFMakQ7QUFDQTtBQUNDO0FBQ0U7QUFWekMsU0FBUSxZQUE2QyxDQUFDO0FBQUEsRUFhdEQ7QUFBQSxFQUVBLE9BQU8sV0FBc0IsVUFBMkM7QUFDdkUsUUFBSSxLQUFLLGFBQWEsS0FBSyxXQUFXO0FBQ3JDLFlBQU0sU0FBUyxVQUFVLFNBQVM7QUFDbEMsV0FBSyxVQUFVLE9BQU8sS0FBSyxXQUFXLGFBQWEsTUFBTTtBQUN6RCxXQUFLLFVBQVUsR0FBRyxNQUFNLFNBQVMsR0FBRyxNQUFNO0FBQUEsSUFDM0M7QUFBQSxFQUNEO0FBQUEsRUFFVSxhQUFhLFFBQTJCO0FBQ2pELFNBQUssWUFBWSxPQUFPLFFBQVEsRUFBRSxrQkFBa0IsQ0FBQztBQUVyRCxVQUFNLGNBQWMsT0FBTyxLQUFLLFdBQVcsRUFBRSxlQUFlLENBQUM7QUFDN0QsVUFBTSxtQkFBbUIsT0FBTyxhQUFhLEVBQUUsb0JBQW9CLENBQUM7QUFFcEUsVUFBTSxlQUFlLE9BQU8sS0FBSyxXQUFXLEVBQUUsZ0JBQWdCLENBQUM7QUFDL0QsVUFBTSxvQkFBb0IsT0FBTyxjQUFjLEVBQUUscUJBQXFCLENBQUM7QUFDdkUsU0FBSyxnQkFBZ0IsS0FBSyxVQUFVLEtBQUsscUJBQXFCLGVBQWUsZUFBZSxpQkFBaUIsQ0FBQztBQUU5RyxTQUFLLFlBQVksSUFBSSxVQUFVLEtBQUssV0FBVztBQUFBLE1BQzlDLGFBQWEsWUFBWTtBQUFBLE1BQ3pCLG9CQUFvQjtBQUFBLElBQ3JCLENBQUM7QUFFRCxTQUFLLGNBQWMsZ0JBQWdCO0FBQ25DLFNBQUssVUFBVSxRQUFRO0FBQUEsTUFDdEIsYUFBYSxNQUFNO0FBQUEsTUFDbkIsU0FBUztBQUFBLE1BQ1QsYUFBYTtBQUFBLE1BQ2IsYUFBYTtBQUFBLE1BQ2IsUUFBUSxDQUFDLE9BQU8sR0FBRyxXQUFXO0FBQzdCLG9CQUFZLE1BQU0sUUFBUSxHQUFHLEtBQUs7QUFDbEMsWUFBSSxVQUFVLEtBQUssY0FBYztBQUNoQyxnQkFBTSxhQUFhLFNBQVMsS0FBOEI7QUFDMUQsZUFBSyxhQUFhLGVBQWUsRUFBRSxNQUFNLFNBQVMsR0FBRyxVQUFVO0FBQy9ELGVBQUssYUFBYSxPQUFPLFlBQVksS0FBSztBQUFBLFFBQzNDO0FBQUEsTUFDRDtBQUFBLElBQ0QsR0FBRyxLQUFLLFFBQVcsSUFBSTtBQUN2QixTQUFLLFVBQVUsUUFBUTtBQUFBLE1BQ3RCLGFBQWEsTUFBTTtBQUFBLE1BQ25CLFNBQVM7QUFBQSxNQUNULGFBQWE7QUFBQSxNQUNiLGFBQWEsT0FBTztBQUFBLE1BQ3BCLFFBQVEsQ0FBQyxPQUFPLEdBQUcsV0FBVztBQUM3QixxQkFBYSxNQUFNLFFBQVEsR0FBRyxLQUFLO0FBQ25DLFlBQUksUUFBUTtBQUNYLGVBQUssZUFBZSxPQUFPLElBQUksVUFBVSxPQUFPLE1BQU0sQ0FBQztBQUFBLFFBQ3hEO0FBQUEsTUFDRDtBQUFBLElBQ0QsR0FBRyxPQUFPLFlBQVksUUFBVyxJQUFJO0FBRXJDLFNBQUssa0JBQWtCO0FBQ3ZCLFNBQUssYUFBYTtBQUFBLEVBQ25CO0FBQUEsRUFFUyxlQUFxQjtBQUM3QixVQUFNLGNBQWMsS0FBSyxNQUFNLFNBQVMsa0JBQWtCO0FBQzFELFNBQUssV0FBVyxNQUFNLEVBQUUsaUJBQWlCLFlBQVksQ0FBQztBQUFBLEVBQ3ZEO0FBQUEsRUFFUSxjQUFjLFFBQTJCO0FBRWhELFNBQUssdUJBQXVCLE9BQU8sUUFBUSxFQUFFLHFCQUFxQixDQUFDLENBQUM7QUFHcEUsVUFBTSxXQUFXLEtBQUsscUJBQXFCLGVBQWUsc0JBQXNCO0FBQ2hGLFVBQU0sV0FBVyxJQUFJLHVCQUF1QjtBQUM1QyxTQUFLLGVBQWUsS0FBSyxVQUFVLEtBQUsscUJBQXFCO0FBQUEsTUFBZTtBQUFBLE1BQStDO0FBQUEsTUFDMUgsT0FBTyxRQUFRLEVBQUUsZ0JBQWdCLENBQUM7QUFBQSxNQUNsQztBQUFBLE1BQ0EsQ0FBQyxRQUFRO0FBQUEsTUFDVDtBQUFBLFFBQ0MsMEJBQTBCO0FBQUEsUUFDMUIsa0JBQWtCO0FBQUEsUUFDbEIscUJBQXFCO0FBQUEsUUFDckIsdUJBQXVCO0FBQUEsVUFDdEIsYUFBYSxnQkFBK0Q7QUFDM0UsbUJBQU8sZ0JBQWdCLFFBQVE7QUFBQSxVQUNoQztBQUFBLFVBQ0EscUJBQTZCO0FBQzVCLG1CQUFPLFNBQVMsWUFBWSxVQUFVO0FBQUEsVUFDdkM7QUFBQSxRQUNEO0FBQUEsUUFDQSxtQkFBbUI7QUFBQSxRQUNuQixrQkFBa0I7QUFBQSxVQUNqQixNQUFNLEdBQUc7QUFDUixnQkFBSSxhQUFhLHdCQUF3QjtBQUN4QyxxQkFBTyxFQUFFLFFBQVE7QUFBQSxZQUNsQjtBQUNBLG1CQUFPLEVBQUU7QUFBQSxVQUNWO0FBQUEsUUFDRDtBQUFBLFFBQ0EseUJBQXlCO0FBQUEsTUFDMUI7QUFBQSxJQUFDLENBQUM7QUFBQSxFQUNKO0FBQUEsRUFFUSx1QkFBdUIsUUFBMkI7QUFDekQsVUFBTSxTQUFTLEtBQUssVUFBVSxJQUFJLG1CQUFtQixRQUFRO0FBQUEsTUFDNUQsU0FBUztBQUFBLFFBQ1IsWUFBWSxNQUFNO0FBQ2pCLGdCQUFNLFVBQXFCLENBQUM7QUFDNUIsY0FBSSxLQUFLLFVBQVUsUUFBUTtBQUMxQixvQkFBUSxLQUFLLElBQUksY0FBYyxpQkFBaUIsU0FBUyxpQkFBaUIsZUFBZSxHQUFHLEtBQUssNkJBQTZCLENBQUMsQ0FBQztBQUNoSSxvQkFBUSxLQUFLLElBQUksVUFBVSxDQUFDO0FBQUEsVUFDN0I7QUFDQSxrQkFBUSxLQUFLLFNBQVM7QUFBQSxZQUNyQixJQUFJO0FBQUEsWUFDSixPQUFPLFNBQVMsaUJBQWlCLG1CQUFtQjtBQUFBLFlBQ3BELEtBQUssTUFBTSxLQUFLLGNBQWM7QUFBQSxVQUMvQixDQUFDLENBQUM7QUFDRixpQkFBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQUEsTUFDQSw0QkFBNEI7QUFBQSxNQUM1QixxQkFBcUIsS0FBSztBQUFBLE1BQzFCLGNBQWM7QUFBQSxNQUNkLEdBQUc7QUFBQSxJQUNKLENBQUMsQ0FBQztBQUNGLFdBQU8sUUFBUSxTQUFTLGNBQWMsYUFBYTtBQUNuRCxTQUFLLFVBQVUsT0FBTyxXQUFXLE9BQUssS0FBSyxpQkFBaUIsQ0FBQyxDQUFDO0FBQUEsRUFDL0Q7QUFBQSxFQUVRLCtCQUEwQztBQUNqRCxXQUFPLEtBQUssVUFBVSxJQUFJLGNBQ3pCLFNBQVM7QUFBQSxNQUNSLElBQUksWUFBWSxTQUFTLEdBQUc7QUFBQSxNQUM1QixPQUFPLFNBQVM7QUFBQSxNQUNoQixLQUFLLE1BQU0sS0FBSyxpQkFBaUIsSUFBSSxNQUFNLFNBQVMsR0FBRyxDQUFDO0FBQUEsSUFDekQsQ0FBQyxDQUFDO0FBQUEsRUFDSjtBQUFBLEVBRVEsb0JBQTBCO0FBQ2pDLFFBQUksS0FBSyxjQUFjO0FBQ3RCLFdBQUssVUFBVSxLQUFLLGFBQWEscUJBQXFCLE9BQUs7QUFDMUQsY0FBTSxDQUFDLE9BQU8sSUFBSSxFQUFFO0FBQ3BCLFlBQUksbUJBQW1CLGdDQUFnQztBQUN0RCxlQUFLLGVBQWUsT0FBTyxPQUFPO0FBQUEsUUFDbkM7QUFBQSxNQUNELENBQUMsQ0FBQztBQUNGLFdBQUssVUFBVSxLQUFLLGFBQWEsY0FBYyxPQUFLO0FBQ25ELGNBQU0sVUFBcUIsQ0FBQztBQUM1QixZQUFJLENBQUMsRUFBRSxTQUFTO0FBQ2Ysa0JBQVEsS0FBSyxHQUFHLEtBQUssMEJBQTBCLENBQUM7QUFBQSxRQUNqRDtBQUNBLFlBQUksRUFBRSxtQkFBbUIsZ0NBQWdDO0FBQ3hELGtCQUFRLEtBQUssR0FBRyxFQUFFLFFBQVEsUUFBUSxDQUFDLENBQUM7QUFBQSxRQUNyQztBQUNBLFlBQUksUUFBUSxRQUFRO0FBQ25CLGVBQUssbUJBQW1CLGdCQUFnQjtBQUFBLFlBQ3ZDLFdBQVcsTUFBTSxFQUFFO0FBQUEsWUFDbkIsWUFBWSxNQUFNO0FBQUEsWUFDbEIsbUJBQW1CLE1BQU0sRUFBRTtBQUFBLFVBQzVCLENBQUM7QUFBQSxRQUNGO0FBQUEsTUFDRCxDQUFDLENBQUM7QUFDRixXQUFLLFVBQVUsS0FBSyxhQUFhLGdCQUFnQixPQUFLO0FBQ3JELFlBQUksQ0FBQyxFQUFFLFNBQVM7QUFDZixlQUFLLGlCQUFpQjtBQUFBLFFBQ3ZCO0FBQUEsTUFDRCxDQUFDLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRDtBQUFBLEVBRVEsNEJBQXVDO0FBQzlDLFVBQU0sVUFBcUIsQ0FBQztBQUM1QixZQUFRLEtBQUssU0FBUztBQUFBLE1BQ3JCLElBQUk7QUFBQSxNQUNKLE9BQU8sU0FBUyxjQUFjLGFBQWE7QUFBQSxNQUMzQyxLQUFLLE1BQU0sS0FBSyxpQkFBaUI7QUFBQSxJQUNsQyxDQUFDLENBQUM7QUFDRixVQUFNLGtCQUFrQixLQUFLLDZCQUE2QjtBQUMxRCxRQUFJLGdCQUFnQixRQUFRO0FBQzNCLGNBQVEsS0FBSyxJQUFJLGNBQWMsaUJBQWlCLFNBQVMscUJBQXFCLDJCQUEyQixHQUFHLGVBQWUsQ0FBQztBQUFBLElBQzdIO0FBQ0EsWUFBUSxLQUFLLElBQUksVUFBVSxDQUFDO0FBQzVCLFlBQVEsS0FBSyxTQUFTO0FBQUEsTUFDckIsSUFBSTtBQUFBLE1BQ0osT0FBTyxTQUFTLGlCQUFpQixtQkFBbUI7QUFBQSxNQUNwRCxLQUFLLE1BQU0sS0FBSyxjQUFjO0FBQUEsSUFDL0IsQ0FBQyxDQUFDO0FBQ0YsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQWMsZ0JBQStCO0FBQzVDLFVBQU0sY0FBYyxJQUFJLGdCQUFnQjtBQUN4QyxVQUFNLFlBQVksWUFBWSxJQUFJLEtBQUssa0JBQWtCLGdCQUFnQixDQUFDO0FBRTFFLFVBQU0sdUJBQXVCLENBQUMsVUFBbUI7QUFDaEQsWUFBTSxpQkFBbUMsQ0FBQztBQUMxQyxVQUFJLE9BQU87QUFDVix1QkFBZSxLQUFLLEVBQUUsT0FBTyxVQUFVLE9BQU8sYUFBYSxTQUFTLG1CQUFtQixpQkFBaUIsRUFBRSxDQUFDO0FBQUEsTUFDNUc7QUFDQSxxQkFBZSxLQUFLLEVBQUUsT0FBTyxTQUFTLG9CQUFvQixnQkFBZ0IsRUFBRSxDQUFDO0FBQzdFLGdCQUFVLFFBQVE7QUFBQSxJQUNuQjtBQUVBLGNBQVUsUUFBUSxTQUFTLG1DQUFtQyxpQ0FBaUM7QUFDL0YsY0FBVSxjQUFjLFNBQVMsOEJBQThCLDhCQUE4QjtBQUM3RixjQUFVLGlCQUFpQjtBQUMzQixnQkFBWSxJQUFJLFVBQVUsaUJBQWlCLG9CQUFvQixDQUFDO0FBQ2hFLHlCQUFxQjtBQUNyQixjQUFVLGVBQWU7QUFDekIsY0FBVSxxQkFBcUI7QUFDL0IsZ0JBQVksSUFBSSxVQUFVLFlBQVksWUFBWTtBQUNqRCxnQkFBVSxLQUFLO0FBQ2YsWUFBTSxlQUFlLFVBQVUsY0FBYyxDQUFDO0FBQzlDLFVBQUksQ0FBQyxjQUFjO0FBQ2xCO0FBQUEsTUFDRDtBQUNBLFlBQU0sTUFBTSxhQUFhLFVBQVUsVUFBVSxRQUFRLElBQUksTUFBTSxVQUFVLEtBQUssSUFBSSxNQUFNLEtBQUssNEJBQTRCO0FBQ3pILFVBQUksS0FBSztBQUNSLGFBQUssaUJBQWlCLEdBQUc7QUFBQSxNQUMxQjtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBQ0YsZ0JBQVksSUFBSSxVQUFVLFVBQVUsTUFBTSxZQUFZLFFBQVEsQ0FBQyxDQUFDO0FBQ2hFLGNBQVUsS0FBSztBQUFBLEVBQ2hCO0FBQUEsRUFFQSxNQUFNLGlCQUFpQixVQUFrRDtBQUN4RSxVQUFNLEtBQUssT0FBTyxpQkFBaUIsUUFBUTtBQUFBLEVBQzVDO0FBQUEsRUFFQSxjQUFjLFNBQWlDO0FBQzlDLFVBQU0sUUFBUSxLQUFLLE9BQU8sU0FBUyxVQUFVLE9BQUssYUFBYSwwQkFBMEIsRUFBRSxRQUFRLE9BQU8sUUFBUSxFQUFFO0FBQ3BILFFBQUksVUFBVSxVQUFhLFNBQVMsR0FBRztBQUN0QyxXQUFLLGNBQWMsYUFBYSxDQUFDLEtBQUssQ0FBQztBQUFBLElBQ3hDO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBYyw4QkFBbUQ7QUFDaEUsVUFBTSxrQkFBa0IsTUFBTSxLQUFLLGtCQUFrQixlQUFlO0FBQUEsTUFDbkUsa0JBQWtCO0FBQUEsTUFDbEIsZ0JBQWdCO0FBQUEsTUFDaEIsZUFBZTtBQUFBLE1BQ2YsU0FBUztBQUFBLE1BQ1QsT0FBTyxTQUFTLHlCQUF5Qiw4QkFBOEI7QUFBQSxJQUN4RSxDQUFDO0FBQ0QsUUFBSSxDQUFDLGlCQUFpQjtBQUNyQixhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQU8sZ0JBQWdCLENBQUM7QUFBQSxFQUN6QjtBQUFBLEVBRUEsTUFBZSxTQUFTLE9BQW9DLFNBQXFDLFNBQTZCLE9BQXlDO0FBQ3RLLFVBQU0sTUFBTSxTQUFTLE9BQU8sU0FBUyxTQUFTLEtBQUs7QUFDbkQsU0FBSyxRQUFRLE1BQU0sTUFBTSxRQUFRO0FBQ2pDLFNBQUssTUFBTSxhQUFhLEVBQUUsS0FBSyxlQUFhO0FBQzNDLFdBQUssWUFBWTtBQUNqQixVQUFJLEtBQUssZUFBZTtBQUN2QixhQUFLLGNBQWMsWUFBWTtBQUFBLE1BQ2hDO0FBQUEsSUFDRCxDQUFDO0FBQ0QsU0FBSyxtQkFBbUI7QUFDeEIsU0FBSyxVQUFVLEtBQUssTUFBTSxZQUFZLGFBQ3JDLEtBQUssbUJBQW1CLE9BQU8sQ0FBQyxDQUFDO0FBQUEsRUFDbkM7QUFBQSxFQUVTLFFBQWM7QUFDdEIsVUFBTSxNQUFNO0FBQ1osU0FBSyxjQUFjLFNBQVM7QUFBQSxFQUM3QjtBQUFBLEVBRVEsbUJBQW1CLGlCQUF3RDtBQUNsRixRQUFJLENBQUMsS0FBSyxPQUFPO0FBQ2hCO0FBQUEsSUFDRDtBQUNBLFVBQU0sd0JBQXdCLEtBQUssY0FBYyxhQUFhLElBQUksQ0FBQztBQUNuRSxVQUFNLG1CQUFtQiwwQkFBMEIsU0FBWSxLQUFLLGNBQWMsUUFBUSxxQkFBcUIsSUFBSTtBQUNuSCxTQUFLLGNBQWMsT0FBTyxHQUFHLEtBQUssYUFBYSxRQUFRLEtBQUssTUFBTSxRQUFRO0FBRTFFLFFBQUksaUJBQWlCO0FBQ3BCLFdBQUssY0FBYyxhQUFhLENBQUMsS0FBSyxNQUFNLFNBQVMsUUFBUSxlQUFlLENBQUMsQ0FBQztBQUFBLElBQy9FLFdBQVcsa0JBQWtCO0FBQzVCLFVBQUksQ0FBQyxLQUFLLE1BQU0sU0FBUyxTQUFTLGdCQUFnQixHQUFHO0FBQ3BELGNBQU1BLG1CQUFrQixLQUFLLE1BQU0sU0FBUyxLQUFLLGFBQVcsUUFBUSxTQUFTLGlCQUFpQixJQUFJLEtBQUssS0FBSyxNQUFNLFNBQVMsQ0FBQztBQUM1SCxZQUFJQSxrQkFBaUI7QUFDcEIsZUFBSyxjQUFjLGFBQWEsQ0FBQyxLQUFLLE1BQU0sU0FBUyxRQUFRQSxnQkFBZSxDQUFDLENBQUM7QUFBQSxRQUMvRTtBQUFBLE1BQ0Q7QUFBQSxJQUNELE9BQU87QUFDTixZQUFNQSxtQkFBa0IsS0FBSyxNQUFNLFNBQVMsS0FBSyxhQUFXLFFBQVEsTUFBTSxLQUFLLEtBQUssTUFBTSxTQUFTLENBQUM7QUFDcEcsVUFBSUEsa0JBQWlCO0FBQ3BCLGFBQUssY0FBYyxhQUFhLENBQUMsS0FBSyxNQUFNLFNBQVMsUUFBUUEsZ0JBQWUsQ0FBQyxDQUFDO0FBQUEsTUFDL0U7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVEO0FBeFRhLHVCQUVJLEtBQWE7QUFGakIseUJBQU47QUFBQSxFQWNKO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FwQlU7QUFvVWIsTUFBTSx1QkFBdUY7QUFBQSxFQUM1RixVQUFVLFNBQXlDO0FBQ2xELFdBQU87QUFBQSxFQUNSO0FBQUEsRUFDQSxnQkFBZ0I7QUFBRSxXQUFPO0FBQUEsRUFBc0I7QUFDaEQ7QUFFQSxJQUFNLHlCQUFOLE1BQW1IO0FBQUEsRUFJbEgsWUFDeUMsc0JBQ3ZDO0FBRHVDO0FBSHpDLFNBQVMsYUFBYTtBQUFBLEVBSWxCO0FBQUEsRUFFSixlQUFlLFdBQXFEO0FBRW5FLFVBQU0sY0FBYyxJQUFJLGdCQUFnQjtBQUN4QyxVQUFNLHFCQUFxQixJQUFJLGdCQUFnQjtBQUUvQyxjQUFVLFVBQVUsSUFBSSxtQkFBbUI7QUFDM0MsVUFBTSxPQUFPLE9BQU8sV0FBVyxFQUFFLHlCQUF5QixDQUFDO0FBQzNELFVBQU0sUUFBUSxPQUFPLFdBQVcsRUFBRSwwQkFBMEIsQ0FBQztBQUM3RCxVQUFNLFFBQVEsT0FBTyxXQUFXLEVBQUUsT0FBTyxVQUFVLGNBQWMsUUFBUSxZQUFZLENBQUMsRUFBRSxDQUFDO0FBQ3pGLFVBQU0sY0FBYyxPQUFPLFdBQVcsRUFBRSxnQ0FBZ0MsQ0FBQztBQUN6RSxXQUFPLGFBQWEsRUFBRSxPQUFPLFVBQVUsY0FBYyxRQUFRLEtBQUssQ0FBQyxFQUFFLEdBQUcsRUFBRSxRQUFRLFFBQVcsU0FBUyxpQkFBaUIsUUFBUSxDQUFDLENBQUM7QUFFakksVUFBTSxtQkFBbUIsT0FBTyxXQUFXLEVBQUUsc0NBQXNDLENBQUM7QUFDcEYsVUFBTSxZQUFZLFlBQVksSUFBSSxLQUFLLHFCQUFxQjtBQUFBLE1BQWU7QUFBQSxNQUMxRTtBQUFBLE1BQ0E7QUFBQSxRQUNDLGVBQWUsWUFBWSxJQUFJLDJCQUEyQixDQUFDO0FBQUEsUUFDM0QsdUJBQXVCO0FBQUEsTUFDeEI7QUFBQSxJQUNELENBQUM7QUFFRCxXQUFPLEVBQUUsT0FBTyxNQUFNLE9BQU8sYUFBYSxXQUFXLGFBQWEsbUJBQW1CO0FBQUEsRUFDdEY7QUFBQSxFQUVBLGNBQWMsU0FBeUMsT0FBZSxjQUEyQyxRQUE0QjtBQUM1SSxpQkFBYSxtQkFBbUIsTUFBTTtBQUN0QyxpQkFBYSxNQUFNLGNBQWMsUUFBUTtBQUN6QyxpQkFBYSxNQUFNLFVBQVUsT0FBTyxlQUFlLG1CQUFtQixpQkFBaUI7QUFDdkYsaUJBQWEsS0FBSyxZQUFZLFVBQVUsWUFBWSxRQUFRLE9BQU8sVUFBVSxPQUFPLFFBQVEsSUFBSSxJQUFJLFlBQVk7QUFDaEgsaUJBQWEsTUFBTSxVQUFVLE9BQU8sUUFBUSxFQUFFLG1CQUFtQixrQkFBa0I7QUFDbkYsaUJBQWEsWUFBWSxVQUFVLE9BQU8sUUFBUSxDQUFDLFFBQVEsTUFBTTtBQUNqRSxpQkFBYSxtQkFBbUIsSUFBSSxRQUFRLFlBQVksT0FBSztBQUM1RCxVQUFJLEVBQUUsTUFBTTtBQUNYLHFCQUFhLE1BQU0sY0FBYyxRQUFRO0FBQUEsTUFDMUM7QUFDQSxVQUFJLEVBQUUsTUFBTTtBQUNYLFlBQUksUUFBUSxNQUFNO0FBQ2pCLHVCQUFhLEtBQUssWUFBWSxVQUFVLFlBQVksVUFBVSxPQUFPLFFBQVEsSUFBSSxDQUFDO0FBQUEsUUFDbkYsT0FBTztBQUNOLHVCQUFhLEtBQUssWUFBWTtBQUFBLFFBQy9CO0FBQUEsTUFDRDtBQUNBLFVBQUksRUFBRSxRQUFRO0FBQ2IscUJBQWEsWUFBWSxVQUFVLE9BQU8sUUFBUSxDQUFDLFFBQVEsTUFBTTtBQUFBLE1BQ2xFO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFDRixVQUFNLGFBQWEsTUFBTSxhQUFhLFVBQVUsV0FBVyxRQUFRLFFBQVEsQ0FBQyxFQUFFLE9BQU8sT0FBSyxFQUFFLE9BQU8sR0FBRyxRQUFRLFFBQVEsQ0FBQyxFQUFFLE9BQU8sT0FBSyxFQUFFLE9BQU8sQ0FBQztBQUMvSSxlQUFXO0FBQ1gsVUFBTSxTQUFzQyxDQUFDO0FBQzdDLGVBQVcsVUFBVSxRQUFRLFFBQVEsS0FBSyxHQUFHO0FBQzVDLFVBQUksa0JBQWtCLFFBQVE7QUFDN0IsZUFBTyxLQUFLLE9BQU8sV0FBVztBQUFBLE1BQy9CO0FBQUEsSUFDRDtBQUNBLGlCQUFhLG1CQUFtQixJQUFJLE1BQU0sSUFBSSxHQUFHLE1BQU0sRUFBRSxPQUFLO0FBQzdELFVBQUksRUFBRSxZQUFZLFFBQVc7QUFDNUIsbUJBQVc7QUFBQSxNQUNaO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFBQSxFQUVIO0FBQUEsRUFFQSxlQUFlLFNBQXlDLE9BQWUsY0FBMkMsUUFBa0M7QUFDbkosaUJBQWEsbUJBQW1CLE1BQU07QUFBQSxFQUN2QztBQUFBLEVBRUEsZ0JBQWdCLGNBQWlEO0FBQ2hFLGlCQUFhLFlBQVksUUFBUTtBQUNqQyxpQkFBYSxtQkFBbUIsUUFBUTtBQUFBLEVBQ3pDO0FBQ0Q7QUE5RU0seUJBQU47QUFBQSxFQUtHO0FBQUEsR0FMRztBQWdGTixJQUFNLGdCQUFOLGNBQTRCLFdBQVc7QUFBQSxFQWlCdEMsWUFDQyxRQUN5Qyx1QkFDRCxzQkFDdkM7QUFDRCxVQUFNO0FBSG1DO0FBQ0Q7QUFaekMsU0FBaUIsa0JBQWtCLEtBQUssVUFBVSxJQUFJLGtCQUE2RSxDQUFDO0FBRXBJLFNBQWlCLHFCQUErQyxDQUFDO0FBY2hFLFVBQU0sU0FBUyxPQUFPLFFBQVEsRUFBRSxpQkFBaUIsQ0FBQztBQUNsRCxVQUFNLFFBQVEsT0FBTyxRQUFRLEVBQUUsMEJBQTBCLENBQUM7QUFDMUQsU0FBSyxlQUFlLE9BQU8sT0FBTyxFQUFFLEVBQUUsQ0FBQztBQUV2QyxVQUFNLE9BQU8sT0FBTyxRQUFRLEVBQUUsZUFBZSxDQUFDO0FBRTlDLFVBQU0sV0FBVyxJQUFJLG9CQUFvQjtBQUN6QyxVQUFNLG1CQUFtQixLQUFLLFVBQVUsS0FBSyxxQkFBcUIsZUFBZSx1QkFBdUIsQ0FBQztBQUN6RyxVQUFNLHVCQUF1QixLQUFLLFVBQVUsS0FBSyxxQkFBcUIsZUFBZSx5QkFBeUIsQ0FBQztBQUMvRyxTQUFLLG1CQUFtQixLQUFLLG9CQUFvQjtBQUNqRCxTQUFLLDBCQUEwQixLQUFLLFVBQVUsS0FBSyxxQkFBcUIsZUFBZSx1QkFBdUIsQ0FBQztBQUMvRyxTQUFLLHVCQUF1QixPQUFPLE1BQU0sRUFBRSxlQUFlLENBQUM7QUFDM0QsU0FBSyxjQUFjLEtBQUssVUFBVSxLQUFLLHFCQUFxQjtBQUFBLE1BQWU7QUFBQSxNQUMxRTtBQUFBLE1BQ0EsS0FBSztBQUFBLE1BQ0w7QUFBQSxNQUNBO0FBQUEsUUFDQyxLQUFLLFVBQVUsS0FBSyxxQkFBcUIsZUFBZSxtQkFBbUIsQ0FBQztBQUFBLFFBQzVFLEtBQUssVUFBVSxLQUFLLHFCQUFxQixlQUFlLG1CQUFtQixDQUFDO0FBQUEsUUFDNUUsS0FBSyxVQUFVLEtBQUsscUJBQXFCLGVBQWUsbUNBQW1DLENBQUM7QUFBQSxRQUM1RixLQUFLLFVBQVUsS0FBSyxxQkFBcUIsZUFBZSwyQkFBMkIsQ0FBQztBQUFBLFFBQ3BGLEtBQUs7QUFBQSxRQUNMO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLEtBQUsscUJBQXFCLGVBQWUscUJBQXFCO0FBQUEsTUFDOUQ7QUFBQSxRQUNDLDBCQUEwQjtBQUFBLFFBQzFCLHFCQUFxQjtBQUFBLFFBQ3JCLHVCQUF1QjtBQUFBLFVBQ3RCLGFBQWEsU0FBNEM7QUFDeEQsbUJBQU8sU0FBUyxXQUFXO0FBQUEsVUFDNUI7QUFBQSxVQUNBLHFCQUE2QjtBQUM1QixtQkFBTztBQUFBLFVBQ1I7QUFBQSxRQUNEO0FBQUEsUUFDQSxrQkFBa0I7QUFBQSxVQUNqQixNQUFNLFNBQVM7QUFDZCxtQkFBTyxRQUFRO0FBQUEsVUFDaEI7QUFBQSxRQUNEO0FBQUEsUUFDQSwwQkFBMEI7QUFBQSxRQUMxQixvQkFBb0IsbUJBQW1CO0FBQUEsUUFDdkMsb0JBQW9CO0FBQUEsUUFDcEIsbUJBQW1CO0FBQUEsUUFDbkIsa0JBQWtCO0FBQUEsUUFDbEIsdUJBQXVCO0FBQUEsUUFDdkIseUJBQXlCO0FBQUEsTUFDMUI7QUFBQSxJQUFDLENBQUM7QUFFSCxTQUFLLFlBQVksTUFBTSxVQUFVO0FBRWpDLFNBQUssVUFBVSxpQkFBaUIseUJBQXlCLENBQUMsTUFBTSxLQUFLLFlBQVksb0JBQW9CLEdBQUcsTUFBUyxDQUFDLENBQUM7QUFDbkgsU0FBSyxVQUFVLHFCQUFxQix5QkFBeUIsQ0FBQyxNQUFNLEtBQUssWUFBWSxvQkFBb0IsR0FBRyxNQUFTLENBQUMsQ0FBQztBQUN2SCxTQUFLLFVBQVUsaUJBQWlCLHFCQUFxQixDQUFDLE1BQU07QUFDM0QsVUFBSSxFQUFFLFVBQVU7QUFDZixhQUFLLFlBQVksU0FBUyxDQUFDLENBQUM7QUFDNUIsYUFBSyxZQUFZLGFBQWEsQ0FBQyxDQUFDO0FBQUEsTUFDakM7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFNBQUssVUFBVSxLQUFLLFlBQVkseUJBQXlCLENBQUMsTUFBTTtBQUMvRCxVQUFJLEtBQUssV0FBVztBQUNuQixhQUFLLE9BQU8sS0FBSyxTQUFTO0FBQUEsTUFDM0I7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFNBQUssVUFBVSxLQUFLLFlBQVkscUJBQXFCLENBQUMsTUFBTTtBQUMzRCxVQUFJLEVBQUUsU0FBUyxRQUFRO0FBQ3RCLHlCQUFpQixlQUFlO0FBQUEsTUFDakM7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFNBQUssa0JBQWtCLE9BQU8sTUFBTSxFQUFFLGlEQUFpRCxDQUFDO0FBQUEsRUFDekY7QUFBQSxFQXZGQSxJQUFXLFVBQVUsV0FBNEM7QUFDaEUsU0FBSyx3QkFBd0IsYUFBYSxTQUFTO0FBQ25ELFNBQUssWUFBWSxTQUFTO0FBQUEsRUFDM0I7QUFBQSxFQXVGQSxPQUFPLFdBQTRCO0FBQ2xDLFNBQUssWUFBWTtBQUNqQixVQUFNLG9CQUFvQixLQUFLLFlBQVk7QUFDM0MsVUFBTSxTQUFTLEtBQUssSUFBSSxtQkFBbUIsVUFBVSxVQUFVLEtBQUssZ0JBQWdCLE9BQU8sbUJBQW1CLG9CQUFvQixNQUFNLEdBQUc7QUFDM0ksU0FBSyxxQkFBcUIsTUFBTSxTQUFTLEdBQUcsTUFBTTtBQUNsRCxTQUFLLFlBQVksT0FBTyxRQUFRLFVBQVUsS0FBSztBQUMvQyxlQUFXLGVBQWUsS0FBSyxvQkFBb0I7QUFDbEQsa0JBQVksT0FBTztBQUFBLElBQ3BCO0FBQUEsRUFDRDtBQUFBLEVBRUEsT0FBTyxnQkFBc0Q7QUFDNUQsUUFBSSxLQUFLLGdCQUFnQixPQUFPLFlBQVksZ0JBQWdCO0FBQzNEO0FBQUEsSUFDRDtBQUVBLFFBQUksS0FBSyxnQkFBZ0IsT0FBTyxtQkFBbUIsd0JBQXdCO0FBQzFFLFdBQUssZ0JBQWdCLE1BQU0sUUFBUSxNQUFNO0FBQUEsSUFDMUM7QUFDQSxTQUFLLFlBQVksU0FBUyxjQUFjO0FBRXhDLFVBQU0sY0FBYyxJQUFJLGdCQUFnQjtBQUN4QyxTQUFLLGdCQUFnQixRQUFRLEVBQUUsU0FBUyxnQkFBZ0IsU0FBUyxNQUFNLFlBQVksUUFBUSxFQUFFO0FBRTdGLFNBQUssYUFBYSxjQUFjLGVBQWU7QUFDL0MsZ0JBQVksSUFBSSxlQUFlLFlBQVksT0FBSztBQUMvQyxVQUFJLEVBQUUsTUFBTTtBQUNYLGFBQUssYUFBYSxjQUFjLGVBQWU7QUFBQSxNQUNoRDtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsVUFBTSxDQUFDLHFCQUFxQixxQkFBcUIsSUFBSSxlQUFlO0FBQ3BFLFFBQUkscUJBQXFCLFVBQVUsdUJBQXVCLFFBQVE7QUFDakUsV0FBSyxnQkFBZ0IsVUFBVSxPQUFPLE1BQU07QUFFNUMsVUFBSSx1QkFBdUIsUUFBUTtBQUNsQyxtQkFBVyxVQUFVLHVCQUF1QjtBQUMzQyxnQkFBTSxTQUFTLFlBQVksSUFBSSxJQUFJLE9BQU8sS0FBSyxpQkFBaUI7QUFBQSxZQUMvRCxHQUFHO0FBQUEsWUFDSCxXQUFXO0FBQUEsVUFDWixDQUFDLENBQUM7QUFDRixpQkFBTyxRQUFRLE9BQU87QUFDdEIsaUJBQU8sVUFBVSxPQUFPO0FBQ3hCLHNCQUFZLElBQUksT0FBTyxXQUFXLE1BQU0sS0FBSyxzQkFBc0IsVUFBVSxPQUFPLElBQUksQ0FBQyxDQUFDLENBQUM7QUFDM0Ysc0JBQVksSUFBSSxPQUFPLFlBQVksQ0FBQyxNQUFNO0FBQ3pDLGdCQUFJLENBQUMsWUFBWSxFQUFFLE9BQU8sR0FBRztBQUM1QixxQkFBTyxVQUFVLE9BQU87QUFBQSxZQUN6QjtBQUNBLGdCQUFJLENBQUMsWUFBWSxFQUFFLEtBQUssR0FBRztBQUMxQixxQkFBTyxRQUFRLE9BQU87QUFBQSxZQUN2QjtBQUFBLFVBQ0QsQ0FBQyxDQUFDO0FBQUEsUUFDSDtBQUFBLE1BQ0Q7QUFFQSxVQUFJLHFCQUFxQixRQUFRO0FBQ2hDLG1CQUFXLFVBQVUscUJBQXFCO0FBQ3pDLGdCQUFNLFNBQVMsWUFBWSxJQUFJLElBQUksT0FBTyxLQUFLLGlCQUFpQjtBQUFBLFlBQy9ELEdBQUc7QUFBQSxVQUNKLENBQUMsQ0FBQztBQUNGLGlCQUFPLFFBQVEsT0FBTztBQUN0QixpQkFBTyxVQUFVLE9BQU87QUFDeEIsc0JBQVksSUFBSSxPQUFPLFdBQVcsTUFBTSxLQUFLLHNCQUFzQixVQUFVLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQztBQUMzRixzQkFBWSxJQUFJLE9BQU8sWUFBWSxDQUFDLE1BQU07QUFDekMsZ0JBQUksQ0FBQyxZQUFZLEVBQUUsT0FBTyxHQUFHO0FBQzVCLHFCQUFPLFVBQVUsT0FBTztBQUFBLFlBQ3pCO0FBQ0EsZ0JBQUksQ0FBQyxZQUFZLEVBQUUsS0FBSyxHQUFHO0FBQzFCLHFCQUFPLFFBQVEsT0FBTztBQUFBLFlBQ3ZCO0FBQUEsVUFDRCxDQUFDLENBQUM7QUFDRixzQkFBWSxJQUFJLGVBQWUsWUFBWSxPQUFLO0FBQy9DLGdCQUFJLEVBQUUsU0FBUztBQUNkLHFCQUFPLFNBQVMsZUFBZSxXQUFXLE9BQU8sS0FBSztBQUN0RCxxQkFBTyxRQUFRLFVBQVUsT0FBTyxTQUFTLENBQUMsQ0FBQyxlQUFlLE9BQU87QUFBQSxZQUNsRTtBQUFBLFVBQ0QsQ0FBQyxDQUFDO0FBQUEsUUFDSDtBQUFBLE1BQ0Q7QUFBQSxJQUVELE9BQU87QUFDTixXQUFLLGdCQUFnQixVQUFVLElBQUksTUFBTTtBQUFBLElBQzFDO0FBRUEsUUFBSSwwQkFBMEIsbUJBQW1CO0FBQ2hELFdBQUssWUFBWSxXQUFXO0FBQUEsSUFDN0I7QUFFQSxRQUFJLEtBQUssV0FBVztBQUNuQixXQUFLLE9BQU8sS0FBSyxTQUFTO0FBQUEsSUFDM0I7QUFBQSxFQUNEO0FBRUQ7QUFuTU0sZ0JBQU47QUFBQSxFQW1CRztBQUFBLEVBQ0E7QUFBQSxHQXBCRztBQTRNTixNQUFNLDRCQUE0QiwwQkFBOEM7QUFBQSxFQUUvRSxjQUFjLEVBQUUsUUFBUSxHQUF1QjtBQUM5QyxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsaUJBQWlCLEVBQUUsUUFBUSxHQUFnQztBQUMxRCxXQUFPLFlBQVksY0FBYyxZQUFZO0FBQUEsRUFDOUM7QUFBQSxFQUVVLGVBQWUsRUFBRSxTQUFTLEtBQUssR0FBK0I7QUFDdkUsWUFBUSxTQUFTO0FBQUEsTUFDaEIsS0FBSztBQUNKLGVBQU87QUFBQSxNQUNSLEtBQUs7QUFDSixlQUFPO0FBQUEsTUFDUixLQUFLO0FBQ0osZUFBTztBQUFBLE1BQ1IsS0FBSztBQUFBLE1BQ0wsS0FBSztBQUNKLGVBQU87QUFBQSxNQUNSLEtBQUs7QUFDSixlQUFPO0FBQUEsTUFDUixLQUFLO0FBQ0osZ0JBQVEsS0FBSyxhQUFjLEtBQUssV0FBVyxTQUFTLEtBQU0sS0FBSyxLQUFLO0FBQUEsSUFDdEU7QUFBQSxFQUNEO0FBQ0Q7QUFFQSxNQUFNLHNCQUFzRztBQUFBLEVBRTNHLFlBQVksU0FBdUU7QUFDbEYsV0FBTyxtQkFBbUI7QUFBQSxFQUMzQjtBQUFBLEVBRUEsTUFBTSxZQUFZLFNBQTZGO0FBQzlHLFFBQUksbUJBQW1CLGdDQUFnQztBQUN0RCxZQUFNLFdBQWlDLENBQUM7QUFDeEMsVUFBSSxtQkFBbUIsbUJBQW1CO0FBQ3pDLGlCQUFTLEtBQUssRUFBRSxTQUFTLFFBQVEsTUFBTSxRQUFRLENBQUM7QUFDaEQsaUJBQVMsS0FBSyxFQUFFLFNBQVMsUUFBUSxNQUFNLFFBQVEsQ0FBQztBQUNoRCxpQkFBUyxLQUFLLEVBQUUsU0FBUyxZQUFZLE1BQU0sUUFBUSxDQUFDO0FBQ3BELGlCQUFTLEtBQUssRUFBRSxTQUFTLFlBQVksTUFBTSxRQUFRLENBQUM7QUFBQSxNQUNyRCxXQUFXLG1CQUFtQix3QkFBd0I7QUFDckQsWUFBSSxDQUFDLFFBQVEsUUFBUSxXQUFXO0FBQy9CLG1CQUFTLEtBQUssRUFBRSxTQUFTLFFBQVEsTUFBTSxRQUFRLENBQUM7QUFDaEQsbUJBQVMsS0FBSyxFQUFFLFNBQVMsUUFBUSxNQUFNLFFBQVEsQ0FBQztBQUFBLFFBQ2pEO0FBQ0EsaUJBQVMsS0FBSyxFQUFFLFNBQVMsZ0JBQWdCLE1BQU0sUUFBUSxDQUFDO0FBQ3hELGlCQUFTLEtBQUssRUFBRSxTQUFTLFlBQVksTUFBTSxRQUFRLENBQUM7QUFDcEQsaUJBQVMsS0FBSyxFQUFFLFNBQVMsY0FBYyxNQUFNLFFBQVEsQ0FBQztBQUFBLE1BQ3ZEO0FBQ0EsYUFBTztBQUFBLElBQ1I7QUFDQSxXQUFPLENBQUM7QUFBQSxFQUNUO0FBQ0Q7QUFPQSxNQUFNLGtDQUE2RjtBQUFBLEVBRWxHLGNBQWMsU0FBb0M7QUFDakQsUUFBSSxDQUErQixRQUFRLFFBQVMsY0FBYztBQUNqRSxhQUFPLHFDQUFxQztBQUFBLElBQzdDO0FBQ0EsUUFBSSxRQUFRLGdCQUFnQixtQkFBbUI7QUFDOUMsYUFBTywrQkFBK0I7QUFBQSxJQUN2QztBQUNBLFdBQU8sb0NBQW9DO0FBQUEsRUFDNUM7QUFBQSxFQUVBLFVBQVUsU0FBNEM7QUFDckQsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQUVBLElBQU0sZ0NBQU4sTUFBMkg7QUFBQSxFQUUxSCxZQUMwQyx1QkFDeEM7QUFEd0M7QUFBQSxFQUN0QztBQUFBLEVBRUosWUFBWSxTQUE4RTtBQUN6RixRQUFJLG1CQUFtQixnQ0FBZ0M7QUFDdEQsYUFBTztBQUFBLElBQ1I7QUFDQSxRQUFrQyxRQUFRLFFBQVMsY0FBYztBQUNoRSxVQUFrQyxRQUFRLFFBQVMsaUJBQWlCLG9CQUFvQixjQUE0QyxRQUFRLFFBQVMsaUJBQWlCLG9CQUFvQixVQUFVO0FBQ25NLGVBQU87QUFBQSxNQUNSO0FBQ0EsVUFBSSxRQUFRLGdCQUFnQixtQkFBbUI7QUFDOUMsY0FBTSxlQUE2QyxRQUFRLFFBQVM7QUFDcEUsWUFBSSxRQUFRLEtBQUssUUFBUSxZQUFZLEdBQUc7QUFDdkMsaUJBQU87QUFBQSxRQUNSO0FBQ0EsWUFBSSxDQUFDLFFBQVEsS0FBSyxZQUFZLFlBQVksR0FBRztBQUM1QyxpQkFBTztBQUFBLFFBQ1I7QUFDQSxZQUFJLFFBQVEsS0FBSyxhQUFhLFFBQVc7QUFDeEMsaUJBQU87QUFBQSxRQUNSO0FBQ0EsWUFBSSxDQUFDLFFBQVEsS0FBSyxZQUFZLFlBQVksR0FBRztBQUM1QyxpQkFBTztBQUFBLFFBQ1I7QUFBQSxNQUNEO0FBQ0EsYUFBTztBQUFBLElBQ1I7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsTUFBTSxZQUFZLFNBQTJHO0FBQzVILFFBQUksbUJBQW1CLGdDQUFnQztBQUN0RCxZQUFNLFdBQVcsTUFBTSxRQUFRLFlBQVk7QUFDM0MsYUFBTyxTQUFTLElBQUksUUFBTSxFQUFFLFNBQVMsR0FBRyxNQUFNLFFBQVEsRUFBRTtBQUFBLElBQ3pEO0FBQ0EsUUFBa0MsUUFBUSxRQUFTLGNBQWM7QUFDaEUsWUFBTSxpQkFBaUIsS0FBSyxzQkFBc0IsS0FBSyxNQUFNLEdBQUc7QUFDaEUsVUFBSTtBQUNILGNBQU0sYUFBYSxNQUFNLFFBQVEsS0FBSyxZQUEwQyxRQUFRLFFBQVMsWUFBWTtBQUM3RyxlQUFPLFdBQVcsSUFBSSxRQUFNLEVBQUUsU0FBUyxHQUFHLE1BQU0sUUFBUSxLQUFLLEVBQUU7QUFBQSxNQUNoRSxVQUFFO0FBQ0QsdUJBQWUsS0FBSztBQUFBLE1BQ3JCO0FBQUEsSUFDRDtBQUNBLFdBQU8sQ0FBQztBQUFBLEVBQ1Q7QUFDRDtBQWxETSxnQ0FBTjtBQUFBLEVBR0c7QUFBQSxHQUhHO0FBK0VOLE1BQU0sNENBQTRDLFdBQVc7QUFBQSxFQUVsRCxxQkFBcUIsY0FBMkM7QUFDekUsWUFBUSxjQUFjO0FBQUEsTUFDckIsS0FBSyxvQkFBb0I7QUFDeEIsZUFBTyxTQUFTLFlBQVksVUFBVTtBQUFBLE1BQ3ZDLEtBQUssb0JBQW9CO0FBQ3hCLGVBQU8sU0FBUyxlQUFlLG9CQUFvQjtBQUFBLE1BQ3BELEtBQUssb0JBQW9CO0FBQ3hCLGVBQU8sU0FBUyxZQUFZLFVBQVU7QUFBQSxNQUN2QyxLQUFLLG9CQUFvQjtBQUN4QixlQUFPLFNBQVMsU0FBUyxPQUFPO0FBQUEsTUFDakMsS0FBSyxvQkFBb0I7QUFDeEIsZUFBTyxTQUFTLGNBQWMsWUFBWTtBQUFBLElBQzVDO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLGVBQWUsU0FBMEUsT0FBZSxjQUF3QyxRQUFrQztBQUNqTCxpQkFBYSxtQkFBbUIsTUFBTTtBQUFBLEVBQ3ZDO0FBQUEsRUFFQSxnQkFBZ0IsY0FBOEM7QUFDN0QsaUJBQWEsWUFBWSxRQUFRO0FBQUEsRUFDbEM7QUFDRDtBQUVBLE1BQWUsZ0NBQWdDLG9DQUF5SDtBQUFBLEVBS3ZLLGNBQWMsRUFBRSxRQUFRLEdBQXdDLE9BQWUsY0FBZ0QsUUFBa0M7QUFDaEssaUJBQWEsbUJBQW1CLE1BQU07QUFDdEMsaUJBQWEsVUFBVTtBQUFBLEVBQ3hCO0FBRUQ7QUFFQSxJQUFNLHNCQUFOLGNBQWtDLHdCQUF3QjtBQUFBLEVBSXpELFlBQzRDLHlCQUNMLG9CQUNyQztBQUNELFVBQU07QUFIcUM7QUFDTDtBQUp2QyxTQUFTLGFBQThCO0FBQUEsRUFPdkM7QUFBQSxFQUVBLGVBQWUsUUFBdUQ7QUFDckUsVUFBTSxjQUFjLElBQUksZ0JBQWdCO0FBQ3hDLFVBQU0scUJBQXFCLFlBQVksSUFBSSxJQUFJLGdCQUFnQixDQUFDO0FBQ2hFLFFBQUk7QUFFSixVQUFNLGdCQUFnQixPQUFPLFFBQVEsRUFBRSx3QkFBd0IsQ0FBQztBQUNoRSxXQUFPLGVBQWUsRUFBRSwwQkFBMEIsUUFBVyxTQUFTLFFBQVEsTUFBTSxDQUFDLENBQUM7QUFDdEYsVUFBTSxZQUFZLFlBQVksSUFBSSxJQUFJO0FBQUEsTUFDckM7QUFBQSxNQUNBLEtBQUs7QUFBQSxNQUNMO0FBQUEsUUFDQyxnQkFBZ0IsaUJBQWlCO0FBQUEsVUFDaEMsYUFBYTtBQUFBLFFBQ2QsQ0FBQztBQUFBLFFBQ0QsV0FBVyxTQUFTLGVBQWUsY0FBYztBQUFBLFFBQ2pELGFBQWEsU0FBUyxlQUFlLGNBQWM7QUFBQSxRQUNuRCxtQkFBbUI7QUFBQSxVQUNsQixZQUFZLENBQUMsVUFBVTtBQUN0QixnQkFBSSxDQUFDLE9BQU87QUFDWCxxQkFBTztBQUFBLGdCQUNOLFNBQVMsU0FBUyxpQkFBaUIseURBQXlEO0FBQUEsZ0JBQzVGLE1BQU0sWUFBWTtBQUFBLGNBQ25CO0FBQUEsWUFDRDtBQUNBLGdCQUFJLGdCQUFnQixLQUFLLFVBQVU7QUFDbEMscUJBQU87QUFBQSxZQUNSO0FBQ0EsZ0JBQUksQ0FBQyxnQkFBZ0IsS0FBSyxtQkFBbUIsR0FBRztBQUMvQyxxQkFBTztBQUFBLFlBQ1I7QUFDQSxrQkFBTSxjQUFjLGdCQUFnQixLQUFLLGVBQWU7QUFDeEQsb0JBQVEsTUFBTSxLQUFLO0FBQ25CLGdCQUFJLGdCQUFnQixTQUFTLEtBQUssd0JBQXdCLFNBQVMsS0FBSyxPQUFLLENBQUMsRUFBRSxlQUFlLEVBQUUsU0FBUyxLQUFLLEdBQUc7QUFDakgscUJBQU87QUFBQSxnQkFDTixTQUFTLFNBQVMsaUJBQWlCLHlDQUF5QyxLQUFLO0FBQUEsZ0JBQ2pGLE1BQU0sWUFBWTtBQUFBLGNBQ25CO0FBQUEsWUFDRDtBQUNBLG1CQUFPO0FBQUEsVUFDUjtBQUFBLFFBQ0Q7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDO0FBQ0QsY0FBVSxZQUFZLFdBQVM7QUFDOUIsVUFBSSxrQkFBa0IsT0FBTztBQUM1Qix1QkFBZSxLQUFLLE9BQU87QUFBQSxNQUM1QjtBQUFBLElBQ0QsQ0FBQztBQUNELFVBQU0sZUFBZSxZQUFZLElBQUksV0FBVyxVQUFVLFlBQVksQ0FBQztBQUN2RSxnQkFBWSxJQUFJLGFBQWEsVUFBVSxNQUFNO0FBQzVDLFVBQUksa0JBQWtCLENBQUMsVUFBVSxPQUFPO0FBQ3ZDLGtCQUFVLFFBQVEsZUFBZSxLQUFLO0FBQUEsTUFDdkM7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFVBQU0sYUFBYSxDQUFDQyxvQkFBdUM7QUFDMUQsZ0JBQVUsUUFBUUEsZ0JBQWUsS0FBSztBQUN0QyxnQkFBVSxTQUFTO0FBQ25CLFlBQU0sbUJBQW1CQSxnQkFBZSxnQkFBZ0IsMEJBQTBCQSxnQkFBZSxLQUFLLFFBQVE7QUFDOUcsVUFBSUEsZ0JBQWUsS0FBSyxZQUFZLGtCQUFrQjtBQUNyRCxrQkFBVSxRQUFRO0FBQUEsTUFDbkIsT0FBTztBQUNOLGtCQUFVLE9BQU87QUFBQSxNQUNsQjtBQUNBLFVBQUksa0JBQWtCO0FBQ3JCLGtCQUFVLFdBQVcsU0FBUyxzQkFBc0IsZ0RBQWdELENBQUM7QUFBQSxNQUN0RyxPQUFPO0FBQ04sa0JBQVUsV0FBVyxTQUFTLGVBQWUsY0FBYyxDQUFDO0FBQUEsTUFDN0Q7QUFBQSxJQUNEO0FBRUEsV0FBTztBQUFBLE1BQ04sSUFBSSxRQUFRLFNBQTZCO0FBQ3hDLHlCQUFpQjtBQUNqQixtQkFBVyxjQUFjO0FBQ3pCLDJCQUFtQixJQUFJLGVBQWUsS0FBSyxZQUFZLE9BQUs7QUFDM0QsY0FBSSxFQUFFLFFBQVEsRUFBRSxVQUFVO0FBQ3pCLHVCQUFXLE9BQU87QUFBQSxVQUNuQjtBQUNBLGNBQUksRUFBRSxTQUFTO0FBQ2Qsc0JBQVUsU0FBUztBQUFBLFVBQ3BCO0FBQUEsUUFDRCxDQUFDLENBQUM7QUFBQSxNQUNIO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUVEO0FBcEdNLHNCQUFOO0FBQUEsRUFLRztBQUFBLEVBQ0E7QUFBQSxHQU5HO0FBc0dOLElBQU0sc0JBQU4sY0FBa0Msd0JBQXdCO0FBQUEsRUFLekQsWUFDeUMsc0JBQ1IsY0FDL0I7QUFDRCxVQUFNO0FBSGtDO0FBQ1I7QUFMakMsU0FBUyxhQUE4QjtBQVF0QyxTQUFLLGdCQUFnQix3QkFBd0IsU0FBUztBQUFBLEVBQ3ZEO0FBQUEsRUFFQSxlQUFlLFFBQXVEO0FBQ3JFLFVBQU0sY0FBYyxJQUFJLGdCQUFnQjtBQUN4QyxVQUFNLHFCQUFxQixZQUFZLElBQUksSUFBSSxnQkFBZ0IsQ0FBQztBQUNoRSxRQUFJO0FBRUosVUFBTSxnQkFBZ0IsT0FBTyxRQUFRLEVBQUUsd0JBQXdCLENBQUM7QUFDaEUsV0FBTyxlQUFlLEVBQUUsMEJBQTBCLFFBQVcsU0FBUyxjQUFjLE1BQU0sQ0FBQyxDQUFDO0FBQzVGLFVBQU0scUJBQXFCLE9BQU8sZUFBZSxFQUFFLHlCQUF5QixDQUFDO0FBQzdFLFVBQU0sY0FBYyxPQUFPLG9CQUFvQixFQUFFLEdBQUcsVUFBVSxjQUFjLFlBQVksQ0FBQyxJQUFJLEVBQUUsWUFBWSxLQUFLLFFBQVEsVUFBVSxjQUFjLFNBQVMsUUFBUSxjQUFjLEVBQUUsQ0FBQyxDQUFDO0FBQ25MLFVBQU0sWUFBWSxZQUFZLElBQUksS0FBSyxhQUFhLGtCQUFrQixLQUFLLGVBQWUsYUFBYSxFQUFFLENBQUM7QUFFMUcsVUFBTSxnQkFBZ0IsWUFBWSxJQUFJLEtBQUsscUJBQXFCLGVBQWUsd0JBQXdCLEVBQUUsT0FBTyxPQUFPLGdCQUFnQixzQkFBc0IsQ0FBQyxDQUFDO0FBQy9KLFFBQUk7QUFDSixVQUFNLG9CQUFvQixNQUFNO0FBQy9CLFVBQUksZ0JBQWdCLGdCQUFnQiwwQkFBMEIsZUFBZSxLQUFLLFFBQVEsV0FBVztBQUNwRztBQUFBLE1BQ0Q7QUFDQSxVQUFJLGdCQUFnQixLQUFLLFVBQVU7QUFDbEM7QUFBQSxNQUNEO0FBQ0EsVUFBSSxnQkFBZ0IsZ0JBQWdCLDBCQUEwQixlQUFlLEtBQUssUUFBUSxXQUFXO0FBQ3BHO0FBQUEsTUFDRDtBQUNBLG9CQUFjLFdBQVc7QUFDekIsb0JBQWMsS0FBSyxhQUFhLGlCQUFpQjtBQUFBLFFBQ2hELFNBQVMsY0FBYztBQUFBLFFBQ3ZCLFFBQVE7QUFBQSxRQUNSLFVBQVU7QUFBQSxVQUNULGVBQWUsY0FBYztBQUFBLFFBQzlCO0FBQUEsUUFDQSxhQUFhO0FBQUEsVUFDWixRQUFRO0FBQUEsUUFDVDtBQUFBLFFBQ0EsWUFBWTtBQUFBLFVBQ1gsYUFBYTtBQUFBLFFBQ2Q7QUFBQSxNQUNELEdBQUcsSUFBSTtBQUVQLFVBQUksYUFBYTtBQUNoQixzQkFBYyxPQUFPLElBQUksVUFBVSxLQUFLLEdBQUcsQ0FBQztBQUM1QyxzQkFBYyxNQUFNO0FBQUEsTUFDckI7QUFBQSxJQUNEO0FBQ0EsZ0JBQVksSUFBSSxzQkFBc0IsYUFBYSxVQUFVLE9BQU8sQ0FBQyxNQUFrQjtBQUN0RixrQkFBWSxLQUFLLEdBQUcsSUFBSTtBQUN4Qix3QkFBa0I7QUFBQSxJQUNuQixDQUFDLENBQUM7QUFDRixnQkFBWSxJQUFJLHNCQUFzQixhQUFhLFVBQVUsVUFBVSxPQUFLO0FBQzNFLFlBQU0sUUFBUSxJQUFJLHNCQUFzQixDQUFDO0FBQ3pDLFVBQUksTUFBTSxPQUFPLFFBQVEsS0FBSyxLQUFLLE1BQU0sT0FBTyxRQUFRLEtBQUssR0FBRztBQUMvRCxvQkFBWSxLQUFLLE9BQU8sSUFBSTtBQUM1QiwwQkFBa0I7QUFBQSxNQUNuQjtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBQ0YsZ0JBQVksSUFBSSxzQkFBc0IsY0FBYyxTQUFTLFVBQVUsVUFBVSxPQUFLO0FBQ3JGLFlBQU0sUUFBUSxJQUFJLHNCQUFzQixDQUFDO0FBQ3pDLFVBQUksTUFBTSxPQUFPLFFBQVEsTUFBTSxHQUFHO0FBQ2pDLG9CQUFZLEtBQUssT0FBTyxJQUFJO0FBQzVCLHFCQUFhLFFBQVE7QUFDckIsb0JBQVksTUFBTTtBQUFBLE1BQ25CO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFDRixnQkFBWSxJQUFJLGNBQWMsWUFBWSxrQkFBZ0I7QUFDekQsbUJBQWEsUUFBUTtBQUNyQixrQkFBWSxNQUFNO0FBQ2xCLFVBQUksZ0JBQWdCO0FBQ25CLHVCQUFlLEtBQUssT0FBTyxhQUFhO0FBQUEsTUFDekM7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFdBQU8sb0JBQW9CLEVBQUUsZ0NBQWdDLFFBQVcsU0FBUyxvQkFBb0IsOENBQThDLENBQUMsQ0FBQztBQUVySixVQUFNLGFBQWEsQ0FBQ0Esb0JBQXVDO0FBQzFELFVBQUlBLGlCQUFnQixnQkFBZ0IsMEJBQTBCQSxnQkFBZSxLQUFLLFFBQVEsV0FBVztBQUNwRywyQkFBbUIsVUFBVSxJQUFJLFVBQVU7QUFDM0Msa0JBQVUsT0FBTyxTQUFTLHNCQUFzQixnREFBZ0QsQ0FBQztBQUFBLE1BQ2xHLE9BQU87QUFDTixrQkFBVSxPQUFPLFNBQVMsY0FBYyxzQkFBc0IsQ0FBQztBQUMvRCwyQkFBbUIsVUFBVSxPQUFPLFVBQVU7QUFBQSxNQUMvQztBQUNBLFVBQUlBLGdCQUFlLEtBQUssTUFBTTtBQUM3QixvQkFBWSxZQUFZLFVBQVUsWUFBWSxVQUFVLE9BQU9BLGdCQUFlLEtBQUssSUFBSSxDQUFDO0FBQUEsTUFDekYsT0FBTztBQUNOLG9CQUFZLFlBQVksVUFBVSxZQUFZLFVBQVUsT0FBTyxhQUFhLEVBQUUsQ0FBQztBQUFBLE1BQ2hGO0FBQUEsSUFDRDtBQUVBLFdBQU87QUFBQSxNQUNOLElBQUksUUFBUSxTQUE2QjtBQUN4Qyx5QkFBaUI7QUFDakIsbUJBQVcsY0FBYztBQUN6QiwyQkFBbUIsSUFBSSxlQUFlLEtBQUssWUFBWSxPQUFLO0FBQzNELGNBQUksRUFBRSxNQUFNO0FBQ1gsdUJBQVcsT0FBTztBQUFBLFVBQ25CO0FBQUEsUUFDRCxDQUFDLENBQUM7QUFBQSxNQUNIO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUNEO0FBbEhNLHNCQUFOO0FBQUEsRUFNRztBQUFBLEVBQ0E7QUFBQSxHQVBHO0FBb0hOLElBQU0sc0NBQU4sY0FBa0Qsd0JBQXdCO0FBQUEsRUFJekUsWUFDMkMsd0JBQ3pDO0FBQ0QsVUFBTTtBQUZvQztBQUgzQyxTQUFTLGFBQThCO0FBQUEsRUFNdkM7QUFBQSxFQUVBLGVBQWUsUUFBdUQ7QUFDckUsVUFBTSxjQUFjLElBQUksZ0JBQWdCO0FBQ3hDLFVBQU0scUJBQXFCLFlBQVksSUFBSSxJQUFJLGdCQUFnQixDQUFDO0FBQ2hFLFFBQUk7QUFFSixVQUFNLCtCQUErQixPQUFPLFFBQVEsRUFBRSx3QkFBd0IsQ0FBQztBQUMvRSxXQUFPLDhCQUE4QixFQUFFLDBCQUEwQixRQUFXLFNBQVMseUJBQXlCLHdCQUF3QixDQUFDLENBQUM7QUFDeEksVUFBTSxvQ0FBb0MsT0FBTyw4QkFBOEIsRUFBRSxvQ0FBb0MsQ0FBQztBQUN0SCxVQUFNLDJCQUEyQixTQUFTLDZCQUE2Qix5Q0FBeUM7QUFDaEgsVUFBTSw4QkFBOEIsWUFBWSxJQUFJLElBQUksU0FBUywwQkFBMEIsT0FBTyxxQkFBcUIsQ0FBQztBQUN4SCxXQUFPLG1DQUFtQyw0QkFBNEIsT0FBTztBQUM3RSxVQUFNLDJCQUEyQixPQUFPLG1DQUFtQyxFQUFFLGdDQUFnQyxRQUFXLHdCQUF3QixDQUFDO0FBQ2pKLGdCQUFZLElBQUksNEJBQTRCLFNBQVMsTUFBTTtBQUMxRCxVQUFJLGdCQUFnQixnQkFBZ0Isd0JBQXdCO0FBQzNELHVCQUFlLEtBQUssMkJBQTJCO0FBQUEsTUFDaEQ7QUFBQSxJQUNELENBQUMsQ0FBQztBQUNGLGdCQUFZLElBQUksc0JBQXNCLDBCQUEwQixVQUFVLE9BQU8sTUFBTTtBQUN0RixVQUFJLGdCQUFnQixnQkFBZ0Isd0JBQXdCO0FBQzNELHVCQUFlLEtBQUssMkJBQTJCO0FBQUEsTUFDaEQ7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFVBQU0sMEJBQTBCLENBQUNBLG9CQUF1QztBQUN2RSxrQ0FBNEIsVUFBVUEsZ0JBQWUsZ0JBQWdCLDBCQUEwQixLQUFLLHVCQUF1QixlQUFlLE9BQU9BLGdCQUFlLEtBQUssUUFBUTtBQUM3SyxVQUFJLDRCQUE0QixXQUFXLEtBQUssdUJBQXVCLGVBQWUsV0FBVztBQUNoRyxvQ0FBNEIsUUFBUTtBQUFBLE1BQ3JDLE9BQU87QUFDTixvQ0FBNEIsT0FBTztBQUFBLE1BQ3BDO0FBQUEsSUFDRDtBQUVBLFVBQU0sT0FBTztBQUNiLFdBQU87QUFBQSxNQUNOLElBQUksUUFBUSxTQUE2QjtBQUN4Qyx5QkFBaUI7QUFDakIsZ0NBQXdCLGNBQWM7QUFDdEMsMkJBQW1CLElBQUksS0FBSyx1QkFBdUIsMEJBQTBCLE9BQUs7QUFDakYsa0NBQXdCLE9BQU87QUFBQSxRQUNoQyxDQUFDLENBQUM7QUFBQSxNQUNIO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUNEO0FBdkRNLHNDQUFOO0FBQUEsRUFLRztBQUFBLEdBTEc7QUF5RE4sTUFBTSxvQ0FBb0Msd0JBQXdCO0FBQUEsRUFBbEU7QUFBQTtBQUVDLFNBQVMsYUFBOEI7QUFBQTtBQUFBLEVBRXZDLGVBQWUsUUFBdUQ7QUFDckUsVUFBTSxjQUFjLElBQUksZ0JBQWdCO0FBQ3hDLFVBQU0scUJBQXFCLFlBQVksSUFBSSxJQUFJLGdCQUFnQixDQUFDO0FBQ2hFLFFBQUk7QUFFSixVQUFNLCtCQUErQixPQUFPLFFBQVEsRUFBRSx3QkFBd0IsQ0FBQztBQUMvRSxXQUFPLDhCQUE4QixFQUFFLDBCQUEwQixRQUFXLFNBQVMsdUJBQXVCLHFCQUFxQixDQUFDLENBQUM7QUFDbkksVUFBTSxvQ0FBb0MsT0FBTyw4QkFBOEIsRUFBRSxtQ0FBbUMsQ0FBQztBQUNySCxVQUFNLDJCQUEyQixTQUFTLDBCQUEwQixpREFBaUQ7QUFDckgsVUFBTSw4QkFBOEIsWUFBWSxJQUFJLElBQUksU0FBUywwQkFBMEIsT0FBTyxxQkFBcUIsQ0FBQztBQUN4SCxXQUFPLG1DQUFtQyw0QkFBNEIsT0FBTztBQUM3RSxVQUFNLDJCQUEyQixPQUFPLG1DQUFtQyxFQUFFLGdDQUFnQyxRQUFXLHdCQUF3QixDQUFDO0FBQ2pKLGdCQUFZLElBQUksNEJBQTRCLFNBQVMsTUFBTTtBQUMxRCxVQUFJLGdCQUFnQixnQkFBZ0Isd0JBQXdCO0FBQzNELHVCQUFlLEtBQUssdUJBQXVCO0FBQUEsTUFDNUM7QUFBQSxJQUNELENBQUMsQ0FBQztBQUNGLGdCQUFZLElBQUksc0JBQXNCLDBCQUEwQixVQUFVLE9BQU8sTUFBTTtBQUN0RixVQUFJLGdCQUFnQixnQkFBZ0Isd0JBQXdCO0FBQzNELHVCQUFlLEtBQUssdUJBQXVCO0FBQUEsTUFDNUM7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFVBQU0scUJBQXFCLENBQUNBLG9CQUF1QztBQUNsRSxrQ0FBNEIsVUFBVUEsZ0JBQWUsZ0JBQWdCLDBCQUEwQkEsZ0JBQWUsS0FBSztBQUFBLElBQ3BIO0FBRUEsV0FBTztBQUFBLE1BQ04sSUFBSSxRQUFRLFNBQTZCO0FBQ3hDLHlCQUFpQjtBQUNqQiwyQkFBbUIsY0FBYztBQUNqQywyQkFBbUIsSUFBSSxlQUFlLEtBQUssWUFBWSxPQUFLO0FBQzNELGNBQUksRUFBRSxrQkFBa0I7QUFDdkIsK0JBQW1CLE9BQU87QUFBQSxVQUMzQjtBQUFBLFFBQ0QsQ0FBQyxDQUFDO0FBQUEsTUFDSDtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQUVBLElBQU0sMEJBQU4sY0FBc0Msd0JBQXdCO0FBQUEsRUFNN0QsWUFDNEMseUJBQ0gsc0JBQ0Ysb0JBQ0Esb0JBQ3JDO0FBQ0QsVUFBTTtBQUxxQztBQUNIO0FBQ0Y7QUFDQTtBQVJ2QyxTQUFTLGFBQThCO0FBRXZDLFNBQVEsWUFBNkMsQ0FBQztBQUFBLEVBU3REO0FBQUEsRUFFQSxlQUFlLFFBQXVEO0FBQ3JFLFVBQU0sY0FBYyxJQUFJLGdCQUFnQjtBQUN4QyxVQUFNLHFCQUFxQixZQUFZLElBQUksSUFBSSxnQkFBZ0IsQ0FBQztBQUNoRSxRQUFJO0FBRUosVUFBTSxvQkFBb0IsT0FBTyxRQUFRLEVBQUUsb0RBQW9ELENBQUM7QUFDaEcsV0FBTyxtQkFBbUIsRUFBRSwwQkFBMEIsUUFBVyxTQUFTLGVBQWUsV0FBVyxDQUFDLENBQUM7QUFDdEcsV0FBTyxtQkFBbUIsRUFBRSxnQ0FBZ0MsUUFBVyxTQUFTLHlCQUF5QixnRUFBZ0UsQ0FBQyxDQUFDO0FBQzNLLFVBQU0sb0JBQW9CLFlBQVksSUFBSSxLQUFLLHFCQUFxQjtBQUFBLE1BQWU7QUFBQSxNQUNsRixDQUFDO0FBQUEsTUFDRDtBQUFBLE1BQ0EsS0FBSztBQUFBLE1BQ0w7QUFBQSxNQUNBO0FBQUEsUUFDQyxnQkFBZ0I7QUFBQSxRQUNoQixXQUFXLFNBQVMscUJBQXFCLG1CQUFtQjtBQUFBLE1BQzdEO0FBQUEsSUFDRCxDQUFDO0FBQ0Qsc0JBQWtCLE9BQU8sT0FBTyxtQkFBbUIsRUFBRSwyQkFBMkIsQ0FBQyxDQUFDO0FBRWxGLFVBQU0sU0FBUyxDQUFDQSxpQkFBbUMsb0JBQThGO0FBQ2hKLHdCQUFrQixXQUFXLGVBQWU7QUFDNUMsWUFBTSxLQUFLQSxnQkFBZSxvQkFBb0IsTUFBTUEsZ0JBQWUsU0FBUyxTQUFTLElBQUlBLGdCQUFlLFVBQVU7QUFDbEgsWUFBTSxRQUFRLEtBQ1gsZ0JBQWdCLFVBQVUsWUFBVSxPQUFPLE9BQU8sRUFBRSxJQUNwRDtBQUNILHdCQUFrQixPQUFPLEtBQUs7QUFBQSxJQUMvQjtBQUVBLFVBQU0sT0FBTztBQUNiLFdBQU87QUFBQSxNQUNOLElBQUksUUFBUSxTQUE2QjtBQUN4Qyx5QkFBaUI7QUFDakIsWUFBSSxlQUFlLGdCQUFnQixtQkFBbUI7QUFDckQsZ0JBQU0sb0JBQW9CLGVBQWU7QUFDekMsY0FBSSxrQkFBa0IsS0FBSyxtQkFBbUIsaUJBQWlCO0FBQy9ELGlCQUFPLG1CQUFtQixlQUFlO0FBQ3pDLDRCQUFrQixXQUFXLENBQUMsa0JBQWtCLGtCQUFrQixDQUFDLGtCQUFrQixRQUFRO0FBQzdGLDZCQUFtQixJQUFJLGVBQWUsS0FBSyxZQUFZLE9BQUs7QUFDM0QsZ0JBQUksRUFBRSxZQUFZLEVBQUUsY0FBYztBQUNqQyxnQ0FBa0IsS0FBSyxtQkFBbUIsaUJBQWlCO0FBQzNELHFCQUFPLG1CQUFtQixlQUFlO0FBQUEsWUFDMUM7QUFDQSxnQkFBSSxFQUFFLFdBQVcsRUFBRSxVQUFVO0FBQzVCLGdDQUFrQixXQUFXLENBQUMsa0JBQWtCLGtCQUFrQixDQUFDLGtCQUFrQixRQUFRO0FBQUEsWUFDOUY7QUFBQSxVQUNELENBQUMsQ0FBQztBQUNGLDZCQUFtQixJQUFJLGtCQUFrQixZQUFZLFlBQVU7QUFDOUQsOEJBQWtCLFdBQVcsZ0JBQWdCLE9BQU8sS0FBSyxFQUFFO0FBQUEsVUFDNUQsQ0FBQyxDQUFDO0FBQUEsUUFDSDtBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFQSxhQUFhLFdBQWtEO0FBQzlELFNBQUssWUFBWTtBQUFBLEVBQ2xCO0FBQUEsRUFFUSxtQkFBbUIsZ0JBQTZHO0FBQ3ZJLFVBQU0sWUFBWSxFQUFFLE1BQU0sd0NBQXdDLFlBQVksS0FBSztBQUNuRixVQUFNLGtCQUE0RixDQUFDO0FBRW5HLG9CQUFnQixLQUFLLEVBQUUsTUFBTSxTQUFTLGlCQUFpQixNQUFNLEVBQUUsQ0FBQztBQUNoRSxlQUFXLENBQUMsa0JBQWtCLElBQUksS0FBSyxlQUFlLG1CQUFtQjtBQUN4RSxVQUFJLENBQUMsS0FBSyxVQUFVLEtBQUssY0FBWSxLQUFLLG1CQUFtQixPQUFPLFFBQVEsSUFBSSxNQUFNLFNBQVMsR0FBRyxHQUFHLGdCQUFnQixDQUFDLEdBQUc7QUFDeEgsd0JBQWdCLEtBQUssRUFBRSxNQUFNLEdBQUcsSUFBSSxLQUFLLFNBQVMsZ0JBQWdCLENBQUMsS0FBSyxJQUFJLGlCQUFpQixTQUFTLEdBQUcsUUFBUSxpQkFBaUIsQ0FBQztBQUFBLE1BQ3BJO0FBQUEsSUFDRDtBQUVBLFFBQUksS0FBSyxVQUFVLFFBQVE7QUFDMUIsc0JBQWdCLEtBQUssRUFBRSxHQUFHLFdBQVcsZ0JBQWdCLFNBQVMsa0JBQWtCLG1CQUFtQixFQUFFLENBQUM7QUFDdEcsaUJBQVcsWUFBWSxLQUFLLFdBQVc7QUFDdEMsd0JBQWdCLEtBQUssRUFBRSxNQUFNLFNBQVMsTUFBTSxJQUFJLFNBQVMsS0FBSyxRQUFRLElBQUksTUFBTSxTQUFTLEdBQUcsRUFBRSxDQUFDO0FBQUEsTUFDaEc7QUFBQSxJQUNEO0FBQ0Esb0JBQWdCLEtBQUssRUFBRSxHQUFHLFdBQVcsZ0JBQWdCLFNBQVMsMEJBQTBCLG1CQUFtQixFQUFFLENBQUM7QUFDOUcsZUFBVyxXQUFXLEtBQUssd0JBQXdCLFVBQVU7QUFDNUQsVUFBSSxDQUFDLFFBQVEsYUFBYTtBQUN6Qix3QkFBZ0IsS0FBSyxFQUFFLE1BQU0sUUFBUSxNQUFNLElBQUksUUFBUSxJQUFJLFFBQVEsUUFBUSxDQUFDO0FBQUEsTUFDN0U7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQXJHTSwwQkFBTjtBQUFBLEVBT0c7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVZHO0FBdUdOLElBQU0sMEJBQU4sY0FBc0Msd0JBQXdCO0FBQUEsRUFZN0QsWUFDNEMseUJBQ0wsb0JBQ0Usc0JBQ3ZDO0FBQ0QsVUFBTTtBQUpxQztBQUNMO0FBQ0U7QUFiekMsU0FBUyxhQUE4QjtBQUV2QyxTQUFpQiw0QkFBNEIsS0FBSyxVQUFVLElBQUksUUFBNEIsQ0FBQztBQUM3RixTQUFTLDJCQUEyQixLQUFLLDBCQUEwQjtBQUVuRSxTQUFpQix3QkFBd0IsS0FBSyxVQUFVLElBQUksUUFBNEQsQ0FBQztBQUN6SCxTQUFTLHVCQUF1QixLQUFLLHNCQUFzQjtBQUFBLEVBVTNEO0FBQUEsRUFFQSxlQUFlLFFBQXVEO0FBQ3JFLFVBQU0sY0FBYyxJQUFJLGdCQUFnQjtBQUN4QyxVQUFNLHFCQUFxQixZQUFZLElBQUksSUFBSSxnQkFBZ0IsQ0FBQztBQUNoRSxRQUFJO0FBRUosVUFBTSx3QkFBd0IsT0FBTyxRQUFRLEVBQUUsd0JBQXdCLENBQUM7QUFDeEUsV0FBTyx1QkFBdUIsRUFBRSwwQkFBMEIsUUFBVyxTQUFTLFlBQVksVUFBVSxDQUFDLENBQUM7QUFDdEcsVUFBTSw2QkFBNkIsT0FBTyx1QkFBdUIsRUFBRSw4QkFBOEIsQ0FBQztBQUNsRyxVQUFNLHFCQUFxQixPQUFPLHVCQUF1QixFQUFFLDhCQUE4QixDQUFDO0FBQzFGLFVBQU0sZUFBZSxFQUFFLG1CQUFtQixRQUFXLEVBQUUsUUFBUSxRQUFXLFNBQVMsV0FBVyxRQUFRLENBQUMsQ0FBQztBQUN4RztBQUFBLE1BQU87QUFBQSxNQUNOLEVBQUUsRUFBRTtBQUFBLE1BQ0osRUFBRSxJQUFJLFFBQVcsU0FBUyxZQUFZLFVBQVUsQ0FBQztBQUFBLE1BQ2pEO0FBQUEsTUFDQSxFQUFFLEVBQUU7QUFBQSxJQUNMO0FBRUEsVUFBTSxXQUFXLElBQUksa0NBQWtDO0FBQ3ZELFVBQU0sc0JBQXNCLEtBQUssc0JBQXNCLFlBQVksSUFBSSxLQUFLLHFCQUFxQjtBQUFBLE1BQWU7QUFBQSxNQUMvRztBQUFBLE1BQ0EsT0FBTyx1QkFBdUIsRUFBRSwrREFBK0QsQ0FBQztBQUFBLE1BQ2hHO0FBQUEsTUFDQTtBQUFBLFFBQ0MsS0FBSyxxQkFBcUIsZUFBZSxtQ0FBbUM7QUFBQSxRQUM1RSxLQUFLLHFCQUFxQixlQUFlLDhCQUE4QjtBQUFBLFFBQ3ZFLEtBQUsscUJBQXFCLGVBQWUsb0NBQW9DO0FBQUEsTUFDOUU7QUFBQSxNQUNBLEtBQUsscUJBQXFCLGVBQWUsNkJBQTZCO0FBQUEsTUFDdEU7QUFBQSxRQUNDLDBCQUEwQjtBQUFBLFFBQzFCLHFCQUFxQjtBQUFBLFFBQ3JCLHVCQUF1QjtBQUFBLFVBQ3RCLGFBQWEsU0FBbUQ7QUFDL0QsaUJBQWtDLFNBQVMsU0FBUyxjQUFjO0FBQ2pFLHNCQUFxQyxTQUFTLFNBQVM7QUFBQSxZQUN4RDtBQUNBLGlCQUF1QyxTQUFTLFNBQVMsT0FBTztBQUMvRCxzQkFBMEMsU0FBUyxTQUFTO0FBQUEsWUFDN0Q7QUFDQSxtQkFBTztBQUFBLFVBQ1I7QUFBQSxVQUNBLHFCQUE2QjtBQUM1QixtQkFBTztBQUFBLFVBQ1I7QUFBQSxRQUNEO0FBQUEsUUFDQSxrQkFBa0I7QUFBQSxVQUNqQixNQUFNLFNBQVM7QUFDZCxnQkFBSSxTQUFTLFFBQVEsUUFBUTtBQUM1QixxQkFBTyxRQUFRLFFBQVE7QUFBQSxZQUN4QjtBQUNBLG1CQUFPO0FBQUEsVUFDUjtBQUFBLFFBQ0Q7QUFBQSxRQUNBLDBCQUEwQjtBQUFBLFFBQzFCLG9CQUFvQixtQkFBbUI7QUFBQSxRQUN2QyxvQkFBb0I7QUFBQSxRQUNwQixtQkFBbUI7QUFBQSxRQUNuQix5QkFBeUI7QUFBQSxNQUMxQjtBQUFBLElBQUMsQ0FBQztBQUVILFNBQUssb0JBQW9CLE1BQU0sVUFBVTtBQUV6QyxnQkFBWSxJQUFJLGFBQWEsTUFBTSxLQUFLLHNCQUFzQixNQUFTLENBQUM7QUFFeEUsZ0JBQVksSUFBSSxLQUFLLG9CQUFvQix5QkFBeUIsWUFBVTtBQUMzRSxXQUFLLHFCQUFxQixPQUFPLE1BQU07QUFDdkMsVUFBSSxnQkFBZ0I7QUFDbkIsYUFBSywwQkFBMEIsS0FBSyxjQUFjO0FBQUEsTUFDbkQ7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLGdCQUFZLElBQUksS0FBSyxvQkFBb0IscUJBQXNCLE9BQUs7QUFDbkUsVUFBSSxnQkFBZ0I7QUFDbkIsYUFBSyxzQkFBc0IsS0FBSyxFQUFFLFNBQVMsZ0JBQWdCLFVBQVUsQ0FBQyxDQUFDLEVBQUUsU0FBUyxPQUFPLENBQUM7QUFBQSxNQUMzRjtBQUFBLElBQ0QsQ0FBRSxDQUFDO0FBRUgsZ0JBQVksSUFBSSxLQUFLLG9CQUFvQixVQUFVLE9BQU8sTUFBTTtBQUMvRCxVQUFJLENBQUMsRUFBRSxjQUFjO0FBQ3BCO0FBQUEsTUFDRDtBQUNBLFVBQUksRUFBRSxTQUFTLFFBQVEsWUFBWTtBQUNsQyxjQUFNLEVBQUUsUUFBUSxRQUFRLFdBQVcsSUFBSTtBQUFBLE1BQ3hDO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixnQkFBWSxJQUFJLEtBQUssb0JBQW9CLGNBQWMsT0FBTyxNQUFNO0FBQ25FLFVBQUksQ0FBQyxFQUFFLFNBQVMsUUFBUSxTQUFTLGFBQWEsUUFBUTtBQUNyRDtBQUFBLE1BQ0Q7QUFDQSxXQUFLLG1CQUFtQixnQkFBZ0I7QUFBQSxRQUN2QyxXQUFXLE1BQU0sRUFBRTtBQUFBLFFBQ25CLFlBQVksTUFBTSxFQUFFLFNBQVMsU0FBUyxTQUFTLGVBQWUsQ0FBQztBQUFBLFFBQy9ELG1CQUFtQixNQUFNLEVBQUU7QUFBQSxNQUM1QixDQUFDO0FBQUEsSUFDRixDQUFDLENBQUM7QUFFRixVQUFNLG9CQUFvQixDQUFDLFlBQWdDO0FBQzFELGdCQUFVLDBCQUEwQjtBQUVwQyxZQUFNLFdBQVcsSUFBSSxlQUFlO0FBQ3BDLFVBQUksUUFBUSxnQkFBZ0IsMEJBQTBCLFFBQVEsS0FBSyxRQUFRLFdBQVc7QUFDckYsaUJBQVMsZUFBZSxTQUFTLHdDQUF3QyxtQ0FBbUMsQ0FBQztBQUFBLE1BQzlHLE9BRUs7QUFDSixpQkFBUyxlQUFlLFNBQVMsK0JBQStCLGlEQUFpRCxDQUFDO0FBQ2xILFlBQUksUUFBUSxnQkFBZ0IsbUJBQW1CO0FBQzlDLGdCQUFNLGVBQWUsUUFBUSxLQUFLLGdCQUFnQjtBQUNsRCxnQkFBTSxhQUFhLGlCQUFpQixLQUFLLHdCQUF3QixlQUFlLE9BQzdFLFNBQVMscUJBQXFCLGNBQWMsWUFBWSxJQUN4RDtBQUNILGNBQUksWUFBWTtBQUNmLHFCQUNFLGVBQWUsU0FBUyxhQUFhLGlEQUFpRCxZQUFZLFlBQVksQ0FBQztBQUFBLFVBQ2xIO0FBQ0EsbUJBQ0UsZUFBZSxTQUFTLGdCQUFnQixzREFBc0QsQ0FBQyxFQUMvRixlQUFlLFNBQVMsYUFBYSxtQ0FBbUMsQ0FBQztBQUFBLFFBQzVFO0FBQUEsTUFDRDtBQUVBLGFBQU8sNEJBQTRCLG1CQUFtQixJQUFJLGVBQWUsUUFBUSxDQUFDLEVBQUUsT0FBTztBQUFBLElBQzVGO0FBRUEsVUFBTSxPQUFPO0FBQ2IsV0FBTztBQUFBLE1BQ04sSUFBSSxRQUFRLFNBQTZCO0FBQ3hDLHlCQUFpQjtBQUNqQiwwQkFBa0IsT0FBTztBQUN6QixZQUFJLFFBQVEsZ0JBQWdCLG1CQUFtQjtBQUM5Qyw2QkFBbUIsVUFBVSxPQUFPLGlCQUFpQjtBQUFBLFFBQ3RELFdBQVcsUUFBUSxnQkFBZ0Isd0JBQXdCO0FBQzFELDZCQUFtQixVQUFVLE9BQU8sbUJBQW1CLFFBQVEsS0FBSyxRQUFRLFNBQVM7QUFBQSxRQUN0RjtBQUNBLDRCQUFvQixTQUFTLGVBQWUsSUFBSTtBQUNoRCwyQkFBbUIsSUFBSSxlQUFlLEtBQUssWUFBWSxPQUFLO0FBQzNELGNBQUksRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLFNBQVMsRUFBRSxjQUFjLEVBQUUsWUFBWSxFQUFFLFNBQVM7QUFDcEYsZ0NBQW9CLGVBQWUsUUFBUSxJQUFJO0FBQUEsVUFDaEQ7QUFDQSxjQUFJLEVBQUUsY0FBYztBQUNuQiw4QkFBa0IsT0FBTztBQUN6QixpQkFBSywwQkFBMEIsS0FBSyxPQUFPO0FBQUEsVUFDNUM7QUFBQSxRQUNELENBQUMsQ0FBQztBQUFBLE1BQ0g7QUFBQSxNQUNBO0FBQUEsTUFDQSxvQkFBb0IsSUFBSSxnQkFBZ0I7QUFBQSxJQUN6QztBQUFBLEVBQ0Q7QUFBQSxFQUVBLGlCQUF1QjtBQUN0QixRQUFJLEtBQUsscUJBQXFCO0FBQzdCLFdBQUssb0JBQW9CLGFBQWEsQ0FBQyxDQUFDO0FBQ3hDLFdBQUssb0JBQW9CLFNBQVMsQ0FBQyxDQUFDO0FBQUEsSUFDckM7QUFBQSxFQUNEO0FBQ0Q7QUFqTE0sMEJBQU47QUFBQSxFQWFHO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQWZHO0FBd0xOLElBQU0sNEJBQU4sY0FBd0Msd0JBQXdCO0FBQUEsRUFZL0QsWUFDaUMsY0FDTSxvQkFDRCxtQkFDRyxzQkFDdkM7QUFDRCxVQUFNO0FBTDBCO0FBQ007QUFDRDtBQUNHO0FBZHpDLFNBQVMsYUFBOEI7QUFFdkMsU0FBaUIsNEJBQTRCLEtBQUssVUFBVSxJQUFJLFFBQTRCLENBQUM7QUFDN0YsU0FBUywyQkFBMkIsS0FBSywwQkFBMEI7QUFFbkUsU0FBaUIsd0JBQXdCLEtBQUssVUFBVSxJQUFJLFFBQTRELENBQUM7QUFDekgsU0FBUyx1QkFBdUIsS0FBSyxzQkFBc0I7QUFBQSxFQVczRDtBQUFBLEVBRUEsZUFBZSxRQUF1RDtBQUNyRSxVQUFNLGNBQWMsSUFBSSxnQkFBZ0I7QUFDeEMsVUFBTSxxQkFBcUIsWUFBWSxJQUFJLElBQUksZ0JBQWdCLENBQUM7QUFDaEUsUUFBSTtBQUVKLFVBQU0sZ0NBQWdDLE9BQU8sUUFBUSxFQUFFLHdCQUF3QixDQUFDO0FBQ2hGLFdBQU8sK0JBQStCLEVBQUUsMEJBQTBCLFFBQVcsU0FBUyxzQkFBc0Isc0JBQXNCLENBQUMsQ0FBQztBQUNwSSxVQUFNLHNDQUFzQyxPQUFPLCtCQUErQixFQUFFLDhCQUE4QixDQUFDO0FBRW5ILFVBQU0sMkJBQTJCLE9BQU8sK0JBQStCLEVBQUUsNkJBQTZCLENBQUM7QUFDdkcsVUFBTSxRQUFRLEtBQUssa0JBQWtCLFlBQVksSUFBSSxLQUFLLHFCQUFxQjtBQUFBLE1BQWU7QUFBQSxNQUM3RjtBQUFBLE1BQ0E7QUFBQSxNQUNBLElBQUksTUFBNEM7QUFBQSxRQUE1QztBQUNILGVBQVMsa0JBQWtCO0FBQUE7QUFBQSxRQUMzQixZQUFZO0FBQUUsaUJBQU87QUFBQSxRQUFJO0FBQUEsTUFDMUI7QUFBQSxNQUNBO0FBQUEsUUFDQztBQUFBLFVBQ0MsT0FBTztBQUFBLFVBQ1AsU0FBUztBQUFBLFVBQ1QsUUFBUTtBQUFBLFVBQ1IsY0FBYztBQUFBLFVBQ2QsY0FBYztBQUFBLFVBQ2QsWUFBWSxnQ0FBZ0M7QUFBQSxVQUM1QyxRQUFRLEtBQW1EO0FBQUUsbUJBQU87QUFBQSxVQUFLO0FBQUEsUUFDMUU7QUFBQSxRQUNBO0FBQUEsVUFDQyxPQUFPLFNBQVMsbUJBQW1CLE1BQU07QUFBQSxVQUN6QyxTQUFTO0FBQUEsVUFDVCxRQUFRO0FBQUEsVUFDUixZQUFZLCtCQUErQjtBQUFBLFVBQzNDLFFBQVEsS0FBbUQ7QUFBRSxtQkFBTztBQUFBLFVBQUs7QUFBQSxRQUMxRTtBQUFBLFFBQ0E7QUFBQSxVQUNDLE9BQU8sU0FBUyxtQkFBbUIsTUFBTTtBQUFBLFVBQ3pDLFNBQVM7QUFBQSxVQUNULFFBQVE7QUFBQSxVQUNSLFlBQVksK0JBQStCO0FBQUEsVUFDM0MsUUFBUSxLQUFtRDtBQUFFLG1CQUFPO0FBQUEsVUFBSztBQUFBLFFBQzFFO0FBQUEsUUFDQTtBQUFBLFVBQ0MsT0FBTztBQUFBLFVBQ1AsU0FBUztBQUFBLFVBQ1QsUUFBUTtBQUFBLFVBQ1IsY0FBYztBQUFBLFVBQ2QsY0FBYztBQUFBLFVBQ2QsWUFBWSxrQ0FBa0M7QUFBQSxVQUM5QyxRQUFRLEtBQW1EO0FBQUUsbUJBQU87QUFBQSxVQUFLO0FBQUEsUUFDMUU7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxnQ0FBZ0M7QUFBQSxRQUNwQyxLQUFLLHFCQUFxQixlQUFlLDhCQUE4QjtBQUFBLFFBQ3ZFLEtBQUsscUJBQXFCLGVBQWUsOEJBQThCO0FBQUEsUUFDdkUsS0FBSyxxQkFBcUIsZUFBZSxpQ0FBaUM7QUFBQSxNQUMzRTtBQUFBLE1BQ0E7QUFBQSxRQUNDLHFCQUFxQjtBQUFBLFFBQ3JCLHlCQUF5QjtBQUFBLFFBQ3pCLG1CQUFtQjtBQUFBLFFBQ25CLDBCQUEwQjtBQUFBLFFBQzFCLHVCQUF1QjtBQUFBLFVBQ3RCLGNBQWMsQ0FBQyxTQUFnQztBQUM5QyxrQkFBTSxZQUFZLGFBQWEsS0FBSyxjQUFjLEtBQUssU0FBUztBQUNoRSxnQkFBSSxjQUFjLFVBQWEsVUFBVSxXQUFXLEdBQUc7QUFDdEQscUJBQU8sU0FBUywwQkFBMEIsZ0JBQWdCLEtBQUssYUFBYSxZQUFZLEtBQUssU0FBUyxDQUFDO0FBQUEsWUFDeEc7QUFFQSxtQkFBTyxTQUFTLGtDQUFrQyx1QkFBdUIsS0FBSyxhQUFhLFlBQVksS0FBSyxTQUFTLEdBQUcsU0FBUztBQUFBLFVBQ2xJO0FBQUEsVUFDQSxvQkFBb0IsTUFBTSxTQUFTLCtCQUErQiw4QkFBOEI7QUFBQSxRQUNqRztBQUFBLFFBQ0Esa0JBQWtCO0FBQUEsVUFDakIsTUFBTSxTQUFnQztBQUNyQyxtQkFBTyxRQUFRLFVBQVUsU0FBUztBQUFBLFVBQ25DO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUFDLENBQUM7QUFDSCxTQUFLLGdCQUFnQixNQUFNLFVBQVU7QUFDckMsZ0JBQVksSUFBSSxhQUFhLE1BQU0sS0FBSyxrQkFBa0IsTUFBUyxDQUFDO0FBQ3BFLGdCQUFZLElBQUksS0FBSyxnQkFBZ0IscUJBQXNCLE9BQUs7QUFDL0QsVUFBSSxnQkFBZ0I7QUFDbkIsYUFBSyxzQkFBc0IsS0FBSyxFQUFFLFNBQVMsZ0JBQWdCLFVBQVUsQ0FBQyxDQUFDLEVBQUUsU0FBUyxPQUFPLENBQUM7QUFBQSxNQUMzRjtBQUFBLElBQ0QsQ0FBRSxDQUFDO0FBRUgsVUFBTSxzQkFBc0IsT0FBTywrQkFBK0IsRUFBRSxzQ0FBc0MsQ0FBQztBQUMzRyxVQUFNLFlBQVksWUFBWSxJQUFJLElBQUksVUFBVSxtQkFBbUIsQ0FBQztBQUNwRSxVQUFNLFlBQVksS0FBSyxVQUFVLFVBQVUsVUFBVSxFQUFFLE9BQU8sU0FBUyxhQUFhLFlBQVksR0FBRyxHQUFHLG9CQUFvQixDQUFDLENBQUM7QUFDNUgsY0FBVSxRQUFRLFNBQVMsYUFBYSxZQUFZO0FBRXBELGdCQUFZLElBQUksVUFBVSxXQUFXLFlBQVk7QUFDaEQsWUFBTSxPQUFPLE1BQU0sS0FBSyxrQkFBa0IsZUFBZTtBQUFBLFFBQ3hELGdCQUFnQjtBQUFBLFFBQ2hCLGtCQUFrQjtBQUFBLFFBQ2xCLGVBQWU7QUFBQSxRQUNmLFdBQVcsU0FBUyxhQUFhLFlBQVk7QUFBQSxRQUM3QyxPQUFPLFNBQVMsa0JBQWtCLHVCQUF1QjtBQUFBLE1BQzFELENBQUM7QUFDRCxVQUFJLE1BQU07QUFDVCxZQUFJLGdCQUFnQixnQkFBZ0Isd0JBQXdCO0FBQzNELHlCQUFlLEtBQUssaUJBQWlCLE1BQU0sQ0FBQyxDQUFDO0FBQUEsUUFDOUM7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixnQkFBWSxJQUFJLE1BQU0sVUFBVSxVQUFRO0FBQ3ZDLFVBQUksTUFBTSxTQUFTO0FBQ2xCLGFBQUssUUFBUSxlQUFlLGNBQWMsS0FBSyxRQUFRLFNBQVM7QUFBQSxNQUNqRTtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsVUFBTSxjQUFjLE1BQU07QUFDekIsVUFBSSxnQkFBZ0IsZ0JBQWdCLDBCQUEwQixlQUFlLEtBQUssWUFBWSxRQUFRO0FBQ3JHLDRDQUFvQyxjQUFjLFNBQVMsa0NBQWtDLHlEQUF5RDtBQUN0SixpQ0FBeUIsVUFBVSxPQUFPLE1BQU07QUFDaEQsY0FBTTtBQUFBLFVBQU87QUFBQSxVQUFHLE1BQU07QUFBQSxVQUFRLGVBQWUsS0FBSyxXQUNoRCxJQUFJLGdCQUFjLEVBQUUsV0FBVyxnQkFBd0MsZUFBZ0IsS0FBSyxFQUFFLEVBQzlGLEtBQUssQ0FBQyxHQUFHLE1BQU0sS0FBSyxtQkFBbUIsT0FBTyxRQUFRLEVBQUUsV0FBVyxFQUFFLFNBQVMsQ0FBQztBQUFBLFFBQ2pGO0FBQ0EsYUFBSyxPQUFPO0FBQUEsTUFDYixPQUFPO0FBQ04sNENBQW9DLGNBQWMsU0FBUyx5QkFBeUIsaURBQWlEO0FBQ3JJLGlDQUF5QixVQUFVLElBQUksTUFBTTtBQUFBLE1BQzlDO0FBQUEsSUFDRDtBQUVBLFVBQU0sT0FBTztBQUNiLFdBQU87QUFBQSxNQUNOLElBQUksUUFBUSxTQUE2QjtBQUN4Qyx5QkFBaUI7QUFDakIsWUFBSSxRQUFRLGdCQUFnQix3QkFBd0I7QUFDbkQsc0JBQVk7QUFBQSxRQUNiO0FBQ0EsMkJBQW1CLElBQUksZUFBZSxLQUFLLFlBQVksT0FBSztBQUMzRCxjQUFJLGtCQUFrQixFQUFFLFlBQVk7QUFDbkMsd0JBQVk7QUFDWixpQkFBSywwQkFBMEIsS0FBSyxjQUFjO0FBQUEsVUFDbkQ7QUFBQSxRQUNELENBQUMsQ0FBQztBQUFBLE1BQ0g7QUFBQSxNQUNBO0FBQUEsTUFDQSxvQkFBb0IsSUFBSSxnQkFBZ0I7QUFBQSxJQUN6QztBQUFBLEVBQ0Q7QUFBQSxFQUVBLFNBQWU7QUFDZCxRQUFJLEtBQUssaUJBQWlCO0FBQ3pCLFdBQUssZ0JBQWdCLE9BQVEsS0FBSyxnQkFBZ0IsU0FBUyxLQUFNLElBQUksTUFBUztBQUFBLElBQy9FO0FBQUEsRUFDRDtBQUFBLEVBRUEsaUJBQXVCO0FBQ3RCLFFBQUksS0FBSyxpQkFBaUI7QUFDekIsV0FBSyxnQkFBZ0IsYUFBYSxDQUFDLENBQUM7QUFDcEMsV0FBSyxnQkFBZ0IsU0FBUyxDQUFDLENBQUM7QUFBQSxJQUNqQztBQUFBLEVBQ0Q7QUFDRDtBQXBMTSw0QkFBTjtBQUFBLEVBYUc7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQWhCRztBQXNMTixJQUFNLHNDQUFOLGNBQWtELG9DQUFvSTtBQUFBLEVBTXJMLFlBQ3lDLHNCQUN2QztBQUNELFVBQU07QUFGa0M7QUFIekMsU0FBUyxhQUFhLG9DQUFvQztBQUFBLEVBTTFEO0FBQUEsRUFFQSxlQUFlLFFBQTJEO0FBQ3pFLFVBQU0sY0FBYyxJQUFJLGdCQUFnQjtBQUN4QyxVQUFNLFlBQVksT0FBTyxRQUFRLEVBQUUsdUVBQXVFLENBQUM7QUFDM0csVUFBTSxRQUFRLE9BQU8sV0FBVyxFQUFFLDhCQUE4QixDQUFDO0FBRWpFLFVBQU0sUUFBUSxZQUFZLElBQUksSUFBSSxNQUFNLEVBQUUsT0FBTyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQ3RELFdBQU8sT0FBTyxXQUFXLEVBQUUscUNBQXFDLENBQUMsR0FBRyxNQUFNLE9BQU87QUFFakYsVUFBTSxtQkFBbUIsT0FBTyxXQUFXLEVBQUUscUNBQXFDLENBQUM7QUFDbkYsVUFBTSxZQUFZLFlBQVksSUFBSSxLQUFLLHFCQUFxQjtBQUFBLE1BQWU7QUFBQSxNQUMxRTtBQUFBLE1BQ0E7QUFBQSxRQUNDLGVBQWUsWUFBWSxJQUFJLDJCQUEyQixDQUFDO0FBQUEsUUFDM0QsdUJBQXVCO0FBQUEsTUFDeEI7QUFBQSxJQUNELENBQUM7QUFFRCxXQUFPLEVBQUUsT0FBTyxPQUFPLFdBQVcsYUFBYSxvQkFBb0IsWUFBWSxJQUFJLElBQUksZ0JBQWdCLENBQUMsRUFBRTtBQUFBLEVBQzNHO0FBQUEsRUFFQSxjQUFjLEVBQUUsU0FBUywyQkFBMkIsR0FBK0MsT0FBZSxjQUFvRCxRQUFrQztBQUN2TSxpQkFBYSxtQkFBbUIsTUFBTTtBQUN0QyxVQUFNLEVBQUUsU0FBUyxLQUFLLElBQUk7QUFDMUIsUUFBSSxFQUFFLGdCQUFnQix5QkFBeUI7QUFDOUMsWUFBTSxJQUFJLE1BQU0sOEVBQThFO0FBQUEsSUFDL0Y7QUFDQSxRQUFJLFNBQVMsT0FBTyxLQUFLLENBQUMsNkJBQTZCLE9BQU8sR0FBRztBQUNoRSxZQUFNLElBQUksTUFBTSxrQ0FBa0M7QUFBQSxJQUNuRDtBQUVBLFVBQU0sbUJBQW1CLE1BQU07QUFDOUIsbUJBQWEsTUFBTSxTQUFTO0FBQUEsUUFBQztBQUFBLFVBQzVCLE1BQU0sU0FBUyxXQUFXLFNBQVM7QUFBQSxVQUNuQyxTQUFTLFNBQVMsdUJBQXVCLG9DQUFvQyxpQkFBaUI7QUFBQSxVQUM5RixVQUFVLEtBQUssUUFBUSxRQUFRLFlBQVk7QUFBQSxRQUM1QztBQUFBLFFBQ0E7QUFBQSxVQUNDLE1BQU0sS0FBSztBQUFBLFVBQ1gsU0FBUyxTQUFTLHVCQUF1QixnQ0FBZ0MsbUJBQW1CLEtBQUssSUFBSTtBQUFBLFVBQ3JHLFVBQVUsQ0FBQyxLQUFLLFFBQVEsUUFBUSxZQUFZO0FBQUEsUUFDN0M7QUFBQSxNQUFDLENBQUM7QUFBQSxJQUNIO0FBRUEsVUFBTSxvQkFBb0IsS0FBSyxxQkFBcUIsUUFBUSxZQUFZO0FBQ3hFLGlCQUFhLE1BQU0sY0FBYztBQUVqQyxRQUFJLGdCQUFnQiwwQkFBMEIsS0FBSyxRQUFRLFdBQVc7QUFDckUsbUJBQWEsTUFBTSxRQUFRLFVBQVUsSUFBSSxNQUFNO0FBQUEsSUFDaEQsT0FBTztBQUNOLG1CQUFhLE1BQU0sUUFBUSxVQUFVLE9BQU8sTUFBTTtBQUNsRCx1QkFBaUI7QUFDakIsbUJBQWEsbUJBQW1CLElBQUksS0FBSyxZQUFZLE9BQUs7QUFDekQsWUFBSSxFQUFFLE1BQU07QUFDWCwyQkFBaUI7QUFBQSxRQUNsQjtBQUFBLE1BQ0QsQ0FBQyxDQUFDO0FBQ0YsbUJBQWEsbUJBQW1CLElBQUksYUFBYSxNQUFNLFlBQVksQ0FBQ0MsV0FBVSxLQUFLLFFBQVEsUUFBUSxjQUFjQSxXQUFVLENBQUMsQ0FBQyxDQUFDO0FBQUEsSUFDL0g7QUFFQSxVQUFNLFVBQXFCLENBQUM7QUFDNUIsUUFBSSxRQUFRLFlBQVk7QUFDdkIsY0FBUSxLQUFLLFFBQVEsVUFBVTtBQUFBLElBQ2hDO0FBQ0EsUUFBSSxRQUFRLFNBQVMsU0FBUztBQUM3QixjQUFRLEtBQUssR0FBRyxRQUFRLFFBQVEsT0FBTztBQUFBLElBQ3hDO0FBQ0EsaUJBQWEsVUFBVSxXQUFXLE9BQU87QUFBQSxFQUMxQztBQUVEO0FBakZNLG9DQUVXLGNBQWM7QUFGekIsc0NBQU47QUFBQSxFQU9HO0FBQUEsR0FQRztBQW1GTixJQUFNLGlDQUFOLGNBQTZDLG9DQUErSDtBQUFBLEVBTTNLLFlBQzRDLHlCQUNILHNCQUN2QztBQUNELFVBQU07QUFIcUM7QUFDSDtBQUp6QyxTQUFTLGFBQWEsK0JBQStCO0FBQUEsRUFPckQ7QUFBQSxFQUVBLGVBQWUsUUFBc0Q7QUFDcEUsVUFBTSxjQUFjLElBQUksZ0JBQWdCO0FBQ3hDLFVBQU0sWUFBWSxPQUFPLFFBQVEsRUFBRSxrRUFBa0UsQ0FBQztBQUN0RyxVQUFNLGlCQUFpQixPQUFPLFdBQVcsRUFBRSx3Q0FBd0MsQ0FBQztBQUNwRixVQUFNLFFBQVEsT0FBTyxnQkFBZ0IsRUFBRSxrQ0FBa0MsQ0FBQztBQUUxRSxVQUFNLFFBQVEsWUFBWSxJQUFJLElBQUksTUFBTSxFQUFFLE9BQU8sQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUN0RCxXQUFPLE9BQU8sV0FBVyxFQUFFLHFDQUFxQyxDQUFDLEdBQUcsTUFBTSxPQUFPO0FBRWpGLFVBQU0sbUJBQW1CLE9BQU8sV0FBVyxFQUFFLHFDQUFxQyxDQUFDO0FBQ25GLFVBQU0sWUFBWSxZQUFZLElBQUksS0FBSyxxQkFBcUI7QUFBQSxNQUFlO0FBQUEsTUFDMUU7QUFBQSxNQUNBO0FBQUEsUUFDQyxlQUFlLFlBQVksSUFBSSwyQkFBMkIsQ0FBQztBQUFBLFFBQzNELHVCQUF1QjtBQUFBLE1BQ3hCO0FBQUEsSUFDRCxDQUFDO0FBRUQsV0FBTyxFQUFFLE9BQU8sT0FBTyxXQUFXLGFBQWEsb0JBQW9CLFlBQVksSUFBSSxJQUFJLGdCQUFnQixDQUFDLEVBQUU7QUFBQSxFQUMzRztBQUFBLEVBRUEsY0FBYyxFQUFFLFNBQVMsMkJBQTJCLEdBQStDLE9BQWUsY0FBK0MsUUFBa0M7QUFDbE0saUJBQWEsbUJBQW1CLE1BQU07QUFDdEMsVUFBTSxFQUFFLFNBQVMsS0FBSyxJQUFJO0FBQzFCLFFBQUksRUFBRSxnQkFBZ0Isb0JBQW9CO0FBQ3pDLFlBQU0sSUFBSSxNQUFNLG9FQUFvRTtBQUFBLElBQ3JGO0FBQ0EsUUFBSSxTQUFTLE9BQU8sS0FBSyxDQUFDLDZCQUE2QixPQUFPLEdBQUc7QUFDaEUsWUFBTSxJQUFJLE1BQU0sa0NBQWtDO0FBQUEsSUFDbkQ7QUFFQSxVQUFNLG9CQUFvQixLQUFLLHFCQUFxQixRQUFRLFlBQVk7QUFDeEUsaUJBQWEsTUFBTSxjQUFjO0FBRWpDLFVBQU0sbUJBQW1CLE1BQU07QUFDOUIsWUFBTSxVQUFVO0FBQUEsUUFBQztBQUFBLFVBQ2hCLE1BQU0sU0FBUyxXQUFXLFNBQVM7QUFBQSxVQUNuQyxTQUFTLFNBQVMsdUJBQXVCLG9DQUFvQyxpQkFBaUI7QUFBQSxRQUMvRjtBQUFBLFFBQ0E7QUFBQSxVQUNDLE1BQU0sU0FBUyxRQUFRLE1BQU07QUFBQSxVQUM3QixTQUFTLFNBQVMsb0JBQW9CLG9CQUFvQixpQkFBaUI7QUFBQSxRQUM1RTtBQUFBLE1BQUM7QUFDRCxZQUFNLGVBQWUsS0FBSyxnQkFBZ0I7QUFDMUMsWUFBTSxPQUFPLGlCQUFpQixLQUFLLHdCQUF3QixlQUFlLE9BQ3ZFLFNBQVMscUJBQXFCLGNBQWMsWUFBWSxJQUN4RDtBQUNILFVBQUksS0FBSyxZQUFZLE1BQU07QUFDMUIscUJBQWEsTUFBTSxTQUFTO0FBQUEsVUFDM0I7QUFBQSxZQUNDLE1BQU07QUFBQSxZQUNOLFNBQVMsT0FBTyxTQUFTLGlDQUFpQyxpQ0FBaUMsbUJBQW1CLElBQUksSUFBSSxTQUFTLG9CQUFvQixNQUFNO0FBQUEsVUFDMUo7QUFBQSxVQUNBLEdBQUc7QUFBQSxRQUNKLENBQUM7QUFDRCxxQkFBYSxNQUFNLGNBQWMsS0FBSyxZQUFZLFFBQVEsWUFBWSxJQUFJLElBQUksS0FBSyxRQUFRLFFBQVEsWUFBWSxJQUFJLElBQUksQ0FBQztBQUFBLE1BQ3pILE9BQU87QUFDTixxQkFBYSxNQUFNLFNBQVMsT0FBTztBQUNuQyxxQkFBYSxNQUFNLGNBQWMsS0FBSyxRQUFRLFFBQVEsWUFBWSxJQUFJLElBQUksQ0FBQztBQUFBLE1BQzVFO0FBQUEsSUFDRDtBQUVBLFFBQUksS0FBSyxVQUFVO0FBQ2xCLG1CQUFhLG1CQUFtQixJQUFJLGFBQWEsTUFBTSxZQUFZLENBQUFBLFdBQVM7QUFDM0UsYUFBSyxRQUFRLFFBQVEsY0FBY0EsV0FBVSxDQUFDO0FBQzlDLGFBQUssWUFBWSxRQUFRLGNBQWNBLFdBQVUsQ0FBQztBQUFBLE1BQ25ELENBQUMsQ0FBQztBQUFBLElBQ0gsT0FBTztBQUNOLG1CQUFhLG1CQUFtQixJQUFJLGFBQWEsTUFBTSxZQUFZLENBQUFBLFdBQVM7QUFDM0UsYUFBSyxRQUFRLFFBQVEsY0FBY0EsV0FBVSxDQUFDO0FBQUEsTUFDL0MsQ0FBQyxDQUFDO0FBQUEsSUFDSDtBQUVBLHFCQUFpQjtBQUNqQixpQkFBYSxNQUFNLFdBQVcsQ0FBQyxLQUFLLFlBQVksQ0FBQyxLQUFLLGNBQWM7QUFDcEUsaUJBQWEsbUJBQW1CLElBQUksS0FBSyxZQUFZLE9BQUs7QUFDekQsVUFBSSxFQUFFLFlBQVksRUFBRSxTQUFTO0FBQzVCLHFCQUFhLE1BQU0sV0FBVyxDQUFDLEtBQUssWUFBWSxDQUFDLEtBQUssY0FBYztBQUFBLE1BQ3JFO0FBQ0EsVUFBSSxFQUFFLFlBQVksRUFBRSxjQUFjO0FBQ2pDLHlCQUFpQjtBQUFBLE1BQ2xCO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFDRixVQUFNLFVBQXFCLENBQUM7QUFDNUIsUUFBSSxRQUFRLFlBQVk7QUFDdkIsY0FBUSxLQUFLLFFBQVEsVUFBVTtBQUFBLElBQ2hDO0FBQ0EsUUFBSSxRQUFRLFNBQVMsU0FBUztBQUM3QixjQUFRLEtBQUssR0FBRyxRQUFRLFFBQVEsT0FBTztBQUFBLElBQ3hDO0FBQ0EsaUJBQWEsVUFBVSxXQUFXLE9BQU87QUFBQSxFQUMxQztBQUNEO0FBekdNLCtCQUVXLGNBQWM7QUFGekIsaUNBQU47QUFBQSxFQU9HO0FBQUEsRUFDQTtBQUFBLEdBUkc7QUEyR04sSUFBTSx1Q0FBTixjQUFtRCxvQ0FBeUk7QUFBQSxFQVEzTCxZQUN5QyxzQkFDdkM7QUFDRCxVQUFNO0FBRmtDO0FBTHpDLFNBQVMsYUFBYSxxQ0FBcUM7QUFRMUQsU0FBSyxTQUFTLHFCQUFxQixlQUFlLGdCQUFnQix3QkFBd0I7QUFDMUYsU0FBSyxnQkFBZ0IsS0FBSyxVQUFVLHFCQUFxQixlQUFlLHdCQUF3QixTQUFTLFFBQVcsQ0FBQyxDQUFDLENBQUM7QUFBQSxFQUN4SDtBQUFBLEVBRUEsZUFBZSxRQUFnRTtBQUM5RSxVQUFNLGNBQWMsSUFBSSxnQkFBZ0I7QUFDeEMsVUFBTSxZQUFZLE9BQU8sUUFBUSxFQUFFLCtEQUErRCxDQUFDO0FBQ25HLFVBQU0sV0FBVyxZQUFZLElBQUksSUFBSSxTQUFTLElBQUksT0FBTyxxQkFBcUIsQ0FBQztBQUMvRSxXQUFPLFdBQVcsU0FBUyxPQUFPO0FBQ2xDLFVBQU0sZ0JBQWdCLFlBQVksSUFBSSxLQUFLLE9BQU8sT0FBTyxXQUFXLEVBQUUsZUFBZSxLQUFLLGNBQWMsQ0FBQyxDQUFDO0FBRTFHLFVBQU0sbUJBQW1CLE9BQU8sV0FBVyxFQUFFLHFDQUFxQyxDQUFDO0FBQ25GLFVBQU0sWUFBWSxZQUFZLElBQUksS0FBSyxxQkFBcUI7QUFBQSxNQUFlO0FBQUEsTUFDMUU7QUFBQSxNQUNBO0FBQUEsUUFDQyxlQUFlLFlBQVksSUFBSSwyQkFBMkIsQ0FBQztBQUFBLFFBQzNELHVCQUF1QjtBQUFBLE1BQ3hCO0FBQUEsSUFDRCxDQUFDO0FBRUQsV0FBTyxFQUFFLFVBQVUsZUFBZSxXQUFXLGFBQWEsb0JBQW9CLFlBQVksSUFBSSxJQUFJLGdCQUFnQixDQUFDLEVBQUU7QUFBQSxFQUN0SDtBQUFBLEVBRUEsY0FBYyxFQUFFLFNBQVMsMkJBQTJCLEdBQStDLE9BQWUsY0FBeUQsUUFBa0M7QUFDNU0saUJBQWEsbUJBQW1CLE1BQU07QUFDdEMsVUFBTSxFQUFFLFFBQVEsSUFBSTtBQUVwQixRQUFJLFNBQVMsT0FBTyxLQUFLLENBQUMsOEJBQThCLE9BQU8sR0FBRztBQUNqRSxZQUFNLElBQUksTUFBTSxrQ0FBa0M7QUFBQSxJQUNuRDtBQUVBLFFBQUksUUFBUSxVQUFVO0FBQ3JCLG1CQUFhLFNBQVMsUUFBUSxhQUFhLFlBQVksR0FBRztBQUMxRCxtQkFBYSxTQUFTLFFBQVEsVUFBVSxPQUFPLE1BQU07QUFDckQsbUJBQWEsU0FBUyxVQUFVLFFBQVEsU0FBUztBQUNqRCxtQkFBYSxTQUFTLFFBQVEsWUFBWSxRQUFRLFNBQVMsMEJBQTBCLFNBQVM7QUFDOUYsVUFBSSxRQUFRLFNBQVMsMEJBQTBCLE1BQU07QUFDcEQscUJBQWEsU0FBUyxRQUFRLE9BQU8sUUFBUSxTQUFTLHlCQUF5QjtBQUFBLE1BQ2hGO0FBQUEsSUFDRCxPQUFPO0FBQ04sbUJBQWEsU0FBUyxRQUFRLGdCQUFnQixVQUFVO0FBQ3hELG1CQUFhLFNBQVMsUUFBUSxVQUFVLElBQUksTUFBTTtBQUFBLElBQ25EO0FBRUEsaUJBQWEsY0FBYztBQUFBLE1BQzFCO0FBQUEsUUFDQyxNQUFNLFFBQVEsV0FBVyxTQUFTLFFBQVEsUUFBUSxJQUFJLFFBQVE7QUFBQSxRQUM5RCxhQUFhLFFBQVE7QUFBQSxRQUNyQixVQUFVLFFBQVE7QUFBQSxNQUNuQjtBQUFBLE1BQ0E7QUFBQSxRQUNDLFlBQVk7QUFBQSxRQUNaLE1BQU0sUUFBUTtBQUFBLFFBQ2QsVUFBVSxDQUFDLFFBQVEsWUFBWSxDQUFDLFFBQVE7QUFBQSxNQUN6QztBQUFBLElBQUM7QUFDRixVQUFNLFVBQXFCLENBQUM7QUFDNUIsUUFBSSxRQUFRLFlBQVk7QUFDdkIsY0FBUSxLQUFLLFFBQVEsVUFBVTtBQUFBLElBQ2hDO0FBQ0EsUUFBSSxRQUFRLFNBQVMsU0FBUztBQUM3QixjQUFRLEtBQUssR0FBRyxRQUFRLFFBQVEsT0FBTztBQUFBLElBQ3hDO0FBQ0EsaUJBQWEsVUFBVSxXQUFXLE9BQU87QUFBQSxFQUMxQztBQUVEO0FBN0VNLHFDQUVXLGNBQWM7QUFGekIsdUNBQU47QUFBQSxFQVNHO0FBQUEsR0FURztBQStFTixNQUFNLG1DQUFOLE1BQU0saUNBQXFGO0FBQUEsRUFBM0Y7QUFHQyxTQUFTLGFBQXFCLGlDQUFnQztBQUFBO0FBQUEsRUFFOUQsZUFBZSxXQUE0QjtBQUMxQyxXQUFPLENBQUM7QUFBQSxFQUNUO0FBQUEsRUFFQSxjQUFjLE1BQTZCLE9BQWUsY0FBa0IsUUFBa0M7QUFBQSxFQUM5RztBQUFBLEVBRUEsa0JBQXdCO0FBQUEsRUFDeEI7QUFFRDtBQWZNLGlDQUNXLGNBQWM7QUFEL0IsSUFBTSxrQ0FBTjtBQXlCQSxJQUFNLGlDQUFOLE1BQTJIO0FBQUEsRUFLMUgsWUFDdUMsb0JBQ04sY0FDL0I7QUFGcUM7QUFDTjtBQUpqQyxTQUFTLGFBQXFCLCtCQUErQjtBQUFBLEVBS3pEO0FBQUEsRUFFSixlQUFlLFdBQTZEO0FBQzNFLFVBQU0sY0FBYyxJQUFJLGdCQUFnQjtBQUN4QyxVQUFNLG9CQUFvQixZQUFZLElBQUksSUFBSSxnQkFBZ0IsQ0FBQztBQUUvRCxVQUFNLFVBQVUsVUFBVSxZQUFZLEVBQUUsT0FBTyxDQUFDO0FBQ2hELFVBQU0sZ0JBQWdCLFFBQVEsWUFBWSxFQUFFLGdCQUFnQixDQUFDO0FBQzdELFVBQU0scUJBQXFCLFFBQVEsWUFBWSxFQUFFLGdCQUFnQixDQUFDO0FBRWxFLFdBQU87QUFBQSxNQUNOO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFQSxjQUFjLE1BQTZCLE9BQWUsY0FBbUQsUUFBa0M7QUFDOUksaUJBQWEsa0JBQWtCLE1BQU07QUFDckMsaUJBQWEsa0JBQWtCLElBQUksRUFBRSxTQUFTLE1BQU07QUFBRSxnQkFBVSxhQUFhLGtCQUFrQjtBQUFBLElBQUcsRUFBRSxDQUFDO0FBRXJHLGlCQUFhLGNBQWMsWUFBWSxhQUFhLEtBQUssY0FBYyxLQUFLLFNBQVM7QUFDckYsaUJBQWEsUUFBUSxVQUFVLE9BQU8scUJBQXFCLEtBQUssbUJBQW1CLE9BQU8sUUFBUSxLQUFLLFdBQVcsS0FBSyxlQUFlLG9CQUFvQixDQUFDLENBQUM7QUFFNUosaUJBQWEsY0FBYyxNQUFNLFVBQVU7QUFDM0MsaUJBQWEsbUJBQW1CLE1BQU0sVUFBVTtBQUFBLEVBQ2pEO0FBQUEsRUFFQSxnQkFBZ0IsY0FBeUQ7QUFDeEUsaUJBQWEsWUFBWSxRQUFRO0FBQUEsRUFDbEM7QUFFRDtBQTFDTSwrQkFDVyxjQUFjO0FBRHpCLGlDQUFOO0FBQUEsRUFNRztBQUFBLEVBQ0E7QUFBQSxHQVBHO0FBb0ROLElBQU0saUNBQU4sTUFBMkg7QUFBQSxFQU8xSCxZQUN1QyxvQkFDTixjQUMvQjtBQUZxQztBQUNOO0FBTmpDLFNBQVMsYUFBcUIsK0JBQStCO0FBUTVELFNBQUssZ0JBQWdCLHdCQUF3QixPQUFPO0FBQUEsRUFDckQ7QUFBQSxFQUVBLGVBQWUsV0FBNkQ7QUFDM0UsVUFBTSxjQUFjLElBQUksZ0JBQWdCO0FBQ3hDLFVBQU0sVUFBVSxVQUFVLFlBQVksRUFBRSxPQUFPLENBQUM7QUFDaEQsVUFBTSxZQUFZLFFBQVEsWUFBWSxFQUFFLGdCQUFnQixDQUFDO0FBQ3pELFVBQU0sWUFBWSxZQUFZLElBQUksS0FBSyxhQUFhLGtCQUFrQixLQUFLLGVBQWUsV0FBVyxFQUFFLENBQUM7QUFDeEcsVUFBTSxvQkFBb0IsWUFBWSxJQUFJLElBQUksZ0JBQWdCLENBQUM7QUFFL0QsV0FBTztBQUFBLE1BQ047QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLGNBQWMsTUFBNkIsT0FBZSxjQUFtRCxRQUFrQztBQUM5SSxpQkFBYSxrQkFBa0IsTUFBTTtBQUNyQyxVQUFNLGNBQWMsS0FBSyxXQUFXLEtBQUssU0FBUztBQUNsRCxpQkFBYSxVQUFVLFlBQVk7QUFDbkMsaUJBQWEsUUFBUSxVQUFVLE9BQU8scUJBQXFCLEtBQUssbUJBQW1CLE9BQU8sUUFBUSxLQUFLLFdBQVcsS0FBSyxlQUFlLG9CQUFvQixDQUFDLENBQUM7QUFDNUosaUJBQWEsVUFBVSxPQUFPLFdBQVc7QUFBQSxFQUMxQztBQUFBLEVBRUEsZ0JBQWdCLGNBQXlEO0FBQ3hFLGlCQUFhLFlBQVksUUFBUTtBQUNqQyxpQkFBYSxrQkFBa0IsUUFBUTtBQUFBLEVBQ3hDO0FBQUEsRUFFUSxXQUFXLEtBQWtCO0FBQ3BDLFFBQUksSUFBSSxXQUFXLFFBQVEsTUFBTTtBQUNoQyxhQUFPLHFCQUFxQixJQUFJLE1BQU07QUFBQSxJQUN2QztBQUlBLFFBQUksSUFBSSxLQUFLLFdBQVcsTUFBTSxHQUFHLEdBQUc7QUFDbkMsWUFBTSw4QkFBOEIsSUFBSSxLQUFLLFVBQVUsQ0FBQztBQUN4RCxZQUFNLGdCQUFnQixlQUFlLDZCQUE2QixJQUFJO0FBQ3RFLFVBQUksZUFBZTtBQUNsQixlQUFPLHFCQUFxQixNQUFNLFVBQVUsMkJBQTJCLEdBQUcsSUFBSTtBQUFBLE1BQy9FO0FBQUEsSUFDRDtBQUVBLFdBQU8sSUFBSTtBQUFBLEVBQ1o7QUFFRDtBQTdETSwrQkFDVyxjQUFjO0FBRHpCLGlDQUFOO0FBQUEsRUFRRztBQUFBLEVBQ0E7QUFBQSxHQVRHO0FBb0VOLElBQU0sc0JBQU4sY0FBa0MsT0FBTztBQUFBLEVBRXhDLFlBQ2tCLE1BQzBCLHlCQUMxQztBQUNELFVBQU0saUJBQWlCLElBQUksVUFBVSxZQUFZLFFBQVEsQ0FBQztBQUh6QztBQUMwQjtBQUczQyxTQUFLLFVBQVUsU0FBUyxrQkFBa0IsZ0JBQWdCO0FBQUEsRUFDM0Q7QUFBQSxFQUVBLDBCQUFxQztBQUNwQyxXQUFPLEtBQUssd0JBQXdCLFNBQ2xDLE9BQU8sYUFBVyxDQUFDLFFBQVEsV0FBVyxFQUN0QyxLQUFLLENBQUMsR0FBRyxNQUFNLEVBQUUsWUFBWSxLQUFLLEVBQUUsWUFBWSxJQUFJLEVBQUUsS0FBSyxjQUFjLEVBQUUsSUFBSSxDQUFDLEVBQ2hGLElBQWEsY0FBWTtBQUFBLE1BQ3pCLElBQUksa0JBQWtCLFFBQVEsRUFBRTtBQUFBLE1BQ2hDLE9BQU8sUUFBUTtBQUFBLE1BQ2YsT0FBTztBQUFBLE1BQ1AsU0FBUztBQUFBLE1BQ1QsU0FBUyxRQUFRLE9BQU8sS0FBSyxLQUFLLGVBQWUsUUFBUTtBQUFBLE1BQ3pELFNBQVM7QUFBQSxNQUNULEtBQUssTUFBTTtBQUNWLFlBQUksUUFBUSxPQUFPLEtBQUssS0FBSyxlQUFlLFFBQVEsSUFBSTtBQUN2RDtBQUFBLFFBQ0Q7QUFDQSxhQUFLLHdCQUF3QixjQUFjLFNBQVMsRUFBRSxZQUFZLENBQUMsR0FBSSxRQUFRLGNBQWMsQ0FBQyxHQUFJLEtBQUssS0FBSyxTQUFTLEVBQUUsQ0FBQztBQUFBLE1BQ3pIO0FBQUEsSUFDRCxFQUFFO0FBQUEsRUFDSjtBQUNEO0FBN0JNLHNCQUFOO0FBQUEsRUFJRztBQUFBLEdBSkc7QUErQk4sSUFBTSxvQ0FBTixNQUFxSDtBQUFBLEVBTXBILFlBQzRDLHlCQUNTLGtDQUNkLG9CQUNBLG9CQUNyQztBQUowQztBQUNTO0FBQ2Q7QUFDQTtBQU52QyxTQUFTLGFBQXFCLGtDQUFrQztBQUFBLEVBUWhFO0FBQUEsRUFFQSxlQUFlLFdBQW9EO0FBQ2xFLFVBQU0sY0FBYyxJQUFJLGdCQUFnQjtBQUN4QyxVQUFNLFVBQVUsVUFBVSxZQUFZLEVBQUUsdUNBQXVDLENBQUM7QUFDaEYsVUFBTSxnQkFBZ0IsWUFBWSxJQUFJLDJCQUEyQixDQUFDO0FBQ2xFLFVBQU0sWUFBWSxZQUFZLElBQUksSUFBSSxVQUFVLFNBQVM7QUFBQSxNQUN4RDtBQUFBLE1BQ0Esd0JBQXdCLENBQUMsV0FBVztBQUNuQyxZQUFJLGtCQUFrQixxQkFBcUI7QUFDMUMsaUJBQU8sSUFBSSwyQkFBMkIsUUFBUSxFQUFFLFlBQVksTUFBTSxPQUFPLHdCQUF3QixFQUFFLEdBQUcsS0FBSyxvQkFBb0I7QUFBQSxZQUM5SCxZQUFZLE9BQU87QUFBQSxZQUNuQjtBQUFBLFVBQ0QsQ0FBQztBQUFBLFFBQ0Y7QUFDQSxlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBQ0YsV0FBTyxFQUFFLFdBQVcsWUFBWTtBQUFBLEVBQ2pDO0FBQUEsRUFFQSxjQUFjLE1BQTZCLE9BQWUsY0FBMEMsUUFBa0M7QUFDckksaUJBQWEsVUFBVSxNQUFNO0FBQzdCLFVBQU0sVUFBcUIsQ0FBQztBQUM1QixZQUFRLEtBQUssS0FBSyxpQkFBaUIsSUFBSSxDQUFDO0FBQ3hDLFlBQVEsS0FBSyxJQUFJLG9CQUFvQixNQUFNLEtBQUssdUJBQXVCLENBQUM7QUFDeEUsWUFBUSxLQUFLLEtBQUssbUJBQW1CLElBQUksQ0FBQztBQUMxQyxpQkFBYSxVQUFVLEtBQUssU0FBUyxFQUFFLE1BQU0sS0FBSyxDQUFDO0FBQUEsRUFDcEQ7QUFBQSxFQUVRLGlCQUFpQixNQUFzQztBQUM5RCxXQUFPO0FBQUEsTUFDTixPQUFPO0FBQUEsTUFDUCxPQUFPLFVBQVUsWUFBWSxRQUFRLE1BQU07QUFBQSxNQUMzQyxTQUFTLENBQUMsS0FBSyxtQkFBbUIsT0FBTyxRQUFRLEtBQUssV0FBVyxLQUFLLGVBQWUsb0JBQW9CLENBQUM7QUFBQSxNQUMxRyxJQUFJO0FBQUEsTUFDSixTQUFTLFNBQVMsUUFBUSxvQkFBb0I7QUFBQSxNQUM5QyxLQUFLLE1BQU0sS0FBSyxlQUFlLGNBQWMsS0FBSyxTQUFTO0FBQUEsSUFDNUQ7QUFBQSxFQUNEO0FBQUEsRUFFUSxtQkFBbUIsTUFBc0M7QUFDaEUsV0FBTztBQUFBLE1BQ04sT0FBTztBQUFBLE1BQ1AsT0FBTyxVQUFVLFlBQVksVUFBVTtBQUFBLE1BQ3ZDLFNBQVMsS0FBSyxpQ0FBaUMsdUJBQXVCLEVBQUUsT0FBTyxLQUFLLGVBQWUsUUFBUTtBQUFBLE1BQzNHLElBQUk7QUFBQSxNQUNKLFNBQVMsU0FBUyxvQkFBb0IsYUFBYTtBQUFBLE1BQ25ELEtBQUssTUFBTSxLQUFLLGVBQWUsaUJBQWlCLENBQUMsR0FBRyxDQUFDLEtBQUssU0FBUyxDQUFDO0FBQUEsSUFDckU7QUFBQSxFQUNEO0FBQUEsRUFFQSxnQkFBZ0IsY0FBZ0Q7QUFDL0QsaUJBQWEsWUFBWSxRQUFRO0FBQUEsRUFDbEM7QUFFRDtBQXBFTSxrQ0FFVyxjQUFjO0FBRnpCLG9DQUFOO0FBQUEsRUFPRztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBVkc7QUFzRU4sU0FBUyxhQUFhLGNBQTZCLGNBQTJCO0FBQzdFLFNBQU8sYUFBYSxZQUFZLGFBQWEsYUFBYSxhQUFhLFFBQVEsYUFBYSxTQUFTLElBQUksU0FBUyxrQkFBa0IsT0FBTztBQUM1STtBQUVPLElBQU0sOEJBQU4sY0FBMEMsWUFBWTtBQUFBLEVBZTVELFlBQ3lDLHNCQUN2QztBQUNELFVBQU07QUFGa0M7QUFkekMsU0FBUyxXQUFXO0FBSXBCLFNBQVEsU0FBa0I7QUFhekIsU0FBSyxRQUFRLDRCQUE0QixZQUFZLEtBQUssb0JBQW9CO0FBQzlFLFNBQUssVUFBVSxLQUFLLE1BQU0sWUFBWSxPQUFLLEtBQUssUUFBUSxLQUFLLE1BQU0sU0FBUyxLQUFLLGFBQVcsbUJBQW1CLGlCQUFpQixDQUFDLENBQUM7QUFBQSxFQUNuSTtBQUFBLEVBZEEsSUFBSSxRQUFpQjtBQUFFLFdBQU8sS0FBSztBQUFBLEVBQVE7QUFBQSxFQUMzQyxJQUFJLE1BQU0sT0FBZ0I7QUFDekIsUUFBSSxLQUFLLFdBQVcsT0FBTztBQUMxQixXQUFLLFNBQVM7QUFDZCxXQUFLLGtCQUFrQixLQUFLO0FBQUEsSUFDN0I7QUFBQSxFQUNEO0FBQUEsRUFVQSxJQUFhLFNBQWlCO0FBQUUsV0FBTyw0QkFBNEI7QUFBQSxFQUFJO0FBQUEsRUFDOUQsVUFBa0I7QUFBRSxXQUFPLFNBQVMsb0JBQW9CLFVBQVU7QUFBQSxFQUFHO0FBQUEsRUFDckUsVUFBaUM7QUFBRSxXQUFPO0FBQUEsRUFBNEI7QUFBQSxFQUUvRSxNQUFlLFVBQWdEO0FBQzlELFVBQU0sS0FBSyxNQUFNLFFBQVE7QUFDekIsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRVMsVUFBbUI7QUFDM0IsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsTUFBZSxPQUE2QjtBQUMzQyxVQUFNLEtBQUssTUFBTSxlQUFlO0FBQ2hDLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxNQUFlLFNBQXdCO0FBQ3RDLFNBQUssTUFBTSxPQUFPO0FBQUEsRUFDbkI7QUFBQSxFQUVTLFFBQVEsWUFBd0Q7QUFBRSxXQUFPLHNCQUFzQjtBQUFBLEVBQTZCO0FBQUEsRUFFNUgsVUFBZ0I7QUFDeEIsZUFBVyxXQUFXLEtBQUssTUFBTSxVQUFVO0FBQzFDLFVBQUksbUJBQW1CLHdCQUF3QjtBQUM5QyxnQkFBUSxNQUFNO0FBQUEsTUFDZjtBQUFBLElBQ0Q7QUFDQSxVQUFNLFFBQVE7QUFBQSxFQUNmO0FBQ0Q7QUF2RGEsNEJBQ0ksS0FBYTtBQURqQiw4QkFBTjtBQUFBLEVBZ0JKO0FBQUEsR0FoQlU7QUF5RE4sTUFBTSxzQ0FBbUU7QUFBQSxFQUMvRSxhQUFhLGFBQW1DO0FBQUUsV0FBTztBQUFBLEVBQU07QUFBQSxFQUMvRCxVQUFVLGFBQWtDO0FBQUUsV0FBTztBQUFBLEVBQUk7QUFBQSxFQUN6RCxZQUFZLHNCQUEwRDtBQUFFLFdBQU8scUJBQXFCLGVBQWUsMkJBQTJCO0FBQUEsRUFBRztBQUNsSjsiLAogICJuYW1lcyI6IFsiZWxlbWVudFRvU2VsZWN0IiwgInByb2ZpbGVFbGVtZW50IiwgImluZGV4Il0KfQo=
