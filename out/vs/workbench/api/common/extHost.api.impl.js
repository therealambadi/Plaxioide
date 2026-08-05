import { CancellationTokenSource } from "../../../base/common/cancellation.js";
import * as errors from "../../../base/common/errors.js";
import { Emitter, Event } from "../../../base/common/event.js";
import { combinedDisposable } from "../../../base/common/lifecycle.js";
import { Schemas, matchesScheme } from "../../../base/common/network.js";
import Severity from "../../../base/common/severity.js";
import { URI } from "../../../base/common/uri.js";
import { TextEditorCursorStyle } from "../../../editor/common/config/editorOptions.js";
import { score, targetsNotebooks } from "../../../editor/common/languageSelector.js";
import * as languageConfiguration from "../../../editor/common/languages/languageConfiguration.js";
import { OverviewRulerLane } from "../../../editor/common/model.js";
import { ExtensionError, ExtensionIdentifierSet } from "../../../platform/extensions/common/extensions.js";
import * as files from "../../../platform/files/common/files.js";
import { ILogService, ILoggerService, LogLevel } from "../../../platform/log/common/log.js";
import { getRemoteName } from "../../../platform/remote/common/remoteHosts.js";
import { TelemetryTrustedValue } from "../../../platform/telemetry/common/telemetryUtils.js";
import { EditSessionIdentityMatch } from "../../../platform/workspace/common/editSessions.js";
import { DebugConfigurationProviderTriggerKind } from "../../contrib/debug/common/debug.js";
import { UIKind } from "../../services/extensions/common/extensionHostProtocol.js";
import { checkProposedApiEnabled, isProposedApiEnabled } from "../../services/extensions/common/extensions.js";
import { ExcludeSettingOptions, TextSearchCompleteMessageType, TextSearchContext2, TextSearchMatch2 } from "../../services/search/common/searchExtTypes.js";
import { CandidatePortSource, ExtHostContext, MainContext } from "./extHost.protocol.js";
import { ExtHostRelatedInformation } from "./extHostAiRelatedInformation.js";
import { ExtHostApiCommands } from "./extHostApiCommands.js";
import { IExtHostApiDeprecationService } from "./extHostApiDeprecationService.js";
import { IExtHostAuthentication } from "./extHostAuthentication.js";
import { ExtHostBulkEdits } from "./extHostBulkEdits.js";
import { ExtHostChatAgents2 } from "./extHostChatAgents2.js";
import { ExtHostChatStatus } from "./extHostChatStatus.js";
import { ExtHostClipboard } from "./extHostClipboard.js";
import { ExtHostEditorInsets } from "./extHostCodeInsets.js";
import { ExtHostCodeMapper } from "./extHostCodeMapper.js";
import { IExtHostCommands } from "./extHostCommands.js";
import { createExtHostComments } from "./extHostComments.js";
import { IExtHostConfiguration } from "./extHostConfiguration.js";
import { ExtHostCustomEditors } from "./extHostCustomEditors.js";
import { IExtHostDebugService } from "./extHostDebugService.js";
import { IExtHostDecorations } from "./extHostDecorations.js";
import { ExtHostDiagnostics } from "./extHostDiagnostics.js";
import { ExtHostDialogs } from "./extHostDialogs.js";
import { ExtHostDocumentContentProvider } from "./extHostDocumentContentProviders.js";
import { ExtHostDocumentSaveParticipant } from "./extHostDocumentSaveParticipant.js";
import { ExtHostDocuments } from "./extHostDocuments.js";
import { IExtHostDocumentsAndEditors } from "./extHostDocumentsAndEditors.js";
import { IExtHostEditorTabs } from "./extHostEditorTabs.js";
import { ExtHostEmbeddings } from "./extHostEmbedding.js";
import { ExtHostAiEmbeddingVector } from "./extHostEmbeddingVector.js";
import { Extension, IExtHostExtensionService } from "./extHostExtensionService.js";
import { ExtHostFileSystem } from "./extHostFileSystem.js";
import { IExtHostConsumerFileSystem } from "./extHostFileSystemConsumer.js";
import { ExtHostFileSystemEventService } from "./extHostFileSystemEventService.js";
import { IExtHostFileSystemInfo } from "./extHostFileSystemInfo.js";
import { IExtHostInitDataService } from "./extHostInitDataService.js";
import { ExtHostInteractive } from "./extHostInteractive.js";
import { ExtHostLabelService } from "./extHostLabelService.js";
import { ExtHostLanguageFeatures } from "./extHostLanguageFeatures.js";
import { ExtHostLanguageModelTools } from "./extHostLanguageModelTools.js";
import { IExtHostLanguageModels } from "./extHostLanguageModels.js";
import { ExtHostLanguages } from "./extHostLanguages.js";
import { IExtHostLocalizationService } from "./extHostLocalizationService.js";
import { IExtHostManagedSockets } from "./extHostManagedSockets.js";
import { IExtHostMpcService } from "./extHostMcp.js";
import { ExtHostMessageService } from "./extHostMessageService.js";
import { ExtHostNotebookController } from "./extHostNotebook.js";
import { ExtHostNotebookDocumentSaveParticipant } from "./extHostNotebookDocumentSaveParticipant.js";
import { ExtHostNotebookDocuments } from "./extHostNotebookDocuments.js";
import { ExtHostNotebookEditors } from "./extHostNotebookEditors.js";
import { ExtHostNotebookKernels } from "./extHostNotebookKernels.js";
import { ExtHostNotebookRenderers } from "./extHostNotebookRenderers.js";
import { IExtHostOutputService } from "./extHostOutput.js";
import { ExtHostProfileContentHandlers } from "./extHostProfileContentHandler.js";
import { ExtHostProgress } from "./extHostProgress.js";
import { ExtHostQuickDiff } from "./extHostQuickDiff.js";
import { createExtHostQuickOpen } from "./extHostQuickOpen.js";
import { IExtHostRpcService } from "./extHostRpcService.js";
import { ExtHostSCM } from "./extHostSCM.js";
import { IExtHostSearch } from "./extHostSearch.js";
import { IExtHostSecretState } from "./extHostSecretState.js";
import { ExtHostShare } from "./extHostShare.js";
import { ExtHostSpeech } from "./extHostSpeech.js";
import { ExtHostStatusBar } from "./extHostStatusBar.js";
import { IExtHostStorage } from "./extHostStorage.js";
import { IExtensionStoragePaths } from "./extHostStoragePaths.js";
import { IExtHostTask } from "./extHostTask.js";
import { ExtHostTelemetryLogger, IExtHostTelemetry, isNewAppInstall } from "./extHostTelemetry.js";
import { IExtHostTerminalService } from "./extHostTerminalService.js";
import { IExtHostTerminalShellIntegration } from "./extHostTerminalShellIntegration.js";
import { IExtHostTesting } from "./extHostTesting.js";
import { ExtHostEditors } from "./extHostTextEditors.js";
import { ExtHostTheming } from "./extHostTheming.js";
import { ExtHostTimeline } from "./extHostTimeline.js";
import { ExtHostTreeViews } from "./extHostTreeViews.js";
import { IExtHostTunnelService } from "./extHostTunnelService.js";
import * as typeConverters from "./extHostTypeConverters.js";
import * as extHostTypes from "./extHostTypes.js";
import { ExtHostUriOpeners } from "./extHostUriOpener.js";
import { IURITransformerService } from "./extHostUriTransformerService.js";
import { ExtHostUrls } from "./extHostUrls.js";
import { ExtHostWebviews } from "./extHostWebview.js";
import { ExtHostWebviewPanels } from "./extHostWebviewPanels.js";
import { ExtHostWebviewViews } from "./extHostWebviewView.js";
import { IExtHostWindow } from "./extHostWindow.js";
import { IExtHostWorkspace } from "./extHostWorkspace.js";
function createApiFactoryAndRegisterActors(accessor) {
  const initData = accessor.get(IExtHostInitDataService);
  const extHostFileSystemInfo = accessor.get(IExtHostFileSystemInfo);
  const extHostConsumerFileSystem = accessor.get(IExtHostConsumerFileSystem);
  const extensionService = accessor.get(IExtHostExtensionService);
  const extHostWorkspace = accessor.get(IExtHostWorkspace);
  const extHostTelemetry = accessor.get(IExtHostTelemetry);
  const extHostConfiguration = accessor.get(IExtHostConfiguration);
  const uriTransformer = accessor.get(IURITransformerService);
  const rpcProtocol = accessor.get(IExtHostRpcService);
  const extHostStorage = accessor.get(IExtHostStorage);
  const extensionStoragePaths = accessor.get(IExtensionStoragePaths);
  const extHostLoggerService = accessor.get(ILoggerService);
  const extHostLogService = accessor.get(ILogService);
  const extHostTunnelService = accessor.get(IExtHostTunnelService);
  const extHostApiDeprecation = accessor.get(IExtHostApiDeprecationService);
  const extHostWindow = accessor.get(IExtHostWindow);
  const extHostSecretState = accessor.get(IExtHostSecretState);
  const extHostEditorTabs = accessor.get(IExtHostEditorTabs);
  const extHostManagedSockets = accessor.get(IExtHostManagedSockets);
  const extHostAuthentication = accessor.get(IExtHostAuthentication);
  const extHostLanguageModels = accessor.get(IExtHostLanguageModels);
  const extHostMcp = accessor.get(IExtHostMpcService);
  rpcProtocol.set(ExtHostContext.ExtHostFileSystemInfo, extHostFileSystemInfo);
  rpcProtocol.set(ExtHostContext.ExtHostLogLevelServiceShape, extHostLoggerService);
  rpcProtocol.set(ExtHostContext.ExtHostWorkspace, extHostWorkspace);
  rpcProtocol.set(ExtHostContext.ExtHostConfiguration, extHostConfiguration);
  rpcProtocol.set(ExtHostContext.ExtHostExtensionService, extensionService);
  rpcProtocol.set(ExtHostContext.ExtHostStorage, extHostStorage);
  rpcProtocol.set(ExtHostContext.ExtHostTunnelService, extHostTunnelService);
  rpcProtocol.set(ExtHostContext.ExtHostWindow, extHostWindow);
  rpcProtocol.set(ExtHostContext.ExtHostSecretState, extHostSecretState);
  rpcProtocol.set(ExtHostContext.ExtHostTelemetry, extHostTelemetry);
  rpcProtocol.set(ExtHostContext.ExtHostEditorTabs, extHostEditorTabs);
  rpcProtocol.set(ExtHostContext.ExtHostManagedSockets, extHostManagedSockets);
  rpcProtocol.set(ExtHostContext.ExtHostAuthentication, extHostAuthentication);
  rpcProtocol.set(ExtHostContext.ExtHostChatProvider, extHostLanguageModels);
  const extHostDecorations = rpcProtocol.set(ExtHostContext.ExtHostDecorations, accessor.get(IExtHostDecorations));
  const extHostDocumentsAndEditors = rpcProtocol.set(ExtHostContext.ExtHostDocumentsAndEditors, accessor.get(IExtHostDocumentsAndEditors));
  const extHostCommands = rpcProtocol.set(ExtHostContext.ExtHostCommands, accessor.get(IExtHostCommands));
  const extHostTerminalService = rpcProtocol.set(ExtHostContext.ExtHostTerminalService, accessor.get(IExtHostTerminalService));
  const extHostTerminalShellIntegration = rpcProtocol.set(ExtHostContext.ExtHostTerminalShellIntegration, accessor.get(IExtHostTerminalShellIntegration));
  const extHostDebugService = rpcProtocol.set(ExtHostContext.ExtHostDebugService, accessor.get(IExtHostDebugService));
  const extHostSearch = rpcProtocol.set(ExtHostContext.ExtHostSearch, accessor.get(IExtHostSearch));
  const extHostTask = rpcProtocol.set(ExtHostContext.ExtHostTask, accessor.get(IExtHostTask));
  const extHostOutputService = rpcProtocol.set(ExtHostContext.ExtHostOutputService, accessor.get(IExtHostOutputService));
  const extHostLocalization = rpcProtocol.set(ExtHostContext.ExtHostLocalization, accessor.get(IExtHostLocalizationService));
  const extHostUrls = rpcProtocol.set(ExtHostContext.ExtHostUrls, new ExtHostUrls(rpcProtocol));
  const extHostDocuments = rpcProtocol.set(ExtHostContext.ExtHostDocuments, new ExtHostDocuments(rpcProtocol, extHostDocumentsAndEditors));
  const extHostDocumentContentProviders = rpcProtocol.set(ExtHostContext.ExtHostDocumentContentProviders, new ExtHostDocumentContentProvider(rpcProtocol, extHostDocumentsAndEditors, extHostLogService));
  const extHostDocumentSaveParticipant = rpcProtocol.set(ExtHostContext.ExtHostDocumentSaveParticipant, new ExtHostDocumentSaveParticipant(extHostLogService, extHostDocuments, rpcProtocol.getProxy(MainContext.MainThreadBulkEdits)));
  const extHostNotebook = rpcProtocol.set(ExtHostContext.ExtHostNotebook, new ExtHostNotebookController(rpcProtocol, extHostCommands, extHostDocumentsAndEditors, extHostDocuments, extHostConsumerFileSystem, extHostSearch, extHostLogService));
  const extHostNotebookDocuments = rpcProtocol.set(ExtHostContext.ExtHostNotebookDocuments, new ExtHostNotebookDocuments(extHostNotebook));
  const extHostNotebookEditors = rpcProtocol.set(ExtHostContext.ExtHostNotebookEditors, new ExtHostNotebookEditors(extHostLogService, extHostNotebook));
  const extHostNotebookKernels = rpcProtocol.set(ExtHostContext.ExtHostNotebookKernels, new ExtHostNotebookKernels(rpcProtocol, initData, extHostNotebook, extHostCommands, extHostLogService));
  const extHostNotebookRenderers = rpcProtocol.set(ExtHostContext.ExtHostNotebookRenderers, new ExtHostNotebookRenderers(rpcProtocol, extHostNotebook));
  const extHostNotebookDocumentSaveParticipant = rpcProtocol.set(ExtHostContext.ExtHostNotebookDocumentSaveParticipant, new ExtHostNotebookDocumentSaveParticipant(extHostLogService, extHostNotebook, rpcProtocol.getProxy(MainContext.MainThreadBulkEdits)));
  const extHostEditors = rpcProtocol.set(ExtHostContext.ExtHostEditors, new ExtHostEditors(rpcProtocol, extHostDocumentsAndEditors));
  const extHostTreeViews = rpcProtocol.set(ExtHostContext.ExtHostTreeViews, new ExtHostTreeViews(rpcProtocol.getProxy(MainContext.MainThreadTreeViews), extHostCommands, extHostLogService));
  const extHostEditorInsets = rpcProtocol.set(ExtHostContext.ExtHostEditorInsets, new ExtHostEditorInsets(rpcProtocol.getProxy(MainContext.MainThreadEditorInsets), extHostEditors, initData.remote));
  const extHostDiagnostics = rpcProtocol.set(ExtHostContext.ExtHostDiagnostics, new ExtHostDiagnostics(rpcProtocol, extHostLogService, extHostFileSystemInfo, extHostDocumentsAndEditors));
  const extHostLanguages = rpcProtocol.set(ExtHostContext.ExtHostLanguages, new ExtHostLanguages(rpcProtocol, extHostDocuments, extHostCommands.converter, uriTransformer));
  const extHostLanguageFeatures = rpcProtocol.set(ExtHostContext.ExtHostLanguageFeatures, new ExtHostLanguageFeatures(rpcProtocol, uriTransformer, extHostDocuments, extHostCommands, extHostDiagnostics, extHostLogService, extHostApiDeprecation, extHostTelemetry));
  const extHostCodeMapper = rpcProtocol.set(ExtHostContext.ExtHostCodeMapper, new ExtHostCodeMapper(rpcProtocol));
  const extHostFileSystem = rpcProtocol.set(ExtHostContext.ExtHostFileSystem, new ExtHostFileSystem(rpcProtocol, extHostLanguageFeatures));
  const extHostFileSystemEvent = rpcProtocol.set(ExtHostContext.ExtHostFileSystemEventService, new ExtHostFileSystemEventService(rpcProtocol, extHostLogService, extHostDocumentsAndEditors));
  const extHostQuickOpen = rpcProtocol.set(ExtHostContext.ExtHostQuickOpen, createExtHostQuickOpen(rpcProtocol, extHostWorkspace, extHostCommands));
  const extHostSCM = rpcProtocol.set(ExtHostContext.ExtHostSCM, new ExtHostSCM(rpcProtocol, extHostCommands, extHostDocuments, extHostLogService));
  const extHostQuickDiff = rpcProtocol.set(ExtHostContext.ExtHostQuickDiff, new ExtHostQuickDiff(rpcProtocol, uriTransformer));
  const extHostShare = rpcProtocol.set(ExtHostContext.ExtHostShare, new ExtHostShare(rpcProtocol, uriTransformer));
  const extHostComment = rpcProtocol.set(ExtHostContext.ExtHostComments, createExtHostComments(rpcProtocol, extHostCommands, extHostDocuments));
  const extHostProgress = rpcProtocol.set(ExtHostContext.ExtHostProgress, new ExtHostProgress(rpcProtocol.getProxy(MainContext.MainThreadProgress)));
  const extHostLabelService = rpcProtocol.set(ExtHostContext.ExtHostLabelService, new ExtHostLabelService(rpcProtocol));
  const extHostTheming = rpcProtocol.set(ExtHostContext.ExtHostTheming, new ExtHostTheming(rpcProtocol));
  const extHostTimeline = rpcProtocol.set(ExtHostContext.ExtHostTimeline, new ExtHostTimeline(rpcProtocol, extHostCommands));
  const extHostWebviews = rpcProtocol.set(ExtHostContext.ExtHostWebviews, new ExtHostWebviews(rpcProtocol, initData.remote, extHostWorkspace, extHostLogService, extHostApiDeprecation));
  const extHostWebviewPanels = rpcProtocol.set(ExtHostContext.ExtHostWebviewPanels, new ExtHostWebviewPanels(rpcProtocol, extHostWebviews, extHostWorkspace));
  const extHostCustomEditors = rpcProtocol.set(ExtHostContext.ExtHostCustomEditors, new ExtHostCustomEditors(rpcProtocol, extHostDocuments, extensionStoragePaths, extHostWebviews, extHostWebviewPanels));
  const extHostWebviewViews = rpcProtocol.set(ExtHostContext.ExtHostWebviewViews, new ExtHostWebviewViews(rpcProtocol, extHostWebviews));
  const extHostTesting = rpcProtocol.set(ExtHostContext.ExtHostTesting, accessor.get(IExtHostTesting));
  const extHostUriOpeners = rpcProtocol.set(ExtHostContext.ExtHostUriOpeners, new ExtHostUriOpeners(rpcProtocol));
  const extHostProfileContentHandlers = rpcProtocol.set(ExtHostContext.ExtHostProfileContentHandlers, new ExtHostProfileContentHandlers(rpcProtocol));
  rpcProtocol.set(ExtHostContext.ExtHostInteractive, new ExtHostInteractive(rpcProtocol, extHostNotebook, extHostDocumentsAndEditors, extHostCommands, extHostLogService));
  const extHostLanguageModelTools = rpcProtocol.set(ExtHostContext.ExtHostLanguageModelTools, new ExtHostLanguageModelTools(rpcProtocol, extHostLanguageModels));
  const extHostChatAgents2 = rpcProtocol.set(ExtHostContext.ExtHostChatAgents2, new ExtHostChatAgents2(rpcProtocol, extHostLogService, extHostCommands, extHostDocuments, extHostLanguageModels, extHostDiagnostics, extHostLanguageModelTools));
  const extHostAiRelatedInformation = rpcProtocol.set(ExtHostContext.ExtHostAiRelatedInformation, new ExtHostRelatedInformation(rpcProtocol));
  const extHostAiEmbeddingVector = rpcProtocol.set(ExtHostContext.ExtHostAiEmbeddingVector, new ExtHostAiEmbeddingVector(rpcProtocol));
  const extHostStatusBar = rpcProtocol.set(ExtHostContext.ExtHostStatusBar, new ExtHostStatusBar(rpcProtocol, extHostCommands.converter));
  const extHostSpeech = rpcProtocol.set(ExtHostContext.ExtHostSpeech, new ExtHostSpeech(rpcProtocol));
  const extHostEmbeddings = rpcProtocol.set(ExtHostContext.ExtHostEmbeddings, new ExtHostEmbeddings(rpcProtocol));
  rpcProtocol.set(ExtHostContext.ExtHostMcp, accessor.get(IExtHostMpcService));
  const expected = Object.values(ExtHostContext);
  rpcProtocol.assertRegistered(expected);
  const extHostBulkEdits = new ExtHostBulkEdits(rpcProtocol, extHostDocumentsAndEditors);
  const extHostClipboard = new ExtHostClipboard(rpcProtocol);
  const extHostMessageService = new ExtHostMessageService(rpcProtocol, extHostLogService);
  const extHostDialogs = new ExtHostDialogs(rpcProtocol);
  const extHostChatStatus = new ExtHostChatStatus(rpcProtocol);
  ExtHostApiCommands.register(extHostCommands);
  return function(extension, extensionInfo, configProvider) {
    function _asExtensionEvent(actual) {
      return (listener, thisArgs, disposables) => {
        const handle = actual((e) => {
          try {
            listener.call(thisArgs, e);
          } catch (err) {
            errors.onUnexpectedExternalError(new ExtensionError(extension.identifier, err, "FAILED to handle event"));
          }
        });
        disposables?.push(handle);
        return handle;
      };
    }
    const checkSelector = function() {
      let done = !extension.isUnderDevelopment;
      function informOnce() {
        if (!done) {
          extHostLogService.info(`Extension '${extension.identifier.value}' uses a document selector without scheme. Learn more about this: https://go.microsoft.com/fwlink/?linkid=872305`);
          done = true;
        }
      }
      return function perform(selector) {
        if (Array.isArray(selector)) {
          selector.forEach(perform);
        } else if (typeof selector === "string") {
          informOnce();
        } else {
          const filter = selector;
          if (typeof filter.scheme === "undefined") {
            informOnce();
          }
          if (typeof filter.exclusive === "boolean") {
            checkProposedApiEnabled(extension, "documentFiltersExclusive");
          }
        }
        return selector;
      };
    }();
    const authentication = {
      getSession(providerId, scopes, options) {
        if (typeof options?.forceNewSession === "object" && options.forceNewSession.learnMore || typeof options?.createIfNone === "object" && options.createIfNone.learnMore) {
          checkProposedApiEnabled(extension, "authLearnMore");
        }
        return extHostAuthentication.getSession(extension, providerId, scopes, options);
      },
      getAccounts(providerId) {
        return extHostAuthentication.getAccounts(providerId);
      },
      // TODO: remove this after GHPR and Codespaces move off of it
      async hasSession(providerId, scopes) {
        checkProposedApiEnabled(extension, "authSession");
        return !!await extHostAuthentication.getSession(extension, providerId, scopes, { silent: true });
      },
      get onDidChangeSessions() {
        return _asExtensionEvent(extHostAuthentication.getExtensionScopedSessionsEvent(extension.identifier.value));
      },
      registerAuthenticationProvider(id, label, provider, options) {
        return extHostAuthentication.registerAuthenticationProvider(id, label, provider, options);
      }
    };
    const commands = {
      registerCommand(id, command, thisArgs) {
        return extHostCommands.registerCommand(true, id, command, thisArgs, void 0, extension);
      },
      registerTextEditorCommand(id, callback, thisArg) {
        return extHostCommands.registerCommand(true, id, (...args) => {
          const activeTextEditor = extHostEditors.getActiveTextEditor();
          if (!activeTextEditor) {
            extHostLogService.warn("Cannot execute " + id + " because there is no active text editor.");
            return void 0;
          }
          return activeTextEditor.edit((edit) => {
            callback.apply(thisArg, [activeTextEditor, edit, ...args]);
          }).then((result) => {
            if (!result) {
              extHostLogService.warn("Edits from command " + id + " were not applied.");
            }
          }, (err) => {
            extHostLogService.warn("An error occurred while running command " + id, err);
          });
        }, void 0, void 0, extension);
      },
      registerDiffInformationCommand: (id, callback, thisArg) => {
        checkProposedApiEnabled(extension, "diffCommand");
        return extHostCommands.registerCommand(true, id, async (...args) => {
          const activeTextEditor = extHostDocumentsAndEditors.activeEditor(true);
          if (!activeTextEditor) {
            extHostLogService.warn("Cannot execute " + id + " because there is no active text editor.");
            return void 0;
          }
          const diff = await extHostEditors.getDiffInformation(activeTextEditor.id);
          callback.apply(thisArg, [diff, ...args]);
        }, void 0, void 0, extension);
      },
      executeCommand(id, ...args) {
        return extHostCommands.executeCommand(id, ...args);
      },
      getCommands(filterInternal = false) {
        return extHostCommands.getCommands(filterInternal);
      }
    };
    const env = {
      get machineId() {
        return initData.telemetryInfo.machineId;
      },
      get sessionId() {
        return initData.telemetryInfo.sessionId;
      },
      get language() {
        return initData.environment.appLanguage;
      },
      get appName() {
        return initData.environment.appName;
      },
      get appRoot() {
        return initData.environment.appRoot?.fsPath ?? "";
      },
      get appHost() {
        return initData.environment.appHost;
      },
      get uriScheme() {
        return initData.environment.appUriScheme;
      },
      get clipboard() {
        return extHostClipboard.value;
      },
      get shell() {
        return extHostTerminalService.getDefaultShell(false);
      },
      get onDidChangeShell() {
        return _asExtensionEvent(extHostTerminalService.onDidChangeShell);
      },
      get isTelemetryEnabled() {
        return extHostTelemetry.getTelemetryConfiguration();
      },
      get onDidChangeTelemetryEnabled() {
        return _asExtensionEvent(extHostTelemetry.onDidChangeTelemetryEnabled);
      },
      get telemetryConfiguration() {
        checkProposedApiEnabled(extension, "telemetry");
        return extHostTelemetry.getTelemetryDetails();
      },
      get onDidChangeTelemetryConfiguration() {
        checkProposedApiEnabled(extension, "telemetry");
        return _asExtensionEvent(extHostTelemetry.onDidChangeTelemetryConfiguration);
      },
      get isNewAppInstall() {
        return isNewAppInstall(initData.telemetryInfo.firstSessionDate);
      },
      createTelemetryLogger(sender, options) {
        ExtHostTelemetryLogger.validateSender(sender);
        return extHostTelemetry.instantiateLogger(extension, sender, options);
      },
      openExternal(uri, options) {
        return extHostWindow.openUri(uri, {
          allowTunneling: !!initData.remote.authority,
          allowContributedOpeners: options?.allowContributedOpeners
        });
      },
      async asExternalUri(uri) {
        if (uri.scheme === initData.environment.appUriScheme) {
          return extHostUrls.createAppUri(uri);
        }
        try {
          return await extHostWindow.asExternalUri(uri, { allowTunneling: !!initData.remote.authority });
        } catch (err) {
          if (matchesScheme(uri, Schemas.http) || matchesScheme(uri, Schemas.https)) {
            return uri;
          }
          throw err;
        }
      },
      get remoteName() {
        return getRemoteName(initData.remote.authority);
      },
      get remoteAuthority() {
        checkProposedApiEnabled(extension, "resolvers");
        return initData.remote.authority;
      },
      get uiKind() {
        return initData.uiKind;
      },
      get logLevel() {
        return extHostLogService.getLevel();
      },
      get onDidChangeLogLevel() {
        return _asExtensionEvent(extHostLogService.onDidChangeLogLevel);
      },
      get appQuality() {
        checkProposedApiEnabled(extension, "resolvers");
        return initData.quality;
      },
      get appCommit() {
        checkProposedApiEnabled(extension, "resolvers");
        return initData.commit;
      }
    };
    if (!initData.environment.extensionTestsLocationURI) {
      Object.freeze(env);
    }
    const tests = {
      createTestController(provider, label, refreshHandler) {
        return extHostTesting.createTestController(extension, provider, label, refreshHandler);
      },
      createTestObserver() {
        checkProposedApiEnabled(extension, "testObserver");
        return extHostTesting.createTestObserver();
      },
      runTests(provider) {
        checkProposedApiEnabled(extension, "testObserver");
        return extHostTesting.runTests(provider);
      },
      registerTestFollowupProvider(provider) {
        checkProposedApiEnabled(extension, "testObserver");
        return extHostTesting.registerTestFollowupProvider(provider);
      },
      get onDidChangeTestResults() {
        checkProposedApiEnabled(extension, "testObserver");
        return _asExtensionEvent(extHostTesting.onResultsChanged);
      },
      get testResults() {
        checkProposedApiEnabled(extension, "testObserver");
        return extHostTesting.results;
      }
    };
    const extensionKind = initData.remote.isRemote ? extHostTypes.ExtensionKind.Workspace : extHostTypes.ExtensionKind.UI;
    const extensions = {
      getExtension(extensionId, includeFromDifferentExtensionHosts) {
        if (!isProposedApiEnabled(extension, "extensionsAny")) {
          includeFromDifferentExtensionHosts = false;
        }
        const mine = extensionInfo.mine.getExtensionDescription(extensionId);
        if (mine) {
          return new Extension(extensionService, extension.identifier, mine, extensionKind, false);
        }
        if (includeFromDifferentExtensionHosts) {
          const foreign = extensionInfo.all.getExtensionDescription(extensionId);
          if (foreign) {
            return new Extension(extensionService, extension.identifier, foreign, extensionKind, true);
          }
        }
        return void 0;
      },
      get all() {
        const result = [];
        for (const desc of extensionInfo.mine.getAllExtensionDescriptions()) {
          result.push(new Extension(extensionService, extension.identifier, desc, extensionKind, false));
        }
        return result;
      },
      get allAcrossExtensionHosts() {
        checkProposedApiEnabled(extension, "extensionsAny");
        const local = new ExtensionIdentifierSet(extensionInfo.mine.getAllExtensionDescriptions().map((desc) => desc.identifier));
        const result = [];
        for (const desc of extensionInfo.all.getAllExtensionDescriptions()) {
          const isFromDifferentExtensionHost = !local.has(desc.identifier);
          result.push(new Extension(extensionService, extension.identifier, desc, extensionKind, isFromDifferentExtensionHost));
        }
        return result;
      },
      get onDidChange() {
        if (isProposedApiEnabled(extension, "extensionsAny")) {
          return _asExtensionEvent(Event.any(extensionInfo.mine.onDidChange, extensionInfo.all.onDidChange));
        }
        return _asExtensionEvent(extensionInfo.mine.onDidChange);
      }
    };
    const languages = {
      createDiagnosticCollection(name) {
        return extHostDiagnostics.createDiagnosticCollection(extension.identifier, name);
      },
      get onDidChangeDiagnostics() {
        return _asExtensionEvent(extHostDiagnostics.onDidChangeDiagnostics);
      },
      getDiagnostics: (resource) => {
        return extHostDiagnostics.getDiagnostics(resource);
      },
      getLanguages() {
        return extHostLanguages.getLanguages();
      },
      setTextDocumentLanguage(document, languageId) {
        return extHostLanguages.changeLanguage(document.uri, languageId);
      },
      match(selector, document) {
        const interalSelector = typeConverters.LanguageSelector.from(selector);
        let notebook;
        if (targetsNotebooks(interalSelector)) {
          notebook = extHostNotebook.notebookDocuments.find((value) => value.apiNotebook.getCells().find((c) => c.document === document))?.apiNotebook;
        }
        return score(interalSelector, document.uri, document.languageId, true, notebook?.uri, notebook?.notebookType);
      },
      registerCodeActionsProvider(selector, provider, metadata) {
        return extHostLanguageFeatures.registerCodeActionProvider(extension, checkSelector(selector), provider, metadata);
      },
      registerDocumentPasteEditProvider(selector, provider, metadata) {
        return extHostLanguageFeatures.registerDocumentPasteEditProvider(extension, checkSelector(selector), provider, metadata);
      },
      registerCodeLensProvider(selector, provider) {
        return extHostLanguageFeatures.registerCodeLensProvider(extension, checkSelector(selector), provider);
      },
      registerDefinitionProvider(selector, provider) {
        return extHostLanguageFeatures.registerDefinitionProvider(extension, checkSelector(selector), provider);
      },
      registerDeclarationProvider(selector, provider) {
        return extHostLanguageFeatures.registerDeclarationProvider(extension, checkSelector(selector), provider);
      },
      registerImplementationProvider(selector, provider) {
        return extHostLanguageFeatures.registerImplementationProvider(extension, checkSelector(selector), provider);
      },
      registerTypeDefinitionProvider(selector, provider) {
        return extHostLanguageFeatures.registerTypeDefinitionProvider(extension, checkSelector(selector), provider);
      },
      registerHoverProvider(selector, provider) {
        return extHostLanguageFeatures.registerHoverProvider(extension, checkSelector(selector), provider, extension.identifier);
      },
      registerEvaluatableExpressionProvider(selector, provider) {
        return extHostLanguageFeatures.registerEvaluatableExpressionProvider(extension, checkSelector(selector), provider, extension.identifier);
      },
      registerInlineValuesProvider(selector, provider) {
        return extHostLanguageFeatures.registerInlineValuesProvider(extension, checkSelector(selector), provider, extension.identifier);
      },
      registerDocumentHighlightProvider(selector, provider) {
        return extHostLanguageFeatures.registerDocumentHighlightProvider(extension, checkSelector(selector), provider);
      },
      registerMultiDocumentHighlightProvider(selector, provider) {
        return extHostLanguageFeatures.registerMultiDocumentHighlightProvider(extension, checkSelector(selector), provider);
      },
      registerLinkedEditingRangeProvider(selector, provider) {
        return extHostLanguageFeatures.registerLinkedEditingRangeProvider(extension, checkSelector(selector), provider);
      },
      registerReferenceProvider(selector, provider) {
        return extHostLanguageFeatures.registerReferenceProvider(extension, checkSelector(selector), provider);
      },
      registerRenameProvider(selector, provider) {
        return extHostLanguageFeatures.registerRenameProvider(extension, checkSelector(selector), provider);
      },
      registerNewSymbolNamesProvider(selector, provider) {
        checkProposedApiEnabled(extension, "newSymbolNamesProvider");
        return extHostLanguageFeatures.registerNewSymbolNamesProvider(extension, checkSelector(selector), provider);
      },
      registerDocumentSymbolProvider(selector, provider, metadata) {
        return extHostLanguageFeatures.registerDocumentSymbolProvider(extension, checkSelector(selector), provider, metadata);
      },
      registerWorkspaceSymbolProvider(provider) {
        return extHostLanguageFeatures.registerWorkspaceSymbolProvider(extension, provider);
      },
      registerDocumentFormattingEditProvider(selector, provider) {
        return extHostLanguageFeatures.registerDocumentFormattingEditProvider(extension, checkSelector(selector), provider);
      },
      registerDocumentRangeFormattingEditProvider(selector, provider) {
        return extHostLanguageFeatures.registerDocumentRangeFormattingEditProvider(extension, checkSelector(selector), provider);
      },
      registerOnTypeFormattingEditProvider(selector, provider, firstTriggerCharacter, ...moreTriggerCharacters) {
        return extHostLanguageFeatures.registerOnTypeFormattingEditProvider(extension, checkSelector(selector), provider, [firstTriggerCharacter].concat(moreTriggerCharacters));
      },
      registerDocumentSemanticTokensProvider(selector, provider, legend) {
        return extHostLanguageFeatures.registerDocumentSemanticTokensProvider(extension, checkSelector(selector), provider, legend);
      },
      registerDocumentRangeSemanticTokensProvider(selector, provider, legend) {
        return extHostLanguageFeatures.registerDocumentRangeSemanticTokensProvider(extension, checkSelector(selector), provider, legend);
      },
      registerSignatureHelpProvider(selector, provider, firstItem, ...remaining) {
        if (typeof firstItem === "object") {
          return extHostLanguageFeatures.registerSignatureHelpProvider(extension, checkSelector(selector), provider, firstItem);
        }
        return extHostLanguageFeatures.registerSignatureHelpProvider(extension, checkSelector(selector), provider, typeof firstItem === "undefined" ? [] : [firstItem, ...remaining]);
      },
      registerCompletionItemProvider(selector, provider, ...triggerCharacters) {
        return extHostLanguageFeatures.registerCompletionItemProvider(extension, checkSelector(selector), provider, triggerCharacters);
      },
      registerInlineCompletionItemProvider(selector, provider, metadata) {
        if (provider.handleDidShowCompletionItem) {
          checkProposedApiEnabled(extension, "inlineCompletionsAdditions");
        }
        if (provider.handleDidPartiallyAcceptCompletionItem) {
          checkProposedApiEnabled(extension, "inlineCompletionsAdditions");
        }
        if (metadata) {
          checkProposedApiEnabled(extension, "inlineCompletionsAdditions");
        }
        return extHostLanguageFeatures.registerInlineCompletionsProvider(extension, checkSelector(selector), provider, metadata);
      },
      registerInlineEditProvider(selector, provider) {
        checkProposedApiEnabled(extension, "inlineEdit");
        return extHostLanguageFeatures.registerInlineEditProvider(extension, checkSelector(selector), provider);
      },
      registerDocumentLinkProvider(selector, provider) {
        return extHostLanguageFeatures.registerDocumentLinkProvider(extension, checkSelector(selector), provider);
      },
      registerColorProvider(selector, provider) {
        return extHostLanguageFeatures.registerColorProvider(extension, checkSelector(selector), provider);
      },
      registerFoldingRangeProvider(selector, provider) {
        return extHostLanguageFeatures.registerFoldingRangeProvider(extension, checkSelector(selector), provider);
      },
      registerSelectionRangeProvider(selector, provider) {
        return extHostLanguageFeatures.registerSelectionRangeProvider(extension, selector, provider);
      },
      registerCallHierarchyProvider(selector, provider) {
        return extHostLanguageFeatures.registerCallHierarchyProvider(extension, selector, provider);
      },
      registerTypeHierarchyProvider(selector, provider) {
        return extHostLanguageFeatures.registerTypeHierarchyProvider(extension, selector, provider);
      },
      setLanguageConfiguration: (language, configuration) => {
        return extHostLanguageFeatures.setLanguageConfiguration(extension, language, configuration);
      },
      getTokenInformationAtPosition(doc, pos) {
        checkProposedApiEnabled(extension, "tokenInformation");
        return extHostLanguages.tokenAtPosition(doc, pos);
      },
      registerInlayHintsProvider(selector, provider) {
        return extHostLanguageFeatures.registerInlayHintsProvider(extension, selector, provider);
      },
      createLanguageStatusItem(id, selector) {
        return extHostLanguages.createLanguageStatusItem(extension, id, selector);
      },
      registerDocumentDropEditProvider(selector, provider, metadata) {
        return extHostLanguageFeatures.registerDocumentOnDropEditProvider(extension, selector, provider, metadata);
      }
    };
    const window = {
      get activeTextEditor() {
        return extHostEditors.getActiveTextEditor();
      },
      get visibleTextEditors() {
        return extHostEditors.getVisibleTextEditors();
      },
      get activeTerminal() {
        return extHostTerminalService.activeTerminal;
      },
      get terminals() {
        return extHostTerminalService.terminals;
      },
      async showTextDocument(documentOrUri, columnOrOptions, preserveFocus) {
        if (URI.isUri(documentOrUri) && documentOrUri.scheme === Schemas.vscodeRemote && !documentOrUri.authority) {
          extHostApiDeprecation.report("workspace.showTextDocument", extension, `A URI of 'vscode-remote' scheme requires an authority.`);
        }
        const document = await (URI.isUri(documentOrUri) ? Promise.resolve(workspace.openTextDocument(documentOrUri)) : Promise.resolve(documentOrUri));
        return extHostEditors.showTextDocument(document, columnOrOptions, preserveFocus);
      },
      createTextEditorDecorationType(options) {
        return extHostEditors.createTextEditorDecorationType(extension, options);
      },
      onDidChangeActiveTextEditor(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostEditors.onDidChangeActiveTextEditor)(listener, thisArg, disposables);
      },
      onDidChangeVisibleTextEditors(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostEditors.onDidChangeVisibleTextEditors)(listener, thisArg, disposables);
      },
      onDidChangeTextEditorSelection(listener, thisArgs, disposables) {
        return _asExtensionEvent(extHostEditors.onDidChangeTextEditorSelection)(listener, thisArgs, disposables);
      },
      onDidChangeTextEditorOptions(listener, thisArgs, disposables) {
        return _asExtensionEvent(extHostEditors.onDidChangeTextEditorOptions)(listener, thisArgs, disposables);
      },
      onDidChangeTextEditorVisibleRanges(listener, thisArgs, disposables) {
        return _asExtensionEvent(extHostEditors.onDidChangeTextEditorVisibleRanges)(listener, thisArgs, disposables);
      },
      onDidChangeTextEditorViewColumn(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostEditors.onDidChangeTextEditorViewColumn)(listener, thisArg, disposables);
      },
      onDidChangeTextEditorDiffInformation(listener, thisArg, disposables) {
        checkProposedApiEnabled(extension, "textEditorDiffInformation");
        return _asExtensionEvent(extHostEditors.onDidChangeTextEditorDiffInformation)(listener, thisArg, disposables);
      },
      onDidCloseTerminal(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostTerminalService.onDidCloseTerminal)(listener, thisArg, disposables);
      },
      onDidOpenTerminal(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostTerminalService.onDidOpenTerminal)(listener, thisArg, disposables);
      },
      onDidChangeActiveTerminal(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostTerminalService.onDidChangeActiveTerminal)(listener, thisArg, disposables);
      },
      onDidChangeTerminalDimensions(listener, thisArg, disposables) {
        checkProposedApiEnabled(extension, "terminalDimensions");
        return _asExtensionEvent(extHostTerminalService.onDidChangeTerminalDimensions)(listener, thisArg, disposables);
      },
      onDidChangeTerminalState(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostTerminalService.onDidChangeTerminalState)(listener, thisArg, disposables);
      },
      onDidWriteTerminalData(listener, thisArg, disposables) {
        checkProposedApiEnabled(extension, "terminalDataWriteEvent");
        return _asExtensionEvent(extHostTerminalService.onDidWriteTerminalData)(listener, thisArg, disposables);
      },
      onDidExecuteTerminalCommand(listener, thisArg, disposables) {
        checkProposedApiEnabled(extension, "terminalExecuteCommandEvent");
        return _asExtensionEvent(extHostTerminalService.onDidExecuteTerminalCommand)(listener, thisArg, disposables);
      },
      onDidChangeTerminalShellIntegration(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostTerminalShellIntegration.onDidChangeTerminalShellIntegration)(listener, thisArg, disposables);
      },
      onDidStartTerminalShellExecution(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostTerminalShellIntegration.onDidStartTerminalShellExecution)(listener, thisArg, disposables);
      },
      onDidEndTerminalShellExecution(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostTerminalShellIntegration.onDidEndTerminalShellExecution)(listener, thisArg, disposables);
      },
      get state() {
        return extHostWindow.getState();
      },
      onDidChangeWindowState(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostWindow.onDidChangeWindowState)(listener, thisArg, disposables);
      },
      showInformationMessage(message, ...rest) {
        return extHostMessageService.showMessage(extension, Severity.Info, message, rest[0], rest.slice(1));
      },
      showWarningMessage(message, ...rest) {
        return extHostMessageService.showMessage(extension, Severity.Warning, message, rest[0], rest.slice(1));
      },
      showErrorMessage(message, ...rest) {
        return extHostMessageService.showMessage(extension, Severity.Error, message, rest[0], rest.slice(1));
      },
      showQuickPick(items, options, token) {
        return extHostQuickOpen.showQuickPick(extension, items, options, token);
      },
      showWorkspaceFolderPick(options) {
        return extHostQuickOpen.showWorkspaceFolderPick(options);
      },
      showInputBox(options, token) {
        return extHostQuickOpen.showInput(options, token);
      },
      showOpenDialog(options) {
        return extHostDialogs.showOpenDialog(options);
      },
      showSaveDialog(options) {
        return extHostDialogs.showSaveDialog(options);
      },
      createStatusBarItem(alignmentOrId, priorityOrAlignment, priorityArg) {
        let id;
        let alignment;
        let priority;
        if (typeof alignmentOrId === "string") {
          id = alignmentOrId;
          alignment = priorityOrAlignment;
          priority = priorityArg;
        } else {
          alignment = alignmentOrId;
          priority = priorityOrAlignment;
        }
        return extHostStatusBar.createStatusBarEntry(extension, id, alignment, priority);
      },
      setStatusBarMessage(text, timeoutOrThenable) {
        return extHostStatusBar.setStatusBarMessage(text, timeoutOrThenable);
      },
      withScmProgress(task) {
        extHostApiDeprecation.report(
          "window.withScmProgress",
          extension,
          `Use 'withProgress' instead.`
        );
        return extHostProgress.withProgress(extension, { location: extHostTypes.ProgressLocation.SourceControl }, (progress, token) => task({ report(n) {
        } }));
      },
      withProgress(options, task) {
        return extHostProgress.withProgress(extension, options, task);
      },
      createOutputChannel(name, options) {
        return extHostOutputService.createOutputChannel(name, options, extension);
      },
      createWebviewPanel(viewType, title, showOptions, options) {
        return extHostWebviewPanels.createWebviewPanel(extension, viewType, title, showOptions, options);
      },
      createWebviewTextEditorInset(editor, line, height, options) {
        checkProposedApiEnabled(extension, "editorInsets");
        return extHostEditorInsets.createWebviewEditorInset(editor, line, height, options, extension);
      },
      createTerminal(nameOrOptions, shellPath, shellArgs) {
        if (typeof nameOrOptions === "object") {
          if ("pty" in nameOrOptions) {
            return extHostTerminalService.createExtensionTerminal(nameOrOptions);
          }
          return extHostTerminalService.createTerminalFromOptions(nameOrOptions);
        }
        return extHostTerminalService.createTerminal(nameOrOptions, shellPath, shellArgs);
      },
      registerTerminalLinkProvider(provider) {
        return extHostTerminalService.registerLinkProvider(provider);
      },
      registerTerminalProfileProvider(id, provider) {
        return extHostTerminalService.registerProfileProvider(extension, id, provider);
      },
      registerTerminalCompletionProvider(provider, ...triggerCharacters) {
        checkProposedApiEnabled(extension, "terminalCompletionProvider");
        return extHostTerminalService.registerTerminalCompletionProvider(extension, provider, ...triggerCharacters);
      },
      registerTerminalQuickFixProvider(id, provider) {
        checkProposedApiEnabled(extension, "terminalQuickFixProvider");
        return extHostTerminalService.registerTerminalQuickFixProvider(id, extension.identifier.value, provider);
      },
      registerTreeDataProvider(viewId, treeDataProvider) {
        return extHostTreeViews.registerTreeDataProvider(viewId, treeDataProvider, extension);
      },
      createTreeView(viewId, options) {
        return extHostTreeViews.createTreeView(viewId, options, extension);
      },
      registerWebviewPanelSerializer: (viewType, serializer) => {
        return extHostWebviewPanels.registerWebviewPanelSerializer(extension, viewType, serializer);
      },
      registerCustomEditorProvider: (viewType, provider, options = {}) => {
        return extHostCustomEditors.registerCustomEditorProvider(extension, viewType, provider, options);
      },
      registerFileDecorationProvider(provider) {
        return extHostDecorations.registerFileDecorationProvider(provider, extension);
      },
      registerUriHandler(handler) {
        return extHostUrls.registerUriHandler(extension, handler);
      },
      createQuickPick() {
        return extHostQuickOpen.createQuickPick(extension);
      },
      createInputBox() {
        return extHostQuickOpen.createInputBox(extension);
      },
      get activeColorTheme() {
        return extHostTheming.activeColorTheme;
      },
      onDidChangeActiveColorTheme(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostTheming.onDidChangeActiveColorTheme)(listener, thisArg, disposables);
      },
      registerWebviewViewProvider(viewId, provider, options) {
        return extHostWebviewViews.registerWebviewViewProvider(extension, viewId, provider, options?.webviewOptions);
      },
      get activeNotebookEditor() {
        return extHostNotebook.activeNotebookEditor;
      },
      onDidChangeActiveNotebookEditor(listener, thisArgs, disposables) {
        return _asExtensionEvent(extHostNotebook.onDidChangeActiveNotebookEditor)(listener, thisArgs, disposables);
      },
      get visibleNotebookEditors() {
        return extHostNotebook.visibleNotebookEditors;
      },
      get onDidChangeVisibleNotebookEditors() {
        return _asExtensionEvent(extHostNotebook.onDidChangeVisibleNotebookEditors);
      },
      onDidChangeNotebookEditorSelection(listener, thisArgs, disposables) {
        return _asExtensionEvent(extHostNotebookEditors.onDidChangeNotebookEditorSelection)(listener, thisArgs, disposables);
      },
      onDidChangeNotebookEditorVisibleRanges(listener, thisArgs, disposables) {
        return _asExtensionEvent(extHostNotebookEditors.onDidChangeNotebookEditorVisibleRanges)(listener, thisArgs, disposables);
      },
      showNotebookDocument(document, options) {
        return extHostNotebook.showNotebookDocument(document, options);
      },
      registerExternalUriOpener(id, opener, metadata) {
        checkProposedApiEnabled(extension, "externalUriOpener");
        return extHostUriOpeners.registerExternalUriOpener(extension.identifier, id, opener, metadata);
      },
      registerProfileContentHandler(id, handler) {
        checkProposedApiEnabled(extension, "profileContentHandlers");
        return extHostProfileContentHandlers.registerProfileContentHandler(extension, id, handler);
      },
      registerQuickDiffProvider(selector, quickDiffProvider, label, rootUri) {
        checkProposedApiEnabled(extension, "quickDiffProvider");
        return extHostQuickDiff.registerQuickDiffProvider(checkSelector(selector), quickDiffProvider, label, rootUri);
      },
      get tabGroups() {
        return extHostEditorTabs.tabGroups;
      },
      registerShareProvider(selector, provider) {
        checkProposedApiEnabled(extension, "shareProvider");
        return extHostShare.registerShareProvider(checkSelector(selector), provider);
      },
      get nativeHandle() {
        checkProposedApiEnabled(extension, "nativeWindowHandle");
        return extHostWindow.nativeHandle;
      },
      createChatStatusItem: (id) => {
        checkProposedApiEnabled(extension, "chatStatusItem");
        return extHostChatStatus.createChatStatusItem(extension, id);
      }
    };
    const workspace = {
      get rootPath() {
        extHostApiDeprecation.report(
          "workspace.rootPath",
          extension,
          `Please use 'workspace.workspaceFolders' instead. More details: https://aka.ms/vscode-eliminating-rootpath`
        );
        return extHostWorkspace.getPath();
      },
      set rootPath(value) {
        throw new errors.ReadonlyError("rootPath");
      },
      getWorkspaceFolder(resource) {
        return extHostWorkspace.getWorkspaceFolder(resource);
      },
      get workspaceFolders() {
        return extHostWorkspace.getWorkspaceFolders();
      },
      get name() {
        return extHostWorkspace.name;
      },
      set name(value) {
        throw new errors.ReadonlyError("name");
      },
      get workspaceFile() {
        return extHostWorkspace.workspaceFile;
      },
      set workspaceFile(value) {
        throw new errors.ReadonlyError("workspaceFile");
      },
      updateWorkspaceFolders: (index, deleteCount, ...workspaceFoldersToAdd) => {
        return extHostWorkspace.updateWorkspaceFolders(extension, index, deleteCount || 0, ...workspaceFoldersToAdd);
      },
      onDidChangeWorkspaceFolders: function(listener, thisArgs, disposables) {
        return _asExtensionEvent(extHostWorkspace.onDidChangeWorkspace)(listener, thisArgs, disposables);
      },
      asRelativePath: (pathOrUri, includeWorkspace) => {
        return extHostWorkspace.getRelativePath(pathOrUri, includeWorkspace);
      },
      findFiles: (include, exclude, maxResults, token) => {
        return extHostWorkspace.findFiles(include, exclude, maxResults, extension.identifier, token);
      },
      findFiles2: (filePattern, options, token) => {
        checkProposedApiEnabled(extension, "findFiles2");
        return extHostWorkspace.findFiles2(filePattern, options, extension.identifier, token);
      },
      findTextInFiles: (query, optionsOrCallback, callbackOrToken, token) => {
        checkProposedApiEnabled(extension, "findTextInFiles");
        let options;
        let callback;
        if (typeof optionsOrCallback === "object") {
          options = optionsOrCallback;
          callback = callbackOrToken;
        } else {
          options = {};
          callback = optionsOrCallback;
          token = callbackOrToken;
        }
        return extHostWorkspace.findTextInFiles(query, options || {}, callback, extension.identifier, token);
      },
      findTextInFiles2: (query, options, token) => {
        checkProposedApiEnabled(extension, "findTextInFiles2");
        checkProposedApiEnabled(extension, "textSearchProvider2");
        return extHostWorkspace.findTextInFiles2(query, options, extension.identifier, token);
      },
      save: (uri) => {
        return extHostWorkspace.save(uri);
      },
      saveAs: (uri) => {
        return extHostWorkspace.saveAs(uri);
      },
      saveAll: (includeUntitled) => {
        return extHostWorkspace.saveAll(includeUntitled);
      },
      applyEdit(edit, metadata) {
        return extHostBulkEdits.applyWorkspaceEdit(edit, extension, metadata);
      },
      createFileSystemWatcher: (pattern, optionsOrIgnoreCreate, ignoreChange, ignoreDelete) => {
        const options = {
          ignoreCreateEvents: Boolean(optionsOrIgnoreCreate),
          ignoreChangeEvents: Boolean(ignoreChange),
          ignoreDeleteEvents: Boolean(ignoreDelete)
        };
        return extHostFileSystemEvent.createFileSystemWatcher(extHostWorkspace, configProvider, extension, pattern, options);
      },
      get textDocuments() {
        return extHostDocuments.getAllDocumentData().map((data) => data.document);
      },
      set textDocuments(value) {
        throw new errors.ReadonlyError("textDocuments");
      },
      openTextDocument(uriOrFileNameOrOptions, options) {
        let uriPromise;
        options = options ?? uriOrFileNameOrOptions;
        if (typeof options?.encoding === "string") {
          checkProposedApiEnabled(extension, "textDocumentEncoding");
        }
        if (typeof uriOrFileNameOrOptions === "string") {
          uriPromise = Promise.resolve(URI.file(uriOrFileNameOrOptions));
        } else if (URI.isUri(uriOrFileNameOrOptions)) {
          uriPromise = Promise.resolve(uriOrFileNameOrOptions);
        } else if (!options || typeof options === "object") {
          uriPromise = extHostDocuments.createDocumentData(options);
        } else {
          throw new Error("illegal argument - uriOrFileNameOrOptions");
        }
        return uriPromise.then((uri) => {
          extHostLogService.trace(`openTextDocument from ${extension.identifier}`);
          if (uri.scheme === Schemas.vscodeRemote && !uri.authority) {
            extHostApiDeprecation.report("workspace.openTextDocument", extension, `A URI of 'vscode-remote' scheme requires an authority.`);
          }
          return extHostDocuments.ensureDocumentData(uri, options).then((documentData) => {
            return documentData.document;
          });
        });
      },
      onDidOpenTextDocument: (listener, thisArgs, disposables) => {
        return _asExtensionEvent(extHostDocuments.onDidAddDocument)(listener, thisArgs, disposables);
      },
      onDidCloseTextDocument: (listener, thisArgs, disposables) => {
        return _asExtensionEvent(extHostDocuments.onDidRemoveDocument)(listener, thisArgs, disposables);
      },
      onDidChangeTextDocument: (listener, thisArgs, disposables) => {
        return _asExtensionEvent(extHostDocuments.onDidChangeDocument)(listener, thisArgs, disposables);
      },
      onDidSaveTextDocument: (listener, thisArgs, disposables) => {
        return _asExtensionEvent(extHostDocuments.onDidSaveDocument)(listener, thisArgs, disposables);
      },
      onWillSaveTextDocument: (listener, thisArgs, disposables) => {
        return _asExtensionEvent(extHostDocumentSaveParticipant.getOnWillSaveTextDocumentEvent(extension))(listener, thisArgs, disposables);
      },
      get notebookDocuments() {
        return extHostNotebook.notebookDocuments.map((d) => d.apiNotebook);
      },
      async openNotebookDocument(uriOrType, content) {
        let uri;
        if (URI.isUri(uriOrType)) {
          uri = uriOrType;
          await extHostNotebook.openNotebookDocument(uriOrType);
        } else if (typeof uriOrType === "string") {
          uri = URI.revive(await extHostNotebook.createNotebookDocument({ viewType: uriOrType, content }));
        } else {
          throw new Error("Invalid arguments");
        }
        return extHostNotebook.getNotebookDocument(uri).apiNotebook;
      },
      onDidSaveNotebookDocument(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostNotebookDocuments.onDidSaveNotebookDocument)(listener, thisArg, disposables);
      },
      onDidChangeNotebookDocument(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostNotebookDocuments.onDidChangeNotebookDocument)(listener, thisArg, disposables);
      },
      onWillSaveNotebookDocument(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostNotebookDocumentSaveParticipant.getOnWillSaveNotebookDocumentEvent(extension))(listener, thisArg, disposables);
      },
      get onDidOpenNotebookDocument() {
        return _asExtensionEvent(extHostNotebook.onDidOpenNotebookDocument);
      },
      get onDidCloseNotebookDocument() {
        return _asExtensionEvent(extHostNotebook.onDidCloseNotebookDocument);
      },
      registerNotebookSerializer(viewType, serializer, options, registration) {
        return extHostNotebook.registerNotebookSerializer(extension, viewType, serializer, options, isProposedApiEnabled(extension, "notebookLiveShare") ? registration : void 0);
      },
      onDidChangeConfiguration: (listener, thisArgs, disposables) => {
        return _asExtensionEvent(configProvider.onDidChangeConfiguration)(listener, thisArgs, disposables);
      },
      getConfiguration(section, scope) {
        scope = arguments.length === 1 ? void 0 : scope;
        return configProvider.getConfiguration(section, scope, extension);
      },
      registerTextDocumentContentProvider(scheme, provider) {
        return extHostDocumentContentProviders.registerTextDocumentContentProvider(scheme, provider);
      },
      registerTaskProvider: (type, provider) => {
        extHostApiDeprecation.report(
          "window.registerTaskProvider",
          extension,
          `Use the corresponding function on the 'tasks' namespace instead`
        );
        return extHostTask.registerTaskProvider(extension, type, provider);
      },
      registerFileSystemProvider(scheme, provider, options) {
        return combinedDisposable(
          extHostFileSystem.registerFileSystemProvider(extension, scheme, provider, options),
          extHostConsumerFileSystem.addFileSystemProvider(scheme, provider, options)
        );
      },
      get fs() {
        return extHostConsumerFileSystem.value;
      },
      registerFileSearchProvider: (scheme, provider) => {
        checkProposedApiEnabled(extension, "fileSearchProvider");
        return extHostSearch.registerFileSearchProviderOld(scheme, provider);
      },
      registerTextSearchProvider: (scheme, provider) => {
        checkProposedApiEnabled(extension, "textSearchProvider");
        return extHostSearch.registerTextSearchProviderOld(scheme, provider);
      },
      registerAITextSearchProvider: (scheme, provider) => {
        checkProposedApiEnabled(extension, "aiTextSearchProvider");
        checkProposedApiEnabled(extension, "textSearchProvider2");
        return extHostSearch.registerAITextSearchProvider(scheme, provider);
      },
      registerFileSearchProvider2: (scheme, provider) => {
        checkProposedApiEnabled(extension, "fileSearchProvider2");
        return extHostSearch.registerFileSearchProvider(scheme, provider);
      },
      registerTextSearchProvider2: (scheme, provider) => {
        checkProposedApiEnabled(extension, "textSearchProvider2");
        return extHostSearch.registerTextSearchProvider(scheme, provider);
      },
      registerRemoteAuthorityResolver: (authorityPrefix, resolver) => {
        checkProposedApiEnabled(extension, "resolvers");
        return extensionService.registerRemoteAuthorityResolver(authorityPrefix, resolver);
      },
      registerResourceLabelFormatter: (formatter) => {
        checkProposedApiEnabled(extension, "resolvers");
        return extHostLabelService.$registerResourceLabelFormatter(formatter);
      },
      getRemoteExecServer: (authority) => {
        checkProposedApiEnabled(extension, "resolvers");
        return extensionService.getRemoteExecServer(authority);
      },
      onDidCreateFiles: (listener, thisArg, disposables) => {
        return _asExtensionEvent(extHostFileSystemEvent.onDidCreateFile)(listener, thisArg, disposables);
      },
      onDidDeleteFiles: (listener, thisArg, disposables) => {
        return _asExtensionEvent(extHostFileSystemEvent.onDidDeleteFile)(listener, thisArg, disposables);
      },
      onDidRenameFiles: (listener, thisArg, disposables) => {
        return _asExtensionEvent(extHostFileSystemEvent.onDidRenameFile)(listener, thisArg, disposables);
      },
      onWillCreateFiles: (listener, thisArg, disposables) => {
        return _asExtensionEvent(extHostFileSystemEvent.getOnWillCreateFileEvent(extension))(listener, thisArg, disposables);
      },
      onWillDeleteFiles: (listener, thisArg, disposables) => {
        return _asExtensionEvent(extHostFileSystemEvent.getOnWillDeleteFileEvent(extension))(listener, thisArg, disposables);
      },
      onWillRenameFiles: (listener, thisArg, disposables) => {
        return _asExtensionEvent(extHostFileSystemEvent.getOnWillRenameFileEvent(extension))(listener, thisArg, disposables);
      },
      openTunnel: (forward) => {
        checkProposedApiEnabled(extension, "tunnels");
        return extHostTunnelService.openTunnel(extension, forward).then((value) => {
          if (!value) {
            throw new Error("cannot open tunnel");
          }
          return value;
        });
      },
      get tunnels() {
        checkProposedApiEnabled(extension, "tunnels");
        return extHostTunnelService.getTunnels();
      },
      onDidChangeTunnels: (listener, thisArg, disposables) => {
        checkProposedApiEnabled(extension, "tunnels");
        return _asExtensionEvent(extHostTunnelService.onDidChangeTunnels)(listener, thisArg, disposables);
      },
      registerPortAttributesProvider: (portSelector, provider) => {
        checkProposedApiEnabled(extension, "portsAttributes");
        return extHostTunnelService.registerPortsAttributesProvider(portSelector, provider);
      },
      registerTunnelProvider: (tunnelProvider, information) => {
        checkProposedApiEnabled(extension, "tunnelFactory");
        return extHostTunnelService.registerTunnelProvider(tunnelProvider, information);
      },
      registerTimelineProvider: (scheme, provider) => {
        checkProposedApiEnabled(extension, "timeline");
        return extHostTimeline.registerTimelineProvider(scheme, provider, extension.identifier, extHostCommands.converter);
      },
      get isTrusted() {
        return extHostWorkspace.trusted;
      },
      requestWorkspaceTrust: (options) => {
        checkProposedApiEnabled(extension, "workspaceTrust");
        return extHostWorkspace.requestWorkspaceTrust(options);
      },
      onDidGrantWorkspaceTrust: (listener, thisArgs, disposables) => {
        return _asExtensionEvent(extHostWorkspace.onDidGrantWorkspaceTrust)(listener, thisArgs, disposables);
      },
      registerEditSessionIdentityProvider: (scheme, provider) => {
        checkProposedApiEnabled(extension, "editSessionIdentityProvider");
        return extHostWorkspace.registerEditSessionIdentityProvider(scheme, provider);
      },
      onWillCreateEditSessionIdentity: (listener, thisArgs, disposables) => {
        checkProposedApiEnabled(extension, "editSessionIdentityProvider");
        return _asExtensionEvent(extHostWorkspace.getOnWillCreateEditSessionIdentityEvent(extension))(listener, thisArgs, disposables);
      },
      registerCanonicalUriProvider: (scheme, provider) => {
        checkProposedApiEnabled(extension, "canonicalUriProvider");
        return extHostWorkspace.registerCanonicalUriProvider(scheme, provider);
      },
      getCanonicalUri: (uri, options, token) => {
        checkProposedApiEnabled(extension, "canonicalUriProvider");
        return extHostWorkspace.provideCanonicalUri(uri, options, token);
      },
      decode(content, uri, options) {
        checkProposedApiEnabled(extension, "textDocumentEncoding");
        return extHostWorkspace.decode(content, uri, options);
      },
      encode(content, uri, options) {
        checkProposedApiEnabled(extension, "textDocumentEncoding");
        return extHostWorkspace.encode(content, uri, options);
      }
    };
    const scm = {
      get inputBox() {
        extHostApiDeprecation.report(
          "scm.inputBox",
          extension,
          `Use 'SourceControl.inputBox' instead`
        );
        return extHostSCM.getLastInputBox(extension);
      },
      createSourceControl(id, label, rootUri) {
        return extHostSCM.createSourceControl(extension, id, label, rootUri);
      }
    };
    const comments = {
      createCommentController(id, label) {
        return extHostComment.createCommentController(extension, id, label);
      }
    };
    const debug = {
      get activeDebugSession() {
        return extHostDebugService.activeDebugSession;
      },
      get activeDebugConsole() {
        return extHostDebugService.activeDebugConsole;
      },
      get breakpoints() {
        return extHostDebugService.breakpoints;
      },
      get activeStackItem() {
        return extHostDebugService.activeStackItem;
      },
      registerDebugVisualizationProvider(id, provider) {
        checkProposedApiEnabled(extension, "debugVisualization");
        return extHostDebugService.registerDebugVisualizationProvider(extension, id, provider);
      },
      registerDebugVisualizationTreeProvider(id, provider) {
        checkProposedApiEnabled(extension, "debugVisualization");
        return extHostDebugService.registerDebugVisualizationTree(extension, id, provider);
      },
      onDidStartDebugSession(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostDebugService.onDidStartDebugSession)(listener, thisArg, disposables);
      },
      onDidTerminateDebugSession(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostDebugService.onDidTerminateDebugSession)(listener, thisArg, disposables);
      },
      onDidChangeActiveDebugSession(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostDebugService.onDidChangeActiveDebugSession)(listener, thisArg, disposables);
      },
      onDidReceiveDebugSessionCustomEvent(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostDebugService.onDidReceiveDebugSessionCustomEvent)(listener, thisArg, disposables);
      },
      onDidChangeBreakpoints(listener, thisArgs, disposables) {
        return _asExtensionEvent(extHostDebugService.onDidChangeBreakpoints)(listener, thisArgs, disposables);
      },
      onDidChangeActiveStackItem(listener, thisArg, disposables) {
        return _asExtensionEvent(extHostDebugService.onDidChangeActiveStackItem)(listener, thisArg, disposables);
      },
      registerDebugConfigurationProvider(debugType, provider, triggerKind) {
        return extHostDebugService.registerDebugConfigurationProvider(debugType, provider, triggerKind || DebugConfigurationProviderTriggerKind.Initial);
      },
      registerDebugAdapterDescriptorFactory(debugType, factory) {
        return extHostDebugService.registerDebugAdapterDescriptorFactory(extension, debugType, factory);
      },
      registerDebugAdapterTrackerFactory(debugType, factory) {
        return extHostDebugService.registerDebugAdapterTrackerFactory(debugType, factory);
      },
      startDebugging(folder, nameOrConfig, parentSessionOrOptions) {
        if (!parentSessionOrOptions || typeof parentSessionOrOptions === "object" && "configuration" in parentSessionOrOptions) {
          return extHostDebugService.startDebugging(folder, nameOrConfig, { parentSession: parentSessionOrOptions });
        }
        return extHostDebugService.startDebugging(folder, nameOrConfig, parentSessionOrOptions || {});
      },
      stopDebugging(session) {
        return extHostDebugService.stopDebugging(session);
      },
      addBreakpoints(breakpoints) {
        return extHostDebugService.addBreakpoints(breakpoints);
      },
      removeBreakpoints(breakpoints) {
        return extHostDebugService.removeBreakpoints(breakpoints);
      },
      asDebugSourceUri(source, session) {
        return extHostDebugService.asDebugSourceUri(source, session);
      }
    };
    const tasks = {
      registerTaskProvider: (type, provider) => {
        return extHostTask.registerTaskProvider(extension, type, provider);
      },
      fetchTasks: (filter) => {
        return extHostTask.fetchTasks(filter);
      },
      executeTask: (task) => {
        return extHostTask.executeTask(extension, task);
      },
      get taskExecutions() {
        return extHostTask.taskExecutions;
      },
      onDidStartTask: (listeners, thisArgs, disposables) => {
        return _asExtensionEvent(extHostTask.onDidStartTask)(listeners, thisArgs, disposables);
      },
      onDidEndTask: (listeners, thisArgs, disposables) => {
        return _asExtensionEvent(extHostTask.onDidEndTask)(listeners, thisArgs, disposables);
      },
      onDidStartTaskProcess: (listeners, thisArgs, disposables) => {
        return _asExtensionEvent(extHostTask.onDidStartTaskProcess)(listeners, thisArgs, disposables);
      },
      onDidEndTaskProcess: (listeners, thisArgs, disposables) => {
        return _asExtensionEvent(extHostTask.onDidEndTaskProcess)(listeners, thisArgs, disposables);
      },
      onDidStartTaskProblemMatchers: (listeners, thisArgs, disposables) => {
        checkProposedApiEnabled(extension, "taskProblemMatcherStatus");
        return _asExtensionEvent(extHostTask.onDidStartTaskProblemMatchers)(listeners, thisArgs, disposables);
      },
      onDidEndTaskProblemMatchers: (listeners, thisArgs, disposables) => {
        checkProposedApiEnabled(extension, "taskProblemMatcherStatus");
        return _asExtensionEvent(extHostTask.onDidEndTaskProblemMatchers)(listeners, thisArgs, disposables);
      }
    };
    const notebooks = {
      createNotebookController(id, notebookType, label, handler, rendererScripts) {
        return extHostNotebookKernels.createNotebookController(extension, id, notebookType, label, handler, isProposedApiEnabled(extension, "notebookMessaging") ? rendererScripts : void 0);
      },
      registerNotebookCellStatusBarItemProvider: (notebookType, provider) => {
        return extHostNotebook.registerNotebookCellStatusBarItemProvider(extension, notebookType, provider);
      },
      createRendererMessaging(rendererId) {
        return extHostNotebookRenderers.createRendererMessaging(extension, rendererId);
      },
      createNotebookControllerDetectionTask(notebookType) {
        checkProposedApiEnabled(extension, "notebookKernelSource");
        return extHostNotebookKernels.createNotebookControllerDetectionTask(extension, notebookType);
      },
      registerKernelSourceActionProvider(notebookType, provider) {
        checkProposedApiEnabled(extension, "notebookKernelSource");
        return extHostNotebookKernels.registerKernelSourceActionProvider(extension, notebookType, provider);
      },
      onDidChangeNotebookCellExecutionState(listener, thisArgs, disposables) {
        checkProposedApiEnabled(extension, "notebookCellExecutionState");
        return _asExtensionEvent(extHostNotebookKernels.onDidChangeNotebookCellExecutionState)(listener, thisArgs, disposables);
      }
    };
    const l10n = {
      t(...params) {
        if (typeof params[0] === "string") {
          const key = params.shift();
          const argsFormatted = !params || typeof params[0] !== "object" ? params : params[0];
          return extHostLocalization.getMessage(extension.identifier.value, { message: key, args: argsFormatted });
        }
        return extHostLocalization.getMessage(extension.identifier.value, params[0]);
      },
      get bundle() {
        return extHostLocalization.getBundle(extension.identifier.value);
      },
      get uri() {
        return extHostLocalization.getBundleUri(extension.identifier.value);
      }
    };
    const interactive = {
      transferActiveChat(toWorkspace) {
        checkProposedApiEnabled(extension, "interactive");
        return extHostChatAgents2.transferActiveChat(toWorkspace);
      }
    };
    const ai = {
      getRelatedInformation(query, types) {
        checkProposedApiEnabled(extension, "aiRelatedInformation");
        return extHostAiRelatedInformation.getRelatedInformation(extension, query, types);
      },
      registerRelatedInformationProvider(type, provider) {
        checkProposedApiEnabled(extension, "aiRelatedInformation");
        return extHostAiRelatedInformation.registerRelatedInformationProvider(extension, type, provider);
      },
      registerEmbeddingVectorProvider(model, provider) {
        checkProposedApiEnabled(extension, "aiRelatedInformation");
        return extHostAiEmbeddingVector.registerEmbeddingVectorProvider(extension, model, provider);
      }
    };
    const chat = {
      registerChatResponseProvider(id, provider, metadata) {
        checkProposedApiEnabled(extension, "chatProvider");
        return extHostLanguageModels.registerLanguageModel(extension, id, provider, metadata);
      },
      registerMappedEditsProvider(_selector, _provider) {
        checkProposedApiEnabled(extension, "mappedEditsProvider");
        return { dispose() {
        } };
      },
      registerMappedEditsProvider2(provider) {
        checkProposedApiEnabled(extension, "mappedEditsProvider");
        return extHostCodeMapper.registerMappedEditsProvider(extension, provider);
      },
      createChatParticipant(id, handler) {
        return extHostChatAgents2.createChatAgent(extension, id, handler);
      },
      createDynamicChatParticipant(id, dynamicProps, handler) {
        checkProposedApiEnabled(extension, "chatParticipantPrivate");
        return extHostChatAgents2.createDynamicChatAgent(extension, id, dynamicProps, handler);
      },
      registerChatParticipantDetectionProvider(provider) {
        checkProposedApiEnabled(extension, "chatParticipantPrivate");
        return extHostChatAgents2.registerChatParticipantDetectionProvider(extension, provider);
      },
      registerRelatedFilesProvider(provider, metadata) {
        checkProposedApiEnabled(extension, "chatEditing");
        return extHostChatAgents2.registerRelatedFilesProvider(extension, provider, metadata);
      },
      onDidDisposeChatSession: (listeners, thisArgs, disposables) => {
        checkProposedApiEnabled(extension, "chatParticipantPrivate");
        return _asExtensionEvent(extHostChatAgents2.onDidDisposeChatSession)(listeners, thisArgs, disposables);
      }
    };
    const lm = {
      selectChatModels: (selector) => {
        return extHostLanguageModels.selectLanguageModels(extension, selector ?? {});
      },
      onDidChangeChatModels: (listener, thisArgs, disposables) => {
        return extHostLanguageModels.onDidChangeProviders(listener, thisArgs, disposables);
      },
      registerChatModelProvider: (id, provider, metadata) => {
        checkProposedApiEnabled(extension, "chatProvider");
        return extHostLanguageModels.registerLanguageModel(extension, id, provider, metadata);
      },
      // --- embeddings
      get embeddingModels() {
        checkProposedApiEnabled(extension, "embeddings");
        return extHostEmbeddings.embeddingsModels;
      },
      onDidChangeEmbeddingModels: (listener, thisArgs, disposables) => {
        checkProposedApiEnabled(extension, "embeddings");
        return extHostEmbeddings.onDidChange(listener, thisArgs, disposables);
      },
      registerEmbeddingsProvider(embeddingsModel, provider) {
        checkProposedApiEnabled(extension, "embeddings");
        return extHostEmbeddings.registerEmbeddingsProvider(extension, embeddingsModel, provider);
      },
      async computeEmbeddings(embeddingsModel, input, token) {
        checkProposedApiEnabled(extension, "embeddings");
        if (typeof input === "string") {
          return extHostEmbeddings.computeEmbeddings(embeddingsModel, input, token);
        } else {
          return extHostEmbeddings.computeEmbeddings(embeddingsModel, input, token);
        }
      },
      registerTool(name, tool) {
        return extHostLanguageModelTools.registerTool(extension, name, tool);
      },
      invokeTool(name, parameters, token) {
        return extHostLanguageModelTools.invokeTool(extension, name, parameters, token);
      },
      get tools() {
        return extHostLanguageModelTools.getTools(extension);
      },
      fileIsIgnored(uri, token) {
        return extHostLanguageModels.fileIsIgnored(extension, uri, token);
      },
      registerIgnoredFileProvider(provider) {
        return extHostLanguageModels.registerIgnoredFileProvider(extension, provider);
      },
      registerMcpConfigurationProvider(id, provider) {
        checkProposedApiEnabled(extension, "mcpConfigurationProvider");
        return extHostMcp.registerMcpConfigurationProvider(extension, id, provider);
      }
    };
    const speech = {
      registerSpeechProvider(id, provider) {
        checkProposedApiEnabled(extension, "speech");
        return extHostSpeech.registerProvider(extension.identifier, id, provider);
      }
    };
    return {
      version: initData.version,
      // namespaces
      ai,
      authentication,
      commands,
      comments,
      chat,
      debug,
      env,
      extensions,
      interactive,
      l10n,
      languages,
      lm,
      notebooks,
      scm,
      speech,
      tasks,
      tests,
      window,
      workspace,
      // types
      Breakpoint: extHostTypes.Breakpoint,
      TerminalOutputAnchor: extHostTypes.TerminalOutputAnchor,
      ChatResultFeedbackKind: extHostTypes.ChatResultFeedbackKind,
      ChatVariableLevel: extHostTypes.ChatVariableLevel,
      ChatCompletionItem: extHostTypes.ChatCompletionItem,
      ChatReferenceDiagnostic: extHostTypes.ChatReferenceDiagnostic,
      CallHierarchyIncomingCall: extHostTypes.CallHierarchyIncomingCall,
      CallHierarchyItem: extHostTypes.CallHierarchyItem,
      CallHierarchyOutgoingCall: extHostTypes.CallHierarchyOutgoingCall,
      CancellationError: errors.CancellationError,
      CancellationTokenSource,
      CandidatePortSource,
      CodeAction: extHostTypes.CodeAction,
      CodeActionKind: extHostTypes.CodeActionKind,
      CodeActionTriggerKind: extHostTypes.CodeActionTriggerKind,
      CodeLens: extHostTypes.CodeLens,
      Color: extHostTypes.Color,
      ColorInformation: extHostTypes.ColorInformation,
      ColorPresentation: extHostTypes.ColorPresentation,
      ColorThemeKind: extHostTypes.ColorThemeKind,
      CommentMode: extHostTypes.CommentMode,
      CommentState: extHostTypes.CommentState,
      CommentThreadCollapsibleState: extHostTypes.CommentThreadCollapsibleState,
      CommentThreadState: extHostTypes.CommentThreadState,
      CommentThreadApplicability: extHostTypes.CommentThreadApplicability,
      CommentThreadFocus: extHostTypes.CommentThreadFocus,
      CompletionItem: extHostTypes.CompletionItem,
      CompletionItemKind: extHostTypes.CompletionItemKind,
      CompletionItemTag: extHostTypes.CompletionItemTag,
      CompletionList: extHostTypes.CompletionList,
      CompletionTriggerKind: extHostTypes.CompletionTriggerKind,
      ConfigurationTarget: extHostTypes.ConfigurationTarget,
      CustomExecution: extHostTypes.CustomExecution,
      DebugAdapterExecutable: extHostTypes.DebugAdapterExecutable,
      DebugAdapterInlineImplementation: extHostTypes.DebugAdapterInlineImplementation,
      DebugAdapterNamedPipeServer: extHostTypes.DebugAdapterNamedPipeServer,
      DebugAdapterServer: extHostTypes.DebugAdapterServer,
      DebugConfigurationProviderTriggerKind,
      DebugConsoleMode: extHostTypes.DebugConsoleMode,
      DebugVisualization: extHostTypes.DebugVisualization,
      DecorationRangeBehavior: extHostTypes.DecorationRangeBehavior,
      Diagnostic: extHostTypes.Diagnostic,
      DiagnosticRelatedInformation: extHostTypes.DiagnosticRelatedInformation,
      DiagnosticSeverity: extHostTypes.DiagnosticSeverity,
      DiagnosticTag: extHostTypes.DiagnosticTag,
      Disposable: extHostTypes.Disposable,
      DocumentHighlight: extHostTypes.DocumentHighlight,
      DocumentHighlightKind: extHostTypes.DocumentHighlightKind,
      MultiDocumentHighlight: extHostTypes.MultiDocumentHighlight,
      DocumentLink: extHostTypes.DocumentLink,
      DocumentSymbol: extHostTypes.DocumentSymbol,
      EndOfLine: extHostTypes.EndOfLine,
      EnvironmentVariableMutatorType: extHostTypes.EnvironmentVariableMutatorType,
      EvaluatableExpression: extHostTypes.EvaluatableExpression,
      InlineValueText: extHostTypes.InlineValueText,
      InlineValueVariableLookup: extHostTypes.InlineValueVariableLookup,
      InlineValueEvaluatableExpression: extHostTypes.InlineValueEvaluatableExpression,
      InlineCompletionTriggerKind: extHostTypes.InlineCompletionTriggerKind,
      EventEmitter: Emitter,
      ExtensionKind: extHostTypes.ExtensionKind,
      ExtensionMode: extHostTypes.ExtensionMode,
      ExternalUriOpenerPriority: extHostTypes.ExternalUriOpenerPriority,
      FileChangeType: extHostTypes.FileChangeType,
      FileDecoration: extHostTypes.FileDecoration,
      FileDecoration2: extHostTypes.FileDecoration,
      FileSystemError: extHostTypes.FileSystemError,
      FileType: files.FileType,
      FilePermission: files.FilePermission,
      FoldingRange: extHostTypes.FoldingRange,
      FoldingRangeKind: extHostTypes.FoldingRangeKind,
      FunctionBreakpoint: extHostTypes.FunctionBreakpoint,
      InlineCompletionItem: extHostTypes.InlineSuggestion,
      InlineCompletionList: extHostTypes.InlineSuggestionList,
      Hover: extHostTypes.Hover,
      VerboseHover: extHostTypes.VerboseHover,
      HoverVerbosityAction: extHostTypes.HoverVerbosityAction,
      IndentAction: languageConfiguration.IndentAction,
      Location: extHostTypes.Location,
      MarkdownString: extHostTypes.MarkdownString,
      OverviewRulerLane,
      ParameterInformation: extHostTypes.ParameterInformation,
      PortAutoForwardAction: extHostTypes.PortAutoForwardAction,
      Position: extHostTypes.Position,
      ProcessExecution: extHostTypes.ProcessExecution,
      ProgressLocation: extHostTypes.ProgressLocation,
      QuickInputButtonLocation: extHostTypes.QuickInputButtonLocation,
      QuickInputButtons: extHostTypes.QuickInputButtons,
      Range: extHostTypes.Range,
      RelativePattern: extHostTypes.RelativePattern,
      Selection: extHostTypes.Selection,
      SelectionRange: extHostTypes.SelectionRange,
      SemanticTokens: extHostTypes.SemanticTokens,
      SemanticTokensBuilder: extHostTypes.SemanticTokensBuilder,
      SemanticTokensEdit: extHostTypes.SemanticTokensEdit,
      SemanticTokensEdits: extHostTypes.SemanticTokensEdits,
      SemanticTokensLegend: extHostTypes.SemanticTokensLegend,
      ShellExecution: extHostTypes.ShellExecution,
      ShellQuoting: extHostTypes.ShellQuoting,
      SignatureHelp: extHostTypes.SignatureHelp,
      SignatureHelpTriggerKind: extHostTypes.SignatureHelpTriggerKind,
      SignatureInformation: extHostTypes.SignatureInformation,
      SnippetString: extHostTypes.SnippetString,
      SourceBreakpoint: extHostTypes.SourceBreakpoint,
      StandardTokenType: extHostTypes.StandardTokenType,
      StatusBarAlignment: extHostTypes.StatusBarAlignment,
      SymbolInformation: extHostTypes.SymbolInformation,
      SymbolKind: extHostTypes.SymbolKind,
      SymbolTag: extHostTypes.SymbolTag,
      Task: extHostTypes.Task,
      TaskEventKind: extHostTypes.TaskEventKind,
      TaskGroup: extHostTypes.TaskGroup,
      TaskPanelKind: extHostTypes.TaskPanelKind,
      TaskRevealKind: extHostTypes.TaskRevealKind,
      TaskScope: extHostTypes.TaskScope,
      TerminalLink: extHostTypes.TerminalLink,
      TerminalQuickFixTerminalCommand: extHostTypes.TerminalQuickFixCommand,
      TerminalQuickFixOpener: extHostTypes.TerminalQuickFixOpener,
      TerminalLocation: extHostTypes.TerminalLocation,
      TerminalProfile: extHostTypes.TerminalProfile,
      TerminalExitReason: extHostTypes.TerminalExitReason,
      TerminalShellExecutionCommandLineConfidence: extHostTypes.TerminalShellExecutionCommandLineConfidence,
      TerminalCompletionItem: extHostTypes.TerminalCompletionItem,
      TerminalCompletionItemKind: extHostTypes.TerminalCompletionItemKind,
      TerminalCompletionList: extHostTypes.TerminalCompletionList,
      TerminalShellType: extHostTypes.TerminalShellType,
      TextDocumentSaveReason: extHostTypes.TextDocumentSaveReason,
      TextEdit: extHostTypes.TextEdit,
      SnippetTextEdit: extHostTypes.SnippetTextEdit,
      TextEditorCursorStyle,
      TextEditorChangeKind: extHostTypes.TextEditorChangeKind,
      TextEditorLineNumbersStyle: extHostTypes.TextEditorLineNumbersStyle,
      TextEditorRevealType: extHostTypes.TextEditorRevealType,
      TextEditorSelectionChangeKind: extHostTypes.TextEditorSelectionChangeKind,
      SyntaxTokenType: extHostTypes.SyntaxTokenType,
      TextDocumentChangeReason: extHostTypes.TextDocumentChangeReason,
      ThemeColor: extHostTypes.ThemeColor,
      ThemeIcon: extHostTypes.ThemeIcon,
      TreeItem: extHostTypes.TreeItem,
      TreeItemCheckboxState: extHostTypes.TreeItemCheckboxState,
      TreeItemCollapsibleState: extHostTypes.TreeItemCollapsibleState,
      TypeHierarchyItem: extHostTypes.TypeHierarchyItem,
      UIKind,
      Uri: URI,
      ViewColumn: extHostTypes.ViewColumn,
      WorkspaceEdit: extHostTypes.WorkspaceEdit,
      // proposed api types
      DocumentPasteTriggerKind: extHostTypes.DocumentPasteTriggerKind,
      DocumentDropEdit: extHostTypes.DocumentDropEdit,
      DocumentDropOrPasteEditKind: extHostTypes.DocumentDropOrPasteEditKind,
      DocumentPasteEdit: extHostTypes.DocumentPasteEdit,
      InlayHint: extHostTypes.InlayHint,
      InlayHintLabelPart: extHostTypes.InlayHintLabelPart,
      InlayHintKind: extHostTypes.InlayHintKind,
      RemoteAuthorityResolverError: extHostTypes.RemoteAuthorityResolverError,
      ResolvedAuthority: extHostTypes.ResolvedAuthority,
      ManagedResolvedAuthority: extHostTypes.ManagedResolvedAuthority,
      SourceControlInputBoxValidationType: extHostTypes.SourceControlInputBoxValidationType,
      ExtensionRuntime: extHostTypes.ExtensionRuntime,
      TimelineItem: extHostTypes.TimelineItem,
      NotebookRange: extHostTypes.NotebookRange,
      NotebookCellKind: extHostTypes.NotebookCellKind,
      NotebookCellExecutionState: extHostTypes.NotebookCellExecutionState,
      NotebookCellData: extHostTypes.NotebookCellData,
      NotebookData: extHostTypes.NotebookData,
      NotebookRendererScript: extHostTypes.NotebookRendererScript,
      NotebookCellStatusBarAlignment: extHostTypes.NotebookCellStatusBarAlignment,
      NotebookEditorRevealType: extHostTypes.NotebookEditorRevealType,
      NotebookCellOutput: extHostTypes.NotebookCellOutput,
      NotebookCellOutputItem: extHostTypes.NotebookCellOutputItem,
      CellErrorStackFrame: extHostTypes.CellErrorStackFrame,
      NotebookCellStatusBarItem: extHostTypes.NotebookCellStatusBarItem,
      NotebookControllerAffinity: extHostTypes.NotebookControllerAffinity,
      NotebookControllerAffinity2: extHostTypes.NotebookControllerAffinity2,
      NotebookEdit: extHostTypes.NotebookEdit,
      NotebookKernelSourceAction: extHostTypes.NotebookKernelSourceAction,
      NotebookVariablesRequestKind: extHostTypes.NotebookVariablesRequestKind,
      PortAttributes: extHostTypes.PortAttributes,
      LinkedEditingRanges: extHostTypes.LinkedEditingRanges,
      TestResultState: extHostTypes.TestResultState,
      TestRunRequest: extHostTypes.TestRunRequest,
      TestMessage: extHostTypes.TestMessage,
      TestMessageStackFrame: extHostTypes.TestMessageStackFrame,
      TestTag: extHostTypes.TestTag,
      TestRunProfileKind: extHostTypes.TestRunProfileKind,
      TextSearchCompleteMessageType,
      DataTransfer: extHostTypes.DataTransfer,
      DataTransferItem: extHostTypes.DataTransferItem,
      TestCoverageCount: extHostTypes.TestCoverageCount,
      FileCoverage: extHostTypes.FileCoverage,
      StatementCoverage: extHostTypes.StatementCoverage,
      BranchCoverage: extHostTypes.BranchCoverage,
      DeclarationCoverage: extHostTypes.DeclarationCoverage,
      WorkspaceTrustState: extHostTypes.WorkspaceTrustState,
      LanguageStatusSeverity: extHostTypes.LanguageStatusSeverity,
      QuickPickItemKind: extHostTypes.QuickPickItemKind,
      InputBoxValidationSeverity: extHostTypes.InputBoxValidationSeverity,
      TabInputText: extHostTypes.TextTabInput,
      TabInputTextDiff: extHostTypes.TextDiffTabInput,
      TabInputTextMerge: extHostTypes.TextMergeTabInput,
      TabInputCustom: extHostTypes.CustomEditorTabInput,
      TabInputNotebook: extHostTypes.NotebookEditorTabInput,
      TabInputNotebookDiff: extHostTypes.NotebookDiffEditorTabInput,
      TabInputWebview: extHostTypes.WebviewEditorTabInput,
      TabInputTerminal: extHostTypes.TerminalEditorTabInput,
      TabInputInteractiveWindow: extHostTypes.InteractiveWindowInput,
      TabInputChat: extHostTypes.ChatEditorTabInput,
      TabInputTextMultiDiff: extHostTypes.TextMultiDiffTabInput,
      TelemetryTrustedValue,
      LogLevel,
      EditSessionIdentityMatch,
      InteractiveSessionVoteDirection: extHostTypes.InteractiveSessionVoteDirection,
      ChatCopyKind: extHostTypes.ChatCopyKind,
      ChatEditingSessionActionOutcome: extHostTypes.ChatEditingSessionActionOutcome,
      InteractiveEditorResponseFeedbackKind: extHostTypes.InteractiveEditorResponseFeedbackKind,
      DebugStackFrame: extHostTypes.DebugStackFrame,
      DebugThread: extHostTypes.DebugThread,
      RelatedInformationType: extHostTypes.RelatedInformationType,
      SpeechToTextStatus: extHostTypes.SpeechToTextStatus,
      TextToSpeechStatus: extHostTypes.TextToSpeechStatus,
      PartialAcceptTriggerKind: extHostTypes.PartialAcceptTriggerKind,
      KeywordRecognitionStatus: extHostTypes.KeywordRecognitionStatus,
      ChatResponseMarkdownPart: extHostTypes.ChatResponseMarkdownPart,
      ChatResponseFileTreePart: extHostTypes.ChatResponseFileTreePart,
      ChatResponseAnchorPart: extHostTypes.ChatResponseAnchorPart,
      ChatResponseProgressPart: extHostTypes.ChatResponseProgressPart,
      ChatResponseProgressPart2: extHostTypes.ChatResponseProgressPart2,
      ChatResponseReferencePart: extHostTypes.ChatResponseReferencePart,
      ChatResponseReferencePart2: extHostTypes.ChatResponseReferencePart,
      ChatResponseCodeCitationPart: extHostTypes.ChatResponseCodeCitationPart,
      ChatResponseCodeblockUriPart: extHostTypes.ChatResponseCodeblockUriPart,
      ChatResponseWarningPart: extHostTypes.ChatResponseWarningPart,
      ChatResponseTextEditPart: extHostTypes.ChatResponseTextEditPart,
      ChatResponseNotebookEditPart: extHostTypes.ChatResponseNotebookEditPart,
      ChatResponseMarkdownWithVulnerabilitiesPart: extHostTypes.ChatResponseMarkdownWithVulnerabilitiesPart,
      ChatResponseCommandButtonPart: extHostTypes.ChatResponseCommandButtonPart,
      ChatResponseConfirmationPart: extHostTypes.ChatResponseConfirmationPart,
      ChatResponseMovePart: extHostTypes.ChatResponseMovePart,
      ChatResponseReferencePartStatusKind: extHostTypes.ChatResponseReferencePartStatusKind,
      ChatRequestTurn: extHostTypes.ChatRequestTurn,
      ChatResponseTurn: extHostTypes.ChatResponseTurn,
      ChatLocation: extHostTypes.ChatLocation,
      ChatRequestEditorData: extHostTypes.ChatRequestEditorData,
      ChatRequestNotebookData: extHostTypes.ChatRequestNotebookData,
      ChatReferenceBinaryData: extHostTypes.ChatReferenceBinaryData,
      LanguageModelChatMessageRole: extHostTypes.LanguageModelChatMessageRole,
      LanguageModelChatMessage: extHostTypes.LanguageModelChatMessage,
      LanguageModelChatMessage2: extHostTypes.LanguageModelChatMessage2,
      LanguageModelToolResultPart: extHostTypes.LanguageModelToolResultPart,
      LanguageModelTextPart: extHostTypes.LanguageModelTextPart,
      LanguageModelToolCallPart: extHostTypes.LanguageModelToolCallPart,
      LanguageModelError: extHostTypes.LanguageModelError,
      LanguageModelToolResult: extHostTypes.LanguageModelToolResult,
      LanguageModelDataPart: extHostTypes.LanguageModelDataPart,
      ChatImageMimeType: extHostTypes.ChatImageMimeType,
      ExtendedLanguageModelToolResult: extHostTypes.ExtendedLanguageModelToolResult,
      PreparedTerminalToolInvocation: extHostTypes.PreparedTerminalToolInvocation,
      LanguageModelChatToolMode: extHostTypes.LanguageModelChatToolMode,
      LanguageModelPromptTsxPart: extHostTypes.LanguageModelPromptTsxPart,
      NewSymbolName: extHostTypes.NewSymbolName,
      NewSymbolNameTag: extHostTypes.NewSymbolNameTag,
      NewSymbolNameTriggerKind: extHostTypes.NewSymbolNameTriggerKind,
      InlineEdit: extHostTypes.InlineEdit,
      InlineEditTriggerKind: extHostTypes.InlineEditTriggerKind,
      ExcludeSettingOptions,
      TextSearchContext2,
      TextSearchMatch2,
      TextSearchCompleteMessageTypeNew: TextSearchCompleteMessageType,
      ChatErrorLevel: extHostTypes.ChatErrorLevel,
      McpSSEServerDefinition: extHostTypes.McpSSEServerDefinition,
      McpStdioServerDefinition: extHostTypes.McpStdioServerDefinition
    };
  };
}
export {
  createApiFactoryAndRegisterActors
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0LmFwaS5pbXBsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHR5cGUgKiBhcyB2c2NvZGUgZnJvbSAndnNjb2RlJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCAqIGFzIGVycm9ycyBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBjb21iaW5lZERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2NoZW1hcywgbWF0Y2hlc1NjaGVtZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IFNldmVyaXR5IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3NldmVyaXR5LmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IHNjb3JlLCB0YXJnZXRzTm90ZWJvb2tzIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZVNlbGVjdG9yLmpzJztcbmltcG9ydCAqIGFzIGxhbmd1YWdlQ29uZmlndXJhdGlvbiBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgT3ZlcnZpZXdSdWxlckxhbmUgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbkVycm9yLCBFeHRlbnNpb25JZGVudGlmaWVyU2V0LCBJRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCAqIGFzIGZpbGVzIGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSwgSUxvZ2dlclNlcnZpY2UsIExvZ0xldmVsIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgZ2V0UmVtb3RlTmFtZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3JlbW90ZS9jb21tb24vcmVtb3RlSG9zdHMuanMnO1xuaW1wb3J0IHsgVGVsZW1ldHJ5VHJ1c3RlZFZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnlVdGlscy5qcyc7XG5pbXBvcnQgeyBFZGl0U2Vzc2lvbklkZW50aXR5TWF0Y2ggfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL2VkaXRTZXNzaW9ucy5qcyc7XG5pbXBvcnQgeyBEZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlclRyaWdnZXJLaW5kIH0gZnJvbSAnLi4vLi4vY29udHJpYi9kZWJ1Zy9jb21tb24vZGVidWcuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uRGVzY3JpcHRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbkRlc2NyaXB0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgVUlLaW5kIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9uSG9zdFByb3RvY29sLmpzJztcbmltcG9ydCB7IGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkLCBpc1Byb3Bvc2VkQXBpRW5hYmxlZCB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgUHJveHlJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vcHJveHlJZGVudGlmaWVyLmpzJztcbmltcG9ydCB7IEV4Y2x1ZGVTZXR0aW5nT3B0aW9ucywgVGV4dFNlYXJjaENvbXBsZXRlTWVzc2FnZVR5cGUsIFRleHRTZWFyY2hDb250ZXh0MiwgVGV4dFNlYXJjaE1hdGNoMiB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL3NlYXJjaC9jb21tb24vc2VhcmNoRXh0VHlwZXMuanMnO1xuaW1wb3J0IHsgQ2FuZGlkYXRlUG9ydFNvdXJjZSwgRXh0SG9zdENvbnRleHQsIEV4dEhvc3RMb2dMZXZlbFNlcnZpY2VTaGFwZSwgTWFpbkNvbnRleHQgfSBmcm9tICcuL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgRXh0SG9zdFJlbGF0ZWRJbmZvcm1hdGlvbiB9IGZyb20gJy4vZXh0SG9zdEFpUmVsYXRlZEluZm9ybWF0aW9uLmpzJztcbmltcG9ydCB7IEV4dEhvc3RBcGlDb21tYW5kcyB9IGZyb20gJy4vZXh0SG9zdEFwaUNvbW1hbmRzLmpzJztcbmltcG9ydCB7IElFeHRIb3N0QXBpRGVwcmVjYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi9leHRIb3N0QXBpRGVwcmVjYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRIb3N0QXV0aGVudGljYXRpb24gfSBmcm9tICcuL2V4dEhvc3RBdXRoZW50aWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0QnVsa0VkaXRzIH0gZnJvbSAnLi9leHRIb3N0QnVsa0VkaXRzLmpzJztcbmltcG9ydCB7IEV4dEhvc3RDaGF0QWdlbnRzMiB9IGZyb20gJy4vZXh0SG9zdENoYXRBZ2VudHMyLmpzJztcbmltcG9ydCB7IEV4dEhvc3RDaGF0U3RhdHVzIH0gZnJvbSAnLi9leHRIb3N0Q2hhdFN0YXR1cy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0Q2xpcGJvYXJkIH0gZnJvbSAnLi9leHRIb3N0Q2xpcGJvYXJkLmpzJztcbmltcG9ydCB7IEV4dEhvc3RFZGl0b3JJbnNldHMgfSBmcm9tICcuL2V4dEhvc3RDb2RlSW5zZXRzLmpzJztcbmltcG9ydCB7IEV4dEhvc3RDb2RlTWFwcGVyIH0gZnJvbSAnLi9leHRIb3N0Q29kZU1hcHBlci5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdENvbW1hbmRzIH0gZnJvbSAnLi9leHRIb3N0Q29tbWFuZHMuanMnO1xuaW1wb3J0IHsgY3JlYXRlRXh0SG9zdENvbW1lbnRzIH0gZnJvbSAnLi9leHRIb3N0Q29tbWVudHMuanMnO1xuaW1wb3J0IHsgRXh0SG9zdENvbmZpZ1Byb3ZpZGVyLCBJRXh0SG9zdENvbmZpZ3VyYXRpb24gfSBmcm9tICcuL2V4dEhvc3RDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEV4dEhvc3RDdXN0b21FZGl0b3JzIH0gZnJvbSAnLi9leHRIb3N0Q3VzdG9tRWRpdG9ycy5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdERlYnVnU2VydmljZSB9IGZyb20gJy4vZXh0SG9zdERlYnVnU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdERlY29yYXRpb25zIH0gZnJvbSAnLi9leHRIb3N0RGVjb3JhdGlvbnMuanMnO1xuaW1wb3J0IHsgRXh0SG9zdERpYWdub3N0aWNzIH0gZnJvbSAnLi9leHRIb3N0RGlhZ25vc3RpY3MuanMnO1xuaW1wb3J0IHsgRXh0SG9zdERpYWxvZ3MgfSBmcm9tICcuL2V4dEhvc3REaWFsb2dzLmpzJztcbmltcG9ydCB7IEV4dEhvc3REb2N1bWVudENvbnRlbnRQcm92aWRlciB9IGZyb20gJy4vZXh0SG9zdERvY3VtZW50Q29udGVudFByb3ZpZGVycy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0RG9jdW1lbnRTYXZlUGFydGljaXBhbnQgfSBmcm9tICcuL2V4dEhvc3REb2N1bWVudFNhdmVQYXJ0aWNpcGFudC5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0RG9jdW1lbnRzIH0gZnJvbSAnLi9leHRIb3N0RG9jdW1lbnRzLmpzJztcbmltcG9ydCB7IElFeHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycyB9IGZyb20gJy4vZXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RFZGl0b3JUYWJzIH0gZnJvbSAnLi9leHRIb3N0RWRpdG9yVGFicy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0RW1iZWRkaW5ncyB9IGZyb20gJy4vZXh0SG9zdEVtYmVkZGluZy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0QWlFbWJlZGRpbmdWZWN0b3IgfSBmcm9tICcuL2V4dEhvc3RFbWJlZGRpbmdWZWN0b3IuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uLCBJRXh0SG9zdEV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuL2V4dEhvc3RFeHRlbnNpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IEV4dEhvc3RGaWxlU3lzdGVtIH0gZnJvbSAnLi9leHRIb3N0RmlsZVN5c3RlbS5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdENvbnN1bWVyRmlsZVN5c3RlbSB9IGZyb20gJy4vZXh0SG9zdEZpbGVTeXN0ZW1Db25zdW1lci5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0RmlsZVN5c3RlbUV2ZW50U2VydmljZSwgRmlsZVN5c3RlbVdhdGNoZXJDcmVhdGVPcHRpb25zIH0gZnJvbSAnLi9leHRIb3N0RmlsZVN5c3RlbUV2ZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdEZpbGVTeXN0ZW1JbmZvIH0gZnJvbSAnLi9leHRIb3N0RmlsZVN5c3RlbUluZm8uanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RJbml0RGF0YVNlcnZpY2UgfSBmcm9tICcuL2V4dEhvc3RJbml0RGF0YVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRXh0SG9zdEludGVyYWN0aXZlIH0gZnJvbSAnLi9leHRIb3N0SW50ZXJhY3RpdmUuanMnO1xuaW1wb3J0IHsgRXh0SG9zdExhYmVsU2VydmljZSB9IGZyb20gJy4vZXh0SG9zdExhYmVsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcyB9IGZyb20gJy4vZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgRXh0SG9zdExhbmd1YWdlTW9kZWxUb29scyB9IGZyb20gJy4vZXh0SG9zdExhbmd1YWdlTW9kZWxUb29scy5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdExhbmd1YWdlTW9kZWxzIH0gZnJvbSAnLi9leHRIb3N0TGFuZ3VhZ2VNb2RlbHMuanMnO1xuaW1wb3J0IHsgRXh0SG9zdExhbmd1YWdlcyB9IGZyb20gJy4vZXh0SG9zdExhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdExvY2FsaXphdGlvblNlcnZpY2UgfSBmcm9tICcuL2V4dEhvc3RMb2NhbGl6YXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRIb3N0TWFuYWdlZFNvY2tldHMgfSBmcm9tICcuL2V4dEhvc3RNYW5hZ2VkU29ja2V0cy5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdE1wY1NlcnZpY2UgfSBmcm9tICcuL2V4dEhvc3RNY3AuanMnO1xuaW1wb3J0IHsgRXh0SG9zdE1lc3NhZ2VTZXJ2aWNlIH0gZnJvbSAnLi9leHRIb3N0TWVzc2FnZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRXh0SG9zdE5vdGVib29rQ29udHJvbGxlciB9IGZyb20gJy4vZXh0SG9zdE5vdGVib29rLmpzJztcbmltcG9ydCB7IEV4dEhvc3ROb3RlYm9va0RvY3VtZW50U2F2ZVBhcnRpY2lwYW50IH0gZnJvbSAnLi9leHRIb3N0Tm90ZWJvb2tEb2N1bWVudFNhdmVQYXJ0aWNpcGFudC5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0Tm90ZWJvb2tEb2N1bWVudHMgfSBmcm9tICcuL2V4dEhvc3ROb3RlYm9va0RvY3VtZW50cy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0Tm90ZWJvb2tFZGl0b3JzIH0gZnJvbSAnLi9leHRIb3N0Tm90ZWJvb2tFZGl0b3JzLmpzJztcbmltcG9ydCB7IEV4dEhvc3ROb3RlYm9va0tlcm5lbHMgfSBmcm9tICcuL2V4dEhvc3ROb3RlYm9va0tlcm5lbHMuanMnO1xuaW1wb3J0IHsgRXh0SG9zdE5vdGVib29rUmVuZGVyZXJzIH0gZnJvbSAnLi9leHRIb3N0Tm90ZWJvb2tSZW5kZXJlcnMuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RPdXRwdXRTZXJ2aWNlIH0gZnJvbSAnLi9leHRIb3N0T3V0cHV0LmpzJztcbmltcG9ydCB7IEV4dEhvc3RQcm9maWxlQ29udGVudEhhbmRsZXJzIH0gZnJvbSAnLi9leHRIb3N0UHJvZmlsZUNvbnRlbnRIYW5kbGVyLmpzJztcbmltcG9ydCB7IEV4dEhvc3RQcm9ncmVzcyB9IGZyb20gJy4vZXh0SG9zdFByb2dyZXNzLmpzJztcbmltcG9ydCB7IEV4dEhvc3RRdWlja0RpZmYgfSBmcm9tICcuL2V4dEhvc3RRdWlja0RpZmYuanMnO1xuaW1wb3J0IHsgY3JlYXRlRXh0SG9zdFF1aWNrT3BlbiB9IGZyb20gJy4vZXh0SG9zdFF1aWNrT3Blbi5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdFJwY1NlcnZpY2UgfSBmcm9tICcuL2V4dEhvc3RScGNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEV4dEhvc3RTQ00gfSBmcm9tICcuL2V4dEhvc3RTQ00uanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RTZWFyY2ggfSBmcm9tICcuL2V4dEhvc3RTZWFyY2guanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RTZWNyZXRTdGF0ZSB9IGZyb20gJy4vZXh0SG9zdFNlY3JldFN0YXRlLmpzJztcbmltcG9ydCB7IEV4dEhvc3RTaGFyZSB9IGZyb20gJy4vZXh0SG9zdFNoYXJlLmpzJztcbmltcG9ydCB7IEV4dEhvc3RTcGVlY2ggfSBmcm9tICcuL2V4dEhvc3RTcGVlY2guanMnO1xuaW1wb3J0IHsgRXh0SG9zdFN0YXR1c0JhciB9IGZyb20gJy4vZXh0SG9zdFN0YXR1c0Jhci5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdFN0b3JhZ2UgfSBmcm9tICcuL2V4dEhvc3RTdG9yYWdlLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TdG9yYWdlUGF0aHMgfSBmcm9tICcuL2V4dEhvc3RTdG9yYWdlUGF0aHMuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RUYXNrIH0gZnJvbSAnLi9leHRIb3N0VGFzay5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0VGVsZW1ldHJ5TG9nZ2VyLCBJRXh0SG9zdFRlbGVtZXRyeSwgaXNOZXdBcHBJbnN0YWxsIH0gZnJvbSAnLi9leHRIb3N0VGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElFeHRIb3N0VGVybWluYWxTZXJ2aWNlIH0gZnJvbSAnLi9leHRIb3N0VGVybWluYWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRIb3N0VGVybWluYWxTaGVsbEludGVncmF0aW9uIH0gZnJvbSAnLi9leHRIb3N0VGVybWluYWxTaGVsbEludGVncmF0aW9uLmpzJztcbmltcG9ydCB7IElFeHRIb3N0VGVzdGluZyB9IGZyb20gJy4vZXh0SG9zdFRlc3RpbmcuanMnO1xuaW1wb3J0IHsgRXh0SG9zdEVkaXRvcnMgfSBmcm9tICcuL2V4dEhvc3RUZXh0RWRpdG9ycy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0VGhlbWluZyB9IGZyb20gJy4vZXh0SG9zdFRoZW1pbmcuanMnO1xuaW1wb3J0IHsgRXh0SG9zdFRpbWVsaW5lIH0gZnJvbSAnLi9leHRIb3N0VGltZWxpbmUuanMnO1xuaW1wb3J0IHsgRXh0SG9zdFRyZWVWaWV3cyB9IGZyb20gJy4vZXh0SG9zdFRyZWVWaWV3cy5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdFR1bm5lbFNlcnZpY2UgfSBmcm9tICcuL2V4dEhvc3RUdW5uZWxTZXJ2aWNlLmpzJztcbmltcG9ydCAqIGFzIHR5cGVDb252ZXJ0ZXJzIGZyb20gJy4vZXh0SG9zdFR5cGVDb252ZXJ0ZXJzLmpzJztcbmltcG9ydCAqIGFzIGV4dEhvc3RUeXBlcyBmcm9tICcuL2V4dEhvc3RUeXBlcy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0VXJpT3BlbmVycyB9IGZyb20gJy4vZXh0SG9zdFVyaU9wZW5lci5qcyc7XG5pbXBvcnQgeyBJVVJJVHJhbnNmb3JtZXJTZXJ2aWNlIH0gZnJvbSAnLi9leHRIb3N0VXJpVHJhbnNmb3JtZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEV4dEhvc3RVcmxzIH0gZnJvbSAnLi9leHRIb3N0VXJscy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0V2Vidmlld3MgfSBmcm9tICcuL2V4dEhvc3RXZWJ2aWV3LmpzJztcbmltcG9ydCB7IEV4dEhvc3RXZWJ2aWV3UGFuZWxzIH0gZnJvbSAnLi9leHRIb3N0V2Vidmlld1BhbmVscy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0V2Vidmlld1ZpZXdzIH0gZnJvbSAnLi9leHRIb3N0V2Vidmlld1ZpZXcuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RXaW5kb3cgfSBmcm9tICcuL2V4dEhvc3RXaW5kb3cuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RXb3Jrc3BhY2UgfSBmcm9tICcuL2V4dEhvc3RXb3Jrc3BhY2UuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElFeHRlbnNpb25SZWdpc3RyaWVzIHtcblx0bWluZTogRXh0ZW5zaW9uRGVzY3JpcHRpb25SZWdpc3RyeTtcblx0YWxsOiBFeHRlbnNpb25EZXNjcmlwdGlvblJlZ2lzdHJ5O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElFeHRlbnNpb25BcGlGYWN0b3J5IHtcblx0KGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBleHRlbnNpb25JbmZvOiBJRXh0ZW5zaW9uUmVnaXN0cmllcywgY29uZmlnUHJvdmlkZXI6IEV4dEhvc3RDb25maWdQcm92aWRlcik6IHR5cGVvZiB2c2NvZGU7XG59XG5cbi8qKlxuICogVGhpcyBtZXRob2QgaW5zdGFudGlhdGVzIGFuZCByZXR1cm5zIHRoZSBleHRlbnNpb24gQVBJIHN1cmZhY2VcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUFwaUZhY3RvcnlBbmRSZWdpc3RlckFjdG9ycyhhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcik6IElFeHRlbnNpb25BcGlGYWN0b3J5IHtcblxuXHQvLyBzZXJ2aWNlc1xuXHRjb25zdCBpbml0RGF0YSA9IGFjY2Vzc29yLmdldChJRXh0SG9zdEluaXREYXRhU2VydmljZSk7XG5cdGNvbnN0IGV4dEhvc3RGaWxlU3lzdGVtSW5mbyA9IGFjY2Vzc29yLmdldChJRXh0SG9zdEZpbGVTeXN0ZW1JbmZvKTtcblx0Y29uc3QgZXh0SG9zdENvbnN1bWVyRmlsZVN5c3RlbSA9IGFjY2Vzc29yLmdldChJRXh0SG9zdENvbnN1bWVyRmlsZVN5c3RlbSk7XG5cdGNvbnN0IGV4dGVuc2lvblNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4dEhvc3RFeHRlbnNpb25TZXJ2aWNlKTtcblx0Y29uc3QgZXh0SG9zdFdvcmtzcGFjZSA9IGFjY2Vzc29yLmdldChJRXh0SG9zdFdvcmtzcGFjZSk7XG5cdGNvbnN0IGV4dEhvc3RUZWxlbWV0cnkgPSBhY2Nlc3Nvci5nZXQoSUV4dEhvc3RUZWxlbWV0cnkpO1xuXHRjb25zdCBleHRIb3N0Q29uZmlndXJhdGlvbiA9IGFjY2Vzc29yLmdldChJRXh0SG9zdENvbmZpZ3VyYXRpb24pO1xuXHRjb25zdCB1cmlUcmFuc2Zvcm1lciA9IGFjY2Vzc29yLmdldChJVVJJVHJhbnNmb3JtZXJTZXJ2aWNlKTtcblx0Y29uc3QgcnBjUHJvdG9jb2wgPSBhY2Nlc3Nvci5nZXQoSUV4dEhvc3RScGNTZXJ2aWNlKTtcblx0Y29uc3QgZXh0SG9zdFN0b3JhZ2UgPSBhY2Nlc3Nvci5nZXQoSUV4dEhvc3RTdG9yYWdlKTtcblx0Y29uc3QgZXh0ZW5zaW9uU3RvcmFnZVBhdGhzID0gYWNjZXNzb3IuZ2V0KElFeHRlbnNpb25TdG9yYWdlUGF0aHMpO1xuXHRjb25zdCBleHRIb3N0TG9nZ2VyU2VydmljZSA9IGFjY2Vzc29yLmdldChJTG9nZ2VyU2VydmljZSk7XG5cdGNvbnN0IGV4dEhvc3RMb2dTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMb2dTZXJ2aWNlKTtcblx0Y29uc3QgZXh0SG9zdFR1bm5lbFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUV4dEhvc3RUdW5uZWxTZXJ2aWNlKTtcblx0Y29uc3QgZXh0SG9zdEFwaURlcHJlY2F0aW9uID0gYWNjZXNzb3IuZ2V0KElFeHRIb3N0QXBpRGVwcmVjYXRpb25TZXJ2aWNlKTtcblx0Y29uc3QgZXh0SG9zdFdpbmRvdyA9IGFjY2Vzc29yLmdldChJRXh0SG9zdFdpbmRvdyk7XG5cdGNvbnN0IGV4dEhvc3RTZWNyZXRTdGF0ZSA9IGFjY2Vzc29yLmdldChJRXh0SG9zdFNlY3JldFN0YXRlKTtcblx0Y29uc3QgZXh0SG9zdEVkaXRvclRhYnMgPSBhY2Nlc3Nvci5nZXQoSUV4dEhvc3RFZGl0b3JUYWJzKTtcblx0Y29uc3QgZXh0SG9zdE1hbmFnZWRTb2NrZXRzID0gYWNjZXNzb3IuZ2V0KElFeHRIb3N0TWFuYWdlZFNvY2tldHMpO1xuXHRjb25zdCBleHRIb3N0QXV0aGVudGljYXRpb24gPSBhY2Nlc3Nvci5nZXQoSUV4dEhvc3RBdXRoZW50aWNhdGlvbik7XG5cdGNvbnN0IGV4dEhvc3RMYW5ndWFnZU1vZGVscyA9IGFjY2Vzc29yLmdldChJRXh0SG9zdExhbmd1YWdlTW9kZWxzKTtcblx0Y29uc3QgZXh0SG9zdE1jcCA9IGFjY2Vzc29yLmdldChJRXh0SG9zdE1wY1NlcnZpY2UpO1xuXG5cdC8vIHJlZ2lzdGVyIGFkZHJlc3NhYmxlIGluc3RhbmNlc1xuXHRycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdEZpbGVTeXN0ZW1JbmZvLCBleHRIb3N0RmlsZVN5c3RlbUluZm8pO1xuXHRycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdExvZ0xldmVsU2VydmljZVNoYXBlLCA8RXh0SG9zdExvZ0xldmVsU2VydmljZVNoYXBlPjxhbnk+ZXh0SG9zdExvZ2dlclNlcnZpY2UpO1xuXHRycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdFdvcmtzcGFjZSwgZXh0SG9zdFdvcmtzcGFjZSk7XG5cdHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0Q29uZmlndXJhdGlvbiwgZXh0SG9zdENvbmZpZ3VyYXRpb24pO1xuXHRycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdEV4dGVuc2lvblNlcnZpY2UsIGV4dGVuc2lvblNlcnZpY2UpO1xuXHRycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdFN0b3JhZ2UsIGV4dEhvc3RTdG9yYWdlKTtcblx0cnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RUdW5uZWxTZXJ2aWNlLCBleHRIb3N0VHVubmVsU2VydmljZSk7XG5cdHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0V2luZG93LCBleHRIb3N0V2luZG93KTtcblx0cnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RTZWNyZXRTdGF0ZSwgZXh0SG9zdFNlY3JldFN0YXRlKTtcblx0cnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RUZWxlbWV0cnksIGV4dEhvc3RUZWxlbWV0cnkpO1xuXHRycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdEVkaXRvclRhYnMsIGV4dEhvc3RFZGl0b3JUYWJzKTtcblx0cnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RNYW5hZ2VkU29ja2V0cywgZXh0SG9zdE1hbmFnZWRTb2NrZXRzKTtcblx0cnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RBdXRoZW50aWNhdGlvbiwgZXh0SG9zdEF1dGhlbnRpY2F0aW9uKTtcblx0cnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RDaGF0UHJvdmlkZXIsIGV4dEhvc3RMYW5ndWFnZU1vZGVscyk7XG5cblx0Ly8gYXV0b21hdGljYWxseSBjcmVhdGUgYW5kIHJlZ2lzdGVyIGFkZHJlc3NhYmxlIGluc3RhbmNlc1xuXHRjb25zdCBleHRIb3N0RGVjb3JhdGlvbnMgPSBycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdERlY29yYXRpb25zLCBhY2Nlc3Nvci5nZXQoSUV4dEhvc3REZWNvcmF0aW9ucykpO1xuXHRjb25zdCBleHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycyA9IHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycywgYWNjZXNzb3IuZ2V0KElFeHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycykpO1xuXHRjb25zdCBleHRIb3N0Q29tbWFuZHMgPSBycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdENvbW1hbmRzLCBhY2Nlc3Nvci5nZXQoSUV4dEhvc3RDb21tYW5kcykpO1xuXHRjb25zdCBleHRIb3N0VGVybWluYWxTZXJ2aWNlID0gcnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RUZXJtaW5hbFNlcnZpY2UsIGFjY2Vzc29yLmdldChJRXh0SG9zdFRlcm1pbmFsU2VydmljZSkpO1xuXHRjb25zdCBleHRIb3N0VGVybWluYWxTaGVsbEludGVncmF0aW9uID0gcnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RUZXJtaW5hbFNoZWxsSW50ZWdyYXRpb24sIGFjY2Vzc29yLmdldChJRXh0SG9zdFRlcm1pbmFsU2hlbGxJbnRlZ3JhdGlvbikpO1xuXHRjb25zdCBleHRIb3N0RGVidWdTZXJ2aWNlID0gcnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3REZWJ1Z1NlcnZpY2UsIGFjY2Vzc29yLmdldChJRXh0SG9zdERlYnVnU2VydmljZSkpO1xuXHRjb25zdCBleHRIb3N0U2VhcmNoID0gcnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RTZWFyY2gsIGFjY2Vzc29yLmdldChJRXh0SG9zdFNlYXJjaCkpO1xuXHRjb25zdCBleHRIb3N0VGFzayA9IHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0VGFzaywgYWNjZXNzb3IuZ2V0KElFeHRIb3N0VGFzaykpO1xuXHRjb25zdCBleHRIb3N0T3V0cHV0U2VydmljZSA9IHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0T3V0cHV0U2VydmljZSwgYWNjZXNzb3IuZ2V0KElFeHRIb3N0T3V0cHV0U2VydmljZSkpO1xuXHRjb25zdCBleHRIb3N0TG9jYWxpemF0aW9uID0gcnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RMb2NhbGl6YXRpb24sIGFjY2Vzc29yLmdldChJRXh0SG9zdExvY2FsaXphdGlvblNlcnZpY2UpKTtcblxuXHQvLyBtYW51YWxseSBjcmVhdGUgYW5kIHJlZ2lzdGVyIGFkZHJlc3NhYmxlIGluc3RhbmNlc1xuXHRjb25zdCBleHRIb3N0VXJscyA9IHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0VXJscywgbmV3IEV4dEhvc3RVcmxzKHJwY1Byb3RvY29sKSk7XG5cdGNvbnN0IGV4dEhvc3REb2N1bWVudHMgPSBycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdERvY3VtZW50cywgbmV3IEV4dEhvc3REb2N1bWVudHMocnBjUHJvdG9jb2wsIGV4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzKSk7XG5cdGNvbnN0IGV4dEhvc3REb2N1bWVudENvbnRlbnRQcm92aWRlcnMgPSBycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdERvY3VtZW50Q29udGVudFByb3ZpZGVycywgbmV3IEV4dEhvc3REb2N1bWVudENvbnRlbnRQcm92aWRlcihycGNQcm90b2NvbCwgZXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMsIGV4dEhvc3RMb2dTZXJ2aWNlKSk7XG5cdGNvbnN0IGV4dEhvc3REb2N1bWVudFNhdmVQYXJ0aWNpcGFudCA9IHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0RG9jdW1lbnRTYXZlUGFydGljaXBhbnQsIG5ldyBFeHRIb3N0RG9jdW1lbnRTYXZlUGFydGljaXBhbnQoZXh0SG9zdExvZ1NlcnZpY2UsIGV4dEhvc3REb2N1bWVudHMsIHJwY1Byb3RvY29sLmdldFByb3h5KE1haW5Db250ZXh0Lk1haW5UaHJlYWRCdWxrRWRpdHMpKSk7XG5cdGNvbnN0IGV4dEhvc3ROb3RlYm9vayA9IHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0Tm90ZWJvb2ssIG5ldyBFeHRIb3N0Tm90ZWJvb2tDb250cm9sbGVyKHJwY1Byb3RvY29sLCBleHRIb3N0Q29tbWFuZHMsIGV4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzLCBleHRIb3N0RG9jdW1lbnRzLCBleHRIb3N0Q29uc3VtZXJGaWxlU3lzdGVtLCBleHRIb3N0U2VhcmNoLCBleHRIb3N0TG9nU2VydmljZSkpO1xuXHRjb25zdCBleHRIb3N0Tm90ZWJvb2tEb2N1bWVudHMgPSBycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdE5vdGVib29rRG9jdW1lbnRzLCBuZXcgRXh0SG9zdE5vdGVib29rRG9jdW1lbnRzKGV4dEhvc3ROb3RlYm9vaykpO1xuXHRjb25zdCBleHRIb3N0Tm90ZWJvb2tFZGl0b3JzID0gcnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3ROb3RlYm9va0VkaXRvcnMsIG5ldyBFeHRIb3N0Tm90ZWJvb2tFZGl0b3JzKGV4dEhvc3RMb2dTZXJ2aWNlLCBleHRIb3N0Tm90ZWJvb2spKTtcblx0Y29uc3QgZXh0SG9zdE5vdGVib29rS2VybmVscyA9IHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0Tm90ZWJvb2tLZXJuZWxzLCBuZXcgRXh0SG9zdE5vdGVib29rS2VybmVscyhycGNQcm90b2NvbCwgaW5pdERhdGEsIGV4dEhvc3ROb3RlYm9vaywgZXh0SG9zdENvbW1hbmRzLCBleHRIb3N0TG9nU2VydmljZSkpO1xuXHRjb25zdCBleHRIb3N0Tm90ZWJvb2tSZW5kZXJlcnMgPSBycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdE5vdGVib29rUmVuZGVyZXJzLCBuZXcgRXh0SG9zdE5vdGVib29rUmVuZGVyZXJzKHJwY1Byb3RvY29sLCBleHRIb3N0Tm90ZWJvb2spKTtcblx0Y29uc3QgZXh0SG9zdE5vdGVib29rRG9jdW1lbnRTYXZlUGFydGljaXBhbnQgPSBycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdE5vdGVib29rRG9jdW1lbnRTYXZlUGFydGljaXBhbnQsIG5ldyBFeHRIb3N0Tm90ZWJvb2tEb2N1bWVudFNhdmVQYXJ0aWNpcGFudChleHRIb3N0TG9nU2VydmljZSwgZXh0SG9zdE5vdGVib29rLCBycGNQcm90b2NvbC5nZXRQcm94eShNYWluQ29udGV4dC5NYWluVGhyZWFkQnVsa0VkaXRzKSkpO1xuXHRjb25zdCBleHRIb3N0RWRpdG9ycyA9IHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0RWRpdG9ycywgbmV3IEV4dEhvc3RFZGl0b3JzKHJwY1Byb3RvY29sLCBleHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycykpO1xuXHRjb25zdCBleHRIb3N0VHJlZVZpZXdzID0gcnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RUcmVlVmlld3MsIG5ldyBFeHRIb3N0VHJlZVZpZXdzKHJwY1Byb3RvY29sLmdldFByb3h5KE1haW5Db250ZXh0Lk1haW5UaHJlYWRUcmVlVmlld3MpLCBleHRIb3N0Q29tbWFuZHMsIGV4dEhvc3RMb2dTZXJ2aWNlKSk7XG5cdGNvbnN0IGV4dEhvc3RFZGl0b3JJbnNldHMgPSBycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdEVkaXRvckluc2V0cywgbmV3IEV4dEhvc3RFZGl0b3JJbnNldHMocnBjUHJvdG9jb2wuZ2V0UHJveHkoTWFpbkNvbnRleHQuTWFpblRocmVhZEVkaXRvckluc2V0cyksIGV4dEhvc3RFZGl0b3JzLCBpbml0RGF0YS5yZW1vdGUpKTtcblx0Y29uc3QgZXh0SG9zdERpYWdub3N0aWNzID0gcnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3REaWFnbm9zdGljcywgbmV3IEV4dEhvc3REaWFnbm9zdGljcyhycGNQcm90b2NvbCwgZXh0SG9zdExvZ1NlcnZpY2UsIGV4dEhvc3RGaWxlU3lzdGVtSW5mbywgZXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMpKTtcblx0Y29uc3QgZXh0SG9zdExhbmd1YWdlcyA9IHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0TGFuZ3VhZ2VzLCBuZXcgRXh0SG9zdExhbmd1YWdlcyhycGNQcm90b2NvbCwgZXh0SG9zdERvY3VtZW50cywgZXh0SG9zdENvbW1hbmRzLmNvbnZlcnRlciwgdXJpVHJhbnNmb3JtZXIpKTtcblx0Y29uc3QgZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMgPSBycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdExhbmd1YWdlRmVhdHVyZXMsIG5ldyBFeHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcyhycGNQcm90b2NvbCwgdXJpVHJhbnNmb3JtZXIsIGV4dEhvc3REb2N1bWVudHMsIGV4dEhvc3RDb21tYW5kcywgZXh0SG9zdERpYWdub3N0aWNzLCBleHRIb3N0TG9nU2VydmljZSwgZXh0SG9zdEFwaURlcHJlY2F0aW9uLCBleHRIb3N0VGVsZW1ldHJ5KSk7XG5cdGNvbnN0IGV4dEhvc3RDb2RlTWFwcGVyID0gcnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RDb2RlTWFwcGVyLCBuZXcgRXh0SG9zdENvZGVNYXBwZXIocnBjUHJvdG9jb2wpKTtcblx0Y29uc3QgZXh0SG9zdEZpbGVTeXN0ZW0gPSBycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdEZpbGVTeXN0ZW0sIG5ldyBFeHRIb3N0RmlsZVN5c3RlbShycGNQcm90b2NvbCwgZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMpKTtcblx0Y29uc3QgZXh0SG9zdEZpbGVTeXN0ZW1FdmVudCA9IHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0RmlsZVN5c3RlbUV2ZW50U2VydmljZSwgbmV3IEV4dEhvc3RGaWxlU3lzdGVtRXZlbnRTZXJ2aWNlKHJwY1Byb3RvY29sLCBleHRIb3N0TG9nU2VydmljZSwgZXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMpKTtcblx0Y29uc3QgZXh0SG9zdFF1aWNrT3BlbiA9IHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0UXVpY2tPcGVuLCBjcmVhdGVFeHRIb3N0UXVpY2tPcGVuKHJwY1Byb3RvY29sLCBleHRIb3N0V29ya3NwYWNlLCBleHRIb3N0Q29tbWFuZHMpKTtcblx0Y29uc3QgZXh0SG9zdFNDTSA9IHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0U0NNLCBuZXcgRXh0SG9zdFNDTShycGNQcm90b2NvbCwgZXh0SG9zdENvbW1hbmRzLCBleHRIb3N0RG9jdW1lbnRzLCBleHRIb3N0TG9nU2VydmljZSkpO1xuXHRjb25zdCBleHRIb3N0UXVpY2tEaWZmID0gcnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RRdWlja0RpZmYsIG5ldyBFeHRIb3N0UXVpY2tEaWZmKHJwY1Byb3RvY29sLCB1cmlUcmFuc2Zvcm1lcikpO1xuXHRjb25zdCBleHRIb3N0U2hhcmUgPSBycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdFNoYXJlLCBuZXcgRXh0SG9zdFNoYXJlKHJwY1Byb3RvY29sLCB1cmlUcmFuc2Zvcm1lcikpO1xuXHRjb25zdCBleHRIb3N0Q29tbWVudCA9IHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0Q29tbWVudHMsIGNyZWF0ZUV4dEhvc3RDb21tZW50cyhycGNQcm90b2NvbCwgZXh0SG9zdENvbW1hbmRzLCBleHRIb3N0RG9jdW1lbnRzKSk7XG5cdGNvbnN0IGV4dEhvc3RQcm9ncmVzcyA9IHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0UHJvZ3Jlc3MsIG5ldyBFeHRIb3N0UHJvZ3Jlc3MocnBjUHJvdG9jb2wuZ2V0UHJveHkoTWFpbkNvbnRleHQuTWFpblRocmVhZFByb2dyZXNzKSkpO1xuXHRjb25zdCBleHRIb3N0TGFiZWxTZXJ2aWNlID0gcnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RMYWJlbFNlcnZpY2UsIG5ldyBFeHRIb3N0TGFiZWxTZXJ2aWNlKHJwY1Byb3RvY29sKSk7XG5cdGNvbnN0IGV4dEhvc3RUaGVtaW5nID0gcnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RUaGVtaW5nLCBuZXcgRXh0SG9zdFRoZW1pbmcocnBjUHJvdG9jb2wpKTtcblx0Y29uc3QgZXh0SG9zdFRpbWVsaW5lID0gcnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RUaW1lbGluZSwgbmV3IEV4dEhvc3RUaW1lbGluZShycGNQcm90b2NvbCwgZXh0SG9zdENvbW1hbmRzKSk7XG5cdGNvbnN0IGV4dEhvc3RXZWJ2aWV3cyA9IHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0V2Vidmlld3MsIG5ldyBFeHRIb3N0V2Vidmlld3MocnBjUHJvdG9jb2wsIGluaXREYXRhLnJlbW90ZSwgZXh0SG9zdFdvcmtzcGFjZSwgZXh0SG9zdExvZ1NlcnZpY2UsIGV4dEhvc3RBcGlEZXByZWNhdGlvbikpO1xuXHRjb25zdCBleHRIb3N0V2Vidmlld1BhbmVscyA9IHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0V2Vidmlld1BhbmVscywgbmV3IEV4dEhvc3RXZWJ2aWV3UGFuZWxzKHJwY1Byb3RvY29sLCBleHRIb3N0V2Vidmlld3MsIGV4dEhvc3RXb3Jrc3BhY2UpKTtcblx0Y29uc3QgZXh0SG9zdEN1c3RvbUVkaXRvcnMgPSBycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdEN1c3RvbUVkaXRvcnMsIG5ldyBFeHRIb3N0Q3VzdG9tRWRpdG9ycyhycGNQcm90b2NvbCwgZXh0SG9zdERvY3VtZW50cywgZXh0ZW5zaW9uU3RvcmFnZVBhdGhzLCBleHRIb3N0V2Vidmlld3MsIGV4dEhvc3RXZWJ2aWV3UGFuZWxzKSk7XG5cdGNvbnN0IGV4dEhvc3RXZWJ2aWV3Vmlld3MgPSBycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdFdlYnZpZXdWaWV3cywgbmV3IEV4dEhvc3RXZWJ2aWV3Vmlld3MocnBjUHJvdG9jb2wsIGV4dEhvc3RXZWJ2aWV3cykpO1xuXHRjb25zdCBleHRIb3N0VGVzdGluZyA9IHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0VGVzdGluZywgYWNjZXNzb3IuZ2V0KElFeHRIb3N0VGVzdGluZykpO1xuXHRjb25zdCBleHRIb3N0VXJpT3BlbmVycyA9IHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0VXJpT3BlbmVycywgbmV3IEV4dEhvc3RVcmlPcGVuZXJzKHJwY1Byb3RvY29sKSk7XG5cdGNvbnN0IGV4dEhvc3RQcm9maWxlQ29udGVudEhhbmRsZXJzID0gcnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RQcm9maWxlQ29udGVudEhhbmRsZXJzLCBuZXcgRXh0SG9zdFByb2ZpbGVDb250ZW50SGFuZGxlcnMocnBjUHJvdG9jb2wpKTtcblx0cnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RJbnRlcmFjdGl2ZSwgbmV3IEV4dEhvc3RJbnRlcmFjdGl2ZShycGNQcm90b2NvbCwgZXh0SG9zdE5vdGVib29rLCBleHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycywgZXh0SG9zdENvbW1hbmRzLCBleHRIb3N0TG9nU2VydmljZSkpO1xuXHRjb25zdCBleHRIb3N0TGFuZ3VhZ2VNb2RlbFRvb2xzID0gcnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RMYW5ndWFnZU1vZGVsVG9vbHMsIG5ldyBFeHRIb3N0TGFuZ3VhZ2VNb2RlbFRvb2xzKHJwY1Byb3RvY29sLCBleHRIb3N0TGFuZ3VhZ2VNb2RlbHMpKTtcblx0Y29uc3QgZXh0SG9zdENoYXRBZ2VudHMyID0gcnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RDaGF0QWdlbnRzMiwgbmV3IEV4dEhvc3RDaGF0QWdlbnRzMihycGNQcm90b2NvbCwgZXh0SG9zdExvZ1NlcnZpY2UsIGV4dEhvc3RDb21tYW5kcywgZXh0SG9zdERvY3VtZW50cywgZXh0SG9zdExhbmd1YWdlTW9kZWxzLCBleHRIb3N0RGlhZ25vc3RpY3MsIGV4dEhvc3RMYW5ndWFnZU1vZGVsVG9vbHMpKTtcblx0Y29uc3QgZXh0SG9zdEFpUmVsYXRlZEluZm9ybWF0aW9uID0gcnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RBaVJlbGF0ZWRJbmZvcm1hdGlvbiwgbmV3IEV4dEhvc3RSZWxhdGVkSW5mb3JtYXRpb24ocnBjUHJvdG9jb2wpKTtcblx0Y29uc3QgZXh0SG9zdEFpRW1iZWRkaW5nVmVjdG9yID0gcnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RBaUVtYmVkZGluZ1ZlY3RvciwgbmV3IEV4dEhvc3RBaUVtYmVkZGluZ1ZlY3RvcihycGNQcm90b2NvbCkpO1xuXHRjb25zdCBleHRIb3N0U3RhdHVzQmFyID0gcnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RTdGF0dXNCYXIsIG5ldyBFeHRIb3N0U3RhdHVzQmFyKHJwY1Byb3RvY29sLCBleHRIb3N0Q29tbWFuZHMuY29udmVydGVyKSk7XG5cdGNvbnN0IGV4dEhvc3RTcGVlY2ggPSBycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdFNwZWVjaCwgbmV3IEV4dEhvc3RTcGVlY2gocnBjUHJvdG9jb2wpKTtcblx0Y29uc3QgZXh0SG9zdEVtYmVkZGluZ3MgPSBycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdEVtYmVkZGluZ3MsIG5ldyBFeHRIb3N0RW1iZWRkaW5ncyhycGNQcm90b2NvbCkpO1xuXHRycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdE1jcCwgYWNjZXNzb3IuZ2V0KElFeHRIb3N0TXBjU2VydmljZSkpO1xuXG5cdC8vIENoZWNrIHRoYXQgbm8gbmFtZWQgY3VzdG9tZXJzIGFyZSBtaXNzaW5nXG5cdGNvbnN0IGV4cGVjdGVkID0gT2JqZWN0LnZhbHVlczxQcm94eUlkZW50aWZpZXI8YW55Pj4oRXh0SG9zdENvbnRleHQpO1xuXHRycGNQcm90b2NvbC5hc3NlcnRSZWdpc3RlcmVkKGV4cGVjdGVkKTtcblxuXHQvLyBPdGhlciBpbnN0YW5jZXNcblx0Y29uc3QgZXh0SG9zdEJ1bGtFZGl0cyA9IG5ldyBFeHRIb3N0QnVsa0VkaXRzKHJwY1Byb3RvY29sLCBleHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycyk7XG5cdGNvbnN0IGV4dEhvc3RDbGlwYm9hcmQgPSBuZXcgRXh0SG9zdENsaXBib2FyZChycGNQcm90b2NvbCk7XG5cdGNvbnN0IGV4dEhvc3RNZXNzYWdlU2VydmljZSA9IG5ldyBFeHRIb3N0TWVzc2FnZVNlcnZpY2UocnBjUHJvdG9jb2wsIGV4dEhvc3RMb2dTZXJ2aWNlKTtcblx0Y29uc3QgZXh0SG9zdERpYWxvZ3MgPSBuZXcgRXh0SG9zdERpYWxvZ3MocnBjUHJvdG9jb2wpO1xuXHRjb25zdCBleHRIb3N0Q2hhdFN0YXR1cyA9IG5ldyBFeHRIb3N0Q2hhdFN0YXR1cyhycGNQcm90b2NvbCk7XG5cblx0Ly8gUmVnaXN0ZXIgQVBJLWlzaCBjb21tYW5kc1xuXHRFeHRIb3N0QXBpQ29tbWFuZHMucmVnaXN0ZXIoZXh0SG9zdENvbW1hbmRzKTtcblxuXHRyZXR1cm4gZnVuY3Rpb24gKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBleHRlbnNpb25JbmZvOiBJRXh0ZW5zaW9uUmVnaXN0cmllcywgY29uZmlnUHJvdmlkZXI6IEV4dEhvc3RDb25maWdQcm92aWRlcik6IHR5cGVvZiB2c2NvZGUge1xuXG5cdFx0Ly8gV3JhcHMgYW4gZXZlbnQgd2l0aCBlcnJvciBoYW5kbGluZyBhbmQgdGVsZW1ldHJ5IHNvIHRoYXQgd2Uga25vdyB3aGF0IGV4dGVuc2lvbiBmYWlsc1xuXHRcdC8vIGhhbmRsaW5nIGV2ZW50cy4gVGhpcyB3aWxsIHByZXZlbnQgdXMgZnJvbSByZXBvcnRpbmcgdGhpcyBhcyBcIm91clwiIGVycm9yLXRlbGVtZXRyeSBhbmRcblx0XHQvLyBhbGxvd3MgZm9yIGJldHRlciBibGFtaW5nXG5cdFx0ZnVuY3Rpb24gX2FzRXh0ZW5zaW9uRXZlbnQ8VD4oYWN0dWFsOiB2c2NvZGUuRXZlbnQ8VD4pOiB2c2NvZGUuRXZlbnQ8VD4ge1xuXHRcdFx0cmV0dXJuIChsaXN0ZW5lciwgdGhpc0FyZ3MsIGRpc3Bvc2FibGVzKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGhhbmRsZSA9IGFjdHVhbChlID0+IHtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0bGlzdGVuZXIuY2FsbCh0aGlzQXJncywgZSk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0XHRlcnJvcnMub25VbmV4cGVjdGVkRXh0ZXJuYWxFcnJvcihuZXcgRXh0ZW5zaW9uRXJyb3IoZXh0ZW5zaW9uLmlkZW50aWZpZXIsIGVyciwgJ0ZBSUxFRCB0byBoYW5kbGUgZXZlbnQnKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0ZGlzcG9zYWJsZXM/LnB1c2goaGFuZGxlKTtcblx0XHRcdFx0cmV0dXJuIGhhbmRsZTtcblx0XHRcdH07XG5cdFx0fVxuXG5cblx0XHQvLyBDaGVjayBkb2N1bWVudCBzZWxlY3RvcnMgZm9yIGJlaW5nIG92ZXJseSBnZW5lcmljLiBUZWNobmljYWxseSB0aGlzIGlzbid0IGEgcHJvYmxlbSBidXRcblx0XHQvLyBpbiBwcmFjdGljZSBtYW55IGV4dGVuc2lvbnMgc2F5IHRoZXkgc3VwcG9ydCBgZm9vTGFuZ2AgYnV0IG5lZWQgZnMtYWNjZXNzIHRvIGRvIHNvLiBUaG9zZVxuXHRcdC8vIGV4dGVuc2lvbiBzaG91bGQgc3BlY2lmeSB0aGVuIHRoZSBgZmlsZWAtc2NoZW1lLCBlLmcuIGB7IHNjaGVtZTogJ2Zvb0xhbmcnLCBsYW5ndWFnZTogJ2Zvb0xhbmcnIH1gXG5cdFx0Ly8gV2Ugb25seSBpbmZvcm0gb25jZSwgaXQgaXMgbm90IGEgd2FybmluZyBiZWNhdXNlIHdlIGp1c3Qgd2FudCB0byByYWlzZSBhd2FyZW5lc3MgYW5kIGJlY2F1c2Vcblx0XHQvLyB3ZSBjYW5ub3Qgc2F5IGlmIHRoZSBleHRlbnNpb24gaXMgZG9pbmcgaXQgcmlnaHQgb3Igd3JvbmcuLi5cblx0XHRjb25zdCBjaGVja1NlbGVjdG9yID0gKGZ1bmN0aW9uICgpIHtcblx0XHRcdGxldCBkb25lID0gIWV4dGVuc2lvbi5pc1VuZGVyRGV2ZWxvcG1lbnQ7XG5cdFx0XHRmdW5jdGlvbiBpbmZvcm1PbmNlKCkge1xuXHRcdFx0XHRpZiAoIWRvbmUpIHtcblx0XHRcdFx0XHRleHRIb3N0TG9nU2VydmljZS5pbmZvKGBFeHRlbnNpb24gJyR7ZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWV9JyB1c2VzIGEgZG9jdW1lbnQgc2VsZWN0b3Igd2l0aG91dCBzY2hlbWUuIExlYXJuIG1vcmUgYWJvdXQgdGhpczogaHR0cHM6Ly9nby5taWNyb3NvZnQuY29tL2Z3bGluay8/bGlua2lkPTg3MjMwNWApO1xuXHRcdFx0XHRcdGRvbmUgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZnVuY3Rpb24gcGVyZm9ybShzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IpOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciB7XG5cdFx0XHRcdGlmIChBcnJheS5pc0FycmF5KHNlbGVjdG9yKSkge1xuXHRcdFx0XHRcdHNlbGVjdG9yLmZvckVhY2gocGVyZm9ybSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIHNlbGVjdG9yID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdGluZm9ybU9uY2UoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCBmaWx0ZXIgPSBzZWxlY3RvciBhcyB2c2NvZGUuRG9jdW1lbnRGaWx0ZXI7IC8vIFRPRE86IG1pY3Jvc29mdC9UeXBlU2NyaXB0IzQyNzY4XG5cdFx0XHRcdFx0aWYgKHR5cGVvZiBmaWx0ZXIuc2NoZW1lID09PSAndW5kZWZpbmVkJykge1xuXHRcdFx0XHRcdFx0aW5mb3JtT25jZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAodHlwZW9mIGZpbHRlci5leGNsdXNpdmUgPT09ICdib29sZWFuJykge1xuXHRcdFx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnZG9jdW1lbnRGaWx0ZXJzRXhjbHVzaXZlJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBzZWxlY3Rvcjtcblx0XHRcdH07XG5cdFx0fSkoKTtcblxuXHRcdGNvbnN0IGF1dGhlbnRpY2F0aW9uOiB0eXBlb2YgdnNjb2RlLmF1dGhlbnRpY2F0aW9uID0ge1xuXHRcdFx0Z2V0U2Vzc2lvbihwcm92aWRlcklkOiBzdHJpbmcsIHNjb3BlczogcmVhZG9ubHkgc3RyaW5nW10sIG9wdGlvbnM/OiB2c2NvZGUuQXV0aGVudGljYXRpb25HZXRTZXNzaW9uT3B0aW9ucykge1xuXHRcdFx0XHRpZiAoXG5cdFx0XHRcdFx0KHR5cGVvZiBvcHRpb25zPy5mb3JjZU5ld1Nlc3Npb24gPT09ICdvYmplY3QnICYmIG9wdGlvbnMuZm9yY2VOZXdTZXNzaW9uLmxlYXJuTW9yZSkgfHxcblx0XHRcdFx0XHQodHlwZW9mIG9wdGlvbnM/LmNyZWF0ZUlmTm9uZSA9PT0gJ29iamVjdCcgJiYgb3B0aW9ucy5jcmVhdGVJZk5vbmUubGVhcm5Nb3JlKVxuXHRcdFx0XHQpIHtcblx0XHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdhdXRoTGVhcm5Nb3JlJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RBdXRoZW50aWNhdGlvbi5nZXRTZXNzaW9uKGV4dGVuc2lvbiwgcHJvdmlkZXJJZCwgc2NvcGVzLCBvcHRpb25zIGFzIGFueSk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0QWNjb3VudHMocHJvdmlkZXJJZDogc3RyaW5nKSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0QXV0aGVudGljYXRpb24uZ2V0QWNjb3VudHMocHJvdmlkZXJJZCk7XG5cdFx0XHR9LFxuXHRcdFx0Ly8gVE9ETzogcmVtb3ZlIHRoaXMgYWZ0ZXIgR0hQUiBhbmQgQ29kZXNwYWNlcyBtb3ZlIG9mZiBvZiBpdFxuXHRcdFx0YXN5bmMgaGFzU2Vzc2lvbihwcm92aWRlcklkOiBzdHJpbmcsIHNjb3BlczogcmVhZG9ubHkgc3RyaW5nW10pIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnYXV0aFNlc3Npb24nKTtcblx0XHRcdFx0cmV0dXJuICEhKGF3YWl0IGV4dEhvc3RBdXRoZW50aWNhdGlvbi5nZXRTZXNzaW9uKGV4dGVuc2lvbiwgcHJvdmlkZXJJZCwgc2NvcGVzLCB7IHNpbGVudDogdHJ1ZSB9IGFzIGFueSkpO1xuXHRcdFx0fSxcblx0XHRcdGdldCBvbkRpZENoYW5nZVNlc3Npb25zKCk6IHZzY29kZS5FdmVudDx2c2NvZGUuQXV0aGVudGljYXRpb25TZXNzaW9uc0NoYW5nZUV2ZW50PiB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0QXV0aGVudGljYXRpb24uZ2V0RXh0ZW5zaW9uU2NvcGVkU2Vzc2lvbnNFdmVudChleHRlbnNpb24uaWRlbnRpZmllci52YWx1ZSkpO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyQXV0aGVudGljYXRpb25Qcm92aWRlcihpZDogc3RyaW5nLCBsYWJlbDogc3RyaW5nLCBwcm92aWRlcjogdnNjb2RlLkF1dGhlbnRpY2F0aW9uUHJvdmlkZXIsIG9wdGlvbnM/OiB2c2NvZGUuQXV0aGVudGljYXRpb25Qcm92aWRlck9wdGlvbnMpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0QXV0aGVudGljYXRpb24ucmVnaXN0ZXJBdXRoZW50aWNhdGlvblByb3ZpZGVyKGlkLCBsYWJlbCwgcHJvdmlkZXIsIG9wdGlvbnMpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvLyBuYW1lc3BhY2U6IGNvbW1hbmRzXG5cdFx0Y29uc3QgY29tbWFuZHM6IHR5cGVvZiB2c2NvZGUuY29tbWFuZHMgPSB7XG5cdFx0XHRyZWdpc3RlckNvbW1hbmQoaWQ6IHN0cmluZywgY29tbWFuZDogPFQ+KC4uLmFyZ3M6IGFueVtdKSA9PiBUIHwgVGhlbmFibGU8VD4sIHRoaXNBcmdzPzogYW55KTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdENvbW1hbmRzLnJlZ2lzdGVyQ29tbWFuZCh0cnVlLCBpZCwgY29tbWFuZCwgdGhpc0FyZ3MsIHVuZGVmaW5lZCwgZXh0ZW5zaW9uKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlclRleHRFZGl0b3JDb21tYW5kKGlkOiBzdHJpbmcsIGNhbGxiYWNrOiAodGV4dEVkaXRvcjogdnNjb2RlLlRleHRFZGl0b3IsIGVkaXQ6IHZzY29kZS5UZXh0RWRpdG9yRWRpdCwgLi4uYXJnczogYW55W10pID0+IHZvaWQsIHRoaXNBcmc/OiBhbnkpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0Q29tbWFuZHMucmVnaXN0ZXJDb21tYW5kKHRydWUsIGlkLCAoLi4uYXJnczogYW55W10pOiBhbnkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IGFjdGl2ZVRleHRFZGl0b3IgPSBleHRIb3N0RWRpdG9ycy5nZXRBY3RpdmVUZXh0RWRpdG9yKCk7XG5cdFx0XHRcdFx0aWYgKCFhY3RpdmVUZXh0RWRpdG9yKSB7XG5cdFx0XHRcdFx0XHRleHRIb3N0TG9nU2VydmljZS53YXJuKCdDYW5ub3QgZXhlY3V0ZSAnICsgaWQgKyAnIGJlY2F1c2UgdGhlcmUgaXMgbm8gYWN0aXZlIHRleHQgZWRpdG9yLicpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gYWN0aXZlVGV4dEVkaXRvci5lZGl0KChlZGl0OiB2c2NvZGUuVGV4dEVkaXRvckVkaXQpID0+IHtcblx0XHRcdFx0XHRcdGNhbGxiYWNrLmFwcGx5KHRoaXNBcmcsIFthY3RpdmVUZXh0RWRpdG9yLCBlZGl0LCAuLi5hcmdzXSk7XG5cblx0XHRcdFx0XHR9KS50aGVuKChyZXN1bHQpID0+IHtcblx0XHRcdFx0XHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRcdFx0XHRcdGV4dEhvc3RMb2dTZXJ2aWNlLndhcm4oJ0VkaXRzIGZyb20gY29tbWFuZCAnICsgaWQgKyAnIHdlcmUgbm90IGFwcGxpZWQuJyk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSwgKGVycikgPT4ge1xuXHRcdFx0XHRcdFx0ZXh0SG9zdExvZ1NlcnZpY2Uud2FybignQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgcnVubmluZyBjb21tYW5kICcgKyBpZCwgZXJyKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGV4dGVuc2lvbik7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJEaWZmSW5mb3JtYXRpb25Db21tYW5kOiAoaWQ6IHN0cmluZywgY2FsbGJhY2s6IChkaWZmOiB2c2NvZGUuTGluZUNoYW5nZVtdLCAuLi5hcmdzOiBhbnlbXSkgPT4gYW55LCB0aGlzQXJnPzogYW55KTogdnNjb2RlLkRpc3Bvc2FibGUgPT4ge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdkaWZmQ29tbWFuZCcpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdENvbW1hbmRzLnJlZ2lzdGVyQ29tbWFuZCh0cnVlLCBpZCwgYXN5bmMgKC4uLmFyZ3M6IGFueVtdKTogUHJvbWlzZTxhbnk+ID0+IHtcblx0XHRcdFx0XHRjb25zdCBhY3RpdmVUZXh0RWRpdG9yID0gZXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMuYWN0aXZlRWRpdG9yKHRydWUpO1xuXHRcdFx0XHRcdGlmICghYWN0aXZlVGV4dEVkaXRvcikge1xuXHRcdFx0XHRcdFx0ZXh0SG9zdExvZ1NlcnZpY2Uud2FybignQ2Fubm90IGV4ZWN1dGUgJyArIGlkICsgJyBiZWNhdXNlIHRoZXJlIGlzIG5vIGFjdGl2ZSB0ZXh0IGVkaXRvci4nKTtcblx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgZGlmZiA9IGF3YWl0IGV4dEhvc3RFZGl0b3JzLmdldERpZmZJbmZvcm1hdGlvbihhY3RpdmVUZXh0RWRpdG9yLmlkKTtcblx0XHRcdFx0XHRjYWxsYmFjay5hcHBseSh0aGlzQXJnLCBbZGlmZiwgLi4uYXJnc10pO1xuXHRcdFx0XHR9LCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgZXh0ZW5zaW9uKTtcblx0XHRcdH0sXG5cdFx0XHRleGVjdXRlQ29tbWFuZDxUPihpZDogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IFRoZW5hYmxlPFQ+IHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RDb21tYW5kcy5leGVjdXRlQ29tbWFuZDxUPihpZCwgLi4uYXJncyk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0Q29tbWFuZHMoZmlsdGVySW50ZXJuYWw6IGJvb2xlYW4gPSBmYWxzZSk6IFRoZW5hYmxlPHN0cmluZ1tdPiB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0Q29tbWFuZHMuZ2V0Q29tbWFuZHMoZmlsdGVySW50ZXJuYWwpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvLyBuYW1lc3BhY2U6IGVudlxuXHRcdGNvbnN0IGVudjogdHlwZW9mIHZzY29kZS5lbnYgPSB7XG5cdFx0XHRnZXQgbWFjaGluZUlkKCkgeyByZXR1cm4gaW5pdERhdGEudGVsZW1ldHJ5SW5mby5tYWNoaW5lSWQ7IH0sXG5cdFx0XHRnZXQgc2Vzc2lvbklkKCkgeyByZXR1cm4gaW5pdERhdGEudGVsZW1ldHJ5SW5mby5zZXNzaW9uSWQ7IH0sXG5cdFx0XHRnZXQgbGFuZ3VhZ2UoKSB7IHJldHVybiBpbml0RGF0YS5lbnZpcm9ubWVudC5hcHBMYW5ndWFnZTsgfSxcblx0XHRcdGdldCBhcHBOYW1lKCkgeyByZXR1cm4gaW5pdERhdGEuZW52aXJvbm1lbnQuYXBwTmFtZTsgfSxcblx0XHRcdGdldCBhcHBSb290KCkgeyByZXR1cm4gaW5pdERhdGEuZW52aXJvbm1lbnQuYXBwUm9vdD8uZnNQYXRoID8/ICcnOyB9LFxuXHRcdFx0Z2V0IGFwcEhvc3QoKSB7IHJldHVybiBpbml0RGF0YS5lbnZpcm9ubWVudC5hcHBIb3N0OyB9LFxuXHRcdFx0Z2V0IHVyaVNjaGVtZSgpIHsgcmV0dXJuIGluaXREYXRhLmVudmlyb25tZW50LmFwcFVyaVNjaGVtZTsgfSxcblx0XHRcdGdldCBjbGlwYm9hcmQoKTogdnNjb2RlLkNsaXBib2FyZCB7IHJldHVybiBleHRIb3N0Q2xpcGJvYXJkLnZhbHVlOyB9LFxuXHRcdFx0Z2V0IHNoZWxsKCkge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFRlcm1pbmFsU2VydmljZS5nZXREZWZhdWx0U2hlbGwoZmFsc2UpO1xuXHRcdFx0fSxcblx0XHRcdGdldCBvbkRpZENoYW5nZVNoZWxsKCkge1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdFRlcm1pbmFsU2VydmljZS5vbkRpZENoYW5nZVNoZWxsKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgaXNUZWxlbWV0cnlFbmFibGVkKCkge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFRlbGVtZXRyeS5nZXRUZWxlbWV0cnlDb25maWd1cmF0aW9uKCk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IG9uRGlkQ2hhbmdlVGVsZW1ldHJ5RW5hYmxlZCgpOiB2c2NvZGUuRXZlbnQ8Ym9vbGVhbj4ge1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdFRlbGVtZXRyeS5vbkRpZENoYW5nZVRlbGVtZXRyeUVuYWJsZWQpO1xuXHRcdFx0fSxcblx0XHRcdGdldCB0ZWxlbWV0cnlDb25maWd1cmF0aW9uKCk6IHZzY29kZS5UZWxlbWV0cnlDb25maWd1cmF0aW9uIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAndGVsZW1ldHJ5Jyk7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0VGVsZW1ldHJ5LmdldFRlbGVtZXRyeURldGFpbHMoKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgb25EaWRDaGFuZ2VUZWxlbWV0cnlDb25maWd1cmF0aW9uKCk6IHZzY29kZS5FdmVudDx2c2NvZGUuVGVsZW1ldHJ5Q29uZmlndXJhdGlvbj4ge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICd0ZWxlbWV0cnknKTtcblx0XHRcdFx0cmV0dXJuIF9hc0V4dGVuc2lvbkV2ZW50KGV4dEhvc3RUZWxlbWV0cnkub25EaWRDaGFuZ2VUZWxlbWV0cnlDb25maWd1cmF0aW9uKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgaXNOZXdBcHBJbnN0YWxsKCkge1xuXHRcdFx0XHRyZXR1cm4gaXNOZXdBcHBJbnN0YWxsKGluaXREYXRhLnRlbGVtZXRyeUluZm8uZmlyc3RTZXNzaW9uRGF0ZSk7XG5cdFx0XHR9LFxuXHRcdFx0Y3JlYXRlVGVsZW1ldHJ5TG9nZ2VyKHNlbmRlcjogdnNjb2RlLlRlbGVtZXRyeVNlbmRlciwgb3B0aW9ucz86IHZzY29kZS5UZWxlbWV0cnlMb2dnZXJPcHRpb25zKTogdnNjb2RlLlRlbGVtZXRyeUxvZ2dlciB7XG5cdFx0XHRcdEV4dEhvc3RUZWxlbWV0cnlMb2dnZXIudmFsaWRhdGVTZW5kZXIoc2VuZGVyKTtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RUZWxlbWV0cnkuaW5zdGFudGlhdGVMb2dnZXIoZXh0ZW5zaW9uLCBzZW5kZXIsIG9wdGlvbnMpO1xuXHRcdFx0fSxcblx0XHRcdG9wZW5FeHRlcm5hbCh1cmk6IFVSSSwgb3B0aW9ucz86IHsgYWxsb3dDb250cmlidXRlZE9wZW5lcnM/OiBib29sZWFuIHwgc3RyaW5nIH0pIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RXaW5kb3cub3BlblVyaSh1cmksIHtcblx0XHRcdFx0XHRhbGxvd1R1bm5lbGluZzogISFpbml0RGF0YS5yZW1vdGUuYXV0aG9yaXR5LFxuXHRcdFx0XHRcdGFsbG93Q29udHJpYnV0ZWRPcGVuZXJzOiBvcHRpb25zPy5hbGxvd0NvbnRyaWJ1dGVkT3BlbmVycyxcblx0XHRcdFx0fSk7XG5cdFx0XHR9LFxuXHRcdFx0YXN5bmMgYXNFeHRlcm5hbFVyaSh1cmk6IFVSSSkge1xuXHRcdFx0XHRpZiAodXJpLnNjaGVtZSA9PT0gaW5pdERhdGEuZW52aXJvbm1lbnQuYXBwVXJpU2NoZW1lKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGV4dEhvc3RVcmxzLmNyZWF0ZUFwcFVyaSh1cmkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRyZXR1cm4gYXdhaXQgZXh0SG9zdFdpbmRvdy5hc0V4dGVybmFsVXJpKHVyaSwgeyBhbGxvd1R1bm5lbGluZzogISFpbml0RGF0YS5yZW1vdGUuYXV0aG9yaXR5IH0pO1xuXHRcdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0XHRpZiAobWF0Y2hlc1NjaGVtZSh1cmksIFNjaGVtYXMuaHR0cCkgfHwgbWF0Y2hlc1NjaGVtZSh1cmksIFNjaGVtYXMuaHR0cHMpKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdXJpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRocm93IGVycjtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGdldCByZW1vdGVOYW1lKCkge1xuXHRcdFx0XHRyZXR1cm4gZ2V0UmVtb3RlTmFtZShpbml0RGF0YS5yZW1vdGUuYXV0aG9yaXR5KTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgcmVtb3RlQXV0aG9yaXR5KCkge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdyZXNvbHZlcnMnKTtcblx0XHRcdFx0cmV0dXJuIGluaXREYXRhLnJlbW90ZS5hdXRob3JpdHk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IHVpS2luZCgpIHtcblx0XHRcdFx0cmV0dXJuIGluaXREYXRhLnVpS2luZDtcblx0XHRcdH0sXG5cdFx0XHRnZXQgbG9nTGV2ZWwoKSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0TG9nU2VydmljZS5nZXRMZXZlbCgpO1xuXHRcdFx0fSxcblx0XHRcdGdldCBvbkRpZENoYW5nZUxvZ0xldmVsKCkge1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdExvZ1NlcnZpY2Uub25EaWRDaGFuZ2VMb2dMZXZlbCk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IGFwcFF1YWxpdHkoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAncmVzb2x2ZXJzJyk7XG5cdFx0XHRcdHJldHVybiBpbml0RGF0YS5xdWFsaXR5O1xuXHRcdFx0fSxcblx0XHRcdGdldCBhcHBDb21taXQoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAncmVzb2x2ZXJzJyk7XG5cdFx0XHRcdHJldHVybiBpbml0RGF0YS5jb21taXQ7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRpZiAoIWluaXREYXRhLmVudmlyb25tZW50LmV4dGVuc2lvblRlc3RzTG9jYXRpb25VUkkpIHtcblx0XHRcdC8vIGFsbG93IHRvIHBhdGNoIGVudi1mdW5jdGlvbiB3aGVuIHJ1bm5pbmcgdGVzdHNcblx0XHRcdE9iamVjdC5mcmVlemUoZW52KTtcblx0XHR9XG5cblx0XHQvLyBuYW1lc3BhY2U6IHRlc3RzXG5cdFx0Y29uc3QgdGVzdHM6IHR5cGVvZiB2c2NvZGUudGVzdHMgPSB7XG5cdFx0XHRjcmVhdGVUZXN0Q29udHJvbGxlcihwcm92aWRlciwgbGFiZWwsIHJlZnJlc2hIYW5kbGVyPzogKHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pID0+IFRoZW5hYmxlPHZvaWQ+IHwgdm9pZCkge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFRlc3RpbmcuY3JlYXRlVGVzdENvbnRyb2xsZXIoZXh0ZW5zaW9uLCBwcm92aWRlciwgbGFiZWwsIHJlZnJlc2hIYW5kbGVyKTtcblx0XHRcdH0sXG5cdFx0XHRjcmVhdGVUZXN0T2JzZXJ2ZXIoKSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ3Rlc3RPYnNlcnZlcicpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFRlc3RpbmcuY3JlYXRlVGVzdE9ic2VydmVyKCk7XG5cdFx0XHR9LFxuXHRcdFx0cnVuVGVzdHMocHJvdmlkZXIpIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAndGVzdE9ic2VydmVyJyk7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0VGVzdGluZy5ydW5UZXN0cyhwcm92aWRlcik7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJUZXN0Rm9sbG93dXBQcm92aWRlcihwcm92aWRlcikge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICd0ZXN0T2JzZXJ2ZXInKTtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RUZXN0aW5nLnJlZ2lzdGVyVGVzdEZvbGxvd3VwUHJvdmlkZXIocHJvdmlkZXIpO1xuXHRcdFx0fSxcblx0XHRcdGdldCBvbkRpZENoYW5nZVRlc3RSZXN1bHRzKCkge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICd0ZXN0T2JzZXJ2ZXInKTtcblx0XHRcdFx0cmV0dXJuIF9hc0V4dGVuc2lvbkV2ZW50KGV4dEhvc3RUZXN0aW5nLm9uUmVzdWx0c0NoYW5nZWQpO1xuXHRcdFx0fSxcblx0XHRcdGdldCB0ZXN0UmVzdWx0cygpIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAndGVzdE9ic2VydmVyJyk7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0VGVzdGluZy5yZXN1bHRzO1xuXHRcdFx0fSxcblx0XHR9O1xuXG5cdFx0Ly8gbmFtZXNwYWNlOiBleHRlbnNpb25zXG5cdFx0Y29uc3QgZXh0ZW5zaW9uS2luZCA9IGluaXREYXRhLnJlbW90ZS5pc1JlbW90ZVxuXHRcdFx0PyBleHRIb3N0VHlwZXMuRXh0ZW5zaW9uS2luZC5Xb3Jrc3BhY2Vcblx0XHRcdDogZXh0SG9zdFR5cGVzLkV4dGVuc2lvbktpbmQuVUk7XG5cblx0XHRjb25zdCBleHRlbnNpb25zOiB0eXBlb2YgdnNjb2RlLmV4dGVuc2lvbnMgPSB7XG5cdFx0XHRnZXRFeHRlbnNpb24oZXh0ZW5zaW9uSWQ6IHN0cmluZywgaW5jbHVkZUZyb21EaWZmZXJlbnRFeHRlbnNpb25Ib3N0cz86IGJvb2xlYW4pOiB2c2NvZGUuRXh0ZW5zaW9uPGFueT4gfCB1bmRlZmluZWQge1xuXHRcdFx0XHRpZiAoIWlzUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ2V4dGVuc2lvbnNBbnknKSkge1xuXHRcdFx0XHRcdGluY2x1ZGVGcm9tRGlmZmVyZW50RXh0ZW5zaW9uSG9zdHMgPSBmYWxzZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBtaW5lID0gZXh0ZW5zaW9uSW5mby5taW5lLmdldEV4dGVuc2lvbkRlc2NyaXB0aW9uKGV4dGVuc2lvbklkKTtcblx0XHRcdFx0aWYgKG1pbmUpIHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IEV4dGVuc2lvbihleHRlbnNpb25TZXJ2aWNlLCBleHRlbnNpb24uaWRlbnRpZmllciwgbWluZSwgZXh0ZW5zaW9uS2luZCwgZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChpbmNsdWRlRnJvbURpZmZlcmVudEV4dGVuc2lvbkhvc3RzKSB7XG5cdFx0XHRcdFx0Y29uc3QgZm9yZWlnbiA9IGV4dGVuc2lvbkluZm8uYWxsLmdldEV4dGVuc2lvbkRlc2NyaXB0aW9uKGV4dGVuc2lvbklkKTtcblx0XHRcdFx0XHRpZiAoZm9yZWlnbikge1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBFeHRlbnNpb24oZXh0ZW5zaW9uU2VydmljZSwgZXh0ZW5zaW9uLmlkZW50aWZpZXIsIGZvcmVpZ24sIGV4dGVuc2lvbktpbmQgLyogVE9ET0BhbGV4ZGltYSBUSElTIElTIFdST05HICovLCB0cnVlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH0sXG5cdFx0XHRnZXQgYWxsKCk6IHZzY29kZS5FeHRlbnNpb248YW55PltdIHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0OiB2c2NvZGUuRXh0ZW5zaW9uPGFueT5bXSA9IFtdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGRlc2Mgb2YgZXh0ZW5zaW9uSW5mby5taW5lLmdldEFsbEV4dGVuc2lvbkRlc2NyaXB0aW9ucygpKSB7XG5cdFx0XHRcdFx0cmVzdWx0LnB1c2gobmV3IEV4dGVuc2lvbihleHRlbnNpb25TZXJ2aWNlLCBleHRlbnNpb24uaWRlbnRpZmllciwgZGVzYywgZXh0ZW5zaW9uS2luZCwgZmFsc2UpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fSxcblx0XHRcdGdldCBhbGxBY3Jvc3NFeHRlbnNpb25Ib3N0cygpOiB2c2NvZGUuRXh0ZW5zaW9uPGFueT5bXSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ2V4dGVuc2lvbnNBbnknKTtcblx0XHRcdFx0Y29uc3QgbG9jYWwgPSBuZXcgRXh0ZW5zaW9uSWRlbnRpZmllclNldChleHRlbnNpb25JbmZvLm1pbmUuZ2V0QWxsRXh0ZW5zaW9uRGVzY3JpcHRpb25zKCkubWFwKGRlc2MgPT4gZGVzYy5pZGVudGlmaWVyKSk7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdDogdnNjb2RlLkV4dGVuc2lvbjxhbnk+W10gPSBbXTtcblx0XHRcdFx0Zm9yIChjb25zdCBkZXNjIG9mIGV4dGVuc2lvbkluZm8uYWxsLmdldEFsbEV4dGVuc2lvbkRlc2NyaXB0aW9ucygpKSB7XG5cdFx0XHRcdFx0Y29uc3QgaXNGcm9tRGlmZmVyZW50RXh0ZW5zaW9uSG9zdCA9ICFsb2NhbC5oYXMoZGVzYy5pZGVudGlmaWVyKTtcblx0XHRcdFx0XHRyZXN1bHQucHVzaChuZXcgRXh0ZW5zaW9uKGV4dGVuc2lvblNlcnZpY2UsIGV4dGVuc2lvbi5pZGVudGlmaWVyLCBkZXNjLCBleHRlbnNpb25LaW5kIC8qIFRPRE9AYWxleGRpbWEgVEhJUyBJUyBXUk9ORyAqLywgaXNGcm9tRGlmZmVyZW50RXh0ZW5zaW9uSG9zdCkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IG9uRGlkQ2hhbmdlKCkge1xuXHRcdFx0XHRpZiAoaXNQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnZXh0ZW5zaW9uc0FueScpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIF9hc0V4dGVuc2lvbkV2ZW50KEV2ZW50LmFueShleHRlbnNpb25JbmZvLm1pbmUub25EaWRDaGFuZ2UsIGV4dGVuc2lvbkluZm8uYWxsLm9uRGlkQ2hhbmdlKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIF9hc0V4dGVuc2lvbkV2ZW50KGV4dGVuc2lvbkluZm8ubWluZS5vbkRpZENoYW5nZSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8vIG5hbWVzcGFjZTogbGFuZ3VhZ2VzXG5cdFx0Y29uc3QgbGFuZ3VhZ2VzOiB0eXBlb2YgdnNjb2RlLmxhbmd1YWdlcyA9IHtcblx0XHRcdGNyZWF0ZURpYWdub3N0aWNDb2xsZWN0aW9uKG5hbWU/OiBzdHJpbmcpOiB2c2NvZGUuRGlhZ25vc3RpY0NvbGxlY3Rpb24ge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdERpYWdub3N0aWNzLmNyZWF0ZURpYWdub3N0aWNDb2xsZWN0aW9uKGV4dGVuc2lvbi5pZGVudGlmaWVyLCBuYW1lKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgb25EaWRDaGFuZ2VEaWFnbm9zdGljcygpIHtcblx0XHRcdFx0cmV0dXJuIF9hc0V4dGVuc2lvbkV2ZW50KGV4dEhvc3REaWFnbm9zdGljcy5vbkRpZENoYW5nZURpYWdub3N0aWNzKTtcblx0XHRcdH0sXG5cdFx0XHRnZXREaWFnbm9zdGljczogKHJlc291cmNlPzogdnNjb2RlLlVyaSkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gPGFueT5leHRIb3N0RGlhZ25vc3RpY3MuZ2V0RGlhZ25vc3RpY3MocmVzb3VyY2UpO1xuXHRcdFx0fSxcblx0XHRcdGdldExhbmd1YWdlcygpOiBUaGVuYWJsZTxzdHJpbmdbXT4ge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlcy5nZXRMYW5ndWFnZXMoKTtcblx0XHRcdH0sXG5cdFx0XHRzZXRUZXh0RG9jdW1lbnRMYW5ndWFnZShkb2N1bWVudDogdnNjb2RlLlRleHREb2N1bWVudCwgbGFuZ3VhZ2VJZDogc3RyaW5nKTogVGhlbmFibGU8dnNjb2RlLlRleHREb2N1bWVudD4ge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlcy5jaGFuZ2VMYW5ndWFnZShkb2N1bWVudC51cmksIGxhbmd1YWdlSWQpO1xuXHRcdFx0fSxcblx0XHRcdG1hdGNoKHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgZG9jdW1lbnQ6IHZzY29kZS5UZXh0RG9jdW1lbnQpOiBudW1iZXIge1xuXHRcdFx0XHRjb25zdCBpbnRlcmFsU2VsZWN0b3IgPSB0eXBlQ29udmVydGVycy5MYW5ndWFnZVNlbGVjdG9yLmZyb20oc2VsZWN0b3IpO1xuXHRcdFx0XHRsZXQgbm90ZWJvb2s6IHZzY29kZS5Ob3RlYm9va0RvY3VtZW50IHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAodGFyZ2V0c05vdGVib29rcyhpbnRlcmFsU2VsZWN0b3IpKSB7XG5cdFx0XHRcdFx0bm90ZWJvb2sgPSBleHRIb3N0Tm90ZWJvb2subm90ZWJvb2tEb2N1bWVudHMuZmluZCh2YWx1ZSA9PiB2YWx1ZS5hcGlOb3RlYm9vay5nZXRDZWxscygpLmZpbmQoYyA9PiBjLmRvY3VtZW50ID09PSBkb2N1bWVudCkpPy5hcGlOb3RlYm9vaztcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gc2NvcmUoaW50ZXJhbFNlbGVjdG9yLCBkb2N1bWVudC51cmksIGRvY3VtZW50Lmxhbmd1YWdlSWQsIHRydWUsIG5vdGVib29rPy51cmksIG5vdGVib29rPy5ub3RlYm9va1R5cGUpO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyQ29kZUFjdGlvbnNQcm92aWRlcihzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuQ29kZUFjdGlvblByb3ZpZGVyLCBtZXRhZGF0YT86IHZzY29kZS5Db2RlQWN0aW9uUHJvdmlkZXJNZXRhZGF0YSk6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLnJlZ2lzdGVyQ29kZUFjdGlvblByb3ZpZGVyKGV4dGVuc2lvbiwgY2hlY2tTZWxlY3RvcihzZWxlY3RvciksIHByb3ZpZGVyLCBtZXRhZGF0YSk7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJEb2N1bWVudFBhc3RlRWRpdFByb3ZpZGVyKHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5Eb2N1bWVudFBhc3RlRWRpdFByb3ZpZGVyLCBtZXRhZGF0YTogdnNjb2RlLkRvY3VtZW50UGFzdGVQcm92aWRlck1ldGFkYXRhKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMucmVnaXN0ZXJEb2N1bWVudFBhc3RlRWRpdFByb3ZpZGVyKGV4dGVuc2lvbiwgY2hlY2tTZWxlY3RvcihzZWxlY3RvciksIHByb3ZpZGVyLCBtZXRhZGF0YSk7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJDb2RlTGVuc1Byb3ZpZGVyKHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5Db2RlTGVuc1Byb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMucmVnaXN0ZXJDb2RlTGVuc1Byb3ZpZGVyKGV4dGVuc2lvbiwgY2hlY2tTZWxlY3RvcihzZWxlY3RvciksIHByb3ZpZGVyKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlckRlZmluaXRpb25Qcm92aWRlcihzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuRGVmaW5pdGlvblByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMucmVnaXN0ZXJEZWZpbml0aW9uUHJvdmlkZXIoZXh0ZW5zaW9uLCBjaGVja1NlbGVjdG9yKHNlbGVjdG9yKSwgcHJvdmlkZXIpO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyRGVjbGFyYXRpb25Qcm92aWRlcihzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuRGVjbGFyYXRpb25Qcm92aWRlcik6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLnJlZ2lzdGVyRGVjbGFyYXRpb25Qcm92aWRlcihleHRlbnNpb24sIGNoZWNrU2VsZWN0b3Ioc2VsZWN0b3IpLCBwcm92aWRlcik7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJJbXBsZW1lbnRhdGlvblByb3ZpZGVyKHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5JbXBsZW1lbnRhdGlvblByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMucmVnaXN0ZXJJbXBsZW1lbnRhdGlvblByb3ZpZGVyKGV4dGVuc2lvbiwgY2hlY2tTZWxlY3RvcihzZWxlY3RvciksIHByb3ZpZGVyKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlclR5cGVEZWZpbml0aW9uUHJvdmlkZXIoc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLlR5cGVEZWZpbml0aW9uUHJvdmlkZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcy5yZWdpc3RlclR5cGVEZWZpbml0aW9uUHJvdmlkZXIoZXh0ZW5zaW9uLCBjaGVja1NlbGVjdG9yKHNlbGVjdG9yKSwgcHJvdmlkZXIpO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVySG92ZXJQcm92aWRlcihzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuSG92ZXJQcm92aWRlcik6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLnJlZ2lzdGVySG92ZXJQcm92aWRlcihleHRlbnNpb24sIGNoZWNrU2VsZWN0b3Ioc2VsZWN0b3IpLCBwcm92aWRlciwgZXh0ZW5zaW9uLmlkZW50aWZpZXIpO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyRXZhbHVhdGFibGVFeHByZXNzaW9uUHJvdmlkZXIoc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLkV2YWx1YXRhYmxlRXhwcmVzc2lvblByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMucmVnaXN0ZXJFdmFsdWF0YWJsZUV4cHJlc3Npb25Qcm92aWRlcihleHRlbnNpb24sIGNoZWNrU2VsZWN0b3Ioc2VsZWN0b3IpLCBwcm92aWRlciwgZXh0ZW5zaW9uLmlkZW50aWZpZXIpO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVySW5saW5lVmFsdWVzUHJvdmlkZXIoc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLklubGluZVZhbHVlc1Byb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMucmVnaXN0ZXJJbmxpbmVWYWx1ZXNQcm92aWRlcihleHRlbnNpb24sIGNoZWNrU2VsZWN0b3Ioc2VsZWN0b3IpLCBwcm92aWRlciwgZXh0ZW5zaW9uLmlkZW50aWZpZXIpO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyRG9jdW1lbnRIaWdobGlnaHRQcm92aWRlcihzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuRG9jdW1lbnRIaWdobGlnaHRQcm92aWRlcik6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLnJlZ2lzdGVyRG9jdW1lbnRIaWdobGlnaHRQcm92aWRlcihleHRlbnNpb24sIGNoZWNrU2VsZWN0b3Ioc2VsZWN0b3IpLCBwcm92aWRlcik7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJNdWx0aURvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXIoc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLk11bHRpRG9jdW1lbnRIaWdobGlnaHRQcm92aWRlcik6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLnJlZ2lzdGVyTXVsdGlEb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyKGV4dGVuc2lvbiwgY2hlY2tTZWxlY3RvcihzZWxlY3RvciksIHByb3ZpZGVyKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlckxpbmtlZEVkaXRpbmdSYW5nZVByb3ZpZGVyKHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5MaW5rZWRFZGl0aW5nUmFuZ2VQcm92aWRlcik6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLnJlZ2lzdGVyTGlua2VkRWRpdGluZ1JhbmdlUHJvdmlkZXIoZXh0ZW5zaW9uLCBjaGVja1NlbGVjdG9yKHNlbGVjdG9yKSwgcHJvdmlkZXIpO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyUmVmZXJlbmNlUHJvdmlkZXIoc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLlJlZmVyZW5jZVByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMucmVnaXN0ZXJSZWZlcmVuY2VQcm92aWRlcihleHRlbnNpb24sIGNoZWNrU2VsZWN0b3Ioc2VsZWN0b3IpLCBwcm92aWRlcik7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJSZW5hbWVQcm92aWRlcihzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuUmVuYW1lUHJvdmlkZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcy5yZWdpc3RlclJlbmFtZVByb3ZpZGVyKGV4dGVuc2lvbiwgY2hlY2tTZWxlY3RvcihzZWxlY3RvciksIHByb3ZpZGVyKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3Rlck5ld1N5bWJvbE5hbWVzUHJvdmlkZXIoc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLk5ld1N5bWJvbE5hbWVzUHJvdmlkZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ25ld1N5bWJvbE5hbWVzUHJvdmlkZXInKTtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLnJlZ2lzdGVyTmV3U3ltYm9sTmFtZXNQcm92aWRlcihleHRlbnNpb24sIGNoZWNrU2VsZWN0b3Ioc2VsZWN0b3IpLCBwcm92aWRlcik7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJEb2N1bWVudFN5bWJvbFByb3ZpZGVyKHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5Eb2N1bWVudFN5bWJvbFByb3ZpZGVyLCBtZXRhZGF0YT86IHZzY29kZS5Eb2N1bWVudFN5bWJvbFByb3ZpZGVyTWV0YWRhdGEpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcy5yZWdpc3RlckRvY3VtZW50U3ltYm9sUHJvdmlkZXIoZXh0ZW5zaW9uLCBjaGVja1NlbGVjdG9yKHNlbGVjdG9yKSwgcHJvdmlkZXIsIG1ldGFkYXRhKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlcldvcmtzcGFjZVN5bWJvbFByb3ZpZGVyKHByb3ZpZGVyOiB2c2NvZGUuV29ya3NwYWNlU3ltYm9sUHJvdmlkZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcy5yZWdpc3RlcldvcmtzcGFjZVN5bWJvbFByb3ZpZGVyKGV4dGVuc2lvbiwgcHJvdmlkZXIpO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyRG9jdW1lbnRGb3JtYXR0aW5nRWRpdFByb3ZpZGVyKHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5Eb2N1bWVudEZvcm1hdHRpbmdFZGl0UHJvdmlkZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcy5yZWdpc3RlckRvY3VtZW50Rm9ybWF0dGluZ0VkaXRQcm92aWRlcihleHRlbnNpb24sIGNoZWNrU2VsZWN0b3Ioc2VsZWN0b3IpLCBwcm92aWRlcik7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJEb2N1bWVudFJhbmdlRm9ybWF0dGluZ0VkaXRQcm92aWRlcihzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuRG9jdW1lbnRSYW5nZUZvcm1hdHRpbmdFZGl0UHJvdmlkZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcy5yZWdpc3RlckRvY3VtZW50UmFuZ2VGb3JtYXR0aW5nRWRpdFByb3ZpZGVyKGV4dGVuc2lvbiwgY2hlY2tTZWxlY3RvcihzZWxlY3RvciksIHByb3ZpZGVyKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3Rlck9uVHlwZUZvcm1hdHRpbmdFZGl0UHJvdmlkZXIoc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLk9uVHlwZUZvcm1hdHRpbmdFZGl0UHJvdmlkZXIsIGZpcnN0VHJpZ2dlckNoYXJhY3Rlcjogc3RyaW5nLCAuLi5tb3JlVHJpZ2dlckNoYXJhY3RlcnM6IHN0cmluZ1tdKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMucmVnaXN0ZXJPblR5cGVGb3JtYXR0aW5nRWRpdFByb3ZpZGVyKGV4dGVuc2lvbiwgY2hlY2tTZWxlY3RvcihzZWxlY3RvciksIHByb3ZpZGVyLCBbZmlyc3RUcmlnZ2VyQ2hhcmFjdGVyXS5jb25jYXQobW9yZVRyaWdnZXJDaGFyYWN0ZXJzKSk7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJEb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXIoc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLkRvY3VtZW50U2VtYW50aWNUb2tlbnNQcm92aWRlciwgbGVnZW5kOiB2c2NvZGUuU2VtYW50aWNUb2tlbnNMZWdlbmQpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcy5yZWdpc3RlckRvY3VtZW50U2VtYW50aWNUb2tlbnNQcm92aWRlcihleHRlbnNpb24sIGNoZWNrU2VsZWN0b3Ioc2VsZWN0b3IpLCBwcm92aWRlciwgbGVnZW5kKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlckRvY3VtZW50UmFuZ2VTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyKHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5Eb2N1bWVudFJhbmdlU2VtYW50aWNUb2tlbnNQcm92aWRlciwgbGVnZW5kOiB2c2NvZGUuU2VtYW50aWNUb2tlbnNMZWdlbmQpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcy5yZWdpc3RlckRvY3VtZW50UmFuZ2VTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyKGV4dGVuc2lvbiwgY2hlY2tTZWxlY3RvcihzZWxlY3RvciksIHByb3ZpZGVyLCBsZWdlbmQpO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyU2lnbmF0dXJlSGVscFByb3ZpZGVyKHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5TaWduYXR1cmVIZWxwUHJvdmlkZXIsIGZpcnN0SXRlbT86IHN0cmluZyB8IHZzY29kZS5TaWduYXR1cmVIZWxwUHJvdmlkZXJNZXRhZGF0YSwgLi4ucmVtYWluaW5nOiBzdHJpbmdbXSk6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRcdFx0aWYgKHR5cGVvZiBmaXJzdEl0ZW0gPT09ICdvYmplY3QnKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLnJlZ2lzdGVyU2lnbmF0dXJlSGVscFByb3ZpZGVyKGV4dGVuc2lvbiwgY2hlY2tTZWxlY3RvcihzZWxlY3RvciksIHByb3ZpZGVyLCBmaXJzdEl0ZW0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBleHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcy5yZWdpc3RlclNpZ25hdHVyZUhlbHBQcm92aWRlcihleHRlbnNpb24sIGNoZWNrU2VsZWN0b3Ioc2VsZWN0b3IpLCBwcm92aWRlciwgdHlwZW9mIGZpcnN0SXRlbSA9PT0gJ3VuZGVmaW5lZCcgPyBbXSA6IFtmaXJzdEl0ZW0sIC4uLnJlbWFpbmluZ10pO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyQ29tcGxldGlvbkl0ZW1Qcm92aWRlcihzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuQ29tcGxldGlvbkl0ZW1Qcm92aWRlciwgLi4udHJpZ2dlckNoYXJhY3RlcnM6IHN0cmluZ1tdKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMucmVnaXN0ZXJDb21wbGV0aW9uSXRlbVByb3ZpZGVyKGV4dGVuc2lvbiwgY2hlY2tTZWxlY3RvcihzZWxlY3RvciksIHByb3ZpZGVyLCB0cmlnZ2VyQ2hhcmFjdGVycyk7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJJbmxpbmVDb21wbGV0aW9uSXRlbVByb3ZpZGVyKHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5JbmxpbmVDb21wbGV0aW9uSXRlbVByb3ZpZGVyLCBtZXRhZGF0YT86IHZzY29kZS5JbmxpbmVDb21wbGV0aW9uSXRlbVByb3ZpZGVyTWV0YWRhdGEpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0XHRcdGlmIChwcm92aWRlci5oYW5kbGVEaWRTaG93Q29tcGxldGlvbkl0ZW0pIHtcblx0XHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdpbmxpbmVDb21wbGV0aW9uc0FkZGl0aW9ucycpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChwcm92aWRlci5oYW5kbGVEaWRQYXJ0aWFsbHlBY2NlcHRDb21wbGV0aW9uSXRlbSkge1xuXHRcdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ2lubGluZUNvbXBsZXRpb25zQWRkaXRpb25zJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKG1ldGFkYXRhKSB7XG5cdFx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnaW5saW5lQ29tcGxldGlvbnNBZGRpdGlvbnMnKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMucmVnaXN0ZXJJbmxpbmVDb21wbGV0aW9uc1Byb3ZpZGVyKGV4dGVuc2lvbiwgY2hlY2tTZWxlY3RvcihzZWxlY3RvciksIHByb3ZpZGVyLCBtZXRhZGF0YSk7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJJbmxpbmVFZGl0UHJvdmlkZXIoc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLklubGluZUVkaXRQcm92aWRlcik6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnaW5saW5lRWRpdCcpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMucmVnaXN0ZXJJbmxpbmVFZGl0UHJvdmlkZXIoZXh0ZW5zaW9uLCBjaGVja1NlbGVjdG9yKHNlbGVjdG9yKSwgcHJvdmlkZXIpO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyRG9jdW1lbnRMaW5rUHJvdmlkZXIoc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLkRvY3VtZW50TGlua1Byb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMucmVnaXN0ZXJEb2N1bWVudExpbmtQcm92aWRlcihleHRlbnNpb24sIGNoZWNrU2VsZWN0b3Ioc2VsZWN0b3IpLCBwcm92aWRlcik7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJDb2xvclByb3ZpZGVyKHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5Eb2N1bWVudENvbG9yUHJvdmlkZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcy5yZWdpc3RlckNvbG9yUHJvdmlkZXIoZXh0ZW5zaW9uLCBjaGVja1NlbGVjdG9yKHNlbGVjdG9yKSwgcHJvdmlkZXIpO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyRm9sZGluZ1JhbmdlUHJvdmlkZXIoc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLkZvbGRpbmdSYW5nZVByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMucmVnaXN0ZXJGb2xkaW5nUmFuZ2VQcm92aWRlcihleHRlbnNpb24sIGNoZWNrU2VsZWN0b3Ioc2VsZWN0b3IpLCBwcm92aWRlcik7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJTZWxlY3Rpb25SYW5nZVByb3ZpZGVyKHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5TZWxlY3Rpb25SYW5nZVByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMucmVnaXN0ZXJTZWxlY3Rpb25SYW5nZVByb3ZpZGVyKGV4dGVuc2lvbiwgc2VsZWN0b3IsIHByb3ZpZGVyKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlckNhbGxIaWVyYXJjaHlQcm92aWRlcihzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuQ2FsbEhpZXJhcmNoeVByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMucmVnaXN0ZXJDYWxsSGllcmFyY2h5UHJvdmlkZXIoZXh0ZW5zaW9uLCBzZWxlY3RvciwgcHJvdmlkZXIpO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyVHlwZUhpZXJhcmNoeVByb3ZpZGVyKHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5UeXBlSGllcmFyY2h5UHJvdmlkZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcy5yZWdpc3RlclR5cGVIaWVyYXJjaHlQcm92aWRlcihleHRlbnNpb24sIHNlbGVjdG9yLCBwcm92aWRlcik7XG5cdFx0XHR9LFxuXHRcdFx0c2V0TGFuZ3VhZ2VDb25maWd1cmF0aW9uOiAobGFuZ3VhZ2U6IHN0cmluZywgY29uZmlndXJhdGlvbjogdnNjb2RlLkxhbmd1YWdlQ29uZmlndXJhdGlvbik6IHZzY29kZS5EaXNwb3NhYmxlID0+IHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLnNldExhbmd1YWdlQ29uZmlndXJhdGlvbihleHRlbnNpb24sIGxhbmd1YWdlLCBjb25maWd1cmF0aW9uKTtcblx0XHRcdH0sXG5cdFx0XHRnZXRUb2tlbkluZm9ybWF0aW9uQXRQb3NpdGlvbihkb2M6IHZzY29kZS5UZXh0RG9jdW1lbnQsIHBvczogdnNjb2RlLlBvc2l0aW9uKSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ3Rva2VuSW5mb3JtYXRpb24nKTtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RMYW5ndWFnZXMudG9rZW5BdFBvc2l0aW9uKGRvYywgcG9zKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlcklubGF5SGludHNQcm92aWRlcihzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuSW5sYXlIaW50c1Byb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMucmVnaXN0ZXJJbmxheUhpbnRzUHJvdmlkZXIoZXh0ZW5zaW9uLCBzZWxlY3RvciwgcHJvdmlkZXIpO1xuXHRcdFx0fSxcblx0XHRcdGNyZWF0ZUxhbmd1YWdlU3RhdHVzSXRlbShpZDogc3RyaW5nLCBzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IpOiB2c2NvZGUuTGFuZ3VhZ2VTdGF0dXNJdGVtIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RMYW5ndWFnZXMuY3JlYXRlTGFuZ3VhZ2VTdGF0dXNJdGVtKGV4dGVuc2lvbiwgaWQsIHNlbGVjdG9yKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlckRvY3VtZW50RHJvcEVkaXRQcm92aWRlcihzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuRG9jdW1lbnREcm9wRWRpdFByb3ZpZGVyLCBtZXRhZGF0YT86IHZzY29kZS5Eb2N1bWVudERyb3BFZGl0UHJvdmlkZXJNZXRhZGF0YSk6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLnJlZ2lzdGVyRG9jdW1lbnRPbkRyb3BFZGl0UHJvdmlkZXIoZXh0ZW5zaW9uLCBzZWxlY3RvciwgcHJvdmlkZXIsIG1ldGFkYXRhKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Ly8gbmFtZXNwYWNlOiB3aW5kb3dcblx0XHRjb25zdCB3aW5kb3c6IHR5cGVvZiB2c2NvZGUud2luZG93ID0ge1xuXHRcdFx0Z2V0IGFjdGl2ZVRleHRFZGl0b3IoKSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0RWRpdG9ycy5nZXRBY3RpdmVUZXh0RWRpdG9yKCk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IHZpc2libGVUZXh0RWRpdG9ycygpIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RFZGl0b3JzLmdldFZpc2libGVUZXh0RWRpdG9ycygpO1xuXHRcdFx0fSxcblx0XHRcdGdldCBhY3RpdmVUZXJtaW5hbCgpIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RUZXJtaW5hbFNlcnZpY2UuYWN0aXZlVGVybWluYWw7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IHRlcm1pbmFscygpIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RUZXJtaW5hbFNlcnZpY2UudGVybWluYWxzO1xuXHRcdFx0fSxcblx0XHRcdGFzeW5jIHNob3dUZXh0RG9jdW1lbnQoZG9jdW1lbnRPclVyaTogdnNjb2RlLlRleHREb2N1bWVudCB8IHZzY29kZS5VcmksIGNvbHVtbk9yT3B0aW9ucz86IHZzY29kZS5WaWV3Q29sdW1uIHwgdnNjb2RlLlRleHREb2N1bWVudFNob3dPcHRpb25zLCBwcmVzZXJ2ZUZvY3VzPzogYm9vbGVhbik6IFByb21pc2U8dnNjb2RlLlRleHRFZGl0b3I+IHtcblx0XHRcdFx0aWYgKFVSSS5pc1VyaShkb2N1bWVudE9yVXJpKSAmJiBkb2N1bWVudE9yVXJpLnNjaGVtZSA9PT0gU2NoZW1hcy52c2NvZGVSZW1vdGUgJiYgIWRvY3VtZW50T3JVcmkuYXV0aG9yaXR5KSB7XG5cdFx0XHRcdFx0ZXh0SG9zdEFwaURlcHJlY2F0aW9uLnJlcG9ydCgnd29ya3NwYWNlLnNob3dUZXh0RG9jdW1lbnQnLCBleHRlbnNpb24sIGBBIFVSSSBvZiAndnNjb2RlLXJlbW90ZScgc2NoZW1lIHJlcXVpcmVzIGFuIGF1dGhvcml0eS5gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBkb2N1bWVudCA9IGF3YWl0IChVUkkuaXNVcmkoZG9jdW1lbnRPclVyaSlcblx0XHRcdFx0XHQ/IFByb21pc2UucmVzb2x2ZSh3b3Jrc3BhY2Uub3BlblRleHREb2N1bWVudChkb2N1bWVudE9yVXJpKSlcblx0XHRcdFx0XHQ6IFByb21pc2UucmVzb2x2ZSg8dnNjb2RlLlRleHREb2N1bWVudD5kb2N1bWVudE9yVXJpKSk7XG5cblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RFZGl0b3JzLnNob3dUZXh0RG9jdW1lbnQoZG9jdW1lbnQsIGNvbHVtbk9yT3B0aW9ucywgcHJlc2VydmVGb2N1cyk7XG5cdFx0XHR9LFxuXHRcdFx0Y3JlYXRlVGV4dEVkaXRvckRlY29yYXRpb25UeXBlKG9wdGlvbnM6IHZzY29kZS5EZWNvcmF0aW9uUmVuZGVyT3B0aW9ucyk6IHZzY29kZS5UZXh0RWRpdG9yRGVjb3JhdGlvblR5cGUge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdEVkaXRvcnMuY3JlYXRlVGV4dEVkaXRvckRlY29yYXRpb25UeXBlKGV4dGVuc2lvbiwgb3B0aW9ucyk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRDaGFuZ2VBY3RpdmVUZXh0RWRpdG9yKGxpc3RlbmVyLCB0aGlzQXJnPywgZGlzcG9zYWJsZXM/KSB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0RWRpdG9ycy5vbkRpZENoYW5nZUFjdGl2ZVRleHRFZGl0b3IpKGxpc3RlbmVyLCB0aGlzQXJnLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRDaGFuZ2VWaXNpYmxlVGV4dEVkaXRvcnMobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKSB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0RWRpdG9ycy5vbkRpZENoYW5nZVZpc2libGVUZXh0RWRpdG9ycykobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZENoYW5nZVRleHRFZGl0b3JTZWxlY3Rpb24obGlzdGVuZXI6IChlOiB2c2NvZGUuVGV4dEVkaXRvclNlbGVjdGlvbkNoYW5nZUV2ZW50KSA9PiBhbnksIHRoaXNBcmdzPzogYW55LCBkaXNwb3NhYmxlcz86IGV4dEhvc3RUeXBlcy5EaXNwb3NhYmxlW10pIHtcblx0XHRcdFx0cmV0dXJuIF9hc0V4dGVuc2lvbkV2ZW50KGV4dEhvc3RFZGl0b3JzLm9uRGlkQ2hhbmdlVGV4dEVkaXRvclNlbGVjdGlvbikobGlzdGVuZXIsIHRoaXNBcmdzLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRDaGFuZ2VUZXh0RWRpdG9yT3B0aW9ucyhsaXN0ZW5lcjogKGU6IHZzY29kZS5UZXh0RWRpdG9yT3B0aW9uc0NoYW5nZUV2ZW50KSA9PiBhbnksIHRoaXNBcmdzPzogYW55LCBkaXNwb3NhYmxlcz86IGV4dEhvc3RUeXBlcy5EaXNwb3NhYmxlW10pIHtcblx0XHRcdFx0cmV0dXJuIF9hc0V4dGVuc2lvbkV2ZW50KGV4dEhvc3RFZGl0b3JzLm9uRGlkQ2hhbmdlVGV4dEVkaXRvck9wdGlvbnMpKGxpc3RlbmVyLCB0aGlzQXJncywgZGlzcG9zYWJsZXMpO1xuXHRcdFx0fSxcblx0XHRcdG9uRGlkQ2hhbmdlVGV4dEVkaXRvclZpc2libGVSYW5nZXMobGlzdGVuZXI6IChlOiB2c2NvZGUuVGV4dEVkaXRvclZpc2libGVSYW5nZXNDaGFuZ2VFdmVudCkgPT4gYW55LCB0aGlzQXJncz86IGFueSwgZGlzcG9zYWJsZXM/OiBleHRIb3N0VHlwZXMuRGlzcG9zYWJsZVtdKSB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0RWRpdG9ycy5vbkRpZENoYW5nZVRleHRFZGl0b3JWaXNpYmxlUmFuZ2VzKShsaXN0ZW5lciwgdGhpc0FyZ3MsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZENoYW5nZVRleHRFZGl0b3JWaWV3Q29sdW1uKGxpc3RlbmVyLCB0aGlzQXJnPywgZGlzcG9zYWJsZXM/KSB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0RWRpdG9ycy5vbkRpZENoYW5nZVRleHRFZGl0b3JWaWV3Q29sdW1uKShsaXN0ZW5lciwgdGhpc0FyZywgZGlzcG9zYWJsZXMpO1xuXHRcdFx0fSxcblx0XHRcdG9uRGlkQ2hhbmdlVGV4dEVkaXRvckRpZmZJbmZvcm1hdGlvbihsaXN0ZW5lciwgdGhpc0FyZz8sIGRpc3Bvc2FibGVzPykge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICd0ZXh0RWRpdG9yRGlmZkluZm9ybWF0aW9uJyk7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0RWRpdG9ycy5vbkRpZENoYW5nZVRleHRFZGl0b3JEaWZmSW5mb3JtYXRpb24pKGxpc3RlbmVyLCB0aGlzQXJnLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRDbG9zZVRlcm1pbmFsKGxpc3RlbmVyLCB0aGlzQXJnPywgZGlzcG9zYWJsZXM/KSB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0VGVybWluYWxTZXJ2aWNlLm9uRGlkQ2xvc2VUZXJtaW5hbCkobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZE9wZW5UZXJtaW5hbChsaXN0ZW5lciwgdGhpc0FyZz8sIGRpc3Bvc2FibGVzPykge1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdFRlcm1pbmFsU2VydmljZS5vbkRpZE9wZW5UZXJtaW5hbCkobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZENoYW5nZUFjdGl2ZVRlcm1pbmFsKGxpc3RlbmVyLCB0aGlzQXJnPywgZGlzcG9zYWJsZXM/KSB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0VGVybWluYWxTZXJ2aWNlLm9uRGlkQ2hhbmdlQWN0aXZlVGVybWluYWwpKGxpc3RlbmVyLCB0aGlzQXJnLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRDaGFuZ2VUZXJtaW5hbERpbWVuc2lvbnMobGlzdGVuZXIsIHRoaXNBcmc/LCBkaXNwb3NhYmxlcz8pIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAndGVybWluYWxEaW1lbnNpb25zJyk7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0VGVybWluYWxTZXJ2aWNlLm9uRGlkQ2hhbmdlVGVybWluYWxEaW1lbnNpb25zKShsaXN0ZW5lciwgdGhpc0FyZywgZGlzcG9zYWJsZXMpO1xuXHRcdFx0fSxcblx0XHRcdG9uRGlkQ2hhbmdlVGVybWluYWxTdGF0ZShsaXN0ZW5lciwgdGhpc0FyZz8sIGRpc3Bvc2FibGVzPykge1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdFRlcm1pbmFsU2VydmljZS5vbkRpZENoYW5nZVRlcm1pbmFsU3RhdGUpKGxpc3RlbmVyLCB0aGlzQXJnLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRXcml0ZVRlcm1pbmFsRGF0YShsaXN0ZW5lciwgdGhpc0FyZz8sIGRpc3Bvc2FibGVzPykge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICd0ZXJtaW5hbERhdGFXcml0ZUV2ZW50Jyk7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0VGVybWluYWxTZXJ2aWNlLm9uRGlkV3JpdGVUZXJtaW5hbERhdGEpKGxpc3RlbmVyLCB0aGlzQXJnLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRFeGVjdXRlVGVybWluYWxDb21tYW5kKGxpc3RlbmVyLCB0aGlzQXJnPywgZGlzcG9zYWJsZXM/KSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ3Rlcm1pbmFsRXhlY3V0ZUNvbW1hbmRFdmVudCcpO1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdFRlcm1pbmFsU2VydmljZS5vbkRpZEV4ZWN1dGVUZXJtaW5hbENvbW1hbmQpKGxpc3RlbmVyLCB0aGlzQXJnLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRDaGFuZ2VUZXJtaW5hbFNoZWxsSW50ZWdyYXRpb24obGlzdGVuZXIsIHRoaXNBcmc/LCBkaXNwb3NhYmxlcz8pIHtcblx0XHRcdFx0cmV0dXJuIF9hc0V4dGVuc2lvbkV2ZW50KGV4dEhvc3RUZXJtaW5hbFNoZWxsSW50ZWdyYXRpb24ub25EaWRDaGFuZ2VUZXJtaW5hbFNoZWxsSW50ZWdyYXRpb24pKGxpc3RlbmVyLCB0aGlzQXJnLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRTdGFydFRlcm1pbmFsU2hlbGxFeGVjdXRpb24obGlzdGVuZXIsIHRoaXNBcmc/LCBkaXNwb3NhYmxlcz8pIHtcblx0XHRcdFx0cmV0dXJuIF9hc0V4dGVuc2lvbkV2ZW50KGV4dEhvc3RUZXJtaW5hbFNoZWxsSW50ZWdyYXRpb24ub25EaWRTdGFydFRlcm1pbmFsU2hlbGxFeGVjdXRpb24pKGxpc3RlbmVyLCB0aGlzQXJnLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRFbmRUZXJtaW5hbFNoZWxsRXhlY3V0aW9uKGxpc3RlbmVyLCB0aGlzQXJnPywgZGlzcG9zYWJsZXM/KSB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0VGVybWluYWxTaGVsbEludGVncmF0aW9uLm9uRGlkRW5kVGVybWluYWxTaGVsbEV4ZWN1dGlvbikobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgc3RhdGUoKSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0V2luZG93LmdldFN0YXRlKCk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRDaGFuZ2VXaW5kb3dTdGF0ZShsaXN0ZW5lciwgdGhpc0FyZz8sIGRpc3Bvc2FibGVzPykge1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdFdpbmRvdy5vbkRpZENoYW5nZVdpbmRvd1N0YXRlKShsaXN0ZW5lciwgdGhpc0FyZywgZGlzcG9zYWJsZXMpO1xuXHRcdFx0fSxcblx0XHRcdHNob3dJbmZvcm1hdGlvbk1lc3NhZ2UobWVzc2FnZTogc3RyaW5nLCAuLi5yZXN0OiBBcnJheTx2c2NvZGUuTWVzc2FnZU9wdGlvbnMgfCBzdHJpbmcgfCB2c2NvZGUuTWVzc2FnZUl0ZW0+KSB7XG5cdFx0XHRcdHJldHVybiA8VGhlbmFibGU8YW55Pj5leHRIb3N0TWVzc2FnZVNlcnZpY2Uuc2hvd01lc3NhZ2UoZXh0ZW5zaW9uLCBTZXZlcml0eS5JbmZvLCBtZXNzYWdlLCByZXN0WzBdLCA8QXJyYXk8c3RyaW5nIHwgdnNjb2RlLk1lc3NhZ2VJdGVtPj5yZXN0LnNsaWNlKDEpKTtcblx0XHRcdH0sXG5cdFx0XHRzaG93V2FybmluZ01lc3NhZ2UobWVzc2FnZTogc3RyaW5nLCAuLi5yZXN0OiBBcnJheTx2c2NvZGUuTWVzc2FnZU9wdGlvbnMgfCBzdHJpbmcgfCB2c2NvZGUuTWVzc2FnZUl0ZW0+KSB7XG5cdFx0XHRcdHJldHVybiA8VGhlbmFibGU8YW55Pj5leHRIb3N0TWVzc2FnZVNlcnZpY2Uuc2hvd01lc3NhZ2UoZXh0ZW5zaW9uLCBTZXZlcml0eS5XYXJuaW5nLCBtZXNzYWdlLCByZXN0WzBdLCA8QXJyYXk8c3RyaW5nIHwgdnNjb2RlLk1lc3NhZ2VJdGVtPj5yZXN0LnNsaWNlKDEpKTtcblx0XHRcdH0sXG5cdFx0XHRzaG93RXJyb3JNZXNzYWdlKG1lc3NhZ2U6IHN0cmluZywgLi4ucmVzdDogQXJyYXk8dnNjb2RlLk1lc3NhZ2VPcHRpb25zIHwgc3RyaW5nIHwgdnNjb2RlLk1lc3NhZ2VJdGVtPikge1xuXHRcdFx0XHRyZXR1cm4gPFRoZW5hYmxlPGFueT4+ZXh0SG9zdE1lc3NhZ2VTZXJ2aWNlLnNob3dNZXNzYWdlKGV4dGVuc2lvbiwgU2V2ZXJpdHkuRXJyb3IsIG1lc3NhZ2UsIHJlc3RbMF0sIDxBcnJheTxzdHJpbmcgfCB2c2NvZGUuTWVzc2FnZUl0ZW0+PnJlc3Quc2xpY2UoMSkpO1xuXHRcdFx0fSxcblx0XHRcdHNob3dRdWlja1BpY2soaXRlbXM6IGFueSwgb3B0aW9ucz86IHZzY29kZS5RdWlja1BpY2tPcHRpb25zLCB0b2tlbj86IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbik6IGFueSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0UXVpY2tPcGVuLnNob3dRdWlja1BpY2soZXh0ZW5zaW9uLCBpdGVtcywgb3B0aW9ucywgdG9rZW4pO1xuXHRcdFx0fSxcblx0XHRcdHNob3dXb3Jrc3BhY2VGb2xkZXJQaWNrKG9wdGlvbnM/OiB2c2NvZGUuV29ya3NwYWNlRm9sZGVyUGlja09wdGlvbnMpIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RRdWlja09wZW4uc2hvd1dvcmtzcGFjZUZvbGRlclBpY2sob3B0aW9ucyk7XG5cdFx0XHR9LFxuXHRcdFx0c2hvd0lucHV0Qm94KG9wdGlvbnM/OiB2c2NvZGUuSW5wdXRCb3hPcHRpb25zLCB0b2tlbj86IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbikge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFF1aWNrT3Blbi5zaG93SW5wdXQob3B0aW9ucywgdG9rZW4pO1xuXHRcdFx0fSxcblx0XHRcdHNob3dPcGVuRGlhbG9nKG9wdGlvbnMpIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3REaWFsb2dzLnNob3dPcGVuRGlhbG9nKG9wdGlvbnMpO1xuXHRcdFx0fSxcblx0XHRcdHNob3dTYXZlRGlhbG9nKG9wdGlvbnMpIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3REaWFsb2dzLnNob3dTYXZlRGlhbG9nKG9wdGlvbnMpO1xuXHRcdFx0fSxcblx0XHRcdGNyZWF0ZVN0YXR1c0Jhckl0ZW0oYWxpZ25tZW50T3JJZD86IHZzY29kZS5TdGF0dXNCYXJBbGlnbm1lbnQgfCBzdHJpbmcsIHByaW9yaXR5T3JBbGlnbm1lbnQ/OiBudW1iZXIgfCB2c2NvZGUuU3RhdHVzQmFyQWxpZ25tZW50LCBwcmlvcml0eUFyZz86IG51bWJlcik6IHZzY29kZS5TdGF0dXNCYXJJdGVtIHtcblx0XHRcdFx0bGV0IGlkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdGxldCBhbGlnbm1lbnQ6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0XHRcdFx0bGV0IHByaW9yaXR5OiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cblx0XHRcdFx0aWYgKHR5cGVvZiBhbGlnbm1lbnRPcklkID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdGlkID0gYWxpZ25tZW50T3JJZDtcblx0XHRcdFx0XHRhbGlnbm1lbnQgPSBwcmlvcml0eU9yQWxpZ25tZW50O1xuXHRcdFx0XHRcdHByaW9yaXR5ID0gcHJpb3JpdHlBcmc7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YWxpZ25tZW50ID0gYWxpZ25tZW50T3JJZDtcblx0XHRcdFx0XHRwcmlvcml0eSA9IHByaW9yaXR5T3JBbGlnbm1lbnQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFN0YXR1c0Jhci5jcmVhdGVTdGF0dXNCYXJFbnRyeShleHRlbnNpb24sIGlkLCBhbGlnbm1lbnQsIHByaW9yaXR5KTtcblx0XHRcdH0sXG5cdFx0XHRzZXRTdGF0dXNCYXJNZXNzYWdlKHRleHQ6IHN0cmluZywgdGltZW91dE9yVGhlbmFibGU/OiBudW1iZXIgfCBUaGVuYWJsZTxhbnk+KTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFN0YXR1c0Jhci5zZXRTdGF0dXNCYXJNZXNzYWdlKHRleHQsIHRpbWVvdXRPclRoZW5hYmxlKTtcblx0XHRcdH0sXG5cdFx0XHR3aXRoU2NtUHJvZ3Jlc3M8Uj4odGFzazogKHByb2dyZXNzOiB2c2NvZGUuUHJvZ3Jlc3M8bnVtYmVyPikgPT4gVGhlbmFibGU8Uj4pIHtcblx0XHRcdFx0ZXh0SG9zdEFwaURlcHJlY2F0aW9uLnJlcG9ydCgnd2luZG93LndpdGhTY21Qcm9ncmVzcycsIGV4dGVuc2lvbixcblx0XHRcdFx0XHRgVXNlICd3aXRoUHJvZ3Jlc3MnIGluc3RlYWQuYCk7XG5cblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RQcm9ncmVzcy53aXRoUHJvZ3Jlc3MoZXh0ZW5zaW9uLCB7IGxvY2F0aW9uOiBleHRIb3N0VHlwZXMuUHJvZ3Jlc3NMb2NhdGlvbi5Tb3VyY2VDb250cm9sIH0sIChwcm9ncmVzcywgdG9rZW4pID0+IHRhc2soeyByZXBvcnQobjogbnVtYmVyKSB7IC8qbm9vcCovIH0gfSkpO1xuXHRcdFx0fSxcblx0XHRcdHdpdGhQcm9ncmVzczxSPihvcHRpb25zOiB2c2NvZGUuUHJvZ3Jlc3NPcHRpb25zLCB0YXNrOiAocHJvZ3Jlc3M6IHZzY29kZS5Qcm9ncmVzczx7IG1lc3NhZ2U/OiBzdHJpbmc7IHdvcmtlZD86IG51bWJlciB9PiwgdG9rZW46IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbikgPT4gVGhlbmFibGU8Uj4pIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RQcm9ncmVzcy53aXRoUHJvZ3Jlc3MoZXh0ZW5zaW9uLCBvcHRpb25zLCB0YXNrKTtcblx0XHRcdH0sXG5cdFx0XHRjcmVhdGVPdXRwdXRDaGFubmVsKG5hbWU6IHN0cmluZywgb3B0aW9uczogc3RyaW5nIHwgeyBsb2c6IHRydWUgfSB8IHVuZGVmaW5lZCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0T3V0cHV0U2VydmljZS5jcmVhdGVPdXRwdXRDaGFubmVsKG5hbWUsIG9wdGlvbnMsIGV4dGVuc2lvbik7XG5cdFx0XHR9LFxuXHRcdFx0Y3JlYXRlV2Vidmlld1BhbmVsKHZpZXdUeXBlOiBzdHJpbmcsIHRpdGxlOiBzdHJpbmcsIHNob3dPcHRpb25zOiB2c2NvZGUuVmlld0NvbHVtbiB8IHsgdmlld0NvbHVtbjogdnNjb2RlLlZpZXdDb2x1bW47IHByZXNlcnZlRm9jdXM/OiBib29sZWFuIH0sIG9wdGlvbnM/OiB2c2NvZGUuV2Vidmlld1BhbmVsT3B0aW9ucyAmIHZzY29kZS5XZWJ2aWV3T3B0aW9ucyk6IHZzY29kZS5XZWJ2aWV3UGFuZWwge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFdlYnZpZXdQYW5lbHMuY3JlYXRlV2Vidmlld1BhbmVsKGV4dGVuc2lvbiwgdmlld1R5cGUsIHRpdGxlLCBzaG93T3B0aW9ucywgb3B0aW9ucyk7XG5cdFx0XHR9LFxuXHRcdFx0Y3JlYXRlV2Vidmlld1RleHRFZGl0b3JJbnNldChlZGl0b3I6IHZzY29kZS5UZXh0RWRpdG9yLCBsaW5lOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBvcHRpb25zPzogdnNjb2RlLldlYnZpZXdPcHRpb25zKTogdnNjb2RlLldlYnZpZXdFZGl0b3JJbnNldCB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ2VkaXRvckluc2V0cycpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdEVkaXRvckluc2V0cy5jcmVhdGVXZWJ2aWV3RWRpdG9ySW5zZXQoZWRpdG9yLCBsaW5lLCBoZWlnaHQsIG9wdGlvbnMsIGV4dGVuc2lvbik7XG5cdFx0XHR9LFxuXHRcdFx0Y3JlYXRlVGVybWluYWwobmFtZU9yT3B0aW9ucz86IHZzY29kZS5UZXJtaW5hbE9wdGlvbnMgfCB2c2NvZGUuRXh0ZW5zaW9uVGVybWluYWxPcHRpb25zIHwgc3RyaW5nLCBzaGVsbFBhdGg/OiBzdHJpbmcsIHNoZWxsQXJncz86IHJlYWRvbmx5IHN0cmluZ1tdIHwgc3RyaW5nKTogdnNjb2RlLlRlcm1pbmFsIHtcblx0XHRcdFx0aWYgKHR5cGVvZiBuYW1lT3JPcHRpb25zID09PSAnb2JqZWN0Jykge1xuXHRcdFx0XHRcdGlmICgncHR5JyBpbiBuYW1lT3JPcHRpb25zKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZXh0SG9zdFRlcm1pbmFsU2VydmljZS5jcmVhdGVFeHRlbnNpb25UZXJtaW5hbChuYW1lT3JPcHRpb25zKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIGV4dEhvc3RUZXJtaW5hbFNlcnZpY2UuY3JlYXRlVGVybWluYWxGcm9tT3B0aW9ucyhuYW1lT3JPcHRpb25zKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFRlcm1pbmFsU2VydmljZS5jcmVhdGVUZXJtaW5hbChuYW1lT3JPcHRpb25zLCBzaGVsbFBhdGgsIHNoZWxsQXJncyk7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJUZXJtaW5hbExpbmtQcm92aWRlcihwcm92aWRlcjogdnNjb2RlLlRlcm1pbmFsTGlua1Byb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFRlcm1pbmFsU2VydmljZS5yZWdpc3RlckxpbmtQcm92aWRlcihwcm92aWRlcik7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJUZXJtaW5hbFByb2ZpbGVQcm92aWRlcihpZDogc3RyaW5nLCBwcm92aWRlcjogdnNjb2RlLlRlcm1pbmFsUHJvZmlsZVByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFRlcm1pbmFsU2VydmljZS5yZWdpc3RlclByb2ZpbGVQcm92aWRlcihleHRlbnNpb24sIGlkLCBwcm92aWRlcik7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJUZXJtaW5hbENvbXBsZXRpb25Qcm92aWRlcihwcm92aWRlcjogdnNjb2RlLlRlcm1pbmFsQ29tcGxldGlvblByb3ZpZGVyPHZzY29kZS5UZXJtaW5hbENvbXBsZXRpb25JdGVtPiwgLi4udHJpZ2dlckNoYXJhY3RlcnM6IHN0cmluZ1tdKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICd0ZXJtaW5hbENvbXBsZXRpb25Qcm92aWRlcicpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFRlcm1pbmFsU2VydmljZS5yZWdpc3RlclRlcm1pbmFsQ29tcGxldGlvblByb3ZpZGVyKGV4dGVuc2lvbiwgcHJvdmlkZXIsIC4uLnRyaWdnZXJDaGFyYWN0ZXJzKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlclRlcm1pbmFsUXVpY2tGaXhQcm92aWRlcihpZDogc3RyaW5nLCBwcm92aWRlcjogdnNjb2RlLlRlcm1pbmFsUXVpY2tGaXhQcm92aWRlcik6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAndGVybWluYWxRdWlja0ZpeFByb3ZpZGVyJyk7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0VGVybWluYWxTZXJ2aWNlLnJlZ2lzdGVyVGVybWluYWxRdWlja0ZpeFByb3ZpZGVyKGlkLCBleHRlbnNpb24uaWRlbnRpZmllci52YWx1ZSwgcHJvdmlkZXIpO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyVHJlZURhdGFQcm92aWRlcih2aWV3SWQ6IHN0cmluZywgdHJlZURhdGFQcm92aWRlcjogdnNjb2RlLlRyZWVEYXRhUHJvdmlkZXI8YW55Pik6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RUcmVlVmlld3MucmVnaXN0ZXJUcmVlRGF0YVByb3ZpZGVyKHZpZXdJZCwgdHJlZURhdGFQcm92aWRlciwgZXh0ZW5zaW9uKTtcblx0XHRcdH0sXG5cdFx0XHRjcmVhdGVUcmVlVmlldyh2aWV3SWQ6IHN0cmluZywgb3B0aW9uczogeyB0cmVlRGF0YVByb3ZpZGVyOiB2c2NvZGUuVHJlZURhdGFQcm92aWRlcjxhbnk+IH0pOiB2c2NvZGUuVHJlZVZpZXc8YW55PiB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0VHJlZVZpZXdzLmNyZWF0ZVRyZWVWaWV3KHZpZXdJZCwgb3B0aW9ucywgZXh0ZW5zaW9uKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlcldlYnZpZXdQYW5lbFNlcmlhbGl6ZXI6ICh2aWV3VHlwZTogc3RyaW5nLCBzZXJpYWxpemVyOiB2c2NvZGUuV2Vidmlld1BhbmVsU2VyaWFsaXplcikgPT4ge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFdlYnZpZXdQYW5lbHMucmVnaXN0ZXJXZWJ2aWV3UGFuZWxTZXJpYWxpemVyKGV4dGVuc2lvbiwgdmlld1R5cGUsIHNlcmlhbGl6ZXIpO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyQ3VzdG9tRWRpdG9yUHJvdmlkZXI6ICh2aWV3VHlwZTogc3RyaW5nLCBwcm92aWRlcjogdnNjb2RlLkN1c3RvbVRleHRFZGl0b3JQcm92aWRlciB8IHZzY29kZS5DdXN0b21SZWFkb25seUVkaXRvclByb3ZpZGVyLCBvcHRpb25zOiB7IHdlYnZpZXdPcHRpb25zPzogdnNjb2RlLldlYnZpZXdQYW5lbE9wdGlvbnM7IHN1cHBvcnRzTXVsdGlwbGVFZGl0b3JzUGVyRG9jdW1lbnQ/OiBib29sZWFuIH0gPSB7fSkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdEN1c3RvbUVkaXRvcnMucmVnaXN0ZXJDdXN0b21FZGl0b3JQcm92aWRlcihleHRlbnNpb24sIHZpZXdUeXBlLCBwcm92aWRlciwgb3B0aW9ucyk7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJGaWxlRGVjb3JhdGlvblByb3ZpZGVyKHByb3ZpZGVyOiB2c2NvZGUuRmlsZURlY29yYXRpb25Qcm92aWRlcikge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdERlY29yYXRpb25zLnJlZ2lzdGVyRmlsZURlY29yYXRpb25Qcm92aWRlcihwcm92aWRlciwgZXh0ZW5zaW9uKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlclVyaUhhbmRsZXIoaGFuZGxlcjogdnNjb2RlLlVyaUhhbmRsZXIpIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RVcmxzLnJlZ2lzdGVyVXJpSGFuZGxlcihleHRlbnNpb24sIGhhbmRsZXIpO1xuXHRcdFx0fSxcblx0XHRcdGNyZWF0ZVF1aWNrUGljazxUIGV4dGVuZHMgdnNjb2RlLlF1aWNrUGlja0l0ZW0+KCk6IHZzY29kZS5RdWlja1BpY2s8VD4ge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFF1aWNrT3Blbi5jcmVhdGVRdWlja1BpY2soZXh0ZW5zaW9uKTtcblx0XHRcdH0sXG5cdFx0XHRjcmVhdGVJbnB1dEJveCgpOiB2c2NvZGUuSW5wdXRCb3gge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFF1aWNrT3Blbi5jcmVhdGVJbnB1dEJveChleHRlbnNpb24pO1xuXHRcdFx0fSxcblx0XHRcdGdldCBhY3RpdmVDb2xvclRoZW1lKCk6IHZzY29kZS5Db2xvclRoZW1lIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RUaGVtaW5nLmFjdGl2ZUNvbG9yVGhlbWU7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRDaGFuZ2VBY3RpdmVDb2xvclRoZW1lKGxpc3RlbmVyLCB0aGlzQXJnPywgZGlzcG9zYWJsZXM/KSB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0VGhlbWluZy5vbkRpZENoYW5nZUFjdGl2ZUNvbG9yVGhlbWUpKGxpc3RlbmVyLCB0aGlzQXJnLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJXZWJ2aWV3Vmlld1Byb3ZpZGVyKHZpZXdJZDogc3RyaW5nLCBwcm92aWRlcjogdnNjb2RlLldlYnZpZXdWaWV3UHJvdmlkZXIsIG9wdGlvbnM/OiB7XG5cdFx0XHRcdHdlYnZpZXdPcHRpb25zPzoge1xuXHRcdFx0XHRcdHJldGFpbkNvbnRleHRXaGVuSGlkZGVuPzogYm9vbGVhbjtcblx0XHRcdFx0fTtcblx0XHRcdH0pIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RXZWJ2aWV3Vmlld3MucmVnaXN0ZXJXZWJ2aWV3Vmlld1Byb3ZpZGVyKGV4dGVuc2lvbiwgdmlld0lkLCBwcm92aWRlciwgb3B0aW9ucz8ud2Vidmlld09wdGlvbnMpO1xuXHRcdFx0fSxcblx0XHRcdGdldCBhY3RpdmVOb3RlYm9va0VkaXRvcigpOiB2c2NvZGUuTm90ZWJvb2tFZGl0b3IgfCB1bmRlZmluZWQge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdE5vdGVib29rLmFjdGl2ZU5vdGVib29rRWRpdG9yO1xuXHRcdFx0fSxcblx0XHRcdG9uRGlkQ2hhbmdlQWN0aXZlTm90ZWJvb2tFZGl0b3IobGlzdGVuZXIsIHRoaXNBcmdzPywgZGlzcG9zYWJsZXM/KSB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0Tm90ZWJvb2sub25EaWRDaGFuZ2VBY3RpdmVOb3RlYm9va0VkaXRvcikobGlzdGVuZXIsIHRoaXNBcmdzLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IHZpc2libGVOb3RlYm9va0VkaXRvcnMoKSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0Tm90ZWJvb2sudmlzaWJsZU5vdGVib29rRWRpdG9ycztcblx0XHRcdH0sXG5cdFx0XHRnZXQgb25EaWRDaGFuZ2VWaXNpYmxlTm90ZWJvb2tFZGl0b3JzKCkge1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdE5vdGVib29rLm9uRGlkQ2hhbmdlVmlzaWJsZU5vdGVib29rRWRpdG9ycyk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRDaGFuZ2VOb3RlYm9va0VkaXRvclNlbGVjdGlvbihsaXN0ZW5lciwgdGhpc0FyZ3M/LCBkaXNwb3NhYmxlcz8pIHtcblx0XHRcdFx0cmV0dXJuIF9hc0V4dGVuc2lvbkV2ZW50KGV4dEhvc3ROb3RlYm9va0VkaXRvcnMub25EaWRDaGFuZ2VOb3RlYm9va0VkaXRvclNlbGVjdGlvbikobGlzdGVuZXIsIHRoaXNBcmdzLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRDaGFuZ2VOb3RlYm9va0VkaXRvclZpc2libGVSYW5nZXMobGlzdGVuZXIsIHRoaXNBcmdzPywgZGlzcG9zYWJsZXM/KSB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0Tm90ZWJvb2tFZGl0b3JzLm9uRGlkQ2hhbmdlTm90ZWJvb2tFZGl0b3JWaXNpYmxlUmFuZ2VzKShsaXN0ZW5lciwgdGhpc0FyZ3MsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRzaG93Tm90ZWJvb2tEb2N1bWVudChkb2N1bWVudCwgb3B0aW9ucz8pIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3ROb3RlYm9vay5zaG93Tm90ZWJvb2tEb2N1bWVudChkb2N1bWVudCwgb3B0aW9ucyk7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJFeHRlcm5hbFVyaU9wZW5lcihpZDogc3RyaW5nLCBvcGVuZXI6IHZzY29kZS5FeHRlcm5hbFVyaU9wZW5lciwgbWV0YWRhdGE6IHZzY29kZS5FeHRlcm5hbFVyaU9wZW5lck1ldGFkYXRhKSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ2V4dGVybmFsVXJpT3BlbmVyJyk7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0VXJpT3BlbmVycy5yZWdpc3RlckV4dGVybmFsVXJpT3BlbmVyKGV4dGVuc2lvbi5pZGVudGlmaWVyLCBpZCwgb3BlbmVyLCBtZXRhZGF0YSk7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJQcm9maWxlQ29udGVudEhhbmRsZXIoaWQ6IHN0cmluZywgaGFuZGxlcjogdnNjb2RlLlByb2ZpbGVDb250ZW50SGFuZGxlcikge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdwcm9maWxlQ29udGVudEhhbmRsZXJzJyk7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0UHJvZmlsZUNvbnRlbnRIYW5kbGVycy5yZWdpc3RlclByb2ZpbGVDb250ZW50SGFuZGxlcihleHRlbnNpb24sIGlkLCBoYW5kbGVyKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlclF1aWNrRGlmZlByb3ZpZGVyKHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcXVpY2tEaWZmUHJvdmlkZXI6IHZzY29kZS5RdWlja0RpZmZQcm92aWRlciwgbGFiZWw6IHN0cmluZywgcm9vdFVyaT86IHZzY29kZS5VcmkpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ3F1aWNrRGlmZlByb3ZpZGVyJyk7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0UXVpY2tEaWZmLnJlZ2lzdGVyUXVpY2tEaWZmUHJvdmlkZXIoY2hlY2tTZWxlY3RvcihzZWxlY3RvciksIHF1aWNrRGlmZlByb3ZpZGVyLCBsYWJlbCwgcm9vdFVyaSk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IHRhYkdyb3VwcygpOiB2c2NvZGUuVGFiR3JvdXBzIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RFZGl0b3JUYWJzLnRhYkdyb3Vwcztcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlclNoYXJlUHJvdmlkZXIoc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLlNoYXJlUHJvdmlkZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ3NoYXJlUHJvdmlkZXInKTtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RTaGFyZS5yZWdpc3RlclNoYXJlUHJvdmlkZXIoY2hlY2tTZWxlY3RvcihzZWxlY3RvciksIHByb3ZpZGVyKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgbmF0aXZlSGFuZGxlKCk6IFVpbnQ4QXJyYXkgfCB1bmRlZmluZWQge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICduYXRpdmVXaW5kb3dIYW5kbGUnKTtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RXaW5kb3cubmF0aXZlSGFuZGxlO1xuXHRcdFx0fSxcblx0XHRcdGNyZWF0ZUNoYXRTdGF0dXNJdGVtOiAoaWQ6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdjaGF0U3RhdHVzSXRlbScpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdENoYXRTdGF0dXMuY3JlYXRlQ2hhdFN0YXR1c0l0ZW0oZXh0ZW5zaW9uLCBpZCk7XG5cdFx0XHR9LFxuXHRcdH07XG5cblx0XHQvLyBuYW1lc3BhY2U6IHdvcmtzcGFjZVxuXG5cdFx0Y29uc3Qgd29ya3NwYWNlOiB0eXBlb2YgdnNjb2RlLndvcmtzcGFjZSA9IHtcblx0XHRcdGdldCByb290UGF0aCgpIHtcblx0XHRcdFx0ZXh0SG9zdEFwaURlcHJlY2F0aW9uLnJlcG9ydCgnd29ya3NwYWNlLnJvb3RQYXRoJywgZXh0ZW5zaW9uLFxuXHRcdFx0XHRcdGBQbGVhc2UgdXNlICd3b3Jrc3BhY2Uud29ya3NwYWNlRm9sZGVycycgaW5zdGVhZC4gTW9yZSBkZXRhaWxzOiBodHRwczovL2FrYS5tcy92c2NvZGUtZWxpbWluYXRpbmctcm9vdHBhdGhgKTtcblxuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFdvcmtzcGFjZS5nZXRQYXRoKCk7XG5cdFx0XHR9LFxuXHRcdFx0c2V0IHJvb3RQYXRoKHZhbHVlKSB7XG5cdFx0XHRcdHRocm93IG5ldyBlcnJvcnMuUmVhZG9ubHlFcnJvcigncm9vdFBhdGgnKTtcblx0XHRcdH0sXG5cdFx0XHRnZXRXb3Jrc3BhY2VGb2xkZXIocmVzb3VyY2UpIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RXb3Jrc3BhY2UuZ2V0V29ya3NwYWNlRm9sZGVyKHJlc291cmNlKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgd29ya3NwYWNlRm9sZGVycygpIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RXb3Jrc3BhY2UuZ2V0V29ya3NwYWNlRm9sZGVycygpO1xuXHRcdFx0fSxcblx0XHRcdGdldCBuYW1lKCkge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFdvcmtzcGFjZS5uYW1lO1xuXHRcdFx0fSxcblx0XHRcdHNldCBuYW1lKHZhbHVlKSB7XG5cdFx0XHRcdHRocm93IG5ldyBlcnJvcnMuUmVhZG9ubHlFcnJvcignbmFtZScpO1xuXHRcdFx0fSxcblx0XHRcdGdldCB3b3Jrc3BhY2VGaWxlKCkge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFdvcmtzcGFjZS53b3Jrc3BhY2VGaWxlO1xuXHRcdFx0fSxcblx0XHRcdHNldCB3b3Jrc3BhY2VGaWxlKHZhbHVlKSB7XG5cdFx0XHRcdHRocm93IG5ldyBlcnJvcnMuUmVhZG9ubHlFcnJvcignd29ya3NwYWNlRmlsZScpO1xuXHRcdFx0fSxcblx0XHRcdHVwZGF0ZVdvcmtzcGFjZUZvbGRlcnM6IChpbmRleCwgZGVsZXRlQ291bnQsIC4uLndvcmtzcGFjZUZvbGRlcnNUb0FkZCkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFdvcmtzcGFjZS51cGRhdGVXb3Jrc3BhY2VGb2xkZXJzKGV4dGVuc2lvbiwgaW5kZXgsIGRlbGV0ZUNvdW50IHx8IDAsIC4uLndvcmtzcGFjZUZvbGRlcnNUb0FkZCk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRDaGFuZ2VXb3Jrc3BhY2VGb2xkZXJzOiBmdW5jdGlvbiAobGlzdGVuZXIsIHRoaXNBcmdzPywgZGlzcG9zYWJsZXM/KSB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0V29ya3NwYWNlLm9uRGlkQ2hhbmdlV29ya3NwYWNlKShsaXN0ZW5lciwgdGhpc0FyZ3MsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRhc1JlbGF0aXZlUGF0aDogKHBhdGhPclVyaSwgaW5jbHVkZVdvcmtzcGFjZT8pID0+IHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RXb3Jrc3BhY2UuZ2V0UmVsYXRpdmVQYXRoKHBhdGhPclVyaSwgaW5jbHVkZVdvcmtzcGFjZSk7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZEZpbGVzOiAoaW5jbHVkZSwgZXhjbHVkZSwgbWF4UmVzdWx0cz8sIHRva2VuPykgPT4ge1xuXHRcdFx0XHQvLyBOb3RlLCB1bmRlZmluZWQvbnVsbCBoYXZlIGRpZmZlcmVudCBtZWFuaW5ncyBvbiBcImV4Y2x1ZGVcIlxuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFdvcmtzcGFjZS5maW5kRmlsZXMoaW5jbHVkZSwgZXhjbHVkZSwgbWF4UmVzdWx0cywgZXh0ZW5zaW9uLmlkZW50aWZpZXIsIHRva2VuKTtcblx0XHRcdH0sXG5cdFx0XHRmaW5kRmlsZXMyOiAoZmlsZVBhdHRlcm46IHZzY29kZS5HbG9iUGF0dGVybltdLCBvcHRpb25zPzogdnNjb2RlLkZpbmRGaWxlczJPcHRpb25zLCB0b2tlbj86IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbik6IFRoZW5hYmxlPHZzY29kZS5VcmlbXT4gPT4ge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdmaW5kRmlsZXMyJyk7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0V29ya3NwYWNlLmZpbmRGaWxlczIoZmlsZVBhdHRlcm4sIG9wdGlvbnMsIGV4dGVuc2lvbi5pZGVudGlmaWVyLCB0b2tlbik7XG5cdFx0XHR9LFxuXHRcdFx0ZmluZFRleHRJbkZpbGVzOiAocXVlcnk6IHZzY29kZS5UZXh0U2VhcmNoUXVlcnksIG9wdGlvbnNPckNhbGxiYWNrOiB2c2NvZGUuRmluZFRleHRJbkZpbGVzT3B0aW9ucyB8ICgocmVzdWx0OiB2c2NvZGUuVGV4dFNlYXJjaFJlc3VsdCkgPT4gdm9pZCksIGNhbGxiYWNrT3JUb2tlbj86IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbiB8ICgocmVzdWx0OiB2c2NvZGUuVGV4dFNlYXJjaFJlc3VsdCkgPT4gdm9pZCksIHRva2VuPzogdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuKSA9PiB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ2ZpbmRUZXh0SW5GaWxlcycpO1xuXHRcdFx0XHRsZXQgb3B0aW9uczogdnNjb2RlLkZpbmRUZXh0SW5GaWxlc09wdGlvbnM7XG5cdFx0XHRcdGxldCBjYWxsYmFjazogKHJlc3VsdDogdnNjb2RlLlRleHRTZWFyY2hSZXN1bHQpID0+IHZvaWQ7XG5cblx0XHRcdFx0aWYgKHR5cGVvZiBvcHRpb25zT3JDYWxsYmFjayA9PT0gJ29iamVjdCcpIHtcblx0XHRcdFx0XHRvcHRpb25zID0gb3B0aW9uc09yQ2FsbGJhY2s7XG5cdFx0XHRcdFx0Y2FsbGJhY2sgPSBjYWxsYmFja09yVG9rZW4gYXMgKHJlc3VsdDogdnNjb2RlLlRleHRTZWFyY2hSZXN1bHQpID0+IHZvaWQ7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0b3B0aW9ucyA9IHt9O1xuXHRcdFx0XHRcdGNhbGxiYWNrID0gb3B0aW9uc09yQ2FsbGJhY2s7XG5cdFx0XHRcdFx0dG9rZW4gPSBjYWxsYmFja09yVG9rZW4gYXMgdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RXb3Jrc3BhY2UuZmluZFRleHRJbkZpbGVzKHF1ZXJ5LCBvcHRpb25zIHx8IHt9LCBjYWxsYmFjaywgZXh0ZW5zaW9uLmlkZW50aWZpZXIsIHRva2VuKTtcblx0XHRcdH0sXG5cdFx0XHRmaW5kVGV4dEluRmlsZXMyOiAocXVlcnk6IHZzY29kZS5UZXh0U2VhcmNoUXVlcnkyLCBvcHRpb25zPzogdnNjb2RlLkZpbmRUZXh0SW5GaWxlc09wdGlvbnMyLCB0b2tlbj86IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbik6IHZzY29kZS5GaW5kVGV4dEluRmlsZXNSZXNwb25zZSA9PiB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ2ZpbmRUZXh0SW5GaWxlczInKTtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAndGV4dFNlYXJjaFByb3ZpZGVyMicpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFdvcmtzcGFjZS5maW5kVGV4dEluRmlsZXMyKHF1ZXJ5LCBvcHRpb25zLCBleHRlbnNpb24uaWRlbnRpZmllciwgdG9rZW4pO1xuXHRcdFx0fSxcblx0XHRcdHNhdmU6ICh1cmkpID0+IHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RXb3Jrc3BhY2Uuc2F2ZSh1cmkpO1xuXHRcdFx0fSxcblx0XHRcdHNhdmVBczogKHVyaSkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFdvcmtzcGFjZS5zYXZlQXModXJpKTtcblx0XHRcdH0sXG5cdFx0XHRzYXZlQWxsOiAoaW5jbHVkZVVudGl0bGVkPykgPT4ge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFdvcmtzcGFjZS5zYXZlQWxsKGluY2x1ZGVVbnRpdGxlZCk7XG5cdFx0XHR9LFxuXHRcdFx0YXBwbHlFZGl0KGVkaXQ6IHZzY29kZS5Xb3Jrc3BhY2VFZGl0LCBtZXRhZGF0YT86IHZzY29kZS5Xb3Jrc3BhY2VFZGl0TWV0YWRhdGEpOiBUaGVuYWJsZTxib29sZWFuPiB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0QnVsa0VkaXRzLmFwcGx5V29ya3NwYWNlRWRpdChlZGl0LCBleHRlbnNpb24sIG1ldGFkYXRhKTtcblx0XHRcdH0sXG5cdFx0XHRjcmVhdGVGaWxlU3lzdGVtV2F0Y2hlcjogKHBhdHRlcm4sIG9wdGlvbnNPcklnbm9yZUNyZWF0ZSwgaWdub3JlQ2hhbmdlPywgaWdub3JlRGVsZXRlPyk6IHZzY29kZS5GaWxlU3lzdGVtV2F0Y2hlciA9PiB7XG5cdFx0XHRcdGNvbnN0IG9wdGlvbnM6IEZpbGVTeXN0ZW1XYXRjaGVyQ3JlYXRlT3B0aW9ucyA9IHtcblx0XHRcdFx0XHRpZ25vcmVDcmVhdGVFdmVudHM6IEJvb2xlYW4ob3B0aW9uc09ySWdub3JlQ3JlYXRlKSxcblx0XHRcdFx0XHRpZ25vcmVDaGFuZ2VFdmVudHM6IEJvb2xlYW4oaWdub3JlQ2hhbmdlKSxcblx0XHRcdFx0XHRpZ25vcmVEZWxldGVFdmVudHM6IEJvb2xlYW4oaWdub3JlRGVsZXRlKSxcblx0XHRcdFx0fTtcblxuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdEZpbGVTeXN0ZW1FdmVudC5jcmVhdGVGaWxlU3lzdGVtV2F0Y2hlcihleHRIb3N0V29ya3NwYWNlLCBjb25maWdQcm92aWRlciwgZXh0ZW5zaW9uLCBwYXR0ZXJuLCBvcHRpb25zKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgdGV4dERvY3VtZW50cygpIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3REb2N1bWVudHMuZ2V0QWxsRG9jdW1lbnREYXRhKCkubWFwKGRhdGEgPT4gZGF0YS5kb2N1bWVudCk7XG5cdFx0XHR9LFxuXHRcdFx0c2V0IHRleHREb2N1bWVudHModmFsdWUpIHtcblx0XHRcdFx0dGhyb3cgbmV3IGVycm9ycy5SZWFkb25seUVycm9yKCd0ZXh0RG9jdW1lbnRzJyk7XG5cdFx0XHR9LFxuXHRcdFx0b3BlblRleHREb2N1bWVudCh1cmlPckZpbGVOYW1lT3JPcHRpb25zPzogdnNjb2RlLlVyaSB8IHN0cmluZyB8IHsgbGFuZ3VhZ2U/OiBzdHJpbmc7IGNvbnRlbnQ/OiBzdHJpbmc7IGVuY29kaW5nPzogc3RyaW5nIH0sIG9wdGlvbnM/OiB7IGVuY29kaW5nPzogc3RyaW5nIH0pIHtcblx0XHRcdFx0bGV0IHVyaVByb21pc2U6IFRoZW5hYmxlPFVSST47XG5cblx0XHRcdFx0b3B0aW9ucyA9IChvcHRpb25zID8/IHVyaU9yRmlsZU5hbWVPck9wdGlvbnMpIGFzICh7IGxhbmd1YWdlPzogc3RyaW5nOyBjb250ZW50Pzogc3RyaW5nOyBlbmNvZGluZz86IHN0cmluZyB9IHwgdW5kZWZpbmVkKTtcblx0XHRcdFx0aWYgKHR5cGVvZiBvcHRpb25zPy5lbmNvZGluZyA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICd0ZXh0RG9jdW1lbnRFbmNvZGluZycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHR5cGVvZiB1cmlPckZpbGVOYW1lT3JPcHRpb25zID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdHVyaVByb21pc2UgPSBQcm9taXNlLnJlc29sdmUoVVJJLmZpbGUodXJpT3JGaWxlTmFtZU9yT3B0aW9ucykpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKFVSSS5pc1VyaSh1cmlPckZpbGVOYW1lT3JPcHRpb25zKSkge1xuXHRcdFx0XHRcdHVyaVByb21pc2UgPSBQcm9taXNlLnJlc29sdmUodXJpT3JGaWxlTmFtZU9yT3B0aW9ucyk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoIW9wdGlvbnMgfHwgdHlwZW9mIG9wdGlvbnMgPT09ICdvYmplY3QnKSB7XG5cdFx0XHRcdFx0dXJpUHJvbWlzZSA9IGV4dEhvc3REb2N1bWVudHMuY3JlYXRlRG9jdW1lbnREYXRhKG9wdGlvbnMpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignaWxsZWdhbCBhcmd1bWVudCAtIHVyaU9yRmlsZU5hbWVPck9wdGlvbnMnKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiB1cmlQcm9taXNlLnRoZW4odXJpID0+IHtcblx0XHRcdFx0XHRleHRIb3N0TG9nU2VydmljZS50cmFjZShgb3BlblRleHREb2N1bWVudCBmcm9tICR7ZXh0ZW5zaW9uLmlkZW50aWZpZXJ9YCk7XG5cdFx0XHRcdFx0aWYgKHVyaS5zY2hlbWUgPT09IFNjaGVtYXMudnNjb2RlUmVtb3RlICYmICF1cmkuYXV0aG9yaXR5KSB7XG5cdFx0XHRcdFx0XHRleHRIb3N0QXBpRGVwcmVjYXRpb24ucmVwb3J0KCd3b3Jrc3BhY2Uub3BlblRleHREb2N1bWVudCcsIGV4dGVuc2lvbiwgYEEgVVJJIG9mICd2c2NvZGUtcmVtb3RlJyBzY2hlbWUgcmVxdWlyZXMgYW4gYXV0aG9yaXR5LmApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gZXh0SG9zdERvY3VtZW50cy5lbnN1cmVEb2N1bWVudERhdGEodXJpLCBvcHRpb25zKS50aGVuKGRvY3VtZW50RGF0YSA9PiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gZG9jdW1lbnREYXRhLmRvY3VtZW50O1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZE9wZW5UZXh0RG9jdW1lbnQ6IChsaXN0ZW5lciwgdGhpc0FyZ3M/LCBkaXNwb3NhYmxlcz8pID0+IHtcblx0XHRcdFx0cmV0dXJuIF9hc0V4dGVuc2lvbkV2ZW50KGV4dEhvc3REb2N1bWVudHMub25EaWRBZGREb2N1bWVudCkobGlzdGVuZXIsIHRoaXNBcmdzLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRDbG9zZVRleHREb2N1bWVudDogKGxpc3RlbmVyLCB0aGlzQXJncz8sIGRpc3Bvc2FibGVzPykgPT4ge1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdERvY3VtZW50cy5vbkRpZFJlbW92ZURvY3VtZW50KShsaXN0ZW5lciwgdGhpc0FyZ3MsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZENoYW5nZVRleHREb2N1bWVudDogKGxpc3RlbmVyLCB0aGlzQXJncz8sIGRpc3Bvc2FibGVzPykgPT4ge1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdERvY3VtZW50cy5vbkRpZENoYW5nZURvY3VtZW50KShsaXN0ZW5lciwgdGhpc0FyZ3MsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZFNhdmVUZXh0RG9jdW1lbnQ6IChsaXN0ZW5lciwgdGhpc0FyZ3M/LCBkaXNwb3NhYmxlcz8pID0+IHtcblx0XHRcdFx0cmV0dXJuIF9hc0V4dGVuc2lvbkV2ZW50KGV4dEhvc3REb2N1bWVudHMub25EaWRTYXZlRG9jdW1lbnQpKGxpc3RlbmVyLCB0aGlzQXJncywgZGlzcG9zYWJsZXMpO1xuXHRcdFx0fSxcblx0XHRcdG9uV2lsbFNhdmVUZXh0RG9jdW1lbnQ6IChsaXN0ZW5lciwgdGhpc0FyZ3M/LCBkaXNwb3NhYmxlcz8pID0+IHtcblx0XHRcdFx0cmV0dXJuIF9hc0V4dGVuc2lvbkV2ZW50KGV4dEhvc3REb2N1bWVudFNhdmVQYXJ0aWNpcGFudC5nZXRPbldpbGxTYXZlVGV4dERvY3VtZW50RXZlbnQoZXh0ZW5zaW9uKSkobGlzdGVuZXIsIHRoaXNBcmdzLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IG5vdGVib29rRG9jdW1lbnRzKCk6IHZzY29kZS5Ob3RlYm9va0RvY3VtZW50W10ge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdE5vdGVib29rLm5vdGVib29rRG9jdW1lbnRzLm1hcChkID0+IGQuYXBpTm90ZWJvb2spO1xuXHRcdFx0fSxcblx0XHRcdGFzeW5jIG9wZW5Ob3RlYm9va0RvY3VtZW50KHVyaU9yVHlwZT86IFVSSSB8IHN0cmluZywgY29udGVudD86IHZzY29kZS5Ob3RlYm9va0RhdGEpIHtcblx0XHRcdFx0bGV0IHVyaTogVVJJO1xuXHRcdFx0XHRpZiAoVVJJLmlzVXJpKHVyaU9yVHlwZSkpIHtcblx0XHRcdFx0XHR1cmkgPSB1cmlPclR5cGU7XG5cdFx0XHRcdFx0YXdhaXQgZXh0SG9zdE5vdGVib29rLm9wZW5Ob3RlYm9va0RvY3VtZW50KHVyaU9yVHlwZSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIHVyaU9yVHlwZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHR1cmkgPSBVUkkucmV2aXZlKGF3YWl0IGV4dEhvc3ROb3RlYm9vay5jcmVhdGVOb3RlYm9va0RvY3VtZW50KHsgdmlld1R5cGU6IHVyaU9yVHlwZSwgY29udGVudCB9KSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGFyZ3VtZW50cycpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBleHRIb3N0Tm90ZWJvb2suZ2V0Tm90ZWJvb2tEb2N1bWVudCh1cmkpLmFwaU5vdGVib29rO1xuXHRcdFx0fSxcblx0XHRcdG9uRGlkU2F2ZU5vdGVib29rRG9jdW1lbnQobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKSB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0Tm90ZWJvb2tEb2N1bWVudHMub25EaWRTYXZlTm90ZWJvb2tEb2N1bWVudCkobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZENoYW5nZU5vdGVib29rRG9jdW1lbnQobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKSB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0Tm90ZWJvb2tEb2N1bWVudHMub25EaWRDaGFuZ2VOb3RlYm9va0RvY3VtZW50KShsaXN0ZW5lciwgdGhpc0FyZywgZGlzcG9zYWJsZXMpO1xuXHRcdFx0fSxcblx0XHRcdG9uV2lsbFNhdmVOb3RlYm9va0RvY3VtZW50KGxpc3RlbmVyLCB0aGlzQXJnLCBkaXNwb3NhYmxlcykge1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdE5vdGVib29rRG9jdW1lbnRTYXZlUGFydGljaXBhbnQuZ2V0T25XaWxsU2F2ZU5vdGVib29rRG9jdW1lbnRFdmVudChleHRlbnNpb24pKShsaXN0ZW5lciwgdGhpc0FyZywgZGlzcG9zYWJsZXMpO1xuXHRcdFx0fSxcblx0XHRcdGdldCBvbkRpZE9wZW5Ob3RlYm9va0RvY3VtZW50KCkge1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdE5vdGVib29rLm9uRGlkT3Blbk5vdGVib29rRG9jdW1lbnQpO1xuXHRcdFx0fSxcblx0XHRcdGdldCBvbkRpZENsb3NlTm90ZWJvb2tEb2N1bWVudCgpIHtcblx0XHRcdFx0cmV0dXJuIF9hc0V4dGVuc2lvbkV2ZW50KGV4dEhvc3ROb3RlYm9vay5vbkRpZENsb3NlTm90ZWJvb2tEb2N1bWVudCk7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJOb3RlYm9va1NlcmlhbGl6ZXIodmlld1R5cGU6IHN0cmluZywgc2VyaWFsaXplcjogdnNjb2RlLk5vdGVib29rU2VyaWFsaXplciwgb3B0aW9ucz86IHZzY29kZS5Ob3RlYm9va0RvY3VtZW50Q29udGVudE9wdGlvbnMsIHJlZ2lzdHJhdGlvbj86IHZzY29kZS5Ob3RlYm9va1JlZ2lzdHJhdGlvbkRhdGEpIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3ROb3RlYm9vay5yZWdpc3Rlck5vdGVib29rU2VyaWFsaXplcihleHRlbnNpb24sIHZpZXdUeXBlLCBzZXJpYWxpemVyLCBvcHRpb25zLCBpc1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdub3RlYm9va0xpdmVTaGFyZScpID8gcmVnaXN0cmF0aW9uIDogdW5kZWZpbmVkKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZENoYW5nZUNvbmZpZ3VyYXRpb246IChsaXN0ZW5lcjogKF86IGFueSkgPT4gYW55LCB0aGlzQXJncz86IGFueSwgZGlzcG9zYWJsZXM/OiBleHRIb3N0VHlwZXMuRGlzcG9zYWJsZVtdKSA9PiB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChjb25maWdQcm92aWRlci5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24pKGxpc3RlbmVyLCB0aGlzQXJncywgZGlzcG9zYWJsZXMpO1xuXHRcdFx0fSxcblx0XHRcdGdldENvbmZpZ3VyYXRpb24oc2VjdGlvbj86IHN0cmluZywgc2NvcGU/OiB2c2NvZGUuQ29uZmlndXJhdGlvblNjb3BlIHwgbnVsbCk6IHZzY29kZS5Xb3Jrc3BhY2VDb25maWd1cmF0aW9uIHtcblx0XHRcdFx0c2NvcGUgPSBhcmd1bWVudHMubGVuZ3RoID09PSAxID8gdW5kZWZpbmVkIDogc2NvcGU7XG5cdFx0XHRcdHJldHVybiBjb25maWdQcm92aWRlci5nZXRDb25maWd1cmF0aW9uKHNlY3Rpb24sIHNjb3BlLCBleHRlbnNpb24pO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyVGV4dERvY3VtZW50Q29udGVudFByb3ZpZGVyKHNjaGVtZTogc3RyaW5nLCBwcm92aWRlcjogdnNjb2RlLlRleHREb2N1bWVudENvbnRlbnRQcm92aWRlcikge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdERvY3VtZW50Q29udGVudFByb3ZpZGVycy5yZWdpc3RlclRleHREb2N1bWVudENvbnRlbnRQcm92aWRlcihzY2hlbWUsIHByb3ZpZGVyKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlclRhc2tQcm92aWRlcjogKHR5cGU6IHN0cmluZywgcHJvdmlkZXI6IHZzY29kZS5UYXNrUHJvdmlkZXIpID0+IHtcblx0XHRcdFx0ZXh0SG9zdEFwaURlcHJlY2F0aW9uLnJlcG9ydCgnd2luZG93LnJlZ2lzdGVyVGFza1Byb3ZpZGVyJywgZXh0ZW5zaW9uLFxuXHRcdFx0XHRcdGBVc2UgdGhlIGNvcnJlc3BvbmRpbmcgZnVuY3Rpb24gb24gdGhlICd0YXNrcycgbmFtZXNwYWNlIGluc3RlYWRgKTtcblxuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFRhc2sucmVnaXN0ZXJUYXNrUHJvdmlkZXIoZXh0ZW5zaW9uLCB0eXBlLCBwcm92aWRlcik7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJGaWxlU3lzdGVtUHJvdmlkZXIoc2NoZW1lLCBwcm92aWRlciwgb3B0aW9ucykge1xuXHRcdFx0XHRyZXR1cm4gY29tYmluZWREaXNwb3NhYmxlKFxuXHRcdFx0XHRcdGV4dEhvc3RGaWxlU3lzdGVtLnJlZ2lzdGVyRmlsZVN5c3RlbVByb3ZpZGVyKGV4dGVuc2lvbiwgc2NoZW1lLCBwcm92aWRlciwgb3B0aW9ucyksXG5cdFx0XHRcdFx0ZXh0SG9zdENvbnN1bWVyRmlsZVN5c3RlbS5hZGRGaWxlU3lzdGVtUHJvdmlkZXIoc2NoZW1lLCBwcm92aWRlciwgb3B0aW9ucylcblx0XHRcdFx0KTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgZnMoKSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0Q29uc3VtZXJGaWxlU3lzdGVtLnZhbHVlO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyRmlsZVNlYXJjaFByb3ZpZGVyOiAoc2NoZW1lOiBzdHJpbmcsIHByb3ZpZGVyOiB2c2NvZGUuRmlsZVNlYXJjaFByb3ZpZGVyKSA9PiB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ2ZpbGVTZWFyY2hQcm92aWRlcicpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFNlYXJjaC5yZWdpc3RlckZpbGVTZWFyY2hQcm92aWRlck9sZChzY2hlbWUsIHByb3ZpZGVyKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlclRleHRTZWFyY2hQcm92aWRlcjogKHNjaGVtZTogc3RyaW5nLCBwcm92aWRlcjogdnNjb2RlLlRleHRTZWFyY2hQcm92aWRlcikgPT4ge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICd0ZXh0U2VhcmNoUHJvdmlkZXInKTtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RTZWFyY2gucmVnaXN0ZXJUZXh0U2VhcmNoUHJvdmlkZXJPbGQoc2NoZW1lLCBwcm92aWRlcik7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJBSVRleHRTZWFyY2hQcm92aWRlcjogKHNjaGVtZTogc3RyaW5nLCBwcm92aWRlcjogdnNjb2RlLkFJVGV4dFNlYXJjaFByb3ZpZGVyKSA9PiB7XG5cdFx0XHRcdC8vIHRoZXJlIGFyZSBzb21lIGRlcGVuZGVuY2llcyBvbiB0ZXh0U2VhcmNoUHJvdmlkZXIsIHNvIHdlIG5lZWQgdG8gY2hlY2sgZm9yIGJvdGhcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnYWlUZXh0U2VhcmNoUHJvdmlkZXInKTtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAndGV4dFNlYXJjaFByb3ZpZGVyMicpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFNlYXJjaC5yZWdpc3RlckFJVGV4dFNlYXJjaFByb3ZpZGVyKHNjaGVtZSwgcHJvdmlkZXIpO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyRmlsZVNlYXJjaFByb3ZpZGVyMjogKHNjaGVtZTogc3RyaW5nLCBwcm92aWRlcjogdnNjb2RlLkZpbGVTZWFyY2hQcm92aWRlcjIpID0+IHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnZmlsZVNlYXJjaFByb3ZpZGVyMicpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFNlYXJjaC5yZWdpc3RlckZpbGVTZWFyY2hQcm92aWRlcihzY2hlbWUsIHByb3ZpZGVyKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlclRleHRTZWFyY2hQcm92aWRlcjI6IChzY2hlbWU6IHN0cmluZywgcHJvdmlkZXI6IHZzY29kZS5UZXh0U2VhcmNoUHJvdmlkZXIyKSA9PiB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ3RleHRTZWFyY2hQcm92aWRlcjInKTtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RTZWFyY2gucmVnaXN0ZXJUZXh0U2VhcmNoUHJvdmlkZXIoc2NoZW1lLCBwcm92aWRlcik7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJSZW1vdGVBdXRob3JpdHlSZXNvbHZlcjogKGF1dGhvcml0eVByZWZpeDogc3RyaW5nLCByZXNvbHZlcjogdnNjb2RlLlJlbW90ZUF1dGhvcml0eVJlc29sdmVyKSA9PiB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ3Jlc29sdmVycycpO1xuXHRcdFx0XHRyZXR1cm4gZXh0ZW5zaW9uU2VydmljZS5yZWdpc3RlclJlbW90ZUF1dGhvcml0eVJlc29sdmVyKGF1dGhvcml0eVByZWZpeCwgcmVzb2x2ZXIpO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyUmVzb3VyY2VMYWJlbEZvcm1hdHRlcjogKGZvcm1hdHRlcjogdnNjb2RlLlJlc291cmNlTGFiZWxGb3JtYXR0ZXIpID0+IHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAncmVzb2x2ZXJzJyk7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0TGFiZWxTZXJ2aWNlLiRyZWdpc3RlclJlc291cmNlTGFiZWxGb3JtYXR0ZXIoZm9ybWF0dGVyKTtcblx0XHRcdH0sXG5cdFx0XHRnZXRSZW1vdGVFeGVjU2VydmVyOiAoYXV0aG9yaXR5OiBzdHJpbmcpID0+IHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAncmVzb2x2ZXJzJyk7XG5cdFx0XHRcdHJldHVybiBleHRlbnNpb25TZXJ2aWNlLmdldFJlbW90ZUV4ZWNTZXJ2ZXIoYXV0aG9yaXR5KTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZENyZWF0ZUZpbGVzOiAobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKSA9PiB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0RmlsZVN5c3RlbUV2ZW50Lm9uRGlkQ3JlYXRlRmlsZSkobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZERlbGV0ZUZpbGVzOiAobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKSA9PiB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0RmlsZVN5c3RlbUV2ZW50Lm9uRGlkRGVsZXRlRmlsZSkobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZFJlbmFtZUZpbGVzOiAobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKSA9PiB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0RmlsZVN5c3RlbUV2ZW50Lm9uRGlkUmVuYW1lRmlsZSkobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRvbldpbGxDcmVhdGVGaWxlczogKGxpc3RlbmVyOiAoZTogdnNjb2RlLkZpbGVXaWxsQ3JlYXRlRXZlbnQpID0+IGFueSwgdGhpc0FyZz86IGFueSwgZGlzcG9zYWJsZXM/OiB2c2NvZGUuRGlzcG9zYWJsZVtdKSA9PiB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0RmlsZVN5c3RlbUV2ZW50LmdldE9uV2lsbENyZWF0ZUZpbGVFdmVudChleHRlbnNpb24pKShsaXN0ZW5lciwgdGhpc0FyZywgZGlzcG9zYWJsZXMpO1xuXHRcdFx0fSxcblx0XHRcdG9uV2lsbERlbGV0ZUZpbGVzOiAobGlzdGVuZXI6IChlOiB2c2NvZGUuRmlsZVdpbGxEZWxldGVFdmVudCkgPT4gYW55LCB0aGlzQXJnPzogYW55LCBkaXNwb3NhYmxlcz86IHZzY29kZS5EaXNwb3NhYmxlW10pID0+IHtcblx0XHRcdFx0cmV0dXJuIF9hc0V4dGVuc2lvbkV2ZW50KGV4dEhvc3RGaWxlU3lzdGVtRXZlbnQuZ2V0T25XaWxsRGVsZXRlRmlsZUV2ZW50KGV4dGVuc2lvbikpKGxpc3RlbmVyLCB0aGlzQXJnLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0b25XaWxsUmVuYW1lRmlsZXM6IChsaXN0ZW5lcjogKGU6IHZzY29kZS5GaWxlV2lsbFJlbmFtZUV2ZW50KSA9PiBhbnksIHRoaXNBcmc/OiBhbnksIGRpc3Bvc2FibGVzPzogdnNjb2RlLkRpc3Bvc2FibGVbXSkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdEZpbGVTeXN0ZW1FdmVudC5nZXRPbldpbGxSZW5hbWVGaWxlRXZlbnQoZXh0ZW5zaW9uKSkobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRvcGVuVHVubmVsOiAoZm9yd2FyZDogdnNjb2RlLlR1bm5lbE9wdGlvbnMpID0+IHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAndHVubmVscycpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFR1bm5lbFNlcnZpY2Uub3BlblR1bm5lbChleHRlbnNpb24sIGZvcndhcmQpLnRoZW4odmFsdWUgPT4ge1xuXHRcdFx0XHRcdGlmICghdmFsdWUpIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignY2Fubm90IG9wZW4gdHVubmVsJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IHR1bm5lbHMoKSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ3R1bm5lbHMnKTtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RUdW5uZWxTZXJ2aWNlLmdldFR1bm5lbHMoKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZENoYW5nZVR1bm5lbHM6IChsaXN0ZW5lciwgdGhpc0FyZz8sIGRpc3Bvc2FibGVzPykgPT4ge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICd0dW5uZWxzJyk7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0VHVubmVsU2VydmljZS5vbkRpZENoYW5nZVR1bm5lbHMpKGxpc3RlbmVyLCB0aGlzQXJnLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJQb3J0QXR0cmlidXRlc1Byb3ZpZGVyOiAocG9ydFNlbGVjdG9yOiB2c2NvZGUuUG9ydEF0dHJpYnV0ZXNTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5Qb3J0QXR0cmlidXRlc1Byb3ZpZGVyKSA9PiB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ3BvcnRzQXR0cmlidXRlcycpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFR1bm5lbFNlcnZpY2UucmVnaXN0ZXJQb3J0c0F0dHJpYnV0ZXNQcm92aWRlcihwb3J0U2VsZWN0b3IsIHByb3ZpZGVyKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlclR1bm5lbFByb3ZpZGVyOiAodHVubmVsUHJvdmlkZXI6IHZzY29kZS5UdW5uZWxQcm92aWRlciwgaW5mb3JtYXRpb246IHZzY29kZS5UdW5uZWxJbmZvcm1hdGlvbikgPT4ge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICd0dW5uZWxGYWN0b3J5Jyk7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0VHVubmVsU2VydmljZS5yZWdpc3RlclR1bm5lbFByb3ZpZGVyKHR1bm5lbFByb3ZpZGVyLCBpbmZvcm1hdGlvbik7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJUaW1lbGluZVByb3ZpZGVyOiAoc2NoZW1lOiBzdHJpbmcgfCBzdHJpbmdbXSwgcHJvdmlkZXI6IHZzY29kZS5UaW1lbGluZVByb3ZpZGVyKSA9PiB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ3RpbWVsaW5lJyk7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0VGltZWxpbmUucmVnaXN0ZXJUaW1lbGluZVByb3ZpZGVyKHNjaGVtZSwgcHJvdmlkZXIsIGV4dGVuc2lvbi5pZGVudGlmaWVyLCBleHRIb3N0Q29tbWFuZHMuY29udmVydGVyKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgaXNUcnVzdGVkKCkge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFdvcmtzcGFjZS50cnVzdGVkO1xuXHRcdFx0fSxcblx0XHRcdHJlcXVlc3RXb3Jrc3BhY2VUcnVzdDogKG9wdGlvbnM/OiB2c2NvZGUuV29ya3NwYWNlVHJ1c3RSZXF1ZXN0T3B0aW9ucykgPT4ge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICd3b3Jrc3BhY2VUcnVzdCcpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFdvcmtzcGFjZS5yZXF1ZXN0V29ya3NwYWNlVHJ1c3Qob3B0aW9ucyk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRHcmFudFdvcmtzcGFjZVRydXN0OiAobGlzdGVuZXIsIHRoaXNBcmdzPywgZGlzcG9zYWJsZXM/KSA9PiB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0V29ya3NwYWNlLm9uRGlkR3JhbnRXb3Jrc3BhY2VUcnVzdCkobGlzdGVuZXIsIHRoaXNBcmdzLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJFZGl0U2Vzc2lvbklkZW50aXR5UHJvdmlkZXI6IChzY2hlbWU6IHN0cmluZywgcHJvdmlkZXI6IHZzY29kZS5FZGl0U2Vzc2lvbklkZW50aXR5UHJvdmlkZXIpID0+IHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnZWRpdFNlc3Npb25JZGVudGl0eVByb3ZpZGVyJyk7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0V29ya3NwYWNlLnJlZ2lzdGVyRWRpdFNlc3Npb25JZGVudGl0eVByb3ZpZGVyKHNjaGVtZSwgcHJvdmlkZXIpO1xuXHRcdFx0fSxcblx0XHRcdG9uV2lsbENyZWF0ZUVkaXRTZXNzaW9uSWRlbnRpdHk6IChsaXN0ZW5lciwgdGhpc0FyZ3M/LCBkaXNwb3NhYmxlcz8pID0+IHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnZWRpdFNlc3Npb25JZGVudGl0eVByb3ZpZGVyJyk7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0V29ya3NwYWNlLmdldE9uV2lsbENyZWF0ZUVkaXRTZXNzaW9uSWRlbnRpdHlFdmVudChleHRlbnNpb24pKShsaXN0ZW5lciwgdGhpc0FyZ3MsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlckNhbm9uaWNhbFVyaVByb3ZpZGVyOiAoc2NoZW1lOiBzdHJpbmcsIHByb3ZpZGVyOiB2c2NvZGUuQ2Fub25pY2FsVXJpUHJvdmlkZXIpID0+IHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnY2Fub25pY2FsVXJpUHJvdmlkZXInKTtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RXb3Jrc3BhY2UucmVnaXN0ZXJDYW5vbmljYWxVcmlQcm92aWRlcihzY2hlbWUsIHByb3ZpZGVyKTtcblx0XHRcdH0sXG5cdFx0XHRnZXRDYW5vbmljYWxVcmk6ICh1cmk6IHZzY29kZS5VcmksIG9wdGlvbnM6IHZzY29kZS5DYW5vbmljYWxVcmlSZXF1ZXN0T3B0aW9ucywgdG9rZW46IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbikgPT4ge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdjYW5vbmljYWxVcmlQcm92aWRlcicpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFdvcmtzcGFjZS5wcm92aWRlQ2Fub25pY2FsVXJpKHVyaSwgb3B0aW9ucywgdG9rZW4pO1xuXHRcdFx0fSxcblx0XHRcdGRlY29kZShjb250ZW50OiBVaW50OEFycmF5LCB1cmk6IHZzY29kZS5VcmkgfCB1bmRlZmluZWQsIG9wdGlvbnM/OiB7IGVuY29kaW5nOiBzdHJpbmcgfSkge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICd0ZXh0RG9jdW1lbnRFbmNvZGluZycpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFdvcmtzcGFjZS5kZWNvZGUoY29udGVudCwgdXJpLCBvcHRpb25zKTtcblx0XHRcdH0sXG5cdFx0XHRlbmNvZGUoY29udGVudDogc3RyaW5nLCB1cmk6IHZzY29kZS5VcmkgfCB1bmRlZmluZWQsIG9wdGlvbnM/OiB7IGVuY29kaW5nOiBzdHJpbmcgfSkge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICd0ZXh0RG9jdW1lbnRFbmNvZGluZycpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFdvcmtzcGFjZS5lbmNvZGUoY29udGVudCwgdXJpLCBvcHRpb25zKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Ly8gbmFtZXNwYWNlOiBzY21cblx0XHRjb25zdCBzY206IHR5cGVvZiB2c2NvZGUuc2NtID0ge1xuXHRcdFx0Z2V0IGlucHV0Qm94KCkge1xuXHRcdFx0XHRleHRIb3N0QXBpRGVwcmVjYXRpb24ucmVwb3J0KCdzY20uaW5wdXRCb3gnLCBleHRlbnNpb24sXG5cdFx0XHRcdFx0YFVzZSAnU291cmNlQ29udHJvbC5pbnB1dEJveCcgaW5zdGVhZGApO1xuXG5cdFx0XHRcdHJldHVybiBleHRIb3N0U0NNLmdldExhc3RJbnB1dEJveChleHRlbnNpb24pITsgLy8gU3RyaWN0IG51bGwgb3ZlcnJpZGUgLSBEZXByZWNhdGVkIGFwaVxuXHRcdFx0fSxcblx0XHRcdGNyZWF0ZVNvdXJjZUNvbnRyb2woaWQ6IHN0cmluZywgbGFiZWw6IHN0cmluZywgcm9vdFVyaT86IHZzY29kZS5VcmkpIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RTQ00uY3JlYXRlU291cmNlQ29udHJvbChleHRlbnNpb24sIGlkLCBsYWJlbCwgcm9vdFVyaSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8vIG5hbWVzcGFjZTogY29tbWVudHNcblx0XHRjb25zdCBjb21tZW50czogdHlwZW9mIHZzY29kZS5jb21tZW50cyA9IHtcblx0XHRcdGNyZWF0ZUNvbW1lbnRDb250cm9sbGVyKGlkOiBzdHJpbmcsIGxhYmVsOiBzdHJpbmcpIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RDb21tZW50LmNyZWF0ZUNvbW1lbnRDb250cm9sbGVyKGV4dGVuc2lvbiwgaWQsIGxhYmVsKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Ly8gbmFtZXNwYWNlOiBkZWJ1Z1xuXHRcdGNvbnN0IGRlYnVnOiB0eXBlb2YgdnNjb2RlLmRlYnVnID0ge1xuXHRcdFx0Z2V0IGFjdGl2ZURlYnVnU2Vzc2lvbigpIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3REZWJ1Z1NlcnZpY2UuYWN0aXZlRGVidWdTZXNzaW9uO1xuXHRcdFx0fSxcblx0XHRcdGdldCBhY3RpdmVEZWJ1Z0NvbnNvbGUoKSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0RGVidWdTZXJ2aWNlLmFjdGl2ZURlYnVnQ29uc29sZTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgYnJlYWtwb2ludHMoKSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0RGVidWdTZXJ2aWNlLmJyZWFrcG9pbnRzO1xuXHRcdFx0fSxcblx0XHRcdGdldCBhY3RpdmVTdGFja0l0ZW0oKSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0RGVidWdTZXJ2aWNlLmFjdGl2ZVN0YWNrSXRlbTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlckRlYnVnVmlzdWFsaXphdGlvblByb3ZpZGVyKGlkLCBwcm92aWRlcikge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdkZWJ1Z1Zpc3VhbGl6YXRpb24nKTtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3REZWJ1Z1NlcnZpY2UucmVnaXN0ZXJEZWJ1Z1Zpc3VhbGl6YXRpb25Qcm92aWRlcihleHRlbnNpb24sIGlkLCBwcm92aWRlcik7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJEZWJ1Z1Zpc3VhbGl6YXRpb25UcmVlUHJvdmlkZXIoaWQsIHByb3ZpZGVyKSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ2RlYnVnVmlzdWFsaXphdGlvbicpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdERlYnVnU2VydmljZS5yZWdpc3RlckRlYnVnVmlzdWFsaXphdGlvblRyZWUoZXh0ZW5zaW9uLCBpZCwgcHJvdmlkZXIpO1xuXHRcdFx0fSxcblx0XHRcdG9uRGlkU3RhcnREZWJ1Z1Nlc3Npb24obGlzdGVuZXIsIHRoaXNBcmc/LCBkaXNwb3NhYmxlcz8pIHtcblx0XHRcdFx0cmV0dXJuIF9hc0V4dGVuc2lvbkV2ZW50KGV4dEhvc3REZWJ1Z1NlcnZpY2Uub25EaWRTdGFydERlYnVnU2Vzc2lvbikobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZFRlcm1pbmF0ZURlYnVnU2Vzc2lvbihsaXN0ZW5lciwgdGhpc0FyZz8sIGRpc3Bvc2FibGVzPykge1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdERlYnVnU2VydmljZS5vbkRpZFRlcm1pbmF0ZURlYnVnU2Vzc2lvbikobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZENoYW5nZUFjdGl2ZURlYnVnU2Vzc2lvbihsaXN0ZW5lciwgdGhpc0FyZz8sIGRpc3Bvc2FibGVzPykge1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdERlYnVnU2VydmljZS5vbkRpZENoYW5nZUFjdGl2ZURlYnVnU2Vzc2lvbikobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZFJlY2VpdmVEZWJ1Z1Nlc3Npb25DdXN0b21FdmVudChsaXN0ZW5lciwgdGhpc0FyZz8sIGRpc3Bvc2FibGVzPykge1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdERlYnVnU2VydmljZS5vbkRpZFJlY2VpdmVEZWJ1Z1Nlc3Npb25DdXN0b21FdmVudCkobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZENoYW5nZUJyZWFrcG9pbnRzKGxpc3RlbmVyLCB0aGlzQXJncz8sIGRpc3Bvc2FibGVzPykge1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdERlYnVnU2VydmljZS5vbkRpZENoYW5nZUJyZWFrcG9pbnRzKShsaXN0ZW5lciwgdGhpc0FyZ3MsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZENoYW5nZUFjdGl2ZVN0YWNrSXRlbShsaXN0ZW5lciwgdGhpc0FyZz8sIGRpc3Bvc2FibGVzPykge1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdERlYnVnU2VydmljZS5vbkRpZENoYW5nZUFjdGl2ZVN0YWNrSXRlbSkobGlzdGVuZXIsIHRoaXNBcmcsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlckRlYnVnQ29uZmlndXJhdGlvblByb3ZpZGVyKGRlYnVnVHlwZTogc3RyaW5nLCBwcm92aWRlcjogdnNjb2RlLkRlYnVnQ29uZmlndXJhdGlvblByb3ZpZGVyLCB0cmlnZ2VyS2luZD86IHZzY29kZS5EZWJ1Z0NvbmZpZ3VyYXRpb25Qcm92aWRlclRyaWdnZXJLaW5kKSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0RGVidWdTZXJ2aWNlLnJlZ2lzdGVyRGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXIoZGVidWdUeXBlLCBwcm92aWRlciwgdHJpZ2dlcktpbmQgfHwgRGVidWdDb25maWd1cmF0aW9uUHJvdmlkZXJUcmlnZ2VyS2luZC5Jbml0aWFsKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlckRlYnVnQWRhcHRlckRlc2NyaXB0b3JGYWN0b3J5KGRlYnVnVHlwZTogc3RyaW5nLCBmYWN0b3J5OiB2c2NvZGUuRGVidWdBZGFwdGVyRGVzY3JpcHRvckZhY3RvcnkpIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3REZWJ1Z1NlcnZpY2UucmVnaXN0ZXJEZWJ1Z0FkYXB0ZXJEZXNjcmlwdG9yRmFjdG9yeShleHRlbnNpb24sIGRlYnVnVHlwZSwgZmFjdG9yeSk7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJEZWJ1Z0FkYXB0ZXJUcmFja2VyRmFjdG9yeShkZWJ1Z1R5cGU6IHN0cmluZywgZmFjdG9yeTogdnNjb2RlLkRlYnVnQWRhcHRlclRyYWNrZXJGYWN0b3J5KSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0RGVidWdTZXJ2aWNlLnJlZ2lzdGVyRGVidWdBZGFwdGVyVHJhY2tlckZhY3RvcnkoZGVidWdUeXBlLCBmYWN0b3J5KTtcblx0XHRcdH0sXG5cdFx0XHRzdGFydERlYnVnZ2luZyhmb2xkZXI6IHZzY29kZS5Xb3Jrc3BhY2VGb2xkZXIgfCB1bmRlZmluZWQsIG5hbWVPckNvbmZpZzogc3RyaW5nIHwgdnNjb2RlLkRlYnVnQ29uZmlndXJhdGlvbiwgcGFyZW50U2Vzc2lvbk9yT3B0aW9ucz86IHZzY29kZS5EZWJ1Z1Nlc3Npb24gfCB2c2NvZGUuRGVidWdTZXNzaW9uT3B0aW9ucykge1xuXHRcdFx0XHRpZiAoIXBhcmVudFNlc3Npb25Pck9wdGlvbnMgfHwgKHR5cGVvZiBwYXJlbnRTZXNzaW9uT3JPcHRpb25zID09PSAnb2JqZWN0JyAmJiAnY29uZmlndXJhdGlvbicgaW4gcGFyZW50U2Vzc2lvbk9yT3B0aW9ucykpIHtcblx0XHRcdFx0XHRyZXR1cm4gZXh0SG9zdERlYnVnU2VydmljZS5zdGFydERlYnVnZ2luZyhmb2xkZXIsIG5hbWVPckNvbmZpZywgeyBwYXJlbnRTZXNzaW9uOiBwYXJlbnRTZXNzaW9uT3JPcHRpb25zIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBleHRIb3N0RGVidWdTZXJ2aWNlLnN0YXJ0RGVidWdnaW5nKGZvbGRlciwgbmFtZU9yQ29uZmlnLCBwYXJlbnRTZXNzaW9uT3JPcHRpb25zIHx8IHt9KTtcblx0XHRcdH0sXG5cdFx0XHRzdG9wRGVidWdnaW5nKHNlc3Npb24/OiB2c2NvZGUuRGVidWdTZXNzaW9uKSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0RGVidWdTZXJ2aWNlLnN0b3BEZWJ1Z2dpbmcoc2Vzc2lvbik7XG5cdFx0XHR9LFxuXHRcdFx0YWRkQnJlYWtwb2ludHMoYnJlYWtwb2ludHM6IHJlYWRvbmx5IHZzY29kZS5CcmVha3BvaW50W10pIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3REZWJ1Z1NlcnZpY2UuYWRkQnJlYWtwb2ludHMoYnJlYWtwb2ludHMpO1xuXHRcdFx0fSxcblx0XHRcdHJlbW92ZUJyZWFrcG9pbnRzKGJyZWFrcG9pbnRzOiByZWFkb25seSB2c2NvZGUuQnJlYWtwb2ludFtdKSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0RGVidWdTZXJ2aWNlLnJlbW92ZUJyZWFrcG9pbnRzKGJyZWFrcG9pbnRzKTtcblx0XHRcdH0sXG5cdFx0XHRhc0RlYnVnU291cmNlVXJpKHNvdXJjZTogdnNjb2RlLkRlYnVnUHJvdG9jb2xTb3VyY2UsIHNlc3Npb24/OiB2c2NvZGUuRGVidWdTZXNzaW9uKTogdnNjb2RlLlVyaSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0RGVidWdTZXJ2aWNlLmFzRGVidWdTb3VyY2VVcmkoc291cmNlLCBzZXNzaW9uKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgdGFza3M6IHR5cGVvZiB2c2NvZGUudGFza3MgPSB7XG5cdFx0XHRyZWdpc3RlclRhc2tQcm92aWRlcjogKHR5cGU6IHN0cmluZywgcHJvdmlkZXI6IHZzY29kZS5UYXNrUHJvdmlkZXIpID0+IHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RUYXNrLnJlZ2lzdGVyVGFza1Byb3ZpZGVyKGV4dGVuc2lvbiwgdHlwZSwgcHJvdmlkZXIpO1xuXHRcdFx0fSxcblx0XHRcdGZldGNoVGFza3M6IChmaWx0ZXI/OiB2c2NvZGUuVGFza0ZpbHRlcik6IFRoZW5hYmxlPHZzY29kZS5UYXNrW10+ID0+IHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RUYXNrLmZldGNoVGFza3MoZmlsdGVyKTtcblx0XHRcdH0sXG5cdFx0XHRleGVjdXRlVGFzazogKHRhc2s6IHZzY29kZS5UYXNrKTogVGhlbmFibGU8dnNjb2RlLlRhc2tFeGVjdXRpb24+ID0+IHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RUYXNrLmV4ZWN1dGVUYXNrKGV4dGVuc2lvbiwgdGFzayk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IHRhc2tFeGVjdXRpb25zKCk6IHZzY29kZS5UYXNrRXhlY3V0aW9uW10ge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFRhc2sudGFza0V4ZWN1dGlvbnM7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRTdGFydFRhc2s6IChsaXN0ZW5lcnMsIHRoaXNBcmdzPywgZGlzcG9zYWJsZXM/KSA9PiB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0VGFzay5vbkRpZFN0YXJ0VGFzaykobGlzdGVuZXJzLCB0aGlzQXJncywgZGlzcG9zYWJsZXMpO1xuXHRcdFx0fSxcblx0XHRcdG9uRGlkRW5kVGFzazogKGxpc3RlbmVycywgdGhpc0FyZ3M/LCBkaXNwb3NhYmxlcz8pID0+IHtcblx0XHRcdFx0cmV0dXJuIF9hc0V4dGVuc2lvbkV2ZW50KGV4dEhvc3RUYXNrLm9uRGlkRW5kVGFzaykobGlzdGVuZXJzLCB0aGlzQXJncywgZGlzcG9zYWJsZXMpO1xuXHRcdFx0fSxcblx0XHRcdG9uRGlkU3RhcnRUYXNrUHJvY2VzczogKGxpc3RlbmVycywgdGhpc0FyZ3M/LCBkaXNwb3NhYmxlcz8pID0+IHtcblx0XHRcdFx0cmV0dXJuIF9hc0V4dGVuc2lvbkV2ZW50KGV4dEhvc3RUYXNrLm9uRGlkU3RhcnRUYXNrUHJvY2VzcykobGlzdGVuZXJzLCB0aGlzQXJncywgZGlzcG9zYWJsZXMpO1xuXHRcdFx0fSxcblx0XHRcdG9uRGlkRW5kVGFza1Byb2Nlc3M6IChsaXN0ZW5lcnMsIHRoaXNBcmdzPywgZGlzcG9zYWJsZXM/KSA9PiB7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0VGFzay5vbkRpZEVuZFRhc2tQcm9jZXNzKShsaXN0ZW5lcnMsIHRoaXNBcmdzLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRTdGFydFRhc2tQcm9ibGVtTWF0Y2hlcnM6IChsaXN0ZW5lcnMsIHRoaXNBcmdzPywgZGlzcG9zYWJsZXM/KSA9PiB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ3Rhc2tQcm9ibGVtTWF0Y2hlclN0YXR1cycpO1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdFRhc2sub25EaWRTdGFydFRhc2tQcm9ibGVtTWF0Y2hlcnMpKGxpc3RlbmVycywgdGhpc0FyZ3MsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZEVuZFRhc2tQcm9ibGVtTWF0Y2hlcnM6IChsaXN0ZW5lcnMsIHRoaXNBcmdzPywgZGlzcG9zYWJsZXM/KSA9PiB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ3Rhc2tQcm9ibGVtTWF0Y2hlclN0YXR1cycpO1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdFRhc2sub25EaWRFbmRUYXNrUHJvYmxlbU1hdGNoZXJzKShsaXN0ZW5lcnMsIHRoaXNBcmdzLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8vIG5hbWVzcGFjZTogbm90ZWJvb2tcblx0XHRjb25zdCBub3RlYm9va3M6IHR5cGVvZiB2c2NvZGUubm90ZWJvb2tzID0ge1xuXHRcdFx0Y3JlYXRlTm90ZWJvb2tDb250cm9sbGVyKGlkOiBzdHJpbmcsIG5vdGVib29rVHlwZTogc3RyaW5nLCBsYWJlbDogc3RyaW5nLCBoYW5kbGVyPywgcmVuZGVyZXJTY3JpcHRzPzogdnNjb2RlLk5vdGVib29rUmVuZGVyZXJTY3JpcHRbXSkge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdE5vdGVib29rS2VybmVscy5jcmVhdGVOb3RlYm9va0NvbnRyb2xsZXIoZXh0ZW5zaW9uLCBpZCwgbm90ZWJvb2tUeXBlLCBsYWJlbCwgaGFuZGxlciwgaXNQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnbm90ZWJvb2tNZXNzYWdpbmcnKSA/IHJlbmRlcmVyU2NyaXB0cyA6IHVuZGVmaW5lZCk7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJOb3RlYm9va0NlbGxTdGF0dXNCYXJJdGVtUHJvdmlkZXI6IChub3RlYm9va1R5cGU6IHN0cmluZywgcHJvdmlkZXI6IHZzY29kZS5Ob3RlYm9va0NlbGxTdGF0dXNCYXJJdGVtUHJvdmlkZXIpID0+IHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3ROb3RlYm9vay5yZWdpc3Rlck5vdGVib29rQ2VsbFN0YXR1c0Jhckl0ZW1Qcm92aWRlcihleHRlbnNpb24sIG5vdGVib29rVHlwZSwgcHJvdmlkZXIpO1xuXHRcdFx0fSxcblx0XHRcdGNyZWF0ZVJlbmRlcmVyTWVzc2FnaW5nKHJlbmRlcmVySWQpIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3ROb3RlYm9va1JlbmRlcmVycy5jcmVhdGVSZW5kZXJlck1lc3NhZ2luZyhleHRlbnNpb24sIHJlbmRlcmVySWQpO1xuXHRcdFx0fSxcblx0XHRcdGNyZWF0ZU5vdGVib29rQ29udHJvbGxlckRldGVjdGlvblRhc2sobm90ZWJvb2tUeXBlOiBzdHJpbmcpIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnbm90ZWJvb2tLZXJuZWxTb3VyY2UnKTtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3ROb3RlYm9va0tlcm5lbHMuY3JlYXRlTm90ZWJvb2tDb250cm9sbGVyRGV0ZWN0aW9uVGFzayhleHRlbnNpb24sIG5vdGVib29rVHlwZSk7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJLZXJuZWxTb3VyY2VBY3Rpb25Qcm92aWRlcihub3RlYm9va1R5cGU6IHN0cmluZywgcHJvdmlkZXI6IHZzY29kZS5Ob3RlYm9va0tlcm5lbFNvdXJjZUFjdGlvblByb3ZpZGVyKSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ25vdGVib29rS2VybmVsU291cmNlJyk7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0Tm90ZWJvb2tLZXJuZWxzLnJlZ2lzdGVyS2VybmVsU291cmNlQWN0aW9uUHJvdmlkZXIoZXh0ZW5zaW9uLCBub3RlYm9va1R5cGUsIHByb3ZpZGVyKTtcblx0XHRcdH0sXG5cdFx0XHRvbkRpZENoYW5nZU5vdGVib29rQ2VsbEV4ZWN1dGlvblN0YXRlKGxpc3RlbmVyLCB0aGlzQXJncz8sIGRpc3Bvc2FibGVzPykge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdub3RlYm9va0NlbGxFeGVjdXRpb25TdGF0ZScpO1xuXHRcdFx0XHRyZXR1cm4gX2FzRXh0ZW5zaW9uRXZlbnQoZXh0SG9zdE5vdGVib29rS2VybmVscy5vbkRpZENoYW5nZU5vdGVib29rQ2VsbEV4ZWN1dGlvblN0YXRlKShsaXN0ZW5lciwgdGhpc0FyZ3MsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Ly8gbmFtZXNwYWNlOiBsMTBuXG5cdFx0Y29uc3QgbDEwbjogdHlwZW9mIHZzY29kZS5sMTBuID0ge1xuXHRcdFx0dCguLi5wYXJhbXM6IFttZXNzYWdlOiBzdHJpbmcsIC4uLmFyZ3M6IEFycmF5PHN0cmluZyB8IG51bWJlciB8IGJvb2xlYW4+XSB8IFttZXNzYWdlOiBzdHJpbmcsIGFyZ3M6IFJlY29yZDxzdHJpbmcsIGFueT5dIHwgW3sgbWVzc2FnZTogc3RyaW5nOyBhcmdzPzogQXJyYXk8c3RyaW5nIHwgbnVtYmVyIHwgYm9vbGVhbj4gfCBSZWNvcmQ8c3RyaW5nLCBhbnk+OyBjb21tZW50OiBzdHJpbmcgfCBzdHJpbmdbXSB9XSk6IHN0cmluZyB7XG5cdFx0XHRcdGlmICh0eXBlb2YgcGFyYW1zWzBdID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdGNvbnN0IGtleSA9IHBhcmFtcy5zaGlmdCgpIGFzIHN0cmluZztcblxuXHRcdFx0XHRcdC8vIFdlIGhhdmUgZWl0aGVyIHJlc3QgYXJncyB3aGljaCBhcmUgQXJyYXk8c3RyaW5nIHwgbnVtYmVyIHwgYm9vbGVhbj4gb3IgYW4gYXJyYXkgd2l0aCBhIHNpbmdsZSBSZWNvcmQ8c3RyaW5nLCBhbnk+LlxuXHRcdFx0XHRcdC8vIFRoaXMgZW5zdXJlcyB3ZSBnZXQgYSBSZWNvcmQ8c3RyaW5nIHwgbnVtYmVyLCBhbnk+IHdoaWNoIHdpbGwgYmUgZm9ybWF0dGVkIGNvcnJlY3RseS5cblx0XHRcdFx0XHRjb25zdCBhcmdzRm9ybWF0dGVkID0gIXBhcmFtcyB8fCB0eXBlb2YgcGFyYW1zWzBdICE9PSAnb2JqZWN0JyA/IHBhcmFtcyA6IHBhcmFtc1swXTtcblx0XHRcdFx0XHRyZXR1cm4gZXh0SG9zdExvY2FsaXphdGlvbi5nZXRNZXNzYWdlKGV4dGVuc2lvbi5pZGVudGlmaWVyLnZhbHVlLCB7IG1lc3NhZ2U6IGtleSwgYXJnczogYXJnc0Zvcm1hdHRlZCBhcyBSZWNvcmQ8c3RyaW5nIHwgbnVtYmVyLCBhbnk+IHwgdW5kZWZpbmVkIH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RMb2NhbGl6YXRpb24uZ2V0TWVzc2FnZShleHRlbnNpb24uaWRlbnRpZmllci52YWx1ZSwgcGFyYW1zWzBdKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgYnVuZGxlKCkge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExvY2FsaXphdGlvbi5nZXRCdW5kbGUoZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWUpO1xuXHRcdFx0fSxcblx0XHRcdGdldCB1cmkoKSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0TG9jYWxpemF0aW9uLmdldEJ1bmRsZVVyaShleHRlbnNpb24uaWRlbnRpZmllci52YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8vIG5hbWVzcGFjZTogaW50ZXJhY3RpdmVcblx0XHRjb25zdCBpbnRlcmFjdGl2ZTogdHlwZW9mIHZzY29kZS5pbnRlcmFjdGl2ZSA9IHtcblx0XHRcdHRyYW5zZmVyQWN0aXZlQ2hhdCh0b1dvcmtzcGFjZTogdnNjb2RlLlVyaSkge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdpbnRlcmFjdGl2ZScpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdENoYXRBZ2VudHMyLnRyYW5zZmVyQWN0aXZlQ2hhdCh0b1dvcmtzcGFjZSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8vIG5hbWVzcGFjZTogYWlcblx0XHRjb25zdCBhaTogdHlwZW9mIHZzY29kZS5haSA9IHtcblx0XHRcdGdldFJlbGF0ZWRJbmZvcm1hdGlvbihxdWVyeTogc3RyaW5nLCB0eXBlczogdnNjb2RlLlJlbGF0ZWRJbmZvcm1hdGlvblR5cGVbXSk6IFRoZW5hYmxlPHZzY29kZS5SZWxhdGVkSW5mb3JtYXRpb25SZXN1bHRbXT4ge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdhaVJlbGF0ZWRJbmZvcm1hdGlvbicpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdEFpUmVsYXRlZEluZm9ybWF0aW9uLmdldFJlbGF0ZWRJbmZvcm1hdGlvbihleHRlbnNpb24sIHF1ZXJ5LCB0eXBlcyk7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJSZWxhdGVkSW5mb3JtYXRpb25Qcm92aWRlcih0eXBlOiB2c2NvZGUuUmVsYXRlZEluZm9ybWF0aW9uVHlwZSwgcHJvdmlkZXI6IHZzY29kZS5SZWxhdGVkSW5mb3JtYXRpb25Qcm92aWRlcikge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdhaVJlbGF0ZWRJbmZvcm1hdGlvbicpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdEFpUmVsYXRlZEluZm9ybWF0aW9uLnJlZ2lzdGVyUmVsYXRlZEluZm9ybWF0aW9uUHJvdmlkZXIoZXh0ZW5zaW9uLCB0eXBlLCBwcm92aWRlcik7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJFbWJlZGRpbmdWZWN0b3JQcm92aWRlcihtb2RlbDogc3RyaW5nLCBwcm92aWRlcjogdnNjb2RlLkVtYmVkZGluZ1ZlY3RvclByb3ZpZGVyKSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ2FpUmVsYXRlZEluZm9ybWF0aW9uJyk7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0QWlFbWJlZGRpbmdWZWN0b3IucmVnaXN0ZXJFbWJlZGRpbmdWZWN0b3JQcm92aWRlcihleHRlbnNpb24sIG1vZGVsLCBwcm92aWRlcik7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8vIG5hbWVzcGFjZTogY2hhdFxuXHRcdGNvbnN0IGNoYXQ6IHR5cGVvZiB2c2NvZGUuY2hhdCA9IHtcblx0XHRcdHJlZ2lzdGVyQ2hhdFJlc3BvbnNlUHJvdmlkZXIoaWQ6IHN0cmluZywgcHJvdmlkZXI6IHZzY29kZS5DaGF0UmVzcG9uc2VQcm92aWRlciwgbWV0YWRhdGE6IHZzY29kZS5DaGF0UmVzcG9uc2VQcm92aWRlck1ldGFkYXRhKSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ2NoYXRQcm92aWRlcicpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlTW9kZWxzLnJlZ2lzdGVyTGFuZ3VhZ2VNb2RlbChleHRlbnNpb24sIGlkLCBwcm92aWRlciwgbWV0YWRhdGEpO1xuXHRcdFx0fSxcblx0XHRcdHJlZ2lzdGVyTWFwcGVkRWRpdHNQcm92aWRlcihfc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBfcHJvdmlkZXI6IHZzY29kZS5NYXBwZWRFZGl0c1Byb3ZpZGVyKSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ21hcHBlZEVkaXRzUHJvdmlkZXInKTtcblx0XHRcdFx0Ly8gbm8gbG9uZ2VyIHN1cHBvcnRlZFxuXHRcdFx0XHRyZXR1cm4geyBkaXNwb3NlKCkgeyB9IH07XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJNYXBwZWRFZGl0c1Byb3ZpZGVyMihwcm92aWRlcjogdnNjb2RlLk1hcHBlZEVkaXRzUHJvdmlkZXIyKSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ21hcHBlZEVkaXRzUHJvdmlkZXInKTtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RDb2RlTWFwcGVyLnJlZ2lzdGVyTWFwcGVkRWRpdHNQcm92aWRlcihleHRlbnNpb24sIHByb3ZpZGVyKTtcblx0XHRcdH0sXG5cdFx0XHRjcmVhdGVDaGF0UGFydGljaXBhbnQoaWQ6IHN0cmluZywgaGFuZGxlcjogdnNjb2RlLkNoYXRFeHRlbmRlZFJlcXVlc3RIYW5kbGVyKSB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0Q2hhdEFnZW50czIuY3JlYXRlQ2hhdEFnZW50KGV4dGVuc2lvbiwgaWQsIGhhbmRsZXIpO1xuXHRcdFx0fSxcblx0XHRcdGNyZWF0ZUR5bmFtaWNDaGF0UGFydGljaXBhbnQoaWQ6IHN0cmluZywgZHluYW1pY1Byb3BzOiB2c2NvZGUuRHluYW1pY0NoYXRQYXJ0aWNpcGFudFByb3BzLCBoYW5kbGVyOiB2c2NvZGUuQ2hhdEV4dGVuZGVkUmVxdWVzdEhhbmRsZXIpOiB2c2NvZGUuQ2hhdFBhcnRpY2lwYW50IHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnY2hhdFBhcnRpY2lwYW50UHJpdmF0ZScpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdENoYXRBZ2VudHMyLmNyZWF0ZUR5bmFtaWNDaGF0QWdlbnQoZXh0ZW5zaW9uLCBpZCwgZHluYW1pY1Byb3BzLCBoYW5kbGVyKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlckNoYXRQYXJ0aWNpcGFudERldGVjdGlvblByb3ZpZGVyKHByb3ZpZGVyOiB2c2NvZGUuQ2hhdFBhcnRpY2lwYW50RGV0ZWN0aW9uUHJvdmlkZXIpIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnY2hhdFBhcnRpY2lwYW50UHJpdmF0ZScpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdENoYXRBZ2VudHMyLnJlZ2lzdGVyQ2hhdFBhcnRpY2lwYW50RGV0ZWN0aW9uUHJvdmlkZXIoZXh0ZW5zaW9uLCBwcm92aWRlcik7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJSZWxhdGVkRmlsZXNQcm92aWRlcihwcm92aWRlcjogdnNjb2RlLkNoYXRSZWxhdGVkRmlsZXNQcm92aWRlciwgbWV0YWRhdGE6IHZzY29kZS5DaGF0UmVsYXRlZEZpbGVzUHJvdmlkZXJNZXRhZGF0YSkge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdjaGF0RWRpdGluZycpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdENoYXRBZ2VudHMyLnJlZ2lzdGVyUmVsYXRlZEZpbGVzUHJvdmlkZXIoZXh0ZW5zaW9uLCBwcm92aWRlciwgbWV0YWRhdGEpO1xuXHRcdFx0fSxcblx0XHRcdG9uRGlkRGlzcG9zZUNoYXRTZXNzaW9uOiAobGlzdGVuZXJzLCB0aGlzQXJncz8sIGRpc3Bvc2FibGVzPykgPT4ge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdjaGF0UGFydGljaXBhbnRQcml2YXRlJyk7XG5cdFx0XHRcdHJldHVybiBfYXNFeHRlbnNpb25FdmVudChleHRIb3N0Q2hhdEFnZW50czIub25EaWREaXNwb3NlQ2hhdFNlc3Npb24pKGxpc3RlbmVycywgdGhpc0FyZ3MsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Ly8gbmFtZXNwYWNlOiBsbVxuXHRcdGNvbnN0IGxtOiB0eXBlb2YgdnNjb2RlLmxtID0ge1xuXHRcdFx0c2VsZWN0Q2hhdE1vZGVsczogKHNlbGVjdG9yKSA9PiB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0TGFuZ3VhZ2VNb2RlbHMuc2VsZWN0TGFuZ3VhZ2VNb2RlbHMoZXh0ZW5zaW9uLCBzZWxlY3RvciA/PyB7fSk7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRDaGFuZ2VDaGF0TW9kZWxzOiAobGlzdGVuZXIsIHRoaXNBcmdzPywgZGlzcG9zYWJsZXM/KSA9PiB7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0TGFuZ3VhZ2VNb2RlbHMub25EaWRDaGFuZ2VQcm92aWRlcnMobGlzdGVuZXIsIHRoaXNBcmdzLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJDaGF0TW9kZWxQcm92aWRlcjogKGlkLCBwcm92aWRlciwgbWV0YWRhdGEpID0+IHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnY2hhdFByb3ZpZGVyJyk7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0TGFuZ3VhZ2VNb2RlbHMucmVnaXN0ZXJMYW5ndWFnZU1vZGVsKGV4dGVuc2lvbiwgaWQsIHByb3ZpZGVyLCBtZXRhZGF0YSk7XG5cdFx0XHR9LFxuXHRcdFx0Ly8gLS0tIGVtYmVkZGluZ3Ncblx0XHRcdGdldCBlbWJlZGRpbmdNb2RlbHMoKSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ2VtYmVkZGluZ3MnKTtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RFbWJlZGRpbmdzLmVtYmVkZGluZ3NNb2RlbHM7XG5cdFx0XHR9LFxuXHRcdFx0b25EaWRDaGFuZ2VFbWJlZGRpbmdNb2RlbHM6IChsaXN0ZW5lciwgdGhpc0FyZ3M/LCBkaXNwb3NhYmxlcz8pID0+IHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnZW1iZWRkaW5ncycpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdEVtYmVkZGluZ3Mub25EaWRDaGFuZ2UobGlzdGVuZXIsIHRoaXNBcmdzLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHR9LFxuXHRcdFx0cmVnaXN0ZXJFbWJlZGRpbmdzUHJvdmlkZXIoZW1iZWRkaW5nc01vZGVsLCBwcm92aWRlcikge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdlbWJlZGRpbmdzJyk7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0RW1iZWRkaW5ncy5yZWdpc3RlckVtYmVkZGluZ3NQcm92aWRlcihleHRlbnNpb24sIGVtYmVkZGluZ3NNb2RlbCwgcHJvdmlkZXIpO1xuXHRcdFx0fSxcblx0XHRcdGFzeW5jIGNvbXB1dGVFbWJlZGRpbmdzKGVtYmVkZGluZ3NNb2RlbCwgaW5wdXQsIHRva2VuPyk6IFByb21pc2U8YW55PiB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ2VtYmVkZGluZ3MnKTtcblx0XHRcdFx0aWYgKHR5cGVvZiBpbnB1dCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRyZXR1cm4gZXh0SG9zdEVtYmVkZGluZ3MuY29tcHV0ZUVtYmVkZGluZ3MoZW1iZWRkaW5nc01vZGVsLCBpbnB1dCwgdG9rZW4pO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiBleHRIb3N0RW1iZWRkaW5ncy5jb21wdXRlRW1iZWRkaW5ncyhlbWJlZGRpbmdzTW9kZWwsIGlucHV0LCB0b2tlbik7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRyZWdpc3RlclRvb2w8VD4obmFtZTogc3RyaW5nLCB0b29sOiB2c2NvZGUuTGFuZ3VhZ2VNb2RlbFRvb2w8VD4pIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RMYW5ndWFnZU1vZGVsVG9vbHMucmVnaXN0ZXJUb29sKGV4dGVuc2lvbiwgbmFtZSwgdG9vbCk7XG5cdFx0XHR9LFxuXHRcdFx0aW52b2tlVG9vbDxUPihuYW1lOiBzdHJpbmcsIHBhcmFtZXRlcnM6IHZzY29kZS5MYW5ndWFnZU1vZGVsVG9vbEludm9jYXRpb25PcHRpb25zPFQ+LCB0b2tlbj86IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbikge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlTW9kZWxUb29scy5pbnZva2VUb29sKGV4dGVuc2lvbiwgbmFtZSwgcGFyYW1ldGVycywgdG9rZW4pO1xuXHRcdFx0fSxcblx0XHRcdGdldCB0b29scygpIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RMYW5ndWFnZU1vZGVsVG9vbHMuZ2V0VG9vbHMoZXh0ZW5zaW9uKTtcblx0XHRcdH0sXG5cdFx0XHRmaWxlSXNJZ25vcmVkKHVyaTogdnNjb2RlLlVyaSwgdG9rZW46IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbikge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlTW9kZWxzLmZpbGVJc0lnbm9yZWQoZXh0ZW5zaW9uLCB1cmksIHRva2VuKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3Rlcklnbm9yZWRGaWxlUHJvdmlkZXIocHJvdmlkZXI6IHZzY29kZS5MYW5ndWFnZU1vZGVsSWdub3JlZEZpbGVQcm92aWRlcikge1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdExhbmd1YWdlTW9kZWxzLnJlZ2lzdGVySWdub3JlZEZpbGVQcm92aWRlcihleHRlbnNpb24sIHByb3ZpZGVyKTtcblx0XHRcdH0sXG5cdFx0XHRyZWdpc3Rlck1jcENvbmZpZ3VyYXRpb25Qcm92aWRlcihpZCwgcHJvdmlkZXIpIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnbWNwQ29uZmlndXJhdGlvblByb3ZpZGVyJyk7XG5cdFx0XHRcdHJldHVybiBleHRIb3N0TWNwLnJlZ2lzdGVyTWNwQ29uZmlndXJhdGlvblByb3ZpZGVyKGV4dGVuc2lvbiwgaWQsIHByb3ZpZGVyKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Ly8gbmFtZXNwYWNlOiBzcGVlY2hcblx0XHRjb25zdCBzcGVlY2g6IHR5cGVvZiB2c2NvZGUuc3BlZWNoID0ge1xuXHRcdFx0cmVnaXN0ZXJTcGVlY2hQcm92aWRlcihpZDogc3RyaW5nLCBwcm92aWRlcjogdnNjb2RlLlNwZWVjaFByb3ZpZGVyKSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ3NwZWVjaCcpO1xuXHRcdFx0XHRyZXR1cm4gZXh0SG9zdFNwZWVjaC5yZWdpc3RlclByb3ZpZGVyKGV4dGVuc2lvbi5pZGVudGlmaWVyLCBpZCwgcHJvdmlkZXIpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbG9jYWwvY29kZS1uby1kYW5nZXJvdXMtdHlwZS1hc3NlcnRpb25zXG5cdFx0cmV0dXJuIDx0eXBlb2YgdnNjb2RlPntcblx0XHRcdHZlcnNpb246IGluaXREYXRhLnZlcnNpb24sXG5cdFx0XHQvLyBuYW1lc3BhY2VzXG5cdFx0XHRhaSxcblx0XHRcdGF1dGhlbnRpY2F0aW9uLFxuXHRcdFx0Y29tbWFuZHMsXG5cdFx0XHRjb21tZW50cyxcblx0XHRcdGNoYXQsXG5cdFx0XHRkZWJ1Zyxcblx0XHRcdGVudixcblx0XHRcdGV4dGVuc2lvbnMsXG5cdFx0XHRpbnRlcmFjdGl2ZSxcblx0XHRcdGwxMG4sXG5cdFx0XHRsYW5ndWFnZXMsXG5cdFx0XHRsbSxcblx0XHRcdG5vdGVib29rcyxcblx0XHRcdHNjbSxcblx0XHRcdHNwZWVjaCxcblx0XHRcdHRhc2tzLFxuXHRcdFx0dGVzdHMsXG5cdFx0XHR3aW5kb3csXG5cdFx0XHR3b3Jrc3BhY2UsXG5cdFx0XHQvLyB0eXBlc1xuXHRcdFx0QnJlYWtwb2ludDogZXh0SG9zdFR5cGVzLkJyZWFrcG9pbnQsXG5cdFx0XHRUZXJtaW5hbE91dHB1dEFuY2hvcjogZXh0SG9zdFR5cGVzLlRlcm1pbmFsT3V0cHV0QW5jaG9yLFxuXHRcdFx0Q2hhdFJlc3VsdEZlZWRiYWNrS2luZDogZXh0SG9zdFR5cGVzLkNoYXRSZXN1bHRGZWVkYmFja0tpbmQsXG5cdFx0XHRDaGF0VmFyaWFibGVMZXZlbDogZXh0SG9zdFR5cGVzLkNoYXRWYXJpYWJsZUxldmVsLFxuXHRcdFx0Q2hhdENvbXBsZXRpb25JdGVtOiBleHRIb3N0VHlwZXMuQ2hhdENvbXBsZXRpb25JdGVtLFxuXHRcdFx0Q2hhdFJlZmVyZW5jZURpYWdub3N0aWM6IGV4dEhvc3RUeXBlcy5DaGF0UmVmZXJlbmNlRGlhZ25vc3RpYyxcblx0XHRcdENhbGxIaWVyYXJjaHlJbmNvbWluZ0NhbGw6IGV4dEhvc3RUeXBlcy5DYWxsSGllcmFyY2h5SW5jb21pbmdDYWxsLFxuXHRcdFx0Q2FsbEhpZXJhcmNoeUl0ZW06IGV4dEhvc3RUeXBlcy5DYWxsSGllcmFyY2h5SXRlbSxcblx0XHRcdENhbGxIaWVyYXJjaHlPdXRnb2luZ0NhbGw6IGV4dEhvc3RUeXBlcy5DYWxsSGllcmFyY2h5T3V0Z29pbmdDYWxsLFxuXHRcdFx0Q2FuY2VsbGF0aW9uRXJyb3I6IGVycm9ycy5DYW5jZWxsYXRpb25FcnJvcixcblx0XHRcdENhbmNlbGxhdGlvblRva2VuU291cmNlOiBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSxcblx0XHRcdENhbmRpZGF0ZVBvcnRTb3VyY2U6IENhbmRpZGF0ZVBvcnRTb3VyY2UsXG5cdFx0XHRDb2RlQWN0aW9uOiBleHRIb3N0VHlwZXMuQ29kZUFjdGlvbixcblx0XHRcdENvZGVBY3Rpb25LaW5kOiBleHRIb3N0VHlwZXMuQ29kZUFjdGlvbktpbmQsXG5cdFx0XHRDb2RlQWN0aW9uVHJpZ2dlcktpbmQ6IGV4dEhvc3RUeXBlcy5Db2RlQWN0aW9uVHJpZ2dlcktpbmQsXG5cdFx0XHRDb2RlTGVuczogZXh0SG9zdFR5cGVzLkNvZGVMZW5zLFxuXHRcdFx0Q29sb3I6IGV4dEhvc3RUeXBlcy5Db2xvcixcblx0XHRcdENvbG9ySW5mb3JtYXRpb246IGV4dEhvc3RUeXBlcy5Db2xvckluZm9ybWF0aW9uLFxuXHRcdFx0Q29sb3JQcmVzZW50YXRpb246IGV4dEhvc3RUeXBlcy5Db2xvclByZXNlbnRhdGlvbixcblx0XHRcdENvbG9yVGhlbWVLaW5kOiBleHRIb3N0VHlwZXMuQ29sb3JUaGVtZUtpbmQsXG5cdFx0XHRDb21tZW50TW9kZTogZXh0SG9zdFR5cGVzLkNvbW1lbnRNb2RlLFxuXHRcdFx0Q29tbWVudFN0YXRlOiBleHRIb3N0VHlwZXMuQ29tbWVudFN0YXRlLFxuXHRcdFx0Q29tbWVudFRocmVhZENvbGxhcHNpYmxlU3RhdGU6IGV4dEhvc3RUeXBlcy5Db21tZW50VGhyZWFkQ29sbGFwc2libGVTdGF0ZSxcblx0XHRcdENvbW1lbnRUaHJlYWRTdGF0ZTogZXh0SG9zdFR5cGVzLkNvbW1lbnRUaHJlYWRTdGF0ZSxcblx0XHRcdENvbW1lbnRUaHJlYWRBcHBsaWNhYmlsaXR5OiBleHRIb3N0VHlwZXMuQ29tbWVudFRocmVhZEFwcGxpY2FiaWxpdHksXG5cdFx0XHRDb21tZW50VGhyZWFkRm9jdXM6IGV4dEhvc3RUeXBlcy5Db21tZW50VGhyZWFkRm9jdXMsXG5cdFx0XHRDb21wbGV0aW9uSXRlbTogZXh0SG9zdFR5cGVzLkNvbXBsZXRpb25JdGVtLFxuXHRcdFx0Q29tcGxldGlvbkl0ZW1LaW5kOiBleHRIb3N0VHlwZXMuQ29tcGxldGlvbkl0ZW1LaW5kLFxuXHRcdFx0Q29tcGxldGlvbkl0ZW1UYWc6IGV4dEhvc3RUeXBlcy5Db21wbGV0aW9uSXRlbVRhZyxcblx0XHRcdENvbXBsZXRpb25MaXN0OiBleHRIb3N0VHlwZXMuQ29tcGxldGlvbkxpc3QsXG5cdFx0XHRDb21wbGV0aW9uVHJpZ2dlcktpbmQ6IGV4dEhvc3RUeXBlcy5Db21wbGV0aW9uVHJpZ2dlcktpbmQsXG5cdFx0XHRDb25maWd1cmF0aW9uVGFyZ2V0OiBleHRIb3N0VHlwZXMuQ29uZmlndXJhdGlvblRhcmdldCxcblx0XHRcdEN1c3RvbUV4ZWN1dGlvbjogZXh0SG9zdFR5cGVzLkN1c3RvbUV4ZWN1dGlvbixcblx0XHRcdERlYnVnQWRhcHRlckV4ZWN1dGFibGU6IGV4dEhvc3RUeXBlcy5EZWJ1Z0FkYXB0ZXJFeGVjdXRhYmxlLFxuXHRcdFx0RGVidWdBZGFwdGVySW5saW5lSW1wbGVtZW50YXRpb246IGV4dEhvc3RUeXBlcy5EZWJ1Z0FkYXB0ZXJJbmxpbmVJbXBsZW1lbnRhdGlvbixcblx0XHRcdERlYnVnQWRhcHRlck5hbWVkUGlwZVNlcnZlcjogZXh0SG9zdFR5cGVzLkRlYnVnQWRhcHRlck5hbWVkUGlwZVNlcnZlcixcblx0XHRcdERlYnVnQWRhcHRlclNlcnZlcjogZXh0SG9zdFR5cGVzLkRlYnVnQWRhcHRlclNlcnZlcixcblx0XHRcdERlYnVnQ29uZmlndXJhdGlvblByb3ZpZGVyVHJpZ2dlcktpbmQ6IERlYnVnQ29uZmlndXJhdGlvblByb3ZpZGVyVHJpZ2dlcktpbmQsXG5cdFx0XHREZWJ1Z0NvbnNvbGVNb2RlOiBleHRIb3N0VHlwZXMuRGVidWdDb25zb2xlTW9kZSxcblx0XHRcdERlYnVnVmlzdWFsaXphdGlvbjogZXh0SG9zdFR5cGVzLkRlYnVnVmlzdWFsaXphdGlvbixcblx0XHRcdERlY29yYXRpb25SYW5nZUJlaGF2aW9yOiBleHRIb3N0VHlwZXMuRGVjb3JhdGlvblJhbmdlQmVoYXZpb3IsXG5cdFx0XHREaWFnbm9zdGljOiBleHRIb3N0VHlwZXMuRGlhZ25vc3RpYyxcblx0XHRcdERpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb246IGV4dEhvc3RUeXBlcy5EaWFnbm9zdGljUmVsYXRlZEluZm9ybWF0aW9uLFxuXHRcdFx0RGlhZ25vc3RpY1NldmVyaXR5OiBleHRIb3N0VHlwZXMuRGlhZ25vc3RpY1NldmVyaXR5LFxuXHRcdFx0RGlhZ25vc3RpY1RhZzogZXh0SG9zdFR5cGVzLkRpYWdub3N0aWNUYWcsXG5cdFx0XHREaXNwb3NhYmxlOiBleHRIb3N0VHlwZXMuRGlzcG9zYWJsZSxcblx0XHRcdERvY3VtZW50SGlnaGxpZ2h0OiBleHRIb3N0VHlwZXMuRG9jdW1lbnRIaWdobGlnaHQsXG5cdFx0XHREb2N1bWVudEhpZ2hsaWdodEtpbmQ6IGV4dEhvc3RUeXBlcy5Eb2N1bWVudEhpZ2hsaWdodEtpbmQsXG5cdFx0XHRNdWx0aURvY3VtZW50SGlnaGxpZ2h0OiBleHRIb3N0VHlwZXMuTXVsdGlEb2N1bWVudEhpZ2hsaWdodCxcblx0XHRcdERvY3VtZW50TGluazogZXh0SG9zdFR5cGVzLkRvY3VtZW50TGluayxcblx0XHRcdERvY3VtZW50U3ltYm9sOiBleHRIb3N0VHlwZXMuRG9jdW1lbnRTeW1ib2wsXG5cdFx0XHRFbmRPZkxpbmU6IGV4dEhvc3RUeXBlcy5FbmRPZkxpbmUsXG5cdFx0XHRFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGU6IGV4dEhvc3RUeXBlcy5FbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUsXG5cdFx0XHRFdmFsdWF0YWJsZUV4cHJlc3Npb246IGV4dEhvc3RUeXBlcy5FdmFsdWF0YWJsZUV4cHJlc3Npb24sXG5cdFx0XHRJbmxpbmVWYWx1ZVRleHQ6IGV4dEhvc3RUeXBlcy5JbmxpbmVWYWx1ZVRleHQsXG5cdFx0XHRJbmxpbmVWYWx1ZVZhcmlhYmxlTG9va3VwOiBleHRIb3N0VHlwZXMuSW5saW5lVmFsdWVWYXJpYWJsZUxvb2t1cCxcblx0XHRcdElubGluZVZhbHVlRXZhbHVhdGFibGVFeHByZXNzaW9uOiBleHRIb3N0VHlwZXMuSW5saW5lVmFsdWVFdmFsdWF0YWJsZUV4cHJlc3Npb24sXG5cdFx0XHRJbmxpbmVDb21wbGV0aW9uVHJpZ2dlcktpbmQ6IGV4dEhvc3RUeXBlcy5JbmxpbmVDb21wbGV0aW9uVHJpZ2dlcktpbmQsXG5cdFx0XHRFdmVudEVtaXR0ZXI6IEVtaXR0ZXIsXG5cdFx0XHRFeHRlbnNpb25LaW5kOiBleHRIb3N0VHlwZXMuRXh0ZW5zaW9uS2luZCxcblx0XHRcdEV4dGVuc2lvbk1vZGU6IGV4dEhvc3RUeXBlcy5FeHRlbnNpb25Nb2RlLFxuXHRcdFx0RXh0ZXJuYWxVcmlPcGVuZXJQcmlvcml0eTogZXh0SG9zdFR5cGVzLkV4dGVybmFsVXJpT3BlbmVyUHJpb3JpdHksXG5cdFx0XHRGaWxlQ2hhbmdlVHlwZTogZXh0SG9zdFR5cGVzLkZpbGVDaGFuZ2VUeXBlLFxuXHRcdFx0RmlsZURlY29yYXRpb246IGV4dEhvc3RUeXBlcy5GaWxlRGVjb3JhdGlvbixcblx0XHRcdEZpbGVEZWNvcmF0aW9uMjogZXh0SG9zdFR5cGVzLkZpbGVEZWNvcmF0aW9uLFxuXHRcdFx0RmlsZVN5c3RlbUVycm9yOiBleHRIb3N0VHlwZXMuRmlsZVN5c3RlbUVycm9yLFxuXHRcdFx0RmlsZVR5cGU6IGZpbGVzLkZpbGVUeXBlLFxuXHRcdFx0RmlsZVBlcm1pc3Npb246IGZpbGVzLkZpbGVQZXJtaXNzaW9uLFxuXHRcdFx0Rm9sZGluZ1JhbmdlOiBleHRIb3N0VHlwZXMuRm9sZGluZ1JhbmdlLFxuXHRcdFx0Rm9sZGluZ1JhbmdlS2luZDogZXh0SG9zdFR5cGVzLkZvbGRpbmdSYW5nZUtpbmQsXG5cdFx0XHRGdW5jdGlvbkJyZWFrcG9pbnQ6IGV4dEhvc3RUeXBlcy5GdW5jdGlvbkJyZWFrcG9pbnQsXG5cdFx0XHRJbmxpbmVDb21wbGV0aW9uSXRlbTogZXh0SG9zdFR5cGVzLklubGluZVN1Z2dlc3Rpb24sXG5cdFx0XHRJbmxpbmVDb21wbGV0aW9uTGlzdDogZXh0SG9zdFR5cGVzLklubGluZVN1Z2dlc3Rpb25MaXN0LFxuXHRcdFx0SG92ZXI6IGV4dEhvc3RUeXBlcy5Ib3Zlcixcblx0XHRcdFZlcmJvc2VIb3ZlcjogZXh0SG9zdFR5cGVzLlZlcmJvc2VIb3Zlcixcblx0XHRcdEhvdmVyVmVyYm9zaXR5QWN0aW9uOiBleHRIb3N0VHlwZXMuSG92ZXJWZXJib3NpdHlBY3Rpb24sXG5cdFx0XHRJbmRlbnRBY3Rpb246IGxhbmd1YWdlQ29uZmlndXJhdGlvbi5JbmRlbnRBY3Rpb24sXG5cdFx0XHRMb2NhdGlvbjogZXh0SG9zdFR5cGVzLkxvY2F0aW9uLFxuXHRcdFx0TWFya2Rvd25TdHJpbmc6IGV4dEhvc3RUeXBlcy5NYXJrZG93blN0cmluZyxcblx0XHRcdE92ZXJ2aWV3UnVsZXJMYW5lOiBPdmVydmlld1J1bGVyTGFuZSxcblx0XHRcdFBhcmFtZXRlckluZm9ybWF0aW9uOiBleHRIb3N0VHlwZXMuUGFyYW1ldGVySW5mb3JtYXRpb24sXG5cdFx0XHRQb3J0QXV0b0ZvcndhcmRBY3Rpb246IGV4dEhvc3RUeXBlcy5Qb3J0QXV0b0ZvcndhcmRBY3Rpb24sXG5cdFx0XHRQb3NpdGlvbjogZXh0SG9zdFR5cGVzLlBvc2l0aW9uLFxuXHRcdFx0UHJvY2Vzc0V4ZWN1dGlvbjogZXh0SG9zdFR5cGVzLlByb2Nlc3NFeGVjdXRpb24sXG5cdFx0XHRQcm9ncmVzc0xvY2F0aW9uOiBleHRIb3N0VHlwZXMuUHJvZ3Jlc3NMb2NhdGlvbixcblx0XHRcdFF1aWNrSW5wdXRCdXR0b25Mb2NhdGlvbjogZXh0SG9zdFR5cGVzLlF1aWNrSW5wdXRCdXR0b25Mb2NhdGlvbixcblx0XHRcdFF1aWNrSW5wdXRCdXR0b25zOiBleHRIb3N0VHlwZXMuUXVpY2tJbnB1dEJ1dHRvbnMsXG5cdFx0XHRSYW5nZTogZXh0SG9zdFR5cGVzLlJhbmdlLFxuXHRcdFx0UmVsYXRpdmVQYXR0ZXJuOiBleHRIb3N0VHlwZXMuUmVsYXRpdmVQYXR0ZXJuLFxuXHRcdFx0U2VsZWN0aW9uOiBleHRIb3N0VHlwZXMuU2VsZWN0aW9uLFxuXHRcdFx0U2VsZWN0aW9uUmFuZ2U6IGV4dEhvc3RUeXBlcy5TZWxlY3Rpb25SYW5nZSxcblx0XHRcdFNlbWFudGljVG9rZW5zOiBleHRIb3N0VHlwZXMuU2VtYW50aWNUb2tlbnMsXG5cdFx0XHRTZW1hbnRpY1Rva2Vuc0J1aWxkZXI6IGV4dEhvc3RUeXBlcy5TZW1hbnRpY1Rva2Vuc0J1aWxkZXIsXG5cdFx0XHRTZW1hbnRpY1Rva2Vuc0VkaXQ6IGV4dEhvc3RUeXBlcy5TZW1hbnRpY1Rva2Vuc0VkaXQsXG5cdFx0XHRTZW1hbnRpY1Rva2Vuc0VkaXRzOiBleHRIb3N0VHlwZXMuU2VtYW50aWNUb2tlbnNFZGl0cyxcblx0XHRcdFNlbWFudGljVG9rZW5zTGVnZW5kOiBleHRIb3N0VHlwZXMuU2VtYW50aWNUb2tlbnNMZWdlbmQsXG5cdFx0XHRTaGVsbEV4ZWN1dGlvbjogZXh0SG9zdFR5cGVzLlNoZWxsRXhlY3V0aW9uLFxuXHRcdFx0U2hlbGxRdW90aW5nOiBleHRIb3N0VHlwZXMuU2hlbGxRdW90aW5nLFxuXHRcdFx0U2lnbmF0dXJlSGVscDogZXh0SG9zdFR5cGVzLlNpZ25hdHVyZUhlbHAsXG5cdFx0XHRTaWduYXR1cmVIZWxwVHJpZ2dlcktpbmQ6IGV4dEhvc3RUeXBlcy5TaWduYXR1cmVIZWxwVHJpZ2dlcktpbmQsXG5cdFx0XHRTaWduYXR1cmVJbmZvcm1hdGlvbjogZXh0SG9zdFR5cGVzLlNpZ25hdHVyZUluZm9ybWF0aW9uLFxuXHRcdFx0U25pcHBldFN0cmluZzogZXh0SG9zdFR5cGVzLlNuaXBwZXRTdHJpbmcsXG5cdFx0XHRTb3VyY2VCcmVha3BvaW50OiBleHRIb3N0VHlwZXMuU291cmNlQnJlYWtwb2ludCxcblx0XHRcdFN0YW5kYXJkVG9rZW5UeXBlOiBleHRIb3N0VHlwZXMuU3RhbmRhcmRUb2tlblR5cGUsXG5cdFx0XHRTdGF0dXNCYXJBbGlnbm1lbnQ6IGV4dEhvc3RUeXBlcy5TdGF0dXNCYXJBbGlnbm1lbnQsXG5cdFx0XHRTeW1ib2xJbmZvcm1hdGlvbjogZXh0SG9zdFR5cGVzLlN5bWJvbEluZm9ybWF0aW9uLFxuXHRcdFx0U3ltYm9sS2luZDogZXh0SG9zdFR5cGVzLlN5bWJvbEtpbmQsXG5cdFx0XHRTeW1ib2xUYWc6IGV4dEhvc3RUeXBlcy5TeW1ib2xUYWcsXG5cdFx0XHRUYXNrOiBleHRIb3N0VHlwZXMuVGFzayxcblx0XHRcdFRhc2tFdmVudEtpbmQ6IGV4dEhvc3RUeXBlcy5UYXNrRXZlbnRLaW5kLFxuXHRcdFx0VGFza0dyb3VwOiBleHRIb3N0VHlwZXMuVGFza0dyb3VwLFxuXHRcdFx0VGFza1BhbmVsS2luZDogZXh0SG9zdFR5cGVzLlRhc2tQYW5lbEtpbmQsXG5cdFx0XHRUYXNrUmV2ZWFsS2luZDogZXh0SG9zdFR5cGVzLlRhc2tSZXZlYWxLaW5kLFxuXHRcdFx0VGFza1Njb3BlOiBleHRIb3N0VHlwZXMuVGFza1Njb3BlLFxuXHRcdFx0VGVybWluYWxMaW5rOiBleHRIb3N0VHlwZXMuVGVybWluYWxMaW5rLFxuXHRcdFx0VGVybWluYWxRdWlja0ZpeFRlcm1pbmFsQ29tbWFuZDogZXh0SG9zdFR5cGVzLlRlcm1pbmFsUXVpY2tGaXhDb21tYW5kLFxuXHRcdFx0VGVybWluYWxRdWlja0ZpeE9wZW5lcjogZXh0SG9zdFR5cGVzLlRlcm1pbmFsUXVpY2tGaXhPcGVuZXIsXG5cdFx0XHRUZXJtaW5hbExvY2F0aW9uOiBleHRIb3N0VHlwZXMuVGVybWluYWxMb2NhdGlvbixcblx0XHRcdFRlcm1pbmFsUHJvZmlsZTogZXh0SG9zdFR5cGVzLlRlcm1pbmFsUHJvZmlsZSxcblx0XHRcdFRlcm1pbmFsRXhpdFJlYXNvbjogZXh0SG9zdFR5cGVzLlRlcm1pbmFsRXhpdFJlYXNvbixcblx0XHRcdFRlcm1pbmFsU2hlbGxFeGVjdXRpb25Db21tYW5kTGluZUNvbmZpZGVuY2U6IGV4dEhvc3RUeXBlcy5UZXJtaW5hbFNoZWxsRXhlY3V0aW9uQ29tbWFuZExpbmVDb25maWRlbmNlLFxuXHRcdFx0VGVybWluYWxDb21wbGV0aW9uSXRlbTogZXh0SG9zdFR5cGVzLlRlcm1pbmFsQ29tcGxldGlvbkl0ZW0sXG5cdFx0XHRUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZDogZXh0SG9zdFR5cGVzLlRlcm1pbmFsQ29tcGxldGlvbkl0ZW1LaW5kLFxuXHRcdFx0VGVybWluYWxDb21wbGV0aW9uTGlzdDogZXh0SG9zdFR5cGVzLlRlcm1pbmFsQ29tcGxldGlvbkxpc3QsXG5cdFx0XHRUZXJtaW5hbFNoZWxsVHlwZTogZXh0SG9zdFR5cGVzLlRlcm1pbmFsU2hlbGxUeXBlLFxuXHRcdFx0VGV4dERvY3VtZW50U2F2ZVJlYXNvbjogZXh0SG9zdFR5cGVzLlRleHREb2N1bWVudFNhdmVSZWFzb24sXG5cdFx0XHRUZXh0RWRpdDogZXh0SG9zdFR5cGVzLlRleHRFZGl0LFxuXHRcdFx0U25pcHBldFRleHRFZGl0OiBleHRIb3N0VHlwZXMuU25pcHBldFRleHRFZGl0LFxuXHRcdFx0VGV4dEVkaXRvckN1cnNvclN0eWxlOiBUZXh0RWRpdG9yQ3Vyc29yU3R5bGUsXG5cdFx0XHRUZXh0RWRpdG9yQ2hhbmdlS2luZDogZXh0SG9zdFR5cGVzLlRleHRFZGl0b3JDaGFuZ2VLaW5kLFxuXHRcdFx0VGV4dEVkaXRvckxpbmVOdW1iZXJzU3R5bGU6IGV4dEhvc3RUeXBlcy5UZXh0RWRpdG9yTGluZU51bWJlcnNTdHlsZSxcblx0XHRcdFRleHRFZGl0b3JSZXZlYWxUeXBlOiBleHRIb3N0VHlwZXMuVGV4dEVkaXRvclJldmVhbFR5cGUsXG5cdFx0XHRUZXh0RWRpdG9yU2VsZWN0aW9uQ2hhbmdlS2luZDogZXh0SG9zdFR5cGVzLlRleHRFZGl0b3JTZWxlY3Rpb25DaGFuZ2VLaW5kLFxuXHRcdFx0U3ludGF4VG9rZW5UeXBlOiBleHRIb3N0VHlwZXMuU3ludGF4VG9rZW5UeXBlLFxuXHRcdFx0VGV4dERvY3VtZW50Q2hhbmdlUmVhc29uOiBleHRIb3N0VHlwZXMuVGV4dERvY3VtZW50Q2hhbmdlUmVhc29uLFxuXHRcdFx0VGhlbWVDb2xvcjogZXh0SG9zdFR5cGVzLlRoZW1lQ29sb3IsXG5cdFx0XHRUaGVtZUljb246IGV4dEhvc3RUeXBlcy5UaGVtZUljb24sXG5cdFx0XHRUcmVlSXRlbTogZXh0SG9zdFR5cGVzLlRyZWVJdGVtLFxuXHRcdFx0VHJlZUl0ZW1DaGVja2JveFN0YXRlOiBleHRIb3N0VHlwZXMuVHJlZUl0ZW1DaGVja2JveFN0YXRlLFxuXHRcdFx0VHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlOiBleHRIb3N0VHlwZXMuVHJlZUl0ZW1Db2xsYXBzaWJsZVN0YXRlLFxuXHRcdFx0VHlwZUhpZXJhcmNoeUl0ZW06IGV4dEhvc3RUeXBlcy5UeXBlSGllcmFyY2h5SXRlbSxcblx0XHRcdFVJS2luZDogVUlLaW5kLFxuXHRcdFx0VXJpOiBVUkksXG5cdFx0XHRWaWV3Q29sdW1uOiBleHRIb3N0VHlwZXMuVmlld0NvbHVtbixcblx0XHRcdFdvcmtzcGFjZUVkaXQ6IGV4dEhvc3RUeXBlcy5Xb3Jrc3BhY2VFZGl0LFxuXHRcdFx0Ly8gcHJvcG9zZWQgYXBpIHR5cGVzXG5cdFx0XHREb2N1bWVudFBhc3RlVHJpZ2dlcktpbmQ6IGV4dEhvc3RUeXBlcy5Eb2N1bWVudFBhc3RlVHJpZ2dlcktpbmQsXG5cdFx0XHREb2N1bWVudERyb3BFZGl0OiBleHRIb3N0VHlwZXMuRG9jdW1lbnREcm9wRWRpdCxcblx0XHRcdERvY3VtZW50RHJvcE9yUGFzdGVFZGl0S2luZDogZXh0SG9zdFR5cGVzLkRvY3VtZW50RHJvcE9yUGFzdGVFZGl0S2luZCxcblx0XHRcdERvY3VtZW50UGFzdGVFZGl0OiBleHRIb3N0VHlwZXMuRG9jdW1lbnRQYXN0ZUVkaXQsXG5cdFx0XHRJbmxheUhpbnQ6IGV4dEhvc3RUeXBlcy5JbmxheUhpbnQsXG5cdFx0XHRJbmxheUhpbnRMYWJlbFBhcnQ6IGV4dEhvc3RUeXBlcy5JbmxheUhpbnRMYWJlbFBhcnQsXG5cdFx0XHRJbmxheUhpbnRLaW5kOiBleHRIb3N0VHlwZXMuSW5sYXlIaW50S2luZCxcblx0XHRcdFJlbW90ZUF1dGhvcml0eVJlc29sdmVyRXJyb3I6IGV4dEhvc3RUeXBlcy5SZW1vdGVBdXRob3JpdHlSZXNvbHZlckVycm9yLFxuXHRcdFx0UmVzb2x2ZWRBdXRob3JpdHk6IGV4dEhvc3RUeXBlcy5SZXNvbHZlZEF1dGhvcml0eSxcblx0XHRcdE1hbmFnZWRSZXNvbHZlZEF1dGhvcml0eTogZXh0SG9zdFR5cGVzLk1hbmFnZWRSZXNvbHZlZEF1dGhvcml0eSxcblx0XHRcdFNvdXJjZUNvbnRyb2xJbnB1dEJveFZhbGlkYXRpb25UeXBlOiBleHRIb3N0VHlwZXMuU291cmNlQ29udHJvbElucHV0Qm94VmFsaWRhdGlvblR5cGUsXG5cdFx0XHRFeHRlbnNpb25SdW50aW1lOiBleHRIb3N0VHlwZXMuRXh0ZW5zaW9uUnVudGltZSxcblx0XHRcdFRpbWVsaW5lSXRlbTogZXh0SG9zdFR5cGVzLlRpbWVsaW5lSXRlbSxcblx0XHRcdE5vdGVib29rUmFuZ2U6IGV4dEhvc3RUeXBlcy5Ob3RlYm9va1JhbmdlLFxuXHRcdFx0Tm90ZWJvb2tDZWxsS2luZDogZXh0SG9zdFR5cGVzLk5vdGVib29rQ2VsbEtpbmQsXG5cdFx0XHROb3RlYm9va0NlbGxFeGVjdXRpb25TdGF0ZTogZXh0SG9zdFR5cGVzLk5vdGVib29rQ2VsbEV4ZWN1dGlvblN0YXRlLFxuXHRcdFx0Tm90ZWJvb2tDZWxsRGF0YTogZXh0SG9zdFR5cGVzLk5vdGVib29rQ2VsbERhdGEsXG5cdFx0XHROb3RlYm9va0RhdGE6IGV4dEhvc3RUeXBlcy5Ob3RlYm9va0RhdGEsXG5cdFx0XHROb3RlYm9va1JlbmRlcmVyU2NyaXB0OiBleHRIb3N0VHlwZXMuTm90ZWJvb2tSZW5kZXJlclNjcmlwdCxcblx0XHRcdE5vdGVib29rQ2VsbFN0YXR1c0JhckFsaWdubWVudDogZXh0SG9zdFR5cGVzLk5vdGVib29rQ2VsbFN0YXR1c0JhckFsaWdubWVudCxcblx0XHRcdE5vdGVib29rRWRpdG9yUmV2ZWFsVHlwZTogZXh0SG9zdFR5cGVzLk5vdGVib29rRWRpdG9yUmV2ZWFsVHlwZSxcblx0XHRcdE5vdGVib29rQ2VsbE91dHB1dDogZXh0SG9zdFR5cGVzLk5vdGVib29rQ2VsbE91dHB1dCxcblx0XHRcdE5vdGVib29rQ2VsbE91dHB1dEl0ZW06IGV4dEhvc3RUeXBlcy5Ob3RlYm9va0NlbGxPdXRwdXRJdGVtLFxuXHRcdFx0Q2VsbEVycm9yU3RhY2tGcmFtZTogZXh0SG9zdFR5cGVzLkNlbGxFcnJvclN0YWNrRnJhbWUsXG5cdFx0XHROb3RlYm9va0NlbGxTdGF0dXNCYXJJdGVtOiBleHRIb3N0VHlwZXMuTm90ZWJvb2tDZWxsU3RhdHVzQmFySXRlbSxcblx0XHRcdE5vdGVib29rQ29udHJvbGxlckFmZmluaXR5OiBleHRIb3N0VHlwZXMuTm90ZWJvb2tDb250cm9sbGVyQWZmaW5pdHksXG5cdFx0XHROb3RlYm9va0NvbnRyb2xsZXJBZmZpbml0eTI6IGV4dEhvc3RUeXBlcy5Ob3RlYm9va0NvbnRyb2xsZXJBZmZpbml0eTIsXG5cdFx0XHROb3RlYm9va0VkaXQ6IGV4dEhvc3RUeXBlcy5Ob3RlYm9va0VkaXQsXG5cdFx0XHROb3RlYm9va0tlcm5lbFNvdXJjZUFjdGlvbjogZXh0SG9zdFR5cGVzLk5vdGVib29rS2VybmVsU291cmNlQWN0aW9uLFxuXHRcdFx0Tm90ZWJvb2tWYXJpYWJsZXNSZXF1ZXN0S2luZDogZXh0SG9zdFR5cGVzLk5vdGVib29rVmFyaWFibGVzUmVxdWVzdEtpbmQsXG5cdFx0XHRQb3J0QXR0cmlidXRlczogZXh0SG9zdFR5cGVzLlBvcnRBdHRyaWJ1dGVzLFxuXHRcdFx0TGlua2VkRWRpdGluZ1JhbmdlczogZXh0SG9zdFR5cGVzLkxpbmtlZEVkaXRpbmdSYW5nZXMsXG5cdFx0XHRUZXN0UmVzdWx0U3RhdGU6IGV4dEhvc3RUeXBlcy5UZXN0UmVzdWx0U3RhdGUsXG5cdFx0XHRUZXN0UnVuUmVxdWVzdDogZXh0SG9zdFR5cGVzLlRlc3RSdW5SZXF1ZXN0LFxuXHRcdFx0VGVzdE1lc3NhZ2U6IGV4dEhvc3RUeXBlcy5UZXN0TWVzc2FnZSxcblx0XHRcdFRlc3RNZXNzYWdlU3RhY2tGcmFtZTogZXh0SG9zdFR5cGVzLlRlc3RNZXNzYWdlU3RhY2tGcmFtZSxcblx0XHRcdFRlc3RUYWc6IGV4dEhvc3RUeXBlcy5UZXN0VGFnLFxuXHRcdFx0VGVzdFJ1blByb2ZpbGVLaW5kOiBleHRIb3N0VHlwZXMuVGVzdFJ1blByb2ZpbGVLaW5kLFxuXHRcdFx0VGV4dFNlYXJjaENvbXBsZXRlTWVzc2FnZVR5cGU6IFRleHRTZWFyY2hDb21wbGV0ZU1lc3NhZ2VUeXBlLFxuXHRcdFx0RGF0YVRyYW5zZmVyOiBleHRIb3N0VHlwZXMuRGF0YVRyYW5zZmVyLFxuXHRcdFx0RGF0YVRyYW5zZmVySXRlbTogZXh0SG9zdFR5cGVzLkRhdGFUcmFuc2Zlckl0ZW0sXG5cdFx0XHRUZXN0Q292ZXJhZ2VDb3VudDogZXh0SG9zdFR5cGVzLlRlc3RDb3ZlcmFnZUNvdW50LFxuXHRcdFx0RmlsZUNvdmVyYWdlOiBleHRIb3N0VHlwZXMuRmlsZUNvdmVyYWdlLFxuXHRcdFx0U3RhdGVtZW50Q292ZXJhZ2U6IGV4dEhvc3RUeXBlcy5TdGF0ZW1lbnRDb3ZlcmFnZSxcblx0XHRcdEJyYW5jaENvdmVyYWdlOiBleHRIb3N0VHlwZXMuQnJhbmNoQ292ZXJhZ2UsXG5cdFx0XHREZWNsYXJhdGlvbkNvdmVyYWdlOiBleHRIb3N0VHlwZXMuRGVjbGFyYXRpb25Db3ZlcmFnZSxcblx0XHRcdFdvcmtzcGFjZVRydXN0U3RhdGU6IGV4dEhvc3RUeXBlcy5Xb3Jrc3BhY2VUcnVzdFN0YXRlLFxuXHRcdFx0TGFuZ3VhZ2VTdGF0dXNTZXZlcml0eTogZXh0SG9zdFR5cGVzLkxhbmd1YWdlU3RhdHVzU2V2ZXJpdHksXG5cdFx0XHRRdWlja1BpY2tJdGVtS2luZDogZXh0SG9zdFR5cGVzLlF1aWNrUGlja0l0ZW1LaW5kLFxuXHRcdFx0SW5wdXRCb3hWYWxpZGF0aW9uU2V2ZXJpdHk6IGV4dEhvc3RUeXBlcy5JbnB1dEJveFZhbGlkYXRpb25TZXZlcml0eSxcblx0XHRcdFRhYklucHV0VGV4dDogZXh0SG9zdFR5cGVzLlRleHRUYWJJbnB1dCxcblx0XHRcdFRhYklucHV0VGV4dERpZmY6IGV4dEhvc3RUeXBlcy5UZXh0RGlmZlRhYklucHV0LFxuXHRcdFx0VGFiSW5wdXRUZXh0TWVyZ2U6IGV4dEhvc3RUeXBlcy5UZXh0TWVyZ2VUYWJJbnB1dCxcblx0XHRcdFRhYklucHV0Q3VzdG9tOiBleHRIb3N0VHlwZXMuQ3VzdG9tRWRpdG9yVGFiSW5wdXQsXG5cdFx0XHRUYWJJbnB1dE5vdGVib29rOiBleHRIb3N0VHlwZXMuTm90ZWJvb2tFZGl0b3JUYWJJbnB1dCxcblx0XHRcdFRhYklucHV0Tm90ZWJvb2tEaWZmOiBleHRIb3N0VHlwZXMuTm90ZWJvb2tEaWZmRWRpdG9yVGFiSW5wdXQsXG5cdFx0XHRUYWJJbnB1dFdlYnZpZXc6IGV4dEhvc3RUeXBlcy5XZWJ2aWV3RWRpdG9yVGFiSW5wdXQsXG5cdFx0XHRUYWJJbnB1dFRlcm1pbmFsOiBleHRIb3N0VHlwZXMuVGVybWluYWxFZGl0b3JUYWJJbnB1dCxcblx0XHRcdFRhYklucHV0SW50ZXJhY3RpdmVXaW5kb3c6IGV4dEhvc3RUeXBlcy5JbnRlcmFjdGl2ZVdpbmRvd0lucHV0LFxuXHRcdFx0VGFiSW5wdXRDaGF0OiBleHRIb3N0VHlwZXMuQ2hhdEVkaXRvclRhYklucHV0LFxuXHRcdFx0VGFiSW5wdXRUZXh0TXVsdGlEaWZmOiBleHRIb3N0VHlwZXMuVGV4dE11bHRpRGlmZlRhYklucHV0LFxuXHRcdFx0VGVsZW1ldHJ5VHJ1c3RlZFZhbHVlOiBUZWxlbWV0cnlUcnVzdGVkVmFsdWUsXG5cdFx0XHRMb2dMZXZlbDogTG9nTGV2ZWwsXG5cdFx0XHRFZGl0U2Vzc2lvbklkZW50aXR5TWF0Y2g6IEVkaXRTZXNzaW9uSWRlbnRpdHlNYXRjaCxcblx0XHRcdEludGVyYWN0aXZlU2Vzc2lvblZvdGVEaXJlY3Rpb246IGV4dEhvc3RUeXBlcy5JbnRlcmFjdGl2ZVNlc3Npb25Wb3RlRGlyZWN0aW9uLFxuXHRcdFx0Q2hhdENvcHlLaW5kOiBleHRIb3N0VHlwZXMuQ2hhdENvcHlLaW5kLFxuXHRcdFx0Q2hhdEVkaXRpbmdTZXNzaW9uQWN0aW9uT3V0Y29tZTogZXh0SG9zdFR5cGVzLkNoYXRFZGl0aW5nU2Vzc2lvbkFjdGlvbk91dGNvbWUsXG5cdFx0XHRJbnRlcmFjdGl2ZUVkaXRvclJlc3BvbnNlRmVlZGJhY2tLaW5kOiBleHRIb3N0VHlwZXMuSW50ZXJhY3RpdmVFZGl0b3JSZXNwb25zZUZlZWRiYWNrS2luZCxcblx0XHRcdERlYnVnU3RhY2tGcmFtZTogZXh0SG9zdFR5cGVzLkRlYnVnU3RhY2tGcmFtZSxcblx0XHRcdERlYnVnVGhyZWFkOiBleHRIb3N0VHlwZXMuRGVidWdUaHJlYWQsXG5cdFx0XHRSZWxhdGVkSW5mb3JtYXRpb25UeXBlOiBleHRIb3N0VHlwZXMuUmVsYXRlZEluZm9ybWF0aW9uVHlwZSxcblx0XHRcdFNwZWVjaFRvVGV4dFN0YXR1czogZXh0SG9zdFR5cGVzLlNwZWVjaFRvVGV4dFN0YXR1cyxcblx0XHRcdFRleHRUb1NwZWVjaFN0YXR1czogZXh0SG9zdFR5cGVzLlRleHRUb1NwZWVjaFN0YXR1cyxcblx0XHRcdFBhcnRpYWxBY2NlcHRUcmlnZ2VyS2luZDogZXh0SG9zdFR5cGVzLlBhcnRpYWxBY2NlcHRUcmlnZ2VyS2luZCxcblx0XHRcdEtleXdvcmRSZWNvZ25pdGlvblN0YXR1czogZXh0SG9zdFR5cGVzLktleXdvcmRSZWNvZ25pdGlvblN0YXR1cyxcblx0XHRcdENoYXRSZXNwb25zZU1hcmtkb3duUGFydDogZXh0SG9zdFR5cGVzLkNoYXRSZXNwb25zZU1hcmtkb3duUGFydCxcblx0XHRcdENoYXRSZXNwb25zZUZpbGVUcmVlUGFydDogZXh0SG9zdFR5cGVzLkNoYXRSZXNwb25zZUZpbGVUcmVlUGFydCxcblx0XHRcdENoYXRSZXNwb25zZUFuY2hvclBhcnQ6IGV4dEhvc3RUeXBlcy5DaGF0UmVzcG9uc2VBbmNob3JQYXJ0LFxuXHRcdFx0Q2hhdFJlc3BvbnNlUHJvZ3Jlc3NQYXJ0OiBleHRIb3N0VHlwZXMuQ2hhdFJlc3BvbnNlUHJvZ3Jlc3NQYXJ0LFxuXHRcdFx0Q2hhdFJlc3BvbnNlUHJvZ3Jlc3NQYXJ0MjogZXh0SG9zdFR5cGVzLkNoYXRSZXNwb25zZVByb2dyZXNzUGFydDIsXG5cdFx0XHRDaGF0UmVzcG9uc2VSZWZlcmVuY2VQYXJ0OiBleHRIb3N0VHlwZXMuQ2hhdFJlc3BvbnNlUmVmZXJlbmNlUGFydCxcblx0XHRcdENoYXRSZXNwb25zZVJlZmVyZW5jZVBhcnQyOiBleHRIb3N0VHlwZXMuQ2hhdFJlc3BvbnNlUmVmZXJlbmNlUGFydCxcblx0XHRcdENoYXRSZXNwb25zZUNvZGVDaXRhdGlvblBhcnQ6IGV4dEhvc3RUeXBlcy5DaGF0UmVzcG9uc2VDb2RlQ2l0YXRpb25QYXJ0LFxuXHRcdFx0Q2hhdFJlc3BvbnNlQ29kZWJsb2NrVXJpUGFydDogZXh0SG9zdFR5cGVzLkNoYXRSZXNwb25zZUNvZGVibG9ja1VyaVBhcnQsXG5cdFx0XHRDaGF0UmVzcG9uc2VXYXJuaW5nUGFydDogZXh0SG9zdFR5cGVzLkNoYXRSZXNwb25zZVdhcm5pbmdQYXJ0LFxuXHRcdFx0Q2hhdFJlc3BvbnNlVGV4dEVkaXRQYXJ0OiBleHRIb3N0VHlwZXMuQ2hhdFJlc3BvbnNlVGV4dEVkaXRQYXJ0LFxuXHRcdFx0Q2hhdFJlc3BvbnNlTm90ZWJvb2tFZGl0UGFydDogZXh0SG9zdFR5cGVzLkNoYXRSZXNwb25zZU5vdGVib29rRWRpdFBhcnQsXG5cdFx0XHRDaGF0UmVzcG9uc2VNYXJrZG93bldpdGhWdWxuZXJhYmlsaXRpZXNQYXJ0OiBleHRIb3N0VHlwZXMuQ2hhdFJlc3BvbnNlTWFya2Rvd25XaXRoVnVsbmVyYWJpbGl0aWVzUGFydCxcblx0XHRcdENoYXRSZXNwb25zZUNvbW1hbmRCdXR0b25QYXJ0OiBleHRIb3N0VHlwZXMuQ2hhdFJlc3BvbnNlQ29tbWFuZEJ1dHRvblBhcnQsXG5cdFx0XHRDaGF0UmVzcG9uc2VDb25maXJtYXRpb25QYXJ0OiBleHRIb3N0VHlwZXMuQ2hhdFJlc3BvbnNlQ29uZmlybWF0aW9uUGFydCxcblx0XHRcdENoYXRSZXNwb25zZU1vdmVQYXJ0OiBleHRIb3N0VHlwZXMuQ2hhdFJlc3BvbnNlTW92ZVBhcnQsXG5cdFx0XHRDaGF0UmVzcG9uc2VSZWZlcmVuY2VQYXJ0U3RhdHVzS2luZDogZXh0SG9zdFR5cGVzLkNoYXRSZXNwb25zZVJlZmVyZW5jZVBhcnRTdGF0dXNLaW5kLFxuXHRcdFx0Q2hhdFJlcXVlc3RUdXJuOiBleHRIb3N0VHlwZXMuQ2hhdFJlcXVlc3RUdXJuLFxuXHRcdFx0Q2hhdFJlc3BvbnNlVHVybjogZXh0SG9zdFR5cGVzLkNoYXRSZXNwb25zZVR1cm4sXG5cdFx0XHRDaGF0TG9jYXRpb246IGV4dEhvc3RUeXBlcy5DaGF0TG9jYXRpb24sXG5cdFx0XHRDaGF0UmVxdWVzdEVkaXRvckRhdGE6IGV4dEhvc3RUeXBlcy5DaGF0UmVxdWVzdEVkaXRvckRhdGEsXG5cdFx0XHRDaGF0UmVxdWVzdE5vdGVib29rRGF0YTogZXh0SG9zdFR5cGVzLkNoYXRSZXF1ZXN0Tm90ZWJvb2tEYXRhLFxuXHRcdFx0Q2hhdFJlZmVyZW5jZUJpbmFyeURhdGE6IGV4dEhvc3RUeXBlcy5DaGF0UmVmZXJlbmNlQmluYXJ5RGF0YSxcblx0XHRcdExhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZVJvbGU6IGV4dEhvc3RUeXBlcy5MYW5ndWFnZU1vZGVsQ2hhdE1lc3NhZ2VSb2xlLFxuXHRcdFx0TGFuZ3VhZ2VNb2RlbENoYXRNZXNzYWdlOiBleHRIb3N0VHlwZXMuTGFuZ3VhZ2VNb2RlbENoYXRNZXNzYWdlLFxuXHRcdFx0TGFuZ3VhZ2VNb2RlbENoYXRNZXNzYWdlMjogZXh0SG9zdFR5cGVzLkxhbmd1YWdlTW9kZWxDaGF0TWVzc2FnZTIsXG5cdFx0XHRMYW5ndWFnZU1vZGVsVG9vbFJlc3VsdFBhcnQ6IGV4dEhvc3RUeXBlcy5MYW5ndWFnZU1vZGVsVG9vbFJlc3VsdFBhcnQsXG5cdFx0XHRMYW5ndWFnZU1vZGVsVGV4dFBhcnQ6IGV4dEhvc3RUeXBlcy5MYW5ndWFnZU1vZGVsVGV4dFBhcnQsXG5cdFx0XHRMYW5ndWFnZU1vZGVsVG9vbENhbGxQYXJ0OiBleHRIb3N0VHlwZXMuTGFuZ3VhZ2VNb2RlbFRvb2xDYWxsUGFydCxcblx0XHRcdExhbmd1YWdlTW9kZWxFcnJvcjogZXh0SG9zdFR5cGVzLkxhbmd1YWdlTW9kZWxFcnJvcixcblx0XHRcdExhbmd1YWdlTW9kZWxUb29sUmVzdWx0OiBleHRIb3N0VHlwZXMuTGFuZ3VhZ2VNb2RlbFRvb2xSZXN1bHQsXG5cdFx0XHRMYW5ndWFnZU1vZGVsRGF0YVBhcnQ6IGV4dEhvc3RUeXBlcy5MYW5ndWFnZU1vZGVsRGF0YVBhcnQsXG5cdFx0XHRDaGF0SW1hZ2VNaW1lVHlwZTogZXh0SG9zdFR5cGVzLkNoYXRJbWFnZU1pbWVUeXBlLFxuXHRcdFx0RXh0ZW5kZWRMYW5ndWFnZU1vZGVsVG9vbFJlc3VsdDogZXh0SG9zdFR5cGVzLkV4dGVuZGVkTGFuZ3VhZ2VNb2RlbFRvb2xSZXN1bHQsXG5cdFx0XHRQcmVwYXJlZFRlcm1pbmFsVG9vbEludm9jYXRpb246IGV4dEhvc3RUeXBlcy5QcmVwYXJlZFRlcm1pbmFsVG9vbEludm9jYXRpb24sXG5cdFx0XHRMYW5ndWFnZU1vZGVsQ2hhdFRvb2xNb2RlOiBleHRIb3N0VHlwZXMuTGFuZ3VhZ2VNb2RlbENoYXRUb29sTW9kZSxcblx0XHRcdExhbmd1YWdlTW9kZWxQcm9tcHRUc3hQYXJ0OiBleHRIb3N0VHlwZXMuTGFuZ3VhZ2VNb2RlbFByb21wdFRzeFBhcnQsXG5cdFx0XHROZXdTeW1ib2xOYW1lOiBleHRIb3N0VHlwZXMuTmV3U3ltYm9sTmFtZSxcblx0XHRcdE5ld1N5bWJvbE5hbWVUYWc6IGV4dEhvc3RUeXBlcy5OZXdTeW1ib2xOYW1lVGFnLFxuXHRcdFx0TmV3U3ltYm9sTmFtZVRyaWdnZXJLaW5kOiBleHRIb3N0VHlwZXMuTmV3U3ltYm9sTmFtZVRyaWdnZXJLaW5kLFxuXHRcdFx0SW5saW5lRWRpdDogZXh0SG9zdFR5cGVzLklubGluZUVkaXQsXG5cdFx0XHRJbmxpbmVFZGl0VHJpZ2dlcktpbmQ6IGV4dEhvc3RUeXBlcy5JbmxpbmVFZGl0VHJpZ2dlcktpbmQsXG5cdFx0XHRFeGNsdWRlU2V0dGluZ09wdGlvbnM6IEV4Y2x1ZGVTZXR0aW5nT3B0aW9ucyxcblx0XHRcdFRleHRTZWFyY2hDb250ZXh0MjogVGV4dFNlYXJjaENvbnRleHQyLFxuXHRcdFx0VGV4dFNlYXJjaE1hdGNoMjogVGV4dFNlYXJjaE1hdGNoMixcblx0XHRcdFRleHRTZWFyY2hDb21wbGV0ZU1lc3NhZ2VUeXBlTmV3OiBUZXh0U2VhcmNoQ29tcGxldGVNZXNzYWdlVHlwZSxcblx0XHRcdENoYXRFcnJvckxldmVsOiBleHRIb3N0VHlwZXMuQ2hhdEVycm9yTGV2ZWwsXG5cdFx0XHRNY3BTU0VTZXJ2ZXJEZWZpbml0aW9uOiBleHRIb3N0VHlwZXMuTWNwU1NFU2VydmVyRGVmaW5pdGlvbixcblx0XHRcdE1jcFN0ZGlvU2VydmVyRGVmaW5pdGlvbjogZXh0SG9zdFR5cGVzLk1jcFN0ZGlvU2VydmVyRGVmaW5pdGlvbixcblx0XHR9O1xuXHR9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBTUEsU0FBUywrQkFBK0I7QUFDeEMsWUFBWSxZQUFZO0FBQ3hCLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsU0FBUyxxQkFBcUI7QUFDdkMsT0FBTyxjQUFjO0FBQ3JCLFNBQVMsV0FBVztBQUNw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
