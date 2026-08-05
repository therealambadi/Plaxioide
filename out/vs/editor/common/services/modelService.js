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
import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../base/common/lifecycle.js";
import * as platform from "../../../base/common/platform.js";
import { EditOperation } from "../core/editOperation.js";
import { Range } from "../core/range.js";
import { DefaultEndOfLine, EndOfLinePreference, EndOfLineSequence } from "../model.js";
import { TextModel, createTextBuffer } from "../model/textModel.js";
import { EDITOR_MODEL_DEFAULTS } from "../core/textModelDefaults.js";
import { PLAINTEXT_LANGUAGE_ID } from "../languages/modesRegistry.js";
import { ITextResourcePropertiesService } from "./textResourceConfiguration.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { IUndoRedoService } from "../../../platform/undoRedo/common/undoRedo.js";
import { StringSHA1 } from "../../../base/common/hash.js";
import { isEditStackElement } from "../model/editStack.js";
import { Schemas } from "../../../base/common/network.js";
import { equals } from "../../../base/common/objects.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
function MODEL_ID(resource) {
  return resource.toString();
}
class ModelData {
  constructor(model, onWillDispose, onDidChangeLanguage) {
    this.model = model;
    this._modelEventListeners = new DisposableStore();
    this.model = model;
    this._modelEventListeners.add(model.onWillDispose(() => onWillDispose(model)));
    this._modelEventListeners.add(model.onDidChangeLanguage((e) => onDidChangeLanguage(model, e)));
  }
  dispose() {
    this._modelEventListeners.dispose();
  }
}
const DEFAULT_EOL = platform.isLinux || platform.isMacintosh ? DefaultEndOfLine.LF : DefaultEndOfLine.CRLF;
class DisposedModelInfo {
  constructor(uri, initialUndoRedoSnapshot, time, sharesUndoRedoStack, heapSize, sha1, versionId, alternativeVersionId) {
    this.uri = uri;
    this.initialUndoRedoSnapshot = initialUndoRedoSnapshot;
    this.time = time;
    this.sharesUndoRedoStack = sharesUndoRedoStack;
    this.heapSize = heapSize;
    this.sha1 = sha1;
    this.versionId = versionId;
    this.alternativeVersionId = alternativeVersionId;
  }
}
let ModelService = class extends Disposable {
  constructor(_configurationService, _resourcePropertiesService, _undoRedoService, _instantiationService) {
    super();
    this._configurationService = _configurationService;
    this._resourcePropertiesService = _resourcePropertiesService;
    this._undoRedoService = _undoRedoService;
    this._instantiationService = _instantiationService;
    this._onModelAdded = this._register(new Emitter());
    this.onModelAdded = this._onModelAdded.event;
    this._onModelRemoved = this._register(new Emitter());
    this.onModelRemoved = this._onModelRemoved.event;
    this._onModelModeChanged = this._register(new Emitter());
    this.onModelLanguageChanged = this._onModelModeChanged.event;
    this._modelCreationOptionsByLanguageAndResource = /* @__PURE__ */ Object.create(null);
    this._models = {};
    this._disposedModels = /* @__PURE__ */ new Map();
    this._disposedModelsHeapSize = 0;
    this._register(this._configurationService.onDidChangeConfiguration((e) => this._updateModelOptions(e)));
    this._updateModelOptions(void 0);
  }
  static _readModelOptions(config, isForSimpleWidget) {
    let tabSize = EDITOR_MODEL_DEFAULTS.tabSize;
    if (config.editor && typeof config.editor.tabSize !== "undefined") {
      const parsedTabSize = parseInt(config.editor.tabSize, 10);
      if (!isNaN(parsedTabSize)) {
        tabSize = parsedTabSize;
      }
      if (tabSize < 1) {
        tabSize = 1;
      }
    }
    let indentSize = "tabSize";
    if (config.editor && typeof config.editor.indentSize !== "undefined" && config.editor.indentSize !== "tabSize") {
      const parsedIndentSize = parseInt(config.editor.indentSize, 10);
      if (!isNaN(parsedIndentSize)) {
        indentSize = Math.max(parsedIndentSize, 1);
      }
    }
    let insertSpaces = EDITOR_MODEL_DEFAULTS.insertSpaces;
    if (config.editor && typeof config.editor.insertSpaces !== "undefined") {
      insertSpaces = config.editor.insertSpaces === "false" ? false : Boolean(config.editor.insertSpaces);
    }
    let newDefaultEOL = DEFAULT_EOL;
    const eol = config.eol;
    if (eol === "\r\n") {
      newDefaultEOL = DefaultEndOfLine.CRLF;
    } else if (eol === "\n") {
      newDefaultEOL = DefaultEndOfLine.LF;
    }
    let trimAutoWhitespace = EDITOR_MODEL_DEFAULTS.trimAutoWhitespace;
    if (config.editor && typeof config.editor.trimAutoWhitespace !== "undefined") {
      trimAutoWhitespace = config.editor.trimAutoWhitespace === "false" ? false : Boolean(config.editor.trimAutoWhitespace);
    }
    let detectIndentation = EDITOR_MODEL_DEFAULTS.detectIndentation;
    if (config.editor && typeof config.editor.detectIndentation !== "undefined") {
      detectIndentation = config.editor.detectIndentation === "false" ? false : Boolean(config.editor.detectIndentation);
    }
    let largeFileOptimizations = EDITOR_MODEL_DEFAULTS.largeFileOptimizations;
    if (config.editor && typeof config.editor.largeFileOptimizations !== "undefined") {
      largeFileOptimizations = config.editor.largeFileOptimizations === "false" ? false : Boolean(config.editor.largeFileOptimizations);
    }
    let bracketPairColorizationOptions = EDITOR_MODEL_DEFAULTS.bracketPairColorizationOptions;
    if (config.editor?.bracketPairColorization && typeof config.editor.bracketPairColorization === "object") {
      bracketPairColorizationOptions = {
        enabled: !!config.editor.bracketPairColorization.enabled,
        independentColorPoolPerBracketType: !!config.editor.bracketPairColorization.independentColorPoolPerBracketType
      };
    }
    return {
      isForSimpleWidget,
      tabSize,
      indentSize,
      insertSpaces,
      detectIndentation,
      defaultEOL: newDefaultEOL,
      trimAutoWhitespace,
      largeFileOptimizations,
      bracketPairColorizationOptions
    };
  }
  _getEOL(resource, language) {
    if (resource) {
      return this._resourcePropertiesService.getEOL(resource, language);
    }
    const eol = this._configurationService.getValue("files.eol", { overrideIdentifier: language });
    if (eol && typeof eol === "string" && eol !== "auto") {
      return eol;
    }
    return platform.OS === platform.OperatingSystem.Linux || platform.OS === platform.OperatingSystem.Macintosh ? "\n" : "\r\n";
  }
  _shouldRestoreUndoStack() {
    const result = this._configurationService.getValue("files.restoreUndoStack");
    if (typeof result === "boolean") {
      return result;
    }
    return true;
  }
  getCreationOptions(languageIdOrSelection, resource, isForSimpleWidget) {
    const language = typeof languageIdOrSelection === "string" ? languageIdOrSelection : languageIdOrSelection.languageId;
    let creationOptions = this._modelCreationOptionsByLanguageAndResource[language + resource];
    if (!creationOptions) {
      const editor = this._configurationService.getValue("editor", { overrideIdentifier: language, resource });
      const eol = this._getEOL(resource, language);
      creationOptions = ModelService._readModelOptions({ editor, eol }, isForSimpleWidget);
      this._modelCreationOptionsByLanguageAndResource[language + resource] = creationOptions;
    }
    return creationOptions;
  }
  _updateModelOptions(e) {
    const oldOptionsByLanguageAndResource = this._modelCreationOptionsByLanguageAndResource;
    this._modelCreationOptionsByLanguageAndResource = /* @__PURE__ */ Object.create(null);
    const keys = Object.keys(this._models);
    for (let i = 0, len = keys.length; i < len; i++) {
      const modelId = keys[i];
      const modelData = this._models[modelId];
      const language = modelData.model.getLanguageId();
      const uri = modelData.model.uri;
      if (e && !e.affectsConfiguration("editor", { overrideIdentifier: language, resource: uri }) && !e.affectsConfiguration("files.eol", { overrideIdentifier: language, resource: uri })) {
        continue;
      }
      const oldOptions = oldOptionsByLanguageAndResource[language + uri];
      const newOptions = this.getCreationOptions(language, uri, modelData.model.isForSimpleWidget);
      ModelService._setModelOptionsForModel(modelData.model, newOptions, oldOptions);
    }
  }
  static _setModelOptionsForModel(model, newOptions, currentOptions) {
    if (currentOptions && currentOptions.defaultEOL !== newOptions.defaultEOL && model.getLineCount() === 1) {
      model.setEOL(newOptions.defaultEOL === DefaultEndOfLine.LF ? EndOfLineSequence.LF : EndOfLineSequence.CRLF);
    }
    if (currentOptions && currentOptions.detectIndentation === newOptions.detectIndentation && currentOptions.insertSpaces === newOptions.insertSpaces && currentOptions.tabSize === newOptions.tabSize && currentOptions.indentSize === newOptions.indentSize && currentOptions.trimAutoWhitespace === newOptions.trimAutoWhitespace && equals(currentOptions.bracketPairColorizationOptions, newOptions.bracketPairColorizationOptions)) {
      return;
    }
    if (newOptions.detectIndentation) {
      model.detectIndentation(newOptions.insertSpaces, newOptions.tabSize);
      model.updateOptions({
        trimAutoWhitespace: newOptions.trimAutoWhitespace,
        bracketColorizationOptions: newOptions.bracketPairColorizationOptions
      });
    } else {
      model.updateOptions({
        insertSpaces: newOptions.insertSpaces,
        tabSize: newOptions.tabSize,
        indentSize: newOptions.indentSize,
        trimAutoWhitespace: newOptions.trimAutoWhitespace,
        bracketColorizationOptions: newOptions.bracketPairColorizationOptions
      });
    }
  }
  // --- begin IModelService
  _insertDisposedModel(disposedModelData) {
    this._disposedModels.set(MODEL_ID(disposedModelData.uri), disposedModelData);
    this._disposedModelsHeapSize += disposedModelData.heapSize;
  }
  _removeDisposedModel(resource) {
    const disposedModelData = this._disposedModels.get(MODEL_ID(resource));
    if (disposedModelData) {
      this._disposedModelsHeapSize -= disposedModelData.heapSize;
    }
    this._disposedModels.delete(MODEL_ID(resource));
    return disposedModelData;
  }
  _ensureDisposedModelsHeapSize(maxModelsHeapSize) {
    if (this._disposedModelsHeapSize > maxModelsHeapSize) {
      const disposedModels = [];
      this._disposedModels.forEach((entry) => {
        if (!entry.sharesUndoRedoStack) {
          disposedModels.push(entry);
        }
      });
      disposedModels.sort((a, b) => a.time - b.time);
      while (disposedModels.length > 0 && this._disposedModelsHeapSize > maxModelsHeapSize) {
        const disposedModel = disposedModels.shift();
        this._removeDisposedModel(disposedModel.uri);
        if (disposedModel.initialUndoRedoSnapshot !== null) {
          this._undoRedoService.restoreSnapshot(disposedModel.initialUndoRedoSnapshot);
        }
      }
    }
  }
  _createModelData(value, languageIdOrSelection, resource, isForSimpleWidget) {
    const options = this.getCreationOptions(languageIdOrSelection, resource, isForSimpleWidget);
    const model = this._instantiationService.createInstance(
      TextModel,
      value,
      languageIdOrSelection,
      options,
      resource
    );
    if (resource && this._disposedModels.has(MODEL_ID(resource))) {
      const disposedModelData = this._removeDisposedModel(resource);
      const elements = this._undoRedoService.getElements(resource);
      const sha1Computer = this._getSHA1Computer();
      const sha1IsEqual = sha1Computer.canComputeSHA1(model) ? sha1Computer.computeSHA1(model) === disposedModelData.sha1 : false;
      if (sha1IsEqual || disposedModelData.sharesUndoRedoStack) {
        for (const element of elements.past) {
          if (isEditStackElement(element) && element.matchesResource(resource)) {
            element.setModel(model);
          }
        }
        for (const element of elements.future) {
          if (isEditStackElement(element) && element.matchesResource(resource)) {
            element.setModel(model);
          }
        }
        this._undoRedoService.setElementsValidFlag(resource, true, (element) => isEditStackElement(element) && element.matchesResource(resource));
        if (sha1IsEqual) {
          model._overwriteVersionId(disposedModelData.versionId);
          model._overwriteAlternativeVersionId(disposedModelData.alternativeVersionId);
          model._overwriteInitialUndoRedoSnapshot(disposedModelData.initialUndoRedoSnapshot);
        }
      } else {
        if (disposedModelData.initialUndoRedoSnapshot !== null) {
          this._undoRedoService.restoreSnapshot(disposedModelData.initialUndoRedoSnapshot);
        }
      }
    }
    const modelId = MODEL_ID(model.uri);
    if (this._models[modelId]) {
      throw new Error("ModelService: Cannot add model because it already exists!");
    }
    const modelData = new ModelData(
      model,
      (model2) => this._onWillDispose(model2),
      (model2, e) => this._onDidChangeLanguage(model2, e)
    );
    this._models[modelId] = modelData;
    return modelData;
  }
  updateModel(model, value) {
    const options = this.getCreationOptions(model.getLanguageId(), model.uri, model.isForSimpleWidget);
    const { textBuffer, disposable } = createTextBuffer(value, options.defaultEOL);
    if (model.equalsTextBuffer(textBuffer)) {
      disposable.dispose();
      return;
    }
    model.pushStackElement();
    model.pushEOL(textBuffer.getEOL() === "\r\n" ? EndOfLineSequence.CRLF : EndOfLineSequence.LF);
    model.pushEditOperations(
      [],
      ModelService._computeEdits(model, textBuffer),
      () => []
    );
    model.pushStackElement();
    disposable.dispose();
  }
  static _commonPrefix(a, aLen, aDelta, b, bLen, bDelta) {
    const maxResult = Math.min(aLen, bLen);
    let result = 0;
    for (let i = 0; i < maxResult && a.getLineContent(aDelta + i) === b.getLineContent(bDelta + i); i++) {
      result++;
    }
    return result;
  }
  static _commonSuffix(a, aLen, aDelta, b, bLen, bDelta) {
    const maxResult = Math.min(aLen, bLen);
    let result = 0;
    for (let i = 0; i < maxResult && a.getLineContent(aDelta + aLen - i) === b.getLineContent(bDelta + bLen - i); i++) {
      result++;
    }
    return result;
  }
  /**
   * Compute edits to bring `model` to the state of `textSource`.
   */
  static _computeEdits(model, textBuffer) {
    const modelLineCount = model.getLineCount();
    const textBufferLineCount = textBuffer.getLineCount();
    const commonPrefix = this._commonPrefix(model, modelLineCount, 1, textBuffer, textBufferLineCount, 1);
    if (modelLineCount === textBufferLineCount && commonPrefix === modelLineCount) {
      return [];
    }
    const commonSuffix = this._commonSuffix(model, modelLineCount - commonPrefix, commonPrefix, textBuffer, textBufferLineCount - commonPrefix, commonPrefix);
    let oldRange;
    let newRange;
    if (commonSuffix > 0) {
      oldRange = new Range(commonPrefix + 1, 1, modelLineCount - commonSuffix + 1, 1);
      newRange = new Range(commonPrefix + 1, 1, textBufferLineCount - commonSuffix + 1, 1);
    } else if (commonPrefix > 0) {
      oldRange = new Range(commonPrefix, model.getLineMaxColumn(commonPrefix), modelLineCount, model.getLineMaxColumn(modelLineCount));
      newRange = new Range(commonPrefix, 1 + textBuffer.getLineLength(commonPrefix), textBufferLineCount, 1 + textBuffer.getLineLength(textBufferLineCount));
    } else {
      oldRange = new Range(1, 1, modelLineCount, model.getLineMaxColumn(modelLineCount));
      newRange = new Range(1, 1, textBufferLineCount, 1 + textBuffer.getLineLength(textBufferLineCount));
    }
    return [EditOperation.replaceMove(oldRange, textBuffer.getValueInRange(newRange, EndOfLinePreference.TextDefined))];
  }
  createModel(value, languageSelection, resource, isForSimpleWidget = false) {
    let modelData;
    if (languageSelection) {
      modelData = this._createModelData(value, languageSelection, resource, isForSimpleWidget);
    } else {
      modelData = this._createModelData(value, PLAINTEXT_LANGUAGE_ID, resource, isForSimpleWidget);
    }
    this._onModelAdded.fire(modelData.model);
    return modelData.model;
  }
  destroyModel(resource) {
    const modelData = this._models[MODEL_ID(resource)];
    if (!modelData) {
      return;
    }
    modelData.model.dispose();
  }
  getModels() {
    const ret = [];
    const keys = Object.keys(this._models);
    for (let i = 0, len = keys.length; i < len; i++) {
      const modelId = keys[i];
      ret.push(this._models[modelId].model);
    }
    return ret;
  }
  getModel(resource) {
    const modelId = MODEL_ID(resource);
    const modelData = this._models[modelId];
    if (!modelData) {
      return null;
    }
    return modelData.model;
  }
  // --- end IModelService
  _schemaShouldMaintainUndoRedoElements(resource) {
    return resource.scheme === Schemas.file || resource.scheme === Schemas.vscodeRemote || resource.scheme === Schemas.vscodeUserData || resource.scheme === Schemas.vscodeNotebookCell || resource.scheme === "fake-fs";
  }
  _onWillDispose(model) {
    const modelId = MODEL_ID(model.uri);
    const modelData = this._models[modelId];
    const sharesUndoRedoStack = this._undoRedoService.getUriComparisonKey(model.uri) !== model.uri.toString();
    let maintainUndoRedoStack = false;
    let heapSize = 0;
    if (sharesUndoRedoStack || this._shouldRestoreUndoStack() && this._schemaShouldMaintainUndoRedoElements(model.uri)) {
      const elements = this._undoRedoService.getElements(model.uri);
      if (elements.past.length > 0 || elements.future.length > 0) {
        for (const element of elements.past) {
          if (isEditStackElement(element) && element.matchesResource(model.uri)) {
            maintainUndoRedoStack = true;
            heapSize += element.heapSize(model.uri);
            element.setModel(model.uri);
          }
        }
        for (const element of elements.future) {
          if (isEditStackElement(element) && element.matchesResource(model.uri)) {
            maintainUndoRedoStack = true;
            heapSize += element.heapSize(model.uri);
            element.setModel(model.uri);
          }
        }
      }
    }
    const maxMemory = ModelService.MAX_MEMORY_FOR_CLOSED_FILES_UNDO_STACK;
    const sha1Computer = this._getSHA1Computer();
    if (!maintainUndoRedoStack) {
      if (!sharesUndoRedoStack) {
        const initialUndoRedoSnapshot = modelData.model.getInitialUndoRedoSnapshot();
        if (initialUndoRedoSnapshot !== null) {
          this._undoRedoService.restoreSnapshot(initialUndoRedoSnapshot);
        }
      }
    } else if (!sharesUndoRedoStack && (heapSize > maxMemory || !sha1Computer.canComputeSHA1(model))) {
      const initialUndoRedoSnapshot = modelData.model.getInitialUndoRedoSnapshot();
      if (initialUndoRedoSnapshot !== null) {
        this._undoRedoService.restoreSnapshot(initialUndoRedoSnapshot);
      }
    } else {
      this._ensureDisposedModelsHeapSize(maxMemory - heapSize);
      this._undoRedoService.setElementsValidFlag(model.uri, false, (element) => isEditStackElement(element) && element.matchesResource(model.uri));
      this._insertDisposedModel(new DisposedModelInfo(model.uri, modelData.model.getInitialUndoRedoSnapshot(), Date.now(), sharesUndoRedoStack, heapSize, sha1Computer.computeSHA1(model), model.getVersionId(), model.getAlternativeVersionId()));
    }
    delete this._models[modelId];
    modelData.dispose();
    delete this._modelCreationOptionsByLanguageAndResource[model.getLanguageId() + model.uri];
    this._onModelRemoved.fire(model);
  }
  _onDidChangeLanguage(model, e) {
    const oldLanguageId = e.oldLanguage;
    const newLanguageId = model.getLanguageId();
    const oldOptions = this.getCreationOptions(oldLanguageId, model.uri, model.isForSimpleWidget);
    const newOptions = this.getCreationOptions(newLanguageId, model.uri, model.isForSimpleWidget);
    ModelService._setModelOptionsForModel(model, newOptions, oldOptions);
    this._onModelModeChanged.fire({ model, oldLanguageId });
  }
  _getSHA1Computer() {
    return new DefaultModelSHA1Computer();
  }
};
ModelService.MAX_MEMORY_FOR_CLOSED_FILES_UNDO_STACK = 20 * 1024 * 1024;
ModelService = __decorateClass([
  __decorateParam(0, IConfigurationService),
  __decorateParam(1, ITextResourcePropertiesService),
  __decorateParam(2, IUndoRedoService),
  __decorateParam(3, IInstantiationService)
], ModelService);
const _DefaultModelSHA1Computer = class _DefaultModelSHA1Computer {
  // takes 200ms to compute a sha1 on a 10MB model on a new machine
  canComputeSHA1(model) {
    return model.getValueLength() <= _DefaultModelSHA1Computer.MAX_MODEL_SIZE;
  }
  computeSHA1(model) {
    const shaComputer = new StringSHA1();
    const snapshot = model.createSnapshot();
    let text;
    while (text = snapshot.read()) {
      shaComputer.update(text);
    }
    return shaComputer.digest();
  }
};
_DefaultModelSHA1Computer.MAX_MODEL_SIZE = 10 * 1024 * 1024;
let DefaultModelSHA1Computer = _DefaultModelSHA1Computer;
export {
  DefaultModelSHA1Computer,
  ModelService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgKiBhcyBwbGF0Zm9ybSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRWRpdE9wZXJhdGlvbiwgSVNpbmdsZUVkaXRPcGVyYXRpb24gfSBmcm9tICcuLi9jb3JlL2VkaXRPcGVyYXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IERlZmF1bHRFbmRPZkxpbmUsIEVuZE9mTGluZVByZWZlcmVuY2UsIEVuZE9mTGluZVNlcXVlbmNlLCBJVGV4dEJ1ZmZlciwgSVRleHRCdWZmZXJGYWN0b3J5LCBJVGV4dE1vZGVsLCBJVGV4dE1vZGVsQ3JlYXRpb25PcHRpb25zIH0gZnJvbSAnLi4vbW9kZWwuanMnO1xuaW1wb3J0IHsgVGV4dE1vZGVsLCBjcmVhdGVUZXh0QnVmZmVyIH0gZnJvbSAnLi4vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IEVESVRPUl9NT0RFTF9ERUZBVUxUUyB9IGZyb20gJy4uL2NvcmUvdGV4dE1vZGVsRGVmYXVsdHMuanMnO1xuaW1wb3J0IHsgSU1vZGVsTGFuZ3VhZ2VDaGFuZ2VkRXZlbnQgfSBmcm9tICcuLi90ZXh0TW9kZWxFdmVudHMuanMnO1xuaW1wb3J0IHsgUExBSU5URVhUX0xBTkdVQUdFX0lEIH0gZnJvbSAnLi4vbGFuZ3VhZ2VzL21vZGVzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VsZWN0aW9uIH0gZnJvbSAnLi4vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuL21vZGVsLmpzJztcbmltcG9ydCB7IElUZXh0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZSB9IGZyb20gJy4vdGV4dFJlc291cmNlQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvbkNoYW5nZUV2ZW50LCBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElVbmRvUmVkb1NlcnZpY2UsIFJlc291cmNlRWRpdFN0YWNrU25hcHNob3QgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS91bmRvUmVkby9jb21tb24vdW5kb1JlZG8uanMnO1xuaW1wb3J0IHsgU3RyaW5nU0hBMSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2hhc2guanMnO1xuaW1wb3J0IHsgaXNFZGl0U3RhY2tFbGVtZW50IH0gZnJvbSAnLi4vbW9kZWwvZWRpdFN0YWNrLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGVxdWFscyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5cbmZ1bmN0aW9uIE1PREVMX0lEKHJlc291cmNlOiBVUkkpOiBzdHJpbmcge1xuXHRyZXR1cm4gcmVzb3VyY2UudG9TdHJpbmcoKTtcbn1cblxuY2xhc3MgTW9kZWxEYXRhIGltcGxlbWVudHMgSURpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX21vZGVsRXZlbnRMaXN0ZW5lcnMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IG1vZGVsOiBUZXh0TW9kZWwsXG5cdFx0b25XaWxsRGlzcG9zZTogKG1vZGVsOiBJVGV4dE1vZGVsKSA9PiB2b2lkLFxuXHRcdG9uRGlkQ2hhbmdlTGFuZ3VhZ2U6IChtb2RlbDogSVRleHRNb2RlbCwgZTogSU1vZGVsTGFuZ3VhZ2VDaGFuZ2VkRXZlbnQpID0+IHZvaWRcblx0KSB7XG5cdFx0dGhpcy5tb2RlbCA9IG1vZGVsO1xuXHRcdHRoaXMuX21vZGVsRXZlbnRMaXN0ZW5lcnMuYWRkKG1vZGVsLm9uV2lsbERpc3Bvc2UoKCkgPT4gb25XaWxsRGlzcG9zZShtb2RlbCkpKTtcblx0XHR0aGlzLl9tb2RlbEV2ZW50TGlzdGVuZXJzLmFkZChtb2RlbC5vbkRpZENoYW5nZUxhbmd1YWdlKChlKSA9PiBvbkRpZENoYW5nZUxhbmd1YWdlKG1vZGVsLCBlKSkpO1xuXHR9XG5cblx0cHVibGljIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fbW9kZWxFdmVudExpc3RlbmVycy5kaXNwb3NlKCk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElSYXdFZGl0b3JDb25maWcge1xuXHR0YWJTaXplPzogYW55O1xuXHRpbmRlbnRTaXplPzogYW55O1xuXHRpbnNlcnRTcGFjZXM/OiBhbnk7XG5cdGRldGVjdEluZGVudGF0aW9uPzogYW55O1xuXHR0cmltQXV0b1doaXRlc3BhY2U/OiBhbnk7XG5cdGNyZWF0aW9uT3B0aW9ucz86IGFueTtcblx0bGFyZ2VGaWxlT3B0aW1pemF0aW9ucz86IGFueTtcblx0YnJhY2tldFBhaXJDb2xvcml6YXRpb24/OiBhbnk7XG59XG5cbmludGVyZmFjZSBJUmF3Q29uZmlnIHtcblx0ZW9sPzogYW55O1xuXHRlZGl0b3I/OiBJUmF3RWRpdG9yQ29uZmlnO1xufVxuXG5jb25zdCBERUZBVUxUX0VPTCA9IChwbGF0Zm9ybS5pc0xpbnV4IHx8IHBsYXRmb3JtLmlzTWFjaW50b3NoKSA/IERlZmF1bHRFbmRPZkxpbmUuTEYgOiBEZWZhdWx0RW5kT2ZMaW5lLkNSTEY7XG5cbmNsYXNzIERpc3Bvc2VkTW9kZWxJbmZvIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IHVyaTogVVJJLFxuXHRcdHB1YmxpYyByZWFkb25seSBpbml0aWFsVW5kb1JlZG9TbmFwc2hvdDogUmVzb3VyY2VFZGl0U3RhY2tTbmFwc2hvdCB8IG51bGwsXG5cdFx0cHVibGljIHJlYWRvbmx5IHRpbWU6IG51bWJlcixcblx0XHRwdWJsaWMgcmVhZG9ubHkgc2hhcmVzVW5kb1JlZG9TdGFjazogYm9vbGVhbixcblx0XHRwdWJsaWMgcmVhZG9ubHkgaGVhcFNpemU6IG51bWJlcixcblx0XHRwdWJsaWMgcmVhZG9ubHkgc2hhMTogc3RyaW5nLFxuXHRcdHB1YmxpYyByZWFkb25seSB2ZXJzaW9uSWQ6IG51bWJlcixcblx0XHRwdWJsaWMgcmVhZG9ubHkgYWx0ZXJuYXRpdmVWZXJzaW9uSWQ6IG51bWJlcixcblx0KSB7IH1cbn1cblxuZXhwb3J0IGNsYXNzIE1vZGVsU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJTW9kZWxTZXJ2aWNlIHtcblxuXHRwdWJsaWMgc3RhdGljIE1BWF9NRU1PUllfRk9SX0NMT1NFRF9GSUxFU19VTkRPX1NUQUNLID0gMjAgKiAxMDI0ICogMTAyNDtcblxuXHRwdWJsaWMgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uTW9kZWxBZGRlZDogRW1pdHRlcjxJVGV4dE1vZGVsPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElUZXh0TW9kZWw+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25Nb2RlbEFkZGVkOiBFdmVudDxJVGV4dE1vZGVsPiA9IHRoaXMuX29uTW9kZWxBZGRlZC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbk1vZGVsUmVtb3ZlZDogRW1pdHRlcjxJVGV4dE1vZGVsPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElUZXh0TW9kZWw+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25Nb2RlbFJlbW92ZWQ6IEV2ZW50PElUZXh0TW9kZWw+ID0gdGhpcy5fb25Nb2RlbFJlbW92ZWQuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25Nb2RlbE1vZGVDaGFuZ2VkID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyBtb2RlbDogSVRleHRNb2RlbDsgb2xkTGFuZ3VhZ2VJZDogc3RyaW5nIH0+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25Nb2RlbExhbmd1YWdlQ2hhbmdlZCA9IHRoaXMuX29uTW9kZWxNb2RlQ2hhbmdlZC5ldmVudDtcblxuXHRwcml2YXRlIF9tb2RlbENyZWF0aW9uT3B0aW9uc0J5TGFuZ3VhZ2VBbmRSZXNvdXJjZTogeyBbbGFuZ3VhZ2VBbmRSZXNvdXJjZTogc3RyaW5nXTogSVRleHRNb2RlbENyZWF0aW9uT3B0aW9ucyB9O1xuXG5cdC8qKlxuXHQgKiBBbGwgdGhlIG1vZGVscyBrbm93biBpbiB0aGUgc3lzdGVtLlxuXHQgKi9cblx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWxzOiB7IFttb2RlbElkOiBzdHJpbmddOiBNb2RlbERhdGEgfTtcblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zZWRNb2RlbHM6IE1hcDxzdHJpbmcsIERpc3Bvc2VkTW9kZWxJbmZvPjtcblx0cHJpdmF0ZSBfZGlzcG9zZWRNb2RlbHNIZWFwU2l6ZTogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVRleHRSZXNvdXJjZVByb3BlcnRpZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Jlc291cmNlUHJvcGVydGllc1NlcnZpY2U6IElUZXh0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZSxcblx0XHRASVVuZG9SZWRvU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF91bmRvUmVkb1NlcnZpY2U6IElVbmRvUmVkb1NlcnZpY2UsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fbW9kZWxDcmVhdGlvbk9wdGlvbnNCeUxhbmd1YWdlQW5kUmVzb3VyY2UgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdHRoaXMuX21vZGVscyA9IHt9O1xuXHRcdHRoaXMuX2Rpc3Bvc2VkTW9kZWxzID0gbmV3IE1hcDxzdHJpbmcsIERpc3Bvc2VkTW9kZWxJbmZvPigpO1xuXHRcdHRoaXMuX2Rpc3Bvc2VkTW9kZWxzSGVhcFNpemUgPSAwO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4gdGhpcy5fdXBkYXRlTW9kZWxPcHRpb25zKGUpKSk7XG5cdFx0dGhpcy5fdXBkYXRlTW9kZWxPcHRpb25zKHVuZGVmaW5lZCk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfcmVhZE1vZGVsT3B0aW9ucyhjb25maWc6IElSYXdDb25maWcsIGlzRm9yU2ltcGxlV2lkZ2V0OiBib29sZWFuKTogSVRleHRNb2RlbENyZWF0aW9uT3B0aW9ucyB7XG5cdFx0bGV0IHRhYlNpemUgPSBFRElUT1JfTU9ERUxfREVGQVVMVFMudGFiU2l6ZTtcblx0XHRpZiAoY29uZmlnLmVkaXRvciAmJiB0eXBlb2YgY29uZmlnLmVkaXRvci50YWJTaXplICE9PSAndW5kZWZpbmVkJykge1xuXHRcdFx0Y29uc3QgcGFyc2VkVGFiU2l6ZSA9IHBhcnNlSW50KGNvbmZpZy5lZGl0b3IudGFiU2l6ZSwgMTApO1xuXHRcdFx0aWYgKCFpc05hTihwYXJzZWRUYWJTaXplKSkge1xuXHRcdFx0XHR0YWJTaXplID0gcGFyc2VkVGFiU2l6ZTtcblx0XHRcdH1cblx0XHRcdGlmICh0YWJTaXplIDwgMSkge1xuXHRcdFx0XHR0YWJTaXplID0gMTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRsZXQgaW5kZW50U2l6ZTogbnVtYmVyIHwgJ3RhYlNpemUnID0gJ3RhYlNpemUnO1xuXHRcdGlmIChjb25maWcuZWRpdG9yICYmIHR5cGVvZiBjb25maWcuZWRpdG9yLmluZGVudFNpemUgIT09ICd1bmRlZmluZWQnICYmIGNvbmZpZy5lZGl0b3IuaW5kZW50U2l6ZSAhPT0gJ3RhYlNpemUnKSB7XG5cdFx0XHRjb25zdCBwYXJzZWRJbmRlbnRTaXplID0gcGFyc2VJbnQoY29uZmlnLmVkaXRvci5pbmRlbnRTaXplLCAxMCk7XG5cdFx0XHRpZiAoIWlzTmFOKHBhcnNlZEluZGVudFNpemUpKSB7XG5cdFx0XHRcdGluZGVudFNpemUgPSBNYXRoLm1heChwYXJzZWRJbmRlbnRTaXplLCAxKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRsZXQgaW5zZXJ0U3BhY2VzID0gRURJVE9SX01PREVMX0RFRkFVTFRTLmluc2VydFNwYWNlcztcblx0XHRpZiAoY29uZmlnLmVkaXRvciAmJiB0eXBlb2YgY29uZmlnLmVkaXRvci5pbnNlcnRTcGFjZXMgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRpbnNlcnRTcGFjZXMgPSAoY29uZmlnLmVkaXRvci5pbnNlcnRTcGFjZXMgPT09ICdmYWxzZScgPyBmYWxzZSA6IEJvb2xlYW4oY29uZmlnLmVkaXRvci5pbnNlcnRTcGFjZXMpKTtcblx0XHR9XG5cblx0XHRsZXQgbmV3RGVmYXVsdEVPTCA9IERFRkFVTFRfRU9MO1xuXHRcdGNvbnN0IGVvbCA9IGNvbmZpZy5lb2w7XG5cdFx0aWYgKGVvbCA9PT0gJ1xcclxcbicpIHtcblx0XHRcdG5ld0RlZmF1bHRFT0wgPSBEZWZhdWx0RW5kT2ZMaW5lLkNSTEY7XG5cdFx0fSBlbHNlIGlmIChlb2wgPT09ICdcXG4nKSB7XG5cdFx0XHRuZXdEZWZhdWx0RU9MID0gRGVmYXVsdEVuZE9mTGluZS5MRjtcblx0XHR9XG5cblx0XHRsZXQgdHJpbUF1dG9XaGl0ZXNwYWNlID0gRURJVE9SX01PREVMX0RFRkFVTFRTLnRyaW1BdXRvV2hpdGVzcGFjZTtcblx0XHRpZiAoY29uZmlnLmVkaXRvciAmJiB0eXBlb2YgY29uZmlnLmVkaXRvci50cmltQXV0b1doaXRlc3BhY2UgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHR0cmltQXV0b1doaXRlc3BhY2UgPSAoY29uZmlnLmVkaXRvci50cmltQXV0b1doaXRlc3BhY2UgPT09ICdmYWxzZScgPyBmYWxzZSA6IEJvb2xlYW4oY29uZmlnLmVkaXRvci50cmltQXV0b1doaXRlc3BhY2UpKTtcblx0XHR9XG5cblx0XHRsZXQgZGV0ZWN0SW5kZW50YXRpb24gPSBFRElUT1JfTU9ERUxfREVGQVVMVFMuZGV0ZWN0SW5kZW50YXRpb247XG5cdFx0aWYgKGNvbmZpZy5lZGl0b3IgJiYgdHlwZW9mIGNvbmZpZy5lZGl0b3IuZGV0ZWN0SW5kZW50YXRpb24gIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRkZXRlY3RJbmRlbnRhdGlvbiA9IChjb25maWcuZWRpdG9yLmRldGVjdEluZGVudGF0aW9uID09PSAnZmFsc2UnID8gZmFsc2UgOiBCb29sZWFuKGNvbmZpZy5lZGl0b3IuZGV0ZWN0SW5kZW50YXRpb24pKTtcblx0XHR9XG5cblx0XHRsZXQgbGFyZ2VGaWxlT3B0aW1pemF0aW9ucyA9IEVESVRPUl9NT0RFTF9ERUZBVUxUUy5sYXJnZUZpbGVPcHRpbWl6YXRpb25zO1xuXHRcdGlmIChjb25maWcuZWRpdG9yICYmIHR5cGVvZiBjb25maWcuZWRpdG9yLmxhcmdlRmlsZU9wdGltaXphdGlvbnMgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHRsYXJnZUZpbGVPcHRpbWl6YXRpb25zID0gKGNvbmZpZy5lZGl0b3IubGFyZ2VGaWxlT3B0aW1pemF0aW9ucyA9PT0gJ2ZhbHNlJyA/IGZhbHNlIDogQm9vbGVhbihjb25maWcuZWRpdG9yLmxhcmdlRmlsZU9wdGltaXphdGlvbnMpKTtcblx0XHR9XG5cdFx0bGV0IGJyYWNrZXRQYWlyQ29sb3JpemF0aW9uT3B0aW9ucyA9IEVESVRPUl9NT0RFTF9ERUZBVUxUUy5icmFja2V0UGFpckNvbG9yaXphdGlvbk9wdGlvbnM7XG5cdFx0aWYgKGNvbmZpZy5lZGl0b3I/LmJyYWNrZXRQYWlyQ29sb3JpemF0aW9uICYmIHR5cGVvZiBjb25maWcuZWRpdG9yLmJyYWNrZXRQYWlyQ29sb3JpemF0aW9uID09PSAnb2JqZWN0Jykge1xuXHRcdFx0YnJhY2tldFBhaXJDb2xvcml6YXRpb25PcHRpb25zID0ge1xuXHRcdFx0XHRlbmFibGVkOiAhIWNvbmZpZy5lZGl0b3IuYnJhY2tldFBhaXJDb2xvcml6YXRpb24uZW5hYmxlZCxcblx0XHRcdFx0aW5kZXBlbmRlbnRDb2xvclBvb2xQZXJCcmFja2V0VHlwZTogISFjb25maWcuZWRpdG9yLmJyYWNrZXRQYWlyQ29sb3JpemF0aW9uLmluZGVwZW5kZW50Q29sb3JQb29sUGVyQnJhY2tldFR5cGVcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGlzRm9yU2ltcGxlV2lkZ2V0OiBpc0ZvclNpbXBsZVdpZGdldCxcblx0XHRcdHRhYlNpemU6IHRhYlNpemUsXG5cdFx0XHRpbmRlbnRTaXplOiBpbmRlbnRTaXplLFxuXHRcdFx0aW5zZXJ0U3BhY2VzOiBpbnNlcnRTcGFjZXMsXG5cdFx0XHRkZXRlY3RJbmRlbnRhdGlvbjogZGV0ZWN0SW5kZW50YXRpb24sXG5cdFx0XHRkZWZhdWx0RU9MOiBuZXdEZWZhdWx0RU9MLFxuXHRcdFx0dHJpbUF1dG9XaGl0ZXNwYWNlOiB0cmltQXV0b1doaXRlc3BhY2UsXG5cdFx0XHRsYXJnZUZpbGVPcHRpbWl6YXRpb25zOiBsYXJnZUZpbGVPcHRpbWl6YXRpb25zLFxuXHRcdFx0YnJhY2tldFBhaXJDb2xvcml6YXRpb25PcHRpb25zXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgX2dldEVPTChyZXNvdXJjZTogVVJJIHwgdW5kZWZpbmVkLCBsYW5ndWFnZTogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRpZiAocmVzb3VyY2UpIHtcblx0XHRcdHJldHVybiB0aGlzLl9yZXNvdXJjZVByb3BlcnRpZXNTZXJ2aWNlLmdldEVPTChyZXNvdXJjZSwgbGFuZ3VhZ2UpO1xuXHRcdH1cblx0XHRjb25zdCBlb2wgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnZmlsZXMuZW9sJywgeyBvdmVycmlkZUlkZW50aWZpZXI6IGxhbmd1YWdlIH0pO1xuXHRcdGlmIChlb2wgJiYgdHlwZW9mIGVvbCA9PT0gJ3N0cmluZycgJiYgZW9sICE9PSAnYXV0bycpIHtcblx0XHRcdHJldHVybiBlb2w7XG5cdFx0fVxuXHRcdHJldHVybiBwbGF0Zm9ybS5PUyA9PT0gcGxhdGZvcm0uT3BlcmF0aW5nU3lzdGVtLkxpbnV4IHx8IHBsYXRmb3JtLk9TID09PSBwbGF0Zm9ybS5PcGVyYXRpbmdTeXN0ZW0uTWFjaW50b3NoID8gJ1xcbicgOiAnXFxyXFxuJztcblx0fVxuXG5cdHByaXZhdGUgX3Nob3VsZFJlc3RvcmVVbmRvU3RhY2soKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoJ2ZpbGVzLnJlc3RvcmVVbmRvU3RhY2snKTtcblx0XHRpZiAodHlwZW9mIHJlc3VsdCA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyBnZXRDcmVhdGlvbk9wdGlvbnMobGFuZ3VhZ2VJZE9yU2VsZWN0aW9uOiBzdHJpbmcgfCBJTGFuZ3VhZ2VTZWxlY3Rpb24sIHJlc291cmNlOiBVUkkgfCB1bmRlZmluZWQsIGlzRm9yU2ltcGxlV2lkZ2V0OiBib29sZWFuKTogSVRleHRNb2RlbENyZWF0aW9uT3B0aW9ucyB7XG5cdFx0Y29uc3QgbGFuZ3VhZ2UgPSAodHlwZW9mIGxhbmd1YWdlSWRPclNlbGVjdGlvbiA9PT0gJ3N0cmluZycgPyBsYW5ndWFnZUlkT3JTZWxlY3Rpb24gOiBsYW5ndWFnZUlkT3JTZWxlY3Rpb24ubGFuZ3VhZ2VJZCk7XG5cdFx0bGV0IGNyZWF0aW9uT3B0aW9ucyA9IHRoaXMuX21vZGVsQ3JlYXRpb25PcHRpb25zQnlMYW5ndWFnZUFuZFJlc291cmNlW2xhbmd1YWdlICsgcmVzb3VyY2VdO1xuXHRcdGlmICghY3JlYXRpb25PcHRpb25zKSB7XG5cdFx0XHRjb25zdCBlZGl0b3IgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJUmF3RWRpdG9yQ29uZmlnPignZWRpdG9yJywgeyBvdmVycmlkZUlkZW50aWZpZXI6IGxhbmd1YWdlLCByZXNvdXJjZSB9KTtcblx0XHRcdGNvbnN0IGVvbCA9IHRoaXMuX2dldEVPTChyZXNvdXJjZSwgbGFuZ3VhZ2UpO1xuXHRcdFx0Y3JlYXRpb25PcHRpb25zID0gTW9kZWxTZXJ2aWNlLl9yZWFkTW9kZWxPcHRpb25zKHsgZWRpdG9yLCBlb2wgfSwgaXNGb3JTaW1wbGVXaWRnZXQpO1xuXHRcdFx0dGhpcy5fbW9kZWxDcmVhdGlvbk9wdGlvbnNCeUxhbmd1YWdlQW5kUmVzb3VyY2VbbGFuZ3VhZ2UgKyByZXNvdXJjZV0gPSBjcmVhdGlvbk9wdGlvbnM7XG5cdFx0fVxuXHRcdHJldHVybiBjcmVhdGlvbk9wdGlvbnM7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVNb2RlbE9wdGlvbnMoZTogSUNvbmZpZ3VyYXRpb25DaGFuZ2VFdmVudCB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGNvbnN0IG9sZE9wdGlvbnNCeUxhbmd1YWdlQW5kUmVzb3VyY2UgPSB0aGlzLl9tb2RlbENyZWF0aW9uT3B0aW9uc0J5TGFuZ3VhZ2VBbmRSZXNvdXJjZTtcblx0XHR0aGlzLl9tb2RlbENyZWF0aW9uT3B0aW9uc0J5TGFuZ3VhZ2VBbmRSZXNvdXJjZSA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cblx0XHQvLyBVcGRhdGUgb3B0aW9ucyBvbiBhbGwgbW9kZWxzXG5cdFx0Y29uc3Qga2V5cyA9IE9iamVjdC5rZXlzKHRoaXMuX21vZGVscyk7XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGtleXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IG1vZGVsSWQgPSBrZXlzW2ldO1xuXHRcdFx0Y29uc3QgbW9kZWxEYXRhID0gdGhpcy5fbW9kZWxzW21vZGVsSWRdO1xuXHRcdFx0Y29uc3QgbGFuZ3VhZ2UgPSBtb2RlbERhdGEubW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpO1xuXHRcdFx0Y29uc3QgdXJpID0gbW9kZWxEYXRhLm1vZGVsLnVyaTtcblxuXHRcdFx0aWYgKGUgJiYgIWUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ2VkaXRvcicsIHsgb3ZlcnJpZGVJZGVudGlmaWVyOiBsYW5ndWFnZSwgcmVzb3VyY2U6IHVyaSB9KSAmJiAhZS5hZmZlY3RzQ29uZmlndXJhdGlvbignZmlsZXMuZW9sJywgeyBvdmVycmlkZUlkZW50aWZpZXI6IGxhbmd1YWdlLCByZXNvdXJjZTogdXJpIH0pKSB7XG5cdFx0XHRcdGNvbnRpbnVlOyAvLyBwZXJmOiBza2lwIGlmIHRoaXMgbW9kZWwgaXMgbm90IGFmZmVjdGVkIGJ5IGNvbmZpZ3VyYXRpb24gY2hhbmdlXG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IG9sZE9wdGlvbnMgPSBvbGRPcHRpb25zQnlMYW5ndWFnZUFuZFJlc291cmNlW2xhbmd1YWdlICsgdXJpXTtcblx0XHRcdGNvbnN0IG5ld09wdGlvbnMgPSB0aGlzLmdldENyZWF0aW9uT3B0aW9ucyhsYW5ndWFnZSwgdXJpLCBtb2RlbERhdGEubW9kZWwuaXNGb3JTaW1wbGVXaWRnZXQpO1xuXHRcdFx0TW9kZWxTZXJ2aWNlLl9zZXRNb2RlbE9wdGlvbnNGb3JNb2RlbChtb2RlbERhdGEubW9kZWwsIG5ld09wdGlvbnMsIG9sZE9wdGlvbnMpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9zZXRNb2RlbE9wdGlvbnNGb3JNb2RlbChtb2RlbDogSVRleHRNb2RlbCwgbmV3T3B0aW9uczogSVRleHRNb2RlbENyZWF0aW9uT3B0aW9ucywgY3VycmVudE9wdGlvbnM6IElUZXh0TW9kZWxDcmVhdGlvbk9wdGlvbnMpOiB2b2lkIHtcblx0XHRpZiAoY3VycmVudE9wdGlvbnMgJiYgY3VycmVudE9wdGlvbnMuZGVmYXVsdEVPTCAhPT0gbmV3T3B0aW9ucy5kZWZhdWx0RU9MICYmIG1vZGVsLmdldExpbmVDb3VudCgpID09PSAxKSB7XG5cdFx0XHRtb2RlbC5zZXRFT0wobmV3T3B0aW9ucy5kZWZhdWx0RU9MID09PSBEZWZhdWx0RW5kT2ZMaW5lLkxGID8gRW5kT2ZMaW5lU2VxdWVuY2UuTEYgOiBFbmRPZkxpbmVTZXF1ZW5jZS5DUkxGKTtcblx0XHR9XG5cblx0XHRpZiAoY3VycmVudE9wdGlvbnNcblx0XHRcdCYmIChjdXJyZW50T3B0aW9ucy5kZXRlY3RJbmRlbnRhdGlvbiA9PT0gbmV3T3B0aW9ucy5kZXRlY3RJbmRlbnRhdGlvbilcblx0XHRcdCYmIChjdXJyZW50T3B0aW9ucy5pbnNlcnRTcGFjZXMgPT09IG5ld09wdGlvbnMuaW5zZXJ0U3BhY2VzKVxuXHRcdFx0JiYgKGN1cnJlbnRPcHRpb25zLnRhYlNpemUgPT09IG5ld09wdGlvbnMudGFiU2l6ZSlcblx0XHRcdCYmIChjdXJyZW50T3B0aW9ucy5pbmRlbnRTaXplID09PSBuZXdPcHRpb25zLmluZGVudFNpemUpXG5cdFx0XHQmJiAoY3VycmVudE9wdGlvbnMudHJpbUF1dG9XaGl0ZXNwYWNlID09PSBuZXdPcHRpb25zLnRyaW1BdXRvV2hpdGVzcGFjZSlcblx0XHRcdCYmIGVxdWFscyhjdXJyZW50T3B0aW9ucy5icmFja2V0UGFpckNvbG9yaXphdGlvbk9wdGlvbnMsIG5ld09wdGlvbnMuYnJhY2tldFBhaXJDb2xvcml6YXRpb25PcHRpb25zKVxuXHRcdCkge1xuXHRcdFx0Ly8gU2FtZSBpbmRlbnQgb3B0cywgbm8gbmVlZCB0byB0b3VjaCB0aGUgbW9kZWxcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAobmV3T3B0aW9ucy5kZXRlY3RJbmRlbnRhdGlvbikge1xuXHRcdFx0bW9kZWwuZGV0ZWN0SW5kZW50YXRpb24obmV3T3B0aW9ucy5pbnNlcnRTcGFjZXMsIG5ld09wdGlvbnMudGFiU2l6ZSk7XG5cdFx0XHRtb2RlbC51cGRhdGVPcHRpb25zKHtcblx0XHRcdFx0dHJpbUF1dG9XaGl0ZXNwYWNlOiBuZXdPcHRpb25zLnRyaW1BdXRvV2hpdGVzcGFjZSxcblx0XHRcdFx0YnJhY2tldENvbG9yaXphdGlvbk9wdGlvbnM6IG5ld09wdGlvbnMuYnJhY2tldFBhaXJDb2xvcml6YXRpb25PcHRpb25zXG5cdFx0XHR9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bW9kZWwudXBkYXRlT3B0aW9ucyh7XG5cdFx0XHRcdGluc2VydFNwYWNlczogbmV3T3B0aW9ucy5pbnNlcnRTcGFjZXMsXG5cdFx0XHRcdHRhYlNpemU6IG5ld09wdGlvbnMudGFiU2l6ZSxcblx0XHRcdFx0aW5kZW50U2l6ZTogbmV3T3B0aW9ucy5pbmRlbnRTaXplLFxuXHRcdFx0XHR0cmltQXV0b1doaXRlc3BhY2U6IG5ld09wdGlvbnMudHJpbUF1dG9XaGl0ZXNwYWNlLFxuXHRcdFx0XHRicmFja2V0Q29sb3JpemF0aW9uT3B0aW9uczogbmV3T3B0aW9ucy5icmFja2V0UGFpckNvbG9yaXphdGlvbk9wdGlvbnNcblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdC8vIC0tLSBiZWdpbiBJTW9kZWxTZXJ2aWNlXG5cblx0cHJpdmF0ZSBfaW5zZXJ0RGlzcG9zZWRNb2RlbChkaXNwb3NlZE1vZGVsRGF0YTogRGlzcG9zZWRNb2RlbEluZm8pOiB2b2lkIHtcblx0XHR0aGlzLl9kaXNwb3NlZE1vZGVscy5zZXQoTU9ERUxfSUQoZGlzcG9zZWRNb2RlbERhdGEudXJpKSwgZGlzcG9zZWRNb2RlbERhdGEpO1xuXHRcdHRoaXMuX2Rpc3Bvc2VkTW9kZWxzSGVhcFNpemUgKz0gZGlzcG9zZWRNb2RlbERhdGEuaGVhcFNpemU7XG5cdH1cblxuXHRwcml2YXRlIF9yZW1vdmVEaXNwb3NlZE1vZGVsKHJlc291cmNlOiBVUkkpOiBEaXNwb3NlZE1vZGVsSW5mbyB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgZGlzcG9zZWRNb2RlbERhdGEgPSB0aGlzLl9kaXNwb3NlZE1vZGVscy5nZXQoTU9ERUxfSUQocmVzb3VyY2UpKTtcblx0XHRpZiAoZGlzcG9zZWRNb2RlbERhdGEpIHtcblx0XHRcdHRoaXMuX2Rpc3Bvc2VkTW9kZWxzSGVhcFNpemUgLT0gZGlzcG9zZWRNb2RlbERhdGEuaGVhcFNpemU7XG5cdFx0fVxuXHRcdHRoaXMuX2Rpc3Bvc2VkTW9kZWxzLmRlbGV0ZShNT0RFTF9JRChyZXNvdXJjZSkpO1xuXHRcdHJldHVybiBkaXNwb3NlZE1vZGVsRGF0YTtcblx0fVxuXG5cdHByaXZhdGUgX2Vuc3VyZURpc3Bvc2VkTW9kZWxzSGVhcFNpemUobWF4TW9kZWxzSGVhcFNpemU6IG51bWJlcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9kaXNwb3NlZE1vZGVsc0hlYXBTaXplID4gbWF4TW9kZWxzSGVhcFNpemUpIHtcblx0XHRcdC8vIHdlIG11c3QgcmVtb3ZlIHNvbWUgb2xkIHVuZG8gc3RhY2sgZWxlbWVudHMgdG8gZnJlZSB1cCBzb21lIG1lbW9yeVxuXHRcdFx0Y29uc3QgZGlzcG9zZWRNb2RlbHM6IERpc3Bvc2VkTW9kZWxJbmZvW10gPSBbXTtcblx0XHRcdHRoaXMuX2Rpc3Bvc2VkTW9kZWxzLmZvckVhY2goZW50cnkgPT4ge1xuXHRcdFx0XHRpZiAoIWVudHJ5LnNoYXJlc1VuZG9SZWRvU3RhY2spIHtcblx0XHRcdFx0XHRkaXNwb3NlZE1vZGVscy5wdXNoKGVudHJ5KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0XHRkaXNwb3NlZE1vZGVscy5zb3J0KChhLCBiKSA9PiBhLnRpbWUgLSBiLnRpbWUpO1xuXHRcdFx0d2hpbGUgKGRpc3Bvc2VkTW9kZWxzLmxlbmd0aCA+IDAgJiYgdGhpcy5fZGlzcG9zZWRNb2RlbHNIZWFwU2l6ZSA+IG1heE1vZGVsc0hlYXBTaXplKSB7XG5cdFx0XHRcdGNvbnN0IGRpc3Bvc2VkTW9kZWwgPSBkaXNwb3NlZE1vZGVscy5zaGlmdCgpITtcblx0XHRcdFx0dGhpcy5fcmVtb3ZlRGlzcG9zZWRNb2RlbChkaXNwb3NlZE1vZGVsLnVyaSk7XG5cdFx0XHRcdGlmIChkaXNwb3NlZE1vZGVsLmluaXRpYWxVbmRvUmVkb1NuYXBzaG90ICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0dGhpcy5fdW5kb1JlZG9TZXJ2aWNlLnJlc3RvcmVTbmFwc2hvdChkaXNwb3NlZE1vZGVsLmluaXRpYWxVbmRvUmVkb1NuYXBzaG90KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2NyZWF0ZU1vZGVsRGF0YSh2YWx1ZTogc3RyaW5nIHwgSVRleHRCdWZmZXJGYWN0b3J5LCBsYW5ndWFnZUlkT3JTZWxlY3Rpb246IHN0cmluZyB8IElMYW5ndWFnZVNlbGVjdGlvbiwgcmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCwgaXNGb3JTaW1wbGVXaWRnZXQ6IGJvb2xlYW4pOiBNb2RlbERhdGEge1xuXHRcdC8vIGNyZWF0ZSAmIHNhdmUgdGhlIG1vZGVsXG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHRoaXMuZ2V0Q3JlYXRpb25PcHRpb25zKGxhbmd1YWdlSWRPclNlbGVjdGlvbiwgcmVzb3VyY2UsIGlzRm9yU2ltcGxlV2lkZ2V0KTtcblx0XHRjb25zdCBtb2RlbDogVGV4dE1vZGVsID0gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dE1vZGVsLFxuXHRcdFx0dmFsdWUsXG5cdFx0XHRsYW5ndWFnZUlkT3JTZWxlY3Rpb24sXG5cdFx0XHRvcHRpb25zLFxuXHRcdFx0cmVzb3VyY2Vcblx0XHQpO1xuXHRcdGlmIChyZXNvdXJjZSAmJiB0aGlzLl9kaXNwb3NlZE1vZGVscy5oYXMoTU9ERUxfSUQocmVzb3VyY2UpKSkge1xuXHRcdFx0Y29uc3QgZGlzcG9zZWRNb2RlbERhdGEgPSB0aGlzLl9yZW1vdmVEaXNwb3NlZE1vZGVsKHJlc291cmNlKSE7XG5cdFx0XHRjb25zdCBlbGVtZW50cyA9IHRoaXMuX3VuZG9SZWRvU2VydmljZS5nZXRFbGVtZW50cyhyZXNvdXJjZSk7XG5cdFx0XHRjb25zdCBzaGExQ29tcHV0ZXIgPSB0aGlzLl9nZXRTSEExQ29tcHV0ZXIoKTtcblx0XHRcdGNvbnN0IHNoYTFJc0VxdWFsID0gKFxuXHRcdFx0XHRzaGExQ29tcHV0ZXIuY2FuQ29tcHV0ZVNIQTEobW9kZWwpXG5cdFx0XHRcdFx0PyBzaGExQ29tcHV0ZXIuY29tcHV0ZVNIQTEobW9kZWwpID09PSBkaXNwb3NlZE1vZGVsRGF0YS5zaGExXG5cdFx0XHRcdFx0OiBmYWxzZVxuXHRcdFx0KTtcblx0XHRcdGlmIChzaGExSXNFcXVhbCB8fCBkaXNwb3NlZE1vZGVsRGF0YS5zaGFyZXNVbmRvUmVkb1N0YWNrKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgZWxlbWVudCBvZiBlbGVtZW50cy5wYXN0KSB7XG5cdFx0XHRcdFx0aWYgKGlzRWRpdFN0YWNrRWxlbWVudChlbGVtZW50KSAmJiBlbGVtZW50Lm1hdGNoZXNSZXNvdXJjZShyZXNvdXJjZSkpIHtcblx0XHRcdFx0XHRcdGVsZW1lbnQuc2V0TW9kZWwobW9kZWwpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRmb3IgKGNvbnN0IGVsZW1lbnQgb2YgZWxlbWVudHMuZnV0dXJlKSB7XG5cdFx0XHRcdFx0aWYgKGlzRWRpdFN0YWNrRWxlbWVudChlbGVtZW50KSAmJiBlbGVtZW50Lm1hdGNoZXNSZXNvdXJjZShyZXNvdXJjZSkpIHtcblx0XHRcdFx0XHRcdGVsZW1lbnQuc2V0TW9kZWwobW9kZWwpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl91bmRvUmVkb1NlcnZpY2Uuc2V0RWxlbWVudHNWYWxpZEZsYWcocmVzb3VyY2UsIHRydWUsIChlbGVtZW50KSA9PiAoaXNFZGl0U3RhY2tFbGVtZW50KGVsZW1lbnQpICYmIGVsZW1lbnQubWF0Y2hlc1Jlc291cmNlKHJlc291cmNlKSkpO1xuXHRcdFx0XHRpZiAoc2hhMUlzRXF1YWwpIHtcblx0XHRcdFx0XHRtb2RlbC5fb3ZlcndyaXRlVmVyc2lvbklkKGRpc3Bvc2VkTW9kZWxEYXRhLnZlcnNpb25JZCk7XG5cdFx0XHRcdFx0bW9kZWwuX292ZXJ3cml0ZUFsdGVybmF0aXZlVmVyc2lvbklkKGRpc3Bvc2VkTW9kZWxEYXRhLmFsdGVybmF0aXZlVmVyc2lvbklkKTtcblx0XHRcdFx0XHRtb2RlbC5fb3ZlcndyaXRlSW5pdGlhbFVuZG9SZWRvU25hcHNob3QoZGlzcG9zZWRNb2RlbERhdGEuaW5pdGlhbFVuZG9SZWRvU25hcHNob3QpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRpZiAoZGlzcG9zZWRNb2RlbERhdGEuaW5pdGlhbFVuZG9SZWRvU25hcHNob3QgIT09IG51bGwpIHtcblx0XHRcdFx0XHR0aGlzLl91bmRvUmVkb1NlcnZpY2UucmVzdG9yZVNuYXBzaG90KGRpc3Bvc2VkTW9kZWxEYXRhLmluaXRpYWxVbmRvUmVkb1NuYXBzaG90KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCBtb2RlbElkID0gTU9ERUxfSUQobW9kZWwudXJpKTtcblxuXHRcdGlmICh0aGlzLl9tb2RlbHNbbW9kZWxJZF0pIHtcblx0XHRcdC8vIFRoZXJlIGFscmVhZHkgZXhpc3RzIGEgbW9kZWwgd2l0aCB0aGlzIGlkID0+IHRoaXMgaXMgYSBwcm9ncmFtbWVyIGVycm9yXG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ01vZGVsU2VydmljZTogQ2Fubm90IGFkZCBtb2RlbCBiZWNhdXNlIGl0IGFscmVhZHkgZXhpc3RzIScpO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1vZGVsRGF0YSA9IG5ldyBNb2RlbERhdGEoXG5cdFx0XHRtb2RlbCxcblx0XHRcdChtb2RlbCkgPT4gdGhpcy5fb25XaWxsRGlzcG9zZShtb2RlbCksXG5cdFx0XHQobW9kZWwsIGUpID0+IHRoaXMuX29uRGlkQ2hhbmdlTGFuZ3VhZ2UobW9kZWwsIGUpXG5cdFx0KTtcblx0XHR0aGlzLl9tb2RlbHNbbW9kZWxJZF0gPSBtb2RlbERhdGE7XG5cblx0XHRyZXR1cm4gbW9kZWxEYXRhO1xuXHR9XG5cblx0cHVibGljIHVwZGF0ZU1vZGVsKG1vZGVsOiBJVGV4dE1vZGVsLCB2YWx1ZTogc3RyaW5nIHwgSVRleHRCdWZmZXJGYWN0b3J5KTogdm9pZCB7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHRoaXMuZ2V0Q3JlYXRpb25PcHRpb25zKG1vZGVsLmdldExhbmd1YWdlSWQoKSwgbW9kZWwudXJpLCBtb2RlbC5pc0ZvclNpbXBsZVdpZGdldCk7XG5cdFx0Y29uc3QgeyB0ZXh0QnVmZmVyLCBkaXNwb3NhYmxlIH0gPSBjcmVhdGVUZXh0QnVmZmVyKHZhbHVlLCBvcHRpb25zLmRlZmF1bHRFT0wpO1xuXG5cdFx0Ly8gUmV0dXJuIGVhcmx5IGlmIHRoZSB0ZXh0IGlzIGFscmVhZHkgc2V0IGluIHRoYXQgZm9ybVxuXHRcdGlmIChtb2RlbC5lcXVhbHNUZXh0QnVmZmVyKHRleHRCdWZmZXIpKSB7XG5cdFx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBPdGhlcndpc2UgZmluZCBhIGRpZmYgYmV0d2VlbiB0aGUgdmFsdWVzIGFuZCB1cGRhdGUgbW9kZWxcblx0XHRtb2RlbC5wdXNoU3RhY2tFbGVtZW50KCk7XG5cdFx0bW9kZWwucHVzaEVPTCh0ZXh0QnVmZmVyLmdldEVPTCgpID09PSAnXFxyXFxuJyA/IEVuZE9mTGluZVNlcXVlbmNlLkNSTEYgOiBFbmRPZkxpbmVTZXF1ZW5jZS5MRik7XG5cdFx0bW9kZWwucHVzaEVkaXRPcGVyYXRpb25zKFxuXHRcdFx0W10sXG5cdFx0XHRNb2RlbFNlcnZpY2UuX2NvbXB1dGVFZGl0cyhtb2RlbCwgdGV4dEJ1ZmZlciksXG5cdFx0XHQoKSA9PiBbXVxuXHRcdCk7XG5cdFx0bW9kZWwucHVzaFN0YWNrRWxlbWVudCgpO1xuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2NvbW1vblByZWZpeChhOiBJVGV4dE1vZGVsLCBhTGVuOiBudW1iZXIsIGFEZWx0YTogbnVtYmVyLCBiOiBJVGV4dEJ1ZmZlciwgYkxlbjogbnVtYmVyLCBiRGVsdGE6IG51bWJlcik6IG51bWJlciB7XG5cdFx0Y29uc3QgbWF4UmVzdWx0ID0gTWF0aC5taW4oYUxlbiwgYkxlbik7XG5cblx0XHRsZXQgcmVzdWx0ID0gMDtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG1heFJlc3VsdCAmJiBhLmdldExpbmVDb250ZW50KGFEZWx0YSArIGkpID09PSBiLmdldExpbmVDb250ZW50KGJEZWx0YSArIGkpOyBpKyspIHtcblx0XHRcdHJlc3VsdCsrO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2NvbW1vblN1ZmZpeChhOiBJVGV4dE1vZGVsLCBhTGVuOiBudW1iZXIsIGFEZWx0YTogbnVtYmVyLCBiOiBJVGV4dEJ1ZmZlciwgYkxlbjogbnVtYmVyLCBiRGVsdGE6IG51bWJlcik6IG51bWJlciB7XG5cdFx0Y29uc3QgbWF4UmVzdWx0ID0gTWF0aC5taW4oYUxlbiwgYkxlbik7XG5cblx0XHRsZXQgcmVzdWx0ID0gMDtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG1heFJlc3VsdCAmJiBhLmdldExpbmVDb250ZW50KGFEZWx0YSArIGFMZW4gLSBpKSA9PT0gYi5nZXRMaW5lQ29udGVudChiRGVsdGEgKyBiTGVuIC0gaSk7IGkrKykge1xuXHRcdFx0cmVzdWx0Kys7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHQvKipcblx0ICogQ29tcHV0ZSBlZGl0cyB0byBicmluZyBgbW9kZWxgIHRvIHRoZSBzdGF0ZSBvZiBgdGV4dFNvdXJjZWAuXG5cdCAqL1xuXHRwdWJsaWMgc3RhdGljIF9jb21wdXRlRWRpdHMobW9kZWw6IElUZXh0TW9kZWwsIHRleHRCdWZmZXI6IElUZXh0QnVmZmVyKTogSVNpbmdsZUVkaXRPcGVyYXRpb25bXSB7XG5cdFx0Y29uc3QgbW9kZWxMaW5lQ291bnQgPSBtb2RlbC5nZXRMaW5lQ291bnQoKTtcblx0XHRjb25zdCB0ZXh0QnVmZmVyTGluZUNvdW50ID0gdGV4dEJ1ZmZlci5nZXRMaW5lQ291bnQoKTtcblx0XHRjb25zdCBjb21tb25QcmVmaXggPSB0aGlzLl9jb21tb25QcmVmaXgobW9kZWwsIG1vZGVsTGluZUNvdW50LCAxLCB0ZXh0QnVmZmVyLCB0ZXh0QnVmZmVyTGluZUNvdW50LCAxKTtcblxuXHRcdGlmIChtb2RlbExpbmVDb3VudCA9PT0gdGV4dEJ1ZmZlckxpbmVDb3VudCAmJiBjb21tb25QcmVmaXggPT09IG1vZGVsTGluZUNvdW50KSB7XG5cdFx0XHQvLyBlcXVhbGl0eSBjYXNlXG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29tbW9uU3VmZml4ID0gdGhpcy5fY29tbW9uU3VmZml4KG1vZGVsLCBtb2RlbExpbmVDb3VudCAtIGNvbW1vblByZWZpeCwgY29tbW9uUHJlZml4LCB0ZXh0QnVmZmVyLCB0ZXh0QnVmZmVyTGluZUNvdW50IC0gY29tbW9uUHJlZml4LCBjb21tb25QcmVmaXgpO1xuXG5cdFx0bGV0IG9sZFJhbmdlOiBSYW5nZTtcblx0XHRsZXQgbmV3UmFuZ2U6IFJhbmdlO1xuXHRcdGlmIChjb21tb25TdWZmaXggPiAwKSB7XG5cdFx0XHRvbGRSYW5nZSA9IG5ldyBSYW5nZShjb21tb25QcmVmaXggKyAxLCAxLCBtb2RlbExpbmVDb3VudCAtIGNvbW1vblN1ZmZpeCArIDEsIDEpO1xuXHRcdFx0bmV3UmFuZ2UgPSBuZXcgUmFuZ2UoY29tbW9uUHJlZml4ICsgMSwgMSwgdGV4dEJ1ZmZlckxpbmVDb3VudCAtIGNvbW1vblN1ZmZpeCArIDEsIDEpO1xuXHRcdH0gZWxzZSBpZiAoY29tbW9uUHJlZml4ID4gMCkge1xuXHRcdFx0b2xkUmFuZ2UgPSBuZXcgUmFuZ2UoY29tbW9uUHJlZml4LCBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGNvbW1vblByZWZpeCksIG1vZGVsTGluZUNvdW50LCBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKG1vZGVsTGluZUNvdW50KSk7XG5cdFx0XHRuZXdSYW5nZSA9IG5ldyBSYW5nZShjb21tb25QcmVmaXgsIDEgKyB0ZXh0QnVmZmVyLmdldExpbmVMZW5ndGgoY29tbW9uUHJlZml4KSwgdGV4dEJ1ZmZlckxpbmVDb3VudCwgMSArIHRleHRCdWZmZXIuZ2V0TGluZUxlbmd0aCh0ZXh0QnVmZmVyTGluZUNvdW50KSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG9sZFJhbmdlID0gbmV3IFJhbmdlKDEsIDEsIG1vZGVsTGluZUNvdW50LCBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKG1vZGVsTGluZUNvdW50KSk7XG5cdFx0XHRuZXdSYW5nZSA9IG5ldyBSYW5nZSgxLCAxLCB0ZXh0QnVmZmVyTGluZUNvdW50LCAxICsgdGV4dEJ1ZmZlci5nZXRMaW5lTGVuZ3RoKHRleHRCdWZmZXJMaW5lQ291bnQpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gW0VkaXRPcGVyYXRpb24ucmVwbGFjZU1vdmUob2xkUmFuZ2UsIHRleHRCdWZmZXIuZ2V0VmFsdWVJblJhbmdlKG5ld1JhbmdlLCBFbmRPZkxpbmVQcmVmZXJlbmNlLlRleHREZWZpbmVkKSldO1xuXHR9XG5cblx0cHVibGljIGNyZWF0ZU1vZGVsKHZhbHVlOiBzdHJpbmcgfCBJVGV4dEJ1ZmZlckZhY3RvcnksIGxhbmd1YWdlU2VsZWN0aW9uOiBJTGFuZ3VhZ2VTZWxlY3Rpb24gfCBudWxsLCByZXNvdXJjZT86IFVSSSwgaXNGb3JTaW1wbGVXaWRnZXQ6IGJvb2xlYW4gPSBmYWxzZSk6IElUZXh0TW9kZWwge1xuXHRcdGxldCBtb2RlbERhdGE6IE1vZGVsRGF0YTtcblxuXHRcdGlmIChsYW5ndWFnZVNlbGVjdGlvbikge1xuXHRcdFx0bW9kZWxEYXRhID0gdGhpcy5fY3JlYXRlTW9kZWxEYXRhKHZhbHVlLCBsYW5ndWFnZVNlbGVjdGlvbiwgcmVzb3VyY2UsIGlzRm9yU2ltcGxlV2lkZ2V0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bW9kZWxEYXRhID0gdGhpcy5fY3JlYXRlTW9kZWxEYXRhKHZhbHVlLCBQTEFJTlRFWFRfTEFOR1VBR0VfSUQsIHJlc291cmNlLCBpc0ZvclNpbXBsZVdpZGdldCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25Nb2RlbEFkZGVkLmZpcmUobW9kZWxEYXRhLm1vZGVsKTtcblxuXHRcdHJldHVybiBtb2RlbERhdGEubW9kZWw7XG5cdH1cblxuXHRwdWJsaWMgZGVzdHJveU1vZGVsKHJlc291cmNlOiBVUkkpOiB2b2lkIHtcblx0XHQvLyBXZSBuZWVkIHRvIHN1cHBvcnQgdGhhdCBub3QgYWxsIG1vZGVscyBnZXQgZGlzcG9zZWQgdGhyb3VnaCB0aGlzIHNlcnZpY2UgKGkuZS4gbW9kZWwuZGlzcG9zZSgpIHNob3VsZCB3b3JrISlcblx0XHRjb25zdCBtb2RlbERhdGEgPSB0aGlzLl9tb2RlbHNbTU9ERUxfSUQocmVzb3VyY2UpXTtcblx0XHRpZiAoIW1vZGVsRGF0YSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRtb2RlbERhdGEubW9kZWwuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHVibGljIGdldE1vZGVscygpOiBJVGV4dE1vZGVsW10ge1xuXHRcdGNvbnN0IHJldDogSVRleHRNb2RlbFtdID0gW107XG5cblx0XHRjb25zdCBrZXlzID0gT2JqZWN0LmtleXModGhpcy5fbW9kZWxzKTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0ga2V5cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3QgbW9kZWxJZCA9IGtleXNbaV07XG5cdFx0XHRyZXQucHVzaCh0aGlzLl9tb2RlbHNbbW9kZWxJZF0ubW9kZWwpO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0TW9kZWwocmVzb3VyY2U6IFVSSSk6IElUZXh0TW9kZWwgfCBudWxsIHtcblx0XHRjb25zdCBtb2RlbElkID0gTU9ERUxfSUQocmVzb3VyY2UpO1xuXHRcdGNvbnN0IG1vZGVsRGF0YSA9IHRoaXMuX21vZGVsc1ttb2RlbElkXTtcblx0XHRpZiAoIW1vZGVsRGF0YSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHJldHVybiBtb2RlbERhdGEubW9kZWw7XG5cdH1cblxuXHQvLyAtLS0gZW5kIElNb2RlbFNlcnZpY2VcblxuXHRwcm90ZWN0ZWQgX3NjaGVtYVNob3VsZE1haW50YWluVW5kb1JlZG9FbGVtZW50cyhyZXNvdXJjZTogVVJJKSB7XG5cdFx0cmV0dXJuIChcblx0XHRcdHJlc291cmNlLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlXG5cdFx0XHR8fCByZXNvdXJjZS5zY2hlbWUgPT09IFNjaGVtYXMudnNjb2RlUmVtb3RlXG5cdFx0XHR8fCByZXNvdXJjZS5zY2hlbWUgPT09IFNjaGVtYXMudnNjb2RlVXNlckRhdGFcblx0XHRcdHx8IHJlc291cmNlLnNjaGVtZSA9PT0gU2NoZW1hcy52c2NvZGVOb3RlYm9va0NlbGxcblx0XHRcdHx8IHJlc291cmNlLnNjaGVtZSA9PT0gJ2Zha2UtZnMnIC8vIGZvciB0ZXN0c1xuXHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIF9vbldpbGxEaXNwb3NlKG1vZGVsOiBJVGV4dE1vZGVsKTogdm9pZCB7XG5cdFx0Y29uc3QgbW9kZWxJZCA9IE1PREVMX0lEKG1vZGVsLnVyaSk7XG5cdFx0Y29uc3QgbW9kZWxEYXRhID0gdGhpcy5fbW9kZWxzW21vZGVsSWRdO1xuXG5cdFx0Y29uc3Qgc2hhcmVzVW5kb1JlZG9TdGFjayA9ICh0aGlzLl91bmRvUmVkb1NlcnZpY2UuZ2V0VXJpQ29tcGFyaXNvbktleShtb2RlbC51cmkpICE9PSBtb2RlbC51cmkudG9TdHJpbmcoKSk7XG5cdFx0bGV0IG1haW50YWluVW5kb1JlZG9TdGFjayA9IGZhbHNlO1xuXHRcdGxldCBoZWFwU2l6ZSA9IDA7XG5cdFx0aWYgKHNoYXJlc1VuZG9SZWRvU3RhY2sgfHwgKHRoaXMuX3Nob3VsZFJlc3RvcmVVbmRvU3RhY2soKSAmJiB0aGlzLl9zY2hlbWFTaG91bGRNYWludGFpblVuZG9SZWRvRWxlbWVudHMobW9kZWwudXJpKSkpIHtcblx0XHRcdGNvbnN0IGVsZW1lbnRzID0gdGhpcy5fdW5kb1JlZG9TZXJ2aWNlLmdldEVsZW1lbnRzKG1vZGVsLnVyaSk7XG5cdFx0XHRpZiAoZWxlbWVudHMucGFzdC5sZW5ndGggPiAwIHx8IGVsZW1lbnRzLmZ1dHVyZS5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgZWxlbWVudCBvZiBlbGVtZW50cy5wYXN0KSB7XG5cdFx0XHRcdFx0aWYgKGlzRWRpdFN0YWNrRWxlbWVudChlbGVtZW50KSAmJiBlbGVtZW50Lm1hdGNoZXNSZXNvdXJjZShtb2RlbC51cmkpKSB7XG5cdFx0XHRcdFx0XHRtYWludGFpblVuZG9SZWRvU3RhY2sgPSB0cnVlO1xuXHRcdFx0XHRcdFx0aGVhcFNpemUgKz0gZWxlbWVudC5oZWFwU2l6ZShtb2RlbC51cmkpO1xuXHRcdFx0XHRcdFx0ZWxlbWVudC5zZXRNb2RlbChtb2RlbC51cmkpOyAvLyByZW1vdmUgcmVmZXJlbmNlIGZyb20gdGV4dCBidWZmZXIgaW5zdGFuY2Vcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0Zm9yIChjb25zdCBlbGVtZW50IG9mIGVsZW1lbnRzLmZ1dHVyZSkge1xuXHRcdFx0XHRcdGlmIChpc0VkaXRTdGFja0VsZW1lbnQoZWxlbWVudCkgJiYgZWxlbWVudC5tYXRjaGVzUmVzb3VyY2UobW9kZWwudXJpKSkge1xuXHRcdFx0XHRcdFx0bWFpbnRhaW5VbmRvUmVkb1N0YWNrID0gdHJ1ZTtcblx0XHRcdFx0XHRcdGhlYXBTaXplICs9IGVsZW1lbnQuaGVhcFNpemUobW9kZWwudXJpKTtcblx0XHRcdFx0XHRcdGVsZW1lbnQuc2V0TW9kZWwobW9kZWwudXJpKTsgLy8gcmVtb3ZlIHJlZmVyZW5jZSBmcm9tIHRleHQgYnVmZmVyIGluc3RhbmNlXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgbWF4TWVtb3J5ID0gTW9kZWxTZXJ2aWNlLk1BWF9NRU1PUllfRk9SX0NMT1NFRF9GSUxFU19VTkRPX1NUQUNLO1xuXHRcdGNvbnN0IHNoYTFDb21wdXRlciA9IHRoaXMuX2dldFNIQTFDb21wdXRlcigpO1xuXHRcdGlmICghbWFpbnRhaW5VbmRvUmVkb1N0YWNrKSB7XG5cdFx0XHRpZiAoIXNoYXJlc1VuZG9SZWRvU3RhY2spIHtcblx0XHRcdFx0Y29uc3QgaW5pdGlhbFVuZG9SZWRvU25hcHNob3QgPSBtb2RlbERhdGEubW9kZWwuZ2V0SW5pdGlhbFVuZG9SZWRvU25hcHNob3QoKTtcblx0XHRcdFx0aWYgKGluaXRpYWxVbmRvUmVkb1NuYXBzaG90ICE9PSBudWxsKSB7XG5cdFx0XHRcdFx0dGhpcy5fdW5kb1JlZG9TZXJ2aWNlLnJlc3RvcmVTbmFwc2hvdChpbml0aWFsVW5kb1JlZG9TbmFwc2hvdCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKCFzaGFyZXNVbmRvUmVkb1N0YWNrICYmIChoZWFwU2l6ZSA+IG1heE1lbW9yeSB8fCAhc2hhMUNvbXB1dGVyLmNhbkNvbXB1dGVTSEExKG1vZGVsKSkpIHtcblx0XHRcdC8vIHRoZSB1bmRvIHN0YWNrIGZvciB0aGlzIGZpbGUgd291bGQgbmV2ZXIgZml0IGluIHRoZSBjb25maWd1cmVkIG1lbW9yeSBvciB0aGUgZmlsZSBpcyB2ZXJ5IGxhcmdlLCBzbyBkb24ndCBib3RoZXIgd2l0aCBpdC5cblx0XHRcdGNvbnN0IGluaXRpYWxVbmRvUmVkb1NuYXBzaG90ID0gbW9kZWxEYXRhLm1vZGVsLmdldEluaXRpYWxVbmRvUmVkb1NuYXBzaG90KCk7XG5cdFx0XHRpZiAoaW5pdGlhbFVuZG9SZWRvU25hcHNob3QgIT09IG51bGwpIHtcblx0XHRcdFx0dGhpcy5fdW5kb1JlZG9TZXJ2aWNlLnJlc3RvcmVTbmFwc2hvdChpbml0aWFsVW5kb1JlZG9TbmFwc2hvdCk7XG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2Vuc3VyZURpc3Bvc2VkTW9kZWxzSGVhcFNpemUobWF4TWVtb3J5IC0gaGVhcFNpemUpO1xuXHRcdFx0Ly8gV2Ugb25seSBpbnZhbGlkYXRlIHRoZSBlbGVtZW50cywgYnV0IHRoZXkgcmVtYWluIGluIHRoZSB1bmRvLXJlZG8gc2VydmljZS5cblx0XHRcdHRoaXMuX3VuZG9SZWRvU2VydmljZS5zZXRFbGVtZW50c1ZhbGlkRmxhZyhtb2RlbC51cmksIGZhbHNlLCAoZWxlbWVudCkgPT4gKGlzRWRpdFN0YWNrRWxlbWVudChlbGVtZW50KSAmJiBlbGVtZW50Lm1hdGNoZXNSZXNvdXJjZShtb2RlbC51cmkpKSk7XG5cdFx0XHR0aGlzLl9pbnNlcnREaXNwb3NlZE1vZGVsKG5ldyBEaXNwb3NlZE1vZGVsSW5mbyhtb2RlbC51cmksIG1vZGVsRGF0YS5tb2RlbC5nZXRJbml0aWFsVW5kb1JlZG9TbmFwc2hvdCgpLCBEYXRlLm5vdygpLCBzaGFyZXNVbmRvUmVkb1N0YWNrLCBoZWFwU2l6ZSwgc2hhMUNvbXB1dGVyLmNvbXB1dGVTSEExKG1vZGVsKSwgbW9kZWwuZ2V0VmVyc2lvbklkKCksIG1vZGVsLmdldEFsdGVybmF0aXZlVmVyc2lvbklkKCkpKTtcblx0XHR9XG5cblx0XHRkZWxldGUgdGhpcy5fbW9kZWxzW21vZGVsSWRdO1xuXHRcdG1vZGVsRGF0YS5kaXNwb3NlKCk7XG5cblx0XHQvLyBjbGVhbiB1cCBjYWNoZVxuXHRcdGRlbGV0ZSB0aGlzLl9tb2RlbENyZWF0aW9uT3B0aW9uc0J5TGFuZ3VhZ2VBbmRSZXNvdXJjZVttb2RlbC5nZXRMYW5ndWFnZUlkKCkgKyBtb2RlbC51cmldO1xuXG5cdFx0dGhpcy5fb25Nb2RlbFJlbW92ZWQuZmlyZShtb2RlbCk7XG5cdH1cblxuXHRwcml2YXRlIF9vbkRpZENoYW5nZUxhbmd1YWdlKG1vZGVsOiBJVGV4dE1vZGVsLCBlOiBJTW9kZWxMYW5ndWFnZUNoYW5nZWRFdmVudCk6IHZvaWQge1xuXHRcdGNvbnN0IG9sZExhbmd1YWdlSWQgPSBlLm9sZExhbmd1YWdlO1xuXHRcdGNvbnN0IG5ld0xhbmd1YWdlSWQgPSBtb2RlbC5nZXRMYW5ndWFnZUlkKCk7XG5cdFx0Y29uc3Qgb2xkT3B0aW9ucyA9IHRoaXMuZ2V0Q3JlYXRpb25PcHRpb25zKG9sZExhbmd1YWdlSWQsIG1vZGVsLnVyaSwgbW9kZWwuaXNGb3JTaW1wbGVXaWRnZXQpO1xuXHRcdGNvbnN0IG5ld09wdGlvbnMgPSB0aGlzLmdldENyZWF0aW9uT3B0aW9ucyhuZXdMYW5ndWFnZUlkLCBtb2RlbC51cmksIG1vZGVsLmlzRm9yU2ltcGxlV2lkZ2V0KTtcblx0XHRNb2RlbFNlcnZpY2UuX3NldE1vZGVsT3B0aW9uc0Zvck1vZGVsKG1vZGVsLCBuZXdPcHRpb25zLCBvbGRPcHRpb25zKTtcblx0XHR0aGlzLl9vbk1vZGVsTW9kZUNoYW5nZWQuZmlyZSh7IG1vZGVsLCBvbGRMYW5ndWFnZUlkOiBvbGRMYW5ndWFnZUlkIH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIF9nZXRTSEExQ29tcHV0ZXIoKTogSVRleHRNb2RlbFNIQTFDb21wdXRlciB7XG5cdFx0cmV0dXJuIG5ldyBEZWZhdWx0TW9kZWxTSEExQ29tcHV0ZXIoKTtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElUZXh0TW9kZWxTSEExQ29tcHV0ZXIge1xuXHRjYW5Db21wdXRlU0hBMShtb2RlbDogSVRleHRNb2RlbCk6IGJvb2xlYW47XG5cdGNvbXB1dGVTSEExKG1vZGVsOiBJVGV4dE1vZGVsKTogc3RyaW5nO1xufVxuXG5leHBvcnQgY2xhc3MgRGVmYXVsdE1vZGVsU0hBMUNvbXB1dGVyIGltcGxlbWVudHMgSVRleHRNb2RlbFNIQTFDb21wdXRlciB7XG5cblx0cHVibGljIHN0YXRpYyBNQVhfTU9ERUxfU0laRSA9IDEwICogMTAyNCAqIDEwMjQ7IC8vIHRha2VzIDIwMG1zIHRvIGNvbXB1dGUgYSBzaGExIG9uIGEgMTBNQiBtb2RlbCBvbiBhIG5ldyBtYWNoaW5lXG5cblx0Y2FuQ29tcHV0ZVNIQTEobW9kZWw6IElUZXh0TW9kZWwpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gKG1vZGVsLmdldFZhbHVlTGVuZ3RoKCkgPD0gRGVmYXVsdE1vZGVsU0hBMUNvbXB1dGVyLk1BWF9NT0RFTF9TSVpFKTtcblx0fVxuXG5cdGNvbXB1dGVTSEExKG1vZGVsOiBJVGV4dE1vZGVsKTogc3RyaW5nIHtcblx0XHQvLyBjb21wdXRlIHRoZSBzaGExXG5cdFx0Y29uc3Qgc2hhQ29tcHV0ZXIgPSBuZXcgU3RyaW5nU0hBMSgpO1xuXHRcdGNvbnN0IHNuYXBzaG90ID0gbW9kZWwuY3JlYXRlU25hcHNob3QoKTtcblx0XHRsZXQgdGV4dDogc3RyaW5nIHwgbnVsbDtcblx0XHR3aGlsZSAoKHRleHQgPSBzbmFwc2hvdC5yZWFkKCkpKSB7XG5cdFx0XHRzaGFDb21wdXRlci51cGRhdGUodGV4dCk7XG5cdFx0fVxuXHRcdHJldHVybiBzaGFDb21wdXRlci5kaWdlc3QoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGVBQXNCO0FBQy9CLFNBQVMsWUFBeUIsdUJBQXVCO0FBQ3pELFlBQVksY0FBYztBQUUxQixTQUFTLHFCQUEyQztBQUNwRCxTQUFTLGFBQWE7QUFDdEIsU0FBUyxrQkFBa0IscUJBQXFCLHlCQUFpRztBQUNqSixTQUFTLFdBQVcsd0JBQXdCO0FBQzVDLFNBQVMsNkJBQTZCO0FBRXRDLFNBQVMsNkJBQTZCO0FBR3RDLFNBQVMsc0NBQXNDO0FBQy9DLFNBQW9DLDZCQUE2QjtBQUNqRSxTQUFTLHdCQUFtRDtBQUM1RCxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsNkJBQTZCO0FBRXRDLFNBQVMsU0FBUyxVQUF1QjtBQUN4QyxTQUFPLFNBQVMsU0FBUztBQUMxQjtBQUVBLE1BQU0sVUFBaUM7QUFBQSxFQUl0QyxZQUNpQixPQUNoQixlQUNBLHFCQUNDO0FBSGU7QUFIakIsU0FBaUIsdUJBQXVCLElBQUksZ0JBQWdCO0FBTzNELFNBQUssUUFBUTtBQUNiLFNBQUsscUJBQXFCLElBQUksTUFBTSxjQUFjLE1BQU0sY0FBYyxLQUFLLENBQUMsQ0FBQztBQUM3RSxTQUFLLHFCQUFxQixJQUFJLE1BQU0sb0JBQW9CLENBQUMsTUFBTSxvQkFBb0IsT0FBTyxDQUFDLENBQUMsQ0FBQztBQUFBLEVBQzlGO0FBQUEsRUFFTyxVQUFnQjtBQUN0QixTQUFLLHFCQUFxQixRQUFRO0FBQUEsRUFDbkM7QUFDRDtBQWtCQSxNQUFNLGNBQWUsU0FBUyxXQUFXLFNBQVMsY0FBZSxpQkFBaUIsS0FBSyxpQkFBaUI7QUFFeEcsTUFBTSxrQkFBa0I7QUFBQSxFQUN2QixZQUNpQixLQUNBLHlCQUNBLE1BQ0EscUJBQ0EsVUFDQSxNQUNBLFdBQ0Esc0JBQ2Y7QUFSZTtBQUNB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QkFBaUIscUJBQXFCLE1BQU0sS0FBSyxPQUFPLENBQUMsWUFBYSxtQkFBbUIsT0FBTyxLQUFLLFFBQVEsZ0JBQWdCLE1BQU0sR0FBRyxDQUFFO0FBQzdJLFdBQUsscUJBQXFCLElBQUksa0JBQWtCLE1BQU0sS0FBSyxVQUFVLE1BQU0sMkJBQTJCLEdBQUcsS0FBSyxJQUFJLEdBQUcscUJBQXFCLFVBQVUsYUFBYSxZQUFZLEtBQUssR0FBRyxNQUFNLGFBQWEsR0FBRyxNQUFNLHdCQUF3QixDQUFDLENBQUM7QUFBQSxJQUM1TztBQUVBLFdBQU8sS0FBSyxRQUFRLE9BQU87QUFDM0IsY0FBVSxRQUFRO0FBR2xCLFdBQU8sS0FBSywyQ0FBMkMsTUFBTSxjQUFjLElBQUksTUFBTSxHQUFHO0FBRXhGLFNBQUssZ0JBQWdCLEtBQUssS0FBSztBQUFBLEVBQ2hDO0FBQUEsRUFFUSxxQkFBcUIsT0FBbUIsR0FBcUM7QUFDcEYsVUFBTSxnQkFBZ0IsRUFBRTtBQUN4QixVQUFNLGdCQUFnQixNQUFNLGNBQWM7QUFDMUMsVUFBTSxhQUFhLEtBQUssbUJBQW1CLGVBQWUsTUFBTSxLQUFLLE1BQU0saUJBQWlCO0FBQzVGLFVBQU0sYUFBYSxLQUFLLG1CQUFtQixlQUFlLE1BQU0sS0FBSyxNQUFNLGlCQUFpQjtBQUM1RixpQkFBYSx5QkFBeUIsT0FBTyxZQUFZLFVBQVU7QUFDbkUsU0FBSyxvQkFBb0IsS0FBSyxFQUFFLE9BQU8sY0FBNkIsQ0FBQztBQUFBLEVBQ3RFO0FBQUEsRUFFVSxtQkFBMkM7QUFDcEQsV0FBTyxJQUFJLHlCQUF5QjtBQUFBLEVBQ3JDO0FBQ0Q7QUF4ZWEsYUFFRSx5Q0FBeUMsS0FBSyxPQUFPO0FBRnZELGVBQU47QUFBQSxFQXlCSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBNUJVO0FBK2VOLE1BQU0sNEJBQU4sTUFBTSwwQkFBMkQ7QUFBQTtBQUFBLEVBSXZFLGVBQWUsT0FBNEI7QUFDMUMsV0FBUSxNQUFNLGVBQWUsS0FBSywwQkFBeUI7QUFBQSxFQUM1RDtBQUFBLEVBRUEsWUFBWSxPQUEyQjtBQUV0QyxVQUFNLGNBQWMsSUFBSSxXQUFXO0FBQ25DLFVBQU0sV0FBVyxNQUFNLGVBQWU7QUFDdEMsUUFBSTtBQUNKLFdBQVEsT0FBTyxTQUFTLEtBQUssR0FBSTtBQUNoQyxrQkFBWSxPQUFPLElBQUk7QUFBQSxJQUN4QjtBQUNBLFdBQU8sWUFBWSxPQUFPO0FBQUEsRUFDM0I7QUFDRDtBQWxCYSwwQkFFRSxpQkFBaUIsS0FBSyxPQUFPO0FBRnJDLElBQU0sMkJBQU47IiwKICAibmFtZXMiOiBbIm1vZGVsIl0KfQo=
