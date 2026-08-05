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
import { FileEditorInput } from "../../contrib/files/browser/editors/fileEditorInput.js";
import { TestInstantiationService } from "../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { basename, isEqual } from "../../../base/common/resources.js";
import { URI } from "../../../base/common/uri.js";
import { ITelemetryService } from "../../../platform/telemetry/common/telemetry.js";
import { NullTelemetryService } from "../../../platform/telemetry/common/telemetryUtils.js";
import { EditorInput } from "../../common/editor/editorInput.js";
import { EditorExtensions, EditorExtensions as Extensions, EditorInputCapabilities } from "../../common/editor.js";
import { DEFAULT_EDITOR_PART_OPTIONS } from "../../browser/parts/editor/editor.js";
import { Event, Emitter } from "../../../base/common/event.js";
import { IWorkingCopyBackupService } from "../../services/workingCopy/common/workingCopyBackup.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { IWorkbenchLayoutService, Parts } from "../../services/layout/browser/layoutService.js";
import { TextModelResolverService } from "../../services/textmodelResolver/common/textModelResolverService.js";
import { ITextModelService } from "../../../editor/common/services/resolverService.js";
import { IUntitledTextEditorService, UntitledTextEditorService } from "../../services/untitled/common/untitledTextEditorService.js";
import { IWorkspaceContextService } from "../../../platform/workspace/common/workspace.js";
import { ILifecycleService, ShutdownReason, LifecyclePhase } from "../../services/lifecycle/common/lifecycle.js";
import { ServiceCollection } from "../../../platform/instantiation/common/serviceCollection.js";
import { IFileService, FileSystemProviderCapabilities } from "../../../platform/files/common/files.js";
import { IModelService } from "../../../editor/common/services/model.js";
import { LanguageService } from "../../../editor/common/services/languageService.js";
import { ModelService } from "../../../editor/common/services/modelService.js";
import { ITextFileService } from "../../services/textfile/common/textfiles.js";
import { ILanguageService } from "../../../editor/common/languages/language.js";
import { IHistoryService } from "../../services/history/common/history.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { TestConfigurationService } from "../../../platform/configuration/test/common/testConfigurationService.js";
import { TestWorkspace } from "../../../platform/workspace/test/common/testWorkspace.js";
import { IEnvironmentService } from "../../../platform/environment/common/environment.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
import { TestThemeService } from "../../../platform/theme/test/common/testThemeService.js";
import { ITextResourceConfigurationService, ITextResourcePropertiesService } from "../../../editor/common/services/textResourceConfiguration.js";
import { Position as EditorPosition } from "../../../editor/common/core/position.js";
import { IMenuService } from "../../../platform/actions/common/actions.js";
import { IContextKeyService } from "../../../platform/contextkey/common/contextkey.js";
import { MockContextKeyService, MockKeybindingService } from "../../../platform/keybinding/test/common/mockKeybindingService.js";
import { DefaultEndOfLine, EndOfLinePreference } from "../../../editor/common/model.js";
import { Range } from "../../../editor/common/core/range.js";
import { IDialogService, IFileDialogService } from "../../../platform/dialogs/common/dialogs.js";
import { INotificationService } from "../../../platform/notification/common/notification.js";
import { TestNotificationService } from "../../../platform/notification/test/common/testNotificationService.js";
import { IExtensionService } from "../../services/extensions/common/extensions.js";
import { IKeybindingService } from "../../../platform/keybinding/common/keybinding.js";
import { IDecorationsService } from "../../services/decorations/common/decorations.js";
import { toDisposable, Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { IEditorGroupsService, GroupOrientation } from "../../services/editor/common/editorGroupsService.js";
import { IEditorService } from "../../services/editor/common/editorService.js";
import { ICodeEditorService } from "../../../editor/browser/services/codeEditorService.js";
import { EditorPaneDescriptor } from "../../browser/editor.js";
import { ILoggerService, ILogService, NullLogService } from "../../../platform/log/common/log.js";
import { ILabelService } from "../../../platform/label/common/label.js";
import { DeferredPromise, timeout } from "../../../base/common/async.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../platform/storage/common/storage.js";
import { isLinux, isWindows } from "../../../base/common/platform.js";
import { LabelService } from "../../services/label/common/labelService.js";
import { bufferToStream, VSBuffer } from "../../../base/common/buffer.js";
import { Schemas } from "../../../base/common/network.js";
import { IProductService } from "../../../platform/product/common/productService.js";
import product from "../../../platform/product/common/product.js";
import { IHostService } from "../../services/host/browser/host.js";
import { IWorkingCopyService, WorkingCopyService } from "../../services/workingCopy/common/workingCopyService.js";
import { IFilesConfigurationService, FilesConfigurationService } from "../../services/filesConfiguration/common/filesConfigurationService.js";
import { IAccessibilityService } from "../../../platform/accessibility/common/accessibility.js";
import { BrowserWorkbenchEnvironmentService } from "../../services/environment/browser/environmentService.js";
import { BrowserTextFileService } from "../../services/textfile/browser/browserTextFileService.js";
import { IWorkbenchEnvironmentService } from "../../services/environment/common/environmentService.js";
import { createTextBufferFactoryFromStream } from "../../../editor/common/model/textModel.js";
import { IPathService } from "../../services/path/common/pathService.js";
import { IProgressService, Progress } from "../../../platform/progress/common/progress.js";
import { IWorkingCopyFileService, WorkingCopyFileService } from "../../services/workingCopy/common/workingCopyFileService.js";
import { UndoRedoService } from "../../../platform/undoRedo/common/undoRedoService.js";
import { IUndoRedoService } from "../../../platform/undoRedo/common/undoRedo.js";
import { TextFileEditorModel } from "../../services/textfile/common/textFileEditorModel.js";
import { Registry } from "../../../platform/registry/common/platform.js";
import { EditorPane } from "../../browser/parts/editor/editorPane.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { SyncDescriptor } from "../../../platform/instantiation/common/descriptors.js";
import { TestDialogService } from "../../../platform/dialogs/test/common/testDialogService.js";
import { CodeEditorService } from "../../services/editor/browser/codeEditorService.js";
import { MainEditorPart } from "../../browser/parts/editor/editorPart.js";
import { IQuickInputService } from "../../../platform/quickinput/common/quickInput.js";
import { QuickInputService } from "../../services/quickinput/browser/quickInputService.js";
import { IListService } from "../../../platform/list/browser/listService.js";
import { win32, posix } from "../../../base/common/path.js";
import { TestContextService, TestStorageService, TestTextResourcePropertiesService, TestExtensionService, TestProductService, createFileStat, TestLoggerService, TestWorkspaceTrustManagementService, TestWorkspaceTrustRequestService, TestMarkerService, TestHistoryService } from "../common/workbenchTestServices.js";
import { ViewContainerLocation } from "../../common/views.js";
import { IUriIdentityService } from "../../../platform/uriIdentity/common/uriIdentity.js";
import { UriIdentityService } from "../../../platform/uriIdentity/common/uriIdentityService.js";
import { InMemoryFileSystemProvider } from "../../../platform/files/common/inMemoryFilesystemProvider.js";
import { newWriteableStream } from "../../../base/common/stream.js";
import { EncodingOracle } from "../../services/textfile/browser/textFileService.js";
import { UTF16le, UTF16be, UTF8_with_bom } from "../../services/textfile/common/encoding.js";
import { ColorScheme } from "../../../platform/theme/common/theme.js";
import { Iterable } from "../../../base/common/iterator.js";
import { InMemoryWorkingCopyBackupService } from "../../services/workingCopy/common/workingCopyBackupService.js";
import { BrowserWorkingCopyBackupService } from "../../services/workingCopy/browser/workingCopyBackupService.js";
import { FileService } from "../../../platform/files/common/fileService.js";
import { TextResourceEditor } from "../../browser/parts/editor/textResourceEditor.js";
import { TestCodeEditor } from "../../../editor/test/browser/testCodeEditor.js";
import { TextFileEditor } from "../../contrib/files/browser/editors/textFileEditor.js";
import { TextResourceEditorInput } from "../../common/editor/textResourceEditorInput.js";
import { UntitledTextEditorInput } from "../../services/untitled/common/untitledTextEditorInput.js";
import { SideBySideEditor } from "../../browser/parts/editor/sideBySideEditor.js";
import { IWorkspacesService } from "../../../platform/workspaces/common/workspaces.js";
import { IWorkspaceTrustManagementService, IWorkspaceTrustRequestService } from "../../../platform/workspace/common/workspaceTrust.js";
import { ITerminalLogService } from "../../../platform/terminal/common/terminal.js";
import { ITerminalConfigurationService, ITerminalEditorService, ITerminalGroupService, ITerminalInstanceService } from "../../contrib/terminal/browser/terminal.js";
import { assertIsDefined, upcast } from "../../../base/common/types.js";
import { ITerminalProfileResolverService, ITerminalProfileService } from "../../contrib/terminal/common/terminal.js";
import { EditorResolverService } from "../../services/editor/browser/editorResolverService.js";
import { FILE_EDITOR_INPUT_ID } from "../../contrib/files/common/files.js";
import { IEditorResolverService } from "../../services/editor/common/editorResolverService.js";
import { IWorkingCopyEditorService, WorkingCopyEditorService } from "../../services/workingCopy/common/workingCopyEditorService.js";
import { IElevatedFileService } from "../../services/files/common/elevatedFileService.js";
import { BrowserElevatedFileService } from "../../services/files/browser/elevatedFileService.js";
import { IEditorWorkerService } from "../../../editor/common/services/editorWorker.js";
import { ResourceMap } from "../../../base/common/map.js";
import { SideBySideEditorInput } from "../../common/editor/sideBySideEditorInput.js";
import { ITextEditorService, TextEditorService } from "../../services/textfile/common/textEditorService.js";
import { IPaneCompositePartService } from "../../services/panecomposite/browser/panecomposite.js";
import { ILanguageConfigurationService } from "../../../editor/common/languages/languageConfigurationRegistry.js";
import { TestLanguageConfigurationService } from "../../../editor/test/common/modes/testLanguageConfigurationService.js";
import { env } from "../../../base/common/process.js";
import { isValidBasename } from "../../../base/common/extpath.js";
import { TestAccessibilityService } from "../../../platform/accessibility/test/common/testAccessibilityService.js";
import { ILanguageFeatureDebounceService, LanguageFeatureDebounceService } from "../../../editor/common/services/languageFeatureDebounce.js";
import { ILanguageFeaturesService } from "../../../editor/common/services/languageFeatures.js";
import { LanguageFeaturesService } from "../../../editor/common/services/languageFeaturesService.js";
import { TextEditorPaneSelection } from "../../browser/parts/editor/textEditor.js";
import { Selection } from "../../../editor/common/core/selection.js";
import { TestEditorWorkerService } from "../../../editor/test/common/services/testEditorWorkerService.js";
import { IRemoteAgentService } from "../../services/remote/common/remoteAgentService.js";
import { ILanguageDetectionService } from "../../services/languageDetection/common/languageDetectionWorkerService.js";
import { TargetPlatform } from "../../../platform/extensions/common/extensions.js";
import { IUserDataProfilesService, toUserDataProfile, UserDataProfilesService } from "../../../platform/userDataProfile/common/userDataProfile.js";
import { UserDataProfileService } from "../../services/userDataProfile/common/userDataProfileService.js";
import { IUserDataProfileService } from "../../services/userDataProfile/common/userDataProfile.js";
import { EnablementState } from "../../services/extensionManagement/common/extensionManagement.js";
import { Codicon } from "../../../base/common/codicons.js";
import { IRemoteSocketFactoryService, RemoteSocketFactoryService } from "../../../platform/remote/common/remoteSocketFactoryService.js";
import { EditorParts } from "../../browser/parts/editor/editorParts.js";
import { mainWindow } from "../../../base/browser/window.js";
import { IMarkerService } from "../../../platform/markers/common/markers.js";
import { IAccessibilitySignalService } from "../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { IEditorPaneService } from "../../services/editor/common/editorPaneService.js";
import { EditorPaneService } from "../../services/editor/browser/editorPaneService.js";
import { IContextMenuService, IContextViewService } from "../../../platform/contextview/browser/contextView.js";
import { ContextViewService } from "../../../platform/contextview/browser/contextViewService.js";
import { CustomEditorLabelService, ICustomEditorLabelService } from "../../services/editor/common/customEditorLabelService.js";
import { TerminalConfigurationService } from "../../contrib/terminal/browser/terminalConfigurationService.js";
import { TerminalLogService } from "../../../platform/terminal/common/terminalLogService.js";
import { IEnvironmentVariableService } from "../../contrib/terminal/common/environmentVariable.js";
import { EnvironmentVariableService } from "../../contrib/terminal/common/environmentVariableService.js";
import { ContextMenuService } from "../../../platform/contextview/browser/contextMenuService.js";
import { IHoverService } from "../../../platform/hover/browser/hover.js";
import { NullHoverService } from "../../../platform/hover/test/browser/nullHoverService.js";
import { IActionViewItemService, NullActionViewItemService } from "../../../platform/actions/browser/actionViewItemService.js";
function createFileEditorInput(instantiationService, resource) {
  return instantiationService.createInstance(FileEditorInput, resource, void 0, void 0, void 0, void 0, void 0, void 0);
}
Registry.as(EditorExtensions.EditorFactory).registerFileEditorFactory({
  typeId: FILE_EDITOR_INPUT_ID,
  createFileEditor: (resource, preferredResource, preferredName, preferredDescription, preferredEncoding, preferredLanguageId, preferredContents, instantiationService) => {
    return instantiationService.createInstance(FileEditorInput, resource, preferredResource, preferredName, preferredDescription, preferredEncoding, preferredLanguageId, preferredContents);
  },
  isFileEditor: (obj) => {
    return obj instanceof FileEditorInput;
  }
});
class TestTextResourceEditor extends TextResourceEditor {
  createEditorControl(parent, configuration) {
    this.editorControl = this._register(this.instantiationService.createInstance(TestCodeEditor, parent, configuration, {}));
  }
}
class TestTextFileEditor extends TextFileEditor {
  createEditorControl(parent, configuration) {
    this.editorControl = this._register(this.instantiationService.createInstance(TestCodeEditor, parent, configuration, { contributions: [] }));
  }
  setSelection(selection, reason) {
    this._options = selection ? upcast({ selection }) : void 0;
    this._onDidChangeSelection.fire({ reason });
  }
  getSelection() {
    const options = this.options;
    if (!options) {
      return void 0;
    }
    const textSelection = options.selection;
    if (!textSelection) {
      return void 0;
    }
    return new TextEditorPaneSelection(new Selection(textSelection.startLineNumber, textSelection.startColumn, textSelection.endLineNumber ?? textSelection.startLineNumber, textSelection.endColumn ?? textSelection.startColumn));
  }
}
class TestWorkingCopyService extends WorkingCopyService {
  testUnregisterWorkingCopy(workingCopy) {
    return super.unregisterWorkingCopy(workingCopy);
  }
}
function workbenchInstantiationService(overrides, disposables = new DisposableStore()) {
  const instantiationService = disposables.add(new TestInstantiationService(new ServiceCollection(
    [ILifecycleService, disposables.add(new TestLifecycleService())],
    [IActionViewItemService, new SyncDescriptor(NullActionViewItemService)]
  )));
  instantiationService.stub(IProductService, TestProductService);
  instantiationService.stub(IEditorWorkerService, new TestEditorWorkerService());
  instantiationService.stub(IWorkingCopyService, disposables.add(new TestWorkingCopyService()));
  const environmentService = overrides?.environmentService ? overrides.environmentService(instantiationService) : TestEnvironmentService;
  instantiationService.stub(IEnvironmentService, environmentService);
  instantiationService.stub(IWorkbenchEnvironmentService, environmentService);
  instantiationService.stub(ILogService, new NullLogService());
  const contextKeyService = overrides?.contextKeyService ? overrides.contextKeyService(instantiationService) : instantiationService.createInstance(MockContextKeyService);
  instantiationService.stub(IContextKeyService, contextKeyService);
  instantiationService.stub(IProgressService, new TestProgressService());
  const workspaceContextService = new TestContextService(TestWorkspace);
  instantiationService.stub(IWorkspaceContextService, workspaceContextService);
  const configService = overrides?.configurationService ? overrides.configurationService(instantiationService) : new TestConfigurationService({
    files: {
      participants: {
        timeout: 6e4
      }
    }
  });
  instantiationService.stub(IConfigurationService, configService);
  const textResourceConfigurationService = new TestTextResourceConfigurationService(configService);
  instantiationService.stub(ITextResourceConfigurationService, textResourceConfigurationService);
  instantiationService.stub(IUntitledTextEditorService, disposables.add(instantiationService.createInstance(UntitledTextEditorService)));
  instantiationService.stub(IStorageService, disposables.add(new TestStorageService()));
  instantiationService.stub(IRemoteAgentService, new TestRemoteAgentService());
  instantiationService.stub(ILanguageDetectionService, new TestLanguageDetectionService());
  instantiationService.stub(IPathService, overrides?.pathService ? overrides.pathService(instantiationService) : new TestPathService());
  const layoutService = new TestLayoutService();
  instantiationService.stub(IWorkbenchLayoutService, layoutService);
  instantiationService.stub(IDialogService, new TestDialogService());
  const accessibilityService = new TestAccessibilityService();
  instantiationService.stub(IAccessibilityService, accessibilityService);
  instantiationService.stub(IAccessibilitySignalService, {
    playSignal: async () => {
    },
    isSoundEnabled(signal) {
      return false;
    }
  });
  instantiationService.stub(IFileDialogService, instantiationService.createInstance(TestFileDialogService));
  instantiationService.stub(ILanguageService, disposables.add(instantiationService.createInstance(LanguageService)));
  instantiationService.stub(ILanguageFeaturesService, new LanguageFeaturesService());
  instantiationService.stub(ILanguageFeatureDebounceService, instantiationService.createInstance(LanguageFeatureDebounceService));
  instantiationService.stub(IHistoryService, new TestHistoryService());
  instantiationService.stub(ITextResourcePropertiesService, new TestTextResourcePropertiesService(configService));
  instantiationService.stub(IUndoRedoService, instantiationService.createInstance(UndoRedoService));
  const themeService = new TestThemeService();
  instantiationService.stub(IThemeService, themeService);
  instantiationService.stub(ILanguageConfigurationService, disposables.add(new TestLanguageConfigurationService()));
  instantiationService.stub(IModelService, disposables.add(instantiationService.createInstance(ModelService)));
  const fileService = overrides?.fileService ? overrides.fileService(instantiationService) : disposables.add(new TestFileService());
  instantiationService.stub(IFileService, fileService);
  instantiationService.stub(IUriIdentityService, disposables.add(new UriIdentityService(fileService)));
  const markerService = new TestMarkerService();
  instantiationService.stub(IMarkerService, markerService);
  instantiationService.stub(IFilesConfigurationService, disposables.add(instantiationService.createInstance(TestFilesConfigurationService)));
  const userDataProfilesService = instantiationService.stub(IUserDataProfilesService, disposables.add(instantiationService.createInstance(UserDataProfilesService)));
  instantiationService.stub(IUserDataProfileService, disposables.add(new UserDataProfileService(userDataProfilesService.defaultProfile)));
  instantiationService.stub(IWorkingCopyBackupService, overrides?.workingCopyBackupService ? overrides?.workingCopyBackupService(instantiationService) : disposables.add(new TestWorkingCopyBackupService()));
  instantiationService.stub(ITelemetryService, NullTelemetryService);
  instantiationService.stub(INotificationService, new TestNotificationService());
  instantiationService.stub(IUntitledTextEditorService, disposables.add(instantiationService.createInstance(UntitledTextEditorService)));
  instantiationService.stub(IMenuService, new TestMenuService());
  const keybindingService = new MockKeybindingService();
  instantiationService.stub(IKeybindingService, keybindingService);
  instantiationService.stub(IDecorationsService, new TestDecorationsService());
  instantiationService.stub(IExtensionService, new TestExtensionService());
  instantiationService.stub(IWorkingCopyFileService, disposables.add(instantiationService.createInstance(WorkingCopyFileService)));
  instantiationService.stub(ITextFileService, overrides?.textFileService ? overrides.textFileService(instantiationService) : disposables.add(instantiationService.createInstance(TestTextFileService)));
  instantiationService.stub(IHostService, instantiationService.createInstance(TestHostService));
  instantiationService.stub(ITextModelService, disposables.add(instantiationService.createInstance(TextModelResolverService)));
  instantiationService.stub(ILoggerService, disposables.add(new TestLoggerService(TestEnvironmentService.logsHome)));
  const editorGroupService = new TestEditorGroupsService([new TestEditorGroupView(0)]);
  instantiationService.stub(IEditorGroupsService, editorGroupService);
  instantiationService.stub(ILabelService, disposables.add(instantiationService.createInstance(LabelService)));
  const editorService = overrides?.editorService ? overrides.editorService(instantiationService) : disposables.add(new TestEditorService(editorGroupService));
  instantiationService.stub(IEditorService, editorService);
  instantiationService.stub(IEditorPaneService, new EditorPaneService());
  instantiationService.stub(IWorkingCopyEditorService, disposables.add(instantiationService.createInstance(WorkingCopyEditorService)));
  instantiationService.stub(IEditorResolverService, disposables.add(instantiationService.createInstance(EditorResolverService)));
  const textEditorService = overrides?.textEditorService ? overrides.textEditorService(instantiationService) : disposables.add(instantiationService.createInstance(TextEditorService));
  instantiationService.stub(ITextEditorService, textEditorService);
  instantiationService.stub(ICodeEditorService, disposables.add(new CodeEditorService(editorService, themeService, configService)));
  instantiationService.stub(IPaneCompositePartService, disposables.add(new TestPaneCompositeService()));
  instantiationService.stub(IListService, new TestListService());
  instantiationService.stub(IContextViewService, disposables.add(instantiationService.createInstance(ContextViewService)));
  instantiationService.stub(IContextMenuService, disposables.add(instantiationService.createInstance(ContextMenuService)));
  instantiationService.stub(IQuickInputService, disposables.add(new QuickInputService(configService, instantiationService, keybindingService, contextKeyService, themeService, layoutService)));
  instantiationService.stub(IWorkspacesService, new TestWorkspacesService());
  instantiationService.stub(IWorkspaceTrustManagementService, disposables.add(new TestWorkspaceTrustManagementService()));
  instantiationService.stub(IWorkspaceTrustRequestService, disposables.add(new TestWorkspaceTrustRequestService(false)));
  instantiationService.stub(ITerminalInstanceService, new TestTerminalInstanceService());
  instantiationService.stub(ITerminalEditorService, new TestTerminalEditorService());
  instantiationService.stub(ITerminalGroupService, new TestTerminalGroupService());
  instantiationService.stub(ITerminalProfileService, new TestTerminalProfileService());
  instantiationService.stub(ITerminalProfileResolverService, new TestTerminalProfileResolverService());
  instantiationService.stub(ITerminalConfigurationService, disposables.add(instantiationService.createInstance(TestTerminalConfigurationService)));
  instantiationService.stub(ITerminalLogService, disposables.add(instantiationService.createInstance(TerminalLogService)));
  instantiationService.stub(IEnvironmentVariableService, disposables.add(instantiationService.createInstance(EnvironmentVariableService)));
  instantiationService.stub(IElevatedFileService, new BrowserElevatedFileService());
  instantiationService.stub(IRemoteSocketFactoryService, new RemoteSocketFactoryService());
  instantiationService.stub(ICustomEditorLabelService, disposables.add(new CustomEditorLabelService(configService, workspaceContextService)));
  instantiationService.stub(IHoverService, NullHoverService);
  return instantiationService;
}
let TestServiceAccessor = class {
  constructor(lifecycleService, textFileService, textEditorService, workingCopyFileService, filesConfigurationService, contextService, modelService, fileService, fileDialogService, dialogService, workingCopyService, editorService, editorPaneService, environmentService, pathService, editorGroupService, editorResolverService, languageService, textModelResolverService, untitledTextEditorService, testConfigurationService, workingCopyBackupService, hostService, quickInputService, labelService, logService, uriIdentityService, instantitionService, notificationService, workingCopyEditorService, instantiationService, elevatedFileService, workspaceTrustRequestService, decorationsService, progressService) {
    this.lifecycleService = lifecycleService;
    this.textFileService = textFileService;
    this.textEditorService = textEditorService;
    this.workingCopyFileService = workingCopyFileService;
    this.filesConfigurationService = filesConfigurationService;
    this.contextService = contextService;
    this.modelService = modelService;
    this.fileService = fileService;
    this.fileDialogService = fileDialogService;
    this.dialogService = dialogService;
    this.workingCopyService = workingCopyService;
    this.editorService = editorService;
    this.editorPaneService = editorPaneService;
    this.environmentService = environmentService;
    this.pathService = pathService;
    this.editorGroupService = editorGroupService;
    this.editorResolverService = editorResolverService;
    this.languageService = languageService;
    this.textModelResolverService = textModelResolverService;
    this.untitledTextEditorService = untitledTextEditorService;
    this.testConfigurationService = testConfigurationService;
    this.workingCopyBackupService = workingCopyBackupService;
    this.hostService = hostService;
    this.quickInputService = quickInputService;
    this.labelService = labelService;
    this.logService = logService;
    this.uriIdentityService = uriIdentityService;
    this.instantitionService = instantitionService;
    this.notificationService = notificationService;
    this.workingCopyEditorService = workingCopyEditorService;
    this.instantiationService = instantiationService;
    this.elevatedFileService = elevatedFileService;
    this.workspaceTrustRequestService = workspaceTrustRequestService;
    this.decorationsService = decorationsService;
    this.progressService = progressService;
  }
};
TestServiceAccessor = __decorateClass([
  __decorateParam(0, ILifecycleService),
  __decorateParam(1, ITextFileService),
  __decorateParam(2, ITextEditorService),
  __decorateParam(3, IWorkingCopyFileService),
  __decorateParam(4, IFilesConfigurationService),
  __decorateParam(5, IWorkspaceContextService),
  __decorateParam(6, IModelService),
  __decorateParam(7, IFileService),
  __decorateParam(8, IFileDialogService),
  __decorateParam(9, IDialogService),
  __decorateParam(10, IWorkingCopyService),
  __decorateParam(11, IEditorService),
  __decorateParam(12, IEditorPaneService),
  __decorateParam(13, IWorkbenchEnvironmentService),
  __decorateParam(14, IPathService),
  __decorateParam(15, IEditorGroupsService),
  __decorateParam(16, IEditorResolverService),
  __decorateParam(17, ILanguageService),
  __decorateParam(18, ITextModelService),
  __decorateParam(19, IUntitledTextEditorService),
  __decorateParam(20, IConfigurationService),
  __decorateParam(21, IWorkingCopyBackupService),
  __decorateParam(22, IHostService),
  __decorateParam(23, IQuickInputService),
  __decorateParam(24, ILabelService),
  __decorateParam(25, ILogService),
  __decorateParam(26, IUriIdentityService),
  __decorateParam(27, IInstantiationService),
  __decorateParam(28, INotificationService),
  __decorateParam(29, IWorkingCopyEditorService),
  __decorateParam(30, IInstantiationService),
  __decorateParam(31, IElevatedFileService),
  __decorateParam(32, IWorkspaceTrustRequestService),
  __decorateParam(33, IDecorationsService),
  __decorateParam(34, IProgressService)
], TestServiceAccessor);
let TestTextFileService = class extends BrowserTextFileService {
  constructor(fileService, untitledTextEditorService, lifecycleService, instantiationService, modelService, environmentService, dialogService, fileDialogService, textResourceConfigurationService, filesConfigurationService, codeEditorService, pathService, workingCopyFileService, uriIdentityService, languageService, logService, elevatedFileService, decorationsService) {
    super(
      fileService,
      untitledTextEditorService,
      lifecycleService,
      instantiationService,
      modelService,
      environmentService,
      dialogService,
      fileDialogService,
      textResourceConfigurationService,
      filesConfigurationService,
      codeEditorService,
      pathService,
      workingCopyFileService,
      uriIdentityService,
      languageService,
      elevatedFileService,
      logService,
      decorationsService
    );
    this.readStreamError = void 0;
    this.writeError = void 0;
  }
  setReadStreamErrorOnce(error) {
    this.readStreamError = error;
  }
  async readStream(resource, options) {
    if (this.readStreamError) {
      const error = this.readStreamError;
      this.readStreamError = void 0;
      throw error;
    }
    const content = await this.fileService.readFileStream(resource, options);
    return {
      resource: content.resource,
      name: content.name,
      mtime: content.mtime,
      ctime: content.ctime,
      etag: content.etag,
      encoding: "utf8",
      value: await createTextBufferFactoryFromStream(content.value),
      size: 10,
      readonly: false,
      locked: false
    };
  }
  setWriteErrorOnce(error) {
    this.writeError = error;
  }
  async write(resource, value, options) {
    if (this.writeError) {
      const error = this.writeError;
      this.writeError = void 0;
      throw error;
    }
    return super.write(resource, value, options);
  }
};
TestTextFileService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IUntitledTextEditorService),
  __decorateParam(2, ILifecycleService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, IModelService),
  __decorateParam(5, IWorkbenchEnvironmentService),
  __decorateParam(6, IDialogService),
  __decorateParam(7, IFileDialogService),
  __decorateParam(8, ITextResourceConfigurationService),
  __decorateParam(9, IFilesConfigurationService),
  __decorateParam(10, ICodeEditorService),
  __decorateParam(11, IPathService),
  __decorateParam(12, IWorkingCopyFileService),
  __decorateParam(13, IUriIdentityService),
  __decorateParam(14, ILanguageService),
  __decorateParam(15, ILogService),
  __decorateParam(16, IElevatedFileService),
  __decorateParam(17, IDecorationsService)
], TestTextFileService);
class TestBrowserTextFileServiceWithEncodingOverrides extends BrowserTextFileService {
  get encoding() {
    if (!this._testEncoding) {
      this._testEncoding = this._register(this.instantiationService.createInstance(TestEncodingOracle));
    }
    return this._testEncoding;
  }
}
class TestEncodingOracle extends EncodingOracle {
  get encodingOverrides() {
    return [
      { extension: "utf16le", encoding: UTF16le },
      { extension: "utf16be", encoding: UTF16be },
      { extension: "utf8bom", encoding: UTF8_with_bom }
    ];
  }
  set encodingOverrides(overrides) {
  }
}
class TestEnvironmentServiceWithArgs extends BrowserWorkbenchEnvironmentService {
  constructor() {
    super(...arguments);
    this.args = [];
  }
}
const TestEnvironmentService = new TestEnvironmentServiceWithArgs("", URI.file("tests").with({ scheme: "vscode-tests" }), /* @__PURE__ */ Object.create(null), TestProductService);
class TestProgressService {
  withProgress(options, task, onDidCancel) {
    return task(Progress.None);
  }
}
class TestDecorationsService {
  constructor() {
    this.onDidChangeDecorations = Event.None;
  }
  registerDecorationsProvider(_provider) {
    return Disposable.None;
  }
  getDecoration(_uri, _includeChildren, _overwrite) {
    return void 0;
  }
}
class TestMenuService {
  createMenu(_id, _scopedKeybindingService) {
    return {
      onDidChange: Event.None,
      dispose: () => void 0,
      getActions: () => []
    };
  }
  getMenuActions(id, contextKeyService, options) {
    throw new Error("Method not implemented.");
  }
  getMenuContexts(id) {
    throw new Error("Method not implemented.");
  }
  resetHiddenStates() {
  }
}
let TestFileDialogService = class {
  constructor(pathService) {
    this.pathService = pathService;
  }
  async defaultFilePath(_schemeFilter) {
    return this.pathService.userHome();
  }
  async defaultFolderPath(_schemeFilter) {
    return this.pathService.userHome();
  }
  async defaultWorkspacePath(_schemeFilter) {
    return this.pathService.userHome();
  }
  async preferredHome(_schemeFilter) {
    return this.pathService.userHome();
  }
  pickFileFolderAndOpen(_options) {
    return Promise.resolve(0);
  }
  pickFileAndOpen(_options) {
    return Promise.resolve(0);
  }
  pickFolderAndOpen(_options) {
    return Promise.resolve(0);
  }
  pickWorkspaceAndOpen(_options) {
    return Promise.resolve(0);
  }
  setPickFileToSave(path) {
    this.fileToSave = path;
  }
  pickFileToSave(defaultUri, availableFileSystems) {
    return Promise.resolve(this.fileToSave);
  }
  showSaveDialog(_options) {
    return Promise.resolve(void 0);
  }
  showOpenDialog(_options) {
    return Promise.resolve(void 0);
  }
  setConfirmResult(result) {
    this.confirmResult = result;
  }
  showSaveConfirm(fileNamesOrResources) {
    return Promise.resolve(this.confirmResult);
  }
};
TestFileDialogService = __decorateClass([
  __decorateParam(0, IPathService)
], TestFileDialogService);
class TestLayoutService {
  constructor() {
    this.openedDefaultEditors = false;
    this.mainContainerDimension = { width: 800, height: 600 };
    this.activeContainerDimension = { width: 800, height: 600 };
    this.mainContainerOffset = { top: 0, quickPickTop: 0 };
    this.activeContainerOffset = { top: 0, quickPickTop: 0 };
    this.mainContainer = mainWindow.document.body;
    this.containers = [mainWindow.document.body];
    this.activeContainer = mainWindow.document.body;
    this.onDidChangeZenMode = Event.None;
    this.onDidChangeMainEditorCenteredLayout = Event.None;
    this.onDidChangeWindowMaximized = Event.None;
    this.onDidChangePanelPosition = Event.None;
    this.onDidChangePanelAlignment = Event.None;
    this.onDidChangePartVisibility = Event.None;
    this.onDidLayoutMainContainer = Event.None;
    this.onDidLayoutActiveContainer = Event.None;
    this.onDidLayoutContainer = Event.None;
    this.onDidChangeNotificationsVisibility = Event.None;
    this.onDidAddContainer = Event.None;
    this.onDidChangeActiveContainer = Event.None;
    this.whenReady = Promise.resolve(void 0);
    this.whenRestored = Promise.resolve(void 0);
  }
  layout() {
  }
  isRestored() {
    return true;
  }
  hasFocus(_part) {
    return false;
  }
  focusPart(_part) {
  }
  hasMainWindowBorder() {
    return false;
  }
  getMainWindowBorderRadius() {
    return void 0;
  }
  isVisible(_part) {
    return true;
  }
  getContainer() {
    return mainWindow.document.body;
  }
  whenContainerStylesLoaded() {
    return void 0;
  }
  isTitleBarHidden() {
    return false;
  }
  isStatusBarHidden() {
    return false;
  }
  isActivityBarHidden() {
    return false;
  }
  setActivityBarHidden(_hidden) {
  }
  setBannerHidden(_hidden) {
  }
  isSideBarHidden() {
    return false;
  }
  async setEditorHidden(_hidden) {
  }
  async setSideBarHidden(_hidden) {
  }
  async setAuxiliaryBarHidden(_hidden) {
  }
  async setPartHidden(_hidden, part) {
  }
  isPanelHidden() {
    return false;
  }
  async setPanelHidden(_hidden) {
  }
  toggleMaximizedPanel() {
  }
  isPanelMaximized() {
    return false;
  }
  getMenubarVisibility() {
    throw new Error("not implemented");
  }
  toggleMenuBar() {
  }
  getSideBarPosition() {
    return 0;
  }
  getPanelPosition() {
    return 0;
  }
  getPanelAlignment() {
    return "center";
  }
  async setPanelPosition(_position) {
  }
  async setPanelAlignment(_alignment) {
  }
  addClass(_clazz) {
  }
  removeClass(_clazz) {
  }
  getMaximumEditorDimensions() {
    throw new Error("not implemented");
  }
  toggleZenMode() {
  }
  isMainEditorLayoutCentered() {
    return false;
  }
  centerMainEditorLayout(_active) {
  }
  resizePart(_part, _sizeChangeWidth, _sizeChangeHeight) {
  }
  getSize(part) {
    throw new Error("Method not implemented.");
  }
  setSize(part, size) {
    throw new Error("Method not implemented.");
  }
  registerPart(part) {
    return Disposable.None;
  }
  isWindowMaximized(targetWindow) {
    return false;
  }
  updateWindowMaximizedState(targetWindow, maximized) {
  }
  getVisibleNeighborPart(part, direction) {
    return void 0;
  }
  focus() {
  }
}
const activeViewlet = {};
class TestPaneCompositeService extends Disposable {
  constructor() {
    super();
    this.parts = /* @__PURE__ */ new Map();
    this.parts.set(ViewContainerLocation.Panel, new TestPanelPart());
    this.parts.set(ViewContainerLocation.Sidebar, new TestSideBarPart());
    this.onDidPaneCompositeOpen = Event.any(...[ViewContainerLocation.Panel, ViewContainerLocation.Sidebar].map((loc) => Event.map(this.parts.get(loc).onDidPaneCompositeOpen, (composite) => {
      return { composite, viewContainerLocation: loc };
    })));
    this.onDidPaneCompositeClose = Event.any(...[ViewContainerLocation.Panel, ViewContainerLocation.Sidebar].map((loc) => Event.map(this.parts.get(loc).onDidPaneCompositeClose, (composite) => {
      return { composite, viewContainerLocation: loc };
    })));
  }
  openPaneComposite(id, viewContainerLocation, focus) {
    return this.getPartByLocation(viewContainerLocation).openPaneComposite(id, focus);
  }
  getActivePaneComposite(viewContainerLocation) {
    return this.getPartByLocation(viewContainerLocation).getActivePaneComposite();
  }
  getPaneComposite(id, viewContainerLocation) {
    return this.getPartByLocation(viewContainerLocation).getPaneComposite(id);
  }
  getPaneComposites(viewContainerLocation) {
    return this.getPartByLocation(viewContainerLocation).getPaneComposites();
  }
  getProgressIndicator(id, viewContainerLocation) {
    return this.getPartByLocation(viewContainerLocation).getProgressIndicator(id);
  }
  hideActivePaneComposite(viewContainerLocation) {
    this.getPartByLocation(viewContainerLocation).hideActivePaneComposite();
  }
  getLastActivePaneCompositeId(viewContainerLocation) {
    return this.getPartByLocation(viewContainerLocation).getLastActivePaneCompositeId();
  }
  getPinnedPaneCompositeIds(viewContainerLocation) {
    throw new Error("Method not implemented.");
  }
  getVisiblePaneCompositeIds(viewContainerLocation) {
    throw new Error("Method not implemented.");
  }
  getPaneCompositeIds(viewContainerLocation) {
    throw new Error("Method not implemented.");
  }
  getPartByLocation(viewContainerLocation) {
    return assertIsDefined(this.parts.get(viewContainerLocation));
  }
}
class TestSideBarPart {
  constructor() {
    this.onDidViewletRegisterEmitter = new Emitter();
    this.onDidViewletDeregisterEmitter = new Emitter();
    this.onDidViewletOpenEmitter = new Emitter();
    this.onDidViewletCloseEmitter = new Emitter();
    this.partId = Parts.SIDEBAR_PART;
    this.element = void 0;
    this.minimumWidth = 0;
    this.maximumWidth = 0;
    this.minimumHeight = 0;
    this.maximumHeight = 0;
    this.onDidChange = Event.None;
    this.onDidPaneCompositeOpen = this.onDidViewletOpenEmitter.event;
    this.onDidPaneCompositeClose = this.onDidViewletCloseEmitter.event;
  }
  openPaneComposite(id, focus) {
    return Promise.resolve(void 0);
  }
  getPaneComposites() {
    return [];
  }
  getAllViewlets() {
    return [];
  }
  getActivePaneComposite() {
    return activeViewlet;
  }
  getDefaultViewletId() {
    return "workbench.view.explorer";
  }
  getPaneComposite(id) {
    return void 0;
  }
  getProgressIndicator(id) {
    return void 0;
  }
  hideActivePaneComposite() {
  }
  getLastActivePaneCompositeId() {
    return void 0;
  }
  dispose() {
  }
  getPinnedPaneCompositeIds() {
    return [];
  }
  getVisiblePaneCompositeIds() {
    return [];
  }
  getPaneCompositeIds() {
    return [];
  }
  layout(width, height, top, left) {
  }
}
class TestPanelPart {
  constructor() {
    this.element = void 0;
    this.minimumWidth = 0;
    this.maximumWidth = 0;
    this.minimumHeight = 0;
    this.maximumHeight = 0;
    this.onDidChange = Event.None;
    this.onDidPaneCompositeOpen = new Emitter().event;
    this.onDidPaneCompositeClose = new Emitter().event;
    this.partId = Parts.AUXILIARYBAR_PART;
  }
  async openPaneComposite(id, focus) {
    return void 0;
  }
  getPaneComposite(id) {
    return activeViewlet;
  }
  getPaneComposites() {
    return [];
  }
  getPinnedPaneCompositeIds() {
    return [];
  }
  getVisiblePaneCompositeIds() {
    return [];
  }
  getPaneCompositeIds() {
    return [];
  }
  getActivePaneComposite() {
    return activeViewlet;
  }
  setPanelEnablement(id, enabled) {
  }
  dispose() {
  }
  getProgressIndicator(id) {
    return null;
  }
  hideActivePaneComposite() {
  }
  getLastActivePaneCompositeId() {
    return void 0;
  }
  layout(width, height, top, left) {
  }
}
class TestViewsService {
  constructor() {
    this.onDidChangeViewContainerVisibility = new Emitter().event;
    this.onDidChangeViewVisibilityEmitter = new Emitter();
    this.onDidChangeViewVisibility = this.onDidChangeViewVisibilityEmitter.event;
    this.onDidChangeFocusedViewEmitter = new Emitter();
    this.onDidChangeFocusedView = this.onDidChangeFocusedViewEmitter.event;
  }
  isViewContainerVisible(id) {
    return true;
  }
  isViewContainerActive(id) {
    return true;
  }
  getVisibleViewContainer() {
    return null;
  }
  openViewContainer(id, focus) {
    return Promise.resolve(null);
  }
  closeViewContainer(id) {
  }
  isViewVisible(id) {
    return true;
  }
  getActiveViewWithId(id) {
    return null;
  }
  getViewWithId(id) {
    return null;
  }
  openView(id, focus) {
    return Promise.resolve(null);
  }
  closeView(id) {
  }
  getViewProgressIndicator(id) {
    return null;
  }
  getActiveViewPaneContainerWithId(id) {
    return null;
  }
  getFocusedViewName() {
    return "";
  }
  getFocusedView() {
    return null;
  }
}
class TestEditorGroupsService {
  constructor(groups = []) {
    this.groups = groups;
    this.parts = [this];
    this.windowId = mainWindow.vscodeWindowId;
    this.onDidCreateAuxiliaryEditorPart = Event.None;
    this.onDidChangeActiveGroup = Event.None;
    this.onDidActivateGroup = Event.None;
    this.onDidAddGroup = Event.None;
    this.onDidRemoveGroup = Event.None;
    this.onDidMoveGroup = Event.None;
    this.onDidChangeGroupIndex = Event.None;
    this.onDidChangeGroupLabel = Event.None;
    this.onDidChangeGroupLocked = Event.None;
    this.onDidChangeGroupMaximized = Event.None;
    this.onDidLayout = Event.None;
    this.onDidChangeEditorPartOptions = Event.None;
    this.onDidScroll = Event.None;
    this.onWillDispose = Event.None;
    this.orientation = GroupOrientation.HORIZONTAL;
    this.isReady = true;
    this.whenReady = Promise.resolve(void 0);
    this.whenRestored = Promise.resolve(void 0);
    this.hasRestorableState = false;
    this.contentDimension = { width: 800, height: 600 };
    this.mainPart = this;
  }
  get activeGroup() {
    return this.groups[0];
  }
  get sideGroup() {
    return this.groups[0];
  }
  get count() {
    return this.groups.length;
  }
  getPart(group) {
    return this;
  }
  saveWorkingSet(name) {
    throw new Error("Method not implemented.");
  }
  getWorkingSets() {
    throw new Error("Method not implemented.");
  }
  applyWorkingSet(workingSet, options) {
    throw new Error("Method not implemented.");
  }
  deleteWorkingSet(workingSet) {
    throw new Error("Method not implemented.");
  }
  getGroups(_order) {
    return this.groups;
  }
  getGroup(identifier) {
    return this.groups.find((group) => group.id === identifier);
  }
  getLabel(_identifier) {
    return "Group 1";
  }
  findGroup(_scope, _source, _wrap) {
    throw new Error("not implemented");
  }
  activateGroup(_group) {
    throw new Error("not implemented");
  }
  restoreGroup(_group) {
    throw new Error("not implemented");
  }
  getSize(_group) {
    return { width: 100, height: 100 };
  }
  setSize(_group, _size) {
  }
  arrangeGroups(_arrangement) {
  }
  toggleMaximizeGroup() {
  }
  hasMaximizedGroup() {
    throw new Error("not implemented");
  }
  toggleExpandGroup() {
  }
  applyLayout(_layout) {
  }
  getLayout() {
    throw new Error("not implemented");
  }
  setGroupOrientation(_orientation) {
  }
  addGroup(_location, _direction) {
    throw new Error("not implemented");
  }
  removeGroup(_group) {
  }
  moveGroup(_group, _location, _direction) {
    throw new Error("not implemented");
  }
  mergeGroup(_group, _target, _options) {
    throw new Error("not implemented");
  }
  mergeAllGroups(_group, _options) {
    throw new Error("not implemented");
  }
  copyGroup(_group, _location, _direction) {
    throw new Error("not implemented");
  }
  centerLayout(active) {
  }
  isLayoutCentered() {
    return false;
  }
  createEditorDropTarget(container, delegate) {
    return Disposable.None;
  }
  registerContextKeyProvider(_provider) {
    throw new Error("not implemented");
  }
  getScopedInstantiationService(part) {
    throw new Error("Method not implemented.");
  }
  enforcePartOptions(options) {
    return Disposable.None;
  }
  registerEditorPart(part) {
    return Disposable.None;
  }
  createAuxiliaryEditorPart() {
    throw new Error("Method not implemented.");
  }
}
class TestEditorGroupView {
  constructor(id) {
    this.id = id;
    this.windowId = mainWindow.vscodeWindowId;
    this.groupsView = void 0;
    this.selectedEditors = [];
    this.editors = [];
    this.whenRestored = Promise.resolve(void 0);
    this.isEmpty = true;
    this.onWillDispose = Event.None;
    this.onDidModelChange = Event.None;
    this.onWillCloseEditor = Event.None;
    this.onDidCloseEditor = Event.None;
    this.onDidOpenEditorFail = Event.None;
    this.onDidFocus = Event.None;
    this.onDidChange = Event.None;
    this.onWillMoveEditor = Event.None;
    this.onWillOpenEditor = Event.None;
    this.onDidActiveEditorChange = Event.None;
  }
  getEditors(_order) {
    return [];
  }
  findEditors(_resource) {
    return [];
  }
  getEditorByIndex(_index) {
    throw new Error("not implemented");
  }
  getIndexOfEditor(_editor) {
    return -1;
  }
  isFirst(editor) {
    return false;
  }
  isLast(editor) {
    return false;
  }
  openEditor(_editor, _options) {
    throw new Error("not implemented");
  }
  openEditors(_editors) {
    throw new Error("not implemented");
  }
  isPinned(_editor) {
    return false;
  }
  isSticky(_editor) {
    return false;
  }
  isTransient(_editor) {
    return false;
  }
  isActive(_editor) {
    return false;
  }
  setSelection(_activeSelectedEditor, _inactiveSelectedEditors) {
    throw new Error("not implemented");
  }
  isSelected(_editor) {
    return false;
  }
  contains(candidate) {
    return false;
  }
  moveEditor(_editor, _target, _options) {
    return true;
  }
  moveEditors(_editors, _target) {
    return true;
  }
  copyEditor(_editor, _target, _options) {
  }
  copyEditors(_editors, _target) {
  }
  async closeEditor(_editor, options) {
    return true;
  }
  async closeEditors(_editors, options) {
    return true;
  }
  async closeAllEditors(options) {
    return true;
  }
  async replaceEditors(_editors) {
  }
  pinEditor(_editor) {
  }
  stickEditor(editor) {
  }
  unstickEditor(editor) {
  }
  lock(locked) {
  }
  focus() {
  }
  get scopedContextKeyService() {
    throw new Error("not implemented");
  }
  setActive(_isActive) {
  }
  notifyIndexChanged(_index) {
  }
  notifyLabelChanged(_label) {
  }
  dispose() {
  }
  toJSON() {
    return /* @__PURE__ */ Object.create(null);
  }
  layout(_width, _height) {
  }
  relayout() {
  }
  createEditorActions(_menuDisposable) {
    throw new Error("not implemented");
  }
}
class TestEditorGroupAccessor {
  constructor() {
    this.label = "";
    this.windowId = mainWindow.vscodeWindowId;
    this.groups = [];
    this.partOptions = { ...DEFAULT_EDITOR_PART_OPTIONS };
    this.onDidChangeEditorPartOptions = Event.None;
    this.onDidVisibilityChange = Event.None;
  }
  getGroup(identifier) {
    throw new Error("Method not implemented.");
  }
  getGroups(order) {
    throw new Error("Method not implemented.");
  }
  activateGroup(identifier) {
    throw new Error("Method not implemented.");
  }
  restoreGroup(identifier) {
    throw new Error("Method not implemented.");
  }
  addGroup(location, direction) {
    throw new Error("Method not implemented.");
  }
  mergeGroup(group, target, options) {
    throw new Error("Method not implemented.");
  }
  moveGroup(group, location, direction) {
    throw new Error("Method not implemented.");
  }
  copyGroup(group, location, direction) {
    throw new Error("Method not implemented.");
  }
  removeGroup(group) {
    throw new Error("Method not implemented.");
  }
  arrangeGroups(arrangement, target) {
    throw new Error("Method not implemented.");
  }
  toggleMaximizeGroup(group) {
    throw new Error("Method not implemented.");
  }
  toggleExpandGroup(group) {
    throw new Error("Method not implemented.");
  }
}
class TestEditorService extends Disposable {
  constructor(editorGroupService) {
    super();
    this.editorGroupService = editorGroupService;
    this.onDidActiveEditorChange = Event.None;
    this.onDidVisibleEditorsChange = Event.None;
    this.onDidEditorsChange = Event.None;
    this.onWillOpenEditor = Event.None;
    this.onDidCloseEditor = Event.None;
    this.onDidOpenEditorFail = Event.None;
    this.onDidMostRecentlyActiveEditorsChange = Event.None;
    this.editors = [];
    this.mostRecentlyActiveEditors = [];
    this.visibleEditorPanes = [];
    this.visibleTextEditorControls = [];
    this.visibleEditors = [];
    this.count = this.editors.length;
  }
  get activeTextEditorControl() {
    return this._activeTextEditorControl;
  }
  set activeTextEditorControl(value) {
    this._activeTextEditorControl = value;
  }
  get activeEditor() {
    return this._activeEditor;
  }
  set activeEditor(value) {
    this._activeEditor = value;
  }
  getVisibleTextEditorControls(order) {
    return this.visibleTextEditorControls;
  }
  createScoped(editorGroupsContainer) {
    return this;
  }
  getEditors() {
    return [];
  }
  findEditors() {
    return [];
  }
  async openEditor(editor, optionsOrGroup, group) {
    if ("dispose" in editor) {
      this._register(editor);
    }
    return void 0;
  }
  async closeEditor(editor, options) {
  }
  async closeEditors(editors, options) {
  }
  doResolveEditorOpenRequest(editor) {
    if (!this.editorGroupService) {
      return void 0;
    }
    return [this.editorGroupService.activeGroup, editor, void 0];
  }
  openEditors(_editors, _group) {
    throw new Error("not implemented");
  }
  isOpened(_editor) {
    return false;
  }
  isVisible(_editor) {
    return false;
  }
  replaceEditors(_editors, _group) {
    return Promise.resolve(void 0);
  }
  save(editors, options) {
    throw new Error("Method not implemented.");
  }
  saveAll(options) {
    throw new Error("Method not implemented.");
  }
  revert(editors, options) {
    throw new Error("Method not implemented.");
  }
  revertAll(options) {
    throw new Error("Method not implemented.");
  }
}
class TestFileService {
  constructor() {
    this._onDidFilesChange = new Emitter();
    this._onDidRunOperation = new Emitter();
    this._onDidChangeFileSystemProviderCapabilities = new Emitter();
    this._onWillActivateFileSystemProvider = new Emitter();
    this.onWillActivateFileSystemProvider = this._onWillActivateFileSystemProvider.event;
    this.onDidWatchError = Event.None;
    this.content = "Hello Html";
    this.readonly = false;
    this.notExistsSet = new ResourceMap();
    this.readShouldThrowError = void 0;
    this.writeShouldThrowError = void 0;
    this.onDidChangeFileSystemProviderRegistrations = Event.None;
    this.providers = /* @__PURE__ */ new Map();
    this.watches = [];
  }
  get onDidFilesChange() {
    return this._onDidFilesChange.event;
  }
  fireFileChanges(event) {
    this._onDidFilesChange.fire(event);
  }
  get onDidRunOperation() {
    return this._onDidRunOperation.event;
  }
  fireAfterOperation(event) {
    this._onDidRunOperation.fire(event);
  }
  get onDidChangeFileSystemProviderCapabilities() {
    return this._onDidChangeFileSystemProviderCapabilities.event;
  }
  fireFileSystemProviderCapabilitiesChangeEvent(event) {
    this._onDidChangeFileSystemProviderCapabilities.fire(event);
  }
  setContent(content) {
    this.content = content;
  }
  getContent() {
    return this.content;
  }
  getLastReadFileUri() {
    return this.lastReadFileUri;
  }
  async resolve(resource, _options) {
    return createFileStat(resource, this.readonly);
  }
  stat(resource) {
    return this.resolve(resource, { resolveMetadata: true });
  }
  async resolveAll(toResolve) {
    const stats = await Promise.all(toResolve.map((resourceAndOption) => this.resolve(resourceAndOption.resource, resourceAndOption.options)));
    return stats.map((stat) => ({ stat, success: true }));
  }
  async exists(_resource) {
    return !this.notExistsSet.has(_resource);
  }
  async readFile(resource, options) {
    if (this.readShouldThrowError) {
      throw this.readShouldThrowError;
    }
    this.lastReadFileUri = resource;
    return {
      ...createFileStat(resource, this.readonly),
      value: VSBuffer.fromString(this.content)
    };
  }
  async readFileStream(resource, options) {
    if (this.readShouldThrowError) {
      throw this.readShouldThrowError;
    }
    this.lastReadFileUri = resource;
    return {
      ...createFileStat(resource, this.readonly),
      value: bufferToStream(VSBuffer.fromString(this.content))
    };
  }
  async writeFile(resource, bufferOrReadable, options) {
    await timeout(0);
    if (this.writeShouldThrowError) {
      throw this.writeShouldThrowError;
    }
    return createFileStat(resource, this.readonly);
  }
  move(_source, _target, _overwrite) {
    return Promise.resolve(null);
  }
  copy(_source, _target, _overwrite) {
    return Promise.resolve(null);
  }
  async cloneFile(_source, _target) {
  }
  createFile(_resource, _content, _options) {
    return Promise.resolve(null);
  }
  createFolder(_resource) {
    return Promise.resolve(null);
  }
  registerProvider(scheme, provider) {
    this.providers.set(scheme, provider);
    return toDisposable(() => this.providers.delete(scheme));
  }
  getProvider(scheme) {
    return this.providers.get(scheme);
  }
  async activateProvider(_scheme) {
    this._onWillActivateFileSystemProvider.fire({ scheme: _scheme, join: () => {
    } });
  }
  async canHandleResource(resource) {
    return this.hasProvider(resource);
  }
  hasProvider(resource) {
    return resource.scheme === Schemas.file || this.providers.has(resource.scheme);
  }
  listCapabilities() {
    return [
      { scheme: Schemas.file, capabilities: FileSystemProviderCapabilities.FileOpenReadWriteClose },
      ...Iterable.map(this.providers, ([scheme, p]) => {
        return { scheme, capabilities: p.capabilities };
      })
    ];
  }
  hasCapability(resource, capability) {
    if (capability === FileSystemProviderCapabilities.PathCaseSensitive && isLinux) {
      return true;
    }
    const provider = this.getProvider(resource.scheme);
    return !!(provider && provider.capabilities & capability);
  }
  async del(_resource, _options) {
  }
  createWatcher(resource, options) {
    return {
      onDidChange: Event.None,
      dispose: () => {
      }
    };
  }
  watch(_resource) {
    this.watches.push(_resource);
    return toDisposable(() => this.watches.splice(this.watches.indexOf(_resource), 1));
  }
  getWriteEncoding(_resource) {
    return { encoding: "utf8", hasBOM: false };
  }
  dispose() {
  }
  async canCreateFile(source, options) {
    return true;
  }
  async canMove(source, target, overwrite) {
    return true;
  }
  async canCopy(source, target, overwrite) {
    return true;
  }
  async canDelete(resource, options) {
    return true;
  }
}
class TestWorkingCopyBackupService extends InMemoryWorkingCopyBackupService {
  constructor() {
    super();
    this.resolved = /* @__PURE__ */ new Set();
  }
  parseBackupContent(textBufferFactory) {
    const textBuffer = textBufferFactory.create(DefaultEndOfLine.LF).textBuffer;
    const lineCount = textBuffer.getLineCount();
    const range = new Range(1, 1, lineCount, textBuffer.getLineLength(lineCount) + 1);
    return textBuffer.getValueInRange(range, EndOfLinePreference.TextDefined);
  }
  async resolve(identifier) {
    this.resolved.add(identifier);
    return super.resolve(identifier);
  }
}
function toUntypedWorkingCopyId(resource) {
  return toTypedWorkingCopyId(resource, "");
}
function toTypedWorkingCopyId(resource, typeId = "testBackupTypeId") {
  return { typeId, resource };
}
class InMemoryTestWorkingCopyBackupService extends BrowserWorkingCopyBackupService {
  constructor() {
    const disposables = new DisposableStore();
    const environmentService = TestEnvironmentService;
    const logService = new NullLogService();
    const fileService = disposables.add(new FileService(logService));
    disposables.add(fileService.registerProvider(Schemas.file, disposables.add(new InMemoryFileSystemProvider())));
    disposables.add(fileService.registerProvider(Schemas.vscodeUserData, disposables.add(new InMemoryFileSystemProvider())));
    super(new TestContextService(TestWorkspace), environmentService, fileService, logService);
    this.backupResourceJoiners = [];
    this.discardBackupJoiners = [];
    this.discardedBackups = [];
    this._register(disposables);
  }
  testGetFileService() {
    return this.fileService;
  }
  joinBackupResource() {
    return new Promise((resolve) => this.backupResourceJoiners.push(resolve));
  }
  joinDiscardBackup() {
    return new Promise((resolve) => this.discardBackupJoiners.push(resolve));
  }
  async backup(identifier, content, versionId, meta, token) {
    await super.backup(identifier, content, versionId, meta, token);
    while (this.backupResourceJoiners.length) {
      this.backupResourceJoiners.pop()();
    }
  }
  async discardBackup(identifier) {
    await super.discardBackup(identifier);
    this.discardedBackups.push(identifier);
    while (this.discardBackupJoiners.length) {
      this.discardBackupJoiners.pop()();
    }
  }
  async getBackupContents(identifier) {
    const backupResource = this.toBackupResource(identifier);
    const fileContents = await this.fileService.readFile(backupResource);
    return fileContents.value.toString();
  }
}
class TestLifecycleService extends Disposable {
  constructor() {
    super(...arguments);
    this.usePhases = false;
    this.whenStarted = new DeferredPromise();
    this.whenReady = new DeferredPromise();
    this.whenRestored = new DeferredPromise();
    this.whenEventually = new DeferredPromise();
    this.willShutdown = false;
    this._onBeforeShutdown = this._register(new Emitter());
    this._onBeforeShutdownError = this._register(new Emitter());
    this._onShutdownVeto = this._register(new Emitter());
    this._onWillShutdown = this._register(new Emitter());
    this._onDidShutdown = this._register(new Emitter());
    this.shutdownJoiners = [];
  }
  get phase() {
    return this._phase;
  }
  set phase(value) {
    this._phase = value;
    if (value === LifecyclePhase.Starting) {
      this.whenStarted.complete();
    } else if (value === LifecyclePhase.Ready) {
      this.whenReady.complete();
    } else if (value === LifecyclePhase.Restored) {
      this.whenRestored.complete();
    } else if (value === LifecyclePhase.Eventually) {
      this.whenEventually.complete();
    }
  }
  async when(phase) {
    if (!this.usePhases) {
      return;
    }
    if (phase === LifecyclePhase.Starting) {
      await this.whenStarted.p;
    } else if (phase === LifecyclePhase.Ready) {
      await this.whenReady.p;
    } else if (phase === LifecyclePhase.Restored) {
      await this.whenRestored.p;
    } else if (phase === LifecyclePhase.Eventually) {
      await this.whenEventually.p;
    }
  }
  get onBeforeShutdown() {
    return this._onBeforeShutdown.event;
  }
  get onBeforeShutdownError() {
    return this._onBeforeShutdownError.event;
  }
  get onShutdownVeto() {
    return this._onShutdownVeto.event;
  }
  get onWillShutdown() {
    return this._onWillShutdown.event;
  }
  get onDidShutdown() {
    return this._onDidShutdown.event;
  }
  fireShutdown(reason = ShutdownReason.QUIT) {
    this.shutdownJoiners = [];
    this._onWillShutdown.fire({
      join: (p) => {
        this.shutdownJoiners.push(typeof p === "function" ? p() : p);
      },
      joiners: () => [],
      force: () => {
      },
      token: CancellationToken.None,
      reason
    });
  }
  fireBeforeShutdown(event) {
    this._onBeforeShutdown.fire(event);
  }
  fireWillShutdown(event) {
    this._onWillShutdown.fire(event);
  }
  async shutdown() {
    this.fireShutdown();
  }
}
class TestBeforeShutdownEvent {
  constructor() {
    this.reason = ShutdownReason.CLOSE;
  }
  veto(value) {
    this.value = value;
  }
  finalVeto(vetoFn) {
    this.value = vetoFn();
    this.finalValue = vetoFn;
  }
}
class TestWillShutdownEvent {
  constructor() {
    this.value = [];
    this.joiners = () => [];
    this.reason = ShutdownReason.CLOSE;
    this.token = CancellationToken.None;
  }
  join(promise, joiner) {
    this.value.push(typeof promise === "function" ? promise() : promise);
  }
  force() {
  }
}
class TestTextResourceConfigurationService {
  constructor(configurationService = new TestConfigurationService()) {
    this.configurationService = configurationService;
  }
  onDidChangeConfiguration() {
    return { dispose() {
    } };
  }
  getValue(resource, arg2, arg3) {
    const position = EditorPosition.isIPosition(arg2) ? arg2 : null;
    const section = position ? typeof arg3 === "string" ? arg3 : void 0 : typeof arg2 === "string" ? arg2 : void 0;
    return this.configurationService.getValue(section, { resource });
  }
  inspect(resource, position, section) {
    return this.configurationService.inspect(section, { resource });
  }
  updateValue(resource, key, value, configurationTarget) {
    return this.configurationService.updateValue(key, value);
  }
}
class RemoteFileSystemProvider {
  constructor(wrappedFsp, remoteAuthority) {
    this.wrappedFsp = wrappedFsp;
    this.remoteAuthority = remoteAuthority;
    this.capabilities = this.wrappedFsp.capabilities;
    this.onDidChangeCapabilities = this.wrappedFsp.onDidChangeCapabilities;
    this.onDidChangeFile = Event.map(this.wrappedFsp.onDidChangeFile, (changes) => changes.map((c) => {
      return {
        type: c.type,
        resource: c.resource.with({ scheme: Schemas.vscodeRemote, authority: this.remoteAuthority })
      };
    }));
  }
  watch(resource, opts) {
    return this.wrappedFsp.watch(this.toFileResource(resource), opts);
  }
  stat(resource) {
    return this.wrappedFsp.stat(this.toFileResource(resource));
  }
  mkdir(resource) {
    return this.wrappedFsp.mkdir(this.toFileResource(resource));
  }
  readdir(resource) {
    return this.wrappedFsp.readdir(this.toFileResource(resource));
  }
  delete(resource, opts) {
    return this.wrappedFsp.delete(this.toFileResource(resource), opts);
  }
  rename(from, to, opts) {
    return this.wrappedFsp.rename(this.toFileResource(from), this.toFileResource(to), opts);
  }
  copy(from, to, opts) {
    return this.wrappedFsp.copy(this.toFileResource(from), this.toFileResource(to), opts);
  }
  readFile(resource) {
    return this.wrappedFsp.readFile(this.toFileResource(resource));
  }
  writeFile(resource, content, opts) {
    return this.wrappedFsp.writeFile(this.toFileResource(resource), content, opts);
  }
  open(resource, opts) {
    return this.wrappedFsp.open(this.toFileResource(resource), opts);
  }
  close(fd) {
    return this.wrappedFsp.close(fd);
  }
  read(fd, pos, data, offset, length) {
    return this.wrappedFsp.read(fd, pos, data, offset, length);
  }
  write(fd, pos, data, offset, length) {
    return this.wrappedFsp.write(fd, pos, data, offset, length);
  }
  readFileStream(resource, opts, token) {
    return this.wrappedFsp.readFileStream(this.toFileResource(resource), opts, token);
  }
  toFileResource(resource) {
    return resource.with({ scheme: Schemas.file, authority: "" });
  }
}
class TestInMemoryFileSystemProvider extends InMemoryFileSystemProvider {
  get capabilities() {
    return FileSystemProviderCapabilities.FileReadWrite | FileSystemProviderCapabilities.PathCaseSensitive | FileSystemProviderCapabilities.FileReadStream;
  }
  readFileStream(resource) {
    const BUFFER_SIZE = 64 * 1024;
    const stream = newWriteableStream((data) => VSBuffer.concat(data.map((data2) => VSBuffer.wrap(data2))).buffer);
    (async () => {
      try {
        const data = await this.readFile(resource);
        let offset = 0;
        while (offset < data.length) {
          await timeout(0);
          await stream.write(data.subarray(offset, offset + BUFFER_SIZE));
          offset += BUFFER_SIZE;
        }
        await timeout(0);
        stream.end();
      } catch (error) {
        stream.end(error);
      }
    })();
    return stream;
  }
}
const productService = { _serviceBrand: void 0, ...product };
class TestHostService {
  constructor() {
    this._hasFocus = true;
    this._onDidChangeFocus = new Emitter();
    this.onDidChangeFocus = this._onDidChangeFocus.event;
    this._onDidChangeWindow = new Emitter();
    this.onDidChangeActiveWindow = this._onDidChangeWindow.event;
    this.onDidChangeFullScreen = Event.None;
    this.colorScheme = ColorScheme.DARK;
    this.onDidChangeColorScheme = Event.None;
  }
  get hasFocus() {
    return this._hasFocus;
  }
  async hadLastFocus() {
    return this._hasFocus;
  }
  setFocus(focus) {
    this._hasFocus = focus;
    this._onDidChangeFocus.fire(this._hasFocus);
  }
  async restart() {
  }
  async reload() {
  }
  async close() {
  }
  async withExpectedShutdown(expectedShutdownTask) {
    return await expectedShutdownTask();
  }
  async focus() {
  }
  async moveTop() {
  }
  async getCursorScreenPoint() {
    return void 0;
  }
  async openWindow(arg1, arg2) {
  }
  async toggleFullScreen() {
  }
  async getScreenshot() {
    return void 0;
  }
  async getNativeWindowHandle(_windowId) {
    return void 0;
  }
}
class TestFilesConfigurationService extends FilesConfigurationService {
  testOnFilesConfigurationChange(configuration) {
    super.onFilesConfigurationChange(configuration, true);
  }
}
class TestReadonlyTextFileEditorModel extends TextFileEditorModel {
  isReadonly() {
    return true;
  }
}
class TestEditorInput extends EditorInput {
  constructor(resource, _typeId) {
    super();
    this.resource = resource;
    this._typeId = _typeId;
  }
  get typeId() {
    return this._typeId;
  }
  get editorId() {
    return this._typeId;
  }
  resolve() {
    return Promise.resolve(null);
  }
}
function registerTestEditor(id, inputs, serializerInputId) {
  const disposables = new DisposableStore();
  class TestEditor extends EditorPane {
    constructor(group) {
      super(id, group, NullTelemetryService, new TestThemeService(), disposables.add(new TestStorageService()));
      this._scopedContextKeyService = new MockContextKeyService();
    }
    async setInput(input, options, context, token) {
      super.setInput(input, options, context, token);
      await input.resolve();
    }
    getId() {
      return id;
    }
    layout() {
    }
    createEditor() {
    }
    get scopedContextKeyService() {
      return this._scopedContextKeyService;
    }
  }
  disposables.add(Registry.as(Extensions.EditorPane).registerEditorPane(EditorPaneDescriptor.create(TestEditor, id, "Test Editor Control"), inputs));
  if (serializerInputId) {
    class EditorsObserverTestEditorInputSerializer {
      canSerialize(editorInput) {
        return true;
      }
      serialize(editorInput) {
        const testEditorInput = editorInput;
        const testInput = {
          resource: testEditorInput.resource.toString()
        };
        return JSON.stringify(testInput);
      }
      deserialize(instantiationService, serializedEditorInput) {
        const testInput = JSON.parse(serializedEditorInput);
        return new TestFileEditorInput(URI.parse(testInput.resource), serializerInputId);
      }
    }
    disposables.add(Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(serializerInputId, EditorsObserverTestEditorInputSerializer));
  }
  return disposables;
}
function registerTestFileEditor() {
  const disposables = new DisposableStore();
  disposables.add(Registry.as(Extensions.EditorPane).registerEditorPane(
    EditorPaneDescriptor.create(
      TestTextFileEditor,
      TestTextFileEditor.ID,
      "Text File Editor"
    ),
    [new SyncDescriptor(FileEditorInput)]
  ));
  return disposables;
}
function registerTestResourceEditor() {
  const disposables = new DisposableStore();
  disposables.add(Registry.as(Extensions.EditorPane).registerEditorPane(
    EditorPaneDescriptor.create(
      TestTextResourceEditor,
      TestTextResourceEditor.ID,
      "Text Editor"
    ),
    [
      new SyncDescriptor(UntitledTextEditorInput),
      new SyncDescriptor(TextResourceEditorInput)
    ]
  ));
  return disposables;
}
function registerTestSideBySideEditor() {
  const disposables = new DisposableStore();
  disposables.add(Registry.as(Extensions.EditorPane).registerEditorPane(
    EditorPaneDescriptor.create(
      SideBySideEditor,
      SideBySideEditor.ID,
      "Text Editor"
    ),
    [
      new SyncDescriptor(SideBySideEditorInput)
    ]
  ));
  return disposables;
}
class TestFileEditorInput extends EditorInput {
  constructor(resource, _typeId) {
    super();
    this.resource = resource;
    this._typeId = _typeId;
    this.gotDisposed = false;
    this.gotSaved = false;
    this.gotSavedAs = false;
    this.gotReverted = false;
    this.dirty = false;
    this.fails = false;
    this.disableToUntyped = false;
    this._capabilities = EditorInputCapabilities.None;
    this.movedEditor = void 0;
    this.moveDisabledReason = void 0;
    this.preferredResource = this.resource;
  }
  get typeId() {
    return this._typeId;
  }
  get editorId() {
    return this._typeId;
  }
  get capabilities() {
    return this._capabilities;
  }
  set capabilities(capabilities) {
    if (this._capabilities !== capabilities) {
      this._capabilities = capabilities;
      this._onDidChangeCapabilities.fire();
    }
  }
  resolve() {
    return !this.fails ? Promise.resolve(null) : Promise.reject(new Error("fails"));
  }
  matches(other) {
    if (super.matches(other)) {
      return true;
    }
    if (other instanceof EditorInput) {
      return !!(other?.resource && this.resource.toString() === other.resource.toString() && other instanceof TestFileEditorInput && other.typeId === this.typeId);
    }
    return isEqual(this.resource, other.resource) && (this.editorId === other.options?.override || other.options?.override === void 0);
  }
  setPreferredResource(resource) {
  }
  async setEncoding(encoding) {
  }
  getEncoding() {
    return void 0;
  }
  setPreferredName(name) {
  }
  setPreferredDescription(description) {
  }
  setPreferredEncoding(encoding) {
  }
  setPreferredContents(contents) {
  }
  setLanguageId(languageId, source) {
  }
  setPreferredLanguageId(languageId) {
  }
  setForceOpenAsBinary() {
  }
  setFailToOpen() {
    this.fails = true;
  }
  async save(groupId, options) {
    this.gotSaved = true;
    this.dirty = false;
    return this;
  }
  async saveAs(groupId, options) {
    this.gotSavedAs = true;
    return this;
  }
  async revert(group, options) {
    this.gotReverted = true;
    this.gotSaved = false;
    this.gotSavedAs = false;
    this.dirty = false;
  }
  toUntyped() {
    if (this.disableToUntyped) {
      return void 0;
    }
    return { resource: this.resource };
  }
  setModified() {
    this.modified = true;
  }
  isModified() {
    return this.modified === void 0 ? this.dirty : this.modified;
  }
  setDirty() {
    this.dirty = true;
  }
  isDirty() {
    return this.dirty;
  }
  isResolved() {
    return false;
  }
  dispose() {
    super.dispose();
    this.gotDisposed = true;
  }
  async rename() {
    return this.movedEditor;
  }
  setMoveDisabled(reason) {
    this.moveDisabledReason = reason;
  }
  canMove(sourceGroup, targetGroup) {
    if (typeof this.moveDisabledReason === "string") {
      return this.moveDisabledReason;
    }
    return super.canMove(sourceGroup, targetGroup);
  }
}
class TestSingletonFileEditorInput extends TestFileEditorInput {
  get capabilities() {
    return EditorInputCapabilities.Singleton;
  }
}
class TestEditorPart extends MainEditorPart {
  constructor() {
    super(...arguments);
    this.mainPart = this;
    this.parts = [this];
    this.onDidCreateAuxiliaryEditorPart = Event.None;
  }
  testSaveState() {
    return super.saveState();
  }
  clearState() {
    const workspaceMemento = this.getMemento(StorageScope.WORKSPACE, StorageTarget.MACHINE);
    for (const key of Object.keys(workspaceMemento)) {
      delete workspaceMemento[key];
    }
    const profileMemento = this.getMemento(StorageScope.PROFILE, StorageTarget.MACHINE);
    for (const key of Object.keys(profileMemento)) {
      delete profileMemento[key];
    }
  }
  registerEditorPart(part) {
    return Disposable.None;
  }
  createAuxiliaryEditorPart() {
    throw new Error("Method not implemented.");
  }
  getScopedInstantiationService(part) {
    throw new Error("Method not implemented.");
  }
  getPart(group) {
    return this;
  }
  saveWorkingSet(name) {
    throw new Error("Method not implemented.");
  }
  getWorkingSets() {
    throw new Error("Method not implemented.");
  }
  applyWorkingSet(workingSet, options) {
    throw new Error("Method not implemented.");
  }
  deleteWorkingSet(workingSet) {
    throw new Error("Method not implemented.");
  }
  registerContextKeyProvider(provider) {
    throw new Error("Method not implemented.");
  }
}
class TestEditorParts extends EditorParts {
  createMainEditorPart() {
    this.testMainPart = this.instantiationService.createInstance(TestEditorPart, this);
    return this.testMainPart;
  }
}
async function createEditorParts(instantiationService, disposables) {
  const parts = instantiationService.createInstance(TestEditorParts);
  const part = disposables.add(parts).testMainPart;
  part.create(document.createElement("div"));
  part.layout(1080, 800, 0, 0);
  await parts.whenReady;
  return parts;
}
async function createEditorPart(instantiationService, disposables) {
  return (await createEditorParts(instantiationService, disposables)).testMainPart;
}
class TestListService {
  constructor() {
    this.lastFocusedList = void 0;
  }
  register() {
    return Disposable.None;
  }
}
class TestPathService {
  constructor(fallbackUserHome = URI.from({ scheme: Schemas.file, path: "/" }), defaultUriScheme = Schemas.file) {
    this.fallbackUserHome = fallbackUserHome;
    this.defaultUriScheme = defaultUriScheme;
  }
  hasValidBasename(resource, arg2, name) {
    if (typeof arg2 === "string" || typeof arg2 === "undefined") {
      return isValidBasename(arg2 ?? basename(resource));
    }
    return isValidBasename(name ?? basename(resource));
  }
  get path() {
    return Promise.resolve(isWindows ? win32 : posix);
  }
  userHome(options) {
    return options?.preferLocal ? this.fallbackUserHome : Promise.resolve(this.fallbackUserHome);
  }
  get resolvedUserHome() {
    return this.fallbackUserHome;
  }
  async fileURI(path) {
    return URI.file(path);
  }
}
function getLastResolvedFileStat(model) {
  const candidate = model;
  return candidate?.lastResolvedFileStat;
}
class TestWorkspacesService {
  constructor() {
    this.onDidChangeRecentlyOpened = Event.None;
  }
  async createUntitledWorkspace(folders, remoteAuthority) {
    throw new Error("Method not implemented.");
  }
  async deleteUntitledWorkspace(workspace) {
  }
  async addRecentlyOpened(recents) {
  }
  async removeRecentlyOpened(workspaces) {
  }
  async clearRecentlyOpened() {
  }
  async getRecentlyOpened() {
    return { files: [], workspaces: [] };
  }
  async getDirtyWorkspaces() {
    return [];
  }
  async enterWorkspace(path) {
    throw new Error("Method not implemented.");
  }
  async getWorkspaceIdentifier(workspacePath) {
    throw new Error("Method not implemented.");
  }
}
class TestTerminalInstanceService {
  constructor() {
    this.onDidCreateInstance = Event.None;
    this.onDidRegisterBackend = Event.None;
  }
  convertProfileToShellLaunchConfig(shellLaunchConfigOrProfile, cwd) {
    throw new Error("Method not implemented.");
  }
  preparePathForTerminalAsync(path, executable, title, shellType, remoteAuthority) {
    throw new Error("Method not implemented.");
  }
  createInstance(options, target) {
    throw new Error("Method not implemented.");
  }
  async getBackend(remoteAuthority) {
    throw new Error("Method not implemented.");
  }
  didRegisterBackend(backend) {
    throw new Error("Method not implemented.");
  }
  getRegisteredBackends() {
    throw new Error("Method not implemented.");
  }
}
class TestTerminalEditorService {
  constructor() {
    this.instances = [];
    this.onDidDisposeInstance = Event.None;
    this.onDidFocusInstance = Event.None;
    this.onDidChangeInstanceCapability = Event.None;
    this.onDidChangeActiveInstance = Event.None;
    this.onDidChangeInstances = Event.None;
  }
  openEditor(instance, editorOptions) {
    throw new Error("Method not implemented.");
  }
  detachInstance(instance) {
    throw new Error("Method not implemented.");
  }
  splitInstance(instanceToSplit, shellLaunchConfig) {
    throw new Error("Method not implemented.");
  }
  revealActiveEditor(preserveFocus) {
    throw new Error("Method not implemented.");
  }
  resolveResource(instance) {
    throw new Error("Method not implemented.");
  }
  reviveInput(deserializedInput) {
    throw new Error("Method not implemented.");
  }
  getInputFromResource(resource) {
    throw new Error("Method not implemented.");
  }
  setActiveInstance(instance) {
    throw new Error("Method not implemented.");
  }
  focusActiveInstance() {
    throw new Error("Method not implemented.");
  }
  focusInstance(instance) {
    throw new Error("Method not implemented.");
  }
  getInstanceFromResource(resource) {
    throw new Error("Method not implemented.");
  }
  focusFindWidget() {
    throw new Error("Method not implemented.");
  }
  hideFindWidget() {
    throw new Error("Method not implemented.");
  }
  findNext() {
    throw new Error("Method not implemented.");
  }
  findPrevious() {
    throw new Error("Method not implemented.");
  }
}
class TestTerminalGroupService {
  constructor() {
    this.instances = [];
    this.groups = [];
    this.activeGroupIndex = 0;
    this.lastAccessedMenu = "inline-tab";
    this.onDidChangeActiveGroup = Event.None;
    this.onDidDisposeGroup = Event.None;
    this.onDidShow = Event.None;
    this.onDidChangeGroups = Event.None;
    this.onDidChangePanelOrientation = Event.None;
    this.onDidDisposeInstance = Event.None;
    this.onDidFocusInstance = Event.None;
    this.onDidChangeInstanceCapability = Event.None;
    this.onDidChangeActiveInstance = Event.None;
    this.onDidChangeInstances = Event.None;
  }
  createGroup(instance) {
    throw new Error("Method not implemented.");
  }
  getGroupForInstance(instance) {
    throw new Error("Method not implemented.");
  }
  moveGroup(source, target) {
    throw new Error("Method not implemented.");
  }
  moveGroupToEnd(source) {
    throw new Error("Method not implemented.");
  }
  moveInstance(source, target, side) {
    throw new Error("Method not implemented.");
  }
  unsplitInstance(instance) {
    throw new Error("Method not implemented.");
  }
  joinInstances(instances) {
    throw new Error("Method not implemented.");
  }
  instanceIsSplit(instance) {
    throw new Error("Method not implemented.");
  }
  getGroupLabels() {
    throw new Error("Method not implemented.");
  }
  setActiveGroupByIndex(index) {
    throw new Error("Method not implemented.");
  }
  setActiveGroupToNext() {
    throw new Error("Method not implemented.");
  }
  setActiveGroupToPrevious() {
    throw new Error("Method not implemented.");
  }
  setActiveInstanceByIndex(terminalIndex) {
    throw new Error("Method not implemented.");
  }
  setContainer(container) {
    throw new Error("Method not implemented.");
  }
  showPanel(focus) {
    throw new Error("Method not implemented.");
  }
  hidePanel() {
    throw new Error("Method not implemented.");
  }
  focusTabs() {
    throw new Error("Method not implemented.");
  }
  focusHover() {
    throw new Error("Method not implemented.");
  }
  setActiveInstance(instance) {
    throw new Error("Method not implemented.");
  }
  focusActiveInstance() {
    throw new Error("Method not implemented.");
  }
  focusInstance(instance) {
    throw new Error("Method not implemented.");
  }
  getInstanceFromResource(resource) {
    throw new Error("Method not implemented.");
  }
  focusFindWidget() {
    throw new Error("Method not implemented.");
  }
  hideFindWidget() {
    throw new Error("Method not implemented.");
  }
  findNext() {
    throw new Error("Method not implemented.");
  }
  findPrevious() {
    throw new Error("Method not implemented.");
  }
  updateVisibility() {
    throw new Error("Method not implemented.");
  }
}
class TestTerminalProfileService {
  constructor() {
    this.availableProfiles = [];
    this.contributedProfiles = [];
    this.profilesReady = Promise.resolve();
    this.onDidChangeAvailableProfiles = Event.None;
  }
  getPlatformKey() {
    throw new Error("Method not implemented.");
  }
  refreshAvailableProfiles() {
    throw new Error("Method not implemented.");
  }
  getDefaultProfileName() {
    throw new Error("Method not implemented.");
  }
  getDefaultProfile() {
    throw new Error("Method not implemented.");
  }
  getContributedDefaultProfile(shellLaunchConfig) {
    throw new Error("Method not implemented.");
  }
  registerContributedProfile(args) {
    throw new Error("Method not implemented.");
  }
  getContributedProfileProvider(extensionIdentifier, id) {
    throw new Error("Method not implemented.");
  }
  registerTerminalProfileProvider(extensionIdentifier, id, profileProvider) {
    throw new Error("Method not implemented.");
  }
}
class TestTerminalProfileResolverService {
  constructor() {
    this.defaultProfileName = "";
  }
  resolveIcon(shellLaunchConfig) {
  }
  async resolveShellLaunchConfig(shellLaunchConfig, options) {
  }
  async getDefaultProfile(options) {
    return { path: "/default", profileName: "Default", isDefault: true };
  }
  async getDefaultShell(options) {
    return "/default";
  }
  async getDefaultShellArgs(options) {
    return [];
  }
  getDefaultIcon() {
    return Codicon.terminal;
  }
  async getEnvironment() {
    return env;
  }
  getSafeConfigValue(key, os) {
    return void 0;
  }
  getSafeConfigValueFullKey(key) {
    return void 0;
  }
  createProfileFromShellAndShellArgs(shell, shellArgs) {
    throw new Error("Method not implemented.");
  }
}
class TestTerminalConfigurationService extends TerminalConfigurationService {
  get fontMetrics() {
    return this._fontMetrics;
  }
  setConfig(config) {
    this._config = config;
  }
}
class TestQuickInputService {
  constructor() {
    this.onShow = Event.None;
    this.onHide = Event.None;
    this.currentQuickInput = void 0;
    this.quickAccess = void 0;
  }
  async pick(picks, options, token) {
    if (Array.isArray(picks)) {
      return { label: "selectedPick", description: "pick description", value: "selectedPick" };
    } else {
      return void 0;
    }
  }
  async input(options, token) {
    return options ? "resolved" + options.prompt : "resolved";
  }
  createQuickPick() {
    throw new Error("not implemented.");
  }
  createInputBox() {
    throw new Error("not implemented.");
  }
  createQuickWidget() {
    throw new Error("Method not implemented.");
  }
  focus() {
    throw new Error("not implemented.");
  }
  toggle() {
    throw new Error("not implemented.");
  }
  navigate(next, quickNavigate) {
    throw new Error("not implemented.");
  }
  accept() {
    throw new Error("not implemented.");
  }
  back() {
    throw new Error("not implemented.");
  }
  cancel() {
    throw new Error("not implemented.");
  }
  setAlignment(alignment) {
    throw new Error("not implemented.");
  }
  toggleHover() {
    throw new Error("not implemented.");
  }
}
class TestLanguageDetectionService {
  isEnabledForLanguage(languageId) {
    return false;
  }
  async detectLanguage(resource, supportedLangs) {
    return void 0;
  }
}
class TestRemoteAgentService {
  getConnection() {
    return null;
  }
  async getEnvironment() {
    return null;
  }
  async getRawEnvironment() {
    return null;
  }
  async getExtensionHostExitInfo(reconnectionToken) {
    return null;
  }
  async getDiagnosticInfo(options) {
    return void 0;
  }
  async updateTelemetryLevel(telemetryLevel) {
  }
  async logTelemetry(eventName, data) {
  }
  async flushTelemetry() {
  }
  async getRoundTripTime() {
    return void 0;
  }
  async endConnection() {
  }
}
class TestRemoteExtensionsScannerService {
  async whenExtensionsReady() {
    return { failed: [] };
  }
  scanExtensions() {
    throw new Error("Method not implemented.");
  }
}
class TestWorkbenchExtensionEnablementService {
  constructor() {
    this.onEnablementChanged = Event.None;
  }
  getEnablementState(extension) {
    return EnablementState.EnabledGlobally;
  }
  getEnablementStates(extensions, workspaceTypeOverrides) {
    return [];
  }
  getDependenciesEnablementStates(extension) {
    return [];
  }
  canChangeEnablement(extension) {
    return true;
  }
  canChangeWorkspaceEnablement(extension) {
    return true;
  }
  isEnabled(extension) {
    return true;
  }
  isEnabledEnablementState(enablementState) {
    return true;
  }
  isDisabledGlobally(extension) {
    return false;
  }
  async setEnablement(extensions, state) {
    return [];
  }
  async updateExtensionsEnablementsWhenWorkspaceTrustChanges() {
  }
}
class TestWorkbenchExtensionManagementService {
  constructor() {
    this.onInstallExtension = Event.None;
    this.onDidInstallExtensions = Event.None;
    this.onUninstallExtension = Event.None;
    this.onDidUninstallExtension = Event.None;
    this.onDidUpdateExtensionMetadata = Event.None;
    this.onProfileAwareInstallExtension = Event.None;
    this.onProfileAwareDidInstallExtensions = Event.None;
    this.onProfileAwareUninstallExtension = Event.None;
    this.onProfileAwareDidUninstallExtension = Event.None;
    this.onDidProfileAwareUninstallExtensions = Event.None;
    this.onProfileAwareDidUpdateExtensionMetadata = Event.None;
    this.onDidChangeProfile = Event.None;
    this.onDidEnableExtensions = Event.None;
  }
  installVSIX(location, manifest, installOptions) {
    throw new Error("Method not implemented.");
  }
  installFromLocation(location) {
    throw new Error("Method not implemented.");
  }
  installGalleryExtensions(extensions) {
    throw new Error("Method not implemented.");
  }
  async updateFromGallery(gallery, extension, installOptions) {
    return extension;
  }
  zip(extension) {
    throw new Error("Method not implemented.");
  }
  getManifest(vsix) {
    throw new Error("Method not implemented.");
  }
  install(vsix, options) {
    throw new Error("Method not implemented.");
  }
  isAllowed() {
    return true;
  }
  async canInstall(extension) {
    return true;
  }
  installFromGallery(extension, options) {
    throw new Error("Method not implemented.");
  }
  uninstall(extension, options) {
    throw new Error("Method not implemented.");
  }
  uninstallExtensions(extensions) {
    throw new Error("Method not implemented.");
  }
  async getInstalled(type) {
    return [];
  }
  getExtensionsControlManifest() {
    throw new Error("Method not implemented.");
  }
  async updateMetadata(local, metadata) {
    return local;
  }
  registerParticipant(pariticipant) {
  }
  async getTargetPlatform() {
    return TargetPlatform.UNDEFINED;
  }
  async cleanUp() {
  }
  download() {
    throw new Error("Method not implemented.");
  }
  copyExtensions() {
    throw new Error("Not Supported");
  }
  toggleAppliationScope() {
    throw new Error("Not Supported");
  }
  installExtensionsFromProfile() {
    throw new Error("Not Supported");
  }
  whenProfileChanged(from, to) {
    throw new Error("Not Supported");
  }
  getInstalledWorkspaceExtensionLocations() {
    throw new Error("Method not implemented.");
  }
  getInstalledWorkspaceExtensions() {
    throw new Error("Method not implemented.");
  }
  installResourceExtension() {
    throw new Error("Method not implemented.");
  }
  getExtensions() {
    throw new Error("Method not implemented.");
  }
  resetPinnedStateForAllUserExtensions(pinned) {
    throw new Error("Method not implemented.");
  }
  getInstallableServers(extension) {
    throw new Error("Method not implemented.");
  }
  isPublisherTrusted(extension) {
    return false;
  }
  getTrustedPublishers() {
    return [];
  }
  trustPublishers() {
  }
  untrustPublishers() {
  }
  async requestPublisherTrust(extensions) {
  }
}
class TestUserDataProfileService {
  constructor() {
    this.onDidChangeCurrentProfile = Event.None;
    this.currentProfile = toUserDataProfile("test", "test", URI.file("tests").with({ scheme: "vscode-tests" }), URI.file("tests").with({ scheme: "vscode-tests" }));
  }
  async updateCurrentProfile() {
  }
}
class TestWebExtensionsScannerService {
  constructor() {
    this.onDidChangeProfile = Event.None;
  }
  async scanSystemExtensions() {
    return [];
  }
  async scanUserExtensions() {
    return [];
  }
  async scanExtensionsUnderDevelopment() {
    return [];
  }
  async copyExtensions() {
    throw new Error("Method not implemented.");
  }
  scanExistingExtension(extensionLocation, extensionType) {
    throw new Error("Method not implemented.");
  }
  addExtension(location, metadata) {
    throw new Error("Method not implemented.");
  }
  addExtensionFromGallery(galleryExtension, metadata) {
    throw new Error("Method not implemented.");
  }
  removeExtension() {
    throw new Error("Method not implemented.");
  }
  updateMetadata(extension, metaData, profileLocation) {
    throw new Error("Method not implemented.");
  }
  scanExtensionManifest(extensionLocation) {
    throw new Error("Method not implemented.");
  }
}
async function workbenchTeardown(instantiationService) {
  return instantiationService.invokeFunction(async (accessor) => {
    const workingCopyService = accessor.get(IWorkingCopyService);
    const editorGroupService = accessor.get(IEditorGroupsService);
    for (const workingCopy of workingCopyService.workingCopies) {
      await workingCopy.revert();
    }
    for (const group of editorGroupService.groups) {
      await group.closeAllEditors();
    }
    for (const group of editorGroupService.groups) {
      editorGroupService.removeGroup(group);
    }
  });
}
export {
  InMemoryTestWorkingCopyBackupService,
  RemoteFileSystemProvider,
  TestBeforeShutdownEvent,
  TestBrowserTextFileServiceWithEncodingOverrides,
  TestDecorationsService,
  TestEditorGroupAccessor,
  TestEditorGroupView,
  TestEditorGroupsService,
  TestEditorInput,
  TestEditorPart,
  TestEditorParts,
  TestEditorService,
  TestEncodingOracle,
  TestEnvironmentService,
  TestFileDialogService,
  TestFileEditorInput,
  TestFileService,
  TestFilesConfigurationService,
  TestHostService,
  TestInMemoryFileSystemProvider,
  TestLayoutService,
  TestLifecycleService,
  TestListService,
  TestMenuService,
  TestPaneCompositeService,
  TestPanelPart,
  TestPathService,
  TestProgressService,
  TestQuickInputService,
  TestReadonlyTextFileEditorModel,
  TestRemoteAgentService,
  TestRemoteExtensionsScannerService,
  TestServiceAccessor,
  TestSideBarPart,
  TestSingletonFileEditorInput,
  TestTerminalConfigurationService,
  TestTerminalEditorService,
  TestTerminalGroupService,
  TestTerminalInstanceService,
  TestTerminalProfileResolverService,
  TestTerminalProfileService,
  TestTextFileEditor,
  TestTextFileService,
  TestTextResourceConfigurationService,
  TestTextResourceEditor,
  TestUserDataProfileService,
  TestViewsService,
  TestWebExtensionsScannerService,
  TestWillShutdownEvent,
  TestWorkbenchExtensionEnablementService,
  TestWorkbenchExtensionManagementService,
  TestWorkingCopyBackupService,
  TestWorkingCopyService,
  TestWorkspacesService,
  createEditorPart,
  createEditorParts,
  createFileEditorInput,
  getLastResolvedFileStat,
  productService,
  registerTestEditor,
  registerTestFileEditor,
  registerTestResourceEditor,
  registerTestSideBySideEditor,
  toTypedWorkingCopyId,
  toUntypedWorkingCopyId,
  workbenchInstantiationService,
  workbenchTeardown
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvdGVzdC9icm93c2VyL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEZpbGVFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uL2NvbnRyaWIvZmlsZXMvYnJvd3Nlci9lZGl0b3JzL2ZpbGVFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSwgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeURhdGEsIElUZWxlbWV0cnlTZXJ2aWNlLCBUZWxlbWV0cnlMZXZlbCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IE51bGxUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnlVdGlscy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgRWRpdG9ySW5wdXRXaXRoT3B0aW9ucywgSUVkaXRvcklkZW50aWZpZXIsIElVbnRpdGxlZFRleHRSZXNvdXJjZUVkaXRvcklucHV0LCBJUmVzb3VyY2VEaWZmRWRpdG9ySW5wdXQsIElFZGl0b3JQYW5lLCBJRWRpdG9yQ2xvc2VFdmVudCwgSUVkaXRvclBhcnRPcHRpb25zLCBJUmV2ZXJ0T3B0aW9ucywgR3JvdXBJZGVudGlmaWVyLCBFZGl0b3JzT3JkZXIsIElGaWxlRWRpdG9ySW5wdXQsIElFZGl0b3JGYWN0b3J5UmVnaXN0cnksIElFZGl0b3JTZXJpYWxpemVyLCBFZGl0b3JFeHRlbnNpb25zLCBJU2F2ZU9wdGlvbnMsIElNb3ZlUmVzdWx0LCBJVGV4dERpZmZFZGl0b3JQYW5lLCBJVmlzaWJsZUVkaXRvclBhbmUsIElFZGl0b3JPcGVuQ29udGV4dCwgRWRpdG9yRXh0ZW5zaW9ucyBhcyBFeHRlbnNpb25zLCBFZGl0b3JJbnB1dENhcGFiaWxpdGllcywgSVVudHlwZWRFZGl0b3JJbnB1dCwgSUVkaXRvcldpbGxNb3ZlRXZlbnQsIElFZGl0b3JXaWxsT3BlbkV2ZW50LCBJQWN0aXZlRWRpdG9yQ2hhbmdlRXZlbnQsIEVkaXRvclBhbmVTZWxlY3Rpb25DaGFuZ2VSZWFzb24sIElFZGl0b3JQYW5lU2VsZWN0aW9uLCBJVG9vbGJhckFjdGlvbnMgfSBmcm9tICcuLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IEVkaXRvclNlcnZpY2VJbXBsLCBJRWRpdG9yR3JvdXBWaWV3LCBJRWRpdG9yR3JvdXBzVmlldywgSUVkaXRvckdyb3VwVGl0bGVIZWlnaHQsIERFRkFVTFRfRURJVE9SX1BBUlRfT1BUSU9OUyB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFdmVudCwgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElSZXNvbHZlZFdvcmtpbmdDb3B5QmFja3VwLCBJV29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5QmFja3VwLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSwgQ29uZmlndXJhdGlvblRhcmdldCwgSUNvbmZpZ3VyYXRpb25WYWx1ZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaExheW91dFNlcnZpY2UsIFBhbmVsQWxpZ25tZW50LCBQYXJ0cywgUG9zaXRpb24gYXMgUGFydFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXh0TW9kZWxSZXNvbHZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy90ZXh0bW9kZWxSZXNvbHZlci9jb21tb24vdGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvck9wdGlvbnMsIElSZXNvdXJjZUVkaXRvcklucHV0LCBJUmVzb3VyY2VFZGl0b3JJbnB1dElkZW50aWZpZXIsIElUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCwgSVRleHRFZGl0b3JPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZWRpdG9yL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSVVudGl0bGVkVGV4dEVkaXRvck1vZGVsTWFuYWdlciwgSVVudGl0bGVkVGV4dEVkaXRvclNlcnZpY2UsIFVudGl0bGVkVGV4dEVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy91bnRpdGxlZC9jb21tb24vdW50aXRsZWRUZXh0RWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIElXb3Jrc3BhY2VJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZVNlcnZpY2UsIFNodXRkb3duUmVhc29uLCBTdGFydHVwS2luZCwgTGlmZWN5Y2xlUGhhc2UsIFdpbGxTaHV0ZG93bkV2ZW50LCBCZWZvcmVTaHV0ZG93bkVycm9yRXZlbnQsIEludGVybmFsQmVmb3JlU2h1dGRvd25FdmVudCwgSVdpbGxTaHV0ZG93bkV2ZW50Sm9pbmVyIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2VydmljZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9zZXJ2aWNlQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBGaWxlT3BlcmF0aW9uRXZlbnQsIElGaWxlU2VydmljZSwgSUZpbGVTdGF0LCBJRmlsZVN0YXRSZXN1bHQsIEZpbGVDaGFuZ2VzRXZlbnQsIElSZXNvbHZlRmlsZU9wdGlvbnMsIElDcmVhdGVGaWxlT3B0aW9ucywgSUZpbGVTeXN0ZW1Qcm92aWRlciwgRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLCBJRmlsZUNoYW5nZSwgSVdhdGNoT3B0aW9ucywgSVN0YXQsIEZpbGVUeXBlLCBJRmlsZURlbGV0ZU9wdGlvbnMsIElGaWxlT3ZlcndyaXRlT3B0aW9ucywgSUZpbGVXcml0ZU9wdGlvbnMsIElGaWxlT3Blbk9wdGlvbnMsIElGaWxlU3RhdFdpdGhNZXRhZGF0YSwgSVJlc29sdmVNZXRhZGF0YUZpbGVPcHRpb25zLCBJV3JpdGVGaWxlT3B0aW9ucywgSVJlYWRGaWxlT3B0aW9ucywgSUZpbGVDb250ZW50LCBJRmlsZVN0cmVhbUNvbnRlbnQsIEZpbGVPcGVyYXRpb25FcnJvciwgSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlUmVhZFN0cmVhbUNhcGFiaWxpdHksIElGaWxlUmVhZFN0cmVhbU9wdGlvbnMsIElSZWFkRmlsZVN0cmVhbU9wdGlvbnMsIElGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXNDaGFuZ2VFdmVudCwgSUZpbGVTdGF0V2l0aFBhcnRpYWxNZXRhZGF0YSwgSUZpbGVTeXN0ZW1XYXRjaGVyLCBJV2F0Y2hPcHRpb25zV2l0aENvcnJlbGF0aW9uLCBJRmlsZVN5c3RlbVByb3ZpZGVyQWN0aXZhdGlvbkV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IExhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElSZXNvdXJjZUVuY29kaW5nLCBJVGV4dEZpbGVTZXJ2aWNlLCBJUmVhZFRleHRGaWxlT3B0aW9ucywgSVRleHRGaWxlU3RyZWFtQ29udGVudCwgSVdyaXRlVGV4dEZpbGVPcHRpb25zLCBJVGV4dEZpbGVFZGl0b3JNb2RlbCwgSVRleHRGaWxlRWRpdG9yTW9kZWxNYW5hZ2VyIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvdGV4dGZpbGUvY29tbW9uL3RleHRmaWxlcy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSUhpc3RvcnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvaGlzdG9yeS9jb21tb24vaGlzdG9yeS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBNZW51QmFyVmlzaWJpbGl0eSwgSVdpbmRvd09wZW5hYmxlLCBJT3BlbldpbmRvd09wdGlvbnMsIElPcGVuRW1wdHlXaW5kb3dPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vd2luZG93L2NvbW1vbi93aW5kb3cuanMnO1xuaW1wb3J0IHsgVGVzdFdvcmtzcGFjZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS90ZXN0L2NvbW1vbi90ZXN0V29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGhlbWVJY29uIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdGhlbWFibGVzLmpzJztcbmltcG9ydCB7IFRlc3RUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS90ZXN0L2NvbW1vbi90ZXN0VGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSwgSVRleHRSZXNvdXJjZVByb3BlcnRpZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy90ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElQb3NpdGlvbiwgUG9zaXRpb24gYXMgRWRpdG9yUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgSU1lbnVTZXJ2aWNlLCBNZW51SWQsIElNZW51LCBJTWVudUNoYW5nZUV2ZW50LCBJTWVudUFjdGlvbk9wdGlvbnMsIE1lbnVJdGVtQWN0aW9uLCBTdWJtZW51SXRlbUFjdGlvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleVZhbHVlLCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IE1vY2tDb250ZXh0S2V5U2VydmljZSwgTW9ja0tleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy90ZXN0L2NvbW1vbi9tb2NrS2V5YmluZGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRleHRCdWZmZXJGYWN0b3J5LCBEZWZhdWx0RW5kT2ZMaW5lLCBFbmRPZkxpbmVQcmVmZXJlbmNlLCBJVGV4dFNuYXBzaG90IH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSwgSVBpY2tBbmRPcGVuT3B0aW9ucywgSVNhdmVEaWFsb2dPcHRpb25zLCBJT3BlbkRpYWxvZ09wdGlvbnMsIElGaWxlRGlhbG9nU2VydmljZSwgQ29uZmlybVJlc3VsdCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0Tm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Tm90aWZpY2F0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJRGVjb3JhdGlvbnNTZXJ2aWNlLCBJUmVzb3VyY2VEZWNvcmF0aW9uQ2hhbmdlRXZlbnQsIElEZWNvcmF0aW9uLCBJRGVjb3JhdGlvbkRhdGEsIElEZWNvcmF0aW9uc1Byb3ZpZGVyIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZGVjb3JhdGlvbnMvY29tbW9uL2RlY29yYXRpb25zLmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUsIERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBzU2VydmljZSwgSUVkaXRvckdyb3VwLCBHcm91cHNPcmRlciwgR3JvdXBzQXJyYW5nZW1lbnQsIEdyb3VwRGlyZWN0aW9uLCBJTWVyZ2VHcm91cE9wdGlvbnMsIElFZGl0b3JSZXBsYWNlbWVudCwgSUZpbmRHcm91cFNjb3BlLCBFZGl0b3JHcm91cExheW91dCwgSUNsb3NlRWRpdG9yT3B0aW9ucywgR3JvdXBPcmllbnRhdGlvbiwgSUNsb3NlQWxsRWRpdG9yc09wdGlvbnMsIElDbG9zZUVkaXRvcnNGaWx0ZXIsIElFZGl0b3JEcm9wVGFyZ2V0RGVsZWdhdGUsIElFZGl0b3JQYXJ0LCBJQXV4aWxpYXJ5RWRpdG9yUGFydCwgSUVkaXRvckdyb3Vwc0NvbnRhaW5lciwgSUVkaXRvcldvcmtpbmdTZXQsIElFZGl0b3JHcm91cENvbnRleHRLZXlQcm92aWRlciwgSUVkaXRvcldvcmtpbmdTZXRPcHRpb25zIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlLCBJU2F2ZUVkaXRvcnNPcHRpb25zLCBJUmV2ZXJ0QWxsRWRpdG9yc09wdGlvbnMsIFByZWZlcnJlZEdyb3VwLCBJRWRpdG9yc0NoYW5nZUV2ZW50LCBJU2F2ZUVkaXRvcnNSZXN1bHQgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvclBhbmVSZWdpc3RyeSwgRWRpdG9yUGFuZURlc2NyaXB0b3IgfSBmcm9tICcuLi8uLi9icm93c2VyL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJRGltZW5zaW9uIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBJTG9nZ2VyU2VydmljZSwgSUxvZ1NlcnZpY2UsIE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSUxhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UsIHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBQYW5lQ29tcG9zaXRlLCBQYW5lQ29tcG9zaXRlRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvcGFuZWNvbXBvc2l0ZS5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVByb2Nlc3NFbnZpcm9ubWVudCwgaXNMaW51eCwgaXNXaW5kb3dzLCBPcGVyYXRpbmdTeXN0ZW0gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9sYWJlbC9jb21tb24vbGFiZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFBhcnQgfSBmcm9tICcuLi8uLi9icm93c2VyL3BhcnQuanMnO1xuaW1wb3J0IHsgYnVmZmVyVG9TdHJlYW0sIFZTQnVmZmVyLCBWU0J1ZmZlclJlYWRhYmxlLCBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCBwcm9kdWN0IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3QuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5U2VydmljZSwgV29ya2luZ0NvcHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHksIElXb3JraW5nQ29weUJhY2t1cE1ldGEsIElXb3JraW5nQ29weUlkZW50aWZpZXIgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHkuanMnO1xuaW1wb3J0IHsgSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsIEZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9maWxlc0NvbmZpZ3VyYXRpb24vY29tbW9uL2ZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZW52aXJvbm1lbnQvYnJvd3Nlci9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQnJvd3NlclRleHRGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL3RleHRmaWxlL2Jyb3dzZXIvYnJvd3NlclRleHRGaWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0QnVmZmVyRmFjdG9yeUZyb21TdHJlYW0gfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsL3RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJUGF0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9wYXRoL2NvbW1vbi9wYXRoU2VydmljZS5qcyc7XG5pbXBvcnQgeyBEaXJlY3Rpb24sIElWaWV3U2l6ZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci91aS9ncmlkL2dyaWQuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzU2VydmljZSwgSVByb2dyZXNzT3B0aW9ucywgSVByb2dyZXNzV2luZG93T3B0aW9ucywgSVByb2dyZXNzTm90aWZpY2F0aW9uT3B0aW9ucywgSVByb2dyZXNzQ29tcG9zaXRlT3B0aW9ucywgSVByb2dyZXNzLCBJUHJvZ3Jlc3NTdGVwLCBQcm9ncmVzcywgSVByb2dyZXNzRGlhbG9nT3B0aW9ucywgSVByb2dyZXNzSW5kaWNhdG9yIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weUZpbGVTZXJ2aWNlLCBXb3JraW5nQ29weUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5RmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVW5kb1JlZG9TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdW5kb1JlZG8vY29tbW9uL3VuZG9SZWRvU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVW5kb1JlZG9TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdW5kb1JlZG8vY29tbW9uL3VuZG9SZWRvLmpzJztcbmltcG9ydCB7IFRleHRGaWxlRWRpdG9yTW9kZWwgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy90ZXh0ZmlsZS9jb21tb24vdGV4dEZpbGVFZGl0b3JNb2RlbC5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JQYW5lIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yUGFuZS5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IFRlc3REaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy90ZXN0L2NvbW1vbi90ZXN0RGlhbG9nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2VkaXRvci9icm93c2VyL2NvZGVFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE1haW5FZGl0b3JQYXJ0IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yUGFydC5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSURpZmZFZGl0b3IsIElFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbW1vbi5qcyc7XG5pbXBvcnQgeyBJSW5wdXRCb3gsIElJbnB1dE9wdGlvbnMsIElQaWNrT3B0aW9ucywgSVF1aWNrSW5wdXRCdXR0b24sIElRdWlja0lucHV0U2VydmljZSwgSVF1aWNrTmF2aWdhdGVDb25maWd1cmF0aW9uLCBJUXVpY2tQaWNrLCBJUXVpY2tQaWNrSXRlbSwgSVF1aWNrV2lkZ2V0LCBRdWlja1BpY2tJbnB1dCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgUXVpY2tJbnB1dFNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9xdWlja2lucHV0L2Jyb3dzZXIvcXVpY2tJbnB1dFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxpc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHdpbjMyLCBwb3NpeCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgVGVzdENvbnRleHRTZXJ2aWNlLCBUZXN0U3RvcmFnZVNlcnZpY2UsIFRlc3RUZXh0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZSwgVGVzdEV4dGVuc2lvblNlcnZpY2UsIFRlc3RQcm9kdWN0U2VydmljZSwgY3JlYXRlRmlsZVN0YXQsIFRlc3RMb2dnZXJTZXJ2aWNlLCBUZXN0V29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSwgVGVzdFdvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UsIFRlc3RNYXJrZXJTZXJ2aWNlLCBUZXN0SGlzdG9yeVNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IElWaWV3LCBJVmlld0Rlc2NyaXB0b3IsIFZpZXdDb250YWluZXIsIFZpZXdDb250YWluZXJMb2NhdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi92aWV3cy5qcyc7XG5pbXBvcnQgeyBJVmlld3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvdmlld3MvY29tbW9uL3ZpZXdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUGFuZUNvbXBvc2l0ZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9wYW5lY29tcG9zaXRlLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJbk1lbW9yeUZpbGVTeXN0ZW1Qcm92aWRlciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9pbk1lbW9yeUZpbGVzeXN0ZW1Qcm92aWRlci5qcyc7XG5pbXBvcnQgeyBuZXdXcml0ZWFibGVTdHJlYW0sIFJlYWRhYmxlU3RyZWFtRXZlbnRzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyZWFtLmpzJztcbmltcG9ydCB7IEVuY29kaW5nT3JhY2xlLCBJRW5jb2RpbmdPdmVycmlkZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL3RleHRmaWxlL2Jyb3dzZXIvdGV4dEZpbGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFVURjE2bGUsIFVURjE2YmUsIFVURjhfd2l0aF9ib20gfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy90ZXh0ZmlsZS9jb21tb24vZW5jb2RpbmcuanMnO1xuaW1wb3J0IHsgQ29sb3JTY2hlbWUgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWUuanMnO1xuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBJbk1lbW9yeVdvcmtpbmdDb3B5QmFja3VwU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL3dvcmtpbmdDb3B5L2NvbW1vbi93b3JraW5nQ29weUJhY2t1cFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQnJvd3NlcldvcmtpbmdDb3B5QmFja3VwU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL3dvcmtpbmdDb3B5L2Jyb3dzZXIvd29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRleHRSZXNvdXJjZUVkaXRvciB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL3RleHRSZXNvdXJjZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBUZXN0Q29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci90ZXN0L2Jyb3dzZXIvdGVzdENvZGVFZGl0b3IuanMnO1xuaW1wb3J0IHsgVGV4dEZpbGVFZGl0b3IgfSBmcm9tICcuLi8uLi9jb250cmliL2ZpbGVzL2Jyb3dzZXIvZWRpdG9ycy90ZXh0RmlsZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uL2NvbW1vbi9lZGl0b3IvdGV4dFJlc291cmNlRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgVW50aXRsZWRUZXh0RWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy91bnRpdGxlZC9jb21tb24vdW50aXRsZWRUZXh0RWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgU2lkZUJ5U2lkZUVkaXRvciB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL3NpZGVCeVNpZGVFZGl0b3IuanMnO1xuaW1wb3J0IHsgSUVudGVyV29ya3NwYWNlUmVzdWx0LCBJUmVjZW50LCBJUmVjZW50bHlPcGVuZWQsIElXb3Jrc3BhY2VGb2xkZXJDcmVhdGlvbkRhdGEsIElXb3Jrc3BhY2VzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZXMvY29tbW9uL3dvcmtzcGFjZXMuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UsIElXb3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2VUcnVzdC5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uVGVybWluYWxQcm9maWxlLCBJU2hlbGxMYXVuY2hDb25maWcsIElUZXJtaW5hbEJhY2tlbmQsIElUZXJtaW5hbExvZ1NlcnZpY2UsIElUZXJtaW5hbFByb2ZpbGUsIFRlcm1pbmFsSWNvbiwgVGVybWluYWxMb2NhdGlvbiwgVGVybWluYWxTaGVsbFR5cGUgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vdGVybWluYWwuanMnO1xuaW1wb3J0IHsgSUNyZWF0ZVRlcm1pbmFsT3B0aW9ucywgSURlc2VyaWFsaXplZFRlcm1pbmFsRWRpdG9ySW5wdXQsIElUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlLCBJVGVybWluYWxFZGl0b3JTZXJ2aWNlLCBJVGVybWluYWxHcm91cCwgSVRlcm1pbmFsR3JvdXBTZXJ2aWNlLCBJVGVybWluYWxJbnN0YW5jZSwgSVRlcm1pbmFsSW5zdGFuY2VTZXJ2aWNlLCBUZXJtaW5hbEVkaXRvckxvY2F0aW9uIH0gZnJvbSAnLi4vLi4vY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IGFzc2VydElzRGVmaW5lZCwgdXBjYXN0IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgSVJlZ2lzdGVyQ29udHJpYnV0ZWRQcm9maWxlQXJncywgSVNoZWxsTGF1bmNoQ29uZmlnUmVzb2x2ZU9wdGlvbnMsIElUZXJtaW5hbFByb2ZpbGVQcm92aWRlciwgSVRlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZSwgSVRlcm1pbmFsUHJvZmlsZVNlcnZpY2UsIHR5cGUgSVRlcm1pbmFsQ29uZmlndXJhdGlvbiB9IGZyb20gJy4uLy4uL2NvbnRyaWIvdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsLmpzJztcbmltcG9ydCB7IEVkaXRvclJlc29sdmVyU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2VkaXRvci9icm93c2VyL2VkaXRvclJlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBGSUxFX0VESVRPUl9JTlBVVF9JRCB9IGZyb20gJy4uLy4uL2NvbnRyaWIvZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElFZGl0b3JSZXNvbHZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclJlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlLCBXb3JraW5nQ29weUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFbGV2YXRlZEZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZmlsZXMvY29tbW9uL2VsZXZhdGVkRmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQnJvd3NlckVsZXZhdGVkRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9maWxlcy9icm93c2VyL2VsZXZhdGVkRmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvcldvcmtlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2VkaXRvcldvcmtlci5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBTaWRlQnlTaWRlRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi9jb21tb24vZWRpdG9yL3NpZGVCeVNpZGVFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBJVGV4dEVkaXRvclNlcnZpY2UsIFRleHRFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvdGV4dGZpbGUvY29tbW9uL3RleHRFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElQYW5lQ29tcG9zaXRlUGFydFNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9wYW5lY29tcG9zaXRlL2Jyb3dzZXIvcGFuZWNvbXBvc2l0ZS5qcyc7XG5pbXBvcnQgeyBJUGFuZUNvbXBvc2l0ZVBhcnQgfSBmcm9tICcuLi8uLi9icm93c2VyL3BhcnRzL3BhbmVDb21wb3NpdGVQYXJ0LmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgVGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvdGVzdC9jb21tb24vbW9kZXMvdGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVybWluYWxFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uL2NvbnRyaWIvdGVybWluYWwvYnJvd3Nlci90ZXJtaW5hbEVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IElHcm91cE1vZGVsQ2hhbmdlRXZlbnQgfSBmcm9tICcuLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvckdyb3VwTW9kZWwuanMnO1xuaW1wb3J0IHsgZW52IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcHJvY2Vzcy5qcyc7XG5pbXBvcnQgeyBpc1ZhbGlkQmFzZW5hbWUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9leHRwYXRoLmpzJztcbmltcG9ydCB7IFRlc3RBY2Nlc3NpYmlsaXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvdGVzdC9jb21tb24vdGVzdEFjY2Vzc2liaWxpdHlTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVEZWJvdW5jZVNlcnZpY2UsIExhbmd1YWdlRmVhdHVyZURlYm91bmNlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IExhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXh0RWRpdG9yUGFuZVNlbGVjdGlvbiB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL3RleHRFZGl0b3IuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJRm9sZGVyQmFja3VwSW5mbywgSVdvcmtzcGFjZUJhY2t1cEluZm8gfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9iYWNrdXAvY29tbW9uL2JhY2t1cC5qcyc7XG5pbXBvcnQgeyBUZXN0RWRpdG9yV29ya2VyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci90ZXN0L2NvbW1vbi9zZXJ2aWNlcy90ZXN0RWRpdG9yV29ya2VyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uSG9zdEV4aXRJbmZvLCBJUmVtb3RlQWdlbnRDb25uZWN0aW9uLCBJUmVtb3RlQWdlbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRGV0ZWN0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2xhbmd1YWdlRGV0ZWN0aW9uL2NvbW1vbi9sYW5ndWFnZURldGVjdGlvbldvcmtlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSURpYWdub3N0aWNJbmZvT3B0aW9ucywgSURpYWdub3N0aWNJbmZvIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZGlhZ25vc3RpY3MvY29tbW9uL2RpYWdub3N0aWNzLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvblR5cGUsIElFeHRlbnNpb24sIElFeHRlbnNpb25EZXNjcmlwdGlvbiwgSVJlbGF4ZWRFeHRlbnNpb25NYW5pZmVzdCwgVGFyZ2V0UGxhdGZvcm0gfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElSZW1vdGVBZ2VudEVudmlyb25tZW50IH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vcmVtb3RlL2NvbW1vbi9yZW1vdGVBZ2VudEVudmlyb25tZW50LmpzJztcbmltcG9ydCB7IElMYXlvdXRPZmZzZXRJbmZvIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlLCBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UsIHRvVXNlckRhdGFQcm9maWxlLCBVc2VyRGF0YVByb2ZpbGVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcbmltcG9ydCB7IFVzZXJEYXRhUHJvZmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBFbmFibGVtZW50U3RhdGUsIElFeHRlbnNpb25NYW5hZ2VtZW50U2VydmVyLCBJUmVzb3VyY2VFeHRlbnNpb24sIElTY2FubmVkRXh0ZW5zaW9uLCBJV2ViRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlLCBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsIElXb3JrYmVuY2hFeHRlbnNpb25NYW5hZ2VtZW50U2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgSUxvY2FsRXh0ZW5zaW9uLCBJR2FsbGVyeUV4dGVuc2lvbiwgSW5zdGFsbE9wdGlvbnMsIFVuaW5zdGFsbE9wdGlvbnMsIElFeHRlbnNpb25zQ29udHJvbE1hbmlmZXN0LCBJR2FsbGVyeU1ldGFkYXRhLCBJRXh0ZW5zaW9uTWFuYWdlbWVudFBhcnRpY2lwYW50LCBNZXRhZGF0YSwgSW5zdGFsbEV4dGVuc2lvblJlc3VsdCwgSW5zdGFsbEV4dGVuc2lvbkluZm8sIFVuaW5zdGFsbEV4dGVuc2lvbkluZm8sIEluc3RhbGxFeHRlbnNpb25TdW1tYXJ5IH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uTWFuYWdlbWVudC5qcyc7XG5pbXBvcnQgeyBDb2RpY29uIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY29kaWNvbnMuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUV4dGVuc2lvbnNTY2FubmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3JlbW90ZS9jb21tb24vcmVtb3RlRXh0ZW5zaW9uc1NjYW5uZXIuanMnO1xuaW1wb3J0IHsgSVJlbW90ZVNvY2tldEZhY3RvcnlTZXJ2aWNlLCBSZW1vdGVTb2NrZXRGYWN0b3J5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3JlbW90ZS9jb21tb24vcmVtb3RlU29ja2V0RmFjdG9yeVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRWRpdG9yUGFydHMgfSBmcm9tICcuLi8uLi9icm93c2VyL3BhcnRzL2VkaXRvci9lZGl0b3JQYXJ0cy5qcyc7XG5pbXBvcnQgeyBtYWluV2luZG93IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9icm93c2VyL3dpbmRvdy5qcyc7XG5pbXBvcnQgeyBJTWFya2VyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL21hcmtlcnMvY29tbW9uL21hcmtlcnMuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eVNpZ25hbC9icm93c2VyL2FjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JQYW5lU2VydmljZSB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yUGFuZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRWRpdG9yUGFuZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9lZGl0b3IvYnJvd3Nlci9lZGl0b3JQYW5lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlLCBJQ29udGV4dFZpZXdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlldy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0Vmlld1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRWaWV3U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDdXN0b21FZGl0b3JMYWJlbFNlcnZpY2UsIElDdXN0b21FZGl0b3JMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2N1c3RvbUVkaXRvckxhYmVsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVybWluYWxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdGVybWluYWwvY29tbW9uL3Rlcm1pbmFsTG9nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRWYXJpYWJsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb250cmliL3Rlcm1pbmFsL2NvbW1vbi9lbnZpcm9ubWVudFZhcmlhYmxlLmpzJztcbmltcG9ydCB7IEVudmlyb25tZW50VmFyaWFibGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29udHJpYi90ZXJtaW5hbC9jb21tb24vZW52aXJvbm1lbnRWYXJpYWJsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29udGV4dE1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0TWVudVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL2Jyb3dzZXIvaG92ZXIuanMnO1xuaW1wb3J0IHsgTnVsbEhvdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2hvdmVyL3Rlc3QvYnJvd3Nlci9udWxsSG92ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElBY3Rpb25WaWV3SXRlbVNlcnZpY2UsIE51bGxBY3Rpb25WaWV3SXRlbVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2Jyb3dzZXIvYWN0aW9uVmlld0l0ZW1TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZUZpbGVFZGl0b3JJbnB1dChpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLCByZXNvdXJjZTogVVJJKTogRmlsZUVkaXRvcklucHV0IHtcblx0cmV0dXJuIGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEZpbGVFZGl0b3JJbnB1dCwgcmVzb3VyY2UsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xufVxuXG5SZWdpc3RyeS5hczxJRWRpdG9yRmFjdG9yeVJlZ2lzdHJ5PihFZGl0b3JFeHRlbnNpb25zLkVkaXRvckZhY3RvcnkpLnJlZ2lzdGVyRmlsZUVkaXRvckZhY3Rvcnkoe1xuXG5cdHR5cGVJZDogRklMRV9FRElUT1JfSU5QVVRfSUQsXG5cblx0Y3JlYXRlRmlsZUVkaXRvcjogKHJlc291cmNlLCBwcmVmZXJyZWRSZXNvdXJjZSwgcHJlZmVycmVkTmFtZSwgcHJlZmVycmVkRGVzY3JpcHRpb24sIHByZWZlcnJlZEVuY29kaW5nLCBwcmVmZXJyZWRMYW5ndWFnZUlkLCBwcmVmZXJyZWRDb250ZW50cywgaW5zdGFudGlhdGlvblNlcnZpY2UpOiBJRmlsZUVkaXRvcklucHV0ID0+IHtcblx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRmlsZUVkaXRvcklucHV0LCByZXNvdXJjZSwgcHJlZmVycmVkUmVzb3VyY2UsIHByZWZlcnJlZE5hbWUsIHByZWZlcnJlZERlc2NyaXB0aW9uLCBwcmVmZXJyZWRFbmNvZGluZywgcHJlZmVycmVkTGFuZ3VhZ2VJZCwgcHJlZmVycmVkQ29udGVudHMpO1xuXHR9LFxuXG5cdGlzRmlsZUVkaXRvcjogKG9iaik6IG9iaiBpcyBJRmlsZUVkaXRvcklucHV0ID0+IHtcblx0XHRyZXR1cm4gb2JqIGluc3RhbmNlb2YgRmlsZUVkaXRvcklucHV0O1xuXHR9XG59KTtcblxuZXhwb3J0IGNsYXNzIFRlc3RUZXh0UmVzb3VyY2VFZGl0b3IgZXh0ZW5kcyBUZXh0UmVzb3VyY2VFZGl0b3Ige1xuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBjcmVhdGVFZGl0b3JDb250cm9sKHBhcmVudDogSFRNTEVsZW1lbnQsIGNvbmZpZ3VyYXRpb246IGFueSk6IHZvaWQge1xuXHRcdHRoaXMuZWRpdG9yQ29udHJvbCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdENvZGVFZGl0b3IsIHBhcmVudCwgY29uZmlndXJhdGlvbiwge30pKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVGVzdFRleHRGaWxlRWRpdG9yIGV4dGVuZHMgVGV4dEZpbGVFZGl0b3Ige1xuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBjcmVhdGVFZGl0b3JDb250cm9sKHBhcmVudDogSFRNTEVsZW1lbnQsIGNvbmZpZ3VyYXRpb246IGFueSk6IHZvaWQge1xuXHRcdHRoaXMuZWRpdG9yQ29udHJvbCA9IHRoaXMuX3JlZ2lzdGVyKHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdENvZGVFZGl0b3IsIHBhcmVudCwgY29uZmlndXJhdGlvbiwgeyBjb250cmlidXRpb25zOiBbXSB9KSk7XG5cdH1cblxuXHRzZXRTZWxlY3Rpb24oc2VsZWN0aW9uOiBTZWxlY3Rpb24gfCB1bmRlZmluZWQsIHJlYXNvbjogRWRpdG9yUGFuZVNlbGVjdGlvbkNoYW5nZVJlYXNvbik6IHZvaWQge1xuXHRcdHRoaXMuX29wdGlvbnMgPSBzZWxlY3Rpb24gPyB1cGNhc3Q8SUVkaXRvck9wdGlvbnMsIElUZXh0RWRpdG9yT3B0aW9ucz4oeyBzZWxlY3Rpb24gfSkgOiB1bmRlZmluZWQ7XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZVNlbGVjdGlvbi5maXJlKHsgcmVhc29uIH0pO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0U2VsZWN0aW9uKCk6IElFZGl0b3JQYW5lU2VsZWN0aW9uIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBvcHRpb25zID0gdGhpcy5vcHRpb25zO1xuXHRcdGlmICghb3B0aW9ucykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCB0ZXh0U2VsZWN0aW9uID0gKG9wdGlvbnMgYXMgSVRleHRFZGl0b3JPcHRpb25zKS5zZWxlY3Rpb247XG5cdFx0aWYgKCF0ZXh0U2VsZWN0aW9uKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgVGV4dEVkaXRvclBhbmVTZWxlY3Rpb24obmV3IFNlbGVjdGlvbih0ZXh0U2VsZWN0aW9uLnN0YXJ0TGluZU51bWJlciwgdGV4dFNlbGVjdGlvbi5zdGFydENvbHVtbiwgdGV4dFNlbGVjdGlvbi5lbmRMaW5lTnVtYmVyID8/IHRleHRTZWxlY3Rpb24uc3RhcnRMaW5lTnVtYmVyLCB0ZXh0U2VsZWN0aW9uLmVuZENvbHVtbiA/PyB0ZXh0U2VsZWN0aW9uLnN0YXJ0Q29sdW1uKSk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIGV4dGVuZHMgSUluc3RhbnRpYXRpb25TZXJ2aWNlIHtcblx0c3R1YjxUPihzZXJ2aWNlOiBTZXJ2aWNlSWRlbnRpZmllcjxUPiwgY3RvcjogYW55KTogVDtcbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RXb3JraW5nQ29weVNlcnZpY2UgZXh0ZW5kcyBXb3JraW5nQ29weVNlcnZpY2Uge1xuXHR0ZXN0VW5yZWdpc3RlcldvcmtpbmdDb3B5KHdvcmtpbmdDb3B5OiBJV29ya2luZ0NvcHkpOiB2b2lkIHtcblx0XHRyZXR1cm4gc3VwZXIudW5yZWdpc3RlcldvcmtpbmdDb3B5KHdvcmtpbmdDb3B5KTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UoXG5cdG92ZXJyaWRlcz86IHtcblx0XHRlbnZpcm9ubWVudFNlcnZpY2U/OiAoaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSkgPT4gSUVudmlyb25tZW50U2VydmljZTtcblx0XHRmaWxlU2VydmljZT86IChpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlKSA9PiBJRmlsZVNlcnZpY2U7XG5cdFx0d29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlPzogKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpID0+IElXb3JraW5nQ29weUJhY2t1cFNlcnZpY2U7XG5cdFx0Y29uZmlndXJhdGlvblNlcnZpY2U/OiAoaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSkgPT4gVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlO1xuXHRcdHRleHRGaWxlU2VydmljZT86IChpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlKSA9PiBJVGV4dEZpbGVTZXJ2aWNlO1xuXHRcdHBhdGhTZXJ2aWNlPzogKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpID0+IElQYXRoU2VydmljZTtcblx0XHRlZGl0b3JTZXJ2aWNlPzogKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpID0+IElFZGl0b3JTZXJ2aWNlO1xuXHRcdGNvbnRleHRLZXlTZXJ2aWNlPzogKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpID0+IElDb250ZXh0S2V5U2VydmljZTtcblx0XHR0ZXh0RWRpdG9yU2VydmljZT86IChpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlKSA9PiBJVGV4dEVkaXRvclNlcnZpY2U7XG5cdH0sXG5cdGRpc3Bvc2FibGVzOiBQaWNrPERpc3Bvc2FibGVTdG9yZSwgJ2FkZCc+ID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpXG4pOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2Uge1xuXHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihcblx0XHRbSUxpZmVjeWNsZVNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdExpZmVjeWNsZVNlcnZpY2UoKSldLFxuXHRcdFtJQWN0aW9uVmlld0l0ZW1TZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoTnVsbEFjdGlvblZpZXdJdGVtU2VydmljZSldLFxuXHQpKSk7XG5cblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJUHJvZHVjdFNlcnZpY2UsIFRlc3RQcm9kdWN0U2VydmljZSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRvcldvcmtlclNlcnZpY2UsIG5ldyBUZXN0RWRpdG9yV29ya2VyU2VydmljZSgpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJV29ya2luZ0NvcHlTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RXb3JraW5nQ29weVNlcnZpY2UoKSkpO1xuXHRjb25zdCBlbnZpcm9ubWVudFNlcnZpY2UgPSBvdmVycmlkZXM/LmVudmlyb25tZW50U2VydmljZSA/IG92ZXJyaWRlcy5lbnZpcm9ubWVudFNlcnZpY2UoaW5zdGFudGlhdGlvblNlcnZpY2UpIDogVGVzdEVudmlyb25tZW50U2VydmljZTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRW52aXJvbm1lbnRTZXJ2aWNlLCBlbnZpcm9ubWVudFNlcnZpY2UpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUxvZ1NlcnZpY2UsIG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblx0Y29uc3QgY29udGV4dEtleVNlcnZpY2UgPSBvdmVycmlkZXM/LmNvbnRleHRLZXlTZXJ2aWNlID8gb3ZlcnJpZGVzLmNvbnRleHRLZXlTZXJ2aWNlKGluc3RhbnRpYXRpb25TZXJ2aWNlKSA6IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1vY2tDb250ZXh0S2V5U2VydmljZSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbnRleHRLZXlTZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVByb2dyZXNzU2VydmljZSwgbmV3IFRlc3RQcm9ncmVzc1NlcnZpY2UoKSk7XG5cdGNvbnN0IHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlID0gbmV3IFRlc3RDb250ZXh0U2VydmljZShUZXN0V29ya3NwYWNlKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIHdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlKTtcblx0Y29uc3QgY29uZmlnU2VydmljZSA9IG92ZXJyaWRlcz8uY29uZmlndXJhdGlvblNlcnZpY2UgPyBvdmVycmlkZXMuY29uZmlndXJhdGlvblNlcnZpY2UoaW5zdGFudGlhdGlvblNlcnZpY2UpIDogbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7XG5cdFx0ZmlsZXM6IHtcblx0XHRcdHBhcnRpY2lwYW50czoge1xuXHRcdFx0XHR0aW1lb3V0OiA2MDAwMFxuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb25maWdTZXJ2aWNlKTtcblx0Y29uc3QgdGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UgPSBuZXcgVGVzdFRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKGNvbmZpZ1NlcnZpY2UpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSwgdGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVbnRpdGxlZFRleHRFZGl0b3JTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVW50aXRsZWRUZXh0RWRpdG9yU2VydmljZSkpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU3RvcmFnZVNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdFN0b3JhZ2VTZXJ2aWNlKCkpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJUmVtb3RlQWdlbnRTZXJ2aWNlLCBuZXcgVGVzdFJlbW90ZUFnZW50U2VydmljZSgpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTGFuZ3VhZ2VEZXRlY3Rpb25TZXJ2aWNlLCBuZXcgVGVzdExhbmd1YWdlRGV0ZWN0aW9uU2VydmljZSgpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJUGF0aFNlcnZpY2UsIG92ZXJyaWRlcz8ucGF0aFNlcnZpY2UgPyBvdmVycmlkZXMucGF0aFNlcnZpY2UoaW5zdGFudGlhdGlvblNlcnZpY2UpIDogbmV3IFRlc3RQYXRoU2VydmljZSgpKTtcblx0Y29uc3QgbGF5b3V0U2VydmljZSA9IG5ldyBUZXN0TGF5b3V0U2VydmljZSgpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElXb3JrYmVuY2hMYXlvdXRTZXJ2aWNlLCBsYXlvdXRTZXJ2aWNlKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRGlhbG9nU2VydmljZSwgbmV3IFRlc3REaWFsb2dTZXJ2aWNlKCkpO1xuXHRjb25zdCBhY2Nlc3NpYmlsaXR5U2VydmljZSA9IG5ldyBUZXN0QWNjZXNzaWJpbGl0eVNlcnZpY2UoKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQWNjZXNzaWJpbGl0eVNlcnZpY2UsIGFjY2Vzc2liaWxpdHlTZXJ2aWNlKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UsIHtcblx0XHRwbGF5U2lnbmFsOiBhc3luYyAoKSA9PiB7IH0sXG5cdFx0aXNTb3VuZEVuYWJsZWQoc2lnbmFsOiB1bmtub3duKSB7IHJldHVybiBmYWxzZTsgfSxcblx0fSBhcyBhbnkpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElGaWxlRGlhbG9nU2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdEZpbGVEaWFsb2dTZXJ2aWNlKSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUxhbmd1YWdlU2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKExhbmd1YWdlU2VydmljZSkpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsIG5ldyBMYW5ndWFnZUZlYXR1cmVzU2VydmljZSgpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShMYW5ndWFnZUZlYXR1cmVEZWJvdW5jZVNlcnZpY2UpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJSGlzdG9yeVNlcnZpY2UsIG5ldyBUZXN0SGlzdG9yeVNlcnZpY2UoKSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVRleHRSZXNvdXJjZVByb3BlcnRpZXNTZXJ2aWNlLCBuZXcgVGVzdFRleHRSZXNvdXJjZVByb3BlcnRpZXNTZXJ2aWNlKGNvbmZpZ1NlcnZpY2UpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVW5kb1JlZG9TZXJ2aWNlLCBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShVbmRvUmVkb1NlcnZpY2UpKTtcblx0Y29uc3QgdGhlbWVTZXJ2aWNlID0gbmV3IFRlc3RUaGVtZVNlcnZpY2UoKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVGhlbWVTZXJ2aWNlLCB0aGVtZVNlcnZpY2UpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTW9kZWxTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTW9kZWxTZXJ2aWNlKSkpO1xuXHRjb25zdCBmaWxlU2VydmljZSA9IG92ZXJyaWRlcz8uZmlsZVNlcnZpY2UgPyBvdmVycmlkZXMuZmlsZVNlcnZpY2UoaW5zdGFudGlhdGlvblNlcnZpY2UpIDogZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0RmlsZVNlcnZpY2UoKSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUZpbGVTZXJ2aWNlLCBmaWxlU2VydmljZSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVVyaUlkZW50aXR5U2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBVcmlJZGVudGl0eVNlcnZpY2UoZmlsZVNlcnZpY2UpKSk7XG5cdGNvbnN0IG1hcmtlclNlcnZpY2UgPSBuZXcgVGVzdE1hcmtlclNlcnZpY2UoKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTWFya2VyU2VydmljZSwgbWFya2VyU2VydmljZSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0RmlsZXNDb25maWd1cmF0aW9uU2VydmljZSkpKTtcblx0Y29uc3QgdXNlckRhdGFQcm9maWxlc1NlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKSkpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFVzZXJEYXRhUHJvZmlsZVNlcnZpY2UodXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUpKSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVdvcmtpbmdDb3B5QmFja3VwU2VydmljZSwgb3ZlcnJpZGVzPy53b3JraW5nQ29weUJhY2t1cFNlcnZpY2UgPyBvdmVycmlkZXM/LndvcmtpbmdDb3B5QmFja3VwU2VydmljZShpbnN0YW50aWF0aW9uU2VydmljZSkgOiBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UoKSkpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUZWxlbWV0cnlTZXJ2aWNlLCBOdWxsVGVsZW1ldHJ5U2VydmljZSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSU5vdGlmaWNhdGlvblNlcnZpY2UsIG5ldyBUZXN0Tm90aWZpY2F0aW9uU2VydmljZSgpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVW50aXRsZWRUZXh0RWRpdG9yU2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFVudGl0bGVkVGV4dEVkaXRvclNlcnZpY2UpKSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSU1lbnVTZXJ2aWNlLCBuZXcgVGVzdE1lbnVTZXJ2aWNlKCkpO1xuXHRjb25zdCBrZXliaW5kaW5nU2VydmljZSA9IG5ldyBNb2NrS2V5YmluZGluZ1NlcnZpY2UoKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJS2V5YmluZGluZ1NlcnZpY2UsIGtleWJpbmRpbmdTZXJ2aWNlKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRGVjb3JhdGlvbnNTZXJ2aWNlLCBuZXcgVGVzdERlY29yYXRpb25zU2VydmljZSgpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRXh0ZW5zaW9uU2VydmljZSwgbmV3IFRlc3RFeHRlbnNpb25TZXJ2aWNlKCkpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElXb3JraW5nQ29weUZpbGVTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoV29ya2luZ0NvcHlGaWxlU2VydmljZSkpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVGV4dEZpbGVTZXJ2aWNlLCBvdmVycmlkZXM/LnRleHRGaWxlU2VydmljZSA/IG92ZXJyaWRlcy50ZXh0RmlsZVNlcnZpY2UoaW5zdGFudGlhdGlvblNlcnZpY2UpIDogZGlzcG9zYWJsZXMuYWRkKDxJVGV4dEZpbGVTZXJ2aWNlPmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RUZXh0RmlsZVNlcnZpY2UpKSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUhvc3RTZXJ2aWNlLCA8SUhvc3RTZXJ2aWNlPmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RIb3N0U2VydmljZSkpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUZXh0TW9kZWxTZXJ2aWNlLCA8SVRleHRNb2RlbFNlcnZpY2U+ZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRNb2RlbFJlc29sdmVyU2VydmljZSkpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTG9nZ2VyU2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0TG9nZ2VyU2VydmljZShUZXN0RW52aXJvbm1lbnRTZXJ2aWNlLmxvZ3NIb21lKSkpO1xuXHRjb25zdCBlZGl0b3JHcm91cFNlcnZpY2UgPSBuZXcgVGVzdEVkaXRvckdyb3Vwc1NlcnZpY2UoW25ldyBUZXN0RWRpdG9yR3JvdXBWaWV3KDApXSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRvckdyb3Vwc1NlcnZpY2UsIGVkaXRvckdyb3VwU2VydmljZSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUxhYmVsU2VydmljZSwgPElMYWJlbFNlcnZpY2U+ZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKExhYmVsU2VydmljZSkpKTtcblx0Y29uc3QgZWRpdG9yU2VydmljZSA9IG92ZXJyaWRlcz8uZWRpdG9yU2VydmljZSA/IG92ZXJyaWRlcy5lZGl0b3JTZXJ2aWNlKGluc3RhbnRpYXRpb25TZXJ2aWNlKSA6IGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdEVkaXRvclNlcnZpY2UoZWRpdG9yR3JvdXBTZXJ2aWNlKSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRvclNlcnZpY2UsIGVkaXRvclNlcnZpY2UpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElFZGl0b3JQYW5lU2VydmljZSwgbmV3IEVkaXRvclBhbmVTZXJ2aWNlKCkpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElXb3JraW5nQ29weUVkaXRvclNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShXb3JraW5nQ29weUVkaXRvclNlcnZpY2UpKSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRvclJlc29sdmVyU2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVkaXRvclJlc29sdmVyU2VydmljZSkpKTtcblx0Y29uc3QgdGV4dEVkaXRvclNlcnZpY2UgPSBvdmVycmlkZXM/LnRleHRFZGl0b3JTZXJ2aWNlID8gb3ZlcnJpZGVzLnRleHRFZGl0b3JTZXJ2aWNlKGluc3RhbnRpYXRpb25TZXJ2aWNlKSA6IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RWRpdG9yU2VydmljZSkpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUZXh0RWRpdG9yU2VydmljZSwgdGV4dEVkaXRvclNlcnZpY2UpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb2RlRWRpdG9yU2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBDb2RlRWRpdG9yU2VydmljZShlZGl0b3JTZXJ2aWNlLCB0aGVtZVNlcnZpY2UsIGNvbmZpZ1NlcnZpY2UpKSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0UGFuZUNvbXBvc2l0ZVNlcnZpY2UoKSkpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElMaXN0U2VydmljZSwgbmV3IFRlc3RMaXN0U2VydmljZSgpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29udGV4dFZpZXdTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ29udGV4dFZpZXdTZXJ2aWNlKSkpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb250ZXh0TWVudVNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb250ZXh0TWVudVNlcnZpY2UpKSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVF1aWNrSW5wdXRTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFF1aWNrSW5wdXRTZXJ2aWNlKGNvbmZpZ1NlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLCBrZXliaW5kaW5nU2VydmljZSwgY29udGV4dEtleVNlcnZpY2UsIHRoZW1lU2VydmljZSwgbGF5b3V0U2VydmljZSkpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJV29ya3NwYWNlc1NlcnZpY2UsIG5ldyBUZXN0V29ya3NwYWNlc1NlcnZpY2UoKSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdFdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UoKSkpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElXb3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RXb3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlKGZhbHNlKSkpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUZXJtaW5hbEluc3RhbmNlU2VydmljZSwgbmV3IFRlc3RUZXJtaW5hbEluc3RhbmNlU2VydmljZSgpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVGVybWluYWxFZGl0b3JTZXJ2aWNlLCBuZXcgVGVzdFRlcm1pbmFsRWRpdG9yU2VydmljZSgpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVGVybWluYWxHcm91cFNlcnZpY2UsIG5ldyBUZXN0VGVybWluYWxHcm91cFNlcnZpY2UoKSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVRlcm1pbmFsUHJvZmlsZVNlcnZpY2UsIG5ldyBUZXN0VGVybWluYWxQcm9maWxlU2VydmljZSgpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlLCBuZXcgVGVzdFRlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZSgpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVGVybWluYWxDb25maWd1cmF0aW9uU2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlKSkpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUZXJtaW5hbExvZ1NlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXJtaW5hbExvZ1NlcnZpY2UpKSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVudmlyb25tZW50VmFyaWFibGVTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRW52aXJvbm1lbnRWYXJpYWJsZVNlcnZpY2UpKSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVsZXZhdGVkRmlsZVNlcnZpY2UsIG5ldyBCcm93c2VyRWxldmF0ZWRGaWxlU2VydmljZSgpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJUmVtb3RlU29ja2V0RmFjdG9yeVNlcnZpY2UsIG5ldyBSZW1vdGVTb2NrZXRGYWN0b3J5U2VydmljZSgpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ3VzdG9tRWRpdG9yTGFiZWxTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IEN1c3RvbUVkaXRvckxhYmVsU2VydmljZShjb25maWdTZXJ2aWNlLCB3b3Jrc3BhY2VDb250ZXh0U2VydmljZSkpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJSG92ZXJTZXJ2aWNlLCBOdWxsSG92ZXJTZXJ2aWNlKTtcblxuXHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2U7XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0U2VydmljZUFjY2Vzc29yIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0QElMaWZlY3ljbGVTZXJ2aWNlIHB1YmxpYyBsaWZlY3ljbGVTZXJ2aWNlOiBUZXN0TGlmZWN5Y2xlU2VydmljZSxcblx0XHRASVRleHRGaWxlU2VydmljZSBwdWJsaWMgdGV4dEZpbGVTZXJ2aWNlOiBUZXN0VGV4dEZpbGVTZXJ2aWNlLFxuXHRcdEBJVGV4dEVkaXRvclNlcnZpY2UgcHVibGljIHRleHRFZGl0b3JTZXJ2aWNlOiBJVGV4dEVkaXRvclNlcnZpY2UsXG5cdFx0QElXb3JraW5nQ29weUZpbGVTZXJ2aWNlIHB1YmxpYyB3b3JraW5nQ29weUZpbGVTZXJ2aWNlOiBJV29ya2luZ0NvcHlGaWxlU2VydmljZSxcblx0XHRASUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgcHVibGljIGZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2U6IFRlc3RGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHVibGljIGNvbnRleHRTZXJ2aWNlOiBUZXN0Q29udGV4dFNlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgcHVibGljIG1vZGVsU2VydmljZTogTW9kZWxTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHVibGljIGZpbGVTZXJ2aWNlOiBUZXN0RmlsZVNlcnZpY2UsXG5cdFx0QElGaWxlRGlhbG9nU2VydmljZSBwdWJsaWMgZmlsZURpYWxvZ1NlcnZpY2U6IFRlc3RGaWxlRGlhbG9nU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHVibGljIGRpYWxvZ1NlcnZpY2U6IFRlc3REaWFsb2dTZXJ2aWNlLFxuXHRcdEBJV29ya2luZ0NvcHlTZXJ2aWNlIHB1YmxpYyB3b3JraW5nQ29weVNlcnZpY2U6IFRlc3RXb3JraW5nQ29weVNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHB1YmxpYyBlZGl0b3JTZXJ2aWNlOiBUZXN0RWRpdG9yU2VydmljZSxcblx0XHRASUVkaXRvclBhbmVTZXJ2aWNlIHB1YmxpYyBlZGl0b3JQYW5lU2VydmljZTogSUVkaXRvclBhbmVTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHB1YmxpYyBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElQYXRoU2VydmljZSBwdWJsaWMgcGF0aFNlcnZpY2U6IElQYXRoU2VydmljZSxcblx0XHRASUVkaXRvckdyb3Vwc1NlcnZpY2UgcHVibGljIGVkaXRvckdyb3VwU2VydmljZTogSUVkaXRvckdyb3Vwc1NlcnZpY2UsXG5cdFx0QElFZGl0b3JSZXNvbHZlclNlcnZpY2UgcHVibGljIGVkaXRvclJlc29sdmVyU2VydmljZTogSUVkaXRvclJlc29sdmVyU2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwdWJsaWMgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJVGV4dE1vZGVsU2VydmljZSBwdWJsaWMgdGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRASVVudGl0bGVkVGV4dEVkaXRvclNlcnZpY2UgcHVibGljIHVudGl0bGVkVGV4dEVkaXRvclNlcnZpY2U6IFVudGl0bGVkVGV4dEVkaXRvclNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwdWJsaWMgdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlOiBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UgcHVibGljIHdvcmtpbmdDb3B5QmFja3VwU2VydmljZTogVGVzdFdvcmtpbmdDb3B5QmFja3VwU2VydmljZSxcblx0XHRASUhvc3RTZXJ2aWNlIHB1YmxpYyBob3N0U2VydmljZTogVGVzdEhvc3RTZXJ2aWNlLFxuXHRcdEBJUXVpY2tJbnB1dFNlcnZpY2UgcHVibGljIHF1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0QElMYWJlbFNlcnZpY2UgcHVibGljIGxhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHVibGljIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHB1YmxpYyB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwdWJsaWMgaW5zdGFudGl0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwdWJsaWMgbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElXb3JraW5nQ29weUVkaXRvclNlcnZpY2UgcHVibGljIHdvcmtpbmdDb3B5RWRpdG9yU2VydmljZTogSVdvcmtpbmdDb3B5RWRpdG9yU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHB1YmxpYyBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJRWxldmF0ZWRGaWxlU2VydmljZSBwdWJsaWMgZWxldmF0ZWRGaWxlU2VydmljZTogSUVsZXZhdGVkRmlsZVNlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlIHB1YmxpYyB3b3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlOiBUZXN0V29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZSxcblx0XHRASURlY29yYXRpb25zU2VydmljZSBwdWJsaWMgZGVjb3JhdGlvbnNTZXJ2aWNlOiBJRGVjb3JhdGlvbnNTZXJ2aWNlLFxuXHRcdEBJUHJvZ3Jlc3NTZXJ2aWNlIHB1YmxpYyBwcm9ncmVzc1NlcnZpY2U6IElQcm9ncmVzc1NlcnZpY2UsXG5cdCkgeyB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0VGV4dEZpbGVTZXJ2aWNlIGV4dGVuZHMgQnJvd3NlclRleHRGaWxlU2VydmljZSB7XG5cdHByaXZhdGUgcmVhZFN0cmVhbUVycm9yOiBGaWxlT3BlcmF0aW9uRXJyb3IgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHByaXZhdGUgd3JpdGVFcnJvcjogRmlsZU9wZXJhdGlvbkVycm9yIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRmlsZVNlcnZpY2UgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASVVudGl0bGVkVGV4dEVkaXRvclNlcnZpY2UgdW50aXRsZWRUZXh0RWRpdG9yU2VydmljZTogSVVudGl0bGVkVGV4dEVkaXRvck1vZGVsTWFuYWdlcixcblx0XHRASUxpZmVjeWNsZVNlcnZpY2UgbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJRmlsZURpYWxvZ1NlcnZpY2UgZmlsZURpYWxvZ1NlcnZpY2U6IElGaWxlRGlhbG9nU2VydmljZSxcblx0XHRASVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlIGZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2U6IElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgY29kZUVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSxcblx0XHRASVBhdGhTZXJ2aWNlIHBhdGhTZXJ2aWNlOiBJUGF0aFNlcnZpY2UsXG5cdFx0QElXb3JraW5nQ29weUZpbGVTZXJ2aWNlIHdvcmtpbmdDb3B5RmlsZVNlcnZpY2U6IElXb3JraW5nQ29weUZpbGVTZXJ2aWNlLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHVyaUlkZW50aXR5U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJRWxldmF0ZWRGaWxlU2VydmljZSBlbGV2YXRlZEZpbGVTZXJ2aWNlOiBJRWxldmF0ZWRGaWxlU2VydmljZSxcblx0XHRASURlY29yYXRpb25zU2VydmljZSBkZWNvcmF0aW9uc1NlcnZpY2U6IElEZWNvcmF0aW9uc1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoXG5cdFx0XHRmaWxlU2VydmljZSxcblx0XHRcdHVudGl0bGVkVGV4dEVkaXRvclNlcnZpY2UsXG5cdFx0XHRsaWZlY3ljbGVTZXJ2aWNlLFxuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0XHRtb2RlbFNlcnZpY2UsXG5cdFx0XHRlbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0XHRkaWFsb2dTZXJ2aWNlLFxuXHRcdFx0ZmlsZURpYWxvZ1NlcnZpY2UsXG5cdFx0XHR0ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRcdGZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0XHRjb2RlRWRpdG9yU2VydmljZSxcblx0XHRcdHBhdGhTZXJ2aWNlLFxuXHRcdFx0d29ya2luZ0NvcHlGaWxlU2VydmljZSxcblx0XHRcdHVyaUlkZW50aXR5U2VydmljZSxcblx0XHRcdGxhbmd1YWdlU2VydmljZSxcblx0XHRcdGVsZXZhdGVkRmlsZVNlcnZpY2UsXG5cdFx0XHRsb2dTZXJ2aWNlLFxuXHRcdFx0ZGVjb3JhdGlvbnNTZXJ2aWNlXG5cdFx0KTtcblx0fVxuXG5cdHNldFJlYWRTdHJlYW1FcnJvck9uY2UoZXJyb3I6IEZpbGVPcGVyYXRpb25FcnJvcik6IHZvaWQge1xuXHRcdHRoaXMucmVhZFN0cmVhbUVycm9yID0gZXJyb3I7XG5cdH1cblxuXHRvdmVycmlkZSBhc3luYyByZWFkU3RyZWFtKHJlc291cmNlOiBVUkksIG9wdGlvbnM/OiBJUmVhZFRleHRGaWxlT3B0aW9ucyk6IFByb21pc2U8SVRleHRGaWxlU3RyZWFtQ29udGVudD4ge1xuXHRcdGlmICh0aGlzLnJlYWRTdHJlYW1FcnJvcikge1xuXHRcdFx0Y29uc3QgZXJyb3IgPSB0aGlzLnJlYWRTdHJlYW1FcnJvcjtcblx0XHRcdHRoaXMucmVhZFN0cmVhbUVycm9yID0gdW5kZWZpbmVkO1xuXG5cdFx0XHR0aHJvdyBlcnJvcjtcblx0XHR9XG5cblx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZWFkRmlsZVN0cmVhbShyZXNvdXJjZSwgb3B0aW9ucyk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlc291cmNlOiBjb250ZW50LnJlc291cmNlLFxuXHRcdFx0bmFtZTogY29udGVudC5uYW1lLFxuXHRcdFx0bXRpbWU6IGNvbnRlbnQubXRpbWUsXG5cdFx0XHRjdGltZTogY29udGVudC5jdGltZSxcblx0XHRcdGV0YWc6IGNvbnRlbnQuZXRhZyxcblx0XHRcdGVuY29kaW5nOiAndXRmOCcsXG5cdFx0XHR2YWx1ZTogYXdhaXQgY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnlGcm9tU3RyZWFtKGNvbnRlbnQudmFsdWUpLFxuXHRcdFx0c2l6ZTogMTAsXG5cdFx0XHRyZWFkb25seTogZmFsc2UsXG5cdFx0XHRsb2NrZWQ6IGZhbHNlXG5cdFx0fTtcblx0fVxuXG5cdHNldFdyaXRlRXJyb3JPbmNlKGVycm9yOiBGaWxlT3BlcmF0aW9uRXJyb3IpOiB2b2lkIHtcblx0XHR0aGlzLndyaXRlRXJyb3IgPSBlcnJvcjtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHdyaXRlKHJlc291cmNlOiBVUkksIHZhbHVlOiBzdHJpbmcgfCBJVGV4dFNuYXBzaG90LCBvcHRpb25zPzogSVdyaXRlVGV4dEZpbGVPcHRpb25zKTogUHJvbWlzZTxJRmlsZVN0YXRXaXRoTWV0YWRhdGE+IHtcblx0XHRpZiAodGhpcy53cml0ZUVycm9yKSB7XG5cdFx0XHRjb25zdCBlcnJvciA9IHRoaXMud3JpdGVFcnJvcjtcblx0XHRcdHRoaXMud3JpdGVFcnJvciA9IHVuZGVmaW5lZDtcblxuXHRcdFx0dGhyb3cgZXJyb3I7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHN1cGVyLndyaXRlKHJlc291cmNlLCB2YWx1ZSwgb3B0aW9ucyk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RCcm93c2VyVGV4dEZpbGVTZXJ2aWNlV2l0aEVuY29kaW5nT3ZlcnJpZGVzIGV4dGVuZHMgQnJvd3NlclRleHRGaWxlU2VydmljZSB7XG5cblx0cHJpdmF0ZSBfdGVzdEVuY29kaW5nOiBUZXN0RW5jb2RpbmdPcmFjbGUgfCB1bmRlZmluZWQ7XG5cdG92ZXJyaWRlIGdldCBlbmNvZGluZygpOiBUZXN0RW5jb2RpbmdPcmFjbGUge1xuXHRcdGlmICghdGhpcy5fdGVzdEVuY29kaW5nKSB7XG5cdFx0XHR0aGlzLl90ZXN0RW5jb2RpbmcgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RFbmNvZGluZ09yYWNsZSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl90ZXN0RW5jb2Rpbmc7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RFbmNvZGluZ09yYWNsZSBleHRlbmRzIEVuY29kaW5nT3JhY2xlIHtcblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgZ2V0IGVuY29kaW5nT3ZlcnJpZGVzKCk6IElFbmNvZGluZ092ZXJyaWRlW10ge1xuXHRcdHJldHVybiBbXG5cdFx0XHR7IGV4dGVuc2lvbjogJ3V0ZjE2bGUnLCBlbmNvZGluZzogVVRGMTZsZSB9LFxuXHRcdFx0eyBleHRlbnNpb246ICd1dGYxNmJlJywgZW5jb2Rpbmc6IFVURjE2YmUgfSxcblx0XHRcdHsgZXh0ZW5zaW9uOiAndXRmOGJvbScsIGVuY29kaW5nOiBVVEY4X3dpdGhfYm9tIH1cblx0XHRdO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHNldCBlbmNvZGluZ092ZXJyaWRlcyhvdmVycmlkZXM6IElFbmNvZGluZ092ZXJyaWRlW10pIHsgfVxufVxuXG5jbGFzcyBUZXN0RW52aXJvbm1lbnRTZXJ2aWNlV2l0aEFyZ3MgZXh0ZW5kcyBCcm93c2VyV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHtcblx0YXJncyA9IFtdO1xufVxuXG5leHBvcnQgY29uc3QgVGVzdEVudmlyb25tZW50U2VydmljZSA9IG5ldyBUZXN0RW52aXJvbm1lbnRTZXJ2aWNlV2l0aEFyZ3MoJycsIFVSSS5maWxlKCd0ZXN0cycpLndpdGgoeyBzY2hlbWU6ICd2c2NvZGUtdGVzdHMnIH0pLCBPYmplY3QuY3JlYXRlKG51bGwpLCBUZXN0UHJvZHVjdFNlcnZpY2UpO1xuXG5leHBvcnQgY2xhc3MgVGVzdFByb2dyZXNzU2VydmljZSBpbXBsZW1lbnRzIElQcm9ncmVzc1NlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHdpdGhQcm9ncmVzcyhcblx0XHRvcHRpb25zOiBJUHJvZ3Jlc3NPcHRpb25zIHwgSVByb2dyZXNzRGlhbG9nT3B0aW9ucyB8IElQcm9ncmVzc1dpbmRvd09wdGlvbnMgfCBJUHJvZ3Jlc3NOb3RpZmljYXRpb25PcHRpb25zIHwgSVByb2dyZXNzQ29tcG9zaXRlT3B0aW9ucyxcblx0XHR0YXNrOiAocHJvZ3Jlc3M6IElQcm9ncmVzczxJUHJvZ3Jlc3NTdGVwPikgPT4gUHJvbWlzZTxhbnk+LFxuXHRcdG9uRGlkQ2FuY2VsPzogKChjaG9pY2U/OiBudW1iZXIgfCB1bmRlZmluZWQpID0+IHZvaWQpIHwgdW5kZWZpbmVkXG5cdCk6IFByb21pc2U8YW55PiB7XG5cdFx0cmV0dXJuIHRhc2soUHJvZ3Jlc3MuTm9uZSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3REZWNvcmF0aW9uc1NlcnZpY2UgaW1wbGVtZW50cyBJRGVjb3JhdGlvbnNTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRvbkRpZENoYW5nZURlY29yYXRpb25zOiBFdmVudDxJUmVzb3VyY2VEZWNvcmF0aW9uQ2hhbmdlRXZlbnQ+ID0gRXZlbnQuTm9uZTtcblxuXHRyZWdpc3RlckRlY29yYXRpb25zUHJvdmlkZXIoX3Byb3ZpZGVyOiBJRGVjb3JhdGlvbnNQcm92aWRlcik6IElEaXNwb3NhYmxlIHsgcmV0dXJuIERpc3Bvc2FibGUuTm9uZTsgfVxuXHRnZXREZWNvcmF0aW9uKF91cmk6IFVSSSwgX2luY2x1ZGVDaGlsZHJlbjogYm9vbGVhbiwgX292ZXJ3cml0ZT86IElEZWNvcmF0aW9uRGF0YSk6IElEZWNvcmF0aW9uIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxufVxuXG5leHBvcnQgY2xhc3MgVGVzdE1lbnVTZXJ2aWNlIGltcGxlbWVudHMgSU1lbnVTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRjcmVhdGVNZW51KF9pZDogTWVudUlkLCBfc2NvcGVkS2V5YmluZGluZ1NlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSk6IElNZW51IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0b25EaWRDaGFuZ2U6IEV2ZW50Lk5vbmUsXG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB1bmRlZmluZWQsXG5cdFx0XHRnZXRBY3Rpb25zOiAoKSA9PiBbXVxuXHRcdH07XG5cdH1cblxuXHRnZXRNZW51QWN0aW9ucyhpZDogTWVudUlkLCBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLCBvcHRpb25zPzogSU1lbnVBY3Rpb25PcHRpb25zKTogW3N0cmluZywgQXJyYXk8TWVudUl0ZW1BY3Rpb24gfCBTdWJtZW51SXRlbUFjdGlvbj5dW10ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXG5cdGdldE1lbnVDb250ZXh0cyhpZDogTWVudUlkKTogUmVhZG9ubHlTZXQ8c3RyaW5nPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0cmVzZXRIaWRkZW5TdGF0ZXMoKTogdm9pZCB7XG5cdFx0Ly8gbm90aGluZ1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0RmlsZURpYWxvZ1NlcnZpY2UgaW1wbGVtZW50cyBJRmlsZURpYWxvZ1NlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgY29uZmlybVJlc3VsdCE6IENvbmZpcm1SZXN1bHQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElQYXRoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHBhdGhTZXJ2aWNlOiBJUGF0aFNlcnZpY2Vcblx0KSB7IH1cblx0YXN5bmMgZGVmYXVsdEZpbGVQYXRoKF9zY2hlbWVGaWx0ZXI/OiBzdHJpbmcpOiBQcm9taXNlPFVSST4geyByZXR1cm4gdGhpcy5wYXRoU2VydmljZS51c2VySG9tZSgpOyB9XG5cdGFzeW5jIGRlZmF1bHRGb2xkZXJQYXRoKF9zY2hlbWVGaWx0ZXI/OiBzdHJpbmcpOiBQcm9taXNlPFVSST4geyByZXR1cm4gdGhpcy5wYXRoU2VydmljZS51c2VySG9tZSgpOyB9XG5cdGFzeW5jIGRlZmF1bHRXb3Jrc3BhY2VQYXRoKF9zY2hlbWVGaWx0ZXI/OiBzdHJpbmcpOiBQcm9taXNlPFVSST4geyByZXR1cm4gdGhpcy5wYXRoU2VydmljZS51c2VySG9tZSgpOyB9XG5cdGFzeW5jIHByZWZlcnJlZEhvbWUoX3NjaGVtZUZpbHRlcj86IHN0cmluZyk6IFByb21pc2U8VVJJPiB7IHJldHVybiB0aGlzLnBhdGhTZXJ2aWNlLnVzZXJIb21lKCk7IH1cblx0cGlja0ZpbGVGb2xkZXJBbmRPcGVuKF9vcHRpb25zOiBJUGlja0FuZE9wZW5PcHRpb25zKTogUHJvbWlzZTxhbnk+IHsgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgwKTsgfVxuXHRwaWNrRmlsZUFuZE9wZW4oX29wdGlvbnM6IElQaWNrQW5kT3Blbk9wdGlvbnMpOiBQcm9taXNlPGFueT4geyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKDApOyB9XG5cdHBpY2tGb2xkZXJBbmRPcGVuKF9vcHRpb25zOiBJUGlja0FuZE9wZW5PcHRpb25zKTogUHJvbWlzZTxhbnk+IHsgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgwKTsgfVxuXHRwaWNrV29ya3NwYWNlQW5kT3Blbihfb3B0aW9uczogSVBpY2tBbmRPcGVuT3B0aW9ucyk6IFByb21pc2U8YW55PiB7IHJldHVybiBQcm9taXNlLnJlc29sdmUoMCk7IH1cblxuXHRwcml2YXRlIGZpbGVUb1NhdmUhOiBVUkk7XG5cdHNldFBpY2tGaWxlVG9TYXZlKHBhdGg6IFVSSSk6IHZvaWQgeyB0aGlzLmZpbGVUb1NhdmUgPSBwYXRoOyB9XG5cdHBpY2tGaWxlVG9TYXZlKGRlZmF1bHRVcmk6IFVSSSwgYXZhaWxhYmxlRmlsZVN5c3RlbXM/OiBzdHJpbmdbXSk6IFByb21pc2U8VVJJIHwgdW5kZWZpbmVkPiB7IHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5maWxlVG9TYXZlKTsgfVxuXG5cdHNob3dTYXZlRGlhbG9nKF9vcHRpb25zOiBJU2F2ZURpYWxvZ09wdGlvbnMpOiBQcm9taXNlPFVSSSB8IHVuZGVmaW5lZD4geyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7IH1cblx0c2hvd09wZW5EaWFsb2coX29wdGlvbnM6IElPcGVuRGlhbG9nT3B0aW9ucyk6IFByb21pc2U8VVJJW10gfCB1bmRlZmluZWQ+IHsgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpOyB9XG5cblx0c2V0Q29uZmlybVJlc3VsdChyZXN1bHQ6IENvbmZpcm1SZXN1bHQpOiB2b2lkIHsgdGhpcy5jb25maXJtUmVzdWx0ID0gcmVzdWx0OyB9XG5cdHNob3dTYXZlQ29uZmlybShmaWxlTmFtZXNPclJlc291cmNlczogKHN0cmluZyB8IFVSSSlbXSk6IFByb21pc2U8Q29uZmlybVJlc3VsdD4geyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuY29uZmlybVJlc3VsdCk7IH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RMYXlvdXRTZXJ2aWNlIGltcGxlbWVudHMgSVdvcmtiZW5jaExheW91dFNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdG9wZW5lZERlZmF1bHRFZGl0b3JzID0gZmFsc2U7XG5cblx0bWFpbkNvbnRhaW5lckRpbWVuc2lvbjogSURpbWVuc2lvbiA9IHsgd2lkdGg6IDgwMCwgaGVpZ2h0OiA2MDAgfTtcblx0YWN0aXZlQ29udGFpbmVyRGltZW5zaW9uOiBJRGltZW5zaW9uID0geyB3aWR0aDogODAwLCBoZWlnaHQ6IDYwMCB9O1xuXHRtYWluQ29udGFpbmVyT2Zmc2V0OiBJTGF5b3V0T2Zmc2V0SW5mbyA9IHsgdG9wOiAwLCBxdWlja1BpY2tUb3A6IDAgfTtcblx0YWN0aXZlQ29udGFpbmVyT2Zmc2V0OiBJTGF5b3V0T2Zmc2V0SW5mbyA9IHsgdG9wOiAwLCBxdWlja1BpY2tUb3A6IDAgfTtcblxuXHRtYWluQ29udGFpbmVyOiBIVE1MRWxlbWVudCA9IG1haW5XaW5kb3cuZG9jdW1lbnQuYm9keTtcblx0Y29udGFpbmVycyA9IFttYWluV2luZG93LmRvY3VtZW50LmJvZHldO1xuXHRhY3RpdmVDb250YWluZXI6IEhUTUxFbGVtZW50ID0gbWFpbldpbmRvdy5kb2N1bWVudC5ib2R5O1xuXG5cdG9uRGlkQ2hhbmdlWmVuTW9kZTogRXZlbnQ8Ym9vbGVhbj4gPSBFdmVudC5Ob25lO1xuXHRvbkRpZENoYW5nZU1haW5FZGl0b3JDZW50ZXJlZExheW91dDogRXZlbnQ8Ym9vbGVhbj4gPSBFdmVudC5Ob25lO1xuXHRvbkRpZENoYW5nZVdpbmRvd01heGltaXplZDogRXZlbnQ8eyB3aW5kb3dJZDogbnVtYmVyOyBtYXhpbWl6ZWQ6IGJvb2xlYW4gfT4gPSBFdmVudC5Ob25lO1xuXHRvbkRpZENoYW5nZVBhbmVsUG9zaXRpb246IEV2ZW50PHN0cmluZz4gPSBFdmVudC5Ob25lO1xuXHRvbkRpZENoYW5nZVBhbmVsQWxpZ25tZW50OiBFdmVudDxQYW5lbEFsaWdubWVudD4gPSBFdmVudC5Ob25lO1xuXHRvbkRpZENoYW5nZVBhcnRWaXNpYmlsaXR5OiBFdmVudDx2b2lkPiA9IEV2ZW50Lk5vbmU7XG5cdG9uRGlkTGF5b3V0TWFpbkNvbnRhaW5lciA9IEV2ZW50Lk5vbmU7XG5cdG9uRGlkTGF5b3V0QWN0aXZlQ29udGFpbmVyID0gRXZlbnQuTm9uZTtcblx0b25EaWRMYXlvdXRDb250YWluZXIgPSBFdmVudC5Ob25lO1xuXHRvbkRpZENoYW5nZU5vdGlmaWNhdGlvbnNWaXNpYmlsaXR5ID0gRXZlbnQuTm9uZTtcblx0b25EaWRBZGRDb250YWluZXIgPSBFdmVudC5Ob25lO1xuXHRvbkRpZENoYW5nZUFjdGl2ZUNvbnRhaW5lciA9IEV2ZW50Lk5vbmU7XG5cblx0bGF5b3V0KCk6IHZvaWQgeyB9XG5cdGlzUmVzdG9yZWQoKTogYm9vbGVhbiB7IHJldHVybiB0cnVlOyB9XG5cdHdoZW5SZWFkeTogUHJvbWlzZTx2b2lkPiA9IFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHR3aGVuUmVzdG9yZWQ6IFByb21pc2U8dm9pZD4gPSBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0aGFzRm9jdXMoX3BhcnQ6IFBhcnRzKTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuXHRmb2N1c1BhcnQoX3BhcnQ6IFBhcnRzKTogdm9pZCB7IH1cblx0aGFzTWFpbldpbmRvd0JvcmRlcigpOiBib29sZWFuIHsgcmV0dXJuIGZhbHNlOyB9XG5cdGdldE1haW5XaW5kb3dCb3JkZXJSYWRpdXMoKTogc3RyaW5nIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRpc1Zpc2libGUoX3BhcnQ6IFBhcnRzKTogYm9vbGVhbiB7IHJldHVybiB0cnVlOyB9XG5cdGdldENvbnRhaW5lcigpOiBIVE1MRWxlbWVudCB7IHJldHVybiBtYWluV2luZG93LmRvY3VtZW50LmJvZHk7IH1cblx0d2hlbkNvbnRhaW5lclN0eWxlc0xvYWRlZCgpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRpc1RpdGxlQmFySGlkZGVuKCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cblx0aXNTdGF0dXNCYXJIaWRkZW4oKTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuXHRpc0FjdGl2aXR5QmFySGlkZGVuKCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cblx0c2V0QWN0aXZpdHlCYXJIaWRkZW4oX2hpZGRlbjogYm9vbGVhbik6IHZvaWQgeyB9XG5cdHNldEJhbm5lckhpZGRlbihfaGlkZGVuOiBib29sZWFuKTogdm9pZCB7IH1cblx0aXNTaWRlQmFySGlkZGVuKCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cblx0YXN5bmMgc2V0RWRpdG9ySGlkZGVuKF9oaWRkZW46IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHsgfVxuXHRhc3luYyBzZXRTaWRlQmFySGlkZGVuKF9oaWRkZW46IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHsgfVxuXHRhc3luYyBzZXRBdXhpbGlhcnlCYXJIaWRkZW4oX2hpZGRlbjogYm9vbGVhbik6IFByb21pc2U8dm9pZD4geyB9XG5cdGFzeW5jIHNldFBhcnRIaWRkZW4oX2hpZGRlbjogYm9vbGVhbiwgcGFydDogUGFydHMpOiBQcm9taXNlPHZvaWQ+IHsgfVxuXHRpc1BhbmVsSGlkZGVuKCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cblx0YXN5bmMgc2V0UGFuZWxIaWRkZW4oX2hpZGRlbjogYm9vbGVhbik6IFByb21pc2U8dm9pZD4geyB9XG5cdHRvZ2dsZU1heGltaXplZFBhbmVsKCk6IHZvaWQgeyB9XG5cdGlzUGFuZWxNYXhpbWl6ZWQoKTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuXHRnZXRNZW51YmFyVmlzaWJpbGl0eSgpOiBNZW51QmFyVmlzaWJpbGl0eSB7IHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7IH1cblx0dG9nZ2xlTWVudUJhcigpOiB2b2lkIHsgfVxuXHRnZXRTaWRlQmFyUG9zaXRpb24oKSB7IHJldHVybiAwOyB9XG5cdGdldFBhbmVsUG9zaXRpb24oKSB7IHJldHVybiAwOyB9XG5cdGdldFBhbmVsQWxpZ25tZW50KCk6IFBhbmVsQWxpZ25tZW50IHsgcmV0dXJuICdjZW50ZXInOyB9XG5cdGFzeW5jIHNldFBhbmVsUG9zaXRpb24oX3Bvc2l0aW9uOiBQYXJ0UG9zaXRpb24pOiBQcm9taXNlPHZvaWQ+IHsgfVxuXHRhc3luYyBzZXRQYW5lbEFsaWdubWVudChfYWxpZ25tZW50OiBQYW5lbEFsaWdubWVudCk6IFByb21pc2U8dm9pZD4geyB9XG5cdGFkZENsYXNzKF9jbGF6ejogc3RyaW5nKTogdm9pZCB7IH1cblx0cmVtb3ZlQ2xhc3MoX2NsYXp6OiBzdHJpbmcpOiB2b2lkIHsgfVxuXHRnZXRNYXhpbXVtRWRpdG9yRGltZW5zaW9ucygpOiBJRGltZW5zaW9uIHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfVxuXHR0b2dnbGVaZW5Nb2RlKCk6IHZvaWQgeyB9XG5cdGlzTWFpbkVkaXRvckxheW91dENlbnRlcmVkKCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cblx0Y2VudGVyTWFpbkVkaXRvckxheW91dChfYWN0aXZlOiBib29sZWFuKTogdm9pZCB7IH1cblx0cmVzaXplUGFydChfcGFydDogUGFydHMsIF9zaXplQ2hhbmdlV2lkdGg6IG51bWJlciwgX3NpemVDaGFuZ2VIZWlnaHQ6IG51bWJlcik6IHZvaWQgeyB9XG5cdGdldFNpemUocGFydDogUGFydHMpOiBJVmlld1NpemUgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0c2V0U2l6ZShwYXJ0OiBQYXJ0cywgc2l6ZTogSVZpZXdTaXplKTogdm9pZCB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRyZWdpc3RlclBhcnQocGFydDogUGFydCk6IElEaXNwb3NhYmxlIHsgcmV0dXJuIERpc3Bvc2FibGUuTm9uZTsgfVxuXHRpc1dpbmRvd01heGltaXplZCh0YXJnZXRXaW5kb3c6IFdpbmRvdykgeyByZXR1cm4gZmFsc2U7IH1cblx0dXBkYXRlV2luZG93TWF4aW1pemVkU3RhdGUodGFyZ2V0V2luZG93OiBXaW5kb3csIG1heGltaXplZDogYm9vbGVhbik6IHZvaWQgeyB9XG5cdGdldFZpc2libGVOZWlnaGJvclBhcnQocGFydDogUGFydHMsIGRpcmVjdGlvbjogRGlyZWN0aW9uKTogUGFydHMgfCB1bmRlZmluZWQgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdGZvY3VzKCkgeyB9XG59XG5cbmNvbnN0IGFjdGl2ZVZpZXdsZXQ6IFBhbmVDb21wb3NpdGUgPSB7fSBhcyBhbnk7XG5cbmV4cG9ydCBjbGFzcyBUZXN0UGFuZUNvbXBvc2l0ZVNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSB7XG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdG9uRGlkUGFuZUNvbXBvc2l0ZU9wZW46IEV2ZW50PHsgY29tcG9zaXRlOiBJUGFuZUNvbXBvc2l0ZTsgdmlld0NvbnRhaW5lckxvY2F0aW9uOiBWaWV3Q29udGFpbmVyTG9jYXRpb24gfT47XG5cdG9uRGlkUGFuZUNvbXBvc2l0ZUNsb3NlOiBFdmVudDx7IGNvbXBvc2l0ZTogSVBhbmVDb21wb3NpdGU7IHZpZXdDb250YWluZXJMb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uIH0+O1xuXG5cdHByaXZhdGUgcGFydHMgPSBuZXcgTWFwPFZpZXdDb250YWluZXJMb2NhdGlvbiwgSVBhbmVDb21wb3NpdGVQYXJ0PigpO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnBhcnRzLnNldChWaWV3Q29udGFpbmVyTG9jYXRpb24uUGFuZWwsIG5ldyBUZXN0UGFuZWxQYXJ0KCkpO1xuXHRcdHRoaXMucGFydHMuc2V0KFZpZXdDb250YWluZXJMb2NhdGlvbi5TaWRlYmFyLCBuZXcgVGVzdFNpZGVCYXJQYXJ0KCkpO1xuXG5cdFx0dGhpcy5vbkRpZFBhbmVDb21wb3NpdGVPcGVuID0gRXZlbnQuYW55KC4uLihbVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcl0ubWFwKGxvYyA9PiBFdmVudC5tYXAodGhpcy5wYXJ0cy5nZXQobG9jKSEub25EaWRQYW5lQ29tcG9zaXRlT3BlbiwgY29tcG9zaXRlID0+IHsgcmV0dXJuIHsgY29tcG9zaXRlLCB2aWV3Q29udGFpbmVyTG9jYXRpb246IGxvYyB9OyB9KSkpKTtcblx0XHR0aGlzLm9uRGlkUGFuZUNvbXBvc2l0ZUNsb3NlID0gRXZlbnQuYW55KC4uLihbVmlld0NvbnRhaW5lckxvY2F0aW9uLlBhbmVsLCBWaWV3Q29udGFpbmVyTG9jYXRpb24uU2lkZWJhcl0ubWFwKGxvYyA9PiBFdmVudC5tYXAodGhpcy5wYXJ0cy5nZXQobG9jKSEub25EaWRQYW5lQ29tcG9zaXRlQ2xvc2UsIGNvbXBvc2l0ZSA9PiB7IHJldHVybiB7IGNvbXBvc2l0ZSwgdmlld0NvbnRhaW5lckxvY2F0aW9uOiBsb2MgfTsgfSkpKSk7XG5cdH1cblxuXHRvcGVuUGFuZUNvbXBvc2l0ZShpZDogc3RyaW5nIHwgdW5kZWZpbmVkLCB2aWV3Q29udGFpbmVyTG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbiwgZm9jdXM/OiBib29sZWFuKTogUHJvbWlzZTxJUGFuZUNvbXBvc2l0ZSB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLmdldFBhcnRCeUxvY2F0aW9uKHZpZXdDb250YWluZXJMb2NhdGlvbikub3BlblBhbmVDb21wb3NpdGUoaWQsIGZvY3VzKTtcblx0fVxuXHRnZXRBY3RpdmVQYW5lQ29tcG9zaXRlKHZpZXdDb250YWluZXJMb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uKTogSVBhbmVDb21wb3NpdGUgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLmdldFBhcnRCeUxvY2F0aW9uKHZpZXdDb250YWluZXJMb2NhdGlvbikuZ2V0QWN0aXZlUGFuZUNvbXBvc2l0ZSgpO1xuXHR9XG5cdGdldFBhbmVDb21wb3NpdGUoaWQ6IHN0cmluZywgdmlld0NvbnRhaW5lckxvY2F0aW9uOiBWaWV3Q29udGFpbmVyTG9jYXRpb24pOiBQYW5lQ29tcG9zaXRlRGVzY3JpcHRvciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0UGFydEJ5TG9jYXRpb24odmlld0NvbnRhaW5lckxvY2F0aW9uKS5nZXRQYW5lQ29tcG9zaXRlKGlkKTtcblx0fVxuXHRnZXRQYW5lQ29tcG9zaXRlcyh2aWV3Q29udGFpbmVyTG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbik6IFBhbmVDb21wb3NpdGVEZXNjcmlwdG9yW10ge1xuXHRcdHJldHVybiB0aGlzLmdldFBhcnRCeUxvY2F0aW9uKHZpZXdDb250YWluZXJMb2NhdGlvbikuZ2V0UGFuZUNvbXBvc2l0ZXMoKTtcblx0fVxuXHRnZXRQcm9ncmVzc0luZGljYXRvcihpZDogc3RyaW5nLCB2aWV3Q29udGFpbmVyTG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbik6IElQcm9ncmVzc0luZGljYXRvciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuZ2V0UGFydEJ5TG9jYXRpb24odmlld0NvbnRhaW5lckxvY2F0aW9uKS5nZXRQcm9ncmVzc0luZGljYXRvcihpZCk7XG5cdH1cblx0aGlkZUFjdGl2ZVBhbmVDb21wb3NpdGUodmlld0NvbnRhaW5lckxvY2F0aW9uOiBWaWV3Q29udGFpbmVyTG9jYXRpb24pOiB2b2lkIHtcblx0XHR0aGlzLmdldFBhcnRCeUxvY2F0aW9uKHZpZXdDb250YWluZXJMb2NhdGlvbikuaGlkZUFjdGl2ZVBhbmVDb21wb3NpdGUoKTtcblx0fVxuXHRnZXRMYXN0QWN0aXZlUGFuZUNvbXBvc2l0ZUlkKHZpZXdDb250YWluZXJMb2NhdGlvbjogVmlld0NvbnRhaW5lckxvY2F0aW9uKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRQYXJ0QnlMb2NhdGlvbih2aWV3Q29udGFpbmVyTG9jYXRpb24pLmdldExhc3RBY3RpdmVQYW5lQ29tcG9zaXRlSWQoKTtcblx0fVxuXG5cdGdldFBpbm5lZFBhbmVDb21wb3NpdGVJZHModmlld0NvbnRhaW5lckxvY2F0aW9uOiBWaWV3Q29udGFpbmVyTG9jYXRpb24pOiBzdHJpbmdbXSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0Z2V0VmlzaWJsZVBhbmVDb21wb3NpdGVJZHModmlld0NvbnRhaW5lckxvY2F0aW9uOiBWaWV3Q29udGFpbmVyTG9jYXRpb24pOiBzdHJpbmdbXSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0Z2V0UGFuZUNvbXBvc2l0ZUlkcyh2aWV3Q29udGFpbmVyTG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbik6IHN0cmluZ1tdIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblxuXHRnZXRQYXJ0QnlMb2NhdGlvbih2aWV3Q29udGFpbmVyTG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbik6IElQYW5lQ29tcG9zaXRlUGFydCB7XG5cdFx0cmV0dXJuIGFzc2VydElzRGVmaW5lZCh0aGlzLnBhcnRzLmdldCh2aWV3Q29udGFpbmVyTG9jYXRpb24pKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVGVzdFNpZGVCYXJQYXJ0IGltcGxlbWVudHMgSVBhbmVDb21wb3NpdGVQYXJ0IHtcblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0b25EaWRWaWV3bGV0UmVnaXN0ZXJFbWl0dGVyID0gbmV3IEVtaXR0ZXI8UGFuZUNvbXBvc2l0ZURlc2NyaXB0b3I+KCk7XG5cdG9uRGlkVmlld2xldERlcmVnaXN0ZXJFbWl0dGVyID0gbmV3IEVtaXR0ZXI8UGFuZUNvbXBvc2l0ZURlc2NyaXB0b3I+KCk7XG5cdG9uRGlkVmlld2xldE9wZW5FbWl0dGVyID0gbmV3IEVtaXR0ZXI8SVBhbmVDb21wb3NpdGU+KCk7XG5cdG9uRGlkVmlld2xldENsb3NlRW1pdHRlciA9IG5ldyBFbWl0dGVyPElQYW5lQ29tcG9zaXRlPigpO1xuXG5cdHJlYWRvbmx5IHBhcnRJZCA9IFBhcnRzLlNJREVCQVJfUEFSVDtcblx0ZWxlbWVudDogSFRNTEVsZW1lbnQgPSB1bmRlZmluZWQhO1xuXHRtaW5pbXVtV2lkdGggPSAwO1xuXHRtYXhpbXVtV2lkdGggPSAwO1xuXHRtaW5pbXVtSGVpZ2h0ID0gMDtcblx0bWF4aW11bUhlaWdodCA9IDA7XG5cdG9uRGlkQ2hhbmdlID0gRXZlbnQuTm9uZTtcblx0b25EaWRQYW5lQ29tcG9zaXRlT3BlbiA9IHRoaXMub25EaWRWaWV3bGV0T3BlbkVtaXR0ZXIuZXZlbnQ7XG5cdG9uRGlkUGFuZUNvbXBvc2l0ZUNsb3NlID0gdGhpcy5vbkRpZFZpZXdsZXRDbG9zZUVtaXR0ZXIuZXZlbnQ7XG5cblx0b3BlblBhbmVDb21wb3NpdGUoaWQ6IHN0cmluZywgZm9jdXM/OiBib29sZWFuKTogUHJvbWlzZTxJUGFuZUNvbXBvc2l0ZSB8IHVuZGVmaW5lZD4geyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7IH1cblx0Z2V0UGFuZUNvbXBvc2l0ZXMoKTogUGFuZUNvbXBvc2l0ZURlc2NyaXB0b3JbXSB7IHJldHVybiBbXTsgfVxuXHRnZXRBbGxWaWV3bGV0cygpOiBQYW5lQ29tcG9zaXRlRGVzY3JpcHRvcltdIHsgcmV0dXJuIFtdOyB9XG5cdGdldEFjdGl2ZVBhbmVDb21wb3NpdGUoKTogSVBhbmVDb21wb3NpdGUgeyByZXR1cm4gYWN0aXZlVmlld2xldDsgfVxuXHRnZXREZWZhdWx0Vmlld2xldElkKCk6IHN0cmluZyB7IHJldHVybiAnd29ya2JlbmNoLnZpZXcuZXhwbG9yZXInOyB9XG5cdGdldFBhbmVDb21wb3NpdGUoaWQ6IHN0cmluZyk6IFBhbmVDb21wb3NpdGVEZXNjcmlwdG9yIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRnZXRQcm9ncmVzc0luZGljYXRvcihpZDogc3RyaW5nKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cblx0aGlkZUFjdGl2ZVBhbmVDb21wb3NpdGUoKTogdm9pZCB7IH1cblx0Z2V0TGFzdEFjdGl2ZVBhbmVDb21wb3NpdGVJZCgpOiBzdHJpbmcgeyByZXR1cm4gdW5kZWZpbmVkITsgfVxuXHRkaXNwb3NlKCkgeyB9XG5cdGdldFBpbm5lZFBhbmVDb21wb3NpdGVJZHMoKSB7IHJldHVybiBbXTsgfVxuXHRnZXRWaXNpYmxlUGFuZUNvbXBvc2l0ZUlkcygpIHsgcmV0dXJuIFtdOyB9XG5cdGdldFBhbmVDb21wb3NpdGVJZHMoKSB7IHJldHVybiBbXTsgfVxuXHRsYXlvdXQod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIsIHRvcDogbnVtYmVyLCBsZWZ0OiBudW1iZXIpOiB2b2lkIHsgfVxufVxuXG5leHBvcnQgY2xhc3MgVGVzdFBhbmVsUGFydCBpbXBsZW1lbnRzIElQYW5lQ29tcG9zaXRlUGFydCB7XG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdGVsZW1lbnQ6IEhUTUxFbGVtZW50ID0gdW5kZWZpbmVkITtcblx0bWluaW11bVdpZHRoID0gMDtcblx0bWF4aW11bVdpZHRoID0gMDtcblx0bWluaW11bUhlaWdodCA9IDA7XG5cdG1heGltdW1IZWlnaHQgPSAwO1xuXHRvbkRpZENoYW5nZSA9IEV2ZW50Lk5vbmU7XG5cdG9uRGlkUGFuZUNvbXBvc2l0ZU9wZW4gPSBuZXcgRW1pdHRlcjxJUGFuZUNvbXBvc2l0ZT4oKS5ldmVudDtcblx0b25EaWRQYW5lQ29tcG9zaXRlQ2xvc2UgPSBuZXcgRW1pdHRlcjxJUGFuZUNvbXBvc2l0ZT4oKS5ldmVudDtcblx0cmVhZG9ubHkgcGFydElkID0gUGFydHMuQVVYSUxJQVJZQkFSX1BBUlQ7XG5cblx0YXN5bmMgb3BlblBhbmVDb21wb3NpdGUoaWQ/OiBzdHJpbmcsIGZvY3VzPzogYm9vbGVhbik6IFByb21pc2U8dW5kZWZpbmVkPiB7IHJldHVybiB1bmRlZmluZWQ7IH1cblx0Z2V0UGFuZUNvbXBvc2l0ZShpZDogc3RyaW5nKTogYW55IHsgcmV0dXJuIGFjdGl2ZVZpZXdsZXQ7IH1cblx0Z2V0UGFuZUNvbXBvc2l0ZXMoKSB7IHJldHVybiBbXTsgfVxuXHRnZXRQaW5uZWRQYW5lQ29tcG9zaXRlSWRzKCkgeyByZXR1cm4gW107IH1cblx0Z2V0VmlzaWJsZVBhbmVDb21wb3NpdGVJZHMoKSB7IHJldHVybiBbXTsgfVxuXHRnZXRQYW5lQ29tcG9zaXRlSWRzKCkgeyByZXR1cm4gW107IH1cblx0Z2V0QWN0aXZlUGFuZUNvbXBvc2l0ZSgpOiBJUGFuZUNvbXBvc2l0ZSB7IHJldHVybiBhY3RpdmVWaWV3bGV0OyB9XG5cdHNldFBhbmVsRW5hYmxlbWVudChpZDogc3RyaW5nLCBlbmFibGVkOiBib29sZWFuKTogdm9pZCB7IH1cblx0ZGlzcG9zZSgpIHsgfVxuXHRnZXRQcm9ncmVzc0luZGljYXRvcihpZDogc3RyaW5nKSB7IHJldHVybiBudWxsITsgfVxuXHRoaWRlQWN0aXZlUGFuZUNvbXBvc2l0ZSgpOiB2b2lkIHsgfVxuXHRnZXRMYXN0QWN0aXZlUGFuZUNvbXBvc2l0ZUlkKCk6IHN0cmluZyB7IHJldHVybiB1bmRlZmluZWQhOyB9XG5cdGxheW91dCh3aWR0aDogbnVtYmVyLCBoZWlnaHQ6IG51bWJlciwgdG9wOiBudW1iZXIsIGxlZnQ6IG51bWJlcik6IHZvaWQgeyB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0Vmlld3NTZXJ2aWNlIGltcGxlbWVudHMgSVZpZXdzU2VydmljZSB7XG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cblx0b25EaWRDaGFuZ2VWaWV3Q29udGFpbmVyVmlzaWJpbGl0eSA9IG5ldyBFbWl0dGVyPHsgaWQ6IHN0cmluZzsgdmlzaWJsZTogYm9vbGVhbjsgbG9jYXRpb246IFZpZXdDb250YWluZXJMb2NhdGlvbiB9PigpLmV2ZW50O1xuXHRpc1ZpZXdDb250YWluZXJWaXNpYmxlKGlkOiBzdHJpbmcpOiBib29sZWFuIHsgcmV0dXJuIHRydWU7IH1cblx0aXNWaWV3Q29udGFpbmVyQWN0aXZlKGlkOiBzdHJpbmcpOiBib29sZWFuIHsgcmV0dXJuIHRydWU7IH1cblx0Z2V0VmlzaWJsZVZpZXdDb250YWluZXIoKTogVmlld0NvbnRhaW5lciB8IG51bGwgeyByZXR1cm4gbnVsbDsgfVxuXHRvcGVuVmlld0NvbnRhaW5lcihpZDogc3RyaW5nLCBmb2N1cz86IGJvb2xlYW4pOiBQcm9taXNlPElQYW5lQ29tcG9zaXRlIHwgbnVsbD4geyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwpOyB9XG5cdGNsb3NlVmlld0NvbnRhaW5lcihpZDogc3RyaW5nKTogdm9pZCB7IH1cblxuXHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5RW1pdHRlciA9IG5ldyBFbWl0dGVyPHsgaWQ6IHN0cmluZzsgdmlzaWJsZTogYm9vbGVhbiB9PigpO1xuXHRvbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5ID0gdGhpcy5vbkRpZENoYW5nZVZpZXdWaXNpYmlsaXR5RW1pdHRlci5ldmVudDtcblx0b25EaWRDaGFuZ2VGb2N1c2VkVmlld0VtaXR0ZXIgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRvbkRpZENoYW5nZUZvY3VzZWRWaWV3ID0gdGhpcy5vbkRpZENoYW5nZUZvY3VzZWRWaWV3RW1pdHRlci5ldmVudDtcblx0aXNWaWV3VmlzaWJsZShpZDogc3RyaW5nKTogYm9vbGVhbiB7IHJldHVybiB0cnVlOyB9XG5cdGdldEFjdGl2ZVZpZXdXaXRoSWQ8VCBleHRlbmRzIElWaWV3PihpZDogc3RyaW5nKTogVCB8IG51bGwgeyByZXR1cm4gbnVsbDsgfVxuXHRnZXRWaWV3V2l0aElkPFQgZXh0ZW5kcyBJVmlldz4oaWQ6IHN0cmluZyk6IFQgfCBudWxsIHsgcmV0dXJuIG51bGw7IH1cblx0b3BlblZpZXc8VCBleHRlbmRzIElWaWV3PihpZDogc3RyaW5nLCBmb2N1cz86IGJvb2xlYW4gfCB1bmRlZmluZWQpOiBQcm9taXNlPFQgfCBudWxsPiB7IHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCk7IH1cblx0Y2xvc2VWaWV3KGlkOiBzdHJpbmcpOiB2b2lkIHsgfVxuXHRnZXRWaWV3UHJvZ3Jlc3NJbmRpY2F0b3IoaWQ6IHN0cmluZykgeyByZXR1cm4gbnVsbCE7IH1cblx0Z2V0QWN0aXZlVmlld1BhbmVDb250YWluZXJXaXRoSWQoaWQ6IHN0cmluZykgeyByZXR1cm4gbnVsbDsgfVxuXHRnZXRGb2N1c2VkVmlld05hbWUoKTogc3RyaW5nIHsgcmV0dXJuICcnOyB9XG5cdGdldEZvY3VzZWRWaWV3KCk6IElWaWV3RGVzY3JpcHRvciB8IG51bGwgeyByZXR1cm4gbnVsbDsgfVxufVxuXG5leHBvcnQgY2xhc3MgVGVzdEVkaXRvckdyb3Vwc1NlcnZpY2UgaW1wbGVtZW50cyBJRWRpdG9yR3JvdXBzU2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IocHVibGljIGdyb3VwczogVGVzdEVkaXRvckdyb3VwVmlld1tdID0gW10pIHsgfVxuXG5cdHJlYWRvbmx5IHBhcnRzOiByZWFkb25seSBJRWRpdG9yUGFydFtdID0gW3RoaXNdO1xuXG5cdHdpbmRvd0lkID0gbWFpbldpbmRvdy52c2NvZGVXaW5kb3dJZDtcblxuXHRvbkRpZENyZWF0ZUF1eGlsaWFyeUVkaXRvclBhcnQ6IEV2ZW50PElBdXhpbGlhcnlFZGl0b3JQYXJ0PiA9IEV2ZW50Lk5vbmU7XG5cdG9uRGlkQ2hhbmdlQWN0aXZlR3JvdXA6IEV2ZW50PElFZGl0b3JHcm91cD4gPSBFdmVudC5Ob25lO1xuXHRvbkRpZEFjdGl2YXRlR3JvdXA6IEV2ZW50PElFZGl0b3JHcm91cD4gPSBFdmVudC5Ob25lO1xuXHRvbkRpZEFkZEdyb3VwOiBFdmVudDxJRWRpdG9yR3JvdXA+ID0gRXZlbnQuTm9uZTtcblx0b25EaWRSZW1vdmVHcm91cDogRXZlbnQ8SUVkaXRvckdyb3VwPiA9IEV2ZW50Lk5vbmU7XG5cdG9uRGlkTW92ZUdyb3VwOiBFdmVudDxJRWRpdG9yR3JvdXA+ID0gRXZlbnQuTm9uZTtcblx0b25EaWRDaGFuZ2VHcm91cEluZGV4OiBFdmVudDxJRWRpdG9yR3JvdXA+ID0gRXZlbnQuTm9uZTtcblx0b25EaWRDaGFuZ2VHcm91cExhYmVsOiBFdmVudDxJRWRpdG9yR3JvdXA+ID0gRXZlbnQuTm9uZTtcblx0b25EaWRDaGFuZ2VHcm91cExvY2tlZDogRXZlbnQ8SUVkaXRvckdyb3VwPiA9IEV2ZW50Lk5vbmU7XG5cdG9uRGlkQ2hhbmdlR3JvdXBNYXhpbWl6ZWQ6IEV2ZW50PGJvb2xlYW4+ID0gRXZlbnQuTm9uZTtcblx0b25EaWRMYXlvdXQ6IEV2ZW50PElEaW1lbnNpb24+ID0gRXZlbnQuTm9uZTtcblx0b25EaWRDaGFuZ2VFZGl0b3JQYXJ0T3B0aW9ucyA9IEV2ZW50Lk5vbmU7XG5cdG9uRGlkU2Nyb2xsID0gRXZlbnQuTm9uZTtcblx0b25XaWxsRGlzcG9zZSA9IEV2ZW50Lk5vbmU7XG5cblx0b3JpZW50YXRpb24gPSBHcm91cE9yaWVudGF0aW9uLkhPUklaT05UQUw7XG5cdGlzUmVhZHkgPSB0cnVlO1xuXHR3aGVuUmVhZHk6IFByb21pc2U8dm9pZD4gPSBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0d2hlblJlc3RvcmVkOiBQcm9taXNlPHZvaWQ+ID0gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdGhhc1Jlc3RvcmFibGVTdGF0ZSA9IGZhbHNlO1xuXG5cdGNvbnRlbnREaW1lbnNpb24gPSB7IHdpZHRoOiA4MDAsIGhlaWdodDogNjAwIH07XG5cblx0Z2V0IGFjdGl2ZUdyb3VwKCk6IElFZGl0b3JHcm91cCB7IHJldHVybiB0aGlzLmdyb3Vwc1swXTsgfVxuXHRnZXQgc2lkZUdyb3VwKCk6IElFZGl0b3JHcm91cCB7IHJldHVybiB0aGlzLmdyb3Vwc1swXTsgfVxuXHRnZXQgY291bnQoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMuZ3JvdXBzLmxlbmd0aDsgfVxuXG5cdGdldFBhcnQoZ3JvdXA6IG51bWJlciB8IElFZGl0b3JHcm91cCk6IElFZGl0b3JQYXJ0IHsgcmV0dXJuIHRoaXM7IH1cblx0c2F2ZVdvcmtpbmdTZXQobmFtZTogc3RyaW5nKTogSUVkaXRvcldvcmtpbmdTZXQgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0Z2V0V29ya2luZ1NldHMoKTogSUVkaXRvcldvcmtpbmdTZXRbXSB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRhcHBseVdvcmtpbmdTZXQod29ya2luZ1NldDogSUVkaXRvcldvcmtpbmdTZXQgfCAnZW1wdHknLCBvcHRpb25zPzogSUVkaXRvcldvcmtpbmdTZXRPcHRpb25zKTogUHJvbWlzZTxib29sZWFuPiB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRkZWxldGVXb3JraW5nU2V0KHdvcmtpbmdTZXQ6IElFZGl0b3JXb3JraW5nU2V0KTogUHJvbWlzZTxib29sZWFuPiB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRnZXRHcm91cHMoX29yZGVyPzogR3JvdXBzT3JkZXIpOiByZWFkb25seSBJRWRpdG9yR3JvdXBbXSB7IHJldHVybiB0aGlzLmdyb3VwczsgfVxuXHRnZXRHcm91cChpZGVudGlmaWVyOiBudW1iZXIpOiBJRWRpdG9yR3JvdXAgfCB1bmRlZmluZWQgeyByZXR1cm4gdGhpcy5ncm91cHMuZmluZChncm91cCA9PiBncm91cC5pZCA9PT0gaWRlbnRpZmllcik7IH1cblx0Z2V0TGFiZWwoX2lkZW50aWZpZXI6IG51bWJlcik6IHN0cmluZyB7IHJldHVybiAnR3JvdXAgMSc7IH1cblx0ZmluZEdyb3VwKF9zY29wZTogSUZpbmRHcm91cFNjb3BlLCBfc291cmNlPzogbnVtYmVyIHwgSUVkaXRvckdyb3VwLCBfd3JhcD86IGJvb2xlYW4pOiBJRWRpdG9yR3JvdXAgeyB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpOyB9XG5cdGFjdGl2YXRlR3JvdXAoX2dyb3VwOiBudW1iZXIgfCBJRWRpdG9yR3JvdXApOiBJRWRpdG9yR3JvdXAgeyB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpOyB9XG5cdHJlc3RvcmVHcm91cChfZ3JvdXA6IG51bWJlciB8IElFZGl0b3JHcm91cCk6IElFZGl0b3JHcm91cCB7IHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7IH1cblx0Z2V0U2l6ZShfZ3JvdXA6IG51bWJlciB8IElFZGl0b3JHcm91cCk6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSB7IHJldHVybiB7IHdpZHRoOiAxMDAsIGhlaWdodDogMTAwIH07IH1cblx0c2V0U2l6ZShfZ3JvdXA6IG51bWJlciB8IElFZGl0b3JHcm91cCwgX3NpemU6IHsgd2lkdGg6IG51bWJlcjsgaGVpZ2h0OiBudW1iZXIgfSk6IHZvaWQgeyB9XG5cdGFycmFuZ2VHcm91cHMoX2FycmFuZ2VtZW50OiBHcm91cHNBcnJhbmdlbWVudCk6IHZvaWQgeyB9XG5cdHRvZ2dsZU1heGltaXplR3JvdXAoKTogdm9pZCB7IH1cblx0aGFzTWF4aW1pemVkR3JvdXAoKTogYm9vbGVhbiB7IHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7IH1cblx0dG9nZ2xlRXhwYW5kR3JvdXAoKTogdm9pZCB7IH1cblx0YXBwbHlMYXlvdXQoX2xheW91dDogRWRpdG9yR3JvdXBMYXlvdXQpOiB2b2lkIHsgfVxuXHRnZXRMYXlvdXQoKTogRWRpdG9yR3JvdXBMYXlvdXQgeyB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpOyB9XG5cdHNldEdyb3VwT3JpZW50YXRpb24oX29yaWVudGF0aW9uOiBHcm91cE9yaWVudGF0aW9uKTogdm9pZCB7IH1cblx0YWRkR3JvdXAoX2xvY2F0aW9uOiBudW1iZXIgfCBJRWRpdG9yR3JvdXAsIF9kaXJlY3Rpb246IEdyb3VwRGlyZWN0aW9uKTogSUVkaXRvckdyb3VwIHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfVxuXHRyZW1vdmVHcm91cChfZ3JvdXA6IG51bWJlciB8IElFZGl0b3JHcm91cCk6IHZvaWQgeyB9XG5cdG1vdmVHcm91cChfZ3JvdXA6IG51bWJlciB8IElFZGl0b3JHcm91cCwgX2xvY2F0aW9uOiBudW1iZXIgfCBJRWRpdG9yR3JvdXAsIF9kaXJlY3Rpb246IEdyb3VwRGlyZWN0aW9uKTogSUVkaXRvckdyb3VwIHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfVxuXHRtZXJnZUdyb3VwKF9ncm91cDogbnVtYmVyIHwgSUVkaXRvckdyb3VwLCBfdGFyZ2V0OiBudW1iZXIgfCBJRWRpdG9yR3JvdXAsIF9vcHRpb25zPzogSU1lcmdlR3JvdXBPcHRpb25zKTogYm9vbGVhbiB7IHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7IH1cblx0bWVyZ2VBbGxHcm91cHMoX2dyb3VwOiBudW1iZXIgfCBJRWRpdG9yR3JvdXAsIF9vcHRpb25zPzogSU1lcmdlR3JvdXBPcHRpb25zKTogYm9vbGVhbiB7IHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7IH1cblx0Y29weUdyb3VwKF9ncm91cDogbnVtYmVyIHwgSUVkaXRvckdyb3VwLCBfbG9jYXRpb246IG51bWJlciB8IElFZGl0b3JHcm91cCwgX2RpcmVjdGlvbjogR3JvdXBEaXJlY3Rpb24pOiBJRWRpdG9yR3JvdXAgeyB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpOyB9XG5cdGNlbnRlckxheW91dChhY3RpdmU6IGJvb2xlYW4pOiB2b2lkIHsgfVxuXHRpc0xheW91dENlbnRlcmVkKCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cblx0Y3JlYXRlRWRpdG9yRHJvcFRhcmdldChjb250YWluZXI6IEhUTUxFbGVtZW50LCBkZWxlZ2F0ZTogSUVkaXRvckRyb3BUYXJnZXREZWxlZ2F0ZSk6IElEaXNwb3NhYmxlIHsgcmV0dXJuIERpc3Bvc2FibGUuTm9uZTsgfVxuXHRyZWdpc3RlckNvbnRleHRLZXlQcm92aWRlcjxUIGV4dGVuZHMgQ29udGV4dEtleVZhbHVlPihfcHJvdmlkZXI6IElFZGl0b3JHcm91cENvbnRleHRLZXlQcm92aWRlcjxUPik6IElEaXNwb3NhYmxlIHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfVxuXHRnZXRTY29wZWRJbnN0YW50aWF0aW9uU2VydmljZShwYXJ0OiBJRWRpdG9yUGFydCk6IElJbnN0YW50aWF0aW9uU2VydmljZSB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXG5cdHBhcnRPcHRpb25zITogSUVkaXRvclBhcnRPcHRpb25zO1xuXHRlbmZvcmNlUGFydE9wdGlvbnMob3B0aW9uczogSUVkaXRvclBhcnRPcHRpb25zKTogSURpc3Bvc2FibGUgeyByZXR1cm4gRGlzcG9zYWJsZS5Ob25lOyB9XG5cblx0cmVhZG9ubHkgbWFpblBhcnQgPSB0aGlzO1xuXHRyZWdpc3RlckVkaXRvclBhcnQocGFydDogYW55KTogSURpc3Bvc2FibGUgeyByZXR1cm4gRGlzcG9zYWJsZS5Ob25lOyB9XG5cdGNyZWF0ZUF1eGlsaWFyeUVkaXRvclBhcnQoKTogUHJvbWlzZTxJQXV4aWxpYXJ5RWRpdG9yUGFydD4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RFZGl0b3JHcm91cFZpZXcgaW1wbGVtZW50cyBJRWRpdG9yR3JvdXBWaWV3IHtcblxuXHRjb25zdHJ1Y3RvcihwdWJsaWMgaWQ6IG51bWJlcikgeyB9XG5cblx0d2luZG93SWQgPSBtYWluV2luZG93LnZzY29kZVdpbmRvd0lkO1xuXHRncm91cHNWaWV3OiBJRWRpdG9yR3JvdXBzVmlldyA9IHVuZGVmaW5lZCE7XG5cdGFjdGl2ZUVkaXRvclBhbmUhOiBJVmlzaWJsZUVkaXRvclBhbmU7XG5cdGFjdGl2ZUVkaXRvciE6IEVkaXRvcklucHV0O1xuXHRzZWxlY3RlZEVkaXRvcnM6IEVkaXRvcklucHV0W10gPSBbXTtcblx0cHJldmlld0VkaXRvciE6IEVkaXRvcklucHV0O1xuXHRjb3VudCE6IG51bWJlcjtcblx0c3RpY2t5Q291bnQhOiBudW1iZXI7XG5cdGRpc3Bvc2VkITogYm9vbGVhbjtcblx0ZWRpdG9yczogcmVhZG9ubHkgRWRpdG9ySW5wdXRbXSA9IFtdO1xuXHRsYWJlbCE6IHN0cmluZztcblx0aXNMb2NrZWQhOiBib29sZWFuO1xuXHRhcmlhTGFiZWwhOiBzdHJpbmc7XG5cdGluZGV4ITogbnVtYmVyO1xuXHR3aGVuUmVzdG9yZWQ6IFByb21pc2U8dm9pZD4gPSBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTtcblx0ZWxlbWVudCE6IEhUTUxFbGVtZW50O1xuXHRtaW5pbXVtV2lkdGghOiBudW1iZXI7XG5cdG1heGltdW1XaWR0aCE6IG51bWJlcjtcblx0bWluaW11bUhlaWdodCE6IG51bWJlcjtcblx0bWF4aW11bUhlaWdodCE6IG51bWJlcjtcblxuXHR0aXRsZUhlaWdodCE6IElFZGl0b3JHcm91cFRpdGxlSGVpZ2h0O1xuXG5cdGlzRW1wdHkgPSB0cnVlO1xuXG5cdG9uV2lsbERpc3Bvc2U6IEV2ZW50PHZvaWQ+ID0gRXZlbnQuTm9uZTtcblx0b25EaWRNb2RlbENoYW5nZTogRXZlbnQ8SUdyb3VwTW9kZWxDaGFuZ2VFdmVudD4gPSBFdmVudC5Ob25lO1xuXHRvbldpbGxDbG9zZUVkaXRvcjogRXZlbnQ8SUVkaXRvckNsb3NlRXZlbnQ+ID0gRXZlbnQuTm9uZTtcblx0b25EaWRDbG9zZUVkaXRvcjogRXZlbnQ8SUVkaXRvckNsb3NlRXZlbnQ+ID0gRXZlbnQuTm9uZTtcblx0b25EaWRPcGVuRWRpdG9yRmFpbDogRXZlbnQ8RWRpdG9ySW5wdXQ+ID0gRXZlbnQuTm9uZTtcblx0b25EaWRGb2N1czogRXZlbnQ8dm9pZD4gPSBFdmVudC5Ob25lO1xuXHRvbkRpZENoYW5nZTogRXZlbnQ8eyB3aWR0aDogbnVtYmVyOyBoZWlnaHQ6IG51bWJlciB9PiA9IEV2ZW50Lk5vbmU7XG5cdG9uV2lsbE1vdmVFZGl0b3I6IEV2ZW50PElFZGl0b3JXaWxsTW92ZUV2ZW50PiA9IEV2ZW50Lk5vbmU7XG5cdG9uV2lsbE9wZW5FZGl0b3I6IEV2ZW50PElFZGl0b3JXaWxsT3BlbkV2ZW50PiA9IEV2ZW50Lk5vbmU7XG5cdG9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlOiBFdmVudDxJQWN0aXZlRWRpdG9yQ2hhbmdlRXZlbnQ+ID0gRXZlbnQuTm9uZTtcblxuXHRnZXRFZGl0b3JzKF9vcmRlcj86IEVkaXRvcnNPcmRlcik6IHJlYWRvbmx5IEVkaXRvcklucHV0W10geyByZXR1cm4gW107IH1cblx0ZmluZEVkaXRvcnMoX3Jlc291cmNlOiBVUkkpOiByZWFkb25seSBFZGl0b3JJbnB1dFtdIHsgcmV0dXJuIFtdOyB9XG5cdGdldEVkaXRvckJ5SW5kZXgoX2luZGV4OiBudW1iZXIpOiBFZGl0b3JJbnB1dCB7IHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7IH1cblx0Z2V0SW5kZXhPZkVkaXRvcihfZWRpdG9yOiBFZGl0b3JJbnB1dCk6IG51bWJlciB7IHJldHVybiAtMTsgfVxuXHRpc0ZpcnN0KGVkaXRvcjogRWRpdG9ySW5wdXQpOiBib29sZWFuIHsgcmV0dXJuIGZhbHNlOyB9XG5cdGlzTGFzdChlZGl0b3I6IEVkaXRvcklucHV0KTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuXHRvcGVuRWRpdG9yKF9lZGl0b3I6IEVkaXRvcklucHV0LCBfb3B0aW9ucz86IElFZGl0b3JPcHRpb25zKTogUHJvbWlzZTxJRWRpdG9yUGFuZT4geyB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpOyB9XG5cdG9wZW5FZGl0b3JzKF9lZGl0b3JzOiBFZGl0b3JJbnB1dFdpdGhPcHRpb25zW10pOiBQcm9taXNlPElFZGl0b3JQYW5lPiB7IHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7IH1cblx0aXNQaW5uZWQoX2VkaXRvcjogRWRpdG9ySW5wdXQpOiBib29sZWFuIHsgcmV0dXJuIGZhbHNlOyB9XG5cdGlzU3RpY2t5KF9lZGl0b3I6IEVkaXRvcklucHV0KTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuXHRpc1RyYW5zaWVudChfZWRpdG9yOiBFZGl0b3JJbnB1dCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cblx0aXNBY3RpdmUoX2VkaXRvcjogRWRpdG9ySW5wdXQgfCBJVW50eXBlZEVkaXRvcklucHV0KTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuXHRzZXRTZWxlY3Rpb24oX2FjdGl2ZVNlbGVjdGVkRWRpdG9yOiBFZGl0b3JJbnB1dCwgX2luYWN0aXZlU2VsZWN0ZWRFZGl0b3JzOiBFZGl0b3JJbnB1dFtdKTogUHJvbWlzZTx2b2lkPiB7IHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7IH1cblx0aXNTZWxlY3RlZChfZWRpdG9yOiBFZGl0b3JJbnB1dCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cblx0Y29udGFpbnMoY2FuZGlkYXRlOiBFZGl0b3JJbnB1dCB8IElVbnR5cGVkRWRpdG9ySW5wdXQpOiBib29sZWFuIHsgcmV0dXJuIGZhbHNlOyB9XG5cdG1vdmVFZGl0b3IoX2VkaXRvcjogRWRpdG9ySW5wdXQsIF90YXJnZXQ6IElFZGl0b3JHcm91cCwgX29wdGlvbnM/OiBJRWRpdG9yT3B0aW9ucyk6IGJvb2xlYW4geyByZXR1cm4gdHJ1ZTsgfVxuXHRtb3ZlRWRpdG9ycyhfZWRpdG9yczogRWRpdG9ySW5wdXRXaXRoT3B0aW9uc1tdLCBfdGFyZ2V0OiBJRWRpdG9yR3JvdXApOiBib29sZWFuIHsgcmV0dXJuIHRydWU7IH1cblx0Y29weUVkaXRvcihfZWRpdG9yOiBFZGl0b3JJbnB1dCwgX3RhcmdldDogSUVkaXRvckdyb3VwLCBfb3B0aW9ucz86IElFZGl0b3JPcHRpb25zKTogdm9pZCB7IH1cblx0Y29weUVkaXRvcnMoX2VkaXRvcnM6IEVkaXRvcklucHV0V2l0aE9wdGlvbnNbXSwgX3RhcmdldDogSUVkaXRvckdyb3VwKTogdm9pZCB7IH1cblx0YXN5bmMgY2xvc2VFZGl0b3IoX2VkaXRvcj86IEVkaXRvcklucHV0LCBvcHRpb25zPzogSUNsb3NlRWRpdG9yT3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4geyByZXR1cm4gdHJ1ZTsgfVxuXHRhc3luYyBjbG9zZUVkaXRvcnMoX2VkaXRvcnM6IEVkaXRvcklucHV0W10gfCBJQ2xvc2VFZGl0b3JzRmlsdGVyLCBvcHRpb25zPzogSUNsb3NlRWRpdG9yT3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4geyByZXR1cm4gdHJ1ZTsgfVxuXHRhc3luYyBjbG9zZUFsbEVkaXRvcnMob3B0aW9ucz86IElDbG9zZUFsbEVkaXRvcnNPcHRpb25zKTogUHJvbWlzZTxib29sZWFuPiB7IHJldHVybiB0cnVlOyB9XG5cdGFzeW5jIHJlcGxhY2VFZGl0b3JzKF9lZGl0b3JzOiBJRWRpdG9yUmVwbGFjZW1lbnRbXSk6IFByb21pc2U8dm9pZD4geyB9XG5cdHBpbkVkaXRvcihfZWRpdG9yPzogRWRpdG9ySW5wdXQpOiB2b2lkIHsgfVxuXHRzdGlja0VkaXRvcihlZGl0b3I/OiBFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZCk6IHZvaWQgeyB9XG5cdHVuc3RpY2tFZGl0b3IoZWRpdG9yPzogRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQpOiB2b2lkIHsgfVxuXHRsb2NrKGxvY2tlZDogYm9vbGVhbik6IHZvaWQgeyB9XG5cdGZvY3VzKCk6IHZvaWQgeyB9XG5cdGdldCBzY29wZWRDb250ZXh0S2V5U2VydmljZSgpOiBJQ29udGV4dEtleVNlcnZpY2UgeyB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpOyB9XG5cdHNldEFjdGl2ZShfaXNBY3RpdmU6IGJvb2xlYW4pOiB2b2lkIHsgfVxuXHRub3RpZnlJbmRleENoYW5nZWQoX2luZGV4OiBudW1iZXIpOiB2b2lkIHsgfVxuXHRub3RpZnlMYWJlbENoYW5nZWQoX2xhYmVsOiBzdHJpbmcpOiB2b2lkIHsgfVxuXHRkaXNwb3NlKCk6IHZvaWQgeyB9XG5cdHRvSlNPTigpOiBvYmplY3QgeyByZXR1cm4gT2JqZWN0LmNyZWF0ZShudWxsKTsgfVxuXHRsYXlvdXQoX3dpZHRoOiBudW1iZXIsIF9oZWlnaHQ6IG51bWJlcik6IHZvaWQgeyB9XG5cdHJlbGF5b3V0KCkgeyB9XG5cdGNyZWF0ZUVkaXRvckFjdGlvbnMoX21lbnVEaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSk6IHsgYWN0aW9uczogSVRvb2xiYXJBY3Rpb25zOyBvbkRpZENoYW5nZTogRXZlbnQ8SU1lbnVDaGFuZ2VFdmVudD4gfSB7IHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7IH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RFZGl0b3JHcm91cEFjY2Vzc29yIGltcGxlbWVudHMgSUVkaXRvckdyb3Vwc1ZpZXcge1xuXG5cdGxhYmVsOiBzdHJpbmcgPSAnJztcblx0d2luZG93SWQgPSBtYWluV2luZG93LnZzY29kZVdpbmRvd0lkO1xuXG5cdGdyb3VwczogSUVkaXRvckdyb3VwVmlld1tdID0gW107XG5cdGFjdGl2ZUdyb3VwITogSUVkaXRvckdyb3VwVmlldztcblxuXHRwYXJ0T3B0aW9uczogSUVkaXRvclBhcnRPcHRpb25zID0geyAuLi5ERUZBVUxUX0VESVRPUl9QQVJUX09QVElPTlMgfTtcblxuXHRvbkRpZENoYW5nZUVkaXRvclBhcnRPcHRpb25zID0gRXZlbnQuTm9uZTtcblx0b25EaWRWaXNpYmlsaXR5Q2hhbmdlID0gRXZlbnQuTm9uZTtcblxuXHRnZXRHcm91cChpZGVudGlmaWVyOiBudW1iZXIpOiBJRWRpdG9yR3JvdXBWaWV3IHwgdW5kZWZpbmVkIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdGdldEdyb3VwcyhvcmRlcjogR3JvdXBzT3JkZXIpOiBJRWRpdG9yR3JvdXBWaWV3W10geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0YWN0aXZhdGVHcm91cChpZGVudGlmaWVyOiBudW1iZXIgfCBJRWRpdG9yR3JvdXBWaWV3KTogSUVkaXRvckdyb3VwVmlldyB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRyZXN0b3JlR3JvdXAoaWRlbnRpZmllcjogbnVtYmVyIHwgSUVkaXRvckdyb3VwVmlldyk6IElFZGl0b3JHcm91cFZpZXcgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0YWRkR3JvdXAobG9jYXRpb246IG51bWJlciB8IElFZGl0b3JHcm91cFZpZXcsIGRpcmVjdGlvbjogR3JvdXBEaXJlY3Rpb24pOiBJRWRpdG9yR3JvdXBWaWV3IHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdG1lcmdlR3JvdXAoZ3JvdXA6IG51bWJlciB8IElFZGl0b3JHcm91cFZpZXcsIHRhcmdldDogbnVtYmVyIHwgSUVkaXRvckdyb3VwVmlldywgb3B0aW9ucz86IElNZXJnZUdyb3VwT3B0aW9ucyB8IHVuZGVmaW5lZCk6IGJvb2xlYW4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0bW92ZUdyb3VwKGdyb3VwOiBudW1iZXIgfCBJRWRpdG9yR3JvdXBWaWV3LCBsb2NhdGlvbjogbnVtYmVyIHwgSUVkaXRvckdyb3VwVmlldywgZGlyZWN0aW9uOiBHcm91cERpcmVjdGlvbik6IElFZGl0b3JHcm91cFZpZXcgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0Y29weUdyb3VwKGdyb3VwOiBudW1iZXIgfCBJRWRpdG9yR3JvdXBWaWV3LCBsb2NhdGlvbjogbnVtYmVyIHwgSUVkaXRvckdyb3VwVmlldywgZGlyZWN0aW9uOiBHcm91cERpcmVjdGlvbik6IElFZGl0b3JHcm91cFZpZXcgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0cmVtb3ZlR3JvdXAoZ3JvdXA6IG51bWJlciB8IElFZGl0b3JHcm91cFZpZXcpOiB2b2lkIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdGFycmFuZ2VHcm91cHMoYXJyYW5nZW1lbnQ6IEdyb3Vwc0FycmFuZ2VtZW50LCB0YXJnZXQ/OiBudW1iZXIgfCBJRWRpdG9yR3JvdXBWaWV3IHwgdW5kZWZpbmVkKTogdm9pZCB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHR0b2dnbGVNYXhpbWl6ZUdyb3VwKGdyb3VwOiBudW1iZXIgfCBJRWRpdG9yR3JvdXBWaWV3KTogdm9pZCB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHR0b2dnbGVFeHBhbmRHcm91cChncm91cDogbnVtYmVyIHwgSUVkaXRvckdyb3VwVmlldyk6IHZvaWQgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RFZGl0b3JTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIEVkaXRvclNlcnZpY2VJbXBsIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRvbkRpZEFjdGl2ZUVkaXRvckNoYW5nZTogRXZlbnQ8dm9pZD4gPSBFdmVudC5Ob25lO1xuXHRvbkRpZFZpc2libGVFZGl0b3JzQ2hhbmdlOiBFdmVudDx2b2lkPiA9IEV2ZW50Lk5vbmU7XG5cdG9uRGlkRWRpdG9yc0NoYW5nZTogRXZlbnQ8SUVkaXRvcnNDaGFuZ2VFdmVudD4gPSBFdmVudC5Ob25lO1xuXHRvbldpbGxPcGVuRWRpdG9yOiBFdmVudDxJRWRpdG9yV2lsbE9wZW5FdmVudD4gPSBFdmVudC5Ob25lO1xuXHRvbkRpZENsb3NlRWRpdG9yOiBFdmVudDxJRWRpdG9yQ2xvc2VFdmVudD4gPSBFdmVudC5Ob25lO1xuXHRvbkRpZE9wZW5FZGl0b3JGYWlsOiBFdmVudDxJRWRpdG9ySWRlbnRpZmllcj4gPSBFdmVudC5Ob25lO1xuXHRvbkRpZE1vc3RSZWNlbnRseUFjdGl2ZUVkaXRvcnNDaGFuZ2U6IEV2ZW50PHZvaWQ+ID0gRXZlbnQuTm9uZTtcblxuXHRwcml2YXRlIF9hY3RpdmVUZXh0RWRpdG9yQ29udHJvbDogSUNvZGVFZGl0b3IgfCBJRGlmZkVkaXRvciB8IHVuZGVmaW5lZDtcblx0cHVibGljIGdldCBhY3RpdmVUZXh0RWRpdG9yQ29udHJvbCgpOiBJQ29kZUVkaXRvciB8IElEaWZmRWRpdG9yIHwgdW5kZWZpbmVkIHsgcmV0dXJuIHRoaXMuX2FjdGl2ZVRleHRFZGl0b3JDb250cm9sOyB9XG5cdHB1YmxpYyBzZXQgYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wodmFsdWU6IElDb2RlRWRpdG9yIHwgSURpZmZFZGl0b3IgfCB1bmRlZmluZWQpIHsgdGhpcy5fYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wgPSB2YWx1ZTsgfVxuXG5cdGFjdGl2ZUVkaXRvclBhbmU6IElWaXNpYmxlRWRpdG9yUGFuZSB8IHVuZGVmaW5lZDtcblx0YWN0aXZlVGV4dEVkaXRvckxhbmd1YWdlSWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF9hY3RpdmVFZGl0b3I6IEVkaXRvcklucHV0IHwgdW5kZWZpbmVkO1xuXHRwdWJsaWMgZ2V0IGFjdGl2ZUVkaXRvcigpOiBFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLl9hY3RpdmVFZGl0b3I7IH1cblx0cHVibGljIHNldCBhY3RpdmVFZGl0b3IodmFsdWU6IEVkaXRvcklucHV0IHwgdW5kZWZpbmVkKSB7IHRoaXMuX2FjdGl2ZUVkaXRvciA9IHZhbHVlOyB9XG5cblx0ZWRpdG9yczogcmVhZG9ubHkgRWRpdG9ySW5wdXRbXSA9IFtdO1xuXHRtb3N0UmVjZW50bHlBY3RpdmVFZGl0b3JzOiByZWFkb25seSBJRWRpdG9ySWRlbnRpZmllcltdID0gW107XG5cdHZpc2libGVFZGl0b3JQYW5lczogcmVhZG9ubHkgSVZpc2libGVFZGl0b3JQYW5lW10gPSBbXTtcblx0dmlzaWJsZVRleHRFZGl0b3JDb250cm9scyA9IFtdO1xuXHRnZXRWaXNpYmxlVGV4dEVkaXRvckNvbnRyb2xzKG9yZGVyOiBFZGl0b3JzT3JkZXIpOiByZWFkb25seSAoSUVkaXRvciB8IElEaWZmRWRpdG9yKVtdIHsgcmV0dXJuIHRoaXMudmlzaWJsZVRleHRFZGl0b3JDb250cm9sczsgfVxuXHR2aXNpYmxlRWRpdG9yczogcmVhZG9ubHkgRWRpdG9ySW5wdXRbXSA9IFtdO1xuXHRjb3VudCA9IHRoaXMuZWRpdG9ycy5sZW5ndGg7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBlZGl0b3JHcm91cFNlcnZpY2U/OiBJRWRpdG9yR3JvdXBzU2VydmljZSkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblx0Y3JlYXRlU2NvcGVkKGVkaXRvckdyb3Vwc0NvbnRhaW5lcjogSUVkaXRvckdyb3Vwc0NvbnRhaW5lcik6IElFZGl0b3JTZXJ2aWNlIHsgcmV0dXJuIHRoaXM7IH1cblx0Z2V0RWRpdG9ycygpIHsgcmV0dXJuIFtdOyB9XG5cdGZpbmRFZGl0b3JzKCkgeyByZXR1cm4gW10gYXMgYW55OyB9XG5cdG9wZW5FZGl0b3IoZWRpdG9yOiBFZGl0b3JJbnB1dCwgb3B0aW9ucz86IElFZGl0b3JPcHRpb25zLCBncm91cD86IFByZWZlcnJlZEdyb3VwKTogUHJvbWlzZTxJRWRpdG9yUGFuZSB8IHVuZGVmaW5lZD47XG5cdG9wZW5FZGl0b3IoZWRpdG9yOiBJUmVzb3VyY2VFZGl0b3JJbnB1dCB8IElVbnRpdGxlZFRleHRSZXNvdXJjZUVkaXRvcklucHV0LCBncm91cD86IFByZWZlcnJlZEdyb3VwKTogUHJvbWlzZTxJRWRpdG9yUGFuZSB8IHVuZGVmaW5lZD47XG5cdG9wZW5FZGl0b3IoZWRpdG9yOiBJUmVzb3VyY2VEaWZmRWRpdG9ySW5wdXQsIGdyb3VwPzogUHJlZmVycmVkR3JvdXApOiBQcm9taXNlPElUZXh0RGlmZkVkaXRvclBhbmUgfCB1bmRlZmluZWQ+O1xuXHRhc3luYyBvcGVuRWRpdG9yKGVkaXRvcjogRWRpdG9ySW5wdXQgfCBJVW50eXBlZEVkaXRvcklucHV0LCBvcHRpb25zT3JHcm91cD86IElFZGl0b3JPcHRpb25zIHwgUHJlZmVycmVkR3JvdXAsIGdyb3VwPzogUHJlZmVycmVkR3JvdXApOiBQcm9taXNlPElFZGl0b3JQYW5lIHwgdW5kZWZpbmVkPiB7XG5cdFx0Ly8gb3BlbkVkaXRvciB0YWtlcyBvd25lcnNoaXAgb2YgdGhlIGlucHV0LCByZWdpc3RlciBpdCB0byB0aGUgVGVzdEVkaXRvclNlcnZpY2Vcblx0XHQvLyBzbyBpdCdzIG5vdCBtYXJrZWQgYXMgbGVha2VkIGR1cmluZyB0ZXN0cy5cblx0XHRpZiAoJ2Rpc3Bvc2UnIGluIGVkaXRvcikge1xuXHRcdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdG9yKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXHRhc3luYyBjbG9zZUVkaXRvcihlZGl0b3I6IElFZGl0b3JJZGVudGlmaWVyLCBvcHRpb25zPzogSUNsb3NlRWRpdG9yT3B0aW9ucyk6IFByb21pc2U8dm9pZD4geyB9XG5cdGFzeW5jIGNsb3NlRWRpdG9ycyhlZGl0b3JzOiBJRWRpdG9ySWRlbnRpZmllcltdLCBvcHRpb25zPzogSUNsb3NlRWRpdG9yT3B0aW9ucyk6IFByb21pc2U8dm9pZD4geyB9XG5cdGRvUmVzb2x2ZUVkaXRvck9wZW5SZXF1ZXN0KGVkaXRvcjogRWRpdG9ySW5wdXQgfCBJVW50eXBlZEVkaXRvcklucHV0KTogW0lFZGl0b3JHcm91cCwgRWRpdG9ySW5wdXQsIElFZGl0b3JPcHRpb25zIHwgdW5kZWZpbmVkXSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCF0aGlzLmVkaXRvckdyb3VwU2VydmljZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gW3RoaXMuZWRpdG9yR3JvdXBTZXJ2aWNlLmFjdGl2ZUdyb3VwLCBlZGl0b3IgYXMgRWRpdG9ySW5wdXQsIHVuZGVmaW5lZF07XG5cdH1cblx0b3BlbkVkaXRvcnMoX2VkaXRvcnM6IGFueSwgX2dyb3VwPzogYW55KTogUHJvbWlzZTxJRWRpdG9yUGFuZVtdPiB7IHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkJyk7IH1cblx0aXNPcGVuZWQoX2VkaXRvcjogSVJlc291cmNlRWRpdG9ySW5wdXRJZGVudGlmaWVyKTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuXHRpc1Zpc2libGUoX2VkaXRvcjogRWRpdG9ySW5wdXQpOiBib29sZWFuIHsgcmV0dXJuIGZhbHNlOyB9XG5cdHJlcGxhY2VFZGl0b3JzKF9lZGl0b3JzOiBhbnksIF9ncm91cDogYW55KSB7IHJldHVybiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKTsgfVxuXHRzYXZlKGVkaXRvcnM6IElFZGl0b3JJZGVudGlmaWVyW10sIG9wdGlvbnM/OiBJU2F2ZUVkaXRvcnNPcHRpb25zKTogUHJvbWlzZTxJU2F2ZUVkaXRvcnNSZXN1bHQ+IHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdHNhdmVBbGwob3B0aW9ucz86IElTYXZlRWRpdG9yc09wdGlvbnMpOiBQcm9taXNlPElTYXZlRWRpdG9yc1Jlc3VsdD4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0cmV2ZXJ0KGVkaXRvcnM6IElFZGl0b3JJZGVudGlmaWVyW10sIG9wdGlvbnM/OiBJUmV2ZXJ0T3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0cmV2ZXJ0QWxsKG9wdGlvbnM/OiBJUmV2ZXJ0QWxsRWRpdG9yc09wdGlvbnMpOiBQcm9taXNlPGJvb2xlYW4+IHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0RmlsZVNlcnZpY2UgaW1wbGVtZW50cyBJRmlsZVNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRmlsZXNDaGFuZ2UgPSBuZXcgRW1pdHRlcjxGaWxlQ2hhbmdlc0V2ZW50PigpO1xuXHRnZXQgb25EaWRGaWxlc0NoYW5nZSgpOiBFdmVudDxGaWxlQ2hhbmdlc0V2ZW50PiB7IHJldHVybiB0aGlzLl9vbkRpZEZpbGVzQ2hhbmdlLmV2ZW50OyB9XG5cdGZpcmVGaWxlQ2hhbmdlcyhldmVudDogRmlsZUNoYW5nZXNFdmVudCk6IHZvaWQgeyB0aGlzLl9vbkRpZEZpbGVzQ2hhbmdlLmZpcmUoZXZlbnQpOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSdW5PcGVyYXRpb24gPSBuZXcgRW1pdHRlcjxGaWxlT3BlcmF0aW9uRXZlbnQ+KCk7XG5cdGdldCBvbkRpZFJ1bk9wZXJhdGlvbigpOiBFdmVudDxGaWxlT3BlcmF0aW9uRXZlbnQ+IHsgcmV0dXJuIHRoaXMuX29uRGlkUnVuT3BlcmF0aW9uLmV2ZW50OyB9XG5cdGZpcmVBZnRlck9wZXJhdGlvbihldmVudDogRmlsZU9wZXJhdGlvbkV2ZW50KTogdm9pZCB7IHRoaXMuX29uRGlkUnVuT3BlcmF0aW9uLmZpcmUoZXZlbnQpOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMgPSBuZXcgRW1pdHRlcjxJRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzQ2hhbmdlRXZlbnQ+KCk7XG5cdGdldCBvbkRpZENoYW5nZUZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcygpOiBFdmVudDxJRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzQ2hhbmdlRXZlbnQ+IHsgcmV0dXJuIHRoaXMuX29uRGlkQ2hhbmdlRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLmV2ZW50OyB9XG5cdGZpcmVGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXNDaGFuZ2VFdmVudChldmVudDogSUZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllc0NoYW5nZUV2ZW50KTogdm9pZCB7IHRoaXMuX29uRGlkQ2hhbmdlRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLmZpcmUoZXZlbnQpOyB9XG5cblx0cHJpdmF0ZSBfb25XaWxsQWN0aXZhdGVGaWxlU3lzdGVtUHJvdmlkZXIgPSBuZXcgRW1pdHRlcjxJRmlsZVN5c3RlbVByb3ZpZGVyQWN0aXZhdGlvbkV2ZW50PigpO1xuXHRyZWFkb25seSBvbldpbGxBY3RpdmF0ZUZpbGVTeXN0ZW1Qcm92aWRlciA9IHRoaXMuX29uV2lsbEFjdGl2YXRlRmlsZVN5c3RlbVByb3ZpZGVyLmV2ZW50O1xuXHRyZWFkb25seSBvbkRpZFdhdGNoRXJyb3IgPSBFdmVudC5Ob25lO1xuXG5cdHByaXZhdGUgY29udGVudCA9ICdIZWxsbyBIdG1sJztcblx0cHJpdmF0ZSBsYXN0UmVhZEZpbGVVcmkhOiBVUkk7XG5cblx0cmVhZG9ubHkgPSBmYWxzZTtcblxuXHRzZXRDb250ZW50KGNvbnRlbnQ6IHN0cmluZyk6IHZvaWQgeyB0aGlzLmNvbnRlbnQgPSBjb250ZW50OyB9XG5cdGdldENvbnRlbnQoKTogc3RyaW5nIHsgcmV0dXJuIHRoaXMuY29udGVudDsgfVxuXHRnZXRMYXN0UmVhZEZpbGVVcmkoKTogVVJJIHsgcmV0dXJuIHRoaXMubGFzdFJlYWRGaWxlVXJpOyB9XG5cblx0cmVzb2x2ZShyZXNvdXJjZTogVVJJLCBfb3B0aW9uczogSVJlc29sdmVNZXRhZGF0YUZpbGVPcHRpb25zKTogUHJvbWlzZTxJRmlsZVN0YXRXaXRoTWV0YWRhdGE+O1xuXHRyZXNvbHZlKHJlc291cmNlOiBVUkksIF9vcHRpb25zPzogSVJlc29sdmVGaWxlT3B0aW9ucyk6IFByb21pc2U8SUZpbGVTdGF0Pjtcblx0YXN5bmMgcmVzb2x2ZShyZXNvdXJjZTogVVJJLCBfb3B0aW9ucz86IElSZXNvbHZlRmlsZU9wdGlvbnMpOiBQcm9taXNlPElGaWxlU3RhdD4ge1xuXHRcdHJldHVybiBjcmVhdGVGaWxlU3RhdChyZXNvdXJjZSwgdGhpcy5yZWFkb25seSk7XG5cdH1cblxuXHRzdGF0KHJlc291cmNlOiBVUkkpOiBQcm9taXNlPElGaWxlU3RhdFdpdGhQYXJ0aWFsTWV0YWRhdGE+IHtcblx0XHRyZXR1cm4gdGhpcy5yZXNvbHZlKHJlc291cmNlLCB7IHJlc29sdmVNZXRhZGF0YTogdHJ1ZSB9KTtcblx0fVxuXG5cdGFzeW5jIHJlc29sdmVBbGwodG9SZXNvbHZlOiB7IHJlc291cmNlOiBVUkk7IG9wdGlvbnM/OiBJUmVzb2x2ZUZpbGVPcHRpb25zIH1bXSk6IFByb21pc2U8SUZpbGVTdGF0UmVzdWx0W10+IHtcblx0XHRjb25zdCBzdGF0cyA9IGF3YWl0IFByb21pc2UuYWxsKHRvUmVzb2x2ZS5tYXAocmVzb3VyY2VBbmRPcHRpb24gPT4gdGhpcy5yZXNvbHZlKHJlc291cmNlQW5kT3B0aW9uLnJlc291cmNlLCByZXNvdXJjZUFuZE9wdGlvbi5vcHRpb25zKSkpO1xuXG5cdFx0cmV0dXJuIHN0YXRzLm1hcChzdGF0ID0+ICh7IHN0YXQsIHN1Y2Nlc3M6IHRydWUgfSkpO1xuXHR9XG5cblx0cmVhZG9ubHkgbm90RXhpc3RzU2V0ID0gbmV3IFJlc291cmNlTWFwPGJvb2xlYW4+KCk7XG5cblx0YXN5bmMgZXhpc3RzKF9yZXNvdXJjZTogVVJJKTogUHJvbWlzZTxib29sZWFuPiB7IHJldHVybiAhdGhpcy5ub3RFeGlzdHNTZXQuaGFzKF9yZXNvdXJjZSk7IH1cblxuXHRyZWFkU2hvdWxkVGhyb3dFcnJvcjogRXJyb3IgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0YXN5bmMgcmVhZEZpbGUocmVzb3VyY2U6IFVSSSwgb3B0aW9ucz86IElSZWFkRmlsZU9wdGlvbnMgfCB1bmRlZmluZWQpOiBQcm9taXNlPElGaWxlQ29udGVudD4ge1xuXHRcdGlmICh0aGlzLnJlYWRTaG91bGRUaHJvd0Vycm9yKSB7XG5cdFx0XHR0aHJvdyB0aGlzLnJlYWRTaG91bGRUaHJvd0Vycm9yO1xuXHRcdH1cblxuXHRcdHRoaXMubGFzdFJlYWRGaWxlVXJpID0gcmVzb3VyY2U7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0Li4uY3JlYXRlRmlsZVN0YXQocmVzb3VyY2UsIHRoaXMucmVhZG9ubHkpLFxuXHRcdFx0dmFsdWU6IFZTQnVmZmVyLmZyb21TdHJpbmcodGhpcy5jb250ZW50KVxuXHRcdH07XG5cdH1cblxuXHRhc3luYyByZWFkRmlsZVN0cmVhbShyZXNvdXJjZTogVVJJLCBvcHRpb25zPzogSVJlYWRGaWxlU3RyZWFtT3B0aW9ucyB8IHVuZGVmaW5lZCk6IFByb21pc2U8SUZpbGVTdHJlYW1Db250ZW50PiB7XG5cdFx0aWYgKHRoaXMucmVhZFNob3VsZFRocm93RXJyb3IpIHtcblx0XHRcdHRocm93IHRoaXMucmVhZFNob3VsZFRocm93RXJyb3I7XG5cdFx0fVxuXG5cdFx0dGhpcy5sYXN0UmVhZEZpbGVVcmkgPSByZXNvdXJjZTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHQuLi5jcmVhdGVGaWxlU3RhdChyZXNvdXJjZSwgdGhpcy5yZWFkb25seSksXG5cdFx0XHR2YWx1ZTogYnVmZmVyVG9TdHJlYW0oVlNCdWZmZXIuZnJvbVN0cmluZyh0aGlzLmNvbnRlbnQpKVxuXHRcdH07XG5cdH1cblxuXHR3cml0ZVNob3VsZFRocm93RXJyb3I6IEVycm9yIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdGFzeW5jIHdyaXRlRmlsZShyZXNvdXJjZTogVVJJLCBidWZmZXJPclJlYWRhYmxlOiBWU0J1ZmZlciB8IFZTQnVmZmVyUmVhZGFibGUsIG9wdGlvbnM/OiBJV3JpdGVGaWxlT3B0aW9ucyk6IFByb21pc2U8SUZpbGVTdGF0V2l0aE1ldGFkYXRhPiB7XG5cdFx0YXdhaXQgdGltZW91dCgwKTtcblxuXHRcdGlmICh0aGlzLndyaXRlU2hvdWxkVGhyb3dFcnJvcikge1xuXHRcdFx0dGhyb3cgdGhpcy53cml0ZVNob3VsZFRocm93RXJyb3I7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNyZWF0ZUZpbGVTdGF0KHJlc291cmNlLCB0aGlzLnJlYWRvbmx5KTtcblx0fVxuXG5cdG1vdmUoX3NvdXJjZTogVVJJLCBfdGFyZ2V0OiBVUkksIF9vdmVyd3JpdGU/OiBib29sZWFuKTogUHJvbWlzZTxJRmlsZVN0YXRXaXRoTWV0YWRhdGE+IHsgcmV0dXJuIFByb21pc2UucmVzb2x2ZShudWxsISk7IH1cblx0Y29weShfc291cmNlOiBVUkksIF90YXJnZXQ6IFVSSSwgX292ZXJ3cml0ZT86IGJvb2xlYW4pOiBQcm9taXNlPElGaWxlU3RhdFdpdGhNZXRhZGF0YT4geyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwhKTsgfVxuXHRhc3luYyBjbG9uZUZpbGUoX3NvdXJjZTogVVJJLCBfdGFyZ2V0OiBVUkkpOiBQcm9taXNlPHZvaWQ+IHsgfVxuXHRjcmVhdGVGaWxlKF9yZXNvdXJjZTogVVJJLCBfY29udGVudD86IFZTQnVmZmVyIHwgVlNCdWZmZXJSZWFkYWJsZSwgX29wdGlvbnM/OiBJQ3JlYXRlRmlsZU9wdGlvbnMpOiBQcm9taXNlPElGaWxlU3RhdFdpdGhNZXRhZGF0YT4geyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwhKTsgfVxuXHRjcmVhdGVGb2xkZXIoX3Jlc291cmNlOiBVUkkpOiBQcm9taXNlPElGaWxlU3RhdFdpdGhNZXRhZGF0YT4geyByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwhKTsgfVxuXG5cdG9uRGlkQ2hhbmdlRmlsZVN5c3RlbVByb3ZpZGVyUmVnaXN0cmF0aW9ucyA9IEV2ZW50Lk5vbmU7XG5cblx0cHJpdmF0ZSBwcm92aWRlcnMgPSBuZXcgTWFwPHN0cmluZywgSUZpbGVTeXN0ZW1Qcm92aWRlcj4oKTtcblxuXHRyZWdpc3RlclByb3ZpZGVyKHNjaGVtZTogc3RyaW5nLCBwcm92aWRlcjogSUZpbGVTeXN0ZW1Qcm92aWRlcikge1xuXHRcdHRoaXMucHJvdmlkZXJzLnNldChzY2hlbWUsIHByb3ZpZGVyKTtcblxuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4gdGhpcy5wcm92aWRlcnMuZGVsZXRlKHNjaGVtZSkpO1xuXHR9XG5cblx0Z2V0UHJvdmlkZXIoc2NoZW1lOiBzdHJpbmcpIHtcblx0XHRyZXR1cm4gdGhpcy5wcm92aWRlcnMuZ2V0KHNjaGVtZSk7XG5cdH1cblxuXHRhc3luYyBhY3RpdmF0ZVByb3ZpZGVyKF9zY2hlbWU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuX29uV2lsbEFjdGl2YXRlRmlsZVN5c3RlbVByb3ZpZGVyLmZpcmUoeyBzY2hlbWU6IF9zY2hlbWUsIGpvaW46ICgpID0+IHsgfSB9KTtcblx0fVxuXHRhc3luYyBjYW5IYW5kbGVSZXNvdXJjZShyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxib29sZWFuPiB7IHJldHVybiB0aGlzLmhhc1Byb3ZpZGVyKHJlc291cmNlKTsgfVxuXHRoYXNQcm92aWRlcihyZXNvdXJjZTogVVJJKTogYm9vbGVhbiB7IHJldHVybiByZXNvdXJjZS5zY2hlbWUgPT09IFNjaGVtYXMuZmlsZSB8fCB0aGlzLnByb3ZpZGVycy5oYXMocmVzb3VyY2Uuc2NoZW1lKTsgfVxuXHRsaXN0Q2FwYWJpbGl0aWVzKCkge1xuXHRcdHJldHVybiBbXG5cdFx0XHR7IHNjaGVtZTogU2NoZW1hcy5maWxlLCBjYXBhYmlsaXRpZXM6IEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5GaWxlT3BlblJlYWRXcml0ZUNsb3NlIH0sXG5cdFx0XHQuLi5JdGVyYWJsZS5tYXAodGhpcy5wcm92aWRlcnMsIChbc2NoZW1lLCBwXSkgPT4geyByZXR1cm4geyBzY2hlbWUsIGNhcGFiaWxpdGllczogcC5jYXBhYmlsaXRpZXMgfTsgfSlcblx0XHRdO1xuXHR9XG5cdGhhc0NhcGFiaWxpdHkocmVzb3VyY2U6IFVSSSwgY2FwYWJpbGl0eTogRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzKTogYm9vbGVhbiB7XG5cdFx0aWYgKGNhcGFiaWxpdHkgPT09IEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5QYXRoQ2FzZVNlbnNpdGl2ZSAmJiBpc0xpbnV4KSB7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMuZ2V0UHJvdmlkZXIocmVzb3VyY2Uuc2NoZW1lKTtcblxuXHRcdHJldHVybiAhIShwcm92aWRlciAmJiAocHJvdmlkZXIuY2FwYWJpbGl0aWVzICYgY2FwYWJpbGl0eSkpO1xuXHR9XG5cblx0YXN5bmMgZGVsKF9yZXNvdXJjZTogVVJJLCBfb3B0aW9ucz86IHsgdXNlVHJhc2g/OiBib29sZWFuOyByZWN1cnNpdmU/OiBib29sZWFuIH0pOiBQcm9taXNlPHZvaWQ+IHsgfVxuXG5cdGNyZWF0ZVdhdGNoZXIocmVzb3VyY2U6IFVSSSwgb3B0aW9uczogSVdhdGNoT3B0aW9ucyk6IElGaWxlU3lzdGVtV2F0Y2hlciB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG9uRGlkQ2hhbmdlOiBFdmVudC5Ob25lLFxuXHRcdFx0ZGlzcG9zZTogKCkgPT4geyB9XG5cdFx0fTtcblx0fVxuXG5cblx0cmVhZG9ubHkgd2F0Y2hlczogVVJJW10gPSBbXTtcblx0d2F0Y2goX3Jlc291cmNlOiBVUkksIG9wdGlvbnM6IElXYXRjaE9wdGlvbnNXaXRoQ29ycmVsYXRpb24pOiBJRmlsZVN5c3RlbVdhdGNoZXI7XG5cdHdhdGNoKF9yZXNvdXJjZTogVVJJKTogSURpc3Bvc2FibGU7XG5cdHdhdGNoKF9yZXNvdXJjZTogVVJJKTogSURpc3Bvc2FibGUge1xuXHRcdHRoaXMud2F0Y2hlcy5wdXNoKF9yZXNvdXJjZSk7XG5cblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHRoaXMud2F0Y2hlcy5zcGxpY2UodGhpcy53YXRjaGVzLmluZGV4T2YoX3Jlc291cmNlKSwgMSkpO1xuXHR9XG5cblx0Z2V0V3JpdGVFbmNvZGluZyhfcmVzb3VyY2U6IFVSSSk6IElSZXNvdXJjZUVuY29kaW5nIHsgcmV0dXJuIHsgZW5jb2Rpbmc6ICd1dGY4JywgaGFzQk9NOiBmYWxzZSB9OyB9XG5cdGRpc3Bvc2UoKTogdm9pZCB7IH1cblxuXHRhc3luYyBjYW5DcmVhdGVGaWxlKHNvdXJjZTogVVJJLCBvcHRpb25zPzogSUNyZWF0ZUZpbGVPcHRpb25zKTogUHJvbWlzZTxFcnJvciB8IHRydWU+IHsgcmV0dXJuIHRydWU7IH1cblx0YXN5bmMgY2FuTW92ZShzb3VyY2U6IFVSSSwgdGFyZ2V0OiBVUkksIG92ZXJ3cml0ZT86IGJvb2xlYW4gfCB1bmRlZmluZWQpOiBQcm9taXNlPEVycm9yIHwgdHJ1ZT4geyByZXR1cm4gdHJ1ZTsgfVxuXHRhc3luYyBjYW5Db3B5KHNvdXJjZTogVVJJLCB0YXJnZXQ6IFVSSSwgb3ZlcndyaXRlPzogYm9vbGVhbiB8IHVuZGVmaW5lZCk6IFByb21pc2U8RXJyb3IgfCB0cnVlPiB7IHJldHVybiB0cnVlOyB9XG5cdGFzeW5jIGNhbkRlbGV0ZShyZXNvdXJjZTogVVJJLCBvcHRpb25zPzogeyB1c2VUcmFzaD86IGJvb2xlYW4gfCB1bmRlZmluZWQ7IHJlY3Vyc2l2ZT86IGJvb2xlYW4gfCB1bmRlZmluZWQgfSB8IHVuZGVmaW5lZCk6IFByb21pc2U8RXJyb3IgfCB0cnVlPiB7IHJldHVybiB0cnVlOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0V29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlIGV4dGVuZHMgSW5NZW1vcnlXb3JraW5nQ29weUJhY2t1cFNlcnZpY2Uge1xuXG5cdHJlYWRvbmx5IHJlc29sdmVkOiBTZXQ8SVdvcmtpbmdDb3B5SWRlbnRpZmllcj4gPSBuZXcgU2V0KCk7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHBhcnNlQmFja3VwQ29udGVudCh0ZXh0QnVmZmVyRmFjdG9yeTogSVRleHRCdWZmZXJGYWN0b3J5KTogc3RyaW5nIHtcblx0XHRjb25zdCB0ZXh0QnVmZmVyID0gdGV4dEJ1ZmZlckZhY3RvcnkuY3JlYXRlKERlZmF1bHRFbmRPZkxpbmUuTEYpLnRleHRCdWZmZXI7XG5cdFx0Y29uc3QgbGluZUNvdW50ID0gdGV4dEJ1ZmZlci5nZXRMaW5lQ291bnQoKTtcblx0XHRjb25zdCByYW5nZSA9IG5ldyBSYW5nZSgxLCAxLCBsaW5lQ291bnQsIHRleHRCdWZmZXIuZ2V0TGluZUxlbmd0aChsaW5lQ291bnQpICsgMSk7XG5cblx0XHRyZXR1cm4gdGV4dEJ1ZmZlci5nZXRWYWx1ZUluUmFuZ2UocmFuZ2UsIEVuZE9mTGluZVByZWZlcmVuY2UuVGV4dERlZmluZWQpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgcmVzb2x2ZTxUIGV4dGVuZHMgSVdvcmtpbmdDb3B5QmFja3VwTWV0YT4oaWRlbnRpZmllcjogSVdvcmtpbmdDb3B5SWRlbnRpZmllcik6IFByb21pc2U8SVJlc29sdmVkV29ya2luZ0NvcHlCYWNrdXA8VD4gfCB1bmRlZmluZWQ+IHtcblx0XHR0aGlzLnJlc29sdmVkLmFkZChpZGVudGlmaWVyKTtcblxuXHRcdHJldHVybiBzdXBlci5yZXNvbHZlKGlkZW50aWZpZXIpO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b1VudHlwZWRXb3JraW5nQ29weUlkKHJlc291cmNlOiBVUkkpOiBJV29ya2luZ0NvcHlJZGVudGlmaWVyIHtcblx0cmV0dXJuIHRvVHlwZWRXb3JraW5nQ29weUlkKHJlc291cmNlLCAnJyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB0b1R5cGVkV29ya2luZ0NvcHlJZChyZXNvdXJjZTogVVJJLCB0eXBlSWQgPSAndGVzdEJhY2t1cFR5cGVJZCcpOiBJV29ya2luZ0NvcHlJZGVudGlmaWVyIHtcblx0cmV0dXJuIHsgdHlwZUlkLCByZXNvdXJjZSB9O1xufVxuXG5leHBvcnQgY2xhc3MgSW5NZW1vcnlUZXN0V29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlIGV4dGVuZHMgQnJvd3NlcldvcmtpbmdDb3B5QmFja3VwU2VydmljZSB7XG5cblx0cHJpdmF0ZSBiYWNrdXBSZXNvdXJjZUpvaW5lcnM6IEZ1bmN0aW9uW107XG5cdHByaXZhdGUgZGlzY2FyZEJhY2t1cEpvaW5lcnM6IEZ1bmN0aW9uW107XG5cblx0ZGlzY2FyZGVkQmFja3VwczogSVdvcmtpbmdDb3B5SWRlbnRpZmllcltdO1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGVudmlyb25tZW50U2VydmljZSA9IFRlc3RFbnZpcm9ubWVudFNlcnZpY2U7XG5cdFx0Y29uc3QgbG9nU2VydmljZSA9IG5ldyBOdWxsTG9nU2VydmljZSgpO1xuXHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaWxlU2VydmljZShsb2dTZXJ2aWNlKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGZpbGVTZXJ2aWNlLnJlZ2lzdGVyUHJvdmlkZXIoU2NoZW1hcy5maWxlLCBkaXNwb3NhYmxlcy5hZGQobmV3IEluTWVtb3J5RmlsZVN5c3RlbVByb3ZpZGVyKCkpKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGZpbGVTZXJ2aWNlLnJlZ2lzdGVyUHJvdmlkZXIoU2NoZW1hcy52c2NvZGVVc2VyRGF0YSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBJbk1lbW9yeUZpbGVTeXN0ZW1Qcm92aWRlcigpKSkpO1xuXG5cdFx0c3VwZXIobmV3IFRlc3RDb250ZXh0U2VydmljZShUZXN0V29ya3NwYWNlKSwgZW52aXJvbm1lbnRTZXJ2aWNlLCBmaWxlU2VydmljZSwgbG9nU2VydmljZSk7XG5cblx0XHR0aGlzLmJhY2t1cFJlc291cmNlSm9pbmVycyA9IFtdO1xuXHRcdHRoaXMuZGlzY2FyZEJhY2t1cEpvaW5lcnMgPSBbXTtcblx0XHR0aGlzLmRpc2NhcmRlZEJhY2t1cHMgPSBbXTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGRpc3Bvc2FibGVzKTtcblx0fVxuXG5cdHRlc3RHZXRGaWxlU2VydmljZSgpOiBJRmlsZVNlcnZpY2Uge1xuXHRcdHJldHVybiB0aGlzLmZpbGVTZXJ2aWNlO1xuXHR9XG5cblx0am9pbkJhY2t1cFJlc291cmNlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHRoaXMuYmFja3VwUmVzb3VyY2VKb2luZXJzLnB1c2gocmVzb2x2ZSkpO1xuXHR9XG5cblx0am9pbkRpc2NhcmRCYWNrdXAoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4gdGhpcy5kaXNjYXJkQmFja3VwSm9pbmVycy5wdXNoKHJlc29sdmUpKTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIGJhY2t1cChpZGVudGlmaWVyOiBJV29ya2luZ0NvcHlJZGVudGlmaWVyLCBjb250ZW50PzogVlNCdWZmZXJSZWFkYWJsZVN0cmVhbSB8IFZTQnVmZmVyUmVhZGFibGUsIHZlcnNpb25JZD86IG51bWJlciwgbWV0YT86IGFueSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHN1cGVyLmJhY2t1cChpZGVudGlmaWVyLCBjb250ZW50LCB2ZXJzaW9uSWQsIG1ldGEsIHRva2VuKTtcblxuXHRcdHdoaWxlICh0aGlzLmJhY2t1cFJlc291cmNlSm9pbmVycy5sZW5ndGgpIHtcblx0XHRcdHRoaXMuYmFja3VwUmVzb3VyY2VKb2luZXJzLnBvcCgpISgpO1xuXHRcdH1cblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIGRpc2NhcmRCYWNrdXAoaWRlbnRpZmllcjogSVdvcmtpbmdDb3B5SWRlbnRpZmllcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHN1cGVyLmRpc2NhcmRCYWNrdXAoaWRlbnRpZmllcik7XG5cdFx0dGhpcy5kaXNjYXJkZWRCYWNrdXBzLnB1c2goaWRlbnRpZmllcik7XG5cblx0XHR3aGlsZSAodGhpcy5kaXNjYXJkQmFja3VwSm9pbmVycy5sZW5ndGgpIHtcblx0XHRcdHRoaXMuZGlzY2FyZEJhY2t1cEpvaW5lcnMucG9wKCkhKCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZ2V0QmFja3VwQ29udGVudHMoaWRlbnRpZmllcjogSVdvcmtpbmdDb3B5SWRlbnRpZmllcik6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0Y29uc3QgYmFja3VwUmVzb3VyY2UgPSB0aGlzLnRvQmFja3VwUmVzb3VyY2UoaWRlbnRpZmllcik7XG5cblx0XHRjb25zdCBmaWxlQ29udGVudHMgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlYWRGaWxlKGJhY2t1cFJlc291cmNlKTtcblxuXHRcdHJldHVybiBmaWxlQ29udGVudHMudmFsdWUudG9TdHJpbmcoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVGVzdExpZmVjeWNsZVNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUxpZmVjeWNsZVNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHVzZVBoYXNlcyA9IGZhbHNlO1xuXHRfcGhhc2UhOiBMaWZlY3ljbGVQaGFzZTtcblx0Z2V0IHBoYXNlKCk6IExpZmVjeWNsZVBoYXNlIHsgcmV0dXJuIHRoaXMuX3BoYXNlOyB9XG5cdHNldCBwaGFzZSh2YWx1ZTogTGlmZWN5Y2xlUGhhc2UpIHtcblx0XHR0aGlzLl9waGFzZSA9IHZhbHVlO1xuXHRcdGlmICh2YWx1ZSA9PT0gTGlmZWN5Y2xlUGhhc2UuU3RhcnRpbmcpIHtcblx0XHRcdHRoaXMud2hlblN0YXJ0ZWQuY29tcGxldGUoKTtcblx0XHR9IGVsc2UgaWYgKHZhbHVlID09PSBMaWZlY3ljbGVQaGFzZS5SZWFkeSkge1xuXHRcdFx0dGhpcy53aGVuUmVhZHkuY29tcGxldGUoKTtcblx0XHR9IGVsc2UgaWYgKHZhbHVlID09PSBMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZCkge1xuXHRcdFx0dGhpcy53aGVuUmVzdG9yZWQuY29tcGxldGUoKTtcblx0XHR9IGVsc2UgaWYgKHZhbHVlID09PSBMaWZlY3ljbGVQaGFzZS5FdmVudHVhbGx5KSB7XG5cdFx0XHR0aGlzLndoZW5FdmVudHVhbGx5LmNvbXBsZXRlKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSB3aGVuU3RhcnRlZCA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblx0cHJpdmF0ZSByZWFkb25seSB3aGVuUmVhZHkgPSBuZXcgRGVmZXJyZWRQcm9taXNlPHZvaWQ+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgd2hlblJlc3RvcmVkID0gbmV3IERlZmVycmVkUHJvbWlzZTx2b2lkPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IHdoZW5FdmVudHVhbGx5ID0gbmV3IERlZmVycmVkUHJvbWlzZTx2b2lkPigpO1xuXHRhc3luYyB3aGVuKHBoYXNlOiBMaWZlY3ljbGVQaGFzZSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy51c2VQaGFzZXMpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0aWYgKHBoYXNlID09PSBMaWZlY3ljbGVQaGFzZS5TdGFydGluZykge1xuXHRcdFx0YXdhaXQgdGhpcy53aGVuU3RhcnRlZC5wO1xuXHRcdH0gZWxzZSBpZiAocGhhc2UgPT09IExpZmVjeWNsZVBoYXNlLlJlYWR5KSB7XG5cdFx0XHRhd2FpdCB0aGlzLndoZW5SZWFkeS5wO1xuXHRcdH0gZWxzZSBpZiAocGhhc2UgPT09IExpZmVjeWNsZVBoYXNlLlJlc3RvcmVkKSB7XG5cdFx0XHRhd2FpdCB0aGlzLndoZW5SZXN0b3JlZC5wO1xuXHRcdH0gZWxzZSBpZiAocGhhc2UgPT09IExpZmVjeWNsZVBoYXNlLkV2ZW50dWFsbHkpIHtcblx0XHRcdGF3YWl0IHRoaXMud2hlbkV2ZW50dWFsbHkucDtcblx0XHR9XG5cdH1cblxuXHRzdGFydHVwS2luZCE6IFN0YXJ0dXBLaW5kO1xuXHR3aWxsU2h1dGRvd24gPSBmYWxzZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkJlZm9yZVNodXRkb3duID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SW50ZXJuYWxCZWZvcmVTaHV0ZG93bkV2ZW50PigpKTtcblx0Z2V0IG9uQmVmb3JlU2h1dGRvd24oKTogRXZlbnQ8SW50ZXJuYWxCZWZvcmVTaHV0ZG93bkV2ZW50PiB7IHJldHVybiB0aGlzLl9vbkJlZm9yZVNodXRkb3duLmV2ZW50OyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25CZWZvcmVTaHV0ZG93bkVycm9yID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8QmVmb3JlU2h1dGRvd25FcnJvckV2ZW50PigpKTtcblx0Z2V0IG9uQmVmb3JlU2h1dGRvd25FcnJvcigpOiBFdmVudDxCZWZvcmVTaHV0ZG93bkVycm9yRXZlbnQ+IHsgcmV0dXJuIHRoaXMuX29uQmVmb3JlU2h1dGRvd25FcnJvci5ldmVudDsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uU2h1dGRvd25WZXRvID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdGdldCBvblNodXRkb3duVmV0bygpOiBFdmVudDx2b2lkPiB7IHJldHVybiB0aGlzLl9vblNodXRkb3duVmV0by5ldmVudDsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uV2lsbFNodXRkb3duID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8V2lsbFNodXRkb3duRXZlbnQ+KCkpO1xuXHRnZXQgb25XaWxsU2h1dGRvd24oKTogRXZlbnQ8V2lsbFNodXRkb3duRXZlbnQ+IHsgcmV0dXJuIHRoaXMuX29uV2lsbFNodXRkb3duLmV2ZW50OyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTaHV0ZG93biA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRnZXQgb25EaWRTaHV0ZG93bigpOiBFdmVudDx2b2lkPiB7IHJldHVybiB0aGlzLl9vbkRpZFNodXRkb3duLmV2ZW50OyB9XG5cblx0c2h1dGRvd25Kb2luZXJzOiBQcm9taXNlPHZvaWQ+W10gPSBbXTtcblxuXHRmaXJlU2h1dGRvd24ocmVhc29uID0gU2h1dGRvd25SZWFzb24uUVVJVCk6IHZvaWQge1xuXHRcdHRoaXMuc2h1dGRvd25Kb2luZXJzID0gW107XG5cblx0XHR0aGlzLl9vbldpbGxTaHV0ZG93bi5maXJlKHtcblx0XHRcdGpvaW46IHAgPT4ge1xuXHRcdFx0XHR0aGlzLnNodXRkb3duSm9pbmVycy5wdXNoKHR5cGVvZiBwID09PSAnZnVuY3Rpb24nID8gcCgpIDogcCk7XG5cdFx0XHR9LFxuXHRcdFx0am9pbmVyczogKCkgPT4gW10sXG5cdFx0XHRmb3JjZTogKCkgPT4geyAvKiBOby1PcCBpbiB0ZXN0cyAqLyB9LFxuXHRcdFx0dG9rZW46IENhbmNlbGxhdGlvblRva2VuLk5vbmUsXG5cdFx0XHRyZWFzb25cblx0XHR9KTtcblx0fVxuXG5cdGZpcmVCZWZvcmVTaHV0ZG93bihldmVudDogSW50ZXJuYWxCZWZvcmVTaHV0ZG93bkV2ZW50KTogdm9pZCB7IHRoaXMuX29uQmVmb3JlU2h1dGRvd24uZmlyZShldmVudCk7IH1cblxuXHRmaXJlV2lsbFNodXRkb3duKGV2ZW50OiBXaWxsU2h1dGRvd25FdmVudCk6IHZvaWQgeyB0aGlzLl9vbldpbGxTaHV0ZG93bi5maXJlKGV2ZW50KTsgfVxuXG5cdGFzeW5jIHNodXRkb3duKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMuZmlyZVNodXRkb3duKCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RCZWZvcmVTaHV0ZG93bkV2ZW50IGltcGxlbWVudHMgSW50ZXJuYWxCZWZvcmVTaHV0ZG93bkV2ZW50IHtcblxuXHR2YWx1ZTogYm9vbGVhbiB8IFByb21pc2U8Ym9vbGVhbj4gfCB1bmRlZmluZWQ7XG5cdGZpbmFsVmFsdWU6ICgoKSA9PiBib29sZWFuIHwgUHJvbWlzZTxib29sZWFuPikgfCB1bmRlZmluZWQ7XG5cdHJlYXNvbiA9IFNodXRkb3duUmVhc29uLkNMT1NFO1xuXG5cdHZldG8odmFsdWU6IGJvb2xlYW4gfCBQcm9taXNlPGJvb2xlYW4+KTogdm9pZCB7XG5cdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHR9XG5cblx0ZmluYWxWZXRvKHZldG9GbjogKCkgPT4gYm9vbGVhbiB8IFByb21pc2U8Ym9vbGVhbj4pOiB2b2lkIHtcblx0XHR0aGlzLnZhbHVlID0gdmV0b0ZuKCk7XG5cdFx0dGhpcy5maW5hbFZhbHVlID0gdmV0b0ZuO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0V2lsbFNodXRkb3duRXZlbnQgaW1wbGVtZW50cyBXaWxsU2h1dGRvd25FdmVudCB7XG5cblx0dmFsdWU6IFByb21pc2U8dm9pZD5bXSA9IFtdO1xuXHRqb2luZXJzID0gKCkgPT4gW107XG5cdHJlYXNvbiA9IFNodXRkb3duUmVhc29uLkNMT1NFO1xuXHR0b2tlbiA9IENhbmNlbGxhdGlvblRva2VuLk5vbmU7XG5cblx0am9pbihwcm9taXNlOiBQcm9taXNlPHZvaWQ+IHwgKCgpID0+IFByb21pc2U8dm9pZD4pLCBqb2luZXI6IElXaWxsU2h1dGRvd25FdmVudEpvaW5lcik6IHZvaWQge1xuXHRcdHRoaXMudmFsdWUucHVzaCh0eXBlb2YgcHJvbWlzZSA9PT0gJ2Z1bmN0aW9uJyA/IHByb21pc2UoKSA6IHByb21pc2UpO1xuXHR9XG5cblx0Zm9yY2UoKSB7IC8qIE5vLU9wIGluIHRlc3RzICovIH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSBpbXBsZW1lbnRzIElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSBjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKSkgeyB9XG5cblx0b25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKCkge1xuXHRcdHJldHVybiB7IGRpc3Bvc2UoKSB7IH0gfTtcblx0fVxuXG5cdGdldFZhbHVlPFQ+KHJlc291cmNlOiBVUkksIGFyZzI/OiBhbnksIGFyZzM/OiBhbnkpOiBUIHtcblx0XHRjb25zdCBwb3NpdGlvbjogSVBvc2l0aW9uIHwgbnVsbCA9IEVkaXRvclBvc2l0aW9uLmlzSVBvc2l0aW9uKGFyZzIpID8gYXJnMiA6IG51bGw7XG5cdFx0Y29uc3Qgc2VjdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkID0gcG9zaXRpb24gPyAodHlwZW9mIGFyZzMgPT09ICdzdHJpbmcnID8gYXJnMyA6IHVuZGVmaW5lZCkgOiAodHlwZW9mIGFyZzIgPT09ICdzdHJpbmcnID8gYXJnMiA6IHVuZGVmaW5lZCk7XG5cdFx0cmV0dXJuIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoc2VjdGlvbiwgeyByZXNvdXJjZSB9KTtcblx0fVxuXG5cdGluc3BlY3Q8VD4ocmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCwgcG9zaXRpb246IElQb3NpdGlvbiB8IG51bGwsIHNlY3Rpb246IHN0cmluZyk6IElDb25maWd1cmF0aW9uVmFsdWU8UmVhZG9ubHk8VD4+IHtcblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5pbnNwZWN0PFQ+KHNlY3Rpb24sIHsgcmVzb3VyY2UgfSk7XG5cdH1cblxuXHR1cGRhdGVWYWx1ZShyZXNvdXJjZTogVVJJLCBrZXk6IHN0cmluZywgdmFsdWU6IGFueSwgY29uZmlndXJhdGlvblRhcmdldD86IENvbmZpZ3VyYXRpb25UYXJnZXQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS51cGRhdGVWYWx1ZShrZXksIHZhbHVlKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgUmVtb3RlRmlsZVN5c3RlbVByb3ZpZGVyIGltcGxlbWVudHMgSUZpbGVTeXN0ZW1Qcm92aWRlciB7XG5cblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSB3cmFwcGVkRnNwOiBJRmlsZVN5c3RlbVByb3ZpZGVyLCBwcml2YXRlIHJlYWRvbmx5IHJlbW90ZUF1dGhvcml0eTogc3RyaW5nKSB7XG5cdFx0dGhpcy5jYXBhYmlsaXRpZXMgPSB0aGlzLndyYXBwZWRGc3AuY2FwYWJpbGl0aWVzO1xuXHRcdHRoaXMub25EaWRDaGFuZ2VDYXBhYmlsaXRpZXMgPSB0aGlzLndyYXBwZWRGc3Aub25EaWRDaGFuZ2VDYXBhYmlsaXRpZXM7XG5cdFx0dGhpcy5vbkRpZENoYW5nZUZpbGUgPSBFdmVudC5tYXAodGhpcy53cmFwcGVkRnNwLm9uRGlkQ2hhbmdlRmlsZSwgY2hhbmdlcyA9PiBjaGFuZ2VzLm1hcChjID0+IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHR5cGU6IGMudHlwZSxcblx0XHRcdFx0cmVzb3VyY2U6IGMucmVzb3VyY2Uud2l0aCh7IHNjaGVtZTogU2NoZW1hcy52c2NvZGVSZW1vdGUsIGF1dGhvcml0eTogdGhpcy5yZW1vdGVBdXRob3JpdHkgfSksXG5cdFx0XHR9O1xuXHRcdH0pKTtcblx0fVxuXG5cdHJlYWRvbmx5IGNhcGFiaWxpdGllczogRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUNhcGFiaWxpdGllczogRXZlbnQ8dm9pZD47XG5cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VGaWxlOiBFdmVudDxyZWFkb25seSBJRmlsZUNoYW5nZVtdPjtcblx0d2F0Y2gocmVzb3VyY2U6IFVSSSwgb3B0czogSVdhdGNoT3B0aW9ucyk6IElEaXNwb3NhYmxlIHsgcmV0dXJuIHRoaXMud3JhcHBlZEZzcC53YXRjaCh0aGlzLnRvRmlsZVJlc291cmNlKHJlc291cmNlKSwgb3B0cyk7IH1cblxuXHRzdGF0KHJlc291cmNlOiBVUkkpOiBQcm9taXNlPElTdGF0PiB7IHJldHVybiB0aGlzLndyYXBwZWRGc3Auc3RhdCh0aGlzLnRvRmlsZVJlc291cmNlKHJlc291cmNlKSk7IH1cblx0bWtkaXIocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8dm9pZD4geyByZXR1cm4gdGhpcy53cmFwcGVkRnNwLm1rZGlyKHRoaXMudG9GaWxlUmVzb3VyY2UocmVzb3VyY2UpKTsgfVxuXHRyZWFkZGlyKHJlc291cmNlOiBVUkkpOiBQcm9taXNlPFtzdHJpbmcsIEZpbGVUeXBlXVtdPiB7IHJldHVybiB0aGlzLndyYXBwZWRGc3AucmVhZGRpcih0aGlzLnRvRmlsZVJlc291cmNlKHJlc291cmNlKSk7IH1cblx0ZGVsZXRlKHJlc291cmNlOiBVUkksIG9wdHM6IElGaWxlRGVsZXRlT3B0aW9ucyk6IFByb21pc2U8dm9pZD4geyByZXR1cm4gdGhpcy53cmFwcGVkRnNwLmRlbGV0ZSh0aGlzLnRvRmlsZVJlc291cmNlKHJlc291cmNlKSwgb3B0cyk7IH1cblxuXHRyZW5hbWUoZnJvbTogVVJJLCB0bzogVVJJLCBvcHRzOiBJRmlsZU92ZXJ3cml0ZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHsgcmV0dXJuIHRoaXMud3JhcHBlZEZzcC5yZW5hbWUodGhpcy50b0ZpbGVSZXNvdXJjZShmcm9tKSwgdGhpcy50b0ZpbGVSZXNvdXJjZSh0byksIG9wdHMpOyB9XG5cdGNvcHkoZnJvbTogVVJJLCB0bzogVVJJLCBvcHRzOiBJRmlsZU92ZXJ3cml0ZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHsgcmV0dXJuIHRoaXMud3JhcHBlZEZzcC5jb3B5ISh0aGlzLnRvRmlsZVJlc291cmNlKGZyb20pLCB0aGlzLnRvRmlsZVJlc291cmNlKHRvKSwgb3B0cyk7IH1cblxuXHRyZWFkRmlsZShyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxVaW50OEFycmF5PiB7IHJldHVybiB0aGlzLndyYXBwZWRGc3AucmVhZEZpbGUhKHRoaXMudG9GaWxlUmVzb3VyY2UocmVzb3VyY2UpKTsgfVxuXHR3cml0ZUZpbGUocmVzb3VyY2U6IFVSSSwgY29udGVudDogVWludDhBcnJheSwgb3B0czogSUZpbGVXcml0ZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHsgcmV0dXJuIHRoaXMud3JhcHBlZEZzcC53cml0ZUZpbGUhKHRoaXMudG9GaWxlUmVzb3VyY2UocmVzb3VyY2UpLCBjb250ZW50LCBvcHRzKTsgfVxuXG5cdG9wZW4ocmVzb3VyY2U6IFVSSSwgb3B0czogSUZpbGVPcGVuT3B0aW9ucyk6IFByb21pc2U8bnVtYmVyPiB7IHJldHVybiB0aGlzLndyYXBwZWRGc3Aub3BlbiEodGhpcy50b0ZpbGVSZXNvdXJjZShyZXNvdXJjZSksIG9wdHMpOyB9XG5cdGNsb3NlKGZkOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHsgcmV0dXJuIHRoaXMud3JhcHBlZEZzcC5jbG9zZSEoZmQpOyB9XG5cdHJlYWQoZmQ6IG51bWJlciwgcG9zOiBudW1iZXIsIGRhdGE6IFVpbnQ4QXJyYXksIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlcik6IFByb21pc2U8bnVtYmVyPiB7IHJldHVybiB0aGlzLndyYXBwZWRGc3AucmVhZCEoZmQsIHBvcywgZGF0YSwgb2Zmc2V0LCBsZW5ndGgpOyB9XG5cdHdyaXRlKGZkOiBudW1iZXIsIHBvczogbnVtYmVyLCBkYXRhOiBVaW50OEFycmF5LCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpOiBQcm9taXNlPG51bWJlcj4geyByZXR1cm4gdGhpcy53cmFwcGVkRnNwLndyaXRlIShmZCwgcG9zLCBkYXRhLCBvZmZzZXQsIGxlbmd0aCk7IH1cblxuXHRyZWFkRmlsZVN0cmVhbShyZXNvdXJjZTogVVJJLCBvcHRzOiBJRmlsZVJlYWRTdHJlYW1PcHRpb25zLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBSZWFkYWJsZVN0cmVhbUV2ZW50czxVaW50OEFycmF5PiB7IHJldHVybiB0aGlzLndyYXBwZWRGc3AucmVhZEZpbGVTdHJlYW0hKHRoaXMudG9GaWxlUmVzb3VyY2UocmVzb3VyY2UpLCBvcHRzLCB0b2tlbik7IH1cblxuXHRwcml2YXRlIHRvRmlsZVJlc291cmNlKHJlc291cmNlOiBVUkkpOiBVUkkgeyByZXR1cm4gcmVzb3VyY2Uud2l0aCh7IHNjaGVtZTogU2NoZW1hcy5maWxlLCBhdXRob3JpdHk6ICcnIH0pOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0SW5NZW1vcnlGaWxlU3lzdGVtUHJvdmlkZXIgZXh0ZW5kcyBJbk1lbW9yeUZpbGVTeXN0ZW1Qcm92aWRlciBpbXBsZW1lbnRzIElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZVJlYWRTdHJlYW1DYXBhYmlsaXR5IHtcblx0b3ZlcnJpZGUgZ2V0IGNhcGFiaWxpdGllcygpOiBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMge1xuXHRcdHJldHVybiBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuRmlsZVJlYWRXcml0ZVxuXHRcdFx0fCBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuUGF0aENhc2VTZW5zaXRpdmVcblx0XHRcdHwgRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLkZpbGVSZWFkU3RyZWFtO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVhZEZpbGVTdHJlYW0ocmVzb3VyY2U6IFVSSSk6IFJlYWRhYmxlU3RyZWFtRXZlbnRzPFVpbnQ4QXJyYXk+IHtcblx0XHRjb25zdCBCVUZGRVJfU0laRSA9IDY0ICogMTAyNDtcblx0XHRjb25zdCBzdHJlYW0gPSBuZXdXcml0ZWFibGVTdHJlYW08VWludDhBcnJheT4oZGF0YSA9PiBWU0J1ZmZlci5jb25jYXQoZGF0YS5tYXAoZGF0YSA9PiBWU0J1ZmZlci53cmFwKGRhdGEpKSkuYnVmZmVyKTtcblxuXHRcdChhc3luYyAoKSA9PiB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRjb25zdCBkYXRhID0gYXdhaXQgdGhpcy5yZWFkRmlsZShyZXNvdXJjZSk7XG5cblx0XHRcdFx0bGV0IG9mZnNldCA9IDA7XG5cdFx0XHRcdHdoaWxlIChvZmZzZXQgPCBkYXRhLmxlbmd0aCkge1xuXHRcdFx0XHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0XHRcdFx0YXdhaXQgc3RyZWFtLndyaXRlKGRhdGEuc3ViYXJyYXkob2Zmc2V0LCBvZmZzZXQgKyBCVUZGRVJfU0laRSkpO1xuXHRcdFx0XHRcdG9mZnNldCArPSBCVUZGRVJfU0laRTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0XHRcdHN0cmVhbS5lbmQoKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdHN0cmVhbS5lbmQoZXJyb3IpO1xuXHRcdFx0fVxuXHRcdH0pKCk7XG5cblx0XHRyZXR1cm4gc3RyZWFtO1xuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlID0geyBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQsIC4uLnByb2R1Y3QgfTtcblxuZXhwb3J0IGNsYXNzIFRlc3RIb3N0U2VydmljZSBpbXBsZW1lbnRzIElIb3N0U2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfaGFzRm9jdXMgPSB0cnVlO1xuXHRnZXQgaGFzRm9jdXMoKSB7IHJldHVybiB0aGlzLl9oYXNGb2N1czsgfVxuXHRhc3luYyBoYWRMYXN0Rm9jdXMoKTogUHJvbWlzZTxib29sZWFuPiB7IHJldHVybiB0aGlzLl9oYXNGb2N1czsgfVxuXG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlRm9jdXMgPSBuZXcgRW1pdHRlcjxib29sZWFuPigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUZvY3VzID0gdGhpcy5fb25EaWRDaGFuZ2VGb2N1cy5ldmVudDtcblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZVdpbmRvdyA9IG5ldyBFbWl0dGVyPG51bWJlcj4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VBY3RpdmVXaW5kb3cgPSB0aGlzLl9vbkRpZENoYW5nZVdpbmRvdy5ldmVudDtcblxuXHRyZWFkb25seSBvbkRpZENoYW5nZUZ1bGxTY3JlZW46IEV2ZW50PHsgd2luZG93SWQ6IG51bWJlcjsgZnVsbHNjcmVlbjogYm9vbGVhbiB9PiA9IEV2ZW50Lk5vbmU7XG5cblx0c2V0Rm9jdXMoZm9jdXM6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl9oYXNGb2N1cyA9IGZvY3VzO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlRm9jdXMuZmlyZSh0aGlzLl9oYXNGb2N1cyk7XG5cdH1cblxuXHRhc3luYyByZXN0YXJ0KCk6IFByb21pc2U8dm9pZD4geyB9XG5cdGFzeW5jIHJlbG9hZCgpOiBQcm9taXNlPHZvaWQ+IHsgfVxuXHRhc3luYyBjbG9zZSgpOiBQcm9taXNlPHZvaWQ+IHsgfVxuXHRhc3luYyB3aXRoRXhwZWN0ZWRTaHV0ZG93bjxUPihleHBlY3RlZFNodXRkb3duVGFzazogKCkgPT4gUHJvbWlzZTxUPik6IFByb21pc2U8VD4ge1xuXHRcdHJldHVybiBhd2FpdCBleHBlY3RlZFNodXRkb3duVGFzaygpO1xuXHR9XG5cblx0YXN5bmMgZm9jdXMoKTogUHJvbWlzZTx2b2lkPiB7IH1cblx0YXN5bmMgbW92ZVRvcCgpOiBQcm9taXNlPHZvaWQ+IHsgfVxuXHRhc3luYyBnZXRDdXJzb3JTY3JlZW5Qb2ludCgpOiBQcm9taXNlPHVuZGVmaW5lZD4geyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cblx0YXN5bmMgb3BlbldpbmRvdyhhcmcxPzogSU9wZW5FbXB0eVdpbmRvd09wdGlvbnMgfCBJV2luZG93T3BlbmFibGVbXSwgYXJnMj86IElPcGVuV2luZG93T3B0aW9ucyk6IFByb21pc2U8dm9pZD4geyB9XG5cblx0YXN5bmMgdG9nZ2xlRnVsbFNjcmVlbigpOiBQcm9taXNlPHZvaWQ+IHsgfVxuXG5cdGFzeW5jIGdldFNjcmVlbnNob3QoKTogUHJvbWlzZTxBcnJheUJ1ZmZlckxpa2UgfCB1bmRlZmluZWQ+IHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXG5cdGFzeW5jIGdldE5hdGl2ZVdpbmRvd0hhbmRsZShfd2luZG93SWQ6IG51bWJlcik6IFByb21pc2U8VlNCdWZmZXIgfCB1bmRlZmluZWQ+IHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXG5cdHJlYWRvbmx5IGNvbG9yU2NoZW1lID0gQ29sb3JTY2hlbWUuREFSSztcblx0b25EaWRDaGFuZ2VDb2xvclNjaGVtZSA9IEV2ZW50Lk5vbmU7XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0RmlsZXNDb25maWd1cmF0aW9uU2VydmljZSBleHRlbmRzIEZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2Uge1xuXG5cdHRlc3RPbkZpbGVzQ29uZmlndXJhdGlvbkNoYW5nZShjb25maWd1cmF0aW9uOiBhbnkpOiB2b2lkIHtcblx0XHRzdXBlci5vbkZpbGVzQ29uZmlndXJhdGlvbkNoYW5nZShjb25maWd1cmF0aW9uLCB0cnVlKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVGVzdFJlYWRvbmx5VGV4dEZpbGVFZGl0b3JNb2RlbCBleHRlbmRzIFRleHRGaWxlRWRpdG9yTW9kZWwge1xuXG5cdG92ZXJyaWRlIGlzUmVhZG9ubHkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RFZGl0b3JJbnB1dCBleHRlbmRzIEVkaXRvcklucHV0IHtcblxuXHRjb25zdHJ1Y3RvcihwdWJsaWMgcmVzb3VyY2U6IFVSSSwgcHJpdmF0ZSByZWFkb25seSBfdHlwZUlkOiBzdHJpbmcpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0IHR5cGVJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl90eXBlSWQ7XG5cdH1cblxuXHRvdmVycmlkZSBnZXQgZWRpdG9ySWQoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5fdHlwZUlkO1xuXHR9XG5cblx0b3ZlcnJpZGUgcmVzb2x2ZSgpOiBQcm9taXNlPElEaXNwb3NhYmxlIHwgbnVsbD4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyVGVzdEVkaXRvcihpZDogc3RyaW5nLCBpbnB1dHM6IFN5bmNEZXNjcmlwdG9yPEVkaXRvcklucHV0PltdLCBzZXJpYWxpemVySW5wdXRJZD86IHN0cmluZyk6IElEaXNwb3NhYmxlIHtcblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0Y2xhc3MgVGVzdEVkaXRvciBleHRlbmRzIEVkaXRvclBhbmUge1xuXG5cdFx0cHJpdmF0ZSBfc2NvcGVkQ29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZTtcblxuXHRcdGNvbnN0cnVjdG9yKGdyb3VwOiBJRWRpdG9yR3JvdXApIHtcblx0XHRcdHN1cGVyKGlkLCBncm91cCwgTnVsbFRlbGVtZXRyeVNlcnZpY2UsIG5ldyBUZXN0VGhlbWVTZXJ2aWNlKCksIGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdFN0b3JhZ2VTZXJ2aWNlKCkpKTtcblx0XHRcdHRoaXMuX3Njb3BlZENvbnRleHRLZXlTZXJ2aWNlID0gbmV3IE1vY2tDb250ZXh0S2V5U2VydmljZSgpO1xuXHRcdH1cblxuXHRcdG92ZXJyaWRlIGFzeW5jIHNldElucHV0KGlucHV0OiBFZGl0b3JJbnB1dCwgb3B0aW9uczogSUVkaXRvck9wdGlvbnMgfCB1bmRlZmluZWQsIGNvbnRleHQ6IElFZGl0b3JPcGVuQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRzdXBlci5zZXRJbnB1dChpbnB1dCwgb3B0aW9ucywgY29udGV4dCwgdG9rZW4pO1xuXG5cdFx0XHRhd2FpdCBpbnB1dC5yZXNvbHZlKCk7XG5cdFx0fVxuXG5cdFx0b3ZlcnJpZGUgZ2V0SWQoKTogc3RyaW5nIHsgcmV0dXJuIGlkOyB9XG5cdFx0bGF5b3V0KCk6IHZvaWQgeyB9XG5cdFx0cHJvdGVjdGVkIGNyZWF0ZUVkaXRvcigpOiB2b2lkIHsgfVxuXG5cdFx0b3ZlcnJpZGUgZ2V0IHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKCkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3Njb3BlZENvbnRleHRLZXlTZXJ2aWNlO1xuXHRcdH1cblx0fVxuXG5cdGRpc3Bvc2FibGVzLmFkZChSZWdpc3RyeS5hczxJRWRpdG9yUGFuZVJlZ2lzdHJ5PihFeHRlbnNpb25zLkVkaXRvclBhbmUpLnJlZ2lzdGVyRWRpdG9yUGFuZShFZGl0b3JQYW5lRGVzY3JpcHRvci5jcmVhdGUoVGVzdEVkaXRvciwgaWQsICdUZXN0IEVkaXRvciBDb250cm9sJyksIGlucHV0cykpO1xuXG5cdGlmIChzZXJpYWxpemVySW5wdXRJZCkge1xuXG5cdFx0aW50ZXJmYWNlIElTZXJpYWxpemVkVGVzdElucHV0IHtcblx0XHRcdHJlc291cmNlOiBzdHJpbmc7XG5cdFx0fVxuXG5cdFx0Y2xhc3MgRWRpdG9yc09ic2VydmVyVGVzdEVkaXRvcklucHV0U2VyaWFsaXplciBpbXBsZW1lbnRzIElFZGl0b3JTZXJpYWxpemVyIHtcblxuXHRcdFx0Y2FuU2VyaWFsaXplKGVkaXRvcklucHV0OiBFZGl0b3JJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0c2VyaWFsaXplKGVkaXRvcklucHV0OiBFZGl0b3JJbnB1dCk6IHN0cmluZyB7XG5cdFx0XHRcdGNvbnN0IHRlc3RFZGl0b3JJbnB1dCA9IDxUZXN0RmlsZUVkaXRvcklucHV0PmVkaXRvcklucHV0O1xuXHRcdFx0XHRjb25zdCB0ZXN0SW5wdXQ6IElTZXJpYWxpemVkVGVzdElucHV0ID0ge1xuXHRcdFx0XHRcdHJlc291cmNlOiB0ZXN0RWRpdG9ySW5wdXQucmVzb3VyY2UudG9TdHJpbmcoKVxuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdHJldHVybiBKU09OLnN0cmluZ2lmeSh0ZXN0SW5wdXQpO1xuXHRcdFx0fVxuXG5cdFx0XHRkZXNlcmlhbGl6ZShpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBzZXJpYWxpemVkRWRpdG9ySW5wdXQ6IHN0cmluZyk6IEVkaXRvcklucHV0IHtcblx0XHRcdFx0Y29uc3QgdGVzdElucHV0OiBJU2VyaWFsaXplZFRlc3RJbnB1dCA9IEpTT04ucGFyc2Uoc2VyaWFsaXplZEVkaXRvcklucHV0KTtcblxuXHRcdFx0XHRyZXR1cm4gbmV3IFRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKHRlc3RJbnB1dC5yZXNvdXJjZSksIHNlcmlhbGl6ZXJJbnB1dElkISk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKFJlZ2lzdHJ5LmFzPElFZGl0b3JGYWN0b3J5UmVnaXN0cnk+KEVkaXRvckV4dGVuc2lvbnMuRWRpdG9yRmFjdG9yeSkucmVnaXN0ZXJFZGl0b3JTZXJpYWxpemVyKHNlcmlhbGl6ZXJJbnB1dElkLCBFZGl0b3JzT2JzZXJ2ZXJUZXN0RWRpdG9ySW5wdXRTZXJpYWxpemVyKSk7XG5cdH1cblxuXHRyZXR1cm4gZGlzcG9zYWJsZXM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclRlc3RGaWxlRWRpdG9yKCk6IElEaXNwb3NhYmxlIHtcblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0ZGlzcG9zYWJsZXMuYWRkKFJlZ2lzdHJ5LmFzPElFZGl0b3JQYW5lUmVnaXN0cnk+KEV4dGVuc2lvbnMuRWRpdG9yUGFuZSkucmVnaXN0ZXJFZGl0b3JQYW5lKFxuXHRcdEVkaXRvclBhbmVEZXNjcmlwdG9yLmNyZWF0ZShcblx0XHRcdFRlc3RUZXh0RmlsZUVkaXRvcixcblx0XHRcdFRlc3RUZXh0RmlsZUVkaXRvci5JRCxcblx0XHRcdCdUZXh0IEZpbGUgRWRpdG9yJ1xuXHRcdCksXG5cdFx0W25ldyBTeW5jRGVzY3JpcHRvcihGaWxlRWRpdG9ySW5wdXQpXVxuXHQpKTtcblxuXHRyZXR1cm4gZGlzcG9zYWJsZXM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclRlc3RSZXNvdXJjZUVkaXRvcigpOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdGRpc3Bvc2FibGVzLmFkZChSZWdpc3RyeS5hczxJRWRpdG9yUGFuZVJlZ2lzdHJ5PihFeHRlbnNpb25zLkVkaXRvclBhbmUpLnJlZ2lzdGVyRWRpdG9yUGFuZShcblx0XHRFZGl0b3JQYW5lRGVzY3JpcHRvci5jcmVhdGUoXG5cdFx0XHRUZXN0VGV4dFJlc291cmNlRWRpdG9yLFxuXHRcdFx0VGVzdFRleHRSZXNvdXJjZUVkaXRvci5JRCxcblx0XHRcdCdUZXh0IEVkaXRvcidcblx0XHQpLFxuXHRcdFtcblx0XHRcdG5ldyBTeW5jRGVzY3JpcHRvcihVbnRpdGxlZFRleHRFZGl0b3JJbnB1dCksXG5cdFx0XHRuZXcgU3luY0Rlc2NyaXB0b3IoVGV4dFJlc291cmNlRWRpdG9ySW5wdXQpXG5cdFx0XVxuXHQpKTtcblxuXHRyZXR1cm4gZGlzcG9zYWJsZXM7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclRlc3RTaWRlQnlTaWRlRWRpdG9yKCk6IElEaXNwb3NhYmxlIHtcblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0ZGlzcG9zYWJsZXMuYWRkKFJlZ2lzdHJ5LmFzPElFZGl0b3JQYW5lUmVnaXN0cnk+KEV4dGVuc2lvbnMuRWRpdG9yUGFuZSkucmVnaXN0ZXJFZGl0b3JQYW5lKFxuXHRcdEVkaXRvclBhbmVEZXNjcmlwdG9yLmNyZWF0ZShcblx0XHRcdFNpZGVCeVNpZGVFZGl0b3IsXG5cdFx0XHRTaWRlQnlTaWRlRWRpdG9yLklELFxuXHRcdFx0J1RleHQgRWRpdG9yJ1xuXHRcdCksXG5cdFx0W1xuXHRcdFx0bmV3IFN5bmNEZXNjcmlwdG9yKFNpZGVCeVNpZGVFZGl0b3JJbnB1dClcblx0XHRdXG5cdCkpO1xuXG5cdHJldHVybiBkaXNwb3NhYmxlcztcbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RGaWxlRWRpdG9ySW5wdXQgZXh0ZW5kcyBFZGl0b3JJbnB1dCBpbXBsZW1lbnRzIElGaWxlRWRpdG9ySW5wdXQge1xuXG5cdHJlYWRvbmx5IHByZWZlcnJlZFJlc291cmNlO1xuXG5cdGdvdERpc3Bvc2VkID0gZmFsc2U7XG5cdGdvdFNhdmVkID0gZmFsc2U7XG5cdGdvdFNhdmVkQXMgPSBmYWxzZTtcblx0Z290UmV2ZXJ0ZWQgPSBmYWxzZTtcblx0ZGlydHkgPSBmYWxzZTtcblx0bW9kaWZpZWQ6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZmFpbHMgPSBmYWxzZTtcblxuXHRkaXNhYmxlVG9VbnR5cGVkID0gZmFsc2U7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlc291cmNlOiBVUkksXG5cdFx0cHJpdmF0ZSBfdHlwZUlkOiBzdHJpbmdcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMucHJlZmVycmVkUmVzb3VyY2UgPSB0aGlzLnJlc291cmNlO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0IHR5cGVJZCgpIHsgcmV0dXJuIHRoaXMuX3R5cGVJZDsgfVxuXHRvdmVycmlkZSBnZXQgZWRpdG9ySWQoKSB7IHJldHVybiB0aGlzLl90eXBlSWQ7IH1cblxuXHRwcml2YXRlIF9jYXBhYmlsaXRpZXM6IEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzID0gRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuTm9uZTtcblx0b3ZlcnJpZGUgZ2V0IGNhcGFiaWxpdGllcygpOiBFZGl0b3JJbnB1dENhcGFiaWxpdGllcyB7IHJldHVybiB0aGlzLl9jYXBhYmlsaXRpZXM7IH1cblx0b3ZlcnJpZGUgc2V0IGNhcGFiaWxpdGllcyhjYXBhYmlsaXRpZXM6IEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzKSB7XG5cdFx0aWYgKHRoaXMuX2NhcGFiaWxpdGllcyAhPT0gY2FwYWJpbGl0aWVzKSB7XG5cdFx0XHR0aGlzLl9jYXBhYmlsaXRpZXMgPSBjYXBhYmlsaXRpZXM7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUNhcGFiaWxpdGllcy5maXJlKCk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgcmVzb2x2ZSgpOiBQcm9taXNlPElEaXNwb3NhYmxlIHwgbnVsbD4geyByZXR1cm4gIXRoaXMuZmFpbHMgPyBQcm9taXNlLnJlc29sdmUobnVsbCkgOiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ2ZhaWxzJykpOyB9XG5cdG92ZXJyaWRlIG1hdGNoZXMob3RoZXI6IEVkaXRvcklucHV0IHwgSVJlc291cmNlRWRpdG9ySW5wdXQgfCBJVGV4dFJlc291cmNlRWRpdG9ySW5wdXQgfCBJVW50aXRsZWRUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdGlmIChzdXBlci5tYXRjaGVzKG90aGVyKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmIChvdGhlciBpbnN0YW5jZW9mIEVkaXRvcklucHV0KSB7XG5cdFx0XHRyZXR1cm4gISEob3RoZXI/LnJlc291cmNlICYmIHRoaXMucmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gb3RoZXIucmVzb3VyY2UudG9TdHJpbmcoKSAmJiBvdGhlciBpbnN0YW5jZW9mIFRlc3RGaWxlRWRpdG9ySW5wdXQgJiYgb3RoZXIudHlwZUlkID09PSB0aGlzLnR5cGVJZCk7XG5cdFx0fVxuXHRcdHJldHVybiBpc0VxdWFsKHRoaXMucmVzb3VyY2UsIG90aGVyLnJlc291cmNlKSAmJiAodGhpcy5lZGl0b3JJZCA9PT0gb3RoZXIub3B0aW9ucz8ub3ZlcnJpZGUgfHwgb3RoZXIub3B0aW9ucz8ub3ZlcnJpZGUgPT09IHVuZGVmaW5lZCk7XG5cdH1cblx0c2V0UHJlZmVycmVkUmVzb3VyY2UocmVzb3VyY2U6IFVSSSk6IHZvaWQgeyB9XG5cdGFzeW5jIHNldEVuY29kaW5nKGVuY29kaW5nOiBzdHJpbmcpIHsgfVxuXHRnZXRFbmNvZGluZygpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRzZXRQcmVmZXJyZWROYW1lKG5hbWU6IHN0cmluZyk6IHZvaWQgeyB9XG5cdHNldFByZWZlcnJlZERlc2NyaXB0aW9uKGRlc2NyaXB0aW9uOiBzdHJpbmcpOiB2b2lkIHsgfVxuXHRzZXRQcmVmZXJyZWRFbmNvZGluZyhlbmNvZGluZzogc3RyaW5nKSB7IH1cblx0c2V0UHJlZmVycmVkQ29udGVudHMoY29udGVudHM6IHN0cmluZyk6IHZvaWQgeyB9XG5cdHNldExhbmd1YWdlSWQobGFuZ3VhZ2VJZDogc3RyaW5nLCBzb3VyY2U/OiBzdHJpbmcpIHsgfVxuXHRzZXRQcmVmZXJyZWRMYW5ndWFnZUlkKGxhbmd1YWdlSWQ6IHN0cmluZykgeyB9XG5cdHNldEZvcmNlT3BlbkFzQmluYXJ5KCk6IHZvaWQgeyB9XG5cdHNldEZhaWxUb09wZW4oKTogdm9pZCB7XG5cdFx0dGhpcy5mYWlscyA9IHRydWU7XG5cdH1cblx0b3ZlcnJpZGUgYXN5bmMgc2F2ZShncm91cElkOiBHcm91cElkZW50aWZpZXIsIG9wdGlvbnM/OiBJU2F2ZU9wdGlvbnMpOiBQcm9taXNlPEVkaXRvcklucHV0IHwgdW5kZWZpbmVkPiB7XG5cdFx0dGhpcy5nb3RTYXZlZCA9IHRydWU7XG5cdFx0dGhpcy5kaXJ0eSA9IGZhbHNlO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cdG92ZXJyaWRlIGFzeW5jIHNhdmVBcyhncm91cElkOiBHcm91cElkZW50aWZpZXIsIG9wdGlvbnM/OiBJU2F2ZU9wdGlvbnMpOiBQcm9taXNlPEVkaXRvcklucHV0IHwgdW5kZWZpbmVkPiB7XG5cdFx0dGhpcy5nb3RTYXZlZEFzID0gdHJ1ZTtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXHRvdmVycmlkZSBhc3luYyByZXZlcnQoZ3JvdXA6IEdyb3VwSWRlbnRpZmllciwgb3B0aW9ucz86IElSZXZlcnRPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5nb3RSZXZlcnRlZCA9IHRydWU7XG5cdFx0dGhpcy5nb3RTYXZlZCA9IGZhbHNlO1xuXHRcdHRoaXMuZ290U2F2ZWRBcyA9IGZhbHNlO1xuXHRcdHRoaXMuZGlydHkgPSBmYWxzZTtcblx0fVxuXHRvdmVycmlkZSB0b1VudHlwZWQoKTogSVVudHlwZWRFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMuZGlzYWJsZVRvVW50eXBlZCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHsgcmVzb3VyY2U6IHRoaXMucmVzb3VyY2UgfTtcblx0fVxuXHRzZXRNb2RpZmllZCgpOiB2b2lkIHsgdGhpcy5tb2RpZmllZCA9IHRydWU7IH1cblx0b3ZlcnJpZGUgaXNNb2RpZmllZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5tb2RpZmllZCA9PT0gdW5kZWZpbmVkID8gdGhpcy5kaXJ0eSA6IHRoaXMubW9kaWZpZWQ7XG5cdH1cblx0c2V0RGlydHkoKTogdm9pZCB7IHRoaXMuZGlydHkgPSB0cnVlOyB9XG5cdG92ZXJyaWRlIGlzRGlydHkoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuZGlydHk7XG5cdH1cblx0aXNSZXNvbHZlZCgpOiBib29sZWFuIHsgcmV0dXJuIGZhbHNlOyB9XG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHRcdHRoaXMuZ290RGlzcG9zZWQgPSB0cnVlO1xuXHR9XG5cdG1vdmVkRWRpdG9yOiBJTW92ZVJlc3VsdCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0b3ZlcnJpZGUgYXN5bmMgcmVuYW1lKCk6IFByb21pc2U8SU1vdmVSZXN1bHQgfCB1bmRlZmluZWQ+IHsgcmV0dXJuIHRoaXMubW92ZWRFZGl0b3I7IH1cblxuXHRwcml2YXRlIG1vdmVEaXNhYmxlZFJlYXNvbjogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRzZXRNb3ZlRGlzYWJsZWQocmVhc29uOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLm1vdmVEaXNhYmxlZFJlYXNvbiA9IHJlYXNvbjtcblx0fVxuXG5cdG92ZXJyaWRlIGNhbk1vdmUoc291cmNlR3JvdXA6IEdyb3VwSWRlbnRpZmllciwgdGFyZ2V0R3JvdXA6IEdyb3VwSWRlbnRpZmllcik6IHN0cmluZyB8IHRydWUge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5tb3ZlRGlzYWJsZWRSZWFzb24gPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5tb3ZlRGlzYWJsZWRSZWFzb247XG5cdFx0fVxuXHRcdHJldHVybiBzdXBlci5jYW5Nb3ZlKHNvdXJjZUdyb3VwLCB0YXJnZXRHcm91cCk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RTaW5nbGV0b25GaWxlRWRpdG9ySW5wdXQgZXh0ZW5kcyBUZXN0RmlsZUVkaXRvcklucHV0IHtcblxuXHRvdmVycmlkZSBnZXQgY2FwYWJpbGl0aWVzKCk6IEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzIHsgcmV0dXJuIEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLlNpbmdsZXRvbjsgfVxufVxuXG5leHBvcnQgY2xhc3MgVGVzdEVkaXRvclBhcnQgZXh0ZW5kcyBNYWluRWRpdG9yUGFydCBpbXBsZW1lbnRzIElFZGl0b3JHcm91cHNTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRyZWFkb25seSBtYWluUGFydCA9IHRoaXM7XG5cdHJlYWRvbmx5IHBhcnRzOiByZWFkb25seSBJRWRpdG9yUGFydFtdID0gW3RoaXNdO1xuXG5cdHJlYWRvbmx5IG9uRGlkQ3JlYXRlQXV4aWxpYXJ5RWRpdG9yUGFydDogRXZlbnQ8SUF1eGlsaWFyeUVkaXRvclBhcnQ+ID0gRXZlbnQuTm9uZTtcblxuXHR0ZXN0U2F2ZVN0YXRlKCk6IHZvaWQge1xuXHRcdHJldHVybiBzdXBlci5zYXZlU3RhdGUoKTtcblx0fVxuXG5cdGNsZWFyU3RhdGUoKTogdm9pZCB7XG5cdFx0Y29uc3Qgd29ya3NwYWNlTWVtZW50byA9IHRoaXMuZ2V0TWVtZW50byhTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKHdvcmtzcGFjZU1lbWVudG8pKSB7XG5cdFx0XHRkZWxldGUgd29ya3NwYWNlTWVtZW50b1trZXldO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByb2ZpbGVNZW1lbnRvID0gdGhpcy5nZXRNZW1lbnRvKFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKHByb2ZpbGVNZW1lbnRvKSkge1xuXHRcdFx0ZGVsZXRlIHByb2ZpbGVNZW1lbnRvW2tleV07XG5cdFx0fVxuXHR9XG5cblx0cmVnaXN0ZXJFZGl0b3JQYXJ0KHBhcnQ6IElFZGl0b3JQYXJ0KTogSURpc3Bvc2FibGUge1xuXHRcdHJldHVybiBEaXNwb3NhYmxlLk5vbmU7XG5cdH1cblxuXHRjcmVhdGVBdXhpbGlhcnlFZGl0b3JQYXJ0KCk6IFByb21pc2U8SUF1eGlsaWFyeUVkaXRvclBhcnQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblxuXHRnZXRTY29wZWRJbnN0YW50aWF0aW9uU2VydmljZShwYXJ0OiBJRWRpdG9yUGFydCk6IElJbnN0YW50aWF0aW9uU2VydmljZSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cblx0Z2V0UGFydChncm91cDogbnVtYmVyIHwgSUVkaXRvckdyb3VwKTogSUVkaXRvclBhcnQgeyByZXR1cm4gdGhpczsgfVxuXG5cdHNhdmVXb3JraW5nU2V0KG5hbWU6IHN0cmluZyk6IElFZGl0b3JXb3JraW5nU2V0IHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdGdldFdvcmtpbmdTZXRzKCk6IElFZGl0b3JXb3JraW5nU2V0W10geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0YXBwbHlXb3JraW5nU2V0KHdvcmtpbmdTZXQ6IElFZGl0b3JXb3JraW5nU2V0IHwgJ2VtcHR5Jywgb3B0aW9ucz86IElFZGl0b3JXb3JraW5nU2V0T3B0aW9ucyk6IFByb21pc2U8Ym9vbGVhbj4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0ZGVsZXRlV29ya2luZ1NldCh3b3JraW5nU2V0OiBJRWRpdG9yV29ya2luZ1NldCk6IFByb21pc2U8Ym9vbGVhbj4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblxuXHRyZWdpc3RlckNvbnRleHRLZXlQcm92aWRlcjxUIGV4dGVuZHMgQ29udGV4dEtleVZhbHVlPihwcm92aWRlcjogSUVkaXRvckdyb3VwQ29udGV4dEtleVByb3ZpZGVyPFQ+KTogSURpc3Bvc2FibGUgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RFZGl0b3JQYXJ0cyBleHRlbmRzIEVkaXRvclBhcnRzIHtcblx0dGVzdE1haW5QYXJ0ITogVGVzdEVkaXRvclBhcnQ7XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGNyZWF0ZU1haW5FZGl0b3JQYXJ0KCk6IE1haW5FZGl0b3JQYXJ0IHtcblx0XHR0aGlzLnRlc3RNYWluUGFydCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdEVkaXRvclBhcnQsIHRoaXMpO1xuXG5cdFx0cmV0dXJuIHRoaXMudGVzdE1haW5QYXJ0O1xuXHR9XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjcmVhdGVFZGl0b3JQYXJ0cyhpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlKTogUHJvbWlzZTxUZXN0RWRpdG9yUGFydHM+IHtcblx0Y29uc3QgcGFydHMgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0RWRpdG9yUGFydHMpO1xuXHRjb25zdCBwYXJ0ID0gZGlzcG9zYWJsZXMuYWRkKHBhcnRzKS50ZXN0TWFpblBhcnQ7XG5cdHBhcnQuY3JlYXRlKGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpKTtcblx0cGFydC5sYXlvdXQoMTA4MCwgODAwLCAwLCAwKTtcblxuXHRhd2FpdCBwYXJ0cy53aGVuUmVhZHk7XG5cblx0cmV0dXJuIHBhcnRzO1xufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY3JlYXRlRWRpdG9yUGFydChpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlKTogUHJvbWlzZTxUZXN0RWRpdG9yUGFydD4ge1xuXHRyZXR1cm4gKGF3YWl0IGNyZWF0ZUVkaXRvclBhcnRzKGluc3RhbnRpYXRpb25TZXJ2aWNlLCBkaXNwb3NhYmxlcykpLnRlc3RNYWluUGFydDtcbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RMaXN0U2VydmljZSBpbXBsZW1lbnRzIElMaXN0U2VydmljZSB7XG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdGxhc3RGb2N1c2VkTGlzdDogYW55IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdHJlZ2lzdGVyKCk6IElEaXNwb3NhYmxlIHtcblx0XHRyZXR1cm4gRGlzcG9zYWJsZS5Ob25lO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0UGF0aFNlcnZpY2UgaW1wbGVtZW50cyBJUGF0aFNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKHByaXZhdGUgcmVhZG9ubHkgZmFsbGJhY2tVc2VySG9tZTogVVJJID0gVVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMuZmlsZSwgcGF0aDogJy8nIH0pLCBwdWJsaWMgZGVmYXVsdFVyaVNjaGVtZSA9IFNjaGVtYXMuZmlsZSkgeyB9XG5cblx0aGFzVmFsaWRCYXNlbmFtZShyZXNvdXJjZTogVVJJLCBiYXNlbmFtZT86IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj47XG5cdGhhc1ZhbGlkQmFzZW5hbWUocmVzb3VyY2U6IFVSSSwgb3M6IE9wZXJhdGluZ1N5c3RlbSwgYmFzZW5hbWU/OiBzdHJpbmcpOiBib29sZWFuO1xuXHRoYXNWYWxpZEJhc2VuYW1lKHJlc291cmNlOiBVUkksIGFyZzI/OiBzdHJpbmcgfCBPcGVyYXRpbmdTeXN0ZW0sIG5hbWU/OiBzdHJpbmcpOiBib29sZWFuIHwgUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0aWYgKHR5cGVvZiBhcmcyID09PSAnc3RyaW5nJyB8fCB0eXBlb2YgYXJnMiA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdHJldHVybiBpc1ZhbGlkQmFzZW5hbWUoYXJnMiA/PyBiYXNlbmFtZShyZXNvdXJjZSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBpc1ZhbGlkQmFzZW5hbWUobmFtZSA/PyBiYXNlbmFtZShyZXNvdXJjZSkpO1xuXHR9XG5cblx0Z2V0IHBhdGgoKSB7IHJldHVybiBQcm9taXNlLnJlc29sdmUoaXNXaW5kb3dzID8gd2luMzIgOiBwb3NpeCk7IH1cblxuXHR1c2VySG9tZShvcHRpb25zPzogeyBwcmVmZXJMb2NhbDogYm9vbGVhbiB9KTogUHJvbWlzZTxVUkk+O1xuXHR1c2VySG9tZShvcHRpb25zOiB7IHByZWZlckxvY2FsOiB0cnVlIH0pOiBVUkk7XG5cdHVzZXJIb21lKG9wdGlvbnM/OiB7IHByZWZlckxvY2FsOiBib29sZWFuIH0pOiBQcm9taXNlPFVSST4gfCBVUkkge1xuXHRcdHJldHVybiBvcHRpb25zPy5wcmVmZXJMb2NhbCA/IHRoaXMuZmFsbGJhY2tVc2VySG9tZSA6IFByb21pc2UucmVzb2x2ZSh0aGlzLmZhbGxiYWNrVXNlckhvbWUpO1xuXHR9XG5cblx0Z2V0IHJlc29sdmVkVXNlckhvbWUoKSB7IHJldHVybiB0aGlzLmZhbGxiYWNrVXNlckhvbWU7IH1cblxuXHRhc3luYyBmaWxlVVJJKHBhdGg6IHN0cmluZyk6IFByb21pc2U8VVJJPiB7XG5cdFx0cmV0dXJuIFVSSS5maWxlKHBhdGgpO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRlc3RUZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlciBleHRlbmRzIElUZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlciwgSURpc3Bvc2FibGUge1xuXHRhZGQocmVzb3VyY2U6IFVSSSwgbW9kZWw6IFRleHRGaWxlRWRpdG9yTW9kZWwpOiB2b2lkO1xuXHRyZW1vdmUocmVzb3VyY2U6IFVSSSk6IHZvaWQ7XG59XG5cbmludGVyZmFjZSBJVGVzdFRleHRGaWxlRWRpdG9yTW9kZWwgZXh0ZW5kcyBJVGV4dEZpbGVFZGl0b3JNb2RlbCB7XG5cdHJlYWRvbmx5IGxhc3RSZXNvbHZlZEZpbGVTdGF0OiBJRmlsZVN0YXRXaXRoTWV0YWRhdGEgfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRMYXN0UmVzb2x2ZWRGaWxlU3RhdChtb2RlbDogdW5rbm93bik6IElGaWxlU3RhdFdpdGhNZXRhZGF0YSB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IGNhbmRpZGF0ZSA9IG1vZGVsIGFzIElUZXN0VGV4dEZpbGVFZGl0b3JNb2RlbCB8IHVuZGVmaW5lZDtcblxuXHRyZXR1cm4gY2FuZGlkYXRlPy5sYXN0UmVzb2x2ZWRGaWxlU3RhdDtcbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RXb3Jrc3BhY2VzU2VydmljZSBpbXBsZW1lbnRzIElXb3Jrc3BhY2VzU2VydmljZSB7XG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRvbkRpZENoYW5nZVJlY2VudGx5T3BlbmVkID0gRXZlbnQuTm9uZTtcblxuXHRhc3luYyBjcmVhdGVVbnRpdGxlZFdvcmtzcGFjZShmb2xkZXJzPzogSVdvcmtzcGFjZUZvbGRlckNyZWF0aW9uRGF0YVtdLCByZW1vdGVBdXRob3JpdHk/OiBzdHJpbmcpOiBQcm9taXNlPElXb3Jrc3BhY2VJZGVudGlmaWVyPiB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRhc3luYyBkZWxldGVVbnRpdGxlZFdvcmtzcGFjZSh3b3Jrc3BhY2U6IElXb3Jrc3BhY2VJZGVudGlmaWVyKTogUHJvbWlzZTx2b2lkPiB7IH1cblx0YXN5bmMgYWRkUmVjZW50bHlPcGVuZWQocmVjZW50czogSVJlY2VudFtdKTogUHJvbWlzZTx2b2lkPiB7IH1cblx0YXN5bmMgcmVtb3ZlUmVjZW50bHlPcGVuZWQod29ya3NwYWNlczogVVJJW10pOiBQcm9taXNlPHZvaWQ+IHsgfVxuXHRhc3luYyBjbGVhclJlY2VudGx5T3BlbmVkKCk6IFByb21pc2U8dm9pZD4geyB9XG5cdGFzeW5jIGdldFJlY2VudGx5T3BlbmVkKCk6IFByb21pc2U8SVJlY2VudGx5T3BlbmVkPiB7IHJldHVybiB7IGZpbGVzOiBbXSwgd29ya3NwYWNlczogW10gfTsgfVxuXHRhc3luYyBnZXREaXJ0eVdvcmtzcGFjZXMoKTogUHJvbWlzZTwoSUZvbGRlckJhY2t1cEluZm8gfCBJV29ya3NwYWNlQmFja3VwSW5mbylbXT4geyByZXR1cm4gW107IH1cblx0YXN5bmMgZW50ZXJXb3Jrc3BhY2UocGF0aDogVVJJKTogUHJvbWlzZTxJRW50ZXJXb3Jrc3BhY2VSZXN1bHQgfCB1bmRlZmluZWQ+IHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdGFzeW5jIGdldFdvcmtzcGFjZUlkZW50aWZpZXIod29ya3NwYWNlUGF0aDogVVJJKTogUHJvbWlzZTxJV29ya3NwYWNlSWRlbnRpZmllcj4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RUZXJtaW5hbEluc3RhbmNlU2VydmljZSBpbXBsZW1lbnRzIElUZXJtaW5hbEluc3RhbmNlU2VydmljZSB7XG5cdG9uRGlkQ3JlYXRlSW5zdGFuY2UgPSBFdmVudC5Ob25lO1xuXHRvbkRpZFJlZ2lzdGVyQmFja2VuZCA9IEV2ZW50Lk5vbmU7XG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdGNvbnZlcnRQcm9maWxlVG9TaGVsbExhdW5jaENvbmZpZyhzaGVsbExhdW5jaENvbmZpZ09yUHJvZmlsZT86IElTaGVsbExhdW5jaENvbmZpZyB8IElUZXJtaW5hbFByb2ZpbGUsIGN3ZD86IHN0cmluZyB8IFVSSSk6IElTaGVsbExhdW5jaENvbmZpZyB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRwcmVwYXJlUGF0aEZvclRlcm1pbmFsQXN5bmMocGF0aDogc3RyaW5nLCBleGVjdXRhYmxlOiBzdHJpbmcgfCB1bmRlZmluZWQsIHRpdGxlOiBzdHJpbmcsIHNoZWxsVHlwZTogVGVybWluYWxTaGVsbFR5cGUsIHJlbW90ZUF1dGhvcml0eTogc3RyaW5nIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxzdHJpbmc+IHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdGNyZWF0ZUluc3RhbmNlKG9wdGlvbnM6IElDcmVhdGVUZXJtaW5hbE9wdGlvbnMsIHRhcmdldDogVGVybWluYWxMb2NhdGlvbik6IElUZXJtaW5hbEluc3RhbmNlIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdGFzeW5jIGdldEJhY2tlbmQocmVtb3RlQXV0aG9yaXR5Pzogc3RyaW5nKTogUHJvbWlzZTxJVGVybWluYWxCYWNrZW5kIHwgdW5kZWZpbmVkPiB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRkaWRSZWdpc3RlckJhY2tlbmQoYmFja2VuZDogSVRlcm1pbmFsQmFja2VuZCk6IHZvaWQgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0Z2V0UmVnaXN0ZXJlZEJhY2tlbmRzKCk6IEl0ZXJhYmxlSXRlcmF0b3I8SVRlcm1pbmFsQmFja2VuZD4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RUZXJtaW5hbEVkaXRvclNlcnZpY2UgaW1wbGVtZW50cyBJVGVybWluYWxFZGl0b3JTZXJ2aWNlIHtcblx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRhY3RpdmVJbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UgfCB1bmRlZmluZWQ7XG5cdGluc3RhbmNlczogcmVhZG9ubHkgSVRlcm1pbmFsSW5zdGFuY2VbXSA9IFtdO1xuXHRvbkRpZERpc3Bvc2VJbnN0YW5jZSA9IEV2ZW50Lk5vbmU7XG5cdG9uRGlkRm9jdXNJbnN0YW5jZSA9IEV2ZW50Lk5vbmU7XG5cdG9uRGlkQ2hhbmdlSW5zdGFuY2VDYXBhYmlsaXR5ID0gRXZlbnQuTm9uZTtcblx0b25EaWRDaGFuZ2VBY3RpdmVJbnN0YW5jZSA9IEV2ZW50Lk5vbmU7XG5cdG9uRGlkQ2hhbmdlSW5zdGFuY2VzID0gRXZlbnQuTm9uZTtcblx0b3BlbkVkaXRvcihpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UsIGVkaXRvck9wdGlvbnM/OiBUZXJtaW5hbEVkaXRvckxvY2F0aW9uKTogUHJvbWlzZTx2b2lkPiB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRkZXRhY2hJbnN0YW5jZShpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UpOiB2b2lkIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdHNwbGl0SW5zdGFuY2UoaW5zdGFuY2VUb1NwbGl0OiBJVGVybWluYWxJbnN0YW5jZSwgc2hlbGxMYXVuY2hDb25maWc/OiBJU2hlbGxMYXVuY2hDb25maWcpOiBJVGVybWluYWxJbnN0YW5jZSB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRyZXZlYWxBY3RpdmVFZGl0b3IocHJlc2VydmVGb2N1cz86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdHJlc29sdmVSZXNvdXJjZShpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UpOiBVUkkgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0cmV2aXZlSW5wdXQoZGVzZXJpYWxpemVkSW5wdXQ6IElEZXNlcmlhbGl6ZWRUZXJtaW5hbEVkaXRvcklucHV0KTogVGVybWluYWxFZGl0b3JJbnB1dCB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRnZXRJbnB1dEZyb21SZXNvdXJjZShyZXNvdXJjZTogVVJJKTogVGVybWluYWxFZGl0b3JJbnB1dCB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRzZXRBY3RpdmVJbnN0YW5jZShpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UpOiB2b2lkIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdGZvY3VzQWN0aXZlSW5zdGFuY2UoKTogUHJvbWlzZTx2b2lkPiB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRmb2N1c0luc3RhbmNlKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSk6IHZvaWQgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0Z2V0SW5zdGFuY2VGcm9tUmVzb3VyY2UocmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCk6IElUZXJtaW5hbEluc3RhbmNlIHwgdW5kZWZpbmVkIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdGZvY3VzRmluZFdpZGdldCgpOiB2b2lkIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdGhpZGVGaW5kV2lkZ2V0KCk6IHZvaWQgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0ZmluZE5leHQoKTogdm9pZCB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRmaW5kUHJldmlvdXMoKTogdm9pZCB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxufVxuXG5leHBvcnQgY2xhc3MgVGVzdFRlcm1pbmFsR3JvdXBTZXJ2aWNlIGltcGxlbWVudHMgSVRlcm1pbmFsR3JvdXBTZXJ2aWNlIHtcblx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRhY3RpdmVJbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UgfCB1bmRlZmluZWQ7XG5cdGluc3RhbmNlczogcmVhZG9ubHkgSVRlcm1pbmFsSW5zdGFuY2VbXSA9IFtdO1xuXHRncm91cHM6IHJlYWRvbmx5IElUZXJtaW5hbEdyb3VwW10gPSBbXTtcblx0YWN0aXZlR3JvdXA6IElUZXJtaW5hbEdyb3VwIHwgdW5kZWZpbmVkO1xuXHRhY3RpdmVHcm91cEluZGV4OiBudW1iZXIgPSAwO1xuXHRsYXN0QWNjZXNzZWRNZW51OiAnaW5saW5lLXRhYicgfCAndGFiLWxpc3QnID0gJ2lubGluZS10YWInO1xuXHRvbkRpZENoYW5nZUFjdGl2ZUdyb3VwID0gRXZlbnQuTm9uZTtcblx0b25EaWREaXNwb3NlR3JvdXAgPSBFdmVudC5Ob25lO1xuXHRvbkRpZFNob3cgPSBFdmVudC5Ob25lO1xuXHRvbkRpZENoYW5nZUdyb3VwcyA9IEV2ZW50Lk5vbmU7XG5cdG9uRGlkQ2hhbmdlUGFuZWxPcmllbnRhdGlvbiA9IEV2ZW50Lk5vbmU7XG5cdG9uRGlkRGlzcG9zZUluc3RhbmNlID0gRXZlbnQuTm9uZTtcblx0b25EaWRGb2N1c0luc3RhbmNlID0gRXZlbnQuTm9uZTtcblx0b25EaWRDaGFuZ2VJbnN0YW5jZUNhcGFiaWxpdHkgPSBFdmVudC5Ob25lO1xuXHRvbkRpZENoYW5nZUFjdGl2ZUluc3RhbmNlID0gRXZlbnQuTm9uZTtcblx0b25EaWRDaGFuZ2VJbnN0YW5jZXMgPSBFdmVudC5Ob25lO1xuXHRjcmVhdGVHcm91cChpbnN0YW5jZT86IGFueSk6IElUZXJtaW5hbEdyb3VwIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdGdldEdyb3VwRm9ySW5zdGFuY2UoaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlKTogSVRlcm1pbmFsR3JvdXAgfCB1bmRlZmluZWQgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0bW92ZUdyb3VwKHNvdXJjZTogSVRlcm1pbmFsSW5zdGFuY2UgfCBJVGVybWluYWxJbnN0YW5jZVtdLCB0YXJnZXQ6IElUZXJtaW5hbEluc3RhbmNlKTogdm9pZCB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRtb3ZlR3JvdXBUb0VuZChzb3VyY2U6IElUZXJtaW5hbEluc3RhbmNlIHwgSVRlcm1pbmFsSW5zdGFuY2VbXSk6IHZvaWQgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0bW92ZUluc3RhbmNlKHNvdXJjZTogSVRlcm1pbmFsSW5zdGFuY2UsIHRhcmdldDogSVRlcm1pbmFsSW5zdGFuY2UsIHNpZGU6ICdiZWZvcmUnIHwgJ2FmdGVyJyk6IHZvaWQgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0dW5zcGxpdEluc3RhbmNlKGluc3RhbmNlOiBJVGVybWluYWxJbnN0YW5jZSk6IHZvaWQgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0am9pbkluc3RhbmNlcyhpbnN0YW5jZXM6IElUZXJtaW5hbEluc3RhbmNlW10pOiB2b2lkIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdGluc3RhbmNlSXNTcGxpdChpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UpOiBib29sZWFuIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdGdldEdyb3VwTGFiZWxzKCk6IHN0cmluZ1tdIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdHNldEFjdGl2ZUdyb3VwQnlJbmRleChpbmRleDogbnVtYmVyKTogdm9pZCB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRzZXRBY3RpdmVHcm91cFRvTmV4dCgpOiB2b2lkIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdHNldEFjdGl2ZUdyb3VwVG9QcmV2aW91cygpOiB2b2lkIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdHNldEFjdGl2ZUluc3RhbmNlQnlJbmRleCh0ZXJtaW5hbEluZGV4OiBudW1iZXIpOiB2b2lkIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdHNldENvbnRhaW5lcihjb250YWluZXI6IEhUTUxFbGVtZW50KTogdm9pZCB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRzaG93UGFuZWwoZm9jdXM/OiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRoaWRlUGFuZWwoKTogdm9pZCB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRmb2N1c1RhYnMoKTogdm9pZCB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRmb2N1c0hvdmVyKCk6IHZvaWQgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0c2V0QWN0aXZlSW5zdGFuY2UoaW5zdGFuY2U6IElUZXJtaW5hbEluc3RhbmNlKTogdm9pZCB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRmb2N1c0FjdGl2ZUluc3RhbmNlKCk6IFByb21pc2U8dm9pZD4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0Zm9jdXNJbnN0YW5jZShpbnN0YW5jZTogSVRlcm1pbmFsSW5zdGFuY2UpOiB2b2lkIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdGdldEluc3RhbmNlRnJvbVJlc291cmNlKHJlc291cmNlOiBVUkkgfCB1bmRlZmluZWQpOiBJVGVybWluYWxJbnN0YW5jZSB8IHVuZGVmaW5lZCB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRmb2N1c0ZpbmRXaWRnZXQoKTogdm9pZCB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRoaWRlRmluZFdpZGdldCgpOiB2b2lkIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdGZpbmROZXh0KCk6IHZvaWQgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0ZmluZFByZXZpb3VzKCk6IHZvaWQgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0dXBkYXRlVmlzaWJpbGl0eSgpOiB2b2lkIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0VGVybWluYWxQcm9maWxlU2VydmljZSBpbXBsZW1lbnRzIElUZXJtaW5hbFByb2ZpbGVTZXJ2aWNlIHtcblx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRhdmFpbGFibGVQcm9maWxlczogSVRlcm1pbmFsUHJvZmlsZVtdID0gW107XG5cdGNvbnRyaWJ1dGVkUHJvZmlsZXM6IElFeHRlbnNpb25UZXJtaW5hbFByb2ZpbGVbXSA9IFtdO1xuXHRwcm9maWxlc1JlYWR5OiBQcm9taXNlPHZvaWQ+ID0gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdG9uRGlkQ2hhbmdlQXZhaWxhYmxlUHJvZmlsZXMgPSBFdmVudC5Ob25lO1xuXHRnZXRQbGF0Zm9ybUtleSgpOiBQcm9taXNlPHN0cmluZz4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0cmVmcmVzaEF2YWlsYWJsZVByb2ZpbGVzKCk6IHZvaWQgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0Z2V0RGVmYXVsdFByb2ZpbGVOYW1lKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRnZXREZWZhdWx0UHJvZmlsZSgpOiBJVGVybWluYWxQcm9maWxlIHwgdW5kZWZpbmVkIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdGdldENvbnRyaWJ1dGVkRGVmYXVsdFByb2ZpbGUoc2hlbGxMYXVuY2hDb25maWc6IElTaGVsbExhdW5jaENvbmZpZyk6IFByb21pc2U8SUV4dGVuc2lvblRlcm1pbmFsUHJvZmlsZSB8IHVuZGVmaW5lZD4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0cmVnaXN0ZXJDb250cmlidXRlZFByb2ZpbGUoYXJnczogSVJlZ2lzdGVyQ29udHJpYnV0ZWRQcm9maWxlQXJncyk6IFByb21pc2U8dm9pZD4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0Z2V0Q29udHJpYnV0ZWRQcm9maWxlUHJvdmlkZXIoZXh0ZW5zaW9uSWRlbnRpZmllcjogc3RyaW5nLCBpZDogc3RyaW5nKTogSVRlcm1pbmFsUHJvZmlsZVByb3ZpZGVyIHwgdW5kZWZpbmVkIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdHJlZ2lzdGVyVGVybWluYWxQcm9maWxlUHJvdmlkZXIoZXh0ZW5zaW9uSWRlbnRpZmllcjogc3RyaW5nLCBpZDogc3RyaW5nLCBwcm9maWxlUHJvdmlkZXI6IElUZXJtaW5hbFByb2ZpbGVQcm92aWRlcik6IElEaXNwb3NhYmxlIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0VGVybWluYWxQcm9maWxlUmVzb2x2ZXJTZXJ2aWNlIGltcGxlbWVudHMgSVRlcm1pbmFsUHJvZmlsZVJlc29sdmVyU2VydmljZSB7XG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0ZGVmYXVsdFByb2ZpbGVOYW1lID0gJyc7XG5cdHJlc29sdmVJY29uKHNoZWxsTGF1bmNoQ29uZmlnOiBJU2hlbGxMYXVuY2hDb25maWcpOiB2b2lkIHsgfVxuXHRhc3luYyByZXNvbHZlU2hlbGxMYXVuY2hDb25maWcoc2hlbGxMYXVuY2hDb25maWc6IElTaGVsbExhdW5jaENvbmZpZywgb3B0aW9uczogSVNoZWxsTGF1bmNoQ29uZmlnUmVzb2x2ZU9wdGlvbnMpOiBQcm9taXNlPHZvaWQ+IHsgfVxuXHRhc3luYyBnZXREZWZhdWx0UHJvZmlsZShvcHRpb25zOiBJU2hlbGxMYXVuY2hDb25maWdSZXNvbHZlT3B0aW9ucyk6IFByb21pc2U8SVRlcm1pbmFsUHJvZmlsZT4geyByZXR1cm4geyBwYXRoOiAnL2RlZmF1bHQnLCBwcm9maWxlTmFtZTogJ0RlZmF1bHQnLCBpc0RlZmF1bHQ6IHRydWUgfTsgfVxuXHRhc3luYyBnZXREZWZhdWx0U2hlbGwob3B0aW9uczogSVNoZWxsTGF1bmNoQ29uZmlnUmVzb2x2ZU9wdGlvbnMpOiBQcm9taXNlPHN0cmluZz4geyByZXR1cm4gJy9kZWZhdWx0JzsgfVxuXHRhc3luYyBnZXREZWZhdWx0U2hlbGxBcmdzKG9wdGlvbnM6IElTaGVsbExhdW5jaENvbmZpZ1Jlc29sdmVPcHRpb25zKTogUHJvbWlzZTxzdHJpbmcgfCBzdHJpbmdbXT4geyByZXR1cm4gW107IH1cblx0Z2V0RGVmYXVsdEljb24oKTogVGVybWluYWxJY29uICYgVGhlbWVJY29uIHsgcmV0dXJuIENvZGljb24udGVybWluYWw7IH1cblx0YXN5bmMgZ2V0RW52aXJvbm1lbnQoKTogUHJvbWlzZTxJUHJvY2Vzc0Vudmlyb25tZW50PiB7IHJldHVybiBlbnY7IH1cblx0Z2V0U2FmZUNvbmZpZ1ZhbHVlKGtleTogc3RyaW5nLCBvczogT3BlcmF0aW5nU3lzdGVtKTogdW5rbm93biB8IHVuZGVmaW5lZCB7IHJldHVybiB1bmRlZmluZWQ7IH1cblx0Z2V0U2FmZUNvbmZpZ1ZhbHVlRnVsbEtleShrZXk6IHN0cmluZyk6IHVua25vd24gfCB1bmRlZmluZWQgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdGNyZWF0ZVByb2ZpbGVGcm9tU2hlbGxBbmRTaGVsbEFyZ3Moc2hlbGw/OiB1bmtub3duLCBzaGVsbEFyZ3M/OiB1bmtub3duKTogUHJvbWlzZTxzdHJpbmcgfCBJVGVybWluYWxQcm9maWxlPiB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxufVxuXG5leHBvcnQgY2xhc3MgVGVzdFRlcm1pbmFsQ29uZmlndXJhdGlvblNlcnZpY2UgZXh0ZW5kcyBUZXJtaW5hbENvbmZpZ3VyYXRpb25TZXJ2aWNlIHtcblx0Z2V0IGZvbnRNZXRyaWNzKCkgeyByZXR1cm4gdGhpcy5fZm9udE1ldHJpY3M7IH1cblx0c2V0Q29uZmlnKGNvbmZpZzogUGFydGlhbDxJVGVybWluYWxDb25maWd1cmF0aW9uPikgeyB0aGlzLl9jb25maWcgPSBjb25maWcgYXMgYW55OyB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0UXVpY2tJbnB1dFNlcnZpY2UgaW1wbGVtZW50cyBJUXVpY2tJbnB1dFNlcnZpY2Uge1xuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRyZWFkb25seSBvblNob3cgPSBFdmVudC5Ob25lO1xuXHRyZWFkb25seSBvbkhpZGUgPSBFdmVudC5Ob25lO1xuXG5cdHJlYWRvbmx5IGN1cnJlbnRRdWlja0lucHV0ID0gdW5kZWZpbmVkO1xuXHRyZWFkb25seSBxdWlja0FjY2VzcyA9IHVuZGVmaW5lZCE7XG5cdGJhY2tCdXR0b24hOiBJUXVpY2tJbnB1dEJ1dHRvbjtcblxuXHRwaWNrPFQgZXh0ZW5kcyBJUXVpY2tQaWNrSXRlbT4ocGlja3M6IFByb21pc2U8UXVpY2tQaWNrSW5wdXQ8VD5bXT4gfCBRdWlja1BpY2tJbnB1dDxUPltdLCBvcHRpb25zPzogSVBpY2tPcHRpb25zPFQ+ICYgeyBjYW5QaWNrTWFueTogdHJ1ZSB9LCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxUW10+O1xuXHRwaWNrPFQgZXh0ZW5kcyBJUXVpY2tQaWNrSXRlbT4ocGlja3M6IFByb21pc2U8UXVpY2tQaWNrSW5wdXQ8VD5bXT4gfCBRdWlja1BpY2tJbnB1dDxUPltdLCBvcHRpb25zPzogSVBpY2tPcHRpb25zPFQ+ICYgeyBjYW5QaWNrTWFueTogZmFsc2UgfSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8VD47XG5cdGFzeW5jIHBpY2s8VCBleHRlbmRzIElRdWlja1BpY2tJdGVtPihwaWNrczogUHJvbWlzZTxRdWlja1BpY2tJbnB1dDxUPltdPiB8IFF1aWNrUGlja0lucHV0PFQ+W10sIG9wdGlvbnM/OiBPbWl0PElQaWNrT3B0aW9uczxUPiwgJ2NhblBpY2tNYW55Jz4sIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFQgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoQXJyYXkuaXNBcnJheShwaWNrcykpIHtcblx0XHRcdHJldHVybiA8YW55PnsgbGFiZWw6ICdzZWxlY3RlZFBpY2snLCBkZXNjcmlwdGlvbjogJ3BpY2sgZGVzY3JpcHRpb24nLCB2YWx1ZTogJ3NlbGVjdGVkUGljaycgfTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBpbnB1dChvcHRpb25zPzogSUlucHV0T3B0aW9ucywgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8c3RyaW5nPiB7IHJldHVybiBvcHRpb25zID8gJ3Jlc29sdmVkJyArIG9wdGlvbnMucHJvbXB0IDogJ3Jlc29sdmVkJzsgfVxuXG5cdGNyZWF0ZVF1aWNrUGljazxUIGV4dGVuZHMgSVF1aWNrUGlja0l0ZW0+KCk6IElRdWlja1BpY2s8VCwgeyB1c2VTZXBhcmF0b3JzOiBib29sZWFuIH0+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0Y3JlYXRlSW5wdXRCb3goKTogSUlucHV0Qm94IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0Y3JlYXRlUXVpY2tXaWRnZXQoKTogSVF1aWNrV2lkZ2V0IHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdGZvY3VzKCk6IHZvaWQgeyB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHR0b2dnbGUoKTogdm9pZCB7IHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkLicpOyB9XG5cdG5hdmlnYXRlKG5leHQ6IGJvb2xlYW4sIHF1aWNrTmF2aWdhdGU/OiBJUXVpY2tOYXZpZ2F0ZUNvbmZpZ3VyYXRpb24pOiB2b2lkIHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0YWNjZXB0KCk6IFByb21pc2U8dm9pZD4geyB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRiYWNrKCk6IFByb21pc2U8dm9pZD4geyB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRjYW5jZWwoKTogUHJvbWlzZTx2b2lkPiB7IHRocm93IG5ldyBFcnJvcignbm90IGltcGxlbWVudGVkLicpOyB9XG5cdHNldEFsaWdubWVudChhbGlnbm1lbnQ6ICd0b3AnIHwgJ2NlbnRlcicgfCB7IHRvcDogbnVtYmVyOyBsZWZ0OiBudW1iZXIgfSk6IHZvaWQgeyB0aHJvdyBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHR0b2dnbGVIb3ZlcigpOiB2b2lkIHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQuJyk7IH1cbn1cblxuY2xhc3MgVGVzdExhbmd1YWdlRGV0ZWN0aW9uU2VydmljZSBpbXBsZW1lbnRzIElMYW5ndWFnZURldGVjdGlvblNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdGlzRW5hYmxlZEZvckxhbmd1YWdlKGxhbmd1YWdlSWQ6IHN0cmluZyk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cblx0YXN5bmMgZGV0ZWN0TGFuZ3VhZ2UocmVzb3VyY2U6IFVSSSwgc3VwcG9ydGVkTGFuZ3M/OiBzdHJpbmdbXSB8IHVuZGVmaW5lZCk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7IHJldHVybiB1bmRlZmluZWQ7IH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RSZW1vdGVBZ2VudFNlcnZpY2UgaW1wbGVtZW50cyBJUmVtb3RlQWdlbnRTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRnZXRDb25uZWN0aW9uKCk6IElSZW1vdGVBZ2VudENvbm5lY3Rpb24gfCBudWxsIHsgcmV0dXJuIG51bGw7IH1cblx0YXN5bmMgZ2V0RW52aXJvbm1lbnQoKTogUHJvbWlzZTxJUmVtb3RlQWdlbnRFbnZpcm9ubWVudCB8IG51bGw+IHsgcmV0dXJuIG51bGw7IH1cblx0YXN5bmMgZ2V0UmF3RW52aXJvbm1lbnQoKTogUHJvbWlzZTxJUmVtb3RlQWdlbnRFbnZpcm9ubWVudCB8IG51bGw+IHsgcmV0dXJuIG51bGw7IH1cblx0YXN5bmMgZ2V0RXh0ZW5zaW9uSG9zdEV4aXRJbmZvKHJlY29ubmVjdGlvblRva2VuOiBzdHJpbmcpOiBQcm9taXNlPElFeHRlbnNpb25Ib3N0RXhpdEluZm8gfCBudWxsPiB7IHJldHVybiBudWxsOyB9XG5cdGFzeW5jIGdldERpYWdub3N0aWNJbmZvKG9wdGlvbnM6IElEaWFnbm9zdGljSW5mb09wdGlvbnMpOiBQcm9taXNlPElEaWFnbm9zdGljSW5mbyB8IHVuZGVmaW5lZD4geyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdGFzeW5jIHVwZGF0ZVRlbGVtZXRyeUxldmVsKHRlbGVtZXRyeUxldmVsOiBUZWxlbWV0cnlMZXZlbCk6IFByb21pc2U8dm9pZD4geyB9XG5cdGFzeW5jIGxvZ1RlbGVtZXRyeShldmVudE5hbWU6IHN0cmluZywgZGF0YT86IElUZWxlbWV0cnlEYXRhKTogUHJvbWlzZTx2b2lkPiB7IH1cblx0YXN5bmMgZmx1c2hUZWxlbWV0cnkoKTogUHJvbWlzZTx2b2lkPiB7IH1cblx0YXN5bmMgZ2V0Um91bmRUcmlwVGltZSgpOiBQcm9taXNlPG51bWJlciB8IHVuZGVmaW5lZD4geyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdGFzeW5jIGVuZENvbm5lY3Rpb24oKTogUHJvbWlzZTx2b2lkPiB7IH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RSZW1vdGVFeHRlbnNpb25zU2Nhbm5lclNlcnZpY2UgaW1wbGVtZW50cyBJUmVtb3RlRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlIHtcblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdGFzeW5jIHdoZW5FeHRlbnNpb25zUmVhZHkoKTogUHJvbWlzZTxJbnN0YWxsRXh0ZW5zaW9uU3VtbWFyeT4geyByZXR1cm4geyBmYWlsZWQ6IFtdIH07IH1cblx0c2NhbkV4dGVuc2lvbnMoKTogUHJvbWlzZTxJRXh0ZW5zaW9uRGVzY3JpcHRpb25bXT4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSB7XG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0b25FbmFibGVtZW50Q2hhbmdlZCA9IEV2ZW50Lk5vbmU7XG5cdGdldEVuYWJsZW1lbnRTdGF0ZShleHRlbnNpb246IElFeHRlbnNpb24pOiBFbmFibGVtZW50U3RhdGUgeyByZXR1cm4gRW5hYmxlbWVudFN0YXRlLkVuYWJsZWRHbG9iYWxseTsgfVxuXHRnZXRFbmFibGVtZW50U3RhdGVzKGV4dGVuc2lvbnM6IElFeHRlbnNpb25bXSwgd29ya3NwYWNlVHlwZU92ZXJyaWRlcz86IHsgdHJ1c3RlZD86IGJvb2xlYW4gfCB1bmRlZmluZWQgfSB8IHVuZGVmaW5lZCk6IEVuYWJsZW1lbnRTdGF0ZVtdIHsgcmV0dXJuIFtdOyB9XG5cdGdldERlcGVuZGVuY2llc0VuYWJsZW1lbnRTdGF0ZXMoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uKTogW0lFeHRlbnNpb24sIEVuYWJsZW1lbnRTdGF0ZV1bXSB7IHJldHVybiBbXTsgfVxuXHRjYW5DaGFuZ2VFbmFibGVtZW50KGV4dGVuc2lvbjogSUV4dGVuc2lvbik6IGJvb2xlYW4geyByZXR1cm4gdHJ1ZTsgfVxuXHRjYW5DaGFuZ2VXb3Jrc3BhY2VFbmFibGVtZW50KGV4dGVuc2lvbjogSUV4dGVuc2lvbik6IGJvb2xlYW4geyByZXR1cm4gdHJ1ZTsgfVxuXHRpc0VuYWJsZWQoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uKTogYm9vbGVhbiB7IHJldHVybiB0cnVlOyB9XG5cdGlzRW5hYmxlZEVuYWJsZW1lbnRTdGF0ZShlbmFibGVtZW50U3RhdGU6IEVuYWJsZW1lbnRTdGF0ZSk6IGJvb2xlYW4geyByZXR1cm4gdHJ1ZTsgfVxuXHRpc0Rpc2FibGVkR2xvYmFsbHkoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uKTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuXHRhc3luYyBzZXRFbmFibGVtZW50KGV4dGVuc2lvbnM6IElFeHRlbnNpb25bXSwgc3RhdGU6IEVuYWJsZW1lbnRTdGF0ZSk6IFByb21pc2U8Ym9vbGVhbltdPiB7IHJldHVybiBbXTsgfVxuXHRhc3luYyB1cGRhdGVFeHRlbnNpb25zRW5hYmxlbWVudHNXaGVuV29ya3NwYWNlVHJ1c3RDaGFuZ2VzKCk6IFByb21pc2U8dm9pZD4geyB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0V29ya2JlbmNoRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2UgaW1wbGVtZW50cyBJV29ya2JlbmNoRXh0ZW5zaW9uTWFuYWdlbWVudFNlcnZpY2Uge1xuXHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdG9uSW5zdGFsbEV4dGVuc2lvbiA9IEV2ZW50Lk5vbmU7XG5cdG9uRGlkSW5zdGFsbEV4dGVuc2lvbnMgPSBFdmVudC5Ob25lO1xuXHRvblVuaW5zdGFsbEV4dGVuc2lvbiA9IEV2ZW50Lk5vbmU7XG5cdG9uRGlkVW5pbnN0YWxsRXh0ZW5zaW9uID0gRXZlbnQuTm9uZTtcblx0b25EaWRVcGRhdGVFeHRlbnNpb25NZXRhZGF0YSA9IEV2ZW50Lk5vbmU7XG5cdG9uUHJvZmlsZUF3YXJlSW5zdGFsbEV4dGVuc2lvbiA9IEV2ZW50Lk5vbmU7XG5cdG9uUHJvZmlsZUF3YXJlRGlkSW5zdGFsbEV4dGVuc2lvbnMgPSBFdmVudC5Ob25lO1xuXHRvblByb2ZpbGVBd2FyZVVuaW5zdGFsbEV4dGVuc2lvbiA9IEV2ZW50Lk5vbmU7XG5cdG9uUHJvZmlsZUF3YXJlRGlkVW5pbnN0YWxsRXh0ZW5zaW9uID0gRXZlbnQuTm9uZTtcblx0b25EaWRQcm9maWxlQXdhcmVVbmluc3RhbGxFeHRlbnNpb25zID0gRXZlbnQuTm9uZTtcblx0b25Qcm9maWxlQXdhcmVEaWRVcGRhdGVFeHRlbnNpb25NZXRhZGF0YSA9IEV2ZW50Lk5vbmU7XG5cdG9uRGlkQ2hhbmdlUHJvZmlsZSA9IEV2ZW50Lk5vbmU7XG5cdG9uRGlkRW5hYmxlRXh0ZW5zaW9ucyA9IEV2ZW50Lk5vbmU7XG5cdGluc3RhbGxWU0lYKGxvY2F0aW9uOiBVUkksIG1hbmlmZXN0OiBSZWFkb25seTxJUmVsYXhlZEV4dGVuc2lvbk1hbmlmZXN0PiwgaW5zdGFsbE9wdGlvbnM/OiBJbnN0YWxsT3B0aW9ucyB8IHVuZGVmaW5lZCk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdGluc3RhbGxGcm9tTG9jYXRpb24obG9jYXRpb246IFVSSSk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdGluc3RhbGxHYWxsZXJ5RXh0ZW5zaW9ucyhleHRlbnNpb25zOiBJbnN0YWxsRXh0ZW5zaW9uSW5mb1tdKTogUHJvbWlzZTxJbnN0YWxsRXh0ZW5zaW9uUmVzdWx0W10+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0YXN5bmMgdXBkYXRlRnJvbUdhbGxlcnkoZ2FsbGVyeTogSUdhbGxlcnlFeHRlbnNpb24sIGV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uLCBpbnN0YWxsT3B0aW9ucz86IEluc3RhbGxPcHRpb25zIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxJTG9jYWxFeHRlbnNpb24+IHsgcmV0dXJuIGV4dGVuc2lvbjsgfVxuXHR6aXAoZXh0ZW5zaW9uOiBJTG9jYWxFeHRlbnNpb24pOiBQcm9taXNlPFVSST4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHRnZXRNYW5pZmVzdCh2c2l4OiBVUkkpOiBQcm9taXNlPFJlYWRvbmx5PElSZWxheGVkRXh0ZW5zaW9uTWFuaWZlc3Q+PiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdGluc3RhbGwodnNpeDogVVJJLCBvcHRpb25zPzogSW5zdGFsbE9wdGlvbnMgfCB1bmRlZmluZWQpOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbj4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHRpc0FsbG93ZWQoKTogdHJ1ZSB8IElNYXJrZG93blN0cmluZyB7IHJldHVybiB0cnVlOyB9XG5cdGFzeW5jIGNhbkluc3RhbGwoZXh0ZW5zaW9uOiBJR2FsbGVyeUV4dGVuc2lvbik6IFByb21pc2U8dHJ1ZT4geyByZXR1cm4gdHJ1ZTsgfVxuXHRpbnN0YWxsRnJvbUdhbGxlcnkoZXh0ZW5zaW9uOiBJR2FsbGVyeUV4dGVuc2lvbiwgb3B0aW9ucz86IEluc3RhbGxPcHRpb25zIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxJTG9jYWxFeHRlbnNpb24+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0dW5pbnN0YWxsKGV4dGVuc2lvbjogSUxvY2FsRXh0ZW5zaW9uLCBvcHRpb25zPzogVW5pbnN0YWxsT3B0aW9ucyB8IHVuZGVmaW5lZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHR1bmluc3RhbGxFeHRlbnNpb25zKGV4dGVuc2lvbnM6IFVuaW5zdGFsbEV4dGVuc2lvbkluZm9bXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHRhc3luYyBnZXRJbnN0YWxsZWQodHlwZT86IEV4dGVuc2lvblR5cGUgfCB1bmRlZmluZWQpOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbltdPiB7IHJldHVybiBbXTsgfVxuXHRnZXRFeHRlbnNpb25zQ29udHJvbE1hbmlmZXN0KCk6IFByb21pc2U8SUV4dGVuc2lvbnNDb250cm9sTWFuaWZlc3Q+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0YXN5bmMgdXBkYXRlTWV0YWRhdGEobG9jYWw6IElMb2NhbEV4dGVuc2lvbiwgbWV0YWRhdGE6IFBhcnRpYWw8TWV0YWRhdGE+KTogUHJvbWlzZTxJTG9jYWxFeHRlbnNpb24+IHsgcmV0dXJuIGxvY2FsOyB9XG5cdHJlZ2lzdGVyUGFydGljaXBhbnQocGFyaXRpY2lwYW50OiBJRXh0ZW5zaW9uTWFuYWdlbWVudFBhcnRpY2lwYW50KTogdm9pZCB7IH1cblx0YXN5bmMgZ2V0VGFyZ2V0UGxhdGZvcm0oKTogUHJvbWlzZTxUYXJnZXRQbGF0Zm9ybT4geyByZXR1cm4gVGFyZ2V0UGxhdGZvcm0uVU5ERUZJTkVEOyB9XG5cdGFzeW5jIGNsZWFuVXAoKTogUHJvbWlzZTx2b2lkPiB7IH1cblx0ZG93bmxvYWQoKTogUHJvbWlzZTxVUkk+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0Y29weUV4dGVuc2lvbnMoKTogUHJvbWlzZTx2b2lkPiB7IHRocm93IG5ldyBFcnJvcignTm90IFN1cHBvcnRlZCcpOyB9XG5cdHRvZ2dsZUFwcGxpYXRpb25TY29wZSgpOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbj4geyB0aHJvdyBuZXcgRXJyb3IoJ05vdCBTdXBwb3J0ZWQnKTsgfVxuXHRpbnN0YWxsRXh0ZW5zaW9uc0Zyb21Qcm9maWxlKCk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uW10+IHsgdGhyb3cgbmV3IEVycm9yKCdOb3QgU3VwcG9ydGVkJyk7IH1cblx0d2hlblByb2ZpbGVDaGFuZ2VkKGZyb206IElVc2VyRGF0YVByb2ZpbGUsIHRvOiBJVXNlckRhdGFQcm9maWxlKTogUHJvbWlzZTx2b2lkPiB7IHRocm93IG5ldyBFcnJvcignTm90IFN1cHBvcnRlZCcpOyB9XG5cdGdldEluc3RhbGxlZFdvcmtzcGFjZUV4dGVuc2lvbkxvY2F0aW9ucygpOiBVUklbXSB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRnZXRJbnN0YWxsZWRXb3Jrc3BhY2VFeHRlbnNpb25zKCk6IFByb21pc2U8SUxvY2FsRXh0ZW5zaW9uW10+IHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdGluc3RhbGxSZXNvdXJjZUV4dGVuc2lvbigpOiBQcm9taXNlPElMb2NhbEV4dGVuc2lvbj4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0Z2V0RXh0ZW5zaW9ucygpOiBQcm9taXNlPElSZXNvdXJjZUV4dGVuc2lvbltdPiB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRyZXNldFBpbm5lZFN0YXRlRm9yQWxsVXNlckV4dGVuc2lvbnMocGlubmVkOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRnZXRJbnN0YWxsYWJsZVNlcnZlcnMoZXh0ZW5zaW9uOiBJR2FsbGVyeUV4dGVuc2lvbik6IFByb21pc2U8SUV4dGVuc2lvbk1hbmFnZW1lbnRTZXJ2ZXJbXT4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0aXNQdWJsaXNoZXJUcnVzdGVkKGV4dGVuc2lvbjogSUdhbGxlcnlFeHRlbnNpb24pOiBib29sZWFuIHsgcmV0dXJuIGZhbHNlOyB9XG5cdGdldFRydXN0ZWRQdWJsaXNoZXJzKCkgeyByZXR1cm4gW107IH1cblx0dHJ1c3RQdWJsaXNoZXJzKCk6IHZvaWQgeyB9XG5cdHVudHJ1c3RQdWJsaXNoZXJzKCk6IHZvaWQgeyB9XG5cdGFzeW5jIHJlcXVlc3RQdWJsaXNoZXJUcnVzdChleHRlbnNpb25zOiBJbnN0YWxsRXh0ZW5zaW9uSW5mb1tdKTogUHJvbWlzZTx2b2lkPiB7IH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RVc2VyRGF0YVByb2ZpbGVTZXJ2aWNlIGltcGxlbWVudHMgSVVzZXJEYXRhUHJvZmlsZVNlcnZpY2Uge1xuXG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VDdXJyZW50UHJvZmlsZSA9IEV2ZW50Lk5vbmU7XG5cdHJlYWRvbmx5IGN1cnJlbnRQcm9maWxlID0gdG9Vc2VyRGF0YVByb2ZpbGUoJ3Rlc3QnLCAndGVzdCcsIFVSSS5maWxlKCd0ZXN0cycpLndpdGgoeyBzY2hlbWU6ICd2c2NvZGUtdGVzdHMnIH0pLCBVUkkuZmlsZSgndGVzdHMnKS53aXRoKHsgc2NoZW1lOiAndnNjb2RlLXRlc3RzJyB9KSk7XG5cdGFzeW5jIHVwZGF0ZUN1cnJlbnRQcm9maWxlKCk6IFByb21pc2U8dm9pZD4geyB9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0V2ViRXh0ZW5zaW9uc1NjYW5uZXJTZXJ2aWNlIGltcGxlbWVudHMgSVdlYkV4dGVuc2lvbnNTY2FubmVyU2VydmljZSB7XG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0b25EaWRDaGFuZ2VQcm9maWxlID0gRXZlbnQuTm9uZTtcblx0YXN5bmMgc2NhblN5c3RlbUV4dGVuc2lvbnMoKTogUHJvbWlzZTxJRXh0ZW5zaW9uW10+IHsgcmV0dXJuIFtdOyB9XG5cdGFzeW5jIHNjYW5Vc2VyRXh0ZW5zaW9ucygpOiBQcm9taXNlPElTY2FubmVkRXh0ZW5zaW9uW10+IHsgcmV0dXJuIFtdOyB9XG5cdGFzeW5jIHNjYW5FeHRlbnNpb25zVW5kZXJEZXZlbG9wbWVudCgpOiBQcm9taXNlPElFeHRlbnNpb25bXT4geyByZXR1cm4gW107IH1cblx0YXN5bmMgY29weUV4dGVuc2lvbnMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdHNjYW5FeGlzdGluZ0V4dGVuc2lvbihleHRlbnNpb25Mb2NhdGlvbjogVVJJLCBleHRlbnNpb25UeXBlOiBFeHRlbnNpb25UeXBlKTogUHJvbWlzZTxJU2Nhbm5lZEV4dGVuc2lvbiB8IG51bGw+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0YWRkRXh0ZW5zaW9uKGxvY2F0aW9uOiBVUkksIG1ldGFkYXRhPzogUGFydGlhbDxJR2FsbGVyeU1ldGFkYXRhICYgeyBpc0FwcGxpY2F0aW9uU2NvcGVkOiBib29sZWFuOyBpc01hY2hpbmVTY29wZWQ6IGJvb2xlYW47IGlzQnVpbHRpbjogYm9vbGVhbjsgaXNTeXN0ZW06IGJvb2xlYW47IHVwZGF0ZWQ6IGJvb2xlYW47IHByZVJlbGVhc2U6IGJvb2xlYW47IGluc3RhbGxlZFRpbWVzdGFtcDogbnVtYmVyIH0+IHwgdW5kZWZpbmVkKTogUHJvbWlzZTxJRXh0ZW5zaW9uPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdGFkZEV4dGVuc2lvbkZyb21HYWxsZXJ5KGdhbGxlcnlFeHRlbnNpb246IElHYWxsZXJ5RXh0ZW5zaW9uLCBtZXRhZGF0YT86IFBhcnRpYWw8SUdhbGxlcnlNZXRhZGF0YSAmIHsgaXNBcHBsaWNhdGlvblNjb3BlZDogYm9vbGVhbjsgaXNNYWNoaW5lU2NvcGVkOiBib29sZWFuOyBpc0J1aWx0aW46IGJvb2xlYW47IGlzU3lzdGVtOiBib29sZWFuOyB1cGRhdGVkOiBib29sZWFuOyBwcmVSZWxlYXNlOiBib29sZWFuOyBpbnN0YWxsZWRUaW1lc3RhbXA6IG51bWJlciB9PiB8IHVuZGVmaW5lZCk6IFByb21pc2U8SUV4dGVuc2lvbj4ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxuXHRyZW1vdmVFeHRlbnNpb24oKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdHVwZGF0ZU1ldGFkYXRhKGV4dGVuc2lvbjogSVNjYW5uZWRFeHRlbnNpb24sIG1ldGFEYXRhOiBQYXJ0aWFsPE1ldGFkYXRhPiwgcHJvZmlsZUxvY2F0aW9uOiBVUkkpOiBQcm9taXNlPElTY2FubmVkRXh0ZW5zaW9uPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpO1xuXHR9XG5cdHNjYW5FeHRlbnNpb25NYW5pZmVzdChleHRlbnNpb25Mb2NhdGlvbjogVVJJKTogUHJvbWlzZTxSZWFkb25seTxJUmVsYXhlZEV4dGVuc2lvbk1hbmlmZXN0PiB8IG51bGw+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cbn1cblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdvcmtiZW5jaFRlYXJkb3duKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0cmV0dXJuIGluc3RhbnRpYXRpb25TZXJ2aWNlLmludm9rZUZ1bmN0aW9uKGFzeW5jIGFjY2Vzc29yID0+IHtcblx0XHRjb25zdCB3b3JraW5nQ29weVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVdvcmtpbmdDb3B5U2VydmljZSk7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JHcm91cHNTZXJ2aWNlKTtcblxuXHRcdGZvciAoY29uc3Qgd29ya2luZ0NvcHkgb2Ygd29ya2luZ0NvcHlTZXJ2aWNlLndvcmtpbmdDb3BpZXMpIHtcblx0XHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJldmVydCgpO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgZWRpdG9yR3JvdXBTZXJ2aWNlLmdyb3Vwcykge1xuXHRcdFx0YXdhaXQgZ3JvdXAuY2xvc2VBbGxFZGl0b3JzKCk7XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBncm91cCBvZiBlZGl0b3JHcm91cFNlcnZpY2UuZ3JvdXBzKSB7XG5cdFx0XHRlZGl0b3JHcm91cFNlcnZpY2UucmVtb3ZlR3JvdXAoZ3JvdXApO1xuXHRcdH1cblx0fSk7XG59XG4iXSwKICAibWFw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
