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
import { asArray } from "../../../base/common/arrays.js";
import { DeferredPromise, timeout } from "../../../base/common/async.js";
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../base/common/map.js";
import { URI } from "../../../base/common/uri.js";
import { ExtensionIdentifier } from "../../../platform/extensions/common/extensions.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { MainContext } from "./extHost.protocol.js";
import { ApiCommand, ApiCommandArgument, ApiCommandResult } from "./extHostCommands.js";
import * as extHostTypeConverters from "./extHostTypeConverters.js";
import { NotebookCellExecutionState as ExtHostNotebookCellExecutionState, NotebookCellOutput, NotebookControllerAffinity2, NotebookVariablesRequestKind } from "./extHostTypes.js";
import { asWebviewUri } from "../../contrib/webview/common/webview.js";
import { CellExecutionUpdateType } from "../../contrib/notebook/common/notebookExecutionService.js";
import { checkProposedApiEnabled } from "../../services/extensions/common/extensions.js";
import { SerializableObjectWithBuffers } from "../../services/extensions/common/proxyIdentifier.js";
import { variablePageSize } from "../../contrib/notebook/common/notebookKernelService.js";
let ExtHostNotebookKernels = class {
  constructor(mainContext, _initData, _extHostNotebook, _commands, _logService) {
    this._initData = _initData;
    this._extHostNotebook = _extHostNotebook;
    this._commands = _commands;
    this._logService = _logService;
    this._activeExecutions = new ResourceMap();
    this._activeNotebookExecutions = new ResourceMap();
    this._kernelDetectionTask = /* @__PURE__ */ new Map();
    this._kernelDetectionTaskHandlePool = 0;
    this._kernelSourceActionProviders = /* @__PURE__ */ new Map();
    this._kernelSourceActionProviderHandlePool = 0;
    this._kernelData = /* @__PURE__ */ new Map();
    this._handlePool = 0;
    this._onDidChangeCellExecutionState = new Emitter();
    this.onDidChangeNotebookCellExecutionState = this._onDidChangeCellExecutionState.event;
    this.id = 0;
    this.variableStore = {};
    this._proxy = mainContext.getProxy(MainContext.MainThreadNotebookKernels);
    const selectKernelApiCommand = new ApiCommand(
      "notebook.selectKernel",
      "_notebook.selectKernel",
      "Trigger kernel picker for specified notebook editor widget",
      [
        new ApiCommandArgument("options", "Select kernel options", (v) => true, (v) => {
          if (v && "notebookEditor" in v && "id" in v) {
            const notebookEditorId = this._extHostNotebook.getIdByEditor(v.notebookEditor);
            return {
              id: v.id,
              extension: v.extension,
              notebookEditorId
            };
          } else if (v && "notebookEditor" in v) {
            const notebookEditorId = this._extHostNotebook.getIdByEditor(v.notebookEditor);
            if (notebookEditorId === void 0) {
              throw new Error(`Cannot invoke 'notebook.selectKernel' for unrecognized notebook editor ${v.notebookEditor.notebook.uri.toString()}`);
            }
            return { notebookEditorId };
          }
          return v;
        })
      ],
      ApiCommandResult.Void
    );
    const requestKernelVariablesApiCommand = new ApiCommand(
      "vscode.executeNotebookVariableProvider",
      "_executeNotebookVariableProvider",
      "Execute notebook variable provider",
      [ApiCommandArgument.Uri],
      new ApiCommandResult("A promise that resolves to an array of variables", (value, apiArgs) => {
        return value.map((variable) => {
          return {
            variable: {
              name: variable.name,
              value: variable.value,
              expression: variable.expression,
              type: variable.type,
              language: variable.language
            },
            hasNamedChildren: variable.hasNamedChildren,
            indexedChildrenCount: variable.indexedChildrenCount
          };
        });
      })
    );
    this._commands.registerApiCommand(selectKernelApiCommand);
    this._commands.registerApiCommand(requestKernelVariablesApiCommand);
  }
  createNotebookController(extension, id, viewType, label, handler, preloads) {
    for (const data2 of this._kernelData.values()) {
      if (data2.controller.id === id && ExtensionIdentifier.equals(extension.identifier, data2.extensionId)) {
        throw new Error(`notebook controller with id '${id}' ALREADY exist`);
      }
    }
    const handle = this._handlePool++;
    const that = this;
    this._logService.trace(`NotebookController[${handle}], CREATED by ${extension.identifier.value}, ${id}`);
    const _defaultExecutHandler = () => console.warn(`NO execute handler from notebook controller '${data.id}' of extension: '${extension.identifier}'`);
    let isDisposed = false;
    const onDidChangeSelection = new Emitter();
    const onDidReceiveMessage = new Emitter();
    const data = {
      id: createKernelId(extension.identifier, id),
      notebookType: viewType,
      extensionId: extension.identifier,
      extensionLocation: extension.extensionLocation,
      label: label || extension.identifier.value,
      preloads: preloads ? preloads.map(extHostTypeConverters.NotebookRendererScript.from) : []
    };
    let _executeHandler = handler ?? _defaultExecutHandler;
    let _interruptHandler;
    let _variableProvider;
    this._proxy.$addKernel(handle, data).catch((err) => {
      console.log(err);
      isDisposed = true;
    });
    let tokenPool = 0;
    const _update = () => {
      if (isDisposed) {
        return;
      }
      const myToken = ++tokenPool;
      Promise.resolve().then(() => {
        if (myToken === tokenPool) {
          this._proxy.$updateKernel(handle, data);
        }
      });
    };
    const associatedNotebooks = new ResourceMap();
    const controller = {
      get id() {
        return id;
      },
      get notebookType() {
        return data.notebookType;
      },
      onDidChangeSelectedNotebooks: onDidChangeSelection.event,
      get label() {
        return data.label;
      },
      set label(value) {
        data.label = value ?? extension.displayName ?? extension.name;
        _update();
      },
      get detail() {
        return data.detail ?? "";
      },
      set detail(value) {
        data.detail = value;
        _update();
      },
      get description() {
        return data.description ?? "";
      },
      set description(value) {
        data.description = value;
        _update();
      },
      get supportedLanguages() {
        return data.supportedLanguages;
      },
      set supportedLanguages(value) {
        data.supportedLanguages = value;
        _update();
      },
      get supportsExecutionOrder() {
        return data.supportsExecutionOrder ?? false;
      },
      set supportsExecutionOrder(value) {
        data.supportsExecutionOrder = value;
        _update();
      },
      get rendererScripts() {
        return data.preloads ? data.preloads.map(extHostTypeConverters.NotebookRendererScript.to) : [];
      },
      get executeHandler() {
        return _executeHandler;
      },
      set executeHandler(value) {
        _executeHandler = value ?? _defaultExecutHandler;
      },
      get interruptHandler() {
        return _interruptHandler;
      },
      set interruptHandler(value) {
        _interruptHandler = value;
        data.supportsInterrupt = Boolean(value);
        _update();
      },
      set variableProvider(value) {
        checkProposedApiEnabled(extension, "notebookVariableProvider");
        _variableProvider = value;
        data.hasVariableProvider = !!value;
        value?.onDidChangeVariables((e) => that._proxy.$variablesUpdated(e.uri));
        _update();
      },
      get variableProvider() {
        return _variableProvider;
      },
      createNotebookCellExecution(cell) {
        if (isDisposed) {
          throw new Error("notebook controller is DISPOSED");
        }
        if (!associatedNotebooks.has(cell.notebook.uri)) {
          that._logService.trace(`NotebookController[${handle}] NOT associated to notebook, associated to THESE notebooks:`, Array.from(associatedNotebooks.keys()).map((u) => u.toString()));
          throw new Error(`notebook controller is NOT associated to notebook: ${cell.notebook.uri.toString()}`);
        }
        return that._createNotebookCellExecution(cell, createKernelId(extension.identifier, this.id));
      },
      createNotebookExecution(notebook) {
        checkProposedApiEnabled(extension, "notebookExecution");
        if (isDisposed) {
          throw new Error("notebook controller is DISPOSED");
        }
        if (!associatedNotebooks.has(notebook.uri)) {
          that._logService.trace(`NotebookController[${handle}] NOT associated to notebook, associated to THESE notebooks:`, Array.from(associatedNotebooks.keys()).map((u) => u.toString()));
          throw new Error(`notebook controller is NOT associated to notebook: ${notebook.uri.toString()}`);
        }
        return that._createNotebookExecution(notebook, createKernelId(extension.identifier, this.id));
      },
      dispose: () => {
        if (!isDisposed) {
          this._logService.trace(`NotebookController[${handle}], DISPOSED`);
          isDisposed = true;
          this._kernelData.delete(handle);
          onDidChangeSelection.dispose();
          onDidReceiveMessage.dispose();
          this._proxy.$removeKernel(handle);
        }
      },
      // --- priority
      updateNotebookAffinity(notebook, priority) {
        if (priority === NotebookControllerAffinity2.Hidden) {
          checkProposedApiEnabled(extension, "notebookControllerAffinityHidden");
        }
        that._proxy.$updateNotebookPriority(handle, notebook.uri, priority);
      },
      // --- ipc
      onDidReceiveMessage: onDidReceiveMessage.event,
      postMessage(message, editor) {
        checkProposedApiEnabled(extension, "notebookMessaging");
        return that._proxy.$postMessage(handle, editor && that._extHostNotebook.getIdByEditor(editor), message);
      },
      asWebviewUri(uri) {
        checkProposedApiEnabled(extension, "notebookMessaging");
        return asWebviewUri(uri, that._initData.remote);
      }
    };
    this._kernelData.set(handle, {
      extensionId: extension.identifier,
      controller,
      onDidReceiveMessage,
      onDidChangeSelection,
      associatedNotebooks
    });
    return controller;
  }
  getIdByController(controller) {
    for (const [_, candidate] of this._kernelData) {
      if (candidate.controller === controller) {
        return createKernelId(candidate.extensionId, controller.id);
      }
    }
    return null;
  }
  createNotebookControllerDetectionTask(extension, viewType) {
    const handle = this._kernelDetectionTaskHandlePool++;
    const that = this;
    this._logService.trace(`NotebookControllerDetectionTask[${handle}], CREATED by ${extension.identifier.value}`);
    this._proxy.$addKernelDetectionTask(handle, viewType);
    const detectionTask = {
      dispose: () => {
        this._kernelDetectionTask.delete(handle);
        that._proxy.$removeKernelDetectionTask(handle);
      }
    };
    this._kernelDetectionTask.set(handle, detectionTask);
    return detectionTask;
  }
  registerKernelSourceActionProvider(extension, viewType, provider) {
    const handle = this._kernelSourceActionProviderHandlePool++;
    const eventHandle = typeof provider.onDidChangeNotebookKernelSourceActions === "function" ? handle : void 0;
    const that = this;
    this._kernelSourceActionProviders.set(handle, provider);
    this._logService.trace(`NotebookKernelSourceActionProvider[${handle}], CREATED by ${extension.identifier.value}`);
    this._proxy.$addKernelSourceActionProvider(handle, handle, viewType);
    let subscription;
    if (eventHandle !== void 0) {
      subscription = provider.onDidChangeNotebookKernelSourceActions((_) => this._proxy.$emitNotebookKernelSourceActionsChangeEvent(eventHandle));
    }
    return {
      dispose: () => {
        this._kernelSourceActionProviders.delete(handle);
        that._proxy.$removeKernelSourceActionProvider(handle, handle);
        subscription?.dispose();
      }
    };
  }
  async $provideKernelSourceActions(handle, token) {
    const provider = this._kernelSourceActionProviders.get(handle);
    if (provider) {
      const disposables = new DisposableStore();
      const ret = await provider.provideNotebookKernelSourceActions(token);
      return (ret ?? []).map((item) => extHostTypeConverters.NotebookKernelSourceAction.from(item, this._commands.converter, disposables));
    }
    return [];
  }
  $acceptNotebookAssociation(handle, uri, value) {
    const obj = this._kernelData.get(handle);
    if (obj) {
      const notebook = this._extHostNotebook.getNotebookDocument(URI.revive(uri));
      if (value) {
        obj.associatedNotebooks.set(notebook.uri, true);
      } else {
        obj.associatedNotebooks.delete(notebook.uri);
      }
      this._logService.trace(`NotebookController[${handle}] ASSOCIATE notebook`, notebook.uri.toString(), value);
      obj.onDidChangeSelection.fire({
        selected: value,
        notebook: notebook.apiNotebook
      });
    }
  }
  async $executeCells(handle, uri, handles) {
    const obj = this._kernelData.get(handle);
    if (!obj) {
      return;
    }
    const document = this._extHostNotebook.getNotebookDocument(URI.revive(uri));
    const cells = [];
    for (const cellHandle of handles) {
      const cell = document.getCell(cellHandle);
      if (cell) {
        cells.push(cell.apiCell);
      }
    }
    try {
      this._logService.trace(`NotebookController[${handle}] EXECUTE cells`, document.uri.toString(), cells.length);
      await obj.controller.executeHandler.call(obj.controller, cells, document.apiNotebook, obj.controller);
    } catch (err) {
      this._logService.error(`NotebookController[${handle}] execute cells FAILED`, err);
      console.error(err);
    }
  }
  async $cancelCells(handle, uri, handles) {
    const obj = this._kernelData.get(handle);
    if (!obj) {
      return;
    }
    const document = this._extHostNotebook.getNotebookDocument(URI.revive(uri));
    if (obj.controller.interruptHandler) {
      await obj.controller.interruptHandler.call(obj.controller, document.apiNotebook);
    } else {
      for (const cellHandle of handles) {
        const cell = document.getCell(cellHandle);
        if (cell) {
          this._activeExecutions.get(cell.uri)?.cancel();
        }
      }
    }
    if (obj.controller.interruptHandler) {
      const items = this._activeNotebookExecutions.get(document.uri);
      this._activeNotebookExecutions.delete(document.uri);
      if (handles.length && Array.isArray(items) && items.length) {
        items.forEach((d) => d.dispose());
      }
    }
  }
  async $provideVariables(handle, requestId, notebookUri, parentId, kind, start, token) {
    const obj = this._kernelData.get(handle);
    if (!obj) {
      return;
    }
    const document = this._extHostNotebook.getNotebookDocument(URI.revive(notebookUri));
    const variableProvider = obj.controller.variableProvider;
    if (!variableProvider) {
      return;
    }
    let parent = void 0;
    if (parentId !== void 0) {
      parent = this.variableStore[parentId];
      if (!parent) {
        return;
      }
    } else {
      this.variableStore = {};
    }
    const requestKind = kind === "named" ? NotebookVariablesRequestKind.Named : NotebookVariablesRequestKind.Indexed;
    const variableResults = variableProvider.provideVariables(document.apiNotebook, parent, requestKind, start, token);
    let resultCount = 0;
    for await (const result of variableResults) {
      if (token.isCancellationRequested) {
        return;
      }
      const variable = {
        id: this.id++,
        name: result.variable.name,
        value: result.variable.value,
        type: result.variable.type,
        interfaces: result.variable.interfaces,
        language: result.variable.language,
        expression: result.variable.expression,
        hasNamedChildren: result.hasNamedChildren,
        indexedChildrenCount: result.indexedChildrenCount,
        extensionId: obj.extensionId.value
      };
      this.variableStore[variable.id] = result.variable;
      this._proxy.$receiveVariable(requestId, variable);
      if (resultCount++ >= variablePageSize) {
        return;
      }
    }
  }
  $acceptKernelMessageFromRenderer(handle, editorId, message) {
    const obj = this._kernelData.get(handle);
    if (!obj) {
      return;
    }
    const editor = this._extHostNotebook.getEditorById(editorId);
    obj.onDidReceiveMessage.fire(Object.freeze({ editor: editor.apiEditor, message }));
  }
  $cellExecutionChanged(uri, cellHandle, state) {
    const document = this._extHostNotebook.getNotebookDocument(URI.revive(uri));
    const cell = document.getCell(cellHandle);
    if (cell) {
      const newState = state ? extHostTypeConverters.NotebookCellExecutionState.to(state) : ExtHostNotebookCellExecutionState.Idle;
      if (newState !== void 0) {
        this._onDidChangeCellExecutionState.fire({
          cell: cell.apiCell,
          state: newState
        });
      }
    }
  }
  // ---
  _createNotebookCellExecution(cell, controllerId) {
    if (cell.index < 0) {
      throw new Error("CANNOT execute cell that has been REMOVED from notebook");
    }
    const notebook = this._extHostNotebook.getNotebookDocument(cell.notebook.uri);
    const cellObj = notebook.getCellFromApiCell(cell);
    if (!cellObj) {
      throw new Error("invalid cell");
    }
    if (this._activeExecutions.has(cellObj.uri)) {
      throw new Error(`duplicate execution for ${cellObj.uri}`);
    }
    const execution = new NotebookCellExecutionTask(controllerId, cellObj, this._proxy);
    this._activeExecutions.set(cellObj.uri, execution);
    const listener = execution.onDidChangeState(() => {
      if (execution.state === 2 /* Resolved */) {
        execution.dispose();
        listener.dispose();
        this._activeExecutions.delete(cellObj.uri);
      }
    });
    return execution.asApiObject();
  }
  // ---
  _createNotebookExecution(nb, controllerId) {
    const notebook = this._extHostNotebook.getNotebookDocument(nb.uri);
    const runningCell = nb.getCells().find((cell) => {
      const apiCell = notebook.getCellFromApiCell(cell);
      return apiCell && this._activeExecutions.has(apiCell.uri);
    });
    if (runningCell) {
      throw new Error(`duplicate cell execution for ${runningCell.document.uri}`);
    }
    if (this._activeNotebookExecutions.has(notebook.uri)) {
      throw new Error(`duplicate notebook execution for ${notebook.uri}`);
    }
    const execution = new NotebookExecutionTask(controllerId, notebook, this._proxy);
    const listener = execution.onDidChangeState(() => {
      if (execution.state === 2 /* Resolved */) {
        execution.dispose();
        listener.dispose();
        this._activeNotebookExecutions.delete(notebook.uri);
      }
    });
    this._activeNotebookExecutions.set(notebook.uri, [execution, listener]);
    return execution.asApiObject();
  }
};
ExtHostNotebookKernels = __decorateClass([
  __decorateParam(4, ILogService)
], ExtHostNotebookKernels);
var NotebookCellExecutionTaskState = /* @__PURE__ */ ((NotebookCellExecutionTaskState2) => {
  NotebookCellExecutionTaskState2[NotebookCellExecutionTaskState2["Init"] = 0] = "Init";
  NotebookCellExecutionTaskState2[NotebookCellExecutionTaskState2["Started"] = 1] = "Started";
  NotebookCellExecutionTaskState2[NotebookCellExecutionTaskState2["Resolved"] = 2] = "Resolved";
  return NotebookCellExecutionTaskState2;
})(NotebookCellExecutionTaskState || {});
const _NotebookCellExecutionTask = class _NotebookCellExecutionTask extends Disposable {
  constructor(controllerId, _cell, _proxy) {
    super();
    this._cell = _cell;
    this._proxy = _proxy;
    this._handle = _NotebookCellExecutionTask.HANDLE++;
    this._onDidChangeState = new Emitter();
    this.onDidChangeState = this._onDidChangeState.event;
    this._state = 0 /* Init */;
    this._tokenSource = this._register(new CancellationTokenSource());
    this._collector = new TimeoutBasedCollector(10, (updates) => this.update(updates));
    this._executionOrder = _cell.internalMetadata.executionOrder;
    this._proxy.$createExecution(this._handle, controllerId, this._cell.notebook.uri, this._cell.handle);
  }
  get state() {
    return this._state;
  }
  cancel() {
    this._tokenSource.cancel();
  }
  async updateSoon(update) {
    await this._collector.addItem(update);
  }
  async update(update) {
    const updates = Array.isArray(update) ? update : [update];
    return this._proxy.$updateExecution(this._handle, new SerializableObjectWithBuffers(updates));
  }
  verifyStateForOutput() {
    if (this._state === 0 /* Init */) {
      throw new Error("Must call start before modifying cell output");
    }
    if (this._state === 2 /* Resolved */) {
      throw new Error("Cannot modify cell output after calling resolve");
    }
  }
  cellIndexToHandle(cellOrCellIndex) {
    let cell = this._cell;
    if (cellOrCellIndex) {
      cell = this._cell.notebook.getCellFromApiCell(cellOrCellIndex);
    }
    if (!cell) {
      throw new Error("INVALID cell");
    }
    return cell.handle;
  }
  validateAndConvertOutputs(items) {
    return items.map((output) => {
      const newOutput = NotebookCellOutput.ensureUniqueMimeTypes(output.items, true);
      if (newOutput === output.items) {
        return extHostTypeConverters.NotebookCellOutput.from(output);
      }
      return extHostTypeConverters.NotebookCellOutput.from({
        items: newOutput,
        id: output.id,
        metadata: output.metadata
      });
    });
  }
  async updateOutputs(outputs, cell, append) {
    const handle = this.cellIndexToHandle(cell);
    const outputDtos = this.validateAndConvertOutputs(asArray(outputs));
    return this.updateSoon(
      {
        editType: CellExecutionUpdateType.Output,
        cellHandle: handle,
        append,
        outputs: outputDtos
      }
    );
  }
  async updateOutputItems(items, output, append) {
    items = NotebookCellOutput.ensureUniqueMimeTypes(asArray(items), true);
    return this.updateSoon({
      editType: CellExecutionUpdateType.OutputItems,
      items: items.map(extHostTypeConverters.NotebookCellOutputItem.from),
      outputId: output.id,
      append
    });
  }
  asApiObject() {
    const that = this;
    const result = {
      get token() {
        return that._tokenSource.token;
      },
      get cell() {
        return that._cell.apiCell;
      },
      get executionOrder() {
        return that._executionOrder;
      },
      set executionOrder(v) {
        that._executionOrder = v;
        that.update([{
          editType: CellExecutionUpdateType.ExecutionState,
          executionOrder: that._executionOrder
        }]);
      },
      start(startTime) {
        if (that._state === 2 /* Resolved */ || that._state === 1 /* Started */) {
          throw new Error("Cannot call start again");
        }
        that._state = 1 /* Started */;
        that._onDidChangeState.fire();
        that.update({
          editType: CellExecutionUpdateType.ExecutionState,
          runStartTime: startTime
        });
      },
      end(success, endTime, executionError) {
        if (that._state === 2 /* Resolved */) {
          throw new Error("Cannot call resolve twice");
        }
        that._state = 2 /* Resolved */;
        that._onDidChangeState.fire();
        that._collector.flush();
        const error = createSerializeableError(executionError);
        that._proxy.$completeExecution(that._handle, new SerializableObjectWithBuffers({
          runEndTime: endTime,
          lastRunSuccess: success,
          error
        }));
      },
      clearOutput(cell) {
        that.verifyStateForOutput();
        return that.updateOutputs([], cell, false);
      },
      appendOutput(outputs, cell) {
        that.verifyStateForOutput();
        return that.updateOutputs(outputs, cell, true);
      },
      replaceOutput(outputs, cell) {
        that.verifyStateForOutput();
        return that.updateOutputs(outputs, cell, false);
      },
      appendOutputItems(items, output) {
        that.verifyStateForOutput();
        return that.updateOutputItems(items, output, true);
      },
      replaceOutputItems(items, output) {
        that.verifyStateForOutput();
        return that.updateOutputItems(items, output, false);
      }
    };
    return Object.freeze(result);
  }
};
_NotebookCellExecutionTask.HANDLE = 0;
let NotebookCellExecutionTask = _NotebookCellExecutionTask;
function createSerializeableError(executionError) {
  const convertRange = (range) => range ? {
    startLineNumber: range.start.line,
    startColumn: range.start.character,
    endLineNumber: range.end.line,
    endColumn: range.end.character
  } : void 0;
  const convertStackFrame = (frame) => ({
    uri: frame.uri,
    position: frame.position,
    label: frame.label
  });
  const error = executionError ? {
    name: executionError.name,
    message: executionError.message,
    stack: executionError.stack instanceof Array ? executionError.stack.map((frame) => convertStackFrame(frame)) : executionError.stack,
    location: convertRange(executionError.location),
    uri: executionError.uri
  } : void 0;
  return error;
}
var NotebookExecutionTaskState = /* @__PURE__ */ ((NotebookExecutionTaskState2) => {
  NotebookExecutionTaskState2[NotebookExecutionTaskState2["Init"] = 0] = "Init";
  NotebookExecutionTaskState2[NotebookExecutionTaskState2["Started"] = 1] = "Started";
  NotebookExecutionTaskState2[NotebookExecutionTaskState2["Resolved"] = 2] = "Resolved";
  return NotebookExecutionTaskState2;
})(NotebookExecutionTaskState || {});
const _NotebookExecutionTask = class _NotebookExecutionTask extends Disposable {
  constructor(controllerId, _notebook, _proxy) {
    super();
    this._notebook = _notebook;
    this._proxy = _proxy;
    this._handle = _NotebookExecutionTask.HANDLE++;
    this._onDidChangeState = new Emitter();
    this.onDidChangeState = this._onDidChangeState.event;
    this._state = 0 /* Init */;
    this._tokenSource = this._register(new CancellationTokenSource());
    this._proxy.$createNotebookExecution(this._handle, controllerId, this._notebook.uri);
  }
  get state() {
    return this._state;
  }
  cancel() {
    this._tokenSource.cancel();
  }
  asApiObject() {
    const result = {
      start: () => {
        if (this._state === 2 /* Resolved */ || this._state === 1 /* Started */) {
          throw new Error("Cannot call start again");
        }
        this._state = 1 /* Started */;
        this._onDidChangeState.fire();
        this._proxy.$beginNotebookExecution(this._handle);
      },
      end: () => {
        if (this._state === 2 /* Resolved */) {
          throw new Error("Cannot call resolve twice");
        }
        this._state = 2 /* Resolved */;
        this._onDidChangeState.fire();
        this._proxy.$completeNotebookExecution(this._handle);
      }
    };
    return Object.freeze(result);
  }
};
_NotebookExecutionTask.HANDLE = 0;
let NotebookExecutionTask = _NotebookExecutionTask;
class TimeoutBasedCollector {
  constructor(delay, callback) {
    this.delay = delay;
    this.callback = callback;
    this.batch = [];
    this.startedTimer = Date.now();
  }
  addItem(item) {
    this.batch.push(item);
    if (!this.currentDeferred) {
      this.currentDeferred = new DeferredPromise();
      this.startedTimer = Date.now();
      timeout(this.delay).then(() => {
        return this.flush();
      });
    }
    if (Date.now() - this.startedTimer > this.delay) {
      return this.flush();
    }
    return this.currentDeferred.p;
  }
  flush() {
    if (this.batch.length === 0 || !this.currentDeferred) {
      return Promise.resolve();
    }
    const deferred = this.currentDeferred;
    this.currentDeferred = void 0;
    const batch = this.batch;
    this.batch = [];
    return this.callback(batch).finally(() => deferred.complete());
  }
}
function createKernelId(extensionIdentifier, id) {
  return `${extensionIdentifier.value}/${id}`;
}
export {
  ExtHostNotebookKernels,
  createKernelId
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0Tm90ZWJvb2tLZXJuZWxzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgYXNBcnJheSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UsIHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbklkZW50aWZpZXIsIElFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0Tm90ZWJvb2tLZXJuZWxzU2hhcGUsIElDZWxsRXhlY3V0ZVVwZGF0ZUR0bywgSU1haW5Db250ZXh0LCBJTm90ZWJvb2tLZXJuZWxEdG8yLCBNYWluQ29udGV4dCwgTWFpblRocmVhZE5vdGVib29rS2VybmVsc1NoYXBlLCBOb3RlYm9va091dHB1dER0bywgVmFyaWFibGVzUmVzdWx0IH0gZnJvbSAnLi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7IEFwaUNvbW1hbmQsIEFwaUNvbW1hbmRBcmd1bWVudCwgQXBpQ29tbWFuZFJlc3VsdCwgRXh0SG9zdENvbW1hbmRzIH0gZnJvbSAnLi9leHRIb3N0Q29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RJbml0RGF0YVNlcnZpY2UgfSBmcm9tICcuL2V4dEhvc3RJbml0RGF0YVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRXh0SG9zdE5vdGVib29rQ29udHJvbGxlciB9IGZyb20gJy4vZXh0SG9zdE5vdGVib29rLmpzJztcbmltcG9ydCB7IEV4dEhvc3RDZWxsLCBFeHRIb3N0Tm90ZWJvb2tEb2N1bWVudCB9IGZyb20gJy4vZXh0SG9zdE5vdGVib29rRG9jdW1lbnQuanMnO1xuaW1wb3J0ICogYXMgZXh0SG9zdFR5cGVDb252ZXJ0ZXJzIGZyb20gJy4vZXh0SG9zdFR5cGVDb252ZXJ0ZXJzLmpzJztcbmltcG9ydCB7IE5vdGVib29rQ2VsbEV4ZWN1dGlvblN0YXRlIGFzIEV4dEhvc3ROb3RlYm9va0NlbGxFeGVjdXRpb25TdGF0ZSwgTm90ZWJvb2tDZWxsT3V0cHV0LCBOb3RlYm9va0NvbnRyb2xsZXJBZmZpbml0eTIsIE5vdGVib29rVmFyaWFibGVzUmVxdWVzdEtpbmQgfSBmcm9tICcuL2V4dEhvc3RUeXBlcy5qcyc7XG5pbXBvcnQgeyBhc1dlYnZpZXdVcmkgfSBmcm9tICcuLi8uLi9jb250cmliL3dlYnZpZXcvY29tbW9uL3dlYnZpZXcuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rS2VybmVsU291cmNlQWN0aW9uLCBOb3RlYm9va0NlbGxFeGVjdXRpb25TdGF0ZSB9IGZyb20gJy4uLy4uL2NvbnRyaWIvbm90ZWJvb2svY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IENlbGxFeGVjdXRpb25VcGRhdGVUeXBlIH0gZnJvbSAnLi4vLi4vY29udHJpYi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tFeGVjdXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBTZXJpYWxpemFibGVPYmplY3RXaXRoQnVmZmVycyB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL3Byb3h5SWRlbnRpZmllci5qcyc7XG5pbXBvcnQgKiBhcyB2c2NvZGUgZnJvbSAndnNjb2RlJztcbmltcG9ydCB7IHZhcmlhYmxlUGFnZVNpemUgfSBmcm9tICcuLi8uLi9jb250cmliL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0tlcm5lbFNlcnZpY2UuanMnO1xuXG5pbnRlcmZhY2UgSUtlcm5lbERhdGEge1xuXHRleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllcjtcblx0Y29udHJvbGxlcjogdnNjb2RlLk5vdGVib29rQ29udHJvbGxlcjtcblx0b25EaWRDaGFuZ2VTZWxlY3Rpb246IEVtaXR0ZXI8eyBzZWxlY3RlZDogYm9vbGVhbjsgbm90ZWJvb2s6IHZzY29kZS5Ob3RlYm9va0RvY3VtZW50IH0+O1xuXHRvbkRpZFJlY2VpdmVNZXNzYWdlOiBFbWl0dGVyPHsgZWRpdG9yOiB2c2NvZGUuTm90ZWJvb2tFZGl0b3I7IG1lc3NhZ2U6IGFueSB9Pjtcblx0YXNzb2NpYXRlZE5vdGVib29rczogUmVzb3VyY2VNYXA8Ym9vbGVhbj47XG59XG5cbnR5cGUgRXh0SG9zdFNlbGVjdEtlcm5lbEFyZ3MgPSBDb250cm9sbGVySW5mbyB8IHsgbm90ZWJvb2tFZGl0b3I6IHZzY29kZS5Ob3RlYm9va0VkaXRvciB9IHwgQ29udHJvbGxlckluZm8gJiB7IG5vdGVib29rRWRpdG9yOiB2c2NvZGUuTm90ZWJvb2tFZGl0b3IgfSB8IHVuZGVmaW5lZDtcbnR5cGUgU2VsZWN0S2VybmVsUmV0dXJuQXJncyA9IENvbnRyb2xsZXJJbmZvIHwgeyBub3RlYm9va0VkaXRvcklkOiBzdHJpbmcgfSB8IENvbnRyb2xsZXJJbmZvICYgeyBub3RlYm9va0VkaXRvcklkOiBzdHJpbmcgfSB8IHVuZGVmaW5lZDtcbnR5cGUgQ29udHJvbGxlckluZm8gPSB7IGlkOiBzdHJpbmc7IGV4dGVuc2lvbjogc3RyaW5nIH07XG5cblxuZXhwb3J0IGNsYXNzIEV4dEhvc3ROb3RlYm9va0tlcm5lbHMgaW1wbGVtZW50cyBFeHRIb3N0Tm90ZWJvb2tLZXJuZWxzU2hhcGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBNYWluVGhyZWFkTm90ZWJvb2tLZXJuZWxzU2hhcGU7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2FjdGl2ZUV4ZWN1dGlvbnMgPSBuZXcgUmVzb3VyY2VNYXA8Tm90ZWJvb2tDZWxsRXhlY3V0aW9uVGFzaz4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfYWN0aXZlTm90ZWJvb2tFeGVjdXRpb25zID0gbmV3IFJlc291cmNlTWFwPFtOb3RlYm9va0V4ZWN1dGlvblRhc2ssIElEaXNwb3NhYmxlXT4oKTtcblxuXHRwcml2YXRlIF9rZXJuZWxEZXRlY3Rpb25UYXNrID0gbmV3IE1hcDxudW1iZXIsIHZzY29kZS5Ob3RlYm9va0NvbnRyb2xsZXJEZXRlY3Rpb25UYXNrPigpO1xuXHRwcml2YXRlIF9rZXJuZWxEZXRlY3Rpb25UYXNrSGFuZGxlUG9vbDogbnVtYmVyID0gMDtcblxuXHRwcml2YXRlIF9rZXJuZWxTb3VyY2VBY3Rpb25Qcm92aWRlcnMgPSBuZXcgTWFwPG51bWJlciwgdnNjb2RlLk5vdGVib29rS2VybmVsU291cmNlQWN0aW9uUHJvdmlkZXI+KCk7XG5cdHByaXZhdGUgX2tlcm5lbFNvdXJjZUFjdGlvblByb3ZpZGVySGFuZGxlUG9vbDogbnVtYmVyID0gMDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9rZXJuZWxEYXRhID0gbmV3IE1hcDxudW1iZXIsIElLZXJuZWxEYXRhPigpO1xuXHRwcml2YXRlIF9oYW5kbGVQb29sOiBudW1iZXIgPSAwO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQ2VsbEV4ZWN1dGlvblN0YXRlID0gbmV3IEVtaXR0ZXI8dnNjb2RlLk5vdGVib29rQ2VsbEV4ZWN1dGlvblN0YXRlQ2hhbmdlRXZlbnQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlTm90ZWJvb2tDZWxsRXhlY3V0aW9uU3RhdGUgPSB0aGlzLl9vbkRpZENoYW5nZUNlbGxFeGVjdXRpb25TdGF0ZS5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRtYWluQ29udGV4dDogSU1haW5Db250ZXh0LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2luaXREYXRhOiBJRXh0SG9zdEluaXREYXRhU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9leHRIb3N0Tm90ZWJvb2s6IEV4dEhvc3ROb3RlYm9va0NvbnRyb2xsZXIsXG5cdFx0cHJpdmF0ZSBfY29tbWFuZHM6IEV4dEhvc3RDb21tYW5kcyxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdCkge1xuXHRcdHRoaXMuX3Byb3h5ID0gbWFpbkNvbnRleHQuZ2V0UHJveHkoTWFpbkNvbnRleHQuTWFpblRocmVhZE5vdGVib29rS2VybmVscyk7XG5cblx0XHQvLyB0b2RvQHJlYm9ybml4IEBqb3ljZWVyaGw6IG1vdmUgdG8gQVBJQ29tbWFuZHMgb25jZSBzdGFiaWxpemVkLlxuXHRcdGNvbnN0IHNlbGVjdEtlcm5lbEFwaUNvbW1hbmQgPSBuZXcgQXBpQ29tbWFuZChcblx0XHRcdCdub3RlYm9vay5zZWxlY3RLZXJuZWwnLFxuXHRcdFx0J19ub3RlYm9vay5zZWxlY3RLZXJuZWwnLFxuXHRcdFx0J1RyaWdnZXIga2VybmVsIHBpY2tlciBmb3Igc3BlY2lmaWVkIG5vdGVib29rIGVkaXRvciB3aWRnZXQnLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgQXBpQ29tbWFuZEFyZ3VtZW50PEV4dEhvc3RTZWxlY3RLZXJuZWxBcmdzLCBTZWxlY3RLZXJuZWxSZXR1cm5BcmdzPignb3B0aW9ucycsICdTZWxlY3Qga2VybmVsIG9wdGlvbnMnLCB2ID0+IHRydWUsICh2OiBFeHRIb3N0U2VsZWN0S2VybmVsQXJncykgPT4ge1xuXHRcdFx0XHRcdGlmICh2ICYmICdub3RlYm9va0VkaXRvcicgaW4gdiAmJiAnaWQnIGluIHYpIHtcblx0XHRcdFx0XHRcdGNvbnN0IG5vdGVib29rRWRpdG9ySWQgPSB0aGlzLl9leHRIb3N0Tm90ZWJvb2suZ2V0SWRCeUVkaXRvcih2Lm5vdGVib29rRWRpdG9yKTtcblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdGlkOiB2LmlkLCBleHRlbnNpb246IHYuZXh0ZW5zaW9uLCBub3RlYm9va0VkaXRvcklkXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAodiAmJiAnbm90ZWJvb2tFZGl0b3InIGluIHYpIHtcblx0XHRcdFx0XHRcdGNvbnN0IG5vdGVib29rRWRpdG9ySWQgPSB0aGlzLl9leHRIb3N0Tm90ZWJvb2suZ2V0SWRCeUVkaXRvcih2Lm5vdGVib29rRWRpdG9yKTtcblx0XHRcdFx0XHRcdGlmIChub3RlYm9va0VkaXRvcklkID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBDYW5ub3QgaW52b2tlICdub3RlYm9vay5zZWxlY3RLZXJuZWwnIGZvciB1bnJlY29nbml6ZWQgbm90ZWJvb2sgZWRpdG9yICR7di5ub3RlYm9va0VkaXRvci5ub3RlYm9vay51cmkudG9TdHJpbmcoKX1gKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdHJldHVybiB7IG5vdGVib29rRWRpdG9ySWQgfTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuIHY7XG5cdFx0XHRcdH0pXG5cdFx0XHRdLFxuXHRcdFx0QXBpQ29tbWFuZFJlc3VsdC5Wb2lkKTtcblxuXHRcdGNvbnN0IHJlcXVlc3RLZXJuZWxWYXJpYWJsZXNBcGlDb21tYW5kID0gbmV3IEFwaUNvbW1hbmQoXG5cdFx0XHQndnNjb2RlLmV4ZWN1dGVOb3RlYm9va1ZhcmlhYmxlUHJvdmlkZXInLFxuXHRcdFx0J19leGVjdXRlTm90ZWJvb2tWYXJpYWJsZVByb3ZpZGVyJyxcblx0XHRcdCdFeGVjdXRlIG5vdGVib29rIHZhcmlhYmxlIHByb3ZpZGVyJyxcblx0XHRcdFtBcGlDb21tYW5kQXJndW1lbnQuVXJpXSxcblx0XHRcdG5ldyBBcGlDb21tYW5kUmVzdWx0PFZhcmlhYmxlc1Jlc3VsdFtdLCB2c2NvZGUuVmFyaWFibGVzUmVzdWx0W10+KCdBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhbiBhcnJheSBvZiB2YXJpYWJsZXMnLCAodmFsdWUsIGFwaUFyZ3MpID0+IHtcblx0XHRcdFx0cmV0dXJuIHZhbHVlLm1hcCh2YXJpYWJsZSA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHZhcmlhYmxlOiB7XG5cdFx0XHRcdFx0XHRcdG5hbWU6IHZhcmlhYmxlLm5hbWUsXG5cdFx0XHRcdFx0XHRcdHZhbHVlOiB2YXJpYWJsZS52YWx1ZSxcblx0XHRcdFx0XHRcdFx0ZXhwcmVzc2lvbjogdmFyaWFibGUuZXhwcmVzc2lvbixcblx0XHRcdFx0XHRcdFx0dHlwZTogdmFyaWFibGUudHlwZSxcblx0XHRcdFx0XHRcdFx0bGFuZ3VhZ2U6IHZhcmlhYmxlLmxhbmd1YWdlXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0aGFzTmFtZWRDaGlsZHJlbjogdmFyaWFibGUuaGFzTmFtZWRDaGlsZHJlbixcblx0XHRcdFx0XHRcdGluZGV4ZWRDaGlsZHJlbkNvdW50OiB2YXJpYWJsZS5pbmRleGVkQ2hpbGRyZW5Db3VudFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSlcblx0XHQpO1xuXHRcdHRoaXMuX2NvbW1hbmRzLnJlZ2lzdGVyQXBpQ29tbWFuZChzZWxlY3RLZXJuZWxBcGlDb21tYW5kKTtcblx0XHR0aGlzLl9jb21tYW5kcy5yZWdpc3RlckFwaUNvbW1hbmQocmVxdWVzdEtlcm5lbFZhcmlhYmxlc0FwaUNvbW1hbmQpO1xuXHR9XG5cblx0Y3JlYXRlTm90ZWJvb2tDb250cm9sbGVyKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBpZDogc3RyaW5nLCB2aWV3VHlwZTogc3RyaW5nLCBsYWJlbDogc3RyaW5nLCBoYW5kbGVyPzogKGNlbGxzOiB2c2NvZGUuTm90ZWJvb2tDZWxsW10sIG5vdGVib29rOiB2c2NvZGUuTm90ZWJvb2tEb2N1bWVudCwgY29udHJvbGxlcjogdnNjb2RlLk5vdGVib29rQ29udHJvbGxlcikgPT4gdm9pZCB8IFRoZW5hYmxlPHZvaWQ+LCBwcmVsb2Fkcz86IHZzY29kZS5Ob3RlYm9va1JlbmRlcmVyU2NyaXB0W10pOiB2c2NvZGUuTm90ZWJvb2tDb250cm9sbGVyIHtcblxuXHRcdGZvciAoY29uc3QgZGF0YSBvZiB0aGlzLl9rZXJuZWxEYXRhLnZhbHVlcygpKSB7XG5cdFx0XHRpZiAoZGF0YS5jb250cm9sbGVyLmlkID09PSBpZCAmJiBFeHRlbnNpb25JZGVudGlmaWVyLmVxdWFscyhleHRlbnNpb24uaWRlbnRpZmllciwgZGF0YS5leHRlbnNpb25JZCkpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBub3RlYm9vayBjb250cm9sbGVyIHdpdGggaWQgJyR7aWR9JyBBTFJFQURZIGV4aXN0YCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cblx0XHRjb25zdCBoYW5kbGUgPSB0aGlzLl9oYW5kbGVQb29sKys7XG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cblx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBOb3RlYm9va0NvbnRyb2xsZXJbJHtoYW5kbGV9XSwgQ1JFQVRFRCBieSAke2V4dGVuc2lvbi5pZGVudGlmaWVyLnZhbHVlfSwgJHtpZH1gKTtcblxuXHRcdGNvbnN0IF9kZWZhdWx0RXhlY3V0SGFuZGxlciA9ICgpID0+IGNvbnNvbGUud2FybihgTk8gZXhlY3V0ZSBoYW5kbGVyIGZyb20gbm90ZWJvb2sgY29udHJvbGxlciAnJHtkYXRhLmlkfScgb2YgZXh0ZW5zaW9uOiAnJHtleHRlbnNpb24uaWRlbnRpZmllcn0nYCk7XG5cblx0XHRsZXQgaXNEaXNwb3NlZCA9IGZhbHNlO1xuXG5cdFx0Y29uc3Qgb25EaWRDaGFuZ2VTZWxlY3Rpb24gPSBuZXcgRW1pdHRlcjx7IHNlbGVjdGVkOiBib29sZWFuOyBub3RlYm9vazogdnNjb2RlLk5vdGVib29rRG9jdW1lbnQgfT4oKTtcblx0XHRjb25zdCBvbkRpZFJlY2VpdmVNZXNzYWdlID0gbmV3IEVtaXR0ZXI8eyBlZGl0b3I6IHZzY29kZS5Ob3RlYm9va0VkaXRvcjsgbWVzc2FnZTogYW55IH0+KCk7XG5cblx0XHRjb25zdCBkYXRhOiBJTm90ZWJvb2tLZXJuZWxEdG8yID0ge1xuXHRcdFx0aWQ6IGNyZWF0ZUtlcm5lbElkKGV4dGVuc2lvbi5pZGVudGlmaWVyLCBpZCksXG5cdFx0XHRub3RlYm9va1R5cGU6IHZpZXdUeXBlLFxuXHRcdFx0ZXh0ZW5zaW9uSWQ6IGV4dGVuc2lvbi5pZGVudGlmaWVyLFxuXHRcdFx0ZXh0ZW5zaW9uTG9jYXRpb246IGV4dGVuc2lvbi5leHRlbnNpb25Mb2NhdGlvbixcblx0XHRcdGxhYmVsOiBsYWJlbCB8fCBleHRlbnNpb24uaWRlbnRpZmllci52YWx1ZSxcblx0XHRcdHByZWxvYWRzOiBwcmVsb2FkcyA/IHByZWxvYWRzLm1hcChleHRIb3N0VHlwZUNvbnZlcnRlcnMuTm90ZWJvb2tSZW5kZXJlclNjcmlwdC5mcm9tKSA6IFtdXG5cdFx0fTtcblxuXHRcdC8vXG5cdFx0bGV0IF9leGVjdXRlSGFuZGxlciA9IGhhbmRsZXIgPz8gX2RlZmF1bHRFeGVjdXRIYW5kbGVyO1xuXHRcdGxldCBfaW50ZXJydXB0SGFuZGxlcjogKCh0aGlzOiB2c2NvZGUuTm90ZWJvb2tDb250cm9sbGVyLCBub3RlYm9vazogdnNjb2RlLk5vdGVib29rRG9jdW1lbnQpID0+IHZvaWQgfCBUaGVuYWJsZTx2b2lkPikgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IF92YXJpYWJsZVByb3ZpZGVyOiB2c2NvZGUuTm90ZWJvb2tWYXJpYWJsZVByb3ZpZGVyIHwgdW5kZWZpbmVkO1xuXG5cdFx0dGhpcy5fcHJveHkuJGFkZEtlcm5lbChoYW5kbGUsIGRhdGEpLmNhdGNoKGVyciA9PiB7XG5cdFx0XHQvLyB0aGlzIGNhbiBoYXBwZW4gd2hlbiBhIGtlcm5lbCB3aXRoIHRoYXQgSUQgaXMgYWxyZWFkeSByZWdpc3RlcmVkXG5cdFx0XHRjb25zb2xlLmxvZyhlcnIpO1xuXHRcdFx0aXNEaXNwb3NlZCA9IHRydWU7XG5cdFx0fSk7XG5cblx0XHQvLyB1cGRhdGU6IGFsbCBzZXR0ZXJzIHdyaXRlIGRpcmVjdGx5IGludG8gdGhlIGR0byBvYmplY3Rcblx0XHQvLyBhbmQgdHJpZ2dlciBhbiB1cGRhdGUuIHRoZSBhY3R1YWwgdXBkYXRlIHdpbGwgb25seSBoYXBwZW5cblx0XHQvLyBvbmNlIHBlciBldmVudCBsb29wIGV4ZWN1dGlvblxuXHRcdGxldCB0b2tlblBvb2wgPSAwO1xuXHRcdGNvbnN0IF91cGRhdGUgPSAoKSA9PiB7XG5cdFx0XHRpZiAoaXNEaXNwb3NlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBteVRva2VuID0gKyt0b2tlblBvb2w7XG5cdFx0XHRQcm9taXNlLnJlc29sdmUoKS50aGVuKCgpID0+IHtcblx0XHRcdFx0aWYgKG15VG9rZW4gPT09IHRva2VuUG9vbCkge1xuXHRcdFx0XHRcdHRoaXMuX3Byb3h5LiR1cGRhdGVLZXJuZWwoaGFuZGxlLCBkYXRhKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fTtcblxuXHRcdC8vIG5vdGVib29rIGRvY3VtZW50cyB0aGF0IGFyZSBhc3NvY2lhdGVkIHRvIHRoaXMgY29udHJvbGxlclxuXHRcdGNvbnN0IGFzc29jaWF0ZWROb3RlYm9va3MgPSBuZXcgUmVzb3VyY2VNYXA8Ym9vbGVhbj4oKTtcblxuXHRcdGNvbnN0IGNvbnRyb2xsZXI6IHZzY29kZS5Ob3RlYm9va0NvbnRyb2xsZXIgPSB7XG5cdFx0XHRnZXQgaWQoKSB7IHJldHVybiBpZDsgfSxcblx0XHRcdGdldCBub3RlYm9va1R5cGUoKSB7IHJldHVybiBkYXRhLm5vdGVib29rVHlwZTsgfSxcblx0XHRcdG9uRGlkQ2hhbmdlU2VsZWN0ZWROb3RlYm9va3M6IG9uRGlkQ2hhbmdlU2VsZWN0aW9uLmV2ZW50LFxuXHRcdFx0Z2V0IGxhYmVsKCkge1xuXHRcdFx0XHRyZXR1cm4gZGF0YS5sYWJlbDtcblx0XHRcdH0sXG5cdFx0XHRzZXQgbGFiZWwodmFsdWUpIHtcblx0XHRcdFx0ZGF0YS5sYWJlbCA9IHZhbHVlID8/IGV4dGVuc2lvbi5kaXNwbGF5TmFtZSA/PyBleHRlbnNpb24ubmFtZTtcblx0XHRcdFx0X3VwZGF0ZSgpO1xuXHRcdFx0fSxcblx0XHRcdGdldCBkZXRhaWwoKSB7XG5cdFx0XHRcdHJldHVybiBkYXRhLmRldGFpbCA/PyAnJztcblx0XHRcdH0sXG5cdFx0XHRzZXQgZGV0YWlsKHZhbHVlKSB7XG5cdFx0XHRcdGRhdGEuZGV0YWlsID0gdmFsdWU7XG5cdFx0XHRcdF91cGRhdGUoKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgZGVzY3JpcHRpb24oKSB7XG5cdFx0XHRcdHJldHVybiBkYXRhLmRlc2NyaXB0aW9uID8/ICcnO1xuXHRcdFx0fSxcblx0XHRcdHNldCBkZXNjcmlwdGlvbih2YWx1ZSkge1xuXHRcdFx0XHRkYXRhLmRlc2NyaXB0aW9uID0gdmFsdWU7XG5cdFx0XHRcdF91cGRhdGUoKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgc3VwcG9ydGVkTGFuZ3VhZ2VzKCkge1xuXHRcdFx0XHRyZXR1cm4gZGF0YS5zdXBwb3J0ZWRMYW5ndWFnZXM7XG5cdFx0XHR9LFxuXHRcdFx0c2V0IHN1cHBvcnRlZExhbmd1YWdlcyh2YWx1ZSkge1xuXHRcdFx0XHRkYXRhLnN1cHBvcnRlZExhbmd1YWdlcyA9IHZhbHVlO1xuXHRcdFx0XHRfdXBkYXRlKCk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IHN1cHBvcnRzRXhlY3V0aW9uT3JkZXIoKSB7XG5cdFx0XHRcdHJldHVybiBkYXRhLnN1cHBvcnRzRXhlY3V0aW9uT3JkZXIgPz8gZmFsc2U7XG5cdFx0XHR9LFxuXHRcdFx0c2V0IHN1cHBvcnRzRXhlY3V0aW9uT3JkZXIodmFsdWUpIHtcblx0XHRcdFx0ZGF0YS5zdXBwb3J0c0V4ZWN1dGlvbk9yZGVyID0gdmFsdWU7XG5cdFx0XHRcdF91cGRhdGUoKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgcmVuZGVyZXJTY3JpcHRzKCkge1xuXHRcdFx0XHRyZXR1cm4gZGF0YS5wcmVsb2FkcyA/IGRhdGEucHJlbG9hZHMubWFwKGV4dEhvc3RUeXBlQ29udmVydGVycy5Ob3RlYm9va1JlbmRlcmVyU2NyaXB0LnRvKSA6IFtdO1xuXHRcdFx0fSxcblx0XHRcdGdldCBleGVjdXRlSGFuZGxlcigpIHtcblx0XHRcdFx0cmV0dXJuIF9leGVjdXRlSGFuZGxlcjtcblx0XHRcdH0sXG5cdFx0XHRzZXQgZXhlY3V0ZUhhbmRsZXIodmFsdWUpIHtcblx0XHRcdFx0X2V4ZWN1dGVIYW5kbGVyID0gdmFsdWUgPz8gX2RlZmF1bHRFeGVjdXRIYW5kbGVyO1xuXHRcdFx0fSxcblx0XHRcdGdldCBpbnRlcnJ1cHRIYW5kbGVyKCkge1xuXHRcdFx0XHRyZXR1cm4gX2ludGVycnVwdEhhbmRsZXI7XG5cdFx0XHR9LFxuXHRcdFx0c2V0IGludGVycnVwdEhhbmRsZXIodmFsdWUpIHtcblx0XHRcdFx0X2ludGVycnVwdEhhbmRsZXIgPSB2YWx1ZTtcblx0XHRcdFx0ZGF0YS5zdXBwb3J0c0ludGVycnVwdCA9IEJvb2xlYW4odmFsdWUpO1xuXHRcdFx0XHRfdXBkYXRlKCk7XG5cdFx0XHR9LFxuXHRcdFx0c2V0IHZhcmlhYmxlUHJvdmlkZXIodmFsdWUpIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnbm90ZWJvb2tWYXJpYWJsZVByb3ZpZGVyJyk7XG5cdFx0XHRcdF92YXJpYWJsZVByb3ZpZGVyID0gdmFsdWU7XG5cdFx0XHRcdGRhdGEuaGFzVmFyaWFibGVQcm92aWRlciA9ICEhdmFsdWU7XG5cdFx0XHRcdHZhbHVlPy5vbkRpZENoYW5nZVZhcmlhYmxlcyhlID0+IHRoYXQuX3Byb3h5LiR2YXJpYWJsZXNVcGRhdGVkKGUudXJpKSk7XG5cdFx0XHRcdF91cGRhdGUoKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgdmFyaWFibGVQcm92aWRlcigpIHtcblx0XHRcdFx0cmV0dXJuIF92YXJpYWJsZVByb3ZpZGVyO1xuXHRcdFx0fSxcblx0XHRcdGNyZWF0ZU5vdGVib29rQ2VsbEV4ZWN1dGlvbihjZWxsKSB7XG5cdFx0XHRcdGlmIChpc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdub3RlYm9vayBjb250cm9sbGVyIGlzIERJU1BPU0VEJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFhc3NvY2lhdGVkTm90ZWJvb2tzLmhhcyhjZWxsLm5vdGVib29rLnVyaSkpIHtcblx0XHRcdFx0XHR0aGF0Ll9sb2dTZXJ2aWNlLnRyYWNlKGBOb3RlYm9va0NvbnRyb2xsZXJbJHtoYW5kbGV9XSBOT1QgYXNzb2NpYXRlZCB0byBub3RlYm9vaywgYXNzb2NpYXRlZCB0byBUSEVTRSBub3RlYm9va3M6YCwgQXJyYXkuZnJvbShhc3NvY2lhdGVkTm90ZWJvb2tzLmtleXMoKSkubWFwKHUgPT4gdS50b1N0cmluZygpKSk7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBub3RlYm9vayBjb250cm9sbGVyIGlzIE5PVCBhc3NvY2lhdGVkIHRvIG5vdGVib29rOiAke2NlbGwubm90ZWJvb2sudXJpLnRvU3RyaW5nKCl9YCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoYXQuX2NyZWF0ZU5vdGVib29rQ2VsbEV4ZWN1dGlvbihjZWxsLCBjcmVhdGVLZXJuZWxJZChleHRlbnNpb24uaWRlbnRpZmllciwgdGhpcy5pZCkpO1xuXHRcdFx0fSxcblx0XHRcdGNyZWF0ZU5vdGVib29rRXhlY3V0aW9uKG5vdGVib29rKSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKGV4dGVuc2lvbiwgJ25vdGVib29rRXhlY3V0aW9uJyk7XG5cdFx0XHRcdGlmIChpc0Rpc3Bvc2VkKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdub3RlYm9vayBjb250cm9sbGVyIGlzIERJU1BPU0VEJyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFhc3NvY2lhdGVkTm90ZWJvb2tzLmhhcyhub3RlYm9vay51cmkpKSB7XG5cdFx0XHRcdFx0dGhhdC5fbG9nU2VydmljZS50cmFjZShgTm90ZWJvb2tDb250cm9sbGVyWyR7aGFuZGxlfV0gTk9UIGFzc29jaWF0ZWQgdG8gbm90ZWJvb2ssIGFzc29jaWF0ZWQgdG8gVEhFU0Ugbm90ZWJvb2tzOmAsIEFycmF5LmZyb20oYXNzb2NpYXRlZE5vdGVib29rcy5rZXlzKCkpLm1hcCh1ID0+IHUudG9TdHJpbmcoKSkpO1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcihgbm90ZWJvb2sgY29udHJvbGxlciBpcyBOT1QgYXNzb2NpYXRlZCB0byBub3RlYm9vazogJHtub3RlYm9vay51cmkudG9TdHJpbmcoKX1gKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdGhhdC5fY3JlYXRlTm90ZWJvb2tFeGVjdXRpb24obm90ZWJvb2ssIGNyZWF0ZUtlcm5lbElkKGV4dGVuc2lvbi5pZGVudGlmaWVyLCB0aGlzLmlkKSk7XG5cdFx0XHR9LFxuXHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHRpZiAoIWlzRGlzcG9zZWQpIHtcblx0XHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBOb3RlYm9va0NvbnRyb2xsZXJbJHtoYW5kbGV9XSwgRElTUE9TRURgKTtcblx0XHRcdFx0XHRpc0Rpc3Bvc2VkID0gdHJ1ZTtcblx0XHRcdFx0XHR0aGlzLl9rZXJuZWxEYXRhLmRlbGV0ZShoYW5kbGUpO1xuXHRcdFx0XHRcdG9uRGlkQ2hhbmdlU2VsZWN0aW9uLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRvbkRpZFJlY2VpdmVNZXNzYWdlLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHR0aGlzLl9wcm94eS4kcmVtb3ZlS2VybmVsKGhhbmRsZSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHQvLyAtLS0gcHJpb3JpdHlcblx0XHRcdHVwZGF0ZU5vdGVib29rQWZmaW5pdHkobm90ZWJvb2ssIHByaW9yaXR5KSB7XG5cdFx0XHRcdGlmIChwcmlvcml0eSA9PT0gTm90ZWJvb2tDb250cm9sbGVyQWZmaW5pdHkyLkhpZGRlbikge1xuXHRcdFx0XHRcdC8vIFRoaXMgYXBpIG9ubHkgYWRkcyBhbiBleHRyYSBlbnVtIHZhbHVlLCB0aGUgZnVuY3Rpb24gaXMgdGhlIHNhbWUsIHNvIGp1c3QgZ2F0ZSBvbiB0aGUgbmV3IHZhbHVlIGJlaW5nIHBhc3NlZFxuXHRcdFx0XHRcdC8vIGZvciBwcm9wb3NlZEFQSSBjaGVjay5cblx0XHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdub3RlYm9va0NvbnRyb2xsZXJBZmZpbml0eUhpZGRlbicpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoYXQuX3Byb3h5LiR1cGRhdGVOb3RlYm9va1ByaW9yaXR5KGhhbmRsZSwgbm90ZWJvb2sudXJpLCBwcmlvcml0eSk7XG5cdFx0XHR9LFxuXHRcdFx0Ly8gLS0tIGlwY1xuXHRcdFx0b25EaWRSZWNlaXZlTWVzc2FnZTogb25EaWRSZWNlaXZlTWVzc2FnZS5ldmVudCxcblx0XHRcdHBvc3RNZXNzYWdlKG1lc3NhZ2UsIGVkaXRvcikge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdub3RlYm9va01lc3NhZ2luZycpO1xuXHRcdFx0XHRyZXR1cm4gdGhhdC5fcHJveHkuJHBvc3RNZXNzYWdlKGhhbmRsZSwgZWRpdG9yICYmIHRoYXQuX2V4dEhvc3ROb3RlYm9vay5nZXRJZEJ5RWRpdG9yKGVkaXRvciksIG1lc3NhZ2UpO1xuXHRcdFx0fSxcblx0XHRcdGFzV2Vidmlld1VyaSh1cmk6IFVSSSkge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24sICdub3RlYm9va01lc3NhZ2luZycpO1xuXHRcdFx0XHRyZXR1cm4gYXNXZWJ2aWV3VXJpKHVyaSwgdGhhdC5faW5pdERhdGEucmVtb3RlKTtcblx0XHRcdH0sXG5cdFx0fTtcblxuXHRcdHRoaXMuX2tlcm5lbERhdGEuc2V0KGhhbmRsZSwge1xuXHRcdFx0ZXh0ZW5zaW9uSWQ6IGV4dGVuc2lvbi5pZGVudGlmaWVyLFxuXHRcdFx0Y29udHJvbGxlcixcblx0XHRcdG9uRGlkUmVjZWl2ZU1lc3NhZ2UsXG5cdFx0XHRvbkRpZENoYW5nZVNlbGVjdGlvbixcblx0XHRcdGFzc29jaWF0ZWROb3RlYm9va3Ncblx0XHR9KTtcblx0XHRyZXR1cm4gY29udHJvbGxlcjtcblx0fVxuXG5cdGdldElkQnlDb250cm9sbGVyKGNvbnRyb2xsZXI6IHZzY29kZS5Ob3RlYm9va0NvbnRyb2xsZXIpIHtcblx0XHRmb3IgKGNvbnN0IFtfLCBjYW5kaWRhdGVdIG9mIHRoaXMuX2tlcm5lbERhdGEpIHtcblx0XHRcdGlmIChjYW5kaWRhdGUuY29udHJvbGxlciA9PT0gY29udHJvbGxlcikge1xuXHRcdFx0XHRyZXR1cm4gY3JlYXRlS2VybmVsSWQoY2FuZGlkYXRlLmV4dGVuc2lvbklkLCBjb250cm9sbGVyLmlkKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRjcmVhdGVOb3RlYm9va0NvbnRyb2xsZXJEZXRlY3Rpb25UYXNrKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCB2aWV3VHlwZTogc3RyaW5nKTogdnNjb2RlLk5vdGVib29rQ29udHJvbGxlckRldGVjdGlvblRhc2sge1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX2tlcm5lbERldGVjdGlvblRhc2tIYW5kbGVQb29sKys7XG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cblx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBOb3RlYm9va0NvbnRyb2xsZXJEZXRlY3Rpb25UYXNrWyR7aGFuZGxlfV0sIENSRUFURUQgYnkgJHtleHRlbnNpb24uaWRlbnRpZmllci52YWx1ZX1gKTtcblx0XHR0aGlzLl9wcm94eS4kYWRkS2VybmVsRGV0ZWN0aW9uVGFzayhoYW5kbGUsIHZpZXdUeXBlKTtcblxuXHRcdGNvbnN0IGRldGVjdGlvblRhc2s6IHZzY29kZS5Ob3RlYm9va0NvbnRyb2xsZXJEZXRlY3Rpb25UYXNrID0ge1xuXHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9rZXJuZWxEZXRlY3Rpb25UYXNrLmRlbGV0ZShoYW5kbGUpO1xuXHRcdFx0XHR0aGF0Ll9wcm94eS4kcmVtb3ZlS2VybmVsRGV0ZWN0aW9uVGFzayhoYW5kbGUpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHR0aGlzLl9rZXJuZWxEZXRlY3Rpb25UYXNrLnNldChoYW5kbGUsIGRldGVjdGlvblRhc2spO1xuXHRcdHJldHVybiBkZXRlY3Rpb25UYXNrO1xuXHR9XG5cblx0cmVnaXN0ZXJLZXJuZWxTb3VyY2VBY3Rpb25Qcm92aWRlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgdmlld1R5cGU6IHN0cmluZywgcHJvdmlkZXI6IHZzY29kZS5Ob3RlYm9va0tlcm5lbFNvdXJjZUFjdGlvblByb3ZpZGVyKSB7XG5cdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5fa2VybmVsU291cmNlQWN0aW9uUHJvdmlkZXJIYW5kbGVQb29sKys7XG5cdFx0Y29uc3QgZXZlbnRIYW5kbGUgPSB0eXBlb2YgcHJvdmlkZXIub25EaWRDaGFuZ2VOb3RlYm9va0tlcm5lbFNvdXJjZUFjdGlvbnMgPT09ICdmdW5jdGlvbicgPyBoYW5kbGUgOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cblx0XHR0aGlzLl9rZXJuZWxTb3VyY2VBY3Rpb25Qcm92aWRlcnMuc2V0KGhhbmRsZSwgcHJvdmlkZXIpO1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYE5vdGVib29rS2VybmVsU291cmNlQWN0aW9uUHJvdmlkZXJbJHtoYW5kbGV9XSwgQ1JFQVRFRCBieSAke2V4dGVuc2lvbi5pZGVudGlmaWVyLnZhbHVlfWApO1xuXHRcdHRoaXMuX3Byb3h5LiRhZGRLZXJuZWxTb3VyY2VBY3Rpb25Qcm92aWRlcihoYW5kbGUsIGhhbmRsZSwgdmlld1R5cGUpO1xuXG5cdFx0bGV0IHN1YnNjcmlwdGlvbjogdnNjb2RlLkRpc3Bvc2FibGUgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKGV2ZW50SGFuZGxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHN1YnNjcmlwdGlvbiA9IHByb3ZpZGVyLm9uRGlkQ2hhbmdlTm90ZWJvb2tLZXJuZWxTb3VyY2VBY3Rpb25zIShfID0+IHRoaXMuX3Byb3h5LiRlbWl0Tm90ZWJvb2tLZXJuZWxTb3VyY2VBY3Rpb25zQ2hhbmdlRXZlbnQoZXZlbnRIYW5kbGUpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0XHR0aGlzLl9rZXJuZWxTb3VyY2VBY3Rpb25Qcm92aWRlcnMuZGVsZXRlKGhhbmRsZSk7XG5cdFx0XHRcdHRoYXQuX3Byb3h5LiRyZW1vdmVLZXJuZWxTb3VyY2VBY3Rpb25Qcm92aWRlcihoYW5kbGUsIGhhbmRsZSk7XG5cdFx0XHRcdHN1YnNjcmlwdGlvbj8uZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRhc3luYyAkcHJvdmlkZUtlcm5lbFNvdXJjZUFjdGlvbnMoaGFuZGxlOiBudW1iZXIsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SU5vdGVib29rS2VybmVsU291cmNlQWN0aW9uW10+IHtcblx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMuX2tlcm5lbFNvdXJjZUFjdGlvblByb3ZpZGVycy5nZXQoaGFuZGxlKTtcblx0XHRpZiAocHJvdmlkZXIpIHtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0Y29uc3QgcmV0ID0gYXdhaXQgcHJvdmlkZXIucHJvdmlkZU5vdGVib29rS2VybmVsU291cmNlQWN0aW9ucyh0b2tlbik7XG5cdFx0XHRyZXR1cm4gKHJldCA/PyBbXSkubWFwKGl0ZW0gPT4gZXh0SG9zdFR5cGVDb252ZXJ0ZXJzLk5vdGVib29rS2VybmVsU291cmNlQWN0aW9uLmZyb20oaXRlbSwgdGhpcy5fY29tbWFuZHMuY29udmVydGVyLCBkaXNwb3NhYmxlcykpO1xuXHRcdH1cblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHQkYWNjZXB0Tm90ZWJvb2tBc3NvY2lhdGlvbihoYW5kbGU6IG51bWJlciwgdXJpOiBVcmlDb21wb25lbnRzLCB2YWx1ZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IG9iaiA9IHRoaXMuX2tlcm5lbERhdGEuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKG9iaikge1xuXHRcdFx0Ly8gdXBkYXRlIGRhdGEgc3RydWN0dXJlXG5cdFx0XHRjb25zdCBub3RlYm9vayA9IHRoaXMuX2V4dEhvc3ROb3RlYm9vay5nZXROb3RlYm9va0RvY3VtZW50KFVSSS5yZXZpdmUodXJpKSkhO1xuXHRcdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRcdG9iai5hc3NvY2lhdGVkTm90ZWJvb2tzLnNldChub3RlYm9vay51cmksIHRydWUpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0b2JqLmFzc29jaWF0ZWROb3RlYm9va3MuZGVsZXRlKG5vdGVib29rLnVyaSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBOb3RlYm9va0NvbnRyb2xsZXJbJHtoYW5kbGV9XSBBU1NPQ0lBVEUgbm90ZWJvb2tgLCBub3RlYm9vay51cmkudG9TdHJpbmcoKSwgdmFsdWUpO1xuXHRcdFx0Ly8gc2VuZCBldmVudFxuXHRcdFx0b2JqLm9uRGlkQ2hhbmdlU2VsZWN0aW9uLmZpcmUoe1xuXHRcdFx0XHRzZWxlY3RlZDogdmFsdWUsXG5cdFx0XHRcdG5vdGVib29rOiBub3RlYm9vay5hcGlOb3RlYm9va1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgJGV4ZWN1dGVDZWxscyhoYW5kbGU6IG51bWJlciwgdXJpOiBVcmlDb21wb25lbnRzLCBoYW5kbGVzOiBudW1iZXJbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IG9iaiA9IHRoaXMuX2tlcm5lbERhdGEuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKCFvYmopIHtcblx0XHRcdC8vIGV4dGVuc2lvbiBjYW4gZGlzcG9zZSBrZXJuZWxzIGluIHRoZSBtZWFudGltZVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCBkb2N1bWVudCA9IHRoaXMuX2V4dEhvc3ROb3RlYm9vay5nZXROb3RlYm9va0RvY3VtZW50KFVSSS5yZXZpdmUodXJpKSk7XG5cdFx0Y29uc3QgY2VsbHM6IHZzY29kZS5Ob3RlYm9va0NlbGxbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgY2VsbEhhbmRsZSBvZiBoYW5kbGVzKSB7XG5cdFx0XHRjb25zdCBjZWxsID0gZG9jdW1lbnQuZ2V0Q2VsbChjZWxsSGFuZGxlKTtcblx0XHRcdGlmIChjZWxsKSB7XG5cdFx0XHRcdGNlbGxzLnB1c2goY2VsbC5hcGlDZWxsKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZShgTm90ZWJvb2tDb250cm9sbGVyWyR7aGFuZGxlfV0gRVhFQ1VURSBjZWxsc2AsIGRvY3VtZW50LnVyaS50b1N0cmluZygpLCBjZWxscy5sZW5ndGgpO1xuXHRcdFx0YXdhaXQgb2JqLmNvbnRyb2xsZXIuZXhlY3V0ZUhhbmRsZXIuY2FsbChvYmouY29udHJvbGxlciwgY2VsbHMsIGRvY3VtZW50LmFwaU5vdGVib29rLCBvYmouY29udHJvbGxlcik7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHQvL1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihgTm90ZWJvb2tDb250cm9sbGVyWyR7aGFuZGxlfV0gZXhlY3V0ZSBjZWxscyBGQUlMRURgLCBlcnIpO1xuXHRcdFx0Y29uc29sZS5lcnJvcihlcnIpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jICRjYW5jZWxDZWxscyhoYW5kbGU6IG51bWJlciwgdXJpOiBVcmlDb21wb25lbnRzLCBoYW5kbGVzOiBudW1iZXJbXSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IG9iaiA9IHRoaXMuX2tlcm5lbERhdGEuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKCFvYmopIHtcblx0XHRcdC8vIGV4dGVuc2lvbiBjYW4gZGlzcG9zZSBrZXJuZWxzIGluIHRoZSBtZWFudGltZVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdC8vIGNhbmNlbCBvciBpbnRlcnJ1cHQgZGVwZW5kcyBvbiB0aGUgY29udHJvbGxlci4gV2hlbiBhbiBpbnRlcnJ1cHQgaGFuZGxlciBpcyB1c2VkIHdlXG5cdFx0Ly8gZG9uJ3QgdHJpZ2dlciB0aGUgY2FuY2VsYXRpb24gdG9rZW4gb2YgZXhlY3V0aW9ucy5cblx0XHRjb25zdCBkb2N1bWVudCA9IHRoaXMuX2V4dEhvc3ROb3RlYm9vay5nZXROb3RlYm9va0RvY3VtZW50KFVSSS5yZXZpdmUodXJpKSk7XG5cdFx0aWYgKG9iai5jb250cm9sbGVyLmludGVycnVwdEhhbmRsZXIpIHtcblx0XHRcdGF3YWl0IG9iai5jb250cm9sbGVyLmludGVycnVwdEhhbmRsZXIuY2FsbChvYmouY29udHJvbGxlciwgZG9jdW1lbnQuYXBpTm90ZWJvb2spO1xuXG5cdFx0fSBlbHNlIHtcblx0XHRcdGZvciAoY29uc3QgY2VsbEhhbmRsZSBvZiBoYW5kbGVzKSB7XG5cdFx0XHRcdGNvbnN0IGNlbGwgPSBkb2N1bWVudC5nZXRDZWxsKGNlbGxIYW5kbGUpO1xuXHRcdFx0XHRpZiAoY2VsbCkge1xuXHRcdFx0XHRcdHRoaXMuX2FjdGl2ZUV4ZWN1dGlvbnMuZ2V0KGNlbGwudXJpKT8uY2FuY2VsKCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAob2JqLmNvbnRyb2xsZXIuaW50ZXJydXB0SGFuZGxlcikge1xuXHRcdFx0Ly8gSWYgd2UncmUgaW50ZXJydXB0aW5nIGFsbCBjZWxscywgd2UgYWxzbyBuZWVkIHRvIGNhbmNlbCB0aGUgbm90ZWJvb2sgbGV2ZWwgZXhlY3V0aW9uLlxuXHRcdFx0Y29uc3QgaXRlbXMgPSB0aGlzLl9hY3RpdmVOb3RlYm9va0V4ZWN1dGlvbnMuZ2V0KGRvY3VtZW50LnVyaSk7XG5cdFx0XHR0aGlzLl9hY3RpdmVOb3RlYm9va0V4ZWN1dGlvbnMuZGVsZXRlKGRvY3VtZW50LnVyaSk7XG5cdFx0XHRpZiAoaGFuZGxlcy5sZW5ndGggJiYgQXJyYXkuaXNBcnJheShpdGVtcykgJiYgaXRlbXMubGVuZ3RoKSB7XG5cdFx0XHRcdGl0ZW1zLmZvckVhY2goZCA9PiBkLmRpc3Bvc2UoKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBpZCA9IDA7XG5cdHByaXZhdGUgdmFyaWFibGVTdG9yZTogUmVjb3JkPHN0cmluZywgdnNjb2RlLlZhcmlhYmxlPiA9IHt9O1xuXG5cdGFzeW5jICRwcm92aWRlVmFyaWFibGVzKGhhbmRsZTogbnVtYmVyLCByZXF1ZXN0SWQ6IHN0cmluZywgbm90ZWJvb2tVcmk6IFVyaUNvbXBvbmVudHMsIHBhcmVudElkOiBudW1iZXIgfCB1bmRlZmluZWQsIGtpbmQ6ICduYW1lZCcgfCAnaW5kZXhlZCcsIHN0YXJ0OiBudW1iZXIsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IG9iaiA9IHRoaXMuX2tlcm5lbERhdGEuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKCFvYmopIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBkb2N1bWVudCA9IHRoaXMuX2V4dEhvc3ROb3RlYm9vay5nZXROb3RlYm9va0RvY3VtZW50KFVSSS5yZXZpdmUobm90ZWJvb2tVcmkpKTtcblx0XHRjb25zdCB2YXJpYWJsZVByb3ZpZGVyID0gb2JqLmNvbnRyb2xsZXIudmFyaWFibGVQcm92aWRlcjtcblx0XHRpZiAoIXZhcmlhYmxlUHJvdmlkZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRsZXQgcGFyZW50OiB2c2NvZGUuVmFyaWFibGUgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKHBhcmVudElkICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdHBhcmVudCA9IHRoaXMudmFyaWFibGVTdG9yZVtwYXJlbnRJZF07XG5cdFx0XHRpZiAoIXBhcmVudCkge1xuXHRcdFx0XHQvLyByZXF1ZXN0IGZvciB1bmtub3duIHBhcmVudFxuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIHJvb3QgcmVxdWVzdCwgY2xlYXIgc3RvcmVcblx0XHRcdHRoaXMudmFyaWFibGVTdG9yZSA9IHt9O1xuXHRcdH1cblxuXG5cdFx0Y29uc3QgcmVxdWVzdEtpbmQgPSBraW5kID09PSAnbmFtZWQnID8gTm90ZWJvb2tWYXJpYWJsZXNSZXF1ZXN0S2luZC5OYW1lZCA6IE5vdGVib29rVmFyaWFibGVzUmVxdWVzdEtpbmQuSW5kZXhlZDtcblx0XHRjb25zdCB2YXJpYWJsZVJlc3VsdHMgPSB2YXJpYWJsZVByb3ZpZGVyLnByb3ZpZGVWYXJpYWJsZXMoZG9jdW1lbnQuYXBpTm90ZWJvb2ssIHBhcmVudCwgcmVxdWVzdEtpbmQsIHN0YXJ0LCB0b2tlbik7XG5cblx0XHRsZXQgcmVzdWx0Q291bnQgPSAwO1xuXHRcdGZvciBhd2FpdCAoY29uc3QgcmVzdWx0IG9mIHZhcmlhYmxlUmVzdWx0cykge1xuXHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHZhcmlhYmxlID0ge1xuXHRcdFx0XHRpZDogdGhpcy5pZCsrLFxuXHRcdFx0XHRuYW1lOiByZXN1bHQudmFyaWFibGUubmFtZSxcblx0XHRcdFx0dmFsdWU6IHJlc3VsdC52YXJpYWJsZS52YWx1ZSxcblx0XHRcdFx0dHlwZTogcmVzdWx0LnZhcmlhYmxlLnR5cGUsXG5cdFx0XHRcdGludGVyZmFjZXM6IHJlc3VsdC52YXJpYWJsZS5pbnRlcmZhY2VzLFxuXHRcdFx0XHRsYW5ndWFnZTogcmVzdWx0LnZhcmlhYmxlLmxhbmd1YWdlLFxuXHRcdFx0XHRleHByZXNzaW9uOiByZXN1bHQudmFyaWFibGUuZXhwcmVzc2lvbixcblx0XHRcdFx0aGFzTmFtZWRDaGlsZHJlbjogcmVzdWx0Lmhhc05hbWVkQ2hpbGRyZW4sXG5cdFx0XHRcdGluZGV4ZWRDaGlsZHJlbkNvdW50OiByZXN1bHQuaW5kZXhlZENoaWxkcmVuQ291bnQsXG5cdFx0XHRcdGV4dGVuc2lvbklkOiBvYmouZXh0ZW5zaW9uSWQudmFsdWUsXG5cdFx0XHR9O1xuXHRcdFx0dGhpcy52YXJpYWJsZVN0b3JlW3ZhcmlhYmxlLmlkXSA9IHJlc3VsdC52YXJpYWJsZTtcblx0XHRcdHRoaXMuX3Byb3h5LiRyZWNlaXZlVmFyaWFibGUocmVxdWVzdElkLCB2YXJpYWJsZSk7XG5cblx0XHRcdGlmIChyZXN1bHRDb3VudCsrID49IHZhcmlhYmxlUGFnZVNpemUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdCRhY2NlcHRLZXJuZWxNZXNzYWdlRnJvbVJlbmRlcmVyKGhhbmRsZTogbnVtYmVyLCBlZGl0b3JJZDogc3RyaW5nLCBtZXNzYWdlOiBhbnkpOiB2b2lkIHtcblx0XHRjb25zdCBvYmogPSB0aGlzLl9rZXJuZWxEYXRhLmdldChoYW5kbGUpO1xuXHRcdGlmICghb2JqKSB7XG5cdFx0XHQvLyBleHRlbnNpb24gY2FuIGRpc3Bvc2Uga2VybmVscyBpbiB0aGUgbWVhbnRpbWVcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlZGl0b3IgPSB0aGlzLl9leHRIb3N0Tm90ZWJvb2suZ2V0RWRpdG9yQnlJZChlZGl0b3JJZCk7XG5cdFx0b2JqLm9uRGlkUmVjZWl2ZU1lc3NhZ2UuZmlyZShPYmplY3QuZnJlZXplKHsgZWRpdG9yOiBlZGl0b3IuYXBpRWRpdG9yLCBtZXNzYWdlIH0pKTtcblx0fVxuXG5cdCRjZWxsRXhlY3V0aW9uQ2hhbmdlZCh1cmk6IFVyaUNvbXBvbmVudHMsIGNlbGxIYW5kbGU6IG51bWJlciwgc3RhdGU6IE5vdGVib29rQ2VsbEV4ZWN1dGlvblN0YXRlIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0Y29uc3QgZG9jdW1lbnQgPSB0aGlzLl9leHRIb3N0Tm90ZWJvb2suZ2V0Tm90ZWJvb2tEb2N1bWVudChVUkkucmV2aXZlKHVyaSkpO1xuXHRcdGNvbnN0IGNlbGwgPSBkb2N1bWVudC5nZXRDZWxsKGNlbGxIYW5kbGUpO1xuXHRcdGlmIChjZWxsKSB7XG5cdFx0XHRjb25zdCBuZXdTdGF0ZSA9IHN0YXRlID8gZXh0SG9zdFR5cGVDb252ZXJ0ZXJzLk5vdGVib29rQ2VsbEV4ZWN1dGlvblN0YXRlLnRvKHN0YXRlKSA6IEV4dEhvc3ROb3RlYm9va0NlbGxFeGVjdXRpb25TdGF0ZS5JZGxlO1xuXHRcdFx0aWYgKG5ld1N0YXRlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VDZWxsRXhlY3V0aW9uU3RhdGUuZmlyZSh7XG5cdFx0XHRcdFx0Y2VsbDogY2VsbC5hcGlDZWxsLFxuXHRcdFx0XHRcdHN0YXRlOiBuZXdTdGF0ZVxuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHQvLyAtLS1cblxuXHRfY3JlYXRlTm90ZWJvb2tDZWxsRXhlY3V0aW9uKGNlbGw6IHZzY29kZS5Ob3RlYm9va0NlbGwsIGNvbnRyb2xsZXJJZDogc3RyaW5nKTogdnNjb2RlLk5vdGVib29rQ2VsbEV4ZWN1dGlvbiB7XG5cdFx0aWYgKGNlbGwuaW5kZXggPCAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0NBTk5PVCBleGVjdXRlIGNlbGwgdGhhdCBoYXMgYmVlbiBSRU1PVkVEIGZyb20gbm90ZWJvb2snKTtcblx0XHR9XG5cdFx0Y29uc3Qgbm90ZWJvb2sgPSB0aGlzLl9leHRIb3N0Tm90ZWJvb2suZ2V0Tm90ZWJvb2tEb2N1bWVudChjZWxsLm5vdGVib29rLnVyaSk7XG5cdFx0Y29uc3QgY2VsbE9iaiA9IG5vdGVib29rLmdldENlbGxGcm9tQXBpQ2VsbChjZWxsKTtcblx0XHRpZiAoIWNlbGxPYmopIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignaW52YWxpZCBjZWxsJyk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9hY3RpdmVFeGVjdXRpb25zLmhhcyhjZWxsT2JqLnVyaSkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgZHVwbGljYXRlIGV4ZWN1dGlvbiBmb3IgJHtjZWxsT2JqLnVyaX1gKTtcblx0XHR9XG5cdFx0Y29uc3QgZXhlY3V0aW9uID0gbmV3IE5vdGVib29rQ2VsbEV4ZWN1dGlvblRhc2soY29udHJvbGxlcklkLCBjZWxsT2JqLCB0aGlzLl9wcm94eSk7XG5cdFx0dGhpcy5fYWN0aXZlRXhlY3V0aW9ucy5zZXQoY2VsbE9iai51cmksIGV4ZWN1dGlvbik7XG5cdFx0Y29uc3QgbGlzdGVuZXIgPSBleGVjdXRpb24ub25EaWRDaGFuZ2VTdGF0ZSgoKSA9PiB7XG5cdFx0XHRpZiAoZXhlY3V0aW9uLnN0YXRlID09PSBOb3RlYm9va0NlbGxFeGVjdXRpb25UYXNrU3RhdGUuUmVzb2x2ZWQpIHtcblx0XHRcdFx0ZXhlY3V0aW9uLmRpc3Bvc2UoKTtcblx0XHRcdFx0bGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHR0aGlzLl9hY3RpdmVFeGVjdXRpb25zLmRlbGV0ZShjZWxsT2JqLnVyaSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0cmV0dXJuIGV4ZWN1dGlvbi5hc0FwaU9iamVjdCgpO1xuXHR9XG5cblx0Ly8gLS0tXG5cblx0X2NyZWF0ZU5vdGVib29rRXhlY3V0aW9uKG5iOiB2c2NvZGUuTm90ZWJvb2tEb2N1bWVudCwgY29udHJvbGxlcklkOiBzdHJpbmcpOiB2c2NvZGUuTm90ZWJvb2tFeGVjdXRpb24ge1xuXHRcdGNvbnN0IG5vdGVib29rID0gdGhpcy5fZXh0SG9zdE5vdGVib29rLmdldE5vdGVib29rRG9jdW1lbnQobmIudXJpKTtcblx0XHRjb25zdCBydW5uaW5nQ2VsbCA9IG5iLmdldENlbGxzKCkuZmluZChjZWxsID0+IHtcblx0XHRcdGNvbnN0IGFwaUNlbGwgPSBub3RlYm9vay5nZXRDZWxsRnJvbUFwaUNlbGwoY2VsbCk7XG5cdFx0XHRyZXR1cm4gYXBpQ2VsbCAmJiB0aGlzLl9hY3RpdmVFeGVjdXRpb25zLmhhcyhhcGlDZWxsLnVyaSk7XG5cdFx0fSk7XG5cdFx0aWYgKHJ1bm5pbmdDZWxsKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYGR1cGxpY2F0ZSBjZWxsIGV4ZWN1dGlvbiBmb3IgJHtydW5uaW5nQ2VsbC5kb2N1bWVudC51cml9YCk7XG5cdFx0fVxuXHRcdGlmICh0aGlzLl9hY3RpdmVOb3RlYm9va0V4ZWN1dGlvbnMuaGFzKG5vdGVib29rLnVyaSkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgZHVwbGljYXRlIG5vdGVib29rIGV4ZWN1dGlvbiBmb3IgJHtub3RlYm9vay51cml9YCk7XG5cdFx0fVxuXHRcdGNvbnN0IGV4ZWN1dGlvbiA9IG5ldyBOb3RlYm9va0V4ZWN1dGlvblRhc2soY29udHJvbGxlcklkLCBub3RlYm9vaywgdGhpcy5fcHJveHkpO1xuXHRcdGNvbnN0IGxpc3RlbmVyID0gZXhlY3V0aW9uLm9uRGlkQ2hhbmdlU3RhdGUoKCkgPT4ge1xuXHRcdFx0aWYgKGV4ZWN1dGlvbi5zdGF0ZSA9PT0gTm90ZWJvb2tFeGVjdXRpb25UYXNrU3RhdGUuUmVzb2x2ZWQpIHtcblx0XHRcdFx0ZXhlY3V0aW9uLmRpc3Bvc2UoKTtcblx0XHRcdFx0bGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHR0aGlzLl9hY3RpdmVOb3RlYm9va0V4ZWN1dGlvbnMuZGVsZXRlKG5vdGVib29rLnVyaSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0dGhpcy5fYWN0aXZlTm90ZWJvb2tFeGVjdXRpb25zLnNldChub3RlYm9vay51cmksIFtleGVjdXRpb24sIGxpc3RlbmVyXSk7XG5cdFx0cmV0dXJuIGV4ZWN1dGlvbi5hc0FwaU9iamVjdCgpO1xuXHR9XG59XG5cblxuZW51bSBOb3RlYm9va0NlbGxFeGVjdXRpb25UYXNrU3RhdGUge1xuXHRJbml0LFxuXHRTdGFydGVkLFxuXHRSZXNvbHZlZFxufVxuXG5jbGFzcyBOb3RlYm9va0NlbGxFeGVjdXRpb25UYXNrIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgc3RhdGljIEhBTkRMRSA9IDA7XG5cdHByaXZhdGUgX2hhbmRsZSA9IE5vdGVib29rQ2VsbEV4ZWN1dGlvblRhc2suSEFORExFKys7XG5cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VTdGF0ZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlU3RhdGUgPSB0aGlzLl9vbkRpZENoYW5nZVN0YXRlLmV2ZW50O1xuXG5cdHByaXZhdGUgX3N0YXRlID0gTm90ZWJvb2tDZWxsRXhlY3V0aW9uVGFza1N0YXRlLkluaXQ7XG5cdGdldCBzdGF0ZSgpOiBOb3RlYm9va0NlbGxFeGVjdXRpb25UYXNrU3RhdGUgeyByZXR1cm4gdGhpcy5fc3RhdGU7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF90b2tlblNvdXJjZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jb2xsZWN0b3I6IFRpbWVvdXRCYXNlZENvbGxlY3RvcjxJQ2VsbEV4ZWN1dGVVcGRhdGVEdG8+O1xuXG5cdHByaXZhdGUgX2V4ZWN1dGlvbk9yZGVyOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Y29udHJvbGxlcklkOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY2VsbDogRXh0SG9zdENlbGwsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcHJveHk6IE1haW5UaHJlYWROb3RlYm9va0tlcm5lbHNTaGFwZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fY29sbGVjdG9yID0gbmV3IFRpbWVvdXRCYXNlZENvbGxlY3RvcigxMCwgdXBkYXRlcyA9PiB0aGlzLnVwZGF0ZSh1cGRhdGVzKSk7XG5cblx0XHR0aGlzLl9leGVjdXRpb25PcmRlciA9IF9jZWxsLmludGVybmFsTWV0YWRhdGEuZXhlY3V0aW9uT3JkZXI7XG5cdFx0dGhpcy5fcHJveHkuJGNyZWF0ZUV4ZWN1dGlvbih0aGlzLl9oYW5kbGUsIGNvbnRyb2xsZXJJZCwgdGhpcy5fY2VsbC5ub3RlYm9vay51cmksIHRoaXMuX2NlbGwuaGFuZGxlKTtcblx0fVxuXG5cdGNhbmNlbCgpOiB2b2lkIHtcblx0XHR0aGlzLl90b2tlblNvdXJjZS5jYW5jZWwoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdXBkYXRlU29vbih1cGRhdGU6IElDZWxsRXhlY3V0ZVVwZGF0ZUR0byk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuX2NvbGxlY3Rvci5hZGRJdGVtKHVwZGF0ZSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZSh1cGRhdGU6IElDZWxsRXhlY3V0ZVVwZGF0ZUR0byB8IElDZWxsRXhlY3V0ZVVwZGF0ZUR0b1tdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgdXBkYXRlcyA9IEFycmF5LmlzQXJyYXkodXBkYXRlKSA/IHVwZGF0ZSA6IFt1cGRhdGVdO1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS4kdXBkYXRlRXhlY3V0aW9uKHRoaXMuX2hhbmRsZSwgbmV3IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzKHVwZGF0ZXMpKTtcblx0fVxuXG5cdHByaXZhdGUgdmVyaWZ5U3RhdGVGb3JPdXRwdXQoKSB7XG5cdFx0aWYgKHRoaXMuX3N0YXRlID09PSBOb3RlYm9va0NlbGxFeGVjdXRpb25UYXNrU3RhdGUuSW5pdCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdNdXN0IGNhbGwgc3RhcnQgYmVmb3JlIG1vZGlmeWluZyBjZWxsIG91dHB1dCcpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9zdGF0ZSA9PT0gTm90ZWJvb2tDZWxsRXhlY3V0aW9uVGFza1N0YXRlLlJlc29sdmVkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBtb2RpZnkgY2VsbCBvdXRwdXQgYWZ0ZXIgY2FsbGluZyByZXNvbHZlJyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjZWxsSW5kZXhUb0hhbmRsZShjZWxsT3JDZWxsSW5kZXg6IHZzY29kZS5Ob3RlYm9va0NlbGwgfCB1bmRlZmluZWQpOiBudW1iZXIge1xuXHRcdGxldCBjZWxsOiBFeHRIb3N0Q2VsbCB8IHVuZGVmaW5lZCA9IHRoaXMuX2NlbGw7XG5cdFx0aWYgKGNlbGxPckNlbGxJbmRleCkge1xuXHRcdFx0Y2VsbCA9IHRoaXMuX2NlbGwubm90ZWJvb2suZ2V0Q2VsbEZyb21BcGlDZWxsKGNlbGxPckNlbGxJbmRleCk7XG5cdFx0fVxuXHRcdGlmICghY2VsbCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJTlZBTElEIGNlbGwnKTtcblx0XHR9XG5cdFx0cmV0dXJuIGNlbGwuaGFuZGxlO1xuXHR9XG5cblx0cHJpdmF0ZSB2YWxpZGF0ZUFuZENvbnZlcnRPdXRwdXRzKGl0ZW1zOiB2c2NvZGUuTm90ZWJvb2tDZWxsT3V0cHV0W10pOiBOb3RlYm9va091dHB1dER0b1tdIHtcblx0XHRyZXR1cm4gaXRlbXMubWFwKG91dHB1dCA9PiB7XG5cdFx0XHRjb25zdCBuZXdPdXRwdXQgPSBOb3RlYm9va0NlbGxPdXRwdXQuZW5zdXJlVW5pcXVlTWltZVR5cGVzKG91dHB1dC5pdGVtcywgdHJ1ZSk7XG5cdFx0XHRpZiAobmV3T3V0cHV0ID09PSBvdXRwdXQuaXRlbXMpIHtcblx0XHRcdFx0cmV0dXJuIGV4dEhvc3RUeXBlQ29udmVydGVycy5Ob3RlYm9va0NlbGxPdXRwdXQuZnJvbShvdXRwdXQpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGV4dEhvc3RUeXBlQ29udmVydGVycy5Ob3RlYm9va0NlbGxPdXRwdXQuZnJvbSh7XG5cdFx0XHRcdGl0ZW1zOiBuZXdPdXRwdXQsXG5cdFx0XHRcdGlkOiBvdXRwdXQuaWQsXG5cdFx0XHRcdG1ldGFkYXRhOiBvdXRwdXQubWV0YWRhdGFcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVPdXRwdXRzKG91dHB1dHM6IHZzY29kZS5Ob3RlYm9va0NlbGxPdXRwdXQgfCB2c2NvZGUuTm90ZWJvb2tDZWxsT3V0cHV0W10sIGNlbGw6IHZzY29kZS5Ob3RlYm9va0NlbGwgfCB1bmRlZmluZWQsIGFwcGVuZDogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuY2VsbEluZGV4VG9IYW5kbGUoY2VsbCk7XG5cdFx0Y29uc3Qgb3V0cHV0RHRvcyA9IHRoaXMudmFsaWRhdGVBbmRDb252ZXJ0T3V0cHV0cyhhc0FycmF5KG91dHB1dHMpKTtcblx0XHRyZXR1cm4gdGhpcy51cGRhdGVTb29uKFxuXHRcdFx0e1xuXHRcdFx0XHRlZGl0VHlwZTogQ2VsbEV4ZWN1dGlvblVwZGF0ZVR5cGUuT3V0cHV0LFxuXHRcdFx0XHRjZWxsSGFuZGxlOiBoYW5kbGUsXG5cdFx0XHRcdGFwcGVuZCxcblx0XHRcdFx0b3V0cHV0czogb3V0cHV0RHRvc1xuXHRcdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZU91dHB1dEl0ZW1zKGl0ZW1zOiB2c2NvZGUuTm90ZWJvb2tDZWxsT3V0cHV0SXRlbSB8IHZzY29kZS5Ob3RlYm9va0NlbGxPdXRwdXRJdGVtW10sIG91dHB1dDogdnNjb2RlLk5vdGVib29rQ2VsbE91dHB1dCwgYXBwZW5kOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aXRlbXMgPSBOb3RlYm9va0NlbGxPdXRwdXQuZW5zdXJlVW5pcXVlTWltZVR5cGVzKGFzQXJyYXkoaXRlbXMpLCB0cnVlKTtcblx0XHRyZXR1cm4gdGhpcy51cGRhdGVTb29uKHtcblx0XHRcdGVkaXRUeXBlOiBDZWxsRXhlY3V0aW9uVXBkYXRlVHlwZS5PdXRwdXRJdGVtcyxcblx0XHRcdGl0ZW1zOiBpdGVtcy5tYXAoZXh0SG9zdFR5cGVDb252ZXJ0ZXJzLk5vdGVib29rQ2VsbE91dHB1dEl0ZW0uZnJvbSksXG5cdFx0XHRvdXRwdXRJZDogb3V0cHV0LmlkLFxuXHRcdFx0YXBwZW5kXG5cdFx0fSk7XG5cdH1cblxuXHRhc0FwaU9iamVjdCgpOiB2c2NvZGUuTm90ZWJvb2tDZWxsRXhlY3V0aW9uIHtcblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRjb25zdCByZXN1bHQ6IHZzY29kZS5Ob3RlYm9va0NlbGxFeGVjdXRpb24gPSB7XG5cdFx0XHRnZXQgdG9rZW4oKSB7IHJldHVybiB0aGF0Ll90b2tlblNvdXJjZS50b2tlbjsgfSxcblx0XHRcdGdldCBjZWxsKCkgeyByZXR1cm4gdGhhdC5fY2VsbC5hcGlDZWxsOyB9LFxuXHRcdFx0Z2V0IGV4ZWN1dGlvbk9yZGVyKCkgeyByZXR1cm4gdGhhdC5fZXhlY3V0aW9uT3JkZXI7IH0sXG5cdFx0XHRzZXQgZXhlY3V0aW9uT3JkZXIodjogbnVtYmVyIHwgdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHRoYXQuX2V4ZWN1dGlvbk9yZGVyID0gdjtcblx0XHRcdFx0dGhhdC51cGRhdGUoW3tcblx0XHRcdFx0XHRlZGl0VHlwZTogQ2VsbEV4ZWN1dGlvblVwZGF0ZVR5cGUuRXhlY3V0aW9uU3RhdGUsXG5cdFx0XHRcdFx0ZXhlY3V0aW9uT3JkZXI6IHRoYXQuX2V4ZWN1dGlvbk9yZGVyXG5cdFx0XHRcdH1dKTtcblx0XHRcdH0sXG5cblx0XHRcdHN0YXJ0KHN0YXJ0VGltZT86IG51bWJlcik6IHZvaWQge1xuXHRcdFx0XHRpZiAodGhhdC5fc3RhdGUgPT09IE5vdGVib29rQ2VsbEV4ZWN1dGlvblRhc2tTdGF0ZS5SZXNvbHZlZCB8fCB0aGF0Ll9zdGF0ZSA9PT0gTm90ZWJvb2tDZWxsRXhlY3V0aW9uVGFza1N0YXRlLlN0YXJ0ZWQpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0Nhbm5vdCBjYWxsIHN0YXJ0IGFnYWluJyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGF0Ll9zdGF0ZSA9IE5vdGVib29rQ2VsbEV4ZWN1dGlvblRhc2tTdGF0ZS5TdGFydGVkO1xuXHRcdFx0XHR0aGF0Ll9vbkRpZENoYW5nZVN0YXRlLmZpcmUoKTtcblxuXHRcdFx0XHR0aGF0LnVwZGF0ZSh7XG5cdFx0XHRcdFx0ZWRpdFR5cGU6IENlbGxFeGVjdXRpb25VcGRhdGVUeXBlLkV4ZWN1dGlvblN0YXRlLFxuXHRcdFx0XHRcdHJ1blN0YXJ0VGltZTogc3RhcnRUaW1lXG5cdFx0XHRcdH0pO1xuXHRcdFx0fSxcblxuXHRcdFx0ZW5kKHN1Y2Nlc3M6IGJvb2xlYW4gfCB1bmRlZmluZWQsIGVuZFRpbWU/OiBudW1iZXIsIGV4ZWN1dGlvbkVycm9yPzogdnNjb2RlLkNlbGxFeGVjdXRpb25FcnJvcik6IHZvaWQge1xuXHRcdFx0XHRpZiAodGhhdC5fc3RhdGUgPT09IE5vdGVib29rQ2VsbEV4ZWN1dGlvblRhc2tTdGF0ZS5SZXNvbHZlZCkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IGNhbGwgcmVzb2x2ZSB0d2ljZScpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhhdC5fc3RhdGUgPSBOb3RlYm9va0NlbGxFeGVjdXRpb25UYXNrU3RhdGUuUmVzb2x2ZWQ7XG5cdFx0XHRcdHRoYXQuX29uRGlkQ2hhbmdlU3RhdGUuZmlyZSgpO1xuXG5cdFx0XHRcdC8vIFRoZSBsYXN0IHVwZGF0ZSBuZWVkcyB0byBiZSBvcmRlcmVkIGNvcnJlY3RseSBhbmQgYXBwbGllZCBpbW1lZGlhdGVseSxcblx0XHRcdFx0Ly8gc28gd2UgdXNlIHVwZGF0ZVNvb24gYW5kIGltbWVkaWF0ZWx5IGZsdXNoLlxuXHRcdFx0XHR0aGF0Ll9jb2xsZWN0b3IuZmx1c2goKTtcblxuXHRcdFx0XHRjb25zdCBlcnJvciA9IGNyZWF0ZVNlcmlhbGl6ZWFibGVFcnJvcihleGVjdXRpb25FcnJvcik7XG5cblx0XHRcdFx0dGhhdC5fcHJveHkuJGNvbXBsZXRlRXhlY3V0aW9uKHRoYXQuX2hhbmRsZSwgbmV3IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzKHtcblx0XHRcdFx0XHRydW5FbmRUaW1lOiBlbmRUaW1lLFxuXHRcdFx0XHRcdGxhc3RSdW5TdWNjZXNzOiBzdWNjZXNzLFxuXHRcdFx0XHRcdGVycm9yXG5cdFx0XHRcdH0pKTtcblx0XHRcdH0sXG5cblx0XHRcdGNsZWFyT3V0cHV0KGNlbGw/OiB2c2NvZGUuTm90ZWJvb2tDZWxsKTogVGhlbmFibGU8dm9pZD4ge1xuXHRcdFx0XHR0aGF0LnZlcmlmeVN0YXRlRm9yT3V0cHV0KCk7XG5cdFx0XHRcdHJldHVybiB0aGF0LnVwZGF0ZU91dHB1dHMoW10sIGNlbGwsIGZhbHNlKTtcblx0XHRcdH0sXG5cblx0XHRcdGFwcGVuZE91dHB1dChvdXRwdXRzOiB2c2NvZGUuTm90ZWJvb2tDZWxsT3V0cHV0IHwgdnNjb2RlLk5vdGVib29rQ2VsbE91dHB1dFtdLCBjZWxsPzogdnNjb2RlLk5vdGVib29rQ2VsbCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHR0aGF0LnZlcmlmeVN0YXRlRm9yT3V0cHV0KCk7XG5cdFx0XHRcdHJldHVybiB0aGF0LnVwZGF0ZU91dHB1dHMob3V0cHV0cywgY2VsbCwgdHJ1ZSk7XG5cdFx0XHR9LFxuXG5cdFx0XHRyZXBsYWNlT3V0cHV0KG91dHB1dHM6IHZzY29kZS5Ob3RlYm9va0NlbGxPdXRwdXQgfCB2c2NvZGUuTm90ZWJvb2tDZWxsT3V0cHV0W10sIGNlbGw/OiB2c2NvZGUuTm90ZWJvb2tDZWxsKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdHRoYXQudmVyaWZ5U3RhdGVGb3JPdXRwdXQoKTtcblx0XHRcdFx0cmV0dXJuIHRoYXQudXBkYXRlT3V0cHV0cyhvdXRwdXRzLCBjZWxsLCBmYWxzZSk7XG5cdFx0XHR9LFxuXG5cdFx0XHRhcHBlbmRPdXRwdXRJdGVtcyhpdGVtczogdnNjb2RlLk5vdGVib29rQ2VsbE91dHB1dEl0ZW0gfCB2c2NvZGUuTm90ZWJvb2tDZWxsT3V0cHV0SXRlbVtdLCBvdXRwdXQ6IHZzY29kZS5Ob3RlYm9va0NlbGxPdXRwdXQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0dGhhdC52ZXJpZnlTdGF0ZUZvck91dHB1dCgpO1xuXHRcdFx0XHRyZXR1cm4gdGhhdC51cGRhdGVPdXRwdXRJdGVtcyhpdGVtcywgb3V0cHV0LCB0cnVlKTtcblx0XHRcdH0sXG5cblx0XHRcdHJlcGxhY2VPdXRwdXRJdGVtcyhpdGVtczogdnNjb2RlLk5vdGVib29rQ2VsbE91dHB1dEl0ZW0gfCB2c2NvZGUuTm90ZWJvb2tDZWxsT3V0cHV0SXRlbVtdLCBvdXRwdXQ6IHZzY29kZS5Ob3RlYm9va0NlbGxPdXRwdXQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdFx0dGhhdC52ZXJpZnlTdGF0ZUZvck91dHB1dCgpO1xuXHRcdFx0XHRyZXR1cm4gdGhhdC51cGRhdGVPdXRwdXRJdGVtcyhpdGVtcywgb3V0cHV0LCBmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRyZXR1cm4gT2JqZWN0LmZyZWV6ZShyZXN1bHQpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVNlcmlhbGl6ZWFibGVFcnJvcihleGVjdXRpb25FcnJvcjogdnNjb2RlLkNlbGxFeGVjdXRpb25FcnJvciB8IHVuZGVmaW5lZCkge1xuXHRjb25zdCBjb252ZXJ0UmFuZ2UgPSAocmFuZ2U6IHZzY29kZS5SYW5nZSB8IHVuZGVmaW5lZCkgPT4gKHJhbmdlID8ge1xuXHRcdHN0YXJ0TGluZU51bWJlcjogcmFuZ2Uuc3RhcnQubGluZSxcblx0XHRzdGFydENvbHVtbjogcmFuZ2Uuc3RhcnQuY2hhcmFjdGVyLFxuXHRcdGVuZExpbmVOdW1iZXI6IHJhbmdlLmVuZC5saW5lLFxuXHRcdGVuZENvbHVtbjogcmFuZ2UuZW5kLmNoYXJhY3RlclxuXHR9IDogdW5kZWZpbmVkKTtcblxuXHRjb25zdCBjb252ZXJ0U3RhY2tGcmFtZSA9IChmcmFtZTogdnNjb2RlLkNlbGxFcnJvclN0YWNrRnJhbWUpID0+ICh7XG5cdFx0dXJpOiBmcmFtZS51cmksXG5cdFx0cG9zaXRpb246IGZyYW1lLnBvc2l0aW9uLFxuXHRcdGxhYmVsOiBmcmFtZS5sYWJlbFxuXHR9KTtcblxuXHRjb25zdCBlcnJvciA9IGV4ZWN1dGlvbkVycm9yID8ge1xuXHRcdG5hbWU6IGV4ZWN1dGlvbkVycm9yLm5hbWUsXG5cdFx0bWVzc2FnZTogZXhlY3V0aW9uRXJyb3IubWVzc2FnZSxcblx0XHRzdGFjazogZXhlY3V0aW9uRXJyb3Iuc3RhY2sgaW5zdGFuY2VvZiBBcnJheVxuXHRcdFx0PyBleGVjdXRpb25FcnJvci5zdGFjay5tYXAoZnJhbWUgPT4gY29udmVydFN0YWNrRnJhbWUoZnJhbWUpKVxuXHRcdFx0OiBleGVjdXRpb25FcnJvci5zdGFjayxcblx0XHRsb2NhdGlvbjogY29udmVydFJhbmdlKGV4ZWN1dGlvbkVycm9yLmxvY2F0aW9uKSxcblx0XHR1cmk6IGV4ZWN1dGlvbkVycm9yLnVyaVxuXHR9IDogdW5kZWZpbmVkO1xuXHRyZXR1cm4gZXJyb3I7XG59XG5cbmVudW0gTm90ZWJvb2tFeGVjdXRpb25UYXNrU3RhdGUge1xuXHRJbml0LFxuXHRTdGFydGVkLFxuXHRSZXNvbHZlZFxufVxuXG5cbmNsYXNzIE5vdGVib29rRXhlY3V0aW9uVGFzayBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIHN0YXRpYyBIQU5ETEUgPSAwO1xuXHRwcml2YXRlIF9oYW5kbGUgPSBOb3RlYm9va0V4ZWN1dGlvblRhc2suSEFORExFKys7XG5cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VTdGF0ZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlU3RhdGUgPSB0aGlzLl9vbkRpZENoYW5nZVN0YXRlLmV2ZW50O1xuXG5cdHByaXZhdGUgX3N0YXRlID0gTm90ZWJvb2tFeGVjdXRpb25UYXNrU3RhdGUuSW5pdDtcblx0Z2V0IHN0YXRlKCk6IE5vdGVib29rRXhlY3V0aW9uVGFza1N0YXRlIHsgcmV0dXJuIHRoaXMuX3N0YXRlOyB9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfdG9rZW5Tb3VyY2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0Y29udHJvbGxlcklkOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2s6IEV4dEhvc3ROb3RlYm9va0RvY3VtZW50LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBNYWluVGhyZWFkTm90ZWJvb2tLZXJuZWxzU2hhcGVcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3Byb3h5LiRjcmVhdGVOb3RlYm9va0V4ZWN1dGlvbih0aGlzLl9oYW5kbGUsIGNvbnRyb2xsZXJJZCwgdGhpcy5fbm90ZWJvb2sudXJpKTtcblx0fVxuXG5cdGNhbmNlbCgpOiB2b2lkIHtcblx0XHR0aGlzLl90b2tlblNvdXJjZS5jYW5jZWwoKTtcblx0fVxuXHRhc0FwaU9iamVjdCgpOiB2c2NvZGUuTm90ZWJvb2tFeGVjdXRpb24ge1xuXHRcdGNvbnN0IHJlc3VsdDogdnNjb2RlLk5vdGVib29rRXhlY3V0aW9uID0ge1xuXHRcdFx0c3RhcnQ6ICgpID0+IHtcblx0XHRcdFx0aWYgKHRoaXMuX3N0YXRlID09PSBOb3RlYm9va0V4ZWN1dGlvblRhc2tTdGF0ZS5SZXNvbHZlZCB8fCB0aGlzLl9zdGF0ZSA9PT0gTm90ZWJvb2tFeGVjdXRpb25UYXNrU3RhdGUuU3RhcnRlZCkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignQ2Fubm90IGNhbGwgc3RhcnQgYWdhaW4nKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMuX3N0YXRlID0gTm90ZWJvb2tFeGVjdXRpb25UYXNrU3RhdGUuU3RhcnRlZDtcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5maXJlKCk7XG5cblx0XHRcdFx0dGhpcy5fcHJveHkuJGJlZ2luTm90ZWJvb2tFeGVjdXRpb24odGhpcy5faGFuZGxlKTtcblx0XHRcdH0sXG5cblx0XHRcdGVuZDogKCkgPT4ge1xuXHRcdFx0XHRpZiAodGhpcy5fc3RhdGUgPT09IE5vdGVib29rRXhlY3V0aW9uVGFza1N0YXRlLlJlc29sdmVkKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDYW5ub3QgY2FsbCByZXNvbHZlIHR3aWNlJyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLl9zdGF0ZSA9IE5vdGVib29rRXhlY3V0aW9uVGFza1N0YXRlLlJlc29sdmVkO1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVN0YXRlLmZpcmUoKTtcblxuXHRcdFx0XHR0aGlzLl9wcm94eS4kY29tcGxldGVOb3RlYm9va0V4ZWN1dGlvbih0aGlzLl9oYW5kbGUpO1xuXHRcdFx0fSxcblxuXHRcdH07XG5cdFx0cmV0dXJuIE9iamVjdC5mcmVlemUocmVzdWx0KTtcblx0fVxufVxuXG5jbGFzcyBUaW1lb3V0QmFzZWRDb2xsZWN0b3I8VD4ge1xuXHRwcml2YXRlIGJhdGNoOiBUW10gPSBbXTtcblx0cHJpdmF0ZSBzdGFydGVkVGltZXIgPSBEYXRlLm5vdygpO1xuXHRwcml2YXRlIGN1cnJlbnREZWZlcnJlZDogRGVmZXJyZWRQcm9taXNlPHZvaWQ+IHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgZGVsYXk6IG51bWJlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNhbGxiYWNrOiAoaXRlbXM6IFRbXSkgPT4gUHJvbWlzZTx2b2lkPikgeyB9XG5cblx0YWRkSXRlbShpdGVtOiBUKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5iYXRjaC5wdXNoKGl0ZW0pO1xuXHRcdGlmICghdGhpcy5jdXJyZW50RGVmZXJyZWQpIHtcblx0XHRcdHRoaXMuY3VycmVudERlZmVycmVkID0gbmV3IERlZmVycmVkUHJvbWlzZTx2b2lkPigpO1xuXHRcdFx0dGhpcy5zdGFydGVkVGltZXIgPSBEYXRlLm5vdygpO1xuXHRcdFx0dGltZW91dCh0aGlzLmRlbGF5KS50aGVuKCgpID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuZmx1c2goKTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdC8vIFRoaXMgY2FuIGJlIGNhbGxlZCBieSB0aGUgZXh0ZW5zaW9uIHJlcGVhdGVkbHkgZm9yIGEgbG9uZyB0aW1lIGJlZm9yZSB0aGUgdGltZW91dCBpcyBhYmxlIHRvIHJ1bi5cblx0XHQvLyBGb3JjZSBhIGZsdXNoIGFmdGVyIHRoZSBkZWxheS5cblx0XHRpZiAoRGF0ZS5ub3coKSAtIHRoaXMuc3RhcnRlZFRpbWVyID4gdGhpcy5kZWxheSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuZmx1c2goKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5jdXJyZW50RGVmZXJyZWQucDtcblx0fVxuXG5cdGZsdXNoKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLmJhdGNoLmxlbmd0aCA9PT0gMCB8fCAhdGhpcy5jdXJyZW50RGVmZXJyZWQpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0XHR9XG5cblx0XHRjb25zdCBkZWZlcnJlZCA9IHRoaXMuY3VycmVudERlZmVycmVkO1xuXHRcdHRoaXMuY3VycmVudERlZmVycmVkID0gdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGJhdGNoID0gdGhpcy5iYXRjaDtcblx0XHR0aGlzLmJhdGNoID0gW107XG5cdFx0cmV0dXJuIHRoaXMuY2FsbGJhY2soYmF0Y2gpXG5cdFx0XHQuZmluYWxseSgoKSA9PiBkZWZlcnJlZC5jb21wbGV0ZSgpKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlS2VybmVsSWQoZXh0ZW5zaW9uSWRlbnRpZmllcjogRXh0ZW5zaW9uSWRlbnRpZmllciwgaWQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiBgJHtleHRlbnNpb25JZGVudGlmaWVyLnZhbHVlfS8ke2lkfWA7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZUFBZTtBQUN4QixTQUFTLGlCQUFpQixlQUFlO0FBQ3pDLFNBQTRCLCtCQUErQjtBQUMzRCxTQUFTLGVBQWU7QUFDeEIsU0FBUyxZQUFZLHVCQUFvQztBQUN6RCxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLFdBQTBCO0FBQ25DLFNBQVMsMkJBQWtEO0FBQzNELFNBQVMsbUJBQW1CO0FBQzVCLFNBQWdHLG1CQUF1RjtBQUN2TCxTQUFTLFlBQVksb0JBQW9CLHdCQUF5QztBQUlsRixZQUFZLDJCQUEyQjtBQUN2QyxTQUFTLDhCQUE4QixtQ0FBbUMsb0JBQW9CLDZCQUE2QixvQ0FBb0M7QUFDL0osU0FBUyxvQkFBb0I7QUFFN0IsU0FBUywrQkFBK0I7QUFDeEMsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxxQ0FBcUM7QUFFOUMsU0FBUyx3QkFB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QU8sTUFBTTtBQUNaLFlBQUksS0FBSyxXQUFXLG9CQUF1QyxLQUFLLFdBQVcsaUJBQW9DO0FBQzlHLGdCQUFNLElBQUksTUFBTSx5QkFBeUI7QUFBQSxRQUMxQztBQUVBLGFBQUssU0FBUztBQUNkLGFBQUssa0JBQWtCLEtBQUs7QUFFNUIsYUFBSyxPQUFPLHdCQUF3QixLQUFLLE9BQU87QUFBQSxNQUNqRDtBQUFBLE1BRUEsS0FBSyxNQUFNO0FBQ1YsWUFBSSxLQUFLLFdBQVcsa0JBQXFDO0FBQ3hELGdCQUFNLElBQUksTUFBTSwyQkFBMkI7QUFBQSxRQUM1QztBQUVBLGFBQUssU0FBUztBQUNkLGFBQUssa0JBQWtCLEtBQUs7QUFFNUIsYUFBSyxPQUFPLDJCQUEyQixLQUFLLE9BQU87QUFBQSxNQUNwRDtBQUFBLElBRUQ7QUFDQSxXQUFPLE9BQU8sT0FBTyxNQUFNO0FBQUEsRUFDNUI7QUFDRDtBQXBETSx1QkFDVSxTQUFTO0FBRHpCLElBQU0sd0JBQU47QUFzREEsTUFBTSxzQkFBeUI7QUFBQSxFQUs5QixZQUNrQixPQUNBLFVBQXlDO0FBRHpDO0FBQ0E7QUFObEIsU0FBUSxRQUFhLENBQUM7QUFDdEIsU0FBUSxlQUFlLEtBQUssSUFBSTtBQUFBLEVBSzZCO0FBQUEsRUFFN0QsUUFBUSxNQUF3QjtBQUMvQixTQUFLLE1BQU0sS0FBSyxJQUFJO0FBQ3BCLFFBQUksQ0FBQyxLQUFLLGlCQUFpQjtBQUMxQixXQUFLLGtCQUFrQixJQUFJLGdCQUFzQjtBQUNqRCxXQUFLLGVBQWUsS0FBSyxJQUFJO0FBQzdCLGNBQVEsS0FBSyxLQUFLLEVBQUUsS0FBSyxNQUFNO0FBQzlCLGVBQU8sS0FBSyxNQUFNO0FBQUEsTUFDbkIsQ0FBQztBQUFBLElBQ0Y7QUFJQSxRQUFJLEtBQUssSUFBSSxJQUFJLEtBQUssZUFBZSxLQUFLLE9BQU87QUFDaEQsYUFBTyxLQUFLLE1BQU07QUFBQSxJQUNuQjtBQUVBLFdBQU8sS0FBSyxnQkFBZ0I7QUFBQSxFQUM3QjtBQUFBLEVBRUEsUUFBdUI7QUFDdEIsUUFBSSxLQUFLLE1BQU0sV0FBVyxLQUFLLENBQUMsS0FBSyxpQkFBaUI7QUFDckQsYUFBTyxRQUFRLFFBQVE7QUFBQSxJQUN4QjtBQUVBLFVBQU0sV0FBVyxLQUFLO0FBQ3RCLFNBQUssa0JBQWtCO0FBQ3ZCLFVBQU0sUUFBUSxLQUFLO0FBQ25CLFNBQUssUUFBUSxDQUFDO0FBQ2QsV0FBTyxLQUFLLFNBQVMsS0FBSyxFQUN4QixRQUFRLE1BQU0sU0FBUyxTQUFTLENBQUM7QUFBQSxFQUNwQztBQUNEO0FBRU8sU0FBUyxlQUFlLHFCQUEwQyxJQUFvQjtBQUM1RixTQUFPLEdBQUcsb0JBQW9CLEtBQUssSUFBSSxFQUFFO0FBQzFDOyIsCiAgIm5hbWVzIjogWyJkYXRhIiwgIk5vdGVib29rQ2VsbEV4ZWN1dGlvblRhc2tTdGF0ZSIsICJOb3RlYm9va0V4ZWN1dGlvblRhc2tTdGF0ZSJdCn0K
