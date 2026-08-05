import { localize } from "../../../nls.js";
import { VSBuffer } from "../../../base/common/buffer.js";
import { Emitter } from "../../../base/common/event.js";
import { DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { ResourceMap, ResourceSet } from "../../../base/common/map.js";
import { MarshalledId } from "../../../base/common/marshallingIds.js";
import { isFalsyOrWhitespace } from "../../../base/common/strings.js";
import { assertIsDefined } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import * as files from "../../../platform/files/common/files.js";
import { Cache } from "./cache.js";
import { MainContext } from "./extHost.protocol.js";
import { ApiCommand, ApiCommandArgument, ApiCommandResult } from "./extHostCommands.js";
import * as typeConverters from "./extHostTypeConverters.js";
import * as extHostTypes from "./extHostTypes.js";
import { SerializableObjectWithBuffers } from "../../services/extensions/common/proxyIdentifier.js";
import { ExtHostCell, ExtHostNotebookDocument } from "./extHostNotebookDocument.js";
import { ExtHostNotebookEditor } from "./extHostNotebookEditor.js";
import { filter } from "../../../base/common/objects.js";
import { Schemas } from "../../../base/common/network.js";
import { QueryType } from "../../services/search/common/search.js";
import { CellSearchModel } from "../../contrib/search/common/cellSearchModel.js";
import { genericCellMatchesToTextSearchMatches } from "../../contrib/search/common/searchNotebookHelpers.js";
import { globMatchesResource, RegisteredEditorPriority } from "../../services/editor/common/editorResolverService.js";
const _ExtHostNotebookController = class _ExtHostNotebookController {
  constructor(mainContext, commands, _textDocumentsAndEditors, _textDocuments, _extHostFileSystem, _extHostSearch, _logService) {
    this._textDocumentsAndEditors = _textDocumentsAndEditors;
    this._textDocuments = _textDocuments;
    this._extHostFileSystem = _extHostFileSystem;
    this._extHostSearch = _extHostSearch;
    this._logService = _logService;
    this._notebookStatusBarItemProviders = /* @__PURE__ */ new Map();
    this._documents = new ResourceMap();
    this._editors = /* @__PURE__ */ new Map();
    this._onDidChangeActiveNotebookEditor = new Emitter();
    this.onDidChangeActiveNotebookEditor = this._onDidChangeActiveNotebookEditor.event;
    this._visibleNotebookEditors = [];
    this._onDidOpenNotebookDocument = new Emitter();
    this.onDidOpenNotebookDocument = this._onDidOpenNotebookDocument.event;
    this._onDidCloseNotebookDocument = new Emitter();
    this.onDidCloseNotebookDocument = this._onDidCloseNotebookDocument.event;
    this._onDidChangeVisibleNotebookEditors = new Emitter();
    this.onDidChangeVisibleNotebookEditors = this._onDidChangeVisibleNotebookEditors.event;
    this._statusBarCache = new Cache("NotebookCellStatusBarCache");
    // --- serialize/deserialize
    this._handlePool = 0;
    this._notebookSerializer = /* @__PURE__ */ new Map();
    this._notebookProxy = mainContext.getProxy(MainContext.MainThreadNotebook);
    this._notebookDocumentsProxy = mainContext.getProxy(MainContext.MainThreadNotebookDocuments);
    this._notebookEditorsProxy = mainContext.getProxy(MainContext.MainThreadNotebookEditors);
    this._commandsConverter = commands.converter;
    commands.registerArgumentProcessor({
      // Serialized INotebookCellActionContext
      processArgument: (arg) => {
        if (arg && arg.$mid === MarshalledId.NotebookCellActionContext) {
          const notebookUri = arg.notebookEditor?.notebookUri;
          const cellHandle = arg.cell.handle;
          const data = this._documents.get(notebookUri);
          const cell = data?.getCell(cellHandle);
          if (cell) {
            return cell.apiCell;
          }
        }
        if (arg && arg.$mid === MarshalledId.NotebookActionContext) {
          const notebookUri = arg.uri;
          const data = this._documents.get(notebookUri);
          if (data) {
            return data.apiNotebook;
          }
        }
        return arg;
      }
    });
    _ExtHostNotebookController._registerApiCommands(commands);
  }
  get activeNotebookEditor() {
    return this._activeNotebookEditor?.apiEditor;
  }
  get visibleNotebookEditors() {
    return this._visibleNotebookEditors.map((editor) => editor.apiEditor);
  }
  getEditorById(editorId) {
    const editor = this._editors.get(editorId);
    if (!editor) {
      throw new Error(`unknown text editor: ${editorId}. known editors: ${[...this._editors.keys()]} `);
    }
    return editor;
  }
  getIdByEditor(editor) {
    for (const [id, candidate] of this._editors) {
      if (candidate.apiEditor === editor) {
        return id;
      }
    }
    return void 0;
  }
  get notebookDocuments() {
    return [...this._documents.values()];
  }
  getNotebookDocument(uri, relaxed) {
    const result = this._documents.get(uri);
    if (!result && !relaxed) {
      throw new Error(`NO notebook document for '${uri}'`);
    }
    return result;
  }
  static _convertNotebookRegistrationData(extension, registration) {
    if (!registration) {
      return;
    }
    const viewOptionsFilenamePattern = registration.filenamePattern.map((pattern) => typeConverters.NotebookExclusiveDocumentPattern.from(pattern)).filter((pattern) => pattern !== void 0);
    if (registration.filenamePattern && !viewOptionsFilenamePattern) {
      console.warn(`Notebook content provider view options file name pattern is invalid ${registration.filenamePattern}`);
      return void 0;
    }
    return {
      extension: extension.identifier,
      providerDisplayName: extension.displayName || extension.name,
      displayName: registration.displayName,
      filenamePattern: viewOptionsFilenamePattern,
      priority: registration.exclusive ? RegisteredEditorPriority.exclusive : void 0
    };
  }
  registerNotebookCellStatusBarItemProvider(extension, notebookType, provider) {
    const handle = _ExtHostNotebookController._notebookStatusBarItemProviderHandlePool++;
    const eventHandle = typeof provider.onDidChangeCellStatusBarItems === "function" ? _ExtHostNotebookController._notebookStatusBarItemProviderHandlePool++ : void 0;
    this._notebookStatusBarItemProviders.set(handle, provider);
    this._notebookProxy.$registerNotebookCellStatusBarItemProvider(handle, eventHandle, notebookType);
    let subscription;
    if (eventHandle !== void 0) {
      subscription = provider.onDidChangeCellStatusBarItems((_) => this._notebookProxy.$emitCellStatusBarEvent(eventHandle));
    }
    return new extHostTypes.Disposable(() => {
      this._notebookStatusBarItemProviders.delete(handle);
      this._notebookProxy.$unregisterNotebookCellStatusBarItemProvider(handle, eventHandle);
      subscription?.dispose();
    });
  }
  async createNotebookDocument(options) {
    const canonicalUri = await this._notebookDocumentsProxy.$tryCreateNotebook({
      viewType: options.viewType,
      content: options.content && typeConverters.NotebookData.from(options.content)
    });
    return URI.revive(canonicalUri);
  }
  async openNotebookDocument(uri) {
    const cached = this._documents.get(uri);
    if (cached) {
      return cached.apiNotebook;
    }
    const canonicalUri = await this._notebookDocumentsProxy.$tryOpenNotebook(uri);
    const document = this._documents.get(URI.revive(canonicalUri));
    return assertIsDefined(document?.apiNotebook);
  }
  async showNotebookDocument(notebook, options) {
    let resolvedOptions;
    if (typeof options === "object") {
      resolvedOptions = {
        position: typeConverters.ViewColumn.from(options.viewColumn),
        preserveFocus: options.preserveFocus,
        selections: options.selections && options.selections.map(typeConverters.NotebookRange.from),
        pinned: typeof options.preview === "boolean" ? !options.preview : void 0,
        label: typeof options.asRepl === "string" ? options.asRepl : typeof options.asRepl === "object" ? options.asRepl.label : void 0
      };
    } else {
      resolvedOptions = {
        preserveFocus: false,
        pinned: true
      };
    }
    const viewType = !!options?.asRepl ? "repl" : notebook.notebookType;
    const editorId = await this._notebookEditorsProxy.$tryShowNotebookDocument(notebook.uri, viewType, resolvedOptions);
    const editor = editorId && this._editors.get(editorId)?.apiEditor;
    if (editor) {
      return editor;
    }
    if (editorId) {
      throw new Error(`Could NOT open editor for "${notebook.uri.toString()}" because another editor opened in the meantime.`);
    } else {
      throw new Error(`Could NOT open editor for "${notebook.uri.toString()}".`);
    }
  }
  async $provideNotebookCellStatusBarItems(handle, uri, index, token) {
    const provider = this._notebookStatusBarItemProviders.get(handle);
    const revivedUri = URI.revive(uri);
    const document = this._documents.get(revivedUri);
    if (!document || !provider) {
      return;
    }
    const cell = document.getCellFromIndex(index);
    if (!cell) {
      return;
    }
    const result = await provider.provideCellStatusBarItems(cell.apiCell, token);
    if (!result) {
      return void 0;
    }
    const disposables = new DisposableStore();
    const cacheId = this._statusBarCache.add([disposables]);
    const resultArr = Array.isArray(result) ? result : [result];
    const items = resultArr.map((item) => typeConverters.NotebookStatusBarItem.from(item, this._commandsConverter, disposables));
    return {
      cacheId,
      items
    };
  }
  $releaseNotebookCellStatusBarItems(cacheId) {
    this._statusBarCache.delete(cacheId);
  }
  registerNotebookSerializer(extension, viewType, serializer, options, registration) {
    if (isFalsyOrWhitespace(viewType)) {
      throw new Error(`viewType cannot be empty or just whitespace`);
    }
    const handle = this._handlePool++;
    this._notebookSerializer.set(handle, { viewType, serializer, options });
    this._notebookProxy.$registerNotebookSerializer(
      handle,
      { id: extension.identifier, location: extension.extensionLocation },
      viewType,
      typeConverters.NotebookDocumentContentOptions.from(options),
      _ExtHostNotebookController._convertNotebookRegistrationData(extension, registration)
    );
    return toDisposable(() => {
      this._notebookProxy.$unregisterNotebookSerializer(handle);
    });
  }
  async $dataToNotebook(handle, bytes, token) {
    const serializer = this._notebookSerializer.get(handle);
    if (!serializer) {
      throw new Error("NO serializer found");
    }
    const data = await serializer.serializer.deserializeNotebook(bytes.buffer, token);
    return new SerializableObjectWithBuffers(typeConverters.NotebookData.from(data));
  }
  async $notebookToData(handle, data, token) {
    const serializer = this._notebookSerializer.get(handle);
    if (!serializer) {
      throw new Error("NO serializer found");
    }
    const bytes = await serializer.serializer.serializeNotebook(typeConverters.NotebookData.to(data.value), token);
    return VSBuffer.wrap(bytes);
  }
  async $saveNotebook(handle, uriComponents, versionId, options, token) {
    const uri = URI.revive(uriComponents);
    const serializer = this._notebookSerializer.get(handle);
    this.trace(`enter saveNotebook(versionId: ${versionId}, ${uri.toString()})`);
    if (!serializer) {
      throw new Error("NO serializer found");
    }
    const document = this._documents.get(uri);
    if (!document) {
      throw new Error("Document NOT found");
    }
    if (document.versionId !== versionId) {
      throw new Error("Document version mismatch");
    }
    if (!this._extHostFileSystem.value.isWritableFileSystem(uri.scheme)) {
      throw new files.FileOperationError(localize("err.readonly", "Unable to modify read-only file '{0}'", this._resourceForError(uri)), files.FileOperationResult.FILE_PERMISSION_DENIED);
    }
    const data = {
      metadata: filter(document.apiNotebook.metadata, (key) => !(serializer.options?.transientDocumentMetadata ?? {})[key]),
      cells: []
    };
    for (const cell of document.apiNotebook.getCells()) {
      const cellData = new extHostTypes.NotebookCellData(
        cell.kind,
        cell.document.getText(),
        cell.document.languageId,
        cell.mime,
        !serializer.options?.transientOutputs ? [...cell.outputs] : [],
        cell.metadata,
        cell.executionSummary
      );
      cellData.metadata = filter(cell.metadata, (key) => !(serializer.options?.transientCellMetadata ?? {})[key]);
      data.cells.push(cellData);
    }
    await this._validateWriteFile(uri, options);
    if (token.isCancellationRequested) {
      throw new Error("canceled");
    }
    const bytes = await serializer.serializer.serializeNotebook(data, token);
    if (token.isCancellationRequested) {
      throw new Error("canceled");
    }
    this.trace(`serialized versionId: ${versionId} ${uri.toString()}`);
    await this._extHostFileSystem.value.writeFile(uri, bytes);
    this.trace(`Finished write versionId: ${versionId} ${uri.toString()}`);
    const providerExtUri = this._extHostFileSystem.getFileSystemProviderExtUri(uri.scheme);
    const stat = await this._extHostFileSystem.value.stat(uri);
    const fileStats = {
      name: providerExtUri.basename(uri),
      isFile: (stat.type & files.FileType.File) !== 0,
      isDirectory: (stat.type & files.FileType.Directory) !== 0,
      isSymbolicLink: (stat.type & files.FileType.SymbolicLink) !== 0,
      mtime: stat.mtime,
      ctime: stat.ctime,
      size: stat.size,
      readonly: Boolean((stat.permissions ?? 0) & files.FilePermission.Readonly) || !this._extHostFileSystem.value.isWritableFileSystem(uri.scheme),
      locked: Boolean((stat.permissions ?? 0) & files.FilePermission.Locked),
      etag: files.etag({ mtime: stat.mtime, size: stat.size }),
      children: void 0
    };
    this.trace(`exit saveNotebook(versionId: ${versionId}, ${uri.toString()})`);
    return fileStats;
  }
  /**
   * Search for query in all notebooks that can be deserialized by the serializer fetched by `handle`.
   *
   * @param handle used to get notebook serializer
   * @param textQuery the text query to search using
   * @param viewTypeFileTargets the globs (and associated ranks) that are targetting for opening this type of notebook
   * @param otherViewTypeFileTargets ranked globs for other editors that we should consider when deciding whether it will open as this notebook
   * @param token cancellation token
   * @returns `IRawClosedNotebookFileMatch` for every file. Files without matches will just have a `IRawClosedNotebookFileMatch`
   * 	with no `cellResults`. This allows the caller to know what was searched in already, even if it did not yield results.
   */
  async $searchInNotebooks(handle, textQuery, viewTypeFileTargets, otherViewTypeFileTargets, token) {
    const serializer = this._notebookSerializer.get(handle)?.serializer;
    if (!serializer) {
      return {
        limitHit: false,
        results: []
      };
    }
    const finalMatchedTargets = new ResourceSet();
    const runFileQueries = async (includes, token2, textQuery2) => {
      await Promise.all(includes.map(
        async (include) => await Promise.all(include.filenamePatterns.map((filePattern) => {
          const query = {
            _reason: textQuery2._reason,
            folderQueries: textQuery2.folderQueries,
            includePattern: textQuery2.includePattern,
            excludePattern: textQuery2.excludePattern,
            maxResults: textQuery2.maxResults,
            type: QueryType.File,
            filePattern
          };
          return this._extHostSearch.doInternalFileSearchWithCustomCallback(query, token2, (data) => {
            data.forEach((uri) => {
              if (finalMatchedTargets.has(uri)) {
                return;
              }
              const hasOtherMatches = otherViewTypeFileTargets.some((target) => {
                if (include.isFromSettings && !target.isFromSettings) {
                  return false;
                } else {
                  return target.filenamePatterns.some((targetFilePattern) => globMatchesResource(targetFilePattern, uri));
                }
              });
              if (hasOtherMatches) {
                return;
              }
              finalMatchedTargets.add(uri);
            });
          }).catch((err) => {
            if (err.code === "ENOENT") {
              console.warn(`Could not find notebook search results, ignoring notebook results.`);
              return {
                limitHit: false,
                messages: []
              };
            } else {
              throw err;
            }
          });
        }))
      ));
      return;
    };
    await runFileQueries(viewTypeFileTargets, token, textQuery);
    const results = new ResourceMap();
    let limitHit = false;
    const promises = Array.from(finalMatchedTargets).map(async (uri) => {
      const cellMatches = [];
      try {
        if (token.isCancellationRequested) {
          return;
        }
        if (textQuery.maxResults && [...results.values()].reduce((acc, value) => acc + value.cellResults.length, 0) > textQuery.maxResults) {
          limitHit = true;
          return;
        }
        const simpleCells = [];
        const notebook = this._documents.get(uri);
        if (notebook) {
          const cells = notebook.apiNotebook.getCells();
          cells.forEach((e) => simpleCells.push(
            {
              input: e.document.getText(),
              outputs: e.outputs.flatMap((value) => value.items.map((output) => output.data.toString()))
            }
          ));
        } else {
          const fileContent = await this._extHostFileSystem.value.readFile(uri);
          const bytes = VSBuffer.fromString(fileContent.toString());
          const notebook2 = await serializer.deserializeNotebook(bytes.buffer, token);
          if (token.isCancellationRequested) {
            return;
          }
          const data = typeConverters.NotebookData.from(notebook2);
          data.cells.forEach((cell) => simpleCells.push(
            {
              input: cell.source,
              outputs: cell.outputs.flatMap((value) => value.items.map((output) => output.valueBytes.toString()))
            }
          ));
        }
        if (token.isCancellationRequested) {
          return;
        }
        simpleCells.forEach((cell, index) => {
          const target = textQuery.contentPattern.pattern;
          const cellModel = new CellSearchModel(cell.input, void 0, cell.outputs);
          const inputMatches = cellModel.findInInputs(target);
          const outputMatches = cellModel.findInOutputs(target);
          const webviewResults = outputMatches.flatMap((outputMatch) => genericCellMatchesToTextSearchMatches(outputMatch.matches, outputMatch.textBuffer)).map((textMatch, index2) => {
            textMatch.webviewIndex = index2;
            return textMatch;
          });
          if (inputMatches.length > 0 || outputMatches.length > 0) {
            const cellMatch = {
              index,
              contentResults: genericCellMatchesToTextSearchMatches(inputMatches, cellModel.inputTextBuffer),
              webviewResults
            };
            cellMatches.push(cellMatch);
          }
        });
        const fileMatch = {
          resource: uri,
          cellResults: cellMatches
        };
        results.set(uri, fileMatch);
        return;
      } catch (e) {
        return;
      }
    });
    await Promise.all(promises);
    return {
      limitHit,
      results: [...results.values()]
    };
  }
  async _validateWriteFile(uri, options) {
    const stat = await this._extHostFileSystem.value.stat(uri);
    if (typeof options?.mtime === "number" && typeof options.etag === "string" && options.etag !== files.ETAG_DISABLED && typeof stat.mtime === "number" && typeof stat.size === "number" && options.mtime < stat.mtime && options.etag !== files.etag({ mtime: options.mtime, size: stat.size })) {
      throw new files.FileOperationError(localize("fileModifiedError", "File Modified Since"), files.FileOperationResult.FILE_MODIFIED_SINCE, options);
    }
    return;
  }
  _resourceForError(uri) {
    return uri.scheme === Schemas.file ? uri.fsPath : uri.toString();
  }
  // --- open, save, saveAs, backup
  _createExtHostEditor(document, editorId, data) {
    if (this._editors.has(editorId)) {
      throw new Error(`editor with id ALREADY EXSIST: ${editorId}`);
    }
    const editor = new ExtHostNotebookEditor(
      editorId,
      this._notebookEditorsProxy,
      document,
      data.visibleRanges.map(typeConverters.NotebookRange.to),
      data.selections.map(typeConverters.NotebookRange.to),
      typeof data.viewColumn === "number" ? typeConverters.ViewColumn.to(data.viewColumn) : void 0,
      data.viewType
    );
    this._editors.set(editorId, editor);
  }
  $acceptDocumentAndEditorsDelta(delta) {
    if (delta.value.removedDocuments) {
      for (const uri of delta.value.removedDocuments) {
        const revivedUri = URI.revive(uri);
        const document = this._documents.get(revivedUri);
        if (document) {
          document.dispose();
          this._documents.delete(revivedUri);
          this._textDocumentsAndEditors.$acceptDocumentsAndEditorsDelta({ removedDocuments: document.apiNotebook.getCells().map((cell) => cell.document.uri) });
          this._onDidCloseNotebookDocument.fire(document.apiNotebook);
        }
        for (const editor of this._editors.values()) {
          if (editor.notebookData.uri.toString() === revivedUri.toString()) {
            this._editors.delete(editor.id);
          }
        }
      }
    }
    if (delta.value.addedDocuments) {
      const addedCellDocuments = [];
      for (const modelData of delta.value.addedDocuments) {
        const uri = URI.revive(modelData.uri);
        if (this._documents.has(uri)) {
          throw new Error(`adding EXISTING notebook ${uri} `);
        }
        const document = new ExtHostNotebookDocument(
          this._notebookDocumentsProxy,
          this._textDocumentsAndEditors,
          this._textDocuments,
          uri,
          modelData
        );
        addedCellDocuments.push(...modelData.cells.map((cell) => ExtHostCell.asModelAddData(cell)));
        this._documents.get(uri)?.dispose();
        this._documents.set(uri, document);
        this._textDocumentsAndEditors.$acceptDocumentsAndEditorsDelta({ addedDocuments: addedCellDocuments });
        this._onDidOpenNotebookDocument.fire(document.apiNotebook);
      }
    }
    if (delta.value.addedEditors) {
      for (const editorModelData of delta.value.addedEditors) {
        if (this._editors.has(editorModelData.id)) {
          return;
        }
        const revivedUri = URI.revive(editorModelData.documentUri);
        const document = this._documents.get(revivedUri);
        if (document) {
          this._createExtHostEditor(document, editorModelData.id, editorModelData);
        }
      }
    }
    const removedEditors = [];
    if (delta.value.removedEditors) {
      for (const editorid of delta.value.removedEditors) {
        const editor = this._editors.get(editorid);
        if (editor) {
          this._editors.delete(editorid);
          if (this._activeNotebookEditor?.id === editor.id) {
            this._activeNotebookEditor = void 0;
          }
          removedEditors.push(editor);
        }
      }
    }
    if (delta.value.visibleEditors) {
      this._visibleNotebookEditors = delta.value.visibleEditors.map((id) => this._editors.get(id)).filter((editor) => !!editor);
      const visibleEditorsSet = /* @__PURE__ */ new Set();
      this._visibleNotebookEditors.forEach((editor) => visibleEditorsSet.add(editor.id));
      for (const editor of this._editors.values()) {
        const newValue = visibleEditorsSet.has(editor.id);
        editor._acceptVisibility(newValue);
      }
      this._visibleNotebookEditors = [...this._editors.values()].map((e) => e).filter((e) => e.visible);
      this._onDidChangeVisibleNotebookEditors.fire(this.visibleNotebookEditors);
    }
    if (delta.value.newActiveEditor === null) {
      this._activeNotebookEditor = void 0;
    } else if (delta.value.newActiveEditor) {
      const activeEditor = this._editors.get(delta.value.newActiveEditor);
      if (!activeEditor) {
        console.error(`FAILED to find active notebook editor ${delta.value.newActiveEditor}`);
      }
      this._activeNotebookEditor = this._editors.get(delta.value.newActiveEditor);
    }
    if (delta.value.newActiveEditor !== void 0) {
      this._onDidChangeActiveNotebookEditor.fire(this._activeNotebookEditor?.apiEditor);
    }
  }
  static _registerApiCommands(extHostCommands) {
    const notebookTypeArg = ApiCommandArgument.String.with("notebookType", "A notebook type");
    const commandDataToNotebook = new ApiCommand(
      "vscode.executeDataToNotebook",
      "_executeDataToNotebook",
      "Invoke notebook serializer",
      [notebookTypeArg, new ApiCommandArgument("data", "Bytes to convert to data", (v) => v instanceof Uint8Array, (v) => VSBuffer.wrap(v))],
      new ApiCommandResult("Notebook Data", (data) => typeConverters.NotebookData.to(data.value))
    );
    const commandNotebookToData = new ApiCommand(
      "vscode.executeNotebookToData",
      "_executeNotebookToData",
      "Invoke notebook serializer",
      [notebookTypeArg, new ApiCommandArgument("NotebookData", "Notebook data to convert to bytes", (v) => true, (v) => new SerializableObjectWithBuffers(typeConverters.NotebookData.from(v)))],
      new ApiCommandResult("Bytes", (dto) => dto.buffer)
    );
    extHostCommands.registerApiCommand(commandDataToNotebook);
    extHostCommands.registerApiCommand(commandNotebookToData);
  }
  trace(msg) {
    this._logService.trace(`[Extension Host Notebook] ${msg}`);
  }
};
_ExtHostNotebookController._notebookStatusBarItemProviderHandlePool = 0;
let ExtHostNotebookController = _ExtHostNotebookController;
export {
  ExtHostNotebookController
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0Tm90ZWJvb2sudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElSZWxhdGl2ZVBhdHRlcm4gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9nbG9iLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCwgUmVzb3VyY2VTZXQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXAuanMnO1xuaW1wb3J0IHsgTWFyc2hhbGxlZElkIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbWFyc2hhbGxpbmdJZHMuanMnO1xuaW1wb3J0IHsgaXNGYWxzeU9yV2hpdGVzcGFjZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0ICogYXMgZmlsZXMgZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IENhY2hlIH0gZnJvbSAnLi9jYWNoZS5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0Tm90ZWJvb2tTaGFwZSwgSU1haW5Db250ZXh0LCBJTW9kZWxBZGRlZERhdGEsIElOb3RlYm9va0NlbGxTdGF0dXNCYXJMaXN0RHRvLCBJTm90ZWJvb2tEb2N1bWVudHNBbmRFZGl0b3JzRGVsdGEsIElOb3RlYm9va0RvY3VtZW50U2hvd09wdGlvbnMsIElOb3RlYm9va0VkaXRvckFkZERhdGEsIElOb3RlYm9va1BhcnRpYWxGaWxlU3RhdHNXaXRoTWV0YWRhdGEsIE1haW5Db250ZXh0LCBNYWluVGhyZWFkTm90ZWJvb2tEb2N1bWVudHNTaGFwZSwgTWFpblRocmVhZE5vdGVib29rRWRpdG9yc1NoYXBlLCBNYWluVGhyZWFkTm90ZWJvb2tTaGFwZSwgTm90ZWJvb2tEYXRhRHRvIH0gZnJvbSAnLi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7IEFwaUNvbW1hbmQsIEFwaUNvbW1hbmRBcmd1bWVudCwgQXBpQ29tbWFuZFJlc3VsdCwgQ29tbWFuZHNDb252ZXJ0ZXIsIEV4dEhvc3RDb21tYW5kcyB9IGZyb20gJy4vZXh0SG9zdENvbW1hbmRzLmpzJztcbmltcG9ydCB7IEV4dEhvc3REb2N1bWVudHMgfSBmcm9tICcuL2V4dEhvc3REb2N1bWVudHMuanMnO1xuaW1wb3J0IHsgRXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMgfSBmcm9tICcuL2V4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzLmpzJztcbmltcG9ydCAqIGFzIHR5cGVDb252ZXJ0ZXJzIGZyb20gJy4vZXh0SG9zdFR5cGVDb252ZXJ0ZXJzLmpzJztcbmltcG9ydCAqIGFzIGV4dEhvc3RUeXBlcyBmcm9tICcuL2V4dEhvc3RUeXBlcy5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tFeGNsdXNpdmVEb2N1bWVudEZpbHRlciwgSU5vdGVib29rQ29udHJpYnV0aW9uRGF0YSB9IGZyb20gJy4uLy4uL2NvbnRyaWIvbm90ZWJvb2svY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vcHJveHlJZGVudGlmaWVyLmpzJztcbmltcG9ydCB0eXBlICogYXMgdnNjb2RlIGZyb20gJ3ZzY29kZSc7XG5pbXBvcnQgeyBFeHRIb3N0Q2VsbCwgRXh0SG9zdE5vdGVib29rRG9jdW1lbnQgfSBmcm9tICcuL2V4dEhvc3ROb3RlYm9va0RvY3VtZW50LmpzJztcbmltcG9ydCB7IEV4dEhvc3ROb3RlYm9va0VkaXRvciB9IGZyb20gJy4vZXh0SG9zdE5vdGVib29rRWRpdG9yLmpzJztcbmltcG9ydCB7IElFeHRIb3N0Q29uc3VtZXJGaWxlU3lzdGVtIH0gZnJvbSAnLi9leHRIb3N0RmlsZVN5c3RlbUNvbnN1bWVyLmpzJztcbmltcG9ydCB7IGZpbHRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgSUZpbGVRdWVyeSwgSVRleHRRdWVyeSwgUXVlcnlUeXBlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvc2VhcmNoL2NvbW1vbi9zZWFyY2guanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RTZWFyY2ggfSBmcm9tICcuL2V4dEhvc3RTZWFyY2guanMnO1xuaW1wb3J0IHsgQ2VsbFNlYXJjaE1vZGVsIH0gZnJvbSAnLi4vLi4vY29udHJpYi9zZWFyY2gvY29tbW9uL2NlbGxTZWFyY2hNb2RlbC5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tDZWxsTWF0Y2hOb01vZGVsLCBJTm90ZWJvb2tGaWxlTWF0Y2hOb01vZGVsLCBJUmF3Q2xvc2VkTm90ZWJvb2tGaWxlTWF0Y2gsIGdlbmVyaWNDZWxsTWF0Y2hlc1RvVGV4dFNlYXJjaE1hdGNoZXMgfSBmcm9tICcuLi8uLi9jb250cmliL3NlYXJjaC9jb21tb24vc2VhcmNoTm90ZWJvb2tIZWxwZXJzLmpzJztcbmltcG9ydCB7IE5vdGVib29rUHJpb3JpdHlJbmZvIH0gZnJvbSAnLi4vLi4vY29udHJpYi9zZWFyY2gvY29tbW9uL3NlYXJjaC5qcyc7XG5pbXBvcnQgeyBnbG9iTWF0Y2hlc1Jlc291cmNlLCBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclJlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcblxuZXhwb3J0IGNsYXNzIEV4dEhvc3ROb3RlYm9va0NvbnRyb2xsZXIgaW1wbGVtZW50cyBFeHRIb3N0Tm90ZWJvb2tTaGFwZSB7XG5cdHByaXZhdGUgc3RhdGljIF9ub3RlYm9va1N0YXR1c0Jhckl0ZW1Qcm92aWRlckhhbmRsZVBvb2w6IG51bWJlciA9IDA7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tQcm94eTogTWFpblRocmVhZE5vdGVib29rU2hhcGU7XG5cdHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rRG9jdW1lbnRzUHJveHk6IE1haW5UaHJlYWROb3RlYm9va0RvY3VtZW50c1NoYXBlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9ub3RlYm9va0VkaXRvcnNQcm94eTogTWFpblRocmVhZE5vdGVib29rRWRpdG9yc1NoYXBlO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rU3RhdHVzQmFySXRlbVByb3ZpZGVycyA9IG5ldyBNYXA8bnVtYmVyLCB2c2NvZGUuTm90ZWJvb2tDZWxsU3RhdHVzQmFySXRlbVByb3ZpZGVyPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kb2N1bWVudHMgPSBuZXcgUmVzb3VyY2VNYXA8RXh0SG9zdE5vdGVib29rRG9jdW1lbnQ+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcnMgPSBuZXcgTWFwPHN0cmluZywgRXh0SG9zdE5vdGVib29rRWRpdG9yPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kc0NvbnZlcnRlcjogQ29tbWFuZHNDb252ZXJ0ZXI7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VBY3RpdmVOb3RlYm9va0VkaXRvciA9IG5ldyBFbWl0dGVyPHZzY29kZS5Ob3RlYm9va0VkaXRvciB8IHVuZGVmaW5lZD4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VBY3RpdmVOb3RlYm9va0VkaXRvciA9IHRoaXMuX29uRGlkQ2hhbmdlQWN0aXZlTm90ZWJvb2tFZGl0b3IuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfYWN0aXZlTm90ZWJvb2tFZGl0b3I6IEV4dEhvc3ROb3RlYm9va0VkaXRvciB8IHVuZGVmaW5lZDtcblx0Z2V0IGFjdGl2ZU5vdGVib29rRWRpdG9yKCk6IHZzY29kZS5Ob3RlYm9va0VkaXRvciB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2FjdGl2ZU5vdGVib29rRWRpdG9yPy5hcGlFZGl0b3I7XG5cdH1cblx0cHJpdmF0ZSBfdmlzaWJsZU5vdGVib29rRWRpdG9yczogRXh0SG9zdE5vdGVib29rRWRpdG9yW10gPSBbXTtcblx0Z2V0IHZpc2libGVOb3RlYm9va0VkaXRvcnMoKTogdnNjb2RlLk5vdGVib29rRWRpdG9yW10ge1xuXHRcdHJldHVybiB0aGlzLl92aXNpYmxlTm90ZWJvb2tFZGl0b3JzLm1hcChlZGl0b3IgPT4gZWRpdG9yLmFwaUVkaXRvcik7XG5cdH1cblxuXHRwcml2YXRlIF9vbkRpZE9wZW5Ob3RlYm9va0RvY3VtZW50ID0gbmV3IEVtaXR0ZXI8dnNjb2RlLk5vdGVib29rRG9jdW1lbnQ+KCk7XG5cdG9uRGlkT3Blbk5vdGVib29rRG9jdW1lbnQ6IEV2ZW50PHZzY29kZS5Ob3RlYm9va0RvY3VtZW50PiA9IHRoaXMuX29uRGlkT3Blbk5vdGVib29rRG9jdW1lbnQuZXZlbnQ7XG5cdHByaXZhdGUgX29uRGlkQ2xvc2VOb3RlYm9va0RvY3VtZW50ID0gbmV3IEVtaXR0ZXI8dnNjb2RlLk5vdGVib29rRG9jdW1lbnQ+KCk7XG5cdG9uRGlkQ2xvc2VOb3RlYm9va0RvY3VtZW50OiBFdmVudDx2c2NvZGUuTm90ZWJvb2tEb2N1bWVudD4gPSB0aGlzLl9vbkRpZENsb3NlTm90ZWJvb2tEb2N1bWVudC5ldmVudDtcblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZVZpc2libGVOb3RlYm9va0VkaXRvcnMgPSBuZXcgRW1pdHRlcjx2c2NvZGUuTm90ZWJvb2tFZGl0b3JbXT4oKTtcblx0b25EaWRDaGFuZ2VWaXNpYmxlTm90ZWJvb2tFZGl0b3JzID0gdGhpcy5fb25EaWRDaGFuZ2VWaXNpYmxlTm90ZWJvb2tFZGl0b3JzLmV2ZW50O1xuXG5cdHByaXZhdGUgX3N0YXR1c0JhckNhY2hlID0gbmV3IENhY2hlPElEaXNwb3NhYmxlPignTm90ZWJvb2tDZWxsU3RhdHVzQmFyQ2FjaGUnKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRtYWluQ29udGV4dDogSU1haW5Db250ZXh0LFxuXHRcdGNvbW1hbmRzOiBFeHRIb3N0Q29tbWFuZHMsXG5cdFx0cHJpdmF0ZSBfdGV4dERvY3VtZW50c0FuZEVkaXRvcnM6IEV4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzLFxuXHRcdHByaXZhdGUgX3RleHREb2N1bWVudHM6IEV4dEhvc3REb2N1bWVudHMsXG5cdFx0cHJpdmF0ZSBfZXh0SG9zdEZpbGVTeXN0ZW06IElFeHRIb3N0Q29uc3VtZXJGaWxlU3lzdGVtLFxuXHRcdHByaXZhdGUgX2V4dEhvc3RTZWFyY2g6IElFeHRIb3N0U2VhcmNoLFxuXHRcdHByaXZhdGUgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuX25vdGVib29rUHJveHkgPSBtYWluQ29udGV4dC5nZXRQcm94eShNYWluQ29udGV4dC5NYWluVGhyZWFkTm90ZWJvb2spO1xuXHRcdHRoaXMuX25vdGVib29rRG9jdW1lbnRzUHJveHkgPSBtYWluQ29udGV4dC5nZXRQcm94eShNYWluQ29udGV4dC5NYWluVGhyZWFkTm90ZWJvb2tEb2N1bWVudHMpO1xuXHRcdHRoaXMuX25vdGVib29rRWRpdG9yc1Byb3h5ID0gbWFpbkNvbnRleHQuZ2V0UHJveHkoTWFpbkNvbnRleHQuTWFpblRocmVhZE5vdGVib29rRWRpdG9ycyk7XG5cdFx0dGhpcy5fY29tbWFuZHNDb252ZXJ0ZXIgPSBjb21tYW5kcy5jb252ZXJ0ZXI7XG5cblx0XHRjb21tYW5kcy5yZWdpc3RlckFyZ3VtZW50UHJvY2Vzc29yKHtcblx0XHRcdC8vIFNlcmlhbGl6ZWQgSU5vdGVib29rQ2VsbEFjdGlvbkNvbnRleHRcblx0XHRcdHByb2Nlc3NBcmd1bWVudDogKGFyZykgPT4ge1xuXHRcdFx0XHRpZiAoYXJnICYmIGFyZy4kbWlkID09PSBNYXJzaGFsbGVkSWQuTm90ZWJvb2tDZWxsQWN0aW9uQ29udGV4dCkge1xuXHRcdFx0XHRcdGNvbnN0IG5vdGVib29rVXJpID0gYXJnLm5vdGVib29rRWRpdG9yPy5ub3RlYm9va1VyaTtcblx0XHRcdFx0XHRjb25zdCBjZWxsSGFuZGxlID0gYXJnLmNlbGwuaGFuZGxlO1xuXG5cdFx0XHRcdFx0Y29uc3QgZGF0YSA9IHRoaXMuX2RvY3VtZW50cy5nZXQobm90ZWJvb2tVcmkpO1xuXHRcdFx0XHRcdGNvbnN0IGNlbGwgPSBkYXRhPy5nZXRDZWxsKGNlbGxIYW5kbGUpO1xuXHRcdFx0XHRcdGlmIChjZWxsKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gY2VsbC5hcGlDZWxsO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoYXJnICYmIGFyZy4kbWlkID09PSBNYXJzaGFsbGVkSWQuTm90ZWJvb2tBY3Rpb25Db250ZXh0KSB7XG5cdFx0XHRcdFx0Y29uc3Qgbm90ZWJvb2tVcmkgPSBhcmcudXJpO1xuXHRcdFx0XHRcdGNvbnN0IGRhdGEgPSB0aGlzLl9kb2N1bWVudHMuZ2V0KG5vdGVib29rVXJpKTtcblx0XHRcdFx0XHRpZiAoZGF0YSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIGRhdGEuYXBpTm90ZWJvb2s7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBhcmc7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRFeHRIb3N0Tm90ZWJvb2tDb250cm9sbGVyLl9yZWdpc3RlckFwaUNvbW1hbmRzKGNvbW1hbmRzKTtcblx0fVxuXG5cdGdldEVkaXRvckJ5SWQoZWRpdG9ySWQ6IHN0cmluZyk6IEV4dEhvc3ROb3RlYm9va0VkaXRvciB7XG5cdFx0Y29uc3QgZWRpdG9yID0gdGhpcy5fZWRpdG9ycy5nZXQoZWRpdG9ySWQpO1xuXHRcdGlmICghZWRpdG9yKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYHVua25vd24gdGV4dCBlZGl0b3I6ICR7ZWRpdG9ySWR9LiBrbm93biBlZGl0b3JzOiAke1suLi50aGlzLl9lZGl0b3JzLmtleXMoKV19IGApO1xuXHRcdH1cblx0XHRyZXR1cm4gZWRpdG9yO1xuXHR9XG5cblx0Z2V0SWRCeUVkaXRvcihlZGl0b3I6IHZzY29kZS5Ob3RlYm9va0VkaXRvcik6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0Zm9yIChjb25zdCBbaWQsIGNhbmRpZGF0ZV0gb2YgdGhpcy5fZWRpdG9ycykge1xuXHRcdFx0aWYgKGNhbmRpZGF0ZS5hcGlFZGl0b3IgPT09IGVkaXRvcikge1xuXHRcdFx0XHRyZXR1cm4gaWQ7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRnZXQgbm90ZWJvb2tEb2N1bWVudHMoKSB7XG5cdFx0cmV0dXJuIFsuLi50aGlzLl9kb2N1bWVudHMudmFsdWVzKCldO1xuXHR9XG5cblx0Z2V0Tm90ZWJvb2tEb2N1bWVudCh1cmk6IFVSSSwgcmVsYXhlZDogdHJ1ZSk6IEV4dEhvc3ROb3RlYm9va0RvY3VtZW50IHwgdW5kZWZpbmVkO1xuXHRnZXROb3RlYm9va0RvY3VtZW50KHVyaTogVVJJKTogRXh0SG9zdE5vdGVib29rRG9jdW1lbnQ7XG5cdGdldE5vdGVib29rRG9jdW1lbnQodXJpOiBVUkksIHJlbGF4ZWQ/OiB0cnVlKTogRXh0SG9zdE5vdGVib29rRG9jdW1lbnQgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMuX2RvY3VtZW50cy5nZXQodXJpKTtcblx0XHRpZiAoIXJlc3VsdCAmJiAhcmVsYXhlZCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBOTyBub3RlYm9vayBkb2N1bWVudCBmb3IgJyR7dXJpfSdgKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9jb252ZXJ0Tm90ZWJvb2tSZWdpc3RyYXRpb25EYXRhKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCByZWdpc3RyYXRpb246IHZzY29kZS5Ob3RlYm9va1JlZ2lzdHJhdGlvbkRhdGEgfCB1bmRlZmluZWQpOiBJTm90ZWJvb2tDb250cmlidXRpb25EYXRhIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXJlZ2lzdHJhdGlvbikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRjb25zdCB2aWV3T3B0aW9uc0ZpbGVuYW1lUGF0dGVybiA9IHJlZ2lzdHJhdGlvbi5maWxlbmFtZVBhdHRlcm5cblx0XHRcdC5tYXAocGF0dGVybiA9PiB0eXBlQ29udmVydGVycy5Ob3RlYm9va0V4Y2x1c2l2ZURvY3VtZW50UGF0dGVybi5mcm9tKHBhdHRlcm4pKVxuXHRcdFx0LmZpbHRlcihwYXR0ZXJuID0+IHBhdHRlcm4gIT09IHVuZGVmaW5lZCkgYXMgKHN0cmluZyB8IElSZWxhdGl2ZVBhdHRlcm4gfCBJTm90ZWJvb2tFeGNsdXNpdmVEb2N1bWVudEZpbHRlcilbXTtcblx0XHRpZiAocmVnaXN0cmF0aW9uLmZpbGVuYW1lUGF0dGVybiAmJiAhdmlld09wdGlvbnNGaWxlbmFtZVBhdHRlcm4pIHtcblx0XHRcdGNvbnNvbGUud2FybihgTm90ZWJvb2sgY29udGVudCBwcm92aWRlciB2aWV3IG9wdGlvbnMgZmlsZSBuYW1lIHBhdHRlcm4gaXMgaW52YWxpZCAke3JlZ2lzdHJhdGlvbi5maWxlbmFtZVBhdHRlcm59YCk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZXh0ZW5zaW9uOiBleHRlbnNpb24uaWRlbnRpZmllcixcblx0XHRcdHByb3ZpZGVyRGlzcGxheU5hbWU6IGV4dGVuc2lvbi5kaXNwbGF5TmFtZSB8fCBleHRlbnNpb24ubmFtZSxcblx0XHRcdGRpc3BsYXlOYW1lOiByZWdpc3RyYXRpb24uZGlzcGxheU5hbWUsXG5cdFx0XHRmaWxlbmFtZVBhdHRlcm46IHZpZXdPcHRpb25zRmlsZW5hbWVQYXR0ZXJuLFxuXHRcdFx0cHJpb3JpdHk6IHJlZ2lzdHJhdGlvbi5leGNsdXNpdmUgPyBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkuZXhjbHVzaXZlIDogdW5kZWZpbmVkXG5cdFx0fTtcblx0fVxuXG5cdHJlZ2lzdGVyTm90ZWJvb2tDZWxsU3RhdHVzQmFySXRlbVByb3ZpZGVyKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBub3RlYm9va1R5cGU6IHN0cmluZywgcHJvdmlkZXI6IHZzY29kZS5Ob3RlYm9va0NlbGxTdGF0dXNCYXJJdGVtUHJvdmlkZXIpIHtcblxuXHRcdGNvbnN0IGhhbmRsZSA9IEV4dEhvc3ROb3RlYm9va0NvbnRyb2xsZXIuX25vdGVib29rU3RhdHVzQmFySXRlbVByb3ZpZGVySGFuZGxlUG9vbCsrO1xuXHRcdGNvbnN0IGV2ZW50SGFuZGxlID0gdHlwZW9mIHByb3ZpZGVyLm9uRGlkQ2hhbmdlQ2VsbFN0YXR1c0Jhckl0ZW1zID09PSAnZnVuY3Rpb24nID8gRXh0SG9zdE5vdGVib29rQ29udHJvbGxlci5fbm90ZWJvb2tTdGF0dXNCYXJJdGVtUHJvdmlkZXJIYW5kbGVQb29sKysgOiB1bmRlZmluZWQ7XG5cblx0XHR0aGlzLl9ub3RlYm9va1N0YXR1c0Jhckl0ZW1Qcm92aWRlcnMuc2V0KGhhbmRsZSwgcHJvdmlkZXIpO1xuXHRcdHRoaXMuX25vdGVib29rUHJveHkuJHJlZ2lzdGVyTm90ZWJvb2tDZWxsU3RhdHVzQmFySXRlbVByb3ZpZGVyKGhhbmRsZSwgZXZlbnRIYW5kbGUsIG5vdGVib29rVHlwZSk7XG5cblx0XHRsZXQgc3Vic2NyaXB0aW9uOiB2c2NvZGUuRGlzcG9zYWJsZSB8IHVuZGVmaW5lZDtcblx0XHRpZiAoZXZlbnRIYW5kbGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0c3Vic2NyaXB0aW9uID0gcHJvdmlkZXIub25EaWRDaGFuZ2VDZWxsU3RhdHVzQmFySXRlbXMhKF8gPT4gdGhpcy5fbm90ZWJvb2tQcm94eS4kZW1pdENlbGxTdGF0dXNCYXJFdmVudChldmVudEhhbmRsZSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgZXh0SG9zdFR5cGVzLkRpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0dGhpcy5fbm90ZWJvb2tTdGF0dXNCYXJJdGVtUHJvdmlkZXJzLmRlbGV0ZShoYW5kbGUpO1xuXHRcdFx0dGhpcy5fbm90ZWJvb2tQcm94eS4kdW5yZWdpc3Rlck5vdGVib29rQ2VsbFN0YXR1c0Jhckl0ZW1Qcm92aWRlcihoYW5kbGUsIGV2ZW50SGFuZGxlKTtcblx0XHRcdHN1YnNjcmlwdGlvbj8uZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgY3JlYXRlTm90ZWJvb2tEb2N1bWVudChvcHRpb25zOiB7IHZpZXdUeXBlOiBzdHJpbmc7IGNvbnRlbnQ/OiB2c2NvZGUuTm90ZWJvb2tEYXRhIH0pOiBQcm9taXNlPFVSST4ge1xuXHRcdGNvbnN0IGNhbm9uaWNhbFVyaSA9IGF3YWl0IHRoaXMuX25vdGVib29rRG9jdW1lbnRzUHJveHkuJHRyeUNyZWF0ZU5vdGVib29rKHtcblx0XHRcdHZpZXdUeXBlOiBvcHRpb25zLnZpZXdUeXBlLFxuXHRcdFx0Y29udGVudDogb3B0aW9ucy5jb250ZW50ICYmIHR5cGVDb252ZXJ0ZXJzLk5vdGVib29rRGF0YS5mcm9tKG9wdGlvbnMuY29udGVudClcblx0XHR9KTtcblx0XHRyZXR1cm4gVVJJLnJldml2ZShjYW5vbmljYWxVcmkpO1xuXHR9XG5cblx0YXN5bmMgb3Blbk5vdGVib29rRG9jdW1lbnQodXJpOiBVUkkpOiBQcm9taXNlPHZzY29kZS5Ob3RlYm9va0RvY3VtZW50PiB7XG5cdFx0Y29uc3QgY2FjaGVkID0gdGhpcy5fZG9jdW1lbnRzLmdldCh1cmkpO1xuXHRcdGlmIChjYWNoZWQpIHtcblx0XHRcdHJldHVybiBjYWNoZWQuYXBpTm90ZWJvb2s7XG5cdFx0fVxuXHRcdGNvbnN0IGNhbm9uaWNhbFVyaSA9IGF3YWl0IHRoaXMuX25vdGVib29rRG9jdW1lbnRzUHJveHkuJHRyeU9wZW5Ob3RlYm9vayh1cmkpO1xuXHRcdGNvbnN0IGRvY3VtZW50ID0gdGhpcy5fZG9jdW1lbnRzLmdldChVUkkucmV2aXZlKGNhbm9uaWNhbFVyaSkpO1xuXHRcdHJldHVybiBhc3NlcnRJc0RlZmluZWQoZG9jdW1lbnQ/LmFwaU5vdGVib29rKTtcblx0fVxuXG5cdGFzeW5jIHNob3dOb3RlYm9va0RvY3VtZW50KG5vdGVib29rOiB2c2NvZGUuTm90ZWJvb2tEb2N1bWVudCwgb3B0aW9ucz86IHZzY29kZS5Ob3RlYm9va0RvY3VtZW50U2hvd09wdGlvbnMpOiBQcm9taXNlPHZzY29kZS5Ob3RlYm9va0VkaXRvcj4ge1xuXHRcdGxldCByZXNvbHZlZE9wdGlvbnM6IElOb3RlYm9va0RvY3VtZW50U2hvd09wdGlvbnM7XG5cdFx0aWYgKHR5cGVvZiBvcHRpb25zID09PSAnb2JqZWN0Jykge1xuXHRcdFx0cmVzb2x2ZWRPcHRpb25zID0ge1xuXHRcdFx0XHRwb3NpdGlvbjogdHlwZUNvbnZlcnRlcnMuVmlld0NvbHVtbi5mcm9tKG9wdGlvbnMudmlld0NvbHVtbiksXG5cdFx0XHRcdHByZXNlcnZlRm9jdXM6IG9wdGlvbnMucHJlc2VydmVGb2N1cyxcblx0XHRcdFx0c2VsZWN0aW9uczogb3B0aW9ucy5zZWxlY3Rpb25zICYmIG9wdGlvbnMuc2VsZWN0aW9ucy5tYXAodHlwZUNvbnZlcnRlcnMuTm90ZWJvb2tSYW5nZS5mcm9tKSxcblx0XHRcdFx0cGlubmVkOiB0eXBlb2Ygb3B0aW9ucy5wcmV2aWV3ID09PSAnYm9vbGVhbicgPyAhb3B0aW9ucy5wcmV2aWV3IDogdW5kZWZpbmVkLFxuXHRcdFx0XHRsYWJlbDogdHlwZW9mIG9wdGlvbnMuYXNSZXBsID09PSAnc3RyaW5nJyA/XG5cdFx0XHRcdFx0b3B0aW9ucy5hc1JlcGwgOlxuXHRcdFx0XHRcdHR5cGVvZiBvcHRpb25zLmFzUmVwbCA9PT0gJ29iamVjdCcgP1xuXHRcdFx0XHRcdFx0b3B0aW9ucy5hc1JlcGwubGFiZWwgOlxuXHRcdFx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0fTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzb2x2ZWRPcHRpb25zID0ge1xuXHRcdFx0XHRwcmVzZXJ2ZUZvY3VzOiBmYWxzZSxcblx0XHRcdFx0cGlubmVkOiB0cnVlXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGNvbnN0IHZpZXdUeXBlID0gISFvcHRpb25zPy5hc1JlcGwgPyAncmVwbCcgOiBub3RlYm9vay5ub3RlYm9va1R5cGU7XG5cdFx0Y29uc3QgZWRpdG9ySWQgPSBhd2FpdCB0aGlzLl9ub3RlYm9va0VkaXRvcnNQcm94eS4kdHJ5U2hvd05vdGVib29rRG9jdW1lbnQobm90ZWJvb2sudXJpLCB2aWV3VHlwZSwgcmVzb2x2ZWRPcHRpb25zKTtcblx0XHRjb25zdCBlZGl0b3IgPSBlZGl0b3JJZCAmJiB0aGlzLl9lZGl0b3JzLmdldChlZGl0b3JJZCk/LmFwaUVkaXRvcjtcblxuXHRcdGlmIChlZGl0b3IpIHtcblx0XHRcdHJldHVybiBlZGl0b3I7XG5cdFx0fVxuXG5cdFx0aWYgKGVkaXRvcklkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYENvdWxkIE5PVCBvcGVuIGVkaXRvciBmb3IgXCIke25vdGVib29rLnVyaS50b1N0cmluZygpfVwiIGJlY2F1c2UgYW5vdGhlciBlZGl0b3Igb3BlbmVkIGluIHRoZSBtZWFudGltZS5gKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBDb3VsZCBOT1Qgb3BlbiBlZGl0b3IgZm9yIFwiJHtub3RlYm9vay51cmkudG9TdHJpbmcoKX1cIi5gKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyAkcHJvdmlkZU5vdGVib29rQ2VsbFN0YXR1c0Jhckl0ZW1zKGhhbmRsZTogbnVtYmVyLCB1cmk6IFVyaUNvbXBvbmVudHMsIGluZGV4OiBudW1iZXIsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SU5vdGVib29rQ2VsbFN0YXR1c0Jhckxpc3REdG8gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBwcm92aWRlciA9IHRoaXMuX25vdGVib29rU3RhdHVzQmFySXRlbVByb3ZpZGVycy5nZXQoaGFuZGxlKTtcblx0XHRjb25zdCByZXZpdmVkVXJpID0gVVJJLnJldml2ZSh1cmkpO1xuXHRcdGNvbnN0IGRvY3VtZW50ID0gdGhpcy5fZG9jdW1lbnRzLmdldChyZXZpdmVkVXJpKTtcblx0XHRpZiAoIWRvY3VtZW50IHx8ICFwcm92aWRlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNlbGwgPSBkb2N1bWVudC5nZXRDZWxsRnJvbUluZGV4KGluZGV4KTtcblx0XHRpZiAoIWNlbGwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlQ2VsbFN0YXR1c0Jhckl0ZW1zKGNlbGwuYXBpQ2VsbCwgdG9rZW4pO1xuXHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGNhY2hlSWQgPSB0aGlzLl9zdGF0dXNCYXJDYWNoZS5hZGQoW2Rpc3Bvc2FibGVzXSk7XG5cdFx0Y29uc3QgcmVzdWx0QXJyID0gQXJyYXkuaXNBcnJheShyZXN1bHQpID8gcmVzdWx0IDogW3Jlc3VsdF07XG5cdFx0Y29uc3QgaXRlbXMgPSByZXN1bHRBcnIubWFwKGl0ZW0gPT4gdHlwZUNvbnZlcnRlcnMuTm90ZWJvb2tTdGF0dXNCYXJJdGVtLmZyb20oaXRlbSwgdGhpcy5fY29tbWFuZHNDb252ZXJ0ZXIsIGRpc3Bvc2FibGVzKSk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGNhY2hlSWQsXG5cdFx0XHRpdGVtc1xuXHRcdH07XG5cdH1cblxuXHQkcmVsZWFzZU5vdGVib29rQ2VsbFN0YXR1c0Jhckl0ZW1zKGNhY2hlSWQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX3N0YXR1c0JhckNhY2hlLmRlbGV0ZShjYWNoZUlkKTtcblx0fVxuXG5cdC8vIC0tLSBzZXJpYWxpemUvZGVzZXJpYWxpemVcblxuXHRwcml2YXRlIF9oYW5kbGVQb29sID0gMDtcblx0cHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tTZXJpYWxpemVyID0gbmV3IE1hcDxudW1iZXIsIHsgdmlld1R5cGU6IHN0cmluZzsgc2VyaWFsaXplcjogdnNjb2RlLk5vdGVib29rU2VyaWFsaXplcjsgb3B0aW9uczogdnNjb2RlLk5vdGVib29rRG9jdW1lbnRDb250ZW50T3B0aW9ucyB8IHVuZGVmaW5lZCB9PigpO1xuXG5cdHJlZ2lzdGVyTm90ZWJvb2tTZXJpYWxpemVyKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCB2aWV3VHlwZTogc3RyaW5nLCBzZXJpYWxpemVyOiB2c2NvZGUuTm90ZWJvb2tTZXJpYWxpemVyLCBvcHRpb25zPzogdnNjb2RlLk5vdGVib29rRG9jdW1lbnRDb250ZW50T3B0aW9ucywgcmVnaXN0cmF0aW9uPzogdnNjb2RlLk5vdGVib29rUmVnaXN0cmF0aW9uRGF0YSk6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRpZiAoaXNGYWxzeU9yV2hpdGVzcGFjZSh2aWV3VHlwZSkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgdmlld1R5cGUgY2Fubm90IGJlIGVtcHR5IG9yIGp1c3Qgd2hpdGVzcGFjZWApO1xuXHRcdH1cblx0XHRjb25zdCBoYW5kbGUgPSB0aGlzLl9oYW5kbGVQb29sKys7XG5cdFx0dGhpcy5fbm90ZWJvb2tTZXJpYWxpemVyLnNldChoYW5kbGUsIHsgdmlld1R5cGUsIHNlcmlhbGl6ZXIsIG9wdGlvbnMgfSk7XG5cdFx0dGhpcy5fbm90ZWJvb2tQcm94eS4kcmVnaXN0ZXJOb3RlYm9va1NlcmlhbGl6ZXIoXG5cdFx0XHRoYW5kbGUsXG5cdFx0XHR7IGlkOiBleHRlbnNpb24uaWRlbnRpZmllciwgbG9jYXRpb246IGV4dGVuc2lvbi5leHRlbnNpb25Mb2NhdGlvbiB9LFxuXHRcdFx0dmlld1R5cGUsXG5cdFx0XHR0eXBlQ29udmVydGVycy5Ob3RlYm9va0RvY3VtZW50Q29udGVudE9wdGlvbnMuZnJvbShvcHRpb25zKSxcblx0XHRcdEV4dEhvc3ROb3RlYm9va0NvbnRyb2xsZXIuX2NvbnZlcnROb3RlYm9va1JlZ2lzdHJhdGlvbkRhdGEoZXh0ZW5zaW9uLCByZWdpc3RyYXRpb24pXG5cdFx0KTtcblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMuX25vdGVib29rUHJveHkuJHVucmVnaXN0ZXJOb3RlYm9va1NlcmlhbGl6ZXIoaGFuZGxlKTtcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jICRkYXRhVG9Ob3RlYm9vayhoYW5kbGU6IG51bWJlciwgYnl0ZXM6IFZTQnVmZmVyLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzPE5vdGVib29rRGF0YUR0bz4+IHtcblx0XHRjb25zdCBzZXJpYWxpemVyID0gdGhpcy5fbm90ZWJvb2tTZXJpYWxpemVyLmdldChoYW5kbGUpO1xuXHRcdGlmICghc2VyaWFsaXplcikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdOTyBzZXJpYWxpemVyIGZvdW5kJyk7XG5cdFx0fVxuXHRcdGNvbnN0IGRhdGEgPSBhd2FpdCBzZXJpYWxpemVyLnNlcmlhbGl6ZXIuZGVzZXJpYWxpemVOb3RlYm9vayhieXRlcy5idWZmZXIsIHRva2VuKTtcblx0XHRyZXR1cm4gbmV3IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzKHR5cGVDb252ZXJ0ZXJzLk5vdGVib29rRGF0YS5mcm9tKGRhdGEpKTtcblx0fVxuXG5cdGFzeW5jICRub3RlYm9va1RvRGF0YShoYW5kbGU6IG51bWJlciwgZGF0YTogU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnM8Tm90ZWJvb2tEYXRhRHRvPiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxWU0J1ZmZlcj4ge1xuXHRcdGNvbnN0IHNlcmlhbGl6ZXIgPSB0aGlzLl9ub3RlYm9va1NlcmlhbGl6ZXIuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKCFzZXJpYWxpemVyKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ05PIHNlcmlhbGl6ZXIgZm91bmQnKTtcblx0XHR9XG5cdFx0Y29uc3QgYnl0ZXMgPSBhd2FpdCBzZXJpYWxpemVyLnNlcmlhbGl6ZXIuc2VyaWFsaXplTm90ZWJvb2sodHlwZUNvbnZlcnRlcnMuTm90ZWJvb2tEYXRhLnRvKGRhdGEudmFsdWUpLCB0b2tlbik7XG5cdFx0cmV0dXJuIFZTQnVmZmVyLndyYXAoYnl0ZXMpO1xuXHR9XG5cblx0YXN5bmMgJHNhdmVOb3RlYm9vayhoYW5kbGU6IG51bWJlciwgdXJpQ29tcG9uZW50czogVXJpQ29tcG9uZW50cywgdmVyc2lvbklkOiBudW1iZXIsIG9wdGlvbnM6IGZpbGVzLklXcml0ZUZpbGVPcHRpb25zLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElOb3RlYm9va1BhcnRpYWxGaWxlU3RhdHNXaXRoTWV0YWRhdGE+IHtcblx0XHRjb25zdCB1cmkgPSBVUkkucmV2aXZlKHVyaUNvbXBvbmVudHMpO1xuXHRcdGNvbnN0IHNlcmlhbGl6ZXIgPSB0aGlzLl9ub3RlYm9va1NlcmlhbGl6ZXIuZ2V0KGhhbmRsZSk7XG5cdFx0dGhpcy50cmFjZShgZW50ZXIgc2F2ZU5vdGVib29rKHZlcnNpb25JZDogJHt2ZXJzaW9uSWR9LCAke3VyaS50b1N0cmluZygpfSlgKTtcblxuXHRcdGlmICghc2VyaWFsaXplcikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdOTyBzZXJpYWxpemVyIGZvdW5kJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZG9jdW1lbnQgPSB0aGlzLl9kb2N1bWVudHMuZ2V0KHVyaSk7XG5cdFx0aWYgKCFkb2N1bWVudCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdEb2N1bWVudCBOT1QgZm91bmQnKTtcblx0XHR9XG5cblx0XHRpZiAoZG9jdW1lbnQudmVyc2lvbklkICE9PSB2ZXJzaW9uSWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignRG9jdW1lbnQgdmVyc2lvbiBtaXNtYXRjaCcpO1xuXHRcdH1cblxuXHRcdGlmICghdGhpcy5fZXh0SG9zdEZpbGVTeXN0ZW0udmFsdWUuaXNXcml0YWJsZUZpbGVTeXN0ZW0odXJpLnNjaGVtZSkpIHtcblx0XHRcdHRocm93IG5ldyBmaWxlcy5GaWxlT3BlcmF0aW9uRXJyb3IobG9jYWxpemUoJ2Vyci5yZWFkb25seScsIFwiVW5hYmxlIHRvIG1vZGlmeSByZWFkLW9ubHkgZmlsZSAnezB9J1wiLCB0aGlzLl9yZXNvdXJjZUZvckVycm9yKHVyaSkpLCBmaWxlcy5GaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfUEVSTUlTU0lPTl9ERU5JRUQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGRhdGE6IHZzY29kZS5Ob3RlYm9va0RhdGEgPSB7XG5cdFx0XHRtZXRhZGF0YTogZmlsdGVyKGRvY3VtZW50LmFwaU5vdGVib29rLm1ldGFkYXRhLCBrZXkgPT4gIShzZXJpYWxpemVyLm9wdGlvbnM/LnRyYW5zaWVudERvY3VtZW50TWV0YWRhdGEgPz8ge30pW2tleV0pLFxuXHRcdFx0Y2VsbHM6IFtdLFxuXHRcdH07XG5cblx0XHQvLyB0aGlzIGRhdGEgbXVzdCBiZSByZXRyaWV2ZWQgYmVmb3JlIGFueSBhc3luYyBjYWxscyB0byBlbnN1cmUgdGhlIGRhdGEgaXMgZm9yIHRoZSBjb3JyZWN0IHZlcnNpb25cblx0XHRmb3IgKGNvbnN0IGNlbGwgb2YgZG9jdW1lbnQuYXBpTm90ZWJvb2suZ2V0Q2VsbHMoKSkge1xuXHRcdFx0Y29uc3QgY2VsbERhdGEgPSBuZXcgZXh0SG9zdFR5cGVzLk5vdGVib29rQ2VsbERhdGEoXG5cdFx0XHRcdGNlbGwua2luZCxcblx0XHRcdFx0Y2VsbC5kb2N1bWVudC5nZXRUZXh0KCksXG5cdFx0XHRcdGNlbGwuZG9jdW1lbnQubGFuZ3VhZ2VJZCxcblx0XHRcdFx0Y2VsbC5taW1lLFxuXHRcdFx0XHQhKHNlcmlhbGl6ZXIub3B0aW9ucz8udHJhbnNpZW50T3V0cHV0cykgPyBbLi4uY2VsbC5vdXRwdXRzXSA6IFtdLFxuXHRcdFx0XHRjZWxsLm1ldGFkYXRhLFxuXHRcdFx0XHRjZWxsLmV4ZWN1dGlvblN1bW1hcnlcblx0XHRcdCk7XG5cblx0XHRcdGNlbGxEYXRhLm1ldGFkYXRhID0gZmlsdGVyKGNlbGwubWV0YWRhdGEsIGtleSA9PiAhKHNlcmlhbGl6ZXIub3B0aW9ucz8udHJhbnNpZW50Q2VsbE1ldGFkYXRhID8/IHt9KVtrZXldKTtcblx0XHRcdGRhdGEuY2VsbHMucHVzaChjZWxsRGF0YSk7XG5cdFx0fVxuXG5cdFx0Ly8gdmFsaWRhdGUgd3JpdGVcblx0XHRhd2FpdCB0aGlzLl92YWxpZGF0ZVdyaXRlRmlsZSh1cmksIG9wdGlvbnMpO1xuXG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2NhbmNlbGVkJyk7XG5cdFx0fVxuXHRcdGNvbnN0IGJ5dGVzID0gYXdhaXQgc2VyaWFsaXplci5zZXJpYWxpemVyLnNlcmlhbGl6ZU5vdGVib29rKGRhdGEsIHRva2VuKTtcblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignY2FuY2VsZWQnKTtcblx0XHR9XG5cblx0XHQvLyBEb24ndCBhY2NlcHQgYW55IGNhbmNlbGxhdGlvbiBiZXlvbmQgdGhpcyBwb2ludCwgd2UgbmVlZCB0byByZXBvcnQgdGhlIHJlc3VsdCBvZiB0aGUgZmlsZSB3cml0ZVxuXHRcdHRoaXMudHJhY2UoYHNlcmlhbGl6ZWQgdmVyc2lvbklkOiAke3ZlcnNpb25JZH0gJHt1cmkudG9TdHJpbmcoKX1gKTtcblx0XHRhd2FpdCB0aGlzLl9leHRIb3N0RmlsZVN5c3RlbS52YWx1ZS53cml0ZUZpbGUodXJpLCBieXRlcyk7XG5cdFx0dGhpcy50cmFjZShgRmluaXNoZWQgd3JpdGUgdmVyc2lvbklkOiAke3ZlcnNpb25JZH0gJHt1cmkudG9TdHJpbmcoKX1gKTtcblx0XHRjb25zdCBwcm92aWRlckV4dFVyaSA9IHRoaXMuX2V4dEhvc3RGaWxlU3lzdGVtLmdldEZpbGVTeXN0ZW1Qcm92aWRlckV4dFVyaSh1cmkuc2NoZW1lKTtcblx0XHRjb25zdCBzdGF0ID0gYXdhaXQgdGhpcy5fZXh0SG9zdEZpbGVTeXN0ZW0udmFsdWUuc3RhdCh1cmkpO1xuXG5cdFx0Y29uc3QgZmlsZVN0YXRzID0ge1xuXHRcdFx0bmFtZTogcHJvdmlkZXJFeHRVcmkuYmFzZW5hbWUodXJpKSxcblx0XHRcdGlzRmlsZTogKHN0YXQudHlwZSAmIGZpbGVzLkZpbGVUeXBlLkZpbGUpICE9PSAwLFxuXHRcdFx0aXNEaXJlY3Rvcnk6IChzdGF0LnR5cGUgJiBmaWxlcy5GaWxlVHlwZS5EaXJlY3RvcnkpICE9PSAwLFxuXHRcdFx0aXNTeW1ib2xpY0xpbms6IChzdGF0LnR5cGUgJiBmaWxlcy5GaWxlVHlwZS5TeW1ib2xpY0xpbmspICE9PSAwLFxuXHRcdFx0bXRpbWU6IHN0YXQubXRpbWUsXG5cdFx0XHRjdGltZTogc3RhdC5jdGltZSxcblx0XHRcdHNpemU6IHN0YXQuc2l6ZSxcblx0XHRcdHJlYWRvbmx5OiBCb29sZWFuKChzdGF0LnBlcm1pc3Npb25zID8/IDApICYgZmlsZXMuRmlsZVBlcm1pc3Npb24uUmVhZG9ubHkpIHx8ICF0aGlzLl9leHRIb3N0RmlsZVN5c3RlbS52YWx1ZS5pc1dyaXRhYmxlRmlsZVN5c3RlbSh1cmkuc2NoZW1lKSxcblx0XHRcdGxvY2tlZDogQm9vbGVhbigoc3RhdC5wZXJtaXNzaW9ucyA/PyAwKSAmIGZpbGVzLkZpbGVQZXJtaXNzaW9uLkxvY2tlZCksXG5cdFx0XHRldGFnOiBmaWxlcy5ldGFnKHsgbXRpbWU6IHN0YXQubXRpbWUsIHNpemU6IHN0YXQuc2l6ZSB9KSxcblx0XHRcdGNoaWxkcmVuOiB1bmRlZmluZWRcblx0XHR9O1xuXG5cdFx0dGhpcy50cmFjZShgZXhpdCBzYXZlTm90ZWJvb2sodmVyc2lvbklkOiAke3ZlcnNpb25JZH0sICR7dXJpLnRvU3RyaW5nKCl9KWApO1xuXHRcdHJldHVybiBmaWxlU3RhdHM7XG5cdH1cblxuXHQvKipcblx0ICogU2VhcmNoIGZvciBxdWVyeSBpbiBhbGwgbm90ZWJvb2tzIHRoYXQgY2FuIGJlIGRlc2VyaWFsaXplZCBieSB0aGUgc2VyaWFsaXplciBmZXRjaGVkIGJ5IGBoYW5kbGVgLlxuXHQgKlxuXHQgKiBAcGFyYW0gaGFuZGxlIHVzZWQgdG8gZ2V0IG5vdGVib29rIHNlcmlhbGl6ZXJcblx0ICogQHBhcmFtIHRleHRRdWVyeSB0aGUgdGV4dCBxdWVyeSB0byBzZWFyY2ggdXNpbmdcblx0ICogQHBhcmFtIHZpZXdUeXBlRmlsZVRhcmdldHMgdGhlIGdsb2JzIChhbmQgYXNzb2NpYXRlZCByYW5rcykgdGhhdCBhcmUgdGFyZ2V0dGluZyBmb3Igb3BlbmluZyB0aGlzIHR5cGUgb2Ygbm90ZWJvb2tcblx0ICogQHBhcmFtIG90aGVyVmlld1R5cGVGaWxlVGFyZ2V0cyByYW5rZWQgZ2xvYnMgZm9yIG90aGVyIGVkaXRvcnMgdGhhdCB3ZSBzaG91bGQgY29uc2lkZXIgd2hlbiBkZWNpZGluZyB3aGV0aGVyIGl0IHdpbGwgb3BlbiBhcyB0aGlzIG5vdGVib29rXG5cdCAqIEBwYXJhbSB0b2tlbiBjYW5jZWxsYXRpb24gdG9rZW5cblx0ICogQHJldHVybnMgYElSYXdDbG9zZWROb3RlYm9va0ZpbGVNYXRjaGAgZm9yIGV2ZXJ5IGZpbGUuIEZpbGVzIHdpdGhvdXQgbWF0Y2hlcyB3aWxsIGp1c3QgaGF2ZSBhIGBJUmF3Q2xvc2VkTm90ZWJvb2tGaWxlTWF0Y2hgXG5cdCAqIFx0d2l0aCBubyBgY2VsbFJlc3VsdHNgLiBUaGlzIGFsbG93cyB0aGUgY2FsbGVyIHRvIGtub3cgd2hhdCB3YXMgc2VhcmNoZWQgaW4gYWxyZWFkeSwgZXZlbiBpZiBpdCBkaWQgbm90IHlpZWxkIHJlc3VsdHMuXG5cdCAqL1xuXHRhc3luYyAkc2VhcmNoSW5Ob3RlYm9va3MoaGFuZGxlOiBudW1iZXIsIHRleHRRdWVyeTogSVRleHRRdWVyeSwgdmlld1R5cGVGaWxlVGFyZ2V0czogTm90ZWJvb2tQcmlvcml0eUluZm9bXSwgb3RoZXJWaWV3VHlwZUZpbGVUYXJnZXRzOiBOb3RlYm9va1ByaW9yaXR5SW5mb1tdLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHsgcmVzdWx0czogSVJhd0Nsb3NlZE5vdGVib29rRmlsZU1hdGNoW107IGxpbWl0SGl0OiBib29sZWFuIH0+IHtcblx0XHRjb25zdCBzZXJpYWxpemVyID0gdGhpcy5fbm90ZWJvb2tTZXJpYWxpemVyLmdldChoYW5kbGUpPy5zZXJpYWxpemVyO1xuXHRcdGlmICghc2VyaWFsaXplcikge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0bGltaXRIaXQ6IGZhbHNlLFxuXHRcdFx0XHRyZXN1bHRzOiBbXVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRjb25zdCBmaW5hbE1hdGNoZWRUYXJnZXRzID0gbmV3IFJlc291cmNlU2V0KCk7XG5cblx0XHRjb25zdCBydW5GaWxlUXVlcmllcyA9IGFzeW5jIChpbmNsdWRlczogTm90ZWJvb2tQcmlvcml0eUluZm9bXSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuLCB0ZXh0UXVlcnk6IElUZXh0UXVlcnkpOiBQcm9taXNlPHZvaWQ+ID0+IHtcblx0XHRcdGF3YWl0IFByb21pc2UuYWxsKGluY2x1ZGVzLm1hcChhc3luYyBpbmNsdWRlID0+XG5cdFx0XHRcdGF3YWl0IFByb21pc2UuYWxsKGluY2x1ZGUuZmlsZW5hbWVQYXR0ZXJucy5tYXAoZmlsZVBhdHRlcm4gPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHF1ZXJ5OiBJRmlsZVF1ZXJ5ID0ge1xuXHRcdFx0XHRcdFx0X3JlYXNvbjogdGV4dFF1ZXJ5Ll9yZWFzb24sXG5cdFx0XHRcdFx0XHRmb2xkZXJRdWVyaWVzOiB0ZXh0UXVlcnkuZm9sZGVyUXVlcmllcyxcblx0XHRcdFx0XHRcdGluY2x1ZGVQYXR0ZXJuOiB0ZXh0UXVlcnkuaW5jbHVkZVBhdHRlcm4sXG5cdFx0XHRcdFx0XHRleGNsdWRlUGF0dGVybjogdGV4dFF1ZXJ5LmV4Y2x1ZGVQYXR0ZXJuLFxuXHRcdFx0XHRcdFx0bWF4UmVzdWx0czogdGV4dFF1ZXJ5Lm1heFJlc3VsdHMsXG5cdFx0XHRcdFx0XHR0eXBlOiBRdWVyeVR5cGUuRmlsZSxcblx0XHRcdFx0XHRcdGZpbGVQYXR0ZXJuXG5cdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdC8vIHVzZSBwcmlvcml0eSBpbmZvIHRvIGV4Y2x1ZGUgaW5mbyBmcm9tIG90aGVyIGdsb2JzXG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMuX2V4dEhvc3RTZWFyY2guZG9JbnRlcm5hbEZpbGVTZWFyY2hXaXRoQ3VzdG9tQ2FsbGJhY2socXVlcnksIHRva2VuLCAoZGF0YSkgPT4ge1xuXHRcdFx0XHRcdFx0ZGF0YS5mb3JFYWNoKHVyaSA9PiB7XG5cdFx0XHRcdFx0XHRcdGlmIChmaW5hbE1hdGNoZWRUYXJnZXRzLmhhcyh1cmkpKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGhhc090aGVyTWF0Y2hlcyA9IG90aGVyVmlld1R5cGVGaWxlVGFyZ2V0cy5zb21lKHRhcmdldCA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0Ly8gdXNlIHRoZSBzYW1lIHN0cmF0ZWd5IHRoYXQgdGhlIGVkaXRvciBzZXJ2aWNlIHVzZXMgdG8gb3BlbiBlZGl0b3JzXG5cdFx0XHRcdFx0XHRcdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvYmxvYi9hYzE2MzE1MjhlNjc2MzdkYTY1ZWM5OTRjNmRjMzVkNzNmNmUzM2NjL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZWRpdG9yL2Jyb3dzZXIvZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLnRzI0wzNTktTDM2NlxuXHRcdFx0XHRcdFx0XHRcdGlmIChpbmNsdWRlLmlzRnJvbVNldHRpbmdzICYmICF0YXJnZXQuaXNGcm9tU2V0dGluZ3MpIHtcblx0XHRcdFx0XHRcdFx0XHRcdC8vIGlmIHRoZSBpbmNsdWRlIGlzIGZyb20gdGhlIHNldHRpbmdzIGFuZCB0YXJnZXQgaXNuJ3QsIGV2ZW4gaWYgaXQgbWF0Y2hlcywgaXQncyBzdGlsbCBvdmVycmlkZGVuLlxuXHRcdFx0XHRcdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0XHQvLyBsb25nZXIgZmlsZVBhdHRlcm5zIGFyZSBjb25zaWRlcmVkIG1vcmUgc3BlY2lmYywgc28gdGhleSBhbHdheXMgaGF2ZSBwcmVjZWRlbmNlIHRoZSBzaG9ydGVyIHBhdHRlcm5zXG5cdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gdGFyZ2V0LmZpbGVuYW1lUGF0dGVybnMuc29tZSh0YXJnZXRGaWxlUGF0dGVybiA9PiBnbG9iTWF0Y2hlc1Jlc291cmNlKHRhcmdldEZpbGVQYXR0ZXJuLCB1cmkpKTtcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0XHRcdGlmIChoYXNPdGhlck1hdGNoZXMpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0ZmluYWxNYXRjaGVkVGFyZ2V0cy5hZGQodXJpKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pLmNhdGNoKGVyciA9PiB7XG5cdFx0XHRcdFx0XHQvLyB0ZW1wb3JhcnkgZml4IGZvciBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjA1MDQ0OiBkb24ndCBzaG93IG5vdGVib29rIHJlc3VsdHMgZm9yIHJlbW90ZWh1YiByZXBvcy5cblx0XHRcdFx0XHRcdGlmIChlcnIuY29kZSA9PT0gJ0VOT0VOVCcpIHtcblx0XHRcdFx0XHRcdFx0Y29uc29sZS53YXJuKGBDb3VsZCBub3QgZmluZCBub3RlYm9vayBzZWFyY2ggcmVzdWx0cywgaWdub3Jpbmcgbm90ZWJvb2sgcmVzdWx0cy5gKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0XHRsaW1pdEhpdDogZmFsc2UsXG5cdFx0XHRcdFx0XHRcdFx0bWVzc2FnZXM6IFtdLFxuXHRcdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0dGhyb3cgZXJyO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KSlcblx0XHRcdCkpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH07XG5cblx0XHRhd2FpdCBydW5GaWxlUXVlcmllcyh2aWV3VHlwZUZpbGVUYXJnZXRzLCB0b2tlbiwgdGV4dFF1ZXJ5KTtcblxuXHRcdGNvbnN0IHJlc3VsdHMgPSBuZXcgUmVzb3VyY2VNYXA8SU5vdGVib29rRmlsZU1hdGNoTm9Nb2RlbD4oKTtcblx0XHRsZXQgbGltaXRIaXQgPSBmYWxzZTtcblx0XHRjb25zdCBwcm9taXNlcyA9IEFycmF5LmZyb20oZmluYWxNYXRjaGVkVGFyZ2V0cykubWFwKGFzeW5jICh1cmkpID0+IHtcblx0XHRcdGNvbnN0IGNlbGxNYXRjaGVzOiBJTm90ZWJvb2tDZWxsTWF0Y2hOb01vZGVsW10gPSBbXTtcblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh0ZXh0UXVlcnkubWF4UmVzdWx0cyAmJiBbLi4ucmVzdWx0cy52YWx1ZXMoKV0ucmVkdWNlKChhY2MsIHZhbHVlKSA9PiBhY2MgKyB2YWx1ZS5jZWxsUmVzdWx0cy5sZW5ndGgsIDApID4gdGV4dFF1ZXJ5Lm1heFJlc3VsdHMpIHtcblx0XHRcdFx0XHRsaW1pdEhpdCA9IHRydWU7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3Qgc2ltcGxlQ2VsbHM6IEFycmF5PHsgaW5wdXQ6IHN0cmluZzsgb3V0cHV0czogc3RyaW5nW10gfT4gPSBbXTtcblx0XHRcdFx0Y29uc3Qgbm90ZWJvb2sgPSB0aGlzLl9kb2N1bWVudHMuZ2V0KHVyaSk7XG5cdFx0XHRcdGlmIChub3RlYm9vaykge1xuXHRcdFx0XHRcdGNvbnN0IGNlbGxzID0gbm90ZWJvb2suYXBpTm90ZWJvb2suZ2V0Q2VsbHMoKTtcblx0XHRcdFx0XHRjZWxscy5mb3JFYWNoKGUgPT4gc2ltcGxlQ2VsbHMucHVzaChcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0aW5wdXQ6IGUuZG9jdW1lbnQuZ2V0VGV4dCgpLFxuXHRcdFx0XHRcdFx0XHRvdXRwdXRzOiBlLm91dHB1dHMuZmxhdE1hcCh2YWx1ZSA9PiB2YWx1ZS5pdGVtcy5tYXAob3V0cHV0ID0+IG91dHB1dC5kYXRhLnRvU3RyaW5nKCkpKVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdCkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGZpbGVDb250ZW50ID0gYXdhaXQgdGhpcy5fZXh0SG9zdEZpbGVTeXN0ZW0udmFsdWUucmVhZEZpbGUodXJpKTtcblx0XHRcdFx0XHRjb25zdCBieXRlcyA9IFZTQnVmZmVyLmZyb21TdHJpbmcoZmlsZUNvbnRlbnQudG9TdHJpbmcoKSk7XG5cdFx0XHRcdFx0Y29uc3Qgbm90ZWJvb2sgPSBhd2FpdCBzZXJpYWxpemVyLmRlc2VyaWFsaXplTm90ZWJvb2soYnl0ZXMuYnVmZmVyLCB0b2tlbik7XG5cdFx0XHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IGRhdGEgPSB0eXBlQ29udmVydGVycy5Ob3RlYm9va0RhdGEuZnJvbShub3RlYm9vayk7XG5cblx0XHRcdFx0XHRkYXRhLmNlbGxzLmZvckVhY2goY2VsbCA9PiBzaW1wbGVDZWxscy5wdXNoKFxuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRpbnB1dDogY2VsbC5zb3VyY2UsXG5cdFx0XHRcdFx0XHRcdG91dHB1dHM6IGNlbGwub3V0cHV0cy5mbGF0TWFwKHZhbHVlID0+IHZhbHVlLml0ZW1zLm1hcChvdXRwdXQgPT4gb3V0cHV0LnZhbHVlQnl0ZXMudG9TdHJpbmcoKSkpXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0KSk7XG5cdFx0XHRcdH1cblxuXG5cdFx0XHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHNpbXBsZUNlbGxzLmZvckVhY2goKGNlbGwsIGluZGV4KSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgdGFyZ2V0ID0gdGV4dFF1ZXJ5LmNvbnRlbnRQYXR0ZXJuLnBhdHRlcm47XG5cdFx0XHRcdFx0Y29uc3QgY2VsbE1vZGVsID0gbmV3IENlbGxTZWFyY2hNb2RlbChjZWxsLmlucHV0LCB1bmRlZmluZWQsIGNlbGwub3V0cHV0cyk7XG5cblx0XHRcdFx0XHRjb25zdCBpbnB1dE1hdGNoZXMgPSBjZWxsTW9kZWwuZmluZEluSW5wdXRzKHRhcmdldCk7XG5cdFx0XHRcdFx0Y29uc3Qgb3V0cHV0TWF0Y2hlcyA9IGNlbGxNb2RlbC5maW5kSW5PdXRwdXRzKHRhcmdldCk7XG5cdFx0XHRcdFx0Y29uc3Qgd2Vidmlld1Jlc3VsdHMgPSBvdXRwdXRNYXRjaGVzXG5cdFx0XHRcdFx0XHQuZmxhdE1hcChvdXRwdXRNYXRjaCA9PlxuXHRcdFx0XHRcdFx0XHRnZW5lcmljQ2VsbE1hdGNoZXNUb1RleHRTZWFyY2hNYXRjaGVzKG91dHB1dE1hdGNoLm1hdGNoZXMsIG91dHB1dE1hdGNoLnRleHRCdWZmZXIpKVxuXHRcdFx0XHRcdFx0Lm1hcCgodGV4dE1hdGNoLCBpbmRleCkgPT4ge1xuXHRcdFx0XHRcdFx0XHR0ZXh0TWF0Y2gud2Vidmlld0luZGV4ID0gaW5kZXg7XG5cdFx0XHRcdFx0XHRcdHJldHVybiB0ZXh0TWF0Y2g7XG5cdFx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGlmIChpbnB1dE1hdGNoZXMubGVuZ3RoID4gMCB8fCBvdXRwdXRNYXRjaGVzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0XHRcdGNvbnN0IGNlbGxNYXRjaDogSU5vdGVib29rQ2VsbE1hdGNoTm9Nb2RlbCA9IHtcblx0XHRcdFx0XHRcdFx0aW5kZXg6IGluZGV4LFxuXHRcdFx0XHRcdFx0XHRjb250ZW50UmVzdWx0czogZ2VuZXJpY0NlbGxNYXRjaGVzVG9UZXh0U2VhcmNoTWF0Y2hlcyhpbnB1dE1hdGNoZXMsIGNlbGxNb2RlbC5pbnB1dFRleHRCdWZmZXIpLFxuXHRcdFx0XHRcdFx0XHR3ZWJ2aWV3UmVzdWx0c1xuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdGNlbGxNYXRjaGVzLnB1c2goY2VsbE1hdGNoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGNvbnN0IGZpbGVNYXRjaCA9IHtcblx0XHRcdFx0XHRyZXNvdXJjZTogdXJpLCBjZWxsUmVzdWx0czogY2VsbE1hdGNoZXNcblx0XHRcdFx0fTtcblx0XHRcdFx0cmVzdWx0cy5zZXQodXJpLCBmaWxlTWF0Y2gpO1xuXHRcdFx0XHRyZXR1cm47XG5cblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0fSk7XG5cblx0XHRhd2FpdCBQcm9taXNlLmFsbChwcm9taXNlcyk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGxpbWl0SGl0LFxuXHRcdFx0cmVzdWx0czogWy4uLnJlc3VsdHMudmFsdWVzKCldXG5cdFx0fTtcblx0fVxuXG5cblxuXHRwcml2YXRlIGFzeW5jIF92YWxpZGF0ZVdyaXRlRmlsZSh1cmk6IFVSSSwgb3B0aW9uczogZmlsZXMuSVdyaXRlRmlsZU9wdGlvbnMpIHtcblx0XHRjb25zdCBzdGF0ID0gYXdhaXQgdGhpcy5fZXh0SG9zdEZpbGVTeXN0ZW0udmFsdWUuc3RhdCh1cmkpO1xuXHRcdC8vIERpcnR5IHdyaXRlIHByZXZlbnRpb25cblx0XHRpZiAoXG5cdFx0XHR0eXBlb2Ygb3B0aW9ucz8ubXRpbWUgPT09ICdudW1iZXInICYmIHR5cGVvZiBvcHRpb25zLmV0YWcgPT09ICdzdHJpbmcnICYmIG9wdGlvbnMuZXRhZyAhPT0gZmlsZXMuRVRBR19ESVNBQkxFRCAmJlxuXHRcdFx0dHlwZW9mIHN0YXQubXRpbWUgPT09ICdudW1iZXInICYmIHR5cGVvZiBzdGF0LnNpemUgPT09ICdudW1iZXInICYmXG5cdFx0XHRvcHRpb25zLm10aW1lIDwgc3RhdC5tdGltZSAmJiBvcHRpb25zLmV0YWcgIT09IGZpbGVzLmV0YWcoeyBtdGltZTogb3B0aW9ucy5tdGltZSAvKiBub3QgdXNpbmcgc3RhdC5tdGltZSBmb3IgYSByZWFzb24sIHNlZSBhYm92ZSAqLywgc2l6ZTogc3RhdC5zaXplIH0pXG5cdFx0KSB7XG5cdFx0XHR0aHJvdyBuZXcgZmlsZXMuRmlsZU9wZXJhdGlvbkVycm9yKGxvY2FsaXplKCdmaWxlTW9kaWZpZWRFcnJvcicsIFwiRmlsZSBNb2RpZmllZCBTaW5jZVwiKSwgZmlsZXMuRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX01PRElGSUVEX1NJTkNFLCBvcHRpb25zKTtcblx0XHR9XG5cblx0XHRyZXR1cm47XG5cdH1cblxuXHRwcml2YXRlIF9yZXNvdXJjZUZvckVycm9yKHVyaTogVVJJKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdXJpLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlID8gdXJpLmZzUGF0aCA6IHVyaS50b1N0cmluZygpO1xuXHR9XG5cblx0Ly8gLS0tIG9wZW4sIHNhdmUsIHNhdmVBcywgYmFja3VwXG5cblxuXHRwcml2YXRlIF9jcmVhdGVFeHRIb3N0RWRpdG9yKGRvY3VtZW50OiBFeHRIb3N0Tm90ZWJvb2tEb2N1bWVudCwgZWRpdG9ySWQ6IHN0cmluZywgZGF0YTogSU5vdGVib29rRWRpdG9yQWRkRGF0YSkge1xuXG5cdFx0aWYgKHRoaXMuX2VkaXRvcnMuaGFzKGVkaXRvcklkKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBlZGl0b3Igd2l0aCBpZCBBTFJFQURZIEVYU0lTVDogJHtlZGl0b3JJZH1gKTtcblx0XHR9XG5cblx0XHRjb25zdCBlZGl0b3IgPSBuZXcgRXh0SG9zdE5vdGVib29rRWRpdG9yKFxuXHRcdFx0ZWRpdG9ySWQsXG5cdFx0XHR0aGlzLl9ub3RlYm9va0VkaXRvcnNQcm94eSxcblx0XHRcdGRvY3VtZW50LFxuXHRcdFx0ZGF0YS52aXNpYmxlUmFuZ2VzLm1hcCh0eXBlQ29udmVydGVycy5Ob3RlYm9va1JhbmdlLnRvKSxcblx0XHRcdGRhdGEuc2VsZWN0aW9ucy5tYXAodHlwZUNvbnZlcnRlcnMuTm90ZWJvb2tSYW5nZS50byksXG5cdFx0XHR0eXBlb2YgZGF0YS52aWV3Q29sdW1uID09PSAnbnVtYmVyJyA/IHR5cGVDb252ZXJ0ZXJzLlZpZXdDb2x1bW4udG8oZGF0YS52aWV3Q29sdW1uKSA6IHVuZGVmaW5lZCxcblx0XHRcdGRhdGEudmlld1R5cGVcblx0XHQpO1xuXG5cdFx0dGhpcy5fZWRpdG9ycy5zZXQoZWRpdG9ySWQsIGVkaXRvcik7XG5cdH1cblxuXHQkYWNjZXB0RG9jdW1lbnRBbmRFZGl0b3JzRGVsdGEoZGVsdGE6IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzPElOb3RlYm9va0RvY3VtZW50c0FuZEVkaXRvcnNEZWx0YT4pOiB2b2lkIHtcblxuXHRcdGlmIChkZWx0YS52YWx1ZS5yZW1vdmVkRG9jdW1lbnRzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IHVyaSBvZiBkZWx0YS52YWx1ZS5yZW1vdmVkRG9jdW1lbnRzKSB7XG5cdFx0XHRcdGNvbnN0IHJldml2ZWRVcmkgPSBVUkkucmV2aXZlKHVyaSk7XG5cdFx0XHRcdGNvbnN0IGRvY3VtZW50ID0gdGhpcy5fZG9jdW1lbnRzLmdldChyZXZpdmVkVXJpKTtcblxuXHRcdFx0XHRpZiAoZG9jdW1lbnQpIHtcblx0XHRcdFx0XHRkb2N1bWVudC5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0dGhpcy5fZG9jdW1lbnRzLmRlbGV0ZShyZXZpdmVkVXJpKTtcblx0XHRcdFx0XHR0aGlzLl90ZXh0RG9jdW1lbnRzQW5kRWRpdG9ycy4kYWNjZXB0RG9jdW1lbnRzQW5kRWRpdG9yc0RlbHRhKHsgcmVtb3ZlZERvY3VtZW50czogZG9jdW1lbnQuYXBpTm90ZWJvb2suZ2V0Q2VsbHMoKS5tYXAoY2VsbCA9PiBjZWxsLmRvY3VtZW50LnVyaSkgfSk7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRDbG9zZU5vdGVib29rRG9jdW1lbnQuZmlyZShkb2N1bWVudC5hcGlOb3RlYm9vayk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiB0aGlzLl9lZGl0b3JzLnZhbHVlcygpKSB7XG5cdFx0XHRcdFx0aWYgKGVkaXRvci5ub3RlYm9va0RhdGEudXJpLnRvU3RyaW5nKCkgPT09IHJldml2ZWRVcmkudG9TdHJpbmcoKSkge1xuXHRcdFx0XHRcdFx0dGhpcy5fZWRpdG9ycy5kZWxldGUoZWRpdG9yLmlkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoZGVsdGEudmFsdWUuYWRkZWREb2N1bWVudHMpIHtcblxuXHRcdFx0Y29uc3QgYWRkZWRDZWxsRG9jdW1lbnRzOiBJTW9kZWxBZGRlZERhdGFbXSA9IFtdO1xuXG5cdFx0XHRmb3IgKGNvbnN0IG1vZGVsRGF0YSBvZiBkZWx0YS52YWx1ZS5hZGRlZERvY3VtZW50cykge1xuXHRcdFx0XHRjb25zdCB1cmkgPSBVUkkucmV2aXZlKG1vZGVsRGF0YS51cmkpO1xuXG5cdFx0XHRcdGlmICh0aGlzLl9kb2N1bWVudHMuaGFzKHVyaSkpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYGFkZGluZyBFWElTVElORyBub3RlYm9vayAke3VyaX0gYCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBkb2N1bWVudCA9IG5ldyBFeHRIb3N0Tm90ZWJvb2tEb2N1bWVudChcblx0XHRcdFx0XHR0aGlzLl9ub3RlYm9va0RvY3VtZW50c1Byb3h5LFxuXHRcdFx0XHRcdHRoaXMuX3RleHREb2N1bWVudHNBbmRFZGl0b3JzLFxuXHRcdFx0XHRcdHRoaXMuX3RleHREb2N1bWVudHMsXG5cdFx0XHRcdFx0dXJpLFxuXHRcdFx0XHRcdG1vZGVsRGF0YVxuXHRcdFx0XHQpO1xuXG5cdFx0XHRcdC8vIGFkZCBjZWxsIGRvY3VtZW50IGFzIHZzY29kZS5UZXh0RG9jdW1lbnRcblx0XHRcdFx0YWRkZWRDZWxsRG9jdW1lbnRzLnB1c2goLi4ubW9kZWxEYXRhLmNlbGxzLm1hcChjZWxsID0+IEV4dEhvc3RDZWxsLmFzTW9kZWxBZGREYXRhKGNlbGwpKSk7XG5cblx0XHRcdFx0dGhpcy5fZG9jdW1lbnRzLmdldCh1cmkpPy5kaXNwb3NlKCk7XG5cdFx0XHRcdHRoaXMuX2RvY3VtZW50cy5zZXQodXJpLCBkb2N1bWVudCk7XG5cdFx0XHRcdHRoaXMuX3RleHREb2N1bWVudHNBbmRFZGl0b3JzLiRhY2NlcHREb2N1bWVudHNBbmRFZGl0b3JzRGVsdGEoeyBhZGRlZERvY3VtZW50czogYWRkZWRDZWxsRG9jdW1lbnRzIH0pO1xuXG5cdFx0XHRcdHRoaXMuX29uRGlkT3Blbk5vdGVib29rRG9jdW1lbnQuZmlyZShkb2N1bWVudC5hcGlOb3RlYm9vayk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGRlbHRhLnZhbHVlLmFkZGVkRWRpdG9ycykge1xuXHRcdFx0Zm9yIChjb25zdCBlZGl0b3JNb2RlbERhdGEgb2YgZGVsdGEudmFsdWUuYWRkZWRFZGl0b3JzKSB7XG5cdFx0XHRcdGlmICh0aGlzLl9lZGl0b3JzLmhhcyhlZGl0b3JNb2RlbERhdGEuaWQpKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgcmV2aXZlZFVyaSA9IFVSSS5yZXZpdmUoZWRpdG9yTW9kZWxEYXRhLmRvY3VtZW50VXJpKTtcblx0XHRcdFx0Y29uc3QgZG9jdW1lbnQgPSB0aGlzLl9kb2N1bWVudHMuZ2V0KHJldml2ZWRVcmkpO1xuXG5cdFx0XHRcdGlmIChkb2N1bWVudCkge1xuXHRcdFx0XHRcdHRoaXMuX2NyZWF0ZUV4dEhvc3RFZGl0b3IoZG9jdW1lbnQsIGVkaXRvck1vZGVsRGF0YS5pZCwgZWRpdG9yTW9kZWxEYXRhKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHJlbW92ZWRFZGl0b3JzOiBFeHRIb3N0Tm90ZWJvb2tFZGl0b3JbXSA9IFtdO1xuXG5cdFx0aWYgKGRlbHRhLnZhbHVlLnJlbW92ZWRFZGl0b3JzKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGVkaXRvcmlkIG9mIGRlbHRhLnZhbHVlLnJlbW92ZWRFZGl0b3JzKSB7XG5cdFx0XHRcdGNvbnN0IGVkaXRvciA9IHRoaXMuX2VkaXRvcnMuZ2V0KGVkaXRvcmlkKTtcblxuXHRcdFx0XHRpZiAoZWRpdG9yKSB7XG5cdFx0XHRcdFx0dGhpcy5fZWRpdG9ycy5kZWxldGUoZWRpdG9yaWQpO1xuXG5cdFx0XHRcdFx0aWYgKHRoaXMuX2FjdGl2ZU5vdGVib29rRWRpdG9yPy5pZCA9PT0gZWRpdG9yLmlkKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9hY3RpdmVOb3RlYm9va0VkaXRvciA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZW1vdmVkRWRpdG9ycy5wdXNoKGVkaXRvcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoZGVsdGEudmFsdWUudmlzaWJsZUVkaXRvcnMpIHtcblx0XHRcdHRoaXMuX3Zpc2libGVOb3RlYm9va0VkaXRvcnMgPSBkZWx0YS52YWx1ZS52aXNpYmxlRWRpdG9ycy5tYXAoaWQgPT4gdGhpcy5fZWRpdG9ycy5nZXQoaWQpISkuZmlsdGVyKGVkaXRvciA9PiAhIWVkaXRvcikgYXMgRXh0SG9zdE5vdGVib29rRWRpdG9yW107XG5cdFx0XHRjb25zdCB2aXNpYmxlRWRpdG9yc1NldCA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdFx0dGhpcy5fdmlzaWJsZU5vdGVib29rRWRpdG9ycy5mb3JFYWNoKGVkaXRvciA9PiB2aXNpYmxlRWRpdG9yc1NldC5hZGQoZWRpdG9yLmlkKSk7XG5cblx0XHRcdGZvciAoY29uc3QgZWRpdG9yIG9mIHRoaXMuX2VkaXRvcnMudmFsdWVzKCkpIHtcblx0XHRcdFx0Y29uc3QgbmV3VmFsdWUgPSB2aXNpYmxlRWRpdG9yc1NldC5oYXMoZWRpdG9yLmlkKTtcblx0XHRcdFx0ZWRpdG9yLl9hY2NlcHRWaXNpYmlsaXR5KG5ld1ZhbHVlKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5fdmlzaWJsZU5vdGVib29rRWRpdG9ycyA9IFsuLi50aGlzLl9lZGl0b3JzLnZhbHVlcygpXS5tYXAoZSA9PiBlKS5maWx0ZXIoZSA9PiBlLnZpc2libGUpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VWaXNpYmxlTm90ZWJvb2tFZGl0b3JzLmZpcmUodGhpcy52aXNpYmxlTm90ZWJvb2tFZGl0b3JzKTtcblx0XHR9XG5cblx0XHRpZiAoZGVsdGEudmFsdWUubmV3QWN0aXZlRWRpdG9yID09PSBudWxsKSB7XG5cdFx0XHQvLyBjbGVhciBhY3RpdmUgbm90ZWJvb2sgYXMgY3VycmVudCBhY3RpdmUgZWRpdG9yIGlzIG5vbi1ub3RlYm9vayBlZGl0b3Jcblx0XHRcdHRoaXMuX2FjdGl2ZU5vdGVib29rRWRpdG9yID0gdW5kZWZpbmVkO1xuXHRcdH0gZWxzZSBpZiAoZGVsdGEudmFsdWUubmV3QWN0aXZlRWRpdG9yKSB7XG5cdFx0XHRjb25zdCBhY3RpdmVFZGl0b3IgPSB0aGlzLl9lZGl0b3JzLmdldChkZWx0YS52YWx1ZS5uZXdBY3RpdmVFZGl0b3IpO1xuXHRcdFx0aWYgKCFhY3RpdmVFZGl0b3IpIHtcblx0XHRcdFx0Y29uc29sZS5lcnJvcihgRkFJTEVEIHRvIGZpbmQgYWN0aXZlIG5vdGVib29rIGVkaXRvciAke2RlbHRhLnZhbHVlLm5ld0FjdGl2ZUVkaXRvcn1gKTtcblx0XHRcdH1cblx0XHRcdHRoaXMuX2FjdGl2ZU5vdGVib29rRWRpdG9yID0gdGhpcy5fZWRpdG9ycy5nZXQoZGVsdGEudmFsdWUubmV3QWN0aXZlRWRpdG9yKTtcblx0XHR9XG5cdFx0aWYgKGRlbHRhLnZhbHVlLm5ld0FjdGl2ZUVkaXRvciAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUFjdGl2ZU5vdGVib29rRWRpdG9yLmZpcmUodGhpcy5fYWN0aXZlTm90ZWJvb2tFZGl0b3I/LmFwaUVkaXRvcik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3JlZ2lzdGVyQXBpQ29tbWFuZHMoZXh0SG9zdENvbW1hbmRzOiBFeHRIb3N0Q29tbWFuZHMpIHtcblxuXHRcdGNvbnN0IG5vdGVib29rVHlwZUFyZyA9IEFwaUNvbW1hbmRBcmd1bWVudC5TdHJpbmcud2l0aCgnbm90ZWJvb2tUeXBlJywgJ0Egbm90ZWJvb2sgdHlwZScpO1xuXG5cdFx0Y29uc3QgY29tbWFuZERhdGFUb05vdGVib29rID0gbmV3IEFwaUNvbW1hbmQoXG5cdFx0XHQndnNjb2RlLmV4ZWN1dGVEYXRhVG9Ob3RlYm9vaycsICdfZXhlY3V0ZURhdGFUb05vdGVib29rJywgJ0ludm9rZSBub3RlYm9vayBzZXJpYWxpemVyJyxcblx0XHRcdFtub3RlYm9va1R5cGVBcmcsIG5ldyBBcGlDb21tYW5kQXJndW1lbnQ8VWludDhBcnJheSwgVlNCdWZmZXI+KCdkYXRhJywgJ0J5dGVzIHRvIGNvbnZlcnQgdG8gZGF0YScsIHYgPT4gdiBpbnN0YW5jZW9mIFVpbnQ4QXJyYXksIHYgPT4gVlNCdWZmZXIud3JhcCh2KSldLFxuXHRcdFx0bmV3IEFwaUNvbW1hbmRSZXN1bHQ8U2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnM8Tm90ZWJvb2tEYXRhRHRvPiwgdnNjb2RlLk5vdGVib29rRGF0YT4oJ05vdGVib29rIERhdGEnLCBkYXRhID0+IHR5cGVDb252ZXJ0ZXJzLk5vdGVib29rRGF0YS50byhkYXRhLnZhbHVlKSlcblx0XHQpO1xuXG5cdFx0Y29uc3QgY29tbWFuZE5vdGVib29rVG9EYXRhID0gbmV3IEFwaUNvbW1hbmQoXG5cdFx0XHQndnNjb2RlLmV4ZWN1dGVOb3RlYm9va1RvRGF0YScsICdfZXhlY3V0ZU5vdGVib29rVG9EYXRhJywgJ0ludm9rZSBub3RlYm9vayBzZXJpYWxpemVyJyxcblx0XHRcdFtub3RlYm9va1R5cGVBcmcsIG5ldyBBcGlDb21tYW5kQXJndW1lbnQ8dnNjb2RlLk5vdGVib29rRGF0YSwgU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnM8Tm90ZWJvb2tEYXRhRHRvPj4oJ05vdGVib29rRGF0YScsICdOb3RlYm9vayBkYXRhIHRvIGNvbnZlcnQgdG8gYnl0ZXMnLCB2ID0+IHRydWUsIHYgPT4gbmV3IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzKHR5cGVDb252ZXJ0ZXJzLk5vdGVib29rRGF0YS5mcm9tKHYpKSldLFxuXHRcdFx0bmV3IEFwaUNvbW1hbmRSZXN1bHQ8VlNCdWZmZXIsIFVpbnQ4QXJyYXk+KCdCeXRlcycsIGR0byA9PiBkdG8uYnVmZmVyKVxuXHRcdCk7XG5cblx0XHRleHRIb3N0Q29tbWFuZHMucmVnaXN0ZXJBcGlDb21tYW5kKGNvbW1hbmREYXRhVG9Ob3RlYm9vayk7XG5cdFx0ZXh0SG9zdENvbW1hbmRzLnJlZ2lzdGVyQXBpQ29tbWFuZChjb21tYW5kTm90ZWJvb2tUb0RhdGEpO1xuXHR9XG5cblx0cHJpdmF0ZSB0cmFjZShtc2c6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYFtFeHRlbnNpb24gSG9zdCBOb3RlYm9va10gJHttc2d9YCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMsZUFBc0I7QUFFL0IsU0FBUyxpQkFBOEIsb0JBQW9CO0FBQzNELFNBQVMsYUFBYSxtQkFBbUI7QUFDekMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxXQUEwQjtBQUVuQyxZQUFZLFdBQVc7QUFDdkIsU0FBUyxhQUFhO0FBQ3RCLFNBQTZOLG1CQUErSDtBQUM1VixTQUFTLFlBQVksb0JBQW9CLHdCQUE0RDtBQUdyRyxZQUFZLG9CQUFvQjtBQUNoQyxZQUFZLGtCQUFrQjtB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SyxDQUFDLEVBQUUsT0FBTyxPQUFLLEVBQUUsT0FBTztBQUM1RixXQUFLLG1DQUFtQyxLQUFLLEtBQUssc0JBQXNCO0FBQUEsSUFDekU7QUFFQSxRQUFJLE1BQU0sTUFBTSxvQkFBb0IsTUFBTTtBQUV6QyxXQUFLLHdCQUF3QjtBQUFBLElBQzlCLFdBQVcsTUFBTSxNQUFNLGlCQUFpQjtBQUN2QyxZQUFNLGVBQWUsS0FBSyxTQUFTLElBQUksTUFBTSxNQUFNLGVBQWU7QUFDbEUsVUFBSSxDQUFDLGNBQWM7QUFDbEIsZ0JBQVEsTUFBTSx5Q0FBeUMsTUFBTSxNQUFNLGVBQWUsRUFBRTtBQUFBLE1BQ3JGO0FBQ0EsV0FBSyx3QkFBd0IsS0FBSyxTQUFTLElBQUksTUFBTSxNQUFNLGVBQWU7QUFBQSxJQUMzRTtBQUNBLFFBQUksTUFBTSxNQUFNLG9CQUFvQixRQUFXO0FBQzlDLFdBQUssaUNBQWlDLEtBQUssS0FBSyx1QkFBdUIsU0FBUztBQUFBLElBQ2pGO0FBQUEsRUFDRDtBQUFBLEVBRUEsT0FBZSxxQkFBcUIsaUJBQWtDO0FBRXJFLFVBQU0sa0JBQWtCLG1CQUFtQixPQUFPLEtBQUssZ0JBQWdCLGlCQUFpQjtBQUV4RixVQUFNLHdCQUF3QixJQUFJO0FBQUEsTUFDakM7QUFBQSxNQUFnQztBQUFBLE1BQTBCO0FBQUEsTUFDMUQsQ0FBQyxpQkFBaUIsSUFBSSxtQkFBeUMsUUFBUSw0QkFBNEIsT0FBSyxhQUFhLFlBQVksT0FBSyxTQUFTLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFBQSxNQUN2SixJQUFJLGlCQUFzRixpQkFBaUIsVUFBUSxlQUFlLGFBQWEsR0FBRyxLQUFLLEtBQUssQ0FBQztBQUFBLElBQzlKO0FBRUEsVUFBTSx3QkFBd0IsSUFBSTtBQUFBLE1BQ2pDO0FBQUEsTUFBZ0M7QUFBQSxNQUEwQjtBQUFBLE1BQzFELENBQUMsaUJBQWlCLElBQUksbUJBQXdGLGdCQUFnQixxQ0FBcUMsT0FBSyxNQUFNLE9BQUssSUFBSSw4QkFBOEIsZUFBZSxhQUFhLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUFBLE1BQzFQLElBQUksaUJBQXVDLFNBQVMsU0FBTyxJQUFJLE1BQU07QUFBQSxJQUN0RTtBQUVBLG9CQUFnQixtQkFBbUIscUJBQXFCO0FBQ3hELG9CQUFnQixtQkFBbUIscUJBQXFCO0FBQUEsRUFDekQ7QUFBQSxFQUVRLE1BQU0sS0FBbUI7QUFDaEMsU0FBSyxZQUFZLE1BQU0sNkJBQTZCLEdBQUcsRUFBRTtBQUFBLEVBQzFEO0FBQ0Q7QUF6ckJhLDJCQUNHLDJDQUFtRDtBQUQ1RCxJQUFNLDRCQUFOOyIsCiAgIm5hbWVzIjogWyJ0b2tlbiIsICJ0ZXh0UXVlcnkiLCAibm90ZWJvb2siLCAiaW5kZXgiXQp9Cg==
