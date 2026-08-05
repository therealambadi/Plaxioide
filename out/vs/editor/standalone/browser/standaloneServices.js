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
import "./standaloneCodeEditorService.js";
import "./standaloneLayoutService.js";
import "../../../platform/undoRedo/common/undoRedoService.js";
import "../../common/services/languageFeatureDebounce.js";
import "../../common/services/semanticTokensStylingService.js";
import "../../common/services/languageFeaturesService.js";
import "../../browser/services/hoverService/hoverService.js";
import * as strings from "../../../base/common/strings.js";
import * as dom from "../../../base/browser/dom.js";
import { StandardKeyboardEvent } from "../../../base/browser/keyboardEvent.js";
import { Emitter, Event, ValueWithChangeEvent } from "../../../base/common/event.js";
import { KeyCodeChord, decodeKeybinding } from "../../../base/common/keybindings.js";
import { ImmortalReference, toDisposable, DisposableStore, Disposable, combinedDisposable } from "../../../base/common/lifecycle.js";
import { OS, isLinux, isMacintosh } from "../../../base/common/platform.js";
import Severity from "../../../base/common/severity.js";
import { URI } from "../../../base/common/uri.js";
import { IBulkEditService, ResourceEdit, ResourceTextEdit } from "../../browser/services/bulkEditService.js";
import { isDiffEditorConfigurationKey, isEditorConfigurationKey } from "../../common/config/editorConfigurationSchema.js";
import { EditOperation } from "../../common/core/editOperation.js";
import { Position as Pos } from "../../common/core/position.js";
import { Range } from "../../common/core/range.js";
import { IModelService } from "../../common/services/model.js";
import { ITextModelService } from "../../common/services/resolverService.js";
import { ITextResourceConfigurationService, ITextResourcePropertiesService } from "../../common/services/textResourceConfiguration.js";
import { CommandsRegistry, ICommandService } from "../../../platform/commands/common/commands.js";
import { IConfigurationService, ConfigurationTarget } from "../../../platform/configuration/common/configuration.js";
import { Configuration, ConfigurationModel, ConfigurationChangeEvent } from "../../../platform/configuration/common/configurationModels.js";
import { IContextKeyService } from "../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../platform/dialogs/common/dialogs.js";
import { createDecorator, IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { AbstractKeybindingService } from "../../../platform/keybinding/common/abstractKeybindingService.js";
import { IKeybindingService } from "../../../platform/keybinding/common/keybinding.js";
import { KeybindingResolver } from "../../../platform/keybinding/common/keybindingResolver.js";
import { KeybindingsRegistry } from "../../../platform/keybinding/common/keybindingsRegistry.js";
import { ResolvedKeybindingItem } from "../../../platform/keybinding/common/resolvedKeybindingItem.js";
import { USLayoutResolvedKeybinding } from "../../../platform/keybinding/common/usLayoutResolvedKeybinding.js";
import { ILabelService } from "../../../platform/label/common/label.js";
import { INotificationService, NoOpNotification, NotificationsFilter } from "../../../platform/notification/common/notification.js";
import { IEditorProgressService, IProgressService } from "../../../platform/progress/common/progress.js";
import { ITelemetryService, TelemetryLevel } from "../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceContextService, WorkbenchState, WorkspaceFolder, STANDALONE_EDITOR_WORKSPACE_ID } from "../../../platform/workspace/common/workspace.js";
import { ILayoutService } from "../../../platform/layout/browser/layoutService.js";
import { StandaloneServicesNLS } from "../../common/standaloneStrings.js";
import { basename } from "../../../base/common/resources.js";
import { ICodeEditorService } from "../../browser/services/codeEditorService.js";
import { ConsoleLogger, ILogService } from "../../../platform/log/common/log.js";
import { IWorkspaceTrustManagementService } from "../../../platform/workspace/common/workspaceTrust.js";
import { EditorOption } from "../../common/config/editorOptions.js";
import { IContextMenuService, IContextViewService } from "../../../platform/contextview/browser/contextView.js";
import { ContextViewService } from "../../../platform/contextview/browser/contextViewService.js";
import { LanguageService } from "../../common/services/languageService.js";
import { ContextMenuService } from "../../../platform/contextview/browser/contextMenuService.js";
import { getSingletonServiceDescriptors, InstantiationType, registerSingleton } from "../../../platform/instantiation/common/extensions.js";
import { OpenerService } from "../../browser/services/openerService.js";
import { IEditorWorkerService } from "../../common/services/editorWorker.js";
import { EditorWorkerService } from "../../browser/services/editorWorkerService.js";
import { ILanguageService } from "../../common/languages/language.js";
import { MarkerDecorationsService } from "../../common/services/markerDecorationsService.js";
import { IMarkerDecorationsService } from "../../common/services/markerDecorations.js";
import { ModelService } from "../../common/services/modelService.js";
import { StandaloneQuickInputService } from "./quickInput/standaloneQuickInputService.js";
import { StandaloneThemeService } from "./standaloneThemeService.js";
import { IStandaloneThemeService } from "../common/standaloneTheme.js";
import { AccessibilityService } from "../../../platform/accessibility/browser/accessibilityService.js";
import { IAccessibilityService } from "../../../platform/accessibility/common/accessibility.js";
import { IMenuService } from "../../../platform/actions/common/actions.js";
import { MenuService } from "../../../platform/actions/common/menuService.js";
import { BrowserClipboardService } from "../../../platform/clipboard/browser/clipboardService.js";
import { IClipboardService } from "../../../platform/clipboard/common/clipboardService.js";
import { ContextKeyService } from "../../../platform/contextkey/browser/contextKeyService.js";
import { SyncDescriptor } from "../../../platform/instantiation/common/descriptors.js";
import { InstantiationService } from "../../../platform/instantiation/common/instantiationService.js";
import { ServiceCollection } from "../../../platform/instantiation/common/serviceCollection.js";
import { IListService, ListService } from "../../../platform/list/browser/listService.js";
import { IMarkerService } from "../../../platform/markers/common/markers.js";
import { MarkerService } from "../../../platform/markers/common/markerService.js";
import { IOpenerService } from "../../../platform/opener/common/opener.js";
import { IQuickInputService } from "../../../platform/quickinput/common/quickInput.js";
import { IStorageService, InMemoryStorageService } from "../../../platform/storage/common/storage.js";
import { DefaultConfiguration } from "../../../platform/configuration/common/configurations.js";
import { IAccessibilitySignalService } from "../../../platform/accessibilitySignal/browser/accessibilitySignalService.js";
import { ILanguageFeaturesService } from "../../common/services/languageFeatures.js";
import { ILanguageConfigurationService } from "../../common/languages/languageConfigurationRegistry.js";
import { LogService } from "../../../platform/log/common/logService.js";
import { getEditorFeatures } from "../../common/editorFeatures.js";
import { onUnexpectedError } from "../../../base/common/errors.js";
import { IEnvironmentService } from "../../../platform/environment/common/environment.js";
import { mainWindow } from "../../../base/browser/window.js";
import { ResourceMap } from "../../../base/common/map.js";
import { ITreeSitterParserService } from "../../common/services/treeSitterParserService.js";
import { StandaloneTreeSitterParserService } from "./standaloneTreeSitterService.js";
class SimpleModel {
  constructor(model) {
    this.disposed = false;
    this.model = model;
    this._onWillDispose = new Emitter();
  }
  get onWillDispose() {
    return this._onWillDispose.event;
  }
  resolve() {
    return Promise.resolve();
  }
  get textEditorModel() {
    return this.model;
  }
  createSnapshot() {
    return this.model.createSnapshot();
  }
  isReadonly() {
    return false;
  }
  dispose() {
    this.disposed = true;
    this._onWillDispose.fire();
  }
  isDisposed() {
    return this.disposed;
  }
  isResolved() {
    return true;
  }
  getLanguageId() {
    return this.model.getLanguageId();
  }
}
let StandaloneTextModelService = class {
  constructor(modelService) {
    this.modelService = modelService;
  }
  createModelReference(resource) {
    const model = this.modelService.getModel(resource);
    if (!model) {
      return Promise.reject(new Error(`Model not found`));
    }
    return Promise.resolve(new ImmortalReference(new SimpleModel(model)));
  }
  registerTextModelContentProvider(scheme, provider) {
    return {
      dispose: function() {
      }
    };
  }
  canHandleResource(resource) {
    return false;
  }
};
StandaloneTextModelService = __decorateClass([
  __decorateParam(0, IModelService)
], StandaloneTextModelService);
const _StandaloneEditorProgressService = class _StandaloneEditorProgressService {
  show() {
    return _StandaloneEditorProgressService.NULL_PROGRESS_RUNNER;
  }
  async showWhile(promise, delay) {
    await promise;
  }
};
_StandaloneEditorProgressService.NULL_PROGRESS_RUNNER = {
  done: () => {
  },
  total: () => {
  },
  worked: () => {
  }
};
let StandaloneEditorProgressService = _StandaloneEditorProgressService;
class StandaloneProgressService {
  withProgress(_options, task, onDidCancel) {
    return task({
      report: () => {
      }
    });
  }
}
class StandaloneEnvironmentService {
  constructor() {
    this.stateResource = URI.from({ scheme: "monaco", authority: "stateResource" });
    this.userRoamingDataHome = URI.from({ scheme: "monaco", authority: "userRoamingDataHome" });
    this.keyboardLayoutResource = URI.from({ scheme: "monaco", authority: "keyboardLayoutResource" });
    this.argvResource = URI.from({ scheme: "monaco", authority: "argvResource" });
    this.untitledWorkspacesHome = URI.from({ scheme: "monaco", authority: "untitledWorkspacesHome" });
    this.workspaceStorageHome = URI.from({ scheme: "monaco", authority: "workspaceStorageHome" });
    this.localHistoryHome = URI.from({ scheme: "monaco", authority: "localHistoryHome" });
    this.cacheHome = URI.from({ scheme: "monaco", authority: "cacheHome" });
    this.userDataSyncHome = URI.from({ scheme: "monaco", authority: "userDataSyncHome" });
    this.sync = void 0;
    this.continueOn = void 0;
    this.editSessionId = void 0;
    this.debugExtensionHost = { port: null, break: false };
    this.isExtensionDevelopment = false;
    this.disableExtensions = false;
    this.enableExtensions = void 0;
    this.extensionDevelopmentLocationURI = void 0;
    this.extensionDevelopmentKind = void 0;
    this.extensionTestsLocationURI = void 0;
    this.logsHome = URI.from({ scheme: "monaco", authority: "logsHome" });
    this.logLevel = void 0;
    this.extensionLogLevel = void 0;
    this.verbose = false;
    this.isBuilt = false;
    this.disableTelemetry = false;
    this.serviceMachineIdResource = URI.from({ scheme: "monaco", authority: "serviceMachineIdResource" });
    this.policyFile = void 0;
  }
}
class StandaloneDialogService {
  constructor() {
    this.onWillShowDialog = Event.None;
    this.onDidShowDialog = Event.None;
  }
  async confirm(confirmation) {
    const confirmed = this.doConfirm(confirmation.message, confirmation.detail);
    return {
      confirmed,
      checkboxChecked: false
      // unsupported
    };
  }
  doConfirm(message, detail) {
    let messageText = message;
    if (detail) {
      messageText = messageText + "\n\n" + detail;
    }
    return mainWindow.confirm(messageText);
  }
  async prompt(prompt) {
    let result = void 0;
    const confirmed = this.doConfirm(prompt.message, prompt.detail);
    if (confirmed) {
      const promptButtons = [...prompt.buttons ?? []];
      if (prompt.cancelButton && typeof prompt.cancelButton !== "string" && typeof prompt.cancelButton !== "boolean") {
        promptButtons.push(prompt.cancelButton);
      }
      result = await promptButtons[0]?.run({ checkboxChecked: false });
    }
    return { result };
  }
  async info(message, detail) {
    await this.prompt({ type: Severity.Info, message, detail });
  }
  async warn(message, detail) {
    await this.prompt({ type: Severity.Warning, message, detail });
  }
  async error(message, detail) {
    await this.prompt({ type: Severity.Error, message, detail });
  }
  input() {
    return Promise.resolve({ confirmed: false });
  }
  about() {
    return Promise.resolve(void 0);
  }
}
const _StandaloneNotificationService = class _StandaloneNotificationService {
  constructor() {
    this.onDidAddNotification = Event.None;
    this.onDidRemoveNotification = Event.None;
    this.onDidChangeFilter = Event.None;
  }
  info(message) {
    return this.notify({ severity: Severity.Info, message });
  }
  warn(message) {
    return this.notify({ severity: Severity.Warning, message });
  }
  error(error) {
    return this.notify({ severity: Severity.Error, message: error });
  }
  notify(notification) {
    switch (notification.severity) {
      case Severity.Error:
        console.error(notification.message);
        break;
      case Severity.Warning:
        console.warn(notification.message);
        break;
      default:
        console.log(notification.message);
        break;
    }
    return _StandaloneNotificationService.NO_OP;
  }
  prompt(severity, message, choices, options) {
    return _StandaloneNotificationService.NO_OP;
  }
  status(message, options) {
    return Disposable.None;
  }
  setFilter(filter) {
  }
  getFilter(source) {
    return NotificationsFilter.OFF;
  }
  getFilters() {
    return [];
  }
  removeFilter(sourceId) {
  }
};
_StandaloneNotificationService.NO_OP = new NoOpNotification();
let StandaloneNotificationService = _StandaloneNotificationService;
let StandaloneCommandService = class {
  constructor(instantiationService) {
    this._onWillExecuteCommand = new Emitter();
    this._onDidExecuteCommand = new Emitter();
    this.onWillExecuteCommand = this._onWillExecuteCommand.event;
    this.onDidExecuteCommand = this._onDidExecuteCommand.event;
    this._instantiationService = instantiationService;
  }
  executeCommand(id, ...args) {
    const command = CommandsRegistry.getCommand(id);
    if (!command) {
      return Promise.reject(new Error(`command '${id}' not found`));
    }
    try {
      this._onWillExecuteCommand.fire({ commandId: id, args });
      const result = this._instantiationService.invokeFunction.apply(this._instantiationService, [command.handler, ...args]);
      this._onDidExecuteCommand.fire({ commandId: id, args });
      return Promise.resolve(result);
    } catch (err) {
      return Promise.reject(err);
    }
  }
};
StandaloneCommandService = __decorateClass([
  __decorateParam(0, IInstantiationService)
], StandaloneCommandService);
let StandaloneKeybindingService = class extends AbstractKeybindingService {
  constructor(contextKeyService, commandService, telemetryService, notificationService, logService, codeEditorService) {
    super(contextKeyService, commandService, telemetryService, notificationService, logService);
    this._cachedResolver = null;
    this._dynamicKeybindings = [];
    this._domNodeListeners = [];
    const addContainer = (domNode) => {
      const disposables = new DisposableStore();
      disposables.add(dom.addDisposableListener(domNode, dom.EventType.KEY_DOWN, (e) => {
        const keyEvent = new StandardKeyboardEvent(e);
        const shouldPreventDefault = this._dispatch(keyEvent, keyEvent.target);
        if (shouldPreventDefault) {
          keyEvent.preventDefault();
          keyEvent.stopPropagation();
        }
      }));
      disposables.add(dom.addDisposableListener(domNode, dom.EventType.KEY_UP, (e) => {
        const keyEvent = new StandardKeyboardEvent(e);
        const shouldPreventDefault = this._singleModifierDispatch(keyEvent, keyEvent.target);
        if (shouldPreventDefault) {
          keyEvent.preventDefault();
        }
      }));
      this._domNodeListeners.push(new DomNodeListeners(domNode, disposables));
    };
    const removeContainer = (domNode) => {
      for (let i = 0; i < this._domNodeListeners.length; i++) {
        const domNodeListeners = this._domNodeListeners[i];
        if (domNodeListeners.domNode === domNode) {
          this._domNodeListeners.splice(i, 1);
          domNodeListeners.dispose();
        }
      }
    };
    const addCodeEditor = (codeEditor) => {
      if (codeEditor.getOption(EditorOption.inDiffEditor)) {
        return;
      }
      addContainer(codeEditor.getContainerDomNode());
    };
    const removeCodeEditor = (codeEditor) => {
      if (codeEditor.getOption(EditorOption.inDiffEditor)) {
        return;
      }
      removeContainer(codeEditor.getContainerDomNode());
    };
    this._register(codeEditorService.onCodeEditorAdd(addCodeEditor));
    this._register(codeEditorService.onCodeEditorRemove(removeCodeEditor));
    codeEditorService.listCodeEditors().forEach(addCodeEditor);
    const addDiffEditor = (diffEditor) => {
      addContainer(diffEditor.getContainerDomNode());
    };
    const removeDiffEditor = (diffEditor) => {
      removeContainer(diffEditor.getContainerDomNode());
    };
    this._register(codeEditorService.onDiffEditorAdd(addDiffEditor));
    this._register(codeEditorService.onDiffEditorRemove(removeDiffEditor));
    codeEditorService.listDiffEditors().forEach(addDiffEditor);
  }
  addDynamicKeybinding(command, keybinding, handler, when) {
    return combinedDisposable(
      CommandsRegistry.registerCommand(command, handler),
      this.addDynamicKeybindings([{
        keybinding,
        command,
        when
      }])
    );
  }
  addDynamicKeybindings(rules) {
    const entries = rules.map((rule) => {
      const keybinding = decodeKeybinding(rule.keybinding, OS);
      return {
        keybinding,
        command: rule.command ?? null,
        commandArgs: rule.commandArgs,
        when: rule.when,
        weight1: 1e3,
        weight2: 0,
        extensionId: null,
        isBuiltinExtension: false
      };
    });
    this._dynamicKeybindings = this._dynamicKeybindings.concat(entries);
    this.updateResolver();
    return toDisposable(() => {
      for (let i = 0; i < this._dynamicKeybindings.length; i++) {
        if (this._dynamicKeybindings[i] === entries[0]) {
          this._dynamicKeybindings.splice(i, entries.length);
          this.updateResolver();
          return;
        }
      }
    });
  }
  updateResolver() {
    this._cachedResolver = null;
    this._onDidUpdateKeybindings.fire();
  }
  _getResolver() {
    if (!this._cachedResolver) {
      const defaults = this._toNormalizedKeybindingItems(KeybindingsRegistry.getDefaultKeybindings(), true);
      const overrides = this._toNormalizedKeybindingItems(this._dynamicKeybindings, false);
      this._cachedResolver = new KeybindingResolver(defaults, overrides, (str) => this._log(str));
    }
    return this._cachedResolver;
  }
  _documentHasFocus() {
    return mainWindow.document.hasFocus();
  }
  _toNormalizedKeybindingItems(items, isDefault) {
    const result = [];
    let resultLen = 0;
    for (const item of items) {
      const when = item.when || void 0;
      const keybinding = item.keybinding;
      if (!keybinding) {
        result[resultLen++] = new ResolvedKeybindingItem(void 0, item.command, item.commandArgs, when, isDefault, null, false);
      } else {
        const resolvedKeybindings = USLayoutResolvedKeybinding.resolveKeybinding(keybinding, OS);
        for (const resolvedKeybinding of resolvedKeybindings) {
          result[resultLen++] = new ResolvedKeybindingItem(resolvedKeybinding, item.command, item.commandArgs, when, isDefault, null, false);
        }
      }
    }
    return result;
  }
  resolveKeybinding(keybinding) {
    return USLayoutResolvedKeybinding.resolveKeybinding(keybinding, OS);
  }
  resolveKeyboardEvent(keyboardEvent) {
    const chord = new KeyCodeChord(
      keyboardEvent.ctrlKey,
      keyboardEvent.shiftKey,
      keyboardEvent.altKey,
      keyboardEvent.metaKey,
      keyboardEvent.keyCode
    );
    return new USLayoutResolvedKeybinding([chord], OS);
  }
  resolveUserBinding(userBinding) {
    return [];
  }
  _dumpDebugInfo() {
    return "";
  }
  _dumpDebugInfoJSON() {
    return "";
  }
  registerSchemaContribution(contribution) {
  }
  /**
   * not yet supported
   */
  enableKeybindingHoldMode(commandId) {
    return void 0;
  }
};
StandaloneKeybindingService = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, ICommandService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, ILogService),
  __decorateParam(5, ICodeEditorService)
], StandaloneKeybindingService);
class DomNodeListeners extends Disposable {
  constructor(domNode, disposables) {
    super();
    this.domNode = domNode;
    this._register(disposables);
  }
}
function isConfigurationOverrides(thing) {
  return thing && typeof thing === "object" && (!thing.overrideIdentifier || typeof thing.overrideIdentifier === "string") && (!thing.resource || thing.resource instanceof URI);
}
let StandaloneConfigurationService = class {
  constructor(logService) {
    this.logService = logService;
    this._onDidChangeConfiguration = new Emitter();
    this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
    const defaultConfiguration = new DefaultConfiguration(logService);
    this._configuration = new Configuration(
      defaultConfiguration.reload(),
      ConfigurationModel.createEmptyModel(logService),
      ConfigurationModel.createEmptyModel(logService),
      ConfigurationModel.createEmptyModel(logService),
      ConfigurationModel.createEmptyModel(logService),
      ConfigurationModel.createEmptyModel(logService),
      new ResourceMap(),
      ConfigurationModel.createEmptyModel(logService),
      new ResourceMap(),
      logService
    );
    defaultConfiguration.dispose();
  }
  getValue(arg1, arg2) {
    const section = typeof arg1 === "string" ? arg1 : void 0;
    const overrides = isConfigurationOverrides(arg1) ? arg1 : isConfigurationOverrides(arg2) ? arg2 : {};
    return this._configuration.getValue(section, overrides, void 0);
  }
  updateValues(values) {
    const previous = { data: this._configuration.toData() };
    const changedKeys = [];
    for (const entry of values) {
      const [key, value] = entry;
      if (this.getValue(key) === value) {
        continue;
      }
      this._configuration.updateValue(key, value);
      changedKeys.push(key);
    }
    if (changedKeys.length > 0) {
      const configurationChangeEvent = new ConfigurationChangeEvent({ keys: changedKeys, overrides: [] }, previous, this._configuration, void 0, this.logService);
      configurationChangeEvent.source = ConfigurationTarget.MEMORY;
      this._onDidChangeConfiguration.fire(configurationChangeEvent);
    }
    return Promise.resolve();
  }
  updateValue(key, value, arg3, arg4) {
    return this.updateValues([[key, value]]);
  }
  inspect(key, options = {}) {
    return this._configuration.inspect(key, options, void 0);
  }
  keys() {
    return this._configuration.keys(void 0);
  }
  reloadConfiguration() {
    return Promise.resolve(void 0);
  }
  getConfigurationData() {
    const emptyModel = {
      contents: {},
      keys: [],
      overrides: []
    };
    return {
      defaults: emptyModel,
      policy: emptyModel,
      application: emptyModel,
      userLocal: emptyModel,
      userRemote: emptyModel,
      workspace: emptyModel,
      folders: []
    };
  }
};
StandaloneConfigurationService = __decorateClass([
  __decorateParam(0, ILogService)
], StandaloneConfigurationService);
let StandaloneResourceConfigurationService = class {
  constructor(configurationService, modelService, languageService) {
    this.configurationService = configurationService;
    this.modelService = modelService;
    this.languageService = languageService;
    this._onDidChangeConfiguration = new Emitter();
    this.onDidChangeConfiguration = this._onDidChangeConfiguration.event;
    this.configurationService.onDidChangeConfiguration((e) => {
      this._onDidChangeConfiguration.fire({ affectedKeys: e.affectedKeys, affectsConfiguration: (resource, configuration) => e.affectsConfiguration(configuration) });
    });
  }
  getValue(resource, arg2, arg3) {
    const position = Pos.isIPosition(arg2) ? arg2 : null;
    const section = position ? typeof arg3 === "string" ? arg3 : void 0 : typeof arg2 === "string" ? arg2 : void 0;
    const language = resource ? this.getLanguage(resource, position) : void 0;
    if (typeof section === "undefined") {
      return this.configurationService.getValue({
        resource,
        overrideIdentifier: language
      });
    }
    return this.configurationService.getValue(section, {
      resource,
      overrideIdentifier: language
    });
  }
  inspect(resource, position, section) {
    const language = resource ? this.getLanguage(resource, position) : void 0;
    return this.configurationService.inspect(section, { resource, overrideIdentifier: language });
  }
  getLanguage(resource, position) {
    const model = this.modelService.getModel(resource);
    if (model) {
      return position ? model.getLanguageIdAtPosition(position.lineNumber, position.column) : model.getLanguageId();
    }
    return this.languageService.guessLanguageIdByFilepathOrFirstLine(resource);
  }
  updateValue(resource, key, value, configurationTarget) {
    return this.configurationService.updateValue(key, value, { resource }, configurationTarget);
  }
};
StandaloneResourceConfigurationService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, IModelService),
  __decorateParam(2, ILanguageService)
], StandaloneResourceConfigurationService);
let StandaloneResourcePropertiesService = class {
  constructor(configurationService) {
    this.configurationService = configurationService;
  }
  getEOL(resource, language) {
    const eol = this.configurationService.getValue("files.eol", { overrideIdentifier: language, resource });
    if (eol && typeof eol === "string" && eol !== "auto") {
      return eol;
    }
    return isLinux || isMacintosh ? "\n" : "\r\n";
  }
};
StandaloneResourcePropertiesService = __decorateClass([
  __decorateParam(0, IConfigurationService)
], StandaloneResourcePropertiesService);
class StandaloneTelemetryService {
  constructor() {
    this.telemetryLevel = TelemetryLevel.NONE;
    this.sessionId = "someValue.sessionId";
    this.machineId = "someValue.machineId";
    this.sqmId = "someValue.sqmId";
    this.devDeviceId = "someValue.devDeviceId";
    this.firstSessionDate = "someValue.firstSessionDate";
    this.sendErrorTelemetry = false;
  }
  setEnabled() {
  }
  setExperimentProperty() {
  }
  publicLog() {
  }
  publicLog2() {
  }
  publicLogError() {
  }
  publicLogError2() {
  }
}
const _StandaloneWorkspaceContextService = class _StandaloneWorkspaceContextService {
  constructor() {
    this._onDidChangeWorkspaceName = new Emitter();
    this.onDidChangeWorkspaceName = this._onDidChangeWorkspaceName.event;
    this._onWillChangeWorkspaceFolders = new Emitter();
    this.onWillChangeWorkspaceFolders = this._onWillChangeWorkspaceFolders.event;
    this._onDidChangeWorkspaceFolders = new Emitter();
    this.onDidChangeWorkspaceFolders = this._onDidChangeWorkspaceFolders.event;
    this._onDidChangeWorkbenchState = new Emitter();
    this.onDidChangeWorkbenchState = this._onDidChangeWorkbenchState.event;
    const resource = URI.from({ scheme: _StandaloneWorkspaceContextService.SCHEME, authority: "model", path: "/" });
    this.workspace = { id: STANDALONE_EDITOR_WORKSPACE_ID, folders: [new WorkspaceFolder({ uri: resource, name: "", index: 0 })] };
  }
  getCompleteWorkspace() {
    return Promise.resolve(this.getWorkspace());
  }
  getWorkspace() {
    return this.workspace;
  }
  getWorkbenchState() {
    if (this.workspace) {
      if (this.workspace.configuration) {
        return WorkbenchState.WORKSPACE;
      }
      return WorkbenchState.FOLDER;
    }
    return WorkbenchState.EMPTY;
  }
  getWorkspaceFolder(resource) {
    return resource && resource.scheme === _StandaloneWorkspaceContextService.SCHEME ? this.workspace.folders[0] : null;
  }
  isInsideWorkspace(resource) {
    return resource && resource.scheme === _StandaloneWorkspaceContextService.SCHEME;
  }
  isCurrentWorkspace(workspaceIdOrFolder) {
    return true;
  }
};
_StandaloneWorkspaceContextService.SCHEME = "inmemory";
let StandaloneWorkspaceContextService = _StandaloneWorkspaceContextService;
function updateConfigurationService(configurationService, source, isDiffEditor) {
  if (!source) {
    return;
  }
  if (!(configurationService instanceof StandaloneConfigurationService)) {
    return;
  }
  const toUpdate = [];
  Object.keys(source).forEach((key) => {
    if (isEditorConfigurationKey(key)) {
      toUpdate.push([`editor.${key}`, source[key]]);
    }
    if (isDiffEditor && isDiffEditorConfigurationKey(key)) {
      toUpdate.push([`diffEditor.${key}`, source[key]]);
    }
  });
  if (toUpdate.length > 0) {
    configurationService.updateValues(toUpdate);
  }
}
let StandaloneBulkEditService = class {
  constructor(_modelService) {
    this._modelService = _modelService;
  }
  hasPreviewHandler() {
    return false;
  }
  setPreviewHandler() {
    return Disposable.None;
  }
  async apply(editsIn, _options) {
    const edits = Array.isArray(editsIn) ? editsIn : ResourceEdit.convert(editsIn);
    const textEdits = /* @__PURE__ */ new Map();
    for (const edit of edits) {
      if (!(edit instanceof ResourceTextEdit)) {
        throw new Error("bad edit - only text edits are supported");
      }
      const model = this._modelService.getModel(edit.resource);
      if (!model) {
        throw new Error("bad edit - model not found");
      }
      if (typeof edit.versionId === "number" && model.getVersionId() !== edit.versionId) {
        throw new Error("bad state - model changed in the meantime");
      }
      let array = textEdits.get(model);
      if (!array) {
        array = [];
        textEdits.set(model, array);
      }
      array.push(EditOperation.replaceMove(Range.lift(edit.textEdit.range), edit.textEdit.text));
    }
    let totalEdits = 0;
    let totalFiles = 0;
    for (const [model, edits2] of textEdits) {
      model.pushStackElement();
      model.pushEditOperations([], edits2, () => []);
      model.pushStackElement();
      totalFiles += 1;
      totalEdits += edits2.length;
    }
    return {
      ariaSummary: strings.format(StandaloneServicesNLS.bulkEditServiceSummary, totalEdits, totalFiles),
      isApplied: totalEdits > 0
    };
  }
};
StandaloneBulkEditService = __decorateClass([
  __decorateParam(0, IModelService)
], StandaloneBulkEditService);
class StandaloneUriLabelService {
  constructor() {
    this.onDidChangeFormatters = Event.None;
  }
  getUriLabel(resource, options) {
    if (resource.scheme === "file") {
      return resource.fsPath;
    }
    return resource.path;
  }
  getUriBasenameLabel(resource) {
    return basename(resource);
  }
  getWorkspaceLabel(workspace, options) {
    return "";
  }
  getSeparator(scheme, authority) {
    return "/";
  }
  registerFormatter(formatter) {
    throw new Error("Not implemented");
  }
  registerCachedFormatter(formatter) {
    return this.registerFormatter(formatter);
  }
  getHostLabel() {
    return "";
  }
  getHostTooltip() {
    return void 0;
  }
}
let StandaloneContextViewService = class extends ContextViewService {
  constructor(layoutService, _codeEditorService) {
    super(layoutService);
    this._codeEditorService = _codeEditorService;
  }
  showContextView(delegate, container, shadowRoot) {
    if (!container) {
      const codeEditor = this._codeEditorService.getFocusedCodeEditor() || this._codeEditorService.getActiveCodeEditor();
      if (codeEditor) {
        container = codeEditor.getContainerDomNode();
      }
    }
    return super.showContextView(delegate, container, shadowRoot);
  }
};
StandaloneContextViewService = __decorateClass([
  __decorateParam(0, ILayoutService),
  __decorateParam(1, ICodeEditorService)
], StandaloneContextViewService);
class StandaloneWorkspaceTrustManagementService {
  constructor() {
    this._neverEmitter = new Emitter();
    this.onDidChangeTrust = this._neverEmitter.event;
    this.onDidChangeTrustedFolders = this._neverEmitter.event;
    this.workspaceResolved = Promise.resolve();
    this.workspaceTrustInitialized = Promise.resolve();
    this.acceptsOutOfWorkspaceFiles = true;
  }
  isWorkspaceTrusted() {
    return true;
  }
  isWorkspaceTrustForced() {
    return false;
  }
  canSetParentFolderTrust() {
    return false;
  }
  async setParentFolderTrust(trusted) {
  }
  canSetWorkspaceTrust() {
    return false;
  }
  async setWorkspaceTrust(trusted) {
  }
  getUriTrustInfo(uri) {
    throw new Error("Method not supported.");
  }
  async setUrisTrust(uri, trusted) {
  }
  getTrustedUris() {
    return [];
  }
  async setTrustedUris(uris) {
  }
  addWorkspaceTrustTransitionParticipant(participant) {
    throw new Error("Method not supported.");
  }
}
class StandaloneLanguageService extends LanguageService {
  constructor() {
    super();
  }
}
class StandaloneLogService extends LogService {
  constructor() {
    super(new ConsoleLogger());
  }
}
let StandaloneContextMenuService = class extends ContextMenuService {
  constructor(telemetryService, notificationService, contextViewService, keybindingService, menuService, contextKeyService) {
    super(telemetryService, notificationService, contextViewService, keybindingService, menuService, contextKeyService);
    this.configure({ blockMouse: false });
  }
};
StandaloneContextMenuService = __decorateClass([
  __decorateParam(0, ITelemetryService),
  __decorateParam(1, INotificationService),
  __decorateParam(2, IContextViewService),
  __decorateParam(3, IKeybindingService),
  __decorateParam(4, IMenuService),
  __decorateParam(5, IContextKeyService)
], StandaloneContextMenuService);
const standaloneEditorWorkerDescriptor = {
  esmModuleLocation: void 0,
  label: "editorWorkerService"
};
let StandaloneEditorWorkerService = class extends EditorWorkerService {
  constructor(modelService, configurationService, logService, languageConfigurationService, languageFeaturesService) {
    super(standaloneEditorWorkerDescriptor, modelService, configurationService, logService, languageConfigurationService, languageFeaturesService);
  }
};
StandaloneEditorWorkerService = __decorateClass([
  __decorateParam(0, IModelService),
  __decorateParam(1, ITextResourceConfigurationService),
  __decorateParam(2, ILogService),
  __decorateParam(3, ILanguageConfigurationService),
  __decorateParam(4, ILanguageFeaturesService)
], StandaloneEditorWorkerService);
class StandaloneAccessbilitySignalService {
  async playSignal(cue, options) {
  }
  async playSignals(cues) {
  }
  getEnabledState(signal, userGesture, modality) {
    return ValueWithChangeEvent.const(false);
  }
  getDelayMs(signal, modality) {
    return 0;
  }
  isSoundEnabled(cue) {
    return false;
  }
  isAnnouncementEnabled(cue) {
    return false;
  }
  onSoundEnabledChanged(cue) {
    return Event.None;
  }
  async playSound(cue, allowManyInParallel) {
  }
  playSignalLoop(cue) {
    return toDisposable(() => {
    });
  }
}
registerSingleton(ILogService, StandaloneLogService, InstantiationType.Eager);
registerSingleton(IConfigurationService, StandaloneConfigurationService, InstantiationType.Eager);
registerSingleton(ITextResourceConfigurationService, StandaloneResourceConfigurationService, InstantiationType.Eager);
registerSingleton(ITextResourcePropertiesService, StandaloneResourcePropertiesService, InstantiationType.Eager);
registerSingleton(IWorkspaceContextService, StandaloneWorkspaceContextService, InstantiationType.Eager);
registerSingleton(ILabelService, StandaloneUriLabelService, InstantiationType.Eager);
registerSingleton(ITelemetryService, StandaloneTelemetryService, InstantiationType.Eager);
registerSingleton(IDialogService, StandaloneDialogService, InstantiationType.Eager);
registerSingleton(IEnvironmentService, StandaloneEnvironmentService, InstantiationType.Eager);
registerSingleton(INotificationService, StandaloneNotificationService, InstantiationType.Eager);
registerSingleton(IMarkerService, MarkerService, InstantiationType.Eager);
registerSingleton(ILanguageService, StandaloneLanguageService, InstantiationType.Eager);
registerSingleton(IStandaloneThemeService, StandaloneThemeService, InstantiationType.Eager);
registerSingleton(IModelService, ModelService, InstantiationType.Eager);
registerSingleton(IMarkerDecorationsService, MarkerDecorationsService, InstantiationType.Eager);
registerSingleton(IContextKeyService, ContextKeyService, InstantiationType.Eager);
registerSingleton(IProgressService, StandaloneProgressService, InstantiationType.Eager);
registerSingleton(IEditorProgressService, StandaloneEditorProgressService, InstantiationType.Eager);
registerSingleton(IStorageService, InMemoryStorageService, InstantiationType.Eager);
registerSingleton(IEditorWorkerService, StandaloneEditorWorkerService, InstantiationType.Eager);
registerSingleton(IBulkEditService, StandaloneBulkEditService, InstantiationType.Eager);
registerSingleton(IWorkspaceTrustManagementService, StandaloneWorkspaceTrustManagementService, InstantiationType.Eager);
registerSingleton(ITextModelService, StandaloneTextModelService, InstantiationType.Eager);
registerSingleton(IAccessibilityService, AccessibilityService, InstantiationType.Eager);
registerSingleton(IListService, ListService, InstantiationType.Eager);
registerSingleton(ICommandService, StandaloneCommandService, InstantiationType.Eager);
registerSingleton(IKeybindingService, StandaloneKeybindingService, InstantiationType.Eager);
registerSingleton(IQuickInputService, StandaloneQuickInputService, InstantiationType.Eager);
registerSingleton(IContextViewService, StandaloneContextViewService, InstantiationType.Eager);
registerSingleton(IOpenerService, OpenerService, InstantiationType.Eager);
registerSingleton(IClipboardService, BrowserClipboardService, InstantiationType.Eager);
registerSingleton(IContextMenuService, StandaloneContextMenuService, InstantiationType.Eager);
registerSingleton(IMenuService, MenuService, InstantiationType.Eager);
registerSingleton(IAccessibilitySignalService, StandaloneAccessbilitySignalService, InstantiationType.Eager);
registerSingleton(ITreeSitterParserService, StandaloneTreeSitterParserService, InstantiationType.Eager);
var StandaloneServices;
((StandaloneServices2) => {
  const serviceCollection = new ServiceCollection();
  for (const [id, descriptor] of getSingletonServiceDescriptors()) {
    serviceCollection.set(id, descriptor);
  }
  const instantiationService = new InstantiationService(serviceCollection, true);
  serviceCollection.set(IInstantiationService, instantiationService);
  function get(serviceId) {
    if (!initialized) {
      initialize({});
    }
    const r = serviceCollection.get(serviceId);
    if (!r) {
      throw new Error("Missing service " + serviceId);
    }
    if (r instanceof SyncDescriptor) {
      return instantiationService.invokeFunction((accessor) => accessor.get(serviceId));
    } else {
      return r;
    }
  }
  StandaloneServices2.get = get;
  let initialized = false;
  const onDidInitialize = new Emitter();
  function initialize(overrides) {
    if (initialized) {
      return instantiationService;
    }
    initialized = true;
    for (const [id, descriptor] of getSingletonServiceDescriptors()) {
      if (!serviceCollection.get(id)) {
        serviceCollection.set(id, descriptor);
      }
    }
    for (const serviceId in overrides) {
      if (overrides.hasOwnProperty(serviceId)) {
        const serviceIdentifier = createDecorator(serviceId);
        const r = serviceCollection.get(serviceIdentifier);
        if (r instanceof SyncDescriptor) {
          serviceCollection.set(serviceIdentifier, overrides[serviceId]);
        }
      }
    }
    const editorFeatures = getEditorFeatures();
    for (const feature of editorFeatures) {
      try {
        instantiationService.createInstance(feature);
      } catch (err) {
        onUnexpectedError(err);
      }
    }
    onDidInitialize.fire();
    return instantiationService;
  }
  StandaloneServices2.initialize = initialize;
  function withServices(callback) {
    if (initialized) {
      return callback();
    }
    const disposable = new DisposableStore();
    const listener = disposable.add(onDidInitialize.event(() => {
      listener.dispose();
      disposable.add(callback());
    }));
    return disposable;
  }
  StandaloneServices2.withServices = withServices;
})(StandaloneServices || (StandaloneServices = {}));
export {
  StandaloneCommandService,
  StandaloneConfigurationService,
  StandaloneKeybindingService,
  StandaloneNotificationService,
  StandaloneServices,
  updateConfigurationService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3Ivc3RhbmRhbG9uZS9icm93c2VyL3N0YW5kYWxvbmVTZXJ2aWNlcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi9zdGFuZGFsb25lQ29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0ICcuL3N0YW5kYWxvbmVMYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCAnLi4vLi4vLi4vcGxhdGZvcm0vdW5kb1JlZG8vY29tbW9uL3VuZG9SZWRvU2VydmljZS5qcyc7XG5pbXBvcnQgJy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVEZWJvdW5jZS5qcyc7XG5pbXBvcnQgJy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9zZW1hbnRpY1Rva2Vuc1N0eWxpbmdTZXJ2aWNlLmpzJztcbmltcG9ydCAnLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmpzJztcbmltcG9ydCAnLi4vLi4vYnJvd3Nlci9zZXJ2aWNlcy9ob3ZlclNlcnZpY2UvaG92ZXJTZXJ2aWNlLmpzJztcblxuaW1wb3J0ICogYXMgc3RyaW5ncyBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCAqIGFzIGRvbSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tLmpzJztcbmltcG9ydCB7IFN0YW5kYXJkS2V5Ym9hcmRFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9rZXlib2FyZEV2ZW50LmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50LCBJVmFsdWVXaXRoQ2hhbmdlRXZlbnQsIFZhbHVlV2l0aENoYW5nZUV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgUmVzb2x2ZWRLZXliaW5kaW5nLCBLZXlDb2RlQ2hvcmQsIEtleWJpbmRpbmcsIGRlY29kZUtleWJpbmRpbmcgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9rZXliaW5kaW5ncy5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgSVJlZmVyZW5jZSwgSW1tb3J0YWxSZWZlcmVuY2UsIHRvRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBEaXNwb3NhYmxlLCBjb21iaW5lZERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgT1MsIGlzTGludXgsIGlzTWFjaW50b3NoIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IFNldmVyaXR5IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3NldmVyaXR5LmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJQnVsa0VkaXRPcHRpb25zLCBJQnVsa0VkaXRSZXN1bHQsIElCdWxrRWRpdFNlcnZpY2UsIFJlc291cmNlRWRpdCwgUmVzb3VyY2VUZXh0RWRpdCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc2VydmljZXMvYnVsa0VkaXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGlzRGlmZkVkaXRvckNvbmZpZ3VyYXRpb25LZXksIGlzRWRpdG9yQ29uZmlndXJhdGlvbktleSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yQ29uZmlndXJhdGlvblNjaGVtYS5qcyc7XG5pbXBvcnQgeyBFZGl0T3BlcmF0aW9uLCBJU2luZ2xlRWRpdE9wZXJhdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb3JlL2VkaXRPcGVyYXRpb24uanMnO1xuaW1wb3J0IHsgSVBvc2l0aW9uLCBQb3NpdGlvbiBhcyBQb3MgfSBmcm9tICcuLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwsIElUZXh0U25hcHNob3QgfSBmcm9tICcuLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWwsIElUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIsIElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NlcnZpY2VzL3Jlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UsIElUZXh0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZSwgSVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gJy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy90ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IENvbW1hbmRzUmVnaXN0cnksIElDb21tYW5kRXZlbnQsIElDb21tYW5kSGFuZGxlciwgSUNvbW1hbmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29tbWFuZHMvY29tbW9uL2NvbW1hbmRzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQsIElDb25maWd1cmF0aW9uRGF0YSwgSUNvbmZpZ3VyYXRpb25PdmVycmlkZXMsIElDb25maWd1cmF0aW9uU2VydmljZSwgSUNvbmZpZ3VyYXRpb25Nb2RlbCwgSUNvbmZpZ3VyYXRpb25WYWx1ZSwgQ29uZmlndXJhdGlvblRhcmdldCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvbiwgQ29uZmlndXJhdGlvbk1vZGVsLCBDb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uTW9kZWxzLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSwgQ29udGV4dEtleUV4cHJlc3Npb24gfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElDb25maXJtYXRpb24sIElDb25maXJtYXRpb25SZXN1bHQsIElEaWFsb2dTZXJ2aWNlLCBJSW5wdXRSZXN1bHQsIElQcm9tcHQsIElQcm9tcHRSZXN1bHQsIElQcm9tcHRXaXRoQ3VzdG9tQ2FuY2VsLCBJUHJvbXB0UmVzdWx0V2l0aENhbmNlbCwgSVByb21wdFdpdGhEZWZhdWx0Q2FuY2VsLCBJUHJvbXB0QmFzZUJ1dHRvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yLCBJSW5zdGFudGlhdGlvblNlcnZpY2UsIFNlcnZpY2VJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdEtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24vYWJzdHJhY3RLZXliaW5kaW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UsIElLZXlib2FyZEV2ZW50LCBLZXliaW5kaW5nc1NjaGVtYUNvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmcuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ1Jlc29sdmVyIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZ1Jlc29sdmVyLmpzJztcbmltcG9ydCB7IElLZXliaW5kaW5nSXRlbSwgS2V5YmluZGluZ3NSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgUmVzb2x2ZWRLZXliaW5kaW5nSXRlbSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL3Jlc29sdmVkS2V5YmluZGluZ0l0ZW0uanMnO1xuaW1wb3J0IHsgVVNMYXlvdXRSZXNvbHZlZEtleWJpbmRpbmcgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi91c0xheW91dFJlc29sdmVkS2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlLCBSZXNvdXJjZUxhYmVsRm9ybWF0dGVyLCBJRm9ybWF0dGVyQ2hhbmdlRXZlbnQsIFZlcmJvc2l0eSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2xhYmVsL2NvbW1vbi9sYWJlbC5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uLCBJTm90aWZpY2F0aW9uSGFuZGxlLCBJTm90aWZpY2F0aW9uU2VydmljZSwgSVByb21wdENob2ljZSwgSVByb21wdE9wdGlvbnMsIE5vT3BOb3RpZmljYXRpb24sIElTdGF0dXNNZXNzYWdlT3B0aW9ucywgSU5vdGlmaWNhdGlvblNvdXJjZSwgSU5vdGlmaWNhdGlvblNvdXJjZUZpbHRlciwgTm90aWZpY2F0aW9uc0ZpbHRlciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IElQcm9ncmVzc1J1bm5lciwgSUVkaXRvclByb2dyZXNzU2VydmljZSwgSVByb2dyZXNzU2VydmljZSwgSVByb2dyZXNzLCBJUHJvZ3Jlc3NDb21wb3NpdGVPcHRpb25zLCBJUHJvZ3Jlc3NEaWFsb2dPcHRpb25zLCBJUHJvZ3Jlc3NOb3RpZmljYXRpb25PcHRpb25zLCBJUHJvZ3Jlc3NPcHRpb25zLCBJUHJvZ3Jlc3NTdGVwLCBJUHJvZ3Jlc3NXaW5kb3dPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vcHJvZ3Jlc3MvY29tbW9uL3Byb2dyZXNzLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlLCBUZWxlbWV0cnlMZXZlbCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElTaW5nbGVGb2xkZXJXb3Jrc3BhY2VJZGVudGlmaWVyLCBJV29ya3NwYWNlSWRlbnRpZmllciwgSVdvcmtzcGFjZSwgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBJV29ya3NwYWNlRm9sZGVyLCBJV29ya3NwYWNlRm9sZGVyc0NoYW5nZUV2ZW50LCBJV29ya3NwYWNlRm9sZGVyc1dpbGxDaGFuZ2VFdmVudCwgV29ya2JlbmNoU3RhdGUsIFdvcmtzcGFjZUZvbGRlciwgU1RBTkRBTE9ORV9FRElUT1JfV09SS1NQQUNFX0lEIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSUxheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9sYXlvdXQvYnJvd3Nlci9sYXlvdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFN0YW5kYWxvbmVTZXJ2aWNlc05MUyB9IGZyb20gJy4uLy4uL2NvbW1vbi9zdGFuZGFsb25lU3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL3NlcnZpY2VzL2NvZGVFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENvbnNvbGVMb2dnZXIsIElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UsIElXb3Jrc3BhY2VUcnVzdFRyYW5zaXRpb25QYXJ0aWNpcGFudCwgSVdvcmtzcGFjZVRydXN0VXJpSW5mbyB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlVHJ1c3QuanMnO1xuaW1wb3J0IHsgRWRpdG9yT3B0aW9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yLCBJRGlmZkVkaXRvciB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dE1lbnVTZXJ2aWNlLCBJQ29udGV4dFZpZXdEZWxlZ2F0ZSwgSUNvbnRleHRWaWV3U2VydmljZSwgSU9wZW5Db250ZXh0VmlldyB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHR2aWV3L2Jyb3dzZXIvY29udGV4dFZpZXcuanMnO1xuaW1wb3J0IHsgQ29udGV4dFZpZXdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dHZpZXcvYnJvd3Nlci9jb250ZXh0Vmlld1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0TWVudVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0dmlldy9icm93c2VyL2NvbnRleHRNZW51U2VydmljZS5qcyc7XG5pbXBvcnQgeyBnZXRTaW5nbGV0b25TZXJ2aWNlRGVzY3JpcHRvcnMsIEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc2VydmljZXMvb3BlbmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yV29ya2VyU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9lZGl0b3JXb3JrZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yV29ya2VyU2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc2VydmljZXMvZWRpdG9yV29ya2VyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBNYXJrZXJEZWNvcmF0aW9uc1NlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vc2VydmljZXMvbWFya2VyRGVjb3JhdGlvbnNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElNYXJrZXJEZWNvcmF0aW9uc1NlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vc2VydmljZXMvbWFya2VyRGVjb3JhdGlvbnMuanMnO1xuaW1wb3J0IHsgTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NlcnZpY2VzL21vZGVsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTdGFuZGFsb25lUXVpY2tJbnB1dFNlcnZpY2UgfSBmcm9tICcuL3F1aWNrSW5wdXQvc3RhbmRhbG9uZVF1aWNrSW5wdXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFN0YW5kYWxvbmVUaGVtZVNlcnZpY2UgfSBmcm9tICcuL3N0YW5kYWxvbmVUaGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVN0YW5kYWxvbmVUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vc3RhbmRhbG9uZVRoZW1lLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9icm93c2VyL2FjY2Vzc2liaWxpdHlTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElBY2Nlc3NpYmlsaXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHkvY29tbW9uL2FjY2Vzc2liaWxpdHkuanMnO1xuaW1wb3J0IHsgSU1lbnVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9ucy9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBNZW51U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL21lbnVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEJyb3dzZXJDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL2Jyb3dzZXIvY2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ2xpcGJvYXJkU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NsaXBib2FyZC9jb21tb24vY2xpcGJvYXJkU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvYnJvd3Nlci9jb250ZXh0S2V5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgU2VydmljZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9zZXJ2aWNlQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJTGlzdFNlcnZpY2UsIExpc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElNYXJrZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2Vycy5qcyc7XG5pbXBvcnQgeyBNYXJrZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2VyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IElRdWlja0lucHV0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3F1aWNraW5wdXQvY29tbW9uL3F1aWNrSW5wdXQuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBJbk1lbW9yeVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBEZWZhdWx0Q29uZmlndXJhdGlvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb25zLmpzJztcbmltcG9ydCB7IFdvcmtzcGFjZUVkaXQgfSBmcm9tICcuLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlTaWduYWwsIEFjY2Vzc2liaWxpdHlNb2RhbGl0eSwgSUFjY2Vzc2liaWxpdHlTaWduYWxTZXJ2aWNlLCBTb3VuZCB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2FjY2Vzc2liaWxpdHlTaWduYWwvYnJvd3Nlci9hY2Nlc3NpYmlsaXR5U2lnbmFsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBnZXRFZGl0b3JGZWF0dXJlcyB9IGZyb20gJy4uLy4uL2NvbW1vbi9lZGl0b3JGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25LaW5kLCBJRW52aXJvbm1lbnRTZXJ2aWNlLCBJRXh0ZW5zaW9uSG9zdERlYnVnUGFyYW1zIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IFJlc291cmNlTWFwIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IElUcmVlU2l0dGVyUGFyc2VyU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy90cmVlU2l0dGVyUGFyc2VyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTdGFuZGFsb25lVHJlZVNpdHRlclBhcnNlclNlcnZpY2UgfSBmcm9tICcuL3N0YW5kYWxvbmVUcmVlU2l0dGVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV2ViV29ya2VyRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci93ZWJXb3JrZXJGYWN0b3J5LmpzJztcblxuY2xhc3MgU2ltcGxlTW9kZWwgaW1wbGVtZW50cyBJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWwge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgbW9kZWw6IElUZXh0TW9kZWw7XG5cdHByaXZhdGUgcmVhZG9ubHkgX29uV2lsbERpc3Bvc2U6IEVtaXR0ZXI8dm9pZD47XG5cblx0Y29uc3RydWN0b3IobW9kZWw6IElUZXh0TW9kZWwpIHtcblx0XHR0aGlzLm1vZGVsID0gbW9kZWw7XG5cdFx0dGhpcy5fb25XaWxsRGlzcG9zZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IG9uV2lsbERpc3Bvc2UoKTogRXZlbnQ8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl9vbldpbGxEaXNwb3NlLmV2ZW50O1xuXHR9XG5cblx0cHVibGljIHJlc29sdmUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHR9XG5cblx0cHVibGljIGdldCB0ZXh0RWRpdG9yTW9kZWwoKTogSVRleHRNb2RlbCB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWw7XG5cdH1cblxuXHRwdWJsaWMgY3JlYXRlU25hcHNob3QoKTogSVRleHRTbmFwc2hvdCB7XG5cdFx0cmV0dXJuIHRoaXMubW9kZWwuY3JlYXRlU25hcHNob3QoKTtcblx0fVxuXG5cdHB1YmxpYyBpc1JlYWRvbmx5KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgZGlzcG9zZWQgPSBmYWxzZTtcblx0cHVibGljIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5kaXNwb3NlZCA9IHRydWU7XG5cblx0XHR0aGlzLl9vbldpbGxEaXNwb3NlLmZpcmUoKTtcblx0fVxuXG5cdHB1YmxpYyBpc0Rpc3Bvc2VkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmRpc3Bvc2VkO1xuXHR9XG5cblx0cHVibGljIGlzUmVzb2x2ZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TGFuZ3VhZ2VJZCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLm1vZGVsLmdldExhbmd1YWdlSWQoKTtcblx0fVxufVxuXG5jbGFzcyBTdGFuZGFsb25lVGV4dE1vZGVsU2VydmljZSBpbXBsZW1lbnRzIElUZXh0TW9kZWxTZXJ2aWNlIHtcblx0cHVibGljIF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASU1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZVxuXHQpIHsgfVxuXG5cdHB1YmxpYyBjcmVhdGVNb2RlbFJlZmVyZW5jZShyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxJUmVmZXJlbmNlPElSZXNvbHZlZFRleHRFZGl0b3JNb2RlbD4+IHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMubW9kZWxTZXJ2aWNlLmdldE1vZGVsKHJlc291cmNlKTtcblxuXHRcdGlmICghbW9kZWwpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoYE1vZGVsIG5vdCBmb3VuZGApKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG5ldyBJbW1vcnRhbFJlZmVyZW5jZShuZXcgU2ltcGxlTW9kZWwobW9kZWwpKSk7XG5cdH1cblxuXHRwdWJsaWMgcmVnaXN0ZXJUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIoc2NoZW1lOiBzdHJpbmcsIHByb3ZpZGVyOiBJVGV4dE1vZGVsQ29udGVudFByb3ZpZGVyKTogSURpc3Bvc2FibGUge1xuXHRcdHJldHVybiB7XG5cdFx0XHRkaXNwb3NlOiBmdW5jdGlvbiAoKSB7IC8qIG5vIG9wICovIH1cblx0XHR9O1xuXHR9XG5cblx0cHVibGljIGNhbkhhbmRsZVJlc291cmNlKHJlc291cmNlOiBVUkkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cbn1cblxuY2xhc3MgU3RhbmRhbG9uZUVkaXRvclByb2dyZXNzU2VydmljZSBpbXBsZW1lbnRzIElFZGl0b3JQcm9ncmVzc1NlcnZpY2Uge1xuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHN0YXRpYyBOVUxMX1BST0dSRVNTX1JVTk5FUjogSVByb2dyZXNzUnVubmVyID0ge1xuXHRcdGRvbmU6ICgpID0+IHsgfSxcblx0XHR0b3RhbDogKCkgPT4geyB9LFxuXHRcdHdvcmtlZDogKCkgPT4geyB9XG5cdH07XG5cblx0c2hvdyhpbmZpbml0ZTogdHJ1ZSwgZGVsYXk/OiBudW1iZXIpOiBJUHJvZ3Jlc3NSdW5uZXI7XG5cdHNob3codG90YWw6IG51bWJlciwgZGVsYXk/OiBudW1iZXIpOiBJUHJvZ3Jlc3NSdW5uZXI7XG5cdHNob3coKTogSVByb2dyZXNzUnVubmVyIHtcblx0XHRyZXR1cm4gU3RhbmRhbG9uZUVkaXRvclByb2dyZXNzU2VydmljZS5OVUxMX1BST0dSRVNTX1JVTk5FUjtcblx0fVxuXG5cdGFzeW5jIHNob3dXaGlsZShwcm9taXNlOiBQcm9taXNlPGFueT4sIGRlbGF5PzogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgcHJvbWlzZTtcblx0fVxufVxuXG5jbGFzcyBTdGFuZGFsb25lUHJvZ3Jlc3NTZXJ2aWNlIGltcGxlbWVudHMgSVByb2dyZXNzU2VydmljZSB7XG5cblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0d2l0aFByb2dyZXNzPFI+KF9vcHRpb25zOiBJUHJvZ3Jlc3NPcHRpb25zIHwgSVByb2dyZXNzRGlhbG9nT3B0aW9ucyB8IElQcm9ncmVzc05vdGlmaWNhdGlvbk9wdGlvbnMgfCBJUHJvZ3Jlc3NXaW5kb3dPcHRpb25zIHwgSVByb2dyZXNzQ29tcG9zaXRlT3B0aW9ucywgdGFzazogKHByb2dyZXNzOiBJUHJvZ3Jlc3M8SVByb2dyZXNzU3RlcD4pID0+IFByb21pc2U8Uj4sIG9uRGlkQ2FuY2VsPzogKChjaG9pY2U/OiBudW1iZXIgfCB1bmRlZmluZWQpID0+IHZvaWQpIHwgdW5kZWZpbmVkKTogUHJvbWlzZTxSPiB7XG5cdFx0cmV0dXJuIHRhc2soe1xuXHRcdFx0cmVwb3J0OiAoKSA9PiB7IH0sXG5cdFx0fSk7XG5cdH1cbn1cblxuY2xhc3MgU3RhbmRhbG9uZUVudmlyb25tZW50U2VydmljZSBpbXBsZW1lbnRzIElFbnZpcm9ubWVudFNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHJlYWRvbmx5IHN0YXRlUmVzb3VyY2U6IFVSSSA9IFVSSS5mcm9tKHsgc2NoZW1lOiAnbW9uYWNvJywgYXV0aG9yaXR5OiAnc3RhdGVSZXNvdXJjZScgfSk7XG5cdHJlYWRvbmx5IHVzZXJSb2FtaW5nRGF0YUhvbWU6IFVSSSA9IFVSSS5mcm9tKHsgc2NoZW1lOiAnbW9uYWNvJywgYXV0aG9yaXR5OiAndXNlclJvYW1pbmdEYXRhSG9tZScgfSk7XG5cdHJlYWRvbmx5IGtleWJvYXJkTGF5b3V0UmVzb3VyY2U6IFVSSSA9IFVSSS5mcm9tKHsgc2NoZW1lOiAnbW9uYWNvJywgYXV0aG9yaXR5OiAna2V5Ym9hcmRMYXlvdXRSZXNvdXJjZScgfSk7XG5cdHJlYWRvbmx5IGFyZ3ZSZXNvdXJjZTogVVJJID0gVVJJLmZyb20oeyBzY2hlbWU6ICdtb25hY28nLCBhdXRob3JpdHk6ICdhcmd2UmVzb3VyY2UnIH0pO1xuXHRyZWFkb25seSB1bnRpdGxlZFdvcmtzcGFjZXNIb21lOiBVUkkgPSBVUkkuZnJvbSh7IHNjaGVtZTogJ21vbmFjbycsIGF1dGhvcml0eTogJ3VudGl0bGVkV29ya3NwYWNlc0hvbWUnIH0pO1xuXHRyZWFkb25seSB3b3Jrc3BhY2VTdG9yYWdlSG9tZTogVVJJID0gVVJJLmZyb20oeyBzY2hlbWU6ICdtb25hY28nLCBhdXRob3JpdHk6ICd3b3Jrc3BhY2VTdG9yYWdlSG9tZScgfSk7XG5cdHJlYWRvbmx5IGxvY2FsSGlzdG9yeUhvbWU6IFVSSSA9IFVSSS5mcm9tKHsgc2NoZW1lOiAnbW9uYWNvJywgYXV0aG9yaXR5OiAnbG9jYWxIaXN0b3J5SG9tZScgfSk7XG5cdHJlYWRvbmx5IGNhY2hlSG9tZTogVVJJID0gVVJJLmZyb20oeyBzY2hlbWU6ICdtb25hY28nLCBhdXRob3JpdHk6ICdjYWNoZUhvbWUnIH0pO1xuXHRyZWFkb25seSB1c2VyRGF0YVN5bmNIb21lOiBVUkkgPSBVUkkuZnJvbSh7IHNjaGVtZTogJ21vbmFjbycsIGF1dGhvcml0eTogJ3VzZXJEYXRhU3luY0hvbWUnIH0pO1xuXHRyZWFkb25seSBzeW5jOiAnb24nIHwgJ29mZicgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGNvbnRpbnVlT24/OiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGVkaXRTZXNzaW9uSWQ/OiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGRlYnVnRXh0ZW5zaW9uSG9zdDogSUV4dGVuc2lvbkhvc3REZWJ1Z1BhcmFtcyA9IHsgcG9ydDogbnVsbCwgYnJlYWs6IGZhbHNlIH07XG5cdHJlYWRvbmx5IGlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0cmVhZG9ubHkgZGlzYWJsZUV4dGVuc2lvbnM6IGJvb2xlYW4gfCBzdHJpbmdbXSA9IGZhbHNlO1xuXHRyZWFkb25seSBlbmFibGVFeHRlbnNpb25zPzogcmVhZG9ubHkgc3RyaW5nW10gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGV4dGVuc2lvbkRldmVsb3BtZW50TG9jYXRpb25VUkk/OiBVUklbXSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgZXh0ZW5zaW9uRGV2ZWxvcG1lbnRLaW5kPzogRXh0ZW5zaW9uS2luZFtdIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRyZWFkb25seSBleHRlbnNpb25UZXN0c0xvY2F0aW9uVVJJPzogVVJJIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRyZWFkb25seSBsb2dzSG9tZTogVVJJID0gVVJJLmZyb20oeyBzY2hlbWU6ICdtb25hY28nLCBhdXRob3JpdHk6ICdsb2dzSG9tZScgfSk7XG5cdHJlYWRvbmx5IGxvZ0xldmVsPzogc3RyaW5nIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRyZWFkb25seSBleHRlbnNpb25Mb2dMZXZlbD86IFtzdHJpbmcsIHN0cmluZ11bXSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgdmVyYm9zZTogYm9vbGVhbiA9IGZhbHNlO1xuXHRyZWFkb25seSBpc0J1aWx0OiBib29sZWFuID0gZmFsc2U7XG5cdHJlYWRvbmx5IGRpc2FibGVUZWxlbWV0cnk6IGJvb2xlYW4gPSBmYWxzZTtcblx0cmVhZG9ubHkgc2VydmljZU1hY2hpbmVJZFJlc291cmNlOiBVUkkgPSBVUkkuZnJvbSh7IHNjaGVtZTogJ21vbmFjbycsIGF1dGhvcml0eTogJ3NlcnZpY2VNYWNoaW5lSWRSZXNvdXJjZScgfSk7XG5cdHJlYWRvbmx5IHBvbGljeUZpbGU/OiBVUkkgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG59XG5cbmNsYXNzIFN0YW5kYWxvbmVEaWFsb2dTZXJ2aWNlIGltcGxlbWVudHMgSURpYWxvZ1NlcnZpY2Uge1xuXG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRyZWFkb25seSBvbldpbGxTaG93RGlhbG9nID0gRXZlbnQuTm9uZTtcblx0cmVhZG9ubHkgb25EaWRTaG93RGlhbG9nID0gRXZlbnQuTm9uZTtcblxuXHRhc3luYyBjb25maXJtKGNvbmZpcm1hdGlvbjogSUNvbmZpcm1hdGlvbik6IFByb21pc2U8SUNvbmZpcm1hdGlvblJlc3VsdD4ge1xuXHRcdGNvbnN0IGNvbmZpcm1lZCA9IHRoaXMuZG9Db25maXJtKGNvbmZpcm1hdGlvbi5tZXNzYWdlLCBjb25maXJtYXRpb24uZGV0YWlsKTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRjb25maXJtZWQsXG5cdFx0XHRjaGVja2JveENoZWNrZWQ6IGZhbHNlIC8vIHVuc3VwcG9ydGVkXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgZG9Db25maXJtKG1lc3NhZ2U6IHN0cmluZywgZGV0YWlsPzogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0bGV0IG1lc3NhZ2VUZXh0ID0gbWVzc2FnZTtcblx0XHRpZiAoZGV0YWlsKSB7XG5cdFx0XHRtZXNzYWdlVGV4dCA9IG1lc3NhZ2VUZXh0ICsgJ1xcblxcbicgKyBkZXRhaWw7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG1haW5XaW5kb3cuY29uZmlybShtZXNzYWdlVGV4dCk7XG5cdH1cblxuXHRwcm9tcHQ8VD4ocHJvbXB0OiBJUHJvbXB0V2l0aEN1c3RvbUNhbmNlbDxUPik6IFByb21pc2U8SVByb21wdFJlc3VsdFdpdGhDYW5jZWw8VD4+O1xuXHRwcm9tcHQ8VD4ocHJvbXB0OiBJUHJvbXB0PFQ+KTogUHJvbWlzZTxJUHJvbXB0UmVzdWx0PFQ+Pjtcblx0cHJvbXB0PFQ+KHByb21wdDogSVByb21wdFdpdGhEZWZhdWx0Q2FuY2VsPFQ+KTogUHJvbWlzZTxJUHJvbXB0UmVzdWx0PFQ+Pjtcblx0YXN5bmMgcHJvbXB0PFQ+KHByb21wdDogSVByb21wdDxUPiB8IElQcm9tcHRXaXRoQ3VzdG9tQ2FuY2VsPFQ+KTogUHJvbWlzZTxJUHJvbXB0UmVzdWx0PFQ+IHwgSVByb21wdFJlc3VsdFdpdGhDYW5jZWw8VD4+IHtcblx0XHRsZXQgcmVzdWx0OiBUIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGNvbmZpcm1lZCA9IHRoaXMuZG9Db25maXJtKHByb21wdC5tZXNzYWdlLCBwcm9tcHQuZGV0YWlsKTtcblx0XHRpZiAoY29uZmlybWVkKSB7XG5cdFx0XHRjb25zdCBwcm9tcHRCdXR0b25zOiBJUHJvbXB0QmFzZUJ1dHRvbjxUPltdID0gWy4uLihwcm9tcHQuYnV0dG9ucyA/PyBbXSldO1xuXHRcdFx0aWYgKHByb21wdC5jYW5jZWxCdXR0b24gJiYgdHlwZW9mIHByb21wdC5jYW5jZWxCdXR0b24gIT09ICdzdHJpbmcnICYmIHR5cGVvZiBwcm9tcHQuY2FuY2VsQnV0dG9uICE9PSAnYm9vbGVhbicpIHtcblx0XHRcdFx0cHJvbXB0QnV0dG9ucy5wdXNoKHByb21wdC5jYW5jZWxCdXR0b24pO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXN1bHQgPSBhd2FpdCBwcm9tcHRCdXR0b25zWzBdPy5ydW4oeyBjaGVja2JveENoZWNrZWQ6IGZhbHNlIH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiB7IHJlc3VsdCB9O1xuXHR9XG5cblx0YXN5bmMgaW5mbyhtZXNzYWdlOiBzdHJpbmcsIGRldGFpbD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMucHJvbXB0KHsgdHlwZTogU2V2ZXJpdHkuSW5mbywgbWVzc2FnZSwgZGV0YWlsIH0pO1xuXHR9XG5cblx0YXN5bmMgd2FybihtZXNzYWdlOiBzdHJpbmcsIGRldGFpbD86IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMucHJvbXB0KHsgdHlwZTogU2V2ZXJpdHkuV2FybmluZywgbWVzc2FnZSwgZGV0YWlsIH0pO1xuXHR9XG5cblx0YXN5bmMgZXJyb3IobWVzc2FnZTogc3RyaW5nLCBkZXRhaWw/OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLnByb21wdCh7IHR5cGU6IFNldmVyaXR5LkVycm9yLCBtZXNzYWdlLCBkZXRhaWwgfSk7XG5cdH1cblxuXHRpbnB1dCgpOiBQcm9taXNlPElJbnB1dFJlc3VsdD4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoeyBjb25maXJtZWQ6IGZhbHNlIH0pOyAvLyB1bnN1cHBvcnRlZFxuXHR9XG5cblx0YWJvdXQoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh1bmRlZmluZWQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBTdGFuZGFsb25lTm90aWZpY2F0aW9uU2VydmljZSBpbXBsZW1lbnRzIElOb3RpZmljYXRpb25TZXJ2aWNlIHtcblxuXHRyZWFkb25seSBvbkRpZEFkZE5vdGlmaWNhdGlvbjogRXZlbnQ8SU5vdGlmaWNhdGlvbj4gPSBFdmVudC5Ob25lO1xuXG5cdHJlYWRvbmx5IG9uRGlkUmVtb3ZlTm90aWZpY2F0aW9uOiBFdmVudDxJTm90aWZpY2F0aW9uPiA9IEV2ZW50Lk5vbmU7XG5cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VGaWx0ZXI6IEV2ZW50PHZvaWQ+ID0gRXZlbnQuTm9uZTtcblxuXHRwdWJsaWMgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IE5PX09QOiBJTm90aWZpY2F0aW9uSGFuZGxlID0gbmV3IE5vT3BOb3RpZmljYXRpb24oKTtcblxuXHRwdWJsaWMgaW5mbyhtZXNzYWdlOiBzdHJpbmcpOiBJTm90aWZpY2F0aW9uSGFuZGxlIHtcblx0XHRyZXR1cm4gdGhpcy5ub3RpZnkoeyBzZXZlcml0eTogU2V2ZXJpdHkuSW5mbywgbWVzc2FnZSB9KTtcblx0fVxuXG5cdHB1YmxpYyB3YXJuKG1lc3NhZ2U6IHN0cmluZyk6IElOb3RpZmljYXRpb25IYW5kbGUge1xuXHRcdHJldHVybiB0aGlzLm5vdGlmeSh7IHNldmVyaXR5OiBTZXZlcml0eS5XYXJuaW5nLCBtZXNzYWdlIH0pO1xuXHR9XG5cblx0cHVibGljIGVycm9yKGVycm9yOiBzdHJpbmcgfCBFcnJvcik6IElOb3RpZmljYXRpb25IYW5kbGUge1xuXHRcdHJldHVybiB0aGlzLm5vdGlmeSh7IHNldmVyaXR5OiBTZXZlcml0eS5FcnJvciwgbWVzc2FnZTogZXJyb3IgfSk7XG5cdH1cblxuXHRwdWJsaWMgbm90aWZ5KG5vdGlmaWNhdGlvbjogSU5vdGlmaWNhdGlvbik6IElOb3RpZmljYXRpb25IYW5kbGUge1xuXHRcdHN3aXRjaCAobm90aWZpY2F0aW9uLnNldmVyaXR5KSB7XG5cdFx0XHRjYXNlIFNldmVyaXR5LkVycm9yOlxuXHRcdFx0XHRjb25zb2xlLmVycm9yKG5vdGlmaWNhdGlvbi5tZXNzYWdlKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIFNldmVyaXR5Lldhcm5pbmc6XG5cdFx0XHRcdGNvbnNvbGUud2Fybihub3RpZmljYXRpb24ubWVzc2FnZSk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0Y29uc29sZS5sb2cobm90aWZpY2F0aW9uLm1lc3NhZ2UpO1xuXHRcdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRyZXR1cm4gU3RhbmRhbG9uZU5vdGlmaWNhdGlvblNlcnZpY2UuTk9fT1A7XG5cdH1cblxuXHRwdWJsaWMgcHJvbXB0KHNldmVyaXR5OiBTZXZlcml0eSwgbWVzc2FnZTogc3RyaW5nLCBjaG9pY2VzOiBJUHJvbXB0Q2hvaWNlW10sIG9wdGlvbnM/OiBJUHJvbXB0T3B0aW9ucyk6IElOb3RpZmljYXRpb25IYW5kbGUge1xuXHRcdHJldHVybiBTdGFuZGFsb25lTm90aWZpY2F0aW9uU2VydmljZS5OT19PUDtcblx0fVxuXG5cdHB1YmxpYyBzdGF0dXMobWVzc2FnZTogc3RyaW5nIHwgRXJyb3IsIG9wdGlvbnM/OiBJU3RhdHVzTWVzc2FnZU9wdGlvbnMpOiBJRGlzcG9zYWJsZSB7XG5cdFx0cmV0dXJuIERpc3Bvc2FibGUuTm9uZTtcblx0fVxuXG5cblx0cHVibGljIHNldEZpbHRlcihmaWx0ZXI6IE5vdGlmaWNhdGlvbnNGaWx0ZXIgfCBJTm90aWZpY2F0aW9uU291cmNlRmlsdGVyKTogdm9pZCB7IH1cblxuXHRwdWJsaWMgZ2V0RmlsdGVyKHNvdXJjZT86IElOb3RpZmljYXRpb25Tb3VyY2UpOiBOb3RpZmljYXRpb25zRmlsdGVyIHtcblx0XHRyZXR1cm4gTm90aWZpY2F0aW9uc0ZpbHRlci5PRkY7XG5cdH1cblxuXHRwdWJsaWMgZ2V0RmlsdGVycygpOiBJTm90aWZpY2F0aW9uU291cmNlRmlsdGVyW10ge1xuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdHB1YmxpYyByZW1vdmVGaWx0ZXIoc291cmNlSWQ6IHN0cmluZyk6IHZvaWQgeyB9XG59XG5cbmV4cG9ydCBjbGFzcyBTdGFuZGFsb25lQ29tbWFuZFNlcnZpY2UgaW1wbGVtZW50cyBJQ29tbWFuZFNlcnZpY2Uge1xuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uV2lsbEV4ZWN1dGVDb21tYW5kID0gbmV3IEVtaXR0ZXI8SUNvbW1hbmRFdmVudD4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRFeGVjdXRlQ29tbWFuZCA9IG5ldyBFbWl0dGVyPElDb21tYW5kRXZlbnQ+KCk7XG5cdHB1YmxpYyByZWFkb25seSBvbldpbGxFeGVjdXRlQ29tbWFuZDogRXZlbnQ8SUNvbW1hbmRFdmVudD4gPSB0aGlzLl9vbldpbGxFeGVjdXRlQ29tbWFuZC5ldmVudDtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkRXhlY3V0ZUNvbW1hbmQ6IEV2ZW50PElDb21tYW5kRXZlbnQ+ID0gdGhpcy5fb25EaWRFeGVjdXRlQ29tbWFuZC5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2Vcblx0KSB7XG5cdFx0dGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZTtcblx0fVxuXG5cdHB1YmxpYyBleGVjdXRlQ29tbWFuZDxUPihpZDogc3RyaW5nLCAuLi5hcmdzOiBhbnlbXSk6IFByb21pc2U8VD4ge1xuXHRcdGNvbnN0IGNvbW1hbmQgPSBDb21tYW5kc1JlZ2lzdHJ5LmdldENvbW1hbmQoaWQpO1xuXHRcdGlmICghY29tbWFuZCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcihgY29tbWFuZCAnJHtpZH0nIG5vdCBmb3VuZGApKTtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0dGhpcy5fb25XaWxsRXhlY3V0ZUNvbW1hbmQuZmlyZSh7IGNvbW1hbmRJZDogaWQsIGFyZ3MgfSk7XG5cdFx0XHRjb25zdCByZXN1bHQgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbi5hcHBseSh0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZSwgW2NvbW1hbmQuaGFuZGxlciwgLi4uYXJnc10pIGFzIFQ7XG5cblx0XHRcdHRoaXMuX29uRGlkRXhlY3V0ZUNvbW1hbmQuZmlyZSh7IGNvbW1hbmRJZDogaWQsIGFyZ3MgfSk7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlc3VsdCk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZWplY3QoZXJyKTtcblx0XHR9XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJS2V5YmluZGluZ1J1bGUge1xuXHRrZXliaW5kaW5nOiBudW1iZXI7XG5cdGNvbW1hbmQ/OiBzdHJpbmcgfCBudWxsO1xuXHRjb21tYW5kQXJncz86IGFueTtcblx0d2hlbj86IENvbnRleHRLZXlFeHByZXNzaW9uIHwgbnVsbDtcbn1cblxuZXhwb3J0IGNsYXNzIFN0YW5kYWxvbmVLZXliaW5kaW5nU2VydmljZSBleHRlbmRzIEFic3RyYWN0S2V5YmluZGluZ1NlcnZpY2Uge1xuXHRwcml2YXRlIF9jYWNoZWRSZXNvbHZlcjogS2V5YmluZGluZ1Jlc29sdmVyIHwgbnVsbDtcblx0cHJpdmF0ZSBfZHluYW1pY0tleWJpbmRpbmdzOiBJS2V5YmluZGluZ0l0ZW1bXTtcblx0cHJpdmF0ZSByZWFkb25seSBfZG9tTm9kZUxpc3RlbmVyczogRG9tTm9kZUxpc3RlbmVyc1tdO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUNvbW1hbmRTZXJ2aWNlIGNvbW1hbmRTZXJ2aWNlOiBJQ29tbWFuZFNlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElDb2RlRWRpdG9yU2VydmljZSBjb2RlRWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKGNvbnRleHRLZXlTZXJ2aWNlLCBjb21tYW5kU2VydmljZSwgdGVsZW1ldHJ5U2VydmljZSwgbm90aWZpY2F0aW9uU2VydmljZSwgbG9nU2VydmljZSk7XG5cblx0XHR0aGlzLl9jYWNoZWRSZXNvbHZlciA9IG51bGw7XG5cdFx0dGhpcy5fZHluYW1pY0tleWJpbmRpbmdzID0gW107XG5cdFx0dGhpcy5fZG9tTm9kZUxpc3RlbmVycyA9IFtdO1xuXG5cdFx0Y29uc3QgYWRkQ29udGFpbmVyID0gKGRvbU5vZGU6IEhUTUxFbGVtZW50KSA9PiB7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdFx0Ly8gZm9yIHN0YW5kYXJkIGtleWJpbmRpbmdzXG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZG9tLmFkZERpc3Bvc2FibGVMaXN0ZW5lcihkb21Ob2RlLCBkb20uRXZlbnRUeXBlLktFWV9ET1dOLCAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdFx0XHRjb25zdCBrZXlFdmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cdFx0XHRcdGNvbnN0IHNob3VsZFByZXZlbnREZWZhdWx0ID0gdGhpcy5fZGlzcGF0Y2goa2V5RXZlbnQsIGtleUV2ZW50LnRhcmdldCk7XG5cdFx0XHRcdGlmIChzaG91bGRQcmV2ZW50RGVmYXVsdCkge1xuXHRcdFx0XHRcdGtleUV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG5cdFx0XHRcdFx0a2V5RXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0Ly8gZm9yIHNpbmdsZSBtb2RpZmllciBjaG9yZCBrZXliaW5kaW5ncyAoZS5nLiBzaGlmdCBzaGlmdClcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChkb20uYWRkRGlzcG9zYWJsZUxpc3RlbmVyKGRvbU5vZGUsIGRvbS5FdmVudFR5cGUuS0VZX1VQLCAoZTogS2V5Ym9hcmRFdmVudCkgPT4ge1xuXHRcdFx0XHRjb25zdCBrZXlFdmVudCA9IG5ldyBTdGFuZGFyZEtleWJvYXJkRXZlbnQoZSk7XG5cdFx0XHRcdGNvbnN0IHNob3VsZFByZXZlbnREZWZhdWx0ID0gdGhpcy5fc2luZ2xlTW9kaWZpZXJEaXNwYXRjaChrZXlFdmVudCwga2V5RXZlbnQudGFyZ2V0KTtcblx0XHRcdFx0aWYgKHNob3VsZFByZXZlbnREZWZhdWx0KSB7XG5cdFx0XHRcdFx0a2V5RXZlbnQucHJldmVudERlZmF1bHQoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHR0aGlzLl9kb21Ob2RlTGlzdGVuZXJzLnB1c2gobmV3IERvbU5vZGVMaXN0ZW5lcnMoZG9tTm9kZSwgZGlzcG9zYWJsZXMpKTtcblx0XHR9O1xuXHRcdGNvbnN0IHJlbW92ZUNvbnRhaW5lciA9IChkb21Ob2RlOiBIVE1MRWxlbWVudCkgPT4ge1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9kb21Ob2RlTGlzdGVuZXJzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGRvbU5vZGVMaXN0ZW5lcnMgPSB0aGlzLl9kb21Ob2RlTGlzdGVuZXJzW2ldO1xuXHRcdFx0XHRpZiAoZG9tTm9kZUxpc3RlbmVycy5kb21Ob2RlID09PSBkb21Ob2RlKSB7XG5cdFx0XHRcdFx0dGhpcy5fZG9tTm9kZUxpc3RlbmVycy5zcGxpY2UoaSwgMSk7XG5cdFx0XHRcdFx0ZG9tTm9kZUxpc3RlbmVycy5kaXNwb3NlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgYWRkQ29kZUVkaXRvciA9IChjb2RlRWRpdG9yOiBJQ29kZUVkaXRvcikgPT4ge1xuXHRcdFx0aWYgKGNvZGVFZGl0b3IuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5pbkRpZmZFZGl0b3IpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGFkZENvbnRhaW5lcihjb2RlRWRpdG9yLmdldENvbnRhaW5lckRvbU5vZGUoKSk7XG5cdFx0fTtcblx0XHRjb25zdCByZW1vdmVDb2RlRWRpdG9yID0gKGNvZGVFZGl0b3I6IElDb2RlRWRpdG9yKSA9PiB7XG5cdFx0XHRpZiAoY29kZUVkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmluRGlmZkVkaXRvcikpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0cmVtb3ZlQ29udGFpbmVyKGNvZGVFZGl0b3IuZ2V0Q29udGFpbmVyRG9tTm9kZSgpKTtcblx0XHR9O1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvZGVFZGl0b3JTZXJ2aWNlLm9uQ29kZUVkaXRvckFkZChhZGRDb2RlRWRpdG9yKSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoY29kZUVkaXRvclNlcnZpY2Uub25Db2RlRWRpdG9yUmVtb3ZlKHJlbW92ZUNvZGVFZGl0b3IpKTtcblx0XHRjb2RlRWRpdG9yU2VydmljZS5saXN0Q29kZUVkaXRvcnMoKS5mb3JFYWNoKGFkZENvZGVFZGl0b3IpO1xuXG5cdFx0Y29uc3QgYWRkRGlmZkVkaXRvciA9IChkaWZmRWRpdG9yOiBJRGlmZkVkaXRvcikgPT4ge1xuXHRcdFx0YWRkQ29udGFpbmVyKGRpZmZFZGl0b3IuZ2V0Q29udGFpbmVyRG9tTm9kZSgpKTtcblx0XHR9O1xuXHRcdGNvbnN0IHJlbW92ZURpZmZFZGl0b3IgPSAoZGlmZkVkaXRvcjogSURpZmZFZGl0b3IpID0+IHtcblx0XHRcdHJlbW92ZUNvbnRhaW5lcihkaWZmRWRpdG9yLmdldENvbnRhaW5lckRvbU5vZGUoKSk7XG5cdFx0fTtcblx0XHR0aGlzLl9yZWdpc3Rlcihjb2RlRWRpdG9yU2VydmljZS5vbkRpZmZFZGl0b3JBZGQoYWRkRGlmZkVkaXRvcikpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGNvZGVFZGl0b3JTZXJ2aWNlLm9uRGlmZkVkaXRvclJlbW92ZShyZW1vdmVEaWZmRWRpdG9yKSk7XG5cdFx0Y29kZUVkaXRvclNlcnZpY2UubGlzdERpZmZFZGl0b3JzKCkuZm9yRWFjaChhZGREaWZmRWRpdG9yKTtcblx0fVxuXG5cdHB1YmxpYyBhZGREeW5hbWljS2V5YmluZGluZyhjb21tYW5kOiBzdHJpbmcsIGtleWJpbmRpbmc6IG51bWJlciwgaGFuZGxlcjogSUNvbW1hbmRIYW5kbGVyLCB3aGVuOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB8IHVuZGVmaW5lZCk6IElEaXNwb3NhYmxlIHtcblx0XHRyZXR1cm4gY29tYmluZWREaXNwb3NhYmxlKFxuXHRcdFx0Q29tbWFuZHNSZWdpc3RyeS5yZWdpc3RlckNvbW1hbmQoY29tbWFuZCwgaGFuZGxlciksXG5cdFx0XHR0aGlzLmFkZER5bmFtaWNLZXliaW5kaW5ncyhbe1xuXHRcdFx0XHRrZXliaW5kaW5nLFxuXHRcdFx0XHRjb21tYW5kLFxuXHRcdFx0XHR3aGVuXG5cdFx0XHR9XSlcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIGFkZER5bmFtaWNLZXliaW5kaW5ncyhydWxlczogSUtleWJpbmRpbmdSdWxlW10pOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgZW50cmllczogSUtleWJpbmRpbmdJdGVtW10gPSBydWxlcy5tYXAoKHJ1bGUpID0+IHtcblx0XHRcdGNvbnN0IGtleWJpbmRpbmcgPSBkZWNvZGVLZXliaW5kaW5nKHJ1bGUua2V5YmluZGluZywgT1MpO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0a2V5YmluZGluZyxcblx0XHRcdFx0Y29tbWFuZDogcnVsZS5jb21tYW5kID8/IG51bGwsXG5cdFx0XHRcdGNvbW1hbmRBcmdzOiBydWxlLmNvbW1hbmRBcmdzLFxuXHRcdFx0XHR3aGVuOiBydWxlLndoZW4sXG5cdFx0XHRcdHdlaWdodDE6IDEwMDAsXG5cdFx0XHRcdHdlaWdodDI6IDAsXG5cdFx0XHRcdGV4dGVuc2lvbklkOiBudWxsLFxuXHRcdFx0XHRpc0J1aWx0aW5FeHRlbnNpb246IGZhbHNlXG5cdFx0XHR9O1xuXHRcdH0pO1xuXHRcdHRoaXMuX2R5bmFtaWNLZXliaW5kaW5ncyA9IHRoaXMuX2R5bmFtaWNLZXliaW5kaW5ncy5jb25jYXQoZW50cmllcyk7XG5cblx0XHR0aGlzLnVwZGF0ZVJlc29sdmVyKCk7XG5cblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdC8vIFNlYXJjaCB0aGUgZmlyc3QgZW50cnkgYW5kIHJlbW92ZSB0aGVtIGFsbCBzaW5jZSB0aGV5IHdpbGwgYmUgY29udGlndW91c1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB0aGlzLl9keW5hbWljS2V5YmluZGluZ3MubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0aWYgKHRoaXMuX2R5bmFtaWNLZXliaW5kaW5nc1tpXSA9PT0gZW50cmllc1swXSkge1xuXHRcdFx0XHRcdHRoaXMuX2R5bmFtaWNLZXliaW5kaW5ncy5zcGxpY2UoaSwgZW50cmllcy5sZW5ndGgpO1xuXHRcdFx0XHRcdHRoaXMudXBkYXRlUmVzb2x2ZXIoKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlUmVzb2x2ZXIoKTogdm9pZCB7XG5cdFx0dGhpcy5fY2FjaGVkUmVzb2x2ZXIgPSBudWxsO1xuXHRcdHRoaXMuX29uRGlkVXBkYXRlS2V5YmluZGluZ3MuZmlyZSgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9nZXRSZXNvbHZlcigpOiBLZXliaW5kaW5nUmVzb2x2ZXIge1xuXHRcdGlmICghdGhpcy5fY2FjaGVkUmVzb2x2ZXIpIHtcblx0XHRcdGNvbnN0IGRlZmF1bHRzID0gdGhpcy5fdG9Ob3JtYWxpemVkS2V5YmluZGluZ0l0ZW1zKEtleWJpbmRpbmdzUmVnaXN0cnkuZ2V0RGVmYXVsdEtleWJpbmRpbmdzKCksIHRydWUpO1xuXHRcdFx0Y29uc3Qgb3ZlcnJpZGVzID0gdGhpcy5fdG9Ob3JtYWxpemVkS2V5YmluZGluZ0l0ZW1zKHRoaXMuX2R5bmFtaWNLZXliaW5kaW5ncywgZmFsc2UpO1xuXHRcdFx0dGhpcy5fY2FjaGVkUmVzb2x2ZXIgPSBuZXcgS2V5YmluZGluZ1Jlc29sdmVyKGRlZmF1bHRzLCBvdmVycmlkZXMsIChzdHIpID0+IHRoaXMuX2xvZyhzdHIpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2NhY2hlZFJlc29sdmVyO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9kb2N1bWVudEhhc0ZvY3VzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBtYWluV2luZG93LmRvY3VtZW50Lmhhc0ZvY3VzKCk7XG5cdH1cblxuXHRwcml2YXRlIF90b05vcm1hbGl6ZWRLZXliaW5kaW5nSXRlbXMoaXRlbXM6IElLZXliaW5kaW5nSXRlbVtdLCBpc0RlZmF1bHQ6IGJvb2xlYW4pOiBSZXNvbHZlZEtleWJpbmRpbmdJdGVtW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogUmVzb2x2ZWRLZXliaW5kaW5nSXRlbVtdID0gW107XG5cdFx0bGV0IHJlc3VsdExlbiA9IDA7XG5cdFx0Zm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG5cdFx0XHRjb25zdCB3aGVuID0gaXRlbS53aGVuIHx8IHVuZGVmaW5lZDtcblx0XHRcdGNvbnN0IGtleWJpbmRpbmcgPSBpdGVtLmtleWJpbmRpbmc7XG5cblx0XHRcdGlmICgha2V5YmluZGluZykge1xuXHRcdFx0XHQvLyBUaGlzIG1pZ2h0IGJlIGEgcmVtb3ZhbCBrZXliaW5kaW5nIGl0ZW0gaW4gdXNlciBzZXR0aW5ncyA9PiBhY2NlcHQgaXRcblx0XHRcdFx0cmVzdWx0W3Jlc3VsdExlbisrXSA9IG5ldyBSZXNvbHZlZEtleWJpbmRpbmdJdGVtKHVuZGVmaW5lZCwgaXRlbS5jb21tYW5kLCBpdGVtLmNvbW1hbmRBcmdzLCB3aGVuLCBpc0RlZmF1bHQsIG51bGwsIGZhbHNlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHJlc29sdmVkS2V5YmluZGluZ3MgPSBVU0xheW91dFJlc29sdmVkS2V5YmluZGluZy5yZXNvbHZlS2V5YmluZGluZyhrZXliaW5kaW5nLCBPUyk7XG5cdFx0XHRcdGZvciAoY29uc3QgcmVzb2x2ZWRLZXliaW5kaW5nIG9mIHJlc29sdmVkS2V5YmluZGluZ3MpIHtcblx0XHRcdFx0XHRyZXN1bHRbcmVzdWx0TGVuKytdID0gbmV3IFJlc29sdmVkS2V5YmluZGluZ0l0ZW0ocmVzb2x2ZWRLZXliaW5kaW5nLCBpdGVtLmNvbW1hbmQsIGl0ZW0uY29tbWFuZEFyZ3MsIHdoZW4sIGlzRGVmYXVsdCwgbnVsbCwgZmFsc2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyByZXNvbHZlS2V5YmluZGluZyhrZXliaW5kaW5nOiBLZXliaW5kaW5nKTogUmVzb2x2ZWRLZXliaW5kaW5nW10ge1xuXHRcdHJldHVybiBVU0xheW91dFJlc29sdmVkS2V5YmluZGluZy5yZXNvbHZlS2V5YmluZGluZyhrZXliaW5kaW5nLCBPUyk7XG5cdH1cblxuXHRwdWJsaWMgcmVzb2x2ZUtleWJvYXJkRXZlbnQoa2V5Ym9hcmRFdmVudDogSUtleWJvYXJkRXZlbnQpOiBSZXNvbHZlZEtleWJpbmRpbmcge1xuXHRcdGNvbnN0IGNob3JkID0gbmV3IEtleUNvZGVDaG9yZChcblx0XHRcdGtleWJvYXJkRXZlbnQuY3RybEtleSxcblx0XHRcdGtleWJvYXJkRXZlbnQuc2hpZnRLZXksXG5cdFx0XHRrZXlib2FyZEV2ZW50LmFsdEtleSxcblx0XHRcdGtleWJvYXJkRXZlbnQubWV0YUtleSxcblx0XHRcdGtleWJvYXJkRXZlbnQua2V5Q29kZVxuXHRcdCk7XG5cdFx0cmV0dXJuIG5ldyBVU0xheW91dFJlc29sdmVkS2V5YmluZGluZyhbY2hvcmRdLCBPUyk7XG5cdH1cblxuXHRwdWJsaWMgcmVzb2x2ZVVzZXJCaW5kaW5nKHVzZXJCaW5kaW5nOiBzdHJpbmcpOiBSZXNvbHZlZEtleWJpbmRpbmdbXSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0cHVibGljIF9kdW1wRGVidWdJbmZvKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cblx0cHVibGljIF9kdW1wRGVidWdJbmZvSlNPTigpOiBzdHJpbmcge1xuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdHB1YmxpYyByZWdpc3RlclNjaGVtYUNvbnRyaWJ1dGlvbihjb250cmlidXRpb246IEtleWJpbmRpbmdzU2NoZW1hQ29udHJpYnV0aW9uKTogdm9pZCB7XG5cdFx0Ly8gbm9vcFxuXHR9XG5cblx0LyoqXG5cdCAqIG5vdCB5ZXQgc3VwcG9ydGVkXG5cdCAqL1xuXHRwdWJsaWMgb3ZlcnJpZGUgZW5hYmxlS2V5YmluZGluZ0hvbGRNb2RlKGNvbW1hbmRJZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG5jbGFzcyBEb21Ob2RlTGlzdGVuZXJzIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBkb21Ob2RlOiBIVE1MRWxlbWVudCxcblx0XHRkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoZGlzcG9zYWJsZXMpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGlzQ29uZmlndXJhdGlvbk92ZXJyaWRlcyh0aGluZzogYW55KTogdGhpbmcgaXMgSUNvbmZpZ3VyYXRpb25PdmVycmlkZXMge1xuXHRyZXR1cm4gdGhpbmdcblx0XHQmJiB0eXBlb2YgdGhpbmcgPT09ICdvYmplY3QnXG5cdFx0JiYgKCF0aGluZy5vdmVycmlkZUlkZW50aWZpZXIgfHwgdHlwZW9mIHRoaW5nLm92ZXJyaWRlSWRlbnRpZmllciA9PT0gJ3N0cmluZycpXG5cdFx0JiYgKCF0aGluZy5yZXNvdXJjZSB8fCB0aGluZy5yZXNvdXJjZSBpbnN0YW5jZW9mIFVSSSk7XG59XG5cbmV4cG9ydCBjbGFzcyBTdGFuZGFsb25lQ29uZmlndXJhdGlvblNlcnZpY2UgaW1wbGVtZW50cyBJQ29uZmlndXJhdGlvblNlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbiA9IG5ldyBFbWl0dGVyPElDb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQ+KCk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZUNvbmZpZ3VyYXRpb246IEV2ZW50PElDb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb246IENvbmZpZ3VyYXRpb247XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdCkge1xuXHRcdGNvbnN0IGRlZmF1bHRDb25maWd1cmF0aW9uID0gbmV3IERlZmF1bHRDb25maWd1cmF0aW9uKGxvZ1NlcnZpY2UpO1xuXHRcdHRoaXMuX2NvbmZpZ3VyYXRpb24gPSBuZXcgQ29uZmlndXJhdGlvbihcblx0XHRcdGRlZmF1bHRDb25maWd1cmF0aW9uLnJlbG9hZCgpLFxuXHRcdFx0Q29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwobG9nU2VydmljZSksXG5cdFx0XHRDb25maWd1cmF0aW9uTW9kZWwuY3JlYXRlRW1wdHlNb2RlbChsb2dTZXJ2aWNlKSxcblx0XHRcdENvbmZpZ3VyYXRpb25Nb2RlbC5jcmVhdGVFbXB0eU1vZGVsKGxvZ1NlcnZpY2UpLFxuXHRcdFx0Q29uZmlndXJhdGlvbk1vZGVsLmNyZWF0ZUVtcHR5TW9kZWwobG9nU2VydmljZSksXG5cdFx0XHRDb25maWd1cmF0aW9uTW9kZWwuY3JlYXRlRW1wdHlNb2RlbChsb2dTZXJ2aWNlKSxcblx0XHRcdG5ldyBSZXNvdXJjZU1hcDxDb25maWd1cmF0aW9uTW9kZWw+KCksXG5cdFx0XHRDb25maWd1cmF0aW9uTW9kZWwuY3JlYXRlRW1wdHlNb2RlbChsb2dTZXJ2aWNlKSxcblx0XHRcdG5ldyBSZXNvdXJjZU1hcDxDb25maWd1cmF0aW9uTW9kZWw+KCksXG5cdFx0XHRsb2dTZXJ2aWNlXG5cdFx0KTtcblx0XHRkZWZhdWx0Q29uZmlndXJhdGlvbi5kaXNwb3NlKCk7XG5cdH1cblxuXHRnZXRWYWx1ZTxUPigpOiBUO1xuXHRnZXRWYWx1ZTxUPihzZWN0aW9uOiBzdHJpbmcpOiBUO1xuXHRnZXRWYWx1ZTxUPihvdmVycmlkZXM6IElDb25maWd1cmF0aW9uT3ZlcnJpZGVzKTogVDtcblx0Z2V0VmFsdWU8VD4oc2VjdGlvbjogc3RyaW5nLCBvdmVycmlkZXM6IElDb25maWd1cmF0aW9uT3ZlcnJpZGVzKTogVDtcblx0Z2V0VmFsdWUoYXJnMT86IGFueSwgYXJnMj86IGFueSk6IGFueSB7XG5cdFx0Y29uc3Qgc2VjdGlvbiA9IHR5cGVvZiBhcmcxID09PSAnc3RyaW5nJyA/IGFyZzEgOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3Qgb3ZlcnJpZGVzID0gaXNDb25maWd1cmF0aW9uT3ZlcnJpZGVzKGFyZzEpID8gYXJnMSA6IGlzQ29uZmlndXJhdGlvbk92ZXJyaWRlcyhhcmcyKSA/IGFyZzIgOiB7fTtcblx0XHRyZXR1cm4gdGhpcy5fY29uZmlndXJhdGlvbi5nZXRWYWx1ZShzZWN0aW9uLCBvdmVycmlkZXMsIHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwdWJsaWMgdXBkYXRlVmFsdWVzKHZhbHVlczogW3N0cmluZywgYW55XVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcHJldmlvdXMgPSB7IGRhdGE6IHRoaXMuX2NvbmZpZ3VyYXRpb24udG9EYXRhKCkgfTtcblxuXHRcdGNvbnN0IGNoYW5nZWRLZXlzOiBzdHJpbmdbXSA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCBlbnRyeSBvZiB2YWx1ZXMpIHtcblx0XHRcdGNvbnN0IFtrZXksIHZhbHVlXSA9IGVudHJ5O1xuXHRcdFx0aWYgKHRoaXMuZ2V0VmFsdWUoa2V5KSA9PT0gdmFsdWUpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9jb25maWd1cmF0aW9uLnVwZGF0ZVZhbHVlKGtleSwgdmFsdWUpO1xuXHRcdFx0Y2hhbmdlZEtleXMucHVzaChrZXkpO1xuXHRcdH1cblxuXHRcdGlmIChjaGFuZ2VkS2V5cy5sZW5ndGggPiAwKSB7XG5cdFx0XHRjb25zdCBjb25maWd1cmF0aW9uQ2hhbmdlRXZlbnQgPSBuZXcgQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50KHsga2V5czogY2hhbmdlZEtleXMsIG92ZXJyaWRlczogW10gfSwgcHJldmlvdXMsIHRoaXMuX2NvbmZpZ3VyYXRpb24sIHVuZGVmaW5lZCwgdGhpcy5sb2dTZXJ2aWNlKTtcblx0XHRcdGNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudC5zb3VyY2UgPSBDb25maWd1cmF0aW9uVGFyZ2V0Lk1FTU9SWTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbi5maXJlKGNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHR9XG5cblx0cHVibGljIHVwZGF0ZVZhbHVlKGtleTogc3RyaW5nLCB2YWx1ZTogYW55LCBhcmczPzogYW55LCBhcmc0PzogYW55KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMudXBkYXRlVmFsdWVzKFtba2V5LCB2YWx1ZV1dKTtcblx0fVxuXG5cdHB1YmxpYyBpbnNwZWN0PEM+KGtleTogc3RyaW5nLCBvcHRpb25zOiBJQ29uZmlndXJhdGlvbk92ZXJyaWRlcyA9IHt9KTogSUNvbmZpZ3VyYXRpb25WYWx1ZTxDPiB7XG5cdFx0cmV0dXJuIHRoaXMuX2NvbmZpZ3VyYXRpb24uaW5zcGVjdDxDPihrZXksIG9wdGlvbnMsIHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwdWJsaWMga2V5cygpIHtcblx0XHRyZXR1cm4gdGhpcy5fY29uZmlndXJhdGlvbi5rZXlzKHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwdWJsaWMgcmVsb2FkQ29uZmlndXJhdGlvbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0Q29uZmlndXJhdGlvbkRhdGEoKTogSUNvbmZpZ3VyYXRpb25EYXRhIHwgbnVsbCB7XG5cdFx0Y29uc3QgZW1wdHlNb2RlbDogSUNvbmZpZ3VyYXRpb25Nb2RlbCA9IHtcblx0XHRcdGNvbnRlbnRzOiB7fSxcblx0XHRcdGtleXM6IFtdLFxuXHRcdFx0b3ZlcnJpZGVzOiBbXVxuXHRcdH07XG5cdFx0cmV0dXJuIHtcblx0XHRcdGRlZmF1bHRzOiBlbXB0eU1vZGVsLFxuXHRcdFx0cG9saWN5OiBlbXB0eU1vZGVsLFxuXHRcdFx0YXBwbGljYXRpb246IGVtcHR5TW9kZWwsXG5cdFx0XHR1c2VyTG9jYWw6IGVtcHR5TW9kZWwsXG5cdFx0XHR1c2VyUmVtb3RlOiBlbXB0eU1vZGVsLFxuXHRcdFx0d29ya3NwYWNlOiBlbXB0eU1vZGVsLFxuXHRcdFx0Zm9sZGVyczogW11cblx0XHR9O1xuXHR9XG59XG5cbmNsYXNzIFN0YW5kYWxvbmVSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGltcGxlbWVudHMgSVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24gPSBuZXcgRW1pdHRlcjxJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50PigpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uID0gdGhpcy5fb25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogU3RhbmRhbG9uZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKChlKSA9PiB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24uZmlyZSh7IGFmZmVjdGVkS2V5czogZS5hZmZlY3RlZEtleXMsIGFmZmVjdHNDb25maWd1cmF0aW9uOiAocmVzb3VyY2U6IFVSSSwgY29uZmlndXJhdGlvbjogc3RyaW5nKSA9PiBlLmFmZmVjdHNDb25maWd1cmF0aW9uKGNvbmZpZ3VyYXRpb24pIH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0Z2V0VmFsdWU8VD4ocmVzb3VyY2U6IFVSSSwgc2VjdGlvbj86IHN0cmluZyk6IFQ7XG5cdGdldFZhbHVlPFQ+KHJlc291cmNlOiBVUkksIHBvc2l0aW9uPzogSVBvc2l0aW9uLCBzZWN0aW9uPzogc3RyaW5nKTogVDtcblx0Z2V0VmFsdWU8VD4ocmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCwgYXJnMj86IGFueSwgYXJnMz86IGFueSkge1xuXHRcdGNvbnN0IHBvc2l0aW9uOiBJUG9zaXRpb24gfCBudWxsID0gUG9zLmlzSVBvc2l0aW9uKGFyZzIpID8gYXJnMiA6IG51bGw7XG5cdFx0Y29uc3Qgc2VjdGlvbjogc3RyaW5nIHwgdW5kZWZpbmVkID0gcG9zaXRpb24gPyAodHlwZW9mIGFyZzMgPT09ICdzdHJpbmcnID8gYXJnMyA6IHVuZGVmaW5lZCkgOiAodHlwZW9mIGFyZzIgPT09ICdzdHJpbmcnID8gYXJnMiA6IHVuZGVmaW5lZCk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2UgPSByZXNvdXJjZSA/IHRoaXMuZ2V0TGFuZ3VhZ2UocmVzb3VyY2UsIHBvc2l0aW9uKSA6IHVuZGVmaW5lZDtcblx0XHRpZiAodHlwZW9mIHNlY3Rpb24gPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxUPih7XG5cdFx0XHRcdHJlc291cmNlLFxuXHRcdFx0XHRvdmVycmlkZUlkZW50aWZpZXI6IGxhbmd1YWdlXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8VD4oc2VjdGlvbiwge1xuXHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRvdmVycmlkZUlkZW50aWZpZXI6IGxhbmd1YWdlXG5cdFx0fSk7XG5cdH1cblxuXHRpbnNwZWN0PFQ+KHJlc291cmNlOiBVUkkgfCB1bmRlZmluZWQsIHBvc2l0aW9uOiBJUG9zaXRpb24gfCBudWxsLCBzZWN0aW9uOiBzdHJpbmcpOiBJQ29uZmlndXJhdGlvblZhbHVlPFJlYWRvbmx5PFQ+PiB7XG5cdFx0Y29uc3QgbGFuZ3VhZ2UgPSByZXNvdXJjZSA/IHRoaXMuZ2V0TGFuZ3VhZ2UocmVzb3VyY2UsIHBvc2l0aW9uKSA6IHVuZGVmaW5lZDtcblx0XHRyZXR1cm4gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5pbnNwZWN0PFQ+KHNlY3Rpb24sIHsgcmVzb3VyY2UsIG92ZXJyaWRlSWRlbnRpZmllcjogbGFuZ3VhZ2UgfSk7XG5cdH1cblxuXHRwcml2YXRlIGdldExhbmd1YWdlKHJlc291cmNlOiBVUkksIHBvc2l0aW9uOiBJUG9zaXRpb24gfCBudWxsKTogc3RyaW5nIHwgbnVsbCB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLm1vZGVsU2VydmljZS5nZXRNb2RlbChyZXNvdXJjZSk7XG5cdFx0aWYgKG1vZGVsKSB7XG5cdFx0XHRyZXR1cm4gcG9zaXRpb24gPyBtb2RlbC5nZXRMYW5ndWFnZUlkQXRQb3NpdGlvbihwb3NpdGlvbi5saW5lTnVtYmVyLCBwb3NpdGlvbi5jb2x1bW4pIDogbW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5sYW5ndWFnZVNlcnZpY2UuZ3Vlc3NMYW5ndWFnZUlkQnlGaWxlcGF0aE9yRmlyc3RMaW5lKHJlc291cmNlKTtcblx0fVxuXG5cdHVwZGF0ZVZhbHVlKHJlc291cmNlOiBVUkksIGtleTogc3RyaW5nLCB2YWx1ZTogYW55LCBjb25maWd1cmF0aW9uVGFyZ2V0PzogQ29uZmlndXJhdGlvblRhcmdldCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKGtleSwgdmFsdWUsIHsgcmVzb3VyY2UgfSwgY29uZmlndXJhdGlvblRhcmdldCk7XG5cdH1cbn1cblxuY2xhc3MgU3RhbmRhbG9uZVJlc291cmNlUHJvcGVydGllc1NlcnZpY2UgaW1wbGVtZW50cyBJVGV4dFJlc291cmNlUHJvcGVydGllc1NlcnZpY2Uge1xuXG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0fVxuXG5cdGdldEVPTChyZXNvdXJjZTogVVJJLCBsYW5ndWFnZT86IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0Y29uc3QgZW9sID0gdGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnZmlsZXMuZW9sJywgeyBvdmVycmlkZUlkZW50aWZpZXI6IGxhbmd1YWdlLCByZXNvdXJjZSB9KTtcblx0XHRpZiAoZW9sICYmIHR5cGVvZiBlb2wgPT09ICdzdHJpbmcnICYmIGVvbCAhPT0gJ2F1dG8nKSB7XG5cdFx0XHRyZXR1cm4gZW9sO1xuXHRcdH1cblx0XHRyZXR1cm4gKGlzTGludXggfHwgaXNNYWNpbnRvc2gpID8gJ1xcbicgOiAnXFxyXFxuJztcblx0fVxufVxuXG5jbGFzcyBTdGFuZGFsb25lVGVsZW1ldHJ5U2VydmljZSBpbXBsZW1lbnRzIElUZWxlbWV0cnlTZXJ2aWNlIHtcblx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IHRlbGVtZXRyeUxldmVsID0gVGVsZW1ldHJ5TGV2ZWwuTk9ORTtcblx0cmVhZG9ubHkgc2Vzc2lvbklkID0gJ3NvbWVWYWx1ZS5zZXNzaW9uSWQnO1xuXHRyZWFkb25seSBtYWNoaW5lSWQgPSAnc29tZVZhbHVlLm1hY2hpbmVJZCc7XG5cdHJlYWRvbmx5IHNxbUlkID0gJ3NvbWVWYWx1ZS5zcW1JZCc7XG5cdHJlYWRvbmx5IGRldkRldmljZUlkID0gJ3NvbWVWYWx1ZS5kZXZEZXZpY2VJZCc7XG5cdHJlYWRvbmx5IGZpcnN0U2Vzc2lvbkRhdGUgPSAnc29tZVZhbHVlLmZpcnN0U2Vzc2lvbkRhdGUnO1xuXHRyZWFkb25seSBzZW5kRXJyb3JUZWxlbWV0cnkgPSBmYWxzZTtcblx0c2V0RW5hYmxlZCgpOiB2b2lkIHsgfVxuXHRzZXRFeHBlcmltZW50UHJvcGVydHkoKTogdm9pZCB7IH1cblx0cHVibGljTG9nKCkgeyB9XG5cdHB1YmxpY0xvZzIoKSB7IH1cblx0cHVibGljTG9nRXJyb3IoKSB7IH1cblx0cHVibGljTG9nRXJyb3IyKCkgeyB9XG59XG5cbmNsYXNzIFN0YW5kYWxvbmVXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBpbXBsZW1lbnRzIElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB7XG5cblx0cHVibGljIF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBTQ0hFTUUgPSAnaW5tZW1vcnknO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlV29ya3NwYWNlTmFtZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZVdvcmtzcGFjZU5hbWU6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VXb3Jrc3BhY2VOYW1lLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uV2lsbENoYW5nZVdvcmtzcGFjZUZvbGRlcnMgPSBuZXcgRW1pdHRlcjxJV29ya3NwYWNlRm9sZGVyc1dpbGxDaGFuZ2VFdmVudD4oKTtcblx0cHVibGljIHJlYWRvbmx5IG9uV2lsbENoYW5nZVdvcmtzcGFjZUZvbGRlcnM6IEV2ZW50PElXb3Jrc3BhY2VGb2xkZXJzV2lsbENoYW5nZUV2ZW50PiA9IHRoaXMuX29uV2lsbENoYW5nZVdvcmtzcGFjZUZvbGRlcnMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VXb3Jrc3BhY2VGb2xkZXJzID0gbmV3IEVtaXR0ZXI8SVdvcmtzcGFjZUZvbGRlcnNDaGFuZ2VFdmVudD4oKTtcblx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlV29ya3NwYWNlRm9sZGVyczogRXZlbnQ8SVdvcmtzcGFjZUZvbGRlcnNDaGFuZ2VFdmVudD4gPSB0aGlzLl9vbkRpZENoYW5nZVdvcmtzcGFjZUZvbGRlcnMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VXb3JrYmVuY2hTdGF0ZSA9IG5ldyBFbWl0dGVyPFdvcmtiZW5jaFN0YXRlPigpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VXb3JrYmVuY2hTdGF0ZTogRXZlbnQ8V29ya2JlbmNoU3RhdGU+ID0gdGhpcy5fb25EaWRDaGFuZ2VXb3JrYmVuY2hTdGF0ZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHdvcmtzcGFjZTogSVdvcmtzcGFjZTtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5mcm9tKHsgc2NoZW1lOiBTdGFuZGFsb25lV29ya3NwYWNlQ29udGV4dFNlcnZpY2UuU0NIRU1FLCBhdXRob3JpdHk6ICdtb2RlbCcsIHBhdGg6ICcvJyB9KTtcblx0XHR0aGlzLndvcmtzcGFjZSA9IHsgaWQ6IFNUQU5EQUxPTkVfRURJVE9SX1dPUktTUEFDRV9JRCwgZm9sZGVyczogW25ldyBXb3Jrc3BhY2VGb2xkZXIoeyB1cmk6IHJlc291cmNlLCBuYW1lOiAnJywgaW5kZXg6IDAgfSldIH07XG5cdH1cblxuXHRnZXRDb21wbGV0ZVdvcmtzcGFjZSgpOiBQcm9taXNlPElXb3Jrc3BhY2U+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHRoaXMuZ2V0V29ya3NwYWNlKCkpO1xuXHR9XG5cblx0cHVibGljIGdldFdvcmtzcGFjZSgpOiBJV29ya3NwYWNlIHtcblx0XHRyZXR1cm4gdGhpcy53b3Jrc3BhY2U7XG5cdH1cblxuXHRwdWJsaWMgZ2V0V29ya2JlbmNoU3RhdGUoKTogV29ya2JlbmNoU3RhdGUge1xuXHRcdGlmICh0aGlzLndvcmtzcGFjZSkge1xuXHRcdFx0aWYgKHRoaXMud29ya3NwYWNlLmNvbmZpZ3VyYXRpb24pIHtcblx0XHRcdFx0cmV0dXJuIFdvcmtiZW5jaFN0YXRlLldPUktTUEFDRTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBXb3JrYmVuY2hTdGF0ZS5GT0xERVI7XG5cdFx0fVxuXHRcdHJldHVybiBXb3JrYmVuY2hTdGF0ZS5FTVBUWTtcblx0fVxuXG5cdHB1YmxpYyBnZXRXb3Jrc3BhY2VGb2xkZXIocmVzb3VyY2U6IFVSSSk6IElXb3Jrc3BhY2VGb2xkZXIgfCBudWxsIHtcblx0XHRyZXR1cm4gcmVzb3VyY2UgJiYgcmVzb3VyY2Uuc2NoZW1lID09PSBTdGFuZGFsb25lV29ya3NwYWNlQ29udGV4dFNlcnZpY2UuU0NIRU1FID8gdGhpcy53b3Jrc3BhY2UuZm9sZGVyc1swXSA6IG51bGw7XG5cdH1cblxuXHRwdWJsaWMgaXNJbnNpZGVXb3Jrc3BhY2UocmVzb3VyY2U6IFVSSSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiByZXNvdXJjZSAmJiByZXNvdXJjZS5zY2hlbWUgPT09IFN0YW5kYWxvbmVXb3Jrc3BhY2VDb250ZXh0U2VydmljZS5TQ0hFTUU7XG5cdH1cblxuXHRwdWJsaWMgaXNDdXJyZW50V29ya3NwYWNlKHdvcmtzcGFjZUlkT3JGb2xkZXI6IElXb3Jrc3BhY2VJZGVudGlmaWVyIHwgSVNpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIgfCBVUkkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdXBkYXRlQ29uZmlndXJhdGlvblNlcnZpY2UoY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSwgc291cmNlOiBhbnksIGlzRGlmZkVkaXRvcjogYm9vbGVhbik6IHZvaWQge1xuXHRpZiAoIXNvdXJjZSkge1xuXHRcdHJldHVybjtcblx0fVxuXHRpZiAoIShjb25maWd1cmF0aW9uU2VydmljZSBpbnN0YW5jZW9mIFN0YW5kYWxvbmVDb25maWd1cmF0aW9uU2VydmljZSkpIHtcblx0XHRyZXR1cm47XG5cdH1cblx0Y29uc3QgdG9VcGRhdGU6IFtzdHJpbmcsIGFueV1bXSA9IFtdO1xuXHRPYmplY3Qua2V5cyhzb3VyY2UpLmZvckVhY2goKGtleSkgPT4ge1xuXHRcdGlmIChpc0VkaXRvckNvbmZpZ3VyYXRpb25LZXkoa2V5KSkge1xuXHRcdFx0dG9VcGRhdGUucHVzaChbYGVkaXRvci4ke2tleX1gLCBzb3VyY2Vba2V5XV0pO1xuXHRcdH1cblx0XHRpZiAoaXNEaWZmRWRpdG9yICYmIGlzRGlmZkVkaXRvckNvbmZpZ3VyYXRpb25LZXkoa2V5KSkge1xuXHRcdFx0dG9VcGRhdGUucHVzaChbYGRpZmZFZGl0b3IuJHtrZXl9YCwgc291cmNlW2tleV1dKTtcblx0XHR9XG5cdH0pO1xuXHRpZiAodG9VcGRhdGUubGVuZ3RoID4gMCkge1xuXHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlcyh0b1VwZGF0ZSk7XG5cdH1cbn1cblxuY2xhc3MgU3RhbmRhbG9uZUJ1bGtFZGl0U2VydmljZSBpbXBsZW1lbnRzIElCdWxrRWRpdFNlcnZpY2Uge1xuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASU1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9tb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2Vcblx0KSB7XG5cdFx0Ly9cblx0fVxuXG5cdGhhc1ByZXZpZXdIYW5kbGVyKCk6IGZhbHNlIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRzZXRQcmV2aWV3SGFuZGxlcigpOiBJRGlzcG9zYWJsZSB7XG5cdFx0cmV0dXJuIERpc3Bvc2FibGUuTm9uZTtcblx0fVxuXG5cdGFzeW5jIGFwcGx5KGVkaXRzSW46IFJlc291cmNlRWRpdFtdIHwgV29ya3NwYWNlRWRpdCwgX29wdGlvbnM/OiBJQnVsa0VkaXRPcHRpb25zKTogUHJvbWlzZTxJQnVsa0VkaXRSZXN1bHQ+IHtcblx0XHRjb25zdCBlZGl0cyA9IEFycmF5LmlzQXJyYXkoZWRpdHNJbikgPyBlZGl0c0luIDogUmVzb3VyY2VFZGl0LmNvbnZlcnQoZWRpdHNJbik7XG5cdFx0Y29uc3QgdGV4dEVkaXRzID0gbmV3IE1hcDxJVGV4dE1vZGVsLCBJU2luZ2xlRWRpdE9wZXJhdGlvbltdPigpO1xuXG5cdFx0Zm9yIChjb25zdCBlZGl0IG9mIGVkaXRzKSB7XG5cdFx0XHRpZiAoIShlZGl0IGluc3RhbmNlb2YgUmVzb3VyY2VUZXh0RWRpdCkpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdiYWQgZWRpdCAtIG9ubHkgdGV4dCBlZGl0cyBhcmUgc3VwcG9ydGVkJyk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX21vZGVsU2VydmljZS5nZXRNb2RlbChlZGl0LnJlc291cmNlKTtcblx0XHRcdGlmICghbW9kZWwpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdiYWQgZWRpdCAtIG1vZGVsIG5vdCBmb3VuZCcpO1xuXHRcdFx0fVxuXHRcdFx0aWYgKHR5cGVvZiBlZGl0LnZlcnNpb25JZCA9PT0gJ251bWJlcicgJiYgbW9kZWwuZ2V0VmVyc2lvbklkKCkgIT09IGVkaXQudmVyc2lvbklkKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignYmFkIHN0YXRlIC0gbW9kZWwgY2hhbmdlZCBpbiB0aGUgbWVhbnRpbWUnKTtcblx0XHRcdH1cblx0XHRcdGxldCBhcnJheSA9IHRleHRFZGl0cy5nZXQobW9kZWwpO1xuXHRcdFx0aWYgKCFhcnJheSkge1xuXHRcdFx0XHRhcnJheSA9IFtdO1xuXHRcdFx0XHR0ZXh0RWRpdHMuc2V0KG1vZGVsLCBhcnJheSk7XG5cdFx0XHR9XG5cdFx0XHRhcnJheS5wdXNoKEVkaXRPcGVyYXRpb24ucmVwbGFjZU1vdmUoUmFuZ2UubGlmdChlZGl0LnRleHRFZGl0LnJhbmdlKSwgZWRpdC50ZXh0RWRpdC50ZXh0KSk7XG5cdFx0fVxuXG5cblx0XHRsZXQgdG90YWxFZGl0cyA9IDA7XG5cdFx0bGV0IHRvdGFsRmlsZXMgPSAwO1xuXHRcdGZvciAoY29uc3QgW21vZGVsLCBlZGl0c10gb2YgdGV4dEVkaXRzKSB7XG5cdFx0XHRtb2RlbC5wdXNoU3RhY2tFbGVtZW50KCk7XG5cdFx0XHRtb2RlbC5wdXNoRWRpdE9wZXJhdGlvbnMoW10sIGVkaXRzLCAoKSA9PiBbXSk7XG5cdFx0XHRtb2RlbC5wdXNoU3RhY2tFbGVtZW50KCk7XG5cdFx0XHR0b3RhbEZpbGVzICs9IDE7XG5cdFx0XHR0b3RhbEVkaXRzICs9IGVkaXRzLmxlbmd0aDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0YXJpYVN1bW1hcnk6IHN0cmluZ3MuZm9ybWF0KFN0YW5kYWxvbmVTZXJ2aWNlc05MUy5idWxrRWRpdFNlcnZpY2VTdW1tYXJ5LCB0b3RhbEVkaXRzLCB0b3RhbEZpbGVzKSxcblx0XHRcdGlzQXBwbGllZDogdG90YWxFZGl0cyA+IDBcblx0XHR9O1xuXHR9XG59XG5cbmNsYXNzIFN0YW5kYWxvbmVVcmlMYWJlbFNlcnZpY2UgaW1wbGVtZW50cyBJTGFiZWxTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VGb3JtYXR0ZXJzOiBFdmVudDxJRm9ybWF0dGVyQ2hhbmdlRXZlbnQ+ID0gRXZlbnQuTm9uZTtcblxuXHRwdWJsaWMgZ2V0VXJpTGFiZWwocmVzb3VyY2U6IFVSSSwgb3B0aW9ucz86IHsgcmVsYXRpdmU/OiBib29sZWFuOyBmb3JjZU5vVGlsZGlmeT86IGJvb2xlYW4gfSk6IHN0cmluZyB7XG5cdFx0aWYgKHJlc291cmNlLnNjaGVtZSA9PT0gJ2ZpbGUnKSB7XG5cdFx0XHRyZXR1cm4gcmVzb3VyY2UuZnNQYXRoO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzb3VyY2UucGF0aDtcblx0fVxuXG5cdGdldFVyaUJhc2VuYW1lTGFiZWwocmVzb3VyY2U6IFVSSSk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGJhc2VuYW1lKHJlc291cmNlKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRXb3Jrc3BhY2VMYWJlbCh3b3Jrc3BhY2U6IElXb3Jrc3BhY2VJZGVudGlmaWVyIHwgSVNpbmdsZUZvbGRlcldvcmtzcGFjZUlkZW50aWZpZXIgfCBVUkkgfCBJV29ya3NwYWNlLCBvcHRpb25zPzogeyB2ZXJib3NlOiBWZXJib3NpdHkgfSk6IHN0cmluZyB7XG5cdFx0cmV0dXJuICcnO1xuXHR9XG5cblx0cHVibGljIGdldFNlcGFyYXRvcihzY2hlbWU6IHN0cmluZywgYXV0aG9yaXR5Pzogc3RyaW5nKTogJy8nIHwgJ1xcXFwnIHtcblx0XHRyZXR1cm4gJy8nO1xuXHR9XG5cblx0cHVibGljIHJlZ2lzdGVyRm9ybWF0dGVyKGZvcm1hdHRlcjogUmVzb3VyY2VMYWJlbEZvcm1hdHRlcik6IElEaXNwb3NhYmxlIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ05vdCBpbXBsZW1lbnRlZCcpO1xuXHR9XG5cblx0cHVibGljIHJlZ2lzdGVyQ2FjaGVkRm9ybWF0dGVyKGZvcm1hdHRlcjogUmVzb3VyY2VMYWJlbEZvcm1hdHRlcik6IElEaXNwb3NhYmxlIHtcblx0XHRyZXR1cm4gdGhpcy5yZWdpc3RlckZvcm1hdHRlcihmb3JtYXR0ZXIpO1xuXHR9XG5cblx0cHVibGljIGdldEhvc3RMYWJlbCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdHB1YmxpYyBnZXRIb3N0VG9vbHRpcCgpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn1cblxuXG5jbGFzcyBTdGFuZGFsb25lQ29udGV4dFZpZXdTZXJ2aWNlIGV4dGVuZHMgQ29udGV4dFZpZXdTZXJ2aWNlIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUxheW91dFNlcnZpY2UgbGF5b3V0U2VydmljZTogSUxheW91dFNlcnZpY2UsXG5cdFx0QElDb2RlRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb2RlRWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcihsYXlvdXRTZXJ2aWNlKTtcblx0fVxuXG5cdG92ZXJyaWRlIHNob3dDb250ZXh0VmlldyhkZWxlZ2F0ZTogSUNvbnRleHRWaWV3RGVsZWdhdGUsIGNvbnRhaW5lcj86IEhUTUxFbGVtZW50LCBzaGFkb3dSb290PzogYm9vbGVhbik6IElPcGVuQ29udGV4dFZpZXcge1xuXHRcdGlmICghY29udGFpbmVyKSB7XG5cdFx0XHRjb25zdCBjb2RlRWRpdG9yID0gdGhpcy5fY29kZUVkaXRvclNlcnZpY2UuZ2V0Rm9jdXNlZENvZGVFZGl0b3IoKSB8fCB0aGlzLl9jb2RlRWRpdG9yU2VydmljZS5nZXRBY3RpdmVDb2RlRWRpdG9yKCk7XG5cdFx0XHRpZiAoY29kZUVkaXRvcikge1xuXHRcdFx0XHRjb250YWluZXIgPSBjb2RlRWRpdG9yLmdldENvbnRhaW5lckRvbU5vZGUoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHN1cGVyLnNob3dDb250ZXh0VmlldyhkZWxlZ2F0ZSwgY29udGFpbmVyLCBzaGFkb3dSb290KTtcblx0fVxufVxuXG5jbGFzcyBTdGFuZGFsb25lV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSBpbXBsZW1lbnRzIElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlIHtcblx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgX25ldmVyRW1pdHRlciA9IG5ldyBFbWl0dGVyPG5ldmVyPigpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25EaWRDaGFuZ2VUcnVzdDogRXZlbnQ8Ym9vbGVhbj4gPSB0aGlzLl9uZXZlckVtaXR0ZXIuZXZlbnQ7XG5cdG9uRGlkQ2hhbmdlVHJ1c3RlZEZvbGRlcnM6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fbmV2ZXJFbWl0dGVyLmV2ZW50O1xuXHRwdWJsaWMgcmVhZG9ubHkgd29ya3NwYWNlUmVzb2x2ZWQgPSBQcm9taXNlLnJlc29sdmUoKTtcblx0cHVibGljIHJlYWRvbmx5IHdvcmtzcGFjZVRydXN0SW5pdGlhbGl6ZWQgPSBQcm9taXNlLnJlc29sdmUoKTtcblx0cHVibGljIHJlYWRvbmx5IGFjY2VwdHNPdXRPZldvcmtzcGFjZUZpbGVzID0gdHJ1ZTtcblxuXHRpc1dvcmtzcGFjZVRydXN0ZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0aXNXb3Jrc3BhY2VUcnVzdEZvcmNlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0Y2FuU2V0UGFyZW50Rm9sZGVyVHJ1c3QoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdGFzeW5jIHNldFBhcmVudEZvbGRlclRydXN0KHRydXN0ZWQ6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBub29wXG5cdH1cblx0Y2FuU2V0V29ya3NwYWNlVHJ1c3QoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdGFzeW5jIHNldFdvcmtzcGFjZVRydXN0KHRydXN0ZWQ6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBub29wXG5cdH1cblx0Z2V0VXJpVHJ1c3RJbmZvKHVyaTogVVJJKTogUHJvbWlzZTxJV29ya3NwYWNlVHJ1c3RVcmlJbmZvPiB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IHN1cHBvcnRlZC4nKTtcblx0fVxuXHRhc3luYyBzZXRVcmlzVHJ1c3QodXJpOiBVUklbXSwgdHJ1c3RlZDogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdC8vIG5vb3Bcblx0fVxuXHRnZXRUcnVzdGVkVXJpcygpOiBVUklbXSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cdGFzeW5jIHNldFRydXN0ZWRVcmlzKHVyaXM6IFVSSVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Ly8gbm9vcFxuXHR9XG5cdGFkZFdvcmtzcGFjZVRydXN0VHJhbnNpdGlvblBhcnRpY2lwYW50KHBhcnRpY2lwYW50OiBJV29ya3NwYWNlVHJ1c3RUcmFuc2l0aW9uUGFydGljaXBhbnQpOiBJRGlzcG9zYWJsZSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IHN1cHBvcnRlZC4nKTtcblx0fVxufVxuXG5jbGFzcyBTdGFuZGFsb25lTGFuZ3VhZ2VTZXJ2aWNlIGV4dGVuZHMgTGFuZ3VhZ2VTZXJ2aWNlIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoKTtcblx0fVxufVxuXG5jbGFzcyBTdGFuZGFsb25lTG9nU2VydmljZSBleHRlbmRzIExvZ1NlcnZpY2Uge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcihuZXcgQ29uc29sZUxvZ2dlcigpKTtcblx0fVxufVxuXG5jbGFzcyBTdGFuZGFsb25lQ29udGV4dE1lbnVTZXJ2aWNlIGV4dGVuZHMgQ29udGV4dE1lbnVTZXJ2aWNlIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUNvbnRleHRWaWV3U2VydmljZSBjb250ZXh0Vmlld1NlcnZpY2U6IElDb250ZXh0Vmlld1NlcnZpY2UsXG5cdFx0QElLZXliaW5kaW5nU2VydmljZSBrZXliaW5kaW5nU2VydmljZTogSUtleWJpbmRpbmdTZXJ2aWNlLFxuXHRcdEBJTWVudVNlcnZpY2UgbWVudVNlcnZpY2U6IElNZW51U2VydmljZSxcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKHRlbGVtZXRyeVNlcnZpY2UsIG5vdGlmaWNhdGlvblNlcnZpY2UsIGNvbnRleHRWaWV3U2VydmljZSwga2V5YmluZGluZ1NlcnZpY2UsIG1lbnVTZXJ2aWNlLCBjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5jb25maWd1cmUoeyBibG9ja01vdXNlOiBmYWxzZSB9KTsgLy8gd2UgZG8gbm90IHdhbnQgdGhhdCBpbiB0aGUgc3RhbmRhbG9uZSBlZGl0b3Jcblx0fVxufVxuXG5jb25zdCBzdGFuZGFsb25lRWRpdG9yV29ya2VyRGVzY3JpcHRvcjogSVdlYldvcmtlckRlc2NyaXB0b3IgPSB7XG5cdGVzbU1vZHVsZUxvY2F0aW9uOiB1bmRlZmluZWQsXG5cdGxhYmVsOiAnZWRpdG9yV29ya2VyU2VydmljZSdcbn07XG5cbmNsYXNzIFN0YW5kYWxvbmVFZGl0b3JXb3JrZXJTZXJ2aWNlIGV4dGVuZHMgRWRpdG9yV29ya2VyU2VydmljZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTW9kZWxTZXJ2aWNlIG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKHN0YW5kYWxvbmVFZGl0b3JXb3JrZXJEZXNjcmlwdG9yLCBtb2RlbFNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBsb2dTZXJ2aWNlLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSk7XG5cdH1cbn1cblxuY2xhc3MgU3RhbmRhbG9uZUFjY2Vzc2JpbGl0eVNpZ25hbFNlcnZpY2UgaW1wbGVtZW50cyBJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2Uge1xuXHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdGFzeW5jIHBsYXlTaWduYWwoY3VlOiBBY2Nlc3NpYmlsaXR5U2lnbmFsLCBvcHRpb25zOiB7fSk6IFByb21pc2U8dm9pZD4ge1xuXHR9XG5cblx0YXN5bmMgcGxheVNpZ25hbHMoY3VlczogQWNjZXNzaWJpbGl0eVNpZ25hbFtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdH1cblxuXHRnZXRFbmFibGVkU3RhdGUoc2lnbmFsOiBBY2Nlc3NpYmlsaXR5U2lnbmFsLCB1c2VyR2VzdHVyZTogYm9vbGVhbiwgbW9kYWxpdHk/OiBBY2Nlc3NpYmlsaXR5TW9kYWxpdHkgfCB1bmRlZmluZWQpOiBJVmFsdWVXaXRoQ2hhbmdlRXZlbnQ8Ym9vbGVhbj4ge1xuXHRcdHJldHVybiBWYWx1ZVdpdGhDaGFuZ2VFdmVudC5jb25zdChmYWxzZSk7XG5cdH1cblxuXHRnZXREZWxheU1zKHNpZ25hbDogQWNjZXNzaWJpbGl0eVNpZ25hbCwgbW9kYWxpdHk6IEFjY2Vzc2liaWxpdHlNb2RhbGl0eSk6IG51bWJlciB7XG5cdFx0cmV0dXJuIDA7XG5cdH1cblxuXHRpc1NvdW5kRW5hYmxlZChjdWU6IEFjY2Vzc2liaWxpdHlTaWduYWwpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRpc0Fubm91bmNlbWVudEVuYWJsZWQoY3VlOiBBY2Nlc3NpYmlsaXR5U2lnbmFsKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0b25Tb3VuZEVuYWJsZWRDaGFuZ2VkKGN1ZTogQWNjZXNzaWJpbGl0eVNpZ25hbCk6IEV2ZW50PHZvaWQ+IHtcblx0XHRyZXR1cm4gRXZlbnQuTm9uZTtcblx0fVxuXG5cdGFzeW5jIHBsYXlTb3VuZChjdWU6IFNvdW5kLCBhbGxvd01hbnlJblBhcmFsbGVsPzogYm9vbGVhbiB8IHVuZGVmaW5lZCk6IFByb21pc2U8dm9pZD4ge1xuXHR9XG5cdHBsYXlTaWduYWxMb29wKGN1ZTogQWNjZXNzaWJpbGl0eVNpZ25hbCk6IElEaXNwb3NhYmxlIHtcblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHsgfSk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRWRpdG9yT3ZlcnJpZGVTZXJ2aWNlcyB7XG5cdFtpbmRleDogc3RyaW5nXTogYW55O1xufVxuXG5yZWdpc3RlclNpbmdsZXRvbihJTG9nU2VydmljZSwgU3RhbmRhbG9uZUxvZ1NlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkVhZ2VyKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElDb25maWd1cmF0aW9uU2VydmljZSwgU3RhbmRhbG9uZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG5yZWdpc3RlclNpbmdsZXRvbihJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UsIFN0YW5kYWxvbmVSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG5yZWdpc3RlclNpbmdsZXRvbihJVGV4dFJlc291cmNlUHJvcGVydGllc1NlcnZpY2UsIFN0YW5kYWxvbmVSZXNvdXJjZVByb3BlcnRpZXNTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG5yZWdpc3RlclNpbmdsZXRvbihJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIFN0YW5kYWxvbmVXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIpO1xucmVnaXN0ZXJTaW5nbGV0b24oSUxhYmVsU2VydmljZSwgU3RhbmRhbG9uZVVyaUxhYmVsU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIpO1xucmVnaXN0ZXJTaW5nbGV0b24oSVRlbGVtZXRyeVNlcnZpY2UsIFN0YW5kYWxvbmVUZWxlbWV0cnlTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG5yZWdpc3RlclNpbmdsZXRvbihJRGlhbG9nU2VydmljZSwgU3RhbmRhbG9uZURpYWxvZ1NlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkVhZ2VyKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElFbnZpcm9ubWVudFNlcnZpY2UsIFN0YW5kYWxvbmVFbnZpcm9ubWVudFNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkVhZ2VyKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElOb3RpZmljYXRpb25TZXJ2aWNlLCBTdGFuZGFsb25lTm90aWZpY2F0aW9uU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIpO1xucmVnaXN0ZXJTaW5nbGV0b24oSU1hcmtlclNlcnZpY2UsIE1hcmtlclNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkVhZ2VyKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElMYW5ndWFnZVNlcnZpY2UsIFN0YW5kYWxvbmVMYW5ndWFnZVNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkVhZ2VyKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElTdGFuZGFsb25lVGhlbWVTZXJ2aWNlLCBTdGFuZGFsb25lVGhlbWVTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG5yZWdpc3RlclNpbmdsZXRvbihJTW9kZWxTZXJ2aWNlLCBNb2RlbFNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkVhZ2VyKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElNYXJrZXJEZWNvcmF0aW9uc1NlcnZpY2UsIE1hcmtlckRlY29yYXRpb25zU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIpO1xucmVnaXN0ZXJTaW5nbGV0b24oSUNvbnRleHRLZXlTZXJ2aWNlLCBDb250ZXh0S2V5U2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIpO1xucmVnaXN0ZXJTaW5nbGV0b24oSVByb2dyZXNzU2VydmljZSwgU3RhbmRhbG9uZVByb2dyZXNzU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIpO1xucmVnaXN0ZXJTaW5nbGV0b24oSUVkaXRvclByb2dyZXNzU2VydmljZSwgU3RhbmRhbG9uZUVkaXRvclByb2dyZXNzU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIpO1xucmVnaXN0ZXJTaW5nbGV0b24oSVN0b3JhZ2VTZXJ2aWNlLCBJbk1lbW9yeVN0b3JhZ2VTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG5yZWdpc3RlclNpbmdsZXRvbihJRWRpdG9yV29ya2VyU2VydmljZSwgU3RhbmRhbG9uZUVkaXRvcldvcmtlclNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkVhZ2VyKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElCdWxrRWRpdFNlcnZpY2UsIFN0YW5kYWxvbmVCdWxrRWRpdFNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkVhZ2VyKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlLCBTdGFuZGFsb25lV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIpO1xucmVnaXN0ZXJTaW5nbGV0b24oSVRleHRNb2RlbFNlcnZpY2UsIFN0YW5kYWxvbmVUZXh0TW9kZWxTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG5yZWdpc3RlclNpbmdsZXRvbihJQWNjZXNzaWJpbGl0eVNlcnZpY2UsIEFjY2Vzc2liaWxpdHlTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG5yZWdpc3RlclNpbmdsZXRvbihJTGlzdFNlcnZpY2UsIExpc3RTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG5yZWdpc3RlclNpbmdsZXRvbihJQ29tbWFuZFNlcnZpY2UsIFN0YW5kYWxvbmVDb21tYW5kU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIpO1xucmVnaXN0ZXJTaW5nbGV0b24oSUtleWJpbmRpbmdTZXJ2aWNlLCBTdGFuZGFsb25lS2V5YmluZGluZ1NlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkVhZ2VyKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElRdWlja0lucHV0U2VydmljZSwgU3RhbmRhbG9uZVF1aWNrSW5wdXRTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG5yZWdpc3RlclNpbmdsZXRvbihJQ29udGV4dFZpZXdTZXJ2aWNlLCBTdGFuZGFsb25lQ29udGV4dFZpZXdTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG5yZWdpc3RlclNpbmdsZXRvbihJT3BlbmVyU2VydmljZSwgT3BlbmVyU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIpO1xucmVnaXN0ZXJTaW5nbGV0b24oSUNsaXBib2FyZFNlcnZpY2UsIEJyb3dzZXJDbGlwYm9hcmRTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG5yZWdpc3RlclNpbmdsZXRvbihJQ29udGV4dE1lbnVTZXJ2aWNlLCBTdGFuZGFsb25lQ29udGV4dE1lbnVTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG5yZWdpc3RlclNpbmdsZXRvbihJTWVudVNlcnZpY2UsIE1lbnVTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG5yZWdpc3RlclNpbmdsZXRvbihJQWNjZXNzaWJpbGl0eVNpZ25hbFNlcnZpY2UsIFN0YW5kYWxvbmVBY2Nlc3NiaWxpdHlTaWduYWxTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG5yZWdpc3RlclNpbmdsZXRvbihJVHJlZVNpdHRlclBhcnNlclNlcnZpY2UsIFN0YW5kYWxvbmVUcmVlU2l0dGVyUGFyc2VyU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIpO1xuXG4vKipcbiAqIFdlIGRvbid0IHdhbnQgdG8gZWFnZXJseSBpbnN0YW50aWF0ZSBzZXJ2aWNlcyBiZWNhdXNlIGVtYmVkZGVycyBnZXQgYSBvbmUgdGltZSBjaGFuY2VcbiAqIHRvIG92ZXJyaWRlIHNlcnZpY2VzIHdoZW4gdGhleSBjcmVhdGUgdGhlIGZpcnN0IGVkaXRvci5cbiAqL1xuZXhwb3J0IG1vZHVsZSBTdGFuZGFsb25lU2VydmljZXMge1xuXG5cdGNvbnN0IHNlcnZpY2VDb2xsZWN0aW9uID0gbmV3IFNlcnZpY2VDb2xsZWN0aW9uKCk7XG5cdGZvciAoY29uc3QgW2lkLCBkZXNjcmlwdG9yXSBvZiBnZXRTaW5nbGV0b25TZXJ2aWNlRGVzY3JpcHRvcnMoKSkge1xuXHRcdHNlcnZpY2VDb2xsZWN0aW9uLnNldChpZCwgZGVzY3JpcHRvcik7XG5cdH1cblxuXHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IG5ldyBJbnN0YW50aWF0aW9uU2VydmljZShzZXJ2aWNlQ29sbGVjdGlvbiwgdHJ1ZSk7XG5cdHNlcnZpY2VDb2xsZWN0aW9uLnNldChJSW5zdGFudGlhdGlvblNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblxuXHRleHBvcnQgZnVuY3Rpb24gZ2V0PFQ+KHNlcnZpY2VJZDogU2VydmljZUlkZW50aWZpZXI8VD4pOiBUIHtcblx0XHRpZiAoIWluaXRpYWxpemVkKSB7XG5cdFx0XHRpbml0aWFsaXplKHt9KTtcblx0XHR9XG5cdFx0Y29uc3QgciA9IHNlcnZpY2VDb2xsZWN0aW9uLmdldChzZXJ2aWNlSWQpO1xuXHRcdGlmICghcikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdNaXNzaW5nIHNlcnZpY2UgJyArIHNlcnZpY2VJZCk7XG5cdFx0fVxuXHRcdGlmIChyIGluc3RhbmNlb2YgU3luY0Rlc2NyaXB0b3IpIHtcblx0XHRcdHJldHVybiBpbnN0YW50aWF0aW9uU2VydmljZS5pbnZva2VGdW5jdGlvbigoYWNjZXNzb3IpID0+IGFjY2Vzc29yLmdldChzZXJ2aWNlSWQpKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIHI7XG5cdFx0fVxuXHR9XG5cblx0bGV0IGluaXRpYWxpemVkID0gZmFsc2U7XG5cdGNvbnN0IG9uRGlkSW5pdGlhbGl6ZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdGV4cG9ydCBmdW5jdGlvbiBpbml0aWFsaXplKG92ZXJyaWRlczogSUVkaXRvck92ZXJyaWRlU2VydmljZXMpOiBJSW5zdGFudGlhdGlvblNlcnZpY2Uge1xuXHRcdGlmIChpbml0aWFsaXplZCkge1xuXHRcdFx0cmV0dXJuIGluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRcdH1cblx0XHRpbml0aWFsaXplZCA9IHRydWU7XG5cblx0XHQvLyBBZGQgc2luZ2xldG9ucyB0aGF0IHdlcmUgcmVnaXN0ZXJlZCBhZnRlciB0aGlzIG1vZHVsZSBsb2FkZWRcblx0XHRmb3IgKGNvbnN0IFtpZCwgZGVzY3JpcHRvcl0gb2YgZ2V0U2luZ2xldG9uU2VydmljZURlc2NyaXB0b3JzKCkpIHtcblx0XHRcdGlmICghc2VydmljZUNvbGxlY3Rpb24uZ2V0KGlkKSkge1xuXHRcdFx0XHRzZXJ2aWNlQ29sbGVjdGlvbi5zZXQoaWQsIGRlc2NyaXB0b3IpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEluaXRpYWxpemUgdGhlIHNlcnZpY2UgY29sbGVjdGlvbiB3aXRoIHRoZSBvdmVycmlkZXMsIGJ1dCBvbmx5IGlmIHRoZVxuXHRcdC8vIHNlcnZpY2Ugd2FzIG5vdCBpbnN0YW50aWF0ZWQgaW4gdGhlIG1lYW50aW1lLlxuXHRcdGZvciAoY29uc3Qgc2VydmljZUlkIGluIG92ZXJyaWRlcykge1xuXHRcdFx0aWYgKG92ZXJyaWRlcy5oYXNPd25Qcm9wZXJ0eShzZXJ2aWNlSWQpKSB7XG5cdFx0XHRcdGNvbnN0IHNlcnZpY2VJZGVudGlmaWVyID0gY3JlYXRlRGVjb3JhdG9yKHNlcnZpY2VJZCk7XG5cdFx0XHRcdGNvbnN0IHIgPSBzZXJ2aWNlQ29sbGVjdGlvbi5nZXQoc2VydmljZUlkZW50aWZpZXIpO1xuXHRcdFx0XHRpZiAociBpbnN0YW5jZW9mIFN5bmNEZXNjcmlwdG9yKSB7XG5cdFx0XHRcdFx0c2VydmljZUNvbGxlY3Rpb24uc2V0KHNlcnZpY2VJZGVudGlmaWVyLCBvdmVycmlkZXNbc2VydmljZUlkXSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBJbnN0YW50aWF0ZSBhbGwgZWRpdG9yIGZlYXR1cmVzXG5cdFx0Y29uc3QgZWRpdG9yRmVhdHVyZXMgPSBnZXRFZGl0b3JGZWF0dXJlcygpO1xuXHRcdGZvciAoY29uc3QgZmVhdHVyZSBvZiBlZGl0b3JGZWF0dXJlcykge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoZmVhdHVyZSk7XG5cdFx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdFx0b25VbmV4cGVjdGVkRXJyb3IoZXJyKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRvbkRpZEluaXRpYWxpemUuZmlyZSgpO1xuXG5cdFx0cmV0dXJuIGluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHR9XG5cblx0LyoqXG5cdCAqIEV4ZWN1dGVzIGNhbGxiYWNrIG9uY2Ugc2VydmljZXMgYXJlIGluaXRpYWxpemVkLlxuXHQgKi9cblx0ZXhwb3J0IGZ1bmN0aW9uIHdpdGhTZXJ2aWNlcyhjYWxsYmFjazogKCkgPT4gSURpc3Bvc2FibGUpOiBJRGlzcG9zYWJsZSB7XG5cdFx0aWYgKGluaXRpYWxpemVkKSB7XG5cdFx0XHRyZXR1cm4gY2FsbGJhY2soKTtcblx0XHR9XG5cblx0XHRjb25zdCBkaXNwb3NhYmxlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdFx0Y29uc3QgbGlzdGVuZXIgPSBkaXNwb3NhYmxlLmFkZChvbkRpZEluaXRpYWxpemUuZXZlbnQoKCkgPT4ge1xuXHRcdFx0bGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0ZGlzcG9zYWJsZS5hZGQoY2FsbGJhY2soKSk7XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIGRpc3Bvc2FibGU7XG5cdH1cblxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPO0FBQ1AsT0FBTztBQUNQLE9BQU87QUFDUCxPQUFPO0FBQ1AsT0FBTztBQUNQLE9BQU87QUFDUCxPQUFPO0FBRVAsWUFBWSxhQUFhO0FBQ3pCLFlBQVksU0FBUztBQUNyQixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLFNBQVMsT0FBOEIsNEJBQTRCO0FBQzVFLFNBQTZCLGNBQTBCLHdCQUF3QjtBQUMvRSxTQUFrQyxtQkFBbUIsY0FBYyxpQkFBaUIsWUFBWSwwQkFBMEI7QUFDMUgsU0FBUyxJQUFJLFNBQVMsbUJBQW1CO0FBQ3pDLE9BQU8sY0FBYztBQUNyQixTQUFTLFdBQVc7QUFDcEIsU0FBNEMsa0JBQWtCLGNBQWMsd0JBQXdCO0FBQ3BHLFNBQVMsOEJBQThCLGdDQUFnQztBQUN2RSxTQUFTLHFCQUEyQztBQUNwRCxTQUFvQixZQUFZLFdBQVc7QUFDM0MsU0FBUyxhQUFhO0FBRXRCLFNBQVMscUJBQXFCO0FBQzlCLFNBQThELHlCQUF5QjtBQUN2RixTQUFTLG1DQUFtQyxzQ0FBNkU7QUFDekgsU0FBUyxrQkFBa0QsdUJBQXVCO0FBQ2xGLFNBQWlGLHVCQUFpRSwyQkFBMkI7QUFDN0ssU0FBUyxlQUFlLG9CQUFvQixnQ0FBZ0M7QUFDNUUsU0FBUywwQkFBZ0Q7QUFDekQsU0FBNkMsc0JBQTJKO0FBQ3hNLFNBQVMsaUJBQWlCLDZCQUFnRDtBQUMxRSxTQUFTLGlDQUFpQztBQUMxQyxTQUFTLDBCQUF5RTtBQUNsRixTQUFTLDBCQUEwQjtBQUNuQyxTQUEwQiwyQkFBMkI7QUFDckQsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUyxxQkFBK0U7QUFDeEYsU0FBNkMsc0JBQXFELGtCQUF5RiwyQkFBMkI7QUFDdE4sU0FBMEIsd0JBQXdCLHdCQUE2SztBQUMvTixTQUFTLG1CQUFtQixzQkFBc0I7QUFDbEQsU0FBNkUsMEJBQTRHLGdCQUFnQixpQkFBaUIsc0NBQXNDO0FBQ2hRLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsZUFBZSxtQkFBbUI7QUFDM0MsU0FBUyx3Q0FBc0c7QUFDL0csU0FBUyxvQkFBb0I7QUFFN0IsU0FBUyxxQkFBMkMsMkJBQTZDO0FBQ2pHLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsZ0NBQWdDLG1CQUFtQix5QkFBeUI7QUFDckYsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyw0QkFBNEI7QUFDckMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxtQ0FBbUM7QUFDNUMsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxjQUFjLG1CQUFtQjtBQUMxQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGlCQUFpQiw4QkFBOEI7QUFDeEQsU0FBUyw0QkFBNEI7QUFFckMsU0FBcUQsbUNBQTBDO0FBQy9GLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQXdCLDJCQUFzRDtBQUM5RSxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHlDQUF5QztBQUdsRCxNQUFNLFlBQWdEO0FBQUEsRUFLckQsWUFBWSxPQUFtQjtBQXlCL0IsU0FBUSxXQUFXO0FBeEJsQixTQUFLLFFBQVE7QUFDYixTQUFLLGlCQUFpQixJQUFJLFFBQWM7QUFBQSxFQUN6QztBQUFBLEVBRUEsSUFBVyxnQkFBNkI7QUFDdkMsV0FBTyxLQUFLLGVBQWU7QUFBQSxFQUM1QjtBQUFBLEVBRU8sVUFBeUI7QUFDL0IsV0FBTyxRQUFRLFFBQVE7QUFBQSxFQUN4QjtBQUFBLEVBRUEsSUFBVyxrQkFBOEI7QUFDeEMsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRU8saUJBQWdDO0FBQ3RDLFdBQU8sS0FBSyxNQUFNLGVBQWU7QUFBQSxFQUNsQztBQUFBLEVBRU8sYUFBc0I7QUFDNUIsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUdPLFVBQWdCO0FBQ3RCLFNBQUssV0FBVztBQUVoQixTQUFLLGVBQWUsS0FBSztBQUFBLEVBQzFCO0FBQUEsRUFFTyxhQUFzQjtBQUM1QixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFTyxhQUFzQjtBQUM1QixXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRU8sZ0JBQW9DO0FBQzFDLFdBQU8sS0FBSyxNQUFNLGNBQWM7QUFBQSxFQUNqQztBQUNEO0FBRUEsSUFBTSw2QkFBTixNQUE4RDtBQUFBLEVBRzdELFlBQ2lDLGNBQy9CO0FBRCtCO0FBQUEsRUFDN0I7QUFBQSxFQUVHLHFCQUFxQixVQUE4RDtBQUN6RixVQUFNLFFBQVEsS0FBSyxhQUFhLFNBQVMsUUFBUTtBQUVqRCxRQUFJLENBQUMsT0FBTztBQUNYLGFBQU8sUUFBUSxPQUFPLElBQUksTUFBTSxpQkFBaUIsQ0FBQztBQUFBLElBQ25EO0FBRUEsV0FBTyxRQUFRLFFBQVEsSUFBSSxrQkFBa0IsSUFBSSxZQUFZLEtBQUssQ0FBQyxDQUFDO0FBQUEsRUFDckU7QUFBQSxFQUVPLGlDQUFpQyxRQUFnQixVQUFrRDtBQUN6RyxXQUFPO0FBQUEsTUFDTixTQUFTLFdBQVk7QUFBQSxNQUFjO0FBQUEsSUFDcEM7QUFBQSxFQUNEO0FBQUEsRUFFTyxrQkFBa0IsVUFBd0I7QUFDaEQsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQTFCTSw2QkFBTjtBQUFBLEVBSUc7QUFBQSxHQUpHO0FBNEJOLE1BQU0sbUNBQU4sTUFBTSxpQ0FBa0U7QUFBQSxFQVd2RSxPQUF3QjtBQUN2QixXQUFPLGlDQUFnQztBQUFBLEVBQ3hDO0FBQUEsRUFFQSxNQUFNLFVBQVUsU0FBdUIsT0FBK0I7QUFDckUsVUFBTTtBQUFBLEVBQ1A7QUFDRDtBQWxCTSxpQ0FHVSx1QkFBd0M7QUFBQSxFQUN0RCxNQUFNLE1BQU07QUFBQSxFQUFFO0FBQUEsRUFDZCxPQUFPLE1BQU07QUFBQSxFQUFFO0FBQUEsRUFDZixRQUFRLE1BQU07QUFBQSxFQUFFO0FBQ2pCO0FBUEQsSUFBTSxrQ0FBTjtBQW9CQSxNQUFNLDBCQUFzRDtBQUFBLEVBSTNELGFBQWdCLFVBQXlJLE1BQTBELGFBQStFO0FBQ2pTLFdBQU8sS0FBSztBQUFBLE1BQ1gsUUFBUSxNQUFNO0FBQUEsTUFBRTtBQUFBLElBQ2pCLENBQUM7QUFBQSxFQUNGO0FBQ0Q7QUFFQSxNQUFNLDZCQUE0RDtBQUFBLEVBQWxFO0FBSUMsU0FBUyxnQkFBcUIsSUFBSSxLQUFLLEVBQUUsUUFBUSxVQUFVLFdBQVcsZ0JBQWdCLENBQUM7QUFDdkYsU0FBUyxzQkFBMkIsSUFBSSxLQUFLLEVBQUUsUUFBUSxVQUFVLFdBQVcsc0JBQXNCLENBQUM7QUFDbkcsU0FBUyx5QkFBOEIsSUFBSSxLQUFLLEVBQUUsUUFBUSxVQUFVLFdBQVcseUJBQXlCLENBQUM7QUFDekcsU0FBUyxlQUFvQixJQUFJLEtBQUssRUFBRSxRQUFRLFVBQVUsV0FBVyxlQUFlLENBQUM7QUFDckYsU0FBUyx5QkFBOEIsSUFBSSxLQUFLLEVBQUUsUUFBUSxVQUFVLFdBQVcseUJBQXlCLENBQUM7QUFDekcsU0FBUyx1QkFBNEIsSUFBSSxLQUFLLEVBQUUsUUFBUSxVQUFVLFdBQVcsdUJBQXVCLENBQUM7QUFDckcsU0FBUyxtQkFBd0IsSUFBSSxLQUFLLEVBQUUsUUFBUSxVQUFVLFdBQVcsbUJBQW1CLENBQUM7QUFDN0YsU0FBUyxZQUFpQixJQUFJLEtBQUssRUFBRSxRQUFRLFVBQVUsV0FBVyxZQUFZLENBQUM7QUFDL0UsU0FBUyxtQkFBd0IsSUFBSSxLQUFLLEVBQUUsUUFBUSxVQUFVLFdBQVcsbUJBQW1CLENBQUM7QUFDN0YsU0FBUyxPQUFpQztBQUMxQyxTQUFTLGFBQWtDO0FBQzNDLFNBQVMsZ0JBQXFDO0FBQzlDLFNBQVMscUJBQWdELEVBQUUsTUFBTSxNQUFNLE9BQU8sTUFBTTtBQUNwRixTQUFTLHlCQUFrQztBQUMzQyxTQUFTLG9CQUF3QztBQUNqRCxTQUFTLG1CQUFtRDtBQUM1RCxTQUFTLGtDQUFzRDtBQUMvRCxTQUFTLDJCQUF5RDtBQUNsRSxTQUFTLDRCQUE4QztBQUN2RCxTQUFTLFdBQWdCLElBQUksS0FBSyxFQUFFLFFBQVEsVUFBVSxXQUFXLFdBQVcsQ0FBQztBQUM3RSxTQUFTLFdBQWdDO0FBQ3pDLFNBQVMsb0JBQXFEO0FBQzlELFNBQVMsVUFBbUI7QUFDNUIsU0FBUyxVQUFtQjtBQUM1QixTQUFTLG1CQUE0QjtBQUNyQyxTQUFTLDJCQUFnQyxJQUFJLEtBQUssRUFBRSxRQUFRLFVBQVUsV0FBVywyQkFBMkIsQ0FBQztBQUM3RyxTQUFTLGFBQStCO0FBQUE7QUFDekM7QUFFQSxNQUFNLHdCQUFrRDtBQUFBLEVBQXhEO0FBSUMsU0FBUyxtQkFBbUIsTUFBTTtBQUNsQyxTQUFTLGtCQUFrQixNQUFNO0FBQUE7QUFBQSxFQUVqQyxNQUFNLFFBQVEsY0FBMkQ7QUFDeEUsVUFBTSxZQUFZLEtBQUssVUFBVSxhQUFhLFNBQVMsYUFBYSxNQUFNO0FBRTFFLFdBQU87QUFBQSxNQUNOO0FBQUEsTUFDQSxpQkFBaUI7QUFBQTtBQUFBLElBQ2xCO0FBQUEsRUFDRDtBQUFBLEVBRVEsVUFBVSxTQUFpQixRQUEwQjtBQUM1RCxRQUFJLGNBQWM7QUFDbEIsUUFBSSxRQUFRO0FBQ1gsb0JBQWMsY0FBYyxTQUFTO0FBQUEsSUFDdEM7QUFFQSxXQUFPLFdBQVcsUUFBUSxXQUFXO0FBQUEsRUFDdEM7QUFBQSxFQUtBLE1BQU0sT0FBVSxRQUF5RztBQUN4SCxRQUFJLFNBQXdCO0FBQzVCLFVBQU0sWUFBWSxLQUFLLFVBQVUsT0FBTyxTQUFTLE9BQU8sTUFBTTtBQUM5RCxRQUFJLFdBQVc7QUFDZCxZQUFNLGdCQUF3QyxDQUFDLEdBQUksT0FBTyxXQUFXLENBQUMsQ0FBRTtBQUN4RSxVQUFJLE9BQU8sZ0JBQWdCLE9BQU8sT0FBTyxpQkFBaUIsWUFBWSxPQUFPLE9BQU8saUJBQWlCLFdBQVc7QUFDL0csc0JBQWMsS0FBSyxPQUFPLFlBQVk7QUFBQSxNQUN2QztBQUVBLGVBQVMsTUFBTSxjQUFjLENBQUMsR0FBRyxJQUFJLEVBQUUsaUJBQWlCLE1BQU0sQ0FBQztBQUFBLElBQ2hFO0FBRUEsV0FBTyxFQUFFLE9BQU87QUFBQSxFQUNqQjtBQUFBLEVBRUEsTUFBTSxLQUFLLFNBQWlCLFFBQWdDO0FBQzNELFVBQU0sS0FBSyxPQUFPLEVBQUUsTUFBTSxTQUFTLE1BQU0sU0FBUyxPQUFPLENBQUM7QUFBQSxFQUMzRDtBQUFBLEVBRUEsTUFBTSxLQUFLLFNBQWlCLFFBQWdDO0FBQzNELFVBQU0sS0FBSyxPQUFPLEVBQUUsTUFBTSxTQUFTLFNBQVMsU0FBUyxPQUFPLENBQUM7QUFBQSxFQUM5RDtBQUFBLEVBRUEsTUFBTSxNQUFNLFNBQWlCLFFBQWdDO0FBQzVELFVBQU0sS0FBSyxPQUFPLEVBQUUsTUFBTSxTQUFTLE9BQU8sU0FBUyxPQUFPLENBQUM7QUFBQSxFQUM1RDtBQUFBLEVBRUEsUUFBK0I7QUFDOUIsV0FBTyxRQUFRLFFBQVEsRUFBRSxXQUFXLE1BQU0sQ0FBQztBQUFBLEVBQzVDO0FBQUEsRUFFQSxRQUF1QjtBQUN0QixXQUFPLFFBQVEsUUFBUSxNQUFTO0FBQUEsRUFDakM7QUFDRDtBQUVPLE1BQU0saUNBQU4sTUFBTSwrQkFBOEQ7QUFBQSxFQUFwRTtBQUVOLFNBQVMsdUJBQTZDLE1BQU07QUFFNUQsU0FBUywwQkFBZ0QsTUFBTTtBQUUvRCxTQUFTLG9CQUFpQyxNQUFNO0FBQUE7QUFBQSxFQU16QyxLQUFLLFNBQXNDO0FBQ2pELFdBQU8sS0FBSyxPQUFPLEVBQUUsVUFBVSxTQUFTLE1BQU0sUUFBUSxDQUFDO0FBQUEsRUFDeEQ7QUFBQSxFQUVPLEtBQUssU0FBc0M7QUFDakQsV0FBTyxLQUFLLE9BQU8sRUFBRSxVQUFVLFNBQVMsU0FBUyxRQUFRLENBQUM7QUFBQSxFQUMzRDtBQUFBLEVBRU8sTUFBTSxPQUE0QztBQUN4RCxXQUFPLEtBQUssT0FBTyxFQUFFLFVBQVUsU0FBUyxPQUFPLFNBQVMsTUFBTSxDQUFDO0FBQUEsRUFDaEU7QUFBQSxFQUVPLE9BQU8sY0FBa0Q7QUFDL0QsWUFBUSxhQUFhLFVBQVU7QUFBQSxNQUM5QixLQUFLLFNBQVM7QUFDYixnQkFBUSxNQUFNLGFBQWEsT0FBTztBQUNsQztBQUFBLE1BQ0QsS0FBSyxTQUFTO0FBQ2IsZ0JBQVEsS0FBSyxhQUFhLE9BQU87QUFDakM7QUFBQSxNQUNEO0FBQ0MsZ0JBQVEsSUFBSSxhQUFhLE9BQU87QUFDaEM7QUFBQSxJQUNGO0FBRUEsV0FBTywrQkFBOEI7QUFBQSxFQUN0QztBQUFBLEVBRU8sT0FBTyxVQUFvQixTQUFpQixTQUEwQixTQUErQztBQUMzSCxXQUFPLCtCQUE4QjtBQUFBLEVBQ3RDO0FBQUEsRUFFTyxPQUFPLFNBQXlCLFNBQThDO0FBQ3BGLFdBQU8sV0FBVztBQUFBLEVBQ25CO0FBQUEsRUFHTyxVQUFVLFFBQStEO0FBQUEsRUFBRTtBQUFBLEVBRTNFLFVBQVUsUUFBbUQ7QUFDbkUsV0FBTyxvQkFBb0I7QUFBQSxFQUM1QjtBQUFBLEVBRU8sYUFBMEM7QUFDaEQsV0FBTyxDQUFDO0FBQUEsRUFDVDtBQUFBLEVBRU8sYUFBYSxVQUF3QjtBQUFBLEVBQUU7QUFDL0M7QUE1RGEsK0JBVVksUUFBNkIsSUFBSSxpQkFBaUI7QUFWcEUsSUFBTSxnQ0FBTjtBQThEQSxJQUFNLDJCQUFOLE1BQTBEO0FBQUEsRUFVaEUsWUFDd0Isc0JBQ3RCO0FBUEYsU0FBaUIsd0JBQXdCLElBQUksUUFBdUI7QUFDcEUsU0FBaUIsdUJBQXVCLElBQUksUUFBdUI7QUFDbkUsU0FBZ0IsdUJBQTZDLEtBQUssc0JBQXNCO0FBQ3hGLFNBQWdCLHNCQUE0QyxLQUFLLHFCQUFxQjtBQUtyRixTQUFLLHdCQUF3QjtBQUFBLEVBQzlCO0FBQUEsRUFFTyxlQUFrQixPQUFlLE1BQXlCO0FBQ2hFLFVBQU0sVUFBVSxpQkFBaUIsV0FBVyxFQUFFO0FBQzlDLFFBQUksQ0FBQyxTQUFTO0FBQ2IsYUFBTyxRQUFRLE9BQU8sSUFBSSxNQUFNLFlBQVksRUFBRSxhQUFhLENBQUM7QUFBQSxJQUM3RDtBQUVBLFFBQUk7QUFDSCxXQUFLLHNCQUFzQixLQUFLLEVBQUUsV0FBVyxJQUFJLEtBQUssQ0FBQztBQUN2RCxZQUFNLFNBQVMsS0FBSyxzQkFBc0IsZUFBZSxNQUFNLEtBQUssdUJBQXVCLENBQUMsUUFBUSxTQUFTLEdBQUcsSUFBSSxDQUFDO0FBRXJILFdBQUsscUJBQXFCLEtBQUssRUFBRSxXQUFXLElBQUksS0FBSyxDQUFDO0FBQ3RELGFBQU8sUUFBUSxRQUFRLE1BQU07QUFBQSxJQUM5QixTQUFTLEtBQUs7QUFDYixhQUFPLFFBQVEsT0FBTyxHQUFHO0FBQUEsSUFDMUI7QUFBQSxFQUNEO0FBQ0Q7QUFoQ2EsMkJBQU47QUFBQSxFQVdKO0FBQUEsR0FYVTtBQXlDTixJQUFNLDhCQUFOLGNBQTBDLDBCQUEwQjtBQUFBLEVBSzFFLFlBQ3FCLG1CQUNILGdCQUNFLGtCQUNHLHFCQUNULFlBQ08sbUJBQ25CO0FBQ0QsVUFBTSxtQkFBbUIsZ0JBQWdCLGtCQUFrQixxQkFBcUIsVUFBVTtBQUUxRixTQUFLLGtCQUFrQjtBQUN2QixTQUFLLHNCQUFzQixDQUFDO0FBQzVCLFNBQUssb0JBQW9CLENBQUM7QUFFMUIsVUFBTSxlQUFlLENBQUMsWUFBeUI7QUFDOUMsWUFBTSxjQUFjLElBQUksZ0JBQWdCO0FBR3hDLGtCQUFZLElBQUksSUFBSSxzQkFBc0IsU0FBUyxJQUFJLFVBQVUsVUFBVSxDQUFDLE1BQXFCO0FBQ2hHLGNBQU0sV0FBVyxJQUFJLHNCQUFzQixDQUFDO0FBQzVDLGNBQU0sdUJBQXVCLEtBQUssVUFBVSxVQUFVLFNBQVMsTUFBTTtBQUNyRSxZQUFJLHNCQUFzQjtBQUN6QixtQkFBUyxlQUFlO0FBQ3hCLG1CQUFTLGdCQUFnQjtBQUFBLFFBQzFCO0FBQUEsTUFDRCxDQUFDLENBQUM7QUFHRixrQkFBWSxJQUFJLElBQUksc0JBQXNCLFNBQVMsSUFBSSxVQUFVLFFBQVEsQ0FBQyxNQUFxQjtBQUM5RixjQUFNLFdBQVcsSUFBSSxzQkFBc0IsQ0FBQztBQUM1QyxjQUFNLHVCQUF1QixLQUFLLHdCQUF3QixVQUFVLFNBQVMsTUFBTTtBQUNuRixZQUFJLHNCQUFzQjtBQUN6QixtQkFBUyxlQUFlO0FBQUEsUUFDekI7QUFBQSxNQUNELENBQUMsQ0FBQztBQUVGLFdBQUssa0JBQWtCLEtBQUssSUFBSSxpQkFBaUIsU0FBUyxXQUFXLENBQUM7QUFBQSxJQUN2RTtBQUNBLFVBQU0sa0JBQWtCLENBQUMsWUFBeUI7QUFDakQsZUFBUyxJQUFJLEdBQUcsSUFBSSxLQUFLLGtCQUFrQixRQUFRLEtBQUs7QUFDdkQsY0FBTSxtQkFBbUIsS0FBSyxrQkFBa0IsQ0FBQztBQUNqRCxZQUFJLGlCQUFpQixZQUFZLFNBQVM7QUFDekMsZUFBSyxrQkFBa0IsT0FBTyxHQUFHLENBQUM7QUFDbEMsMkJBQWlCLFFBQVE7QUFBQSxRQUMxQjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBRUEsVUFBTSxnQkFBZ0IsQ0FBQyxlQUE0QjtBQUNsRCxVQUFJLFdBQVcsVUFBVSxhQUFhLFlBQVksR0FBRztBQUNwRDtBQUFBLE1BQ0Q7QUFDQSxtQkFBYSxXQUFXLG9CQUFvQixDQUFDO0FBQUEsSUFDOUM7QUFDQSxVQUFNLG1CQUFtQixDQUFDLGVBQTRCO0FBQ3JELFVBQUksV0FBVyxVQUFVLGFBQWEsWUFBWSxHQUFHO0FBQ3BEO0FBQUEsTUFDRDtBQUNBLHNCQUFnQixXQUFXLG9CQUFvQixDQUFDO0FBQUEsSUFDakQ7QUFDQSxTQUFLLFVBQVUsa0JBQWtCLGdCQUFnQixhQUFhLENBQUM7QUFDL0QsU0FBSyxVQUFVLGtCQUFrQixtQkFBbUIsZ0JBQWdCLENBQUM7QUFDckUsc0JBQWtCLGdCQUFnQixFQUFFLFFBQVEsYUFBYTtBQUV6RCxVQUFNLGdCQUFnQixDQUFDLGVBQTRCO0FBQ2xELG1CQUFhLFdBQVcsb0JBQW9CLENBQUM7QUFBQSxJQUM5QztBQUNBLFVBQU0sbUJBQW1CLENBQUMsZUFBNEI7QUFDckQsc0JBQWdCLFdBQVcsb0JBQW9CLENBQUM7QUFBQSxJQUNqRDtBQUNBLFNBQUssVUFBVSxrQkFBa0IsZ0JBQWdCLGFBQWEsQ0FBQztBQUMvRCxTQUFLLFVBQVUsa0JBQWtCLG1CQUFtQixnQkFBZ0IsQ0FBQztBQUNyRSxzQkFBa0IsZ0JBQWdCLEVBQUUsUUFBUSxhQUFhO0FBQUEsRUFDMUQ7QUFBQSxFQUVPLHFCQUFxQixTQUFpQixZQUFvQixTQUEwQixNQUFxRDtBQUMvSSxXQUFPO0FBQUEsTUFDTixpQkFBaUIsZ0JBQWdCLFNBQVMsT0FBTztBQUFBLE1BQ2pELEtBQUssc0JBQXNCLENBQUM7QUFBQSxRQUMzQjtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRCxDQUFDLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRDtBQUFBLEVBRU8sc0JBQXNCLE9BQXVDO0FBQ25FLFVBQU0sVUFBNkIsTUFBTSxJQUFJLENBQUMsU0FBUztBQUN0RCxZQUFNLGFBQWEsaUJBQWlCLEtBQUssWUFBWSxFQUFFO0FBQ3ZELGFBQU87QUFBQSxRQUNOO0FBQUEsUUFDQSxTQUFTLEtBQUssV0FBVztBQUFBLFFBQ3pCLGFBQWEsS0FBSztBQUFBLFFBQ2xCLE1BQU0sS0FBSztBQUFBLFFBQ1gsU0FBUztBQUFBLFFBQ1QsU0FBUztBQUFBLFFBQ1QsYUFBYTtBQUFBLFFBQ2Isb0JBQW9CO0FBQUEsTUFDckI7QUFBQSxJQUNELENBQUM7QUFDRCxTQUFLLHNCQUFzQixLQUFLLG9CQUFvQixPQUFPLE9BQU87QUFFbEUsU0FBSyxlQUFlO0FBRXBCLFdBQU8sYUFBYSxNQUFNO0FBRXpCLGVBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxvQkFBb0IsUUFBUSxLQUFLO0FBQ3pELFlBQUksS0FBSyxvQkFBb0IsQ0FBQyxNQUFNLFFBQVEsQ0FBQyxHQUFHO0FBQy9DLGVBQUssb0JBQW9CLE9BQU8sR0FBRyxRQUFRLE1BQU07QUFDakQsZUFBSyxlQUFlO0FBQ3BCO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFUSxpQkFBdUI7QUFDOUIsU0FBSyxrQkFBa0I7QUFDdkIsU0FBSyx3QkFBd0IsS0FBSztBQUFBLEVBQ25DO0FBQUEsRUFFVSxlQUFtQztBQUM1QyxRQUFJLENBQUMsS0FBSyxpQkFBaUI7QUFDMUIsWUFBTSxXQUFXLEtBQUssNkJBQTZCLG9CQUFvQixzQkFBc0IsR0FBRyxJQUFJO0FBQ3BHLFlBQU0sWUFBWSxLQUFLLDZCQUE2QixLQUFLLHFCQUFxQixLQUFLO0FBQ25GLFdBQUssa0JBQWtCLElBQUksbUJBQW1CLFVBQVUsV0FBVyxDQUFDLFFBQVEsS0FBSyxLQUFLLEdBQUcsQ0FBQztBQUFBLElBQzNGO0FBQ0EsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRVUsb0JBQTZCO0FBQ3RDLFdBQU8sV0FBVyxTQUFTLFNBQVM7QUFBQSxFQUNyQztBQUFBLEVBRVEsNkJBQTZCLE9BQTBCLFdBQThDO0FBQzVHLFVBQU0sU0FBbUMsQ0FBQztBQUMxQyxRQUFJLFlBQVk7QUFDaEIsZUFBVyxRQUFRLE9BQU87QUFDekIsWUFBTSxPQUFPLEtBQUssUUFBUTtBQUMxQixZQUFNLGFBQWEsS0FBSztBQUV4QixVQUFJLENBQUMsWUFBWTtBQUVoQixlQUFPLFdBQVcsSUFBSSxJQUFJLHVCQUF1QixRQUFXLEtBQUssU0FBUyxLQUFLLGFBQWEsTUFBTSxXQUFXLE1BQU0sS0FBSztBQUFBLE1BQ3pILE9BQU87QUFDTixjQUFNLHNCQUFzQiwyQkFBMkIsa0JBQWtCLFlBQVksRUFBRTtBQUN2RixtQkFBVyxzQkFBc0IscUJBQXFCO0FBQ3JELGlCQUFPLFdBQVcsSUFBSSxJQUFJLHVCQUF1QixvQkFBb0IsS0FBSyxTQUFTLEtBQUssYUFBYSxNQUFNLFdBQVcsTUFBTSxLQUFLO0FBQUEsUUFDbEk7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFTyxrQkFBa0IsWUFBOEM7QUFDdEUsV0FBTywyQkFBMkIsa0JBQWtCLFlBQVksRUFBRTtBQUFBLEVBQ25FO0FBQUEsRUFFTyxxQkFBcUIsZUFBbUQ7QUFDOUUsVUFBTSxRQUFRLElBQUk7QUFBQSxNQUNqQixjQUFjO0FBQUEsTUFDZCxjQUFjO0FBQUEsTUFDZCxjQUFjO0FBQUEsTUFDZCxjQUFjO0FBQUEsTUFDZCxjQUFjO0FBQUEsSUFDZjtBQUNBLFdBQU8sSUFBSSwyQkFBMkIsQ0FBQyxLQUFLLEdBQUcsRUFBRTtBQUFBLEVBQ2xEO0FBQUEsRUFFTyxtQkFBbUIsYUFBMkM7QUFDcEUsV0FBTyxDQUFDO0FBQUEsRUFDVDtBQUFBLEVBRU8saUJBQXlCO0FBQy9CLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFTyxxQkFBNkI7QUFDbkMsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVPLDJCQUEyQixjQUFtRDtBQUFBLEVBRXJGO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLZ0IseUJBQXlCLFdBQThDO0FBQ3RGLFdBQU87QUFBQSxFQUNSO0FBQ0Q7QUFyTWEsOEJBQU47QUFBQSxFQU1KO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVhVO0FBdU1iLE1BQU0seUJBQXlCLFdBQVc7QUFBQSxFQUN6QyxZQUNpQixTQUNoQixhQUNDO0FBQ0QsVUFBTTtBQUhVO0FBSWhCLFNBQUssVUFBVSxXQUFXO0FBQUEsRUFDM0I7QUFDRDtBQUVBLFNBQVMseUJBQXlCLE9BQThDO0FBQy9FLFNBQU8sU0FDSCxPQUFPLFVBQVUsYUFDaEIsQ0FBQyxNQUFNLHNCQUFzQixPQUFPLE1BQU0sdUJBQXVCLGNBQ2pFLENBQUMsTUFBTSxZQUFZLE1BQU0sb0JBQW9CO0FBQ25EO0FBRU8sSUFBTSxpQ0FBTixNQUFzRTtBQUFBLEVBUzVFLFlBQytCLFlBQzdCO0FBRDZCO0FBTi9CLFNBQWlCLDRCQUE0QixJQUFJLFFBQW1DO0FBQ3BGLFNBQWdCLDJCQUE2RCxLQUFLLDBCQUEwQjtBQU8zRyxVQUFNLHVCQUF1QixJQUFJLHFCQUFxQixVQUFVO0FBQ2hFLFNBQUssaUJBQWlCLElBQUk7QUFBQSxNQUN6QixxQkFBcUIsT0FBTztBQUFBLE1BQzVCLG1CQUFtQixpQkFBaUIsVUFBVTtBQUFBLE1BQzlDLG1CQUFtQixpQkFBaUIsVUFBVTtBQUFBLE1BQzlDLG1CQUFtQixpQkFBaUIsVUFBVTtBQUFBLE1BQzlDLG1CQUFtQixpQkFBaUIsVUFBVTtBQUFBLE1BQzlDLG1CQUFtQixpQkFBaUIsVUFBVTtBQUFBLE1BQzlDLElBQUksWUFBZ0M7QUFBQSxNQUNwQyxtQkFBbUIsaUJBQWlCLFVBQVU7QUFBQSxNQUM5QyxJQUFJLFlBQWdDO0FBQUEsTUFDcEM7QUFBQSxJQUNEO0FBQ0EseUJBQXFCLFFBQVE7QUFBQSxFQUM5QjtBQUFBLEVBTUEsU0FBUyxNQUFZLE1BQWlCO0FBQ3JDLFVBQU0sVUFBVSxPQUFPLFNBQVMsV0FBVyxPQUFPO0FBQ2xELFVBQU0sWUFBWSx5QkFBeUIsSUFBSSxJQUFJLE9BQU8seUJBQXlCLElBQUksSUFBSSxPQUFPLENBQUM7QUFDbkcsV0FBTyxLQUFLLGVBQWUsU0FBUyxTQUFTLFdBQVcsTUFBUztBQUFBLEVBQ2xFO0FBQUEsRUFFTyxhQUFhLFFBQXdDO0FBQzNELFVBQU0sV0FBVyxFQUFFLE1BQU0sS0FBSyxlQUFlLE9BQU8sRUFBRTtBQUV0RCxVQUFNLGNBQXdCLENBQUM7QUFFL0IsZUFBVyxTQUFTLFFBQVE7QUFDM0IsWUFBTSxDQUFDLEtBQUssS0FBSyxJQUFJO0FBQ3JCLFVBQUksS0FBSyxTQUFTLEdBQUcsTUFBTSxPQUFPO0FBQ2pDO0FBQUEsTUFDRDtBQUNBLFdBQUssZUFBZSxZQUFZLEtBQUssS0FBSztBQUMxQyxrQkFBWSxLQUFLLEdBQUc7QUFBQSxJQUNyQjtBQUVBLFFBQUksWUFBWSxTQUFTLEdBQUc7QUFDM0IsWUFBTSwyQkFBMkIsSUFBSSx5QkFBeUIsRUFBRSxNQUFNLGFBQWEsV0FBVyxDQUFDLEVBQUUsR0FBRyxVQUFVLEtBQUssZ0JBQWdCLFFBQVcsS0FBSyxVQUFVO0FBQzdKLCtCQUF5QixTQUFTLG9CQUFvQjtBQUN0RCxXQUFLLDBCQUEwQixLQUFLLHdCQUF3QjtBQUFBLElBQzdEO0FBRUEsV0FBTyxRQUFRLFFBQVE7QUFBQSxFQUN4QjtBQUFBLEVBRU8sWUFBWSxLQUFhLE9BQVksTUFBWSxNQUEyQjtBQUNsRixXQUFPLEtBQUssYUFBYSxDQUFDLENBQUMsS0FBSyxLQUFLLENBQUMsQ0FBQztBQUFBLEVBQ3hDO0FBQUEsRUFFTyxRQUFXLEtBQWEsVUFBbUMsQ0FBQyxHQUEyQjtBQUM3RixXQUFPLEtBQUssZUFBZSxRQUFXLEtBQUssU0FBUyxNQUFTO0FBQUEsRUFDOUQ7QUFBQSxFQUVPLE9BQU87QUFDYixXQUFPLEtBQUssZUFBZSxLQUFLLE1BQVM7QUFBQSxFQUMxQztBQUFBLEVBRU8sc0JBQXFDO0FBQzNDLFdBQU8sUUFBUSxRQUFRLE1BQVM7QUFBQSxFQUNqQztBQUFBLEVBRU8sdUJBQWtEO0FBQ3hELFVBQU0sYUFBa0M7QUFBQSxNQUN2QyxVQUFVLENBQUM7QUFBQSxNQUNYLE1BQU0sQ0FBQztBQUFBLE1BQ1AsV0FBVyxDQUFDO0FBQUEsSUFDYjtBQUNBLFdBQU87QUFBQSxNQUNOLFVBQVU7QUFBQSxNQUNWLFFBQVE7QUFBQSxNQUNSLGFBQWE7QUFBQSxNQUNiLFdBQVc7QUFBQSxNQUNYLFlBQVk7QUFBQSxNQUNaLFdBQVc7QUFBQSxNQUNYLFNBQVMsQ0FBQztBQUFBLElBQ1g7QUFBQSxFQUNEO0FBQ0Q7QUE3RmEsaUNBQU47QUFBQSxFQVVKO0FBQUEsR0FWVTtBQStGYixJQUFNLHlDQUFOLE1BQTBGO0FBQUEsRUFPekYsWUFDeUMsc0JBQ1IsY0FDRyxpQkFDbEM7QUFIdUM7QUFDUjtBQUNHO0FBTnBDLFNBQWlCLDRCQUE0QixJQUFJLFFBQStDO0FBQ2hHLFNBQWdCLDJCQUEyQixLQUFLLDBCQUEwQjtBQU96RSxTQUFLLHFCQUFxQix5QkFBeUIsQ0FBQyxNQUFNO0FBQ3pELFdBQUssMEJBQTBCLEtBQUssRUFBRSxjQUFjLEVBQUUsY0FBYyxzQkFBc0IsQ0FBQyxVQUFlLGtCQUEwQixFQUFFLHFCQUFxQixhQUFhLEVBQUUsQ0FBQztBQUFBLElBQzVLLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFJQSxTQUFZLFVBQTJCLE1BQVksTUFBWTtBQUM5RCxVQUFNLFdBQTZCLElBQUksWUFBWSxJQUFJLElBQUksT0FBTztBQUNsRSxVQUFNLFVBQThCLFdBQVksT0FBTyxTQUFTLFdBQVcsT0FBTyxTQUFjLE9BQU8sU0FBUyxXQUFXLE9BQU87QUFDbEksVUFBTSxXQUFXLFdBQVcsS0FBSyxZQUFZLFVBQVUsUUFBUSxJQUFJO0FBQ25FLFFBQUksT0FBTyxZQUFZLGFBQWE7QUFDbkMsYUFBTyxLQUFLLHFCQUFxQixTQUFZO0FBQUEsUUFDNUM7QUFBQSxRQUNBLG9CQUFvQjtBQUFBLE1BQ3JCLENBQUM7QUFBQSxJQUNGO0FBQ0EsV0FBTyxLQUFLLHFCQUFxQixTQUFZLFNBQVM7QUFBQSxNQUNyRDtBQUFBLE1BQ0Esb0JBQW9CO0FBQUEsSUFDckIsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLFFBQVcsVUFBMkIsVUFBNEIsU0FBbUQ7QUFDcEgsVUFBTSxXQUFXLFdBQVcsS0FBSyxZQUFZLFVBQVUsUUFBUSxJQUFJO0FBQ25FLFdBQU8sS0FBSyxxQkFBcUIsUUFBVyxTQUFTLEVBQUUsVUFBVSxvQkFBb0IsU0FBUyxDQUFDO0FBQUEsRUFDaEc7QUFBQSxFQUVRLFlBQVksVUFBZSxVQUEyQztBQUM3RSxVQUFNLFFBQVEsS0FBSyxhQUFhLFNBQVMsUUFBUTtBQUNqRCxRQUFJLE9BQU87QUFDVixhQUFPLFdBQVcsTUFBTSx3QkFBd0IsU0FBUyxZQUFZLFNBQVMsTUFBTSxJQUFJLE1BQU0sY0FBYztBQUFBLElBQzdHO0FBQ0EsV0FBTyxLQUFLLGdCQUFnQixxQ0FBcUMsUUFBUTtBQUFBLEVBQzFFO0FBQUEsRUFFQSxZQUFZLFVBQWUsS0FBYSxPQUFZLHFCQUEwRDtBQUM3RyxXQUFPLEtBQUsscUJBQXFCLFlBQVksS0FBSyxPQUFPLEVBQUUsU0FBUyxHQUFHLG1CQUFtQjtBQUFBLEVBQzNGO0FBQ0Q7QUFuRE0seUNBQU47QUFBQSxFQVFHO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVZHO0FBcUROLElBQU0sc0NBQU4sTUFBb0Y7QUFBQSxFQUluRixZQUN5QyxzQkFDdkM7QUFEdUM7QUFBQSxFQUV6QztBQUFBLEVBRUEsT0FBTyxVQUFlLFVBQTJCO0FBQ2hELFVBQU0sTUFBTSxLQUFLLHFCQUFxQixTQUFTLGFBQWEsRUFBRSxvQkFBb0IsVUFBVSxTQUFTLENBQUM7QUFDdEcsUUFBSSxPQUFPLE9BQU8sUUFBUSxZQUFZLFFBQVEsUUFBUTtBQUNyRCxhQUFPO0FBQUEsSUFDUjtBQUNBLFdBQVEsV0FBVyxjQUFlLE9BQU87QUFBQSxFQUMxQztBQUNEO0FBaEJNLHNDQUFOO0FBQUEsRUFLRztBQUFBLEdBTEc7QUFrQk4sTUFBTSwyQkFBd0Q7QUFBQSxFQUE5RDtBQUVDLFNBQVMsaUJBQWlCLGVBQWU7QUFDekMsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsWUFBWTtBQUNyQixTQUFTLFFBQVE7QUFDakIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMscUJBQXFCO0FBQUE7QUFBQSxFQUM5QixhQUFtQjtBQUFBLEVBQUU7QUFBQSxFQUNyQix3QkFBOEI7QUFBQSxFQUFFO0FBQUEsRUFDaEMsWUFBWTtBQUFBLEVBQUU7QUFBQSxFQUNkLGFBQWE7QUFBQSxFQUFFO0FBQUEsRUFDZixpQkFBaUI7QUFBQSxFQUFFO0FBQUEsRUFDbkIsa0JBQWtCO0FBQUEsRUFBRTtBQUNyQjtBQUVBLE1BQU0scUNBQU4sTUFBTSxtQ0FBc0U7QUFBQSxFQW9CM0UsY0FBYztBQWRkLFNBQWlCLDRCQUE0QixJQUFJLFFBQWM7QUFDL0QsU0FBZ0IsMkJBQXdDLEtBQUssMEJBQTBCO0FBRXZGLFNBQWlCLGdDQUFnQyxJQUFJLFFBQTBDO0FBQy9GLFNBQWdCLCtCQUF3RSxLQUFLLDhCQUE4QjtBQUUzSCxTQUFpQiwrQkFBK0IsSUFBSSxRQUFzQztBQUMxRixTQUFnQiw4QkFBbUUsS0FBSyw2QkFBNkI7QUFFckgsU0FBaUIsNkJBQTZCLElBQUksUUFBd0I7QUFDMUUsU0FBZ0IsNEJBQW1ELEtBQUssMkJBQTJCO0FBS2xHLFVBQU0sV0FBVyxJQUFJLEtBQUssRUFBRSxRQUFRLG1DQUFrQyxRQUFRLFdBQVcsU0FBUyxNQUFNLElBQUksQ0FBQztBQUM3RyxTQUFLLFlBQVksRUFBRSxJQUFJLGdDQUFnQyxTQUFTLENBQUMsSUFBSSxnQkFBZ0IsRUFBRSxLQUFLLFVBQVUsTUFBTSxJQUFJLE9BQU8sRUFBRSxDQUFDLENBQUMsRUFBRTtBQUFBLEVBQzlIO0FBQUEsRUFFQSx1QkFBNEM7QUFDM0MsV0FBTyxRQUFRLFFBQVEsS0FBSyxhQUFhLENBQUM7QUFBQSxFQUMzQztBQUFBLEVBRU8sZUFBMkI7QUFDakMsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRU8sb0JBQW9DO0FBQzFDLFFBQUksS0FBSyxXQUFXO0FBQ25CLFVBQUksS0FBSyxVQUFVLGVBQWU7QUFDakMsZUFBTyxlQUFlO0FBQUEsTUFDdkI7QUFDQSxhQUFPLGVBQWU7QUFBQSxJQUN2QjtBQUNBLFdBQU8sZUFBZTtBQUFBLEVBQ3ZCO0FBQUEsRUFFTyxtQkFBbUIsVUFBd0M7QUFDakUsV0FBTyxZQUFZLFNBQVMsV0FBVyxtQ0FBa0MsU0FBUyxLQUFLLFVBQVUsUUFBUSxDQUFDLElBQUk7QUFBQSxFQUMvRztBQUFBLEVBRU8sa0JBQWtCLFVBQXdCO0FBQ2hELFdBQU8sWUFBWSxTQUFTLFdBQVcsbUNBQWtDO0FBQUEsRUFDMUU7QUFBQSxFQUVPLG1CQUFtQixxQkFBNkY7QUFDdEgsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQXRETSxtQ0FJbUIsU0FBUztBQUpsQyxJQUFNLG9DQUFOO0FBd0RPLFNBQVMsMkJBQTJCLHNCQUE2QyxRQUFhLGNBQTZCO0FBQ2pJLE1BQUksQ0FBQyxRQUFRO0FBQ1o7QUFBQSxFQUNEO0FBQ0EsTUFBSSxFQUFFLGdDQUFnQyxpQ0FBaUM7QUFDdEU7QUFBQSxFQUNEO0FBQ0EsUUFBTSxXQUE0QixDQUFDO0FBQ25DLFNBQU8sS0FBSyxNQUFNLEVBQUUsUUFBUSxDQUFDLFFBQVE7QUFDcEMsUUFBSSx5QkFBeUIsR0FBRyxHQUFHO0FBQ2xDLGVBQVMsS0FBSyxDQUFDLFVBQVUsR0FBRyxJQUFJLE9BQU8sR0FBRyxDQUFDLENBQUM7QUFBQSxJQUM3QztBQUNBLFFBQUksZ0JBQWdCLDZCQUE2QixHQUFHLEdBQUc7QUFDdEQsZUFBUyxLQUFLLENBQUMsY0FBYyxHQUFHLElBQUksT0FBTyxHQUFHLENBQUMsQ0FBQztBQUFBLElBQ2pEO0FBQUEsRUFDRCxDQUFDO0FBQ0QsTUFBSSxTQUFTLFNBQVMsR0FBRztBQUN4Qix5QkFBcUIsYUFBYSxRQUFRO0FBQUEsRUFDM0M7QUFDRDtBQUVBLElBQU0sNEJBQU4sTUFBNEQ7QUFBQSxFQUczRCxZQUNpQyxlQUMvQjtBQUQrQjtBQUFBLEVBR2pDO0FBQUEsRUFFQSxvQkFBMkI7QUFDMUIsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLG9CQUFpQztBQUNoQyxXQUFPLFdBQVc7QUFBQSxFQUNuQjtBQUFBLEVBRUEsTUFBTSxNQUFNLFNBQXlDLFVBQXVEO0FBQzNHLFVBQU0sUUFBUSxNQUFNLFFBQVEsT0FBTyxJQUFJLFVBQVUsYUFBYSxRQUFRLE9BQU87QUFDN0UsVUFBTSxZQUFZLG9CQUFJLElBQXdDO0FBRTlELGVBQVcsUUFBUSxPQUFPO0FBQ3pCLFVBQUksRUFBRSxnQkFBZ0IsbUJBQW1CO0FBQ3hDLGNBQU0sSUFBSSxNQUFNLDBDQUEwQztBQUFBLE1BQzNEO0FBQ0EsWUFBTSxRQUFRLEtBQUssY0FBYyxTQUFTLEtBQUssUUFBUTtBQUN2RCxVQUFJLENBQUMsT0FBTztBQUNYLGNBQU0sSUFBSSxNQUFNLDRCQUE0QjtBQUFBLE1BQzdDO0FBQ0EsVUFBSSxPQUFPLEtBQUssY0FBYyxZQUFZLE1BQU0sYUFBYSxNQUFNLEtBQUssV0FBVztBQUNsRixjQUFNLElBQUksTUFBTSwyQ0FBMkM7QUFBQSxNQUM1RDtBQUNBLFVBQUksUUFBUSxVQUFVLElBQUksS0FBSztBQUMvQixVQUFJLENBQUMsT0FBTztBQUNYLGdCQUFRLENBQUM7QUFDVCxrQkFBVSxJQUFJLE9BQU8sS0FBSztBQUFBLE1BQzNCO0FBQ0EsWUFBTSxLQUFLLGNBQWMsWUFBWSxNQUFNLEtBQUssS0FBSyxTQUFTLEtBQUssR0FBRyxLQUFLLFNBQVMsSUFBSSxDQUFDO0FBQUEsSUFDMUY7QUFHQSxRQUFJLGFBQWE7QUFDakIsUUFBSSxhQUFhO0FBQ2pCLGVBQVcsQ0FBQyxPQUFPQSxNQUFLLEtBQUssV0FBVztBQUN2QyxZQUFNLGlCQUFpQjtBQUN2QixZQUFNLG1CQUFtQixDQUFDLEdBQUdBLFFBQU8sTUFBTSxDQUFDLENBQUM7QUFDNUMsWUFBTSxpQkFBaUI7QUFDdkIsb0JBQWM7QUFDZCxvQkFBY0EsT0FBTTtBQUFBLElBQ3JCO0FBRUEsV0FBTztBQUFBLE1BQ04sYUFBYSxRQUFRLE9BQU8sc0JBQXNCLHdCQUF3QixZQUFZLFVBQVU7QUFBQSxNQUNoRyxXQUFXLGFBQWE7QUFBQSxJQUN6QjtBQUFBLEVBQ0Q7QUFDRDtBQXhETSw0QkFBTjtBQUFBLEVBSUc7QUFBQSxHQUpHO0FBMEROLE1BQU0sMEJBQW1EO0FBQUEsRUFBekQ7QUFJQyxTQUFnQix3QkFBc0QsTUFBTTtBQUFBO0FBQUEsRUFFckUsWUFBWSxVQUFlLFNBQW9FO0FBQ3JHLFFBQUksU0FBUyxXQUFXLFFBQVE7QUFDL0IsYUFBTyxTQUFTO0FBQUEsSUFDakI7QUFDQSxXQUFPLFNBQVM7QUFBQSxFQUNqQjtBQUFBLEVBRUEsb0JBQW9CLFVBQXVCO0FBQzFDLFdBQU8sU0FBUyxRQUFRO0FBQUEsRUFDekI7QUFBQSxFQUVPLGtCQUFrQixXQUF1RixTQUEwQztBQUN6SixXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRU8sYUFBYSxRQUFnQixXQUFnQztBQUNuRSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRU8sa0JBQWtCLFdBQWdEO0FBQ3hFLFVBQU0sSUFBSSxNQUFNLGlCQUFpQjtBQUFBLEVBQ2xDO0FBQUEsRUFFTyx3QkFBd0IsV0FBZ0Q7QUFDOUUsV0FBTyxLQUFLLGtCQUFrQixTQUFTO0FBQUEsRUFDeEM7QUFBQSxFQUVPLGVBQXVCO0FBQzdCLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFTyxpQkFBcUM7QUFDM0MsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQUdBLElBQU0sK0JBQU4sY0FBMkMsbUJBQW1CO0FBQUEsRUFFN0QsWUFDaUIsZUFDcUIsb0JBQ3BDO0FBQ0QsVUFBTSxhQUFhO0FBRmtCO0FBQUEsRUFHdEM7QUFBQSxFQUVTLGdCQUFnQixVQUFnQyxXQUF5QixZQUF3QztBQUN6SCxRQUFJLENBQUMsV0FBVztBQUNmLFlBQU0sYUFBYSxLQUFLLG1CQUFtQixxQkFBcUIsS0FBSyxLQUFLLG1CQUFtQixvQkFBb0I7QUFDakgsVUFBSSxZQUFZO0FBQ2Ysb0JBQVksV0FBVyxvQkFBb0I7QUFBQSxNQUM1QztBQUFBLElBQ0Q7QUFDQSxXQUFPLE1BQU0sZ0JBQWdCLFVBQVUsV0FBVyxVQUFVO0FBQUEsRUFDN0Q7QUFDRDtBQWxCTSwrQkFBTjtBQUFBLEVBR0c7QUFBQSxFQUNBO0FBQUEsR0FKRztBQW9CTixNQUFNLDBDQUFzRjtBQUFBLEVBQTVGO0FBR0MsU0FBUSxnQkFBZ0IsSUFBSSxRQUFlO0FBQzNDLFNBQWdCLG1CQUFtQyxLQUFLLGNBQWM7QUFDdEUscUNBQXlDLEtBQUssY0FBYztBQUM1RCxTQUFnQixvQkFBb0IsUUFBUSxRQUFRO0FBQ3BELFNBQWdCLDRCQUE0QixRQUFRLFFBQVE7QUFDNUQsU0FBZ0IsNkJBQTZCO0FBQUE7QUFBQSxFQUU3QyxxQkFBOEI7QUFDN0IsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUNBLHlCQUFrQztBQUNqQyxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBQ0EsMEJBQW1DO0FBQ2xDLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFDQSxNQUFNLHFCQUFxQixTQUFpQztBQUFBLEVBRTVEO0FBQUEsRUFDQSx1QkFBZ0M7QUFDL0IsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUNBLE1BQU0sa0JBQWtCLFNBQWlDO0FBQUEsRUFFekQ7QUFBQSxFQUNBLGdCQUFnQixLQUEyQztBQUMxRCxVQUFNLElBQUksTUFBTSx1QkFBdUI7QUFBQSxFQUN4QztBQUFBLEVBQ0EsTUFBTSxhQUFhLEtBQVksU0FBaUM7QUFBQSxFQUVoRTtBQUFBLEVBQ0EsaUJBQXdCO0FBQ3ZCLFdBQU8sQ0FBQztBQUFBLEVBQ1Q7QUFBQSxFQUNBLE1BQU0sZUFBZSxNQUE0QjtBQUFBLEVBRWpEO0FBQUEsRUFDQSx1Q0FBdUMsYUFBZ0U7QUFDdEcsVUFBTSxJQUFJLE1BQU0sdUJBQXVCO0FBQUEsRUFDeEM7QUFDRDtBQUVBLE1BQU0sa0NBQWtDLGdCQUFnQjtBQUFBLEVBQ3ZELGNBQWM7QUFDYixVQUFNO0FBQUEsRUFDUDtBQUNEO0FBRUEsTUFBTSw2QkFBNkIsV0FBVztBQUFBLEVBQzdDLGNBQWM7QUFDYixVQUFNLElBQUksY0FBYyxDQUFDO0FBQUEsRUFDMUI7QUFDRDtBQUVBLElBQU0sK0JBQU4sY0FBMkMsbUJBQW1CO0FBQUEsRUFDN0QsWUFDb0Isa0JBQ0cscUJBQ0Qsb0JBQ0QsbUJBQ04sYUFDTSxtQkFDbkI7QUFDRCxVQUFNLGtCQUFrQixxQkFBcUIsb0JBQW9CLG1CQUFtQixhQUFhLGlCQUFpQjtBQUNsSCxTQUFLLFVBQVUsRUFBRSxZQUFZLE1BQU0sQ0FBQztBQUFBLEVBQ3JDO0FBQ0Q7QUFaTSwrQkFBTjtBQUFBLEVBRUc7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBUEc7QUFjTixNQUFNLG1DQUF5RDtBQUFBLEVBQzlELG1CQUFtQjtBQUFBLEVBQ25CLE9BQU87QUFDUjtBQUVBLElBQU0sZ0NBQU4sY0FBNEMsb0JBQW9CO0FBQUEsRUFDL0QsWUFDZ0IsY0FDb0Isc0JBQ3RCLFlBQ2tCLDhCQUNMLHlCQUN6QjtBQUNELFVBQU0sa0NBQWtDLGNBQWMsc0JBQXNCLFlBQVksOEJBQThCLHVCQUF1QjtBQUFBLEVBQzlJO0FBQ0Q7QUFWTSxnQ0FBTjtBQUFBLEVBRUc7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FORztBQVlOLE1BQU0sb0NBQTJFO0FBQUEsRUFFaEYsTUFBTSxXQUFXLEtBQTBCLFNBQTRCO0FBQUEsRUFDdkU7QUFBQSxFQUVBLE1BQU0sWUFBWSxNQUE0QztBQUFBLEVBQzlEO0FBQUEsRUFFQSxnQkFBZ0IsUUFBNkIsYUFBc0IsVUFBOEU7QUFDaEosV0FBTyxxQkFBcUIsTUFBTSxLQUFLO0FBQUEsRUFDeEM7QUFBQSxFQUVBLFdBQVcsUUFBNkIsVUFBeUM7QUFDaEYsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLGVBQWUsS0FBbUM7QUFDakQsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLHNCQUFzQixLQUFtQztBQUN4RCxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsc0JBQXNCLEtBQXVDO0FBQzVELFdBQU8sTUFBTTtBQUFBLEVBQ2Q7QUFBQSxFQUVBLE1BQU0sVUFBVSxLQUFZLHFCQUEwRDtBQUFBLEVBQ3RGO0FBQUEsRUFDQSxlQUFlLEtBQXVDO0FBQ3JELFdBQU8sYUFBYSxNQUFNO0FBQUEsSUFBRSxDQUFDO0FBQUEsRUFDOUI7QUFDRDtBQU1BLGtCQUFrQixhQUFhLHNCQUFzQixrQkFBa0IsS0FBSztBQUM1RSxrQkFBa0IsdUJBQXVCLGdDQUFnQyxrQkFBa0IsS0FBSztBQUNoRyxrQkFBa0IsbUNBQW1DLHdDQUF3QyxrQkFBa0IsS0FBSztBQUNwSCxrQkFBa0IsZ0NBQWdDLHFDQUFxQyxrQkFBa0IsS0FBSztBQUM5RyxrQkFBa0IsMEJBQTBCLG1DQUFtQyxrQkFBa0IsS0FBSztBQUN0RyxrQkFBa0IsZUFBZSwyQkFBMkIsa0JBQWtCLEtBQUs7QUFDbkYsa0JBQWtCLG1CQUFtQiw0QkFBNEIsa0JBQWtCLEtBQUs7QUFDeEYsa0JBQWtCLGdCQUFnQix5QkFBeUIsa0JBQWtCLEtBQUs7QUFDbEYsa0JBQWtCLHFCQUFxQiw4QkFBOEIsa0JBQWtCLEtBQUs7QUFDNUYsa0JBQWtCLHNCQUFzQiwrQkFBK0Isa0JBQWtCLEtBQUs7QUFDOUYsa0JBQWtCLGdCQUFnQixlQUFlLGtCQUFrQixLQUFLO0FBQ3hFLGtCQUFrQixrQkFBa0IsMkJBQTJCLGtCQUFrQixLQUFLO0FBQ3RGLGtCQUFrQix5QkFBeUIsd0JBQXdCLGtCQUFrQixLQUFLO0FBQzFGLGtCQUFrQixlQUFlLGNBQWMsa0JBQWtCLEtBQUs7QUFDdEUsa0JBQWtCLDJCQUEyQiwwQkFBMEIsa0JBQWtCLEtBQUs7QUFDOUYsa0JBQWtCLG9CQUFvQixtQkFBbUIsa0JBQWtCLEtBQUs7QUFDaEYsa0JBQWtCLGtCQUFrQiwyQkFBMkIsa0JBQWtCLEtBQUs7QUFDdEYsa0JBQWtCLHdCQUF3QixpQ0FBaUMsa0JBQWtCLEtBQUs7QUFDbEcsa0JBQWtCLGlCQUFpQix3QkFBd0Isa0JBQWtCLEtBQUs7QUFDbEYsa0JBQWtCLHNCQUFzQiwrQkFBK0Isa0JBQWtCLEtBQUs7QUFDOUYsa0JBQWtCLGtCQUFrQiwyQkFBMkIsa0JBQWtCLEtBQUs7QUFDdEYsa0JBQWtCLGtDQUFrQywyQ0FBMkMsa0JBQWtCLEtBQUs7QUFDdEgsa0JBQWtCLG1CQUFtQiw0QkFBNEIsa0JBQWtCLEtBQUs7QUFDeEYsa0JBQWtCLHVCQUF1QixzQkFBc0Isa0JBQWtCLEtBQUs7QUFDdEYsa0JBQWtCLGNBQWMsYUFBYSxrQkFBa0IsS0FBSztBQUNwRSxrQkFBa0IsaUJBQWlCLDBCQUEwQixrQkFBa0IsS0FBSztBQUNwRixrQkFBa0Isb0JBQW9CLDZCQUE2QixrQkFBa0IsS0FBSztBQUMxRixrQkFBa0Isb0JBQW9CLDZCQUE2QixrQkFBa0IsS0FBSztBQUMxRixrQkFBa0IscUJBQXFCLDhCQUE4QixrQkFBa0IsS0FBSztBQUM1RixrQkFBa0IsZ0JBQWdCLGVBQWUsa0JBQWtCLEtBQUs7QUFDeEUsa0JBQWtCLG1CQUFtQix5QkFBeUIsa0JBQWtCLEtBQUs7QUFDckYsa0JBQWtCLHFCQUFxQiw4QkFBOEIsa0JBQWtCLEtBQUs7QUFDNUYsa0JBQWtCLGNBQWMsYUFBYSxrQkFBa0IsS0FBSztBQUNwRSxrQkFBa0IsNkJBQTZCLHFDQUFxQyxrQkFBa0IsS0FBSztBQUMzRyxrQkFBa0IsMEJBQTBCLG1DQUFtQyxrQkFBa0IsS0FBSztBQU0vRixJQUFPO0FBQUEsQ0FBUCxDQUFPQyx3QkFBUDtBQUVOLFFBQU0sb0JBQW9CLElBQUksa0JBQWtCO0FBQ2hELGFBQVcsQ0FBQyxJQUFJLFVBQVUsS0FBSywrQkFBK0IsR0FBRztBQUNoRSxzQkFBa0IsSUFBSSxJQUFJLFVBQVU7QUFBQSxFQUNyQztBQUVBLFFBQU0sdUJBQXVCLElBQUkscUJBQXFCLG1CQUFtQixJQUFJO0FBQzdFLG9CQUFrQixJQUFJLHVCQUF1QixvQkFBb0I7QUFFMUQsV0FBUyxJQUFPLFdBQW9DO0FBQzFELFFBQUksQ0FBQyxhQUFhO0FBQ2pCLGlCQUFXLENBQUMsQ0FBQztBQUFBLElBQ2Q7QUFDQSxVQUFNLElBQUksa0JBQWtCLElBQUksU0FBUztBQUN6QyxRQUFJLENBQUMsR0FBRztBQUNQLFlBQU0sSUFBSSxNQUFNLHFCQUFxQixTQUFTO0FBQUEsSUFDL0M7QUFDQSxRQUFJLGFBQWEsZ0JBQWdCO0FBQ2hDLGFBQU8scUJBQXFCLGVBQWUsQ0FBQyxhQUFhLFNBQVMsSUFBSSxTQUFTLENBQUM7QUFBQSxJQUNqRixPQUFPO0FBQ04sYUFBTztBQUFBLElBQ1I7QUFBQSxFQUNEO0FBYk8sRUFBQUEsb0JBQVM7QUFlaEIsTUFBSSxjQUFjO0FBQ2xCLFFBQU0sa0JBQWtCLElBQUksUUFBYztBQUNuQyxXQUFTLFdBQVcsV0FBMkQ7QUFDckYsUUFBSSxhQUFhO0FBQ2hCLGFBQU87QUFBQSxJQUNSO0FBQ0Esa0JBQWM7QUFHZCxlQUFXLENBQUMsSUFBSSxVQUFVLEtBQUssK0JBQStCLEdBQUc7QUFDaEUsVUFBSSxDQUFDLGtCQUFrQixJQUFJLEVBQUUsR0FBRztBQUMvQiwwQkFBa0IsSUFBSSxJQUFJLFVBQVU7QUFBQSxNQUNyQztBQUFBLElBQ0Q7QUFJQSxlQUFXLGFBQWEsV0FBVztBQUNsQyxVQUFJLFVBQVUsZUFBZSxTQUFTLEdBQUc7QUFDeEMsY0FBTSxvQkFBb0IsZ0JBQWdCLFNBQVM7QUFDbkQsY0FBTSxJQUFJLGtCQUFrQixJQUFJLGlCQUFpQjtBQUNqRCxZQUFJLGFBQWEsZ0JBQWdCO0FBQ2hDLDRCQUFrQixJQUFJLG1CQUFtQixVQUFVLFNBQVMsQ0FBQztBQUFBLFFBQzlEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFHQSxVQUFNLGlCQUFpQixrQkFBa0I7QUFDekMsZUFBVyxXQUFXLGdCQUFnQjtBQUNyQyxVQUFJO0FBQ0gsNkJBQXFCLGVBQWUsT0FBTztBQUFBLE1BQzVDLFNBQVMsS0FBSztBQUNiLDBCQUFrQixHQUFHO0FBQUEsTUFDdEI7QUFBQSxJQUNEO0FBRUEsb0JBQWdCLEtBQUs7QUFFckIsV0FBTztBQUFBLEVBQ1I7QUF0Q08sRUFBQUEsb0JBQVM7QUEyQ1QsV0FBUyxhQUFhLFVBQTBDO0FBQ3RFLFFBQUksYUFBYTtBQUNoQixhQUFPLFNBQVM7QUFBQSxJQUNqQjtBQUVBLFVBQU0sYUFBYSxJQUFJLGdCQUFnQjtBQUV2QyxVQUFNLFdBQVcsV0FBVyxJQUFJLGdCQUFnQixNQUFNLE1BQU07QUFDM0QsZUFBUyxRQUFRO0FBQ2pCLGlCQUFXLElBQUksU0FBUyxDQUFDO0FBQUEsSUFDMUIsQ0FBQyxDQUFDO0FBRUYsV0FBTztBQUFBLEVBQ1I7QUFiTyxFQUFBQSxvQkFBUztBQUFBLEdBdEVIOyIsCiAgIm5hbWVzIjogWyJlZGl0cyIsICJTdGFuZGFsb25lU2VydmljZXMiXQp9Cg==
