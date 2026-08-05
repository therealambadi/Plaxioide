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
import "./media/workspaceTrustEditor.css";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
import { localize, localize2 } from "../../../../nls.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { ConfigurationScope, Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { Severity } from "../../../../platform/notification/common/notification.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IWorkspaceTrustEnablementService, IWorkspaceTrustManagementService, IWorkspaceTrustRequestService, WorkspaceTrustUriResponse } from "../../../../platform/workspace/common/workspaceTrust.js";
import { Extensions as WorkbenchExtensions, WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { IStatusbarService, StatusbarAlignment } from "../../../services/statusbar/browser/statusbar.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { shieldIcon, WorkspaceTrustEditor } from "./workspaceTrustEditor.js";
import { WorkspaceTrustEditorInput } from "../../../services/workspaces/browser/workspaceTrustEditorInput.js";
import { WORKSPACE_TRUST_BANNER, WORKSPACE_TRUST_EMPTY_WINDOW, WORKSPACE_TRUST_ENABLED, WORKSPACE_TRUST_STARTUP_PROMPT, WORKSPACE_TRUST_UNTRUSTED_FILES } from "../../../services/workspaces/common/workspaceTrust.js";
import { EditorExtensions } from "../../../common/editor.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { isEmptyWorkspaceIdentifier, isSingleFolderWorkspaceIdentifier, IWorkspaceContextService, toWorkspaceIdentifier, WorkbenchState } from "../../../../platform/workspace/common/workspace.js";
import { dirname, resolve } from "../../../../base/common/path.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { IBannerService } from "../../../services/banner/browser/bannerService.js";
import { isVirtualWorkspace } from "../../../../platform/workspace/common/virtualWorkspace.js";
import { LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID } from "../../extensions/common/extensions.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { WORKSPACE_TRUST_SETTING_TAG } from "../../preferences/common/preferences.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { ILabelService, Verbosity } from "../../../../platform/label/common/label.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { MANAGE_TRUST_COMMAND_ID, WorkspaceTrustContext } from "../common/workspace.js";
import { isWeb } from "../../../../base/common/platform.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { securityConfigurationNodeBase } from "../../../common/configuration.js";
import { basename, dirname as uriDirname } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { IFileService } from "../../../../platform/files/common/files.js";
const BANNER_RESTRICTED_MODE = "workbench.banner.restrictedMode";
const STARTUP_PROMPT_SHOWN_KEY = "workspace.trust.startupPrompt.shown";
const BANNER_RESTRICTED_MODE_DISMISSED_KEY = "workbench.banner.restrictedMode.dismissed";
let WorkspaceTrustContextKeys = class extends Disposable {
  constructor(contextKeyService, workspaceTrustEnablementService, workspaceTrustManagementService) {
    super();
    this._ctxWorkspaceTrustEnabled = WorkspaceTrustContext.IsEnabled.bindTo(contextKeyService);
    this._ctxWorkspaceTrustEnabled.set(workspaceTrustEnablementService.isWorkspaceTrustEnabled());
    this._ctxWorkspaceTrustState = WorkspaceTrustContext.IsTrusted.bindTo(contextKeyService);
    this._ctxWorkspaceTrustState.set(workspaceTrustManagementService.isWorkspaceTrusted());
    this._register(workspaceTrustManagementService.onDidChangeTrust((trusted) => this._ctxWorkspaceTrustState.set(trusted)));
  }
};
WorkspaceTrustContextKeys = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IWorkspaceTrustEnablementService),
  __decorateParam(2, IWorkspaceTrustManagementService)
], WorkspaceTrustContextKeys);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(WorkspaceTrustContextKeys, LifecyclePhase.Restored);
let WorkspaceTrustRequestHandler = class extends Disposable {
  constructor(dialogService, commandService, workspaceContextService, workspaceTrustManagementService, workspaceTrustRequestService) {
    super();
    this.dialogService = dialogService;
    this.commandService = commandService;
    this.workspaceContextService = workspaceContextService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.workspaceTrustRequestService = workspaceTrustRequestService;
    this.registerListeners();
  }
  get useWorkspaceLanguage() {
    return !isSingleFolderWorkspaceIdentifier(toWorkspaceIdentifier(this.workspaceContextService.getWorkspace()));
  }
  registerListeners() {
    this._register(this.workspaceTrustRequestService.onDidInitiateOpenFilesTrustRequest(async () => {
      await this.workspaceTrustManagementService.workspaceResolved;
      const markdownDetails = [
        this.workspaceContextService.getWorkbenchState() !== WorkbenchState.EMPTY ? localize("openLooseFileWorkspaceDetails", "You are trying to open untrusted files in a workspace which is trusted.") : localize("openLooseFileWindowDetails", "You are trying to open untrusted files in a window which is trusted."),
        localize("openLooseFileLearnMore", "If you don't want to open untrusted files, we recommend to open them in Restricted Mode in a new window as the files may be malicious. See [our docs](https://aka.ms/vscode-workspace-trust) to learn more.")
      ];
      await this.dialogService.prompt({
        type: Severity.Info,
        message: this.workspaceContextService.getWorkbenchState() !== WorkbenchState.EMPTY ? localize("openLooseFileWorkspaceMesssage", "Do you want to allow untrusted files in this workspace?") : localize("openLooseFileWindowMesssage", "Do you want to allow untrusted files in this window?"),
        buttons: [
          {
            label: localize({ key: "open", comment: ["&& denotes a mnemonic"] }, "&&Open"),
            run: ({ checkboxChecked }) => this.workspaceTrustRequestService.completeOpenFilesTrustRequest(WorkspaceTrustUriResponse.Open, !!checkboxChecked)
          },
          {
            label: localize({ key: "newWindow", comment: ["&& denotes a mnemonic"] }, "Open in &&Restricted Mode"),
            run: ({ checkboxChecked }) => this.workspaceTrustRequestService.completeOpenFilesTrustRequest(WorkspaceTrustUriResponse.OpenInNewWindow, !!checkboxChecked)
          }
        ],
        cancelButton: {
          run: () => this.workspaceTrustRequestService.completeOpenFilesTrustRequest(WorkspaceTrustUriResponse.Cancel)
        },
        checkbox: {
          label: localize("openLooseFileWorkspaceCheckbox", "Remember my decision for all workspaces"),
          checked: false
        },
        custom: {
          icon: Codicon.shield,
          markdownDetails: markdownDetails.map((md) => {
            return { markdown: new MarkdownString(md) };
          })
        }
      });
    }));
    this._register(this.workspaceTrustRequestService.onDidInitiateWorkspaceTrustRequest(async (requestOptions) => {
      await this.workspaceTrustManagementService.workspaceResolved;
      const message = this.useWorkspaceLanguage ? localize("workspaceTrust", "Do you trust the authors of the files in this workspace?") : localize("folderTrust", "Do you trust the authors of the files in this folder?");
      const defaultDetails = localize("immediateTrustRequestMessage", "A feature you are trying to use may be a security risk if you do not trust the source of the files or folders you currently have open.");
      const details = requestOptions?.message ?? defaultDetails;
      const buttons = requestOptions?.buttons ?? [
        { label: this.useWorkspaceLanguage ? localize({ key: "grantWorkspaceTrustButton", comment: ["&& denotes a mnemonic"] }, "&&Trust Workspace & Continue") : localize({ key: "grantFolderTrustButton", comment: ["&& denotes a mnemonic"] }, "&&Trust Folder & Continue"), type: "ContinueWithTrust" },
        { label: localize({ key: "manageWorkspaceTrustButton", comment: ["&& denotes a mnemonic"] }, "&&Manage"), type: "Manage" }
      ];
      if (!buttons.some((b) => b.type === "Cancel")) {
        buttons.push({ label: localize("cancelWorkspaceTrustButton", "Cancel"), type: "Cancel" });
      }
      const { result } = await this.dialogService.prompt({
        type: Severity.Info,
        message,
        custom: {
          icon: Codicon.shield,
          markdownDetails: [
            { markdown: new MarkdownString(details) },
            { markdown: new MarkdownString(localize("immediateTrustRequestLearnMore", "If you don't trust the authors of these files, we do not recommend continuing as the files may be malicious. See [our docs](https://aka.ms/vscode-workspace-trust) to learn more.")) }
          ]
        },
        buttons: buttons.filter((b) => b.type !== "Cancel").map((button) => {
          return {
            label: button.label,
            run: () => button.type
          };
        }),
        cancelButton: (() => {
          const cancelButton = buttons.find((b) => b.type === "Cancel");
          if (!cancelButton) {
            return void 0;
          }
          return {
            label: cancelButton.label,
            run: () => cancelButton.type
          };
        })()
      });
      switch (result) {
        case "ContinueWithTrust":
          await this.workspaceTrustRequestService.completeWorkspaceTrustRequest(true);
          break;
        case "ContinueWithoutTrust":
          await this.workspaceTrustRequestService.completeWorkspaceTrustRequest(void 0);
          break;
        case "Manage":
          this.workspaceTrustRequestService.cancelWorkspaceTrustRequest();
          await this.commandService.executeCommand(MANAGE_TRUST_COMMAND_ID);
          break;
        case "Cancel":
          this.workspaceTrustRequestService.cancelWorkspaceTrustRequest();
          break;
      }
    }));
  }
};
WorkspaceTrustRequestHandler.ID = "workbench.contrib.workspaceTrustRequestHandler";
WorkspaceTrustRequestHandler = __decorateClass([
  __decorateParam(0, IDialogService),
  __decorateParam(1, ICommandService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IWorkspaceTrustManagementService),
  __decorateParam(4, IWorkspaceTrustRequestService)
], WorkspaceTrustRequestHandler);
let WorkspaceTrustUXHandler = class extends Disposable {
  constructor(dialogService, workspaceContextService, workspaceTrustEnablementService, workspaceTrustManagementService, configurationService, statusbarService, storageService, workspaceTrustRequestService, bannerService, labelService, hostService, productService, remoteAgentService, environmentService, fileService) {
    super();
    this.dialogService = dialogService;
    this.workspaceContextService = workspaceContextService;
    this.workspaceTrustEnablementService = workspaceTrustEnablementService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.configurationService = configurationService;
    this.statusbarService = statusbarService;
    this.storageService = storageService;
    this.workspaceTrustRequestService = workspaceTrustRequestService;
    this.bannerService = bannerService;
    this.labelService = labelService;
    this.hostService = hostService;
    this.productService = productService;
    this.remoteAgentService = remoteAgentService;
    this.environmentService = environmentService;
    this.fileService = fileService;
    this.entryId = `status.workspaceTrust`;
    this.statusbarEntryAccessor = this._register(new MutableDisposable());
    (async () => {
      await this.workspaceTrustManagementService.workspaceTrustInitialized;
      if (this.workspaceTrustEnablementService.isWorkspaceTrustEnabled()) {
        this.registerListeners();
        this.updateStatusbarEntry(this.workspaceTrustManagementService.isWorkspaceTrusted());
        if (this.hostService.hasFocus) {
          this.showModalOnStart();
        } else {
          const focusDisposable = this.hostService.onDidChangeFocus((focused) => {
            if (focused) {
              focusDisposable.dispose();
              this.showModalOnStart();
            }
          });
        }
      }
    })();
  }
  registerListeners() {
    this._register(this.workspaceContextService.onWillChangeWorkspaceFolders((e) => {
      if (e.fromCache) {
        return;
      }
      if (!this.workspaceTrustEnablementService.isWorkspaceTrustEnabled()) {
        return;
      }
      const addWorkspaceFolder = async (e2) => {
        const trusted = this.workspaceTrustManagementService.isWorkspaceTrusted();
        if (trusted && (e2.changes.added.length || e2.changes.changed.length)) {
          const addedFoldersTrustInfo = await Promise.all(e2.changes.added.map((folder) => this.workspaceTrustManagementService.getUriTrustInfo(folder.uri)));
          if (!addedFoldersTrustInfo.map((info) => info.trusted).every((trusted2) => trusted2)) {
            const { confirmed } = await this.dialogService.confirm({
              type: Severity.Info,
              message: localize("addWorkspaceFolderMessage", "Do you trust the authors of the files in this folder?"),
              detail: localize("addWorkspaceFolderDetail", "You are adding files that are not currently trusted to a trusted workspace. Do you trust the authors of these new files?"),
              cancelButton: localize("no", "No"),
              custom: { icon: Codicon.shield }
            });
            await this.workspaceTrustManagementService.setUrisTrust(addedFoldersTrustInfo.map((i) => i.uri), confirmed);
          }
        }
      };
      return e.join(addWorkspaceFolder(e));
    }));
    this._register(this.workspaceTrustManagementService.onDidChangeTrust((trusted) => {
      this.updateWorkbenchIndicators(trusted);
    }));
    this._register(this.workspaceTrustRequestService.onDidInitiateWorkspaceTrustRequestOnStartup(async () => {
      let titleString;
      let learnMoreString;
      let trustOption;
      let dontTrustOption;
      const isAiGeneratedWorkspace = await this.isAiGeneratedWorkspace();
      if (isAiGeneratedWorkspace && this.productService.aiGeneratedWorkspaceTrust) {
        titleString = this.productService.aiGeneratedWorkspaceTrust.title;
        learnMoreString = this.productService.aiGeneratedWorkspaceTrust.startupTrustRequestLearnMore;
        trustOption = this.productService.aiGeneratedWorkspaceTrust.trustOption;
        dontTrustOption = this.productService.aiGeneratedWorkspaceTrust.dontTrustOption;
      } else {
        console.warn("AI generated workspace trust dialog contents not available.");
      }
      const title = titleString ?? (this.useWorkspaceLanguage ? localize("workspaceTrust", "Do you trust the authors of the files in this workspace?") : localize("folderTrust", "Do you trust the authors of the files in this folder?"));
      let checkboxText;
      const workspaceIdentifier = toWorkspaceIdentifier(this.workspaceContextService.getWorkspace());
      const isSingleFolderWorkspace = isSingleFolderWorkspaceIdentifier(workspaceIdentifier);
      const isEmptyWindow = isEmptyWorkspaceIdentifier(workspaceIdentifier);
      if (!isAiGeneratedWorkspace && this.workspaceTrustManagementService.canSetParentFolderTrust()) {
        const name = basename(uriDirname(workspaceIdentifier.uri));
        checkboxText = localize("checkboxString", "Trust the authors of all files in the parent folder '{0}'", name);
      }
      this.doShowModal(
        title,
        { label: trustOption ?? localize({ key: "trustOption", comment: ["&& denotes a mnemonic"] }, "&&Yes, I trust the authors"), sublabel: isSingleFolderWorkspace ? localize("trustFolderOptionDescription", "Trust folder and enable all features") : localize("trustWorkspaceOptionDescription", "Trust workspace and enable all features") },
        { label: dontTrustOption ?? localize({ key: "dontTrustOption", comment: ["&& denotes a mnemonic"] }, "&&No, I don't trust the authors"), sublabel: isSingleFolderWorkspace ? localize("dontTrustFolderOptionDescription", "Browse folder in restricted mode") : localize("dontTrustWorkspaceOptionDescription", "Browse workspace in restricted mode") },
        [
          !isSingleFolderWorkspace ? localize("workspaceStartupTrustDetails", "{0} provides features that may automatically execute files in this workspace.", this.productService.nameShort) : localize("folderStartupTrustDetails", "{0} provides features that may automatically execute files in this folder.", this.productService.nameShort),
          learnMoreString ?? localize("startupTrustRequestLearnMore", "If you don't trust the authors of these files, we recommend to continue in restricted mode as the files may be malicious. See [our docs](https://aka.ms/vscode-workspace-trust) to learn more."),
          !isEmptyWindow ? `\`${this.labelService.getWorkspaceLabel(workspaceIdentifier, { verbose: Verbosity.LONG })}\`` : ""
        ],
        checkboxText
      );
    }));
  }
  updateWorkbenchIndicators(trusted) {
    const bannerItem = this.getBannerItem(!trusted);
    this.updateStatusbarEntry(trusted);
    if (bannerItem) {
      if (!trusted) {
        this.bannerService.show(bannerItem);
      } else {
        this.bannerService.hide(BANNER_RESTRICTED_MODE);
      }
    }
  }
  //#region Dialog
  async doShowModal(question, trustedOption, untrustedOption, markdownStrings, trustParentString) {
    await this.dialogService.prompt({
      type: Severity.Info,
      message: question,
      checkbox: trustParentString ? {
        label: trustParentString
      } : void 0,
      buttons: [
        {
          label: trustedOption.label,
          run: async ({ checkboxChecked }) => {
            if (checkboxChecked) {
              await this.workspaceTrustManagementService.setParentFolderTrust(true);
            } else {
              await this.workspaceTrustRequestService.completeWorkspaceTrustRequest(true);
            }
          }
        },
        {
          label: untrustedOption.label,
          run: () => {
            this.updateWorkbenchIndicators(false);
            this.workspaceTrustRequestService.cancelWorkspaceTrustRequest();
          }
        }
      ],
      custom: {
        buttonDetails: [
          trustedOption.sublabel,
          untrustedOption.sublabel
        ],
        disableCloseAction: true,
        icon: Codicon.shield,
        markdownDetails: markdownStrings.map((md) => {
          return { markdown: new MarkdownString(md) };
        })
      }
    });
    this.storageService.store(STARTUP_PROMPT_SHOWN_KEY, true, StorageScope.WORKSPACE, StorageTarget.MACHINE);
  }
  async showModalOnStart() {
    if (this.workspaceTrustManagementService.isWorkspaceTrusted()) {
      this.updateWorkbenchIndicators(true);
      return;
    }
    if (!this.workspaceTrustManagementService.canSetWorkspaceTrust()) {
      return;
    }
    if (isVirtualWorkspace(this.workspaceContextService.getWorkspace())) {
      this.updateWorkbenchIndicators(false);
      return;
    }
    if (this.workspaceContextService.getWorkbenchState() === WorkbenchState.EMPTY) {
      this.updateWorkbenchIndicators(false);
      return;
    }
    if (this.startupPromptSetting === "never") {
      this.updateWorkbenchIndicators(false);
      return;
    }
    if (this.startupPromptSetting === "once" && this.storageService.getBoolean(STARTUP_PROMPT_SHOWN_KEY, StorageScope.WORKSPACE, false)) {
      this.updateWorkbenchIndicators(false);
      return;
    }
    this.workspaceTrustRequestService.requestWorkspaceTrustOnStartup();
  }
  get startupPromptSetting() {
    return this.configurationService.getValue(WORKSPACE_TRUST_STARTUP_PROMPT);
  }
  get useWorkspaceLanguage() {
    return !isSingleFolderWorkspaceIdentifier(toWorkspaceIdentifier(this.workspaceContextService.getWorkspace()));
  }
  async isAiGeneratedWorkspace() {
    const aiGeneratedWorkspaces = URI.joinPath(this.environmentService.workspaceStorageHome, "aiGeneratedWorkspaces.json");
    return await this.fileService.exists(aiGeneratedWorkspaces).then(async (result) => {
      if (result) {
        try {
          const content = await this.fileService.readFile(aiGeneratedWorkspaces);
          const workspaces = JSON.parse(content.value.toString());
          if (workspaces.indexOf(this.workspaceContextService.getWorkspace().folders[0].uri.toString()) > -1) {
            return true;
          }
        } catch (e) {
        }
      }
      return false;
    });
  }
  //#endregion
  //#region Banner
  getBannerItem(restrictedMode) {
    const dismissedRestricted = this.storageService.getBoolean(BANNER_RESTRICTED_MODE_DISMISSED_KEY, StorageScope.WORKSPACE, false);
    if (this.bannerSetting === "never") {
      return void 0;
    }
    if (this.bannerSetting === "untilDismissed" && dismissedRestricted) {
      return void 0;
    }
    const actions = [
      {
        label: localize("restrictedModeBannerManage", "Manage"),
        href: "command:" + MANAGE_TRUST_COMMAND_ID
      },
      {
        label: localize("restrictedModeBannerLearnMore", "Learn More"),
        href: "https://aka.ms/vscode-workspace-trust"
      }
    ];
    return {
      id: BANNER_RESTRICTED_MODE,
      icon: shieldIcon,
      ariaLabel: this.getBannerItemAriaLabels(),
      message: this.getBannerItemMessages(),
      actions,
      onClose: () => {
        if (restrictedMode) {
          this.storageService.store(BANNER_RESTRICTED_MODE_DISMISSED_KEY, true, StorageScope.WORKSPACE, StorageTarget.MACHINE);
        }
      }
    };
  }
  getBannerItemAriaLabels() {
    switch (this.workspaceContextService.getWorkbenchState()) {
      case WorkbenchState.EMPTY:
        return localize("restrictedModeBannerAriaLabelWindow", "Restricted Mode is intended for safe code browsing. Trust this window to enable all features. Use navigation keys to access banner actions.");
      case WorkbenchState.FOLDER:
        return localize("restrictedModeBannerAriaLabelFolder", "Restricted Mode is intended for safe code browsing. Trust this folder to enable all features. Use navigation keys to access banner actions.");
      case WorkbenchState.WORKSPACE:
        return localize("restrictedModeBannerAriaLabelWorkspace", "Restricted Mode is intended for safe code browsing. Trust this workspace to enable all features. Use navigation keys to access banner actions.");
    }
  }
  getBannerItemMessages() {
    switch (this.workspaceContextService.getWorkbenchState()) {
      case WorkbenchState.EMPTY:
        return localize("restrictedModeBannerMessageWindow", "Restricted Mode is intended for safe code browsing. Trust this window to enable all features.");
      case WorkbenchState.FOLDER:
        return localize("restrictedModeBannerMessageFolder", "Restricted Mode is intended for safe code browsing. Trust this folder to enable all features.");
      case WorkbenchState.WORKSPACE:
        return localize("restrictedModeBannerMessageWorkspace", "Restricted Mode is intended for safe code browsing. Trust this workspace to enable all features.");
    }
  }
  get bannerSetting() {
    const result = this.configurationService.getValue(WORKSPACE_TRUST_BANNER);
    if (result !== "always" && isWeb && !this.remoteAgentService.getConnection()?.remoteAuthority) {
      return "never";
    }
    return result;
  }
  //#endregion
  //#region Statusbar
  getRestrictedModeStatusbarEntry() {
    let ariaLabel = "";
    let toolTip;
    switch (this.workspaceContextService.getWorkbenchState()) {
      case WorkbenchState.EMPTY: {
        ariaLabel = localize("status.ariaUntrustedWindow", "Restricted Mode: Some features are disabled because this window is not trusted.");
        toolTip = {
          value: localize(
            { key: "status.tooltipUntrustedWindow2", comment: ["[abc]({n}) are links.  Only translate `features are disabled` and `window is not trusted`. Do not change brackets and parentheses or {n}"] },
            "Running in Restricted Mode\n\nSome [features are disabled]({0}) because this [window is not trusted]({1}).",
            `command:${LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID}`,
            `command:${MANAGE_TRUST_COMMAND_ID}`
          ),
          isTrusted: true,
          supportThemeIcons: true
        };
        break;
      }
      case WorkbenchState.FOLDER: {
        ariaLabel = localize("status.ariaUntrustedFolder", "Restricted Mode: Some features are disabled because this folder is not trusted.");
        toolTip = {
          value: localize(
            { key: "status.tooltipUntrustedFolder2", comment: ["[abc]({n}) are links.  Only translate `features are disabled` and `folder is not trusted`. Do not change brackets and parentheses or {n}"] },
            "Running in Restricted Mode\n\nSome [features are disabled]({0}) because this [folder is not trusted]({1}).",
            `command:${LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID}`,
            `command:${MANAGE_TRUST_COMMAND_ID}`
          ),
          isTrusted: true,
          supportThemeIcons: true
        };
        break;
      }
      case WorkbenchState.WORKSPACE: {
        ariaLabel = localize("status.ariaUntrustedWorkspace", "Restricted Mode: Some features are disabled because this workspace is not trusted.");
        toolTip = {
          value: localize(
            { key: "status.tooltipUntrustedWorkspace2", comment: ["[abc]({n}) are links. Only translate `features are disabled` and `workspace is not trusted`. Do not change brackets and parentheses or {n}"] },
            "Running in Restricted Mode\n\nSome [features are disabled]({0}) because this [workspace is not trusted]({1}).",
            `command:${LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID}`,
            `command:${MANAGE_TRUST_COMMAND_ID}`
          ),
          isTrusted: true,
          supportThemeIcons: true
        };
        break;
      }
    }
    return {
      name: localize("status.WorkspaceTrust", "Workspace Trust"),
      text: `$(shield) ${localize("untrusted", "Restricted Mode")}`,
      ariaLabel,
      tooltip: toolTip,
      command: MANAGE_TRUST_COMMAND_ID,
      kind: "prominent"
    };
  }
  updateStatusbarEntry(trusted) {
    if (trusted && this.statusbarEntryAccessor.value) {
      this.statusbarEntryAccessor.clear();
      return;
    }
    if (!trusted && !this.statusbarEntryAccessor.value) {
      const entry = this.getRestrictedModeStatusbarEntry();
      this.statusbarEntryAccessor.value = this.statusbarService.addEntry(entry, this.entryId, StatusbarAlignment.LEFT, { location: { id: "status.host", priority: Number.POSITIVE_INFINITY }, alignment: StatusbarAlignment.RIGHT });
    }
  }
  //#endregion
};
WorkspaceTrustUXHandler = __decorateClass([
  __decorateParam(0, IDialogService),
  __decorateParam(1, IWorkspaceContextService),
  __decorateParam(2, IWorkspaceTrustEnablementService),
  __decorateParam(3, IWorkspaceTrustManagementService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IStatusbarService),
  __decorateParam(6, IStorageService),
  __decorateParam(7, IWorkspaceTrustRequestService),
  __decorateParam(8, IBannerService),
  __decorateParam(9, ILabelService),
  __decorateParam(10, IHostService),
  __decorateParam(11, IProductService),
  __decorateParam(12, IRemoteAgentService),
  __decorateParam(13, IEnvironmentService),
  __decorateParam(14, IFileService)
], WorkspaceTrustUXHandler);
registerWorkbenchContribution2(WorkspaceTrustRequestHandler.ID, WorkspaceTrustRequestHandler, WorkbenchPhase.BlockRestore);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(WorkspaceTrustUXHandler, LifecyclePhase.Restored);
class WorkspaceTrustEditorInputSerializer {
  canSerialize(editorInput) {
    return true;
  }
  serialize(input) {
    return "";
  }
  deserialize(instantiationService) {
    return instantiationService.createInstance(WorkspaceTrustEditorInput);
  }
}
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(WorkspaceTrustEditorInput.ID, WorkspaceTrustEditorInputSerializer);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    WorkspaceTrustEditor,
    WorkspaceTrustEditor.ID,
    localize("workspaceTrustEditor", "Workspace Trust Editor")
  ),
  [
    new SyncDescriptor(WorkspaceTrustEditorInput)
  ]
);
const CONFIGURE_TRUST_COMMAND_ID = "workbench.trust.configure";
const WORKSPACES_CATEGORY = localize2("workspacesCategory", "Workspaces");
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: CONFIGURE_TRUST_COMMAND_ID,
      title: localize2("configureWorkspaceTrustSettings", "Configure Workspace Trust Settings"),
      precondition: ContextKeyExpr.and(WorkspaceTrustContext.IsEnabled, ContextKeyExpr.equals(`config.${WORKSPACE_TRUST_ENABLED}`, true)),
      category: WORKSPACES_CATEGORY,
      f1: true
    });
  }
  run(accessor) {
    accessor.get(IPreferencesService).openUserSettings({ jsonEditor: false, query: `@tag:${WORKSPACE_TRUST_SETTING_TAG}` });
  }
});
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: MANAGE_TRUST_COMMAND_ID,
      title: localize2("manageWorkspaceTrust", "Manage Workspace Trust"),
      precondition: ContextKeyExpr.and(WorkspaceTrustContext.IsEnabled, ContextKeyExpr.equals(`config.${WORKSPACE_TRUST_ENABLED}`, true)),
      category: WORKSPACES_CATEGORY,
      f1: true
    });
  }
  run(accessor) {
    const editorService = accessor.get(IEditorService);
    const instantiationService = accessor.get(IInstantiationService);
    const input = instantiationService.createInstance(WorkspaceTrustEditorInput);
    editorService.openEditor(input, { pinned: true });
    return;
  }
});
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  ...securityConfigurationNodeBase,
  properties: {
    [WORKSPACE_TRUST_ENABLED]: {
      type: "boolean",
      default: true,
      description: localize("workspace.trust.description", "Controls whether or not Workspace Trust is enabled within VS Code."),
      tags: [WORKSPACE_TRUST_SETTING_TAG],
      scope: ConfigurationScope.APPLICATION
    },
    [WORKSPACE_TRUST_STARTUP_PROMPT]: {
      type: "string",
      default: "once",
      description: localize("workspace.trust.startupPrompt.description", "Controls when the startup prompt to trust a workspace is shown."),
      tags: [WORKSPACE_TRUST_SETTING_TAG],
      scope: ConfigurationScope.APPLICATION,
      enum: ["always", "once", "never"],
      enumDescriptions: [
        localize("workspace.trust.startupPrompt.always", "Ask for trust every time an untrusted workspace is opened."),
        localize("workspace.trust.startupPrompt.once", "Ask for trust the first time an untrusted workspace is opened."),
        localize("workspace.trust.startupPrompt.never", "Do not ask for trust when an untrusted workspace is opened.")
      ]
    },
    [WORKSPACE_TRUST_BANNER]: {
      type: "string",
      default: "untilDismissed",
      description: localize("workspace.trust.banner.description", "Controls when the restricted mode banner is shown."),
      tags: [WORKSPACE_TRUST_SETTING_TAG],
      scope: ConfigurationScope.APPLICATION,
      enum: ["always", "untilDismissed", "never"],
      enumDescriptions: [
        localize("workspace.trust.banner.always", "Show the banner every time an untrusted workspace is open."),
        localize("workspace.trust.banner.untilDismissed", "Show the banner when an untrusted workspace is opened until dismissed."),
        localize("workspace.trust.banner.never", "Do not show the banner when an untrusted workspace is open.")
      ]
    },
    [WORKSPACE_TRUST_UNTRUSTED_FILES]: {
      type: "string",
      default: "prompt",
      markdownDescription: localize("workspace.trust.untrustedFiles.description", "Controls how to handle opening untrusted files in a trusted workspace. This setting also applies to opening files in an empty window which is trusted via `#{0}#`.", WORKSPACE_TRUST_EMPTY_WINDOW),
      tags: [WORKSPACE_TRUST_SETTING_TAG],
      scope: ConfigurationScope.APPLICATION,
      enum: ["prompt", "open", "newWindow"],
      enumDescriptions: [
        localize("workspace.trust.untrustedFiles.prompt", "Ask how to handle untrusted files for each workspace. Once untrusted files are introduced to a trusted workspace, you will not be prompted again."),
        localize("workspace.trust.untrustedFiles.open", "Always allow untrusted files to be introduced to a trusted workspace without prompting."),
        localize("workspace.trust.untrustedFiles.newWindow", "Always open untrusted files in a separate window in restricted mode without prompting.")
      ]
    },
    [WORKSPACE_TRUST_EMPTY_WINDOW]: {
      type: "boolean",
      default: true,
      markdownDescription: localize("workspace.trust.emptyWindow.description", "Controls whether or not the empty window is trusted by default within VS Code. When used with `#{0}#`, you can enable the full functionality of VS Code without prompting in an empty window.", WORKSPACE_TRUST_UNTRUSTED_FILES),
      tags: [WORKSPACE_TRUST_SETTING_TAG],
      scope: ConfigurationScope.APPLICATION
    }
  }
});
let WorkspaceTrustTelemetryContribution = class extends Disposable {
  constructor(environmentService, telemetryService, workspaceContextService, workspaceTrustEnablementService, workspaceTrustManagementService) {
    super();
    this.environmentService = environmentService;
    this.telemetryService = telemetryService;
    this.workspaceContextService = workspaceContextService;
    this.workspaceTrustEnablementService = workspaceTrustEnablementService;
    this.workspaceTrustManagementService = workspaceTrustManagementService;
    this.workspaceTrustManagementService.workspaceTrustInitialized.then(() => {
      this.logInitialWorkspaceTrustInfo();
      this.logWorkspaceTrust(this.workspaceTrustManagementService.isWorkspaceTrusted());
      this._register(this.workspaceTrustManagementService.onDidChangeTrust((isTrusted) => this.logWorkspaceTrust(isTrusted)));
    });
  }
  logInitialWorkspaceTrustInfo() {
    if (!this.workspaceTrustEnablementService.isWorkspaceTrustEnabled()) {
      const disabledByCliFlag = this.environmentService.disableWorkspaceTrust;
      this.telemetryService.publicLog2("workspaceTrustDisabled", {
        reason: disabledByCliFlag ? "cli" : "setting"
      });
      return;
    }
    this.telemetryService.publicLog2("workspaceTrustFolderCounts", {
      trustedFoldersCount: this.workspaceTrustManagementService.getTrustedUris().length
    });
  }
  async logWorkspaceTrust(isTrusted) {
    if (!this.workspaceTrustEnablementService.isWorkspaceTrustEnabled()) {
      return;
    }
    this.telemetryService.publicLog2("workspaceTrustStateChanged", {
      workspaceId: this.workspaceContextService.getWorkspace().id,
      isTrusted
    });
    if (isTrusted) {
      const getDepth = (folder) => {
        let resolvedPath = resolve(folder);
        let depth = 0;
        while (dirname(resolvedPath) !== resolvedPath && depth < 100) {
          resolvedPath = dirname(resolvedPath);
          depth++;
        }
        return depth;
      };
      for (const folder of this.workspaceContextService.getWorkspace().folders) {
        const { trusted, uri } = await this.workspaceTrustManagementService.getUriTrustInfo(folder.uri);
        if (!trusted) {
          continue;
        }
        const workspaceFolderDepth = getDepth(folder.uri.fsPath);
        const trustedFolderDepth = getDepth(uri.fsPath);
        const delta = workspaceFolderDepth - trustedFolderDepth;
        this.telemetryService.publicLog2("workspaceFolderDepthBelowTrustedFolder", { workspaceFolderDepth, trustedFolderDepth, delta });
      }
    }
  }
};
WorkspaceTrustTelemetryContribution = __decorateClass([
  __decorateParam(0, IWorkbenchEnvironmentService),
  __decorateParam(1, ITelemetryService),
  __decorateParam(2, IWorkspaceContextService),
  __decorateParam(3, IWorkspaceTrustEnablementService),
  __decorateParam(4, IWorkspaceTrustManagementService)
], WorkspaceTrustTelemetryContribution);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(WorkspaceTrustTelemetryContribution, LifecyclePhase.Restored);
export {
  WorkspaceTrustContextKeys,
  WorkspaceTrustRequestHandler,
  WorkspaceTrustUXHandler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi93b3Jrc3BhY2UvYnJvd3Nlci93b3Jrc3BhY2UuY29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICcuL21lZGlhL3dvcmtzcGFjZVRydXN0RWRpdG9yLmNzcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgcmVnaXN0ZXJBY3Rpb24yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uU2NvcGUsIEV4dGVuc2lvbnMgYXMgQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMsIElDb25maWd1cmF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlVHJ1c3RFbmFibGVtZW50U2VydmljZSwgSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UsIElXb3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlLCBXb3Jrc3BhY2VUcnVzdFVyaVJlc3BvbnNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2VUcnVzdC5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zIGFzIFdvcmtiZW5jaEV4dGVuc2lvbnMsIElXb3JrYmVuY2hDb250cmlidXRpb24sIElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnksIFdvcmtiZW5jaFBoYXNlLCByZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBMaWZlY3ljbGVQaGFzZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElTdGF0dXNiYXJFbnRyeSwgSVN0YXR1c2JhckVudHJ5QWNjZXNzb3IsIElTdGF0dXNiYXJTZXJ2aWNlLCBTdGF0dXNiYXJBbGlnbm1lbnQgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9zdGF0dXNiYXIvYnJvd3Nlci9zdGF0dXNiYXIuanMnO1xuaW1wb3J0IHsgSUVkaXRvclBhbmVSZWdpc3RyeSwgRWRpdG9yUGFuZURlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBzaGllbGRJY29uLCBXb3Jrc3BhY2VUcnVzdEVkaXRvciB9IGZyb20gJy4vd29ya3NwYWNlVHJ1c3RFZGl0b3IuanMnO1xuaW1wb3J0IHsgV29ya3NwYWNlVHJ1c3RFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3dvcmtzcGFjZXMvYnJvd3Nlci93b3Jrc3BhY2VUcnVzdEVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IFdPUktTUEFDRV9UUlVTVF9CQU5ORVIsIFdPUktTUEFDRV9UUlVTVF9FTVBUWV9XSU5ET1csIFdPUktTUEFDRV9UUlVTVF9FTkFCTEVELCBXT1JLU1BBQ0VfVFJVU1RfU1RBUlRVUF9QUk9NUFQsIFdPUktTUEFDRV9UUlVTVF9VTlRSVVNURURfRklMRVMgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy93b3Jrc3BhY2VzL2NvbW1vbi93b3Jrc3BhY2VUcnVzdC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VyaWFsaXplciwgSUVkaXRvckZhY3RvcnlSZWdpc3RyeSwgRWRpdG9yRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgaXNFbXB0eVdvcmtzcGFjZUlkZW50aWZpZXIsIElTaW5nbGVGb2xkZXJXb3Jrc3BhY2VJZGVudGlmaWVyLCBpc1NpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIsIElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgSVdvcmtzcGFjZUZvbGRlcnNXaWxsQ2hhbmdlRXZlbnQsIHRvV29ya3NwYWNlSWRlbnRpZmllciwgV29ya2JlbmNoU3RhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBkaXJuYW1lLCByZXNvbHZlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElNYXJrZG93blN0cmluZywgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgSUJhbm5lckl0ZW0sIElCYW5uZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvYmFubmVyL2Jyb3dzZXIvYmFubmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBpc1ZpcnR1YWxXb3Jrc3BhY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3ZpcnR1YWxXb3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgTElTVF9XT1JLU1BBQ0VfVU5TVVBQT1JURURfRVhURU5TSU9OU19DT01NQU5EX0lEIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBXT1JLU1BBQ0VfVFJVU1RfU0VUVElOR19UQUcgfSBmcm9tICcuLi8uLi9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXMuanMnO1xuaW1wb3J0IHsgSVByZWZlcmVuY2VzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ByZWZlcmVuY2VzL2NvbW1vbi9wcmVmZXJlbmNlcy5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlLCBWZXJib3NpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTUFOQUdFX1RSVVNUX0NPTU1BTkRfSUQsIFdvcmtzcGFjZVRydXN0Q29udGV4dCB9IGZyb20gJy4uL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgaXNXZWIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJUmVtb3RlQWdlbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgc2VjdXJpdHlDb25maWd1cmF0aW9uTm9kZUJhc2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgZGlybmFtZSBhcyB1cmlEaXJuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5cbmNvbnN0IEJBTk5FUl9SRVNUUklDVEVEX01PREUgPSAnd29ya2JlbmNoLmJhbm5lci5yZXN0cmljdGVkTW9kZSc7XG5jb25zdCBTVEFSVFVQX1BST01QVF9TSE9XTl9LRVkgPSAnd29ya3NwYWNlLnRydXN0LnN0YXJ0dXBQcm9tcHQuc2hvd24nO1xuY29uc3QgQkFOTkVSX1JFU1RSSUNURURfTU9ERV9ESVNNSVNTRURfS0VZID0gJ3dvcmtiZW5jaC5iYW5uZXIucmVzdHJpY3RlZE1vZGUuZGlzbWlzc2VkJztcblxuZXhwb3J0IGNsYXNzIFdvcmtzcGFjZVRydXN0Q29udGV4dEtleXMgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY3R4V29ya3NwYWNlVHJ1c3RFbmFibGVkOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfY3R4V29ya3NwYWNlVHJ1c3RTdGF0ZTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlVHJ1c3RFbmFibGVtZW50U2VydmljZSB3b3Jrc3BhY2VUcnVzdEVuYWJsZW1lbnRTZXJ2aWNlOiBJV29ya3NwYWNlVHJ1c3RFbmFibGVtZW50U2VydmljZSxcblx0XHRASVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2Ugd29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZTogSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX2N0eFdvcmtzcGFjZVRydXN0RW5hYmxlZCA9IFdvcmtzcGFjZVRydXN0Q29udGV4dC5Jc0VuYWJsZWQuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9jdHhXb3Jrc3BhY2VUcnVzdEVuYWJsZWQuc2V0KHdvcmtzcGFjZVRydXN0RW5hYmxlbWVudFNlcnZpY2UuaXNXb3Jrc3BhY2VUcnVzdEVuYWJsZWQoKSk7XG5cblx0XHR0aGlzLl9jdHhXb3Jrc3BhY2VUcnVzdFN0YXRlID0gV29ya3NwYWNlVHJ1c3RDb250ZXh0LklzVHJ1c3RlZC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMuX2N0eFdvcmtzcGFjZVRydXN0U3RhdGUuc2V0KHdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UuaXNXb3Jrc3BhY2VUcnVzdGVkKCkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIod29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5vbkRpZENoYW5nZVRydXN0KHRydXN0ZWQgPT4gdGhpcy5fY3R4V29ya3NwYWNlVHJ1c3RTdGF0ZS5zZXQodHJ1c3RlZCkpKTtcblx0fVxufVxuXG5SZWdpc3RyeS5hczxJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5PihXb3JrYmVuY2hFeHRlbnNpb25zLldvcmtiZW5jaCkucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24oV29ya3NwYWNlVHJ1c3RDb250ZXh0S2V5cywgTGlmZWN5Y2xlUGhhc2UuUmVzdG9yZWQpO1xuXG5cbi8qXG4gKiBUcnVzdCBSZXF1ZXN0IHZpYSBTZXJ2aWNlIFVYIGhhbmRsZXJcbiAqL1xuXG5leHBvcnQgY2xhc3MgV29ya3NwYWNlVHJ1c3RSZXF1ZXN0SGFuZGxlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIud29ya3NwYWNlVHJ1c3RSZXF1ZXN0SGFuZGxlcic7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZTogSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZTogSVdvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5yZWdpc3Rlckxpc3RlbmVycygpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgdXNlV29ya3NwYWNlTGFuZ3VhZ2UoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICFpc1NpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIodG9Xb3Jrc3BhY2VJZGVudGlmaWVyKHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkpKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cblx0XHQvLyBPcGVuIGZpbGVzIHRydXN0IHJlcXVlc3Rcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2Uub25EaWRJbml0aWF0ZU9wZW5GaWxlc1RydXN0UmVxdWVzdChhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2Uud29ya3NwYWNlUmVzb2x2ZWQ7XG5cblx0XHRcdC8vIERldGFpbHNcblx0XHRcdGNvbnN0IG1hcmtkb3duRGV0YWlscyA9IFtcblx0XHRcdFx0dGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3JrYmVuY2hTdGF0ZSgpICE9PSBXb3JrYmVuY2hTdGF0ZS5FTVBUWSA/XG5cdFx0XHRcdFx0bG9jYWxpemUoJ29wZW5Mb29zZUZpbGVXb3Jrc3BhY2VEZXRhaWxzJywgXCJZb3UgYXJlIHRyeWluZyB0byBvcGVuIHVudHJ1c3RlZCBmaWxlcyBpbiBhIHdvcmtzcGFjZSB3aGljaCBpcyB0cnVzdGVkLlwiKSA6XG5cdFx0XHRcdFx0bG9jYWxpemUoJ29wZW5Mb29zZUZpbGVXaW5kb3dEZXRhaWxzJywgXCJZb3UgYXJlIHRyeWluZyB0byBvcGVuIHVudHJ1c3RlZCBmaWxlcyBpbiBhIHdpbmRvdyB3aGljaCBpcyB0cnVzdGVkLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ29wZW5Mb29zZUZpbGVMZWFybk1vcmUnLCBcIklmIHlvdSBkb24ndCB3YW50IHRvIG9wZW4gdW50cnVzdGVkIGZpbGVzLCB3ZSByZWNvbW1lbmQgdG8gb3BlbiB0aGVtIGluIFJlc3RyaWN0ZWQgTW9kZSBpbiBhIG5ldyB3aW5kb3cgYXMgdGhlIGZpbGVzIG1heSBiZSBtYWxpY2lvdXMuIFNlZSBbb3VyIGRvY3NdKGh0dHBzOi8vYWthLm1zL3ZzY29kZS13b3Jrc3BhY2UtdHJ1c3QpIHRvIGxlYXJuIG1vcmUuXCIpXG5cdFx0XHRdO1xuXG5cdFx0XHQvLyBEaWFsb2dcblx0XHRcdGF3YWl0IHRoaXMuZGlhbG9nU2VydmljZS5wcm9tcHQ8dm9pZD4oe1xuXHRcdFx0XHR0eXBlOiBTZXZlcml0eS5JbmZvLFxuXHRcdFx0XHRtZXNzYWdlOiB0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkgIT09IFdvcmtiZW5jaFN0YXRlLkVNUFRZID9cblx0XHRcdFx0XHRsb2NhbGl6ZSgnb3Blbkxvb3NlRmlsZVdvcmtzcGFjZU1lc3NzYWdlJywgXCJEbyB5b3Ugd2FudCB0byBhbGxvdyB1bnRydXN0ZWQgZmlsZXMgaW4gdGhpcyB3b3Jrc3BhY2U/XCIpIDpcblx0XHRcdFx0XHRsb2NhbGl6ZSgnb3Blbkxvb3NlRmlsZVdpbmRvd01lc3NzYWdlJywgXCJEbyB5b3Ugd2FudCB0byBhbGxvdyB1bnRydXN0ZWQgZmlsZXMgaW4gdGhpcyB3aW5kb3c/XCIpLFxuXHRcdFx0XHRidXR0b25zOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKHsga2V5OiAnb3BlbicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJk9wZW5cIiksXG5cdFx0XHRcdFx0XHRydW46ICh7IGNoZWNrYm94Q2hlY2tlZCB9KSA9PiB0aGlzLndvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UuY29tcGxldGVPcGVuRmlsZXNUcnVzdFJlcXVlc3QoV29ya3NwYWNlVHJ1c3RVcmlSZXNwb25zZS5PcGVuLCAhIWNoZWNrYm94Q2hlY2tlZClcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSh7IGtleTogJ25ld1dpbmRvdycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCJPcGVuIGluICYmUmVzdHJpY3RlZCBNb2RlXCIpLFxuXHRcdFx0XHRcdFx0cnVuOiAoeyBjaGVja2JveENoZWNrZWQgfSkgPT4gdGhpcy53b3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlLmNvbXBsZXRlT3BlbkZpbGVzVHJ1c3RSZXF1ZXN0KFdvcmtzcGFjZVRydXN0VXJpUmVzcG9uc2UuT3BlbkluTmV3V2luZG93LCAhIWNoZWNrYm94Q2hlY2tlZClcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdGNhbmNlbEJ1dHRvbjoge1xuXHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy53b3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlLmNvbXBsZXRlT3BlbkZpbGVzVHJ1c3RSZXF1ZXN0KFdvcmtzcGFjZVRydXN0VXJpUmVzcG9uc2UuQ2FuY2VsKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRjaGVja2JveDoge1xuXHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnb3Blbkxvb3NlRmlsZVdvcmtzcGFjZUNoZWNrYm94JywgXCJSZW1lbWJlciBteSBkZWNpc2lvbiBmb3IgYWxsIHdvcmtzcGFjZXNcIiksXG5cdFx0XHRcdFx0Y2hlY2tlZDogZmFsc2Vcblx0XHRcdFx0fSxcblx0XHRcdFx0Y3VzdG9tOiB7XG5cdFx0XHRcdFx0aWNvbjogQ29kaWNvbi5zaGllbGQsXG5cdFx0XHRcdFx0bWFya2Rvd25EZXRhaWxzOiBtYXJrZG93bkRldGFpbHMubWFwKG1kID0+IHsgcmV0dXJuIHsgbWFya2Rvd246IG5ldyBNYXJrZG93blN0cmluZyhtZCkgfTsgfSlcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gV29ya3NwYWNlIHRydXN0IHJlcXVlc3Rcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2Uub25EaWRJbml0aWF0ZVdvcmtzcGFjZVRydXN0UmVxdWVzdChhc3luYyByZXF1ZXN0T3B0aW9ucyA9PiB7XG5cdFx0XHRhd2FpdCB0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2Uud29ya3NwYWNlUmVzb2x2ZWQ7XG5cblx0XHRcdC8vIFRpdGxlXG5cdFx0XHRjb25zdCBtZXNzYWdlID0gdGhpcy51c2VXb3Jrc3BhY2VMYW5ndWFnZSA/XG5cdFx0XHRcdGxvY2FsaXplKCd3b3Jrc3BhY2VUcnVzdCcsIFwiRG8geW91IHRydXN0IHRoZSBhdXRob3JzIG9mIHRoZSBmaWxlcyBpbiB0aGlzIHdvcmtzcGFjZT9cIikgOlxuXHRcdFx0XHRsb2NhbGl6ZSgnZm9sZGVyVHJ1c3QnLCBcIkRvIHlvdSB0cnVzdCB0aGUgYXV0aG9ycyBvZiB0aGUgZmlsZXMgaW4gdGhpcyBmb2xkZXI/XCIpO1xuXG5cdFx0XHQvLyBNZXNzYWdlXG5cdFx0XHRjb25zdCBkZWZhdWx0RGV0YWlscyA9IGxvY2FsaXplKCdpbW1lZGlhdGVUcnVzdFJlcXVlc3RNZXNzYWdlJywgXCJBIGZlYXR1cmUgeW91IGFyZSB0cnlpbmcgdG8gdXNlIG1heSBiZSBhIHNlY3VyaXR5IHJpc2sgaWYgeW91IGRvIG5vdCB0cnVzdCB0aGUgc291cmNlIG9mIHRoZSBmaWxlcyBvciBmb2xkZXJzIHlvdSBjdXJyZW50bHkgaGF2ZSBvcGVuLlwiKTtcblx0XHRcdGNvbnN0IGRldGFpbHMgPSByZXF1ZXN0T3B0aW9ucz8ubWVzc2FnZSA/PyBkZWZhdWx0RGV0YWlscztcblxuXHRcdFx0Ly8gQnV0dG9uc1xuXHRcdFx0Y29uc3QgYnV0dG9ucyA9IHJlcXVlc3RPcHRpb25zPy5idXR0b25zID8/IFtcblx0XHRcdFx0eyBsYWJlbDogdGhpcy51c2VXb3Jrc3BhY2VMYW5ndWFnZSA/IGxvY2FsaXplKHsga2V5OiAnZ3JhbnRXb3Jrc3BhY2VUcnVzdEJ1dHRvbicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlRydXN0IFdvcmtzcGFjZSAmIENvbnRpbnVlXCIpIDogbG9jYWxpemUoeyBrZXk6ICdncmFudEZvbGRlclRydXN0QnV0dG9uJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmVHJ1c3QgRm9sZGVyICYgQ29udGludWVcIiksIHR5cGU6ICdDb250aW51ZVdpdGhUcnVzdCcgfSxcblx0XHRcdFx0eyBsYWJlbDogbG9jYWxpemUoeyBrZXk6ICdtYW5hZ2VXb3Jrc3BhY2VUcnVzdEJ1dHRvbicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJk1hbmFnZVwiKSwgdHlwZTogJ01hbmFnZScgfVxuXHRcdFx0XTtcblxuXHRcdFx0Ly8gQWRkIENhbmNlbCBidXR0b24gaWYgbm90IHByb3ZpZGVkXG5cdFx0XHRpZiAoIWJ1dHRvbnMuc29tZShiID0+IGIudHlwZSA9PT0gJ0NhbmNlbCcpKSB7XG5cdFx0XHRcdGJ1dHRvbnMucHVzaCh7IGxhYmVsOiBsb2NhbGl6ZSgnY2FuY2VsV29ya3NwYWNlVHJ1c3RCdXR0b24nLCBcIkNhbmNlbFwiKSwgdHlwZTogJ0NhbmNlbCcgfSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIERpYWxvZ1xuXHRcdFx0Y29uc3QgeyByZXN1bHQgfSA9IGF3YWl0IHRoaXMuZGlhbG9nU2VydmljZS5wcm9tcHQoe1xuXHRcdFx0XHR0eXBlOiBTZXZlcml0eS5JbmZvLFxuXHRcdFx0XHRtZXNzYWdlLFxuXHRcdFx0XHRjdXN0b206IHtcblx0XHRcdFx0XHRpY29uOiBDb2RpY29uLnNoaWVsZCxcblx0XHRcdFx0XHRtYXJrZG93bkRldGFpbHM6IFtcblx0XHRcdFx0XHRcdHsgbWFya2Rvd246IG5ldyBNYXJrZG93blN0cmluZyhkZXRhaWxzKSB9LFxuXHRcdFx0XHRcdFx0eyBtYXJrZG93bjogbmV3IE1hcmtkb3duU3RyaW5nKGxvY2FsaXplKCdpbW1lZGlhdGVUcnVzdFJlcXVlc3RMZWFybk1vcmUnLCBcIklmIHlvdSBkb24ndCB0cnVzdCB0aGUgYXV0aG9ycyBvZiB0aGVzZSBmaWxlcywgd2UgZG8gbm90IHJlY29tbWVuZCBjb250aW51aW5nIGFzIHRoZSBmaWxlcyBtYXkgYmUgbWFsaWNpb3VzLiBTZWUgW291ciBkb2NzXShodHRwczovL2FrYS5tcy92c2NvZGUtd29ya3NwYWNlLXRydXN0KSB0byBsZWFybiBtb3JlLlwiKSkgfVxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0YnV0dG9uczogYnV0dG9ucy5maWx0ZXIoYiA9PiBiLnR5cGUgIT09ICdDYW5jZWwnKS5tYXAoYnV0dG9uID0+IHtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0bGFiZWw6IGJ1dHRvbi5sYWJlbCxcblx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gYnV0dG9uLnR5cGVcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9KSxcblx0XHRcdFx0Y2FuY2VsQnV0dG9uOiAoKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGNhbmNlbEJ1dHRvbiA9IGJ1dHRvbnMuZmluZChiID0+IGIudHlwZSA9PT0gJ0NhbmNlbCcpO1xuXHRcdFx0XHRcdGlmICghY2FuY2VsQnV0dG9uKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRsYWJlbDogY2FuY2VsQnV0dG9uLmxhYmVsLFxuXHRcdFx0XHRcdFx0cnVuOiAoKSA9PiBjYW5jZWxCdXR0b24udHlwZVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0pKClcblx0XHRcdH0pO1xuXG5cblx0XHRcdC8vIERpYWxvZyByZXN1bHRcblx0XHRcdHN3aXRjaCAocmVzdWx0KSB7XG5cdFx0XHRcdGNhc2UgJ0NvbnRpbnVlV2l0aFRydXN0Jzpcblx0XHRcdFx0XHRhd2FpdCB0aGlzLndvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UuY29tcGxldGVXb3Jrc3BhY2VUcnVzdFJlcXVlc3QodHJ1ZSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ0NvbnRpbnVlV2l0aG91dFRydXN0Jzpcblx0XHRcdFx0XHRhd2FpdCB0aGlzLndvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UuY29tcGxldGVXb3Jrc3BhY2VUcnVzdFJlcXVlc3QodW5kZWZpbmVkKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAnTWFuYWdlJzpcblx0XHRcdFx0XHR0aGlzLndvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UuY2FuY2VsV29ya3NwYWNlVHJ1c3RSZXF1ZXN0KCk7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZChNQU5BR0VfVFJVU1RfQ09NTUFORF9JRCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ0NhbmNlbCc6XG5cdFx0XHRcdFx0dGhpcy53b3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlLmNhbmNlbFdvcmtzcGFjZVRydXN0UmVxdWVzdCgpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxufVxuXG5cbi8qXG4gKiBUcnVzdCBVWCBhbmQgU3RhcnR1cCBIYW5kbGVyXG4gKi9cbmV4cG9ydCBjbGFzcyBXb3Jrc3BhY2VUcnVzdFVYSGFuZGxlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGVudHJ5SWQgPSBgc3RhdHVzLndvcmtzcGFjZVRydXN0YDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHN0YXR1c2JhckVudHJ5QWNjZXNzb3I6IE11dGFibGVEaXNwb3NhYmxlPElTdGF0dXNiYXJFbnRyeUFjY2Vzc29yPjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgd29ya3NwYWNlQ29udGV4dFNlcnZpY2U6IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSxcblx0XHRASVdvcmtzcGFjZVRydXN0RW5hYmxlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VUcnVzdEVuYWJsZW1lbnRTZXJ2aWNlOiBJV29ya3NwYWNlVHJ1c3RFbmFibGVtZW50U2VydmljZSxcblx0XHRASVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlOiBJV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVN0YXR1c2JhclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdGF0dXNiYXJTZXJ2aWNlOiBJU3RhdHVzYmFyU2VydmljZSxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASVdvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlOiBJV29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZSxcblx0XHRASUJhbm5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBiYW5uZXJTZXJ2aWNlOiBJQmFubmVyU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASUhvc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRASVJlbW90ZUFnZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHJlbW90ZUFnZW50U2VydmljZTogSVJlbW90ZUFnZW50U2VydmljZSxcblx0XHRASUVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGVudmlyb25tZW50U2VydmljZTogSUVudmlyb25tZW50U2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuc3RhdHVzYmFyRW50cnlBY2Nlc3NvciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBNdXRhYmxlRGlzcG9zYWJsZTxJU3RhdHVzYmFyRW50cnlBY2Nlc3Nvcj4oKSk7XG5cblx0XHQoYXN5bmMgKCkgPT4ge1xuXG5cdFx0XHRhd2FpdCB0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2Uud29ya3NwYWNlVHJ1c3RJbml0aWFsaXplZDtcblxuXHRcdFx0aWYgKHRoaXMud29ya3NwYWNlVHJ1c3RFbmFibGVtZW50U2VydmljZS5pc1dvcmtzcGFjZVRydXN0RW5hYmxlZCgpKSB7XG5cdFx0XHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0XHRcdFx0dGhpcy51cGRhdGVTdGF0dXNiYXJFbnRyeSh0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UuaXNXb3Jrc3BhY2VUcnVzdGVkKCkpO1xuXG5cdFx0XHRcdC8vIFNob3cgbW9kYWwgZGlhbG9nXG5cdFx0XHRcdGlmICh0aGlzLmhvc3RTZXJ2aWNlLmhhc0ZvY3VzKSB7XG5cdFx0XHRcdFx0dGhpcy5zaG93TW9kYWxPblN0YXJ0KCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3QgZm9jdXNEaXNwb3NhYmxlID0gdGhpcy5ob3N0U2VydmljZS5vbkRpZENoYW5nZUZvY3VzKGZvY3VzZWQgPT4ge1xuXHRcdFx0XHRcdFx0aWYgKGZvY3VzZWQpIHtcblx0XHRcdFx0XHRcdFx0Zm9jdXNEaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdFx0dGhpcy5zaG93TW9kYWxPblN0YXJ0KCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSgpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3Rlckxpc3RlbmVycygpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLm9uV2lsbENoYW5nZVdvcmtzcGFjZUZvbGRlcnMoZSA9PiB7XG5cdFx0XHRpZiAoZS5mcm9tQ2FjaGUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCF0aGlzLndvcmtzcGFjZVRydXN0RW5hYmxlbWVudFNlcnZpY2UuaXNXb3Jrc3BhY2VUcnVzdEVuYWJsZWQoKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGFkZFdvcmtzcGFjZUZvbGRlciA9IGFzeW5jIChlOiBJV29ya3NwYWNlRm9sZGVyc1dpbGxDaGFuZ2VFdmVudCk6IFByb21pc2U8dm9pZD4gPT4ge1xuXHRcdFx0XHRjb25zdCB0cnVzdGVkID0gdGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLmlzV29ya3NwYWNlVHJ1c3RlZCgpO1xuXG5cdFx0XHRcdC8vIFdvcmtzcGFjZSBpcyB0cnVzdGVkIGFuZCB0aGVyZSBhcmUgYWRkZWQvY2hhbmdlZCBmb2xkZXJzXG5cdFx0XHRcdGlmICh0cnVzdGVkICYmIChlLmNoYW5nZXMuYWRkZWQubGVuZ3RoIHx8IGUuY2hhbmdlcy5jaGFuZ2VkLmxlbmd0aCkpIHtcblx0XHRcdFx0XHRjb25zdCBhZGRlZEZvbGRlcnNUcnVzdEluZm8gPSBhd2FpdCBQcm9taXNlLmFsbChlLmNoYW5nZXMuYWRkZWQubWFwKGZvbGRlciA9PiB0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UuZ2V0VXJpVHJ1c3RJbmZvKGZvbGRlci51cmkpKSk7XG5cblx0XHRcdFx0XHRpZiAoIWFkZGVkRm9sZGVyc1RydXN0SW5mby5tYXAoaW5mbyA9PiBpbmZvLnRydXN0ZWQpLmV2ZXJ5KHRydXN0ZWQgPT4gdHJ1c3RlZCkpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHsgY29uZmlybWVkIH0gPSBhd2FpdCB0aGlzLmRpYWxvZ1NlcnZpY2UuY29uZmlybSh7XG5cdFx0XHRcdFx0XHRcdHR5cGU6IFNldmVyaXR5LkluZm8sXG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCdhZGRXb3Jrc3BhY2VGb2xkZXJNZXNzYWdlJywgXCJEbyB5b3UgdHJ1c3QgdGhlIGF1dGhvcnMgb2YgdGhlIGZpbGVzIGluIHRoaXMgZm9sZGVyP1wiKSxcblx0XHRcdFx0XHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZSgnYWRkV29ya3NwYWNlRm9sZGVyRGV0YWlsJywgXCJZb3UgYXJlIGFkZGluZyBmaWxlcyB0aGF0IGFyZSBub3QgY3VycmVudGx5IHRydXN0ZWQgdG8gYSB0cnVzdGVkIHdvcmtzcGFjZS4gRG8geW91IHRydXN0IHRoZSBhdXRob3JzIG9mIHRoZXNlIG5ldyBmaWxlcz9cIiksXG5cdFx0XHRcdFx0XHRcdGNhbmNlbEJ1dHRvbjogbG9jYWxpemUoJ25vJywgJ05vJyksXG5cdFx0XHRcdFx0XHRcdGN1c3RvbTogeyBpY29uOiBDb2RpY29uLnNoaWVsZCB9XG5cdFx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdFx0Ly8gTWFyayBhZGRlZC9jaGFuZ2VkIGZvbGRlcnMgYXMgdHJ1c3RlZFxuXHRcdFx0XHRcdFx0YXdhaXQgdGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLnNldFVyaXNUcnVzdChhZGRlZEZvbGRlcnNUcnVzdEluZm8ubWFwKGkgPT4gaS51cmkpLCBjb25maXJtZWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0cmV0dXJuIGUuam9pbihhZGRXb3Jrc3BhY2VGb2xkZXIoZSkpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5vbkRpZENoYW5nZVRydXN0KHRydXN0ZWQgPT4ge1xuXHRcdFx0dGhpcy51cGRhdGVXb3JrYmVuY2hJbmRpY2F0b3JzKHRydXN0ZWQpO1xuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMud29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZS5vbkRpZEluaXRpYXRlV29ya3NwYWNlVHJ1c3RSZXF1ZXN0T25TdGFydHVwKGFzeW5jICgpID0+IHtcblxuXHRcdFx0bGV0IHRpdGxlU3RyaW5nOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgbGVhcm5Nb3JlU3RyaW5nOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgdHJ1c3RPcHRpb246IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRcdGxldCBkb250VHJ1c3RPcHRpb246IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IGlzQWlHZW5lcmF0ZWRXb3Jrc3BhY2UgPSBhd2FpdCB0aGlzLmlzQWlHZW5lcmF0ZWRXb3Jrc3BhY2UoKTtcblx0XHRcdGlmIChpc0FpR2VuZXJhdGVkV29ya3NwYWNlICYmIHRoaXMucHJvZHVjdFNlcnZpY2UuYWlHZW5lcmF0ZWRXb3Jrc3BhY2VUcnVzdCkge1xuXHRcdFx0XHR0aXRsZVN0cmluZyA9IHRoaXMucHJvZHVjdFNlcnZpY2UuYWlHZW5lcmF0ZWRXb3Jrc3BhY2VUcnVzdC50aXRsZTtcblx0XHRcdFx0bGVhcm5Nb3JlU3RyaW5nID0gdGhpcy5wcm9kdWN0U2VydmljZS5haUdlbmVyYXRlZFdvcmtzcGFjZVRydXN0LnN0YXJ0dXBUcnVzdFJlcXVlc3RMZWFybk1vcmU7XG5cdFx0XHRcdHRydXN0T3B0aW9uID0gdGhpcy5wcm9kdWN0U2VydmljZS5haUdlbmVyYXRlZFdvcmtzcGFjZVRydXN0LnRydXN0T3B0aW9uO1xuXHRcdFx0XHRkb250VHJ1c3RPcHRpb24gPSB0aGlzLnByb2R1Y3RTZXJ2aWNlLmFpR2VuZXJhdGVkV29ya3NwYWNlVHJ1c3QuZG9udFRydXN0T3B0aW9uO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKCdBSSBnZW5lcmF0ZWQgd29ya3NwYWNlIHRydXN0IGRpYWxvZyBjb250ZW50cyBub3QgYXZhaWxhYmxlLicpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB0aXRsZSA9IHRpdGxlU3RyaW5nID8/ICh0aGlzLnVzZVdvcmtzcGFjZUxhbmd1YWdlID9cblx0XHRcdFx0bG9jYWxpemUoJ3dvcmtzcGFjZVRydXN0JywgXCJEbyB5b3UgdHJ1c3QgdGhlIGF1dGhvcnMgb2YgdGhlIGZpbGVzIGluIHRoaXMgd29ya3NwYWNlP1wiKSA6XG5cdFx0XHRcdGxvY2FsaXplKCdmb2xkZXJUcnVzdCcsIFwiRG8geW91IHRydXN0IHRoZSBhdXRob3JzIG9mIHRoZSBmaWxlcyBpbiB0aGlzIGZvbGRlcj9cIikpO1xuXG5cdFx0XHRsZXQgY2hlY2tib3hUZXh0OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCB3b3Jrc3BhY2VJZGVudGlmaWVyID0gdG9Xb3Jrc3BhY2VJZGVudGlmaWVyKHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkpO1xuXHRcdFx0Y29uc3QgaXNTaW5nbGVGb2xkZXJXb3Jrc3BhY2UgPSBpc1NpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIod29ya3NwYWNlSWRlbnRpZmllcik7XG5cdFx0XHRjb25zdCBpc0VtcHR5V2luZG93ID0gaXNFbXB0eVdvcmtzcGFjZUlkZW50aWZpZXIod29ya3NwYWNlSWRlbnRpZmllcik7XG5cdFx0XHRpZiAoIWlzQWlHZW5lcmF0ZWRXb3Jrc3BhY2UgJiYgdGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLmNhblNldFBhcmVudEZvbGRlclRydXN0KCkpIHtcblx0XHRcdFx0Y29uc3QgbmFtZSA9IGJhc2VuYW1lKHVyaURpcm5hbWUoKHdvcmtzcGFjZUlkZW50aWZpZXIgYXMgSVNpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIpLnVyaSkpO1xuXHRcdFx0XHRjaGVja2JveFRleHQgPSBsb2NhbGl6ZSgnY2hlY2tib3hTdHJpbmcnLCBcIlRydXN0IHRoZSBhdXRob3JzIG9mIGFsbCBmaWxlcyBpbiB0aGUgcGFyZW50IGZvbGRlciAnezB9J1wiLCBuYW1lKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2hvdyBXb3Jrc3BhY2UgVHJ1c3QgU3RhcnQgRGlhbG9nXG5cdFx0XHR0aGlzLmRvU2hvd01vZGFsKFxuXHRcdFx0XHR0aXRsZSxcblx0XHRcdFx0eyBsYWJlbDogdHJ1c3RPcHRpb24gPz8gbG9jYWxpemUoeyBrZXk6ICd0cnVzdE9wdGlvbicsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJlllcywgSSB0cnVzdCB0aGUgYXV0aG9yc1wiKSwgc3VibGFiZWw6IGlzU2luZ2xlRm9sZGVyV29ya3NwYWNlID8gbG9jYWxpemUoJ3RydXN0Rm9sZGVyT3B0aW9uRGVzY3JpcHRpb24nLCBcIlRydXN0IGZvbGRlciBhbmQgZW5hYmxlIGFsbCBmZWF0dXJlc1wiKSA6IGxvY2FsaXplKCd0cnVzdFdvcmtzcGFjZU9wdGlvbkRlc2NyaXB0aW9uJywgXCJUcnVzdCB3b3Jrc3BhY2UgYW5kIGVuYWJsZSBhbGwgZmVhdHVyZXNcIikgfSxcblx0XHRcdFx0eyBsYWJlbDogZG9udFRydXN0T3B0aW9uID8/IGxvY2FsaXplKHsga2V5OiAnZG9udFRydXN0T3B0aW9uJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmTm8sIEkgZG9uJ3QgdHJ1c3QgdGhlIGF1dGhvcnNcIiksIHN1YmxhYmVsOiBpc1NpbmdsZUZvbGRlcldvcmtzcGFjZSA/IGxvY2FsaXplKCdkb250VHJ1c3RGb2xkZXJPcHRpb25EZXNjcmlwdGlvbicsIFwiQnJvd3NlIGZvbGRlciBpbiByZXN0cmljdGVkIG1vZGVcIikgOiBsb2NhbGl6ZSgnZG9udFRydXN0V29ya3NwYWNlT3B0aW9uRGVzY3JpcHRpb24nLCBcIkJyb3dzZSB3b3Jrc3BhY2UgaW4gcmVzdHJpY3RlZCBtb2RlXCIpIH0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQhaXNTaW5nbGVGb2xkZXJXb3Jrc3BhY2UgP1xuXHRcdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtzcGFjZVN0YXJ0dXBUcnVzdERldGFpbHMnLCBcInswfSBwcm92aWRlcyBmZWF0dXJlcyB0aGF0IG1heSBhdXRvbWF0aWNhbGx5IGV4ZWN1dGUgZmlsZXMgaW4gdGhpcyB3b3Jrc3BhY2UuXCIsIHRoaXMucHJvZHVjdFNlcnZpY2UubmFtZVNob3J0KSA6XG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnZm9sZGVyU3RhcnR1cFRydXN0RGV0YWlscycsIFwiezB9IHByb3ZpZGVzIGZlYXR1cmVzIHRoYXQgbWF5IGF1dG9tYXRpY2FsbHkgZXhlY3V0ZSBmaWxlcyBpbiB0aGlzIGZvbGRlci5cIiwgdGhpcy5wcm9kdWN0U2VydmljZS5uYW1lU2hvcnQpLFxuXHRcdFx0XHRcdGxlYXJuTW9yZVN0cmluZyA/PyBsb2NhbGl6ZSgnc3RhcnR1cFRydXN0UmVxdWVzdExlYXJuTW9yZScsIFwiSWYgeW91IGRvbid0IHRydXN0IHRoZSBhdXRob3JzIG9mIHRoZXNlIGZpbGVzLCB3ZSByZWNvbW1lbmQgdG8gY29udGludWUgaW4gcmVzdHJpY3RlZCBtb2RlIGFzIHRoZSBmaWxlcyBtYXkgYmUgbWFsaWNpb3VzLiBTZWUgW291ciBkb2NzXShodHRwczovL2FrYS5tcy92c2NvZGUtd29ya3NwYWNlLXRydXN0KSB0byBsZWFybiBtb3JlLlwiKSxcblx0XHRcdFx0XHQhaXNFbXB0eVdpbmRvdyA/XG5cdFx0XHRcdFx0XHRgXFxgJHt0aGlzLmxhYmVsU2VydmljZS5nZXRXb3Jrc3BhY2VMYWJlbCh3b3Jrc3BhY2VJZGVudGlmaWVyLCB7IHZlcmJvc2U6IFZlcmJvc2l0eS5MT05HIH0pfVxcYGAgOiAnJyxcblx0XHRcdFx0XSxcblx0XHRcdFx0Y2hlY2tib3hUZXh0XG5cdFx0XHQpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlV29ya2JlbmNoSW5kaWNhdG9ycyh0cnVzdGVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgYmFubmVySXRlbSA9IHRoaXMuZ2V0QmFubmVySXRlbSghdHJ1c3RlZCk7XG5cblx0XHR0aGlzLnVwZGF0ZVN0YXR1c2JhckVudHJ5KHRydXN0ZWQpO1xuXG5cdFx0aWYgKGJhbm5lckl0ZW0pIHtcblx0XHRcdGlmICghdHJ1c3RlZCkge1xuXHRcdFx0XHR0aGlzLmJhbm5lclNlcnZpY2Uuc2hvdyhiYW5uZXJJdGVtKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuYmFubmVyU2VydmljZS5oaWRlKEJBTk5FUl9SRVNUUklDVEVEX01PREUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdC8vI3JlZ2lvbiBEaWFsb2dcblxuXHRwcml2YXRlIGFzeW5jIGRvU2hvd01vZGFsKHF1ZXN0aW9uOiBzdHJpbmcsIHRydXN0ZWRPcHRpb246IHsgbGFiZWw6IHN0cmluZzsgc3VibGFiZWw6IHN0cmluZyB9LCB1bnRydXN0ZWRPcHRpb246IHsgbGFiZWw6IHN0cmluZzsgc3VibGFiZWw6IHN0cmluZyB9LCBtYXJrZG93blN0cmluZ3M6IHN0cmluZ1tdLCB0cnVzdFBhcmVudFN0cmluZz86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuZGlhbG9nU2VydmljZS5wcm9tcHQoe1xuXHRcdFx0dHlwZTogU2V2ZXJpdHkuSW5mbyxcblx0XHRcdG1lc3NhZ2U6IHF1ZXN0aW9uLFxuXHRcdFx0Y2hlY2tib3g6IHRydXN0UGFyZW50U3RyaW5nID8ge1xuXHRcdFx0XHRsYWJlbDogdHJ1c3RQYXJlbnRTdHJpbmdcblx0XHRcdH0gOiB1bmRlZmluZWQsXG5cdFx0XHRidXR0b25zOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRsYWJlbDogdHJ1c3RlZE9wdGlvbi5sYWJlbCxcblx0XHRcdFx0XHRydW46IGFzeW5jICh7IGNoZWNrYm94Q2hlY2tlZCB9KSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoY2hlY2tib3hDaGVja2VkKSB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5zZXRQYXJlbnRGb2xkZXJUcnVzdCh0cnVlKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGF3YWl0IHRoaXMud29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZS5jb21wbGV0ZVdvcmtzcGFjZVRydXN0UmVxdWVzdCh0cnVlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRsYWJlbDogdW50cnVzdGVkT3B0aW9uLmxhYmVsLFxuXHRcdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy51cGRhdGVXb3JrYmVuY2hJbmRpY2F0b3JzKGZhbHNlKTtcblx0XHRcdFx0XHRcdHRoaXMud29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZS5jYW5jZWxXb3Jrc3BhY2VUcnVzdFJlcXVlc3QoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdF0sXG5cdFx0XHRjdXN0b206IHtcblx0XHRcdFx0YnV0dG9uRGV0YWlsczogW1xuXHRcdFx0XHRcdHRydXN0ZWRPcHRpb24uc3VibGFiZWwsXG5cdFx0XHRcdFx0dW50cnVzdGVkT3B0aW9uLnN1YmxhYmVsXG5cdFx0XHRcdF0sXG5cdFx0XHRcdGRpc2FibGVDbG9zZUFjdGlvbjogdHJ1ZSxcblx0XHRcdFx0aWNvbjogQ29kaWNvbi5zaGllbGQsXG5cdFx0XHRcdG1hcmtkb3duRGV0YWlsczogbWFya2Rvd25TdHJpbmdzLm1hcChtZCA9PiB7IHJldHVybiB7IG1hcmtkb3duOiBuZXcgTWFya2Rvd25TdHJpbmcobWQpIH07IH0pXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKFNUQVJUVVBfUFJPTVBUX1NIT1dOX0tFWSwgdHJ1ZSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc2hvd01vZGFsT25TdGFydCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLmlzV29ya3NwYWNlVHJ1c3RlZCgpKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZVdvcmtiZW5jaEluZGljYXRvcnModHJ1ZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gRG9uJ3Qgc2hvdyBtb2RhbCBwcm9tcHQgaWYgd29ya3NwYWNlIHRydXN0IGNhbm5vdCBiZSBjaGFuZ2VkXG5cdFx0aWYgKCEodGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLmNhblNldFdvcmtzcGFjZVRydXN0KCkpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gRG9uJ3Qgc2hvdyBtb2RhbCBwcm9tcHQgZm9yIHZpcnR1YWwgd29ya3NwYWNlcyBieSBkZWZhdWx0XG5cdFx0aWYgKGlzVmlydHVhbFdvcmtzcGFjZSh0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpKSkge1xuXHRcdFx0dGhpcy51cGRhdGVXb3JrYmVuY2hJbmRpY2F0b3JzKGZhbHNlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBEb24ndCBzaG93IG1vZGFsIHByb21wdCBmb3IgZW1wdHkgd29ya3NwYWNlcyBieSBkZWZhdWx0XG5cdFx0aWYgKHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSA9PT0gV29ya2JlbmNoU3RhdGUuRU1QVFkpIHtcblx0XHRcdHRoaXMudXBkYXRlV29ya2JlbmNoSW5kaWNhdG9ycyhmYWxzZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc3RhcnR1cFByb21wdFNldHRpbmcgPT09ICduZXZlcicpIHtcblx0XHRcdHRoaXMudXBkYXRlV29ya2JlbmNoSW5kaWNhdG9ycyhmYWxzZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuc3RhcnR1cFByb21wdFNldHRpbmcgPT09ICdvbmNlJyAmJiB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldEJvb2xlYW4oU1RBUlRVUF9QUk9NUFRfU0hPV05fS0VZLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBmYWxzZSkpIHtcblx0XHRcdHRoaXMudXBkYXRlV29ya2JlbmNoSW5kaWNhdG9ycyhmYWxzZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gVXNlIHRoZSB3b3Jrc3BhY2UgdHJ1c3QgcmVxdWVzdCBzZXJ2aWNlIHRvIHNob3cgbW9kYWwgZGlhbG9nXG5cdFx0dGhpcy53b3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlLnJlcXVlc3RXb3Jrc3BhY2VUcnVzdE9uU3RhcnR1cCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgc3RhcnR1cFByb21wdFNldHRpbmcoKTogJ2Fsd2F5cycgfCAnb25jZScgfCAnbmV2ZXInIHtcblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShXT1JLU1BBQ0VfVFJVU1RfU1RBUlRVUF9QUk9NUFQpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgdXNlV29ya3NwYWNlTGFuZ3VhZ2UoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICFpc1NpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIodG9Xb3Jrc3BhY2VJZGVudGlmaWVyKHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaXNBaUdlbmVyYXRlZFdvcmtzcGFjZSgpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCBhaUdlbmVyYXRlZFdvcmtzcGFjZXMgPSBVUkkuam9pblBhdGgodGhpcy5lbnZpcm9ubWVudFNlcnZpY2Uud29ya3NwYWNlU3RvcmFnZUhvbWUsICdhaUdlbmVyYXRlZFdvcmtzcGFjZXMuanNvbicpO1xuXHRcdHJldHVybiBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmV4aXN0cyhhaUdlbmVyYXRlZFdvcmtzcGFjZXMpLnRoZW4oYXN5bmMgcmVzdWx0ID0+IHtcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZWFkRmlsZShhaUdlbmVyYXRlZFdvcmtzcGFjZXMpO1xuXHRcdFx0XHRcdGNvbnN0IHdvcmtzcGFjZXMgPSBKU09OLnBhcnNlKGNvbnRlbnQudmFsdWUudG9TdHJpbmcoKSkgYXMgc3RyaW5nW107XG5cdFx0XHRcdFx0aWYgKHdvcmtzcGFjZXMuaW5kZXhPZih0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnNbMF0udXJpLnRvU3RyaW5nKCkpID4gLTEpIHtcblx0XHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdC8vIElnbm9yZSBlcnJvcnMgd2hlbiByZXNvbHZpbmcgZmlsZSBjb250ZW50c1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fSk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gQmFubmVyXG5cblx0cHJpdmF0ZSBnZXRCYW5uZXJJdGVtKHJlc3RyaWN0ZWRNb2RlOiBib29sZWFuKTogSUJhbm5lckl0ZW0gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGRpc21pc3NlZFJlc3RyaWN0ZWQgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldEJvb2xlYW4oQkFOTkVSX1JFU1RSSUNURURfTU9ERV9ESVNNSVNTRURfS0VZLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBmYWxzZSk7XG5cblx0XHQvLyBuZXZlciBzaG93IHRoZSBiYW5uZXJcblx0XHRpZiAodGhpcy5iYW5uZXJTZXR0aW5nID09PSAnbmV2ZXInKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdC8vIGluZm8gaGFzIGJlZW4gZGlzbWlzc2VkXG5cdFx0aWYgKHRoaXMuYmFubmVyU2V0dGluZyA9PT0gJ3VudGlsRGlzbWlzc2VkJyAmJiBkaXNtaXNzZWRSZXN0cmljdGVkKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGlvbnMgPVxuXHRcdFx0W1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdyZXN0cmljdGVkTW9kZUJhbm5lck1hbmFnZScsIFwiTWFuYWdlXCIpLFxuXHRcdFx0XHRcdGhyZWY6ICdjb21tYW5kOicgKyBNQU5BR0VfVFJVU1RfQ09NTUFORF9JRFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdyZXN0cmljdGVkTW9kZUJhbm5lckxlYXJuTW9yZScsIFwiTGVhcm4gTW9yZVwiKSxcblx0XHRcdFx0XHRocmVmOiAnaHR0cHM6Ly9ha2EubXMvdnNjb2RlLXdvcmtzcGFjZS10cnVzdCdcblx0XHRcdFx0fVxuXHRcdFx0XTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRpZDogQkFOTkVSX1JFU1RSSUNURURfTU9ERSxcblx0XHRcdGljb246IHNoaWVsZEljb24sXG5cdFx0XHRhcmlhTGFiZWw6IHRoaXMuZ2V0QmFubmVySXRlbUFyaWFMYWJlbHMoKSxcblx0XHRcdG1lc3NhZ2U6IHRoaXMuZ2V0QmFubmVySXRlbU1lc3NhZ2VzKCksXG5cdFx0XHRhY3Rpb25zLFxuXHRcdFx0b25DbG9zZTogKCkgPT4ge1xuXHRcdFx0XHRpZiAocmVzdHJpY3RlZE1vZGUpIHtcblx0XHRcdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKEJBTk5FUl9SRVNUUklDVEVEX01PREVfRElTTUlTU0VEX0tFWSwgdHJ1ZSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGdldEJhbm5lckl0ZW1BcmlhTGFiZWxzKCk6IHN0cmluZyB7XG5cdFx0c3dpdGNoICh0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkpIHtcblx0XHRcdGNhc2UgV29ya2JlbmNoU3RhdGUuRU1QVFk6XG5cdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgncmVzdHJpY3RlZE1vZGVCYW5uZXJBcmlhTGFiZWxXaW5kb3cnLCBcIlJlc3RyaWN0ZWQgTW9kZSBpcyBpbnRlbmRlZCBmb3Igc2FmZSBjb2RlIGJyb3dzaW5nLiBUcnVzdCB0aGlzIHdpbmRvdyB0byBlbmFibGUgYWxsIGZlYXR1cmVzLiBVc2UgbmF2aWdhdGlvbiBrZXlzIHRvIGFjY2VzcyBiYW5uZXIgYWN0aW9ucy5cIik7XG5cdFx0XHRjYXNlIFdvcmtiZW5jaFN0YXRlLkZPTERFUjpcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdyZXN0cmljdGVkTW9kZUJhbm5lckFyaWFMYWJlbEZvbGRlcicsIFwiUmVzdHJpY3RlZCBNb2RlIGlzIGludGVuZGVkIGZvciBzYWZlIGNvZGUgYnJvd3NpbmcuIFRydXN0IHRoaXMgZm9sZGVyIHRvIGVuYWJsZSBhbGwgZmVhdHVyZXMuIFVzZSBuYXZpZ2F0aW9uIGtleXMgdG8gYWNjZXNzIGJhbm5lciBhY3Rpb25zLlwiKTtcblx0XHRcdGNhc2UgV29ya2JlbmNoU3RhdGUuV09SS1NQQUNFOlxuXHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3Jlc3RyaWN0ZWRNb2RlQmFubmVyQXJpYUxhYmVsV29ya3NwYWNlJywgXCJSZXN0cmljdGVkIE1vZGUgaXMgaW50ZW5kZWQgZm9yIHNhZmUgY29kZSBicm93c2luZy4gVHJ1c3QgdGhpcyB3b3Jrc3BhY2UgdG8gZW5hYmxlIGFsbCBmZWF0dXJlcy4gVXNlIG5hdmlnYXRpb24ga2V5cyB0byBhY2Nlc3MgYmFubmVyIGFjdGlvbnMuXCIpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0QmFubmVySXRlbU1lc3NhZ2VzKCk6IHN0cmluZyB7XG5cdFx0c3dpdGNoICh0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtiZW5jaFN0YXRlKCkpIHtcblx0XHRcdGNhc2UgV29ya2JlbmNoU3RhdGUuRU1QVFk6XG5cdFx0XHRcdHJldHVybiBsb2NhbGl6ZSgncmVzdHJpY3RlZE1vZGVCYW5uZXJNZXNzYWdlV2luZG93JywgXCJSZXN0cmljdGVkIE1vZGUgaXMgaW50ZW5kZWQgZm9yIHNhZmUgY29kZSBicm93c2luZy4gVHJ1c3QgdGhpcyB3aW5kb3cgdG8gZW5hYmxlIGFsbCBmZWF0dXJlcy5cIik7XG5cdFx0XHRjYXNlIFdvcmtiZW5jaFN0YXRlLkZPTERFUjpcblx0XHRcdFx0cmV0dXJuIGxvY2FsaXplKCdyZXN0cmljdGVkTW9kZUJhbm5lck1lc3NhZ2VGb2xkZXInLCBcIlJlc3RyaWN0ZWQgTW9kZSBpcyBpbnRlbmRlZCBmb3Igc2FmZSBjb2RlIGJyb3dzaW5nLiBUcnVzdCB0aGlzIGZvbGRlciB0byBlbmFibGUgYWxsIGZlYXR1cmVzLlwiKTtcblx0XHRcdGNhc2UgV29ya2JlbmNoU3RhdGUuV09SS1NQQUNFOlxuXHRcdFx0XHRyZXR1cm4gbG9jYWxpemUoJ3Jlc3RyaWN0ZWRNb2RlQmFubmVyTWVzc2FnZVdvcmtzcGFjZScsIFwiUmVzdHJpY3RlZCBNb2RlIGlzIGludGVuZGVkIGZvciBzYWZlIGNvZGUgYnJvd3NpbmcuIFRydXN0IHRoaXMgd29ya3NwYWNlIHRvIGVuYWJsZSBhbGwgZmVhdHVyZXMuXCIpO1xuXHRcdH1cblx0fVxuXG5cblx0cHJpdmF0ZSBnZXQgYmFubmVyU2V0dGluZygpOiAnYWx3YXlzJyB8ICd1bnRpbERpc21pc3NlZCcgfCAnbmV2ZXInIHtcblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPCdhbHdheXMnIHwgJ3VudGlsRGlzbWlzc2VkJyB8ICduZXZlcic+KFdPUktTUEFDRV9UUlVTVF9CQU5ORVIpO1xuXG5cdFx0Ly8gSW4gc2VydmVybGVzcyBlbnZpcm9ubWVudHMsIHdlIGRvbid0IG5lZWQgdG8gYWdncmVzc2l2ZWx5IHNob3cgdGhlIGJhbm5lclxuXHRcdGlmIChyZXN1bHQgIT09ICdhbHdheXMnICYmIGlzV2ViICYmICF0aGlzLnJlbW90ZUFnZW50U2VydmljZS5nZXRDb25uZWN0aW9uKCk/LnJlbW90ZUF1dGhvcml0eSkge1xuXHRcdFx0cmV0dXJuICduZXZlcic7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vI3JlZ2lvbiBTdGF0dXNiYXJcblxuXHRwcml2YXRlIGdldFJlc3RyaWN0ZWRNb2RlU3RhdHVzYmFyRW50cnkoKTogSVN0YXR1c2JhckVudHJ5IHtcblx0XHRsZXQgYXJpYUxhYmVsID0gJyc7XG5cdFx0bGV0IHRvb2xUaXA6IElNYXJrZG93blN0cmluZyB8IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRzd2l0Y2ggKHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya2JlbmNoU3RhdGUoKSkge1xuXHRcdFx0Y2FzZSBXb3JrYmVuY2hTdGF0ZS5FTVBUWToge1xuXHRcdFx0XHRhcmlhTGFiZWwgPSBsb2NhbGl6ZSgnc3RhdHVzLmFyaWFVbnRydXN0ZWRXaW5kb3cnLCBcIlJlc3RyaWN0ZWQgTW9kZTogU29tZSBmZWF0dXJlcyBhcmUgZGlzYWJsZWQgYmVjYXVzZSB0aGlzIHdpbmRvdyBpcyBub3QgdHJ1c3RlZC5cIik7XG5cdFx0XHRcdHRvb2xUaXAgPSB7XG5cdFx0XHRcdFx0dmFsdWU6IGxvY2FsaXplKFxuXHRcdFx0XHRcdFx0eyBrZXk6ICdzdGF0dXMudG9vbHRpcFVudHJ1c3RlZFdpbmRvdzInLCBjb21tZW50OiBbJ1thYmNdKHtufSkgYXJlIGxpbmtzLiAgT25seSB0cmFuc2xhdGUgYGZlYXR1cmVzIGFyZSBkaXNhYmxlZGAgYW5kIGB3aW5kb3cgaXMgbm90IHRydXN0ZWRgLiBEbyBub3QgY2hhbmdlIGJyYWNrZXRzIGFuZCBwYXJlbnRoZXNlcyBvciB7bn0nXSB9LFxuXHRcdFx0XHRcdFx0XCJSdW5uaW5nIGluIFJlc3RyaWN0ZWQgTW9kZVxcblxcblNvbWUgW2ZlYXR1cmVzIGFyZSBkaXNhYmxlZF0oezB9KSBiZWNhdXNlIHRoaXMgW3dpbmRvdyBpcyBub3QgdHJ1c3RlZF0oezF9KS5cIixcblx0XHRcdFx0XHRcdGBjb21tYW5kOiR7TElTVF9XT1JLU1BBQ0VfVU5TVVBQT1JURURfRVhURU5TSU9OU19DT01NQU5EX0lEfWAsXG5cdFx0XHRcdFx0XHRgY29tbWFuZDoke01BTkFHRV9UUlVTVF9DT01NQU5EX0lEfWBcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdGlzVHJ1c3RlZDogdHJ1ZSxcblx0XHRcdFx0XHRzdXBwb3J0VGhlbWVJY29uczogdHJ1ZVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGNhc2UgV29ya2JlbmNoU3RhdGUuRk9MREVSOiB7XG5cdFx0XHRcdGFyaWFMYWJlbCA9IGxvY2FsaXplKCdzdGF0dXMuYXJpYVVudHJ1c3RlZEZvbGRlcicsIFwiUmVzdHJpY3RlZCBNb2RlOiBTb21lIGZlYXR1cmVzIGFyZSBkaXNhYmxlZCBiZWNhdXNlIHRoaXMgZm9sZGVyIGlzIG5vdCB0cnVzdGVkLlwiKTtcblx0XHRcdFx0dG9vbFRpcCA9IHtcblx0XHRcdFx0XHR2YWx1ZTogbG9jYWxpemUoXG5cdFx0XHRcdFx0XHR7IGtleTogJ3N0YXR1cy50b29sdGlwVW50cnVzdGVkRm9sZGVyMicsIGNvbW1lbnQ6IFsnW2FiY10oe259KSBhcmUgbGlua3MuICBPbmx5IHRyYW5zbGF0ZSBgZmVhdHVyZXMgYXJlIGRpc2FibGVkYCBhbmQgYGZvbGRlciBpcyBub3QgdHJ1c3RlZGAuIERvIG5vdCBjaGFuZ2UgYnJhY2tldHMgYW5kIHBhcmVudGhlc2VzIG9yIHtufSddIH0sXG5cdFx0XHRcdFx0XHRcIlJ1bm5pbmcgaW4gUmVzdHJpY3RlZCBNb2RlXFxuXFxuU29tZSBbZmVhdHVyZXMgYXJlIGRpc2FibGVkXSh7MH0pIGJlY2F1c2UgdGhpcyBbZm9sZGVyIGlzIG5vdCB0cnVzdGVkXSh7MX0pLlwiLFxuXHRcdFx0XHRcdFx0YGNvbW1hbmQ6JHtMSVNUX1dPUktTUEFDRV9VTlNVUFBPUlRFRF9FWFRFTlNJT05TX0NPTU1BTkRfSUR9YCxcblx0XHRcdFx0XHRcdGBjb21tYW5kOiR7TUFOQUdFX1RSVVNUX0NPTU1BTkRfSUR9YFxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0aXNUcnVzdGVkOiB0cnVlLFxuXHRcdFx0XHRcdHN1cHBvcnRUaGVtZUljb25zOiB0cnVlXG5cdFx0XHRcdH07XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdFx0Y2FzZSBXb3JrYmVuY2hTdGF0ZS5XT1JLU1BBQ0U6IHtcblx0XHRcdFx0YXJpYUxhYmVsID0gbG9jYWxpemUoJ3N0YXR1cy5hcmlhVW50cnVzdGVkV29ya3NwYWNlJywgXCJSZXN0cmljdGVkIE1vZGU6IFNvbWUgZmVhdHVyZXMgYXJlIGRpc2FibGVkIGJlY2F1c2UgdGhpcyB3b3Jrc3BhY2UgaXMgbm90IHRydXN0ZWQuXCIpO1xuXHRcdFx0XHR0b29sVGlwID0ge1xuXHRcdFx0XHRcdHZhbHVlOiBsb2NhbGl6ZShcblx0XHRcdFx0XHRcdHsga2V5OiAnc3RhdHVzLnRvb2x0aXBVbnRydXN0ZWRXb3Jrc3BhY2UyJywgY29tbWVudDogWydbYWJjXSh7bn0pIGFyZSBsaW5rcy4gT25seSB0cmFuc2xhdGUgYGZlYXR1cmVzIGFyZSBkaXNhYmxlZGAgYW5kIGB3b3Jrc3BhY2UgaXMgbm90IHRydXN0ZWRgLiBEbyBub3QgY2hhbmdlIGJyYWNrZXRzIGFuZCBwYXJlbnRoZXNlcyBvciB7bn0nXSB9LFxuXHRcdFx0XHRcdFx0XCJSdW5uaW5nIGluIFJlc3RyaWN0ZWQgTW9kZVxcblxcblNvbWUgW2ZlYXR1cmVzIGFyZSBkaXNhYmxlZF0oezB9KSBiZWNhdXNlIHRoaXMgW3dvcmtzcGFjZSBpcyBub3QgdHJ1c3RlZF0oezF9KS5cIixcblx0XHRcdFx0XHRcdGBjb21tYW5kOiR7TElTVF9XT1JLU1BBQ0VfVU5TVVBQT1JURURfRVhURU5TSU9OU19DT01NQU5EX0lEfWAsXG5cdFx0XHRcdFx0XHRgY29tbWFuZDoke01BTkFHRV9UUlVTVF9DT01NQU5EX0lEfWBcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdGlzVHJ1c3RlZDogdHJ1ZSxcblx0XHRcdFx0XHRzdXBwb3J0VGhlbWVJY29uczogdHJ1ZVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZTogbG9jYWxpemUoJ3N0YXR1cy5Xb3Jrc3BhY2VUcnVzdCcsIFwiV29ya3NwYWNlIFRydXN0XCIpLFxuXHRcdFx0dGV4dDogYCQoc2hpZWxkKSAke2xvY2FsaXplKCd1bnRydXN0ZWQnLCBcIlJlc3RyaWN0ZWQgTW9kZVwiKX1gLFxuXHRcdFx0YXJpYUxhYmVsOiBhcmlhTGFiZWwsXG5cdFx0XHR0b29sdGlwOiB0b29sVGlwLFxuXHRcdFx0Y29tbWFuZDogTUFOQUdFX1RSVVNUX0NPTU1BTkRfSUQsXG5cdFx0XHRraW5kOiAncHJvbWluZW50J1xuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZVN0YXR1c2JhckVudHJ5KHRydXN0ZWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodHJ1c3RlZCAmJiB0aGlzLnN0YXR1c2JhckVudHJ5QWNjZXNzb3IudmFsdWUpIHtcblx0XHRcdHRoaXMuc3RhdHVzYmFyRW50cnlBY2Nlc3Nvci5jbGVhcigpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghdHJ1c3RlZCAmJiAhdGhpcy5zdGF0dXNiYXJFbnRyeUFjY2Vzc29yLnZhbHVlKSB7XG5cdFx0XHRjb25zdCBlbnRyeSA9IHRoaXMuZ2V0UmVzdHJpY3RlZE1vZGVTdGF0dXNiYXJFbnRyeSgpO1xuXHRcdFx0dGhpcy5zdGF0dXNiYXJFbnRyeUFjY2Vzc29yLnZhbHVlID0gdGhpcy5zdGF0dXNiYXJTZXJ2aWNlLmFkZEVudHJ5KGVudHJ5LCB0aGlzLmVudHJ5SWQsIFN0YXR1c2JhckFsaWdubWVudC5MRUZULCB7IGxvY2F0aW9uOiB7IGlkOiAnc3RhdHVzLmhvc3QnLCBwcmlvcml0eTogTnVtYmVyLlBPU0lUSVZFX0lORklOSVRZIH0sIGFsaWdubWVudDogU3RhdHVzYmFyQWxpZ25tZW50LlJJR0hUIH0pO1xuXHRcdH1cblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxufVxuXG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoV29ya3NwYWNlVHJ1c3RSZXF1ZXN0SGFuZGxlci5JRCwgV29ya3NwYWNlVHJ1c3RSZXF1ZXN0SGFuZGxlciwgV29ya2JlbmNoUGhhc2UuQmxvY2tSZXN0b3JlKTtcblJlZ2lzdHJ5LmFzPElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnk+KFdvcmtiZW5jaEV4dGVuc2lvbnMuV29ya2JlbmNoKS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihXb3Jrc3BhY2VUcnVzdFVYSGFuZGxlciwgTGlmZWN5Y2xlUGhhc2UuUmVzdG9yZWQpO1xuXG5cbi8qKlxuICogVHJ1c3RlZCBXb3Jrc3BhY2UgR1VJIEVkaXRvclxuICovXG5jbGFzcyBXb3Jrc3BhY2VUcnVzdEVkaXRvcklucHV0U2VyaWFsaXplciBpbXBsZW1lbnRzIElFZGl0b3JTZXJpYWxpemVyIHtcblxuXHRjYW5TZXJpYWxpemUoZWRpdG9ySW5wdXQ6IEVkaXRvcklucHV0KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRzZXJpYWxpemUoaW5wdXQ6IFdvcmtzcGFjZVRydXN0RWRpdG9ySW5wdXQpOiBzdHJpbmcge1xuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdGRlc2VyaWFsaXplKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpOiBXb3Jrc3BhY2VUcnVzdEVkaXRvcklucHV0IHtcblx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya3NwYWNlVHJ1c3RFZGl0b3JJbnB1dCk7XG5cdH1cbn1cblxuUmVnaXN0cnkuYXM8SUVkaXRvckZhY3RvcnlSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JGYWN0b3J5KVxuXHQucmVnaXN0ZXJFZGl0b3JTZXJpYWxpemVyKFdvcmtzcGFjZVRydXN0RWRpdG9ySW5wdXQuSUQsIFdvcmtzcGFjZVRydXN0RWRpdG9ySW5wdXRTZXJpYWxpemVyKTtcblxuUmVnaXN0cnkuYXM8SUVkaXRvclBhbmVSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JQYW5lKS5yZWdpc3RlckVkaXRvclBhbmUoXG5cdEVkaXRvclBhbmVEZXNjcmlwdG9yLmNyZWF0ZShcblx0XHRXb3Jrc3BhY2VUcnVzdEVkaXRvcixcblx0XHRXb3Jrc3BhY2VUcnVzdEVkaXRvci5JRCxcblx0XHRsb2NhbGl6ZSgnd29ya3NwYWNlVHJ1c3RFZGl0b3InLCBcIldvcmtzcGFjZSBUcnVzdCBFZGl0b3JcIilcblx0KSxcblx0W1xuXHRcdG5ldyBTeW5jRGVzY3JpcHRvcihXb3Jrc3BhY2VUcnVzdEVkaXRvcklucHV0KVxuXHRdXG4pO1xuXG5cbi8qXG4gKiBBY3Rpb25zXG4gKi9cblxuLy8gQ29uZmlndXJlIFdvcmtzcGFjZSBUcnVzdCBTZXR0aW5nc1xuXG5jb25zdCBDT05GSUdVUkVfVFJVU1RfQ09NTUFORF9JRCA9ICd3b3JrYmVuY2gudHJ1c3QuY29uZmlndXJlJztcbmNvbnN0IFdPUktTUEFDRVNfQ0FURUdPUlkgPSBsb2NhbGl6ZTIoJ3dvcmtzcGFjZXNDYXRlZ29yeScsICdXb3Jrc3BhY2VzJyk7XG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogQ09ORklHVVJFX1RSVVNUX0NPTU1BTkRfSUQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdjb25maWd1cmVXb3Jrc3BhY2VUcnVzdFNldHRpbmdzJywgXCJDb25maWd1cmUgV29ya3NwYWNlIFRydXN0IFNldHRpbmdzXCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoV29ya3NwYWNlVHJ1c3RDb250ZXh0LklzRW5hYmxlZCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKGBjb25maWcuJHtXT1JLU1BBQ0VfVFJVU1RfRU5BQkxFRH1gLCB0cnVlKSksXG5cdFx0XHRjYXRlZ29yeTogV09SS1NQQUNFU19DQVRFR09SWSxcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRhY2Nlc3Nvci5nZXQoSVByZWZlcmVuY2VzU2VydmljZSkub3BlblVzZXJTZXR0aW5ncyh7IGpzb25FZGl0b3I6IGZhbHNlLCBxdWVyeTogYEB0YWc6JHtXT1JLU1BBQ0VfVFJVU1RfU0VUVElOR19UQUd9YCB9KTtcblx0fVxufSk7XG5cbi8vIE1hbmFnZSBXb3Jrc3BhY2UgVHJ1c3RcblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiBNQU5BR0VfVFJVU1RfQ09NTUFORF9JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ21hbmFnZVdvcmtzcGFjZVRydXN0JywgXCJNYW5hZ2UgV29ya3NwYWNlIFRydXN0XCIpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQoV29ya3NwYWNlVHJ1c3RDb250ZXh0LklzRW5hYmxlZCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKGBjb25maWcuJHtXT1JLU1BBQ0VfVFJVU1RfRU5BQkxFRH1gLCB0cnVlKSksXG5cdFx0XHRjYXRlZ29yeTogV09SS1NQQUNFU19DQVRFR09SWSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGlucHV0ID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya3NwYWNlVHJ1c3RFZGl0b3JJbnB1dCk7XG5cblx0XHRlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQsIHsgcGlubmVkOiB0cnVlIH0pO1xuXHRcdHJldHVybjtcblx0fVxufSk7XG5cblxuLypcbiAqIENvbmZpZ3VyYXRpb25cbiAqL1xuUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbilcblx0LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdFx0Li4uc2VjdXJpdHlDb25maWd1cmF0aW9uTm9kZUJhc2UsXG5cdFx0cHJvcGVydGllczoge1xuXHRcdFx0W1dPUktTUEFDRV9UUlVTVF9FTkFCTEVEXToge1xuXHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnd29ya3NwYWNlLnRydXN0LmRlc2NyaXB0aW9uJywgXCJDb250cm9scyB3aGV0aGVyIG9yIG5vdCBXb3Jrc3BhY2UgVHJ1c3QgaXMgZW5hYmxlZCB3aXRoaW4gVlMgQ29kZS5cIiksXG5cdFx0XHRcdHRhZ3M6IFtXT1JLU1BBQ0VfVFJVU1RfU0VUVElOR19UQUddLFxuXHRcdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OLFxuXHRcdFx0fSxcblx0XHRcdFtXT1JLU1BBQ0VfVFJVU1RfU1RBUlRVUF9QUk9NUFRdOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRkZWZhdWx0OiAnb25jZScsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnd29ya3NwYWNlLnRydXN0LnN0YXJ0dXBQcm9tcHQuZGVzY3JpcHRpb24nLCBcIkNvbnRyb2xzIHdoZW4gdGhlIHN0YXJ0dXAgcHJvbXB0IHRvIHRydXN0IGEgd29ya3NwYWNlIGlzIHNob3duLlwiKSxcblx0XHRcdFx0dGFnczogW1dPUktTUEFDRV9UUlVTVF9TRVRUSU5HX1RBR10sXG5cdFx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT04sXG5cdFx0XHRcdGVudW06IFsnYWx3YXlzJywgJ29uY2UnLCAnbmV2ZXInXSxcblx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3Jrc3BhY2UudHJ1c3Quc3RhcnR1cFByb21wdC5hbHdheXMnLCBcIkFzayBmb3IgdHJ1c3QgZXZlcnkgdGltZSBhbiB1bnRydXN0ZWQgd29ya3NwYWNlIGlzIG9wZW5lZC5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtzcGFjZS50cnVzdC5zdGFydHVwUHJvbXB0Lm9uY2UnLCBcIkFzayBmb3IgdHJ1c3QgdGhlIGZpcnN0IHRpbWUgYW4gdW50cnVzdGVkIHdvcmtzcGFjZSBpcyBvcGVuZWQuXCIpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3Jrc3BhY2UudHJ1c3Quc3RhcnR1cFByb21wdC5uZXZlcicsIFwiRG8gbm90IGFzayBmb3IgdHJ1c3Qgd2hlbiBhbiB1bnRydXN0ZWQgd29ya3NwYWNlIGlzIG9wZW5lZC5cIiksXG5cdFx0XHRcdF1cblx0XHRcdH0sXG5cdFx0XHRbV09SS1NQQUNFX1RSVVNUX0JBTk5FUl06IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGRlZmF1bHQ6ICd1bnRpbERpc21pc3NlZCcsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnd29ya3NwYWNlLnRydXN0LmJhbm5lci5kZXNjcmlwdGlvbicsIFwiQ29udHJvbHMgd2hlbiB0aGUgcmVzdHJpY3RlZCBtb2RlIGJhbm5lciBpcyBzaG93bi5cIiksXG5cdFx0XHRcdHRhZ3M6IFtXT1JLU1BBQ0VfVFJVU1RfU0VUVElOR19UQUddLFxuXHRcdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OLFxuXHRcdFx0XHRlbnVtOiBbJ2Fsd2F5cycsICd1bnRpbERpc21pc3NlZCcsICduZXZlciddLFxuXHRcdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3dvcmtzcGFjZS50cnVzdC5iYW5uZXIuYWx3YXlzJywgXCJTaG93IHRoZSBiYW5uZXIgZXZlcnkgdGltZSBhbiB1bnRydXN0ZWQgd29ya3NwYWNlIGlzIG9wZW4uXCIpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3Jrc3BhY2UudHJ1c3QuYmFubmVyLnVudGlsRGlzbWlzc2VkJywgXCJTaG93IHRoZSBiYW5uZXIgd2hlbiBhbiB1bnRydXN0ZWQgd29ya3NwYWNlIGlzIG9wZW5lZCB1bnRpbCBkaXNtaXNzZWQuXCIpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCd3b3Jrc3BhY2UudHJ1c3QuYmFubmVyLm5ldmVyJywgXCJEbyBub3Qgc2hvdyB0aGUgYmFubmVyIHdoZW4gYW4gdW50cnVzdGVkIHdvcmtzcGFjZSBpcyBvcGVuLlwiKSxcblx0XHRcdFx0XVxuXHRcdFx0fSxcblx0XHRcdFtXT1JLU1BBQ0VfVFJVU1RfVU5UUlVTVEVEX0ZJTEVTXToge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0ZGVmYXVsdDogJ3Byb21wdCcsXG5cdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd3b3Jrc3BhY2UudHJ1c3QudW50cnVzdGVkRmlsZXMuZGVzY3JpcHRpb24nLCBcIkNvbnRyb2xzIGhvdyB0byBoYW5kbGUgb3BlbmluZyB1bnRydXN0ZWQgZmlsZXMgaW4gYSB0cnVzdGVkIHdvcmtzcGFjZS4gVGhpcyBzZXR0aW5nIGFsc28gYXBwbGllcyB0byBvcGVuaW5nIGZpbGVzIGluIGFuIGVtcHR5IHdpbmRvdyB3aGljaCBpcyB0cnVzdGVkIHZpYSBgI3swfSNgLlwiLCBXT1JLU1BBQ0VfVFJVU1RfRU1QVFlfV0lORE9XKSxcblx0XHRcdFx0dGFnczogW1dPUktTUEFDRV9UUlVTVF9TRVRUSU5HX1RBR10sXG5cdFx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT04sXG5cdFx0XHRcdGVudW06IFsncHJvbXB0JywgJ29wZW4nLCAnbmV3V2luZG93J10sXG5cdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd29ya3NwYWNlLnRydXN0LnVudHJ1c3RlZEZpbGVzLnByb21wdCcsIFwiQXNrIGhvdyB0byBoYW5kbGUgdW50cnVzdGVkIGZpbGVzIGZvciBlYWNoIHdvcmtzcGFjZS4gT25jZSB1bnRydXN0ZWQgZmlsZXMgYXJlIGludHJvZHVjZWQgdG8gYSB0cnVzdGVkIHdvcmtzcGFjZSwgeW91IHdpbGwgbm90IGJlIHByb21wdGVkIGFnYWluLlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd29ya3NwYWNlLnRydXN0LnVudHJ1c3RlZEZpbGVzLm9wZW4nLCBcIkFsd2F5cyBhbGxvdyB1bnRydXN0ZWQgZmlsZXMgdG8gYmUgaW50cm9kdWNlZCB0byBhIHRydXN0ZWQgd29ya3NwYWNlIHdpdGhvdXQgcHJvbXB0aW5nLlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnd29ya3NwYWNlLnRydXN0LnVudHJ1c3RlZEZpbGVzLm5ld1dpbmRvdycsIFwiQWx3YXlzIG9wZW4gdW50cnVzdGVkIGZpbGVzIGluIGEgc2VwYXJhdGUgd2luZG93IGluIHJlc3RyaWN0ZWQgbW9kZSB3aXRob3V0IHByb21wdGluZy5cIiksXG5cdFx0XHRcdF1cblx0XHRcdH0sXG5cdFx0XHRbV09SS1NQQUNFX1RSVVNUX0VNUFRZX1dJTkRPV106IHtcblx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnd29ya3NwYWNlLnRydXN0LmVtcHR5V2luZG93LmRlc2NyaXB0aW9uJywgXCJDb250cm9scyB3aGV0aGVyIG9yIG5vdCB0aGUgZW1wdHkgd2luZG93IGlzIHRydXN0ZWQgYnkgZGVmYXVsdCB3aXRoaW4gVlMgQ29kZS4gV2hlbiB1c2VkIHdpdGggYCN7MH0jYCwgeW91IGNhbiBlbmFibGUgdGhlIGZ1bGwgZnVuY3Rpb25hbGl0eSBvZiBWUyBDb2RlIHdpdGhvdXQgcHJvbXB0aW5nIGluIGFuIGVtcHR5IHdpbmRvdy5cIiwgV09SS1NQQUNFX1RSVVNUX1VOVFJVU1RFRF9GSUxFUyksXG5cdFx0XHRcdHRhZ3M6IFtXT1JLU1BBQ0VfVFJVU1RfU0VUVElOR19UQUddLFxuXHRcdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OXG5cdFx0XHR9XG5cdFx0fVxuXHR9KTtcblxuY2xhc3MgV29ya3NwYWNlVHJ1c3RUZWxlbWV0cnlDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlVHJ1c3RFbmFibGVtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZVRydXN0RW5hYmxlbWVudFNlcnZpY2U6IElXb3Jrc3BhY2VUcnVzdEVuYWJsZW1lbnRTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2U6IElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLndvcmtzcGFjZVRydXN0SW5pdGlhbGl6ZWRcblx0XHRcdC50aGVuKCgpID0+IHtcblx0XHRcdFx0dGhpcy5sb2dJbml0aWFsV29ya3NwYWNlVHJ1c3RJbmZvKCk7XG5cdFx0XHRcdHRoaXMubG9nV29ya3NwYWNlVHJ1c3QodGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLmlzV29ya3NwYWNlVHJ1c3RlZCgpKTtcblxuXHRcdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLndvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2Uub25EaWRDaGFuZ2VUcnVzdChpc1RydXN0ZWQgPT4gdGhpcy5sb2dXb3Jrc3BhY2VUcnVzdChpc1RydXN0ZWQpKSk7XG5cdFx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgbG9nSW5pdGlhbFdvcmtzcGFjZVRydXN0SW5mbygpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMud29ya3NwYWNlVHJ1c3RFbmFibGVtZW50U2VydmljZS5pc1dvcmtzcGFjZVRydXN0RW5hYmxlZCgpKSB7XG5cdFx0XHRjb25zdCBkaXNhYmxlZEJ5Q2xpRmxhZyA9IHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLmRpc2FibGVXb3Jrc3BhY2VUcnVzdDtcblxuXHRcdFx0dHlwZSBXb3Jrc3BhY2VUcnVzdERpc2FibGVkRXZlbnRDbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdFx0b3duZXI6ICdzYmF0dGVuJztcblx0XHRcdFx0Y29tbWVudDogJ0xvZ2dlZCB3aGVuIHdvcmtzcGFjZSB0cnVzdCBpcyBkaXNhYmxlZCc7XG5cdFx0XHRcdHJlYXNvbjogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSByZWFzb24gd29ya3NwYWNlIHRydXN0IGlzIGRpc2FibGVkLiBlLmcuIGNsaSBvciBzZXR0aW5nJyB9O1xuXHRcdFx0fTtcblxuXHRcdFx0dHlwZSBXb3Jrc3BhY2VUcnVzdERpc2FibGVkRXZlbnQgPSB7XG5cdFx0XHRcdHJlYXNvbjogJ3NldHRpbmcnIHwgJ2NsaSc7XG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxXb3Jrc3BhY2VUcnVzdERpc2FibGVkRXZlbnQsIFdvcmtzcGFjZVRydXN0RGlzYWJsZWRFdmVudENsYXNzaWZpY2F0aW9uPignd29ya3NwYWNlVHJ1c3REaXNhYmxlZCcsIHtcblx0XHRcdFx0cmVhc29uOiBkaXNhYmxlZEJ5Q2xpRmxhZyA/ICdjbGknIDogJ3NldHRpbmcnXG5cdFx0XHR9KTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0eXBlIFdvcmtzcGFjZVRydXN0SW5mb0V2ZW50Q2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRvd25lcjogJ3NiYXR0ZW4nO1xuXHRcdFx0Y29tbWVudDogJ0luZm9ybWF0aW9uIGFib3V0IHRoZSB3b3Jrc3BhY2VzIHRydXN0ZWQgb24gdGhlIG1hY2hpbmUnO1xuXHRcdFx0dHJ1c3RlZEZvbGRlcnNDb3VudDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBudW1iZXIgb2YgdHJ1c3RlZCBmb2xkZXJzIG9uIHRoZSBtYWNoaW5lJyB9O1xuXHRcdH07XG5cblx0XHR0eXBlIFdvcmtzcGFjZVRydXN0SW5mb0V2ZW50ID0ge1xuXHRcdFx0dHJ1c3RlZEZvbGRlcnNDb3VudDogbnVtYmVyO1xuXHRcdH07XG5cblx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxXb3Jrc3BhY2VUcnVzdEluZm9FdmVudCwgV29ya3NwYWNlVHJ1c3RJbmZvRXZlbnRDbGFzc2lmaWNhdGlvbj4oJ3dvcmtzcGFjZVRydXN0Rm9sZGVyQ291bnRzJywge1xuXHRcdFx0dHJ1c3RlZEZvbGRlcnNDb3VudDogdGhpcy53b3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLmdldFRydXN0ZWRVcmlzKCkubGVuZ3RoLFxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBsb2dXb3Jrc3BhY2VUcnVzdChpc1RydXN0ZWQ6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAoIXRoaXMud29ya3NwYWNlVHJ1c3RFbmFibGVtZW50U2VydmljZS5pc1dvcmtzcGFjZVRydXN0RW5hYmxlZCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dHlwZSBXb3Jrc3BhY2VUcnVzdFN0YXRlQ2hhbmdlZEV2ZW50ID0ge1xuXHRcdFx0d29ya3NwYWNlSWQ6IHN0cmluZztcblx0XHRcdGlzVHJ1c3RlZDogYm9vbGVhbjtcblx0XHR9O1xuXG5cdFx0dHlwZSBXb3Jrc3BhY2VUcnVzdFN0YXRlQ2hhbmdlZEV2ZW50Q2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRvd25lcjogJ3NiYXR0ZW4nO1xuXHRcdFx0Y29tbWVudDogJ0xvZ2dlZCB3aGVuIHRoZSB3b3Jrc3BhY2UgdHJhbnNpdGlvbnMgYmV0d2VlbiB0cnVzdGVkIGFuZCByZXN0cmljdGVkIG1vZGVzJztcblx0XHRcdHdvcmtzcGFjZUlkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnQW4gaWQgb2YgdGhlIHdvcmtzcGFjZScgfTtcblx0XHRcdGlzVHJ1c3RlZDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ3RydWUgaWYgdGhlIHdvcmtzcGFjZSBpcyB0cnVzdGVkJyB9O1xuXHRcdH07XG5cblx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxXb3Jrc3BhY2VUcnVzdFN0YXRlQ2hhbmdlZEV2ZW50LCBXb3Jrc3BhY2VUcnVzdFN0YXRlQ2hhbmdlZEV2ZW50Q2xhc3NpZmljYXRpb24+KCd3b3Jrc3BhY2VUcnVzdFN0YXRlQ2hhbmdlZCcsIHtcblx0XHRcdHdvcmtzcGFjZUlkOiB0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmlkLFxuXHRcdFx0aXNUcnVzdGVkOiBpc1RydXN0ZWRcblx0XHR9KTtcblxuXHRcdGlmIChpc1RydXN0ZWQpIHtcblx0XHRcdHR5cGUgV29ya3NwYWNlVHJ1c3RGb2xkZXJJbmZvRXZlbnRDbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdFx0b3duZXI6ICdzYmF0dGVuJztcblx0XHRcdFx0Y29tbWVudDogJ1NvbWUgbWV0cmljcyBvbiB0aGUgdHJ1c3RlZCB3b3Jrc3BhY2VzIGZvbGRlciBzdHJ1Y3R1cmUnO1xuXHRcdFx0XHR0cnVzdGVkRm9sZGVyRGVwdGg6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgbnVtYmVyIG9mIGRpcmVjdG9yaWVzIGRlZXAgb2YgdGhlIHRydXN0ZWQgcGF0aCcgfTtcblx0XHRcdFx0d29ya3NwYWNlRm9sZGVyRGVwdGg6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgbnVtYmVyIG9mIGRpcmVjdG9yaWVzIGRlZXAgb2YgdGhlIHdvcmtzcGFjZSBwYXRoJyB9O1xuXHRcdFx0XHRkZWx0YTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBkaWZmZXJlbmNlIGJldHdlZW4gdGhlIHRydXN0ZWQgcGF0aCBhbmQgdGhlIHdvcmtzcGFjZSBwYXRoIGRpcmVjdG9yaWVzIGRlcHRoJyB9O1xuXHRcdFx0fTtcblxuXHRcdFx0dHlwZSBXb3Jrc3BhY2VUcnVzdEZvbGRlckluZm9FdmVudCA9IHtcblx0XHRcdFx0dHJ1c3RlZEZvbGRlckRlcHRoOiBudW1iZXI7XG5cdFx0XHRcdHdvcmtzcGFjZUZvbGRlckRlcHRoOiBudW1iZXI7XG5cdFx0XHRcdGRlbHRhOiBudW1iZXI7XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBnZXREZXB0aCA9IChmb2xkZXI6IHN0cmluZyk6IG51bWJlciA9PiB7XG5cdFx0XHRcdGxldCByZXNvbHZlZFBhdGggPSByZXNvbHZlKGZvbGRlcik7XG5cblx0XHRcdFx0bGV0IGRlcHRoID0gMDtcblx0XHRcdFx0d2hpbGUgKGRpcm5hbWUocmVzb2x2ZWRQYXRoKSAhPT0gcmVzb2x2ZWRQYXRoICYmIGRlcHRoIDwgMTAwKSB7XG5cdFx0XHRcdFx0cmVzb2x2ZWRQYXRoID0gZGlybmFtZShyZXNvbHZlZFBhdGgpO1xuXHRcdFx0XHRcdGRlcHRoKys7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gZGVwdGg7XG5cdFx0XHR9O1xuXG5cdFx0XHRmb3IgKGNvbnN0IGZvbGRlciBvZiB0aGlzLndvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnMpIHtcblx0XHRcdFx0Y29uc3QgeyB0cnVzdGVkLCB1cmkgfSA9IGF3YWl0IHRoaXMud29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZS5nZXRVcmlUcnVzdEluZm8oZm9sZGVyLnVyaSk7XG5cdFx0XHRcdGlmICghdHJ1c3RlZCkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgd29ya3NwYWNlRm9sZGVyRGVwdGggPSBnZXREZXB0aChmb2xkZXIudXJpLmZzUGF0aCk7XG5cdFx0XHRcdGNvbnN0IHRydXN0ZWRGb2xkZXJEZXB0aCA9IGdldERlcHRoKHVyaS5mc1BhdGgpO1xuXHRcdFx0XHRjb25zdCBkZWx0YSA9IHdvcmtzcGFjZUZvbGRlckRlcHRoIC0gdHJ1c3RlZEZvbGRlckRlcHRoO1xuXG5cdFx0XHRcdHRoaXMudGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFdvcmtzcGFjZVRydXN0Rm9sZGVySW5mb0V2ZW50LCBXb3Jrc3BhY2VUcnVzdEZvbGRlckluZm9FdmVudENsYXNzaWZpY2F0aW9uPignd29ya3NwYWNlRm9sZGVyRGVwdGhCZWxvd1RydXN0ZWRGb2xkZXInLCB7IHdvcmtzcGFjZUZvbGRlckRlcHRoLCB0cnVzdGVkRm9sZGVyRGVwdGgsIGRlbHRhIH0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5SZWdpc3RyeS5hczxJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5PihXb3JrYmVuY2hFeHRlbnNpb25zLldvcmtiZW5jaClcblx0LnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uKFdvcmtzcGFjZVRydXN0VGVsZW1ldHJ5Q29udHJpYnV0aW9uLCBMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLE9BQU87QUFDUCxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFlBQVkseUJBQXlCO0FBQzlDLFNBQVMsVUFBVSxpQkFBaUI7QUFDcEMsU0FBUyxTQUFTLHVCQUF1QjtBQUN6QyxTQUFTLG9CQUFvQixjQUFjLCtCQUF1RDtBQUNsRyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDZCQUErQztBQUN4RCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGtDQUFrQyxrQ0FBa0MsK0JBQStCLGlDQUFpQztBQUM3SSxTQUFTLGNBQWMscUJBQThFLGdCQUFnQixzQ0FBc0M7QUFDM0osU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZ0JBQTZCLDBCQUEwQjtBQUNoRSxTQUFTLHVCQUF1QjtBQUNoQyxTQUFtRCxtQkFBbUIsMEJBQTBCO0FBQ2hHLFNBQThCLDRCQUE0QjtBQUMxRCxTQUFTLFlBQVksNEJBQTRCO0FBQ2pELFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsd0JBQXdCLDhCQUE4Qix5QkFBeUIsZ0NBQWdDLHVDQUF1QztBQUMvSixTQUFvRCx3QkFBd0I7QUFFNUUsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyw0QkFBOEQsbUNBQW1DLDBCQUE0RCx1QkFBdUIsc0JBQXNCO0FBQ25OLFNBQVMsU0FBUyxlQUFlO0FBQ2pDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQTBCLHNCQUFzQjtBQUNoRCxTQUFTLGlCQUFpQixjQUFjLHFCQUFxQjtBQUM3RCxTQUFTLG9CQUFvQjtBQUM3QixTQUFzQixzQkFBc0I7QUFDNUMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx3REFBd0Q7QUFDakUs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
