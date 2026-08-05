import * as os from "os";
import { Emitter, Event } from "../../base/common/event.js";
import { cloneAndChange } from "../../base/common/objects.js";
import { Disposable } from "../../base/common/lifecycle.js";
import * as path from "../../base/common/path.js";
import * as platform from "../../base/common/platform.js";
import { URI } from "../../base/common/uri.js";
import { createRandomIPCHandle } from "../../base/parts/ipc/node/ipc.net.js";
import { createURITransformer } from "../../workbench/api/node/uriTransformer.js";
import { CLIServerBase } from "../../workbench/api/node/extHostCLIServer.js";
import { MergedEnvironmentVariableCollection } from "../../platform/terminal/common/environmentVariableCollection.js";
import { deserializeEnvironmentDescriptionMap, deserializeEnvironmentVariableCollection } from "../../platform/terminal/common/environmentVariableShared.js";
import { RemoteTerminalChannelEvent, RemoteTerminalChannelRequest } from "../../workbench/contrib/terminal/common/remote/terminal.js";
import * as terminalEnvironment from "../../workbench/contrib/terminal/common/terminalEnvironment.js";
import { AbstractVariableResolverService } from "../../workbench/services/configurationResolver/common/variableResolver.js";
import { buildUserEnvironment } from "./extensionHostConnection.js";
import { promiseWithResolvers } from "../../base/common/async.js";
import { shouldUseEnvironmentVariableCollection } from "../../platform/terminal/common/terminalEnvironment.js";
class CustomVariableResolver extends AbstractVariableResolverService {
  constructor(env, workspaceFolders, activeFileResource, resolvedVariables, extensionService) {
    super({
      getFolderUri: (folderName) => {
        const found = workspaceFolders.filter((f) => f.name === folderName);
        if (found && found.length > 0) {
          return found[0].uri;
        }
        return void 0;
      },
      getWorkspaceFolderCount: () => {
        return workspaceFolders.length;
      },
      getConfigurationValue: (folderUri, section) => {
        return resolvedVariables[`config:${section}`];
      },
      getExecPath: () => {
        return env["VSCODE_EXEC_PATH"];
      },
      getAppRoot: () => {
        return env["VSCODE_CWD"];
      },
      getFilePath: () => {
        if (activeFileResource) {
          return path.normalize(activeFileResource.fsPath);
        }
        return void 0;
      },
      getSelectedText: () => {
        return resolvedVariables["selectedText"];
      },
      getLineNumber: () => {
        return resolvedVariables["lineNumber"];
      },
      getColumnNumber: () => {
        return resolvedVariables["columnNumber"];
      },
      getExtension: async (id) => {
        const installed = await extensionService.getInstalled();
        const found = installed.find((e) => e.identifier.id === id);
        return found && { extensionLocation: found.location };
      }
    }, void 0, Promise.resolve(os.homedir()), Promise.resolve(env));
  }
}
class RemoteTerminalChannel extends Disposable {
  constructor(_environmentService, _logService, _ptyHostService, _productService, _extensionManagementService, _configurationService) {
    super();
    this._environmentService = _environmentService;
    this._logService = _logService;
    this._ptyHostService = _ptyHostService;
    this._productService = _productService;
    this._extensionManagementService = _extensionManagementService;
    this._configurationService = _configurationService;
    this._lastReqId = 0;
    this._pendingCommands = /* @__PURE__ */ new Map();
    this._onExecuteCommand = this._register(new Emitter());
    this.onExecuteCommand = this._onExecuteCommand.event;
  }
  async call(ctx, command, args) {
    switch (command) {
      case RemoteTerminalChannelRequest.RestartPtyHost:
        return this._ptyHostService.restartPtyHost.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.CreateProcess: {
        const uriTransformer = createURITransformer(ctx.remoteAuthority);
        return this._createProcess(uriTransformer, args);
      }
      case RemoteTerminalChannelRequest.AttachToProcess:
        return this._ptyHostService.attachToProcess.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.DetachFromProcess:
        return this._ptyHostService.detachFromProcess.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.ListProcesses:
        return this._ptyHostService.listProcesses.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.GetLatency:
        return this._ptyHostService.getLatency.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.GetPerformanceMarks:
        return this._ptyHostService.getPerformanceMarks.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.OrphanQuestionReply:
        return this._ptyHostService.orphanQuestionReply.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.AcceptPtyHostResolvedVariables:
        return this._ptyHostService.acceptPtyHostResolvedVariables.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.Start:
        return this._ptyHostService.start.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.Input:
        return this._ptyHostService.input.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.AcknowledgeDataEvent:
        return this._ptyHostService.acknowledgeDataEvent.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.Shutdown:
        return this._ptyHostService.shutdown.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.Resize:
        return this._ptyHostService.resize.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.ClearBuffer:
        return this._ptyHostService.clearBuffer.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.GetInitialCwd:
        return this._ptyHostService.getInitialCwd.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.GetCwd:
        return this._ptyHostService.getCwd.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.ProcessBinary:
        return this._ptyHostService.processBinary.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.SendCommandResult:
        return this._sendCommandResult(args[0], args[1], args[2]);
      case RemoteTerminalChannelRequest.InstallAutoReply:
        return this._ptyHostService.installAutoReply.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.UninstallAllAutoReplies:
        return this._ptyHostService.uninstallAllAutoReplies.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.GetDefaultSystemShell:
        return this._getDefaultSystemShell.apply(this, args);
      case RemoteTerminalChannelRequest.GetProfiles:
        return this._getProfiles.apply(this, args);
      case RemoteTerminalChannelRequest.GetEnvironment:
        return this._getEnvironment();
      case RemoteTerminalChannelRequest.GetWslPath:
        return this._getWslPath(args[0], args[1]);
      case RemoteTerminalChannelRequest.GetTerminalLayoutInfo:
        return this._ptyHostService.getTerminalLayoutInfo(args);
      case RemoteTerminalChannelRequest.SetTerminalLayoutInfo:
        return this._ptyHostService.setTerminalLayoutInfo(args);
      case RemoteTerminalChannelRequest.SerializeTerminalState:
        return this._ptyHostService.serializeTerminalState.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.ReviveTerminalProcesses:
        return this._ptyHostService.reviveTerminalProcesses.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.GetRevivedPtyNewId:
        return this._ptyHostService.getRevivedPtyNewId.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.SetUnicodeVersion:
        return this._ptyHostService.setUnicodeVersion.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.ReduceConnectionGraceTime:
        return this._reduceConnectionGraceTime();
      case RemoteTerminalChannelRequest.UpdateIcon:
        return this._ptyHostService.updateIcon.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.UpdateTitle:
        return this._ptyHostService.updateTitle.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.UpdateProperty:
        return this._ptyHostService.updateProperty.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.RefreshProperty:
        return this._ptyHostService.refreshProperty.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.RequestDetachInstance:
        return this._ptyHostService.requestDetachInstance(args[0], args[1]);
      case RemoteTerminalChannelRequest.AcceptDetachedInstance:
        return this._ptyHostService.acceptDetachInstanceReply(args[0], args[1]);
      case RemoteTerminalChannelRequest.FreePortKillProcess:
        return this._ptyHostService.freePortKillProcess.apply(this._ptyHostService, args);
      case RemoteTerminalChannelRequest.AcceptDetachInstanceReply:
        return this._ptyHostService.acceptDetachInstanceReply.apply(this._ptyHostService, args);
    }
    throw new Error(`IPC Command ${command} not found`);
  }
  listen(_, event, arg) {
    switch (event) {
      case RemoteTerminalChannelEvent.OnPtyHostExitEvent:
        return this._ptyHostService.onPtyHostExit || Event.None;
      case RemoteTerminalChannelEvent.OnPtyHostStartEvent:
        return this._ptyHostService.onPtyHostStart || Event.None;
      case RemoteTerminalChannelEvent.OnPtyHostUnresponsiveEvent:
        return this._ptyHostService.onPtyHostUnresponsive || Event.None;
      case RemoteTerminalChannelEvent.OnPtyHostResponsiveEvent:
        return this._ptyHostService.onPtyHostResponsive || Event.None;
      case RemoteTerminalChannelEvent.OnPtyHostRequestResolveVariablesEvent:
        return this._ptyHostService.onPtyHostRequestResolveVariables || Event.None;
      case RemoteTerminalChannelEvent.OnProcessDataEvent:
        return this._ptyHostService.onProcessData;
      case RemoteTerminalChannelEvent.OnProcessReadyEvent:
        return this._ptyHostService.onProcessReady;
      case RemoteTerminalChannelEvent.OnProcessExitEvent:
        return this._ptyHostService.onProcessExit;
      case RemoteTerminalChannelEvent.OnProcessReplayEvent:
        return this._ptyHostService.onProcessReplay;
      case RemoteTerminalChannelEvent.OnProcessOrphanQuestion:
        return this._ptyHostService.onProcessOrphanQuestion;
      case RemoteTerminalChannelEvent.OnExecuteCommand:
        return this.onExecuteCommand;
      case RemoteTerminalChannelEvent.OnDidRequestDetach:
        return this._ptyHostService.onDidRequestDetach || Event.None;
      case RemoteTerminalChannelEvent.OnDidChangeProperty:
        return this._ptyHostService.onDidChangeProperty;
    }
    throw new Error(`IPC Command ${event} not found`);
  }
  async _createProcess(uriTransformer, args) {
    const shellLaunchConfig = {
      name: args.shellLaunchConfig.name,
      executable: args.shellLaunchConfig.executable,
      args: args.shellLaunchConfig.args,
      cwd: typeof args.shellLaunchConfig.cwd === "string" || typeof args.shellLaunchConfig.cwd === "undefined" ? args.shellLaunchConfig.cwd : URI.revive(uriTransformer.transformIncoming(args.shellLaunchConfig.cwd)),
      env: args.shellLaunchConfig.env,
      useShellEnvironment: args.shellLaunchConfig.useShellEnvironment,
      reconnectionProperties: args.shellLaunchConfig.reconnectionProperties,
      type: args.shellLaunchConfig.type,
      isFeatureTerminal: args.shellLaunchConfig.isFeatureTerminal,
      tabActions: args.shellLaunchConfig.tabActions,
      shellIntegrationEnvironmentReporting: args.shellLaunchConfig.shellIntegrationEnvironmentReporting
    };
    const baseEnv = await buildUserEnvironment(args.resolverEnv, !!args.shellLaunchConfig.useShellEnvironment, platform.language, this._environmentService, this._logService, this._configurationService);
    this._logService.trace("baseEnv", baseEnv);
    const reviveWorkspaceFolder = (workspaceData) => {
      return {
        uri: URI.revive(uriTransformer.transformIncoming(workspaceData.uri)),
        name: workspaceData.name,
        index: workspaceData.index,
        toResource: () => {
          throw new Error("Not implemented");
        }
      };
    };
    const workspaceFolders = args.workspaceFolders.map(reviveWorkspaceFolder);
    const activeWorkspaceFolder = args.activeWorkspaceFolder ? reviveWorkspaceFolder(args.activeWorkspaceFolder) : void 0;
    const activeFileResource = args.activeFileResource ? URI.revive(uriTransformer.transformIncoming(args.activeFileResource)) : void 0;
    const customVariableResolver = new CustomVariableResolver(baseEnv, workspaceFolders, activeFileResource, args.resolvedVariables, this._extensionManagementService);
    const variableResolver = terminalEnvironment.createVariableResolver(activeWorkspaceFolder, process.env, customVariableResolver);
    const initialCwd = await terminalEnvironment.getCwd(shellLaunchConfig, os.homedir(), variableResolver, activeWorkspaceFolder?.uri, args.configuration["terminal.integrated.cwd"], this._logService);
    shellLaunchConfig.cwd = initialCwd;
    const envPlatformKey = platform.isWindows ? "terminal.integrated.env.windows" : platform.isMacintosh ? "terminal.integrated.env.osx" : "terminal.integrated.env.linux";
    const envFromConfig = args.configuration[envPlatformKey];
    const env = await terminalEnvironment.createTerminalEnvironment(
      shellLaunchConfig,
      envFromConfig,
      variableResolver,
      this._productService.version,
      args.configuration["terminal.integrated.detectLocale"],
      baseEnv
    );
    if (shouldUseEnvironmentVariableCollection(shellLaunchConfig)) {
      const entries = [];
      for (const [k, v, d] of args.envVariableCollections) {
        entries.push([k, { map: deserializeEnvironmentVariableCollection(v), descriptionMap: deserializeEnvironmentDescriptionMap(d) }]);
      }
      const envVariableCollections = new Map(entries);
      const mergedCollection = new MergedEnvironmentVariableCollection(envVariableCollections);
      const workspaceFolder = activeWorkspaceFolder ? activeWorkspaceFolder ?? void 0 : void 0;
      await mergedCollection.applyToProcessEnvironment(env, { workspaceFolder }, variableResolver);
    }
    this._logService.debug(`Terminal process launching on remote agent`, { shellLaunchConfig, initialCwd, cols: args.cols, rows: args.rows, env });
    const ipcHandlePath = createRandomIPCHandle();
    env.VSCODE_IPC_HOOK_CLI = ipcHandlePath;
    const persistentProcessId = await this._ptyHostService.createProcess(shellLaunchConfig, initialCwd, args.cols, args.rows, args.unicodeVersion, env, baseEnv, args.options, args.shouldPersistTerminal, args.workspaceId, args.workspaceName);
    const commandsExecuter = {
      executeCommand: (id, ...args2) => this._executeCommand(persistentProcessId, id, args2, uriTransformer)
    };
    const cliServer = new CLIServerBase(commandsExecuter, this._logService, ipcHandlePath);
    this._ptyHostService.onProcessExit((e) => e.id === persistentProcessId && cliServer.dispose());
    return {
      persistentTerminalId: persistentProcessId,
      resolvedShellLaunchConfig: shellLaunchConfig
    };
  }
  _executeCommand(persistentProcessId, commandId, commandArgs, uriTransformer) {
    const { resolve, reject, promise } = promiseWithResolvers();
    const reqId = ++this._lastReqId;
    this._pendingCommands.set(reqId, { resolve, reject, uriTransformer });
    const serializedCommandArgs = cloneAndChange(commandArgs, (obj) => {
      if (obj && obj.$mid === 1) {
        return uriTransformer.transformOutgoing(obj);
      }
      if (obj && obj instanceof URI) {
        return uriTransformer.transformOutgoingURI(obj);
      }
      return void 0;
    });
    this._onExecuteCommand.fire({
      reqId,
      persistentProcessId,
      commandId,
      commandArgs: serializedCommandArgs
    });
    return promise;
  }
  _sendCommandResult(reqId, isError, serializedPayload) {
    const data = this._pendingCommands.get(reqId);
    if (!data) {
      return;
    }
    this._pendingCommands.delete(reqId);
    const payload = cloneAndChange(serializedPayload, (obj) => {
      if (obj && obj.$mid === 1) {
        return data.uriTransformer.transformIncoming(obj);
      }
      return void 0;
    });
    if (isError) {
      data.reject(payload);
    } else {
      data.resolve(payload);
    }
  }
  _getDefaultSystemShell(osOverride) {
    return this._ptyHostService.getDefaultSystemShell(osOverride);
  }
  async _getProfiles(workspaceId, profiles, defaultProfile, includeDetectedProfiles) {
    return this._ptyHostService.getProfiles(workspaceId, profiles, defaultProfile, includeDetectedProfiles) || [];
  }
  _getEnvironment() {
    return { ...process.env };
  }
  _getWslPath(original, direction) {
    return this._ptyHostService.getWslPath(original, direction);
  }
  _reduceConnectionGraceTime() {
    return this._ptyHostService.reduceConnectionGraceTime();
  }
}
export {
  RemoteTerminalChannel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9zZXJ2ZXIvbm9kZS9yZW1vdGVUZXJtaW5hbENoYW5uZWwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBvcyBmcm9tICdvcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGNsb25lQW5kQ2hhbmdlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgKiBhcyBwbGF0Zm9ybSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSVVSSVRyYW5zZm9ybWVyIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vdXJpSXBjLmpzJztcbmltcG9ydCB7IElTZXJ2ZXJDaGFubmVsIH0gZnJvbSAnLi4vLi4vYmFzZS9wYXJ0cy9pcGMvY29tbW9uL2lwYy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVSYW5kb21JUENIYW5kbGUgfSBmcm9tICcuLi8uLi9iYXNlL3BhcnRzL2lwYy9ub2RlL2lwYy5uZXQuanMnO1xuaW1wb3J0IHsgUmVtb3RlQWdlbnRDb25uZWN0aW9uQ29udGV4dCB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3JlbW90ZS9jb21tb24vcmVtb3RlQWdlbnRFbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBJUHR5SG9zdFNlcnZpY2UsIElTaGVsbExhdW5jaENvbmZpZywgSVRlcm1pbmFsUHJvZmlsZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi90ZXJtaW5hbC5qcyc7XG5pbXBvcnQgeyBJR2V0VGVybWluYWxMYXlvdXRJbmZvQXJncywgSVNldFRlcm1pbmFsTGF5b3V0SW5mb0FyZ3MgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWxQcm9jZXNzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VGb2xkZXIgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVVUklUcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uL3dvcmtiZW5jaC9hcGkvbm9kZS91cmlUcmFuc2Zvcm1lci5qcyc7XG5pbXBvcnQgeyBDTElTZXJ2ZXJCYXNlLCBJQ29tbWFuZHNFeGVjdXRlciB9IGZyb20gJy4uLy4uL3dvcmtiZW5jaC9hcGkvbm9kZS9leHRIb3N0Q0xJU2VydmVyLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9lbnZpcm9ubWVudFZhcmlhYmxlLmpzJztcbmltcG9ydCB7IE1lcmdlZEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL2Vudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IGRlc2VyaWFsaXplRW52aXJvbm1lbnREZXNjcmlwdGlvbk1hcCwgZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9lbnZpcm9ubWVudFZhcmlhYmxlU2hhcmVkLmpzJztcbmltcG9ydCB7IElDcmVhdGVUZXJtaW5hbFByb2Nlc3NBcmd1bWVudHMsIElDcmVhdGVUZXJtaW5hbFByb2Nlc3NSZXN1bHQsIElXb3Jrc3BhY2VGb2xkZXJEYXRhLCBSZW1vdGVUZXJtaW5hbENoYW5uZWxFdmVudCwgUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdCB9IGZyb20gJy4uLy4uL3dvcmtiZW5jaC9jb250cmliL3Rlcm1pbmFsL2NvbW1vbi9yZW1vdGUvdGVybWluYWwuanMnO1xuaW1wb3J0ICogYXMgdGVybWluYWxFbnZpcm9ubWVudCBmcm9tICcuLi8uLi93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9jb21tb24vdGVybWluYWxFbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdFZhcmlhYmxlUmVzb2x2ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vd29ya2JlbmNoL3NlcnZpY2VzL2NvbmZpZ3VyYXRpb25SZXNvbHZlci9jb21tb24vdmFyaWFibGVSZXNvbHZlci5qcyc7XG5pbXBvcnQgeyBidWlsZFVzZXJFbnZpcm9ubWVudCB9IGZyb20gJy4vZXh0ZW5zaW9uSG9zdENvbm5lY3Rpb24uanMnO1xuaW1wb3J0IHsgSVNlcnZlckVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4vc2VydmVyRW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IHByb21pc2VXaXRoUmVzb2x2ZXJzIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgc2hvdWxkVXNlRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWxFbnZpcm9ubWVudC5qcyc7XG5cbmNsYXNzIEN1c3RvbVZhcmlhYmxlUmVzb2x2ZXIgZXh0ZW5kcyBBYnN0cmFjdFZhcmlhYmxlUmVzb2x2ZXJTZXJ2aWNlIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0ZW52OiBwbGF0Zm9ybS5JUHJvY2Vzc0Vudmlyb25tZW50LFxuXHRcdHdvcmtzcGFjZUZvbGRlcnM6IElXb3Jrc3BhY2VGb2xkZXJbXSxcblx0XHRhY3RpdmVGaWxlUmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCxcblx0XHRyZXNvbHZlZFZhcmlhYmxlczogeyBbbmFtZTogc3RyaW5nXTogc3RyaW5nIH0sXG5cdFx0ZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRnZXRGb2xkZXJVcmk6IChmb2xkZXJOYW1lOiBzdHJpbmcpOiBVUkkgfCB1bmRlZmluZWQgPT4ge1xuXHRcdFx0XHRjb25zdCBmb3VuZCA9IHdvcmtzcGFjZUZvbGRlcnMuZmlsdGVyKGYgPT4gZi5uYW1lID09PSBmb2xkZXJOYW1lKTtcblx0XHRcdFx0aWYgKGZvdW5kICYmIGZvdW5kLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRyZXR1cm4gZm91bmRbMF0udXJpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0V29ya3NwYWNlRm9sZGVyQ291bnQ6ICgpOiBudW1iZXIgPT4ge1xuXHRcdFx0XHRyZXR1cm4gd29ya3NwYWNlRm9sZGVycy5sZW5ndGg7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0Q29uZmlndXJhdGlvblZhbHVlOiAoZm9sZGVyVXJpOiBVUkksIHNlY3Rpb246IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCA9PiB7XG5cdFx0XHRcdHJldHVybiByZXNvbHZlZFZhcmlhYmxlc1tgY29uZmlnOiR7c2VjdGlvbn1gXTtcblx0XHRcdH0sXG5cdFx0XHRnZXRFeGVjUGF0aDogKCk6IHN0cmluZyB8IHVuZGVmaW5lZCA9PiB7XG5cdFx0XHRcdHJldHVybiBlbnZbJ1ZTQ09ERV9FWEVDX1BBVEgnXTtcblx0XHRcdH0sXG5cdFx0XHRnZXRBcHBSb290OiAoKTogc3RyaW5nIHwgdW5kZWZpbmVkID0+IHtcblx0XHRcdFx0cmV0dXJuIGVudlsnVlNDT0RFX0NXRCddO1xuXHRcdFx0fSxcblx0XHRcdGdldEZpbGVQYXRoOiAoKTogc3RyaW5nIHwgdW5kZWZpbmVkID0+IHtcblx0XHRcdFx0aWYgKGFjdGl2ZUZpbGVSZXNvdXJjZSkge1xuXHRcdFx0XHRcdHJldHVybiBwYXRoLm5vcm1hbGl6ZShhY3RpdmVGaWxlUmVzb3VyY2UuZnNQYXRoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fSxcblx0XHRcdGdldFNlbGVjdGVkVGV4dDogKCk6IHN0cmluZyB8IHVuZGVmaW5lZCA9PiB7XG5cdFx0XHRcdHJldHVybiByZXNvbHZlZFZhcmlhYmxlc1snc2VsZWN0ZWRUZXh0J107XG5cdFx0XHR9LFxuXHRcdFx0Z2V0TGluZU51bWJlcjogKCk6IHN0cmluZyB8IHVuZGVmaW5lZCA9PiB7XG5cdFx0XHRcdHJldHVybiByZXNvbHZlZFZhcmlhYmxlc1snbGluZU51bWJlciddO1xuXHRcdFx0fSxcblx0XHRcdGdldENvbHVtbk51bWJlcjogKCk6IHN0cmluZyB8IHVuZGVmaW5lZCA9PiB7XG5cdFx0XHRcdHJldHVybiByZXNvbHZlZFZhcmlhYmxlc1snY29sdW1uTnVtYmVyJ107XG5cdFx0XHR9LFxuXHRcdFx0Z2V0RXh0ZW5zaW9uOiBhc3luYyBpZCA9PiB7XG5cdFx0XHRcdGNvbnN0IGluc3RhbGxlZCA9IGF3YWl0IGV4dGVuc2lvblNlcnZpY2UuZ2V0SW5zdGFsbGVkKCk7XG5cdFx0XHRcdGNvbnN0IGZvdW5kID0gaW5zdGFsbGVkLmZpbmQoZSA9PiBlLmlkZW50aWZpZXIuaWQgPT09IGlkKTtcblx0XHRcdFx0cmV0dXJuIGZvdW5kICYmIHsgZXh0ZW5zaW9uTG9jYXRpb246IGZvdW5kLmxvY2F0aW9uIH07XG5cdFx0XHR9LFxuXHRcdH0sIHVuZGVmaW5lZCwgUHJvbWlzZS5yZXNvbHZlKG9zLmhvbWVkaXIoKSksIFByb21pc2UucmVzb2x2ZShlbnYpKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUmVtb3RlVGVybWluYWxDaGFubmVsIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElTZXJ2ZXJDaGFubmVsPFJlbW90ZUFnZW50Q29ubmVjdGlvbkNvbnRleHQ+IHtcblxuXHRwcml2YXRlIF9sYXN0UmVxSWQgPSAwO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wZW5kaW5nQ29tbWFuZHMgPSBuZXcgTWFwPG51bWJlciwge1xuXHRcdHJlc29sdmU6IChkYXRhOiBhbnkpID0+IHZvaWQ7XG5cdFx0cmVqZWN0OiAoZXJyOiBhbnkpID0+IHZvaWQ7XG5cdFx0dXJpVHJhbnNmb3JtZXI6IElVUklUcmFuc2Zvcm1lcjtcblx0fT4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkV4ZWN1dGVDb21tYW5kID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyByZXFJZDogbnVtYmVyOyBwZXJzaXN0ZW50UHJvY2Vzc0lkOiBudW1iZXI7IGNvbW1hbmRJZDogc3RyaW5nOyBjb21tYW5kQXJnczogYW55W10gfT4oKSk7XG5cdHJlYWRvbmx5IG9uRXhlY3V0ZUNvbW1hbmQgPSB0aGlzLl9vbkV4ZWN1dGVDb21tYW5kLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2Vudmlyb25tZW50U2VydmljZTogSVNlcnZlckVudmlyb25tZW50U2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wdHlIb3N0U2VydmljZTogSVB0eUhvc3RTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2U6IElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHRhc3luYyBjYWxsKGN0eDogUmVtb3RlQWdlbnRDb25uZWN0aW9uQ29udGV4dCwgY29tbWFuZDogUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdCwgYXJncz86IGFueSk6IFByb21pc2U8YW55PiB7XG5cdFx0c3dpdGNoIChjb21tYW5kKSB7XG5cdFx0XHRjYXNlIFJlbW90ZVRlcm1pbmFsQ2hhbm5lbFJlcXVlc3QuUmVzdGFydFB0eUhvc3Q6IHJldHVybiB0aGlzLl9wdHlIb3N0U2VydmljZS5yZXN0YXJ0UHR5SG9zdC5hcHBseSh0aGlzLl9wdHlIb3N0U2VydmljZSwgYXJncyk7XG5cblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdC5DcmVhdGVQcm9jZXNzOiB7XG5cdFx0XHRcdGNvbnN0IHVyaVRyYW5zZm9ybWVyID0gY3JlYXRlVVJJVHJhbnNmb3JtZXIoY3R4LnJlbW90ZUF1dGhvcml0eSk7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9jcmVhdGVQcm9jZXNzKHVyaVRyYW5zZm9ybWVyLCA8SUNyZWF0ZVRlcm1pbmFsUHJvY2Vzc0FyZ3VtZW50cz5hcmdzKTtcblx0XHRcdH1cblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdC5BdHRhY2hUb1Byb2Nlc3M6IHJldHVybiB0aGlzLl9wdHlIb3N0U2VydmljZS5hdHRhY2hUb1Byb2Nlc3MuYXBwbHkodGhpcy5fcHR5SG9zdFNlcnZpY2UsIGFyZ3MpO1xuXHRcdFx0Y2FzZSBSZW1vdGVUZXJtaW5hbENoYW5uZWxSZXF1ZXN0LkRldGFjaEZyb21Qcm9jZXNzOiByZXR1cm4gdGhpcy5fcHR5SG9zdFNlcnZpY2UuZGV0YWNoRnJvbVByb2Nlc3MuYXBwbHkodGhpcy5fcHR5SG9zdFNlcnZpY2UsIGFyZ3MpO1xuXG5cdFx0XHRjYXNlIFJlbW90ZVRlcm1pbmFsQ2hhbm5lbFJlcXVlc3QuTGlzdFByb2Nlc3NlczogcmV0dXJuIHRoaXMuX3B0eUhvc3RTZXJ2aWNlLmxpc3RQcm9jZXNzZXMuYXBwbHkodGhpcy5fcHR5SG9zdFNlcnZpY2UsIGFyZ3MpO1xuXHRcdFx0Y2FzZSBSZW1vdGVUZXJtaW5hbENoYW5uZWxSZXF1ZXN0LkdldExhdGVuY3k6IHJldHVybiB0aGlzLl9wdHlIb3N0U2VydmljZS5nZXRMYXRlbmN5LmFwcGx5KHRoaXMuX3B0eUhvc3RTZXJ2aWNlLCBhcmdzKTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdC5HZXRQZXJmb3JtYW5jZU1hcmtzOiByZXR1cm4gdGhpcy5fcHR5SG9zdFNlcnZpY2UuZ2V0UGVyZm9ybWFuY2VNYXJrcy5hcHBseSh0aGlzLl9wdHlIb3N0U2VydmljZSwgYXJncyk7XG5cdFx0XHRjYXNlIFJlbW90ZVRlcm1pbmFsQ2hhbm5lbFJlcXVlc3QuT3JwaGFuUXVlc3Rpb25SZXBseTogcmV0dXJuIHRoaXMuX3B0eUhvc3RTZXJ2aWNlLm9ycGhhblF1ZXN0aW9uUmVwbHkuYXBwbHkodGhpcy5fcHR5SG9zdFNlcnZpY2UsIGFyZ3MpO1xuXHRcdFx0Y2FzZSBSZW1vdGVUZXJtaW5hbENoYW5uZWxSZXF1ZXN0LkFjY2VwdFB0eUhvc3RSZXNvbHZlZFZhcmlhYmxlczogcmV0dXJuIHRoaXMuX3B0eUhvc3RTZXJ2aWNlLmFjY2VwdFB0eUhvc3RSZXNvbHZlZFZhcmlhYmxlcy5hcHBseSh0aGlzLl9wdHlIb3N0U2VydmljZSwgYXJncyk7XG5cblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdC5TdGFydDogcmV0dXJuIHRoaXMuX3B0eUhvc3RTZXJ2aWNlLnN0YXJ0LmFwcGx5KHRoaXMuX3B0eUhvc3RTZXJ2aWNlLCBhcmdzKTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdC5JbnB1dDogcmV0dXJuIHRoaXMuX3B0eUhvc3RTZXJ2aWNlLmlucHV0LmFwcGx5KHRoaXMuX3B0eUhvc3RTZXJ2aWNlLCBhcmdzKTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdC5BY2tub3dsZWRnZURhdGFFdmVudDogcmV0dXJuIHRoaXMuX3B0eUhvc3RTZXJ2aWNlLmFja25vd2xlZGdlRGF0YUV2ZW50LmFwcGx5KHRoaXMuX3B0eUhvc3RTZXJ2aWNlLCBhcmdzKTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdC5TaHV0ZG93bjogcmV0dXJuIHRoaXMuX3B0eUhvc3RTZXJ2aWNlLnNodXRkb3duLmFwcGx5KHRoaXMuX3B0eUhvc3RTZXJ2aWNlLCBhcmdzKTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdC5SZXNpemU6IHJldHVybiB0aGlzLl9wdHlIb3N0U2VydmljZS5yZXNpemUuYXBwbHkodGhpcy5fcHR5SG9zdFNlcnZpY2UsIGFyZ3MpO1xuXHRcdFx0Y2FzZSBSZW1vdGVUZXJtaW5hbENoYW5uZWxSZXF1ZXN0LkNsZWFyQnVmZmVyOiByZXR1cm4gdGhpcy5fcHR5SG9zdFNlcnZpY2UuY2xlYXJCdWZmZXIuYXBwbHkodGhpcy5fcHR5SG9zdFNlcnZpY2UsIGFyZ3MpO1xuXHRcdFx0Y2FzZSBSZW1vdGVUZXJtaW5hbENoYW5uZWxSZXF1ZXN0LkdldEluaXRpYWxDd2Q6IHJldHVybiB0aGlzLl9wdHlIb3N0U2VydmljZS5nZXRJbml0aWFsQ3dkLmFwcGx5KHRoaXMuX3B0eUhvc3RTZXJ2aWNlLCBhcmdzKTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdC5HZXRDd2Q6IHJldHVybiB0aGlzLl9wdHlIb3N0U2VydmljZS5nZXRDd2QuYXBwbHkodGhpcy5fcHR5SG9zdFNlcnZpY2UsIGFyZ3MpO1xuXG5cdFx0XHRjYXNlIFJlbW90ZVRlcm1pbmFsQ2hhbm5lbFJlcXVlc3QuUHJvY2Vzc0JpbmFyeTogcmV0dXJuIHRoaXMuX3B0eUhvc3RTZXJ2aWNlLnByb2Nlc3NCaW5hcnkuYXBwbHkodGhpcy5fcHR5SG9zdFNlcnZpY2UsIGFyZ3MpO1xuXG5cdFx0XHRjYXNlIFJlbW90ZVRlcm1pbmFsQ2hhbm5lbFJlcXVlc3QuU2VuZENvbW1hbmRSZXN1bHQ6IHJldHVybiB0aGlzLl9zZW5kQ29tbWFuZFJlc3VsdChhcmdzWzBdLCBhcmdzWzFdLCBhcmdzWzJdKTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdC5JbnN0YWxsQXV0b1JlcGx5OiByZXR1cm4gdGhpcy5fcHR5SG9zdFNlcnZpY2UuaW5zdGFsbEF1dG9SZXBseS5hcHBseSh0aGlzLl9wdHlIb3N0U2VydmljZSwgYXJncyk7XG5cdFx0XHRjYXNlIFJlbW90ZVRlcm1pbmFsQ2hhbm5lbFJlcXVlc3QuVW5pbnN0YWxsQWxsQXV0b1JlcGxpZXM6IHJldHVybiB0aGlzLl9wdHlIb3N0U2VydmljZS51bmluc3RhbGxBbGxBdXRvUmVwbGllcy5hcHBseSh0aGlzLl9wdHlIb3N0U2VydmljZSwgYXJncyk7XG5cdFx0XHRjYXNlIFJlbW90ZVRlcm1pbmFsQ2hhbm5lbFJlcXVlc3QuR2V0RGVmYXVsdFN5c3RlbVNoZWxsOiByZXR1cm4gdGhpcy5fZ2V0RGVmYXVsdFN5c3RlbVNoZWxsLmFwcGx5KHRoaXMsIGFyZ3MpO1xuXHRcdFx0Y2FzZSBSZW1vdGVUZXJtaW5hbENoYW5uZWxSZXF1ZXN0LkdldFByb2ZpbGVzOiByZXR1cm4gdGhpcy5fZ2V0UHJvZmlsZXMuYXBwbHkodGhpcywgYXJncyk7XG5cdFx0XHRjYXNlIFJlbW90ZVRlcm1pbmFsQ2hhbm5lbFJlcXVlc3QuR2V0RW52aXJvbm1lbnQ6IHJldHVybiB0aGlzLl9nZXRFbnZpcm9ubWVudCgpO1xuXHRcdFx0Y2FzZSBSZW1vdGVUZXJtaW5hbENoYW5uZWxSZXF1ZXN0LkdldFdzbFBhdGg6IHJldHVybiB0aGlzLl9nZXRXc2xQYXRoKGFyZ3NbMF0sIGFyZ3NbMV0pO1xuXHRcdFx0Y2FzZSBSZW1vdGVUZXJtaW5hbENoYW5uZWxSZXF1ZXN0LkdldFRlcm1pbmFsTGF5b3V0SW5mbzogcmV0dXJuIHRoaXMuX3B0eUhvc3RTZXJ2aWNlLmdldFRlcm1pbmFsTGF5b3V0SW5mbyg8SUdldFRlcm1pbmFsTGF5b3V0SW5mb0FyZ3M+YXJncyk7XG5cdFx0XHRjYXNlIFJlbW90ZVRlcm1pbmFsQ2hhbm5lbFJlcXVlc3QuU2V0VGVybWluYWxMYXlvdXRJbmZvOiByZXR1cm4gdGhpcy5fcHR5SG9zdFNlcnZpY2Uuc2V0VGVybWluYWxMYXlvdXRJbmZvKDxJU2V0VGVybWluYWxMYXlvdXRJbmZvQXJncz5hcmdzKTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdC5TZXJpYWxpemVUZXJtaW5hbFN0YXRlOiByZXR1cm4gdGhpcy5fcHR5SG9zdFNlcnZpY2Uuc2VyaWFsaXplVGVybWluYWxTdGF0ZS5hcHBseSh0aGlzLl9wdHlIb3N0U2VydmljZSwgYXJncyk7XG5cdFx0XHRjYXNlIFJlbW90ZVRlcm1pbmFsQ2hhbm5lbFJlcXVlc3QuUmV2aXZlVGVybWluYWxQcm9jZXNzZXM6IHJldHVybiB0aGlzLl9wdHlIb3N0U2VydmljZS5yZXZpdmVUZXJtaW5hbFByb2Nlc3Nlcy5hcHBseSh0aGlzLl9wdHlIb3N0U2VydmljZSwgYXJncyk7XG5cdFx0XHRjYXNlIFJlbW90ZVRlcm1pbmFsQ2hhbm5lbFJlcXVlc3QuR2V0UmV2aXZlZFB0eU5ld0lkOiByZXR1cm4gdGhpcy5fcHR5SG9zdFNlcnZpY2UuZ2V0UmV2aXZlZFB0eU5ld0lkLmFwcGx5KHRoaXMuX3B0eUhvc3RTZXJ2aWNlLCBhcmdzKTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdC5TZXRVbmljb2RlVmVyc2lvbjogcmV0dXJuIHRoaXMuX3B0eUhvc3RTZXJ2aWNlLnNldFVuaWNvZGVWZXJzaW9uLmFwcGx5KHRoaXMuX3B0eUhvc3RTZXJ2aWNlLCBhcmdzKTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdC5SZWR1Y2VDb25uZWN0aW9uR3JhY2VUaW1lOiByZXR1cm4gdGhpcy5fcmVkdWNlQ29ubmVjdGlvbkdyYWNlVGltZSgpO1xuXHRcdFx0Y2FzZSBSZW1vdGVUZXJtaW5hbENoYW5uZWxSZXF1ZXN0LlVwZGF0ZUljb246IHJldHVybiB0aGlzLl9wdHlIb3N0U2VydmljZS51cGRhdGVJY29uLmFwcGx5KHRoaXMuX3B0eUhvc3RTZXJ2aWNlLCBhcmdzKTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdC5VcGRhdGVUaXRsZTogcmV0dXJuIHRoaXMuX3B0eUhvc3RTZXJ2aWNlLnVwZGF0ZVRpdGxlLmFwcGx5KHRoaXMuX3B0eUhvc3RTZXJ2aWNlLCBhcmdzKTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdC5VcGRhdGVQcm9wZXJ0eTogcmV0dXJuIHRoaXMuX3B0eUhvc3RTZXJ2aWNlLnVwZGF0ZVByb3BlcnR5LmFwcGx5KHRoaXMuX3B0eUhvc3RTZXJ2aWNlLCBhcmdzKTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdC5SZWZyZXNoUHJvcGVydHk6IHJldHVybiB0aGlzLl9wdHlIb3N0U2VydmljZS5yZWZyZXNoUHJvcGVydHkuYXBwbHkodGhpcy5fcHR5SG9zdFNlcnZpY2UsIGFyZ3MpO1xuXHRcdFx0Y2FzZSBSZW1vdGVUZXJtaW5hbENoYW5uZWxSZXF1ZXN0LlJlcXVlc3REZXRhY2hJbnN0YW5jZTogcmV0dXJuIHRoaXMuX3B0eUhvc3RTZXJ2aWNlLnJlcXVlc3REZXRhY2hJbnN0YW5jZShhcmdzWzBdLCBhcmdzWzFdKTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdC5BY2NlcHREZXRhY2hlZEluc3RhbmNlOiByZXR1cm4gdGhpcy5fcHR5SG9zdFNlcnZpY2UuYWNjZXB0RGV0YWNoSW5zdGFuY2VSZXBseShhcmdzWzBdLCBhcmdzWzFdKTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsUmVxdWVzdC5GcmVlUG9ydEtpbGxQcm9jZXNzOiByZXR1cm4gdGhpcy5fcHR5SG9zdFNlcnZpY2UuZnJlZVBvcnRLaWxsUHJvY2Vzcy5hcHBseSh0aGlzLl9wdHlIb3N0U2VydmljZSwgYXJncyk7XG5cdFx0XHRjYXNlIFJlbW90ZVRlcm1pbmFsQ2hhbm5lbFJlcXVlc3QuQWNjZXB0RGV0YWNoSW5zdGFuY2VSZXBseTogcmV0dXJuIHRoaXMuX3B0eUhvc3RTZXJ2aWNlLmFjY2VwdERldGFjaEluc3RhbmNlUmVwbHkuYXBwbHkodGhpcy5fcHR5SG9zdFNlcnZpY2UsIGFyZ3MpO1xuXHRcdH1cblxuXHRcdC8vIEB0cy1leHBlY3QtZXJyb3IgQXNzZXJ0IGNvbW1hbmQgaXMgdGhlIGBuZXZlcmAgdHlwZSB0byBlbnN1cmUgYWxsIG1lc3NhZ2VzIGFyZSBoYW5kbGVkXG5cdFx0dGhyb3cgbmV3IEVycm9yKGBJUEMgQ29tbWFuZCAke2NvbW1hbmR9IG5vdCBmb3VuZGApO1xuXHR9XG5cblx0bGlzdGVuKF86IGFueSwgZXZlbnQ6IFJlbW90ZVRlcm1pbmFsQ2hhbm5lbEV2ZW50LCBhcmc6IGFueSk6IEV2ZW50PGFueT4ge1xuXHRcdHN3aXRjaCAoZXZlbnQpIHtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsRXZlbnQuT25QdHlIb3N0RXhpdEV2ZW50OiByZXR1cm4gdGhpcy5fcHR5SG9zdFNlcnZpY2Uub25QdHlIb3N0RXhpdCB8fCBFdmVudC5Ob25lO1xuXHRcdFx0Y2FzZSBSZW1vdGVUZXJtaW5hbENoYW5uZWxFdmVudC5PblB0eUhvc3RTdGFydEV2ZW50OiByZXR1cm4gdGhpcy5fcHR5SG9zdFNlcnZpY2Uub25QdHlIb3N0U3RhcnQgfHwgRXZlbnQuTm9uZTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsRXZlbnQuT25QdHlIb3N0VW5yZXNwb25zaXZlRXZlbnQ6IHJldHVybiB0aGlzLl9wdHlIb3N0U2VydmljZS5vblB0eUhvc3RVbnJlc3BvbnNpdmUgfHwgRXZlbnQuTm9uZTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsRXZlbnQuT25QdHlIb3N0UmVzcG9uc2l2ZUV2ZW50OiByZXR1cm4gdGhpcy5fcHR5SG9zdFNlcnZpY2Uub25QdHlIb3N0UmVzcG9uc2l2ZSB8fCBFdmVudC5Ob25lO1xuXHRcdFx0Y2FzZSBSZW1vdGVUZXJtaW5hbENoYW5uZWxFdmVudC5PblB0eUhvc3RSZXF1ZXN0UmVzb2x2ZVZhcmlhYmxlc0V2ZW50OiByZXR1cm4gdGhpcy5fcHR5SG9zdFNlcnZpY2Uub25QdHlIb3N0UmVxdWVzdFJlc29sdmVWYXJpYWJsZXMgfHwgRXZlbnQuTm9uZTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsRXZlbnQuT25Qcm9jZXNzRGF0YUV2ZW50OiByZXR1cm4gdGhpcy5fcHR5SG9zdFNlcnZpY2Uub25Qcm9jZXNzRGF0YTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsRXZlbnQuT25Qcm9jZXNzUmVhZHlFdmVudDogcmV0dXJuIHRoaXMuX3B0eUhvc3RTZXJ2aWNlLm9uUHJvY2Vzc1JlYWR5O1xuXHRcdFx0Y2FzZSBSZW1vdGVUZXJtaW5hbENoYW5uZWxFdmVudC5PblByb2Nlc3NFeGl0RXZlbnQ6IHJldHVybiB0aGlzLl9wdHlIb3N0U2VydmljZS5vblByb2Nlc3NFeGl0O1xuXHRcdFx0Y2FzZSBSZW1vdGVUZXJtaW5hbENoYW5uZWxFdmVudC5PblByb2Nlc3NSZXBsYXlFdmVudDogcmV0dXJuIHRoaXMuX3B0eUhvc3RTZXJ2aWNlLm9uUHJvY2Vzc1JlcGxheTtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsRXZlbnQuT25Qcm9jZXNzT3JwaGFuUXVlc3Rpb246IHJldHVybiB0aGlzLl9wdHlIb3N0U2VydmljZS5vblByb2Nlc3NPcnBoYW5RdWVzdGlvbjtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsRXZlbnQuT25FeGVjdXRlQ29tbWFuZDogcmV0dXJuIHRoaXMub25FeGVjdXRlQ29tbWFuZDtcblx0XHRcdGNhc2UgUmVtb3RlVGVybWluYWxDaGFubmVsRXZlbnQuT25EaWRSZXF1ZXN0RGV0YWNoOiByZXR1cm4gdGhpcy5fcHR5SG9zdFNlcnZpY2Uub25EaWRSZXF1ZXN0RGV0YWNoIHx8IEV2ZW50Lk5vbmU7XG5cdFx0XHRjYXNlIFJlbW90ZVRlcm1pbmFsQ2hhbm5lbEV2ZW50Lk9uRGlkQ2hhbmdlUHJvcGVydHk6IHJldHVybiB0aGlzLl9wdHlIb3N0U2VydmljZS5vbkRpZENoYW5nZVByb3BlcnR5O1xuXHRcdH1cblxuXHRcdC8vIEB0cy1leHBlY3QtZXJyb3IgQXNzZXJ0IGV2ZW50IGlzIHRoZSBgbmV2ZXJgIHR5cGUgdG8gZW5zdXJlIGFsbCBtZXNzYWdlcyBhcmUgaGFuZGxlZFxuXHRcdHRocm93IG5ldyBFcnJvcihgSVBDIENvbW1hbmQgJHtldmVudH0gbm90IGZvdW5kYCk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9jcmVhdGVQcm9jZXNzKHVyaVRyYW5zZm9ybWVyOiBJVVJJVHJhbnNmb3JtZXIsIGFyZ3M6IElDcmVhdGVUZXJtaW5hbFByb2Nlc3NBcmd1bWVudHMpOiBQcm9taXNlPElDcmVhdGVUZXJtaW5hbFByb2Nlc3NSZXN1bHQ+IHtcblx0XHRjb25zdCBzaGVsbExhdW5jaENvbmZpZzogSVNoZWxsTGF1bmNoQ29uZmlnID0ge1xuXHRcdFx0bmFtZTogYXJncy5zaGVsbExhdW5jaENvbmZpZy5uYW1lLFxuXHRcdFx0ZXhlY3V0YWJsZTogYXJncy5zaGVsbExhdW5jaENvbmZpZy5leGVjdXRhYmxlLFxuXHRcdFx0YXJnczogYXJncy5zaGVsbExhdW5jaENvbmZpZy5hcmdzLFxuXHRcdFx0Y3dkOiAoXG5cdFx0XHRcdHR5cGVvZiBhcmdzLnNoZWxsTGF1bmNoQ29uZmlnLmN3ZCA9PT0gJ3N0cmluZycgfHwgdHlwZW9mIGFyZ3Muc2hlbGxMYXVuY2hDb25maWcuY3dkID09PSAndW5kZWZpbmVkJ1xuXHRcdFx0XHRcdD8gYXJncy5zaGVsbExhdW5jaENvbmZpZy5jd2Rcblx0XHRcdFx0XHQ6IFVSSS5yZXZpdmUodXJpVHJhbnNmb3JtZXIudHJhbnNmb3JtSW5jb21pbmcoYXJncy5zaGVsbExhdW5jaENvbmZpZy5jd2QpKVxuXHRcdFx0KSxcblx0XHRcdGVudjogYXJncy5zaGVsbExhdW5jaENvbmZpZy5lbnYsXG5cdFx0XHR1c2VTaGVsbEVudmlyb25tZW50OiBhcmdzLnNoZWxsTGF1bmNoQ29uZmlnLnVzZVNoZWxsRW52aXJvbm1lbnQsXG5cdFx0XHRyZWNvbm5lY3Rpb25Qcm9wZXJ0aWVzOiBhcmdzLnNoZWxsTGF1bmNoQ29uZmlnLnJlY29ubmVjdGlvblByb3BlcnRpZXMsXG5cdFx0XHR0eXBlOiBhcmdzLnNoZWxsTGF1bmNoQ29uZmlnLnR5cGUsXG5cdFx0XHRpc0ZlYXR1cmVUZXJtaW5hbDogYXJncy5zaGVsbExhdW5jaENvbmZpZy5pc0ZlYXR1cmVUZXJtaW5hbCxcblx0XHRcdHRhYkFjdGlvbnM6IGFyZ3Muc2hlbGxMYXVuY2hDb25maWcudGFiQWN0aW9ucyxcblx0XHRcdHNoZWxsSW50ZWdyYXRpb25FbnZpcm9ubWVudFJlcG9ydGluZzogYXJncy5zaGVsbExhdW5jaENvbmZpZy5zaGVsbEludGVncmF0aW9uRW52aXJvbm1lbnRSZXBvcnRpbmcsXG5cdFx0fTtcblxuXG5cdFx0Y29uc3QgYmFzZUVudiA9IGF3YWl0IGJ1aWxkVXNlckVudmlyb25tZW50KGFyZ3MucmVzb2x2ZXJFbnYsICEhYXJncy5zaGVsbExhdW5jaENvbmZpZy51c2VTaGVsbEVudmlyb25tZW50LCBwbGF0Zm9ybS5sYW5ndWFnZSwgdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLCB0aGlzLl9sb2dTZXJ2aWNlLCB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZSgnYmFzZUVudicsIGJhc2VFbnYpO1xuXG5cdFx0Y29uc3QgcmV2aXZlV29ya3NwYWNlRm9sZGVyID0gKHdvcmtzcGFjZURhdGE6IElXb3Jrc3BhY2VGb2xkZXJEYXRhKTogSVdvcmtzcGFjZUZvbGRlciA9PiB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR1cmk6IFVSSS5yZXZpdmUodXJpVHJhbnNmb3JtZXIudHJhbnNmb3JtSW5jb21pbmcod29ya3NwYWNlRGF0YS51cmkpKSxcblx0XHRcdFx0bmFtZTogd29ya3NwYWNlRGF0YS5uYW1lLFxuXHRcdFx0XHRpbmRleDogd29ya3NwYWNlRGF0YS5pbmRleCxcblx0XHRcdFx0dG9SZXNvdXJjZTogKCkgPT4ge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignTm90IGltcGxlbWVudGVkJyk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fTtcblx0XHRjb25zdCB3b3Jrc3BhY2VGb2xkZXJzID0gYXJncy53b3Jrc3BhY2VGb2xkZXJzLm1hcChyZXZpdmVXb3Jrc3BhY2VGb2xkZXIpO1xuXHRcdGNvbnN0IGFjdGl2ZVdvcmtzcGFjZUZvbGRlciA9IGFyZ3MuYWN0aXZlV29ya3NwYWNlRm9sZGVyID8gcmV2aXZlV29ya3NwYWNlRm9sZGVyKGFyZ3MuYWN0aXZlV29ya3NwYWNlRm9sZGVyKSA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCBhY3RpdmVGaWxlUmVzb3VyY2UgPSBhcmdzLmFjdGl2ZUZpbGVSZXNvdXJjZSA/IFVSSS5yZXZpdmUodXJpVHJhbnNmb3JtZXIudHJhbnNmb3JtSW5jb21pbmcoYXJncy5hY3RpdmVGaWxlUmVzb3VyY2UpKSA6IHVuZGVmaW5lZDtcblx0XHRjb25zdCBjdXN0b21WYXJpYWJsZVJlc29sdmVyID0gbmV3IEN1c3RvbVZhcmlhYmxlUmVzb2x2ZXIoYmFzZUVudiwgd29ya3NwYWNlRm9sZGVycywgYWN0aXZlRmlsZVJlc291cmNlLCBhcmdzLnJlc29sdmVkVmFyaWFibGVzLCB0aGlzLl9leHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSk7XG5cdFx0Y29uc3QgdmFyaWFibGVSZXNvbHZlciA9IHRlcm1pbmFsRW52aXJvbm1lbnQuY3JlYXRlVmFyaWFibGVSZXNvbHZlcihhY3RpdmVXb3Jrc3BhY2VGb2xkZXIsIHByb2Nlc3MuZW52LCBjdXN0b21WYXJpYWJsZVJlc29sdmVyKTtcblxuXHRcdC8vIEdldCB0aGUgaW5pdGlhbCBjd2Rcblx0XHRjb25zdCBpbml0aWFsQ3dkID0gYXdhaXQgdGVybWluYWxFbnZpcm9ubWVudC5nZXRDd2Qoc2hlbGxMYXVuY2hDb25maWcsIG9zLmhvbWVkaXIoKSwgdmFyaWFibGVSZXNvbHZlciwgYWN0aXZlV29ya3NwYWNlRm9sZGVyPy51cmksIGFyZ3MuY29uZmlndXJhdGlvblsndGVybWluYWwuaW50ZWdyYXRlZC5jd2QnXSwgdGhpcy5fbG9nU2VydmljZSk7XG5cdFx0c2hlbGxMYXVuY2hDb25maWcuY3dkID0gaW5pdGlhbEN3ZDtcblxuXHRcdGNvbnN0IGVudlBsYXRmb3JtS2V5ID0gcGxhdGZvcm0uaXNXaW5kb3dzID8gJ3Rlcm1pbmFsLmludGVncmF0ZWQuZW52LndpbmRvd3MnIDogKHBsYXRmb3JtLmlzTWFjaW50b3NoID8gJ3Rlcm1pbmFsLmludGVncmF0ZWQuZW52Lm9zeCcgOiAndGVybWluYWwuaW50ZWdyYXRlZC5lbnYubGludXgnKTtcblx0XHRjb25zdCBlbnZGcm9tQ29uZmlnID0gYXJncy5jb25maWd1cmF0aW9uW2VudlBsYXRmb3JtS2V5XTtcblx0XHRjb25zdCBlbnYgPSBhd2FpdCB0ZXJtaW5hbEVudmlyb25tZW50LmNyZWF0ZVRlcm1pbmFsRW52aXJvbm1lbnQoXG5cdFx0XHRzaGVsbExhdW5jaENvbmZpZyxcblx0XHRcdGVudkZyb21Db25maWcsXG5cdFx0XHR2YXJpYWJsZVJlc29sdmVyLFxuXHRcdFx0dGhpcy5fcHJvZHVjdFNlcnZpY2UudmVyc2lvbixcblx0XHRcdGFyZ3MuY29uZmlndXJhdGlvblsndGVybWluYWwuaW50ZWdyYXRlZC5kZXRlY3RMb2NhbGUnXSxcblx0XHRcdGJhc2VFbnZcblx0XHQpO1xuXG5cdFx0Ly8gQXBwbHkgZXh0ZW5zaW9uIGVudmlyb25tZW50IHZhcmlhYmxlIGNvbGxlY3Rpb25zIHRvIHRoZSBlbnZpcm9ubWVudFxuXHRcdGlmIChzaG91bGRVc2VFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihzaGVsbExhdW5jaENvbmZpZykpIHtcblx0XHRcdGNvbnN0IGVudHJpZXM6IFtzdHJpbmcsIElFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbl1bXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBbaywgdiwgZF0gb2YgYXJncy5lbnZWYXJpYWJsZUNvbGxlY3Rpb25zKSB7XG5cdFx0XHRcdGVudHJpZXMucHVzaChbaywgeyBtYXA6IGRlc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24odiksIGRlc2NyaXB0aW9uTWFwOiBkZXNlcmlhbGl6ZUVudmlyb25tZW50RGVzY3JpcHRpb25NYXAoZCkgfV0pO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgZW52VmFyaWFibGVDb2xsZWN0aW9ucyA9IG5ldyBNYXA8c3RyaW5nLCBJRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24+KGVudHJpZXMpO1xuXHRcdFx0Y29uc3QgbWVyZ2VkQ29sbGVjdGlvbiA9IG5ldyBNZXJnZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihlbnZWYXJpYWJsZUNvbGxlY3Rpb25zKTtcblx0XHRcdGNvbnN0IHdvcmtzcGFjZUZvbGRlciA9IGFjdGl2ZVdvcmtzcGFjZUZvbGRlciA/IGFjdGl2ZVdvcmtzcGFjZUZvbGRlciA/PyB1bmRlZmluZWQgOiB1bmRlZmluZWQ7XG5cdFx0XHRhd2FpdCBtZXJnZWRDb2xsZWN0aW9uLmFwcGx5VG9Qcm9jZXNzRW52aXJvbm1lbnQoZW52LCB7IHdvcmtzcGFjZUZvbGRlciB9LCB2YXJpYWJsZVJlc29sdmVyKTtcblx0XHR9XG5cblx0XHQvLyBGb3JrIHRoZSBwcm9jZXNzIGFuZCBsaXN0ZW4gZm9yIG1lc3NhZ2VzXG5cdFx0dGhpcy5fbG9nU2VydmljZS5kZWJ1ZyhgVGVybWluYWwgcHJvY2VzcyBsYXVuY2hpbmcgb24gcmVtb3RlIGFnZW50YCwgeyBzaGVsbExhdW5jaENvbmZpZywgaW5pdGlhbEN3ZCwgY29sczogYXJncy5jb2xzLCByb3dzOiBhcmdzLnJvd3MsIGVudiB9KTtcblxuXHRcdC8vIFNldHVwIHRoZSBDTEkgc2VydmVyIHRvIHN1cHBvcnQgZm9yd2FyZGluZyBjb21tYW5kcyBydW4gZnJvbSB0aGUgQ0xJXG5cdFx0Y29uc3QgaXBjSGFuZGxlUGF0aCA9IGNyZWF0ZVJhbmRvbUlQQ0hhbmRsZSgpO1xuXHRcdGVudi5WU0NPREVfSVBDX0hPT0tfQ0xJID0gaXBjSGFuZGxlUGF0aDtcblxuXHRcdGNvbnN0IHBlcnNpc3RlbnRQcm9jZXNzSWQgPSBhd2FpdCB0aGlzLl9wdHlIb3N0U2VydmljZS5jcmVhdGVQcm9jZXNzKHNoZWxsTGF1bmNoQ29uZmlnLCBpbml0aWFsQ3dkLCBhcmdzLmNvbHMsIGFyZ3Mucm93cywgYXJncy51bmljb2RlVmVyc2lvbiwgZW52LCBiYXNlRW52LCBhcmdzLm9wdGlvbnMsIGFyZ3Muc2hvdWxkUGVyc2lzdFRlcm1pbmFsLCBhcmdzLndvcmtzcGFjZUlkLCBhcmdzLndvcmtzcGFjZU5hbWUpO1xuXHRcdGNvbnN0IGNvbW1hbmRzRXhlY3V0ZXI6IElDb21tYW5kc0V4ZWN1dGVyID0ge1xuXHRcdFx0ZXhlY3V0ZUNvbW1hbmQ6IDxUPihpZDogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8VD4gPT4gdGhpcy5fZXhlY3V0ZUNvbW1hbmQocGVyc2lzdGVudFByb2Nlc3NJZCwgaWQsIGFyZ3MsIHVyaVRyYW5zZm9ybWVyKVxuXHRcdH07XG5cdFx0Y29uc3QgY2xpU2VydmVyID0gbmV3IENMSVNlcnZlckJhc2UoY29tbWFuZHNFeGVjdXRlciwgdGhpcy5fbG9nU2VydmljZSwgaXBjSGFuZGxlUGF0aCk7XG5cdFx0dGhpcy5fcHR5SG9zdFNlcnZpY2Uub25Qcm9jZXNzRXhpdChlID0+IGUuaWQgPT09IHBlcnNpc3RlbnRQcm9jZXNzSWQgJiYgY2xpU2VydmVyLmRpc3Bvc2UoKSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cGVyc2lzdGVudFRlcm1pbmFsSWQ6IHBlcnNpc3RlbnRQcm9jZXNzSWQsXG5cdFx0XHRyZXNvbHZlZFNoZWxsTGF1bmNoQ29uZmlnOiBzaGVsbExhdW5jaENvbmZpZ1xuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIF9leGVjdXRlQ29tbWFuZDxUPihwZXJzaXN0ZW50UHJvY2Vzc0lkOiBudW1iZXIsIGNvbW1hbmRJZDogc3RyaW5nLCBjb21tYW5kQXJnczogYW55W10sIHVyaVRyYW5zZm9ybWVyOiBJVVJJVHJhbnNmb3JtZXIpOiBQcm9taXNlPFQ+IHtcblx0XHRjb25zdCB7IHJlc29sdmUsIHJlamVjdCwgcHJvbWlzZSB9ID0gcHJvbWlzZVdpdGhSZXNvbHZlcnM8VD4oKTtcblxuXHRcdGNvbnN0IHJlcUlkID0gKyt0aGlzLl9sYXN0UmVxSWQ7XG5cdFx0dGhpcy5fcGVuZGluZ0NvbW1hbmRzLnNldChyZXFJZCwgeyByZXNvbHZlLCByZWplY3QsIHVyaVRyYW5zZm9ybWVyIH0pO1xuXG5cdFx0Y29uc3Qgc2VyaWFsaXplZENvbW1hbmRBcmdzID0gY2xvbmVBbmRDaGFuZ2UoY29tbWFuZEFyZ3MsIChvYmopID0+IHtcblx0XHRcdGlmIChvYmogJiYgb2JqLiRtaWQgPT09IDEpIHtcblx0XHRcdFx0Ly8gdGhpcyBpcyBVcmlDb21wb25lbnRzXG5cdFx0XHRcdHJldHVybiB1cmlUcmFuc2Zvcm1lci50cmFuc2Zvcm1PdXRnb2luZyhvYmopO1xuXHRcdFx0fVxuXHRcdFx0aWYgKG9iaiAmJiBvYmogaW5zdGFuY2VvZiBVUkkpIHtcblx0XHRcdFx0cmV0dXJuIHVyaVRyYW5zZm9ybWVyLnRyYW5zZm9ybU91dGdvaW5nVVJJKG9iaik7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH0pO1xuXHRcdHRoaXMuX29uRXhlY3V0ZUNvbW1hbmQuZmlyZSh7XG5cdFx0XHRyZXFJZCxcblx0XHRcdHBlcnNpc3RlbnRQcm9jZXNzSWQsXG5cdFx0XHRjb21tYW5kSWQsXG5cdFx0XHRjb21tYW5kQXJnczogc2VyaWFsaXplZENvbW1hbmRBcmdzXG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gcHJvbWlzZTtcblx0fVxuXG5cdHByaXZhdGUgX3NlbmRDb21tYW5kUmVzdWx0KHJlcUlkOiBudW1iZXIsIGlzRXJyb3I6IGJvb2xlYW4sIHNlcmlhbGl6ZWRQYXlsb2FkOiBhbnkpOiB2b2lkIHtcblx0XHRjb25zdCBkYXRhID0gdGhpcy5fcGVuZGluZ0NvbW1hbmRzLmdldChyZXFJZCk7XG5cdFx0aWYgKCFkYXRhKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3BlbmRpbmdDb21tYW5kcy5kZWxldGUocmVxSWQpO1xuXHRcdGNvbnN0IHBheWxvYWQgPSBjbG9uZUFuZENoYW5nZShzZXJpYWxpemVkUGF5bG9hZCwgKG9iaikgPT4ge1xuXHRcdFx0aWYgKG9iaiAmJiBvYmouJG1pZCA9PT0gMSkge1xuXHRcdFx0XHQvLyB0aGlzIGlzIFVyaUNvbXBvbmVudHNcblx0XHRcdFx0cmV0dXJuIGRhdGEudXJpVHJhbnNmb3JtZXIudHJhbnNmb3JtSW5jb21pbmcob2JqKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fSk7XG5cdFx0aWYgKGlzRXJyb3IpIHtcblx0XHRcdGRhdGEucmVqZWN0KHBheWxvYWQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkYXRhLnJlc29sdmUocGF5bG9hZCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0RGVmYXVsdFN5c3RlbVNoZWxsKG9zT3ZlcnJpZGU/OiBwbGF0Zm9ybS5PcGVyYXRpbmdTeXN0ZW0pOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdHJldHVybiB0aGlzLl9wdHlIb3N0U2VydmljZS5nZXREZWZhdWx0U3lzdGVtU2hlbGwob3NPdmVycmlkZSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9nZXRQcm9maWxlcyh3b3Jrc3BhY2VJZDogc3RyaW5nLCBwcm9maWxlczogdW5rbm93biwgZGVmYXVsdFByb2ZpbGU6IHVua25vd24sIGluY2x1ZGVEZXRlY3RlZFByb2ZpbGVzPzogYm9vbGVhbik6IFByb21pc2U8SVRlcm1pbmFsUHJvZmlsZVtdPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3B0eUhvc3RTZXJ2aWNlLmdldFByb2ZpbGVzKHdvcmtzcGFjZUlkLCBwcm9maWxlcywgZGVmYXVsdFByb2ZpbGUsIGluY2x1ZGVEZXRlY3RlZFByb2ZpbGVzKSB8fCBbXTtcblx0fVxuXG5cdHByaXZhdGUgX2dldEVudmlyb25tZW50KCk6IHBsYXRmb3JtLklQcm9jZXNzRW52aXJvbm1lbnQge1xuXHRcdHJldHVybiB7IC4uLnByb2Nlc3MuZW52IH07XG5cdH1cblxuXHRwcml2YXRlIF9nZXRXc2xQYXRoKG9yaWdpbmFsOiBzdHJpbmcsIGRpcmVjdGlvbjogJ3VuaXgtdG8td2luJyB8ICd3aW4tdG8tdW5peCcpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdHJldHVybiB0aGlzLl9wdHlIb3N0U2VydmljZS5nZXRXc2xQYXRoKG9yaWdpbmFsLCBkaXJlY3Rpb24pO1xuXHR9XG5cblxuXHRwcml2YXRlIF9yZWR1Y2VDb25uZWN0aW9uR3JhY2VUaW1lKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl9wdHlIb3N0U2VydmljZS5yZWR1Y2VDb25uZWN0aW9uR3JhY2VUaW1lKCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksUUFBUTtBQUNwQixTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGtCQUFrQjtBQUMzQixZQUFZLFVBQVU7QUFDdEIsWUFBWSxjQUFjO0FBQzFCLFNBQVMsV0FBVztBQUdwQixTQUFTLDZCQUE2QjtBQUt0QyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHFCQUF3QztBQUVqRCxTQUFTLDJDQUEyQztBQUNwRCxTQUFTLHNDQUFzQyxnREFBZ0Q7QUFDL0YsU0FBOEYsNEJBQTRCLG9DQUFvQztBQUM5SixZQUFZLHlCQUF5QjtBQUNyQyxTQUFTLHVDQUF1QztBQUNoRCxTQUFTLDRCQUE0QjtBQU1yQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLDhDQUE4QztBQUV2RCxNQUFNLCtCQUErQixnQ0FBZ0M7QUFBQSxFQUNwRSxZQUNDLEtBQ0Esa0JBQ0Esb0JBQ0EsbUJBQ0Esa0JBQ0M7QUFDRCxVQUFNO0FBQUEsTUFDTCxjQUFjLENBQUMsZUFBd0M7QUFDdEQsY0FBTSxRQUFRLGlCQUFpQixPQUFPLE9BQUssRUFBRSxTQUFTLFVBQVU7QUFDaEUsWUFBSSxTQUFTLE1BQU0sU0FBUyxHQUFHO0FBQzlCLGlCQUFPLE1BQU0sQ0FBQyxFQUFFO0FBQUEsUUFDakI7QUFDQSxlQUFPO0FBQUEsTUFDUjtBQUFBLE1BQ0EseUJBQXlCLE1BQWM7QUFDdEMsZUFBTyxpQkFBaUI7QUFBQSxNQUN6QjtBQUFBLE1BQ0EsdUJBQXVC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QUUsS0FBSztBQUNyQixTQUFLLGlCQUFpQixJQUFJLE9BQU8sRUFBRSxTQUFTLFFBQVEsZUFBZSxDQUFDO0FBRXBFLFVBQU0sd0JBQXdCLGVBQWUsYUFBYSxDQUFDLFFBQVE7QUFDbEUsVUFBSSxPQUFPLElBQUksU0FBUyxHQUFHO0FBRTFCLGVBQU8sZUFBZSxrQkFBa0IsR0FBRztBQUFBLE1BQzVDO0FBQ0EsVUFBSSxPQUFPLGVBQWUsS0FBSztBQUM5QixlQUFPLGVBQWUscUJBQXFCLEdBQUc7QUFBQSxNQUMvQztBQUNBLGFBQU87QUFBQSxJQUNSLENBQUM7QUFDRCxTQUFLLGtCQUFrQixLQUFLO0FBQUEsTUFDM0I7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EsYUFBYTtBQUFBLElBQ2QsQ0FBQztBQUVELFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxtQkFBbUIsT0FBZSxTQUFrQixtQkFBOEI7QUFDekYsVUFBTSxPQUFPLEtBQUssaUJBQWlCLElBQUksS0FBSztBQUM1QyxRQUFJLENBQUMsTUFBTTtBQUNWO0FBQUEsSUFDRDtBQUNBLFNBQUssaUJBQWlCLE9BQU8sS0FBSztBQUNsQyxVQUFNLFVBQVUsZUFBZSxtQkFBbUIsQ0FBQyxRQUFRO0FBQzFELFVBQUksT0FBTyxJQUFJLFNBQVMsR0FBRztBQUUxQixlQUFPLEtBQUssZUFBZSxrQkFBa0IsR0FBRztBQUFBLE1BQ2pEO0FBQ0EsYUFBTztBQUFBLElBQ1IsQ0FBQztBQUNELFFBQUksU0FBUztBQUNaLFdBQUssT0FBTyxPQUFPO0FBQUEsSUFDcEIsT0FBTztBQUNOLFdBQUssUUFBUSxPQUFPO0FBQUEsSUFDckI7QUFBQSxFQUNEO0FBQUEsRUFFUSx1QkFBdUIsWUFBd0Q7QUFDdEYsV0FBTyxLQUFLLGdCQUFnQixzQkFBc0IsVUFBVTtBQUFBLEVBQzdEO0FBQUEsRUFFQSxNQUFjLGFBQWEsYUFBcUIsVUFBbUIsZ0JBQXlCLHlCQUFnRTtBQUMzSixXQUFPLEtBQUssZ0JBQWdCLFlBQVksYUFBYSxVQUFVLGdCQUFnQix1QkFBdUIsS0FBSyxDQUFDO0FBQUEsRUFDN0c7QUFBQSxFQUVRLGtCQUFnRDtBQUN2RCxXQUFPLEVBQUUsR0FBRyxRQUFRLElBQUk7QUFBQSxFQUN6QjtBQUFBLEVBRVEsWUFBWSxVQUFrQixXQUEyRDtBQUNoRyxXQUFPLEtBQUssZ0JBQWdCLFdBQVcsVUFBVSxTQUFTO0FBQUEsRUFDM0Q7QUFBQSxFQUdRLDZCQUE0QztBQUNuRCxXQUFPLEtBQUssZ0JBQWdCLDBCQUEwQjtBQUFBLEVBQ3ZEO0FBQ0Q7IiwKICAibmFtZXMiOiBbImFyZ3MiXQp9Cg==
