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
import { DisposableStore, Disposable, MutableDisposable, combinedDisposable } from "../../../base/common/lifecycle.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { URI } from "../../../base/common/uri.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { ProcessPropertyType, TerminalExitReason, TerminalLocation } from "../../../platform/terminal/common/terminal.js";
import { TerminalDataBufferer } from "../../../platform/terminal/common/terminalDataBuffering.js";
import { ITerminalEditorService, ITerminalGroupService, ITerminalService } from "../../contrib/terminal/browser/terminal.js";
import { TerminalProcessExtHostProxy } from "../../contrib/terminal/browser/terminalProcessExtHostProxy.js";
import { IEnvironmentVariableService } from "../../contrib/terminal/common/environmentVariable.js";
import { deserializeEnvironmentDescriptionMap, deserializeEnvironmentVariableCollection, serializeEnvironmentVariableCollection } from "../../../platform/terminal/common/environmentVariableShared.js";
import { ITerminalProfileResolverService, ITerminalProfileService } from "../../contrib/terminal/common/terminal.js";
import { IRemoteAgentService } from "../../services/remote/common/remoteAgentService.js";
import { OS } from "../../../base/common/platform.js";
import { Promises } from "../../../base/common/async.js";
import { ITerminalLinkProviderService } from "../../contrib/terminalContrib/links/browser/links.js";
import { ITerminalQuickFixService, TerminalQuickFixType } from "../../contrib/terminalContrib/quickFix/browser/quickFix.js";
import { TerminalCapability } from "../../../platform/terminal/common/capabilities/capabilities.js";
import { ITerminalCompletionService } from "../../contrib/terminalContrib/suggest/browser/terminalCompletionService.js";
let MainThreadTerminalService = class {
  constructor(_extHostContext, _terminalService, _terminalLinkProviderService, _terminalQuickFixService, _instantiationService, _environmentVariableService, _logService, _terminalProfileResolverService, remoteAgentService, _terminalGroupService, _terminalEditorService, _terminalProfileService, _terminalCompletionService) {
    this._extHostContext = _extHostContext;
    this._terminalService = _terminalService;
    this._terminalLinkProviderService = _terminalLinkProviderService;
    this._terminalQuickFixService = _terminalQuickFixService;
    this._instantiationService = _instantiationService;
    this._environmentVariableService = _environmentVariableService;
    this._logService = _logService;
    this._terminalProfileResolverService = _terminalProfileResolverService;
    this._terminalGroupService = _terminalGroupService;
    this._terminalEditorService = _terminalEditorService;
    this._terminalProfileService = _terminalProfileService;
    this._terminalCompletionService = _terminalCompletionService;
    this._store = new DisposableStore();
    /**
     * Stores a map from a temporary terminal id (a UUID generated on the extension host side)
     * to a numeric terminal id (an id generated on the renderer side)
     * This comes in play only when dealing with terminals created on the extension host side
     */
    this._extHostTerminals = /* @__PURE__ */ new Map();
    this._terminalProcessProxies = /* @__PURE__ */ new Map();
    this._profileProviders = /* @__PURE__ */ new Map();
    this._completionProviders = /* @__PURE__ */ new Map();
    this._quickFixProviders = /* @__PURE__ */ new Map();
    this._dataEventTracker = new MutableDisposable();
    this._sendCommandEventListener = new MutableDisposable();
    /**
     * A single shared terminal link provider for the exthost. When an ext registers a link
     * provider, this is registered with the terminal on the renderer side and all links are
     * provided through this, even from multiple ext link providers. Xterm should remove lower
     * priority intersecting links itself.
     */
    this._linkProvider = this._store.add(new MutableDisposable());
    this._os = OS;
    this._proxy = _extHostContext.getProxy(ExtHostContext.ExtHostTerminalService);
    this._store.add(_terminalService.onDidCreateInstance((instance) => {
      this._onTerminalOpened(instance);
      this._onInstanceDimensionsChanged(instance);
    }));
    this._store.add(_terminalService.onDidDisposeInstance((instance) => this._onTerminalDisposed(instance)));
    this._store.add(_terminalService.onAnyInstanceProcessIdReady((instance) => this._onTerminalProcessIdReady(instance)));
    this._store.add(_terminalService.onDidChangeInstanceDimensions((instance) => this._onInstanceDimensionsChanged(instance)));
    this._store.add(_terminalService.onAnyInstanceMaximumDimensionsChange((instance) => this._onInstanceMaximumDimensionsChanged(instance)));
    this._store.add(_terminalService.onDidRequestStartExtensionTerminal((e) => this._onRequestStartExtensionTerminal(e)));
    this._store.add(_terminalService.onDidChangeActiveInstance((instance) => this._onActiveTerminalChanged(instance ? instance.instanceId : null)));
    this._store.add(_terminalService.onAnyInstanceTitleChange((instance) => instance && this._onTitleChanged(instance.instanceId, instance.title)));
    this._store.add(_terminalService.onAnyInstanceDataInput((instance) => this._proxy.$acceptTerminalInteraction(instance.instanceId)));
    this._store.add(_terminalService.onAnyInstanceSelectionChange((instance) => this._proxy.$acceptTerminalSelection(instance.instanceId, instance.selection)));
    this._store.add(_terminalService.onAnyInstanceShellTypeChanged((instance) => this._onShellTypeChanged(instance.instanceId)));
    for (const instance of this._terminalService.instances) {
      this._onTerminalOpened(instance);
      instance.processReady.then(() => this._onTerminalProcessIdReady(instance));
      if (instance.shellType) {
        this._proxy.$acceptTerminalShellType(instance.instanceId, instance.shellType);
      }
    }
    const activeInstance = this._terminalService.activeInstance;
    if (activeInstance) {
      this._proxy.$acceptActiveTerminalChanged(activeInstance.instanceId);
    }
    if (this._environmentVariableService.collections.size > 0) {
      const collectionAsArray = [...this._environmentVariableService.collections.entries()];
      const serializedCollections = collectionAsArray.map((e) => {
        return [e[0], serializeEnvironmentVariableCollection(e[1].map)];
      });
      this._proxy.$initEnvironmentVariableCollections(serializedCollections);
    }
    remoteAgentService.getEnvironment().then(async (env) => {
      this._os = env?.os || OS;
      this._updateDefaultProfile();
    });
    this._store.add(this._terminalProfileService.onDidChangeAvailableProfiles(() => this._updateDefaultProfile()));
  }
  dispose() {
    this._store.dispose();
    for (const provider of this._profileProviders.values()) {
      provider.dispose();
    }
    for (const provider of this._quickFixProviders.values()) {
      provider.dispose();
    }
  }
  async _updateDefaultProfile() {
    const remoteAuthority = this._extHostContext.remoteAuthority ?? void 0;
    const defaultProfile = this._terminalProfileResolverService.getDefaultProfile({ remoteAuthority, os: this._os });
    const defaultAutomationProfile = this._terminalProfileResolverService.getDefaultProfile({ remoteAuthority, os: this._os, allowAutomationShell: true });
    this._proxy.$acceptDefaultProfile(...await Promise.all([defaultProfile, defaultAutomationProfile]));
  }
  async _getTerminalInstance(id) {
    if (typeof id === "string") {
      return this._extHostTerminals.get(id);
    }
    return this._terminalService.getInstanceFromId(id);
  }
  async $createTerminal(extHostTerminalId, launchConfig) {
    const shellLaunchConfig = {
      name: launchConfig.name,
      executable: launchConfig.shellPath,
      args: launchConfig.shellArgs,
      cwd: typeof launchConfig.cwd === "string" ? launchConfig.cwd : URI.revive(launchConfig.cwd),
      icon: launchConfig.icon,
      color: launchConfig.color,
      initialText: launchConfig.initialText,
      waitOnExit: launchConfig.waitOnExit,
      ignoreConfigurationCwd: true,
      env: launchConfig.env,
      strictEnv: launchConfig.strictEnv,
      hideFromUser: launchConfig.hideFromUser,
      customPtyImplementation: launchConfig.isExtensionCustomPtyTerminal ? (id, cols, rows) => new TerminalProcessExtHostProxy(id, cols, rows, this._terminalService) : void 0,
      extHostTerminalId,
      forceShellIntegration: launchConfig.forceShellIntegration,
      isFeatureTerminal: launchConfig.isFeatureTerminal,
      isExtensionOwnedTerminal: launchConfig.isExtensionOwnedTerminal,
      useShellEnvironment: launchConfig.useShellEnvironment,
      isTransient: launchConfig.isTransient
    };
    const terminal = Promises.withAsyncBody(async (r) => {
      const terminal2 = await this._terminalService.createTerminal({
        config: shellLaunchConfig,
        location: await this._deserializeParentTerminal(launchConfig.location)
      });
      r(terminal2);
    });
    this._extHostTerminals.set(extHostTerminalId, terminal);
    const terminalInstance = await terminal;
    this._store.add(terminalInstance.onDisposed(() => {
      this._extHostTerminals.delete(extHostTerminalId);
    }));
  }
  async _deserializeParentTerminal(location) {
    if (typeof location === "object" && "parentTerminal" in location) {
      const parentTerminal = await this._extHostTerminals.get(location.parentTerminal.toString());
      return parentTerminal ? { parentTerminal } : void 0;
    }
    return location;
  }
  async $show(id, preserveFocus) {
    const terminalInstance = await this._getTerminalInstance(id);
    if (terminalInstance) {
      this._terminalService.setActiveInstance(terminalInstance);
      if (terminalInstance.target === TerminalLocation.Editor) {
        await this._terminalEditorService.revealActiveEditor(preserveFocus);
      } else {
        await this._terminalGroupService.showPanel(!preserveFocus);
      }
    }
  }
  async $hide(id) {
    const instanceToHide = await this._getTerminalInstance(id);
    const activeInstance = this._terminalService.activeInstance;
    if (activeInstance && activeInstance.instanceId === instanceToHide?.instanceId && activeInstance.target !== TerminalLocation.Editor) {
      this._terminalGroupService.hidePanel();
    }
  }
  async $dispose(id) {
    (await this._getTerminalInstance(id))?.dispose(TerminalExitReason.Extension);
  }
  async $sendText(id, text, shouldExecute) {
    const instance = await this._getTerminalInstance(id);
    await instance?.sendText(text, shouldExecute);
  }
  $sendProcessExit(terminalId, exitCode) {
    this._terminalProcessProxies.get(terminalId)?.emitExit(exitCode);
  }
  $startSendingDataEvents() {
    if (!this._dataEventTracker.value) {
      this._dataEventTracker.value = this._instantiationService.createInstance(TerminalDataEventTracker, (id, data) => {
        this._onTerminalData(id, data);
      });
      for (const instance of this._terminalService.instances) {
        for (const data of instance.initialDataEvents || []) {
          this._onTerminalData(instance.instanceId, data);
        }
      }
    }
  }
  $stopSendingDataEvents() {
    this._dataEventTracker.clear();
  }
  $startSendingCommandEvents() {
    if (this._sendCommandEventListener.value) {
      return;
    }
    const multiplexer = this._terminalService.createOnInstanceCapabilityEvent(TerminalCapability.CommandDetection, (capability) => capability.onCommandFinished);
    const sub = multiplexer.event((e) => {
      this._onDidExecuteCommand(e.instance.instanceId, {
        commandLine: e.data.command,
        // TODO: Convert to URI if possible
        cwd: e.data.cwd,
        exitCode: e.data.exitCode,
        output: e.data.getOutput()
      });
    });
    this._sendCommandEventListener.value = combinedDisposable(multiplexer, sub);
  }
  $stopSendingCommandEvents() {
    this._sendCommandEventListener.clear();
  }
  $startLinkProvider() {
    this._linkProvider.value = this._terminalLinkProviderService.registerLinkProvider(new ExtensionTerminalLinkProvider(this._proxy));
  }
  $stopLinkProvider() {
    this._linkProvider.clear();
  }
  $registerProcessSupport(isSupported) {
    this._terminalService.registerProcessSupport(isSupported);
  }
  $registerCompletionProvider(id, extensionIdentifier, ...triggerCharacters) {
    this._completionProviders.set(id, this._terminalCompletionService.registerTerminalCompletionProvider(extensionIdentifier, id, {
      id,
      provideCompletions: async (commandLine, cursorPosition, allowFallbackCompletions, token) => {
        const completions = await this._proxy.$provideTerminalCompletions(id, { commandLine, cursorPosition, allowFallbackCompletions }, token);
        return {
          items: completions?.items.map((c) => ({ ...c, provider: id })),
          resourceRequestConfig: completions?.resourceRequestConfig
        };
      }
    }, ...triggerCharacters));
  }
  $unregisterCompletionProvider(id) {
    this._completionProviders.get(id)?.dispose();
    this._completionProviders.delete(id);
  }
  $registerProfileProvider(id, extensionIdentifier) {
    this._profileProviders.set(id, this._terminalProfileService.registerTerminalProfileProvider(extensionIdentifier, id, {
      createContributedTerminalProfile: async (options) => {
        return this._proxy.$createContributedProfileTerminal(id, options);
      }
    }));
  }
  $unregisterProfileProvider(id) {
    this._profileProviders.get(id)?.dispose();
    this._profileProviders.delete(id);
  }
  async $registerQuickFixProvider(id, extensionId) {
    this._quickFixProviders.set(id, this._terminalQuickFixService.registerQuickFixProvider(id, {
      provideTerminalQuickFixes: async (terminalCommand, lines, options, token) => {
        if (token.isCancellationRequested) {
          return;
        }
        if (options.outputMatcher?.length && options.outputMatcher.length > 40) {
          options.outputMatcher.length = 40;
          this._logService.warn("Cannot exceed output matcher length of 40");
        }
        const commandLineMatch = terminalCommand.command.match(options.commandLineMatcher);
        if (!commandLineMatch || !lines) {
          return;
        }
        const outputMatcher = options.outputMatcher;
        let outputMatch;
        if (outputMatcher) {
          outputMatch = getOutputMatchForLines(lines, outputMatcher);
        }
        if (!outputMatch) {
          return;
        }
        const matchResult = { commandLineMatch, outputMatch, commandLine: terminalCommand.command };
        if (matchResult) {
          const result = await this._proxy.$provideTerminalQuickFixes(id, matchResult, token);
          if (result && Array.isArray(result)) {
            return result.map((r) => parseQuickFix(id, extensionId, r));
          } else if (result) {
            return parseQuickFix(id, extensionId, result);
          }
        }
        return;
      }
    }));
  }
  $unregisterQuickFixProvider(id) {
    this._quickFixProviders.get(id)?.dispose();
    this._quickFixProviders.delete(id);
  }
  _onActiveTerminalChanged(terminalId) {
    this._proxy.$acceptActiveTerminalChanged(terminalId);
  }
  _onTerminalData(terminalId, data) {
    this._proxy.$acceptTerminalProcessData(terminalId, data);
  }
  _onDidExecuteCommand(terminalId, command) {
    this._proxy.$acceptDidExecuteCommand(terminalId, command);
  }
  _onTitleChanged(terminalId, name) {
    this._proxy.$acceptTerminalTitleChange(terminalId, name);
  }
  _onShellTypeChanged(terminalId) {
    const terminalInstance = this._terminalService.getInstanceFromId(terminalId);
    if (terminalInstance) {
      this._proxy.$acceptTerminalShellType(terminalId, terminalInstance.shellType);
    }
  }
  _onTerminalDisposed(terminalInstance) {
    this._proxy.$acceptTerminalClosed(terminalInstance.instanceId, terminalInstance.exitCode, terminalInstance.exitReason ?? TerminalExitReason.Unknown);
  }
  _onTerminalOpened(terminalInstance) {
    const extHostTerminalId = terminalInstance.shellLaunchConfig.extHostTerminalId;
    const shellLaunchConfigDto = {
      name: terminalInstance.shellLaunchConfig.name,
      executable: terminalInstance.shellLaunchConfig.executable,
      args: terminalInstance.shellLaunchConfig.args,
      cwd: terminalInstance.shellLaunchConfig.cwd,
      env: terminalInstance.shellLaunchConfig.env,
      hideFromUser: terminalInstance.shellLaunchConfig.hideFromUser,
      tabActions: terminalInstance.shellLaunchConfig.tabActions
    };
    this._proxy.$acceptTerminalOpened(terminalInstance.instanceId, extHostTerminalId, terminalInstance.title, shellLaunchConfigDto);
  }
  _onTerminalProcessIdReady(terminalInstance) {
    if (terminalInstance.processId === void 0) {
      return;
    }
    this._proxy.$acceptTerminalProcessId(terminalInstance.instanceId, terminalInstance.processId);
  }
  _onInstanceDimensionsChanged(instance) {
    this._proxy.$acceptTerminalDimensions(instance.instanceId, instance.cols, instance.rows);
  }
  _onInstanceMaximumDimensionsChanged(instance) {
    this._proxy.$acceptTerminalMaximumDimensions(instance.instanceId, instance.maxCols, instance.maxRows);
  }
  _onRequestStartExtensionTerminal(request) {
    const proxy = request.proxy;
    this._terminalProcessProxies.set(proxy.instanceId, proxy);
    const initialDimensions = request.cols && request.rows ? {
      columns: request.cols,
      rows: request.rows
    } : void 0;
    this._proxy.$startExtensionTerminal(
      proxy.instanceId,
      initialDimensions
    ).then(request.callback);
    proxy.onInput((data) => this._proxy.$acceptProcessInput(proxy.instanceId, data));
    proxy.onShutdown((immediate) => this._proxy.$acceptProcessShutdown(proxy.instanceId, immediate));
    proxy.onRequestCwd(() => this._proxy.$acceptProcessRequestCwd(proxy.instanceId));
    proxy.onRequestInitialCwd(() => this._proxy.$acceptProcessRequestInitialCwd(proxy.instanceId));
  }
  $sendProcessData(terminalId, data) {
    this._terminalProcessProxies.get(terminalId)?.emitData(data);
  }
  $sendProcessReady(terminalId, pid, cwd, windowsPty) {
    this._terminalProcessProxies.get(terminalId)?.emitReady(pid, cwd, windowsPty);
  }
  $sendProcessProperty(terminalId, property) {
    if (property.type === ProcessPropertyType.Title) {
      const instance = this._terminalService.getInstanceFromId(terminalId);
      instance?.rename(property.value);
    }
    this._terminalProcessProxies.get(terminalId)?.emitProcessProperty(property);
  }
  $setEnvironmentVariableCollection(extensionIdentifier, persistent, collection, descriptionMap) {
    if (collection) {
      const translatedCollection = {
        persistent,
        map: deserializeEnvironmentVariableCollection(collection),
        descriptionMap: deserializeEnvironmentDescriptionMap(descriptionMap)
      };
      this._environmentVariableService.set(extensionIdentifier, translatedCollection);
    } else {
      this._environmentVariableService.delete(extensionIdentifier);
    }
  }
};
MainThreadTerminalService = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadTerminalService),
  __decorateParam(1, ITerminalService),
  __decorateParam(2, ITerminalLinkProviderService),
  __decorateParam(3, ITerminalQuickFixService),
  __decorateParam(4, IInstantiationService),
  __decorateParam(5, IEnvironmentVariableService),
  __decorateParam(6, ILogService),
  __decorateParam(7, ITerminalProfileResolverService),
  __decorateParam(8, IRemoteAgentService),
  __decorateParam(9, ITerminalGroupService),
  __decorateParam(10, ITerminalEditorService),
  __decorateParam(11, ITerminalProfileService),
  __decorateParam(12, ITerminalCompletionService)
], MainThreadTerminalService);
let TerminalDataEventTracker = class extends Disposable {
  constructor(_callback, _terminalService) {
    super();
    this._callback = _callback;
    this._terminalService = _terminalService;
    this._register(this._bufferer = new TerminalDataBufferer(this._callback));
    for (const instance of this._terminalService.instances) {
      this._registerInstance(instance);
    }
    this._register(this._terminalService.onDidCreateInstance((instance) => this._registerInstance(instance)));
    this._register(this._terminalService.onDidDisposeInstance((instance) => this._bufferer.stopBuffering(instance.instanceId)));
  }
  _registerInstance(instance) {
    this._register(this._bufferer.startBuffering(instance.instanceId, instance.onData));
  }
};
TerminalDataEventTracker = __decorateClass([
  __decorateParam(1, ITerminalService)
], TerminalDataEventTracker);
class ExtensionTerminalLinkProvider {
  constructor(_proxy) {
    this._proxy = _proxy;
  }
  async provideLinks(instance, line) {
    const proxy = this._proxy;
    const extHostLinks = await proxy.$provideLinks(instance.instanceId, line);
    return extHostLinks.map((dto) => ({
      id: dto.id,
      startIndex: dto.startIndex,
      length: dto.length,
      label: dto.label,
      activate: () => proxy.$activateLink(instance.instanceId, dto.id)
    }));
  }
}
function getOutputMatchForLines(lines, outputMatcher) {
  const match = lines.join("\n").match(outputMatcher.lineMatcher);
  return match ? { regexMatch: match, outputLines: lines } : void 0;
}
function parseQuickFix(id, source, fix) {
  let type = TerminalQuickFixType.TerminalCommand;
  if ("uri" in fix) {
    fix.uri = URI.revive(fix.uri);
    type = TerminalQuickFixType.Opener;
  } else if ("id" in fix) {
    type = TerminalQuickFixType.VscodeCommand;
  }
  return { id, type, source, ...fix };
}
export {
  MainThreadTerminalService,
  getOutputMatchForLines
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZFRlcm1pbmFsU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlLCBjb21iaW5lZERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgRXh0SG9zdENvbnRleHQsIEV4dEhvc3RUZXJtaW5hbFNlcnZpY2VTaGFwZSwgTWFpblRocmVhZFRlcm1pbmFsU2VydmljZVNoYXBlLCBNYWluQ29udGV4dCwgVGVybWluYWxMYXVuY2hDb25maWcsIElUZXJtaW5hbERpbWVuc2lvbnNEdG8sIEV4dEhvc3RUZXJtaW5hbElkZW50aWZpZXIsIFRlcm1pbmFsUXVpY2tGaXgsIElUZXJtaW5hbENvbW1hbmREdG8gfSBmcm9tICcuLi9jb21tb24vZXh0SG9zdC5wcm90b2NvbC5qcyc7XG5pbXBvcnQgeyBleHRIb3N0TmFtZWRDdXN0b21lciwgSUV4dEhvc3RDb250ZXh0IH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0SG9zdEN1c3RvbWVycy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElQcm9jZXNzUHJvcGVydHksIElQcm9jZXNzUmVhZHlXaW5kb3dzUHR5LCBJU2hlbGxMYXVuY2hDb25maWcsIElTaGVsbExhdW5jaENvbmZpZ0R0bywgSVRlcm1pbmFsT3V0cHV0TWF0Y2gsIElUZXJtaW5hbE91dHB1dE1hdGNoZXIsIFByb2Nlc3NQcm9wZXJ0eVR5cGUsIFRlcm1pbmFsRXhpdFJlYXNvbiwgVGVybWluYWxMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbERhdGFCdWZmZXJlciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbERhdGFCdWZmZXJpbmcuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsRWRpdG9yU2VydmljZSwgSVRlcm1pbmFsRXh0ZXJuYWxMaW5rUHJvdmlkZXIsIElUZXJtaW5hbEdyb3VwU2VydmljZSwgSVRlcm1pbmFsSW5zdGFuY2UsIElUZXJtaW5hbExpbmssIElUZXJtaW5hbFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb250cmliL3Rlcm1pbmFsL2Jyb3dzZXIvdGVybWluYWwuanMnO1xuaW1wb3J0IHsgVGVybWluYWxQcm9jZXNzRXh0SG9zdFByb3h5IH0gZnJvbSAnLi4vLi4vY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsUHJvY2Vzc0V4dEhvc3RQcm94eS5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRWYXJpYWJsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb250cmliL3Rlcm1pbmFsL2NvbW1vbi9lbnZpcm9ubWVudFZhcmlhYmxlLmpzJztcbmltcG9ydCB7IGRlc2VyaWFsaXplRW52aXJvbm1lbnREZXNjcmlwdGlvbk1hcCwgZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbiwgc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vZW52aXJvbm1lbnRWYXJpYWJsZVNoYXJlZC5qcyc7XG5pbXBvcnQgeyBJU3RhcnRFeHRlbnNpb25UZXJtaW5hbFJlcXVlc3QsIElUZXJtaW5hbFByb2Nlc3NFeHRIb3N0UHJveHksIElUZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UsIElUZXJtaW5hbFByb2ZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29udHJpYi90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL3JlbW90ZS9jb21tb24vcmVtb3RlQWdlbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE9wZXJhdGluZ1N5c3RlbSwgT1MgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbEVkaXRvckxvY2F0aW9uT3B0aW9ucyB9IGZyb20gJ3ZzY29kZSc7XG5pbXBvcnQgeyBQcm9taXNlcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IElTZXJpYWxpemFibGVFbnZpcm9ubWVudERlc2NyaXB0aW9uTWFwLCBJU2VyaWFsaXphYmxlRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vZW52aXJvbm1lbnRWYXJpYWJsZS5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxMaW5rUHJvdmlkZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29udHJpYi90ZXJtaW5hbENvbnRyaWIvbGlua3MvYnJvd3Nlci9saW5rcy5qcyc7XG5pbXBvcnQgeyBJVGVybWluYWxRdWlja0ZpeFNlcnZpY2UsIElUZXJtaW5hbFF1aWNrRml4LCBUZXJtaW5hbFF1aWNrRml4VHlwZSB9IGZyb20gJy4uLy4uL2NvbnRyaWIvdGVybWluYWxDb250cmliL3F1aWNrRml4L2Jyb3dzZXIvcXVpY2tGaXguanMnO1xuaW1wb3J0IHsgVGVybWluYWxDYXBhYmlsaXR5IH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2NhcGFiaWxpdGllcy9jYXBhYmlsaXRpZXMuanMnO1xuaW1wb3J0IHsgSVRlcm1pbmFsQ29tcGxldGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb250cmliL3Rlcm1pbmFsQ29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvdGVybWluYWxDb21wbGV0aW9uU2VydmljZS5qcyc7XG5cbkBleHRIb3N0TmFtZWRDdXN0b21lcihNYWluQ29udGV4dC5NYWluVGhyZWFkVGVybWluYWxTZXJ2aWNlKVxuZXhwb3J0IGNsYXNzIE1haW5UaHJlYWRUZXJtaW5hbFNlcnZpY2UgaW1wbGVtZW50cyBNYWluVGhyZWFkVGVybWluYWxTZXJ2aWNlU2hhcGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3N0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wcm94eTogRXh0SG9zdFRlcm1pbmFsU2VydmljZVNoYXBlO1xuXG5cdC8qKlxuXHQgKiBTdG9yZXMgYSBtYXAgZnJvbSBhIHRlbXBvcmFyeSB0ZXJtaW5hbCBpZCAoYSBVVUlEIGdlbmVyYXRlZCBvbiB0aGUgZXh0ZW5zaW9uIGhvc3Qgc2lkZSlcblx0ICogdG8gYSBudW1lcmljIHRlcm1pbmFsIGlkIChhbiBpZCBnZW5lcmF0ZWQgb24gdGhlIHJlbmRlcmVyIHNpZGUpXG5cdCAqIFRoaXMgY29tZXMgaW4gcGxheSBvbmx5IHdoZW4gZGVhbGluZyB3aXRoIHRlcm1pbmFscyBjcmVhdGVkIG9uIHRoZSBleHRlbnNpb24gaG9zdCBzaWRlXG5cdCAqL1xuXHRwcml2YXRlIHJlYWRvbmx5IF9leHRIb3N0VGVybWluYWxzID0gbmV3IE1hcDxzdHJpbmcsIFByb21pc2U8SVRlcm1pbmFsSW5zdGFuY2U+PigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbFByb2Nlc3NQcm94aWVzID0gbmV3IE1hcDxudW1iZXIsIElUZXJtaW5hbFByb2Nlc3NFeHRIb3N0UHJveHk+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb2ZpbGVQcm92aWRlcnMgPSBuZXcgTWFwPHN0cmluZywgSURpc3Bvc2FibGU+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbXBsZXRpb25Qcm92aWRlcnMgPSBuZXcgTWFwPHN0cmluZywgSURpc3Bvc2FibGU+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3F1aWNrRml4UHJvdmlkZXJzID0gbmV3IE1hcDxzdHJpbmcsIElEaXNwb3NhYmxlPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kYXRhRXZlbnRUcmFja2VyID0gbmV3IE11dGFibGVEaXNwb3NhYmxlPFRlcm1pbmFsRGF0YUV2ZW50VHJhY2tlcj4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfc2VuZENvbW1hbmRFdmVudExpc3RlbmVyID0gbmV3IE11dGFibGVEaXNwb3NhYmxlKCk7XG5cblx0LyoqXG5cdCAqIEEgc2luZ2xlIHNoYXJlZCB0ZXJtaW5hbCBsaW5rIHByb3ZpZGVyIGZvciB0aGUgZXh0aG9zdC4gV2hlbiBhbiBleHQgcmVnaXN0ZXJzIGEgbGlua1xuXHQgKiBwcm92aWRlciwgdGhpcyBpcyByZWdpc3RlcmVkIHdpdGggdGhlIHRlcm1pbmFsIG9uIHRoZSByZW5kZXJlciBzaWRlIGFuZCBhbGwgbGlua3MgYXJlXG5cdCAqIHByb3ZpZGVkIHRocm91Z2ggdGhpcywgZXZlbiBmcm9tIG11bHRpcGxlIGV4dCBsaW5rIHByb3ZpZGVycy4gWHRlcm0gc2hvdWxkIHJlbW92ZSBsb3dlclxuXHQgKiBwcmlvcml0eSBpbnRlcnNlY3RpbmcgbGlua3MgaXRzZWxmLlxuXHQgKi9cblx0cHJpdmF0ZSByZWFkb25seSBfbGlua1Byb3ZpZGVyID0gdGhpcy5fc3RvcmUuYWRkKG5ldyBNdXRhYmxlRGlzcG9zYWJsZSgpKTtcblxuXHRwcml2YXRlIF9vczogT3BlcmF0aW5nU3lzdGVtID0gT1M7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZXh0SG9zdENvbnRleHQ6IElFeHRIb3N0Q29udGV4dCxcblx0XHRASVRlcm1pbmFsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbFNlcnZpY2U6IElUZXJtaW5hbFNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbExpbmtQcm92aWRlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxMaW5rUHJvdmlkZXJTZXJ2aWNlOiBJVGVybWluYWxMaW5rUHJvdmlkZXJTZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxRdWlja0ZpeFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxRdWlja0ZpeFNlcnZpY2U6IElUZXJtaW5hbFF1aWNrRml4U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElFbnZpcm9ubWVudFZhcmlhYmxlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lbnZpcm9ubWVudFZhcmlhYmxlU2VydmljZTogSUVudmlyb25tZW50VmFyaWFibGVTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASVRlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2U6IElUZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UsXG5cdFx0QElSZW1vdGVBZ2VudFNlcnZpY2UgcmVtb3RlQWdlbnRTZXJ2aWNlOiBJUmVtb3RlQWdlbnRTZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxHcm91cFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVybWluYWxHcm91cFNlcnZpY2U6IElUZXJtaW5hbEdyb3VwU2VydmljZSxcblx0XHRASVRlcm1pbmFsRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbEVkaXRvclNlcnZpY2U6IElUZXJtaW5hbEVkaXRvclNlcnZpY2UsXG5cdFx0QElUZXJtaW5hbFByb2ZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsUHJvZmlsZVNlcnZpY2U6IElUZXJtaW5hbFByb2ZpbGVTZXJ2aWNlLFxuXHRcdEBJVGVybWluYWxDb21wbGV0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlOiBJVGVybWluYWxDb21wbGV0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5fcHJveHkgPSBfZXh0SG9zdENvbnRleHQuZ2V0UHJveHkoRXh0SG9zdENvbnRleHQuRXh0SG9zdFRlcm1pbmFsU2VydmljZSk7XG5cblx0XHQvLyBJVGVybWluYWxTZXJ2aWNlIGxpc3RlbmVyc1xuXHRcdHRoaXMuX3N0b3JlLmFkZChfdGVybWluYWxTZXJ2aWNlLm9uRGlkQ3JlYXRlSW5zdGFuY2UoKGluc3RhbmNlKSA9PiB7XG5cdFx0XHR0aGlzLl9vblRlcm1pbmFsT3BlbmVkKGluc3RhbmNlKTtcblx0XHRcdHRoaXMuX29uSW5zdGFuY2VEaW1lbnNpb25zQ2hhbmdlZChpbnN0YW5jZSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fc3RvcmUuYWRkKF90ZXJtaW5hbFNlcnZpY2Uub25EaWREaXNwb3NlSW5zdGFuY2UoaW5zdGFuY2UgPT4gdGhpcy5fb25UZXJtaW5hbERpc3Bvc2VkKGluc3RhbmNlKSkpO1xuXHRcdHRoaXMuX3N0b3JlLmFkZChfdGVybWluYWxTZXJ2aWNlLm9uQW55SW5zdGFuY2VQcm9jZXNzSWRSZWFkeShpbnN0YW5jZSA9PiB0aGlzLl9vblRlcm1pbmFsUHJvY2Vzc0lkUmVhZHkoaW5zdGFuY2UpKSk7XG5cdFx0dGhpcy5fc3RvcmUuYWRkKF90ZXJtaW5hbFNlcnZpY2Uub25EaWRDaGFuZ2VJbnN0YW5jZURpbWVuc2lvbnMoaW5zdGFuY2UgPT4gdGhpcy5fb25JbnN0YW5jZURpbWVuc2lvbnNDaGFuZ2VkKGluc3RhbmNlKSkpO1xuXHRcdHRoaXMuX3N0b3JlLmFkZChfdGVybWluYWxTZXJ2aWNlLm9uQW55SW5zdGFuY2VNYXhpbXVtRGltZW5zaW9uc0NoYW5nZShpbnN0YW5jZSA9PiB0aGlzLl9vbkluc3RhbmNlTWF4aW11bURpbWVuc2lvbnNDaGFuZ2VkKGluc3RhbmNlKSkpO1xuXHRcdHRoaXMuX3N0b3JlLmFkZChfdGVybWluYWxTZXJ2aWNlLm9uRGlkUmVxdWVzdFN0YXJ0RXh0ZW5zaW9uVGVybWluYWwoZSA9PiB0aGlzLl9vblJlcXVlc3RTdGFydEV4dGVuc2lvblRlcm1pbmFsKGUpKSk7XG5cdFx0dGhpcy5fc3RvcmUuYWRkKF90ZXJtaW5hbFNlcnZpY2Uub25EaWRDaGFuZ2VBY3RpdmVJbnN0YW5jZShpbnN0YW5jZSA9PiB0aGlzLl9vbkFjdGl2ZVRlcm1pbmFsQ2hhbmdlZChpbnN0YW5jZSA/IGluc3RhbmNlLmluc3RhbmNlSWQgOiBudWxsKSkpO1xuXHRcdHRoaXMuX3N0b3JlLmFkZChfdGVybWluYWxTZXJ2aWNlLm9uQW55SW5zdGFuY2VUaXRsZUNoYW5nZShpbnN0YW5jZSA9PiBpbnN0YW5jZSAmJiB0aGlzLl9vblRpdGxlQ2hhbmdlZChpbnN0YW5jZS5pbnN0YW5jZUlkLCBpbnN0YW5jZS50aXRsZSkpKTtcblx0XHR0aGlzLl9zdG9yZS5hZGQoX3Rlcm1pbmFsU2VydmljZS5vbkFueUluc3RhbmNlRGF0YUlucHV0KGluc3RhbmNlID0+IHRoaXMuX3Byb3h5LiRhY2NlcHRUZXJtaW5hbEludGVyYWN0aW9uKGluc3RhbmNlLmluc3RhbmNlSWQpKSk7XG5cdFx0dGhpcy5fc3RvcmUuYWRkKF90ZXJtaW5hbFNlcnZpY2Uub25BbnlJbnN0YW5jZVNlbGVjdGlvbkNoYW5nZShpbnN0YW5jZSA9PiB0aGlzLl9wcm94eS4kYWNjZXB0VGVybWluYWxTZWxlY3Rpb24oaW5zdGFuY2UuaW5zdGFuY2VJZCwgaW5zdGFuY2Uuc2VsZWN0aW9uKSkpO1xuXHRcdHRoaXMuX3N0b3JlLmFkZChfdGVybWluYWxTZXJ2aWNlLm9uQW55SW5zdGFuY2VTaGVsbFR5cGVDaGFuZ2VkKGluc3RhbmNlID0+IHRoaXMuX29uU2hlbGxUeXBlQ2hhbmdlZChpbnN0YW5jZS5pbnN0YW5jZUlkKSkpO1xuXG5cdFx0Ly8gU2V0IGluaXRpYWwgZXh0IGhvc3Qgc3RhdGVcblx0XHRmb3IgKGNvbnN0IGluc3RhbmNlIG9mIHRoaXMuX3Rlcm1pbmFsU2VydmljZS5pbnN0YW5jZXMpIHtcblx0XHRcdHRoaXMuX29uVGVybWluYWxPcGVuZWQoaW5zdGFuY2UpO1xuXHRcdFx0aW5zdGFuY2UucHJvY2Vzc1JlYWR5LnRoZW4oKCkgPT4gdGhpcy5fb25UZXJtaW5hbFByb2Nlc3NJZFJlYWR5KGluc3RhbmNlKSk7XG5cdFx0XHRpZiAoaW5zdGFuY2Uuc2hlbGxUeXBlKSB7XG5cdFx0XHRcdHRoaXMuX3Byb3h5LiRhY2NlcHRUZXJtaW5hbFNoZWxsVHlwZShpbnN0YW5jZS5pbnN0YW5jZUlkLCBpbnN0YW5jZS5zaGVsbFR5cGUpO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCBhY3RpdmVJbnN0YW5jZSA9IHRoaXMuX3Rlcm1pbmFsU2VydmljZS5hY3RpdmVJbnN0YW5jZTtcblx0XHRpZiAoYWN0aXZlSW5zdGFuY2UpIHtcblx0XHRcdHRoaXMuX3Byb3h5LiRhY2NlcHRBY3RpdmVUZXJtaW5hbENoYW5nZWQoYWN0aXZlSW5zdGFuY2UuaW5zdGFuY2VJZCk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9lbnZpcm9ubWVudFZhcmlhYmxlU2VydmljZS5jb2xsZWN0aW9ucy5zaXplID4gMCkge1xuXHRcdFx0Y29uc3QgY29sbGVjdGlvbkFzQXJyYXkgPSBbLi4udGhpcy5fZW52aXJvbm1lbnRWYXJpYWJsZVNlcnZpY2UuY29sbGVjdGlvbnMuZW50cmllcygpXTtcblx0XHRcdGNvbnN0IHNlcmlhbGl6ZWRDb2xsZWN0aW9uczogW3N0cmluZywgSVNlcmlhbGl6YWJsZUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uXVtdID0gY29sbGVjdGlvbkFzQXJyYXkubWFwKGUgPT4ge1xuXHRcdFx0XHRyZXR1cm4gW2VbMF0sIHNlcmlhbGl6ZUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKGVbMV0ubWFwKV07XG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuX3Byb3h5LiRpbml0RW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb25zKHNlcmlhbGl6ZWRDb2xsZWN0aW9ucyk7XG5cdFx0fVxuXG5cdFx0cmVtb3RlQWdlbnRTZXJ2aWNlLmdldEVudmlyb25tZW50KCkudGhlbihhc3luYyBlbnYgPT4ge1xuXHRcdFx0dGhpcy5fb3MgPSBlbnY/Lm9zIHx8IE9TO1xuXHRcdFx0dGhpcy5fdXBkYXRlRGVmYXVsdFByb2ZpbGUoKTtcblx0XHR9KTtcblx0XHR0aGlzLl9zdG9yZS5hZGQodGhpcy5fdGVybWluYWxQcm9maWxlU2VydmljZS5vbkRpZENoYW5nZUF2YWlsYWJsZVByb2ZpbGVzKCgpID0+IHRoaXMuX3VwZGF0ZURlZmF1bHRQcm9maWxlKCkpKTtcblx0fVxuXG5cdHB1YmxpYyBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3N0b3JlLmRpc3Bvc2UoKTtcblx0XHRmb3IgKGNvbnN0IHByb3ZpZGVyIG9mIHRoaXMuX3Byb2ZpbGVQcm92aWRlcnMudmFsdWVzKCkpIHtcblx0XHRcdHByb3ZpZGVyLmRpc3Bvc2UoKTtcblx0XHR9XG5cdFx0Zm9yIChjb25zdCBwcm92aWRlciBvZiB0aGlzLl9xdWlja0ZpeFByb3ZpZGVycy52YWx1ZXMoKSkge1xuXHRcdFx0cHJvdmlkZXIuZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3VwZGF0ZURlZmF1bHRQcm9maWxlKCkge1xuXHRcdGNvbnN0IHJlbW90ZUF1dGhvcml0eSA9IHRoaXMuX2V4dEhvc3RDb250ZXh0LnJlbW90ZUF1dGhvcml0eSA/PyB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgZGVmYXVsdFByb2ZpbGUgPSB0aGlzLl90ZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UuZ2V0RGVmYXVsdFByb2ZpbGUoeyByZW1vdGVBdXRob3JpdHksIG9zOiB0aGlzLl9vcyB9KTtcblx0XHRjb25zdCBkZWZhdWx0QXV0b21hdGlvblByb2ZpbGUgPSB0aGlzLl90ZXJtaW5hbFByb2ZpbGVSZXNvbHZlclNlcnZpY2UuZ2V0RGVmYXVsdFByb2ZpbGUoeyByZW1vdGVBdXRob3JpdHksIG9zOiB0aGlzLl9vcywgYWxsb3dBdXRvbWF0aW9uU2hlbGw6IHRydWUgfSk7XG5cdFx0dGhpcy5fcHJveHkuJGFjY2VwdERlZmF1bHRQcm9maWxlKC4uLmF3YWl0IFByb21pc2UuYWxsKFtkZWZhdWx0UHJvZmlsZSwgZGVmYXVsdEF1dG9tYXRpb25Qcm9maWxlXSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfZ2V0VGVybWluYWxJbnN0YW5jZShpZDogRXh0SG9zdFRlcm1pbmFsSWRlbnRpZmllcik6IFByb21pc2U8SVRlcm1pbmFsSW5zdGFuY2UgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAodHlwZW9mIGlkID09PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2V4dEhvc3RUZXJtaW5hbHMuZ2V0KGlkKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3Rlcm1pbmFsU2VydmljZS5nZXRJbnN0YW5jZUZyb21JZChpZCk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgJGNyZWF0ZVRlcm1pbmFsKGV4dEhvc3RUZXJtaW5hbElkOiBzdHJpbmcsIGxhdW5jaENvbmZpZzogVGVybWluYWxMYXVuY2hDb25maWcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBzaGVsbExhdW5jaENvbmZpZzogSVNoZWxsTGF1bmNoQ29uZmlnID0ge1xuXHRcdFx0bmFtZTogbGF1bmNoQ29uZmlnLm5hbWUsXG5cdFx0XHRleGVjdXRhYmxlOiBsYXVuY2hDb25maWcuc2hlbGxQYXRoLFxuXHRcdFx0YXJnczogbGF1bmNoQ29uZmlnLnNoZWxsQXJncyxcblx0XHRcdGN3ZDogdHlwZW9mIGxhdW5jaENvbmZpZy5jd2QgPT09ICdzdHJpbmcnID8gbGF1bmNoQ29uZmlnLmN3ZCA6IFVSSS5yZXZpdmUobGF1bmNoQ29uZmlnLmN3ZCksXG5cdFx0XHRpY29uOiBsYXVuY2hDb25maWcuaWNvbixcblx0XHRcdGNvbG9yOiBsYXVuY2hDb25maWcuY29sb3IsXG5cdFx0XHRpbml0aWFsVGV4dDogbGF1bmNoQ29uZmlnLmluaXRpYWxUZXh0LFxuXHRcdFx0d2FpdE9uRXhpdDogbGF1bmNoQ29uZmlnLndhaXRPbkV4aXQsXG5cdFx0XHRpZ25vcmVDb25maWd1cmF0aW9uQ3dkOiB0cnVlLFxuXHRcdFx0ZW52OiBsYXVuY2hDb25maWcuZW52LFxuXHRcdFx0c3RyaWN0RW52OiBsYXVuY2hDb25maWcuc3RyaWN0RW52LFxuXHRcdFx0aGlkZUZyb21Vc2VyOiBsYXVuY2hDb25maWcuaGlkZUZyb21Vc2VyLFxuXHRcdFx0Y3VzdG9tUHR5SW1wbGVtZW50YXRpb246IGxhdW5jaENvbmZpZy5pc0V4dGVuc2lvbkN1c3RvbVB0eVRlcm1pbmFsXG5cdFx0XHRcdD8gKGlkLCBjb2xzLCByb3dzKSA9PiBuZXcgVGVybWluYWxQcm9jZXNzRXh0SG9zdFByb3h5KGlkLCBjb2xzLCByb3dzLCB0aGlzLl90ZXJtaW5hbFNlcnZpY2UpXG5cdFx0XHRcdDogdW5kZWZpbmVkLFxuXHRcdFx0ZXh0SG9zdFRlcm1pbmFsSWQsXG5cdFx0XHRmb3JjZVNoZWxsSW50ZWdyYXRpb246IGxhdW5jaENvbmZpZy5mb3JjZVNoZWxsSW50ZWdyYXRpb24sXG5cdFx0XHRpc0ZlYXR1cmVUZXJtaW5hbDogbGF1bmNoQ29uZmlnLmlzRmVhdHVyZVRlcm1pbmFsLFxuXHRcdFx0aXNFeHRlbnNpb25Pd25lZFRlcm1pbmFsOiBsYXVuY2hDb25maWcuaXNFeHRlbnNpb25Pd25lZFRlcm1pbmFsLFxuXHRcdFx0dXNlU2hlbGxFbnZpcm9ubWVudDogbGF1bmNoQ29uZmlnLnVzZVNoZWxsRW52aXJvbm1lbnQsXG5cdFx0XHRpc1RyYW5zaWVudDogbGF1bmNoQ29uZmlnLmlzVHJhbnNpZW50XG5cdFx0fTtcblx0XHRjb25zdCB0ZXJtaW5hbCA9IFByb21pc2VzLndpdGhBc3luY0JvZHk8SVRlcm1pbmFsSW5zdGFuY2U+KGFzeW5jIHIgPT4ge1xuXHRcdFx0Y29uc3QgdGVybWluYWwgPSBhd2FpdCB0aGlzLl90ZXJtaW5hbFNlcnZpY2UuY3JlYXRlVGVybWluYWwoe1xuXHRcdFx0XHRjb25maWc6IHNoZWxsTGF1bmNoQ29uZmlnLFxuXHRcdFx0XHRsb2NhdGlvbjogYXdhaXQgdGhpcy5fZGVzZXJpYWxpemVQYXJlbnRUZXJtaW5hbChsYXVuY2hDb25maWcubG9jYXRpb24pXG5cdFx0XHR9KTtcblx0XHRcdHIodGVybWluYWwpO1xuXHRcdH0pO1xuXHRcdHRoaXMuX2V4dEhvc3RUZXJtaW5hbHMuc2V0KGV4dEhvc3RUZXJtaW5hbElkLCB0ZXJtaW5hbCk7XG5cdFx0Y29uc3QgdGVybWluYWxJbnN0YW5jZSA9IGF3YWl0IHRlcm1pbmFsO1xuXHRcdHRoaXMuX3N0b3JlLmFkZCh0ZXJtaW5hbEluc3RhbmNlLm9uRGlzcG9zZWQoKCkgPT4ge1xuXHRcdFx0dGhpcy5fZXh0SG9zdFRlcm1pbmFscy5kZWxldGUoZXh0SG9zdFRlcm1pbmFsSWQpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2Rlc2VyaWFsaXplUGFyZW50VGVybWluYWwobG9jYXRpb24/OiBUZXJtaW5hbExvY2F0aW9uIHwgVGVybWluYWxFZGl0b3JMb2NhdGlvbk9wdGlvbnMgfCB7IHBhcmVudFRlcm1pbmFsOiBFeHRIb3N0VGVybWluYWxJZGVudGlmaWVyIH0gfCB7IHNwbGl0QWN0aXZlVGVybWluYWw6IGJvb2xlYW47IGxvY2F0aW9uPzogVGVybWluYWxMb2NhdGlvbiB9KTogUHJvbWlzZTxUZXJtaW5hbExvY2F0aW9uIHwgVGVybWluYWxFZGl0b3JMb2NhdGlvbk9wdGlvbnMgfCB7IHBhcmVudFRlcm1pbmFsOiBJVGVybWluYWxJbnN0YW5jZSB9IHwgeyBzcGxpdEFjdGl2ZVRlcm1pbmFsOiBib29sZWFuIH0gfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAodHlwZW9mIGxvY2F0aW9uID09PSAnb2JqZWN0JyAmJiAncGFyZW50VGVybWluYWwnIGluIGxvY2F0aW9uKSB7XG5cdFx0XHRjb25zdCBwYXJlbnRUZXJtaW5hbCA9IGF3YWl0IHRoaXMuX2V4dEhvc3RUZXJtaW5hbHMuZ2V0KGxvY2F0aW9uLnBhcmVudFRlcm1pbmFsLnRvU3RyaW5nKCkpO1xuXHRcdFx0cmV0dXJuIHBhcmVudFRlcm1pbmFsID8geyBwYXJlbnRUZXJtaW5hbCB9IDogdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gbG9jYXRpb247XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgJHNob3coaWQ6IEV4dEhvc3RUZXJtaW5hbElkZW50aWZpZXIsIHByZXNlcnZlRm9jdXM6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB0ZXJtaW5hbEluc3RhbmNlID0gYXdhaXQgdGhpcy5fZ2V0VGVybWluYWxJbnN0YW5jZShpZCk7XG5cdFx0aWYgKHRlcm1pbmFsSW5zdGFuY2UpIHtcblx0XHRcdHRoaXMuX3Rlcm1pbmFsU2VydmljZS5zZXRBY3RpdmVJbnN0YW5jZSh0ZXJtaW5hbEluc3RhbmNlKTtcblx0XHRcdGlmICh0ZXJtaW5hbEluc3RhbmNlLnRhcmdldCA9PT0gVGVybWluYWxMb2NhdGlvbi5FZGl0b3IpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5fdGVybWluYWxFZGl0b3JTZXJ2aWNlLnJldmVhbEFjdGl2ZUVkaXRvcihwcmVzZXJ2ZUZvY3VzKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuX3Rlcm1pbmFsR3JvdXBTZXJ2aWNlLnNob3dQYW5lbCghcHJlc2VydmVGb2N1cyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGFzeW5jICRoaWRlKGlkOiBFeHRIb3N0VGVybWluYWxJZGVudGlmaWVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaW5zdGFuY2VUb0hpZGUgPSBhd2FpdCB0aGlzLl9nZXRUZXJtaW5hbEluc3RhbmNlKGlkKTtcblx0XHRjb25zdCBhY3RpdmVJbnN0YW5jZSA9IHRoaXMuX3Rlcm1pbmFsU2VydmljZS5hY3RpdmVJbnN0YW5jZTtcblx0XHRpZiAoYWN0aXZlSW5zdGFuY2UgJiYgYWN0aXZlSW5zdGFuY2UuaW5zdGFuY2VJZCA9PT0gaW5zdGFuY2VUb0hpZGU/Lmluc3RhbmNlSWQgJiYgYWN0aXZlSW5zdGFuY2UudGFyZ2V0ICE9PSBUZXJtaW5hbExvY2F0aW9uLkVkaXRvcikge1xuXHRcdFx0dGhpcy5fdGVybWluYWxHcm91cFNlcnZpY2UuaGlkZVBhbmVsKCk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGFzeW5jICRkaXNwb3NlKGlkOiBFeHRIb3N0VGVybWluYWxJZGVudGlmaWVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0KGF3YWl0IHRoaXMuX2dldFRlcm1pbmFsSW5zdGFuY2UoaWQpKT8uZGlzcG9zZShUZXJtaW5hbEV4aXRSZWFzb24uRXh0ZW5zaW9uKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyAkc2VuZFRleHQoaWQ6IEV4dEhvc3RUZXJtaW5hbElkZW50aWZpZXIsIHRleHQ6IHN0cmluZywgc2hvdWxkRXhlY3V0ZTogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGluc3RhbmNlID0gYXdhaXQgdGhpcy5fZ2V0VGVybWluYWxJbnN0YW5jZShpZCk7XG5cdFx0YXdhaXQgaW5zdGFuY2U/LnNlbmRUZXh0KHRleHQsIHNob3VsZEV4ZWN1dGUpO1xuXHR9XG5cblx0cHVibGljICRzZW5kUHJvY2Vzc0V4aXQodGVybWluYWxJZDogbnVtYmVyLCBleGl0Q29kZTogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5fdGVybWluYWxQcm9jZXNzUHJveGllcy5nZXQodGVybWluYWxJZCk/LmVtaXRFeGl0KGV4aXRDb2RlKTtcblx0fVxuXG5cdHB1YmxpYyAkc3RhcnRTZW5kaW5nRGF0YUV2ZW50cygpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2RhdGFFdmVudFRyYWNrZXIudmFsdWUpIHtcblx0XHRcdHRoaXMuX2RhdGFFdmVudFRyYWNrZXIudmFsdWUgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbERhdGFFdmVudFRyYWNrZXIsIChpZCwgZGF0YSkgPT4ge1xuXHRcdFx0XHR0aGlzLl9vblRlcm1pbmFsRGF0YShpZCwgZGF0YSk7XG5cdFx0XHR9KTtcblx0XHRcdC8vIFNlbmQgaW5pdGlhbCBldmVudHMgaWYgdGhleSBleGlzdFxuXHRcdFx0Zm9yIChjb25zdCBpbnN0YW5jZSBvZiB0aGlzLl90ZXJtaW5hbFNlcnZpY2UuaW5zdGFuY2VzKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgZGF0YSBvZiBpbnN0YW5jZS5pbml0aWFsRGF0YUV2ZW50cyB8fCBbXSkge1xuXHRcdFx0XHRcdHRoaXMuX29uVGVybWluYWxEYXRhKGluc3RhbmNlLmluc3RhbmNlSWQsIGRhdGEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHVibGljICRzdG9wU2VuZGluZ0RhdGFFdmVudHMoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGF0YUV2ZW50VHJhY2tlci5jbGVhcigpO1xuXHR9XG5cblx0cHVibGljICRzdGFydFNlbmRpbmdDb21tYW5kRXZlbnRzKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9zZW5kQ29tbWFuZEV2ZW50TGlzdGVuZXIudmFsdWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBtdWx0aXBsZXhlciA9IHRoaXMuX3Rlcm1pbmFsU2VydmljZS5jcmVhdGVPbkluc3RhbmNlQ2FwYWJpbGl0eUV2ZW50KFRlcm1pbmFsQ2FwYWJpbGl0eS5Db21tYW5kRGV0ZWN0aW9uLCBjYXBhYmlsaXR5ID0+IGNhcGFiaWxpdHkub25Db21tYW5kRmluaXNoZWQpO1xuXHRcdGNvbnN0IHN1YiA9IG11bHRpcGxleGVyLmV2ZW50KGUgPT4ge1xuXHRcdFx0dGhpcy5fb25EaWRFeGVjdXRlQ29tbWFuZChlLmluc3RhbmNlLmluc3RhbmNlSWQsIHtcblx0XHRcdFx0Y29tbWFuZExpbmU6IGUuZGF0YS5jb21tYW5kLFxuXHRcdFx0XHQvLyBUT0RPOiBDb252ZXJ0IHRvIFVSSSBpZiBwb3NzaWJsZVxuXHRcdFx0XHRjd2Q6IGUuZGF0YS5jd2QsXG5cdFx0XHRcdGV4aXRDb2RlOiBlLmRhdGEuZXhpdENvZGUsXG5cdFx0XHRcdG91dHB1dDogZS5kYXRhLmdldE91dHB1dCgpXG5cdFx0XHR9KTtcblx0XHR9KTtcblx0XHR0aGlzLl9zZW5kQ29tbWFuZEV2ZW50TGlzdGVuZXIudmFsdWUgPSBjb21iaW5lZERpc3Bvc2FibGUobXVsdGlwbGV4ZXIsIHN1Yik7XG5cdH1cblxuXHRwdWJsaWMgJHN0b3BTZW5kaW5nQ29tbWFuZEV2ZW50cygpOiB2b2lkIHtcblx0XHR0aGlzLl9zZW5kQ29tbWFuZEV2ZW50TGlzdGVuZXIuY2xlYXIoKTtcblx0fVxuXG5cdHB1YmxpYyAkc3RhcnRMaW5rUHJvdmlkZXIoKTogdm9pZCB7XG5cdFx0dGhpcy5fbGlua1Byb3ZpZGVyLnZhbHVlID0gdGhpcy5fdGVybWluYWxMaW5rUHJvdmlkZXJTZXJ2aWNlLnJlZ2lzdGVyTGlua1Byb3ZpZGVyKG5ldyBFeHRlbnNpb25UZXJtaW5hbExpbmtQcm92aWRlcih0aGlzLl9wcm94eSkpO1xuXHR9XG5cblx0cHVibGljICRzdG9wTGlua1Byb3ZpZGVyKCk6IHZvaWQge1xuXHRcdHRoaXMuX2xpbmtQcm92aWRlci5jbGVhcigpO1xuXHR9XG5cblx0cHVibGljICRyZWdpc3RlclByb2Nlc3NTdXBwb3J0KGlzU3VwcG9ydGVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5fdGVybWluYWxTZXJ2aWNlLnJlZ2lzdGVyUHJvY2Vzc1N1cHBvcnQoaXNTdXBwb3J0ZWQpO1xuXHR9XG5cblx0cHVibGljICRyZWdpc3RlckNvbXBsZXRpb25Qcm92aWRlcihpZDogc3RyaW5nLCBleHRlbnNpb25JZGVudGlmaWVyOiBzdHJpbmcsIC4uLnRyaWdnZXJDaGFyYWN0ZXJzOiBzdHJpbmdbXSk6IHZvaWQge1xuXHRcdHRoaXMuX2NvbXBsZXRpb25Qcm92aWRlcnMuc2V0KGlkLCB0aGlzLl90ZXJtaW5hbENvbXBsZXRpb25TZXJ2aWNlLnJlZ2lzdGVyVGVybWluYWxDb21wbGV0aW9uUHJvdmlkZXIoZXh0ZW5zaW9uSWRlbnRpZmllciwgaWQsIHtcblx0XHRcdGlkLFxuXHRcdFx0cHJvdmlkZUNvbXBsZXRpb25zOiBhc3luYyAoY29tbWFuZExpbmUsIGN1cnNvclBvc2l0aW9uLCBhbGxvd0ZhbGxiYWNrQ29tcGxldGlvbnMsIHRva2VuKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGNvbXBsZXRpb25zID0gYXdhaXQgdGhpcy5fcHJveHkuJHByb3ZpZGVUZXJtaW5hbENvbXBsZXRpb25zKGlkLCB7IGNvbW1hbmRMaW5lLCBjdXJzb3JQb3NpdGlvbiwgYWxsb3dGYWxsYmFja0NvbXBsZXRpb25zIH0sIHRva2VuKTtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRpdGVtczogY29tcGxldGlvbnM/Lml0ZW1zLm1hcChjID0+ICh7IC4uLmMsIHByb3ZpZGVyOiBpZCB9KSksXG5cdFx0XHRcdFx0cmVzb3VyY2VSZXF1ZXN0Q29uZmlnOiBjb21wbGV0aW9ucz8ucmVzb3VyY2VSZXF1ZXN0Q29uZmlnXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fSwgLi4udHJpZ2dlckNoYXJhY3RlcnMpKTtcblx0fVxuXG5cdHB1YmxpYyAkdW5yZWdpc3RlckNvbXBsZXRpb25Qcm92aWRlcihpZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fY29tcGxldGlvblByb3ZpZGVycy5nZXQoaWQpPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fY29tcGxldGlvblByb3ZpZGVycy5kZWxldGUoaWQpO1xuXHR9XG5cblx0cHVibGljICRyZWdpc3RlclByb2ZpbGVQcm92aWRlcihpZDogc3RyaW5nLCBleHRlbnNpb25JZGVudGlmaWVyOiBzdHJpbmcpOiB2b2lkIHtcblx0XHQvLyBQcm94eSBwcm9maWxlIHByb3ZpZGVyIHJlcXVlc3RzIHRocm91Z2ggdGhlIGV4dGVuc2lvbiBob3N0XG5cdFx0dGhpcy5fcHJvZmlsZVByb3ZpZGVycy5zZXQoaWQsIHRoaXMuX3Rlcm1pbmFsUHJvZmlsZVNlcnZpY2UucmVnaXN0ZXJUZXJtaW5hbFByb2ZpbGVQcm92aWRlcihleHRlbnNpb25JZGVudGlmaWVyLCBpZCwge1xuXHRcdFx0Y3JlYXRlQ29udHJpYnV0ZWRUZXJtaW5hbFByb2ZpbGU6IGFzeW5jIChvcHRpb25zKSA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9wcm94eS4kY3JlYXRlQ29udHJpYnV0ZWRQcm9maWxlVGVybWluYWwoaWQsIG9wdGlvbnMpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHB1YmxpYyAkdW5yZWdpc3RlclByb2ZpbGVQcm92aWRlcihpZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fcHJvZmlsZVByb3ZpZGVycy5nZXQoaWQpPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fcHJvZmlsZVByb3ZpZGVycy5kZWxldGUoaWQpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jICRyZWdpc3RlclF1aWNrRml4UHJvdmlkZXIoaWQ6IHN0cmluZywgZXh0ZW5zaW9uSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX3F1aWNrRml4UHJvdmlkZXJzLnNldChpZCwgdGhpcy5fdGVybWluYWxRdWlja0ZpeFNlcnZpY2UucmVnaXN0ZXJRdWlja0ZpeFByb3ZpZGVyKGlkLCB7XG5cdFx0XHRwcm92aWRlVGVybWluYWxRdWlja0ZpeGVzOiBhc3luYyAodGVybWluYWxDb21tYW5kLCBsaW5lcywgb3B0aW9ucywgdG9rZW4pID0+IHtcblx0XHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChvcHRpb25zLm91dHB1dE1hdGNoZXI/Lmxlbmd0aCAmJiBvcHRpb25zLm91dHB1dE1hdGNoZXIubGVuZ3RoID4gNDApIHtcblx0XHRcdFx0XHRvcHRpb25zLm91dHB1dE1hdGNoZXIubGVuZ3RoID0gNDA7XG5cdFx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS53YXJuKCdDYW5ub3QgZXhjZWVkIG91dHB1dCBtYXRjaGVyIGxlbmd0aCBvZiA0MCcpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGNvbW1hbmRMaW5lTWF0Y2ggPSB0ZXJtaW5hbENvbW1hbmQuY29tbWFuZC5tYXRjaChvcHRpb25zLmNvbW1hbmRMaW5lTWF0Y2hlcik7XG5cdFx0XHRcdGlmICghY29tbWFuZExpbmVNYXRjaCB8fCAhbGluZXMpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3Qgb3V0cHV0TWF0Y2hlciA9IG9wdGlvbnMub3V0cHV0TWF0Y2hlcjtcblx0XHRcdFx0bGV0IG91dHB1dE1hdGNoO1xuXHRcdFx0XHRpZiAob3V0cHV0TWF0Y2hlcikge1xuXHRcdFx0XHRcdG91dHB1dE1hdGNoID0gZ2V0T3V0cHV0TWF0Y2hGb3JMaW5lcyhsaW5lcywgb3V0cHV0TWF0Y2hlcik7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFvdXRwdXRNYXRjaCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBtYXRjaFJlc3VsdCA9IHsgY29tbWFuZExpbmVNYXRjaCwgb3V0cHV0TWF0Y2gsIGNvbW1hbmRMaW5lOiB0ZXJtaW5hbENvbW1hbmQuY29tbWFuZCB9O1xuXG5cdFx0XHRcdGlmIChtYXRjaFJlc3VsdCkge1xuXHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuX3Byb3h5LiRwcm92aWRlVGVybWluYWxRdWlja0ZpeGVzKGlkLCBtYXRjaFJlc3VsdCwgdG9rZW4pO1xuXHRcdFx0XHRcdGlmIChyZXN1bHQgJiYgQXJyYXkuaXNBcnJheShyZXN1bHQpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gcmVzdWx0Lm1hcChyID0+IHBhcnNlUXVpY2tGaXgoaWQsIGV4dGVuc2lvbklkLCByKSk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChyZXN1bHQpIHtcblx0XHRcdFx0XHRcdHJldHVybiBwYXJzZVF1aWNrRml4KGlkLCBleHRlbnNpb25JZCwgcmVzdWx0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHB1YmxpYyAkdW5yZWdpc3RlclF1aWNrRml4UHJvdmlkZXIoaWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX3F1aWNrRml4UHJvdmlkZXJzLmdldChpZCk/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9xdWlja0ZpeFByb3ZpZGVycy5kZWxldGUoaWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25BY3RpdmVUZXJtaW5hbENoYW5nZWQodGVybWluYWxJZDogbnVtYmVyIHwgbnVsbCk6IHZvaWQge1xuXHRcdHRoaXMuX3Byb3h5LiRhY2NlcHRBY3RpdmVUZXJtaW5hbENoYW5nZWQodGVybWluYWxJZCk7XG5cdH1cblxuXHRwcml2YXRlIF9vblRlcm1pbmFsRGF0YSh0ZXJtaW5hbElkOiBudW1iZXIsIGRhdGE6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX3Byb3h5LiRhY2NlcHRUZXJtaW5hbFByb2Nlc3NEYXRhKHRlcm1pbmFsSWQsIGRhdGEpO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25EaWRFeGVjdXRlQ29tbWFuZCh0ZXJtaW5hbElkOiBudW1iZXIsIGNvbW1hbmQ6IElUZXJtaW5hbENvbW1hbmREdG8pOiB2b2lkIHtcblx0XHR0aGlzLl9wcm94eS4kYWNjZXB0RGlkRXhlY3V0ZUNvbW1hbmQodGVybWluYWxJZCwgY29tbWFuZCk7XG5cdH1cblxuXHRwcml2YXRlIF9vblRpdGxlQ2hhbmdlZCh0ZXJtaW5hbElkOiBudW1iZXIsIG5hbWU6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX3Byb3h5LiRhY2NlcHRUZXJtaW5hbFRpdGxlQ2hhbmdlKHRlcm1pbmFsSWQsIG5hbWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25TaGVsbFR5cGVDaGFuZ2VkKHRlcm1pbmFsSWQ6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IHRlcm1pbmFsSW5zdGFuY2UgPSB0aGlzLl90ZXJtaW5hbFNlcnZpY2UuZ2V0SW5zdGFuY2VGcm9tSWQodGVybWluYWxJZCk7XG5cdFx0aWYgKHRlcm1pbmFsSW5zdGFuY2UpIHtcblx0XHRcdHRoaXMuX3Byb3h5LiRhY2NlcHRUZXJtaW5hbFNoZWxsVHlwZSh0ZXJtaW5hbElkLCB0ZXJtaW5hbEluc3RhbmNlLnNoZWxsVHlwZSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfb25UZXJtaW5hbERpc3Bvc2VkKHRlcm1pbmFsSW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlKTogdm9pZCB7XG5cdFx0dGhpcy5fcHJveHkuJGFjY2VwdFRlcm1pbmFsQ2xvc2VkKHRlcm1pbmFsSW5zdGFuY2UuaW5zdGFuY2VJZCwgdGVybWluYWxJbnN0YW5jZS5leGl0Q29kZSwgdGVybWluYWxJbnN0YW5jZS5leGl0UmVhc29uID8/IFRlcm1pbmFsRXhpdFJlYXNvbi5Vbmtub3duKTtcblx0fVxuXG5cdHByaXZhdGUgX29uVGVybWluYWxPcGVuZWQodGVybWluYWxJbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UpOiB2b2lkIHtcblx0XHRjb25zdCBleHRIb3N0VGVybWluYWxJZCA9IHRlcm1pbmFsSW5zdGFuY2Uuc2hlbGxMYXVuY2hDb25maWcuZXh0SG9zdFRlcm1pbmFsSWQ7XG5cdFx0Y29uc3Qgc2hlbGxMYXVuY2hDb25maWdEdG86IElTaGVsbExhdW5jaENvbmZpZ0R0byA9IHtcblx0XHRcdG5hbWU6IHRlcm1pbmFsSW5zdGFuY2Uuc2hlbGxMYXVuY2hDb25maWcubmFtZSxcblx0XHRcdGV4ZWN1dGFibGU6IHRlcm1pbmFsSW5zdGFuY2Uuc2hlbGxMYXVuY2hDb25maWcuZXhlY3V0YWJsZSxcblx0XHRcdGFyZ3M6IHRlcm1pbmFsSW5zdGFuY2Uuc2hlbGxMYXVuY2hDb25maWcuYXJncyxcblx0XHRcdGN3ZDogdGVybWluYWxJbnN0YW5jZS5zaGVsbExhdW5jaENvbmZpZy5jd2QsXG5cdFx0XHRlbnY6IHRlcm1pbmFsSW5zdGFuY2Uuc2hlbGxMYXVuY2hDb25maWcuZW52LFxuXHRcdFx0aGlkZUZyb21Vc2VyOiB0ZXJtaW5hbEluc3RhbmNlLnNoZWxsTGF1bmNoQ29uZmlnLmhpZGVGcm9tVXNlcixcblx0XHRcdHRhYkFjdGlvbnM6IHRlcm1pbmFsSW5zdGFuY2Uuc2hlbGxMYXVuY2hDb25maWcudGFiQWN0aW9uc1xuXHRcdH07XG5cdFx0dGhpcy5fcHJveHkuJGFjY2VwdFRlcm1pbmFsT3BlbmVkKHRlcm1pbmFsSW5zdGFuY2UuaW5zdGFuY2VJZCwgZXh0SG9zdFRlcm1pbmFsSWQsIHRlcm1pbmFsSW5zdGFuY2UudGl0bGUsIHNoZWxsTGF1bmNoQ29uZmlnRHRvKTtcblx0fVxuXG5cdHByaXZhdGUgX29uVGVybWluYWxQcm9jZXNzSWRSZWFkeSh0ZXJtaW5hbEluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSk6IHZvaWQge1xuXHRcdGlmICh0ZXJtaW5hbEluc3RhbmNlLnByb2Nlc3NJZCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3Byb3h5LiRhY2NlcHRUZXJtaW5hbFByb2Nlc3NJZCh0ZXJtaW5hbEluc3RhbmNlLmluc3RhbmNlSWQsIHRlcm1pbmFsSW5zdGFuY2UucHJvY2Vzc0lkKTtcblx0fVxuXG5cdHByaXZhdGUgX29uSW5zdGFuY2VEaW1lbnNpb25zQ2hhbmdlZChpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UpOiB2b2lkIHtcblx0XHR0aGlzLl9wcm94eS4kYWNjZXB0VGVybWluYWxEaW1lbnNpb25zKGluc3RhbmNlLmluc3RhbmNlSWQsIGluc3RhbmNlLmNvbHMsIGluc3RhbmNlLnJvd3MpO1xuXHR9XG5cblx0cHJpdmF0ZSBfb25JbnN0YW5jZU1heGltdW1EaW1lbnNpb25zQ2hhbmdlZChpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UpOiB2b2lkIHtcblx0XHR0aGlzLl9wcm94eS4kYWNjZXB0VGVybWluYWxNYXhpbXVtRGltZW5zaW9ucyhpbnN0YW5jZS5pbnN0YW5jZUlkLCBpbnN0YW5jZS5tYXhDb2xzLCBpbnN0YW5jZS5tYXhSb3dzKTtcblx0fVxuXG5cdHByaXZhdGUgX29uUmVxdWVzdFN0YXJ0RXh0ZW5zaW9uVGVybWluYWwocmVxdWVzdDogSVN0YXJ0RXh0ZW5zaW9uVGVybWluYWxSZXF1ZXN0KTogdm9pZCB7XG5cdFx0Y29uc3QgcHJveHkgPSByZXF1ZXN0LnByb3h5O1xuXHRcdHRoaXMuX3Rlcm1pbmFsUHJvY2Vzc1Byb3hpZXMuc2V0KHByb3h5Lmluc3RhbmNlSWQsIHByb3h5KTtcblxuXHRcdC8vIE5vdGUgdGhhdCBvblJlc2l6ZSBpcyBub3QgYmVpbmcgbGlzdGVuZWQgdG8gaGVyZSBhcyBpdCBuZWVkcyB0byBmaXJlIHdoZW4gbWF4IGRpbWVuc2lvbnNcblx0XHQvLyBjaGFuZ2UsIGV4Y2x1ZGluZyB0aGUgZGltZW5zaW9uIG92ZXJyaWRlXG5cdFx0Y29uc3QgaW5pdGlhbERpbWVuc2lvbnM6IElUZXJtaW5hbERpbWVuc2lvbnNEdG8gfCB1bmRlZmluZWQgPSByZXF1ZXN0LmNvbHMgJiYgcmVxdWVzdC5yb3dzID8ge1xuXHRcdFx0Y29sdW1uczogcmVxdWVzdC5jb2xzLFxuXHRcdFx0cm93czogcmVxdWVzdC5yb3dzXG5cdFx0fSA6IHVuZGVmaW5lZDtcblxuXHRcdHRoaXMuX3Byb3h5LiRzdGFydEV4dGVuc2lvblRlcm1pbmFsKFxuXHRcdFx0cHJveHkuaW5zdGFuY2VJZCxcblx0XHRcdGluaXRpYWxEaW1lbnNpb25zXG5cdFx0KS50aGVuKHJlcXVlc3QuY2FsbGJhY2spO1xuXG5cdFx0cHJveHkub25JbnB1dChkYXRhID0+IHRoaXMuX3Byb3h5LiRhY2NlcHRQcm9jZXNzSW5wdXQocHJveHkuaW5zdGFuY2VJZCwgZGF0YSkpO1xuXHRcdHByb3h5Lm9uU2h1dGRvd24oaW1tZWRpYXRlID0+IHRoaXMuX3Byb3h5LiRhY2NlcHRQcm9jZXNzU2h1dGRvd24ocHJveHkuaW5zdGFuY2VJZCwgaW1tZWRpYXRlKSk7XG5cdFx0cHJveHkub25SZXF1ZXN0Q3dkKCgpID0+IHRoaXMuX3Byb3h5LiRhY2NlcHRQcm9jZXNzUmVxdWVzdEN3ZChwcm94eS5pbnN0YW5jZUlkKSk7XG5cdFx0cHJveHkub25SZXF1ZXN0SW5pdGlhbEN3ZCgoKSA9PiB0aGlzLl9wcm94eS4kYWNjZXB0UHJvY2Vzc1JlcXVlc3RJbml0aWFsQ3dkKHByb3h5Lmluc3RhbmNlSWQpKTtcblx0fVxuXG5cdHB1YmxpYyAkc2VuZFByb2Nlc3NEYXRhKHRlcm1pbmFsSWQ6IG51bWJlciwgZGF0YTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fdGVybWluYWxQcm9jZXNzUHJveGllcy5nZXQodGVybWluYWxJZCk/LmVtaXREYXRhKGRhdGEpO1xuXHR9XG5cblx0cHVibGljICRzZW5kUHJvY2Vzc1JlYWR5KHRlcm1pbmFsSWQ6IG51bWJlciwgcGlkOiBudW1iZXIsIGN3ZDogc3RyaW5nLCB3aW5kb3dzUHR5OiBJUHJvY2Vzc1JlYWR5V2luZG93c1B0eSB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuX3Rlcm1pbmFsUHJvY2Vzc1Byb3hpZXMuZ2V0KHRlcm1pbmFsSWQpPy5lbWl0UmVhZHkocGlkLCBjd2QsIHdpbmRvd3NQdHkpO1xuXHR9XG5cblx0cHVibGljICRzZW5kUHJvY2Vzc1Byb3BlcnR5KHRlcm1pbmFsSWQ6IG51bWJlciwgcHJvcGVydHk6IElQcm9jZXNzUHJvcGVydHk8YW55Pik6IHZvaWQge1xuXHRcdGlmIChwcm9wZXJ0eS50eXBlID09PSBQcm9jZXNzUHJvcGVydHlUeXBlLlRpdGxlKSB7XG5cdFx0XHRjb25zdCBpbnN0YW5jZSA9IHRoaXMuX3Rlcm1pbmFsU2VydmljZS5nZXRJbnN0YW5jZUZyb21JZCh0ZXJtaW5hbElkKTtcblx0XHRcdGluc3RhbmNlPy5yZW5hbWUocHJvcGVydHkudmFsdWUpO1xuXHRcdH1cblx0XHR0aGlzLl90ZXJtaW5hbFByb2Nlc3NQcm94aWVzLmdldCh0ZXJtaW5hbElkKT8uZW1pdFByb2Nlc3NQcm9wZXJ0eShwcm9wZXJ0eSk7XG5cdH1cblxuXHQkc2V0RW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oZXh0ZW5zaW9uSWRlbnRpZmllcjogc3RyaW5nLCBwZXJzaXN0ZW50OiBib29sZWFuLCBjb2xsZWN0aW9uOiBJU2VyaWFsaXphYmxlRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24gfCB1bmRlZmluZWQsIGRlc2NyaXB0aW9uTWFwOiBJU2VyaWFsaXphYmxlRW52aXJvbm1lbnREZXNjcmlwdGlvbk1hcCk6IHZvaWQge1xuXHRcdGlmIChjb2xsZWN0aW9uKSB7XG5cdFx0XHRjb25zdCB0cmFuc2xhdGVkQ29sbGVjdGlvbiA9IHtcblx0XHRcdFx0cGVyc2lzdGVudCxcblx0XHRcdFx0bWFwOiBkZXNlcmlhbGl6ZUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKGNvbGxlY3Rpb24pLFxuXHRcdFx0XHRkZXNjcmlwdGlvbk1hcDogZGVzZXJpYWxpemVFbnZpcm9ubWVudERlc2NyaXB0aW9uTWFwKGRlc2NyaXB0aW9uTWFwKVxuXHRcdFx0fTtcblx0XHRcdHRoaXMuX2Vudmlyb25tZW50VmFyaWFibGVTZXJ2aWNlLnNldChleHRlbnNpb25JZGVudGlmaWVyLCB0cmFuc2xhdGVkQ29sbGVjdGlvbik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2Vudmlyb25tZW50VmFyaWFibGVTZXJ2aWNlLmRlbGV0ZShleHRlbnNpb25JZGVudGlmaWVyKTtcblx0XHR9XG5cdH1cbn1cblxuLyoqXG4gKiBFbmNhcHN1bGF0ZXMgdGVtcG9yYXJ5IHRyYWNraW5nIG9mIGRhdGEgZXZlbnRzIGZyb20gdGVybWluYWwgaW5zdGFuY2VzLCBvbmNlIGRpc3Bvc2VkIGFsbFxuICogbGlzdGVuZXJzIGFyZSByZW1vdmVkLlxuICovXG5jbGFzcyBUZXJtaW5hbERhdGFFdmVudFRyYWNrZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBfYnVmZmVyZXI6IFRlcm1pbmFsRGF0YUJ1ZmZlcmVyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2NhbGxiYWNrOiAoaWQ6IG51bWJlciwgZGF0YTogc3RyaW5nKSA9PiB2b2lkLFxuXHRcdEBJVGVybWluYWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rlcm1pbmFsU2VydmljZTogSVRlcm1pbmFsU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fYnVmZmVyZXIgPSBuZXcgVGVybWluYWxEYXRhQnVmZmVyZXIodGhpcy5fY2FsbGJhY2spKTtcblxuXHRcdGZvciAoY29uc3QgaW5zdGFuY2Ugb2YgdGhpcy5fdGVybWluYWxTZXJ2aWNlLmluc3RhbmNlcykge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXJJbnN0YW5jZShpbnN0YW5jZSk7XG5cdFx0fVxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX3Rlcm1pbmFsU2VydmljZS5vbkRpZENyZWF0ZUluc3RhbmNlKGluc3RhbmNlID0+IHRoaXMuX3JlZ2lzdGVySW5zdGFuY2UoaW5zdGFuY2UpKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGVybWluYWxTZXJ2aWNlLm9uRGlkRGlzcG9zZUluc3RhbmNlKGluc3RhbmNlID0+IHRoaXMuX2J1ZmZlcmVyLnN0b3BCdWZmZXJpbmcoaW5zdGFuY2UuaW5zdGFuY2VJZCkpKTtcblx0fVxuXG5cdHByaXZhdGUgX3JlZ2lzdGVySW5zdGFuY2UoaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlKTogdm9pZCB7XG5cdFx0Ly8gQnVmZmVyIGRhdGEgZXZlbnRzIHRvIHJlZHVjZSB0aGUgYW1vdW50IG9mIG1lc3NhZ2VzIGdvaW5nIHRvIHRoZSBleHRlbnNpb24gaG9zdFxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2J1ZmZlcmVyLnN0YXJ0QnVmZmVyaW5nKGluc3RhbmNlLmluc3RhbmNlSWQsIGluc3RhbmNlLm9uRGF0YSkpO1xuXHR9XG59XG5cbmNsYXNzIEV4dGVuc2lvblRlcm1pbmFsTGlua1Byb3ZpZGVyIGltcGxlbWVudHMgSVRlcm1pbmFsRXh0ZXJuYWxMaW5rUHJvdmlkZXIge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wcm94eTogRXh0SG9zdFRlcm1pbmFsU2VydmljZVNoYXBlXG5cdCkge1xuXHR9XG5cblx0YXN5bmMgcHJvdmlkZUxpbmtzKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSwgbGluZTogc3RyaW5nKTogUHJvbWlzZTxJVGVybWluYWxMaW5rW10gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBwcm94eSA9IHRoaXMuX3Byb3h5O1xuXHRcdGNvbnN0IGV4dEhvc3RMaW5rcyA9IGF3YWl0IHByb3h5LiRwcm92aWRlTGlua3MoaW5zdGFuY2UuaW5zdGFuY2VJZCwgbGluZSk7XG5cdFx0cmV0dXJuIGV4dEhvc3RMaW5rcy5tYXAoZHRvID0+ICh7XG5cdFx0XHRpZDogZHRvLmlkLFxuXHRcdFx0c3RhcnRJbmRleDogZHRvLnN0YXJ0SW5kZXgsXG5cdFx0XHRsZW5ndGg6IGR0by5sZW5ndGgsXG5cdFx0XHRsYWJlbDogZHRvLmxhYmVsLFxuXHRcdFx0YWN0aXZhdGU6ICgpID0+IHByb3h5LiRhY3RpdmF0ZUxpbmsoaW5zdGFuY2UuaW5zdGFuY2VJZCwgZHRvLmlkKVxuXHRcdH0pKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0T3V0cHV0TWF0Y2hGb3JMaW5lcyhsaW5lczogc3RyaW5nW10sIG91dHB1dE1hdGNoZXI6IElUZXJtaW5hbE91dHB1dE1hdGNoZXIpOiBJVGVybWluYWxPdXRwdXRNYXRjaCB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IG1hdGNoOiBSZWdFeHBNYXRjaEFycmF5IHwgbnVsbCB8IHVuZGVmaW5lZCA9IGxpbmVzLmpvaW4oJ1xcbicpLm1hdGNoKG91dHB1dE1hdGNoZXIubGluZU1hdGNoZXIpO1xuXHRyZXR1cm4gbWF0Y2ggPyB7IHJlZ2V4TWF0Y2g6IG1hdGNoLCBvdXRwdXRMaW5lczogbGluZXMgfSA6IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gcGFyc2VRdWlja0ZpeChpZDogc3RyaW5nLCBzb3VyY2U6IHN0cmluZywgZml4OiBUZXJtaW5hbFF1aWNrRml4KTogSVRlcm1pbmFsUXVpY2tGaXgge1xuXHRsZXQgdHlwZSA9IFRlcm1pbmFsUXVpY2tGaXhUeXBlLlRlcm1pbmFsQ29tbWFuZDtcblx0aWYgKCd1cmknIGluIGZpeCkge1xuXHRcdGZpeC51cmkgPSBVUkkucmV2aXZlKGZpeC51cmkpO1xuXHRcdHR5cGUgPSBUZXJtaW5hbFF1aWNrRml4VHlwZS5PcGVuZXI7XG5cdH0gZWxzZSBpZiAoJ2lkJyBpbiBmaXgpIHtcblx0XHR0eXBlID0gVGVybWluYWxRdWlja0ZpeFR5cGUuVnNjb2RlQ29tbWFuZDtcblx0fVxuXHRyZXR1cm4geyBpZCwgdHlwZSwgc291cmNlLCAuLi5maXggfTtcbn1cblxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7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
