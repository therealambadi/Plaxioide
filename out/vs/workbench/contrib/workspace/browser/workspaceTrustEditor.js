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
import { $, addDisposableListener, addStandardDisposableListener, append, clearNode, EventHelper, EventType, isAncestorOfActiveElement } from "../../../../base/browser/dom.js";
import { ActionBar } from "../../../../base/browser/ui/actionbar/actionbar.js";
import { ButtonBar } from "../../../../base/browser/ui/button/button.js";
import { InputBox, MessageType } from "../../../../base/browser/ui/inputbox/inputBox.js";
import { DomScrollableElement } from "../../../../base/browser/ui/scrollbar/scrollableElement.js";
import { Action } from "../../../../base/common/actions.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { debounce } from "../../../../base/common/decorators.js";
import { Emitter } from "../../../../base/common/event.js";
import { KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { normalizeDriveLetter } from "../../../../base/common/labels.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { parseLinkedText } from "../../../../base/common/linkedText.js";
import { Schemas } from "../../../../base/common/network.js";
import { ScrollbarVisibility } from "../../../../base/common/scrollable.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { ConfigurationScope, Extensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IContextViewService } from "../../../../platform/contextview/browser/contextView.js";
import { IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { WorkbenchTable } from "../../../../platform/list/browser/listService.js";
import { Link } from "../../../../platform/opener/browser/link.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { isVirtualResource, isVirtualWorkspace } from "../../../../platform/workspace/common/virtualWorkspace.js";
import { IStorageService } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { asCssVariable, buttonBackground, buttonSecondaryBackground, editorErrorForeground } from "../../../../platform/theme/common/colorRegistry.js";
import { IWorkspaceContextService, toWorkspaceIdentifier, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IThemeService } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { EditorPane } from "../../../browser/parts/editor/editorPane.js";
import { debugIconStartForeground } from "../../debug/browser/debugColors.js";
import { IExtensionsWorkbenchService, LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID } from "../../extensions/common/extensions.js";
import { APPLICATION_SCOPES, IWorkbenchConfigurationService } from "../../../services/configuration/common/configuration.js";
import { IExtensionManifestPropertiesService } from "../../../services/extensions/common/extensionManifestPropertiesService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { getExtensionDependencies } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { EnablementState, IWorkbenchExtensionEnablementService } from "../../../services/extensionManagement/common/extensionManagement.js";
import { posix, win32 } from "../../../../base/common/path.js";
import { hasDriveLetter, toSlashes } from "../../../../base/common/extpath.js";
import { StandardKeyboardEvent } from "../../../../base/browser/keyboardEvent.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { registerIcon } from "../../../../platform/theme/common/iconRegistry.js";
import { defaultButtonStyles, defaultInputBoxStyles } from "../../../../platform/theme/browser/defaultStyles.js";
import { isMacintosh } from "../../../../base/common/platform.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { basename, dirname } from "../../../../base/common/resources.js";
const shieldIcon = registerIcon("workspace-trust-banner", Codicon.shield, localize("shieldIcon", "Icon for workspace trust ion the banner."));
const checkListIcon = registerIcon("workspace-trust-editor-check", Codicon.check, localize("checkListIcon", "Icon for the checkmark in the workspace trust editor."));
const xListIcon = registerIcon("workspace-trust-editor-cross", Codicon.x, localize("xListIcon", "Icon for the cross in the workspace trust editor."));
const folderPickerIcon = registerIcon("workspace-trust-editor-folder-picker", Codicon.folder, localize("folderPickerIcon", "Icon for the pick folder icon in the workspace trust editor."));
const editIcon = registerIcon("workspace-trust-editor-edit-folder", Codicon.edit, localize("editIcon", "Icon for the edit folder icon in the workspace trust editor."));
const removeIcon = registerIcon("workspace-trust-editor-remove-folder", Codicon.close, localize("removeIcon", "Icon for the remove folder icon in the workspace trust editor."));
let WorkspaceTrustedUrisTable = class extends Disposable {
  constructor(container, instantiationService, workspaceService, workspaceTrustManagementService, uriService, labelService, fileDialogService) {
    super();
    this.container = container;
    this.instantiationService = instantiationService;
    this.workspaceService = workspaceService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.uriService = uriService;
    this.labelService = labelService;
    this.fileDialogService = fileDialogService;
    this._onDidAcceptEdit = this._register(new Emitter());
    this.onDidAcceptEdit = this._onDidAcceptEdit.event;
    this._onDidRejectEdit = this._register(new Emitter());
    this.onDidRejectEdit = this._onDidRejectEdit.event;
    this._onEdit = this._register(new Emitter());
    this.onEdit = this._onEdit.event;
    this._onDelete = this._register(new Emitter());
    this.onDelete = this._onDelete.event;
    this.descriptionElement = container.appendChild($(".workspace-trusted-folders-description"));
    const tableElement = container.appendChild($(".trusted-uris-table"));
    const addButtonBarElement = container.appendChild($(".trusted-uris-button-bar"));
    this.table = this.instantiationService.createInstance(
      WorkbenchTable,
      "WorkspaceTrust",
      tableElement,
      new TrustedUriTableVirtualDelegate(),
      [
        {
          label: localize("hostColumnLabel", "Host"),
          tooltip: "",
          weight: 1,
          templateId: TrustedUriHostColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        },
        {
          label: localize("pathColumnLabel", "Path"),
          tooltip: "",
          weight: 8,
          templateId: TrustedUriPathColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        },
        {
          label: "",
          tooltip: "",
          weight: 1,
          minimumWidth: 75,
          maximumWidth: 75,
          templateId: TrustedUriActionsColumnRenderer.TEMPLATE_ID,
          project(row) {
            return row;
          }
        }
      ],
      [
        this.instantiationService.createInstance(TrustedUriHostColumnRenderer),
        this.instantiationService.createInstance(TrustedUriPathColumnRenderer, this),
        this.instantiationService.createInstance(TrustedUriActionsColumnRenderer, this, this.currentWorkspaceUri)
      ],
      {
        horizontalScrolling: false,
        alwaysConsumeMouseWheel: false,
        openOnSingleClick: false,
        multipleSelectionSupport: false,
        accessibilityProvider: {
          getAriaLabel: (item) => {
            const hostLabel = getHostLabel(this.labelService, item);
            if (hostLabel === void 0 || hostLabel.length === 0) {
              return localize("trustedFolderAriaLabel", "{0}, trusted", this.labelService.getUriLabel(item.uri));
            }
            return localize("trustedFolderWithHostAriaLabel", "{0} on {1}, trusted", this.labelService.getUriLabel(item.uri), hostLabel);
          },
          getWidgetAriaLabel: () => localize("trustedFoldersAndWorkspaces", "Trusted Folders & Workspaces")
        },
        identityProvider: {
          getId(element) {
            return element.uri.toString();
          }
        }
      }
    );
    this._register(this.table.onDidOpen((item) => {
      if (item && item.element && !item.browserEvent?.defaultPrevented) {
        this.edit(item.element, true);
      }
    }));
    const buttonBar = this._register(new ButtonBar(addButtonBarElement));
    const addButton = this._register(buttonBar.addButton({ title: localize("addButton", "Add Folder"), ...defaultButtonStyles }));
    addButton.label = localize("addButton", "Add Folder");
    this._register(addButton.onDidClick(async () => {
      const uri = await this.fileDialogService.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: this.currentWorkspaceUri,
        openLabel: localize("trustUri", "Trust Folder"),
        title: localize("selectTrustedUri", "Select Folder To Trust")
      });
      if (uri) {
        this.workspaceTrustManagementService.setUrisTrust(uri, true);
      }
    }));
    this._register(this.workspaceTrustManagementService.onDidChangeTrustedFolders(() => {
      this.updateTable();
    }));
  }
  getIndexOfTrustedUriEntry(item) {
    const index = this.trustedUriEntries.indexOf(item);
    if (index === -1) {
      for (let i = 0; i < this.trustedUriEntries.length; i++) {
        if (this.trustedUriEntries[i].uri === item.uri) {
          return i;
        }
      }
    }
    return index;
  }
  selectTrustedUriEntry(item, focus = true) {
    const index = this.getIndexOfTrustedUriEntry(item);
    if (index !== -1) {
      if (focus) {
        this.table.domFocus();
        this.table.setFocus([index]);
      }
      this.table.setSelection([index]);
    }
  }
  get currentWorkspaceUri() {
    return this.workspaceService.getWorkspace().folders[0]?.uri || URI.file("/");
  }
  get trustedUriEntries() {
    const currentWorkspace = this.workspaceService.getWorkspace();
    const currentWorkspaceUris = currentWorkspace.folders.map((folder) => folder.uri);
    if (currentWorkspace.configuration) {
      currentWorkspaceUris.push(currentWorkspace.configuration);
    }
    const entries = this.workspaceTrustManagementService.getTrustedUris().map((uri) => {
      let relatedToCurrentWorkspace = false;
      for (const workspaceUri of currentWorkspaceUris) {
        relatedToCurrentWorkspace = relatedToCurrentWorkspace || this.uriService.extUri.isEqualOrParent(workspaceUri, uri);
      }
      return {
        uri,
        parentOfWorkspaceItem: relatedToCurrentWorkspace
      };
    });
    const sortedEntries = entries.sort((a, b) => {
      if (a.uri.scheme !== b.uri.scheme) {
        if (a.uri.scheme === Schemas.file) {
          return -1;
        }
        if (b.uri.scheme === Schemas.file) {
          return 1;
        }
      }
      const aIsWorkspace = a.uri.path.endsWith(".code-workspace");
      const bIsWorkspace = b.uri.path.endsWith(".code-workspace");
      if (aIsWorkspace !== bIsWorkspace) {
        if (aIsWorkspace) {
          return 1;
        }
        if (bIsWorkspace) {
          return -1;
        }
      }
      return a.uri.fsPath.localeCompare(b.uri.fsPath);
    });
    return sortedEntries;
  }
  layout() {
    this.table.layout(this.trustedUriEntries.length * TrustedUriTableVirtualDelegate.ROW_HEIGHT + TrustedUriTableVirtualDelegate.HEADER_ROW_HEIGHT, void 0);
  }
  updateTable() {
    const entries = this.trustedUriEntries;
    this.container.classList.toggle("empty", entries.length === 0);
    this.descriptionElement.innerText = entries.length ? localize("trustedFoldersDescription", "You trust the following folders, their subfolders, and workspace files.") : localize("noTrustedFoldersDescriptions", "You haven't trusted any folders or workspace files yet.");
    this.table.splice(0, Number.POSITIVE_INFINITY, this.trustedUriEntries);
    this.layout();
  }
  validateUri(path, item) {
    if (!item) {
      return null;
    }
    if (item.uri.scheme === "vscode-vfs") {
      const segments = path.split(posix.sep).filter((s) => s.length);
      if (segments.length === 0 && path.startsWith(posix.sep)) {
        return {
          type: MessageType.WARNING,
          content: localize({ key: "trustAll", comment: ["The {0} will be a host name where repositories are hosted."] }, "You will trust all repositories on {0}.", getHostLabel(this.labelService, item))
        };
      }
      if (segments.length === 1) {
        return {
          type: MessageType.WARNING,
          content: localize({ key: "trustOrg", comment: ["The {0} will be an organization or user name.", "The {1} will be a host name where repositories are hosted."] }, "You will trust all repositories and forks under '{0}' on {1}.", segments[0], getHostLabel(this.labelService, item))
        };
      }
      if (segments.length > 2) {
        return {
          type: MessageType.ERROR,
          content: localize("invalidTrust", "You cannot trust individual folders within a repository.", path)
        };
      }
    }
    return null;
  }
  acceptEdit(item, uri) {
    const trustedFolders = this.workspaceTrustManagementService.getTrustedUris();
    const index = trustedFolders.findIndex((u) => this.uriService.extUri.isEqual(u, item.uri));
    if (index >= trustedFolders.length || index === -1) {
      trustedFolders.push(uri);
    } else {
      trustedFolders[index] = uri;
    }
    this.workspaceTrustManagementService.setTrustedUris(trustedFolders);
    this._onDidAcceptEdit.fire(item);
  }
  rejectEdit(item) {
    this._onDidRejectEdit.fire(item);
  }
  async delete(item) {
    this.table.focusNext();
    await this.workspaceTrustManagementService.setUrisTrust([item.uri], false);
    if (this.table.getFocus().length === 0) {
      this.table.focusLast();
    }
    this._onDelete.fire(item);
    this.table.domFocus();
  }
  async edit(item, usePickerIfPossible) {
    const canUseOpenDialog = item.uri.scheme === Schemas.file || item.uri.scheme === this.currentWorkspaceUri.scheme && this.uriService.extUri.isEqualAuthority(this.currentWorkspaceUri.authority, item.uri.authority) && !isVirtualResource(item.uri);
    if (canUseOpenDialog && usePickerIfPossible) {
      const uri = await this.fileDialogService.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: item.uri,
        openLabel: localize("trustUri", "Trust Folder"),
        title: localize("selectTrustedUri", "Select Folder To Trust")
      });
      if (uri) {
        this.acceptEdit(item, uri[0]);
      } else {
        this.rejectEdit(item);
      }
    } else {
      this.selectTrustedUriEntry(item);
      this._onEdit.fire(item);
    }
  }
};
WorkspaceTrustedUrisTable = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IWorkspaceTrustManagementService),
  __decorateParam(4, IUriIdentityService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, IFileDialogService)
], WorkspaceTrustedUrisTable);
const _TrustedUriTableVirtualDelegate = class _TrustedUriTableVirtualDelegate {
  constructor() {
    this.headerRowHeight = _TrustedUriTableVirtualDelegate.HEADER_ROW_HEIGHT;
  }
  getHeight(item) {
    return _TrustedUriTableVirtualDelegate.ROW_HEIGHT;
  }
};
_TrustedUriTableVirtualDelegate.HEADER_ROW_HEIGHT = 30;
_TrustedUriTableVirtualDelegate.ROW_HEIGHT = 24;
let TrustedUriTableVirtualDelegate = _TrustedUriTableVirtualDelegate;
let TrustedUriActionsColumnRenderer = class {
  constructor(table, currentWorkspaceUri, uriService) {
    this.table = table;
    this.currentWorkspaceUri = currentWorkspaceUri;
    this.uriService = uriService;
    this.templateId = TrustedUriActionsColumnRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const element = container.appendChild($(".actions"));
    const actionBar = new ActionBar(element);
    return { actionBar };
  }
  renderElement(item, index, templateData, height) {
    templateData.actionBar.clear();
    const canUseOpenDialog = item.uri.scheme === Schemas.file || item.uri.scheme === this.currentWorkspaceUri.scheme && this.uriService.extUri.isEqualAuthority(this.currentWorkspaceUri.authority, item.uri.authority) && !isVirtualResource(item.uri);
    const actions = [];
    if (canUseOpenDialog) {
      actions.push(this.createPickerAction(item));
    }
    actions.push(this.createEditAction(item));
    actions.push(this.createDeleteAction(item));
    templateData.actionBar.push(actions, { icon: true });
  }
  createEditAction(item) {
    return {
      label: "",
      class: ThemeIcon.asClassName(editIcon),
      enabled: true,
      id: "editTrustedUri",
      tooltip: localize("editTrustedUri", "Edit Path"),
      run: () => {
        this.table.edit(item, false);
      }
    };
  }
  createPickerAction(item) {
    return {
      label: "",
      class: ThemeIcon.asClassName(folderPickerIcon),
      enabled: true,
      id: "pickerTrustedUri",
      tooltip: localize("pickerTrustedUri", "Open File Picker"),
      run: () => {
        this.table.edit(item, true);
      }
    };
  }
  createDeleteAction(item) {
    return {
      label: "",
      class: ThemeIcon.asClassName(removeIcon),
      enabled: true,
      id: "deleteTrustedUri",
      tooltip: localize("deleteTrustedUri", "Delete Path"),
      run: async () => {
        await this.table.delete(item);
      }
    };
  }
  disposeTemplate(templateData) {
    templateData.actionBar.dispose();
  }
};
TrustedUriActionsColumnRenderer.TEMPLATE_ID = "actions";
TrustedUriActionsColumnRenderer = __decorateClass([
  __decorateParam(2, IUriIdentityService)
], TrustedUriActionsColumnRenderer);
let TrustedUriPathColumnRenderer = class {
  constructor(table, contextViewService) {
    this.table = table;
    this.contextViewService = contextViewService;
    this.templateId = TrustedUriPathColumnRenderer.TEMPLATE_ID;
  }
  renderTemplate(container) {
    const element = container.appendChild($(".path"));
    const pathLabel = element.appendChild($("div.path-label"));
    const pathInput = new InputBox(element, this.contextViewService, {
      validationOptions: {
        validation: (value) => this.table.validateUri(value, this.currentItem)
      },
      inputBoxStyles: defaultInputBoxStyles
    });
    const disposables = new DisposableStore();
    const renderDisposables = disposables.add(new DisposableStore());
    return {
      element,
      pathLabel,
      pathInput,
      disposables,
      renderDisposables
    };
  }
  renderElement(item, index, templateData, height) {
    templateData.renderDisposables.clear();
    this.currentItem = item;
    templateData.renderDisposables.add(this.table.onEdit(async (e) => {
      if (item === e) {
        templateData.element.classList.add("input-mode");
        templateData.pathInput.focus();
        templateData.pathInput.select();
        templateData.element.parentElement.style.paddingLeft = "0px";
      }
    }));
    templateData.renderDisposables.add(addDisposableListener(templateData.pathInput.element, EventType.DBLCLICK, (e) => {
      EventHelper.stop(e);
    }));
    const hideInputBox = () => {
      templateData.element.classList.remove("input-mode");
      templateData.element.parentElement.style.paddingLeft = "5px";
    };
    const accept = () => {
      hideInputBox();
      const pathToUse = templateData.pathInput.value;
      const uri = hasDriveLetter(pathToUse) ? item.uri.with({ path: posix.sep + toSlashes(pathToUse) }) : item.uri.with({ path: pathToUse });
      templateData.pathLabel.innerText = this.formatPath(uri);
      if (uri) {
        this.table.acceptEdit(item, uri);
      }
    };
    const reject = () => {
      hideInputBox();
      templateData.pathInput.value = stringValue;
      this.table.rejectEdit(item);
    };
    templateData.renderDisposables.add(addStandardDisposableListener(templateData.pathInput.inputElement, EventType.KEY_DOWN, (e) => {
      let handled = false;
      if (e.equals(KeyCode.Enter)) {
        accept();
        handled = true;
      } else if (e.equals(KeyCode.Escape)) {
        reject();
        handled = true;
      }
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    }));
    templateData.renderDisposables.add(addDisposableListener(templateData.pathInput.inputElement, EventType.BLUR, () => {
      reject();
    }));
    const stringValue = this.formatPath(item.uri);
    templateData.pathInput.value = stringValue;
    templateData.pathLabel.innerText = stringValue;
    templateData.element.classList.toggle("current-workspace-parent", item.parentOfWorkspaceItem);
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
TrustedUriPathColumnRenderer.TEMPLATE_ID = "path";
TrustedUriPathColumnRenderer = __decorateClass([
  __decorateParam(1, IContextViewService)
], TrustedUriPathColumnRenderer);
function getHostLabel(labelService, item) {
  return item.uri.authority ? labelService.getHostLabel(item.uri.scheme, item.uri.authority) : localize("localAuthority", "Local");
}
let TrustedUriHostColumnRenderer = class {
  constructor(labelService) {
    this.labelService = labelService;
    this.templateId = TrustedUriHostColumnRenderer.TEMPLATE_ID;
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
    templateData.hostContainer.innerText = getHostLabel(this.labelService, item);
    templateData.element.classList.toggle("current-workspace-parent", item.parentOfWorkspaceItem);
    templateData.hostContainer.style.display = "";
    templateData.buttonBarContainer.style.display = "none";
  }
  disposeTemplate(templateData) {
    templateData.disposables.dispose();
  }
};
TrustedUriHostColumnRenderer.TEMPLATE_ID = "host";
TrustedUriHostColumnRenderer = __decorateClass([
  __decorateParam(0, ILabelService)
], TrustedUriHostColumnRenderer);
let WorkspaceTrustEditor = class extends EditorPane {
  constructor(group, telemetryService, themeService, storageService, workspaceService, extensionWorkbenchService, extensionManifestPropertiesService, instantiationService, workspaceTrustManagementService, configurationService, extensionEnablementService, productService, keybindingService) {
    super(WorkspaceTrustEditor.ID, group, telemetryService, themeService, storageService);
    this.workspaceService = workspaceService;
    this.extensionWorkbenchService = extensionWorkbenchService;
    this.extensionManifestPropertiesService = extensionManifestPropertiesService;
    this.instantiationService = instantiationService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.configurationService = configurationService;
    this.extensionEnablementService = extensionEnablementService;
    this.productService = productService;
    this.keybindingService = keybindingService;
    this.rendering = false;
    this.rerenderDisposables = this._register(new DisposableStore());
    this.layoutParticipants = [];
  }
  createEditor(parent) {
    this.rootElement = append(parent, $(".workspace-trust-editor", { tabindex: "0" }));
    this.createHeaderElement(this.rootElement);
    const scrollableContent = $(".workspace-trust-editor-body");
    this.bodyScrollBar = this._register(new DomScrollableElement(scrollableContent, {
      horizontal: ScrollbarVisibility.Hidden,
      vertical: ScrollbarVisibility.Auto
    }));
    append(this.rootElement, this.bodyScrollBar.getDomNode());
    this.createAffectedFeaturesElement(scrollableContent);
    this.createConfigurationElement(scrollableContent);
    this.rootElement.style.setProperty("--workspace-trust-selected-color", asCssVariable(buttonBackground));
    this.rootElement.style.setProperty("--workspace-trust-unselected-color", asCssVariable(buttonSecondaryBackground));
    this.rootElement.style.setProperty("--workspace-trust-check-color", asCssVariable(debugIconStartForeground));
    this.rootElement.style.setProperty("--workspace-trust-x-color", asCssVariable(editorErrorForeground));
    this._register(addDisposableListener(this.rootElement, EventType.KEY_DOWN, (e) => {
      const event = new StandardKeyboardEvent(e);
      if (event.equals(KeyCode.UpArrow) || event.equals(KeyCode.DownArrow)) {
        const navOrder = [this.headerContainer, this.trustedContainer, this.untrustedContainer, this.configurationContainer];
        const currentIndex = navOrder.findIndex((element) => {
          return isAncestorOfActiveElement(element);
        });
        let newIndex = currentIndex;
        if (event.equals(KeyCode.DownArrow)) {
          newIndex++;
        } else if (event.equals(KeyCode.UpArrow)) {
          newIndex = Math.max(0, newIndex);
          newIndex--;
        }
        newIndex += navOrder.length;
        newIndex %= navOrder.length;
        navOrder[newIndex].focus();
      } else if (event.equals(KeyCode.Escape)) {
        this.rootElement.focus();
      } else if (event.equals(KeyMod.CtrlCmd | KeyCode.Enter)) {
        if (this.workspaceTrustManagementService.canSetWorkspaceTrust()) {
          this.workspaceTrustManagementService.setWorkspaceTrust(!this.workspaceTrustManagementService.isWorkspaceTrusted());
        }
      } else if (event.equals(KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.Enter)) {
        if (this.workspaceTrustManagementService.canSetParentFolderTrust()) {
          this.workspaceTrustManagementService.setParentFolderTrust(true);
        }
      }
    }));
  }
  focus() {
    super.focus();
    this.rootElement.focus();
  }
  async setInput(input, options, context, token) {
    await super.setInput(input, options, context, token);
    if (token.isCancellationRequested) {
      return;
    }
    await this.workspaceTrustManagementService.workspaceTrustInitialized;
    this.registerListeners();
    await this.render();
  }
  registerListeners() {
    this._register(this.extensionWorkbenchService.onChange(() => this.render()));
    this._register(this.configurationService.onDidChangeRestrictedSettings(() => this.render()));
    this._register(this.workspaceTrustManagementService.onDidChangeTrust(() => this.render()));
    this._register(this.workspaceTrustManagementService.onDidChangeTrustedFolders(() => this.render()));
  }
  getHeaderContainerClass(trusted) {
    if (trusted) {
      return "workspace-trust-header workspace-trust-trusted";
    }
    return "workspace-trust-header workspace-trust-untrusted";
  }
  getHeaderTitleText(trusted) {
    if (trusted) {
      if (this.workspaceTrustManagementService.isWorkspaceTrustForced()) {
        return localize("trustedUnsettableWindow", "This window is trusted");
      }
      switch (this.workspaceService.getWorkbenchState()) {
        case WorkbenchState.EMPTY:
          return localize("trustedHeaderWindow", "You trust this window");
        case WorkbenchState.FOLDER:
          return localize("trustedHeaderFolder", "You trust this folder");
        case WorkbenchState.WORKSPACE:
          return localize("trustedHeaderWorkspace", "You trust this workspace");
      }
    }
    return localize("untrustedHeader", "You are in Restricted Mode");
  }
  getHeaderTitleIconClassNames(trusted) {
    return ThemeIcon.asClassNameArray(shieldIcon);
  }
  getFeaturesHeaderText(trusted) {
    let title = "";
    let subTitle = "";
    switch (this.workspaceService.getWorkbenchState()) {
      case WorkbenchState.EMPTY: {
        title = trusted ? localize("trustedWindow", "In a Trusted Window") : localize("untrustedWorkspace", "In Restricted Mode");
        subTitle = trusted ? localize("trustedWindowSubtitle", "You trust the authors of the files in the current window. All features are enabled:") : localize("untrustedWindowSubtitle", "You do not trust the authors of the files in the current window. The following features are disabled:");
        break;
      }
      case WorkbenchState.FOLDER: {
        title = trusted ? localize("trustedFolder", "In a Trusted Folder") : localize("untrustedWorkspace", "In Restricted Mode");
        subTitle = trusted ? localize("trustedFolderSubtitle", "You trust the authors of the files in the current folder. All features are enabled:") : localize("untrustedFolderSubtitle", "You do not trust the authors of the files in the current folder. The following features are disabled:");
        break;
      }
      case WorkbenchState.WORKSPACE: {
        title = trusted ? localize("trustedWorkspace", "In a Trusted Workspace") : localize("untrustedWorkspace", "In Restricted Mode");
        subTitle = trusted ? localize("trustedWorkspaceSubtitle", "You trust the authors of the files in the current workspace. All features are enabled:") : localize("untrustedWorkspaceSubtitle", "You do not trust the authors of the files in the current workspace. The following features are disabled:");
        break;
      }
    }
    return [title, subTitle];
  }
  async render() {
    if (this.rendering) {
      return;
    }
    this.rendering = true;
    this.rerenderDisposables.clear();
    const isWorkspaceTrusted = this.workspaceTrustManagementService.isWorkspaceTrusted();
    this.rootElement.classList.toggle("trusted", isWorkspaceTrusted);
    this.rootElement.classList.toggle("untrusted", !isWorkspaceTrusted);
    this.headerTitleText.innerText = this.getHeaderTitleText(isWorkspaceTrusted);
    this.headerTitleIcon.className = "workspace-trust-title-icon";
    this.headerTitleIcon.classList.add(...this.getHeaderTitleIconClassNames(isWorkspaceTrusted));
    this.headerDescription.innerText = "";
    const headerDescriptionText = append(this.headerDescription, $("div"));
    headerDescriptionText.innerText = isWorkspaceTrusted ? localize("trustedDescription", "All features are enabled because trust has been granted to the workspace.") : localize("untrustedDescription", "{0} is in a restricted mode intended for safe code browsing.", this.productService.nameShort);
    const headerDescriptionActions = append(this.headerDescription, $("div"));
    const headerDescriptionActionsText = localize({ key: "workspaceTrustEditorHeaderActions", comment: ["Please ensure the markdown link syntax is not broken up with whitespace [text block](link block)"] }, "[Configure your settings]({0}) or [learn more](https://aka.ms/vscode-workspace-trust).", `command:workbench.trust.configure`);
    for (const node of parseLinkedText(headerDescriptionActionsText).nodes) {
      if (typeof node === "string") {
        append(headerDescriptionActions, document.createTextNode(node));
      } else {
        this.rerenderDisposables.add(this.instantiationService.createInstance(Link, headerDescriptionActions, { ...node, tabIndex: -1 }, {}));
      }
    }
    this.headerContainer.className = this.getHeaderContainerClass(isWorkspaceTrusted);
    this.rootElement.setAttribute("aria-label", `${localize("root element label", "Manage Workspace Trust")}:  ${this.headerContainer.innerText}`);
    const restrictedSettings = this.configurationService.restrictedSettings;
    const configurationRegistry = Registry.as(Extensions.Configuration);
    const settingsRequiringTrustedWorkspaceCount = restrictedSettings.default.filter((key) => {
      const property = configurationRegistry.getConfigurationProperties()[key];
      if (property.scope && (APPLICATION_SCOPES.includes(property.scope) || property.scope === ConfigurationScope.MACHINE)) {
        return false;
      }
      if (property.deprecationMessage || property.markdownDeprecationMessage) {
        if (restrictedSettings.workspace?.includes(key)) {
          return true;
        }
        if (restrictedSettings.workspaceFolder) {
          for (const workspaceFolderSettings of restrictedSettings.workspaceFolder.values()) {
            if (workspaceFolderSettings.includes(key)) {
              return true;
            }
          }
        }
        return false;
      }
      return true;
    }).length;
    this.renderAffectedFeatures(settingsRequiringTrustedWorkspaceCount, this.getExtensionCount());
    this.workspaceTrustedUrisTable.updateTable();
    this.bodyScrollBar.getDomNode().style.height = `calc(100% - ${this.headerContainer.clientHeight}px)`;
    this.bodyScrollBar.scanDomNode();
    this.rendering = false;
  }
  getExtensionCount() {
    const set = /* @__PURE__ */ new Set();
    const inVirtualWorkspace = isVirtualWorkspace(this.workspaceService.getWorkspace());
    const localExtensions = this.extensionWorkbenchService.local.filter((ext) => ext.local).map((ext) => ext.local);
    for (const extension of localExtensions) {
      const enablementState = this.extensionEnablementService.getEnablementState(extension);
      if (enablementState !== EnablementState.EnabledGlobally && enablementState !== EnablementState.EnabledWorkspace && enablementState !== EnablementState.DisabledByTrustRequirement && enablementState !== EnablementState.DisabledByExtensionDependency) {
        continue;
      }
      if (inVirtualWorkspace && this.extensionManifestPropertiesService.getExtensionVirtualWorkspaceSupportType(extension.manifest) === false) {
        continue;
      }
      if (this.extensionManifestPropertiesService.getExtensionUntrustedWorkspaceSupportType(extension.manifest) !== true) {
        set.add(extension.identifier.id);
        continue;
      }
      const dependencies = getExtensionDependencies(localExtensions, extension);
      if (dependencies.some((ext) => this.extensionManifestPropertiesService.getExtensionUntrustedWorkspaceSupportType(ext.manifest) === false)) {
        set.add(extension.identifier.id);
      }
    }
    return set.size;
  }
  createHeaderElement(parent) {
    this.headerContainer = append(parent, $(".workspace-trust-header", { tabIndex: "0" }));
    this.headerTitleContainer = append(this.headerContainer, $(".workspace-trust-title"));
    this.headerTitleIcon = append(this.headerTitleContainer, $(".workspace-trust-title-icon"));
    this.headerTitleText = append(this.headerTitleContainer, $(".workspace-trust-title-text"));
    this.headerDescription = append(this.headerContainer, $(".workspace-trust-description"));
  }
  createConfigurationElement(parent) {
    this.configurationContainer = append(parent, $(".workspace-trust-settings", { tabIndex: "0" }));
    const configurationTitle = append(this.configurationContainer, $(".workspace-trusted-folders-title"));
    configurationTitle.innerText = localize("trustedFoldersAndWorkspaces", "Trusted Folders & Workspaces");
    this.workspaceTrustedUrisTable = this._register(this.instantiationService.createInstance(WorkspaceTrustedUrisTable, this.configurationContainer));
  }
  createAffectedFeaturesElement(parent) {
    this.affectedFeaturesContainer = append(parent, $(".workspace-trust-features"));
    this.trustedContainer = append(this.affectedFeaturesContainer, $(".workspace-trust-limitations.trusted", { tabIndex: "0" }));
    this.untrustedContainer = append(this.affectedFeaturesContainer, $(".workspace-trust-limitations.untrusted", { tabIndex: "0" }));
  }
  async renderAffectedFeatures(numSettings, numExtensions) {
    clearNode(this.trustedContainer);
    clearNode(this.untrustedContainer);
    const [trustedTitle, trustedSubTitle] = this.getFeaturesHeaderText(true);
    this.renderLimitationsHeaderElement(this.trustedContainer, trustedTitle, trustedSubTitle);
    const trustedContainerItems = this.workspaceService.getWorkbenchState() === WorkbenchState.EMPTY ? [
      localize("trustedTasks", "Tasks are allowed to run"),
      localize("trustedDebugging", "Debugging is enabled"),
      localize("trustedExtensions", "All enabled extensions are activated")
    ] : [
      localize("trustedTasks", "Tasks are allowed to run"),
      localize("trustedDebugging", "Debugging is enabled"),
      localize("trustedSettings", "All workspace settings are applied"),
      localize("trustedExtensions", "All enabled extensions are activated")
    ];
    this.renderLimitationsListElement(this.trustedContainer, trustedContainerItems, ThemeIcon.asClassNameArray(checkListIcon));
    const [untrustedTitle, untrustedSubTitle] = this.getFeaturesHeaderText(false);
    this.renderLimitationsHeaderElement(this.untrustedContainer, untrustedTitle, untrustedSubTitle);
    const untrustedContainerItems = this.workspaceService.getWorkbenchState() === WorkbenchState.EMPTY ? [
      localize("untrustedTasks", "Tasks are not allowed to run"),
      localize("untrustedDebugging", "Debugging is disabled"),
      fixBadLocalizedLinks(localize({ key: "untrustedExtensions", comment: ["Please ensure the markdown link syntax is not broken up with whitespace [text block](link block)"] }, "[{0} extensions]({1}) are disabled or have limited functionality", numExtensions, `command:${LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID}`))
    ] : [
      localize("untrustedTasks", "Tasks are not allowed to run"),
      localize("untrustedDebugging", "Debugging is disabled"),
      fixBadLocalizedLinks(numSettings ? localize({ key: "untrustedSettings", comment: ["Please ensure the markdown link syntax is not broken up with whitespace [text block](link block)"] }, "[{0} workspace settings]({1}) are not applied", numSettings, "command:settings.filterUntrusted") : localize("no untrustedSettings", "Workspace settings requiring trust are not applied")),
      fixBadLocalizedLinks(localize({ key: "untrustedExtensions", comment: ["Please ensure the markdown link syntax is not broken up with whitespace [text block](link block)"] }, "[{0} extensions]({1}) are disabled or have limited functionality", numExtensions, `command:${LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID}`))
    ];
    this.renderLimitationsListElement(this.untrustedContainer, untrustedContainerItems, ThemeIcon.asClassNameArray(xListIcon));
    if (this.workspaceTrustManagementService.isWorkspaceTrusted()) {
      if (this.workspaceTrustManagementService.canSetWorkspaceTrust()) {
        this.addDontTrustButtonToElement(this.untrustedContainer);
      } else {
        this.addTrustedTextToElement(this.untrustedContainer);
      }
    } else {
      if (this.workspaceTrustManagementService.canSetWorkspaceTrust()) {
        this.addTrustButtonToElement(this.trustedContainer);
      }
    }
  }
  createButtonRow(parent, buttonInfo, enabled) {
    const buttonRow = append(parent, $(".workspace-trust-buttons-row"));
    const buttonContainer = append(buttonRow, $(".workspace-trust-buttons"));
    const buttonBar = this.rerenderDisposables.add(new ButtonBar(buttonContainer));
    for (const { action, keybinding } of buttonInfo) {
      const button = buttonBar.addButtonWithDescription(defaultButtonStyles);
      button.label = action.label;
      button.enabled = enabled !== void 0 ? enabled : action.enabled;
      button.description = keybinding.getLabel();
      button.element.ariaLabel = action.label + ", " + localize("keyboardShortcut", "Keyboard Shortcut: {0}", keybinding.getAriaLabel());
      this.rerenderDisposables.add(button.onDidClick((e) => {
        if (e) {
          EventHelper.stop(e, true);
        }
        action.run();
      }));
    }
  }
  addTrustButtonToElement(parent) {
    const trustAction = this.rerenderDisposables.add(new Action("workspace.trust.button.action.grant", localize("trustButton", "Trust"), void 0, true, async () => {
      await this.workspaceTrustManagementService.setWorkspaceTrust(true);
    }));
    const trustActions = [{ action: trustAction, keybinding: this.keybindingService.resolveUserBinding(isMacintosh ? "Cmd+Enter" : "Ctrl+Enter")[0] }];
    if (this.workspaceTrustManagementService.canSetParentFolderTrust()) {
      const workspaceIdentifier = toWorkspaceIdentifier(this.workspaceService.getWorkspace());
      const name = basename(dirname(workspaceIdentifier.uri));
      const trustMessageElement = append(parent, $(".trust-message-box"));
      trustMessageElement.innerText = localize("trustMessage", "Trust the authors of all files in the current folder or its parent '{0}'.", name);
      const trustParentAction = this.rerenderDisposables.add(new Action("workspace.trust.button.action.grantParent", localize("trustParentButton", "Trust Parent"), void 0, true, async () => {
        await this.workspaceTrustManagementService.setParentFolderTrust(true);
      }));
      trustActions.push({ action: trustParentAction, keybinding: this.keybindingService.resolveUserBinding(isMacintosh ? "Cmd+Shift+Enter" : "Ctrl+Shift+Enter")[0] });
    }
    this.createButtonRow(parent, trustActions);
  }
  addDontTrustButtonToElement(parent) {
    this.createButtonRow(parent, [{
      action: this.rerenderDisposables.add(new Action("workspace.trust.button.action.deny", localize("dontTrustButton", "Don't Trust"), void 0, true, async () => {
        await this.workspaceTrustManagementService.setWorkspaceTrust(false);
      })),
      keybinding: this.keybindingService.resolveUserBinding(isMacintosh ? "Cmd+Enter" : "Ctrl+Enter")[0]
    }]);
  }
  addTrustedTextToElement(parent) {
    if (this.workspaceService.getWorkbenchState() === WorkbenchState.EMPTY) {
      return;
    }
    const textElement = append(parent, $(".workspace-trust-untrusted-description"));
    if (!this.workspaceTrustManagementService.isWorkspaceTrustForced()) {
      textElement.innerText = this.workspaceService.getWorkbenchState() === WorkbenchState.WORKSPACE ? localize("untrustedWorkspaceReason", "This workspace is trusted via the bolded entries in the trusted folders below.") : localize("untrustedFolderReason", "This folder is trusted via the bolded entries in the trusted folders below.");
    } else {
      textElement.innerText = localize("trustedForcedReason", "This window is trusted by nature of the workspace that is opened.");
    }
  }
  renderLimitationsHeaderElement(parent, headerText, subtitleText) {
    const limitationsHeaderContainer = append(parent, $(".workspace-trust-limitations-header"));
    const titleElement = append(limitationsHeaderContainer, $(".workspace-trust-limitations-title"));
    const textElement = append(titleElement, $(".workspace-trust-limitations-title-text"));
    const subtitleElement = append(limitationsHeaderContainer, $(".workspace-trust-limitations-subtitle"));
    textElement.innerText = headerText;
    subtitleElement.innerText = subtitleText;
  }
  renderLimitationsListElement(parent, limitations, iconClassNames) {
    const listContainer = append(parent, $(".workspace-trust-limitations-list-container"));
    const limitationsList = append(listContainer, $("ul"));
    for (const limitation of limitations) {
      const limitationListItem = append(limitationsList, $("li"));
      const icon = append(limitationListItem, $(".list-item-icon"));
      const text = append(limitationListItem, $(".list-item-text"));
      icon.classList.add(...iconClassNames);
      const linkedText = parseLinkedText(limitation);
      for (const node of linkedText.nodes) {
        if (typeof node === "string") {
          append(text, document.createTextNode(node));
        } else {
          this.rerenderDisposables.add(this.instantiationService.createInstance(Link, text, { ...node, tabIndex: -1 }, {}));
        }
      }
    }
  }
  layout(dimension) {
    if (!this.isVisible()) {
      return;
    }
    this.workspaceTrustedUrisTable.layout();
    this.layoutParticipants.forEach((participant) => {
      participant.layout();
    });
    this.bodyScrollBar.scanDomNode();
  }
};
WorkspaceTrustEditor.ID = "workbench.editor.workspaceTrust";
__decorateClass([
  debounce(100)
], WorkspaceTrustEditor.prototype, "render", 1);
WorkspaceTrustEditor = __decorateClass([
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IThemeService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, IExtensionsWorkbenchService),
  __decorateParam(6, IExtensionManifestPropertiesService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IWorkspaceTrustManagementService),
  __decorateParam(9, IWorkbenchConfigurationService),
  __decorateParam(10, IWorkbenchExtensionEnablementService),
  __decorateParam(11, IProductService),
  __decorateParam(12, IKeybindingService)
], WorkspaceTrustEditor);
function fixBadLocalizedLinks(badString) {
  const regex = /(.*)\[(.+)\]\s*\((.+)\)(.*)/;
  return badString.replace(regex, "$1[$2]($3)$4");
}
export {
  WorkspaceTrustEditor,
  shieldIcon
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi93b3Jrc3BhY2UvYnJvd3Nlci93b3Jrc3BhY2VUcnVzdEVkaXRvci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7ICQsIGFkZERpc3Bvc2FibGVMaXN0ZW5lciwgYWRkU3RhbmRhcmREaXNwb3NhYmxlTGlzdGVuZXIsIGFwcGVuZCwgY2xlYXJOb2RlLCBEaW1lbnNpb24sIEV2ZW50SGVscGVyLCBFdmVudFR5cGUsIGlzQW5jZXN0b3JPZkFjdGl2ZUVsZW1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IEFjdGlvbkJhciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9hY3Rpb25iYXIvYWN0aW9uYmFyLmpzJztcbmltcG9ydCB7IEJ1dHRvbkJhciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9idXR0b24vYnV0dG9uLmpzJztcbmltcG9ydCB7IElNZXNzYWdlLCBJbnB1dEJveCwgTWVzc2FnZVR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvaW5wdXRib3gvaW5wdXRCb3guanMnO1xuaW1wb3J0IHsgRG9tU2Nyb2xsYWJsZUVsZW1lbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvc2Nyb2xsYmFyL3Njcm9sbGFibGVFbGVtZW50LmpzJztcbmltcG9ydCB7IElUYWJsZVJlbmRlcmVyLCBJVGFibGVWaXJ0dWFsRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvdGFibGUvdGFibGUuanMnO1xuaW1wb3J0IHsgQWN0aW9uLCBJQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgZGVib3VuY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9kZWNvcmF0b3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgS2V5Q29kZSwgS2V5TW9kIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5Q29kZXMuanMnO1xuaW1wb3J0IHsgbm9ybWFsaXplRHJpdmVMZXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9sYWJlbHMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IHBhcnNlTGlua2VkVGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpbmtlZFRleHQuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgU2Nyb2xsYmFyVmlzaWJpbGl0eSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Njcm9sbGFibGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25TY29wZSwgRXh0ZW5zaW9ucywgSUNvbmZpZ3VyYXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dFZpZXdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBJRmlsZURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBXb3JrYmVuY2hUYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xpc3QvYnJvd3Nlci9saXN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBMaW5rIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2Jyb3dzZXIvbGluay5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBpc1ZpcnR1YWxSZXNvdXJjZSwgaXNWaXJ0dWFsV29ya3NwYWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi92aXJ0dWFsV29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBhc0Nzc1ZhcmlhYmxlLCBidXR0b25CYWNrZ3JvdW5kLCBidXR0b25TZWNvbmRhcnlCYWNrZ3JvdW5kLCBlZGl0b3JFcnJvckZvcmVncm91bmQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vY29sb3JSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJU2luZ2xlRm9sZGVyV29ya3NwYWNlSWRlbnRpZmllciwgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCB0b1dvcmtzcGFjZUlkZW50aWZpZXIsIFdvcmtiZW5jaFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2VUcnVzdC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JQYW5lIH0gZnJvbSAnLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yUGFuZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yT3BlbkNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IGRlYnVnSWNvblN0YXJ0Rm9yZWdyb3VuZCB9IGZyb20gJy4uLy4uL2RlYnVnL2Jyb3dzZXIvZGVidWdDb2xvcnMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLCBMSVNUX1dPUktTUEFDRV9VTlNVUFBPUlRFRF9FWFRFTlNJT05TX0NPTU1BTkRfSUQgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEFQUExJQ0FUSU9OX1NDT1BFUywgSVdvcmtiZW5jaENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBXb3Jrc3BhY2VUcnVzdEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvd29ya3NwYWNlcy9icm93c2VyL3dvcmtzcGFjZVRydXN0RWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgSUVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBnZXRFeHRlbnNpb25EZXBlbmRlbmNpZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50VXRpbC5qcyc7XG5pbXBvcnQgeyBFbmFibGVtZW50U3RhdGUsIElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgcG9zaXgsIHdpbjMyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBoYXNEcml2ZUxldHRlciwgdG9TbGFzaGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXh0cGF0aC5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZEtleWJvYXJkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIva2V5Ym9hcmRFdmVudC5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyByZWdpc3Rlckljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vaWNvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IGRlZmF1bHRCdXR0b25TdHlsZXMsIGRlZmF1bHRJbnB1dEJveFN0eWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2Jyb3dzZXIvZGVmYXVsdFN0eWxlcy5qcyc7XG5pbXBvcnQgeyBpc01hY2ludG9zaCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgUmVzb2x2ZWRLZXliaW5kaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5YmluZGluZ3MuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGRpcm5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3VwIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcblxuZXhwb3J0IGNvbnN0IHNoaWVsZEljb24gPSByZWdpc3Rlckljb24oJ3dvcmtzcGFjZS10cnVzdC1iYW5uZXInLCBDb2RpY29uLnNoaWVsZCwgbG9jYWxpemUoJ3NoaWVsZEljb24nLCAnSWNvbiBmb3Igd29ya3NwYWNlIHRydXN0IGlvbiB0aGUgYmFubmVyLicpKTtcblxuY29uc3QgY2hlY2tMaXN0SWNvbiA9IHJlZ2lzdGVySWNvbignd29ya3NwYWNlLXRydXN0LWVkaXRvci1jaGVjaycsIENvZGljb24uY2hlY2ssIGxvY2FsaXplKCdjaGVja0xpc3RJY29uJywgJ0ljb24gZm9yIHRoZSBjaGVja21hcmsgaW4gdGhlIHdvcmtzcGFjZSB0cnVzdCBlZGl0b3IuJykpO1xuY29uc3QgeExpc3RJY29uID0gcmVnaXN0ZXJJY29uKCd3b3Jrc3BhY2UtdHJ1c3QtZWRpdG9yLWNyb3NzJywgQ29kaWNvbi54LCBsb2NhbGl6ZSgneExpc3RJY29uJywgJ0ljb24gZm9yIHRoZSBjcm9zcyBpbiB0aGUgd29ya3NwYWNlIHRydXN0IGVkaXRvci4nKSk7XG5jb25zdCBmb2xkZXJQaWNrZXJJY29uID0gcmVnaXN0ZXJJY29uKCd3b3Jrc3BhY2UtdHJ1c3QtZWRpdG9yLWZvbGRlci1waWNrZXInLCBDb2RpY29uLmZvbGRlciwgbG9jYWxpemUoJ2ZvbGRlclBpY2tlckljb24nLCAnSWNvbiBmb3IgdGhlIHBpY2sgZm9sZGVyIGljb24gaW4gdGhlIHdvcmtzcGFjZSB0cnVzdCBlZGl0b3IuJykpO1xuY29uc3QgZWRpdEljb24gPSByZWdpc3Rlckljb24oJ3dvcmtzcGFjZS10cnVzdC1lZGl0b3ItZWRpdC1mb2xkZXInLCBDb2RpY29uLmVkaXQsIGxvY2FsaXplKCdlZGl0SWNvbicsICdJY29uIGZvciB0aGUgZWRpdCBmb2xkZXIgaWNvbiBpbiB0aGUgd29ya3NwYWNlIHRydXN0IGVkaXRvci4nKSk7XG5jb25zdCByZW1vdmVJY29uID0gcmVnaXN0ZXJJY29uKCd3b3Jrc3BhY2UtdHJ1c3QtZWRpdG9yLXJlbW92ZS1mb2xkZXInLCBDb2RpY29uLmNsb3NlLCBsb2NhbGl6ZSgncmVtb3ZlSWNvbicsICdJY29uIGZvciB0aGUgcmVtb3ZlIGZvbGRlciBpY29uIGluIHRoZSB3b3Jrc3BhY2UgdHJ1c3QgZWRpdG9yLicpKTtcblxuaW50ZXJmYWNlIElUcnVzdGVkVXJpSXRlbSB7XG5cdHBhcmVudE9mV29ya3NwYWNlSXRlbTogYm9vbGVhbjtcblx0dXJpOiBVUkk7XG59XG5cbmNsYXNzIFdvcmtzcGFjZVRydXN0ZWRVcmlzVGFibGUgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRBY2NlcHRFZGl0OiBFbWl0dGVyPElUcnVzdGVkVXJpSXRlbT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVHJ1c3RlZFVyaUl0ZW0+KCkpO1xuXHRyZWFkb25seSBvbkRpZEFjY2VwdEVkaXQ6IEV2ZW50PElUcnVzdGVkVXJpSXRlbT4gPSB0aGlzLl9vbkRpZEFjY2VwdEVkaXQuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZWplY3RFZGl0OiBFbWl0dGVyPElUcnVzdGVkVXJpSXRlbT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVHJ1c3RlZFVyaUl0ZW0+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlamVjdEVkaXQ6IEV2ZW50PElUcnVzdGVkVXJpSXRlbT4gPSB0aGlzLl9vbkRpZFJlamVjdEVkaXQuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25FZGl0OiBFbWl0dGVyPElUcnVzdGVkVXJpSXRlbT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJVHJ1c3RlZFVyaUl0ZW0+KCkpO1xuXHRyZWFkb25seSBvbkVkaXQ6IEV2ZW50PElUcnVzdGVkVXJpSXRlbT4gPSB0aGlzLl9vbkVkaXQuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfb25EZWxldGU6IEVtaXR0ZXI8SVRydXN0ZWRVcmlJdGVtPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElUcnVzdGVkVXJpSXRlbT4oKSk7XG5cdHJlYWRvbmx5IG9uRGVsZXRlOiBFdmVudDxJVHJ1c3RlZFVyaUl0ZW0+ID0gdGhpcy5fb25EZWxldGUuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSB0YWJsZTogV29ya2JlbmNoVGFibGU8SVRydXN0ZWRVcmlJdGVtPjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGRlc2NyaXB0aW9uRWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjb250YWluZXI6IEhUTUxFbGVtZW50LFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZTogSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJRmlsZURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlRGlhbG9nU2VydmljZTogSUZpbGVEaWFsb2dTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmRlc2NyaXB0aW9uRWxlbWVudCA9IGNvbnRhaW5lci5hcHBlbmRDaGlsZCgkKCcud29ya3NwYWNlLXRydXN0ZWQtZm9sZGVycy1kZXNjcmlwdGlvbicpKTtcblx0XHRjb25zdCB0YWJsZUVsZW1lbnQgPSBjb250YWluZXIuYXBwZW5kQ2hpbGQoJCgnLnRydXN0ZWQtdXJpcy10YWJsZScpKTtcblx0XHRjb25zdCBhZGRCdXR0b25CYXJFbGVtZW50ID0gY29udGFpbmVyLmFwcGVuZENoaWxkKCQoJy50cnVzdGVkLXVyaXMtYnV0dG9uLWJhcicpKTtcblxuXHRcdHRoaXMudGFibGUgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0V29ya2JlbmNoVGFibGUsXG5cdFx0XHQnV29ya3NwYWNlVHJ1c3QnLFxuXHRcdFx0dGFibGVFbGVtZW50LFxuXHRcdFx0bmV3IFRydXN0ZWRVcmlUYWJsZVZpcnR1YWxEZWxlZ2F0ZSgpLFxuXHRcdFx0W1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdob3N0Q29sdW1uTGFiZWwnLCBcIkhvc3RcIiksXG5cdFx0XHRcdFx0dG9vbHRpcDogJycsXG5cdFx0XHRcdFx0d2VpZ2h0OiAxLFxuXHRcdFx0XHRcdHRlbXBsYXRlSWQ6IFRydXN0ZWRVcmlIb3N0Q29sdW1uUmVuZGVyZXIuVEVNUExBVEVfSUQsXG5cdFx0XHRcdFx0cHJvamVjdChyb3c6IElUcnVzdGVkVXJpSXRlbSk6IElUcnVzdGVkVXJpSXRlbSB7IHJldHVybiByb3c7IH1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgncGF0aENvbHVtbkxhYmVsJywgXCJQYXRoXCIpLFxuXHRcdFx0XHRcdHRvb2x0aXA6ICcnLFxuXHRcdFx0XHRcdHdlaWdodDogOCxcblx0XHRcdFx0XHR0ZW1wbGF0ZUlkOiBUcnVzdGVkVXJpUGF0aENvbHVtblJlbmRlcmVyLlRFTVBMQVRFX0lELFxuXHRcdFx0XHRcdHByb2plY3Qocm93OiBJVHJ1c3RlZFVyaUl0ZW0pOiBJVHJ1c3RlZFVyaUl0ZW0geyByZXR1cm4gcm93OyB9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRsYWJlbDogJycsXG5cdFx0XHRcdFx0dG9vbHRpcDogJycsXG5cdFx0XHRcdFx0d2VpZ2h0OiAxLFxuXHRcdFx0XHRcdG1pbmltdW1XaWR0aDogNzUsXG5cdFx0XHRcdFx0bWF4aW11bVdpZHRoOiA3NSxcblx0XHRcdFx0XHR0ZW1wbGF0ZUlkOiBUcnVzdGVkVXJpQWN0aW9uc0NvbHVtblJlbmRlcmVyLlRFTVBMQVRFX0lELFxuXHRcdFx0XHRcdHByb2plY3Qocm93OiBJVHJ1c3RlZFVyaUl0ZW0pOiBJVHJ1c3RlZFVyaUl0ZW0geyByZXR1cm4gcm93OyB9XG5cdFx0XHRcdH0sXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRydXN0ZWRVcmlIb3N0Q29sdW1uUmVuZGVyZXIpLFxuXHRcdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRydXN0ZWRVcmlQYXRoQ29sdW1uUmVuZGVyZXIsIHRoaXMpLFxuXHRcdFx0XHR0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRydXN0ZWRVcmlBY3Rpb25zQ29sdW1uUmVuZGVyZXIsIHRoaXMsIHRoaXMuY3VycmVudFdvcmtzcGFjZVVyaSksXG5cdFx0XHRdLFxuXHRcdFx0e1xuXHRcdFx0XHRob3Jpem9udGFsU2Nyb2xsaW5nOiBmYWxzZSxcblx0XHRcdFx0YWx3YXlzQ29uc3VtZU1vdXNlV2hlZWw6IGZhbHNlLFxuXHRcdFx0XHRvcGVuT25TaW5nbGVDbGljazogZmFsc2UsXG5cdFx0XHRcdG11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydDogZmFsc2UsXG5cdFx0XHRcdGFjY2Vzc2liaWxpdHlQcm92aWRlcjoge1xuXHRcdFx0XHRcdGdldEFyaWFMYWJlbDogKGl0ZW06IElUcnVzdGVkVXJpSXRlbSkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgaG9zdExhYmVsID0gZ2V0SG9zdExhYmVsKHRoaXMubGFiZWxTZXJ2aWNlLCBpdGVtKTtcblx0XHRcdFx0XHRcdGlmIChob3N0TGFiZWwgPT09IHVuZGVmaW5lZCB8fCBob3N0TGFiZWwubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgndHJ1c3RlZEZvbGRlckFyaWFMYWJlbCcsIFwiezB9LCB0cnVzdGVkXCIsIHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGl0ZW0udXJpKSk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgndHJ1c3RlZEZvbGRlcldpdGhIb3N0QXJpYUxhYmVsJywgXCJ7MH0gb24gezF9LCB0cnVzdGVkXCIsIHRoaXMubGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKGl0ZW0udXJpKSwgaG9zdExhYmVsKTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGdldFdpZGdldEFyaWFMYWJlbDogKCkgPT4gbG9jYWxpemUoJ3RydXN0ZWRGb2xkZXJzQW5kV29ya3NwYWNlcycsIFwiVHJ1c3RlZCBGb2xkZXJzICYgV29ya3NwYWNlc1wiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRpZGVudGl0eVByb3ZpZGVyOiB7XG5cdFx0XHRcdFx0Z2V0SWQoZWxlbWVudDogSVRydXN0ZWRVcmlJdGVtKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZWxlbWVudC51cmkudG9TdHJpbmcoKTtcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0KSBhcyBXb3JrYmVuY2hUYWJsZTxJVHJ1c3RlZFVyaUl0ZW0+O1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy50YWJsZS5vbkRpZE9wZW4oaXRlbSA9PiB7XG5cdFx0XHQvLyBkZWZhdWx0IHByZXZlbnRlZCB3aGVuIGlucHV0IGJveCBpcyBkb3VibGUgY2xpY2tlZCAjMTI1MDUyXG5cdFx0XHRpZiAoaXRlbSAmJiBpdGVtLmVsZW1lbnQgJiYgIWl0ZW0uYnJvd3NlckV2ZW50Py5kZWZhdWx0UHJldmVudGVkKSB7XG5cdFx0XHRcdHRoaXMuZWRpdChpdGVtLmVsZW1lbnQsIHRydWUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGJ1dHRvbkJhciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBCdXR0b25CYXIoYWRkQnV0dG9uQmFyRWxlbWVudCkpO1xuXHRcdGNvbnN0IGFkZEJ1dHRvbiA9IHRoaXMuX3JlZ2lzdGVyKGJ1dHRvbkJhci5hZGRCdXR0b24oeyB0aXRsZTogbG9jYWxpemUoJ2FkZEJ1dHRvbicsIFwiQWRkIEZvbGRlclwiKSwgLi4uZGVmYXVsdEJ1dHRvblN0eWxlcyB9KSk7XG5cdFx0YWRkQnV0dG9uLmxhYmVsID0gbG9jYWxpemUoJ2FkZEJ1dHRvbicsIFwiQWRkIEZvbGRlclwiKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZEJ1dHRvbi5vbkRpZENsaWNrKGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHVyaSA9IGF3YWl0IHRoaXMuZmlsZURpYWxvZ1NlcnZpY2Uuc2hvd09wZW5EaWFsb2coe1xuXHRcdFx0XHRjYW5TZWxlY3RGaWxlczogZmFsc2UsXG5cdFx0XHRcdGNhblNlbGVjdEZvbGRlcnM6IHRydWUsXG5cdFx0XHRcdGNhblNlbGVjdE1hbnk6IGZhbHNlLFxuXHRcdFx0XHRkZWZhdWx0VXJpOiB0aGlzLmN1cnJlbnRXb3Jrc3BhY2VVcmksXG5cdFx0XHRcdG9wZW5MYWJlbDogbG9jYWxpemUoJ3RydXN0VXJpJywgXCJUcnVzdCBGb2xkZXJcIiksXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnc2VsZWN0VHJ1c3RlZFVyaScsIFwiU2VsZWN0IEZvbGRlciBUbyBUcnVzdFwiKVxuXHRcdFx0fSk7XG5cblx0XHRcdGlmICh1cmkpIHtcblx0XHRcdFx0dGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLnNldFVyaXNUcnVzdCh1cmksIHRydWUpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5vbkRpZENoYW5nZVRydXN0ZWRGb2xkZXJzKCgpID0+IHtcblx0XHRcdHRoaXMudXBkYXRlVGFibGUoKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGdldEluZGV4T2ZUcnVzdGVkVXJpRW50cnkoaXRlbTogSVRydXN0ZWRVcmlJdGVtKTogbnVtYmVyIHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMudHJ1c3RlZFVyaUVudHJpZXMuaW5kZXhPZihpdGVtKTtcblx0XHRpZiAoaW5kZXggPT09IC0xKSB7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRoaXMudHJ1c3RlZFVyaUVudHJpZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKHRoaXMudHJ1c3RlZFVyaUVudHJpZXNbaV0udXJpID09PSBpdGVtLnVyaSkge1xuXHRcdFx0XHRcdHJldHVybiBpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGluZGV4O1xuXHR9XG5cblx0cHJpdmF0ZSBzZWxlY3RUcnVzdGVkVXJpRW50cnkoaXRlbTogSVRydXN0ZWRVcmlJdGVtLCBmb2N1czogYm9vbGVhbiA9IHRydWUpOiB2b2lkIHtcblx0XHRjb25zdCBpbmRleCA9IHRoaXMuZ2V0SW5kZXhPZlRydXN0ZWRVcmlFbnRyeShpdGVtKTtcblx0XHRpZiAoaW5kZXggIT09IC0xKSB7XG5cdFx0XHRpZiAoZm9jdXMpIHtcblx0XHRcdFx0dGhpcy50YWJsZS5kb21Gb2N1cygpO1xuXHRcdFx0XHR0aGlzLnRhYmxlLnNldEZvY3VzKFtpbmRleF0pO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy50YWJsZS5zZXRTZWxlY3Rpb24oW2luZGV4XSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXQgY3VycmVudFdvcmtzcGFjZVVyaSgpOiBVUkkge1xuXHRcdHJldHVybiB0aGlzLndvcmtzcGFjZVNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVyc1swXT8udXJpIHx8IFVSSS5maWxlKCcvJyk7XG5cdH1cblxuXHRwcml2YXRlIGdldCB0cnVzdGVkVXJpRW50cmllcygpOiBJVHJ1c3RlZFVyaUl0ZW1bXSB7XG5cdFx0Y29uc3QgY3VycmVudFdvcmtzcGFjZSA9IHRoaXMud29ya3NwYWNlU2VydmljZS5nZXRXb3Jrc3BhY2UoKTtcblx0XHRjb25zdCBjdXJyZW50V29ya3NwYWNlVXJpcyA9IGN1cnJlbnRXb3Jrc3BhY2UuZm9sZGVycy5tYXAoZm9sZGVyID0+IGZvbGRlci51cmkpO1xuXHRcdGlmIChjdXJyZW50V29ya3NwYWNlLmNvbmZpZ3VyYXRpb24pIHtcblx0XHRcdGN1cnJlbnRXb3Jrc3BhY2VVcmlzLnB1c2goY3VycmVudFdvcmtzcGFjZS5jb25maWd1cmF0aW9uKTtcblx0XHR9XG5cblx0XHRjb25zdCBlbnRyaWVzID0gdGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLmdldFRydXN0ZWRVcmlzKCkubWFwKHVyaSA9PiB7XG5cblx0XHRcdGxldCByZWxhdGVkVG9DdXJyZW50V29ya3NwYWNlID0gZmFsc2U7XG5cdFx0XHRmb3IgKGNvbnN0IHdvcmtzcGFjZVVyaSBvZiBjdXJyZW50V29ya3NwYWNlVXJpcykge1xuXHRcdFx0XHRyZWxhdGVkVG9DdXJyZW50V29ya3NwYWNlID0gcmVsYXRlZFRvQ3VycmVudFdvcmtzcGFjZSB8fCB0aGlzLnVyaVNlcnZpY2UuZXh0VXJpLmlzRXF1YWxPclBhcmVudCh3b3Jrc3BhY2VVcmksIHVyaSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHVyaSxcblx0XHRcdFx0cGFyZW50T2ZXb3Jrc3BhY2VJdGVtOiByZWxhdGVkVG9DdXJyZW50V29ya3NwYWNlXG5cdFx0XHR9O1xuXHRcdH0pO1xuXG5cdFx0Ly8gU29ydCBlbnRyaWVzXG5cdFx0Y29uc3Qgc29ydGVkRW50cmllcyA9IGVudHJpZXMuc29ydCgoYSwgYikgPT4ge1xuXHRcdFx0aWYgKGEudXJpLnNjaGVtZSAhPT0gYi51cmkuc2NoZW1lKSB7XG5cdFx0XHRcdGlmIChhLnVyaS5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0XHRcdHJldHVybiAtMTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChiLnVyaS5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0XHRcdHJldHVybiAxO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGFJc1dvcmtzcGFjZSA9IGEudXJpLnBhdGguZW5kc1dpdGgoJy5jb2RlLXdvcmtzcGFjZScpO1xuXHRcdFx0Y29uc3QgYklzV29ya3NwYWNlID0gYi51cmkucGF0aC5lbmRzV2l0aCgnLmNvZGUtd29ya3NwYWNlJyk7XG5cblx0XHRcdGlmIChhSXNXb3Jrc3BhY2UgIT09IGJJc1dvcmtzcGFjZSkge1xuXHRcdFx0XHRpZiAoYUlzV29ya3NwYWNlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoYklzV29ya3NwYWNlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIC0xO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBhLnVyaS5mc1BhdGgubG9jYWxlQ29tcGFyZShiLnVyaS5mc1BhdGgpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHNvcnRlZEVudHJpZXM7XG5cdH1cblxuXHRsYXlvdXQoKTogdm9pZCB7XG5cdFx0dGhpcy50YWJsZS5sYXlvdXQoKHRoaXMudHJ1c3RlZFVyaUVudHJpZXMubGVuZ3RoICogVHJ1c3RlZFVyaVRhYmxlVmlydHVhbERlbGVnYXRlLlJPV19IRUlHSFQpICsgVHJ1c3RlZFVyaVRhYmxlVmlydHVhbERlbGVnYXRlLkhFQURFUl9ST1dfSEVJR0hULCB1bmRlZmluZWQpO1xuXHR9XG5cblx0dXBkYXRlVGFibGUoKTogdm9pZCB7XG5cdFx0Y29uc3QgZW50cmllcyA9IHRoaXMudHJ1c3RlZFVyaUVudHJpZXM7XG5cdFx0dGhpcy5jb250YWluZXIuY2xhc3NMaXN0LnRvZ2dsZSgnZW1wdHknLCBlbnRyaWVzLmxlbmd0aCA9PT0gMCk7XG5cblx0XHR0aGlzLmRlc2NyaXB0aW9uRWxlbWVudC5pbm5lclRleHQgPSBlbnRyaWVzLmxlbmd0aCA/XG5cdFx0XHRsb2NhbGl6ZSgndHJ1c3RlZEZvbGRlcnNEZXNjcmlwdGlvbicsIFwiWW91IHRydXN0IHRoZSBmb2xsb3dpbmcgZm9sZGVycywgdGhlaXIgc3ViZm9sZGVycywgYW5kIHdvcmtzcGFjZSBmaWxlcy5cIikgOlxuXHRcdFx0bG9jYWxpemUoJ25vVHJ1c3RlZEZvbGRlcnNEZXNjcmlwdGlvbnMnLCBcIllvdSBoYXZlbid0IHRydXN0ZWQgYW55IGZvbGRlcnMgb3Igd29ya3NwYWNlIGZpbGVzIHlldC5cIik7XG5cblx0XHR0aGlzLnRhYmxlLnNwbGljZSgwLCBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFksIHRoaXMudHJ1c3RlZFVyaUVudHJpZXMpO1xuXHRcdHRoaXMubGF5b3V0KCk7XG5cdH1cblxuXHR2YWxpZGF0ZVVyaShwYXRoOiBzdHJpbmcsIGl0ZW0/OiBJVHJ1c3RlZFVyaUl0ZW0pOiBJTWVzc2FnZSB8IG51bGwge1xuXHRcdGlmICghaXRlbSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0aWYgKGl0ZW0udXJpLnNjaGVtZSA9PT0gJ3ZzY29kZS12ZnMnKSB7XG5cdFx0XHRjb25zdCBzZWdtZW50cyA9IHBhdGguc3BsaXQocG9zaXguc2VwKS5maWx0ZXIocyA9PiBzLmxlbmd0aCk7XG5cdFx0XHRpZiAoc2VnbWVudHMubGVuZ3RoID09PSAwICYmIHBhdGguc3RhcnRzV2l0aChwb3NpeC5zZXApKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dHlwZTogTWVzc2FnZVR5cGUuV0FSTklORyxcblx0XHRcdFx0XHRjb250ZW50OiBsb2NhbGl6ZSh7IGtleTogJ3RydXN0QWxsJywgY29tbWVudDogWydUaGUgezB9IHdpbGwgYmUgYSBob3N0IG5hbWUgd2hlcmUgcmVwb3NpdG9yaWVzIGFyZSBob3N0ZWQuJ10gfSwgXCJZb3Ugd2lsbCB0cnVzdCBhbGwgcmVwb3NpdG9yaWVzIG9uIHswfS5cIiwgZ2V0SG9zdExhYmVsKHRoaXMubGFiZWxTZXJ2aWNlLCBpdGVtKSlcblx0XHRcdFx0fTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHNlZ21lbnRzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHR5cGU6IE1lc3NhZ2VUeXBlLldBUk5JTkcsXG5cdFx0XHRcdFx0Y29udGVudDogbG9jYWxpemUoeyBrZXk6ICd0cnVzdE9yZycsIGNvbW1lbnQ6IFsnVGhlIHswfSB3aWxsIGJlIGFuIG9yZ2FuaXphdGlvbiBvciB1c2VyIG5hbWUuJywgJ1RoZSB7MX0gd2lsbCBiZSBhIGhvc3QgbmFtZSB3aGVyZSByZXBvc2l0b3JpZXMgYXJlIGhvc3RlZC4nXSB9LCBcIllvdSB3aWxsIHRydXN0IGFsbCByZXBvc2l0b3JpZXMgYW5kIGZvcmtzIHVuZGVyICd7MH0nIG9uIHsxfS5cIiwgc2VnbWVudHNbMF0sIGdldEhvc3RMYWJlbCh0aGlzLmxhYmVsU2VydmljZSwgaXRlbSkpXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzZWdtZW50cy5sZW5ndGggPiAyKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0dHlwZTogTWVzc2FnZVR5cGUuRVJST1IsXG5cdFx0XHRcdFx0Y29udGVudDogbG9jYWxpemUoJ2ludmFsaWRUcnVzdCcsIFwiWW91IGNhbm5vdCB0cnVzdCBpbmRpdmlkdWFsIGZvbGRlcnMgd2l0aGluIGEgcmVwb3NpdG9yeS5cIiwgcGF0aClcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGFjY2VwdEVkaXQoaXRlbTogSVRydXN0ZWRVcmlJdGVtLCB1cmk6IFVSSSkge1xuXHRcdGNvbnN0IHRydXN0ZWRGb2xkZXJzID0gdGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLmdldFRydXN0ZWRVcmlzKCk7XG5cdFx0Y29uc3QgaW5kZXggPSB0cnVzdGVkRm9sZGVycy5maW5kSW5kZXgodSA9PiB0aGlzLnVyaVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwodSwgaXRlbS51cmkpKTtcblxuXHRcdGlmIChpbmRleCA+PSB0cnVzdGVkRm9sZGVycy5sZW5ndGggfHwgaW5kZXggPT09IC0xKSB7XG5cdFx0XHR0cnVzdGVkRm9sZGVycy5wdXNoKHVyaSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRydXN0ZWRGb2xkZXJzW2luZGV4XSA9IHVyaTtcblx0XHR9XG5cblx0XHR0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2Uuc2V0VHJ1c3RlZFVyaXModHJ1c3RlZEZvbGRlcnMpO1xuXHRcdHRoaXMuX29uRGlkQWNjZXB0RWRpdC5maXJlKGl0ZW0pO1xuXHR9XG5cblx0cmVqZWN0RWRpdChpdGVtOiBJVHJ1c3RlZFVyaUl0ZW0pIHtcblx0XHR0aGlzLl9vbkRpZFJlamVjdEVkaXQuZmlyZShpdGVtKTtcblx0fVxuXG5cdGFzeW5jIGRlbGV0ZShpdGVtOiBJVHJ1c3RlZFVyaUl0ZW0pIHtcblx0XHR0aGlzLnRhYmxlLmZvY3VzTmV4dCgpO1xuXHRcdGF3YWl0IHRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5zZXRVcmlzVHJ1c3QoW2l0ZW0udXJpXSwgZmFsc2UpO1xuXG5cdFx0aWYgKHRoaXMudGFibGUuZ2V0Rm9jdXMoKS5sZW5ndGggPT09IDApIHtcblx0XHRcdHRoaXMudGFibGUuZm9jdXNMYXN0KCk7XG5cdFx0fVxuXHRcdHRoaXMuX29uRGVsZXRlLmZpcmUoaXRlbSk7XG5cdFx0dGhpcy50YWJsZS5kb21Gb2N1cygpO1xuXHR9XG5cblx0YXN5bmMgZWRpdChpdGVtOiBJVHJ1c3RlZFVyaUl0ZW0sIHVzZVBpY2tlcklmUG9zc2libGU/OiBib29sZWFuKSB7XG5cdFx0Y29uc3QgY2FuVXNlT3BlbkRpYWxvZyA9IGl0ZW0udXJpLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlIHx8XG5cdFx0XHQoXG5cdFx0XHRcdGl0ZW0udXJpLnNjaGVtZSA9PT0gdGhpcy5jdXJyZW50V29ya3NwYWNlVXJpLnNjaGVtZSAmJlxuXHRcdFx0XHR0aGlzLnVyaVNlcnZpY2UuZXh0VXJpLmlzRXF1YWxBdXRob3JpdHkodGhpcy5jdXJyZW50V29ya3NwYWNlVXJpLmF1dGhvcml0eSwgaXRlbS51cmkuYXV0aG9yaXR5KSAmJlxuXHRcdFx0XHQhaXNWaXJ0dWFsUmVzb3VyY2UoaXRlbS51cmkpXG5cdFx0XHQpO1xuXHRcdGlmIChjYW5Vc2VPcGVuRGlhbG9nICYmIHVzZVBpY2tlcklmUG9zc2libGUpIHtcblx0XHRcdGNvbnN0IHVyaSA9IGF3YWl0IHRoaXMuZmlsZURpYWxvZ1NlcnZpY2Uuc2hvd09wZW5EaWFsb2coe1xuXHRcdFx0XHRjYW5TZWxlY3RGaWxlczogZmFsc2UsXG5cdFx0XHRcdGNhblNlbGVjdEZvbGRlcnM6IHRydWUsXG5cdFx0XHRcdGNhblNlbGVjdE1hbnk6IGZhbHNlLFxuXHRcdFx0XHRkZWZhdWx0VXJpOiBpdGVtLnVyaSxcblx0XHRcdFx0b3BlbkxhYmVsOiBsb2NhbGl6ZSgndHJ1c3RVcmknLCBcIlRydXN0IEZvbGRlclwiKSxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdzZWxlY3RUcnVzdGVkVXJpJywgXCJTZWxlY3QgRm9sZGVyIFRvIFRydXN0XCIpXG5cdFx0XHR9KTtcblxuXHRcdFx0aWYgKHVyaSkge1xuXHRcdFx0XHR0aGlzLmFjY2VwdEVkaXQoaXRlbSwgdXJpWzBdKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMucmVqZWN0RWRpdChpdGVtKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zZWxlY3RUcnVzdGVkVXJpRW50cnkoaXRlbSk7XG5cdFx0XHR0aGlzLl9vbkVkaXQuZmlyZShpdGVtKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgVHJ1c3RlZFVyaVRhYmxlVmlydHVhbERlbGVnYXRlIGltcGxlbWVudHMgSVRhYmxlVmlydHVhbERlbGVnYXRlPElUcnVzdGVkVXJpSXRlbT4ge1xuXHRzdGF0aWMgcmVhZG9ubHkgSEVBREVSX1JPV19IRUlHSFQgPSAzMDtcblx0c3RhdGljIHJlYWRvbmx5IFJPV19IRUlHSFQgPSAyNDtcblx0cmVhZG9ubHkgaGVhZGVyUm93SGVpZ2h0ID0gVHJ1c3RlZFVyaVRhYmxlVmlydHVhbERlbGVnYXRlLkhFQURFUl9ST1dfSEVJR0hUO1xuXHRnZXRIZWlnaHQoaXRlbTogSVRydXN0ZWRVcmlJdGVtKSB7XG5cdFx0cmV0dXJuIFRydXN0ZWRVcmlUYWJsZVZpcnR1YWxEZWxlZ2F0ZS5ST1dfSEVJR0hUO1xuXHR9XG59XG5cbmludGVyZmFjZSBJQWN0aW9uc0NvbHVtblRlbXBsYXRlRGF0YSB7XG5cdHJlYWRvbmx5IGFjdGlvbkJhcjogQWN0aW9uQmFyO1xufVxuXG5jbGFzcyBUcnVzdGVkVXJpQWN0aW9uc0NvbHVtblJlbmRlcmVyIGltcGxlbWVudHMgSVRhYmxlUmVuZGVyZXI8SVRydXN0ZWRVcmlJdGVtLCBJQWN0aW9uc0NvbHVtblRlbXBsYXRlRGF0YT4ge1xuXG5cdHN0YXRpYyByZWFkb25seSBURU1QTEFURV9JRCA9ICdhY3Rpb25zJztcblxuXHRyZWFkb25seSB0ZW1wbGF0ZUlkOiBzdHJpbmcgPSBUcnVzdGVkVXJpQWN0aW9uc0NvbHVtblJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdGFibGU6IFdvcmtzcGFjZVRydXN0ZWRVcmlzVGFibGUsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjdXJyZW50V29ya3NwYWNlVXJpOiBVUkksXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1cmlTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlKSB7IH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSUFjdGlvbnNDb2x1bW5UZW1wbGF0ZURhdGEge1xuXHRcdGNvbnN0IGVsZW1lbnQgPSBjb250YWluZXIuYXBwZW5kQ2hpbGQoJCgnLmFjdGlvbnMnKSk7XG5cdFx0Y29uc3QgYWN0aW9uQmFyID0gbmV3IEFjdGlvbkJhcihlbGVtZW50KTtcblx0XHRyZXR1cm4geyBhY3Rpb25CYXIgfTtcblx0fVxuXG5cdHJlbmRlckVsZW1lbnQoaXRlbTogSVRydXN0ZWRVcmlJdGVtLCBpbmRleDogbnVtYmVyLCB0ZW1wbGF0ZURhdGE6IElBY3Rpb25zQ29sdW1uVGVtcGxhdGVEYXRhLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25CYXIuY2xlYXIoKTtcblxuXHRcdGNvbnN0IGNhblVzZU9wZW5EaWFsb2cgPSBpdGVtLnVyaS5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSB8fFxuXHRcdFx0KFxuXHRcdFx0XHRpdGVtLnVyaS5zY2hlbWUgPT09IHRoaXMuY3VycmVudFdvcmtzcGFjZVVyaS5zY2hlbWUgJiZcblx0XHRcdFx0dGhpcy51cmlTZXJ2aWNlLmV4dFVyaS5pc0VxdWFsQXV0aG9yaXR5KHRoaXMuY3VycmVudFdvcmtzcGFjZVVyaS5hdXRob3JpdHksIGl0ZW0udXJpLmF1dGhvcml0eSkgJiZcblx0XHRcdFx0IWlzVmlydHVhbFJlc291cmNlKGl0ZW0udXJpKVxuXHRcdFx0KTtcblxuXHRcdGNvbnN0IGFjdGlvbnM6IElBY3Rpb25bXSA9IFtdO1xuXHRcdGlmIChjYW5Vc2VPcGVuRGlhbG9nKSB7XG5cdFx0XHRhY3Rpb25zLnB1c2godGhpcy5jcmVhdGVQaWNrZXJBY3Rpb24oaXRlbSkpO1xuXHRcdH1cblx0XHRhY3Rpb25zLnB1c2godGhpcy5jcmVhdGVFZGl0QWN0aW9uKGl0ZW0pKTtcblx0XHRhY3Rpb25zLnB1c2godGhpcy5jcmVhdGVEZWxldGVBY3Rpb24oaXRlbSkpO1xuXHRcdHRlbXBsYXRlRGF0YS5hY3Rpb25CYXIucHVzaChhY3Rpb25zLCB7IGljb246IHRydWUgfSk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUVkaXRBY3Rpb24oaXRlbTogSVRydXN0ZWRVcmlJdGVtKTogSUFjdGlvbiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGxhYmVsOiAnJyxcblx0XHRcdGNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoZWRpdEljb24pLFxuXHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdGlkOiAnZWRpdFRydXN0ZWRVcmknLFxuXHRcdFx0dG9vbHRpcDogbG9jYWxpemUoJ2VkaXRUcnVzdGVkVXJpJywgXCJFZGl0IFBhdGhcIiksXG5cdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0dGhpcy50YWJsZS5lZGl0KGl0ZW0sIGZhbHNlKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVQaWNrZXJBY3Rpb24oaXRlbTogSVRydXN0ZWRVcmlJdGVtKTogSUFjdGlvbiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGxhYmVsOiAnJyxcblx0XHRcdGNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUoZm9sZGVyUGlja2VySWNvbiksXG5cdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0aWQ6ICdwaWNrZXJUcnVzdGVkVXJpJyxcblx0XHRcdHRvb2x0aXA6IGxvY2FsaXplKCdwaWNrZXJUcnVzdGVkVXJpJywgXCJPcGVuIEZpbGUgUGlja2VyXCIpLFxuXHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdHRoaXMudGFibGUuZWRpdChpdGVtLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVEZWxldGVBY3Rpb24oaXRlbTogSVRydXN0ZWRVcmlJdGVtKTogSUFjdGlvbiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGxhYmVsOiAnJyxcblx0XHRcdGNsYXNzOiBUaGVtZUljb24uYXNDbGFzc05hbWUocmVtb3ZlSWNvbiksXG5cdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0aWQ6ICdkZWxldGVUcnVzdGVkVXJpJyxcblx0XHRcdHRvb2x0aXA6IGxvY2FsaXplKCdkZWxldGVUcnVzdGVkVXJpJywgXCJEZWxldGUgUGF0aFwiKSxcblx0XHRcdHJ1bjogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnRhYmxlLmRlbGV0ZShpdGVtKTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0ZGlzcG9zZVRlbXBsYXRlKHRlbXBsYXRlRGF0YTogSUFjdGlvbnNDb2x1bW5UZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuYWN0aW9uQmFyLmRpc3Bvc2UoKTtcblx0fVxuXG59XG5cbmludGVyZmFjZSBJVHJ1c3RlZFVyaVBhdGhDb2x1bW5UZW1wbGF0ZURhdGEge1xuXHRlbGVtZW50OiBIVE1MRWxlbWVudDtcblx0cGF0aExhYmVsOiBIVE1MRWxlbWVudDtcblx0cGF0aElucHV0OiBJbnB1dEJveDtcblx0cmVuZGVyRGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0ZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcbn1cblxuY2xhc3MgVHJ1c3RlZFVyaVBhdGhDb2x1bW5SZW5kZXJlciBpbXBsZW1lbnRzIElUYWJsZVJlbmRlcmVyPElUcnVzdGVkVXJpSXRlbSwgSVRydXN0ZWRVcmlQYXRoQ29sdW1uVGVtcGxhdGVEYXRhPiB7XG5cdHN0YXRpYyByZWFkb25seSBURU1QTEFURV9JRCA9ICdwYXRoJztcblxuXHRyZWFkb25seSB0ZW1wbGF0ZUlkOiBzdHJpbmcgPSBUcnVzdGVkVXJpUGF0aENvbHVtblJlbmRlcmVyLlRFTVBMQVRFX0lEO1xuXHRwcml2YXRlIGN1cnJlbnRJdGVtPzogSVRydXN0ZWRVcmlJdGVtO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdGFibGU6IFdvcmtzcGFjZVRydXN0ZWRVcmlzVGFibGUsXG5cdFx0QElDb250ZXh0Vmlld1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0Vmlld1NlcnZpY2U6IElDb250ZXh0Vmlld1NlcnZpY2Vcblx0KSB7XG5cdH1cblxuXHRyZW5kZXJUZW1wbGF0ZShjb250YWluZXI6IEhUTUxFbGVtZW50KTogSVRydXN0ZWRVcmlQYXRoQ29sdW1uVGVtcGxhdGVEYXRhIHtcblx0XHRjb25zdCBlbGVtZW50ID0gY29udGFpbmVyLmFwcGVuZENoaWxkKCQoJy5wYXRoJykpO1xuXHRcdGNvbnN0IHBhdGhMYWJlbCA9IGVsZW1lbnQuYXBwZW5kQ2hpbGQoJCgnZGl2LnBhdGgtbGFiZWwnKSk7XG5cblx0XHRjb25zdCBwYXRoSW5wdXQgPSBuZXcgSW5wdXRCb3goZWxlbWVudCwgdGhpcy5jb250ZXh0Vmlld1NlcnZpY2UsIHtcblx0XHRcdHZhbGlkYXRpb25PcHRpb25zOiB7XG5cdFx0XHRcdHZhbGlkYXRpb246IHZhbHVlID0+IHRoaXMudGFibGUudmFsaWRhdGVVcmkodmFsdWUsIHRoaXMuY3VycmVudEl0ZW0pXG5cdFx0XHR9LFxuXHRcdFx0aW5wdXRCb3hTdHlsZXM6IGRlZmF1bHRJbnB1dEJveFN0eWxlc1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgcmVuZGVyRGlzcG9zYWJsZXMgPSBkaXNwb3NhYmxlcy5hZGQobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRlbGVtZW50LFxuXHRcdFx0cGF0aExhYmVsLFxuXHRcdFx0cGF0aElucHV0LFxuXHRcdFx0ZGlzcG9zYWJsZXMsXG5cdFx0XHRyZW5kZXJEaXNwb3NhYmxlc1xuXHRcdH07XG5cdH1cblxuXHRyZW5kZXJFbGVtZW50KGl0ZW06IElUcnVzdGVkVXJpSXRlbSwgaW5kZXg6IG51bWJlciwgdGVtcGxhdGVEYXRhOiBJVHJ1c3RlZFVyaVBhdGhDb2x1bW5UZW1wbGF0ZURhdGEsIGhlaWdodDogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGVtcGxhdGVEYXRhLnJlbmRlckRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHR0aGlzLmN1cnJlbnRJdGVtID0gaXRlbTtcblx0XHR0ZW1wbGF0ZURhdGEucmVuZGVyRGlzcG9zYWJsZXMuYWRkKHRoaXMudGFibGUub25FZGl0KGFzeW5jIChlKSA9PiB7XG5cdFx0XHRpZiAoaXRlbSA9PT0gZSkge1xuXHRcdFx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudC5jbGFzc0xpc3QuYWRkKCdpbnB1dC1tb2RlJyk7XG5cdFx0XHRcdHRlbXBsYXRlRGF0YS5wYXRoSW5wdXQuZm9jdXMoKTtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLnBhdGhJbnB1dC5zZWxlY3QoKTtcblx0XHRcdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnQucGFyZW50RWxlbWVudCEuc3R5bGUucGFkZGluZ0xlZnQgPSAnMHB4Jztcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBzdG9wIGRvdWJsZSBjbGljayBhY3Rpb24gZnJvbSByZS1yZW5kZXJpbmcgdGhlIGVsZW1lbnQgb24gdGhlIHRhYmxlICMxMjUwNTJcblx0XHR0ZW1wbGF0ZURhdGEucmVuZGVyRGlzcG9zYWJsZXMuYWRkKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0ZW1wbGF0ZURhdGEucGF0aElucHV0LmVsZW1lbnQsIEV2ZW50VHlwZS5EQkxDTElDSywgZSA9PiB7XG5cdFx0XHRFdmVudEhlbHBlci5zdG9wKGUpO1xuXHRcdH0pKTtcblxuXG5cdFx0Y29uc3QgaGlkZUlucHV0Qm94ID0gKCkgPT4ge1xuXHRcdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnQuY2xhc3NMaXN0LnJlbW92ZSgnaW5wdXQtbW9kZScpO1xuXHRcdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnQucGFyZW50RWxlbWVudCEuc3R5bGUucGFkZGluZ0xlZnQgPSAnNXB4Jztcblx0XHR9O1xuXG5cdFx0Y29uc3QgYWNjZXB0ID0gKCkgPT4ge1xuXHRcdFx0aGlkZUlucHV0Qm94KCk7XG5cblx0XHRcdGNvbnN0IHBhdGhUb1VzZSA9IHRlbXBsYXRlRGF0YS5wYXRoSW5wdXQudmFsdWU7XG5cdFx0XHRjb25zdCB1cmkgPSBoYXNEcml2ZUxldHRlcihwYXRoVG9Vc2UpID8gaXRlbS51cmkud2l0aCh7IHBhdGg6IHBvc2l4LnNlcCArIHRvU2xhc2hlcyhwYXRoVG9Vc2UpIH0pIDogaXRlbS51cmkud2l0aCh7IHBhdGg6IHBhdGhUb1VzZSB9KTtcblx0XHRcdHRlbXBsYXRlRGF0YS5wYXRoTGFiZWwuaW5uZXJUZXh0ID0gdGhpcy5mb3JtYXRQYXRoKHVyaSk7XG5cblx0XHRcdGlmICh1cmkpIHtcblx0XHRcdFx0dGhpcy50YWJsZS5hY2NlcHRFZGl0KGl0ZW0sIHVyaSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IHJlamVjdCA9ICgpID0+IHtcblx0XHRcdGhpZGVJbnB1dEJveCgpO1xuXHRcdFx0dGVtcGxhdGVEYXRhLnBhdGhJbnB1dC52YWx1ZSA9IHN0cmluZ1ZhbHVlO1xuXHRcdFx0dGhpcy50YWJsZS5yZWplY3RFZGl0KGl0ZW0pO1xuXHRcdH07XG5cblx0XHR0ZW1wbGF0ZURhdGEucmVuZGVyRGlzcG9zYWJsZXMuYWRkKGFkZFN0YW5kYXJkRGlzcG9zYWJsZUxpc3RlbmVyKHRlbXBsYXRlRGF0YS5wYXRoSW5wdXQuaW5wdXRFbGVtZW50LCBFdmVudFR5cGUuS0VZX0RPV04sIGUgPT4ge1xuXHRcdFx0bGV0IGhhbmRsZWQgPSBmYWxzZTtcblx0XHRcdGlmIChlLmVxdWFscyhLZXlDb2RlLkVudGVyKSkge1xuXHRcdFx0XHRhY2NlcHQoKTtcblx0XHRcdFx0aGFuZGxlZCA9IHRydWU7XG5cdFx0XHR9IGVsc2UgaWYgKGUuZXF1YWxzKEtleUNvZGUuRXNjYXBlKSkge1xuXHRcdFx0XHRyZWplY3QoKTtcblx0XHRcdFx0aGFuZGxlZCA9IHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChoYW5kbGVkKSB7XG5cdFx0XHRcdGUucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0ZS5zdG9wUHJvcGFnYXRpb24oKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0dGVtcGxhdGVEYXRhLnJlbmRlckRpc3Bvc2FibGVzLmFkZCgoYWRkRGlzcG9zYWJsZUxpc3RlbmVyKHRlbXBsYXRlRGF0YS5wYXRoSW5wdXQuaW5wdXRFbGVtZW50LCBFdmVudFR5cGUuQkxVUiwgKCkgPT4ge1xuXHRcdFx0cmVqZWN0KCk7XG5cdFx0fSkpKTtcblxuXHRcdGNvbnN0IHN0cmluZ1ZhbHVlID0gdGhpcy5mb3JtYXRQYXRoKGl0ZW0udXJpKTtcblx0XHR0ZW1wbGF0ZURhdGEucGF0aElucHV0LnZhbHVlID0gc3RyaW5nVmFsdWU7XG5cdFx0dGVtcGxhdGVEYXRhLnBhdGhMYWJlbC5pbm5lclRleHQgPSBzdHJpbmdWYWx1ZTtcblx0XHR0ZW1wbGF0ZURhdGEuZWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCdjdXJyZW50LXdvcmtzcGFjZS1wYXJlbnQnLCBpdGVtLnBhcmVudE9mV29ya3NwYWNlSXRlbSk7XG5cdH1cblxuXHRkaXNwb3NlVGVtcGxhdGUodGVtcGxhdGVEYXRhOiBJVHJ1c3RlZFVyaVBhdGhDb2x1bW5UZW1wbGF0ZURhdGEpOiB2b2lkIHtcblx0XHR0ZW1wbGF0ZURhdGEuZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdHRlbXBsYXRlRGF0YS5yZW5kZXJEaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cblxuXHRwcml2YXRlIGZvcm1hdFBhdGgodXJpOiBVUkkpOiBzdHJpbmcge1xuXHRcdGlmICh1cmkuc2NoZW1lID09PSBTY2hlbWFzLmZpbGUpIHtcblx0XHRcdHJldHVybiBub3JtYWxpemVEcml2ZUxldHRlcih1cmkuZnNQYXRoKTtcblx0XHR9XG5cblx0XHQvLyBJZiB0aGUgcGF0aCBpcyBub3QgYSBmaWxlIHVyaSwgYnV0IHBvaW50cyB0byBhIHdpbmRvd3MgcmVtb3RlLCB3ZSBzaG91bGQgY3JlYXRlIHdpbmRvd3MgZnMgcGF0aFxuXHRcdC8vIGUuZy4gL2M6L3VzZXIvZGlyZWN0b3J5ID0+IEM6XFx1c2VyXFxkaXJlY3Rvcnlcblx0XHRpZiAodXJpLnBhdGguc3RhcnRzV2l0aChwb3NpeC5zZXApKSB7XG5cdFx0XHRjb25zdCBwYXRoV2l0aG91dExlYWRpbmdTZXBhcmF0b3IgPSB1cmkucGF0aC5zdWJzdHJpbmcoMSk7XG5cdFx0XHRjb25zdCBpc1dpbmRvd3NQYXRoID0gaGFzRHJpdmVMZXR0ZXIocGF0aFdpdGhvdXRMZWFkaW5nU2VwYXJhdG9yLCB0cnVlKTtcblx0XHRcdGlmIChpc1dpbmRvd3NQYXRoKSB7XG5cdFx0XHRcdHJldHVybiBub3JtYWxpemVEcml2ZUxldHRlcih3aW4zMi5ub3JtYWxpemUocGF0aFdpdGhvdXRMZWFkaW5nU2VwYXJhdG9yKSwgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVyaS5wYXRoO1xuXHR9XG5cbn1cblxuXG5pbnRlcmZhY2UgSVRydXN0ZWRVcmlIb3N0Q29sdW1uVGVtcGxhdGVEYXRhIHtcblx0ZWxlbWVudDogSFRNTEVsZW1lbnQ7XG5cdGhvc3RDb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRidXR0b25CYXJDb250YWluZXI6IEhUTUxFbGVtZW50O1xuXHRkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xuXHRyZW5kZXJEaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xufVxuXG5mdW5jdGlvbiBnZXRIb3N0TGFiZWwobGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLCBpdGVtOiBJVHJ1c3RlZFVyaUl0ZW0pOiBzdHJpbmcge1xuXHRyZXR1cm4gaXRlbS51cmkuYXV0aG9yaXR5ID8gbGFiZWxTZXJ2aWNlLmdldEhvc3RMYWJlbChpdGVtLnVyaS5zY2hlbWUsIGl0ZW0udXJpLmF1dGhvcml0eSkgOiBsb2NhbGl6ZSgnbG9jYWxBdXRob3JpdHknLCBcIkxvY2FsXCIpO1xufVxuXG5jbGFzcyBUcnVzdGVkVXJpSG9zdENvbHVtblJlbmRlcmVyIGltcGxlbWVudHMgSVRhYmxlUmVuZGVyZXI8SVRydXN0ZWRVcmlJdGVtLCBJVHJ1c3RlZFVyaUhvc3RDb2x1bW5UZW1wbGF0ZURhdGE+IHtcblx0c3RhdGljIHJlYWRvbmx5IFRFTVBMQVRFX0lEID0gJ2hvc3QnO1xuXG5cdHJlYWRvbmx5IHRlbXBsYXRlSWQ6IHN0cmluZyA9IFRydXN0ZWRVcmlIb3N0Q29sdW1uUmVuZGVyZXIuVEVNUExBVEVfSUQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElMYWJlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdCkgeyB9XG5cblx0cmVuZGVyVGVtcGxhdGUoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IElUcnVzdGVkVXJpSG9zdENvbHVtblRlbXBsYXRlRGF0YSB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgcmVuZGVyRGlzcG9zYWJsZXMgPSBkaXNwb3NhYmxlcy5hZGQobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblxuXHRcdGNvbnN0IGVsZW1lbnQgPSBjb250YWluZXIuYXBwZW5kQ2hpbGQoJCgnLmhvc3QnKSk7XG5cdFx0Y29uc3QgaG9zdENvbnRhaW5lciA9IGVsZW1lbnQuYXBwZW5kQ2hpbGQoJCgnZGl2Lmhvc3QtbGFiZWwnKSk7XG5cdFx0Y29uc3QgYnV0dG9uQmFyQ29udGFpbmVyID0gZWxlbWVudC5hcHBlbmRDaGlsZCgkKCdkaXYuYnV0dG9uLWJhcicpKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRlbGVtZW50LFxuXHRcdFx0aG9zdENvbnRhaW5lcixcblx0XHRcdGJ1dHRvbkJhckNvbnRhaW5lcixcblx0XHRcdGRpc3Bvc2FibGVzLFxuXHRcdFx0cmVuZGVyRGlzcG9zYWJsZXNcblx0XHR9O1xuXHR9XG5cblx0cmVuZGVyRWxlbWVudChpdGVtOiBJVHJ1c3RlZFVyaUl0ZW0sIGluZGV4OiBudW1iZXIsIHRlbXBsYXRlRGF0YTogSVRydXN0ZWRVcmlIb3N0Q29sdW1uVGVtcGxhdGVEYXRhLCBoZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5yZW5kZXJEaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdHRlbXBsYXRlRGF0YS5yZW5kZXJEaXNwb3NhYmxlcy5hZGQoeyBkaXNwb3NlOiAoKSA9PiB7IGNsZWFyTm9kZSh0ZW1wbGF0ZURhdGEuYnV0dG9uQmFyQ29udGFpbmVyKTsgfSB9KTtcblxuXHRcdHRlbXBsYXRlRGF0YS5ob3N0Q29udGFpbmVyLmlubmVyVGV4dCA9IGdldEhvc3RMYWJlbCh0aGlzLmxhYmVsU2VydmljZSwgaXRlbSk7XG5cdFx0dGVtcGxhdGVEYXRhLmVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgnY3VycmVudC13b3Jrc3BhY2UtcGFyZW50JywgaXRlbS5wYXJlbnRPZldvcmtzcGFjZUl0ZW0pO1xuXG5cdFx0dGVtcGxhdGVEYXRhLmhvc3RDb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICcnO1xuXHRcdHRlbXBsYXRlRGF0YS5idXR0b25CYXJDb250YWluZXIuc3R5bGUuZGlzcGxheSA9ICdub25lJztcblx0fVxuXG5cdGRpc3Bvc2VUZW1wbGF0ZSh0ZW1wbGF0ZURhdGE6IElUcnVzdGVkVXJpSG9zdENvbHVtblRlbXBsYXRlRGF0YSk6IHZvaWQge1xuXHRcdHRlbXBsYXRlRGF0YS5kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cblxufVxuXG5leHBvcnQgY2xhc3MgV29ya3NwYWNlVHJ1c3RFZGl0b3IgZXh0ZW5kcyBFZGl0b3JQYW5lIHtcblx0c3RhdGljIHJlYWRvbmx5IElEOiBzdHJpbmcgPSAnd29ya2JlbmNoLmVkaXRvci53b3Jrc3BhY2VUcnVzdCc7XG5cdHByaXZhdGUgcm9vdEVsZW1lbnQhOiBIVE1MRWxlbWVudDtcblxuXHQvLyBIZWFkZXIgU2VjdGlvblxuXHRwcml2YXRlIGhlYWRlckNvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIGhlYWRlclRpdGxlQ29udGFpbmVyITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgaGVhZGVyVGl0bGVJY29uITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgaGVhZGVyVGl0bGVUZXh0ITogSFRNTEVsZW1lbnQ7XG5cdHByaXZhdGUgaGVhZGVyRGVzY3JpcHRpb24hOiBIVE1MRWxlbWVudDtcblxuXHRwcml2YXRlIGJvZHlTY3JvbGxCYXIhOiBEb21TY3JvbGxhYmxlRWxlbWVudDtcblxuXHQvLyBBZmZlY3RlZCBGZWF0dXJlcyBTZWN0aW9uXG5cdHByaXZhdGUgYWZmZWN0ZWRGZWF0dXJlc0NvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHRydXN0ZWRDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblx0cHJpdmF0ZSB1bnRydXN0ZWRDb250YWluZXIhOiBIVE1MRWxlbWVudDtcblxuXHQvLyBTZXR0aW5ncyBTZWN0aW9uXG5cdHByaXZhdGUgY29uZmlndXJhdGlvbkNvbnRhaW5lciE6IEhUTUxFbGVtZW50O1xuXHRwcml2YXRlIHdvcmtzcGFjZVRydXN0ZWRVcmlzVGFibGUhOiBXb3Jrc3BhY2VUcnVzdGVkVXJpc1RhYmxlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGdyb3VwOiBJRWRpdG9yR3JvdXAsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJVGhlbWVTZXJ2aWNlIHRoZW1lU2VydmljZTogSVRoZW1lU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZVNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2U6IElFeHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2U6IElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSVdvcmtiZW5jaENvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25FbmFibGVtZW50U2VydmljZTogSVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJS2V5YmluZGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHQpIHsgc3VwZXIoV29ya3NwYWNlVHJ1c3RFZGl0b3IuSUQsIGdyb3VwLCB0ZWxlbWV0cnlTZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIHN0b3JhZ2VTZXJ2aWNlKTsgfVxuXG5cdHByb3RlY3RlZCBjcmVhdGVFZGl0b3IocGFyZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMucm9vdEVsZW1lbnQgPSBhcHBlbmQocGFyZW50LCAkKCcud29ya3NwYWNlLXRydXN0LWVkaXRvcicsIHsgdGFiaW5kZXg6ICcwJyB9KSk7XG5cblx0XHR0aGlzLmNyZWF0ZUhlYWRlckVsZW1lbnQodGhpcy5yb290RWxlbWVudCk7XG5cblx0XHRjb25zdCBzY3JvbGxhYmxlQ29udGVudCA9ICQoJy53b3Jrc3BhY2UtdHJ1c3QtZWRpdG9yLWJvZHknKTtcblx0XHR0aGlzLmJvZHlTY3JvbGxCYXIgPSB0aGlzLl9yZWdpc3RlcihuZXcgRG9tU2Nyb2xsYWJsZUVsZW1lbnQoc2Nyb2xsYWJsZUNvbnRlbnQsIHtcblx0XHRcdGhvcml6b250YWw6IFNjcm9sbGJhclZpc2liaWxpdHkuSGlkZGVuLFxuXHRcdFx0dmVydGljYWw6IFNjcm9sbGJhclZpc2liaWxpdHkuQXV0byxcblx0XHR9KSk7XG5cblx0XHRhcHBlbmQodGhpcy5yb290RWxlbWVudCwgdGhpcy5ib2R5U2Nyb2xsQmFyLmdldERvbU5vZGUoKSk7XG5cblx0XHR0aGlzLmNyZWF0ZUFmZmVjdGVkRmVhdHVyZXNFbGVtZW50KHNjcm9sbGFibGVDb250ZW50KTtcblx0XHR0aGlzLmNyZWF0ZUNvbmZpZ3VyYXRpb25FbGVtZW50KHNjcm9sbGFibGVDb250ZW50KTtcblxuXHRcdHRoaXMucm9vdEVsZW1lbnQuc3R5bGUuc2V0UHJvcGVydHkoJy0td29ya3NwYWNlLXRydXN0LXNlbGVjdGVkLWNvbG9yJywgYXNDc3NWYXJpYWJsZShidXR0b25CYWNrZ3JvdW5kKSk7XG5cdFx0dGhpcy5yb290RWxlbWVudC5zdHlsZS5zZXRQcm9wZXJ0eSgnLS13b3Jrc3BhY2UtdHJ1c3QtdW5zZWxlY3RlZC1jb2xvcicsIGFzQ3NzVmFyaWFibGUoYnV0dG9uU2Vjb25kYXJ5QmFja2dyb3VuZCkpO1xuXHRcdHRoaXMucm9vdEVsZW1lbnQuc3R5bGUuc2V0UHJvcGVydHkoJy0td29ya3NwYWNlLXRydXN0LWNoZWNrLWNvbG9yJywgYXNDc3NWYXJpYWJsZShkZWJ1Z0ljb25TdGFydEZvcmVncm91bmQpKTtcblx0XHR0aGlzLnJvb3RFbGVtZW50LnN0eWxlLnNldFByb3BlcnR5KCctLXdvcmtzcGFjZS10cnVzdC14LWNvbG9yJywgYXNDc3NWYXJpYWJsZShlZGl0b3JFcnJvckZvcmVncm91bmQpKTtcblxuXHRcdC8vIE5hdmlnYXRlIHBhZ2Ugd2l0aCBrZXlib2FyZFxuXHRcdHRoaXMuX3JlZ2lzdGVyKGFkZERpc3Bvc2FibGVMaXN0ZW5lcih0aGlzLnJvb3RFbGVtZW50LCBFdmVudFR5cGUuS0VZX0RPV04sIGUgPT4ge1xuXHRcdFx0Y29uc3QgZXZlbnQgPSBuZXcgU3RhbmRhcmRLZXlib2FyZEV2ZW50KGUpO1xuXG5cdFx0XHRpZiAoZXZlbnQuZXF1YWxzKEtleUNvZGUuVXBBcnJvdykgfHwgZXZlbnQuZXF1YWxzKEtleUNvZGUuRG93bkFycm93KSkge1xuXHRcdFx0XHRjb25zdCBuYXZPcmRlciA9IFt0aGlzLmhlYWRlckNvbnRhaW5lciwgdGhpcy50cnVzdGVkQ29udGFpbmVyLCB0aGlzLnVudHJ1c3RlZENvbnRhaW5lciwgdGhpcy5jb25maWd1cmF0aW9uQ29udGFpbmVyXTtcblx0XHRcdFx0Y29uc3QgY3VycmVudEluZGV4ID0gbmF2T3JkZXIuZmluZEluZGV4KGVsZW1lbnQgPT4ge1xuXHRcdFx0XHRcdHJldHVybiBpc0FuY2VzdG9yT2ZBY3RpdmVFbGVtZW50KGVsZW1lbnQpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRsZXQgbmV3SW5kZXggPSBjdXJyZW50SW5kZXg7XG5cdFx0XHRcdGlmIChldmVudC5lcXVhbHMoS2V5Q29kZS5Eb3duQXJyb3cpKSB7XG5cdFx0XHRcdFx0bmV3SW5kZXgrKztcblx0XHRcdFx0fSBlbHNlIGlmIChldmVudC5lcXVhbHMoS2V5Q29kZS5VcEFycm93KSkge1xuXHRcdFx0XHRcdG5ld0luZGV4ID0gTWF0aC5tYXgoMCwgbmV3SW5kZXgpO1xuXHRcdFx0XHRcdG5ld0luZGV4LS07XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRuZXdJbmRleCArPSBuYXZPcmRlci5sZW5ndGg7XG5cdFx0XHRcdG5ld0luZGV4ICU9IG5hdk9yZGVyLmxlbmd0aDtcblxuXHRcdFx0XHRuYXZPcmRlcltuZXdJbmRleF0uZm9jdXMoKTtcblx0XHRcdH0gZWxzZSBpZiAoZXZlbnQuZXF1YWxzKEtleUNvZGUuRXNjYXBlKSkge1xuXHRcdFx0XHR0aGlzLnJvb3RFbGVtZW50LmZvY3VzKCk7XG5cdFx0XHR9IGVsc2UgaWYgKGV2ZW50LmVxdWFscyhLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuRW50ZXIpKSB7XG5cdFx0XHRcdGlmICh0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UuY2FuU2V0V29ya3NwYWNlVHJ1c3QoKSkge1xuXHRcdFx0XHRcdHRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5zZXRXb3Jrc3BhY2VUcnVzdCghdGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLmlzV29ya3NwYWNlVHJ1c3RlZCgpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChldmVudC5lcXVhbHMoS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLkVudGVyKSkge1xuXHRcdFx0XHRpZiAodGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLmNhblNldFBhcmVudEZvbGRlclRydXN0KCkpIHtcblx0XHRcdFx0XHR0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2Uuc2V0UGFyZW50Rm9sZGVyVHJ1c3QodHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRvdmVycmlkZSBmb2N1cygpIHtcblx0XHRzdXBlci5mb2N1cygpO1xuXG5cdFx0dGhpcy5yb290RWxlbWVudC5mb2N1cygpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgc2V0SW5wdXQoaW5wdXQ6IFdvcmtzcGFjZVRydXN0RWRpdG9ySW5wdXQsIG9wdGlvbnM6IElFZGl0b3JPcHRpb25zIHwgdW5kZWZpbmVkLCBjb250ZXh0OiBJRWRpdG9yT3BlbkNvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0YXdhaXQgc3VwZXIuc2V0SW5wdXQoaW5wdXQsIG9wdGlvbnMsIGNvbnRleHQsIHRva2VuKTtcblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHsgcmV0dXJuOyB9XG5cblx0XHRhd2FpdCB0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2Uud29ya3NwYWNlVHJ1c3RJbml0aWFsaXplZDtcblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cdFx0YXdhaXQgdGhpcy5yZW5kZXIoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5leHRlbnNpb25Xb3JrYmVuY2hTZXJ2aWNlLm9uQ2hhbmdlKCgpID0+IHRoaXMucmVuZGVyKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlUmVzdHJpY3RlZFNldHRpbmdzKCgpID0+IHRoaXMucmVuZGVyKCkpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2Uub25EaWRDaGFuZ2VUcnVzdCgoKSA9PiB0aGlzLnJlbmRlcigpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlVHJ1c3RlZEZvbGRlcnMoKCkgPT4gdGhpcy5yZW5kZXIoKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRIZWFkZXJDb250YWluZXJDbGFzcyh0cnVzdGVkOiBib29sZWFuKTogc3RyaW5nIHtcblx0XHRpZiAodHJ1c3RlZCkge1xuXHRcdFx0cmV0dXJuICd3b3Jrc3BhY2UtdHJ1c3QtaGVhZGVyIHdvcmtzcGFjZS10cnVzdC10cnVzdGVkJztcblx0XHR9XG5cblx0XHRyZXR1cm4gJ3dvcmtzcGFjZS10cnVzdC1oZWFkZXIgd29ya3NwYWNlLXRydXN0LXVudHJ1c3RlZCc7XG5cdH1cblxuXHRwcml2YXRlIGdldEhlYWRlclRpdGxlVGV4dCh0cnVzdGVkOiBib29sZWFuKTogc3RyaW5nIHtcblx0XHRpZiAodHJ1c3RlZCkge1xuXHRcdFx0aWYgKHRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5pc1dvcmtzcGFjZVRydXN0Rm9yY2VkKCkpIHtcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCd0cnVzdGVkVW5zZXR0YWJsZVdpbmRvdycsIFwiVGhpcyB3aW5kb3cgaXMgdHJ1c3RlZFwiKTtcblx0XHRcdH1cblxuXHRcdFx0c3dpdGNoICh0aGlzLndvcmtzcGFjZVNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSkge1xuXHRcdFx0XHRjYXNlIFdvcmtiZW5jaFN0YXRlLkVNUFRZOlxuXHRcdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgndHJ1c3RlZEhlYWRlcldpbmRvdycsIFwiWW91IHRydXN0IHRoaXMgd2luZG93XCIpO1xuXHRcdFx0XHRjYXNlIFdvcmtiZW5jaFN0YXRlLkZPTERFUjpcblx0XHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3RydXN0ZWRIZWFkZXJGb2xkZXInLCBcIllvdSB0cnVzdCB0aGlzIGZvbGRlclwiKTtcblx0XHRcdFx0Y2FzZSBXb3JrYmVuY2hTdGF0ZS5XT1JLU1BBQ0U6XG5cdFx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCd0cnVzdGVkSGVhZGVyV29ya3NwYWNlJywgXCJZb3UgdHJ1c3QgdGhpcyB3b3Jrc3BhY2VcIik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGxvY2FsaXplKCd1bnRydXN0ZWRIZWFkZXInLCBcIllvdSBhcmUgaW4gUmVzdHJpY3RlZCBNb2RlXCIpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRIZWFkZXJUaXRsZUljb25DbGFzc05hbWVzKHRydXN0ZWQ6IGJvb2xlYW4pOiBzdHJpbmdbXSB7XG5cdFx0cmV0dXJuIFRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KHNoaWVsZEljb24pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRGZWF0dXJlc0hlYWRlclRleHQodHJ1c3RlZDogYm9vbGVhbik6IFtzdHJpbmcsIHN0cmluZ10ge1xuXHRcdGxldCB0aXRsZTogc3RyaW5nID0gJyc7XG5cdFx0bGV0IHN1YlRpdGxlOiBzdHJpbmcgPSAnJztcblxuXHRcdHN3aXRjaCAodGhpcy53b3Jrc3BhY2VTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkpIHtcblx0XHRcdGNhc2UgV29ya2JlbmNoU3RhdGUuRU1QVFk6IHtcblx0XHRcdFx0dGl0bGUgPSB0cnVzdGVkID8gbG9jYWxpemUoJ3RydXN0ZWRXaW5kb3cnLCBcIkluIGEgVHJ1c3RlZCBXaW5kb3dcIikgOiBsb2NhbGl6ZSgndW50cnVzdGVkV29ya3NwYWNlJywgXCJJbiBSZXN0cmljdGVkIE1vZGVcIik7XG5cdFx0XHRcdHN1YlRpdGxlID0gdHJ1c3RlZCA/IGxvY2FsaXplKCd0cnVzdGVkV2luZG93U3VidGl0bGUnLCBcIllvdSB0cnVzdCB0aGUgYXV0aG9ycyBvZiB0aGUgZmlsZXMgaW4gdGhlIGN1cnJlbnQgd2luZG93LiBBbGwgZmVhdHVyZXMgYXJlIGVuYWJsZWQ6XCIpIDpcblx0XHRcdFx0XHRsb2NhbGl6ZSgndW50cnVzdGVkV2luZG93U3VidGl0bGUnLCBcIllvdSBkbyBub3QgdHJ1c3QgdGhlIGF1dGhvcnMgb2YgdGhlIGZpbGVzIGluIHRoZSBjdXJyZW50IHdpbmRvdy4gVGhlIGZvbGxvd2luZyBmZWF0dXJlcyBhcmUgZGlzYWJsZWQ6XCIpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgV29ya2JlbmNoU3RhdGUuRk9MREVSOiB7XG5cdFx0XHRcdHRpdGxlID0gdHJ1c3RlZCA/IGxvY2FsaXplKCd0cnVzdGVkRm9sZGVyJywgXCJJbiBhIFRydXN0ZWQgRm9sZGVyXCIpIDogbG9jYWxpemUoJ3VudHJ1c3RlZFdvcmtzcGFjZScsIFwiSW4gUmVzdHJpY3RlZCBNb2RlXCIpO1xuXHRcdFx0XHRzdWJUaXRsZSA9IHRydXN0ZWQgPyBsb2NhbGl6ZSgndHJ1c3RlZEZvbGRlclN1YnRpdGxlJywgXCJZb3UgdHJ1c3QgdGhlIGF1dGhvcnMgb2YgdGhlIGZpbGVzIGluIHRoZSBjdXJyZW50IGZvbGRlci4gQWxsIGZlYXR1cmVzIGFyZSBlbmFibGVkOlwiKSA6XG5cdFx0XHRcdFx0bG9jYWxpemUoJ3VudHJ1c3RlZEZvbGRlclN1YnRpdGxlJywgXCJZb3UgZG8gbm90IHRydXN0IHRoZSBhdXRob3JzIG9mIHRoZSBmaWxlcyBpbiB0aGUgY3VycmVudCBmb2xkZXIuIFRoZSBmb2xsb3dpbmcgZmVhdHVyZXMgYXJlIGRpc2FibGVkOlwiKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0XHRjYXNlIFdvcmtiZW5jaFN0YXRlLldPUktTUEFDRToge1xuXHRcdFx0XHR0aXRsZSA9IHRydXN0ZWQgPyBsb2NhbGl6ZSgndHJ1c3RlZFdvcmtzcGFjZScsIFwiSW4gYSBUcnVzdGVkIFdvcmtzcGFjZVwiKSA6IGxvY2FsaXplKCd1bnRydXN0ZWRXb3Jrc3BhY2UnLCBcIkluIFJlc3RyaWN0ZWQgTW9kZVwiKTtcblx0XHRcdFx0c3ViVGl0bGUgPSB0cnVzdGVkID8gbG9jYWxpemUoJ3RydXN0ZWRXb3Jrc3BhY2VTdWJ0aXRsZScsIFwiWW91IHRydXN0IHRoZSBhdXRob3JzIG9mIHRoZSBmaWxlcyBpbiB0aGUgY3VycmVudCB3b3Jrc3BhY2UuIEFsbCBmZWF0dXJlcyBhcmUgZW5hYmxlZDpcIikgOlxuXHRcdFx0XHRcdGxvY2FsaXplKCd1bnRydXN0ZWRXb3Jrc3BhY2VTdWJ0aXRsZScsIFwiWW91IGRvIG5vdCB0cnVzdCB0aGUgYXV0aG9ycyBvZiB0aGUgZmlsZXMgaW4gdGhlIGN1cnJlbnQgd29ya3NwYWNlLiBUaGUgZm9sbG93aW5nIGZlYXR1cmVzIGFyZSBkaXNhYmxlZDpcIik7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBbdGl0bGUsIHN1YlRpdGxlXTtcblx0fVxuXG5cdHByaXZhdGUgcmVuZGVyaW5nID0gZmFsc2U7XG5cdHByaXZhdGUgcmVhZG9ubHkgcmVyZW5kZXJEaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0QGRlYm91bmNlKDEwMClcblx0cHJpdmF0ZSBhc3luYyByZW5kZXIoKSB7XG5cdFx0aWYgKHRoaXMucmVuZGVyaW5nKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5yZW5kZXJpbmcgPSB0cnVlO1xuXHRcdHRoaXMucmVyZW5kZXJEaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0Y29uc3QgaXNXb3Jrc3BhY2VUcnVzdGVkID0gdGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLmlzV29ya3NwYWNlVHJ1c3RlZCgpO1xuXHRcdHRoaXMucm9vdEVsZW1lbnQuY2xhc3NMaXN0LnRvZ2dsZSgndHJ1c3RlZCcsIGlzV29ya3NwYWNlVHJ1c3RlZCk7XG5cdFx0dGhpcy5yb290RWxlbWVudC5jbGFzc0xpc3QudG9nZ2xlKCd1bnRydXN0ZWQnLCAhaXNXb3Jrc3BhY2VUcnVzdGVkKTtcblxuXHRcdC8vIEhlYWRlciBTZWN0aW9uXG5cdFx0dGhpcy5oZWFkZXJUaXRsZVRleHQuaW5uZXJUZXh0ID0gdGhpcy5nZXRIZWFkZXJUaXRsZVRleHQoaXNXb3Jrc3BhY2VUcnVzdGVkKTtcblx0XHR0aGlzLmhlYWRlclRpdGxlSWNvbi5jbGFzc05hbWUgPSAnd29ya3NwYWNlLXRydXN0LXRpdGxlLWljb24nO1xuXHRcdHRoaXMuaGVhZGVyVGl0bGVJY29uLmNsYXNzTGlzdC5hZGQoLi4udGhpcy5nZXRIZWFkZXJUaXRsZUljb25DbGFzc05hbWVzKGlzV29ya3NwYWNlVHJ1c3RlZCkpO1xuXHRcdHRoaXMuaGVhZGVyRGVzY3JpcHRpb24uaW5uZXJUZXh0ID0gJyc7XG5cblx0XHRjb25zdCBoZWFkZXJEZXNjcmlwdGlvblRleHQgPSBhcHBlbmQodGhpcy5oZWFkZXJEZXNjcmlwdGlvbiwgJCgnZGl2JykpO1xuXHRcdGhlYWRlckRlc2NyaXB0aW9uVGV4dC5pbm5lclRleHQgPSBpc1dvcmtzcGFjZVRydXN0ZWQgP1xuXHRcdFx0bG9jYWxpemUoJ3RydXN0ZWREZXNjcmlwdGlvbicsIFwiQWxsIGZlYXR1cmVzIGFyZSBlbmFibGVkIGJlY2F1c2UgdHJ1c3QgaGFzIGJlZW4gZ3JhbnRlZCB0byB0aGUgd29ya3NwYWNlLlwiKSA6XG5cdFx0XHRsb2NhbGl6ZSgndW50cnVzdGVkRGVzY3JpcHRpb24nLCBcInswfSBpcyBpbiBhIHJlc3RyaWN0ZWQgbW9kZSBpbnRlbmRlZCBmb3Igc2FmZSBjb2RlIGJyb3dzaW5nLlwiLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVTaG9ydCk7XG5cblx0XHRjb25zdCBoZWFkZXJEZXNjcmlwdGlvbkFjdGlvbnMgPSBhcHBlbmQodGhpcy5oZWFkZXJEZXNjcmlwdGlvbiwgJCgnZGl2JykpO1xuXHRcdGNvbnN0IGhlYWRlckRlc2NyaXB0aW9uQWN0aW9uc1RleHQgPSBsb2NhbGl6ZSh7IGtleTogJ3dvcmtzcGFjZVRydXN0RWRpdG9ySGVhZGVyQWN0aW9ucycsIGNvbW1lbnQ6IFsnUGxlYXNlIGVuc3VyZSB0aGUgbWFya2Rvd24gbGluayBzeW50YXggaXMgbm90IGJyb2tlbiB1cCB3aXRoIHdoaXRlc3BhY2UgW3RleHQgYmxvY2tdKGxpbmsgYmxvY2spJ10gfSwgXCJbQ29uZmlndXJlIHlvdXIgc2V0dGluZ3NdKHswfSkgb3IgW2xlYXJuIG1vcmVdKGh0dHBzOi8vYWthLm1zL3ZzY29kZS13b3Jrc3BhY2UtdHJ1c3QpLlwiLCBgY29tbWFuZDp3b3JrYmVuY2gudHJ1c3QuY29uZmlndXJlYCk7XG5cdFx0Zm9yIChjb25zdCBub2RlIG9mIHBhcnNlTGlua2VkVGV4dChoZWFkZXJEZXNjcmlwdGlvbkFjdGlvbnNUZXh0KS5ub2Rlcykge1xuXHRcdFx0aWYgKHR5cGVvZiBub2RlID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRhcHBlbmQoaGVhZGVyRGVzY3JpcHRpb25BY3Rpb25zLCBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZShub2RlKSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHR0aGlzLnJlcmVuZGVyRGlzcG9zYWJsZXMuYWRkKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTGluaywgaGVhZGVyRGVzY3JpcHRpb25BY3Rpb25zLCB7IC4uLm5vZGUsIHRhYkluZGV4OiAtMSB9LCB7fSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuaGVhZGVyQ29udGFpbmVyLmNsYXNzTmFtZSA9IHRoaXMuZ2V0SGVhZGVyQ29udGFpbmVyQ2xhc3MoaXNXb3Jrc3BhY2VUcnVzdGVkKTtcblx0XHR0aGlzLnJvb3RFbGVtZW50LnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsIGAke2xvY2FsaXplKCdyb290IGVsZW1lbnQgbGFiZWwnLCBcIk1hbmFnZSBXb3Jrc3BhY2UgVHJ1c3RcIil9OiAgJHt0aGlzLmhlYWRlckNvbnRhaW5lci5pbm5lclRleHR9YCk7XG5cblx0XHQvLyBTZXR0aW5nc1xuXHRcdGNvbnN0IHJlc3RyaWN0ZWRTZXR0aW5ncyA9IHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UucmVzdHJpY3RlZFNldHRpbmdzO1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25SZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KEV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbik7XG5cdFx0Y29uc3Qgc2V0dGluZ3NSZXF1aXJpbmdUcnVzdGVkV29ya3NwYWNlQ291bnQgPSByZXN0cmljdGVkU2V0dGluZ3MuZGVmYXVsdC5maWx0ZXIoa2V5ID0+IHtcblx0XHRcdGNvbnN0IHByb3BlcnR5ID0gY29uZmlndXJhdGlvblJlZ2lzdHJ5LmdldENvbmZpZ3VyYXRpb25Qcm9wZXJ0aWVzKClba2V5XTtcblxuXHRcdFx0Ly8gY2Fubm90IGJlIGNvbmZpZ3VyZWQgaW4gd29ya3NwYWNlXG5cdFx0XHRpZiAocHJvcGVydHkuc2NvcGUgJiYgKEFQUExJQ0FUSU9OX1NDT1BFUy5pbmNsdWRlcyhwcm9wZXJ0eS5zY29wZSkgfHwgcHJvcGVydHkuc2NvcGUgPT09IENvbmZpZ3VyYXRpb25TY29wZS5NQUNISU5FKSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cblx0XHRcdC8vIElmIGRlcHJlY2F0ZWQgaW5jbHVkZSBvbmx5IHRob3NlIGNvbmZpZ3VyZWQgaW4gdGhlIHdvcmtzcGFjZVxuXHRcdFx0aWYgKHByb3BlcnR5LmRlcHJlY2F0aW9uTWVzc2FnZSB8fCBwcm9wZXJ0eS5tYXJrZG93bkRlcHJlY2F0aW9uTWVzc2FnZSkge1xuXHRcdFx0XHRpZiAocmVzdHJpY3RlZFNldHRpbmdzLndvcmtzcGFjZT8uaW5jbHVkZXMoa2V5KSkge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChyZXN0cmljdGVkU2V0dGluZ3Mud29ya3NwYWNlRm9sZGVyKSB7XG5cdFx0XHRcdFx0Zm9yIChjb25zdCB3b3Jrc3BhY2VGb2xkZXJTZXR0aW5ncyBvZiByZXN0cmljdGVkU2V0dGluZ3Mud29ya3NwYWNlRm9sZGVyLnZhbHVlcygpKSB7XG5cdFx0XHRcdFx0XHRpZiAod29ya3NwYWNlRm9sZGVyU2V0dGluZ3MuaW5jbHVkZXMoa2V5KSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9KS5sZW5ndGg7XG5cblx0XHQvLyBGZWF0dXJlcyBMaXN0XG5cdFx0dGhpcy5yZW5kZXJBZmZlY3RlZEZlYXR1cmVzKHNldHRpbmdzUmVxdWlyaW5nVHJ1c3RlZFdvcmtzcGFjZUNvdW50LCB0aGlzLmdldEV4dGVuc2lvbkNvdW50KCkpO1xuXG5cdFx0Ly8gQ29uZmlndXJhdGlvbiBUcmVlXG5cdFx0dGhpcy53b3Jrc3BhY2VUcnVzdGVkVXJpc1RhYmxlLnVwZGF0ZVRhYmxlKCk7XG5cblx0XHR0aGlzLmJvZHlTY3JvbGxCYXIuZ2V0RG9tTm9kZSgpLnN0eWxlLmhlaWdodCA9IGBjYWxjKDEwMCUgLSAke3RoaXMuaGVhZGVyQ29udGFpbmVyLmNsaWVudEhlaWdodH1weClgO1xuXHRcdHRoaXMuYm9keVNjcm9sbEJhci5zY2FuRG9tTm9kZSgpO1xuXHRcdHRoaXMucmVuZGVyaW5nID0gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIGdldEV4dGVuc2lvbkNvdW50KCk6IG51bWJlciB7XG5cdFx0Y29uc3Qgc2V0ID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cblx0XHRjb25zdCBpblZpcnR1YWxXb3Jrc3BhY2UgPSBpc1ZpcnR1YWxXb3Jrc3BhY2UodGhpcy53b3Jrc3BhY2VTZXJ2aWNlLmdldFdvcmtzcGFjZSgpKTtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSB0aGlzLmV4dGVuc2lvbldvcmtiZW5jaFNlcnZpY2UubG9jYWwuZmlsdGVyKGV4dCA9PiBleHQubG9jYWwpLm1hcChleHQgPT4gZXh0LmxvY2FsISk7XG5cblx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBsb2NhbEV4dGVuc2lvbnMpIHtcblx0XHRcdGNvbnN0IGVuYWJsZW1lbnRTdGF0ZSA9IHRoaXMuZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuZ2V0RW5hYmxlbWVudFN0YXRlKGV4dGVuc2lvbik7XG5cdFx0XHRpZiAoZW5hYmxlbWVudFN0YXRlICE9PSBFbmFibGVtZW50U3RhdGUuRW5hYmxlZEdsb2JhbGx5ICYmIGVuYWJsZW1lbnRTdGF0ZSAhPT0gRW5hYmxlbWVudFN0YXRlLkVuYWJsZWRXb3Jrc3BhY2UgJiZcblx0XHRcdFx0ZW5hYmxlbWVudFN0YXRlICE9PSBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRCeVRydXN0UmVxdWlyZW1lbnQgJiYgZW5hYmxlbWVudFN0YXRlICE9PSBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRCeUV4dGVuc2lvbkRlcGVuZGVuY3kpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChpblZpcnR1YWxXb3Jrc3BhY2UgJiYgdGhpcy5leHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlLmdldEV4dGVuc2lvblZpcnR1YWxXb3Jrc3BhY2VTdXBwb3J0VHlwZShleHRlbnNpb24ubWFuaWZlc3QpID09PSBmYWxzZSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHRoaXMuZXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZS5nZXRFeHRlbnNpb25VbnRydXN0ZWRXb3Jrc3BhY2VTdXBwb3J0VHlwZShleHRlbnNpb24ubWFuaWZlc3QpICE9PSB0cnVlKSB7XG5cdFx0XHRcdHNldC5hZGQoZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQpO1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZGVwZW5kZW5jaWVzID0gZ2V0RXh0ZW5zaW9uRGVwZW5kZW5jaWVzKGxvY2FsRXh0ZW5zaW9ucywgZXh0ZW5zaW9uKTtcblx0XHRcdGlmIChkZXBlbmRlbmNpZXMuc29tZShleHQgPT4gdGhpcy5leHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlLmdldEV4dGVuc2lvblVudHJ1c3RlZFdvcmtzcGFjZVN1cHBvcnRUeXBlKGV4dC5tYW5pZmVzdCkgPT09IGZhbHNlKSkge1xuXHRcdFx0XHRzZXQuYWRkKGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gc2V0LnNpemU7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZUhlYWRlckVsZW1lbnQocGFyZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMuaGVhZGVyQ29udGFpbmVyID0gYXBwZW5kKHBhcmVudCwgJCgnLndvcmtzcGFjZS10cnVzdC1oZWFkZXInLCB7IHRhYkluZGV4OiAnMCcgfSkpO1xuXHRcdHRoaXMuaGVhZGVyVGl0bGVDb250YWluZXIgPSBhcHBlbmQodGhpcy5oZWFkZXJDb250YWluZXIsICQoJy53b3Jrc3BhY2UtdHJ1c3QtdGl0bGUnKSk7XG5cdFx0dGhpcy5oZWFkZXJUaXRsZUljb24gPSBhcHBlbmQodGhpcy5oZWFkZXJUaXRsZUNvbnRhaW5lciwgJCgnLndvcmtzcGFjZS10cnVzdC10aXRsZS1pY29uJykpO1xuXHRcdHRoaXMuaGVhZGVyVGl0bGVUZXh0ID0gYXBwZW5kKHRoaXMuaGVhZGVyVGl0bGVDb250YWluZXIsICQoJy53b3Jrc3BhY2UtdHJ1c3QtdGl0bGUtdGV4dCcpKTtcblx0XHR0aGlzLmhlYWRlckRlc2NyaXB0aW9uID0gYXBwZW5kKHRoaXMuaGVhZGVyQ29udGFpbmVyLCAkKCcud29ya3NwYWNlLXRydXN0LWRlc2NyaXB0aW9uJykpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVDb25maWd1cmF0aW9uRWxlbWVudChwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5jb25maWd1cmF0aW9uQ29udGFpbmVyID0gYXBwZW5kKHBhcmVudCwgJCgnLndvcmtzcGFjZS10cnVzdC1zZXR0aW5ncycsIHsgdGFiSW5kZXg6ICcwJyB9KSk7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvblRpdGxlID0gYXBwZW5kKHRoaXMuY29uZmlndXJhdGlvbkNvbnRhaW5lciwgJCgnLndvcmtzcGFjZS10cnVzdGVkLWZvbGRlcnMtdGl0bGUnKSk7XG5cdFx0Y29uZmlndXJhdGlvblRpdGxlLmlubmVyVGV4dCA9IGxvY2FsaXplKCd0cnVzdGVkRm9sZGVyc0FuZFdvcmtzcGFjZXMnLCBcIlRydXN0ZWQgRm9sZGVycyAmIFdvcmtzcGFjZXNcIik7XG5cblx0XHR0aGlzLndvcmtzcGFjZVRydXN0ZWRVcmlzVGFibGUgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFdvcmtzcGFjZVRydXN0ZWRVcmlzVGFibGUsIHRoaXMuY29uZmlndXJhdGlvbkNvbnRhaW5lcikpO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVBZmZlY3RlZEZlYXR1cmVzRWxlbWVudChwYXJlbnQ6IEhUTUxFbGVtZW50KTogdm9pZCB7XG5cdFx0dGhpcy5hZmZlY3RlZEZlYXR1cmVzQ29udGFpbmVyID0gYXBwZW5kKHBhcmVudCwgJCgnLndvcmtzcGFjZS10cnVzdC1mZWF0dXJlcycpKTtcblx0XHR0aGlzLnRydXN0ZWRDb250YWluZXIgPSBhcHBlbmQodGhpcy5hZmZlY3RlZEZlYXR1cmVzQ29udGFpbmVyLCAkKCcud29ya3NwYWNlLXRydXN0LWxpbWl0YXRpb25zLnRydXN0ZWQnLCB7IHRhYkluZGV4OiAnMCcgfSkpO1xuXHRcdHRoaXMudW50cnVzdGVkQ29udGFpbmVyID0gYXBwZW5kKHRoaXMuYWZmZWN0ZWRGZWF0dXJlc0NvbnRhaW5lciwgJCgnLndvcmtzcGFjZS10cnVzdC1saW1pdGF0aW9ucy51bnRydXN0ZWQnLCB7IHRhYkluZGV4OiAnMCcgfSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZW5kZXJBZmZlY3RlZEZlYXR1cmVzKG51bVNldHRpbmdzOiBudW1iZXIsIG51bUV4dGVuc2lvbnM6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNsZWFyTm9kZSh0aGlzLnRydXN0ZWRDb250YWluZXIpO1xuXHRcdGNsZWFyTm9kZSh0aGlzLnVudHJ1c3RlZENvbnRhaW5lcik7XG5cblx0XHQvLyBUcnVzdGVkIGZlYXR1cmVzXG5cdFx0Y29uc3QgW3RydXN0ZWRUaXRsZSwgdHJ1c3RlZFN1YlRpdGxlXSA9IHRoaXMuZ2V0RmVhdHVyZXNIZWFkZXJUZXh0KHRydWUpO1xuXG5cdFx0dGhpcy5yZW5kZXJMaW1pdGF0aW9uc0hlYWRlckVsZW1lbnQodGhpcy50cnVzdGVkQ29udGFpbmVyLCB0cnVzdGVkVGl0bGUsIHRydXN0ZWRTdWJUaXRsZSk7XG5cdFx0Y29uc3QgdHJ1c3RlZENvbnRhaW5lckl0ZW1zID0gdGhpcy53b3Jrc3BhY2VTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLkVNUFRZID9cblx0XHRcdFtcblx0XHRcdFx0bG9jYWxpemUoJ3RydXN0ZWRUYXNrcycsIFwiVGFza3MgYXJlIGFsbG93ZWQgdG8gcnVuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgndHJ1c3RlZERlYnVnZ2luZycsIFwiRGVidWdnaW5nIGlzIGVuYWJsZWRcIiksXG5cdFx0XHRcdGxvY2FsaXplKCd0cnVzdGVkRXh0ZW5zaW9ucycsIFwiQWxsIGVuYWJsZWQgZXh0ZW5zaW9ucyBhcmUgYWN0aXZhdGVkXCIpXG5cdFx0XHRdIDpcblx0XHRcdFtcblx0XHRcdFx0bG9jYWxpemUoJ3RydXN0ZWRUYXNrcycsIFwiVGFza3MgYXJlIGFsbG93ZWQgdG8gcnVuXCIpLFxuXHRcdFx0XHRsb2NhbGl6ZSgndHJ1c3RlZERlYnVnZ2luZycsIFwiRGVidWdnaW5nIGlzIGVuYWJsZWRcIiksXG5cdFx0XHRcdGxvY2FsaXplKCd0cnVzdGVkU2V0dGluZ3MnLCBcIkFsbCB3b3Jrc3BhY2Ugc2V0dGluZ3MgYXJlIGFwcGxpZWRcIiksXG5cdFx0XHRcdGxvY2FsaXplKCd0cnVzdGVkRXh0ZW5zaW9ucycsIFwiQWxsIGVuYWJsZWQgZXh0ZW5zaW9ucyBhcmUgYWN0aXZhdGVkXCIpXG5cdFx0XHRdO1xuXHRcdHRoaXMucmVuZGVyTGltaXRhdGlvbnNMaXN0RWxlbWVudCh0aGlzLnRydXN0ZWRDb250YWluZXIsIHRydXN0ZWRDb250YWluZXJJdGVtcywgVGhlbWVJY29uLmFzQ2xhc3NOYW1lQXJyYXkoY2hlY2tMaXN0SWNvbikpO1xuXG5cdFx0Ly8gUmVzdHJpY3RlZCBNb2RlIGZlYXR1cmVzXG5cdFx0Y29uc3QgW3VudHJ1c3RlZFRpdGxlLCB1bnRydXN0ZWRTdWJUaXRsZV0gPSB0aGlzLmdldEZlYXR1cmVzSGVhZGVyVGV4dChmYWxzZSk7XG5cblx0XHR0aGlzLnJlbmRlckxpbWl0YXRpb25zSGVhZGVyRWxlbWVudCh0aGlzLnVudHJ1c3RlZENvbnRhaW5lciwgdW50cnVzdGVkVGl0bGUsIHVudHJ1c3RlZFN1YlRpdGxlKTtcblx0XHRjb25zdCB1bnRydXN0ZWRDb250YWluZXJJdGVtcyA9IHRoaXMud29ya3NwYWNlU2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpID09PSBXb3JrYmVuY2hTdGF0ZS5FTVBUWSA/XG5cdFx0XHRbXG5cdFx0XHRcdGxvY2FsaXplKCd1bnRydXN0ZWRUYXNrcycsIFwiVGFza3MgYXJlIG5vdCBhbGxvd2VkIHRvIHJ1blwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3VudHJ1c3RlZERlYnVnZ2luZycsIFwiRGVidWdnaW5nIGlzIGRpc2FibGVkXCIpLFxuXHRcdFx0XHRmaXhCYWRMb2NhbGl6ZWRMaW5rcyhsb2NhbGl6ZSh7IGtleTogJ3VudHJ1c3RlZEV4dGVuc2lvbnMnLCBjb21tZW50OiBbJ1BsZWFzZSBlbnN1cmUgdGhlIG1hcmtkb3duIGxpbmsgc3ludGF4IGlzIG5vdCBicm9rZW4gdXAgd2l0aCB3aGl0ZXNwYWNlIFt0ZXh0IGJsb2NrXShsaW5rIGJsb2NrKSddIH0sIFwiW3swfSBleHRlbnNpb25zXSh7MX0pIGFyZSBkaXNhYmxlZCBvciBoYXZlIGxpbWl0ZWQgZnVuY3Rpb25hbGl0eVwiLCBudW1FeHRlbnNpb25zLCBgY29tbWFuZDoke0xJU1RfV09SS1NQQUNFX1VOU1VQUE9SVEVEX0VYVEVOU0lPTlNfQ09NTUFORF9JRH1gKSlcblx0XHRcdF0gOlxuXHRcdFx0W1xuXHRcdFx0XHRsb2NhbGl6ZSgndW50cnVzdGVkVGFza3MnLCBcIlRhc2tzIGFyZSBub3QgYWxsb3dlZCB0byBydW5cIiksXG5cdFx0XHRcdGxvY2FsaXplKCd1bnRydXN0ZWREZWJ1Z2dpbmcnLCBcIkRlYnVnZ2luZyBpcyBkaXNhYmxlZFwiKSxcblx0XHRcdFx0Zml4QmFkTG9jYWxpemVkTGlua3MobnVtU2V0dGluZ3MgPyBsb2NhbGl6ZSh7IGtleTogJ3VudHJ1c3RlZFNldHRpbmdzJywgY29tbWVudDogWydQbGVhc2UgZW5zdXJlIHRoZSBtYXJrZG93biBsaW5rIHN5bnRheCBpcyBub3QgYnJva2VuIHVwIHdpdGggd2hpdGVzcGFjZSBbdGV4dCBibG9ja10obGluayBibG9jayknXSB9LCBcIlt7MH0gd29ya3NwYWNlIHNldHRpbmdzXSh7MX0pIGFyZSBub3QgYXBwbGllZFwiLCBudW1TZXR0aW5ncywgJ2NvbW1hbmQ6c2V0dGluZ3MuZmlsdGVyVW50cnVzdGVkJykgOiBsb2NhbGl6ZSgnbm8gdW50cnVzdGVkU2V0dGluZ3MnLCBcIldvcmtzcGFjZSBzZXR0aW5ncyByZXF1aXJpbmcgdHJ1c3QgYXJlIG5vdCBhcHBsaWVkXCIpKSxcblx0XHRcdFx0Zml4QmFkTG9jYWxpemVkTGlua3MobG9jYWxpemUoeyBrZXk6ICd1bnRydXN0ZWRFeHRlbnNpb25zJywgY29tbWVudDogWydQbGVhc2UgZW5zdXJlIHRoZSBtYXJrZG93biBsaW5rIHN5bnRheCBpcyBub3QgYnJva2VuIHVwIHdpdGggd2hpdGVzcGFjZSBbdGV4dCBibG9ja10obGluayBibG9jayknXSB9LCBcIlt7MH0gZXh0ZW5zaW9uc10oezF9KSBhcmUgZGlzYWJsZWQgb3IgaGF2ZSBsaW1pdGVkIGZ1bmN0aW9uYWxpdHlcIiwgbnVtRXh0ZW5zaW9ucywgYGNvbW1hbmQ6JHtMSVNUX1dPUktTUEFDRV9VTlNVUFBPUlRFRF9FWFRFTlNJT05TX0NPTU1BTkRfSUR9YCkpXG5cdFx0XHRdO1xuXHRcdHRoaXMucmVuZGVyTGltaXRhdGlvbnNMaXN0RWxlbWVudCh0aGlzLnVudHJ1c3RlZENvbnRhaW5lciwgdW50cnVzdGVkQ29udGFpbmVySXRlbXMsIFRoZW1lSWNvbi5hc0NsYXNzTmFtZUFycmF5KHhMaXN0SWNvbikpO1xuXG5cdFx0aWYgKHRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5pc1dvcmtzcGFjZVRydXN0ZWQoKSkge1xuXHRcdFx0aWYgKHRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5jYW5TZXRXb3Jrc3BhY2VUcnVzdCgpKSB7XG5cdFx0XHRcdHRoaXMuYWRkRG9udFRydXN0QnV0dG9uVG9FbGVtZW50KHRoaXMudW50cnVzdGVkQ29udGFpbmVyKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuYWRkVHJ1c3RlZFRleHRUb0VsZW1lbnQodGhpcy51bnRydXN0ZWRDb250YWluZXIpO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAodGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLmNhblNldFdvcmtzcGFjZVRydXN0KCkpIHtcblx0XHRcdFx0dGhpcy5hZGRUcnVzdEJ1dHRvblRvRWxlbWVudCh0aGlzLnRydXN0ZWRDb250YWluZXIpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlQnV0dG9uUm93KHBhcmVudDogSFRNTEVsZW1lbnQsIGJ1dHRvbkluZm86IHsgYWN0aW9uOiBBY3Rpb247IGtleWJpbmRpbmc6IFJlc29sdmVkS2V5YmluZGluZyB9W10sIGVuYWJsZWQ/OiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgYnV0dG9uUm93ID0gYXBwZW5kKHBhcmVudCwgJCgnLndvcmtzcGFjZS10cnVzdC1idXR0b25zLXJvdycpKTtcblx0XHRjb25zdCBidXR0b25Db250YWluZXIgPSBhcHBlbmQoYnV0dG9uUm93LCAkKCcud29ya3NwYWNlLXRydXN0LWJ1dHRvbnMnKSk7XG5cdFx0Y29uc3QgYnV0dG9uQmFyID0gdGhpcy5yZXJlbmRlckRpc3Bvc2FibGVzLmFkZChuZXcgQnV0dG9uQmFyKGJ1dHRvbkNvbnRhaW5lcikpO1xuXG5cdFx0Zm9yIChjb25zdCB7IGFjdGlvbiwga2V5YmluZGluZyB9IG9mIGJ1dHRvbkluZm8pIHtcblx0XHRcdGNvbnN0IGJ1dHRvbiA9IGJ1dHRvbkJhci5hZGRCdXR0b25XaXRoRGVzY3JpcHRpb24oZGVmYXVsdEJ1dHRvblN0eWxlcyk7XG5cblx0XHRcdGJ1dHRvbi5sYWJlbCA9IGFjdGlvbi5sYWJlbDtcblx0XHRcdGJ1dHRvbi5lbmFibGVkID0gZW5hYmxlZCAhPT0gdW5kZWZpbmVkID8gZW5hYmxlZCA6IGFjdGlvbi5lbmFibGVkO1xuXHRcdFx0YnV0dG9uLmRlc2NyaXB0aW9uID0ga2V5YmluZGluZy5nZXRMYWJlbCgpITtcblx0XHRcdGJ1dHRvbi5lbGVtZW50LmFyaWFMYWJlbCA9IGFjdGlvbi5sYWJlbCArICcsICcgKyBsb2NhbGl6ZSgna2V5Ym9hcmRTaG9ydGN1dCcsIFwiS2V5Ym9hcmQgU2hvcnRjdXQ6IHswfVwiLCBrZXliaW5kaW5nLmdldEFyaWFMYWJlbCgpISk7XG5cblx0XHRcdHRoaXMucmVyZW5kZXJEaXNwb3NhYmxlcy5hZGQoYnV0dG9uLm9uRGlkQ2xpY2soZSA9PiB7XG5cdFx0XHRcdGlmIChlKSB7XG5cdFx0XHRcdFx0RXZlbnRIZWxwZXIuc3RvcChlLCB0cnVlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGFjdGlvbi5ydW4oKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFkZFRydXN0QnV0dG9uVG9FbGVtZW50KHBhcmVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRjb25zdCB0cnVzdEFjdGlvbiA9IHRoaXMucmVyZW5kZXJEaXNwb3NhYmxlcy5hZGQobmV3IEFjdGlvbignd29ya3NwYWNlLnRydXN0LmJ1dHRvbi5hY3Rpb24uZ3JhbnQnLCBsb2NhbGl6ZSgndHJ1c3RCdXR0b24nLCBcIlRydXN0XCIpLCB1bmRlZmluZWQsIHRydWUsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5zZXRXb3Jrc3BhY2VUcnVzdCh0cnVlKTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCB0cnVzdEFjdGlvbnMgPSBbeyBhY3Rpb246IHRydXN0QWN0aW9uLCBrZXliaW5kaW5nOiB0aGlzLmtleWJpbmRpbmdTZXJ2aWNlLnJlc29sdmVVc2VyQmluZGluZyhpc01hY2ludG9zaCA/ICdDbWQrRW50ZXInIDogJ0N0cmwrRW50ZXInKVswXSB9XTtcblxuXHRcdGlmICh0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UuY2FuU2V0UGFyZW50Rm9sZGVyVHJ1c3QoKSkge1xuXHRcdFx0Y29uc3Qgd29ya3NwYWNlSWRlbnRpZmllciA9IHRvV29ya3NwYWNlSWRlbnRpZmllcih0aGlzLndvcmtzcGFjZVNlcnZpY2UuZ2V0V29ya3NwYWNlKCkpIGFzIElTaW5nbGVGb2xkZXJXb3Jrc3BhY2VJZGVudGlmaWVyO1xuXHRcdFx0Y29uc3QgbmFtZSA9IGJhc2VuYW1lKGRpcm5hbWUod29ya3NwYWNlSWRlbnRpZmllci51cmkpKTtcblxuXHRcdFx0Y29uc3QgdHJ1c3RNZXNzYWdlRWxlbWVudCA9IGFwcGVuZChwYXJlbnQsICQoJy50cnVzdC1tZXNzYWdlLWJveCcpKTtcblx0XHRcdHRydXN0TWVzc2FnZUVsZW1lbnQuaW5uZXJUZXh0ID0gbG9jYWxpemUoJ3RydXN0TWVzc2FnZScsIFwiVHJ1c3QgdGhlIGF1dGhvcnMgb2YgYWxsIGZpbGVzIGluIHRoZSBjdXJyZW50IGZvbGRlciBvciBpdHMgcGFyZW50ICd7MH0nLlwiLCBuYW1lKTtcblxuXHRcdFx0Y29uc3QgdHJ1c3RQYXJlbnRBY3Rpb24gPSB0aGlzLnJlcmVuZGVyRGlzcG9zYWJsZXMuYWRkKG5ldyBBY3Rpb24oJ3dvcmtzcGFjZS50cnVzdC5idXR0b24uYWN0aW9uLmdyYW50UGFyZW50JywgbG9jYWxpemUoJ3RydXN0UGFyZW50QnV0dG9uJywgXCJUcnVzdCBQYXJlbnRcIiksIHVuZGVmaW5lZCwgdHJ1ZSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRhd2FpdCB0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2Uuc2V0UGFyZW50Rm9sZGVyVHJ1c3QodHJ1ZSk7XG5cdFx0XHR9KSk7XG5cblx0XHRcdHRydXN0QWN0aW9ucy5wdXNoKHsgYWN0aW9uOiB0cnVzdFBhcmVudEFjdGlvbiwga2V5YmluZGluZzogdGhpcy5rZXliaW5kaW5nU2VydmljZS5yZXNvbHZlVXNlckJpbmRpbmcoaXNNYWNpbnRvc2ggPyAnQ21kK1NoaWZ0K0VudGVyJyA6ICdDdHJsK1NoaWZ0K0VudGVyJylbMF0gfSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5jcmVhdGVCdXR0b25Sb3cocGFyZW50LCB0cnVzdEFjdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhZGREb250VHJ1c3RCdXR0b25Ub0VsZW1lbnQocGFyZW50OiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHRoaXMuY3JlYXRlQnV0dG9uUm93KHBhcmVudCwgW3tcblx0XHRcdGFjdGlvbjogdGhpcy5yZXJlbmRlckRpc3Bvc2FibGVzLmFkZChuZXcgQWN0aW9uKCd3b3Jrc3BhY2UudHJ1c3QuYnV0dG9uLmFjdGlvbi5kZW55JywgbG9jYWxpemUoJ2RvbnRUcnVzdEJ1dHRvbicsIFwiRG9uJ3QgVHJ1c3RcIiksIHVuZGVmaW5lZCwgdHJ1ZSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRhd2FpdCB0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2Uuc2V0V29ya3NwYWNlVHJ1c3QoZmFsc2UpO1xuXHRcdFx0fSkpLFxuXHRcdFx0a2V5YmluZGluZzogdGhpcy5rZXliaW5kaW5nU2VydmljZS5yZXNvbHZlVXNlckJpbmRpbmcoaXNNYWNpbnRvc2ggPyAnQ21kK0VudGVyJyA6ICdDdHJsK0VudGVyJylbMF1cblx0XHR9XSk7XG5cdH1cblxuXHRwcml2YXRlIGFkZFRydXN0ZWRUZXh0VG9FbGVtZW50KHBhcmVudDogSFRNTEVsZW1lbnQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy53b3Jrc3BhY2VTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgPT09IFdvcmtiZW5jaFN0YXRlLkVNUFRZKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGV4dEVsZW1lbnQgPSBhcHBlbmQocGFyZW50LCAkKCcud29ya3NwYWNlLXRydXN0LXVudHJ1c3RlZC1kZXNjcmlwdGlvbicpKTtcblx0XHRpZiAoIXRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5pc1dvcmtzcGFjZVRydXN0Rm9yY2VkKCkpIHtcblx0XHRcdHRleHRFbGVtZW50LmlubmVyVGV4dCA9IHRoaXMud29ya3NwYWNlU2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpID09PSBXb3JrYmVuY2hTdGF0ZS5XT1JLU1BBQ0UgPyBsb2NhbGl6ZSgndW50cnVzdGVkV29ya3NwYWNlUmVhc29uJywgXCJUaGlzIHdvcmtzcGFjZSBpcyB0cnVzdGVkIHZpYSB0aGUgYm9sZGVkIGVudHJpZXMgaW4gdGhlIHRydXN0ZWQgZm9sZGVycyBiZWxvdy5cIikgOiBsb2NhbGl6ZSgndW50cnVzdGVkRm9sZGVyUmVhc29uJywgXCJUaGlzIGZvbGRlciBpcyB0cnVzdGVkIHZpYSB0aGUgYm9sZGVkIGVudHJpZXMgaW4gdGhlIHRydXN0ZWQgZm9sZGVycyBiZWxvdy5cIik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRleHRFbGVtZW50LmlubmVyVGV4dCA9IGxvY2FsaXplKCd0cnVzdGVkRm9yY2VkUmVhc29uJywgXCJUaGlzIHdpbmRvdyBpcyB0cnVzdGVkIGJ5IG5hdHVyZSBvZiB0aGUgd29ya3NwYWNlIHRoYXQgaXMgb3BlbmVkLlwiKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlbmRlckxpbWl0YXRpb25zSGVhZGVyRWxlbWVudChwYXJlbnQ6IEhUTUxFbGVtZW50LCBoZWFkZXJUZXh0OiBzdHJpbmcsIHN1YnRpdGxlVGV4dDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgbGltaXRhdGlvbnNIZWFkZXJDb250YWluZXIgPSBhcHBlbmQocGFyZW50LCAkKCcud29ya3NwYWNlLXRydXN0LWxpbWl0YXRpb25zLWhlYWRlcicpKTtcblx0XHRjb25zdCB0aXRsZUVsZW1lbnQgPSBhcHBlbmQobGltaXRhdGlvbnNIZWFkZXJDb250YWluZXIsICQoJy53b3Jrc3BhY2UtdHJ1c3QtbGltaXRhdGlvbnMtdGl0bGUnKSk7XG5cdFx0Y29uc3QgdGV4dEVsZW1lbnQgPSBhcHBlbmQodGl0bGVFbGVtZW50LCAkKCcud29ya3NwYWNlLXRydXN0LWxpbWl0YXRpb25zLXRpdGxlLXRleHQnKSk7XG5cdFx0Y29uc3Qgc3VidGl0bGVFbGVtZW50ID0gYXBwZW5kKGxpbWl0YXRpb25zSGVhZGVyQ29udGFpbmVyLCAkKCcud29ya3NwYWNlLXRydXN0LWxpbWl0YXRpb25zLXN1YnRpdGxlJykpO1xuXG5cdFx0dGV4dEVsZW1lbnQuaW5uZXJUZXh0ID0gaGVhZGVyVGV4dDtcblx0XHRzdWJ0aXRsZUVsZW1lbnQuaW5uZXJUZXh0ID0gc3VidGl0bGVUZXh0O1xuXHR9XG5cblx0cHJpdmF0ZSByZW5kZXJMaW1pdGF0aW9uc0xpc3RFbGVtZW50KHBhcmVudDogSFRNTEVsZW1lbnQsIGxpbWl0YXRpb25zOiBzdHJpbmdbXSwgaWNvbkNsYXNzTmFtZXM6IHN0cmluZ1tdKTogdm9pZCB7XG5cdFx0Y29uc3QgbGlzdENvbnRhaW5lciA9IGFwcGVuZChwYXJlbnQsICQoJy53b3Jrc3BhY2UtdHJ1c3QtbGltaXRhdGlvbnMtbGlzdC1jb250YWluZXInKSk7XG5cdFx0Y29uc3QgbGltaXRhdGlvbnNMaXN0ID0gYXBwZW5kKGxpc3RDb250YWluZXIsICQoJ3VsJykpO1xuXHRcdGZvciAoY29uc3QgbGltaXRhdGlvbiBvZiBsaW1pdGF0aW9ucykge1xuXHRcdFx0Y29uc3QgbGltaXRhdGlvbkxpc3RJdGVtID0gYXBwZW5kKGxpbWl0YXRpb25zTGlzdCwgJCgnbGknKSk7XG5cdFx0XHRjb25zdCBpY29uID0gYXBwZW5kKGxpbWl0YXRpb25MaXN0SXRlbSwgJCgnLmxpc3QtaXRlbS1pY29uJykpO1xuXHRcdFx0Y29uc3QgdGV4dCA9IGFwcGVuZChsaW1pdGF0aW9uTGlzdEl0ZW0sICQoJy5saXN0LWl0ZW0tdGV4dCcpKTtcblxuXHRcdFx0aWNvbi5jbGFzc0xpc3QuYWRkKC4uLmljb25DbGFzc05hbWVzKTtcblxuXHRcdFx0Y29uc3QgbGlua2VkVGV4dCA9IHBhcnNlTGlua2VkVGV4dChsaW1pdGF0aW9uKTtcblx0XHRcdGZvciAoY29uc3Qgbm9kZSBvZiBsaW5rZWRUZXh0Lm5vZGVzKSB7XG5cdFx0XHRcdGlmICh0eXBlb2Ygbm9kZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRhcHBlbmQodGV4dCwgZG9jdW1lbnQuY3JlYXRlVGV4dE5vZGUobm9kZSkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMucmVyZW5kZXJEaXNwb3NhYmxlcy5hZGQodGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShMaW5rLCB0ZXh0LCB7IC4uLm5vZGUsIHRhYkluZGV4OiAtMSB9LCB7fSkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBsYXlvdXRQYXJ0aWNpcGFudHM6IHsgbGF5b3V0OiAoKSA9PiB2b2lkIH1bXSA9IFtdO1xuXHRsYXlvdXQoZGltZW5zaW9uOiBEaW1lbnNpb24pOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuaXNWaXNpYmxlKCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLndvcmtzcGFjZVRydXN0ZWRVcmlzVGFibGUubGF5b3V0KCk7XG5cblx0XHR0aGlzLmxheW91dFBhcnRpY2lwYW50cy5mb3JFYWNoKHBhcnRpY2lwYW50ID0+IHtcblx0XHRcdHBhcnRpY2lwYW50LmxheW91dCgpO1xuXHRcdH0pO1xuXG5cdFx0dGhpcy5ib2R5U2Nyb2xsQmFyLnNjYW5Eb21Ob2RlKCk7XG5cdH1cbn1cblxuLy8gSGlnaGx5IHNjb3BlZCBmaXggZm9yICMxMjY2MTRcbmZ1bmN0aW9uIGZpeEJhZExvY2FsaXplZExpbmtzKGJhZFN0cmluZzogc3RyaW5nKTogc3RyaW5nIHtcblx0Y29uc3QgcmVnZXggPSAvKC4qKVxcWyguKylcXF1cXHMqXFwoKC4rKVxcKSguKikvOyAvLyBtYXJrZG93biBsaW5rIG1hdGNoIHdpdGggc3BhY2VzXG5cdHJldHVybiBiYWRTdHJpbmcucmVwbGFjZShyZWdleCwgJyQxWyQyXSgkMykkNCcpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLEdBQUcsdUJBQXVCLCtCQUErQixRQUFRLFdBQXNCLGFBQWEsV0FBVyxpQ0FBaUM7QUFDekosU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBbUIsVUFBVSxtQkFBbUI7QUFDaEQsU0FBUyw0QkFBNEI7QUFFckMsU0FBUyxjQUF1QjtBQUVoQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxlQUFzQjtBQUMvQixTQUFTLFNBQVMsY0FBYztBQUNoQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLFlBQVksdUJBQXVCO0FBQzVDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZUFBZTtBQUN4QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLFdBQVc7QUFDcEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxvQkFBb0Isa0JBQTBDO0FBQ3ZFLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsWUFBWTtBQUNyQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLG1CQUFtQiwwQkFBMEI7QUFDdEQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxlQUFlLGtCQUFrQiwyQkFBMkIsNkJBQTZCO0FBQ2xHLFNBQTJD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
