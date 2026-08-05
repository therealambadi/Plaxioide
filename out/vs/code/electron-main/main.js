import "../../platform/update/common/update.config.contribution.js";
import { app, dialog } from "electron";
import { unlinkSync, promises } from "fs";
import { URI } from "../../base/common/uri.js";
import { coalesce, distinct } from "../../base/common/arrays.js";
import { Promises } from "../../base/common/async.js";
import { toErrorMessage } from "../../base/common/errorMessage.js";
import { ExpectedError, setUnexpectedErrorHandler } from "../../base/common/errors.js";
import { isValidBasename, parseLineAndColumnAware, sanitizeFilePath } from "../../base/common/extpath.js";
import { Event } from "../../base/common/event.js";
import { getPathLabel } from "../../base/common/labels.js";
import { Schemas } from "../../base/common/network.js";
import { basename, resolve } from "../../base/common/path.js";
import { mark } from "../../base/common/performance.js";
import { isMacintosh, isWindows, OS } from "../../base/common/platform.js";
import { cwd } from "../../base/common/process.js";
import { rtrim, trim } from "../../base/common/strings.js";
import { Promises as FSPromises } from "../../base/node/pfs.js";
import { ProxyChannel } from "../../base/parts/ipc/common/ipc.js";
import { connect as nodeIPCConnect, serve as nodeIPCServe, XDG_RUNTIME_DIR } from "../../base/parts/ipc/node/ipc.net.js";
import { CodeApplication } from "./app.js";
import { localize } from "../../nls.js";
import { IConfigurationService } from "../../platform/configuration/common/configuration.js";
import { ConfigurationService } from "../../platform/configuration/common/configurationService.js";
import { DiagnosticsService } from "../../platform/diagnostics/node/diagnosticsService.js";
import { EnvironmentMainService, IEnvironmentMainService } from "../../platform/environment/electron-main/environmentMainService.js";
import { addArg, parseMainProcessArgv } from "../../platform/environment/node/argvHelper.js";
import { createWaitMarkerFileSync } from "../../platform/environment/node/wait.js";
import { IFileService } from "../../platform/files/common/files.js";
import { FileService } from "../../platform/files/common/fileService.js";
import { DiskFileSystemProvider } from "../../platform/files/node/diskFileSystemProvider.js";
import { SyncDescriptor } from "../../platform/instantiation/common/descriptors.js";
import { InstantiationService } from "../../platform/instantiation/common/instantiationService.js";
import { ServiceCollection } from "../../platform/instantiation/common/serviceCollection.js";
import { ILifecycleMainService, LifecycleMainService } from "../../platform/lifecycle/electron-main/lifecycleMainService.js";
import { BufferLogger } from "../../platform/log/common/bufferLog.js";
import { ConsoleMainLogger, getLogLevel, ILoggerService, ILogService } from "../../platform/log/common/log.js";
import product from "../../platform/product/common/product.js";
import { IProductService } from "../../platform/product/common/productService.js";
import { IProtocolMainService } from "../../platform/protocol/electron-main/protocol.js";
import { ProtocolMainService } from "../../platform/protocol/electron-main/protocolMainService.js";
import { ITunnelService } from "../../platform/tunnel/common/tunnel.js";
import { TunnelService } from "../../platform/tunnel/node/tunnelService.js";
import { IRequestService } from "../../platform/request/common/request.js";
import { RequestService } from "../../platform/request/electron-utility/requestService.js";
import { ISignService } from "../../platform/sign/common/sign.js";
import { SignService } from "../../platform/sign/node/signService.js";
import { IStateReadService, IStateService } from "../../platform/state/node/state.js";
import { NullTelemetryService } from "../../platform/telemetry/common/telemetryUtils.js";
import { IThemeMainService, ThemeMainService } from "../../platform/theme/electron-main/themeMainService.js";
import { IUserDataProfilesMainService, UserDataProfilesMainService } from "../../platform/userDataProfile/electron-main/userDataProfile.js";
import { IPolicyService, NullPolicyService } from "../../platform/policy/common/policy.js";
import { NativePolicyService } from "../../platform/policy/node/nativePolicyService.js";
import { FilePolicyService } from "../../platform/policy/common/filePolicyService.js";
import { DisposableStore } from "../../base/common/lifecycle.js";
import { IUriIdentityService } from "../../platform/uriIdentity/common/uriIdentity.js";
import { UriIdentityService } from "../../platform/uriIdentity/common/uriIdentityService.js";
import { ILoggerMainService, LoggerMainService } from "../../platform/log/electron-main/loggerService.js";
import { LogService } from "../../platform/log/common/logService.js";
import { massageMessageBoxOptions } from "../../platform/dialogs/common/dialogs.js";
import { SaveStrategy, StateService } from "../../platform/state/node/stateService.js";
import { FileUserDataProvider } from "../../platform/userData/common/fileUserDataProvider.js";
import { addUNCHostToAllowlist, getUNCHost } from "../../base/node/unc.js";
class CodeMain {
  main() {
    try {
      this.startup();
    } catch (error) {
      console.error(error.message);
      app.exit(1);
    }
  }
  async startup() {
    setUnexpectedErrorHandler((err) => console.error(err));
    const [instantiationService, instanceEnvironment, environmentMainService, configurationService, stateMainService, bufferLogger, productService, userDataProfilesMainService] = this.createServices();
    try {
      try {
        await this.initServices(environmentMainService, userDataProfilesMainService, configurationService, stateMainService, productService);
      } catch (error) {
        this.handleStartupDataDirError(environmentMainService, productService, error);
        throw error;
      }
      await instantiationService.invokeFunction(async (accessor) => {
        const logService = accessor.get(ILogService);
        const lifecycleMainService = accessor.get(ILifecycleMainService);
        const fileService = accessor.get(IFileService);
        const loggerService = accessor.get(ILoggerService);
        const mainProcessNodeIpcServer = await this.claimInstance(logService, environmentMainService, lifecycleMainService, instantiationService, productService, true);
        FSPromises.writeFile(environmentMainService.mainLockfile, String(process.pid)).catch((err) => {
          logService.warn(`app#startup(): Error writing main lockfile: ${err.stack}`);
        });
        bufferLogger.logger = loggerService.createLogger("main", { name: localize("mainLog", "Main") });
        Event.once(lifecycleMainService.onWillShutdown)((evt) => {
          fileService.dispose();
          configurationService.dispose();
          evt.join("instanceLockfile", promises.unlink(environmentMainService.mainLockfile).catch(() => {
          }));
        });
        return instantiationService.createInstance(CodeApplication, mainProcessNodeIpcServer, instanceEnvironment).startup();
      });
    } catch (error) {
      instantiationService.invokeFunction(this.quit, error);
    }
  }
  createServices() {
    const services = new ServiceCollection();
    const disposables = new DisposableStore();
    process.once("exit", () => disposables.dispose());
    const productService = { _serviceBrand: void 0, ...product };
    services.set(IProductService, productService);
    const environmentMainService = new EnvironmentMainService(this.resolveArgs(), productService);
    const instanceEnvironment = this.patchEnvironment(environmentMainService);
    services.set(IEnvironmentMainService, environmentMainService);
    const loggerService = new LoggerMainService(getLogLevel(environmentMainService), environmentMainService.logsHome);
    services.set(ILoggerMainService, loggerService);
    const bufferLogger = new BufferLogger(loggerService.getLogLevel());
    const logService = disposables.add(new LogService(bufferLogger, [new ConsoleMainLogger(loggerService.getLogLevel())]));
    services.set(ILogService, logService);
    const fileService = new FileService(logService);
    services.set(IFileService, fileService);
    const diskFileSystemProvider = new DiskFileSystemProvider(logService);
    fileService.registerProvider(Schemas.file, diskFileSystemProvider);
    const uriIdentityService = new UriIdentityService(fileService);
    services.set(IUriIdentityService, uriIdentityService);
    const stateService = new StateService(SaveStrategy.DELAYED, environmentMainService, logService, fileService);
    services.set(IStateReadService, stateService);
    services.set(IStateService, stateService);
    const userDataProfilesMainService = new UserDataProfilesMainService(stateService, uriIdentityService, environmentMainService, fileService, logService);
    services.set(IUserDataProfilesMainService, userDataProfilesMainService);
    fileService.registerProvider(Schemas.vscodeUserData, new FileUserDataProvider(Schemas.file, diskFileSystemProvider, Schemas.vscodeUserData, userDataProfilesMainService, uriIdentityService, logService));
    let policyService;
    if (isWindows && productService.win32RegValueName) {
      policyService = disposables.add(new NativePolicyService(logService, productService.win32RegValueName));
    } else if (isMacintosh && productService.darwinBundleIdentifier) {
      policyService = disposables.add(new NativePolicyService(logService, productService.darwinBundleIdentifier));
    } else if (environmentMainService.policyFile) {
      policyService = disposables.add(new FilePolicyService(environmentMainService.policyFile, fileService, logService));
    } else {
      policyService = new NullPolicyService();
    }
    services.set(IPolicyService, policyService);
    const configurationService = new ConfigurationService(userDataProfilesMainService.defaultProfile.settingsResource, fileService, policyService, logService);
    services.set(IConfigurationService, configurationService);
    services.set(ILifecycleMainService, new SyncDescriptor(LifecycleMainService, void 0, false));
    services.set(IRequestService, new SyncDescriptor(RequestService, void 0, true));
    services.set(IThemeMainService, new SyncDescriptor(ThemeMainService));
    services.set(ISignService, new SyncDescriptor(
      SignService,
      void 0,
      false
      /* proxied to other processes */
    ));
    services.set(ITunnelService, new SyncDescriptor(TunnelService));
    services.set(IProtocolMainService, new ProtocolMainService(environmentMainService, userDataProfilesMainService, logService));
    return [new InstantiationService(services, true), instanceEnvironment, environmentMainService, configurationService, stateService, bufferLogger, productService, userDataProfilesMainService];
  }
  patchEnvironment(environmentMainService) {
    const instanceEnvironment = {
      VSCODE_IPC_HOOK: environmentMainService.mainIPCHandle
    };
    ["VSCODE_NLS_CONFIG", "VSCODE_PORTABLE"].forEach((key) => {
      const value = process.env[key];
      if (typeof value === "string") {
        instanceEnvironment[key] = value;
      }
    });
    Object.assign(process.env, instanceEnvironment);
    return instanceEnvironment;
  }
  async initServices(environmentMainService, userDataProfilesMainService, configurationService, stateService, productService) {
    await Promises.settled([
      // Environment service (paths)
      Promise.all([
        this.allowWindowsUNCPath(environmentMainService.extensionsPath),
        // enable extension paths on UNC drives...
        environmentMainService.codeCachePath,
        // ...other user-data-derived paths should already be enlisted from `main.js`
        environmentMainService.logsHome.with({ scheme: Schemas.file }).fsPath,
        userDataProfilesMainService.defaultProfile.globalStorageHome.with({ scheme: Schemas.file }).fsPath,
        environmentMainService.workspaceStorageHome.with({ scheme: Schemas.file }).fsPath,
        environmentMainService.localHistoryHome.with({ scheme: Schemas.file }).fsPath,
        environmentMainService.backupHome
      ].map((path) => path ? promises.mkdir(path, { recursive: true }) : void 0)),
      // State service
      stateService.init(),
      // Configuration service
      configurationService.initialize()
    ]);
    userDataProfilesMainService.init();
  }
  allowWindowsUNCPath(path) {
    if (isWindows) {
      const host = getUNCHost(path);
      if (host) {
        addUNCHostToAllowlist(host);
      }
    }
    return path;
  }
  async claimInstance(logService, environmentMainService, lifecycleMainService, instantiationService, productService, retry) {
    let mainProcessNodeIpcServer;
    try {
      mark("code/willStartMainServer");
      mainProcessNodeIpcServer = await nodeIPCServe(environmentMainService.mainIPCHandle);
      mark("code/didStartMainServer");
      Event.once(lifecycleMainService.onWillShutdown)(() => mainProcessNodeIpcServer.dispose());
    } catch (error) {
      if (error.code !== "EADDRINUSE") {
        this.handleStartupDataDirError(environmentMainService, productService, error);
        throw error;
      }
      let client;
      try {
        client = await nodeIPCConnect(environmentMainService.mainIPCHandle, "main");
      } catch (error2) {
        if (!retry || isWindows || error2.code !== "ECONNREFUSED") {
          if (error2.code === "EPERM") {
            this.showStartupWarningDialog(
              localize("secondInstanceAdmin", "Another instance of {0} is already running as administrator.", productService.nameShort),
              localize("secondInstanceAdminDetail", "Please close the other instance and try again."),
              productService
            );
          }
          throw error2;
        }
        try {
          unlinkSync(environmentMainService.mainIPCHandle);
        } catch (error3) {
          logService.warn("Could not delete obsolete instance handle", error3);
          throw error3;
        }
        return this.claimInstance(logService, environmentMainService, lifecycleMainService, instantiationService, productService, false);
      }
      if (environmentMainService.extensionTestsLocationURI && !environmentMainService.debugExtensionHost.break) {
        const msg = `Running extension tests from the command line is currently only supported if no other instance of ${productService.nameShort} is running.`;
        logService.error(msg);
        client.dispose();
        throw new Error(msg);
      }
      let startupWarningDialogHandle = void 0;
      if (!environmentMainService.args.wait && !environmentMainService.args.status) {
        startupWarningDialogHandle = setTimeout(() => {
          this.showStartupWarningDialog(
            localize("secondInstanceNoResponse", "Another instance of {0} is running but not responding", productService.nameShort),
            localize("secondInstanceNoResponseDetail", "Please close all other instances and try again."),
            productService
          );
        }, 1e4);
      }
      const otherInstanceLaunchMainService = ProxyChannel.toService(client.getChannel("launch"), { disableMarshalling: true });
      const otherInstanceDiagnosticsMainService = ProxyChannel.toService(client.getChannel("diagnostics"), { disableMarshalling: true });
      if (environmentMainService.args.status) {
        return instantiationService.invokeFunction(async () => {
          const diagnosticsService = new DiagnosticsService(NullTelemetryService, productService);
          const mainDiagnostics = await otherInstanceDiagnosticsMainService.getMainDiagnostics();
          const remoteDiagnostics = await otherInstanceDiagnosticsMainService.getRemoteDiagnostics({ includeProcesses: true, includeWorkspaceMetadata: true });
          const diagnostics = await diagnosticsService.getDiagnostics(mainDiagnostics, remoteDiagnostics);
          console.log(diagnostics);
          throw new ExpectedError();
        });
      }
      if (isWindows) {
        await this.windowsAllowSetForegroundWindow(otherInstanceLaunchMainService, logService);
      }
      logService.trace("Sending env to running instance...");
      await otherInstanceLaunchMainService.start(environmentMainService.args, process.env);
      client.dispose();
      if (startupWarningDialogHandle) {
        clearTimeout(startupWarningDialogHandle);
      }
      throw new ExpectedError("Sent env to running instance. Terminating...");
    }
    if (environmentMainService.args.status) {
      console.log(localize("statusWarning", "Warning: The --status argument can only be used if {0} is already running. Please run it again after {0} has started.", productService.nameShort));
      throw new ExpectedError("Terminating...");
    }
    process.env["VSCODE_PID"] = String(process.pid);
    return mainProcessNodeIpcServer;
  }
  handleStartupDataDirError(environmentMainService, productService, error) {
    if (error.code === "EACCES" || error.code === "EPERM") {
      const directories = coalesce([environmentMainService.userDataPath, environmentMainService.extensionsPath, XDG_RUNTIME_DIR]).map((folder) => getPathLabel(URI.file(folder), { os: OS, tildify: environmentMainService }));
      this.showStartupWarningDialog(
        localize("startupDataDirError", "Unable to write program user data."),
        localize("startupUserDataAndExtensionsDirErrorDetail", "{0}\n\nPlease make sure the following directories are writeable:\n\n{1}", toErrorMessage(error), directories.join("\n")),
        productService
      );
    }
  }
  showStartupWarningDialog(message, detail, productService) {
    dialog.showMessageBoxSync(massageMessageBoxOptions({
      type: "warning",
      buttons: [localize({ key: "close", comment: ["&& denotes a mnemonic"] }, "&&Close")],
      message,
      detail
    }, productService).options);
  }
  async windowsAllowSetForegroundWindow(launchMainService, logService) {
    if (isWindows) {
      const processId = await launchMainService.getMainProcessId();
      logService.trace("Sending some foreground love to the running instance:", processId);
      try {
        (await import("windows-foreground-love")).allowSetForegroundWindow(processId);
      } catch (error) {
        logService.error(error);
      }
    }
  }
  quit(accessor, reason) {
    const logService = accessor.get(ILogService);
    const lifecycleMainService = accessor.get(ILifecycleMainService);
    let exitCode = 0;
    if (reason) {
      if (reason.isExpected) {
        if (reason.message) {
          logService.trace(reason.message);
        }
      } else {
        exitCode = 1;
        if (reason.stack) {
          logService.error(reason.stack);
        } else {
          logService.error(`Startup error: ${reason.toString()}`);
        }
      }
    }
    lifecycleMainService.kill(exitCode);
  }
  //#region Command line arguments utilities
  resolveArgs() {
    const args = this.validatePaths(parseMainProcessArgv(process.argv));
    if (args.wait && !args.waitMarkerFilePath) {
      const waitMarkerFilePath = createWaitMarkerFileSync(args.verbose);
      if (waitMarkerFilePath) {
        addArg(process.argv, "--waitMarkerFilePath", waitMarkerFilePath);
        args.waitMarkerFilePath = waitMarkerFilePath;
      }
    }
    return args;
  }
  validatePaths(args) {
    if (args["open-url"]) {
      args._urls = args._;
      args._ = [];
    }
    if (!args["remote"]) {
      const paths = this.doValidatePaths(args._, args.goto);
      args._ = paths;
    }
    return args;
  }
  doValidatePaths(args, gotoLineMode) {
    const currentWorkingDir = cwd();
    const result = args.map((arg) => {
      let pathCandidate = String(arg);
      let parsedPath = void 0;
      if (gotoLineMode) {
        parsedPath = parseLineAndColumnAware(pathCandidate);
        pathCandidate = parsedPath.path;
      }
      if (pathCandidate) {
        pathCandidate = this.preparePath(currentWorkingDir, pathCandidate);
      }
      const sanitizedFilePath = sanitizeFilePath(pathCandidate, currentWorkingDir);
      const filePathBasename = basename(sanitizedFilePath);
      if (filePathBasename && !isValidBasename(filePathBasename)) {
        return null;
      }
      if (gotoLineMode && parsedPath) {
        parsedPath.path = sanitizedFilePath;
        return this.toPath(parsedPath);
      }
      return sanitizedFilePath;
    });
    const caseInsensitive = isWindows || isMacintosh;
    const distinctPaths = distinct(result, (path) => path && caseInsensitive ? path.toLowerCase() : path || "");
    return coalesce(distinctPaths);
  }
  preparePath(cwd2, path) {
    if (isWindows) {
      path = rtrim(path, '"');
    }
    path = trim(trim(path, " "), "	");
    if (isWindows) {
      path = resolve(cwd2, path);
      path = rtrim(path, ".");
    }
    return path;
  }
  toPath(pathWithLineAndCol) {
    const segments = [pathWithLineAndCol.path];
    if (typeof pathWithLineAndCol.line === "number") {
      segments.push(String(pathWithLineAndCol.line));
    }
    if (typeof pathWithLineAndCol.column === "number") {
      segments.push(String(pathWithLineAndCol.column));
    }
    return segments.join(":");
  }
  //#endregion
}
const code = new CodeMain();
code.main();
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9jb2RlL2VsZWN0cm9uLW1haW4vbWFpbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi4vLi4vcGxhdGZvcm0vdXBkYXRlL2NvbW1vbi91cGRhdGUuY29uZmlnLmNvbnRyaWJ1dGlvbi5qcyc7XG5cbmltcG9ydCB7IGFwcCwgZGlhbG9nIH0gZnJvbSAnZWxlY3Ryb24nO1xuaW1wb3J0IHsgdW5saW5rU3luYywgcHJvbWlzZXMgfSBmcm9tICdmcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgY29hbGVzY2UsIGRpc3RpbmN0IH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IFByb21pc2VzIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgdG9FcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi9iYXNlL2NvbW1vbi9lcnJvck1lc3NhZ2UuanMnO1xuaW1wb3J0IHsgRXhwZWN0ZWRFcnJvciwgc2V0VW5leHBlY3RlZEVycm9ySGFuZGxlciB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBJUGF0aFdpdGhMaW5lQW5kQ29sdW1uLCBpc1ZhbGlkQmFzZW5hbWUsIHBhcnNlTGluZUFuZENvbHVtbkF3YXJlLCBzYW5pdGl6ZUZpbGVQYXRoIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vZXh0cGF0aC5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGdldFBhdGhMYWJlbCB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL2xhYmVscy5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgcmVzb2x2ZSB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgbWFyayB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3BlcmZvcm1hbmNlLmpzJztcbmltcG9ydCB7IElQcm9jZXNzRW52aXJvbm1lbnQsIGlzTWFjaW50b3NoLCBpc1dpbmRvd3MsIE9TIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgY3dkIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vcHJvY2Vzcy5qcyc7XG5pbXBvcnQgeyBydHJpbSwgdHJpbSB9IGZyb20gJy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgUHJvbWlzZXMgYXMgRlNQcm9taXNlcyB9IGZyb20gJy4uLy4uL2Jhc2Uvbm9kZS9wZnMuanMnO1xuaW1wb3J0IHsgUHJveHlDaGFubmVsIH0gZnJvbSAnLi4vLi4vYmFzZS9wYXJ0cy9pcGMvY29tbW9uL2lwYy5qcyc7XG5pbXBvcnQgeyBDbGllbnQgYXMgTm9kZUlQQ0NsaWVudCB9IGZyb20gJy4uLy4uL2Jhc2UvcGFydHMvaXBjL2NvbW1vbi9pcGMubmV0LmpzJztcbmltcG9ydCB7IGNvbm5lY3QgYXMgbm9kZUlQQ0Nvbm5lY3QsIHNlcnZlIGFzIG5vZGVJUENTZXJ2ZSwgU2VydmVyIGFzIE5vZGVJUENTZXJ2ZXIsIFhER19SVU5USU1FX0RJUiB9IGZyb20gJy4uLy4uL2Jhc2UvcGFydHMvaXBjL25vZGUvaXBjLm5ldC5qcyc7XG5pbXBvcnQgeyBDb2RlQXBwbGljYXRpb24gfSBmcm9tICcuL2FwcC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSURpYWdub3N0aWNzTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9kaWFnbm9zdGljcy9lbGVjdHJvbi1tYWluL2RpYWdub3N0aWNzTWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRGlhZ25vc3RpY3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZGlhZ25vc3RpY3Mvbm9kZS9kaWFnbm9zdGljc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgTmF0aXZlUGFyc2VkQXJncyB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2Vudmlyb25tZW50L2NvbW1vbi9hcmd2LmpzJztcbmltcG9ydCB7IEVudmlyb25tZW50TWFpblNlcnZpY2UsIElFbnZpcm9ubWVudE1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvZWxlY3Ryb24tbWFpbi9lbnZpcm9ubWVudE1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IGFkZEFyZywgcGFyc2VNYWluUHJvY2Vzc0FyZ3YgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9ub2RlL2FyZ3ZIZWxwZXIuanMnO1xuaW1wb3J0IHsgY3JlYXRlV2FpdE1hcmtlckZpbGVTeW5jIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvbm9kZS93YWl0LmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBEaXNrRmlsZVN5c3RlbVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vZmlsZXMvbm9kZS9kaXNrRmlsZVN5c3RlbVByb3ZpZGVyLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vc2VydmljZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgSUxhdW5jaE1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbGF1bmNoL2VsZWN0cm9uLW1haW4vbGF1bmNoTWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZU1haW5TZXJ2aWNlLCBMaWZlY3ljbGVNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2xpZmVjeWNsZS9lbGVjdHJvbi1tYWluL2xpZmVjeWNsZU1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IEJ1ZmZlckxvZ2dlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vYnVmZmVyTG9nLmpzJztcbmltcG9ydCB7IENvbnNvbGVNYWluTG9nZ2VyLCBnZXRMb2dMZXZlbCwgSUxvZ2dlclNlcnZpY2UsIElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHByb2R1Y3QgZnJvbSAnLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdC5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUHJvdG9jb2xNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3Byb3RvY29sL2VsZWN0cm9uLW1haW4vcHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgUHJvdG9jb2xNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3Byb3RvY29sL2VsZWN0cm9uLW1haW4vcHJvdG9jb2xNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVHVubmVsU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3R1bm5lbC9jb21tb24vdHVubmVsLmpzJztcbmltcG9ydCB7IFR1bm5lbFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS90dW5uZWwvbm9kZS90dW5uZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElSZXF1ZXN0U2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3JlcXVlc3QvY29tbW9uL3JlcXVlc3QuanMnO1xuaW1wb3J0IHsgUmVxdWVzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9yZXF1ZXN0L2VsZWN0cm9uLXV0aWxpdHkvcmVxdWVzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVNpZ25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vc2lnbi9jb21tb24vc2lnbi5qcyc7XG5pbXBvcnQgeyBTaWduU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3NpZ24vbm9kZS9zaWduU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJU3RhdGVSZWFkU2VydmljZSwgSVN0YXRlU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3N0YXRlL25vZGUvc3RhdGUuanMnO1xuaW1wb3J0IHsgTnVsbFRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeVV0aWxzLmpzJztcbmltcG9ydCB7IElUaGVtZU1haW5TZXJ2aWNlLCBUaGVtZU1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vdGhlbWUvZWxlY3Ryb24tbWFpbi90aGVtZU1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2UsIFVzZXJEYXRhUHJvZmlsZXNNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhUHJvZmlsZS9lbGVjdHJvbi1tYWluL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBJUG9saWN5U2VydmljZSwgTnVsbFBvbGljeVNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9wb2xpY3kvY29tbW9uL3BvbGljeS5qcyc7XG5pbXBvcnQgeyBOYXRpdmVQb2xpY3lTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vcG9saWN5L25vZGUvbmF0aXZlUG9saWN5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBGaWxlUG9saWN5U2VydmljZSB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3BvbGljeS9jb21tb24vZmlsZVBvbGljeVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTG9nZ2VyTWFpblNlcnZpY2UsIExvZ2dlck1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbG9nL2VsZWN0cm9uLW1haW4vbG9nZ2VyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2dTZXJ2aWNlLmpzJztcbmltcG9ydCB7IG1hc3NhZ2VNZXNzYWdlQm94T3B0aW9ucyB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgU2F2ZVN0cmF0ZWd5LCBTdGF0ZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9wbGF0Zm9ybS9zdGF0ZS9ub2RlL3N0YXRlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBGaWxlVXNlckRhdGFQcm92aWRlciB9IGZyb20gJy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhL2NvbW1vbi9maWxlVXNlckRhdGFQcm92aWRlci5qcyc7XG5pbXBvcnQgeyBhZGRVTkNIb3N0VG9BbGxvd2xpc3QsIGdldFVOQ0hvc3QgfSBmcm9tICcuLi8uLi9iYXNlL25vZGUvdW5jLmpzJztcblxuLyoqXG4gKiBUaGUgbWFpbiBWUyBDb2RlIGVudHJ5IHBvaW50LlxuICpcbiAqIE5vdGU6IFRoaXMgY2xhc3MgY2FuIGV4aXN0IG1vcmUgdGhhbiBvbmNlIGZvciBleGFtcGxlIHdoZW4gVlMgQ29kZSBpcyBhbHJlYWR5XG4gKiBydW5uaW5nIGFuZCBhIHNlY29uZCBpbnN0YW5jZSBpcyBzdGFydGVkIGZyb20gdGhlIGNvbW1hbmQgbGluZS4gSXQgd2lsbCBhbHdheXNcbiAqIHRyeSB0byBjb21tdW5pY2F0ZSB3aXRoIGFuIGV4aXN0aW5nIGluc3RhbmNlIHRvIHByZXZlbnQgdGhhdCAyIFZTIENvZGUgaW5zdGFuY2VzXG4gKiBhcmUgcnVubmluZyBhdCB0aGUgc2FtZSB0aW1lLlxuICovXG5jbGFzcyBDb2RlTWFpbiB7XG5cblx0bWFpbigpOiB2b2lkIHtcblx0XHR0cnkge1xuXHRcdFx0dGhpcy5zdGFydHVwKCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoZXJyb3IubWVzc2FnZSk7XG5cdFx0XHRhcHAuZXhpdCgxKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHN0YXJ0dXAoKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBTZXQgdGhlIGVycm9yIGhhbmRsZXIgZWFybHkgZW5vdWdoIHNvIHRoYXQgd2UgYXJlIG5vdCBnZXR0aW5nIHRoZVxuXHRcdC8vIGRlZmF1bHQgZWxlY3Ryb24gZXJyb3IgZGlhbG9nIHBvcHBpbmcgdXBcblx0XHRzZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKGVyciA9PiBjb25zb2xlLmVycm9yKGVycikpO1xuXG5cdFx0Ly8gQ3JlYXRlIHNlcnZpY2VzXG5cdFx0Y29uc3QgW2luc3RhbnRpYXRpb25TZXJ2aWNlLCBpbnN0YW5jZUVudmlyb25tZW50LCBlbnZpcm9ubWVudE1haW5TZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSwgc3RhdGVNYWluU2VydmljZSwgYnVmZmVyTG9nZ2VyLCBwcm9kdWN0U2VydmljZSwgdXNlckRhdGFQcm9maWxlc01haW5TZXJ2aWNlXSA9IHRoaXMuY3JlYXRlU2VydmljZXMoKTtcblxuXHRcdHRyeSB7XG5cblx0XHRcdC8vIEluaXQgc2VydmljZXNcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuaW5pdFNlcnZpY2VzKGVudmlyb25tZW50TWFpblNlcnZpY2UsIHVzZXJEYXRhUHJvZmlsZXNNYWluU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UsIHN0YXRlTWFpblNlcnZpY2UsIHByb2R1Y3RTZXJ2aWNlKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cblx0XHRcdFx0Ly8gU2hvdyBhIGRpYWxvZyBmb3IgZXJyb3JzIHRoYXQgY2FuIGJlIHJlc29sdmVkIGJ5IHRoZSB1c2VyXG5cdFx0XHRcdHRoaXMuaGFuZGxlU3RhcnR1cERhdGFEaXJFcnJvcihlbnZpcm9ubWVudE1haW5TZXJ2aWNlLCBwcm9kdWN0U2VydmljZSwgZXJyb3IpO1xuXG5cdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBTdGFydHVwXG5cdFx0XHRhd2FpdCBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbihhc3luYyBhY2Nlc3NvciA9PiB7XG5cdFx0XHRcdGNvbnN0IGxvZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUxvZ1NlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBsaWZlY3ljbGVNYWluU2VydmljZSA9IGFjY2Vzc29yLmdldChJTGlmZWN5Y2xlTWFpblNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBmaWxlU2VydmljZSA9IGFjY2Vzc29yLmdldChJRmlsZVNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBsb2dnZXJTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMb2dnZXJTZXJ2aWNlKTtcblxuXHRcdFx0XHQvLyBDcmVhdGUgdGhlIG1haW4gSVBDIHNlcnZlciBieSB0cnlpbmcgdG8gYmUgdGhlIHNlcnZlclxuXHRcdFx0XHQvLyBJZiB0aGlzIHRocm93cyBhbiBlcnJvciBpdCBtZWFucyB3ZSBhcmUgbm90IHRoZSBmaXJzdFxuXHRcdFx0XHQvLyBpbnN0YW5jZSBvZiBWUyBDb2RlIHJ1bm5pbmcgYW5kIHNvIHdlIHdvdWxkIHF1aXQuXG5cdFx0XHRcdGNvbnN0IG1haW5Qcm9jZXNzTm9kZUlwY1NlcnZlciA9IGF3YWl0IHRoaXMuY2xhaW1JbnN0YW5jZShsb2dTZXJ2aWNlLCBlbnZpcm9ubWVudE1haW5TZXJ2aWNlLCBsaWZlY3ljbGVNYWluU2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UsIHByb2R1Y3RTZXJ2aWNlLCB0cnVlKTtcblxuXHRcdFx0XHQvLyBXcml0ZSBhIGxvY2tmaWxlIHRvIGluZGljYXRlIGFuIGluc3RhbmNlIGlzIHJ1bm5pbmdcblx0XHRcdFx0Ly8gKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMjc4NjEjaXNzdWVjb21tZW50LTg3NzQxNzQ1MSlcblx0XHRcdFx0RlNQcm9taXNlcy53cml0ZUZpbGUoZW52aXJvbm1lbnRNYWluU2VydmljZS5tYWluTG9ja2ZpbGUsIFN0cmluZyhwcm9jZXNzLnBpZCkpLmNhdGNoKGVyciA9PiB7XG5cdFx0XHRcdFx0bG9nU2VydmljZS53YXJuKGBhcHAjc3RhcnR1cCgpOiBFcnJvciB3cml0aW5nIG1haW4gbG9ja2ZpbGU6ICR7ZXJyLnN0YWNrfWApO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHQvLyBEZWxheSBjcmVhdGlvbiBvZiBzcGRsb2cgZm9yIHBlcmYgcmVhc29ucyAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzcyOTA2KVxuXHRcdFx0XHRidWZmZXJMb2dnZXIubG9nZ2VyID0gbG9nZ2VyU2VydmljZS5jcmVhdGVMb2dnZXIoJ21haW4nLCB7IG5hbWU6IGxvY2FsaXplKCdtYWluTG9nJywgXCJNYWluXCIpIH0pO1xuXG5cdFx0XHRcdC8vIExpZmVjeWNsZVxuXHRcdFx0XHRFdmVudC5vbmNlKGxpZmVjeWNsZU1haW5TZXJ2aWNlLm9uV2lsbFNodXRkb3duKShldnQgPT4ge1xuXHRcdFx0XHRcdGZpbGVTZXJ2aWNlLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRjb25maWd1cmF0aW9uU2VydmljZS5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0ZXZ0LmpvaW4oJ2luc3RhbmNlTG9ja2ZpbGUnLCBwcm9taXNlcy51bmxpbmsoZW52aXJvbm1lbnRNYWluU2VydmljZS5tYWluTG9ja2ZpbGUpLmNhdGNoKCgpID0+IHsgLyogaWdub3JlZCAqLyB9KSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHJldHVybiBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb2RlQXBwbGljYXRpb24sIG1haW5Qcm9jZXNzTm9kZUlwY1NlcnZlciwgaW5zdGFuY2VFbnZpcm9ubWVudCkuc3RhcnR1cCgpO1xuXHRcdFx0fSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKHRoaXMucXVpdCwgZXJyb3IpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgY3JlYXRlU2VydmljZXMoKTogW0lJbnN0YW50aWF0aW9uU2VydmljZSwgSVByb2Nlc3NFbnZpcm9ubWVudCwgSUVudmlyb25tZW50TWFpblNlcnZpY2UsIENvbmZpZ3VyYXRpb25TZXJ2aWNlLCBTdGF0ZVNlcnZpY2UsIEJ1ZmZlckxvZ2dlciwgSVByb2R1Y3RTZXJ2aWNlLCBVc2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2VdIHtcblx0XHRjb25zdCBzZXJ2aWNlcyA9IG5ldyBTZXJ2aWNlQ29sbGVjdGlvbigpO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHByb2Nlc3Mub25jZSgnZXhpdCcsICgpID0+IGRpc3Bvc2FibGVzLmRpc3Bvc2UoKSk7XG5cblx0XHQvLyBQcm9kdWN0XG5cdFx0Y29uc3QgcHJvZHVjdFNlcnZpY2UgPSB7IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCwgLi4ucHJvZHVjdCB9O1xuXHRcdHNlcnZpY2VzLnNldChJUHJvZHVjdFNlcnZpY2UsIHByb2R1Y3RTZXJ2aWNlKTtcblxuXHRcdC8vIEVudmlyb25tZW50XG5cdFx0Y29uc3QgZW52aXJvbm1lbnRNYWluU2VydmljZSA9IG5ldyBFbnZpcm9ubWVudE1haW5TZXJ2aWNlKHRoaXMucmVzb2x2ZUFyZ3MoKSwgcHJvZHVjdFNlcnZpY2UpO1xuXHRcdGNvbnN0IGluc3RhbmNlRW52aXJvbm1lbnQgPSB0aGlzLnBhdGNoRW52aXJvbm1lbnQoZW52aXJvbm1lbnRNYWluU2VydmljZSk7IC8vIFBhdGNoIGBwcm9jZXNzLmVudmAgd2l0aCB0aGUgaW5zdGFuY2UncyBlbnZpcm9ubWVudFxuXHRcdHNlcnZpY2VzLnNldChJRW52aXJvbm1lbnRNYWluU2VydmljZSwgZW52aXJvbm1lbnRNYWluU2VydmljZSk7XG5cblx0XHQvLyBMb2dnZXJcblx0XHRjb25zdCBsb2dnZXJTZXJ2aWNlID0gbmV3IExvZ2dlck1haW5TZXJ2aWNlKGdldExvZ0xldmVsKGVudmlyb25tZW50TWFpblNlcnZpY2UpLCBlbnZpcm9ubWVudE1haW5TZXJ2aWNlLmxvZ3NIb21lKTtcblx0XHRzZXJ2aWNlcy5zZXQoSUxvZ2dlck1haW5TZXJ2aWNlLCBsb2dnZXJTZXJ2aWNlKTtcblxuXHRcdC8vIExvZzogV2UgbmVlZCB0byBidWZmZXIgdGhlIHNwZGxvZyBsb2dzIHVudGlsIHdlIGFyZSBzdXJlXG5cdFx0Ly8gd2UgYXJlIHRoZSBvbmx5IGluc3RhbmNlIHJ1bm5pbmcsIG90aGVyd2lzZSB3ZSdsbCBoYXZlIGNvbmN1cnJlbnRcblx0XHQvLyBsb2cgZmlsZSBhY2Nlc3Mgb24gV2luZG93cyAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzQxMjE4KVxuXHRcdGNvbnN0IGJ1ZmZlckxvZ2dlciA9IG5ldyBCdWZmZXJMb2dnZXIobG9nZ2VyU2VydmljZS5nZXRMb2dMZXZlbCgpKTtcblx0XHRjb25zdCBsb2dTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBMb2dTZXJ2aWNlKGJ1ZmZlckxvZ2dlciwgW25ldyBDb25zb2xlTWFpbkxvZ2dlcihsb2dnZXJTZXJ2aWNlLmdldExvZ0xldmVsKCkpXSkpO1xuXHRcdHNlcnZpY2VzLnNldChJTG9nU2VydmljZSwgbG9nU2VydmljZSk7XG5cblx0XHQvLyBGaWxlc1xuXHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gbmV3IEZpbGVTZXJ2aWNlKGxvZ1NlcnZpY2UpO1xuXHRcdHNlcnZpY2VzLnNldChJRmlsZVNlcnZpY2UsIGZpbGVTZXJ2aWNlKTtcblx0XHRjb25zdCBkaXNrRmlsZVN5c3RlbVByb3ZpZGVyID0gbmV3IERpc2tGaWxlU3lzdGVtUHJvdmlkZXIobG9nU2VydmljZSk7XG5cdFx0ZmlsZVNlcnZpY2UucmVnaXN0ZXJQcm92aWRlcihTY2hlbWFzLmZpbGUsIGRpc2tGaWxlU3lzdGVtUHJvdmlkZXIpO1xuXG5cdFx0Ly8gVVJJIElkZW50aXR5XG5cdFx0Y29uc3QgdXJpSWRlbnRpdHlTZXJ2aWNlID0gbmV3IFVyaUlkZW50aXR5U2VydmljZShmaWxlU2VydmljZSk7XG5cdFx0c2VydmljZXMuc2V0KElVcmlJZGVudGl0eVNlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZSk7XG5cblx0XHQvLyBTdGF0ZVxuXHRcdGNvbnN0IHN0YXRlU2VydmljZSA9IG5ldyBTdGF0ZVNlcnZpY2UoU2F2ZVN0cmF0ZWd5LkRFTEFZRUQsIGVudmlyb25tZW50TWFpblNlcnZpY2UsIGxvZ1NlcnZpY2UsIGZpbGVTZXJ2aWNlKTtcblx0XHRzZXJ2aWNlcy5zZXQoSVN0YXRlUmVhZFNlcnZpY2UsIHN0YXRlU2VydmljZSk7XG5cdFx0c2VydmljZXMuc2V0KElTdGF0ZVNlcnZpY2UsIHN0YXRlU2VydmljZSk7XG5cblx0XHQvLyBVc2VyIERhdGEgUHJvZmlsZXNcblx0XHRjb25zdCB1c2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2UgPSBuZXcgVXNlckRhdGFQcm9maWxlc01haW5TZXJ2aWNlKHN0YXRlU2VydmljZSwgdXJpSWRlbnRpdHlTZXJ2aWNlLCBlbnZpcm9ubWVudE1haW5TZXJ2aWNlLCBmaWxlU2VydmljZSwgbG9nU2VydmljZSk7XG5cdFx0c2VydmljZXMuc2V0KElVc2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2UsIHVzZXJEYXRhUHJvZmlsZXNNYWluU2VydmljZSk7XG5cblx0XHQvLyBVc2UgRmlsZVVzZXJEYXRhUHJvdmlkZXIgZm9yIHVzZXIgZGF0YSB0b1xuXHRcdC8vIGVuYWJsZSBhdG9taWMgcmVhZCAvIHdyaXRlIG9wZXJhdGlvbnMuXG5cdFx0ZmlsZVNlcnZpY2UucmVnaXN0ZXJQcm92aWRlcihTY2hlbWFzLnZzY29kZVVzZXJEYXRhLCBuZXcgRmlsZVVzZXJEYXRhUHJvdmlkZXIoU2NoZW1hcy5maWxlLCBkaXNrRmlsZVN5c3RlbVByb3ZpZGVyLCBTY2hlbWFzLnZzY29kZVVzZXJEYXRhLCB1c2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZSwgbG9nU2VydmljZSkpO1xuXG5cdFx0Ly8gUG9saWN5XG5cdFx0bGV0IHBvbGljeVNlcnZpY2U6IElQb2xpY3lTZXJ2aWNlIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChpc1dpbmRvd3MgJiYgcHJvZHVjdFNlcnZpY2Uud2luMzJSZWdWYWx1ZU5hbWUpIHtcblx0XHRcdHBvbGljeVNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQobmV3IE5hdGl2ZVBvbGljeVNlcnZpY2UobG9nU2VydmljZSwgcHJvZHVjdFNlcnZpY2Uud2luMzJSZWdWYWx1ZU5hbWUpKTtcblx0XHR9IGVsc2UgaWYgKGlzTWFjaW50b3NoICYmIHByb2R1Y3RTZXJ2aWNlLmRhcndpbkJ1bmRsZUlkZW50aWZpZXIpIHtcblx0XHRcdHBvbGljeVNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQobmV3IE5hdGl2ZVBvbGljeVNlcnZpY2UobG9nU2VydmljZSwgcHJvZHVjdFNlcnZpY2UuZGFyd2luQnVuZGxlSWRlbnRpZmllcikpO1xuXHRcdH0gZWxzZSBpZiAoZW52aXJvbm1lbnRNYWluU2VydmljZS5wb2xpY3lGaWxlKSB7XG5cdFx0XHRwb2xpY3lTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaWxlUG9saWN5U2VydmljZShlbnZpcm9ubWVudE1haW5TZXJ2aWNlLnBvbGljeUZpbGUsIGZpbGVTZXJ2aWNlLCBsb2dTZXJ2aWNlKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHBvbGljeVNlcnZpY2UgPSBuZXcgTnVsbFBvbGljeVNlcnZpY2UoKTtcblx0XHR9XG5cdFx0c2VydmljZXMuc2V0KElQb2xpY3lTZXJ2aWNlLCBwb2xpY3lTZXJ2aWNlKTtcblxuXHRcdC8vIENvbmZpZ3VyYXRpb25cblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBDb25maWd1cmF0aW9uU2VydmljZSh1c2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2UuZGVmYXVsdFByb2ZpbGUuc2V0dGluZ3NSZXNvdXJjZSwgZmlsZVNlcnZpY2UsIHBvbGljeVNlcnZpY2UsIGxvZ1NlcnZpY2UpO1xuXHRcdHNlcnZpY2VzLnNldChJQ29uZmlndXJhdGlvblNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblxuXHRcdC8vIExpZmVjeWNsZVxuXHRcdHNlcnZpY2VzLnNldChJTGlmZWN5Y2xlTWFpblNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihMaWZlY3ljbGVNYWluU2VydmljZSwgdW5kZWZpbmVkLCBmYWxzZSkpO1xuXG5cdFx0Ly8gUmVxdWVzdFxuXHRcdHNlcnZpY2VzLnNldChJUmVxdWVzdFNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihSZXF1ZXN0U2VydmljZSwgdW5kZWZpbmVkLCB0cnVlKSk7XG5cblx0XHQvLyBUaGVtZXNcblx0XHRzZXJ2aWNlcy5zZXQoSVRoZW1lTWFpblNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihUaGVtZU1haW5TZXJ2aWNlKSk7XG5cblx0XHQvLyBTaWduaW5nXG5cdFx0c2VydmljZXMuc2V0KElTaWduU2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKFNpZ25TZXJ2aWNlLCB1bmRlZmluZWQsIGZhbHNlIC8qIHByb3hpZWQgdG8gb3RoZXIgcHJvY2Vzc2VzICovKSk7XG5cblx0XHQvLyBUdW5uZWxcblx0XHRzZXJ2aWNlcy5zZXQoSVR1bm5lbFNlcnZpY2UsIG5ldyBTeW5jRGVzY3JpcHRvcihUdW5uZWxTZXJ2aWNlKSk7XG5cblx0XHQvLyBQcm90b2NvbCAoaW5zdGFudGlhdGVkIGVhcmx5IGFuZCBub3QgdXNpbmcgc3luYyBkZXNjcmlwdG9yIGZvciBzZWN1cml0eSByZWFzb25zKVxuXHRcdHNlcnZpY2VzLnNldChJUHJvdG9jb2xNYWluU2VydmljZSwgbmV3IFByb3RvY29sTWFpblNlcnZpY2UoZW52aXJvbm1lbnRNYWluU2VydmljZSwgdXNlckRhdGFQcm9maWxlc01haW5TZXJ2aWNlLCBsb2dTZXJ2aWNlKSk7XG5cblx0XHRyZXR1cm4gW25ldyBJbnN0YW50aWF0aW9uU2VydmljZShzZXJ2aWNlcywgdHJ1ZSksIGluc3RhbmNlRW52aXJvbm1lbnQsIGVudmlyb25tZW50TWFpblNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBzdGF0ZVNlcnZpY2UsIGJ1ZmZlckxvZ2dlciwgcHJvZHVjdFNlcnZpY2UsIHVzZXJEYXRhUHJvZmlsZXNNYWluU2VydmljZV07XG5cdH1cblxuXHRwcml2YXRlIHBhdGNoRW52aXJvbm1lbnQoZW52aXJvbm1lbnRNYWluU2VydmljZTogSUVudmlyb25tZW50TWFpblNlcnZpY2UpOiBJUHJvY2Vzc0Vudmlyb25tZW50IHtcblx0XHRjb25zdCBpbnN0YW5jZUVudmlyb25tZW50OiBJUHJvY2Vzc0Vudmlyb25tZW50ID0ge1xuXHRcdFx0VlNDT0RFX0lQQ19IT09LOiBlbnZpcm9ubWVudE1haW5TZXJ2aWNlLm1haW5JUENIYW5kbGVcblx0XHR9O1xuXG5cdFx0WydWU0NPREVfTkxTX0NPTkZJRycsICdWU0NPREVfUE9SVEFCTEUnXS5mb3JFYWNoKGtleSA9PiB7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IHByb2Nlc3MuZW52W2tleV07XG5cdFx0XHRpZiAodHlwZW9mIHZhbHVlID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRpbnN0YW5jZUVudmlyb25tZW50W2tleV0gPSB2YWx1ZTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdE9iamVjdC5hc3NpZ24ocHJvY2Vzcy5lbnYsIGluc3RhbmNlRW52aXJvbm1lbnQpO1xuXG5cdFx0cmV0dXJuIGluc3RhbmNlRW52aXJvbm1lbnQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGluaXRTZXJ2aWNlcyhlbnZpcm9ubWVudE1haW5TZXJ2aWNlOiBJRW52aXJvbm1lbnRNYWluU2VydmljZSwgdXNlckRhdGFQcm9maWxlc01haW5TZXJ2aWNlOiBVc2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBDb25maWd1cmF0aW9uU2VydmljZSwgc3RhdGVTZXJ2aWNlOiBTdGF0ZVNlcnZpY2UsIHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCBQcm9taXNlcy5zZXR0bGVkPHVua25vd24+KFtcblxuXHRcdFx0Ly8gRW52aXJvbm1lbnQgc2VydmljZSAocGF0aHMpXG5cdFx0XHRQcm9taXNlLmFsbDxzdHJpbmcgfCB1bmRlZmluZWQ+KFtcblx0XHRcdFx0dGhpcy5hbGxvd1dpbmRvd3NVTkNQYXRoKGVudmlyb25tZW50TWFpblNlcnZpY2UuZXh0ZW5zaW9uc1BhdGgpLCAvLyBlbmFibGUgZXh0ZW5zaW9uIHBhdGhzIG9uIFVOQyBkcml2ZXMuLi5cblx0XHRcdFx0ZW52aXJvbm1lbnRNYWluU2VydmljZS5jb2RlQ2FjaGVQYXRoLFx0XHRcdFx0XHRcdFx0IC8vIC4uLm90aGVyIHVzZXItZGF0YS1kZXJpdmVkIHBhdGhzIHNob3VsZCBhbHJlYWR5IGJlIGVubGlzdGVkIGZyb20gYG1haW4uanNgXG5cdFx0XHRcdGVudmlyb25tZW50TWFpblNlcnZpY2UubG9nc0hvbWUud2l0aCh7IHNjaGVtZTogU2NoZW1hcy5maWxlIH0pLmZzUGF0aCxcblx0XHRcdFx0dXNlckRhdGFQcm9maWxlc01haW5TZXJ2aWNlLmRlZmF1bHRQcm9maWxlLmdsb2JhbFN0b3JhZ2VIb21lLndpdGgoeyBzY2hlbWU6IFNjaGVtYXMuZmlsZSB9KS5mc1BhdGgsXG5cdFx0XHRcdGVudmlyb25tZW50TWFpblNlcnZpY2Uud29ya3NwYWNlU3RvcmFnZUhvbWUud2l0aCh7IHNjaGVtZTogU2NoZW1hcy5maWxlIH0pLmZzUGF0aCxcblx0XHRcdFx0ZW52aXJvbm1lbnRNYWluU2VydmljZS5sb2NhbEhpc3RvcnlIb21lLndpdGgoeyBzY2hlbWU6IFNjaGVtYXMuZmlsZSB9KS5mc1BhdGgsXG5cdFx0XHRcdGVudmlyb25tZW50TWFpblNlcnZpY2UuYmFja3VwSG9tZVxuXHRcdFx0XS5tYXAocGF0aCA9PiBwYXRoID8gcHJvbWlzZXMubWtkaXIocGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSkgOiB1bmRlZmluZWQpKSxcblxuXHRcdFx0Ly8gU3RhdGUgc2VydmljZVxuXHRcdFx0c3RhdGVTZXJ2aWNlLmluaXQoKSxcblxuXHRcdFx0Ly8gQ29uZmlndXJhdGlvbiBzZXJ2aWNlXG5cdFx0XHRjb25maWd1cmF0aW9uU2VydmljZS5pbml0aWFsaXplKClcblx0XHRdKTtcblxuXHRcdC8vIEluaXRpYWxpemUgdXNlciBkYXRhIHByb2ZpbGVzIGFmdGVyIGluaXRpYWxpemluZyB0aGUgc3RhdGVcblx0XHR1c2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2UuaW5pdCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhbGxvd1dpbmRvd3NVTkNQYXRoKHBhdGg6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0aWYgKGlzV2luZG93cykge1xuXHRcdFx0Y29uc3QgaG9zdCA9IGdldFVOQ0hvc3QocGF0aCk7XG5cdFx0XHRpZiAoaG9zdCkge1xuXHRcdFx0XHRhZGRVTkNIb3N0VG9BbGxvd2xpc3QoaG9zdCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHBhdGg7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNsYWltSW5zdGFuY2UobG9nU2VydmljZTogSUxvZ1NlcnZpY2UsIGVudmlyb25tZW50TWFpblNlcnZpY2U6IElFbnZpcm9ubWVudE1haW5TZXJ2aWNlLCBsaWZlY3ljbGVNYWluU2VydmljZTogSUxpZmVjeWNsZU1haW5TZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLCByZXRyeTogYm9vbGVhbik6IFByb21pc2U8Tm9kZUlQQ1NlcnZlcj4ge1xuXG5cdFx0Ly8gVHJ5IHRvIHNldHVwIGEgc2VydmVyIGZvciBydW5uaW5nLiBJZiB0aGF0IHN1Y2NlZWRzIGl0IG1lYW5zXG5cdFx0Ly8gd2UgYXJlIHRoZSBmaXJzdCBpbnN0YW5jZSB0byBzdGFydHVwLiBPdGhlcndpc2UgaXQgaXMgbGlrZWx5XG5cdFx0Ly8gdGhhdCBhbm90aGVyIGluc3RhbmNlIGlzIGFscmVhZHkgcnVubmluZy5cblx0XHRsZXQgbWFpblByb2Nlc3NOb2RlSXBjU2VydmVyOiBOb2RlSVBDU2VydmVyO1xuXHRcdHRyeSB7XG5cdFx0XHRtYXJrKCdjb2RlL3dpbGxTdGFydE1haW5TZXJ2ZXInKTtcblx0XHRcdG1haW5Qcm9jZXNzTm9kZUlwY1NlcnZlciA9IGF3YWl0IG5vZGVJUENTZXJ2ZShlbnZpcm9ubWVudE1haW5TZXJ2aWNlLm1haW5JUENIYW5kbGUpO1xuXHRcdFx0bWFyaygnY29kZS9kaWRTdGFydE1haW5TZXJ2ZXInKTtcblx0XHRcdEV2ZW50Lm9uY2UobGlmZWN5Y2xlTWFpblNlcnZpY2Uub25XaWxsU2h1dGRvd24pKCgpID0+IG1haW5Qcm9jZXNzTm9kZUlwY1NlcnZlci5kaXNwb3NlKCkpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cblx0XHRcdC8vIEhhbmRsZSB1bmV4cGVjdGVkIGVycm9ycyAodGhlIG9ubHkgZXhwZWN0ZWQgZXJyb3IgaXMgRUFERFJJTlVTRSB0aGF0XG5cdFx0XHQvLyBpbmRpY2F0ZXMgYW5vdGhlciBpbnN0YW5jZSBvZiBWUyBDb2RlIGlzIHJ1bm5pbmcpXG5cdFx0XHRpZiAoZXJyb3IuY29kZSAhPT0gJ0VBRERSSU5VU0UnKSB7XG5cblx0XHRcdFx0Ly8gU2hvdyBhIGRpYWxvZyBmb3IgZXJyb3JzIHRoYXQgY2FuIGJlIHJlc29sdmVkIGJ5IHRoZSB1c2VyXG5cdFx0XHRcdHRoaXMuaGFuZGxlU3RhcnR1cERhdGFEaXJFcnJvcihlbnZpcm9ubWVudE1haW5TZXJ2aWNlLCBwcm9kdWN0U2VydmljZSwgZXJyb3IpO1xuXG5cdFx0XHRcdC8vIEFueSBvdGhlciBydW50aW1lIGVycm9yIGlzIGp1c3QgcHJpbnRlZCB0byB0aGUgY29uc29sZVxuXHRcdFx0XHR0aHJvdyBlcnJvcjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gdGhlcmUncyBhIHJ1bm5pbmcgaW5zdGFuY2UsIGxldCdzIGNvbm5lY3QgdG8gaXRcblx0XHRcdGxldCBjbGllbnQ6IE5vZGVJUENDbGllbnQ8c3RyaW5nPjtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNsaWVudCA9IGF3YWl0IG5vZGVJUENDb25uZWN0KGVudmlyb25tZW50TWFpblNlcnZpY2UubWFpbklQQ0hhbmRsZSwgJ21haW4nKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cblx0XHRcdFx0Ly8gSGFuZGxlIHVuZXhwZWN0ZWQgY29ubmVjdGlvbiBlcnJvcnMgYnkgc2hvd2luZyBhIGRpYWxvZyB0byB0aGUgdXNlclxuXHRcdFx0XHRpZiAoIXJldHJ5IHx8IGlzV2luZG93cyB8fCBlcnJvci5jb2RlICE9PSAnRUNPTk5SRUZVU0VEJykge1xuXHRcdFx0XHRcdGlmIChlcnJvci5jb2RlID09PSAnRVBFUk0nKSB7XG5cdFx0XHRcdFx0XHR0aGlzLnNob3dTdGFydHVwV2FybmluZ0RpYWxvZyhcblx0XHRcdFx0XHRcdFx0bG9jYWxpemUoJ3NlY29uZEluc3RhbmNlQWRtaW4nLCBcIkFub3RoZXIgaW5zdGFuY2Ugb2YgezB9IGlzIGFscmVhZHkgcnVubmluZyBhcyBhZG1pbmlzdHJhdG9yLlwiLCBwcm9kdWN0U2VydmljZS5uYW1lU2hvcnQpLFxuXHRcdFx0XHRcdFx0XHRsb2NhbGl6ZSgnc2Vjb25kSW5zdGFuY2VBZG1pbkRldGFpbCcsIFwiUGxlYXNlIGNsb3NlIHRoZSBvdGhlciBpbnN0YW5jZSBhbmQgdHJ5IGFnYWluLlwiKSxcblx0XHRcdFx0XHRcdFx0cHJvZHVjdFNlcnZpY2Vcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHQvLyBpdCBoYXBwZW5zIG9uIExpbnV4IGFuZCBPUyBYIHRoYXQgdGhlIHBpcGUgaXMgbGVmdCBiZWhpbmRcblx0XHRcdFx0Ly8gbGV0J3MgZGVsZXRlIGl0LCBzaW5jZSB3ZSBjYW4ndCBjb25uZWN0IHRvIGl0IGFuZCB0aGVuXG5cdFx0XHRcdC8vIHJldHJ5IHRoZSB3aG9sZSB0aGluZ1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdHVubGlua1N5bmMoZW52aXJvbm1lbnRNYWluU2VydmljZS5tYWluSVBDSGFuZGxlKTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHRsb2dTZXJ2aWNlLndhcm4oJ0NvdWxkIG5vdCBkZWxldGUgb2Jzb2xldGUgaW5zdGFuY2UgaGFuZGxlJywgZXJyb3IpO1xuXG5cdFx0XHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gdGhpcy5jbGFpbUluc3RhbmNlKGxvZ1NlcnZpY2UsIGVudmlyb25tZW50TWFpblNlcnZpY2UsIGxpZmVjeWNsZU1haW5TZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZSwgcHJvZHVjdFNlcnZpY2UsIGZhbHNlKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gVGVzdHMgZnJvbSBDTEkgcmVxdWlyZSB0byBiZSB0aGUgb25seSBpbnN0YW5jZSBjdXJyZW50bHlcblx0XHRcdGlmIChlbnZpcm9ubWVudE1haW5TZXJ2aWNlLmV4dGVuc2lvblRlc3RzTG9jYXRpb25VUkkgJiYgIWVudmlyb25tZW50TWFpblNlcnZpY2UuZGVidWdFeHRlbnNpb25Ib3N0LmJyZWFrKSB7XG5cdFx0XHRcdGNvbnN0IG1zZyA9IGBSdW5uaW5nIGV4dGVuc2lvbiB0ZXN0cyBmcm9tIHRoZSBjb21tYW5kIGxpbmUgaXMgY3VycmVudGx5IG9ubHkgc3VwcG9ydGVkIGlmIG5vIG90aGVyIGluc3RhbmNlIG9mICR7cHJvZHVjdFNlcnZpY2UubmFtZVNob3J0fSBpcyBydW5uaW5nLmA7XG5cdFx0XHRcdGxvZ1NlcnZpY2UuZXJyb3IobXNnKTtcblx0XHRcdFx0Y2xpZW50LmRpc3Bvc2UoKTtcblxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IobXNnKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2hvdyBhIHdhcm5pbmcgZGlhbG9nIGFmdGVyIHNvbWUgdGltZW91dCBpZiBpdCB0YWtlcyBsb25nIHRvIHRhbGsgdG8gdGhlIG90aGVyIGluc3RhbmNlXG5cdFx0XHQvLyBTa2lwIHRoaXMgaWYgd2UgYXJlIHJ1bm5pbmcgd2l0aCAtLXdhaXQgd2hlcmUgaXQgaXMgZXhwZWN0ZWQgdGhhdCB3ZSB3YWl0IGZvciBhIHdoaWxlLlxuXHRcdFx0Ly8gQWxzbyBza2lwIHdoZW4gZ2F0aGVyaW5nIGRpYWdub3N0aWNzICgtLXN0YXR1cykgd2hpY2ggY2FuIHRha2UgYSBsb25nZXIgdGltZS5cblx0XHRcdGxldCBzdGFydHVwV2FybmluZ0RpYWxvZ0hhbmRsZTogTm9kZUpTLlRpbWVvdXQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoIWVudmlyb25tZW50TWFpblNlcnZpY2UuYXJncy53YWl0ICYmICFlbnZpcm9ubWVudE1haW5TZXJ2aWNlLmFyZ3Muc3RhdHVzKSB7XG5cdFx0XHRcdHN0YXJ0dXBXYXJuaW5nRGlhbG9nSGFuZGxlID0gc2V0VGltZW91dCgoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5zaG93U3RhcnR1cFdhcm5pbmdEaWFsb2coXG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnc2Vjb25kSW5zdGFuY2VOb1Jlc3BvbnNlJywgXCJBbm90aGVyIGluc3RhbmNlIG9mIHswfSBpcyBydW5uaW5nIGJ1dCBub3QgcmVzcG9uZGluZ1wiLCBwcm9kdWN0U2VydmljZS5uYW1lU2hvcnQpLFxuXHRcdFx0XHRcdFx0bG9jYWxpemUoJ3NlY29uZEluc3RhbmNlTm9SZXNwb25zZURldGFpbCcsIFwiUGxlYXNlIGNsb3NlIGFsbCBvdGhlciBpbnN0YW5jZXMgYW5kIHRyeSBhZ2Fpbi5cIiksXG5cdFx0XHRcdFx0XHRwcm9kdWN0U2VydmljZVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH0sIDEwMDAwKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgb3RoZXJJbnN0YW5jZUxhdW5jaE1haW5TZXJ2aWNlID0gUHJveHlDaGFubmVsLnRvU2VydmljZTxJTGF1bmNoTWFpblNlcnZpY2U+KGNsaWVudC5nZXRDaGFubmVsKCdsYXVuY2gnKSwgeyBkaXNhYmxlTWFyc2hhbGxpbmc6IHRydWUgfSk7XG5cdFx0XHRjb25zdCBvdGhlckluc3RhbmNlRGlhZ25vc3RpY3NNYWluU2VydmljZSA9IFByb3h5Q2hhbm5lbC50b1NlcnZpY2U8SURpYWdub3N0aWNzTWFpblNlcnZpY2U+KGNsaWVudC5nZXRDaGFubmVsKCdkaWFnbm9zdGljcycpLCB7IGRpc2FibGVNYXJzaGFsbGluZzogdHJ1ZSB9KTtcblxuXHRcdFx0Ly8gUHJvY2VzcyBJbmZvXG5cdFx0XHRpZiAoZW52aXJvbm1lbnRNYWluU2VydmljZS5hcmdzLnN0YXR1cykge1xuXHRcdFx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGRpYWdub3N0aWNzU2VydmljZSA9IG5ldyBEaWFnbm9zdGljc1NlcnZpY2UoTnVsbFRlbGVtZXRyeVNlcnZpY2UsIHByb2R1Y3RTZXJ2aWNlKTtcblx0XHRcdFx0XHRjb25zdCBtYWluRGlhZ25vc3RpY3MgPSBhd2FpdCBvdGhlckluc3RhbmNlRGlhZ25vc3RpY3NNYWluU2VydmljZS5nZXRNYWluRGlhZ25vc3RpY3MoKTtcblx0XHRcdFx0XHRjb25zdCByZW1vdGVEaWFnbm9zdGljcyA9IGF3YWl0IG90aGVySW5zdGFuY2VEaWFnbm9zdGljc01haW5TZXJ2aWNlLmdldFJlbW90ZURpYWdub3N0aWNzKHsgaW5jbHVkZVByb2Nlc3NlczogdHJ1ZSwgaW5jbHVkZVdvcmtzcGFjZU1ldGFkYXRhOiB0cnVlIH0pO1xuXHRcdFx0XHRcdGNvbnN0IGRpYWdub3N0aWNzID0gYXdhaXQgZGlhZ25vc3RpY3NTZXJ2aWNlLmdldERpYWdub3N0aWNzKG1haW5EaWFnbm9zdGljcywgcmVtb3RlRGlhZ25vc3RpY3MpO1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKGRpYWdub3N0aWNzKTtcblxuXHRcdFx0XHRcdHRocm93IG5ldyBFeHBlY3RlZEVycm9yKCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBXaW5kb3dzOiBhbGxvdyB0byBzZXQgZm9yZWdyb3VuZFxuXHRcdFx0aWYgKGlzV2luZG93cykge1xuXHRcdFx0XHRhd2FpdCB0aGlzLndpbmRvd3NBbGxvd1NldEZvcmVncm91bmRXaW5kb3cob3RoZXJJbnN0YW5jZUxhdW5jaE1haW5TZXJ2aWNlLCBsb2dTZXJ2aWNlKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2VuZCBlbnZpcm9ubWVudCBvdmVyLi4uXG5cdFx0XHRsb2dTZXJ2aWNlLnRyYWNlKCdTZW5kaW5nIGVudiB0byBydW5uaW5nIGluc3RhbmNlLi4uJyk7XG5cdFx0XHRhd2FpdCBvdGhlckluc3RhbmNlTGF1bmNoTWFpblNlcnZpY2Uuc3RhcnQoZW52aXJvbm1lbnRNYWluU2VydmljZS5hcmdzLCBwcm9jZXNzLmVudiBhcyBJUHJvY2Vzc0Vudmlyb25tZW50KTtcblxuXHRcdFx0Ly8gQ2xlYW51cFxuXHRcdFx0Y2xpZW50LmRpc3Bvc2UoKTtcblxuXHRcdFx0Ly8gTm93IHRoYXQgd2Ugc3RhcnRlZCwgbWFrZSBzdXJlIHRoZSB3YXJuaW5nIGRpYWxvZyBpcyBwcmV2ZW50ZWRcblx0XHRcdGlmIChzdGFydHVwV2FybmluZ0RpYWxvZ0hhbmRsZSkge1xuXHRcdFx0XHRjbGVhclRpbWVvdXQoc3RhcnR1cFdhcm5pbmdEaWFsb2dIYW5kbGUpO1xuXHRcdFx0fVxuXG5cdFx0XHR0aHJvdyBuZXcgRXhwZWN0ZWRFcnJvcignU2VudCBlbnYgdG8gcnVubmluZyBpbnN0YW5jZS4gVGVybWluYXRpbmcuLi4nKTtcblx0XHR9XG5cblx0XHQvLyBQcmludCAtLXN0YXR1cyB1c2FnZSBpbmZvXG5cdFx0aWYgKGVudmlyb25tZW50TWFpblNlcnZpY2UuYXJncy5zdGF0dXMpIHtcblx0XHRcdGNvbnNvbGUubG9nKGxvY2FsaXplKCdzdGF0dXNXYXJuaW5nJywgXCJXYXJuaW5nOiBUaGUgLS1zdGF0dXMgYXJndW1lbnQgY2FuIG9ubHkgYmUgdXNlZCBpZiB7MH0gaXMgYWxyZWFkeSBydW5uaW5nLiBQbGVhc2UgcnVuIGl0IGFnYWluIGFmdGVyIHswfSBoYXMgc3RhcnRlZC5cIiwgcHJvZHVjdFNlcnZpY2UubmFtZVNob3J0KSk7XG5cblx0XHRcdHRocm93IG5ldyBFeHBlY3RlZEVycm9yKCdUZXJtaW5hdGluZy4uLicpO1xuXHRcdH1cblxuXHRcdC8vIFNldCB0aGUgVlNDT0RFX1BJRCB2YXJpYWJsZSBoZXJlIHdoZW4gd2UgYXJlIHN1cmUgd2UgYXJlIHRoZSBmaXJzdFxuXHRcdC8vIGluc3RhbmNlIHRvIHN0YXJ0dXAuIE90aGVyd2lzZSB3ZSB3b3VsZCB3cm9uZ2x5IG92ZXJ3cml0ZSB0aGUgUElEXG5cdFx0cHJvY2Vzcy5lbnZbJ1ZTQ09ERV9QSUQnXSA9IFN0cmluZyhwcm9jZXNzLnBpZCk7XG5cblx0XHRyZXR1cm4gbWFpblByb2Nlc3NOb2RlSXBjU2VydmVyO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVTdGFydHVwRGF0YURpckVycm9yKGVudmlyb25tZW50TWFpblNlcnZpY2U6IElFbnZpcm9ubWVudE1haW5TZXJ2aWNlLCBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLCBlcnJvcjogTm9kZUpTLkVycm5vRXhjZXB0aW9uKTogdm9pZCB7XG5cdFx0aWYgKGVycm9yLmNvZGUgPT09ICdFQUNDRVMnIHx8IGVycm9yLmNvZGUgPT09ICdFUEVSTScpIHtcblx0XHRcdGNvbnN0IGRpcmVjdG9yaWVzID0gY29hbGVzY2UoW2Vudmlyb25tZW50TWFpblNlcnZpY2UudXNlckRhdGFQYXRoLCBlbnZpcm9ubWVudE1haW5TZXJ2aWNlLmV4dGVuc2lvbnNQYXRoLCBYREdfUlVOVElNRV9ESVJdKS5tYXAoZm9sZGVyID0+IGdldFBhdGhMYWJlbChVUkkuZmlsZShmb2xkZXIpLCB7IG9zOiBPUywgdGlsZGlmeTogZW52aXJvbm1lbnRNYWluU2VydmljZSB9KSk7XG5cblx0XHRcdHRoaXMuc2hvd1N0YXJ0dXBXYXJuaW5nRGlhbG9nKFxuXHRcdFx0XHRsb2NhbGl6ZSgnc3RhcnR1cERhdGFEaXJFcnJvcicsIFwiVW5hYmxlIHRvIHdyaXRlIHByb2dyYW0gdXNlciBkYXRhLlwiKSxcblx0XHRcdFx0bG9jYWxpemUoJ3N0YXJ0dXBVc2VyRGF0YUFuZEV4dGVuc2lvbnNEaXJFcnJvckRldGFpbCcsIFwiezB9XFxuXFxuUGxlYXNlIG1ha2Ugc3VyZSB0aGUgZm9sbG93aW5nIGRpcmVjdG9yaWVzIGFyZSB3cml0ZWFibGU6XFxuXFxuezF9XCIsIHRvRXJyb3JNZXNzYWdlKGVycm9yKSwgZGlyZWN0b3JpZXMuam9pbignXFxuJykpLFxuXHRcdFx0XHRwcm9kdWN0U2VydmljZVxuXHRcdFx0KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHNob3dTdGFydHVwV2FybmluZ0RpYWxvZyhtZXNzYWdlOiBzdHJpbmcsIGRldGFpbDogc3RyaW5nLCBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlKTogdm9pZCB7XG5cblx0XHQvLyB1c2Ugc3luYyB2YXJpYW50IGhlcmUgYmVjYXVzZSB3ZSBsaWtlbHkgZXhpdCBhZnRlciB0aGlzIG1ldGhvZFxuXHRcdC8vIGR1ZSB0byBzdGFydHVwIGlzc3VlcyBhbmQgb3RoZXJ3aXNlIHRoZSBkaWFsb2cgc2VlbXMgdG8gZGlzYXBwZWFyXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEwNDQ5M1xuXG5cdFx0ZGlhbG9nLnNob3dNZXNzYWdlQm94U3luYyhtYXNzYWdlTWVzc2FnZUJveE9wdGlvbnMoe1xuXHRcdFx0dHlwZTogJ3dhcm5pbmcnLFxuXHRcdFx0YnV0dG9uczogW2xvY2FsaXplKHsga2V5OiAnY2xvc2UnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYyddIH0sIFwiJiZDbG9zZVwiKV0sXG5cdFx0XHRtZXNzYWdlLFxuXHRcdFx0ZGV0YWlsXG5cdFx0fSwgcHJvZHVjdFNlcnZpY2UpLm9wdGlvbnMpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB3aW5kb3dzQWxsb3dTZXRGb3JlZ3JvdW5kV2luZG93KGxhdW5jaE1haW5TZXJ2aWNlOiBJTGF1bmNoTWFpblNlcnZpY2UsIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKGlzV2luZG93cykge1xuXHRcdFx0Y29uc3QgcHJvY2Vzc0lkID0gYXdhaXQgbGF1bmNoTWFpblNlcnZpY2UuZ2V0TWFpblByb2Nlc3NJZCgpO1xuXG5cdFx0XHRsb2dTZXJ2aWNlLnRyYWNlKCdTZW5kaW5nIHNvbWUgZm9yZWdyb3VuZCBsb3ZlIHRvIHRoZSBydW5uaW5nIGluc3RhbmNlOicsIHByb2Nlc3NJZCk7XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdChhd2FpdCBpbXBvcnQoJ3dpbmRvd3MtZm9yZWdyb3VuZC1sb3ZlJykpLmFsbG93U2V0Rm9yZWdyb3VuZFdpbmRvdyhwcm9jZXNzSWQpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0bG9nU2VydmljZS5lcnJvcihlcnJvcik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBxdWl0KGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCByZWFzb24/OiBFeHBlY3RlZEVycm9yIHwgRXJyb3IpOiB2b2lkIHtcblx0XHRjb25zdCBsb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMb2dTZXJ2aWNlKTtcblx0XHRjb25zdCBsaWZlY3ljbGVNYWluU2VydmljZSA9IGFjY2Vzc29yLmdldChJTGlmZWN5Y2xlTWFpblNlcnZpY2UpO1xuXG5cdFx0bGV0IGV4aXRDb2RlID0gMDtcblxuXHRcdGlmIChyZWFzb24pIHtcblx0XHRcdGlmICgocmVhc29uIGFzIEV4cGVjdGVkRXJyb3IpLmlzRXhwZWN0ZWQpIHtcblx0XHRcdFx0aWYgKHJlYXNvbi5tZXNzYWdlKSB7XG5cdFx0XHRcdFx0bG9nU2VydmljZS50cmFjZShyZWFzb24ubWVzc2FnZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGV4aXRDb2RlID0gMTsgLy8gc2lnbmFsIGVycm9yIHRvIHRoZSBvdXRzaWRlXG5cblx0XHRcdFx0aWYgKHJlYXNvbi5zdGFjaykge1xuXHRcdFx0XHRcdGxvZ1NlcnZpY2UuZXJyb3IocmVhc29uLnN0YWNrKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRsb2dTZXJ2aWNlLmVycm9yKGBTdGFydHVwIGVycm9yOiAke3JlYXNvbi50b1N0cmluZygpfWApO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGlmZWN5Y2xlTWFpblNlcnZpY2Uua2lsbChleGl0Q29kZSk7XG5cdH1cblxuXHQvLyNyZWdpb24gQ29tbWFuZCBsaW5lIGFyZ3VtZW50cyB1dGlsaXRpZXNcblxuXHRwcml2YXRlIHJlc29sdmVBcmdzKCk6IE5hdGl2ZVBhcnNlZEFyZ3Mge1xuXG5cdFx0Ly8gUGFyc2UgYXJndW1lbnRzXG5cdFx0Y29uc3QgYXJncyA9IHRoaXMudmFsaWRhdGVQYXRocyhwYXJzZU1haW5Qcm9jZXNzQXJndihwcm9jZXNzLmFyZ3YpKTtcblxuXHRcdC8vIElmIHdlIGFyZSBzdGFydGVkIHdpdGggLS13YWl0IGNyZWF0ZSBhIHJhbmRvbSB0ZW1wb3JhcnkgZmlsZVxuXHRcdC8vIGFuZCBwYXNzIGl0IG92ZXIgdG8gdGhlIHN0YXJ0aW5nIGluc3RhbmNlLiBXZSBjYW4gdXNlIHRoaXMgZmlsZVxuXHRcdC8vIHRvIHdhaXQgZm9yIGl0IHRvIGJlIGRlbGV0ZWQgdG8gbW9uaXRvciB0aGF0IHRoZSBlZGl0ZWQgZmlsZVxuXHRcdC8vIGlzIGNsb3NlZCBhbmQgdGhlbiBleGl0IHRoZSB3YWl0aW5nIHByb2Nlc3MuXG5cdFx0Ly9cblx0XHQvLyBOb3RlOiB3ZSBhcmUgbm90IGRvaW5nIHRoaXMgaWYgdGhlIHdhaXQgbWFya2VyIGhhcyBiZWVuIGFscmVhZHlcblx0XHQvLyBhZGRlZCBhcyBhcmd1bWVudC4gVGhpcyBjYW4gaGFwcGVuIGlmIFZTIENvZGUgd2FzIHN0YXJ0ZWQgZnJvbSBDTEkuXG5cblx0XHRpZiAoYXJncy53YWl0ICYmICFhcmdzLndhaXRNYXJrZXJGaWxlUGF0aCkge1xuXHRcdFx0Y29uc3Qgd2FpdE1hcmtlckZpbGVQYXRoID0gY3JlYXRlV2FpdE1hcmtlckZpbGVTeW5jKGFyZ3MudmVyYm9zZSk7XG5cdFx0XHRpZiAod2FpdE1hcmtlckZpbGVQYXRoKSB7XG5cdFx0XHRcdGFkZEFyZyhwcm9jZXNzLmFyZ3YsICctLXdhaXRNYXJrZXJGaWxlUGF0aCcsIHdhaXRNYXJrZXJGaWxlUGF0aCk7XG5cdFx0XHRcdGFyZ3Mud2FpdE1hcmtlckZpbGVQYXRoID0gd2FpdE1hcmtlckZpbGVQYXRoO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBhcmdzO1xuXHR9XG5cblx0cHJpdmF0ZSB2YWxpZGF0ZVBhdGhzKGFyZ3M6IE5hdGl2ZVBhcnNlZEFyZ3MpOiBOYXRpdmVQYXJzZWRBcmdzIHtcblxuXHRcdC8vIFRyYWNrIFVSTHMgaWYgdGhleSdyZSBnb2luZyB0byBiZSB1c2VkXG5cdFx0aWYgKGFyZ3NbJ29wZW4tdXJsJ10pIHtcblx0XHRcdGFyZ3MuX3VybHMgPSBhcmdzLl87XG5cdFx0XHRhcmdzLl8gPSBbXTtcblx0XHR9XG5cblx0XHQvLyBOb3JtYWxpemUgcGF0aHMgYW5kIHdhdGNoIG91dCBmb3IgZ290byBsaW5lIG1vZGVcblx0XHRpZiAoIWFyZ3NbJ3JlbW90ZSddKSB7XG5cdFx0XHRjb25zdCBwYXRocyA9IHRoaXMuZG9WYWxpZGF0ZVBhdGhzKGFyZ3MuXywgYXJncy5nb3RvKTtcblx0XHRcdGFyZ3MuXyA9IHBhdGhzO1xuXHRcdH1cblxuXHRcdHJldHVybiBhcmdzO1xuXHR9XG5cblx0cHJpdmF0ZSBkb1ZhbGlkYXRlUGF0aHMoYXJnczogc3RyaW5nW10sIGdvdG9MaW5lTW9kZT86IGJvb2xlYW4pOiBzdHJpbmdbXSB7XG5cdFx0Y29uc3QgY3VycmVudFdvcmtpbmdEaXIgPSBjd2QoKTtcblx0XHRjb25zdCByZXN1bHQgPSBhcmdzLm1hcChhcmcgPT4ge1xuXHRcdFx0bGV0IHBhdGhDYW5kaWRhdGUgPSBTdHJpbmcoYXJnKTtcblxuXHRcdFx0bGV0IHBhcnNlZFBhdGg6IElQYXRoV2l0aExpbmVBbmRDb2x1bW4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoZ290b0xpbmVNb2RlKSB7XG5cdFx0XHRcdHBhcnNlZFBhdGggPSBwYXJzZUxpbmVBbmRDb2x1bW5Bd2FyZShwYXRoQ2FuZGlkYXRlKTtcblx0XHRcdFx0cGF0aENhbmRpZGF0ZSA9IHBhcnNlZFBhdGgucGF0aDtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHBhdGhDYW5kaWRhdGUpIHtcblx0XHRcdFx0cGF0aENhbmRpZGF0ZSA9IHRoaXMucHJlcGFyZVBhdGgoY3VycmVudFdvcmtpbmdEaXIsIHBhdGhDYW5kaWRhdGUpO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBzYW5pdGl6ZWRGaWxlUGF0aCA9IHNhbml0aXplRmlsZVBhdGgocGF0aENhbmRpZGF0ZSwgY3VycmVudFdvcmtpbmdEaXIpO1xuXG5cdFx0XHRjb25zdCBmaWxlUGF0aEJhc2VuYW1lID0gYmFzZW5hbWUoc2FuaXRpemVkRmlsZVBhdGgpO1xuXHRcdFx0aWYgKGZpbGVQYXRoQmFzZW5hbWUgLyogY2FuIGJlIGVtcHR5IGlmIGNvZGUgaXMgb3BlbmVkIG9uIHJvb3QgKi8gJiYgIWlzVmFsaWRCYXNlbmFtZShmaWxlUGF0aEJhc2VuYW1lKSkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbDsgLy8gZG8gbm90IGFsbG93IGludmFsaWQgZmlsZSBuYW1lc1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZ290b0xpbmVNb2RlICYmIHBhcnNlZFBhdGgpIHtcblx0XHRcdFx0cGFyc2VkUGF0aC5wYXRoID0gc2FuaXRpemVkRmlsZVBhdGg7XG5cblx0XHRcdFx0cmV0dXJuIHRoaXMudG9QYXRoKHBhcnNlZFBhdGgpO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gc2FuaXRpemVkRmlsZVBhdGg7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBjYXNlSW5zZW5zaXRpdmUgPSBpc1dpbmRvd3MgfHwgaXNNYWNpbnRvc2g7XG5cdFx0Y29uc3QgZGlzdGluY3RQYXRocyA9IGRpc3RpbmN0KHJlc3VsdCwgcGF0aCA9PiBwYXRoICYmIGNhc2VJbnNlbnNpdGl2ZSA/IHBhdGgudG9Mb3dlckNhc2UoKSA6IChwYXRoIHx8ICcnKSk7XG5cblx0XHRyZXR1cm4gY29hbGVzY2UoZGlzdGluY3RQYXRocyk7XG5cdH1cblxuXHRwcml2YXRlIHByZXBhcmVQYXRoKGN3ZDogc3RyaW5nLCBwYXRoOiBzdHJpbmcpOiBzdHJpbmcge1xuXG5cdFx0Ly8gVHJpbSB0cmFpbGluZyBxdW90ZXNcblx0XHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0XHRwYXRoID0gcnRyaW0ocGF0aCwgJ1wiJyk7IC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNDk4XG5cdFx0fVxuXG5cdFx0Ly8gVHJpbSB3aGl0ZXNwYWNlc1xuXHRcdHBhdGggPSB0cmltKHRyaW0ocGF0aCwgJyAnKSwgJ1xcdCcpO1xuXG5cdFx0aWYgKGlzV2luZG93cykge1xuXG5cdFx0XHQvLyBSZXNvbHZlIHRoZSBwYXRoIGFnYWluc3QgY3dkIGlmIGl0IGlzIHJlbGF0aXZlXG5cdFx0XHRwYXRoID0gcmVzb2x2ZShjd2QsIHBhdGgpO1xuXG5cdFx0XHQvLyBUcmltIHRyYWlsaW5nICcuJyBjaGFycyBvbiBXaW5kb3dzIHRvIHByZXZlbnQgaW52YWxpZCBmaWxlIG5hbWVzXG5cdFx0XHRwYXRoID0gcnRyaW0ocGF0aCwgJy4nKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcGF0aDtcblx0fVxuXG5cdHByaXZhdGUgdG9QYXRoKHBhdGhXaXRoTGluZUFuZENvbDogSVBhdGhXaXRoTGluZUFuZENvbHVtbik6IHN0cmluZyB7XG5cdFx0Y29uc3Qgc2VnbWVudHMgPSBbcGF0aFdpdGhMaW5lQW5kQ29sLnBhdGhdO1xuXG5cdFx0aWYgKHR5cGVvZiBwYXRoV2l0aExpbmVBbmRDb2wubGluZSA9PT0gJ251bWJlcicpIHtcblx0XHRcdHNlZ21lbnRzLnB1c2goU3RyaW5nKHBhdGhXaXRoTGluZUFuZENvbC5saW5lKSk7XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBwYXRoV2l0aExpbmVBbmRDb2wuY29sdW1uID09PSAnbnVtYmVyJykge1xuXHRcdFx0c2VnbWVudHMucHVzaChTdHJpbmcocGF0aFdpdGhMaW5lQW5kQ29sLmNvbHVtbikpO1xuXHRcdH1cblxuXHRcdHJldHVybiBzZWdtZW50cy5qb2luKCc6Jyk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cbn1cblxuLy8gTWFpbiBTdGFydHVwXG5jb25zdCBjb2RlID0gbmV3IENvZGVNYWluKCk7XG5jb2RlLm1haW4oKTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU87QUFFUCxTQUFTLEtBQUssY0FBYztBQUM1QixTQUFTLFlBQVksZ0JBQWdCO0FBQ3JDLFNBQVMsV0FBVztBQUNwQixTQUFTLFVBQVUsZ0JBQWdCO0FBQ25DLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZUFBZSxpQ0FBaUM7QUFDekQsU0FBaUMsaUJBQWlCLHlCQUF5Qix3QkFBd0I7QUFDbkcsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZUFBZTtBQUN4QixTQUFTLFVBQVUsZUFBZTtBQUNsQyxTQUFTLFlBQVk7QUFDckIsU0FBOEIsYUFBYSxXQUFXLFVBQVU7QUFDaEUsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsT0FBTyxZQUFZO0FBQzVCLFNBQVMsWUFBWSxrQkFBa0I7QUFDdkMsU0FBUyxvQkFBb0I7QUFFN0IsU0FBUyxXQUFXLGdCQUFnQixTQUFTLGNBQXVDLHVCQUF1QjtBQUMzRyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDRCQUE0QjtBQUVyQyxTQUFTLDBCQUEwQjtBQUVuQyxTQUFTLHdCQUF3QiwrQkFBK0I7QUFDaEUsU0FBUyxRQUFRLDRCQUE0QjtBQUM3QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLHNCQUFzQjtBQUUvQixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHlCQUF5QjtBQUVsQyxTQUFTLHVCQUF1Qiw0QkFBNEI7QUFDNUQsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxtQkFBbUIsYUFBYSxnQkFBZ0IsbUJBQW1CO0FBQzVFLE9BQU8sYUFBYTtBQUNwQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLG1CQUFtQixxQkFBcUI7QUFDakQsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxtQkFBbUIsd0JBQXdCO0FBQ3BELFNBQVMsOEJBQThCLG1DQUFtQztBQUMxRSxTQUFTLGdCQUFnQix5QkFBeUI7QUFDbEQsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxvQkFBb0IseUJBQXlCO0FBQ3RELFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsY0FBYyxvQkFBb0I7QUFDM0MsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyx1QkFBdUIsa0JBQWtCO0FBVWxELE1BQU0sU0FBUztBQUFBLEVBRWQsT0FBYTtBQUNaLFFBQUk7QUFDSCxXQUFLLFFBQVE7QUFBQSxJQUNkLFNBQVMsT0FBTztBQUNmLGNBQVEsTUFBTSxNQUFNLE9BQU87QUFDM0IsVUFBSSxLQUFLLENBQUM7QUFBQSxJQUNYO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBYyxVQUF5QjtBQUl0Qyw4QkFBMEIsU0FBTyxRQUFRLE1BQU0sR0FBRyxDQUFDO0FBR25ELFVBQU0sQ0FBQyxzQkFBc0IscUJBQXFCLHdCQUF3QixzQkFBc0Isa0JBQWtCLGNBQWMsZ0JBQWdCLDJCQUEyQixJQUFJLEtBQUssZUFBZTtBQUVuTSxRQUFJO0FBR0gsVUFBSTtBQUNILGNBQU0sS0FBSyxhQUFhLHdCQUF3Qiw2QkFBNkIsc0JBQXNCLGtCQUFrQixjQUFjO0FBQUEsTUFDcEksU0FBUyxPQUFPO0FBR2YsYUFBSywwQkFBMEIsd0JBQXdCLGdCQUFnQixLQUFLO0FBRTVFLGNBQU07QUFBQSxNQUNQO0FBR0EsWUFBTSxxQkFBcUIsZUFBZSxPQUFNLGFBQVk7QUFDM0QsY0FBTSxhQUFhLFNBQVMsSUFBSSxXQUFXO0FBQzNDLGNBQU0sdUJBQXVCLFNBQVMsSUFBSSxxQkFBcUI7QUFDL0QsY0FBTSxjQUFjLFNBQVMsSUFBSSxZQUFZO0FBQzdDLGNBQU0sZ0JBQWdCLFNBQVMsSUFBSSxjQUFjO0FBS2pELGNBQU0sMkJBQTJCLE1BQU0sS0FBSyxjQUFjLFlBQVksd0JBQXdCLHNCQUFzQixzQkFBc0IsZ0JBQWdCLElBQUk7QUFJOUosbUJBQVcsVUFBVSx1QkFBdUIsY0FBYyxPQUFPLFFBQVEsR0FBRyxDQUFDLEVBQUUsTUFBTSxTQUFPO0FBQzNGLHFCQUFXLEtBQUssK0NBQStDLElBQUksS0FBSyxFQUFFO0FBQUEsUUFDM0UsQ0FBQztBQUdELHFCQUFhLFNBQVMsY0FBYyxhQUFhLFFBQVEsRUFBRSxNQUFNLFNBQVMsV0FBVyxNQUFNLEVBQUUsQ0FBQztBQUc5RixjQUFNLEtBQUsscUJBQXFCLGNBQWMsRUFBRSxTQUFPO0FBQ3RELHNCQUFZLFFBQVE7QUFDcEIsK0JBQXFCLFFBQVE7QUFDN0IsY0FBSSxLQUFLLG9CQUFvQixTQUFTLE9BQU8sdUJBQXVCLFlBQVksRUFBRSxNQUFNLE1BQU07QUFBQSxVQUFnQixDQUFDLENBQUM7QUFBQSxRQUNqSCxDQUFDO0FBRUQsZUFBTyxxQkFBcUIsZUFBZSxpQkFBaUIsMEJBQTBCLG1CQUFtQixFQUFFLFFBQVE7QUFBQSxNQUNwSCxDQUFDO0FBQUEsSUFDRixTQUFTLE9BQU87QUFDZiwyQkFBcUIsZUFBZSxLQUFLLE1BQU0sS0FBSztBQUFBLElBQ3JEO0FBQUEsRUFDRDtBQUFBLEVBRVEsaUJBQXdMO0FBQy9MLFVBQU0sV0FBVyxJQUFJLGtCQUFrQjtBQUN2QyxVQUFNLGNBQWMsSUFBSSxnQkFBZ0I7QUFDeEMsWUFBUSxLQUFLLFFBQVEsTUFBTSxZQUFZLFFBQVEsQ0FBQztBQUdoRCxVQUFNLGlCQUFpQixFQUFFLGVBQWUsUUFBVyxHQUFHLFFBQVE7QUFDOUQsYUFBUyxJQUFJLGlCQUFpQixjQUFjO0FBRzVDLFVBQU0seUJBQXlCLElBQUksdUJBQXVCLEtBQUssWUFBWSxHQUFHLGNBQWM7QUFDNUYsVUFBTSxzQkFBc0IsS0FBSyxpQkFBaUIsc0JBQXNCO0FBQ3hFLGFBQVMsSUFBSSx5QkFBeUIsc0JBQXNCO0FBRzVELFVBQU0sZ0JBQWdCLElBQUksa0JBQWtCLFlBQVksc0JBQXNCLEdBQUcsdUJBQXVCLFFBQVE7QUFDaEgsYUFBUyxJQUFJLG9CQUFvQixhQUFhO0FBSzlDLFVBQU0sZUFBZSxJQUFJLGFBQWEsY0FBYyxZQUFZLENBQUM7QUFDakUsVUFBTSxhQUFhLFlBQVksSUFBSSxJQUFJLFdBQVcsY0FBYyxDQUFDLElBQUksa0JBQWtCLGNBQWMsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3JILGFBQVMsSUFBSSxhQUFhLFVBQVU7QUFHcEMsVUFBTSxjQUFjLElBQUksWUFBWSxVQUFVO0FBQzlDLGFBQVMsSUFBSSxjQUFjLFdBQVc7QUFDdEMsVUFBTSx5QkFBeUIsSUFBSSx1QkFBdUIsVUFBVTtBQUNwRSxnQkFBWSxpQkFBaUIsUUFBUSxNQUFNLHNCQUFzQjtBQUdqRSxVQUFNLHFCQUFxQixJQUFJLG1CQUFtQixXQUFXO0FBQzdELGFBQVMsSUFBSSxxQkFBcUIsa0JBQWtCO0FBR3BELFVBQU0sZUFBZSxJQUFJLGFBQWEsYUFBYSxTQUFTLHdCQUF3QixZQUFZLFdBQVc7QUFDM0csYUFBUyxJQUFJLG1CQUFtQixZQUFZO0FBQzVDLGFBQVMsSUFBSSxlQUFlLFlBQVk7QUFHeEMsVUFBTSw4QkFBOEIsSUFBSSw0QkFBNEIsY0FBYyxvQkFBb0Isd0JBQXdCLGFBQWEsVUFBVTtBQUNySixhQUFTLElBQUksOEJBQThCLDJCQUEyQjtBQUl0RSxnQkFBWSxpQkFBaUIsUUFBUSxnQkFBZ0IsSUFBSSxxQkFBcUIsUUFBUSxNQUFNLHdCQUF3QixRQUFRLGdCQUFnQiw2QkFBNkIsb0JBQW9CLFVBQVUsQ0FBQztBQUd4TSxRQUFJO0FBQ0osUUFBSSxhQUFhLGVBQWUsbUJBQW1CO0FBQ2xELHNCQUFnQixZQUFZLElBQUksSUFBSSxvQkFBb0IsWUFBWSxlQUFlLGlCQUFpQixDQUFDO0FBQUEsSUFDdEcsV0FBVyxlQUFlLGVBQWUsd0JBQXdCO0FBQ2hFLHNCQUFnQixZQUFZLElBQUksSUFBSSxvQkFBb0IsWUFBWSxlQUFlLHNCQUFzQixDQUFDO0FBQUEsSUFDM0csV0FBVyx1QkFBdUIsWUFBWTtBQUM3QyxzQkFBZ0IsWUFBWSxJQUFJLElBQUksa0JBQWtCLHVCQUF1QixZQUFZLGFBQWEsVUFBVSxDQUFDO0FBQUEsSUFDbEgsT0FBTztBQUNOLHNCQUFnQixJQUFJLGtCQUFrQjtBQUFBLElBQ3ZDO0FBQ0EsYUFBUyxJQUFJLGdCQUFnQixhQUFhO0FBRzFDLFVBQU0sdUJBQXVCLElBQUkscUJBQXFCLDRCQUE0QixlQUFlLGtCQUFrQixhQUFhLGVBQWUsVUFBVTtBQUN6SixhQUFTLElBQUksdUJBQXVCLG9CQUFvQjtBQUd4RCxhQUFTLElBQUksdUJBQXVCLElBQUksZUFBZSxzQkFBc0IsUUFBVyxLQUFLLENBQUM7QUFHOUYsYUFBUyxJQUFJLGlCQUFpQixJQUFJLGVBQWUsZ0JBQWdCLFFBQVcsSUFBSSxDQUFDO0FBR2pGLGFBQVMsSUFBSSxtQkFBbUIsSUFBSSxlQUFlLGdCQUFnQixDQUFDO0FBR3BFLGFBQVMsSUFBSSxjQUFjLElBQUk7QUFBQSxNQUFlO0FBQUEsTUFBYTtBQUFBLE1BQVc7QUFBQTtBQUFBLElBQXNDLENBQUM7QUFHN0csYUFBUyxJQUFJLGdCQUFnQixJQUFJLGVBQWUsYUFBYSxDQUFDO0FBRzlELGFBQVMsSUFBSSxzQkFBc0IsSUFBSSxvQkFBb0Isd0JBQXdCLDZCQUE2QixVQUFVLENBQUM7QUFFM0gsV0FBTyxDQUFDLElBQUkscUJBQXFCLFVBQVUsSUFBSSxHQUFHLHFCQUFxQix3QkFBd0Isc0JBQXNCLGNBQWMsY0FBYyxnQkFBZ0IsMkJBQTJCO0FBQUEsRUFDN0w7QUFBQSxFQUVRLGlCQUFpQix3QkFBc0U7QUFDOUYsVUFBTSxzQkFBMkM7QUFBQSxNQUNoRCxpQkFBaUIsdUJBQXVCO0FBQUEsSUFDekM7QUFFQSxLQUFDLHFCQUFxQixpQkFBaUIsRUFBRSxRQUFRLFNBQU87QUFDdkQsWUFBTSxRQUFRLFFBQVEsSUFBSSxHQUFHO0FBQzdCLFVBQUksT0FBTyxVQUFVLFVBQVU7QUFDOUIsNEJBQW9CLEdBQUcsSUFBSTtBQUFBLE1BQzVCO0FBQUEsSUFDRCxDQUFDO0FBRUQsV0FBTyxPQUFPLFFBQVEsS0FBSyxtQkFBbUI7QUFFOUMsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQWMsYUFBYSx3QkFBaUQsNkJBQTBELHNCQUE0QyxjQUE0QixnQkFBZ0Q7QUFDN1AsVUFBTSxTQUFTLFFBQWlCO0FBQUE7QUFBQSxNQUcvQixRQUFRLElBQXdCO0FBQUEsUUFDL0IsS0FBSyxvQkFBb0IsdUJBQXVCLGNBQWM7QUFBQTtBQUFBLFFBQzlELHVCQUF1QjtBQUFBO0FBQUEsUUFDdkIsdUJBQXVCLFNBQVMsS0FBSyxFQUFFLFFBQVEsUUFBUSxLQUFLLENBQUMsRUFBRTtBQUFBLFFBQy9ELDRCQUE0QixlQUFlLGtCQUFrQixLQUFLLEVBQUUsUUFBUSxRQUFRLEtBQUssQ0FBQyxFQUFFO0FBQUEsUUFDNUYsdUJBQXVCLHFCQUFxQixLQUFLLEVBQUUsUUFBUSxRQUFRLEtBQUssQ0FBQyxFQUFFO0FBQUEsUUFDM0UsdUJBQXVCLGlCQUFpQixLQUFLLEVBQUUsUUFBUSxRQUFRLEtBQUssQ0FBQyxFQUFFO0FBQUEsUUFDdkUsdUJBQXVCO0FBQUEsTUFDeEIsRUFBRSxJQUFJLFVBQVEsT0FBTyxTQUFTLE1BQU0sTUFBTSxFQUFFLFdBQVcsS0FBSyxDQUFDLElBQUksTUFBUyxDQUFDO0FBQUE7QUFBQSxNQUczRSxhQUFhLEtBQUs7QUFBQTtBQUFBLE1BR2xCLHFCQUFxQixXQUFXO0FBQUEsSUFDakMsQ0FBQztBQUdELGdDQUE0QixLQUFLO0FBQUEsRUFDbEM7QUFBQSxFQUVRLG9CQUFvQixNQUFzQjtBQUNqRCxRQUFJLFdBQVc7QUFDZCxZQUFNLE9BQU8sV0FBVyxJQUFJO0FBQzVCLFVBQUksTUFBTTtBQUNULDhCQUFzQixJQUFJO0FBQUEsTUFDM0I7QUFBQSxJQUNEO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLE1BQWMsY0FBYyxZQUF5Qix3QkFBaUQsc0JBQTZDLHNCQUE2QyxnQkFBaUMsT0FBd0M7QUFLeFEsUUFBSTtBQUNKLFFBQUk7QUFDSCxXQUFLLDBCQUEwQjtBQUMvQixpQ0FBMkIsTUFBTSxhQUFhLHVCQUF1QixhQUFhO0FBQ2xGLFdBQUsseUJBQXlCO0FBQzlCLFlBQU0sS0FBSyxxQkFBcUIsY0FBYyxFQUFFLE1BQU0seUJBQXlCLFFBQVEsQ0FBQztBQUFBLElBQ3pGLFNBQVMsT0FBTztBQUlmLFVBQUksTUFBTSxTQUFTLGNBQWM7QUFHaEMsYUFBSywwQkFBMEIsd0JBQXdCLGdCQUFnQixLQUFLO0FBRzVFLGNBQU07QUFBQSxNQUNQO0FBR0EsVUFBSTtBQUNKLFVBQUk7QUFDSCxpQkFBUyxNQUFNLGVBQWUsdUJBQXVCLGVBQWUsTUFBTTtBQUFBLE1BQzNFLFNBQVNBLFFBQU87QUFHZixZQUFJLENBQUMsU0FBUyxhQUFhQSxPQUFNLFNBQVMsZ0JBQWdCO0FBQ3pELGNBQUlBLE9BQU0sU0FBUyxTQUFTO0FBQzNCLGlCQUFLO0FBQUEsY0FDSixTQUFTLHVCQUF1QixnRUFBZ0UsZUFBZSxTQUFTO0FBQUEsY0FDeEgsU0FBUyw2QkFBNkIsZ0RBQWdEO0FBQUEsY0FDdEY7QUFBQSxZQUNEO0FBQUEsVUFDRDtBQUVBLGdCQUFNQTtBQUFBLFFBQ1A7QUFLQSxZQUFJO0FBQ0gscUJBQVcsdUJBQXVCLGFBQWE7QUFBQSxRQUNoRCxTQUFTQSxRQUFPO0FBQ2YscUJBQVcsS0FBSyw2Q0FBNkNBLE1BQUs7QUFFbEUsZ0JBQU1BO0FBQUEsUUFDUDtBQUVBLGVBQU8sS0FBSyxjQUFjLFlBQVksd0JBQXdCLHNCQUFzQixzQkFBc0IsZ0JBQWdCLEtBQUs7QUFBQSxNQUNoSTtBQUdBLFVBQUksdUJBQXVCLDZCQUE2QixDQUFDLHVCQUF1QixtQkFBbUIsT0FBTztBQUN6RyxjQUFNLE1BQU0scUdBQXFHLGVBQWUsU0FBUztBQUN6SSxtQkFBVyxNQUFNLEdBQUc7QUFDcEIsZUFBTyxRQUFRO0FBRWYsY0FBTSxJQUFJLE1BQU0sR0FBRztBQUFBLE1BQ3BCO0FBS0EsVUFBSSw2QkFBeUQ7QUFDN0QsVUFBSSxDQUFDLHVCQUF1QixLQUFLLFFBQVEsQ0FBQyx1QkFBdUIsS0FBSyxRQUFRO0FBQzdFLHFDQUE2QixXQUFXLE1BQU07QUFDN0MsZUFBSztBQUFBLFlBQ0osU0FBUyw0QkFBNEIseURBQXlELGVBQWUsU0FBUztBQUFBLFlBQ3RILFNBQVMsa0NBQWtDLGlEQUFpRDtBQUFBLFlBQzVGO0FBQUEsVUFDRDtBQUFBLFFBQ0QsR0FBRyxHQUFLO0FBQUEsTUFDVDtBQUVBLFlBQU0saUNBQWlDLGFBQWEsVUFBOEIsT0FBTyxXQUFXLFFBQVEsR0FBRyxFQUFFLG9CQUFvQixLQUFLLENBQUM7QUFDM0ksWUFBTSxzQ0FBc0MsYUFBYSxVQUFtQyxPQUFPLFdBQVcsYUFBYSxHQUFHLEVBQUUsb0JBQW9CLEtBQUssQ0FBQztBQUcxSixVQUFJLHVCQUF1QixLQUFLLFFBQVE7QUFDdkMsZUFBTyxxQkFBcUIsZUFBZSxZQUFZO0FBQ3RELGdCQUFNLHFCQUFxQixJQUFJLG1CQUFtQixzQkFBc0IsY0FBYztBQUN0RixnQkFBTSxrQkFBa0IsTUFBTSxvQ0FBb0MsbUJBQW1CO0FBQ3JGLGdCQUFNLG9CQUFvQixNQUFNLG9DQUFvQyxxQkFBcUIsRUFBRSxrQkFBa0IsTUFBTSwwQkFBMEIsS0FBSyxDQUFDO0FBQ25KLGdCQUFNLGNBQWMsTUFBTSxtQkFBbUIsZUFBZSxpQkFBaUIsaUJBQWlCO0FBQzlGLGtCQUFRLElBQUksV0FBVztBQUV2QixnQkFBTSxJQUFJLGNBQWM7QUFBQSxRQUN6QixDQUFDO0FBQUEsTUFDRjtBQUdBLFVBQUksV0FBVztBQUNkLGNBQU0sS0FBSyxnQ0FBZ0MsZ0NBQWdDLFVBQVU7QUFBQSxNQUN0RjtBQUdBLGlCQUFXLE1BQU0sb0NBQW9DO0FBQ3JELFlBQU0sK0JBQStCLE1BQU0sdUJBQXVCLE1BQU0sUUFBUSxHQUEwQjtBQUcxRyxhQUFPLFFBQVE7QUFHZixVQUFJLDRCQUE0QjtBQUMvQixxQkFBYSwwQkFBMEI7QUFBQSxNQUN4QztBQUVBLFlBQU0sSUFBSSxjQUFjLDhDQUE4QztBQUFBLElBQ3ZFO0FBR0EsUUFBSSx1QkFBdUIsS0FBSyxRQUFRO0FBQ3ZDLGNBQVEsSUFBSSxTQUFTLGlCQUFpQix5SEFBeUgsZUFBZSxTQUFTLENBQUM7QUFFeEwsWUFBTSxJQUFJLGNBQWMsZ0JBQWdCO0FBQUEsSUFDekM7QUFJQSxZQUFRLElBQUksWUFBWSxJQUFJLE9BQU8sUUFBUSxHQUFHO0FBRTlDLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSwwQkFBMEIsd0JBQWlELGdCQUFpQyxPQUFvQztBQUN2SixRQUFJLE1BQU0sU0FBUyxZQUFZLE1BQU0sU0FBUyxTQUFTO0FBQ3RELFlBQU0sY0FBYyxTQUFTLENBQUMsdUJBQXVCLGNBQWMsdUJBQXVCLGdCQUFnQixlQUFlLENBQUMsRUFBRSxJQUFJLFlBQVUsYUFBYSxJQUFJLEtBQUssTUFBTSxHQUFHLEVBQUUsSUFBSSxJQUFJLFNBQVMsdUJBQXVCLENBQUMsQ0FBQztBQUVyTixXQUFLO0FBQUEsUUFDSixTQUFTLHVCQUF1QixvQ0FBb0M7QUFBQSxRQUNwRSxTQUFTLDhDQUE4QywyRUFBMkUsZUFBZSxLQUFLLEdBQUcsWUFBWSxLQUFLLElBQUksQ0FBQztBQUFBLFFBQy9LO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFUSx5QkFBeUIsU0FBaUIsUUFBZ0IsZ0JBQXVDO0FBTXhHLFdBQU8sbUJBQW1CLHlCQUF5QjtBQUFBLE1BQ2xELE1BQU07QUFBQSxNQUNOLFNBQVMsQ0FBQyxTQUFTLEVBQUUsS0FBSyxTQUFTLFNBQVMsQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLFNBQVMsQ0FBQztBQUFBLE1BQ25GO0FBQUEsTUFDQTtBQUFBLElBQ0QsR0FBRyxjQUFjLEVBQUUsT0FBTztBQUFBLEVBQzNCO0FBQUEsRUFFQSxNQUFjLGdDQUFnQyxtQkFBdUMsWUFBd0M7QUFDNUgsUUFBSSxXQUFXO0FBQ2QsWUFBTSxZQUFZLE1BQU0sa0JBQWtCLGlCQUFpQjtBQUUzRCxpQkFBVyxNQUFNLHlEQUF5RCxTQUFTO0FBRW5GLFVBQUk7QUFDSCxTQUFDLE1BQU0sT0FBTyx5QkFBeUIsR0FBRyx5QkFBeUIsU0FBUztBQUFBLE1BQzdFLFNBQVMsT0FBTztBQUNmLG1CQUFXLE1BQU0sS0FBSztBQUFBLE1BQ3ZCO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFBQSxFQUVRLEtBQUssVUFBNEIsUUFBc0M7QUFDOUUsVUFBTSxhQUFhLFNBQVMsSUFBSSxXQUFXO0FBQzNDLFVBQU0sdUJBQXVCLFNBQVMsSUFBSSxxQkFBcUI7QUFFL0QsUUFBSSxXQUFXO0FBRWYsUUFBSSxRQUFRO0FBQ1gsVUFBSyxPQUF5QixZQUFZO0FBQ3pDLFlBQUksT0FBTyxTQUFTO0FBQ25CLHFCQUFXLE1BQU0sT0FBTyxPQUFPO0FBQUEsUUFDaEM7QUFBQSxNQUNELE9BQU87QUFDTixtQkFBVztBQUVYLFlBQUksT0FBTyxPQUFPO0FBQ2pCLHFCQUFXLE1BQU0sT0FBTyxLQUFLO0FBQUEsUUFDOUIsT0FBTztBQUNOLHFCQUFXLE1BQU0sa0JBQWtCLE9BQU8sU0FBUyxDQUFDLEVBQUU7QUFBQSxRQUN2RDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBRUEseUJBQXFCLEtBQUssUUFBUTtBQUFBLEVBQ25DO0FBQUE7QUFBQSxFQUlRLGNBQWdDO0FBR3ZDLFVBQU0sT0FBTyxLQUFLLGNBQWMscUJBQXFCLFFBQVEsSUFBSSxDQUFDO0FBVWxFLFFBQUksS0FBSyxRQUFRLENBQUMsS0FBSyxvQkFBb0I7QUFDMUMsWUFBTSxxQkFBcUIseUJBQXlCLEtBQUssT0FBTztBQUNoRSxVQUFJLG9CQUFvQjtBQUN2QixlQUFPLFFBQVEsTUFBTSx3QkFBd0Isa0JBQWtCO0FBQy9ELGFBQUsscUJBQXFCO0FBQUEsTUFDM0I7QUFBQSxJQUNEO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLGNBQWMsTUFBMEM7QUFHL0QsUUFBSSxLQUFLLFVBQVUsR0FBRztBQUNyQixXQUFLLFFBQVEsS0FBSztBQUNsQixXQUFLLElBQUksQ0FBQztBQUFBLElBQ1g7QUFHQSxRQUFJLENBQUMsS0FBSyxRQUFRLEdBQUc7QUFDcEIsWUFBTSxRQUFRLEtBQUssZ0JBQWdCLEtBQUssR0FBRyxLQUFLLElBQUk7QUFDcEQsV0FBSyxJQUFJO0FBQUEsSUFDVjtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxnQkFBZ0IsTUFBZ0IsY0FBa0M7QUFDekUsVUFBTSxvQkFBb0IsSUFBSTtBQUM5QixVQUFNLFNBQVMsS0FBSyxJQUFJLFNBQU87QUFDOUIsVUFBSSxnQkFBZ0IsT0FBTyxHQUFHO0FBRTlCLFVBQUksYUFBaUQ7QUFDckQsVUFBSSxjQUFjO0FBQ2pCLHFCQUFhLHdCQUF3QixhQUFhO0FBQ2xELHdCQUFnQixXQUFXO0FBQUEsTUFDNUI7QUFFQSxVQUFJLGVBQWU7QUFDbEIsd0JBQWdCLEtBQUssWUFBWSxtQkFBbUIsYUFBYTtBQUFBLE1BQ2xFO0FBRUEsWUFBTSxvQkFBb0IsaUJBQWlCLGVBQWUsaUJBQWlCO0FBRTNFLFlBQU0sbUJBQW1CLFNBQVMsaUJBQWlCO0FBQ25ELFVBQUksb0JBQWlFLENBQUMsZ0JBQWdCLGdCQUFnQixHQUFHO0FBQ3hHLGVBQU87QUFBQSxNQUNSO0FBRUEsVUFBSSxnQkFBZ0IsWUFBWTtBQUMvQixtQkFBVyxPQUFPO0FBRWxCLGVBQU8sS0FBSyxPQUFPLFVBQVU7QUFBQSxNQUM5QjtBQUVBLGFBQU87QUFBQSxJQUNSLENBQUM7QUFFRCxVQUFNLGtCQUFrQixhQUFhO0FBQ3JDLFVBQU0sZ0JBQWdCLFNBQVMsUUFBUSxVQUFRLFFBQVEsa0JBQWtCLEtBQUssWUFBWSxJQUFLLFFBQVEsRUFBRztBQUUxRyxXQUFPLFNBQVMsYUFBYTtBQUFBLEVBQzlCO0FBQUEsRUFFUSxZQUFZQyxNQUFhLE1BQXNCO0FBR3RELFFBQUksV0FBVztBQUNkLGFBQU8sTUFBTSxNQUFNLEdBQUc7QUFBQSxJQUN2QjtBQUdBLFdBQU8sS0FBSyxLQUFLLE1BQU0sR0FBRyxHQUFHLEdBQUk7QUFFakMsUUFBSSxXQUFXO0FBR2QsYUFBTyxRQUFRQSxNQUFLLElBQUk7QUFHeEIsYUFBTyxNQUFNLE1BQU0sR0FBRztBQUFBLElBQ3ZCO0FBRUEsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLE9BQU8sb0JBQW9EO0FBQ2xFLFVBQU0sV0FBVyxDQUFDLG1CQUFtQixJQUFJO0FBRXpDLFFBQUksT0FBTyxtQkFBbUIsU0FBUyxVQUFVO0FBQ2hELGVBQVMsS0FBSyxPQUFPLG1CQUFtQixJQUFJLENBQUM7QUFBQSxJQUM5QztBQUVBLFFBQUksT0FBTyxtQkFBbUIsV0FBVyxVQUFVO0FBQ2xELGVBQVMsS0FBSyxPQUFPLG1CQUFtQixNQUFNLENBQUM7QUFBQSxJQUNoRDtBQUVBLFdBQU8sU0FBUyxLQUFLLEdBQUc7QUFBQSxFQUN6QjtBQUFBO0FBR0Q7QUFHQSxNQUFNLE9BQU8sSUFBSSxTQUFTO0FBQzFCLEtBQUssS0FBSzsiLAogICJuYW1lcyI6IFsiZXJyb3IiLCAiY3dkIl0KfQo=
