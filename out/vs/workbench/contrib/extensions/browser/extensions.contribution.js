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
import { localize, localize2 } from "../../../../nls.js";
import { KeyMod, KeyCode } from "../../../../base/common/keyCodes.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { MenuRegistry, MenuId, registerAction2, Action2 } from "../../../../platform/actions/common/actions.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { ExtensionsLocalizedLabel, IExtensionManagementService, IExtensionGalleryService, PreferencesLocalizedLabel, EXTENSION_INSTALL_SOURCE_CONTEXT, ExtensionInstallSource, UseUnpkgResourceApiConfigKey, AllowedExtensionsConfigKey, SortBy, FilterType } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { EnablementState, IExtensionManagementServerService, IWorkbenchExtensionEnablementService, IWorkbenchExtensionManagementService } from "../../../services/extensionManagement/common/extensionManagement.js";
import { IExtensionIgnoredRecommendationsService, IExtensionRecommendationsService } from "../../../services/extensionRecommendations/common/extensionRecommendations.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { VIEWLET_ID, IExtensionsWorkbenchService, TOGGLE_IGNORE_EXTENSION_ACTION_ID, INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID, WORKSPACE_RECOMMENDATIONS_VIEW_ID, AutoUpdateConfigurationKey, HasOutdatedExtensionsContext, SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID, LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID, THEME_ACTIONS_GROUP, INSTALL_ACTIONS_GROUP, OUTDATED_EXTENSIONS_VIEW_ID, CONTEXT_HAS_GALLERY, extensionsSearchActionsMenu, UPDATE_ACTIONS_GROUP, ExtensionRuntimeActionType, EXTENSIONS_CATEGORY, AutoRestartConfigurationKey } from "../common/extensions.js";
import { InstallSpecificVersionOfExtensionAction, ConfigureWorkspaceRecommendedExtensionsAction, ConfigureWorkspaceFolderRecommendedExtensionsAction, SetColorThemeAction, SetFileIconThemeAction, SetProductIconThemeAction, ClearLanguageAction, ToggleAutoUpdateForExtensionAction, ToggleAutoUpdatesForPublisherAction, TogglePreReleaseExtensionAction, InstallAnotherVersionAction, InstallAction } from "./extensionsActions.js";
import { ExtensionsInput } from "../common/extensionsInput.js";
import { ExtensionEditor } from "./extensionEditor.js";
import { StatusUpdater, MaliciousExtensionChecker, ExtensionsViewletViewsContribution, ExtensionsViewPaneContainer, BuiltInExtensionsContext, SearchMarketplaceExtensionsContext, RecommendedExtensionsContext, DefaultViewsContext, ExtensionsSortByContext, SearchHasTextContext, ExtensionsSearchValueContext } from "./extensionsViewlet.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope } from "../../../../platform/configuration/common/configurationRegistry.js";
import * as jsonContributionRegistry from "../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { ExtensionsConfigurationSchema, ExtensionsConfigurationSchemaId } from "../common/extensionsFileTemplate.js";
import { CommandsRegistry, ICommandService } from "../../../../platform/commands/common/commands.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { KeymapExtensions } from "../common/extensionsUtils.js";
import { areSameExtensions, getIdAndVersion } from "../../../../platform/extensionManagement/common/extensionManagementUtil.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { URI } from "../../../../base/common/uri.js";
import { ExtensionActivationProgress } from "./extensionsActivationProgress.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { ExtensionDependencyChecker } from "./extensionsDependencyChecker.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { ViewContainerLocation, Extensions as ViewContainerExtensions } from "../../../common/views.js";
import { IViewsService } from "../../../services/views/common/viewsService.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { Extensions } from "../../../../platform/quickinput/common/quickAccess.js";
import { InstallExtensionQuickAccessProvider, ManageExtensionsQuickAccessProvider } from "./extensionsQuickAccess.js";
import { ExtensionRecommendationsService } from "./extensionRecommendationsService.js";
import { CONTEXT_SYNC_ENABLEMENT } from "../../../services/userDataSync/common/userDataSync.js";
import { CopyAction, CutAction, PasteAction } from "../../../../editor/contrib/clipboard/browser/clipboard.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ExtensionsWorkbenchService } from "./extensionsWorkbenchService.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { IExtensionRecommendationNotificationService } from "../../../../platform/extensionRecommendations/common/extensionRecommendations.js";
import { ExtensionRecommendationNotificationService } from "./extensionRecommendationNotificationService.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { ResourceContextKey, WorkbenchStateContext } from "../../../common/contextkeys.js";
import { IWorkspaceExtensionsConfigService } from "../../../services/extensionRecommendations/common/workspaceExtensionsConfig.js";
import { Schemas } from "../../../../base/common/network.js";
import { ShowRuntimeExtensionsAction } from "./abstractRuntimeExtensionsEditor.js";
import { ExtensionEnablementWorkspaceTrustTransitionParticipant } from "./extensionEnablementWorkspaceTrustTransitionParticipant.js";
import { clearSearchResultsIcon, configureRecommendedIcon, extensionsViewIcon, filterIcon, installWorkspaceRecommendedIcon, refreshIcon } from "./extensionsIcons.js";
import { EXTENSION_CATEGORIES, ExtensionType } from "../../../../platform/extensions/common/extensions.js";
import { Disposable, DisposableStore, isDisposable } from "../../../../base/common/lifecycle.js";
import { IDialogService, IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { mnemonicButtonLabel } from "../../../../base/common/labels.js";
import { Query } from "../common/extensionQuery.js";
import { EditorExtensions } from "../../../common/editor.js";
import { WORKSPACE_TRUST_EXTENSION_SUPPORT } from "../../../services/workspaces/common/workspaceTrust.js";
import { ExtensionsCompletionItemsProvider } from "./extensionsCompletionItemsProvider.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { Event } from "../../../../base/common/event.js";
import { UnsupportedExtensionsMigrationContrib } from "./unsupportedExtensionsMigrationContribution.js";
import { isNative, isWeb } from "../../../../base/common/platform.js";
import { ExtensionStorageService } from "../../../../platform/extensionManagement/common/extensionStorage.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { CONTEXT_KEYBINDINGS_EDITOR } from "../../preferences/common/preferences.js";
import { ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { Extensions as ConfigurationMigrationExtensions } from "../../../common/configuration.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IUserDataProfilesService } from "../../../../platform/userDataProfile/common/userDataProfile.js";
import product from "../../../../platform/product/common/product.js";
import { ExtensionGalleryResourceType, ExtensionGalleryServiceUrlConfigKey, getExtensionGalleryManifestResourceUri, IExtensionGalleryManifestService } from "../../../../platform/extensionManagement/common/extensionGalleryManifest.js";
registerSingleton(
  IExtensionsWorkbenchService,
  ExtensionsWorkbenchService,
  InstantiationType.Eager
  /* Auto updates extensions */
);
registerSingleton(IExtensionRecommendationNotificationService, ExtensionRecommendationNotificationService, InstantiationType.Delayed);
registerSingleton(
  IExtensionRecommendationsService,
  ExtensionRecommendationsService,
  InstantiationType.Eager
  /* Prompts recommendations in the background */
);
Registry.as(Extensions.Quickaccess).registerQuickAccessProvider({
  ctor: ManageExtensionsQuickAccessProvider,
  prefix: ManageExtensionsQuickAccessProvider.PREFIX,
  placeholder: localize("manageExtensionsQuickAccessPlaceholder", "Press Enter to manage extensions."),
  helpEntries: [{ description: localize("manageExtensionsHelp", "Manage Extensions") }]
});
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    ExtensionEditor,
    ExtensionEditor.ID,
    localize("extension", "Extension")
  ),
  [
    new SyncDescriptor(ExtensionsInput)
  ]
);
Registry.as(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer(
  {
    id: VIEWLET_ID,
    title: localize2("extensions", "Extensions"),
    openCommandActionDescriptor: {
      id: VIEWLET_ID,
      mnemonicTitle: localize({ key: "miViewExtensions", comment: ["&& denotes a mnemonic"] }, "E&&xtensions"),
      keybindings: { primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyX },
      order: 4
    },
    ctorDescriptor: new SyncDescriptor(ExtensionsViewPaneContainer),
    icon: extensionsViewIcon,
    order: 4,
    rejectAddedViews: true,
    alwaysUseContainerInfo: true,
    hideByDefault: true,
    hideIfEmpty: true
  },
  ViewContainerLocation.Sidebar
);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  id: "extensions",
  order: 30,
  title: localize("extensionsConfigurationTitle", "Extensions"),
  type: "object",
  properties: {
    "extensions.autoUpdate": {
      enum: [true, "onlyEnabledExtensions", false],
      enumItemLabels: [
        localize("all", "All Extensions"),
        localize("enabled", "Only Enabled Extensions"),
        localize("none", "None")
      ],
      enumDescriptions: [
        localize("extensions.autoUpdate.true", "Download and install updates automatically for all extensions."),
        localize("extensions.autoUpdate.enabled", "Download and install updates automatically only for enabled extensions."),
        localize("extensions.autoUpdate.false", "Extensions are not automatically updated.")
      ],
      description: localize("extensions.autoUpdate", "Controls the automatic update behavior of extensions. The updates are fetched from a Microsoft online service."),
      default: true,
      scope: ConfigurationScope.APPLICATION,
      tags: ["usesOnlineServices"]
    },
    "extensions.autoCheckUpdates": {
      type: "boolean",
      description: localize("extensionsCheckUpdates", "When enabled, automatically checks extensions for updates. If an extension has an update, it is marked as outdated in the Extensions view. The updates are fetched from a Microsoft online service."),
      default: true,
      scope: ConfigurationScope.APPLICATION,
      tags: ["usesOnlineServices"]
    },
    "extensions.ignoreRecommendations": {
      type: "boolean",
      description: localize("extensionsIgnoreRecommendations", "When enabled, the notifications for extension recommendations will not be shown."),
      default: false
    },
    "extensions.showRecommendationsOnlyOnDemand": {
      type: "boolean",
      deprecationMessage: localize("extensionsShowRecommendationsOnlyOnDemand_Deprecated", "This setting is deprecated. Use extensions.ignoreRecommendations setting to control recommendation notifications. Use Extensions view's visibility actions to hide Recommended view by default."),
      default: false,
      tags: ["usesOnlineServices"]
    },
    "extensions.closeExtensionDetailsOnViewChange": {
      type: "boolean",
      description: localize("extensionsCloseExtensionDetailsOnViewChange", "When enabled, editors with extension details will be automatically closed upon navigating away from the Extensions View."),
      default: false
    },
    "extensions.confirmedUriHandlerExtensionIds": {
      type: "array",
      items: {
        type: "string"
      },
      description: localize("handleUriConfirmedExtensions", "When an extension is listed here, a confirmation prompt will not be shown when that extension handles a URI."),
      default: [],
      scope: ConfigurationScope.APPLICATION
    },
    "extensions.webWorker": {
      type: ["boolean", "string"],
      enum: [true, false, "auto"],
      enumDescriptions: [
        localize("extensionsWebWorker.true", "The Web Worker Extension Host will always be launched."),
        localize("extensionsWebWorker.false", "The Web Worker Extension Host will never be launched."),
        localize("extensionsWebWorker.auto", "The Web Worker Extension Host will be launched when a web extension needs it.")
      ],
      description: localize("extensionsWebWorker", "Enable web worker extension host."),
      default: "auto"
    },
    "extensions.supportVirtualWorkspaces": {
      type: "object",
      markdownDescription: localize("extensions.supportVirtualWorkspaces", "Override the virtual workspaces support of an extension."),
      patternProperties: {
        "([a-z0-9A-Z][a-z0-9-A-Z]*)\\.([a-z0-9A-Z][a-z0-9-A-Z]*)$": {
          type: "boolean",
          default: false
        }
      },
      additionalProperties: false,
      default: {},
      defaultSnippets: [{
        "body": {
          "pub.name": false
        }
      }]
    },
    "extensions.experimental.affinity": {
      type: "object",
      markdownDescription: localize("extensions.affinity", "Configure an extension to execute in a different extension host process."),
      patternProperties: {
        "([a-z0-9A-Z][a-z0-9-A-Z]*)\\.([a-z0-9A-Z][a-z0-9-A-Z]*)$": {
          type: "integer",
          default: 1
        }
      },
      additionalProperties: false,
      default: {},
      defaultSnippets: [{
        "body": {
          "pub.name": 1
        }
      }]
    },
    [WORKSPACE_TRUST_EXTENSION_SUPPORT]: {
      type: "object",
      scope: ConfigurationScope.APPLICATION,
      markdownDescription: localize("extensions.supportUntrustedWorkspaces", "Override the untrusted workspace support of an extension. Extensions using `true` will always be enabled. Extensions using `limited` will always be enabled, and the extension will hide functionality that requires trust. Extensions using `false` will only be enabled only when the workspace is trusted."),
      patternProperties: {
        "([a-z0-9A-Z][a-z0-9-A-Z]*)\\.([a-z0-9A-Z][a-z0-9-A-Z]*)$": {
          type: "object",
          properties: {
            "supported": {
              type: ["boolean", "string"],
              enum: [true, false, "limited"],
              enumDescriptions: [
                localize("extensions.supportUntrustedWorkspaces.true", "Extension will always be enabled."),
                localize("extensions.supportUntrustedWorkspaces.false", "Extension will only be enabled only when the workspace is trusted."),
                localize("extensions.supportUntrustedWorkspaces.limited", "Extension will always be enabled, and the extension will hide functionality requiring trust.")
              ],
              description: localize("extensions.supportUntrustedWorkspaces.supported", "Defines the untrusted workspace support setting for the extension.")
            },
            "version": {
              type: "string",
              description: localize("extensions.supportUntrustedWorkspaces.version", "Defines the version of the extension for which the override should be applied. If not specified, the override will be applied independent of the extension version.")
            }
          }
        }
      }
    },
    "extensions.experimental.deferredStartupFinishedActivation": {
      type: "boolean",
      description: localize("extensionsDeferredStartupFinishedActivation", "When enabled, extensions which declare the `onStartupFinished` activation event will be activated after a timeout."),
      default: false
    },
    "extensions.experimental.issueQuickAccess": {
      type: "boolean",
      description: localize("extensionsInQuickAccess", "When enabled, extensions can be searched for via Quick Access and report issues from there."),
      default: true
    },
    "extensions.verifySignature": {
      type: "boolean",
      description: localize("extensions.verifySignature", "When enabled, extensions are verified to be signed before getting installed."),
      default: true,
      scope: ConfigurationScope.APPLICATION,
      included: isNative
    },
    [AutoRestartConfigurationKey]: {
      type: "boolean",
      description: localize("autoRestart", "If activated, extensions will automatically restart following an update if the window is not in focus. There can be a data loss if you have open Notebooks or Custom Editors."),
      default: false,
      included: product.quality !== "stable"
    },
    [UseUnpkgResourceApiConfigKey]: {
      type: "boolean",
      description: localize("extensions.gallery.useUnpkgResourceApi", "When enabled, extensions to update are fetched from Unpkg service."),
      default: true,
      scope: ConfigurationScope.APPLICATION,
      tags: ["onExp", "usesOnlineServices"]
    },
    [ExtensionGalleryServiceUrlConfigKey]: {
      type: "string",
      description: localize("extensions.gallery.serviceUrl", "Configure the Marketplace service URL to connect to"),
      default: "",
      scope: ConfigurationScope.APPLICATION,
      tags: ["usesOnlineServices"],
      included: false,
      policy: {
        name: "ExtensionGalleryServiceUrl",
        minimumVersion: "1.99"
      }
    },
    [AllowedExtensionsConfigKey]: {
      // Note: Type is set only to object because to support policies generation during build time, where single type is expected.
      type: "object",
      markdownDescription: localize("extensions.allowed", "Specify a list of extensions that are allowed to use. This helps maintain a secure and consistent development environment by restricting the use of unauthorized extensions. For more information on how to configure this setting, please visit the [Configure Allowed Extensions](https://code.visualstudio.com/docs/setup/enterprise#_configure-allowed-extensions) section."),
      default: "*",
      defaultSnippets: [{
        body: {},
        description: localize("extensions.allowed.none", "No extensions are allowed.")
      }, {
        body: {
          "*": true
        },
        description: localize("extensions.allowed.all", "All extensions are allowed.")
      }],
      scope: ConfigurationScope.APPLICATION,
      policy: {
        name: "AllowedExtensions",
        minimumVersion: "1.96",
        description: localize("extensions.allowed.policy", "Specify a list of extensions that are allowed to use. This helps maintain a secure and consistent development environment by restricting the use of unauthorized extensions. More information: https://code.visualstudio.com/docs/setup/enterprise#_configure-allowed-extensions")
      },
      additionalProperties: false,
      patternProperties: {
        "([a-z0-9A-Z][a-z0-9-A-Z]*)\\.([a-z0-9A-Z][a-z0-9-A-Z]*)$": {
          anyOf: [
            {
              type: ["boolean", "string"],
              enum: [true, false, "stable"],
              description: localize("extensions.allow.description", "Allow or disallow the extension."),
              enumDescriptions: [
                localize("extensions.allowed.enable.desc", "Extension is allowed."),
                localize("extensions.allowed.disable.desc", "Extension is not allowed."),
                localize("extensions.allowed.disable.stable.desc", "Allow only stable versions of the extension.")
              ]
            },
            {
              type: "array",
              items: {
                type: "string"
              },
              description: localize("extensions.allow.version.description", "Allow or disallow specific versions of the extension. To specifcy a platform specific version, use the format `platform@1.2.3`, e.g. `win32-x64@1.2.3`. Supported platforms are `win32-x64`, `win32-arm64`, `linux-x64`, `linux-arm64`, `linux-armhf`, `alpine-x64`, `alpine-arm64`, `darwin-x64`, `darwin-arm64`")
            }
          ]
        },
        "([a-z0-9A-Z][a-z0-9-A-Z]*)$": {
          type: ["boolean", "string"],
          enum: [true, false, "stable"],
          description: localize("extension.publisher.allow.description", "Allow or disallow all extensions from the publisher."),
          enumDescriptions: [
            localize("extensions.publisher.allowed.enable.desc", "All extensions from the publisher are allowed."),
            localize("extensions.publisher.allowed.disable.desc", "All extensions from the publisher are not allowed."),
            localize("extensions.publisher.allowed.disable.stable.desc", "Allow only stable versions of the extensions from the publisher.")
          ]
        },
        "\\*": {
          type: "boolean",
          enum: [true, false],
          description: localize("extensions.allow.all.description", "Allow or disallow all extensions."),
          enumDescriptions: [
            localize("extensions.allow.all.enable", "Allow all extensions."),
            localize("extensions.allow.all.disable", "Disallow all extensions.")
          ]
        }
      }
    }
  }
});
const jsonRegistry = Registry.as(jsonContributionRegistry.Extensions.JSONContribution);
jsonRegistry.registerSchema(ExtensionsConfigurationSchemaId, ExtensionsConfigurationSchema);
CommandsRegistry.registerCommand("_extensions.manage", (accessor, extensionId, tab, preserveFocus, feature) => {
  const extensionService = accessor.get(IExtensionsWorkbenchService);
  const extension = extensionService.local.find((e) => areSameExtensions(e.identifier, { id: extensionId }));
  if (extension) {
    extensionService.open(extension, { tab, preserveFocus, feature });
  } else {
    throw new Error(localize("notFound", "Extension '{0}' not found.", extensionId));
  }
});
CommandsRegistry.registerCommand("extension.open", async (accessor, extensionId, tab, preserveFocus, feature, sideByside) => {
  const extensionService = accessor.get(IExtensionsWorkbenchService);
  const commandService = accessor.get(ICommandService);
  const [extension] = await extensionService.getExtensions([{ id: extensionId }], CancellationToken.None);
  if (extension) {
    return extensionService.open(extension, { tab, preserveFocus, feature, sideByside });
  }
  return commandService.executeCommand("_extensions.manage", extensionId, tab, preserveFocus, feature);
});
CommandsRegistry.registerCommand({
  id: "workbench.extensions.installExtension",
  metadata: {
    description: localize("workbench.extensions.installExtension.description", "Install the given extension"),
    args: [
      {
        name: "extensionIdOrVSIXUri",
        description: localize("workbench.extensions.installExtension.arg.decription", "Extension id or VSIX resource uri"),
        constraint: (value) => typeof value === "string" || value instanceof URI
      },
      {
        name: "options",
        description: "(optional) Options for installing the extension. Object with the following properties: `installOnlyNewlyAddedFromExtensionPackVSIX`: When enabled, VS Code installs only newly added extensions from the extension pack VSIX. This option is considered only when installing VSIX. ",
        isOptional: true,
        schema: {
          "type": "object",
          "properties": {
            "installOnlyNewlyAddedFromExtensionPackVSIX": {
              "type": "boolean",
              "description": localize("workbench.extensions.installExtension.option.installOnlyNewlyAddedFromExtensionPackVSIX", "When enabled, VS Code installs only newly added extensions from the extension pack VSIX. This option is considered only while installing a VSIX."),
              default: false
            },
            "installPreReleaseVersion": {
              "type": "boolean",
              "description": localize("workbench.extensions.installExtension.option.installPreReleaseVersion", "When enabled, VS Code installs the pre-release version of the extension if available."),
              default: false
            },
            "donotSync": {
              "type": "boolean",
              "description": localize("workbench.extensions.installExtension.option.donotSync", "When enabled, VS Code do not sync this extension when Settings Sync is on."),
              default: false
            },
            "justification": {
              "type": ["string", "object"],
              "description": localize("workbench.extensions.installExtension.option.justification", "Justification for installing the extension. This is a string or an object that can be used to pass any information to the installation handlers. i.e. `{reason: 'This extension wants to open a URI', action: 'Open URI'}` will show a message box with the reason and action upon install.")
            },
            "enable": {
              "type": "boolean",
              "description": localize("workbench.extensions.installExtension.option.enable", "When enabled, the extension will be enabled if it is installed but disabled. If the extension is already enabled, this has no effect."),
              default: false
            },
            "context": {
              "type": "object",
              "description": localize("workbench.extensions.installExtension.option.context", "Context for the installation. This is a JSON object that can be used to pass any information to the installation handlers. i.e. `{skipWalkthrough: true}` will skip opening the walkthrough upon install.")
            }
          }
        }
      }
    ]
  },
  handler: async (accessor, arg, options) => {
    const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
    const extensionManagementService = accessor.get(IWorkbenchExtensionManagementService);
    const extensionGalleryService = accessor.get(IExtensionGalleryService);
    try {
      if (typeof arg === "string") {
        const [id, version] = getIdAndVersion(arg);
        const extension = extensionsWorkbenchService.local.find((e) => areSameExtensions(e.identifier, { id, uuid: version }));
        if (extension?.enablementState === EnablementState.DisabledByExtensionKind) {
          const [gallery] = await extensionGalleryService.getExtensions([{ id, preRelease: options?.installPreReleaseVersion }], CancellationToken.None);
          if (!gallery) {
            throw new Error(localize("notFound", "Extension '{0}' not found.", arg));
          }
          await extensionManagementService.installFromGallery(gallery, {
            isMachineScoped: options?.donotSync ? true : void 0,
            /* do not allow syncing extensions automatically while installing through the command */
            installPreReleaseVersion: options?.installPreReleaseVersion,
            installGivenVersion: !!version,
            context: { ...options?.context, [EXTENSION_INSTALL_SOURCE_CONTEXT]: ExtensionInstallSource.COMMAND }
          });
        } else {
          await extensionsWorkbenchService.install(arg, {
            version,
            installPreReleaseVersion: options?.installPreReleaseVersion,
            context: { ...options?.context, [EXTENSION_INSTALL_SOURCE_CONTEXT]: ExtensionInstallSource.COMMAND },
            justification: options?.justification,
            enable: options?.enable,
            isMachineScoped: options?.donotSync ? true : void 0
            /* do not allow syncing extensions automatically while installing through the command */
          }, ProgressLocation.Notification);
        }
      } else {
        const vsix = URI.revive(arg);
        await extensionsWorkbenchService.install(vsix, { installGivenVersion: true });
      }
    } catch (e) {
      onUnexpectedError(e);
      throw e;
    }
  }
});
CommandsRegistry.registerCommand({
  id: "workbench.extensions.uninstallExtension",
  metadata: {
    description: localize("workbench.extensions.uninstallExtension.description", "Uninstall the given extension"),
    args: [
      {
        name: localize("workbench.extensions.uninstallExtension.arg.name", "Id of the extension to uninstall"),
        schema: {
          "type": "string"
        }
      }
    ]
  },
  handler: async (accessor, id) => {
    if (!id) {
      throw new Error(localize("id required", "Extension id required."));
    }
    const extensionManagementService = accessor.get(IExtensionManagementService);
    const installed = await extensionManagementService.getInstalled();
    const [extensionToUninstall] = installed.filter((e) => areSameExtensions(e.identifier, { id }));
    if (!extensionToUninstall) {
      throw new Error(localize("notInstalled", "Extension '{0}' is not installed. Make sure you use the full extension ID, including the publisher, e.g.: ms-dotnettools.csharp.", id));
    }
    if (extensionToUninstall.isBuiltin) {
      throw new Error(localize("builtin", "Extension '{0}' is a Built-in extension and cannot be installed", id));
    }
    try {
      await extensionManagementService.uninstall(extensionToUninstall);
    } catch (e) {
      onUnexpectedError(e);
      throw e;
    }
  }
});
CommandsRegistry.registerCommand({
  id: "workbench.extensions.search",
  metadata: {
    description: localize("workbench.extensions.search.description", "Search for a specific extension"),
    args: [
      {
        name: localize("workbench.extensions.search.arg.name", "Query to use in search"),
        schema: { "type": "string" }
      }
    ]
  },
  handler: async (accessor, query = "") => {
    return accessor.get(IExtensionsWorkbenchService).openSearch(query);
  }
});
function overrideActionForActiveExtensionEditorWebview(command, f) {
  command?.addImplementation(105, "extensions-editor", (accessor) => {
    const editorService = accessor.get(IEditorService);
    const editor = editorService.activeEditorPane;
    if (editor instanceof ExtensionEditor) {
      if (editor.activeWebview?.isFocused) {
        f(editor.activeWebview);
        return true;
      }
    }
    return false;
  });
}
overrideActionForActiveExtensionEditorWebview(CopyAction, (webview) => webview.copy());
overrideActionForActiveExtensionEditorWebview(CutAction, (webview) => webview.cut());
overrideActionForActiveExtensionEditorWebview(PasteAction, (webview) => webview.paste());
const CONTEXT_HAS_LOCAL_SERVER = new RawContextKey("hasLocalServer", false);
const CONTEXT_HAS_REMOTE_SERVER = new RawContextKey("hasRemoteServer", false);
const CONTEXT_HAS_WEB_SERVER = new RawContextKey("hasWebServer", false);
const CONTEXT_GALLERY_SORT_CAPABILITIES = new RawContextKey("gallerySortCapabilities", "");
const CONTEXT_GALLERY_FILTER_CAPABILITIES = new RawContextKey("galleryFilterCapabilities", "");
const CONTEXT_GALLERY_ALL_REPOSITORY_SIGNED = new RawContextKey("galleryAllRepositorySigned", false);
const CONTEXT_GALLERY_HAS_EXTENSION_LINK = new RawContextKey("galleryHasExtensionLink", false);
async function runAction(action) {
  try {
    await action.run();
  } finally {
    if (isDisposable(action)) {
      action.dispose();
    }
  }
}
let ExtensionsContributions = class extends Disposable {
  constructor(extensionManagementServerService, extensionGalleryService, extensionGalleryManifestService, contextKeyService, viewsService, extensionsWorkbenchService, extensionEnablementService, instantiationService, dialogService, commandService, productService) {
    super();
    this.extensionManagementServerService = extensionManagementServerService;
    this.contextKeyService = contextKeyService;
    this.viewsService = viewsService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.extensionEnablementService = extensionEnablementService;
    this.instantiationService = instantiationService;
    this.dialogService = dialogService;
    this.commandService = commandService;
    this.productService = productService;
    const hasGalleryContext = CONTEXT_HAS_GALLERY.bindTo(contextKeyService);
    if (extensionGalleryService.isEnabled()) {
      hasGalleryContext.set(true);
    }
    const hasLocalServerContext = CONTEXT_HAS_LOCAL_SERVER.bindTo(contextKeyService);
    if (this.extensionManagementServerService.localExtensionManagementServer) {
      hasLocalServerContext.set(true);
    }
    const hasRemoteServerContext = CONTEXT_HAS_REMOTE_SERVER.bindTo(contextKeyService);
    if (this.extensionManagementServerService.remoteExtensionManagementServer) {
      hasRemoteServerContext.set(true);
    }
    const hasWebServerContext = CONTEXT_HAS_WEB_SERVER.bindTo(contextKeyService);
    if (this.extensionManagementServerService.webExtensionManagementServer) {
      hasWebServerContext.set(true);
    }
    extensionGalleryManifestService.getExtensionGalleryManifest().then((extensionGalleryManifest) => {
      this.registerGalleryCapabilitiesContexts(extensionGalleryManifest);
      this._register(extensionGalleryManifestService.onDidChangeExtensionGalleryManifest((extensionGalleryManifest2) => this.registerGalleryCapabilitiesContexts(extensionGalleryManifest2)));
    });
    this.registerGlobalActions();
    this.registerContextMenuActions();
    this.registerQuickAccessProvider();
  }
  async registerGalleryCapabilitiesContexts(extensionGalleryManifest) {
    CONTEXT_GALLERY_SORT_CAPABILITIES.bindTo(this.contextKeyService).set(`_${extensionGalleryManifest?.capabilities.extensionQuery.sorting?.map((s) => s.name)?.join("_")}_UpdateDate_`);
    CONTEXT_GALLERY_FILTER_CAPABILITIES.bindTo(this.contextKeyService).set(`_${extensionGalleryManifest?.capabilities.extensionQuery.filtering?.map((s) => s.name)?.join("_")}_`);
    CONTEXT_GALLERY_ALL_REPOSITORY_SIGNED.bindTo(this.contextKeyService).set(!!extensionGalleryManifest?.capabilities?.signing?.allRepositorySigned);
    CONTEXT_GALLERY_HAS_EXTENSION_LINK.bindTo(this.contextKeyService).set(!!(extensionGalleryManifest && getExtensionGalleryManifestResourceUri(extensionGalleryManifest, ExtensionGalleryResourceType.ExtensionDetailsViewUri)));
  }
  registerQuickAccessProvider() {
    if (this.extensionManagementServerService.localExtensionManagementServer || this.extensionManagementServerService.remoteExtensionManagementServer || this.extensionManagementServerService.webExtensionManagementServer) {
      Registry.as(Extensions.Quickaccess).registerQuickAccessProvider({
        ctor: InstallExtensionQuickAccessProvider,
        prefix: InstallExtensionQuickAccessProvider.PREFIX,
        placeholder: localize("installExtensionQuickAccessPlaceholder", "Type the name of an extension to install or search."),
        helpEntries: [{ description: localize("installExtensionQuickAccessHelp", "Install or Search Extensions") }]
      });
    }
  }
  // Global actions
  registerGlobalActions() {
    this._register(MenuRegistry.appendMenuItem(MenuId.MenubarPreferencesMenu, {
      command: {
        id: VIEWLET_ID,
        title: localize({ key: "miPreferencesExtensions", comment: ["&& denotes a mnemonic"] }, "&&Extensions")
      },
      group: "2_configuration",
      order: 3
    }));
    this._register(MenuRegistry.appendMenuItem(MenuId.GlobalActivity, {
      command: {
        id: VIEWLET_ID,
        title: localize("showExtensions", "Extensions")
      },
      group: "2_configuration",
      order: 3
    }));
    this.registerExtensionAction({
      id: "workbench.extensions.action.focusExtensionsView",
      title: localize2("focusExtensions", "Focus on Extensions View"),
      category: ExtensionsLocalizedLabel,
      f1: true,
      run: async (accessor) => {
        await accessor.get(IExtensionsWorkbenchService).openSearch("");
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.installExtensions",
      title: localize2("installExtensions", "Install Extensions"),
      category: ExtensionsLocalizedLabel,
      menu: {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.and(CONTEXT_HAS_GALLERY, ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER))
      },
      run: async (accessor) => {
        accessor.get(IViewsService).openViewContainer(VIEWLET_ID, true);
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.showRecommendedKeymapExtensions",
      title: localize2("showRecommendedKeymapExtensionsShort", "Keymaps"),
      category: PreferencesLocalizedLabel,
      menu: [{
        id: MenuId.CommandPalette,
        when: CONTEXT_HAS_GALLERY
      }, {
        id: MenuId.EditorTitle,
        when: ContextKeyExpr.and(CONTEXT_KEYBINDINGS_EDITOR, CONTEXT_HAS_GALLERY),
        group: "2_keyboard_discover_actions"
      }],
      menuTitles: {
        [MenuId.EditorTitle.id]: localize("importKeyboardShortcutsFroms", "Migrate Keyboard Shortcuts from...")
      },
      run: () => this.extensionsWorkbenchService.openSearch("@recommended:keymaps ")
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.showLanguageExtensions",
      title: localize2("showLanguageExtensionsShort", "Language Extensions"),
      category: PreferencesLocalizedLabel,
      menu: {
        id: MenuId.CommandPalette,
        when: CONTEXT_HAS_GALLERY
      },
      run: () => this.extensionsWorkbenchService.openSearch("@recommended:languages ")
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.checkForUpdates",
      title: localize2("checkForUpdates", "Check for Extension Updates"),
      category: ExtensionsLocalizedLabel,
      menu: [{
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.and(CONTEXT_HAS_GALLERY, ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER))
      }, {
        id: MenuId.ViewContainerTitle,
        when: ContextKeyExpr.and(ContextKeyExpr.equals("viewContainer", VIEWLET_ID), CONTEXT_HAS_GALLERY),
        group: "1_updates",
        order: 1
      }],
      run: async () => {
        await this.extensionsWorkbenchService.checkForUpdates();
        const outdated = this.extensionsWorkbenchService.outdated;
        if (outdated.length) {
          return this.extensionsWorkbenchService.openSearch("@outdated ");
        } else {
          return this.dialogService.info(localize("noUpdatesAvailable", "All extensions are up to date."));
        }
      }
    });
    const enableAutoUpdateWhenCondition = ContextKeyExpr.equals(`config.${AutoUpdateConfigurationKey}`, false);
    this.registerExtensionAction({
      id: "workbench.extensions.action.enableAutoUpdate",
      title: localize2("enableAutoUpdate", "Enable Auto Update for All Extensions"),
      category: ExtensionsLocalizedLabel,
      precondition: enableAutoUpdateWhenCondition,
      menu: [{
        id: MenuId.ViewContainerTitle,
        order: 5,
        group: "1_updates",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("viewContainer", VIEWLET_ID), enableAutoUpdateWhenCondition)
      }, {
        id: MenuId.CommandPalette
      }],
      run: (accessor) => accessor.get(IExtensionsWorkbenchService).updateAutoUpdateForAllExtensions(true)
    });
    const disableAutoUpdateWhenCondition = ContextKeyExpr.notEquals(`config.${AutoUpdateConfigurationKey}`, false);
    this.registerExtensionAction({
      id: "workbench.extensions.action.disableAutoUpdate",
      title: localize2("disableAutoUpdate", "Disable Auto Update for All Extensions"),
      precondition: disableAutoUpdateWhenCondition,
      category: ExtensionsLocalizedLabel,
      menu: [{
        id: MenuId.ViewContainerTitle,
        order: 5,
        group: "1_updates",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("viewContainer", VIEWLET_ID), disableAutoUpdateWhenCondition)
      }, {
        id: MenuId.CommandPalette
      }],
      run: (accessor) => accessor.get(IExtensionsWorkbenchService).updateAutoUpdateForAllExtensions(false)
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.updateAllExtensions",
      title: localize2("updateAll", "Update All Extensions"),
      category: ExtensionsLocalizedLabel,
      precondition: HasOutdatedExtensionsContext,
      menu: [
        {
          id: MenuId.CommandPalette,
          when: ContextKeyExpr.and(CONTEXT_HAS_GALLERY, ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER))
        },
        {
          id: MenuId.ViewContainerTitle,
          when: ContextKeyExpr.and(ContextKeyExpr.equals("viewContainer", VIEWLET_ID), ContextKeyExpr.or(ContextKeyExpr.has(`config.${AutoUpdateConfigurationKey}`).negate(), ContextKeyExpr.equals(`config.${AutoUpdateConfigurationKey}`, "onlyEnabledExtensions"))),
          group: "1_updates",
          order: 2
        },
        {
          id: MenuId.ViewTitle,
          when: ContextKeyExpr.equals("view", OUTDATED_EXTENSIONS_VIEW_ID),
          group: "navigation",
          order: 1
        }
      ],
      icon: installWorkspaceRecommendedIcon,
      run: async () => {
        await this.extensionsWorkbenchService.updateAll();
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.enableAll",
      title: localize2("enableAll", "Enable All Extensions"),
      category: ExtensionsLocalizedLabel,
      menu: [{
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER)
      }, {
        id: MenuId.ViewContainerTitle,
        when: ContextKeyExpr.equals("viewContainer", VIEWLET_ID),
        group: "2_enablement",
        order: 1
      }],
      run: async () => {
        const extensionsToEnable = this.extensionsWorkbenchService.local.filter((e) => !!e.local && this.extensionEnablementService.canChangeEnablement(e.local) && !this.extensionEnablementService.isEnabled(e.local));
        if (extensionsToEnable.length) {
          await this.extensionsWorkbenchService.setEnablement(extensionsToEnable, EnablementState.EnabledGlobally);
        }
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.enableAllWorkspace",
      title: localize2("enableAllWorkspace", "Enable All Extensions for this Workspace"),
      category: ExtensionsLocalizedLabel,
      menu: {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.and(WorkbenchStateContext.notEqualsTo("empty"), ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER))
      },
      run: async () => {
        const extensionsToEnable = this.extensionsWorkbenchService.local.filter((e) => !!e.local && this.extensionEnablementService.canChangeEnablement(e.local) && !this.extensionEnablementService.isEnabled(e.local));
        if (extensionsToEnable.length) {
          await this.extensionsWorkbenchService.setEnablement(extensionsToEnable, EnablementState.EnabledWorkspace);
        }
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.disableAll",
      title: localize2("disableAll", "Disable All Installed Extensions"),
      category: ExtensionsLocalizedLabel,
      menu: [{
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER)
      }, {
        id: MenuId.ViewContainerTitle,
        when: ContextKeyExpr.equals("viewContainer", VIEWLET_ID),
        group: "2_enablement",
        order: 2
      }],
      run: async () => {
        const extensionsToDisable = this.extensionsWorkbenchService.local.filter((e) => !e.isBuiltin && !!e.local && this.extensionEnablementService.isEnabled(e.local) && this.extensionEnablementService.canChangeEnablement(e.local));
        if (extensionsToDisable.length) {
          await this.extensionsWorkbenchService.setEnablement(extensionsToDisable, EnablementState.DisabledGlobally);
        }
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.disableAllWorkspace",
      title: localize2("disableAllWorkspace", "Disable All Installed Extensions for this Workspace"),
      category: ExtensionsLocalizedLabel,
      menu: {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.and(WorkbenchStateContext.notEqualsTo("empty"), ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER))
      },
      run: async () => {
        const extensionsToDisable = this.extensionsWorkbenchService.local.filter((e) => !e.isBuiltin && !!e.local && this.extensionEnablementService.isEnabled(e.local) && this.extensionEnablementService.canChangeEnablement(e.local));
        if (extensionsToDisable.length) {
          await this.extensionsWorkbenchService.setEnablement(extensionsToDisable, EnablementState.DisabledWorkspace);
        }
      }
    });
    this.registerExtensionAction({
      id: SELECT_INSTALL_VSIX_EXTENSION_COMMAND_ID,
      title: localize2("InstallFromVSIX", "Install from VSIX..."),
      category: ExtensionsLocalizedLabel,
      menu: [{
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER)
      }, {
        id: MenuId.ViewContainerTitle,
        when: ContextKeyExpr.and(ContextKeyExpr.equals("viewContainer", VIEWLET_ID), ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER)),
        group: "3_install",
        order: 1
      }],
      run: async (accessor) => {
        const fileDialogService = accessor.get(IFileDialogService);
        const commandService = accessor.get(ICommandService);
        const vsixPaths = await fileDialogService.showOpenDialog({
          title: localize("installFromVSIX", "Install from VSIX"),
          filters: [{ name: "VSIX Extensions", extensions: ["vsix"] }],
          canSelectFiles: true,
          canSelectMany: true,
          openLabel: mnemonicButtonLabel(localize({ key: "installButton", comment: ["&& denotes a mnemonic"] }, "&&Install"))
        });
        if (vsixPaths) {
          await commandService.executeCommand(INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID, vsixPaths);
        }
      }
    });
    this.registerExtensionAction({
      id: INSTALL_EXTENSION_FROM_VSIX_COMMAND_ID,
      title: localize("installVSIX", "Install Extension VSIX"),
      menu: [{
        id: MenuId.ExplorerContext,
        group: "extensions",
        when: ContextKeyExpr.and(ResourceContextKey.Extension.isEqualTo(".vsix"), ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER))
      }],
      run: async (accessor, resources) => {
        const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
        const hostService = accessor.get(IHostService);
        const notificationService = accessor.get(INotificationService);
        const vsixs = Array.isArray(resources) ? resources : [resources];
        const result = await Promise.allSettled(vsixs.map(async (vsix) => await extensionsWorkbenchService.install(vsix, { installGivenVersion: true })));
        let error, requireReload = false, requireRestart = false;
        for (const r of result) {
          if (r.status === "rejected") {
            error = new Error(r.reason);
            break;
          }
          requireReload = requireReload || r.value.runtimeState?.action === ExtensionRuntimeActionType.ReloadWindow;
          requireRestart = requireRestart || r.value.runtimeState?.action === ExtensionRuntimeActionType.RestartExtensions;
        }
        if (error) {
          throw error;
        }
        if (requireReload) {
          notificationService.prompt(
            Severity.Info,
            vsixs.length > 1 ? localize("InstallVSIXs.successReload", "Completed installing extensions. Please reload Visual Studio Code to enable them.") : localize("InstallVSIXAction.successReload", "Completed installing extension. Please reload Visual Studio Code to enable it."),
            [{
              label: localize("InstallVSIXAction.reloadNow", "Reload Now"),
              run: () => hostService.reload()
            }]
          );
        } else if (requireRestart) {
          notificationService.prompt(
            Severity.Info,
            vsixs.length > 1 ? localize("InstallVSIXs.successRestart", "Completed installing extensions. Please restart extensions to enable them.") : localize("InstallVSIXAction.successRestart", "Completed installing extension. Please restart extensions to enable it."),
            [{
              label: localize("InstallVSIXAction.restartExtensions", "Restart Extensions"),
              run: () => extensionsWorkbenchService.updateRunningExtensions()
            }]
          );
        } else {
          notificationService.prompt(
            Severity.Info,
            vsixs.length > 1 ? localize("InstallVSIXs.successNoReload", "Completed installing extensions.") : localize("InstallVSIXAction.successNoReload", "Completed installing extension."),
            []
          );
        }
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.installExtensionFromLocation",
      title: localize2("installExtensionFromLocation", "Install Extension from Location..."),
      category: Categories.Developer,
      menu: [{
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.or(CONTEXT_HAS_WEB_SERVER, CONTEXT_HAS_LOCAL_SERVER)
      }],
      run: async (accessor) => {
        const extensionManagementService = accessor.get(IWorkbenchExtensionManagementService);
        if (isWeb) {
          return new Promise((c, e) => {
            const quickInputService = accessor.get(IQuickInputService);
            const disposables = new DisposableStore();
            const quickPick = disposables.add(quickInputService.createQuickPick());
            quickPick.title = localize("installFromLocation", "Install Extension from Location");
            quickPick.customButton = true;
            quickPick.customLabel = localize("install button", "Install");
            quickPick.placeholder = localize("installFromLocationPlaceHolder", "Location of the web extension");
            quickPick.ignoreFocusOut = true;
            disposables.add(Event.any(quickPick.onDidAccept, quickPick.onDidCustom)(async () => {
              quickPick.hide();
              if (quickPick.value) {
                try {
                  await extensionManagementService.installFromLocation(URI.parse(quickPick.value));
                } catch (error) {
                  e(error);
                  return;
                }
              }
              c();
            }));
            disposables.add(quickPick.onDidHide(() => disposables.dispose()));
            quickPick.show();
          });
        } else {
          const fileDialogService = accessor.get(IFileDialogService);
          const extensionLocation = await fileDialogService.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            title: localize("installFromLocation", "Install Extension from Location")
          });
          if (extensionLocation?.[0]) {
            await extensionManagementService.installFromLocation(extensionLocation[0]);
          }
        }
      }
    });
    const extensionsFilterSubMenu = new MenuId("extensionsFilterSubMenu");
    MenuRegistry.appendMenuItem(extensionsSearchActionsMenu, {
      submenu: extensionsFilterSubMenu,
      title: localize("filterExtensions", "Filter Extensions..."),
      group: "navigation",
      order: 2,
      icon: filterIcon
    });
    const showFeaturedExtensionsId = "extensions.filter.featured";
    const featuresExtensionsWhenContext = ContextKeyExpr.and(CONTEXT_HAS_GALLERY, ContextKeyExpr.regex(CONTEXT_GALLERY_FILTER_CAPABILITIES.key, new RegExp(`_${FilterType.Featured}_`)));
    this.registerExtensionAction({
      id: showFeaturedExtensionsId,
      title: localize2("showFeaturedExtensions", "Show Featured Extensions"),
      category: ExtensionsLocalizedLabel,
      menu: [{
        id: MenuId.CommandPalette,
        when: featuresExtensionsWhenContext
      }, {
        id: extensionsFilterSubMenu,
        when: featuresExtensionsWhenContext,
        group: "1_predefined",
        order: 1
      }],
      menuTitles: {
        [extensionsFilterSubMenu.id]: localize("featured filter", "Featured")
      },
      run: () => this.extensionsWorkbenchService.openSearch("@featured ")
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.showPopularExtensions",
      title: localize2("showPopularExtensions", "Show Popular Extensions"),
      category: ExtensionsLocalizedLabel,
      menu: [{
        id: MenuId.CommandPalette,
        when: CONTEXT_HAS_GALLERY
      }, {
        id: extensionsFilterSubMenu,
        when: CONTEXT_HAS_GALLERY,
        group: "1_predefined",
        order: 2
      }],
      menuTitles: {
        [extensionsFilterSubMenu.id]: localize("most popular filter", "Most Popular")
      },
      run: () => this.extensionsWorkbenchService.openSearch("@popular ")
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.showRecommendedExtensions",
      title: localize2("showRecommendedExtensions", "Show Recommended Extensions"),
      category: ExtensionsLocalizedLabel,
      menu: [{
        id: MenuId.CommandPalette,
        when: CONTEXT_HAS_GALLERY
      }, {
        id: extensionsFilterSubMenu,
        when: CONTEXT_HAS_GALLERY,
        group: "1_predefined",
        order: 2
      }],
      menuTitles: {
        [extensionsFilterSubMenu.id]: localize("most popular recommended", "Recommended")
      },
      run: () => this.extensionsWorkbenchService.openSearch("@recommended ")
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.recentlyPublishedExtensions",
      title: localize2("recentlyPublishedExtensions", "Show Recently Published Extensions"),
      category: ExtensionsLocalizedLabel,
      menu: [{
        id: MenuId.CommandPalette,
        when: CONTEXT_HAS_GALLERY
      }, {
        id: extensionsFilterSubMenu,
        when: CONTEXT_HAS_GALLERY,
        group: "1_predefined",
        order: 2
      }],
      menuTitles: {
        [extensionsFilterSubMenu.id]: localize("recently published filter", "Recently Published")
      },
      run: () => this.extensionsWorkbenchService.openSearch("@recentlyPublished ")
    });
    const extensionsCategoryFilterSubMenu = new MenuId("extensionsCategoryFilterSubMenu");
    MenuRegistry.appendMenuItem(extensionsFilterSubMenu, {
      submenu: extensionsCategoryFilterSubMenu,
      title: localize("filter by category", "Category"),
      when: ContextKeyExpr.and(CONTEXT_HAS_GALLERY, ContextKeyExpr.regex(CONTEXT_GALLERY_FILTER_CAPABILITIES.key, new RegExp(`_${FilterType.Category}_`))),
      group: "2_categories",
      order: 1
    });
    EXTENSION_CATEGORIES.forEach((category, index) => {
      this.registerExtensionAction({
        id: `extensions.actions.searchByCategory.${category}`,
        title: category,
        menu: [{
          id: extensionsCategoryFilterSubMenu,
          when: CONTEXT_HAS_GALLERY,
          order: index
        }],
        run: () => this.extensionsWorkbenchService.openSearch(`@category:"${category.toLowerCase()}"`)
      });
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.listBuiltInExtensions",
      title: localize2("showBuiltInExtensions", "Show Built-in Extensions"),
      category: ExtensionsLocalizedLabel,
      menu: [{
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER)
      }, {
        id: extensionsFilterSubMenu,
        group: "3_installed",
        order: 2
      }],
      menuTitles: {
        [extensionsFilterSubMenu.id]: localize("builtin filter", "Built-in")
      },
      run: () => this.extensionsWorkbenchService.openSearch("@builtin ")
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.extensionUpdates",
      title: localize2("extensionUpdates", "Show Extension Updates"),
      category: ExtensionsLocalizedLabel,
      precondition: CONTEXT_HAS_GALLERY,
      f1: true,
      menu: [{
        id: extensionsFilterSubMenu,
        group: "3_installed",
        when: CONTEXT_HAS_GALLERY,
        order: 1
      }],
      menuTitles: {
        [extensionsFilterSubMenu.id]: localize("extension updates filter", "Updates")
      },
      run: () => this.extensionsWorkbenchService.openSearch("@updates")
    });
    this.registerExtensionAction({
      id: LIST_WORKSPACE_UNSUPPORTED_EXTENSIONS_COMMAND_ID,
      title: localize2("showWorkspaceUnsupportedExtensions", "Show Extensions Unsupported By Workspace"),
      category: ExtensionsLocalizedLabel,
      menu: [{
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER)
      }, {
        id: extensionsFilterSubMenu,
        group: "3_installed",
        order: 5,
        when: ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER)
      }],
      menuTitles: {
        [extensionsFilterSubMenu.id]: localize("workspace unsupported filter", "Workspace Unsupported")
      },
      run: () => this.extensionsWorkbenchService.openSearch("@workspaceUnsupported")
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.showEnabledExtensions",
      title: localize2("showEnabledExtensions", "Show Enabled Extensions"),
      category: ExtensionsLocalizedLabel,
      menu: [{
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER)
      }, {
        id: extensionsFilterSubMenu,
        group: "3_installed",
        order: 3
      }],
      menuTitles: {
        [extensionsFilterSubMenu.id]: localize("enabled filter", "Enabled")
      },
      run: () => this.extensionsWorkbenchService.openSearch("@enabled ")
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.showDisabledExtensions",
      title: localize2("showDisabledExtensions", "Show Disabled Extensions"),
      category: ExtensionsLocalizedLabel,
      menu: [{
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER)
      }, {
        id: extensionsFilterSubMenu,
        group: "3_installed",
        order: 4
      }],
      menuTitles: {
        [extensionsFilterSubMenu.id]: localize("disabled filter", "Disabled")
      },
      run: () => this.extensionsWorkbenchService.openSearch("@disabled ")
    });
    const extensionsSortSubMenu = new MenuId("extensionsSortSubMenu");
    MenuRegistry.appendMenuItem(extensionsFilterSubMenu, {
      submenu: extensionsSortSubMenu,
      title: localize("sorty by", "Sort By"),
      when: ContextKeyExpr.and(ContextKeyExpr.or(CONTEXT_HAS_GALLERY, DefaultViewsContext)),
      group: "4_sort",
      order: 1
    });
    [
      { id: "installs", title: localize("sort by installs", "Install Count"), precondition: BuiltInExtensionsContext.negate(), sortCapability: SortBy.InstallCount },
      { id: "rating", title: localize("sort by rating", "Rating"), precondition: BuiltInExtensionsContext.negate(), sortCapability: SortBy.WeightedRating },
      { id: "name", title: localize("sort by name", "Name"), precondition: BuiltInExtensionsContext.negate(), sortCapability: SortBy.Title },
      { id: "publishedDate", title: localize("sort by published date", "Published Date"), precondition: BuiltInExtensionsContext.negate(), sortCapability: SortBy.PublishedDate },
      { id: "updateDate", title: localize("sort by update date", "Updated Date"), precondition: ContextKeyExpr.and(SearchMarketplaceExtensionsContext.negate(), RecommendedExtensionsContext.negate(), BuiltInExtensionsContext.negate()), sortCapability: "UpdateDate" }
    ].map(({ id, title, precondition, sortCapability }, index) => {
      const sortCapabilityContext = ContextKeyExpr.regex(CONTEXT_GALLERY_SORT_CAPABILITIES.key, new RegExp(`_${sortCapability}_`));
      this.registerExtensionAction({
        id: `extensions.sort.${id}`,
        title,
        precondition: ContextKeyExpr.and(precondition, ContextKeyExpr.regex(ExtensionsSearchValueContext.key, /^@feature:/).negate(), sortCapabilityContext),
        menu: [{
          id: extensionsSortSubMenu,
          when: ContextKeyExpr.and(ContextKeyExpr.or(CONTEXT_HAS_GALLERY, DefaultViewsContext), sortCapabilityContext),
          order: index
        }],
        toggled: ExtensionsSortByContext.isEqualTo(id),
        run: async () => {
          const extensionsViewPaneContainer = (await this.viewsService.openViewContainer(VIEWLET_ID, true))?.getViewPaneContainer();
          const currentQuery = Query.parse(extensionsViewPaneContainer?.searchValue ?? "");
          extensionsViewPaneContainer?.search(new Query(currentQuery.value, id).toString());
          extensionsViewPaneContainer?.focus();
        }
      });
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.clearExtensionsSearchResults",
      title: localize2("clearExtensionsSearchResults", "Clear Extensions Search Results"),
      category: ExtensionsLocalizedLabel,
      icon: clearSearchResultsIcon,
      f1: true,
      precondition: SearchHasTextContext,
      menu: {
        id: extensionsSearchActionsMenu,
        group: "navigation",
        order: 1
      },
      run: async (accessor) => {
        const viewPaneContainer = accessor.get(IViewsService).getActiveViewPaneContainerWithId(VIEWLET_ID);
        if (viewPaneContainer) {
          const extensionsViewPaneContainer = viewPaneContainer;
          extensionsViewPaneContainer.search("");
          extensionsViewPaneContainer.focus();
        }
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.refreshExtension",
      title: localize2("refreshExtension", "Refresh"),
      category: ExtensionsLocalizedLabel,
      icon: refreshIcon,
      f1: true,
      menu: {
        id: MenuId.ViewContainerTitle,
        when: ContextKeyExpr.equals("viewContainer", VIEWLET_ID),
        group: "navigation",
        order: 2
      },
      run: async (accessor) => {
        const viewPaneContainer = accessor.get(IViewsService).getActiveViewPaneContainerWithId(VIEWLET_ID);
        if (viewPaneContainer) {
          await viewPaneContainer.refresh();
        }
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.installWorkspaceRecommendedExtensions",
      title: localize("installWorkspaceRecommendedExtensions", "Install Workspace Recommended Extensions"),
      icon: installWorkspaceRecommendedIcon,
      menu: {
        id: MenuId.ViewTitle,
        when: ContextKeyExpr.equals("view", WORKSPACE_RECOMMENDATIONS_VIEW_ID),
        group: "navigation",
        order: 1
      },
      run: async (accessor) => {
        const view = accessor.get(IViewsService).getActiveViewWithId(WORKSPACE_RECOMMENDATIONS_VIEW_ID);
        return view.installWorkspaceRecommendations();
      }
    });
    this.registerExtensionAction({
      id: ConfigureWorkspaceFolderRecommendedExtensionsAction.ID,
      title: ConfigureWorkspaceFolderRecommendedExtensionsAction.LABEL,
      icon: configureRecommendedIcon,
      menu: [{
        id: MenuId.CommandPalette,
        when: WorkbenchStateContext.notEqualsTo("empty")
      }, {
        id: MenuId.ViewTitle,
        when: ContextKeyExpr.equals("view", WORKSPACE_RECOMMENDATIONS_VIEW_ID),
        group: "navigation",
        order: 2
      }],
      run: () => runAction(this.instantiationService.createInstance(ConfigureWorkspaceFolderRecommendedExtensionsAction, ConfigureWorkspaceFolderRecommendedExtensionsAction.ID, ConfigureWorkspaceFolderRecommendedExtensionsAction.LABEL))
    });
    this.registerExtensionAction({
      id: InstallSpecificVersionOfExtensionAction.ID,
      title: { value: InstallSpecificVersionOfExtensionAction.LABEL, original: "Install Specific Version of Extension..." },
      category: ExtensionsLocalizedLabel,
      menu: {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.and(CONTEXT_HAS_GALLERY, ContextKeyExpr.or(CONTEXT_HAS_LOCAL_SERVER, CONTEXT_HAS_REMOTE_SERVER, CONTEXT_HAS_WEB_SERVER))
      },
      run: () => runAction(this.instantiationService.createInstance(InstallSpecificVersionOfExtensionAction, InstallSpecificVersionOfExtensionAction.ID, InstallSpecificVersionOfExtensionAction.LABEL))
    });
  }
  // Extension Context Menu
  registerContextMenuActions() {
    this.registerExtensionAction({
      id: SetColorThemeAction.ID,
      title: SetColorThemeAction.TITLE,
      menu: {
        id: MenuId.ExtensionContext,
        group: THEME_ACTIONS_GROUP,
        order: 0,
        when: ContextKeyExpr.and(ContextKeyExpr.not("inExtensionEditor"), ContextKeyExpr.equals("extensionStatus", "installed"), ContextKeyExpr.has("extensionHasColorThemes"))
      },
      run: async (accessor, extensionId) => {
        const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
        const instantiationService = accessor.get(IInstantiationService);
        const extension = extensionWorkbenchService.local.find((e) => areSameExtensions(e.identifier, { id: extensionId }));
        if (extension) {
          const action = instantiationService.createInstance(SetColorThemeAction);
          action.extension = extension;
          return action.run();
        }
      }
    });
    this.registerExtensionAction({
      id: SetFileIconThemeAction.ID,
      title: SetFileIconThemeAction.TITLE,
      menu: {
        id: MenuId.ExtensionContext,
        group: THEME_ACTIONS_GROUP,
        order: 0,
        when: ContextKeyExpr.and(ContextKeyExpr.not("inExtensionEditor"), ContextKeyExpr.equals("extensionStatus", "installed"), ContextKeyExpr.has("extensionHasFileIconThemes"))
      },
      run: async (accessor, extensionId) => {
        const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
        const instantiationService = accessor.get(IInstantiationService);
        const extension = extensionWorkbenchService.local.find((e) => areSameExtensions(e.identifier, { id: extensionId }));
        if (extension) {
          const action = instantiationService.createInstance(SetFileIconThemeAction);
          action.extension = extension;
          return action.run();
        }
      }
    });
    this.registerExtensionAction({
      id: SetProductIconThemeAction.ID,
      title: SetProductIconThemeAction.TITLE,
      menu: {
        id: MenuId.ExtensionContext,
        group: THEME_ACTIONS_GROUP,
        order: 0,
        when: ContextKeyExpr.and(ContextKeyExpr.not("inExtensionEditor"), ContextKeyExpr.equals("extensionStatus", "installed"), ContextKeyExpr.has("extensionHasProductIconThemes"))
      },
      run: async (accessor, extensionId) => {
        const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
        const instantiationService = accessor.get(IInstantiationService);
        const extension = extensionWorkbenchService.local.find((e) => areSameExtensions(e.identifier, { id: extensionId }));
        if (extension) {
          const action = instantiationService.createInstance(SetProductIconThemeAction);
          action.extension = extension;
          return action.run();
        }
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.showPreReleaseVersion",
      title: localize2("show pre-release version", "Show Pre-Release Version"),
      menu: {
        id: MenuId.ExtensionContext,
        group: INSTALL_ACTIONS_GROUP,
        order: 0,
        when: ContextKeyExpr.and(ContextKeyExpr.has("inExtensionEditor"), ContextKeyExpr.has("galleryExtensionHasPreReleaseVersion"), ContextKeyExpr.has("isPreReleaseExtensionAllowed"), ContextKeyExpr.not("showPreReleaseVersion"), ContextKeyExpr.not("isBuiltinExtension"))
      },
      run: async (accessor, extensionId) => {
        const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
        const extension = (await extensionWorkbenchService.getExtensions([{ id: extensionId }], CancellationToken.None))[0];
        extensionWorkbenchService.open(extension, { showPreReleaseVersion: true });
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.showReleasedVersion",
      title: localize2("show released version", "Show Release Version"),
      menu: {
        id: MenuId.ExtensionContext,
        group: INSTALL_ACTIONS_GROUP,
        order: 1,
        when: ContextKeyExpr.and(ContextKeyExpr.has("inExtensionEditor"), ContextKeyExpr.has("galleryExtensionHasPreReleaseVersion"), ContextKeyExpr.has("extensionHasReleaseVersion"), ContextKeyExpr.has("showPreReleaseVersion"), ContextKeyExpr.not("isBuiltinExtension"))
      },
      run: async (accessor, extensionId) => {
        const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
        const extension = (await extensionWorkbenchService.getExtensions([{ id: extensionId }], CancellationToken.None))[0];
        extensionWorkbenchService.open(extension, { showPreReleaseVersion: false });
      }
    });
    this.registerExtensionAction({
      id: ToggleAutoUpdateForExtensionAction.ID,
      title: ToggleAutoUpdateForExtensionAction.LABEL,
      category: ExtensionsLocalizedLabel,
      precondition: ContextKeyExpr.and(ContextKeyExpr.or(ContextKeyExpr.notEquals(`config.${AutoUpdateConfigurationKey}`, "onlyEnabledExtensions"), ContextKeyExpr.equals("isExtensionEnabled", true)), ContextKeyExpr.not("extensionDisallowInstall"), ContextKeyExpr.has("isExtensionAllowed")),
      menu: {
        id: MenuId.ExtensionContext,
        group: UPDATE_ACTIONS_GROUP,
        order: 1,
        when: ContextKeyExpr.and(
          ContextKeyExpr.not("inExtensionEditor"),
          ContextKeyExpr.equals("extensionStatus", "installed"),
          ContextKeyExpr.not("isBuiltinExtension")
        )
      },
      run: async (accessor, id) => {
        const instantiationService = accessor.get(IInstantiationService);
        const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
        const extension = extensionWorkbenchService.local.find((e) => areSameExtensions(e.identifier, { id }));
        if (extension) {
          const action = instantiationService.createInstance(ToggleAutoUpdateForExtensionAction);
          action.extension = extension;
          return action.run();
        }
      }
    });
    this.registerExtensionAction({
      id: ToggleAutoUpdatesForPublisherAction.ID,
      title: { value: ToggleAutoUpdatesForPublisherAction.LABEL, original: "Auto Update (Publisher)" },
      category: ExtensionsLocalizedLabel,
      precondition: ContextKeyExpr.equals(`config.${AutoUpdateConfigurationKey}`, false),
      menu: {
        id: MenuId.ExtensionContext,
        group: UPDATE_ACTIONS_GROUP,
        order: 2,
        when: ContextKeyExpr.and(ContextKeyExpr.equals("extensionStatus", "installed"), ContextKeyExpr.not("isBuiltinExtension"))
      },
      run: async (accessor, id) => {
        const instantiationService = accessor.get(IInstantiationService);
        const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
        const extension = extensionWorkbenchService.local.find((e) => areSameExtensions(e.identifier, { id }));
        if (extension) {
          const action = instantiationService.createInstance(ToggleAutoUpdatesForPublisherAction);
          action.extension = extension;
          return action.run();
        }
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.switchToPreRlease",
      title: localize("enablePreRleaseLabel", "Switch to Pre-Release Version"),
      category: ExtensionsLocalizedLabel,
      menu: {
        id: MenuId.ExtensionContext,
        group: INSTALL_ACTIONS_GROUP,
        order: 2,
        when: ContextKeyExpr.and(CONTEXT_HAS_GALLERY, ContextKeyExpr.has("galleryExtensionHasPreReleaseVersion"), ContextKeyExpr.has("isPreReleaseExtensionAllowed"), ContextKeyExpr.not("installedExtensionIsOptedToPreRelease"), ContextKeyExpr.not("inExtensionEditor"), ContextKeyExpr.equals("extensionStatus", "installed"), ContextKeyExpr.not("isBuiltinExtension"))
      },
      run: async (accessor, id) => {
        const instantiationService = accessor.get(IInstantiationService);
        const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
        const extension = extensionWorkbenchService.local.find((e) => areSameExtensions(e.identifier, { id }));
        if (extension) {
          const action = instantiationService.createInstance(TogglePreReleaseExtensionAction);
          action.extension = extension;
          return action.run();
        }
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.switchToRelease",
      title: localize("disablePreRleaseLabel", "Switch to Release Version"),
      category: ExtensionsLocalizedLabel,
      menu: {
        id: MenuId.ExtensionContext,
        group: INSTALL_ACTIONS_GROUP,
        order: 2,
        when: ContextKeyExpr.and(CONTEXT_HAS_GALLERY, ContextKeyExpr.has("galleryExtensionHasPreReleaseVersion"), ContextKeyExpr.has("isExtensionAllowed"), ContextKeyExpr.has("installedExtensionIsOptedToPreRelease"), ContextKeyExpr.not("inExtensionEditor"), ContextKeyExpr.equals("extensionStatus", "installed"), ContextKeyExpr.not("isBuiltinExtension"))
      },
      run: async (accessor, id) => {
        const instantiationService = accessor.get(IInstantiationService);
        const extensionWorkbenchService = accessor.get(IExtensionsWorkbenchService);
        const extension = extensionWorkbenchService.local.find((e) => areSameExtensions(e.identifier, { id }));
        if (extension) {
          const action = instantiationService.createInstance(TogglePreReleaseExtensionAction);
          action.extension = extension;
          return action.run();
        }
      }
    });
    this.registerExtensionAction({
      id: ClearLanguageAction.ID,
      title: ClearLanguageAction.TITLE,
      menu: {
        id: MenuId.ExtensionContext,
        group: INSTALL_ACTIONS_GROUP,
        order: 0,
        when: ContextKeyExpr.and(ContextKeyExpr.not("inExtensionEditor"), ContextKeyExpr.has("canSetLanguage"), ContextKeyExpr.has("isActiveLanguagePackExtension"))
      },
      run: async (accessor, extensionId) => {
        const instantiationService = accessor.get(IInstantiationService);
        const extensionsWorkbenchService = accessor.get(IExtensionsWorkbenchService);
        const extension = (await extensionsWorkbenchService.getExtensions([{ id: extensionId }], CancellationToken.None))[0];
        const action = instantiationService.createInstance(ClearLanguageAction);
        action.extension = extension;
        return action.run();
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.installUnsigned",
      title: localize("install", "Install"),
      menu: {
        id: MenuId.ExtensionContext,
        group: "0_install",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("extensionStatus", "uninstalled"), ContextKeyExpr.has("isGalleryExtension"), ContextKeyExpr.not("extensionDisallowInstall"), ContextKeyExpr.has("extensionIsUnsigned"), CONTEXT_GALLERY_ALL_REPOSITORY_SIGNED),
        order: 1
      },
      run: async (accessor, extensionId) => {
        const instantiationService = accessor.get(IInstantiationService);
        const extension = this.extensionsWorkbenchService.local.filter((e) => areSameExtensions(e.identifier, { id: extensionId }))[0] || (await this.extensionsWorkbenchService.getExtensions([{ id: extensionId }], CancellationToken.None))[0];
        if (extension) {
          const action = instantiationService.createInstance(InstallAction, { installPreReleaseVersion: this.extensionsWorkbenchService.preferPreReleases });
          action.extension = extension;
          return action.run();
        }
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.installAndDonotSync",
      title: localize("install installAndDonotSync", "Install (Do not Sync)"),
      menu: {
        id: MenuId.ExtensionContext,
        group: "0_install",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("extensionStatus", "uninstalled"), ContextKeyExpr.has("isGalleryExtension"), ContextKeyExpr.has("isExtensionAllowed"), ContextKeyExpr.not("extensionDisallowInstall"), CONTEXT_SYNC_ENABLEMENT),
        order: 1
      },
      run: async (accessor, extensionId) => {
        const instantiationService = accessor.get(IInstantiationService);
        const extension = this.extensionsWorkbenchService.local.filter((e) => areSameExtensions(e.identifier, { id: extensionId }))[0] || (await this.extensionsWorkbenchService.getExtensions([{ id: extensionId }], CancellationToken.None))[0];
        if (extension) {
          const action = instantiationService.createInstance(InstallAction, {
            installPreReleaseVersion: this.extensionsWorkbenchService.preferPreReleases,
            isMachineScoped: true
          });
          action.extension = extension;
          return action.run();
        }
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.installPrereleaseAndDonotSync",
      title: localize("installPrereleaseAndDonotSync", "Install Pre-Release (Do not Sync)"),
      menu: {
        id: MenuId.ExtensionContext,
        group: "0_install",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("extensionStatus", "uninstalled"), ContextKeyExpr.has("isGalleryExtension"), ContextKeyExpr.has("extensionHasPreReleaseVersion"), ContextKeyExpr.has("isPreReleaseExtensionAllowed"), ContextKeyExpr.not("extensionDisallowInstall"), CONTEXT_SYNC_ENABLEMENT),
        order: 2
      },
      run: async (accessor, extensionId) => {
        const instantiationService = accessor.get(IInstantiationService);
        const extension = this.extensionsWorkbenchService.local.filter((e) => areSameExtensions(e.identifier, { id: extensionId }))[0] || (await this.extensionsWorkbenchService.getExtensions([{ id: extensionId }], CancellationToken.None))[0];
        if (extension) {
          const action = instantiationService.createInstance(InstallAction, {
            isMachineScoped: true,
            preRelease: true
          });
          action.extension = extension;
          return action.run();
        }
      }
    });
    this.registerExtensionAction({
      id: InstallAnotherVersionAction.ID,
      title: InstallAnotherVersionAction.LABEL,
      menu: {
        id: MenuId.ExtensionContext,
        group: "0_install",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("extensionStatus", "uninstalled"), ContextKeyExpr.has("isGalleryExtension"), ContextKeyExpr.has("isExtensionAllowed"), ContextKeyExpr.not("extensionDisallowInstall")),
        order: 3
      },
      run: async (accessor, extensionId) => {
        const instantiationService = accessor.get(IInstantiationService);
        const extension = this.extensionsWorkbenchService.local.filter((e) => areSameExtensions(e.identifier, { id: extensionId }))[0] || (await this.extensionsWorkbenchService.getExtensions([{ id: extensionId }], CancellationToken.None))[0];
        if (extension) {
          return instantiationService.createInstance(InstallAnotherVersionAction, extension, false).run();
        }
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.copyExtension",
      title: localize2("workbench.extensions.action.copyExtension", "Copy"),
      menu: {
        id: MenuId.ExtensionContext,
        group: "1_copy"
      },
      run: async (accessor, extensionId) => {
        const clipboardService = accessor.get(IClipboardService);
        const extension = this.extensionsWorkbenchService.local.filter((e) => areSameExtensions(e.identifier, { id: extensionId }))[0] || (await this.extensionsWorkbenchService.getExtensions([{ id: extensionId }], CancellationToken.None))[0];
        if (extension) {
          const name = localize("extensionInfoName", "Name: {0}", extension.displayName);
          const id = localize("extensionInfoId", "Id: {0}", extensionId);
          const description = localize("extensionInfoDescription", "Description: {0}", extension.description);
          const verision = localize("extensionInfoVersion", "Version: {0}", extension.version);
          const publisher = localize("extensionInfoPublisher", "Publisher: {0}", extension.publisherDisplayName);
          const link = extension.url ? localize("extensionInfoVSMarketplaceLink", "VS Marketplace Link: {0}", `${extension.url}`) : null;
          const clipboardStr = `${name}
${id}
${description}
${verision}
${publisher}${link ? "\n" + link : ""}`;
          await clipboardService.writeText(clipboardStr);
        }
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.copyExtensionId",
      title: localize2("workbench.extensions.action.copyExtensionId", "Copy Extension ID"),
      menu: {
        id: MenuId.ExtensionContext,
        group: "1_copy"
      },
      run: async (accessor, id) => accessor.get(IClipboardService).writeText(id)
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.copyLink",
      title: localize2("workbench.extensions.action.copyLink", "Copy Link"),
      menu: {
        id: MenuId.ExtensionContext,
        group: "1_copy",
        when: ContextKeyExpr.and(ContextKeyExpr.has("isGalleryExtension"), CONTEXT_GALLERY_HAS_EXTENSION_LINK)
      },
      run: async (accessor, _, extension) => {
        const clipboardService = accessor.get(IClipboardService);
        if (extension.galleryLink) {
          await clipboardService.writeText(extension.galleryLink);
        }
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.configure",
      title: localize2("workbench.extensions.action.configure", "Settings"),
      menu: {
        id: MenuId.ExtensionContext,
        group: "2_configure",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("extensionStatus", "installed"), ContextKeyExpr.has("extensionHasConfiguration")),
        order: 1
      },
      run: async (accessor, id) => accessor.get(IPreferencesService).openSettings({ jsonEditor: false, query: `@ext:${id}` })
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.download",
      title: localize("download VSIX", "Download VSIX"),
      menu: {
        id: MenuId.ExtensionContext,
        when: ContextKeyExpr.and(ContextKeyExpr.equals("extensionStatus", "uninstalled"), ContextKeyExpr.not("extensionDisallowInstall"), ContextKeyExpr.has("isGalleryExtension")),
        order: this.productService.quality === "stable" ? 0 : 1
      },
      run: async (accessor, extensionId) => {
        accessor.get(IExtensionsWorkbenchService).downloadVSIX(extensionId, false);
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.downloadPreRelease",
      title: localize("download pre-release", "Download Pre-Release VSIX"),
      menu: {
        id: MenuId.ExtensionContext,
        when: ContextKeyExpr.and(ContextKeyExpr.equals("extensionStatus", "uninstalled"), ContextKeyExpr.not("extensionDisallowInstall"), ContextKeyExpr.has("isGalleryExtension"), ContextKeyExpr.has("extensionHasPreReleaseVersion")),
        order: this.productService.quality === "stable" ? 1 : 0
      },
      run: async (accessor, extensionId) => {
        accessor.get(IExtensionsWorkbenchService).downloadVSIX(extensionId, true);
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.manageAccountPreferences",
      title: localize2("workbench.extensions.action.changeAccountPreference", "Account Preferences"),
      menu: {
        id: MenuId.ExtensionContext,
        group: "2_configure",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("extensionStatus", "installed"), ContextKeyExpr.has("extensionHasAccountPreferences")),
        order: 2
      },
      run: (accessor, id) => accessor.get(ICommandService).executeCommand("_manageAccountPreferencesForExtension", id)
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.configureKeybindings",
      title: localize2("workbench.extensions.action.configureKeybindings", "Keyboard Shortcuts"),
      menu: {
        id: MenuId.ExtensionContext,
        group: "2_configure",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("extensionStatus", "installed"), ContextKeyExpr.has("extensionHasKeybindings")),
        order: 2
      },
      run: async (accessor, id) => accessor.get(IPreferencesService).openGlobalKeybindingSettings(false, { query: `@ext:${id}` })
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.toggleApplyToAllProfiles",
      title: localize2("workbench.extensions.action.toggleApplyToAllProfiles", "Apply Extension to all Profiles"),
      toggled: ContextKeyExpr.has("isApplicationScopedExtension"),
      menu: {
        id: MenuId.ExtensionContext,
        group: "2_configure",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("extensionStatus", "installed"), ContextKeyExpr.has("isDefaultApplicationScopedExtension").negate(), ContextKeyExpr.has("isBuiltinExtension").negate(), ContextKeyExpr.equals("isWorkspaceScopedExtension", false)),
        order: 3
      },
      run: async (accessor, _, extensionArg) => {
        const uriIdentityService = accessor.get(IUriIdentityService);
        const extension = extensionArg.location ? this.extensionsWorkbenchService.installed.find((e) => uriIdentityService.extUri.isEqual(e.local?.location, extensionArg.location)) : void 0;
        if (extension) {
          return this.extensionsWorkbenchService.toggleApplyExtensionToAllProfiles(extension);
        }
      }
    });
    this.registerExtensionAction({
      id: TOGGLE_IGNORE_EXTENSION_ACTION_ID,
      title: localize2("workbench.extensions.action.toggleIgnoreExtension", "Sync This Extension"),
      menu: {
        id: MenuId.ExtensionContext,
        group: "2_configure",
        when: ContextKeyExpr.and(ContextKeyExpr.equals("extensionStatus", "installed"), CONTEXT_SYNC_ENABLEMENT, ContextKeyExpr.equals("isWorkspaceScopedExtension", false)),
        order: 4
      },
      run: async (accessor, id) => {
        const extension = this.extensionsWorkbenchService.local.find((e) => areSameExtensions({ id }, e.identifier));
        if (extension) {
          return this.extensionsWorkbenchService.toggleExtensionIgnoredToSync(extension);
        }
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.ignoreRecommendation",
      title: localize2("workbench.extensions.action.ignoreRecommendation", "Ignore Recommendation"),
      menu: {
        id: MenuId.ExtensionContext,
        group: "3_recommendations",
        when: ContextKeyExpr.has("isExtensionRecommended"),
        order: 1
      },
      run: async (accessor, id) => accessor.get(IExtensionIgnoredRecommendationsService).toggleGlobalIgnoredRecommendation(id, true)
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.undoIgnoredRecommendation",
      title: localize2("workbench.extensions.action.undoIgnoredRecommendation", "Undo Ignored Recommendation"),
      menu: {
        id: MenuId.ExtensionContext,
        group: "3_recommendations",
        when: ContextKeyExpr.has("isUserIgnoredRecommendation"),
        order: 1
      },
      run: async (accessor, id) => accessor.get(IExtensionIgnoredRecommendationsService).toggleGlobalIgnoredRecommendation(id, false)
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.addExtensionToWorkspaceRecommendations",
      title: localize2("workbench.extensions.action.addExtensionToWorkspaceRecommendations", "Add to Workspace Recommendations"),
      menu: {
        id: MenuId.ExtensionContext,
        group: "3_recommendations",
        when: ContextKeyExpr.and(WorkbenchStateContext.notEqualsTo("empty"), ContextKeyExpr.has("isBuiltinExtension").negate(), ContextKeyExpr.has("isExtensionWorkspaceRecommended").negate(), ContextKeyExpr.has("isUserIgnoredRecommendation").negate(), ContextKeyExpr.notEquals("extensionSource", "resource")),
        order: 2
      },
      run: (accessor, id) => accessor.get(IWorkspaceExtensionsConfigService).toggleRecommendation(id)
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.removeExtensionFromWorkspaceRecommendations",
      title: localize2("workbench.extensions.action.removeExtensionFromWorkspaceRecommendations", "Remove from Workspace Recommendations"),
      menu: {
        id: MenuId.ExtensionContext,
        group: "3_recommendations",
        when: ContextKeyExpr.and(WorkbenchStateContext.notEqualsTo("empty"), ContextKeyExpr.has("isBuiltinExtension").negate(), ContextKeyExpr.has("isExtensionWorkspaceRecommended")),
        order: 2
      },
      run: (accessor, id) => accessor.get(IWorkspaceExtensionsConfigService).toggleRecommendation(id)
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.addToWorkspaceRecommendations",
      title: localize2("workbench.extensions.action.addToWorkspaceRecommendations", "Add Extension to Workspace Recommendations"),
      category: EXTENSIONS_CATEGORY,
      menu: {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.and(WorkbenchStateContext.isEqualTo("workspace"), ContextKeyExpr.equals("resourceScheme", Schemas.extension))
      },
      async run(accessor) {
        const editorService = accessor.get(IEditorService);
        const workspaceExtensionsConfigService = accessor.get(IWorkspaceExtensionsConfigService);
        if (!(editorService.activeEditor instanceof ExtensionsInput)) {
          return;
        }
        const extensionId = editorService.activeEditor.extension.identifier.id.toLowerCase();
        const recommendations = await workspaceExtensionsConfigService.getRecommendations();
        if (recommendations.includes(extensionId)) {
          return;
        }
        await workspaceExtensionsConfigService.toggleRecommendation(extensionId);
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.addToWorkspaceFolderRecommendations",
      title: localize2("workbench.extensions.action.addToWorkspaceFolderRecommendations", "Add Extension to Workspace Folder Recommendations"),
      category: EXTENSIONS_CATEGORY,
      menu: {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.and(WorkbenchStateContext.isEqualTo("folder"), ContextKeyExpr.equals("resourceScheme", Schemas.extension))
      },
      run: () => this.commandService.executeCommand("workbench.extensions.action.addToWorkspaceRecommendations")
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.addToWorkspaceIgnoredRecommendations",
      title: localize2("workbench.extensions.action.addToWorkspaceIgnoredRecommendations", "Add Extension to Workspace Ignored Recommendations"),
      category: EXTENSIONS_CATEGORY,
      menu: {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.and(WorkbenchStateContext.isEqualTo("workspace"), ContextKeyExpr.equals("resourceScheme", Schemas.extension))
      },
      async run(accessor) {
        const editorService = accessor.get(IEditorService);
        const workspaceExtensionsConfigService = accessor.get(IWorkspaceExtensionsConfigService);
        if (!(editorService.activeEditor instanceof ExtensionsInput)) {
          return;
        }
        const extensionId = editorService.activeEditor.extension.identifier.id.toLowerCase();
        const unwantedRecommendations = await workspaceExtensionsConfigService.getUnwantedRecommendations();
        if (unwantedRecommendations.includes(extensionId)) {
          return;
        }
        await workspaceExtensionsConfigService.toggleUnwantedRecommendation(extensionId);
      }
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.addToWorkspaceFolderIgnoredRecommendations",
      title: localize2("workbench.extensions.action.addToWorkspaceFolderIgnoredRecommendations", "Add Extension to Workspace Folder Ignored Recommendations"),
      category: EXTENSIONS_CATEGORY,
      menu: {
        id: MenuId.CommandPalette,
        when: ContextKeyExpr.and(WorkbenchStateContext.isEqualTo("folder"), ContextKeyExpr.equals("resourceScheme", Schemas.extension))
      },
      run: () => this.commandService.executeCommand("workbench.extensions.action.addToWorkspaceIgnoredRecommendations")
    });
    this.registerExtensionAction({
      id: ConfigureWorkspaceRecommendedExtensionsAction.ID,
      title: { value: ConfigureWorkspaceRecommendedExtensionsAction.LABEL, original: "Configure Recommended Extensions (Workspace)" },
      category: EXTENSIONS_CATEGORY,
      menu: {
        id: MenuId.CommandPalette,
        when: WorkbenchStateContext.isEqualTo("workspace")
      },
      run: () => runAction(this.instantiationService.createInstance(ConfigureWorkspaceRecommendedExtensionsAction, ConfigureWorkspaceRecommendedExtensionsAction.ID, ConfigureWorkspaceRecommendedExtensionsAction.LABEL))
    });
    this.registerExtensionAction({
      id: "workbench.extensions.action.manageTrustedPublishers",
      title: localize2("workbench.extensions.action.manageTrustedPublishers", "Manage Trusted Extension Publishers"),
      category: EXTENSIONS_CATEGORY,
      f1: true,
      run: async (accessor) => {
        const quickInputService = accessor.get(IQuickInputService);
        const extensionManagementService = accessor.get(IWorkbenchExtensionManagementService);
        const trustedPublishers = extensionManagementService.getTrustedPublishers();
        const trustedPublisherItems = trustedPublishers.map((publisher) => ({
          id: publisher.publisher,
          label: publisher.publisherDisplayName,
          description: publisher.publisher,
          picked: true
        })).sort((a, b) => a.label.localeCompare(b.label));
        const result = await quickInputService.pick(trustedPublisherItems, {
          canPickMany: true,
          title: localize("trustedPublishers", "Manage Trusted Extension Publishers"),
          placeHolder: localize("trustedPublishersPlaceholder", "Choose which publishers to trust")
        });
        if (result) {
          const untrustedPublishers = [];
          for (const { publisher } of trustedPublishers) {
            if (!result.some((r) => r.id === publisher)) {
              untrustedPublishers.push(publisher);
            }
          }
          trustedPublishers.filter((publisher) => !result.some((r) => r.id === publisher.publisher));
          extensionManagementService.untrustPublishers(...untrustedPublishers);
        }
      }
    });
  }
  registerExtensionAction(extensionActionOptions) {
    const menus = extensionActionOptions.menu ? Array.isArray(extensionActionOptions.menu) ? extensionActionOptions.menu : [extensionActionOptions.menu] : [];
    let menusWithOutTitles = [];
    const menusWithTitles = [];
    if (extensionActionOptions.menuTitles) {
      for (let index = 0; index < menus.length; index++) {
        const menu = menus[index];
        const menuTitle = extensionActionOptions.menuTitles[menu.id.id];
        if (menuTitle) {
          menusWithTitles.push({ id: menu.id, item: { ...menu, command: { id: extensionActionOptions.id, title: menuTitle } } });
        } else {
          menusWithOutTitles.push(menu);
        }
      }
    } else {
      menusWithOutTitles = menus;
    }
    const disposables = new DisposableStore();
    disposables.add(registerAction2(class extends Action2 {
      constructor() {
        super({
          ...extensionActionOptions,
          menu: menusWithOutTitles
        });
      }
      run(accessor, ...args) {
        return extensionActionOptions.run(accessor, ...args);
      }
    }));
    if (menusWithTitles.length) {
      disposables.add(MenuRegistry.appendMenuItems(menusWithTitles));
    }
    return disposables;
  }
};
ExtensionsContributions = __decorateClass([
  __decorateParam(0, IExtensionManagementServerService),
  __decorateParam(1, IExtensionGalleryService),
  __decorateParam(2, IExtensionGalleryManifestService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IViewsService),
  __decorateParam(5, IExtensionsWorkbenchService),
  __decorateParam(6, IWorkbenchExtensionEnablementService),
  __decorateParam(7, IInstantiationService),
  __decorateParam(8, IDialogService),
  __decorateParam(9, ICommandService),
  __decorateParam(10, IProductService)
], ExtensionsContributions);
let ExtensionStorageCleaner = class {
  constructor(extensionManagementService, storageService) {
    ExtensionStorageService.removeOutdatedExtensionVersions(extensionManagementService, storageService);
  }
};
ExtensionStorageCleaner = __decorateClass([
  __decorateParam(0, IExtensionManagementService),
  __decorateParam(1, IStorageService)
], ExtensionStorageCleaner);
let TrustedPublishersInitializer = class {
  constructor(extensionManagementService, userDataProfilesService, productService, storageService) {
    const trustedPublishersInitStatusKey = "trusted-publishers-init-migration";
    if (!storageService.get(trustedPublishersInitStatusKey, StorageScope.APPLICATION)) {
      for (const profile of userDataProfilesService.profiles) {
        extensionManagementService.getInstalled(ExtensionType.User, profile.extensionsResource).then(async (extensions) => {
          const trustedPublishers = /* @__PURE__ */ new Map();
          for (const extension of extensions) {
            if (!extension.publisherDisplayName) {
              continue;
            }
            const publisher = extension.manifest.publisher.toLowerCase();
            if (productService.trustedExtensionPublishers?.includes(publisher) || extension.publisherDisplayName && productService.trustedExtensionPublishers?.includes(extension.publisherDisplayName.toLowerCase())) {
              continue;
            }
            trustedPublishers.set(publisher, { publisher, publisherDisplayName: extension.publisherDisplayName });
          }
          if (trustedPublishers.size) {
            extensionManagementService.trustPublishers(...trustedPublishers.values());
          }
          storageService.store(trustedPublishersInitStatusKey, "true", StorageScope.APPLICATION, StorageTarget.MACHINE);
        });
      }
    }
  }
};
TrustedPublishersInitializer = __decorateClass([
  __decorateParam(0, IWorkbenchExtensionManagementService),
  __decorateParam(1, IUserDataProfilesService),
  __decorateParam(2, IProductService),
  __decorateParam(3, IStorageService)
], TrustedPublishersInitializer);
const workbenchRegistry = Registry.as(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(ExtensionsContributions, LifecyclePhase.Restored);
workbenchRegistry.registerWorkbenchContribution(StatusUpdater, LifecyclePhase.Eventually);
workbenchRegistry.registerWorkbenchContribution(MaliciousExtensionChecker, LifecyclePhase.Eventually);
workbenchRegistry.registerWorkbenchContribution(KeymapExtensions, LifecyclePhase.Restored);
workbenchRegistry.registerWorkbenchContribution(ExtensionsViewletViewsContribution, LifecyclePhase.Restored);
workbenchRegistry.registerWorkbenchContribution(ExtensionActivationProgress, LifecyclePhase.Eventually);
workbenchRegistry.registerWorkbenchContribution(ExtensionDependencyChecker, LifecyclePhase.Eventually);
workbenchRegistry.registerWorkbenchContribution(ExtensionEnablementWorkspaceTrustTransitionParticipant, LifecyclePhase.Restored);
workbenchRegistry.registerWorkbenchContribution(ExtensionsCompletionItemsProvider, LifecyclePhase.Restored);
workbenchRegistry.registerWorkbenchContribution(UnsupportedExtensionsMigrationContrib, LifecyclePhase.Eventually);
workbenchRegistry.registerWorkbenchContribution(TrustedPublishersInitializer, LifecyclePhase.Eventually);
if (isWeb) {
  workbenchRegistry.registerWorkbenchContribution(ExtensionStorageCleaner, LifecyclePhase.Eventually);
}
registerAction2(ShowRuntimeExtensionsAction);
Registry.as(ConfigurationMigrationExtensions.ConfigurationMigration).registerConfigurationMigrations([{
  key: AutoUpdateConfigurationKey,
  migrateFn: (value, accessor) => {
    if (value === "onlySelectedExtensions") {
      return { value: false };
    }
    return [];
  }
}]);
export {
  CONTEXT_HAS_LOCAL_SERVER,
  CONTEXT_HAS_REMOTE_SERVER,
  CONTEXT_HAS_WEB_SERVER
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9leHRlbnNpb25zL2Jyb3dzZXIvZXh0ZW5zaW9ucy5jb250cmlidXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEtleU1vZCwgS2V5Q29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IE1lbnVSZWdpc3RyeSwgTWVudUlkLCByZWdpc3RlckFjdGlvbjIsIEFjdGlvbjIsIElNZW51SXRlbSwgSUFjdGlvbjJPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJbnN0YW50aWF0aW9uVHlwZSwgcmVnaXN0ZXJTaW5nbGV0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnNMb2NhbGl6ZWRMYWJlbCwgSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLCBJRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UsIFByZWZlcmVuY2VzTG9jYWxpemVkTGFiZWwsIEVYVEVOU0lPTl9JTlNUQUxMX1NPVVJDRV9DT05URVhULCBFeHRlbnNpb25JbnN0YWxsU291cmNlLCBVc2VVbnBrZ1Jlc291cmNlQXBpQ29uZmlnS2V5LCBBbGxvd2VkRXh0ZW5zaW9uc0NvbmZpZ0tleSwgU29ydEJ5LCBGaWx0ZXJUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBFbmFibGVtZW50U3RhdGUsIElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZSwgSVB1Ymxpc2hlckluZm8sIElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSwgSVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uSWdub3JlZFJlY29tbWVuZGF0aW9uc1NlcnZpY2UsIElFeHRlbnNpb25SZWNvbW1lbmRhdGlvbnNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zL2NvbW1vbi9leHRlbnNpb25SZWNvbW1lbmRhdGlvbnMuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeSwgRXh0ZW5zaW9ucyBhcyBXb3JrYmVuY2hFeHRlbnNpb25zLCBJV29ya2JlbmNoQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgU3luY0Rlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9kZXNjcmlwdG9ycy5qcyc7XG5pbXBvcnQgeyBWSUVXTEVUX0lELCBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsIElFeHRlbnNpb25zVmlld1BhbmVDb250YWluZXIsIFRPR0dMRV9JR05PUkVfRVhURU5TSU9OX0FDVElPTl9JRCwgSU5TVEFMTF9FWFRFTlNJT05fRlJPTV9WU0lYX0NPTU1BTkRfSUQsIFdPUktTUEFDRV9SRUNPTU1FTkRBVElPTlNfVklFV19JRCwgSVdvcmtzcGFjZVJlY29tbWVuZGVkRXh0ZW5zaW9uc1ZpZXcsIEF1dG9VcGRhdGVDb25maWd1cmF0aW9uS2V5LCBIYXNPdXRkYXRlZEV4dGVuc2lvbnNDb250ZXh0LCBTRUxFQ1RfSU5TVEFMTF9WU0lYX0VYVEVOU0lPTl9DT01NQU5EX0lELCBMSVNUX1dPUktTUEFDRV9VTlNVUFBPUlRFRF9FWFRFTlNJT05TX0NPTU1BTkRfSUQsIEV4dGVuc2lvbkVkaXRvclRhYiwgVEhFTUVfQUNUSU9OU19HUk9VUCwgSU5TVEFMTF9BQ1RJT05TX0dST1VQLCBPVVREQVRFRF9FWFRFTlNJT05TX1ZJRVdfSUQsIENPTlRFWFRfSEFTX0dBTExFUlksIGV4dGVuc2lvbnNTZWFyY2hBY3Rpb25zTWVudSwgVVBEQVRFX0FDVElPTlNfR1JPVVAsIElFeHRlbnNpb25BcmcsIEV4dGVuc2lvblJ1bnRpbWVBY3Rpb25UeXBlLCBFWFRFTlNJT05TX0NBVEVHT1JZLCBBdXRvUmVzdGFydENvbmZpZ3VyYXRpb25LZXkgfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJbnN0YWxsU3BlY2lmaWNWZXJzaW9uT2ZFeHRlbnNpb25BY3Rpb24sIENvbmZpZ3VyZVdvcmtzcGFjZVJlY29tbWVuZGVkRXh0ZW5zaW9uc0FjdGlvbiwgQ29uZmlndXJlV29ya3NwYWNlRm9sZGVyUmVjb21tZW5kZWRFeHRlbnNpb25zQWN0aW9uLCBTZXRDb2xvclRoZW1lQWN0aW9uLCBTZXRGaWxlSWNvblRoZW1lQWN0aW9uLCBTZXRQcm9kdWN0SWNvblRoZW1lQWN0aW9uLCBDbGVhckxhbmd1YWdlQWN0aW9uLCBUb2dnbGVBdXRvVXBkYXRlRm9yRXh0ZW5zaW9uQWN0aW9uLCBUb2dnbGVBdXRvVXBkYXRlc0ZvclB1Ymxpc2hlckFjdGlvbiwgVG9nZ2xlUHJlUmVsZWFzZUV4dGVuc2lvbkFjdGlvbiwgSW5zdGFsbEFub3RoZXJWZXJzaW9uQWN0aW9uLCBJbnN0YWxsQWN0aW9uIH0gZnJvbSAnLi9leHRlbnNpb25zQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zSW5wdXQgfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9uc0lucHV0LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkVkaXRvciB9IGZyb20gJy4vZXh0ZW5zaW9uRWRpdG9yLmpzJztcbmltcG9ydCB7IFN0YXR1c1VwZGF0ZXIsIE1hbGljaW91c0V4dGVuc2lvbkNoZWNrZXIsIEV4dGVuc2lvbnNWaWV3bGV0Vmlld3NDb250cmlidXRpb24sIEV4dGVuc2lvbnNWaWV3UGFuZUNvbnRhaW5lciwgQnVpbHRJbkV4dGVuc2lvbnNDb250ZXh0LCBTZWFyY2hNYXJrZXRwbGFjZUV4dGVuc2lvbnNDb250ZXh0LCBSZWNvbW1lbmRlZEV4dGVuc2lvbnNDb250ZXh0LCBEZWZhdWx0Vmlld3NDb250ZXh0LCBFeHRlbnNpb25zU29ydEJ5Q29udGV4dCwgU2VhcmNoSGFzVGV4dENvbnRleHQsIEV4dGVuc2lvbnNTZWFyY2hWYWx1ZUNvbnRleHQgfSBmcm9tICcuL2V4dGVuc2lvbnNWaWV3bGV0LmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMsIENvbmZpZ3VyYXRpb25TY29wZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgKiBhcyBqc29uQ29udHJpYnV0aW9uUmVnaXN0cnkgZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vanNvbnNjaGVtYXMvY29tbW9uL2pzb25Db250cmlidXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zQ29uZmlndXJhdGlvblNjaGVtYSwgRXh0ZW5zaW9uc0NvbmZpZ3VyYXRpb25TY2hlbWFJZCB9IGZyb20gJy4uL2NvbW1vbi9leHRlbnNpb25zRmlsZVRlbXBsYXRlLmpzJztcbmltcG9ydCB7IENvbW1hbmRzUmVnaXN0cnksIElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEtleW1hcEV4dGVuc2lvbnMgfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9uc1V0aWxzLmpzJztcbmltcG9ydCB7IGFyZVNhbWVFeHRlbnNpb25zLCBnZXRJZEFuZFZlcnNpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50VXRpbC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JQYW5lRGVzY3JpcHRvciwgSUVkaXRvclBhbmVSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yLmpzJztcbmltcG9ydCB7IExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkFjdGl2YXRpb25Qcm9ncmVzcyB9IGZyb20gJy4vZXh0ZW5zaW9uc0FjdGl2YXRpb25Qcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25EZXBlbmRlbmN5Q2hlY2tlciB9IGZyb20gJy4vZXh0ZW5zaW9uc0RlcGVuZGVuY3lDaGVja2VyLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElWaWV3Q29udGFpbmVyc1JlZ2lzdHJ5LCBWaWV3Q29udGFpbmVyTG9jYXRpb24sIEV4dGVuc2lvbnMgYXMgVmlld0NvbnRhaW5lckV4dGVuc2lvbnMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld3MuanMnO1xuaW1wb3J0IHsgSVZpZXdzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ZpZXdzL2NvbW1vbi92aWV3c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNsaXBib2FyZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jbGlwYm9hcmQvY29tbW9uL2NsaXBib2FyZFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVByZWZlcmVuY2VzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ByZWZlcmVuY2VzL2NvbW1vbi9wcmVmZXJlbmNlcy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXlTZXJ2aWNlLCBSYXdDb250ZXh0S2V5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJUXVpY2tBY2Nlc3NSZWdpc3RyeSwgRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrQWNjZXNzLmpzJztcbmltcG9ydCB7IEluc3RhbGxFeHRlbnNpb25RdWlja0FjY2Vzc1Byb3ZpZGVyLCBNYW5hZ2VFeHRlbnNpb25zUXVpY2tBY2Nlc3NQcm92aWRlciB9IGZyb20gJy4vZXh0ZW5zaW9uc1F1aWNrQWNjZXNzLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UgfSBmcm9tICcuL2V4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ09OVEVYVF9TWU5DX0VOQUJMRU1FTlQgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy91c2VyRGF0YVN5bmMvY29tbW9uL3VzZXJEYXRhU3luYy5qcyc7XG5pbXBvcnQgeyBDb3B5QWN0aW9uLCBDdXRBY3Rpb24sIFBhc3RlQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvY2xpcGJvYXJkL2Jyb3dzZXIvY2xpcGJvYXJkLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE11bHRpQ29tbWFuZCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSVdlYnZpZXcgfSBmcm9tICcuLi8uLi93ZWJ2aWV3L2Jyb3dzZXIvd2Vidmlldy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSB9IGZyb20gJy4vZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2F0ZWdvcmllcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uQ29tbW9uQ2F0ZWdvcmllcy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25Ob3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zL2NvbW1vbi9leHRlbnNpb25SZWNvbW1lbmRhdGlvbnMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25Ob3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi9leHRlbnNpb25SZWNvbW1lbmRhdGlvbk5vdGlmaWNhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UsIFNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VDb250ZXh0S2V5LCBXb3JrYmVuY2hTdGF0ZUNvbnRleHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udGV4dGtleXMuanMnO1xuaW1wb3J0IHsgSUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUV4dGVuc2lvbnNDb25maWdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uUmVjb21tZW5kYXRpb25zL2NvbW1vbi93b3Jrc3BhY2VFeHRlbnNpb25zQ29uZmlnLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IFNob3dSdW50aW1lRXh0ZW5zaW9uc0FjdGlvbiB9IGZyb20gJy4vYWJzdHJhY3RSdW50aW1lRXh0ZW5zaW9uc0VkaXRvci5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25FbmFibGVtZW50V29ya3NwYWNlVHJ1c3RUcmFuc2l0aW9uUGFydGljaXBhbnQgfSBmcm9tICcuL2V4dGVuc2lvbkVuYWJsZW1lbnRXb3Jrc3BhY2VUcnVzdFRyYW5zaXRpb25QYXJ0aWNpcGFudC5qcyc7XG5pbXBvcnQgeyBjbGVhclNlYXJjaFJlc3VsdHNJY29uLCBjb25maWd1cmVSZWNvbW1lbmRlZEljb24sIGV4dGVuc2lvbnNWaWV3SWNvbiwgZmlsdGVySWNvbiwgaW5zdGFsbFdvcmtzcGFjZVJlY29tbWVuZGVkSWNvbiwgcmVmcmVzaEljb24gfSBmcm9tICcuL2V4dGVuc2lvbnNJY29ucy5qcyc7XG5pbXBvcnQgeyBFWFRFTlNJT05fQ0FURUdPUklFUywgRXh0ZW5zaW9uVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgaXNEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlLCBJRmlsZURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IG1uZW1vbmljQnV0dG9uTGFiZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9sYWJlbHMuanMnO1xuaW1wb3J0IHsgUXVlcnkgfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9uUXVlcnkuanMnO1xuaW1wb3J0IHsgRWRpdG9yRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgV09SS1NQQUNFX1RSVVNUX0VYVEVOU0lPTl9TVVBQT1JUIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvd29ya3NwYWNlcy9jb21tb24vd29ya3NwYWNlVHJ1c3QuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uc0NvbXBsZXRpb25JdGVtc1Byb3ZpZGVyIH0gZnJvbSAnLi9leHRlbnNpb25zQ29tcGxldGlvbkl0ZW1zUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFVuc3VwcG9ydGVkRXh0ZW5zaW9uc01pZ3JhdGlvbkNvbnRyaWIgfSBmcm9tICcuL3Vuc3VwcG9ydGVkRXh0ZW5zaW9uc01pZ3JhdGlvbkNvbnRyaWJ1dGlvbi5qcyc7XG5pbXBvcnQgeyBpc05hdGl2ZSwgaXNXZWIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25TdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvblN0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElTdHJpbmdEaWN0aW9uYXJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29sbGVjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ09OVEVYVF9LRVlCSU5ESU5HU19FRElUT1IgfSBmcm9tICcuLi8uLi9wcmVmZXJlbmNlcy9jb21tb24vcHJlZmVyZW5jZXMuanMnO1xuaW1wb3J0IHsgUHJvZ3Jlc3NMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uTWlncmF0aW9uUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgQ29uZmlndXJhdGlvbk1pZ3JhdGlvbkV4dGVuc2lvbnMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgcHJvZHVjdCBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkdhbGxlcnlSZXNvdXJjZVR5cGUsIEV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlVXJsQ29uZmlnS2V5LCBnZXRFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RSZXNvdXJjZVVyaSwgSUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCwgSUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QuanMnO1xuXG4vLyBTaW5nbGV0b25zXG5yZWdpc3RlclNpbmdsZXRvbihJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsIEV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlciAvKiBBdXRvIHVwZGF0ZXMgZXh0ZW5zaW9ucyAqLyk7XG5yZWdpc3RlclNpbmdsZXRvbihJRXh0ZW5zaW9uUmVjb21tZW5kYXRpb25Ob3RpZmljYXRpb25TZXJ2aWNlLCBFeHRlbnNpb25SZWNvbW1lbmRhdGlvbk5vdGlmaWNhdGlvblNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xucmVnaXN0ZXJTaW5nbGV0b24oSUV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UsIEV4dGVuc2lvblJlY29tbWVuZGF0aW9uc1NlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkVhZ2VyIC8qIFByb21wdHMgcmVjb21tZW5kYXRpb25zIGluIHRoZSBiYWNrZ3JvdW5kICovKTtcblxuLy8gUXVpY2sgQWNjZXNzXG5SZWdpc3RyeS5hczxJUXVpY2tBY2Nlc3NSZWdpc3RyeT4oRXh0ZW5zaW9ucy5RdWlja2FjY2VzcykucmVnaXN0ZXJRdWlja0FjY2Vzc1Byb3ZpZGVyKHtcblx0Y3RvcjogTWFuYWdlRXh0ZW5zaW9uc1F1aWNrQWNjZXNzUHJvdmlkZXIsXG5cdHByZWZpeDogTWFuYWdlRXh0ZW5zaW9uc1F1aWNrQWNjZXNzUHJvdmlkZXIuUFJFRklYLFxuXHRwbGFjZWhvbGRlcjogbG9jYWxpemUoJ21hbmFnZUV4dGVuc2lvbnNRdWlja0FjY2Vzc1BsYWNlaG9sZGVyJywgXCJQcmVzcyBFbnRlciB0byBtYW5hZ2UgZXh0ZW5zaW9ucy5cIiksXG5cdGhlbHBFbnRyaWVzOiBbeyBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ21hbmFnZUV4dGVuc2lvbnNIZWxwJywgXCJNYW5hZ2UgRXh0ZW5zaW9uc1wiKSB9XVxufSk7XG5cbi8vIEVkaXRvclxuUmVnaXN0cnkuYXM8SUVkaXRvclBhbmVSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JQYW5lKS5yZWdpc3RlckVkaXRvclBhbmUoXG5cdEVkaXRvclBhbmVEZXNjcmlwdG9yLmNyZWF0ZShcblx0XHRFeHRlbnNpb25FZGl0b3IsXG5cdFx0RXh0ZW5zaW9uRWRpdG9yLklELFxuXHRcdGxvY2FsaXplKCdleHRlbnNpb24nLCBcIkV4dGVuc2lvblwiKVxuXHQpLFxuXHRbXG5cdFx0bmV3IFN5bmNEZXNjcmlwdG9yKEV4dGVuc2lvbnNJbnB1dClcblx0XSk7XG5cblJlZ2lzdHJ5LmFzPElWaWV3Q29udGFpbmVyc1JlZ2lzdHJ5PihWaWV3Q29udGFpbmVyRXh0ZW5zaW9ucy5WaWV3Q29udGFpbmVyc1JlZ2lzdHJ5KS5yZWdpc3RlclZpZXdDb250YWluZXIoXG5cdHtcblx0XHRpZDogVklFV0xFVF9JRCxcblx0XHR0aXRsZTogbG9jYWxpemUyKCdleHRlbnNpb25zJywgXCJFeHRlbnNpb25zXCIpLFxuXHRcdG9wZW5Db21tYW5kQWN0aW9uRGVzY3JpcHRvcjoge1xuXHRcdFx0aWQ6IFZJRVdMRVRfSUQsXG5cdFx0XHRtbmVtb25pY1RpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pVmlld0V4dGVuc2lvbnMnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiRSYmeHRlbnNpb25zXCIpLFxuXHRcdFx0a2V5YmluZGluZ3M6IHsgcHJpbWFyeTogS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleVggfSxcblx0XHRcdG9yZGVyOiA0LFxuXHRcdH0sXG5cdFx0Y3RvckRlc2NyaXB0b3I6IG5ldyBTeW5jRGVzY3JpcHRvcihFeHRlbnNpb25zVmlld1BhbmVDb250YWluZXIpLFxuXHRcdGljb246IGV4dGVuc2lvbnNWaWV3SWNvbixcblx0XHRvcmRlcjogNCxcblx0XHRyZWplY3RBZGRlZFZpZXdzOiB0cnVlLFxuXHRcdGFsd2F5c1VzZUNvbnRhaW5lckluZm86IHRydWUsXG5cdFx0aGlkZUJ5RGVmYXVsdDogdHJ1ZSxcblx0XHRoaWRlSWZFbXB0eTogdHJ1ZSxcblx0fSwgVmlld0NvbnRhaW5lckxvY2F0aW9uLlNpZGViYXIpO1xuXG5SZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihDb25maWd1cmF0aW9uRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKVxuXHQucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0XHRpZDogJ2V4dGVuc2lvbnMnLFxuXHRcdG9yZGVyOiAzMCxcblx0XHR0aXRsZTogbG9jYWxpemUoJ2V4dGVuc2lvbnNDb25maWd1cmF0aW9uVGl0bGUnLCBcIkV4dGVuc2lvbnNcIiksXG5cdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0cHJvcGVydGllczoge1xuXHRcdFx0J2V4dGVuc2lvbnMuYXV0b1VwZGF0ZSc6IHtcblx0XHRcdFx0ZW51bTogW3RydWUsICdvbmx5RW5hYmxlZEV4dGVuc2lvbnMnLCBmYWxzZSxdLFxuXHRcdFx0XHRlbnVtSXRlbUxhYmVsczogW1xuXHRcdFx0XHRcdGxvY2FsaXplKCdhbGwnLCBcIkFsbCBFeHRlbnNpb25zXCIpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCdlbmFibGVkJywgXCJPbmx5IEVuYWJsZWQgRXh0ZW5zaW9uc1wiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnbm9uZScsIFwiTm9uZVwiKSxcblx0XHRcdFx0XSxcblx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdGxvY2FsaXplKCdleHRlbnNpb25zLmF1dG9VcGRhdGUudHJ1ZScsICdEb3dubG9hZCBhbmQgaW5zdGFsbCB1cGRhdGVzIGF1dG9tYXRpY2FsbHkgZm9yIGFsbCBleHRlbnNpb25zLicpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCdleHRlbnNpb25zLmF1dG9VcGRhdGUuZW5hYmxlZCcsICdEb3dubG9hZCBhbmQgaW5zdGFsbCB1cGRhdGVzIGF1dG9tYXRpY2FsbHkgb25seSBmb3IgZW5hYmxlZCBleHRlbnNpb25zLicpLFxuXHRcdFx0XHRcdGxvY2FsaXplKCdleHRlbnNpb25zLmF1dG9VcGRhdGUuZmFsc2UnLCAnRXh0ZW5zaW9ucyBhcmUgbm90IGF1dG9tYXRpY2FsbHkgdXBkYXRlZC4nKSxcblx0XHRcdFx0XSxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdleHRlbnNpb25zLmF1dG9VcGRhdGUnLCBcIkNvbnRyb2xzIHRoZSBhdXRvbWF0aWMgdXBkYXRlIGJlaGF2aW9yIG9mIGV4dGVuc2lvbnMuIFRoZSB1cGRhdGVzIGFyZSBmZXRjaGVkIGZyb20gYSBNaWNyb3NvZnQgb25saW5lIHNlcnZpY2UuXCIpLFxuXHRcdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OLFxuXHRcdFx0XHR0YWdzOiBbJ3VzZXNPbmxpbmVTZXJ2aWNlcyddXG5cdFx0XHR9LFxuXHRcdFx0J2V4dGVuc2lvbnMuYXV0b0NoZWNrVXBkYXRlcyc6IHtcblx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2V4dGVuc2lvbnNDaGVja1VwZGF0ZXMnLCBcIldoZW4gZW5hYmxlZCwgYXV0b21hdGljYWxseSBjaGVja3MgZXh0ZW5zaW9ucyBmb3IgdXBkYXRlcy4gSWYgYW4gZXh0ZW5zaW9uIGhhcyBhbiB1cGRhdGUsIGl0IGlzIG1hcmtlZCBhcyBvdXRkYXRlZCBpbiB0aGUgRXh0ZW5zaW9ucyB2aWV3LiBUaGUgdXBkYXRlcyBhcmUgZmV0Y2hlZCBmcm9tIGEgTWljcm9zb2Z0IG9ubGluZSBzZXJ2aWNlLlwiKSxcblx0XHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0c2NvcGU6IENvbmZpZ3VyYXRpb25TY29wZS5BUFBMSUNBVElPTixcblx0XHRcdFx0dGFnczogWyd1c2VzT25saW5lU2VydmljZXMnXVxuXHRcdFx0fSxcblx0XHRcdCdleHRlbnNpb25zLmlnbm9yZVJlY29tbWVuZGF0aW9ucyc6IHtcblx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2V4dGVuc2lvbnNJZ25vcmVSZWNvbW1lbmRhdGlvbnMnLCBcIldoZW4gZW5hYmxlZCwgdGhlIG5vdGlmaWNhdGlvbnMgZm9yIGV4dGVuc2lvbiByZWNvbW1lbmRhdGlvbnMgd2lsbCBub3QgYmUgc2hvd24uXCIpLFxuXHRcdFx0XHRkZWZhdWx0OiBmYWxzZVxuXHRcdFx0fSxcblx0XHRcdCdleHRlbnNpb25zLnNob3dSZWNvbW1lbmRhdGlvbnNPbmx5T25EZW1hbmQnOiB7XG5cdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0ZGVwcmVjYXRpb25NZXNzYWdlOiBsb2NhbGl6ZSgnZXh0ZW5zaW9uc1Nob3dSZWNvbW1lbmRhdGlvbnNPbmx5T25EZW1hbmRfRGVwcmVjYXRlZCcsIFwiVGhpcyBzZXR0aW5nIGlzIGRlcHJlY2F0ZWQuIFVzZSBleHRlbnNpb25zLmlnbm9yZVJlY29tbWVuZGF0aW9ucyBzZXR0aW5nIHRvIGNvbnRyb2wgcmVjb21tZW5kYXRpb24gbm90aWZpY2F0aW9ucy4gVXNlIEV4dGVuc2lvbnMgdmlldydzIHZpc2liaWxpdHkgYWN0aW9ucyB0byBoaWRlIFJlY29tbWVuZGVkIHZpZXcgYnkgZGVmYXVsdC5cIiksXG5cdFx0XHRcdGRlZmF1bHQ6IGZhbHNlLFxuXHRcdFx0XHR0YWdzOiBbJ3VzZXNPbmxpbmVTZXJ2aWNlcyddXG5cdFx0XHR9LFxuXHRcdFx0J2V4dGVuc2lvbnMuY2xvc2VFeHRlbnNpb25EZXRhaWxzT25WaWV3Q2hhbmdlJzoge1xuXHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZXh0ZW5zaW9uc0Nsb3NlRXh0ZW5zaW9uRGV0YWlsc09uVmlld0NoYW5nZScsIFwiV2hlbiBlbmFibGVkLCBlZGl0b3JzIHdpdGggZXh0ZW5zaW9uIGRldGFpbHMgd2lsbCBiZSBhdXRvbWF0aWNhbGx5IGNsb3NlZCB1cG9uIG5hdmlnYXRpbmcgYXdheSBmcm9tIHRoZSBFeHRlbnNpb25zIFZpZXcuXCIpLFxuXHRcdFx0XHRkZWZhdWx0OiBmYWxzZVxuXHRcdFx0fSxcblx0XHRcdCdleHRlbnNpb25zLmNvbmZpcm1lZFVyaUhhbmRsZXJFeHRlbnNpb25JZHMnOiB7XG5cdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0fSxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdoYW5kbGVVcmlDb25maXJtZWRFeHRlbnNpb25zJywgXCJXaGVuIGFuIGV4dGVuc2lvbiBpcyBsaXN0ZWQgaGVyZSwgYSBjb25maXJtYXRpb24gcHJvbXB0IHdpbGwgbm90IGJlIHNob3duIHdoZW4gdGhhdCBleHRlbnNpb24gaGFuZGxlcyBhIFVSSS5cIiksXG5cdFx0XHRcdGRlZmF1bHQ6IFtdLFxuXHRcdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OXG5cdFx0XHR9LFxuXHRcdFx0J2V4dGVuc2lvbnMud2ViV29ya2VyJzoge1xuXHRcdFx0XHR0eXBlOiBbJ2Jvb2xlYW4nLCAnc3RyaW5nJ10sXG5cdFx0XHRcdGVudW06IFt0cnVlLCBmYWxzZSwgJ2F1dG8nXSxcblx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdGxvY2FsaXplKCdleHRlbnNpb25zV2ViV29ya2VyLnRydWUnLCBcIlRoZSBXZWIgV29ya2VyIEV4dGVuc2lvbiBIb3N0IHdpbGwgYWx3YXlzIGJlIGxhdW5jaGVkLlwiKSxcblx0XHRcdFx0XHRsb2NhbGl6ZSgnZXh0ZW5zaW9uc1dlYldvcmtlci5mYWxzZScsIFwiVGhlIFdlYiBXb3JrZXIgRXh0ZW5zaW9uIEhvc3Qgd2lsbCBuZXZlciBiZSBsYXVuY2hlZC5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ2V4dGVuc2lvbnNXZWJXb3JrZXIuYXV0bycsIFwiVGhlIFdlYiBXb3JrZXIgRXh0ZW5zaW9uIEhvc3Qgd2lsbCBiZSBsYXVuY2hlZCB3aGVuIGEgd2ViIGV4dGVuc2lvbiBuZWVkcyBpdC5cIiksXG5cdFx0XHRcdF0sXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZXh0ZW5zaW9uc1dlYldvcmtlcicsIFwiRW5hYmxlIHdlYiB3b3JrZXIgZXh0ZW5zaW9uIGhvc3QuXCIpLFxuXHRcdFx0XHRkZWZhdWx0OiAnYXV0bydcblx0XHRcdH0sXG5cdFx0XHQnZXh0ZW5zaW9ucy5zdXBwb3J0VmlydHVhbFdvcmtzcGFjZXMnOiB7XG5cdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZXh0ZW5zaW9ucy5zdXBwb3J0VmlydHVhbFdvcmtzcGFjZXMnLCBcIk92ZXJyaWRlIHRoZSB2aXJ0dWFsIHdvcmtzcGFjZXMgc3VwcG9ydCBvZiBhbiBleHRlbnNpb24uXCIpLFxuXHRcdFx0XHRwYXR0ZXJuUHJvcGVydGllczoge1xuXHRcdFx0XHRcdCcoW2EtejAtOUEtWl1bYS16MC05LUEtWl0qKVxcXFwuKFthLXowLTlBLVpdW2EtejAtOS1BLVpdKikkJzoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZSxcblx0XHRcdFx0ZGVmYXVsdDoge30sXG5cdFx0XHRcdGRlZmF1bHRTbmlwcGV0czogW3tcblx0XHRcdFx0XHQnYm9keSc6IHtcblx0XHRcdFx0XHRcdCdwdWIubmFtZSc6IGZhbHNlXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XVxuXHRcdFx0fSxcblx0XHRcdCdleHRlbnNpb25zLmV4cGVyaW1lbnRhbC5hZmZpbml0eSc6IHtcblx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdleHRlbnNpb25zLmFmZmluaXR5JywgXCJDb25maWd1cmUgYW4gZXh0ZW5zaW9uIHRvIGV4ZWN1dGUgaW4gYSBkaWZmZXJlbnQgZXh0ZW5zaW9uIGhvc3QgcHJvY2Vzcy5cIiksXG5cdFx0XHRcdHBhdHRlcm5Qcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0JyhbYS16MC05QS1aXVthLXowLTktQS1aXSopXFxcXC4oW2EtejAtOUEtWl1bYS16MC05LUEtWl0qKSQnOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnaW50ZWdlcicsXG5cdFx0XHRcdFx0XHRkZWZhdWx0OiAxXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0XHRcdGRlZmF1bHQ6IHt9LFxuXHRcdFx0XHRkZWZhdWx0U25pcHBldHM6IFt7XG5cdFx0XHRcdFx0J2JvZHknOiB7XG5cdFx0XHRcdFx0XHQncHViLm5hbWUnOiAxXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XVxuXHRcdFx0fSxcblx0XHRcdFtXT1JLU1BBQ0VfVFJVU1RfRVhURU5TSU9OX1NVUFBPUlRdOiB7XG5cdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OLFxuXHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZXh0ZW5zaW9ucy5zdXBwb3J0VW50cnVzdGVkV29ya3NwYWNlcycsIFwiT3ZlcnJpZGUgdGhlIHVudHJ1c3RlZCB3b3Jrc3BhY2Ugc3VwcG9ydCBvZiBhbiBleHRlbnNpb24uIEV4dGVuc2lvbnMgdXNpbmcgYHRydWVgIHdpbGwgYWx3YXlzIGJlIGVuYWJsZWQuIEV4dGVuc2lvbnMgdXNpbmcgYGxpbWl0ZWRgIHdpbGwgYWx3YXlzIGJlIGVuYWJsZWQsIGFuZCB0aGUgZXh0ZW5zaW9uIHdpbGwgaGlkZSBmdW5jdGlvbmFsaXR5IHRoYXQgcmVxdWlyZXMgdHJ1c3QuIEV4dGVuc2lvbnMgdXNpbmcgYGZhbHNlYCB3aWxsIG9ubHkgYmUgZW5hYmxlZCBvbmx5IHdoZW4gdGhlIHdvcmtzcGFjZSBpcyB0cnVzdGVkLlwiKSxcblx0XHRcdFx0cGF0dGVyblByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHQnKFthLXowLTlBLVpdW2EtejAtOS1BLVpdKilcXFxcLihbYS16MC05QS1aXVthLXowLTktQS1aXSopJCc6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHQnc3VwcG9ydGVkJzoge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6IFsnYm9vbGVhbicsICdzdHJpbmcnXSxcblx0XHRcdFx0XHRcdFx0XHRlbnVtOiBbdHJ1ZSwgZmFsc2UsICdsaW1pdGVkJ10sXG5cdFx0XHRcdFx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdFx0XHRcdFx0bG9jYWxpemUoJ2V4dGVuc2lvbnMuc3VwcG9ydFVudHJ1c3RlZFdvcmtzcGFjZXMudHJ1ZScsIFwiRXh0ZW5zaW9uIHdpbGwgYWx3YXlzIGJlIGVuYWJsZWQuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdFx0bG9jYWxpemUoJ2V4dGVuc2lvbnMuc3VwcG9ydFVudHJ1c3RlZFdvcmtzcGFjZXMuZmFsc2UnLCBcIkV4dGVuc2lvbiB3aWxsIG9ubHkgYmUgZW5hYmxlZCBvbmx5IHdoZW4gdGhlIHdvcmtzcGFjZSBpcyB0cnVzdGVkLlwiKSxcblx0XHRcdFx0XHRcdFx0XHRcdGxvY2FsaXplKCdleHRlbnNpb25zLnN1cHBvcnRVbnRydXN0ZWRXb3Jrc3BhY2VzLmxpbWl0ZWQnLCBcIkV4dGVuc2lvbiB3aWxsIGFsd2F5cyBiZSBlbmFibGVkLCBhbmQgdGhlIGV4dGVuc2lvbiB3aWxsIGhpZGUgZnVuY3Rpb25hbGl0eSByZXF1aXJpbmcgdHJ1c3QuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdleHRlbnNpb25zLnN1cHBvcnRVbnRydXN0ZWRXb3Jrc3BhY2VzLnN1cHBvcnRlZCcsIFwiRGVmaW5lcyB0aGUgdW50cnVzdGVkIHdvcmtzcGFjZSBzdXBwb3J0IHNldHRpbmcgZm9yIHRoZSBleHRlbnNpb24uXCIpLFxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHQndmVyc2lvbic6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2V4dGVuc2lvbnMuc3VwcG9ydFVudHJ1c3RlZFdvcmtzcGFjZXMudmVyc2lvbicsIFwiRGVmaW5lcyB0aGUgdmVyc2lvbiBvZiB0aGUgZXh0ZW5zaW9uIGZvciB3aGljaCB0aGUgb3ZlcnJpZGUgc2hvdWxkIGJlIGFwcGxpZWQuIElmIG5vdCBzcGVjaWZpZWQsIHRoZSBvdmVycmlkZSB3aWxsIGJlIGFwcGxpZWQgaW5kZXBlbmRlbnQgb2YgdGhlIGV4dGVuc2lvbiB2ZXJzaW9uLlwiKSxcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdCdleHRlbnNpb25zLmV4cGVyaW1lbnRhbC5kZWZlcnJlZFN0YXJ0dXBGaW5pc2hlZEFjdGl2YXRpb24nOiB7XG5cdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdleHRlbnNpb25zRGVmZXJyZWRTdGFydHVwRmluaXNoZWRBY3RpdmF0aW9uJywgXCJXaGVuIGVuYWJsZWQsIGV4dGVuc2lvbnMgd2hpY2ggZGVjbGFyZSB0aGUgYG9uU3RhcnR1cEZpbmlzaGVkYCBhY3RpdmF0aW9uIGV2ZW50IHdpbGwgYmUgYWN0aXZhdGVkIGFmdGVyIGEgdGltZW91dC5cIiksXG5cdFx0XHRcdGRlZmF1bHQ6IGZhbHNlXG5cdFx0XHR9LFxuXHRcdFx0J2V4dGVuc2lvbnMuZXhwZXJpbWVudGFsLmlzc3VlUXVpY2tBY2Nlc3MnOiB7XG5cdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdleHRlbnNpb25zSW5RdWlja0FjY2VzcycsIFwiV2hlbiBlbmFibGVkLCBleHRlbnNpb25zIGNhbiBiZSBzZWFyY2hlZCBmb3IgdmlhIFF1aWNrIEFjY2VzcyBhbmQgcmVwb3J0IGlzc3VlcyBmcm9tIHRoZXJlLlwiKSxcblx0XHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdCdleHRlbnNpb25zLnZlcmlmeVNpZ25hdHVyZSc6IHtcblx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2V4dGVuc2lvbnMudmVyaWZ5U2lnbmF0dXJlJywgXCJXaGVuIGVuYWJsZWQsIGV4dGVuc2lvbnMgYXJlIHZlcmlmaWVkIHRvIGJlIHNpZ25lZCBiZWZvcmUgZ2V0dGluZyBpbnN0YWxsZWQuXCIpLFxuXHRcdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OLFxuXHRcdFx0XHRpbmNsdWRlZDogaXNOYXRpdmVcblx0XHRcdH0sXG5cdFx0XHRbQXV0b1Jlc3RhcnRDb25maWd1cmF0aW9uS2V5XToge1xuXHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnYXV0b1Jlc3RhcnQnLCBcIklmIGFjdGl2YXRlZCwgZXh0ZW5zaW9ucyB3aWxsIGF1dG9tYXRpY2FsbHkgcmVzdGFydCBmb2xsb3dpbmcgYW4gdXBkYXRlIGlmIHRoZSB3aW5kb3cgaXMgbm90IGluIGZvY3VzLiBUaGVyZSBjYW4gYmUgYSBkYXRhIGxvc3MgaWYgeW91IGhhdmUgb3BlbiBOb3RlYm9va3Mgb3IgQ3VzdG9tIEVkaXRvcnMuXCIpLFxuXHRcdFx0XHRkZWZhdWx0OiBmYWxzZSxcblx0XHRcdFx0aW5jbHVkZWQ6IHByb2R1Y3QucXVhbGl0eSAhPT0gJ3N0YWJsZSdcblx0XHRcdH0sXG5cdFx0XHRbVXNlVW5wa2dSZXNvdXJjZUFwaUNvbmZpZ0tleV06IHtcblx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2V4dGVuc2lvbnMuZ2FsbGVyeS51c2VVbnBrZ1Jlc291cmNlQXBpJywgXCJXaGVuIGVuYWJsZWQsIGV4dGVuc2lvbnMgdG8gdXBkYXRlIGFyZSBmZXRjaGVkIGZyb20gVW5wa2cgc2VydmljZS5cIiksXG5cdFx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT04sXG5cdFx0XHRcdHRhZ3M6IFsnb25FeHAnLCAndXNlc09ubGluZVNlcnZpY2VzJ11cblx0XHRcdH0sXG5cdFx0XHRbRXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2VVcmxDb25maWdLZXldOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2V4dGVuc2lvbnMuZ2FsbGVyeS5zZXJ2aWNlVXJsJywgXCJDb25maWd1cmUgdGhlIE1hcmtldHBsYWNlIHNlcnZpY2UgVVJMIHRvIGNvbm5lY3QgdG9cIiksXG5cdFx0XHRcdGRlZmF1bHQ6ICcnLFxuXHRcdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OLFxuXHRcdFx0XHR0YWdzOiBbJ3VzZXNPbmxpbmVTZXJ2aWNlcyddLFxuXHRcdFx0XHRpbmNsdWRlZDogZmFsc2UsXG5cdFx0XHRcdHBvbGljeToge1xuXHRcdFx0XHRcdG5hbWU6ICdFeHRlbnNpb25HYWxsZXJ5U2VydmljZVVybCcsXG5cdFx0XHRcdFx0bWluaW11bVZlcnNpb246ICcxLjk5Jyxcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRbQWxsb3dlZEV4dGVuc2lvbnNDb25maWdLZXldOiB7XG5cdFx0XHRcdC8vIE5vdGU6IFR5cGUgaXMgc2V0IG9ubHkgdG8gb2JqZWN0IGJlY2F1c2UgdG8gc3VwcG9ydCBwb2xpY2llcyBnZW5lcmF0aW9uIGR1cmluZyBidWlsZCB0aW1lLCB3aGVyZSBzaW5nbGUgdHlwZSBpcyBleHBlY3RlZC5cblx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdleHRlbnNpb25zLmFsbG93ZWQnLCBcIlNwZWNpZnkgYSBsaXN0IG9mIGV4dGVuc2lvbnMgdGhhdCBhcmUgYWxsb3dlZCB0byB1c2UuIFRoaXMgaGVscHMgbWFpbnRhaW4gYSBzZWN1cmUgYW5kIGNvbnNpc3RlbnQgZGV2ZWxvcG1lbnQgZW52aXJvbm1lbnQgYnkgcmVzdHJpY3RpbmcgdGhlIHVzZSBvZiB1bmF1dGhvcml6ZWQgZXh0ZW5zaW9ucy4gRm9yIG1vcmUgaW5mb3JtYXRpb24gb24gaG93IHRvIGNvbmZpZ3VyZSB0aGlzIHNldHRpbmcsIHBsZWFzZSB2aXNpdCB0aGUgW0NvbmZpZ3VyZSBBbGxvd2VkIEV4dGVuc2lvbnNdKGh0dHBzOi8vY29kZS52aXN1YWxzdHVkaW8uY29tL2RvY3Mvc2V0dXAvZW50ZXJwcmlzZSNfY29uZmlndXJlLWFsbG93ZWQtZXh0ZW5zaW9ucykgc2VjdGlvbi5cIiksXG5cdFx0XHRcdGRlZmF1bHQ6ICcqJyxcblx0XHRcdFx0ZGVmYXVsdFNuaXBwZXRzOiBbe1xuXHRcdFx0XHRcdGJvZHk6IHt9LFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZXh0ZW5zaW9ucy5hbGxvd2VkLm5vbmUnLCBcIk5vIGV4dGVuc2lvbnMgYXJlIGFsbG93ZWQuXCIpLFxuXHRcdFx0XHR9LCB7XG5cdFx0XHRcdFx0Ym9keToge1xuXHRcdFx0XHRcdFx0JyonOiB0cnVlXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2V4dGVuc2lvbnMuYWxsb3dlZC5hbGwnLCBcIkFsbCBleHRlbnNpb25zIGFyZSBhbGxvd2VkLlwiKSxcblx0XHRcdFx0fV0sXG5cdFx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT04sXG5cdFx0XHRcdHBvbGljeToge1xuXHRcdFx0XHRcdG5hbWU6ICdBbGxvd2VkRXh0ZW5zaW9ucycsXG5cdFx0XHRcdFx0bWluaW11bVZlcnNpb246ICcxLjk2Jyxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2V4dGVuc2lvbnMuYWxsb3dlZC5wb2xpY3knLCBcIlNwZWNpZnkgYSBsaXN0IG9mIGV4dGVuc2lvbnMgdGhhdCBhcmUgYWxsb3dlZCB0byB1c2UuIFRoaXMgaGVscHMgbWFpbnRhaW4gYSBzZWN1cmUgYW5kIGNvbnNpc3RlbnQgZGV2ZWxvcG1lbnQgZW52aXJvbm1lbnQgYnkgcmVzdHJpY3RpbmcgdGhlIHVzZSBvZiB1bmF1dGhvcml6ZWQgZXh0ZW5zaW9ucy4gTW9yZSBpbmZvcm1hdGlvbjogaHR0cHM6Ly9jb2RlLnZpc3VhbHN0dWRpby5jb20vZG9jcy9zZXR1cC9lbnRlcnByaXNlI19jb25maWd1cmUtYWxsb3dlZC1leHRlbnNpb25zXCIpLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0XHRcdHBhdHRlcm5Qcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0JyhbYS16MC05QS1aXVthLXowLTktQS1aXSopXFxcXC4oW2EtejAtOUEtWl1bYS16MC05LUEtWl0qKSQnOiB7XG5cdFx0XHRcdFx0XHRhbnlPZjogW1xuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogWydib29sZWFuJywgJ3N0cmluZyddLFxuXHRcdFx0XHRcdFx0XHRcdGVudW06IFt0cnVlLCBmYWxzZSwgJ3N0YWJsZSddLFxuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZXh0ZW5zaW9ucy5hbGxvdy5kZXNjcmlwdGlvbicsIFwiQWxsb3cgb3IgZGlzYWxsb3cgdGhlIGV4dGVuc2lvbi5cIiksXG5cdFx0XHRcdFx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdFx0XHRcdFx0bG9jYWxpemUoJ2V4dGVuc2lvbnMuYWxsb3dlZC5lbmFibGUuZGVzYycsIFwiRXh0ZW5zaW9uIGlzIGFsbG93ZWQuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdFx0bG9jYWxpemUoJ2V4dGVuc2lvbnMuYWxsb3dlZC5kaXNhYmxlLmRlc2MnLCBcIkV4dGVuc2lvbiBpcyBub3QgYWxsb3dlZC5cIiksXG5cdFx0XHRcdFx0XHRcdFx0XHRsb2NhbGl6ZSgnZXh0ZW5zaW9ucy5hbGxvd2VkLmRpc2FibGUuc3RhYmxlLmRlc2MnLCBcIkFsbG93IG9ubHkgc3RhYmxlIHZlcnNpb25zIG9mIHRoZSBleHRlbnNpb24uXCIpLFxuXHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRcdFx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZXh0ZW5zaW9ucy5hbGxvdy52ZXJzaW9uLmRlc2NyaXB0aW9uJywgXCJBbGxvdyBvciBkaXNhbGxvdyBzcGVjaWZpYyB2ZXJzaW9ucyBvZiB0aGUgZXh0ZW5zaW9uLiBUbyBzcGVjaWZjeSBhIHBsYXRmb3JtIHNwZWNpZmljIHZlcnNpb24sIHVzZSB0aGUgZm9ybWF0IGBwbGF0Zm9ybUAxLjIuM2AsIGUuZy4gYHdpbjMyLXg2NEAxLjIuM2AuIFN1cHBvcnRlZCBwbGF0Zm9ybXMgYXJlIGB3aW4zMi14NjRgLCBgd2luMzItYXJtNjRgLCBgbGludXgteDY0YCwgYGxpbnV4LWFybTY0YCwgYGxpbnV4LWFybWhmYCwgYGFscGluZS14NjRgLCBgYWxwaW5lLWFybTY0YCwgYGRhcndpbi14NjRgLCBgZGFyd2luLWFybTY0YFwiKSxcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdCcoW2EtejAtOUEtWl1bYS16MC05LUEtWl0qKSQnOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiBbJ2Jvb2xlYW4nLCAnc3RyaW5nJ10sXG5cdFx0XHRcdFx0XHRlbnVtOiBbdHJ1ZSwgZmFsc2UsICdzdGFibGUnXSxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZXh0ZW5zaW9uLnB1Ymxpc2hlci5hbGxvdy5kZXNjcmlwdGlvbicsIFwiQWxsb3cgb3IgZGlzYWxsb3cgYWxsIGV4dGVuc2lvbnMgZnJvbSB0aGUgcHVibGlzaGVyLlwiKSxcblx0XHRcdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRcdFx0bG9jYWxpemUoJ2V4dGVuc2lvbnMucHVibGlzaGVyLmFsbG93ZWQuZW5hYmxlLmRlc2MnLCBcIkFsbCBleHRlbnNpb25zIGZyb20gdGhlIHB1Ymxpc2hlciBhcmUgYWxsb3dlZC5cIiksXG5cdFx0XHRcdFx0XHRcdGxvY2FsaXplKCdleHRlbnNpb25zLnB1Ymxpc2hlci5hbGxvd2VkLmRpc2FibGUuZGVzYycsIFwiQWxsIGV4dGVuc2lvbnMgZnJvbSB0aGUgcHVibGlzaGVyIGFyZSBub3QgYWxsb3dlZC5cIiksXG5cdFx0XHRcdFx0XHRcdGxvY2FsaXplKCdleHRlbnNpb25zLnB1Ymxpc2hlci5hbGxvd2VkLmRpc2FibGUuc3RhYmxlLmRlc2MnLCBcIkFsbG93IG9ubHkgc3RhYmxlIHZlcnNpb25zIG9mIHRoZSBleHRlbnNpb25zIGZyb20gdGhlIHB1Ymxpc2hlci5cIiksXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0J1xcXFwqJzoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdFx0ZW51bTogW3RydWUsIGZhbHNlXSxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnZXh0ZW5zaW9ucy5hbGxvdy5hbGwuZGVzY3JpcHRpb24nLCBcIkFsbG93IG9yIGRpc2FsbG93IGFsbCBleHRlbnNpb25zLlwiKSxcblx0XHRcdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRcdFx0bG9jYWxpemUoJ2V4dGVuc2lvbnMuYWxsb3cuYWxsLmVuYWJsZScsIFwiQWxsb3cgYWxsIGV4dGVuc2lvbnMuXCIpLFxuXHRcdFx0XHRcdFx0XHRsb2NhbGl6ZSgnZXh0ZW5zaW9ucy5hbGxvdy5hbGwuZGlzYWJsZScsIFwiRGlzYWxsb3cgYWxsIGV4dGVuc2lvbnMuXCIpXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cbmNvbnN0IGpzb25SZWdpc3RyeSA9IDxqc29uQ29udHJpYnV0aW9uUmVnaXN0cnkuSUpTT05Db250cmlidXRpb25SZWdpc3RyeT5SZWdpc3RyeS5hcyhqc29uQ29udHJpYnV0aW9uUmVnaXN0cnkuRXh0ZW5zaW9ucy5KU09OQ29udHJpYnV0aW9uKTtcbmpzb25SZWdpc3RyeS5yZWdpc3RlclNjaGVtYShFeHRlbnNpb25zQ29uZmlndXJhdGlvblNjaGVtYUlkLCBFeHRlbnNpb25zQ29uZmlndXJhdGlvblNjaGVtYSk7XG5cbi8vIFJlZ2lzdGVyIENvbW1hbmRzXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnX2V4dGVuc2lvbnMubWFuYWdlJywgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBleHRlbnNpb25JZDogc3RyaW5nLCB0YWI/OiBFeHRlbnNpb25FZGl0b3JUYWIsIHByZXNlcnZlRm9jdXM/OiBib29sZWFuLCBmZWF0dXJlPzogc3RyaW5nKSA9PiB7XG5cdGNvbnN0IGV4dGVuc2lvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlKTtcblx0Y29uc3QgZXh0ZW5zaW9uID0gZXh0ZW5zaW9uU2VydmljZS5sb2NhbC5maW5kKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZS5pZGVudGlmaWVyLCB7IGlkOiBleHRlbnNpb25JZCB9KSk7XG5cdGlmIChleHRlbnNpb24pIHtcblx0XHRleHRlbnNpb25TZXJ2aWNlLm9wZW4oZXh0ZW5zaW9uLCB7IHRhYiwgcHJlc2VydmVGb2N1cywgZmVhdHVyZSB9KTtcblx0fSBlbHNlIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ25vdEZvdW5kJywgXCJFeHRlbnNpb24gJ3swfScgbm90IGZvdW5kLlwiLCBleHRlbnNpb25JZCkpO1xuXHR9XG59KTtcblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoJ2V4dGVuc2lvbi5vcGVuJywgYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBleHRlbnNpb25JZDogc3RyaW5nLCB0YWI/OiBFeHRlbnNpb25FZGl0b3JUYWIsIHByZXNlcnZlRm9jdXM/OiBib29sZWFuLCBmZWF0dXJlPzogc3RyaW5nLCBzaWRlQnlzaWRlPzogYm9vbGVhbikgPT4ge1xuXHRjb25zdCBleHRlbnNpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSk7XG5cdGNvbnN0IGNvbW1hbmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSk7XG5cblx0Y29uc3QgW2V4dGVuc2lvbl0gPSBhd2FpdCBleHRlbnNpb25TZXJ2aWNlLmdldEV4dGVuc2lvbnMoW3sgaWQ6IGV4dGVuc2lvbklkIH1dLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0aWYgKGV4dGVuc2lvbikge1xuXHRcdHJldHVybiBleHRlbnNpb25TZXJ2aWNlLm9wZW4oZXh0ZW5zaW9uLCB7IHRhYiwgcHJlc2VydmVGb2N1cywgZmVhdHVyZSwgc2lkZUJ5c2lkZSB9KTtcblx0fVxuXG5cdHJldHVybiBjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnX2V4dGVuc2lvbnMubWFuYWdlJywgZXh0ZW5zaW9uSWQsIHRhYiwgcHJlc2VydmVGb2N1cywgZmVhdHVyZSk7XG59KTtcblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoe1xuXHRpZDogJ3dvcmtiZW5jaC5leHRlbnNpb25zLmluc3RhbGxFeHRlbnNpb24nLFxuXHRtZXRhZGF0YToge1xuXHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmV4dGVuc2lvbnMuaW5zdGFsbEV4dGVuc2lvbi5kZXNjcmlwdGlvbicsIFwiSW5zdGFsbCB0aGUgZ2l2ZW4gZXh0ZW5zaW9uXCIpLFxuXHRcdGFyZ3M6IFtcblx0XHRcdHtcblx0XHRcdFx0bmFtZTogJ2V4dGVuc2lvbklkT3JWU0lYVXJpJyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3b3JrYmVuY2guZXh0ZW5zaW9ucy5pbnN0YWxsRXh0ZW5zaW9uLmFyZy5kZWNyaXB0aW9uJywgXCJFeHRlbnNpb24gaWQgb3IgVlNJWCByZXNvdXJjZSB1cmlcIiksXG5cdFx0XHRcdGNvbnN0cmFpbnQ6ICh2YWx1ZTogYW55KSA9PiB0eXBlb2YgdmFsdWUgPT09ICdzdHJpbmcnIHx8IHZhbHVlIGluc3RhbmNlb2YgVVJJLFxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0bmFtZTogJ29wdGlvbnMnLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogJyhvcHRpb25hbCkgT3B0aW9ucyBmb3IgaW5zdGFsbGluZyB0aGUgZXh0ZW5zaW9uLiBPYmplY3Qgd2l0aCB0aGUgZm9sbG93aW5nIHByb3BlcnRpZXM6ICcgK1xuXHRcdFx0XHRcdCdgaW5zdGFsbE9ubHlOZXdseUFkZGVkRnJvbUV4dGVuc2lvblBhY2tWU0lYYDogV2hlbiBlbmFibGVkLCBWUyBDb2RlIGluc3RhbGxzIG9ubHkgbmV3bHkgYWRkZWQgZXh0ZW5zaW9ucyBmcm9tIHRoZSBleHRlbnNpb24gcGFjayBWU0lYLiBUaGlzIG9wdGlvbiBpcyBjb25zaWRlcmVkIG9ubHkgd2hlbiBpbnN0YWxsaW5nIFZTSVguICcsXG5cdFx0XHRcdGlzT3B0aW9uYWw6IHRydWUsXG5cdFx0XHRcdHNjaGVtYToge1xuXHRcdFx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdFx0XHQnaW5zdGFsbE9ubHlOZXdseUFkZGVkRnJvbUV4dGVuc2lvblBhY2tWU0lYJzoge1xuXHRcdFx0XHRcdFx0XHQndHlwZSc6ICdib29sZWFuJyxcblx0XHRcdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ3dvcmtiZW5jaC5leHRlbnNpb25zLmluc3RhbGxFeHRlbnNpb24ub3B0aW9uLmluc3RhbGxPbmx5TmV3bHlBZGRlZEZyb21FeHRlbnNpb25QYWNrVlNJWCcsIFwiV2hlbiBlbmFibGVkLCBWUyBDb2RlIGluc3RhbGxzIG9ubHkgbmV3bHkgYWRkZWQgZXh0ZW5zaW9ucyBmcm9tIHRoZSBleHRlbnNpb24gcGFjayBWU0lYLiBUaGlzIG9wdGlvbiBpcyBjb25zaWRlcmVkIG9ubHkgd2hpbGUgaW5zdGFsbGluZyBhIFZTSVguXCIpLFxuXHRcdFx0XHRcdFx0XHRkZWZhdWx0OiBmYWxzZVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdCdpbnN0YWxsUHJlUmVsZWFzZVZlcnNpb24nOiB7XG5cdFx0XHRcdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmV4dGVuc2lvbnMuaW5zdGFsbEV4dGVuc2lvbi5vcHRpb24uaW5zdGFsbFByZVJlbGVhc2VWZXJzaW9uJywgXCJXaGVuIGVuYWJsZWQsIFZTIENvZGUgaW5zdGFsbHMgdGhlIHByZS1yZWxlYXNlIHZlcnNpb24gb2YgdGhlIGV4dGVuc2lvbiBpZiBhdmFpbGFibGUuXCIpLFxuXHRcdFx0XHRcdFx0XHRkZWZhdWx0OiBmYWxzZVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdCdkb25vdFN5bmMnOiB7XG5cdFx0XHRcdFx0XHRcdCd0eXBlJzogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdFx0XHQnZGVzY3JpcHRpb24nOiBsb2NhbGl6ZSgnd29ya2JlbmNoLmV4dGVuc2lvbnMuaW5zdGFsbEV4dGVuc2lvbi5vcHRpb24uZG9ub3RTeW5jJywgXCJXaGVuIGVuYWJsZWQsIFZTIENvZGUgZG8gbm90IHN5bmMgdGhpcyBleHRlbnNpb24gd2hlbiBTZXR0aW5ncyBTeW5jIGlzIG9uLlwiKSxcblx0XHRcdFx0XHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHQnanVzdGlmaWNhdGlvbic6IHtcblx0XHRcdFx0XHRcdFx0J3R5cGUnOiBbJ3N0cmluZycsICdvYmplY3QnXSxcblx0XHRcdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJzogbG9jYWxpemUoJ3dvcmtiZW5jaC5leHRlbnNpb25zLmluc3RhbGxFeHRlbnNpb24ub3B0aW9uLmp1c3RpZmljYXRpb24nLCBcIkp1c3RpZmljYXRpb24gZm9yIGluc3RhbGxpbmcgdGhlIGV4dGVuc2lvbi4gVGhpcyBpcyBhIHN0cmluZyBvciBhbiBvYmplY3QgdGhhdCBjYW4gYmUgdXNlZCB0byBwYXNzIGFueSBpbmZvcm1hdGlvbiB0byB0aGUgaW5zdGFsbGF0aW9uIGhhbmRsZXJzLiBpLmUuIGB7cmVhc29uOiAnVGhpcyBleHRlbnNpb24gd2FudHMgdG8gb3BlbiBhIFVSSScsIGFjdGlvbjogJ09wZW4gVVJJJ31gIHdpbGwgc2hvdyBhIG1lc3NhZ2UgYm94IHdpdGggdGhlIHJlYXNvbiBhbmQgYWN0aW9uIHVwb24gaW5zdGFsbC5cIiksXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0J2VuYWJsZSc6IHtcblx0XHRcdFx0XHRcdFx0J3R5cGUnOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCd3b3JrYmVuY2guZXh0ZW5zaW9ucy5pbnN0YWxsRXh0ZW5zaW9uLm9wdGlvbi5lbmFibGUnLCBcIldoZW4gZW5hYmxlZCwgdGhlIGV4dGVuc2lvbiB3aWxsIGJlIGVuYWJsZWQgaWYgaXQgaXMgaW5zdGFsbGVkIGJ1dCBkaXNhYmxlZC4gSWYgdGhlIGV4dGVuc2lvbiBpcyBhbHJlYWR5IGVuYWJsZWQsIHRoaXMgaGFzIG5vIGVmZmVjdC5cIiksXG5cdFx0XHRcdFx0XHRcdGRlZmF1bHQ6IGZhbHNlXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0J2NvbnRleHQnOiB7XG5cdFx0XHRcdFx0XHRcdCd0eXBlJzogJ29iamVjdCcsXG5cdFx0XHRcdFx0XHRcdCdkZXNjcmlwdGlvbic6IGxvY2FsaXplKCd3b3JrYmVuY2guZXh0ZW5zaW9ucy5pbnN0YWxsRXh0ZW5zaW9uLm9wdGlvbi5jb250ZXh0JywgXCJDb250ZXh0IGZvciB0aGUgaW5zdGFsbGF0aW9uLiBUaGlzIGlzIGEgSlNPTiBvYmplY3QgdGhhdCBjYW4gYmUgdXNlZCB0byBwYXNzIGFueSBpbmZvcm1hdGlvbiB0byB0aGUgaW5zdGFsbGF0aW9uIGhhbmRsZXJzLiBpLmUuIGB7c2tpcFdhbGt0aHJvdWdoOiB0cnVlfWAgd2lsbCBza2lwIG9wZW5pbmcgdGhlIHdhbGt0aHJvdWdoIHVwb24gaW5zdGFsbC5cIiksXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XVxuXHR9LFxuXHRoYW5kbGVyOiBhc3luYyAoXG5cdFx0YWNjZXNzb3IsXG5cdFx0YXJnOiBzdHJpbmcgfCBVcmlDb21wb25lbnRzLFxuXHRcdG9wdGlvbnM/OiB7XG5cdFx0XHRpbnN0YWxsT25seU5ld2x5QWRkZWRGcm9tRXh0ZW5zaW9uUGFja1ZTSVg/OiBib29sZWFuO1xuXHRcdFx0aW5zdGFsbFByZVJlbGVhc2VWZXJzaW9uPzogYm9vbGVhbjtcblx0XHRcdGRvbm90U3luYz86IGJvb2xlYW47XG5cdFx0XHRqdXN0aWZpY2F0aW9uPzogc3RyaW5nIHwgeyByZWFzb246IHN0cmluZzsgYWN0aW9uOiBzdHJpbmcgfTtcblx0XHRcdGVuYWJsZT86IGJvb2xlYW47XG5cdFx0XHRjb250ZXh0PzogSVN0cmluZ0RpY3Rpb25hcnk8YW55Pjtcblx0XHR9KSA9PiB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlKTtcblx0XHRjb25zdCBleHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2JlbmNoRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UpO1xuXHRcdGNvbnN0IGV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSk7XG5cdFx0dHJ5IHtcblx0XHRcdGlmICh0eXBlb2YgYXJnID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRjb25zdCBbaWQsIHZlcnNpb25dID0gZ2V0SWRBbmRWZXJzaW9uKGFyZyk7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbiA9IGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmxvY2FsLmZpbmQoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIHsgaWQsIHV1aWQ6IHZlcnNpb24gfSkpO1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uPy5lbmFibGVtZW50U3RhdGUgPT09IEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEJ5RXh0ZW5zaW9uS2luZCkge1xuXHRcdFx0XHRcdGNvbnN0IFtnYWxsZXJ5XSA9IGF3YWl0IGV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLmdldEV4dGVuc2lvbnMoW3sgaWQsIHByZVJlbGVhc2U6IG9wdGlvbnM/Lmluc3RhbGxQcmVSZWxlYXNlVmVyc2lvbiB9XSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRcdFx0aWYgKCFnYWxsZXJ5KSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ25vdEZvdW5kJywgXCJFeHRlbnNpb24gJ3swfScgbm90IGZvdW5kLlwiLCBhcmcpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YXdhaXQgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuaW5zdGFsbEZyb21HYWxsZXJ5KGdhbGxlcnksIHtcblx0XHRcdFx0XHRcdGlzTWFjaGluZVNjb3BlZDogb3B0aW9ucz8uZG9ub3RTeW5jID8gdHJ1ZSA6IHVuZGVmaW5lZCwgLyogZG8gbm90IGFsbG93IHN5bmNpbmcgZXh0ZW5zaW9ucyBhdXRvbWF0aWNhbGx5IHdoaWxlIGluc3RhbGxpbmcgdGhyb3VnaCB0aGUgY29tbWFuZCAqL1xuXHRcdFx0XHRcdFx0aW5zdGFsbFByZVJlbGVhc2VWZXJzaW9uOiBvcHRpb25zPy5pbnN0YWxsUHJlUmVsZWFzZVZlcnNpb24sXG5cdFx0XHRcdFx0XHRpbnN0YWxsR2l2ZW5WZXJzaW9uOiAhIXZlcnNpb24sXG5cdFx0XHRcdFx0XHRjb250ZXh0OiB7IC4uLm9wdGlvbnM/LmNvbnRleHQsIFtFWFRFTlNJT05fSU5TVEFMTF9TT1VSQ0VfQ09OVEVYVF06IEV4dGVuc2lvbkluc3RhbGxTb3VyY2UuQ09NTUFORCB9LFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGF3YWl0IGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmluc3RhbGwoYXJnLCB7XG5cdFx0XHRcdFx0XHR2ZXJzaW9uLFxuXHRcdFx0XHRcdFx0aW5zdGFsbFByZVJlbGVhc2VWZXJzaW9uOiBvcHRpb25zPy5pbnN0YWxsUHJlUmVsZWFzZVZlcnNpb24sXG5cdFx0XHRcdFx0XHRjb250ZXh0OiB7IC4uLm9wdGlvbnM/LmNvbnRleHQsIFtFWFRFTlNJT05fSU5TVEFMTF9TT1VSQ0VfQ09OVEVYVF06IEV4dGVuc2lvbkluc3RhbGxTb3VyY2UuQ09NTUFORCB9LFxuXHRcdFx0XHRcdFx0anVzdGlmaWNhdGlvbjogb3B0aW9ucz8uanVzdGlmaWNhdGlvbixcblx0XHRcdFx0XHRcdGVuYWJsZTogb3B0aW9ucz8uZW5hYmxlLFxuXHRcdFx0XHRcdFx0aXNNYWNoaW5lU2NvcGVkOiBvcHRpb25zPy5kb25vdFN5bmMgPyB0cnVlIDogdW5kZWZpbmVkLCAvKiBkbyBub3QgYWxsb3cgc3luY2luZyBleHRlbnNpb25zIGF1dG9tYXRpY2FsbHkgd2hpbGUgaW5zdGFsbGluZyB0aHJvdWdoIHRoZSBjb21tYW5kICovXG5cdFx0XHRcdFx0fSwgUHJvZ3Jlc3NMb2NhdGlvbi5Ob3RpZmljYXRpb24pO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCB2c2l4ID0gVVJJLnJldml2ZShhcmcpO1xuXHRcdFx0XHRhd2FpdCBleHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5pbnN0YWxsKHZzaXgsIHsgaW5zdGFsbEdpdmVuVmVyc2lvbjogdHJ1ZSB9KTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlKTtcblx0XHRcdHRocm93IGU7XG5cdFx0fVxuXHR9XG59KTtcblxuQ29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoe1xuXHRpZDogJ3dvcmtiZW5jaC5leHRlbnNpb25zLnVuaW5zdGFsbEV4dGVuc2lvbicsXG5cdG1ldGFkYXRhOiB7XG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd3b3JrYmVuY2guZXh0ZW5zaW9ucy51bmluc3RhbGxFeHRlbnNpb24uZGVzY3JpcHRpb24nLCBcIlVuaW5zdGFsbCB0aGUgZ2l2ZW4gZXh0ZW5zaW9uXCIpLFxuXHRcdGFyZ3M6IFtcblx0XHRcdHtcblx0XHRcdFx0bmFtZTogbG9jYWxpemUoJ3dvcmtiZW5jaC5leHRlbnNpb25zLnVuaW5zdGFsbEV4dGVuc2lvbi5hcmcubmFtZScsIFwiSWQgb2YgdGhlIGV4dGVuc2lvbiB0byB1bmluc3RhbGxcIiksXG5cdFx0XHRcdHNjaGVtYToge1xuXHRcdFx0XHRcdCd0eXBlJzogJ3N0cmluZydcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdF1cblx0fSxcblx0aGFuZGxlcjogYXN5bmMgKGFjY2Vzc29yLCBpZDogc3RyaW5nKSA9PiB7XG5cdFx0aWYgKCFpZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGxvY2FsaXplKCdpZCByZXF1aXJlZCcsIFwiRXh0ZW5zaW9uIGlkIHJlcXVpcmVkLlwiKSk7XG5cdFx0fVxuXHRcdGNvbnN0IGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSk7XG5cdFx0Y29uc3QgaW5zdGFsbGVkID0gYXdhaXQgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuZ2V0SW5zdGFsbGVkKCk7XG5cdFx0Y29uc3QgW2V4dGVuc2lvblRvVW5pbnN0YWxsXSA9IGluc3RhbGxlZC5maWx0ZXIoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIHsgaWQgfSkpO1xuXHRcdGlmICghZXh0ZW5zaW9uVG9Vbmluc3RhbGwpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihsb2NhbGl6ZSgnbm90SW5zdGFsbGVkJywgXCJFeHRlbnNpb24gJ3swfScgaXMgbm90IGluc3RhbGxlZC4gTWFrZSBzdXJlIHlvdSB1c2UgdGhlIGZ1bGwgZXh0ZW5zaW9uIElELCBpbmNsdWRpbmcgdGhlIHB1Ymxpc2hlciwgZS5nLjogbXMtZG90bmV0dG9vbHMuY3NoYXJwLlwiLCBpZCkpO1xuXHRcdH1cblx0XHRpZiAoZXh0ZW5zaW9uVG9Vbmluc3RhbGwuaXNCdWlsdGluKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IobG9jYWxpemUoJ2J1aWx0aW4nLCBcIkV4dGVuc2lvbiAnezB9JyBpcyBhIEJ1aWx0LWluIGV4dGVuc2lvbiBhbmQgY2Fubm90IGJlIGluc3RhbGxlZFwiLCBpZCkpO1xuXHRcdH1cblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBleHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS51bmluc3RhbGwoZXh0ZW5zaW9uVG9Vbmluc3RhbGwpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGUpO1xuXHRcdFx0dGhyb3cgZTtcblx0XHR9XG5cdH1cbn0pO1xuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdGlkOiAnd29ya2JlbmNoLmV4dGVuc2lvbnMuc2VhcmNoJyxcblx0bWV0YWRhdGE6IHtcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3dvcmtiZW5jaC5leHRlbnNpb25zLnNlYXJjaC5kZXNjcmlwdGlvbicsIFwiU2VhcmNoIGZvciBhIHNwZWNpZmljIGV4dGVuc2lvblwiKSxcblx0XHRhcmdzOiBbXG5cdFx0XHR7XG5cdFx0XHRcdG5hbWU6IGxvY2FsaXplKCd3b3JrYmVuY2guZXh0ZW5zaW9ucy5zZWFyY2guYXJnLm5hbWUnLCBcIlF1ZXJ5IHRvIHVzZSBpbiBzZWFyY2hcIiksXG5cdFx0XHRcdHNjaGVtYTogeyAndHlwZSc6ICdzdHJpbmcnIH1cblx0XHRcdH1cblx0XHRdXG5cdH0sXG5cdGhhbmRsZXI6IGFzeW5jIChhY2Nlc3NvciwgcXVlcnk6IHN0cmluZyA9ICcnKSA9PiB7XG5cdFx0cmV0dXJuIGFjY2Vzc29yLmdldChJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UpLm9wZW5TZWFyY2gocXVlcnkpO1xuXHR9XG59KTtcblxuZnVuY3Rpb24gb3ZlcnJpZGVBY3Rpb25Gb3JBY3RpdmVFeHRlbnNpb25FZGl0b3JXZWJ2aWV3KGNvbW1hbmQ6IE11bHRpQ29tbWFuZCB8IHVuZGVmaW5lZCwgZjogKHdlYnZpZXc6IElXZWJ2aWV3KSA9PiB2b2lkKSB7XG5cdGNvbW1hbmQ/LmFkZEltcGxlbWVudGF0aW9uKDEwNSwgJ2V4dGVuc2lvbnMtZWRpdG9yJywgKGFjY2Vzc29yKSA9PiB7XG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLmdldChJRWRpdG9yU2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lO1xuXHRcdGlmIChlZGl0b3IgaW5zdGFuY2VvZiBFeHRlbnNpb25FZGl0b3IpIHtcblx0XHRcdGlmIChlZGl0b3IuYWN0aXZlV2Vidmlldz8uaXNGb2N1c2VkKSB7XG5cdFx0XHRcdGYoZWRpdG9yLmFjdGl2ZVdlYnZpZXcpO1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9KTtcbn1cblxub3ZlcnJpZGVBY3Rpb25Gb3JBY3RpdmVFeHRlbnNpb25FZGl0b3JXZWJ2aWV3KENvcHlBY3Rpb24sIHdlYnZpZXcgPT4gd2Vidmlldy5jb3B5KCkpO1xub3ZlcnJpZGVBY3Rpb25Gb3JBY3RpdmVFeHRlbnNpb25FZGl0b3JXZWJ2aWV3KEN1dEFjdGlvbiwgd2VidmlldyA9PiB3ZWJ2aWV3LmN1dCgpKTtcbm92ZXJyaWRlQWN0aW9uRm9yQWN0aXZlRXh0ZW5zaW9uRWRpdG9yV2VidmlldyhQYXN0ZUFjdGlvbiwgd2VidmlldyA9PiB3ZWJ2aWV3LnBhc3RlKCkpO1xuXG4vLyBDb250ZXh0c1xuZXhwb3J0IGNvbnN0IENPTlRFWFRfSEFTX0xPQ0FMX1NFUlZFUiA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdoYXNMb2NhbFNlcnZlcicsIGZhbHNlKTtcbmV4cG9ydCBjb25zdCBDT05URVhUX0hBU19SRU1PVEVfU0VSVkVSID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ2hhc1JlbW90ZVNlcnZlcicsIGZhbHNlKTtcbmV4cG9ydCBjb25zdCBDT05URVhUX0hBU19XRUJfU0VSVkVSID0gbmV3IFJhd0NvbnRleHRLZXk8Ym9vbGVhbj4oJ2hhc1dlYlNlcnZlcicsIGZhbHNlKTtcbmNvbnN0IENPTlRFWFRfR0FMTEVSWV9TT1JUX0NBUEFCSUxJVElFUyA9IG5ldyBSYXdDb250ZXh0S2V5PHN0cmluZz4oJ2dhbGxlcnlTb3J0Q2FwYWJpbGl0aWVzJywgJycpO1xuY29uc3QgQ09OVEVYVF9HQUxMRVJZX0ZJTFRFUl9DQVBBQklMSVRJRVMgPSBuZXcgUmF3Q29udGV4dEtleTxzdHJpbmc+KCdnYWxsZXJ5RmlsdGVyQ2FwYWJpbGl0aWVzJywgJycpO1xuY29uc3QgQ09OVEVYVF9HQUxMRVJZX0FMTF9SRVBPU0lUT1JZX1NJR05FRCA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdnYWxsZXJ5QWxsUmVwb3NpdG9yeVNpZ25lZCcsIGZhbHNlKTtcbmNvbnN0IENPTlRFWFRfR0FMTEVSWV9IQVNfRVhURU5TSU9OX0xJTksgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPignZ2FsbGVyeUhhc0V4dGVuc2lvbkxpbmsnLCBmYWxzZSk7XG5cbmFzeW5jIGZ1bmN0aW9uIHJ1bkFjdGlvbihhY3Rpb246IElBY3Rpb24pOiBQcm9taXNlPHZvaWQ+IHtcblx0dHJ5IHtcblx0XHRhd2FpdCBhY3Rpb24ucnVuKCk7XG5cdH0gZmluYWxseSB7XG5cdFx0aWYgKGlzRGlzcG9zYWJsZShhY3Rpb24pKSB7XG5cdFx0XHRhY3Rpb24uZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxufVxuXG50eXBlIElFeHRlbnNpb25BY3Rpb25PcHRpb25zID0gSUFjdGlvbjJPcHRpb25zICYge1xuXHRtZW51VGl0bGVzPzogeyBbaWQ6IHN0cmluZ106IHN0cmluZyB9O1xuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+O1xufTtcblxuY2xhc3MgRXh0ZW5zaW9uc0NvbnRyaWJ1dGlvbnMgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlOiBJRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25HYWxsZXJ5U2VydmljZSBleHRlbnNpb25HYWxsZXJ5U2VydmljZTogSUV4dGVuc2lvbkdhbGxlcnlTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZSBleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3RTZXJ2aWNlOiBJRXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASVZpZXdzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHZpZXdzU2VydmljZTogSVZpZXdzU2VydmljZSxcblx0XHRASUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2U6IElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2U6IElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHRjb25zdCBoYXNHYWxsZXJ5Q29udGV4dCA9IENPTlRFWFRfSEFTX0dBTExFUlkuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRpZiAoZXh0ZW5zaW9uR2FsbGVyeVNlcnZpY2UuaXNFbmFibGVkKCkpIHtcblx0XHRcdGhhc0dhbGxlcnlDb250ZXh0LnNldCh0cnVlKTtcblx0XHR9XG5cblx0XHRjb25zdCBoYXNMb2NhbFNlcnZlckNvbnRleHQgPSBDT05URVhUX0hBU19MT0NBTF9TRVJWRVIuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRpZiAodGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5sb2NhbEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpIHtcblx0XHRcdGhhc0xvY2FsU2VydmVyQ29udGV4dC5zZXQodHJ1ZSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGFzUmVtb3RlU2VydmVyQ29udGV4dCA9IENPTlRFWFRfSEFTX1JFTU9URV9TRVJWRVIuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHRpZiAodGhpcy5leHRlbnNpb25NYW5hZ2VtZW50U2VydmVyU2VydmljZS5yZW1vdGVFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyKSB7XG5cdFx0XHRoYXNSZW1vdGVTZXJ2ZXJDb250ZXh0LnNldCh0cnVlKTtcblx0XHR9XG5cblx0XHRjb25zdCBoYXNXZWJTZXJ2ZXJDb250ZXh0ID0gQ09OVEVYVF9IQVNfV0VCX1NFUlZFUi5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdGlmICh0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLndlYkV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXIpIHtcblx0XHRcdGhhc1dlYlNlcnZlckNvbnRleHQuc2V0KHRydWUpO1xuXHRcdH1cblxuXHRcdGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdFNlcnZpY2UuZ2V0RXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0KClcblx0XHRcdC50aGVuKGV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdCA9PiB7XG5cdFx0XHRcdHRoaXMucmVnaXN0ZXJHYWxsZXJ5Q2FwYWJpbGl0aWVzQ29udGV4dHMoZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0KTtcblx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIoZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0U2VydmljZS5vbkRpZENoYW5nZUV4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdChleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QgPT4gdGhpcy5yZWdpc3RlckdhbGxlcnlDYXBhYmlsaXRpZXNDb250ZXh0cyhleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QpKSk7XG5cdFx0XHR9KTtcblx0XHR0aGlzLnJlZ2lzdGVyR2xvYmFsQWN0aW9ucygpO1xuXHRcdHRoaXMucmVnaXN0ZXJDb250ZXh0TWVudUFjdGlvbnMoKTtcblx0XHR0aGlzLnJlZ2lzdGVyUXVpY2tBY2Nlc3NQcm92aWRlcigpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZWdpc3RlckdhbGxlcnlDYXBhYmlsaXRpZXNDb250ZXh0cyhleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3Q6IElFeHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QgfCBudWxsKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Q09OVEVYVF9HQUxMRVJZX1NPUlRfQ0FQQUJJTElUSUVTLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKS5zZXQoYF8ke2V4dGVuc2lvbkdhbGxlcnlNYW5pZmVzdD8uY2FwYWJpbGl0aWVzLmV4dGVuc2lvblF1ZXJ5LnNvcnRpbmc/Lm1hcChzID0+IHMubmFtZSk/LmpvaW4oJ18nKX1fVXBkYXRlRGF0ZV9gKTtcblx0XHRDT05URVhUX0dBTExFUllfRklMVEVSX0NBUEFCSUxJVElFUy5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSkuc2V0KGBfJHtleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3Q/LmNhcGFiaWxpdGllcy5leHRlbnNpb25RdWVyeS5maWx0ZXJpbmc/Lm1hcChzID0+IHMubmFtZSk/LmpvaW4oJ18nKX1fYCk7XG5cdFx0Q09OVEVYVF9HQUxMRVJZX0FMTF9SRVBPU0lUT1JZX1NJR05FRC5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSkuc2V0KCEhZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0Py5jYXBhYmlsaXRpZXM/LnNpZ25pbmc/LmFsbFJlcG9zaXRvcnlTaWduZWQpO1xuXHRcdENPTlRFWFRfR0FMTEVSWV9IQVNfRVhURU5TSU9OX0xJTksuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpLnNldCghIShleHRlbnNpb25HYWxsZXJ5TWFuaWZlc3QgJiYgZ2V0RXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0UmVzb3VyY2VVcmkoZXh0ZW5zaW9uR2FsbGVyeU1hbmlmZXN0LCBFeHRlbnNpb25HYWxsZXJ5UmVzb3VyY2VUeXBlLkV4dGVuc2lvbkRldGFpbHNWaWV3VXJpKSkpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlclF1aWNrQWNjZXNzUHJvdmlkZXIoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2UubG9jYWxFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyXG5cdFx0XHR8fCB0aGlzLmV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJTZXJ2aWNlLnJlbW90ZUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJcblx0XHRcdHx8IHRoaXMuZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclNlcnZpY2Uud2ViRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZlclxuXHRcdCkge1xuXHRcdFx0UmVnaXN0cnkuYXM8SVF1aWNrQWNjZXNzUmVnaXN0cnk+KEV4dGVuc2lvbnMuUXVpY2thY2Nlc3MpLnJlZ2lzdGVyUXVpY2tBY2Nlc3NQcm92aWRlcih7XG5cdFx0XHRcdGN0b3I6IEluc3RhbGxFeHRlbnNpb25RdWlja0FjY2Vzc1Byb3ZpZGVyLFxuXHRcdFx0XHRwcmVmaXg6IEluc3RhbGxFeHRlbnNpb25RdWlja0FjY2Vzc1Byb3ZpZGVyLlBSRUZJWCxcblx0XHRcdFx0cGxhY2Vob2xkZXI6IGxvY2FsaXplKCdpbnN0YWxsRXh0ZW5zaW9uUXVpY2tBY2Nlc3NQbGFjZWhvbGRlcicsIFwiVHlwZSB0aGUgbmFtZSBvZiBhbiBleHRlbnNpb24gdG8gaW5zdGFsbCBvciBzZWFyY2guXCIpLFxuXHRcdFx0XHRoZWxwRW50cmllczogW3sgZGVzY3JpcHRpb246IGxvY2FsaXplKCdpbnN0YWxsRXh0ZW5zaW9uUXVpY2tBY2Nlc3NIZWxwJywgXCJJbnN0YWxsIG9yIFNlYXJjaCBFeHRlbnNpb25zXCIpIH1dXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblxuXHQvLyBHbG9iYWwgYWN0aW9uc1xuXHRwcml2YXRlIHJlZ2lzdGVyR2xvYmFsQWN0aW9ucygpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3RlcihNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJQcmVmZXJlbmNlc01lbnUsIHtcblx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0aWQ6IFZJRVdMRVRfSUQsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pUHJlZmVyZW5jZXNFeHRlbnNpb25zJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCBcIiYmRXh0ZW5zaW9uc1wiKVxuXHRcdFx0fSxcblx0XHRcdGdyb3VwOiAnMl9jb25maWd1cmF0aW9uJyxcblx0XHRcdG9yZGVyOiAzXG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbShNZW51SWQuR2xvYmFsQWN0aXZpdHksIHtcblx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0aWQ6IFZJRVdMRVRfSUQsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnc2hvd0V4dGVuc2lvbnMnLCBcIkV4dGVuc2lvbnNcIilcblx0XHRcdH0sXG5cdFx0XHRncm91cDogJzJfY29uZmlndXJhdGlvbicsXG5cdFx0XHRvcmRlcjogM1xuXHRcdH0pKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uZm9jdXNFeHRlbnNpb25zVmlldycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdmb2N1c0V4dGVuc2lvbnMnLCAnRm9jdXMgb24gRXh0ZW5zaW9ucyBWaWV3JyksXG5cdFx0XHRjYXRlZ29yeTogRXh0ZW5zaW9uc0xvY2FsaXplZExhYmVsLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRydW46IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4ge1xuXHRcdFx0XHRhd2FpdCBhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlKS5vcGVuU2VhcmNoKCcnKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uaW5zdGFsbEV4dGVuc2lvbnMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignaW5zdGFsbEV4dGVuc2lvbnMnLCAnSW5zdGFsbCBFeHRlbnNpb25zJyksXG5cdFx0XHRjYXRlZ29yeTogRXh0ZW5zaW9uc0xvY2FsaXplZExhYmVsLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9IQVNfR0FMTEVSWSwgQ29udGV4dEtleUV4cHIub3IoQ09OVEVYVF9IQVNfTE9DQUxfU0VSVkVSLCBDT05URVhUX0hBU19SRU1PVEVfU0VSVkVSLCBDT05URVhUX0hBU19XRUJfU0VSVkVSKSlcblx0XHRcdH0sXG5cdFx0XHRydW46IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4ge1xuXHRcdFx0XHRhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSkub3BlblZpZXdDb250YWluZXIoVklFV0xFVF9JRCwgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXh0ZW5zaW9uQWN0aW9uKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLnNob3dSZWNvbW1lbmRlZEtleW1hcEV4dGVuc2lvbnMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc2hvd1JlY29tbWVuZGVkS2V5bWFwRXh0ZW5zaW9uc1Nob3J0JywgJ0tleW1hcHMnKSxcblx0XHRcdGNhdGVnb3J5OiBQcmVmZXJlbmNlc0xvY2FsaXplZExhYmVsLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogQ09OVEVYVF9IQVNfR0FMTEVSWVxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogTWVudUlkLkVkaXRvclRpdGxlLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9LRVlCSU5ESU5HU19FRElUT1IsIENPTlRFWFRfSEFTX0dBTExFUlkpLFxuXHRcdFx0XHRncm91cDogJzJfa2V5Ym9hcmRfZGlzY292ZXJfYWN0aW9ucydcblx0XHRcdH1dLFxuXHRcdFx0bWVudVRpdGxlczoge1xuXHRcdFx0XHRbTWVudUlkLkVkaXRvclRpdGxlLmlkXTogbG9jYWxpemUoJ2ltcG9ydEtleWJvYXJkU2hvcnRjdXRzRnJvbXMnLCBcIk1pZ3JhdGUgS2V5Ym9hcmQgU2hvcnRjdXRzIGZyb20uLi5cIilcblx0XHRcdH0sXG5cdFx0XHRydW46ICgpID0+IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub3BlblNlYXJjaCgnQHJlY29tbWVuZGVkOmtleW1hcHMgJylcblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uc2hvd0xhbmd1YWdlRXh0ZW5zaW9ucycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzaG93TGFuZ3VhZ2VFeHRlbnNpb25zU2hvcnQnLCAnTGFuZ3VhZ2UgRXh0ZW5zaW9ucycpLFxuXHRcdFx0Y2F0ZWdvcnk6IFByZWZlcmVuY2VzTG9jYWxpemVkTGFiZWwsXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IENPTlRFWFRfSEFTX0dBTExFUllcblx0XHRcdH0sXG5cdFx0XHRydW46ICgpID0+IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub3BlblNlYXJjaCgnQHJlY29tbWVuZGVkOmxhbmd1YWdlcyAnKVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbkFjdGlvbih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5jaGVja0ZvclVwZGF0ZXMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignY2hlY2tGb3JVcGRhdGVzJywgJ0NoZWNrIGZvciBFeHRlbnNpb24gVXBkYXRlcycpLFxuXHRcdFx0Y2F0ZWdvcnk6IEV4dGVuc2lvbnNMb2NhbGl6ZWRMYWJlbCxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0hBU19HQUxMRVJZLCBDb250ZXh0S2V5RXhwci5vcihDT05URVhUX0hBU19MT0NBTF9TRVJWRVIsIENPTlRFWFRfSEFTX1JFTU9URV9TRVJWRVIsIENPTlRFWFRfSEFTX1dFQl9TRVJWRVIpKVxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdDb250YWluZXJUaXRsZSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygndmlld0NvbnRhaW5lcicsIFZJRVdMRVRfSUQpLCBDT05URVhUX0hBU19HQUxMRVJZKSxcblx0XHRcdFx0Z3JvdXA6ICcxX3VwZGF0ZXMnLFxuXHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0fV0sXG5cdFx0XHRydW46IGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5jaGVja0ZvclVwZGF0ZXMoKTtcblx0XHRcdFx0Y29uc3Qgb3V0ZGF0ZWQgPSB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLm91dGRhdGVkO1xuXHRcdFx0XHRpZiAob3V0ZGF0ZWQubGVuZ3RoKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub3BlblNlYXJjaCgnQG91dGRhdGVkICcpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmRpYWxvZ1NlcnZpY2UuaW5mbyhsb2NhbGl6ZSgnbm9VcGRhdGVzQXZhaWxhYmxlJywgXCJBbGwgZXh0ZW5zaW9ucyBhcmUgdXAgdG8gZGF0ZS5cIikpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBlbmFibGVBdXRvVXBkYXRlV2hlbkNvbmRpdGlvbiA9IENvbnRleHRLZXlFeHByLmVxdWFscyhgY29uZmlnLiR7QXV0b1VwZGF0ZUNvbmZpZ3VyYXRpb25LZXl9YCwgZmFsc2UpO1xuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uZW5hYmxlQXV0b1VwZGF0ZScsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdlbmFibGVBdXRvVXBkYXRlJywgJ0VuYWJsZSBBdXRvIFVwZGF0ZSBmb3IgQWxsIEV4dGVuc2lvbnMnKSxcblx0XHRcdGNhdGVnb3J5OiBFeHRlbnNpb25zTG9jYWxpemVkTGFiZWwsXG5cdFx0XHRwcmVjb25kaXRpb246IGVuYWJsZUF1dG9VcGRhdGVXaGVuQ29uZGl0aW9uLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3Q29udGFpbmVyVGl0bGUsXG5cdFx0XHRcdG9yZGVyOiA1LFxuXHRcdFx0XHRncm91cDogJzFfdXBkYXRlcycsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXdDb250YWluZXInLCBWSUVXTEVUX0lEKSwgZW5hYmxlQXV0b1VwZGF0ZVdoZW5Db25kaXRpb24pXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHR9XSxcblx0XHRcdHJ1bjogKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSA9PiBhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlKS51cGRhdGVBdXRvVXBkYXRlRm9yQWxsRXh0ZW5zaW9ucyh0cnVlKVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZGlzYWJsZUF1dG9VcGRhdGVXaGVuQ29uZGl0aW9uID0gQ29udGV4dEtleUV4cHIubm90RXF1YWxzKGBjb25maWcuJHtBdXRvVXBkYXRlQ29uZmlndXJhdGlvbktleX1gLCBmYWxzZSk7XG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbkFjdGlvbih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5kaXNhYmxlQXV0b1VwZGF0ZScsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdkaXNhYmxlQXV0b1VwZGF0ZScsICdEaXNhYmxlIEF1dG8gVXBkYXRlIGZvciBBbGwgRXh0ZW5zaW9ucycpLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBkaXNhYmxlQXV0b1VwZGF0ZVdoZW5Db25kaXRpb24sXG5cdFx0XHRjYXRlZ29yeTogRXh0ZW5zaW9uc0xvY2FsaXplZExhYmVsLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5WaWV3Q29udGFpbmVyVGl0bGUsXG5cdFx0XHRcdG9yZGVyOiA1LFxuXHRcdFx0XHRncm91cDogJzFfdXBkYXRlcycsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXdDb250YWluZXInLCBWSUVXTEVUX0lEKSwgZGlzYWJsZUF1dG9VcGRhdGVXaGVuQ29uZGl0aW9uKVxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0fV0sXG5cdFx0XHRydW46IChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4gYWNjZXNzb3IuZ2V0KElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSkudXBkYXRlQXV0b1VwZGF0ZUZvckFsbEV4dGVuc2lvbnMoZmFsc2UpXG5cdFx0fSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXh0ZW5zaW9uQWN0aW9uKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLnVwZGF0ZUFsbEV4dGVuc2lvbnMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigndXBkYXRlQWxsJywgJ1VwZGF0ZSBBbGwgRXh0ZW5zaW9ucycpLFxuXHRcdFx0Y2F0ZWdvcnk6IEV4dGVuc2lvbnNMb2NhbGl6ZWRMYWJlbCxcblx0XHRcdHByZWNvbmRpdGlvbjogSGFzT3V0ZGF0ZWRFeHRlbnNpb25zQ29udGV4dCxcblx0XHRcdG1lbnU6IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENPTlRFWFRfSEFTX0dBTExFUlksIENvbnRleHRLZXlFeHByLm9yKENPTlRFWFRfSEFTX0xPQ0FMX1NFUlZFUiwgQ09OVEVYVF9IQVNfUkVNT1RFX1NFUlZFUiwgQ09OVEVYVF9IQVNfV0VCX1NFUlZFUikpXG5cdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRpZDogTWVudUlkLlZpZXdDb250YWluZXJUaXRsZSxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3Q29udGFpbmVyJywgVklFV0xFVF9JRCksIENvbnRleHRLZXlFeHByLm9yKENvbnRleHRLZXlFeHByLmhhcyhgY29uZmlnLiR7QXV0b1VwZGF0ZUNvbmZpZ3VyYXRpb25LZXl9YCkubmVnYXRlKCksIENvbnRleHRLZXlFeHByLmVxdWFscyhgY29uZmlnLiR7QXV0b1VwZGF0ZUNvbmZpZ3VyYXRpb25LZXl9YCwgJ29ubHlFbmFibGVkRXh0ZW5zaW9ucycpKSksXG5cdFx0XHRcdFx0Z3JvdXA6ICcxX3VwZGF0ZXMnLFxuXHRcdFx0XHRcdG9yZGVyOiAyXG5cdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCBPVVREQVRFRF9FWFRFTlNJT05TX1ZJRVdfSUQpLFxuXHRcdFx0XHRcdGdyb3VwOiAnbmF2aWdhdGlvbicsXG5cdFx0XHRcdFx0b3JkZXI6IDFcblx0XHRcdFx0fVxuXHRcdFx0XSxcblx0XHRcdGljb246IGluc3RhbGxXb3Jrc3BhY2VSZWNvbW1lbmRlZEljb24sXG5cdFx0XHRydW46IGFzeW5jICgpID0+IHtcblx0XHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS51cGRhdGVBbGwoKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uZW5hYmxlQWxsJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2VuYWJsZUFsbCcsICdFbmFibGUgQWxsIEV4dGVuc2lvbnMnKSxcblx0XHRcdGNhdGVnb3J5OiBFeHRlbnNpb25zTG9jYWxpemVkTGFiZWwsXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5vcihDT05URVhUX0hBU19MT0NBTF9TRVJWRVIsIENPTlRFWFRfSEFTX1JFTU9URV9TRVJWRVIsIENPTlRFWFRfSEFTX1dFQl9TRVJWRVIpXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGlkOiBNZW51SWQuVmlld0NvbnRhaW5lclRpdGxlLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXdDb250YWluZXInLCBWSUVXTEVUX0lEKSxcblx0XHRcdFx0Z3JvdXA6ICcyX2VuYWJsZW1lbnQnLFxuXHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0fV0sXG5cdFx0XHRydW46IGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uc1RvRW5hYmxlID0gdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5sb2NhbC5maWx0ZXIoZSA9PiAhIWUubG9jYWwgJiYgdGhpcy5leHRlbnNpb25FbmFibGVtZW50U2VydmljZS5jYW5DaGFuZ2VFbmFibGVtZW50KGUubG9jYWwpICYmICF0aGlzLmV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZChlLmxvY2FsKSk7XG5cdFx0XHRcdGlmIChleHRlbnNpb25zVG9FbmFibGUubGVuZ3RoKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5zZXRFbmFibGVtZW50KGV4dGVuc2lvbnNUb0VuYWJsZSwgRW5hYmxlbWVudFN0YXRlLkVuYWJsZWRHbG9iYWxseSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uZW5hYmxlQWxsV29ya3NwYWNlJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2VuYWJsZUFsbFdvcmtzcGFjZScsICdFbmFibGUgQWxsIEV4dGVuc2lvbnMgZm9yIHRoaXMgV29ya3NwYWNlJyksXG5cdFx0XHRjYXRlZ29yeTogRXh0ZW5zaW9uc0xvY2FsaXplZExhYmVsLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoV29ya2JlbmNoU3RhdGVDb250ZXh0Lm5vdEVxdWFsc1RvKCdlbXB0eScpLCBDb250ZXh0S2V5RXhwci5vcihDT05URVhUX0hBU19MT0NBTF9TRVJWRVIsIENPTlRFWFRfSEFTX1JFTU9URV9TRVJWRVIsIENPTlRFWFRfSEFTX1dFQl9TRVJWRVIpKVxuXHRcdFx0fSxcblx0XHRcdHJ1bjogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25zVG9FbmFibGUgPSB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmxvY2FsLmZpbHRlcihlID0+ICEhZS5sb2NhbCAmJiB0aGlzLmV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmNhbkNoYW5nZUVuYWJsZW1lbnQoZS5sb2NhbCkgJiYgIXRoaXMuZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuaXNFbmFibGVkKGUubG9jYWwpKTtcblx0XHRcdFx0aWYgKGV4dGVuc2lvbnNUb0VuYWJsZS5sZW5ndGgpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnNldEVuYWJsZW1lbnQoZXh0ZW5zaW9uc1RvRW5hYmxlLCBFbmFibGVtZW50U3RhdGUuRW5hYmxlZFdvcmtzcGFjZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uZGlzYWJsZUFsbCcsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdkaXNhYmxlQWxsJywgJ0Rpc2FibGUgQWxsIEluc3RhbGxlZCBFeHRlbnNpb25zJyksXG5cdFx0XHRjYXRlZ29yeTogRXh0ZW5zaW9uc0xvY2FsaXplZExhYmVsLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoQ09OVEVYVF9IQVNfTE9DQUxfU0VSVkVSLCBDT05URVhUX0hBU19SRU1PVEVfU0VSVkVSLCBDT05URVhUX0hBU19XRUJfU0VSVkVSKVxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdDb250YWluZXJUaXRsZSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3Q29udGFpbmVyJywgVklFV0xFVF9JRCksXG5cdFx0XHRcdGdyb3VwOiAnMl9lbmFibGVtZW50Jyxcblx0XHRcdFx0b3JkZXI6IDJcblx0XHRcdH1dLFxuXHRcdFx0cnVuOiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbnNUb0Rpc2FibGUgPSB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmxvY2FsLmZpbHRlcihlID0+ICFlLmlzQnVpbHRpbiAmJiAhIWUubG9jYWwgJiYgdGhpcy5leHRlbnNpb25FbmFibGVtZW50U2VydmljZS5pc0VuYWJsZWQoZS5sb2NhbCkgJiYgdGhpcy5leHRlbnNpb25FbmFibGVtZW50U2VydmljZS5jYW5DaGFuZ2VFbmFibGVtZW50KGUubG9jYWwpKTtcblx0XHRcdFx0aWYgKGV4dGVuc2lvbnNUb0Rpc2FibGUubGVuZ3RoKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5zZXRFbmFibGVtZW50KGV4dGVuc2lvbnNUb0Rpc2FibGUsIEVuYWJsZW1lbnRTdGF0ZS5EaXNhYmxlZEdsb2JhbGx5KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbkFjdGlvbih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5kaXNhYmxlQWxsV29ya3NwYWNlJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2Rpc2FibGVBbGxXb3Jrc3BhY2UnLCAnRGlzYWJsZSBBbGwgSW5zdGFsbGVkIEV4dGVuc2lvbnMgZm9yIHRoaXMgV29ya3NwYWNlJyksXG5cdFx0XHRjYXRlZ29yeTogRXh0ZW5zaW9uc0xvY2FsaXplZExhYmVsLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoV29ya2JlbmNoU3RhdGVDb250ZXh0Lm5vdEVxdWFsc1RvKCdlbXB0eScpLCBDb250ZXh0S2V5RXhwci5vcihDT05URVhUX0hBU19MT0NBTF9TRVJWRVIsIENPTlRFWFRfSEFTX1JFTU9URV9TRVJWRVIsIENPTlRFWFRfSEFTX1dFQl9TRVJWRVIpKVxuXHRcdFx0fSxcblx0XHRcdHJ1bjogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25zVG9EaXNhYmxlID0gdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5sb2NhbC5maWx0ZXIoZSA9PiAhZS5pc0J1aWx0aW4gJiYgISFlLmxvY2FsICYmIHRoaXMuZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuaXNFbmFibGVkKGUubG9jYWwpICYmIHRoaXMuZXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UuY2FuQ2hhbmdlRW5hYmxlbWVudChlLmxvY2FsKSk7XG5cdFx0XHRcdGlmIChleHRlbnNpb25zVG9EaXNhYmxlLmxlbmd0aCkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uuc2V0RW5hYmxlbWVudChleHRlbnNpb25zVG9EaXNhYmxlLCBFbmFibGVtZW50U3RhdGUuRGlzYWJsZWRXb3Jrc3BhY2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXh0ZW5zaW9uQWN0aW9uKHtcblx0XHRcdGlkOiBTRUxFQ1RfSU5TVEFMTF9WU0lYX0VYVEVOU0lPTl9DT01NQU5EX0lELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignSW5zdGFsbEZyb21WU0lYJywgJ0luc3RhbGwgZnJvbSBWU0lYLi4uJyksXG5cdFx0XHRjYXRlZ29yeTogRXh0ZW5zaW9uc0xvY2FsaXplZExhYmVsLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoQ09OVEVYVF9IQVNfTE9DQUxfU0VSVkVSLCBDT05URVhUX0hBU19SRU1PVEVfU0VSVkVSKVxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdDb250YWluZXJUaXRsZSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygndmlld0NvbnRhaW5lcicsIFZJRVdMRVRfSUQpLCBDb250ZXh0S2V5RXhwci5vcihDT05URVhUX0hBU19MT0NBTF9TRVJWRVIsIENPTlRFWFRfSEFTX1JFTU9URV9TRVJWRVIpKSxcblx0XHRcdFx0Z3JvdXA6ICczX2luc3RhbGwnLFxuXHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0fV0sXG5cdFx0XHRydW46IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4ge1xuXHRcdFx0XHRjb25zdCBmaWxlRGlhbG9nU2VydmljZSA9IGFjY2Vzc29yLmdldChJRmlsZURpYWxvZ1NlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBjb21tYW5kU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCB2c2l4UGF0aHMgPSBhd2FpdCBmaWxlRGlhbG9nU2VydmljZS5zaG93T3BlbkRpYWxvZyh7XG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdpbnN0YWxsRnJvbVZTSVgnLCBcIkluc3RhbGwgZnJvbSBWU0lYXCIpLFxuXHRcdFx0XHRcdGZpbHRlcnM6IFt7IG5hbWU6ICdWU0lYIEV4dGVuc2lvbnMnLCBleHRlbnNpb25zOiBbJ3ZzaXgnXSB9XSxcblx0XHRcdFx0XHRjYW5TZWxlY3RGaWxlczogdHJ1ZSxcblx0XHRcdFx0XHRjYW5TZWxlY3RNYW55OiB0cnVlLFxuXHRcdFx0XHRcdG9wZW5MYWJlbDogbW5lbW9uaWNCdXR0b25MYWJlbChsb2NhbGl6ZSh7IGtleTogJ2luc3RhbGxCdXR0b24nLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZJbnN0YWxsXCIpKVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0aWYgKHZzaXhQYXRocykge1xuXHRcdFx0XHRcdGF3YWl0IGNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKElOU1RBTExfRVhURU5TSU9OX0ZST01fVlNJWF9DT01NQU5EX0lELCB2c2l4UGF0aHMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXh0ZW5zaW9uQWN0aW9uKHtcblx0XHRcdGlkOiBJTlNUQUxMX0VYVEVOU0lPTl9GUk9NX1ZTSVhfQ09NTUFORF9JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnaW5zdGFsbFZTSVgnLCBcIkluc3RhbGwgRXh0ZW5zaW9uIFZTSVhcIiksXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkV4cGxvcmVyQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6ICdleHRlbnNpb25zJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFJlc291cmNlQ29udGV4dEtleS5FeHRlbnNpb24uaXNFcXVhbFRvKCcudnNpeCcpLCBDb250ZXh0S2V5RXhwci5vcihDT05URVhUX0hBU19MT0NBTF9TRVJWRVIsIENPTlRFWFRfSEFTX1JFTU9URV9TRVJWRVIpKSxcblx0XHRcdH1dLFxuXHRcdFx0cnVuOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIHJlc291cmNlczogVVJJW10gfCBVUkkpID0+IHtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgaG9zdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUhvc3RTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3Qgbm90aWZpY2F0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90aWZpY2F0aW9uU2VydmljZSk7XG5cblx0XHRcdFx0Y29uc3QgdnNpeHMgPSBBcnJheS5pc0FycmF5KHJlc291cmNlcykgPyByZXNvdXJjZXMgOiBbcmVzb3VyY2VzXTtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgUHJvbWlzZS5hbGxTZXR0bGVkKHZzaXhzLm1hcChhc3luYyAodnNpeCkgPT4gYXdhaXQgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuaW5zdGFsbCh2c2l4LCB7IGluc3RhbGxHaXZlblZlcnNpb246IHRydWUgfSkpKTtcblx0XHRcdFx0bGV0IGVycm9yOiBFcnJvciB8IHVuZGVmaW5lZCwgcmVxdWlyZVJlbG9hZCA9IGZhbHNlLCByZXF1aXJlUmVzdGFydCA9IGZhbHNlO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHIgb2YgcmVzdWx0KSB7XG5cdFx0XHRcdFx0aWYgKHIuc3RhdHVzID09PSAncmVqZWN0ZWQnKSB7XG5cdFx0XHRcdFx0XHRlcnJvciA9IG5ldyBFcnJvcihyLnJlYXNvbik7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmVxdWlyZVJlbG9hZCA9IHJlcXVpcmVSZWxvYWQgfHwgci52YWx1ZS5ydW50aW1lU3RhdGU/LmFjdGlvbiA9PT0gRXh0ZW5zaW9uUnVudGltZUFjdGlvblR5cGUuUmVsb2FkV2luZG93O1xuXHRcdFx0XHRcdHJlcXVpcmVSZXN0YXJ0ID0gcmVxdWlyZVJlc3RhcnQgfHwgci52YWx1ZS5ydW50aW1lU3RhdGU/LmFjdGlvbiA9PT0gRXh0ZW5zaW9uUnVudGltZUFjdGlvblR5cGUuUmVzdGFydEV4dGVuc2lvbnM7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGVycm9yKSB7XG5cdFx0XHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHJlcXVpcmVSZWxvYWQpIHtcblx0XHRcdFx0XHRub3RpZmljYXRpb25TZXJ2aWNlLnByb21wdChcblx0XHRcdFx0XHRcdFNldmVyaXR5LkluZm8sXG5cdFx0XHRcdFx0XHR2c2l4cy5sZW5ndGggPiAxID8gbG9jYWxpemUoJ0luc3RhbGxWU0lYcy5zdWNjZXNzUmVsb2FkJywgXCJDb21wbGV0ZWQgaW5zdGFsbGluZyBleHRlbnNpb25zLiBQbGVhc2UgcmVsb2FkIFZpc3VhbCBTdHVkaW8gQ29kZSB0byBlbmFibGUgdGhlbS5cIilcblx0XHRcdFx0XHRcdFx0OiBsb2NhbGl6ZSgnSW5zdGFsbFZTSVhBY3Rpb24uc3VjY2Vzc1JlbG9hZCcsIFwiQ29tcGxldGVkIGluc3RhbGxpbmcgZXh0ZW5zaW9uLiBQbGVhc2UgcmVsb2FkIFZpc3VhbCBTdHVkaW8gQ29kZSB0byBlbmFibGUgaXQuXCIpLFxuXHRcdFx0XHRcdFx0W3tcblx0XHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdJbnN0YWxsVlNJWEFjdGlvbi5yZWxvYWROb3cnLCBcIlJlbG9hZCBOb3dcIiksXG5cdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gaG9zdFNlcnZpY2UucmVsb2FkKClcblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRlbHNlIGlmIChyZXF1aXJlUmVzdGFydCkge1xuXHRcdFx0XHRcdG5vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFxuXHRcdFx0XHRcdFx0U2V2ZXJpdHkuSW5mbyxcblx0XHRcdFx0XHRcdHZzaXhzLmxlbmd0aCA+IDEgPyBsb2NhbGl6ZSgnSW5zdGFsbFZTSVhzLnN1Y2Nlc3NSZXN0YXJ0JywgXCJDb21wbGV0ZWQgaW5zdGFsbGluZyBleHRlbnNpb25zLiBQbGVhc2UgcmVzdGFydCBleHRlbnNpb25zIHRvIGVuYWJsZSB0aGVtLlwiKVxuXHRcdFx0XHRcdFx0XHQ6IGxvY2FsaXplKCdJbnN0YWxsVlNJWEFjdGlvbi5zdWNjZXNzUmVzdGFydCcsIFwiQ29tcGxldGVkIGluc3RhbGxpbmcgZXh0ZW5zaW9uLiBQbGVhc2UgcmVzdGFydCBleHRlbnNpb25zIHRvIGVuYWJsZSBpdC5cIiksXG5cdFx0XHRcdFx0XHRbe1xuXHRcdFx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ0luc3RhbGxWU0lYQWN0aW9uLnJlc3RhcnRFeHRlbnNpb25zJywgXCJSZXN0YXJ0IEV4dGVuc2lvbnNcIiksXG5cdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UudXBkYXRlUnVubmluZ0V4dGVuc2lvbnMoKVxuXHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdG5vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFxuXHRcdFx0XHRcdFx0U2V2ZXJpdHkuSW5mbyxcblx0XHRcdFx0XHRcdHZzaXhzLmxlbmd0aCA+IDEgPyBsb2NhbGl6ZSgnSW5zdGFsbFZTSVhzLnN1Y2Nlc3NOb1JlbG9hZCcsIFwiQ29tcGxldGVkIGluc3RhbGxpbmcgZXh0ZW5zaW9ucy5cIikgOiBsb2NhbGl6ZSgnSW5zdGFsbFZTSVhBY3Rpb24uc3VjY2Vzc05vUmVsb2FkJywgXCJDb21wbGV0ZWQgaW5zdGFsbGluZyBleHRlbnNpb24uXCIpLFxuXHRcdFx0XHRcdFx0W11cblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXh0ZW5zaW9uQWN0aW9uKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLmluc3RhbGxFeHRlbnNpb25Gcm9tTG9jYXRpb24nLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignaW5zdGFsbEV4dGVuc2lvbkZyb21Mb2NhdGlvbicsICdJbnN0YWxsIEV4dGVuc2lvbiBmcm9tIExvY2F0aW9uLi4uJyksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5EZXZlbG9wZXIsXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5vcihDT05URVhUX0hBU19XRUJfU0VSVkVSLCBDT05URVhUX0hBU19MT0NBTF9TRVJWRVIpXG5cdFx0XHR9XSxcblx0XHRcdHJ1bjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElXb3JrYmVuY2hFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSk7XG5cdFx0XHRcdGlmIChpc1dlYikge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgUHJvbWlzZTx2b2lkPigoYywgZSkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRcdFx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0XHRcdFx0Y29uc3QgcXVpY2tQaWNrID0gZGlzcG9zYWJsZXMuYWRkKHF1aWNrSW5wdXRTZXJ2aWNlLmNyZWF0ZVF1aWNrUGljaygpKTtcblx0XHRcdFx0XHRcdHF1aWNrUGljay50aXRsZSA9IGxvY2FsaXplKCdpbnN0YWxsRnJvbUxvY2F0aW9uJywgXCJJbnN0YWxsIEV4dGVuc2lvbiBmcm9tIExvY2F0aW9uXCIpO1xuXHRcdFx0XHRcdFx0cXVpY2tQaWNrLmN1c3RvbUJ1dHRvbiA9IHRydWU7XG5cdFx0XHRcdFx0XHRxdWlja1BpY2suY3VzdG9tTGFiZWwgPSBsb2NhbGl6ZSgnaW5zdGFsbCBidXR0b24nLCBcIkluc3RhbGxcIik7XG5cdFx0XHRcdFx0XHRxdWlja1BpY2sucGxhY2Vob2xkZXIgPSBsb2NhbGl6ZSgnaW5zdGFsbEZyb21Mb2NhdGlvblBsYWNlSG9sZGVyJywgXCJMb2NhdGlvbiBvZiB0aGUgd2ViIGV4dGVuc2lvblwiKTtcblx0XHRcdFx0XHRcdHF1aWNrUGljay5pZ25vcmVGb2N1c091dCA9IHRydWU7XG5cdFx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQoRXZlbnQuYW55KHF1aWNrUGljay5vbkRpZEFjY2VwdCwgcXVpY2tQaWNrLm9uRGlkQ3VzdG9tKShhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHF1aWNrUGljay5oaWRlKCk7XG5cdFx0XHRcdFx0XHRcdGlmIChxdWlja1BpY2sudmFsdWUpIHtcblx0XHRcdFx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0XHRcdFx0YXdhaXQgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuaW5zdGFsbEZyb21Mb2NhdGlvbihVUkkucGFyc2UocXVpY2tQaWNrLnZhbHVlKSk7XG5cdFx0XHRcdFx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGUoZXJyb3IpO1xuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRjKCk7XG5cdFx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQocXVpY2tQaWNrLm9uRGlkSGlkZSgoKSA9PiBkaXNwb3NhYmxlcy5kaXNwb3NlKCkpKTtcblx0XHRcdFx0XHRcdHF1aWNrUGljay5zaG93KCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3QgZmlsZURpYWxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUZpbGVEaWFsb2dTZXJ2aWNlKTtcblx0XHRcdFx0XHRjb25zdCBleHRlbnNpb25Mb2NhdGlvbiA9IGF3YWl0IGZpbGVEaWFsb2dTZXJ2aWNlLnNob3dPcGVuRGlhbG9nKHtcblx0XHRcdFx0XHRcdGNhblNlbGVjdEZvbGRlcnM6IHRydWUsXG5cdFx0XHRcdFx0XHRjYW5TZWxlY3RGaWxlczogZmFsc2UsXG5cdFx0XHRcdFx0XHRjYW5TZWxlY3RNYW55OiBmYWxzZSxcblx0XHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnaW5zdGFsbEZyb21Mb2NhdGlvbicsIFwiSW5zdGFsbCBFeHRlbnNpb24gZnJvbSBMb2NhdGlvblwiKSxcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRpZiAoZXh0ZW5zaW9uTG9jYXRpb24/LlswXSkge1xuXHRcdFx0XHRcdFx0YXdhaXQgZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UuaW5zdGFsbEZyb21Mb2NhdGlvbihleHRlbnNpb25Mb2NhdGlvblswXSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCBleHRlbnNpb25zRmlsdGVyU3ViTWVudSA9IG5ldyBNZW51SWQoJ2V4dGVuc2lvbnNGaWx0ZXJTdWJNZW51Jyk7XG5cdFx0TWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKGV4dGVuc2lvbnNTZWFyY2hBY3Rpb25zTWVudSwge1xuXHRcdFx0c3VibWVudTogZXh0ZW5zaW9uc0ZpbHRlclN1Yk1lbnUsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ2ZpbHRlckV4dGVuc2lvbnMnLCBcIkZpbHRlciBFeHRlbnNpb25zLi4uXCIpLFxuXHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0aWNvbjogZmlsdGVySWNvbixcblx0XHR9KTtcblxuXHRcdGNvbnN0IHNob3dGZWF0dXJlZEV4dGVuc2lvbnNJZCA9ICdleHRlbnNpb25zLmZpbHRlci5mZWF0dXJlZCc7XG5cdFx0Y29uc3QgZmVhdHVyZXNFeHRlbnNpb25zV2hlbkNvbnRleHQgPSBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9IQVNfR0FMTEVSWSwgQ29udGV4dEtleUV4cHIucmVnZXgoQ09OVEVYVF9HQUxMRVJZX0ZJTFRFUl9DQVBBQklMSVRJRVMua2V5LCBuZXcgUmVnRXhwKGBfJHtGaWx0ZXJUeXBlLkZlYXR1cmVkfV9gKSkpO1xuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6IHNob3dGZWF0dXJlZEV4dGVuc2lvbnNJZCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Nob3dGZWF0dXJlZEV4dGVuc2lvbnMnLCAnU2hvdyBGZWF0dXJlZCBFeHRlbnNpb25zJyksXG5cdFx0XHRjYXRlZ29yeTogRXh0ZW5zaW9uc0xvY2FsaXplZExhYmVsLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogZmVhdHVyZXNFeHRlbnNpb25zV2hlbkNvbnRleHRcblx0XHRcdH0sIHtcblx0XHRcdFx0aWQ6IGV4dGVuc2lvbnNGaWx0ZXJTdWJNZW51LFxuXHRcdFx0XHR3aGVuOiBmZWF0dXJlc0V4dGVuc2lvbnNXaGVuQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6ICcxX3ByZWRlZmluZWQnLFxuXHRcdFx0XHRvcmRlcjogMSxcblx0XHRcdH1dLFxuXHRcdFx0bWVudVRpdGxlczoge1xuXHRcdFx0XHRbZXh0ZW5zaW9uc0ZpbHRlclN1Yk1lbnUuaWRdOiBsb2NhbGl6ZSgnZmVhdHVyZWQgZmlsdGVyJywgXCJGZWF0dXJlZFwiKVxuXHRcdFx0fSxcblx0XHRcdHJ1bjogKCkgPT4gdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5vcGVuU2VhcmNoKCdAZmVhdHVyZWQgJylcblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uc2hvd1BvcHVsYXJFeHRlbnNpb25zJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Nob3dQb3B1bGFyRXh0ZW5zaW9ucycsICdTaG93IFBvcHVsYXIgRXh0ZW5zaW9ucycpLFxuXHRcdFx0Y2F0ZWdvcnk6IEV4dGVuc2lvbnNMb2NhbGl6ZWRMYWJlbCxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IENPTlRFWFRfSEFTX0dBTExFUllcblx0XHRcdH0sIHtcblx0XHRcdFx0aWQ6IGV4dGVuc2lvbnNGaWx0ZXJTdWJNZW51LFxuXHRcdFx0XHR3aGVuOiBDT05URVhUX0hBU19HQUxMRVJZLFxuXHRcdFx0XHRncm91cDogJzFfcHJlZGVmaW5lZCcsXG5cdFx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0fV0sXG5cdFx0XHRtZW51VGl0bGVzOiB7XG5cdFx0XHRcdFtleHRlbnNpb25zRmlsdGVyU3ViTWVudS5pZF06IGxvY2FsaXplKCdtb3N0IHBvcHVsYXIgZmlsdGVyJywgXCJNb3N0IFBvcHVsYXJcIilcblx0XHRcdH0sXG5cdFx0XHRydW46ICgpID0+IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub3BlblNlYXJjaCgnQHBvcHVsYXIgJylcblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uc2hvd1JlY29tbWVuZGVkRXh0ZW5zaW9ucycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzaG93UmVjb21tZW5kZWRFeHRlbnNpb25zJywgJ1Nob3cgUmVjb21tZW5kZWQgRXh0ZW5zaW9ucycpLFxuXHRcdFx0Y2F0ZWdvcnk6IEV4dGVuc2lvbnNMb2NhbGl6ZWRMYWJlbCxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IENPTlRFWFRfSEFTX0dBTExFUllcblx0XHRcdH0sIHtcblx0XHRcdFx0aWQ6IGV4dGVuc2lvbnNGaWx0ZXJTdWJNZW51LFxuXHRcdFx0XHR3aGVuOiBDT05URVhUX0hBU19HQUxMRVJZLFxuXHRcdFx0XHRncm91cDogJzFfcHJlZGVmaW5lZCcsXG5cdFx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0fV0sXG5cdFx0XHRtZW51VGl0bGVzOiB7XG5cdFx0XHRcdFtleHRlbnNpb25zRmlsdGVyU3ViTWVudS5pZF06IGxvY2FsaXplKCdtb3N0IHBvcHVsYXIgcmVjb21tZW5kZWQnLCBcIlJlY29tbWVuZGVkXCIpXG5cdFx0XHR9LFxuXHRcdFx0cnVuOiAoKSA9PiB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLm9wZW5TZWFyY2goJ0ByZWNvbW1lbmRlZCAnKVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbkFjdGlvbih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5yZWNlbnRseVB1Ymxpc2hlZEV4dGVuc2lvbnMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMigncmVjZW50bHlQdWJsaXNoZWRFeHRlbnNpb25zJywgJ1Nob3cgUmVjZW50bHkgUHVibGlzaGVkIEV4dGVuc2lvbnMnKSxcblx0XHRcdGNhdGVnb3J5OiBFeHRlbnNpb25zTG9jYWxpemVkTGFiZWwsXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHR3aGVuOiBDT05URVhUX0hBU19HQUxMRVJZXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGlkOiBleHRlbnNpb25zRmlsdGVyU3ViTWVudSxcblx0XHRcdFx0d2hlbjogQ09OVEVYVF9IQVNfR0FMTEVSWSxcblx0XHRcdFx0Z3JvdXA6ICcxX3ByZWRlZmluZWQnLFxuXHRcdFx0XHRvcmRlcjogMixcblx0XHRcdH1dLFxuXHRcdFx0bWVudVRpdGxlczoge1xuXHRcdFx0XHRbZXh0ZW5zaW9uc0ZpbHRlclN1Yk1lbnUuaWRdOiBsb2NhbGl6ZSgncmVjZW50bHkgcHVibGlzaGVkIGZpbHRlcicsIFwiUmVjZW50bHkgUHVibGlzaGVkXCIpXG5cdFx0XHR9LFxuXHRcdFx0cnVuOiAoKSA9PiB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLm9wZW5TZWFyY2goJ0ByZWNlbnRseVB1Ymxpc2hlZCAnKVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZXh0ZW5zaW9uc0NhdGVnb3J5RmlsdGVyU3ViTWVudSA9IG5ldyBNZW51SWQoJ2V4dGVuc2lvbnNDYXRlZ29yeUZpbHRlclN1Yk1lbnUnKTtcblx0XHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oZXh0ZW5zaW9uc0ZpbHRlclN1Yk1lbnUsIHtcblx0XHRcdHN1Ym1lbnU6IGV4dGVuc2lvbnNDYXRlZ29yeUZpbHRlclN1Yk1lbnUsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ2ZpbHRlciBieSBjYXRlZ29yeScsIFwiQ2F0ZWdvcnlcIiksXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ09OVEVYVF9IQVNfR0FMTEVSWSwgQ29udGV4dEtleUV4cHIucmVnZXgoQ09OVEVYVF9HQUxMRVJZX0ZJTFRFUl9DQVBBQklMSVRJRVMua2V5LCBuZXcgUmVnRXhwKGBfJHtGaWx0ZXJUeXBlLkNhdGVnb3J5fV9gKSkpLFxuXHRcdFx0Z3JvdXA6ICcyX2NhdGVnb3JpZXMnLFxuXHRcdFx0b3JkZXI6IDEsXG5cdFx0fSk7XG5cblx0XHRFWFRFTlNJT05fQ0FURUdPUklFUy5mb3JFYWNoKChjYXRlZ29yeSwgaW5kZXgpID0+IHtcblx0XHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0XHRpZDogYGV4dGVuc2lvbnMuYWN0aW9ucy5zZWFyY2hCeUNhdGVnb3J5LiR7Y2F0ZWdvcnl9YCxcblx0XHRcdFx0dGl0bGU6IGNhdGVnb3J5LFxuXHRcdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRcdGlkOiBleHRlbnNpb25zQ2F0ZWdvcnlGaWx0ZXJTdWJNZW51LFxuXHRcdFx0XHRcdHdoZW46IENPTlRFWFRfSEFTX0dBTExFUlksXG5cdFx0XHRcdFx0b3JkZXI6IGluZGV4LFxuXHRcdFx0XHR9XSxcblx0XHRcdFx0cnVuOiAoKSA9PiB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLm9wZW5TZWFyY2goYEBjYXRlZ29yeTpcIiR7Y2F0ZWdvcnkudG9Mb3dlckNhc2UoKX1cImApXG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24ubGlzdEJ1aWx0SW5FeHRlbnNpb25zJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3Nob3dCdWlsdEluRXh0ZW5zaW9ucycsICdTaG93IEJ1aWx0LWluIEV4dGVuc2lvbnMnKSxcblx0XHRcdGNhdGVnb3J5OiBFeHRlbnNpb25zTG9jYWxpemVkTGFiZWwsXG5cdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRpZDogTWVudUlkLkNvbW1hbmRQYWxldHRlLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5vcihDT05URVhUX0hBU19MT0NBTF9TRVJWRVIsIENPTlRFWFRfSEFTX1JFTU9URV9TRVJWRVIsIENPTlRFWFRfSEFTX1dFQl9TRVJWRVIpXG5cdFx0XHR9LCB7XG5cdFx0XHRcdGlkOiBleHRlbnNpb25zRmlsdGVyU3ViTWVudSxcblx0XHRcdFx0Z3JvdXA6ICczX2luc3RhbGxlZCcsXG5cdFx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0fV0sXG5cdFx0XHRtZW51VGl0bGVzOiB7XG5cdFx0XHRcdFtleHRlbnNpb25zRmlsdGVyU3ViTWVudS5pZF06IGxvY2FsaXplKCdidWlsdGluIGZpbHRlcicsIFwiQnVpbHQtaW5cIilcblx0XHRcdH0sXG5cdFx0XHRydW46ICgpID0+IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub3BlblNlYXJjaCgnQGJ1aWx0aW4gJylcblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uZXh0ZW5zaW9uVXBkYXRlcycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdleHRlbnNpb25VcGRhdGVzJywgJ1Nob3cgRXh0ZW5zaW9uIFVwZGF0ZXMnKSxcblx0XHRcdGNhdGVnb3J5OiBFeHRlbnNpb25zTG9jYWxpemVkTGFiZWwsXG5cdFx0XHRwcmVjb25kaXRpb246IENPTlRFWFRfSEFTX0dBTExFUlksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBleHRlbnNpb25zRmlsdGVyU3ViTWVudSxcblx0XHRcdFx0Z3JvdXA6ICczX2luc3RhbGxlZCcsXG5cdFx0XHRcdHdoZW46IENPTlRFWFRfSEFTX0dBTExFUlksXG5cdFx0XHRcdG9yZGVyOiAxLFxuXHRcdFx0fV0sXG5cdFx0XHRtZW51VGl0bGVzOiB7XG5cdFx0XHRcdFtleHRlbnNpb25zRmlsdGVyU3ViTWVudS5pZF06IGxvY2FsaXplKCdleHRlbnNpb24gdXBkYXRlcyBmaWx0ZXInLCBcIlVwZGF0ZXNcIilcblx0XHRcdH0sXG5cdFx0XHRydW46ICgpID0+IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub3BlblNlYXJjaCgnQHVwZGF0ZXMnKVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbkFjdGlvbih7XG5cdFx0XHRpZDogTElTVF9XT1JLU1BBQ0VfVU5TVVBQT1JURURfRVhURU5TSU9OU19DT01NQU5EX0lELFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc2hvd1dvcmtzcGFjZVVuc3VwcG9ydGVkRXh0ZW5zaW9ucycsICdTaG93IEV4dGVuc2lvbnMgVW5zdXBwb3J0ZWQgQnkgV29ya3NwYWNlJyksXG5cdFx0XHRjYXRlZ29yeTogRXh0ZW5zaW9uc0xvY2FsaXplZExhYmVsLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoQ09OVEVYVF9IQVNfTE9DQUxfU0VSVkVSLCBDT05URVhUX0hBU19SRU1PVEVfU0VSVkVSKSxcblx0XHRcdH0sIHtcblx0XHRcdFx0aWQ6IGV4dGVuc2lvbnNGaWx0ZXJTdWJNZW51LFxuXHRcdFx0XHRncm91cDogJzNfaW5zdGFsbGVkJyxcblx0XHRcdFx0b3JkZXI6IDUsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLm9yKENPTlRFWFRfSEFTX0xPQ0FMX1NFUlZFUiwgQ09OVEVYVF9IQVNfUkVNT1RFX1NFUlZFUiksXG5cdFx0XHR9XSxcblx0XHRcdG1lbnVUaXRsZXM6IHtcblx0XHRcdFx0W2V4dGVuc2lvbnNGaWx0ZXJTdWJNZW51LmlkXTogbG9jYWxpemUoJ3dvcmtzcGFjZSB1bnN1cHBvcnRlZCBmaWx0ZXInLCBcIldvcmtzcGFjZSBVbnN1cHBvcnRlZFwiKVxuXHRcdFx0fSxcblx0XHRcdHJ1bjogKCkgPT4gdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5vcGVuU2VhcmNoKCdAd29ya3NwYWNlVW5zdXBwb3J0ZWQnKVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbkFjdGlvbih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5zaG93RW5hYmxlZEV4dGVuc2lvbnMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc2hvd0VuYWJsZWRFeHRlbnNpb25zJywgJ1Nob3cgRW5hYmxlZCBFeHRlbnNpb25zJyksXG5cdFx0XHRjYXRlZ29yeTogRXh0ZW5zaW9uc0xvY2FsaXplZExhYmVsLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIub3IoQ09OVEVYVF9IQVNfTE9DQUxfU0VSVkVSLCBDT05URVhUX0hBU19SRU1PVEVfU0VSVkVSLCBDT05URVhUX0hBU19XRUJfU0VSVkVSKVxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogZXh0ZW5zaW9uc0ZpbHRlclN1Yk1lbnUsXG5cdFx0XHRcdGdyb3VwOiAnM19pbnN0YWxsZWQnLFxuXHRcdFx0XHRvcmRlcjogMyxcblx0XHRcdH1dLFxuXHRcdFx0bWVudVRpdGxlczoge1xuXHRcdFx0XHRbZXh0ZW5zaW9uc0ZpbHRlclN1Yk1lbnUuaWRdOiBsb2NhbGl6ZSgnZW5hYmxlZCBmaWx0ZXInLCBcIkVuYWJsZWRcIilcblx0XHRcdH0sXG5cdFx0XHRydW46ICgpID0+IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub3BlblNlYXJjaCgnQGVuYWJsZWQgJylcblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uc2hvd0Rpc2FibGVkRXh0ZW5zaW9ucycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzaG93RGlzYWJsZWRFeHRlbnNpb25zJywgJ1Nob3cgRGlzYWJsZWQgRXh0ZW5zaW9ucycpLFxuXHRcdFx0Y2F0ZWdvcnk6IEV4dGVuc2lvbnNMb2NhbGl6ZWRMYWJlbCxcblx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLm9yKENPTlRFWFRfSEFTX0xPQ0FMX1NFUlZFUiwgQ09OVEVYVF9IQVNfUkVNT1RFX1NFUlZFUiwgQ09OVEVYVF9IQVNfV0VCX1NFUlZFUilcblx0XHRcdH0sIHtcblx0XHRcdFx0aWQ6IGV4dGVuc2lvbnNGaWx0ZXJTdWJNZW51LFxuXHRcdFx0XHRncm91cDogJzNfaW5zdGFsbGVkJyxcblx0XHRcdFx0b3JkZXI6IDQsXG5cdFx0XHR9XSxcblx0XHRcdG1lbnVUaXRsZXM6IHtcblx0XHRcdFx0W2V4dGVuc2lvbnNGaWx0ZXJTdWJNZW51LmlkXTogbG9jYWxpemUoJ2Rpc2FibGVkIGZpbHRlcicsIFwiRGlzYWJsZWRcIilcblx0XHRcdH0sXG5cdFx0XHRydW46ICgpID0+IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2Uub3BlblNlYXJjaCgnQGRpc2FibGVkICcpXG5cdFx0fSk7XG5cblx0XHRjb25zdCBleHRlbnNpb25zU29ydFN1Yk1lbnUgPSBuZXcgTWVudUlkKCdleHRlbnNpb25zU29ydFN1Yk1lbnUnKTtcblx0XHRNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oZXh0ZW5zaW9uc0ZpbHRlclN1Yk1lbnUsIHtcblx0XHRcdHN1Ym1lbnU6IGV4dGVuc2lvbnNTb3J0U3ViTWVudSxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnc29ydHkgYnknLCBcIlNvcnQgQnlcIiksXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIub3IoQ09OVEVYVF9IQVNfR0FMTEVSWSwgRGVmYXVsdFZpZXdzQ29udGV4dCkpLFxuXHRcdFx0Z3JvdXA6ICc0X3NvcnQnLFxuXHRcdFx0b3JkZXI6IDEsXG5cdFx0fSk7XG5cblx0XHRbXG5cdFx0XHR7IGlkOiAnaW5zdGFsbHMnLCB0aXRsZTogbG9jYWxpemUoJ3NvcnQgYnkgaW5zdGFsbHMnLCBcIkluc3RhbGwgQ291bnRcIiksIHByZWNvbmRpdGlvbjogQnVpbHRJbkV4dGVuc2lvbnNDb250ZXh0Lm5lZ2F0ZSgpLCBzb3J0Q2FwYWJpbGl0eTogU29ydEJ5Lkluc3RhbGxDb3VudCB9LFxuXHRcdFx0eyBpZDogJ3JhdGluZycsIHRpdGxlOiBsb2NhbGl6ZSgnc29ydCBieSByYXRpbmcnLCBcIlJhdGluZ1wiKSwgcHJlY29uZGl0aW9uOiBCdWlsdEluRXh0ZW5zaW9uc0NvbnRleHQubmVnYXRlKCksIHNvcnRDYXBhYmlsaXR5OiBTb3J0QnkuV2VpZ2h0ZWRSYXRpbmcgfSxcblx0XHRcdHsgaWQ6ICduYW1lJywgdGl0bGU6IGxvY2FsaXplKCdzb3J0IGJ5IG5hbWUnLCBcIk5hbWVcIiksIHByZWNvbmRpdGlvbjogQnVpbHRJbkV4dGVuc2lvbnNDb250ZXh0Lm5lZ2F0ZSgpLCBzb3J0Q2FwYWJpbGl0eTogU29ydEJ5LlRpdGxlIH0sXG5cdFx0XHR7IGlkOiAncHVibGlzaGVkRGF0ZScsIHRpdGxlOiBsb2NhbGl6ZSgnc29ydCBieSBwdWJsaXNoZWQgZGF0ZScsIFwiUHVibGlzaGVkIERhdGVcIiksIHByZWNvbmRpdGlvbjogQnVpbHRJbkV4dGVuc2lvbnNDb250ZXh0Lm5lZ2F0ZSgpLCBzb3J0Q2FwYWJpbGl0eTogU29ydEJ5LlB1Ymxpc2hlZERhdGUgfSxcblx0XHRcdHsgaWQ6ICd1cGRhdGVEYXRlJywgdGl0bGU6IGxvY2FsaXplKCdzb3J0IGJ5IHVwZGF0ZSBkYXRlJywgXCJVcGRhdGVkIERhdGVcIiksIHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuYW5kKFNlYXJjaE1hcmtldHBsYWNlRXh0ZW5zaW9uc0NvbnRleHQubmVnYXRlKCksIFJlY29tbWVuZGVkRXh0ZW5zaW9uc0NvbnRleHQubmVnYXRlKCksIEJ1aWx0SW5FeHRlbnNpb25zQ29udGV4dC5uZWdhdGUoKSksIHNvcnRDYXBhYmlsaXR5OiAnVXBkYXRlRGF0ZScgfSxcblx0XHRdLm1hcCgoeyBpZCwgdGl0bGUsIHByZWNvbmRpdGlvbiwgc29ydENhcGFiaWxpdHkgfSwgaW5kZXgpID0+IHtcblx0XHRcdGNvbnN0IHNvcnRDYXBhYmlsaXR5Q29udGV4dCA9IENvbnRleHRLZXlFeHByLnJlZ2V4KENPTlRFWFRfR0FMTEVSWV9TT1JUX0NBUEFCSUxJVElFUy5rZXksIG5ldyBSZWdFeHAoYF8ke3NvcnRDYXBhYmlsaXR5fV9gKSk7XG5cdFx0XHR0aGlzLnJlZ2lzdGVyRXh0ZW5zaW9uQWN0aW9uKHtcblx0XHRcdFx0aWQ6IGBleHRlbnNpb25zLnNvcnQuJHtpZH1gLFxuXHRcdFx0XHR0aXRsZSxcblx0XHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5hbmQocHJlY29uZGl0aW9uLCBDb250ZXh0S2V5RXhwci5yZWdleChFeHRlbnNpb25zU2VhcmNoVmFsdWVDb250ZXh0LmtleSwgL15AZmVhdHVyZTovKS5uZWdhdGUoKSwgc29ydENhcGFiaWxpdHlDb250ZXh0KSxcblx0XHRcdFx0bWVudTogW3tcblx0XHRcdFx0XHRpZDogZXh0ZW5zaW9uc1NvcnRTdWJNZW51LFxuXHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5vcihDT05URVhUX0hBU19HQUxMRVJZLCBEZWZhdWx0Vmlld3NDb250ZXh0KSwgc29ydENhcGFiaWxpdHlDb250ZXh0KSxcblx0XHRcdFx0XHRvcmRlcjogaW5kZXgsXG5cdFx0XHRcdH1dLFxuXHRcdFx0XHR0b2dnbGVkOiBFeHRlbnNpb25zU29ydEJ5Q29udGV4dC5pc0VxdWFsVG8oaWQpLFxuXHRcdFx0XHRydW46IGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRjb25zdCBleHRlbnNpb25zVmlld1BhbmVDb250YWluZXIgPSAoKGF3YWl0IHRoaXMudmlld3NTZXJ2aWNlLm9wZW5WaWV3Q29udGFpbmVyKFZJRVdMRVRfSUQsIHRydWUpKT8uZ2V0Vmlld1BhbmVDb250YWluZXIoKSkgYXMgSUV4dGVuc2lvbnNWaWV3UGFuZUNvbnRhaW5lciB8IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRjb25zdCBjdXJyZW50UXVlcnkgPSBRdWVyeS5wYXJzZShleHRlbnNpb25zVmlld1BhbmVDb250YWluZXI/LnNlYXJjaFZhbHVlID8/ICcnKTtcblx0XHRcdFx0XHRleHRlbnNpb25zVmlld1BhbmVDb250YWluZXI/LnNlYXJjaChuZXcgUXVlcnkoY3VycmVudFF1ZXJ5LnZhbHVlLCBpZCkudG9TdHJpbmcoKSk7XG5cdFx0XHRcdFx0ZXh0ZW5zaW9uc1ZpZXdQYW5lQ29udGFpbmVyPy5mb2N1cygpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uY2xlYXJFeHRlbnNpb25zU2VhcmNoUmVzdWx0cycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdjbGVhckV4dGVuc2lvbnNTZWFyY2hSZXN1bHRzJywgJ0NsZWFyIEV4dGVuc2lvbnMgU2VhcmNoIFJlc3VsdHMnKSxcblx0XHRcdGNhdGVnb3J5OiBFeHRlbnNpb25zTG9jYWxpemVkTGFiZWwsXG5cdFx0XHRpY29uOiBjbGVhclNlYXJjaFJlc3VsdHNJY29uLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRwcmVjb25kaXRpb246IFNlYXJjaEhhc1RleHRDb250ZXh0LFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogZXh0ZW5zaW9uc1NlYXJjaEFjdGlvbnNNZW51LFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRvcmRlcjogMSxcblx0XHRcdH0sXG5cdFx0XHRydW46IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4ge1xuXHRcdFx0XHRjb25zdCB2aWV3UGFuZUNvbnRhaW5lciA9IGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKS5nZXRBY3RpdmVWaWV3UGFuZUNvbnRhaW5lcldpdGhJZChWSUVXTEVUX0lEKTtcblx0XHRcdFx0aWYgKHZpZXdQYW5lQ29udGFpbmVyKSB7XG5cdFx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uc1ZpZXdQYW5lQ29udGFpbmVyID0gdmlld1BhbmVDb250YWluZXIgYXMgSUV4dGVuc2lvbnNWaWV3UGFuZUNvbnRhaW5lcjtcblx0XHRcdFx0XHRleHRlbnNpb25zVmlld1BhbmVDb250YWluZXIuc2VhcmNoKCcnKTtcblx0XHRcdFx0XHRleHRlbnNpb25zVmlld1BhbmVDb250YWluZXIuZm9jdXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbkFjdGlvbih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5yZWZyZXNoRXh0ZW5zaW9uJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3JlZnJlc2hFeHRlbnNpb24nLCAnUmVmcmVzaCcpLFxuXHRcdFx0Y2F0ZWdvcnk6IEV4dGVuc2lvbnNMb2NhbGl6ZWRMYWJlbCxcblx0XHRcdGljb246IHJlZnJlc2hJY29uLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuVmlld0NvbnRhaW5lclRpdGxlLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXdDb250YWluZXInLCBWSUVXTEVUX0lEKSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IDJcblx0XHRcdH0sXG5cdFx0XHRydW46IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4ge1xuXHRcdFx0XHRjb25zdCB2aWV3UGFuZUNvbnRhaW5lciA9IGFjY2Vzc29yLmdldChJVmlld3NTZXJ2aWNlKS5nZXRBY3RpdmVWaWV3UGFuZUNvbnRhaW5lcldpdGhJZChWSUVXTEVUX0lEKTtcblx0XHRcdFx0aWYgKHZpZXdQYW5lQ29udGFpbmVyKSB7XG5cdFx0XHRcdFx0YXdhaXQgKHZpZXdQYW5lQ29udGFpbmVyIGFzIElFeHRlbnNpb25zVmlld1BhbmVDb250YWluZXIpLnJlZnJlc2goKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbkFjdGlvbih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5pbnN0YWxsV29ya3NwYWNlUmVjb21tZW5kZWRFeHRlbnNpb25zJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnaW5zdGFsbFdvcmtzcGFjZVJlY29tbWVuZGVkRXh0ZW5zaW9ucycsIFwiSW5zdGFsbCBXb3Jrc3BhY2UgUmVjb21tZW5kZWQgRXh0ZW5zaW9uc1wiKSxcblx0XHRcdGljb246IGluc3RhbGxXb3Jrc3BhY2VSZWNvbW1lbmRlZEljb24sXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuVmlld1RpdGxlLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3ZpZXcnLCBXT1JLU1BBQ0VfUkVDT01NRU5EQVRJT05TX1ZJRVdfSUQpLFxuXHRcdFx0XHRncm91cDogJ25hdmlnYXRpb24nLFxuXHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0fSxcblx0XHRcdHJ1bjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHZpZXcgPSBhY2Nlc3Nvci5nZXQoSVZpZXdzU2VydmljZSkuZ2V0QWN0aXZlVmlld1dpdGhJZChXT1JLU1BBQ0VfUkVDT01NRU5EQVRJT05TX1ZJRVdfSUQpIGFzIElXb3Jrc3BhY2VSZWNvbW1lbmRlZEV4dGVuc2lvbnNWaWV3O1xuXHRcdFx0XHRyZXR1cm4gdmlldy5pbnN0YWxsV29ya3NwYWNlUmVjb21tZW5kYXRpb25zKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXh0ZW5zaW9uQWN0aW9uKHtcblx0XHRcdGlkOiBDb25maWd1cmVXb3Jrc3BhY2VGb2xkZXJSZWNvbW1lbmRlZEV4dGVuc2lvbnNBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogQ29uZmlndXJlV29ya3NwYWNlRm9sZGVyUmVjb21tZW5kZWRFeHRlbnNpb25zQWN0aW9uLkxBQkVMLFxuXHRcdFx0aWNvbjogY29uZmlndXJlUmVjb21tZW5kZWRJY29uLFxuXHRcdFx0bWVudTogW3tcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogV29ya2JlbmNoU3RhdGVDb250ZXh0Lm5vdEVxdWFsc1RvKCdlbXB0eScpLFxuXHRcdFx0fSwge1xuXHRcdFx0XHRpZDogTWVudUlkLlZpZXdUaXRsZSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKCd2aWV3JywgV09SS1NQQUNFX1JFQ09NTUVOREFUSU9OU19WSUVXX0lEKSxcblx0XHRcdFx0Z3JvdXA6ICduYXZpZ2F0aW9uJyxcblx0XHRcdFx0b3JkZXI6IDJcblx0XHRcdH1dLFxuXHRcdFx0cnVuOiAoKSA9PiBydW5BY3Rpb24odGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb25maWd1cmVXb3Jrc3BhY2VGb2xkZXJSZWNvbW1lbmRlZEV4dGVuc2lvbnNBY3Rpb24sIENvbmZpZ3VyZVdvcmtzcGFjZUZvbGRlclJlY29tbWVuZGVkRXh0ZW5zaW9uc0FjdGlvbi5JRCwgQ29uZmlndXJlV29ya3NwYWNlRm9sZGVyUmVjb21tZW5kZWRFeHRlbnNpb25zQWN0aW9uLkxBQkVMKSlcblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6IEluc3RhbGxTcGVjaWZpY1ZlcnNpb25PZkV4dGVuc2lvbkFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiB7IHZhbHVlOiBJbnN0YWxsU3BlY2lmaWNWZXJzaW9uT2ZFeHRlbnNpb25BY3Rpb24uTEFCRUwsIG9yaWdpbmFsOiAnSW5zdGFsbCBTcGVjaWZpYyBWZXJzaW9uIG9mIEV4dGVuc2lvbi4uLicgfSxcblx0XHRcdGNhdGVnb3J5OiBFeHRlbnNpb25zTG9jYWxpemVkTGFiZWwsXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0hBU19HQUxMRVJZLCBDb250ZXh0S2V5RXhwci5vcihDT05URVhUX0hBU19MT0NBTF9TRVJWRVIsIENPTlRFWFRfSEFTX1JFTU9URV9TRVJWRVIsIENPTlRFWFRfSEFTX1dFQl9TRVJWRVIpKVxuXHRcdFx0fSxcblx0XHRcdHJ1bjogKCkgPT4gcnVuQWN0aW9uKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW5zdGFsbFNwZWNpZmljVmVyc2lvbk9mRXh0ZW5zaW9uQWN0aW9uLCBJbnN0YWxsU3BlY2lmaWNWZXJzaW9uT2ZFeHRlbnNpb25BY3Rpb24uSUQsIEluc3RhbGxTcGVjaWZpY1ZlcnNpb25PZkV4dGVuc2lvbkFjdGlvbi5MQUJFTCkpXG5cdFx0fSk7XG5cdH1cblxuXHQvLyBFeHRlbnNpb24gQ29udGV4dCBNZW51XG5cdHByaXZhdGUgcmVnaXN0ZXJDb250ZXh0TWVudUFjdGlvbnMoKTogdm9pZCB7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXh0ZW5zaW9uQWN0aW9uKHtcblx0XHRcdGlkOiBTZXRDb2xvclRoZW1lQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IFNldENvbG9yVGhlbWVBY3Rpb24uVElUTEUsXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuRXh0ZW5zaW9uQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6IFRIRU1FX0FDVElPTlNfR1JPVVAsXG5cdFx0XHRcdG9yZGVyOiAwLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIubm90KCdpbkV4dGVuc2lvbkVkaXRvcicpLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2V4dGVuc2lvblN0YXR1cycsICdpbnN0YWxsZWQnKSwgQ29udGV4dEtleUV4cHIuaGFzKCdleHRlbnNpb25IYXNDb2xvclRoZW1lcycpKVxuXHRcdFx0fSxcblx0XHRcdHJ1bjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBleHRlbnNpb25JZDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbldvcmtiZW5jaFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uID0gZXh0ZW5zaW9uV29ya2JlbmNoU2VydmljZS5sb2NhbC5maW5kKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZS5pZGVudGlmaWVyLCB7IGlkOiBleHRlbnNpb25JZCB9KSk7XG5cdFx0XHRcdGlmIChleHRlbnNpb24pIHtcblx0XHRcdFx0XHRjb25zdCBhY3Rpb24gPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZXRDb2xvclRoZW1lQWN0aW9uKTtcblx0XHRcdFx0XHRhY3Rpb24uZXh0ZW5zaW9uID0gZXh0ZW5zaW9uO1xuXHRcdFx0XHRcdHJldHVybiBhY3Rpb24ucnVuKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6IFNldEZpbGVJY29uVGhlbWVBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogU2V0RmlsZUljb25UaGVtZUFjdGlvbi5USVRMRSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5FeHRlbnNpb25Db250ZXh0LFxuXHRcdFx0XHRncm91cDogVEhFTUVfQUNUSU9OU19HUk9VUCxcblx0XHRcdFx0b3JkZXI6IDAsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5ub3QoJ2luRXh0ZW5zaW9uRWRpdG9yJyksIENvbnRleHRLZXlFeHByLmVxdWFscygnZXh0ZW5zaW9uU3RhdHVzJywgJ2luc3RhbGxlZCcpLCBDb250ZXh0S2V5RXhwci5oYXMoJ2V4dGVuc2lvbkhhc0ZpbGVJY29uVGhlbWVzJykpXG5cdFx0XHR9LFxuXHRcdFx0cnVuOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGV4dGVuc2lvbklkOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uV29ya2JlbmNoU2VydmljZSA9IGFjY2Vzc29yLmdldChJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb24gPSBleHRlbnNpb25Xb3JrYmVuY2hTZXJ2aWNlLmxvY2FsLmZpbmQoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIHsgaWQ6IGV4dGVuc2lvbklkIH0pKTtcblx0XHRcdFx0aWYgKGV4dGVuc2lvbikge1xuXHRcdFx0XHRcdGNvbnN0IGFjdGlvbiA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNldEZpbGVJY29uVGhlbWVBY3Rpb24pO1xuXHRcdFx0XHRcdGFjdGlvbi5leHRlbnNpb24gPSBleHRlbnNpb247XG5cdFx0XHRcdFx0cmV0dXJuIGFjdGlvbi5ydW4oKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbkFjdGlvbih7XG5cdFx0XHRpZDogU2V0UHJvZHVjdEljb25UaGVtZUFjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiBTZXRQcm9kdWN0SWNvblRoZW1lQWN0aW9uLlRJVExFLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkV4dGVuc2lvbkNvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiBUSEVNRV9BQ1RJT05TX0dST1VQLFxuXHRcdFx0XHRvcmRlcjogMCxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLm5vdCgnaW5FeHRlbnNpb25FZGl0b3InKSwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCdleHRlbnNpb25TdGF0dXMnLCAnaW5zdGFsbGVkJyksIENvbnRleHRLZXlFeHByLmhhcygnZXh0ZW5zaW9uSGFzUHJvZHVjdEljb25UaGVtZXMnKSlcblx0XHRcdH0sXG5cdFx0XHRydW46IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZXh0ZW5zaW9uSWQ6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25Xb3JrYmVuY2hTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbiA9IGV4dGVuc2lvbldvcmtiZW5jaFNlcnZpY2UubG9jYWwuZmluZChlID0+IGFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgeyBpZDogZXh0ZW5zaW9uSWQgfSkpO1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uKSB7XG5cdFx0XHRcdFx0Y29uc3QgYWN0aW9uID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2V0UHJvZHVjdEljb25UaGVtZUFjdGlvbik7XG5cdFx0XHRcdFx0YWN0aW9uLmV4dGVuc2lvbiA9IGV4dGVuc2lvbjtcblx0XHRcdFx0XHRyZXR1cm4gYWN0aW9uLnJ1bigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXh0ZW5zaW9uQWN0aW9uKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLnNob3dQcmVSZWxlYXNlVmVyc2lvbicsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzaG93IHByZS1yZWxlYXNlIHZlcnNpb24nLCAnU2hvdyBQcmUtUmVsZWFzZSBWZXJzaW9uJyksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuRXh0ZW5zaW9uQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6IElOU1RBTExfQUNUSU9OU19HUk9VUCxcblx0XHRcdFx0b3JkZXI6IDAsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5oYXMoJ2luRXh0ZW5zaW9uRWRpdG9yJyksIENvbnRleHRLZXlFeHByLmhhcygnZ2FsbGVyeUV4dGVuc2lvbkhhc1ByZVJlbGVhc2VWZXJzaW9uJyksIENvbnRleHRLZXlFeHByLmhhcygnaXNQcmVSZWxlYXNlRXh0ZW5zaW9uQWxsb3dlZCcpLCBDb250ZXh0S2V5RXhwci5ub3QoJ3Nob3dQcmVSZWxlYXNlVmVyc2lvbicpLCBDb250ZXh0S2V5RXhwci5ub3QoJ2lzQnVpbHRpbkV4dGVuc2lvbicpKVxuXHRcdFx0fSxcblx0XHRcdHJ1bjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBleHRlbnNpb25JZDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbldvcmtiZW5jaFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uID0gKGF3YWl0IGV4dGVuc2lvbldvcmtiZW5jaFNlcnZpY2UuZ2V0RXh0ZW5zaW9ucyhbeyBpZDogZXh0ZW5zaW9uSWQgfV0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKVswXTtcblx0XHRcdFx0ZXh0ZW5zaW9uV29ya2JlbmNoU2VydmljZS5vcGVuKGV4dGVuc2lvbiwgeyBzaG93UHJlUmVsZWFzZVZlcnNpb246IHRydWUgfSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXh0ZW5zaW9uQWN0aW9uKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLnNob3dSZWxlYXNlZFZlcnNpb24nLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignc2hvdyByZWxlYXNlZCB2ZXJzaW9uJywgJ1Nob3cgUmVsZWFzZSBWZXJzaW9uJyksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuRXh0ZW5zaW9uQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6IElOU1RBTExfQUNUSU9OU19HUk9VUCxcblx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5oYXMoJ2luRXh0ZW5zaW9uRWRpdG9yJyksIENvbnRleHRLZXlFeHByLmhhcygnZ2FsbGVyeUV4dGVuc2lvbkhhc1ByZVJlbGVhc2VWZXJzaW9uJyksIENvbnRleHRLZXlFeHByLmhhcygnZXh0ZW5zaW9uSGFzUmVsZWFzZVZlcnNpb24nKSwgQ29udGV4dEtleUV4cHIuaGFzKCdzaG93UHJlUmVsZWFzZVZlcnNpb24nKSwgQ29udGV4dEtleUV4cHIubm90KCdpc0J1aWx0aW5FeHRlbnNpb24nKSlcblx0XHRcdH0sXG5cdFx0XHRydW46IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZXh0ZW5zaW9uSWQ6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25Xb3JrYmVuY2hTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbiA9IChhd2FpdCBleHRlbnNpb25Xb3JrYmVuY2hTZXJ2aWNlLmdldEV4dGVuc2lvbnMoW3sgaWQ6IGV4dGVuc2lvbklkIH1dLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSlbMF07XG5cdFx0XHRcdGV4dGVuc2lvbldvcmtiZW5jaFNlcnZpY2Uub3BlbihleHRlbnNpb24sIHsgc2hvd1ByZVJlbGVhc2VWZXJzaW9uOiBmYWxzZSB9KTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6IFRvZ2dsZUF1dG9VcGRhdGVGb3JFeHRlbnNpb25BY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogVG9nZ2xlQXV0b1VwZGF0ZUZvckV4dGVuc2lvbkFjdGlvbi5MQUJFTCxcblx0XHRcdGNhdGVnb3J5OiBFeHRlbnNpb25zTG9jYWxpemVkTGFiZWwsXG5cdFx0XHRwcmVjb25kaXRpb246IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5vcihDb250ZXh0S2V5RXhwci5ub3RFcXVhbHMoYGNvbmZpZy4ke0F1dG9VcGRhdGVDb25maWd1cmF0aW9uS2V5fWAsICdvbmx5RW5hYmxlZEV4dGVuc2lvbnMnKSwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCdpc0V4dGVuc2lvbkVuYWJsZWQnLCB0cnVlKSksIENvbnRleHRLZXlFeHByLm5vdCgnZXh0ZW5zaW9uRGlzYWxsb3dJbnN0YWxsJyksIENvbnRleHRLZXlFeHByLmhhcygnaXNFeHRlbnNpb25BbGxvd2VkJykpLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkV4dGVuc2lvbkNvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiBVUERBVEVfQUNUSU9OU19HUk9VUCxcblx0XHRcdFx0b3JkZXI6IDEsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5ub3QoJ2luRXh0ZW5zaW9uRWRpdG9yJyksXG5cdFx0XHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKCdleHRlbnNpb25TdGF0dXMnLCAnaW5zdGFsbGVkJyksXG5cdFx0XHRcdFx0Q29udGV4dEtleUV4cHIubm90KCdpc0J1aWx0aW5FeHRlbnNpb24nKSxcblx0XHRcdFx0KVxuXHRcdFx0fSxcblx0XHRcdHJ1bjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBpZDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbldvcmtiZW5jaFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uID0gZXh0ZW5zaW9uV29ya2JlbmNoU2VydmljZS5sb2NhbC5maW5kKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZS5pZGVudGlmaWVyLCB7IGlkIH0pKTtcblx0XHRcdFx0aWYgKGV4dGVuc2lvbikge1xuXHRcdFx0XHRcdGNvbnN0IGFjdGlvbiA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRvZ2dsZUF1dG9VcGRhdGVGb3JFeHRlbnNpb25BY3Rpb24pO1xuXHRcdFx0XHRcdGFjdGlvbi5leHRlbnNpb24gPSBleHRlbnNpb247XG5cdFx0XHRcdFx0cmV0dXJuIGFjdGlvbi5ydW4oKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbkFjdGlvbih7XG5cdFx0XHRpZDogVG9nZ2xlQXV0b1VwZGF0ZXNGb3JQdWJsaXNoZXJBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogeyB2YWx1ZTogVG9nZ2xlQXV0b1VwZGF0ZXNGb3JQdWJsaXNoZXJBY3Rpb24uTEFCRUwsIG9yaWdpbmFsOiAnQXV0byBVcGRhdGUgKFB1Ymxpc2hlciknIH0sXG5cdFx0XHRjYXRlZ29yeTogRXh0ZW5zaW9uc0xvY2FsaXplZExhYmVsLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoYGNvbmZpZy4ke0F1dG9VcGRhdGVDb25maWd1cmF0aW9uS2V5fWAsIGZhbHNlKSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5FeHRlbnNpb25Db250ZXh0LFxuXHRcdFx0XHRncm91cDogVVBEQVRFX0FDVElPTlNfR1JPVVAsXG5cdFx0XHRcdG9yZGVyOiAyLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKCdleHRlbnNpb25TdGF0dXMnLCAnaW5zdGFsbGVkJyksIENvbnRleHRLZXlFeHByLm5vdCgnaXNCdWlsdGluRXh0ZW5zaW9uJykpXG5cdFx0XHR9LFxuXHRcdFx0cnVuOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGlkOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uV29ya2JlbmNoU2VydmljZSA9IGFjY2Vzc29yLmdldChJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb24gPSBleHRlbnNpb25Xb3JrYmVuY2hTZXJ2aWNlLmxvY2FsLmZpbmQoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIHsgaWQgfSkpO1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uKSB7XG5cdFx0XHRcdFx0Y29uc3QgYWN0aW9uID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVG9nZ2xlQXV0b1VwZGF0ZXNGb3JQdWJsaXNoZXJBY3Rpb24pO1xuXHRcdFx0XHRcdGFjdGlvbi5leHRlbnNpb24gPSBleHRlbnNpb247XG5cdFx0XHRcdFx0cmV0dXJuIGFjdGlvbi5ydW4oKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbkFjdGlvbih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5zd2l0Y2hUb1ByZVJsZWFzZScsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ2VuYWJsZVByZVJsZWFzZUxhYmVsJywgXCJTd2l0Y2ggdG8gUHJlLVJlbGVhc2UgVmVyc2lvblwiKSxcblx0XHRcdGNhdGVnb3J5OiBFeHRlbnNpb25zTG9jYWxpemVkTGFiZWwsXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuRXh0ZW5zaW9uQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6IElOU1RBTExfQUNUSU9OU19HUk9VUCxcblx0XHRcdFx0b3JkZXI6IDIsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0hBU19HQUxMRVJZLCBDb250ZXh0S2V5RXhwci5oYXMoJ2dhbGxlcnlFeHRlbnNpb25IYXNQcmVSZWxlYXNlVmVyc2lvbicpLCBDb250ZXh0S2V5RXhwci5oYXMoJ2lzUHJlUmVsZWFzZUV4dGVuc2lvbkFsbG93ZWQnKSwgQ29udGV4dEtleUV4cHIubm90KCdpbnN0YWxsZWRFeHRlbnNpb25Jc09wdGVkVG9QcmVSZWxlYXNlJyksIENvbnRleHRLZXlFeHByLm5vdCgnaW5FeHRlbnNpb25FZGl0b3InKSwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCdleHRlbnNpb25TdGF0dXMnLCAnaW5zdGFsbGVkJyksIENvbnRleHRLZXlFeHByLm5vdCgnaXNCdWlsdGluRXh0ZW5zaW9uJykpXG5cdFx0XHR9LFxuXHRcdFx0cnVuOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGlkOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uV29ya2JlbmNoU2VydmljZSA9IGFjY2Vzc29yLmdldChJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb24gPSBleHRlbnNpb25Xb3JrYmVuY2hTZXJ2aWNlLmxvY2FsLmZpbmQoZSA9PiBhcmVTYW1lRXh0ZW5zaW9ucyhlLmlkZW50aWZpZXIsIHsgaWQgfSkpO1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uKSB7XG5cdFx0XHRcdFx0Y29uc3QgYWN0aW9uID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVG9nZ2xlUHJlUmVsZWFzZUV4dGVuc2lvbkFjdGlvbik7XG5cdFx0XHRcdFx0YWN0aW9uLmV4dGVuc2lvbiA9IGV4dGVuc2lvbjtcblx0XHRcdFx0XHRyZXR1cm4gYWN0aW9uLnJ1bigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXh0ZW5zaW9uQWN0aW9uKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLnN3aXRjaFRvUmVsZWFzZScsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ2Rpc2FibGVQcmVSbGVhc2VMYWJlbCcsIFwiU3dpdGNoIHRvIFJlbGVhc2UgVmVyc2lvblwiKSxcblx0XHRcdGNhdGVnb3J5OiBFeHRlbnNpb25zTG9jYWxpemVkTGFiZWwsXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuRXh0ZW5zaW9uQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6IElOU1RBTExfQUNUSU9OU19HUk9VUCxcblx0XHRcdFx0b3JkZXI6IDIsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDT05URVhUX0hBU19HQUxMRVJZLCBDb250ZXh0S2V5RXhwci5oYXMoJ2dhbGxlcnlFeHRlbnNpb25IYXNQcmVSZWxlYXNlVmVyc2lvbicpLCBDb250ZXh0S2V5RXhwci5oYXMoJ2lzRXh0ZW5zaW9uQWxsb3dlZCcpLCBDb250ZXh0S2V5RXhwci5oYXMoJ2luc3RhbGxlZEV4dGVuc2lvbklzT3B0ZWRUb1ByZVJlbGVhc2UnKSwgQ29udGV4dEtleUV4cHIubm90KCdpbkV4dGVuc2lvbkVkaXRvcicpLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2V4dGVuc2lvblN0YXR1cycsICdpbnN0YWxsZWQnKSwgQ29udGV4dEtleUV4cHIubm90KCdpc0J1aWx0aW5FeHRlbnNpb24nKSlcblx0XHRcdH0sXG5cdFx0XHRydW46IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgaWQ6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25Xb3JrYmVuY2hTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbiA9IGV4dGVuc2lvbldvcmtiZW5jaFNlcnZpY2UubG9jYWwuZmluZChlID0+IGFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgeyBpZCB9KSk7XG5cdFx0XHRcdGlmIChleHRlbnNpb24pIHtcblx0XHRcdFx0XHRjb25zdCBhY3Rpb24gPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUb2dnbGVQcmVSZWxlYXNlRXh0ZW5zaW9uQWN0aW9uKTtcblx0XHRcdFx0XHRhY3Rpb24uZXh0ZW5zaW9uID0gZXh0ZW5zaW9uO1xuXHRcdFx0XHRcdHJldHVybiBhY3Rpb24ucnVuKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6IENsZWFyTGFuZ3VhZ2VBY3Rpb24uSUQsXG5cdFx0XHR0aXRsZTogQ2xlYXJMYW5ndWFnZUFjdGlvbi5USVRMRSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5FeHRlbnNpb25Db250ZXh0LFxuXHRcdFx0XHRncm91cDogSU5TVEFMTF9BQ1RJT05TX0dST1VQLFxuXHRcdFx0XHRvcmRlcjogMCxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLm5vdCgnaW5FeHRlbnNpb25FZGl0b3InKSwgQ29udGV4dEtleUV4cHIuaGFzKCdjYW5TZXRMYW5ndWFnZScpLCBDb250ZXh0S2V5RXhwci5oYXMoJ2lzQWN0aXZlTGFuZ3VhZ2VQYWNrRXh0ZW5zaW9uJykpXG5cdFx0XHR9LFxuXHRcdFx0cnVuOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGV4dGVuc2lvbklkOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgZXh0ZW5zaW9uID0gKGF3YWl0IGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmdldEV4dGVuc2lvbnMoW3sgaWQ6IGV4dGVuc2lvbklkIH1dLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSlbMF07XG5cdFx0XHRcdGNvbnN0IGFjdGlvbiA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENsZWFyTGFuZ3VhZ2VBY3Rpb24pO1xuXHRcdFx0XHRhY3Rpb24uZXh0ZW5zaW9uID0gZXh0ZW5zaW9uO1xuXHRcdFx0XHRyZXR1cm4gYWN0aW9uLnJ1bigpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbkFjdGlvbih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5pbnN0YWxsVW5zaWduZWQnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdpbnN0YWxsJywgXCJJbnN0YWxsXCIpLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkV4dGVuc2lvbkNvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAnMF9pbnN0YWxsJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygnZXh0ZW5zaW9uU3RhdHVzJywgJ3VuaW5zdGFsbGVkJyksIENvbnRleHRLZXlFeHByLmhhcygnaXNHYWxsZXJ5RXh0ZW5zaW9uJyksIENvbnRleHRLZXlFeHByLm5vdCgnZXh0ZW5zaW9uRGlzYWxsb3dJbnN0YWxsJyksIENvbnRleHRLZXlFeHByLmhhcygnZXh0ZW5zaW9uSXNVbnNpZ25lZCcpLCBDT05URVhUX0dBTExFUllfQUxMX1JFUE9TSVRPUllfU0lHTkVEKSxcblx0XHRcdFx0b3JkZXI6IDFcblx0XHRcdH0sXG5cdFx0XHRydW46IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZXh0ZW5zaW9uSWQ6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb24gPSB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmxvY2FsLmZpbHRlcihlID0+IGFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgeyBpZDogZXh0ZW5zaW9uSWQgfSkpWzBdXG5cdFx0XHRcdFx0fHwgKGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuZ2V0RXh0ZW5zaW9ucyhbeyBpZDogZXh0ZW5zaW9uSWQgfV0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKVswXTtcblx0XHRcdFx0aWYgKGV4dGVuc2lvbikge1xuXHRcdFx0XHRcdGNvbnN0IGFjdGlvbiA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEluc3RhbGxBY3Rpb24sIHsgaW5zdGFsbFByZVJlbGVhc2VWZXJzaW9uOiB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnByZWZlclByZVJlbGVhc2VzIH0pO1xuXHRcdFx0XHRcdGFjdGlvbi5leHRlbnNpb24gPSBleHRlbnNpb247XG5cdFx0XHRcdFx0cmV0dXJuIGFjdGlvbi5ydW4oKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbkFjdGlvbih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5pbnN0YWxsQW5kRG9ub3RTeW5jJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnaW5zdGFsbCBpbnN0YWxsQW5kRG9ub3RTeW5jJywgXCJJbnN0YWxsIChEbyBub3QgU3luYylcIiksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuRXh0ZW5zaW9uQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6ICcwX2luc3RhbGwnLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKCdleHRlbnNpb25TdGF0dXMnLCAndW5pbnN0YWxsZWQnKSwgQ29udGV4dEtleUV4cHIuaGFzKCdpc0dhbGxlcnlFeHRlbnNpb24nKSwgQ29udGV4dEtleUV4cHIuaGFzKCdpc0V4dGVuc2lvbkFsbG93ZWQnKSwgQ29udGV4dEtleUV4cHIubm90KCdleHRlbnNpb25EaXNhbGxvd0luc3RhbGwnKSwgQ09OVEVYVF9TWU5DX0VOQUJMRU1FTlQpLFxuXHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0fSxcblx0XHRcdHJ1bjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBleHRlbnNpb25JZDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbiA9IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UubG9jYWwuZmlsdGVyKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZS5pZGVudGlmaWVyLCB7IGlkOiBleHRlbnNpb25JZCB9KSlbMF1cblx0XHRcdFx0XHR8fCAoYXdhaXQgdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5nZXRFeHRlbnNpb25zKFt7IGlkOiBleHRlbnNpb25JZCB9XSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkpWzBdO1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uKSB7XG5cdFx0XHRcdFx0Y29uc3QgYWN0aW9uID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW5zdGFsbEFjdGlvbiwge1xuXHRcdFx0XHRcdFx0aW5zdGFsbFByZVJlbGVhc2VWZXJzaW9uOiB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLnByZWZlclByZVJlbGVhc2VzLFxuXHRcdFx0XHRcdFx0aXNNYWNoaW5lU2NvcGVkOiB0cnVlLFxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGFjdGlvbi5leHRlbnNpb24gPSBleHRlbnNpb247XG5cdFx0XHRcdFx0cmV0dXJuIGFjdGlvbi5ydW4oKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbkFjdGlvbih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5pbnN0YWxsUHJlcmVsZWFzZUFuZERvbm90U3luYycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ2luc3RhbGxQcmVyZWxlYXNlQW5kRG9ub3RTeW5jJywgXCJJbnN0YWxsIFByZS1SZWxlYXNlIChEbyBub3QgU3luYylcIiksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuRXh0ZW5zaW9uQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6ICcwX2luc3RhbGwnLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKCdleHRlbnNpb25TdGF0dXMnLCAndW5pbnN0YWxsZWQnKSwgQ29udGV4dEtleUV4cHIuaGFzKCdpc0dhbGxlcnlFeHRlbnNpb24nKSwgQ29udGV4dEtleUV4cHIuaGFzKCdleHRlbnNpb25IYXNQcmVSZWxlYXNlVmVyc2lvbicpLCBDb250ZXh0S2V5RXhwci5oYXMoJ2lzUHJlUmVsZWFzZUV4dGVuc2lvbkFsbG93ZWQnKSwgQ29udGV4dEtleUV4cHIubm90KCdleHRlbnNpb25EaXNhbGxvd0luc3RhbGwnKSwgQ09OVEVYVF9TWU5DX0VOQUJMRU1FTlQpLFxuXHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0fSxcblx0XHRcdHJ1bjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBleHRlbnNpb25JZDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElJbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbiA9IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UubG9jYWwuZmlsdGVyKGUgPT4gYXJlU2FtZUV4dGVuc2lvbnMoZS5pZGVudGlmaWVyLCB7IGlkOiBleHRlbnNpb25JZCB9KSlbMF1cblx0XHRcdFx0XHR8fCAoYXdhaXQgdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5nZXRFeHRlbnNpb25zKFt7IGlkOiBleHRlbnNpb25JZCB9XSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkpWzBdO1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uKSB7XG5cdFx0XHRcdFx0Y29uc3QgYWN0aW9uID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoSW5zdGFsbEFjdGlvbiwge1xuXHRcdFx0XHRcdFx0aXNNYWNoaW5lU2NvcGVkOiB0cnVlLFxuXHRcdFx0XHRcdFx0cHJlUmVsZWFzZTogdHJ1ZVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGFjdGlvbi5leHRlbnNpb24gPSBleHRlbnNpb247XG5cdFx0XHRcdFx0cmV0dXJuIGFjdGlvbi5ydW4oKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbkFjdGlvbih7XG5cdFx0XHRpZDogSW5zdGFsbEFub3RoZXJWZXJzaW9uQWN0aW9uLklELFxuXHRcdFx0dGl0bGU6IEluc3RhbGxBbm90aGVyVmVyc2lvbkFjdGlvbi5MQUJFTCxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5FeHRlbnNpb25Db250ZXh0LFxuXHRcdFx0XHRncm91cDogJzBfaW5zdGFsbCcsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2V4dGVuc2lvblN0YXR1cycsICd1bmluc3RhbGxlZCcpLCBDb250ZXh0S2V5RXhwci5oYXMoJ2lzR2FsbGVyeUV4dGVuc2lvbicpLCBDb250ZXh0S2V5RXhwci5oYXMoJ2lzRXh0ZW5zaW9uQWxsb3dlZCcpLCBDb250ZXh0S2V5RXhwci5ub3QoJ2V4dGVuc2lvbkRpc2FsbG93SW5zdGFsbCcpKSxcblx0XHRcdFx0b3JkZXI6IDNcblx0XHRcdH0sXG5cdFx0XHRydW46IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZXh0ZW5zaW9uSWQ6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb24gPSB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmxvY2FsLmZpbHRlcihlID0+IGFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgeyBpZDogZXh0ZW5zaW9uSWQgfSkpWzBdXG5cdFx0XHRcdFx0fHwgKGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuZ2V0RXh0ZW5zaW9ucyhbeyBpZDogZXh0ZW5zaW9uSWQgfV0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKVswXTtcblx0XHRcdFx0aWYgKGV4dGVuc2lvbikge1xuXHRcdFx0XHRcdHJldHVybiBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShJbnN0YWxsQW5vdGhlclZlcnNpb25BY3Rpb24sIGV4dGVuc2lvbiwgZmFsc2UpLnJ1bigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXh0ZW5zaW9uQWN0aW9uKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLmNvcHlFeHRlbnNpb24nLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLmNvcHlFeHRlbnNpb24nLCAnQ29weScpLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkV4dGVuc2lvbkNvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAnMV9jb3B5J1xuXHRcdFx0fSxcblx0XHRcdHJ1bjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBleHRlbnNpb25JZDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGNsaXBib2FyZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNsaXBib2FyZFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb24gPSB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmxvY2FsLmZpbHRlcihlID0+IGFyZVNhbWVFeHRlbnNpb25zKGUuaWRlbnRpZmllciwgeyBpZDogZXh0ZW5zaW9uSWQgfSkpWzBdXG5cdFx0XHRcdFx0fHwgKGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuZ2V0RXh0ZW5zaW9ucyhbeyBpZDogZXh0ZW5zaW9uSWQgfV0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKVswXTtcblx0XHRcdFx0aWYgKGV4dGVuc2lvbikge1xuXHRcdFx0XHRcdGNvbnN0IG5hbWUgPSBsb2NhbGl6ZSgnZXh0ZW5zaW9uSW5mb05hbWUnLCAnTmFtZTogezB9JywgZXh0ZW5zaW9uLmRpc3BsYXlOYW1lKTtcblx0XHRcdFx0XHRjb25zdCBpZCA9IGxvY2FsaXplKCdleHRlbnNpb25JbmZvSWQnLCAnSWQ6IHswfScsIGV4dGVuc2lvbklkKTtcblx0XHRcdFx0XHRjb25zdCBkZXNjcmlwdGlvbiA9IGxvY2FsaXplKCdleHRlbnNpb25JbmZvRGVzY3JpcHRpb24nLCAnRGVzY3JpcHRpb246IHswfScsIGV4dGVuc2lvbi5kZXNjcmlwdGlvbik7XG5cdFx0XHRcdFx0Y29uc3QgdmVyaXNpb24gPSBsb2NhbGl6ZSgnZXh0ZW5zaW9uSW5mb1ZlcnNpb24nLCAnVmVyc2lvbjogezB9JywgZXh0ZW5zaW9uLnZlcnNpb24pO1xuXHRcdFx0XHRcdGNvbnN0IHB1Ymxpc2hlciA9IGxvY2FsaXplKCdleHRlbnNpb25JbmZvUHVibGlzaGVyJywgJ1B1Ymxpc2hlcjogezB9JywgZXh0ZW5zaW9uLnB1Ymxpc2hlckRpc3BsYXlOYW1lKTtcblx0XHRcdFx0XHRjb25zdCBsaW5rID0gZXh0ZW5zaW9uLnVybCA/IGxvY2FsaXplKCdleHRlbnNpb25JbmZvVlNNYXJrZXRwbGFjZUxpbmsnLCAnVlMgTWFya2V0cGxhY2UgTGluazogezB9JywgYCR7ZXh0ZW5zaW9uLnVybH1gKSA6IG51bGw7XG5cdFx0XHRcdFx0Y29uc3QgY2xpcGJvYXJkU3RyID0gYCR7bmFtZX1cXG4ke2lkfVxcbiR7ZGVzY3JpcHRpb259XFxuJHt2ZXJpc2lvbn1cXG4ke3B1Ymxpc2hlcn0ke2xpbmsgPyAnXFxuJyArIGxpbmsgOiAnJ31gO1xuXHRcdFx0XHRcdGF3YWl0IGNsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KGNsaXBib2FyZFN0cik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uY29weUV4dGVuc2lvbklkJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5jb3B5RXh0ZW5zaW9uSWQnLCAnQ29weSBFeHRlbnNpb24gSUQnKSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5FeHRlbnNpb25Db250ZXh0LFxuXHRcdFx0XHRncm91cDogJzFfY29weSdcblx0XHRcdH0sXG5cdFx0XHRydW46IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgaWQ6IHN0cmluZykgPT4gYWNjZXNzb3IuZ2V0KElDbGlwYm9hcmRTZXJ2aWNlKS53cml0ZVRleHQoaWQpXG5cdFx0fSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXh0ZW5zaW9uQWN0aW9uKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLmNvcHlMaW5rJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5jb3B5TGluaycsICdDb3B5IExpbmsnKSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5FeHRlbnNpb25Db250ZXh0LFxuXHRcdFx0XHRncm91cDogJzFfY29weScsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5oYXMoJ2lzR2FsbGVyeUV4dGVuc2lvbicpLCBDT05URVhUX0dBTExFUllfSEFTX0VYVEVOU0lPTl9MSU5LKSxcblx0XHRcdH0sXG5cdFx0XHRydW46IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgXywgZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uQXJnKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGNsaXBib2FyZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNsaXBib2FyZFNlcnZpY2UpO1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uLmdhbGxlcnlMaW5rKSB7XG5cdFx0XHRcdFx0YXdhaXQgY2xpcGJvYXJkU2VydmljZS53cml0ZVRleHQoZXh0ZW5zaW9uLmdhbGxlcnlMaW5rKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbkFjdGlvbih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5jb25maWd1cmUnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLmNvbmZpZ3VyZScsICdTZXR0aW5ncycpLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkV4dGVuc2lvbkNvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAnMl9jb25maWd1cmUnLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKCdleHRlbnNpb25TdGF0dXMnLCAnaW5zdGFsbGVkJyksIENvbnRleHRLZXlFeHByLmhhcygnZXh0ZW5zaW9uSGFzQ29uZmlndXJhdGlvbicpKSxcblx0XHRcdFx0b3JkZXI6IDFcblx0XHRcdH0sXG5cdFx0XHRydW46IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgaWQ6IHN0cmluZykgPT4gYWNjZXNzb3IuZ2V0KElQcmVmZXJlbmNlc1NlcnZpY2UpLm9wZW5TZXR0aW5ncyh7IGpzb25FZGl0b3I6IGZhbHNlLCBxdWVyeTogYEBleHQ6JHtpZH1gIH0pXG5cdFx0fSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXh0ZW5zaW9uQWN0aW9uKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLmRvd25sb2FkJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZG93bmxvYWQgVlNJWCcsIFwiRG93bmxvYWQgVlNJWFwiKSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5FeHRlbnNpb25Db250ZXh0LFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKCdleHRlbnNpb25TdGF0dXMnLCAndW5pbnN0YWxsZWQnKSwgQ29udGV4dEtleUV4cHIubm90KCdleHRlbnNpb25EaXNhbGxvd0luc3RhbGwnKSwgQ29udGV4dEtleUV4cHIuaGFzKCdpc0dhbGxlcnlFeHRlbnNpb24nKSksXG5cdFx0XHRcdG9yZGVyOiB0aGlzLnByb2R1Y3RTZXJ2aWNlLnF1YWxpdHkgPT09ICdzdGFibGUnID8gMCA6IDFcblx0XHRcdH0sXG5cdFx0XHRydW46IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZXh0ZW5zaW9uSWQ6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlKS5kb3dubG9hZFZTSVgoZXh0ZW5zaW9uSWQsIGZhbHNlKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uZG93bmxvYWRQcmVSZWxlYXNlJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZSgnZG93bmxvYWQgcHJlLXJlbGVhc2UnLCBcIkRvd25sb2FkIFByZS1SZWxlYXNlIFZTSVhcIiksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuRXh0ZW5zaW9uQ29udGV4dCxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygnZXh0ZW5zaW9uU3RhdHVzJywgJ3VuaW5zdGFsbGVkJyksIENvbnRleHRLZXlFeHByLm5vdCgnZXh0ZW5zaW9uRGlzYWxsb3dJbnN0YWxsJyksIENvbnRleHRLZXlFeHByLmhhcygnaXNHYWxsZXJ5RXh0ZW5zaW9uJyksIENvbnRleHRLZXlFeHByLmhhcygnZXh0ZW5zaW9uSGFzUHJlUmVsZWFzZVZlcnNpb24nKSksXG5cdFx0XHRcdG9yZGVyOiB0aGlzLnByb2R1Y3RTZXJ2aWNlLnF1YWxpdHkgPT09ICdzdGFibGUnID8gMSA6IDBcblx0XHRcdH0sXG5cdFx0XHRydW46IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgZXh0ZW5zaW9uSWQ6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlKS5kb3dubG9hZFZTSVgoZXh0ZW5zaW9uSWQsIHRydWUpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbkFjdGlvbih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5tYW5hZ2VBY2NvdW50UHJlZmVyZW5jZXMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLmNoYW5nZUFjY291bnRQcmVmZXJlbmNlJywgXCJBY2NvdW50IFByZWZlcmVuY2VzXCIpLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkV4dGVuc2lvbkNvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAnMl9jb25maWd1cmUnLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKCdleHRlbnNpb25TdGF0dXMnLCAnaW5zdGFsbGVkJyksIENvbnRleHRLZXlFeHByLmhhcygnZXh0ZW5zaW9uSGFzQWNjb3VudFByZWZlcmVuY2VzJykpLFxuXHRcdFx0XHRvcmRlcjogMixcblx0XHRcdH0sXG5cdFx0XHRydW46IChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgaWQ6IHN0cmluZykgPT4gYWNjZXNzb3IuZ2V0KElDb21tYW5kU2VydmljZSkuZXhlY3V0ZUNvbW1hbmQoJ19tYW5hZ2VBY2NvdW50UHJlZmVyZW5jZXNGb3JFeHRlbnNpb24nLCBpZClcblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uY29uZmlndXJlS2V5YmluZGluZ3MnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLmNvbmZpZ3VyZUtleWJpbmRpbmdzJywgJ0tleWJvYXJkIFNob3J0Y3V0cycpLFxuXHRcdFx0bWVudToge1xuXHRcdFx0XHRpZDogTWVudUlkLkV4dGVuc2lvbkNvbnRleHQsXG5cdFx0XHRcdGdyb3VwOiAnMl9jb25maWd1cmUnLFxuXHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKCdleHRlbnNpb25TdGF0dXMnLCAnaW5zdGFsbGVkJyksIENvbnRleHRLZXlFeHByLmhhcygnZXh0ZW5zaW9uSGFzS2V5YmluZGluZ3MnKSksXG5cdFx0XHRcdG9yZGVyOiAyXG5cdFx0XHR9LFxuXHRcdFx0cnVuOiBhc3luYyAoYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IsIGlkOiBzdHJpbmcpID0+IGFjY2Vzc29yLmdldChJUHJlZmVyZW5jZXNTZXJ2aWNlKS5vcGVuR2xvYmFsS2V5YmluZGluZ1NldHRpbmdzKGZhbHNlLCB7IHF1ZXJ5OiBgQGV4dDoke2lkfWAgfSlcblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24udG9nZ2xlQXBwbHlUb0FsbFByb2ZpbGVzJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi50b2dnbGVBcHBseVRvQWxsUHJvZmlsZXMnLCBcIkFwcGx5IEV4dGVuc2lvbiB0byBhbGwgUHJvZmlsZXNcIiksXG5cdFx0XHR0b2dnbGVkOiBDb250ZXh0S2V5RXhwci5oYXMoJ2lzQXBwbGljYXRpb25TY29wZWRFeHRlbnNpb24nKSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5FeHRlbnNpb25Db250ZXh0LFxuXHRcdFx0XHRncm91cDogJzJfY29uZmlndXJlJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKENvbnRleHRLZXlFeHByLmVxdWFscygnZXh0ZW5zaW9uU3RhdHVzJywgJ2luc3RhbGxlZCcpLCBDb250ZXh0S2V5RXhwci5oYXMoJ2lzRGVmYXVsdEFwcGxpY2F0aW9uU2NvcGVkRXh0ZW5zaW9uJykubmVnYXRlKCksIENvbnRleHRLZXlFeHByLmhhcygnaXNCdWlsdGluRXh0ZW5zaW9uJykubmVnYXRlKCksIENvbnRleHRLZXlFeHByLmVxdWFscygnaXNXb3Jrc3BhY2VTY29wZWRFeHRlbnNpb24nLCBmYWxzZSkpLFxuXHRcdFx0XHRvcmRlcjogM1xuXHRcdFx0fSxcblx0XHRcdHJ1bjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBfOiBzdHJpbmcsIGV4dGVuc2lvbkFyZzogSUV4dGVuc2lvbkFyZykgPT4ge1xuXHRcdFx0XHRjb25zdCB1cmlJZGVudGl0eVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVVyaUlkZW50aXR5U2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbiA9IGV4dGVuc2lvbkFyZy5sb2NhdGlvbiA/IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UuaW5zdGFsbGVkLmZpbmQoZSA9PiB1cmlJZGVudGl0eVNlcnZpY2UuZXh0VXJpLmlzRXF1YWwoZS5sb2NhbD8ubG9jYXRpb24sIGV4dGVuc2lvbkFyZy5sb2NhdGlvbikpIDogdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UudG9nZ2xlQXBwbHlFeHRlbnNpb25Ub0FsbFByb2ZpbGVzKGV4dGVuc2lvbik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6IFRPR0dMRV9JR05PUkVfRVhURU5TSU9OX0FDVElPTl9JRCxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi50b2dnbGVJZ25vcmVFeHRlbnNpb24nLCBcIlN5bmMgVGhpcyBFeHRlbnNpb25cIiksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuRXh0ZW5zaW9uQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6ICcyX2NvbmZpZ3VyZScsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2V4dGVuc2lvblN0YXR1cycsICdpbnN0YWxsZWQnKSwgQ09OVEVYVF9TWU5DX0VOQUJMRU1FTlQsIENvbnRleHRLZXlFeHByLmVxdWFscygnaXNXb3Jrc3BhY2VTY29wZWRFeHRlbnNpb24nLCBmYWxzZSkpLFxuXHRcdFx0XHRvcmRlcjogNFxuXHRcdFx0fSxcblx0XHRcdHJ1bjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBpZDogc3RyaW5nKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbiA9IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UubG9jYWwuZmluZChlID0+IGFyZVNhbWVFeHRlbnNpb25zKHsgaWQgfSwgZS5pZGVudGlmaWVyKSk7XG5cdFx0XHRcdGlmIChleHRlbnNpb24pIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS50b2dnbGVFeHRlbnNpb25JZ25vcmVkVG9TeW5jKGV4dGVuc2lvbik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uaWdub3JlUmVjb21tZW5kYXRpb24nLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLmlnbm9yZVJlY29tbWVuZGF0aW9uJywgXCJJZ25vcmUgUmVjb21tZW5kYXRpb25cIiksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuRXh0ZW5zaW9uQ29udGV4dCxcblx0XHRcdFx0Z3JvdXA6ICczX3JlY29tbWVuZGF0aW9ucycsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmhhcygnaXNFeHRlbnNpb25SZWNvbW1lbmRlZCcpLFxuXHRcdFx0XHRvcmRlcjogMVxuXHRcdFx0fSxcblx0XHRcdHJ1bjogYXN5bmMgKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBpZDogc3RyaW5nKSA9PiBhY2Nlc3Nvci5nZXQoSUV4dGVuc2lvbklnbm9yZWRSZWNvbW1lbmRhdGlvbnNTZXJ2aWNlKS50b2dnbGVHbG9iYWxJZ25vcmVkUmVjb21tZW5kYXRpb24oaWQsIHRydWUpXG5cdFx0fSk7XG5cblx0XHR0aGlzLnJlZ2lzdGVyRXh0ZW5zaW9uQWN0aW9uKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLnVuZG9JZ25vcmVkUmVjb21tZW5kYXRpb24nLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLnVuZG9JZ25vcmVkUmVjb21tZW5kYXRpb24nLCBcIlVuZG8gSWdub3JlZCBSZWNvbW1lbmRhdGlvblwiKSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5FeHRlbnNpb25Db250ZXh0LFxuXHRcdFx0XHRncm91cDogJzNfcmVjb21tZW5kYXRpb25zJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuaGFzKCdpc1VzZXJJZ25vcmVkUmVjb21tZW5kYXRpb24nKSxcblx0XHRcdFx0b3JkZXI6IDFcblx0XHRcdH0sXG5cdFx0XHRydW46IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgaWQ6IHN0cmluZykgPT4gYWNjZXNzb3IuZ2V0KElFeHRlbnNpb25JZ25vcmVkUmVjb21tZW5kYXRpb25zU2VydmljZSkudG9nZ2xlR2xvYmFsSWdub3JlZFJlY29tbWVuZGF0aW9uKGlkLCBmYWxzZSlcblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uYWRkRXh0ZW5zaW9uVG9Xb3Jrc3BhY2VSZWNvbW1lbmRhdGlvbnMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLmFkZEV4dGVuc2lvblRvV29ya3NwYWNlUmVjb21tZW5kYXRpb25zJywgXCJBZGQgdG8gV29ya3NwYWNlIFJlY29tbWVuZGF0aW9uc1wiKSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5FeHRlbnNpb25Db250ZXh0LFxuXHRcdFx0XHRncm91cDogJzNfcmVjb21tZW5kYXRpb25zJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFdvcmtiZW5jaFN0YXRlQ29udGV4dC5ub3RFcXVhbHNUbygnZW1wdHknKSwgQ29udGV4dEtleUV4cHIuaGFzKCdpc0J1aWx0aW5FeHRlbnNpb24nKS5uZWdhdGUoKSwgQ29udGV4dEtleUV4cHIuaGFzKCdpc0V4dGVuc2lvbldvcmtzcGFjZVJlY29tbWVuZGVkJykubmVnYXRlKCksIENvbnRleHRLZXlFeHByLmhhcygnaXNVc2VySWdub3JlZFJlY29tbWVuZGF0aW9uJykubmVnYXRlKCksIENvbnRleHRLZXlFeHByLm5vdEVxdWFscygnZXh0ZW5zaW9uU291cmNlJywgJ3Jlc291cmNlJykpLFxuXHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0fSxcblx0XHRcdHJ1bjogKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBpZDogc3RyaW5nKSA9PiBhY2Nlc3Nvci5nZXQoSVdvcmtzcGFjZUV4dGVuc2lvbnNDb25maWdTZXJ2aWNlKS50b2dnbGVSZWNvbW1lbmRhdGlvbihpZClcblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24ucmVtb3ZlRXh0ZW5zaW9uRnJvbVdvcmtzcGFjZVJlY29tbWVuZGF0aW9ucycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24ucmVtb3ZlRXh0ZW5zaW9uRnJvbVdvcmtzcGFjZVJlY29tbWVuZGF0aW9ucycsIFwiUmVtb3ZlIGZyb20gV29ya3NwYWNlIFJlY29tbWVuZGF0aW9uc1wiKSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5FeHRlbnNpb25Db250ZXh0LFxuXHRcdFx0XHRncm91cDogJzNfcmVjb21tZW5kYXRpb25zJyxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFdvcmtiZW5jaFN0YXRlQ29udGV4dC5ub3RFcXVhbHNUbygnZW1wdHknKSwgQ29udGV4dEtleUV4cHIuaGFzKCdpc0J1aWx0aW5FeHRlbnNpb24nKS5uZWdhdGUoKSwgQ29udGV4dEtleUV4cHIuaGFzKCdpc0V4dGVuc2lvbldvcmtzcGFjZVJlY29tbWVuZGVkJykpLFxuXHRcdFx0XHRvcmRlcjogMlxuXHRcdFx0fSxcblx0XHRcdHJ1bjogKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBpZDogc3RyaW5nKSA9PiBhY2Nlc3Nvci5nZXQoSVdvcmtzcGFjZUV4dGVuc2lvbnNDb25maWdTZXJ2aWNlKS50b2dnbGVSZWNvbW1lbmRhdGlvbihpZClcblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uYWRkVG9Xb3Jrc3BhY2VSZWNvbW1lbmRhdGlvbnMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLmFkZFRvV29ya3NwYWNlUmVjb21tZW5kYXRpb25zJywgXCJBZGQgRXh0ZW5zaW9uIHRvIFdvcmtzcGFjZSBSZWNvbW1lbmRhdGlvbnNcIiksXG5cdFx0XHRjYXRlZ29yeTogRVhURU5TSU9OU19DQVRFR09SWSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFdvcmtiZW5jaFN0YXRlQ29udGV4dC5pc0VxdWFsVG8oJ3dvcmtzcGFjZScpLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3Jlc291cmNlU2NoZW1lJywgU2NoZW1hcy5leHRlbnNpb24pKSxcblx0XHRcdH0sXG5cdFx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPGFueT4ge1xuXHRcdFx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3Qgd29ya3NwYWNlRXh0ZW5zaW9uc0NvbmZpZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtzcGFjZUV4dGVuc2lvbnNDb25maWdTZXJ2aWNlKTtcblx0XHRcdFx0aWYgKCEoZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3IgaW5zdGFuY2VvZiBFeHRlbnNpb25zSW5wdXQpKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbklkID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3IuZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKTtcblx0XHRcdFx0Y29uc3QgcmVjb21tZW5kYXRpb25zID0gYXdhaXQgd29ya3NwYWNlRXh0ZW5zaW9uc0NvbmZpZ1NlcnZpY2UuZ2V0UmVjb21tZW5kYXRpb25zKCk7XG5cdFx0XHRcdGlmIChyZWNvbW1lbmRhdGlvbnMuaW5jbHVkZXMoZXh0ZW5zaW9uSWQpKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGF3YWl0IHdvcmtzcGFjZUV4dGVuc2lvbnNDb25maWdTZXJ2aWNlLnRvZ2dsZVJlY29tbWVuZGF0aW9uKGV4dGVuc2lvbklkKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uYWRkVG9Xb3Jrc3BhY2VGb2xkZXJSZWNvbW1lbmRhdGlvbnMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLmFkZFRvV29ya3NwYWNlRm9sZGVyUmVjb21tZW5kYXRpb25zJywgXCJBZGQgRXh0ZW5zaW9uIHRvIFdvcmtzcGFjZSBGb2xkZXIgUmVjb21tZW5kYXRpb25zXCIpLFxuXHRcdFx0Y2F0ZWdvcnk6IEVYVEVOU0lPTlNfQ0FURUdPUlksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChXb3JrYmVuY2hTdGF0ZUNvbnRleHQuaXNFcXVhbFRvKCdmb2xkZXInKSwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCdyZXNvdXJjZVNjaGVtZScsIFNjaGVtYXMuZXh0ZW5zaW9uKSksXG5cdFx0XHR9LFxuXHRcdFx0cnVuOiAoKSA9PiB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uYWRkVG9Xb3Jrc3BhY2VSZWNvbW1lbmRhdGlvbnMnKVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbkFjdGlvbih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5hZGRUb1dvcmtzcGFjZUlnbm9yZWRSZWNvbW1lbmRhdGlvbnMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLmFkZFRvV29ya3NwYWNlSWdub3JlZFJlY29tbWVuZGF0aW9ucycsIFwiQWRkIEV4dGVuc2lvbiB0byBXb3Jrc3BhY2UgSWdub3JlZCBSZWNvbW1lbmRhdGlvbnNcIiksXG5cdFx0XHRjYXRlZ29yeTogRVhURU5TSU9OU19DQVRFR09SWSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuYW5kKFdvcmtiZW5jaFN0YXRlQ29udGV4dC5pc0VxdWFsVG8oJ3dvcmtzcGFjZScpLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ3Jlc291cmNlU2NoZW1lJywgU2NoZW1hcy5leHRlbnNpb24pKSxcblx0XHRcdH0sXG5cdFx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpOiBQcm9taXNlPGFueT4ge1xuXHRcdFx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3Qgd29ya3NwYWNlRXh0ZW5zaW9uc0NvbmZpZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtzcGFjZUV4dGVuc2lvbnNDb25maWdTZXJ2aWNlKTtcblx0XHRcdFx0aWYgKCEoZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3IgaW5zdGFuY2VvZiBFeHRlbnNpb25zSW5wdXQpKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGV4dGVuc2lvbklkID0gZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3IuZXh0ZW5zaW9uLmlkZW50aWZpZXIuaWQudG9Mb3dlckNhc2UoKTtcblx0XHRcdFx0Y29uc3QgdW53YW50ZWRSZWNvbW1lbmRhdGlvbnMgPSBhd2FpdCB3b3Jrc3BhY2VFeHRlbnNpb25zQ29uZmlnU2VydmljZS5nZXRVbndhbnRlZFJlY29tbWVuZGF0aW9ucygpO1xuXHRcdFx0XHRpZiAodW53YW50ZWRSZWNvbW1lbmRhdGlvbnMuaW5jbHVkZXMoZXh0ZW5zaW9uSWQpKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGF3YWl0IHdvcmtzcGFjZUV4dGVuc2lvbnNDb25maWdTZXJ2aWNlLnRvZ2dsZVVud2FudGVkUmVjb21tZW5kYXRpb24oZXh0ZW5zaW9uSWQpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGhpcy5yZWdpc3RlckV4dGVuc2lvbkFjdGlvbih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5leHRlbnNpb25zLmFjdGlvbi5hZGRUb1dvcmtzcGFjZUZvbGRlcklnbm9yZWRSZWNvbW1lbmRhdGlvbnMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLmFkZFRvV29ya3NwYWNlRm9sZGVySWdub3JlZFJlY29tbWVuZGF0aW9ucycsIFwiQWRkIEV4dGVuc2lvbiB0byBXb3Jrc3BhY2UgRm9sZGVyIElnbm9yZWQgUmVjb21tZW5kYXRpb25zXCIpLFxuXHRcdFx0Y2F0ZWdvcnk6IEVYVEVOU0lPTlNfQ0FURUdPUlksXG5cdFx0XHRtZW51OiB7XG5cdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmFuZChXb3JrYmVuY2hTdGF0ZUNvbnRleHQuaXNFcXVhbFRvKCdmb2xkZXInKSwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCdyZXNvdXJjZVNjaGVtZScsIFNjaGVtYXMuZXh0ZW5zaW9uKSksXG5cdFx0XHR9LFxuXHRcdFx0cnVuOiAoKSA9PiB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uYWRkVG9Xb3Jrc3BhY2VJZ25vcmVkUmVjb21tZW5kYXRpb25zJylcblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6IENvbmZpZ3VyZVdvcmtzcGFjZVJlY29tbWVuZGVkRXh0ZW5zaW9uc0FjdGlvbi5JRCxcblx0XHRcdHRpdGxlOiB7IHZhbHVlOiBDb25maWd1cmVXb3Jrc3BhY2VSZWNvbW1lbmRlZEV4dGVuc2lvbnNBY3Rpb24uTEFCRUwsIG9yaWdpbmFsOiAnQ29uZmlndXJlIFJlY29tbWVuZGVkIEV4dGVuc2lvbnMgKFdvcmtzcGFjZSknIH0sXG5cdFx0XHRjYXRlZ29yeTogRVhURU5TSU9OU19DQVRFR09SWSxcblx0XHRcdG1lbnU6IHtcblx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0d2hlbjogV29ya2JlbmNoU3RhdGVDb250ZXh0LmlzRXF1YWxUbygnd29ya3NwYWNlJyksXG5cdFx0XHR9LFxuXHRcdFx0cnVuOiAoKSA9PiBydW5BY3Rpb24odGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb25maWd1cmVXb3Jrc3BhY2VSZWNvbW1lbmRlZEV4dGVuc2lvbnNBY3Rpb24sIENvbmZpZ3VyZVdvcmtzcGFjZVJlY29tbWVuZGVkRXh0ZW5zaW9uc0FjdGlvbi5JRCwgQ29uZmlndXJlV29ya3NwYWNlUmVjb21tZW5kZWRFeHRlbnNpb25zQWN0aW9uLkxBQkVMKSlcblx0XHR9KTtcblxuXHRcdHRoaXMucmVnaXN0ZXJFeHRlbnNpb25BY3Rpb24oe1xuXHRcdFx0aWQ6ICd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24ubWFuYWdlVHJ1c3RlZFB1Ymxpc2hlcnMnLFxuXHRcdFx0dGl0bGU6IGxvY2FsaXplMignd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLm1hbmFnZVRydXN0ZWRQdWJsaXNoZXJzJywgXCJNYW5hZ2UgVHJ1c3RlZCBFeHRlbnNpb24gUHVibGlzaGVyc1wiKSxcblx0XHRcdGNhdGVnb3J5OiBFWFRFTlNJT05TX0NBVEVHT1JZLFxuXHRcdFx0ZjE6IHRydWUsXG5cdFx0XHRydW46IGFzeW5jIChhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvcikgPT4ge1xuXHRcdFx0XHRjb25zdCBxdWlja0lucHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUXVpY2tJbnB1dFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSA9IGFjY2Vzc29yLmdldChJV29ya2JlbmNoRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCB0cnVzdGVkUHVibGlzaGVycyA9IGV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLmdldFRydXN0ZWRQdWJsaXNoZXJzKCk7XG5cdFx0XHRcdGNvbnN0IHRydXN0ZWRQdWJsaXNoZXJJdGVtcyA9IHRydXN0ZWRQdWJsaXNoZXJzLm1hcChwdWJsaXNoZXIgPT4gKHtcblx0XHRcdFx0XHRpZDogcHVibGlzaGVyLnB1Ymxpc2hlcixcblx0XHRcdFx0XHRsYWJlbDogcHVibGlzaGVyLnB1Ymxpc2hlckRpc3BsYXlOYW1lLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBwdWJsaXNoZXIucHVibGlzaGVyLFxuXHRcdFx0XHRcdHBpY2tlZDogdHJ1ZSxcblx0XHRcdFx0fSkpLnNvcnQoKGEsIGIpID0+IGEubGFiZWwubG9jYWxlQ29tcGFyZShiLmxhYmVsKSk7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHF1aWNrSW5wdXRTZXJ2aWNlLnBpY2sodHJ1c3RlZFB1Ymxpc2hlckl0ZW1zLCB7XG5cdFx0XHRcdFx0Y2FuUGlja01hbnk6IHRydWUsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCd0cnVzdGVkUHVibGlzaGVycycsIFwiTWFuYWdlIFRydXN0ZWQgRXh0ZW5zaW9uIFB1Ymxpc2hlcnNcIiksXG5cdFx0XHRcdFx0cGxhY2VIb2xkZXI6IGxvY2FsaXplKCd0cnVzdGVkUHVibGlzaGVyc1BsYWNlaG9sZGVyJywgXCJDaG9vc2Ugd2hpY2ggcHVibGlzaGVycyB0byB0cnVzdFwiKSxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0XHRjb25zdCB1bnRydXN0ZWRQdWJsaXNoZXJzID0gW107XG5cdFx0XHRcdFx0Zm9yIChjb25zdCB7IHB1Ymxpc2hlciB9IG9mIHRydXN0ZWRQdWJsaXNoZXJzKSB7XG5cdFx0XHRcdFx0XHRpZiAoIXJlc3VsdC5zb21lKHIgPT4gci5pZCA9PT0gcHVibGlzaGVyKSkge1xuXHRcdFx0XHRcdFx0XHR1bnRydXN0ZWRQdWJsaXNoZXJzLnB1c2gocHVibGlzaGVyKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0dHJ1c3RlZFB1Ymxpc2hlcnMuZmlsdGVyKHB1Ymxpc2hlciA9PiAhcmVzdWx0LnNvbWUociA9PiByLmlkID09PSBwdWJsaXNoZXIucHVibGlzaGVyKSk7XG5cdFx0XHRcdFx0ZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UudW50cnVzdFB1Ymxpc2hlcnMoLi4udW50cnVzdGVkUHVibGlzaGVycyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHR9XG5cblx0cHJpdmF0ZSByZWdpc3RlckV4dGVuc2lvbkFjdGlvbihleHRlbnNpb25BY3Rpb25PcHRpb25zOiBJRXh0ZW5zaW9uQWN0aW9uT3B0aW9ucyk6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCBtZW51cyA9IGV4dGVuc2lvbkFjdGlvbk9wdGlvbnMubWVudSA/IEFycmF5LmlzQXJyYXkoZXh0ZW5zaW9uQWN0aW9uT3B0aW9ucy5tZW51KSA/IGV4dGVuc2lvbkFjdGlvbk9wdGlvbnMubWVudSA6IFtleHRlbnNpb25BY3Rpb25PcHRpb25zLm1lbnVdIDogW107XG5cdFx0bGV0IG1lbnVzV2l0aE91dFRpdGxlczogKHsgaWQ6IE1lbnVJZCB9ICYgT21pdDxJTWVudUl0ZW0sICdjb21tYW5kJz4pW10gPSBbXTtcblx0XHRjb25zdCBtZW51c1dpdGhUaXRsZXM6IHsgaWQ6IE1lbnVJZDsgaXRlbTogSU1lbnVJdGVtIH1bXSA9IFtdO1xuXHRcdGlmIChleHRlbnNpb25BY3Rpb25PcHRpb25zLm1lbnVUaXRsZXMpIHtcblx0XHRcdGZvciAobGV0IGluZGV4ID0gMDsgaW5kZXggPCBtZW51cy5sZW5ndGg7IGluZGV4KyspIHtcblx0XHRcdFx0Y29uc3QgbWVudSA9IG1lbnVzW2luZGV4XTtcblx0XHRcdFx0Y29uc3QgbWVudVRpdGxlID0gZXh0ZW5zaW9uQWN0aW9uT3B0aW9ucy5tZW51VGl0bGVzW21lbnUuaWQuaWRdO1xuXHRcdFx0XHRpZiAobWVudVRpdGxlKSB7XG5cdFx0XHRcdFx0bWVudXNXaXRoVGl0bGVzLnB1c2goeyBpZDogbWVudS5pZCwgaXRlbTogeyAuLi5tZW51LCBjb21tYW5kOiB7IGlkOiBleHRlbnNpb25BY3Rpb25PcHRpb25zLmlkLCB0aXRsZTogbWVudVRpdGxlIH0gfSB9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRtZW51c1dpdGhPdXRUaXRsZXMucHVzaChtZW51KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRtZW51c1dpdGhPdXRUaXRsZXMgPSBtZW51cztcblx0XHR9XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHQuLi5leHRlbnNpb25BY3Rpb25PcHRpb25zLFxuXHRcdFx0XHRcdG1lbnU6IG1lbnVzV2l0aE91dFRpdGxlc1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3NvciwgLi4uYXJnczogYW55W10pOiBQcm9taXNlPGFueT4ge1xuXHRcdFx0XHRyZXR1cm4gZXh0ZW5zaW9uQWN0aW9uT3B0aW9ucy5ydW4oYWNjZXNzb3IsIC4uLmFyZ3MpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRpZiAobWVudXNXaXRoVGl0bGVzLmxlbmd0aCkge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKE1lbnVSZWdpc3RyeS5hcHBlbmRNZW51SXRlbXMobWVudXNXaXRoVGl0bGVzKSk7XG5cdFx0fVxuXHRcdHJldHVybiBkaXNwb3NhYmxlcztcblx0fVxuXG59XG5cbmNsYXNzIEV4dGVuc2lvblN0b3JhZ2VDbGVhbmVyIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSBleHRlbnNpb25NYW5hZ2VtZW50U2VydmljZTogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2Ugc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0KSB7XG5cdFx0RXh0ZW5zaW9uU3RvcmFnZVNlcnZpY2UucmVtb3ZlT3V0ZGF0ZWRFeHRlbnNpb25WZXJzaW9ucyhleHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSwgc3RvcmFnZVNlcnZpY2UpO1xuXHR9XG59XG5cbmNsYXNzIFRydXN0ZWRQdWJsaXNoZXJzSW5pdGlhbGl6ZXIgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0QElXb3JrYmVuY2hFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSBleHRlbnNpb25NYW5hZ2VtZW50U2VydmljZTogSVdvcmtiZW5jaEV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLFxuXHRcdEBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgdXNlckRhdGFQcm9maWxlc1NlcnZpY2U6IElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHQpIHtcblx0XHRjb25zdCB0cnVzdGVkUHVibGlzaGVyc0luaXRTdGF0dXNLZXkgPSAndHJ1c3RlZC1wdWJsaXNoZXJzLWluaXQtbWlncmF0aW9uJztcblx0XHRpZiAoIXN0b3JhZ2VTZXJ2aWNlLmdldCh0cnVzdGVkUHVibGlzaGVyc0luaXRTdGF0dXNLZXksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTikpIHtcblx0XHRcdGZvciAoY29uc3QgcHJvZmlsZSBvZiB1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5wcm9maWxlcykge1xuXHRcdFx0XHRleHRlbnNpb25NYW5hZ2VtZW50U2VydmljZS5nZXRJbnN0YWxsZWQoRXh0ZW5zaW9uVHlwZS5Vc2VyLCBwcm9maWxlLmV4dGVuc2lvbnNSZXNvdXJjZSlcblx0XHRcdFx0XHQudGhlbihhc3luYyBleHRlbnNpb25zID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IHRydXN0ZWRQdWJsaXNoZXJzID0gbmV3IE1hcDxzdHJpbmcsIElQdWJsaXNoZXJJbmZvPigpO1xuXHRcdFx0XHRcdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgZXh0ZW5zaW9ucykge1xuXHRcdFx0XHRcdFx0XHRpZiAoIWV4dGVuc2lvbi5wdWJsaXNoZXJEaXNwbGF5TmFtZSkge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGNvbnN0IHB1Ymxpc2hlciA9IGV4dGVuc2lvbi5tYW5pZmVzdC5wdWJsaXNoZXIudG9Mb3dlckNhc2UoKTtcblx0XHRcdFx0XHRcdFx0aWYgKHByb2R1Y3RTZXJ2aWNlLnRydXN0ZWRFeHRlbnNpb25QdWJsaXNoZXJzPy5pbmNsdWRlcyhwdWJsaXNoZXIpXG5cdFx0XHRcdFx0XHRcdFx0fHwgKGV4dGVuc2lvbi5wdWJsaXNoZXJEaXNwbGF5TmFtZSAmJiBwcm9kdWN0U2VydmljZS50cnVzdGVkRXh0ZW5zaW9uUHVibGlzaGVycz8uaW5jbHVkZXMoZXh0ZW5zaW9uLnB1Ymxpc2hlckRpc3BsYXlOYW1lLnRvTG93ZXJDYXNlKCkpKSkge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdHRydXN0ZWRQdWJsaXNoZXJzLnNldChwdWJsaXNoZXIsIHsgcHVibGlzaGVyLCBwdWJsaXNoZXJEaXNwbGF5TmFtZTogZXh0ZW5zaW9uLnB1Ymxpc2hlckRpc3BsYXlOYW1lIH0pO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aWYgKHRydXN0ZWRQdWJsaXNoZXJzLnNpemUpIHtcblx0XHRcdFx0XHRcdFx0ZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UudHJ1c3RQdWJsaXNoZXJzKC4uLnRydXN0ZWRQdWJsaXNoZXJzLnZhbHVlcygpKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHN0b3JhZ2VTZXJ2aWNlLnN0b3JlKHRydXN0ZWRQdWJsaXNoZXJzSW5pdFN0YXR1c0tleSwgJ3RydWUnLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmNvbnN0IHdvcmtiZW5jaFJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpO1xud29ya2JlbmNoUmVnaXN0cnkucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24oRXh0ZW5zaW9uc0NvbnRyaWJ1dGlvbnMsIExpZmVjeWNsZVBoYXNlLlJlc3RvcmVkKTtcbndvcmtiZW5jaFJlZ2lzdHJ5LnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uKFN0YXR1c1VwZGF0ZXIsIExpZmVjeWNsZVBoYXNlLkV2ZW50dWFsbHkpO1xud29ya2JlbmNoUmVnaXN0cnkucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24oTWFsaWNpb3VzRXh0ZW5zaW9uQ2hlY2tlciwgTGlmZWN5Y2xlUGhhc2UuRXZlbnR1YWxseSk7XG53b3JrYmVuY2hSZWdpc3RyeS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihLZXltYXBFeHRlbnNpb25zLCBMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCk7XG53b3JrYmVuY2hSZWdpc3RyeS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihFeHRlbnNpb25zVmlld2xldFZpZXdzQ29udHJpYnV0aW9uLCBMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCk7XG53b3JrYmVuY2hSZWdpc3RyeS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihFeHRlbnNpb25BY3RpdmF0aW9uUHJvZ3Jlc3MsIExpZmVjeWNsZVBoYXNlLkV2ZW50dWFsbHkpO1xud29ya2JlbmNoUmVnaXN0cnkucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24oRXh0ZW5zaW9uRGVwZW5kZW5jeUNoZWNrZXIsIExpZmVjeWNsZVBoYXNlLkV2ZW50dWFsbHkpO1xud29ya2JlbmNoUmVnaXN0cnkucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24oRXh0ZW5zaW9uRW5hYmxlbWVudFdvcmtzcGFjZVRydXN0VHJhbnNpdGlvblBhcnRpY2lwYW50LCBMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCk7XG53b3JrYmVuY2hSZWdpc3RyeS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihFeHRlbnNpb25zQ29tcGxldGlvbkl0ZW1zUHJvdmlkZXIsIExpZmVjeWNsZVBoYXNlLlJlc3RvcmVkKTtcbndvcmtiZW5jaFJlZ2lzdHJ5LnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uKFVuc3VwcG9ydGVkRXh0ZW5zaW9uc01pZ3JhdGlvbkNvbnRyaWIsIExpZmVjeWNsZVBoYXNlLkV2ZW50dWFsbHkpO1xud29ya2JlbmNoUmVnaXN0cnkucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24oVHJ1c3RlZFB1Ymxpc2hlcnNJbml0aWFsaXplciwgTGlmZWN5Y2xlUGhhc2UuRXZlbnR1YWxseSk7XG5pZiAoaXNXZWIpIHtcblx0d29ya2JlbmNoUmVnaXN0cnkucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24oRXh0ZW5zaW9uU3RvcmFnZUNsZWFuZXIsIExpZmVjeWNsZVBoYXNlLkV2ZW50dWFsbHkpO1xufVxuXG5cbi8vIFJ1bm5pbmcgRXh0ZW5zaW9uc1xucmVnaXN0ZXJBY3Rpb24yKFNob3dSdW50aW1lRXh0ZW5zaW9uc0FjdGlvbik7XG5cblJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uTWlncmF0aW9uUmVnaXN0cnk+KENvbmZpZ3VyYXRpb25NaWdyYXRpb25FeHRlbnNpb25zLkNvbmZpZ3VyYXRpb25NaWdyYXRpb24pXG5cdC5yZWdpc3RlckNvbmZpZ3VyYXRpb25NaWdyYXRpb25zKFt7XG5cdFx0a2V5OiBBdXRvVXBkYXRlQ29uZmlndXJhdGlvbktleSxcblx0XHRtaWdyYXRlRm46ICh2YWx1ZSwgYWNjZXNzb3IpID0+IHtcblx0XHRcdGlmICh2YWx1ZSA9PT0gJ29ubHlTZWxlY3RlZEV4dGVuc2lvbnMnKSB7XG5cdFx0XHRcdHJldHVybiB7IHZhbHVlOiBmYWxzZSB9O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblx0fV0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFVBQVUsaUJBQWlCO0FBQ3BDLFNBQVMsUUFBUSxlQUFlO0FBQ2hDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsY0FBYyxRQUFRLGlCQUFpQixlQUEyQztBQUMzRixTQUFTLG1CQUFtQix5QkFBeUI7QUFDckQsU0FBUywwQkFBMEIsNkJBQTZCLDBCQUEwQiwyQkFBMkIsa0NBQWtDLHdCQUF3Qiw4QkFBOEIsNEJBQTRCLFFBQVEsa0JBQWtCO0FBQ25RLFNBQVMsaUJBQWlCLG1DQUFtRCxzQ0FBc0MsNENBQTRDO0FBQy9KLFNBQVMseUNBQXlDLHdDQUF3QztBQUMxRixTQUEwQyxjQUFjLDJCQUFtRDtBQUMzRyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFlBQVksNkJBQTJELG1DQUFtQyx3Q0FBd0MsbUNBQXdFLDRCQUE0Qiw4QkFBOEIsMENBQTBDLGtEQUFzRSxxQkFBcUIsdUJBQXVCLDZCQUE2QixxQkFBcUIsNkJBQTZCLHNCQUFxQyw0QkFBNEIscUJBQXFCLG1DQUFtQztBQUNqb0IsU0FBUyx5Q0FBeUMsK0NBQStDLHFEQUFxRCxxQkFBcUIsd0JBQXdCLDJCQUEyQixxQkFBcUIsb0NBQW9DLHFDQUFxQyxpQ0FBaUMsNkJBQTZCLHFCQUFxQjtBQUMvWSxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGVBQWUsMkJB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
