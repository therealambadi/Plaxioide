import * as DOM from "../../../../../base/browser/dom.js";
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { NotImplementedError } from "../../../../../base/common/errors.js";
import { Emitter, Event } from "../../../../../base/common/event.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../../../base/common/map.js";
import { Mimes } from "../../../../../base/common/mime.js";
import { URI } from "../../../../../base/common/uri.js";
import { mock } from "../../../../../base/test/common/mock.js";
import { runWithFakedTimers } from "../../../../../base/test/common/timeTravelScheduler.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { ILanguageConfigurationService } from "../../../../../editor/common/languages/languageConfigurationRegistry.js";
import { LanguageService } from "../../../../../editor/common/services/languageService.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ModelService } from "../../../../../editor/common/services/modelService.js";
import { ITextModelService } from "../../../../../editor/common/services/resolverService.js";
import { TestLanguageConfigurationService } from "../../../../../editor/test/common/modes/testLanguageConfigurationService.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { TestClipboardService } from "../../../../../platform/clipboard/test/common/testClipboardService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { ContextKeyService } from "../../../../../platform/contextkey/browser/contextKeyService.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { TestInstantiationService } from "../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { IKeybindingService } from "../../../../../platform/keybinding/common/keybinding.js";
import { MockKeybindingService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
import { ILayoutService } from "../../../../../platform/layout/browser/layoutService.js";
import { IListService, ListService } from "../../../../../platform/list/browser/listService.js";
import { ILogService, NullLogService } from "../../../../../platform/log/common/log.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { TestThemeService } from "../../../../../platform/theme/test/common/testThemeService.js";
import { IUndoRedoService } from "../../../../../platform/undoRedo/common/undoRedo.js";
import { UndoRedoService } from "../../../../../platform/undoRedo/common/undoRedoService.js";
import { IWorkspaceTrustRequestService } from "../../../../../platform/workspace/common/workspaceTrust.js";
import { EditorModel } from "../../../../common/editor/editorModel.js";
import { CellFocusMode } from "../../browser/notebookBrowser.js";
import { NotebookCellStatusBarService } from "../../browser/services/notebookCellStatusBarServiceImpl.js";
import { ListViewInfoAccessor, NotebookCellList } from "../../browser/view/notebookCellList.js";
import { NotebookEventDispatcher } from "../../browser/viewModel/eventDispatcher.js";
import { NotebookViewModel } from "../../browser/viewModel/notebookViewModelImpl.js";
import { ViewContext } from "../../browser/viewModel/viewContext.js";
import { NotebookCellTextModel } from "../../common/model/notebookCellTextModel.js";
import { NotebookTextModel } from "../../common/model/notebookTextModel.js";
import { INotebookCellStatusBarService } from "../../common/notebookCellStatusBarService.js";
import { CellUri, NotebookCellExecutionState, SelectionStateType } from "../../common/notebookCommon.js";
import { INotebookExecutionStateService } from "../../common/notebookExecutionStateService.js";
import { NotebookOptions } from "../../browser/notebookOptions.js";
import { TextModelResolverService } from "../../../../services/textmodelResolver/common/textModelResolverService.js";
import { TestLayoutService } from "../../../../test/browser/workbenchTestServices.js";
import { TestStorageService, TestWorkspaceTrustRequestService } from "../../../../test/common/workbenchTestServices.js";
import { FontInfo } from "../../../../../editor/common/config/fontInfo.js";
import { EditorFontLigatures, EditorFontVariations } from "../../../../../editor/common/config/editorOptions.js";
import { ICodeEditorService } from "../../../../../editor/browser/services/codeEditorService.js";
import { mainWindow } from "../../../../../base/browser/window.js";
import { TestCodeEditorService } from "../../../../../editor/test/browser/editorTestServices.js";
import { INotebookCellOutlineDataSourceFactory, NotebookCellOutlineDataSourceFactory } from "../../browser/viewModel/notebookOutlineDataSourceFactory.js";
import { ILanguageDetectionService } from "../../../../services/languageDetection/common/languageDetectionWorkerService.js";
import { INotebookOutlineEntryFactory, NotebookOutlineEntryFactory } from "../../browser/viewModel/notebookOutlineEntryFactory.js";
import { IOutlineService } from "../../../../services/outline/browser/outline.js";
class TestCell extends NotebookCellTextModel {
  constructor(viewType, handle, source, language, cellKind, outputs, languageService) {
    super(CellUri.generate(URI.parse("test:///fake/notebook"), handle), handle, source, language, Mimes.text, cellKind, outputs, void 0, void 0, void 0, { transientCellMetadata: {}, transientDocumentMetadata: {}, transientOutputs: false, cellContentMetadata: {} }, languageService);
    this.viewType = viewType;
    this.source = source;
  }
}
class NotebookEditorTestModel extends EditorModel {
  constructor(_notebook) {
    super();
    this._notebook = _notebook;
    this._dirty = false;
    this._onDidSave = this._register(new Emitter());
    this.onDidSave = this._onDidSave.event;
    this._onDidChangeDirty = this._register(new Emitter());
    this.onDidChangeDirty = this._onDidChangeDirty.event;
    this.onDidChangeOrphaned = Event.None;
    this.onDidChangeReadonly = Event.None;
    this.onDidRevertUntitled = Event.None;
    this._onDidChangeContent = this._register(new Emitter());
    this.onDidChangeContent = this._onDidChangeContent.event;
    if (_notebook && _notebook.onDidChangeContent) {
      this._register(_notebook.onDidChangeContent(() => {
        this._dirty = true;
        this._onDidChangeDirty.fire();
        this._onDidChangeContent.fire();
      }));
    }
  }
  get viewType() {
    return this._notebook.viewType;
  }
  get resource() {
    return this._notebook.uri;
  }
  get notebook() {
    return this._notebook;
  }
  isReadonly() {
    return false;
  }
  isOrphaned() {
    return false;
  }
  hasAssociatedFilePath() {
    return false;
  }
  isDirty() {
    return this._dirty;
  }
  get hasErrorState() {
    return false;
  }
  isModified() {
    return this._dirty;
  }
  getNotebook() {
    return this._notebook;
  }
  async load() {
    return this;
  }
  async save() {
    if (this._notebook) {
      this._dirty = false;
      this._onDidChangeDirty.fire();
      this._onDidSave.fire({});
      return true;
    }
    return false;
  }
  saveAs() {
    throw new NotImplementedError();
  }
  revert() {
    throw new NotImplementedError();
  }
}
function setupInstantiationService(disposables) {
  const instantiationService = disposables.add(new TestInstantiationService());
  const testThemeService = new TestThemeService();
  instantiationService.stub(ILanguageService, disposables.add(new LanguageService()));
  instantiationService.stub(IUndoRedoService, instantiationService.createInstance(UndoRedoService));
  instantiationService.stub(IConfigurationService, new TestConfigurationService());
  instantiationService.stub(IThemeService, testThemeService);
  instantiationService.stub(ILanguageConfigurationService, disposables.add(new TestLanguageConfigurationService()));
  instantiationService.stub(IModelService, disposables.add(instantiationService.createInstance(ModelService)));
  instantiationService.stub(ITextModelService, disposables.add(instantiationService.createInstance(TextModelResolverService)));
  instantiationService.stub(IContextKeyService, disposables.add(instantiationService.createInstance(ContextKeyService)));
  instantiationService.stub(IListService, disposables.add(instantiationService.createInstance(ListService)));
  instantiationService.stub(ILayoutService, new TestLayoutService());
  instantiationService.stub(ILogService, new NullLogService());
  instantiationService.stub(IClipboardService, TestClipboardService);
  instantiationService.stub(IStorageService, disposables.add(new TestStorageService()));
  instantiationService.stub(IWorkspaceTrustRequestService, disposables.add(new TestWorkspaceTrustRequestService(true)));
  instantiationService.stub(INotebookExecutionStateService, new TestNotebookExecutionStateService());
  instantiationService.stub(IKeybindingService, new MockKeybindingService());
  instantiationService.stub(INotebookCellStatusBarService, disposables.add(new NotebookCellStatusBarService()));
  instantiationService.stub(ICodeEditorService, disposables.add(new TestCodeEditorService(testThemeService)));
  instantiationService.stub(IOutlineService, new class extends mock() {
    registerOutlineCreator() {
      return { dispose() {
      } };
    }
  }());
  instantiationService.stub(INotebookCellOutlineDataSourceFactory, instantiationService.createInstance(NotebookCellOutlineDataSourceFactory));
  instantiationService.stub(INotebookOutlineEntryFactory, instantiationService.createInstance(NotebookOutlineEntryFactory));
  instantiationService.stub(ILanguageDetectionService, new class MockLanguageDetectionService {
    isEnabledForLanguage(languageId) {
      return false;
    }
    async detectLanguage(resource, supportedLangs) {
      return void 0;
    }
  }());
  return instantiationService;
}
function _createTestNotebookEditor(instantiationService, disposables, cells) {
  const viewType = "notebook";
  const notebook = disposables.add(instantiationService.createInstance(NotebookTextModel, viewType, URI.parse("test://test"), cells.map((cell) => {
    return {
      source: cell[0],
      mime: void 0,
      language: cell[1],
      cellKind: cell[2],
      outputs: cell[3] ?? [],
      metadata: cell[4]
    };
  }), {}, { transientCellMetadata: {}, transientDocumentMetadata: {}, cellContentMetadata: {}, transientOutputs: false }));
  const model = disposables.add(new NotebookEditorTestModel(notebook));
  const notebookOptions = disposables.add(new NotebookOptions(mainWindow, false, void 0, instantiationService.get(IConfigurationService), instantiationService.get(INotebookExecutionStateService), instantiationService.get(ICodeEditorService)));
  const baseCellEditorOptions = new class extends mock() {
  }();
  const viewContext = new ViewContext(notebookOptions, disposables.add(new NotebookEventDispatcher()), () => baseCellEditorOptions);
  const viewModel = disposables.add(instantiationService.createInstance(NotebookViewModel, viewType, model.notebook, viewContext, null, { isReadOnly: false }));
  const cellList = disposables.add(createNotebookCellList(instantiationService, disposables, viewContext));
  cellList.attachViewModel(viewModel);
  const listViewInfoAccessor = disposables.add(new ListViewInfoAccessor(cellList));
  let visibleRanges = [{ start: 0, end: 100 }];
  const id = Date.now().toString();
  const notebookEditor = new class extends mock() {
    constructor() {
      super(...arguments);
      this.notebookOptions = notebookOptions;
      this.onDidChangeModel = new Emitter().event;
      this.onDidChangeCellState = new Emitter().event;
      this.textModel = viewModel.notebookDocument;
      this.onDidChangeVisibleRanges = Event.None;
    }
    // eslint-disable-next-line local/code-must-use-super-dispose
    dispose() {
      viewModel.dispose();
    }
    getViewModel() {
      return viewModel;
    }
    hasModel() {
      return !!viewModel;
    }
    getLength() {
      return viewModel.length;
    }
    getFocus() {
      return viewModel.getFocus();
    }
    getSelections() {
      return viewModel.getSelections();
    }
    setFocus(focus) {
      viewModel.updateSelectionsState({
        kind: SelectionStateType.Index,
        focus,
        selections: viewModel.getSelections()
      });
    }
    setSelections(selections) {
      viewModel.updateSelectionsState({
        kind: SelectionStateType.Index,
        focus: viewModel.getFocus(),
        selections
      });
    }
    getViewIndexByModelIndex(index) {
      return listViewInfoAccessor.getViewIndex(viewModel.viewCells[index]);
    }
    getCellRangeFromViewRange(startIndex, endIndex) {
      return listViewInfoAccessor.getCellRangeFromViewRange(startIndex, endIndex);
    }
    revealCellRangeInView() {
    }
    setHiddenAreas(_ranges) {
      return cellList.setHiddenAreas(_ranges, true);
    }
    getActiveCell() {
      const elements = cellList.getFocusedElements();
      if (elements && elements.length) {
        return elements[0];
      }
      return void 0;
    }
    hasOutputTextSelection() {
      return false;
    }
    changeModelDecorations() {
      return null;
    }
    focusElement() {
    }
    setCellEditorSelection() {
    }
    async revealRangeInCenterIfOutsideViewportAsync() {
    }
    async layoutNotebookCell() {
    }
    async createOutput() {
    }
    async removeInset() {
    }
    async focusNotebookCell(cell, focusItem) {
      cell.focusMode = focusItem === "editor" ? CellFocusMode.Editor : focusItem === "output" ? CellFocusMode.Output : CellFocusMode.Container;
    }
    cellAt(index) {
      return viewModel.cellAt(index);
    }
    getCellIndex(cell) {
      return viewModel.getCellIndex(cell);
    }
    getCellsInRange(range) {
      return viewModel.getCellsInRange(range);
    }
    getCellByHandle(handle) {
      return viewModel.getCellByHandle(handle);
    }
    getNextVisibleCellIndex(index) {
      return viewModel.getNextVisibleCellIndex(index);
    }
    getControl() {
      return this;
    }
    get onDidChangeSelection() {
      return viewModel.onDidChangeSelection;
    }
    get onDidChangeOptions() {
      return viewModel.onDidChangeOptions;
    }
    get onDidChangeViewCells() {
      return viewModel.onDidChangeViewCells;
    }
    async find(query, options) {
      const findMatches = viewModel.find(query, options).filter((match) => match.length > 0);
      return findMatches;
    }
    deltaCellDecorations() {
      return [];
    }
    get visibleRanges() {
      return visibleRanges;
    }
    set visibleRanges(_ranges) {
      visibleRanges = _ranges;
    }
    getId() {
      return id;
    }
    setScrollTop(scrollTop) {
      cellList.scrollTop = scrollTop;
    }
    get scrollTop() {
      return cellList.scrollTop;
    }
    getLayoutInfo() {
      return {
        width: 0,
        height: 0,
        scrollHeight: cellList.getScrollHeight(),
        fontInfo: new FontInfo({
          pixelRatio: 1,
          fontFamily: "mockFont",
          fontWeight: "normal",
          fontSize: 14,
          fontFeatureSettings: EditorFontLigatures.OFF,
          fontVariationSettings: EditorFontVariations.OFF,
          lineHeight: 19,
          letterSpacing: 1.5,
          isMonospace: true,
          typicalHalfwidthCharacterWidth: 10,
          typicalFullwidthCharacterWidth: 20,
          canUseHalfwidthRightwardsArrow: true,
          spaceWidth: 10,
          middotWidth: 10,
          wsmiddotWidth: 10,
          maxDigitWidth: 10
        }, true),
        stickyHeight: 0
      };
    }
  }();
  return { editor: notebookEditor, viewModel };
}
function createTestNotebookEditor(instantiationService, disposables, cells) {
  return _createTestNotebookEditor(instantiationService, disposables, cells);
}
async function withTestNotebookDiffModel(originalCells, modifiedCells, callback) {
  const disposables = new DisposableStore();
  const instantiationService = setupInstantiationService(disposables);
  const originalNotebook = createTestNotebookEditor(instantiationService, disposables, originalCells);
  const modifiedNotebook = createTestNotebookEditor(instantiationService, disposables, modifiedCells);
  const originalResource = new class extends mock() {
    get notebook() {
      return originalNotebook.viewModel.notebookDocument;
    }
    get resource() {
      return originalNotebook.viewModel.notebookDocument.uri;
    }
  }();
  const modifiedResource = new class extends mock() {
    get notebook() {
      return modifiedNotebook.viewModel.notebookDocument;
    }
    get resource() {
      return modifiedNotebook.viewModel.notebookDocument.uri;
    }
  }();
  const model = new class extends mock() {
    get original() {
      return originalResource;
    }
    get modified() {
      return modifiedResource;
    }
  }();
  const res = await callback(model, disposables, instantiationService);
  if (res instanceof Promise) {
    res.finally(() => {
      originalNotebook.editor.dispose();
      originalNotebook.viewModel.notebookDocument.dispose();
      originalNotebook.viewModel.dispose();
      modifiedNotebook.editor.dispose();
      modifiedNotebook.viewModel.notebookDocument.dispose();
      modifiedNotebook.viewModel.dispose();
      disposables.dispose();
    });
  } else {
    originalNotebook.editor.dispose();
    originalNotebook.viewModel.notebookDocument.dispose();
    originalNotebook.viewModel.dispose();
    modifiedNotebook.editor.dispose();
    modifiedNotebook.viewModel.notebookDocument.dispose();
    modifiedNotebook.viewModel.dispose();
    disposables.dispose();
  }
  return res;
}
async function withTestNotebook(cells, callback, accessor) {
  const disposables = new DisposableStore();
  const instantiationService = accessor ?? setupInstantiationService(disposables);
  const notebookEditor = _createTestNotebookEditor(instantiationService, disposables, cells);
  return runWithFakedTimers({ useFakeTimers: true }, async () => {
    const res = await callback(notebookEditor.editor, notebookEditor.viewModel, disposables, instantiationService);
    if (res instanceof Promise) {
      res.finally(() => {
        notebookEditor.editor.dispose();
        notebookEditor.viewModel.dispose();
        notebookEditor.editor.textModel.dispose();
        disposables.dispose();
      });
    } else {
      notebookEditor.editor.dispose();
      notebookEditor.viewModel.dispose();
      notebookEditor.editor.textModel.dispose();
      disposables.dispose();
    }
    return res;
  });
}
function createNotebookCellList(instantiationService, disposables, viewContext) {
  const delegate = {
    getHeight(element) {
      return element.getHeight(17);
    },
    getTemplateId() {
      return "template";
    }
  };
  const baseCellRenderTemplate = new class extends mock() {
  }();
  const renderer = {
    templateId: "template",
    renderTemplate() {
      return baseCellRenderTemplate;
    },
    renderElement() {
    },
    disposeTemplate() {
    }
  };
  const notebookOptions = !!viewContext ? viewContext.notebookOptions : disposables.add(new NotebookOptions(mainWindow, false, void 0, instantiationService.get(IConfigurationService), instantiationService.get(INotebookExecutionStateService), instantiationService.get(ICodeEditorService)));
  const cellList = disposables.add(instantiationService.createInstance(
    NotebookCellList,
    "NotebookCellList",
    DOM.$("container"),
    notebookOptions,
    delegate,
    [renderer],
    instantiationService.get(IContextKeyService),
    {
      supportDynamicHeights: true,
      multipleSelectionSupport: true
    }
  ));
  return cellList;
}
function valueBytesFromString(value) {
  return VSBuffer.fromString(value);
}
class TestCellExecution {
  constructor(notebook, cellHandle, onComplete) {
    this.notebook = notebook;
    this.cellHandle = cellHandle;
    this.onComplete = onComplete;
    this.state = NotebookCellExecutionState.Unconfirmed;
    this.didPause = false;
    this.isPaused = false;
  }
  confirm() {
  }
  update(updates) {
  }
  complete(complete) {
    this.onComplete();
  }
}
class TestNotebookExecutionStateService {
  constructor() {
    this._executions = new ResourceMap();
    this.onDidChangeExecution = new Emitter().event;
    this.onDidChangeLastRunFailState = new Emitter().event;
  }
  forceCancelNotebookExecutions(notebookUri) {
  }
  getCellExecutionsForNotebook(notebook) {
    return [];
  }
  getCellExecution(cellUri) {
    return this._executions.get(cellUri);
  }
  createCellExecution(notebook, cellHandle) {
    const onComplete = () => this._executions.delete(CellUri.generate(notebook, cellHandle));
    const exe = new TestCellExecution(notebook, cellHandle, onComplete);
    this._executions.set(CellUri.generate(notebook, cellHandle), exe);
    return exe;
  }
  getCellExecutionsByHandleForNotebook(notebook) {
    return;
  }
  getLastFailedCellForNotebook(notebook) {
    return;
  }
  getLastCompletedCellForNotebook(notebook) {
    return;
  }
  getExecution(notebook) {
    return;
  }
  createExecution(notebook) {
    throw new Error("Method not implemented.");
  }
}
export {
  NotebookEditorTestModel,
  TestCell,
  TestNotebookExecutionStateService,
  createNotebookCellList,
  createTestNotebookEditor,
  setupInstantiationService,
  valueBytesFromString,
  withTestNotebook,
  withTestNotebookDiffModel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay90ZXN0L2Jyb3dzZXIvdGVzdE5vdGVib29rRWRpdG9yLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgRE9NIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgSUxpc3RSZW5kZXJlciwgSUxpc3RWaXJ0dWFsRGVsZWdhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9saXN0LmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IE5vdEltcGxlbWVudGVkRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgTWltZXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9taW1lLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBtb2NrIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi9tb2NrLmpzJztcbmltcG9ydCB7IHJ1bldpdGhGYWtlZFRpbWVycyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdGltZVRyYXZlbFNjaGVkdWxlci5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvcmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL3Rlc3QvY29tbW9uL21vZGVzL3Rlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL2NvbW1vbi9jbGlwYm9hcmRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRlc3RDbGlwYm9hcmRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY2xpcGJvYXJkL3Rlc3QvY29tbW9uL3Rlc3RDbGlwYm9hcmRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Q29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2Jyb3dzZXIvY29udGV4dEtleVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBJS2V5YmluZGluZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL2NvbW1vbi9rZXliaW5kaW5nLmpzJztcbmltcG9ydCB7IE1vY2tLZXliaW5kaW5nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvdGVzdC9jb21tb24vbW9ja0tleWJpbmRpbmdTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMYXlvdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGF5b3V0L2Jyb3dzZXIvbGF5b3V0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGlzdFNlcnZpY2UsIExpc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGlzdC9icm93c2VyL2xpc3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlLCBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdFRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL3Rlc3QvY29tbW9uL3Rlc3RUaGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVuZG9SZWRvU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VuZG9SZWRvL2NvbW1vbi91bmRvUmVkby5qcyc7XG5pbXBvcnQgeyBVbmRvUmVkb1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91bmRvUmVkby9jb21tb24vdW5kb1JlZG9TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2VUcnVzdC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgRWRpdG9yTW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yL2VkaXRvck1vZGVsLmpzJztcbmltcG9ydCB7IENlbGxGaW5kTWF0Y2hXaXRoSW5kZXgsIENlbGxGb2N1c01vZGUsIElBY3RpdmVOb3RlYm9va0VkaXRvckRlbGVnYXRlLCBJQmFzZUNlbGxFZGl0b3JPcHRpb25zLCBJQ2VsbFZpZXdNb2RlbCwgSU5vdGVib29rRWRpdG9yRGVsZWdhdGUgfSBmcm9tICcuLi8uLi9icm93c2VyL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va0NlbGxTdGF0ZUNoYW5nZWRFdmVudCwgTm90ZWJvb2tMYXlvdXRJbmZvIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9ub3RlYm9va1ZpZXdFdmVudHMuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tDZWxsU3RhdHVzQmFyU2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc2VydmljZXMvbm90ZWJvb2tDZWxsU3RhdHVzQmFyU2VydmljZUltcGwuanMnO1xuaW1wb3J0IHsgTGlzdFZpZXdJbmZvQWNjZXNzb3IsIE5vdGVib29rQ2VsbExpc3QgfSBmcm9tICcuLi8uLi9icm93c2VyL3ZpZXcvbm90ZWJvb2tDZWxsTGlzdC5qcyc7XG5pbXBvcnQgeyBCYXNlQ2VsbFJlbmRlclRlbXBsYXRlIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci92aWV3L25vdGVib29rUmVuZGVyaW5nQ29tbW9uLmpzJztcbmltcG9ydCB7IE5vdGVib29rRXZlbnREaXNwYXRjaGVyIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci92aWV3TW9kZWwvZXZlbnREaXNwYXRjaGVyLmpzJztcbmltcG9ydCB7IENlbGxWaWV3TW9kZWwsIE5vdGVib29rVmlld01vZGVsIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci92aWV3TW9kZWwvbm90ZWJvb2tWaWV3TW9kZWxJbXBsLmpzJztcbmltcG9ydCB7IFZpZXdDb250ZXh0IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci92aWV3TW9kZWwvdmlld0NvbnRleHQuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tDZWxsVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL21vZGVsL25vdGVib29rQ2VsbFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va1RleHRNb2RlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi9tb2RlbC9ub3RlYm9va1RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tDZWxsU3RhdHVzQmFyU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0NlbGxTdGF0dXNCYXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENlbGxLaW5kLCBDZWxsVXJpLCBJQ2VsbER0bzIsIElOb3RlYm9va0RpZmZFZGl0b3JNb2RlbCwgSU5vdGVib29rRWRpdG9yTW9kZWwsIElOb3RlYm9va0ZpbmRPcHRpb25zLCBJT3V0cHV0RHRvLCBJUmVzb2x2ZWROb3RlYm9va0VkaXRvck1vZGVsLCBOb3RlYm9va0NlbGxFeGVjdXRpb25TdGF0ZSwgTm90ZWJvb2tDZWxsTWV0YWRhdGEsIFNlbGVjdGlvblN0YXRlVHlwZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBJQ2VsbEV4ZWN1dGVVcGRhdGUsIElDZWxsRXhlY3V0aW9uQ29tcGxldGUsIElDZWxsRXhlY3V0aW9uU3RhdGVDaGFuZ2VkRXZlbnQsIElFeGVjdXRpb25TdGF0ZUNoYW5nZWRFdmVudCwgSU5vdGVib29rQ2VsbEV4ZWN1dGlvbiwgSU5vdGVib29rRXhlY3V0aW9uLCBJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UsIElOb3RlYm9va0ZhaWxTdGF0ZUNoYW5nZWRFdmVudCB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBOb3RlYm9va09wdGlvbnMgfSBmcm9tICcuLi8uLi9icm93c2VyL25vdGVib29rT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBJQ2VsbFJhbmdlIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rUmFuZ2UuanMnO1xuaW1wb3J0IHsgVGV4dE1vZGVsUmVzb2x2ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvdGV4dG1vZGVsUmVzb2x2ZXIvY29tbW9uL3RleHRNb2RlbFJlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHlTYXZlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy93b3JraW5nQ29weS9jb21tb24vd29ya2luZ0NvcHkuanMnO1xuaW1wb3J0IHsgVGVzdExheW91dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IFRlc3RTdG9yYWdlU2VydmljZSwgVGVzdFdvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgRm9udEluZm8gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvbmZpZy9mb250SW5mby5qcyc7XG5pbXBvcnQgeyBFZGl0b3JGb250TGlnYXR1cmVzLCBFZGl0b3JGb250VmFyaWF0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvc2VydmljZXMvY29kZUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgbWFpbldpbmRvdyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci93aW5kb3cuanMnO1xuaW1wb3J0IHsgVGVzdENvZGVFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL3Rlc3QvYnJvd3Nlci9lZGl0b3JUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rQ2VsbE91dGxpbmVEYXRhU291cmNlRmFjdG9yeSwgTm90ZWJvb2tDZWxsT3V0bGluZURhdGFTb3VyY2VGYWN0b3J5IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci92aWV3TW9kZWwvbm90ZWJvb2tPdXRsaW5lRGF0YVNvdXJjZUZhY3RvcnkuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRGV0ZWN0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2xhbmd1YWdlRGV0ZWN0aW9uL2NvbW1vbi9sYW5ndWFnZURldGVjdGlvbldvcmtlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rT3V0bGluZUVudHJ5RmFjdG9yeSwgTm90ZWJvb2tPdXRsaW5lRW50cnlGYWN0b3J5IH0gZnJvbSAnLi4vLi4vYnJvd3Nlci92aWV3TW9kZWwvbm90ZWJvb2tPdXRsaW5lRW50cnlGYWN0b3J5LmpzJztcbmltcG9ydCB7IElPdXRsaW5lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL291dGxpbmUvYnJvd3Nlci9vdXRsaW5lLmpzJztcblxuZXhwb3J0IGNsYXNzIFRlc3RDZWxsIGV4dGVuZHMgTm90ZWJvb2tDZWxsVGV4dE1vZGVsIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHZpZXdUeXBlOiBzdHJpbmcsXG5cdFx0aGFuZGxlOiBudW1iZXIsXG5cdFx0cHVibGljIHNvdXJjZTogc3RyaW5nLFxuXHRcdGxhbmd1YWdlOiBzdHJpbmcsXG5cdFx0Y2VsbEtpbmQ6IENlbGxLaW5kLFxuXHRcdG91dHB1dHM6IElPdXRwdXREdG9bXSxcblx0XHRsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKENlbGxVcmkuZ2VuZXJhdGUoVVJJLnBhcnNlKCd0ZXN0Oi8vL2Zha2Uvbm90ZWJvb2snKSwgaGFuZGxlKSwgaGFuZGxlLCBzb3VyY2UsIGxhbmd1YWdlLCBNaW1lcy50ZXh0LCBjZWxsS2luZCwgb3V0cHV0cywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgeyB0cmFuc2llbnRDZWxsTWV0YWRhdGE6IHt9LCB0cmFuc2llbnREb2N1bWVudE1ldGFkYXRhOiB7fSwgdHJhbnNpZW50T3V0cHV0czogZmFsc2UsIGNlbGxDb250ZW50TWV0YWRhdGE6IHt9IH0sIGxhbmd1YWdlU2VydmljZSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE5vdGVib29rRWRpdG9yVGVzdE1vZGVsIGV4dGVuZHMgRWRpdG9yTW9kZWwgaW1wbGVtZW50cyBJTm90ZWJvb2tFZGl0b3JNb2RlbCB7XG5cdHByaXZhdGUgX2RpcnR5ID0gZmFsc2U7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZFNhdmUgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJV29ya2luZ0NvcHlTYXZlRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZFNhdmUgPSB0aGlzLl9vbkRpZFNhdmUuZXZlbnQ7XG5cblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9vbkRpZENoYW5nZURpcnR5ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRGlydHkgPSB0aGlzLl9vbkRpZENoYW5nZURpcnR5LmV2ZW50O1xuXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlT3JwaGFuZWQgPSBFdmVudC5Ob25lO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVJlYWRvbmx5ID0gRXZlbnQuTm9uZTtcblx0cmVhZG9ubHkgb25EaWRSZXZlcnRVbnRpdGxlZCA9IEV2ZW50Lk5vbmU7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VDb250ZW50ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQ29udGVudDogRXZlbnQ8dm9pZD4gPSB0aGlzLl9vbkRpZENoYW5nZUNvbnRlbnQuZXZlbnQ7XG5cblxuXHRnZXQgdmlld1R5cGUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX25vdGVib29rLnZpZXdUeXBlO1xuXHR9XG5cblx0Z2V0IHJlc291cmNlKCkge1xuXHRcdHJldHVybiB0aGlzLl9ub3RlYm9vay51cmk7XG5cdH1cblxuXHRnZXQgbm90ZWJvb2soKTogTm90ZWJvb2tUZXh0TW9kZWwge1xuXHRcdHJldHVybiB0aGlzLl9ub3RlYm9vaztcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgX25vdGVib29rOiBOb3RlYm9va1RleHRNb2RlbFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0aWYgKF9ub3RlYm9vayAmJiBfbm90ZWJvb2sub25EaWRDaGFuZ2VDb250ZW50KSB7XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcihfbm90ZWJvb2sub25EaWRDaGFuZ2VDb250ZW50KCgpID0+IHtcblx0XHRcdFx0dGhpcy5fZGlydHkgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZURpcnR5LmZpcmUoKTtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDb250ZW50LmZpcmUoKTtcblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cblxuXHRpc1JlYWRvbmx5KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGlzT3JwaGFuZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0aGFzQXNzb2NpYXRlZEZpbGVQYXRoKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGlzRGlydHkoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX2RpcnR5O1xuXHR9XG5cblx0Z2V0IGhhc0Vycm9yU3RhdGUoKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0aXNNb2RpZmllZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fZGlydHk7XG5cdH1cblxuXHRnZXROb3RlYm9vaygpOiBOb3RlYm9va1RleHRNb2RlbCB7XG5cdFx0cmV0dXJuIHRoaXMuX25vdGVib29rO1xuXHR9XG5cblx0YXN5bmMgbG9hZCgpOiBQcm9taXNlPElSZXNvbHZlZE5vdGVib29rRWRpdG9yTW9kZWw+IHtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdGFzeW5jIHNhdmUoKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0aWYgKHRoaXMuX25vdGVib29rKSB7XG5cdFx0XHR0aGlzLl9kaXJ0eSA9IGZhbHNlO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VEaXJ0eS5maXJlKCk7XG5cdFx0XHR0aGlzLl9vbkRpZFNhdmUuZmlyZSh7fSk7XG5cdFx0XHQvLyB0b2RvLCBmbHVzaCBhbGwgc3RhdGVzXG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRzYXZlQXMoKTogUHJvbWlzZTxFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZD4ge1xuXHRcdHRocm93IG5ldyBOb3RJbXBsZW1lbnRlZEVycm9yKCk7XG5cdH1cblxuXHRyZXZlcnQoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhyb3cgbmV3IE5vdEltcGxlbWVudGVkRXJyb3IoKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0dXBJbnN0YW50aWF0aW9uU2VydmljZShkaXNwb3NhYmxlczogUGljazxEaXNwb3NhYmxlU3RvcmUsICdhZGQnPikge1xuXHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKCkpO1xuXHRjb25zdCB0ZXN0VGhlbWVTZXJ2aWNlID0gbmV3IFRlc3RUaGVtZVNlcnZpY2UoKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTGFuZ3VhZ2VTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IExhbmd1YWdlU2VydmljZSgpKSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVVuZG9SZWRvU2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVW5kb1JlZG9TZXJ2aWNlKSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUaGVtZVNlcnZpY2UsIHRlc3RUaGVtZVNlcnZpY2UpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTW9kZWxTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTW9kZWxTZXJ2aWNlKSkpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUZXh0TW9kZWxTZXJ2aWNlLCA8SVRleHRNb2RlbFNlcnZpY2U+ZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRNb2RlbFJlc29sdmVyU2VydmljZSkpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29udGV4dEtleVNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDb250ZXh0S2V5U2VydmljZSkpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTGlzdFNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShMaXN0U2VydmljZSkpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTGF5b3V0U2VydmljZSwgbmV3IFRlc3RMYXlvdXRTZXJ2aWNlKCkpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElMb2dTZXJ2aWNlLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNsaXBib2FyZFNlcnZpY2UsIFRlc3RDbGlwYm9hcmRTZXJ2aWNlKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU3RvcmFnZVNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdFN0b3JhZ2VTZXJ2aWNlKCkpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJV29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0V29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZSh0cnVlKSkpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSwgbmV3IFRlc3ROb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSgpKTtcblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJS2V5YmluZGluZ1NlcnZpY2UsIG5ldyBNb2NrS2V5YmluZGluZ1NlcnZpY2UoKSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSU5vdGVib29rQ2VsbFN0YXR1c0JhclNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChuZXcgTm90ZWJvb2tDZWxsU3RhdHVzQmFyU2VydmljZSgpKSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvZGVFZGl0b3JTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RDb2RlRWRpdG9yU2VydmljZSh0ZXN0VGhlbWVTZXJ2aWNlKSkpO1xuXHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElPdXRsaW5lU2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJT3V0bGluZVNlcnZpY2U+KCkgeyBvdmVycmlkZSByZWdpc3Rlck91dGxpbmVDcmVhdG9yKCkgeyByZXR1cm4geyBkaXNwb3NlKCkgeyB9IH07IH0gfSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSU5vdGVib29rQ2VsbE91dGxpbmVEYXRhU291cmNlRmFjdG9yeSwgaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90ZWJvb2tDZWxsT3V0bGluZURhdGFTb3VyY2VGYWN0b3J5KSk7XG5cdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSU5vdGVib29rT3V0bGluZUVudHJ5RmFjdG9yeSwgaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90ZWJvb2tPdXRsaW5lRW50cnlGYWN0b3J5KSk7XG5cblx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTGFuZ3VhZ2VEZXRlY3Rpb25TZXJ2aWNlLCBuZXcgY2xhc3MgTW9ja0xhbmd1YWdlRGV0ZWN0aW9uU2VydmljZSBpbXBsZW1lbnRzIElMYW5ndWFnZURldGVjdGlvblNlcnZpY2Uge1xuXHRcdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0XHRpc0VuYWJsZWRGb3JMYW5ndWFnZShsYW5ndWFnZUlkOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0YXN5bmMgZGV0ZWN0TGFuZ3VhZ2UocmVzb3VyY2U6IFVSSSwgc3VwcG9ydGVkTGFuZ3M/OiBzdHJpbmdbXSB8IHVuZGVmaW5lZCk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0fSk7XG5cblx0cmV0dXJuIGluc3RhbnRpYXRpb25TZXJ2aWNlO1xufVxuXG5mdW5jdGlvbiBfY3JlYXRlVGVzdE5vdGVib29rRWRpdG9yKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUsIGNlbGxzOiBNb2NrTm90ZWJvb2tDZWxsW10pOiB7IGVkaXRvcjogSUFjdGl2ZU5vdGVib29rRWRpdG9yRGVsZWdhdGU7IHZpZXdNb2RlbDogTm90ZWJvb2tWaWV3TW9kZWwgfSB7XG5cblx0Y29uc3Qgdmlld1R5cGUgPSAnbm90ZWJvb2snO1xuXHRjb25zdCBub3RlYm9vayA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShOb3RlYm9va1RleHRNb2RlbCwgdmlld1R5cGUsIFVSSS5wYXJzZSgndGVzdDovL3Rlc3QnKSwgY2VsbHMubWFwKChjZWxsKTogSUNlbGxEdG8yID0+IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0c291cmNlOiBjZWxsWzBdLFxuXHRcdFx0bWltZTogdW5kZWZpbmVkLFxuXHRcdFx0bGFuZ3VhZ2U6IGNlbGxbMV0sXG5cdFx0XHRjZWxsS2luZDogY2VsbFsyXSxcblx0XHRcdG91dHB1dHM6IGNlbGxbM10gPz8gW10sXG5cdFx0XHRtZXRhZGF0YTogY2VsbFs0XVxuXHRcdH07XG5cdH0pLCB7fSwgeyB0cmFuc2llbnRDZWxsTWV0YWRhdGE6IHt9LCB0cmFuc2llbnREb2N1bWVudE1ldGFkYXRhOiB7fSwgY2VsbENvbnRlbnRNZXRhZGF0YToge30sIHRyYW5zaWVudE91dHB1dHM6IGZhbHNlIH0pKTtcblxuXHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgTm90ZWJvb2tFZGl0b3JUZXN0TW9kZWwobm90ZWJvb2spKTtcblx0Y29uc3Qgbm90ZWJvb2tPcHRpb25zID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBOb3RlYm9va09wdGlvbnMobWFpbldpbmRvdywgZmFsc2UsIHVuZGVmaW5lZCwgaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSksIGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTm90ZWJvb2tFeGVjdXRpb25TdGF0ZVNlcnZpY2UpLCBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUNvZGVFZGl0b3JTZXJ2aWNlKSkpO1xuXHRjb25zdCBiYXNlQ2VsbEVkaXRvck9wdGlvbnMgPSBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElCYXNlQ2VsbEVkaXRvck9wdGlvbnM+KCkgeyB9O1xuXHRjb25zdCB2aWV3Q29udGV4dCA9IG5ldyBWaWV3Q29udGV4dChub3RlYm9va09wdGlvbnMsIGRpc3Bvc2FibGVzLmFkZChuZXcgTm90ZWJvb2tFdmVudERpc3BhdGNoZXIoKSksICgpID0+IGJhc2VDZWxsRWRpdG9yT3B0aW9ucyk7XG5cdGNvbnN0IHZpZXdNb2RlbDogTm90ZWJvb2tWaWV3TW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTm90ZWJvb2tWaWV3TW9kZWwsIHZpZXdUeXBlLCBtb2RlbC5ub3RlYm9vaywgdmlld0NvbnRleHQsIG51bGwsIHsgaXNSZWFkT25seTogZmFsc2UgfSkpO1xuXG5cdGNvbnN0IGNlbGxMaXN0ID0gZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZU5vdGVib29rQ2VsbExpc3QoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzLCB2aWV3Q29udGV4dCkpO1xuXHRjZWxsTGlzdC5hdHRhY2hWaWV3TW9kZWwodmlld01vZGVsKTtcblx0Y29uc3QgbGlzdFZpZXdJbmZvQWNjZXNzb3IgPSBkaXNwb3NhYmxlcy5hZGQobmV3IExpc3RWaWV3SW5mb0FjY2Vzc29yKGNlbGxMaXN0KSk7XG5cblx0bGV0IHZpc2libGVSYW5nZXM6IElDZWxsUmFuZ2VbXSA9IFt7IHN0YXJ0OiAwLCBlbmQ6IDEwMCB9XTtcblxuXHRjb25zdCBpZCA9IERhdGUubm93KCkudG9TdHJpbmcoKTtcblx0Y29uc3Qgbm90ZWJvb2tFZGl0b3I6IElBY3RpdmVOb3RlYm9va0VkaXRvckRlbGVnYXRlID0gbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJQWN0aXZlTm90ZWJvb2tFZGl0b3JEZWxlZ2F0ZT4oKSB7XG5cdFx0Ly8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGxvY2FsL2NvZGUtbXVzdC11c2Utc3VwZXItZGlzcG9zZVxuXHRcdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0XHR2aWV3TW9kZWwuZGlzcG9zZSgpO1xuXHRcdH1cblx0XHRvdmVycmlkZSBub3RlYm9va09wdGlvbnMgPSBub3RlYm9va09wdGlvbnM7XG5cdFx0b3ZlcnJpZGUgb25EaWRDaGFuZ2VNb2RlbDogRXZlbnQ8Tm90ZWJvb2tUZXh0TW9kZWwgfCB1bmRlZmluZWQ+ID0gbmV3IEVtaXR0ZXI8Tm90ZWJvb2tUZXh0TW9kZWwgfCB1bmRlZmluZWQ+KCkuZXZlbnQ7XG5cdFx0b3ZlcnJpZGUgb25EaWRDaGFuZ2VDZWxsU3RhdGU6IEV2ZW50PE5vdGVib29rQ2VsbFN0YXRlQ2hhbmdlZEV2ZW50PiA9IG5ldyBFbWl0dGVyPE5vdGVib29rQ2VsbFN0YXRlQ2hhbmdlZEV2ZW50PigpLmV2ZW50O1xuXHRcdG92ZXJyaWRlIGdldFZpZXdNb2RlbCgpOiBOb3RlYm9va1ZpZXdNb2RlbCB7XG5cdFx0XHRyZXR1cm4gdmlld01vZGVsO1xuXHRcdH1cblx0XHRvdmVycmlkZSB0ZXh0TW9kZWwgPSB2aWV3TW9kZWwubm90ZWJvb2tEb2N1bWVudDtcblx0XHRvdmVycmlkZSBoYXNNb2RlbCgpOiB0aGlzIGlzIElBY3RpdmVOb3RlYm9va0VkaXRvckRlbGVnYXRlIHtcblx0XHRcdHJldHVybiAhIXZpZXdNb2RlbDtcblx0XHR9XG5cdFx0b3ZlcnJpZGUgZ2V0TGVuZ3RoKCkgeyByZXR1cm4gdmlld01vZGVsLmxlbmd0aDsgfVxuXHRcdG92ZXJyaWRlIGdldEZvY3VzKCkgeyByZXR1cm4gdmlld01vZGVsLmdldEZvY3VzKCk7IH1cblx0XHRvdmVycmlkZSBnZXRTZWxlY3Rpb25zKCkgeyByZXR1cm4gdmlld01vZGVsLmdldFNlbGVjdGlvbnMoKTsgfVxuXHRcdG92ZXJyaWRlIHNldEZvY3VzKGZvY3VzOiBJQ2VsbFJhbmdlKSB7XG5cdFx0XHR2aWV3TW9kZWwudXBkYXRlU2VsZWN0aW9uc1N0YXRlKHtcblx0XHRcdFx0a2luZDogU2VsZWN0aW9uU3RhdGVUeXBlLkluZGV4LFxuXHRcdFx0XHRmb2N1czogZm9jdXMsXG5cdFx0XHRcdHNlbGVjdGlvbnM6IHZpZXdNb2RlbC5nZXRTZWxlY3Rpb25zKClcblx0XHRcdH0pO1xuXHRcdH1cblx0XHRvdmVycmlkZSBzZXRTZWxlY3Rpb25zKHNlbGVjdGlvbnM6IElDZWxsUmFuZ2VbXSkge1xuXHRcdFx0dmlld01vZGVsLnVwZGF0ZVNlbGVjdGlvbnNTdGF0ZSh7XG5cdFx0XHRcdGtpbmQ6IFNlbGVjdGlvblN0YXRlVHlwZS5JbmRleCxcblx0XHRcdFx0Zm9jdXM6IHZpZXdNb2RlbC5nZXRGb2N1cygpLFxuXHRcdFx0XHRzZWxlY3Rpb25zOiBzZWxlY3Rpb25zXG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0b3ZlcnJpZGUgZ2V0Vmlld0luZGV4QnlNb2RlbEluZGV4KGluZGV4OiBudW1iZXIpIHsgcmV0dXJuIGxpc3RWaWV3SW5mb0FjY2Vzc29yLmdldFZpZXdJbmRleCh2aWV3TW9kZWwudmlld0NlbGxzW2luZGV4XSk7IH1cblx0XHRvdmVycmlkZSBnZXRDZWxsUmFuZ2VGcm9tVmlld1JhbmdlKHN0YXJ0SW5kZXg6IG51bWJlciwgZW5kSW5kZXg6IG51bWJlcikgeyByZXR1cm4gbGlzdFZpZXdJbmZvQWNjZXNzb3IuZ2V0Q2VsbFJhbmdlRnJvbVZpZXdSYW5nZShzdGFydEluZGV4LCBlbmRJbmRleCk7IH1cblx0XHRvdmVycmlkZSByZXZlYWxDZWxsUmFuZ2VJblZpZXcoKSB7IH1cblx0XHRvdmVycmlkZSBzZXRIaWRkZW5BcmVhcyhfcmFuZ2VzOiBJQ2VsbFJhbmdlW10pOiBib29sZWFuIHtcblx0XHRcdHJldHVybiBjZWxsTGlzdC5zZXRIaWRkZW5BcmVhcyhfcmFuZ2VzLCB0cnVlKTtcblx0XHR9XG5cdFx0b3ZlcnJpZGUgZ2V0QWN0aXZlQ2VsbCgpIHtcblx0XHRcdGNvbnN0IGVsZW1lbnRzID0gY2VsbExpc3QuZ2V0Rm9jdXNlZEVsZW1lbnRzKCk7XG5cblx0XHRcdGlmIChlbGVtZW50cyAmJiBlbGVtZW50cy5sZW5ndGgpIHtcblx0XHRcdFx0cmV0dXJuIGVsZW1lbnRzWzBdO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRvdmVycmlkZSBoYXNPdXRwdXRUZXh0U2VsZWN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRvdmVycmlkZSBjaGFuZ2VNb2RlbERlY29yYXRpb25zKCkgeyByZXR1cm4gbnVsbDsgfVxuXHRcdG92ZXJyaWRlIGZvY3VzRWxlbWVudCgpIHsgfVxuXHRcdG92ZXJyaWRlIHNldENlbGxFZGl0b3JTZWxlY3Rpb24oKSB7IH1cblx0XHRvdmVycmlkZSBhc3luYyByZXZlYWxSYW5nZUluQ2VudGVySWZPdXRzaWRlVmlld3BvcnRBc3luYygpIHsgfVxuXHRcdG92ZXJyaWRlIGFzeW5jIGxheW91dE5vdGVib29rQ2VsbCgpIHsgfVxuXHRcdG92ZXJyaWRlIGFzeW5jIGNyZWF0ZU91dHB1dCgpIHsgfVxuXHRcdG92ZXJyaWRlIGFzeW5jIHJlbW92ZUluc2V0KCkgeyB9XG5cdFx0b3ZlcnJpZGUgYXN5bmMgZm9jdXNOb3RlYm9va0NlbGwoY2VsbDogSUNlbGxWaWV3TW9kZWwsIGZvY3VzSXRlbTogJ2VkaXRvcicgfCAnY29udGFpbmVyJyB8ICdvdXRwdXQnKSB7XG5cdFx0XHRjZWxsLmZvY3VzTW9kZSA9IGZvY3VzSXRlbSA9PT0gJ2VkaXRvcicgPyBDZWxsRm9jdXNNb2RlLkVkaXRvclxuXHRcdFx0XHQ6IGZvY3VzSXRlbSA9PT0gJ291dHB1dCcgPyBDZWxsRm9jdXNNb2RlLk91dHB1dFxuXHRcdFx0XHRcdDogQ2VsbEZvY3VzTW9kZS5Db250YWluZXI7XG5cdFx0fVxuXHRcdG92ZXJyaWRlIGNlbGxBdChpbmRleDogbnVtYmVyKSB7IHJldHVybiB2aWV3TW9kZWwuY2VsbEF0KGluZGV4KSE7IH1cblx0XHRvdmVycmlkZSBnZXRDZWxsSW5kZXgoY2VsbDogSUNlbGxWaWV3TW9kZWwpIHsgcmV0dXJuIHZpZXdNb2RlbC5nZXRDZWxsSW5kZXgoY2VsbCk7IH1cblx0XHRvdmVycmlkZSBnZXRDZWxsc0luUmFuZ2UocmFuZ2U/OiBJQ2VsbFJhbmdlKSB7IHJldHVybiB2aWV3TW9kZWwuZ2V0Q2VsbHNJblJhbmdlKHJhbmdlKTsgfVxuXHRcdG92ZXJyaWRlIGdldENlbGxCeUhhbmRsZShoYW5kbGU6IG51bWJlcikgeyByZXR1cm4gdmlld01vZGVsLmdldENlbGxCeUhhbmRsZShoYW5kbGUpOyB9XG5cdFx0b3ZlcnJpZGUgZ2V0TmV4dFZpc2libGVDZWxsSW5kZXgoaW5kZXg6IG51bWJlcikgeyByZXR1cm4gdmlld01vZGVsLmdldE5leHRWaXNpYmxlQ2VsbEluZGV4KGluZGV4KTsgfVxuXHRcdGdldENvbnRyb2woKSB7IHJldHVybiB0aGlzOyB9XG5cdFx0b3ZlcnJpZGUgZ2V0IG9uRGlkQ2hhbmdlU2VsZWN0aW9uKCkgeyByZXR1cm4gdmlld01vZGVsLm9uRGlkQ2hhbmdlU2VsZWN0aW9uIGFzIEV2ZW50PGFueT47IH1cblx0XHRvdmVycmlkZSBnZXQgb25EaWRDaGFuZ2VPcHRpb25zKCkgeyByZXR1cm4gdmlld01vZGVsLm9uRGlkQ2hhbmdlT3B0aW9uczsgfVxuXHRcdG92ZXJyaWRlIGdldCBvbkRpZENoYW5nZVZpZXdDZWxscygpIHsgcmV0dXJuIHZpZXdNb2RlbC5vbkRpZENoYW5nZVZpZXdDZWxsczsgfVxuXHRcdG92ZXJyaWRlIGFzeW5jIGZpbmQocXVlcnk6IHN0cmluZywgb3B0aW9uczogSU5vdGVib29rRmluZE9wdGlvbnMpOiBQcm9taXNlPENlbGxGaW5kTWF0Y2hXaXRoSW5kZXhbXT4ge1xuXHRcdFx0Y29uc3QgZmluZE1hdGNoZXMgPSB2aWV3TW9kZWwuZmluZChxdWVyeSwgb3B0aW9ucykuZmlsdGVyKG1hdGNoID0+IG1hdGNoLmxlbmd0aCA+IDApO1xuXHRcdFx0cmV0dXJuIGZpbmRNYXRjaGVzO1xuXHRcdH1cblx0XHRvdmVycmlkZSBkZWx0YUNlbGxEZWNvcmF0aW9ucygpIHsgcmV0dXJuIFtdOyB9XG5cdFx0b3ZlcnJpZGUgb25EaWRDaGFuZ2VWaXNpYmxlUmFuZ2VzID0gRXZlbnQuTm9uZTtcblxuXHRcdG92ZXJyaWRlIGdldCB2aXNpYmxlUmFuZ2VzKCkge1xuXHRcdFx0cmV0dXJuIHZpc2libGVSYW5nZXM7XG5cdFx0fVxuXG5cdFx0b3ZlcnJpZGUgc2V0IHZpc2libGVSYW5nZXMoX3JhbmdlczogSUNlbGxSYW5nZVtdKSB7XG5cdFx0XHR2aXNpYmxlUmFuZ2VzID0gX3Jhbmdlcztcblx0XHR9XG5cblx0XHRvdmVycmlkZSBnZXRJZCgpOiBzdHJpbmcgeyByZXR1cm4gaWQ7IH1cblx0XHRvdmVycmlkZSBzZXRTY3JvbGxUb3Aoc2Nyb2xsVG9wOiBudW1iZXIpOiB2b2lkIHtcblx0XHRcdGNlbGxMaXN0LnNjcm9sbFRvcCA9IHNjcm9sbFRvcDtcblx0XHR9XG5cdFx0b3ZlcnJpZGUgZ2V0IHNjcm9sbFRvcCgpOiBudW1iZXIge1xuXHRcdFx0cmV0dXJuIGNlbGxMaXN0LnNjcm9sbFRvcDtcblx0XHR9XG5cdFx0b3ZlcnJpZGUgZ2V0TGF5b3V0SW5mbygpOiBOb3RlYm9va0xheW91dEluZm8ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0d2lkdGg6IDAsXG5cdFx0XHRcdGhlaWdodDogMCxcblx0XHRcdFx0c2Nyb2xsSGVpZ2h0OiBjZWxsTGlzdC5nZXRTY3JvbGxIZWlnaHQoKSxcblx0XHRcdFx0Zm9udEluZm86IG5ldyBGb250SW5mbyh7XG5cdFx0XHRcdFx0cGl4ZWxSYXRpbzogMSxcblx0XHRcdFx0XHRmb250RmFtaWx5OiAnbW9ja0ZvbnQnLFxuXHRcdFx0XHRcdGZvbnRXZWlnaHQ6ICdub3JtYWwnLFxuXHRcdFx0XHRcdGZvbnRTaXplOiAxNCxcblx0XHRcdFx0XHRmb250RmVhdHVyZVNldHRpbmdzOiBFZGl0b3JGb250TGlnYXR1cmVzLk9GRixcblx0XHRcdFx0XHRmb250VmFyaWF0aW9uU2V0dGluZ3M6IEVkaXRvckZvbnRWYXJpYXRpb25zLk9GRixcblx0XHRcdFx0XHRsaW5lSGVpZ2h0OiAxOSxcblx0XHRcdFx0XHRsZXR0ZXJTcGFjaW5nOiAxLjUsXG5cdFx0XHRcdFx0aXNNb25vc3BhY2U6IHRydWUsXG5cdFx0XHRcdFx0dHlwaWNhbEhhbGZ3aWR0aENoYXJhY3RlcldpZHRoOiAxMCxcblx0XHRcdFx0XHR0eXBpY2FsRnVsbHdpZHRoQ2hhcmFjdGVyV2lkdGg6IDIwLFxuXHRcdFx0XHRcdGNhblVzZUhhbGZ3aWR0aFJpZ2h0d2FyZHNBcnJvdzogdHJ1ZSxcblx0XHRcdFx0XHRzcGFjZVdpZHRoOiAxMCxcblx0XHRcdFx0XHRtaWRkb3RXaWR0aDogMTAsXG5cdFx0XHRcdFx0d3NtaWRkb3RXaWR0aDogMTAsXG5cdFx0XHRcdFx0bWF4RGlnaXRXaWR0aDogMTAsXG5cdFx0XHRcdH0sIHRydWUpLFxuXHRcdFx0XHRzdGlja3lIZWlnaHQ6IDBcblx0XHRcdH07XG5cdFx0fVxuXHR9O1xuXG5cdHJldHVybiB7IGVkaXRvcjogbm90ZWJvb2tFZGl0b3IsIHZpZXdNb2RlbCB9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlVGVzdE5vdGVib29rRWRpdG9yKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUsIGNlbGxzOiBbc291cmNlOiBzdHJpbmcsIGxhbmc6IHN0cmluZywga2luZDogQ2VsbEtpbmQsIG91dHB1dD86IElPdXRwdXREdG9bXSwgbWV0YWRhdGE/OiBOb3RlYm9va0NlbGxNZXRhZGF0YV1bXSk6IHsgZWRpdG9yOiBJTm90ZWJvb2tFZGl0b3JEZWxlZ2F0ZTsgdmlld01vZGVsOiBOb3RlYm9va1ZpZXdNb2RlbCB9IHtcblx0cmV0dXJuIF9jcmVhdGVUZXN0Tm90ZWJvb2tFZGl0b3IoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzLCBjZWxscyk7XG59XG5cbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3aXRoVGVzdE5vdGVib29rRGlmZk1vZGVsPFIgPSBhbnk+KG9yaWdpbmFsQ2VsbHM6IFtzb3VyY2U6IHN0cmluZywgbGFuZzogc3RyaW5nLCBraW5kOiBDZWxsS2luZCwgb3V0cHV0PzogSU91dHB1dER0b1tdLCBtZXRhZGF0YT86IE5vdGVib29rQ2VsbE1ldGFkYXRhXVtdLCBtb2RpZmllZENlbGxzOiBbc291cmNlOiBzdHJpbmcsIGxhbmc6IHN0cmluZywga2luZDogQ2VsbEtpbmQsIG91dHB1dD86IElPdXRwdXREdG9bXSwgbWV0YWRhdGE/OiBOb3RlYm9va0NlbGxNZXRhZGF0YV1bXSwgY2FsbGJhY2s6IChkaWZmTW9kZWw6IElOb3RlYm9va0RpZmZFZGl0b3JNb2RlbCwgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSwgYWNjZXNzb3I6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSkgPT4gUHJvbWlzZTxSPiB8IFIpOiBQcm9taXNlPFI+IHtcblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc2V0dXBJbnN0YW50aWF0aW9uU2VydmljZShkaXNwb3NhYmxlcyk7XG5cdGNvbnN0IG9yaWdpbmFsTm90ZWJvb2sgPSBjcmVhdGVUZXN0Tm90ZWJvb2tFZGl0b3IoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzLCBvcmlnaW5hbENlbGxzKTtcblx0Y29uc3QgbW9kaWZpZWROb3RlYm9vayA9IGNyZWF0ZVRlc3ROb3RlYm9va0VkaXRvcihpbnN0YW50aWF0aW9uU2VydmljZSwgZGlzcG9zYWJsZXMsIG1vZGlmaWVkQ2VsbHMpO1xuXHRjb25zdCBvcmlnaW5hbFJlc291cmNlID0gbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJUmVzb2x2ZWROb3RlYm9va0VkaXRvck1vZGVsPigpIHtcblx0XHRvdmVycmlkZSBnZXQgbm90ZWJvb2soKSB7XG5cdFx0XHRyZXR1cm4gb3JpZ2luYWxOb3RlYm9vay52aWV3TW9kZWwubm90ZWJvb2tEb2N1bWVudDtcblx0XHR9XG5cdFx0b3ZlcnJpZGUgZ2V0IHJlc291cmNlKCkge1xuXHRcdFx0cmV0dXJuIG9yaWdpbmFsTm90ZWJvb2sudmlld01vZGVsLm5vdGVib29rRG9jdW1lbnQudXJpO1xuXHRcdH1cblx0fTtcblxuXHRjb25zdCBtb2RpZmllZFJlc291cmNlID0gbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJUmVzb2x2ZWROb3RlYm9va0VkaXRvck1vZGVsPigpIHtcblx0XHRvdmVycmlkZSBnZXQgbm90ZWJvb2soKSB7XG5cdFx0XHRyZXR1cm4gbW9kaWZpZWROb3RlYm9vay52aWV3TW9kZWwubm90ZWJvb2tEb2N1bWVudDtcblx0XHR9XG5cdFx0b3ZlcnJpZGUgZ2V0IHJlc291cmNlKCkge1xuXHRcdFx0cmV0dXJuIG1vZGlmaWVkTm90ZWJvb2sudmlld01vZGVsLm5vdGVib29rRG9jdW1lbnQudXJpO1xuXHRcdH1cblx0fTtcblxuXHRjb25zdCBtb2RlbCA9IG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SU5vdGVib29rRGlmZkVkaXRvck1vZGVsPigpIHtcblx0XHRvdmVycmlkZSBnZXQgb3JpZ2luYWwoKSB7XG5cdFx0XHRyZXR1cm4gb3JpZ2luYWxSZXNvdXJjZTtcblx0XHR9XG5cdFx0b3ZlcnJpZGUgZ2V0IG1vZGlmaWVkKCkge1xuXHRcdFx0cmV0dXJuIG1vZGlmaWVkUmVzb3VyY2U7XG5cdFx0fVxuXHR9O1xuXG5cdGNvbnN0IHJlcyA9IGF3YWl0IGNhbGxiYWNrKG1vZGVsLCBkaXNwb3NhYmxlcywgaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRpZiAocmVzIGluc3RhbmNlb2YgUHJvbWlzZSkge1xuXHRcdHJlcy5maW5hbGx5KCgpID0+IHtcblx0XHRcdG9yaWdpbmFsTm90ZWJvb2suZWRpdG9yLmRpc3Bvc2UoKTtcblx0XHRcdG9yaWdpbmFsTm90ZWJvb2sudmlld01vZGVsLm5vdGVib29rRG9jdW1lbnQuZGlzcG9zZSgpO1xuXHRcdFx0b3JpZ2luYWxOb3RlYm9vay52aWV3TW9kZWwuZGlzcG9zZSgpO1xuXHRcdFx0bW9kaWZpZWROb3RlYm9vay5lZGl0b3IuZGlzcG9zZSgpO1xuXHRcdFx0bW9kaWZpZWROb3RlYm9vay52aWV3TW9kZWwubm90ZWJvb2tEb2N1bWVudC5kaXNwb3NlKCk7XG5cdFx0XHRtb2RpZmllZE5vdGVib29rLnZpZXdNb2RlbC5kaXNwb3NlKCk7XG5cdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0gZWxzZSB7XG5cdFx0b3JpZ2luYWxOb3RlYm9vay5lZGl0b3IuZGlzcG9zZSgpO1xuXHRcdG9yaWdpbmFsTm90ZWJvb2sudmlld01vZGVsLm5vdGVib29rRG9jdW1lbnQuZGlzcG9zZSgpO1xuXHRcdG9yaWdpbmFsTm90ZWJvb2sudmlld01vZGVsLmRpc3Bvc2UoKTtcblx0XHRtb2RpZmllZE5vdGVib29rLmVkaXRvci5kaXNwb3NlKCk7XG5cdFx0bW9kaWZpZWROb3RlYm9vay52aWV3TW9kZWwubm90ZWJvb2tEb2N1bWVudC5kaXNwb3NlKCk7XG5cdFx0bW9kaWZpZWROb3RlYm9vay52aWV3TW9kZWwuZGlzcG9zZSgpO1xuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxuXHRyZXR1cm4gcmVzO1xufVxuXG5pbnRlcmZhY2UgSUFjdGl2ZVRlc3ROb3RlYm9va0VkaXRvckRlbGVnYXRlIGV4dGVuZHMgSUFjdGl2ZU5vdGVib29rRWRpdG9yRGVsZWdhdGUge1xuXHR2aXNpYmxlUmFuZ2VzOiBJQ2VsbFJhbmdlW107XG59XG5cbmV4cG9ydCB0eXBlIE1vY2tOb3RlYm9va0NlbGwgPSBbXG5cdHNvdXJjZTogc3RyaW5nLFxuXHRsYW5nOiBzdHJpbmcsXG5cdGtpbmQ6IENlbGxLaW5kLFxuXHRvdXRwdXQ/OiBJT3V0cHV0RHRvW10sXG5cdG1ldGFkYXRhPzogTm90ZWJvb2tDZWxsTWV0YWRhdGEsXG5dO1xuXG5leHBvcnQgdHlwZSBNb2NrRG9jdW1lbnRTeW1ib2wgPSB7XG5cdG5hbWU6IHN0cmluZztcblx0cmFuZ2U6IHt9O1xuXHRraW5kPzogbnVtYmVyO1xuXHRjaGlsZHJlbj86IE1vY2tEb2N1bWVudFN5bWJvbFtdO1xufTtcblxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdpdGhUZXN0Tm90ZWJvb2s8UiA9IGFueT4oY2VsbHM6IE1vY2tOb3RlYm9va0NlbGxbXSwgY2FsbGJhY2s6IChlZGl0b3I6IElBY3RpdmVUZXN0Tm90ZWJvb2tFZGl0b3JEZWxlZ2F0ZSwgdmlld01vZGVsOiBOb3RlYm9va1ZpZXdNb2RlbCwgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSwgYWNjZXNzb3I6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSkgPT4gUHJvbWlzZTxSPiB8IFIsIGFjY2Vzc29yPzogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKTogUHJvbWlzZTxSPiB7XG5cdGNvbnN0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gYWNjZXNzb3IgPz8gc2V0dXBJbnN0YW50aWF0aW9uU2VydmljZShkaXNwb3NhYmxlcyk7XG5cdGNvbnN0IG5vdGVib29rRWRpdG9yID0gX2NyZWF0ZVRlc3ROb3RlYm9va0VkaXRvcihpbnN0YW50aWF0aW9uU2VydmljZSwgZGlzcG9zYWJsZXMsIGNlbGxzKTtcblxuXHRyZXR1cm4gcnVuV2l0aEZha2VkVGltZXJzKHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzID0gYXdhaXQgY2FsbGJhY2sobm90ZWJvb2tFZGl0b3IuZWRpdG9yLCBub3RlYm9va0VkaXRvci52aWV3TW9kZWwsIGRpc3Bvc2FibGVzLCBpbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0aWYgKHJlcyBpbnN0YW5jZW9mIFByb21pc2UpIHtcblx0XHRcdHJlcy5maW5hbGx5KCgpID0+IHtcblx0XHRcdFx0bm90ZWJvb2tFZGl0b3IuZWRpdG9yLmRpc3Bvc2UoKTtcblx0XHRcdFx0bm90ZWJvb2tFZGl0b3Iudmlld01vZGVsLmRpc3Bvc2UoKTtcblx0XHRcdFx0bm90ZWJvb2tFZGl0b3IuZWRpdG9yLnRleHRNb2RlbC5kaXNwb3NlKCk7XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRcdH0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRub3RlYm9va0VkaXRvci5lZGl0b3IuZGlzcG9zZSgpO1xuXHRcdFx0bm90ZWJvb2tFZGl0b3Iudmlld01vZGVsLmRpc3Bvc2UoKTtcblx0XHRcdG5vdGVib29rRWRpdG9yLmVkaXRvci50ZXh0TW9kZWwuZGlzcG9zZSgpO1xuXHRcdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzO1xuXHR9KTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZU5vdGVib29rQ2VsbExpc3QoaW5zdGFudGlhdGlvblNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSwgZGlzcG9zYWJsZXM6IFBpY2s8RGlzcG9zYWJsZVN0b3JlLCAnYWRkJz4sIHZpZXdDb250ZXh0PzogVmlld0NvbnRleHQpIHtcblx0Y29uc3QgZGVsZWdhdGU6IElMaXN0VmlydHVhbERlbGVnYXRlPENlbGxWaWV3TW9kZWw+ID0ge1xuXHRcdGdldEhlaWdodChlbGVtZW50OiBDZWxsVmlld01vZGVsKSB7IHJldHVybiBlbGVtZW50LmdldEhlaWdodCgxNyk7IH0sXG5cdFx0Z2V0VGVtcGxhdGVJZCgpIHsgcmV0dXJuICd0ZW1wbGF0ZSc7IH1cblx0fTtcblxuXHRjb25zdCBiYXNlQ2VsbFJlbmRlclRlbXBsYXRlID0gbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxCYXNlQ2VsbFJlbmRlclRlbXBsYXRlPigpIHsgfTtcblx0Y29uc3QgcmVuZGVyZXI6IElMaXN0UmVuZGVyZXI8Q2VsbFZpZXdNb2RlbCwgQmFzZUNlbGxSZW5kZXJUZW1wbGF0ZT4gPSB7XG5cdFx0dGVtcGxhdGVJZDogJ3RlbXBsYXRlJyxcblx0XHRyZW5kZXJUZW1wbGF0ZSgpIHsgcmV0dXJuIGJhc2VDZWxsUmVuZGVyVGVtcGxhdGU7IH0sXG5cdFx0cmVuZGVyRWxlbWVudCgpIHsgfSxcblx0XHRkaXNwb3NlVGVtcGxhdGUoKSB7IH1cblx0fTtcblxuXHRjb25zdCBub3RlYm9va09wdGlvbnMgPSAhIXZpZXdDb250ZXh0ID8gdmlld0NvbnRleHQubm90ZWJvb2tPcHRpb25zXG5cdFx0OiBkaXNwb3NhYmxlcy5hZGQobmV3IE5vdGVib29rT3B0aW9ucyhtYWluV2luZG93LCBmYWxzZSwgdW5kZWZpbmVkLCBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKSwgaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElOb3RlYm9va0V4ZWN1dGlvblN0YXRlU2VydmljZSksIGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJQ29kZUVkaXRvclNlcnZpY2UpKSk7XG5cdGNvbnN0IGNlbGxMaXN0OiBOb3RlYm9va0NlbGxMaXN0ID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdE5vdGVib29rQ2VsbExpc3QsXG5cdFx0J05vdGVib29rQ2VsbExpc3QnLFxuXHRcdERPTS4kKCdjb250YWluZXInKSxcblx0XHRub3RlYm9va09wdGlvbnMsXG5cdFx0ZGVsZWdhdGUsXG5cdFx0W3JlbmRlcmVyXSxcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5nZXQ8SUNvbnRleHRLZXlTZXJ2aWNlPihJQ29udGV4dEtleVNlcnZpY2UpLFxuXHRcdHtcblx0XHRcdHN1cHBvcnREeW5hbWljSGVpZ2h0czogdHJ1ZSxcblx0XHRcdG11bHRpcGxlU2VsZWN0aW9uU3VwcG9ydDogdHJ1ZSxcblx0XHR9XG5cdCkpO1xuXG5cdHJldHVybiBjZWxsTGlzdDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHZhbHVlQnl0ZXNGcm9tU3RyaW5nKHZhbHVlOiBzdHJpbmcpOiBWU0J1ZmZlciB7XG5cdHJldHVybiBWU0J1ZmZlci5mcm9tU3RyaW5nKHZhbHVlKTtcbn1cblxuY2xhc3MgVGVzdENlbGxFeGVjdXRpb24gaW1wbGVtZW50cyBJTm90ZWJvb2tDZWxsRXhlY3V0aW9uIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgbm90ZWJvb2s6IFVSSSxcblx0XHRyZWFkb25seSBjZWxsSGFuZGxlOiBudW1iZXIsXG5cdFx0cHJpdmF0ZSBvbkNvbXBsZXRlOiAoKSA9PiB2b2lkLFxuXHQpIHsgfVxuXG5cdHJlYWRvbmx5IHN0YXRlOiBOb3RlYm9va0NlbGxFeGVjdXRpb25TdGF0ZSA9IE5vdGVib29rQ2VsbEV4ZWN1dGlvblN0YXRlLlVuY29uZmlybWVkO1xuXG5cdHJlYWRvbmx5IGRpZFBhdXNlOiBib29sZWFuID0gZmFsc2U7XG5cdHJlYWRvbmx5IGlzUGF1c2VkOiBib29sZWFuID0gZmFsc2U7XG5cblx0Y29uZmlybSgpOiB2b2lkIHtcblx0fVxuXG5cdHVwZGF0ZSh1cGRhdGVzOiBJQ2VsbEV4ZWN1dGVVcGRhdGVbXSk6IHZvaWQge1xuXHR9XG5cblx0Y29tcGxldGUoY29tcGxldGU6IElDZWxsRXhlY3V0aW9uQ29tcGxldGUpOiB2b2lkIHtcblx0XHR0aGlzLm9uQ29tcGxldGUoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVGVzdE5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlIGltcGxlbWVudHMgSU5vdGVib29rRXhlY3V0aW9uU3RhdGVTZXJ2aWNlIHtcblx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgX2V4ZWN1dGlvbnMgPSBuZXcgUmVzb3VyY2VNYXA8SU5vdGVib29rQ2VsbEV4ZWN1dGlvbj4oKTtcblxuXHRvbkRpZENoYW5nZUV4ZWN1dGlvbiA9IG5ldyBFbWl0dGVyPElDZWxsRXhlY3V0aW9uU3RhdGVDaGFuZ2VkRXZlbnQgfCBJRXhlY3V0aW9uU3RhdGVDaGFuZ2VkRXZlbnQ+KCkuZXZlbnQ7XG5cdG9uRGlkQ2hhbmdlTGFzdFJ1bkZhaWxTdGF0ZSA9IG5ldyBFbWl0dGVyPElOb3RlYm9va0ZhaWxTdGF0ZUNoYW5nZWRFdmVudD4oKS5ldmVudDtcblxuXHRmb3JjZUNhbmNlbE5vdGVib29rRXhlY3V0aW9ucyhub3RlYm9va1VyaTogVVJJKTogdm9pZCB7XG5cdH1cblxuXHRnZXRDZWxsRXhlY3V0aW9uc0Zvck5vdGVib29rKG5vdGVib29rOiBVUkkpOiBJTm90ZWJvb2tDZWxsRXhlY3V0aW9uW10ge1xuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdGdldENlbGxFeGVjdXRpb24oY2VsbFVyaTogVVJJKTogSU5vdGVib29rQ2VsbEV4ZWN1dGlvbiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2V4ZWN1dGlvbnMuZ2V0KGNlbGxVcmkpO1xuXHR9XG5cblx0Y3JlYXRlQ2VsbEV4ZWN1dGlvbihub3RlYm9vazogVVJJLCBjZWxsSGFuZGxlOiBudW1iZXIpOiBJTm90ZWJvb2tDZWxsRXhlY3V0aW9uIHtcblx0XHRjb25zdCBvbkNvbXBsZXRlID0gKCkgPT4gdGhpcy5fZXhlY3V0aW9ucy5kZWxldGUoQ2VsbFVyaS5nZW5lcmF0ZShub3RlYm9vaywgY2VsbEhhbmRsZSkpO1xuXHRcdGNvbnN0IGV4ZSA9IG5ldyBUZXN0Q2VsbEV4ZWN1dGlvbihub3RlYm9vaywgY2VsbEhhbmRsZSwgb25Db21wbGV0ZSk7XG5cdFx0dGhpcy5fZXhlY3V0aW9ucy5zZXQoQ2VsbFVyaS5nZW5lcmF0ZShub3RlYm9vaywgY2VsbEhhbmRsZSksIGV4ZSk7XG5cdFx0cmV0dXJuIGV4ZTtcblx0fVxuXG5cdGdldENlbGxFeGVjdXRpb25zQnlIYW5kbGVGb3JOb3RlYm9vayhub3RlYm9vazogVVJJKTogTWFwPG51bWJlciwgSU5vdGVib29rQ2VsbEV4ZWN1dGlvbj4gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybjtcblx0fVxuXG5cdGdldExhc3RGYWlsZWRDZWxsRm9yTm90ZWJvb2sobm90ZWJvb2s6IFVSSSk6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cdGdldExhc3RDb21wbGV0ZWRDZWxsRm9yTm90ZWJvb2sobm90ZWJvb2s6IFVSSSk6IG51bWJlciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cdGdldEV4ZWN1dGlvbihub3RlYm9vazogVVJJKTogSU5vdGVib29rRXhlY3V0aW9uIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm47XG5cdH1cblx0Y3JlYXRlRXhlY3V0aW9uKG5vdGVib29rOiBVUkkpOiBJTm90ZWJvb2tFeGVjdXRpb24ge1xuXHRcdHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsWUFBWSxTQUFTO0FBRXJCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsYUFBYTtBQUN0QixTQUFTLFdBQVc7QUFDcEIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsd0NBQXdDO0FBQ2pELFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMseUJBQXlC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a0I7QUFBQSxJQUMvRDtBQUFBLE1BQ0MsdUJBQXVCO0FBQUEsTUFDdkIsMEJBQTBCO0FBQUEsSUFDM0I7QUFBQSxFQUNELENBQUM7QUFFRCxTQUFPO0FBQ1I7QUFFTyxTQUFTLHFCQUFxQixPQUF5QjtBQUM3RCxTQUFPLFNBQVMsV0FBVyxLQUFLO0FBQ2pDO0FBRUEsTUFBTSxrQkFBb0Q7QUFBQSxFQUN6RCxZQUNVLFVBQ0EsWUFDRCxZQUNQO0FBSFE7QUFDQTtBQUNEO0FBR1QsU0FBUyxRQUFvQywyQkFBMkI7QUFFeEUsU0FBUyxXQUFvQjtBQUM3QixTQUFTLFdBQW9CO0FBQUEsRUFMekI7QUFBQSxFQU9KLFVBQWdCO0FBQUEsRUFDaEI7QUFBQSxFQUVBLE9BQU8sU0FBcUM7QUFBQSxFQUM1QztBQUFBLEVBRUEsU0FBUyxVQUF3QztBQUNoRCxTQUFLLFdBQVc7QUFBQSxFQUNqQjtBQUNEO0FBRU8sTUFBTSxrQ0FBNEU7QUFBQSxFQUFsRjtBQUdOLFNBQVEsY0FBYyxJQUFJLFlBQW9DO0FBRTlELGdDQUF1QixJQUFJLFFBQXVFLEVBQUU7QUFDcEcsdUNBQThCLElBQUksUUFBd0MsRUFBRTtBQUFBO0FBQUEsRUFFNUUsOEJBQThCLGFBQXdCO0FBQUEsRUFDdEQ7QUFBQSxFQUVBLDZCQUE2QixVQUF5QztBQUNyRSxXQUFPLENBQUM7QUFBQSxFQUNUO0FBQUEsRUFFQSxpQkFBaUIsU0FBa0Q7QUFDbEUsV0FBTyxLQUFLLFlBQVksSUFBSSxPQUFPO0FBQUEsRUFDcEM7QUFBQSxFQUVBLG9CQUFvQixVQUFlLFlBQTRDO0FBQzlFLFVBQU0sYUFBYSxNQUFNLEtBQUssWUFBWSxPQUFPLFFBQVEsU0FBUyxVQUFVLFVBQVUsQ0FBQztBQUN2RixVQUFNLE1BQU0sSUFBSSxrQkFBa0IsVUFBVSxZQUFZLFVBQVU7QUFDbEUsU0FBSyxZQUFZLElBQUksUUFBUSxTQUFTLFVBQVUsVUFBVSxHQUFHLEdBQUc7QUFDaEUsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLHFDQUFxQyxVQUFnRTtBQUNwRztBQUFBLEVBQ0Q7QUFBQSxFQUVBLDZCQUE2QixVQUFtQztBQUMvRDtBQUFBLEVBQ0Q7QUFBQSxFQUNBLGdDQUFnQyxVQUFtQztBQUNsRTtBQUFBLEVBQ0Q7QUFBQSxFQUNBLGFBQWEsVUFBK0M7QUFDM0Q7QUFBQSxFQUNEO0FBQUEsRUFDQSxnQkFBZ0IsVUFBbUM7QUFDbEQsVUFBTSxJQUFJLE1BQU0seUJBQXlCO0FBQUEsRUFDMUM7QUFDRDsiLAogICJuYW1lcyI6IFtdCn0K
