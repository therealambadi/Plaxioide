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
import { Schemas } from "../../../../base/common/network.js";
import { Disposable, DisposableStore, dispose } from "../../../../base/common/lifecycle.js";
import { parse } from "../../../../base/common/marshalling.js";
import { extname, isEqual } from "../../../../base/common/resources.js";
import { assertType } from "../../../../base/common/types.js";
import { URI } from "../../../../base/common/uri.js";
import { toFormattedString } from "../../../../base/common/jsonFormatter.js";
import { DefaultEndOfLine } from "../../../../editor/common/model.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import * as nls from "../../../../nls.js";
import { Extensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { EditorPaneDescriptor } from "../../../browser/editor.js";
import { Extensions as WorkbenchExtensions, WorkbenchPhase, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { EditorExtensions } from "../../../common/editor.js";
import { NotebookEditor } from "./notebookEditor.js";
import { NotebookEditorInput } from "../common/notebookEditorInput.js";
import { INotebookService } from "../common/notebookService.js";
import { NotebookService } from "./services/notebookServiceImpl.js";
import { CellKind, CellUri, NotebookWorkingCopyTypeIdentifier, NotebookSetting, NotebookCellsChangeType, NotebookMetadataUri } from "../common/notebookCommon.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IUndoRedoService } from "../../../../platform/undoRedo/common/undoRedo.js";
import { INotebookEditorModelResolverService } from "../common/notebookEditorModelResolverService.js";
import { NotebookDiffEditorInput } from "../common/notebookDiffEditorInput.js";
import { NotebookTextDiffEditor } from "./diff/notebookDiffEditor.js";
import { INotebookEditorWorkerService } from "../common/services/notebookWorkerService.js";
import { NotebookEditorWorkerServiceImpl } from "./services/notebookWorkerServiceImpl.js";
import { INotebookCellStatusBarService } from "../common/notebookCellStatusBarService.js";
import { NotebookCellStatusBarService } from "./services/notebookCellStatusBarServiceImpl.js";
import { INotebookEditorService } from "./services/notebookEditorService.js";
import { NotebookEditorWidgetService } from "./services/notebookEditorServiceImpl.js";
import { Extensions as JSONExtensions } from "../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { Event } from "../../../../base/common/event.js";
import { getFormattedOutputJSON, getStreamOutputData } from "./diff/diffElementViewModel.js";
import { NotebookModelResolverServiceImpl } from "../common/notebookEditorModelResolverServiceImpl.js";
import { INotebookKernelHistoryService, INotebookKernelService } from "../common/notebookKernelService.js";
import { NotebookKernelService } from "./services/notebookKernelServiceImpl.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IWorkingCopyEditorService } from "../../../services/workingCopy/common/workingCopyEditorService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { IEditorGroupsService } from "../../../services/editor/common/editorGroupsService.js";
import { NotebookRendererMessagingService } from "./services/notebookRendererMessagingServiceImpl.js";
import { INotebookRendererMessagingService } from "../common/notebookRendererMessagingService.js";
import { INotebookCellOutlineDataSourceFactory, NotebookCellOutlineDataSourceFactory } from "./viewModel/notebookOutlineDataSourceFactory.js";
import "./controller/coreActions.js";
import "./controller/insertCellActions.js";
import "./controller/executeActions.js";
import "./controller/sectionActions.js";
import "./controller/layoutActions.js";
import "./controller/editActions.js";
import "./controller/cellOutputActions.js";
import "./controller/apiActions.js";
import "./controller/foldingController.js";
import "./controller/chat/notebook.chat.contribution.js";
import "./controller/variablesActions.js";
import "./contrib/editorHint/emptyCellEditorHint.js";
import "./contrib/clipboard/notebookClipboard.js";
import "./contrib/find/notebookFind.js";
import "./contrib/format/formatting.js";
import "./contrib/saveParticipants/saveParticipants.js";
import "./contrib/gettingStarted/notebookGettingStarted.js";
import "./contrib/layout/layoutActions.js";
import "./contrib/marker/markerProvider.js";
import "./contrib/navigation/arrow.js";
import "./contrib/outline/notebookOutline.js";
import "./contrib/profile/notebookProfile.js";
import "./contrib/cellStatusBar/statusBarProviders.js";
import "./contrib/cellStatusBar/contributedStatusBarItemController.js";
import "./contrib/cellStatusBar/executionStatusBarItemController.js";
import "./contrib/editorStatusBar/editorStatusBar.js";
import "./contrib/undoRedo/notebookUndoRedo.js";
import "./contrib/cellCommands/cellCommands.js";
import "./contrib/viewportWarmup/viewportWarmup.js";
import "./contrib/troubleshoot/layout.js";
import "./contrib/debug/notebookBreakpoints.js";
import "./contrib/debug/notebookCellPausing.js";
import "./contrib/debug/notebookDebugDecorations.js";
import "./contrib/execute/executionEditorProgress.js";
import "./contrib/kernelDetection/notebookKernelDetection.js";
import "./contrib/cellDiagnostics/cellDiagnostics.js";
import "./contrib/multicursor/notebookMulticursor.js";
import "./contrib/multicursor/notebookSelectionHighlight.js";
import "./contrib/notebookVariables/notebookInlineVariables.js";
import "./diff/notebookDiffActions.js";
import { editorOptionsRegistry } from "../../../../editor/common/config/editorOptions.js";
import { NotebookExecutionStateService } from "./services/notebookExecutionStateServiceImpl.js";
import { NotebookExecutionService } from "./services/notebookExecutionServiceImpl.js";
import { INotebookExecutionService } from "../common/notebookExecutionService.js";
import { INotebookKeymapService } from "../common/notebookKeymapService.js";
import { NotebookKeymapService } from "./services/notebookKeymapServiceImpl.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../editor/common/languages/modesRegistry.js";
import { INotebookExecutionStateService } from "../common/notebookExecutionStateService.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { COMMENTEDITOR_DECORATION_KEY } from "../../comments/browser/commentReply.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { NotebookKernelHistoryService } from "./services/notebookKernelHistoryServiceImpl.js";
import { INotebookLoggingService } from "../common/notebookLoggingService.js";
import { NotebookLoggingService } from "./services/notebookLoggingServiceImpl.js";
import product from "../../../../platform/product/common/product.js";
import { NotebookVariables } from "./contrib/notebookVariables/notebookVariables.js";
import { AccessibleViewRegistry } from "../../../../platform/accessibility/browser/accessibleViewRegistry.js";
import { NotebookAccessibilityHelp } from "./notebookAccessibilityHelp.js";
import { NotebookAccessibleView } from "./notebookAccessibleView.js";
import { DefaultFormatter } from "../../format/browser/formatActionsMultiple.js";
import { NotebookMultiTextDiffEditor } from "./diff/notebookMultiDiffEditor.js";
import { NotebookMultiDiffEditorInput } from "./diff/notebookMultiDiffEditorInput.js";
import { getFormattedMetadataJSON } from "../common/model/notebookCellTextModel.js";
import { INotebookOutlineEntryFactory, NotebookOutlineEntryFactory } from "./viewModel/notebookOutlineEntryFactory.js";
import { getFormattedNotebookMetadataJSON } from "../common/model/notebookMetadataTextModel.js";
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    NotebookEditor,
    NotebookEditor.ID,
    "Notebook Editor"
  ),
  [
    new SyncDescriptor(NotebookEditorInput)
  ]
);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    NotebookTextDiffEditor,
    NotebookTextDiffEditor.ID,
    "Notebook Diff Editor"
  ),
  [
    new SyncDescriptor(NotebookDiffEditorInput)
  ]
);
Registry.as(EditorExtensions.EditorPane).registerEditorPane(
  EditorPaneDescriptor.create(
    NotebookMultiTextDiffEditor,
    NotebookMultiTextDiffEditor.ID,
    "Notebook Diff Editor"
  ),
  [
    new SyncDescriptor(NotebookMultiDiffEditorInput)
  ]
);
let NotebookDiffEditorSerializer = class {
  constructor(_configurationService) {
    this._configurationService = _configurationService;
  }
  canSerialize() {
    return true;
  }
  serialize(input) {
    assertType(input instanceof NotebookDiffEditorInput);
    return JSON.stringify({
      resource: input.resource,
      originalResource: input.original.resource,
      name: input.getName(),
      originalName: input.original.getName(),
      textDiffName: input.getName(),
      viewType: input.viewType
    });
  }
  deserialize(instantiationService, raw) {
    const data = parse(raw);
    if (!data) {
      return void 0;
    }
    const { resource, originalResource, name, viewType } = data;
    if (!data || !URI.isUri(resource) || !URI.isUri(originalResource) || typeof name !== "string" || typeof viewType !== "string") {
      return void 0;
    }
    if (this._configurationService.getValue("notebook.experimental.enableNewDiffEditor")) {
      return NotebookMultiDiffEditorInput.create(instantiationService, resource, name, void 0, originalResource, viewType);
    } else {
      return NotebookDiffEditorInput.create(instantiationService, resource, name, void 0, originalResource, viewType);
    }
  }
  static canResolveBackup(editorInput, backupResource) {
    return false;
  }
};
NotebookDiffEditorSerializer = __decorateClass([
  __decorateParam(0, IConfigurationService)
], NotebookDiffEditorSerializer);
class NotebookEditorSerializer {
  canSerialize(input) {
    return input.typeId === NotebookEditorInput.ID;
  }
  serialize(input) {
    assertType(input instanceof NotebookEditorInput);
    const data = {
      resource: input.resource,
      preferredResource: input.preferredResource,
      viewType: input.viewType,
      options: input.options
    };
    return JSON.stringify(data);
  }
  deserialize(instantiationService, raw) {
    const data = parse(raw);
    if (!data) {
      return void 0;
    }
    const { resource, preferredResource, viewType, options } = data;
    if (!data || !URI.isUri(resource) || typeof viewType !== "string") {
      return void 0;
    }
    const input = NotebookEditorInput.getOrCreate(instantiationService, resource, preferredResource, viewType, options);
    return input;
  }
}
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(
  NotebookEditorInput.ID,
  NotebookEditorSerializer
);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(
  NotebookDiffEditorInput.ID,
  NotebookDiffEditorSerializer
);
let NotebookContribution = class extends Disposable {
  constructor(undoRedoService, configurationService, codeEditorService) {
    super();
    this.codeEditorService = codeEditorService;
    this.updateCellUndoRedoComparisonKey(configurationService, undoRedoService);
    this._register(configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(NotebookSetting.undoRedoPerCell)) {
        this.updateCellUndoRedoComparisonKey(configurationService, undoRedoService);
      }
    }));
    this.codeEditorService.registerDecorationType("comment-controller", COMMENTEDITOR_DECORATION_KEY, {});
  }
  // Add or remove the cell undo redo comparison key based on the user setting
  updateCellUndoRedoComparisonKey(configurationService, undoRedoService) {
    const undoRedoPerCell = configurationService.getValue(NotebookSetting.undoRedoPerCell);
    if (!undoRedoPerCell) {
      if (!this._uriComparisonKeyComputer) {
        this._uriComparisonKeyComputer = undoRedoService.registerUriComparisonKeyComputer(CellUri.scheme, {
          getComparisonKey: (uri) => {
            if (undoRedoPerCell) {
              return uri.toString();
            }
            return NotebookContribution._getCellUndoRedoComparisonKey(uri);
          }
        });
      }
    } else {
      this._uriComparisonKeyComputer?.dispose();
      this._uriComparisonKeyComputer = void 0;
    }
  }
  static _getCellUndoRedoComparisonKey(uri) {
    const data = CellUri.parse(uri);
    if (!data) {
      return uri.toString();
    }
    return data.notebook.toString();
  }
  dispose() {
    super.dispose();
    this._uriComparisonKeyComputer?.dispose();
  }
};
NotebookContribution.ID = "workbench.contrib.notebook";
NotebookContribution = __decorateClass([
  __decorateParam(0, IUndoRedoService),
  __decorateParam(1, IConfigurationService),
  __decorateParam(2, ICodeEditorService)
], NotebookContribution);
let CellContentProvider = class {
  constructor(textModelService, _modelService, _languageService, _notebookModelResolverService) {
    this._modelService = _modelService;
    this._languageService = _languageService;
    this._notebookModelResolverService = _notebookModelResolverService;
    this._registration = textModelService.registerTextModelContentProvider(CellUri.scheme, this);
  }
  dispose() {
    this._registration.dispose();
  }
  async provideTextContent(resource) {
    const existing = this._modelService.getModel(resource);
    if (existing) {
      return existing;
    }
    const data = CellUri.parse(resource);
    if (!data) {
      return null;
    }
    const ref = await this._notebookModelResolverService.resolve(data.notebook);
    let result = null;
    if (!ref.object.isResolved()) {
      return null;
    }
    for (const cell of ref.object.notebook.cells) {
      if (cell.uri.toString() === resource.toString()) {
        const bufferFactory = {
          create: (defaultEOL) => {
            const newEOL = defaultEOL === DefaultEndOfLine.CRLF ? "\r\n" : "\n";
            cell.textBuffer.setEOL(newEOL);
            return { textBuffer: cell.textBuffer, disposable: Disposable.None };
          },
          getFirstLineText: (limit) => {
            return cell.textBuffer.getLineContent(1).substring(0, limit);
          }
        };
        const languageId = this._languageService.getLanguageIdByLanguageName(cell.language);
        const languageSelection = languageId ? this._languageService.createById(languageId) : cell.cellKind === CellKind.Markup ? this._languageService.createById("markdown") : this._languageService.createByFilepathOrFirstLine(resource, cell.textBuffer.getLineContent(1));
        result = this._modelService.createModel(
          bufferFactory,
          languageSelection,
          resource
        );
        break;
      }
    }
    if (!result) {
      ref.dispose();
      return null;
    }
    const once = Event.any(result.onWillDispose, ref.object.notebook.onWillDispose)(() => {
      once.dispose();
      ref.dispose();
    });
    return result;
  }
};
CellContentProvider.ID = "workbench.contrib.cellContentProvider";
CellContentProvider = __decorateClass([
  __decorateParam(0, ITextModelService),
  __decorateParam(1, IModelService),
  __decorateParam(2, ILanguageService),
  __decorateParam(3, INotebookEditorModelResolverService)
], CellContentProvider);
let CellInfoContentProvider = class {
  constructor(textModelService, _modelService, _languageService, _labelService, _notebookModelResolverService) {
    this._modelService = _modelService;
    this._languageService = _languageService;
    this._labelService = _labelService;
    this._notebookModelResolverService = _notebookModelResolverService;
    this._disposables = [];
    this._disposables.push(textModelService.registerTextModelContentProvider(Schemas.vscodeNotebookCellMetadata, {
      provideTextContent: this.provideMetadataTextContent.bind(this)
    }));
    this._disposables.push(textModelService.registerTextModelContentProvider(Schemas.vscodeNotebookCellOutput, {
      provideTextContent: this.provideOutputTextContent.bind(this)
    }));
    this._disposables.push(this._labelService.registerFormatter({
      scheme: Schemas.vscodeNotebookCellMetadata,
      formatting: {
        label: "${path} (metadata)",
        separator: "/"
      }
    }));
    this._disposables.push(this._labelService.registerFormatter({
      scheme: Schemas.vscodeNotebookCellOutput,
      formatting: {
        label: "${path} (output)",
        separator: "/"
      }
    }));
  }
  dispose() {
    dispose(this._disposables);
  }
  async provideMetadataTextContent(resource) {
    const existing = this._modelService.getModel(resource);
    if (existing) {
      return existing;
    }
    const data = CellUri.parseCellPropertyUri(resource, Schemas.vscodeNotebookCellMetadata);
    if (!data) {
      return null;
    }
    const ref = await this._notebookModelResolverService.resolve(data.notebook);
    let result = null;
    const mode = this._languageService.createById("json");
    const disposables = new DisposableStore();
    for (const cell of ref.object.notebook.cells) {
      if (cell.handle === data.handle) {
        const cellIndex = ref.object.notebook.cells.indexOf(cell);
        const metadataSource = getFormattedMetadataJSON(ref.object.notebook.transientOptions.transientCellMetadata, cell.metadata, cell.language, true);
        result = this._modelService.createModel(
          metadataSource,
          mode,
          resource
        );
        this._disposables.push(disposables.add(ref.object.notebook.onDidChangeContent((e) => {
          if (result && e.rawEvents.some((event) => (event.kind === NotebookCellsChangeType.ChangeCellMetadata || event.kind === NotebookCellsChangeType.ChangeCellLanguage) && event.index === cellIndex)) {
            const value = getFormattedMetadataJSON(ref.object.notebook.transientOptions.transientCellMetadata, cell.metadata, cell.language, true);
            if (result.getValue() !== value) {
              result.setValue(value);
            }
          }
        })));
        break;
      }
    }
    if (!result) {
      ref.dispose();
      return null;
    }
    const once = result.onWillDispose(() => {
      disposables.dispose();
      once.dispose();
      ref.dispose();
    });
    return result;
  }
  parseStreamOutput(op) {
    if (!op) {
      return;
    }
    const streamOutputData = getStreamOutputData(op.outputs);
    if (streamOutputData) {
      return {
        content: streamOutputData,
        mode: this._languageService.createById(PLAINTEXT_LANGUAGE_ID)
      };
    }
    return;
  }
  _getResult(data, cell) {
    let result = void 0;
    const mode = this._languageService.createById("json");
    const op = cell.outputs.find((op2) => op2.outputId === data.outputId || op2.alternativeOutputId === data.outputId);
    const streamOutputData = this.parseStreamOutput(op);
    if (streamOutputData) {
      result = streamOutputData;
      return result;
    }
    const obj = cell.outputs.map((output) => ({
      metadata: output.metadata,
      outputItems: output.outputs.map((opit) => ({
        mimeType: opit.mime,
        data: opit.data.toString()
      }))
    }));
    const outputSource = toFormattedString(obj, {});
    result = {
      content: outputSource,
      mode
    };
    return result;
  }
  async provideOutputsTextContent(resource) {
    const existing = this._modelService.getModel(resource);
    if (existing) {
      return existing;
    }
    const data = CellUri.parseCellPropertyUri(resource, Schemas.vscodeNotebookCellOutput);
    if (!data) {
      return null;
    }
    const ref = await this._notebookModelResolverService.resolve(data.notebook);
    const cell = ref.object.notebook.cells.find((cell2) => cell2.handle === data.handle);
    if (!cell) {
      ref.dispose();
      return null;
    }
    const mode = this._languageService.createById("json");
    const model = this._modelService.createModel(getFormattedOutputJSON(cell.outputs || []), mode, resource, true);
    const cellModelListener = Event.any(cell.onDidChangeOutputs ?? Event.None, cell.onDidChangeOutputItems ?? Event.None)(() => {
      model.setValue(getFormattedOutputJSON(cell.outputs || []));
    });
    const once = model.onWillDispose(() => {
      once.dispose();
      cellModelListener.dispose();
      ref.dispose();
    });
    return model;
  }
  async provideOutputTextContent(resource) {
    const existing = this._modelService.getModel(resource);
    if (existing) {
      return existing;
    }
    const data = CellUri.parseCellOutputUri(resource);
    if (!data) {
      return this.provideOutputsTextContent(resource);
    }
    const ref = await this._notebookModelResolverService.resolve(data.notebook);
    const cell = ref.object.notebook.cells.find((cell2) => !!cell2.outputs.find((op) => op.outputId === data.outputId || op.alternativeOutputId === data.outputId));
    if (!cell) {
      ref.dispose();
      return null;
    }
    const result = this._getResult(data, cell);
    if (!result) {
      ref.dispose();
      return null;
    }
    const model = this._modelService.createModel(result.content, result.mode, resource);
    const cellModelListener = Event.any(cell.onDidChangeOutputs ?? Event.None, cell.onDidChangeOutputItems ?? Event.None)(() => {
      const newResult = this._getResult(data, cell);
      if (!newResult) {
        return;
      }
      model.setValue(newResult.content);
      model.setLanguage(newResult.mode.languageId);
    });
    const once = model.onWillDispose(() => {
      once.dispose();
      cellModelListener.dispose();
      ref.dispose();
    });
    return model;
  }
};
CellInfoContentProvider.ID = "workbench.contrib.cellInfoContentProvider";
CellInfoContentProvider = __decorateClass([
  __decorateParam(0, ITextModelService),
  __decorateParam(1, IModelService),
  __decorateParam(2, ILanguageService),
  __decorateParam(3, ILabelService),
  __decorateParam(4, INotebookEditorModelResolverService)
], CellInfoContentProvider);
let NotebookMetadataContentProvider = class {
  constructor(textModelService, _modelService, _languageService, _labelService, _notebookModelResolverService) {
    this._modelService = _modelService;
    this._languageService = _languageService;
    this._labelService = _labelService;
    this._notebookModelResolverService = _notebookModelResolverService;
    this._disposables = [];
    this._disposables.push(textModelService.registerTextModelContentProvider(Schemas.vscodeNotebookMetadata, {
      provideTextContent: this.provideMetadataTextContent.bind(this)
    }));
    this._disposables.push(this._labelService.registerFormatter({
      scheme: Schemas.vscodeNotebookMetadata,
      formatting: {
        label: "${path} (metadata)",
        separator: "/"
      }
    }));
  }
  dispose() {
    dispose(this._disposables);
  }
  async provideMetadataTextContent(resource) {
    const existing = this._modelService.getModel(resource);
    if (existing) {
      return existing;
    }
    const data = NotebookMetadataUri.parse(resource);
    if (!data) {
      return null;
    }
    const ref = await this._notebookModelResolverService.resolve(data);
    let result = null;
    const mode = this._languageService.createById("json");
    const disposables = new DisposableStore();
    const metadataSource = getFormattedNotebookMetadataJSON(ref.object.notebook.transientOptions.transientDocumentMetadata, ref.object.notebook.metadata);
    result = this._modelService.createModel(
      metadataSource,
      mode,
      resource
    );
    if (!result) {
      ref.dispose();
      return null;
    }
    this._disposables.push(disposables.add(ref.object.notebook.onDidChangeContent((e) => {
      if (result && e.rawEvents.some((event) => event.kind === NotebookCellsChangeType.ChangeCellContent || event.kind === NotebookCellsChangeType.ChangeDocumentMetadata || event.kind === NotebookCellsChangeType.ModelChange)) {
        const value = getFormattedNotebookMetadataJSON(ref.object.notebook.transientOptions.transientDocumentMetadata, ref.object.notebook.metadata);
        if (result.getValue() !== value) {
          result.setValue(value);
        }
      }
    })));
    const once = result.onWillDispose(() => {
      disposables.dispose();
      once.dispose();
      ref.dispose();
    });
    return result;
  }
};
NotebookMetadataContentProvider.ID = "workbench.contrib.notebookMetadataContentProvider";
NotebookMetadataContentProvider = __decorateClass([
  __decorateParam(0, ITextModelService),
  __decorateParam(1, IModelService),
  __decorateParam(2, ILanguageService),
  __decorateParam(3, ILabelService),
  __decorateParam(4, INotebookEditorModelResolverService)
], NotebookMetadataContentProvider);
class RegisterSchemasContribution extends Disposable {
  constructor() {
    super();
    this.registerMetadataSchemas();
  }
  registerMetadataSchemas() {
    const jsonRegistry = Registry.as(JSONExtensions.JSONContribution);
    const metadataSchema = {
      properties: {
        ["language"]: {
          type: "string",
          description: "The language for the cell"
        }
      },
      // patternProperties: allSettings.patternProperties,
      additionalProperties: true,
      allowTrailingCommas: true,
      allowComments: true
    };
    jsonRegistry.registerSchema("vscode://schemas/notebook/cellmetadata", metadataSchema);
  }
}
RegisterSchemasContribution.ID = "workbench.contrib.registerCellSchemas";
let NotebookEditorManager = class {
  constructor(_editorService, _notebookEditorModelService, editorGroups) {
    this._editorService = _editorService;
    this._notebookEditorModelService = _notebookEditorModelService;
    this._disposables = new DisposableStore();
    this._disposables.add(Event.debounce(
      this._notebookEditorModelService.onDidChangeDirty,
      (last, current) => !last ? [current] : [...last, current],
      100
    )(this._openMissingDirtyNotebookEditors, this));
    this._disposables.add(_notebookEditorModelService.onWillFailWithConflict((e) => {
      for (const group of editorGroups.groups) {
        const conflictInputs = group.editors.filter((input) => input instanceof NotebookEditorInput && input.viewType !== e.viewType && isEqual(input.resource, e.resource));
        const p = group.closeEditors(conflictInputs);
        e.waitUntil(p);
      }
    }));
  }
  dispose() {
    this._disposables.dispose();
  }
  _openMissingDirtyNotebookEditors(models) {
    const result = [];
    for (const model of models) {
      if (model.isDirty() && !this._editorService.isOpened({ resource: model.resource, typeId: NotebookEditorInput.ID, editorId: model.viewType }) && extname(model.resource) !== ".interactive") {
        result.push({
          resource: model.resource,
          options: { inactive: true, preserveFocus: true, pinned: true, override: model.viewType }
        });
      }
    }
    if (result.length > 0) {
      this._editorService.openEditors(result);
    }
  }
};
NotebookEditorManager.ID = "workbench.contrib.notebookEditorManager";
NotebookEditorManager = __decorateClass([
  __decorateParam(0, IEditorService),
  __decorateParam(1, INotebookEditorModelResolverService),
  __decorateParam(2, IEditorGroupsService)
], NotebookEditorManager);
let SimpleNotebookWorkingCopyEditorHandler = class extends Disposable {
  constructor(_instantiationService, _workingCopyEditorService, _extensionService, _notebookService) {
    super();
    this._instantiationService = _instantiationService;
    this._workingCopyEditorService = _workingCopyEditorService;
    this._extensionService = _extensionService;
    this._notebookService = _notebookService;
    this._installHandler();
  }
  async handles(workingCopy) {
    const viewType = this.handlesSync(workingCopy);
    if (!viewType) {
      return false;
    }
    return this._notebookService.canResolve(viewType);
  }
  handlesSync(workingCopy) {
    const viewType = this._getViewType(workingCopy);
    if (!viewType || viewType === "interactive") {
      return void 0;
    }
    return viewType;
  }
  isOpen(workingCopy, editor) {
    if (!this.handlesSync(workingCopy)) {
      return false;
    }
    return editor instanceof NotebookEditorInput && editor.viewType === this._getViewType(workingCopy) && isEqual(workingCopy.resource, editor.resource);
  }
  createEditor(workingCopy) {
    return NotebookEditorInput.getOrCreate(this._instantiationService, workingCopy.resource, void 0, this._getViewType(workingCopy));
  }
  async _installHandler() {
    await this._extensionService.whenInstalledExtensionsRegistered();
    this._register(this._workingCopyEditorService.registerHandler(this));
  }
  _getViewType(workingCopy) {
    const notebookType = NotebookWorkingCopyTypeIdentifier.parse(workingCopy.typeId);
    if (notebookType && notebookType.viewType === notebookType.notebookType) {
      return notebookType?.viewType;
    }
    return void 0;
  }
};
SimpleNotebookWorkingCopyEditorHandler.ID = "workbench.contrib.simpleNotebookWorkingCopyEditorHandler";
SimpleNotebookWorkingCopyEditorHandler = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IWorkingCopyEditorService),
  __decorateParam(2, IExtensionService),
  __decorateParam(3, INotebookService)
], SimpleNotebookWorkingCopyEditorHandler);
let NotebookLanguageSelectorScoreRefine = class {
  constructor(_notebookService, languageFeaturesService) {
    this._notebookService = _notebookService;
    languageFeaturesService.setNotebookTypeResolver(this._getNotebookInfo.bind(this));
  }
  _getNotebookInfo(uri) {
    const cellUri = CellUri.parse(uri);
    if (!cellUri) {
      return void 0;
    }
    const notebook = this._notebookService.getNotebookTextModel(cellUri.notebook);
    if (!notebook) {
      return void 0;
    }
    return {
      uri: notebook.uri,
      type: notebook.viewType
    };
  }
};
NotebookLanguageSelectorScoreRefine.ID = "workbench.contrib.notebookLanguageSelectorScoreRefine";
NotebookLanguageSelectorScoreRefine = __decorateClass([
  __decorateParam(0, INotebookService),
  __decorateParam(1, ILanguageFeaturesService)
], NotebookLanguageSelectorScoreRefine);
const workbenchContributionsRegistry = Registry.as(WorkbenchExtensions.Workbench);
registerWorkbenchContribution2(NotebookContribution.ID, NotebookContribution, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(CellContentProvider.ID, CellContentProvider, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(CellInfoContentProvider.ID, CellInfoContentProvider, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(NotebookMetadataContentProvider.ID, NotebookMetadataContentProvider, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(RegisterSchemasContribution.ID, RegisterSchemasContribution, WorkbenchPhase.BlockStartup);
registerWorkbenchContribution2(NotebookEditorManager.ID, NotebookEditorManager, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(NotebookLanguageSelectorScoreRefine.ID, NotebookLanguageSelectorScoreRefine, WorkbenchPhase.BlockRestore);
registerWorkbenchContribution2(SimpleNotebookWorkingCopyEditorHandler.ID, SimpleNotebookWorkingCopyEditorHandler, WorkbenchPhase.BlockRestore);
workbenchContributionsRegistry.registerWorkbenchContribution(NotebookVariables, LifecyclePhase.Eventually);
AccessibleViewRegistry.register(new NotebookAccessibleView());
AccessibleViewRegistry.register(new NotebookAccessibilityHelp());
registerSingleton(INotebookService, NotebookService, InstantiationType.Delayed);
registerSingleton(INotebookEditorWorkerService, NotebookEditorWorkerServiceImpl, InstantiationType.Delayed);
registerSingleton(INotebookEditorModelResolverService, NotebookModelResolverServiceImpl, InstantiationType.Delayed);
registerSingleton(INotebookCellStatusBarService, NotebookCellStatusBarService, InstantiationType.Delayed);
registerSingleton(INotebookEditorService, NotebookEditorWidgetService, InstantiationType.Delayed);
registerSingleton(INotebookKernelService, NotebookKernelService, InstantiationType.Delayed);
registerSingleton(INotebookKernelHistoryService, NotebookKernelHistoryService, InstantiationType.Delayed);
registerSingleton(INotebookExecutionService, NotebookExecutionService, InstantiationType.Delayed);
registerSingleton(INotebookExecutionStateService, NotebookExecutionStateService, InstantiationType.Delayed);
registerSingleton(INotebookRendererMessagingService, NotebookRendererMessagingService, InstantiationType.Delayed);
registerSingleton(INotebookKeymapService, NotebookKeymapService, InstantiationType.Delayed);
registerSingleton(INotebookLoggingService, NotebookLoggingService, InstantiationType.Delayed);
registerSingleton(INotebookCellOutlineDataSourceFactory, NotebookCellOutlineDataSourceFactory, InstantiationType.Delayed);
registerSingleton(INotebookOutlineEntryFactory, NotebookOutlineEntryFactory, InstantiationType.Delayed);
const schemas = {};
function isConfigurationPropertySchema(x) {
  return typeof x.type !== "undefined" || typeof x.anyOf !== "undefined";
}
for (const editorOption of editorOptionsRegistry) {
  const schema = editorOption.schema;
  if (schema) {
    if (isConfigurationPropertySchema(schema)) {
      schemas[`editor.${editorOption.name}`] = schema;
    } else {
      for (const key in schema) {
        if (Object.hasOwnProperty.call(schema, key)) {
          schemas[key] = schema[key];
        }
      }
    }
  }
}
const editorOptionsCustomizationSchema = {
  description: nls.localize("notebook.editorOptions.experimentalCustomization", "Settings for code editors used in notebooks. This can be used to customize most editor.* settings."),
  default: {},
  allOf: [
    {
      properties: schemas
    }
    // , {
    // 	patternProperties: {
    // 		'^\\[.*\\]$': {
    // 			type: 'object',
    // 			default: {},
    // 			properties: schemas
    // 		}
    // 	}
    // }
  ],
  tags: ["notebookLayout"]
};
const configurationRegistry = Registry.as(Extensions.Configuration);
configurationRegistry.registerConfiguration({
  id: "notebook",
  order: 100,
  title: nls.localize("notebookConfigurationTitle", "Notebook"),
  type: "object",
  properties: {
    [NotebookSetting.displayOrder]: {
      description: nls.localize("notebook.displayOrder.description", "Priority list for output mime types"),
      type: "array",
      items: {
        type: "string"
      },
      default: []
    },
    [NotebookSetting.cellToolbarLocation]: {
      description: nls.localize("notebook.cellToolbarLocation.description", "Where the cell toolbar should be shown, or whether it should be hidden."),
      type: "object",
      additionalProperties: {
        markdownDescription: nls.localize("notebook.cellToolbarLocation.viewType", "Configure the cell toolbar position for for specific file types"),
        type: "string",
        enum: ["left", "right", "hidden"]
      },
      default: {
        "default": "right"
      },
      tags: ["notebookLayout"]
    },
    [NotebookSetting.showCellStatusBar]: {
      description: nls.localize("notebook.showCellStatusbar.description", "Whether the cell status bar should be shown."),
      type: "string",
      enum: ["hidden", "visible", "visibleAfterExecute"],
      enumDescriptions: [
        nls.localize("notebook.showCellStatusbar.hidden.description", "The cell Status bar is always hidden."),
        nls.localize("notebook.showCellStatusbar.visible.description", "The cell Status bar is always visible."),
        nls.localize("notebook.showCellStatusbar.visibleAfterExecute.description", "The cell Status bar is hidden until the cell has executed. Then it becomes visible to show the execution status.")
      ],
      default: "visible",
      tags: ["notebookLayout"]
    },
    [NotebookSetting.cellExecutionTimeVerbosity]: {
      description: nls.localize("notebook.cellExecutionTimeVerbosity.description", "Controls the verbosity of the cell execution time in the cell status bar."),
      type: "string",
      enum: ["default", "verbose"],
      enumDescriptions: [
        nls.localize("notebook.cellExecutionTimeVerbosity.default.description", "The cell execution duration is visible, with advanced information in the hover tooltip."),
        nls.localize("notebook.cellExecutionTimeVerbosity.verbose.description", "The cell last execution timestamp and duration are visible, with advanced information in the hover tooltip.")
      ],
      default: "default",
      tags: ["notebookLayout"]
    },
    [NotebookSetting.textDiffEditorPreview]: {
      description: nls.localize("notebook.diff.enablePreview.description", "Whether to use the enhanced text diff editor for notebook."),
      type: "boolean",
      default: true,
      tags: ["notebookLayout"]
    },
    [NotebookSetting.diffOverviewRuler]: {
      description: nls.localize("notebook.diff.enableOverviewRuler.description", "Whether to render the overview ruler in the diff editor for notebook."),
      type: "boolean",
      default: false,
      tags: ["notebookLayout"]
    },
    [NotebookSetting.cellToolbarVisibility]: {
      markdownDescription: nls.localize("notebook.cellToolbarVisibility.description", "Whether the cell toolbar should appear on hover or click."),
      type: "string",
      enum: ["hover", "click"],
      default: "click",
      tags: ["notebookLayout"]
    },
    [NotebookSetting.undoRedoPerCell]: {
      description: nls.localize("notebook.undoRedoPerCell.description", "Whether to use separate undo/redo stack for each cell."),
      type: "boolean",
      default: true,
      tags: ["notebookLayout"]
    },
    [NotebookSetting.compactView]: {
      description: nls.localize("notebook.compactView.description", "Control whether the notebook editor should be rendered in a compact form. For example, when turned on, it will decrease the left margin width."),
      type: "boolean",
      default: true,
      tags: ["notebookLayout"]
    },
    [NotebookSetting.focusIndicator]: {
      description: nls.localize("notebook.focusIndicator.description", "Controls where the focus indicator is rendered, either along the cell borders or on the left gutter."),
      type: "string",
      enum: ["border", "gutter"],
      default: "gutter",
      tags: ["notebookLayout"]
    },
    [NotebookSetting.insertToolbarLocation]: {
      description: nls.localize("notebook.insertToolbarPosition.description", "Control where the insert cell actions should appear."),
      type: "string",
      enum: ["betweenCells", "notebookToolbar", "both", "hidden"],
      enumDescriptions: [
        nls.localize("insertToolbarLocation.betweenCells", "A toolbar that appears on hover between cells."),
        nls.localize("insertToolbarLocation.notebookToolbar", "The toolbar at the top of the notebook editor."),
        nls.localize("insertToolbarLocation.both", "Both toolbars."),
        nls.localize("insertToolbarLocation.hidden", "The insert actions don't appear anywhere.")
      ],
      default: "both",
      tags: ["notebookLayout"]
    },
    [NotebookSetting.globalToolbar]: {
      description: nls.localize("notebook.globalToolbar.description", "Control whether to render a global toolbar inside the notebook editor."),
      type: "boolean",
      default: true,
      tags: ["notebookLayout"]
    },
    [NotebookSetting.stickyScrollEnabled]: {
      description: nls.localize("notebook.stickyScrollEnabled.description", "Experimental. Control whether to render notebook Sticky Scroll headers in the notebook editor."),
      type: "boolean",
      default: false,
      tags: ["notebookLayout"]
    },
    [NotebookSetting.stickyScrollMode]: {
      description: nls.localize("notebook.stickyScrollMode.description", "Control whether nested sticky lines appear to stack flat or indented."),
      type: "string",
      enum: ["flat", "indented"],
      enumDescriptions: [
        nls.localize("notebook.stickyScrollMode.flat", "Nested sticky lines appear flat."),
        nls.localize("notebook.stickyScrollMode.indented", "Nested sticky lines appear indented.")
      ],
      default: "indented",
      tags: ["notebookLayout"]
    },
    [NotebookSetting.consolidatedOutputButton]: {
      description: nls.localize("notebook.consolidatedOutputButton.description", "Control whether outputs action should be rendered in the output toolbar."),
      type: "boolean",
      default: true,
      tags: ["notebookLayout"]
    },
    [NotebookSetting.showFoldingControls]: {
      description: nls.localize("notebook.showFoldingControls.description", "Controls when the Markdown header folding arrow is shown."),
      type: "string",
      enum: ["always", "never", "mouseover"],
      enumDescriptions: [
        nls.localize("showFoldingControls.always", "The folding controls are always visible."),
        nls.localize("showFoldingControls.never", "Never show the folding controls and reduce the gutter size."),
        nls.localize("showFoldingControls.mouseover", "The folding controls are visible only on mouseover.")
      ],
      default: "mouseover",
      tags: ["notebookLayout"]
    },
    [NotebookSetting.dragAndDropEnabled]: {
      description: nls.localize("notebook.dragAndDrop.description", "Control whether the notebook editor should allow moving cells through drag and drop."),
      type: "boolean",
      default: true,
      tags: ["notebookLayout"]
    },
    [NotebookSetting.consolidatedRunButton]: {
      description: nls.localize("notebook.consolidatedRunButton.description", "Control whether extra actions are shown in a dropdown next to the run button."),
      type: "boolean",
      default: false,
      tags: ["notebookLayout"]
    },
    [NotebookSetting.globalToolbarShowLabel]: {
      description: nls.localize("notebook.globalToolbarShowLabel", "Control whether the actions on the notebook toolbar should render label or not."),
      type: "string",
      enum: ["always", "never", "dynamic"],
      default: "always",
      tags: ["notebookLayout"]
    },
    [NotebookSetting.textOutputLineLimit]: {
      markdownDescription: nls.localize("notebook.textOutputLineLimit", "Controls how many lines of text are displayed in a text output. If {0} is enabled, this setting is used to determine the scroll height of the output.", "`#notebook.output.scrolling#`"),
      type: "number",
      default: 30,
      tags: ["notebookLayout", "notebookOutputLayout"],
      minimum: 1
    },
    [NotebookSetting.LinkifyOutputFilePaths]: {
      description: nls.localize("notebook.disableOutputFilePathLinks", "Control whether to disable filepath links in the output of notebook cells."),
      type: "boolean",
      default: true,
      tags: ["notebookOutputLayout"]
    },
    [NotebookSetting.minimalErrorRendering]: {
      description: nls.localize("notebook.minimalErrorRendering", "Control whether to render error output in a minimal style."),
      type: "boolean",
      default: false,
      tags: ["notebookOutputLayout"]
    },
    [NotebookSetting.markupFontSize]: {
      markdownDescription: nls.localize("notebook.markup.fontSize", "Controls the font size in pixels of rendered markup in notebooks. When set to {0}, 120% of {1} is used.", "`0`", "`#editor.fontSize#`"),
      type: "number",
      default: 0,
      tags: ["notebookLayout"]
    },
    [NotebookSetting.markdownLineHeight]: {
      markdownDescription: nls.localize("notebook.markdown.lineHeight", "Controls the line height in pixels of markdown cells in notebooks. When set to {0}, {1} will be used", "`0`", "`normal`"),
      type: "number",
      default: 0,
      tags: ["notebookLayout"]
    },
    [NotebookSetting.cellEditorOptionsCustomizations]: editorOptionsCustomizationSchema,
    [NotebookSetting.interactiveWindowCollapseCodeCells]: {
      markdownDescription: nls.localize("notebook.interactiveWindow.collapseCodeCells", "Controls whether code cells in the interactive window are collapsed by default."),
      type: "string",
      enum: ["always", "never", "fromEditor"],
      default: "fromEditor"
    },
    [NotebookSetting.outputLineHeight]: {
      markdownDescription: nls.localize("notebook.outputLineHeight", "Line height of the output text within notebook cells.\n - When set to 0, editor line height is used.\n - Values between 0 and 8 will be used as a multiplier with the font size.\n - Values greater than or equal to 8 will be used as effective values."),
      type: "number",
      default: 0,
      tags: ["notebookLayout", "notebookOutputLayout"]
    },
    [NotebookSetting.outputFontSize]: {
      markdownDescription: nls.localize("notebook.outputFontSize", "Font size for the output text within notebook cells. When set to 0, {0} is used.", "`#editor.fontSize#`"),
      type: "number",
      default: 0,
      tags: ["notebookLayout", "notebookOutputLayout"]
    },
    [NotebookSetting.outputFontFamily]: {
      markdownDescription: nls.localize("notebook.outputFontFamily", "The font family of the output text within notebook cells. When set to empty, the {0} is used.", "`#editor.fontFamily#`"),
      type: "string",
      tags: ["notebookLayout", "notebookOutputLayout"]
    },
    [NotebookSetting.outputScrolling]: {
      markdownDescription: nls.localize("notebook.outputScrolling", "Initially render notebook outputs in a scrollable region when longer than the limit."),
      type: "boolean",
      tags: ["notebookLayout", "notebookOutputLayout"],
      default: typeof product.quality === "string" && product.quality !== "stable"
      // only enable as default in insiders
    },
    [NotebookSetting.outputWordWrap]: {
      markdownDescription: nls.localize("notebook.outputWordWrap", "Controls whether the lines in output should wrap."),
      type: "boolean",
      tags: ["notebookLayout", "notebookOutputLayout"],
      default: false
    },
    [NotebookSetting.defaultFormatter]: {
      description: nls.localize("notebookFormatter.default", "Defines a default notebook formatter which takes precedence over all other formatter settings. Must be the identifier of an extension contributing a formatter."),
      type: ["string", "null"],
      default: null,
      enum: DefaultFormatter.extensionIds,
      enumItemLabels: DefaultFormatter.extensionItemLabels,
      markdownEnumDescriptions: DefaultFormatter.extensionDescriptions
    },
    [NotebookSetting.formatOnSave]: {
      markdownDescription: nls.localize("notebook.formatOnSave", "Format a notebook on save. A formatter must be available and the editor must not be shutting down. When {0} is set to `afterDelay`, the file will only be formatted when saved explicitly.", "`#files.autoSave#`"),
      type: "boolean",
      tags: ["notebookLayout"],
      default: false
    },
    [NotebookSetting.insertFinalNewline]: {
      markdownDescription: nls.localize("notebook.insertFinalNewline", "When enabled, insert a final new line into the end of code cells when saving a notebook."),
      type: "boolean",
      tags: ["notebookLayout"],
      default: false
    },
    [NotebookSetting.formatOnCellExecution]: {
      markdownDescription: nls.localize("notebook.formatOnCellExecution", "Format a notebook cell upon execution. A formatter must be available."),
      type: "boolean",
      default: false
    },
    [NotebookSetting.confirmDeleteRunningCell]: {
      markdownDescription: nls.localize("notebook.confirmDeleteRunningCell", "Control whether a confirmation prompt is required to delete a running cell."),
      type: "boolean",
      default: true
    },
    [NotebookSetting.findFilters]: {
      markdownDescription: nls.localize("notebook.findFilters", "Customize the Find Widget behavior for searching within notebook cells. When both markup source and markup preview are enabled, the Find Widget will search either the source code or preview based on the current state of the cell."),
      type: "object",
      properties: {
        markupSource: {
          type: "boolean",
          default: true
        },
        markupPreview: {
          type: "boolean",
          default: true
        },
        codeSource: {
          type: "boolean",
          default: true
        },
        codeOutput: {
          type: "boolean",
          default: true
        }
      },
      default: {
        markupSource: true,
        markupPreview: true,
        codeSource: true,
        codeOutput: true
      },
      tags: ["notebookLayout"]
    },
    [NotebookSetting.remoteSaving]: {
      markdownDescription: nls.localize("notebook.remoteSaving", "Enables the incremental saving of notebooks between processes and across Remote connections. When enabled, only the changes to the notebook are sent to the extension host, improving performance for large notebooks and slow network connections."),
      type: "boolean",
      default: typeof product.quality === "string" && product.quality !== "stable",
      // only enable as default in insiders
      tags: ["experimental"]
    },
    [NotebookSetting.scrollToRevealCell]: {
      markdownDescription: nls.localize("notebook.scrolling.revealNextCellOnExecute.description", "How far to scroll when revealing the next cell upon running {0}.", "notebook.cell.executeAndSelectBelow"),
      type: "string",
      enum: ["fullCell", "firstLine", "none"],
      markdownEnumDescriptions: [
        nls.localize("notebook.scrolling.revealNextCellOnExecute.fullCell.description", "Scroll to fully reveal the next cell."),
        nls.localize("notebook.scrolling.revealNextCellOnExecute.firstLine.description", "Scroll to reveal the first line of the next cell."),
        nls.localize("notebook.scrolling.revealNextCellOnExecute.none.description", "Do not scroll.")
      ],
      default: "fullCell"
    },
    [NotebookSetting.cellGenerate]: {
      markdownDescription: nls.localize("notebook.cellGenerate", "Enable experimental generate action to create code cell with inline chat enabled."),
      type: "boolean",
      default: true
    },
    [NotebookSetting.notebookVariablesView]: {
      markdownDescription: nls.localize("notebook.VariablesView.description", "Enable the experimental notebook variables view within the debug panel."),
      type: "boolean",
      default: false
    },
    [NotebookSetting.notebookInlineValues]: {
      markdownDescription: nls.localize("notebook.inlineValues.description", "Control whether to show inline values within notebook code cells after cell execution. Values will remain until the cell is edited, re-executed, or explicitly cleared via the Clear All Outputs toolbar button or the `Notebook: Clear Inline Values` command."),
      type: "string",
      enum: ["on", "auto", "off"],
      enumDescriptions: [
        nls.localize("notebook.inlineValues.on", "Always show inline values, with a regex fallback if no inline value provider is registered. Note: There may be a performance impact in larger cells if the fallback is used."),
        nls.localize("notebook.inlineValues.auto", "Show inline values only when an inline value provider is registered."),
        nls.localize("notebook.inlineValues.off", "Never show inline values.")
      ],
      default: "off"
    },
    [NotebookSetting.cellFailureDiagnostics]: {
      markdownDescription: nls.localize("notebook.cellFailureDiagnostics", "Show available diagnostics for cell failures."),
      type: "boolean",
      default: true
    },
    [NotebookSetting.outputBackupSizeLimit]: {
      markdownDescription: nls.localize("notebook.backup.sizeLimit", "The limit of notebook output size in kilobytes (KB) where notebook files will no longer be backed up for hot reload. Use 0 for unlimited."),
      type: "number",
      default: 1e4
    },
    [NotebookSetting.multiCursor]: {
      markdownDescription: nls.localize("notebook.multiCursor.enabled", "Experimental. Enables a limited set of multi cursor controls across multiple cells in the notebook editor. Currently supported are core editor actions (typing/cut/copy/paste/composition) and a limited subset of editor commands."),
      type: "boolean",
      default: false
    },
    [NotebookSetting.markupFontFamily]: {
      markdownDescription: nls.localize("notebook.markup.fontFamily", "Controls the font family of rendered markup in notebooks. When left blank, this will fall back to the default workbench font family."),
      type: "string",
      default: "",
      tags: ["notebookLayout"]
    }
  }
});
export {
  NotebookContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL25vdGVib29rLmNvbnRyaWJ1dGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlLCBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIGRpc3Bvc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgcGFyc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZy5qcyc7XG5pbXBvcnQgeyBleHRuYW1lLCBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGFzc2VydFR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgdG9Gb3JtYXR0ZWRTdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uRm9ybWF0dGVyLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwsIElUZXh0QnVmZmVyRmFjdG9yeSwgRGVmYXVsdEVuZE9mTGluZSwgSVRleHRCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlbGVjdGlvbiwgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIsIElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zLCBJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hLCBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgRWRpdG9yUGFuZURlc2NyaXB0b3IsIElFZGl0b3JQYW5lUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zIGFzIFdvcmtiZW5jaEV4dGVuc2lvbnMsIElXb3JrYmVuY2hDb250cmlidXRpb24sIElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnksIFdvcmtiZW5jaFBoYXNlLCByZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VyaWFsaXplciwgSUVkaXRvckZhY3RvcnlSZWdpc3RyeSwgRWRpdG9yRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IE5vdGVib29rRWRpdG9yIH0gZnJvbSAnLi9ub3RlYm9va0VkaXRvci5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0VkaXRvcklucHV0LCBOb3RlYm9va0VkaXRvcklucHV0T3B0aW9ucyB9IGZyb20gJy4uL2NvbW1vbi9ub3RlYm9va0VkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IElOb3RlYm9va1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vbm90ZWJvb2tTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE5vdGVib29rU2VydmljZSB9IGZyb20gJy4vc2VydmljZXMvbm90ZWJvb2tTZXJ2aWNlSW1wbC5qcyc7XG5pbXBvcnQgeyBDZWxsS2luZCwgQ2VsbFVyaSwgSVJlc29sdmVkTm90ZWJvb2tFZGl0b3JNb2RlbCwgTm90ZWJvb2tXb3JraW5nQ29weVR5cGVJZGVudGlmaWVyLCBOb3RlYm9va1NldHRpbmcsIElDZWxsT3V0cHV0LCBJQ2VsbCwgTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUsIE5vdGVib29rTWV0YWRhdGFVcmkgfSBmcm9tICcuLi9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVuZG9SZWRvU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuZG9SZWRvL2NvbW1vbi91bmRvUmVkby5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tFZGl0b3JNb2RlbFJlc29sdmVyU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9ub3RlYm9va0VkaXRvck1vZGVsUmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE5vdGVib29rRGlmZkVkaXRvcklucHV0IH0gZnJvbSAnLi4vY29tbW9uL25vdGVib29rRGlmZkVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IE5vdGVib29rVGV4dERpZmZFZGl0b3IgfSBmcm9tICcuL2RpZmYvbm90ZWJvb2tEaWZmRWRpdG9yLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0VkaXRvcldvcmtlclNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vc2VydmljZXMvbm90ZWJvb2tXb3JrZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE5vdGVib29rRWRpdG9yV29ya2VyU2VydmljZUltcGwgfSBmcm9tICcuL3NlcnZpY2VzL25vdGVib29rV29ya2VyU2VydmljZUltcGwuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rQ2VsbFN0YXR1c0JhclNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vbm90ZWJvb2tDZWxsU3RhdHVzQmFyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0NlbGxTdGF0dXNCYXJTZXJ2aWNlIH0gZnJvbSAnLi9zZXJ2aWNlcy9ub3RlYm9va0NlbGxTdGF0dXNCYXJTZXJ2aWNlSW1wbC5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi9zZXJ2aWNlcy9ub3RlYm9va0VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tFZGl0b3JXaWRnZXRTZXJ2aWNlIH0gZnJvbSAnLi9zZXJ2aWNlcy9ub3RlYm9va0VkaXRvclNlcnZpY2VJbXBsLmpzJztcbmltcG9ydCB7IElKU09OQ29udHJpYnV0aW9uUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgSlNPTkV4dGVuc2lvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9qc29uc2NoZW1hcy9jb21tb24vanNvbkNvbnRyaWJ1dGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElKU09OU2NoZW1hLCBJSlNPTlNjaGVtYU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBnZXRGb3JtYXR0ZWRPdXRwdXRKU09OLCBnZXRTdHJlYW1PdXRwdXREYXRhIH0gZnJvbSAnLi9kaWZmL2RpZmZFbGVtZW50Vmlld01vZGVsLmpzJztcbmltcG9ydCB7IE5vdGVib29rTW9kZWxSZXNvbHZlclNlcnZpY2VJbXBsIH0gZnJvbSAnLi4vY29tbW9uL25vdGVib29rRWRpdG9yTW9kZWxSZXNvbHZlclNlcnZpY2VJbXBsLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0tlcm5lbEhpc3RvcnlTZXJ2aWNlLCBJTm90ZWJvb2tLZXJuZWxTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL25vdGVib29rS2VybmVsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0tlcm5lbFNlcnZpY2UgfSBmcm9tICcuL3NlcnZpY2VzL25vdGVib29rS2VybmVsU2VydmljZUltcGwuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5SWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3dvcmtpbmdDb3B5L2NvbW1vbi93b3JraW5nQ29weS5qcyc7XG5pbXBvcnQgeyBJUmVzb3VyY2VFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHlFZGl0b3JIYW5kbGVyLCBJV29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvd29ya2luZ0NvcHkvY29tbW9uL3dvcmtpbmdDb3B5RWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgSUVkaXRvckdyb3Vwc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tSZW5kZXJlck1lc3NhZ2luZ1NlcnZpY2UgfSBmcm9tICcuL3NlcnZpY2VzL25vdGVib29rUmVuZGVyZXJNZXNzYWdpbmdTZXJ2aWNlSW1wbC5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tSZW5kZXJlck1lc3NhZ2luZ1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vbm90ZWJvb2tSZW5kZXJlck1lc3NhZ2luZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rQ2VsbE91dGxpbmVEYXRhU291cmNlRmFjdG9yeSwgTm90ZWJvb2tDZWxsT3V0bGluZURhdGFTb3VyY2VGYWN0b3J5IH0gZnJvbSAnLi92aWV3TW9kZWwvbm90ZWJvb2tPdXRsaW5lRGF0YVNvdXJjZUZhY3RvcnkuanMnO1xuXG4vLyBFZGl0b3IgQ29udHJvbGxlclxuaW1wb3J0ICcuL2NvbnRyb2xsZXIvY29yZUFjdGlvbnMuanMnO1xuaW1wb3J0ICcuL2NvbnRyb2xsZXIvaW5zZXJ0Q2VsbEFjdGlvbnMuanMnO1xuaW1wb3J0ICcuL2NvbnRyb2xsZXIvZXhlY3V0ZUFjdGlvbnMuanMnO1xuaW1wb3J0ICcuL2NvbnRyb2xsZXIvc2VjdGlvbkFjdGlvbnMuanMnO1xuaW1wb3J0ICcuL2NvbnRyb2xsZXIvbGF5b3V0QWN0aW9ucy5qcyc7XG5pbXBvcnQgJy4vY29udHJvbGxlci9lZGl0QWN0aW9ucy5qcyc7XG5pbXBvcnQgJy4vY29udHJvbGxlci9jZWxsT3V0cHV0QWN0aW9ucy5qcyc7XG5pbXBvcnQgJy4vY29udHJvbGxlci9hcGlBY3Rpb25zLmpzJztcbmltcG9ydCAnLi9jb250cm9sbGVyL2ZvbGRpbmdDb250cm9sbGVyLmpzJztcbmltcG9ydCAnLi9jb250cm9sbGVyL2NoYXQvbm90ZWJvb2suY2hhdC5jb250cmlidXRpb24uanMnO1xuaW1wb3J0ICcuL2NvbnRyb2xsZXIvdmFyaWFibGVzQWN0aW9ucy5qcyc7XG5cbi8vIEVkaXRvciBDb250cmlidXRpb25cbmltcG9ydCAnLi9jb250cmliL2VkaXRvckhpbnQvZW1wdHlDZWxsRWRpdG9ySGludC5qcyc7XG5pbXBvcnQgJy4vY29udHJpYi9jbGlwYm9hcmQvbm90ZWJvb2tDbGlwYm9hcmQuanMnO1xuaW1wb3J0ICcuL2NvbnRyaWIvZmluZC9ub3RlYm9va0ZpbmQuanMnO1xuaW1wb3J0ICcuL2NvbnRyaWIvZm9ybWF0L2Zvcm1hdHRpbmcuanMnO1xuaW1wb3J0ICcuL2NvbnRyaWIvc2F2ZVBhcnRpY2lwYW50cy9zYXZlUGFydGljaXBhbnRzLmpzJztcbmltcG9ydCAnLi9jb250cmliL2dldHRpbmdTdGFydGVkL25vdGVib29rR2V0dGluZ1N0YXJ0ZWQuanMnO1xuaW1wb3J0ICcuL2NvbnRyaWIvbGF5b3V0L2xheW91dEFjdGlvbnMuanMnO1xuaW1wb3J0ICcuL2NvbnRyaWIvbWFya2VyL21hcmtlclByb3ZpZGVyLmpzJztcbmltcG9ydCAnLi9jb250cmliL25hdmlnYXRpb24vYXJyb3cuanMnO1xuaW1wb3J0ICcuL2NvbnRyaWIvb3V0bGluZS9ub3RlYm9va091dGxpbmUuanMnO1xuaW1wb3J0ICcuL2NvbnRyaWIvcHJvZmlsZS9ub3RlYm9va1Byb2ZpbGUuanMnO1xuaW1wb3J0ICcuL2NvbnRyaWIvY2VsbFN0YXR1c0Jhci9zdGF0dXNCYXJQcm92aWRlcnMuanMnO1xuaW1wb3J0ICcuL2NvbnRyaWIvY2VsbFN0YXR1c0Jhci9jb250cmlidXRlZFN0YXR1c0Jhckl0ZW1Db250cm9sbGVyLmpzJztcbmltcG9ydCAnLi9jb250cmliL2NlbGxTdGF0dXNCYXIvZXhlY3V0aW9uU3RhdHVzQmFySXRlbUNvbnRyb2xsZXIuanMnO1xuaW1wb3J0ICcuL2NvbnRyaWIvZWRpdG9yU3RhdHVzQmFyL2VkaXRvclN0YXR1c0Jhci5qcyc7XG5pbXBvcnQgJy4vY29udHJpYi91bmRvUmVkby9ub3RlYm9va1VuZG9SZWRvLmpzJztcbmltcG9ydCAnLi9jb250cmliL2NlbGxDb21tYW5kcy9jZWxsQ29tbWFuZHMuanMnO1xuaW1wb3J0ICcuL2NvbnRyaWIvdmlld3BvcnRXYXJtdXAvdmlld3BvcnRXYXJtdXAuanMnO1xuaW1wb3J0ICcuL2NvbnRyaWIvdHJvdWJsZXNob290L2xheW91dC5qcyc7XG5pbXBvcnQgJy4vY29udHJpYi9kZWJ1Zy9ub3RlYm9va0JyZWFrcG9pbnRzLmpzJztcbmltcG9ydCAnLi9jb250cmliL2RlYnVnL25vdGVib29rQ2VsbFBhdXNpbmcuanMnO1xuaW1wb3J0ICcuL2NvbnRyaWIvZGVidWcvbm90ZWJvb2tEZWJ1Z0RlY29yYXRpb25zLmpzJztcbmltcG9ydCAnLi9jb250cmliL2V4ZWN1dGUvZXhlY3V0aW9uRWRpdG9yUHJvZ3Jlc3MuanMnO1xuaW1wb3J0ICcuL2NvbnRyaWIva2VybmVsRGV0ZWN0aW9uL25vdGVib29rS2VybmVsRGV0ZWN0aW9uLmpzJztcbmltcG9ydCAnLi9jb250cmliL2NlbGxEaWFnbm9zdGljcy9jZWxsRGlhZ25vc3RpY3MuanMnO1xuaW1wb3J0ICcuL2NvbnRyaWIvbXVsdGljdXJzb3Ivbm90ZWJvb2tNdWx0aWN1cnNvci5qcyc7XG5pbXBvcnQgJy4vY29udHJpYi9tdWx0aWN1cnNvci9ub3RlYm9va1NlbGVjdGlvbkhpZ2hsaWdodC5qcyc7XG5pbXBvcnQgJy4vY29udHJpYi9ub3RlYm9va1ZhcmlhYmxlcy9ub3RlYm9va0lubGluZVZhcmlhYmxlcy5qcyc7XG5cbi8vIERpZmYgRWRpdG9yIENvbnRyaWJ1dGlvblxuaW1wb3J0ICcuL2RpZmYvbm90ZWJvb2tEaWZmQWN0aW9ucy5qcyc7XG5cbi8vIFNlcnZpY2VzXG5pbXBvcnQgeyBlZGl0b3JPcHRpb25zUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9lZGl0b3JPcHRpb25zLmpzJztcbmltcG9ydCB7IE5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlIH0gZnJvbSAnLi9zZXJ2aWNlcy9ub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZUltcGwuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tFeGVjdXRpb25TZXJ2aWNlIH0gZnJvbSAnLi9zZXJ2aWNlcy9ub3RlYm9va0V4ZWN1dGlvblNlcnZpY2VJbXBsLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0V4ZWN1dGlvblNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vbm90ZWJvb2tFeGVjdXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0tleW1hcFNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vbm90ZWJvb2tLZXltYXBTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE5vdGVib29rS2V5bWFwU2VydmljZSB9IGZyb20gJy4vc2VydmljZXMvbm90ZWJvb2tLZXltYXBTZXJ2aWNlSW1wbC5qcyc7XG5pbXBvcnQgeyBQTEFJTlRFWFRfTEFOR1VBR0VfSUQgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9tb2Rlc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9ub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tJbmZvIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZUZlYXR1cmVSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBDT01NRU5URURJVE9SX0RFQ09SQVRJT05fS0VZIH0gZnJvbSAnLi4vLi4vY29tbWVudHMvYnJvd3Nlci9jb21tZW50UmVwbHkuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tLZXJuZWxIaXN0b3J5U2VydmljZSB9IGZyb20gJy4vc2VydmljZXMvbm90ZWJvb2tLZXJuZWxIaXN0b3J5U2VydmljZUltcGwuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rTG9nZ2luZ1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vbm90ZWJvb2tMb2dnaW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0xvZ2dpbmdTZXJ2aWNlIH0gZnJvbSAnLi9zZXJ2aWNlcy9ub3RlYm9va0xvZ2dpbmdTZXJ2aWNlSW1wbC5qcyc7XG5pbXBvcnQgcHJvZHVjdCBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0LmpzJztcbmltcG9ydCB7IE5vdGVib29rVmFyaWFibGVzIH0gZnJvbSAnLi9jb250cmliL25vdGVib29rVmFyaWFibGVzL25vdGVib29rVmFyaWFibGVzLmpzJztcbmltcG9ydCB7IEFjY2Vzc2libGVWaWV3UmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJsZVZpZXdSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0FjY2Vzc2liaWxpdHlIZWxwIH0gZnJvbSAnLi9ub3RlYm9va0FjY2Vzc2liaWxpdHlIZWxwLmpzJztcbmltcG9ydCB7IE5vdGVib29rQWNjZXNzaWJsZVZpZXcgfSBmcm9tICcuL25vdGVib29rQWNjZXNzaWJsZVZpZXcuanMnO1xuaW1wb3J0IHsgRGVmYXVsdEZvcm1hdHRlciB9IGZyb20gJy4uLy4uL2Zvcm1hdC9icm93c2VyL2Zvcm1hdEFjdGlvbnNNdWx0aXBsZS5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va011bHRpVGV4dERpZmZFZGl0b3IgfSBmcm9tICcuL2RpZmYvbm90ZWJvb2tNdWx0aURpZmZFZGl0b3IuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tNdWx0aURpZmZFZGl0b3JJbnB1dCB9IGZyb20gJy4vZGlmZi9ub3RlYm9va011bHRpRGlmZkVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IGdldEZvcm1hdHRlZE1ldGFkYXRhSlNPTiB9IGZyb20gJy4uL2NvbW1vbi9tb2RlbC9ub3RlYm9va0NlbGxUZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rT3V0bGluZUVudHJ5RmFjdG9yeSwgTm90ZWJvb2tPdXRsaW5lRW50cnlGYWN0b3J5IH0gZnJvbSAnLi92aWV3TW9kZWwvbm90ZWJvb2tPdXRsaW5lRW50cnlGYWN0b3J5LmpzJztcbmltcG9ydCB7IGdldEZvcm1hdHRlZE5vdGVib29rTWV0YWRhdGFKU09OIH0gZnJvbSAnLi4vY29tbW9uL21vZGVsL25vdGVib29rTWV0YWRhdGFUZXh0TW9kZWwuanMnO1xuXG4vKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xuXG5SZWdpc3RyeS5hczxJRWRpdG9yUGFuZVJlZ2lzdHJ5PihFZGl0b3JFeHRlbnNpb25zLkVkaXRvclBhbmUpLnJlZ2lzdGVyRWRpdG9yUGFuZShcblx0RWRpdG9yUGFuZURlc2NyaXB0b3IuY3JlYXRlKFxuXHRcdE5vdGVib29rRWRpdG9yLFxuXHRcdE5vdGVib29rRWRpdG9yLklELFxuXHRcdCdOb3RlYm9vayBFZGl0b3InXG5cdCksXG5cdFtcblx0XHRuZXcgU3luY0Rlc2NyaXB0b3IoTm90ZWJvb2tFZGl0b3JJbnB1dClcblx0XVxuKTtcblxuUmVnaXN0cnkuYXM8SUVkaXRvclBhbmVSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JQYW5lKS5yZWdpc3RlckVkaXRvclBhbmUoXG5cdEVkaXRvclBhbmVEZXNjcmlwdG9yLmNyZWF0ZShcblx0XHROb3RlYm9va1RleHREaWZmRWRpdG9yLFxuXHRcdE5vdGVib29rVGV4dERpZmZFZGl0b3IuSUQsXG5cdFx0J05vdGVib29rIERpZmYgRWRpdG9yJ1xuXHQpLFxuXHRbXG5cdFx0bmV3IFN5bmNEZXNjcmlwdG9yKE5vdGVib29rRGlmZkVkaXRvcklucHV0KVxuXHRdXG4pO1xuXG5SZWdpc3RyeS5hczxJRWRpdG9yUGFuZVJlZ2lzdHJ5PihFZGl0b3JFeHRlbnNpb25zLkVkaXRvclBhbmUpLnJlZ2lzdGVyRWRpdG9yUGFuZShcblx0RWRpdG9yUGFuZURlc2NyaXB0b3IuY3JlYXRlKFxuXHRcdE5vdGVib29rTXVsdGlUZXh0RGlmZkVkaXRvcixcblx0XHROb3RlYm9va011bHRpVGV4dERpZmZFZGl0b3IuSUQsXG5cdFx0J05vdGVib29rIERpZmYgRWRpdG9yJ1xuXHQpLFxuXHRbXG5cdFx0bmV3IFN5bmNEZXNjcmlwdG9yKE5vdGVib29rTXVsdGlEaWZmRWRpdG9ySW5wdXQpXG5cdF1cbik7XG5cbmNsYXNzIE5vdGVib29rRGlmZkVkaXRvclNlcmlhbGl6ZXIgaW1wbGVtZW50cyBJRWRpdG9yU2VyaWFsaXplciB7XG5cdGNvbnN0cnVjdG9yKEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSkgeyB9XG5cdGNhblNlcmlhbGl6ZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHNlcmlhbGl6ZShpbnB1dDogRWRpdG9ySW5wdXQpOiBzdHJpbmcge1xuXHRcdGFzc2VydFR5cGUoaW5wdXQgaW5zdGFuY2VvZiBOb3RlYm9va0RpZmZFZGl0b3JJbnB1dCk7XG5cdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdHJlc291cmNlOiBpbnB1dC5yZXNvdXJjZSxcblx0XHRcdG9yaWdpbmFsUmVzb3VyY2U6IGlucHV0Lm9yaWdpbmFsLnJlc291cmNlLFxuXHRcdFx0bmFtZTogaW5wdXQuZ2V0TmFtZSgpLFxuXHRcdFx0b3JpZ2luYWxOYW1lOiBpbnB1dC5vcmlnaW5hbC5nZXROYW1lKCksXG5cdFx0XHR0ZXh0RGlmZk5hbWU6IGlucHV0LmdldE5hbWUoKSxcblx0XHRcdHZpZXdUeXBlOiBpbnB1dC52aWV3VHlwZSxcblx0XHR9KTtcblx0fVxuXG5cdGRlc2VyaWFsaXplKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsIHJhdzogc3RyaW5nKSB7XG5cdFx0dHlwZSBEYXRhID0geyByZXNvdXJjZTogVVJJOyBvcmlnaW5hbFJlc291cmNlOiBVUkk7IG5hbWU6IHN0cmluZzsgb3JpZ2luYWxOYW1lOiBzdHJpbmc7IHZpZXdUeXBlOiBzdHJpbmc7IHRleHREaWZmTmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkOyBncm91cDogbnVtYmVyIH07XG5cdFx0Y29uc3QgZGF0YSA9IDxEYXRhPnBhcnNlKHJhdyk7XG5cdFx0aWYgKCFkYXRhKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCB7IHJlc291cmNlLCBvcmlnaW5hbFJlc291cmNlLCBuYW1lLCB2aWV3VHlwZSB9ID0gZGF0YTtcblx0XHRpZiAoIWRhdGEgfHwgIVVSSS5pc1VyaShyZXNvdXJjZSkgfHwgIVVSSS5pc1VyaShvcmlnaW5hbFJlc291cmNlKSB8fCB0eXBlb2YgbmFtZSAhPT0gJ3N0cmluZycgfHwgdHlwZW9mIHZpZXdUeXBlICE9PSAnc3RyaW5nJykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ25vdGVib29rLmV4cGVyaW1lbnRhbC5lbmFibGVOZXdEaWZmRWRpdG9yJykpIHtcblx0XHRcdHJldHVybiBOb3RlYm9va011bHRpRGlmZkVkaXRvcklucHV0LmNyZWF0ZShpbnN0YW50aWF0aW9uU2VydmljZSwgcmVzb3VyY2UsIG5hbWUsIHVuZGVmaW5lZCwgb3JpZ2luYWxSZXNvdXJjZSwgdmlld1R5cGUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gTm90ZWJvb2tEaWZmRWRpdG9ySW5wdXQuY3JlYXRlKGluc3RhbnRpYXRpb25TZXJ2aWNlLCByZXNvdXJjZSwgbmFtZSwgdW5kZWZpbmVkLCBvcmlnaW5hbFJlc291cmNlLCB2aWV3VHlwZSk7XG5cdFx0fVxuXHR9XG5cblx0c3RhdGljIGNhblJlc29sdmVCYWNrdXAoZWRpdG9ySW5wdXQ6IEVkaXRvcklucHV0LCBiYWNrdXBSZXNvdXJjZTogVVJJKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cbn1cbnR5cGUgU2VyaWFsaXplZE5vdGVib29rRWRpdG9yRGF0YSA9IHsgcmVzb3VyY2U6IFVSSTsgcHJlZmVycmVkUmVzb3VyY2U6IFVSSTsgdmlld1R5cGU6IHN0cmluZzsgb3B0aW9ucz86IE5vdGVib29rRWRpdG9ySW5wdXRPcHRpb25zIH07XG5jbGFzcyBOb3RlYm9va0VkaXRvclNlcmlhbGl6ZXIgaW1wbGVtZW50cyBJRWRpdG9yU2VyaWFsaXplciB7XG5cdGNhblNlcmlhbGl6ZShpbnB1dDogRWRpdG9ySW5wdXQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gaW5wdXQudHlwZUlkID09PSBOb3RlYm9va0VkaXRvcklucHV0LklEO1xuXHR9XG5cdHNlcmlhbGl6ZShpbnB1dDogRWRpdG9ySW5wdXQpOiBzdHJpbmcge1xuXHRcdGFzc2VydFR5cGUoaW5wdXQgaW5zdGFuY2VvZiBOb3RlYm9va0VkaXRvcklucHV0KTtcblx0XHRjb25zdCBkYXRhOiBTZXJpYWxpemVkTm90ZWJvb2tFZGl0b3JEYXRhID0ge1xuXHRcdFx0cmVzb3VyY2U6IGlucHV0LnJlc291cmNlLFxuXHRcdFx0cHJlZmVycmVkUmVzb3VyY2U6IGlucHV0LnByZWZlcnJlZFJlc291cmNlLFxuXHRcdFx0dmlld1R5cGU6IGlucHV0LnZpZXdUeXBlLFxuXHRcdFx0b3B0aW9uczogaW5wdXQub3B0aW9uc1xuXHRcdH07XG5cdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KGRhdGEpO1xuXHR9XG5cdGRlc2VyaWFsaXplKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsIHJhdzogc3RyaW5nKSB7XG5cdFx0Y29uc3QgZGF0YSA9IDxTZXJpYWxpemVkTm90ZWJvb2tFZGl0b3JEYXRhPnBhcnNlKHJhdyk7XG5cdFx0aWYgKCFkYXRhKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCB7IHJlc291cmNlLCBwcmVmZXJyZWRSZXNvdXJjZSwgdmlld1R5cGUsIG9wdGlvbnMgfSA9IGRhdGE7XG5cdFx0aWYgKCFkYXRhIHx8ICFVUkkuaXNVcmkocmVzb3VyY2UpIHx8IHR5cGVvZiB2aWV3VHlwZSAhPT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5wdXQgPSBOb3RlYm9va0VkaXRvcklucHV0LmdldE9yQ3JlYXRlKGluc3RhbnRpYXRpb25TZXJ2aWNlLCByZXNvdXJjZSwgcHJlZmVycmVkUmVzb3VyY2UsIHZpZXdUeXBlLCBvcHRpb25zKTtcblx0XHRyZXR1cm4gaW5wdXQ7XG5cdH1cbn1cblxuUmVnaXN0cnkuYXM8SUVkaXRvckZhY3RvcnlSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JGYWN0b3J5KS5yZWdpc3RlckVkaXRvclNlcmlhbGl6ZXIoXG5cdE5vdGVib29rRWRpdG9ySW5wdXQuSUQsXG5cdE5vdGVib29rRWRpdG9yU2VyaWFsaXplclxuKTtcblxuUmVnaXN0cnkuYXM8SUVkaXRvckZhY3RvcnlSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JGYWN0b3J5KS5yZWdpc3RlckVkaXRvclNlcmlhbGl6ZXIoXG5cdE5vdGVib29rRGlmZkVkaXRvcklucHV0LklELFxuXHROb3RlYm9va0RpZmZFZGl0b3JTZXJpYWxpemVyXG4pO1xuXG5leHBvcnQgY2xhc3MgTm90ZWJvb2tDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLm5vdGVib29rJztcblxuXHRwcml2YXRlIF91cmlDb21wYXJpc29uS2V5Q29tcHV0ZXI/OiBJRGlzcG9zYWJsZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVVuZG9SZWRvU2VydmljZSB1bmRvUmVkb1NlcnZpY2U6IElVbmRvUmVkb1NlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb2RlRWRpdG9yU2VydmljZTogSUNvZGVFZGl0b3JTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy51cGRhdGVDZWxsVW5kb1JlZG9Db21wYXJpc29uS2V5KGNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB1bmRvUmVkb1NlcnZpY2UpO1xuXG5cdFx0Ly8gV2F0Y2ggZm9yIGNoYW5nZXMgdG8gdW5kb1JlZG9QZXJDZWxsIHNldHRpbmdcblx0XHR0aGlzLl9yZWdpc3Rlcihjb25maWd1cmF0aW9uU2VydmljZS5vbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oZSA9PiB7XG5cdFx0XHRpZiAoZS5hZmZlY3RzQ29uZmlndXJhdGlvbihOb3RlYm9va1NldHRpbmcudW5kb1JlZG9QZXJDZWxsKSkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUNlbGxVbmRvUmVkb0NvbXBhcmlzb25LZXkoY29uZmlndXJhdGlvblNlcnZpY2UsIHVuZG9SZWRvU2VydmljZSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gcmVnaXN0ZXIgY29tbWVudCBkZWNvcmF0aW9uXG5cdFx0dGhpcy5jb2RlRWRpdG9yU2VydmljZS5yZWdpc3RlckRlY29yYXRpb25UeXBlKCdjb21tZW50LWNvbnRyb2xsZXInLCBDT01NRU5URURJVE9SX0RFQ09SQVRJT05fS0VZLCB7fSk7XG5cdH1cblxuXHQvLyBBZGQgb3IgcmVtb3ZlIHRoZSBjZWxsIHVuZG8gcmVkbyBjb21wYXJpc29uIGtleSBiYXNlZCBvbiB0aGUgdXNlciBzZXR0aW5nXG5cdHByaXZhdGUgdXBkYXRlQ2VsbFVuZG9SZWRvQ29tcGFyaXNvbktleShjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCB1bmRvUmVkb1NlcnZpY2U6IElVbmRvUmVkb1NlcnZpY2UpIHtcblx0XHRjb25zdCB1bmRvUmVkb1BlckNlbGwgPSBjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPihOb3RlYm9va1NldHRpbmcudW5kb1JlZG9QZXJDZWxsKTtcblxuXHRcdGlmICghdW5kb1JlZG9QZXJDZWxsKSB7XG5cdFx0XHQvLyBBZGQgY29tcGFyaXNvbiBrZXkgdG8gbWFwIGNlbGwgPT4gbWFpbiBkb2N1bWVudFxuXHRcdFx0aWYgKCF0aGlzLl91cmlDb21wYXJpc29uS2V5Q29tcHV0ZXIpIHtcblx0XHRcdFx0dGhpcy5fdXJpQ29tcGFyaXNvbktleUNvbXB1dGVyID0gdW5kb1JlZG9TZXJ2aWNlLnJlZ2lzdGVyVXJpQ29tcGFyaXNvbktleUNvbXB1dGVyKENlbGxVcmkuc2NoZW1lLCB7XG5cdFx0XHRcdFx0Z2V0Q29tcGFyaXNvbktleTogKHVyaTogVVJJKTogc3RyaW5nID0+IHtcblx0XHRcdFx0XHRcdGlmICh1bmRvUmVkb1BlckNlbGwpIHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHVyaS50b1N0cmluZygpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cmV0dXJuIE5vdGVib29rQ29udHJpYnV0aW9uLl9nZXRDZWxsVW5kb1JlZG9Db21wYXJpc29uS2V5KHVyaSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gRGlzcG9zZSBjb21wYXJpc29uIGtleVxuXHRcdFx0dGhpcy5fdXJpQ29tcGFyaXNvbktleUNvbXB1dGVyPy5kaXNwb3NlKCk7XG5cdFx0XHR0aGlzLl91cmlDb21wYXJpc29uS2V5Q29tcHV0ZXIgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2dldENlbGxVbmRvUmVkb0NvbXBhcmlzb25LZXkodXJpOiBVUkkpIHtcblx0XHRjb25zdCBkYXRhID0gQ2VsbFVyaS5wYXJzZSh1cmkpO1xuXHRcdGlmICghZGF0YSkge1xuXHRcdFx0cmV0dXJuIHVyaS50b1N0cmluZygpO1xuXHRcdH1cblxuXHRcdHJldHVybiBkYXRhLm5vdGVib29rLnRvU3RyaW5nKCk7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl91cmlDb21wYXJpc29uS2V5Q29tcHV0ZXI/LmRpc3Bvc2UoKTtcblx0fVxufVxuXG5jbGFzcyBDZWxsQ29udGVudFByb3ZpZGVyIGltcGxlbWVudHMgSVRleHRNb2RlbENvbnRlbnRQcm92aWRlciB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLmNlbGxDb250ZW50UHJvdmlkZXInO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3JlZ2lzdHJhdGlvbjogSURpc3Bvc2FibGU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElUZXh0TW9kZWxTZXJ2aWNlIHRleHRNb2RlbFNlcnZpY2U6IElUZXh0TW9kZWxTZXJ2aWNlLFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX21vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElOb3RlYm9va0VkaXRvck1vZGVsUmVzb2x2ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rTW9kZWxSZXNvbHZlclNlcnZpY2U6IElOb3RlYm9va0VkaXRvck1vZGVsUmVzb2x2ZXJTZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLl9yZWdpc3RyYXRpb24gPSB0ZXh0TW9kZWxTZXJ2aWNlLnJlZ2lzdGVyVGV4dE1vZGVsQ29udGVudFByb3ZpZGVyKENlbGxVcmkuc2NoZW1lLCB0aGlzKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0cmF0aW9uLmRpc3Bvc2UoKTtcblx0fVxuXG5cdGFzeW5jIHByb3ZpZGVUZXh0Q29udGVudChyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxJVGV4dE1vZGVsIHwgbnVsbD4ge1xuXHRcdGNvbnN0IGV4aXN0aW5nID0gdGhpcy5fbW9kZWxTZXJ2aWNlLmdldE1vZGVsKHJlc291cmNlKTtcblx0XHRpZiAoZXhpc3RpbmcpIHtcblx0XHRcdHJldHVybiBleGlzdGluZztcblx0XHR9XG5cdFx0Y29uc3QgZGF0YSA9IENlbGxVcmkucGFyc2UocmVzb3VyY2UpO1xuXHRcdC8vIGNvbnN0IGRhdGEgPSBwYXJzZUNlbGxVcmkocmVzb3VyY2UpO1xuXHRcdGlmICghZGF0YSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVmID0gYXdhaXQgdGhpcy5fbm90ZWJvb2tNb2RlbFJlc29sdmVyU2VydmljZS5yZXNvbHZlKGRhdGEubm90ZWJvb2spO1xuXHRcdGxldCByZXN1bHQ6IElUZXh0TW9kZWwgfCBudWxsID0gbnVsbDtcblxuXHRcdGlmICghcmVmLm9iamVjdC5pc1Jlc29sdmVkKCkpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgY2VsbCBvZiByZWYub2JqZWN0Lm5vdGVib29rLmNlbGxzKSB7XG5cdFx0XHRpZiAoY2VsbC51cmkudG9TdHJpbmcoKSA9PT0gcmVzb3VyY2UudG9TdHJpbmcoKSkge1xuXHRcdFx0XHRjb25zdCBidWZmZXJGYWN0b3J5OiBJVGV4dEJ1ZmZlckZhY3RvcnkgPSB7XG5cdFx0XHRcdFx0Y3JlYXRlOiAoZGVmYXVsdEVPTCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgbmV3RU9MID0gKGRlZmF1bHRFT0wgPT09IERlZmF1bHRFbmRPZkxpbmUuQ1JMRiA/ICdcXHJcXG4nIDogJ1xcbicpO1xuXHRcdFx0XHRcdFx0KGNlbGwudGV4dEJ1ZmZlciBhcyBJVGV4dEJ1ZmZlcikuc2V0RU9MKG5ld0VPTCk7XG5cdFx0XHRcdFx0XHRyZXR1cm4geyB0ZXh0QnVmZmVyOiBjZWxsLnRleHRCdWZmZXIgYXMgSVRleHRCdWZmZXIsIGRpc3Bvc2FibGU6IERpc3Bvc2FibGUuTm9uZSB9O1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Z2V0Rmlyc3RMaW5lVGV4dDogKGxpbWl0OiBudW1iZXIpID0+IHtcblx0XHRcdFx0XHRcdHJldHVybiBjZWxsLnRleHRCdWZmZXIuZ2V0TGluZUNvbnRlbnQoMSkuc3Vic3RyaW5nKDAsIGxpbWl0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHRcdGNvbnN0IGxhbmd1YWdlSWQgPSB0aGlzLl9sYW5ndWFnZVNlcnZpY2UuZ2V0TGFuZ3VhZ2VJZEJ5TGFuZ3VhZ2VOYW1lKGNlbGwubGFuZ3VhZ2UpO1xuXHRcdFx0XHRjb25zdCBsYW5ndWFnZVNlbGVjdGlvbiA9IGxhbmd1YWdlSWQgPyB0aGlzLl9sYW5ndWFnZVNlcnZpY2UuY3JlYXRlQnlJZChsYW5ndWFnZUlkKSA6IChjZWxsLmNlbGxLaW5kID09PSBDZWxsS2luZC5NYXJrdXAgPyB0aGlzLl9sYW5ndWFnZVNlcnZpY2UuY3JlYXRlQnlJZCgnbWFya2Rvd24nKSA6IHRoaXMuX2xhbmd1YWdlU2VydmljZS5jcmVhdGVCeUZpbGVwYXRoT3JGaXJzdExpbmUocmVzb3VyY2UsIGNlbGwudGV4dEJ1ZmZlci5nZXRMaW5lQ29udGVudCgxKSkpO1xuXHRcdFx0XHRyZXN1bHQgPSB0aGlzLl9tb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoXG5cdFx0XHRcdFx0YnVmZmVyRmFjdG9yeSxcblx0XHRcdFx0XHRsYW5ndWFnZVNlbGVjdGlvbixcblx0XHRcdFx0XHRyZXNvdXJjZVxuXHRcdFx0XHQpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0cmVmLmRpc3Bvc2UoKTtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IG9uY2UgPSBFdmVudC5hbnkocmVzdWx0Lm9uV2lsbERpc3Bvc2UsIHJlZi5vYmplY3Qubm90ZWJvb2sub25XaWxsRGlzcG9zZSkoKCkgPT4ge1xuXHRcdFx0b25jZS5kaXNwb3NlKCk7XG5cdFx0XHRyZWYuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG5jbGFzcyBDZWxsSW5mb0NvbnRlbnRQcm92aWRlciB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLmNlbGxJbmZvQ29udGVudFByb3ZpZGVyJztcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlczogSURpc3Bvc2FibGVbXSA9IFtdO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJVGV4dE1vZGVsU2VydmljZSB0ZXh0TW9kZWxTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0XHRASU1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9tb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhYmVsU2VydmljZTogSUxhYmVsU2VydmljZSxcblx0XHRASU5vdGVib29rRWRpdG9yTW9kZWxSZXNvbHZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tNb2RlbFJlc29sdmVyU2VydmljZTogSU5vdGVib29rRWRpdG9yTW9kZWxSZXNvbHZlclNlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLnB1c2godGV4dE1vZGVsU2VydmljZS5yZWdpc3RlclRleHRNb2RlbENvbnRlbnRQcm92aWRlcihTY2hlbWFzLnZzY29kZU5vdGVib29rQ2VsbE1ldGFkYXRhLCB7XG5cdFx0XHRwcm92aWRlVGV4dENvbnRlbnQ6IHRoaXMucHJvdmlkZU1ldGFkYXRhVGV4dENvbnRlbnQuYmluZCh0aGlzKVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLnB1c2godGV4dE1vZGVsU2VydmljZS5yZWdpc3RlclRleHRNb2RlbENvbnRlbnRQcm92aWRlcihTY2hlbWFzLnZzY29kZU5vdGVib29rQ2VsbE91dHB1dCwge1xuXHRcdFx0cHJvdmlkZVRleHRDb250ZW50OiB0aGlzLnByb3ZpZGVPdXRwdXRUZXh0Q29udGVudC5iaW5kKHRoaXMpXG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMucHVzaCh0aGlzLl9sYWJlbFNlcnZpY2UucmVnaXN0ZXJGb3JtYXR0ZXIoe1xuXHRcdFx0c2NoZW1lOiBTY2hlbWFzLnZzY29kZU5vdGVib29rQ2VsbE1ldGFkYXRhLFxuXHRcdFx0Zm9ybWF0dGluZzoge1xuXHRcdFx0XHRsYWJlbDogJyR7cGF0aH0gKG1ldGFkYXRhKScsXG5cdFx0XHRcdHNlcGFyYXRvcjogJy8nXG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMucHVzaCh0aGlzLl9sYWJlbFNlcnZpY2UucmVnaXN0ZXJGb3JtYXR0ZXIoe1xuXHRcdFx0c2NoZW1lOiBTY2hlbWFzLnZzY29kZU5vdGVib29rQ2VsbE91dHB1dCxcblx0XHRcdGZvcm1hdHRpbmc6IHtcblx0XHRcdFx0bGFiZWw6ICcke3BhdGh9IChvdXRwdXQpJyxcblx0XHRcdFx0c2VwYXJhdG9yOiAnLydcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdGRpc3Bvc2UodGhpcy5fZGlzcG9zYWJsZXMpO1xuXHR9XG5cblx0YXN5bmMgcHJvdmlkZU1ldGFkYXRhVGV4dENvbnRlbnQocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8SVRleHRNb2RlbCB8IG51bGw+IHtcblx0XHRjb25zdCBleGlzdGluZyA9IHRoaXMuX21vZGVsU2VydmljZS5nZXRNb2RlbChyZXNvdXJjZSk7XG5cdFx0aWYgKGV4aXN0aW5nKSB7XG5cdFx0XHRyZXR1cm4gZXhpc3Rpbmc7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGF0YSA9IENlbGxVcmkucGFyc2VDZWxsUHJvcGVydHlVcmkocmVzb3VyY2UsIFNjaGVtYXMudnNjb2RlTm90ZWJvb2tDZWxsTWV0YWRhdGEpO1xuXHRcdGlmICghZGF0YSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVmID0gYXdhaXQgdGhpcy5fbm90ZWJvb2tNb2RlbFJlc29sdmVyU2VydmljZS5yZXNvbHZlKGRhdGEubm90ZWJvb2spO1xuXHRcdGxldCByZXN1bHQ6IElUZXh0TW9kZWwgfCBudWxsID0gbnVsbDtcblxuXHRcdGNvbnN0IG1vZGUgPSB0aGlzLl9sYW5ndWFnZVNlcnZpY2UuY3JlYXRlQnlJZCgnanNvbicpO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGZvciAoY29uc3QgY2VsbCBvZiByZWYub2JqZWN0Lm5vdGVib29rLmNlbGxzKSB7XG5cdFx0XHRpZiAoY2VsbC5oYW5kbGUgPT09IGRhdGEuaGFuZGxlKSB7XG5cdFx0XHRcdGNvbnN0IGNlbGxJbmRleCA9IHJlZi5vYmplY3Qubm90ZWJvb2suY2VsbHMuaW5kZXhPZihjZWxsKTtcblx0XHRcdFx0Y29uc3QgbWV0YWRhdGFTb3VyY2UgPSBnZXRGb3JtYXR0ZWRNZXRhZGF0YUpTT04ocmVmLm9iamVjdC5ub3RlYm9vay50cmFuc2llbnRPcHRpb25zLnRyYW5zaWVudENlbGxNZXRhZGF0YSwgY2VsbC5tZXRhZGF0YSwgY2VsbC5sYW5ndWFnZSwgdHJ1ZSk7XG5cdFx0XHRcdHJlc3VsdCA9IHRoaXMuX21vZGVsU2VydmljZS5jcmVhdGVNb2RlbChcblx0XHRcdFx0XHRtZXRhZGF0YVNvdXJjZSxcblx0XHRcdFx0XHRtb2RlLFxuXHRcdFx0XHRcdHJlc291cmNlXG5cdFx0XHRcdCk7XG5cdFx0XHRcdHRoaXMuX2Rpc3Bvc2FibGVzLnB1c2goZGlzcG9zYWJsZXMuYWRkKHJlZi5vYmplY3Qubm90ZWJvb2sub25EaWRDaGFuZ2VDb250ZW50KGUgPT4ge1xuXHRcdFx0XHRcdGlmIChyZXN1bHQgJiYgZS5yYXdFdmVudHMuc29tZShldmVudCA9PiAoZXZlbnQua2luZCA9PT0gTm90ZWJvb2tDZWxsc0NoYW5nZVR5cGUuQ2hhbmdlQ2VsbE1ldGFkYXRhIHx8IGV2ZW50LmtpbmQgPT09IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLkNoYW5nZUNlbGxMYW5ndWFnZSkgJiYgZXZlbnQuaW5kZXggPT09IGNlbGxJbmRleCkpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHZhbHVlID0gZ2V0Rm9ybWF0dGVkTWV0YWRhdGFKU09OKHJlZi5vYmplY3Qubm90ZWJvb2sudHJhbnNpZW50T3B0aW9ucy50cmFuc2llbnRDZWxsTWV0YWRhdGEsIGNlbGwubWV0YWRhdGEsIGNlbGwubGFuZ3VhZ2UsIHRydWUpO1xuXHRcdFx0XHRcdFx0aWYgKHJlc3VsdC5nZXRWYWx1ZSgpICE9PSB2YWx1ZSkge1xuXHRcdFx0XHRcdFx0XHRyZXN1bHQuc2V0VmFsdWUodmFsdWUpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHJlZi5kaXNwb3NlKCk7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCBvbmNlID0gcmVzdWx0Lm9uV2lsbERpc3Bvc2UoKCkgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0b25jZS5kaXNwb3NlKCk7XG5cdFx0XHRyZWYuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgcGFyc2VTdHJlYW1PdXRwdXQob3A/OiBJQ2VsbE91dHB1dCk6IHsgY29udGVudDogc3RyaW5nOyBtb2RlOiBJTGFuZ3VhZ2VTZWxlY3Rpb24gfSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCFvcCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0cmVhbU91dHB1dERhdGEgPSBnZXRTdHJlYW1PdXRwdXREYXRhKG9wLm91dHB1dHMpO1xuXHRcdGlmIChzdHJlYW1PdXRwdXREYXRhKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRjb250ZW50OiBzdHJlYW1PdXRwdXREYXRhLFxuXHRcdFx0XHRtb2RlOiB0aGlzLl9sYW5ndWFnZVNlcnZpY2UuY3JlYXRlQnlJZChQTEFJTlRFWFRfTEFOR1VBR0VfSUQpXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHJldHVybjtcblx0fVxuXG5cdHByaXZhdGUgX2dldFJlc3VsdChkYXRhOiB7XG5cdFx0bm90ZWJvb2s6IFVSSTtcblx0XHRvdXRwdXRJZD86IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0fSwgY2VsbDogSUNlbGwpIHtcblx0XHRsZXQgcmVzdWx0OiB7IGNvbnRlbnQ6IHN0cmluZzsgbW9kZTogSUxhbmd1YWdlU2VsZWN0aW9uIH0gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBtb2RlID0gdGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLmNyZWF0ZUJ5SWQoJ2pzb24nKTtcblx0XHRjb25zdCBvcCA9IGNlbGwub3V0cHV0cy5maW5kKG9wID0+IG9wLm91dHB1dElkID09PSBkYXRhLm91dHB1dElkIHx8IG9wLmFsdGVybmF0aXZlT3V0cHV0SWQgPT09IGRhdGEub3V0cHV0SWQpO1xuXHRcdGNvbnN0IHN0cmVhbU91dHB1dERhdGEgPSB0aGlzLnBhcnNlU3RyZWFtT3V0cHV0KG9wKTtcblx0XHRpZiAoc3RyZWFtT3V0cHV0RGF0YSkge1xuXHRcdFx0cmVzdWx0ID0gc3RyZWFtT3V0cHV0RGF0YTtcblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb2JqID0gY2VsbC5vdXRwdXRzLm1hcChvdXRwdXQgPT4gKHtcblx0XHRcdG1ldGFkYXRhOiBvdXRwdXQubWV0YWRhdGEsXG5cdFx0XHRvdXRwdXRJdGVtczogb3V0cHV0Lm91dHB1dHMubWFwKG9waXQgPT4gKHtcblx0XHRcdFx0bWltZVR5cGU6IG9waXQubWltZSxcblx0XHRcdFx0ZGF0YTogb3BpdC5kYXRhLnRvU3RyaW5nKClcblx0XHRcdH0pKVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IG91dHB1dFNvdXJjZSA9IHRvRm9ybWF0dGVkU3RyaW5nKG9iaiwge30pO1xuXHRcdHJlc3VsdCA9IHtcblx0XHRcdGNvbnRlbnQ6IG91dHB1dFNvdXJjZSxcblx0XHRcdG1vZGVcblx0XHR9O1xuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGFzeW5jIHByb3ZpZGVPdXRwdXRzVGV4dENvbnRlbnQocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8SVRleHRNb2RlbCB8IG51bGw+IHtcblx0XHRjb25zdCBleGlzdGluZyA9IHRoaXMuX21vZGVsU2VydmljZS5nZXRNb2RlbChyZXNvdXJjZSk7XG5cdFx0aWYgKGV4aXN0aW5nKSB7XG5cdFx0XHRyZXR1cm4gZXhpc3Rpbmc7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGF0YSA9IENlbGxVcmkucGFyc2VDZWxsUHJvcGVydHlVcmkocmVzb3VyY2UsIFNjaGVtYXMudnNjb2RlTm90ZWJvb2tDZWxsT3V0cHV0KTtcblx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlZiA9IGF3YWl0IHRoaXMuX25vdGVib29rTW9kZWxSZXNvbHZlclNlcnZpY2UucmVzb2x2ZShkYXRhLm5vdGVib29rKTtcblx0XHRjb25zdCBjZWxsID0gcmVmLm9iamVjdC5ub3RlYm9vay5jZWxscy5maW5kKGNlbGwgPT4gY2VsbC5oYW5kbGUgPT09IGRhdGEuaGFuZGxlKTtcblxuXHRcdGlmICghY2VsbCkge1xuXHRcdFx0cmVmLmRpc3Bvc2UoKTtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGUgPSB0aGlzLl9sYW5ndWFnZVNlcnZpY2UuY3JlYXRlQnlJZCgnanNvbicpO1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fbW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsKGdldEZvcm1hdHRlZE91dHB1dEpTT04oY2VsbC5vdXRwdXRzIHx8IFtdKSwgbW9kZSwgcmVzb3VyY2UsIHRydWUpO1xuXHRcdGNvbnN0IGNlbGxNb2RlbExpc3RlbmVyID0gRXZlbnQuYW55KGNlbGwub25EaWRDaGFuZ2VPdXRwdXRzID8/IEV2ZW50Lk5vbmUsIGNlbGwub25EaWRDaGFuZ2VPdXRwdXRJdGVtcyA/PyBFdmVudC5Ob25lKSgoKSA9PiB7XG5cdFx0XHRtb2RlbC5zZXRWYWx1ZShnZXRGb3JtYXR0ZWRPdXRwdXRKU09OKGNlbGwub3V0cHV0cyB8fCBbXSkpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3Qgb25jZSA9IG1vZGVsLm9uV2lsbERpc3Bvc2UoKCkgPT4ge1xuXHRcdFx0b25jZS5kaXNwb3NlKCk7XG5cdFx0XHRjZWxsTW9kZWxMaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHRyZWYuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIG1vZGVsO1xuXHR9XG5cblx0YXN5bmMgcHJvdmlkZU91dHB1dFRleHRDb250ZW50KHJlc291cmNlOiBVUkkpOiBQcm9taXNlPElUZXh0TW9kZWwgfCBudWxsPiB7XG5cdFx0Y29uc3QgZXhpc3RpbmcgPSB0aGlzLl9tb2RlbFNlcnZpY2UuZ2V0TW9kZWwocmVzb3VyY2UpO1xuXHRcdGlmIChleGlzdGluZykge1xuXHRcdFx0cmV0dXJuIGV4aXN0aW5nO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRhdGEgPSBDZWxsVXJpLnBhcnNlQ2VsbE91dHB1dFVyaShyZXNvdXJjZSk7XG5cdFx0aWYgKCFkYXRhKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5wcm92aWRlT3V0cHV0c1RleHRDb250ZW50KHJlc291cmNlKTtcblx0XHR9XG5cblx0XHRjb25zdCByZWYgPSBhd2FpdCB0aGlzLl9ub3RlYm9va01vZGVsUmVzb2x2ZXJTZXJ2aWNlLnJlc29sdmUoZGF0YS5ub3RlYm9vayk7XG5cdFx0Y29uc3QgY2VsbCA9IHJlZi5vYmplY3Qubm90ZWJvb2suY2VsbHMuZmluZChjZWxsID0+ICEhY2VsbC5vdXRwdXRzLmZpbmQob3AgPT4gb3Aub3V0cHV0SWQgPT09IGRhdGEub3V0cHV0SWQgfHwgb3AuYWx0ZXJuYXRpdmVPdXRwdXRJZCA9PT0gZGF0YS5vdXRwdXRJZCkpO1xuXG5cdFx0aWYgKCFjZWxsKSB7XG5cdFx0XHRyZWYuZGlzcG9zZSgpO1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fZ2V0UmVzdWx0KGRhdGEsIGNlbGwpO1xuXG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHJlZi5kaXNwb3NlKCk7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX21vZGVsU2VydmljZS5jcmVhdGVNb2RlbChyZXN1bHQuY29udGVudCwgcmVzdWx0Lm1vZGUsIHJlc291cmNlKTtcblx0XHRjb25zdCBjZWxsTW9kZWxMaXN0ZW5lciA9IEV2ZW50LmFueShjZWxsLm9uRGlkQ2hhbmdlT3V0cHV0cyA/PyBFdmVudC5Ob25lLCBjZWxsLm9uRGlkQ2hhbmdlT3V0cHV0SXRlbXMgPz8gRXZlbnQuTm9uZSkoKCkgPT4ge1xuXHRcdFx0Y29uc3QgbmV3UmVzdWx0ID0gdGhpcy5fZ2V0UmVzdWx0KGRhdGEsIGNlbGwpO1xuXG5cdFx0XHRpZiAoIW5ld1Jlc3VsdCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdG1vZGVsLnNldFZhbHVlKG5ld1Jlc3VsdC5jb250ZW50KTtcblx0XHRcdG1vZGVsLnNldExhbmd1YWdlKG5ld1Jlc3VsdC5tb2RlLmxhbmd1YWdlSWQpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3Qgb25jZSA9IG1vZGVsLm9uV2lsbERpc3Bvc2UoKCkgPT4ge1xuXHRcdFx0b25jZS5kaXNwb3NlKCk7XG5cdFx0XHRjZWxsTW9kZWxMaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0XHRyZWYuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIG1vZGVsO1xuXHR9XG59XG5cbmNsYXNzIE5vdGVib29rTWV0YWRhdGFDb250ZW50UHJvdmlkZXIge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIubm90ZWJvb2tNZXRhZGF0YUNvbnRlbnRQcm92aWRlcic7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXM6IElEaXNwb3NhYmxlW10gPSBbXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVRleHRNb2RlbFNlcnZpY2UgdGV4dE1vZGVsU2VydmljZTogSVRleHRNb2RlbFNlcnZpY2UsXG5cdFx0QElNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSxcblx0XHRASUxhYmVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYWJlbFNlcnZpY2U6IElMYWJlbFNlcnZpY2UsXG5cdFx0QElOb3RlYm9va0VkaXRvck1vZGVsUmVzb2x2ZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rTW9kZWxSZXNvbHZlclNlcnZpY2U6IElOb3RlYm9va0VkaXRvck1vZGVsUmVzb2x2ZXJTZXJ2aWNlLFxuXHQpIHtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5wdXNoKHRleHRNb2RlbFNlcnZpY2UucmVnaXN0ZXJUZXh0TW9kZWxDb250ZW50UHJvdmlkZXIoU2NoZW1hcy52c2NvZGVOb3RlYm9va01ldGFkYXRhLCB7XG5cdFx0XHRwcm92aWRlVGV4dENvbnRlbnQ6IHRoaXMucHJvdmlkZU1ldGFkYXRhVGV4dENvbnRlbnQuYmluZCh0aGlzKVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLnB1c2godGhpcy5fbGFiZWxTZXJ2aWNlLnJlZ2lzdGVyRm9ybWF0dGVyKHtcblx0XHRcdHNjaGVtZTogU2NoZW1hcy52c2NvZGVOb3RlYm9va01ldGFkYXRhLFxuXHRcdFx0Zm9ybWF0dGluZzoge1xuXHRcdFx0XHRsYWJlbDogJyR7cGF0aH0gKG1ldGFkYXRhKScsXG5cdFx0XHRcdHNlcGFyYXRvcjogJy8nXG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRkaXNwb3NlKHRoaXMuX2Rpc3Bvc2FibGVzKTtcblx0fVxuXG5cdGFzeW5jIHByb3ZpZGVNZXRhZGF0YVRleHRDb250ZW50KHJlc291cmNlOiBVUkkpOiBQcm9taXNlPElUZXh0TW9kZWwgfCBudWxsPiB7XG5cdFx0Y29uc3QgZXhpc3RpbmcgPSB0aGlzLl9tb2RlbFNlcnZpY2UuZ2V0TW9kZWwocmVzb3VyY2UpO1xuXHRcdGlmIChleGlzdGluZykge1xuXHRcdFx0cmV0dXJuIGV4aXN0aW5nO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRhdGEgPSBOb3RlYm9va01ldGFkYXRhVXJpLnBhcnNlKHJlc291cmNlKTtcblx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlZiA9IGF3YWl0IHRoaXMuX25vdGVib29rTW9kZWxSZXNvbHZlclNlcnZpY2UucmVzb2x2ZShkYXRhKTtcblx0XHRsZXQgcmVzdWx0OiBJVGV4dE1vZGVsIHwgbnVsbCA9IG51bGw7XG5cblx0XHRjb25zdCBtb2RlID0gdGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLmNyZWF0ZUJ5SWQoJ2pzb24nKTtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBtZXRhZGF0YVNvdXJjZSA9IGdldEZvcm1hdHRlZE5vdGVib29rTWV0YWRhdGFKU09OKHJlZi5vYmplY3Qubm90ZWJvb2sudHJhbnNpZW50T3B0aW9ucy50cmFuc2llbnREb2N1bWVudE1ldGFkYXRhLCByZWYub2JqZWN0Lm5vdGVib29rLm1ldGFkYXRhKTtcblx0XHRyZXN1bHQgPSB0aGlzLl9tb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwoXG5cdFx0XHRtZXRhZGF0YVNvdXJjZSxcblx0XHRcdG1vZGUsXG5cdFx0XHRyZXNvdXJjZVxuXHRcdCk7XG5cblx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0cmVmLmRpc3Bvc2UoKTtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblxuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLnB1c2goZGlzcG9zYWJsZXMuYWRkKHJlZi5vYmplY3Qubm90ZWJvb2sub25EaWRDaGFuZ2VDb250ZW50KGUgPT4ge1xuXHRcdFx0aWYgKHJlc3VsdCAmJiBlLnJhd0V2ZW50cy5zb21lKGV2ZW50ID0+IChldmVudC5raW5kID09PSBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5DaGFuZ2VDZWxsQ29udGVudCB8fCBldmVudC5raW5kID09PSBOb3RlYm9va0NlbGxzQ2hhbmdlVHlwZS5DaGFuZ2VEb2N1bWVudE1ldGFkYXRhIHx8IGV2ZW50LmtpbmQgPT09IE5vdGVib29rQ2VsbHNDaGFuZ2VUeXBlLk1vZGVsQ2hhbmdlKSkpIHtcblx0XHRcdFx0Y29uc3QgdmFsdWUgPSBnZXRGb3JtYXR0ZWROb3RlYm9va01ldGFkYXRhSlNPTihyZWYub2JqZWN0Lm5vdGVib29rLnRyYW5zaWVudE9wdGlvbnMudHJhbnNpZW50RG9jdW1lbnRNZXRhZGF0YSwgcmVmLm9iamVjdC5ub3RlYm9vay5tZXRhZGF0YSk7XG5cdFx0XHRcdGlmIChyZXN1bHQuZ2V0VmFsdWUoKSAhPT0gdmFsdWUpIHtcblx0XHRcdFx0XHRyZXN1bHQuc2V0VmFsdWUodmFsdWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpKTtcblxuXHRcdGNvbnN0IG9uY2UgPSByZXN1bHQub25XaWxsRGlzcG9zZSgoKSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0XHRvbmNlLmRpc3Bvc2UoKTtcblx0XHRcdHJlZi5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG59XG5cbmNsYXNzIFJlZ2lzdGVyU2NoZW1hc0NvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIucmVnaXN0ZXJDZWxsU2NoZW1hcyc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLnJlZ2lzdGVyTWV0YWRhdGFTY2hlbWFzKCk7XG5cdH1cblxuXHRwcml2YXRlIHJlZ2lzdGVyTWV0YWRhdGFTY2hlbWFzKCk6IHZvaWQge1xuXHRcdGNvbnN0IGpzb25SZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElKU09OQ29udHJpYnV0aW9uUmVnaXN0cnk+KEpTT05FeHRlbnNpb25zLkpTT05Db250cmlidXRpb24pO1xuXHRcdGNvbnN0IG1ldGFkYXRhU2NoZW1hOiBJSlNPTlNjaGVtYSA9IHtcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0WydsYW5ndWFnZSddOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246ICdUaGUgbGFuZ3VhZ2UgZm9yIHRoZSBjZWxsJ1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0Ly8gcGF0dGVyblByb3BlcnRpZXM6IGFsbFNldHRpbmdzLnBhdHRlcm5Qcm9wZXJ0aWVzLFxuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IHRydWUsXG5cdFx0XHRhbGxvd1RyYWlsaW5nQ29tbWFzOiB0cnVlLFxuXHRcdFx0YWxsb3dDb21tZW50czogdHJ1ZVxuXHRcdH07XG5cblx0XHRqc29uUmVnaXN0cnkucmVnaXN0ZXJTY2hlbWEoJ3ZzY29kZTovL3NjaGVtYXMvbm90ZWJvb2svY2VsbG1ldGFkYXRhJywgbWV0YWRhdGFTY2hlbWEpO1xuXHR9XG59XG5cbmNsYXNzIE5vdGVib29rRWRpdG9yTWFuYWdlciBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guY29udHJpYi5ub3RlYm9va0VkaXRvck1hbmFnZXInO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2Rpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASU5vdGVib29rRWRpdG9yTW9kZWxSZXNvbHZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tFZGl0b3JNb2RlbFNlcnZpY2U6IElOb3RlYm9va0VkaXRvck1vZGVsUmVzb2x2ZXJTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yR3JvdXBzU2VydmljZSBlZGl0b3JHcm91cHM6IElFZGl0b3JHcm91cHNTZXJ2aWNlXG5cdCkge1xuXHRcdC8vIE9QRU4gbm90ZWJvb2sgZWRpdG9yIGZvciBtb2RlbHMgdGhhdCBoYXZlIHR1cm5lZCBkaXJ0eSB3aXRob3V0IGJlaW5nIHZpc2libGUgaW4gYW4gZWRpdG9yXG5cdFx0dHlwZSBFID0gSVJlc29sdmVkTm90ZWJvb2tFZGl0b3JNb2RlbDtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQoRXZlbnQuZGVib3VuY2U8RSwgRVtdPihcblx0XHRcdHRoaXMuX25vdGVib29rRWRpdG9yTW9kZWxTZXJ2aWNlLm9uRGlkQ2hhbmdlRGlydHksXG5cdFx0XHQobGFzdCwgY3VycmVudCkgPT4gIWxhc3QgPyBbY3VycmVudF0gOiBbLi4ubGFzdCwgY3VycmVudF0sXG5cdFx0XHQxMDBcblx0XHQpKHRoaXMuX29wZW5NaXNzaW5nRGlydHlOb3RlYm9va0VkaXRvcnMsIHRoaXMpKTtcblxuXHRcdC8vIENMT1NFIGVkaXRvcnMgd2hlbiB3ZSBhcmUgYWJvdXQgdG8gb3BlbiBjb25mbGljdGluZyBub3RlYm9va3Ncblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQoX25vdGVib29rRWRpdG9yTW9kZWxTZXJ2aWNlLm9uV2lsbEZhaWxXaXRoQ29uZmxpY3QoZSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGdyb3VwIG9mIGVkaXRvckdyb3Vwcy5ncm91cHMpIHtcblx0XHRcdFx0Y29uc3QgY29uZmxpY3RJbnB1dHMgPSBncm91cC5lZGl0b3JzLmZpbHRlcihpbnB1dCA9PiBpbnB1dCBpbnN0YW5jZW9mIE5vdGVib29rRWRpdG9ySW5wdXQgJiYgaW5wdXQudmlld1R5cGUgIT09IGUudmlld1R5cGUgJiYgaXNFcXVhbChpbnB1dC5yZXNvdXJjZSwgZS5yZXNvdXJjZSkpO1xuXHRcdFx0XHRjb25zdCBwID0gZ3JvdXAuY2xvc2VFZGl0b3JzKGNvbmZsaWN0SW5wdXRzKTtcblx0XHRcdFx0ZS53YWl0VW50aWwocCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH1cblxuXHRwcml2YXRlIF9vcGVuTWlzc2luZ0RpcnR5Tm90ZWJvb2tFZGl0b3JzKG1vZGVsczogSVJlc29sdmVkTm90ZWJvb2tFZGl0b3JNb2RlbFtdKTogdm9pZCB7XG5cdFx0Y29uc3QgcmVzdWx0OiBJUmVzb3VyY2VFZGl0b3JJbnB1dFtdID0gW107XG5cdFx0Zm9yIChjb25zdCBtb2RlbCBvZiBtb2RlbHMpIHtcblx0XHRcdGlmIChtb2RlbC5pc0RpcnR5KCkgJiYgIXRoaXMuX2VkaXRvclNlcnZpY2UuaXNPcGVuZWQoeyByZXNvdXJjZTogbW9kZWwucmVzb3VyY2UsIHR5cGVJZDogTm90ZWJvb2tFZGl0b3JJbnB1dC5JRCwgZWRpdG9ySWQ6IG1vZGVsLnZpZXdUeXBlIH0pICYmIGV4dG5hbWUobW9kZWwucmVzb3VyY2UpICE9PSAnLmludGVyYWN0aXZlJykge1xuXHRcdFx0XHRyZXN1bHQucHVzaCh7XG5cdFx0XHRcdFx0cmVzb3VyY2U6IG1vZGVsLnJlc291cmNlLFxuXHRcdFx0XHRcdG9wdGlvbnM6IHsgaW5hY3RpdmU6IHRydWUsIHByZXNlcnZlRm9jdXM6IHRydWUsIHBpbm5lZDogdHJ1ZSwgb3ZlcnJpZGU6IG1vZGVsLnZpZXdUeXBlIH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmIChyZXN1bHQubGVuZ3RoID4gMCkge1xuXHRcdFx0dGhpcy5fZWRpdG9yU2VydmljZS5vcGVuRWRpdG9ycyhyZXN1bHQpO1xuXHRcdH1cblx0fVxufVxuXG5jbGFzcyBTaW1wbGVOb3RlYm9va1dvcmtpbmdDb3B5RWRpdG9ySGFuZGxlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uLCBJV29ya2luZ0NvcHlFZGl0b3JIYW5kbGVyIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIuc2ltcGxlTm90ZWJvb2tXb3JraW5nQ29weUVkaXRvckhhbmRsZXInO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVdvcmtpbmdDb3B5RWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF93b3JraW5nQ29weUVkaXRvclNlcnZpY2U6IElXb3JraW5nQ29weUVkaXRvclNlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJTm90ZWJvb2tTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rU2VydmljZTogSU5vdGVib29rU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5faW5zdGFsbEhhbmRsZXIoKTtcblx0fVxuXG5cdGFzeW5jIGhhbmRsZXMod29ya2luZ0NvcHk6IElXb3JraW5nQ29weUlkZW50aWZpZXIpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRjb25zdCB2aWV3VHlwZSA9IHRoaXMuaGFuZGxlc1N5bmMod29ya2luZ0NvcHkpO1xuXHRcdGlmICghdmlld1R5cGUpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fbm90ZWJvb2tTZXJ2aWNlLmNhblJlc29sdmUodmlld1R5cGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVzU3luYyh3b3JraW5nQ29weTogSVdvcmtpbmdDb3B5SWRlbnRpZmllcik6IHN0cmluZyAvKiB2aWV3VHlwZSAqLyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3Qgdmlld1R5cGUgPSB0aGlzLl9nZXRWaWV3VHlwZSh3b3JraW5nQ29weSk7XG5cdFx0aWYgKCF2aWV3VHlwZSB8fCB2aWV3VHlwZSA9PT0gJ2ludGVyYWN0aXZlJykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdmlld1R5cGU7XG5cdH1cblxuXHRpc09wZW4od29ya2luZ0NvcHk6IElXb3JraW5nQ29weUlkZW50aWZpZXIsIGVkaXRvcjogRWRpdG9ySW5wdXQpOiBib29sZWFuIHtcblx0XHRpZiAoIXRoaXMuaGFuZGxlc1N5bmMod29ya2luZ0NvcHkpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVkaXRvciBpbnN0YW5jZW9mIE5vdGVib29rRWRpdG9ySW5wdXQgJiYgZWRpdG9yLnZpZXdUeXBlID09PSB0aGlzLl9nZXRWaWV3VHlwZSh3b3JraW5nQ29weSkgJiYgaXNFcXVhbCh3b3JraW5nQ29weS5yZXNvdXJjZSwgZWRpdG9yLnJlc291cmNlKTtcblx0fVxuXG5cdGNyZWF0ZUVkaXRvcih3b3JraW5nQ29weTogSVdvcmtpbmdDb3B5SWRlbnRpZmllcik6IEVkaXRvcklucHV0IHtcblx0XHRyZXR1cm4gTm90ZWJvb2tFZGl0b3JJbnB1dC5nZXRPckNyZWF0ZSh0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZSwgd29ya2luZ0NvcHkucmVzb3VyY2UsIHVuZGVmaW5lZCwgdGhpcy5fZ2V0Vmlld1R5cGUod29ya2luZ0NvcHkpISk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9pbnN0YWxsSGFuZGxlcigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLl9leHRlbnNpb25TZXJ2aWNlLndoZW5JbnN0YWxsZWRFeHRlbnNpb25zUmVnaXN0ZXJlZCgpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fd29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlLnJlZ2lzdGVySGFuZGxlcih0aGlzKSk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRWaWV3VHlwZSh3b3JraW5nQ29weTogSVdvcmtpbmdDb3B5SWRlbnRpZmllcikge1xuXHRcdGNvbnN0IG5vdGVib29rVHlwZSA9IE5vdGVib29rV29ya2luZ0NvcHlUeXBlSWRlbnRpZmllci5wYXJzZSh3b3JraW5nQ29weS50eXBlSWQpO1xuXHRcdGlmIChub3RlYm9va1R5cGUgJiYgbm90ZWJvb2tUeXBlLnZpZXdUeXBlID09PSBub3RlYm9va1R5cGUubm90ZWJvb2tUeXBlKSB7XG5cdFx0XHRyZXR1cm4gbm90ZWJvb2tUeXBlPy52aWV3VHlwZTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG5jbGFzcyBOb3RlYm9va0xhbmd1YWdlU2VsZWN0b3JTY29yZVJlZmluZSB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLm5vdGVib29rTGFuZ3VhZ2VTZWxlY3RvclNjb3JlUmVmaW5lJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASU5vdGVib29rU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9ub3RlYm9va1NlcnZpY2U6IElOb3RlYm9va1NlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHQpIHtcblx0XHRsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5zZXROb3RlYm9va1R5cGVSZXNvbHZlcih0aGlzLl9nZXROb3RlYm9va0luZm8uYmluZCh0aGlzKSk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXROb3RlYm9va0luZm8odXJpOiBVUkkpOiBOb3RlYm9va0luZm8gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGNlbGxVcmkgPSBDZWxsVXJpLnBhcnNlKHVyaSk7XG5cdFx0aWYgKCFjZWxsVXJpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBub3RlYm9vayA9IHRoaXMuX25vdGVib29rU2VydmljZS5nZXROb3RlYm9va1RleHRNb2RlbChjZWxsVXJpLm5vdGVib29rKTtcblx0XHRpZiAoIW5vdGVib29rKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0dXJpOiBub3RlYm9vay51cmksXG5cdFx0XHR0eXBlOiBub3RlYm9vay52aWV3VHlwZVxuXHRcdH07XG5cdH1cbn1cblxuY29uc3Qgd29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpO1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKE5vdGVib29rQ29udHJpYnV0aW9uLklELCBOb3RlYm9va0NvbnRyaWJ1dGlvbiwgV29ya2JlbmNoUGhhc2UuQmxvY2tTdGFydHVwKTtcbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihDZWxsQ29udGVudFByb3ZpZGVyLklELCBDZWxsQ29udGVudFByb3ZpZGVyLCBXb3JrYmVuY2hQaGFzZS5CbG9ja1N0YXJ0dXApO1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKENlbGxJbmZvQ29udGVudFByb3ZpZGVyLklELCBDZWxsSW5mb0NvbnRlbnRQcm92aWRlciwgV29ya2JlbmNoUGhhc2UuQmxvY2tTdGFydHVwKTtcbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihOb3RlYm9va01ldGFkYXRhQ29udGVudFByb3ZpZGVyLklELCBOb3RlYm9va01ldGFkYXRhQ29udGVudFByb3ZpZGVyLCBXb3JrYmVuY2hQaGFzZS5CbG9ja1N0YXJ0dXApO1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKFJlZ2lzdGVyU2NoZW1hc0NvbnRyaWJ1dGlvbi5JRCwgUmVnaXN0ZXJTY2hlbWFzQ29udHJpYnV0aW9uLCBXb3JrYmVuY2hQaGFzZS5CbG9ja1N0YXJ0dXApO1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKE5vdGVib29rRWRpdG9yTWFuYWdlci5JRCwgTm90ZWJvb2tFZGl0b3JNYW5hZ2VyLCBXb3JrYmVuY2hQaGFzZS5CbG9ja1Jlc3RvcmUpO1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKE5vdGVib29rTGFuZ3VhZ2VTZWxlY3RvclNjb3JlUmVmaW5lLklELCBOb3RlYm9va0xhbmd1YWdlU2VsZWN0b3JTY29yZVJlZmluZSwgV29ya2JlbmNoUGhhc2UuQmxvY2tSZXN0b3JlKTtcbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihTaW1wbGVOb3RlYm9va1dvcmtpbmdDb3B5RWRpdG9ySGFuZGxlci5JRCwgU2ltcGxlTm90ZWJvb2tXb3JraW5nQ29weUVkaXRvckhhbmRsZXIsIFdvcmtiZW5jaFBoYXNlLkJsb2NrUmVzdG9yZSk7XG53b3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnkucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24oTm90ZWJvb2tWYXJpYWJsZXMsIExpZmVjeWNsZVBoYXNlLkV2ZW50dWFsbHkpO1xuXG5BY2Nlc3NpYmxlVmlld1JlZ2lzdHJ5LnJlZ2lzdGVyKG5ldyBOb3RlYm9va0FjY2Vzc2libGVWaWV3KCkpO1xuQWNjZXNzaWJsZVZpZXdSZWdpc3RyeS5yZWdpc3RlcihuZXcgTm90ZWJvb2tBY2Nlc3NpYmlsaXR5SGVscCgpKTtcblxucmVnaXN0ZXJTaW5nbGV0b24oSU5vdGVib29rU2VydmljZSwgTm90ZWJvb2tTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElOb3RlYm9va0VkaXRvcldvcmtlclNlcnZpY2UsIE5vdGVib29rRWRpdG9yV29ya2VyU2VydmljZUltcGwsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xucmVnaXN0ZXJTaW5nbGV0b24oSU5vdGVib29rRWRpdG9yTW9kZWxSZXNvbHZlclNlcnZpY2UsIE5vdGVib29rTW9kZWxSZXNvbHZlclNlcnZpY2VJbXBsLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElOb3RlYm9va0NlbGxTdGF0dXNCYXJTZXJ2aWNlLCBOb3RlYm9va0NlbGxTdGF0dXNCYXJTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElOb3RlYm9va0VkaXRvclNlcnZpY2UsIE5vdGVib29rRWRpdG9yV2lkZ2V0U2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG5yZWdpc3RlclNpbmdsZXRvbihJTm90ZWJvb2tLZXJuZWxTZXJ2aWNlLCBOb3RlYm9va0tlcm5lbFNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xucmVnaXN0ZXJTaW5nbGV0b24oSU5vdGVib29rS2VybmVsSGlzdG9yeVNlcnZpY2UsIE5vdGVib29rS2VybmVsSGlzdG9yeVNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xucmVnaXN0ZXJTaW5nbGV0b24oSU5vdGVib29rRXhlY3V0aW9uU2VydmljZSwgTm90ZWJvb2tFeGVjdXRpb25TZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSwgTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xucmVnaXN0ZXJTaW5nbGV0b24oSU5vdGVib29rUmVuZGVyZXJNZXNzYWdpbmdTZXJ2aWNlLCBOb3RlYm9va1JlbmRlcmVyTWVzc2FnaW5nU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG5yZWdpc3RlclNpbmdsZXRvbihJTm90ZWJvb2tLZXltYXBTZXJ2aWNlLCBOb3RlYm9va0tleW1hcFNlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xucmVnaXN0ZXJTaW5nbGV0b24oSU5vdGVib29rTG9nZ2luZ1NlcnZpY2UsIE5vdGVib29rTG9nZ2luZ1NlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkRlbGF5ZWQpO1xucmVnaXN0ZXJTaW5nbGV0b24oSU5vdGVib29rQ2VsbE91dGxpbmVEYXRhU291cmNlRmFjdG9yeSwgTm90ZWJvb2tDZWxsT3V0bGluZURhdGFTb3VyY2VGYWN0b3J5LCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbnJlZ2lzdGVyU2luZ2xldG9uKElOb3RlYm9va091dGxpbmVFbnRyeUZhY3RvcnksIE5vdGVib29rT3V0bGluZUVudHJ5RmFjdG9yeSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG5cbmNvbnN0IHNjaGVtYXM6IElKU09OU2NoZW1hTWFwID0ge307XG5mdW5jdGlvbiBpc0NvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSh4OiBJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hIHwgeyBbcGF0aDogc3RyaW5nXTogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSB9KTogeCBpcyBJQ29uZmlndXJhdGlvblByb3BlcnR5U2NoZW1hIHtcblx0cmV0dXJuICh0eXBlb2YgeC50eXBlICE9PSAndW5kZWZpbmVkJyB8fCB0eXBlb2YgeC5hbnlPZiAhPT0gJ3VuZGVmaW5lZCcpO1xufVxuZm9yIChjb25zdCBlZGl0b3JPcHRpb24gb2YgZWRpdG9yT3B0aW9uc1JlZ2lzdHJ5KSB7XG5cdGNvbnN0IHNjaGVtYSA9IGVkaXRvck9wdGlvbi5zY2hlbWE7XG5cdGlmIChzY2hlbWEpIHtcblx0XHRpZiAoaXNDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEoc2NoZW1hKSkge1xuXHRcdFx0c2NoZW1hc1tgZWRpdG9yLiR7ZWRpdG9yT3B0aW9uLm5hbWV9YF0gPSBzY2hlbWE7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGZvciAoY29uc3Qga2V5IGluIHNjaGVtYSkge1xuXHRcdFx0XHRpZiAoT2JqZWN0Lmhhc093blByb3BlcnR5LmNhbGwoc2NoZW1hLCBrZXkpKSB7XG5cdFx0XHRcdFx0c2NoZW1hc1trZXldID0gc2NoZW1hW2tleV07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cbn1cblxuY29uc3QgZWRpdG9yT3B0aW9uc0N1c3RvbWl6YXRpb25TY2hlbWE6IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgPSB7XG5cdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLmVkaXRvck9wdGlvbnMuZXhwZXJpbWVudGFsQ3VzdG9taXphdGlvbicsICdTZXR0aW5ncyBmb3IgY29kZSBlZGl0b3JzIHVzZWQgaW4gbm90ZWJvb2tzLiBUaGlzIGNhbiBiZSB1c2VkIHRvIGN1c3RvbWl6ZSBtb3N0IGVkaXRvci4qIHNldHRpbmdzLicpLFxuXHRkZWZhdWx0OiB7fSxcblx0YWxsT2Y6IFtcblx0XHR7XG5cdFx0XHRwcm9wZXJ0aWVzOiBzY2hlbWFzLFxuXHRcdH1cblx0XHQvLyAsIHtcblx0XHQvLyBcdHBhdHRlcm5Qcm9wZXJ0aWVzOiB7XG5cdFx0Ly8gXHRcdCdeXFxcXFsuKlxcXFxdJCc6IHtcblx0XHQvLyBcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHQvLyBcdFx0XHRkZWZhdWx0OiB7fSxcblx0XHQvLyBcdFx0XHRwcm9wZXJ0aWVzOiBzY2hlbWFzXG5cdFx0Ly8gXHRcdH1cblx0XHQvLyBcdH1cblx0XHQvLyB9XG5cdF0sXG5cdHRhZ3M6IFsnbm90ZWJvb2tMYXlvdXQnXVxufTtcblxuY29uc3QgY29uZmlndXJhdGlvblJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKTtcbmNvbmZpZ3VyYXRpb25SZWdpc3RyeS5yZWdpc3RlckNvbmZpZ3VyYXRpb24oe1xuXHRpZDogJ25vdGVib29rJyxcblx0b3JkZXI6IDEwMCxcblx0dGl0bGU6IG5scy5sb2NhbGl6ZSgnbm90ZWJvb2tDb25maWd1cmF0aW9uVGl0bGUnLCBcIk5vdGVib29rXCIpLFxuXHR0eXBlOiAnb2JqZWN0Jyxcblx0cHJvcGVydGllczoge1xuXHRcdFtOb3RlYm9va1NldHRpbmcuZGlzcGxheU9yZGVyXToge1xuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbm90ZWJvb2suZGlzcGxheU9yZGVyLmRlc2NyaXB0aW9uJywgXCJQcmlvcml0eSBsaXN0IGZvciBvdXRwdXQgbWltZSB0eXBlc1wiKSxcblx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRpdGVtczoge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0fSxcblx0XHRcdGRlZmF1bHQ6IFtdXG5cdFx0fSxcblx0XHRbTm90ZWJvb2tTZXR0aW5nLmNlbGxUb29sYmFyTG9jYXRpb25dOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdub3RlYm9vay5jZWxsVG9vbGJhckxvY2F0aW9uLmRlc2NyaXB0aW9uJywgXCJXaGVyZSB0aGUgY2VsbCB0b29sYmFyIHNob3VsZCBiZSBzaG93biwgb3Igd2hldGhlciBpdCBzaG91bGQgYmUgaGlkZGVuLlwiKSxcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IHtcblx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdub3RlYm9vay5jZWxsVG9vbGJhckxvY2F0aW9uLnZpZXdUeXBlJywgXCJDb25maWd1cmUgdGhlIGNlbGwgdG9vbGJhciBwb3NpdGlvbiBmb3IgZm9yIHNwZWNpZmljIGZpbGUgdHlwZXNcIiksXG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRlbnVtOiBbJ2xlZnQnLCAncmlnaHQnLCAnaGlkZGVuJ11cblx0XHRcdH0sXG5cdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdCdkZWZhdWx0JzogJ3JpZ2h0J1xuXHRcdFx0fSxcblx0XHRcdHRhZ3M6IFsnbm90ZWJvb2tMYXlvdXQnXVxuXHRcdH0sXG5cdFx0W05vdGVib29rU2V0dGluZy5zaG93Q2VsbFN0YXR1c0Jhcl06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLnNob3dDZWxsU3RhdHVzYmFyLmRlc2NyaXB0aW9uJywgXCJXaGV0aGVyIHRoZSBjZWxsIHN0YXR1cyBiYXIgc2hvdWxkIGJlIHNob3duLlwiKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydoaWRkZW4nLCAndmlzaWJsZScsICd2aXNpYmxlQWZ0ZXJFeGVjdXRlJ10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnbm90ZWJvb2suc2hvd0NlbGxTdGF0dXNiYXIuaGlkZGVuLmRlc2NyaXB0aW9uJywgXCJUaGUgY2VsbCBTdGF0dXMgYmFyIGlzIGFsd2F5cyBoaWRkZW4uXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ25vdGVib29rLnNob3dDZWxsU3RhdHVzYmFyLnZpc2libGUuZGVzY3JpcHRpb24nLCBcIlRoZSBjZWxsIFN0YXR1cyBiYXIgaXMgYWx3YXlzIHZpc2libGUuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ25vdGVib29rLnNob3dDZWxsU3RhdHVzYmFyLnZpc2libGVBZnRlckV4ZWN1dGUuZGVzY3JpcHRpb24nLCBcIlRoZSBjZWxsIFN0YXR1cyBiYXIgaXMgaGlkZGVuIHVudGlsIHRoZSBjZWxsIGhhcyBleGVjdXRlZC4gVGhlbiBpdCBiZWNvbWVzIHZpc2libGUgdG8gc2hvdyB0aGUgZXhlY3V0aW9uIHN0YXR1cy5cIildLFxuXHRcdFx0ZGVmYXVsdDogJ3Zpc2libGUnLFxuXHRcdFx0dGFnczogWydub3RlYm9va0xheW91dCddXG5cdFx0fSxcblx0XHRbTm90ZWJvb2tTZXR0aW5nLmNlbGxFeGVjdXRpb25UaW1lVmVyYm9zaXR5XToge1xuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbm90ZWJvb2suY2VsbEV4ZWN1dGlvblRpbWVWZXJib3NpdHkuZGVzY3JpcHRpb24nLCBcIkNvbnRyb2xzIHRoZSB2ZXJib3NpdHkgb2YgdGhlIGNlbGwgZXhlY3V0aW9uIHRpbWUgaW4gdGhlIGNlbGwgc3RhdHVzIGJhci5cIiksXG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnZGVmYXVsdCcsICd2ZXJib3NlJ10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnbm90ZWJvb2suY2VsbEV4ZWN1dGlvblRpbWVWZXJib3NpdHkuZGVmYXVsdC5kZXNjcmlwdGlvbicsIFwiVGhlIGNlbGwgZXhlY3V0aW9uIGR1cmF0aW9uIGlzIHZpc2libGUsIHdpdGggYWR2YW5jZWQgaW5mb3JtYXRpb24gaW4gdGhlIGhvdmVyIHRvb2x0aXAuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ25vdGVib29rLmNlbGxFeGVjdXRpb25UaW1lVmVyYm9zaXR5LnZlcmJvc2UuZGVzY3JpcHRpb24nLCBcIlRoZSBjZWxsIGxhc3QgZXhlY3V0aW9uIHRpbWVzdGFtcCBhbmQgZHVyYXRpb24gYXJlIHZpc2libGUsIHdpdGggYWR2YW5jZWQgaW5mb3JtYXRpb24gaW4gdGhlIGhvdmVyIHRvb2x0aXAuXCIpXSxcblx0XHRcdGRlZmF1bHQ6ICdkZWZhdWx0Jyxcblx0XHRcdHRhZ3M6IFsnbm90ZWJvb2tMYXlvdXQnXVxuXHRcdH0sXG5cdFx0W05vdGVib29rU2V0dGluZy50ZXh0RGlmZkVkaXRvclByZXZpZXddOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdub3RlYm9vay5kaWZmLmVuYWJsZVByZXZpZXcuZGVzY3JpcHRpb24nLCBcIldoZXRoZXIgdG8gdXNlIHRoZSBlbmhhbmNlZCB0ZXh0IGRpZmYgZWRpdG9yIGZvciBub3RlYm9vay5cIiksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0dGFnczogWydub3RlYm9va0xheW91dCddXG5cdFx0fSxcblx0XHRbTm90ZWJvb2tTZXR0aW5nLmRpZmZPdmVydmlld1J1bGVyXToge1xuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbm90ZWJvb2suZGlmZi5lbmFibGVPdmVydmlld1J1bGVyLmRlc2NyaXB0aW9uJywgXCJXaGV0aGVyIHRvIHJlbmRlciB0aGUgb3ZlcnZpZXcgcnVsZXIgaW4gdGhlIGRpZmYgZWRpdG9yIGZvciBub3RlYm9vay5cIiksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBmYWxzZSxcblx0XHRcdHRhZ3M6IFsnbm90ZWJvb2tMYXlvdXQnXVxuXHRcdH0sXG5cdFx0W05vdGVib29rU2V0dGluZy5jZWxsVG9vbGJhclZpc2liaWxpdHldOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLmNlbGxUb29sYmFyVmlzaWJpbGl0eS5kZXNjcmlwdGlvbicsIFwiV2hldGhlciB0aGUgY2VsbCB0b29sYmFyIHNob3VsZCBhcHBlYXIgb24gaG92ZXIgb3IgY2xpY2suXCIpLFxuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ2hvdmVyJywgJ2NsaWNrJ10sXG5cdFx0XHRkZWZhdWx0OiAnY2xpY2snLFxuXHRcdFx0dGFnczogWydub3RlYm9va0xheW91dCddXG5cdFx0fSxcblx0XHRbTm90ZWJvb2tTZXR0aW5nLnVuZG9SZWRvUGVyQ2VsbF06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLnVuZG9SZWRvUGVyQ2VsbC5kZXNjcmlwdGlvbicsIFwiV2hldGhlciB0byB1c2Ugc2VwYXJhdGUgdW5kby9yZWRvIHN0YWNrIGZvciBlYWNoIGNlbGwuXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHRhZ3M6IFsnbm90ZWJvb2tMYXlvdXQnXVxuXHRcdH0sXG5cdFx0W05vdGVib29rU2V0dGluZy5jb21wYWN0Vmlld106IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLmNvbXBhY3RWaWV3LmRlc2NyaXB0aW9uJywgXCJDb250cm9sIHdoZXRoZXIgdGhlIG5vdGVib29rIGVkaXRvciBzaG91bGQgYmUgcmVuZGVyZWQgaW4gYSBjb21wYWN0IGZvcm0uIEZvciBleGFtcGxlLCB3aGVuIHR1cm5lZCBvbiwgaXQgd2lsbCBkZWNyZWFzZSB0aGUgbGVmdCBtYXJnaW4gd2lkdGguXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHRhZ3M6IFsnbm90ZWJvb2tMYXlvdXQnXVxuXHRcdH0sXG5cdFx0W05vdGVib29rU2V0dGluZy5mb2N1c0luZGljYXRvcl06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLmZvY3VzSW5kaWNhdG9yLmRlc2NyaXB0aW9uJywgXCJDb250cm9scyB3aGVyZSB0aGUgZm9jdXMgaW5kaWNhdG9yIGlzIHJlbmRlcmVkLCBlaXRoZXIgYWxvbmcgdGhlIGNlbGwgYm9yZGVycyBvciBvbiB0aGUgbGVmdCBndXR0ZXIuXCIpLFxuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ2JvcmRlcicsICdndXR0ZXInXSxcblx0XHRcdGRlZmF1bHQ6ICdndXR0ZXInLFxuXHRcdFx0dGFnczogWydub3RlYm9va0xheW91dCddXG5cdFx0fSxcblx0XHRbTm90ZWJvb2tTZXR0aW5nLmluc2VydFRvb2xiYXJMb2NhdGlvbl06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLmluc2VydFRvb2xiYXJQb3NpdGlvbi5kZXNjcmlwdGlvbicsIFwiQ29udHJvbCB3aGVyZSB0aGUgaW5zZXJ0IGNlbGwgYWN0aW9ucyBzaG91bGQgYXBwZWFyLlwiKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydiZXR3ZWVuQ2VsbHMnLCAnbm90ZWJvb2tUb29sYmFyJywgJ2JvdGgnLCAnaGlkZGVuJ10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnaW5zZXJ0VG9vbGJhckxvY2F0aW9uLmJldHdlZW5DZWxscycsIFwiQSB0b29sYmFyIHRoYXQgYXBwZWFycyBvbiBob3ZlciBiZXR3ZWVuIGNlbGxzLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdpbnNlcnRUb29sYmFyTG9jYXRpb24ubm90ZWJvb2tUb29sYmFyJywgXCJUaGUgdG9vbGJhciBhdCB0aGUgdG9wIG9mIHRoZSBub3RlYm9vayBlZGl0b3IuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ2luc2VydFRvb2xiYXJMb2NhdGlvbi5ib3RoJywgXCJCb3RoIHRvb2xiYXJzLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdpbnNlcnRUb29sYmFyTG9jYXRpb24uaGlkZGVuJywgXCJUaGUgaW5zZXJ0IGFjdGlvbnMgZG9uJ3QgYXBwZWFyIGFueXdoZXJlLlwiKSxcblx0XHRcdF0sXG5cdFx0XHRkZWZhdWx0OiAnYm90aCcsXG5cdFx0XHR0YWdzOiBbJ25vdGVib29rTGF5b3V0J11cblx0XHR9LFxuXHRcdFtOb3RlYm9va1NldHRpbmcuZ2xvYmFsVG9vbGJhcl06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLmdsb2JhbFRvb2xiYXIuZGVzY3JpcHRpb24nLCBcIkNvbnRyb2wgd2hldGhlciB0byByZW5kZXIgYSBnbG9iYWwgdG9vbGJhciBpbnNpZGUgdGhlIG5vdGVib29rIGVkaXRvci5cIiksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0dGFnczogWydub3RlYm9va0xheW91dCddXG5cdFx0fSxcblx0XHRbTm90ZWJvb2tTZXR0aW5nLnN0aWNreVNjcm9sbEVuYWJsZWRdOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdub3RlYm9vay5zdGlja3lTY3JvbGxFbmFibGVkLmRlc2NyaXB0aW9uJywgXCJFeHBlcmltZW50YWwuIENvbnRyb2wgd2hldGhlciB0byByZW5kZXIgbm90ZWJvb2sgU3RpY2t5IFNjcm9sbCBoZWFkZXJzIGluIHRoZSBub3RlYm9vayBlZGl0b3IuXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2UsXG5cdFx0XHR0YWdzOiBbJ25vdGVib29rTGF5b3V0J11cblx0XHR9LFxuXHRcdFtOb3RlYm9va1NldHRpbmcuc3RpY2t5U2Nyb2xsTW9kZV06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLnN0aWNreVNjcm9sbE1vZGUuZGVzY3JpcHRpb24nLCBcIkNvbnRyb2wgd2hldGhlciBuZXN0ZWQgc3RpY2t5IGxpbmVzIGFwcGVhciB0byBzdGFjayBmbGF0IG9yIGluZGVudGVkLlwiKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydmbGF0JywgJ2luZGVudGVkJ10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnbm90ZWJvb2suc3RpY2t5U2Nyb2xsTW9kZS5mbGF0JywgXCJOZXN0ZWQgc3RpY2t5IGxpbmVzIGFwcGVhciBmbGF0LlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdub3RlYm9vay5zdGlja3lTY3JvbGxNb2RlLmluZGVudGVkJywgXCJOZXN0ZWQgc3RpY2t5IGxpbmVzIGFwcGVhciBpbmRlbnRlZC5cIiksXG5cdFx0XHRdLFxuXHRcdFx0ZGVmYXVsdDogJ2luZGVudGVkJyxcblx0XHRcdHRhZ3M6IFsnbm90ZWJvb2tMYXlvdXQnXVxuXHRcdH0sXG5cdFx0W05vdGVib29rU2V0dGluZy5jb25zb2xpZGF0ZWRPdXRwdXRCdXR0b25dOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdub3RlYm9vay5jb25zb2xpZGF0ZWRPdXRwdXRCdXR0b24uZGVzY3JpcHRpb24nLCBcIkNvbnRyb2wgd2hldGhlciBvdXRwdXRzIGFjdGlvbiBzaG91bGQgYmUgcmVuZGVyZWQgaW4gdGhlIG91dHB1dCB0b29sYmFyLlwiKSxcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWUsXG5cdFx0XHR0YWdzOiBbJ25vdGVib29rTGF5b3V0J11cblx0XHR9LFxuXHRcdFtOb3RlYm9va1NldHRpbmcuc2hvd0ZvbGRpbmdDb250cm9sc106IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLnNob3dGb2xkaW5nQ29udHJvbHMuZGVzY3JpcHRpb24nLCBcIkNvbnRyb2xzIHdoZW4gdGhlIE1hcmtkb3duIGhlYWRlciBmb2xkaW5nIGFycm93IGlzIHNob3duLlwiKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydhbHdheXMnLCAnbmV2ZXInLCAnbW91c2VvdmVyJ10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2hvd0ZvbGRpbmdDb250cm9scy5hbHdheXMnLCBcIlRoZSBmb2xkaW5nIGNvbnRyb2xzIGFyZSBhbHdheXMgdmlzaWJsZS5cIiksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2hvd0ZvbGRpbmdDb250cm9scy5uZXZlcicsIFwiTmV2ZXIgc2hvdyB0aGUgZm9sZGluZyBjb250cm9scyBhbmQgcmVkdWNlIHRoZSBndXR0ZXIgc2l6ZS5cIiksXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2hvd0ZvbGRpbmdDb250cm9scy5tb3VzZW92ZXInLCBcIlRoZSBmb2xkaW5nIGNvbnRyb2xzIGFyZSB2aXNpYmxlIG9ubHkgb24gbW91c2VvdmVyLlwiKSxcblx0XHRcdF0sXG5cdFx0XHRkZWZhdWx0OiAnbW91c2VvdmVyJyxcblx0XHRcdHRhZ3M6IFsnbm90ZWJvb2tMYXlvdXQnXVxuXHRcdH0sXG5cdFx0W05vdGVib29rU2V0dGluZy5kcmFnQW5kRHJvcEVuYWJsZWRdOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdub3RlYm9vay5kcmFnQW5kRHJvcC5kZXNjcmlwdGlvbicsIFwiQ29udHJvbCB3aGV0aGVyIHRoZSBub3RlYm9vayBlZGl0b3Igc2hvdWxkIGFsbG93IG1vdmluZyBjZWxscyB0aHJvdWdoIGRyYWcgYW5kIGRyb3AuXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZSxcblx0XHRcdHRhZ3M6IFsnbm90ZWJvb2tMYXlvdXQnXVxuXHRcdH0sXG5cdFx0W05vdGVib29rU2V0dGluZy5jb25zb2xpZGF0ZWRSdW5CdXR0b25dOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdub3RlYm9vay5jb25zb2xpZGF0ZWRSdW5CdXR0b24uZGVzY3JpcHRpb24nLCBcIkNvbnRyb2wgd2hldGhlciBleHRyYSBhY3Rpb25zIGFyZSBzaG93biBpbiBhIGRyb3Bkb3duIG5leHQgdG8gdGhlIHJ1biBidXR0b24uXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2UsXG5cdFx0XHR0YWdzOiBbJ25vdGVib29rTGF5b3V0J11cblx0XHR9LFxuXHRcdFtOb3RlYm9va1NldHRpbmcuZ2xvYmFsVG9vbGJhclNob3dMYWJlbF06IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLmdsb2JhbFRvb2xiYXJTaG93TGFiZWwnLCBcIkNvbnRyb2wgd2hldGhlciB0aGUgYWN0aW9ucyBvbiB0aGUgbm90ZWJvb2sgdG9vbGJhciBzaG91bGQgcmVuZGVyIGxhYmVsIG9yIG5vdC5cIiksXG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGVudW06IFsnYWx3YXlzJywgJ25ldmVyJywgJ2R5bmFtaWMnXSxcblx0XHRcdGRlZmF1bHQ6ICdhbHdheXMnLFxuXHRcdFx0dGFnczogWydub3RlYm9va0xheW91dCddXG5cdFx0fSxcblx0XHRbTm90ZWJvb2tTZXR0aW5nLnRleHRPdXRwdXRMaW5lTGltaXRdOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLnRleHRPdXRwdXRMaW5lTGltaXQnLCBcIkNvbnRyb2xzIGhvdyBtYW55IGxpbmVzIG9mIHRleHQgYXJlIGRpc3BsYXllZCBpbiBhIHRleHQgb3V0cHV0LiBJZiB7MH0gaXMgZW5hYmxlZCwgdGhpcyBzZXR0aW5nIGlzIHVzZWQgdG8gZGV0ZXJtaW5lIHRoZSBzY3JvbGwgaGVpZ2h0IG9mIHRoZSBvdXRwdXQuXCIsICdgI25vdGVib29rLm91dHB1dC5zY3JvbGxpbmcjYCcpLFxuXHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRkZWZhdWx0OiAzMCxcblx0XHRcdHRhZ3M6IFsnbm90ZWJvb2tMYXlvdXQnLCAnbm90ZWJvb2tPdXRwdXRMYXlvdXQnXSxcblx0XHRcdG1pbmltdW06IDEsXG5cdFx0fSxcblx0XHRbTm90ZWJvb2tTZXR0aW5nLkxpbmtpZnlPdXRwdXRGaWxlUGF0aHNdOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdub3RlYm9vay5kaXNhYmxlT3V0cHV0RmlsZVBhdGhMaW5rcycsIFwiQ29udHJvbCB3aGV0aGVyIHRvIGRpc2FibGUgZmlsZXBhdGggbGlua3MgaW4gdGhlIG91dHB1dCBvZiBub3RlYm9vayBjZWxscy5cIiksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0cnVlLFxuXHRcdFx0dGFnczogWydub3RlYm9va091dHB1dExheW91dCddXG5cdFx0fSxcblx0XHRbTm90ZWJvb2tTZXR0aW5nLm1pbmltYWxFcnJvclJlbmRlcmluZ106IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLm1pbmltYWxFcnJvclJlbmRlcmluZycsIFwiQ29udHJvbCB3aGV0aGVyIHRvIHJlbmRlciBlcnJvciBvdXRwdXQgaW4gYSBtaW5pbWFsIHN0eWxlLlwiKSxcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlLFxuXHRcdFx0dGFnczogWydub3RlYm9va091dHB1dExheW91dCddXG5cdFx0fSxcblx0XHRbTm90ZWJvb2tTZXR0aW5nLm1hcmt1cEZvbnRTaXplXToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdub3RlYm9vay5tYXJrdXAuZm9udFNpemUnLCBcIkNvbnRyb2xzIHRoZSBmb250IHNpemUgaW4gcGl4ZWxzIG9mIHJlbmRlcmVkIG1hcmt1cCBpbiBub3RlYm9va3MuIFdoZW4gc2V0IHRvIHswfSwgMTIwJSBvZiB7MX0gaXMgdXNlZC5cIiwgJ2AwYCcsICdgI2VkaXRvci5mb250U2l6ZSNgJyksXG5cdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdGRlZmF1bHQ6IDAsXG5cdFx0XHR0YWdzOiBbJ25vdGVib29rTGF5b3V0J11cblx0XHR9LFxuXHRcdFtOb3RlYm9va1NldHRpbmcubWFya2Rvd25MaW5lSGVpZ2h0XToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdub3RlYm9vay5tYXJrZG93bi5saW5lSGVpZ2h0JywgXCJDb250cm9scyB0aGUgbGluZSBoZWlnaHQgaW4gcGl4ZWxzIG9mIG1hcmtkb3duIGNlbGxzIGluIG5vdGVib29rcy4gV2hlbiBzZXQgdG8gezB9LCB7MX0gd2lsbCBiZSB1c2VkXCIsICdgMGAnLCAnYG5vcm1hbGAnKSxcblx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0ZGVmYXVsdDogMCxcblx0XHRcdHRhZ3M6IFsnbm90ZWJvb2tMYXlvdXQnXVxuXHRcdH0sXG5cdFx0W05vdGVib29rU2V0dGluZy5jZWxsRWRpdG9yT3B0aW9uc0N1c3RvbWl6YXRpb25zXTogZWRpdG9yT3B0aW9uc0N1c3RvbWl6YXRpb25TY2hlbWEsXG5cdFx0W05vdGVib29rU2V0dGluZy5pbnRlcmFjdGl2ZVdpbmRvd0NvbGxhcHNlQ29kZUNlbGxzXToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdub3RlYm9vay5pbnRlcmFjdGl2ZVdpbmRvdy5jb2xsYXBzZUNvZGVDZWxscycsIFwiQ29udHJvbHMgd2hldGhlciBjb2RlIGNlbGxzIGluIHRoZSBpbnRlcmFjdGl2ZSB3aW5kb3cgYXJlIGNvbGxhcHNlZCBieSBkZWZhdWx0LlwiKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZW51bTogWydhbHdheXMnLCAnbmV2ZXInLCAnZnJvbUVkaXRvciddLFxuXHRcdFx0ZGVmYXVsdDogJ2Zyb21FZGl0b3InXG5cdFx0fSxcblx0XHRbTm90ZWJvb2tTZXR0aW5nLm91dHB1dExpbmVIZWlnaHRdOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLm91dHB1dExpbmVIZWlnaHQnLCBcIkxpbmUgaGVpZ2h0IG9mIHRoZSBvdXRwdXQgdGV4dCB3aXRoaW4gbm90ZWJvb2sgY2VsbHMuXFxuIC0gV2hlbiBzZXQgdG8gMCwgZWRpdG9yIGxpbmUgaGVpZ2h0IGlzIHVzZWQuXFxuIC0gVmFsdWVzIGJldHdlZW4gMCBhbmQgOCB3aWxsIGJlIHVzZWQgYXMgYSBtdWx0aXBsaWVyIHdpdGggdGhlIGZvbnQgc2l6ZS5cXG4gLSBWYWx1ZXMgZ3JlYXRlciB0aGFuIG9yIGVxdWFsIHRvIDggd2lsbCBiZSB1c2VkIGFzIGVmZmVjdGl2ZSB2YWx1ZXMuXCIpLFxuXHRcdFx0dHlwZTogJ251bWJlcicsXG5cdFx0XHRkZWZhdWx0OiAwLFxuXHRcdFx0dGFnczogWydub3RlYm9va0xheW91dCcsICdub3RlYm9va091dHB1dExheW91dCddXG5cdFx0fSxcblx0XHRbTm90ZWJvb2tTZXR0aW5nLm91dHB1dEZvbnRTaXplXToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdub3RlYm9vay5vdXRwdXRGb250U2l6ZScsIFwiRm9udCBzaXplIGZvciB0aGUgb3V0cHV0IHRleHQgd2l0aGluIG5vdGVib29rIGNlbGxzLiBXaGVuIHNldCB0byAwLCB7MH0gaXMgdXNlZC5cIiwgJ2AjZWRpdG9yLmZvbnRTaXplI2AnKSxcblx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0ZGVmYXVsdDogMCxcblx0XHRcdHRhZ3M6IFsnbm90ZWJvb2tMYXlvdXQnLCAnbm90ZWJvb2tPdXRwdXRMYXlvdXQnXVxuXHRcdH0sXG5cdFx0W05vdGVib29rU2V0dGluZy5vdXRwdXRGb250RmFtaWx5XToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdub3RlYm9vay5vdXRwdXRGb250RmFtaWx5JywgXCJUaGUgZm9udCBmYW1pbHkgb2YgdGhlIG91dHB1dCB0ZXh0IHdpdGhpbiBub3RlYm9vayBjZWxscy4gV2hlbiBzZXQgdG8gZW1wdHksIHRoZSB7MH0gaXMgdXNlZC5cIiwgJ2AjZWRpdG9yLmZvbnRGYW1pbHkjYCcpLFxuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHR0YWdzOiBbJ25vdGVib29rTGF5b3V0JywgJ25vdGVib29rT3V0cHV0TGF5b3V0J11cblx0XHR9LFxuXHRcdFtOb3RlYm9va1NldHRpbmcub3V0cHV0U2Nyb2xsaW5nXToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdub3RlYm9vay5vdXRwdXRTY3JvbGxpbmcnLCBcIkluaXRpYWxseSByZW5kZXIgbm90ZWJvb2sgb3V0cHV0cyBpbiBhIHNjcm9sbGFibGUgcmVnaW9uIHdoZW4gbG9uZ2VyIHRoYW4gdGhlIGxpbWl0LlwiKSxcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdHRhZ3M6IFsnbm90ZWJvb2tMYXlvdXQnLCAnbm90ZWJvb2tPdXRwdXRMYXlvdXQnXSxcblx0XHRcdGRlZmF1bHQ6IHR5cGVvZiBwcm9kdWN0LnF1YWxpdHkgPT09ICdzdHJpbmcnICYmIHByb2R1Y3QucXVhbGl0eSAhPT0gJ3N0YWJsZScgLy8gb25seSBlbmFibGUgYXMgZGVmYXVsdCBpbiBpbnNpZGVyc1xuXHRcdH0sXG5cdFx0W05vdGVib29rU2V0dGluZy5vdXRwdXRXb3JkV3JhcF06IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbm90ZWJvb2sub3V0cHV0V29yZFdyYXAnLCBcIkNvbnRyb2xzIHdoZXRoZXIgdGhlIGxpbmVzIGluIG91dHB1dCBzaG91bGQgd3JhcC5cIiksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHR0YWdzOiBbJ25vdGVib29rTGF5b3V0JywgJ25vdGVib29rT3V0cHV0TGF5b3V0J10sXG5cdFx0XHRkZWZhdWx0OiBmYWxzZVxuXHRcdH0sXG5cdFx0W05vdGVib29rU2V0dGluZy5kZWZhdWx0Rm9ybWF0dGVyXToge1xuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbm90ZWJvb2tGb3JtYXR0ZXIuZGVmYXVsdCcsIFwiRGVmaW5lcyBhIGRlZmF1bHQgbm90ZWJvb2sgZm9ybWF0dGVyIHdoaWNoIHRha2VzIHByZWNlZGVuY2Ugb3ZlciBhbGwgb3RoZXIgZm9ybWF0dGVyIHNldHRpbmdzLiBNdXN0IGJlIHRoZSBpZGVudGlmaWVyIG9mIGFuIGV4dGVuc2lvbiBjb250cmlidXRpbmcgYSBmb3JtYXR0ZXIuXCIpLFxuXHRcdFx0dHlwZTogWydzdHJpbmcnLCAnbnVsbCddLFxuXHRcdFx0ZGVmYXVsdDogbnVsbCxcblx0XHRcdGVudW06IERlZmF1bHRGb3JtYXR0ZXIuZXh0ZW5zaW9uSWRzLFxuXHRcdFx0ZW51bUl0ZW1MYWJlbHM6IERlZmF1bHRGb3JtYXR0ZXIuZXh0ZW5zaW9uSXRlbUxhYmVscyxcblx0XHRcdG1hcmtkb3duRW51bURlc2NyaXB0aW9uczogRGVmYXVsdEZvcm1hdHRlci5leHRlbnNpb25EZXNjcmlwdGlvbnNcblx0XHR9LFxuXHRcdFtOb3RlYm9va1NldHRpbmcuZm9ybWF0T25TYXZlXToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdub3RlYm9vay5mb3JtYXRPblNhdmUnLCBcIkZvcm1hdCBhIG5vdGVib29rIG9uIHNhdmUuIEEgZm9ybWF0dGVyIG11c3QgYmUgYXZhaWxhYmxlIGFuZCB0aGUgZWRpdG9yIG11c3Qgbm90IGJlIHNodXR0aW5nIGRvd24uIFdoZW4gezB9IGlzIHNldCB0byBgYWZ0ZXJEZWxheWAsIHRoZSBmaWxlIHdpbGwgb25seSBiZSBmb3JtYXR0ZWQgd2hlbiBzYXZlZCBleHBsaWNpdGx5LlwiLCAnYCNmaWxlcy5hdXRvU2F2ZSNgJyksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHR0YWdzOiBbJ25vdGVib29rTGF5b3V0J10sXG5cdFx0XHRkZWZhdWx0OiBmYWxzZVxuXHRcdH0sXG5cdFx0W05vdGVib29rU2V0dGluZy5pbnNlcnRGaW5hbE5ld2xpbmVdOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLmluc2VydEZpbmFsTmV3bGluZScsIFwiV2hlbiBlbmFibGVkLCBpbnNlcnQgYSBmaW5hbCBuZXcgbGluZSBpbnRvIHRoZSBlbmQgb2YgY29kZSBjZWxscyB3aGVuIHNhdmluZyBhIG5vdGVib29rLlwiKSxcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdHRhZ3M6IFsnbm90ZWJvb2tMYXlvdXQnXSxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlXG5cdFx0fSxcblx0XHRbTm90ZWJvb2tTZXR0aW5nLmZvcm1hdE9uQ2VsbEV4ZWN1dGlvbl06IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbm90ZWJvb2suZm9ybWF0T25DZWxsRXhlY3V0aW9uJywgXCJGb3JtYXQgYSBub3RlYm9vayBjZWxsIHVwb24gZXhlY3V0aW9uLiBBIGZvcm1hdHRlciBtdXN0IGJlIGF2YWlsYWJsZS5cIiksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBmYWxzZVxuXHRcdH0sXG5cdFx0W05vdGVib29rU2V0dGluZy5jb25maXJtRGVsZXRlUnVubmluZ0NlbGxdOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLmNvbmZpcm1EZWxldGVSdW5uaW5nQ2VsbCcsIFwiQ29udHJvbCB3aGV0aGVyIGEgY29uZmlybWF0aW9uIHByb21wdCBpcyByZXF1aXJlZCB0byBkZWxldGUgYSBydW5uaW5nIGNlbGwuXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdH0sXG5cdFx0W05vdGVib29rU2V0dGluZy5maW5kRmlsdGVyc106IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbm90ZWJvb2suZmluZEZpbHRlcnMnLCBcIkN1c3RvbWl6ZSB0aGUgRmluZCBXaWRnZXQgYmVoYXZpb3IgZm9yIHNlYXJjaGluZyB3aXRoaW4gbm90ZWJvb2sgY2VsbHMuIFdoZW4gYm90aCBtYXJrdXAgc291cmNlIGFuZCBtYXJrdXAgcHJldmlldyBhcmUgZW5hYmxlZCwgdGhlIEZpbmQgV2lkZ2V0IHdpbGwgc2VhcmNoIGVpdGhlciB0aGUgc291cmNlIGNvZGUgb3IgcHJldmlldyBiYXNlZCBvbiB0aGUgY3VycmVudCBzdGF0ZSBvZiB0aGUgY2VsbC5cIiksXG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0bWFya3VwU291cmNlOiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHRcdFx0fSxcblx0XHRcdFx0bWFya3VwUHJldmlldzoge1xuXHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRkZWZhdWx0OiB0cnVlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNvZGVTb3VyY2U6IHtcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRjb2RlT3V0cHV0OiB7XG5cdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGRlZmF1bHQ6IHtcblx0XHRcdFx0bWFya3VwU291cmNlOiB0cnVlLFxuXHRcdFx0XHRtYXJrdXBQcmV2aWV3OiB0cnVlLFxuXHRcdFx0XHRjb2RlU291cmNlOiB0cnVlLFxuXHRcdFx0XHRjb2RlT3V0cHV0OiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0dGFnczogWydub3RlYm9va0xheW91dCddXG5cdFx0fSxcblx0XHRbTm90ZWJvb2tTZXR0aW5nLnJlbW90ZVNhdmluZ106IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbm90ZWJvb2sucmVtb3RlU2F2aW5nJywgXCJFbmFibGVzIHRoZSBpbmNyZW1lbnRhbCBzYXZpbmcgb2Ygbm90ZWJvb2tzIGJldHdlZW4gcHJvY2Vzc2VzIGFuZCBhY3Jvc3MgUmVtb3RlIGNvbm5lY3Rpb25zLiBXaGVuIGVuYWJsZWQsIG9ubHkgdGhlIGNoYW5nZXMgdG8gdGhlIG5vdGVib29rIGFyZSBzZW50IHRvIHRoZSBleHRlbnNpb24gaG9zdCwgaW1wcm92aW5nIHBlcmZvcm1hbmNlIGZvciBsYXJnZSBub3RlYm9va3MgYW5kIHNsb3cgbmV0d29yayBjb25uZWN0aW9ucy5cIiksXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiB0eXBlb2YgcHJvZHVjdC5xdWFsaXR5ID09PSAnc3RyaW5nJyAmJiBwcm9kdWN0LnF1YWxpdHkgIT09ICdzdGFibGUnLCAvLyBvbmx5IGVuYWJsZSBhcyBkZWZhdWx0IGluIGluc2lkZXJzXG5cdFx0XHR0YWdzOiBbJ2V4cGVyaW1lbnRhbCddXG5cdFx0fSxcblx0XHRbTm90ZWJvb2tTZXR0aW5nLnNjcm9sbFRvUmV2ZWFsQ2VsbF06IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbm90ZWJvb2suc2Nyb2xsaW5nLnJldmVhbE5leHRDZWxsT25FeGVjdXRlLmRlc2NyaXB0aW9uJywgXCJIb3cgZmFyIHRvIHNjcm9sbCB3aGVuIHJldmVhbGluZyB0aGUgbmV4dCBjZWxsIHVwb24gcnVubmluZyB7MH0uXCIsICdub3RlYm9vay5jZWxsLmV4ZWN1dGVBbmRTZWxlY3RCZWxvdycpLFxuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ2Z1bGxDZWxsJywgJ2ZpcnN0TGluZScsICdub25lJ10sXG5cdFx0XHRtYXJrZG93bkVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdub3RlYm9vay5zY3JvbGxpbmcucmV2ZWFsTmV4dENlbGxPbkV4ZWN1dGUuZnVsbENlbGwuZGVzY3JpcHRpb24nLCAnU2Nyb2xsIHRvIGZ1bGx5IHJldmVhbCB0aGUgbmV4dCBjZWxsLicpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ25vdGVib29rLnNjcm9sbGluZy5yZXZlYWxOZXh0Q2VsbE9uRXhlY3V0ZS5maXJzdExpbmUuZGVzY3JpcHRpb24nLCAnU2Nyb2xsIHRvIHJldmVhbCB0aGUgZmlyc3QgbGluZSBvZiB0aGUgbmV4dCBjZWxsLicpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ25vdGVib29rLnNjcm9sbGluZy5yZXZlYWxOZXh0Q2VsbE9uRXhlY3V0ZS5ub25lLmRlc2NyaXB0aW9uJywgJ0RvIG5vdCBzY3JvbGwuJyksXG5cdFx0XHRdLFxuXHRcdFx0ZGVmYXVsdDogJ2Z1bGxDZWxsJ1xuXHRcdH0sXG5cdFx0W05vdGVib29rU2V0dGluZy5jZWxsR2VuZXJhdGVdOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLmNlbGxHZW5lcmF0ZScsIFwiRW5hYmxlIGV4cGVyaW1lbnRhbCBnZW5lcmF0ZSBhY3Rpb24gdG8gY3JlYXRlIGNvZGUgY2VsbCB3aXRoIGlubGluZSBjaGF0IGVuYWJsZWQuXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdH0sXG5cdFx0W05vdGVib29rU2V0dGluZy5ub3RlYm9va1ZhcmlhYmxlc1ZpZXddOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLlZhcmlhYmxlc1ZpZXcuZGVzY3JpcHRpb24nLCBcIkVuYWJsZSB0aGUgZXhwZXJpbWVudGFsIG5vdGVib29rIHZhcmlhYmxlcyB2aWV3IHdpdGhpbiB0aGUgZGVidWcgcGFuZWwuXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHR9LFxuXHRcdFtOb3RlYm9va1NldHRpbmcubm90ZWJvb2tJbmxpbmVWYWx1ZXNdOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLmlubGluZVZhbHVlcy5kZXNjcmlwdGlvbicsIFwiQ29udHJvbCB3aGV0aGVyIHRvIHNob3cgaW5saW5lIHZhbHVlcyB3aXRoaW4gbm90ZWJvb2sgY29kZSBjZWxscyBhZnRlciBjZWxsIGV4ZWN1dGlvbi4gVmFsdWVzIHdpbGwgcmVtYWluIHVudGlsIHRoZSBjZWxsIGlzIGVkaXRlZCwgcmUtZXhlY3V0ZWQsIG9yIGV4cGxpY2l0bHkgY2xlYXJlZCB2aWEgdGhlIENsZWFyIEFsbCBPdXRwdXRzIHRvb2xiYXIgYnV0dG9uIG9yIHRoZSBgTm90ZWJvb2s6IENsZWFyIElubGluZSBWYWx1ZXNgIGNvbW1hbmQuXCIpLFxuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ29uJywgJ2F1dG8nLCAnb2ZmJ10sXG5cdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdG5scy5sb2NhbGl6ZSgnbm90ZWJvb2suaW5saW5lVmFsdWVzLm9uJywgXCJBbHdheXMgc2hvdyBpbmxpbmUgdmFsdWVzLCB3aXRoIGEgcmVnZXggZmFsbGJhY2sgaWYgbm8gaW5saW5lIHZhbHVlIHByb3ZpZGVyIGlzIHJlZ2lzdGVyZWQuIE5vdGU6IFRoZXJlIG1heSBiZSBhIHBlcmZvcm1hbmNlIGltcGFjdCBpbiBsYXJnZXIgY2VsbHMgaWYgdGhlIGZhbGxiYWNrIGlzIHVzZWQuXCIpLFxuXHRcdFx0XHRubHMubG9jYWxpemUoJ25vdGVib29rLmlubGluZVZhbHVlcy5hdXRvJywgXCJTaG93IGlubGluZSB2YWx1ZXMgb25seSB3aGVuIGFuIGlubGluZSB2YWx1ZSBwcm92aWRlciBpcyByZWdpc3RlcmVkLlwiKSxcblx0XHRcdFx0bmxzLmxvY2FsaXplKCdub3RlYm9vay5pbmxpbmVWYWx1ZXMub2ZmJywgXCJOZXZlciBzaG93IGlubGluZSB2YWx1ZXMuXCIpLFxuXHRcdFx0XSxcblx0XHRcdGRlZmF1bHQ6ICdvZmYnXG5cdFx0fSxcblx0XHRbTm90ZWJvb2tTZXR0aW5nLmNlbGxGYWlsdXJlRGlhZ25vc3RpY3NdOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLmNlbGxGYWlsdXJlRGlhZ25vc3RpY3MnLCBcIlNob3cgYXZhaWxhYmxlIGRpYWdub3N0aWNzIGZvciBjZWxsIGZhaWx1cmVzLlwiKSxcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHR9LFxuXHRcdFtOb3RlYm9va1NldHRpbmcub3V0cHV0QmFja3VwU2l6ZUxpbWl0XToge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdub3RlYm9vay5iYWNrdXAuc2l6ZUxpbWl0JywgXCJUaGUgbGltaXQgb2Ygbm90ZWJvb2sgb3V0cHV0IHNpemUgaW4ga2lsb2J5dGVzIChLQikgd2hlcmUgbm90ZWJvb2sgZmlsZXMgd2lsbCBubyBsb25nZXIgYmUgYmFja2VkIHVwIGZvciBob3QgcmVsb2FkLiBVc2UgMCBmb3IgdW5saW1pdGVkLlwiKSxcblx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0ZGVmYXVsdDogMTAwMDBcblx0XHR9LFxuXHRcdFtOb3RlYm9va1NldHRpbmcubXVsdGlDdXJzb3JdOiB7XG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ25vdGVib29rLm11bHRpQ3Vyc29yLmVuYWJsZWQnLCBcIkV4cGVyaW1lbnRhbC4gRW5hYmxlcyBhIGxpbWl0ZWQgc2V0IG9mIG11bHRpIGN1cnNvciBjb250cm9scyBhY3Jvc3MgbXVsdGlwbGUgY2VsbHMgaW4gdGhlIG5vdGVib29rIGVkaXRvci4gQ3VycmVudGx5IHN1cHBvcnRlZCBhcmUgY29yZSBlZGl0b3IgYWN0aW9ucyAodHlwaW5nL2N1dC9jb3B5L3Bhc3RlL2NvbXBvc2l0aW9uKSBhbmQgYSBsaW1pdGVkIHN1YnNldCBvZiBlZGl0b3IgY29tbWFuZHMuXCIpLFxuXHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHR9LFxuXHRcdFtOb3RlYm9va1NldHRpbmcubWFya3VwRm9udEZhbWlseV06IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnbm90ZWJvb2subWFya3VwLmZvbnRGYW1pbHknLCBcIkNvbnRyb2xzIHRoZSBmb250IGZhbWlseSBvZiByZW5kZXJlZCBtYXJrdXAgaW4gbm90ZWJvb2tzLiBXaGVuIGxlZnQgYmxhbmssIHRoaXMgd2lsbCBmYWxsIGJhY2sgdG8gdGhlIGRlZmF1bHQgd29ya2JlbmNoIGZvbnQgZmFtaWx5LlwiKSxcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZGVmYXVsdDogJycsXG5cdFx0XHR0YWdzOiBbJ25vdGVib29rTGF5b3V0J11cblx0XHR9XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGVBQWU7QUFDeEIsU0FBc0IsWUFBWSxpQkFBaUIsZUFBZTtBQUNsRSxTQUFTLGFBQWE7QUFDdEIsU0FBUyxTQUFTLGVBQWU7QUFDakMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxXQUFXO0FBQ3BCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQXlDLHdCQUFxQztBQUM5RSxTQUFTLHFCQUFxQjtBQUM5QixTQUE2Qix3QkFBd0I7QUFDckQsU0FBb0MseUJBQXlCO0FBQzdELFlBQVksU0FBUztBQUNyQixTQUFTLGtCQUF3RTtBQUNqRixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLG1CQUFtQix5QkFBeUI7QUFDckQsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyw0QkFBaUQ7QUFDMUQsU0FBUyxjQUFjLHFCQUE4RSxnQkFBZ0Isc0NBQXNDO0FBQzNKLFNBQW9ELHdCQUF3QjtBQUU1RSxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDJCQUF1RDtBQUNoRSxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLFVBQVUsU0FBdUMsbUNBQW1DLGlCQUFxQyx5QkFBeUIsMkJBQTJCO0FBQ3RMLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsMkNBQTJDO0FBQ3BELFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsb0NBQW9DO0FBQzdDLFNBQVMs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
