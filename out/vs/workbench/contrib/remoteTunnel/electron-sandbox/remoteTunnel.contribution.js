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
import { Action } from "../../../../base/common/actions.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { joinPath } from "../../../../base/common/resources.js";
import { isNumber, isObject, isString } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { localize, localize2 } from "../../../../nls.js";
import { Action2, MenuId, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { IClipboardService } from "../../../../platform/clipboard/common/clipboardService.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope } from "../../../../platform/configuration/common/configurationRegistry.js";
import { ContextKeyExpr, IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { INativeEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { ILoggerService } from "../../../../platform/log/common/log.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { CONFIGURATION_KEY_HOST_NAME, CONFIGURATION_KEY_PREFIX, CONFIGURATION_KEY_PREVENT_SLEEP, INACTIVE_TUNNEL_MODE, IRemoteTunnelService, LOGGER_NAME, LOG_ID } from "../../../../platform/remoteTunnel/common/remoteTunnel.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IWorkspaceContextService, isUntitledWorkspace } from "../../../../platform/workspace/common/workspace.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { IAuthenticationService } from "../../../services/authentication/common/authentication.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { IOutputService } from "../../../services/output/common/output.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
const REMOTE_TUNNEL_CATEGORY = localize2("remoteTunnel.category", "Remote Tunnels");
const REMOTE_TUNNEL_CONNECTION_STATE_KEY = "remoteTunnelConnection";
const REMOTE_TUNNEL_CONNECTION_STATE = new RawContextKey(REMOTE_TUNNEL_CONNECTION_STATE_KEY, "disconnected");
const REMOTE_TUNNEL_USED_STORAGE_KEY = "remoteTunnelServiceUsed";
const REMOTE_TUNNEL_PROMPTED_PREVIEW_STORAGE_KEY = "remoteTunnelServicePromptedPreview";
const REMOTE_TUNNEL_EXTENSION_RECOMMENDED_KEY = "remoteTunnelExtensionRecommended";
const REMOTE_TUNNEL_HAS_USED_BEFORE = "remoteTunnelHasUsed";
const REMOTE_TUNNEL_EXTENSION_TIMEOUT = 4 * 60 * 1e3;
const INVALID_TOKEN_RETRIES = 2;
var RemoteTunnelCommandIds = /* @__PURE__ */ ((RemoteTunnelCommandIds2) => {
  RemoteTunnelCommandIds2["turnOn"] = "workbench.remoteTunnel.actions.turnOn";
  RemoteTunnelCommandIds2["turnOff"] = "workbench.remoteTunnel.actions.turnOff";
  RemoteTunnelCommandIds2["connecting"] = "workbench.remoteTunnel.actions.connecting";
  RemoteTunnelCommandIds2["manage"] = "workbench.remoteTunnel.actions.manage";
  RemoteTunnelCommandIds2["showLog"] = "workbench.remoteTunnel.actions.showLog";
  RemoteTunnelCommandIds2["configure"] = "workbench.remoteTunnel.actions.configure";
  RemoteTunnelCommandIds2["copyToClipboard"] = "workbench.remoteTunnel.actions.copyToClipboard";
  RemoteTunnelCommandIds2["learnMore"] = "workbench.remoteTunnel.actions.learnMore";
  return RemoteTunnelCommandIds2;
})(RemoteTunnelCommandIds || {});
var RemoteTunnelCommandLabels;
((RemoteTunnelCommandLabels2) => {
  RemoteTunnelCommandLabels2.turnOn = localize("remoteTunnel.actions.turnOn", "Turn on Remote Tunnel Access...");
  RemoteTunnelCommandLabels2.turnOff = localize("remoteTunnel.actions.turnOff", "Turn off Remote Tunnel Access...");
  RemoteTunnelCommandLabels2.showLog = localize("remoteTunnel.actions.showLog", "Show Remote Tunnel Service Log");
  RemoteTunnelCommandLabels2.configure = localize("remoteTunnel.actions.configure", "Configure Tunnel Name...");
  RemoteTunnelCommandLabels2.copyToClipboard = localize("remoteTunnel.actions.copyToClipboard", "Copy Browser URI to Clipboard");
  RemoteTunnelCommandLabels2.learnMore = localize("remoteTunnel.actions.learnMore", "Get Started with Tunnels");
})(RemoteTunnelCommandLabels || (RemoteTunnelCommandLabels = {}));
let RemoteTunnelWorkbenchContribution = class extends Disposable {
  constructor(authenticationService, dialogService, extensionService, contextKeyService, productService, storageService, loggerService, quickInputService, environmentService, remoteTunnelService, commandService, workspaceContextService, progressService, notificationService) {
    super();
    this.authenticationService = authenticationService;
    this.dialogService = dialogService;
    this.extensionService = extensionService;
    this.contextKeyService = contextKeyService;
    this.storageService = storageService;
    this.quickInputService = quickInputService;
    this.environmentService = environmentService;
    this.remoteTunnelService = remoteTunnelService;
    this.commandService = commandService;
    this.workspaceContextService = workspaceContextService;
    this.progressService = progressService;
    this.notificationService = notificationService;
    this.expiredSessions = /* @__PURE__ */ new Set();
    this.logger = this._register(loggerService.createLogger(joinPath(environmentService.logsHome, `${LOG_ID}.log`), { id: LOG_ID, name: LOGGER_NAME }));
    this.connectionStateContext = REMOTE_TUNNEL_CONNECTION_STATE.bindTo(this.contextKeyService);
    const serverConfiguration = productService.tunnelApplicationConfig;
    if (!serverConfiguration || !productService.tunnelApplicationName) {
      this.logger.error("Missing 'tunnelApplicationConfig' or 'tunnelApplicationName' in product.json. Remote tunneling is not available.");
      this.serverConfiguration = { authenticationProviders: {}, editorWebUrl: "", extension: { extensionId: "", friendlyName: "" } };
      return;
    }
    this.serverConfiguration = serverConfiguration;
    this._register(this.remoteTunnelService.onDidChangeTunnelStatus((s) => this.handleTunnelStatusUpdate(s)));
    this.registerCommands();
    this.initialize();
    this.recommendRemoteExtensionIfNeeded();
  }
  handleTunnelStatusUpdate(status) {
    this.connectionInfo = void 0;
    if (status.type === "disconnected") {
      if (status.onTokenFailed) {
        this.expiredSessions.add(status.onTokenFailed.sessionId);
      }
      this.connectionStateContext.set("disconnected");
    } else if (status.type === "connecting") {
      this.connectionStateContext.set("connecting");
    } else if (status.type === "connected") {
      this.connectionInfo = status.info;
      this.connectionStateContext.set("connected");
    }
  }
  async recommendRemoteExtensionIfNeeded() {
    await this.extensionService.whenInstalledExtensionsRegistered();
    const remoteExtension = this.serverConfiguration.extension;
    const shouldRecommend = async () => {
      if (this.storageService.getBoolean(REMOTE_TUNNEL_EXTENSION_RECOMMENDED_KEY, StorageScope.APPLICATION)) {
        return false;
      }
      if (await this.extensionService.getExtension(remoteExtension.extensionId)) {
        return false;
      }
      const usedOnHostMessage = this.storageService.get(REMOTE_TUNNEL_USED_STORAGE_KEY, StorageScope.APPLICATION);
      if (!usedOnHostMessage) {
        return false;
      }
      let usedTunnelName;
      try {
        const message = JSON.parse(usedOnHostMessage);
        if (!isObject(message)) {
          return false;
        }
        const { hostName, timeStamp } = message;
        if (!isString(hostName) || !isNumber(timeStamp) || (/* @__PURE__ */ new Date()).getTime() > timeStamp + REMOTE_TUNNEL_EXTENSION_TIMEOUT) {
          return false;
        }
        usedTunnelName = hostName;
      } catch (_) {
        return false;
      }
      const currentTunnelName = await this.remoteTunnelService.getTunnelName();
      if (!currentTunnelName || currentTunnelName === usedTunnelName) {
        return false;
      }
      return usedTunnelName;
    };
    const recommed = async () => {
      const usedOnHost = await shouldRecommend();
      if (!usedOnHost) {
        return false;
      }
      this.notificationService.notify({
        severity: Severity.Info,
        message: localize(
          {
            key: "recommend.remoteExtension",
            comment: ["{0} will be a tunnel name, {1} will the link address to the web UI, {6} an extension name. [label](command:commandId) is a markdown link. Only translate the label, do not modify the format"]
          },
          "Tunnel '{0}' is avaiable for remote access. The {1} extension can be used to connect to it.",
          usedOnHost,
          remoteExtension.friendlyName
        ),
        actions: {
          primary: [
            new Action("showExtension", localize("action.showExtension", "Show Extension"), void 0, true, () => {
              return this.commandService.executeCommand("workbench.extensions.action.showExtensionsWithIds", [remoteExtension.extensionId]);
            }),
            new Action("doNotShowAgain", localize("action.doNotShowAgain", "Do not show again"), void 0, true, () => {
              this.storageService.store(REMOTE_TUNNEL_EXTENSION_RECOMMENDED_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
            })
          ]
        }
      });
      return true;
    };
    if (await shouldRecommend()) {
      const disposables = this._register(new DisposableStore());
      disposables.add(this.storageService.onDidChangeValue(StorageScope.APPLICATION, REMOTE_TUNNEL_USED_STORAGE_KEY, disposables)(async () => {
        const success = await recommed();
        if (success) {
          disposables.dispose();
        }
      }));
    }
  }
  async initialize() {
    const [mode, status] = await Promise.all([
      this.remoteTunnelService.getMode(),
      this.remoteTunnelService.getTunnelStatus()
    ]);
    this.handleTunnelStatusUpdate(status);
    if (mode.active && mode.session.token) {
      return;
    }
    const doInitialStateDiscovery = async (progress) => {
      const listener = progress && this.remoteTunnelService.onDidChangeTunnelStatus((status3) => {
        switch (status3.type) {
          case "connecting":
            if (status3.progress) {
              progress.report({ message: status3.progress });
            }
            break;
        }
      });
      let newSession;
      if (mode.active) {
        const token = await this.getSessionToken(mode.session);
        if (token) {
          newSession = { ...mode.session, token };
        }
      }
      const status2 = await this.remoteTunnelService.initialize(mode.active && newSession ? { ...mode, session: newSession } : INACTIVE_TUNNEL_MODE);
      listener?.dispose();
      if (status2.type === "connected") {
        this.connectionInfo = status2.info;
        this.connectionStateContext.set("connected");
        return;
      }
    };
    const hasUsed = this.storageService.getBoolean(REMOTE_TUNNEL_HAS_USED_BEFORE, StorageScope.APPLICATION, false);
    if (hasUsed) {
      await this.progressService.withProgress(
        {
          location: ProgressLocation.Window,
          title: localize({ key: "initialize.progress.title", comment: ["Only translate 'Looking for remote tunnel', do not change the format of the rest (markdown link format)"] }, "[Looking for remote tunnel](command:{0})", "workbench.remoteTunnel.actions.showLog" /* showLog */)
        },
        doInitialStateDiscovery
      );
    } else {
      doInitialStateDiscovery(void 0);
    }
  }
  getPreferredTokenFromSession(session) {
    return session.session.accessToken || session.session.idToken;
  }
  async startTunnel(asService) {
    if (this.connectionInfo) {
      return this.connectionInfo;
    }
    this.storageService.store(REMOTE_TUNNEL_HAS_USED_BEFORE, true, StorageScope.APPLICATION, StorageTarget.MACHINE);
    let tokenProblems = false;
    for (let i = 0; i < INVALID_TOKEN_RETRIES; i++) {
      tokenProblems = false;
      const authenticationSession = await this.getAuthenticationSession();
      if (authenticationSession === void 0) {
        this.logger.info("No authentication session available, not starting tunnel");
        return void 0;
      }
      const result = await this.progressService.withProgress(
        {
          location: ProgressLocation.Notification,
          title: localize({ key: "startTunnel.progress.title", comment: ["Only translate 'Starting remote tunnel', do not change the format of the rest (markdown link format)"] }, "[Starting remote tunnel](command:{0})", "workbench.remoteTunnel.actions.showLog" /* showLog */)
        },
        (progress) => {
          return new Promise((s, e) => {
            let completed = false;
            const listener = this.remoteTunnelService.onDidChangeTunnelStatus((status) => {
              switch (status.type) {
                case "connecting":
                  if (status.progress) {
                    progress.report({ message: status.progress });
                  }
                  break;
                case "connected":
                  listener.dispose();
                  completed = true;
                  s(status.info);
                  if (status.serviceInstallFailed) {
                    this.notificationService.notify({
                      severity: Severity.Warning,
                      message: localize(
                        {
                          key: "remoteTunnel.serviceInstallFailed",
                          comment: ['{Locked="](command:{0})"}']
                        },
                        "Installation as a service failed, and we fell back to running the tunnel for this session. See the [error log](command:{0}) for details.",
                        "workbench.remoteTunnel.actions.showLog" /* showLog */
                      )
                    });
                  }
                  break;
                case "disconnected":
                  listener.dispose();
                  completed = true;
                  tokenProblems = !!status.onTokenFailed;
                  s(void 0);
                  break;
              }
            });
            const token = this.getPreferredTokenFromSession(authenticationSession);
            const account = { sessionId: authenticationSession.session.id, token, providerId: authenticationSession.providerId, accountLabel: authenticationSession.session.account.label };
            this.remoteTunnelService.startTunnel({ active: true, asService, session: account }).then((status) => {
              if (!completed && (status.type === "connected" || status.type === "disconnected")) {
                listener.dispose();
                if (status.type === "connected") {
                  s(status.info);
                } else {
                  tokenProblems = !!status.onTokenFailed;
                  s(void 0);
                }
              }
            });
          });
        }
      );
      if (result || !tokenProblems) {
        return result;
      }
    }
    return void 0;
  }
  async getAuthenticationSession() {
    const sessions = await this.getAllSessions();
    const disposables = new DisposableStore();
    const quickpick = disposables.add(this.quickInputService.createQuickPick({ useSeparators: true }));
    quickpick.ok = false;
    quickpick.placeholder = localize("accountPreference.placeholder", "Sign in to an account to enable remote access");
    quickpick.ignoreFocusOut = true;
    quickpick.items = await this.createQuickpickItems(sessions);
    return new Promise((resolve, reject) => {
      disposables.add(quickpick.onDidHide((e) => {
        resolve(void 0);
        disposables.dispose();
      }));
      disposables.add(quickpick.onDidAccept(async (e) => {
        const selection = quickpick.selectedItems[0];
        if ("provider" in selection) {
          const session = await this.authenticationService.createSession(selection.provider.id, selection.provider.scopes);
          resolve(this.createExistingSessionItem(session, selection.provider.id));
        } else if ("session" in selection) {
          resolve(selection);
        } else {
          resolve(void 0);
        }
        quickpick.hide();
      }));
      quickpick.show();
    });
  }
  createExistingSessionItem(session, providerId) {
    return {
      label: session.account.label,
      description: this.authenticationService.getProvider(providerId).label,
      session,
      providerId
    };
  }
  async createQuickpickItems(sessions) {
    const options = [];
    if (sessions.length) {
      options.push({ type: "separator", label: localize("signed in", "Signed In") });
      options.push(...sessions);
      options.push({ type: "separator", label: localize("others", "Others") });
    }
    for (const authenticationProvider of await this.getAuthenticationProviders()) {
      const signedInForProvider = sessions.some((account) => account.providerId === authenticationProvider.id);
      const provider = this.authenticationService.getProvider(authenticationProvider.id);
      if (!signedInForProvider || provider.supportsMultipleAccounts) {
        options.push({ label: localize({ key: "sign in using account", comment: ["{0} will be a auth provider (e.g. Github)"] }, "Sign in with {0}", provider.label), provider: authenticationProvider });
      }
    }
    return options;
  }
  /**
   * Returns all authentication sessions available from {@link getAuthenticationProviders}.
   */
  async getAllSessions() {
    const authenticationProviders = await this.getAuthenticationProviders();
    const accounts = /* @__PURE__ */ new Map();
    const currentAccount = await this.remoteTunnelService.getMode();
    let currentSession;
    for (const provider of authenticationProviders) {
      const sessions = await this.authenticationService.getSessions(provider.id, provider.scopes);
      for (const session of sessions) {
        if (!this.expiredSessions.has(session.id)) {
          const item = this.createExistingSessionItem(session, provider.id);
          accounts.set(item.session.account.id, item);
          if (currentAccount.active && currentAccount.session.sessionId === session.id) {
            currentSession = item;
          }
        }
      }
    }
    if (currentSession !== void 0) {
      accounts.set(currentSession.session.account.id, currentSession);
    }
    return [...accounts.values()];
  }
  async getSessionToken(session) {
    if (session) {
      const sessionItem = (await this.getAllSessions()).find((s) => s.session.id === session.sessionId);
      if (sessionItem) {
        return this.getPreferredTokenFromSession(sessionItem);
      }
    }
    return void 0;
  }
  /**
   * Returns all authentication providers which can be used to authenticate
   * to the remote storage service, based on product.json configuration
   * and registered authentication providers.
   */
  async getAuthenticationProviders() {
    const authenticationProviders = this.serverConfiguration.authenticationProviders;
    const configuredAuthenticationProviders = Object.keys(authenticationProviders).reduce((result, id) => {
      result.push({ id, scopes: authenticationProviders[id].scopes });
      return result;
    }, []);
    const availableAuthenticationProviders = this.authenticationService.declaredProviders;
    return configuredAuthenticationProviders.filter(({ id }) => availableAuthenticationProviders.some((provider) => provider.id === id));
  }
  registerCommands() {
    const that = this;
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.remoteTunnel.actions.turnOn" /* turnOn */,
          title: RemoteTunnelCommandLabels.turnOn,
          category: REMOTE_TUNNEL_CATEGORY,
          precondition: ContextKeyExpr.equals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, "disconnected"),
          menu: [
            {
              id: MenuId.CommandPalette
            },
            {
              id: MenuId.AccountsContext,
              group: "2_remoteTunnel",
              when: ContextKeyExpr.equals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, "disconnected")
            }
          ]
        });
      }
      async run(accessor) {
        const notificationService = accessor.get(INotificationService);
        const clipboardService = accessor.get(IClipboardService);
        const commandService = accessor.get(ICommandService);
        const storageService = accessor.get(IStorageService);
        const dialogService = accessor.get(IDialogService);
        const quickInputService = accessor.get(IQuickInputService);
        const productService = accessor.get(IProductService);
        const didNotifyPreview = storageService.getBoolean(REMOTE_TUNNEL_PROMPTED_PREVIEW_STORAGE_KEY, StorageScope.APPLICATION, false);
        if (!didNotifyPreview) {
          const { confirmed } = await dialogService.confirm({
            message: localize("tunnel.preview", 'Remote Tunnels is currently in preview. Please report any problems using the "Help: Report Issue" command.'),
            primaryButton: localize({ key: "enable", comment: ["&& denotes a mnemonic"] }, "&&Enable")
          });
          if (!confirmed) {
            return;
          }
          storageService.store(REMOTE_TUNNEL_PROMPTED_PREVIEW_STORAGE_KEY, true, StorageScope.APPLICATION, StorageTarget.USER);
        }
        const disposables = new DisposableStore();
        const quickPick = quickInputService.createQuickPick();
        quickPick.placeholder = localize("tunnel.enable.placeholder", "Select how you want to enable access");
        quickPick.items = [
          { service: false, label: localize("tunnel.enable.session", "Turn on for this session"), description: localize("tunnel.enable.session.description", "Run whenever {0} is open", productService.nameShort) },
          { service: true, label: localize("tunnel.enable.service", "Install as a service"), description: localize("tunnel.enable.service.description", "Run whenever you're logged in") }
        ];
        const asService = await new Promise((resolve) => {
          disposables.add(quickPick.onDidAccept(() => resolve(quickPick.selectedItems[0]?.service)));
          disposables.add(quickPick.onDidHide(() => resolve(void 0)));
          quickPick.show();
        });
        quickPick.dispose();
        if (asService === void 0) {
          return;
        }
        const connectionInfo = await that.startTunnel(
          /* installAsService= */
          asService
        );
        if (connectionInfo) {
          const linkToOpen = that.getLinkToOpen(connectionInfo);
          const remoteExtension = that.serverConfiguration.extension;
          const linkToOpenForMarkdown = linkToOpen.toString(false).replace(/\)/g, "%29");
          notificationService.notify({
            severity: Severity.Info,
            message: localize(
              {
                key: "progress.turnOn.final",
                comment: ["{0} will be the tunnel name, {1} will the link address to the web UI, {6} an extension name, {7} a link to the extension documentation. [label](command:commandId) is a markdown link. Only translate the label, do not modify the format"]
              },
              "You can now access this machine anywhere via the secure tunnel [{0}](command:{4}). To connect via a different machine, use the generated [{1}]({2}) link or use the [{6}]({7}) extension in the desktop or web. You can [configure](command:{3}) or [turn off](command:{5}) this access via the VS Code Accounts menu.",
              connectionInfo.tunnelName,
              connectionInfo.domain,
              linkToOpenForMarkdown,
              "workbench.remoteTunnel.actions.manage" /* manage */,
              "workbench.remoteTunnel.actions.configure" /* configure */,
              "workbench.remoteTunnel.actions.turnOff" /* turnOff */,
              remoteExtension.friendlyName,
              "https://code.visualstudio.com/docs/remote/tunnels"
            ),
            actions: {
              primary: [
                new Action("copyToClipboard", localize("action.copyToClipboard", "Copy Browser Link to Clipboard"), void 0, true, () => clipboardService.writeText(linkToOpen.toString(true))),
                new Action("showExtension", localize("action.showExtension", "Show Extension"), void 0, true, () => {
                  return commandService.executeCommand("workbench.extensions.action.showExtensionsWithIds", [remoteExtension.extensionId]);
                })
              ]
            }
          });
          const usedOnHostMessage = { hostName: connectionInfo.tunnelName, timeStamp: (/* @__PURE__ */ new Date()).getTime() };
          storageService.store(REMOTE_TUNNEL_USED_STORAGE_KEY, JSON.stringify(usedOnHostMessage), StorageScope.APPLICATION, StorageTarget.USER);
        } else {
          notificationService.notify({
            severity: Severity.Info,
            message: localize(
              "progress.turnOn.failed",
              "Unable to turn on the remote tunnel access. Check the Remote Tunnel Service log for details."
            )
          });
          await commandService.executeCommand("workbench.remoteTunnel.actions.showLog" /* showLog */);
        }
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.remoteTunnel.actions.manage" /* manage */,
          title: localize("remoteTunnel.actions.manage.on.v2", "Remote Tunnel Access is On"),
          category: REMOTE_TUNNEL_CATEGORY,
          menu: [{
            id: MenuId.AccountsContext,
            group: "2_remoteTunnel",
            when: ContextKeyExpr.equals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, "connected")
          }]
        });
      }
      async run() {
        that.showManageOptions();
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.remoteTunnel.actions.connecting" /* connecting */,
          title: localize("remoteTunnel.actions.manage.connecting", "Remote Tunnel Access is Connecting"),
          category: REMOTE_TUNNEL_CATEGORY,
          menu: [{
            id: MenuId.AccountsContext,
            group: "2_remoteTunnel",
            when: ContextKeyExpr.equals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, "connecting")
          }]
        });
      }
      async run() {
        that.showManageOptions();
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.remoteTunnel.actions.turnOff" /* turnOff */,
          title: RemoteTunnelCommandLabels.turnOff,
          category: REMOTE_TUNNEL_CATEGORY,
          precondition: ContextKeyExpr.notEquals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, "disconnected"),
          menu: [{
            id: MenuId.CommandPalette,
            when: ContextKeyExpr.notEquals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, "")
          }]
        });
      }
      async run() {
        const message = that.connectionInfo?.isAttached ? localize("remoteTunnel.turnOffAttached.confirm", "Do you want to turn off Remote Tunnel Access? This will also stop the service that was started externally.") : localize("remoteTunnel.turnOff.confirm", "Do you want to turn off Remote Tunnel Access?");
        const { confirmed } = await that.dialogService.confirm({ message });
        if (confirmed) {
          that.remoteTunnelService.stopTunnel();
        }
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.remoteTunnel.actions.showLog" /* showLog */,
          title: RemoteTunnelCommandLabels.showLog,
          category: REMOTE_TUNNEL_CATEGORY,
          menu: [{
            id: MenuId.CommandPalette,
            when: ContextKeyExpr.notEquals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, "")
          }]
        });
      }
      async run(accessor) {
        const outputService = accessor.get(IOutputService);
        outputService.showChannel(LOG_ID);
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.remoteTunnel.actions.configure" /* configure */,
          title: RemoteTunnelCommandLabels.configure,
          category: REMOTE_TUNNEL_CATEGORY,
          menu: [{
            id: MenuId.CommandPalette,
            when: ContextKeyExpr.notEquals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, "")
          }]
        });
      }
      async run(accessor) {
        const preferencesService = accessor.get(IPreferencesService);
        preferencesService.openSettings({ query: CONFIGURATION_KEY_PREFIX });
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.remoteTunnel.actions.copyToClipboard" /* copyToClipboard */,
          title: RemoteTunnelCommandLabels.copyToClipboard,
          category: REMOTE_TUNNEL_CATEGORY,
          precondition: ContextKeyExpr.equals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, "connected"),
          menu: [{
            id: MenuId.CommandPalette,
            when: ContextKeyExpr.equals(REMOTE_TUNNEL_CONNECTION_STATE_KEY, "connected")
          }]
        });
      }
      async run(accessor) {
        const clipboardService = accessor.get(IClipboardService);
        if (that.connectionInfo) {
          const linkToOpen = that.getLinkToOpen(that.connectionInfo);
          clipboardService.writeText(linkToOpen.toString(true));
        }
      }
    }));
    this._register(registerAction2(class extends Action2 {
      constructor() {
        super({
          id: "workbench.remoteTunnel.actions.learnMore" /* learnMore */,
          title: RemoteTunnelCommandLabels.learnMore,
          category: REMOTE_TUNNEL_CATEGORY,
          menu: []
        });
      }
      async run(accessor) {
        const openerService = accessor.get(IOpenerService);
        await openerService.open("https://aka.ms/vscode-server-doc");
      }
    }));
  }
  getLinkToOpen(connectionInfo) {
    const workspace = this.workspaceContextService.getWorkspace();
    const folders = workspace.folders;
    let resource;
    if (folders.length === 1) {
      resource = folders[0].uri;
    } else if (workspace.configuration && !isUntitledWorkspace(workspace.configuration, this.environmentService)) {
      resource = workspace.configuration;
    }
    const link = URI.parse(connectionInfo.link);
    if (resource?.scheme === Schemas.file) {
      return joinPath(link, resource.path);
    }
    return joinPath(link, this.environmentService.userHome.path);
  }
  async showManageOptions() {
    const account = await this.remoteTunnelService.getMode();
    return new Promise((c, e) => {
      const disposables = new DisposableStore();
      const quickPick = this.quickInputService.createQuickPick({ useSeparators: true });
      quickPick.placeholder = localize("manage.placeholder", "Select a command to invoke");
      disposables.add(quickPick);
      const items = [];
      items.push({ id: "workbench.remoteTunnel.actions.learnMore" /* learnMore */, label: RemoteTunnelCommandLabels.learnMore });
      if (this.connectionInfo) {
        quickPick.title = this.connectionInfo.isAttached ? localize({ key: "manage.title.attached", comment: ["{0} is the tunnel name"] }, "Remote Tunnel Access enabled for {0} (launched externally)", this.connectionInfo.tunnelName) : localize({ key: "manage.title.orunning", comment: ["{0} is the tunnel name"] }, "Remote Tunnel Access enabled for {0}", this.connectionInfo.tunnelName);
        items.push({ id: "workbench.remoteTunnel.actions.copyToClipboard" /* copyToClipboard */, label: RemoteTunnelCommandLabels.copyToClipboard, description: this.connectionInfo.domain });
      } else {
        quickPick.title = localize("manage.title.off", "Remote Tunnel Access not enabled");
      }
      items.push({ id: "workbench.remoteTunnel.actions.showLog" /* showLog */, label: localize("manage.showLog", "Show Log") });
      items.push({ type: "separator" });
      items.push({ id: "workbench.remoteTunnel.actions.configure" /* configure */, label: localize("manage.tunnelName", "Change Tunnel Name"), description: this.connectionInfo?.tunnelName });
      items.push({ id: "workbench.remoteTunnel.actions.turnOff" /* turnOff */, label: RemoteTunnelCommandLabels.turnOff, description: account.active ? `${account.session.accountLabel} (${account.session.providerId})` : void 0 });
      quickPick.items = items;
      disposables.add(quickPick.onDidAccept(() => {
        if (quickPick.selectedItems[0] && quickPick.selectedItems[0].id) {
          this.commandService.executeCommand(quickPick.selectedItems[0].id);
        }
        quickPick.hide();
      }));
      disposables.add(quickPick.onDidHide(() => {
        disposables.dispose();
        c();
      }));
      quickPick.show();
    });
  }
};
RemoteTunnelWorkbenchContribution = __decorateClass([
  __decorateParam(0, IAuthenticationService),
  __decorateParam(1, IDialogService),
  __decorateParam(2, IExtensionService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, IProductService),
  __decorateParam(5, IStorageService),
  __decorateParam(6, ILoggerService),
  __decorateParam(7, IQuickInputService),
  __decorateParam(8, INativeEnvironmentService),
  __decorateParam(9, IRemoteTunnelService),
  __decorateParam(10, ICommandService),
  __decorateParam(11, IWorkspaceContextService),
  __decorateParam(12, IProgressService),
  __decorateParam(13, INotificationService)
], RemoteTunnelWorkbenchContribution);
const workbenchRegistry = Registry.as(WorkbenchExtensions.Workbench);
workbenchRegistry.registerWorkbenchContribution(RemoteTunnelWorkbenchContribution, LifecyclePhase.Restored);
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  type: "object",
  properties: {
    [CONFIGURATION_KEY_HOST_NAME]: {
      description: localize("remoteTunnelAccess.machineName", "The name under which the remote tunnel access is registered. If not set, the host name is used."),
      type: "string",
      scope: ConfigurationScope.APPLICATION,
      ignoreSync: true,
      pattern: "^(\\w[\\w-]*)?$",
      patternErrorMessage: localize("remoteTunnelAccess.machineNameRegex", "The name must only consist of letters, numbers, underscore and dash. It must not start with a dash."),
      maxLength: 20,
      default: ""
    },
    [CONFIGURATION_KEY_PREVENT_SLEEP]: {
      description: localize("remoteTunnelAccess.preventSleep", "Prevent this computer from sleeping when remote tunnel access is turned on."),
      type: "boolean",
      scope: ConfigurationScope.APPLICATION,
      default: false
    }
  }
});
export {
  REMOTE_TUNNEL_CATEGORY,
  REMOTE_TUNNEL_CONNECTION_STATE,
  REMOTE_TUNNEL_CONNECTION_STATE_KEY,
  RemoteTunnelWorkbenchContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9yZW1vdGVUdW5uZWwvZWxlY3Ryb24tc2FuZGJveC9yZW1vdGVUdW5uZWwuY29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgSVR1bm5lbEFwcGxpY2F0aW9uQ29uZmlnIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcHJvZHVjdC5qcyc7XG5pbXBvcnQgeyBqb2luUGF0aCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBpc051bWJlciwgaXNPYmplY3QsIGlzU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGxvY2FsaXplLCBsb2NhbGl6ZTIgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQWN0aW9uMiwgTWVudUlkLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL2NvbW1vbi9jbGlwYm9hcmRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zIGFzIENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLCBDb25maWd1cmF0aW9uU2NvcGUsIElDb25maWd1cmF0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIsIElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJTmF0aXZlRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IFNlcnZpY2VzQWNjZXNzb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dnZXIsIElMb2dnZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UsIFNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUHJvZ3Jlc3MsIElQcm9ncmVzc1NlcnZpY2UsIElQcm9ncmVzc1N0ZXAsIFByb2dyZXNzTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrSXRlbSwgSVF1aWNrUGlja1NlcGFyYXRvciwgUXVpY2tQaWNrSXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgQ09ORklHVVJBVElPTl9LRVlfSE9TVF9OQU1FLCBDT05GSUdVUkFUSU9OX0tFWV9QUkVGSVgsIENPTkZJR1VSQVRJT05fS0VZX1BSRVZFTlRfU0xFRVAsIENvbm5lY3Rpb25JbmZvLCBJTkFDVElWRV9UVU5ORUxfTU9ERSwgSVJlbW90ZVR1bm5lbFNlcnZpY2UsIElSZW1vdGVUdW5uZWxTZXNzaW9uLCBMT0dHRVJfTkFNRSwgTE9HX0lELCBUdW5uZWxTdGF0dXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGVUdW5uZWwvY29tbW9uL3JlbW90ZVR1bm5lbC5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBpc1VudGl0bGVkV29ya3NwYWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiwgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeSwgRXh0ZW5zaW9ucyBhcyBXb3JrYmVuY2hFeHRlbnNpb25zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvbnRyaWJ1dGlvbnMuanMnO1xuaW1wb3J0IHsgQXV0aGVudGljYXRpb25TZXNzaW9uLCBJQXV0aGVudGljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvYXV0aGVudGljYXRpb24vY29tbW9uL2F1dGhlbnRpY2F0aW9uLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBMaWZlY3ljbGVQaGFzZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElPdXRwdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvb3V0cHV0L2NvbW1vbi9vdXRwdXQuanMnO1xuaW1wb3J0IHsgSVByZWZlcmVuY2VzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3ByZWZlcmVuY2VzL2NvbW1vbi9wcmVmZXJlbmNlcy5qcyc7XG5cbmV4cG9ydCBjb25zdCBSRU1PVEVfVFVOTkVMX0NBVEVHT1JZID0gbG9jYWxpemUyKCdyZW1vdGVUdW5uZWwuY2F0ZWdvcnknLCAnUmVtb3RlIFR1bm5lbHMnKTtcblxudHlwZSBDT05URVhUX0tFWV9TVEFURVMgPSAnY29ubmVjdGVkJyB8ICdjb25uZWN0aW5nJyB8ICdkaXNjb25uZWN0ZWQnO1xuXG5leHBvcnQgY29uc3QgUkVNT1RFX1RVTk5FTF9DT05ORUNUSU9OX1NUQVRFX0tFWSA9ICdyZW1vdGVUdW5uZWxDb25uZWN0aW9uJztcbmV4cG9ydCBjb25zdCBSRU1PVEVfVFVOTkVMX0NPTk5FQ1RJT05fU1RBVEUgPSBuZXcgUmF3Q29udGV4dEtleTxDT05URVhUX0tFWV9TVEFURVM+KFJFTU9URV9UVU5ORUxfQ09OTkVDVElPTl9TVEFURV9LRVksICdkaXNjb25uZWN0ZWQnKTtcblxuY29uc3QgUkVNT1RFX1RVTk5FTF9VU0VEX1NUT1JBR0VfS0VZID0gJ3JlbW90ZVR1bm5lbFNlcnZpY2VVc2VkJztcbmNvbnN0IFJFTU9URV9UVU5ORUxfUFJPTVBURURfUFJFVklFV19TVE9SQUdFX0tFWSA9ICdyZW1vdGVUdW5uZWxTZXJ2aWNlUHJvbXB0ZWRQcmV2aWV3JztcbmNvbnN0IFJFTU9URV9UVU5ORUxfRVhURU5TSU9OX1JFQ09NTUVOREVEX0tFWSA9ICdyZW1vdGVUdW5uZWxFeHRlbnNpb25SZWNvbW1lbmRlZCc7XG5jb25zdCBSRU1PVEVfVFVOTkVMX0hBU19VU0VEX0JFRk9SRSA9ICdyZW1vdGVUdW5uZWxIYXNVc2VkJztcbmNvbnN0IFJFTU9URV9UVU5ORUxfRVhURU5TSU9OX1RJTUVPVVQgPSA0ICogNjAgKiAxMDAwOyAvLyBzaG93IHRoZSByZWNvbW1lbmRhdGlvbiB0aGF0IGEgbWFjaGluZSBzdGFydGVkIHVzaW5nIHR1bm5lbHMgaWYgaXQgam9pbmVkIGxlc3MgdGhhbiA0IG1pbnV0ZXMgYWdvXG5cbmNvbnN0IElOVkFMSURfVE9LRU5fUkVUUklFUyA9IDI7XG5cbmludGVyZmFjZSBVc2VkT25Ib3N0TWVzc2FnZSB7IGhvc3ROYW1lOiBzdHJpbmc7IHRpbWVTdGFtcDogbnVtYmVyIH1cblxudHlwZSBFeGlzdGluZ1Nlc3Npb25JdGVtID0geyBzZXNzaW9uOiBBdXRoZW50aWNhdGlvblNlc3Npb247IHByb3ZpZGVySWQ6IHN0cmluZzsgbGFiZWw6IHN0cmluZzsgZGVzY3JpcHRpb246IHN0cmluZyB9O1xudHlwZSBJQXV0aGVudGljYXRpb25Qcm92aWRlciA9IHsgaWQ6IHN0cmluZzsgc2NvcGVzOiBzdHJpbmdbXSB9O1xudHlwZSBBdXRoZW50aWNhdGlvblByb3ZpZGVyT3B0aW9uID0gSVF1aWNrUGlja0l0ZW0gJiB7IHByb3ZpZGVyOiBJQXV0aGVudGljYXRpb25Qcm92aWRlciB9O1xuXG5lbnVtIFJlbW90ZVR1bm5lbENvbW1hbmRJZHMge1xuXHR0dXJuT24gPSAnd29ya2JlbmNoLnJlbW90ZVR1bm5lbC5hY3Rpb25zLnR1cm5PbicsXG5cdHR1cm5PZmYgPSAnd29ya2JlbmNoLnJlbW90ZVR1bm5lbC5hY3Rpb25zLnR1cm5PZmYnLFxuXHRjb25uZWN0aW5nID0gJ3dvcmtiZW5jaC5yZW1vdGVUdW5uZWwuYWN0aW9ucy5jb25uZWN0aW5nJyxcblx0bWFuYWdlID0gJ3dvcmtiZW5jaC5yZW1vdGVUdW5uZWwuYWN0aW9ucy5tYW5hZ2UnLFxuXHRzaG93TG9nID0gJ3dvcmtiZW5jaC5yZW1vdGVUdW5uZWwuYWN0aW9ucy5zaG93TG9nJyxcblx0Y29uZmlndXJlID0gJ3dvcmtiZW5jaC5yZW1vdGVUdW5uZWwuYWN0aW9ucy5jb25maWd1cmUnLFxuXHRjb3B5VG9DbGlwYm9hcmQgPSAnd29ya2JlbmNoLnJlbW90ZVR1bm5lbC5hY3Rpb25zLmNvcHlUb0NsaXBib2FyZCcsXG5cdGxlYXJuTW9yZSA9ICd3b3JrYmVuY2gucmVtb3RlVHVubmVsLmFjdGlvbnMubGVhcm5Nb3JlJyxcbn1cblxuLy8gbmFtZSBzaG93biBpbiBub2ZpY2F0aW9uc1xubmFtZXNwYWNlIFJlbW90ZVR1bm5lbENvbW1hbmRMYWJlbHMge1xuXHRleHBvcnQgY29uc3QgdHVybk9uID0gbG9jYWxpemUoJ3JlbW90ZVR1bm5lbC5hY3Rpb25zLnR1cm5PbicsICdUdXJuIG9uIFJlbW90ZSBUdW5uZWwgQWNjZXNzLi4uJyk7XG5cdGV4cG9ydCBjb25zdCB0dXJuT2ZmID0gbG9jYWxpemUoJ3JlbW90ZVR1bm5lbC5hY3Rpb25zLnR1cm5PZmYnLCAnVHVybiBvZmYgUmVtb3RlIFR1bm5lbCBBY2Nlc3MuLi4nKTtcblx0ZXhwb3J0IGNvbnN0IHNob3dMb2cgPSBsb2NhbGl6ZSgncmVtb3RlVHVubmVsLmFjdGlvbnMuc2hvd0xvZycsICdTaG93IFJlbW90ZSBUdW5uZWwgU2VydmljZSBMb2cnKTtcblx0ZXhwb3J0IGNvbnN0IGNvbmZpZ3VyZSA9IGxvY2FsaXplKCdyZW1vdGVUdW5uZWwuYWN0aW9ucy5jb25maWd1cmUnLCAnQ29uZmlndXJlIFR1bm5lbCBOYW1lLi4uJyk7XG5cdGV4cG9ydCBjb25zdCBjb3B5VG9DbGlwYm9hcmQgPSBsb2NhbGl6ZSgncmVtb3RlVHVubmVsLmFjdGlvbnMuY29weVRvQ2xpcGJvYXJkJywgJ0NvcHkgQnJvd3NlciBVUkkgdG8gQ2xpcGJvYXJkJyk7XG5cdGV4cG9ydCBjb25zdCBsZWFybk1vcmUgPSBsb2NhbGl6ZSgncmVtb3RlVHVubmVsLmFjdGlvbnMubGVhcm5Nb3JlJywgJ0dldCBTdGFydGVkIHdpdGggVHVubmVscycpO1xufVxuXG5cbmV4cG9ydCBjbGFzcyBSZW1vdGVUdW5uZWxXb3JrYmVuY2hDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBjb25uZWN0aW9uU3RhdGVDb250ZXh0OiBJQ29udGV4dEtleTxDT05URVhUX0tFWV9TVEFURVM+O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgc2VydmVyQ29uZmlndXJhdGlvbjogSVR1bm5lbEFwcGxpY2F0aW9uQ29uZmlnO1xuXG5cdHByaXZhdGUgY29ubmVjdGlvbkluZm86IENvbm5lY3Rpb25JbmZvIHwgdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgbG9nZ2VyOiBJTG9nZ2VyO1xuXG5cdHByaXZhdGUgZXhwaXJlZFNlc3Npb25zOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUF1dGhlbnRpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGF1dGhlbnRpY2F0aW9uU2VydmljZTogSUF1dGhlbnRpY2F0aW9uU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElMb2dnZXJTZXJ2aWNlIGxvZ2dlclNlcnZpY2U6IElMb2dnZXJTZXJ2aWNlLFxuXHRcdEBJUXVpY2tJbnB1dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBxdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRcdEBJTmF0aXZlRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgZW52aXJvbm1lbnRTZXJ2aWNlOiBJTmF0aXZlRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJUmVtb3RlVHVubmVsU2VydmljZSBwcml2YXRlIHJlbW90ZVR1bm5lbFNlcnZpY2U6IElSZW1vdGVUdW5uZWxTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSB3b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJUHJvZ3Jlc3NTZXJ2aWNlIHByaXZhdGUgcHJvZ3Jlc3NTZXJ2aWNlOiBJUHJvZ3Jlc3NTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIG5vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmxvZ2dlciA9IHRoaXMuX3JlZ2lzdGVyKGxvZ2dlclNlcnZpY2UuY3JlYXRlTG9nZ2VyKGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS5sb2dzSG9tZSwgYCR7TE9HX0lEfS5sb2dgKSwgeyBpZDogTE9HX0lELCBuYW1lOiBMT0dHRVJfTkFNRSB9KSk7XG5cblx0XHR0aGlzLmNvbm5lY3Rpb25TdGF0ZUNvbnRleHQgPSBSRU1PVEVfVFVOTkVMX0NPTk5FQ1RJT05fU1RBVEUuYmluZFRvKHRoaXMuY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0Y29uc3Qgc2VydmVyQ29uZmlndXJhdGlvbiA9IHByb2R1Y3RTZXJ2aWNlLnR1bm5lbEFwcGxpY2F0aW9uQ29uZmlnO1xuXHRcdGlmICghc2VydmVyQ29uZmlndXJhdGlvbiB8fCAhcHJvZHVjdFNlcnZpY2UudHVubmVsQXBwbGljYXRpb25OYW1lKSB7XG5cdFx0XHR0aGlzLmxvZ2dlci5lcnJvcignTWlzc2luZyBcXCd0dW5uZWxBcHBsaWNhdGlvbkNvbmZpZ1xcJyBvciBcXCd0dW5uZWxBcHBsaWNhdGlvbk5hbWVcXCcgaW4gcHJvZHVjdC5qc29uLiBSZW1vdGUgdHVubmVsaW5nIGlzIG5vdCBhdmFpbGFibGUuJyk7XG5cdFx0XHR0aGlzLnNlcnZlckNvbmZpZ3VyYXRpb24gPSB7IGF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzOiB7fSwgZWRpdG9yV2ViVXJsOiAnJywgZXh0ZW5zaW9uOiB7IGV4dGVuc2lvbklkOiAnJywgZnJpZW5kbHlOYW1lOiAnJyB9IH07XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuc2VydmVyQ29uZmlndXJhdGlvbiA9IHNlcnZlckNvbmZpZ3VyYXRpb247XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLnJlbW90ZVR1bm5lbFNlcnZpY2Uub25EaWRDaGFuZ2VUdW5uZWxTdGF0dXMocyA9PiB0aGlzLmhhbmRsZVR1bm5lbFN0YXR1c1VwZGF0ZShzKSkpO1xuXG5cdFx0dGhpcy5yZWdpc3RlckNvbW1hbmRzKCk7XG5cblx0XHR0aGlzLmluaXRpYWxpemUoKTtcblxuXHRcdHRoaXMucmVjb21tZW5kUmVtb3RlRXh0ZW5zaW9uSWZOZWVkZWQoKTtcblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlVHVubmVsU3RhdHVzVXBkYXRlKHN0YXR1czogVHVubmVsU3RhdHVzKSB7XG5cdFx0dGhpcy5jb25uZWN0aW9uSW5mbyA9IHVuZGVmaW5lZDtcblx0XHRpZiAoc3RhdHVzLnR5cGUgPT09ICdkaXNjb25uZWN0ZWQnKSB7XG5cdFx0XHRpZiAoc3RhdHVzLm9uVG9rZW5GYWlsZWQpIHtcblx0XHRcdFx0dGhpcy5leHBpcmVkU2Vzc2lvbnMuYWRkKHN0YXR1cy5vblRva2VuRmFpbGVkLnNlc3Npb25JZCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmNvbm5lY3Rpb25TdGF0ZUNvbnRleHQuc2V0KCdkaXNjb25uZWN0ZWQnKTtcblx0XHR9IGVsc2UgaWYgKHN0YXR1cy50eXBlID09PSAnY29ubmVjdGluZycpIHtcblx0XHRcdHRoaXMuY29ubmVjdGlvblN0YXRlQ29udGV4dC5zZXQoJ2Nvbm5lY3RpbmcnKTtcblx0XHR9IGVsc2UgaWYgKHN0YXR1cy50eXBlID09PSAnY29ubmVjdGVkJykge1xuXHRcdFx0dGhpcy5jb25uZWN0aW9uSW5mbyA9IHN0YXR1cy5pbmZvO1xuXHRcdFx0dGhpcy5jb25uZWN0aW9uU3RhdGVDb250ZXh0LnNldCgnY29ubmVjdGVkJyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZWNvbW1lbmRSZW1vdGVFeHRlbnNpb25JZk5lZWRlZCgpIHtcblx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvblNlcnZpY2Uud2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCk7XG5cblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb24gPSB0aGlzLnNlcnZlckNvbmZpZ3VyYXRpb24uZXh0ZW5zaW9uO1xuXHRcdGNvbnN0IHNob3VsZFJlY29tbWVuZCA9IGFzeW5jICgpID0+IHtcblx0XHRcdGlmICh0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldEJvb2xlYW4oUkVNT1RFX1RVTk5FTF9FWFRFTlNJT05fUkVDT01NRU5ERURfS0VZLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmIChhd2FpdCB0aGlzLmV4dGVuc2lvblNlcnZpY2UuZ2V0RXh0ZW5zaW9uKHJlbW90ZUV4dGVuc2lvbi5leHRlbnNpb25JZCkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgdXNlZE9uSG9zdE1lc3NhZ2UgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldChSRU1PVEVfVFVOTkVMX1VTRURfU1RPUkFHRV9LRVksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdFx0XHRpZiAoIXVzZWRPbkhvc3RNZXNzYWdlKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGxldCB1c2VkVHVubmVsTmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Y29uc3QgbWVzc2FnZSA9IEpTT04ucGFyc2UodXNlZE9uSG9zdE1lc3NhZ2UpO1xuXHRcdFx0XHRpZiAoIWlzT2JqZWN0KG1lc3NhZ2UpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHsgaG9zdE5hbWUsIHRpbWVTdGFtcCB9ID0gbWVzc2FnZSBhcyBVc2VkT25Ib3N0TWVzc2FnZTtcblx0XHRcdFx0aWYgKCFpc1N0cmluZyhob3N0TmFtZSkhIHx8ICFpc051bWJlcih0aW1lU3RhbXApIHx8IG5ldyBEYXRlKCkuZ2V0VGltZSgpID4gdGltZVN0YW1wICsgUkVNT1RFX1RVTk5FTF9FWFRFTlNJT05fVElNRU9VVCkge1xuXHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHR1c2VkVHVubmVsTmFtZSA9IGhvc3ROYW1lO1xuXHRcdFx0fSBjYXRjaCAoXykge1xuXHRcdFx0XHQvLyBwcm9ibGVtcyBwYXJzaW5nIHRoZSBtZXNzYWdlLCBsaWtseSB0aGUgb2xkIG1lc3NhZ2UgZm9ybWF0XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGN1cnJlbnRUdW5uZWxOYW1lID0gYXdhaXQgdGhpcy5yZW1vdGVUdW5uZWxTZXJ2aWNlLmdldFR1bm5lbE5hbWUoKTtcblx0XHRcdGlmICghY3VycmVudFR1bm5lbE5hbWUgfHwgY3VycmVudFR1bm5lbE5hbWUgPT09IHVzZWRUdW5uZWxOYW1lKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB1c2VkVHVubmVsTmFtZTtcblx0XHR9O1xuXHRcdGNvbnN0IHJlY29tbWVkID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdXNlZE9uSG9zdCA9IGF3YWl0IHNob3VsZFJlY29tbWVuZCgpO1xuXHRcdFx0aWYgKCF1c2VkT25Ib3N0KSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHRoaXMubm90aWZpY2F0aW9uU2VydmljZS5ub3RpZnkoe1xuXHRcdFx0XHRzZXZlcml0eTogU2V2ZXJpdHkuSW5mbyxcblx0XHRcdFx0bWVzc2FnZTpcblx0XHRcdFx0XHRsb2NhbGl6ZShcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0a2V5OiAncmVjb21tZW5kLnJlbW90ZUV4dGVuc2lvbicsXG5cdFx0XHRcdFx0XHRcdGNvbW1lbnQ6IFsnezB9IHdpbGwgYmUgYSB0dW5uZWwgbmFtZSwgezF9IHdpbGwgdGhlIGxpbmsgYWRkcmVzcyB0byB0aGUgd2ViIFVJLCB7Nn0gYW4gZXh0ZW5zaW9uIG5hbWUuIFtsYWJlbF0oY29tbWFuZDpjb21tYW5kSWQpIGlzIGEgbWFya2Rvd24gbGluay4gT25seSB0cmFuc2xhdGUgdGhlIGxhYmVsLCBkbyBub3QgbW9kaWZ5IHRoZSBmb3JtYXQnXVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFwiVHVubmVsICd7MH0nIGlzIGF2YWlhYmxlIGZvciByZW1vdGUgYWNjZXNzLiBUaGUgezF9IGV4dGVuc2lvbiBjYW4gYmUgdXNlZCB0byBjb25uZWN0IHRvIGl0LlwiLFxuXHRcdFx0XHRcdFx0dXNlZE9uSG9zdCwgcmVtb3RlRXh0ZW5zaW9uLmZyaWVuZGx5TmFtZVxuXHRcdFx0XHRcdCksXG5cdFx0XHRcdGFjdGlvbnM6IHtcblx0XHRcdFx0XHRwcmltYXJ5OiBbXG5cdFx0XHRcdFx0XHRuZXcgQWN0aW9uKCdzaG93RXh0ZW5zaW9uJywgbG9jYWxpemUoJ2FjdGlvbi5zaG93RXh0ZW5zaW9uJywgXCJTaG93IEV4dGVuc2lvblwiKSwgdW5kZWZpbmVkLCB0cnVlLCAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKCd3b3JrYmVuY2guZXh0ZW5zaW9ucy5hY3Rpb24uc2hvd0V4dGVuc2lvbnNXaXRoSWRzJywgW3JlbW90ZUV4dGVuc2lvbi5leHRlbnNpb25JZF0pO1xuXHRcdFx0XHRcdFx0fSksXG5cdFx0XHRcdFx0XHRuZXcgQWN0aW9uKCdkb05vdFNob3dBZ2FpbicsIGxvY2FsaXplKCdhY3Rpb24uZG9Ob3RTaG93QWdhaW4nLCBcIkRvIG5vdCBzaG93IGFnYWluXCIpLCB1bmRlZmluZWQsIHRydWUsICgpID0+IHtcblx0XHRcdFx0XHRcdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShSRU1PVEVfVFVOTkVMX0VYVEVOU0lPTl9SRUNPTU1FTkRFRF9LRVksIHRydWUsIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgU3RvcmFnZVRhcmdldC5VU0VSKTtcblx0XHRcdFx0XHRcdH0pLFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9O1xuXHRcdGlmIChhd2FpdCBzaG91bGRSZWNvbW1lbmQoKSkge1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZVN0b3JlKCkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHRoaXMuc3RvcmFnZVNlcnZpY2Uub25EaWRDaGFuZ2VWYWx1ZShTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFJFTU9URV9UVU5ORUxfVVNFRF9TVE9SQUdFX0tFWSwgZGlzcG9zYWJsZXMpKGFzeW5jICgpID0+IHtcblx0XHRcdFx0Y29uc3Qgc3VjY2VzcyA9IGF3YWl0IHJlY29tbWVkKCk7XG5cdFx0XHRcdGlmIChzdWNjZXNzKSB7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBpbml0aWFsaXplKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IFttb2RlLCBzdGF0dXNdID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0dGhpcy5yZW1vdGVUdW5uZWxTZXJ2aWNlLmdldE1vZGUoKSxcblx0XHRcdHRoaXMucmVtb3RlVHVubmVsU2VydmljZS5nZXRUdW5uZWxTdGF0dXMoKSxcblx0XHRdKTtcblxuXHRcdHRoaXMuaGFuZGxlVHVubmVsU3RhdHVzVXBkYXRlKHN0YXR1cyk7XG5cblx0XHRpZiAobW9kZS5hY3RpdmUgJiYgbW9kZS5zZXNzaW9uLnRva2VuKSB7XG5cdFx0XHRyZXR1cm47IC8vIGFscmVhZHkgaW5pdGlhbGl6ZWQsIHRva2VuIGF2YWlsYWJsZVxuXHRcdH1cblxuXHRcdGNvbnN0IGRvSW5pdGlhbFN0YXRlRGlzY292ZXJ5ID0gYXN5bmMgKHByb2dyZXNzPzogSVByb2dyZXNzPElQcm9ncmVzc1N0ZXA+KSA9PiB7XG5cdFx0XHRjb25zdCBsaXN0ZW5lciA9IHByb2dyZXNzICYmIHRoaXMucmVtb3RlVHVubmVsU2VydmljZS5vbkRpZENoYW5nZVR1bm5lbFN0YXR1cyhzdGF0dXMgPT4ge1xuXHRcdFx0XHRzd2l0Y2ggKHN0YXR1cy50eXBlKSB7XG5cdFx0XHRcdFx0Y2FzZSAnY29ubmVjdGluZyc6XG5cdFx0XHRcdFx0XHRpZiAoc3RhdHVzLnByb2dyZXNzKSB7XG5cdFx0XHRcdFx0XHRcdHByb2dyZXNzLnJlcG9ydCh7IG1lc3NhZ2U6IHN0YXR1cy5wcm9ncmVzcyB9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHRcdGxldCBuZXdTZXNzaW9uOiBJUmVtb3RlVHVubmVsU2Vzc2lvbiB8IHVuZGVmaW5lZDtcblx0XHRcdGlmIChtb2RlLmFjdGl2ZSkge1xuXHRcdFx0XHRjb25zdCB0b2tlbiA9IGF3YWl0IHRoaXMuZ2V0U2Vzc2lvblRva2VuKG1vZGUuc2Vzc2lvbik7XG5cdFx0XHRcdGlmICh0b2tlbikge1xuXHRcdFx0XHRcdG5ld1Nlc3Npb24gPSB7IC4uLm1vZGUuc2Vzc2lvbiwgdG9rZW4gfTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y29uc3Qgc3RhdHVzID0gYXdhaXQgdGhpcy5yZW1vdGVUdW5uZWxTZXJ2aWNlLmluaXRpYWxpemUobW9kZS5hY3RpdmUgJiYgbmV3U2Vzc2lvbiA/IHsgLi4ubW9kZSwgc2Vzc2lvbjogbmV3U2Vzc2lvbiB9IDogSU5BQ1RJVkVfVFVOTkVMX01PREUpO1xuXHRcdFx0bGlzdGVuZXI/LmRpc3Bvc2UoKTtcblxuXHRcdFx0aWYgKHN0YXR1cy50eXBlID09PSAnY29ubmVjdGVkJykge1xuXHRcdFx0XHR0aGlzLmNvbm5lY3Rpb25JbmZvID0gc3RhdHVzLmluZm87XG5cdFx0XHRcdHRoaXMuY29ubmVjdGlvblN0YXRlQ29udGV4dC5zZXQoJ2Nvbm5lY3RlZCcpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fTtcblxuXG5cdFx0Y29uc3QgaGFzVXNlZCA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0Qm9vbGVhbihSRU1PVEVfVFVOTkVMX0hBU19VU0VEX0JFRk9SRSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBmYWxzZSk7XG5cblx0XHRpZiAoaGFzVXNlZCkge1xuXHRcdFx0YXdhaXQgdGhpcy5wcm9ncmVzc1NlcnZpY2Uud2l0aFByb2dyZXNzKFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bG9jYXRpb246IFByb2dyZXNzTG9jYXRpb24uV2luZG93LFxuXHRcdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ2luaXRpYWxpemUucHJvZ3Jlc3MudGl0bGUnLCBjb21tZW50OiBbJ09ubHkgdHJhbnNsYXRlIFxcJ0xvb2tpbmcgZm9yIHJlbW90ZSB0dW5uZWxcXCcsIGRvIG5vdCBjaGFuZ2UgdGhlIGZvcm1hdCBvZiB0aGUgcmVzdCAobWFya2Rvd24gbGluayBmb3JtYXQpJ10gfSwgXCJbTG9va2luZyBmb3IgcmVtb3RlIHR1bm5lbF0oY29tbWFuZDp7MH0pXCIsIFJlbW90ZVR1bm5lbENvbW1hbmRJZHMuc2hvd0xvZyksXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGRvSW5pdGlhbFN0YXRlRGlzY292ZXJ5XG5cdFx0XHQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkb0luaXRpYWxTdGF0ZURpc2NvdmVyeSh1bmRlZmluZWQpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgZ2V0UHJlZmVycmVkVG9rZW5Gcm9tU2Vzc2lvbihzZXNzaW9uOiBFeGlzdGluZ1Nlc3Npb25JdGVtKSB7XG5cdFx0cmV0dXJuIHNlc3Npb24uc2Vzc2lvbi5hY2Nlc3NUb2tlbiB8fCBzZXNzaW9uLnNlc3Npb24uaWRUb2tlbjtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgc3RhcnRUdW5uZWwoYXNTZXJ2aWNlOiBib29sZWFuKTogUHJvbWlzZTxDb25uZWN0aW9uSW5mbyB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICh0aGlzLmNvbm5lY3Rpb25JbmZvKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jb25uZWN0aW9uSW5mbztcblx0XHR9XG5cblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKFJFTU9URV9UVU5ORUxfSEFTX1VTRURfQkVGT1JFLCB0cnVlLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cblx0XHRsZXQgdG9rZW5Qcm9ibGVtcyA9IGZhbHNlO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgSU5WQUxJRF9UT0tFTl9SRVRSSUVTOyBpKyspIHtcblx0XHRcdHRva2VuUHJvYmxlbXMgPSBmYWxzZTtcblxuXHRcdFx0Y29uc3QgYXV0aGVudGljYXRpb25TZXNzaW9uID0gYXdhaXQgdGhpcy5nZXRBdXRoZW50aWNhdGlvblNlc3Npb24oKTtcblx0XHRcdGlmIChhdXRoZW50aWNhdGlvblNlc3Npb24gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHR0aGlzLmxvZ2dlci5pbmZvKCdObyBhdXRoZW50aWNhdGlvbiBzZXNzaW9uIGF2YWlsYWJsZSwgbm90IHN0YXJ0aW5nIHR1bm5lbCcpO1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLnByb2dyZXNzU2VydmljZS53aXRoUHJvZ3Jlc3MoXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRsb2NhdGlvbjogUHJvZ3Jlc3NMb2NhdGlvbi5Ob3RpZmljYXRpb24sXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKHsga2V5OiAnc3RhcnRUdW5uZWwucHJvZ3Jlc3MudGl0bGUnLCBjb21tZW50OiBbJ09ubHkgdHJhbnNsYXRlIFxcJ1N0YXJ0aW5nIHJlbW90ZSB0dW5uZWxcXCcsIGRvIG5vdCBjaGFuZ2UgdGhlIGZvcm1hdCBvZiB0aGUgcmVzdCAobWFya2Rvd24gbGluayBmb3JtYXQpJ10gfSwgXCJbU3RhcnRpbmcgcmVtb3RlIHR1bm5lbF0oY29tbWFuZDp7MH0pXCIsIFJlbW90ZVR1bm5lbENvbW1hbmRJZHMuc2hvd0xvZyksXG5cdFx0XHRcdH0sXG5cdFx0XHRcdChwcm9ncmVzczogSVByb2dyZXNzPElQcm9ncmVzc1N0ZXA+KSA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPENvbm5lY3Rpb25JbmZvIHwgdW5kZWZpbmVkPigocywgZSkgPT4ge1xuXHRcdFx0XHRcdFx0bGV0IGNvbXBsZXRlZCA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0Y29uc3QgbGlzdGVuZXIgPSB0aGlzLnJlbW90ZVR1bm5lbFNlcnZpY2Uub25EaWRDaGFuZ2VUdW5uZWxTdGF0dXMoc3RhdHVzID0+IHtcblx0XHRcdFx0XHRcdFx0c3dpdGNoIChzdGF0dXMudHlwZSkge1xuXHRcdFx0XHRcdFx0XHRcdGNhc2UgJ2Nvbm5lY3RpbmcnOlxuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKHN0YXR1cy5wcm9ncmVzcykge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRwcm9ncmVzcy5yZXBvcnQoeyBtZXNzYWdlOiBzdGF0dXMucHJvZ3Jlc3MgfSk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdFx0XHRjYXNlICdjb25uZWN0ZWQnOlxuXHRcdFx0XHRcdFx0XHRcdFx0bGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29tcGxldGVkID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0XHRcdHMoc3RhdHVzLmluZm8pO1xuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKHN0YXR1cy5zZXJ2aWNlSW5zdGFsbEZhaWxlZCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2Uubm90aWZ5KHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRzZXZlcml0eTogU2V2ZXJpdHkuV2FybmluZyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRtZXNzYWdlOiBsb2NhbGl6ZShcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0a2V5OiAncmVtb3RlVHVubmVsLnNlcnZpY2VJbnN0YWxsRmFpbGVkJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0Y29tbWVudDogWyd7TG9ja2VkPVwiXShjb21tYW5kOnswfSlcIn0nXVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRcdFwiSW5zdGFsbGF0aW9uIGFzIGEgc2VydmljZSBmYWlsZWQsIGFuZCB3ZSBmZWxsIGJhY2sgdG8gcnVubmluZyB0aGUgdHVubmVsIGZvciB0aGlzIHNlc3Npb24uIFNlZSB0aGUgW2Vycm9yIGxvZ10oY29tbWFuZDp7MH0pIGZvciBkZXRhaWxzLlwiLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdFx0UmVtb3RlVHVubmVsQ29tbWFuZElkcy5zaG93TG9nLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0XHRcdFx0Y2FzZSAnZGlzY29ubmVjdGVkJzpcblx0XHRcdFx0XHRcdFx0XHRcdGxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbXBsZXRlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdFx0XHR0b2tlblByb2JsZW1zID0gISFzdGF0dXMub25Ub2tlbkZhaWxlZDtcblx0XHRcdFx0XHRcdFx0XHRcdHModW5kZWZpbmVkKTtcblx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdGNvbnN0IHRva2VuID0gdGhpcy5nZXRQcmVmZXJyZWRUb2tlbkZyb21TZXNzaW9uKGF1dGhlbnRpY2F0aW9uU2Vzc2lvbik7XG5cdFx0XHRcdFx0XHRjb25zdCBhY2NvdW50OiBJUmVtb3RlVHVubmVsU2Vzc2lvbiA9IHsgc2Vzc2lvbklkOiBhdXRoZW50aWNhdGlvblNlc3Npb24uc2Vzc2lvbi5pZCwgdG9rZW4sIHByb3ZpZGVySWQ6IGF1dGhlbnRpY2F0aW9uU2Vzc2lvbi5wcm92aWRlcklkLCBhY2NvdW50TGFiZWw6IGF1dGhlbnRpY2F0aW9uU2Vzc2lvbi5zZXNzaW9uLmFjY291bnQubGFiZWwgfTtcblx0XHRcdFx0XHRcdHRoaXMucmVtb3RlVHVubmVsU2VydmljZS5zdGFydFR1bm5lbCh7IGFjdGl2ZTogdHJ1ZSwgYXNTZXJ2aWNlLCBzZXNzaW9uOiBhY2NvdW50IH0pLnRoZW4oc3RhdHVzID0+IHtcblx0XHRcdFx0XHRcdFx0aWYgKCFjb21wbGV0ZWQgJiYgKHN0YXR1cy50eXBlID09PSAnY29ubmVjdGVkJyB8fCBzdGF0dXMudHlwZSA9PT0gJ2Rpc2Nvbm5lY3RlZCcpKSB7XG5cdFx0XHRcdFx0XHRcdFx0bGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdFx0XHRcdGlmIChzdGF0dXMudHlwZSA9PT0gJ2Nvbm5lY3RlZCcpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHMoc3RhdHVzLmluZm8pO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0b2tlblByb2JsZW1zID0gISFzdGF0dXMub25Ub2tlbkZhaWxlZDtcblx0XHRcdFx0XHRcdFx0XHRcdHModW5kZWZpbmVkKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHQpO1xuXHRcdFx0aWYgKHJlc3VsdCB8fCAhdG9rZW5Qcm9ibGVtcykge1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRBdXRoZW50aWNhdGlvblNlc3Npb24oKTogUHJvbWlzZTxFeGlzdGluZ1Nlc3Npb25JdGVtIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3Qgc2Vzc2lvbnMgPSBhd2FpdCB0aGlzLmdldEFsbFNlc3Npb25zKCk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgcXVpY2twaWNrID0gZGlzcG9zYWJsZXMuYWRkKHRoaXMucXVpY2tJbnB1dFNlcnZpY2UuY3JlYXRlUXVpY2tQaWNrPEV4aXN0aW5nU2Vzc2lvbkl0ZW0gfCBBdXRoZW50aWNhdGlvblByb3ZpZGVyT3B0aW9uIHwgSVF1aWNrUGlja0l0ZW0+KHsgdXNlU2VwYXJhdG9yczogdHJ1ZSB9KSk7XG5cdFx0cXVpY2twaWNrLm9rID0gZmFsc2U7XG5cdFx0cXVpY2twaWNrLnBsYWNlaG9sZGVyID0gbG9jYWxpemUoJ2FjY291bnRQcmVmZXJlbmNlLnBsYWNlaG9sZGVyJywgXCJTaWduIGluIHRvIGFuIGFjY291bnQgdG8gZW5hYmxlIHJlbW90ZSBhY2Nlc3NcIik7XG5cdFx0cXVpY2twaWNrLmlnbm9yZUZvY3VzT3V0ID0gdHJ1ZTtcblx0XHRxdWlja3BpY2suaXRlbXMgPSBhd2FpdCB0aGlzLmNyZWF0ZVF1aWNrcGlja0l0ZW1zKHNlc3Npb25zKTtcblxuXHRcdHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocXVpY2twaWNrLm9uRGlkSGlkZSgoZSkgPT4ge1xuXHRcdFx0XHRyZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRcdH0pKTtcblxuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrcGljay5vbkRpZEFjY2VwdChhc3luYyAoZSkgPT4ge1xuXHRcdFx0XHRjb25zdCBzZWxlY3Rpb24gPSBxdWlja3BpY2suc2VsZWN0ZWRJdGVtc1swXTtcblx0XHRcdFx0aWYgKCdwcm92aWRlcicgaW4gc2VsZWN0aW9uKSB7XG5cdFx0XHRcdFx0Y29uc3Qgc2Vzc2lvbiA9IGF3YWl0IHRoaXMuYXV0aGVudGljYXRpb25TZXJ2aWNlLmNyZWF0ZVNlc3Npb24oc2VsZWN0aW9uLnByb3ZpZGVyLmlkLCBzZWxlY3Rpb24ucHJvdmlkZXIuc2NvcGVzKTtcblx0XHRcdFx0XHRyZXNvbHZlKHRoaXMuY3JlYXRlRXhpc3RpbmdTZXNzaW9uSXRlbShzZXNzaW9uLCBzZWxlY3Rpb24ucHJvdmlkZXIuaWQpKTtcblx0XHRcdFx0fSBlbHNlIGlmICgnc2Vzc2lvbicgaW4gc2VsZWN0aW9uKSB7XG5cdFx0XHRcdFx0cmVzb2x2ZShzZWxlY3Rpb24pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRxdWlja3BpY2suaGlkZSgpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHRxdWlja3BpY2suc2hvdygpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBjcmVhdGVFeGlzdGluZ1Nlc3Npb25JdGVtKHNlc3Npb246IEF1dGhlbnRpY2F0aW9uU2Vzc2lvbiwgcHJvdmlkZXJJZDogc3RyaW5nKTogRXhpc3RpbmdTZXNzaW9uSXRlbSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGxhYmVsOiBzZXNzaW9uLmFjY291bnQubGFiZWwsXG5cdFx0XHRkZXNjcmlwdGlvbjogdGhpcy5hdXRoZW50aWNhdGlvblNlcnZpY2UuZ2V0UHJvdmlkZXIocHJvdmlkZXJJZCkubGFiZWwsXG5cdFx0XHRzZXNzaW9uLFxuXHRcdFx0cHJvdmlkZXJJZFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNyZWF0ZVF1aWNrcGlja0l0ZW1zKHNlc3Npb25zOiBFeGlzdGluZ1Nlc3Npb25JdGVtW10pOiBQcm9taXNlPChFeGlzdGluZ1Nlc3Npb25JdGVtIHwgQXV0aGVudGljYXRpb25Qcm92aWRlck9wdGlvbiB8IElRdWlja1BpY2tTZXBhcmF0b3IgfCBJUXVpY2tQaWNrSXRlbSAmIHsgY2FuY2VsZWRBdXRoZW50aWNhdGlvbjogYm9vbGVhbiB9KVtdPiB7XG5cdFx0Y29uc3Qgb3B0aW9uczogKEV4aXN0aW5nU2Vzc2lvbkl0ZW0gfCBBdXRoZW50aWNhdGlvblByb3ZpZGVyT3B0aW9uIHwgSVF1aWNrUGlja1NlcGFyYXRvciB8IElRdWlja1BpY2tJdGVtICYgeyBjYW5jZWxlZEF1dGhlbnRpY2F0aW9uOiBib29sZWFuIH0pW10gPSBbXTtcblxuXHRcdGlmIChzZXNzaW9ucy5sZW5ndGgpIHtcblx0XHRcdG9wdGlvbnMucHVzaCh7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogbG9jYWxpemUoJ3NpZ25lZCBpbicsIFwiU2lnbmVkIEluXCIpIH0pO1xuXHRcdFx0b3B0aW9ucy5wdXNoKC4uLnNlc3Npb25zKTtcblx0XHRcdG9wdGlvbnMucHVzaCh7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogbG9jYWxpemUoJ290aGVycycsIFwiT3RoZXJzXCIpIH0pO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgYXV0aGVudGljYXRpb25Qcm92aWRlciBvZiAoYXdhaXQgdGhpcy5nZXRBdXRoZW50aWNhdGlvblByb3ZpZGVycygpKSkge1xuXHRcdFx0Y29uc3Qgc2lnbmVkSW5Gb3JQcm92aWRlciA9IHNlc3Npb25zLnNvbWUoYWNjb3VudCA9PiBhY2NvdW50LnByb3ZpZGVySWQgPT09IGF1dGhlbnRpY2F0aW9uUHJvdmlkZXIuaWQpO1xuXHRcdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLmF1dGhlbnRpY2F0aW9uU2VydmljZS5nZXRQcm92aWRlcihhdXRoZW50aWNhdGlvblByb3ZpZGVyLmlkKTtcblx0XHRcdGlmICghc2lnbmVkSW5Gb3JQcm92aWRlciB8fCBwcm92aWRlci5zdXBwb3J0c011bHRpcGxlQWNjb3VudHMpIHtcblx0XHRcdFx0b3B0aW9ucy5wdXNoKHsgbGFiZWw6IGxvY2FsaXplKHsga2V5OiAnc2lnbiBpbiB1c2luZyBhY2NvdW50JywgY29tbWVudDogWyd7MH0gd2lsbCBiZSBhIGF1dGggcHJvdmlkZXIgKGUuZy4gR2l0aHViKSddIH0sIFwiU2lnbiBpbiB3aXRoIHswfVwiLCBwcm92aWRlci5sYWJlbCksIHByb3ZpZGVyOiBhdXRoZW50aWNhdGlvblByb3ZpZGVyIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBvcHRpb25zO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgYWxsIGF1dGhlbnRpY2F0aW9uIHNlc3Npb25zIGF2YWlsYWJsZSBmcm9tIHtAbGluayBnZXRBdXRoZW50aWNhdGlvblByb3ZpZGVyc30uXG5cdCAqL1xuXHRwcml2YXRlIGFzeW5jIGdldEFsbFNlc3Npb25zKCk6IFByb21pc2U8RXhpc3RpbmdTZXNzaW9uSXRlbVtdPiB7XG5cdFx0Y29uc3QgYXV0aGVudGljYXRpb25Qcm92aWRlcnMgPSBhd2FpdCB0aGlzLmdldEF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzKCk7XG5cdFx0Y29uc3QgYWNjb3VudHMgPSBuZXcgTWFwPHN0cmluZywgRXhpc3RpbmdTZXNzaW9uSXRlbT4oKTtcblx0XHRjb25zdCBjdXJyZW50QWNjb3VudCA9IGF3YWl0IHRoaXMucmVtb3RlVHVubmVsU2VydmljZS5nZXRNb2RlKCk7XG5cdFx0bGV0IGN1cnJlbnRTZXNzaW9uOiBFeGlzdGluZ1Nlc3Npb25JdGVtIHwgdW5kZWZpbmVkO1xuXG5cdFx0Zm9yIChjb25zdCBwcm92aWRlciBvZiBhdXRoZW50aWNhdGlvblByb3ZpZGVycykge1xuXHRcdFx0Y29uc3Qgc2Vzc2lvbnMgPSBhd2FpdCB0aGlzLmF1dGhlbnRpY2F0aW9uU2VydmljZS5nZXRTZXNzaW9ucyhwcm92aWRlci5pZCwgcHJvdmlkZXIuc2NvcGVzKTtcblxuXHRcdFx0Zm9yIChjb25zdCBzZXNzaW9uIG9mIHNlc3Npb25zKSB7XG5cdFx0XHRcdGlmICghdGhpcy5leHBpcmVkU2Vzc2lvbnMuaGFzKHNlc3Npb24uaWQpKSB7XG5cdFx0XHRcdFx0Y29uc3QgaXRlbSA9IHRoaXMuY3JlYXRlRXhpc3RpbmdTZXNzaW9uSXRlbShzZXNzaW9uLCBwcm92aWRlci5pZCk7XG5cdFx0XHRcdFx0YWNjb3VudHMuc2V0KGl0ZW0uc2Vzc2lvbi5hY2NvdW50LmlkLCBpdGVtKTtcblx0XHRcdFx0XHRpZiAoY3VycmVudEFjY291bnQuYWN0aXZlICYmIGN1cnJlbnRBY2NvdW50LnNlc3Npb24uc2Vzc2lvbklkID09PSBzZXNzaW9uLmlkKSB7XG5cdFx0XHRcdFx0XHRjdXJyZW50U2Vzc2lvbiA9IGl0ZW07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGN1cnJlbnRTZXNzaW9uICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGFjY291bnRzLnNldChjdXJyZW50U2Vzc2lvbi5zZXNzaW9uLmFjY291bnQuaWQsIGN1cnJlbnRTZXNzaW9uKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gWy4uLmFjY291bnRzLnZhbHVlcygpXTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0U2Vzc2lvblRva2VuKHNlc3Npb246IElSZW1vdGVUdW5uZWxTZXNzaW9uIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoc2Vzc2lvbikge1xuXHRcdFx0Y29uc3Qgc2Vzc2lvbkl0ZW0gPSAoYXdhaXQgdGhpcy5nZXRBbGxTZXNzaW9ucygpKS5maW5kKHMgPT4gcy5zZXNzaW9uLmlkID09PSBzZXNzaW9uLnNlc3Npb25JZCk7XG5cdFx0XHRpZiAoc2Vzc2lvbkl0ZW0pIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZ2V0UHJlZmVycmVkVG9rZW5Gcm9tU2Vzc2lvbihzZXNzaW9uSXRlbSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyBhbGwgYXV0aGVudGljYXRpb24gcHJvdmlkZXJzIHdoaWNoIGNhbiBiZSB1c2VkIHRvIGF1dGhlbnRpY2F0ZVxuXHQgKiB0byB0aGUgcmVtb3RlIHN0b3JhZ2Ugc2VydmljZSwgYmFzZWQgb24gcHJvZHVjdC5qc29uIGNvbmZpZ3VyYXRpb25cblx0ICogYW5kIHJlZ2lzdGVyZWQgYXV0aGVudGljYXRpb24gcHJvdmlkZXJzLlxuXHQgKi9cblx0cHJpdmF0ZSBhc3luYyBnZXRBdXRoZW50aWNhdGlvblByb3ZpZGVycygpOiBQcm9taXNlPElBdXRoZW50aWNhdGlvblByb3ZpZGVyW10+IHtcblx0XHQvLyBHZXQgdGhlIGxpc3Qgb2YgYXV0aGVudGljYXRpb24gcHJvdmlkZXJzIGNvbmZpZ3VyZWQgaW4gcHJvZHVjdC5qc29uXG5cdFx0Y29uc3QgYXV0aGVudGljYXRpb25Qcm92aWRlcnMgPSB0aGlzLnNlcnZlckNvbmZpZ3VyYXRpb24uYXV0aGVudGljYXRpb25Qcm92aWRlcnM7XG5cdFx0Y29uc3QgY29uZmlndXJlZEF1dGhlbnRpY2F0aW9uUHJvdmlkZXJzID0gT2JqZWN0LmtleXMoYXV0aGVudGljYXRpb25Qcm92aWRlcnMpLnJlZHVjZTxJQXV0aGVudGljYXRpb25Qcm92aWRlcltdPigocmVzdWx0LCBpZCkgPT4ge1xuXHRcdFx0cmVzdWx0LnB1c2goeyBpZCwgc2NvcGVzOiBhdXRoZW50aWNhdGlvblByb3ZpZGVyc1tpZF0uc2NvcGVzIH0pO1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9LCBbXSk7XG5cblx0XHQvLyBGaWx0ZXIgb3V0IGFueXRoaW5nIHRoYXQgaXNuJ3QgY3VycmVudGx5IGF2YWlsYWJsZSB0aHJvdWdoIHRoZSBhdXRoZW50aWNhdGlvblNlcnZpY2Vcblx0XHRjb25zdCBhdmFpbGFibGVBdXRoZW50aWNhdGlvblByb3ZpZGVycyA9IHRoaXMuYXV0aGVudGljYXRpb25TZXJ2aWNlLmRlY2xhcmVkUHJvdmlkZXJzO1xuXG5cdFx0cmV0dXJuIGNvbmZpZ3VyZWRBdXRoZW50aWNhdGlvblByb3ZpZGVycy5maWx0ZXIoKHsgaWQgfSkgPT4gYXZhaWxhYmxlQXV0aGVudGljYXRpb25Qcm92aWRlcnMuc29tZShwcm92aWRlciA9PiBwcm92aWRlci5pZCA9PT0gaWQpKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJDb21tYW5kcygpIHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogUmVtb3RlVHVubmVsQ29tbWFuZElkcy50dXJuT24sXG5cdFx0XHRcdFx0dGl0bGU6IFJlbW90ZVR1bm5lbENvbW1hbmRMYWJlbHMudHVybk9uLFxuXHRcdFx0XHRcdGNhdGVnb3J5OiBSRU1PVEVfVFVOTkVMX0NBVEVHT1JZLFxuXHRcdFx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKFJFTU9URV9UVU5ORUxfQ09OTkVDVElPTl9TVEFURV9LRVksICdkaXNjb25uZWN0ZWQnKSxcblx0XHRcdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuQWNjb3VudHNDb250ZXh0LFxuXHRcdFx0XHRcdFx0Z3JvdXA6ICcyX3JlbW90ZVR1bm5lbCcsXG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoUkVNT1RFX1RVTk5FTF9DT05ORUNUSU9OX1NUQVRFX0tFWSwgJ2Rpc2Nvbm5lY3RlZCcpLFxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRcdFx0Y29uc3Qgbm90aWZpY2F0aW9uU2VydmljZSA9IGFjY2Vzc29yLmdldChJTm90aWZpY2F0aW9uU2VydmljZSk7XG5cdFx0XHRcdGNvbnN0IGNsaXBib2FyZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNsaXBib2FyZFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBjb21tYW5kU2VydmljZSA9IGFjY2Vzc29yLmdldChJQ29tbWFuZFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBzdG9yYWdlU2VydmljZSA9IGFjY2Vzc29yLmdldChJU3RvcmFnZVNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBkaWFsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElEaWFsb2dTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRcdFx0Y29uc3QgcHJvZHVjdFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVByb2R1Y3RTZXJ2aWNlKTtcblxuXHRcdFx0XHRjb25zdCBkaWROb3RpZnlQcmV2aWV3ID0gc3RvcmFnZVNlcnZpY2UuZ2V0Qm9vbGVhbihSRU1PVEVfVFVOTkVMX1BST01QVEVEX1BSRVZJRVdfU1RPUkFHRV9LRVksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiwgZmFsc2UpO1xuXHRcdFx0XHRpZiAoIWRpZE5vdGlmeVByZXZpZXcpIHtcblx0XHRcdFx0XHRjb25zdCB7IGNvbmZpcm1lZCB9ID0gYXdhaXQgZGlhbG9nU2VydmljZS5jb25maXJtKHtcblx0XHRcdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCd0dW5uZWwucHJldmlldycsICdSZW1vdGUgVHVubmVscyBpcyBjdXJyZW50bHkgaW4gcHJldmlldy4gUGxlYXNlIHJlcG9ydCBhbnkgcHJvYmxlbXMgdXNpbmcgdGhlIFwiSGVscDogUmVwb3J0IElzc3VlXCIgY29tbWFuZC4nKSxcblx0XHRcdFx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKHsga2V5OiAnZW5hYmxlJywgY29tbWVudDogWycmJiBkZW5vdGVzIGEgbW5lbW9uaWMnXSB9LCAnJiZFbmFibGUnKVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdGlmICghY29uZmlybWVkKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0c3RvcmFnZVNlcnZpY2Uuc3RvcmUoUkVNT1RFX1RVTk5FTF9QUk9NUFRFRF9QUkVWSUVXX1NUT1JBR0VfS0VZLCB0cnVlLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdFx0Y29uc3QgcXVpY2tQaWNrID0gcXVpY2tJbnB1dFNlcnZpY2UuY3JlYXRlUXVpY2tQaWNrPElRdWlja1BpY2tJdGVtICYgeyBzZXJ2aWNlOiBib29sZWFuIH0+KCk7XG5cdFx0XHRcdHF1aWNrUGljay5wbGFjZWhvbGRlciA9IGxvY2FsaXplKCd0dW5uZWwuZW5hYmxlLnBsYWNlaG9sZGVyJywgJ1NlbGVjdCBob3cgeW91IHdhbnQgdG8gZW5hYmxlIGFjY2VzcycpO1xuXHRcdFx0XHRxdWlja1BpY2suaXRlbXMgPSBbXG5cdFx0XHRcdFx0eyBzZXJ2aWNlOiBmYWxzZSwgbGFiZWw6IGxvY2FsaXplKCd0dW5uZWwuZW5hYmxlLnNlc3Npb24nLCAnVHVybiBvbiBmb3IgdGhpcyBzZXNzaW9uJyksIGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndHVubmVsLmVuYWJsZS5zZXNzaW9uLmRlc2NyaXB0aW9uJywgJ1J1biB3aGVuZXZlciB7MH0gaXMgb3BlbicsIHByb2R1Y3RTZXJ2aWNlLm5hbWVTaG9ydCkgfSxcblx0XHRcdFx0XHR7IHNlcnZpY2U6IHRydWUsIGxhYmVsOiBsb2NhbGl6ZSgndHVubmVsLmVuYWJsZS5zZXJ2aWNlJywgJ0luc3RhbGwgYXMgYSBzZXJ2aWNlJyksIGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndHVubmVsLmVuYWJsZS5zZXJ2aWNlLmRlc2NyaXB0aW9uJywgJ1J1biB3aGVuZXZlciB5b3VcXCdyZSBsb2dnZWQgaW4nKSB9XG5cdFx0XHRcdF07XG5cblx0XHRcdFx0Y29uc3QgYXNTZXJ2aWNlID0gYXdhaXQgbmV3IFByb21pc2U8Ym9vbGVhbiB8IHVuZGVmaW5lZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrUGljay5vbkRpZEFjY2VwdCgoKSA9PiByZXNvbHZlKHF1aWNrUGljay5zZWxlY3RlZEl0ZW1zWzBdPy5zZXJ2aWNlKSkpO1xuXHRcdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja1BpY2sub25EaWRIaWRlKCgpID0+IHJlc29sdmUodW5kZWZpbmVkKSkpO1xuXHRcdFx0XHRcdHF1aWNrUGljay5zaG93KCk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHF1aWNrUGljay5kaXNwb3NlKCk7XG5cblx0XHRcdFx0aWYgKGFzU2VydmljZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuOyAvLyBuby1vcFxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgY29ubmVjdGlvbkluZm8gPSBhd2FpdCB0aGF0LnN0YXJ0VHVubmVsKC8qIGluc3RhbGxBc1NlcnZpY2U9ICovIGFzU2VydmljZSk7XG5cblx0XHRcdFx0aWYgKGNvbm5lY3Rpb25JbmZvKSB7XG5cdFx0XHRcdFx0Y29uc3QgbGlua1RvT3BlbiA9IHRoYXQuZ2V0TGlua1RvT3Blbihjb25uZWN0aW9uSW5mbyk7XG5cdFx0XHRcdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9uID0gdGhhdC5zZXJ2ZXJDb25maWd1cmF0aW9uLmV4dGVuc2lvbjtcblx0XHRcdFx0XHRjb25zdCBsaW5rVG9PcGVuRm9yTWFya2Rvd24gPSBsaW5rVG9PcGVuLnRvU3RyaW5nKGZhbHNlKS5yZXBsYWNlKC9cXCkvZywgJyUyOScpO1xuXHRcdFx0XHRcdG5vdGlmaWNhdGlvblNlcnZpY2Uubm90aWZ5KHtcblx0XHRcdFx0XHRcdHNldmVyaXR5OiBTZXZlcml0eS5JbmZvLFxuXHRcdFx0XHRcdFx0bWVzc2FnZTpcblx0XHRcdFx0XHRcdFx0bG9jYWxpemUoXG5cdFx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdFx0a2V5OiAncHJvZ3Jlc3MudHVybk9uLmZpbmFsJyxcblx0XHRcdFx0XHRcdFx0XHRcdGNvbW1lbnQ6IFsnezB9IHdpbGwgYmUgdGhlIHR1bm5lbCBuYW1lLCB7MX0gd2lsbCB0aGUgbGluayBhZGRyZXNzIHRvIHRoZSB3ZWIgVUksIHs2fSBhbiBleHRlbnNpb24gbmFtZSwgezd9IGEgbGluayB0byB0aGUgZXh0ZW5zaW9uIGRvY3VtZW50YXRpb24uIFtsYWJlbF0oY29tbWFuZDpjb21tYW5kSWQpIGlzIGEgbWFya2Rvd24gbGluay4gT25seSB0cmFuc2xhdGUgdGhlIGxhYmVsLCBkbyBub3QgbW9kaWZ5IHRoZSBmb3JtYXQnXVxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0XCJZb3UgY2FuIG5vdyBhY2Nlc3MgdGhpcyBtYWNoaW5lIGFueXdoZXJlIHZpYSB0aGUgc2VjdXJlIHR1bm5lbCBbezB9XShjb21tYW5kOns0fSkuIFRvIGNvbm5lY3QgdmlhIGEgZGlmZmVyZW50IG1hY2hpbmUsIHVzZSB0aGUgZ2VuZXJhdGVkIFt7MX1dKHsyfSkgbGluayBvciB1c2UgdGhlIFt7Nn1dKHs3fSkgZXh0ZW5zaW9uIGluIHRoZSBkZXNrdG9wIG9yIHdlYi4gWW91IGNhbiBbY29uZmlndXJlXShjb21tYW5kOnszfSkgb3IgW3R1cm4gb2ZmXShjb21tYW5kOns1fSkgdGhpcyBhY2Nlc3MgdmlhIHRoZSBWUyBDb2RlIEFjY291bnRzIG1lbnUuXCIsXG5cdFx0XHRcdFx0XHRcdFx0Y29ubmVjdGlvbkluZm8udHVubmVsTmFtZSwgY29ubmVjdGlvbkluZm8uZG9tYWluLCBsaW5rVG9PcGVuRm9yTWFya2Rvd24sIFJlbW90ZVR1bm5lbENvbW1hbmRJZHMubWFuYWdlLCBSZW1vdGVUdW5uZWxDb21tYW5kSWRzLmNvbmZpZ3VyZSwgUmVtb3RlVHVubmVsQ29tbWFuZElkcy50dXJuT2ZmLCByZW1vdGVFeHRlbnNpb24uZnJpZW5kbHlOYW1lLCAnaHR0cHM6Ly9jb2RlLnZpc3VhbHN0dWRpby5jb20vZG9jcy9yZW1vdGUvdHVubmVscydcblx0XHRcdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRcdGFjdGlvbnM6IHtcblx0XHRcdFx0XHRcdFx0cHJpbWFyeTogW1xuXHRcdFx0XHRcdFx0XHRcdG5ldyBBY3Rpb24oJ2NvcHlUb0NsaXBib2FyZCcsIGxvY2FsaXplKCdhY3Rpb24uY29weVRvQ2xpcGJvYXJkJywgXCJDb3B5IEJyb3dzZXIgTGluayB0byBDbGlwYm9hcmRcIiksIHVuZGVmaW5lZCwgdHJ1ZSwgKCkgPT4gY2xpcGJvYXJkU2VydmljZS53cml0ZVRleHQobGlua1RvT3Blbi50b1N0cmluZyh0cnVlKSkpLFxuXHRcdFx0XHRcdFx0XHRcdG5ldyBBY3Rpb24oJ3Nob3dFeHRlbnNpb24nLCBsb2NhbGl6ZSgnYWN0aW9uLnNob3dFeHRlbnNpb24nLCBcIlNob3cgRXh0ZW5zaW9uXCIpLCB1bmRlZmluZWQsIHRydWUsICgpID0+IHtcblx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiBjb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZCgnd29ya2JlbmNoLmV4dGVuc2lvbnMuYWN0aW9uLnNob3dFeHRlbnNpb25zV2l0aElkcycsIFtyZW1vdGVFeHRlbnNpb24uZXh0ZW5zaW9uSWRdKTtcblx0XHRcdFx0XHRcdFx0XHR9KVxuXHRcdFx0XHRcdFx0XHRdXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0Y29uc3QgdXNlZE9uSG9zdE1lc3NhZ2U6IFVzZWRPbkhvc3RNZXNzYWdlID0geyBob3N0TmFtZTogY29ubmVjdGlvbkluZm8udHVubmVsTmFtZSwgdGltZVN0YW1wOiBuZXcgRGF0ZSgpLmdldFRpbWUoKSB9O1xuXHRcdFx0XHRcdHN0b3JhZ2VTZXJ2aWNlLnN0b3JlKFJFTU9URV9UVU5ORUxfVVNFRF9TVE9SQUdFX0tFWSwgSlNPTi5zdHJpbmdpZnkodXNlZE9uSG9zdE1lc3NhZ2UpLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sIFN0b3JhZ2VUYXJnZXQuVVNFUik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bm90aWZpY2F0aW9uU2VydmljZS5ub3RpZnkoe1xuXHRcdFx0XHRcdFx0c2V2ZXJpdHk6IFNldmVyaXR5LkluZm8sXG5cdFx0XHRcdFx0XHRtZXNzYWdlOiBsb2NhbGl6ZSgncHJvZ3Jlc3MudHVybk9uLmZhaWxlZCcsXG5cdFx0XHRcdFx0XHRcdFwiVW5hYmxlIHRvIHR1cm4gb24gdGhlIHJlbW90ZSB0dW5uZWwgYWNjZXNzLiBDaGVjayB0aGUgUmVtb3RlIFR1bm5lbCBTZXJ2aWNlIGxvZyBmb3IgZGV0YWlscy5cIiksXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0YXdhaXQgY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoUmVtb3RlVHVubmVsQ29tbWFuZElkcy5zaG93TG9nKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBSZW1vdGVUdW5uZWxDb21tYW5kSWRzLm1hbmFnZSxcblx0XHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ3JlbW90ZVR1bm5lbC5hY3Rpb25zLm1hbmFnZS5vbi52MicsICdSZW1vdGUgVHVubmVsIEFjY2VzcyBpcyBPbicpLFxuXHRcdFx0XHRcdGNhdGVnb3J5OiBSRU1PVEVfVFVOTkVMX0NBVEVHT1JZLFxuXHRcdFx0XHRcdG1lbnU6IFt7XG5cdFx0XHRcdFx0XHRpZDogTWVudUlkLkFjY291bnRzQ29udGV4dCxcblx0XHRcdFx0XHRcdGdyb3VwOiAnMl9yZW1vdGVUdW5uZWwnLFxuXHRcdFx0XHRcdFx0d2hlbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKFJFTU9URV9UVU5ORUxfQ09OTkVDVElPTl9TVEFURV9LRVksICdjb25uZWN0ZWQnKSxcblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0YXN5bmMgcnVuKCkge1xuXHRcdFx0XHR0aGF0LnNob3dNYW5hZ2VPcHRpb25zKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVnaXN0ZXJBY3Rpb24yKGNsYXNzIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdFx0c3VwZXIoe1xuXHRcdFx0XHRcdGlkOiBSZW1vdGVUdW5uZWxDb21tYW5kSWRzLmNvbm5lY3RpbmcsXG5cdFx0XHRcdFx0dGl0bGU6IGxvY2FsaXplKCdyZW1vdGVUdW5uZWwuYWN0aW9ucy5tYW5hZ2UuY29ubmVjdGluZycsICdSZW1vdGUgVHVubmVsIEFjY2VzcyBpcyBDb25uZWN0aW5nJyksXG5cdFx0XHRcdFx0Y2F0ZWdvcnk6IFJFTU9URV9UVU5ORUxfQ0FURUdPUlksXG5cdFx0XHRcdFx0bWVudTogW3tcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuQWNjb3VudHNDb250ZXh0LFxuXHRcdFx0XHRcdFx0Z3JvdXA6ICcyX3JlbW90ZVR1bm5lbCcsXG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5lcXVhbHMoUkVNT1RFX1RVTk5FTF9DT05ORUNUSU9OX1NUQVRFX0tFWSwgJ2Nvbm5lY3RpbmcnKSxcblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0YXN5bmMgcnVuKCkge1xuXHRcdFx0XHR0aGF0LnNob3dNYW5hZ2VPcHRpb25zKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6IFJlbW90ZVR1bm5lbENvbW1hbmRJZHMudHVybk9mZixcblx0XHRcdFx0XHR0aXRsZTogUmVtb3RlVHVubmVsQ29tbWFuZExhYmVscy50dXJuT2ZmLFxuXHRcdFx0XHRcdGNhdGVnb3J5OiBSRU1PVEVfVFVOTkVMX0NBVEVHT1JZLFxuXHRcdFx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIubm90RXF1YWxzKFJFTU9URV9UVU5ORUxfQ09OTkVDVElPTl9TVEFURV9LRVksICdkaXNjb25uZWN0ZWQnKSxcblx0XHRcdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLm5vdEVxdWFscyhSRU1PVEVfVFVOTkVMX0NPTk5FQ1RJT05fU1RBVEVfS0VZLCAnJyksXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdGFzeW5jIHJ1bigpIHtcblx0XHRcdFx0Y29uc3QgbWVzc2FnZSA9XG5cdFx0XHRcdFx0dGhhdC5jb25uZWN0aW9uSW5mbz8uaXNBdHRhY2hlZCA/XG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgncmVtb3RlVHVubmVsLnR1cm5PZmZBdHRhY2hlZC5jb25maXJtJywgJ0RvIHlvdSB3YW50IHRvIHR1cm4gb2ZmIFJlbW90ZSBUdW5uZWwgQWNjZXNzPyBUaGlzIHdpbGwgYWxzbyBzdG9wIHRoZSBzZXJ2aWNlIHRoYXQgd2FzIHN0YXJ0ZWQgZXh0ZXJuYWxseS4nKSA6XG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgncmVtb3RlVHVubmVsLnR1cm5PZmYuY29uZmlybScsICdEbyB5b3Ugd2FudCB0byB0dXJuIG9mZiBSZW1vdGUgVHVubmVsIEFjY2Vzcz8nKTtcblxuXHRcdFx0XHRjb25zdCB7IGNvbmZpcm1lZCB9ID0gYXdhaXQgdGhhdC5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oeyBtZXNzYWdlIH0pO1xuXHRcdFx0XHRpZiAoY29uZmlybWVkKSB7XG5cdFx0XHRcdFx0dGhhdC5yZW1vdGVUdW5uZWxTZXJ2aWNlLnN0b3BUdW5uZWwoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogUmVtb3RlVHVubmVsQ29tbWFuZElkcy5zaG93TG9nLFxuXHRcdFx0XHRcdHRpdGxlOiBSZW1vdGVUdW5uZWxDb21tYW5kTGFiZWxzLnNob3dMb2csXG5cdFx0XHRcdFx0Y2F0ZWdvcnk6IFJFTU9URV9UVU5ORUxfQ0FURUdPUlksXG5cdFx0XHRcdFx0bWVudTogW3tcblx0XHRcdFx0XHRcdGlkOiBNZW51SWQuQ29tbWFuZFBhbGV0dGUsXG5cdFx0XHRcdFx0XHR3aGVuOiBDb250ZXh0S2V5RXhwci5ub3RFcXVhbHMoUkVNT1RFX1RVTk5FTF9DT05ORUNUSU9OX1NUQVRFX0tFWSwgJycpLFxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHRhc3luYyBydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRcdFx0Y29uc3Qgb3V0cHV0U2VydmljZSA9IGFjY2Vzc29yLmdldChJT3V0cHV0U2VydmljZSk7XG5cdFx0XHRcdG91dHB1dFNlcnZpY2Uuc2hvd0NoYW5uZWwoTE9HX0lEKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6IFJlbW90ZVR1bm5lbENvbW1hbmRJZHMuY29uZmlndXJlLFxuXHRcdFx0XHRcdHRpdGxlOiBSZW1vdGVUdW5uZWxDb21tYW5kTGFiZWxzLmNvbmZpZ3VyZSxcblx0XHRcdFx0XHRjYXRlZ29yeTogUkVNT1RFX1RVTk5FTF9DQVRFR09SWSxcblx0XHRcdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLm5vdEVxdWFscyhSRU1PVEVfVFVOTkVMX0NPTk5FQ1RJT05fU1RBVEVfS0VZLCAnJyksXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdFx0XHRjb25zdCBwcmVmZXJlbmNlc1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVByZWZlcmVuY2VzU2VydmljZSk7XG5cdFx0XHRcdHByZWZlcmVuY2VzU2VydmljZS5vcGVuU2V0dGluZ3MoeyBxdWVyeTogQ09ORklHVVJBVElPTl9LRVlfUFJFRklYIH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHtcblx0XHRcdFx0XHRpZDogUmVtb3RlVHVubmVsQ29tbWFuZElkcy5jb3B5VG9DbGlwYm9hcmQsXG5cdFx0XHRcdFx0dGl0bGU6IFJlbW90ZVR1bm5lbENvbW1hbmRMYWJlbHMuY29weVRvQ2xpcGJvYXJkLFxuXHRcdFx0XHRcdGNhdGVnb3J5OiBSRU1PVEVfVFVOTkVMX0NBVEVHT1JZLFxuXHRcdFx0XHRcdHByZWNvbmRpdGlvbjogQ29udGV4dEtleUV4cHIuZXF1YWxzKFJFTU9URV9UVU5ORUxfQ09OTkVDVElPTl9TVEFURV9LRVksICdjb25uZWN0ZWQnKSxcblx0XHRcdFx0XHRtZW51OiBbe1xuXHRcdFx0XHRcdFx0aWQ6IE1lbnVJZC5Db21tYW5kUGFsZXR0ZSxcblx0XHRcdFx0XHRcdHdoZW46IENvbnRleHRLZXlFeHByLmVxdWFscyhSRU1PVEVfVFVOTkVMX0NPTk5FQ1RJT05fU1RBVEVfS0VZLCAnY29ubmVjdGVkJyksXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdGFzeW5jIHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdFx0XHRjb25zdCBjbGlwYm9hcmRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElDbGlwYm9hcmRTZXJ2aWNlKTtcblx0XHRcdFx0aWYgKHRoYXQuY29ubmVjdGlvbkluZm8pIHtcblx0XHRcdFx0XHRjb25zdCBsaW5rVG9PcGVuID0gdGhhdC5nZXRMaW5rVG9PcGVuKHRoYXQuY29ubmVjdGlvbkluZm8pO1xuXHRcdFx0XHRcdGNsaXBib2FyZFNlcnZpY2Uud3JpdGVUZXh0KGxpbmtUb09wZW4udG9TdHJpbmcodHJ1ZSkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihyZWdpc3RlckFjdGlvbjIoY2xhc3MgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcih7XG5cdFx0XHRcdFx0aWQ6IFJlbW90ZVR1bm5lbENvbW1hbmRJZHMubGVhcm5Nb3JlLFxuXHRcdFx0XHRcdHRpdGxlOiBSZW1vdGVUdW5uZWxDb21tYW5kTGFiZWxzLmxlYXJuTW9yZSxcblx0XHRcdFx0XHRjYXRlZ29yeTogUkVNT1RFX1RVTk5FTF9DQVRFR09SWSxcblx0XHRcdFx0XHRtZW51OiBbXVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblxuXHRcdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKSB7XG5cdFx0XHRcdGNvbnN0IG9wZW5lclNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU9wZW5lclNlcnZpY2UpO1xuXHRcdFx0XHRhd2FpdCBvcGVuZXJTZXJ2aWNlLm9wZW4oJ2h0dHBzOi8vYWthLm1zL3ZzY29kZS1zZXJ2ZXItZG9jJyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRMaW5rVG9PcGVuKGNvbm5lY3Rpb25JbmZvOiBDb25uZWN0aW9uSW5mbyk6IFVSSSB7XG5cdFx0Y29uc3Qgd29ya3NwYWNlID0gdGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKTtcblx0XHRjb25zdCBmb2xkZXJzID0gd29ya3NwYWNlLmZvbGRlcnM7XG5cdFx0bGV0IHJlc291cmNlO1xuXHRcdGlmIChmb2xkZXJzLmxlbmd0aCA9PT0gMSkge1xuXHRcdFx0cmVzb3VyY2UgPSBmb2xkZXJzWzBdLnVyaTtcblx0XHR9IGVsc2UgaWYgKHdvcmtzcGFjZS5jb25maWd1cmF0aW9uICYmICFpc1VudGl0bGVkV29ya3NwYWNlKHdvcmtzcGFjZS5jb25maWd1cmF0aW9uLCB0aGlzLmVudmlyb25tZW50U2VydmljZSkpIHtcblx0XHRcdHJlc291cmNlID0gd29ya3NwYWNlLmNvbmZpZ3VyYXRpb247XG5cdFx0fVxuXHRcdGNvbnN0IGxpbmsgPSBVUkkucGFyc2UoY29ubmVjdGlvbkluZm8ubGluayk7XG5cdFx0aWYgKHJlc291cmNlPy5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSkge1xuXHRcdFx0cmV0dXJuIGpvaW5QYXRoKGxpbmssIHJlc291cmNlLnBhdGgpO1xuXHRcdH1cblx0XHRyZXR1cm4gam9pblBhdGgobGluaywgdGhpcy5lbnZpcm9ubWVudFNlcnZpY2UudXNlckhvbWUucGF0aCk7XG5cdH1cblxuXG5cdHByaXZhdGUgYXN5bmMgc2hvd01hbmFnZU9wdGlvbnMoKSB7XG5cdFx0Y29uc3QgYWNjb3VudCA9IGF3YWl0IHRoaXMucmVtb3RlVHVubmVsU2VydmljZS5nZXRNb2RlKCk7XG5cblx0XHRyZXR1cm4gbmV3IFByb21pc2U8dm9pZD4oKGMsIGUpID0+IHtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0Y29uc3QgcXVpY2tQaWNrID0gdGhpcy5xdWlja0lucHV0U2VydmljZS5jcmVhdGVRdWlja1BpY2soeyB1c2VTZXBhcmF0b3JzOiB0cnVlIH0pO1xuXHRcdFx0cXVpY2tQaWNrLnBsYWNlaG9sZGVyID0gbG9jYWxpemUoJ21hbmFnZS5wbGFjZWhvbGRlcicsICdTZWxlY3QgYSBjb21tYW5kIHRvIGludm9rZScpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrUGljayk7XG5cdFx0XHRjb25zdCBpdGVtczogQXJyYXk8UXVpY2tQaWNrSXRlbT4gPSBbXTtcblx0XHRcdGl0ZW1zLnB1c2goeyBpZDogUmVtb3RlVHVubmVsQ29tbWFuZElkcy5sZWFybk1vcmUsIGxhYmVsOiBSZW1vdGVUdW5uZWxDb21tYW5kTGFiZWxzLmxlYXJuTW9yZSB9KTtcblx0XHRcdGlmICh0aGlzLmNvbm5lY3Rpb25JbmZvKSB7XG5cdFx0XHRcdHF1aWNrUGljay50aXRsZSA9XG5cdFx0XHRcdFx0dGhpcy5jb25uZWN0aW9uSW5mby5pc0F0dGFjaGVkID9cblx0XHRcdFx0XHRcdGxvY2FsaXplKHsga2V5OiAnbWFuYWdlLnRpdGxlLmF0dGFjaGVkJywgY29tbWVudDogWyd7MH0gaXMgdGhlIHR1bm5lbCBuYW1lJ10gfSwgJ1JlbW90ZSBUdW5uZWwgQWNjZXNzIGVuYWJsZWQgZm9yIHswfSAobGF1bmNoZWQgZXh0ZXJuYWxseSknLCB0aGlzLmNvbm5lY3Rpb25JbmZvLnR1bm5lbE5hbWUpIDpcblx0XHRcdFx0XHRcdGxvY2FsaXplKHsga2V5OiAnbWFuYWdlLnRpdGxlLm9ydW5uaW5nJywgY29tbWVudDogWyd7MH0gaXMgdGhlIHR1bm5lbCBuYW1lJ10gfSwgJ1JlbW90ZSBUdW5uZWwgQWNjZXNzIGVuYWJsZWQgZm9yIHswfScsIHRoaXMuY29ubmVjdGlvbkluZm8udHVubmVsTmFtZSk7XG5cblx0XHRcdFx0aXRlbXMucHVzaCh7IGlkOiBSZW1vdGVUdW5uZWxDb21tYW5kSWRzLmNvcHlUb0NsaXBib2FyZCwgbGFiZWw6IFJlbW90ZVR1bm5lbENvbW1hbmRMYWJlbHMuY29weVRvQ2xpcGJvYXJkLCBkZXNjcmlwdGlvbjogdGhpcy5jb25uZWN0aW9uSW5mby5kb21haW4gfSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRxdWlja1BpY2sudGl0bGUgPSBsb2NhbGl6ZSgnbWFuYWdlLnRpdGxlLm9mZicsICdSZW1vdGUgVHVubmVsIEFjY2VzcyBub3QgZW5hYmxlZCcpO1xuXHRcdFx0fVxuXHRcdFx0aXRlbXMucHVzaCh7IGlkOiBSZW1vdGVUdW5uZWxDb21tYW5kSWRzLnNob3dMb2csIGxhYmVsOiBsb2NhbGl6ZSgnbWFuYWdlLnNob3dMb2cnLCAnU2hvdyBMb2cnKSB9KTtcblx0XHRcdGl0ZW1zLnB1c2goeyB0eXBlOiAnc2VwYXJhdG9yJyB9KTtcblx0XHRcdGl0ZW1zLnB1c2goeyBpZDogUmVtb3RlVHVubmVsQ29tbWFuZElkcy5jb25maWd1cmUsIGxhYmVsOiBsb2NhbGl6ZSgnbWFuYWdlLnR1bm5lbE5hbWUnLCAnQ2hhbmdlIFR1bm5lbCBOYW1lJyksIGRlc2NyaXB0aW9uOiB0aGlzLmNvbm5lY3Rpb25JbmZvPy50dW5uZWxOYW1lIH0pO1xuXHRcdFx0aXRlbXMucHVzaCh7IGlkOiBSZW1vdGVUdW5uZWxDb21tYW5kSWRzLnR1cm5PZmYsIGxhYmVsOiBSZW1vdGVUdW5uZWxDb21tYW5kTGFiZWxzLnR1cm5PZmYsIGRlc2NyaXB0aW9uOiBhY2NvdW50LmFjdGl2ZSA/IGAke2FjY291bnQuc2Vzc2lvbi5hY2NvdW50TGFiZWx9ICgke2FjY291bnQuc2Vzc2lvbi5wcm92aWRlcklkfSlgIDogdW5kZWZpbmVkIH0pO1xuXG5cdFx0XHRxdWlja1BpY2suaXRlbXMgPSBpdGVtcztcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChxdWlja1BpY2sub25EaWRBY2NlcHQoKCkgPT4ge1xuXHRcdFx0XHRpZiAocXVpY2tQaWNrLnNlbGVjdGVkSXRlbXNbMF0gJiYgcXVpY2tQaWNrLnNlbGVjdGVkSXRlbXNbMF0uaWQpIHtcblx0XHRcdFx0XHR0aGlzLmNvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKHF1aWNrUGljay5zZWxlY3RlZEl0ZW1zWzBdLmlkKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRxdWlja1BpY2suaGlkZSgpO1xuXHRcdFx0fSkpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHF1aWNrUGljay5vbkRpZEhpZGUoKCkgPT4ge1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0XHRcdGMoKTtcblx0XHRcdH0pKTtcblx0XHRcdHF1aWNrUGljay5zaG93KCk7XG5cdFx0fSk7XG5cdH1cbn1cblxuXG5jb25zdCB3b3JrYmVuY2hSZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnk+KFdvcmtiZW5jaEV4dGVuc2lvbnMuV29ya2JlbmNoKTtcbndvcmtiZW5jaFJlZ2lzdHJ5LnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uKFJlbW90ZVR1bm5lbFdvcmtiZW5jaENvbnRyaWJ1dGlvbiwgTGlmZWN5Y2xlUGhhc2UuUmVzdG9yZWQpO1xuXG5SZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihDb25maWd1cmF0aW9uRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHR0eXBlOiAnb2JqZWN0Jyxcblx0cHJvcGVydGllczoge1xuXHRcdFtDT05GSUdVUkFUSU9OX0tFWV9IT1NUX05BTUVdOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3JlbW90ZVR1bm5lbEFjY2Vzcy5tYWNoaW5lTmFtZScsIFwiVGhlIG5hbWUgdW5kZXIgd2hpY2ggdGhlIHJlbW90ZSB0dW5uZWwgYWNjZXNzIGlzIHJlZ2lzdGVyZWQuIElmIG5vdCBzZXQsIHRoZSBob3N0IG5hbWUgaXMgdXNlZC5cIiksXG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT04sXG5cdFx0XHRpZ25vcmVTeW5jOiB0cnVlLFxuXHRcdFx0cGF0dGVybjogJ14oXFxcXHdbXFxcXHctXSopPyQnLFxuXHRcdFx0cGF0dGVybkVycm9yTWVzc2FnZTogbG9jYWxpemUoJ3JlbW90ZVR1bm5lbEFjY2Vzcy5tYWNoaW5lTmFtZVJlZ2V4JywgXCJUaGUgbmFtZSBtdXN0IG9ubHkgY29uc2lzdCBvZiBsZXR0ZXJzLCBudW1iZXJzLCB1bmRlcnNjb3JlIGFuZCBkYXNoLiBJdCBtdXN0IG5vdCBzdGFydCB3aXRoIGEgZGFzaC5cIiksXG5cdFx0XHRtYXhMZW5ndGg6IDIwLFxuXHRcdFx0ZGVmYXVsdDogJydcblx0XHR9LFxuXHRcdFtDT05GSUdVUkFUSU9OX0tFWV9QUkVWRU5UX1NMRUVQXToge1xuXHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdyZW1vdGVUdW5uZWxBY2Nlc3MucHJldmVudFNsZWVwJywgXCJQcmV2ZW50IHRoaXMgY29tcHV0ZXIgZnJvbSBzbGVlcGluZyB3aGVuIHJlbW90ZSB0dW5uZWwgYWNjZXNzIGlzIHR1cm5lZCBvbi5cIiksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRzY29wZTogQ29uZmlndXJhdGlvblNjb3BlLkFQUExJQ0FUSU9OLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2UsXG5cdFx0fVxuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsWUFBWSx1QkFBdUI7QUFDNUMsU0FBUyxlQUFlO0FBRXhCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsVUFBVSxVQUFVLGdCQUFnQjtBQUM3QyxTQUFTLFdBQVc7QUFDcEIs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RjtBQUNEO0FBbHNCYSxvQ0FBTjtBQUFBLEVBYUo7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0ExQlU7QUFxc0JiLE1BQU0sb0JBQW9CLFNBQVMsR0FBb0Msb0JBQW9CLFNBQVM7QUFDcEcsa0JBQWtCLDhCQUE4QixtQ0FBbUMsZUFBZSxRQUFRO0FBRTFHLFNBQVMsR0FBMkIsd0JBQXdCLGFBQWEsRUFBRSxzQkFBc0I7QUFBQSxFQUNoRyxNQUFNO0FBQUEsRUFDTixZQUFZO0FBQUEsSUFDWCxDQUFDLDJCQUEyQixHQUFHO0FBQUEsTUFDOUIsYUFBYSxTQUFTLGtDQUFrQyxpR0FBaUc7QUFBQSxNQUN6SixNQUFNO0FBQUEsTUFDTixPQUFPLG1CQUFtQjtBQUFBLE1BQzFCLFlBQVk7QUFBQSxNQUNaLFNBQVM7QUFBQSxNQUNULHFCQUFxQixTQUFTLHVDQUF1QyxxR0FBcUc7QUFBQSxNQUMxSyxXQUFXO0FBQUEsTUFDWCxTQUFTO0FBQUEsSUFDVjtBQUFBLElBQ0EsQ0FBQywrQkFBK0IsR0FBRztBQUFBLE1BQ2xDLGFBQWEsU0FBUyxtQ0FBbUMsNkVBQTZFO0FBQUEsTUFDdEksTUFBTTtBQUFBLE1BQ04sT0FBTyxtQkFBbUI7QUFBQSxNQUMxQixTQUFTO0FBQUEsSUFDVjtBQUFBLEVBQ0Q7QUFDRCxDQUFDOyIsCiAgIm5hbWVzIjogWyJSZW1vdGVUdW5uZWxDb21tYW5kSWRzIiwgIlJlbW90ZVR1bm5lbENvbW1hbmRMYWJlbHMiLCAic3RhdHVzIl0KfQo=
