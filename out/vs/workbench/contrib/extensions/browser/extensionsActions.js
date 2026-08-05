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
import "./media/extensionActions.css";
import { localize, localize2 } from "../../../../nls.js";
import { Action, Separator, SubmenuAction } from "../../../../base/common/actions.js";
import { Delayer, Promises, Throttler } from "../../../../base/common/async.js";
import * as DOM from "../../../../base/browser/dom.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import * as json from "../../../../base/common/json.js";
import { IContextMenuService } from "../../../../platform/contextview/browser/contextView.js";
import { disposeIfDisposable } from "../../../../base/common/lifecycle.js";
import { ExtensionState, IExtensionsWorkbenchService, TOGGLE_IGNORE_EXTENSION_ACTION_ID, SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID, THEME_ACTIONS_GROUP, INSTALL_ACTIONS_GROUP, UPDATE_ACTIONS_GROUP, ExtensionEditorTab, ExtensionRuntimeActionType, AutoUpdateConfigurationKey } from "../common/extensions.js";
import { ExtensionsConfigurationInitialContent } from "../common/extensionsFileTemplate.js";
import { IExtensionGalleryService, InstallOperation, ExtensionManagementErrorCode, IAllowedExtensionsService } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { IWorkbenchExtensionEnablementService, EnablementState, IExtensionManagementServerService, IWorkbenchExtensionManagementService } from "../../../services/extensionManagement/common/extensionManagement.js";
import { ExtensionRecommendationReason, IExtensionIgnoredRecommendationsService, IExtensionRecommendationsService } from "../../../services/extensionRecommendations/common/extensionRecommendations.js";
import { areSameExtensions, getExtensionId } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { ExtensionType, ExtensionIdentifier, isLanguagePackExtension, getWorkspaceSupportTypeMessage, TargetPlatform, isApplicationScopedExtension } from "../../../../platform/extensions/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IWorkspaceContextService, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IExtensionService, toExtension, toExtensionDescription } from "../../../services/extensions/common/extensions.js";
import { URI } from "../../../../base/common/uri.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { registerThemingParticipant } from "../../../../platform/theme/common/themeService.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { buttonBackground, buttonForeground, buttonHoverBackground, registerColor, editorWarningForeground, editorInfoForeground, editorErrorForeground, buttonSeparator } from "../../../../platform/theme/common/colorRegistry.js";
import { IJSONEditingService } from "../../../services/configuration/common/jsonEditing.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { MenuId, IMenuService } from "../../../../platform/actions/common/actions.js";
import { PICK_WORKSPACE_FOLDER_COMMAND_ID } from "../../../browser/actions/workspaceCommands.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { alert } from "../../../../base/browser/ui/aria/aria.js";
import { IWorkbenchThemeService } from "../../../services/themes/common/workbenchThemeService.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { ITextFileService } from "../../../services/textfile/common/textfiles.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { ActionViewItem } from "../../../../base/browser/ui/actionbar/actionViewItems.js";
import { EXTENSIONS_CONFIG } from "../../../services/extensionRecommendations/common/workspaceExtensionsConfig.js";
import { getErrorMessage, isCancellationError } from "../../../../base/common/errors.js";
import { IUserDataSyncEnablementService } from "../../../../platform/userDataSync/common/userDataSync.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { errorIcon, infoIcon, manageExtensionIcon, syncEnabledIcon, syncIgnoredIcon, trustIcon, warningIcon } from "./extensionsIcons.js";
import { isIOS, isWeb, language } from "../../../../base/common/platform.js";
import { IExtensionManifestPropertiesService } from "../../../services/extensions/common/extensionManifestPropertiesService.js";
import { IWorkspaceTrustEnablementService, IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { isVirtualWorkspace } from "../../../../platform/workspace/common/virtualWorkspace.js";
import { escapeMarkdownSyntaxTokens, MarkdownString } from "../../../../base/common/htmlContent.js";
import { fromNow } from "../../../../base/common/date.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { getLocale } from "../../../../platform/languagePacks/common/languagePacks.js";
import { ILocaleService } from "../../../services/localization/common/locale.js";
import { isString } from "../../../../base/common/types.js";
import { showWindowLogActionId } from "../../../services/log/common/logConstants.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { Extensions, IExtensionFeaturesManagementService } from "../../../services/extensionManagement/common/extensionFeatures.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IUpdateService } from "../../../../platform/update/common/update.js";
import { ActionWithDropdownActionViewItem } from "../../../../base/browser/ui/dropdown/dropdownActionViewItem.js";
import { IAuthenticationUsageService } from "../../../services/authentication/browser/authenticationUsageService.js";
import { IExtensionGalleryManifestService } from "../../../../platform/extensionManagement/common/extensionGalleryManifest.js";
let PromptExtensionInstallFailureAction = class extends Action {
  constructor(extension, options, version, installOperation, error, productService, openerService, notificationService, dialogService, commandService, logService, extensionManagementServerService, instantiationService, galleryService, extensionManifestPropertiesService) {
    super("extension.promptExtensionInstallFailure");
    this.extension = extension;
    this.options = options;
    this.version = version;
    this.installOperation = installOperation;
    this.error = error;
    this.productService = productService;
    this.openerService = openerService;
    this.notificationService = notificationService;
    this.dialogService = dialogService;
    this.commandService = commandService;
    this.logService = logService;
    this.extensionManagementServerService = extensionManagementServerService;
    this.instantiationService = instantiationService;
    this.galleryService = galleryService;
    this.extensionManifestPropertiesService = extensionManifestPropertiesService;
  }
  async run() {
    if (isCancellationError(this.error)) {
      return;
    }
    this.logService.error(this.error);
    if (this.error.name === ExtensionManagementErrorCode.Unsupported) {
      const productName = isWeb ? localize("VS Code for Web", "{0} for the Web", this.productService.nameLong) : this.productService.nameLong;
      const message2 = localize("cannot be installed", "The '{0}' extension is not available in {1}. Click 'More Information' to learn more.", this.extension.displayName || this.extension.identifier.id, productName);
      const { confirmed } = await this.dialogService.confirm({
        type: Severity.Info,
        message: message2,
        primaryButton: localize({ key: "more information", comment: ["&& denotes a mnemonic"] }, "&&More Information"),
        cancelButton: localize("close", "Close")
      });
      if (confirmed) {
        this.openerService.open(isWeb ? URI.parse("https://aka.ms/vscode-web-extensions-guide") : URI.parse("https://aka.ms/vscode-remote"));
      }
      return;
    }
    if (ExtensionManagementErrorCode.ReleaseVersionNotFound === this.error.name) {
      await this.dialogService.prompt({
        type: "error",
        message: getErrorMessage(this.error),
        buttons: [{
          label: localize("install prerelease", "Install Pre-Release"),
          run: () => {
            const installAction = this.instantiationService.createInstance(InstallAction, { installPreReleaseVersion: true });
            installAction.extension = this.extension;
            return installAction.run();
          }
        }],
        cancelButton: localize("cancel", "Cancel")
      });
      return;
    }
    if ([ExtensionManagementErrorCode.Incompatible, ExtensionManagementErrorCode.IncompatibleApi, ExtensionManagementErrorCode.IncompatibleTargetPlatform, ExtensionManagementErrorCode.Malicious, ExtensionManagementErrorCode.Deprecated].includes(this.error.name)) {
      await this.dialogService.info(getErrorMessage(this.error));
      return;
    }
    if (ExtensionManagementErrorCode.PackageNotSigned === this.error.name) {
      await this.dialogService.prompt({
        type: "error",
        message: localize("not signed", "'{0}' is an extension from an unknown source. Are you sure you want to install?", this.extension.displayName),
        detail: getErrorMessage(this.error),
        buttons: [{
          label: localize("install anyway", "Install Anyway"),
          run: () => {
            const installAction = this.instantiationService.createInstance(InstallAction, { ...this.options, donotVerifySignature: true });
            installAction.extension = this.extension;
            return installAction.run();
          }
        }],
        cancelButton: true
      });
      return;
    }
    if (ExtensionManagementErrorCode.SignatureVerificationFailed === this.error.name || ExtensionManagementErrorCode.SignatureVerificationInternal === this.error.name) {
      await this.dialogService.prompt({
        type: "error",
        message: localize("verification failed", "Cannot install '{0}' extension because {1} cannot verify the extension signature", this.extension.displayName, this.productService.nameLong),
        detail: getErrorMessage(this.error),
        buttons: [{
          label: localize("learn more", "Learn More"),
          run: () => this.openerService.open("https://code.visualstudio.com/docs/editor/extension-marketplace#_the-extension-signature-cannot-be-verified-by-vs-code")
        }, {
          label: localize("install donot verify", "Install Anyway (Don't Verify Signature)"),
          run: () => {
            const installAction = this.instantiationService.createInstance(InstallAction, { ...this.options, donotVerifySignature: true });
            installAction.extension = this.extension;
            return installAction.run();
          }
        }],
        cancelButton: true
      });
      return;
    }
    const operationMessage = this.installOperation === InstallOperation.Update ? localize("update operation", "Error while updating '{0}' extension.", this.extension.displayName || this.extension.identifier.id) : localize("install operation", "Error while installing '{0}' extension.", this.extension.displayName || this.extension.identifier.id);
    let additionalMessage;
    const promptChoices = [];
    const downloadUrl = await this.getDownloadUrl();
    if (downloadUrl) {
      additionalMessage = localize("check logs", "Please check the [log]({0}) for more details.", `command:${showWindowLogActionId}`);
      promptChoices.push({
        label: localize("download", "Try Downloading Manually..."),
        run: () => this.openerService.open(downloadUrl).then(() => {
          this.notificationService.prompt(
            Severity.Info,
            localize("install vsix", "Once downloaded, please manually install the downloaded VSIX of '{0}'.", this.extension.identifier.id),
            [{
              label: localize("installVSIX", "Install from VSIX..."),
              run: () => this.commandService.executeCommand(SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID)
            }]
          );
        })
      });
    }
    const message = `${operationMessage}${additionalMessage ? ` ${additionalMessage}` : ""}`;
    this.notificationService.prompt(Severity.Error, message, promptChoices);
  }
  async getDownloadUrl() {
    if (isIOS) {
      return void 0;
    }
    if (!this.extension.gallery) {
      return void 0;
    }
    if (!this.extensionManagementServerService.localExtensionManagementServer && !this.extensionManagementServerService.remoteExtensionManagementServer) {
      return void 0;
    }
    let targetPlatform = this.extension.gallery.properties.targetPlatform;
    if (targetPlatform !== TargetPlatform.UNIVERSAL && targetPlatform !== TargetPlatform.UNDEFINED && this.extensionManagementServerService.remoteExtensionManagementServer) {
      try {
        const manifest = await this.galleryService.getManifest(this.extension.gallery, CancellationToken.None);
        if (manifest && this.extensionManifestPropertiesService.prefersExecuteOnWorkspace(manifest)) {
          targetPlatform = await this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.getTargetPlatform();
        }
      } catch (error) {
        this.logService.error(error);
        return void 0;
      }
    }
    if (targetPlatform === TargetPlatform.UNKNOWN) {
      return void 0;
    }
    const [extension] = await this.galleryService.getExtensions([{
      ...this.extension.identifier,
      version: this.version
    }], {
      targetPlatform
    }, CancellationToken.None);
    if (!extension) {
      return void 0;
    }
    return URI.parse(extension.assets.download.uri);
  }
};
PromptExtensionInstallFailureAction = __decorateClass([
  __decorateParam(5, IProductService),
  __decorateParam(6, IOpenerService),
  __decorateParam(7, INotificationService),
  __decorateParam(8, IDialogService),
  __decorateParam(9, ICommandService),
  __decorateParam(10, ILogService),
  __decorateParam(11, IExtensionManagementServerService),
  __decorateParam(12, IInstantiationService),
  __decorateParam(13, IExtensionGalleryService),
  __decorateParam(14, IExtensionManifestPropertiesService)
], PromptExtensionInstallFailureAction);
const _ExtensionAction = class _ExtensionAction extends Action {
  constructor() {
    super(...arguments);
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._extension = null;
    this._hidden = false;
    this.hideOnDisabled = true;
  }
  get extension() {
    return this._extension;
  }
  set extension(extension) {
    this._extension = extension;
    this.update();
  }
  get hidden() {
    return this._hidden;
  }
  set hidden(hidden) {
    if (this._hidden !== hidden) {
      this._hidden = hidden;
      this._onDidChange.fire({ hidden });
    }
  }
  _setEnabled(value) {
    super._setEnabled(value);
    if (this.hideOnDisabled) {
      this.hidden = !value;
    }
  }
};
_ExtensionAction.EXTENSION_ACTION_CLASS = "extension-action";
_ExtensionAction.TEXT_ACTION_CLASS = `${_ExtensionAction.EXTENSION_ACTION_CLASS} text`;
_ExtensionAction.LABEL_ACTION_CLASS = `${_ExtensionAction.EXTENSION_ACTION_CLASS} label`;
_ExtensionAction.PROMINENT_LABEL_ACTION_CLASS = `${_ExtensionAction.LABEL_ACTION_CLASS} prominent`;
_ExtensionAction.ICON_ACTION_CLASS = `${_ExtensionAction.EXTENSION_ACTION_CLASS} icon`;
let ExtensionAction = _ExtensionAction;
class ButtonWithDropDownExtensionAction extends ExtensionAction {
  constructor(id, clazz, actionsGroups) {
    clazz = `${clazz} action-dropdown`;
    super(id, void 0, clazz);
    this.actionsGroups = actionsGroups;
    this.menuActionClassNames = [];
    this._menuActions = [];
    this.menuActionClassNames = clazz.split(" ");
    this.hideOnDisabled = false;
    this.extensionActions = actionsGroups.flat();
    this.update();
    this._register(Event.any(...this.extensionActions.map((a) => a.onDidChange))(() => this.update(true)));
    this.extensionActions.forEach((a) => this._register(a));
  }
  get menuActions() {
    return [...this._menuActions];
  }
  get extension() {
    return super.extension;
  }
  set extension(extension) {
    this.extensionActions.forEach((a) => a.extension = extension);
    super.extension = extension;
  }
  update(donotUpdateActions) {
    if (!donotUpdateActions) {
      this.extensionActions.forEach((a) => a.update());
    }
    const actionsGroups = this.actionsGroups.map((actionsGroup) => actionsGroup.filter((a) => !a.hidden));
    let actions = [];
    for (const visibleActions of actionsGroups) {
      if (visibleActions.length) {
        actions = [...actions, ...visibleActions, new Separator()];
      }
    }
    actions = actions.length ? actions.slice(0, actions.length - 1) : actions;
    this.primaryAction = actions[0];
    this._menuActions = actions.length > 1 ? actions : [];
    this._onDidChange.fire({ menuActions: this._menuActions });
    if (this.primaryAction) {
      this.hidden = false;
      this.enabled = this.primaryAction.enabled;
      this.label = this.getLabel(this.primaryAction);
      this.tooltip = this.primaryAction.tooltip;
    } else {
      this.hidden = true;
      this.enabled = false;
    }
  }
  async run() {
    if (this.enabled) {
      await this.primaryAction?.run();
    }
  }
  getLabel(action) {
    return action.label;
  }
}
class ButtonWithDropdownExtensionActionViewItem extends ActionWithDropdownActionViewItem {
  constructor(action, options, contextMenuProvider) {
    super(null, action, options, contextMenuProvider);
    this._register(action.onDidChange((e) => {
      if (e.hidden !== void 0 || e.menuActions !== void 0) {
        this.updateClass();
      }
    }));
  }
  render(container) {
    super.render(container);
    this.updateClass();
  }
  updateClass() {
    super.updateClass();
    if (this.element && this.dropdownMenuActionViewItem?.element) {
      this.element.classList.toggle("hide", this._action.hidden);
      const isMenuEmpty = this._action.menuActions.length === 0;
      this.element.classList.toggle("empty", isMenuEmpty);
      this.dropdownMenuActionViewItem.element.classList.toggle("hide", isMenuEmpty);
    }
  }
}
let InstallAction = class extends ExtensionAction {
  constructor(options, extensionsWorkbenchService, instantiationService, runtimeExtensionService, workbenchThemeService, labelService, dialogService, preferencesService, telemetryService, contextService, allowedExtensionsService, extensionGalleryManifestService) {
    super("extensions.install", localize("install", "Install"), InstallAction.CLASS, false);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.instantiationService = instantiationService;
    this.runtimeExtensionService = runtimeExtensionService;
    this.workbenchThemeService = workbenchThemeService;
    this.labelService = labelService;
    this.dialogService = dialogService;
    this.preferencesService = preferencesService;
    this.telemetryService = telemetryService;
    this.contextService = contextService;
    this.allowedExtensionsService = allowedExtensionsService;
    this.extensionGalleryManifestService = extensionGalleryManifestService;
    this._manifest = null;
    this.updateThrottler = new Throttler();
    this.hideOnDisabled = false;
    this.options = { isMachineScoped: false, ...options };
    this.update();
    this._register(allowedExtensionsService.onDidChangeAllowedExtensionsConfigValue(() => this.update()));
    this._register(this.labelService.onDidChangeFormatters(() => this.updateLabel(), this));
  }
  set manifest(manifest) {
    this._manifest = manifest;
    this.updateLabel();
  }
  update() {
    this.updateThrottler.queue(() => this.computeAndUpdateEnablement());
  }
  async computeAndUpdateEnablement() {
    this.enabled = false;
    this.class = InstallAction.HIDE;
    this.hidden = true;
    if (!this.extension) {
      return;
    }
    if (this.extension.isBuiltin) {
      return;
    }
    if (this.extensionsWorkbenchService.canSetLanguage(this.extension)) {
      return;
    }
    if (this.extension.state !== ExtensionState.Uninstalled) {
      return;
    }
    if (this.options.installPreReleaseVersion && (!this.extension.hasPreReleaseVersion || this.allowedExtensionsService.isAllowed({ id: this.extension.identifier.id, publisherDisplayName: this.extension.publisherDisplayName, prerelease: true }) !== true)) {
      return;
    }
    if (!this.options.installPreReleaseVersion && !this.extension.hasReleaseVersion) {
      return;
    }
    this.hidden = false;
    this.class = InstallAction.CLASS;
    if (await this.extensionsWorkbenchService.canInstall(this.extension) === true) {
      this.enabled = true;
      this.updateLabel();
    }
  }
  async run() {
    if (!this.extension) {
      return;
    }
    if (this.extension.gallery && !this.extension.gallery.isSigned && (await this.extensionGalleryManifestService.getExtensionGalleryManifest())?.capabilities.signing?.allRepositorySigned) {
      const { result } = await this.dialogService.prompt({
        type: Severity.Warning,
        message: localize("not signed", "'{0}' is an extension from an unknown source. Are you sure you want to install?", this.extension.displayName),
        detail: localize("not signed detail", "Extension is not signed."),
        buttons: [
          {
            label: localize("install anyway", "Install Anyway"),
            run: () => {
              this.options.donotVerifySignature = true;
              return true;
            }
          }
        ],
        cancelButton: {
          run: () => false
        }
      });
      if (!result) {
        return;
      }
    }
    if (this.extension.deprecationInfo) {
      let detail = localize("deprecated message", "This extension is deprecated as it is no longer being maintained.");
      let DeprecationChoice;
      ((DeprecationChoice2) => {
        DeprecationChoice2[DeprecationChoice2["InstallAnyway"] = 0] = "InstallAnyway";
        DeprecationChoice2[DeprecationChoice2["ShowAlternateExtension"] = 1] = "ShowAlternateExtension";
        DeprecationChoice2[DeprecationChoice2["ConfigureSettings"] = 2] = "ConfigureSettings";
        DeprecationChoice2[DeprecationChoice2["Cancel"] = 3] = "Cancel";
      })(DeprecationChoice || (DeprecationChoice = {}));
      const buttons = [
        {
          label: localize("install anyway", "Install Anyway"),
          run: () => 0 /* InstallAnyway */
        }
      ];
      if (this.extension.deprecationInfo.extension) {
        detail = localize("deprecated with alternate extension message", "This extension is deprecated. Use the {0} extension instead.", this.extension.deprecationInfo.extension.displayName);
        const alternateExtension = this.extension.deprecationInfo.extension;
        buttons.push({
          label: localize({ key: "Show alternate extension", comment: ["&& denotes a mnemonic"] }, "&&Open {0}", this.extension.deprecationInfo.extension.displayName),
          run: async () => {
            const [extension2] = await this.extensionsWorkbenchService.getExtensions([{ id: alternateExtension.id, preRelease: alternateExtension.preRelease }], CancellationToken.None);
            await this.extensionsWorkbenchService.open(extension2);
            return 1 /* ShowAlternateExtension */;
          }
        });
      } else if (this.extension.deprecationInfo.settings) {
        detail = localize("deprecated with alternate settings message", "This extension is deprecated as this functionality is now built-in to VS Code.");
        const settings = this.extension.deprecationInfo.settings;
        buttons.push({
          label: localize({ key: "configure in settings", comment: ["&& denotes a mnemonic"] }, "&&Configure Settings"),
          run: async () => {
            await this.preferencesService.openSettings({ query: settings.map((setting) => `@id:${setting}`).join(" ") });
            return 2 /* ConfigureSettings */;
          }
        });
      } else if (this.extension.deprecationInfo.additionalInfo) {
        detail = new MarkdownString(`${detail} ${this.extension.deprecationInfo.additionalInfo}`);
      }
      const { result } = await this.dialogService.prompt({
        type: Severity.Warning,
        message: localize("install confirmation", "Are you sure you want to install '{0}'?", this.extension.displayName),
        detail: isString(detail) ? detail : void 0,
        custom: isString(detail) ? void 0 : {
          markdownDetails: [{
            markdown: detail
          }]
        },
        buttons,
        cancelButton: {
          run: () => 3 /* Cancel */
        }
      });
      if (result !== 0 /* InstallAnyway */) {
        return;
      }
    }
    this.extensionsWorkbenchService.open(this.extension, { showPreReleaseVersion: this.options.installPreReleaseVersion });
    alert(localize("installExtensionStart", "Installing extension {0} started. An editor is now open with more details on this extension", this.extension.displayName));
    this.telemetryService.publicLog("extensions:action:install", { ...this.extension.telemetryData, actionId: this.id });
    const extension = await this.install(this.extension);
    if (extension?.local) {
      alert(localize("installExtensionComplete", "Installing extension {0} is completed.", this.extension.displayName));
      const runningExtension = await this.getRunningExtension(extension.local);
      if (runningExtension && !(runningExtension.activationEvents && runningExtension.activationEvents.some((activationEent) => activationEent.startsWith("onLanguage")))) {
        const action = await this.getThemeAction(extension);
        if (action) {
          action.extension = extension;
          try {
            return action.run({ showCurrentTheme: true, ignoreFocusLost: true });
          } finally {
            action.dispose();
          }
        }
      }
    }
  }
  async getThemeAction(extension) {
    const colorThemes = await this.workbenchThemeService.getColorThemes();
    if (colorThemes.some((theme) => isThemeFromExtension(theme, extension))) {
      return this.instantiationService.createInstance(SetColorThemeAction);
    }
    const fileIconThemes = await this.workbenchThemeService.getFileIconThemes();
    if (fileIconThemes.some((theme) => isThemeFromExtension(theme, extension))) {
      return this.instantiationService.createInstance(SetFileIconThemeAction);
    }
    const productIconThemes = await this.workbenchThemeService.getProductIconThemes();
    if (productIconThemes.some((theme) => isThemeFromExtension(theme, extension))) {
      return this.instantiationService.createInstance(SetProductIconThemeAction);
    }
    return void 0;
  }
  async install(extension) {
    try {
      return await this.extensionsWorkbenchService.install(extension, this.options);
    } catch (error) {
      await this.instantiationService.createInstance(PromptExtensionInstallFailureAction, extension, this.options, extension.latestVersion, InstallOperation.Install, error).run();
      return void 0;
    }
  }
  async getRunningExtension(extension) {
    const runningExtension = await this.runtimeExtensionService.getExtension(extension.identifier.id);
    if (runningExtension) {
      return runningExtension;
    }
    if (this.runtimeExtensionService.canAddExtension(toExtensionDescription(extension))) {
      return new Promise((c, e) => {
        const disposable = this.runtimeExtensionService.onDidChangeExtensions(async () => {
          const runningExtension2 = await this.runtimeExtensionService.getExtension(extension.identifier.id);
          if (runningExtension2) {
            disposable.dispose();
            c(runningExtension2);
          }
        });
      });
    }
    return null;
  }
  updateLabel() {
    this.label = this.getLabel();
  }
  getLabel(primary) {
    if (this.extension?.isWorkspaceScoped && this.extension.resourceExtension && this.contextService.isInsideWorkspace(this.extension.resourceExtension.location)) {
      return localize("install workspace version", "Install Workspace Extension");
    }
    if (this.options.installPreReleaseVersion && this.extension?.hasPreReleaseVersion) {
      return primary ? localize("install pre-release", "Install Pre-Release") : localize("install pre-release version", "Install Pre-Release Version");
    }
    if (this.extension?.hasPreReleaseVersion) {
      return primary ? localize("install", "Install") : localize("install release version", "Install Release Version");
    }
    return localize("install", "Install");
  }
};
InstallAction.CLASS = `${InstallAction.LABEL_ACTION_CLASS} prominent install`;
InstallAction.HIDE = `${InstallAction.CLASS} hide`;
InstallAction = __decorateClass([
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IInstantiationService),
  __decorateParam(3, IExtensionService),
  __decorateParam(4, IWorkbenchThemeService),
  __decorateParam(5, ILabelService),
  __decorateParam(6, IDialogService),
  __decorateParam(7, IPreferencesService),
  __decorateParam(8, ITelemetryService),
  __decorateParam(9, IWorkspaceContextService),
  __decorateParam(10, IAllowedExtensionsService),
  __decorateParam(11, IExtensionGalleryManifestService)
], InstallAction);
let InstallDropdownAction = class extends ButtonWithDropDownExtensionAction {
  set manifest(manifest) {
    this.extensionActions.forEach((a) => a.manifest = manifest);
    this.update();
  }
  constructor(instantiationService, extensionsWorkbenchService) {
    super(`extensions.installActions`, InstallAction.CLASS, [
      [
        instantiationService.createInstance(InstallAction, { installPreReleaseVersion: extensionsWorkbenchService.preferPreReleases }),
        instantiationService.createInstance(InstallAction, { installPreReleaseVersion: !extensionsWorkbenchService.preferPreReleases })
      ]
    ]);
  }
  getLabel(action) {
    return action.getLabel(true);
  }
};
InstallDropdownAction = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IExtensionsWorkbenchService)
], InstallDropdownAction);
const _InstallingLabelAction = class _InstallingLabelAction extends ExtensionAction {
  constructor() {
    super("extension.installing", _InstallingLabelAction.LABEL, _InstallingLabelAction.CLASS, false);
  }
  update() {
    this.class = `${_InstallingLabelAction.CLASS}${this.extension && this.extension.state === ExtensionState.Installing ? "" : " hide"}`;
  }
};
_InstallingLabelAction.LABEL = localize("installing", "Installing");
_InstallingLabelAction.CLASS = `${ExtensionAction.LABEL_ACTION_CLASS} install installing`;
let InstallingLabelAction = _InstallingLabelAction;
let InstallInOtherServerAction = class extends ExtensionAction {
  constructor(id, server, canInstallAnyWhere, extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService) {
    super(id, InstallInOtherServerAction.INSTALL_LABEL, InstallInOtherServerAction.Class, false);
    this.server = server;
    this.canInstallAnyWhere = canInstallAnyWhere;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionManagementServerService = extensionManagementServerService;
    this.extensionManifestPropertiesService = extensionManifestPropertiesService;
    this.updateWhenCounterExtensionChanges = true;
    this.update();
  }
  update() {
    this.enabled = false;
    this.class = InstallInOtherServerAction.Class;
    if (this.canInstall()) {
      const extensionInOtherServer = this.extensionsWorkbenchService.installed.filter((e) => areSameExtensions(e.identifier, this.extension.identifier) && e.server === this.server)[0];
      if (extensionInOtherServer) {
        if (extensionInOtherServer.state === ExtensionState.Installing && !extensionInOtherServer.local) {
          this.enabled = true;
          this.label = InstallInOtherServerAction.INSTALLING_LABEL;
          this.class = InstallInOtherServerAction.InstallingClass;
        }
      } else {
        this.enabled = true;
        this.label = this.getInstallLabel();
      }
    }
  }
  canInstall() {
    if (!this.extension || !this.server || !this.extension.local || this.extension.state !== ExtensionState.Installed || this.extension.type !== ExtensionType.User || this.extension.enablementState === EnablementState.DisabledByEnvironment || this.extension.enablementState === EnablementState.DisabledByTrustRequirement || this.extension.enablementState === EnablementState.DisabledByVirtualWorkspace) {
      return false;
    }
    if (isLanguagePackExtension(this.extension.local.manifest)) {
      return true;
    }
    if (this.server === this.extensionManagementServerService.localExtensionManagementServer && this.extensionManifestPropertiesService.prefersExecuteOnUI(this.extension.local.manifest)) {
      return true;
    }
    if (this.server === this.extensionManagementServerService.remoteExtensionManagementServer && this.extensionManifestPropertiesService.prefersExecuteOnWorkspace(this.extension.local.manifest)) {
      return true;
    }
    if (this.server === this.extensionManagementServerService.webExtensionManagementServer && this.extensionManifestPropertiesService.prefersExecuteOnWeb(this.extension.local.manifest)) {
      return true;
    }
    if (this.canInstallAnyWhere) {
      if (this.server === this.extensionManagementServerService.localExtensionManagementServer && this.extensionManifestPropertiesService.canExecuteOnUI(this.extension.local.manifest)) {
        return true;
      }
      if (this.server === this.extensionManagementServerService.remoteExtensionManagementServer && this.extensionManifestPropertiesService.canExecuteOnWorkspace(this.extension.local.manifest)) {
        return true;
      }
    }
    return false;
  }
  async run() {
    if (!this.extension?.local) {
      return;
    }
    if (!this.extension?.server) {
      return;
    }
    if (!this.server) {
      return;
    }
    this.extensionsWorkbenchService.open(this.extension);
    alert(localize("installExtensionStart", "Installing extension {0} started. An editor is now open with more details on this extension", this.extension.displayName));
    return this.extensionsWorkbenchService.installInServer(this.extension, this.server);
  }
};
InstallInOtherServerAction.INSTALL_LABEL = localize("install", "Install");
InstallInOtherServerAction.INSTALLING_LABEL = localize("installing", "Installing");
InstallInOtherServerAction.Class = `${ExtensionAction.LABEL_ACTION_CLASS} prominent install-other-server`;
InstallInOtherServerAction.InstallingClass = `${ExtensionAction.LABEL_ACTION_CLASS} install-other-server installing`;
InstallInOtherServerAction = __decorateClass([
  __decorateParam(3, IExtensionsWorkbenchService),
  __decorateParam(4, IExtensionManagementServerService),
  __decorateParam(5, IExtensionManifestPropertiesService)
], InstallInOtherServerAction);
let RemoteInstallAction = class extends InstallInOtherServerAction {
  constructor(canInstallAnyWhere, extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService) {
    super(`extensions.remoteinstall`, extensionManagementServerService.remoteExtensionManagementServer, canInstallAnyWhere, extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService);
  }
  getInstallLabel() {
    return this.extensionManagementServerService.remoteExtensionManagementServer ? localize({ key: "install in remote", comment: ["This is the name of the action to install an extension in remote server. Placeholder is for the name of remote server."] }, "Install in {0}", this.extensionManagementServerService.remoteExtensionManagementServer.label) : InstallInOtherServerAction.INSTALL_LABEL;
  }
};
RemoteInstallAction = __decorateClass([
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IExtensionManagementServerService),
  __decorateParam(3, IExtensionManifestPropertiesService)
], RemoteInstallAction);
let LocalInstallAction = class extends InstallInOtherServerAction {
  constructor(extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService) {
    super(`extensions.localinstall`, extensionManagementServerService.localExtensionManagementServer, false, extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService);
  }
  getInstallLabel() {
    return localize("install locally", "Install Locally");
  }
};
LocalInstallAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IExtensionManagementServerService),
  __decorateParam(2, IExtensionManifestPropertiesService)
], LocalInstallAction);
let WebInstallAction = class extends InstallInOtherServerAction {
  constructor(extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService) {
    super(`extensions.webInstall`, extensionManagementServerService.webExtensionManagementServer, false, extensionsWorkbenchService, extensionManagementServerService, extensionManifestPropertiesService);
  }
  getInstallLabel() {
    return localize("install browser", "Install in Browser");
  }
};
WebInstallAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IExtensionManagementServerService),
  __decorateParam(2, IExtensionManifestPropertiesService)
], WebInstallAction);
let UninstallAction = class extends ExtensionAction {
  constructor(extensionsWorkbenchService, dialogService) {
    super("extensions.uninstall", UninstallAction.UninstallLabel, UninstallAction.UninstallClass, false);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.dialogService = dialogService;
    this.update();
  }
  update() {
    if (!this.extension) {
      this.enabled = false;
      return;
    }
    const state = this.extension.state;
    if (state === ExtensionState.Uninstalling) {
      this.label = UninstallAction.UninstallingLabel;
      this.class = UninstallAction.UnInstallingClass;
      this.enabled = false;
      return;
    }
    this.label = UninstallAction.UninstallLabel;
    this.class = UninstallAction.UninstallClass;
    this.tooltip = UninstallAction.UninstallLabel;
    if (state !== ExtensionState.Installed) {
      this.enabled = false;
      return;
    }
    if (this.extension.isBuiltin) {
      this.enabled = false;
      return;
    }
    this.enabled = true;
  }
  async run() {
    if (!this.extension) {
      return;
    }
    alert(localize("uninstallExtensionStart", "Uninstalling extension {0} started.", this.extension.displayName));
    try {
      await this.extensionsWorkbenchService.uninstall(this.extension);
      alert(localize("uninstallExtensionComplete", "Please reload Visual Studio Code to complete the uninstallation of the extension {0}.", this.extension.displayName));
    } catch (error) {
      if (!isCancellationError(error)) {
        this.dialogService.error(getErrorMessage(error));
      }
    }
  }
};
UninstallAction.UninstallLabel = localize("uninstallAction", "Uninstall");
UninstallAction.UninstallingLabel = localize("Uninstalling", "Uninstalling");
UninstallAction.UninstallClass = `${ExtensionAction.LABEL_ACTION_CLASS} uninstall`;
UninstallAction.UnInstallingClass = `${ExtensionAction.LABEL_ACTION_CLASS} uninstall uninstalling`;
UninstallAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IDialogService)
], UninstallAction);
let UpdateAction = class extends ExtensionAction {
  constructor(verbose, extensionsWorkbenchService, dialogService, openerService, instantiationService) {
    super(`extensions.update`, localize("update", "Update"), UpdateAction.DisabledClass, false);
    this.verbose = verbose;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.dialogService = dialogService;
    this.openerService = openerService;
    this.instantiationService = instantiationService;
    this.updateThrottler = new Throttler();
    this.update();
  }
  update() {
    this.updateThrottler.queue(() => this.computeAndUpdateEnablement());
    if (this.extension) {
      this.label = this.verbose ? localize("update to", "Update to v{0}", this.extension.latestVersion) : localize("update", "Update");
    }
  }
  async computeAndUpdateEnablement() {
    this.enabled = false;
    this.class = UpdateAction.DisabledClass;
    if (!this.extension) {
      return;
    }
    if (this.extension.deprecationInfo) {
      return;
    }
    const canInstall = await this.extensionsWorkbenchService.canInstall(this.extension);
    const isInstalled = this.extension.state === ExtensionState.Installed;
    this.enabled = canInstall === true && isInstalled && this.extension.outdated;
    this.class = this.enabled ? UpdateAction.EnabledClass : UpdateAction.DisabledClass;
  }
  async run() {
    if (!this.extension) {
      return;
    }
    const consent = await this.extensionsWorkbenchService.shouldRequireConsentToUpdate(this.extension);
    if (consent) {
      const { result } = await this.dialogService.prompt({
        type: "warning",
        title: localize("updateExtensionConsentTitle", "Update {0} Extension", this.extension.displayName),
        message: localize("updateExtensionConsent", "{0}\n\nWould you like to update the extension?", consent),
        buttons: [{
          label: localize("update", "Update"),
          run: () => "update"
        }, {
          label: localize("review", "Review"),
          run: () => "review"
        }, {
          label: localize("cancel", "Cancel"),
          run: () => "cancel"
        }]
      });
      if (result === "cancel") {
        return;
      }
      if (result === "review") {
        if (this.extension.hasChangelog()) {
          return this.extensionsWorkbenchService.open(this.extension, { tab: ExtensionEditorTab.Changelog });
        }
        if (this.extension.repository) {
          return this.openerService.open(this.extension.repository);
        }
        return this.extensionsWorkbenchService.open(this.extension);
      }
    }
    alert(localize("updateExtensionStart", "Updating extension {0} to version {1} started.", this.extension.displayName, this.extension.latestVersion));
    return this.install(this.extension);
  }
  async install(extension) {
    const options = extension.local?.preRelease ? { installPreReleaseVersion: true } : void 0;
    try {
      await this.extensionsWorkbenchService.install(extension, options);
      alert(localize("updateExtensionComplete", "Updating extension {0} to version {1} completed.", extension.displayName, extension.latestVersion));
    } catch (err) {
      this.instantiationService.createInstance(PromptExtensionInstallFailureAction, extension, options, extension.latestVersion, InstallOperation.Update, err).run();
    }
  }
};
UpdateAction.EnabledClass = `${UpdateAction.LABEL_ACTION_CLASS} prominent update`;
UpdateAction.DisabledClass = `${UpdateAction.EnabledClass} disabled`;
UpdateAction = __decorateClass([
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IDialogService),
  __decorateParam(3, IOpenerService),
  __decorateParam(4, IInstantiationService)
], UpdateAction);
let ToggleAutoUpdateForExtensionAction = class extends ExtensionAction {
  constructor(extensionsWorkbenchService, extensionEnablementService, allowedExtensionsService, configurationService) {
    super(ToggleAutoUpdateForExtensionAction.ID, ToggleAutoUpdateForExtensionAction.LABEL.value, ToggleAutoUpdateForExtensionAction.DisabledClass);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionEnablementService = extensionEnablementService;
    this.allowedExtensionsService = allowedExtensionsService;
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(AutoUpdateConfigurationKey)) {
        this.update();
      }
    }));
    this._register(allowedExtensionsService.onDidChangeAllowedExtensionsConfigValue((e) => this.update()));
    this.update();
  }
  update() {
    this.enabled = false;
    this.class = ToggleAutoUpdateForExtensionAction.DisabledClass;
    if (!this.extension) {
      return;
    }
    if (this.extension.isBuiltin) {
      return;
    }
    if (this.extension.deprecationInfo?.disallowInstall) {
      return;
    }
    const extension = this.extension.local ?? this.extension.gallery;
    if (extension && this.allowedExtensionsService.isAllowed(extension) !== true) {
      return;
    }
    if (this.extensionsWorkbenchService.getAutoUpdateValue() === "onlyEnabledExtensions" && !this.extensionEnablementService.isEnabledEnablementState(this.extension.enablementState)) {
      return;
    }
    this.enabled = true;
    this.class = ToggleAutoUpdateForExtensionAction.EnabledClass;
    this.checked = this.extensionsWorkbenchService.isAutoUpdateEnabledFor(this.extension);
  }
  async run() {
    if (!this.extension) {
      return;
    }
    const enableAutoUpdate = !this.extensionsWorkbenchService.isAutoUpdateEnabledFor(this.extension);
    await this.extensionsWorkbenchService.updateAutoUpdateEnablementFor(this.extension, enableAutoUpdate);
    if (enableAutoUpdate) {
      alert(localize("enableAutoUpdate", "Enabled auto updates for", this.extension.displayName));
    } else {
      alert(localize("disableAutoUpdate", "Disabled auto updates for", this.extension.displayName));
    }
  }
};
ToggleAutoUpdateForExtensionAction.ID = "workbench.extensions.action.toggleAutoUpdateForExtension";
ToggleAutoUpdateForExtensionAction.LABEL = localize2("enableAutoUpdateLabel", "Auto Update");
ToggleAutoUpdateForExtensionAction.EnabledClass = `${ExtensionAction.EXTENSION_ACTION_CLASS} auto-update`;
ToggleAutoUpdateForExtensionAction.DisabledClass = `${ToggleAutoUpdateForExtensionAction.EnabledClass} hide`;
ToggleAutoUpdateForExtensionAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IWorkbenchExtensionEnablementService),
  __decorateParam(2, IAllowedExtensionsService),
  __decorateParam(3, IConfigurationService)
], ToggleAutoUpdateForExtensionAction);
let ToggleAutoUpdatesForPublisherAction = class extends ExtensionAction {
  constructor(extensionsWorkbenchService) {
    super(ToggleAutoUpdatesForPublisherAction.ID, ToggleAutoUpdatesForPublisherAction.LABEL);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
  }
  update() {
  }
  async run() {
    if (!this.extension) {
      return;
    }
    alert(localize("ignoreExtensionUpdatePublisher", "Ignoring updates published by {0}.", this.extension.publisherDisplayName));
    const enableAutoUpdate = !this.extensionsWorkbenchService.isAutoUpdateEnabledFor(this.extension.publisher);
    await this.extensionsWorkbenchService.updateAutoUpdateEnablementFor(this.extension.publisher, enableAutoUpdate);
    if (enableAutoUpdate) {
      alert(localize("enableAutoUpdate", "Enabled auto updates for", this.extension.displayName));
    } else {
      alert(localize("disableAutoUpdate", "Disabled auto updates for", this.extension.displayName));
    }
  }
};
ToggleAutoUpdatesForPublisherAction.ID = "workbench.extensions.action.toggleAutoUpdatesForPublisher";
ToggleAutoUpdatesForPublisherAction.LABEL = localize("toggleAutoUpdatesForPublisherLabel", "Auto Update All (From Publisher)");
ToggleAutoUpdatesForPublisherAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService)
], ToggleAutoUpdatesForPublisherAction);
let MigrateDeprecatedExtensionAction = class extends ExtensionAction {
  constructor(small, extensionsWorkbenchService) {
    super("extensionsAction.migrateDeprecatedExtension", localize("migrateExtension", "Migrate"), MigrateDeprecatedExtensionAction.DisabledClass, false);
    this.small = small;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.update();
  }
  update() {
    this.enabled = false;
    this.class = MigrateDeprecatedExtensionAction.DisabledClass;
    if (!this.extension?.local) {
      return;
    }
    if (this.extension.state !== ExtensionState.Installed) {
      return;
    }
    if (!this.extension.deprecationInfo?.extension) {
      return;
    }
    const id = this.extension.deprecationInfo.extension.id;
    if (this.extensionsWorkbenchService.local.some((e) => areSameExtensions(e.identifier, { id }))) {
      return;
    }
    this.enabled = true;
    this.class = MigrateDeprecatedExtensionAction.EnabledClass;
    this.tooltip = localize("migrate to", "Migrate to {0}", this.extension.deprecationInfo.extension.displayName);
    this.label = this.small ? localize("migrate", "Migrate") : this.tooltip;
  }
  async run() {
    if (!this.extension?.deprecationInfo?.extension) {
      return;
    }
    const local = this.extension.local;
    await this.extensionsWorkbenchService.uninstall(this.extension);
    const [extension] = await this.extensionsWorkbenchService.getExtensions([{ id: this.extension.deprecationInfo.extension.id, preRelease: this.extension.deprecationInfo?.extension?.preRelease }], CancellationToken.None);
    await this.extensionsWorkbenchService.install(extension, { isMachineScoped: local?.isMachineScoped });
  }
};
MigrateDeprecatedExtensionAction.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} migrate`;
MigrateDeprecatedExtensionAction.DisabledClass = `${MigrateDeprecatedExtensionAction.EnabledClass} disabled`;
MigrateDeprecatedExtensionAction = __decorateClass([
  __decorateParam(1, IExtensionsWorkbenchService)
], MigrateDeprecatedExtensionAction);
let DropDownExtensionAction = class extends ExtensionAction {
  constructor(id, label, cssClass, enabled, instantiationService) {
    super(id, label, cssClass, enabled);
    this.instantiationService = instantiationService;
    this._actionViewItem = null;
  }
  createActionViewItem(options) {
    this._actionViewItem = this.instantiationService.createInstance(DropDownExtensionActionViewItem, this, options);
    return this._actionViewItem;
  }
  run(actionGroups) {
    this._actionViewItem?.showMenu(actionGroups);
    return Promise.resolve();
  }
};
DropDownExtensionAction = __decorateClass([
  __decorateParam(4, IInstantiationService)
], DropDownExtensionAction);
let DropDownExtensionActionViewItem = class extends ActionViewItem {
  constructor(action, options, contextMenuService) {
    super(null, action, { ...options, icon: true, label: true });
    this.contextMenuService = contextMenuService;
  }
  showMenu(menuActionGroups) {
    if (this.element) {
      const actions = this.getActions(menuActionGroups);
      const elementPosition = DOM.getDomNodePagePosition(this.element);
      const anchor = { x: elementPosition.left, y: elementPosition.top + elementPosition.height + 10 };
      this.contextMenuService.showContextMenu({
        getAnchor: () => anchor,
        getActions: () => actions,
        actionRunner: this.actionRunner,
        onHide: () => disposeIfDisposable(actions)
      });
    }
  }
  getActions(menuActionGroups) {
    let actions = [];
    for (const menuActions of menuActionGroups) {
      actions = [...actions, ...menuActions, new Separator()];
    }
    return actions.length ? actions.slice(0, actions.length - 1) : actions;
  }
};
DropDownExtensionActionViewItem = __decorateClass([
  __decorateParam(2, IContextMenuService)
], DropDownExtensionActionViewItem);
async function getContextMenuActionsGroups(extension, contextKeyService, instantiationService) {
  return instantiationService.invokeFunction(async (accessor) => {
    const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
    const extensionEnablementService = accessor.get(IWorkbenchExtensionEnablementService);
    const menuService = accessor.get(IMenuService);
    const extensionRecommendationsService = accessor.get(IExtensionRecommendationsService);
    const extensionIgnoredRecommendationsService = accessor.get(IExtensionIgnoredRecommendationsService);
    const workbenchThemeService = accessor.get(IWorkbenchThemeService);
    const authenticationUsageService = accessor.get(IAuthenticationUsageService);
    const allowedExtensionsService = accessor.get(IAllowedExtensionsService);
    const cksOverlay = [];
    if (extension) {
      cksOverlay.push(["extension", extension.identifier.id]);
      cksOverlay.push(["isBuiltinExtension", extension.isBuiltin]);
      cksOverlay.push(["isDefaultApplicationScopedExtension", extension.local && isApplicationScopedExtension(extension.local.manifest)]);
      cksOverlay.push(["isApplicationScopedExtension", extension.local && extension.local.isApplicationScoped]);
      cksOverlay.push(["isWorkspaceScopedExtension", extension.isWorkspaceScoped]);
      cksOverlay.push(["isGalleryExtension", !!extension.identifier.uuid]);
      if (extension.local) {
        cksOverlay.push(["extensionSource", extension.local.source]);
      }
      cksOverlay.push(["extensionHasConfiguration", extension.local && !!extension.local.manifest.contributes && !!extension.local.manifest.contributes.configuration]);
      cksOverlay.push(["extensionHasKeybindings", extension.local && !!extension.local.manifest.contributes && !!extension.local.manifest.contributes.keybindings]);
      cksOverlay.push(["extensionHasCommands", extension.local && !!extension.local.manifest.contributes && !!extension.local.manifest.contributes?.commands]);
      cksOverlay.push(["isExtensionRecommended", !!extensionRecommendationsService.getAllRecommendationsWithReason()[extension.identifier.id.toLowerCase()]]);
      cksOverlay.push(["isExtensionWorkspaceRecommended", extensionRecommendationsService.getAllRecommendationsWithReason()[extension.identifier.id.toLowerCase()]?.reasonId === ExtensionRecommendationReason.Workspace]);
      cksOverlay.push(["isUserIgnoredRecommendation", extensionIgnoredRecommendationsService.globalIgnoredRecommendations.some((e) => e === extension.identifier.id.toLowerCase())]);
      cksOverlay.push(["isExtensionPinned", extension.pinned]);
      cksOverlay.push(["isExtensionEnabled", extensionEnablementService.isEnabledEnablementState(extension.enablementState)]);
      switch (extension.state) {
        case ExtensionState.Installing:
          cksOverlay.push(["extensionStatus", "installing"]);
          break;
        case ExtensionState.Installed:
          cksOverlay.push(["extensionStatus", "installed"]);
          break;
        case ExtensionState.Uninstalling:
          cksOverlay.push(["extensionStatus", "uninstalling"]);
          break;
        case ExtensionState.Uninstalled:
          cksOverlay.push(["extensionStatus", "uninstalled"]);
          break;
      }
      cksOverlay.push(["installedExtensionIsPreReleaseVersion", !!extension.local?.isPreReleaseVersion]);
      cksOverlay.push(["installedExtensionIsOptedToPreRelease", !!extension.local?.preRelease]);
      cksOverlay.push(["galleryExtensionIsPreReleaseVersion", !!extension.gallery?.properties.isPreReleaseVersion]);
      cksOverlay.push(["galleryExtensionHasPreReleaseVersion", extension.gallery?.hasPreReleaseVersion]);
      cksOverlay.push(["extensionHasPreReleaseVersion", extension.hasPreReleaseVersion]);
      cksOverlay.push(["extensionHasReleaseVersion", extension.hasReleaseVersion]);
      cksOverlay.push(["extensionDisallowInstall", extension.isMalicious || extension.deprecationInfo?.disallowInstall]);
      cksOverlay.push(["isExtensionAllowed", allowedExtensionsService.isAllowed({ id: extension.identifier.id, publisherDisplayName: extension.publisherDisplayName }) === true]);
      cksOverlay.push(["isPreReleaseExtensionAllowed", allowedExtensionsService.isAllowed({ id: extension.identifier.id, publisherDisplayName: extension.publisherDisplayName, prerelease: true }) === true]);
      cksOverlay.push(["extensionIsUnsigned", extension.gallery && !extension.gallery.isSigned]);
      const [colorThemes, fileIconThemes, productIconThemes, extensionUsesAuth] = await Promise.all([workbenchThemeService.getColorThemes(), workbenchThemeService.getFileIconThemes(), workbenchThemeService.getProductIconThemes(), authenticationUsageService.extensionUsesAuth(extension.identifier.id.toLowerCase())]);
      cksOverlay.push(["extensionHasColorThemes", colorThemes.some((theme) => isThemeFromExtension(theme, extension))]);
      cksOverlay.push(["extensionHasFileIconThemes", fileIconThemes.some((theme) => isThemeFromExtension(theme, extension))]);
      cksOverlay.push(["extensionHasProductIconThemes", productIconThemes.some((theme) => isThemeFromExtension(theme, extension))]);
      cksOverlay.push(["extensionHasAccountPreferences", extensionUsesAuth]);
      cksOverlay.push(["canSetLanguage", extensionsWorkbenchService.canSetLanguage(extension)]);
      cksOverlay.push(["isActiveLanguagePackExtension", extension.gallery && language === getLocale(extension.gallery)]);
    }
    const actionsGroups = menuService.getMenuActions(MenuId.ExtensionContext, contextKeyService.createOverlay(cksOverlay), { shouldForwardArgs: true });
    return actionsGroups;
  });
}
function toActions(actionsGroups, instantiationService) {
  const result = [];
  for (const [, actions] of actionsGroups) {
    result.push(actions.map((action) => {
      if (action instanceof SubmenuAction) {
        return action;
      }
      return instantiationService.createInstance(MenuItemExtensionAction, action);
    }));
  }
  return result;
}
async function getContextMenuActions(extension, contextKeyService, instantiationService) {
  const actionsGroups = await getContextMenuActionsGroups(extension, contextKeyService, instantiationService);
  return toActions(actionsGroups, instantiationService);
}
let ManageExtensionAction = class extends DropDownExtensionAction {
  constructor(instantiationService, extensionService, contextKeyService) {
    super(ManageExtensionAction.ID, "", "", true, instantiationService);
    this.extensionService = extensionService;
    this.contextKeyService = contextKeyService;
    this.tooltip = localize("manage", "Manage");
    this.update();
  }
  async getActionGroups() {
    const groups = [];
    const contextMenuActionsGroups = await getContextMenuActionsGroups(this.extension, this.contextKeyService, this.instantiationService);
    const themeActions = [], installActions = [], updateActions = [], otherActionGroups = [];
    for (const [group, actions] of contextMenuActionsGroups) {
      if (group === INSTALL_ACTIONS_GROUP) {
        installActions.push(...toActions([[group, actions]], this.instantiationService)[0]);
      } else if (group === UPDATE_ACTIONS_GROUP) {
        updateActions.push(...toActions([[group, actions]], this.instantiationService)[0]);
      } else if (group === THEME_ACTIONS_GROUP) {
        themeActions.push(...toActions([[group, actions]], this.instantiationService)[0]);
      } else {
        otherActionGroups.push(...toActions([[group, actions]], this.instantiationService));
      }
    }
    if (themeActions.length) {
      groups.push(themeActions);
    }
    groups.push([
      this.instantiationService.createInstance(EnableGloballyAction),
      this.instantiationService.createInstance(EnableForWorkspaceAction)
    ]);
    groups.push([
      this.instantiationService.createInstance(DisableGloballyAction),
      this.instantiationService.createInstance(DisableForWorkspaceAction)
    ]);
    if (updateActions.length) {
      groups.push(updateActions);
    }
    groups.push([
      ...installActions.length ? installActions : [],
      this.instantiationService.createInstance(InstallAnotherVersionAction, this.extension, false),
      this.instantiationService.createInstance(UninstallAction)
    ]);
    otherActionGroups.forEach((actions) => groups.push(actions));
    groups.forEach((group) => group.forEach((extensionAction) => {
      if (extensionAction instanceof ExtensionAction) {
        extensionAction.extension = this.extension;
      }
    }));
    return groups;
  }
  async run() {
    await this.extensionService.whenInstalledExtensionsRegistered();
    return super.run(await this.getActionGroups());
  }
  update() {
    this.class = ManageExtensionAction.HideManageExtensionClass;
    this.enabled = false;
    if (this.extension) {
      const state = this.extension.state;
      this.enabled = state === ExtensionState.Installed;
      this.class = this.enabled || state === ExtensionState.Uninstalling ? ManageExtensionAction.Class : ManageExtensionAction.HideManageExtensionClass;
    }
  }
};
ManageExtensionAction.ID = "extensions.manage";
ManageExtensionAction.Class = `${ExtensionAction.ICON_ACTION_CLASS} manage ` + ThemeIcon.asClassName(manageExtensionIcon);
ManageExtensionAction.HideManageExtensionClass = `${ManageExtensionAction.Class} hide`;
ManageExtensionAction = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IExtensionService),
  __decorateParam(2, IContextKeyService)
], ManageExtensionAction);
class ExtensionEditorManageExtensionAction extends DropDownExtensionAction {
  constructor(contextKeyService, instantiationService) {
    super("extensionEditor.manageExtension", "", `${ExtensionAction.ICON_ACTION_CLASS} manage ${ThemeIcon.asClassName(manageExtensionIcon)}`, true, instantiationService);
    this.contextKeyService = contextKeyService;
    this.tooltip = localize("manage", "Manage");
  }
  update() {
  }
  async run() {
    const actionGroups = [];
    (await getContextMenuActions(this.extension, this.contextKeyService, this.instantiationService)).forEach((actions) => actionGroups.push(actions));
    actionGroups.forEach((group) => group.forEach((extensionAction) => {
      if (extensionAction instanceof ExtensionAction) {
        extensionAction.extension = this.extension;
      }
    }));
    return super.run(actionGroups);
  }
}
let MenuItemExtensionAction = class extends ExtensionAction {
  constructor(action, extensionsWorkbenchService) {
    super(action.id, action.label);
    this.action = action;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
  }
  get enabled() {
    return this.action.enabled;
  }
  set enabled(value) {
    this.action.enabled = value;
  }
  update() {
    if (!this.extension) {
      return;
    }
    if (this.action.id === TOGGLE_IGNORE_EXTENSION_ACTION_ID) {
      this.checked = !this.extensionsWorkbenchService.isExtensionIgnoredToSync(this.extension);
    } else if (this.action.id === ToggleAutoUpdateForExtensionAction.ID) {
      this.checked = this.extensionsWorkbenchService.isAutoUpdateEnabledFor(this.extension);
    } else if (this.action.id === ToggleAutoUpdatesForPublisherAction.ID) {
      this.checked = this.extensionsWorkbenchService.isAutoUpdateEnabledFor(this.extension.publisher);
    } else {
      this.checked = this.action.checked;
    }
  }
  async run() {
    if (this.extension) {
      const id = this.extension.local ? getExtensionId(this.extension.local.manifest.publisher, this.extension.local.manifest.name) : this.extension.gallery ? getExtensionId(this.extension.gallery.publisher, this.extension.gallery.name) : this.extension.identifier.id;
      const extensionArg = {
        id: this.extension.identifier.id,
        version: this.extension.version,
        location: this.extension.local?.location,
        galleryLink: this.extension.url
      };
      await this.action.run(id, extensionArg);
    }
  }
};
MenuItemExtensionAction = __decorateClass([
  __decorateParam(1, IExtensionsWorkbenchService)
], MenuItemExtensionAction);
let TogglePreReleaseExtensionAction = class extends ExtensionAction {
  constructor(extensionsWorkbenchService, allowedExtensionsService) {
    super(TogglePreReleaseExtensionAction.ID, TogglePreReleaseExtensionAction.LABEL, TogglePreReleaseExtensionAction.DisabledClass);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.allowedExtensionsService = allowedExtensionsService;
    this._register(allowedExtensionsService.onDidChangeAllowedExtensionsConfigValue(() => this.update()));
    this.update();
  }
  update() {
    this.enabled = false;
    this.class = TogglePreReleaseExtensionAction.DisabledClass;
    if (!this.extension) {
      return;
    }
    if (this.extension.isBuiltin) {
      return;
    }
    if (this.extension.state !== ExtensionState.Installed) {
      return;
    }
    if (!this.extension.hasPreReleaseVersion) {
      return;
    }
    if (!this.extension.gallery) {
      return;
    }
    if (this.extension.preRelease) {
      if (!this.extension.isPreReleaseVersion) {
        return;
      }
      if (this.allowedExtensionsService.isAllowed({ id: this.extension.identifier.id, publisherDisplayName: this.extension.publisherDisplayName }) !== true) {
        return;
      }
    }
    if (!this.extension.preRelease) {
      if (!this.extension.gallery.hasPreReleaseVersion) {
        return;
      }
      if (this.allowedExtensionsService.isAllowed(this.extension.gallery) !== true) {
        return;
      }
    }
    this.enabled = true;
    this.class = TogglePreReleaseExtensionAction.EnabledClass;
    if (this.extension.preRelease) {
      this.label = localize("togglePreRleaseDisableLabel", "Switch to Release Version");
      this.tooltip = localize("togglePreRleaseDisableTooltip", "This will switch and enable updates to release versions");
    } else {
      this.label = localize("switchToPreReleaseLabel", "Switch to Pre-Release Version");
      this.tooltip = localize("switchToPreReleaseTooltip", "This will switch to pre-release version and enable updates to latest version always");
    }
  }
  async run() {
    if (!this.extension) {
      return;
    }
    this.extensionsWorkbenchService.open(this.extension, { showPreReleaseVersion: !this.extension.preRelease });
    await this.extensionsWorkbenchService.togglePreRelease(this.extension);
  }
};
TogglePreReleaseExtensionAction.ID = "workbench.extensions.action.togglePreRlease";
TogglePreReleaseExtensionAction.LABEL = localize("togglePreRleaseLabel", "Pre-Release");
TogglePreReleaseExtensionAction.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} pre-release`;
TogglePreReleaseExtensionAction.DisabledClass = `${TogglePreReleaseExtensionAction.EnabledClass} hide`;
TogglePreReleaseExtensionAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IAllowedExtensionsService)
], TogglePreReleaseExtensionAction);
let InstallAnotherVersionAction = class extends ExtensionAction {
  constructor(extension, whenInstalled, extensionsWorkbenchService, extensionManagementService, extensionGalleryService, quickInputService, instantiationService, dialogService, allowedExtensionsService) {
    super(InstallAnotherVersionAction.ID, InstallAnotherVersionAction.LABEL, ExtensionAction.LABEL_ACTION_CLASS);
    this.whenInstalled = whenInstalled;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionManagementService = extensionManagementService;
    this.extensionGalleryService = extensionGalleryService;
    this.quickInputService = quickInputService;
    this.instantiationService = instantiationService;
    this.dialogService = dialogService;
    this.allowedExtensionsService = allowedExtensionsService;
    this._register(allowedExtensionsService.onDidChangeAllowedExtensionsConfigValue(() => this.update()));
    this.extension = extension;
    this.update();
  }
  update() {
    this.enabled = !!this.extension && !this.extension.isBuiltin && !!this.extension.identifier.uuid && !this.extension.deprecationInfo && this.allowedExtensionsService.isAllowed({ id: this.extension.identifier.id, publisherDisplayName: this.extension.publisherDisplayName }) === true;
    if (this.enabled && this.whenInstalled) {
      this.enabled = !!this.extension?.local && !!this.extension.server && this.extension.state === ExtensionState.Installed;
    }
  }
  async run() {
    if (!this.enabled) {
      return;
    }
    if (!this.extension) {
      return;
    }
    const targetPlatform = this.extension.server ? await this.extension.server.extensionManagementService.getTargetPlatform() : await this.extensionManagementService.getTargetPlatform();
    const allVersions = await this.extensionGalleryService.getAllCompatibleVersions(this.extension.identifier, this.extension.local?.preRelease ?? this.extension.gallery?.properties.isPreReleaseVersion ?? false, targetPlatform);
    if (!allVersions.length) {
      await this.dialogService.info(localize("no versions", "This extension has no other versions."));
      return;
    }
    const picks = allVersions.map((v, i) => {
      return {
        id: v.version,
        label: v.version,
        description: `${fromNow(new Date(Date.parse(v.date)), true)}${v.isPreReleaseVersion ? ` (${localize("pre-release", "pre-release")})` : ""}${v.version === this.extension?.local?.manifest.version ? ` (${localize("current", "current")})` : ""}`,
        ariaLabel: `${v.isPreReleaseVersion ? "Pre-Release version" : "Release version"} ${v.version}`,
        isPreReleaseVersion: v.isPreReleaseVersion
      };
    });
    const pick = await this.quickInputService.pick(
      picks,
      {
        placeHolder: localize("selectVersion", "Select Version to Install"),
        matchOnDetail: true
      }
    );
    if (pick) {
      if (this.extension.local?.manifest.version === pick.id) {
        return;
      }
      const options = { installPreReleaseVersion: pick.isPreReleaseVersion, version: pick.id };
      try {
        await this.extensionsWorkbenchService.install(this.extension, options);
      } catch (error) {
        this.instantiationService.createInstance(PromptExtensionInstallFailureAction, this.extension, options, pick.id, InstallOperation.Install, error).run();
      }
    }
    return null;
  }
};
InstallAnotherVersionAction.ID = "workbench.extensions.action.install.anotherVersion";
InstallAnotherVersionAction.LABEL = localize("install another version", "Install Specific Version...");
InstallAnotherVersionAction = __decorateClass([
  __decorateParam(2, IExtensionsWorkbenchService),
  __decorateParam(3, IWorkbenchExtensionManagementService),
  __decorateParam(4, IExtensionGalleryService),
  __decorateParam(5, IQuickInputService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IDialogService),
  __decorateParam(8, IAllowedExtensionsService)
], InstallAnotherVersionAction);
let EnableForWorkspaceAction = class extends ExtensionAction {
  constructor(extensionsWorkbenchService, extensionEnablementService) {
    super(EnableForWorkspaceAction.ID, EnableForWorkspaceAction.LABEL, ExtensionAction.LABEL_ACTION_CLASS);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionEnablementService = extensionEnablementService;
    this.tooltip = localize("enableForWorkspaceActionToolTip", "Enable this extension only in this workspace");
    this.update();
  }
  update() {
    this.enabled = false;
    if (this.extension && this.extension.local && !this.extension.isWorkspaceScoped) {
      this.enabled = this.extension.state === ExtensionState.Installed && !this.extensionEnablementService.isEnabled(this.extension.local) && this.extensionEnablementService.canChangeWorkspaceEnablement(this.extension.local);
    }
  }
  async run() {
    if (!this.extension) {
      return;
    }
    return this.extensionsWorkbenchService.setEnablement(this.extension, EnablementState.EnabledWorkspace);
  }
};
EnableForWorkspaceAction.ID = "extensions.enableForWorkspace";
EnableForWorkspaceAction.LABEL = localize("enableForWorkspaceAction", "Enable (Workspace)");
EnableForWorkspaceAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IWorkbenchExtensionEnablementService)
], EnableForWorkspaceAction);
let EnableGloballyAction = class extends ExtensionAction {
  constructor(extensionsWorkbenchService, extensionEnablementService) {
    super(EnableGloballyAction.ID, EnableGloballyAction.LABEL, ExtensionAction.LABEL_ACTION_CLASS);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionEnablementService = extensionEnablementService;
    this.tooltip = localize("enableGloballyActionToolTip", "Enable this extension");
    this.update();
  }
  update() {
    this.enabled = false;
    if (this.extension && this.extension.local && !this.extension.isWorkspaceScoped) {
      this.enabled = this.extension.state === ExtensionState.Installed && this.extensionEnablementService.isDisabledGlobally(this.extension.local) && this.extensionEnablementService.canChangeEnablement(this.extension.local);
    }
  }
  async run() {
    if (!this.extension) {
      return;
    }
    return this.extensionsWorkbenchService.setEnablement(this.extension, EnablementState.EnabledGlobally);
  }
};
EnableGloballyAction.ID = "extensions.enableGlobally";
EnableGloballyAction.LABEL = localize("enableGloballyAction", "Enable");
EnableGloballyAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IWorkbenchExtensionEnablementService)
], EnableGloballyAction);
let DisableForWorkspaceAction = class extends ExtensionAction {
  constructor(workspaceContextService, extensionsWorkbenchService, extensionEnablementService, extensionService) {
    super(DisableForWorkspaceAction.ID, DisableForWorkspaceAction.LABEL, ExtensionAction.LABEL_ACTION_CLASS);
    this.workspaceContextService = workspaceContextService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionEnablementService = extensionEnablementService;
    this.extensionService = extensionService;
    this.tooltip = localize("disableForWorkspaceActionToolTip", "Disable this extension only in this workspace");
    this.update();
    this._register(this.extensionService.onDidChangeExtensions(() => this.update()));
  }
  update() {
    this.enabled = false;
    if (this.extension && this.extension.local && !this.extension.isWorkspaceScoped && this.extensionService.extensions.some((e) => areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, this.extension.identifier) && this.workspaceContextService.getWorkbenchState() !== WorkbenchState.EMPTY)) {
      this.enabled = this.extension.state === ExtensionState.Installed && (this.extension.enablementState === EnablementState.EnabledGlobally || this.extension.enablementState === EnablementState.EnabledWorkspace) && this.extensionEnablementService.canChangeWorkspaceEnablement(this.extension.local);
    }
  }
  async run() {
    if (!this.extension) {
      return;
    }
    return this.extensionsWorkbenchService.setEnablement(this.extension, EnablementState.DisabledWorkspace);
  }
};
DisableForWorkspaceAction.ID = "extensions.disableForWorkspace";
DisableForWorkspaceAction.LABEL = localize("disableForWorkspaceAction", "Disable (Workspace)");
DisableForWorkspaceAction = __decorateClass([
  __decorateParam(0, IWorkspaceContextService),
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IWorkbenchExtensionEnablementService),
  __decorateParam(3, IExtensionService)
], DisableForWorkspaceAction);
let DisableGloballyAction = class extends ExtensionAction {
  constructor(extensionsWorkbenchService, extensionEnablementService, extensionService) {
    super(DisableGloballyAction.ID, DisableGloballyAction.LABEL, ExtensionAction.LABEL_ACTION_CLASS);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionEnablementService = extensionEnablementService;
    this.extensionService = extensionService;
    this.tooltip = localize("disableGloballyActionToolTip", "Disable this extension");
    this.update();
    this._register(this.extensionService.onDidChangeExtensions(() => this.update()));
  }
  update() {
    this.enabled = false;
    if (this.extension && this.extension.local && !this.extension.isWorkspaceScoped && this.extensionService.extensions.some((e) => areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, this.extension.identifier))) {
      this.enabled = this.extension.state === ExtensionState.Installed && (this.extension.enablementState === EnablementState.EnabledGlobally || this.extension.enablementState === EnablementState.EnabledWorkspace) && this.extensionEnablementService.canChangeEnablement(this.extension.local);
    }
  }
  async run() {
    if (!this.extension) {
      return;
    }
    return this.extensionsWorkbenchService.setEnablement(this.extension, EnablementState.DisabledGlobally);
  }
};
DisableGloballyAction.ID = "extensions.disableGlobally";
DisableGloballyAction.LABEL = localize("disableGloballyAction", "Disable");
DisableGloballyAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IWorkbenchExtensionEnablementService),
  __decorateParam(2, IExtensionService)
], DisableGloballyAction);
let EnableDropDownAction = class extends ButtonWithDropDownExtensionAction {
  constructor(instantiationService) {
    super("extensions.enable", ExtensionAction.LABEL_ACTION_CLASS, [
      [
        instantiationService.createInstance(EnableGloballyAction),
        instantiationService.createInstance(EnableForWorkspaceAction)
      ]
    ]);
  }
};
EnableDropDownAction = __decorateClass([
  __decorateParam(0, IInstantiationService)
], EnableDropDownAction);
let DisableDropDownAction = class extends ButtonWithDropDownExtensionAction {
  constructor(instantiationService) {
    super("extensions.disable", ExtensionAction.LABEL_ACTION_CLASS, [[
      instantiationService.createInstance(DisableGloballyAction),
      instantiationService.createInstance(DisableForWorkspaceAction)
    ]]);
  }
};
DisableDropDownAction = __decorateClass([
  __decorateParam(0, IInstantiationService)
], DisableDropDownAction);
let ExtensionRuntimeStateAction = class extends ExtensionAction {
  constructor(hostService, extensionsWorkbenchService, updateService, extensionService, productService, telemetryService) {
    super("extensions.runtimeState", "", ExtensionRuntimeStateAction.DisabledClass, false);
    this.hostService = hostService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.updateService = updateService;
    this.extensionService = extensionService;
    this.productService = productService;
    this.telemetryService = telemetryService;
    this.updateWhenCounterExtensionChanges = true;
    this._register(this.extensionService.onDidChangeExtensions(() => this.update()));
    this.update();
  }
  update() {
    this.enabled = false;
    this.tooltip = "";
    this.class = ExtensionRuntimeStateAction.DisabledClass;
    if (!this.extension) {
      return;
    }
    const state = this.extension.state;
    if (state === ExtensionState.Installing || state === ExtensionState.Uninstalling) {
      return;
    }
    if (this.extension.local && this.extension.local.manifest && this.extension.local.manifest.contributes && this.extension.local.manifest.contributes.localizations && this.extension.local.manifest.contributes.localizations.length > 0) {
      return;
    }
    const runtimeState = this.extension.runtimeState;
    if (!runtimeState) {
      return;
    }
    this.enabled = true;
    this.class = ExtensionRuntimeStateAction.EnabledClass;
    this.tooltip = runtimeState.reason;
    this.label = runtimeState.action === ExtensionRuntimeActionType.ReloadWindow ? localize("reload window", "Reload Window") : runtimeState.action === ExtensionRuntimeActionType.RestartExtensions ? localize("restart extensions", "Restart Extensions") : runtimeState.action === ExtensionRuntimeActionType.QuitAndInstall ? localize("restart product", "Restart to Update") : runtimeState.action === ExtensionRuntimeActionType.ApplyUpdate || runtimeState.action === ExtensionRuntimeActionType.DownloadUpdate ? localize("update product", "Update {0}", this.productService.nameShort) : "";
  }
  async run() {
    const runtimeState = this.extension?.runtimeState;
    if (!runtimeState?.action) {
      return;
    }
    this.telemetryService.publicLog2("extensions:runtimestate:action", {
      action: runtimeState.action
    });
    if (runtimeState?.action === ExtensionRuntimeActionType.ReloadWindow) {
      return this.hostService.reload();
    } else if (runtimeState?.action === ExtensionRuntimeActionType.RestartExtensions) {
      return this.extensionsWorkbenchService.updateRunningExtensions();
    } else if (runtimeState?.action === ExtensionRuntimeActionType.DownloadUpdate) {
      return this.updateService.downloadUpdate();
    } else if (runtimeState?.action === ExtensionRuntimeActionType.ApplyUpdate) {
      return this.updateService.applyUpdate();
    } else if (runtimeState?.action === ExtensionRuntimeActionType.QuitAndInstall) {
      return this.updateService.quitAndInstall();
    }
  }
};
ExtensionRuntimeStateAction.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} reload`;
ExtensionRuntimeStateAction.DisabledClass = `${ExtensionRuntimeStateAction.EnabledClass} disabled`;
ExtensionRuntimeStateAction = __decorateClass([
  __decorateParam(0, IHostService),
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IUpdateService),
  __decorateParam(3, IExtensionService),
  __decorateParam(4, IProductService),
  __decorateParam(5, ITelemetryService)
], ExtensionRuntimeStateAction);
function isThemeFromExtension(theme, extension) {
  return !!(extension && theme.extensionData && ExtensionIdentifier.equals(theme.extensionData.extensionId, extension.identifier.id));
}
function getQuickPickEntries(themes, currentTheme, extension, showCurrentTheme) {
  const picks = [];
  for (const theme of themes) {
    if (isThemeFromExtension(theme, extension) && !(showCurrentTheme && theme === currentTheme)) {
      picks.push({ label: theme.label, id: theme.id });
    }
  }
  if (showCurrentTheme) {
    picks.push({ type: "separator", label: localize("current", "current") });
    picks.push({ label: currentTheme.label, id: currentTheme.id });
  }
  return picks;
}
let SetColorThemeAction = class extends ExtensionAction {
  constructor(extensionService, workbenchThemeService, quickInputService, extensionEnablementService) {
    super(SetColorThemeAction.ID, SetColorThemeAction.TITLE.value, SetColorThemeAction.DisabledClass, false);
    this.workbenchThemeService = workbenchThemeService;
    this.quickInputService = quickInputService;
    this.extensionEnablementService = extensionEnablementService;
    this._register(Event.any(extensionService.onDidChangeExtensions, workbenchThemeService.onDidColorThemeChange)(() => this.update(), this));
    this.update();
  }
  update() {
    this.workbenchThemeService.getColorThemes().then((colorThemes) => {
      this.enabled = this.computeEnablement(colorThemes);
      this.class = this.enabled ? SetColorThemeAction.EnabledClass : SetColorThemeAction.DisabledClass;
    });
  }
  computeEnablement(colorThemes) {
    return !!this.extension && this.extension.state === ExtensionState.Installed && this.extensionEnablementService.isEnabledEnablementState(this.extension.enablementState) && colorThemes.some((th) => isThemeFromExtension(th, this.extension));
  }
  async run({ showCurrentTheme, ignoreFocusLost } = { showCurrentTheme: false, ignoreFocusLost: false }) {
    const colorThemes = await this.workbenchThemeService.getColorThemes();
    if (!this.computeEnablement(colorThemes)) {
      return;
    }
    const currentTheme = this.workbenchThemeService.getColorTheme();
    const delayer = new Delayer(100);
    const picks = getQuickPickEntries(colorThemes, currentTheme, this.extension, showCurrentTheme);
    const pickedTheme = await this.quickInputService.pick(
      picks,
      {
        placeHolder: localize("select color theme", "Select Color Theme"),
        onDidFocus: (item) => delayer.trigger(() => this.workbenchThemeService.setColorTheme(item.id, void 0)),
        ignoreFocusLost
      }
    );
    return this.workbenchThemeService.setColorTheme(pickedTheme ? pickedTheme.id : currentTheme.id, "auto");
  }
};
SetColorThemeAction.ID = "workbench.extensions.action.setColorTheme";
SetColorThemeAction.TITLE = localize2("workbench.extensions.action.setColorTheme", "Set Color Theme");
SetColorThemeAction.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} theme`;
SetColorThemeAction.DisabledClass = `${SetColorThemeAction.EnabledClass} disabled`;
SetColorThemeAction = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IWorkbenchThemeService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, IWorkbenchExtensionEnablementService)
], SetColorThemeAction);
let SetFileIconThemeAction = class extends ExtensionAction {
  constructor(extensionService, workbenchThemeService, quickInputService, extensionEnablementService) {
    super(SetFileIconThemeAction.ID, SetFileIconThemeAction.TITLE.value, SetFileIconThemeAction.DisabledClass, false);
    this.workbenchThemeService = workbenchThemeService;
    this.quickInputService = quickInputService;
    this.extensionEnablementService = extensionEnablementService;
    this._register(Event.any(extensionService.onDidChangeExtensions, workbenchThemeService.onDidFileIconThemeChange)(() => this.update(), this));
    this.update();
  }
  update() {
    this.workbenchThemeService.getFileIconThemes().then((fileIconThemes) => {
      this.enabled = this.computeEnablement(fileIconThemes);
      this.class = this.enabled ? SetFileIconThemeAction.EnabledClass : SetFileIconThemeAction.DisabledClass;
    });
  }
  computeEnablement(colorThemfileIconThemess) {
    return !!this.extension && this.extension.state === ExtensionState.Installed && this.extensionEnablementService.isEnabledEnablementState(this.extension.enablementState) && colorThemfileIconThemess.some((th) => isThemeFromExtension(th, this.extension));
  }
  async run({ showCurrentTheme, ignoreFocusLost } = { showCurrentTheme: false, ignoreFocusLost: false }) {
    const fileIconThemes = await this.workbenchThemeService.getFileIconThemes();
    if (!this.computeEnablement(fileIconThemes)) {
      return;
    }
    const currentTheme = this.workbenchThemeService.getFileIconTheme();
    const delayer = new Delayer(100);
    const picks = getQuickPickEntries(fileIconThemes, currentTheme, this.extension, showCurrentTheme);
    const pickedTheme = await this.quickInputService.pick(
      picks,
      {
        placeHolder: localize("select file icon theme", "Select File Icon Theme"),
        onDidFocus: (item) => delayer.trigger(() => this.workbenchThemeService.setFileIconTheme(item.id, void 0)),
        ignoreFocusLost
      }
    );
    return this.workbenchThemeService.setFileIconTheme(pickedTheme ? pickedTheme.id : currentTheme.id, "auto");
  }
};
SetFileIconThemeAction.ID = "workbench.extensions.action.setFileIconTheme";
SetFileIconThemeAction.TITLE = localize2("workbench.extensions.action.setFileIconTheme", "Set File Icon Theme");
SetFileIconThemeAction.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} theme`;
SetFileIconThemeAction.DisabledClass = `${SetFileIconThemeAction.EnabledClass} disabled`;
SetFileIconThemeAction = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IWorkbenchThemeService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, IWorkbenchExtensionEnablementService)
], SetFileIconThemeAction);
let SetProductIconThemeAction = class extends ExtensionAction {
  constructor(extensionService, workbenchThemeService, quickInputService, extensionEnablementService) {
    super(SetProductIconThemeAction.ID, SetProductIconThemeAction.TITLE.value, SetProductIconThemeAction.DisabledClass, false);
    this.workbenchThemeService = workbenchThemeService;
    this.quickInputService = quickInputService;
    this.extensionEnablementService = extensionEnablementService;
    this._register(Event.any(extensionService.onDidChangeExtensions, workbenchThemeService.onDidProductIconThemeChange)(() => this.update(), this));
    this.update();
  }
  update() {
    this.workbenchThemeService.getProductIconThemes().then((productIconThemes) => {
      this.enabled = this.computeEnablement(productIconThemes);
      this.class = this.enabled ? SetProductIconThemeAction.EnabledClass : SetProductIconThemeAction.DisabledClass;
    });
  }
  computeEnablement(productIconThemes) {
    return !!this.extension && this.extension.state === ExtensionState.Installed && this.extensionEnablementService.isEnabledEnablementState(this.extension.enablementState) && productIconThemes.some((th) => isThemeFromExtension(th, this.extension));
  }
  async run({ showCurrentTheme, ignoreFocusLost } = { showCurrentTheme: false, ignoreFocusLost: false }) {
    const productIconThemes = await this.workbenchThemeService.getProductIconThemes();
    if (!this.computeEnablement(productIconThemes)) {
      return;
    }
    const currentTheme = this.workbenchThemeService.getProductIconTheme();
    const delayer = new Delayer(100);
    const picks = getQuickPickEntries(productIconThemes, currentTheme, this.extension, showCurrentTheme);
    const pickedTheme = await this.quickInputService.pick(
      picks,
      {
        placeHolder: localize("select product icon theme", "Select Product Icon Theme"),
        onDidFocus: (item) => delayer.trigger(() => this.workbenchThemeService.setProductIconTheme(item.id, void 0)),
        ignoreFocusLost
      }
    );
    return this.workbenchThemeService.setProductIconTheme(pickedTheme ? pickedTheme.id : currentTheme.id, "auto");
  }
};
SetProductIconThemeAction.ID = "workbench.extensions.action.setProductIconTheme";
SetProductIconThemeAction.TITLE = localize2("workbench.extensions.action.setProductIconTheme", "Set Product Icon Theme");
SetProductIconThemeAction.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} theme`;
SetProductIconThemeAction.DisabledClass = `${SetProductIconThemeAction.EnabledClass} disabled`;
SetProductIconThemeAction = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IWorkbenchThemeService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, IWorkbenchExtensionEnablementService)
], SetProductIconThemeAction);
let SetLanguageAction = class extends ExtensionAction {
  constructor(extensionsWorkbenchService) {
    super(SetLanguageAction.ID, SetLanguageAction.TITLE.value, SetLanguageAction.DisabledClass, false);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.update();
  }
  update() {
    this.enabled = false;
    this.class = SetLanguageAction.DisabledClass;
    if (!this.extension) {
      return;
    }
    if (!this.extensionsWorkbenchService.canSetLanguage(this.extension)) {
      return;
    }
    if (this.extension.gallery && language === getLocale(this.extension.gallery)) {
      return;
    }
    this.enabled = true;
    this.class = SetLanguageAction.EnabledClass;
  }
  async run() {
    return this.extension && this.extensionsWorkbenchService.setLanguage(this.extension);
  }
};
SetLanguageAction.ID = "workbench.extensions.action.setDisplayLanguage";
SetLanguageAction.TITLE = localize2("workbench.extensions.action.setDisplayLanguage", "Set Display Language");
SetLanguageAction.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} language`;
SetLanguageAction.DisabledClass = `${SetLanguageAction.EnabledClass} disabled`;
SetLanguageAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService)
], SetLanguageAction);
let ClearLanguageAction = class extends ExtensionAction {
  constructor(extensionsWorkbenchService, localeService) {
    super(ClearLanguageAction.ID, ClearLanguageAction.TITLE.value, ClearLanguageAction.DisabledClass, false);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.localeService = localeService;
    this.update();
  }
  update() {
    this.enabled = false;
    this.class = ClearLanguageAction.DisabledClass;
    if (!this.extension) {
      return;
    }
    if (!this.extensionsWorkbenchService.canSetLanguage(this.extension)) {
      return;
    }
    if (this.extension.gallery && language !== getLocale(this.extension.gallery)) {
      return;
    }
    this.enabled = true;
    this.class = ClearLanguageAction.EnabledClass;
  }
  async run() {
    return this.extension && this.localeService.clearLocalePreference();
  }
};
ClearLanguageAction.ID = "workbench.extensions.action.clearLanguage";
ClearLanguageAction.TITLE = localize2("workbench.extensions.action.clearLanguage", "Clear Display Language");
ClearLanguageAction.EnabledClass = `${ExtensionAction.LABEL_ACTION_CLASS} language`;
ClearLanguageAction.DisabledClass = `${ClearLanguageAction.EnabledClass} disabled`;
ClearLanguageAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, ILocaleService)
], ClearLanguageAction);
let ShowRecommendedExtensionAction = class extends Action {
  constructor(extensionId, extensionWorkbenchService) {
    super(ShowRecommendedExtensionAction.ID, ShowRecommendedExtensionAction.LABEL, void 0, false);
    this.extensionWorkbenchService = extensionWorkbenchService;
    this.extensionId = extensionId;
  }
  async run() {
    await this.extensionWorkbenchService.openSearch(`@id:${this.extensionId}`);
    const [extension] = await this.extensionWorkbenchService.getExtensions([{ id: this.extensionId }], { source: "install-recommendation" }, CancellationToken.None);
    if (extension) {
      return this.extensionWorkbenchService.open(extension);
    }
    return null;
  }
};
ShowRecommendedExtensionAction.ID = "workbench.extensions.action.showRecommendedExtension";
ShowRecommendedExtensionAction.LABEL = localize("showRecommendedExtension", "Show Recommended Extension");
ShowRecommendedExtensionAction = __decorateClass([
  __decorateParam(1, IExtensionsWorkbenchService)
], ShowRecommendedExtensionAction);
let InstallRecommendedExtensionAction = class extends Action {
  constructor(extensionId, instantiationService, extensionWorkbenchService) {
    super(InstallRecommendedExtensionAction.ID, InstallRecommendedExtensionAction.LABEL, void 0, false);
    this.instantiationService = instantiationService;
    this.extensionWorkbenchService = extensionWorkbenchService;
    this.extensionId = extensionId;
  }
  async run() {
    await this.extensionWorkbenchService.openSearch(`@id:${this.extensionId}`);
    const [extension] = await this.extensionWorkbenchService.getExtensions([{ id: this.extensionId }], { source: "install-recommendation" }, CancellationToken.None);
    if (extension) {
      await this.extensionWorkbenchService.open(extension);
      try {
        await this.extensionWorkbenchService.install(extension);
      } catch (err) {
        this.instantiationService.createInstance(PromptExtensionInstallFailureAction, extension, void 0, extension.latestVersion, InstallOperation.Install, err).run();
      }
    }
  }
};
InstallRecommendedExtensionAction.ID = "workbench.extensions.action.installRecommendedExtension";
InstallRecommendedExtensionAction.LABEL = localize("installRecommendedExtension", "Install Recommended Extension");
InstallRecommendedExtensionAction = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, IExtensionsWorkbenchService)
], InstallRecommendedExtensionAction);
let IgnoreExtensionRecommendationAction = class extends Action {
  constructor(extension, extensionRecommendationsManagementService) {
    super(IgnoreExtensionRecommendationAction.ID, "Ignore Recommendation");
    this.extension = extension;
    this.extensionRecommendationsManagementService = extensionRecommendationsManagementService;
    this.class = IgnoreExtensionRecommendationAction.Class;
    this.tooltip = localize("ignoreExtensionRecommendation", "Do not recommend this extension again");
    this.enabled = true;
  }
  run() {
    this.extensionRecommendationsManagementService.toggleGlobalIgnoredRecommendation(this.extension.identifier.id, true);
    return Promise.resolve();
  }
};
IgnoreExtensionRecommendationAction.ID = "extensions.ignore";
IgnoreExtensionRecommendationAction.Class = `${ExtensionAction.LABEL_ACTION_CLASS} ignore`;
IgnoreExtensionRecommendationAction = __decorateClass([
  __decorateParam(1, IExtensionIgnoredRecommendationsService)
], IgnoreExtensionRecommendationAction);
let UndoIgnoreExtensionRecommendationAction = class extends Action {
  constructor(extension, extensionRecommendationsManagementService) {
    super(UndoIgnoreExtensionRecommendationAction.ID, "Undo");
    this.extension = extension;
    this.extensionRecommendationsManagementService = extensionRecommendationsManagementService;
    this.class = UndoIgnoreExtensionRecommendationAction.Class;
    this.tooltip = localize("undo", "Undo");
    this.enabled = true;
  }
  run() {
    this.extensionRecommendationsManagementService.toggleGlobalIgnoredRecommendation(this.extension.identifier.id, false);
    return Promise.resolve();
  }
};
UndoIgnoreExtensionRecommendationAction.ID = "extensions.ignore";
UndoIgnoreExtensionRecommendationAction.Class = `${ExtensionAction.LABEL_ACTION_CLASS} undo-ignore`;
UndoIgnoreExtensionRecommendationAction = __decorateClass([
  __decorateParam(1, IExtensionIgnoredRecommendationsService)
], UndoIgnoreExtensionRecommendationAction);
let AbstractConfigureRecommendedExtensionsAction = class extends Action {
  constructor(id, label, contextService, fileService, textFileService, editorService, jsonEditingService, textModelResolverService) {
    super(id, label);
    this.contextService = contextService;
    this.fileService = fileService;
    this.textFileService = textFileService;
    this.editorService = editorService;
    this.jsonEditingService = jsonEditingService;
    this.textModelResolverService = textModelResolverService;
  }
  openExtensionsFile(extensionsFileResource) {
    return this.getOrCreateExtensionsFile(extensionsFileResource).then(
      ({ created, content }) => this.getSelectionPosition(content, extensionsFileResource, ["recommendations"]).then((selection) => this.editorService.openEditor({
        resource: extensionsFileResource,
        options: {
          pinned: created,
          selection
        }
      })),
      (error) => Promise.reject(new Error(localize("OpenExtensionsFile.failed", "Unable to create 'extensions.json' file inside the '.vscode' folder ({0}).", error)))
    );
  }
  openWorkspaceConfigurationFile(workspaceConfigurationFile) {
    return this.getOrUpdateWorkspaceConfigurationFile(workspaceConfigurationFile).then((content) => this.getSelectionPosition(content.value.toString(), content.resource, ["extensions", "recommendations"])).then((selection) => this.editorService.openEditor({
      resource: workspaceConfigurationFile,
      options: {
        selection,
        forceReload: true
        // because content has changed
      }
    }));
  }
  getOrUpdateWorkspaceConfigurationFile(workspaceConfigurationFile) {
    return Promise.resolve(this.fileService.readFile(workspaceConfigurationFile)).then((content) => {
      const workspaceRecommendations = json.parse(content.value.toString())["extensions"];
      if (!workspaceRecommendations || !workspaceRecommendations.recommendations) {
        return this.jsonEditingService.write(workspaceConfigurationFile, [{ path: ["extensions"], value: { recommendations: [] } }], true).then(() => this.fileService.readFile(workspaceConfigurationFile));
      }
      return content;
    });
  }
  getSelectionPosition(content, resource, path) {
    const tree = json.parseTree(content);
    const node = json.findNodeAtLocation(tree, path);
    if (node && node.parent && node.parent.children) {
      const recommendationsValueNode = node.parent.children[1];
      const lastExtensionNode = recommendationsValueNode.children && recommendationsValueNode.children.length ? recommendationsValueNode.children[recommendationsValueNode.children.length - 1] : null;
      const offset = lastExtensionNode ? lastExtensionNode.offset + lastExtensionNode.length : recommendationsValueNode.offset + 1;
      return Promise.resolve(this.textModelResolverService.createModelReference(resource)).then((reference) => {
        const position = reference.object.textEditorModel.getPositionAt(offset);
        reference.dispose();
        return {
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        };
      });
    }
    return Promise.resolve(void 0);
  }
  getOrCreateExtensionsFile(extensionsFileResource) {
    return Promise.resolve(this.fileService.readFile(extensionsFileResource)).then((content) => {
      return { created: false, extensionsFileResource, content: content.value.toString() };
    }, (err) => {
      return this.textFileService.write(extensionsFileResource, ExtensionsConfigurationInitialContent).then(() => {
        return { created: true, extensionsFileResource, content: ExtensionsConfigurationInitialContent };
      });
    });
  }
};
AbstractConfigureRecommendedExtensionsAction = __decorateClass([
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IFileService),
  __decorateParam(4, ITextFileService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IJSONEditingService),
  __decorateParam(7, ITextModelService)
], AbstractConfigureRecommendedExtensionsAction);
let ConfigureWorkspaceRecommendedExtensionsAction = class extends AbstractConfigureRecommendedExtensionsAction {
  constructor(id, label, fileService, textFileService, contextService, editorService, jsonEditingService, textModelResolverService) {
    super(id, label, contextService, fileService, textFileService, editorService, jsonEditingService, textModelResolverService);
    this._register(this.contextService.onDidChangeWorkbenchState(() => this.update(), this));
    this.update();
  }
  update() {
    this.enabled = this.contextService.getWorkbenchState() !== WorkbenchState.EMPTY;
  }
  run() {
    switch (this.contextService.getWorkbenchState()) {
      case WorkbenchState.FOLDER:
        return this.openExtensionsFile(this.contextService.getWorkspace().folders[0].toResource(EXTENSIONS_CONFIG));
      case WorkbenchState.WORKSPACE:
        return this.openWorkspaceConfigurationFile(this.contextService.getWorkspace().configuration);
    }
    return Promise.resolve();
  }
};
ConfigureWorkspaceRecommendedExtensionsAction.ID = "workbench.extensions.action.configureWorkspaceRecommendedExtensions";
ConfigureWorkspaceRecommendedExtensionsAction.LABEL = localize("configureWorkspaceRecommendedExtensions", "Configure Recommended Extensions (Workspace)");
ConfigureWorkspaceRecommendedExtensionsAction = __decorateClass([
  __decorateParam(2, IFileService),
  __decorateParam(3, ITextFileService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IJSONEditingService),
  __decorateParam(7, ITextModelService)
], ConfigureWorkspaceRecommendedExtensionsAction);
let ConfigureWorkspaceFolderRecommendedExtensionsAction = class extends AbstractConfigureRecommendedExtensionsAction {
  constructor(id, label, fileService, textFileService, contextService, editorService, jsonEditingService, textModelResolverService, commandService) {
    super(id, label, contextService, fileService, textFileService, editorService, jsonEditingService, textModelResolverService);
    this.commandService = commandService;
  }
  run() {
    const folderCount = this.contextService.getWorkspace().folders.length;
    const pickFolderPromise = folderCount === 1 ? Promise.resolve(this.contextService.getWorkspace().folders[0]) : this.commandService.executeCommand(PICK_WORKSPACE_FOLDER_COMMAND_ID);
    return Promise.resolve(pickFolderPromise).then((workspaceFolder) => {
      if (workspaceFolder) {
        return this.openExtensionsFile(workspaceFolder.toResource(EXTENSIONS_CONFIG));
      }
      return null;
    });
  }
};
ConfigureWorkspaceFolderRecommendedExtensionsAction.ID = "workbench.extensions.action.configureWorkspaceFolderRecommendedExtensions";
ConfigureWorkspaceFolderRecommendedExtensionsAction.LABEL = localize("configureWorkspaceFolderRecommendedExtensions", "Configure Recommended Extensions (Workspace Folder)");
ConfigureWorkspaceFolderRecommendedExtensionsAction = __decorateClass([
  __decorateParam(2, IFileService),
  __decorateParam(3, ITextFileService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, IEditorService),
  __decorateParam(6, IJSONEditingService),
  __decorateParam(7, ITextModelService),
  __decorateParam(8, ICommandService)
], ConfigureWorkspaceFolderRecommendedExtensionsAction);
let ExtensionStatusLabelAction = class extends Action {
  constructor(extensionService, extensionManagementServerService, extensionEnablementService) {
    super("extensions.action.statusLabel", "", ExtensionStatusLabelAction.DISABLED_CLASS, false);
    this.extensionService = extensionService;
    this.extensionManagementServerService = extensionManagementServerService;
    this.extensionEnablementService = extensionEnablementService;
    this.initialStatus = null;
    this.status = null;
    this.version = null;
    this.enablementState = null;
    this._extension = null;
  }
  get extension() {
    return this._extension;
  }
  set extension(extension) {
    if (!(this._extension && extension && areSameExtensions(this._extension.identifier, extension.identifier))) {
      this.initialStatus = null;
      this.status = null;
      this.enablementState = null;
    }
    this._extension = extension;
    this.update();
  }
  update() {
    const label = this.computeLabel();
    this.label = label || "";
    this.class = label ? ExtensionStatusLabelAction.ENABLED_CLASS : ExtensionStatusLabelAction.DISABLED_CLASS;
  }
  computeLabel() {
    if (!this.extension) {
      return null;
    }
    const currentStatus = this.status;
    const currentVersion = this.version;
    const currentEnablementState = this.enablementState;
    this.status = this.extension.state;
    this.version = this.extension.version;
    if (this.initialStatus === null) {
      this.initialStatus = this.status;
    }
    this.enablementState = this.extension.enablementState;
    const canAddExtension = () => {
      const runningExtension = this.extensionService.extensions.filter((e) => areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, this.extension.identifier))[0];
      if (this.extension.local) {
        if (runningExtension && this.extension.version === runningExtension.version) {
          return true;
        }
        return this.extensionService.canAddExtension(toExtensionDescription(this.extension.local));
      }
      return false;
    };
    const canRemoveExtension = () => {
      if (this.extension.local) {
        if (this.extensionService.extensions.every((e) => !(areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, this.extension.identifier) && this.extension.server === this.extensionManagementServerService.getExtensionManagementServer(toExtension(e))))) {
          return true;
        }
        return this.extensionService.canRemoveExtension(toExtensionDescription(this.extension.local));
      }
      return false;
    };
    if (currentStatus !== null) {
      if (currentStatus === ExtensionState.Installing && this.status === ExtensionState.Installed) {
        if (this.initialStatus === ExtensionState.Uninstalled && canAddExtension()) {
          return localize("installed", "Installed");
        }
        if (this.initialStatus === ExtensionState.Installed && this.version !== currentVersion && canAddExtension()) {
          return localize("updated", "Updated");
        }
        return null;
      }
      if (currentStatus === ExtensionState.Uninstalling && this.status === ExtensionState.Uninstalled) {
        this.initialStatus = this.status;
        return canRemoveExtension() ? localize("uninstalled", "Uninstalled") : null;
      }
    }
    if (currentEnablementState !== null) {
      const currentlyEnabled = this.extensionEnablementService.isEnabledEnablementState(currentEnablementState);
      const enabled = this.extensionEnablementService.isEnabledEnablementState(this.enablementState);
      if (!currentlyEnabled && enabled) {
        return canAddExtension() ? localize("enabled", "Enabled") : null;
      }
      if (currentlyEnabled && !enabled) {
        return canRemoveExtension() ? localize("disabled", "Disabled") : null;
      }
    }
    return null;
  }
  run() {
    return Promise.resolve();
  }
};
ExtensionStatusLabelAction.ENABLED_CLASS = `${ExtensionAction.TEXT_ACTION_CLASS} extension-status-label`;
ExtensionStatusLabelAction.DISABLED_CLASS = `${ExtensionStatusLabelAction.ENABLED_CLASS} hide`;
ExtensionStatusLabelAction = __decorateClass([
  __decorateParam(0, IExtensionService),
  __decorateParam(1, IExtensionManagementServerService),
  __decorateParam(2, IWorkbenchExtensionEnablementService)
], ExtensionStatusLabelAction);
let ToggleSyncExtensionAction = class extends DropDownExtensionAction {
  constructor(configurationService, extensionsWorkbenchService, userDataSyncEnablementService, instantiationService) {
    super("extensions.sync", "", ToggleSyncExtensionAction.SYNC_CLASS, false, instantiationService);
    this.configurationService = configurationService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.userDataSyncEnablementService = userDataSyncEnablementService;
    this._register(Event.filter(this.configurationService.onDidChangeConfiguration, (e) => e.affectsConfiguration("settingsSync.ignoredExtensions"))(() => this.update()));
    this._register(userDataSyncEnablementService.onDidChangeEnablement(() => this.update()));
    this.update();
  }
  update() {
    this.enabled = !!this.extension && this.userDataSyncEnablementService.isEnabled() && this.extension.state === ExtensionState.Installed;
    if (this.extension) {
      const isIgnored = this.extensionsWorkbenchService.isExtensionIgnoredToSync(this.extension);
      this.class = isIgnored ? ToggleSyncExtensionAction.IGNORED_SYNC_CLASS : ToggleSyncExtensionAction.SYNC_CLASS;
      this.tooltip = isIgnored ? localize("ignored", "This extension is ignored during sync") : localize("synced", "This extension is synced");
    }
  }
  async run() {
    return super.run([
      [
        new Action(
          "extensions.syncignore",
          this.extensionsWorkbenchService.isExtensionIgnoredToSync(this.extension) ? localize("sync", "Sync this extension") : localize("do not sync", "Do not sync this extension"),
          void 0,
          true,
          () => this.extensionsWorkbenchService.toggleExtensionIgnoredToSync(this.extension)
        )
      ]
    ]);
  }
};
ToggleSyncExtensionAction.IGNORED_SYNC_CLASS = `${ExtensionAction.ICON_ACTION_CLASS} extension-sync ${ThemeIcon.asClassName(syncIgnoredIcon)}`;
ToggleSyncExtensionAction.SYNC_CLASS = `${ToggleSyncExtensionAction.ICON_ACTION_CLASS} extension-sync ${ThemeIcon.asClassName(syncEnabledIcon)}`;
ToggleSyncExtensionAction = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IUserDataSyncEnablementService),
  __decorateParam(3, IInstantiationService)
], ToggleSyncExtensionAction);
let ExtensionStatusAction = class extends ExtensionAction {
  constructor(extensionManagementServerService, labelService, commandService, workspaceTrustEnablementService, workspaceTrustService, extensionsWorkbenchService, extensionService, extensionManifestPropertiesService, contextService, productService, allowedExtensionsService, workbenchExtensionEnablementService, extensionFeaturesManagementService, extensionGalleryManifestService) {
    super("extensions.status", "", `${ExtensionStatusAction.CLASS} hide`, false);
    this.extensionManagementServerService = extensionManagementServerService;
    this.labelService = labelService;
    this.commandService = commandService;
    this.workspaceTrustEnablementService = workspaceTrustEnablementService;
    this.workspaceTrustService = workspaceTrustService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionService = extensionService;
    this.extensionManifestPropertiesService = extensionManifestPropertiesService;
    this.contextService = contextService;
    this.productService = productService;
    this.allowedExtensionsService = allowedExtensionsService;
    this.workbenchExtensionEnablementService = workbenchExtensionEnablementService;
    this.extensionFeaturesManagementService = extensionFeaturesManagementService;
    this.extensionGalleryManifestService = extensionGalleryManifestService;
    this.updateWhenCounterExtensionChanges = true;
    this._status = [];
    this._onDidChangeStatus = this._register(new Emitter());
    this.onDidChangeStatus = this._onDidChangeStatus.event;
    this.updateThrottler = new Throttler();
    this._register(this.labelService.onDidChangeFormatters(() => this.update(), this));
    this._register(this.extensionService.onDidChangeExtensions(() => this.update()));
    this._register(this.extensionFeaturesManagementService.onDidChangeAccessData(() => this.update()));
    this._register(allowedExtensionsService.onDidChangeAllowedExtensionsConfigValue(() => this.update()));
    this.update();
  }
  get status() {
    return this._status;
  }
  update() {
    this.updateThrottler.queue(() => this.computeAndUpdateStatus());
  }
  async computeAndUpdateStatus() {
    this.updateStatus(void 0, true);
    this.enabled = false;
    if (!this.extension) {
      return;
    }
    if (this.extension.isMalicious) {
      this.updateStatus({ icon: warningIcon, message: new MarkdownString(localize("malicious tooltip", "This extension was reported to be problematic.")) }, true);
      return;
    }
    if (this.extension.state === ExtensionState.Uninstalled && this.extension.gallery && !this.extension.gallery.isSigned && (await this.extensionGalleryManifestService.getExtensionGalleryManifest())?.capabilities.signing?.allRepositorySigned) {
      this.updateStatus({ icon: warningIcon, message: new MarkdownString(localize("not signed tooltip", "This extension is not signed by the Extension Marketplace.")) }, true);
      return;
    }
    if (this.extension.deprecationInfo) {
      if (this.extension.deprecationInfo.extension) {
        const link = `[${this.extension.deprecationInfo.extension.displayName}](${URI.parse(`command:extension.open?${encodeURIComponent(JSON.stringify([this.extension.deprecationInfo.extension.id]))}`)})`;
        this.updateStatus({ icon: warningIcon, message: new MarkdownString(localize("deprecated with alternate extension tooltip", "This extension is deprecated. Use the {0} extension instead.", link)) }, true);
      } else if (this.extension.deprecationInfo.settings) {
        const link = `[${localize("settings", "settings")}](${URI.parse(`command:workbench.action.openSettings?${encodeURIComponent(JSON.stringify([this.extension.deprecationInfo.settings.map((setting) => `@id:${setting}`).join(" ")]))}`)})`;
        this.updateStatus({ icon: warningIcon, message: new MarkdownString(localize("deprecated with alternate settings tooltip", "This extension is deprecated as this functionality is now built-in to VS Code. Configure these {0} to use this functionality.", link)) }, true);
      } else {
        const message = new MarkdownString(localize("deprecated tooltip", "This extension is deprecated as it is no longer being maintained."));
        if (this.extension.deprecationInfo.additionalInfo) {
          message.appendMarkdown(` ${this.extension.deprecationInfo.additionalInfo}`);
        }
        this.updateStatus({ icon: warningIcon, message }, true);
      }
      return;
    }
    if (this.extensionsWorkbenchService.canSetLanguage(this.extension)) {
      return;
    }
    if (this.extension.outdated && this.extensionsWorkbenchService.isAutoUpdateEnabledFor(this.extension)) {
      const message = await this.extensionsWorkbenchService.shouldRequireConsentToUpdate(this.extension);
      if (message) {
        const markdown = new MarkdownString();
        markdown.appendMarkdown(`${message} `);
        markdown.appendMarkdown(
          localize(
            "auto update message",
            "Please [review the extension]({0}) and update it manually.",
            this.extension.hasChangelog() ? URI.parse(`command:extension.open?${encodeURIComponent(JSON.stringify([this.extension.identifier.id, ExtensionEditorTab.Changelog]))}`).toString() : this.extension.repository ? this.extension.repository : URI.parse(`command:extension.open?${encodeURIComponent(JSON.stringify([this.extension.identifier.id]))}`).toString()
          )
        );
        this.updateStatus({ icon: warningIcon, message: markdown }, true);
      }
    }
    if (this.extension.gallery && this.extension.state === ExtensionState.Uninstalled) {
      const result = await this.extensionsWorkbenchService.canInstall(this.extension);
      if (result !== true) {
        this.updateStatus({ icon: warningIcon, message: result }, true);
        return;
      }
    }
    if (!this.extension.local || !this.extension.server || this.extension.state !== ExtensionState.Installed) {
      return;
    }
    if (this.extension.enablementState === EnablementState.DisabledByAllowlist) {
      const result = this.allowedExtensionsService.isAllowed(this.extension.local);
      if (result !== true) {
        this.updateStatus({ icon: warningIcon, message: new MarkdownString(localize("disabled - not allowed", "This extension is disabled because {0}", result.value)) }, true);
        return;
      }
    }
    if (this.extension.enablementState === EnablementState.DisabledByEnvironment) {
      this.updateStatus({ message: new MarkdownString(localize("disabled by environment", "This extension is disabled by the environment.")) }, true);
      return;
    }
    if (this.extension.enablementState === EnablementState.EnabledByEnvironment) {
      this.updateStatus({ message: new MarkdownString(localize("enabled by environment", "This extension is enabled because it is required in the current environment.")) }, true);
      return;
    }
    if (this.extension.enablementState === EnablementState.DisabledByVirtualWorkspace) {
      const details = getWorkspaceSupportTypeMessage(this.extension.local.manifest.capabilities?.virtualWorkspaces);
      this.updateStatus({ icon: infoIcon, message: new MarkdownString(details ? escapeMarkdownSyntaxTokens(details) : localize("disabled because of virtual workspace", "This extension has been disabled because it does not support virtual workspaces.")) }, true);
      return;
    }
    if (isVirtualWorkspace(this.contextService.getWorkspace())) {
      const virtualSupportType = this.extensionManifestPropertiesService.getExtensionVirtualWorkspaceSupportType(this.extension.local.manifest);
      const details = getWorkspaceSupportTypeMessage(this.extension.local.manifest.capabilities?.virtualWorkspaces);
      if (virtualSupportType === "limited" || details) {
        this.updateStatus({ icon: warningIcon, message: new MarkdownString(details ? escapeMarkdownSyntaxTokens(details) : localize("extension limited because of virtual workspace", "This extension has limited features because the current workspace is virtual.")) }, true);
        return;
      }
    }
    if (!this.workspaceTrustService.isWorkspaceTrusted() && // Extension is disabled by untrusted workspace
    (this.extension.enablementState === EnablementState.DisabledByTrustRequirement || // All disabled dependencies of the extension are disabled by untrusted workspace
    this.extension.enablementState === EnablementState.DisabledByExtensionDependency && this.workbenchExtensionEnablementService.getDependenciesEnablementStates(this.extension.local).every(([, enablementState]) => this.workbenchExtensionEnablementService.isEnabledEnablementState(enablementState) || enablementState === EnablementState.DisabledByTrustRequirement))) {
      this.enabled = true;
      const untrustedDetails = getWorkspaceSupportTypeMessage(this.extension.local.manifest.capabilities?.untrustedWorkspaces);
      this.updateStatus({ icon: trustIcon, message: new MarkdownString(untrustedDetails ? escapeMarkdownSyntaxTokens(untrustedDetails) : localize("extension disabled because of trust requirement", "This extension has been disabled because the current workspace is not trusted.")) }, true);
      return;
    }
    if (this.workspaceTrustEnablementService.isWorkspaceTrustEnabled() && !this.workspaceTrustService.isWorkspaceTrusted()) {
      const untrustedSupportType = this.extensionManifestPropertiesService.getExtensionUntrustedWorkspaceSupportType(this.extension.local.manifest);
      const untrustedDetails = getWorkspaceSupportTypeMessage(this.extension.local.manifest.capabilities?.untrustedWorkspaces);
      if (untrustedSupportType === "limited" || untrustedDetails) {
        this.enabled = true;
        this.updateStatus({ icon: trustIcon, message: new MarkdownString(untrustedDetails ? escapeMarkdownSyntaxTokens(untrustedDetails) : localize("extension limited because of trust requirement", "This extension has limited features because the current workspace is not trusted.")) }, true);
        return;
      }
    }
    if (this.extension.enablementState === EnablementState.DisabledByExtensionKind) {
      if (!this.extensionsWorkbenchService.installed.some((e) => areSameExtensions(e.identifier, this.extension.identifier) && e.server !== this.extension.server)) {
        let message;
        if (this.extensionManagementServerService.localExtensionManagementServer === this.extension.server) {
          if (this.extensionManifestPropertiesService.prefersExecuteOnWorkspace(this.extension.local.manifest)) {
            if (this.extensionManagementServerService.remoteExtensionManagementServer) {
              message = new MarkdownString(`${localize("Install in remote server to enable", "This extension is disabled in this workspace because it is defined to run in the Remote Extension Host. Please install the extension in '{0}' to enable.", this.extensionManagementServerService.remoteExtensionManagementServer.label)} [${localize("learn more", "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`);
            }
          }
        } else if (this.extensionManagementServerService.remoteExtensionManagementServer === this.extension.server) {
          if (this.extensionManifestPropertiesService.prefersExecuteOnUI(this.extension.local.manifest)) {
            if (this.extensionManagementServerService.localExtensionManagementServer) {
              message = new MarkdownString(`${localize("Install in local server to enable", "This extension is disabled in this workspace because it is defined to run in the Local Extension Host. Please install the extension locally to enable.", this.extensionManagementServerService.remoteExtensionManagementServer.label)} [${localize("learn more", "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`);
            } else if (isWeb) {
              message = new MarkdownString(`${localize("Defined to run in desktop", "This extension is disabled because it is defined to run only in {0} for the Desktop.", this.productService.nameLong)} [${localize("learn more", "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`);
            }
          }
        } else if (this.extensionManagementServerService.webExtensionManagementServer === this.extension.server) {
          message = new MarkdownString(`${localize("Cannot be enabled", "This extension is disabled because it is not supported in {0} for the Web.", this.productService.nameLong)} [${localize("learn more", "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`);
        }
        if (message) {
          this.updateStatus({ icon: warningIcon, message }, true);
        }
        return;
      }
    }
    const extensionId = new ExtensionIdentifier(this.extension.identifier.id);
    const features = Registry.as(Extensions.ExtensionFeaturesRegistry).getExtensionFeatures();
    for (const feature of features) {
      const status = this.extensionFeaturesManagementService.getAccessData(extensionId, feature.id)?.current?.status;
      const manageAccessLink = `[${localize("manage access", "Manage Access")}](${URI.parse(`command:extension.open?${encodeURIComponent(JSON.stringify([this.extension.identifier.id, ExtensionEditorTab.Features, false, feature.id]))}`)})`;
      if (status?.severity === Severity.Error) {
        this.updateStatus({ icon: errorIcon, message: new MarkdownString().appendText(status.message).appendMarkdown(` ${manageAccessLink}`) }, true);
        return;
      }
      if (status?.severity === Severity.Warning) {
        this.updateStatus({ icon: warningIcon, message: new MarkdownString().appendText(status.message).appendMarkdown(` ${manageAccessLink}`) }, true);
        return;
      }
    }
    if (this.extensionManagementServerService.remoteExtensionManagementServer) {
      if (isLanguagePackExtension(this.extension.local.manifest)) {
        if (!this.extensionsWorkbenchService.installed.some((e) => areSameExtensions(e.identifier, this.extension.identifier) && e.server !== this.extension.server)) {
          const message = this.extension.server === this.extensionManagementServerService.localExtensionManagementServer ? new MarkdownString(localize("Install language pack also in remote server", "Install the language pack extension on '{0}' to enable it there also.", this.extensionManagementServerService.remoteExtensionManagementServer.label)) : new MarkdownString(localize("Install language pack also locally", "Install the language pack extension locally to enable it there also."));
          this.updateStatus({ icon: infoIcon, message }, true);
        }
        return;
      }
      const runningExtension = this.extensionService.extensions.filter((e) => areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, this.extension.identifier))[0];
      const runningExtensionServer = runningExtension ? this.extensionManagementServerService.getExtensionManagementServer(toExtension(runningExtension)) : null;
      if (this.extension.server === this.extensionManagementServerService.localExtensionManagementServer && runningExtensionServer === this.extensionManagementServerService.remoteExtensionManagementServer) {
        if (this.extensionManifestPropertiesService.prefersExecuteOnWorkspace(this.extension.local.manifest)) {
          this.updateStatus({ icon: infoIcon, message: new MarkdownString(`${localize("enabled remotely", "This extension is enabled in the Remote Extension Host because it prefers to run there.")} [${localize("learn more", "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`) }, true);
        }
        return;
      }
      if (this.extension.server === this.extensionManagementServerService.remoteExtensionManagementServer && runningExtensionServer === this.extensionManagementServerService.localExtensionManagementServer) {
        if (this.extensionManifestPropertiesService.prefersExecuteOnUI(this.extension.local.manifest)) {
          this.updateStatus({ icon: infoIcon, message: new MarkdownString(`${localize("enabled locally", "This extension is enabled in the Local Extension Host because it prefers to run there.")} [${localize("learn more", "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`) }, true);
        }
        return;
      }
      if (this.extension.server === this.extensionManagementServerService.remoteExtensionManagementServer && runningExtensionServer === this.extensionManagementServerService.webExtensionManagementServer) {
        if (this.extensionManifestPropertiesService.canExecuteOnWeb(this.extension.local.manifest)) {
          this.updateStatus({ icon: infoIcon, message: new MarkdownString(`${localize("enabled in web worker", "This extension is enabled in the Web Worker Extension Host because it prefers to run there.")} [${localize("learn more", "Learn More")}](https://code.visualstudio.com/api/advanced-topics/remote-extensions#architecture-and-extension-kinds)`) }, true);
        }
        return;
      }
    }
    if (this.extension.enablementState === EnablementState.DisabledByExtensionDependency) {
      this.updateStatus({
        icon: warningIcon,
        message: new MarkdownString(localize("extension disabled because of dependency", "This extension depends on an extension that is disabled.")).appendMarkdown(`&nbsp;[${localize("dependencies", "Show Dependencies")}](${URI.parse(`command:extension.open?${encodeURIComponent(JSON.stringify([this.extension.identifier.id, ExtensionEditorTab.Dependencies]))}`)})`)
      }, true);
      return;
    }
    if (!this.extension.local.isValid) {
      const errors = this.extension.local.validations.filter(([severity]) => severity === Severity.Error).map(([, message]) => message);
      this.updateStatus({ icon: warningIcon, message: new MarkdownString(errors.join(" ").trim()) }, true);
      return;
    }
    const isEnabled = this.workbenchExtensionEnablementService.isEnabled(this.extension.local);
    const isRunning = this.extensionService.extensions.some((e) => areSameExtensions({ id: e.identifier.value, uuid: e.uuid }, this.extension.identifier));
    if (!this.extension.isWorkspaceScoped && isEnabled && isRunning) {
      if (this.extension.enablementState === EnablementState.EnabledWorkspace) {
        this.updateStatus({ message: new MarkdownString(localize("workspace enabled", "This extension is enabled for this workspace by the user.")) }, true);
        return;
      }
      if (this.extensionManagementServerService.localExtensionManagementServer && this.extensionManagementServerService.remoteExtensionManagementServer) {
        if (this.extension.server === this.extensionManagementServerService.remoteExtensionManagementServer) {
          this.updateStatus({ message: new MarkdownString(localize("extension enabled on remote", "Extension is enabled on '{0}'", this.extension.server.label)) }, true);
          return;
        }
      }
      if (this.extension.enablementState === EnablementState.EnabledGlobally) {
        return;
      }
    }
    if (!isEnabled && !isRunning) {
      if (this.extension.enablementState === EnablementState.DisabledGlobally) {
        this.updateStatus({ message: new MarkdownString(localize("globally disabled", "This extension is disabled globally by the user.")) }, true);
        return;
      }
      if (this.extension.enablementState === EnablementState.DisabledWorkspace) {
        this.updateStatus({ message: new MarkdownString(localize("workspace disabled", "This extension is disabled for this workspace by the user.")) }, true);
        return;
      }
    }
  }
  updateStatus(status, updateClass) {
    if (status) {
      if (this._status.some((s) => s.message.value === status.message.value && s.icon?.id === status.icon?.id)) {
        return;
      }
    } else {
      if (this._status.length === 0) {
        return;
      }
      this._status = [];
    }
    if (status) {
      this._status.push(status);
      this._status.sort(
        (a, b) => b.icon === trustIcon ? -1 : a.icon === trustIcon ? 1 : b.icon === errorIcon ? -1 : a.icon === errorIcon ? 1 : b.icon === warningIcon ? -1 : a.icon === warningIcon ? 1 : b.icon === infoIcon ? -1 : a.icon === infoIcon ? 1 : 0
      );
    }
    if (updateClass) {
      if (status?.icon === errorIcon) {
        this.class = `${ExtensionStatusAction.CLASS} extension-status-error ${ThemeIcon.asClassName(errorIcon)}`;
      } else if (status?.icon === warningIcon) {
        this.class = `${ExtensionStatusAction.CLASS} extension-status-warning ${ThemeIcon.asClassName(warningIcon)}`;
      } else if (status?.icon === infoIcon) {
        this.class = `${ExtensionStatusAction.CLASS} extension-status-info ${ThemeIcon.asClassName(infoIcon)}`;
      } else if (status?.icon === trustIcon) {
        this.class = `${ExtensionStatusAction.CLASS} ${ThemeIcon.asClassName(trustIcon)}`;
      } else {
        this.class = `${ExtensionStatusAction.CLASS} hide`;
      }
    }
    this._onDidChangeStatus.fire();
  }
  async run() {
    if (this._status[0]?.icon === trustIcon) {
      return this.commandService.executeCommand("workbench.trust.manage");
    }
  }
};
ExtensionStatusAction.CLASS = `${ExtensionAction.ICON_ACTION_CLASS} extension-status`;
ExtensionStatusAction = __decorateClass([
  __decorateParam(0, IExtensionManagementServerService),
  __decorateParam(1, ILabelService),
  __decorateParam(2, ICommandService),
  __decorateParam(3, IWorkspaceTrustEnablementService),
  __decorateParam(4, IWorkspaceTrustManagementService),
  __decorateParam(5, IExtensionsWorkbenchService),
  __decorateParam(6, IExtensionService),
  __decorateParam(7, IExtensionManifestPropertiesService),
  __decorateParam(8, IWorkspaceContextService),
  __decorateParam(9, IProductService),
  __decorateParam(10, IAllowedExtensionsService),
  __decorateParam(11, IWorkbenchExtensionEnablementService),
  __decorateParam(12, IExtensionFeaturesManagementService),
  __decorateParam(13, IExtensionGalleryManifestService)
], ExtensionStatusAction);
let InstallSpecificVersionOfExtensionAction = class extends Action {
  constructor(id = InstallSpecificVersionOfExtensionAction.ID, label = InstallSpecificVersionOfExtensionAction.LABEL, extensionsWorkbenchService, quickInputService, instantiationService, extensionEnablementService) {
    super(id, label);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.quickInputService = quickInputService;
    this.instantiationService = instantiationService;
    this.extensionEnablementService = extensionEnablementService;
  }
  get enabled() {
    return this.extensionsWorkbenchService.local.some((l) => this.isEnabled(l));
  }
  async run() {
    const extensionPick = await this.quickInputService.pick(this.getExtensionEntries(), { placeHolder: localize("selectExtension", "Select Extension"), matchOnDetail: true });
    if (extensionPick && extensionPick.extension) {
      const action = this.instantiationService.createInstance(InstallAnotherVersionAction, extensionPick.extension, true);
      await action.run();
      await this.extensionsWorkbenchService.openSearch(extensionPick.extension.identifier.id);
    }
  }
  isEnabled(extension) {
    const action = this.instantiationService.createInstance(InstallAnotherVersionAction, extension, true);
    return action.enabled && !!extension.local && this.extensionEnablementService.isEnabled(extension.local);
  }
  async getExtensionEntries() {
    const installed = await this.extensionsWorkbenchService.queryLocal();
    const entries = [];
    for (const extension of installed) {
      if (this.isEnabled(extension)) {
        entries.push({
          id: extension.identifier.id,
          label: extension.displayName || extension.identifier.id,
          description: extension.identifier.id,
          extension
        });
      }
    }
    return entries.sort((e1, e2) => e1.extension.displayName.localeCompare(e2.extension.displayName));
  }
};
InstallSpecificVersionOfExtensionAction.ID = "workbench.extensions.action.install.specificVersion";
InstallSpecificVersionOfExtensionAction.LABEL = localize("install previous version", "Install Specific Version of Extension...");
InstallSpecificVersionOfExtensionAction = __decorateClass([
  __decorateParam(2, IExtensionsWorkbenchService),
  __decorateParam(3, IQuickInputService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IWorkbenchExtensionEnablementService)
], InstallSpecificVersionOfExtensionAction);
let AbstractInstallExtensionsInServerAction = class extends Action {
  constructor(id, extensionsWorkbenchService, quickInputService, notificationService, progressService) {
    super(id);
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.quickInputService = quickInputService;
    this.notificationService = notificationService;
    this.progressService = progressService;
    this.extensions = void 0;
    this.update();
    this.extensionsWorkbenchService.queryLocal().then(() => this.updateExtensions());
    this._register(this.extensionsWorkbenchService.onChange(() => {
      if (this.extensions) {
        this.updateExtensions();
      }
    }));
  }
  updateExtensions() {
    this.extensions = this.extensionsWorkbenchService.local;
    this.update();
  }
  update() {
    this.enabled = !!this.extensions && this.getExtensionsToInstall(this.extensions).length > 0;
    this.tooltip = this.label;
  }
  async run() {
    return this.selectAndInstallExtensions();
  }
  async queryExtensionsToInstall() {
    const local = await this.extensionsWorkbenchService.queryLocal();
    return this.getExtensionsToInstall(local);
  }
  async selectAndInstallExtensions() {
    const quickPick = this.quickInputService.createQuickPick();
    quickPick.busy = true;
    const disposable = quickPick.onDidAccept(() => {
      disposable.dispose();
      quickPick.hide();
      quickPick.dispose();
      this.onDidAccept(quickPick.selectedItems);
    });
    quickPick.show();
    const localExtensionsToInstall = await this.queryExtensionsToInstall();
    quickPick.busy = false;
    if (localExtensionsToInstall.length) {
      quickPick.title = this.getQuickPickTitle();
      quickPick.placeholder = localize("select extensions to install", "Select extensions to install");
      quickPick.canSelectMany = true;
      localExtensionsToInstall.sort((e1, e2) => e1.displayName.localeCompare(e2.displayName));
      quickPick.items = localExtensionsToInstall.map((extension) => ({ extension, label: extension.displayName, description: extension.version }));
    } else {
      quickPick.hide();
      quickPick.dispose();
      this.notificationService.notify({
        severity: Severity.Info,
        message: localize("no local extensions", "There are no extensions to install.")
      });
    }
  }
  async onDidAccept(selectedItems) {
    if (selectedItems.length) {
      const localExtensionsToInstall = selectedItems.filter((r) => !!r.extension).map((r) => r.extension);
      if (localExtensionsToInstall.length) {
        await this.progressService.withProgress(
          {
            location: ProgressLocation.Notification,
            title: localize("installing extensions", "Installing Extensions...")
          },
          () => this.installExtensions(localExtensionsToInstall)
        );
        this.notificationService.info(localize("finished installing", "Successfully installed extensions."));
      }
    }
  }
};
AbstractInstallExtensionsInServerAction = __decorateClass([
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IProgressService)
], AbstractInstallExtensionsInServerAction);
let InstallLocalExtensionsInRemoteAction = class extends AbstractInstallExtensionsInServerAction {
  constructor(extensionsWorkbenchService, quickInputService, progressService, notificationService, extensionManagementServerService, extensionGalleryService, instantiationService, fileService, logService) {
    super("workbench.extensions.actions.installLocalExtensionsInRemote", extensionsWorkbenchService, quickInputService, notificationService, progressService);
    this.extensionManagementServerService = extensionManagementServerService;
    this.extensionGalleryService = extensionGalleryService;
    this.instantiationService = instantiationService;
    this.fileService = fileService;
    this.logService = logService;
  }
  get label() {
    if (this.extensionManagementServerService && this.extensionManagementServerService.remoteExtensionManagementServer) {
      return localize("select and install local extensions", "Install Local Extensions in '{0}'...", this.extensionManagementServerService.remoteExtensionManagementServer.label);
    }
    return "";
  }
  getQuickPickTitle() {
    return localize("install local extensions title", "Install Local Extensions in '{0}'", this.extensionManagementServerService.remoteExtensionManagementServer.label);
  }
  getExtensionsToInstall(local) {
    return local.filter((extension) => {
      const action = this.instantiationService.createInstance(RemoteInstallAction, true);
      action.extension = extension;
      return action.enabled;
    });
  }
  async installExtensions(localExtensionsToInstall) {
    const galleryExtensions = [];
    const vsixs = [];
    const targetPlatform = await this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.getTargetPlatform();
    await Promises.settled(localExtensionsToInstall.map(async (extension) => {
      if (this.extensionGalleryService.isEnabled()) {
        const gallery = (await this.extensionGalleryService.getExtensions([{ ...extension.identifier, preRelease: !!extension.local?.preRelease }], { targetPlatform, compatible: true }, CancellationToken.None))[0];
        if (gallery) {
          galleryExtensions.push(gallery);
          return;
        }
      }
      const vsix = await this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.zip(extension.local);
      vsixs.push(vsix);
    }));
    await Promises.settled(galleryExtensions.map((gallery) => this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.installFromGallery(gallery)));
    try {
      await Promises.settled(vsixs.map((vsix) => this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.install(vsix)));
    } finally {
      try {
        await Promise.allSettled(vsixs.map((vsix) => this.fileService.del(vsix)));
      } catch (error) {
        this.logService.error(error);
      }
    }
  }
};
InstallLocalExtensionsInRemoteAction = __decorateClass([
  __decorateParam(0, IExtensionsWorkbenchService),
  __decorateParam(1, IQuickInputService),
  __decorateParam(2, IProgressService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, IExtensionManagementServerService),
  __decorateParam(5, IExtensionGalleryService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IFileService),
  __decorateParam(8, ILogService)
], InstallLocalExtensionsInRemoteAction);
let InstallRemoteExtensionsInLocalAction = class extends AbstractInstallExtensionsInServerAction {
  constructor(id, extensionsWorkbenchService, quickInputService, progressService, notificationService, extensionManagementServerService, extensionGalleryService, fileService, logService) {
    super(id, extensionsWorkbenchService, quickInputService, notificationService, progressService);
    this.extensionManagementServerService = extensionManagementServerService;
    this.extensionGalleryService = extensionGalleryService;
    this.fileService = fileService;
    this.logService = logService;
  }
  get label() {
    return localize("select and install remote extensions", "Install Remote Extensions Locally...");
  }
  getQuickPickTitle() {
    return localize("install remote extensions", "Install Remote Extensions Locally");
  }
  getExtensionsToInstall(local) {
    return local.filter((extension) => extension.type === ExtensionType.User && extension.server !== this.extensionManagementServerService.localExtensionManagementServer && !this.extensionsWorkbenchService.installed.some((e) => e.server === this.extensionManagementServerService.localExtensionManagementServer && areSameExtensions(e.identifier, extension.identifier)));
  }
  async installExtensions(extensions) {
    const galleryExtensions = [];
    const vsixs = [];
    const targetPlatform = await this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.getTargetPlatform();
    await Promises.settled(extensions.map(async (extension) => {
      if (this.extensionGalleryService.isEnabled()) {
        const gallery = (await this.extensionGalleryService.getExtensions([{ ...extension.identifier, preRelease: !!extension.local?.preRelease }], { targetPlatform, compatible: true }, CancellationToken.None))[0];
        if (gallery) {
          galleryExtensions.push(gallery);
          return;
        }
      }
      const vsix = await this.extensionManagementServerService.remoteExtensionManagementServer.extensionManagementService.zip(extension.local);
      vsixs.push(vsix);
    }));
    await Promises.settled(galleryExtensions.map((gallery) => this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.installFromGallery(gallery)));
    try {
      await Promises.settled(vsixs.map((vsix) => this.extensionManagementServerService.localExtensionManagementServer.extensionManagementService.install(vsix)));
    } finally {
      try {
        await Promise.allSettled(vsixs.map((vsix) => this.fileService.del(vsix)));
      } catch (error) {
        this.logService.error(error);
      }
    }
  }
};
InstallRemoteExtensionsInLocalAction = __decorateClass([
  __decorateParam(1, IExtensionsWorkbenchService),
  __decorateParam(2, IQuickInputService),
  __decorateParam(3, IProgressService),
  __decorateParam(4, INotificationService),
  __decorateParam(5, IExtensionManagementServerService),
  __decorateParam(6, IExtensionGalleryService),
  __decorateParam(7, IFileService),
  __decorateParam(8, ILogService)
], InstallRemoteExtensionsInLocalAction);
CommandsRegistry.registerCommand("workbench.extensions.action.showExtensionsForLanguage", function(accessor, fileExtension) {
  const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
  return extensionsWorkbenchService.openSearch(`ext:${fileExtension.replace(/^\./, "")}`);
});
const showExtensionsWithIdsCommandId = "workbench.extensions.action.showExtensionsWithIds";
CommandsRegistry.registerCommand(showExtensionsWithIdsCommandId, function(accessor, extensionIds) {
  const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
  return extensionsWorkbenchService.openSearch(extensionIds.map((id) => `@id:${id}`).join(" "));
});
registerColor("extensionButton.background", {
  dark: buttonBackground,
  light: buttonBackground,
  hcDark: null,
  hcLight: null
}, localize("extensionButtonBackground", "Button background color for extension actions."));
registerColor("extensionButton.foreground", {
  dark: buttonForeground,
  light: buttonForeground,
  hcDark: null,
  hcLight: null
}, localize("extensionButtonForeground", "Button foreground color for extension actions."));
registerColor("extensionButton.hoverBackground", {
  dark: buttonHoverBackground,
  light: buttonHoverBackground,
  hcDark: null,
  hcLight: null
}, localize("extensionButtonHoverBackground", "Button background hover color for extension actions."));
registerColor("extensionButton.separator", buttonSeparator, localize("extensionButtonSeparator", "Button separator color for extension actions"));
const extensionButtonProminentBackground = registerColor("extensionButton.prominentBackground", {
  dark: buttonBackground,
  light: buttonBackground,
  hcDark: null,
  hcLight: null
}, localize("extensionButtonProminentBackground", "Button background color for extension actions that stand out (e.g. install button)."));
registerColor("extensionButton.prominentForeground", {
  dark: buttonForeground,
  light: buttonForeground,
  hcDark: null,
  hcLight: null
}, localize("extensionButtonProminentForeground", "Button foreground color for extension actions that stand out (e.g. install button)."));
registerColor("extensionButton.prominentHoverBackground", {
  dark: buttonHoverBackground,
  light: buttonHoverBackground,
  hcDark: null,
  hcLight: null
}, localize("extensionButtonProminentHoverBackground", "Button background hover color for extension actions that stand out (e.g. install button)."));
registerThemingParticipant((theme, collector) => {
  const errorColor = theme.getColor(editorErrorForeground);
  if (errorColor) {
    collector.addRule(`.extension-editor .header .actions-status-container > .status ${ThemeIcon.asCSSSelector(errorIcon)} { color: ${errorColor}; }`);
    collector.addRule(`.extension-editor .body .subcontent .runtime-status ${ThemeIcon.asCSSSelector(errorIcon)} { color: ${errorColor}; }`);
    collector.addRule(`.monaco-hover.extension-hover .markdown-hover .hover-contents ${ThemeIcon.asCSSSelector(errorIcon)} { color: ${errorColor}; }`);
  }
  const warningColor = theme.getColor(editorWarningForeground);
  if (warningColor) {
    collector.addRule(`.extension-editor .header .actions-status-container > .status ${ThemeIcon.asCSSSelector(warningIcon)} { color: ${warningColor}; }`);
    collector.addRule(`.extension-editor .body .subcontent .runtime-status ${ThemeIcon.asCSSSelector(warningIcon)} { color: ${warningColor}; }`);
    collector.addRule(`.monaco-hover.extension-hover .markdown-hover .hover-contents ${ThemeIcon.asCSSSelector(warningIcon)} { color: ${warningColor}; }`);
  }
  const infoColor = theme.getColor(editorInfoForeground);
  if (infoColor) {
    collector.addRule(`.extension-editor .header .actions-status-container > .status ${ThemeIcon.asCSSSelector(infoIcon)} { color: ${infoColor}; }`);
    collector.addRule(`.extension-editor .body .subcontent .runtime-status ${ThemeIcon.asCSSSelector(infoIcon)} { color: ${infoColor}; }`);
    collector.addRule(`.monaco-hover.extension-hover .markdown-hover .hover-contents ${ThemeIcon.asCSSSelector(infoIcon)} { color: ${infoColor}; }`);
  }
});
export {
  AbstractConfigureRecommendedExtensionsAction,
  AbstractInstallExtensionsInServerAction,
  ButtonWithDropDownExtensionAction,
  ButtonWithDropdownExtensionActionViewItem,
  ClearLanguageAction,
  ConfigureWorkspaceFolderRecommendedExtensionsAction,
  ConfigureWorkspaceRecommendedExtensionsAction,
  DisableDropDownAction,
  DisableForWorkspaceAction,
  DisableGloballyAction,
  DropDownExtensionAction,
  DropDownExtensionActionViewItem,
  EnableDropDownAction,
  EnableForWorkspaceAction,
  EnableGloballyAction,
  ExtensionAction,
  ExtensionEditorManageExtensionAction,
  ExtensionRuntimeStateAction,
  ExtensionStatusAction,
  ExtensionStatusLabelAction,
  IgnoreExtensionRecommendationAction,
  InstallAction,
  InstallAnotherVersionAction,
  InstallDropdownAction,
  InstallInOtherServerAction,
  InstallLocalExtensionsInRemoteAction,
  InstallRecommendedExtensionAction,
  InstallRemoteExtensionsInLocalAction,
  InstallSpecificVersionOfExtensionAction,
  InstallingLabelAction,
  LocalInstallAction,
  ManageExtensionAction,
  MenuItemExtensionAction,
  MigrateDeprecatedExtensionAction,
  PromptExtensionInstallFailureAction,
  RemoteInstallAction,
  SetColorThemeAction,
  SetFileIconThemeAction,
  SetLanguageAction,
  SetProductIconThemeAction,
  ShowRecommendedExtensionAction,
  ToggleAutoUpdateForExtensionAction,
  ToggleAutoUpdatesForPublisherAction,
  TogglePreReleaseExtensionAction,
  ToggleSyncExtensionAction,
  UndoIgnoreExtensionRecommendationAction,
  UninstallAction,
  UpdateAction,
  WebInstallAction,
  extensionButtonProminentBackground,
  getContextMenuActions,
  showExtensionsWithIdsCommandId
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2Jyb3dzZXIvZXh0ZW5zaW9uc0FjdGlvbnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgJy4vbWVkaWEvZXh0ZW5zaW9uQWN0aW9ucy5jc3MnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQWN0aW9uLCBBY3Rpb24sIFNlcGFyYXRvciwgU3VibWVudUFjdGlvbiwgSUFjdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBEZWxheWVyLCBQcm9taXNlcywgVGhyb3R0bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0ICogYXMgRE9NIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgKiBhcyBqc29uIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb24uanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgZGlzcG9zZUlmRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uLCBFeHRlbnNpb25TdGF0ZSwgSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLCBJRXh0ZW5zaW9uQ29udGFpbmVyLCBUT0dHTEVfSUdOT1JFX0VYVEVOU0lPTl9BQ1RJT05fSUQsIFNFTEVDVF9JTlNUQUxMX1ZTSVhfRVhURU5TSU9OX0NPTU1BTkRfSUQsIFRIRU1FX0FDVElPTlNfR1JPVVAsIElOU1RBTExfQUNUSU9OU19HUk9VUCwgVVBEQVRFX0FDVElPTlNfR1JPVVAsIEV4dGVuc2lvbkVkaXRvclRhYiwgRXh0ZW5zaW9uUnVudGltZUFjdGlvblR5cGUsIElFeHRlbnNpb25BcmcsIEF1dG9VcGRhdGVDb25maWd1cmF0aW9uS2V5IH0gZnJvbSAnLi4vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uc0NvbmZpZ3VyYXRpb25Jbml0aWFsQ29udGVudCB9IGZyb20gJy4uL2NvbW1vbi9leHRlbnNpb25zRmlsZVRlbXBsYXRlLmpzJztcbmltcG9ydCB7IElHYWxsZXJ5RXh0ZW5zaW9uLCBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UsIElMb2NhbEV4dGVuc2lvbiwgSW5zdGFsbE9wdGlvbnMsIEluc3RhbGxPcGVyYXRpb24sIEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUsIElBbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50LmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSwgRW5hYmxlbWVudFN0YXRlLCBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UsIElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyLCBJV29ya2JlbmNoRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblJlY29tbWVuZGF0aW9uUmVhc29uLCBJRXh0ZW5zaW9uSWdub3JlZFJlY29tbWVuZGF0aW9uc1NlcnZpY2UsIElFeHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zL2NvbW1vbi9leHRlbnNpb25SZWNvbW1lbmRhdGlvbnMuanMnO1xuaW1wb3J0IHsgYXJlU2FtZUV4dGVuc2lvbnMsIGdldEV4dGVuc2lvbklkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudFV0aWwuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uVHlwZSwgRXh0ZW5zaW9uSWRlbnRpZmllciwgSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBJRXh0ZW5zaW9uTWFuaWZlc3QsIGlzTGFuZ3VhZ2VQYWNrRXh0ZW5zaW9uLCBnZXRXb3Jrc3BhY2VTdXBwb3J0VHlwZU1lc3NhZ2UsIFRhcmdldFBsYXRmb3JtLCBpc0FwcGxpY2F0aW9uU2NvcGVkRXh0ZW5zaW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSwgSUZpbGVDb250ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgV29ya2JlbmNoU3RhdGUsIElXb3Jrc3BhY2VGb2xkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJSG9zdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9ob3N0L2Jyb3dzZXIvaG9zdC5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSwgdG9FeHRlbnNpb24sIHRvRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBDb21tYW5kc1JlZ2lzdHJ5LCBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyByZWdpc3RlclRoZW1pbmdQYXJ0aWNpcGFudCwgSUNvbG9yVGhlbWUsIElDc3NTdHlsZUNvbGxlY3RvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IGJ1dHRvbkJhY2tncm91bmQsIGJ1dHRvbkZvcmVncm91bmQsIGJ1dHRvbkhvdmVyQmFja2dyb3VuZCwgcmVnaXN0ZXJDb2xvciwgZWRpdG9yV2FybmluZ0ZvcmVncm91bmQsIGVkaXRvckluZm9Gb3JlZ3JvdW5kLCBlZGl0b3JFcnJvckZvcmVncm91bmQsIGJ1dHRvblNlcGFyYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElKU09ORWRpdGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9jb25maWd1cmF0aW9uL2NvbW1vbi9qc29uRWRpdGluZy5qcyc7XG5pbXBvcnQgeyBJVGV4dEVkaXRvclNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBNZW51SWQsIElNZW51U2VydmljZSwgTWVudUl0ZW1BY3Rpb24sIFN1Ym1lbnVJdGVtQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBQSUNLX1dPUktTUEFDRV9GT0xERVJfQ09NTUFORF9JRCB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvYWN0aW9ucy93b3Jrc3BhY2VDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgSVByb21wdENob2ljZSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElRdWlja1BpY2tJdGVtLCBJUXVpY2tJbnB1dFNlcnZpY2UsIFF1aWNrUGlja0l0ZW0gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IGFsZXJ0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FyaWEvYXJpYS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoVGhlbWVTZXJ2aWNlLCBJV29ya2JlbmNoVGhlbWUsIElXb3JrYmVuY2hDb2xvclRoZW1lLCBJV29ya2JlbmNoRmlsZUljb25UaGVtZSwgSVdvcmtiZW5jaFByb2R1Y3RJY29uVGhlbWUgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy90aGVtZXMvY29tbW9uL3dvcmtiZW5jaFRoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IElUZXh0RmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy90ZXh0ZmlsZS9jb21tb24vdGV4dGZpbGVzLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlLCBJUHJvbXB0QnV0dG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJUHJvZ3Jlc3NTZXJ2aWNlLCBQcm9ncmVzc0xvY2F0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IElBY3Rpb25WaWV3SXRlbU9wdGlvbnMsIEFjdGlvblZpZXdJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL3VpL2FjdGlvbmJhci9hY3Rpb25WaWV3SXRlbXMuanMnO1xuaW1wb3J0IHsgRVhURU5TSU9OU19DT05GSUcsIElFeHRlbnNpb25zQ29uZmlnQ29udGVudCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvblJlY29tbWVuZGF0aW9ucy9jb21tb24vd29ya3NwYWNlRXh0ZW5zaW9uc0NvbmZpZy5qcyc7XG5pbXBvcnQgeyBnZXRFcnJvck1lc3NhZ2UsIGlzQ2FuY2VsbGF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGFTeW5jL2NvbW1vbi91c2VyRGF0YVN5bmMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRNZW51UHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvY29udGV4dG1lbnUuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBlcnJvckljb24sIGluZm9JY29uLCBtYW5hZ2VFeHRlbnNpb25JY29uLCBzeW5jRW5hYmxlZEljb24sIHN5bmNJZ25vcmVkSWNvbiwgdHJ1c3RJY29uLCB3YXJuaW5nSWNvbiB9IGZyb20gJy4vZXh0ZW5zaW9uc0ljb25zLmpzJztcbmltcG9ydCB7IGlzSU9TLCBpc1dlYiwgbGFuZ3VhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZVRydXN0RW5hYmxlbWVudFNlcnZpY2UsIElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2VUcnVzdC5qcyc7XG5pbXBvcnQgeyBpc1ZpcnR1YWxXb3Jrc3BhY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3ZpcnR1YWxXb3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgZXNjYXBlTWFya2Rvd25TeW50YXhUb2tlbnMsIElNYXJrZG93blN0cmluZywgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBmcm9tTm93IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZGF0ZS5qcyc7XG5pbXBvcnQgeyBJUHJlZmVyZW5jZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzLmpzJztcbmltcG9ydCB7IGdldExvY2FsZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xhbmd1YWdlUGFja3MvY29tbW9uL2xhbmd1YWdlUGFja3MuanMnO1xuaW1wb3J0IHsgSUxvY2FsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9sb2NhbGl6YXRpb24vY29tbW9uL2xvY2FsZS5qcyc7XG5pbXBvcnQgeyBpc1N0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IHNob3dXaW5kb3dMb2dBY3Rpb25JZCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xvZy9jb21tb24vbG9nQ29uc3RhbnRzLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucywgSUV4dGVuc2lvbkZlYXR1cmVzTWFuYWdlbWVudFNlcnZpY2UsIElFeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVVwZGF0ZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91cGRhdGUvY29tbW9uL3VwZGF0ZS5qcyc7XG5pbXBvcnQgeyBBY3Rpb25XaXRoRHJvcGRvd25BY3Rpb25WaWV3SXRlbSwgSUFjdGlvbldpdGhEcm9wZG93bkFjdGlvblZpZXdJdGVtT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9kcm9wZG93bi9kcm9wZG93bkFjdGlvblZpZXdJdGVtLmpzJztcbmltcG9ydCB7IElBdXRoZW50aWNhdGlvblVzYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2F1dGhlbnRpY2F0aW9uL2Jyb3dzZXIvYXV0aGVudGljYXRpb25Vc2FnZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QuanMnO1xuXG5leHBvcnQgY2xhc3MgUHJvbXB0RXh0ZW5zaW9uSW5zdGFsbEZhaWx1cmVBY3Rpb24gZXh0ZW5kcyBBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgb3B0aW9uczogSW5zdGFsbE9wdGlvbnMgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSB2ZXJzaW9uOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBpbnN0YWxsT3BlcmF0aW9uOiBJbnN0YWxsT3BlcmF0aW9uLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZXJyb3I6IEVycm9yLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJT3BlbmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG9wZW5lclNlcnZpY2U6IElPcGVuZXJTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZTogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBnYWxsZXJ5U2VydmljZTogSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2U6IElFeHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcignZXh0ZW5zaW9uLnByb21wdEV4dGVuc2lvbkluc3RhbGxGYWlsdXJlJyk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKGlzQ2FuY2VsbGF0aW9uRXJyb3IodGhpcy5lcnJvcikpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IodGhpcy5lcnJvcik7XG5cblx0XHRpZiAodGhpcy5lcnJvci5uYW1lID09PSBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3JDb2RlLlVuc3VwcG9ydGVkKSB7XG5cdFx0XHRjb25zdCBwcm9kdWN0TmFtZSA9IGlzV2ViID8gbG9jYWxpemUoJ1ZTIENvZGUgZm9yIFdlYicsIFwiezB9IGZvciB0aGUgV2ViXCIsIHRoaXMucHJvZHVjdFNlcnZpY2UubmFtZUxvbmcpIDogdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lTG9uZztcblx0XHRcdGNvbnN0IG1lc3NhZ2UgPSBsb2NhbGl6ZSgnY2Fubm90IGJlIGluc3RhbGxlZCcsIFwiVGhlICd7MH0nIGV4dGVuc2lvbiBpcyBub3QgYXZhaWxhYmxlIGluIHsxfS4gQ2xpY2sgJ01vcmUgSW5mb3JtYXRpb24nIHRvIGxlYXJuIG1vcmUuXCIsIHRoaXMuZXh0ZW5zaW9uLmRpc3BsYXlOYW1lIHx8IHRoaXMuZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQsIHByb2R1Y3ROYW1lKTtcblx0XHRcdGNvbnN0IHsgY29uZmlybWVkIH0gPSBhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRcdHR5cGU6IFNldmVyaXR5LkluZm8sXG5cdFx0XHRcdG1lc3NhZ2UsXG5cdFx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKHsga2V5OiAnbW9yZSBpbmZvcm1hdGlvbicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJk1vcmUgSW5mb3JtYXRpb25cIiksXG5cdFx0XHRcdGNhbmNlbEJ1dHRvbjogbG9jYWxpemUoJ2Nsb3NlJywgXCJDbG9zZVwiKVxuXHRcdFx0fSk7XG5cdFx0XHRpZiAoY29uZmlybWVkKSB7XG5cdFx0XHRcdHRoaXMub3BlbmVyU2VydmljZS5vcGVuKGlzV2ViID8gVVJJLnBhcnNlKCdodHRwczovL2FrYS5tcy92c2NvZGUtd2ViLWV4dGVuc2lvbnMtZ3VpZGUnKSA6IFVSSS5wYXJzZSgnaHR0cHM6Ly9ha2EubXMvdnNjb2RlLXJlbW90ZScpKTtcblx0XHRcdH1cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZS5SZWxlYXNlVmVyc2lvbk5vdEZvdW5kID09PSAoPEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGU+dGhpcy5lcnJvci5uYW1lKSkge1xuXHRcdFx0YXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLnByb21wdCh7XG5cdFx0XHRcdHR5cGU6ICdlcnJvcicsXG5cdFx0XHRcdG1lc3NhZ2U6IGdldEVycm9yTWVzc2FnZSh0aGlzLmVycm9yKSxcblx0XHRcdFx0YnV0dG9uczogW3tcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2luc3RhbGwgcHJlcmVsZWFzZScsIFwiSW5zdGFsbCBQcmUtUmVsZWFzZVwiKSxcblx0XHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGluc3RhbGxBY3Rpb24gPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEluc3RhbGxBY3Rpb24sIHsgaW5zdGFsbFByZVJlbGVhc2VWZXJzaW9uOiB0cnVlIH0pO1xuXHRcdFx0XHRcdFx0aW5zdGFsbEFjdGlvbi5leHRlbnNpb24gPSB0aGlzLmV4dGVuc2lvbjtcblx0XHRcdFx0XHRcdHJldHVybiBpbnN0YWxsQWN0aW9uLnJ1bigpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fV0sXG5cdFx0XHRcdGNhbmNlbEJ1dHRvbjogbG9jYWxpemUoJ2NhbmNlbCcsIFwiQ2FuY2VsXCIpXG5cdFx0XHR9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoW0V4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUuSW5jb21wYXRpYmxlLCBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3JDb2RlLkluY29tcGF0aWJsZUFwaSwgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZS5JbmNvbXBhdGlibGVUYXJnZXRQbGF0Zm9ybSwgRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZS5NYWxpY2lvdXMsIEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUuRGVwcmVjYXRlZF0uaW5jbHVkZXMoPEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGU+dGhpcy5lcnJvci5uYW1lKSkge1xuXHRcdFx0YXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLmluZm8oZ2V0RXJyb3JNZXNzYWdlKHRoaXMuZXJyb3IpKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoRXh0ZW5zaW9uTWFuYWdlbWVudEVycm9yQ29kZS5QYWNrYWdlTm90U2lnbmVkID09PSAoPEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGU+dGhpcy5lcnJvci5uYW1lKSkge1xuXHRcdFx0YXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLnByb21wdCh7XG5cdFx0XHRcdHR5cGU6ICdlcnJvcicsXG5cdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCdub3Qgc2lnbmVkJywgXCInezB9JyBpcyBhbiBleHRlbnNpb24gZnJvbSBhbiB1bmtub3duIHNvdXJjZS4gQXJlIHlvdSBzdXJlIHlvdSB3YW50IHRvIGluc3RhbGw/XCIsIHRoaXMuZXh0ZW5zaW9uLmRpc3BsYXlOYW1lKSxcblx0XHRcdFx0ZGV0YWlsOiBnZXRFcnJvck1lc3NhZ2UodGhpcy5lcnJvciksXG5cdFx0XHRcdGJ1dHRvbnM6IFt7XG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdpbnN0YWxsIGFueXdheScsIFwiSW5zdGFsbCBBbnl3YXlcIiksXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBpbnN0YWxsQWN0aW9uID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShJbnN0YWxsQWN0aW9uLCB7IC4uLnRoaXMub3B0aW9ucywgZG9ub3RWZXJpZnlTaWduYXR1cmU6IHRydWUsIH0pO1xuXHRcdFx0XHRcdFx0aW5zdGFsbEFjdGlvbi5leHRlbnNpb24gPSB0aGlzLmV4dGVuc2lvbjtcblx0XHRcdFx0XHRcdHJldHVybiBpbnN0YWxsQWN0aW9uLnJ1bigpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fV0sXG5cdFx0XHRcdGNhbmNlbEJ1dHRvbjogdHJ1ZVxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGUuU2lnbmF0dXJlVmVyaWZpY2F0aW9uRmFpbGVkID09PSAoPEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGU+dGhpcy5lcnJvci5uYW1lKSB8fCBFeHRlbnNpb25NYW5hZ2VtZW50RXJyb3JDb2RlLlNpZ25hdHVyZVZlcmlmaWNhdGlvbkludGVybmFsID09PSAoPEV4dGVuc2lvbk1hbmFnZW1lbnRFcnJvckNvZGU+dGhpcy5lcnJvci5uYW1lKSkge1xuXHRcdFx0YXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLnByb21wdCh7XG5cdFx0XHRcdHR5cGU6ICdlcnJvcicsXG5cdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCd2ZXJpZmljYXRpb24gZmFpbGVkJywgXCJDYW5ub3QgaW5zdGFsbCAnezB9JyBleHRlbnNpb24gYmVjYXVzZSB7MX0gY2Fubm90IHZlcmlmeSB0aGUgZXh0ZW5zaW9uIHNpZ25hdHVyZVwiLCB0aGlzLmV4dGVuc2lvbi5kaXNwbGF5TmFtZSwgdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lTG9uZyksXG5cdFx0XHRcdGRldGFpbDogZ2V0RXJyb3JNZXNzYWdlKHRoaXMuZXJyb3IpLFxuXHRcdFx0XHRidXR0b25zOiBbe1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnbGVhcm4gbW9yZScsIFwiTGVhcm4gTW9yZVwiKSxcblx0XHRcdFx0XHRydW46ICgpID0+IHRoaXMub3BlbmVyU2VydmljZS5vcGVuKCdodHRwczovL2NvZGUudmlzdWFsc3R1ZGlvLmNvbS9kb2NzL2VkaXRvci9leHRlbnNpb24tbWFya2V0cGxhY2UjX3RoZS1leHRlbnNpb24tc2lnbmF0dXJlLWNhbm5vdC1iZS12ZXJpZmllZC1ieS12cy1jb2RlJylcblx0XHRcdFx0fSwge1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnaW5zdGFsbCBkb25vdCB2ZXJpZnknLCBcIkluc3RhbGwgQW55d2F5IChEb24ndCBWZXJpZnkgU2lnbmF0dXJlKVwiKSxcblx0XHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGluc3RhbGxBY3Rpb24gPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEluc3RhbGxBY3Rpb24sIHsgLi4udGhpcy5vcHRpb25zLCBkb25vdFZlcmlmeVNpZ25hdHVyZTogdHJ1ZSwgfSk7XG5cdFx0XHRcdFx0XHRpbnN0YWxsQWN0aW9uLmV4dGVuc2lvbiA9IHRoaXMuZXh0ZW5zaW9uO1xuXHRcdFx0XHRcdFx0cmV0dXJuIGluc3RhbGxBY3Rpb24ucnVuKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XSxcblx0XHRcdFx0Y2FuY2VsQnV0dG9uOiB0cnVlXG5cdFx0XHR9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBvcGVyYXRpb25NZXNzYWdlID0gdGhpcy5pbnN0YWxsT3BlcmF0aW9uID09PSBJbnN0YWxsT3BlcmF0aW9uLlVwZGF0ZSA/IGxvY2FsaXplKCd1cGRhdGUgb3BlcmF0aW9uJywgXCJFcnJvciB3aGlsZSB1cGRhdGluZyAnezB9JyBleHRlbnNpb24uXCIsIHRoaXMuZXh0ZW5zaW9uLmRpc3BsYXlOYW1lIHx8IHRoaXMuZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQpXG5cdFx0XHQ6IGxvY2FsaXplKCdpbnN0YWxsIG9wZXJhdGlvbicsIFwiRXJyb3Igd2hpbGUgaW5zdGFsbGluZyAnezB9JyBleHRlbnNpb24uXCIsIHRoaXMuZXh0ZW5zaW9uLmRpc3BsYXlOYW1lIHx8IHRoaXMuZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQpO1xuXHRcdGxldCBhZGRpdGlvbmFsTWVzc2FnZTtcblx0XHRjb25zdCBwcm9tcHRDaG9pY2VzOiBJUHJvbXB0Q2hvaWNlW10gPSBbXTtcblxuXHRcdGNvbnN0IGRvd25sb2FkVXJsID0gYXdhaXQgdGhpcy5nZXREb3dubG9hZFVybCgpO1xuXHRcdGlmIChkb3dubG9hZFVybCkge1xuXHRcdFx0YWRkaXRpb25hbE1lc3NhZ2UgPSBsb2NhbGl6ZSgnY2hlY2sgbG9ncycsIFwiUGxlYXNlIGNoZWNrIHRoZSBbbG9nXSh7MH0pIGZvciBtb3JlIGRldGFpbHMuXCIsIGBjb21tYW5kOiR7c2hvd1dpbmRvd0xvZ0FjdGlvbklkfWApO1xuXHRcdFx0cHJvbXB0Q2hvaWNlcy5wdXNoKHtcblx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdkb3dubG9hZCcsIFwiVHJ5IERvd25sb2FkaW5nIE1hbnVhbGx5Li4uXCIpLFxuXHRcdFx0XHRydW46ICgpID0+IHRoaXMub3BlbmVyU2VydmljZS5vcGVuKGRvd25sb2FkVXJsKS50aGVuKCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFxuXHRcdFx0XHRcdFx0U2V2ZXJpdHkuSW5mbyxcblx0XHRcdFx0XHRcdGxvY2FsaXplKCdpbnN0YWxsIHZzaXgnLCAnT25jZSBkb3dubG9hZGVkLCBwbGVhc2UgbWFudWFsbHkgaW5zdGFsbCB0aGUgZG93bmxvYWRlZCBWU0lYIG9mIFxcJ3swfVxcJy4nLCB0aGlzLmV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKSxcblx0XHRcdFx0XHRcdFt7XG5cdFx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnaW5zdGFsbFZTSVgnLCBcIkluc3RhbGwgZnJvbSBWU0lYLi4uXCIpLFxuXHRcdFx0XHRcdFx0XHRydW46ICgpID0+IHRoaXMuY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoU0VMRUNUX0lOU1RBTExfVlNJWF9FWFRFTlNJT05fQ09NTUFORF9JRClcblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fSlcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1lc3NhZ2UgPSBgJHtvcGVyYXRpb25NZXNzYWdlfSR7YWRkaXRpb25hbE1lc3NhZ2UgPyBgICR7YWRkaXRpb25hbE1lc3NhZ2V9YCA6ICcnfWA7XG5cdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLnByb21wdChTZXZlcml0eS5FcnJvciwgbWVzc2FnZSwgcHJvbXB0Q2hvaWNlcyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldERvd25sb2FkVXJsKCk6IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKGlzSU9TKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uLmdhbGxlcnkpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmICghdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5sb2NhbEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIgJiYgIXRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcikge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0bGV0IHRhcmdldFBsYXRmb3JtID0gdGhpcy5leHRlbnNpb24uZ2FsbGVyeS5wcm9wZXJ0aWVzLnRhcmdldFBsYXRmb3JtO1xuXHRcdGlmICh0YXJnZXRQbGF0Zm9ybSAhPT0gVGFyZ2V0UGxhdGZvcm0uVU5JVkVSU0FMICYmIHRhcmdldFBsYXRmb3JtICE9PSBUYXJnZXRQbGF0Zm9ybS5VTkRFRklORUQgJiYgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5yZW1vdGVFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyKSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBtYW5pZmVzdCA9IGF3YWl0IHRoaXMuZ2FsbGVyeVNlcnZpY2UuZ2V0TWFuaWZlc3QodGhpcy5leHRlbnNpb24uZ2FsbGVyeSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRcdGlmIChtYW5pZmVzdCAmJiB0aGlzLmV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UucHJlZmVyc0V4ZWN1dGVPbldvcmtzcGFjZShtYW5pZmVzdCkpIHtcblx0XHRcdFx0XHR0YXJnZXRQbGF0Zm9ybSA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlci5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRUYXJnZXRQbGF0Zm9ybSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAodGFyZ2V0UGxhdGZvcm0gPT09IFRhcmdldFBsYXRmb3JtLlVOS05PV04pIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgW2V4dGVuc2lvbl0gPSBhd2FpdCB0aGlzLmdhbGxlcnlTZXJ2aWNlLmdldEV4dGVuc2lvbnMoW3tcblx0XHRcdC4uLnRoaXMuZXh0ZW5zaW9uLmlkZW50aWZpZXIsXG5cdFx0XHR2ZXJzaW9uOiB0aGlzLnZlcnNpb25cblx0XHR9XSwge1xuXHRcdFx0dGFyZ2V0UGxhdGZvcm1cblx0XHR9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblxuXHRcdGlmICghZXh0ZW5zaW9uKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gVVJJLnBhcnNlKGV4dGVuc2lvbi5hc3NldHMuZG93bmxvYWQudXJpKTtcblx0fVxuXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUV4dGVuc2lvbkFjdGlvbkNoYW5nZUV2ZW50IGV4dGVuZHMgSUFjdGlvbkNoYW5nZUV2ZW50IHtcblx0cmVhZG9ubHkgaGlkZGVuPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgbWVudUFjdGlvbnM/OiBJQWN0aW9uW107XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBFeHRlbnNpb25BY3Rpb24gZXh0ZW5kcyBBY3Rpb24gaW1wbGVtZW50cyBJRXh0ZW5zaW9uQ29udGFpbmVyIHtcblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgX29uRGlkQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SUV4dGVuc2lvbkFjdGlvbkNoYW5nZUV2ZW50PigpKTtcblx0b3ZlcnJpZGUgcmVhZG9ubHkgb25EaWRDaGFuZ2UgPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRzdGF0aWMgcmVhZG9ubHkgRVhURU5TSU9OX0FDVElPTl9DTEFTUyA9ICdleHRlbnNpb24tYWN0aW9uJztcblx0c3RhdGljIHJlYWRvbmx5IFRFWFRfQUNUSU9OX0NMQVNTID0gYCR7RXh0ZW5zaW9uQWN0aW9uLkVYVEVOU0lPTl9BQ1RJT05fQ0xBU1N9IHRleHRgO1xuXHRzdGF0aWMgcmVhZG9ubHkgTEFCRUxfQUNUSU9OX0NMQVNTID0gYCR7RXh0ZW5zaW9uQWN0aW9uLkVYVEVOU0lPTl9BQ1RJT05fQ0xBU1N9IGxhYmVsYDtcblx0c3RhdGljIHJlYWRvbmx5IFBST01JTkVOVF9MQUJFTF9BQ1RJT05fQ0xBU1MgPSBgJHtFeHRlbnNpb25BY3Rpb24uTEFCRUxfQUNUSU9OX0NMQVNTfSBwcm9taW5lbnRgO1xuXHRzdGF0aWMgcmVhZG9ubHkgSUNPTl9BQ1RJT05fQ0xBU1MgPSBgJHtFeHRlbnNpb25BY3Rpb24uRVhURU5TSU9OX0FDVElPTl9DTEFTU30gaWNvbmA7XG5cblx0cHJpdmF0ZSBfZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uIHwgbnVsbCA9IG51bGw7XG5cdGdldCBleHRlbnNpb24oKTogSUV4dGVuc2lvbiB8IG51bGwgeyByZXR1cm4gdGhpcy5fZXh0ZW5zaW9uOyB9XG5cdHNldCBleHRlbnNpb24oZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uIHwgbnVsbCkgeyB0aGlzLl9leHRlbnNpb24gPSBleHRlbnNpb247IHRoaXMudXBkYXRlKCk7IH1cblxuXHRwcml2YXRlIF9oaWRkZW46IGJvb2xlYW4gPSBmYWxzZTtcblx0Z2V0IGhpZGRlbigpOiBib29sZWFuIHsgcmV0dXJuIHRoaXMuX2hpZGRlbjsgfVxuXHRzZXQgaGlkZGVuKGhpZGRlbjogYm9vbGVhbikge1xuXHRcdGlmICh0aGlzLl9oaWRkZW4gIT09IGhpZGRlbikge1xuXHRcdFx0dGhpcy5faGlkZGVuID0gaGlkZGVuO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh7IGhpZGRlbiB9KTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgX3NldEVuYWJsZWQodmFsdWU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRzdXBlci5fc2V0RW5hYmxlZCh2YWx1ZSk7XG5cdFx0aWYgKHRoaXMuaGlkZU9uRGlzYWJsZWQpIHtcblx0XHRcdHRoaXMuaGlkZGVuID0gIXZhbHVlO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBoaWRlT25EaXNhYmxlZDogYm9vbGVhbiA9IHRydWU7XG5cblx0YWJzdHJhY3QgdXBkYXRlKCk6IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBCdXR0b25XaXRoRHJvcERvd25FeHRlbnNpb25BY3Rpb24gZXh0ZW5kcyBFeHRlbnNpb25BY3Rpb24ge1xuXG5cdHByaXZhdGUgcHJpbWFyeUFjdGlvbjogSUFjdGlvbiB8IHVuZGVmaW5lZDtcblxuXHRyZWFkb25seSBtZW51QWN0aW9uQ2xhc3NOYW1lczogc3RyaW5nW10gPSBbXTtcblx0cHJpdmF0ZSBfbWVudUFjdGlvbnM6IElBY3Rpb25bXSA9IFtdO1xuXHRnZXQgbWVudUFjdGlvbnMoKTogSUFjdGlvbltdIHsgcmV0dXJuIFsuLi50aGlzLl9tZW51QWN0aW9uc107IH1cblxuXHRvdmVycmlkZSBnZXQgZXh0ZW5zaW9uKCk6IElFeHRlbnNpb24gfCBudWxsIHtcblx0XHRyZXR1cm4gc3VwZXIuZXh0ZW5zaW9uO1xuXHR9XG5cblx0b3ZlcnJpZGUgc2V0IGV4dGVuc2lvbihleHRlbnNpb246IElFeHRlbnNpb24gfCBudWxsKSB7XG5cdFx0dGhpcy5leHRlbnNpb25BY3Rpb25zLmZvckVhY2goYSA9PiBhLmV4dGVuc2lvbiA9IGV4dGVuc2lvbik7XG5cdFx0c3VwZXIuZXh0ZW5zaW9uID0gZXh0ZW5zaW9uO1xuXHR9XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IGV4dGVuc2lvbkFjdGlvbnM6IEV4dGVuc2lvbkFjdGlvbltdO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGlkOiBzdHJpbmcsXG5cdFx0Y2xheno6IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IGFjdGlvbnNHcm91cHM6IEV4dGVuc2lvbkFjdGlvbltdW10sXG5cdCkge1xuXHRcdGNsYXp6ID0gYCR7Y2xhenp9IGFjdGlvbi1kcm9wZG93bmA7XG5cdFx0c3VwZXIoaWQsIHVuZGVmaW5lZCwgY2xhenopO1xuXHRcdHRoaXMubWVudUFjdGlvbkNsYXNzTmFtZXMgPSBjbGF6ei5zcGxpdCgnICcpO1xuXHRcdHRoaXMuaGlkZU9uRGlzYWJsZWQgPSBmYWxzZTtcblx0XHR0aGlzLmV4dGVuc2lvbkFjdGlvbnMgPSBhY3Rpb25zR3JvdXBzLmZsYXQoKTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmFueSguLi50aGlzLmV4dGVuc2lvbkFjdGlvbnMubWFwKGEgPT4gYS5vbkRpZENoYW5nZSkpKCgpID0+IHRoaXMudXBkYXRlKHRydWUpKSk7XG5cdFx0dGhpcy5leHRlbnNpb25BY3Rpb25zLmZvckVhY2goYSA9PiB0aGlzLl9yZWdpc3RlcihhKSk7XG5cdH1cblxuXHR1cGRhdGUoZG9ub3RVcGRhdGVBY3Rpb25zPzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICghZG9ub3RVcGRhdGVBY3Rpb25zKSB7XG5cdFx0XHR0aGlzLmV4dGVuc2lvbkFjdGlvbnMuZm9yRWFjaChhID0+IGEudXBkYXRlKCkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGlvbnNHcm91cHMgPSB0aGlzLmFjdGlvbnNHcm91cHMubWFwKGFjdGlvbnNHcm91cCA9PiBhY3Rpb25zR3JvdXAuZmlsdGVyKGEgPT4gIWEuaGlkZGVuKSk7XG5cblx0XHRsZXQgYWN0aW9uczogSUFjdGlvbltdID0gW107XG5cdFx0Zm9yIChjb25zdCB2aXNpYmxlQWN0aW9ucyBvZiBhY3Rpb25zR3JvdXBzKSB7XG5cdFx0XHRpZiAodmlzaWJsZUFjdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHRcdGFjdGlvbnMgPSBbLi4uYWN0aW9ucywgLi4udmlzaWJsZUFjdGlvbnMsIG5ldyBTZXBhcmF0b3IoKV07XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGFjdGlvbnMgPSBhY3Rpb25zLmxlbmd0aCA/IGFjdGlvbnMuc2xpY2UoMCwgYWN0aW9ucy5sZW5ndGggLSAxKSA6IGFjdGlvbnM7XG5cblx0XHR0aGlzLnByaW1hcnlBY3Rpb24gPSBhY3Rpb25zWzBdO1xuXHRcdHRoaXMuX21lbnVBY3Rpb25zID0gYWN0aW9ucy5sZW5ndGggPiAxID8gYWN0aW9ucyA6IFtdO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoeyBtZW51QWN0aW9uczogdGhpcy5fbWVudUFjdGlvbnMgfSk7XG5cblx0XHRpZiAodGhpcy5wcmltYXJ5QWN0aW9uKSB7XG5cdFx0XHR0aGlzLmhpZGRlbiA9IGZhbHNlO1xuXHRcdFx0dGhpcy5lbmFibGVkID0gdGhpcy5wcmltYXJ5QWN0aW9uLmVuYWJsZWQ7XG5cdFx0XHR0aGlzLmxhYmVsID0gdGhpcy5nZXRMYWJlbCh0aGlzLnByaW1hcnlBY3Rpb24gYXMgRXh0ZW5zaW9uQWN0aW9uKTtcblx0XHRcdHRoaXMudG9vbHRpcCA9IHRoaXMucHJpbWFyeUFjdGlvbi50b29sdGlwO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmhpZGRlbiA9IHRydWU7XG5cdFx0XHR0aGlzLmVuYWJsZWQgPSBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKHRoaXMuZW5hYmxlZCkge1xuXHRcdFx0YXdhaXQgdGhpcy5wcmltYXJ5QWN0aW9uPy5ydW4oKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0TGFiZWwoYWN0aW9uOiBFeHRlbnNpb25BY3Rpb24pOiBzdHJpbmcge1xuXHRcdHJldHVybiBhY3Rpb24ubGFiZWw7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEJ1dHRvbldpdGhEcm9wZG93bkV4dGVuc2lvbkFjdGlvblZpZXdJdGVtIGV4dGVuZHMgQWN0aW9uV2l0aERyb3Bkb3duQWN0aW9uVmlld0l0ZW0ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGFjdGlvbjogQnV0dG9uV2l0aERyb3BEb3duRXh0ZW5zaW9uQWN0aW9uLFxuXHRcdG9wdGlvbnM6IElBY3Rpb25WaWV3SXRlbU9wdGlvbnMgJiBJQWN0aW9uV2l0aERyb3Bkb3duQWN0aW9uVmlld0l0ZW1PcHRpb25zLFxuXHRcdGNvbnRleHRNZW51UHJvdmlkZXI6IElDb250ZXh0TWVudVByb3ZpZGVyXG5cdCkge1xuXHRcdHN1cGVyKG51bGwsIGFjdGlvbiwgb3B0aW9ucywgY29udGV4dE1lbnVQcm92aWRlcik7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWN0aW9uLm9uRGlkQ2hhbmdlKGUgPT4ge1xuXHRcdFx0aWYgKGUuaGlkZGVuICE9PSB1bmRlZmluZWQgfHwgZS5tZW51QWN0aW9ucyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlQ2xhc3MoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRvdmVycmlkZSByZW5kZXIoY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IHZvaWQge1xuXHRcdHN1cGVyLnJlbmRlcihjb250YWluZXIpO1xuXHRcdHRoaXMudXBkYXRlQ2xhc3MoKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSB1cGRhdGVDbGFzcygpOiB2b2lkIHtcblx0XHRzdXBlci51cGRhdGVDbGFzcygpO1xuXHRcdGlmICh0aGlzLmVsZW1lbnQgJiYgdGhpcy5kcm9wZG93bk1lbnVBY3Rpb25WaWV3SXRlbT8uZWxlbWVudCkge1xuXHRcdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ2hpZGUnLCAoPEJ1dHRvbldpdGhEcm9wRG93bkV4dGVuc2lvbkFjdGlvbj50aGlzLl9hY3Rpb24pLmhpZGRlbik7XG5cdFx0XHRjb25zdCBpc01lbnVFbXB0eSA9ICg8QnV0dG9uV2l0aERyb3BEb3duRXh0ZW5zaW9uQWN0aW9uPnRoaXMuX2FjdGlvbikubWVudUFjdGlvbnMubGVuZ3RoID09PSAwO1xuXHRcdFx0dGhpcy5lbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ2VtcHR5JywgaXNNZW51RW1wdHkpO1xuXHRcdFx0dGhpcy5kcm9wZG93bk1lbnVBY3Rpb25WaWV3SXRlbS5lbGVtZW50LmNsYXNzTGlzdC50b2dnbGUoJ2hpZGUnLCBpc01lbnVFbXB0eSk7XG5cdFx0fVxuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIEluc3RhbGxBY3Rpb24gZXh0ZW5kcyBFeHRlbnNpb25BY3Rpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBDTEFTUyA9IGAke3RoaXMuTEFCRUxfQUNUSU9OX0NMQVNTfSBwcm9taW5lbnQgaW5zdGFsbGA7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEhJREUgPSBgJHt0aGlzLkNMQVNTfSBoaWRlYDtcblxuXHRwcm90ZWN0ZWQgX21hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QgfCBudWxsID0gbnVsbDtcblx0c2V0IG1hbmlmZXN0KG1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QgfCBudWxsKSB7XG5cdFx0dGhpcy5fbWFuaWZlc3QgPSBtYW5pZmVzdDtcblx0XHR0aGlzLnVwZGF0ZUxhYmVsKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IHVwZGF0ZVRocm90dGxlciA9IG5ldyBUaHJvdHRsZXIoKTtcblx0cHVibGljIHJlYWRvbmx5IG9wdGlvbnM6IEluc3RhbGxPcHRpb25zO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG9wdGlvbnM6IEluc3RhbGxPcHRpb25zLFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHJ1bnRpbWVFeHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASVdvcmtiZW5jaFRoZW1lU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtiZW5jaFRoZW1lU2VydmljZTogSVdvcmtiZW5jaFRoZW1lU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASVByZWZlcmVuY2VzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHByZWZlcmVuY2VzU2VydmljZTogSVByZWZlcmVuY2VzU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUFsbG93ZWRFeHRlbnNpb25zU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGFsbG93ZWRFeHRlbnNpb25zU2VydmljZTogSUFsbG93ZWRFeHRlbnNpb25zU2VydmljZSxcblx0XHRASUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlOiBJRXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoJ2V4dGVuc2lvbnMuaW5zdGFsbCcsIGxvY2FsaXplKCdpbnN0YWxsJywgXCJJbnN0YWxsXCIpLCBJbnN0YWxsQWN0aW9uLkNMQVNTLCBmYWxzZSk7XG5cdFx0dGhpcy5oaWRlT25EaXNhYmxlZCA9IGZhbHNlO1xuXHRcdHRoaXMub3B0aW9ucyA9IHsgaXNNYWNoaW5lU2NvcGVkOiBmYWxzZSwgLi4ub3B0aW9ucyB9O1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlLm9uRGlkQ2hhbmdlQWxsb3dlZEV4dGVuc2lvbnNDb25maWdWYWx1ZSgoKSA9PiB0aGlzLnVwZGF0ZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5sYWJlbFNlcnZpY2Uub25EaWRDaGFuZ2VGb3JtYXR0ZXJzKCgpID0+IHRoaXMudXBkYXRlTGFiZWwoKSwgdGhpcykpO1xuXHR9XG5cblx0dXBkYXRlKCk6IHZvaWQge1xuXHRcdHRoaXMudXBkYXRlVGhyb3R0bGVyLnF1ZXVlKCgpID0+IHRoaXMuY29tcHV0ZUFuZFVwZGF0ZUVuYWJsZW1lbnQoKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgY29tcHV0ZUFuZFVwZGF0ZUVuYWJsZW1lbnQoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5lbmFibGVkID0gZmFsc2U7XG5cdFx0dGhpcy5jbGFzcyA9IEluc3RhbGxBY3Rpb24uSElERTtcblx0XHR0aGlzLmhpZGRlbiA9IHRydWU7XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5leHRlbnNpb24uaXNCdWlsdGluKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmNhblNldExhbmd1YWdlKHRoaXMuZXh0ZW5zaW9uKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5leHRlbnNpb24uc3RhdGUgIT09IEV4dGVuc2lvblN0YXRlLlVuaW5zdGFsbGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLm9wdGlvbnMuaW5zdGFsbFByZVJlbGVhc2VWZXJzaW9uICYmICghdGhpcy5leHRlbnNpb24uaGFzUHJlUmVsZWFzZVZlcnNpb24gfHwgdGhpcy5hbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UuaXNBbGxvd2VkKHsgaWQ6IHRoaXMuZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQsIHB1Ymxpc2hlckRpc3BsYXlOYW1lOiB0aGlzLmV4dGVuc2lvbi5wdWJsaXNoZXJEaXNwbGF5TmFtZSwgcHJlcmVsZWFzZTogdHJ1ZSB9KSAhPT0gdHJ1ZSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLm9wdGlvbnMuaW5zdGFsbFByZVJlbGVhc2VWZXJzaW9uICYmICF0aGlzLmV4dGVuc2lvbi5oYXNSZWxlYXNlVmVyc2lvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLmhpZGRlbiA9IGZhbHNlO1xuXHRcdHRoaXMuY2xhc3MgPSBJbnN0YWxsQWN0aW9uLkNMQVNTO1xuXHRcdGlmIChhd2FpdCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmNhbkluc3RhbGwodGhpcy5leHRlbnNpb24pID09PSB0cnVlKSB7XG5cdFx0XHR0aGlzLmVuYWJsZWQgPSB0cnVlO1xuXHRcdFx0dGhpcy51cGRhdGVMYWJlbCgpO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bigpOiBQcm9taXNlPGFueT4ge1xuXHRcdGlmICghdGhpcy5leHRlbnNpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5leHRlbnNpb24uZ2FsbGVyeSAmJiAhdGhpcy5leHRlbnNpb24uZ2FsbGVyeS5pc1NpZ25lZCAmJiAoYXdhaXQgdGhpcy5leHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlLmdldEV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCgpKT8uY2FwYWJpbGl0aWVzLnNpZ25pbmc/LmFsbFJlcG9zaXRvcnlTaWduZWQpIHtcblx0XHRcdGNvbnN0IHsgcmVzdWx0IH0gPSBhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UucHJvbXB0KHtcblx0XHRcdFx0dHlwZTogU2V2ZXJpdHkuV2FybmluZyxcblx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ25vdCBzaWduZWQnLCBcIid7MH0nIGlzIGFuIGV4dGVuc2lvbiBmcm9tIGFuIHVua25vd24gc291cmNlLiBBcmUgeW91IHN1cmUgeW91IHdhbnQgdG8gaW5zdGFsbD9cIiwgdGhpcy5leHRlbnNpb24uZGlzcGxheU5hbWUpLFxuXHRcdFx0XHRkZXRhaWw6IGxvY2FsaXplKCdub3Qgc2lnbmVkIGRldGFpbCcsIFwiRXh0ZW5zaW9uIGlzIG5vdCBzaWduZWQuXCIpLFxuXHRcdFx0XHRidXR0b25zOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdpbnN0YWxsIGFueXdheScsIFwiSW5zdGFsbCBBbnl3YXlcIiksXG5cdFx0XHRcdFx0XHRydW46ICgpID0+IHtcblx0XHRcdFx0XHRcdFx0dGhpcy5vcHRpb25zLmRvbm90VmVyaWZ5U2lnbmF0dXJlID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRjYW5jZWxCdXR0b246IHtcblx0XHRcdFx0XHRydW46ICgpID0+IGZhbHNlXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLmV4dGVuc2lvbi5kZXByZWNhdGlvbkluZm8pIHtcblx0XHRcdGxldCBkZXRhaWw6IHN0cmluZyB8IE1hcmtkb3duU3RyaW5nID0gbG9jYWxpemUoJ2RlcHJlY2F0ZWQgbWVzc2FnZScsIFwiVGhpcyBleHRlbnNpb24gaXMgZGVwcmVjYXRlZCBhcyBpdCBpcyBubyBsb25nZXIgYmVpbmcgbWFpbnRhaW5lZC5cIik7XG5cdFx0XHRlbnVtIERlcHJlY2F0aW9uQ2hvaWNlIHtcblx0XHRcdFx0SW5zdGFsbEFueXdheSA9IDAsXG5cdFx0XHRcdFNob3dBbHRlcm5hdGVFeHRlbnNpb24gPSAxLFxuXHRcdFx0XHRDb25maWd1cmVTZXR0aW5ncyA9IDIsXG5cdFx0XHRcdENhbmNlbCA9IDNcblx0XHRcdH1cblx0XHRcdGNvbnN0IGJ1dHRvbnM6IElQcm9tcHRCdXR0b248RGVwcmVjYXRpb25DaG9pY2U+W10gPSBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2luc3RhbGwgYW55d2F5JywgXCJJbnN0YWxsIEFueXdheVwiKSxcblx0XHRcdFx0XHRydW46ICgpID0+IERlcHJlY2F0aW9uQ2hvaWNlLkluc3RhbGxBbnl3YXlcblx0XHRcdFx0fVxuXHRcdFx0XTtcblxuXHRcdFx0aWYgKHRoaXMuZXh0ZW5zaW9uLmRlcHJlY2F0aW9uSW5mby5leHRlbnNpb24pIHtcblx0XHRcdFx0ZGV0YWlsID0gbG9jYWxpemUoJ2RlcHJlY2F0ZWQgd2l0aCBhbHRlcm5hdGUgZXh0ZW5zaW9uIG1lc3NhZ2UnLCBcIlRoaXMgZXh0ZW5zaW9uIGlzIGRlcHJlY2F0ZWQuIFVzZSB0aGUgezB9IGV4dGVuc2lvbiBpbnN0ZWFkLlwiLCB0aGlzLmV4dGVuc2lvbi5kZXByZWNhdGlvbkluZm8uZXh0ZW5zaW9uLmRpc3BsYXlOYW1lKTtcblxuXHRcdFx0XHRjb25zdCBhbHRlcm5hdGVFeHRlbnNpb24gPSB0aGlzLmV4dGVuc2lvbi5kZXByZWNhdGlvbkluZm8uZXh0ZW5zaW9uO1xuXHRcdFx0XHRidXR0b25zLnB1c2goe1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSh7IGtleTogJ1Nob3cgYWx0ZXJuYXRlIGV4dGVuc2lvbicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJk9wZW4gezB9XCIsIHRoaXMuZXh0ZW5zaW9uLmRlcHJlY2F0aW9uSW5mby5leHRlbnNpb24uZGlzcGxheU5hbWUpLFxuXHRcdFx0XHRcdHJ1bjogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgW2V4dGVuc2lvbl0gPSBhd2FpdCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmdldEV4dGVuc2lvbnMoW3sgaWQ6IGFsdGVybmF0ZUV4dGVuc2lvbi5pZCwgcHJlUmVsZWFzZTogYWx0ZXJuYXRlRXh0ZW5zaW9uLnByZVJlbGVhc2UgfV0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5vcGVuKGV4dGVuc2lvbik7XG5cblx0XHRcdFx0XHRcdHJldHVybiBEZXByZWNhdGlvbkNob2ljZS5TaG93QWx0ZXJuYXRlRXh0ZW5zaW9uO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuZXh0ZW5zaW9uLmRlcHJlY2F0aW9uSW5mby5zZXR0aW5ncykge1xuXHRcdFx0XHRkZXRhaWwgPSBsb2NhbGl6ZSgnZGVwcmVjYXRlZCB3aXRoIGFsdGVybmF0ZSBzZXR0aW5ncyBtZXNzYWdlJywgXCJUaGlzIGV4dGVuc2lvbiBpcyBkZXByZWNhdGVkIGFzIHRoaXMgZnVuY3Rpb25hbGl0eSBpcyBub3cgYnVpbHQtaW4gdG8gVlMgQ29kZS5cIik7XG5cblx0XHRcdFx0Y29uc3Qgc2V0dGluZ3MgPSB0aGlzLmV4dGVuc2lvbi5kZXByZWNhdGlvbkluZm8uc2V0dGluZ3M7XG5cdFx0XHRcdGJ1dHRvbnMucHVzaCh7XG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKHsga2V5OiAnY29uZmlndXJlIGluIHNldHRpbmdzJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmQ29uZmlndXJlIFNldHRpbmdzXCIpLFxuXHRcdFx0XHRcdHJ1bjogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy5wcmVmZXJlbmNlc1NlcnZpY2Uub3BlblNldHRpbmdzKHsgcXVlcnk6IHNldHRpbmdzLm1hcChzZXR0aW5nID0+IGBAaWQ6JHtzZXR0aW5nfWApLmpvaW4oJyAnKSB9KTtcblxuXHRcdFx0XHRcdFx0cmV0dXJuIERlcHJlY2F0aW9uQ2hvaWNlLkNvbmZpZ3VyZVNldHRpbmdzO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuZXh0ZW5zaW9uLmRlcHJlY2F0aW9uSW5mby5hZGRpdGlvbmFsSW5mbykge1xuXHRcdFx0XHRkZXRhaWwgPSBuZXcgTWFya2Rvd25TdHJpbmcoYCR7ZGV0YWlsfSAke3RoaXMuZXh0ZW5zaW9uLmRlcHJlY2F0aW9uSW5mby5hZGRpdGlvbmFsSW5mb31gKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgeyByZXN1bHQgfSA9IGF3YWl0IHRoaXMuZGlhbG9nU2VydmljZS5wcm9tcHQoe1xuXHRcdFx0XHR0eXBlOiBTZXZlcml0eS5XYXJuaW5nLFxuXHRcdFx0XHRtZXNzYWdlOiBsb2NhbGl6ZSgnaW5zdGFsbCBjb25maXJtYXRpb24nLCBcIkFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBpbnN0YWxsICd7MH0nP1wiLCB0aGlzLmV4dGVuc2lvbi5kaXNwbGF5TmFtZSksXG5cdFx0XHRcdGRldGFpbDogaXNTdHJpbmcoZGV0YWlsKSA/IGRldGFpbCA6IHVuZGVmaW5lZCxcblx0XHRcdFx0Y3VzdG9tOiBpc1N0cmluZyhkZXRhaWwpID8gdW5kZWZpbmVkIDoge1xuXHRcdFx0XHRcdG1hcmtkb3duRGV0YWlsczogW3tcblx0XHRcdFx0XHRcdG1hcmtkb3duOiBkZXRhaWxcblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRidXR0b25zLFxuXHRcdFx0XHRjYW5jZWxCdXR0b246IHtcblx0XHRcdFx0XHRydW46ICgpID0+IERlcHJlY2F0aW9uQ2hvaWNlLkNhbmNlbFxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdGlmIChyZXN1bHQgIT09IERlcHJlY2F0aW9uQ2hvaWNlLkluc3RhbGxBbnl3YXkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub3Blbih0aGlzLmV4dGVuc2lvbiwgeyBzaG93UHJlUmVsZWFzZVZlcnNpb246IHRoaXMub3B0aW9ucy5pbnN0YWxsUHJlUmVsZWFzZVZlcnNpb24gfSk7XG5cblx0XHRhbGVydChsb2NhbGl6ZSgnaW5zdGFsbEV4dGVuc2lvblN0YXJ0JywgXCJJbnN0YWxsaW5nIGV4dGVuc2lvbiB7MH0gc3RhcnRlZC4gQW4gZWRpdG9yIGlzIG5vdyBvcGVuIHdpdGggbW9yZSBkZXRhaWxzIG9uIHRoaXMgZXh0ZW5zaW9uXCIsIHRoaXMuZXh0ZW5zaW9uLmRpc3BsYXlOYW1lKSk7XG5cblx0XHQvKiBfX0dEUFJfX1xuXHRcdFx0XCJleHRlbnNpb25zOmFjdGlvbjppbnN0YWxsXCIgOiB7XG5cdFx0XHRcdFwib3duZXJcIjogXCJzYW5keTA4MVwiLFxuXHRcdFx0XHRcImFjdGlvbklkXCIgOiB7IFwiY2xhc3NpZmljYXRpb25cIjogXCJTeXN0ZW1NZXRhRGF0YVwiLCBcInB1cnBvc2VcIjogXCJGZWF0dXJlSW5zaWdodFwiIH0sXG5cdFx0XHRcdFwiJHtpbmNsdWRlfVwiOiBbXG5cdFx0XHRcdFx0XCIke0dhbGxlcnlFeHRlbnNpb25UZWxlbWV0cnlEYXRhfVwiXG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHQqL1xuXHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2coJ2V4dGVuc2lvbnM6YWN0aW9uOmluc3RhbGwnLCB7IC4uLnRoaXMuZXh0ZW5zaW9uLnRlbGVtZXRyeURhdGEsIGFjdGlvbklkOiB0aGlzLmlkIH0pO1xuXG5cdFx0Y29uc3QgZXh0ZW5zaW9uID0gYXdhaXQgdGhpcy5pbnN0YWxsKHRoaXMuZXh0ZW5zaW9uKTtcblxuXHRcdGlmIChleHRlbnNpb24/LmxvY2FsKSB7XG5cdFx0XHRhbGVydChsb2NhbGl6ZSgnaW5zdGFsbEV4dGVuc2lvbkNvbXBsZXRlJywgXCJJbnN0YWxsaW5nIGV4dGVuc2lvbiB7MH0gaXMgY29tcGxldGVkLlwiLCB0aGlzLmV4dGVuc2lvbi5kaXNwbGF5TmFtZSkpO1xuXHRcdFx0Y29uc3QgcnVubmluZ0V4dGVuc2lvbiA9IGF3YWl0IHRoaXMuZ2V0UnVubmluZ0V4dGVuc2lvbihleHRlbnNpb24ubG9jYWwpO1xuXHRcdFx0aWYgKHJ1bm5pbmdFeHRlbnNpb24gJiYgIShydW5uaW5nRXh0ZW5zaW9uLmFjdGl2YXRpb25FdmVudHMgJiYgcnVubmluZ0V4dGVuc2lvbi5hY3RpdmF0aW9uRXZlbnRzLnNvbWUoYWN0aXZhdGlvbkVlbnQgPT4gYWN0aXZhdGlvbkVlbnQuc3RhcnRzV2l0aCgnb25MYW5ndWFnZScpKSkpIHtcblx0XHRcdFx0Y29uc3QgYWN0aW9uID0gYXdhaXQgdGhpcy5nZXRUaGVtZUFjdGlvbihleHRlbnNpb24pO1xuXHRcdFx0XHRpZiAoYWN0aW9uKSB7XG5cdFx0XHRcdFx0YWN0aW9uLmV4dGVuc2lvbiA9IGV4dGVuc2lvbjtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGFjdGlvbi5ydW4oeyBzaG93Q3VycmVudFRoZW1lOiB0cnVlLCBpZ25vcmVGb2N1c0xvc3Q6IHRydWUgfSk7XG5cdFx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHRcdGFjdGlvbi5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldFRoZW1lQWN0aW9uKGV4dGVuc2lvbjogSUV4dGVuc2lvbik6IFByb21pc2U8RXh0ZW5zaW9uQWN0aW9uIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgY29sb3JUaGVtZXMgPSBhd2FpdCB0aGlzLndvcmtiZW5jaFRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lcygpO1xuXHRcdGlmIChjb2xvclRoZW1lcy5zb21lKHRoZW1lID0+IGlzVGhlbWVGcm9tRXh0ZW5zaW9uKHRoZW1lLCBleHRlbnNpb24pKSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2V0Q29sb3JUaGVtZUFjdGlvbik7XG5cdFx0fVxuXHRcdGNvbnN0IGZpbGVJY29uVGhlbWVzID0gYXdhaXQgdGhpcy53b3JrYmVuY2hUaGVtZVNlcnZpY2UuZ2V0RmlsZUljb25UaGVtZXMoKTtcblx0XHRpZiAoZmlsZUljb25UaGVtZXMuc29tZSh0aGVtZSA9PiBpc1RoZW1lRnJvbUV4dGVuc2lvbih0aGVtZSwgZXh0ZW5zaW9uKSkpIHtcblx0XHRcdHJldHVybiB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNldEZpbGVJY29uVGhlbWVBY3Rpb24pO1xuXHRcdH1cblx0XHRjb25zdCBwcm9kdWN0SWNvblRoZW1lcyA9IGF3YWl0IHRoaXMud29ya2JlbmNoVGhlbWVTZXJ2aWNlLmdldFByb2R1Y3RJY29uVGhlbWVzKCk7XG5cdFx0aWYgKHByb2R1Y3RJY29uVGhlbWVzLnNvbWUodGhlbWUgPT4gaXNUaGVtZUZyb21FeHRlbnNpb24odGhlbWUsIGV4dGVuc2lvbikpKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZXRQcm9kdWN0SWNvblRoZW1lQWN0aW9uKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaW5zdGFsbChleHRlbnNpb246IElFeHRlbnNpb24pOiBQcm9taXNlPElFeHRlbnNpb24gfCB1bmRlZmluZWQ+IHtcblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuaW5zdGFsbChleHRlbnNpb24sIHRoaXMub3B0aW9ucyk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGF3YWl0IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUHJvbXB0RXh0ZW5zaW9uSW5zdGFsbEZhaWx1cmVBY3Rpb24sIGV4dGVuc2lvbiwgdGhpcy5vcHRpb25zLCBleHRlbnNpb24ubGF0ZXN0VmVyc2lvbiwgSW5zdGFsbE9wZXJhdGlvbi5JbnN0YWxsLCBlcnJvcikucnVuKCk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0UnVubmluZ0V4dGVuc2lvbihleHRlbnNpb246IElMb2NhbEV4dGVuc2lvbik6IFByb21pc2U8SUV4dGVuc2lvbkRlc2NyaXB0aW9uIHwgbnVsbD4ge1xuXHRcdGNvbnN0IHJ1bm5pbmdFeHRlbnNpb24gPSBhd2FpdCB0aGlzLnJ1bnRpbWVFeHRlbnNpb25TZXJ2aWNlLmdldEV4dGVuc2lvbihleHRlbnNpb24uaWRlbnRpZmllci5pZCk7XG5cdFx0aWYgKHJ1bm5pbmdFeHRlbnNpb24pIHtcblx0XHRcdHJldHVybiBydW5uaW5nRXh0ZW5zaW9uO1xuXHRcdH1cblx0XHRpZiAodGhpcy5ydW50aW1lRXh0ZW5zaW9uU2VydmljZS5jYW5BZGRFeHRlbnNpb24odG9FeHRlbnNpb25EZXNjcmlwdGlvbihleHRlbnNpb24pKSkge1xuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPElFeHRlbnNpb25EZXNjcmlwdGlvbiB8IG51bGw+KChjLCBlKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSB0aGlzLnJ1bnRpbWVFeHRlbnNpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlRXh0ZW5zaW9ucyhhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgcnVubmluZ0V4dGVuc2lvbiA9IGF3YWl0IHRoaXMucnVudGltZUV4dGVuc2lvblNlcnZpY2UuZ2V0RXh0ZW5zaW9uKGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKTtcblx0XHRcdFx0XHRpZiAocnVubmluZ0V4dGVuc2lvbikge1xuXHRcdFx0XHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHRjKHJ1bm5pbmdFeHRlbnNpb24pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRwcm90ZWN0ZWQgdXBkYXRlTGFiZWwoKTogdm9pZCB7XG5cdFx0dGhpcy5sYWJlbCA9IHRoaXMuZ2V0TGFiZWwoKTtcblx0fVxuXG5cdGdldExhYmVsKHByaW1hcnk/OiBib29sZWFuKTogc3RyaW5nIHtcblx0XHRpZiAodGhpcy5leHRlbnNpb24/LmlzV29ya3NwYWNlU2NvcGVkICYmIHRoaXMuZXh0ZW5zaW9uLnJlc291cmNlRXh0ZW5zaW9uICYmIHRoaXMuY29udGV4dFNlcnZpY2UuaXNJbnNpZGVXb3Jrc3BhY2UodGhpcy5leHRlbnNpb24ucmVzb3VyY2VFeHRlbnNpb24ubG9jYXRpb24pKSB7XG5cdFx0XHRyZXR1cm4gbG9jYWxpemUoJ2luc3RhbGwgd29ya3NwYWNlIHZlcnNpb24nLCBcIkluc3RhbGwgV29ya3NwYWNlIEV4dGVuc2lvblwiKTtcblx0XHR9XG5cdFx0LyogaW5zdGFsbCBwcmUtcmVsZWFzZSB2ZXJzaW9uICovXG5cdFx0aWYgKHRoaXMub3B0aW9ucy5pbnN0YWxsUHJlUmVsZWFzZVZlcnNpb24gJiYgdGhpcy5leHRlbnNpb24/Lmhhc1ByZVJlbGVhc2VWZXJzaW9uKSB7XG5cdFx0XHRyZXR1cm4gcHJpbWFyeSA/IGxvY2FsaXplKCdpbnN0YWxsIHByZS1yZWxlYXNlJywgXCJJbnN0YWxsIFByZS1SZWxlYXNlXCIpIDogbG9jYWxpemUoJ2luc3RhbGwgcHJlLXJlbGVhc2UgdmVyc2lvbicsIFwiSW5zdGFsbCBQcmUtUmVsZWFzZSBWZXJzaW9uXCIpO1xuXHRcdH1cblx0XHQvKiBpbnN0YWxsIHJlbGVhc2VkIHZlcnNpb24gdGhhdCBoYXMgYSBwcmUgcmVsZWFzZSB2ZXJzaW9uICovXG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uPy5oYXNQcmVSZWxlYXNlVmVyc2lvbikge1xuXHRcdFx0cmV0dXJuIHByaW1hcnkgPyBsb2NhbGl6ZSgnaW5zdGFsbCcsIFwiSW5zdGFsbFwiKSA6IGxvY2FsaXplKCdpbnN0YWxsIHJlbGVhc2UgdmVyc2lvbicsIFwiSW5zdGFsbCBSZWxlYXNlIFZlcnNpb25cIik7XG5cdFx0fVxuXHRcdHJldHVybiBsb2NhbGl6ZSgnaW5zdGFsbCcsIFwiSW5zdGFsbFwiKTtcblx0fVxuXG59XG5cbmV4cG9ydCBjbGFzcyBJbnN0YWxsRHJvcGRvd25BY3Rpb24gZXh0ZW5kcyBCdXR0b25XaXRoRHJvcERvd25FeHRlbnNpb25BY3Rpb24ge1xuXG5cdHNldCBtYW5pZmVzdChtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0IHwgbnVsbCkge1xuXHRcdHRoaXMuZXh0ZW5zaW9uQWN0aW9ucy5mb3JFYWNoKGEgPT4gKDxJbnN0YWxsQWN0aW9uPmEpLm1hbmlmZXN0ID0gbWFuaWZlc3QpO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihgZXh0ZW5zaW9ucy5pbnN0YWxsQWN0aW9uc2AsIEluc3RhbGxBY3Rpb24uQ0xBU1MsIFtcblx0XHRcdFtcblx0XHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW5zdGFsbEFjdGlvbiwgeyBpbnN0YWxsUHJlUmVsZWFzZVZlcnNpb246IGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnByZWZlclByZVJlbGVhc2VzIH0pLFxuXHRcdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShJbnN0YWxsQWN0aW9uLCB7IGluc3RhbGxQcmVSZWxlYXNlVmVyc2lvbjogIWV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnByZWZlclByZVJlbGVhc2VzIH0pLFxuXHRcdFx0XVxuXHRcdF0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGdldExhYmVsKGFjdGlvbjogSW5zdGFsbEFjdGlvbik6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGFjdGlvbi5nZXRMYWJlbCh0cnVlKTtcblx0fVxuXG59XG5cbmV4cG9ydCBjbGFzcyBJbnN0YWxsaW5nTGFiZWxBY3Rpb24gZXh0ZW5kcyBFeHRlbnNpb25BY3Rpb24ge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IExBQkVMID0gbG9jYWxpemUoJ2luc3RhbGxpbmcnLCBcIkluc3RhbGxpbmdcIik7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IENMQVNTID0gYCR7RXh0ZW5zaW9uQWN0aW9uLkxBQkVMX0FDVElPTl9DTEFTU30gaW5zdGFsbCBpbnN0YWxsaW5nYDtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcignZXh0ZW5zaW9uLmluc3RhbGxpbmcnLCBJbnN0YWxsaW5nTGFiZWxBY3Rpb24uTEFCRUwsIEluc3RhbGxpbmdMYWJlbEFjdGlvbi5DTEFTUywgZmFsc2UpO1xuXHR9XG5cblx0dXBkYXRlKCk6IHZvaWQge1xuXHRcdHRoaXMuY2xhc3MgPSBgJHtJbnN0YWxsaW5nTGFiZWxBY3Rpb24uQ0xBU1N9JHt0aGlzLmV4dGVuc2lvbiAmJiB0aGlzLmV4dGVuc2lvbi5zdGF0ZSA9PT0gRXh0ZW5zaW9uU3RhdGUuSW5zdGFsbGluZyA/ICcnIDogJyBoaWRlJ31gO1xuXHR9XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBJbnN0YWxsSW5PdGhlclNlcnZlckFjdGlvbiBleHRlbmRzIEV4dGVuc2lvbkFjdGlvbiB7XG5cblx0cHJvdGVjdGVkIHN0YXRpYyByZWFkb25seSBJTlNUQUxMX0xBQkVMID0gbG9jYWxpemUoJ2luc3RhbGwnLCBcIkluc3RhbGxcIik7XG5cdHByb3RlY3RlZCBzdGF0aWMgcmVhZG9ubHkgSU5TVEFMTElOR19MQUJFTCA9IGxvY2FsaXplKCdpbnN0YWxsaW5nJywgXCJJbnN0YWxsaW5nXCIpO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IENsYXNzID0gYCR7RXh0ZW5zaW9uQWN0aW9uLkxBQkVMX0FDVElPTl9DTEFTU30gcHJvbWluZW50IGluc3RhbGwtb3RoZXItc2VydmVyYDtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgSW5zdGFsbGluZ0NsYXNzID0gYCR7RXh0ZW5zaW9uQWN0aW9uLkxBQkVMX0FDVElPTl9DTEFTU30gaW5zdGFsbC1vdGhlci1zZXJ2ZXIgaW5zdGFsbGluZ2A7XG5cblx0dXBkYXRlV2hlbkNvdW50ZXJFeHRlbnNpb25DaGFuZ2VzOiBib29sZWFuID0gdHJ1ZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRpZDogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgc2VydmVyOiBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciB8IG51bGwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjYW5JbnN0YWxsQW55V2hlcmU6IGJvb2xlYW4sXG5cdFx0QElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlOiBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZSBwcm90ZWN0ZWQgcmVhZG9ubHkgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2U6IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZSxcblx0XHRASUV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlOiBJRXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoaWQsIEluc3RhbGxJbk90aGVyU2VydmVyQWN0aW9uLklOU1RBTExfTEFCRUwsIEluc3RhbGxJbk90aGVyU2VydmVyQWN0aW9uLkNsYXNzLCBmYWxzZSk7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdHVwZGF0ZSgpOiB2b2lkIHtcblx0XHR0aGlzLmVuYWJsZWQgPSBmYWxzZTtcblx0XHR0aGlzLmNsYXNzID0gSW5zdGFsbEluT3RoZXJTZXJ2ZXJBY3Rpb24uQ2xhc3M7XG5cblx0XHRpZiAodGhpcy5jYW5JbnN0YWxsKCkpIHtcblx0XHRcdGNvbnN0IGV4dGVuc2lvbkluT3RoZXJTZXJ2ZXIgPSB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmluc3RhbGxlZC5maWx0ZXIoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIHRoaXMuZXh0ZW5zaW9uIS5pZGVudGlmaWVyKSAmJiBlLnNlcnZlciA9PT0gdGhpcy5zZXJ2ZXIpWzBdO1xuXHRcdFx0aWYgKGV4dGVuc2lvbkluT3RoZXJTZXJ2ZXIpIHtcblx0XHRcdFx0Ly8gR2V0dGluZyBpbnN0YWxsZWQgaW4gb3RoZXIgc2VydmVyXG5cdFx0XHRcdGlmIChleHRlbnNpb25Jbk90aGVyU2VydmVyLnN0YXRlID09PSBFeHRlbnNpb25TdGF0ZS5JbnN0YWxsaW5nICYmICFleHRlbnNpb25Jbk90aGVyU2VydmVyLmxvY2FsKSB7XG5cdFx0XHRcdFx0dGhpcy5lbmFibGVkID0gdHJ1ZTtcblx0XHRcdFx0XHR0aGlzLmxhYmVsID0gSW5zdGFsbEluT3RoZXJTZXJ2ZXJBY3Rpb24uSU5TVEFMTElOR19MQUJFTDtcblx0XHRcdFx0XHR0aGlzLmNsYXNzID0gSW5zdGFsbEluT3RoZXJTZXJ2ZXJBY3Rpb24uSW5zdGFsbGluZ0NsYXNzO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBOb3QgaW5zdGFsbGVkIGluIG90aGVyIHNlcnZlclxuXHRcdFx0XHR0aGlzLmVuYWJsZWQgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLmxhYmVsID0gdGhpcy5nZXRJbnN0YWxsTGFiZWwoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgY2FuSW5zdGFsbCgpOiBib29sZWFuIHtcblx0XHQvLyBEaXNhYmxlIGlmIGV4dGVuc2lvbiBpcyBub3QgaW5zdGFsbGVkIG9yIG5vdCBhbiB1c2VyIGV4dGVuc2lvblxuXHRcdGlmIChcblx0XHRcdCF0aGlzLmV4dGVuc2lvblxuXHRcdFx0fHwgIXRoaXMuc2VydmVyXG5cdFx0XHR8fCAhdGhpcy5leHRlbnNpb24ubG9jYWxcblx0XHRcdHx8IHRoaXMuZXh0ZW5zaW9uLnN0YXRlICE9PSBFeHRlbnNpb25TdGF0ZS5JbnN0YWxsZWRcblx0XHRcdHx8IHRoaXMuZXh0ZW5zaW9uLnR5cGUgIT09IEV4dGVuc2lvblR5cGUuVXNlclxuXHRcdFx0fHwgdGhpcy5leHRlbnNpb24uZW5hYmxlbWVudFN0YXRlID09PSBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRCeUVudmlyb25tZW50IHx8IHRoaXMuZXh0ZW5zaW9uLmVuYWJsZW1lbnRTdGF0ZSA9PT0gRW5hYmxlbWVudFN0YXRlLkRpc2FibGVkQnlUcnVzdFJlcXVpcmVtZW50IHx8IHRoaXMuZXh0ZW5zaW9uLmVuYWJsZW1lbnRTdGF0ZSA9PT0gRW5hYmxlbWVudFN0YXRlLkRpc2FibGVkQnlWaXJ0dWFsV29ya3NwYWNlXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKGlzTGFuZ3VhZ2VQYWNrRXh0ZW5zaW9uKHRoaXMuZXh0ZW5zaW9uLmxvY2FsLm1hbmlmZXN0KSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Ly8gUHJlZmVycyB0byBydW4gb24gVUlcblx0XHRpZiAodGhpcy5zZXJ2ZXIgPT09IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UubG9jYWxFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyICYmIHRoaXMuZXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZS5wcmVmZXJzRXhlY3V0ZU9uVUkodGhpcy5leHRlbnNpb24ubG9jYWwubWFuaWZlc3QpKSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHQvLyBQcmVmZXJzIHRvIHJ1biBvbiBXb3Jrc3BhY2Vcblx0XHRpZiAodGhpcy5zZXJ2ZXIgPT09IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciAmJiB0aGlzLmV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UucHJlZmVyc0V4ZWN1dGVPbldvcmtzcGFjZSh0aGlzLmV4dGVuc2lvbi5sb2NhbC5tYW5pZmVzdCkpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblxuXHRcdC8vIFByZWZlcnMgdG8gcnVuIG9uIFdlYlxuXHRcdGlmICh0aGlzLnNlcnZlciA9PT0gdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS53ZWJFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyICYmIHRoaXMuZXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZS5wcmVmZXJzRXhlY3V0ZU9uV2ViKHRoaXMuZXh0ZW5zaW9uLmxvY2FsLm1hbmlmZXN0KSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuY2FuSW5zdGFsbEFueVdoZXJlKSB7XG5cdFx0XHQvLyBDYW4gcnVuIG9uIFVJXG5cdFx0XHRpZiAodGhpcy5zZXJ2ZXIgPT09IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UubG9jYWxFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyICYmIHRoaXMuZXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZS5jYW5FeGVjdXRlT25VSSh0aGlzLmV4dGVuc2lvbi5sb2NhbC5tYW5pZmVzdCkpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdC8vIENhbiBydW4gb24gV29ya3NwYWNlXG5cdFx0XHRpZiAodGhpcy5zZXJ2ZXIgPT09IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciAmJiB0aGlzLmV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UuY2FuRXhlY3V0ZU9uV29ya3NwYWNlKHRoaXMuZXh0ZW5zaW9uLmxvY2FsLm1hbmlmZXN0KSkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbj8ubG9jYWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbj8uc2VydmVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICghdGhpcy5zZXJ2ZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5vcGVuKHRoaXMuZXh0ZW5zaW9uKTtcblx0XHRhbGVydChsb2NhbGl6ZSgnaW5zdGFsbEV4dGVuc2lvblN0YXJ0JywgXCJJbnN0YWxsaW5nIGV4dGVuc2lvbiB7MH0gc3RhcnRlZC4gQW4gZWRpdG9yIGlzIG5vdyBvcGVuIHdpdGggbW9yZSBkZXRhaWxzIG9uIHRoaXMgZXh0ZW5zaW9uXCIsIHRoaXMuZXh0ZW5zaW9uLmRpc3BsYXlOYW1lKSk7XG5cdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuaW5zdGFsbEluU2VydmVyKHRoaXMuZXh0ZW5zaW9uLCB0aGlzLnNlcnZlcik7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgZ2V0SW5zdGFsbExhYmVsKCk6IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIFJlbW90ZUluc3RhbGxBY3Rpb24gZXh0ZW5kcyBJbnN0YWxsSW5PdGhlclNlcnZlckFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Y2FuSW5zdGFsbEFueVdoZXJlOiBib29sZWFuLFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2U6IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSxcblx0XHRASUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlIGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlOiBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlIGV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2U6IElFeHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihgZXh0ZW5zaW9ucy5yZW1vdGVpbnN0YWxsYCwgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciwgY2FuSW5zdGFsbEFueVdoZXJlLCBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZSwgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UsIGV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldEluc3RhbGxMYWJlbCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLnJlbW90ZUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJcblx0XHRcdD8gbG9jYWxpemUoeyBrZXk6ICdpbnN0YWxsIGluIHJlbW90ZScsIGNvbW1lbnQ6IFsnVGhpcyBpcyB0aGUgbmFtZSBvZiB0aGUgYWN0aW9uIHRvIGluc3RhbGwgYW4gZXh0ZW5zaW9uIGluIHJlbW90ZSBzZXJ2ZXIuIFBsYWNlaG9sZGVyIGlzIGZvciB0aGUgbmFtZSBvZiByZW1vdGUgc2VydmVyLiddIH0sIFwiSW5zdGFsbCBpbiB7MH1cIiwgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5yZW1vdGVFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyLmxhYmVsKVxuXHRcdFx0OiBJbnN0YWxsSW5PdGhlclNlcnZlckFjdGlvbi5JTlNUQUxMX0xBQkVMO1xuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIExvY2FsSW5zdGFsbEFjdGlvbiBleHRlbmRzIEluc3RhbGxJbk90aGVyU2VydmVyQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlOiBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZSBleHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZTogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZSBleHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlOiBJRXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoYGV4dGVuc2lvbnMubG9jYWxpbnN0YWxsYCwgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UubG9jYWxFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyLCBmYWxzZSwgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsIGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLCBleHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRJbnN0YWxsTGFiZWwoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gbG9jYWxpemUoJ2luc3RhbGwgbG9jYWxseScsIFwiSW5zdGFsbCBMb2NhbGx5XCIpO1xuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIFdlYkluc3RhbGxBY3Rpb24gZXh0ZW5kcyBJbnN0YWxsSW5PdGhlclNlcnZlckFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2U6IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZSxcblx0XHRASUV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UgZXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZTogSUV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKGBleHRlbnNpb25zLndlYkluc3RhbGxgLCBleHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS53ZWJFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyLCBmYWxzZSwgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsIGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLCBleHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlKTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRJbnN0YWxsTGFiZWwoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gbG9jYWxpemUoJ2luc3RhbGwgYnJvd3NlcicsIFwiSW5zdGFsbCBpbiBCcm93c2VyXCIpO1xuXHR9XG5cbn1cblxuZXhwb3J0IGNsYXNzIFVuaW5zdGFsbEFjdGlvbiBleHRlbmRzIEV4dGVuc2lvbkFjdGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IFVuaW5zdGFsbExhYmVsID0gbG9jYWxpemUoJ3VuaW5zdGFsbEFjdGlvbicsIFwiVW5pbnN0YWxsXCIpO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBVbmluc3RhbGxpbmdMYWJlbCA9IGxvY2FsaXplKCdVbmluc3RhbGxpbmcnLCBcIlVuaW5zdGFsbGluZ1wiKTtcblxuXHRzdGF0aWMgcmVhZG9ubHkgVW5pbnN0YWxsQ2xhc3MgPSBgJHtFeHRlbnNpb25BY3Rpb24uTEFCRUxfQUNUSU9OX0NMQVNTfSB1bmluc3RhbGxgO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBVbkluc3RhbGxpbmdDbGFzcyA9IGAke0V4dGVuc2lvbkFjdGlvbi5MQUJFTF9BQ1RJT05fQ0xBU1N9IHVuaW5zdGFsbCB1bmluc3RhbGxpbmdgO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCdleHRlbnNpb25zLnVuaW5zdGFsbCcsIFVuaW5zdGFsbEFjdGlvbi5Vbmluc3RhbGxMYWJlbCwgVW5pbnN0YWxsQWN0aW9uLlVuaW5zdGFsbENsYXNzLCBmYWxzZSk7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdHVwZGF0ZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uKSB7XG5cdFx0XHR0aGlzLmVuYWJsZWQgPSBmYWxzZTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuZXh0ZW5zaW9uLnN0YXRlO1xuXG5cdFx0aWYgKHN0YXRlID09PSBFeHRlbnNpb25TdGF0ZS5Vbmluc3RhbGxpbmcpIHtcblx0XHRcdHRoaXMubGFiZWwgPSBVbmluc3RhbGxBY3Rpb24uVW5pbnN0YWxsaW5nTGFiZWw7XG5cdFx0XHR0aGlzLmNsYXNzID0gVW5pbnN0YWxsQWN0aW9uLlVuSW5zdGFsbGluZ0NsYXNzO1xuXHRcdFx0dGhpcy5lbmFibGVkID0gZmFsc2U7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5sYWJlbCA9IFVuaW5zdGFsbEFjdGlvbi5Vbmluc3RhbGxMYWJlbDtcblx0XHR0aGlzLmNsYXNzID0gVW5pbnN0YWxsQWN0aW9uLlVuaW5zdGFsbENsYXNzO1xuXHRcdHRoaXMudG9vbHRpcCA9IFVuaW5zdGFsbEFjdGlvbi5Vbmluc3RhbGxMYWJlbDtcblxuXHRcdGlmIChzdGF0ZSAhPT0gRXh0ZW5zaW9uU3RhdGUuSW5zdGFsbGVkKSB7XG5cdFx0XHR0aGlzLmVuYWJsZWQgPSBmYWxzZTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5leHRlbnNpb24uaXNCdWlsdGluKSB7XG5cdFx0XHR0aGlzLmVuYWJsZWQgPSBmYWxzZTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLmVuYWJsZWQgPSB0cnVlO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKCk6IFByb21pc2U8YW55PiB7XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRhbGVydChsb2NhbGl6ZSgndW5pbnN0YWxsRXh0ZW5zaW9uU3RhcnQnLCBcIlVuaW5zdGFsbGluZyBleHRlbnNpb24gezB9IHN0YXJ0ZWQuXCIsIHRoaXMuZXh0ZW5zaW9uLmRpc3BsYXlOYW1lKSk7XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS51bmluc3RhbGwodGhpcy5leHRlbnNpb24pO1xuXHRcdFx0YWxlcnQobG9jYWxpemUoJ3VuaW5zdGFsbEV4dGVuc2lvbkNvbXBsZXRlJywgXCJQbGVhc2UgcmVsb2FkIFZpc3VhbCBTdHVkaW8gQ29kZSB0byBjb21wbGV0ZSB0aGUgdW5pbnN0YWxsYXRpb24gb2YgdGhlIGV4dGVuc2lvbiB7MH0uXCIsIHRoaXMuZXh0ZW5zaW9uLmRpc3BsYXlOYW1lKSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGlmICghaXNDYW5jZWxsYXRpb25FcnJvcihlcnJvcikpIHtcblx0XHRcdFx0dGhpcy5kaWFsb2dTZXJ2aWNlLmVycm9yKGdldEVycm9yTWVzc2FnZShlcnJvcikpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVXBkYXRlQWN0aW9uIGV4dGVuZHMgRXh0ZW5zaW9uQWN0aW9uIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBFbmFibGVkQ2xhc3MgPSBgJHt0aGlzLkxBQkVMX0FDVElPTl9DTEFTU30gcHJvbWluZW50IHVwZGF0ZWA7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IERpc2FibGVkQ2xhc3MgPSBgJHt0aGlzLkVuYWJsZWRDbGFzc30gZGlzYWJsZWRgO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgdXBkYXRlVGhyb3R0bGVyID0gbmV3IFRocm90dGxlcigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgdmVyYm9zZTogYm9vbGVhbixcblx0XHRASUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2U6IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoYGV4dGVuc2lvbnMudXBkYXRlYCwgbG9jYWxpemUoJ3VwZGF0ZScsIFwiVXBkYXRlXCIpLCBVcGRhdGVBY3Rpb24uRGlzYWJsZWRDbGFzcywgZmFsc2UpO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHR1cGRhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy51cGRhdGVUaHJvdHRsZXIucXVldWUoKCkgPT4gdGhpcy5jb21wdXRlQW5kVXBkYXRlRW5hYmxlbWVudCgpKTtcblx0XHRpZiAodGhpcy5leHRlbnNpb24pIHtcblx0XHRcdHRoaXMubGFiZWwgPSB0aGlzLnZlcmJvc2UgPyBsb2NhbGl6ZSgndXBkYXRlIHRvJywgXCJVcGRhdGUgdG8gdnswfVwiLCB0aGlzLmV4dGVuc2lvbi5sYXRlc3RWZXJzaW9uKSA6IGxvY2FsaXplKCd1cGRhdGUnLCBcIlVwZGF0ZVwiKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNvbXB1dGVBbmRVcGRhdGVFbmFibGVtZW50KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuXHRcdHRoaXMuY2xhc3MgPSBVcGRhdGVBY3Rpb24uRGlzYWJsZWRDbGFzcztcblxuXHRcdGlmICghdGhpcy5leHRlbnNpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5leHRlbnNpb24uZGVwcmVjYXRpb25JbmZvKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2FuSW5zdGFsbCA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuY2FuSW5zdGFsbCh0aGlzLmV4dGVuc2lvbik7XG5cdFx0Y29uc3QgaXNJbnN0YWxsZWQgPSB0aGlzLmV4dGVuc2lvbi5zdGF0ZSA9PT0gRXh0ZW5zaW9uU3RhdGUuSW5zdGFsbGVkO1xuXG5cdFx0dGhpcy5lbmFibGVkID0gY2FuSW5zdGFsbCA9PT0gdHJ1ZSAmJiBpc0luc3RhbGxlZCAmJiB0aGlzLmV4dGVuc2lvbi5vdXRkYXRlZDtcblx0XHR0aGlzLmNsYXNzID0gdGhpcy5lbmFibGVkID8gVXBkYXRlQWN0aW9uLkVuYWJsZWRDbGFzcyA6IFVwZGF0ZUFjdGlvbi5EaXNhYmxlZENsYXNzO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKCk6IFByb21pc2U8YW55PiB7XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbnNlbnQgPSBhd2FpdCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnNob3VsZFJlcXVpcmVDb25zZW50VG9VcGRhdGUodGhpcy5leHRlbnNpb24pO1xuXHRcdGlmIChjb25zZW50KSB7XG5cdFx0XHRjb25zdCB7IHJlc3VsdCB9ID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLnByb21wdDwndXBkYXRlJyB8ICdyZXZpZXcnIHwgJ2NhbmNlbCc+KHtcblx0XHRcdFx0dHlwZTogJ3dhcm5pbmcnLFxuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3VwZGF0ZUV4dGVuc2lvbkNvbnNlbnRUaXRsZScsIFwiVXBkYXRlIHswfSBFeHRlbnNpb25cIiwgdGhpcy5leHRlbnNpb24uZGlzcGxheU5hbWUpLFxuXHRcdFx0XHRtZXNzYWdlOiBsb2NhbGl6ZSgndXBkYXRlRXh0ZW5zaW9uQ29uc2VudCcsIFwiezB9XFxuXFxuV291bGQgeW91IGxpa2UgdG8gdXBkYXRlIHRoZSBleHRlbnNpb24/XCIsIGNvbnNlbnQpLFxuXHRcdFx0XHRidXR0b25zOiBbe1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgndXBkYXRlJywgXCJVcGRhdGVcIiksXG5cdFx0XHRcdFx0cnVuOiAoKSA9PiAndXBkYXRlJ1xuXHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdyZXZpZXcnLCBcIlJldmlld1wiKSxcblx0XHRcdFx0XHRydW46ICgpID0+ICdyZXZpZXcnXG5cdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2NhbmNlbCcsIFwiQ2FuY2VsXCIpLFxuXHRcdFx0XHRcdHJ1bjogKCkgPT4gJ2NhbmNlbCdcblx0XHRcdFx0fV1cblx0XHRcdH0pO1xuXHRcdFx0aWYgKHJlc3VsdCA9PT0gJ2NhbmNlbCcpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHJlc3VsdCA9PT0gJ3JldmlldycpIHtcblx0XHRcdFx0aWYgKHRoaXMuZXh0ZW5zaW9uLmhhc0NoYW5nZWxvZygpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub3Blbih0aGlzLmV4dGVuc2lvbiwgeyB0YWI6IEV4dGVuc2lvbkVkaXRvclRhYi5DaGFuZ2Vsb2cgfSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRoaXMuZXh0ZW5zaW9uLnJlcG9zaXRvcnkpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4odGhpcy5leHRlbnNpb24ucmVwb3NpdG9yeSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub3Blbih0aGlzLmV4dGVuc2lvbik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0YWxlcnQobG9jYWxpemUoJ3VwZGF0ZUV4dGVuc2lvblN0YXJ0JywgXCJVcGRhdGluZyBleHRlbnNpb24gezB9IHRvIHZlcnNpb24gezF9IHN0YXJ0ZWQuXCIsIHRoaXMuZXh0ZW5zaW9uLmRpc3BsYXlOYW1lLCB0aGlzLmV4dGVuc2lvbi5sYXRlc3RWZXJzaW9uKSk7XG5cdFx0cmV0dXJuIHRoaXMuaW5zdGFsbCh0aGlzLmV4dGVuc2lvbik7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGluc3RhbGwoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IGV4dGVuc2lvbi5sb2NhbD8ucHJlUmVsZWFzZSA/IHsgaW5zdGFsbFByZVJlbGVhc2VWZXJzaW9uOiB0cnVlIH0gOiB1bmRlZmluZWQ7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuaW5zdGFsbChleHRlbnNpb24sIG9wdGlvbnMpO1xuXHRcdFx0YWxlcnQobG9jYWxpemUoJ3VwZGF0ZUV4dGVuc2lvbkNvbXBsZXRlJywgXCJVcGRhdGluZyBleHRlbnNpb24gezB9IHRvIHZlcnNpb24gezF9IGNvbXBsZXRlZC5cIiwgZXh0ZW5zaW9uLmRpc3BsYXlOYW1lLCBleHRlbnNpb24ubGF0ZXN0VmVyc2lvbikpO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShQcm9tcHRFeHRlbnNpb25JbnN0YWxsRmFpbHVyZUFjdGlvbiwgZXh0ZW5zaW9uLCBvcHRpb25zLCBleHRlbnNpb24ubGF0ZXN0VmVyc2lvbiwgSW5zdGFsbE9wZXJhdGlvbi5VcGRhdGUsIGVycikucnVuKCk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUb2dnbGVBdXRvVXBkYXRlRm9yRXh0ZW5zaW9uQWN0aW9uIGV4dGVuZHMgRXh0ZW5zaW9uQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLnRvZ2dsZUF1dG9VcGRhdGVGb3JFeHRlbnNpb24nO1xuXHRzdGF0aWMgcmVhZG9ubHkgTEFCRUwgPSBsb2NhbGl6ZTIoJ2VuYWJsZUF1dG9VcGRhdGVMYWJlbCcsIFwiQXV0byBVcGRhdGVcIik7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgRW5hYmxlZENsYXNzID0gYCR7RXh0ZW5zaW9uQWN0aW9uLkVYVEVOU0lPTl9BQ1RJT05fQ0xBU1N9IGF1dG8tdXBkYXRlYDtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgRGlzYWJsZWRDbGFzcyA9IGAke3RoaXMuRW5hYmxlZENsYXNzfSBoaWRlYDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2U6IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2U6IElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSxcblx0XHRASUFsbG93ZWRFeHRlbnNpb25zU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGFsbG93ZWRFeHRlbnNpb25zU2VydmljZTogSUFsbG93ZWRFeHRlbnNpb25zU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKFRvZ2dsZUF1dG9VcGRhdGVGb3JFeHRlbnNpb25BY3Rpb24uSUQsIFRvZ2dsZUF1dG9VcGRhdGVGb3JFeHRlbnNpb25BY3Rpb24uTEFCRUwudmFsdWUsIFRvZ2dsZUF1dG9VcGRhdGVGb3JFeHRlbnNpb25BY3Rpb24uRGlzYWJsZWRDbGFzcyk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oQXV0b1VwZGF0ZUNvbmZpZ3VyYXRpb25LZXkpKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFsbG93ZWRFeHRlbnNpb25zU2VydmljZS5vbkRpZENoYW5nZUFsbG93ZWRFeHRlbnNpb25zQ29uZmlnVmFsdWUoZSA9PiB0aGlzLnVwZGF0ZSgpKSk7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdG92ZXJyaWRlIHVwZGF0ZSgpIHtcblx0XHR0aGlzLmVuYWJsZWQgPSBmYWxzZTtcblx0XHR0aGlzLmNsYXNzID0gVG9nZ2xlQXV0b1VwZGF0ZUZvckV4dGVuc2lvbkFjdGlvbi5EaXNhYmxlZENsYXNzO1xuXHRcdGlmICghdGhpcy5leHRlbnNpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uLmlzQnVpbHRpbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5leHRlbnNpb24uZGVwcmVjYXRpb25JbmZvPy5kaXNhbGxvd0luc3RhbGwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBleHRlbnNpb24gPSB0aGlzLmV4dGVuc2lvbi5sb2NhbCA/PyB0aGlzLmV4dGVuc2lvbi5nYWxsZXJ5O1xuXHRcdGlmIChleHRlbnNpb24gJiYgdGhpcy5hbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UuaXNBbGxvd2VkKGV4dGVuc2lvbikgIT09IHRydWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuZ2V0QXV0b1VwZGF0ZVZhbHVlKCkgPT09ICdvbmx5RW5hYmxlZEV4dGVuc2lvbnMnICYmICF0aGlzLmV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZEVuYWJsZW1lbnRTdGF0ZSh0aGlzLmV4dGVuc2lvbi5lbmFibGVtZW50U3RhdGUpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuZW5hYmxlZCA9IHRydWU7XG5cdFx0dGhpcy5jbGFzcyA9IFRvZ2dsZUF1dG9VcGRhdGVGb3JFeHRlbnNpb25BY3Rpb24uRW5hYmxlZENsYXNzO1xuXHRcdHRoaXMuY2hlY2tlZCA9IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuaXNBdXRvVXBkYXRlRW5hYmxlZEZvcih0aGlzLmV4dGVuc2lvbik7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oKTogUHJvbWlzZTxhbnk+IHtcblx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZW5hYmxlQXV0b1VwZGF0ZSA9ICF0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmlzQXV0b1VwZGF0ZUVuYWJsZWRGb3IodGhpcy5leHRlbnNpb24pO1xuXHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UudXBkYXRlQXV0b1VwZGF0ZUVuYWJsZW1lbnRGb3IodGhpcy5leHRlbnNpb24sIGVuYWJsZUF1dG9VcGRhdGUpO1xuXG5cdFx0aWYgKGVuYWJsZUF1dG9VcGRhdGUpIHtcblx0XHRcdGFsZXJ0KGxvY2FsaXplKCdlbmFibGVBdXRvVXBkYXRlJywgXCJFbmFibGVkIGF1dG8gdXBkYXRlcyBmb3JcIiwgdGhpcy5leHRlbnNpb24uZGlzcGxheU5hbWUpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YWxlcnQobG9jYWxpemUoJ2Rpc2FibGVBdXRvVXBkYXRlJywgXCJEaXNhYmxlZCBhdXRvIHVwZGF0ZXMgZm9yXCIsIHRoaXMuZXh0ZW5zaW9uLmRpc3BsYXlOYW1lKSk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUb2dnbGVBdXRvVXBkYXRlc0ZvclB1Ymxpc2hlckFjdGlvbiBleHRlbmRzIEV4dGVuc2lvbkFjdGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi50b2dnbGVBdXRvVXBkYXRlc0ZvclB1Ymxpc2hlcic7XG5cdHN0YXRpYyByZWFkb25seSBMQUJFTCA9IGxvY2FsaXplKCd0b2dnbGVBdXRvVXBkYXRlc0ZvclB1Ymxpc2hlckxhYmVsJywgXCJBdXRvIFVwZGF0ZSBBbGwgKEZyb20gUHVibGlzaGVyKVwiKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2U6IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihUb2dnbGVBdXRvVXBkYXRlc0ZvclB1Ymxpc2hlckFjdGlvbi5JRCwgVG9nZ2xlQXV0b1VwZGF0ZXNGb3JQdWJsaXNoZXJBY3Rpb24uTEFCRUwpO1xuXHR9XG5cblx0b3ZlcnJpZGUgdXBkYXRlKCkgeyB9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKCk6IFByb21pc2U8YW55PiB7XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRhbGVydChsb2NhbGl6ZSgnaWdub3JlRXh0ZW5zaW9uVXBkYXRlUHVibGlzaGVyJywgXCJJZ25vcmluZyB1cGRhdGVzIHB1Ymxpc2hlZCBieSB7MH0uXCIsIHRoaXMuZXh0ZW5zaW9uLnB1Ymxpc2hlckRpc3BsYXlOYW1lKSk7XG5cdFx0Y29uc3QgZW5hYmxlQXV0b1VwZGF0ZSA9ICF0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmlzQXV0b1VwZGF0ZUVuYWJsZWRGb3IodGhpcy5leHRlbnNpb24ucHVibGlzaGVyKTtcblx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnVwZGF0ZUF1dG9VcGRhdGVFbmFibGVtZW50Rm9yKHRoaXMuZXh0ZW5zaW9uLnB1Ymxpc2hlciwgZW5hYmxlQXV0b1VwZGF0ZSk7XG5cdFx0aWYgKGVuYWJsZUF1dG9VcGRhdGUpIHtcblx0XHRcdGFsZXJ0KGxvY2FsaXplKCdlbmFibGVBdXRvVXBkYXRlJywgXCJFbmFibGVkIGF1dG8gdXBkYXRlcyBmb3JcIiwgdGhpcy5leHRlbnNpb24uZGlzcGxheU5hbWUpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YWxlcnQobG9jYWxpemUoJ2Rpc2FibGVBdXRvVXBkYXRlJywgXCJEaXNhYmxlZCBhdXRvIHVwZGF0ZXMgZm9yXCIsIHRoaXMuZXh0ZW5zaW9uLmRpc3BsYXlOYW1lKSk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNaWdyYXRlRGVwcmVjYXRlZEV4dGVuc2lvbkFjdGlvbiBleHRlbmRzIEV4dGVuc2lvbkFjdGlvbiB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgRW5hYmxlZENsYXNzID0gYCR7RXh0ZW5zaW9uQWN0aW9uLkxBQkVMX0FDVElPTl9DTEFTU30gbWlncmF0ZWA7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IERpc2FibGVkQ2xhc3MgPSBgJHt0aGlzLkVuYWJsZWRDbGFzc30gZGlzYWJsZWRgO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgc21hbGw6IGJvb2xlYW4sXG5cdFx0QElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSBwcml2YXRlIGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlOiBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoJ2V4dGVuc2lvbnNBY3Rpb24ubWlncmF0ZURlcHJlY2F0ZWRFeHRlbnNpb24nLCBsb2NhbGl6ZSgnbWlncmF0ZUV4dGVuc2lvbicsIFwiTWlncmF0ZVwiKSwgTWlncmF0ZURlcHJlY2F0ZWRFeHRlbnNpb25BY3Rpb24uRGlzYWJsZWRDbGFzcywgZmFsc2UpO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHR1cGRhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5lbmFibGVkID0gZmFsc2U7XG5cdFx0dGhpcy5jbGFzcyA9IE1pZ3JhdGVEZXByZWNhdGVkRXh0ZW5zaW9uQWN0aW9uLkRpc2FibGVkQ2xhc3M7XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbj8ubG9jYWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uLnN0YXRlICE9PSBFeHRlbnNpb25TdGF0ZS5JbnN0YWxsZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbi5kZXByZWNhdGlvbkluZm8/LmV4dGVuc2lvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBpZCA9IHRoaXMuZXh0ZW5zaW9uLmRlcHJlY2F0aW9uSW5mby5leHRlbnNpb24uaWQ7XG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UubG9jYWwuc29tZShlID0+IGFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgeyBpZCB9KSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5lbmFibGVkID0gdHJ1ZTtcblx0XHR0aGlzLmNsYXNzID0gTWlncmF0ZURlcHJlY2F0ZWRFeHRlbnNpb25BY3Rpb24uRW5hYmxlZENsYXNzO1xuXHRcdHRoaXMudG9vbHRpcCA9IGxvY2FsaXplKCdtaWdyYXRlIHRvJywgXCJNaWdyYXRlIHRvIHswfVwiLCB0aGlzLmV4dGVuc2lvbi5kZXByZWNhdGlvbkluZm8uZXh0ZW5zaW9uLmRpc3BsYXlOYW1lKTtcblx0XHR0aGlzLmxhYmVsID0gdGhpcy5zbWFsbCA/IGxvY2FsaXplKCdtaWdyYXRlJywgXCJNaWdyYXRlXCIpIDogdGhpcy50b29sdGlwO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKCk6IFByb21pc2U8YW55PiB7XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbj8uZGVwcmVjYXRpb25JbmZvPy5leHRlbnNpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgbG9jYWwgPSB0aGlzLmV4dGVuc2lvbi5sb2NhbDtcblx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnVuaW5zdGFsbCh0aGlzLmV4dGVuc2lvbik7XG5cdFx0Y29uc3QgW2V4dGVuc2lvbl0gPSBhd2FpdCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmdldEV4dGVuc2lvbnMoW3sgaWQ6IHRoaXMuZXh0ZW5zaW9uLmRlcHJlY2F0aW9uSW5mby5leHRlbnNpb24uaWQsIHByZVJlbGVhc2U6IHRoaXMuZXh0ZW5zaW9uLmRlcHJlY2F0aW9uSW5mbz8uZXh0ZW5zaW9uPy5wcmVSZWxlYXNlIH1dLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmluc3RhbGwoZXh0ZW5zaW9uLCB7IGlzTWFjaGluZVNjb3BlZDogbG9jYWw/LmlzTWFjaGluZVNjb3BlZCB9KTtcblx0fVxufVxuXG5leHBvcnQgYWJzdHJhY3QgY2xhc3MgRHJvcERvd25FeHRlbnNpb25BY3Rpb24gZXh0ZW5kcyBFeHRlbnNpb25BY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGlkOiBzdHJpbmcsXG5cdFx0bGFiZWw6IHN0cmluZyxcblx0XHRjc3NDbGFzczogc3RyaW5nLFxuXHRcdGVuYWJsZWQ6IGJvb2xlYW4sXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcm90ZWN0ZWQgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihpZCwgbGFiZWwsIGNzc0NsYXNzLCBlbmFibGVkKTtcblx0fVxuXG5cdHByaXZhdGUgX2FjdGlvblZpZXdJdGVtOiBEcm9wRG93bkV4dGVuc2lvbkFjdGlvblZpZXdJdGVtIHwgbnVsbCA9IG51bGw7XG5cdGNyZWF0ZUFjdGlvblZpZXdJdGVtKG9wdGlvbnM6IElBY3Rpb25WaWV3SXRlbU9wdGlvbnMpOiBEcm9wRG93bkV4dGVuc2lvbkFjdGlvblZpZXdJdGVtIHtcblx0XHR0aGlzLl9hY3Rpb25WaWV3SXRlbSA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRHJvcERvd25FeHRlbnNpb25BY3Rpb25WaWV3SXRlbSwgdGhpcywgb3B0aW9ucyk7XG5cdFx0cmV0dXJuIHRoaXMuX2FjdGlvblZpZXdJdGVtO1xuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIHJ1bihhY3Rpb25Hcm91cHM6IElBY3Rpb25bXVtdKTogUHJvbWlzZTxhbnk+IHtcblx0XHR0aGlzLl9hY3Rpb25WaWV3SXRlbT8uc2hvd01lbnUoYWN0aW9uR3JvdXBzKTtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIERyb3BEb3duRXh0ZW5zaW9uQWN0aW9uVmlld0l0ZW0gZXh0ZW5kcyBBY3Rpb25WaWV3SXRlbSB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0YWN0aW9uOiBEcm9wRG93bkV4dGVuc2lvbkFjdGlvbixcblx0XHRvcHRpb25zOiBJQWN0aW9uVmlld0l0ZW1PcHRpb25zLFxuXHRcdEBJQ29udGV4dE1lbnVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dE1lbnVTZXJ2aWNlOiBJQ29udGV4dE1lbnVTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKG51bGwsIGFjdGlvbiwgeyAuLi5vcHRpb25zLCBpY29uOiB0cnVlLCBsYWJlbDogdHJ1ZSB9KTtcblx0fVxuXG5cdHB1YmxpYyBzaG93TWVudShtZW51QWN0aW9uR3JvdXBzOiBJQWN0aW9uW11bXSk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmVsZW1lbnQpIHtcblx0XHRcdGNvbnN0IGFjdGlvbnMgPSB0aGlzLmdldEFjdGlvbnMobWVudUFjdGlvbkdyb3Vwcyk7XG5cdFx0XHRjb25zdCBlbGVtZW50UG9zaXRpb24gPSBET00uZ2V0RG9tTm9kZVBhZ2VQb3NpdGlvbih0aGlzLmVsZW1lbnQpO1xuXHRcdFx0Y29uc3QgYW5jaG9yID0geyB4OiBlbGVtZW50UG9zaXRpb24ubGVmdCwgeTogZWxlbWVudFBvc2l0aW9uLnRvcCArIGVsZW1lbnRQb3NpdGlvbi5oZWlnaHQgKyAxMCB9O1xuXHRcdFx0dGhpcy5jb250ZXh0TWVudVNlcnZpY2Uuc2hvd0NvbnRleHRNZW51KHtcblx0XHRcdFx0Z2V0QW5jaG9yOiAoKSA9PiBhbmNob3IsXG5cdFx0XHRcdGdldEFjdGlvbnM6ICgpID0+IGFjdGlvbnMsXG5cdFx0XHRcdGFjdGlvblJ1bm5lcjogdGhpcy5hY3Rpb25SdW5uZXIsXG5cdFx0XHRcdG9uSGlkZTogKCkgPT4gZGlzcG9zZUlmRGlzcG9zYWJsZShhY3Rpb25zKVxuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBnZXRBY3Rpb25zKG1lbnVBY3Rpb25Hcm91cHM6IElBY3Rpb25bXVtdKTogSUFjdGlvbltdIHtcblx0XHRsZXQgYWN0aW9uczogSUFjdGlvbltdID0gW107XG5cdFx0Zm9yIChjb25zdCBtZW51QWN0aW9ucyBvZiBtZW51QWN0aW9uR3JvdXBzKSB7XG5cdFx0XHRhY3Rpb25zID0gWy4uLmFjdGlvbnMsIC4uLm1lbnVBY3Rpb25zLCBuZXcgU2VwYXJhdG9yKCldO1xuXHRcdH1cblx0XHRyZXR1cm4gYWN0aW9ucy5sZW5ndGggPyBhY3Rpb25zLnNsaWNlKDAsIGFjdGlvbnMubGVuZ3RoIC0gMSkgOiBhY3Rpb25zO1xuXHR9XG59XG5cbmFzeW5jIGZ1bmN0aW9uIGdldENvbnRleHRNZW51QWN0aW9uc0dyb3VwcyhleHRlbnNpb246IElFeHRlbnNpb24gfCB1bmRlZmluZWQgfCBudWxsLCBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlKTogUHJvbWlzZTxbc3RyaW5nLCBBcnJheTxNZW51SXRlbUFjdGlvbiB8IFN1Ym1lbnVJdGVtQWN0aW9uPl1bXT4ge1xuXHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYXN5bmMgYWNjZXNzb3IgPT4ge1xuXHRcdGNvbnN0IGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlKTtcblx0XHRjb25zdCBtZW51U2VydmljZSA9IGFjY2Vzc29yLmdldChJTWVudVNlcnZpY2UpO1xuXHRcdGNvbnN0IGV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbklnbm9yZWRSZWNvbW1lbmRhdGlvbnNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFeHRlbnNpb25JZ25vcmVkUmVjb21tZW5kYXRpb25zU2VydmljZSk7XG5cdFx0Y29uc3Qgd29ya2JlbmNoVGhlbWVTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3JrYmVuY2hUaGVtZVNlcnZpY2UpO1xuXHRcdGNvbnN0IGF1dGhlbnRpY2F0aW9uVXNhZ2VTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElBdXRoZW50aWNhdGlvblVzYWdlU2VydmljZSk7XG5cdFx0Y29uc3QgYWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElBbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UpO1xuXHRcdGNvbnN0IGNrc092ZXJsYXk6IFtzdHJpbmcsIGFueV1bXSA9IFtdO1xuXG5cdFx0aWYgKGV4dGVuc2lvbikge1xuXHRcdFx0Y2tzT3ZlcmxheS5wdXNoKFsnZXh0ZW5zaW9uJywgZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWRdKTtcblx0XHRcdGNrc092ZXJsYXkucHVzaChbJ2lzQnVpbHRpbkV4dGVuc2lvbicsIGV4dGVuc2lvbi5pc0J1aWx0aW5dKTtcblx0XHRcdGNrc092ZXJsYXkucHVzaChbJ2lzRGVmYXVsdEFwcGxpY2F0aW9uU2NvcGVkRXh0ZW5zaW9uJywgZXh0ZW5zaW9uLmxvY2FsICYmIGlzQXBwbGljYXRpb25TY29wZWRFeHRlbnNpb24oZXh0ZW5zaW9uLmxvY2FsLm1hbmlmZXN0KV0pO1xuXHRcdFx0Y2tzT3ZlcmxheS5wdXNoKFsnaXNBcHBsaWNhdGlvblNjb3BlZEV4dGVuc2lvbicsIGV4dGVuc2lvbi5sb2NhbCAmJiBleHRlbnNpb24ubG9jYWwuaXNBcHBsaWNhdGlvblNjb3BlZF0pO1xuXHRcdFx0Y2tzT3ZlcmxheS5wdXNoKFsnaXNXb3Jrc3BhY2VTY29wZWRFeHRlbnNpb24nLCBleHRlbnNpb24uaXNXb3Jrc3BhY2VTY29wZWRdKTtcblx0XHRcdGNrc092ZXJsYXkucHVzaChbJ2lzR2FsbGVyeUV4dGVuc2lvbicsICEhZXh0ZW5zaW9uLmlkZW50aWZpZXIudXVpZF0pO1xuXHRcdFx0aWYgKGV4dGVuc2lvbi5sb2NhbCkge1xuXHRcdFx0XHRja3NPdmVybGF5LnB1c2goWydleHRlbnNpb25Tb3VyY2UnLCBleHRlbnNpb24ubG9jYWwuc291cmNlXSk7XG5cdFx0XHR9XG5cdFx0XHRja3NPdmVybGF5LnB1c2goWydleHRlbnNpb25IYXNDb25maWd1cmF0aW9uJywgZXh0ZW5zaW9uLmxvY2FsICYmICEhZXh0ZW5zaW9uLmxvY2FsLm1hbmlmZXN0LmNvbnRyaWJ1dGVzICYmICEhZXh0ZW5zaW9uLmxvY2FsLm1hbmlmZXN0LmNvbnRyaWJ1dGVzLmNvbmZpZ3VyYXRpb25dKTtcblx0XHRcdGNrc092ZXJsYXkucHVzaChbJ2V4dGVuc2lvbkhhc0tleWJpbmRpbmdzJywgZXh0ZW5zaW9uLmxvY2FsICYmICEhZXh0ZW5zaW9uLmxvY2FsLm1hbmlmZXN0LmNvbnRyaWJ1dGVzICYmICEhZXh0ZW5zaW9uLmxvY2FsLm1hbmlmZXN0LmNvbnRyaWJ1dGVzLmtleWJpbmRpbmdzXSk7XG5cdFx0XHRja3NPdmVybGF5LnB1c2goWydleHRlbnNpb25IYXNDb21tYW5kcycsIGV4dGVuc2lvbi5sb2NhbCAmJiAhIWV4dGVuc2lvbi5sb2NhbC5tYW5pZmVzdC5jb250cmlidXRlcyAmJiAhIWV4dGVuc2lvbi5sb2NhbC5tYW5pZmVzdC5jb250cmlidXRlcz8uY29tbWFuZHNdKTtcblx0XHRcdGNrc092ZXJsYXkucHVzaChbJ2lzRXh0ZW5zaW9uUmVjb21tZW5kZWQnLCAhIWV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UuZ2V0QWxsUmVjb21tZW5kYXRpb25zV2l0aFJlYXNvbigpW2V4dGVuc2lvbi5pZGVudGlmaWVyLmlkLnRvTG93ZXJDYXNlKCldXSk7XG5cdFx0XHRja3NPdmVybGF5LnB1c2goWydpc0V4dGVuc2lvbldvcmtzcGFjZVJlY29tbWVuZGVkJywgZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zU2VydmljZS5nZXRBbGxSZWNvbW1lbmRhdGlvbnNXaXRoUmVhc29uKClbZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKV0/LnJlYXNvbklkID09PSBFeHRlbnNpb25SZWNvbW1lbmRhdGlvblJlYXNvbi5Xb3Jrc3BhY2VdKTtcblx0XHRcdGNrc092ZXJsYXkucHVzaChbJ2lzVXNlcklnbm9yZWRSZWNvbW1lbmRhdGlvbicsIGV4dGVuc2lvbklnbm9yZWRSZWNvbW1lbmRhdGlvbnNTZXJ2aWNlLmdsb2JhbElnbm9yZWRSZWNvbW1lbmRhdGlvbnMuc29tZShlID0+IGUgPT09IGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLnRvTG93ZXJDYXNlKCkpXSk7XG5cdFx0XHRja3NPdmVybGF5LnB1c2goWydpc0V4dGVuc2lvblBpbm5lZCcsIGV4dGVuc2lvbi5waW5uZWRdKTtcblx0XHRcdGNrc092ZXJsYXkucHVzaChbJ2lzRXh0ZW5zaW9uRW5hYmxlZCcsIGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZEVuYWJsZW1lbnRTdGF0ZShleHRlbnNpb24uZW5hYmxlbWVudFN0YXRlKV0pO1xuXHRcdFx0c3dpdGNoIChleHRlbnNpb24uc3RhdGUpIHtcblx0XHRcdFx0Y2FzZSBFeHRlbnNpb25TdGF0ZS5JbnN0YWxsaW5nOlxuXHRcdFx0XHRcdGNrc092ZXJsYXkucHVzaChbJ2V4dGVuc2lvblN0YXR1cycsICdpbnN0YWxsaW5nJ10pO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIEV4dGVuc2lvblN0YXRlLkluc3RhbGxlZDpcblx0XHRcdFx0XHRja3NPdmVybGF5LnB1c2goWydleHRlbnNpb25TdGF0dXMnLCAnaW5zdGFsbGVkJ10pO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIEV4dGVuc2lvblN0YXRlLlVuaW5zdGFsbGluZzpcblx0XHRcdFx0XHRja3NPdmVybGF5LnB1c2goWydleHRlbnNpb25TdGF0dXMnLCAndW5pbnN0YWxsaW5nJ10pO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIEV4dGVuc2lvblN0YXRlLlVuaW5zdGFsbGVkOlxuXHRcdFx0XHRcdGNrc092ZXJsYXkucHVzaChbJ2V4dGVuc2lvblN0YXR1cycsICd1bmluc3RhbGxlZCddKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNrc092ZXJsYXkucHVzaChbJ2luc3RhbGxlZEV4dGVuc2lvbklzUHJlUmVsZWFzZVZlcnNpb24nLCAhIWV4dGVuc2lvbi5sb2NhbD8uaXNQcmVSZWxlYXNlVmVyc2lvbl0pO1xuXHRcdFx0Y2tzT3ZlcmxheS5wdXNoKFsnaW5zdGFsbGVkRXh0ZW5zaW9uSXNPcHRlZFRvUHJlUmVsZWFzZScsICEhZXh0ZW5zaW9uLmxvY2FsPy5wcmVSZWxlYXNlXSk7XG5cdFx0XHRja3NPdmVybGF5LnB1c2goWydnYWxsZXJ5RXh0ZW5zaW9uSXNQcmVSZWxlYXNlVmVyc2lvbicsICEhZXh0ZW5zaW9uLmdhbGxlcnk/LnByb3BlcnRpZXMuaXNQcmVSZWxlYXNlVmVyc2lvbl0pO1xuXHRcdFx0Y2tzT3ZlcmxheS5wdXNoKFsnZ2FsbGVyeUV4dGVuc2lvbkhhc1ByZVJlbGVhc2VWZXJzaW9uJywgZXh0ZW5zaW9uLmdhbGxlcnk/Lmhhc1ByZVJlbGVhc2VWZXJzaW9uXSk7XG5cdFx0XHRja3NPdmVybGF5LnB1c2goWydleHRlbnNpb25IYXNQcmVSZWxlYXNlVmVyc2lvbicsIGV4dGVuc2lvbi5oYXNQcmVSZWxlYXNlVmVyc2lvbl0pO1xuXHRcdFx0Y2tzT3ZlcmxheS5wdXNoKFsnZXh0ZW5zaW9uSGFzUmVsZWFzZVZlcnNpb24nLCBleHRlbnNpb24uaGFzUmVsZWFzZVZlcnNpb25dKTtcblx0XHRcdGNrc092ZXJsYXkucHVzaChbJ2V4dGVuc2lvbkRpc2FsbG93SW5zdGFsbCcsIGV4dGVuc2lvbi5pc01hbGljaW91cyB8fCBleHRlbnNpb24uZGVwcmVjYXRpb25JbmZvPy5kaXNhbGxvd0luc3RhbGxdKTtcblx0XHRcdGNrc092ZXJsYXkucHVzaChbJ2lzRXh0ZW5zaW9uQWxsb3dlZCcsIGFsbG93ZWRFeHRlbnNpb25zU2VydmljZS5pc0FsbG93ZWQoeyBpZDogZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQsIHB1Ymxpc2hlckRpc3BsYXlOYW1lOiBleHRlbnNpb24ucHVibGlzaGVyRGlzcGxheU5hbWUgfSkgPT09IHRydWVdKTtcblx0XHRcdGNrc092ZXJsYXkucHVzaChbJ2lzUHJlUmVsZWFzZUV4dGVuc2lvbkFsbG93ZWQnLCBhbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UuaXNBbGxvd2VkKHsgaWQ6IGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLCBwdWJsaXNoZXJEaXNwbGF5TmFtZTogZXh0ZW5zaW9uLnB1Ymxpc2hlckRpc3BsYXlOYW1lLCBwcmVyZWxlYXNlOiB0cnVlIH0pID09PSB0cnVlXSk7XG5cdFx0XHRja3NPdmVybGF5LnB1c2goWydleHRlbnNpb25Jc1Vuc2lnbmVkJywgZXh0ZW5zaW9uLmdhbGxlcnkgJiYgIWV4dGVuc2lvbi5nYWxsZXJ5LmlzU2lnbmVkXSk7XG5cblx0XHRcdGNvbnN0IFtjb2xvclRoZW1lcywgZmlsZUljb25UaGVtZXMsIHByb2R1Y3RJY29uVGhlbWVzLCBleHRlbnNpb25Vc2VzQXV0aF0gPSBhd2FpdCBQcm9taXNlLmFsbChbd29ya2JlbmNoVGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWVzKCksIHdvcmtiZW5jaFRoZW1lU2VydmljZS5nZXRGaWxlSWNvblRoZW1lcygpLCB3b3JrYmVuY2hUaGVtZVNlcnZpY2UuZ2V0UHJvZHVjdEljb25UaGVtZXMoKSwgYXV0aGVudGljYXRpb25Vc2FnZVNlcnZpY2UuZXh0ZW5zaW9uVXNlc0F1dGgoZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKSldKTtcblx0XHRcdGNrc092ZXJsYXkucHVzaChbJ2V4dGVuc2lvbkhhc0NvbG9yVGhlbWVzJywgY29sb3JUaGVtZXMuc29tZSh0aGVtZSA9PiBpc1RoZW1lRnJvbUV4dGVuc2lvbih0aGVtZSwgZXh0ZW5zaW9uKSldKTtcblx0XHRcdGNrc092ZXJsYXkucHVzaChbJ2V4dGVuc2lvbkhhc0ZpbGVJY29uVGhlbWVzJywgZmlsZUljb25UaGVtZXMuc29tZSh0aGVtZSA9PiBpc1RoZW1lRnJvbUV4dGVuc2lvbih0aGVtZSwgZXh0ZW5zaW9uKSldKTtcblx0XHRcdGNrc092ZXJsYXkucHVzaChbJ2V4dGVuc2lvbkhhc1Byb2R1Y3RJY29uVGhlbWVzJywgcHJvZHVjdEljb25UaGVtZXMuc29tZSh0aGVtZSA9PiBpc1RoZW1lRnJvbUV4dGVuc2lvbih0aGVtZSwgZXh0ZW5zaW9uKSldKTtcblx0XHRcdGNrc092ZXJsYXkucHVzaChbJ2V4dGVuc2lvbkhhc0FjY291bnRQcmVmZXJlbmNlcycsIGV4dGVuc2lvblVzZXNBdXRoXSk7XG5cblx0XHRcdGNrc092ZXJsYXkucHVzaChbJ2NhblNldExhbmd1YWdlJywgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuY2FuU2V0TGFuZ3VhZ2UoZXh0ZW5zaW9uKV0pO1xuXHRcdFx0Y2tzT3ZlcmxheS5wdXNoKFsnaXNBY3RpdmVMYW5ndWFnZVBhY2tFeHRlbnNpb24nLCBleHRlbnNpb24uZ2FsbGVyeSAmJiBsYW5ndWFnZSA9PT0gZ2V0TG9jYWxlKGV4dGVuc2lvbi5nYWxsZXJ5KV0pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGlvbnNHcm91cHMgPSBtZW51U2VydmljZS5nZXRNZW51QWN0aW9ucyhNZW51SWQuRXh0ZW5zaW9uQ29udGV4dCwgY29udGV4dEtleVNlcnZpY2UuY3JlYXRlT3ZlcmxheShja3NPdmVybGF5KSwgeyBzaG91bGRGb3J3YXJkQXJnczogdHJ1ZSB9KTtcblx0XHRyZXR1cm4gYWN0aW9uc0dyb3Vwcztcblx0fSk7XG59XG5cbmZ1bmN0aW9uIHRvQWN0aW9ucyhhY3Rpb25zR3JvdXBzOiBbc3RyaW5nLCBBcnJheTxNZW51SXRlbUFjdGlvbiB8IFN1Ym1lbnVJdGVtQWN0aW9uPl1bXSwgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSk6IElBY3Rpb25bXVtdIHtcblx0Y29uc3QgcmVzdWx0OiBJQWN0aW9uW11bXSA9IFtdO1xuXHRmb3IgKGNvbnN0IFssIGFjdGlvbnNdIG9mIGFjdGlvbnNHcm91cHMpIHtcblx0XHRyZXN1bHQucHVzaChhY3Rpb25zLm1hcChhY3Rpb24gPT4ge1xuXHRcdFx0aWYgKGFjdGlvbiBpbnN0YW5jZW9mIFN1Ym1lbnVBY3Rpb24pIHtcblx0XHRcdFx0cmV0dXJuIGFjdGlvbjtcblx0XHRcdH1cblx0XHRcdHJldHVybiBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNZW51SXRlbUV4dGVuc2lvbkFjdGlvbiwgYWN0aW9uKTtcblx0XHR9KSk7XG5cdH1cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0Q29udGV4dE1lbnVBY3Rpb25zKGV4dGVuc2lvbjogSUV4dGVuc2lvbiB8IHVuZGVmaW5lZCB8IG51bGwsIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpOiBQcm9taXNlPElBY3Rpb25bXVtdPiB7XG5cdGNvbnN0IGFjdGlvbnNHcm91cHMgPSBhd2FpdCBnZXRDb250ZXh0TWVudUFjdGlvbnNHcm91cHMoZXh0ZW5zaW9uLCBjb250ZXh0S2V5U2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRyZXR1cm4gdG9BY3Rpb25zKGFjdGlvbnNHcm91cHMsIGluc3RhbnRpYXRpb25TZXJ2aWNlKTtcbn1cblxuZXhwb3J0IGNsYXNzIE1hbmFnZUV4dGVuc2lvbkFjdGlvbiBleHRlbmRzIERyb3BEb3duRXh0ZW5zaW9uQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZXh0ZW5zaW9ucy5tYW5hZ2UnO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IENsYXNzID0gYCR7RXh0ZW5zaW9uQWN0aW9uLklDT05fQUNUSU9OX0NMQVNTfSBtYW5hZ2UgYCArIFRoZW1lSWNvbi5hc0NsYXNzTmFtZShtYW5hZ2VFeHRlbnNpb25JY29uKTtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgSGlkZU1hbmFnZUV4dGVuc2lvbkNsYXNzID0gYCR7dGhpcy5DbGFzc30gaGlkZWA7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHQpIHtcblxuXHRcdHN1cGVyKE1hbmFnZUV4dGVuc2lvbkFjdGlvbi5JRCwgJycsICcnLCB0cnVlLCBpbnN0YW50aWF0aW9uU2VydmljZSk7XG5cblx0XHR0aGlzLnRvb2x0aXAgPSBsb2NhbGl6ZSgnbWFuYWdlJywgXCJNYW5hZ2VcIik7XG5cblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0YXN5bmMgZ2V0QWN0aW9uR3JvdXBzKCk6IFByb21pc2U8SUFjdGlvbltdW10+IHtcblx0XHRjb25zdCBncm91cHM6IElBY3Rpb25bXVtdID0gW107XG5cdFx0Y29uc3QgY29udGV4dE1lbnVBY3Rpb25zR3JvdXBzID0gYXdhaXQgZ2V0Q29udGV4dE1lbnVBY3Rpb25zR3JvdXBzKHRoaXMuZXh0ZW5zaW9uLCB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCB0aGVtZUFjdGlvbnM6IElBY3Rpb25bXSA9IFtdLCBpbnN0YWxsQWN0aW9uczogSUFjdGlvbltdID0gW10sIHVwZGF0ZUFjdGlvbnM6IElBY3Rpb25bXSA9IFtdLCBvdGhlckFjdGlvbkdyb3VwczogSUFjdGlvbltdW10gPSBbXTtcblx0XHRmb3IgKGNvbnN0IFtncm91cCwgYWN0aW9uc10gb2YgY29udGV4dE1lbnVBY3Rpb25zR3JvdXBzKSB7XG5cdFx0XHRpZiAoZ3JvdXAgPT09IElOU1RBTExfQUNUSU9OU19HUk9VUCkge1xuXHRcdFx0XHRpbnN0YWxsQWN0aW9ucy5wdXNoKC4uLnRvQWN0aW9ucyhbW2dyb3VwLCBhY3Rpb25zXV0sIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UpWzBdKTtcblx0XHRcdH0gZWxzZSBpZiAoZ3JvdXAgPT09IFVQREFURV9BQ1RJT05TX0dST1VQKSB7XG5cdFx0XHRcdHVwZGF0ZUFjdGlvbnMucHVzaCguLi50b0FjdGlvbnMoW1tncm91cCwgYWN0aW9uc11dLCB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlKVswXSk7XG5cdFx0XHR9IGVsc2UgaWYgKGdyb3VwID09PSBUSEVNRV9BQ1RJT05TX0dST1VQKSB7XG5cdFx0XHRcdHRoZW1lQWN0aW9ucy5wdXNoKC4uLnRvQWN0aW9ucyhbW2dyb3VwLCBhY3Rpb25zXV0sIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UpWzBdKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdG90aGVyQWN0aW9uR3JvdXBzLnB1c2goLi4udG9BY3Rpb25zKFtbZ3JvdXAsIGFjdGlvbnNdXSwgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZSkpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGVtZUFjdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHRncm91cHMucHVzaCh0aGVtZUFjdGlvbnMpO1xuXHRcdH1cblxuXHRcdGdyb3Vwcy5wdXNoKFtcblx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRW5hYmxlR2xvYmFsbHlBY3Rpb24pLFxuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFbmFibGVGb3JXb3Jrc3BhY2VBY3Rpb24pXG5cdFx0XSk7XG5cdFx0Z3JvdXBzLnB1c2goW1xuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEaXNhYmxlR2xvYmFsbHlBY3Rpb24pLFxuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEaXNhYmxlRm9yV29ya3NwYWNlQWN0aW9uKVxuXHRcdF0pO1xuXHRcdGlmICh1cGRhdGVBY3Rpb25zLmxlbmd0aCkge1xuXHRcdFx0Z3JvdXBzLnB1c2godXBkYXRlQWN0aW9ucyk7XG5cdFx0fVxuXHRcdGdyb3Vwcy5wdXNoKFtcblx0XHRcdC4uLihpbnN0YWxsQWN0aW9ucy5sZW5ndGggPyBpbnN0YWxsQWN0aW9ucyA6IFtdKSxcblx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW5zdGFsbEFub3RoZXJWZXJzaW9uQWN0aW9uLCB0aGlzLmV4dGVuc2lvbiwgZmFsc2UpLFxuXHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShVbmluc3RhbGxBY3Rpb24pLFxuXHRcdF0pO1xuXG5cdFx0b3RoZXJBY3Rpb25Hcm91cHMuZm9yRWFjaChhY3Rpb25zID0+IGdyb3Vwcy5wdXNoKGFjdGlvbnMpKTtcblxuXHRcdGdyb3Vwcy5mb3JFYWNoKGdyb3VwID0+IGdyb3VwLmZvckVhY2goZXh0ZW5zaW9uQWN0aW9uID0+IHtcblx0XHRcdGlmIChleHRlbnNpb25BY3Rpb24gaW5zdGFuY2VvZiBFeHRlbnNpb25BY3Rpb24pIHtcblx0XHRcdFx0ZXh0ZW5zaW9uQWN0aW9uLmV4dGVuc2lvbiA9IHRoaXMuZXh0ZW5zaW9uO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHJldHVybiBncm91cHM7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oKTogUHJvbWlzZTxhbnk+IHtcblx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvblNlcnZpY2Uud2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCk7XG5cdFx0cmV0dXJuIHN1cGVyLnJ1bihhd2FpdCB0aGlzLmdldEFjdGlvbkdyb3VwcygpKTtcblx0fVxuXG5cdHVwZGF0ZSgpOiB2b2lkIHtcblx0XHR0aGlzLmNsYXNzID0gTWFuYWdlRXh0ZW5zaW9uQWN0aW9uLkhpZGVNYW5hZ2VFeHRlbnNpb25DbGFzcztcblx0XHR0aGlzLmVuYWJsZWQgPSBmYWxzZTtcblx0XHRpZiAodGhpcy5leHRlbnNpb24pIHtcblx0XHRcdGNvbnN0IHN0YXRlID0gdGhpcy5leHRlbnNpb24uc3RhdGU7XG5cdFx0XHR0aGlzLmVuYWJsZWQgPSBzdGF0ZSA9PT0gRXh0ZW5zaW9uU3RhdGUuSW5zdGFsbGVkO1xuXHRcdFx0dGhpcy5jbGFzcyA9IHRoaXMuZW5hYmxlZCB8fCBzdGF0ZSA9PT0gRXh0ZW5zaW9uU3RhdGUuVW5pbnN0YWxsaW5nID8gTWFuYWdlRXh0ZW5zaW9uQWN0aW9uLkNsYXNzIDogTWFuYWdlRXh0ZW5zaW9uQWN0aW9uLkhpZGVNYW5hZ2VFeHRlbnNpb25DbGFzcztcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEV4dGVuc2lvbkVkaXRvck1hbmFnZUV4dGVuc2lvbkFjdGlvbiBleHRlbmRzIERyb3BEb3duRXh0ZW5zaW9uQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcignZXh0ZW5zaW9uRWRpdG9yLm1hbmFnZUV4dGVuc2lvbicsICcnLCBgJHtFeHRlbnNpb25BY3Rpb24uSUNPTl9BQ1RJT05fQ0xBU1N9IG1hbmFnZSAke1RoZW1lSWNvbi5hc0NsYXNzTmFtZShtYW5hZ2VFeHRlbnNpb25JY29uKX1gLCB0cnVlLCBpbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0dGhpcy50b29sdGlwID0gbG9jYWxpemUoJ21hbmFnZScsIFwiTWFuYWdlXCIpO1xuXHR9XG5cblx0dXBkYXRlKCk6IHZvaWQgeyB9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKCk6IFByb21pc2U8YW55PiB7XG5cdFx0Y29uc3QgYWN0aW9uR3JvdXBzOiBJQWN0aW9uW11bXSA9IFtdO1xuXHRcdChhd2FpdCBnZXRDb250ZXh0TWVudUFjdGlvbnModGhpcy5leHRlbnNpb24sIHRoaXMuY29udGV4dEtleVNlcnZpY2UsIHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UpKS5mb3JFYWNoKGFjdGlvbnMgPT4gYWN0aW9uR3JvdXBzLnB1c2goYWN0aW9ucykpO1xuXHRcdGFjdGlvbkdyb3Vwcy5mb3JFYWNoKGdyb3VwID0+IGdyb3VwLmZvckVhY2goZXh0ZW5zaW9uQWN0aW9uID0+IHtcblx0XHRcdGlmIChleHRlbnNpb25BY3Rpb24gaW5zdGFuY2VvZiBFeHRlbnNpb25BY3Rpb24pIHtcblx0XHRcdFx0ZXh0ZW5zaW9uQWN0aW9uLmV4dGVuc2lvbiA9IHRoaXMuZXh0ZW5zaW9uO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRyZXR1cm4gc3VwZXIucnVuKGFjdGlvbkdyb3Vwcyk7XG5cdH1cblxufVxuXG5leHBvcnQgY2xhc3MgTWVudUl0ZW1FeHRlbnNpb25BY3Rpb24gZXh0ZW5kcyBFeHRlbnNpb25BY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgYWN0aW9uOiBJQWN0aW9uLFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihhY3Rpb24uaWQsIGFjdGlvbi5sYWJlbCk7XG5cdH1cblxuXHRvdmVycmlkZSBnZXQgZW5hYmxlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5hY3Rpb24uZW5hYmxlZDtcblx0fVxuXG5cdG92ZXJyaWRlIHNldCBlbmFibGVkKHZhbHVlOiBib29sZWFuKSB7XG5cdFx0dGhpcy5hY3Rpb24uZW5hYmxlZCA9IHZhbHVlO1xuXHR9XG5cblx0dXBkYXRlKCkge1xuXHRcdGlmICghdGhpcy5leHRlbnNpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHRoaXMuYWN0aW9uLmlkID09PSBUT0dHTEVfSUdOT1JFX0VYVEVOU0lPTl9BQ1RJT05fSUQpIHtcblx0XHRcdHRoaXMuY2hlY2tlZCA9ICF0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmlzRXh0ZW5zaW9uSWdub3JlZFRvU3luYyh0aGlzLmV4dGVuc2lvbik7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmFjdGlvbi5pZCA9PT0gVG9nZ2xlQXV0b1VwZGF0ZUZvckV4dGVuc2lvbkFjdGlvbi5JRCkge1xuXHRcdFx0dGhpcy5jaGVja2VkID0gdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5pc0F1dG9VcGRhdGVFbmFibGVkRm9yKHRoaXMuZXh0ZW5zaW9uKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuYWN0aW9uLmlkID09PSBUb2dnbGVBdXRvVXBkYXRlc0ZvclB1Ymxpc2hlckFjdGlvbi5JRCkge1xuXHRcdFx0dGhpcy5jaGVja2VkID0gdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5pc0F1dG9VcGRhdGVFbmFibGVkRm9yKHRoaXMuZXh0ZW5zaW9uLnB1Ymxpc2hlcik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuY2hlY2tlZCA9IHRoaXMuYWN0aW9uLmNoZWNrZWQ7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLmV4dGVuc2lvbikge1xuXHRcdFx0Y29uc3QgaWQgPSB0aGlzLmV4dGVuc2lvbi5sb2NhbCA/IGdldEV4dGVuc2lvbklkKHRoaXMuZXh0ZW5zaW9uLmxvY2FsLm1hbmlmZXN0LnB1Ymxpc2hlciwgdGhpcy5leHRlbnNpb24ubG9jYWwubWFuaWZlc3QubmFtZSlcblx0XHRcdFx0OiB0aGlzLmV4dGVuc2lvbi5nYWxsZXJ5ID8gZ2V0RXh0ZW5zaW9uSWQodGhpcy5leHRlbnNpb24uZ2FsbGVyeS5wdWJsaXNoZXIsIHRoaXMuZXh0ZW5zaW9uLmdhbGxlcnkubmFtZSlcblx0XHRcdFx0XHQ6IHRoaXMuZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQ7XG5cdFx0XHRjb25zdCBleHRlbnNpb25Bcmc6IElFeHRlbnNpb25BcmcgPSB7XG5cdFx0XHRcdGlkOiB0aGlzLmV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLFxuXHRcdFx0XHR2ZXJzaW9uOiB0aGlzLmV4dGVuc2lvbi52ZXJzaW9uLFxuXHRcdFx0XHRsb2NhdGlvbjogdGhpcy5leHRlbnNpb24ubG9jYWw/LmxvY2F0aW9uLFxuXHRcdFx0XHRnYWxsZXJ5TGluazogdGhpcy5leHRlbnNpb24udXJsXG5cdFx0XHR9O1xuXHRcdFx0YXdhaXQgdGhpcy5hY3Rpb24ucnVuKGlkLCBleHRlbnNpb25BcmcpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVG9nZ2xlUHJlUmVsZWFzZUV4dGVuc2lvbkFjdGlvbiBleHRlbmRzIEV4dGVuc2lvbkFjdGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi50b2dnbGVQcmVSbGVhc2UnO1xuXHRzdGF0aWMgcmVhZG9ubHkgTEFCRUwgPSBsb2NhbGl6ZSgndG9nZ2xlUHJlUmxlYXNlTGFiZWwnLCBcIlByZS1SZWxlYXNlXCIpO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEVuYWJsZWRDbGFzcyA9IGAke0V4dGVuc2lvbkFjdGlvbi5MQUJFTF9BQ1RJT05fQ0xBU1N9IHByZS1yZWxlYXNlYDtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgRGlzYWJsZWRDbGFzcyA9IGAke3RoaXMuRW5hYmxlZENsYXNzfSBoaWRlYDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2U6IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSxcblx0XHRASUFsbG93ZWRFeHRlbnNpb25zU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGFsbG93ZWRFeHRlbnNpb25zU2VydmljZTogSUFsbG93ZWRFeHRlbnNpb25zU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoVG9nZ2xlUHJlUmVsZWFzZUV4dGVuc2lvbkFjdGlvbi5JRCwgVG9nZ2xlUHJlUmVsZWFzZUV4dGVuc2lvbkFjdGlvbi5MQUJFTCwgVG9nZ2xlUHJlUmVsZWFzZUV4dGVuc2lvbkFjdGlvbi5EaXNhYmxlZENsYXNzKTtcblx0XHR0aGlzLl9yZWdpc3RlcihhbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2Uub25EaWRDaGFuZ2VBbGxvd2VkRXh0ZW5zaW9uc0NvbmZpZ1ZhbHVlKCgpID0+IHRoaXMudXBkYXRlKCkpKTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgdXBkYXRlKCkge1xuXHRcdHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuXHRcdHRoaXMuY2xhc3MgPSBUb2dnbGVQcmVSZWxlYXNlRXh0ZW5zaW9uQWN0aW9uLkRpc2FibGVkQ2xhc3M7XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAodGhpcy5leHRlbnNpb24uaXNCdWlsdGluKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLmV4dGVuc2lvbi5zdGF0ZSAhPT0gRXh0ZW5zaW9uU3RhdGUuSW5zdGFsbGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICghdGhpcy5leHRlbnNpb24uaGFzUHJlUmVsZWFzZVZlcnNpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbi5nYWxsZXJ5KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLmV4dGVuc2lvbi5wcmVSZWxlYXNlKSB7XG5cdFx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uLmlzUHJlUmVsZWFzZVZlcnNpb24pIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuYWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlLmlzQWxsb3dlZCh7IGlkOiB0aGlzLmV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLCBwdWJsaXNoZXJEaXNwbGF5TmFtZTogdGhpcy5leHRlbnNpb24ucHVibGlzaGVyRGlzcGxheU5hbWUgfSkgIT09IHRydWUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uLnByZVJlbGVhc2UpIHtcblx0XHRcdGlmICghdGhpcy5leHRlbnNpb24uZ2FsbGVyeS5oYXNQcmVSZWxlYXNlVmVyc2lvbikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5hbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UuaXNBbGxvd2VkKHRoaXMuZXh0ZW5zaW9uLmdhbGxlcnkpICE9PSB0cnVlKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5lbmFibGVkID0gdHJ1ZTtcblx0XHR0aGlzLmNsYXNzID0gVG9nZ2xlUHJlUmVsZWFzZUV4dGVuc2lvbkFjdGlvbi5FbmFibGVkQ2xhc3M7XG5cblx0XHRpZiAodGhpcy5leHRlbnNpb24ucHJlUmVsZWFzZSkge1xuXHRcdFx0dGhpcy5sYWJlbCA9IGxvY2FsaXplKCd0b2dnbGVQcmVSbGVhc2VEaXNhYmxlTGFiZWwnLCBcIlN3aXRjaCB0byBSZWxlYXNlIFZlcnNpb25cIik7XG5cdFx0XHR0aGlzLnRvb2x0aXAgPSBsb2NhbGl6ZSgndG9nZ2xlUHJlUmxlYXNlRGlzYWJsZVRvb2x0aXAnLCBcIlRoaXMgd2lsbCBzd2l0Y2ggYW5kIGVuYWJsZSB1cGRhdGVzIHRvIHJlbGVhc2UgdmVyc2lvbnNcIik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubGFiZWwgPSBsb2NhbGl6ZSgnc3dpdGNoVG9QcmVSZWxlYXNlTGFiZWwnLCBcIlN3aXRjaCB0byBQcmUtUmVsZWFzZSBWZXJzaW9uXCIpO1xuXHRcdFx0dGhpcy50b29sdGlwID0gbG9jYWxpemUoJ3N3aXRjaFRvUHJlUmVsZWFzZVRvb2x0aXAnLCBcIlRoaXMgd2lsbCBzd2l0Y2ggdG8gcHJlLXJlbGVhc2UgdmVyc2lvbiBhbmQgZW5hYmxlIHVwZGF0ZXMgdG8gbGF0ZXN0IHZlcnNpb24gYWx3YXlzXCIpO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bigpOiBQcm9taXNlPGFueT4ge1xuXHRcdGlmICghdGhpcy5leHRlbnNpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5vcGVuKHRoaXMuZXh0ZW5zaW9uLCB7IHNob3dQcmVSZWxlYXNlVmVyc2lvbjogIXRoaXMuZXh0ZW5zaW9uLnByZVJlbGVhc2UgfSk7XG5cdFx0YXdhaXQgdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS50b2dnbGVQcmVSZWxlYXNlKHRoaXMuZXh0ZW5zaW9uKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgSW5zdGFsbEFub3RoZXJWZXJzaW9uQWN0aW9uIGV4dGVuZHMgRXh0ZW5zaW9uQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLmluc3RhbGwuYW5vdGhlclZlcnNpb24nO1xuXHRzdGF0aWMgcmVhZG9ubHkgTEFCRUwgPSBsb2NhbGl6ZSgnaW5zdGFsbCBhbm90aGVyIHZlcnNpb24nLCBcIkluc3RhbGwgU3BlY2lmaWMgVmVyc2lvbi4uLlwiKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRleHRlbnNpb246IElFeHRlbnNpb24gfCBudWxsLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgd2hlbkluc3RhbGxlZDogYm9vbGVhbixcblx0XHRASUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2U6IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2U6IElXb3JrYmVuY2hFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSxcblx0XHRASUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2U6IElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSxcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASUFsbG93ZWRFeHRlbnNpb25zU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGFsbG93ZWRFeHRlbnNpb25zU2VydmljZTogSUFsbG93ZWRFeHRlbnNpb25zU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoSW5zdGFsbEFub3RoZXJWZXJzaW9uQWN0aW9uLklELCBJbnN0YWxsQW5vdGhlclZlcnNpb25BY3Rpb24uTEFCRUwsIEV4dGVuc2lvbkFjdGlvbi5MQUJFTF9BQ1RJT05fQ0xBU1MpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGFsbG93ZWRFeHRlbnNpb25zU2VydmljZS5vbkRpZENoYW5nZUFsbG93ZWRFeHRlbnNpb25zQ29uZmlnVmFsdWUoKCkgPT4gdGhpcy51cGRhdGUoKSkpO1xuXHRcdHRoaXMuZXh0ZW5zaW9uID0gZXh0ZW5zaW9uO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHR1cGRhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5lbmFibGVkID0gISF0aGlzLmV4dGVuc2lvbiAmJiAhdGhpcy5leHRlbnNpb24uaXNCdWlsdGluICYmICEhdGhpcy5leHRlbnNpb24uaWRlbnRpZmllci51dWlkICYmICF0aGlzLmV4dGVuc2lvbi5kZXByZWNhdGlvbkluZm9cblx0XHRcdCYmIHRoaXMuYWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlLmlzQWxsb3dlZCh7IGlkOiB0aGlzLmV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLCBwdWJsaXNoZXJEaXNwbGF5TmFtZTogdGhpcy5leHRlbnNpb24ucHVibGlzaGVyRGlzcGxheU5hbWUgfSkgPT09IHRydWU7XG5cdFx0aWYgKHRoaXMuZW5hYmxlZCAmJiB0aGlzLndoZW5JbnN0YWxsZWQpIHtcblx0XHRcdHRoaXMuZW5hYmxlZCA9ICEhdGhpcy5leHRlbnNpb24/LmxvY2FsICYmICEhdGhpcy5leHRlbnNpb24uc2VydmVyICYmIHRoaXMuZXh0ZW5zaW9uLnN0YXRlID09PSBFeHRlbnNpb25TdGF0ZS5JbnN0YWxsZWQ7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKCk6IFByb21pc2U8YW55PiB7XG5cdFx0aWYgKCF0aGlzLmVuYWJsZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCB0YXJnZXRQbGF0Zm9ybSA9IHRoaXMuZXh0ZW5zaW9uLnNlcnZlciA/IGF3YWl0IHRoaXMuZXh0ZW5zaW9uLnNlcnZlci5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRUYXJnZXRQbGF0Zm9ybSgpIDogYXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRUYXJnZXRQbGF0Zm9ybSgpO1xuXHRcdGNvbnN0IGFsbFZlcnNpb25zID0gYXdhaXQgdGhpcy5leHRlbnNpb25HYWxsZXJ5U2VydmljZS5nZXRBbGxDb21wYXRpYmxlVmVyc2lvbnModGhpcy5leHRlbnNpb24uaWRlbnRpZmllciwgdGhpcy5leHRlbnNpb24ubG9jYWw/LnByZVJlbGVhc2UgPz8gdGhpcy5leHRlbnNpb24uZ2FsbGVyeT8ucHJvcGVydGllcy5pc1ByZVJlbGVhc2VWZXJzaW9uID8/IGZhbHNlLCB0YXJnZXRQbGF0Zm9ybSk7XG5cdFx0aWYgKCFhbGxWZXJzaW9ucy5sZW5ndGgpIHtcblx0XHRcdGF3YWl0IHRoaXMuZGlhbG9nU2VydmljZS5pbmZvKGxvY2FsaXplKCdubyB2ZXJzaW9ucycsIFwiVGhpcyBleHRlbnNpb24gaGFzIG5vIG90aGVyIHZlcnNpb25zLlwiKSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGlja3MgPSBhbGxWZXJzaW9ucy5tYXAoKHYsIGkpID0+IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGlkOiB2LnZlcnNpb24sXG5cdFx0XHRcdGxhYmVsOiB2LnZlcnNpb24sXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBgJHtmcm9tTm93KG5ldyBEYXRlKERhdGUucGFyc2Uodi5kYXRlKSksIHRydWUpfSR7di5pc1ByZVJlbGVhc2VWZXJzaW9uID8gYCAoJHtsb2NhbGl6ZSgncHJlLXJlbGVhc2UnLCBcInByZS1yZWxlYXNlXCIpfSlgIDogJyd9JHt2LnZlcnNpb24gPT09IHRoaXMuZXh0ZW5zaW9uPy5sb2NhbD8ubWFuaWZlc3QudmVyc2lvbiA/IGAgKCR7bG9jYWxpemUoJ2N1cnJlbnQnLCBcImN1cnJlbnRcIil9KWAgOiAnJ31gLFxuXHRcdFx0XHRhcmlhTGFiZWw6IGAke3YuaXNQcmVSZWxlYXNlVmVyc2lvbiA/ICdQcmUtUmVsZWFzZSB2ZXJzaW9uJyA6ICdSZWxlYXNlIHZlcnNpb24nfSAke3YudmVyc2lvbn1gLFxuXHRcdFx0XHRpc1ByZVJlbGVhc2VWZXJzaW9uOiB2LmlzUHJlUmVsZWFzZVZlcnNpb25cblx0XHRcdH07XG5cdFx0fSk7XG5cdFx0Y29uc3QgcGljayA9IGF3YWl0IHRoaXMucXVpY2tJbnB1dFNlcnZpY2UucGljayhwaWNrcyxcblx0XHRcdHtcblx0XHRcdFx0cGxhY2VIb2xkZXI6IGxvY2FsaXplKCdzZWxlY3RWZXJzaW9uJywgXCJTZWxlY3QgVmVyc2lvbiB0byBJbnN0YWxsXCIpLFxuXHRcdFx0XHRtYXRjaE9uRGV0YWlsOiB0cnVlXG5cdFx0XHR9KTtcblx0XHRpZiAocGljaykge1xuXHRcdFx0aWYgKHRoaXMuZXh0ZW5zaW9uLmxvY2FsPy5tYW5pZmVzdC52ZXJzaW9uID09PSBwaWNrLmlkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IG9wdGlvbnMgPSB7IGluc3RhbGxQcmVSZWxlYXNlVmVyc2lvbjogcGljay5pc1ByZVJlbGVhc2VWZXJzaW9uLCB2ZXJzaW9uOiBwaWNrLmlkIH07XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmluc3RhbGwodGhpcy5leHRlbnNpb24sIG9wdGlvbnMpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShQcm9tcHRFeHRlbnNpb25JbnN0YWxsRmFpbHVyZUFjdGlvbiwgdGhpcy5leHRlbnNpb24sIG9wdGlvbnMsIHBpY2suaWQsIEluc3RhbGxPcGVyYXRpb24uSW5zdGFsbCwgZXJyb3IpLnJ1bigpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG59XG5cbmV4cG9ydCBjbGFzcyBFbmFibGVGb3JXb3Jrc3BhY2VBY3Rpb24gZXh0ZW5kcyBFeHRlbnNpb25BY3Rpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICdleHRlbnNpb25zLmVuYWJsZUZvcldvcmtzcGFjZSc7XG5cdHN0YXRpYyByZWFkb25seSBMQUJFTCA9IGxvY2FsaXplKCdlbmFibGVGb3JXb3Jrc3BhY2VBY3Rpb24nLCBcIkVuYWJsZSAoV29ya3NwYWNlKVwiKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2U6IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2U6IElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihFbmFibGVGb3JXb3Jrc3BhY2VBY3Rpb24uSUQsIEVuYWJsZUZvcldvcmtzcGFjZUFjdGlvbi5MQUJFTCwgRXh0ZW5zaW9uQWN0aW9uLkxBQkVMX0FDVElPTl9DTEFTUyk7XG5cdFx0dGhpcy50b29sdGlwID0gbG9jYWxpemUoJ2VuYWJsZUZvcldvcmtzcGFjZUFjdGlvblRvb2xUaXAnLCBcIkVuYWJsZSB0aGlzIGV4dGVuc2lvbiBvbmx5IGluIHRoaXMgd29ya3NwYWNlXCIpO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHR1cGRhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5lbmFibGVkID0gZmFsc2U7XG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uICYmIHRoaXMuZXh0ZW5zaW9uLmxvY2FsICYmICF0aGlzLmV4dGVuc2lvbi5pc1dvcmtzcGFjZVNjb3BlZCkge1xuXHRcdFx0dGhpcy5lbmFibGVkID0gdGhpcy5leHRlbnNpb24uc3RhdGUgPT09IEV4dGVuc2lvblN0YXRlLkluc3RhbGxlZFxuXHRcdFx0XHQmJiAhdGhpcy5leHRlbnNpb25FbmFibGVtZW50U2VydmljZS5pc0VuYWJsZWQodGhpcy5leHRlbnNpb24ubG9jYWwpXG5cdFx0XHRcdCYmIHRoaXMuZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuY2FuQ2hhbmdlV29ya3NwYWNlRW5hYmxlbWVudCh0aGlzLmV4dGVuc2lvbi5sb2NhbCk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKCk6IFByb21pc2U8YW55PiB7XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5zZXRFbmFibGVtZW50KHRoaXMuZXh0ZW5zaW9uLCBFbmFibGVtZW50U3RhdGUuRW5hYmxlZFdvcmtzcGFjZSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEVuYWJsZUdsb2JhbGx5QWN0aW9uIGV4dGVuZHMgRXh0ZW5zaW9uQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZXh0ZW5zaW9ucy5lbmFibGVHbG9iYWxseSc7XG5cdHN0YXRpYyByZWFkb25seSBMQUJFTCA9IGxvY2FsaXplKCdlbmFibGVHbG9iYWxseUFjdGlvbicsIFwiRW5hYmxlXCIpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25FbmFibGVtZW50U2VydmljZTogSVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKEVuYWJsZUdsb2JhbGx5QWN0aW9uLklELCBFbmFibGVHbG9iYWxseUFjdGlvbi5MQUJFTCwgRXh0ZW5zaW9uQWN0aW9uLkxBQkVMX0FDVElPTl9DTEFTUyk7XG5cdFx0dGhpcy50b29sdGlwID0gbG9jYWxpemUoJ2VuYWJsZUdsb2JhbGx5QWN0aW9uVG9vbFRpcCcsIFwiRW5hYmxlIHRoaXMgZXh0ZW5zaW9uXCIpO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHR1cGRhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5lbmFibGVkID0gZmFsc2U7XG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uICYmIHRoaXMuZXh0ZW5zaW9uLmxvY2FsICYmICF0aGlzLmV4dGVuc2lvbi5pc1dvcmtzcGFjZVNjb3BlZCkge1xuXHRcdFx0dGhpcy5lbmFibGVkID0gdGhpcy5leHRlbnNpb24uc3RhdGUgPT09IEV4dGVuc2lvblN0YXRlLkluc3RhbGxlZFxuXHRcdFx0XHQmJiB0aGlzLmV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmlzRGlzYWJsZWRHbG9iYWxseSh0aGlzLmV4dGVuc2lvbi5sb2NhbClcblx0XHRcdFx0JiYgdGhpcy5leHRlbnNpb25FbmFibGVtZW50U2VydmljZS5jYW5DaGFuZ2VFbmFibGVtZW50KHRoaXMuZXh0ZW5zaW9uLmxvY2FsKTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oKTogUHJvbWlzZTxhbnk+IHtcblx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnNldEVuYWJsZW1lbnQodGhpcy5leHRlbnNpb24sIEVuYWJsZW1lbnRTdGF0ZS5FbmFibGVkR2xvYmFsbHkpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBEaXNhYmxlRm9yV29ya3NwYWNlQWN0aW9uIGV4dGVuZHMgRXh0ZW5zaW9uQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZXh0ZW5zaW9ucy5kaXNhYmxlRm9yV29ya3NwYWNlJztcblx0c3RhdGljIHJlYWRvbmx5IExBQkVMID0gbG9jYWxpemUoJ2Rpc2FibGVGb3JXb3Jrc3BhY2VBY3Rpb24nLCBcIkRpc2FibGUgKFdvcmtzcGFjZSlcIik7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlOiBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKERpc2FibGVGb3JXb3Jrc3BhY2VBY3Rpb24uSUQsIERpc2FibGVGb3JXb3Jrc3BhY2VBY3Rpb24uTEFCRUwsIEV4dGVuc2lvbkFjdGlvbi5MQUJFTF9BQ1RJT05fQ0xBU1MpO1xuXHRcdHRoaXMudG9vbHRpcCA9IGxvY2FsaXplKCdkaXNhYmxlRm9yV29ya3NwYWNlQWN0aW9uVG9vbFRpcCcsIFwiRGlzYWJsZSB0aGlzIGV4dGVuc2lvbiBvbmx5IGluIHRoaXMgd29ya3NwYWNlXCIpO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5leHRlbnNpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlRXh0ZW5zaW9ucygoKSA9PiB0aGlzLnVwZGF0ZSgpKSk7XG5cdH1cblxuXHR1cGRhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5lbmFibGVkID0gZmFsc2U7XG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uICYmIHRoaXMuZXh0ZW5zaW9uLmxvY2FsICYmICF0aGlzLmV4dGVuc2lvbi5pc1dvcmtzcGFjZVNjb3BlZCAmJiB0aGlzLmV4dGVuc2lvblNlcnZpY2UuZXh0ZW5zaW9ucy5zb21lKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoeyBpZDogZS5pZGVudGlmaWVyLnZhbHVlLCB1dWlkOiBlLnV1aWQgfSwgdGhpcy5leHRlbnNpb24hLmlkZW50aWZpZXIpICYmIHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSAhPT0gV29ya2JlbmNoU3RhdGUuRU1QVFkpKSB7XG5cdFx0XHR0aGlzLmVuYWJsZWQgPSB0aGlzLmV4dGVuc2lvbi5zdGF0ZSA9PT0gRXh0ZW5zaW9uU3RhdGUuSW5zdGFsbGVkXG5cdFx0XHRcdCYmICh0aGlzLmV4dGVuc2lvbi5lbmFibGVtZW50U3RhdGUgPT09IEVuYWJsZW1lbnRTdGF0ZS5FbmFibGVkR2xvYmFsbHkgfHwgdGhpcy5leHRlbnNpb24uZW5hYmxlbWVudFN0YXRlID09PSBFbmFibGVtZW50U3RhdGUuRW5hYmxlZFdvcmtzcGFjZSlcblx0XHRcdFx0JiYgdGhpcy5leHRlbnNpb25FbmFibGVtZW50U2VydmljZS5jYW5DaGFuZ2VXb3Jrc3BhY2VFbmFibGVtZW50KHRoaXMuZXh0ZW5zaW9uLmxvY2FsKTtcblx0XHR9XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oKTogUHJvbWlzZTxhbnk+IHtcblx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnNldEVuYWJsZW1lbnQodGhpcy5leHRlbnNpb24sIEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZFdvcmtzcGFjZSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIERpc2FibGVHbG9iYWxseUFjdGlvbiBleHRlbmRzIEV4dGVuc2lvbkFjdGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ2V4dGVuc2lvbnMuZGlzYWJsZUdsb2JhbGx5Jztcblx0c3RhdGljIHJlYWRvbmx5IExBQkVMID0gbG9jYWxpemUoJ2Rpc2FibGVHbG9iYWxseUFjdGlvbicsIFwiRGlzYWJsZVwiKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2U6IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2U6IElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoRGlzYWJsZUdsb2JhbGx5QWN0aW9uLklELCBEaXNhYmxlR2xvYmFsbHlBY3Rpb24uTEFCRUwsIEV4dGVuc2lvbkFjdGlvbi5MQUJFTF9BQ1RJT05fQ0xBU1MpO1xuXHRcdHRoaXMudG9vbHRpcCA9IGxvY2FsaXplKCdkaXNhYmxlR2xvYmFsbHlBY3Rpb25Ub29sVGlwJywgXCJEaXNhYmxlIHRoaXMgZXh0ZW5zaW9uXCIpO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5leHRlbnNpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlRXh0ZW5zaW9ucygoKSA9PiB0aGlzLnVwZGF0ZSgpKSk7XG5cdH1cblxuXHR1cGRhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5lbmFibGVkID0gZmFsc2U7XG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uICYmIHRoaXMuZXh0ZW5zaW9uLmxvY2FsICYmICF0aGlzLmV4dGVuc2lvbi5pc1dvcmtzcGFjZVNjb3BlZCAmJiB0aGlzLmV4dGVuc2lvblNlcnZpY2UuZXh0ZW5zaW9ucy5zb21lKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoeyBpZDogZS5pZGVudGlmaWVyLnZhbHVlLCB1dWlkOiBlLnV1aWQgfSwgdGhpcy5leHRlbnNpb24hLmlkZW50aWZpZXIpKSkge1xuXHRcdFx0dGhpcy5lbmFibGVkID0gdGhpcy5leHRlbnNpb24uc3RhdGUgPT09IEV4dGVuc2lvblN0YXRlLkluc3RhbGxlZFxuXHRcdFx0XHQmJiAodGhpcy5leHRlbnNpb24uZW5hYmxlbWVudFN0YXRlID09PSBFbmFibGVtZW50U3RhdGUuRW5hYmxlZEdsb2JhbGx5IHx8IHRoaXMuZXh0ZW5zaW9uLmVuYWJsZW1lbnRTdGF0ZSA9PT0gRW5hYmxlbWVudFN0YXRlLkVuYWJsZWRXb3Jrc3BhY2UpXG5cdFx0XHRcdCYmIHRoaXMuZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuY2FuQ2hhbmdlRW5hYmxlbWVudCh0aGlzLmV4dGVuc2lvbi5sb2NhbCk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKCk6IFByb21pc2U8YW55PiB7XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5zZXRFbmFibGVtZW50KHRoaXMuZXh0ZW5zaW9uLCBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRHbG9iYWxseSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIEVuYWJsZURyb3BEb3duQWN0aW9uIGV4dGVuZHMgQnV0dG9uV2l0aERyb3BEb3duRXh0ZW5zaW9uQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoJ2V4dGVuc2lvbnMuZW5hYmxlJywgRXh0ZW5zaW9uQWN0aW9uLkxBQkVMX0FDVElPTl9DTEFTUywgW1xuXHRcdFx0W1xuXHRcdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFbmFibGVHbG9iYWxseUFjdGlvbiksXG5cdFx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVuYWJsZUZvcldvcmtzcGFjZUFjdGlvbilcblx0XHRcdF1cblx0XHRdKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgRGlzYWJsZURyb3BEb3duQWN0aW9uIGV4dGVuZHMgQnV0dG9uV2l0aERyb3BEb3duRXh0ZW5zaW9uQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoJ2V4dGVuc2lvbnMuZGlzYWJsZScsIEV4dGVuc2lvbkFjdGlvbi5MQUJFTF9BQ1RJT05fQ0xBU1MsIFtbXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEaXNhYmxlR2xvYmFsbHlBY3Rpb24pLFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRGlzYWJsZUZvcldvcmtzcGFjZUFjdGlvbilcblx0XHRdXSk7XG5cdH1cblxufVxuXG5leHBvcnQgY2xhc3MgRXh0ZW5zaW9uUnVudGltZVN0YXRlQWN0aW9uIGV4dGVuZHMgRXh0ZW5zaW9uQWN0aW9uIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBFbmFibGVkQ2xhc3MgPSBgJHtFeHRlbnNpb25BY3Rpb24uTEFCRUxfQUNUSU9OX0NMQVNTfSByZWxvYWRgO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBEaXNhYmxlZENsYXNzID0gYCR7dGhpcy5FbmFibGVkQ2xhc3N9IGRpc2FibGVkYDtcblxuXHR1cGRhdGVXaGVuQ291bnRlckV4dGVuc2lvbkNoYW5nZXM6IGJvb2xlYW4gPSB0cnVlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSG9zdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBob3N0U2VydmljZTogSUhvc3RTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJVXBkYXRlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHVwZGF0ZVNlcnZpY2U6IElVcGRhdGVTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcignZXh0ZW5zaW9ucy5ydW50aW1lU3RhdGUnLCAnJywgRXh0ZW5zaW9uUnVudGltZVN0YXRlQWN0aW9uLkRpc2FibGVkQ2xhc3MsIGZhbHNlKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmV4dGVuc2lvblNlcnZpY2Uub25EaWRDaGFuZ2VFeHRlbnNpb25zKCgpID0+IHRoaXMudXBkYXRlKCkpKTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0dXBkYXRlKCk6IHZvaWQge1xuXHRcdHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuXHRcdHRoaXMudG9vbHRpcCA9ICcnO1xuXHRcdHRoaXMuY2xhc3MgPSBFeHRlbnNpb25SdW50aW1lU3RhdGVBY3Rpb24uRGlzYWJsZWRDbGFzcztcblxuXHRcdGlmICghdGhpcy5leHRlbnNpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzdGF0ZSA9IHRoaXMuZXh0ZW5zaW9uLnN0YXRlO1xuXHRcdGlmIChzdGF0ZSA9PT0gRXh0ZW5zaW9uU3RhdGUuSW5zdGFsbGluZyB8fCBzdGF0ZSA9PT0gRXh0ZW5zaW9uU3RhdGUuVW5pbnN0YWxsaW5nKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uLmxvY2FsICYmIHRoaXMuZXh0ZW5zaW9uLmxvY2FsLm1hbmlmZXN0ICYmIHRoaXMuZXh0ZW5zaW9uLmxvY2FsLm1hbmlmZXN0LmNvbnRyaWJ1dGVzICYmIHRoaXMuZXh0ZW5zaW9uLmxvY2FsLm1hbmlmZXN0LmNvbnRyaWJ1dGVzLmxvY2FsaXphdGlvbnMgJiYgdGhpcy5leHRlbnNpb24ubG9jYWwubWFuaWZlc3QuY29udHJpYnV0ZXMubG9jYWxpemF0aW9ucy5sZW5ndGggPiAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcnVudGltZVN0YXRlID0gdGhpcy5leHRlbnNpb24ucnVudGltZVN0YXRlO1xuXHRcdGlmICghcnVudGltZVN0YXRlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5lbmFibGVkID0gdHJ1ZTtcblx0XHR0aGlzLmNsYXNzID0gRXh0ZW5zaW9uUnVudGltZVN0YXRlQWN0aW9uLkVuYWJsZWRDbGFzcztcblx0XHR0aGlzLnRvb2x0aXAgPSBydW50aW1lU3RhdGUucmVhc29uO1xuXHRcdHRoaXMubGFiZWwgPSBydW50aW1lU3RhdGUuYWN0aW9uID09PSBFeHRlbnNpb25SdW50aW1lQWN0aW9uVHlwZS5SZWxvYWRXaW5kb3cgPyBsb2NhbGl6ZSgncmVsb2FkIHdpbmRvdycsICdSZWxvYWQgV2luZG93Jylcblx0XHRcdDogcnVudGltZVN0YXRlLmFjdGlvbiA9PT0gRXh0ZW5zaW9uUnVudGltZUFjdGlvblR5cGUuUmVzdGFydEV4dGVuc2lvbnMgPyBsb2NhbGl6ZSgncmVzdGFydCBleHRlbnNpb25zJywgJ1Jlc3RhcnQgRXh0ZW5zaW9ucycpXG5cdFx0XHRcdDogcnVudGltZVN0YXRlLmFjdGlvbiA9PT0gRXh0ZW5zaW9uUnVudGltZUFjdGlvblR5cGUuUXVpdEFuZEluc3RhbGwgPyBsb2NhbGl6ZSgncmVzdGFydCBwcm9kdWN0JywgJ1Jlc3RhcnQgdG8gVXBkYXRlJylcblx0XHRcdFx0XHQ6IHJ1bnRpbWVTdGF0ZS5hY3Rpb24gPT09IEV4dGVuc2lvblJ1bnRpbWVBY3Rpb25UeXBlLkFwcGx5VXBkYXRlIHx8IHJ1bnRpbWVTdGF0ZS5hY3Rpb24gPT09IEV4dGVuc2lvblJ1bnRpbWVBY3Rpb25UeXBlLkRvd25sb2FkVXBkYXRlID8gbG9jYWxpemUoJ3VwZGF0ZSBwcm9kdWN0JywgJ1VwZGF0ZSB7MH0nLCB0aGlzLnByb2R1Y3RTZXJ2aWNlLm5hbWVTaG9ydCkgOiAnJztcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bigpOiBQcm9taXNlPGFueT4ge1xuXHRcdGNvbnN0IHJ1bnRpbWVTdGF0ZSA9IHRoaXMuZXh0ZW5zaW9uPy5ydW50aW1lU3RhdGU7XG5cdFx0aWYgKCFydW50aW1lU3RhdGU/LmFjdGlvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHR5cGUgRXh0ZW5zaW9uUnVudGltZVN0YXRlQWN0aW9uQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRvd25lcjogJ3NhbmR5MDgxJztcblx0XHRcdGNvbW1lbnQ6ICdFeHRlbnNpb24gcnVudGltZSBzdGF0ZSBhY3Rpb24gZXZlbnQnO1xuXHRcdFx0YWN0aW9uOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnRXhlY3V0ZWQgYWN0aW9uJyB9O1xuXHRcdH07XG5cdFx0dHlwZSBFeHRlbnNpb25SdW50aW1lU3RhdGVBY3Rpb25FdmVudCA9IHtcblx0XHRcdGFjdGlvbjogc3RyaW5nO1xuXHRcdH07XG5cdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8RXh0ZW5zaW9uUnVudGltZVN0YXRlQWN0aW9uRXZlbnQsIEV4dGVuc2lvblJ1bnRpbWVTdGF0ZUFjdGlvbkNsYXNzaWZpY2F0aW9uPignZXh0ZW5zaW9uczpydW50aW1lc3RhdGU6YWN0aW9uJywge1xuXHRcdFx0YWN0aW9uOiBydW50aW1lU3RhdGUuYWN0aW9uXG5cdFx0fSk7XG5cblx0XHRpZiAocnVudGltZVN0YXRlPy5hY3Rpb24gPT09IEV4dGVuc2lvblJ1bnRpbWVBY3Rpb25UeXBlLlJlbG9hZFdpbmRvdykge1xuXHRcdFx0cmV0dXJuIHRoaXMuaG9zdFNlcnZpY2UucmVsb2FkKCk7XG5cdFx0fVxuXG5cdFx0ZWxzZSBpZiAocnVudGltZVN0YXRlPy5hY3Rpb24gPT09IEV4dGVuc2lvblJ1bnRpbWVBY3Rpb25UeXBlLlJlc3RhcnRFeHRlbnNpb25zKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS51cGRhdGVSdW5uaW5nRXh0ZW5zaW9ucygpO1xuXHRcdH1cblxuXHRcdGVsc2UgaWYgKHJ1bnRpbWVTdGF0ZT8uYWN0aW9uID09PSBFeHRlbnNpb25SdW50aW1lQWN0aW9uVHlwZS5Eb3dubG9hZFVwZGF0ZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMudXBkYXRlU2VydmljZS5kb3dubG9hZFVwZGF0ZSgpO1xuXHRcdH1cblxuXHRcdGVsc2UgaWYgKHJ1bnRpbWVTdGF0ZT8uYWN0aW9uID09PSBFeHRlbnNpb25SdW50aW1lQWN0aW9uVHlwZS5BcHBseVVwZGF0ZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMudXBkYXRlU2VydmljZS5hcHBseVVwZGF0ZSgpO1xuXHRcdH1cblxuXHRcdGVsc2UgaWYgKHJ1bnRpbWVTdGF0ZT8uYWN0aW9uID09PSBFeHRlbnNpb25SdW50aW1lQWN0aW9uVHlwZS5RdWl0QW5kSW5zdGFsbCkge1xuXHRcdFx0cmV0dXJuIHRoaXMudXBkYXRlU2VydmljZS5xdWl0QW5kSW5zdGFsbCgpO1xuXHRcdH1cblxuXHR9XG59XG5cbmZ1bmN0aW9uIGlzVGhlbWVGcm9tRXh0ZW5zaW9uKHRoZW1lOiBJV29ya2JlbmNoVGhlbWUsIGV4dGVuc2lvbjogSUV4dGVuc2lvbiB8IHVuZGVmaW5lZCB8IG51bGwpOiBib29sZWFuIHtcblx0cmV0dXJuICEhKGV4dGVuc2lvbiAmJiB0aGVtZS5leHRlbnNpb25EYXRhICYmIEV4dGVuc2lvbklkZW50aWZpZXIuZXF1YWxzKHRoZW1lLmV4dGVuc2lvbkRhdGEuZXh0ZW5zaW9uSWQsIGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkKSk7XG59XG5cbmZ1bmN0aW9uIGdldFF1aWNrUGlja0VudHJpZXModGhlbWVzOiBJV29ya2JlbmNoVGhlbWVbXSwgY3VycmVudFRoZW1lOiBJV29ya2JlbmNoVGhlbWUsIGV4dGVuc2lvbjogSUV4dGVuc2lvbiB8IG51bGwgfCB1bmRlZmluZWQsIHNob3dDdXJyZW50VGhlbWU6IGJvb2xlYW4pOiBRdWlja1BpY2tJdGVtW10ge1xuXHRjb25zdCBwaWNrczogUXVpY2tQaWNrSXRlbVtdID0gW107XG5cdGZvciAoY29uc3QgdGhlbWUgb2YgdGhlbWVzKSB7XG5cdFx0aWYgKGlzVGhlbWVGcm9tRXh0ZW5zaW9uKHRoZW1lLCBleHRlbnNpb24pICYmICEoc2hvd0N1cnJlbnRUaGVtZSAmJiB0aGVtZSA9PT0gY3VycmVudFRoZW1lKSkge1xuXHRcdFx0cGlja3MucHVzaCh7IGxhYmVsOiB0aGVtZS5sYWJlbCwgaWQ6IHRoZW1lLmlkIH0pO1xuXHRcdH1cblx0fVxuXHRpZiAoc2hvd0N1cnJlbnRUaGVtZSkge1xuXHRcdHBpY2tzLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJywgbGFiZWw6IGxvY2FsaXplKCdjdXJyZW50JywgXCJjdXJyZW50XCIpIH0pO1xuXHRcdHBpY2tzLnB1c2goeyBsYWJlbDogY3VycmVudFRoZW1lLmxhYmVsLCBpZDogY3VycmVudFRoZW1lLmlkIH0pO1xuXHR9XG5cdHJldHVybiBwaWNrcztcbn1cblxuZXhwb3J0IGNsYXNzIFNldENvbG9yVGhlbWVBY3Rpb24gZXh0ZW5kcyBFeHRlbnNpb25BY3Rpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uc2V0Q29sb3JUaGVtZSc7XG5cdHN0YXRpYyByZWFkb25seSBUSVRMRSA9IGxvY2FsaXplMignd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLnNldENvbG9yVGhlbWUnLCAnU2V0IENvbG9yIFRoZW1lJyk7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgRW5hYmxlZENsYXNzID0gYCR7RXh0ZW5zaW9uQWN0aW9uLkxBQkVMX0FDVElPTl9DTEFTU30gdGhlbWVgO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBEaXNhYmxlZENsYXNzID0gYCR7dGhpcy5FbmFibGVkQ2xhc3N9IGRpc2FibGVkYDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hUaGVtZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3JrYmVuY2hUaGVtZVNlcnZpY2U6IElXb3JrYmVuY2hUaGVtZVNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHF1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKFNldENvbG9yVGhlbWVBY3Rpb24uSUQsIFNldENvbG9yVGhlbWVBY3Rpb24uVElUTEUudmFsdWUsIFNldENvbG9yVGhlbWVBY3Rpb24uRGlzYWJsZWRDbGFzcywgZmFsc2UpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmFueTxhbnk+KGV4dGVuc2lvblNlcnZpY2Uub25EaWRDaGFuZ2VFeHRlbnNpb25zLCB3b3JrYmVuY2hUaGVtZVNlcnZpY2Uub25EaWRDb2xvclRoZW1lQ2hhbmdlKSgoKSA9PiB0aGlzLnVwZGF0ZSgpLCB0aGlzKSk7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdHVwZGF0ZSgpOiB2b2lkIHtcblx0XHR0aGlzLndvcmtiZW5jaFRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lcygpLnRoZW4oY29sb3JUaGVtZXMgPT4ge1xuXHRcdFx0dGhpcy5lbmFibGVkID0gdGhpcy5jb21wdXRlRW5hYmxlbWVudChjb2xvclRoZW1lcyk7XG5cdFx0XHR0aGlzLmNsYXNzID0gdGhpcy5lbmFibGVkID8gU2V0Q29sb3JUaGVtZUFjdGlvbi5FbmFibGVkQ2xhc3MgOiBTZXRDb2xvclRoZW1lQWN0aW9uLkRpc2FibGVkQ2xhc3M7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGNvbXB1dGVFbmFibGVtZW50KGNvbG9yVGhlbWVzOiBJV29ya2JlbmNoQ29sb3JUaGVtZVtdKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5leHRlbnNpb24gJiYgdGhpcy5leHRlbnNpb24uc3RhdGUgPT09IEV4dGVuc2lvblN0YXRlLkluc3RhbGxlZCAmJiB0aGlzLmV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZEVuYWJsZW1lbnRTdGF0ZSh0aGlzLmV4dGVuc2lvbi5lbmFibGVtZW50U3RhdGUpICYmIGNvbG9yVGhlbWVzLnNvbWUodGggPT4gaXNUaGVtZUZyb21FeHRlbnNpb24odGgsIHRoaXMuZXh0ZW5zaW9uKSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oeyBzaG93Q3VycmVudFRoZW1lLCBpZ25vcmVGb2N1c0xvc3QgfTogeyBzaG93Q3VycmVudFRoZW1lOiBib29sZWFuOyBpZ25vcmVGb2N1c0xvc3Q6IGJvb2xlYW4gfSA9IHsgc2hvd0N1cnJlbnRUaGVtZTogZmFsc2UsIGlnbm9yZUZvY3VzTG9zdDogZmFsc2UgfSk6IFByb21pc2U8YW55PiB7XG5cdFx0Y29uc3QgY29sb3JUaGVtZXMgPSBhd2FpdCB0aGlzLndvcmtiZW5jaFRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lcygpO1xuXG5cdFx0aWYgKCF0aGlzLmNvbXB1dGVFbmFibGVtZW50KGNvbG9yVGhlbWVzKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBjdXJyZW50VGhlbWUgPSB0aGlzLndvcmtiZW5jaFRoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCk7XG5cblx0XHRjb25zdCBkZWxheWVyID0gbmV3IERlbGF5ZXI8YW55PigxMDApO1xuXHRcdGNvbnN0IHBpY2tzID0gZ2V0UXVpY2tQaWNrRW50cmllcyhjb2xvclRoZW1lcywgY3VycmVudFRoZW1lLCB0aGlzLmV4dGVuc2lvbiwgc2hvd0N1cnJlbnRUaGVtZSk7XG5cdFx0Y29uc3QgcGlja2VkVGhlbWUgPSBhd2FpdCB0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLnBpY2soXG5cdFx0XHRwaWNrcyxcblx0XHRcdHtcblx0XHRcdFx0cGxhY2VIb2xkZXI6IGxvY2FsaXplKCdzZWxlY3QgY29sb3IgdGhlbWUnLCBcIlNlbGVjdCBDb2xvciBUaGVtZVwiKSxcblx0XHRcdFx0b25EaWRGb2N1czogaXRlbSA9PiBkZWxheWVyLnRyaWdnZXIoKCkgPT4gdGhpcy53b3JrYmVuY2hUaGVtZVNlcnZpY2Uuc2V0Q29sb3JUaGVtZShpdGVtLmlkLCB1bmRlZmluZWQpKSxcblx0XHRcdFx0aWdub3JlRm9jdXNMb3N0XG5cdFx0XHR9KTtcblx0XHRyZXR1cm4gdGhpcy53b3JrYmVuY2hUaGVtZVNlcnZpY2Uuc2V0Q29sb3JUaGVtZShwaWNrZWRUaGVtZSA/IHBpY2tlZFRoZW1lLmlkIDogY3VycmVudFRoZW1lLmlkLCAnYXV0bycpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTZXRGaWxlSWNvblRoZW1lQWN0aW9uIGV4dGVuZHMgRXh0ZW5zaW9uQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLnNldEZpbGVJY29uVGhlbWUnO1xuXHRzdGF0aWMgcmVhZG9ubHkgVElUTEUgPSBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5zZXRGaWxlSWNvblRoZW1lJywgJ1NldCBGaWxlIEljb24gVGhlbWUnKTtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBFbmFibGVkQ2xhc3MgPSBgJHtFeHRlbnNpb25BY3Rpb24uTEFCRUxfQUNUSU9OX0NMQVNTfSB0aGVtZWA7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IERpc2FibGVkQ2xhc3MgPSBgJHt0aGlzLkVuYWJsZWRDbGFzc30gZGlzYWJsZWRgO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASVdvcmtiZW5jaFRoZW1lU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtiZW5jaFRoZW1lU2VydmljZTogSVdvcmtiZW5jaFRoZW1lU2VydmljZSxcblx0XHRASVF1aWNrSW5wdXRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2U6IElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoU2V0RmlsZUljb25UaGVtZUFjdGlvbi5JRCwgU2V0RmlsZUljb25UaGVtZUFjdGlvbi5USVRMRS52YWx1ZSwgU2V0RmlsZUljb25UaGVtZUFjdGlvbi5EaXNhYmxlZENsYXNzLCBmYWxzZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuYW55PGFueT4oZXh0ZW5zaW9uU2VydmljZS5vbkRpZENoYW5nZUV4dGVuc2lvbnMsIHdvcmtiZW5jaFRoZW1lU2VydmljZS5vbkRpZEZpbGVJY29uVGhlbWVDaGFuZ2UpKCgpID0+IHRoaXMudXBkYXRlKCksIHRoaXMpKTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0dXBkYXRlKCk6IHZvaWQge1xuXHRcdHRoaXMud29ya2JlbmNoVGhlbWVTZXJ2aWNlLmdldEZpbGVJY29uVGhlbWVzKCkudGhlbihmaWxlSWNvblRoZW1lcyA9PiB7XG5cdFx0XHR0aGlzLmVuYWJsZWQgPSB0aGlzLmNvbXB1dGVFbmFibGVtZW50KGZpbGVJY29uVGhlbWVzKTtcblx0XHRcdHRoaXMuY2xhc3MgPSB0aGlzLmVuYWJsZWQgPyBTZXRGaWxlSWNvblRoZW1lQWN0aW9uLkVuYWJsZWRDbGFzcyA6IFNldEZpbGVJY29uVGhlbWVBY3Rpb24uRGlzYWJsZWRDbGFzcztcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgY29tcHV0ZUVuYWJsZW1lbnQoY29sb3JUaGVtZmlsZUljb25UaGVtZXNzOiBJV29ya2JlbmNoRmlsZUljb25UaGVtZVtdKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5leHRlbnNpb24gJiYgdGhpcy5leHRlbnNpb24uc3RhdGUgPT09IEV4dGVuc2lvblN0YXRlLkluc3RhbGxlZCAmJiB0aGlzLmV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZEVuYWJsZW1lbnRTdGF0ZSh0aGlzLmV4dGVuc2lvbi5lbmFibGVtZW50U3RhdGUpICYmIGNvbG9yVGhlbWZpbGVJY29uVGhlbWVzcy5zb21lKHRoID0+IGlzVGhlbWVGcm9tRXh0ZW5zaW9uKHRoLCB0aGlzLmV4dGVuc2lvbikpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKHsgc2hvd0N1cnJlbnRUaGVtZSwgaWdub3JlRm9jdXNMb3N0IH06IHsgc2hvd0N1cnJlbnRUaGVtZTogYm9vbGVhbjsgaWdub3JlRm9jdXNMb3N0OiBib29sZWFuIH0gPSB7IHNob3dDdXJyZW50VGhlbWU6IGZhbHNlLCBpZ25vcmVGb2N1c0xvc3Q6IGZhbHNlIH0pOiBQcm9taXNlPGFueT4ge1xuXHRcdGNvbnN0IGZpbGVJY29uVGhlbWVzID0gYXdhaXQgdGhpcy53b3JrYmVuY2hUaGVtZVNlcnZpY2UuZ2V0RmlsZUljb25UaGVtZXMoKTtcblx0XHRpZiAoIXRoaXMuY29tcHV0ZUVuYWJsZW1lbnQoZmlsZUljb25UaGVtZXMpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IGN1cnJlbnRUaGVtZSA9IHRoaXMud29ya2JlbmNoVGhlbWVTZXJ2aWNlLmdldEZpbGVJY29uVGhlbWUoKTtcblxuXHRcdGNvbnN0IGRlbGF5ZXIgPSBuZXcgRGVsYXllcjxhbnk+KDEwMCk7XG5cdFx0Y29uc3QgcGlja3MgPSBnZXRRdWlja1BpY2tFbnRyaWVzKGZpbGVJY29uVGhlbWVzLCBjdXJyZW50VGhlbWUsIHRoaXMuZXh0ZW5zaW9uLCBzaG93Q3VycmVudFRoZW1lKTtcblx0XHRjb25zdCBwaWNrZWRUaGVtZSA9IGF3YWl0IHRoaXMucXVpY2tJbnB1dFNlcnZpY2UucGljayhcblx0XHRcdHBpY2tzLFxuXHRcdFx0e1xuXHRcdFx0XHRwbGFjZUhvbGRlcjogbG9jYWxpemUoJ3NlbGVjdCBmaWxlIGljb24gdGhlbWUnLCBcIlNlbGVjdCBGaWxlIEljb24gVGhlbWVcIiksXG5cdFx0XHRcdG9uRGlkRm9jdXM6IGl0ZW0gPT4gZGVsYXllci50cmlnZ2VyKCgpID0+IHRoaXMud29ya2JlbmNoVGhlbWVTZXJ2aWNlLnNldEZpbGVJY29uVGhlbWUoaXRlbS5pZCwgdW5kZWZpbmVkKSksXG5cdFx0XHRcdGlnbm9yZUZvY3VzTG9zdFxuXHRcdFx0fSk7XG5cdFx0cmV0dXJuIHRoaXMud29ya2JlbmNoVGhlbWVTZXJ2aWNlLnNldEZpbGVJY29uVGhlbWUocGlja2VkVGhlbWUgPyBwaWNrZWRUaGVtZS5pZCA6IGN1cnJlbnRUaGVtZS5pZCwgJ2F1dG8nKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgU2V0UHJvZHVjdEljb25UaGVtZUFjdGlvbiBleHRlbmRzIEV4dGVuc2lvbkFjdGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5zZXRQcm9kdWN0SWNvblRoZW1lJztcblx0c3RhdGljIHJlYWRvbmx5IFRJVExFID0gbG9jYWxpemUyKCd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uc2V0UHJvZHVjdEljb25UaGVtZScsICdTZXQgUHJvZHVjdCBJY29uIFRoZW1lJyk7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgRW5hYmxlZENsYXNzID0gYCR7RXh0ZW5zaW9uQWN0aW9uLkxBQkVMX0FDVElPTl9DTEFTU30gdGhlbWVgO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBEaXNhYmxlZENsYXNzID0gYCR7dGhpcy5FbmFibGVkQ2xhc3N9IGRpc2FibGVkYDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hUaGVtZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3JrYmVuY2hUaGVtZVNlcnZpY2U6IElXb3JrYmVuY2hUaGVtZVNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHF1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKFNldFByb2R1Y3RJY29uVGhlbWVBY3Rpb24uSUQsIFNldFByb2R1Y3RJY29uVGhlbWVBY3Rpb24uVElUTEUudmFsdWUsIFNldFByb2R1Y3RJY29uVGhlbWVBY3Rpb24uRGlzYWJsZWRDbGFzcywgZmFsc2UpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKEV2ZW50LmFueTxhbnk+KGV4dGVuc2lvblNlcnZpY2Uub25EaWRDaGFuZ2VFeHRlbnNpb25zLCB3b3JrYmVuY2hUaGVtZVNlcnZpY2Uub25EaWRQcm9kdWN0SWNvblRoZW1lQ2hhbmdlKSgoKSA9PiB0aGlzLnVwZGF0ZSgpLCB0aGlzKSk7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdHVwZGF0ZSgpOiB2b2lkIHtcblx0XHR0aGlzLndvcmtiZW5jaFRoZW1lU2VydmljZS5nZXRQcm9kdWN0SWNvblRoZW1lcygpLnRoZW4ocHJvZHVjdEljb25UaGVtZXMgPT4ge1xuXHRcdFx0dGhpcy5lbmFibGVkID0gdGhpcy5jb21wdXRlRW5hYmxlbWVudChwcm9kdWN0SWNvblRoZW1lcyk7XG5cdFx0XHR0aGlzLmNsYXNzID0gdGhpcy5lbmFibGVkID8gU2V0UHJvZHVjdEljb25UaGVtZUFjdGlvbi5FbmFibGVkQ2xhc3MgOiBTZXRQcm9kdWN0SWNvblRoZW1lQWN0aW9uLkRpc2FibGVkQ2xhc3M7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGNvbXB1dGVFbmFibGVtZW50KHByb2R1Y3RJY29uVGhlbWVzOiBJV29ya2JlbmNoUHJvZHVjdEljb25UaGVtZVtdKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhdGhpcy5leHRlbnNpb24gJiYgdGhpcy5leHRlbnNpb24uc3RhdGUgPT09IEV4dGVuc2lvblN0YXRlLkluc3RhbGxlZCAmJiB0aGlzLmV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZEVuYWJsZW1lbnRTdGF0ZSh0aGlzLmV4dGVuc2lvbi5lbmFibGVtZW50U3RhdGUpICYmIHByb2R1Y3RJY29uVGhlbWVzLnNvbWUodGggPT4gaXNUaGVtZUZyb21FeHRlbnNpb24odGgsIHRoaXMuZXh0ZW5zaW9uKSk7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oeyBzaG93Q3VycmVudFRoZW1lLCBpZ25vcmVGb2N1c0xvc3QgfTogeyBzaG93Q3VycmVudFRoZW1lOiBib29sZWFuOyBpZ25vcmVGb2N1c0xvc3Q6IGJvb2xlYW4gfSA9IHsgc2hvd0N1cnJlbnRUaGVtZTogZmFsc2UsIGlnbm9yZUZvY3VzTG9zdDogZmFsc2UgfSk6IFByb21pc2U8YW55PiB7XG5cdFx0Y29uc3QgcHJvZHVjdEljb25UaGVtZXMgPSBhd2FpdCB0aGlzLndvcmtiZW5jaFRoZW1lU2VydmljZS5nZXRQcm9kdWN0SWNvblRoZW1lcygpO1xuXHRcdGlmICghdGhpcy5jb21wdXRlRW5hYmxlbWVudChwcm9kdWN0SWNvblRoZW1lcykpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjdXJyZW50VGhlbWUgPSB0aGlzLndvcmtiZW5jaFRoZW1lU2VydmljZS5nZXRQcm9kdWN0SWNvblRoZW1lKCk7XG5cblx0XHRjb25zdCBkZWxheWVyID0gbmV3IERlbGF5ZXI8YW55PigxMDApO1xuXHRcdGNvbnN0IHBpY2tzID0gZ2V0UXVpY2tQaWNrRW50cmllcyhwcm9kdWN0SWNvblRoZW1lcywgY3VycmVudFRoZW1lLCB0aGlzLmV4dGVuc2lvbiwgc2hvd0N1cnJlbnRUaGVtZSk7XG5cdFx0Y29uc3QgcGlja2VkVGhlbWUgPSBhd2FpdCB0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLnBpY2soXG5cdFx0XHRwaWNrcyxcblx0XHRcdHtcblx0XHRcdFx0cGxhY2VIb2xkZXI6IGxvY2FsaXplKCdzZWxlY3QgcHJvZHVjdCBpY29uIHRoZW1lJywgXCJTZWxlY3QgUHJvZHVjdCBJY29uIFRoZW1lXCIpLFxuXHRcdFx0XHRvbkRpZEZvY3VzOiBpdGVtID0+IGRlbGF5ZXIudHJpZ2dlcigoKSA9PiB0aGlzLndvcmtiZW5jaFRoZW1lU2VydmljZS5zZXRQcm9kdWN0SWNvblRoZW1lKGl0ZW0uaWQsIHVuZGVmaW5lZCkpLFxuXHRcdFx0XHRpZ25vcmVGb2N1c0xvc3Rcblx0XHRcdH0pO1xuXHRcdHJldHVybiB0aGlzLndvcmtiZW5jaFRoZW1lU2VydmljZS5zZXRQcm9kdWN0SWNvblRoZW1lKHBpY2tlZFRoZW1lID8gcGlja2VkVGhlbWUuaWQgOiBjdXJyZW50VGhlbWUuaWQsICdhdXRvJyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFNldExhbmd1YWdlQWN0aW9uIGV4dGVuZHMgRXh0ZW5zaW9uQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLnNldERpc3BsYXlMYW5ndWFnZSc7XG5cdHN0YXRpYyByZWFkb25seSBUSVRMRSA9IGxvY2FsaXplMignd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLnNldERpc3BsYXlMYW5ndWFnZScsICdTZXQgRGlzcGxheSBMYW5ndWFnZScpO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEVuYWJsZWRDbGFzcyA9IGAke0V4dGVuc2lvbkFjdGlvbi5MQUJFTF9BQ1RJT05fQ0xBU1N9IGxhbmd1YWdlYDtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgRGlzYWJsZWRDbGFzcyA9IGAke3RoaXMuRW5hYmxlZENsYXNzfSBkaXNhYmxlZGA7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlOiBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKFNldExhbmd1YWdlQWN0aW9uLklELCBTZXRMYW5ndWFnZUFjdGlvbi5USVRMRS52YWx1ZSwgU2V0TGFuZ3VhZ2VBY3Rpb24uRGlzYWJsZWRDbGFzcywgZmFsc2UpO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHR1cGRhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5lbmFibGVkID0gZmFsc2U7XG5cdFx0dGhpcy5jbGFzcyA9IFNldExhbmd1YWdlQWN0aW9uLkRpc2FibGVkQ2xhc3M7XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuY2FuU2V0TGFuZ3VhZ2UodGhpcy5leHRlbnNpb24pKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLmV4dGVuc2lvbi5nYWxsZXJ5ICYmIGxhbmd1YWdlID09PSBnZXRMb2NhbGUodGhpcy5leHRlbnNpb24uZ2FsbGVyeSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5lbmFibGVkID0gdHJ1ZTtcblx0XHR0aGlzLmNsYXNzID0gU2V0TGFuZ3VhZ2VBY3Rpb24uRW5hYmxlZENsYXNzO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKCk6IFByb21pc2U8YW55PiB7XG5cdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uICYmIHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uuc2V0TGFuZ3VhZ2UodGhpcy5leHRlbnNpb24pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDbGVhckxhbmd1YWdlQWN0aW9uIGV4dGVuZHMgRXh0ZW5zaW9uQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLmNsZWFyTGFuZ3VhZ2UnO1xuXHRzdGF0aWMgcmVhZG9ubHkgVElUTEUgPSBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5jbGVhckxhbmd1YWdlJywgJ0NsZWFyIERpc3BsYXkgTGFuZ3VhZ2UnKTtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBFbmFibGVkQ2xhc3MgPSBgJHtFeHRlbnNpb25BY3Rpb24uTEFCRUxfQUNUSU9OX0NMQVNTfSBsYW5ndWFnZWA7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IERpc2FibGVkQ2xhc3MgPSBgJHt0aGlzLkVuYWJsZWRDbGFzc30gZGlzYWJsZWRgO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJTG9jYWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvY2FsZVNlcnZpY2U6IElMb2NhbGVTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihDbGVhckxhbmd1YWdlQWN0aW9uLklELCBDbGVhckxhbmd1YWdlQWN0aW9uLlRJVExFLnZhbHVlLCBDbGVhckxhbmd1YWdlQWN0aW9uLkRpc2FibGVkQ2xhc3MsIGZhbHNlKTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0dXBkYXRlKCk6IHZvaWQge1xuXHRcdHRoaXMuZW5hYmxlZCA9IGZhbHNlO1xuXHRcdHRoaXMuY2xhc3MgPSBDbGVhckxhbmd1YWdlQWN0aW9uLkRpc2FibGVkQ2xhc3M7XG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuY2FuU2V0TGFuZ3VhZ2UodGhpcy5leHRlbnNpb24pKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmICh0aGlzLmV4dGVuc2lvbi5nYWxsZXJ5ICYmIGxhbmd1YWdlICE9PSBnZXRMb2NhbGUodGhpcy5leHRlbnNpb24uZ2FsbGVyeSkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0dGhpcy5lbmFibGVkID0gdHJ1ZTtcblx0XHR0aGlzLmNsYXNzID0gQ2xlYXJMYW5ndWFnZUFjdGlvbi5FbmFibGVkQ2xhc3M7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyBydW4oKTogUHJvbWlzZTxhbnk+IHtcblx0XHRyZXR1cm4gdGhpcy5leHRlbnNpb24gJiYgdGhpcy5sb2NhbGVTZXJ2aWNlLmNsZWFyTG9jYWxlUHJlZmVyZW5jZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTaG93UmVjb21tZW5kZWRFeHRlbnNpb25BY3Rpb24gZXh0ZW5kcyBBY3Rpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uc2hvd1JlY29tbWVuZGVkRXh0ZW5zaW9uJztcblx0c3RhdGljIHJlYWRvbmx5IExBQkVMID0gbG9jYWxpemUoJ3Nob3dSZWNvbW1lbmRlZEV4dGVuc2lvbicsIFwiU2hvdyBSZWNvbW1lbmRlZCBFeHRlbnNpb25cIik7XG5cblx0cHJpdmF0ZSBleHRlbnNpb25JZDogc3RyaW5nO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGV4dGVuc2lvbklkOiBzdHJpbmcsXG5cdFx0QElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbldvcmtiZW5jaFNlcnZpY2U6IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoU2hvd1JlY29tbWVuZGVkRXh0ZW5zaW9uQWN0aW9uLklELCBTaG93UmVjb21tZW5kZWRFeHRlbnNpb25BY3Rpb24uTEFCRUwsIHVuZGVmaW5lZCwgZmFsc2UpO1xuXHRcdHRoaXMuZXh0ZW5zaW9uSWQgPSBleHRlbnNpb25JZDtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bigpOiBQcm9taXNlPGFueT4ge1xuXHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uV29ya2JlbmNoU2VydmljZS5vcGVuU2VhcmNoKGBAaWQ6JHt0aGlzLmV4dGVuc2lvbklkfWApO1xuXHRcdGNvbnN0IFtleHRlbnNpb25dID0gYXdhaXQgdGhpcy5leHRlbnNpb25Xb3JrYmVuY2hTZXJ2aWNlLmdldEV4dGVuc2lvbnMoW3sgaWQ6IHRoaXMuZXh0ZW5zaW9uSWQgfV0sIHsgc291cmNlOiAnaW5zdGFsbC1yZWNvbW1lbmRhdGlvbicgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0aWYgKGV4dGVuc2lvbikge1xuXHRcdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uV29ya2JlbmNoU2VydmljZS5vcGVuKGV4dGVuc2lvbik7XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBJbnN0YWxsUmVjb21tZW5kZWRFeHRlbnNpb25BY3Rpb24gZXh0ZW5kcyBBY3Rpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uaW5zdGFsbFJlY29tbWVuZGVkRXh0ZW5zaW9uJztcblx0c3RhdGljIHJlYWRvbmx5IExBQkVMID0gbG9jYWxpemUoJ2luc3RhbGxSZWNvbW1lbmRlZEV4dGVuc2lvbicsIFwiSW5zdGFsbCBSZWNvbW1lbmRlZCBFeHRlbnNpb25cIik7XG5cblx0cHJpdmF0ZSBleHRlbnNpb25JZDogc3RyaW5nO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGV4dGVuc2lvbklkOiBzdHJpbmcsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbldvcmtiZW5jaFNlcnZpY2U6IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoSW5zdGFsbFJlY29tbWVuZGVkRXh0ZW5zaW9uQWN0aW9uLklELCBJbnN0YWxsUmVjb21tZW5kZWRFeHRlbnNpb25BY3Rpb24uTEFCRUwsIHVuZGVmaW5lZCwgZmFsc2UpO1xuXHRcdHRoaXMuZXh0ZW5zaW9uSWQgPSBleHRlbnNpb25JZDtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bigpOiBQcm9taXNlPGFueT4ge1xuXHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uV29ya2JlbmNoU2VydmljZS5vcGVuU2VhcmNoKGBAaWQ6JHt0aGlzLmV4dGVuc2lvbklkfWApO1xuXHRcdGNvbnN0IFtleHRlbnNpb25dID0gYXdhaXQgdGhpcy5leHRlbnNpb25Xb3JrYmVuY2hTZXJ2aWNlLmdldEV4dGVuc2lvbnMoW3sgaWQ6IHRoaXMuZXh0ZW5zaW9uSWQgfV0sIHsgc291cmNlOiAnaW5zdGFsbC1yZWNvbW1lbmRhdGlvbicgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0aWYgKGV4dGVuc2lvbikge1xuXHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25Xb3JrYmVuY2hTZXJ2aWNlLm9wZW4oZXh0ZW5zaW9uKTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uV29ya2JlbmNoU2VydmljZS5pbnN0YWxsKGV4dGVuc2lvbik7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0dGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShQcm9tcHRFeHRlbnNpb25JbnN0YWxsRmFpbHVyZUFjdGlvbiwgZXh0ZW5zaW9uLCB1bmRlZmluZWQsIGV4dGVuc2lvbi5sYXRlc3RWZXJzaW9uLCBJbnN0YWxsT3BlcmF0aW9uLkluc3RhbGwsIGVycikucnVuKCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBJZ25vcmVFeHRlbnNpb25SZWNvbW1lbmRhdGlvbkFjdGlvbiBleHRlbmRzIEFjdGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ2V4dGVuc2lvbnMuaWdub3JlJztcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBDbGFzcyA9IGAke0V4dGVuc2lvbkFjdGlvbi5MQUJFTF9BQ1RJT05fQ0xBU1N9IGlnbm9yZWA7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBleHRlbnNpb246IElFeHRlbnNpb24sXG5cdFx0QElFeHRlbnNpb25JZ25vcmVkUmVjb21tZW5kYXRpb25zU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblJlY29tbWVuZGF0aW9uc01hbmFnZW1lbnRTZXJ2aWNlOiBJRXh0ZW5zaW9uSWdub3JlZFJlY29tbWVuZGF0aW9uc1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKElnbm9yZUV4dGVuc2lvblJlY29tbWVuZGF0aW9uQWN0aW9uLklELCAnSWdub3JlIFJlY29tbWVuZGF0aW9uJyk7XG5cblx0XHR0aGlzLmNsYXNzID0gSWdub3JlRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25BY3Rpb24uQ2xhc3M7XG5cdFx0dGhpcy50b29sdGlwID0gbG9jYWxpemUoJ2lnbm9yZUV4dGVuc2lvblJlY29tbWVuZGF0aW9uJywgXCJEbyBub3QgcmVjb21tZW5kIHRoaXMgZXh0ZW5zaW9uIGFnYWluXCIpO1xuXHRcdHRoaXMuZW5hYmxlZCA9IHRydWU7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgcnVuKCk6IFByb21pc2U8YW55PiB7XG5cdFx0dGhpcy5leHRlbnNpb25SZWNvbW1lbmRhdGlvbnNNYW5hZ2VtZW50U2VydmljZS50b2dnbGVHbG9iYWxJZ25vcmVkUmVjb21tZW5kYXRpb24odGhpcy5leHRlbnNpb24uaWRlbnRpZmllci5pZCwgdHJ1ZSk7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBVbmRvSWdub3JlRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25BY3Rpb24gZXh0ZW5kcyBBY3Rpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICdleHRlbnNpb25zLmlnbm9yZSc7XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgQ2xhc3MgPSBgJHtFeHRlbnNpb25BY3Rpb24uTEFCRUxfQUNUSU9OX0NMQVNTfSB1bmRvLWlnbm9yZWA7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBleHRlbnNpb246IElFeHRlbnNpb24sXG5cdFx0QElFeHRlbnNpb25JZ25vcmVkUmVjb21tZW5kYXRpb25zU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblJlY29tbWVuZGF0aW9uc01hbmFnZW1lbnRTZXJ2aWNlOiBJRXh0ZW5zaW9uSWdub3JlZFJlY29tbWVuZGF0aW9uc1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKFVuZG9JZ25vcmVFeHRlbnNpb25SZWNvbW1lbmRhdGlvbkFjdGlvbi5JRCwgJ1VuZG8nKTtcblxuXHRcdHRoaXMuY2xhc3MgPSBVbmRvSWdub3JlRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25BY3Rpb24uQ2xhc3M7XG5cdFx0dGhpcy50b29sdGlwID0gbG9jYWxpemUoJ3VuZG8nLCBcIlVuZG9cIik7XG5cdFx0dGhpcy5lbmFibGVkID0gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBydW4oKTogUHJvbWlzZTxhbnk+IHtcblx0XHR0aGlzLmV4dGVuc2lvblJlY29tbWVuZGF0aW9uc01hbmFnZW1lbnRTZXJ2aWNlLnRvZ2dsZUdsb2JhbElnbm9yZWRSZWNvbW1lbmRhdGlvbih0aGlzLmV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLCBmYWxzZSk7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBhYnN0cmFjdCBjbGFzcyBBYnN0cmFjdENvbmZpZ3VyZVJlY29tbWVuZGVkRXh0ZW5zaW9uc0FjdGlvbiBleHRlbmRzIEFjdGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0aWQ6IHN0cmluZyxcblx0XHRsYWJlbDogc3RyaW5nLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJvdGVjdGVkIGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElUZXh0RmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0RmlsZVNlcnZpY2U6IElUZXh0RmlsZVNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByb3RlY3RlZCBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASUpTT05FZGl0aW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGpzb25FZGl0aW5nU2VydmljZTogSUpTT05FZGl0aW5nU2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZXh0TW9kZWxSZXNvbHZlclNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKGlkLCBsYWJlbCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3BlbkV4dGVuc2lvbnNGaWxlKGV4dGVuc2lvbnNGaWxlUmVzb3VyY2U6IFVSSSk6IFByb21pc2U8YW55PiB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0T3JDcmVhdGVFeHRlbnNpb25zRmlsZShleHRlbnNpb25zRmlsZVJlc291cmNlKVxuXHRcdFx0LnRoZW4oKHsgY3JlYXRlZCwgY29udGVudCB9KSA9PlxuXHRcdFx0XHR0aGlzLmdldFNlbGVjdGlvblBvc2l0aW9uKGNvbnRlbnQsIGV4dGVuc2lvbnNGaWxlUmVzb3VyY2UsIFsncmVjb21tZW5kYXRpb25zJ10pXG5cdFx0XHRcdFx0LnRoZW4oc2VsZWN0aW9uID0+IHRoaXMuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRcdFx0XHRcdHJlc291cmNlOiBleHRlbnNpb25zRmlsZVJlc291cmNlLFxuXHRcdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0XHRwaW5uZWQ6IGNyZWF0ZWQsXG5cdFx0XHRcdFx0XHRcdHNlbGVjdGlvblxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pKSxcblx0XHRcdFx0ZXJyb3IgPT4gUHJvbWlzZS5yZWplY3QobmV3IEVycm9yKGxvY2FsaXplKCdPcGVuRXh0ZW5zaW9uc0ZpbGUuZmFpbGVkJywgXCJVbmFibGUgdG8gY3JlYXRlICdleHRlbnNpb25zLmpzb24nIGZpbGUgaW5zaWRlIHRoZSAnLnZzY29kZScgZm9sZGVyICh7MH0pLlwiLCBlcnJvcikpKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3BlbldvcmtzcGFjZUNvbmZpZ3VyYXRpb25GaWxlKHdvcmtzcGFjZUNvbmZpZ3VyYXRpb25GaWxlOiBVUkkpOiBQcm9taXNlPGFueT4ge1xuXHRcdHJldHVybiB0aGlzLmdldE9yVXBkYXRlV29ya3NwYWNlQ29uZmlndXJhdGlvbkZpbGUod29ya3NwYWNlQ29uZmlndXJhdGlvbkZpbGUpXG5cdFx0XHQudGhlbihjb250ZW50ID0+IHRoaXMuZ2V0U2VsZWN0aW9uUG9zaXRpb24oY29udGVudC52YWx1ZS50b1N0cmluZygpLCBjb250ZW50LnJlc291cmNlLCBbJ2V4dGVuc2lvbnMnLCAncmVjb21tZW5kYXRpb25zJ10pKVxuXHRcdFx0LnRoZW4oc2VsZWN0aW9uID0+IHRoaXMuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRcdFx0cmVzb3VyY2U6IHdvcmtzcGFjZUNvbmZpZ3VyYXRpb25GaWxlLFxuXHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0c2VsZWN0aW9uLFxuXHRcdFx0XHRcdGZvcmNlUmVsb2FkOiB0cnVlIC8vIGJlY2F1c2UgY29udGVudCBoYXMgY2hhbmdlZFxuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGdldE9yVXBkYXRlV29ya3NwYWNlQ29uZmlndXJhdGlvbkZpbGUod29ya3NwYWNlQ29uZmlndXJhdGlvbkZpbGU6IFVSSSk6IFByb21pc2U8SUZpbGVDb250ZW50PiB7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLmZpbGVTZXJ2aWNlLnJlYWRGaWxlKHdvcmtzcGFjZUNvbmZpZ3VyYXRpb25GaWxlKSlcblx0XHRcdC50aGVuKGNvbnRlbnQgPT4ge1xuXHRcdFx0XHRjb25zdCB3b3Jrc3BhY2VSZWNvbW1lbmRhdGlvbnMgPSA8SUV4dGVuc2lvbnNDb25maWdDb250ZW50Pmpzb24ucGFyc2UoY29udGVudC52YWx1ZS50b1N0cmluZygpKVsnZXh0ZW5zaW9ucyddO1xuXHRcdFx0XHRpZiAoIXdvcmtzcGFjZVJlY29tbWVuZGF0aW9ucyB8fCAhd29ya3NwYWNlUmVjb21tZW5kYXRpb25zLnJlY29tbWVuZGF0aW9ucykge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmpzb25FZGl0aW5nU2VydmljZS53cml0ZSh3b3Jrc3BhY2VDb25maWd1cmF0aW9uRmlsZSwgW3sgcGF0aDogWydleHRlbnNpb25zJ10sIHZhbHVlOiB7IHJlY29tbWVuZGF0aW9uczogW10gfSB9XSwgdHJ1ZSlcblx0XHRcdFx0XHRcdC50aGVuKCgpID0+IHRoaXMuZmlsZVNlcnZpY2UucmVhZEZpbGUod29ya3NwYWNlQ29uZmlndXJhdGlvbkZpbGUpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gY29udGVudDtcblx0XHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRTZWxlY3Rpb25Qb3NpdGlvbihjb250ZW50OiBzdHJpbmcsIHJlc291cmNlOiBVUkksIHBhdGg6IGpzb24uSlNPTlBhdGgpOiBQcm9taXNlPElUZXh0RWRpdG9yU2VsZWN0aW9uIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgdHJlZSA9IGpzb24ucGFyc2VUcmVlKGNvbnRlbnQpO1xuXHRcdGNvbnN0IG5vZGUgPSBqc29uLmZpbmROb2RlQXRMb2NhdGlvbih0cmVlLCBwYXRoKTtcblx0XHRpZiAobm9kZSAmJiBub2RlLnBhcmVudCAmJiBub2RlLnBhcmVudC5jaGlsZHJlbikge1xuXHRcdFx0Y29uc3QgcmVjb21tZW5kYXRpb25zVmFsdWVOb2RlID0gbm9kZS5wYXJlbnQuY2hpbGRyZW5bMV07XG5cdFx0XHRjb25zdCBsYXN0RXh0ZW5zaW9uTm9kZSA9IHJlY29tbWVuZGF0aW9uc1ZhbHVlTm9kZS5jaGlsZHJlbiAmJiByZWNvbW1lbmRhdGlvbnNWYWx1ZU5vZGUuY2hpbGRyZW4ubGVuZ3RoID8gcmVjb21tZW5kYXRpb25zVmFsdWVOb2RlLmNoaWxkcmVuW3JlY29tbWVuZGF0aW9uc1ZhbHVlTm9kZS5jaGlsZHJlbi5sZW5ndGggLSAxXSA6IG51bGw7XG5cdFx0XHRjb25zdCBvZmZzZXQgPSBsYXN0RXh0ZW5zaW9uTm9kZSA/IGxhc3RFeHRlbnNpb25Ob2RlLm9mZnNldCArIGxhc3RFeHRlbnNpb25Ob2RlLmxlbmd0aCA6IHJlY29tbWVuZGF0aW9uc1ZhbHVlTm9kZS5vZmZzZXQgKyAxO1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLnRleHRNb2RlbFJlc29sdmVyU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShyZXNvdXJjZSkpXG5cdFx0XHRcdC50aGVuKHJlZmVyZW5jZSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgcG9zaXRpb24gPSByZWZlcmVuY2Uub2JqZWN0LnRleHRFZGl0b3JNb2RlbC5nZXRQb3NpdGlvbkF0KG9mZnNldCk7XG5cdFx0XHRcdFx0cmVmZXJlbmNlLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBwb3NpdGlvbi5saW5lTnVtYmVyLFxuXHRcdFx0XHRcdFx0c3RhcnRDb2x1bW46IHBvc2l0aW9uLmNvbHVtbixcblx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IHBvc2l0aW9uLmxpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRlbmRDb2x1bW46IHBvc2l0aW9uLmNvbHVtbixcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9KTtcblx0XHR9XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRPckNyZWF0ZUV4dGVuc2lvbnNGaWxlKGV4dGVuc2lvbnNGaWxlUmVzb3VyY2U6IFVSSSk6IFByb21pc2U8eyBjcmVhdGVkOiBib29sZWFuOyBleHRlbnNpb25zRmlsZVJlc291cmNlOiBVUkk7IGNvbnRlbnQ6IHN0cmluZyB9PiB7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0aGlzLmZpbGVTZXJ2aWNlLnJlYWRGaWxlKGV4dGVuc2lvbnNGaWxlUmVzb3VyY2UpKS50aGVuKGNvbnRlbnQgPT4ge1xuXHRcdFx0cmV0dXJuIHsgY3JlYXRlZDogZmFsc2UsIGV4dGVuc2lvbnNGaWxlUmVzb3VyY2UsIGNvbnRlbnQ6IGNvbnRlbnQudmFsdWUudG9TdHJpbmcoKSB9O1xuXHRcdH0sIGVyciA9PiB7XG5cdFx0XHRyZXR1cm4gdGhpcy50ZXh0RmlsZVNlcnZpY2Uud3JpdGUoZXh0ZW5zaW9uc0ZpbGVSZXNvdXJjZSwgRXh0ZW5zaW9uc0NvbmZpZ3VyYXRpb25Jbml0aWFsQ29udGVudCkudGhlbigoKSA9PiB7XG5cdFx0XHRcdHJldHVybiB7IGNyZWF0ZWQ6IHRydWUsIGV4dGVuc2lvbnNGaWxlUmVzb3VyY2UsIGNvbnRlbnQ6IEV4dGVuc2lvbnNDb25maWd1cmF0aW9uSW5pdGlhbENvbnRlbnQgfTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDb25maWd1cmVXb3Jrc3BhY2VSZWNvbW1lbmRlZEV4dGVuc2lvbnNBY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdENvbmZpZ3VyZVJlY29tbWVuZGVkRXh0ZW5zaW9uc0FjdGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5jb25maWd1cmVXb3Jrc3BhY2VSZWNvbW1lbmRlZEV4dGVuc2lvbnMnO1xuXHRzdGF0aWMgcmVhZG9ubHkgTEFCRUwgPSBsb2NhbGl6ZSgnY29uZmlndXJlV29ya3NwYWNlUmVjb21tZW5kZWRFeHRlbnNpb25zJywgXCJDb25maWd1cmUgUmVjb21tZW5kZWQgRXh0ZW5zaW9ucyAoV29ya3NwYWNlKVwiKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRpZDogc3RyaW5nLFxuXHRcdGxhYmVsOiBzdHJpbmcsXG5cdFx0QElGaWxlU2VydmljZSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJVGV4dEZpbGVTZXJ2aWNlIHRleHRGaWxlU2VydmljZTogSVRleHRGaWxlU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJSlNPTkVkaXRpbmdTZXJ2aWNlIGpzb25FZGl0aW5nU2VydmljZTogSUpTT05FZGl0aW5nU2VydmljZSxcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgdGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcihpZCwgbGFiZWwsIGNvbnRleHRTZXJ2aWNlLCBmaWxlU2VydmljZSwgdGV4dEZpbGVTZXJ2aWNlLCBlZGl0b3JTZXJ2aWNlLCBqc29uRWRpdGluZ1NlcnZpY2UsIHRleHRNb2RlbFJlc29sdmVyU2VydmljZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb250ZXh0U2VydmljZS5vbkRpZENoYW5nZVdvcmtiZW5jaFN0YXRlKCgpID0+IHRoaXMudXBkYXRlKCksIHRoaXMpKTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5lbmFibGVkID0gdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpICE9PSBXb3JrYmVuY2hTdGF0ZS5FTVBUWTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBydW4oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0c3dpdGNoICh0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkpIHtcblx0XHRcdGNhc2UgV29ya2JlbmNoU3RhdGUuRk9MREVSOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5vcGVuRXh0ZW5zaW9uc0ZpbGUodGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5mb2xkZXJzWzBdLnRvUmVzb3VyY2UoRVhURU5TSU9OU19DT05GSUcpKTtcblx0XHRcdGNhc2UgV29ya2JlbmNoU3RhdGUuV09SS1NQQUNFOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5vcGVuV29ya3NwYWNlQ29uZmlndXJhdGlvbkZpbGUodGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKS5jb25maWd1cmF0aW9uISk7XG5cdFx0fVxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ29uZmlndXJlV29ya3NwYWNlRm9sZGVyUmVjb21tZW5kZWRFeHRlbnNpb25zQWN0aW9uIGV4dGVuZHMgQWJzdHJhY3RDb25maWd1cmVSZWNvbW1lbmRlZEV4dGVuc2lvbnNBY3Rpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uY29uZmlndXJlV29ya3NwYWNlRm9sZGVyUmVjb21tZW5kZWRFeHRlbnNpb25zJztcblx0c3RhdGljIHJlYWRvbmx5IExBQkVMID0gbG9jYWxpemUoJ2NvbmZpZ3VyZVdvcmtzcGFjZUZvbGRlclJlY29tbWVuZGVkRXh0ZW5zaW9ucycsIFwiQ29uZmlndXJlIFJlY29tbWVuZGVkIEV4dGVuc2lvbnMgKFdvcmtzcGFjZSBGb2xkZXIpXCIpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGlkOiBzdHJpbmcsXG5cdFx0bGFiZWw6IHN0cmluZyxcblx0XHRASUZpbGVTZXJ2aWNlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElUZXh0RmlsZVNlcnZpY2UgdGV4dEZpbGVTZXJ2aWNlOiBJVGV4dEZpbGVTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgY29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0QElKU09ORWRpdGluZ1NlcnZpY2UganNvbkVkaXRpbmdTZXJ2aWNlOiBJSlNPTkVkaXRpbmdTZXJ2aWNlLFxuXHRcdEBJVGV4dE1vZGVsU2VydmljZSB0ZXh0TW9kZWxSZXNvbHZlclNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKGlkLCBsYWJlbCwgY29udGV4dFNlcnZpY2UsIGZpbGVTZXJ2aWNlLCB0ZXh0RmlsZVNlcnZpY2UsIGVkaXRvclNlcnZpY2UsIGpzb25FZGl0aW5nU2VydmljZSwgdGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlKTtcblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBydW4oKTogUHJvbWlzZTxhbnk+IHtcblx0XHRjb25zdCBmb2xkZXJDb3VudCA9IHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVycy5sZW5ndGg7XG5cdFx0Y29uc3QgcGlja0ZvbGRlclByb21pc2UgPSBmb2xkZXJDb3VudCA9PT0gMSA/IFByb21pc2UucmVzb2x2ZSh0aGlzLmNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnNbMF0pIDogdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZDxJV29ya3NwYWNlRm9sZGVyPihQSUNLX1dPUktTUEFDRV9GT0xERVJfQ09NTUFORF9JRCk7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShwaWNrRm9sZGVyUHJvbWlzZSlcblx0XHRcdC50aGVuKHdvcmtzcGFjZUZvbGRlciA9PiB7XG5cdFx0XHRcdGlmICh3b3Jrc3BhY2VGb2xkZXIpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5vcGVuRXh0ZW5zaW9uc0ZpbGUod29ya3NwYWNlRm9sZGVyLnRvUmVzb3VyY2UoRVhURU5TSU9OU19DT05GSUcpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25TdGF0dXNMYWJlbEFjdGlvbiBleHRlbmRzIEFjdGlvbiBpbXBsZW1lbnRzIElFeHRlbnNpb25Db250YWluZXIge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEVOQUJMRURfQ0xBU1MgPSBgJHtFeHRlbnNpb25BY3Rpb24uVEVYVF9BQ1RJT05fQ0xBU1N9IGV4dGVuc2lvbi1zdGF0dXMtbGFiZWxgO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBESVNBQkxFRF9DTEFTUyA9IGAke3RoaXMuRU5BQkxFRF9DTEFTU30gaGlkZWA7XG5cblx0cHJpdmF0ZSBpbml0aWFsU3RhdHVzOiBFeHRlbnNpb25TdGF0ZSB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHN0YXR1czogRXh0ZW5zaW9uU3RhdGUgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSB2ZXJzaW9uOiBzdHJpbmcgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBlbmFibGVtZW50U3RhdGU6IEVuYWJsZW1lbnRTdGF0ZSB8IG51bGwgPSBudWxsO1xuXG5cdHByaXZhdGUgX2V4dGVuc2lvbjogSUV4dGVuc2lvbiB8IG51bGwgPSBudWxsO1xuXHRnZXQgZXh0ZW5zaW9uKCk6IElFeHRlbnNpb24gfCBudWxsIHsgcmV0dXJuIHRoaXMuX2V4dGVuc2lvbjsgfVxuXHRzZXQgZXh0ZW5zaW9uKGV4dGVuc2lvbjogSUV4dGVuc2lvbiB8IG51bGwpIHtcblx0XHRpZiAoISh0aGlzLl9leHRlbnNpb24gJiYgZXh0ZW5zaW9uICYmIGFyZVNhbWVFeHRlbnNpb25zKHRoaXMuX2V4dGVuc2lvbi5pZGVudGlmaWVyLCBleHRlbnNpb24uaWRlbnRpZmllcikpKSB7XG5cdFx0XHQvLyBEaWZmZXJlbnQgZXh0ZW5zaW9uLiBSZXNldFxuXHRcdFx0dGhpcy5pbml0aWFsU3RhdHVzID0gbnVsbDtcblx0XHRcdHRoaXMuc3RhdHVzID0gbnVsbDtcblx0XHRcdHRoaXMuZW5hYmxlbWVudFN0YXRlID0gbnVsbDtcblx0XHR9XG5cdFx0dGhpcy5fZXh0ZW5zaW9uID0gZXh0ZW5zaW9uO1xuXHRcdHRoaXMudXBkYXRlKCk7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2U6IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2U6IElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcignZXh0ZW5zaW9ucy5hY3Rpb24uc3RhdHVzTGFiZWwnLCAnJywgRXh0ZW5zaW9uU3RhdHVzTGFiZWxBY3Rpb24uRElTQUJMRURfQ0xBU1MsIGZhbHNlKTtcblx0fVxuXG5cdHVwZGF0ZSgpOiB2b2lkIHtcblx0XHRjb25zdCBsYWJlbCA9IHRoaXMuY29tcHV0ZUxhYmVsKCk7XG5cdFx0dGhpcy5sYWJlbCA9IGxhYmVsIHx8ICcnO1xuXHRcdHRoaXMuY2xhc3MgPSBsYWJlbCA/IEV4dGVuc2lvblN0YXR1c0xhYmVsQWN0aW9uLkVOQUJMRURfQ0xBU1MgOiBFeHRlbnNpb25TdGF0dXNMYWJlbEFjdGlvbi5ESVNBQkxFRF9DTEFTUztcblx0fVxuXG5cdHByaXZhdGUgY29tcHV0ZUxhYmVsKCk6IHN0cmluZyB8IG51bGwge1xuXHRcdGlmICghdGhpcy5leHRlbnNpb24pIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IGN1cnJlbnRTdGF0dXMgPSB0aGlzLnN0YXR1cztcblx0XHRjb25zdCBjdXJyZW50VmVyc2lvbiA9IHRoaXMudmVyc2lvbjtcblx0XHRjb25zdCBjdXJyZW50RW5hYmxlbWVudFN0YXRlID0gdGhpcy5lbmFibGVtZW50U3RhdGU7XG5cdFx0dGhpcy5zdGF0dXMgPSB0aGlzLmV4dGVuc2lvbi5zdGF0ZTtcblx0XHR0aGlzLnZlcnNpb24gPSB0aGlzLmV4dGVuc2lvbi52ZXJzaW9uO1xuXHRcdGlmICh0aGlzLmluaXRpYWxTdGF0dXMgPT09IG51bGwpIHtcblx0XHRcdHRoaXMuaW5pdGlhbFN0YXR1cyA9IHRoaXMuc3RhdHVzO1xuXHRcdH1cblx0XHR0aGlzLmVuYWJsZW1lbnRTdGF0ZSA9IHRoaXMuZXh0ZW5zaW9uLmVuYWJsZW1lbnRTdGF0ZTtcblxuXHRcdGNvbnN0IGNhbkFkZEV4dGVuc2lvbiA9ICgpID0+IHtcblx0XHRcdGNvbnN0IHJ1bm5pbmdFeHRlbnNpb24gPSB0aGlzLmV4dGVuc2lvblNlcnZpY2UuZXh0ZW5zaW9ucy5maWx0ZXIoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyh7IGlkOiBlLmlkZW50aWZpZXIudmFsdWUsIHV1aWQ6IGUudXVpZCB9LCB0aGlzLmV4dGVuc2lvbiEuaWRlbnRpZmllcikpWzBdO1xuXHRcdFx0aWYgKHRoaXMuZXh0ZW5zaW9uIS5sb2NhbCkge1xuXHRcdFx0XHRpZiAocnVubmluZ0V4dGVuc2lvbiAmJiB0aGlzLmV4dGVuc2lvbiEudmVyc2lvbiA9PT0gcnVubmluZ0V4dGVuc2lvbi52ZXJzaW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uU2VydmljZS5jYW5BZGRFeHRlbnNpb24odG9FeHRlbnNpb25EZXNjcmlwdGlvbih0aGlzLmV4dGVuc2lvbiEubG9jYWwpKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9O1xuXHRcdGNvbnN0IGNhblJlbW92ZUV4dGVuc2lvbiA9ICgpID0+IHtcblx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbiEubG9jYWwpIHtcblx0XHRcdFx0aWYgKHRoaXMuZXh0ZW5zaW9uU2VydmljZS5leHRlbnNpb25zLmV2ZXJ5KGUgPT4gIShhcmVTYW1lRXh0ZW5zaW9ucyh7IGlkOiBlLmlkZW50aWZpZXIudmFsdWUsIHV1aWQ6IGUudXVpZCB9LCB0aGlzLmV4dGVuc2lvbiEuaWRlbnRpZmllcikgJiYgdGhpcy5leHRlbnNpb24hLnNlcnZlciA9PT0gdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5nZXRFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyKHRvRXh0ZW5zaW9uKGUpKSkpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uU2VydmljZS5jYW5SZW1vdmVFeHRlbnNpb24odG9FeHRlbnNpb25EZXNjcmlwdGlvbih0aGlzLmV4dGVuc2lvbiEubG9jYWwpKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9O1xuXG5cdFx0aWYgKGN1cnJlbnRTdGF0dXMgIT09IG51bGwpIHtcblx0XHRcdGlmIChjdXJyZW50U3RhdHVzID09PSBFeHRlbnNpb25TdGF0ZS5JbnN0YWxsaW5nICYmIHRoaXMuc3RhdHVzID09PSBFeHRlbnNpb25TdGF0ZS5JbnN0YWxsZWQpIHtcblx0XHRcdFx0aWYgKHRoaXMuaW5pdGlhbFN0YXR1cyA9PT0gRXh0ZW5zaW9uU3RhdGUuVW5pbnN0YWxsZWQgJiYgY2FuQWRkRXh0ZW5zaW9uKCkpIHtcblx0XHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoJ2luc3RhbGxlZCcsIFwiSW5zdGFsbGVkXCIpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh0aGlzLmluaXRpYWxTdGF0dXMgPT09IEV4dGVuc2lvblN0YXRlLkluc3RhbGxlZCAmJiB0aGlzLnZlcnNpb24gIT09IGN1cnJlbnRWZXJzaW9uICYmIGNhbkFkZEV4dGVuc2lvbigpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCd1cGRhdGVkJywgXCJVcGRhdGVkXCIpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGN1cnJlbnRTdGF0dXMgPT09IEV4dGVuc2lvblN0YXRlLlVuaW5zdGFsbGluZyAmJiB0aGlzLnN0YXR1cyA9PT0gRXh0ZW5zaW9uU3RhdGUuVW5pbnN0YWxsZWQpIHtcblx0XHRcdFx0dGhpcy5pbml0aWFsU3RhdHVzID0gdGhpcy5zdGF0dXM7XG5cdFx0XHRcdHJldHVybiBjYW5SZW1vdmVFeHRlbnNpb24oKSA/IGxvY2FsaXplKCd1bmluc3RhbGxlZCcsIFwiVW5pbnN0YWxsZWRcIikgOiBudWxsO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChjdXJyZW50RW5hYmxlbWVudFN0YXRlICE9PSBudWxsKSB7XG5cdFx0XHRjb25zdCBjdXJyZW50bHlFbmFibGVkID0gdGhpcy5leHRlbnNpb25FbmFibGVtZW50U2VydmljZS5pc0VuYWJsZWRFbmFibGVtZW50U3RhdGUoY3VycmVudEVuYWJsZW1lbnRTdGF0ZSk7XG5cdFx0XHRjb25zdCBlbmFibGVkID0gdGhpcy5leHRlbnNpb25FbmFibGVtZW50U2VydmljZS5pc0VuYWJsZWRFbmFibGVtZW50U3RhdGUodGhpcy5lbmFibGVtZW50U3RhdGUpO1xuXHRcdFx0aWYgKCFjdXJyZW50bHlFbmFibGVkICYmIGVuYWJsZWQpIHtcblx0XHRcdFx0cmV0dXJuIGNhbkFkZEV4dGVuc2lvbigpID8gbG9jYWxpemUoJ2VuYWJsZWQnLCBcIkVuYWJsZWRcIikgOiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0aWYgKGN1cnJlbnRseUVuYWJsZWQgJiYgIWVuYWJsZWQpIHtcblx0XHRcdFx0cmV0dXJuIGNhblJlbW92ZUV4dGVuc2lvbigpID8gbG9jYWxpemUoJ2Rpc2FibGVkJywgXCJEaXNhYmxlZFwiKSA6IG51bGw7XG5cdFx0XHR9XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdG92ZXJyaWRlIHJ1bigpOiBQcm9taXNlPGFueT4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0fVxuXG59XG5cbmV4cG9ydCBjbGFzcyBUb2dnbGVTeW5jRXh0ZW5zaW9uQWN0aW9uIGV4dGVuZHMgRHJvcERvd25FeHRlbnNpb25BY3Rpb24ge1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IElHTk9SRURfU1lOQ19DTEFTUyA9IGAke0V4dGVuc2lvbkFjdGlvbi5JQ09OX0FDVElPTl9DTEFTU30gZXh0ZW5zaW9uLXN5bmMgJHtUaGVtZUljb24uYXNDbGFzc05hbWUoc3luY0lnbm9yZWRJY29uKX1gO1xuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBTWU5DX0NMQVNTID0gYCR7dGhpcy5JQ09OX0FDVElPTl9DTEFTU30gZXh0ZW5zaW9uLXN5bmMgJHtUaGVtZUljb24uYXNDbGFzc05hbWUoc3luY0VuYWJsZWRJY29uKX1gO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB1c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZTogSVVzZXJEYXRhU3luY0VuYWJsZW1lbnRTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoJ2V4dGVuc2lvbnMuc3luYycsICcnLCBUb2dnbGVTeW5jRXh0ZW5zaW9uQWN0aW9uLlNZTkNfQ0xBU1MsIGZhbHNlLCBpbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoRXZlbnQuZmlsdGVyKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLCBlID0+IGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3NldHRpbmdzU3luYy5pZ25vcmVkRXh0ZW5zaW9ucycpKSgoKSA9PiB0aGlzLnVwZGF0ZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodXNlckRhdGFTeW5jRW5hYmxlbWVudFNlcnZpY2Uub25EaWRDaGFuZ2VFbmFibGVtZW50KCgpID0+IHRoaXMudXBkYXRlKCkpKTtcblx0XHR0aGlzLnVwZGF0ZSgpO1xuXHR9XG5cblx0dXBkYXRlKCk6IHZvaWQge1xuXHRcdHRoaXMuZW5hYmxlZCA9ICEhdGhpcy5leHRlbnNpb24gJiYgdGhpcy51c2VyRGF0YVN5bmNFbmFibGVtZW50U2VydmljZS5pc0VuYWJsZWQoKSAmJiB0aGlzLmV4dGVuc2lvbi5zdGF0ZSA9PT0gRXh0ZW5zaW9uU3RhdGUuSW5zdGFsbGVkO1xuXHRcdGlmICh0aGlzLmV4dGVuc2lvbikge1xuXHRcdFx0Y29uc3QgaXNJZ25vcmVkID0gdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5pc0V4dGVuc2lvbklnbm9yZWRUb1N5bmModGhpcy5leHRlbnNpb24pO1xuXHRcdFx0dGhpcy5jbGFzcyA9IGlzSWdub3JlZCA/IFRvZ2dsZVN5bmNFeHRlbnNpb25BY3Rpb24uSUdOT1JFRF9TWU5DX0NMQVNTIDogVG9nZ2xlU3luY0V4dGVuc2lvbkFjdGlvbi5TWU5DX0NMQVNTO1xuXHRcdFx0dGhpcy50b29sdGlwID0gaXNJZ25vcmVkID8gbG9jYWxpemUoJ2lnbm9yZWQnLCBcIlRoaXMgZXh0ZW5zaW9uIGlzIGlnbm9yZWQgZHVyaW5nIHN5bmNcIikgOiBsb2NhbGl6ZSgnc3luY2VkJywgXCJUaGlzIGV4dGVuc2lvbiBpcyBzeW5jZWRcIik7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKCk6IFByb21pc2U8YW55PiB7XG5cdFx0cmV0dXJuIHN1cGVyLnJ1bihbXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBBY3Rpb24oXG5cdFx0XHRcdFx0J2V4dGVuc2lvbnMuc3luY2lnbm9yZScsXG5cdFx0XHRcdFx0dGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5pc0V4dGVuc2lvbklnbm9yZWRUb1N5bmModGhpcy5leHRlbnNpb24hKSA/IGxvY2FsaXplKCdzeW5jJywgXCJTeW5jIHRoaXMgZXh0ZW5zaW9uXCIpIDogbG9jYWxpemUoJ2RvIG5vdCBzeW5jJywgXCJEbyBub3Qgc3luYyB0aGlzIGV4dGVuc2lvblwiKVxuXHRcdFx0XHRcdCwgdW5kZWZpbmVkLCB0cnVlLCAoKSA9PiB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnRvZ2dsZUV4dGVuc2lvbklnbm9yZWRUb1N5bmModGhpcy5leHRlbnNpb24hKSlcblx0XHRcdF1cblx0XHRdKTtcblx0fVxufVxuXG5leHBvcnQgdHlwZSBFeHRlbnNpb25TdGF0dXMgPSB7IHJlYWRvbmx5IG1lc3NhZ2U6IElNYXJrZG93blN0cmluZzsgcmVhZG9ubHkgaWNvbj86IFRoZW1lSWNvbiB9O1xuXG5leHBvcnQgY2xhc3MgRXh0ZW5zaW9uU3RhdHVzQWN0aW9uIGV4dGVuZHMgRXh0ZW5zaW9uQWN0aW9uIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBDTEFTUyA9IGAke0V4dGVuc2lvbkFjdGlvbi5JQ09OX0FDVElPTl9DTEFTU30gZXh0ZW5zaW9uLXN0YXR1c2A7XG5cblx0dXBkYXRlV2hlbkNvdW50ZXJFeHRlbnNpb25DaGFuZ2VzOiBib29sZWFuID0gdHJ1ZTtcblxuXHRwcml2YXRlIF9zdGF0dXM6IEV4dGVuc2lvblN0YXR1c1tdID0gW107XG5cdGdldCBzdGF0dXMoKTogRXh0ZW5zaW9uU3RhdHVzW10geyByZXR1cm4gdGhpcy5fc3RhdHVzOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VTdGF0dXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VTdGF0dXMgPSB0aGlzLl9vbkRpZENoYW5nZVN0YXR1cy5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHVwZGF0ZVRocm90dGxlciA9IG5ldyBUaHJvdHRsZXIoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2U6IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASVdvcmtzcGFjZVRydXN0RW5hYmxlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VUcnVzdEVuYWJsZW1lbnRTZXJ2aWNlOiBJV29ya3NwYWNlVHJ1c3RFbmFibGVtZW50U2VydmljZSxcblx0XHRASVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VUcnVzdFNlcnZpY2U6IElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2U6IElFeHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJQWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlOiBJQWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZTogSVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uRmVhdHVyZXNNYW5hZ2VtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbkZlYXR1cmVzTWFuYWdlbWVudFNlcnZpY2U6IElFeHRlbnNpb25GZWF0dXJlc01hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2U6IElFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcignZXh0ZW5zaW9ucy5zdGF0dXMnLCAnJywgYCR7RXh0ZW5zaW9uU3RhdHVzQWN0aW9uLkNMQVNTfSBoaWRlYCwgZmFsc2UpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGFiZWxTZXJ2aWNlLm9uRGlkQ2hhbmdlRm9ybWF0dGVycygoKSA9PiB0aGlzLnVwZGF0ZSgpLCB0aGlzKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5leHRlbnNpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlRXh0ZW5zaW9ucygoKSA9PiB0aGlzLnVwZGF0ZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5leHRlbnNpb25GZWF0dXJlc01hbmFnZW1lbnRTZXJ2aWNlLm9uRGlkQ2hhbmdlQWNjZXNzRGF0YSgoKSA9PiB0aGlzLnVwZGF0ZSgpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoYWxsb3dlZEV4dGVuc2lvbnNTZXJ2aWNlLm9uRGlkQ2hhbmdlQWxsb3dlZEV4dGVuc2lvbnNDb25maWdWYWx1ZSgoKSA9PiB0aGlzLnVwZGF0ZSgpKSk7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdHVwZGF0ZSgpOiB2b2lkIHtcblx0XHR0aGlzLnVwZGF0ZVRocm90dGxlci5xdWV1ZSgoKSA9PiB0aGlzLmNvbXB1dGVBbmRVcGRhdGVTdGF0dXMoKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNvbXB1dGVBbmRVcGRhdGVTdGF0dXMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy51cGRhdGVTdGF0dXModW5kZWZpbmVkLCB0cnVlKTtcblx0XHR0aGlzLmVuYWJsZWQgPSBmYWxzZTtcblxuXHRcdGlmICghdGhpcy5leHRlbnNpb24pIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5leHRlbnNpb24uaXNNYWxpY2lvdXMpIHtcblx0XHRcdHRoaXMudXBkYXRlU3RhdHVzKHsgaWNvbjogd2FybmluZ0ljb24sIG1lc3NhZ2U6IG5ldyBNYXJrZG93blN0cmluZyhsb2NhbGl6ZSgnbWFsaWNpb3VzIHRvb2x0aXAnLCBcIlRoaXMgZXh0ZW5zaW9uIHdhcyByZXBvcnRlZCB0byBiZSBwcm9ibGVtYXRpYy5cIikpIH0sIHRydWUpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmV4dGVuc2lvbi5zdGF0ZSA9PT0gRXh0ZW5zaW9uU3RhdGUuVW5pbnN0YWxsZWQgJiYgdGhpcy5leHRlbnNpb24uZ2FsbGVyeSAmJiAhdGhpcy5leHRlbnNpb24uZ2FsbGVyeS5pc1NpZ25lZCAmJiAoYXdhaXQgdGhpcy5leHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlLmdldEV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCgpKT8uY2FwYWJpbGl0aWVzLnNpZ25pbmc/LmFsbFJlcG9zaXRvcnlTaWduZWQpIHtcblx0XHRcdHRoaXMudXBkYXRlU3RhdHVzKHsgaWNvbjogd2FybmluZ0ljb24sIG1lc3NhZ2U6IG5ldyBNYXJrZG93blN0cmluZyhsb2NhbGl6ZSgnbm90IHNpZ25lZCB0b29sdGlwJywgXCJUaGlzIGV4dGVuc2lvbiBpcyBub3Qgc2lnbmVkIGJ5IHRoZSBFeHRlbnNpb24gTWFya2V0cGxhY2UuXCIpKSB9LCB0cnVlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5leHRlbnNpb24uZGVwcmVjYXRpb25JbmZvKSB7XG5cdFx0XHRpZiAodGhpcy5leHRlbnNpb24uZGVwcmVjYXRpb25JbmZvLmV4dGVuc2lvbikge1xuXHRcdFx0XHRjb25zdCBsaW5rID0gYFske3RoaXMuZXh0ZW5zaW9uLmRlcHJlY2F0aW9uSW5mby5leHRlbnNpb24uZGlzcGxheU5hbWV9XSgke1VSSS5wYXJzZShgY29tbWFuZDpleHRlbnNpb24ub3Blbj8ke2VuY29kZVVSSUNvbXBvbmVudChKU09OLnN0cmluZ2lmeShbdGhpcy5leHRlbnNpb24uZGVwcmVjYXRpb25JbmZvLmV4dGVuc2lvbi5pZF0pKX1gKX0pYDtcblx0XHRcdFx0dGhpcy51cGRhdGVTdGF0dXMoeyBpY29uOiB3YXJuaW5nSWNvbiwgbWVzc2FnZTogbmV3IE1hcmtkb3duU3RyaW5nKGxvY2FsaXplKCdkZXByZWNhdGVkIHdpdGggYWx0ZXJuYXRlIGV4dGVuc2lvbiB0b29sdGlwJywgXCJUaGlzIGV4dGVuc2lvbiBpcyBkZXByZWNhdGVkLiBVc2UgdGhlIHswfSBleHRlbnNpb24gaW5zdGVhZC5cIiwgbGluaykpIH0sIHRydWUpO1xuXHRcdFx0fSBlbHNlIGlmICh0aGlzLmV4dGVuc2lvbi5kZXByZWNhdGlvbkluZm8uc2V0dGluZ3MpIHtcblx0XHRcdFx0Y29uc3QgbGluayA9IGBbJHtsb2NhbGl6ZSgnc2V0dGluZ3MnLCBcInNldHRpbmdzXCIpfV0oJHtVUkkucGFyc2UoYGNvbW1hbmQ6d29ya2JlbmNoLmFjdGlvbi5vcGVuU2V0dGluZ3M/JHtlbmNvZGVVUklDb21wb25lbnQoSlNPTi5zdHJpbmdpZnkoW3RoaXMuZXh0ZW5zaW9uLmRlcHJlY2F0aW9uSW5mby5zZXR0aW5ncy5tYXAoc2V0dGluZyA9PiBgQGlkOiR7c2V0dGluZ31gKS5qb2luKCcgJyldKSl9YCl9KWA7XG5cdFx0XHRcdHRoaXMudXBkYXRlU3RhdHVzKHsgaWNvbjogd2FybmluZ0ljb24sIG1lc3NhZ2U6IG5ldyBNYXJrZG93blN0cmluZyhsb2NhbGl6ZSgnZGVwcmVjYXRlZCB3aXRoIGFsdGVybmF0ZSBzZXR0aW5ncyB0b29sdGlwJywgXCJUaGlzIGV4dGVuc2lvbiBpcyBkZXByZWNhdGVkIGFzIHRoaXMgZnVuY3Rpb25hbGl0eSBpcyBub3cgYnVpbHQtaW4gdG8gVlMgQ29kZS4gQ29uZmlndXJlIHRoZXNlIHswfSB0byB1c2UgdGhpcyBmdW5jdGlvbmFsaXR5LlwiLCBsaW5rKSkgfSwgdHJ1ZSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCBtZXNzYWdlID0gbmV3IE1hcmtkb3duU3RyaW5nKGxvY2FsaXplKCdkZXByZWNhdGVkIHRvb2x0aXAnLCBcIlRoaXMgZXh0ZW5zaW9uIGlzIGRlcHJlY2F0ZWQgYXMgaXQgaXMgbm8gbG9uZ2VyIGJlaW5nIG1haW50YWluZWQuXCIpKTtcblx0XHRcdFx0aWYgKHRoaXMuZXh0ZW5zaW9uLmRlcHJlY2F0aW9uSW5mby5hZGRpdGlvbmFsSW5mbykge1xuXHRcdFx0XHRcdG1lc3NhZ2UuYXBwZW5kTWFya2Rvd24oYCAke3RoaXMuZXh0ZW5zaW9uLmRlcHJlY2F0aW9uSW5mby5hZGRpdGlvbmFsSW5mb31gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLnVwZGF0ZVN0YXR1cyh7IGljb246IHdhcm5pbmdJY29uLCBtZXNzYWdlIH0sIHRydWUpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmNhblNldExhbmd1YWdlKHRoaXMuZXh0ZW5zaW9uKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLmV4dGVuc2lvbi5vdXRkYXRlZCAmJiB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmlzQXV0b1VwZGF0ZUVuYWJsZWRGb3IodGhpcy5leHRlbnNpb24pKSB7XG5cdFx0XHRjb25zdCBtZXNzYWdlID0gYXdhaXQgdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5zaG91bGRSZXF1aXJlQ29uc2VudFRvVXBkYXRlKHRoaXMuZXh0ZW5zaW9uKTtcblx0XHRcdGlmIChtZXNzYWdlKSB7XG5cdFx0XHRcdGNvbnN0IG1hcmtkb3duID0gbmV3IE1hcmtkb3duU3RyaW5nKCk7XG5cdFx0XHRcdG1hcmtkb3duLmFwcGVuZE1hcmtkb3duKGAke21lc3NhZ2V9IGApO1xuXHRcdFx0XHRtYXJrZG93bi5hcHBlbmRNYXJrZG93bihcblx0XHRcdFx0XHRsb2NhbGl6ZSgnYXV0byB1cGRhdGUgbWVzc2FnZScsIFwiUGxlYXNlIFtyZXZpZXcgdGhlIGV4dGVuc2lvbl0oezB9KSBhbmQgdXBkYXRlIGl0IG1hbnVhbGx5LlwiLFxuXHRcdFx0XHRcdFx0dGhpcy5leHRlbnNpb24uaGFzQ2hhbmdlbG9nKClcblx0XHRcdFx0XHRcdFx0PyBVUkkucGFyc2UoYGNvbW1hbmQ6ZXh0ZW5zaW9uLm9wZW4/JHtlbmNvZGVVUklDb21wb25lbnQoSlNPTi5zdHJpbmdpZnkoW3RoaXMuZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQsIEV4dGVuc2lvbkVkaXRvclRhYi5DaGFuZ2Vsb2ddKSl9YCkudG9TdHJpbmcoKVxuXHRcdFx0XHRcdFx0XHQ6IHRoaXMuZXh0ZW5zaW9uLnJlcG9zaXRvcnlcblx0XHRcdFx0XHRcdFx0XHQ/IHRoaXMuZXh0ZW5zaW9uLnJlcG9zaXRvcnlcblx0XHRcdFx0XHRcdFx0XHQ6IFVSSS5wYXJzZShgY29tbWFuZDpleHRlbnNpb24ub3Blbj8ke2VuY29kZVVSSUNvbXBvbmVudChKU09OLnN0cmluZ2lmeShbdGhpcy5leHRlbnNpb24uaWRlbnRpZmllci5pZF0pKX1gKS50b1N0cmluZygpXG5cdFx0XHRcdFx0KSk7XG5cdFx0XHRcdHRoaXMudXBkYXRlU3RhdHVzKHsgaWNvbjogd2FybmluZ0ljb24sIG1lc3NhZ2U6IG1hcmtkb3duIH0sIHRydWUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLmV4dGVuc2lvbi5nYWxsZXJ5ICYmIHRoaXMuZXh0ZW5zaW9uLnN0YXRlID09PSBFeHRlbnNpb25TdGF0ZS5Vbmluc3RhbGxlZCkge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5jYW5JbnN0YWxsKHRoaXMuZXh0ZW5zaW9uKTtcblx0XHRcdGlmIChyZXN1bHQgIT09IHRydWUpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVTdGF0dXMoeyBpY29uOiB3YXJuaW5nSWNvbiwgbWVzc2FnZTogcmVzdWx0IH0sIHRydWUpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLmV4dGVuc2lvbi5sb2NhbCB8fFxuXHRcdFx0IXRoaXMuZXh0ZW5zaW9uLnNlcnZlciB8fFxuXHRcdFx0dGhpcy5leHRlbnNpb24uc3RhdGUgIT09IEV4dGVuc2lvblN0YXRlLkluc3RhbGxlZFxuXHRcdCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIEV4dGVuc2lvbiBpcyBkaXNhYmxlZCBieSBhbGxvd2VkIGxpc3Rcblx0XHRpZiAodGhpcy5leHRlbnNpb24uZW5hYmxlbWVudFN0YXRlID09PSBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRCeUFsbG93bGlzdCkge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5hbGxvd2VkRXh0ZW5zaW9uc1NlcnZpY2UuaXNBbGxvd2VkKHRoaXMuZXh0ZW5zaW9uLmxvY2FsKTtcblx0XHRcdGlmIChyZXN1bHQgIT09IHRydWUpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVTdGF0dXMoeyBpY29uOiB3YXJuaW5nSWNvbiwgbWVzc2FnZTogbmV3IE1hcmtkb3duU3RyaW5nKGxvY2FsaXplKCdkaXNhYmxlZCAtIG5vdCBhbGxvd2VkJywgXCJUaGlzIGV4dGVuc2lvbiBpcyBkaXNhYmxlZCBiZWNhdXNlIHswfVwiLCByZXN1bHQudmFsdWUpKSB9LCB0cnVlKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEV4dGVuc2lvbiBpcyBkaXNhYmxlZCBieSBlbnZpcm9ubWVudFxuXHRcdGlmICh0aGlzLmV4dGVuc2lvbi5lbmFibGVtZW50U3RhdGUgPT09IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5RW52aXJvbm1lbnQpIHtcblx0XHRcdHRoaXMudXBkYXRlU3RhdHVzKHsgbWVzc2FnZTogbmV3IE1hcmtkb3duU3RyaW5nKGxvY2FsaXplKCdkaXNhYmxlZCBieSBlbnZpcm9ubWVudCcsIFwiVGhpcyBleHRlbnNpb24gaXMgZGlzYWJsZWQgYnkgdGhlIGVudmlyb25tZW50LlwiKSkgfSwgdHJ1ZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gRXh0ZW5zaW9uIGlzIGVuYWJsZWQgYnkgZW52aXJvbm1lbnRcblx0XHRpZiAodGhpcy5leHRlbnNpb24uZW5hYmxlbWVudFN0YXRlID09PSBFbmFibGVtZW50U3RhdGUuRW5hYmxlZEJ5RW52aXJvbm1lbnQpIHtcblx0XHRcdHRoaXMudXBkYXRlU3RhdHVzKHsgbWVzc2FnZTogbmV3IE1hcmtkb3duU3RyaW5nKGxvY2FsaXplKCdlbmFibGVkIGJ5IGVudmlyb25tZW50JywgXCJUaGlzIGV4dGVuc2lvbiBpcyBlbmFibGVkIGJlY2F1c2UgaXQgaXMgcmVxdWlyZWQgaW4gdGhlIGN1cnJlbnQgZW52aXJvbm1lbnQuXCIpKSB9LCB0cnVlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBFeHRlbnNpb24gaXMgZGlzYWJsZWQgYnkgdmlydHVhbCB3b3Jrc3BhY2Vcblx0XHRpZiAodGhpcy5leHRlbnNpb24uZW5hYmxlbWVudFN0YXRlID09PSBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRCeVZpcnR1YWxXb3Jrc3BhY2UpIHtcblx0XHRcdGNvbnN0IGRldGFpbHMgPSBnZXRXb3Jrc3BhY2VTdXBwb3J0VHlwZU1lc3NhZ2UodGhpcy5leHRlbnNpb24ubG9jYWwubWFuaWZlc3QuY2FwYWJpbGl0aWVzPy52aXJ0dWFsV29ya3NwYWNlcyk7XG5cdFx0XHR0aGlzLnVwZGF0ZVN0YXR1cyh7IGljb246IGluZm9JY29uLCBtZXNzYWdlOiBuZXcgTWFya2Rvd25TdHJpbmcoZGV0YWlscyA/IGVzY2FwZU1hcmtkb3duU3ludGF4VG9rZW5zKGRldGFpbHMpIDogbG9jYWxpemUoJ2Rpc2FibGVkIGJlY2F1c2Ugb2YgdmlydHVhbCB3b3Jrc3BhY2UnLCBcIlRoaXMgZXh0ZW5zaW9uIGhhcyBiZWVuIGRpc2FibGVkIGJlY2F1c2UgaXQgZG9lcyBub3Qgc3VwcG9ydCB2aXJ0dWFsIHdvcmtzcGFjZXMuXCIpKSB9LCB0cnVlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBMaW1pdGVkIHN1cHBvcnQgaW4gVmlydHVhbCBXb3Jrc3BhY2Vcblx0XHRpZiAoaXNWaXJ0dWFsV29ya3NwYWNlKHRoaXMuY29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkpKSB7XG5cdFx0XHRjb25zdCB2aXJ0dWFsU3VwcG9ydFR5cGUgPSB0aGlzLmV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UuZ2V0RXh0ZW5zaW9uVmlydHVhbFdvcmtzcGFjZVN1cHBvcnRUeXBlKHRoaXMuZXh0ZW5zaW9uLmxvY2FsLm1hbmlmZXN0KTtcblx0XHRcdGNvbnN0IGRldGFpbHMgPSBnZXRXb3Jrc3BhY2VTdXBwb3J0VHlwZU1lc3NhZ2UodGhpcy5leHRlbnNpb24ubG9jYWwubWFuaWZlc3QuY2FwYWJpbGl0aWVzPy52aXJ0dWFsV29ya3NwYWNlcyk7XG5cdFx0XHRpZiAodmlydHVhbFN1cHBvcnRUeXBlID09PSAnbGltaXRlZCcgfHwgZGV0YWlscykge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVN0YXR1cyh7IGljb246IHdhcm5pbmdJY29uLCBtZXNzYWdlOiBuZXcgTWFya2Rvd25TdHJpbmcoZGV0YWlscyA/IGVzY2FwZU1hcmtkb3duU3ludGF4VG9rZW5zKGRldGFpbHMpIDogbG9jYWxpemUoJ2V4dGVuc2lvbiBsaW1pdGVkIGJlY2F1c2Ugb2YgdmlydHVhbCB3b3Jrc3BhY2UnLCBcIlRoaXMgZXh0ZW5zaW9uIGhhcyBsaW1pdGVkIGZlYXR1cmVzIGJlY2F1c2UgdGhlIGN1cnJlbnQgd29ya3NwYWNlIGlzIHZpcnR1YWwuXCIpKSB9LCB0cnVlKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghdGhpcy53b3Jrc3BhY2VUcnVzdFNlcnZpY2UuaXNXb3Jrc3BhY2VUcnVzdGVkKCkgJiZcblx0XHRcdC8vIEV4dGVuc2lvbiBpcyBkaXNhYmxlZCBieSB1bnRydXN0ZWQgd29ya3NwYWNlXG5cdFx0XHQodGhpcy5leHRlbnNpb24uZW5hYmxlbWVudFN0YXRlID09PSBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRCeVRydXN0UmVxdWlyZW1lbnQgfHxcblx0XHRcdFx0Ly8gQWxsIGRpc2FibGVkIGRlcGVuZGVuY2llcyBvZiB0aGUgZXh0ZW5zaW9uIGFyZSBkaXNhYmxlZCBieSB1bnRydXN0ZWQgd29ya3NwYWNlXG5cdFx0XHRcdCh0aGlzLmV4dGVuc2lvbi5lbmFibGVtZW50U3RhdGUgPT09IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5RXh0ZW5zaW9uRGVwZW5kZW5jeSAmJiB0aGlzLndvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmdldERlcGVuZGVuY2llc0VuYWJsZW1lbnRTdGF0ZXModGhpcy5leHRlbnNpb24ubG9jYWwpLmV2ZXJ5KChbLCBlbmFibGVtZW50U3RhdGVdKSA9PiB0aGlzLndvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZEVuYWJsZW1lbnRTdGF0ZShlbmFibGVtZW50U3RhdGUpIHx8IGVuYWJsZW1lbnRTdGF0ZSA9PT0gRW5hYmxlbWVudFN0YXRlLkRpc2FibGVkQnlUcnVzdFJlcXVpcmVtZW50KSkpKSB7XG5cdFx0XHR0aGlzLmVuYWJsZWQgPSB0cnVlO1xuXHRcdFx0Y29uc3QgdW50cnVzdGVkRGV0YWlscyA9IGdldFdvcmtzcGFjZVN1cHBvcnRUeXBlTWVzc2FnZSh0aGlzLmV4dGVuc2lvbi5sb2NhbC5tYW5pZmVzdC5jYXBhYmlsaXRpZXM/LnVudHJ1c3RlZFdvcmtzcGFjZXMpO1xuXHRcdFx0dGhpcy51cGRhdGVTdGF0dXMoeyBpY29uOiB0cnVzdEljb24sIG1lc3NhZ2U6IG5ldyBNYXJrZG93blN0cmluZyh1bnRydXN0ZWREZXRhaWxzID8gZXNjYXBlTWFya2Rvd25TeW50YXhUb2tlbnModW50cnVzdGVkRGV0YWlscykgOiBsb2NhbGl6ZSgnZXh0ZW5zaW9uIGRpc2FibGVkIGJlY2F1c2Ugb2YgdHJ1c3QgcmVxdWlyZW1lbnQnLCBcIlRoaXMgZXh0ZW5zaW9uIGhhcyBiZWVuIGRpc2FibGVkIGJlY2F1c2UgdGhlIGN1cnJlbnQgd29ya3NwYWNlIGlzIG5vdCB0cnVzdGVkLlwiKSkgfSwgdHJ1ZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gTGltaXRlZCBzdXBwb3J0IGluIFVudHJ1c3RlZCBXb3Jrc3BhY2Vcblx0XHRpZiAodGhpcy53b3Jrc3BhY2VUcnVzdEVuYWJsZW1lbnRTZXJ2aWNlLmlzV29ya3NwYWNlVHJ1c3RFbmFibGVkKCkgJiYgIXRoaXMud29ya3NwYWNlVHJ1c3RTZXJ2aWNlLmlzV29ya3NwYWNlVHJ1c3RlZCgpKSB7XG5cdFx0XHRjb25zdCB1bnRydXN0ZWRTdXBwb3J0VHlwZSA9IHRoaXMuZXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZS5nZXRFeHRlbnNpb25VbnRydXN0ZWRXb3Jrc3BhY2VTdXBwb3J0VHlwZSh0aGlzLmV4dGVuc2lvbi5sb2NhbC5tYW5pZmVzdCk7XG5cdFx0XHRjb25zdCB1bnRydXN0ZWREZXRhaWxzID0gZ2V0V29ya3NwYWNlU3VwcG9ydFR5cGVNZXNzYWdlKHRoaXMuZXh0ZW5zaW9uLmxvY2FsLm1hbmlmZXN0LmNhcGFiaWxpdGllcz8udW50cnVzdGVkV29ya3NwYWNlcyk7XG5cdFx0XHRpZiAodW50cnVzdGVkU3VwcG9ydFR5cGUgPT09ICdsaW1pdGVkJyB8fCB1bnRydXN0ZWREZXRhaWxzKSB7XG5cdFx0XHRcdHRoaXMuZW5hYmxlZCA9IHRydWU7XG5cdFx0XHRcdHRoaXMudXBkYXRlU3RhdHVzKHsgaWNvbjogdHJ1c3RJY29uLCBtZXNzYWdlOiBuZXcgTWFya2Rvd25TdHJpbmcodW50cnVzdGVkRGV0YWlscyA/IGVzY2FwZU1hcmtkb3duU3ludGF4VG9rZW5zKHVudHJ1c3RlZERldGFpbHMpIDogbG9jYWxpemUoJ2V4dGVuc2lvbiBsaW1pdGVkIGJlY2F1c2Ugb2YgdHJ1c3QgcmVxdWlyZW1lbnQnLCBcIlRoaXMgZXh0ZW5zaW9uIGhhcyBsaW1pdGVkIGZlYXR1cmVzIGJlY2F1c2UgdGhlIGN1cnJlbnQgd29ya3NwYWNlIGlzIG5vdCB0cnVzdGVkLlwiKSkgfSwgdHJ1ZSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBFeHRlbnNpb24gaXMgZGlzYWJsZWQgYnkgZXh0ZW5zaW9uIGtpbmRcblx0XHRpZiAodGhpcy5leHRlbnNpb24uZW5hYmxlbWVudFN0YXRlID09PSBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRCeUV4dGVuc2lvbktpbmQpIHtcblx0XHRcdGlmICghdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5pbnN0YWxsZWQuc29tZShlID0+IGFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgdGhpcy5leHRlbnNpb24hLmlkZW50aWZpZXIpICYmIGUuc2VydmVyICE9PSB0aGlzLmV4dGVuc2lvbiEuc2VydmVyKSkge1xuXHRcdFx0XHRsZXQgbWVzc2FnZTtcblx0XHRcdFx0Ly8gRXh0ZW5zaW9uIG9uIExvY2FsIFNlcnZlclxuXHRcdFx0XHRpZiAodGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5sb2NhbEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIgPT09IHRoaXMuZXh0ZW5zaW9uLnNlcnZlcikge1xuXHRcdFx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UucHJlZmVyc0V4ZWN1dGVPbldvcmtzcGFjZSh0aGlzLmV4dGVuc2lvbi5sb2NhbC5tYW5pZmVzdCkpIHtcblx0XHRcdFx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLnJlbW90ZUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpIHtcblx0XHRcdFx0XHRcdFx0bWVzc2FnZSA9IG5ldyBNYXJrZG93blN0cmluZyhgJHtsb2NhbGl6ZSgnSW5zdGFsbCBpbiByZW1vdGUgc2VydmVyIHRvIGVuYWJsZScsIFwiVGhpcyBleHRlbnNpb24gaXMgZGlzYWJsZWQgaW4gdGhpcyB3b3Jrc3BhY2UgYmVjYXVzZSBpdCBpcyBkZWZpbmVkIHRvIHJ1biBpbiB0aGUgUmVtb3RlIEV4dGVuc2lvbiBIb3N0LiBQbGVhc2UgaW5zdGFsbCB0aGUgZXh0ZW5zaW9uIGluICd7MH0nIHRvIGVuYWJsZS5cIiwgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5yZW1vdGVFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyLmxhYmVsKX0gWyR7bG9jYWxpemUoJ2xlYXJuIG1vcmUnLCBcIkxlYXJuIE1vcmVcIil9XShodHRwczovL2NvZGUudmlzdWFsc3R1ZGlvLmNvbS9hcGkvYWR2YW5jZWQtdG9waWNzL3JlbW90ZS1leHRlbnNpb25zI2FyY2hpdGVjdHVyZS1hbmQtZXh0ZW5zaW9uLWtpbmRzKWApO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBFeHRlbnNpb24gb24gUmVtb3RlIFNlcnZlclxuXHRcdFx0XHRlbHNlIGlmICh0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLnJlbW90ZUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIgPT09IHRoaXMuZXh0ZW5zaW9uLnNlcnZlcikge1xuXHRcdFx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbk1hbmlmZXN0UHJvcGVydGllc1NlcnZpY2UucHJlZmVyc0V4ZWN1dGVPblVJKHRoaXMuZXh0ZW5zaW9uLmxvY2FsLm1hbmlmZXN0KSkge1xuXHRcdFx0XHRcdFx0aWYgKHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UubG9jYWxFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyKSB7XG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2UgPSBuZXcgTWFya2Rvd25TdHJpbmcoYCR7bG9jYWxpemUoJ0luc3RhbGwgaW4gbG9jYWwgc2VydmVyIHRvIGVuYWJsZScsIFwiVGhpcyBleHRlbnNpb24gaXMgZGlzYWJsZWQgaW4gdGhpcyB3b3Jrc3BhY2UgYmVjYXVzZSBpdCBpcyBkZWZpbmVkIHRvIHJ1biBpbiB0aGUgTG9jYWwgRXh0ZW5zaW9uIEhvc3QuIFBsZWFzZSBpbnN0YWxsIHRoZSBleHRlbnNpb24gbG9jYWxseSB0byBlbmFibGUuXCIsIHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlci5sYWJlbCl9IFske2xvY2FsaXplKCdsZWFybiBtb3JlJywgXCJMZWFybiBNb3JlXCIpfV0oaHR0cHM6Ly9jb2RlLnZpc3VhbHN0dWRpby5jb20vYXBpL2FkdmFuY2VkLXRvcGljcy9yZW1vdGUtZXh0ZW5zaW9ucyNhcmNoaXRlY3R1cmUtYW5kLWV4dGVuc2lvbi1raW5kcylgKTtcblx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoaXNXZWIpIHtcblx0XHRcdFx0XHRcdFx0bWVzc2FnZSA9IG5ldyBNYXJrZG93blN0cmluZyhgJHtsb2NhbGl6ZSgnRGVmaW5lZCB0byBydW4gaW4gZGVza3RvcCcsIFwiVGhpcyBleHRlbnNpb24gaXMgZGlzYWJsZWQgYmVjYXVzZSBpdCBpcyBkZWZpbmVkIHRvIHJ1biBvbmx5IGluIHswfSBmb3IgdGhlIERlc2t0b3AuXCIsIHRoaXMucHJvZHVjdFNlcnZpY2UubmFtZUxvbmcpfSBbJHtsb2NhbGl6ZSgnbGVhcm4gbW9yZScsIFwiTGVhcm4gTW9yZVwiKX1dKGh0dHBzOi8vY29kZS52aXN1YWxzdHVkaW8uY29tL2FwaS9hZHZhbmNlZC10b3BpY3MvcmVtb3RlLWV4dGVuc2lvbnMjYXJjaGl0ZWN0dXJlLWFuZC1leHRlbnNpb24ta2luZHMpYCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdC8vIEV4dGVuc2lvbiBvbiBXZWIgU2VydmVyXG5cdFx0XHRcdGVsc2UgaWYgKHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2Uud2ViRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciA9PT0gdGhpcy5leHRlbnNpb24uc2VydmVyKSB7XG5cdFx0XHRcdFx0bWVzc2FnZSA9IG5ldyBNYXJrZG93blN0cmluZyhgJHtsb2NhbGl6ZSgnQ2Fubm90IGJlIGVuYWJsZWQnLCBcIlRoaXMgZXh0ZW5zaW9uIGlzIGRpc2FibGVkIGJlY2F1c2UgaXQgaXMgbm90IHN1cHBvcnRlZCBpbiB7MH0gZm9yIHRoZSBXZWIuXCIsIHRoaXMucHJvZHVjdFNlcnZpY2UubmFtZUxvbmcpfSBbJHtsb2NhbGl6ZSgnbGVhcm4gbW9yZScsIFwiTGVhcm4gTW9yZVwiKX1dKGh0dHBzOi8vY29kZS52aXN1YWxzdHVkaW8uY29tL2FwaS9hZHZhbmNlZC10b3BpY3MvcmVtb3RlLWV4dGVuc2lvbnMjYXJjaGl0ZWN0dXJlLWFuZC1leHRlbnNpb24ta2luZHMpYCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG1lc3NhZ2UpIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZVN0YXR1cyh7IGljb246IHdhcm5pbmdJY29uLCBtZXNzYWdlIH0sIHRydWUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBleHRlbnNpb25JZCA9IG5ldyBFeHRlbnNpb25JZGVudGlmaWVyKHRoaXMuZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQpO1xuXHRcdGNvbnN0IGZlYXR1cmVzID0gUmVnaXN0cnkuYXM8SUV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnk+KEV4dGVuc2lvbnMuRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeSkuZ2V0RXh0ZW5zaW9uRmVhdHVyZXMoKTtcblx0XHRmb3IgKGNvbnN0IGZlYXR1cmUgb2YgZmVhdHVyZXMpIHtcblx0XHRcdGNvbnN0IHN0YXR1cyA9IHRoaXMuZXh0ZW5zaW9uRmVhdHVyZXNNYW5hZ2VtZW50U2VydmljZS5nZXRBY2Nlc3NEYXRhKGV4dGVuc2lvbklkLCBmZWF0dXJlLmlkKT8uY3VycmVudD8uc3RhdHVzO1xuXHRcdFx0Y29uc3QgbWFuYWdlQWNjZXNzTGluayA9IGBbJHtsb2NhbGl6ZSgnbWFuYWdlIGFjY2VzcycsICdNYW5hZ2UgQWNjZXNzJyl9XSgke1VSSS5wYXJzZShgY29tbWFuZDpleHRlbnNpb24ub3Blbj8ke2VuY29kZVVSSUNvbXBvbmVudChKU09OLnN0cmluZ2lmeShbdGhpcy5leHRlbnNpb24uaWRlbnRpZmllci5pZCwgRXh0ZW5zaW9uRWRpdG9yVGFiLkZlYXR1cmVzLCBmYWxzZSwgZmVhdHVyZS5pZF0pKX1gKX0pYDtcblx0XHRcdGlmIChzdGF0dXM/LnNldmVyaXR5ID09PSBTZXZlcml0eS5FcnJvcikge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVN0YXR1cyh7IGljb246IGVycm9ySWNvbiwgbWVzc2FnZTogbmV3IE1hcmtkb3duU3RyaW5nKCkuYXBwZW5kVGV4dChzdGF0dXMubWVzc2FnZSkuYXBwZW5kTWFya2Rvd24oYCAke21hbmFnZUFjY2Vzc0xpbmt9YCkgfSwgdHJ1ZSk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGlmIChzdGF0dXM/LnNldmVyaXR5ID09PSBTZXZlcml0eS5XYXJuaW5nKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlU3RhdHVzKHsgaWNvbjogd2FybmluZ0ljb24sIG1lc3NhZ2U6IG5ldyBNYXJrZG93blN0cmluZygpLmFwcGVuZFRleHQoc3RhdHVzLm1lc3NhZ2UpLmFwcGVuZE1hcmtkb3duKGAgJHttYW5hZ2VBY2Nlc3NMaW5rfWApIH0sIHRydWUpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gUmVtb3RlIFdvcmtzcGFjZVxuXHRcdGlmICh0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLnJlbW90ZUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpIHtcblx0XHRcdGlmIChpc0xhbmd1YWdlUGFja0V4dGVuc2lvbih0aGlzLmV4dGVuc2lvbi5sb2NhbC5tYW5pZmVzdCkpIHtcblx0XHRcdFx0aWYgKCF0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmluc3RhbGxlZC5zb21lKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZS5pZGVudGlmaWVyLCB0aGlzLmV4dGVuc2lvbiEuaWRlbnRpZmllcikgJiYgZS5zZXJ2ZXIgIT09IHRoaXMuZXh0ZW5zaW9uIS5zZXJ2ZXIpKSB7XG5cdFx0XHRcdFx0Y29uc3QgbWVzc2FnZSA9IHRoaXMuZXh0ZW5zaW9uLnNlcnZlciA9PT0gdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5sb2NhbEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJcblx0XHRcdFx0XHRcdD8gbmV3IE1hcmtkb3duU3RyaW5nKGxvY2FsaXplKCdJbnN0YWxsIGxhbmd1YWdlIHBhY2sgYWxzbyBpbiByZW1vdGUgc2VydmVyJywgXCJJbnN0YWxsIHRoZSBsYW5ndWFnZSBwYWNrIGV4dGVuc2lvbiBvbiAnezB9JyB0byBlbmFibGUgaXQgdGhlcmUgYWxzby5cIiwgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5yZW1vdGVFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyLmxhYmVsKSlcblx0XHRcdFx0XHRcdDogbmV3IE1hcmtkb3duU3RyaW5nKGxvY2FsaXplKCdJbnN0YWxsIGxhbmd1YWdlIHBhY2sgYWxzbyBsb2NhbGx5JywgXCJJbnN0YWxsIHRoZSBsYW5ndWFnZSBwYWNrIGV4dGVuc2lvbiBsb2NhbGx5IHRvIGVuYWJsZSBpdCB0aGVyZSBhbHNvLlwiKSk7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVTdGF0dXMoeyBpY29uOiBpbmZvSWNvbiwgbWVzc2FnZSB9LCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJ1bm5pbmdFeHRlbnNpb24gPSB0aGlzLmV4dGVuc2lvblNlcnZpY2UuZXh0ZW5zaW9ucy5maWx0ZXIoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyh7IGlkOiBlLmlkZW50aWZpZXIudmFsdWUsIHV1aWQ6IGUudXVpZCB9LCB0aGlzLmV4dGVuc2lvbiEuaWRlbnRpZmllcikpWzBdO1xuXHRcdFx0Y29uc3QgcnVubmluZ0V4dGVuc2lvblNlcnZlciA9IHJ1bm5pbmdFeHRlbnNpb24gPyB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLmdldEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIodG9FeHRlbnNpb24ocnVubmluZ0V4dGVuc2lvbikpIDogbnVsbDtcblx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbi5zZXJ2ZXIgPT09IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UubG9jYWxFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyICYmIHJ1bm5pbmdFeHRlbnNpb25TZXJ2ZXIgPT09IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcikge1xuXHRcdFx0XHRpZiAodGhpcy5leHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlLnByZWZlcnNFeGVjdXRlT25Xb3Jrc3BhY2UodGhpcy5leHRlbnNpb24ubG9jYWwubWFuaWZlc3QpKSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVTdGF0dXMoeyBpY29uOiBpbmZvSWNvbiwgbWVzc2FnZTogbmV3IE1hcmtkb3duU3RyaW5nKGAke2xvY2FsaXplKCdlbmFibGVkIHJlbW90ZWx5JywgXCJUaGlzIGV4dGVuc2lvbiBpcyBlbmFibGVkIGluIHRoZSBSZW1vdGUgRXh0ZW5zaW9uIEhvc3QgYmVjYXVzZSBpdCBwcmVmZXJzIHRvIHJ1biB0aGVyZS5cIil9IFske2xvY2FsaXplKCdsZWFybiBtb3JlJywgXCJMZWFybiBNb3JlXCIpfV0oaHR0cHM6Ly9jb2RlLnZpc3VhbHN0dWRpby5jb20vYXBpL2FkdmFuY2VkLXRvcGljcy9yZW1vdGUtZXh0ZW5zaW9ucyNhcmNoaXRlY3R1cmUtYW5kLWV4dGVuc2lvbi1raW5kcylgKSB9LCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbi5zZXJ2ZXIgPT09IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciAmJiBydW5uaW5nRXh0ZW5zaW9uU2VydmVyID09PSB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLmxvY2FsRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcikge1xuXHRcdFx0XHRpZiAodGhpcy5leHRlbnNpb25NYW5pZmVzdFByb3BlcnRpZXNTZXJ2aWNlLnByZWZlcnNFeGVjdXRlT25VSSh0aGlzLmV4dGVuc2lvbi5sb2NhbC5tYW5pZmVzdCkpIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZVN0YXR1cyh7IGljb246IGluZm9JY29uLCBtZXNzYWdlOiBuZXcgTWFya2Rvd25TdHJpbmcoYCR7bG9jYWxpemUoJ2VuYWJsZWQgbG9jYWxseScsIFwiVGhpcyBleHRlbnNpb24gaXMgZW5hYmxlZCBpbiB0aGUgTG9jYWwgRXh0ZW5zaW9uIEhvc3QgYmVjYXVzZSBpdCBwcmVmZXJzIHRvIHJ1biB0aGVyZS5cIil9IFske2xvY2FsaXplKCdsZWFybiBtb3JlJywgXCJMZWFybiBNb3JlXCIpfV0oaHR0cHM6Ly9jb2RlLnZpc3VhbHN0dWRpby5jb20vYXBpL2FkdmFuY2VkLXRvcGljcy9yZW1vdGUtZXh0ZW5zaW9ucyNhcmNoaXRlY3R1cmUtYW5kLWV4dGVuc2lvbi1raW5kcylgKSB9LCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbi5zZXJ2ZXIgPT09IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciAmJiBydW5uaW5nRXh0ZW5zaW9uU2VydmVyID09PSB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLndlYkV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpIHtcblx0XHRcdFx0aWYgKHRoaXMuZXh0ZW5zaW9uTWFuaWZlc3RQcm9wZXJ0aWVzU2VydmljZS5jYW5FeGVjdXRlT25XZWIodGhpcy5leHRlbnNpb24ubG9jYWwubWFuaWZlc3QpKSB7XG5cdFx0XHRcdFx0dGhpcy51cGRhdGVTdGF0dXMoeyBpY29uOiBpbmZvSWNvbiwgbWVzc2FnZTogbmV3IE1hcmtkb3duU3RyaW5nKGAke2xvY2FsaXplKCdlbmFibGVkIGluIHdlYiB3b3JrZXInLCBcIlRoaXMgZXh0ZW5zaW9uIGlzIGVuYWJsZWQgaW4gdGhlIFdlYiBXb3JrZXIgRXh0ZW5zaW9uIEhvc3QgYmVjYXVzZSBpdCBwcmVmZXJzIHRvIHJ1biB0aGVyZS5cIil9IFske2xvY2FsaXplKCdsZWFybiBtb3JlJywgXCJMZWFybiBNb3JlXCIpfV0oaHR0cHM6Ly9jb2RlLnZpc3VhbHN0dWRpby5jb20vYXBpL2FkdmFuY2VkLXRvcGljcy9yZW1vdGUtZXh0ZW5zaW9ucyNhcmNoaXRlY3R1cmUtYW5kLWV4dGVuc2lvbi1raW5kcylgKSB9LCB0cnVlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gRXh0ZW5zaW9uIGlzIGRpc2FibGVkIGJ5IGl0cyBkZXBlbmRlbmN5XG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uLmVuYWJsZW1lbnRTdGF0ZSA9PT0gRW5hYmxlbWVudFN0YXRlLkRpc2FibGVkQnlFeHRlbnNpb25EZXBlbmRlbmN5KSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVN0YXR1cyh7XG5cdFx0XHRcdGljb246IHdhcm5pbmdJY29uLFxuXHRcdFx0XHRtZXNzYWdlOiBuZXcgTWFya2Rvd25TdHJpbmcobG9jYWxpemUoJ2V4dGVuc2lvbiBkaXNhYmxlZCBiZWNhdXNlIG9mIGRlcGVuZGVuY3knLCBcIlRoaXMgZXh0ZW5zaW9uIGRlcGVuZHMgb24gYW4gZXh0ZW5zaW9uIHRoYXQgaXMgZGlzYWJsZWQuXCIpKVxuXHRcdFx0XHRcdC5hcHBlbmRNYXJrZG93bihgJm5ic3A7WyR7bG9jYWxpemUoJ2RlcGVuZGVuY2llcycsIFwiU2hvdyBEZXBlbmRlbmNpZXNcIil9XSgke1VSSS5wYXJzZShgY29tbWFuZDpleHRlbnNpb24ub3Blbj8ke2VuY29kZVVSSUNvbXBvbmVudChKU09OLnN0cmluZ2lmeShbdGhpcy5leHRlbnNpb24uaWRlbnRpZmllci5pZCwgRXh0ZW5zaW9uRWRpdG9yVGFiLkRlcGVuZGVuY2llc10pKX1gKX0pYClcblx0XHRcdH0sIHRydWUpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5leHRlbnNpb24ubG9jYWwuaXNWYWxpZCkge1xuXHRcdFx0Y29uc3QgZXJyb3JzID0gdGhpcy5leHRlbnNpb24ubG9jYWwudmFsaWRhdGlvbnMuZmlsdGVyKChbc2V2ZXJpdHldKSA9PiBzZXZlcml0eSA9PT0gU2V2ZXJpdHkuRXJyb3IpLm1hcCgoWywgbWVzc2FnZV0pID0+IG1lc3NhZ2UpO1xuXHRcdFx0dGhpcy51cGRhdGVTdGF0dXMoeyBpY29uOiB3YXJuaW5nSWNvbiwgbWVzc2FnZTogbmV3IE1hcmtkb3duU3RyaW5nKGVycm9ycy5qb2luKCcgJykudHJpbSgpKSB9LCB0cnVlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBpc0VuYWJsZWQgPSB0aGlzLndvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZCh0aGlzLmV4dGVuc2lvbi5sb2NhbCk7XG5cdFx0Y29uc3QgaXNSdW5uaW5nID0gdGhpcy5leHRlbnNpb25TZXJ2aWNlLmV4dGVuc2lvbnMuc29tZShlID0+IGFyZVNhbWVFeHRlbnNpb25zKHsgaWQ6IGUuaWRlbnRpZmllci52YWx1ZSwgdXVpZDogZS51dWlkIH0sIHRoaXMuZXh0ZW5zaW9uIS5pZGVudGlmaWVyKSk7XG5cblx0XHRpZiAoIXRoaXMuZXh0ZW5zaW9uLmlzV29ya3NwYWNlU2NvcGVkICYmIGlzRW5hYmxlZCAmJiBpc1J1bm5pbmcpIHtcblx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbi5lbmFibGVtZW50U3RhdGUgPT09IEVuYWJsZW1lbnRTdGF0ZS5FbmFibGVkV29ya3NwYWNlKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlU3RhdHVzKHsgbWVzc2FnZTogbmV3IE1hcmtkb3duU3RyaW5nKGxvY2FsaXplKCd3b3Jrc3BhY2UgZW5hYmxlZCcsIFwiVGhpcyBleHRlbnNpb24gaXMgZW5hYmxlZCBmb3IgdGhpcyB3b3Jrc3BhY2UgYnkgdGhlIHVzZXIuXCIpKSB9LCB0cnVlKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UubG9jYWxFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyICYmIHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcikge1xuXHRcdFx0XHRpZiAodGhpcy5leHRlbnNpb24uc2VydmVyID09PSB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLnJlbW90ZUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpIHtcblx0XHRcdFx0XHR0aGlzLnVwZGF0ZVN0YXR1cyh7IG1lc3NhZ2U6IG5ldyBNYXJrZG93blN0cmluZyhsb2NhbGl6ZSgnZXh0ZW5zaW9uIGVuYWJsZWQgb24gcmVtb3RlJywgXCJFeHRlbnNpb24gaXMgZW5hYmxlZCBvbiAnezB9J1wiLCB0aGlzLmV4dGVuc2lvbi5zZXJ2ZXIubGFiZWwpKSB9LCB0cnVlKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbi5lbmFibGVtZW50U3RhdGUgPT09IEVuYWJsZW1lbnRTdGF0ZS5FbmFibGVkR2xvYmFsbHkpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICghaXNFbmFibGVkICYmICFpc1J1bm5pbmcpIHtcblx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbi5lbmFibGVtZW50U3RhdGUgPT09IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEdsb2JhbGx5KSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlU3RhdHVzKHsgbWVzc2FnZTogbmV3IE1hcmtkb3duU3RyaW5nKGxvY2FsaXplKCdnbG9iYWxseSBkaXNhYmxlZCcsIFwiVGhpcyBleHRlbnNpb24gaXMgZGlzYWJsZWQgZ2xvYmFsbHkgYnkgdGhlIHVzZXIuXCIpKSB9LCB0cnVlKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHRoaXMuZXh0ZW5zaW9uLmVuYWJsZW1lbnRTdGF0ZSA9PT0gRW5hYmxlbWVudFN0YXRlLkRpc2FibGVkV29ya3NwYWNlKSB7XG5cdFx0XHRcdHRoaXMudXBkYXRlU3RhdHVzKHsgbWVzc2FnZTogbmV3IE1hcmtkb3duU3RyaW5nKGxvY2FsaXplKCd3b3Jrc3BhY2UgZGlzYWJsZWQnLCBcIlRoaXMgZXh0ZW5zaW9uIGlzIGRpc2FibGVkIGZvciB0aGlzIHdvcmtzcGFjZSBieSB0aGUgdXNlci5cIikpIH0sIHRydWUpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVTdGF0dXMoc3RhdHVzOiBFeHRlbnNpb25TdGF0dXMgfCB1bmRlZmluZWQsIHVwZGF0ZUNsYXNzOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKHN0YXR1cykge1xuXHRcdFx0aWYgKHRoaXMuX3N0YXR1cy5zb21lKHMgPT4gcy5tZXNzYWdlLnZhbHVlID09PSBzdGF0dXMubWVzc2FnZS52YWx1ZSAmJiBzLmljb24/LmlkID09PSBzdGF0dXMuaWNvbj8uaWQpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0aWYgKHRoaXMuX3N0YXR1cy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fc3RhdHVzID0gW107XG5cdFx0fVxuXG5cdFx0aWYgKHN0YXR1cykge1xuXHRcdFx0dGhpcy5fc3RhdHVzLnB1c2goc3RhdHVzKTtcblx0XHRcdHRoaXMuX3N0YXR1cy5zb3J0KChhLCBiKSA9PlxuXHRcdFx0XHRiLmljb24gPT09IHRydXN0SWNvbiA/IC0xIDpcblx0XHRcdFx0XHRhLmljb24gPT09IHRydXN0SWNvbiA/IDEgOlxuXHRcdFx0XHRcdFx0Yi5pY29uID09PSBlcnJvckljb24gPyAtMSA6XG5cdFx0XHRcdFx0XHRcdGEuaWNvbiA9PT0gZXJyb3JJY29uID8gMSA6XG5cdFx0XHRcdFx0XHRcdFx0Yi5pY29uID09PSB3YXJuaW5nSWNvbiA/IC0xIDpcblx0XHRcdFx0XHRcdFx0XHRcdGEuaWNvbiA9PT0gd2FybmluZ0ljb24gPyAxIDpcblx0XHRcdFx0XHRcdFx0XHRcdFx0Yi5pY29uID09PSBpbmZvSWNvbiA/IC0xIDpcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRhLmljb24gPT09IGluZm9JY29uID8gMSA6XG5cdFx0XHRcdFx0XHRcdFx0XHRcdFx0XHQwXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdGlmICh1cGRhdGVDbGFzcykge1xuXHRcdFx0aWYgKHN0YXR1cz8uaWNvbiA9PT0gZXJyb3JJY29uKSB7XG5cdFx0XHRcdHRoaXMuY2xhc3MgPSBgJHtFeHRlbnNpb25TdGF0dXNBY3Rpb24uQ0xBU1N9IGV4dGVuc2lvbi1zdGF0dXMtZXJyb3IgJHtUaGVtZUljb24uYXNDbGFzc05hbWUoZXJyb3JJY29uKX1gO1xuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoc3RhdHVzPy5pY29uID09PSB3YXJuaW5nSWNvbikge1xuXHRcdFx0XHR0aGlzLmNsYXNzID0gYCR7RXh0ZW5zaW9uU3RhdHVzQWN0aW9uLkNMQVNTfSBleHRlbnNpb24tc3RhdHVzLXdhcm5pbmcgJHtUaGVtZUljb24uYXNDbGFzc05hbWUod2FybmluZ0ljb24pfWA7XG5cdFx0XHR9XG5cdFx0XHRlbHNlIGlmIChzdGF0dXM/Lmljb24gPT09IGluZm9JY29uKSB7XG5cdFx0XHRcdHRoaXMuY2xhc3MgPSBgJHtFeHRlbnNpb25TdGF0dXNBY3Rpb24uQ0xBU1N9IGV4dGVuc2lvbi1zdGF0dXMtaW5mbyAke1RoZW1lSWNvbi5hc0NsYXNzTmFtZShpbmZvSWNvbil9YDtcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKHN0YXR1cz8uaWNvbiA9PT0gdHJ1c3RJY29uKSB7XG5cdFx0XHRcdHRoaXMuY2xhc3MgPSBgJHtFeHRlbnNpb25TdGF0dXNBY3Rpb24uQ0xBU1N9ICR7VGhlbWVJY29uLmFzQ2xhc3NOYW1lKHRydXN0SWNvbil9YDtcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHR0aGlzLmNsYXNzID0gYCR7RXh0ZW5zaW9uU3RhdHVzQWN0aW9uLkNMQVNTfSBoaWRlYDtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0dXMuZmlyZSgpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcnVuKCk6IFByb21pc2U8YW55PiB7XG5cdFx0aWYgKHRoaXMuX3N0YXR1c1swXT8uaWNvbiA9PT0gdHJ1c3RJY29uKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnd29ya2JlbmNoLnRydXN0Lm1hbmFnZScpO1xuXHRcdH1cblx0fVxufVxuXG5leHBvcnQgY2xhc3MgSW5zdGFsbFNwZWNpZmljVmVyc2lvbk9mRXh0ZW5zaW9uQWN0aW9uIGV4dGVuZHMgQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLmluc3RhbGwuc3BlY2lmaWNWZXJzaW9uJztcblx0c3RhdGljIHJlYWRvbmx5IExBQkVMID0gbG9jYWxpemUoJ2luc3RhbGwgcHJldmlvdXMgdmVyc2lvbicsIFwiSW5zdGFsbCBTcGVjaWZpYyBWZXJzaW9uIG9mIEV4dGVuc2lvbi4uLlwiKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRpZDogc3RyaW5nID0gSW5zdGFsbFNwZWNpZmljVmVyc2lvbk9mRXh0ZW5zaW9uQWN0aW9uLklELCBsYWJlbDogc3RyaW5nID0gSW5zdGFsbFNwZWNpZmljVmVyc2lvbk9mRXh0ZW5zaW9uQWN0aW9uLkxBQkVMLFxuXHRcdEBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJUXVpY2tJbnB1dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBxdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25FbmFibGVtZW50U2VydmljZTogSVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihpZCwgbGFiZWwpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0IGVuYWJsZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UubG9jYWwuc29tZShsID0+IHRoaXMuaXNFbmFibGVkKGwpKTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bigpOiBQcm9taXNlPGFueT4ge1xuXHRcdGNvbnN0IGV4dGVuc2lvblBpY2sgPSBhd2FpdCB0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLnBpY2sodGhpcy5nZXRFeHRlbnNpb25FbnRyaWVzKCksIHsgcGxhY2VIb2xkZXI6IGxvY2FsaXplKCdzZWxlY3RFeHRlbnNpb24nLCBcIlNlbGVjdCBFeHRlbnNpb25cIiksIG1hdGNoT25EZXRhaWw6IHRydWUgfSk7XG5cdFx0aWYgKGV4dGVuc2lvblBpY2sgJiYgZXh0ZW5zaW9uUGljay5leHRlbnNpb24pIHtcblx0XHRcdGNvbnN0IGFjdGlvbiA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW5zdGFsbEFub3RoZXJWZXJzaW9uQWN0aW9uLCBleHRlbnNpb25QaWNrLmV4dGVuc2lvbiwgdHJ1ZSk7XG5cdFx0XHRhd2FpdCBhY3Rpb24ucnVuKCk7XG5cdFx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLm9wZW5TZWFyY2goZXh0ZW5zaW9uUGljay5leHRlbnNpb24uaWRlbnRpZmllci5pZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBpc0VuYWJsZWQoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgYWN0aW9uID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShJbnN0YWxsQW5vdGhlclZlcnNpb25BY3Rpb24sIGV4dGVuc2lvbiwgdHJ1ZSk7XG5cdFx0cmV0dXJuIGFjdGlvbi5lbmFibGVkICYmICEhZXh0ZW5zaW9uLmxvY2FsICYmIHRoaXMuZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuaXNFbmFibGVkKGV4dGVuc2lvbi5sb2NhbCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldEV4dGVuc2lvbkVudHJpZXMoKTogUHJvbWlzZTxJRXh0ZW5zaW9uUGlja0l0ZW1bXT4ge1xuXHRcdGNvbnN0IGluc3RhbGxlZCA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UucXVlcnlMb2NhbCgpO1xuXHRcdGNvbnN0IGVudHJpZXM6IElFeHRlbnNpb25QaWNrSXRlbVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgaW5zdGFsbGVkKSB7XG5cdFx0XHRpZiAodGhpcy5pc0VuYWJsZWQoZXh0ZW5zaW9uKSkge1xuXHRcdFx0XHRlbnRyaWVzLnB1c2goe1xuXHRcdFx0XHRcdGlkOiBleHRlbnNpb24uaWRlbnRpZmllci5pZCxcblx0XHRcdFx0XHRsYWJlbDogZXh0ZW5zaW9uLmRpc3BsYXlOYW1lIHx8IGV4dGVuc2lvbi5pZGVudGlmaWVyLmlkLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBleHRlbnNpb24uaWRlbnRpZmllci5pZCxcblx0XHRcdFx0XHRleHRlbnNpb24sXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZW50cmllcy5zb3J0KChlMSwgZTIpID0+IGUxLmV4dGVuc2lvbi5kaXNwbGF5TmFtZS5sb2NhbGVDb21wYXJlKGUyLmV4dGVuc2lvbi5kaXNwbGF5TmFtZSkpO1xuXHR9XG59XG5cbmludGVyZmFjZSBJRXh0ZW5zaW9uUGlja0l0ZW0gZXh0ZW5kcyBJUXVpY2tQaWNrSXRlbSB7XG5cdGV4dGVuc2lvbjogSUV4dGVuc2lvbjtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0SW5zdGFsbEV4dGVuc2lvbnNJblNlcnZlckFjdGlvbiBleHRlbmRzIEFjdGlvbiB7XG5cblx0cHJpdmF0ZSBleHRlbnNpb25zOiBJRXh0ZW5zaW9uW10gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0aWQ6IHN0cmluZyxcblx0XHRASUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIHByb3RlY3RlZCByZWFkb25seSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJUXVpY2tJbnB1dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBxdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJUHJvZ3Jlc3NTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZ3Jlc3NTZXJ2aWNlOiBJUHJvZ3Jlc3NTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihpZCk7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0XHR0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnF1ZXJ5TG9jYWwoKS50aGVuKCgpID0+IHRoaXMudXBkYXRlRXh0ZW5zaW9ucygpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLm9uQ2hhbmdlKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbnMpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVFeHRlbnNpb25zKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVFeHRlbnNpb25zKCk6IHZvaWQge1xuXHRcdHRoaXMuZXh0ZW5zaW9ucyA9IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UubG9jYWw7XG5cdFx0dGhpcy51cGRhdGUoKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlKCk6IHZvaWQge1xuXHRcdHRoaXMuZW5hYmxlZCA9ICEhdGhpcy5leHRlbnNpb25zICYmIHRoaXMuZ2V0RXh0ZW5zaW9uc1RvSW5zdGFsbCh0aGlzLmV4dGVuc2lvbnMpLmxlbmd0aCA+IDA7XG5cdFx0dGhpcy50b29sdGlwID0gdGhpcy5sYWJlbDtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5zZWxlY3RBbmRJbnN0YWxsRXh0ZW5zaW9ucygpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBxdWVyeUV4dGVuc2lvbnNUb0luc3RhbGwoKTogUHJvbWlzZTxJRXh0ZW5zaW9uW10+IHtcblx0XHRjb25zdCBsb2NhbCA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UucXVlcnlMb2NhbCgpO1xuXHRcdHJldHVybiB0aGlzLmdldEV4dGVuc2lvbnNUb0luc3RhbGwobG9jYWwpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBzZWxlY3RBbmRJbnN0YWxsRXh0ZW5zaW9ucygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBxdWlja1BpY2sgPSB0aGlzLnF1aWNrSW5wdXRTZXJ2aWNlLmNyZWF0ZVF1aWNrUGljazxJRXh0ZW5zaW9uUGlja0l0ZW0+KCk7XG5cdFx0cXVpY2tQaWNrLmJ1c3kgPSB0cnVlO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBxdWlja1BpY2sub25EaWRBY2NlcHQoKCkgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRxdWlja1BpY2suaGlkZSgpO1xuXHRcdFx0cXVpY2tQaWNrLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMub25EaWRBY2NlcHQocXVpY2tQaWNrLnNlbGVjdGVkSXRlbXMpO1xuXHRcdH0pO1xuXHRcdHF1aWNrUGljay5zaG93KCk7XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zVG9JbnN0YWxsID0gYXdhaXQgdGhpcy5xdWVyeUV4dGVuc2lvbnNUb0luc3RhbGwoKTtcblx0XHRxdWlja1BpY2suYnVzeSA9IGZhbHNlO1xuXHRcdGlmIChsb2NhbEV4dGVuc2lvbnNUb0luc3RhbGwubGVuZ3RoKSB7XG5cdFx0XHRxdWlja1BpY2sudGl0bGUgPSB0aGlzLmdldFF1aWNrUGlja1RpdGxlKCk7XG5cdFx0XHRxdWlja1BpY2sucGxhY2Vob2xkZXIgPSBsb2NhbGl6ZSgnc2VsZWN0IGV4dGVuc2lvbnMgdG8gaW5zdGFsbCcsIFwiU2VsZWN0IGV4dGVuc2lvbnMgdG8gaW5zdGFsbFwiKTtcblx0XHRcdHF1aWNrUGljay5jYW5TZWxlY3RNYW55ID0gdHJ1ZTtcblx0XHRcdGxvY2FsRXh0ZW5zaW9uc1RvSW5zdGFsbC5zb3J0KChlMSwgZTIpID0+IGUxLmRpc3BsYXlOYW1lLmxvY2FsZUNvbXBhcmUoZTIuZGlzcGxheU5hbWUpKTtcblx0XHRcdHF1aWNrUGljay5pdGVtcyA9IGxvY2FsRXh0ZW5zaW9uc1RvSW5zdGFsbC5tYXA8SUV4dGVuc2lvblBpY2tJdGVtPihleHRlbnNpb24gPT4gKHsgZXh0ZW5zaW9uLCBsYWJlbDogZXh0ZW5zaW9uLmRpc3BsYXlOYW1lLCBkZXNjcmlwdGlvbjogZXh0ZW5zaW9uLnZlcnNpb24gfSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRxdWlja1BpY2suaGlkZSgpO1xuXHRcdFx0cXVpY2tQaWNrLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5ub3RpZnkoe1xuXHRcdFx0XHRzZXZlcml0eTogU2V2ZXJpdHkuSW5mbyxcblx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ25vIGxvY2FsIGV4dGVuc2lvbnMnLCBcIlRoZXJlIGFyZSBubyBleHRlbnNpb25zIHRvIGluc3RhbGwuXCIpXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIG9uRGlkQWNjZXB0KHNlbGVjdGVkSXRlbXM6IFJlYWRvbmx5QXJyYXk8SUV4dGVuc2lvblBpY2tJdGVtPik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChzZWxlY3RlZEl0ZW1zLmxlbmd0aCkge1xuXHRcdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zVG9JbnN0YWxsID0gc2VsZWN0ZWRJdGVtcy5maWx0ZXIociA9PiAhIXIuZXh0ZW5zaW9uKS5tYXAociA9PiByLmV4dGVuc2lvbik7XG5cdFx0XHRpZiAobG9jYWxFeHRlbnNpb25zVG9JbnN0YWxsLmxlbmd0aCkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLnByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3MoXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bG9jYXRpb246IFByb2dyZXNzTG9jYXRpb24uTm90aWZpY2F0aW9uLFxuXHRcdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdpbnN0YWxsaW5nIGV4dGVuc2lvbnMnLCBcIkluc3RhbGxpbmcgRXh0ZW5zaW9ucy4uLlwiKVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0KCkgPT4gdGhpcy5pbnN0YWxsRXh0ZW5zaW9ucyhsb2NhbEV4dGVuc2lvbnNUb0luc3RhbGwpKTtcblx0XHRcdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmluZm8obG9jYWxpemUoJ2ZpbmlzaGVkIGluc3RhbGxpbmcnLCBcIlN1Y2Nlc3NmdWxseSBpbnN0YWxsZWQgZXh0ZW5zaW9ucy5cIikpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBhYnN0cmFjdCBnZXRRdWlja1BpY2tUaXRsZSgpOiBzdHJpbmc7XG5cdHByb3RlY3RlZCBhYnN0cmFjdCBnZXRFeHRlbnNpb25zVG9JbnN0YWxsKGxvY2FsOiBJRXh0ZW5zaW9uW10pOiBJRXh0ZW5zaW9uW107XG5cdHByb3RlY3RlZCBhYnN0cmFjdCBpbnN0YWxsRXh0ZW5zaW9ucyhleHRlbnNpb25zOiBJRXh0ZW5zaW9uW10pOiBQcm9taXNlPHZvaWQ+O1xufVxuXG5leHBvcnQgY2xhc3MgSW5zdGFsbExvY2FsRXh0ZW5zaW9uc0luUmVtb3RlQWN0aW9uIGV4dGVuZHMgQWJzdHJhY3RJbnN0YWxsRXh0ZW5zaW9uc0luU2VydmVyQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlOiBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBxdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRcdEBJUHJvZ3Jlc3NTZXJ2aWNlIHByb2dyZXNzU2VydmljZTogSVByb2dyZXNzU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2Ugbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlOiBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlOiBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb25zLmluc3RhbGxMb2NhbEV4dGVuc2lvbnNJblJlbW90ZScsIGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLCBxdWlja0lucHV0U2VydmljZSwgbm90aWZpY2F0aW9uU2VydmljZSwgcHJvZ3Jlc3NTZXJ2aWNlKTtcblx0fVxuXG5cdG92ZXJyaWRlIGdldCBsYWJlbCgpOiBzdHJpbmcge1xuXHRcdGlmICh0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlICYmIHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlcikge1xuXHRcdFx0cmV0dXJuIGxvY2FsaXplKCdzZWxlY3QgYW5kIGluc3RhbGwgbG9jYWwgZXh0ZW5zaW9ucycsIFwiSW5zdGFsbCBMb2NhbCBFeHRlbnNpb25zIGluICd7MH0nLi4uXCIsIHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlci5sYWJlbCk7XG5cdFx0fVxuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRRdWlja1BpY2tUaXRsZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBsb2NhbGl6ZSgnaW5zdGFsbCBsb2NhbCBleHRlbnNpb25zIHRpdGxlJywgXCJJbnN0YWxsIExvY2FsIEV4dGVuc2lvbnMgaW4gJ3swfSdcIiwgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5yZW1vdGVFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyIS5sYWJlbCk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgZ2V0RXh0ZW5zaW9uc1RvSW5zdGFsbChsb2NhbDogSUV4dGVuc2lvbltdKTogSUV4dGVuc2lvbltdIHtcblx0XHRyZXR1cm4gbG9jYWwuZmlsdGVyKGV4dGVuc2lvbiA9PiB7XG5cdFx0XHRjb25zdCBhY3Rpb24gPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFJlbW90ZUluc3RhbGxBY3Rpb24sIHRydWUpO1xuXHRcdFx0YWN0aW9uLmV4dGVuc2lvbiA9IGV4dGVuc2lvbjtcblx0XHRcdHJldHVybiBhY3Rpb24uZW5hYmxlZDtcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBpbnN0YWxsRXh0ZW5zaW9ucyhsb2NhbEV4dGVuc2lvbnNUb0luc3RhbGw6IElFeHRlbnNpb25bXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGdhbGxlcnlFeHRlbnNpb25zOiBJR2FsbGVyeUV4dGVuc2lvbltdID0gW107XG5cdFx0Y29uc3QgdnNpeHM6IFVSSVtdID0gW107XG5cdFx0Y29uc3QgdGFyZ2V0UGxhdGZvcm0gPSBhd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLnJlbW90ZUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIhLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmdldFRhcmdldFBsYXRmb3JtKCk7XG5cdFx0YXdhaXQgUHJvbWlzZXMuc2V0dGxlZChsb2NhbEV4dGVuc2lvbnNUb0luc3RhbGwubWFwKGFzeW5jIGV4dGVuc2lvbiA9PiB7XG5cdFx0XHRpZiAodGhpcy5leHRlbnNpb25HYWxsZXJ5U2VydmljZS5pc0VuYWJsZWQoKSkge1xuXHRcdFx0XHRjb25zdCBnYWxsZXJ5ID0gKGF3YWl0IHRoaXMuZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UuZ2V0RXh0ZW5zaW9ucyhbeyAuLi5leHRlbnNpb24uaWRlbnRpZmllciwgcHJlUmVsZWFzZTogISFleHRlbnNpb24ubG9jYWw/LnByZVJlbGVhc2UgfV0sIHsgdGFyZ2V0UGxhdGZvcm0sIGNvbXBhdGlibGU6IHRydWUgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkpWzBdO1xuXHRcdFx0XHRpZiAoZ2FsbGVyeSkge1xuXHRcdFx0XHRcdGdhbGxlcnlFeHRlbnNpb25zLnB1c2goZ2FsbGVyeSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjb25zdCB2c2l4ID0gYXdhaXQgdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5sb2NhbEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIhLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLnppcChleHRlbnNpb24ubG9jYWwhKTtcblx0XHRcdHZzaXhzLnB1c2godnNpeCk7XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgUHJvbWlzZXMuc2V0dGxlZChnYWxsZXJ5RXh0ZW5zaW9ucy5tYXAoZ2FsbGVyeSA9PiB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLnJlbW90ZUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIhLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmluc3RhbGxGcm9tR2FsbGVyeShnYWxsZXJ5KSkpO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBQcm9taXNlcy5zZXR0bGVkKHZzaXhzLm1hcCh2c2l4ID0+IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UucmVtb3RlRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciEuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuaW5zdGFsbCh2c2l4KSkpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCBQcm9taXNlLmFsbFNldHRsZWQodnNpeHMubWFwKHZzaXggPT4gdGhpcy5maWxlU2VydmljZS5kZWwodnNpeCkpKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHRoaXMubG9nU2VydmljZS5lcnJvcihlcnJvcik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBJbnN0YWxsUmVtb3RlRXh0ZW5zaW9uc0luTG9jYWxBY3Rpb24gZXh0ZW5kcyBBYnN0cmFjdEluc3RhbGxFeHRlbnNpb25zSW5TZXJ2ZXJBY3Rpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGlkOiBzdHJpbmcsXG5cdFx0QElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZTogSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLFxuXHRcdEBJUXVpY2tJbnB1dFNlcnZpY2UgcXVpY2tJbnB1dFNlcnZpY2U6IElRdWlja0lucHV0U2VydmljZSxcblx0XHRASVByb2dyZXNzU2VydmljZSBwcm9ncmVzc1NlcnZpY2U6IElQcm9ncmVzc1NlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZTogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25HYWxsZXJ5U2VydmljZTogSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihpZCwgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsIHF1aWNrSW5wdXRTZXJ2aWNlLCBub3RpZmljYXRpb25TZXJ2aWNlLCBwcm9ncmVzc1NlcnZpY2UpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0IGxhYmVsKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGxvY2FsaXplKCdzZWxlY3QgYW5kIGluc3RhbGwgcmVtb3RlIGV4dGVuc2lvbnMnLCBcIkluc3RhbGwgUmVtb3RlIEV4dGVuc2lvbnMgTG9jYWxseS4uLlwiKTtcblx0fVxuXG5cdHByb3RlY3RlZCBnZXRRdWlja1BpY2tUaXRsZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiBsb2NhbGl6ZSgnaW5zdGFsbCByZW1vdGUgZXh0ZW5zaW9ucycsIFwiSW5zdGFsbCBSZW1vdGUgRXh0ZW5zaW9ucyBMb2NhbGx5XCIpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGdldEV4dGVuc2lvbnNUb0luc3RhbGwobG9jYWw6IElFeHRlbnNpb25bXSk6IElFeHRlbnNpb25bXSB7XG5cdFx0cmV0dXJuIGxvY2FsLmZpbHRlcihleHRlbnNpb24gPT5cblx0XHRcdGV4dGVuc2lvbi50eXBlID09PSBFeHRlbnNpb25UeXBlLlVzZXIgJiYgZXh0ZW5zaW9uLnNlcnZlciAhPT0gdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5sb2NhbEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJcblx0XHRcdCYmICF0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmluc3RhbGxlZC5zb21lKGUgPT4gZS5zZXJ2ZXIgPT09IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UubG9jYWxFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyICYmIGFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgZXh0ZW5zaW9uLmlkZW50aWZpZXIpKSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgaW5zdGFsbEV4dGVuc2lvbnMoZXh0ZW5zaW9uczogSUV4dGVuc2lvbltdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZ2FsbGVyeUV4dGVuc2lvbnM6IElHYWxsZXJ5RXh0ZW5zaW9uW10gPSBbXTtcblx0XHRjb25zdCB2c2l4czogVVJJW10gPSBbXTtcblx0XHRjb25zdCB0YXJnZXRQbGF0Zm9ybSA9IGF3YWl0IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UubG9jYWxFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyIS5leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRUYXJnZXRQbGF0Zm9ybSgpO1xuXHRcdGF3YWl0IFByb21pc2VzLnNldHRsZWQoZXh0ZW5zaW9ucy5tYXAoYXN5bmMgZXh0ZW5zaW9uID0+IHtcblx0XHRcdGlmICh0aGlzLmV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLmlzRW5hYmxlZCgpKSB7XG5cdFx0XHRcdGNvbnN0IGdhbGxlcnkgPSAoYXdhaXQgdGhpcy5leHRlbnNpb25HYWxsZXJ5U2VydmljZS5nZXRFeHRlbnNpb25zKFt7IC4uLmV4dGVuc2lvbi5pZGVudGlmaWVyLCBwcmVSZWxlYXNlOiAhIWV4dGVuc2lvbi5sb2NhbD8ucHJlUmVsZWFzZSB9XSwgeyB0YXJnZXRQbGF0Zm9ybSwgY29tcGF0aWJsZTogdHJ1ZSB9LCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSlbMF07XG5cdFx0XHRcdGlmIChnYWxsZXJ5KSB7XG5cdFx0XHRcdFx0Z2FsbGVyeUV4dGVuc2lvbnMucHVzaChnYWxsZXJ5KTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGNvbnN0IHZzaXggPSBhd2FpdCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLnJlbW90ZUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIhLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLnppcChleHRlbnNpb24ubG9jYWwhKTtcblx0XHRcdHZzaXhzLnB1c2godnNpeCk7XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgUHJvbWlzZXMuc2V0dGxlZChnYWxsZXJ5RXh0ZW5zaW9ucy5tYXAoZ2FsbGVyeSA9PiB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLmxvY2FsRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlciEuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuaW5zdGFsbEZyb21HYWxsZXJ5KGdhbGxlcnkpKSk7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IFByb21pc2VzLnNldHRsZWQodnNpeHMubWFwKHZzaXggPT4gdGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5sb2NhbEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIhLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmluc3RhbGwodnNpeCkpKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKHZzaXhzLm1hcCh2c2l4ID0+IHRoaXMuZmlsZVNlcnZpY2UuZGVsKHZzaXgpKSk7XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoZXJyb3IpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLnNob3dFeHRlbnNpb25zRm9yTGFuZ3VhZ2UnLCBmdW5jdGlvbiAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGZpbGVFeHRlbnNpb246IHN0cmluZykge1xuXHRjb25zdCBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZSA9IGFjY2Vzc29yLmdldChJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UpO1xuXHRyZXR1cm4gZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub3BlblNlYXJjaChgZXh0OiR7ZmlsZUV4dGVuc2lvbi5yZXBsYWNlKC9eXFwuLywgJycpfWApO1xufSk7XG5cbmV4cG9ydCBjb25zdCBzaG93RXh0ZW5zaW9uc1dpdGhJZHNDb21tYW5kSWQgPSAnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLnNob3dFeHRlbnNpb25zV2l0aElkcyc7XG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZChzaG93RXh0ZW5zaW9uc1dpdGhJZHNDb21tYW5kSWQsIGZ1bmN0aW9uIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZXh0ZW5zaW9uSWRzOiBzdHJpbmdbXSkge1xuXHRjb25zdCBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZSA9IGFjY2Vzc29yLmdldChJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UpO1xuXHRyZXR1cm4gZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub3BlblNlYXJjaChleHRlbnNpb25JZHMubWFwKGlkID0+IGBAaWQ6JHtpZH1gKS5qb2luKCcgJykpO1xufSk7XG5cbnJlZ2lzdGVyQ29sb3IoJ2V4dGVuc2lvbkJ1dHRvbi5iYWNrZ3JvdW5kJywge1xuXHRkYXJrOiBidXR0b25CYWNrZ3JvdW5kLFxuXHRsaWdodDogYnV0dG9uQmFja2dyb3VuZCxcblx0aGNEYXJrOiBudWxsLFxuXHRoY0xpZ2h0OiBudWxsXG59LCBsb2NhbGl6ZSgnZXh0ZW5zaW9uQnV0dG9uQmFja2dyb3VuZCcsIFwiQnV0dG9uIGJhY2tncm91bmQgY29sb3IgZm9yIGV4dGVuc2lvbiBhY3Rpb25zLlwiKSk7XG5cbnJlZ2lzdGVyQ29sb3IoJ2V4dGVuc2lvbkJ1dHRvbi5mb3JlZ3JvdW5kJywge1xuXHRkYXJrOiBidXR0b25Gb3JlZ3JvdW5kLFxuXHRsaWdodDogYnV0dG9uRm9yZWdyb3VuZCxcblx0aGNEYXJrOiBudWxsLFxuXHRoY0xpZ2h0OiBudWxsXG59LCBsb2NhbGl6ZSgnZXh0ZW5zaW9uQnV0dG9uRm9yZWdyb3VuZCcsIFwiQnV0dG9uIGZvcmVncm91bmQgY29sb3IgZm9yIGV4dGVuc2lvbiBhY3Rpb25zLlwiKSk7XG5cbnJlZ2lzdGVyQ29sb3IoJ2V4dGVuc2lvbkJ1dHRvbi5ob3ZlckJhY2tncm91bmQnLCB7XG5cdGRhcms6IGJ1dHRvbkhvdmVyQmFja2dyb3VuZCxcblx0bGlnaHQ6IGJ1dHRvbkhvdmVyQmFja2dyb3VuZCxcblx0aGNEYXJrOiBudWxsLFxuXHRoY0xpZ2h0OiBudWxsXG59LCBsb2NhbGl6ZSgnZXh0ZW5zaW9uQnV0dG9uSG92ZXJCYWNrZ3JvdW5kJywgXCJCdXR0b24gYmFja2dyb3VuZCBob3ZlciBjb2xvciBmb3IgZXh0ZW5zaW9uIGFjdGlvbnMuXCIpKTtcblxucmVnaXN0ZXJDb2xvcignZXh0ZW5zaW9uQnV0dG9uLnNlcGFyYXRvcicsIGJ1dHRvblNlcGFyYXRvciwgbG9jYWxpemUoJ2V4dGVuc2lvbkJ1dHRvblNlcGFyYXRvcicsIFwiQnV0dG9uIHNlcGFyYXRvciBjb2xvciBmb3IgZXh0ZW5zaW9uIGFjdGlvbnNcIikpO1xuXG5leHBvcnQgY29uc3QgZXh0ZW5zaW9uQnV0dG9uUHJvbWluZW50QmFja2dyb3VuZCA9IHJlZ2lzdGVyQ29sb3IoJ2V4dGVuc2lvbkJ1dHRvbi5wcm9taW5lbnRCYWNrZ3JvdW5kJywge1xuXHRkYXJrOiBidXR0b25CYWNrZ3JvdW5kLFxuXHRsaWdodDogYnV0dG9uQmFja2dyb3VuZCxcblx0aGNEYXJrOiBudWxsLFxuXHRoY0xpZ2h0OiBudWxsXG59LCBsb2NhbGl6ZSgnZXh0ZW5zaW9uQnV0dG9uUHJvbWluZW50QmFja2dyb3VuZCcsIFwiQnV0dG9uIGJhY2tncm91bmQgY29sb3IgZm9yIGV4dGVuc2lvbiBhY3Rpb25zIHRoYXQgc3RhbmQgb3V0IChlLmcuIGluc3RhbGwgYnV0dG9uKS5cIikpO1xuXG5yZWdpc3RlckNvbG9yKCdleHRlbnNpb25CdXR0b24ucHJvbWluZW50Rm9yZWdyb3VuZCcsIHtcblx0ZGFyazogYnV0dG9uRm9yZWdyb3VuZCxcblx0bGlnaHQ6IGJ1dHRvbkZvcmVncm91bmQsXG5cdGhjRGFyazogbnVsbCxcblx0aGNMaWdodDogbnVsbFxufSwgbG9jYWxpemUoJ2V4dGVuc2lvbkJ1dHRvblByb21pbmVudEZvcmVncm91bmQnLCBcIkJ1dHRvbiBmb3JlZ3JvdW5kIGNvbG9yIGZvciBleHRlbnNpb24gYWN0aW9ucyB0aGF0IHN0YW5kIG91dCAoZS5nLiBpbnN0YWxsIGJ1dHRvbikuXCIpKTtcblxucmVnaXN0ZXJDb2xvcignZXh0ZW5zaW9uQnV0dG9uLnByb21pbmVudEhvdmVyQmFja2dyb3VuZCcsIHtcblx0ZGFyazogYnV0dG9uSG92ZXJCYWNrZ3JvdW5kLFxuXHRsaWdodDogYnV0dG9uSG92ZXJCYWNrZ3JvdW5kLFxuXHRoY0Rhcms6IG51bGwsXG5cdGhjTGlnaHQ6IG51bGxcbn0sIGxvY2FsaXplKCdleHRlbnNpb25CdXR0b25Qcm9taW5lbnRIb3ZlckJhY2tncm91bmQnLCBcIkJ1dHRvbiBiYWNrZ3JvdW5kIGhvdmVyIGNvbG9yIGZvciBleHRlbnNpb24gYWN0aW9ucyB0aGF0IHN0YW5kIG91dCAoZS5nLiBpbnN0YWxsIGJ1dHRvbikuXCIpKTtcblxucmVnaXN0ZXJUaGVtaW5nUGFydGljaXBhbnQoKHRoZW1lOiBJQ29sb3JUaGVtZSwgY29sbGVjdG9yOiBJQ3NzU3R5bGVDb2xsZWN0b3IpID0+IHtcblxuXHRjb25zdCBlcnJvckNvbG9yID0gdGhlbWUuZ2V0Q29sb3IoZWRpdG9yRXJyb3JGb3JlZ3JvdW5kKTtcblx0aWYgKGVycm9yQ29sb3IpIHtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLmV4dGVuc2lvbi1lZGl0b3IgLmhlYWRlciAuYWN0aW9ucy1zdGF0dXMtY29udGFpbmVyID4gLnN0YXR1cyAke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGVycm9ySWNvbil9IHsgY29sb3I6ICR7ZXJyb3JDb2xvcn07IH1gKTtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLmV4dGVuc2lvbi1lZGl0b3IgLmJvZHkgLnN1YmNvbnRlbnQgLnJ1bnRpbWUtc3RhdHVzICR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoZXJyb3JJY29uKX0geyBjb2xvcjogJHtlcnJvckNvbG9yfTsgfWApO1xuXHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAubW9uYWNvLWhvdmVyLmV4dGVuc2lvbi1ob3ZlciAubWFya2Rvd24taG92ZXIgLmhvdmVyLWNvbnRlbnRzICR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoZXJyb3JJY29uKX0geyBjb2xvcjogJHtlcnJvckNvbG9yfTsgfWApO1xuXHR9XG5cblx0Y29uc3Qgd2FybmluZ0NvbG9yID0gdGhlbWUuZ2V0Q29sb3IoZWRpdG9yV2FybmluZ0ZvcmVncm91bmQpO1xuXHRpZiAod2FybmluZ0NvbG9yKSB7XG5cdFx0Y29sbGVjdG9yLmFkZFJ1bGUoYC5leHRlbnNpb24tZWRpdG9yIC5oZWFkZXIgLmFjdGlvbnMtc3RhdHVzLWNvbnRhaW5lciA+IC5zdGF0dXMgJHtUaGVtZUljb24uYXNDU1NTZWxlY3Rvcih3YXJuaW5nSWNvbil9IHsgY29sb3I6ICR7d2FybmluZ0NvbG9yfTsgfWApO1xuXHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAuZXh0ZW5zaW9uLWVkaXRvciAuYm9keSAuc3ViY29udGVudCAucnVudGltZS1zdGF0dXMgJHtUaGVtZUljb24uYXNDU1NTZWxlY3Rvcih3YXJuaW5nSWNvbil9IHsgY29sb3I6ICR7d2FybmluZ0NvbG9yfTsgfWApO1xuXHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAubW9uYWNvLWhvdmVyLmV4dGVuc2lvbi1ob3ZlciAubWFya2Rvd24taG92ZXIgLmhvdmVyLWNvbnRlbnRzICR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3Iod2FybmluZ0ljb24pfSB7IGNvbG9yOiAke3dhcm5pbmdDb2xvcn07IH1gKTtcblx0fVxuXG5cdGNvbnN0IGluZm9Db2xvciA9IHRoZW1lLmdldENvbG9yKGVkaXRvckluZm9Gb3JlZ3JvdW5kKTtcblx0aWYgKGluZm9Db2xvcikge1xuXHRcdGNvbGxlY3Rvci5hZGRSdWxlKGAuZXh0ZW5zaW9uLWVkaXRvciAuaGVhZGVyIC5hY3Rpb25zLXN0YXR1cy1jb250YWluZXIgPiAuc3RhdHVzICR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoaW5mb0ljb24pfSB7IGNvbG9yOiAke2luZm9Db2xvcn07IH1gKTtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLmV4dGVuc2lvbi1lZGl0b3IgLmJvZHkgLnN1YmNvbnRlbnQgLnJ1bnRpbWUtc3RhdHVzICR7VGhlbWVJY29uLmFzQ1NTU2VsZWN0b3IoaW5mb0ljb24pfSB7IGNvbG9yOiAke2luZm9Db2xvcn07IH1gKTtcblx0XHRjb2xsZWN0b3IuYWRkUnVsZShgLm1vbmFjby1ob3Zlci5leHRlbnNpb24taG92ZXIgLm1hcmtkb3duLWhvdmVyIC5ob3Zlci1jb250ZW50cyAke1RoZW1lSWNvbi5hc0NTU1NlbGVjdG9yKGluZm9JY29uKX0geyBjb2xvcjogJHtpbmZvQ29sb3J9OyB9YCk7XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsU0FBUyxVQUFVLGlCQUFpQjtBQUNwQyxTQUFrQixRQUFRLFdBQVcscUJBQXlDO0FBQzlFLFNBQVMsU0FBUyxVQUFVLGlCQUFpQjtBQUM3QyxZQUFZLFNBQVM7QUFD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
